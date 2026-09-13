/**
 * Green Oil Hub & Mall Tagging and KV Ingestion Engine
 * 
 * 1. Clusters 2,585 restaurants into 35+ major GTA shopping malls & commercial plazas
 * 2. Injects hubId, hubName, hubNameEn, hubNameKo into each restaurant record
 * 3. Calculates hub-level metrics (restaurant count, avg rating, total est. UCO)
 * 4. Generates hubs_summary.json and updates Cloudflare KV
 */

import fs from "fs";
import path from "path";
import { execSync, execFileSync } from "child_process";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Spherical distance formula (Haversine)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Extract canonical GTA region from authoritative Canadian address
export function normalizeRegionFromAddress(address, existingRegion) {
  if (!address) return existingRegion;
  const match = address.match(/,\s*([A-Za-z\s]+),\s*ON\b/i);
  if (match) {
    const city = match[1].trim().toLowerCase();
    if (city === "north york" || city === "willowdale" || city === "don mills" || city === "downsview") return "北约克 (North York)";
    if (city === "scarborough") return "士嘉堡 (Scarborough)";
    if (city === "markham" || city === "unionville") return "万锦 (Markham)";
    if (city === "richmond hill") return "列治文山 (Richmond Hill)";
    if (city === "mississauga") return "密西沙加 (Mississauga)";
    if (city === "vaughan" || city === "woodbridge" || city === "maple" || city === "concord") return "旺市 (Vaughan)";
    if (city === "thornhill") return existingRegion === "旺市 (Vaughan)" ? "旺市 (Vaughan)" : "万锦 (Markham)";
    if (city === "toronto" || city === "old toronto" || city === "east york" || city === "york" || city === "etobicoke") {
      return "多伦多市中心 (Downtown Toronto)";
    }
  }
  return existingRegion;
}

// Match keyword with regex word boundary to prevent substring false positives
export function matchesKeyword(text, kw) {
  if (!text || !kw) return false;
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return regex.test(text);
}

