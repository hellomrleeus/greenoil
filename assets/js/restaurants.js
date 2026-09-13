/**
 * Green Oil Restaurant Query & Details Manager
 * Displays GTA fried food restaurants matching the 17 Excel columns.
 */

import { Api } from "./api.js";

export const Restaurants = {
  allRestaurants: [],
  filteredRestaurants: [],
  activeRegion: "全部 (All GTA)",
  activeCategory: "全部",
  searchQuery: "",
  sortBy: "rating", // rating, reviews, name
  viewMode: "cards", // cards or table
  selectedRestaurant: null,

  async init() {
    this.bindEvents();
    await this.loadInitialData();
  },

  bindEvents() {
    // Region selector
    const regionSelect = document.getElementById("regionSelect");
    if (regionSelect) {
      regionSelect.addEventListener("change", (e) => {
        this.activeRegion = e.target.value;
        this.handleRegionChange();
      });
    }

    // Search input
    const searchInput = document.getElementById("restaurantSearch");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.applyFilters();
      });
    }

    // Sort selector
    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this.sortBy = e.target.value;
        this.applyFilters();
      });
    }

    // Category pills
    const categoryContainer = document.getElementById("categoryPills");
    if (categoryContainer) {
      categoryContainer.addEventListener("click", (e) => {
        const pill = e.target.closest(".cat-pill");
        if (!pill) return;
        document.querySelectorAll(".cat-pill").forEach(el => el.classList.remove("active"));
        pill.classList.add("active");
        this.activeCategory = pill.dataset.category;
        this.applyFilters();
      });
    }

    // View toggles
    const btnCardView = document.getElementById("btnCardView");
    const btnTableView = document.getElementById("btnTableView");
    if (btnCardView && btnTableView) {
      btnCardView.addEventListener("click", () => {
        this.viewMode = "cards";
        btnCardView.classList.add("active");
        btnTableView.classList.remove("active");
        this.render();
      });
      btnTableView.addEventListener("click", () => {
        this.viewMode = "table";
        btnTableView.classList.add("active");
        btnCardView.classList.remove("active");
        this.render();
      });
    }

    // Export CSV
    const btnExport = document.getElementById("btnExportCsv");
    if (btnExport) {
      btnExport.addEventListener("click", () => this.exportCsv());
    }

    // Live search button
    const btnLiveSearch = document.getElementById("btnLiveSearch");
    if (btnLiveSearch) {
      btnLiveSearch.addEventListener("click", () => this.fetchFromWorker());
    }

    // Modal close
    const modalClose = document.getElementById("detailModalClose");
    const modalOverlay = document.getElementById("detailModalOverlay");
    if (modalClose && modalOverlay) {
      modalClose.addEventListener("click", () => this.closeDetailModal());
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) this.closeDetailModal();
      });
    }

    // Import to calculator from modal
    const btnImportCalc = document.getElementById("btnModalImportCalc");
    if (btnImportCalc) {
      btnImportCalc.addEventListener("click", () => {
        if (this.selectedRestaurant) {
          window.importRestaurantToCalculator(this.selectedRestaurant);
          this.closeDetailModal();
        }
      });
    }
  },

  async loadInitialData() {
    const loader = document.getElementById("restaurantListLoader");
    if (loader) loader.style.display = "block";

    try {
      // Load pre-extracted local database (608 restaurants)
      const data = await Api.loadLocalRestaurants();
      this.allRestaurants = data;
      this.applyFilters();
    } catch (err) {
      console.error("Failed to load restaurant data:", err);
    } finally {
      if (loader) loader.style.display = "none";
    }
  },

  async handleRegionChange() {
    // If user chooses regions other than Markham/Scarborough/All, offer to fetch via Cloudflare Worker
    const isLocalRegion = ["万锦 (Markham)", "士嘉堡 (Scarborough)", "全部 (All GTA)"].includes(this.activeRegion);
    if (!isLocalRegion) {
      await this.fetchFromWorker();
    } else {
      this.applyFilters();
    }
  },

  async fetchFromWorker() {
    const liveBtn = document.getElementById("btnLiveSearch");
    if (liveBtn) {
      liveBtn.disabled = true;
      liveBtn.innerHTML = `<span>⏳ 正在查询 Google Maps...</span>`;
    }

    try {
      const results = await Api.fetchLiveRestaurants(this.activeRegion, this.searchQuery);
      if (results && results.length > 0) {
        // Merge or replace for this region
        const others = this.allRestaurants.filter(r => r.region !== this.activeRegion);
        this.allRestaurants = [...results, ...others];
        this.applyFilters();
        this.showToast(`已从 Google Maps API 检索到 ${results.length} 家餐馆！`);
      } else {
        this.applyFilters();
        this.showToast("未检索到更多餐馆，显示现有数据");
      }
    } catch (err) {
      console.warn("Live worker search error:", err);
      this.showToast(`在线查询提示: ${err.message} (展示离线数据库)`);
      this.applyFilters();
    } finally {
      if (liveBtn) {
        liveBtn.disabled = false;
        liveBtn.innerHTML = `<span>🔍 实时刷新</span>`;
      }
    }
  },

  applyFilters() {
    let list = [...this.allRestaurants];

    // Region filter
    if (this.activeRegion !== "全部 (All GTA)") {
      list = list.filter(r => r.region.includes(this.activeRegion) || this.activeRegion.includes(r.region));
    }

    // Category filter
    if (this.activeCategory !== "全部") {
      list = list.filter(r => {
        return r.categories && r.categories.some(c => c.includes(this.activeCategory));
      });
    }

    // Text search (name, keywords, address, phone)
    if (this.searchQuery) {
      list = list.filter(r => {
        const text = [
          r.name,
          r.address,
          r.phone,
          r.keywordsRaw,
          r.primaryType
        ].join(" ").toLowerCase();
        return text.includes(this.searchQuery);
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (this.sortBy === "rating") {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.reviews - a.reviews;
      }
      if (this.sortBy === "reviews") {
        return b.reviews - a.reviews;
      }
      if (this.sortBy === "name") {
        return a.name.localeCompare(b.name, "zh-CN");
      }
      return 0;
    });

    this.filteredRestaurants = list;
    this.render();
  },

  render() {
    // Update count
    const countEl = document.getElementById("resultsCountNum");
    if (countEl) countEl.textContent = this.filteredRestaurants.length;

    const cardsContainer = document.getElementById("restaurantCardsView");
    const tableContainer = document.getElementById("restaurantTableView");

    if (this.viewMode === "cards") {
      if (cardsContainer) cardsContainer.style.display = "grid";
      if (tableContainer) tableContainer.style.display = "none";
      this.renderCards();
    } else {
      if (cardsContainer) cardsContainer.style.display = "none";
      if (tableContainer) tableContainer.style.display = "block";
      this.renderTable();
    }
  },

  renderCards() {
    const container = document.getElementById("restaurantCardsView");
    if (!container) return;

    if (this.filteredRestaurants.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <div style="font-weight: 600; font-size: 1.1rem;">没有找到匹配的餐馆</div>
          <div style="font-size: 0.85rem; margin-top: 0.25rem;">请尝试更换区域、清除搜索词或点击“实时刷新”</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.filteredRestaurants.map((r, idx) => {
      const statusClass = r.status === "营业中" ? "status-open" : (r.status === "已打烊" ? "status-closed" : "status-unknown");
      const stars = "★".repeat(Math.round(r.rating || 0)) + "☆".repeat(5 - Math.round(r.rating || 0));

      return `
        <div class="restaurant-card" data-idx="${idx}">
          <div class="card-top">
            <h4 class="rest-name">${this.escapeHtml(r.name)}</h4>
            <span class="status-badge ${statusClass}">${r.status}</span>
          </div>

          <div class="card-rating-row">
            <span class="stars" title="评分: ${r.rating}">★ ${r.rating ? r.rating.toFixed(1) : '无'}</span>
            <span class="reviews-count">(${r.reviews}条评价)</span>
            <span class="price-tag">${r.price || '价格未明'}</span>
          </div>

          <div class="card-region-category">
            <div>📍 <b>${this.escapeHtml(r.region)}</b></div>
            <div class="card-category-text" title="${this.escapeHtml(r.categoriesRaw)}">🍗 ${this.escapeHtml(r.categoriesRaw || '油炸餐饮')}</div>
          </div>

          <div class="card-address-row">
            <span>📫 ${this.escapeHtml(r.address)}</span>
          </div>

          ${r.phone && r.phone !== "无" ? `
            <div class="card-phone-row">
              <span>📞 ${this.escapeHtml(r.phone)}</span>
            </div>
          ` : ''}

          <div class="card-footer-actions">
            <span style="font-size: 0.75rem; color: var(--text-light);">查看 17 项详情 &gt;</span>
            <button class="btn-calc-oil" onclick="event.stopPropagation(); window.importRestaurantByIndex(${idx});">
              ⚡ 计算月用油
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Bind card click for details modal
    container.querySelectorAll(".restaurant-card").forEach(card => {
      card.addEventListener("click", () => {
        const idx = parseInt(card.dataset.idx, 10);
        this.openDetailModal(this.filteredRestaurants[idx]);
      });
    });
  },

  renderTable() {
    const tbody = document.getElementById("restaurantTableBody");
    if (!tbody) return;

    if (this.filteredRestaurants.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem;">无匹配餐馆数据</td></tr>`;
      return;
    }

    tbody.innerHTML = this.filteredRestaurants.map((r, idx) => {
      const statusClass = r.status === "营业中" ? "status-open" : (r.status === "已打烊" ? "status-closed" : "status-unknown");
      return `
        <tr style="cursor: pointer;" onclick="window.openRestaurantDetailByIndex(${idx})">
          <td class="col-name">${this.escapeHtml(r.name)}</td>
          <td>${this.escapeHtml(r.region)}</td>
          <td class="col-category" title="${this.escapeHtml(r.categoriesRaw)}">${this.escapeHtml(r.categoriesRaw)}</td>
          <td><b>★ ${r.rating ? r.rating.toFixed(1) : '-'}</b> (${r.reviews})</td>
          <td><span class="status-badge ${statusClass}">${r.status}</span></td>
          <td>${this.escapeHtml(r.price)}</td>
          <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(r.address)}</td>
          <td>${this.escapeHtml(r.phone)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.importRestaurantByIndex(${idx});">
              计算用油
            </button>
          </td>
        </tr>
      `;
    }).join("");
  },

  openDetailModal(r) {
    if (!r) return;
    this.selectedRestaurant = r;

    document.getElementById("modalRestName").textContent = r.name;
    document.getElementById("modalRestRegion").textContent = r.region;
    document.getElementById("modalRestCategory").textContent = r.categoriesRaw;
    document.getElementById("modalRestRating").innerHTML = `★ ${r.rating ? r.rating.toFixed(1) : '无'} <span style="color:var(--text-muted); font-weight:normal;">(${r.reviews} 评价)</span>`;
    document.getElementById("modalRestStatus").textContent = r.status;
    document.getElementById("modalRestPrice").textContent = r.price;
    document.getElementById("modalRestAddress").textContent = r.address;
    document.getElementById("modalRestPhone").textContent = r.phone;
    
    // Call button
    const phoneBtn = document.getElementById("modalBtnPhone");
    if (phoneBtn) {
      if (r.phone && r.phone !== "无") {
        phoneBtn.href = `tel:${r.phone.replace(/[^0-9+]/g, '')}`;
        phoneBtn.style.display = "inline-flex";
      } else {
        phoneBtn.style.display = "none";
      }
    }

    // Website button
    const webBtn = document.getElementById("modalBtnWebsite");
    if (webBtn) {
      if (r.website) {
        webBtn.href = r.website;
        webBtn.style.display = "inline-flex";
      } else {
        webBtn.style.display = "none";
      }
    }

    // Google Maps Link
    const mapsBtn = document.getElementById("modalBtnMaps");
    if (mapsBtn) {
      if (r.mapsUrl) {
        mapsBtn.href = r.mapsUrl;
      } else {
        mapsBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + r.address)}`;
      }
    }

    // Hours
    document.getElementById("modalRestHours").textContent = r.openingHours || "未提供营业时间";

    // Primary type & Keywords
    document.getElementById("modalRestType").textContent = r.primaryType || "restaurant";
    document.getElementById("modalRestKeywords").textContent = r.keywordsRaw || "fried food";
    document.getElementById("modalRestPlaceId").textContent = r.placeId || "N/A";
    document.getElementById("modalRestCoordinates").textContent = (r.latitude && r.longitude) ? `${r.latitude}, ${r.longitude}` : "N/A";

    const modal = document.getElementById("detailModalOverlay");
    if (modal) modal.classList.add("active");
  },

  closeDetailModal() {
    const modal = document.getElementById("detailModalOverlay");
    if (modal) modal.classList.remove("active");
    this.selectedRestaurant = null;
  },

  exportCsv() {
    if (this.filteredRestaurants.length === 0) {
      alert("当前没有可导出的餐馆数据！");
      return;
    }

    const headers = [
      "餐馆名称 (Name)",
      "所属区域 (Region)",
      "油炸分类 (Categories)",
      "评分 (Rating)",
      "评价总数 (Reviews)",
      "当前营业状态 (Status)",
      "营业时间 (Opening Hours)",
      "消费档次 (Price)",
      "详细地址 (Address)",
      "联系电话 (Phone)",
      "官方网站 (Website)",
      "Google 地图链接 (Maps URL)",
      "主营类型 (Primary Type)",
      "匹配关键词 (Keywords)",
      "纬度 (Latitude)",
      "经度 (Longitude)",
      "Place ID"
    ];

    const rows = this.filteredRestaurants.map(r => {
      return [
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.region || '').replace(/"/g, '""')}"`,
        `"${(r.categoriesRaw || '').replace(/"/g, '""')}"`,
        `"${r.rating || ''}"`,
        `"${r.reviews || '0'}"`,
        `"${(r.status || '').replace(/"/g, '""')}"`,
        `"${(r.openingHours || '').replace(/"/g, '""')}"`,
        `"${(r.price || '').replace(/"/g, '""')}"`,
        `"${(r.address || '').replace(/"/g, '""')}"`,
        `"${(r.phone || '').replace(/"/g, '""')}"`,
        `"${(r.website || '').replace(/"/g, '""')}"`,
        `"${(r.mapsUrl || '').replace(/"/g, '""')}"`,
        `"${(r.primaryType || '').replace(/"/g, '""')}"`,
        `"${(r.keywordsRaw || '').replace(/"/g, '""')}"`,
        `"${r.latitude || ''}"`,
        `"${r.longitude || ''}"`,
        `"${(r.placeId || '').replace(/"/g, '""')}"`
      ].join(",");
    });

    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `greenoil_restaurants_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  showToast(msg) {
    let toast = document.getElementById("appToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "appToast";
      toast.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: #0f172a; color: white; padding: 10px 18px; border-radius: 8px;
        font-size: 0.85rem; z-index: 200; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transition: opacity 0.3s ease; opacity: 0;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    setTimeout(() => {
      toast.style.opacity = "0";
    }, 2800);
  }
};

// Global helper bindings for inline onclicks
window.openRestaurantDetailByIndex = function(idx) {
  Restaurants.openDetailModal(Restaurants.filteredRestaurants[idx]);
};

window.importRestaurantByIndex = function(idx) {
  const rest = Restaurants.filteredRestaurants[idx];
  if (rest && window.importRestaurantToCalculator) {
    window.importRestaurantToCalculator(rest);
  }
};
