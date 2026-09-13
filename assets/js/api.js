/**
 * Green Oil API Client & Data Provider
 * Queries backend cached endpoints with server-side pagination, search, and filtering.
 */

const DEFAULT_WORKER_URL = "https://greenoil-api.ydxhjw4j5w.workers.dev";

export const Api = {
  localCacheData: null,

  getWorkerUrl() {
    return DEFAULT_WORKER_URL;
  },

  setWorkerUrl(url) {
    // No-op or optional override
  },

  /**
   * Load local preloaded dataset (608 records from Excel)
   */
  async loadLocalRestaurants() {
    if (this.localCacheData) return this.localCacheData;
    try {
      const resp = await fetch("assets/data/restaurants.json");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.localCacheData = await resp.json();
      return this.localCacheData;
    } catch (err) {
      console.warn("Local data load failed:", err);
      return [];
    }
  },

  /**
   * Main Restaurant Query: Calls backend cached API with pagination, search, and filtering.
   * Falls back gracefully to local client-side pagination if worker is unconfigured or unreachable.
   */
  async queryRestaurants({
    page = 1,
    pageSize = 20,
    region = "全部 (All GTA)",
    keyword = "",
    category = "全部",
    sort = "rating"
  }) {
    const workerUrl = this.getWorkerUrl();
    const token = localStorage.getItem("greenoil_session_token") || "";

    const url = new URL(`${workerUrl}/api/restaurants`);
    url.searchParams.set("page", page);
    url.searchParams.set("pageSize", pageSize);
    url.searchParams.set("region", region);
    if (keyword) url.searchParams.set("keyword", keyword);
    if (category) url.searchParams.set("category", category);
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
    } catch (err) {
      console.warn("Worker query failed, falling back to local cached engine:", err);
    }

    // Fallback: Perform exact same filtering, sorting, and pagination locally
    const all = await this.loadLocalRestaurants();
    let filtered = all;

    if (region && region !== "全部 (All GTA)") {
      filtered = filtered.filter(r => r.region.includes(region) || region.includes(r.region));
    }

    if (category && category !== "全部") {
      filtered = filtered.filter(r => r.categories && r.categories.some(c => c.includes(category)));
    }

    if (keyword) {
      const kw = keyword.toLowerCase();
      filtered = filtered.filter(r => {
        const text = [r.name, r.address, r.phone, r.keywordsRaw, r.primaryType, r.categoriesRaw].join(" ").toLowerCase();
        return text.includes(kw);
      });
    }

    filtered.sort((a, b) => {
      if (sort === "rating") {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.reviews - a.reviews;
      }
      if (sort === "reviews") return b.reviews - a.reviews;
      if (sort === "name") return a.name.localeCompare(b.name, "zh-CN");
      return 0;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    return {
      source: "local_cache",
      success: true,
      page,
      pageSize,
      total,
      totalPages,
      lastUpdated: "Local Seed (608 Records)",
      data: paginated
    };
  },

  /**
   * Trigger manual background sync on Cloudflare Worker
   */
  async triggerSync() {
    const workerUrl = this.getWorkerUrl();
    const token = localStorage.getItem("greenoil_session_token") || "";

    const resp = await fetch(`${workerUrl}/api/sync`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      credentials: "include"
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Sync failed: HTTP ${resp.status} - ${err}`);
    }

    return await resp.json();
  },

  /**
   * Check Worker health and cache status
   */
  async getCacheStatus() {
    const workerUrl = this.getWorkerUrl();
    const token = localStorage.getItem("greenoil_session_token") || "";
    try {
      const resp = await fetch(`${workerUrl}/api/cache/status`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        credentials: "include"
      });
      if (resp.ok) return await resp.json();
      return null;
    } catch {
      return null;
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
  }
};
