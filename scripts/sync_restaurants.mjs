#!/usr/bin/env node
/**
 * Unified GTA Restaurant Health Inspection Sync Pipeline
 * 
 * Supports both:
 * 1. Toronto (City of Toronto Public Health DineSafe)
 * 2. Markham / York Region (York Region Public Health YorkSafe)
 * 
 * Both regions apply the exact same:
 * - Address normalization (postal code stripping, road abbreviation standardizing)
 * - Business name normalization
 * - Brand-similarity clustering at same physical premises (filtering out relicensed old stores)
 * - Target opening window calculation
 * - Batch synchronization to Green Oil Cloudflare Worker / D1 backend
 */

import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import {
  loadEnv,
  cleanAddress,
  normalizeAddressKey,
  normalizeNameKey,
  isSimilarBusinessName,
  clusterEstablishments,
  filterNewlyOpened,
  uploadToBackend
} from './sync_utils.mjs';

import {
  getLatestDinesafeCsvUrl,
  processDinesafeStream
} from './sync_dinesafe.mjs';

import {
  processYorkSafePipeline
} from './fetch_yorksafe.mjs';

// Automatically load local .env on startup
loadEnv();

const DEFAULT_WORKER_URL = process.env.WORKER_URL || "https://greenoil-api.ydxhjw4j5w.workers.dev";

/**
 * Fetch and process Toronto DineSafe data
 */
export async function runTorontoPipeline(options = {}) {
  const localFile = options.torontoFile || null;
  const maxDays = options.days || 90;

  console.log(`\n========================================`);
  console.log(`  [1/2] Ingesting Toronto DineSafe Data`);
  console.log(`========================================`);

  let inputStream;
  if (localFile && fs.existsSync(localFile)) {
    console.log(`[Toronto] Reading local CSV file: ${localFile}`);
    inputStream = fs.createReadStream(localFile);
  } else {
    const csvUrl = await getLatestDinesafeCsvUrl();
    console.log(`[Toronto] Streaming download from ${csvUrl}...`);
    const resp = await fetch(csvUrl);
    if (!resp.ok) throw new Error(`Toronto DineSafe download failed: HTTP ${resp.status}`);
    inputStream = Readable.fromWeb(resp.body);
  }

  const allEstablishments = await processDinesafeStream(inputStream);
  const { newlyOpened, referenceDateStr } = filterNewlyOpened(allEstablishments, maxDays);

  const refDate = new Date(referenceDateStr + "T00:00:00Z");
  const count1d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + "T00:00:00Z")) <= 1 * 86400000).length;
  const count7d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + "T00:00:00Z")) <= 7 * 86400000).length;
  const count30d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + "T00:00:00Z")) <= 30 * 86400000).length;

  console.log(`[Toronto] Completed: ${newlyOpened.length} newly opened restaurants (past ${maxDays} days).`);
  return {
    region: 'Toronto',
    newlyOpened,
    allEstablishments,
    referenceDateStr,
    stats: { count1d, count7d, count30d, total: newlyOpened.length }
  };
}

/**
 * Fetch and process Markham / York Region YorkSafe data
 */
export async function runYorkSafePipeline(options = {}) {
  const municipality = options.municipality || 'Markham';
  const maxDays = options.days || 90;
  const forceRefresh = !!options.forceRefresh;

  console.log(`\n========================================`);
  console.log(`  [2/2] Ingesting YorkSafe (${municipality}) Data`);
  console.log(`========================================`);

  const { allEstablishments, newlyOpened, referenceDateStr } = await processYorkSafePipeline({
    municipality,
    days: maxDays,
    forceRefresh
  });

  const refDate = new Date(referenceDateStr + "T00:00:00Z");
  const count1d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + "T00:00:00Z")) <= 1 * 86400000).length;
  const count7d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + "T00:00:00Z")) <= 7 * 86400000).length;
  const count30d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + "T00:00:00Z")) <= 30 * 86400000).length;

  console.log(`[YorkSafe] Completed: ${newlyOpened.length} newly opened restaurants in ${municipality} (past ${maxDays} days).`);
  return {
    region: municipality,
    newlyOpened,
    allEstablishments,
    referenceDateStr,
    stats: { count1d, count7d, count30d, total: newlyOpened.length }
  };
}

