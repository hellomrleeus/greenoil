/**
 * Green Oil Field Sale Workbench Module
 * 
 * Features:
 * 1. Route Planning: Navigation path generation from Green Oil Inc Toronto with waypoints & Google Maps deep-link
 * 2. Sales Visit Logging: GPS proximity restaurant matching, Google Maps search/add to KV, restaurant info sync
 * 3. Granular Outcomes: Contract Signed, Interested, Rejected (reasons), Signed with Others (competitor quotes)
 * 4. Visual Analytics: Responsive SVG Pie/Donut & Bar Charts, KPI cards, Competitor Intelligence, Excel export
 */

import { Api } from "./api.js";
import { i18n } from "./i18n.js";
import { Restaurants } from "./restaurants.js";
import { Auth } from "./auth.js";

const DEFAULT_ORIGIN_ADDRESS = "Green Oil Inc, Toronto, ON";
const STORAGE_ORIGIN_KEY = "greenoil_start_address";
const STORAGE_SALES_CACHE_KEY = "greenoil_field_sales_cache";
const STORAGE_WAYPOINTS_KEY = "greenoil_route_waypoints";
const STORAGE_ROUTE_TABS_KEY = "greenoil_route_tabs_v1";
const STORAGE_ACTIVE_TAB_KEY = "greenoil_route_active_tab_v1";