export const GTA_HUBS = [
  // --- MARKHAM ---
  {
    id: "first_markham",
    name: "万锦广场 (First Markham Place)",
    nameEn: "First Markham Place",
    nameKo: "퍼스트 마컴 플레이스",
    region: "万锦 (Markham)",
    lat: 43.8485,
    lng: -79.3489,
    radius: 500,
    addressKeywords: ["3235 hwy 7", "first markham"],
    category: "shopping_mall",
    icon: "🏬"
  },
  {
    id: "pacific_mall",
    name: "太古广场 / 城市广场 (Pacific Mall)",
    nameEn: "Pacific Mall & Market Village",
    nameKo: "퍼시픽 몰 / 마켓 빌리지",
    region: "万锦 (Markham)",
    lat: 43.8260,
    lng: -79.3060,
    radius: 500,
    addressKeywords: ["4300 steeles", "4390 steeles", "pacific mall", "太古"],
    category: "shopping_mall",
    icon: "🏬"
  },
  {
    id: "markville",
    name: "CF Markville Mall 购物中心",
    nameEn: "CF Markville Mall",
    nameKo: "마크빌 몰",
    region: "万锦 (Markham)",
    lat: 43.8682,
    lng: -79.2840,
    radius: 550,
    addressKeywords: ["5000 hwy 7", "markville"],
    category: "shopping_mall",
    icon: "🛍️"
  },
  {
    id: "langham_square",
    name: "朗豪坊商圈 (Langham Square / 大统华)",
    nameEn: "Langham Square (T&T)",
    nameKo: "랑함 스퀘어",
    region: "万锦 (Markham)",
    lat: 43.8569,
    lng: -79.3045,
    radius: 450,
    addressKeywords: ["8339 kennedy", "28 south unionville", "langham"],
    category: "commercial_plaza",
    icon: "🏢"
  },
  {
    id: "peachtree",
    name: "新旺角 / 绿宝石广场 (New Kennedy & Peachtree)",
    nameEn: "New Kennedy & Peachtree Centre",
    nameKo: "피치트리 센터",
    region: "万锦 (Markham)",
    lat: 43.8447,
    lng: -79.3105,
    radius: 500,
    addressKeywords: ["8360 kennedy", "8362 kennedy", "peachtree", "新旺角"],
    category: "commercial_plaza",
    icon: "🏢"
  },
  {
    id: "downtown_markham",
    name: "万锦市中心商圈 (Downtown Markham)",
    nameEn: "Downtown Markham",
    nameKo: "다운타운 마컴",
    region: "万锦 (Markham)",
    lat: 43.8540,
    lng: -79.3330,
    radius: 700,
    addressKeywords: ["enterprise blvd", "8110 birchmount", "downtown markham"],
    category: "commercial_plaza",
    icon: "🏙️"
  },
  {
    id: "woodbine_hwy7",
    name: "Woodbine & Hwy 7 商务餐饮区",
    nameEn: "Woodbine & Hwy 7 Corridor",
    nameKo: "우드바인 & Hwy 7 상권",
    region: "万锦 (Markham)",
    lat: 43.8510,
    lng: -79.3620,
    radius: 650,
    addressKeywords: ["8500 woodbine", "8505 woodbine", "8400 woodbine", "woodbine & hwy 7", "woodbine hwy 7"],
    category: "commercial_plaza",
    icon: "🏢"
  },

  // --- RICHMOND HILL ---
  {
    id: "times_square_rh",
    name: "时代广场 / 百利广场 (Times Square RH)",
    nameEn: "Times Square & Richmond Court",
    nameKo: "타임스퀘어 리치먼드힐",
    region: "列治文山 (Richmond Hill)",
    lat: 43.8436,
    lng: -79.3872,
    radius: 550,
    addressKeywords: ["550 hwy 7", "328 hwy 7", "times square", "时代广场", "百利广场"],
    category: "commercial_plaza",
    icon: "🏬"
  },
  {
    id: "west_beaver_creek",
    name: "喜来登商业街 (West Beaver Creek Hub)",
    nameEn: "West Beaver Creek Commercial Hub",
    nameKo: "웨스트 비버 크릭 상권",
    region: "列治文山 (Richmond Hill)",
    lat: 43.8480,
    lng: -79.3780,
    radius: 700,
    addressKeywords: ["280 west beaver", "west beaver creek"],
    category: "commercial_plaza",
    icon: "🏢"
  },
  {
    id: "hillcrest_mall",
    name: "Hillcrest Mall 购物中心商圈",
    nameEn: "Hillcrest Mall Area",
    nameKo: "힐크레스트 몰",
    region: "列治文山 (Richmond Hill)",
    lat: 43.8685,
    lng: -79.4390,
    radius: 650,
    addressKeywords: ["9350 yonge", "hillcrest"],
    category: "shopping_mall",
    icon: "🛍️"
  },
  {
    id: "high_tech_silvercity",
    name: "高科技道娱乐商业区 (High Tech / SilverCity)",
    nameEn: "High Tech Rd & SilverCity",
    nameKo: "하이테크 로드 상권",
    region: "列治文山 (Richmond Hill)",
    lat: 43.8420,
    lng: -79.4210,
    radius: 650,
    addressKeywords: ["high tech rd", "silvercity"],
    category: "commercial_plaza",
    icon: "🏢"
  },

  // --- SCARBOROUGH ---
  {
    id: "midland_finch",
    name: "金钟城 / 美兰中心 (Midland & Finch Plaza)",
    nameEn: "Midland & Finch Plaza (Sky City)",
    nameKo: "미들랜드 & 핀치 플라자",
    region: "士嘉堡 (Scarborough)",
    lat: 43.8185,
    lng: -79.2885,
    radius: 600,
    addressKeywords: ["3272 midland", "3280 midland", "3290 midland", "4186 finch"],
    category: "commercial_plaza",
    icon: "🏬"
  },
  {
    id: "silver_star",
    name: "银星美食商圈 (Silver Star Hub)",
    nameEn: "Silver Star Commercial Hub",
    nameKo: "실버스타 미식 상권",
    region: "士嘉堡 (Scarborough)",
    lat: 43.8245,
    lng: -79.2780,
    radius: 650,
    addressKeywords: ["silver star", "redlea"],
    category: "commercial_plaza",
    icon: "🏢"
  },
  {
    id: "stc",
    name: "士嘉堡购物中心 (Scarborough Town Centre)",
    nameEn: "Scarborough Town Centre (STC)",
    nameKo: "스카버러 타운 센터",
    region: "士嘉堡 (Scarborough)",
    lat: 43.7760,
    lng: -79.2580,
    radius: 700,
    addressKeywords: ["300 borough", "scarborough town centre"],
    category: "shopping_mall",
    icon: "🛍️"
  },
  {
    id: "woodside_square",
    name: "活力商场 (Woodside Square)",
    nameEn: "Woodside Square",
    nameKo: "우드사이드 스퀘어",
    region: "士嘉堡 (Scarborough)",
    lat: 43.8090,
    lng: -79.2680,
    radius: 550,
    addressKeywords: ["1571 sandhurst", "woodside"],
    category: "shopping_mall",
    icon: "🛍️"
  },
  {
    id: "bamburgh",
    name: "丰泰超市商圈 (Bamburgh Gardens)",
    nameEn: "Bamburgh Gardens (Foody World)",
    nameKo: "밤버그 가든스 상권",
    region: "士嘉堡 (Scarborough)",
    lat: 43.8150,
    lng: -79.3240,
    radius: 550,
    addressKeywords: ["375 bamburgh", "bamburgh"],
    category: "commercial_plaza",
    icon: "🏢"
  },
  {
    id: "dragon_centre",
    name: "金山中心 / 东方广场 (Dragon & Oriental)",
    nameEn: "Dragon Centre & Oriental Centre",
    nameKo: "드래곤 센터",
    region: "士嘉堡 (Scarborough)",
    lat: 43.7915,
    lng: -79.2855,
    radius: 650,
    addressKeywords: ["23 glen watford", "4438 sheppard", "dragon centre"],
    category: "commercial_plaza",
    icon: "🏬"
  },
  {
    id: "bridlewood_warden",
    name: "Bridlewood Mall / Warden 商圈",
    nameEn: "Bridlewood Mall & Warden",
    nameKo: "브라이들우드 몰",
    region: "士嘉堡 (Scarborough)",
    lat: 43.7950,
    lng: -79.3200,
    radius: 650,
    addressKeywords: ["2900 warden", "bridlewood"],
    category: "shopping_mall",
    icon: "🛍️"
  },

  // --- NORTH YORK ---
  {
    id: "yonge_finch",
    name: "北约克央街美食街 (Yonge & Finch Corridor)",
    nameEn: "Yonge & Finch Dining Corridor",
    nameKo: "영 & 핀치 먹자골목",
    region: "北约克 (North York)",
    lat: 43.7790,
    lng: -79.4150,
    radius: 800,
    addressKeywords: ["5300 yonge", "5400 yonge", "5500 yonge", "5600 yonge", "5700 yonge", "yonge & finch", "finch station"],
    category: "commercial_plaza",
    icon: "🍜"
  },
  {
    id: "yonge_sheppard",
    name: "北约克市中心 (Yonge & Sheppard / Empress)",
    nameEn: "Yonge & Sheppard / Empress Walk",
    nameKo: "영 & 셰퍼드 다운타운",
    region: "北约克 (North York)",
    lat: 43.7630,
    lng: -79.4110,
    radius: 650,
    addressKeywords: ["4841 yonge", "4900 yonge", "5000 yonge", "5095 yonge", "empress walk", "yonge & sheppard"],
    category: "commercial_plaza",
    icon: "🏙️"
  },
  {
    id: "fairview_mall",
    name: "CF Fairview Mall 购物中心",
    nameEn: "CF Fairview Mall",
    nameKo: "페어뷰 몰",
    region: "北约克 (North York)",
    lat: 43.7780,
    lng: -79.3440,
    radius: 650,
    addressKeywords: ["1800 sheppard", "fairview"],
    category: "shopping_mall",
    icon: "🛍️"
  },
  {
    id: "yorkdale",
    name: "Yorkdale Shopping Centre",
    nameEn: "Yorkdale Shopping Centre",
    nameKo: "요크데일 쇼핑센터",
    region: "北约克 (North York)",
    lat: 43.7255,
    lng: -79.4525,
    radius: 700,
    addressKeywords: ["3401 dufferin", "yorkdale"],
    category: "shopping_mall",
    icon: "🛍️"
  },
  {
    id: "centerpoint_mall",
    name: "Centerpoint Mall (央街客家商圈)",
    nameEn: "Centerpoint Mall",
    nameKo: "센터포인트 몰",
    region: "北约克 (North York)",
    lat: 43.7940,
    lng: -79.4190,
    radius: 650,
    addressKeywords: ["6464 yonge", "centerpoint"],
    category: "shopping_mall",
    icon: "🛍️"
  },
  {
    id: "shops_don_mills",
    name: "CF Shops at Don Mills 欧风商圈",
    nameEn: "CF Shops at Don Mills",
    nameKo: "샵스 앳 돈밀스",
    region: "北约克 (North York)",
    lat: 43.7350,
    lng: -79.3440,
    radius: 600,
    addressKeywords: ["shops at don mills", "karl fraser", "1090 don mills", "1066 don mills", "o'neill rd"],
    category: "commercial_plaza",
    icon: "⛲"
  },

  // --- DOWNTOWN TORONTO ---
  {
    id: "chinatown_spadina",
    name: "多伦多中区唐人街 (Downtown Chinatown)",
    nameEn: "Downtown Chinatown (Spadina)",
    nameKo: "다운타운 차이나타운",
    region: "多伦多市中心 (Downtown Toronto)",
    lat: 43.6535,
    lng: -79.3985,
    radius: 700,
    addressKeywords: ["chinatown", "dragon city", "280 spadina", "spadina & dundas"],
    category: "commercial_plaza",
    icon: "🏮"
  },
  {
    id: "eaton_centre",
    name: "伊顿中心 / 登打士广场 (CF Eaton Centre)",
    nameEn: "CF Toronto Eaton Centre",
    nameKo: "이튼 센터 / 던다스 스퀘어",
    region: "多伦多市中心 (Downtown Toronto)",
    lat: 43.6545,
    lng: -79.3805,
    radius: 600,
    addressKeywords: ["220 yonge", "eaton centre", "dundas square"],
    category: "shopping_mall",
    icon: "🛍️"
  },
  {
    id: "koreatown_bloor",
    name: "市区韩国城 (Koreatown Bloor)",
    nameEn: "Koreatown (Bloor West)",
    nameKo: "블루어 코리아타운",
    region: "多伦多市中心 (Downtown Toronto)",
    lat: 43.6645,
    lng: -79.4150,
    radius: 650,
    addressKeywords: ["koreatown", "christie pits", "650 bloor", "700 bloor"],
    category: "commercial_plaza",
    icon: "🇰🇷"
  },
  {
    id: "kensington_queen_w",
    name: "肯辛顿与潮流西区 (Kensington / Queen W)",
    nameEn: "Kensington Market & Queen West",
    nameKo: "켄싱턴 마켓 & 퀸 웨스트",
    region: "多伦多市中心 (Downtown Toronto)",
    lat: 43.6500,
    lng: -79.4030,
    radius: 750,
    addressKeywords: ["kensington", "augusta ave", "baldwin st"],
    category: "commercial_plaza",
    icon: "🎨"
  },
  {
    id: "bloor_yorkville",
    name: "名店街高端商圈 (Yorkville / Bloor-Yonge)",
    nameEn: "Bloor-Yorkville Luxury District",
    nameKo: "요크빌 명품거리",
    region: "多伦多市中心 (Downtown Toronto)",
    lat: 43.6700,
    lng: -79.3900,
    radius: 650,
    addressKeywords: ["yorkville", "cumberland", "hazelton"],
    category: "commercial_plaza",
    icon: "💎"
  },

  // --- MISSISSAUGA ---
  {
    id: "square_one",
    name: "Square One 核心商圈 (City Centre)",
    nameEn: "Square One Shopping Centre",
    nameKo: "스퀘어 원 몰",
    region: "密西沙加 (Mississauga)",
    lat: 43.5930,
    lng: -79.6425,
    radius: 800,
    addressKeywords: ["100 city centre", "square one", "rathburn"],
    category: "shopping_mall",
    icon: "🛍️"
  },
  {
    id: "heartland",
    name: "Heartland Town Centre 商圈",
    nameEn: "Heartland Town Centre",
    nameKo: "하트랜드 타운 센터",
    region: "密西沙加 (Mississauga)",
    lat: 43.6185,
    lng: -79.6940,
    radius: 900,
    addressKeywords: ["heartland town", "heartland centre", "5900 mavis", "6000 mavis"],
    category: "shopping_mall",
    icon: "🏬"
  },
  {
    id: "dixie_outlet",
    name: "Dixie Outlet Mall 商圈",
    nameEn: "Dixie Outlet Mall Area",
    nameKo: "딕시 아울렛 몰",
    region: "密西沙加 (Mississauga)",
    lat: 43.5935,
    lng: -79.5680,
    radius: 700,
    addressKeywords: ["1250 s service", "dixie outlet"],
    category: "shopping_mall",
    icon: "🛍️"
  },
  {
    id: "streetsville",
    name: "Streetsville 历史风情街区",
    nameEn: "Streetsville Historic Village",
    nameKo: "스트리츠빌 역사거리",
    region: "密西沙加 (Mississauga)",
    lat: 43.5820,
    lng: -79.7120,
    radius: 650,
    addressKeywords: ["streetsville"],
    category: "commercial_plaza",
    icon: "🏡"
  },

  // --- VAUGHAN ---
  {
    id: "vaughan_mills",
    name: "Vaughan Mills 购物中心商圈",
    nameEn: "Vaughan Mills Shopping Centre",
    nameKo: "본 밀스 쇼핑센터",
    region: "旺市 (Vaughan)",
    lat: 43.8255,
    lng: -79.5385,
    radius: 800,
    addressKeywords: ["1 bass pro mills", "vaughan mills"],
    category: "shopping_mall",
    icon: "🛍️"
  },
  {
    id: "vmc_hwy7",
    name: "旺市大都会中心 (VMC / Jane & Hwy 7)",
    nameEn: "Vaughan Metropolitan Centre (VMC)",
    nameKo: "본 메트로폴리탄 센터",
    region: "旺市 (Vaughan)",
    lat: 43.7940,
    lng: -79.5280,
    radius: 750,
    addressKeywords: ["millway ave", "vmc", "applewood cres"],
    category: "commercial_plaza",
    icon: "🏙️"
  }
];

