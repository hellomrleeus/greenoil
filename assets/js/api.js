/**
 * Green Oil API Client & Data Provider
 * Queries backend cached endpoints with server-side pagination, search, and filtering.
 */

const DEFAULT_WORKER_URL = "https://greenoil-api.ydxhjw4j5w.workers.dev";

export const Api = {
  getWorkerUrl() {
    return DEFAULT_WORKER_URL;
  },

  setWorkerUrl(url) {
    // No-op or optional override
  },

  /**
   * Main Restaurant Query: Calls backend Cloudflare Worker API with pagination, search, and filtering.
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
