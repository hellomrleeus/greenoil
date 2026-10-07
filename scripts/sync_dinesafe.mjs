#!/usr/bin/env node
/**
 * Toronto Public Health DineSafe - Daily Sync & Newly Opened Restaurants Ingestion
 * 
 * 1. Dynamically discovers latest Dinesafe.csv URL via City of Toronto Open Data CKAN API.
 * 2. Streams and parses inspection records.
 * 3. Identifies the earliest inspection date (firstInspectionDate) for each establishment.
 * 4. Determines newly opened restaurants (first health inspection within target period).
 * 5. Cleans and formats name, address, latitude, longitude, and phone.
 * 6. Authenticates with Green Oil Worker API and synchronizes/upserts newly opened restaurants.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

/**
 * Lightweight .env file loader (zero external dependencies)
 */
export function loadEnv(customPath = null) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    customPath,
    path.resolve(process.cwd(), '.env'),
    path.resolve(currentDir, '../.env')
  ].filter(Boolean);

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
        return envPath;
      } catch (e) {
        // silently fallback
      }
    }
  }
  return null;
}

// Automatically load local .env on startup if present
const loadedEnvFile = loadEnv();
if (loadedEnvFile) {
  console.log(`[DineSafe] Loaded environment variables from ${loadedEnvFile}`);
}

const CKAN_PACKAGE_URL = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=dinesafe";
const DEFAULT_WORKER_URL = process.env.WORKER_URL || "https://greenoil-api.ydxhjw4j5w.workers.dev";

/**
 * Dynamically discover latest CSV download URL from City of Toronto CKAN API
 */
export async function getLatestDinesafeCsvUrl() {
  console.log(`[DineSafe] Fetching dataset metadata from Toronto Open Data CKAN API...`);
  const resp = await fetch(CKAN_PACKAGE_URL);
  if (!resp.ok) {
    throw new Error(`CKAN API request failed with status ${resp.status}`);
  }
  const json = await resp.json();
  if (!json.success || !json.result?.resources) {
    throw new Error("Invalid response from Toronto Open Data CKAN API");
  }

  const resources = json.result.resources;
  // Look for resource with format CSV and name matching Dinesafe
  const csvResource = resources.find(r => 
    r.format?.toUpperCase() === 'CSV' && 
    (r.name?.toLowerCase().includes('dinesafe') || r.url?.toLowerCase().endsWith('.csv'))
  );

  if (!csvResource || !csvResource.url) {
    throw new Error("Could not find Dinesafe CSV resource in CKAN response");
  }

  console.log(`[DineSafe] Found latest CSV resource: "${csvResource.name}" -> ${csvResource.url}`);
  return csvResource.url;
}

/**
 * Parse CSV line handling quoted commas and escapes
 */
function parseCsvLine(text) {
  const values = [];
  let inQuotes = false;
  let currentValue = "";
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = "";
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue);
  return values;
}

import {
  cleanAddress,
  parseAddress,
  normalizeAddressKey,
  normalizeNameKey,
  isSimilarBusinessName,
  isSameOrSimilarName,
  clusterEstablishments,
  filterNewlyOpened,
  uploadToBackend
} from './sync_utils.mjs';

export {
  cleanAddress,
  parseAddress,
  normalizeAddressKey,
  normalizeNameKey,
  isSimilarBusinessName,
  isSameOrSimilarName,
  clusterEstablishments,
  filterNewlyOpened,
  uploadToBackend
};

/**
 * Process a readable stream of Dinesafe CSV and aggregate establishments
 * Excludes relicensed old stores by clustering records at the same address by brand similarity
 */
export async function processDinesafeStream(inputStream) {
  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity
  });

  let headers = null;
  let headerIndex = {};
  let totalRows = 0;
  const rawItems = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    totalRows++;

    if (!headers) {
      headers = parseCsvLine(line).map(h => h.trim());
      headers.forEach((h, idx) => { headerIndex[h] = idx; });
      continue;
    }

    const row = parseCsvLine(line);
    const estId = row[headerIndex['estId']] || row[headerIndex['oldEstId']];
    const estName = (row[headerIndex['estName']] || '').trim();
    const address = row[headerIndex['address']];
    const inspectionDate = (row[headerIndex['inspectionDate']] || '').trim();
    const latStr = row[headerIndex['latitude']] || '';
    const lngStr = row[headerIndex['longitude']] || '';
    const phone = (row[headerIndex['phone']] || '').trim();
    const status = (row[headerIndex['inspectionStatus']] || 'Pass').trim();

    if (!estName) continue;

    rawItems.push({
      id: estId,
      name: estName,
      address,
      inspectionDate,
      latitude: latStr ? parseFloat(latStr) : null,
      longitude: lngStr ? parseFloat(lngStr) : null,
      phone,
      status
    });
  }

  const { results, relicensedMerged } = clusterEstablishments(rawItems);
  console.log(`[DineSafe] Parsed ${totalRows} inspection records into ${results.length} unique establishments (merged ${relicensedMerged} relicensed ID transitions).`);
  return results;
}

