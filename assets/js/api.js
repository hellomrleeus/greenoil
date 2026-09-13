/**
 * Green Oil API Client & Data Provider
 * Queries backend cached endpoints with server-side pagination, search, and filtering.
 * Provides Field Sales CRUD, Google Maps proxy, and Route Planning.
 */

const DEFAULT_WORKER_URL = "https://greenoil-api.ydxhjw4j5w.workers.dev";

export const Api = {
  getWorkerUrl() {
    return DEFAULT_WORKER_URL;
  },

  setWorkerUrl(url) {
    // No-op or optional override
  },

  getAuthHeaders() {
    const token = localStorage.getItem("greenoil_session_token") || "";
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
    const token = localStorage.getItem("greenoil_session_token") || "";

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
    const token = localStorage.getItem("greenoil_session_token") || "";
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
  async searchGooglePlaces(query) {
    const workerUrl = this.getWorkerUrl();
    try {
      const url = new URL(`${workerUrl}/api/places/search`);
      url.searchParams.set("query", query);
      const resp = await fetch(url.toString(), {
        method: "GET",
        headers: this.getAuthHeaders(),
        credentials: "include"
      });
      return await resp.json();
    } catch (e) {
      console.warn("searchGooglePlaces failed:", e);
      return { success: false, error: e.message, places: [] };
    }
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
  async saveRouteWaypoints(waypoints = [], origin = "Green Oil Inc, Toronto, ON") {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/route`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ waypoints, origin })
      });
      return await resp.json();
    } catch (e) {
      console.warn("saveRouteWaypoints failed:", e);
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
   * Get Google Maps API Key from worker config or fallback
   */
  async getGoogleMapsApiKey() {
    try {
      const resp = await fetch(`${this.getWorkerUrl()}/api/maps/config`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.apiKey) return data.apiKey;
      }
    } catch (e) {}
    return "";
  },

  /**
   * Get all restaurants for map explorer (lightweight format, up to 3500 items)
   */
  async getMapRestaurants({ region = "全部 (All GTA)", category = "全部", keyword = "" } = {}) {
    const workerUrl = this.getWorkerUrl();
    const token = localStorage.getItem("greenoil_session_token") || "";

    const url = new URL(`${workerUrl}/api/restaurants`);
    url.searchParams.set("page", "1");
    url.searchParams.set("pageSize", "3500");
    url.searchParams.set("format", "map");
    if (region && region !== "全部 (All GTA)") url.searchParams.set("region", region);
    if (category && category !== "全部") url.searchParams.set("category", category);
    if (keyword) url.searchParams.set("keyword", keyword);

    try {
      const resp = await fetch(url.toString(), {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (resp.ok) {
        const res = await resp.json();
        if (res && res.data) return res.data;
      }
    } catch (e) {
      console.error("Failed to load map restaurants:", e);
    }
    return [];
  }
};