export function tagAllRestaurants() {
  const filePath = path.join(__dirname, "output/restaurants_full.json");
  if (!fs.existsSync(filePath)) {
    throw new Error("restaurants_full.json not found!");
  }

  const restaurants = JSON.parse(fs.readFileSync(filePath, "utf8"));
  console.log(`Loaded ${restaurants.length} restaurants. Tagging with ${GTA_HUBS.length} hubs...`);

  const hubMap = new Map(GTA_HUBS.map(h => [h.id, h]));
  const hubStats = {};
  GTA_HUBS.forEach(h => {
    hubStats[h.id] = {
      ...h,
      count: 0,
      totalRating: 0,
      ratedCount: 0,
      totalReviews: 0,
      estMonthlyOilLiters: 0,
      sampleRestaurants: []
    };
  });

  let taggedCount = 0;

  restaurants.forEach(r => {
    // 0. Base municipality normalization from authoritative address
    r.region = normalizeRegionFromAddress(r.address, r.region);

    const lat = parseFloat(r.latitude);
    const lng = parseFloat(r.longitude);
    const addr = (r.address || "").toLowerCase();

    let matchedHub = null;
    let minDistance = Infinity;

    // 1. Direct address keyword match with word boundaries (Highest priority)
    for (const hub of GTA_HUBS) {
      if (hub.addressKeywords && hub.addressKeywords.some(kw => matchesKeyword(addr, kw))) {
        matchedHub = hub;
        break;
      }
    }

    // 2. Geodesic radius match (restricted to GTA bounds)
    if (!matchedHub && !isNaN(lat) && !isNaN(lng)) {
      if (lat >= 43.3 && lat <= 44.5 && lng >= -80.2 && lng <= -79.0) {
        for (const hub of GTA_HUBS) {
          const d = getDistance(lat, lng, hub.lat, hub.lng);
          if (d <= hub.radius && d < minDistance) {
            minDistance = d;
            matchedHub = hub;
          }
        }
      }
    }

    if (matchedHub) {
      r.hubId = matchedHub.id;
      r.hubName = matchedHub.name;
      r.hubNameEn = matchedHub.nameEn;
      r.hubNameKo = matchedHub.nameKo;
      r.hubCategory = matchedHub.category;
      r.hubIcon = matchedHub.icon;
      // Overwrite region with hub's canonical region to ensure 100% filter consistency
      r.region = matchedHub.region;
      taggedCount++;

      const st = hubStats[matchedHub.id];
      st.count++;
      if (r.rating && r.rating > 0) {
        st.totalRating += r.rating;
        st.ratedCount++;
      }
      st.totalReviews += (r.reviews || 0);

      // Estimate avg 450L/mo cooking oil per fried food restaurant, 75% UCO = 337L
      st.estMonthlyOilLiters += 450;

      if (st.sampleRestaurants.length < 5) {
        st.sampleRestaurants.push({
          name: r.name,
          rating: r.rating || 0,
          categoriesRaw: r.categoriesRaw || ""
        });
      }
    } else {
      // Default: Community & Street retail
      r.hubId = "street_retail";
      r.hubName = "沿街与社区广场 (Street & Community)";
      r.hubNameEn = "Street Retail & Community Plazas";
      r.hubNameKo = "일반 거리 및 상가";
      r.hubCategory = "street";
      r.hubIcon = "🏪";
    }
  });

  console.log(`Tagged ${taggedCount} / ${restaurants.length} restaurants into named hubs (${((taggedCount/restaurants.length)*100).toFixed(1)}%)`);

  // Write updated restaurants_full.json
  fs.writeFileSync(filePath, JSON.stringify(restaurants, null, 2), "utf8");
  console.log(`Saved updated restaurants_full.json`);

  // Write hubs summary
  const summaryList = Object.values(hubStats).map(st => {
    const avgRating = st.ratedCount > 0 ? +(st.totalRating / st.ratedCount).toFixed(1) : 4.2;
    const estUcoLiters = Math.round(st.estMonthlyOilLiters * 0.75);
    const est200lDrums = Math.round(estUcoLiters / 200);

    return {
      id: st.id,
      name: st.name,
      nameEn: st.nameEn,
      nameKo: st.nameKo,
      region: st.region,
      category: st.category,
      icon: st.icon,
      count: st.count,
      avgRating,
      totalReviews: st.totalReviews,
      estMonthlyOilLiters: st.estMonthlyOilLiters,
      estUcoLiters,
      est200lDrums,
      sampleRestaurants: st.sampleRestaurants
    };
  }).filter(h => h.count > 0).sort((a, b) => b.count - a.count);

  const summaryPath = path.join(__dirname, "output/hubs_summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summaryList, null, 2), "utf8");
  console.log(`Generated hubs_summary.json with ${summaryList.length} active hubs.`);

  return { restaurants, summaryList };
}

// If run directly:
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { restaurants, summaryList } = tagAllRestaurants();

  // D1 is authoritative for restaurants; KV retains the static hub summary.
  console.log("Updating restaurant hub tags in D1...");
  try {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "greenoil-hubs-"));
    const sqlPath = path.join(temporary, "hubs.sql");
    const quote = value => "'" + value.replace(/'/g, "''") + "'";
    const sql = restaurants.map(r => {
      const tags = Object.fromEntries(["hubId","hubName","hubNameEn","hubNameKo","hubCategory","hubIcon","region"].filter(k=>r[k]!==undefined).map(k=>[k,r[k]]));
      return `INSERT INTO restaurants(id,data) VALUES(${quote(r.placeId || r.name)},${quote(JSON.stringify(r))}) ON CONFLICT(id) DO UPDATE SET data=json_patch(restaurants.data,${quote(JSON.stringify(tags))});`;
    }).join("\n");
    try {
      fs.writeFileSync(sqlPath, sql, {mode:0o600});
      execFileSync("npx", ["wrangler","d1","execute","greenoil-restaurants","--config=worker/wrangler.toml","--remote",`--file=${sqlPath}`], {stdio:"inherit",cwd:path.join(__dirname,"..")});
    } finally { fs.rmSync(temporary,{recursive:true,force:true}); }

    const hubsJsonPath = path.join(__dirname, "output/hubs_summary.json");
    execSync(`npx wrangler kv key put --config=worker/wrangler.toml --binding=RESTAURANTS_KV --remote "gta_hubs_summary" --path="${hubsJsonPath}"`, {
      stdio: "inherit",
      cwd: path.join(__dirname, "..")
    });
    console.log("Successfully updated D1 restaurant tags and KV hub summary!");
  } catch (err) {
    console.error("Failed to upload to Cloudflare KV:", err.message);
  }
}
