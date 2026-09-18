/**
 * Green Oil API Client & Data Provider
 * Queries backend cached endpoints with server-side pagination, search, and filtering.
 * Provides Field Sales CRUD, Google Maps proxy, and Route Planning.
 */

const DEFAULT_WORKER_URL = "https://greenoil-api.ydxhjw4j5w.workers.dev";
let _cachedGoogleApiKey = null;

export const Api = {
  getWorkerUrl() {
    return DEFAULT_WORKER_URL;
  },

  setWorkerUrl(url) {
    // No-op or optional override
  },

  getAuthHeaders() {
    const token = (typeof localStorage !== "undefined" ? localStorage.getItem("greenoil_session_token") : "") || "";
    return {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  },

  /**
   * Main Restaurant Query: Calls backend Cloudflare Worker API with pagination, search, and filtering.
   */
  async queryRestaurants({
    page = 1,
    pageSize = 20,
    region = "全部 (All GTA)",
    hub = "",
    keyword = "",
    category = "全部",
    visited = "all",
    outcome = "all",
    sort = "rating"
  }) {
    const workerUrl = this.getWorkerUrl();
    const token = (typeof localStorage !== "undefined" ? localStorage.getItem("greenoil_session_token") : "") || "";

    const url = new URL(`${workerUrl}/api/restaurants`);
    url.searchParams.set("page", page);
    url.searchParams.set("pageSize", pageSize);
    url.searchParams.set("region", region);
    if (hub && hub !== "全部" && hub !== "all") url.searchParams.set("hub", hub);
    if (keyword) url.searchParams.set("keyword", keyword);
    if (category) url.searchParams.set("category", category);
    if (visited && visited !== "all") url.searchParams.set("visited", visited);
    if (outcome && outcome !== "all" && outcome !== "全部") url.searchParams.set("outcome", outcome);
    if (sort) url.searchParams.set("sort", sort);

    try {
      const resp = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        credentials: "include"
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          return {
            source: "worker_cache",
            ...data
          };
        }
      }

      if (resp.status === 401) {
        console.warn("API 401: Unauthorized");
      }
    } catch (err) {
      console.warn("Worker query failed:", err);
    }

    return {
      source: "worker_cache",
      success: false,
      page,
      pageSize,
      total: 0,
      totalPages: 1,
      lastUpdated: "-",
      data: []
    };
  },

  /**
   * Fetch all/large batch of restaurants for proximity and search lookup
   */
  async queryAllRestaurants(limit = 1000) {
    return await this.queryRestaurants({ page: 1, pageSize: limit, region: "全部 (All GTA)" });
  },

  /**
   * Update restaurant info in Cloudflare KV
   */
  async updateRestaurant(placeId, name, updates) {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/restaurants/update`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ placeId, name, updates })
      });
      return await resp.json();
    } catch (e) {
      console.warn("updateRestaurant failed:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Add a newly discovered restaurant into Cloudflare KV
   */
  async addRestaurant(restaurant) {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/restaurants/add`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ restaurant })
      });
      return await resp.json();
    } catch (e) {
      console.warn("addRestaurant failed:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Batch add multiple restaurants into Cloudflare KV
   */
  async batchAddRestaurants(restaurants) {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/restaurants/batch-add`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ restaurants })
      });
      return await resp.json();
    } catch (e) {
      console.warn("batchAddRestaurants failed:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Get GTA Commercial Hubs & Shopping Malls summary
   */
  async getHubs() {
    const workerUrl = this.getWorkerUrl();
    const token = (typeof localStorage !== "undefined" ? localStorage.getItem("greenoil_session_token") : "") || "";
    try {
      const resp = await fetch(`${workerUrl}/api/hubs`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        credentials: "include"
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) return { success: true, total: data.total, data: data.data || [] };
      }
    } catch (e) {
      console.warn("Worker getHubs failed:", e);
    }
    return { success: false, total: 0, data: [] };
  },

  /**
   * Field Sales: Fetch all sales visit records
   */
  async getSales() {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/sales`, {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include"
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) return data;
      }
    } catch (e) {
      console.warn("getSales failed:", e);
    }
    return { success: false, total: 0, data: [] };
  },

  /**
   * Field Sales: Create a new visit record
   */
  async createSale(record) {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/sales`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ record })
      });
      return await resp.json();
    } catch (e) {
      console.warn("createSale failed:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Field Sales: Update a visit record
   */
  async updateSale(id, updates) {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/sales`, {
        method: "PUT",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ id, updates })
      });
      return await resp.json();
    } catch (e) {
      console.warn("updateSale failed:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Field Sales: Delete a visit record
   */
  async deleteSale(id) {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/sales?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
        credentials: "include"
      });
      return await resp.json();
    } catch (e) {
      console.warn("deleteSale failed:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Search Google Maps Places by Keyword (Proxy)
   */
  async getGooglePlaceDetails(placeId, lang = "zh-CN") {
    try {
      const response = await fetch(`${this.getWorkerUrl()}/api/places/details?placeId=${encodeURIComponent(placeId)}&lang=${encodeURIComponent(lang)}`, {
        headers: this.getAuthHeaders(), credentials: "include"
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async searchGooglePlaces(query, { bounds = null, pageToken = null } = {}) {
    const apiKey = await this.getGoogleMapsApiKey();
    if (!apiKey) {
      return { success: false, error: "API key missing", places: [], nextPageToken: null };
    }

    let finalQuery = (query || "").trim();
    if (!finalQuery) finalQuery = "restaurants";
    const qLower = finalQuery.toLowerCase();
    if (!bounds && !qLower.includes("ontario") && !qLower.includes("canada")) {
      finalQuery = `${finalQuery} Ontario Canada`;
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
      "nextPageToken"
    ].join(",");

    let requestBody;
    if (pageToken && this.lastSearchRequestBody) {
      // Re-use exact same base request body to satisfy Google Places API (New) requirement:
      // "Request parameters for paging requests must match the initial SearchText request."
      requestBody = JSON.parse(JSON.stringify(this.lastSearchRequestBody));
      requestBody.pageToken = pageToken;
    } else {
      let finalQuery = (query || "").trim();
      if (!finalQuery) finalQuery = "restaurants";
      const qLower = finalQuery.toLowerCase();
      if (!bounds && !qLower.includes("ontario") && !qLower.includes("canada")) {
        finalQuery = `${finalQuery} Ontario Canada`;
      }

      requestBody = {
        textQuery: finalQuery,
        pageSize: 20,
        languageCode: "zh-CN",
        regionCode: "CA"
      };

      if (bounds && bounds.sw && bounds.ne) {
        requestBody.locationRestriction = {
          rectangle: {
            low: {
              latitude: Math.min(bounds.sw.lat, bounds.ne.lat),
              longitude: Math.min(bounds.sw.lng, bounds.ne.lng)
            },
            high: {
              latitude: Math.max(bounds.sw.lat, bounds.ne.lat),
              longitude: Math.max(bounds.sw.lng, bounds.ne.lng)
            }
          }
        };
      } else {
        requestBody.locationBias = {
          circle: {
            center: { latitude: 43.7282, longitude: -79.3832 },
            radius: 45000
          }
        };
      }

      // Cache the base request body for subsequent pagination requests
      this.lastSearchRequestBody = JSON.parse(JSON.stringify(requestBody));
    }

    try {
      const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask
        },
        body: JSON.stringify(requestBody)
      });

      if (!resp.ok) {
        const errorDetails = await resp.json().catch(() => null);
        console.warn(`Google Places searchText returned ${resp.status}:`, errorDetails);
        return { success: false, error: `Google API returned ${resp.status}`, places: [], nextPageToken: null };
      }

      const data = await resp.json();
      const rawPlaces = data.places || [];
      const places = rawPlaces.map(p => this.transformGooglePlace(p, apiKey));
      return { success: true, places, nextPageToken: data.nextPageToken || null };
    } catch (e) {
      console.warn("Direct Google Places search failed:", e);
      return { success: false, error: e.message, places: [], nextPageToken: null };
    }
  },

  transformGooglePlace(p, apiKey) {
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

    // Photo media URLs are omitted to prevent 302 redirects to lh3.googleusercontent.com
    // which fail with "无法连接服务器" in restricted/proxy networks and trigger billable Place Photo requests.
    const photoUrl = "";

    const typeCategoryMap = {
      chinese_restaurant: ["中餐", "Chinese"],
      asian_restaurant: ["亚洲菜", "Asian"],
      fast_food_restaurant: ["快餐", "Fast Food"],
      bakery: ["烘焙", "Bakery"],
      cafe: ["咖啡", "Cafe"],
      coffee_shop: ["咖啡", "Coffee Shop"],
      japanese_restaurant: ["日料", "Japanese"],
      korean_restaurant: ["韩餐", "Korean"],
      barbecue_restaurant: ["烧烤", "Barbecue"],
      hot_pot_restaurant: ["火锅", "Hot Pot"],
      seafood_restaurant: ["海鲜", "Seafood"],
      vietnamese_restaurant: ["越南菜", "Vietnamese"],
      thai_restaurant: ["泰国菜", "Thai"],
      indian_restaurant: ["印度菜", "Indian"],
      italian_restaurant: ["意餐", "Italian"],
      mexican_restaurant: ["墨西哥菜", "Mexican"],
      pizza_restaurant: ["披萨", "Pizza"],
      dessert_shop: ["甜品", "Dessert"],
      tea_house: ["茶饮", "Tea House"],
      bar: ["酒吧", "Bar"]
    };
    const categories = typeCategoryMap[primaryType] || ["餐饮美食", primaryType.replace(/_/g, " ")];
    const categoriesRaw = categories.join(" · ");

    return {
      placeId: p.id,
      name,
      address,
      phone,
      website,
      mapsUrl,
      rating,
      ratingRaw: rating ? rating.toString() : "4.2",
      reviews,
      reviewsRaw: reviews.toString(),
      status,
      openingHours,
      price,
      latitude: lat,
      longitude: lng,
      primaryType,
      categories,
      categoriesRaw,
      photoUrl
    };
  },

  /**
   * Plan Route with Google Routes API or Fallback
   */
  async planRoute(origin, destination, waypoints = []) {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/routes/plan`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ origin, destination, waypoints })
      });
      return await resp.json();
    } catch (e) {
      console.warn("planRoute failed:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Get Persisted Route Waypoints from Cloudflare KV
   */
  async getRouteWaypoints() {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/route`, {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include"
      });
      return await resp.json();
    } catch (e) {
      console.warn("getRouteWaypoints failed:", e);
      return { success: false, error: e.message, data: { waypoints: [] } };
    }
  },

  /**
   * Save Route Waypoints to Cloudflare KV
   */
  async saveRouteWaypoints(waypoints = [], origin = "Green Oil Inc, Toronto, ON", tabs = null, activeTabId = null) {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/route`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ waypoints, origin, tabs, activeTabId })
      });
      return await resp.json();
    } catch (e) {
      console.warn("saveRouteWaypoints failed:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Map Explorer: Get Persisted Grouped Routes from Cloudflare KV (New Dedicated Endpoint)
   */
  async getMapRoutes() {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/map-routes`, {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include"
      });
      return await resp.json();
    } catch (e) {
      console.warn("getMapRoutes failed:", e);
      return { success: false, error: e.message, data: { groups: [] } };
    }
  },

  /**
   * Map Explorer: Save Grouped Routes to Cloudflare KV (New Dedicated Endpoint)
   */
  async saveMapRoutes(groups = [], activeGroupId = null, origin = "Green Oil Inc, Toronto, ON") {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/map-routes`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ groups, activeGroupId, origin })
      });
      return await resp.json();
    } catch (e) {
      console.warn("saveMapRoutes failed:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Remote login against Cloudflare Worker backend
   */
  async login(username, password) {
    const workerUrl = this.getWorkerUrl();
    const resp = await fetch(`${workerUrl}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    return await resp.json();
  },

  /**
   * Get Google Maps API Key from worker config (Requires active user session)
   */
  async getGoogleMapsApiKey() {
    if (_cachedGoogleApiKey) return _cachedGoogleApiKey;
    try {
      const resp = await fetch(`${this.getWorkerUrl()}/api/maps/config`, {
        headers: this.getAuthHeaders()
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.apiKey) {
          _cachedGoogleApiKey = data.apiKey;
          return _cachedGoogleApiKey;
        }
      } else if (resp.status === 401) {
        console.warn("Google Maps API Key requires active login. Please sign in first.");
      }
    } catch (e) {
      console.warn("Failed to fetch Google Maps config from worker:", e);
    }
    return "";
  },

  clearGoogleMapsApiKey() {
    _cachedGoogleApiKey = null;
  },

  /**
   * Get one bounded, paginated restaurant page for the map explorer.
   */
  async getMapRestaurants({ bbox, page = 1, category = "全部", keyword = "", visited = "all", outcome = "all", signal } = {}) {
    const url = new URL(`${this.getWorkerUrl()}/api/restaurants`);
    url.searchParams.set("page", page);
    // D1 applies the viewport bbox in SQL; return the complete visible set in one response.
    url.searchParams.set("pageSize", "5000");
    url.searchParams.set("format", "map");
    if (!Array.isArray(bbox) || bbox.length !== 4) throw new Error("Map bounds required");
    url.searchParams.set("bbox", bbox.join(","));
    url.searchParams.set("category", category);
    url.searchParams.set("keyword", keyword);
    url.searchParams.set("visited", visited);
    url.searchParams.set("outcome", outcome);
    const response = await fetch(url, { headers: this.getAuthHeaders(), signal });
    if (!response.ok) throw new Error(`Map query failed (${response.status})`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Map query failed");
    return result;
  }
};
