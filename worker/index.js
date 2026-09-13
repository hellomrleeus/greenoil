/**
 * Cloudflare Worker for Green Oil Workbench
 * 
 * Features:
 * 1. High-Performance KV Storage for GTA Fried Food Restaurants
 * 2. Server-side Filtering, Search, Sorting, and Pagination
 * 3. Secure Credential Authentication with Cookie & Token (greenoil_session)
 */

const COOKIE_NAME = "greenoil_session";
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days
const KV_CACHE_KEY = "gta_fried_food_restaurants";
const KV_LAST_UPDATED_KEY = "last_updated_time";

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
      if ((url.pathname === "/api/login" || url.pathname === "/api/auth/login") && request.method === "POST") {
        return await handleLogin(request, env, corsHeaders);
      }
      if (url.pathname === "/api/auth/check" && request.method === "GET") {
        return await handleAuthCheck(request, env, corsHeaders);
      }
      if (url.pathname === "/api/logout" && request.method === "POST") {
        return await handleLogout(request, corsHeaders);
      }

      // 2. Cached restaurant query with server-side pagination & filter (Protected)
      if (url.pathname === "/api/restaurants" && request.method === "GET") {
        const isAuthed = checkAuth(request, env);
        if (!isAuthed) {
          return new Response(JSON.stringify({ error: "Unauthorized", message: "未登录或凭据已过期" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        return await handleGetCachedRestaurants(request, env, corsHeaders);
      }

      // 3. Cache status (Protected)
      if (url.pathname === "/api/cache/status" && request.method === "GET") {
        const isAuthed = checkAuth(request, env);
        if (!isAuthed) {
          return new Response(JSON.stringify({ error: "Unauthorized", message: "未登录或凭据已过期" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        return await handleCacheStatus(env, corsHeaders);
      }

      // 4. Sync endpoint notice (Google Maps API sync removed)
      if (url.pathname === "/api/sync") {
        return new Response(JSON.stringify({
          status: "disabled",
          message: "云端在线同步已停用，数据采用本地安全脚本全量采集后灌入 KV"
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 5. Health check
      if (url.pathname === "/" || url.pathname === "/api/health") {
        return new Response(JSON.stringify({
          status: "healthy",
          service: "Green Oil Workbench API",
          storage: "Cloudflare KV",
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
  const validUser = env.WORKER_USERNAME ? env.WORKER_USERNAME.trim() : "";
  if (!validUser) return false;

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

  // 1. Retrieve dataset from KV
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
  let count = 0;
  let lastUpdated = "未同步";

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
    syncMode: "local_ingestion"
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
