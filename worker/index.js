import * as Database from "./database.js";

/**
 * Cloudflare Worker for Green Oil Workbench
 * 
 * Features:
 * 1. High-Performance D1 Storage for GTA Fried Food Restaurants (KV fallback)
 * 2. Field Sales Visit Records (CRUD in Cloudflare D1, KV fallback)
 * 3. Restaurant Modification & Custom Addition Sync to D1
 * 4. Google Maps Places API (New) & Routes API Proxies
 * 5. Server-side Filtering, Search, Sorting, and Pagination
 * 6. Secure Credential Authentication with Cookie & Token (greenoil_session)
 */

const COOKIE_NAME = "greenoil_session";
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days
const KV_CACHE_KEY = "gta_fried_food_restaurants";
const KV_LAST_UPDATED_KEY = "last_updated_time";
const KV_SALES_KEY = "field_sales_records";
const KV_CUSTOM_REST_KEY = "custom_restaurants_patch";
const KV_ROUTE_KEY = "field_sales_route_waypoints";

export default {
  /**
   * Fetch HTTP Router
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    // Standard CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
      if ((url.pathname === "/api/login" || url.pathname === "/api/auth/login") && request.method === "POST") {
        return await handleLogin(request, env, corsHeaders);
      }
      if (url.pathname === "/api/auth/check" && request.method === "GET") {
        return await handleAuthCheck(request, env, corsHeaders);
      }
      if (url.pathname === "/api/logout" && request.method === "POST") {
        return await handleLogout(request, corsHeaders);
      }

      // All routes below require authentication (except public static configs and place photos)
      const isAuthed = checkAuth(request, env);
      if (!isAuthed && url.pathname !== "/" && url.pathname !== "/api/health" && url.pathname !== "/api/maps/config" && url.pathname !== "/api/places/photo") {
        return new Response(JSON.stringify({ error: "Unauthorized", message: "未登录或凭据已过期" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 2. Cached restaurant query with server-side pagination & filter (Protected)
      if (url.pathname === "/api/restaurants" && request.method === "GET") {
        return await handleGetCachedRestaurants(request, env, corsHeaders);
      }

      // 3. Update restaurant info in D1 (Protected)
      if (url.pathname === "/api/restaurants/update" && request.method === "POST") {
        return await handleUpdateRestaurant(request, env, corsHeaders);
      }

      // 4. Add new restaurant to D1 (Protected)
      if ((url.pathname === "/api/restaurants/add" || url.pathname === "/api/restaurants/batch-add") && request.method === "POST") {
        return await handleAddRestaurant(request, env, corsHeaders);
      }

      // 5. GTA Hubs & Commercial Plazas summary (Protected)
      if (url.pathname === "/api/hubs" && request.method === "GET") {
        return await handleGetHubs(env, corsHeaders);
      }

      // 6. Field Sales Records (Protected)
      if (url.pathname === "/api/sales" && request.method === "GET") {
        return await handleGetSales(request, env, corsHeaders);
      }
      if (url.pathname === "/api/sales" && request.method === "POST") {
        return await handleCreateSale(request, env, corsHeaders);
      }
      if (url.pathname === "/api/sales" && request.method === "PUT") {
        return await handleUpdateSale(request, env, corsHeaders);
      }
      if (url.pathname === "/api/sales" && request.method === "DELETE") {
        return await handleDeleteSale(request, env, corsHeaders);
      }

      // 7. Google Maps Places API Proxy (Protected)
      if (url.pathname === "/api/places/search" && (request.method === "GET" || request.method === "POST")) {
        return await handleGooglePlacesSearch(request, env, corsHeaders);
      }

      if (url.pathname === "/api/places/details" && request.method === "GET") {
        const placeId = url.searchParams.get("placeId") || "";
        if (!/^[A-Za-z0-9_-]{1,256}$/.test(placeId)) return Response.json({ success: false, error: "Invalid place ID" }, { status: 400, headers: corsHeaders });
        const key = env.GOOGLE_MAPS_SERVER_KEY || env.GOOGLE_MAPS_API_KEY;
        if (!key) return Response.json({ success: false, error: "Google Maps API not configured" }, { status: 503, headers: corsHeaders });
        const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
          headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,displayName,formattedAddress,location,primaryType,rating,userRatingCount,nationalPhoneNumber,websiteUri,googleMapsUri,regularOpeningHours,currentOpeningHours,priceLevel,photos,addressComponents" }
        });
        if (!response.ok) return Response.json({ success: false, error: "Unable to load place details" }, { status: response.status, headers: corsHeaders });
        const place = await response.json();
        return Response.json({ success: true, place: transformGooglePlace(place, place.addressComponents?.find(component => component.types?.includes("locality"))?.longText || "GTA") }, { headers: corsHeaders });
      }

      // 7.1. Google Maps Places Photo Proxy / Media Stream (Public / Edge-cached)
      if (url.pathname === "/api/places/photo" && request.method === "GET") {
        return await handlePlacePhoto(request, env, corsHeaders);
      }

      // 8. Route Planning API (Protected)
      if (url.pathname === "/api/routes/plan" && request.method === "POST") {
        return await handlePlanRoute(request, env, corsHeaders);
      }

      // 9. Route Waypoints Persistence API (Protected)
      if (url.pathname === "/api/route" && request.method === "GET") {
        return await handleGetRouteWaypoints(request, env, corsHeaders);
      }
      if (url.pathname === "/api/route" && request.method === "POST") {
        return await handleSaveRouteWaypoints(request, env, corsHeaders);
      }

      // 10. Google Maps Client Config (Frontend Key restricted to Website domain)
      if (url.pathname === "/api/maps/config" && request.method === "GET") {
        return new Response(JSON.stringify({
          apiKey: env.GOOGLE_MAPS_FRONTEND_KEY || env.GOOGLE_MAPS_API_KEY || ""
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 10. Health check
      if (url.pathname === "/" || url.pathname === "/api/health") {
        return new Response(JSON.stringify({
          status: "healthy",
          service: "Green Oil Workbench API",
          storage: env.DB ? "Cloudflare D1" : "Cloudflare KV",
          hasGoogleApiKey: !!env.GOOGLE_MAPS_API_KEY,
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
  const validUsername = env.WORKER_USERNAME ? env.WORKER_USERNAME.trim() : "";
  const validPassword = env.WORKER_PASSWORD ? env.WORKER_PASSWORD.trim() : "";
  const inputUser = (username || "").trim();
  const inputPass = (password || "").trim();

  if (!validUsername || !validPassword || inputUser !== validUsername || inputPass !== validPassword) {
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
    user: { username: env.WORKER_USERNAME || "operator" }
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
  const validUser = env.WORKER_USERNAME ? env.WORKER_USERNAME.trim() : "greenoil";

  function isValidSessionToken(rawToken) {
    if (!rawToken) return false;
    try {
      const decoded = JSON.parse(atob(rawToken));
      if (!decoded || decoded.user !== validUser) return false;
      // Expire session after SESSION_TTL (7 days)
      if (decoded.timestamp && (Date.now() - decoded.timestamp > SESSION_TTL * 1000)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    if (isValidSessionToken(authHeader.substring(7))) return true;
  }

  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map(c => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );
    if (isValidSessionToken(cookies[COOKIE_NAME])) return true;
  }

  return false;
}

/**
 * Helper: Read restaurant dataset with patch overlay
 */
async function getConsolidatedRestaurants(env) {
  let allRestaurants = [];
  let lastUpdated = "未同步";

  if (env.RESTAURANTS_KV) {
    try {
      const cached = await env.RESTAURANTS_KV.get(KV_CACHE_KEY, { type: "json" });
      if (cached && Array.isArray(cached) && cached.length > 0) {
        allRestaurants = cached;
      }
      const updated = await env.RESTAURANTS_KV.get(KV_LAST_UPDATED_KEY);
      if (updated) lastUpdated = updated;

      // Overlay any custom updates or additions
      const patches = await env.RESTAURANTS_KV.get(KV_CUSTOM_REST_KEY, { type: "json" });
      if (patches && typeof patches === "object") {
        if (Array.isArray(patches.added) && patches.added.length > 0) {
          allRestaurants = [...patches.added, ...allRestaurants];
        }
        if (patches.updated && typeof patches.updated === "object" && Object.keys(patches.updated).length > 0) {
          allRestaurants = allRestaurants.map(r => {
            const key = r.placeId || r.name;
            const patch = patches.updated[key];
            return patch ? { ...r, ...patch } : r;
          });
        }
      }

      // Join with field sales visit records
      let salesMap = new Map();
      try {
        const sales = await env.RESTAURANTS_KV.get(KV_SALES_KEY, { type: "json" });
        if (Array.isArray(sales)) {
          sales.forEach(s => {
            if (s.restaurantId) salesMap.set(s.restaurantId.trim().toLowerCase(), s);
            if (s.restaurantName) salesMap.set(s.restaurantName.trim().toLowerCase(), s);
          });
        }
      } catch (err) {
        console.warn("Error reading KV_SALES_KEY in getConsolidatedRestaurants:", err);
      }

      allRestaurants = allRestaurants.map(r => {
        const idKey = (r.placeId || "").trim().toLowerCase();
        const nameKey = (r.name || "").trim().toLowerCase();
        const sale = (idKey && salesMap.get(idKey)) || (nameKey && salesMap.get(nameKey));
        return {
          ...r,
          isVisited: !!sale,
          lastOutcome: sale ? (sale.outcome || "有意向/跟进中") : "未拜访",
          lastVisitTime: sale ? (sale.visitTime || "") : ""
        };
      });
    } catch (e) {
      console.warn("Error reading from RESTAURANTS_KV:", e);
    }
  }

  return { allRestaurants, lastUpdated };
}

/**
 * Get cached restaurants with server-side pagination, search, and filtering
 */
async function handleGetCachedRestaurants(request, env, corsHeaders) {
  if (env.DB) return Database.queryRestaurants(env.DB, new URL(request.url).searchParams, corsHeaders);
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(4000, Math.max(5, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const region = (url.searchParams.get("region") || "全部 (All GTA)").trim();
  const keyword = (url.searchParams.get("keyword") || "").trim().toLowerCase();
  const category = (url.searchParams.get("category") || "全部").trim();
  const hub = (url.searchParams.get("hub") || "").trim();
  const visited = (url.searchParams.get("visited") || "all").trim();
  const outcome = (url.searchParams.get("outcome") || "all").trim();
  const sortBy = (url.searchParams.get("sort") || "rating").trim();
  const isMapFormat = url.searchParams.get("format") === "map";
  const bboxParam = url.searchParams.get("bbox");

  // 1. Retrieve dataset from KV with patches applied
  const { allRestaurants, lastUpdated } = await getConsolidatedRestaurants(env);

  // 2. Apply Region Filter
  let filtered = allRestaurants;
  if (bboxParam) {
    const bbox = bboxParam.split(",").map(Number);
    if (bbox.length !== 4 || bbox.some(Number.isNaN) || bbox[0] < -180 || bbox[2] > 180 || bbox[1] < -90 || bbox[3] > 90 || bbox[0] > bbox[2] || bbox[1] > bbox[3]) {
      return new Response(JSON.stringify({ success: false, error: "Invalid bbox" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    filtered = filtered.filter(r => {
      const lat = Number(r.latitude), lng = Number(r.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= bbox[1] && lat <= bbox[3] && lng >= bbox[0] && lng <= bbox[2];
    });
  }
  if (region && region !== "全部 (All GTA)") {
    filtered = filtered.filter(r => {
      if (hub && hub !== "全部" && hub !== "all") {
        return (r.hubId === hub) || (r.region && (r.region.includes(region) || region.includes(r.region)));
      }
      return r.region && (r.region.includes(region) || region.includes(r.region));
    });
  }

  // 3. Apply Category Filter
  if (category && category !== "全部") {
    filtered = filtered.filter(r => {
      return r.categories && r.categories.some(c => c.includes(category));
    });
  }

  // 4. Apply Hub / Mall Filter
  if (hub && hub !== "全部" && hub !== "all") {
    filtered = filtered.filter(r => {
      return (r.hubId === hub) || 
             (r.hubName && r.hubName.toLowerCase().includes(hub.toLowerCase())) ||
             (r.hubNameEn && r.hubNameEn.toLowerCase().includes(hub.toLowerCase())) ||
             (r.hubNameKo && r.hubNameKo.toLowerCase().includes(hub.toLowerCase()));
    });
  }

  // 5. Apply Visited Status Filter
  if (visited === "visited") {
    filtered = filtered.filter(r => r.isVisited === true);
  } else if (visited === "unvisited") {
    filtered = filtered.filter(r => !r.isVisited);
  }

  // 6. Apply Visit Outcome Filter
  if (outcome && outcome !== "all" && outcome !== "全部") {
    filtered = filtered.filter(r => r.lastOutcome && r.lastOutcome.includes(outcome));
  }

  // 7. Apply Keyword Search
  if (keyword) {
    filtered = filtered.filter(r => {
      const searchTarget = [
        r.name,
        r.address,
        r.phone,
        r.keywordsRaw,
        r.primaryType,
        r.categoriesRaw,
        r.hubName,
        r.hubNameEn,
        r.hubNameKo
      ].join(" ").toLowerCase();
      return searchTarget.includes(keyword);
    });
  }

  // 8. Apply Sorting
  filtered.sort((a, b) => {
    if (sortBy === "rating") {
      if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
      return (b.reviews || 0) - (a.reviews || 0);
    }
    if (sortBy === "reviews") {
      return (b.reviews || 0) - (a.reviews || 0);
    }
    if (sortBy === "name") {
      return (a.name || "").localeCompare(b.name || "", "zh-CN");
    }
    return 0;
  });

  // 9. Pagination Slice
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const paginatedData = filtered.slice(startIndex, startIndex + pageSize);

  const outputData = isMapFormat ? paginatedData.map(r => ({
    placeId: r.placeId,
    name: r.name,
    region: r.region,
    address: r.address,
    phone: r.phone,
    rating: r.rating,
    reviews: r.reviews,
    price: r.price,
    status: r.status,
    categoriesRaw: r.categoriesRaw,
    categories: r.categories,
    latitude: r.latitude,
    longitude: r.longitude,
    hubId: r.hubId,
    hubName: r.hubName,
    mapsUrl: r.mapsUrl,
    isVisited: r.isVisited,
    lastOutcome: r.lastOutcome,
    lastVisitTime: r.lastVisitTime
  })) : paginatedData;

  return new Response(JSON.stringify({
    success: true,
    page,
    pageSize,
    total,
    totalPages,
    lastUpdated,
    data: outputData
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60"
    }
  });
}

/**
 * Update Restaurant information in KV
 */
async function handleUpdateRestaurant(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { placeId, name, updates } = body || {};
  const key = placeId || name;
  if (!key || !updates || typeof updates !== "object") {
    return new Response(JSON.stringify({ success: false, error: "Missing placeId/name or updates object" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (env.DB) return Database.updateRestaurant(env.DB, key, updates, corsHeaders);

  if (env.RESTAURANTS_KV) {
    try {
      let patches = await env.RESTAURANTS_KV.get(KV_CUSTOM_REST_KEY, { type: "json" }) || { added: [], updated: {} };
      patches.updated = patches.updated || {};
      patches.updated[key] = { ...(patches.updated[key] || {}), ...updates, updatedAt: new Date().toISOString() };
      await env.RESTAURANTS_KV.put(KV_CUSTOM_REST_KEY, JSON.stringify(patches));
      await env.RESTAURANTS_KV.put(KV_LAST_UPDATED_KEY, new Date().toISOString());

      return new Response(JSON.stringify({
        success: true,
        message: "餐馆信息已成功更新并同步至云端 KV",
        key,
        updates: patches.updated[key]
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({ success: true, message: "No KV bound, simulated success" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Add a new Restaurant or batch of restaurants to KV (from Google Maps search or manual input)
 */
async function handleAddRestaurant(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const rawList = Array.isArray(body.restaurants) 
    ? body.restaurants 
    : (body.restaurant ? [body.restaurant] : []);

  if (rawList.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "Missing restaurant or restaurants array" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const normalizedList = rawList.map((restaurant, idx) => ({
    name: (restaurant.name || "").trim(),
    region: restaurant.region || "全部 (All GTA)",
    categories: Array.isArray(restaurant.categories) ? restaurant.categories : ["西式炸鸡/快餐/炸鸡翅 (Western Fried Chicken & Wings)"],
    categoriesRaw: restaurant.categoriesRaw || (Array.isArray(restaurant.categories) ? restaurant.categories.join(" | ") : "西式炸鸡/快餐/炸鸡翅 (Western Fried Chicken & Wings)"),
    rating: typeof restaurant.rating === "number" ? restaurant.rating : (parseFloat(restaurant.rating) || 4.2),
    ratingRaw: String(restaurant.rating || "4.2"),
    reviews: parseInt(restaurant.reviews, 10) || 1,
    reviewsRaw: String(restaurant.reviews || "1"),
    status: restaurant.status || "营业中",
    openingHours: restaurant.openingHours || "未提供",
    price: restaurant.price || "$$ (适中消费)",
    address: restaurant.address || "",
    phone: restaurant.phone || "无",
    website: restaurant.website || "",
    mapsUrl: restaurant.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((restaurant.name || "") + " " + (restaurant.address || ""))}`,
    primaryType: restaurant.primaryType || "restaurant",
    keywords: Array.isArray(restaurant.keywords) ? restaurant.keywords : ["fried food"],
    keywordsRaw: restaurant.keywordsRaw || (Array.isArray(restaurant.keywords) ? restaurant.keywords.join(", ") : "fried food"),
    latitude: parseFloat(restaurant.latitude) || 43.76,
    longitude: parseFloat(restaurant.longitude) || -79.41,
    placeId: restaurant.placeId || ("custom_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).slice(2, 7)),
    hubId: restaurant.hubId || "custom_street",
    hubName: restaurant.hubName || "沿街商圈",
    isUserAdded: true,
    addedAt: new Date().toISOString()
  })).filter(r => r.name.length > 0);

  if (normalizedList.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "No valid restaurants provided (name is required)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (env.DB) return Database.saveRestaurants(env.DB, normalizedList, corsHeaders);

  if (env.RESTAURANTS_KV) {
    try {
      let patches = await env.RESTAURANTS_KV.get(KV_CUSTOM_REST_KEY, { type: "json" }) || { added: [], updated: {} };
      patches.added = patches.added || [];

      // Deduplicate each new restaurant by placeId or exact name
      for (const norm of normalizedList) {
        patches.added = patches.added.filter(r => r.placeId !== norm.placeId && r.name.toLowerCase() !== norm.name.toLowerCase());
        patches.added.unshift(norm);
      }

      await env.RESTAURANTS_KV.put(KV_CUSTOM_REST_KEY, JSON.stringify(patches));
      await env.RESTAURANTS_KV.put(KV_LAST_UPDATED_KEY, new Date().toISOString());

      return new Response(JSON.stringify({
        success: true,
        count: normalizedList.length,
        message: normalizedList.length === 1 
          ? "新餐馆已成功添加至云端 KV 数据库" 
          : `已成功将 ${normalizedList.length} 家新餐馆批量保存至云端 KV 数据库`,
        restaurant: normalizedList[0],
        restaurants: normalizedList
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    count: normalizedList.length,
    message: "Added simulated",
    restaurant: normalizedList[0],
    restaurants: normalizedList
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Get GTA Hubs & Commercial Plazas summary
 */
async function handleGetHubs(env, corsHeaders) {
  let hubs = [];
  if (env.RESTAURANTS_KV) {
    try {
      const cached = await env.RESTAURANTS_KV.get("gta_hubs_summary", { type: "json" });
      if (cached && Array.isArray(cached)) hubs = cached;
    } catch (e) {
      console.warn("Error reading gta_hubs_summary from KV:", e);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    total: hubs.length,
    data: hubs
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300"
    }
  });
}

/**
 * Field Sales: Get all visit records from KV
 */
async function handleGetSales(request, env, corsHeaders) {
  if (env.DB) return Database.getSales(env.DB, corsHeaders);
  let records = [];
  if (env.RESTAURANTS_KV) {
    try {
      const cached = await env.RESTAURANTS_KV.get(KV_SALES_KEY, { type: "json" });
      if (cached && Array.isArray(cached)) {
        records = cached;
      }
    } catch (e) {
      console.warn("Error reading KV_SALES_KEY:", e);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    total: records.length,
    data: records
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Field Sales: Create a new visit record in KV
 */
async function handleCreateSale(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const record = body.record;
  if (!record || !record.restaurantName) {
    return new Response(JSON.stringify({ success: false, error: "Missing required sale record fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const now = new Date().toISOString();
  const newRecord = {
    id: record.id || `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    restaurantId: record.restaurantId || "",
    restaurantName: record.restaurantName,
    restaurantAddress: record.restaurantAddress || "",
    restaurantPhone: record.restaurantPhone || "",
    region: record.region || "",
    method: record.method || "onsite", // onsite | phone
    visitTime: record.visitTime || now.slice(0, 13) + ":00",
    outcome: record.outcome || "interested", // interested | contract_signed | rejected | signed_others
    rejectionReason: record.rejectionReason || "",
    rejectionReasonDetails: record.rejectionReasonDetails || "",
    signedOthersReason: record.signedOthersReason || "",
    competitorName: record.competitorName || "",
    competitorQuote: record.competitorQuote || "",
    contractExpiryDate: record.contractExpiryDate || "",
    notes: record.notes || "",
    salesRep: record.salesRep || "greenoil",
    createdAt: now,
    updatedAt: now
  };

  if (env.DB) return Database.createSale(env.DB, newRecord, corsHeaders);

  if (env.RESTAURANTS_KV) {
    try {
      let records = await env.RESTAURANTS_KV.get(KV_SALES_KEY, { type: "json" }) || [];
      records.unshift(newRecord);
      await env.RESTAURANTS_KV.put(KV_SALES_KEY, JSON.stringify(records));

      return new Response(JSON.stringify({
        success: true,
        message: "拜访记录已成功保存到云端 KV",
        record: newRecord
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({ success: true, message: "Simulated sale created", record: newRecord }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Field Sales: Update a visit record in KV
 */
async function handleUpdateSale(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { id, updates } = body || {};
  if (!id || !updates || typeof updates !== "object") {
    return new Response(JSON.stringify({ success: false, error: "Missing record id or updates" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (env.DB) return Database.updateSale(env.DB, id, updates, corsHeaders);

  if (env.RESTAURANTS_KV) {
    try {
      let records = await env.RESTAURANTS_KV.get(KV_SALES_KEY, { type: "json" }) || [];
      let foundIndex = records.findIndex(r => r.id === id);
      if (foundIndex === -1) {
        return new Response(JSON.stringify({ success: false, error: "Record not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      records[foundIndex] = {
        ...records[foundIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await env.RESTAURANTS_KV.put(KV_SALES_KEY, JSON.stringify(records));

      return new Response(JSON.stringify({
        success: true,
        message: "拜访记录已更新",
        record: records[foundIndex]
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({ success: true, message: "Simulated sale updated" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Field Sales: Delete a visit record in KV
 */
async function handleDeleteSale(request, env, corsHeaders) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ success: false, error: "Missing id query parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (env.DB) return Database.deleteSale(env.DB, id, corsHeaders);

  if (env.RESTAURANTS_KV) {
    try {
      let records = await env.RESTAURANTS_KV.get(KV_SALES_KEY, { type: "json" }) || [];
      records = records.filter(r => r.id !== id);
      await env.RESTAURANTS_KV.put(KV_SALES_KEY, JSON.stringify(records));

      return new Response(JSON.stringify({
        success: true,
        message: "拜访记录已删除",
        id
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({ success: true, message: "Simulated sale deleted" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Google Maps Places API Proxy (Places API New)
 */
async function handleGooglePlacesSearch(request, env, corsHeaders) {
  let query = "";

  if (request.method === "GET") {
    const url = new URL(request.url);
    query = (url.searchParams.get("query") || url.searchParams.get("q") || "").trim();
  } else {
    try {
      const body = await request.json();
      query = (body.query || body.q || "").trim();
    } catch {
      query = "";
    }
  }

  if (!query) {
    return new Response(JSON.stringify({ success: false, error: "Missing search query" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const apiKey = env.GOOGLE_MAPS_SERVER_KEY || env.GOOGLE_MAPS_API_KEY || "";
  if (!apiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: "Google Maps API Key not configured on Worker",
      hint: "Run 'npx wrangler secret put GOOGLE_MAPS_API_KEY' to configure your key.",
      fallback: true,
      places: []
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

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
    "places.photos"
  ].join(",");

  let finalQuery = query.trim();
  const qLower = finalQuery.toLowerCase();
  if (!qLower.includes("ontario") && !qLower.includes("canada")) {
    finalQuery = `${finalQuery} Ontario Canada`;
  }

  const gmpBody = {
    textQuery: finalQuery,
    maxResultCount: 20,
    languageCode: "zh-CN",
    regionCode: "CA",
    locationBias: {
      circle: {
        center: { latitude: 43.7282, longitude: -79.3832 }, // Central GTA
        radius: 45000
      }
    }
  };

  try {
    const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
        "Referer": "https://hellomrleeus.github.io/greenoil/"
      },
      body: JSON.stringify(gmpBody)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({
        success: false,
        error: `Google API Error (${resp.status}): ${errText}`
      }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const data = await resp.json();
    const rawPlaces = data.places || [];

    const normalizedPlaces = rawPlaces.map(p => transformGooglePlace(p, "全部 (All GTA)", query, apiKey));
    if (env.DB) await Database.markSavedPlaces(env.DB, normalizedPlaces);

    return new Response(JSON.stringify({
      success: true,
      query,
      count: normalizedPlaces.length,
      places: normalizedPlaces
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: "Failed to query Google Maps Places API: " + err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

/**
 * Route Planning Proxy (Google Routes API / Haversine fallback)
 */
async function handlePlanRoute(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { origin, waypoints, destination } = body || {};
  if (!origin || !destination) {
    return new Response(JSON.stringify({ success: false, error: "Origin and destination required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Generate official Google Maps App navigation deep link
  const originStr = encodeURIComponent(origin.address || origin.name || `${origin.lat},${origin.lng}`);
  const destStr = encodeURIComponent(destination.address || destination.name || `${destination.lat},${destination.lng}`);
  const wpStr = (waypoints || []).map(w => encodeURIComponent(w.address || w.name || `${w.lat},${w.lng}`)).join("|");

  let googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving`;
  if (wpStr) {
    googleMapsUrl += `&waypoints=${wpStr}`;
  }

  const apiKey = env.GOOGLE_MAPS_SERVER_KEY || env.GOOGLE_MAPS_API_KEY || "";
  if (apiKey) {
    try {
      // Call Google Routes API
      const routesBody = {
        origin: {
          address: origin.address || undefined,
          location: (origin.lat && origin.lng) ? { latLng: { latitude: origin.lat, longitude: origin.lng } } : undefined
        },
        destination: {
          address: destination.address || undefined,
          location: (destination.lat && destination.lng) ? { latLng: { latitude: destination.lat, longitude: destination.lng } } : undefined
        },
        intermediates: (waypoints || []).map(w => ({
          address: w.address || undefined,
          location: (w.lat && w.lng) ? { latLng: { latitude: w.lat, longitude: w.lng } } : undefined
        })),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE"
      };

      const resp = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs",
          "Referer": "https://hellomrleeus.github.io/greenoil/"
        },
        body: JSON.stringify(routesBody)
      });

      if (resp.ok) {
        const routeData = await resp.json();
        const primaryRoute = (routeData.routes || [])[0];
        if (primaryRoute) {
          const distanceKm = primaryRoute.distanceMeters ? (primaryRoute.distanceMeters / 1000).toFixed(1) : 0;
          const durationSec = primaryRoute.duration ? parseInt(primaryRoute.duration.replace("s", ""), 10) : 0;
          const durationMins = Math.round(durationSec / 60);

          return new Response(JSON.stringify({
            success: true,
            provider: "google_routes_api",
            distanceKm: parseFloat(distanceKm),
            durationMins,
            googleMapsUrl,
            legs: primaryRoute.legs || []
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
    } catch (e) {
      console.warn("Routes API compute error, falling back to estimation:", e);
    }
  }

  // Fallback calculation via Haversine
  const allPoints = [origin, ...(waypoints || []), destination].filter(p => p && p.lat && p.lng);
  let estDistanceKm = 0;
  for (let i = 0; i < allPoints.length - 1; i++) {
    estDistanceKm += getHaversineDistance(allPoints[i].lat, allPoints[i].lng, allPoints[i + 1].lat, allPoints[i + 1].lng) * 1.35; // 1.35 road winding factor
  }
  const estMins = Math.max(10, Math.round((estDistanceKm / 40) * 60)); // 40 km/h urban average

  return new Response(JSON.stringify({
    success: true,
    provider: "estimation_fallback",
    distanceKm: parseFloat(estDistanceKm.toFixed(1)),
    durationMins: estMins,
    googleMapsUrl
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function transformGooglePlace(p, regionName = "全部 (All GTA)", matchedTerm = "", apiKey = "") {
  const name = p.displayName?.text || "未命名餐馆";
  const address = p.formattedAddress || "";
  const phone = p.nationalPhoneNumber || "无";
  const website = p.websiteUri || "";
  const mapsUrl = p.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${p.id}`;
  const rating = p.rating ? parseFloat(p.rating) : 4.2;
  const reviews = p.userRatingCount ? parseInt(p.userRatingCount, 10) : 0;
  const primaryType = p.primaryType || "restaurant";
  const lat = p.location?.latitude || 43.76;
  const lng = p.location?.longitude || -79.41;

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

  let photoUrl = "";
  let photoReference = "";
  if (p.photos && p.photos.length > 0 && p.photos[0].name) {
    photoReference = p.photos[0].name;
    if (apiKey) {
      photoUrl = `https://places.googleapis.com/v1/${photoReference}/media?maxHeightPx=300&maxWidthPx=300&key=${apiKey}`;
    } else {
      photoUrl = `/api/places/photo?name=${encodeURIComponent(photoReference)}`;
    }
  } else if (p.id) {
    photoUrl = `/api/places/photo?placeId=${encodeURIComponent(p.id)}`;
  }

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
    photoUrl,
    photoReference,
    hubId: "custom_street",
    hubName: "沿街商圈",
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
      "Place ID": p.id,
      "Google 照片 (Photo)": photoUrl
    }
  };
}

/**
 * Google Places Photo Proxy & Redirect Endpoint
 * Supports ?name=places/.../photos/... or ?placeId=ChIJ...
 * Returns 302 redirect directly to Google CDN (lh3.googleusercontent.com)
 * Cached with Cache-Control headers for performance and low API overhead.
 */
async function handlePlacePhoto(request, env, corsHeaders) {
  const url = new URL(request.url);
  const name = (url.searchParams.get("name") || "").trim();
  const placeId = (url.searchParams.get("placeId") || url.searchParams.get("place_id") || "").trim();
  const maxHeight = parseInt(url.searchParams.get("maxHeight") || "300", 10);
  const maxWidth = parseInt(url.searchParams.get("maxWidth") || "300", 10);

  const apiKey = env.GOOGLE_MAPS_SERVER_KEY || env.GOOGLE_MAPS_API_KEY || "";
  if (!apiKey) {
    return new Response("Google Maps API Key not configured", { status: 500, headers: corsHeaders });
  }

  let photoName = name;
  if (!photoName && placeId) {
    try {
      const detailsUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
      const detailsResp = await fetch(detailsUrl, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "photos",
          "Referer": "https://hellomrleeus.github.io/greenoil/"
        }
      });
      if (detailsResp.ok) {
        const d = await detailsResp.json();
        if (d.photos && d.photos.length > 0 && d.photos[0].name) {
          photoName = d.photos[0].name;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch place photos:", err);
    }
  }

  if (!photoName) {
    return new Response("Photo not found", { status: 404, headers: corsHeaders });
  }

  const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeight}&maxWidthPx=${maxWidth}&key=${apiKey}`;
  
  try {
    const photoResp = await fetch(mediaUrl, {
      headers: {
        "Referer": "https://hellomrleeus.github.io/greenoil/"
      },
      redirect: "manual"
    });

    const location = photoResp.headers.get("Location");
    if (location) {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": location,
          "Cache-Control": "public, max-age=86400, s-maxage=604800"
        }
      });
    }

    return new Response(photoResp.body, {
      status: photoResp.status,
      headers: {
        ...corsHeaders,
        "Content-Type": photoResp.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800"
      }
    });
  } catch (err) {
    return new Response("Failed to load photo: " + err.message, { status: 500, headers: corsHeaders });
  }
}

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
  if (/katsu|tempura|tonkatsu|日式|天妇罗|炸猪排/i.test(text)) {
    cats.push("日式炸物/炸猪排/天妇罗 (Japanese Katsu & Tempura)");
  }
  if (/corn dog|hotdog|churro|churros|donut|rice dog|热狗|吉事果/i.test(text)) {
    cats.push("热狗棒/吉事果/甜甜圈 (Corn Dogs, Churros & Sweets)");
  }
  if (/taiwan|salt and pepper|炸大肠|炸串|串串|盐酥鸡|大鸡排|中餐|chinese/i.test(text)) {
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
    { regex: /日式炸猪排/, kw: "日式炸猪排" },
    { regex: /台式大鸡排/, kw: "台式大鸡排" },
    { regex: /korean fried chicken|chimaek/i, kw: "korean fried chicken" },
    { regex: /fried chicken/i, kw: "fried chicken" },
    { regex: /chicken wings|wings/i, kw: "chicken wings" }
  ];

  for (const { regex, kw } of candidates) {
    if (regex.test(text) && !kws.includes(kw)) {
      kws.push(kw);
    }
  }

  if (kws.length === 0) {
    kws.push("fried food");
  }
  return kws;
}

/**
 * Route Waypoints: Get persisted route waypoints from KV
 */
async function handleGetRouteWaypoints(request, env, corsHeaders) {
  if (env.RESTAURANTS_KV) {
    try {
      const data = await env.RESTAURANTS_KV.get(KV_ROUTE_KEY, { type: "json" }) || {
        waypoints: [],
        origin: "Green Oil Inc, Toronto, ON",
        updatedAt: null
      };
      return new Response(JSON.stringify({
        success: true,
        data
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    data: { waypoints: [], origin: "Green Oil Inc, Toronto, ON" }
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Route Waypoints: Save route waypoints to KV
 */
async function handleSaveRouteWaypoints(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const waypoints = Array.isArray(body.waypoints) ? body.waypoints : [];
  const origin = body.origin || "Green Oil Inc, Toronto, ON";
  const now = new Date().toISOString();

  const routeData = {
    waypoints,
    origin,
    updatedAt: now
  };

  if (env.RESTAURANTS_KV) {
    try {
      await env.RESTAURANTS_KV.put(KV_ROUTE_KEY, JSON.stringify(routeData));
      return new Response(JSON.stringify({
        success: true,
        message: "路线途径站点已成功保存到云端 KV",
        data: routeData
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({ success: true, message: "Simulated route saved", data: routeData }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
