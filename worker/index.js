/**
 * Cloudflare Worker for Green Oil Workbench
 * 
 * Features:
 * 1. Background Scheduled Task (Cron: 0 3 * * *): Daily sync of Google Maps Places API (New)
 * 2. High-Performance KV Cache Storage & Memory Fallback
 * 3. Server-side Filtering, Search, Sorting, and Pagination
 * 4. Fixed Credential Authentication with Cookie & Token (greenoil_session)
 * 5. Manual Sync Trigger (POST /api/sync)
 */

import { SEED_RESTAURANTS } from "./seed.js";

const DEFAULT_USERNAME = "greenoil";
const DEFAULT_PASSWORD = "greenoil2025";
const COOKIE_NAME = "greenoil_session";
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days
const KV_CACHE_KEY = "gta_fried_food_restaurants";
const KV_LAST_UPDATED_KEY = "last_updated_time";

// GTA Region Centroids & Coordinates for Google Maps queries
const GTA_REGIONS = {
  "万锦 (Markham)": { lat: 43.8561, lng: -79.3370, radius: 10000, name: "Markham" },
  "士嘉堡 (Scarborough)": { lat: 43.7764, lng: -79.2318, radius: 10000, name: "Scarborough" },
  "北约克 (North York)": { lat: 43.7615, lng: -79.4111, radius: 10000, name: "North York" },
  "列治文山 (Richmond Hill)": { lat: 43.8828, lng: -79.4403, radius: 9000, name: "Richmond Hill" },
  "多伦多市中心 (Downtown Toronto)": { lat: 43.6532, lng: -79.3832, radius: 8000, name: "Downtown Toronto" },
  "密西沙加 (Mississauga)": { lat: 43.5890, lng: -79.6441, radius: 12000, name: "Mississauga" },
  "旺市 (Vaughan)": { lat: 43.8563, lng: -79.5085, radius: 11000, name: "Vaughan" }
};

