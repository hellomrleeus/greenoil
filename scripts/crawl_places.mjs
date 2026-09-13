/**
 * Local Deep Crawler for Google Maps Places API (New)
 * 
 * Traverses GTA regions with 32+ individual fried food queries.
 * Handles pagination (nextPageToken) up to 2-3 pages per query.
 * Merges and deduplicates places into scripts/output/restaurants_full.json.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error("❌ Please provide GOOGLE_MAPS_API_KEY environment variable.");
  console.error("Usage: GOOGLE_MAPS_API_KEY=your_key node scripts/crawl_places.mjs");
  process.exit(1);
}

const GTA_REGIONS = {
  "万锦 (Markham)": { lat: 43.8561, lng: -79.3370, radius: 10000, name: "Markham" },
  "士嘉堡 (Scarborough)": { lat: 43.7764, lng: -79.2318, radius: 10000, name: "Scarborough" },
  "北约克 (North York)": { lat: 43.7615, lng: -79.4111, radius: 10000, name: "North York" },
  "列治文山 (Richmond Hill)": { lat: 43.8828, lng: -79.4403, radius: 9000, name: "Richmond Hill" },
  "多伦多市中心 (Downtown Toronto)": { lat: 43.6532, lng: -79.3832, radius: 8000, name: "Downtown Toronto" },
  "密西沙加 (Mississauga)": { lat: 43.5890, lng: -79.6441, radius: 12000, name: "Mississauga" },
  "旺市 (Vaughan)": { lat: 43.8563, lng: -79.5085, radius: 11000, name: "Vaughan" }
};

const KEYWORDS = [
  // 中式与台式炸物特色词
  "盐酥鸡",
  "炸串",
  "炸大肠",
  "油炸串串",
  "台式大鸡排",
  "小酥肉",
  "taiwanese fried chicken",
  // 西式炸鸡与翅类品牌
  "fried chicken",
  "chicken wings",
  "popeyes",
  "jollibee",
  "mary browns",
  "churchs texas chicken",
  "buffalo wild wings",
  "wild wing",
  // 韩式炸鸡与热狗
  "korean fried chicken",
  "bb.q chicken",
  "the fry",
  "chicken plus",
  "kokodak",
  "chimaek",
  "korean corn dog",
  "chungchun rice dog",
  // 炸鱼薯条
  "fish and chips",
  "halibut and chips",
  // 日式炸物
  "tonkatsu",
  "katsu",
  "tempura",
  "天妇罗",
  "日式炸猪排",
  // 美式热辣/小吃
  "nashville hot chicken",
  "churros"
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function classifyFriedCategories(name, primaryType, matchedTerm = "") {
  const text = (name + " " + primaryType + " " + matchedTerm).toLowerCase();
  const cats = [];
  if (/korean|chicken plus|the fry|bb\.q|kokodak|chimaek|韩国|韩式/i.test(text)) {
    cats.push("韩式炸鸡 (Korean Fried Chicken)");
  }
  if (/wings|wing|popeyes|church|kfc|mary brown|fried chicken|buffalo|nashville|炸鸡|鸡翅/i.test(text)) {
    cats.push("西式炸鸡/快餐/炸鸡翅 (Western Fried Chicken & Wings)");
  }
  if (/fish and chips|halibut|cod|chips|炸鱼/i.test(text)) {
    cats.push("炸鱼薯条 (Fish & Chips)");
  }
  if (/katsu|tonkatsu|tempura|天妇罗|炸猪排|日式/i.test(text)) {
    cats.push("日式炸物/炸猪排/天妇罗 (Japanese Katsu & Tempura)");
  }
  if (/corn dog|hotdog|churro|churros|donut|rice dog|热狗|吉事果/i.test(text)) {
    cats.push("热狗棒/吉事果/甜甜圈 (Corn Dogs, Churros & Sweets)");
  }
  if (/taiwan|salt and pepper|炸大肠|炸串|串串|盐酥鸡|大鸡排|中餐|chinese|小酥肉/i.test(text)) {
    cats.push("中式/台式炸物小吃 (Chinese & Taiwanese Fried Snacks)");
  }
  if (cats.length === 0) {
    cats.push("西式炸鸡/快餐/炸鸡翅 (Western Fried Chicken & Wings)");
  }
  return cats;
}

function deriveKeywords(name, primaryType, matchedTerm = "") {
  const text = (name + " " + primaryType + " " + matchedTerm).toLowerCase();
  const kws = [];

  const candidates = [
    { regex: /天妇罗/, kw: "天妇罗" },
    { regex: /tempura/i, kw: "tempura" },
    { regex: /盐酥鸡/, kw: "盐酥鸡" },
    { regex: /taiwanese fried chicken/i, kw: "taiwanese fried chicken" },
    { regex: /炸大肠/, kw: "炸大肠" },
    { regex: /炸串/, kw: "炸串" },
    { regex: /油炸串串/, kw: "油炸串串" },
    { regex: /小酥肉/, kw: "小酥肉" },
    { regex: /日式炸猪排/, kw: "日式炸猪排" },
    { regex: /台式大鸡排/, kw: "台式大鸡排" },
    { regex: /korean fried chicken|chimaek/i, kw: "korean fried chicken" },
    { regex: /korean corn dog|rice dog/i, kw: "korean corn dog" },
    { regex: /nashville hot chicken/i, kw: "nashville hot chicken" },
    { regex: /halibut and chips/i, kw: "halibut and chips" },
    { regex: /fish and chips/i, kw: "fish and chips" },
    { regex: /chicken wings|wings/i, kw: "chicken wings" },
    { regex: /fried chicken/i, kw: "fried chicken" },
    { regex: /tonkatsu/i, kw: "tonkatsu" },
    { regex: /katsu/i, kw: "katsu" },
    { regex: /churros|churro/i, kw: "churros" },
    { regex: /popeyes/i, kw: "popeyes" },
    { regex: /bb\.q chicken|bbq chicken/i, kw: "bb.q chicken" },
    { regex: /the fry/i, kw: "the fry" },
    { regex: /kokodak/i, kw: "kokodak" },
    { regex: /jollibee/i, kw: "jollibee" },
    { regex: /church\'?s/i, kw: "church's texas chicken" },
    { regex: /mary brown/i, kw: "mary brown's" },
    { regex: /wild wing|buffalo wild/i, kw: "buffalo wild wings" },
    { regex: /chicken plus/i, kw: "chicken plus" },
    { regex: /chungchun/i, kw: "chungchun rice dog" }
  ];

  for (const { regex, kw } of candidates) {
    if (regex.test(text) && !kws.includes(kw)) {
      kws.push(kw);
    }
  }

  if (kws.length === 0) {
    kws.push(matchedTerm || "fried food");
  }

  return kws;
}

function transformGooglePlace(p, regionName, matchedTerm = "") {
  const name = p.displayName?.text || "未命名餐馆";
  const address = p.formattedAddress || "";
  const phone = p.nationalPhoneNumber || "无";
  const website = p.websiteUri || "";
  const mapsUrl = p.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${p.id}`;
  const rating = p.rating ? parseFloat(p.rating) : 0;
  const reviews = p.userRatingCount ? parseInt(p.userRatingCount, 10) : 0;
  const primaryType = p.primaryType || "restaurant";
  const lat = p.location?.latitude || 0;
  const lng = p.location?.longitude || 0;

  let openingHours = "未提供";
  if (p.regularOpeningHours?.weekdayDescriptions) {
    openingHours = p.regularOpeningHours.weekdayDescriptions.join("\n");
  }

  let status = "未知";
  if (p.currentOpeningHours?.openNow !== undefined) {
    status = p.currentOpeningHours.openNow ? "营业中" : "已打烊";
  }

  const priceMap = {
    "PRICE_LEVEL_INEXPENSIVE": "$ (经济实惠)",
    "PRICE_LEVEL_MODERATE": "$$ (适中消费)",
    "PRICE_LEVEL_EXPENSIVE": "$$$ (较高消费)",
    "PRICE_LEVEL_VERY_EXPENSIVE": "$$$$ (高档消费)"
  };
  const price = priceMap[p.priceLevel] || "未知";

  const cats = classifyFriedCategories(name, primaryType, matchedTerm);
  const keywords = deriveKeywords(name, primaryType, matchedTerm);

  return {
    name,
    region: regionName,
    categories: cats,
    categoriesRaw: cats.join(" | "),
    rating,
    ratingRaw: rating ? rating.toString() : "未知",
    reviews,
    reviewsRaw: reviews.toString(),
    status,
    openingHours,
    price,
    address,
    phone,
    website,
    mapsUrl,
    primaryType,
    keywords,
    keywordsRaw: keywords.join(", "),
    latitude: lat,
    longitude: lng,
    placeId: p.id,
    _raw: {
      "餐馆名称 (Name)": name,
      "所属区域 (Region)": regionName,
      "油炸分类 (Categories)": cats.join(" | "),
      "评分 (Rating)": rating ? rating.toString() : "未知",
      "评价总数 (Reviews)": reviews.toString(),
      "当前营业状态 (Status)": status,
      "营业时间 (Opening Hours)": openingHours,
      "消费档次 (Price)": price,
      "详细地址 (Address)": address,
      "联系电话 (Phone)": phone,
      "官方网站 (Website)": website,
      "Google 地图链接 (Maps URL)": mapsUrl,
      "主营类型 (Primary Type)": primaryType,
      "匹配关键词 (Keywords)": keywords.join(", "),
      "纬度 (Latitude)": lat.toString(),
      "经度 (Longitude)": lng.toString(),
      "Place ID": p.id
    }
  };
}

async function searchGooglePlaces(textQuery, regionInfo, pageToken = "") {
  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.googleMapsUri",
    "places.rating",
    "places.userRatingCount",
    "places.regularOpeningHours",
    "places.currentOpeningHours",
    "places.priceLevel",
    "places.primaryType",
    "places.location",
    "nextPageToken"
  ].join(",");

  const body = {
    textQuery,
    maxResultCount: 20,
    languageCode: "zh-CN",
    regionCode: "CA",
    locationBias: {
      circle: {
        center: { latitude: regionInfo.lat, longitude: regionInfo.lng },
        radius: regionInfo.radius
      }
    }
  };

  if (pageToken) {
    body.pageToken = pageToken;
  }

  const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": fieldMask
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Google API returned HTTP ${resp.status}: ${errText}`);
  }

  return await resp.json();
}

async function main() {
  console.log("=================================================");
  console.log("🚀 Green Oil Local Deep Crawler Starting...");
  console.log(`Regions: ${Object.keys(GTA_REGIONS).length}`);
  console.log(`Keywords: ${KEYWORDS.length}`);
  console.log("=================================================\n");

  const placesMap = new Map();
  let totalApiRequests = 0;

  for (const [regionName, regionInfo] of Object.entries(GTA_REGIONS)) {
    console.log(`\n📍 [${regionName}] Starting retrieval across ${KEYWORDS.length} keywords...`);
    let regionNewPlaces = 0;

    for (const kw of KEYWORDS) {
      const textQuery = `${kw} in ${regionInfo.name}, Ontario, Canada`;
      let pageToken = "";
      let page = 1;

      while (page <= 3) {
        try {
          totalApiRequests++;
          const data = await searchGooglePlaces(textQuery, regionInfo, pageToken);
          const places = data.places || [];

          for (const p of places) {
            if (!p.id) continue;
            const transformed = transformGooglePlace(p, regionName, kw);

            if (placesMap.has(transformed.placeId)) {
              const prev = placesMap.get(transformed.placeId);
              const mergedCats = Array.from(new Set([...prev.categories, ...transformed.categories]));
              const mergedKws = Array.from(new Set([...prev.keywords, ...transformed.keywords]));
              prev.categories = mergedCats;
              prev.categoriesRaw = mergedCats.join(" | ");
              prev.keywords = mergedKws;
              prev.keywordsRaw = mergedKws.join(", ");
              if (prev._raw) {
                prev._raw["油炸分类 (Categories)"] = prev.categoriesRaw;
                prev._raw["匹配关键词 (Keywords)"] = prev.keywordsRaw;
              }
            } else {
              placesMap.set(transformed.placeId, transformed);
              regionNewPlaces++;
            }
          }

          if (data.nextPageToken && places.length === 20 && page < 3) {
            pageToken = data.nextPageToken;
            page++;
            await sleep(150); // slight throttle
          } else {
            break;
          }
        } catch (err) {
          console.warn(`⚠️ Error fetching '${textQuery}' (page ${page}): ${err.message}`);
          break;
        }

        await sleep(100);
      }
    }

    console.log(`✅ [${regionName}] Completed. Cumulative Total: ${placesMap.size} unique places (+${regionNewPlaces} this region)`);
  }

  const allPlaces = Array.from(placesMap.values());

  console.log("\n=================================================");
  console.log(`🎉 Finished crawling!`);
  console.log(`Total API requests: ${totalApiRequests}`);
  console.log(`Total unique restaurants captured: ${allPlaces.length}`);

  // Print regional breakdown
  const regionalCount = {};
  for (const p of allPlaces) {
    regionalCount[p.region] = (regionalCount[p.region] || 0) + 1;
  }
  console.log("Regional breakdown:", regionalCount);

  // Output to scripts/output/restaurants_full.json
  const outDir = path.join(__dirname, "output");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, "restaurants_full.json");
  fs.writeFileSync(outFile, JSON.stringify(allPlaces, null, 2), "utf-8");
  console.log(`💾 Saved ${allPlaces.length} records to ${outFile} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(2)} MB)`);
  console.log("=================================================");
}

main().catch(console.error);
