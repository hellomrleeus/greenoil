#!/usr/bin/env node
/**
 * York Region Public Health (YorkSafe) - Newly Opened Restaurants Ingestion
 * 
 * Official Public Health Inspection System for York Region (Markham, Richmond Hill, Vaughan, etc.)
 * 
 * 1. Discovers Visualforce remoting credentials dynamically from YorkSafe portal.
 * 2. Fetches active Food Establishments for the specified municipality (default: Markham).
 * 3. Retrieves full inspection histories in concurrent RPC batches.
 * 4. Applies identical address normalization, name keying, and brand similarity clustering
 *    to exclude relicensed older stores.
 * 5. Identifies newly opened restaurants (first inspection within target window).
 * 6. Supports local caching for optimal performance.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadEnv,
  cleanAddress,
  normalizeAddressKey,
  normalizeNameKey,
  clusterEstablishments,
  filterNewlyOpened,
  uploadToBackend
} from './sync_utils.mjs';

const YORKSAFE_PORTAL_URL = 'https://york.my.salesforce-sites.com/YorkSafe/';
const YORKSAFE_RPC_URL = 'https://york.my.salesforce-sites.com/YorkSafe/apexremote';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CACHE_PATH = path.resolve(__dirname, 'output/yorksafe_cache.json');

/**
 * Dynamically extract Visualforce Remoting configuration from YorkSafe portal HTML
 */
export async function getYorkSafeConfig() {
  console.log(`[YorkSafe] Connecting to portal at ${YORKSAFE_PORTAL_URL}...`);
  const resp = await fetch(YORKSAFE_PORTAL_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  if (!resp.ok) {
    throw new Error(`Failed to load YorkSafe portal: HTTP ${resp.status}`);
  }

  const html = await resp.text();
  const startMarker = 'RemotingProviderImpl(';
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error('Could not find RemotingProviderImpl in YorkSafe portal response');
  }

  const jsonStart = startIdx + startMarker.length;
  const endIdx = html.indexOf('));', jsonStart);
  if (endIdx === -1) {
    throw new Error('Could not locate end of RemotingProviderImpl configuration');
  }

  const config = JSON.parse(html.substring(jsonStart, endIdx));
  const qfAction = config.actions?.CHIPS_YSPortalController?.ms?.find(m => m.name === 'QueryFacilities');
  const qiAction = config.actions?.CHIPS_YSPortalController?.ms?.find(m => m.name === 'QueryInspections');

  if (!qfAction || !qiAction) {
    throw new Error('Required actions (QueryFacilities / QueryInspections) not found in YorkSafe config');
  }

  return {
    vid: config.vf.vid,
    qfAction,
    qiAction
  };
}

/**
 * Fetch facilities for a municipality from YorkSafe
 */
export async function fetchYorkSafeFacilities(config, municipality = 'Markham', category = 'Food Establishment') {
  console.log(`[YorkSafe] Querying facilities for municipality="${municipality}", category="${category}"...`);

  const payload = {
    action: 'CHIPS_YSPortalController',
    method: 'QueryFacilities',
    data: [['', municipality, category, 'All', 'All']],
    type: 'rpc',
    tid: 1,
    ctx: {
      csrf: config.qfAction.csrf,
      vid: config.vid,
      ns: '',
      ver: 47,
      authorization: config.qfAction.authorization
    }
  };

  const resp = await fetch(YORKSAFE_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': YORKSAFE_PORTAL_URL,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    throw new Error(`YorkSafe QueryFacilities RPC failed with status ${resp.status}`);
  }

  const json = await resp.json();
  const resultStr = json[0]?.result;
  if (!resultStr || resultStr === 'zero') {
    return [];
  }

  const facilities = JSON.parse(resultStr);
  console.log(`[YorkSafe] Retrieved ${facilities.length} ${category} facilities in ${municipality}.`);
  return facilities;
}

/**
 * Fetch inspection histories for facilities in parallel batches with caching
 */