export default {
  /**
   * Cron Trigger Scheduled Event (runs once daily at 03:00 UTC)
   */
  async scheduled(event, env, ctx) {
    console.log("Daily Cron triggered: syncing Google Maps Places API to cache...");
    ctx.waitUntil(syncDailyRestaurants(env));
  },

  /**
   * Fetch HTTP Router
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    // Standard CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    };

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // 1. Auth routes
      if (url.pathname === "/api/login" && request.method === "POST") {
        return await handleLogin(request, env, corsHeaders);
      }
      if (url.pathname === "/api/auth/check" && request.method === "GET") {
        return await handleAuthCheck(request, env, corsHeaders);
      }
      if (url.pathname === "/api/logout" && request.method === "POST") {
        return await handleLogout(request, corsHeaders);
      }

      // 2. Cached restaurant query with server-side pagination & filter
      if (url.pathname === "/api/restaurants" && request.method === "GET") {
        return await handleGetCachedRestaurants(request, env, corsHeaders);
      }

      // 3. Cache status
      if (url.pathname === "/api/cache/status" && request.method === "GET") {
        return await handleCacheStatus(env, corsHeaders);
      }

      // 4. Manual sync trigger (runs full background sync to KV)
      if (url.pathname === "/api/sync" && request.method === "POST") {
        const isAuthed = checkAuth(request, env);
        if (!isAuthed) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const result = await syncDailyRestaurants(env);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 5. Health check
      if (url.pathname === "/" || url.pathname === "/api/health") {
        return new Response(JSON.stringify({
          status: "healthy",
          service: "Green Oil Workbench API",
          cron: "0 3 * * * (daily sync enabled)",
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: "Internal Server Error",
        message: err.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};

/**
 * Handle Login
 */
async function handleLogin(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { username, password } = body || {};
  const validUsername = env.WORKER_USERNAME || DEFAULT_USERNAME;
  const validPassword = env.WORKER_PASSWORD || DEFAULT_PASSWORD;

  if (username !== validUsername || password !== validPassword) {
    return new Response(JSON.stringify({
      success: false,
      error: "用户名或密码错误"
    }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const payload = {
    user: username,
    timestamp: Date.now(),
    role: "greenoil-operator"
  };
  const token = btoa(JSON.stringify(payload));
  const cookieHeader = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${SESSION_TTL}`;

  return new Response(JSON.stringify({
    success: true,
    message: "登录成功",
    token,
    user: { username, role: "operator" }
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Set-Cookie": cookieHeader
    }
  });
}

/**
 * Handle Auth Check
 */
async function handleAuthCheck(request, env, corsHeaders) {
  const isAuthed = checkAuth(request, env);
  if (!isAuthed) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({
    authenticated: true,
    user: { username: env.WORKER_USERNAME || DEFAULT_USERNAME }
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Handle Logout
 */
async function handleLogout(request, corsHeaders) {
  const cookieHeader = `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0`;
  return new Response(JSON.stringify({ success: true, message: "已退出登录" }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Set-Cookie": cookieHeader
    }
  });
}

function checkAuth(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded = JSON.parse(atob(token));
      if (decoded && decoded.user === (env.WORKER_USERNAME || DEFAULT_USERNAME)) {
        return true;
      }
    } catch {}
  }

  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map(c => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );
    const token = cookies[COOKIE_NAME];
    if (token) {
      try {
        const decoded = JSON.parse(atob(token));
        if (decoded && decoded.user === (env.WORKER_USERNAME || DEFAULT_USERNAME)) {
          return true;
        }
      } catch {}
    }
  }

  return false;
}

/**
 * Get cached restaurants with server-side pagination, search, and filtering
 */
async function handleGetCachedRestaurants(request, env, corsHeaders) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const region = (url.searchParams.get("region") || "全部 (All GTA)").trim();
  const keyword = (url.searchParams.get("keyword") || "").trim().toLowerCase();
  const category = (url.searchParams.get("category") || "全部").trim();
  const sortBy = (url.searchParams.get("sort") || "rating").trim();

  // 1. Retrieve dataset from KV or fallback to SEED_RESTAURANTS
  let allRestaurants = SEED_RESTAURANTS;
  let lastUpdated = "2026-09-13T03:00:00Z";

  if (env.RESTAURANTS_KV) {
    try {
      const cached = await env.RESTAURANTS_KV.get(KV_CACHE_KEY, { type: "json" });
      if (cached && Array.isArray(cached) && cached.length > 0) {
        allRestaurants = cached;
      }
      const updated = await env.RESTAURANTS_KV.get(KV_LAST_UPDATED_KEY);
      if (updated) lastUpdated = updated;
    } catch (e) {
      console.warn("Error reading from RESTAURANTS_KV:", e);
    }
  }

  // 2. Apply Region Filter
  let filtered = allRestaurants;
  if (region && region !== "全部 (All GTA)") {
    filtered = filtered.filter(r => r.region.includes(region) || region.includes(r.region));
  }

  // 3. Apply Category Filter
  if (category && category !== "全部") {
    filtered = filtered.filter(r => {
      return r.categories && r.categories.some(c => c.includes(category));
    });
  }

  // 4. Apply Keyword Search
  if (keyword) {
    filtered = filtered.filter(r => {
      const searchTarget = [
        r.name,
        r.address,
        r.phone,
        r.keywordsRaw,
        r.primaryType,
        r.categoriesRaw
      ].join(" ").toLowerCase();
      return searchTarget.includes(keyword);
    });
  }

  // 5. Apply Sorting
  filtered.sort((a, b) => {
    if (sortBy === "rating") {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviews - a.reviews;
    }
    if (sortBy === "reviews") {
      return b.reviews - a.reviews;
    }
    if (sortBy === "name") {
      return a.name.localeCompare(b.name, "zh-CN");
    }
    return 0;
  });

  // 6. Pagination Slice
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const paginatedData = filtered.slice(startIndex, startIndex + pageSize);

  return new Response(JSON.stringify({
    success: true,
    page,
    pageSize,
    total,
    totalPages,
    lastUpdated,
    data: paginatedData
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300" // 5 min HTTP edge cache
    }
  });
}

/**
 * Check cache status
 */
async function handleCacheStatus(env, corsHeaders) {
  let count = SEED_RESTAURANTS.length;
  let lastUpdated = "Initial Seed (2026-09-13)";

  if (env.RESTAURANTS_KV) {
    try {
      const cached = await env.RESTAURANTS_KV.get(KV_CACHE_KEY, { type: "json" });
      if (cached && Array.isArray(cached)) count = cached.length;
      const updated = await env.RESTAURANTS_KV.get(KV_LAST_UPDATED_KEY);
      if (updated) lastUpdated = updated;
    } catch {}
  }

  return new Response(JSON.stringify({
    status: "ok",
    cachedCount: count,
    lastUpdated,
    kvEnabled: Boolean(env.RESTAURANTS_KV),
    cronSchedule: "0 3 * * *"
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Daily Background Sync of Google Maps Places API (New) into KV Cache
 */
async function syncDailyRestaurants(env) {
  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("syncDailyRestaurants aborted: GOOGLE_MAPS_API_KEY not configured.");
    return { success: false, message: "GOOGLE_MAPS_API_KEY is not configured" };
  }

  // Start with existing cached data or seed data
  let existingMap = new Map();
  for (const r of SEED_RESTAURANTS) {
    existingMap.set(r.placeId || r.name, r);
  }

  if (env.RESTAURANTS_KV) {
    try {
      const cached = await env.RESTAURANTS_KV.get(KV_CACHE_KEY, { type: "json" });
      if (cached && Array.isArray(cached)) {
        for (const r of cached) {
          existingMap.set(r.placeId || r.name, r);
        }
      }
    } catch {}
  }

  let newlyFetchedCount = 0;

  // Iterate over each GTA region to fetch fresh restaurants
  for (const [regionName, regionInfo] of Object.entries(GTA_REGIONS)) {
    try {
      const queryList = [
        `fried chicken wings in ${regionInfo.name}, Ontario, Canada`,
        `fried food fish and chips katsu in ${regionInfo.name}, Ontario, Canada`
      ];

      for (const textQuery of queryList) {
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
          "places.location"
        ].join(",");

        const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": fieldMask
          },
          body: JSON.stringify({
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
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const places = data.places || [];
          for (const p of places) {
            const transformed = transformGooglePlace(p, regionName);
            existingMap.set(transformed.placeId, transformed);
            newlyFetchedCount++;
          }
        }
      }
    } catch (err) {
      console.error(`Error querying region ${regionName}:`, err);
    }
  }

  const allMerged = Array.from(existingMap.values());
  const nowStr = new Date().toISOString();

  // Save to KV
  if (env.RESTAURANTS_KV) {
    await env.RESTAURANTS_KV.put(KV_CACHE_KEY, JSON.stringify(allMerged));
    await env.RESTAURANTS_KV.put(KV_LAST_UPDATED_KEY, nowStr);
  }

  return {
    success: true,
    totalRecords: allMerged.length,
    newlyFetched: newlyFetchedCount,
    syncedAt: nowStr
  };
}

function transformGooglePlace(p, regionName) {
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

  const cats = classifyFriedCategories(name, primaryType);
  const keywords = deriveKeywords(name, primaryType);

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
    placeId: p.id
  };
}

function classifyFriedCategories(name, primaryType) {
  const text = (name + " " + primaryType).toLowerCase();
  const cats = [];
  if (/korean|chicken plus|the fry|bb\.q|kokodak|chimaek|韩国|韩式/i.test(text)) {
    cats.push("韩式炸鸡 (Korean Fried Chicken)");
  }
  if (/wings|wing|popeyes|church|kfc|mary brown|fried chicken|buffalo|炸鸡|鸡翅/i.test(text)) {
    cats.push("西式炸鸡/快餐/炸鸡翅 (Western Fried Chicken & Wings)");
  }
  if (/fish and chips|halibut|cod|chips|炸鱼/i.test(text)) {
    cats.push("炸鱼薯条 (Fish & Chips)");
  }
  if (/katsu|tempura|tonkatsu|日式|天妇罗|炸猪排/i.test(text)) {
    cats.push("日式炸物/炸猪排/天妇罗 (Japanese Katsu & Tempura)");
  }
  if (/corn dog|hotdog|churro|churros|donut|rice dog|热狗|吉事果/i.test(text)) {
    cats.push("热狗棒/吉事果/甜甜圈 (Corn Dogs, Churros & Sweets)");
  }
  if (/taiwan|salt and pepper|炸大肠|炸串|串串|盐酥鸡|大鸡排|中餐/i.test(text) || cats.length === 0) {
    cats.push("中式/台式炸物小吃 (Chinese & Taiwanese Fried Snacks)");
  }
  return cats;
}

function deriveKeywords(name, primaryType) {
  const text = (name + " " + primaryType).toLowerCase();
  const kws = [];
  if (/chicken/i.test(text)) kws.push("fried chicken");
  if (/wings/i.test(text)) kws.push("chicken wings");
  if (/korean/i.test(text)) kws.push("korean fried chicken");
  if (/fish|chips/i.test(text)) kws.push("fish and chips");
  if (/katsu/i.test(text)) kws.push("katsu");
  if (/tempura/i.test(text)) kws.push("tempura");
  if (/churro/i.test(text)) kws.push("churros");
  if (/corn dog/i.test(text)) kws.push("korean corn dog");
  if (/盐酥鸡/i.test(name)) kws.push("盐酥鸡");
  if (/炸串/i.test(name)) kws.push("炸串");
  if (kws.length === 0) kws.push("fried food");
  return kws;
}
