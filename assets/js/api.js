/**
 * Green Oil API Client & Data Provider
 * Coordinates offline preloaded datasets and online Cloudflare Worker search.
 */

const DEFAULT_WORKER_URL = "https://greenoil-api.workers.dev"; // Placeholder or user configured

export const Api = {
  getWorkerUrl() {
    return localStorage.getItem("greenoil_worker_url") || DEFAULT_WORKER_URL;
  },

  setWorkerUrl(url) {
    localStorage.setItem("greenoil_worker_url", url.trim().replace(/\/$/, ""));
  },

  /**
   * Load local preloaded dataset (608 records from Excel)
   */
  async loadLocalRestaurants() {
    try {
      const resp = await fetch("assets/data/restaurants.json");
      if (!resp.ok) {
        throw new Error(`Failed to load local data: ${resp.status}`);
      }
      return await resp.json();
    } catch (err) {
      console.warn("Local data load failed:", err);
      return [];
    }
  },

  /**
   * Live search via Cloudflare Worker -> Google Maps Places API
   */
  async fetchLiveRestaurants(region, keyword = "") {
    const workerUrl = this.getWorkerUrl();
    const targetUrl = new URL(`${workerUrl}/api/restaurants`);
    targetUrl.searchParams.set("region", region);
    if (keyword) {
      targetUrl.searchParams.set("keyword", keyword);
    }

    const token = localStorage.getItem("greenoil_session_token") || "";

    const resp = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      credentials: "include"
    });

    if (!resp.ok) {
      throw new Error(`Worker HTTP ${resp.status}`);
    }

    const data = await resp.json();
    if (!data.success) {
      throw new Error(data.error || "Worker query failed");
    }

    return data.restaurants || [];
  },

  /**
   * Check Worker health
   */
  async checkWorkerHealth() {
    const workerUrl = this.getWorkerUrl();
    try {
      const resp = await fetch(`${workerUrl}/api/health`, { method: "GET" });
      return resp.ok;
    } catch {
      return false;
    }
  }
};