/**
 * CLI Main Runner
 */
async function main() {
  const args = process.argv.slice(2);
  let localFile = null;
  let maxDays = 90;
  let workerUrl = process.env.WORKER_URL || DEFAULT_WORKER_URL;
  let username = process.env.WORKER_USERNAME || null;
  let password = process.env.WORKER_PASSWORD || null;
  let token = process.env.WORKER_TOKEN || null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) localFile = args[++i];
    else if (args[i] === '--days' && args[i + 1]) maxDays = parseInt(args[++i], 10);
    else if (args[i] === '--env' && args[i + 1]) loadEnv(args[++i]);
    else if (args[i] === '--worker-url' && args[i + 1]) workerUrl = args[++i];
    else if (args[i] === '--username' && args[i + 1]) username = args[++i];
    else if (args[i] === '--password' && args[i + 1]) password = args[++i];
    else if (args[i] === '--token' && args[i + 1]) token = args[++i];
    else if (args[i] === '--dry-run') dryRun = true;
  }

  workerUrl = workerUrl || process.env.WORKER_URL || DEFAULT_WORKER_URL;
  username = username || process.env.WORKER_USERNAME || null;
  password = password || process.env.WORKER_PASSWORD || null;
  token = token || process.env.WORKER_TOKEN || null;

  let inputStream;
  if (localFile && fs.existsSync(localFile)) {
    console.log(`[DineSafe] Reading local CSV file: ${localFile}`);
    inputStream = fs.createReadStream(localFile);
  } else {
    const csvUrl = await getLatestDinesafeCsvUrl();
    console.log(`[DineSafe] Streaming download from ${csvUrl}...`);
    const resp = await fetch(csvUrl);
    if (!resp.ok) throw new Error(`Download failed with status ${resp.status}`);
    inputStream = Readable.fromWeb(resp.body);
  }

  const allEstablishments = await processDinesafeStream(inputStream);
  const { newlyOpened, referenceDateStr } = filterNewlyOpened(allEstablishments, maxDays);

  // Statistics for 1 day, 7 days, 30 days
  const refDate = new Date(referenceDateStr + "T00:00:00Z");
  const count1d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + "T00:00:00Z")) <= 1 * 86400000).length;
  const count7d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + "T00:00:00Z")) <= 7 * 86400000).length;
  const count30d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + "T00:00:00Z")) <= 30 * 86400000).length;

  console.log(`\n========================================`);
  console.log(`  DineSafe Data Processing Summary`);
  console.log(`========================================`);
  console.log(`Reference Date:           ${referenceDateStr}`);
  console.log(`Newly Opened (1 Day):     ${count1d} restaurants`);
  console.log(`Newly Opened (7 Days):    ${count7d} restaurants`);
  console.log(`Newly Opened (30 Days):   ${count30d} restaurants`);
  console.log(`Total In Target Window:   ${newlyOpened.length} restaurants (past ${maxDays} days)`);
  console.log(`========================================\n`);

  if (dryRun) {
    console.log(`[DineSafe] Dry run completed. Skipping backend upload.`);
    return;
  }

  // Upload to backend
  try {
    await uploadToBackend(newlyOpened, { workerUrl, username, password, token });
  } catch (err) {
    console.error(`[DineSafe] Upload to backend failed:`, err.message);
    process.exit(1);
  }
}

// Run CLI if invoked directly - defaults to unified multi-region sync (Toronto + Markham)
if (import.meta.url === `file://${process.argv[1]}`) {
  import('./sync_restaurants.mjs').then(m => m.main()).catch(err => {
    console.error("[Sync] Fatal Error:", err);
    process.exit(1);
  });
}