export const FieldSales = {
  activeSubTab: "route", // route | records | analytics
  routeTabs: [
    {
      id: "tab_default",
      name: "路线 1",
      waypoints: []
    }
  ],
  activeRouteTabId: "tab_default",
  _renamingTabId: null,
  _pendingImportRestaurants: null,
  _pendingImportJumpToTab: false,

  getActiveRouteTab() {
    if (!Array.isArray(this.routeTabs) || this.routeTabs.length === 0) {
      this.routeTabs = [{
        id: "tab_default",
        name: (typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_default_name") : "路线 1") || "路线 1",
        waypoints: []
      }];
      this.activeRouteTabId = "tab_default";
    }
    let tab = this.routeTabs.find(t => t.id === this.activeRouteTabId);
    if (!tab) {
      tab = this.routeTabs[0];
      this.activeRouteTabId = tab.id;
    }
    return tab;
  },

  get routeWaypoints() {
    const tab = this.getActiveRouteTab();
    return tab ? tab.waypoints : [];
  },
  set routeWaypoints(val) {
    const tab = this.getActiveRouteTab();
    if (tab) {
      tab.waypoints = Array.isArray(val) ? val : [];
    }
  },
  selectedWaypointIds: new Set(),
  routeSearchQuery: "",
  originAddress: DEFAULT_ORIGIN_ADDRESS,
  cachedRestaurants: [],
  salesRecords: [],
  filterOutcome: "all",
  filterMethod: "all",
  searchKeyword: "",
  editingRecordId: null,
  selectedRestaurantForSale: null,

  // Calendar View State
  recordsViewMode: "list", // list | calendar
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(), // 0-11
  selectedCalendarDate: new Date().toISOString().slice(0, 10),

  async init() {
    this.originAddress = localStorage.getItem(STORAGE_ORIGIN_KEY) || DEFAULT_ORIGIN_ADDRESS;
    this.bindSubTabEvents();
    this.bindRouteEvents();
    this.bindRecordEvents();
    this.bindAnalyticsEvents();

    // Listen for language change to update dynamic views
    i18n.onLanguageChange(() => {
      this.populateRestaurantDatalist();
      this.renderRouteTabs();
      this.renderRouteWaypoints();
      this.renderSalesRecords();
      if (this.recordsViewMode === "calendar") {
        this.renderCalendarView();
      }
      this.renderAnalytics();
      const modal = document.getElementById("fsRecordModalOverlay");
      if (modal && modal.classList.contains("active")) {
        this.populateProximityRestaurantOptions(this.selectedRestaurantForSale);
      }
    });

    // Load initial data
    await this.loadSalesRecords();
    this.loadCachedRestaurants();
    await this.loadRouteWaypoints();
    this.renderRouteTabs();
    this.renderRouteWaypoints();
  },

  // -------------------------------------------------------------
  // Sub-Tab Navigation (Route | Records | Analytics)
  // -------------------------------------------------------------
  bindSubTabEvents() {
    const subTabBtns = document.querySelectorAll(".fs-subtab-btn");
    subTabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.subtab;
        this.switchSubTab(target);
      });
    });
  },

  switchSubTab(targetSubTab) {
    this.activeSubTab = targetSubTab;
    document.querySelectorAll(".fs-subtab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.subtab === targetSubTab);
    });

    document.querySelectorAll(".fs-subview").forEach(view => {
      view.classList.toggle("active", view.id === `fs-view-${targetSubTab}`);
    });

    if (targetSubTab === "analytics") {
      this.renderAnalytics();
    } else if (targetSubTab === "records") {
      this.renderSalesRecords();
    } else if (targetSubTab === "route") {
      this.renderRouteTabs();
      this.renderRouteWaypoints();
    }
  },

  // -------------------------------------------------------------
  // Data Loading & Caching
  // -------------------------------------------------------------
  async loadSalesRecords() {
    // 1. Load local cache first
    try {
      const cached = localStorage.getItem(STORAGE_SALES_CACHE_KEY);
      if (cached) {
        this.salesRecords = JSON.parse(cached);
      }
    } catch (e) {}

    // 2. Fetch from backend Worker KV
    const res = await Api.getSales();
    if (res && res.success && Array.isArray(res.data)) {
      this.salesRecords = res.data;
      try {
        localStorage.setItem(STORAGE_SALES_CACHE_KEY, JSON.stringify(res.data));
      } catch (e) {}
    }

    if (this.activeSubTab === "records") this.renderSalesRecords();
    if (this.activeSubTab === "analytics") this.renderAnalytics();
  },

  async loadCachedRestaurants() {
    // Attempt to grab from window.Restaurants if loaded
    if (window.Restaurants && Array.isArray(window.Restaurants.fullDataset) && window.Restaurants.fullDataset.length > 0) {
      this.cachedRestaurants = window.Restaurants.fullDataset;
      this.populateRestaurantDatalist();
      this.enrichExistingWaypoints();
      return;
    }

    const res = await Api.queryAllRestaurants(3500);
    if (res && res.success && Array.isArray(res.data)) {
      this.cachedRestaurants = res.data;
      this.populateRestaurantDatalist();
      this.enrichExistingWaypoints();
    }
  },

  // -------------------------------------------------------------
  // Sub-Module 1: Route Planning
  // -------------------------------------------------------------
  bindRouteEvents() {
    const originInput = document.getElementById("fsRouteOriginInput");
    if (originInput) {
      originInput.value = this.originAddress;
      originInput.addEventListener("change", (e) => {
        this.originAddress = e.target.value.trim() || DEFAULT_ORIGIN_ADDRESS;
        localStorage.setItem(STORAGE_ORIGIN_KEY, this.originAddress);
        this.saveRouteWaypoints();
      });
    }

    // Manual Batch Add Addresses
    const btnManualAdd = document.getElementById("fsRouteBtnManualAdd");
    if (btnManualAdd) {
      btnManualAdd.addEventListener("click", () => this.openManualAddModal());
    }

    // New Route Tab Button
    const btnNewTab = document.getElementById("fsRouteBtnNewTab");
    if (btnNewTab) {
      btnNewTab.addEventListener("click", () => this.createRouteTab());
    }

    // Bind Manual Add Modal events
    const manualModalClose = document.getElementById("fsRouteManualModalClose");
    const manualModalCancel = document.getElementById("fsRouteManualModalBtnCancel");
    const manualModalOverlay = document.getElementById("fsRouteManualAddModalOverlay");
    const manualModalSubmit = document.getElementById("fsRouteManualModalBtnSubmit");

    if (manualModalClose) manualModalClose.addEventListener("click", () => this.closeManualAddModal());
    if (manualModalCancel) manualModalCancel.addEventListener("click", () => this.closeManualAddModal());
    if (manualModalOverlay) {
      manualModalOverlay.addEventListener("click", (e) => {
        if (e.target === manualModalOverlay) this.closeManualAddModal();
      });
    }
    if (manualModalSubmit) {
      manualModalSubmit.addEventListener("click", () => {
        const input = document.getElementById("fsRouteManualAddressesInput");
        const val = input ? input.value.trim() : "";
        if (!val) {
          const alertMsg = i18n.t("fs_route_manual_empty_alert") || "请输入至少一行有效地址";
          if (window.showToast) window.showToast(alertMsg);
          else alert(alertMsg);
          return;
        }
        const tabSelect = document.getElementById("fsRouteManualTargetTabSelect");
        const targetTabId = (tabSelect && this.routeTabs.length > 1) ? tabSelect.value : this.activeRouteTabId;
        this.closeManualAddModal();
        this.batchAddAddressesFromText(val, targetTabId);
      });
    }

    // Bind Select Tab Modal events (for Map & Restaurant Query import)
    const selectTabModalClose = document.getElementById("fsRouteSelectTabModalClose");
    const selectTabModalCancel = document.getElementById("fsRouteSelectTabBtnCancel");
    const selectTabModalOverlay = document.getElementById("fsRouteSelectTabModalOverlay");
    const selectTabModalConfirm = document.getElementById("fsRouteSelectTabBtnConfirm");
    const selectTabBtnNew = document.getElementById("fsRouteSelectTabBtnNewOption");

    if (selectTabModalClose) selectTabModalClose.addEventListener("click", () => this.closeSelectTabModal());
    if (selectTabModalCancel) selectTabModalCancel.addEventListener("click", () => this.closeSelectTabModal());
    if (selectTabModalOverlay) {
      selectTabModalOverlay.addEventListener("click", (e) => {
        if (e.target === selectTabModalOverlay) this.closeSelectTabModal();
      });
    }
    if (selectTabBtnNew) {
      selectTabBtnNew.addEventListener("click", () => {
        const newTab = this.createRouteTab();
        const pending = this._pendingImportRestaurants;
        const jump = this._pendingImportJumpToTab;
        this.closeSelectTabModal();
        if (pending && pending.length > 0) {
          this.executeAddMultipleToRoute(pending, newTab.id, jump);
        }
      });
    }
    if (selectTabModalConfirm) {
      selectTabModalConfirm.addEventListener("click", () => {
        const checkedRadio = document.querySelector('input[name="fsSelectRouteTabRadio"]:checked');
        const targetTabId = checkedRadio ? checkedRadio.value : this.activeRouteTabId;
        const pending = this._pendingImportRestaurants;
        const jump = this._pendingImportJumpToTab;
        this.closeSelectTabModal();
        if (pending && pending.length > 0) {
          this.executeAddMultipleToRoute(pending, targetTabId, jump);
        }
      });
    }

    // Bind Rename Tab Modal events
    const renameModalClose = document.getElementById("fsRouteRenameModalClose");
    const renameModalCancel = document.getElementById("fsRouteRenameModalBtnCancel");
    const renameModalOverlay = document.getElementById("fsRouteRenameModalOverlay");
    const renameModalSave = document.getElementById("fsRouteRenameModalBtnSave");
    const renameInput = document.getElementById("fsRouteRenameInput");

    if (renameModalClose) renameModalClose.addEventListener("click", () => this.closeRenameTabModal());
    if (renameModalCancel) renameModalCancel.addEventListener("click", () => this.closeRenameTabModal());
    if (renameModalOverlay) {
      renameModalOverlay.addEventListener("click", (e) => {
        if (e.target === renameModalOverlay) this.closeRenameTabModal();
      });
    }
    if (renameModalSave) renameModalSave.addEventListener("click", () => this.saveRenameTab());
    if (renameInput) {
      renameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.saveRenameTab();
        }
      });
    }

    // Optimize Route
    const btnOptimize = document.getElementById("fsRouteBtnOptimize");
    if (btnOptimize) {
      btnOptimize.addEventListener("click", () => this.optimizeRoute());
    }

    // Go to Restaurant Search for batch selection
    const btnGoQuery = document.getElementById("fsRouteBtnGoQuery");
    if (btnGoQuery) {
      btnGoQuery.addEventListener("click", () => {
        if (window.switchTab) {
          window.switchTab("tab-restaurants");
        }
      });
    }

    // Clear Route
    const btnClear = document.getElementById("fsRouteBtnClear");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        if (confirm(i18n.t("fs_confirm_clear_route"))) {
          this.routeWaypoints = [];
          this.saveRouteWaypoints();
          this.renderRouteWaypoints();
        }
      });
    }

    // Waypoints search filter
    const searchInput = document.getElementById("fsRouteSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.routeSearchQuery = e.target.value.trim().toLowerCase();
        this.renderRouteWaypoints();
      });
    }

    // Select All
    const selectAllCb = document.getElementById("fsRouteSelectAll");
    if (selectAllCb) {
      selectAllCb.addEventListener("change", (e) => {
        const visible = this.getFilteredWaypoints();
        if (e.target.checked) {
          visible.forEach(w => this.selectedWaypointIds.add(w._uid));
        } else {
          visible.forEach(w => this.selectedWaypointIds.delete(w._uid));
        }
        this.renderRouteWaypoints();
      });
    }

    // Batch Navigate Selected
    const btnBatchNav = document.getElementById("fsRouteBtnBatchNav");
    if (btnBatchNav) {
      btnBatchNav.addEventListener("click", () => this.navigateSelectedWaypoints());
    }

    // Batch Delete Selected
    const btnBatchDelete = document.getElementById("fsRouteBtnBatchDelete");
    if (btnBatchDelete) {
      btnBatchDelete.addEventListener("click", () => this.deleteSelectedWaypoints());
    }

    // Export Excel
    const btnExportExcel = document.getElementById("fsRouteBtnExportExcel");
    if (btnExportExcel) {
      btnExportExcel.addEventListener("click", () => this.exportWaypointsToExcel());
    }

    // Route Navigation Modal listeners
    const navModalClose = document.getElementById("fsRouteNavModalClose");
    const navModalCancel = document.getElementById("fsRouteNavModalBtnCancel");
    const navModalOverlay = document.getElementById("fsRouteNavModalOverlay");
    if (navModalClose) navModalClose.addEventListener("click", () => this.closeRouteNavModal());
    if (navModalCancel) navModalCancel.addEventListener("click", () => this.closeRouteNavModal());
    if (navModalOverlay) {
      navModalOverlay.addEventListener("click", (e) => {
        if (e.target === navModalOverlay) this.closeRouteNavModal();
      });
    }

    // Navigation via Google Maps
    const btnNav = document.getElementById("fsRouteBtnNavigate");
    if (btnNav) {
      btnNav.addEventListener("click", () => this.openGoogleMapsNavigation());
    }
  },

  async loadRouteWaypoints() {
    // 1. Load local cache first for immediate responsiveness
    try {
      const savedTabs = localStorage.getItem(STORAGE_ROUTE_TABS_KEY);
      const activeId = localStorage.getItem(STORAGE_ACTIVE_TAB_KEY);

      if (savedTabs) {
        const parsedTabs = JSON.parse(savedTabs);
        if (Array.isArray(parsedTabs) && parsedTabs.length > 0) {
          this.routeTabs = parsedTabs;
          if (activeId && this.routeTabs.some(t => t.id === activeId)) {
            this.activeRouteTabId = activeId;
          } else {
            this.activeRouteTabId = this.routeTabs[0].id;
          }
          this.ensureWaypointUids();
        }
      } else {
        // Fallback to legacy single list
        const saved = localStorage.getItem(STORAGE_WAYPOINTS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            this.routeTabs = [{
              id: "tab_default",
              name: (typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_default_name") : "路线 1") || "路线 1",
              waypoints: parsed
            }];
            this.activeRouteTabId = "tab_default";
            this.ensureWaypointUids();
          }
        }
      }
    } catch (e) {
      this.getActiveRouteTab();
    }

    // 2. Fetch latest route waypoints and origin from Cloudflare Worker KV
    try {
      const res = await Api.getRouteWaypoints();
      if (res && res.success && res.data) {
        if (Array.isArray(res.data.tabs) && res.data.tabs.length > 0) {
          this.routeTabs = res.data.tabs;
          if (res.data.activeTabId && this.routeTabs.some(t => t.id === res.data.activeTabId)) {
            this.activeRouteTabId = res.data.activeTabId;
          } else {
            this.activeRouteTabId = this.routeTabs[0].id;
          }
          this.ensureWaypointUids();
          try {
            localStorage.setItem(STORAGE_ROUTE_TABS_KEY, JSON.stringify(this.routeTabs));
            localStorage.setItem(STORAGE_ACTIVE_TAB_KEY, this.activeRouteTabId);
          } catch (e) {}
        } else if (Array.isArray(res.data.waypoints)) {
          this.routeTabs = [{
            id: "tab_default",
            name: (typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_default_name") : "路线 1") || "路线 1",
            waypoints: res.data.waypoints
          }];
          this.activeRouteTabId = "tab_default";
          this.ensureWaypointUids();
          try {
            localStorage.setItem(STORAGE_ROUTE_TABS_KEY, JSON.stringify(this.routeTabs));
            localStorage.setItem(STORAGE_ACTIVE_TAB_KEY, this.activeRouteTabId);
          } catch (e) {}
        }

        if (res.data.origin) {
          this.originAddress = res.data.origin;
          try {
            localStorage.setItem(STORAGE_ORIGIN_KEY, this.originAddress);
          } catch (e) {}
          const originInput = document.getElementById("fsRouteOriginInput");
          if (originInput) originInput.value = this.originAddress;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch route waypoints from backend:", err);
    }
  },

  async saveRouteWaypoints() {
    this.getActiveRouteTab();
    // 1. Save to local storage
    try {
      localStorage.setItem(STORAGE_ROUTE_TABS_KEY, JSON.stringify(this.routeTabs));
      localStorage.setItem(STORAGE_ACTIVE_TAB_KEY, this.activeRouteTabId);
      localStorage.setItem(STORAGE_WAYPOINTS_KEY, JSON.stringify(this.routeWaypoints));
    } catch (e) {
      console.warn("Failed to persist route waypoints to local storage:", e);
    }

    // 2. Save to backend KV
    try {
      await Api.saveRouteWaypoints(this.routeWaypoints, this.originAddress, this.routeTabs, this.activeRouteTabId);
    } catch (err) {
      console.warn("Failed to persist route waypoints to backend:", err);
    }
  },

  renderRouteTabs() {
    if (typeof document === "undefined") return;
    const barEl = document.getElementById("fsRouteTabsBar");
    if (!barEl) return;

    this.getActiveRouteTab();
    const canDelete = this.routeTabs.length > 1;

    barEl.innerHTML = this.routeTabs.map(tab => {
      const isActive = tab.id === this.activeRouteTabId;
      const count = tab.waypoints ? tab.waypoints.length : 0;
      return `
        <div class="fs-route-tab-pill ${isActive ? 'active' : ''}" data-tab-id="${tab.id}">
          <span class="fs-route-tab-name" title="${Restaurants.escapeHtml(tab.name)}">${Restaurants.escapeHtml(tab.name)}</span>
          <span class="fs-route-tab-count">${count}</span>
          <div class="fs-route-tab-actions">
            <button class="fs-route-tab-action-btn" data-action="rename" data-tab-id="${tab.id}" title="${i18n.t("fs_route_tab_rename")}">${i18n.t("fs_route_tab_rename")}</button>
            <button class="fs-route-tab-action-btn" data-action="duplicate" data-tab-id="${tab.id}" title="${i18n.t("fs_route_tab_duplicate")}">${i18n.t("fs_route_tab_duplicate")}</button>
            ${canDelete ? `<button class="fs-route-tab-action-btn fs-route-tab-del-btn" data-action="delete" data-tab-id="${tab.id}" title="${i18n.t("fs_route_tab_delete")}">${i18n.t("fs_route_tab_delete")}</button>` : ''}
          </div>
        </div>
      `;
    }).join("");

    // Bind tab pill click and action button clicks
    barEl.querySelectorAll(".fs-route-tab-pill").forEach(pill => {
      pill.addEventListener("click", (e) => {
        const actionBtn = e.target.closest(".fs-route-tab-action-btn");
        const tabId = pill.dataset.tabId;
        if (actionBtn) {
          e.stopPropagation();
          const action = actionBtn.dataset.action;
          if (action === "rename") {
            this.openRenameTabModal(tabId);
          } else if (action === "duplicate") {
            this.duplicateRouteTab(tabId);
          } else if (action === "delete") {
            this.deleteRouteTab(tabId);
          }
        } else {
          this.switchRouteTab(tabId);
        }
      });
    });
  },

  switchRouteTab(tabId) {
    if (!this.routeTabs.some(t => t.id === tabId)) return;
    this.activeRouteTabId = tabId;
    this.selectedWaypointIds.clear();
    this.routeSearchQuery = "";
    const searchInput = document.getElementById("fsRouteSearchInput");
    if (searchInput) searchInput.value = "";

    try {
      localStorage.setItem(STORAGE_ACTIVE_TAB_KEY, this.activeRouteTabId);
    } catch (e) {}

    this.renderRouteTabs();
    this.renderRouteWaypoints();
  },

  createRouteTab(name = null) {
    if (!name) {
      let num = this.routeTabs.length + 1;
      while (this.routeTabs.some(t => t.name === `路线 ${num}` || t.name === `Route ${num}`)) {
        num++;
      }
      name = `路线 ${num}`;
    }

    const newTab = {
      id: "tab_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      waypoints: []
    };

    this.routeTabs.push(newTab);
    this.activeRouteTabId = newTab.id;
    this.selectedWaypointIds.clear();

    this.saveRouteWaypoints();
    this.renderRouteTabs();
    this.renderRouteWaypoints();

    const msg = `已新建路线标签「${newTab.name}」`;
    if (window.showToast) window.showToast(msg);
    return newTab;
  },

  duplicateRouteTab(tabId) {
    const targetTab = this.routeTabs.find(t => t.id === tabId) || this.getActiveRouteTab();
    if (!targetTab) return;

    const copySuffix = (typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_copy_suffix") : " (副本)") || " (副本)";
    const newName = `${targetTab.name}${copySuffix}`;

    const newTab = {
      id: "tab_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: newName,
      waypoints: (targetTab.waypoints || []).map(w => ({
        ...w,
        _uid: `wp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      }))
    };

    this.routeTabs.push(newTab);
    this.activeRouteTabId = newTab.id;
    this.selectedWaypointIds.clear();

    this.saveRouteWaypoints();
    this.renderRouteTabs();
    this.renderRouteWaypoints();

    const msg = `已复制为新路线标签「${newTab.name}」`;
    if (window.showToast) window.showToast(msg);
    return newTab;
  },

  openRenameTabModal(tabId) {
    const tab = this.routeTabs.find(t => t.id === tabId);
    if (!tab) return;
    this._renamingTabId = tabId;
    const modal = document.getElementById("fsRouteRenameModalOverlay");
    const input = document.getElementById("fsRouteRenameInput");
    if (input) input.value = tab.name;
    if (modal) modal.classList.add("active");
    if (input) setTimeout(() => input.focus(), 50);
  },

  closeRenameTabModal() {
    this._renamingTabId = null;
    const modal = document.getElementById("fsRouteRenameModalOverlay");
    if (modal) modal.classList.remove("active");
  },

  saveRenameTab() {
    const input = document.getElementById("fsRouteRenameInput");
    const newName = input ? input.value.trim() : "";
    if (!newName) {
      alert(i18n.t("fs_route_tab_rename_empty") || "标签名称不能为空");
      return;
    }
    const tab = this.routeTabs.find(t => t.id === this._renamingTabId);
    if (tab) {
      tab.name = newName;
      this.saveRouteWaypoints();
      this.renderRouteTabs();
    }
    this.closeRenameTabModal();
  },

  deleteRouteTab(tabId) {
    if (this.routeTabs.length <= 1) {
      const msg = i18n.t("fs_route_tab_min_alert") || "至少保留一个路线标签";
      if (window.showToast) window.showToast(msg);
      else alert(msg);
      return;
    }

    const tab = this.routeTabs.find(t => t.id === tabId);
    if (!tab) return;

    const confirmMsg = i18n.t("fs_route_tab_delete_confirm", { name: tab.name }) || `确定要删除标签「${tab.name}」及其中的站点吗？`;
    if (!confirm(confirmMsg)) return;

    this.routeTabs = this.routeTabs.filter(t => t.id !== tabId);
    if (this.activeRouteTabId === tabId) {
      this.activeRouteTabId = this.routeTabs[0].id;
    }
    this.selectedWaypointIds.clear();

    this.saveRouteWaypoints();
    this.renderRouteTabs();
    this.renderRouteWaypoints();
  },

  openManualAddModal() {
    const modal = document.getElementById("fsRouteManualAddModalOverlay");
    const input = document.getElementById("fsRouteManualAddressesInput");
    const tabGroup = document.getElementById("fsRouteManualTabGroup");
    const tabSelect = document.getElementById("fsRouteManualTargetTabSelect");
    if (!modal) return;

    if (input) input.value = "";

    if (tabGroup && tabSelect) {
      if (this.routeTabs.length > 1) {
        tabGroup.style.display = "block";
        tabSelect.innerHTML = this.routeTabs.map(t => {
          return `<option value="${t.id}" ${t.id === this.activeRouteTabId ? 'selected' : ''}>${Restaurants.escapeHtml(t.name)} (${t.waypoints ? t.waypoints.length : 0})</option>`;
        }).join("");
      } else {
        tabGroup.style.display = "none";
      }
    }

    modal.classList.add("active");
    if (input) setTimeout(() => input.focus(), 50);
  },

  closeManualAddModal() {
    const modal = document.getElementById("fsRouteManualAddModalOverlay");
    if (modal) modal.classList.remove("active");
  },

  openSelectTabModal(restaurants, jumpToTab = false) {
    if (typeof document === "undefined") {
      const soleTab = this.getActiveRouteTab();
      this.executeAddMultipleToRoute(restaurants, soleTab.id, jumpToTab);
      return;
    }
    this._pendingImportRestaurants = restaurants;
    this._pendingImportJumpToTab = jumpToTab;

    const modal = document.getElementById("fsRouteSelectTabModalOverlay");
    const listEl = document.getElementById("fsRouteSelectTabOptionsList");
    if (!modal || !listEl) return;

    listEl.innerHTML = this.routeTabs.map((tab) => {
      const isChecked = tab.id === this.activeRouteTabId;
      return `
        <label style="display: flex; align-items: center; gap: 0.65rem; padding: 0.6rem 0.8rem; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; background: #fff; transition: background 0.15s;">
          <input type="radio" name="fsSelectRouteTabRadio" value="${tab.id}" ${isChecked ? "checked" : ""} style="width: 16px; height: 16px; cursor: pointer;">
          <div style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600; font-size: 0.9rem; color: #1e293b;">${Restaurants.escapeHtml(tab.name)}</span>
            <span style="color: #64748b; font-size: 0.8rem;">(${tab.waypoints ? tab.waypoints.length : 0})</span>
          </div>
        </label>
      `;
    }).join("");

    modal.classList.add("active");
  },

  closeSelectTabModal() {
    this._pendingImportRestaurants = null;
    this._pendingImportJumpToTab = false;
    const modal = document.getElementById("fsRouteSelectTabModalOverlay");
    if (modal) modal.classList.remove("active");
  },

  extractPostalCode(str) {
    if (!str) return null;
    const match = str.match(/\b([A-Za-z]\d[A-Za-z])[\s-]?(\d[A-Za-z]\d)\b/);
    if (match) {
      return {
        full: (match[1] + match[2]).toUpperCase(),
        fsa: match[1].toUpperCase(),
        formatted: `${match[1].toUpperCase()} ${match[2].toUpperCase()}`
      };
    }
    return null;
  },

  normalizeStreet(str) {
    if (!str) return "";
    let s = str.toLowerCase();
    s = s.replace(/\b[a-z]\d[a-z][\s-]?\d[a-z]\d\b/gi, " ");
    s = s.replace(/\b(canada|ca|ontario|on)\b/gi, " ");
    s = s.replace(/\b(unit|suite|ste|apt|bldg|building|#)\s*[\w\d-]+/gi, " ");
    s = s.replace(/\bavenue\b/g, "ave")
         .replace(/\bstreet\b/g, "st")
         .replace(/\broad\b/g, "rd")
         .replace(/\bboulevard\b/g, "blvd")
         .replace(/\bdrive\b/g, "dr")
         .replace(/\bcourt\b/g, "ct")
         .replace(/\bcrescent\b/g, "cres")
         .replace(/\bplace\b/g, "pl")
         .replace(/\bhighway\b/g, "hwy")
         .replace(/\bparkway\b/g, "pkwy")
         .replace(/\blane\b/g, "ln");
    s = s.replace(/\beast\b/g, "e")
         .replace(/\bwest\b/g, "w")
         .replace(/\bnorth\b/g, "n")
         .replace(/\bsouth\b/g, "s");
    s = s.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
    return s;
  },

  extractStreetNumber(str) {
    const norm = this.normalizeStreet(str);
    const match = norm.match(/\b(\d+)\b/);
    return match ? match[1] : null;
  },

  matchAddressToRestaurant(inputAddress, candidates = null) {
    const list = candidates || this.cachedRestaurants || (typeof Restaurants !== "undefined" ? (Restaurants.fullDataset || Restaurants.allRestaurants) : []);
    if (!inputAddress || !Array.isArray(list) || list.length === 0) return null;
    const inputPostal = this.extractPostalCode(inputAddress);
    const inputNum = this.extractStreetNumber(inputAddress);
    const inputNormStreet = this.normalizeStreet(inputAddress);

    // 1. First priority: Postal Code Matching
    if (inputPostal) {
      const postalMatches = list.filter(r => {
        const rPostal = this.extractPostalCode(r.address);
        return rPostal && rPostal.full === inputPostal.full;
      });

      if (postalMatches.length === 1) {
        const rNum = this.extractStreetNumber(postalMatches[0].address);
        if (!inputNum || !rNum || inputNum === rNum) {
          return postalMatches[0];
        }
      } else if (postalMatches.length > 1) {
        if (inputNum) {
          const numMatch = postalMatches.find(r => this.extractStreetNumber(r.address) === inputNum);
          if (numMatch) return numMatch;
        }
        const inputWords = inputNormStreet.split(" ").filter(w => w.length > 2 && w !== inputNum);
        for (const r of postalMatches) {
          const rNorm = this.normalizeStreet(r.address);
          if (inputWords.some(w => rNorm.includes(w))) {
            return r;
          }
        }
        return postalMatches[0];
      }
    }

    // 2. Second priority: Street Number + Street Name Keyword Matching
    if (inputNum) {
      const numCandidates = list.filter(r => this.extractStreetNumber(r.address) === inputNum);
      if (numCandidates.length > 0) {
        let bestScore = 0;
        let bestMatch = null;
        const inputWords = inputNormStreet.split(" ").filter(w => w.length > 2 && w !== inputNum);

        for (const r of numCandidates) {
          const rNorm = this.normalizeStreet(r.address);
          let score = 0;
          for (const word of inputWords) {
            if (rNorm.includes(word)) score += 2;
          }
          if (inputPostal) {
            const rPostal = this.extractPostalCode(r.address);
            if (rPostal && rPostal.fsa === inputPostal.fsa) score += 3;
          }
          if (score > bestScore && score >= 2) {
            bestScore = score;
            bestMatch = r;
          }
        }
        if (bestMatch) return bestMatch;
      }
    }

    // 3. Third priority: Check if line directly contains restaurant name
    const lowerInput = inputAddress.toLowerCase();
    const nameMatch = list.find(r => r.name && lowerInput.includes(r.name.toLowerCase()));
    if (nameMatch) return nameMatch;

    return null;
  },

  async batchAddAddressesFromText(rawText, targetTabId = null) {
    if (!rawText || !rawText.trim()) return;

    let pool = this.cachedRestaurants || [];
    if (pool.length < 500 && window.Restaurants && Array.isArray(window.Restaurants.fullDataset) && window.Restaurants.fullDataset.length > 0) {
      pool = window.Restaurants.fullDataset;
      this.cachedRestaurants = pool;
    }
    if (pool.length === 0) {
      try {
        const res = await Api.queryAllRestaurants(3500);
        if (res && res.success && Array.isArray(res.data)) {
          pool = res.data;
          this.cachedRestaurants = pool;
        }
      } catch (e) {}
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const targetTab = this.routeTabs.find(t => t.id === targetTabId) || this.getActiveRouteTab();
    let addedCount = 0;

    lines.forEach(line => {
      const matched = this.matchAddressToRestaurant(line, pool);
      let stopItem;
      if (matched) {
        stopItem = {
          ...matched,
          _uid: matched.placeId ? `wp_${matched.placeId}` : `wp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          _matched: true,
          _sourceAddress: line
        };
      } else {
        stopItem = {
          _uid: `wp_custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: line,
          address: line,
          region: "GTA",
          latitude: 43.6532,
          longitude: -79.3832,
          placeId: `addr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          isCustomAddress: true,
          _matched: false,
          _sourceAddress: line
        };
      }

      const exists = targetTab.waypoints.some(w => 
        (stopItem.placeId && !stopItem.isCustomAddress && w.placeId === stopItem.placeId) ||
        (w.name === stopItem.name && w.address === stopItem.address) ||
        (stopItem.isCustomAddress && w.address === stopItem.address)
      );

      if (!exists) {
        targetTab.waypoints.push(stopItem);
        addedCount++;
      }
    });

    this.activeRouteTabId = targetTab.id;
    this.saveRouteWaypoints();
    this.renderRouteTabs();
    this.renderRouteWaypoints();

    const toastMsg = i18n.t ? i18n.t("fs_route_manual_result_toast", { total: addedCount }) : `成功添加 ${addedCount} 个站点`;
    if (window.showToast) window.showToast(toastMsg);
    else alert(toastMsg);
  },

  populateRestaurantDatalist() {
    const listEl = document.getElementById("fsRestaurantsDatalist");
    if (!listEl) return;
    listEl.innerHTML = this.cachedRestaurants.slice(0, 150).map(r => {
      return `<option value="${r.name}">${Restaurants.escapeHtml(Restaurants.formatRegion(r.region))} · ${r.address || ""}</option>`;
    }).join("");
  },

  ensureWaypointUids() {
    if (Array.isArray(this.routeTabs)) {
      this.routeTabs.forEach(tab => {
        if (Array.isArray(tab.waypoints)) {
          tab.waypoints.forEach((w, idx) => {
            if (!w._uid) {
              w._uid = w.placeId ? `wp_${w.placeId}` : `wp_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            }
          });
        }
      });
    }
  },

  normalizeRestaurantName(restaurant) {
    if (!restaurant) return restaurant;
    const all = [
      ...(this.cachedRestaurants || []),
      ...(window.Restaurants?.fullDataset || []),
      ...(window.MapExplorer?.allRestaurants || [])
    ];
    const normName = (restaurant.name || "").trim().toLowerCase();
    const match = all.find(r => 
      (restaurant.placeId && r.placeId === restaurant.placeId) ||
      ((r.name || "").trim().toLowerCase() === normName)
    );
    if (match) {
      if (match.name && match.name !== restaurant.name) {
        if (!restaurant.nameEn) restaurant.nameEn = restaurant.name;
        restaurant.name = match.name;
        if (restaurant._raw) restaurant._raw["餐馆名称 (Name)"] = match.name;
      }
      if ((!restaurant.openingHours || restaurant.openingHours === "未提供") && match.openingHours && match.openingHours !== "未提供") {
        restaurant.openingHours = match.openingHours;
      }
      if (!restaurant._raw && match._raw) {
        restaurant._raw = match._raw;
      }
      if (!restaurant.phone && match.phone) {
        restaurant.phone = match.phone;
      }
      if (!restaurant.address && match.address) {
        restaurant.address = match.address;
      }
      if (!restaurant.nameEn && match.nameEn) {
        restaurant.nameEn = match.nameEn;
      }
    }
    return restaurant;
  },

  enrichExistingWaypoints() {
    if (!Array.isArray(this.routeWaypoints) || this.routeWaypoints.length === 0) return;
    let changed = false;
    this.routeWaypoints.forEach(w => {
      const beforeHours = w.openingHours;
      this.normalizeRestaurantName(w);
      if (w.openingHours !== beforeHours) changed = true;
    });
    if (changed) {
      this.saveRouteWaypoints();
      this.renderRouteWaypoints();
    }
  },

  getFilteredWaypoints() {
    this.ensureWaypointUids();
    if (!this.routeSearchQuery) {
      return this.routeWaypoints;
    }
    const q = this.routeSearchQuery.toLowerCase();
    return this.routeWaypoints.filter(w => {
      const name = (w.name || "").toLowerCase();
      const nameEn = (w.nameEn || "").toLowerCase();
      const address = (w.address || "").toLowerCase();
      const phone = (w.phone || "").toLowerCase();
      return name.includes(q) || nameEn.includes(q) || address.includes(q) || phone.includes(q);
    });
  },

  addRestaurantToRoute(restaurant, jumpToTab = false, targetTabId = null) {
    if (!restaurant) return;
    this.addMultipleToRoute([restaurant], jumpToTab, targetTabId);
  },

  addMultipleToRoute(restaurants, jumpToTab = false, targetTabId = null) {
    if (!Array.isArray(restaurants) || restaurants.length === 0) return;

    if (targetTabId) {
      this.executeAddMultipleToRoute(restaurants, targetTabId, jumpToTab);
      return;
    }

    if (this.routeTabs.length <= 1) {
      const soleTab = this.getActiveRouteTab();
      this.executeAddMultipleToRoute(restaurants, soleTab.id, jumpToTab);
      return;
    }

    this.openSelectTabModal(restaurants, jumpToTab);
  },

  executeAddMultipleToRoute(restaurants, targetTabId, jumpToTab = false) {
    if (!Array.isArray(restaurants) || restaurants.length === 0) return;
    const targetTab = this.routeTabs.find(t => t.id === targetTabId) || this.getActiveRouteTab();

    let addedCount = 0;
    restaurants.forEach(r => {
      r = this.normalizeRestaurantName(r);
      const exists = targetTab.waypoints.some(w => (w.placeId && w.placeId === r.placeId) || w.name === r.name);
      if (!exists) {
        if (!r._uid) {
          r._uid = r.placeId ? `wp_${r.placeId}` : `wp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        }
        targetTab.waypoints.push(r);
        addedCount++;
      }
    });

    this.saveRouteWaypoints();
    this.renderRouteTabs();
    this.renderRouteWaypoints();

    if (jumpToTab && window.switchTab) {
      window.switchTab("tab-fieldsale");
      this.switchSubTab("route");
    }

    if (addedCount > 0) {
      const skipped = restaurants.length - addedCount;
      const skipMsg = skipped > 0 ? (i18n.t ? i18n.t("fs_msg_batch_skipped", { count: skipped }) : ` (跳过 ${skipped} 家已存在站点)`) : "";
      const msg = (i18n.t ? i18n.t("fs_msg_batch_added", { count: addedCount, skipMsg }) : `成功添加 ${addedCount} 家餐馆到路线${skipMsg}`) + ` [${targetTab.name}]`;
      if (window.showToast) window.showToast(msg);
      else alert(msg);
    } else {
      const msg = (i18n.t ? i18n.t("fs_msg_all_in_route") : "所选餐馆均已在路线中") + ` [${targetTab.name}]`;
      if (window.showToast) window.showToast(msg);
      else alert(msg);
    }
  },

  moveWaypoint(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= this.routeWaypoints.length) return;
    const temp = this.routeWaypoints[index];
    this.routeWaypoints[index] = this.routeWaypoints[targetIdx];
    this.routeWaypoints[targetIdx] = temp;
    this.saveRouteWaypoints();
    this.renderRouteWaypoints();
  },

  removeWaypoint(index) {
    const removed = this.routeWaypoints.splice(index, 1)[0];
    if (removed && removed._uid) {
      this.selectedWaypointIds.delete(removed._uid);
    }
    this.saveRouteWaypoints();
    this.renderRouteWaypoints();
  },

  deleteSelectedWaypoints() {
    if (this.selectedWaypointIds.size === 0) {
      alert(i18n.t("fs_route_alert_select_to_delete") || "请先勾选需要删除的途经站点！");
      return;
    }
    const count = this.selectedWaypointIds.size;
    const confirmMsg = i18n.t("fs_route_confirm_batch_delete", { count }) || `确定从路线中移除选中的 ${count} 个途经站点吗？`;
    if (!confirm(confirmMsg)) return;

    this.routeWaypoints = this.routeWaypoints.filter(w => !this.selectedWaypointIds.has(w._uid));
    this.selectedWaypointIds.clear();
    this.saveRouteWaypoints();
    this.renderRouteWaypoints();
    const msg = `已移除 ${count} 个站点`;
    if (window.showToast) window.showToast(msg);
    else alert(msg);
  },

  navigateSelectedWaypoints() {
    if (this.selectedWaypointIds.size === 0) {
      alert(i18n.t("fs_route_alert_select_to_nav") || "请先勾选需要导航的途经站点！");
      return;
    }
    const targets = this.routeWaypoints.filter(w => this.selectedWaypointIds.has(w._uid));
    this.openEnhancedGoogleMapsNavigation(targets);
  },

  optimizeRoute() {
    if (this.routeWaypoints.length < 2) {
      alert(i18n.t("fs_alert_min_waypoints"));
      return;
    }

    // Start location coordinates (Downtown Toronto / Green Oil HQ)
    let curLat = 43.6532;
    let curLng = -79.3832;

    const remaining = [...this.routeWaypoints];
    const optimized = [];

    while (remaining.length > 0) {
      let closestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const rLat = parseFloat(item.latitude) || 43.76;
        const rLng = parseFloat(item.longitude) || -79.41;
        const dist = this.getHaversineDistance(curLat, curLng, rLat, rLng);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      const closest = remaining.splice(closestIdx, 1)[0];
      optimized.push(closest);
      curLat = parseFloat(closest.latitude) || curLat;
      curLng = parseFloat(closest.longitude) || curLng;
    }

    this.routeWaypoints = optimized;
    this.saveRouteWaypoints();
    this.renderRouteWaypoints();
    const msg = i18n.t("fs_msg_optimized");
    if (window.showToast) window.showToast(msg);
    else alert(msg);
  },

  getEffectiveOrigin() {
    const originInput = typeof document !== "undefined" ? document.getElementById("fsRouteOriginInput") : null;
    const address = originInput ? originInput.value.trim() : this.originAddress;
    return {
      name: "Green Oil Inc",
      address: address || DEFAULT_ORIGIN_ADDRESS,
      lat: 43.6532,
      lng: -79.3832
    };
  },

  buildGoogleMapsSlashUrl(originAddress, stops) {
    const originStr = encodeURIComponent(originAddress);
    const stopStrs = stops.map(s => {
      const isCustom = !!s.isCustomAddress || s.name === s.address;
      const target = isCustom ? (s.address || s.name || "") : ((s.name ? s.name + ", " : "") + (s.address || ""));
      return encodeURIComponent(target);
    });
    return `https://www.google.com/maps/dir/${originStr}/${stopStrs.join("/")}/`;
  },

  buildRouteLegs(originAddress, stops) {
    const legs = [];
    const step = 9;
    const totalLegs = Math.ceil(stops.length / step);

    for (let i = 0; i < totalLegs; i++) {
      const startIdx = i * step;
      const endIdx = Math.min(startIdx + step, stops.length);
      const legStops = stops.slice(startIdx, endIdx);
      
      const legOrigin = i === 0 ? originAddress : ((stops[startIdx - 1].name ? stops[startIdx - 1].name + ", " : "") + (stops[startIdx - 1].address || ""));
      const legUrl = this.buildGoogleMapsSlashUrl(legOrigin, legStops);

      const fromLabel = i === 0 ? "Green Oil HQ" : (stops[startIdx - 1].name || `第 ${startIdx} 站`);
      const toLabel = legStops[legStops.length - 1].name || `第 ${endIdx} 站`;

      legs.push({
        legIndex: i + 1,
        from: fromLabel,
        to: toLabel,
        stopsCount: legStops.length,
        stopNames: legStops.map(s => s.name).join(" → "),
        url: legUrl
      });
    }

    return legs;
  },

  openRouteNavModal(originAddress, targetWaypoints, fullSlashUrl) {
    if (typeof document === "undefined") return;
    const modalOverlay = document.getElementById("fsRouteNavModalOverlay");
    const tipEl = document.getElementById("fsRouteNavModalTip");
    const btnFull = document.getElementById("fsRouteNavBtnFull");
    const btnOpenAll = document.getElementById("fsRouteNavBtnOpenAll");
    const legsListEl = document.getElementById("fsRouteNavLegsList");

    if (!modalOverlay) return;

    if (tipEl) {
      tipEl.textContent = i18n.t("fs_route_nav_modal_tip", { count: targetWaypoints.length }) || `当前共有 ${targetWaypoints.length} 个地点。建议手机端按路段分段导航，网页端可直接打开完整拼接路线。`;
    }

    const legs = this.buildRouteLegs(originAddress, targetWaypoints);

    if (btnFull) {
      btnFull.onclick = () => window.open(fullSlashUrl, "_blank");
    }

    if (btnOpenAll) {
      btnOpenAll.onclick = () => {
        legs.forEach(leg => {
          window.open(leg.url, "_blank");
        });
      };
    }

    if (legsListEl) {
      legsListEl.innerHTML = legs.map(leg => `
        <div class="fs-route-nav-leg-card">
          <div class="fs-route-nav-leg-info">
            <div class="fs-route-nav-leg-title">
              ${i18n.t("fs_route_nav_leg_title", { leg: leg.legIndex, from: leg.from, to: leg.to, count: leg.stopsCount }) || `第 ${leg.legIndex} 段：${leg.from} → ${leg.to} (共 ${leg.stopsCount} 站)`}
            </div>
            <div class="fs-route-nav-leg-stops" title="${Restaurants.escapeHtml(leg.stopNames)}">
              ${Restaurants.escapeHtml(leg.stopNames)}
            </div>
          </div>
          <button class="btn btn-sm btn-primary fs-btn-leg-nav" data-url="${encodeURI(leg.url)}" style="white-space: nowrap; font-size: 0.8rem; padding: 0.4rem 0.75rem; background: #2563eb; border-color: #2563eb; color: white;">
            ${i18n.t("fs_route_nav_btn_leg") || "开启此段导航"}
          </button>
        </div>
      `).join("");

      legsListEl.querySelectorAll(".fs-btn-leg-nav").forEach(btn => {
        btn.addEventListener("click", () => {
          const url = decodeURI(btn.dataset.url);
          window.open(url, "_blank");
        });
      });
    }

    modalOverlay.classList.add("active");
  },

  closeRouteNavModal() {
    if (typeof document === "undefined") return;
    const modalOverlay = document.getElementById("fsRouteNavModalOverlay");
    if (modalOverlay) modalOverlay.classList.remove("active");
  },

  openEnhancedGoogleMapsNavigation(targetWaypoints) {
    if (!targetWaypoints || targetWaypoints.length === 0) {
      alert(i18n.t("fs_alert_no_waypoints"));
      return;
    }

    const origin = this.getEffectiveOrigin();
    const originAddress = origin.address || DEFAULT_ORIGIN_ADDRESS;
    const fullSlashUrl = this.buildGoogleMapsSlashUrl(originAddress, targetWaypoints);

    // If 9 or fewer stops, total points <= 10, open directly
    if (targetWaypoints.length <= 9) {
      window.open(fullSlashUrl, "_blank");
      return;
    }

    // More than 9 stops: Show segmented navigation modal
    this.openRouteNavModal(originAddress, targetWaypoints, fullSlashUrl);
  },

  openGoogleMapsNavigation() {
    if (this.routeWaypoints.length === 0) {
      alert(i18n.t("fs_alert_no_waypoints"));
      return;
    }

    const targets = this.selectedWaypointIds.size > 0
      ? this.routeWaypoints.filter(w => this.selectedWaypointIds.has(w._uid))
      : this.routeWaypoints;

    this.openEnhancedGoogleMapsNavigation(targets);
  },

  formatWaypointVisitRecords(waypoint) {
    if (!this.salesRecords || this.salesRecords.length === 0) {
      return i18n.t("visited_no") || "未拜访";
    }
    const normWpName = (waypoint.name || "").trim().toLowerCase();
    const records = this.salesRecords.filter(r => 
      (waypoint.placeId && r.restaurantId && r.restaurantId === waypoint.placeId) ||
      (r.restaurantName && r.restaurantName.trim().toLowerCase() === normWpName)
    );

    if (records.length === 0) {
      return i18n.t("visited_no") || "未拜访";
    }

    return records.map((r, i) => {
      const timeStr = r.visitTime ? r.visitTime.slice(0, 10) : "";
      const methodStr = r.method === "onsite" ? (i18n.t("fs_method_onsite") || "现场拜访") : (i18n.t("fs_method_phone") || "电话沟通");
      const outcomeStr = this.getOutcomeText(r.outcome);
      let details = `[${timeStr} ${methodStr} - ${outcomeStr}]`;
      if (r.notes) details += ` 纪要: ${r.notes}`;
      if (r.competitorName) details += ` 竞品: ${r.competitorName}`;
      if (r.competitorQuote) details += ` 报价: ${r.competitorQuote}`;
      return `${i + 1}. ${details}`;
    }).join("\r\n");
  },

  formatWeekdayOpeningHours(rawHours) {
    if (!rawHours) return "未提供";

    // Handle array or object formats if passed
    let rawStr = "";
    if (typeof rawHours === "string") {
      rawStr = rawHours;
    } else if (Array.isArray(rawHours)) {
      rawStr = rawHours.join("\n");
    } else if (typeof rawHours === "object") {
      if (Array.isArray(rawHours.weekdayDescriptions)) {
        rawStr = rawHours.weekdayDescriptions.join("\n");
      } else {
        rawStr = Object.entries(rawHours).map(([k, v]) => `${k}: ${v}`).join("\n");
      }
    } else {
      rawStr = String(rawHours);
    }

    // 1. Normalize spaces, hidden zero-width chars and tabs
    let cleanStr = rawStr
      .replace(/[\u202F\u00A0\u2009\u200A\u3000]/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();

    if (!cleanStr || cleanStr === "未提供" || cleanStr === "无") return "未提供";

    // 2. Pre-process: Insert newline before any day name if concatenated without newline (e.g. "...8:00 PMTuesday:...")
    cleanStr = cleanStr.replace(
      /([^\r\n])\s*(?=(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon\b|tue\b|wed\b|thu\b|fri\b|sat\b|sun\b|星期[一二三四五六日天]|周[一二三四五六日天])[\s:：])/gi,
      "$1\n"
    );

    const lines = cleanStr.split(/[\r\n;]+/).map(s => s.trim()).filter(Boolean);

    const WEEKDAYS = [
      { dayIndex: 1, name: "周一", regex: /^(monday\b|mon\b|星期一|周一)(?![~–\-至到])[\s:：]*/i },
      { dayIndex: 2, name: "周二", regex: /^(tuesday\b|tue\b|星期二|周二)(?![~–\-至到])[\s:：]*/i },
      { dayIndex: 3, name: "周三", regex: /^(wednesday\b|wed\b|星期三|周三)(?![~–\-至到])[\s:：]*/i },
      { dayIndex: 4, name: "周四", regex: /^(thursday\b|thu\b|星期四|周四)(?![~–\-至到])[\s:：]*/i },
      { dayIndex: 5, name: "周五", regex: /^(friday\b|fri\b|星期五|周五)(?![~–\-至到])[\s:：]*/i }
    ];

    const parsedDays = new Map();

    for (const line of lines) {
      for (const wd of WEEKDAYS) {
        if (wd.regex.test(line)) {
          let timePart = line.replace(wd.regex, "").trim().replace(/\s+/g, " ");
          if (/^(closed|close|休息|打烊|不营业|off)$/i.test(timePart) || timePart.includes("closed") || timePart.includes("休息")) {
            timePart = "休息";
          }
          parsedDays.set(wd.dayIndex, { name: wd.name, time: timePart });
          break;
        }
      }
    }

    // If weekday entries are not found or fewer than 3 found (e.g. single line range or malformed)
    if (parsedDays.size < 3) {
      const prefixPattern = /^(?:mon(?:day)?\s*[-–~至到]\s*(?:sun(?:day)?|fri(?:day)?)|周一\s*[-–~至到]\s*(?:周日|周天|星期日|星期天|周五|星期五))[\s:：]*/i;
      const simplified = cleanStr.replace(prefixPattern, "").trim();
      return simplified || cleanStr;
    }

    // We have at least 3 weekdays. Construct list for Mon-Fri (1..5)
    const weekdayList = [1, 2, 3, 4, 5].map(idx => {
      return parsedDays.get(idx) || null;
    });

    // Count frequencies of known times
    const freqMap = new Map();
    for (const item of weekdayList) {
      if (item && item.time) {
        freqMap.set(item.time, (freqMap.get(item.time) || 0) + 1);
      }
    }

    // Find most frequent time (usual time). Prefer non-"休息" if counts tie
    let usualTime = "";
    let maxScore = -1;
    for (const [time, count] of freqMap.entries()) {
      const score = count * 10 + (time !== "休息" ? 1 : 0);
      if (score > maxScore) {
        maxScore = score;
        usualTime = time;
      }
    }

    // Fill any missing weekday with usualTime
    for (let i = 0; i < 5; i++) {
      if (!weekdayList[i]) {
        weekdayList[i] = { name: WEEKDAYS[i].name, time: usualTime };
      }
    }

    // Check if all 5 weekdays equal usualTime
    const specialDays = weekdayList.filter(item => item.time !== usualTime);
    if (specialDays.length === 0) {
      return usualTime;
    }

    // Group special days by their time
    const specialDaysByTime = new Map();
    for (const item of specialDays) {
      if (!specialDaysByTime.has(item.time)) {
        specialDaysByTime.set(item.time, []);
      }
      specialDaysByTime.get(item.time).push(item.name);
    }

    const specialParts = [];
    for (const [time, dayNames] of specialDaysByTime.entries()) {
      const daysStr = dayNames.join("、");
      if (time === "休息") {
        specialParts.push(`${daysStr}休息`);
      } else {
        specialParts.push(`${daysStr}: ${time}`);
      }
    }

    return `${usualTime} (${specialParts.join(", ")})`;
  },

  async exportWaypointsToExcel() {
    const targets = this.selectedWaypointIds.size > 0
      ? this.routeWaypoints.filter(w => this.selectedWaypointIds.has(w._uid))
      : this.routeWaypoints;

    if (targets.length === 0) {
      alert(i18n.t("fs_alert_no_waypoints"));
      return;
    }

    // 1. Normalize and enrich from in-memory cache
    targets.forEach(w => this.normalizeRestaurantName(w));

    // 2. If any target is still missing openingHours, query backend API
    const missing = targets.filter(w => (!w.openingHours || w.openingHours === "未提供") && (w.placeId || w.name));
    if (missing.length > 0) {
      const api = (typeof window !== "undefined" && window.Api) ? window.Api : (typeof Api !== "undefined" ? Api : null);
      if (api && typeof api.queryRestaurants === "function") {
        try {
          await Promise.all(missing.map(async w => {
            try {
              const keyword = w.name || w.placeId;
              const res = await api.queryRestaurants({ keyword, pageSize: 5 });
              if (res && res.success && Array.isArray(res.data)) {
                const found = res.data.find(r => 
                  (w.placeId && r.placeId === w.placeId) || 
                  ((r.name || "").trim().toLowerCase() === (w.name || "").trim().toLowerCase())
                );
                if (found && found.openingHours && found.openingHours !== "未提供") {
                  w.openingHours = found.openingHours;
                  if (!w.nameEn && found.nameEn) w.nameEn = found.nameEn;
                  if (!w.phone && found.phone) w.phone = found.phone;
                  if (!w.address && found.address) w.address = found.address;
                }
              }
            } catch (e) {
              console.warn("Failed to fetch opening hours for", w.name, e);
            }
          }));
          this.saveRouteWaypoints();
        } catch (e) {}
      }
    }

    const exportRows = targets.map((w, idx) => {
      const visitSummary = this.formatWaypointVisitRecords(w);
      const rawHours = w.openingHours || (w._raw && w._raw["营业时间 (Opening Hours)"]) || "未提供";
      const openHours = this.formatWeekdayOpeningHours(rawHours);
      const phone = (w.phone && w.phone !== "无") ? w.phone : "";
      const displayName = w.name + (w.nameEn && w.nameEn !== w.name ? ` (${w.nameEn})` : "");

      return {
        [i18n.t("fs_route_col_stop_no") || "序号"]: idx + 1,
        [i18n.t("fs_route_col_name") || "餐厅名称"]: displayName,
        [i18n.t("fs_route_col_address") || "地址"]: w.address || "",
        [i18n.t("fs_route_col_phone") || "电话"]: phone,
        [i18n.t("fs_route_col_hours") || "营业时间"]: openHours,
        [i18n.t("fs_route_col_visit_records") || "拜访记录"]: visitSummary
      };
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const xlsxLib = (typeof window !== "undefined" && window.XLSX) ? window.XLSX : (typeof XLSX !== "undefined" ? XLSX : null);
    if (xlsxLib) {
      const ws = xlsxLib.utils.json_to_sheet(exportRows);
      const colWidths = [
        { wch: 8 },  // 序号
        { wch: 32 }, // 餐厅名称
        { wch: 40 }, // 地址
        { wch: 18 }, // 电话
        { wch: 35 }, // 营业时间
        { wch: 55 }  // 拜访记录
      ];
      ws['!cols'] = colWidths;

      const wb = xlsxLib.utils.book_new();
      xlsxLib.utils.book_append_sheet(wb, ws, "Waypoints");
      xlsxLib.writeFile(wb, `GreenOil_Route_Waypoints_${dateStr}.xlsx`);
    } else {
      // CSV Fallback
      const headers = Object.keys(exportRows[0]);
      const csv = [
        headers.join(","),
        ...exportRows.map(row => headers.map(h => `"${(row[h] || "").toString().replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `GreenOil_Route_Waypoints_${dateStr}.csv`;
      link.click();
    }
  },

  renderRouteWaypoints() {
    this.ensureWaypointUids();
    if (typeof document === "undefined") return;
    const listEl = document.getElementById("fsRouteWaypointsList");
    const emptyEl = document.getElementById("fsRouteEmptyNotice");
    const countBadge = document.getElementById("fsRouteStopsBadge");
    const selectAllCb = document.getElementById("fsRouteSelectAll");
    const selectedCountEl = document.getElementById("fsRouteSelectedCount");

    if (countBadge) countBadge.textContent = this.routeWaypoints.length;

    // Prune stale selected ids that no longer exist in routeWaypoints
    const currentUids = new Set(this.routeWaypoints.map(w => w._uid));
    for (const uid of this.selectedWaypointIds) {
      if (!currentUids.has(uid)) this.selectedWaypointIds.delete(uid);
    }

    const visibleWaypoints = this.getFilteredWaypoints();
    const totalCount = this.routeWaypoints.length;
    const selectedCount = this.selectedWaypointIds.size;

    if (selectedCountEl) {
      selectedCountEl.textContent = i18n.t("fs_route_selected_count", { count: selectedCount, total: totalCount }) || `(已选 ${selectedCount}/${totalCount})`;
    }

    if (selectAllCb) {
      if (visibleWaypoints.length > 0 && visibleWaypoints.every(w => this.selectedWaypointIds.has(w._uid))) {
        selectAllCb.checked = true;
        selectAllCb.indeterminate = false;
      } else if (visibleWaypoints.some(w => this.selectedWaypointIds.has(w._uid))) {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = true;
      } else {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = false;
      }
    }

    if (!listEl) return;

    if (totalCount === 0) {
      listEl.innerHTML = "";
      if (emptyEl) {
        emptyEl.textContent = i18n.t("fs_route_empty");
        emptyEl.style.display = "block";
      }
      return;
    }

    if (visibleWaypoints.length === 0) {
      listEl.innerHTML = "";
      if (emptyEl) {
        emptyEl.textContent = i18n.t("fs_route_no_matching_stops") || "未找到匹配的途经站点";
        emptyEl.style.display = "block";
      }
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";

    listEl.innerHTML = visibleWaypoints.map((w) => {
      const origIndex = this.routeWaypoints.indexOf(w);
      const isFirst = origIndex === 0;
      const isLast = origIndex === this.routeWaypoints.length - 1;
      const stopNumber = origIndex + 1;
      const isSelected = this.selectedWaypointIds.has(w._uid);
      const phoneStr = w.phone && w.phone !== "无" ? `<a href="tel:${w.phone}" class="fs-link fs-wp-phone">${w.phone}</a>` : "";
      const isVisited = !!w.visited;
      const visitedBadge = isVisited 
        ? `<span class="fs-wp-status-badge is-visited" style="background: #d1fae5; color: #065f46; font-size: 0.72rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">✓ ${i18n.t("visited_yes")}</span>` 
        : `<span class="fs-wp-status-badge is-pending" style="background: #fef3c7; color: #92400e; font-size: 0.72rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${i18n.t("visited_pending")}</span>`;

      const isCustom = !!w.isCustomAddress || (!w.placeId && (!w.name || w.name === w.address)) || (w.name === w.address);
      let displayName = "";
      let addressRow = "";
      let regionBadge = "";

      if (isCustom) {
        displayName = (typeof Restaurants !== "undefined" && Restaurants.escapeHtml) ? Restaurants.escapeHtml(w.address || w.name || "") : (w.address || w.name || "");
        regionBadge = `<span class="fs-wp-region" style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem;">${i18n.t("fs_route_custom_address_tag") || "地址"}</span>`;
        addressRow = "";
      } else {
        const escapedName = (typeof Restaurants !== "undefined" && Restaurants.escapeHtml) ? Restaurants.escapeHtml(w.name) : w.name;
        const escapedNameEn = (typeof Restaurants !== "undefined" && Restaurants.escapeHtml) ? Restaurants.escapeHtml(w.nameEn) : w.nameEn;
        const formattedRegion = (typeof Restaurants !== "undefined" && Restaurants.formatRegion) ? Restaurants.formatRegion(w.region) : w.region;
        displayName = escapedName + (w.nameEn && w.nameEn !== w.name ? ` <span class="fs-wp-name-en" style="font-size: 0.82rem; color: #64748b; font-weight: normal;">(${escapedNameEn})</span>` : "");
        regionBadge = `<span class="fs-wp-region">${formattedRegion || "GTA"}</span>`;
        addressRow = `<div class="fs-wp-address">${(typeof Restaurants !== "undefined" && Restaurants.escapeHtml ? Restaurants.escapeHtml(w.address) : w.address) || i18n.t("no_address")}</div>`;
      }

      return `
        <div class="fs-waypoint-card ${isVisited ? 'is-visited' : ''} ${isSelected ? 'is-selected' : ''}" data-uid="${w._uid}" style="${isVisited ? 'border-left: 4px solid #10b981;' : ''}">
          <input type="checkbox" class="fs-wp-checkbox" data-uid="${w._uid}" ${isSelected ? 'checked' : ''} title="${i18n.t("select") || '选择'}" />
          <div class="fs-wp-badge" style="${isVisited ? 'background: #10b981;' : ''}">${stopNumber}</div>
          <div class="fs-wp-content">
            <div class="fs-wp-header">
              <span class="fs-wp-name">${displayName}</span>
              ${visitedBadge}
              ${regionBadge}
            </div>
            ${addressRow}
            <div class="fs-wp-meta">${phoneStr}</div>
          </div>
          <div class="fs-wp-actions">
            <button class="fs-btn-action fs-btn-nav" data-action="nav" data-index="${origIndex}" title="${i18n.t("fs_btn_nav_title")}">${i18n.t("fs_btn_nav")}</button>
            <button class="fs-btn-action" data-action="up" data-index="${origIndex}" ${isFirst ? "disabled" : ""} title="${i18n.t("fs_btn_move_up")}">${i18n.t("fs_btn_move_up")}</button>
            <button class="fs-btn-action" data-action="down" data-index="${origIndex}" ${isLast ? "disabled" : ""} title="${i18n.t("fs_btn_move_down")}">${i18n.t("fs_btn_move_down")}</button>
            <button class="fs-btn-action fs-btn-log" data-action="log" data-index="${origIndex}" title="${isVisited ? i18n.t('fs_btn_log_title_edit') : i18n.t('fs_btn_log_title_new')}" style="${isVisited ? 'background: #d1fae5; color: #065f46; border-color: #a7f3d0;' : ''}">${isVisited ? i18n.t('fs_btn_log_recorded') : i18n.t('fs_btn_log_new')}</button>
            <button class="fs-btn-action fs-btn-del" data-action="del" data-index="${origIndex}" title="${i18n.t("btn_delete")}">${i18n.t("btn_delete")}</button>
          </div>
        </div>
      `;
    }).join("");

    // Bind checkboxes
    listEl.querySelectorAll(".fs-wp-checkbox").forEach(cb => {
      cb.addEventListener("change", () => {
        const uid = cb.dataset.uid;
        if (cb.checked) {
          this.selectedWaypointIds.add(uid);
        } else {
          this.selectedWaypointIds.delete(uid);
        }
        this.renderRouteWaypoints();
      });
    });

    // Bind action events
    listEl.querySelectorAll(".fs-btn-action, .fs-btn-icon").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.index, 10);
        if (action === "nav") {
          const rest = this.routeWaypoints[idx];
          const isCustom = !!rest.isCustomAddress || (!rest.placeId && (!rest.name || rest.name === rest.address)) || (rest.name === rest.address);
          const queryText = isCustom ? (rest.address || rest.name) : ((rest.name ? rest.name + " " : "") + (rest.address || ""));
          const query = encodeURIComponent(queryText);
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`, "_blank");
        }
        if (action === "up") this.moveWaypoint(idx, -1);
        if (action === "down") this.moveWaypoint(idx, 1);
        if (action === "del") this.removeWaypoint(idx);
        if (action === "log") {
          const rest = this.routeWaypoints[idx];
          this.openSalesRecordModal(null, rest);
        }
      });
    });
  },

  // -------------------------------------------------------------
  // Sub-Module 2: Sales Records
  // -------------------------------------------------------------
  bindRecordEvents() {
    const btnNew = document.getElementById("fsBtnNewRecord");
    if (btnNew) {
      btnNew.addEventListener("click", () => this.openSalesRecordModal());
    }

    const modalOverlay = document.getElementById("fsRecordModalOverlay");
    const btnClose = document.getElementById("fsRecordModalClose");
    const btnCancel = document.getElementById("fsRecordBtnCancel");

    if (btnClose) btnClose.addEventListener("click", () => this.closeSalesRecordModal());
    if (btnCancel) btnCancel.addEventListener("click", () => this.closeSalesRecordModal());

    // ESC key listener to close sales record modal
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.keyCode === 27) {
        const modal = document.getElementById("fsRecordModalOverlay");
        if (modal && modal.classList.contains("active")) {
          this.closeSalesRecordModal();
        }
      }
    });

    // View toggle: List vs Calendar
    const btnListView = document.getElementById("fsBtnRecordsListView");
    const btnCalView = document.getElementById("fsBtnRecordsCalendarView");
    if (btnListView) {
      btnListView.addEventListener("click", () => this.switchRecordsViewMode("list"));
    }
    if (btnCalView) {
      btnCalView.addEventListener("click", () => this.switchRecordsViewMode("calendar"));
    }

    // Outcome change handler -> toggle conditional fields
    const outcomeRadios = document.querySelectorAll("input[name='fsOutcome']");
    outcomeRadios.forEach(radio => {
      radio.addEventListener("change", (e) => {
        this.updateOutcomeConditionalFields(e.target.value);
      });
    });

    // Form Submit
    const form = document.getElementById("fsRecordForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveRecord();
      });
    }

    // Filter events
    const outcomeFilter = document.getElementById("fsFilterOutcome");
    if (outcomeFilter) {
      outcomeFilter.addEventListener("change", (e) => {
        this.filterOutcome = e.target.value;
        this.renderSalesRecords();
      });
    }

    const methodFilter = document.getElementById("fsFilterMethod");
    if (methodFilter) {
      methodFilter.addEventListener("change", (e) => {
        this.filterMethod = e.target.value;
        this.renderSalesRecords();
      });
    }

    const searchInput = document.getElementById("fsSearchRecordsInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchKeyword = e.target.value.trim().toLowerCase();
        this.renderSalesRecords();
      });
    }
  },

  openSalesRecordModal(existingRecord = null, presetRestaurant = null, presetDate = null) {
    this.editingRecordId = existingRecord ? existingRecord.id : null;
    const modal = document.getElementById("fsRecordModalOverlay");
    const title = document.getElementById("fsRecordModalTitle");

    if (title) {
      title.textContent = existingRecord ? i18n.t("fs_record_title_edit") : i18n.t("fs_record_title_new");
    }

    // Prefill form
    const now = new Date();
    let defaultTime;
    if (presetDate) {
      defaultTime = `${presetDate}T10:00`;
    } else {
      defaultTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 13) + ":00";
    }

    const timeInput = document.getElementById("fsRecordTime");
    if (timeInput) timeInput.value = existingRecord ? existingRecord.visitTime : defaultTime;

    // Method
    const method = existingRecord ? existingRecord.method : "onsite";
    const methodRadio = document.querySelector(`input[name="fsMethod"][value="${method}"]`);
    if (methodRadio) methodRadio.checked = true;

    // Outcome
    const outcome = existingRecord ? existingRecord.outcome : "interested";
    const outcomeRadio = document.querySelector(`input[name="fsOutcome"][value="${outcome}"]`);
    if (outcomeRadio) outcomeRadio.checked = true;
    this.updateOutcomeConditionalFields(outcome);

    // Conditional Fields
    const inRejectReason = document.getElementById("fsRejectReason");
    const inRejectDetail = document.getElementById("fsRejectDetails");
    const inOthersReason = document.getElementById("fsOthersReason");
    const inCompetitor = document.getElementById("fsCompetitorName");
    const inCompQuote = document.getElementById("fsCompetitorQuote");
    const inCompExpiry = document.getElementById("fsContractExpiry");
    const inNotes = document.getElementById("fsRecordNotes");

    if (inRejectReason) inRejectReason.value = existingRecord ? existingRecord.rejectionReason : "";
    if (inRejectDetail) inRejectDetail.value = existingRecord ? existingRecord.rejectionReasonDetails : "";
    if (inOthersReason) inOthersReason.value = existingRecord ? existingRecord.signedOthersReason : "";
    if (inCompetitor) inCompetitor.value = existingRecord ? existingRecord.competitorName : "";
    if (inCompQuote) inCompQuote.value = existingRecord ? existingRecord.competitorQuote : "";
    if (inCompExpiry) inCompExpiry.value = existingRecord ? existingRecord.contractExpiryDate : "";
    if (inNotes) inNotes.value = existingRecord ? existingRecord.notes : "";

    // Target Restaurant
    let targetRest = presetRestaurant;
    if (existingRecord) {
      targetRest = {
        name: existingRecord.restaurantName,
        address: existingRecord.restaurantAddress,
        phone: existingRecord.restaurantPhone,
        placeId: existingRecord.restaurantId,
        region: existingRecord.region
      };
      this.normalizeRestaurantName(targetRest);
    } else if ((!targetRest || !this.routeWaypoints.some(w => (w.placeId || w.name) === (targetRest.placeId || targetRest.name))) && this.routeWaypoints && this.routeWaypoints.length > 0) {
      // Prioritize the first unvisited stop in the route planning list
      targetRest = this.routeWaypoints.find(w => !w.visited) || this.routeWaypoints[0];
    }

    if (!existingRecord && !this.routeWaypoints.some(w => (w.placeId || w.name) === (targetRest?.placeId || targetRest?.name))) targetRest = null;
    this.selectedRestaurantForSale = targetRest;
    this.populateProximityRestaurantOptions(targetRest);
    this.updateRestaurantEditInputs(targetRest);

    if (modal) modal.classList.add("active");
  },

  closeSalesRecordModal() {
    const modal = document.getElementById("fsRecordModalOverlay");
    if (modal) modal.classList.remove("active");
    this.editingRecordId = null;
    this.selectedRestaurantForSale = null;
  },

  populateProximityRestaurantOptions(selectedRest = null) {
    const selectEl = document.getElementById("fsRecordRestSelect");
    if (!selectEl) return;

    let html = `<option value="">${i18n.t("fs_select_rest_placeholder")}</option>`;

    // 1. Group: Route Planning Stops (Highest Priority)
    if (this.routeWaypoints && this.routeWaypoints.length > 0) {
      html += `<optgroup label="${i18n.t("fs_optgroup_route", { count: this.routeWaypoints.length })}">`;
      this.routeWaypoints.forEach((w, idx) => {
        const isSelected = selectedRest && (
          (selectedRest.placeId && w.placeId && selectedRest.placeId === w.placeId) ||
          (selectedRest.name && w.name && selectedRest.name === w.name)
        );
        const statusStr = w.visited ? `✓ ${i18n.t("visited_yes")}` : i18n.t("visited_pending");
        const val = w.placeId || w.name;
        const optLabel = i18n.t("fs_opt_stop_format", { stop: idx + 1, status: statusStr, name: w.name, region: w.address || Restaurants.formatRegion(w.region) || "GTA" });
        html += `<option value="${val}" ${isSelected ? "selected" : ""}>${optLabel}</option>`;
      });
      html += `</optgroup>`;
    }

    // Preserve the original restaurant when editing a historical record.
    if (this.editingRecordId && selectedRest && !this.routeWaypoints.some(w => (w.placeId || w.name) === (selectedRest.placeId || selectedRest.name))) {
      html += `<option value="${Restaurants.escapeHtml(selectedRest.placeId || selectedRest.name)}" selected>${Restaurants.escapeHtml(selectedRest.name)}</option>`;
    }

    selectEl.innerHTML = html;

    // Listen for select changes
    selectEl.onchange = (e) => {
      const key = e.target.value;
      let found = this.routeWaypoints.find(w => (w.placeId && w.placeId === key) || w.name === key);
      if (!found && this.editingRecordId && selectedRest && key === (selectedRest.placeId || selectedRest.name)) found = selectedRest;
      this.selectedRestaurantForSale = found || null;
      this.updateRestaurantEditInputs(found || null);
    };
  },

  updateRestaurantEditInputs(rest) {
    const inPhone = document.getElementById("fsEditRestPhone");
    const inAddress = document.getElementById("fsEditRestAddress");
    const inContact = document.getElementById("fsEditRestContact");
    const inHours = document.getElementById("fsEditRestHours");

    if (inPhone) inPhone.value = rest ? (rest.phone || "") : "";
    if (inAddress) inAddress.value = rest ? (rest.address || "") : "";
    if (inContact) inContact.value = rest ? (rest.contactPerson || "") : "";
    if (inHours) inHours.value = rest ? (rest.openingHours || (rest._raw && rest._raw["营业时间 (Opening Hours)"]) || "") : "";
  },

  updateOutcomeConditionalFields(outcome) {
    const rejectBox = document.getElementById("fsRejectReasonGroup");
    const othersBox = document.getElementById("fsOthersGroup");

    if (rejectBox) rejectBox.style.display = outcome === "rejected" ? "block" : "none";
    if (othersBox) othersBox.style.display = outcome === "signed_others" ? "block" : "none";
  },

  async handleSaveRecord() {
    const selectEl = document.getElementById("fsRecordRestSelect");
    const selectedKey = selectEl ? selectEl.value : "";

    let rest = this.routeWaypoints.find(w => (w.placeId || w.name) === selectedKey);
    if (!rest && this.editingRecordId && this.selectedRestaurantForSale && selectedKey === (this.selectedRestaurantForSale.placeId || this.selectedRestaurantForSale.name)) {
      rest = this.selectedRestaurantForSale;
    }

    if (!rest) {
      alert(i18n.t("fs_alert_select_rest"));
      return;
    }

    const timeInput = document.getElementById("fsRecordTime");
    const methodRadio = document.querySelector("input[name='fsMethod']:checked");
    const outcomeRadio = document.querySelector("input[name='fsOutcome']:checked");

    const method = methodRadio ? methodRadio.value : "onsite";
    const outcome = outcomeRadio ? outcomeRadio.value : "interested";
    const visitTime = timeInput ? timeInput.value : new Date().toISOString().slice(0, 13) + ":00";

    const inRejectReason = document.getElementById("fsRejectReason");
    const inRejectDetail = document.getElementById("fsRejectDetails");
    const inOthersReason = document.getElementById("fsOthersReason");
    const inCompetitor = document.getElementById("fsCompetitorName");
    const inCompQuote = document.getElementById("fsCompetitorQuote");
    const inCompExpiry = document.getElementById("fsContractExpiry");
    const inNotes = document.getElementById("fsRecordNotes");

    // Edited restaurant fields
    const inPhone = document.getElementById("fsEditRestPhone");
    const inAddress = document.getElementById("fsEditRestAddress");
    const inContact = document.getElementById("fsEditRestContact");
    const inHours = document.getElementById("fsEditRestHours");
    const chkSyncKv = document.getElementById("fsSyncRestToKv");

    const updatedPhone = inPhone ? inPhone.value.trim() : rest.phone;
    const updatedAddress = inAddress ? inAddress.value.trim() : rest.address;
    const updatedContact = inContact ? inContact.value.trim() : "";
    const updatedHours = inHours ? inHours.value.trim() : (rest.openingHours || "");

    const record = {
      id: this.editingRecordId || `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      restaurantId: rest.placeId || "",
      restaurantName: rest.name,
      restaurantAddress: updatedAddress || rest.address,
      restaurantPhone: updatedPhone || rest.phone,
      region: rest.region || "GTA",
      method,
      visitTime,
      outcome,
      rejectionReason: outcome === "rejected" ? (inRejectReason ? inRejectReason.value : "") : "",
      rejectionReasonDetails: outcome === "rejected" ? (inRejectDetail ? inRejectDetail.value.trim() : "") : "",
      signedOthersReason: outcome === "signed_others" ? (inOthersReason ? inOthersReason.value : "") : "",
      competitorName: outcome === "signed_others" ? (inCompetitor ? inCompetitor.value.trim() : "") : "",
      competitorQuote: outcome === "signed_others" ? (inCompQuote ? inCompQuote.value.trim() : "") : "",
      contractExpiryDate: outcome === "signed_others" ? (inCompExpiry ? inCompExpiry.value.trim() : "") : "",
      notes: inNotes ? inNotes.value.trim() : "",
      contactPerson: updatedContact,
      salesRep: Auth.getUser() || "greenoil"
    };

    const btnSubmit = document.getElementById("fsBtnSubmitRecord");
    if (btnSubmit) btnSubmit.textContent = i18n.t("fs_btn_saving");

    // 1. Save or Update Record via Worker API
    let res;
    if (this.editingRecordId) {
      res = await Api.updateSale(this.editingRecordId, record);
    } else {
      res = await Api.createSale(record);
    }

    // 2. Sync modified restaurant info to Database if checked
    if (chkSyncKv && chkSyncKv.checked) {
      const restUpdates = {};
      if (updatedPhone && updatedPhone !== rest.phone) restUpdates.phone = updatedPhone;
      if (updatedAddress && updatedAddress !== rest.address) restUpdates.address = updatedAddress;
      if (updatedContact) restUpdates.contactPerson = updatedContact;
      if (updatedHours && updatedHours !== rest.openingHours) restUpdates.openingHours = updatedHours;

      if (Object.keys(restUpdates).length > 0) {
        await Api.updateRestaurant(rest.placeId, rest.name, restUpdates);
        // Update local cache
        rest.phone = updatedPhone;
        rest.address = updatedAddress;
        rest.contactPerson = updatedContact;
        if (updatedHours) {
          rest.openingHours = updatedHours;
          if (rest._raw) rest._raw["营业时间 (Opening Hours)"] = updatedHours;
        }

        // Also update across route waypoints and cached datasets
        if (this.routeWaypoints) {
          const wp = this.routeWaypoints.find(w => (w.placeId && w.placeId === rest.placeId) || (w.name && w.name === rest.name));
          if (wp) {
            wp.phone = updatedPhone;
            wp.address = updatedAddress;
            if (updatedHours) wp.openingHours = updatedHours;
            this.saveRouteWaypoints();
          }
        }
        if (Array.isArray(this.cachedRestaurants)) {
          const cr = this.cachedRestaurants.find(r => (r.placeId && r.placeId === rest.placeId) || (r.name && r.name === rest.name));
          if (cr) {
            cr.phone = updatedPhone;
            cr.address = updatedAddress;
            if (updatedHours) cr.openingHours = updatedHours;
          }
        }
        if (window.Restaurants && Array.isArray(window.Restaurants.fullDataset)) {
          const fr = window.Restaurants.fullDataset.find(r => (r.placeId && r.placeId === rest.placeId) || (r.name && r.name === rest.name));
          if (fr) {
            fr.phone = updatedPhone;
            fr.address = updatedAddress;
            if (updatedHours) fr.openingHours = updatedHours;
          }
        }
        if (window.MapExplorer && Array.isArray(window.MapExplorer.allRestaurants)) {
          const mr = window.MapExplorer.allRestaurants.find(r => (r.placeId && r.placeId === rest.placeId) || (r.name && r.name === rest.name));
          if (mr) {
            mr.phone = updatedPhone;
            mr.address = updatedAddress;
            if (updatedHours) mr.openingHours = updatedHours;
          }
        }
      }
    }

    if (btnSubmit) btnSubmit.textContent = i18n.t("fs_btn_save");

    // Update local state
    if (this.editingRecordId) {
      const idx = this.salesRecords.findIndex(r => r.id === this.editingRecordId);
      if (idx !== -1) this.salesRecords[idx] = record;
    } else {
      this.salesRecords.unshift(record);
    }

    try {
      localStorage.setItem(STORAGE_SALES_CACHE_KEY, JSON.stringify(this.salesRecords));
    } catch (e) {}

    // Update waypoint visited status if this restaurant is on current route
    if (this.routeWaypoints) {
      const wp = this.routeWaypoints.find(w => (w.placeId && w.placeId === rest.placeId) || (w.name && w.name === rest.name));
      if (wp) {
        wp.visited = true;
        wp.lastVisitTime = visitTime;
        wp.lastOutcome = outcome;
        this.saveRouteWaypoints();
        this.renderRouteWaypoints();
      }
    }

    this.closeSalesRecordModal();
    this.renderSalesRecords();
    if (window.showToast) window.showToast(i18n.t("fs_record_saved_toast"));
    else alert(i18n.t("fs_record_saved_toast"));
  },

  async deleteRecord(recordId) {
    if (!confirm(i18n.t("fs_confirm_delete_record"))) return;
    this.salesRecords = this.salesRecords.filter(r => r.id !== recordId);
    try {
      localStorage.setItem(STORAGE_SALES_CACHE_KEY, JSON.stringify(this.salesRecords));
    } catch (e) {}

    this.renderSalesRecords();
    await Api.deleteSale(recordId);
  },

  switchRecordsViewMode(mode) {
    this.recordsViewMode = mode;
    const btnList = document.getElementById("fsBtnRecordsListView");
    const btnCal = document.getElementById("fsBtnRecordsCalendarView");
    const listEl = document.getElementById("fsRecordsList");
    const calEl = document.getElementById("fsRecordsCalendarView");

    if (btnList) btnList.classList.toggle("active", mode === "list");
    if (btnCal) btnCal.classList.toggle("active", mode === "calendar");

    if (mode === "list") {
      if (listEl) listEl.style.display = "flex";
      if (calEl) calEl.style.display = "none";
      this.renderSalesRecords();
    } else {
      if (listEl) listEl.style.display = "none";
      if (calEl) calEl.style.display = "block";
      this.renderCalendarView();
    }
  },

  renderSalesRecords() {
    if (this.recordsViewMode === "calendar") {
      this.renderCalendarView();
      return;
    }

    const listEl = document.getElementById("fsRecordsList");
    const countDisplay = document.getElementById("fsRecordsCountText");
    if (!listEl) return;

    let filtered = [...this.salesRecords];

    if (this.filterOutcome && this.filterOutcome !== "all") {
      filtered = filtered.filter(r => r.outcome === this.filterOutcome);
    }

    if (this.filterMethod && this.filterMethod !== "all") {
      filtered = filtered.filter(r => r.method === this.filterMethod);
    }

    if (this.searchKeyword) {
      filtered = filtered.filter(r => {
        const str = [r.restaurantName, r.restaurantAddress, r.notes, r.competitorName, r.rejectionReason].join(" ").toLowerCase();
        return str.includes(this.searchKeyword);
      });
    }

    if (countDisplay) {
      countDisplay.textContent = i18n.t("fs_records_count", { count: filtered.length });
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="fs-empty-notice">${i18n.t("fs_no_records")}</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(r => this.renderRecordCard(r)).join("");
    this.bindRecordCardActions(listEl);
  },

  renderRecordCard(r) {
    const outcomeBadge = this.getOutcomeBadge(r.outcome);
    const methodBadge = r.method === "onsite" ? `<span class="fs-tag fs-tag-onsite">${i18n.t("fs_record_method_onsite")}</span>` : `<span class="fs-tag fs-tag-phone">${i18n.t("fs_record_method_phone")}</span>`;
    const timeFormatted = r.visitTime ? r.visitTime.replace("T", " ") : "";

    let detailsBlock = "";
    if (r.outcome === "rejected" && (r.rejectionReason || r.rejectionReasonDetails)) {
      detailsBlock = `
        <div class="fs-record-rejection">
          <span class="fs-reject-tag">${i18n.t("fs_reject_reason_prefix")}${this.getRejectReasonText(r.rejectionReason) || i18n.t("unspecified")}</span>
          ${r.rejectionReasonDetails ? `<span class="fs-reject-desc">${r.rejectionReasonDetails}</span>` : ""}
        </div>
      `;
    } else if (r.outcome === "signed_others") {
      detailsBlock = `
        <div class="fs-record-competitor">
          <div class="fs-comp-title">${i18n.t("fs_signed_others_prefix")}${this.getOthersReasonText(r.signedOthersReason) || i18n.t("unspecified")}</div>
          ${r.competitorName ? `<div><strong>${i18n.t("fs_meta_supplier")}: </strong>${r.competitorName}</div>` : ""}
          ${r.competitorQuote ? `<div><strong>${i18n.t("fs_meta_quote")}: </strong>${r.competitorQuote}</div>` : ""}
          ${r.contractExpiryDate ? `<div><strong>${i18n.t("fs_meta_expiry")}: </strong>${r.contractExpiryDate}</div>` : ""}
        </div>
      `;
    }

    return `
      <div class="fs-record-card">
        <div class="fs-rec-header">
          <div class="fs-rec-rest-info">
            <h4 class="fs-rec-name">${r.restaurantName}</h4>
            <span class="fs-rec-region">${Restaurants.escapeHtml(Restaurants.formatRegion(r.region)) || "GTA"}</span>
          </div>
          <div class="fs-rec-badges">
            ${methodBadge}
            ${outcomeBadge}
          </div>
        </div>

        <div class="fs-rec-meta">
          <span>${i18n.t("fs_meta_time")}: ${timeFormatted}</span>
          <span>${i18n.t("fs_meta_address")}: ${r.restaurantAddress || i18n.t("no_address")}</span>
          ${r.restaurantPhone ? `<span>${i18n.t("fs_meta_phone")}: ${r.restaurantPhone}</span>` : ""}
          <span>${i18n.t("fs_meta_rep")}: ${r.salesRep || "greenoil"}</span>
        </div>

        ${detailsBlock}

        ${r.notes ? `<div class="fs-rec-notes"><strong>${i18n.t("fs_meta_notes")}: </strong>${r.notes}</div>` : ""}

        <div class="fs-rec-actions">
          <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${r.id}">${i18n.t("btn_edit")}</button>
          <button class="btn btn-secondary btn-sm fs-btn-delete" data-action="delete" data-id="${r.id}">${i18n.t("btn_delete")}</button>
        </div>
      </div>
    `;
  },

  bindRecordCardActions(container) {
    if (!container) return;
    container.querySelectorAll("button[data-action='edit']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const item = this.salesRecords.find(r => r.id === id);
        if (item) this.openSalesRecordModal(item);
      });
    });

    container.querySelectorAll("button[data-action='delete']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        this.deleteRecord(id);
      });
    });
  },

  renderCalendarView() {
    const calContainer = document.getElementById("fsRecordsCalendarView");
    const countDisplay = document.getElementById("fsRecordsCountText");
    if (!calContainer) return;

    let filteredRecords = [...this.salesRecords];
    if (this.filterOutcome && this.filterOutcome !== "all") {
      filteredRecords = filteredRecords.filter(r => r.outcome === this.filterOutcome);
    }
    if (this.filterMethod && this.filterMethod !== "all") {
      filteredRecords = filteredRecords.filter(r => r.method === this.filterMethod);
    }
    if (this.searchKeyword) {
      filteredRecords = filteredRecords.filter(r => {
        const str = [r.restaurantName, r.restaurantAddress, r.notes, r.competitorName, r.rejectionReason].join(" ").toLowerCase();
        return str.includes(this.searchKeyword);
      });
    }

    if (countDisplay) {
      countDisplay.textContent = i18n.t("fs_records_count", { count: filteredRecords.length });
    }

    const year = this.calendarYear;
    const month = this.calendarMonth;

    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const dateMap = {};
    let monthTotalVisits = 0;

    filteredRecords.forEach(r => {
      if (!r.visitTime) return;
      const dStr = r.visitTime.slice(0, 10);
      const rYear = parseInt(dStr.slice(0, 4), 10);
      const rMonth = parseInt(dStr.slice(5, 7), 10) - 1;
      if (rYear === year && rMonth === month) {
        monthTotalVisits++;
      }
      if (!dateMap[dStr]) dateMap[dStr] = [];
      dateMap[dStr].push(r);
    });

    const todayObj = new Date();
    const todayIso = todayObj.toISOString().slice(0, 10);
    if (!this.selectedCalendarDate) {
      this.selectedCalendarDate = todayIso;
    }

    const lang = i18n.currentLang || "zh";
    const weekdaysZh = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekdaysKo = ["일", "월", "화", "수", "목", "금", "토"];
    const weekdays = lang === "en" ? weekdaysEn : (lang === "ko" ? weekdaysKo : weekdaysZh);

    let monthTitle = `${year} 年 ${month + 1} 月`;
    if (lang === "en") {
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      monthTitle = `${monthNames[month]} ${year}`;
    } else if (lang === "ko") {
      monthTitle = `${year}년 ${month + 1}월`;
    }

    let html = `
      <div class="fs-calendar-header">
        <div class="fs-cal-nav-group">
          <button class="btn btn-secondary btn-sm" id="fsCalPrevMonth" title="${i18n.t("cal_prev_month") || "上个月"}">&lt;</button>
          <div class="fs-cal-month-title">${monthTitle}</div>
          <button class="btn btn-secondary btn-sm" id="fsCalNextMonth" title="${i18n.t("cal_next_month") || "下个月"}">&gt;</button>
          <button class="btn btn-secondary btn-sm" id="fsCalToday" style="margin-left: 0.5rem;">${i18n.t("cal_today") || "今天"}</button>
        </div>
        <div class="fs-cal-month-stat">
          ${i18n.t("cal_visits_count", { count: monthTotalVisits }) || `本月拜访: ${monthTotalVisits} 次`}
        </div>
      </div>

      <div class="fs-calendar-grid">
        ${weekdays.map(w => `<div class="fs-cal-week-header">${w}</div>`).join("")}
    `;

    for (let i = 0; i < firstDayIndex; i++) {
      html += `<div class="fs-cal-cell is-empty"></div>`;
    }

    for (let d = 1; d <= totalDays; d++) {
      const dayPad = String(d).padStart(2, "0");
      const monthPad = String(month + 1).padStart(2, "0");
      const dateKey = `${year}-${monthPad}-${dayPad}`;

      const isToday = dateKey === todayIso;
      const isSelected = dateKey === this.selectedCalendarDate;
      const visits = dateMap[dateKey] || [];
      const hasVisits = visits.length > 0;

      let countBadge = "";
      let outcomeDots = "";

      if (hasVisits) {
        countBadge = `<span class="fs-cal-day-count-badge">${visits.length}</span>`;
        outcomeDots = `
          <div class="fs-cal-day-outcomes">
            ${visits.slice(0, 5).map(v => `<span class="fs-cal-outcome-dot ${v.outcome}" title="${this.getOutcomeText(v.outcome)}: ${v.restaurantName}"></span>`).join("")}
            ${visits.length > 5 ? `<span style="font-size:0.65rem; color:#64748b;">+${visits.length - 5}</span>` : ""}
          </div>
        `;
      }

      html += `
        <div class="fs-cal-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${hasVisits ? 'has-visits' : ''}" data-date="${dateKey}">
          <div class="fs-cal-day-header">
            <span class="fs-cal-day-num">${d}</span>
            ${countBadge}
          </div>
          ${outcomeDots}
        </div>
      `;
    }

    html += `</div>`;

    const selRecords = dateMap[this.selectedCalendarDate] || [];
    html += `
      <div class="fs-calendar-day-panel">
        <div class="fs-cal-panel-header">
          <div class="fs-cal-panel-title">
            📅 ${this.selectedCalendarDate} ${i18n.t("fs_tab_records") || "拜访记录"} (${selRecords.length})
          </div>
          <button class="btn btn-primary btn-sm" id="fsCalBtnAddVisit">
            + ${i18n.t("cal_btn_add_visit") || "录入此日拜访"}
          </button>
        </div>
        <div class="fs-cal-day-records-list">
          ${selRecords.length === 0 
            ? `<div class="fs-empty-notice" style="padding: 1.25rem;">${i18n.t("cal_no_visits") || "该日期暂无拜访记录，点击上方按钮可快速录入"}</div>` 
            : selRecords.map(r => this.renderRecordCard(r)).join("")}
        </div>
      </div>
    `;

    calContainer.innerHTML = html;

    const btnPrev = document.getElementById("fsCalPrevMonth");
    const btnNext = document.getElementById("fsCalNextMonth");
    const btnToday = document.getElementById("fsCalToday");
    const btnAddVisit = document.getElementById("fsCalBtnAddVisit");

    if (btnPrev) {
      btnPrev.addEventListener("click", () => {
        this.calendarMonth--;
        if (this.calendarMonth < 0) {
          this.calendarMonth = 11;
          this.calendarYear--;
        }
        this.renderCalendarView();
      });
    }

    if (btnNext) {
      btnNext.addEventListener("click", () => {
        this.calendarMonth++;
        if (this.calendarMonth > 11) {
          this.calendarMonth = 0;
          this.calendarYear++;
        }
        this.renderCalendarView();
      });
    }

    if (btnToday) {
      btnToday.addEventListener("click", () => {
        const now = new Date();
        this.calendarYear = now.getFullYear();
        this.calendarMonth = now.getMonth();
        this.selectedCalendarDate = now.toISOString().slice(0, 10);
        this.renderCalendarView();
      });
    }

    if (btnAddVisit) {
      btnAddVisit.addEventListener("click", () => {
        this.openSalesRecordModal(null, null, this.selectedCalendarDate);
      });
    }

    calContainer.querySelectorAll(".fs-cal-cell[data-date]").forEach(cell => {
      cell.addEventListener("click", () => {
        this.selectedCalendarDate = cell.dataset.date;
        this.renderCalendarView();
      });
    });

    const dayListEl = calContainer.querySelector(".fs-cal-day-records-list");
    if (dayListEl) {
      this.bindRecordCardActions(dayListEl);
    }
  },

  getRejectReasonText(reason) {
    if (!reason) return "";
    const map = {
      "价格无优势": "fs_reject_price",
      "觉得换油/换服务商麻烦": "fs_reject_hassle",
      "店主不在/无法决策": "fs_reject_decision_maker",
      "用油量极少无回收价值": "fs_reject_low_volume",
      "对目前服务商满意": "fs_reject_satisfied",
      "其他原因": "fs_reject_other"
    };
    return map[reason] ? i18n.t(map[reason]) : reason;
  },

  getOthersReasonText(reason) {
    if (!reason) return "";
    const map = {
      "已有长期排他合同未到期": "fs_others_locked",
      "现任供应商提供特殊设备/高额补贴": "fs_others_equipment",
      "现任供应商提供原料捆绑供货": "fs_others_bundle",
      "其他原因": "fs_others_other"
    };
    return map[reason] ? i18n.t(map[reason]) : reason;
  },

  getOutcomeBadge(outcome) {
    switch (outcome) {
      case "contract_signed":
        return `<span class="fs-badge fs-badge-signed">${i18n.t("fs_record_outcome_signed")}</span>`;
      case "interested":
        return `<span class="fs-badge fs-badge-interested">${i18n.t("fs_record_outcome_interested")}</span>`;
      case "rejected":
        return `<span class="fs-badge fs-badge-rejected">${i18n.t("fs_record_outcome_rejected")}</span>`;
      case "signed_others":
        return `<span class="fs-badge fs-badge-others">${i18n.t("fs_record_outcome_signed_others")}</span>`;
      default:
        return `<span class="fs-badge">${outcome}</span>`;
    }
  },

  // -------------------------------------------------------------
  // Sub-Module 4: Analytics & Visual Charts (SVG-based)
  // -------------------------------------------------------------
  bindAnalyticsEvents() {
    const btnExport = document.getElementById("fsBtnExportSales");
    if (btnExport) {
      btnExport.addEventListener("click", () => this.exportSalesToExcel());
    }
  },

  renderAnalytics() {
    const total = this.salesRecords.length;
    const signed = this.salesRecords.filter(r => r.outcome === "contract_signed").length;
    const interested = this.salesRecords.filter(r => r.outcome === "interested").length;
    const rejected = this.salesRecords.filter(r => r.outcome === "rejected").length;
    const others = this.salesRecords.filter(r => r.outcome === "signed_others").length;
    const onsite = this.salesRecords.filter(r => r.method === "onsite").length;

    const conversionRate = total > 0 ? ((signed / total) * 100).toFixed(1) : "0.0";
    const onsiteRatio = total > 0 ? ((onsite / total) * 100).toFixed(1) : "0.0";

    // Update KPI Cards
    const kpiTotal = document.getElementById("fsKpiTotalVisits");
    const kpiSigned = document.getElementById("fsKpiSignedCount");
    const kpiInterested = document.getElementById("fsKpiInterestedCount");
    const kpiConv = document.getElementById("fsKpiConversionRate");
    const kpiOnsite = document.getElementById("fsKpiOnsiteRatio");

    if (kpiTotal) kpiTotal.textContent = total;
    if (kpiSigned) kpiSigned.textContent = signed;
    if (kpiInterested) kpiInterested.textContent = interested;
    if (kpiConv) kpiConv.textContent = `${conversionRate}%`;
    if (kpiOnsite) kpiOnsite.textContent = `${onsiteRatio}%`;

    // 1. Render Outcomes Donut/Pie Chart
    this.renderDonutChart("fsChartOutcomesContainer", [
      { label: i18n.t("fs_record_outcome_signed"), count: signed, color: "#10b981" },
      { label: i18n.t("fs_record_outcome_interested"), count: interested, color: "#3b82f6" },
      { label: i18n.t("fs_record_outcome_rejected"), count: rejected, color: "#94a3b8" },
      { label: i18n.t("fs_record_outcome_signed_others"), count: others, color: "#f59e0b" }
    ]);

    // 2. Render Rejection / Others Reasons Donut Chart
    const reasonsMap = {};
    this.salesRecords.forEach(r => {
      if (r.outcome === "rejected" && r.rejectionReason) {
        const translated = this.getRejectReasonText(r.rejectionReason);
        reasonsMap[translated] = (reasonsMap[translated] || 0) + 1;
      }
      if (r.outcome === "signed_others" && r.signedOthersReason) {
        const translated = this.getOthersReasonText(r.signedOthersReason);
        reasonsMap[translated] = (reasonsMap[translated] || 0) + 1;
      }
    });

    const reasonsData = Object.entries(reasonsMap).map(([label, count], i) => {
      const palette = ["#ef4444", "#f97316", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];
      return { label, count, color: palette[i % palette.length] };
    });

    this.renderDonutChart("fsChartReasonsContainer", reasonsData.length > 0 ? reasonsData : [
      { label: i18n.t("fs_no_rejection_data"), count: 1, color: "#e2e8f0" }
    ]);

    // 3. Render Sales Methods Comparison Bar Chart
    const onsiteSigned = this.salesRecords.filter(r => r.method === "onsite" && r.outcome === "contract_signed").length;
    const phoneSigned = this.salesRecords.filter(r => r.method === "phone" && r.outcome === "contract_signed").length;
    const onsiteInt = this.salesRecords.filter(r => r.method === "onsite" && r.outcome === "interested").length;
    const phoneInt = this.salesRecords.filter(r => r.method === "phone" && r.outcome === "interested").length;

    this.renderGroupedBarChart("fsChartMethodsContainer", [
      { category: i18n.t("fs_category_signed"), onsite: onsiteSigned, phone: phoneSigned },
      { category: i18n.t("fs_category_interested"), onsite: onsiteInt, phone: phoneInt },
      { category: i18n.t("fs_category_total"), onsite: onsite, phone: total - onsite }
    ]);

    // 4. Render Regional Distribution Bar Chart
    const regionCounts = {};
    this.salesRecords.forEach(r => {
      const rawReg = r.region || "";
      const reg = Restaurants.formatRegion(rawReg) || i18n.t("unspecified");
      regionCounts[reg] = (regionCounts[reg] || 0) + 1;
    });

    const regionBars = Object.entries(regionCounts).map(([label, count]) => ({ label, count }));
    this.renderSimpleBarChart("fsChartRegionsContainer", regionBars);

    // 5. Render Competitor Intelligence Table
    this.renderCompetitorTable();
  },

  renderDonutChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const total = data.reduce((sum, d) => sum + d.count, 0);
    if (total === 0) {
      container.innerHTML = `<div class="fs-chart-empty">${i18n.t("fs_chart_empty")}</div>`;
      return;
    }

    const size = 180;
    const strokeWidth = 32;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    let accumulatedAngle = 0;
    let circlesHtml = "";

    data.forEach(item => {
      const percentage = item.count / total;
      const strokeDasharray = `${percentage * circumference} ${circumference}`;
      const strokeDashoffset = -accumulatedAngle;
      accumulatedAngle += percentage * circumference;

      circlesHtml += `
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
          fill="none"
          stroke="${item.color}"
          stroke-width="${strokeWidth}"
          stroke-dasharray="${strokeDasharray}"
          stroke-dashoffset="${strokeDashoffset}"
          transform="rotate(-90 ${size / 2} ${size / 2})"
        />
      `;
    });

    const legendHtml = data.map(item => {
      const pct = ((item.count / total) * 100).toFixed(1);
      return `
        <div class="fs-legend-item">
          <span class="fs-legend-dot" style="background: ${item.color};"></span>
          <span class="fs-legend-text">${item.label}</span>
          <span class="fs-legend-val">${item.count} (${pct}%)</span>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="fs-donut-wrapper">
        <div class="fs-donut-svg-wrap">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            ${circlesHtml}
            <text x="50%" y="47%" text-anchor="middle" font-size="18" font-weight="700" fill="var(--text-main)">${total}</text>
            <text x="50%" y="62%" text-anchor="middle" font-size="11" fill="var(--text-muted)">${i18n.t("fs_chart_total_label")}</text>
          </svg>
        </div>
        <div class="fs-donut-legend">
          ${legendHtml}
        </div>
      </div>
    `;
  },

  renderGroupedBarChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const maxVal = Math.max(1, ...data.flatMap(d => [d.onsite, d.phone]));

    const barsHtml = data.map(d => {
      const hOnsite = Math.round((d.onsite / maxVal) * 100);
      const hPhone = Math.round((d.phone / maxVal) * 100);

      return `
        <div class="fs-bar-group">
          <div class="fs-bar-columns">
            <div class="fs-bar-col fs-bar-onsite" style="height: ${Math.max(8, hOnsite)}%;" title="${i18n.t("fs_bar_onsite_title", { count: d.onsite })}">
              <span class="fs-bar-col-val">${d.onsite}</span>
            </div>
            <div class="fs-bar-col fs-bar-phone" style="height: ${Math.max(8, hPhone)}%;" title="${i18n.t("fs_bar_phone_title", { count: d.phone })}">
              <span class="fs-bar-col-val">${d.phone}</span>
            </div>
          </div>
          <div class="fs-bar-group-label">${d.category}</div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="fs-barchart-wrapper">
        <div class="fs-bars-container">
          ${barsHtml}
        </div>
        <div class="fs-bar-legend">
          <span><span class="fs-legend-dot" style="background: #10b981;"></span> ${i18n.t("fs_record_method_onsite")}</span>
          <span><span class="fs-legend-dot" style="background: #3b82f6;"></span> ${i18n.t("fs_record_method_phone")}</span>
        </div>
      </div>
    `;
  },

  renderSimpleBarChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML = `<div class="fs-chart-empty">${i18n.t("fs_chart_region_empty")}</div>`;
      return;
    }

    const maxVal = Math.max(1, ...data.map(d => d.count));

    const barsHtml = data.map(d => {
      const wPct = Math.round((d.count / maxVal) * 100);
      return `
        <div class="fs-hbar-row">
          <div class="fs-hbar-label">${d.label}</div>
          <div class="fs-hbar-track">
            <div class="fs-hbar-fill" style="width: ${Math.max(5, wPct)}%;"></div>
          </div>
          <div class="fs-hbar-val">${i18n.t("count_times", { count: d.count })}</div>
        </div>
      `;
    }).join("");

    container.innerHTML = `<div class="fs-hbars-wrapper">${barsHtml}</div>`;
  },

  renderCompetitorTable() {
    const tableBody = document.getElementById("fsCompetitorTableBody");
    if (!tableBody) return;

    const compRecords = this.salesRecords.filter(r => r.outcome === "signed_others" || r.competitorName || r.competitorQuote);

    if (compRecords.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">${i18n.t("fs_table_empty_competitor")}</td></tr>`;
      return;
    }

    tableBody.innerHTML = compRecords.map(r => {
      return `
        <tr>
          <td style="font-weight: 600;">${r.restaurantName}</td>
          <td><span class="fs-tag fs-tag-others">${r.competitorName || i18n.t("fs_unknown_supplier")}</span></td>
          <td style="color: #d97706; font-weight: 600;">${r.competitorQuote || i18n.t("fs_unrevealed_price")}</td>
          <td>${r.contractExpiryDate || i18n.t("unfilled")}</td>
          <td>${this.getOthersReasonText(r.signedOthersReason) || r.notes || "-"}</td>
        </tr>
      `;
    }).join("");
  },

  exportSalesToExcel() {
    if (this.salesRecords.length === 0) {
      alert(i18n.t("fs_export_empty_alert"));
      return;
    }

    const exportRows = this.salesRecords.map(r => ({
      [i18n.t("fs_col_visit_time")]: r.visitTime,
      [i18n.t("fs_col_rest_name")]: r.restaurantName,
      [i18n.t("fs_col_region")]: Restaurants.formatRegion(r.region) || r.region,
      [i18n.t("fs_col_address")]: r.restaurantAddress,
      [i18n.t("fs_col_phone")]: r.restaurantPhone,
      [i18n.t("fs_col_contact")]: r.contactPerson || "",
      [i18n.t("fs_col_method")]: r.method === "onsite" ? i18n.t("fs_record_method_onsite") : i18n.t("fs_record_method_phone"),
      [i18n.t("fs_col_outcome")]: this.getOutcomeText(r.outcome),
      [i18n.t("fs_col_reject_reason")]: this.getRejectReasonText(r.rejectionReason) || r.rejectionReason || "",
      [i18n.t("fs_col_reject_details")]: r.rejectionReasonDetails || "",
      [i18n.t("fs_col_signed_others")]: this.getOthersReasonText(r.signedOthersReason) || r.signedOthersReason || "",
      [i18n.t("fs_col_competitor")]: r.competitorName || "",
      [i18n.t("fs_col_quote")]: r.competitorQuote || "",
      [i18n.t("fs_col_expiry")]: r.contractExpiryDate || "",
      [i18n.t("fs_col_notes")]: r.notes || "",
      [i18n.t("fs_col_sales_rep")]: r.salesRep || "",
      [i18n.t("fs_col_created_at")]: r.createdAt || ""
    }));

    if (window.XLSX) {
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Field Sales Records");
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `GreenOil_FieldSales_${dateStr}.xlsx`);
    } else {
      // CSV Fallback
      const headers = Object.keys(exportRows[0]);
      const csv = [
        headers.join(","),
        ...exportRows.map(row => headers.map(h => `"${(row[h] || "").toString().replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `GreenOil_FieldSales_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    }
  },

  getOutcomeText(outcome) {
    switch (outcome) {
      case "contract_signed": return i18n.t("fs_record_outcome_signed");
      case "interested": return i18n.t("fs_record_outcome_interested");
      case "rejected": return i18n.t("fs_record_outcome_rejected");
      case "signed_others": return i18n.t("fs_record_outcome_signed_others");
      default: return outcome;
    }
  },

  getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
};
