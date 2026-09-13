/**
 * Green Oil Restaurant Query & Details Manager
 */

import { Api } from "./api.js";
import { i18n } from "./i18n.js";

export const Restaurants = {
  currentPageData: [],
  selectedMap: new Map(),
  currentPage: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  activeRegion: "全部 (All GTA)",
  activeHub: "all",
  hubsData: [],
  activeCategory: "全部",
  searchQuery: "",
  sortBy: "rating",
  activeVisited: "all",
  activeOutcome: "all",
  viewMode: "cards",
  selectedRestaurant: null,

  async init() {
    this.bindEvents();
    await this.loadHubs();
    i18n.onLanguageChange(() => {
      this.populateHubSelect();
      this.render();
      this.renderPagination();
      this.updateSelectionUI();
      this.updateResultsCount();
      if (this.selectedRestaurant) {
        this.openDetailModal(this.selectedRestaurant);
      }
    });
    await this.fetchData();
  },

  async loadHubs() {
    try {
      const res = await Api.getHubs();
      if (res && res.success && Array.isArray(res.data)) {
        this.hubsData = res.data;
        this.populateHubSelect();
      }
    } catch (e) {
      console.warn("Failed to load hubs:", e);
    }
  },

  populateHubSelect() {
    const hubSelect = document.getElementById("hubSelect");
    if (!hubSelect) return;

    let availableHubs = this.hubsData;
    if (this.activeRegion && this.activeRegion !== "全部 (All GTA)") {
      availableHubs = availableHubs.filter(h => h.region && (h.region.includes(this.activeRegion) || this.activeRegion.includes(h.region)));
    }

    const currentVal = this.activeHub;
    let html = `<option value="all">${i18n.t("hub_all")}</option>`;

    availableHubs.forEach(h => {
      const hubName = i18n.currentLang === 'en' ? (h.nameEn || h.name) : (i18n.currentLang === 'ko' ? (h.nameKo || h.name) : h.name);
      html += `<option value="${h.id}">${this.escapeHtml(hubName)} (${h.count})</option>`;
    });

    hubSelect.innerHTML = html;
    if (availableHubs.some(h => h.id === currentVal)) {
      hubSelect.value = currentVal;
    } else {
      hubSelect.value = "all";
      this.activeHub = "all";
    }
  },

  switchViewMode(mode) {
    this.viewMode = mode;
    const btnCardView = document.getElementById("btnCardView");
    const btnTableView = document.getElementById("btnTableView");
    const btnHubView = document.getElementById("btnHubView");

    if (btnCardView) btnCardView.classList.toggle("active", mode === "cards");
    if (btnTableView) btnTableView.classList.toggle("active", mode === "table");
    if (btnHubView) btnHubView.classList.toggle("active", mode === "hubs");

    this.render();
  },

  selectHubAndFilter(hubId) {
    this.activeHub = hubId;
    const hubSelect = document.getElementById("hubSelect");
    if (hubSelect) hubSelect.value = hubId;
    this.switchViewMode("cards");
    this.currentPage = 1;
    this.fetchData();
  },

  bindEvents() {
    const regionSelect = document.getElementById("regionSelect");
    if (regionSelect) {
      regionSelect.addEventListener("change", (e) => {
        this.activeRegion = e.target.value;
        this.activeHub = "all";
        this.populateHubSelect();
        this.currentPage = 1;
        this.fetchData();
      });
    }

    const hubSelect = document.getElementById("hubSelect");
    if (hubSelect) {
      hubSelect.addEventListener("change", (e) => {
        this.activeHub = e.target.value;
        this.currentPage = 1;
        if (this.activeHub !== "all" && this.viewMode === "hubs") {
          this.switchViewMode("cards");
        }
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
          if (this.viewMode === "hubs") {
            this.renderHubs();
          } else {
            this.fetchData();
          }
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

    const filterVisitedSelect = document.getElementById("filterVisitedSelect");
    if (filterVisitedSelect) {
      filterVisitedSelect.addEventListener("change", (e) => {
        this.activeVisited = e.target.value;
        this.currentPage = 1;
        this.fetchData();
      });
    }

    const filterOutcomeSelect = document.getElementById("filterOutcomeSelect");
    if (filterOutcomeSelect) {
      filterOutcomeSelect.addEventListener("change", (e) => {
        this.activeOutcome = e.target.value;
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
    const btnHubView = document.getElementById("btnHubView");

    if (btnCardView) {
      btnCardView.addEventListener("click", () => this.switchViewMode("cards"));
    }
    if (btnTableView) {
      btnTableView.addEventListener("click", () => this.switchViewMode("table"));
    }
    if (btnHubView) {
      btnHubView.addEventListener("click", () => this.switchViewMode("hubs"));
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

    const handlePlanRoute = () => {
      const selectedList = Array.from(this.selectedMap.values());
      if (selectedList.length > 0) {
        import("./field-sales.js").then(({ FieldSales }) => {
          FieldSales.addMultipleToRoute(selectedList, false);
        });
      } else {
        if (this.currentPageData && this.currentPageData.length > 0) {
          this.setSelectCurrentPage(true);
          import("./field-sales.js").then(({ FieldSales }) => {
            FieldSales.addMultipleToRoute(this.currentPageData, false);
          });
        } else {
          const msg = i18n.t("alert_select_first");
          if (window.showToast) window.showToast(msg);
          else alert(msg);
        }
      }
    };

    const btnPlanRouteTop = document.getElementById("btnPlanRouteTop");
    if (btnPlanRouteTop) {
      btnPlanRouteTop.addEventListener("click", handlePlanRoute);
    }

    const btnPlanRouteSelected = document.getElementById("btnPlanRouteSelected");
    if (btnPlanRouteSelected) {
      btnPlanRouteSelected.addEventListener("click", handlePlanRoute);
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
    if (modalClose) {
      modalClose.addEventListener("click", () => this.closeDetailModal());
    }

    const modalOverlay = document.getElementById("detailModalOverlay");
    if (modalOverlay) {
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) this.closeDetailModal();
      });
    }

    const btnModalLogVisit = document.getElementById("btnModalLogVisit");
    if (btnModalLogVisit) {
      btnModalLogVisit.addEventListener("click", () => {
        if (this.selectedRestaurant) {
          const r = this.selectedRestaurant;
          this.closeDetailModal();
          import("./field-sales.js").then(({ FieldSales }) => {
            FieldSales.openSalesRecordModal(null, r);
          });
        }
      });
    }

    const btnModalAddToRoute = document.getElementById("btnModalAddToRoute");
    if (btnModalAddToRoute) {
      btnModalAddToRoute.addEventListener("click", () => {
        if (this.selectedRestaurant) {
          const r = this.selectedRestaurant;
          this.closeDetailModal();
          import("./field-sales.js").then(({ FieldSales }) => {
            FieldSales.addMultipleToRoute([r], false);
          });
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
        hub: this.activeHub,
        keyword: this.searchQuery,
        category: this.activeCategory,
        sort: this.sortBy,
        visited: this.activeVisited,
        outcome: this.activeOutcome
      });

      this.currentPageData = res.data || [];
      this.total = res.total || 0;
      this.totalPages = res.totalPages || 1;
      this.currentPage = res.page || 1;

      this.updateResultsCount();
      this.render();
      this.renderPagination();
      this.updateSelectionUI();
    } catch (err) {
      console.error("Fetch data error:", err);
      this.showToast("Query error");
    } finally {
      if (loader) loader.style.display = "none";
    }
  },

  updateResultsCount() {
    const countDisplay = document.getElementById("resultsCountDisplay");
    if (countDisplay) {
      countDisplay.innerHTML = `<span>${i18n.t("results_count", { total: this.total.toLocaleString() })}</span>`;
    }
  },

  formatStatus(status) {
    if (status === "营业中" || status === "Open") {
      return { label: i18n.t("status_open"), cls: "status-open" };
    }
    if (status === "已打烊" || status === "Closed") {
      return { label: i18n.t("status_closed"), cls: "status-closed" };
    }
    return { label: i18n.t("status_unknown"), cls: "status-unknown" };
  },

  formatRegion(region) {
    if (!region) return "";
    const regLower = region.toLowerCase();
    if (region.includes("万锦") || regLower.includes("markham")) return i18n.t("region_markham");
    if (region.includes("士嘉堡") || regLower.includes("scarborough")) return i18n.t("region_scarborough");
    if (region.includes("北约克") || regLower.includes("north york")) return i18n.t("region_north_york");
    if (region.includes("列治文山") || regLower.includes("richmond hill")) return i18n.t("region_richmond_hill");
    if (region.includes("市中心") || regLower.includes("downtown")) return i18n.t("region_downtown");
    if (region.includes("密西沙加") || regLower.includes("mississauga")) return i18n.t("region_mississauga");
    if (region.includes("旺市") || regLower.includes("vaughan")) return i18n.t("region_vaughan");
    if (region.includes("全部") || regLower.includes("all gta")) return i18n.t("region_all");
    return region;
  },

  formatCategory(cat) {
    if (!cat) return "-";
    if (cat.includes("中式") || cat.includes("台式")) return i18n.t("cat_chinese");
    if (cat.includes("西式") || cat.includes("快餐") || cat.includes("炸鸡翅")) return i18n.t("cat_western");
    if (cat.includes("韩式") || cat.includes("韩国")) return i18n.t("cat_korean");
    if (cat.includes("炸鱼") || cat.includes("薯条")) return i18n.t("cat_fish_chips");
    if (cat.includes("日式") || cat.includes("猪排") || cat.includes("天妇罗")) return i18n.t("cat_japanese");
    if (cat.includes("热狗") || cat.includes("甜甜圈") || cat.includes("吉事果")) return i18n.t("cat_sweets");
    return cat;
  },

  formatOutcome(outcome) {
    if (!outcome) return i18n.t("visited_yes");
    const map = {
      "签订合同": "outcome_contract",
      "contract_signed": "outcome_contract",
      "有意向": "outcome_interested",
      "interested": "outcome_interested",
      "考虑中": "outcome_considering",
      "considering": "outcome_considering",
      "暂无意向": "outcome_not_interested",
      "not_interested": "outcome_not_interested",
      "拒绝": "outcome_rejected",
      "拒绝合作": "outcome_rejected",
      "rejected": "outcome_rejected",
      "已打烊": "outcome_closed",
      "已打烊/关店": "outcome_closed",
      "closed": "outcome_closed",
      "已拜访": "visited_yes",
      "visited": "visited_yes"
    };
    const key = map[outcome];
    return key ? i18n.t(key) : outcome;
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
    const suffixSpan = document.getElementById("selectionCountSuffix");
    const exportBtnText = document.getElementById("btnExportSelectedText");

    if (countSpan) countSpan.textContent = count;
    if (suffixSpan) {
      const formatted = i18n.t("sel_count", { count: "" }).trim();
      suffixSpan.textContent = formatted;
    }
    if (exportBtnText) {
      exportBtnText.textContent = i18n.t("btn_export_selection", { count });
    }

    const btnPlanRouteSelected = document.getElementById("btnPlanRouteSelected");
    if (btnPlanRouteSelected) {
      const textSpan = btnPlanRouteSelected.querySelector("span:not(:first-child)");
      if (textSpan) {
        textSpan.textContent = count > 0 ? i18n.t("plan_route_with_count", { count }) : i18n.t("btn_plan_route");
      }
    }
    const btnPlanRouteTop = document.getElementById("btnPlanRouteTop");
    if (btnPlanRouteTop) {
      const textSpan = btnPlanRouteTop.querySelector("span:not(:first-child)");
      if (textSpan) {
        textSpan.textContent = count > 0 ? i18n.t("plan_route_with_count", { count }) : i18n.t("btn_plan_route");
      }
    }

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
    const hubsContainer = document.getElementById("restaurantHubsView");
    const paginationContainer = document.getElementById("paginationContainer");

    if (this.viewMode === "cards") {
      if (cardsContainer) cardsContainer.style.display = "grid";
      if (tableContainer) tableContainer.style.display = "none";
      if (hubsContainer) hubsContainer.style.display = "none";
      if (paginationContainer) paginationContainer.style.display = "flex";
      this.renderCards();
    } else if (this.viewMode === "table") {
      if (cardsContainer) cardsContainer.style.display = "none";
      if (tableContainer) tableContainer.style.display = "block";
      if (hubsContainer) hubsContainer.style.display = "none";
      if (paginationContainer) paginationContainer.style.display = "flex";
      this.renderTable();
    } else if (this.viewMode === "hubs") {
      if (cardsContainer) cardsContainer.style.display = "none";
      if (tableContainer) tableContainer.style.display = "none";
      if (hubsContainer) hubsContainer.style.display = "grid";
      if (paginationContainer) paginationContainer.style.display = "none";
      this.renderHubs();
    }
  },

  renderCards() {
    const container = document.getElementById("restaurantCardsView");
    if (!container) return;

    if (this.currentPageData.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-weight: 600; font-size: 1rem;">${i18n.t("no_matching_restaurants")}</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.currentPageData.map((r, idx) => {
      const key = r.placeId || r.name;
      const isSelected = this.selectedMap.has(key);
      const statusObj = this.formatStatus(r.status);
      const hubName = i18n.currentLang === 'en' ? (r.hubNameEn || r.hubName) : (i18n.currentLang === 'ko' ? (r.hubNameKo || r.hubName) : r.hubName);

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
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <span class="status-badge ${statusObj.cls}">${statusObj.label}</span>
              ${r.isVisited ? `<span class="badge" style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; font-size:0.68rem; padding:1px 5px; border-radius:3px; font-weight:600;" title="${i18n.t("visited_recent_tooltip", { time: this.escapeHtml(r.lastVisitTime || '') })}">${this.escapeHtml(this.formatOutcome(r.lastOutcome))}</span>` : ''}
            </div>
          </div>

          <div class="card-rating-row">
            <span class="stars">★ ${r.rating ? r.rating.toFixed(1) : '-'}</span>
            <span class="reviews-count">(${r.reviews})</span>
            <span class="price-tag">${r.price || '-'}</span>
          </div>

          <div class="card-region-category">
            <div>${this.escapeHtml(this.formatRegion(r.region))}</div>
            <div class="card-category-text">${this.escapeHtml(this.formatCategory(r.categoriesRaw || '-'))}</div>
          </div>

          ${r.hubId && r.hubId !== "street_retail" ? `
            <div style="margin-top: -0.25rem;">
              <span class="hub-badge" title="${this.escapeHtml(hubName)}">
                <span>${r.hubIcon || '🏬'}</span>
                <span>${this.escapeHtml(hubName)}</span>
              </span>
            </div>
          ` : ''}

          <div class="card-address-row">
            <span>${this.escapeHtml(r.address)}</span>
          </div>

          ${r.phone && r.phone !== "无" ? `
            <div class="card-phone-row">
              <span>${this.escapeHtml(r.phone)}</span>
            </div>
          ` : ''}

          <div class="card-footer-actions">
            <span style="font-size: 0.75rem; color: var(--text-light);">${i18n.t("btn_details")} &gt;</span>
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              <button class="btn-calc-oil" style="background: rgba(37,99,235,0.08); color: #2563eb; border: 1px solid rgba(37,99,235,0.25);" onclick="event.stopPropagation(); window.addRestaurantToRouteByIndex(${idx});" title="${i18n.t("btn_add_to_route")}">
                ${i18n.t("btn_add_to_route")}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".restaurant-card").forEach(card => {
      card.addEventListener("click", () => {
        const idx = parseInt(card.dataset.idx, 10);
        if (!isNaN(idx) && this.currentPageData[idx]) {
          this.openDetailModal(this.currentPageData[idx]);
        }
      });
    });
  },

  renderTable() {
    const tbody = document.getElementById("restaurantTableBody");
    if (!tbody) return;

    if (this.currentPageData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
            ${i18n.t("no_matching_restaurants")}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.currentPageData.map((r, idx) => {
      const key = r.placeId || r.name;
      const isSelected = this.selectedMap.has(key);
      const statusObj = this.formatStatus(r.status);
      const hubName = i18n.currentLang === 'en' ? (r.hubNameEn || r.hubName) : (i18n.currentLang === 'ko' ? (r.hubNameKo || r.hubName) : r.hubName);

      return `
        <tr class="${isSelected ? 'is-selected' : ''}" onclick="window.openRestaurantDetailModal(${idx});" style="cursor: pointer;">
          <td style="text-align: center;" onclick="event.stopPropagation();">
            <input 
              type="checkbox" 
              class="custom-checkbox row-select-cb" 
              ${isSelected ? 'checked' : ''} 
              onchange="window.toggleRestaurantSelect(${idx});" 
            />
          </td>
          <td class="col-name">${this.escapeHtml(r.name)}</td>
          <td>${this.escapeHtml(this.formatRegion(r.region))}</td>
          <td>
            ${r.hubId && r.hubId !== "street_retail" ? `
              <span class="hub-badge" title="${this.escapeHtml(hubName)}">
                <span>${r.hubIcon || '🏬'}</span>
                <span>${this.escapeHtml(hubName)}</span>
              </span>
            ` : '<span style="color: var(--text-light); font-size: 0.78rem;">-</span>'}
          </td>
          <td class="col-category" title="${this.escapeHtml(this.formatCategory(r.categoriesRaw))}">${this.escapeHtml(this.formatCategory(r.categoriesRaw))}</td>
          <td><b>★ ${r.rating ? r.rating.toFixed(1) : '-'}</b> (${r.reviews})</td>
          <td>
            <span class="status-badge ${statusObj.cls}">${statusObj.label}</span>
            ${r.isVisited ? `<div style="margin-top: 3px;"><span class="badge" style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; font-size:0.68rem; padding:1px 4px; border-radius:3px; font-weight:600;" title="${i18n.t("visited_recent_tooltip", { time: this.escapeHtml(r.lastVisitTime || '') })}">${this.escapeHtml(this.formatOutcome(r.lastOutcome))}</span></div>` : ''}
          </td>
          <td>${this.escapeHtml(r.price)}</td>
          <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(r.address)}</td>
          <td>${this.escapeHtml(r.phone)}</td>
          <td>
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.addRestaurantToRouteByIndex(${idx});" style="color: #2563eb; border-color: rgba(37,99,235,0.3); padding: 0.25rem 0.5rem; font-size: 0.78rem;" title="${i18n.t("btn_add_to_route")}">
                ${i18n.t("btn_add_to_route")}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  renderHubs() {
    const container = document.getElementById("restaurantHubsView");
    if (!container) return;

    let list = this.hubsData;
    if (this.activeRegion && this.activeRegion !== "全部 (All GTA)") {
      list = list.filter(h => h.region && (h.region.includes(this.activeRegion) || this.activeRegion.includes(h.region)));
    }

    if (this.searchQuery) {
      list = list.filter(h => {
        const str = [h.name, h.nameEn, h.nameKo, h.region].join(" ").toLowerCase();
        return str.includes(this.searchQuery);
      });
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-weight: 600; font-size: 1rem;">${i18n.t("no_matching_restaurants")}</div>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(h => {
      const hubName = i18n.currentLang === 'en' ? (h.nameEn || h.name) : (i18n.currentLang === 'ko' ? (h.nameKo || h.name) : h.name);
      const samples = (h.sampleRestaurants || []).slice(0, 3).map(s => s.name).join("、 ");
      const ucoLabel = i18n.currentLang === 'en' ? "Est. Monthly UCO (75%)" : (i18n.currentLang === 'ko' ? "월 예상 폐유 (75%)" : "月预估废油 (75% UCO)");
      const drumUnit = i18n.currentLang === 'en' ? "drums (200L)" : (i18n.currentLang === 'ko' ? "통 (200L)" : "桶 200L");
      const sampleLabel = i18n.currentLang === 'en' ? "Sample restaurants:" : (i18n.currentLang === 'ko' ? "대표 식당:" : "代表餐馆:");

      return `
        <div class="hub-card" onclick="window.selectHubAndFilter('${h.id}')">
          <div class="hub-card-header">
            <div class="hub-card-icon">${h.icon || '🏬'}</div>
            <div class="hub-card-titles">
              <h4 class="hub-card-name">${this.escapeHtml(hubName)}</h4>
              <div class="hub-card-region">${this.escapeHtml(this.formatRegion(h.region))}</div>
            </div>
          </div>

          <div class="hub-card-stats">
            <div class="hub-stat-item">
              <span class="hub-stat-label">${i18n.t("th_rating")}</span>
              <span class="hub-stat-val">★ ${h.avgRating}</span>
            </div>
            <div class="hub-stat-item">
              <span class="hub-stat-label">${i18n.t("hub_restaurant_count")}</span>
              <span class="hub-stat-val">${i18n.t("hub_count_unit", { count: h.count })}</span>
            </div>
            <div class="hub-stat-item" style="grid-column: 1/-1;">
              <span class="hub-stat-label">${ucoLabel}</span>
              <span class="hub-stat-val highlight">~${(h.estUcoLiters || 0).toLocaleString()} L <span style="font-size: 0.78rem; font-weight: normal; color: var(--text-muted);">(${h.est200lDrums || 0} ${drumUnit})</span></span>
            </div>
          </div>

          ${samples ? `
            <div class="hub-card-samples" title="${this.escapeHtml(samples)}">
              <span style="font-weight: 600;">${sampleLabel}</span> ${this.escapeHtml(samples)}
            </div>
          ` : ''}

          <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
            <button class="hub-card-btn" style="margin-top: 0; flex: 1;" onclick="event.stopPropagation(); window.selectHubAndFilter('${h.id}')">
              ${i18n.t("hub_card_btn")} (${h.count}) &rarr;
            </button>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.addHubToRoute('${h.id}', '${this.escapeHtml(hubName)}')" title="${i18n.t("hub_btn_add_to_route_title")}" style="color: #2563eb; border-color: rgba(37,99,235,0.3); white-space: nowrap; font-size: 0.78rem; padding: 0.4rem 0.6rem;">
              ${i18n.t("btn_add_to_route_short")}
            </button>
          </div>
        </div>
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
        ? i18n.t("pagination_range", { start, end, total: this.total.toLocaleString() })
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
      <button class="page-btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="window.goToPage(1)" title="${i18n.t("page_first")}">&laquo;</button>
      <button class="page-btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="window.goToPage(${this.currentPage - 1})" title="${i18n.t("page_prev")}">&lsaquo;</button>
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
      <button class="page-btn" ${this.currentPage >= this.totalPages ? 'disabled' : ''} onclick="window.goToPage(${this.currentPage + 1})" title="${i18n.t("page_next")}">&rsaquo;</button>
      <button class="page-btn" ${this.currentPage >= this.totalPages ? 'disabled' : ''} onclick="window.goToPage(${this.totalPages})" title="${i18n.t("page_last")}">&raquo;</button>
    `;

    container.innerHTML = html;
  },

  goToPage(page) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.fetchData();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  exportSelectedExcel() {
    if (this.selectedMap.size === 0) {
      alert(i18n.t("sel_count", { count: 0 }));
      return;
    }

    const selectedList = Array.from(this.selectedMap.values());
    const headers = [
      "餐馆名称 (Name)",
      "所属区域 (Region)",
      "所属商圈 (Hub / Plaza)",
      "详细分类 (Categories)",
      "主分类代码 (Primary Type)",
      "评分 (Rating)",
      "评价数 (Reviews)",
      "营业状态 (Status)",
      "价格档次 (Price)",
      "详细地址 (Address)",
      "联系电话 (Phone)",
      "官网链接 (Website)",
      "Google地图链接 (Maps URL)",
      "营业时间 (Hours)",
      "搜索关键词 (Keywords)",
      "纬度 (Latitude)",
      "经度 (Longitude)",
      "Place ID"
    ];

    const rows = selectedList.map(r => {
      const hubName = i18n.currentLang === 'en' ? (r.hubNameEn || r.hubName) : (i18n.currentLang === 'ko' ? (r.hubNameKo || r.hubName) : r.hubName);
      return {
        "餐馆名称 (Name)": r.name || "",
        "所属区域 (Region)": r.region || "",
        "所属商圈 (Hub / Plaza)": (r.hubId && r.hubId !== "street_retail") ? (hubName || "") : "沿街与社区广场",
        "详细分类 (Categories)": r.categoriesRaw || (r.categories ? r.categories.join(" | ") : ""),
        "主分类代码 (Primary Type)": r.primaryType || "",
        "评分 (Rating)": r.rating || "",
        "评价数 (Reviews)": r.reviews || 0,
        "营业状态 (Status)": r.status || "",
        "价格档次 (Price)": r.price || "",
        "详细地址 (Address)": r.address || "",
        "联系电话 (Phone)": r.phone || "",
        "官网链接 (Website)": r.website || "",
        "Google地图链接 (Maps URL)": r.mapsUrl || "",
        "营业时间 (Hours)": r.openingHours || "",
        "搜索关键词 (Keywords)": r.keywordsRaw || (r.keywords ? r.keywords.join(", ") : ""),
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
          { wch: 25 },
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
        this.showToast(i18n.t("toast_export_excel"));
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
    this.showToast(i18n.t("toast_export_csv"));
  },

  openDetailModal(r) {
    if (!r) return;
    this.selectedRestaurant = r;

    // Populate photo banner
    const modalImage = document.getElementById("modalRestImage");
    const modalImageBadge = document.getElementById("modalRestImageBadge");
    const modalImageWrap = document.getElementById("modalRestImageWrap");
    if (modalImage && modalImageWrap) {
      const photoInfo = (window.MapExplorer && typeof window.MapExplorer.getRestaurantPhoto === "function")
        ? window.MapExplorer.getRestaurantPhoto(r)
        : { url: null, isGoogle: false };
      modalImageWrap.style.display = photoInfo.url ? "" : "none";
      modalImage.removeAttribute("src");
      if (photoInfo.url) modalImage.src = photoInfo.url;
      modalImage.alt = r.name || "Restaurant";
      modalImage.onerror = () => { modalImageWrap.style.display = "none"; };
      if (modalImageBadge) modalImageBadge.style.display = "none";
      modalImage.dataset.place = r.placeId || r.name;
      if (!photoInfo.url && r.placeId && window.MapExplorer) {
        window.MapExplorer.fetchGooglePhotoForPlace(r.placeId).then(url => {
          if (url && modalImage.dataset.place === r.placeId) {
            modalImage.src = url;
            modalImageWrap.style.display = "";
          }
        });
      }
    }

    const statusObj = this.formatStatus(r.status);
    const modalStatus = document.getElementById("modalRestStatus");
    if (modalStatus) {
      modalStatus.textContent = statusObj.label;
      modalStatus.className = `status-badge ${statusObj.cls}`;
    }

    document.getElementById("modalRestName").textContent = r.name;
    document.getElementById("modalRestRegion").textContent = this.formatRegion(r.region);

    const modalHub = document.getElementById("modalRestHub");
    if (modalHub) {
      if (r.hubId && r.hubId !== "street_retail") {
        const hubName = i18n.currentLang === 'en' ? (r.hubNameEn || r.hubName) : (i18n.currentLang === 'ko' ? (r.hubNameKo || r.hubName) : r.hubName);
        modalHub.innerHTML = `<span class="hub-badge">${r.hubIcon || '🏬'} ${this.escapeHtml(hubName)}</span>`;
      } else {
        modalHub.textContent = i18n.t("hub_street_retail");
      }
    }

    document.getElementById("modalRestCategory").textContent = this.formatCategory(r.categoriesRaw || (r.categories ? r.categories.join(" | ") : ""));
    document.getElementById("modalRestRating").innerHTML = `★ ${r.rating ? r.rating.toFixed(1) : '-'} <span style="color:var(--text-muted); font-weight:normal;">(${r.reviews})</span>`;
    document.getElementById("modalRestPrice").textContent = r.price || "-";
    document.getElementById("modalRestAddress").textContent = r.address || "-";
    document.getElementById("modalRestPhone").textContent = r.phone || "-";

    const phoneBtn = document.getElementById("modalBtnPhone");
    if (phoneBtn) {
      if (r.phone && r.phone !== "无" && r.phone !== "-") {
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

    document.getElementById("modalRestHours").textContent = r.openingHours || i18n.t("hours_not_provided");
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

  async addHubToRoute(hubId, hubName) {
    try {
      this.showToast(i18n.t("toast_loading_hub", { name: hubName }));
      const res = await Api.queryRestaurants({
        hub: hubId,
        pageSize: 300
      });
      if (res && res.data && res.data.length > 0) {
        import("./field-sales.js").then(({ FieldSales }) => {
          FieldSales.addMultipleToRoute(res.data, false);
        });
      } else {
        const msg = i18n.t("alert_hub_no_restaurants");
        if (window.showToast) window.showToast(msg);
        else alert(msg);
      }
    } catch (e) {
      console.error("Error fetching hub restaurants for route:", e);
      const msg = i18n.t("alert_hub_fetch_failed");
      if (window.showToast) window.showToast(msg);
      else alert(msg);
    }
  },

  showToast(msg) {
    if (window.showToast) {
      window.showToast(msg);
      return;
    }
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

if (typeof window !== "undefined") {
  window.openRestaurantDetailByIndex = function(idx) {
    Restaurants.openDetailModal(Restaurants.currentPageData[idx]);
  };

  window.importRestaurantByIndex = function(idx) {
    const rest = Restaurants.currentPageData[idx];
    if (rest && window.importRestaurantToCalculator) {
      window.importRestaurantToCalculator(rest);
    }
  };

  window.addRestaurantToRouteByIndex = function(idx) {
    const rest = Restaurants.currentPageData[idx];
    if (rest) {
      import("./field-sales.js").then(({ FieldSales }) => {
        FieldSales.addMultipleToRoute([rest], false);
      });
    }
  };

  window.addHubToRoute = function(hubId, hubName) {
    Restaurants.addHubToRoute(hubId, hubName);
  };

  window.toggleRestaurantSelect = function(idx) {
    const rest = Restaurants.currentPageData[idx];
    if (rest) {
      Restaurants.toggleSelect(rest);
    }
  };

  window.selectHubAndFilter = function(hubId) {
    Restaurants.selectHubAndFilter(hubId);
  };

  window.goToPage = function(page) {
    Restaurants.goToPage(page);
  };
}
