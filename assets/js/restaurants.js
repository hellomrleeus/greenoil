/**
 * Green Oil Restaurant Query & Details Manager
 */

import { Api } from "./api.js";

export const Restaurants = {
  currentPageData: [],
  selectedMap: new Map(),
  currentPage: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  activeRegion: "全部 (All GTA)",
  activeCategory: "全部",
  searchQuery: "",
  sortBy: "rating",
  viewMode: "cards",
  selectedRestaurant: null,

  async init() {
    this.bindEvents();
    await this.fetchData();
  },

  bindEvents() {
    const regionSelect = document.getElementById("regionSelect");
    if (regionSelect) {
      regionSelect.addEventListener("change", (e) => {
        this.activeRegion = e.target.value;
        this.currentPage = 1;
        this.fetchData();
      });
    }

    const searchInput = document.getElementById("restaurantSearch");
    let searchDebounceTimer = null;
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          this.searchQuery = e.target.value.trim().toLowerCase();
          this.currentPage = 1;
          this.fetchData();
        }, 300);
      });
    }

    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this.sortBy = e.target.value;
        this.currentPage = 1;
        this.fetchData();
      });
    }

    const categoryContainer = document.getElementById("categoryPills");
    if (categoryContainer) {
      categoryContainer.addEventListener("click", (e) => {
        const pill = e.target.closest(".cat-pill");
        if (!pill) return;
        document.querySelectorAll(".cat-pill").forEach(el => el.classList.remove("active"));
        pill.classList.add("active");
        this.activeCategory = pill.dataset.category;
        this.currentPage = 1;
        this.fetchData();
      });
    }

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

    const pageSizeSelect = document.getElementById("pageSizeSelect");
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener("change", (e) => {
        this.pageSize = parseInt(e.target.value, 10) || 20;
        this.currentPage = 1;
        this.fetchData();
      });
    }

    const btnExportSelected = document.getElementById("btnExportSelected");
    if (btnExportSelected) {
      btnExportSelected.addEventListener("click", () => this.exportSelectedExcel());
    }

    const btnExportTop = document.getElementById("btnExportCsv");
    if (btnExportTop) {
      btnExportTop.addEventListener("click", () => this.exportSelectedExcel());
    }

    const btnSelectAllPage = document.getElementById("btnSelectAllPage");
    if (btnSelectAllPage) {
      btnSelectAllPage.addEventListener("click", () => this.toggleSelectCurrentPage());
    }

    const thSelectAll = document.getElementById("thSelectAll");
    if (thSelectAll) {
      thSelectAll.addEventListener("change", (e) => {
        this.setSelectCurrentPage(e.target.checked);
      });
    }

    const btnClearSelection = document.getElementById("btnClearSelection");
    if (btnClearSelection) {
      btnClearSelection.addEventListener("click", () => this.clearSelection());
    }

    const modalClose = document.getElementById("detailModalClose");
    const modalOverlay = document.getElementById("detailModalOverlay");
    if (modalClose && modalOverlay) {
      modalClose.addEventListener("click", () => this.closeDetailModal());
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) this.closeDetailModal();
      });
    }

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

  async fetchData() {
    const loader = document.getElementById("restaurantListLoader");
    if (loader) loader.style.display = "block";

    try {
      const res = await Api.queryRestaurants({
        page: this.currentPage,
        pageSize: this.pageSize,
        region: this.activeRegion,
        keyword: this.searchQuery,
        category: this.activeCategory,
        sort: this.sortBy
      });

      this.currentPageData = res.data || [];
      this.total = res.total || 0;
      this.totalPages = res.totalPages || 1;
      this.currentPage = res.page || 1;

      const countEl = document.getElementById("resultsCountNum");
      if (countEl) countEl.textContent = this.total;

      this.render();
      this.renderPagination();
      this.updateSelectionUI();
    } catch (err) {
      console.error("Fetch data error:", err);
      this.showToast("查询失败");
    } finally {
      if (loader) loader.style.display = "none";
    }
  },

  toggleSelect(restaurant) {
    const key = restaurant.placeId || restaurant.name;
    if (this.selectedMap.has(key)) {
      this.selectedMap.delete(key);
    } else {
      this.selectedMap.set(key, restaurant);
    }
    this.updateSelectionUI();
    this.updateCardAndRowSelectionStyles();
  },

  setSelectCurrentPage(shouldSelect) {
    this.currentPageData.forEach(r => {
      const key = r.placeId || r.name;
      if (shouldSelect) {
        this.selectedMap.set(key, r);
      } else {
        this.selectedMap.delete(key);
      }
    });
    this.updateSelectionUI();
    this.updateCardAndRowSelectionStyles();
  },

  toggleSelectCurrentPage() {
    const allSelected = this.currentPageData.length > 0 && this.currentPageData.every(r => this.selectedMap.has(r.placeId || r.name));
    this.setSelectCurrentPage(!allSelected);
  },

  clearSelection() {
    this.selectedMap.clear();
    this.updateSelectionUI();
    this.updateCardAndRowSelectionStyles();
  },

  updateSelectionUI() {
    const count = this.selectedMap.size;
    const selectionBar = document.getElementById("selectionBar");
    const countSpan = document.getElementById("selectionCountBadge");
    const exportBtnText = document.getElementById("btnExportSelectedText");

    if (countSpan) countSpan.textContent = count;
    if (exportBtnText) exportBtnText.textContent = `导出所选 (${count})`;

    if (selectionBar) {
      if (count > 0) {
        selectionBar.classList.add("active");
      } else {
        selectionBar.classList.remove("active");
      }
    }

    const thSelectAll = document.getElementById("thSelectAll");
    if (thSelectAll) {
      const allCurrentSelected = this.currentPageData.length > 0 && this.currentPageData.every(r => this.selectedMap.has(r.placeId || r.name));
      thSelectAll.checked = allCurrentSelected;
      thSelectAll.indeterminate = !allCurrentSelected && this.currentPageData.some(r => this.selectedMap.has(r.placeId || r.name));
    }
  },

  updateCardAndRowSelectionStyles() {
    document.querySelectorAll(".restaurant-card").forEach(card => {
      const key = card.dataset.key;
      const isSel = this.selectedMap.has(key);
      card.classList.toggle("is-selected", isSel);
      const cb = card.querySelector(".card-select-cb");
      if (cb) cb.checked = isSel;
    });

    document.querySelectorAll("#restaurantTableBody tr").forEach(row => {
      const key = row.dataset.key;
      const isSel = this.selectedMap.has(key);
      row.classList.toggle("is-selected", isSel);
      const cb = row.querySelector(".row-select-cb");
      if (cb) cb.checked = isSel;
    });
  },

  render() {
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

    if (this.currentPageData.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-weight: 600; font-size: 1rem;">无匹配餐馆</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.currentPageData.map((r, idx) => {
      const key = r.placeId || r.name;
      const isSelected = this.selectedMap.has(key);
      const statusClass = r.status === "营业中" ? "status-open" : (r.status === "已打烊" ? "status-closed" : "status-unknown");

      return `
        <div class="restaurant-card ${isSelected ? 'is-selected' : ''}" data-idx="${idx}" data-key="${this.escapeHtml(key)}">
          <div class="card-top">
            <div class="card-select-wrap">
              <input 
                type="checkbox" 
                class="custom-checkbox card-select-cb" 
                ${isSelected ? 'checked' : ''} 
                onclick="event.stopPropagation(); window.toggleRestaurantSelect(${idx});" 
              />
              <h4 class="rest-name">${this.escapeHtml(r.name)}</h4>
            </div>
            <span class="status-badge ${statusClass}">${r.status}</span>
          </div>

          <div class="card-rating-row">
            <span class="stars">★ ${r.rating ? r.rating.toFixed(1) : '-'}</span>
            <span class="reviews-count">(${r.reviews})</span>
            <span class="price-tag">${r.price || '-'}</span>
          </div>

          <div class="card-region-category">
            <div>${this.escapeHtml(r.region)}</div>
            <div class="card-category-text">${this.escapeHtml(r.categoriesRaw || '-')}</div>
          </div>

          <div class="card-address-row">
            <span>${this.escapeHtml(r.address)}</span>
          </div>

          ${r.phone && r.phone !== "无" ? `
            <div class="card-phone-row">
              <span>${this.escapeHtml(r.phone)}</span>
            </div>
          ` : ''}

          <div class="card-footer-actions">
            <span style="font-size: 0.75rem; color: var(--text-light);">详情 &gt;</span>
            <button class="btn-calc-oil" onclick="event.stopPropagation(); window.importRestaurantByIndex(${idx});">
              计算用油
            </button>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".restaurant-card").forEach(card => {
      card.addEventListener("click", () => {
        const idx = parseInt(card.dataset.idx, 10);
        this.openDetailModal(this.currentPageData[idx]);
      });
    });
  },

  renderTable() {
    const tbody = document.getElementById("restaurantTableBody");
    if (!tbody) return;

    if (this.currentPageData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 2rem;">无匹配餐馆</td></tr>`;
      return;
    }

    tbody.innerHTML = this.currentPageData.map((r, idx) => {
      const key = r.placeId || r.name;
      const isSelected = this.selectedMap.has(key);
      const statusClass = r.status === "营业中" ? "status-open" : (r.status === "已打烊" ? "status-closed" : "status-unknown");

      return `
        <tr class="${isSelected ? 'is-selected' : ''}" data-idx="${idx}" data-key="${this.escapeHtml(key)}" style="cursor: pointer;" onclick="window.openRestaurantDetailByIndex(${idx})">
          <td onclick="event.stopPropagation();" style="width: 40px; text-align: center;">
            <input 
              type="checkbox" 
              class="custom-checkbox row-select-cb" 
              ${isSelected ? 'checked' : ''} 
              onchange="window.toggleRestaurantSelect(${idx});" 
            />
          </td>
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

  renderPagination() {
    const container = document.getElementById("paginationControls");
    const infoContainer = document.getElementById("paginationInfoText");
    if (!container) return;

    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.total, this.currentPage * this.pageSize);

    if (infoContainer) {
      infoContainer.textContent = this.total > 0
        ? `第 ${start}-${end} 条，共 ${this.total} 家`
        : "";
    }

    if (this.totalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    const maxButtons = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(this.totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    let html = `
      <button class="page-btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="window.goToPage(1)" title="第一页">&laquo;</button>
      <button class="page-btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="window.goToPage(${this.currentPage - 1})" title="上一页">&lsaquo;</button>
    `;

    if (startPage > 1) {
      html += `<button class="page-btn" onclick="window.goToPage(1)">1</button>`;
      if (startPage > 2) html += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      html += `<button class="page-btn ${p === this.currentPage ? 'active' : ''}" onclick="window.goToPage(${p})">${p}</button>`;
    }

    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) html += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
      html += `<button class="page-btn" onclick="window.goToPage(${this.totalPages})">${this.totalPages}</button>`;
    }

    html += `
      <button class="page-btn" ${this.currentPage >= this.totalPages ? 'disabled' : ''} onclick="window.goToPage(${this.currentPage + 1})" title="下一页">&rsaquo;</button>
      <button class="page-btn" ${this.currentPage >= this.totalPages ? 'disabled' : ''} onclick="window.goToPage(${this.totalPages})" title="最后一页">&raquo;</button>
    `;

    container.innerHTML = html;
  },

  goToPage(page) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.fetchData();
    const resultsTop = document.querySelector(".results-header");
    if (resultsTop) resultsTop.scrollIntoView({ behavior: "smooth", block: "start" });
  },

  exportSelectedExcel() {
    let listToExport = Array.from(this.selectedMap.values());

    if (listToExport.length === 0) {
      alert("请先勾选餐馆");
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

    const rows = listToExport.map(r => {
      return {
        "餐馆名称 (Name)": r.name || "",
        "所属区域 (Region)": r.region || "",
        "油炸分类 (Categories)": r.categoriesRaw || (r.categories ? r.categories.join(" | ") : ""),
        "评分 (Rating)": r.rating !== undefined ? r.rating : "",
        "评价总数 (Reviews)": r.reviews !== undefined ? r.reviews : 0,
        "当前营业状态 (Status)": r.status || "未知",
        "营业时间 (Opening Hours)": r.openingHours || "未提供",
        "消费档次 (Price)": r.price || "未知",
        "详细地址 (Address)": r.address || "",
        "联系电话 (Phone)": r.phone || "无",
        "官方网站 (Website)": r.website || "",
        "Google 地图链接 (Maps URL)": r.mapsUrl || "",
        "主营类型 (Primary Type)": r.primaryType || "",
        "匹配关键词 (Keywords)": r.keywordsRaw || (r.keywords ? r.keywords.join(", ") : ""),
        "纬度 (Latitude)": r.latitude || "",
        "经度 (Longitude)": r.longitude || "",
        "Place ID": r.placeId || ""
      };
    });

    if (window.XLSX) {
      try {
        const worksheet = window.XLSX.utils.json_to_sheet(rows, { header: headers });
        worksheet["!cols"] = [
          { wch: 28 },
          { wch: 20 },
          { wch: 35 },
          { wch: 10 },
          { wch: 12 },
          { wch: 14 },
          { wch: 30 },
          { wch: 16 },
          { wch: 45 },
          { wch: 18 },
          { wch: 25 },
          { wch: 30 },
          { wch: 16 },
          { wch: 25 },
          { wch: 14 },
          { wch: 14 },
          { wch: 30 }
        ];

        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

        const fileName = `greenoil_restaurants_${new Date().toISOString().slice(0, 10)}.xlsx`;
        window.XLSX.writeFile(workbook, fileName);
        this.showToast("已导出 Excel");
        return;
      } catch (e) {
        console.warn("SheetJS error:", e);
      }
    }

    this.exportFallbackCsv(headers, rows);
  },

  exportFallbackCsv(headers, rows) {
    const csvRows = rows.map(r => {
      return headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(",");
    });
    const csvContent = "\uFEFF" + headers.join(",") + "\n" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `greenoil_restaurants_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast("已导出 CSV");
  },

  openDetailModal(r) {
    if (!r) return;
    this.selectedRestaurant = r;

    document.getElementById("modalRestName").textContent = r.name;
    document.getElementById("modalRestRegion").textContent = r.region;
    document.getElementById("modalRestCategory").textContent = r.categoriesRaw || (r.categories ? r.categories.join(" | ") : "");
    document.getElementById("modalRestRating").innerHTML = `★ ${r.rating ? r.rating.toFixed(1) : '-'} <span style="color:var(--text-muted); font-weight:normal;">(${r.reviews})</span>`;
    document.getElementById("modalRestStatus").textContent = r.status;
    document.getElementById("modalRestPrice").textContent = r.price;
    document.getElementById("modalRestAddress").textContent = r.address;
    document.getElementById("modalRestPhone").textContent = r.phone;

    const phoneBtn = document.getElementById("modalBtnPhone");
    if (phoneBtn) {
      if (r.phone && r.phone !== "无") {
        phoneBtn.href = `tel:${r.phone.replace(/[^0-9+]/g, '')}`;
        phoneBtn.style.display = "inline-flex";
      } else {
        phoneBtn.style.display = "none";
      }
    }

    const webBtn = document.getElementById("modalBtnWebsite");
    if (webBtn) {
      if (r.website) {
        webBtn.href = r.website;
        webBtn.style.display = "inline-flex";
      } else {
        webBtn.style.display = "none";
      }
    }

    const mapsBtn = document.getElementById("modalBtnMaps");
    if (mapsBtn) {
      mapsBtn.href = r.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + r.address)}`;
    }

    document.getElementById("modalRestHours").textContent = r.openingHours || "未提供";
    document.getElementById("modalRestType").textContent = r.primaryType || "-";
    document.getElementById("modalRestKeywords").textContent = r.keywordsRaw || (r.keywords ? r.keywords.join(", ") : "-");
    document.getElementById("modalRestPlaceId").textContent = r.placeId || "-";
    document.getElementById("modalRestCoordinates").textContent = (r.latitude && r.longitude) ? `${r.latitude}, ${r.longitude}` : "-";

    const modal = document.getElementById("detailModalOverlay");
    if (modal) modal.classList.add("active");
  },

  closeDetailModal() {
    const modal = document.getElementById("detailModalOverlay");
    if (modal) modal.classList.remove("active");
    this.selectedRestaurant = null;
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
        position: fixed; bottom: 85px; left: 50%; transform: translateX(-50%);
        background: #0f172a; color: white; padding: 8px 16px; border-radius: 6px;
        font-size: 0.85rem; z-index: 200; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transition: opacity 0.2s ease; opacity: 0; pointer-events: none;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    setTimeout(() => {
      toast.style.opacity = "0";
    }, 2000);
  }
};

window.openRestaurantDetailByIndex = function(idx) {
  Restaurants.openDetailModal(Restaurants.currentPageData[idx]);
};

window.importRestaurantByIndex = function(idx) {
  const rest = Restaurants.currentPageData[idx];
  if (rest && window.importRestaurantToCalculator) {
    window.importRestaurantToCalculator(rest);
  }
};

window.toggleRestaurantSelect = function(idx) {
  const rest = Restaurants.currentPageData[idx];
  if (rest) {
    Restaurants.toggleSelect(rest);
  }
};

window.goToPage = function(page) {
  Restaurants.goToPage(page);
};