export async function fetchYorkSafeInspections(config, facilities, options = {}) {
  const batchSize = options.batchSize || 30;
  const concurrency = options.concurrency || 4;
  const cachePath = options.cachePath || DEFAULT_CACHE_PATH;
  const forceRefresh = !!options.forceRefresh;

  // Load existing cache if available
  let cache = {};
  if (!forceRefresh && fs.existsSync(cachePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      console.log(`[YorkSafe] Loaded inspection cache from ${cachePath} (${Object.keys(cache).length} entries)`);
    } catch (e) {
      cache = {};
    }
  }

  // Identify facilities that need fetching
  const pendingFacilities = [];
  const inspectionResults = [];

  for (const fac of facilities) {
    const fid = fac.FID;
    if (cache[fid] && !forceRefresh) {
      inspectionResults.push({
        id: `york_${fac.FID}`,
        facilityId: fac.FID,
        name: fac.FN,
        address: fac.FSA,
        latitude: fac.FLA ? parseFloat(fac.FLA) : null,
        longitude: fac.FLO ? parseFloat(fac.FLO) : null,
        phone: fac.FP || '',
        dates: cache[fid].dates || [],
        inspectionCount: cache[fid].dates?.length || 1,
        status: cache[fid].status || 'Pass'
      });
    } else {
      pendingFacilities.push(fac);
    }
  }

  if (pendingFacilities.length > 0) {
    console.log(`[YorkSafe] Fetching inspections for ${pendingFacilities.length} facilities in parallel batches...`);

    const batches = [];
    for (let i = 0; i < pendingFacilities.length; i += batchSize) {
      batches.push({ index: i, slice: pendingFacilities.slice(i, i + batchSize) });
    }

    let completedBatches = 0;

    async function processBatch(batch) {
      const payload = batch.slice.map((f, idx) => ({
        action: 'CHIPS_YSPortalController',
        method: 'QueryInspections',
        data: [f.FID],
        type: 'rpc',
        tid: batch.index + idx,
        ctx: {
          csrf: config.qiAction.csrf,
          vid: config.vid,
          ns: '',
          ver: 47,
          authorization: config.qiAction.authorization
        }
      }));

      try {
        const resp = await fetch(YORKSAFE_RPC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Referer': YORKSAFE_PORTAL_URL,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
          },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          throw new Error(`RPC batch failed: HTTP ${resp.status}`);
        }

        const rBatch = await resp.json();
        rBatch.forEach((item, idx) => {
          const fac = batch.slice[idx];
          const dates = [];
          let latestStatus = 'Pass';

          if (item.result && item.result !== 'zero') {
            try {
              const insps = JSON.parse(item.result);
              for (const ins of insps) {
                const m = ins.T?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (m) {
                  const iso = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
                  dates.push(iso);
                }
                if (ins.AT && /close|closure/i.test(ins.AT)) {
                  latestStatus = 'Closed';
                }
              }
            } catch (e) {}
          }

          dates.sort();

          // Update memory cache
          cache[fac.FID] = {
            name: fac.FN,
            address: fac.FSA,
            dates,
            status: latestStatus,
            cachedAt: new Date().toISOString()
          };

          if (dates.length > 0) {
            inspectionResults.push({
              id: `york_${fac.FID}`,
              facilityId: fac.FID,
              name: fac.FN,
              address: fac.FSA,
              latitude: fac.FLA ? parseFloat(fac.FLA) : null,
              longitude: fac.FLO ? parseFloat(fac.FLO) : null,
              phone: fac.FP || '',
              dates,
              inspectionCount: dates.length,
              status: latestStatus
            });
          }
        });
      } catch (err) {
        console.error(`[YorkSafe] Batch ${batch.index} failed:`, err.message);
      } finally {
        completedBatches++;
        if (completedBatches % 10 === 0 || completedBatches === batches.length) {
          console.log(`[YorkSafe] Progress: ${completedBatches}/${batches.length} batches completed...`);
        }
      }
    }

    let queueIdx = 0;
    async function worker() {
      while (queueIdx < batches.length) {
        const current = batches[queueIdx++];
        await processBatch(current);
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    // Save updated cache to disk
    try {
      const cacheDir = path.dirname(cachePath);
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
      console.log(`[YorkSafe] Saved updated cache to ${cachePath}`);
    } catch (err) {
      console.warn(`[YorkSafe] Failed to write cache:`, err.message);
    }
  }

  return inspectionResults;
}

const ARCGIS_BIZ_URL = 'https://services1.arcgis.com/GzvOwaQBbX7KLiuG/ArcGIS/rest/services/Business_Directory_2024/FeatureServer/1/query';

function isStrictBrandMatch(n1, n2) {
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  const filterWords = (str) => str.split(' ').filter(w => w.length > 2 && !['and', 'the', 'restaurant', 'cuisine', 'cafe', 'bar', 'grill', 'food', 'ltd', 'inc'].includes(w));
  const words1 = filterWords(n1);
  const words2 = filterWords(n2);
  if (words1.length === 0 || words2.length === 0) return false;
  let common = 0;
  for (const w of words1) if (words2.includes(w)) common++;
  const minL = Math.min(words1.length, words2.length);
  return common / minL >= 0.6;
}

/**
 * Cross-reference York Region's official ArcGIS Business Directory to eliminate relicensed old stores.
 * If a restaurant matches address and brand with an opening year prior to 2025, its opening date
 * is linked to its historical opening date, removing it from newly opened candidates.
 */
export async function enrichWithArcGisHistory(establishments, municipality = 'Markham', options = {}) {
  const cachePath = path.resolve(__dirname, `output/arcgis_businesses_${municipality.toLowerCase().replace(/\s+/g, '_')}.json`);
  let features = [];

  if (!options.forceRefresh && fs.existsSync(cachePath)) {
    try {
      features = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      console.log(`[YorkSafe] Loaded ${features.length} ArcGIS historical businesses from cache.`);
    } catch (e) {
      features = [];
    }
  }

  if (features.length === 0) {
    try {
      console.log(`[YorkSafe] Querying York Region Business Directory (ArcGIS) for historical establishments in ${municipality}...`);
      const where = `MUNICIPALITY='${municipality}' AND (PRIM_NAICS LIKE '722%' OR PRIM_NAICS LIKE '445%' OR PRIM_NAICS LIKE '311%')`;
      const url = `${ARCGIS_BIZ_URL}?where=${encodeURIComponent(where)}&outFields=NAME,FULL_ADDRESS,UNIT_NUM,YR_CURRENTLOC&f=json&resultRecordCount=2000`;
      const resp = await fetch(url);
      if (resp.ok) {
        const json = await resp.json();
        features = json.features || [];
        const cacheDir = path.dirname(cachePath);
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(cachePath, JSON.stringify(features, null, 2));
        console.log(`[YorkSafe] Cached ${features.length} ArcGIS historical businesses to ${cachePath}`);
      }
    } catch (err) {
      console.warn(`[YorkSafe] Warning: Failed to query ArcGIS business directory:`, err.message);
    }
  }

  if (features.length === 0) return establishments;

  const arcMap = new Map();
  const sortAddr = (str) => str.split(' ').filter(Boolean).sort().join(' ');

  for (const f of features) {
    const aKey = normalizeAddressKey(f.attributes.FULL_ADDRESS);
    const aKeySorted = sortAddr(aKey);
    const nKey = normalizeNameKey(f.attributes.NAME);
    const yr = f.attributes.YR_CURRENTLOC;
    const entry = { name: f.attributes.NAME, nKey, yr };

    if (!arcMap.has(aKey)) arcMap.set(aKey, []);
    arcMap.get(aKey).push(entry);

    if (aKeySorted !== aKey) {
      if (!arcMap.has(aKeySorted)) arcMap.set(aKeySorted, []);
      arcMap.get(aKeySorted).push(entry);
    }
  }

  let excludedCount = 0;
  for (const est of establishments) {
    const aKey = normalizeAddressKey(est.address);
    const aKeySorted = sortAddr(aKey);
    const nKey = normalizeNameKey(est.name);
    const candidates = [
      ...(arcMap.get(aKey) || []),
      ...(aKeySorted !== aKey ? (arcMap.get(aKeySorted) || []) : [])
    ];
    for (const cand of candidates) {
      if (cand.yr && cand.yr < 2025 && isStrictBrandMatch(nKey, cand.nKey)) {
        const historicalDate = `${cand.yr}-01-01`;
        est.firstInspectionDate = historicalDate;
        est.estimatedOpeningDate = historicalDate;
        excludedCount++;
        console.log(`[YorkSafe] Excluded relicensed old store: "${est.name}" -> Operating since ${cand.yr} per York Region Business Directory`);
        break;
      }
    }
  }

  console.log(`[YorkSafe] Identified ${excludedCount} historical establishments with pre-2025 opening years.`);
  return establishments;
}

/**
 * Execute York Region / Markham Ingestion Pipeline
 */
export async function processYorkSafePipeline(options = {}) {
  const municipality = options.municipality || 'Markham';
  const maxDays = options.days || 90;

  const config = await getYorkSafeConfig();
  const facilities = await fetchYorkSafeFacilities(config, municipality);

  if (facilities.length === 0) {
    console.log(`[YorkSafe] No facilities found for ${municipality}`);
    return { allEstablishments: [], newlyOpened: [] };
  }

  const rawInspections = await fetchYorkSafeInspections(config, facilities, options);

  // Apply shared clustering and deduplication logic
  const { results: allEstablishments, relicensedMerged } = clusterEstablishments(rawInspections);
  console.log(`[YorkSafe] Deduplicated into ${allEstablishments.length} establishments (merged ${relicensedMerged} relicensed ID transitions).`);

  // Cross-reference official York Region business directory to eliminate relicensed old stores
  await enrichWithArcGisHistory(allEstablishments, municipality, options);

  const { newlyOpened, referenceDateStr, cutoffDate } = filterNewlyOpened(allEstablishments, maxDays);
  return { allEstablishments, newlyOpened, referenceDateStr, cutoffDate, relicensedMerged };
}

/**
 * CLI Entry Point
 */
async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  let municipality = 'Markham';
  let maxDays = 90;
  let forceRefresh = false;
  let dryRun = false;
  let workerUrl = process.env.WORKER_URL;
  let username = process.env.WORKER_USERNAME;
  let password = process.env.WORKER_PASSWORD;
  let token = process.env.WORKER_TOKEN;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--municipality' && args[i + 1]) municipality = args[++i];
    else if (args[i] === '--days' && args[i + 1]) maxDays = parseInt(args[++i], 10);
    else if (args[i] === '--force-refresh') forceRefresh = true;
    else if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--worker-url' && args[i + 1]) workerUrl = args[++i];
    else if (args[i] === '--username' && args[i + 1]) username = args[++i];
    else if (args[i] === '--password' && args[i + 1]) password = args[++i];
    else if (args[i] === '--token' && args[i + 1]) token = args[++i];
  }

  const { newlyOpened, referenceDateStr } = await processYorkSafePipeline({
    municipality,
    days: maxDays,
    forceRefresh
  });

  const refDate = new Date(referenceDateStr + 'T00:00:00Z');
  const count1d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + 'T00:00:00Z')) <= 1 * 86400000).length;
  const count7d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + 'T00:00:00Z')) <= 7 * 86400000).length;
  const count30d = newlyOpened.filter(e => (refDate - new Date(e.firstInspectionDate + 'T00:00:00Z')) <= 30 * 86400000).length;

  console.log(`\n========================================`);
  console.log(`  YorkSafe (${municipality}) Processing Summary`);
  console.log(`========================================`);
  console.log(`Reference Date:           ${referenceDateStr}`);
  console.log(`Newly Opened (1 Day):     ${count1d} restaurants`);
  console.log(`Newly Opened (7 Days):    ${count7d} restaurants`);
  console.log(`Newly Opened (30 Days):   ${count30d} restaurants`);
  console.log(`Total In Target Window:   ${newlyOpened.length} restaurants (past ${maxDays} days)`);
  console.log(`========================================\n`);

  if (dryRun) {
    console.log(`[YorkSafe] Dry run completed. Skipping backend upload.`);
    return;
  }

  await uploadToBackend(newlyOpened, { workerUrl, username, password, token });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('[YorkSafe] Fatal Error:', err);
    process.exit(1);
  });
}
