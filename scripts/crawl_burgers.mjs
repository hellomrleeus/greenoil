/**
 * Targeted Incremental Crawler for GTA Smash Burger, Fast Food & Fries Places
 * 
 * Expands the Green Oil database with high-volume oil-using burger & fast food places.
 * Merges into scripts/output/restaurants_full.json, re-tags hubs, and uploads to Cloudflare KV.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
if (!API_KEY) {
  console.error("❌ Please provide GOOGLE_MAPS_SERVER_KEY or GOOGLE_MAPS_API_KEY environment variable.");
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

const BURGER_KEYWORDS = [
  "smash burger",
  "smashburger",
  "smshbrgr",
  "burgers and fries",
  "fast food burger",
  "poutine fries",
  "five guys",
  "the burgers priest",
  "gladiator burger",
  "harveys",
  "a&w"
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
    { regex: /smash\s*burger|smshbrgr|smash/i, kw: "smash burger" },
    { regex: /burger/i, kw: "burger" },
    { regex: /poutine/i, kw: "poutine" },
    { regex: /french fries|fries/i, kw: "fries" },
    { regex: /five guys/i, kw: "five guys" },
    { regex: /the burger\'?s priest/i, kw: "burger's priest" },
    { regex: /gladiator burger/i, kw: "gladiator burger" },
    { regex: /harvey\'?s/i, kw: "harvey's" },
    { regex: /a&w/i, kw: "a&w" },
    { regex: /fried chicken/i, kw: "fried chicken" },
    { regex: /chicken wings|wings/i, kw: "chicken wings" }
  ];

  for (const { regex, kw } of candidates) {
    if (regex.test(text) && !kws.includes(kw)) {
      kws.push(kw);
    }
  }

  if (kws.length === 0) {
    kws.push(matchedTerm || "fast food");
  }

  return kws;
}

function transformGooglePlace(p, regionName, matchedTerm = "") {
  const name = p.displayName?.text || "未命名餐馆";
  const address = p.formattedAddress || "";
  const phone = p.nationalPhoneNumber || "无";
  const website = p.websiteUri || "";
  const mapsUrl = p.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${p.id}`;
  const rating = p.rating ? parseFloat(p.rating) : 4.2;
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
  const price = priceMap[p.priceLevel] || "$$ (适中消费)";

  const cats = classifyFriedCategories(name, primaryType, matchedTerm);
  const keywords = deriveKeywords(name, primaryType, matchedTerm);

  return {
    name,
    region: regionName,
    categories: cats,
    categoriesRaw: cats.join(" | "),
    rating,
    ratingRaw: rating ? rating.toString() : "4.2",
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
      "评分 (Rating)": rating ? rating.toString() : "4.2",
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
  console.log("🍔 Green Oil Incremental Burger & Fast Food Crawler Starting...");
  console.log("=================================================");

  const fullJsonPath = path.join(__dirname, "output/restaurants_full.json");
  const existingData = JSON.parse(fs.readFileSync(fullJsonPath, "utf8"));
  console.log(`Loaded ${existingData.length} existing restaurants.`);

  const placesMap = new Map();
  for (const r of existingData) {
    placesMap.set(r.placeId || r.name, r);
  }

  let newlyAdded = 0;
  let updatedCount = 0;

  for (const [regionName, regionInfo] of Object.entries(GTA_REGIONS)) {
    console.log(`\n📍 [${regionName}] Searching for Smash Burger & Fast Food...`);

    for (const kw of BURGER_KEYWORDS) {
      const textQuery = `${kw} in ${regionInfo.name}, Ontario, Canada`;
      let pageToken = "";
      let page = 1;

      while (page <= 2) {
        try {
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
              updatedCount++;
            } else {
              placesMap.set(transformed.placeId, transformed);
              newlyAdded++;
              console.log(`  ➕ Found new place: ${transformed.name} (${transformed.address})`);
            }
          }

          if (data.nextPageToken && places.length === 20 && page < 2) {
            pageToken = data.nextPageToken;
            page++;
            await sleep(150);
          } else {
            break;
          }
        } catch (err) {
          console.warn(`  ⚠️ Error fetching '${textQuery}': ${err.message}`);
          break;
        }

        await sleep(100);
      }
    }
  }

  const allPlaces = Array.from(placesMap.values());
  console.log("\n=================================================");
  console.log(`🎉 Ingestion Complete!`);
  console.log(`Total restaurants in database: ${allPlaces.length}`);
  console.log(`Newly captured restaurants: +${newlyAdded}`);
  console.log(`Updated keywords on existing: ${updatedCount}`);
  console.log("=================================================");

  // Check if SMSHBRGR was captured
  const smsh = allPlaces.find(r => r.name.toLowerCase().includes("smsh") || (r.address && r.address.includes("227 Main Street Markham")));
  if (smsh) {
    console.log(`✅ Verified SMSHBRGR is now in database: ${smsh.name} (${smsh.address})`);
  } else {
    console.log("⚠️ Specifically querying SMSHBRGR to ensure inclusion...");
    try {
      const specificData = await searchGooglePlaces("SMSHBRGR - Main St Markham", GTA_REGIONS["万锦 (Markham)"]);
      if (specificData.places && specificData.places[0]) {
        const trans = transformGooglePlace(specificData.places[0], "万锦 (Markham)", "smash burger");
        allPlaces.unshift(trans);
        console.log(`✅ Specifically added SMSHBRGR: ${trans.name}`);
      }
    } catch (e) {
      console.error("Failed specific query:", e);
    }
  }

  // Save intermediate file
  fs.writeFileSync(fullJsonPath, JSON.stringify(allPlaces, null, 2), "utf8");
  console.log(`💾 Saved updated ${allPlaces.length} records to ${fullJsonPath}`);

  // Now trigger tag_hubs.mjs to cluster malls and upload to Cloudflare KV
  console.log("\n🚀 Running tag_hubs.mjs to cluster shopping malls and upload to Cloudflare KV...");
  execSync("node scripts/tag_hubs.mjs", { stdio: "inherit", cwd: path.join(__dirname, "..") });

  console.log("\n✨ All done! Database expanded and Cloudflare KV updated!");
}

main().catch(console.error);