/**
 * CLI Main Runner
 */
export async function main() {
  const args = process.argv.slice(2);
  let region = 'all'; // 'all', 'toronto', 'markham'
  let municipality = 'Markham';
  let maxDays = 90;
  let localFile = null;
  let forceRefresh = false;
  let dryRun = false;
  let workerUrl = process.env.WORKER_URL || DEFAULT_WORKER_URL;
  let username = process.env.WORKER_USERNAME || null;
  let password = process.env.WORKER_PASSWORD || null;
  let token = process.env.WORKER_TOKEN || null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--region' && args[i + 1]) region = args[++i].toLowerCase();
    else if (args[i] === '--municipality' && args[i + 1]) municipality = args[++i];
    else if (args[i] === '--days' && args[i + 1]) maxDays = parseInt(args[++i], 10);
    else if (args[i] === '--file' && args[i + 1]) localFile = args[++i];
    else if (args[i] === '--force-refresh') forceRefresh = true;
    else if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--worker-url' && args[i + 1]) workerUrl = args[++i];
    else if (args[i] === '--username' && args[i + 1]) username = args[++i];
    else if (args[i] === '--password' && args[i + 1]) password = args[++i];
    else if (args[i] === '--token' && args[i + 1]) token = args[++i];
  }

  workerUrl = workerUrl || process.env.WORKER_URL || DEFAULT_WORKER_URL;
  username = username || process.env.WORKER_USERNAME || null;
  password = password || process.env.WORKER_PASSWORD || null;
  token = token || process.env.WORKER_TOKEN || null;

  const combinedRestaurants = [];
  let torontoResult = null;
  let yorkResult = null;

  if (region === 'all' || region === 'toronto') {
    torontoResult = await runTorontoPipeline({
      torontoFile: localFile,
      days: maxDays
    });
    combinedRestaurants.push(...torontoResult.newlyOpened);
  }

  if (region === 'all' || region === 'markham' || region === 'york') {
    yorkResult = await runYorkSafePipeline({
      municipality,
      days: maxDays,
      forceRefresh
    });
    combinedRestaurants.push(...yorkResult.newlyOpened);
  }

  // Deduplicate combined list by id
  const finalMap = new Map();
  for (const r of combinedRestaurants) {
    finalMap.set(r.id, r);
  }
  const finalRestaurants = Array.from(finalMap.values());
  finalRestaurants.sort((a, b) => b.firstInspectionDate.localeCompare(a.firstInspectionDate));

  // Print Combined Report
  console.log(`\n========================================`);
  console.log(`  GTA Restaurant Ingestion Final Summary`);
  console.log(`========================================`);
  if (torontoResult) {
    console.log(`Toronto (DineSafe):`);
    console.log(`  - 1 Day:   ${torontoResult.stats.count1d}`);
    console.log(`  - 7 Days:  ${torontoResult.stats.count7d}`);
    console.log(`  - 30 Days: ${torontoResult.stats.count30d}`);
    console.log(`  - Total:   ${torontoResult.stats.total} (past ${maxDays} days)`);
  }
  if (yorkResult) {
    console.log(`${yorkResult.region} (YorkSafe):`);
    console.log(`  - 1 Day:   ${yorkResult.stats.count1d}`);
    console.log(`  - 7 Days:  ${yorkResult.stats.count7d}`);
    console.log(`  - 30 Days: ${yorkResult.stats.count30d}`);
    console.log(`  - Total:   ${yorkResult.stats.total} (past ${maxDays} days)`);
  }
  console.log(`----------------------------------------`);
  console.log(`Grand Total Upload Target: ${finalRestaurants.length} restaurants across GTA`);
  console.log(`========================================\n`);

  if (dryRun) {
    console.log(`[Sync] Dry run completed. Skipping backend upload.`);
    return;
  }

  // Upload to backend
  try {
    await uploadToBackend(finalRestaurants, { workerUrl, username, password, token });
  } catch (err) {
    console.error(`[Sync] Upload to backend failed:`, err.message);
    process.exit(1);
  }
}

// Run CLI if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error("[Sync] Fatal Error:", err);
    process.exit(1);
  });
}
