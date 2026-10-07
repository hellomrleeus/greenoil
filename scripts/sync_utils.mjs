/**
 * Shared synchronization, normalization, deduplication, and backend upload utilities
 * Used across both Toronto (DineSafe) and York Region / Markham (YorkSafe) pipelines.
 */

import fs from 'node:fs';
import path from 'node:path';
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

export const DINING_STOP_WORDS = new Set([
  'restaurant', 'restaurants', 'cafe', 'coffee', 'kitchen', 'express',
  'cuisine', 'bar', 'grill', 'bakery', 'food', 'foods', 'inc', 'ltd', 'corp', 'co', 'the'
]);

/**
 * Clean restaurant address
 */
export function cleanAddress(raw) {
  if (!raw) return "";
  let addr = raw.replace(/\s+None\s+/g, ' ');
  addr = addr.replace(/\s+/g, ' ').trim();
  return addr;
}

/**
 * Comprehensive address parser:
 * Separates base street address (number, street name, road type, direction) from unit/suite number.
 * Handles:
 * - Prefix units: "1046L - 5000 Highway 7"
 * - Unit keywords: "Unit 5", "Unit-120", "Suite 300", "Ste 4", "Apt 2"
 * - Trailing unit numbers: "2901 Markham Rd 5", "100 Marmora St 200", "65 Front St W 442"
 * - Protects route numbers like "Highway 7" / "Hwy 48"
 * - Strips Canadian postal codes, city/province, and "None"
 */
