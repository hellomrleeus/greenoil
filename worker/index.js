/**
 * Cloudflare Worker for Green Oil Workbench
 * 
 * Features:
 * 1. Fixed Credential Authentication with Cookie & Token (greenoil_session)
 * 2. Google Maps Places API (New) Proxy for GTA Fried Food Restaurant Search
 * 3. CORS Support for GitHub Pages and Custom Domains
 */

// Default fixed credentials (can be overridden by Cloudflare environment variables)
const DEFAULT_USERNAME = "greenoil";
const DEFAULT_PASSWORD = "greenoil2025";
const COOKIE_NAME = "greenoil_session";
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

// GTA Region Centroids & Coordinates for Location Biasing
const GTA_REGIONS = {
  "万锦 (Markham)": { lat: 43.8561, lng: -79.3370, radius: 10000, name: "Markham" },
  "士嘉堡 (Scarborough)": { lat: 43.7764, lng: -79.2318, radius: 10000, name: "Scarborough" },
  "北约克 (North York)": { lat: 43.7615, lng: -79.4111, radius: 10000, name: "North York" },
  "列治文山 (Richmond Hill)": { lat: 43.8828, lng: -79.4403, radius: 9000, name: "Richmond Hill" },
  "多伦多市中心 (Downtown Toronto)": { lat: 43.6532, lng: -79.3832, radius: 8000, name: "Downtown Toronto" },
  "密西沙加 (Mississauga)": { lat: 43.5890, lng: -79.6441, radius: 12000, name: "Mississauga" },
  "旺市 (Vaughan)": { lat: 43.8563, lng: -79.5085, radius: 11000, name: "Vaughan" },
  "全部 (All GTA)": { lat: 43.7001, lng: -79.4163, radius: 25000, name: "Greater Toronto Area" }
};

export default {
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

    // Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      // Routing
      if (url.pathname === "/api/login" && request.method === "POST") {
        return await handleLogin(request, env, corsHeaders);
      }

      if (url.pathname === "/api/auth/check" && request.method === "GET") {
        return await handleAuthCheck(request, env, corsHeaders);
      }

      if (url.pathname === "/api/logout" && request.method === "POST") {
        return await handleLogout(request, corsHeaders);
      }

      if (url.pathname === "/api/restaurants" && request.method === "GET") {
        return await handleRestaurants(request, env, corsHeaders);
      }

      if (url.pathname === "/" || url.pathname === "/api/health") {
        return new Response(JSON.stringify({
          status: "healthy",
          service: "Green Oil Workbench API",
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

  // Generate simple authenticated session token
  const payload = {
    user: username,
    timestamp: Date.now(),
    role: "greenoil-operator"
  };
  const token = btoa(JSON.stringify(payload));

  // Set-Cookie with SameSite=None; Secure for cross-origin access from GitHub Pages
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

/**
 * Validate incoming cookie or Authorization header
 */
function checkAuth(request, env) {
  // Check Authorization header: Bearer <token>
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

  // Check Cookie
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
 * Handle Restaurant Query via Google Maps Places API (New)
 */
async function handleRestaurants(request, env, corsHeaders) {
  const url = new URL(request.url);
  const regionParam = url.searchParams.get("region") || "万锦 (Markham)";
  const keywordParam = url.searchParams.get("keyword") || "";
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const pageToken = url.searchParams.get("pageToken") || "";

  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: "Google Maps API Key not configured on Cloudflare Worker",
      hint: "Please set GOOGLE_MAPS_API_KEY secret in Cloudflare Worker settings or .dev.vars",
      fallback: true
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const regionInfo = GTA_REGIONS[regionParam] || GTA_REGIONS["全部 (All GTA)"];
  const regionSearchName = regionInfo.name;

  // Search query for fried food restaurants
  const textQuery = keywordParam
    ? `${keywordParam} restaurants in ${regionSearchName}, Ontario, Canada`
    : `fried food fried chicken wings fish and chips katsu restaurants in ${regionSearchName}, Ontario, Canada`;

  const requestBody = {
    textQuery,
    maxResultCount: Math.min(pageSize, 20),
    languageCode: "zh-CN",
    regionCode: "CA",
    locationBias: {
      circle: {
        center: {
          latitude: regionInfo.lat,
          longitude: regionInfo.lng
        },
        radius: regionInfo.radius
      }
    }
  };

  if (pageToken) {
    requestBody.pageToken = pageToken;
  }

  // Field mask specifying all required fields matching the Excel columns
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

  const gmpResp = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask
    },
    body: JSON.stringify(requestBody)
  });

  if (!gmpResp.ok) {
    const errorText = await gmpResp.text();
    return new Response(JSON.stringify({
      success: false,
      error: "Google Maps API error",
      details: errorText
    }), {
      status: gmpResp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const gmpData = await gmpResp.json();
  const rawPlaces = gmpData.places || [];

  // Transform Google Maps Places API (New) response into normalized Excel-like columns
  const restaurants = rawPlaces.map(p => {
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

    // Operating hours
    let openingHours = "未提供";
    if (p.regularOpeningHours?.weekdayDescriptions) {
      openingHours = p.regularOpeningHours.weekdayDescriptions.join("\n");
    }

    // Status
    let status = "未知";
    if (p.currentOpeningHours?.openNow !== undefined) {
      status = p.currentOpeningHours.openNow ? "营业中" : "已打烊";
    }

    // Price Level mapping
    const priceMap = {
      "PRICE_LEVEL_INEXPENSIVE": "$ (经济实惠)",
      "PRICE_LEVEL_MODERATE": "$$ (适中消费)",
      "PRICE_LEVEL_EXPENSIVE": "$$$ (较高消费)",
      "PRICE_LEVEL_VERY_EXPENSIVE": "$$$$ (高档消费)"
    };
    const price = priceMap[p.priceLevel] || "未知";

    // Classify into fried food categories based on name and primary type
    const cats = classifyFriedCategories(name, primaryType);
    const keywords = deriveKeywords(name, primaryType);

    return {
      name,
      region: regionParam,
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
  });

  return new Response(JSON.stringify({
    success: true,
    region: regionParam,
    total: restaurants.length,
    nextPageToken: gmpData.nextPageToken || null,
    restaurants
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Helper to classify restaurant into categories
 */
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

/**
 * Helper to derive keywords
 */
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