export function parseAddress(raw) {
  if (!raw) return { base: "", unit: "" };
  let s = raw.toLowerCase().trim();

  // Strip Canadian postal codes (e.g. M1X 0B6, L3R 4M9)
  s = s.replace(/\b[a-z]\d[a-z]\s*\d[a-z]\d\b/gi, " ");
  // Strip "None" (frequent in Toronto DineSafe when unit is blank)
  s = s.replace(/\bnone\b/gi, " ");

  // Strip city / community / province names only when preceded by comma or followed by province
  // (Prevents stripping street names like "Markham Rd" or "Toronto St")
  s = s.replace(/,\s*(?:markham|toronto|richmond hill|vaughan|scarborough|mississauga|unionville|thornhill|woodbridge|maple|concord)\b/gi, " ");
  s = s.replace(/\b(?:markham|toronto|richmond hill|vaughan|scarborough|mississauga|unionville|thornhill|woodbridge|maple|concord)\s*,\s*(?:on|ontario)\b/gi, " ");
  s = s.replace(/\b(?:on|ontario)\b/gi, " ");

  // Handle prefix unit: "1046L - 5000 Highway 7" or "Unit 12 - 5000 Highway 7"
  let unit = "";
  const prefixUnitRegex = /^([a-z0-9\-]+)\s*-\s*(\d+\s+[a-z].*)$/i;
  const mPrefix = s.match(prefixUnitRegex);
  if (mPrefix) {
    unit = mPrefix[1].replace(/^(?:unit|suite|ste|apt)\s*/i, "");
    s = mPrefix[2];
  }

  // Standardize road types
  s = s.replace(/\bavenue\b/g, "ave")
       .replace(/\bstreet\b/g, "st")
       .replace(/\broad\b/g, "rd")
       .replace(/\bboulevard\b/g, "blvd")
       .replace(/\bdrive\b/g, "dr")
       .replace(/\bcourt\b/g, "crt")
       .replace(/\bcircle\b/g, "cir")
       .replace(/\bplace\b/g, "pl")
       .replace(/\bterrace\b/g, "terr")
       .replace(/\bexpressway\b/g, "exp")
       .replace(/\bparkway\b/g, "pkwy")
       .replace(/\bsquare\b/g, "sq")
       .replace(/\blane\b/g, "ln")
       .replace(/\bhighway\b/g, "hwy")
       .replace(/\bway\b/g, "way")
       .replace(/\bcrescent\b/g, "cres");

  // Standardize compass directions
  s = s.replace(/\beast\b/g, "e")
       .replace(/\bwest\b/g, "w")
       .replace(/\bnorth\b/g, "n")
       .replace(/\bsouth\b/g, "s");

  s = s.replace(/[,#]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Extract unit if not already captured from prefix
  if (!unit) {
    const unitPrefixRegex = /\b(?:unit|suite|ste|apt|apartment|bldg|building)\b[\s\-:]*([a-z0-9\-]+)/i;
    const unitMatch = s.match(unitPrefixRegex);
    if (unitMatch) {
      unit = unitMatch[1];
      s = s.replace(unitMatch[0], " ");
    } else {
      // Exclude "hwy" from trailing unit match because "hwy 7" is a highway route number
      const trailingUnitRegex = /\b(ave|st|rd|blvd|dr|crt|cir|pl|terr|exp|pkwy|sq|ln|way|cres)(?:\s+([ewns]))\s+([0-9]+[a-z0-9\-]*)$/i;
      const trailingUnitNoDirRegex = /\b(ave|st|rd|blvd|dr|crt|cir|pl|terr|exp|pkwy|sq|ln|way|cres)\s+([0-9]+[a-z0-9\-]*)$/i;

      let m = s.match(trailingUnitRegex);
      if (m) {
        unit = m[3];
        s = s.slice(0, m.index) + m[1] + " " + m[2];
      } else if ((m = s.match(trailingUnitNoDirRegex))) {
        unit = m[2];
        s = s.slice(0, m.index) + m[1];
      }
    }
  }

  s = s.replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  unit = unit.replace(/[^a-z0-9]/g, "").trim();

  return { base: s, unit };
}

/**
 * Standardize address key for spatial/premises deduplication.
 * Returns base street address so premises grouping works across unit format differences.
 */
export function normalizeAddressKey(raw) {
  if (!raw) return '';
  const { base } = parseAddress(raw);
  if (base) return base;
  let s = raw.toLowerCase().replace(/\bnone\b/g, ' ').replace(/[^a-z0-9]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize restaurant name for matching brand identity
 */
export function normalizeNameKey(raw) {
  if (!raw) return '';
  let s = raw.toLowerCase();
  s = s.replace(/&/g, ' and ');
  s = s.replace(/[^a-z0-9]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Check if two names represent the same establishment/brand:
 * 1. Exact normalized name match: always true.
 * 2. Substring brand match: "Bulakenyos" vs "Bulakenyos Filipino Cuisine".
 * 3. Significant word overlap excluding generic dining stopwords (e.g. "restaurant", "cafe").
 */
export function isSimilarBusinessName(n1, n2) {
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  const words1 = n1.split(' ').filter(w => w.length > 1);
  const words2 = n2.split(' ').filter(w => w.length > 1);

  const sig1 = new Set(words1.filter(w => !DINING_STOP_WORDS.has(w)));
  const sig2 = new Set(words2.filter(w => !DINING_STOP_WORDS.has(w)));

  if (sig1.size === 0 || sig2.size === 0) {
    const all1 = new Set(words1);
    const all2 = new Set(words2);
    let common = 0;
    for (const w of all1) if (all2.has(w)) common++;
    return common === Math.min(all1.size, all2.size);
  }

  let commonSig = 0;
  for (const w of sig1) {
    if (sig2.has(w)) commonSig++;
  }

  const minSigLen = Math.min(sig1.size, sig2.size);
  return minSigLen > 0 && (commonSig / minSigLen >= 0.5);
}

export const isSameOrSimilarName = isSimilarBusinessName;

/**
 * Cluster and deduplicate raw inspection items:
 * "店名一样，地址一样，肯定就是同一家店"
 * 
 * Grouping & Matching Rules:
 * 1. Base address grouping: normalizes street address so "2901 Markham Rd 5" and "2901 Markham Rd None"
 *    are grouped together at the physical premises.
 * 2. Within the same base address:
 *    - Same name (n1 === n2): DEFINITELY the same restaurant (merges across unit/None variations).
 *    - Same official establishment ID: DEFINITELY the same restaurant.
 *    - Similar brand name: merged if unit is unspecified or matching.
 * 3. Tracks true historical earliest inspection date (firstInspectionDate) so relicensed or re-inspected
 *    existing restaurants are not falsely marked as newly opened.
 */
export function clusterEstablishments(rawItems) {
  const baseAddrMap = new Map();
  for (const item of rawItems) {
    const rawName = item.name || item.estName || '';
    if (!rawName) continue;
    const rawAddr = item.address || '';
    const { base: baseAddr, unit } = parseAddress(rawAddr);
    const groupKey = baseAddr || cleanAddress(rawAddr).toLowerCase();
    const nameNorm = normalizeNameKey(rawName);

    if (!baseAddrMap.has(groupKey)) {
      baseAddrMap.set(groupKey, []);
    }
    baseAddrMap.get(groupKey).push({
      ...item,
      rawName,
      nameNorm,
      rawAddress: rawAddr,
      baseAddr,
      unit,
      address: cleanAddress(rawAddr)
    });
  }

  const results = [];
  let relicensedMerged = 0;

  for (const [groupKey, items] of baseAddrMap.entries()) {
    const clusters = [];
    for (const item of items) {
      let matchedCluster = null;
      for (const cl of clusters) {
        // Same restaurant determination:
        // 1. Same official license/estId
        // 2. Exact same normalized name at this address ("店名一样，地址一样，肯定是同一家店")
        // 3. Similar brand name at same address with matching/omitted unit
        const isOfficialIdMatch = Boolean(item.id && cl.ids.has(item.id));
        const isNameIdentical = (cl.nameNorm === item.nameNorm);
        const isNameSimilar = isSimilarBusinessName(cl.nameNorm, item.nameNorm);

        if (isOfficialIdMatch || isNameIdentical || (isNameSimilar && (!cl.unit || !item.unit || cl.unit === item.unit))) {
          matchedCluster = cl;
          break;
        }
      }

      const itemDates = Array.isArray(item.dates) 
        ? item.dates.slice() 
        : (item.inspectionDate || item.date ? [item.inspectionDate || item.date] : []);
      const count = item.inspectionCount || (itemDates.length > 0 ? itemDates.length : 1);

      if (matchedCluster) {
        for (const d of itemDates) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
            matchedCluster.dates.push(d);
          }
        }
        matchedCluster.inspectionCount += count;
        if (item.id) matchedCluster.ids.add(item.id);
        if (!matchedCluster.unit && item.unit) matchedCluster.unit = item.unit;

        const maxItemDate = itemDates.slice().sort().pop() || item.latestInspectionDate || '';
        if (!matchedCluster.latestDate || (maxItemDate && maxItemDate > matchedCluster.latestDate)) {
          matchedCluster.latestDate = maxItemDate;
          matchedCluster.id = item.id || matchedCluster.id;
          matchedCluster.name = item.rawName;
          matchedCluster.address = item.address;
          matchedCluster.status = item.status || matchedCluster.status;
          if (item.latitude != null && item.longitude != null) {
            matchedCluster.latitude = item.latitude;
            matchedCluster.longitude = item.longitude;
          }
          if (item.phone) matchedCluster.phone = item.phone;
        }
      } else {
        const cl = {
          id: item.id || `${item.rawName}|${item.address}`,
          name: item.rawName,
          nameNorm: item.nameNorm,
          unit: item.unit,
          address: item.address,
          latitude: item.latitude != null ? item.latitude : null,
          longitude: item.longitude != null ? item.longitude : null,
          phone: item.phone || '',
          status: item.status || 'Pass',
          dates: [],
          latestDate: '',
          inspectionCount: count,
          ids: new Set(item.id ? [item.id] : [])
        };
        for (const d of itemDates) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
            cl.dates.push(d);
          }
        }
        const maxItemDate = itemDates.slice().sort().pop() || item.latestInspectionDate || '';
        cl.latestDate = maxItemDate;
        clusters.push(cl);
      }
    }

    const uniqueIdsAtAddr = new Set(items.map(i => i.id).filter(Boolean));
    if (uniqueIdsAtAddr.size > clusters.length) {
      relicensedMerged += (uniqueIdsAtAddr.size - clusters.length);
    }

    for (const cl of clusters) {
      if (cl.dates.length === 0) continue;
      cl.dates.sort();
      const firstInspectionDate = cl.dates[0];
      const latestInspectionDate = cl.dates[cl.dates.length - 1];

      results.push({
        id: cl.id,
        name: cl.name,
        address: cl.address,
        estimatedOpeningDate: firstInspectionDate,
        firstInspectionDate: firstInspectionDate,
        latestInspectionDate: latestInspectionDate,
        latitude: Number.isFinite(cl.latitude) ? cl.latitude : null,
        longitude: Number.isFinite(cl.longitude) ? cl.longitude : null,
        phone: cl.phone,
        inspectionCount: cl.inspectionCount,
        status: cl.status
      });
    }
  }

  return { results, relicensedMerged };
}

/**
 * Filter newly opened restaurants within a given maximum day window (e.g. 90 or 180 days)
 */
export function filterNewlyOpened(establishments, maxDays = 90, referenceDateStr = null) {
  if (!referenceDateStr) {
    let maxDate = '';
    for (const est of establishments) {
      if (est.latestInspectionDate > maxDate) maxDate = est.latestInspectionDate;
    }
    const today = new Date().toISOString().slice(0, 10);
    referenceDateStr = maxDate && maxDate > today ? maxDate : today;
  }

  const refDate = new Date(referenceDateStr + "T00:00:00Z");
  const cutoffDate = new Date(refDate.getTime() - maxDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const newlyOpened = establishments.filter(est => {
    return est.firstInspectionDate >= cutoffDate && est.firstInspectionDate <= referenceDateStr;
  });

  newlyOpened.sort((a, b) => b.firstInspectionDate.localeCompare(a.firstInspectionDate));
  return { newlyOpened, referenceDateStr, cutoffDate };
}

const DEFAULT_WORKER_URL = "https://greenoil-api.ydxhjw4j5w.workers.dev";

/**
 * Upload restaurants to Green Oil Worker backend
 */
export async function uploadToBackend(restaurants, options = {}) {
  const workerUrl = options.workerUrl || process.env.WORKER_URL || DEFAULT_WORKER_URL;
  let token = options.token || process.env.WORKER_TOKEN;

  if (!token) {
    const username = options.username || process.env.WORKER_USERNAME;
    const password = options.password || process.env.WORKER_PASSWORD;

    if (!username || !password) {
      throw new Error(
        "Missing backend credentials. Please configure WORKER_TOKEN or WORKER_USERNAME and WORKER_PASSWORD in .env, or via CLI flags."
      );
    }

    console.log(`[Upload] Authenticating with Green Oil backend at ${workerUrl}...`);
    const loginResp = await fetch(`${workerUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!loginResp.ok) {
      throw new Error(`Authentication failed with HTTP ${loginResp.status}: ${await loginResp.text()}`);
    }

    const loginData = await loginResp.json();
    token = loginData.token;
    if (!token) throw new Error("Authentication response did not contain token");
    console.log(`[Upload] Successfully authenticated as "${username}".`);
  } else {
    console.log(`[Upload] Authenticating with Green Oil backend using session token...`);
  }

  // Batch upload in chunks of 100
  const BATCH_SIZE = 100;
  let totalUploaded = 0;
  const shouldReplace = options.replace !== false;

  for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
    const chunk = restaurants.slice(i, i + BATCH_SIZE);
    const resp = await fetch(`${workerUrl}/api/new-restaurants/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        restaurants: chunk,
        replace: i === 0 ? shouldReplace : false
      })
    });

    if (!resp.ok) {
      console.error(`[Upload] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: HTTP ${resp.status} - ${await resp.text()}`);
    } else {
      totalUploaded += chunk.length;
      console.log(`[Upload] Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1} (${totalUploaded}/${restaurants.length} restaurants)`);
    }
  }

  console.log(`[Upload] Successfully synced ${totalUploaded} restaurants to backend.`);
  return { totalUploaded };
}
