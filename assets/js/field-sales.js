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

export const FieldSales = {
  activeSubTab: "route", // route | records | analytics
  routeWaypoints: [],
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
      return;
    }

    const res = await Api.queryAllRestaurants(300);
    if (res && res.success && Array.isArray(res.data)) {
      this.cachedRestaurants = res.data;
      this.populateRestaurantDatalist();
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

    // Add restaurant to route by search
    const addRestInput = document.getElementById("fsRouteAddRestInput");
    const btnAddRest = document.getElementById("fsRouteBtnAddRest");

    const doAdd = () => {
      const val = addRestInput ? addRestInput.value.trim() : "";
      if (!val) return;
      const found = this.cachedRestaurants.find(r => r.name.toLowerCase() === val.toLowerCase() || (r.placeId && r.placeId === val));
      if (found) {
        this.addRestaurantToRoute(found);
      } else {
        // Add as custom point
        this.addRestaurantToRoute({
          name: val,
          address: val,
          region: "GTA",
          latitude: 43.76,
          longitude: -79.41,
          placeId: "manual_" + Date.now()
        });
      }
      if (addRestInput) addRestInput.value = "";
    };

    if (btnAddRest) btnAddRest.addEventListener("click", doAdd);
    if (addRestInput) {
      addRestInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doAdd();
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

    // Navigation via Google Maps
    const btnNav = document.getElementById("fsRouteBtnNavigate");
    if (btnNav) {
      btnNav.addEventListener("click", () => this.openGoogleMapsNavigation());
    }
  },

  async loadRouteWaypoints() {
    // 1. Load local cache first for immediate responsiveness
    try {
      const saved = localStorage.getItem(STORAGE_WAYPOINTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.routeWaypoints = parsed;
        }
      }
    } catch (e) {
      this.routeWaypoints = [];
    }

    // 2. Fetch latest route waypoints and origin from Cloudflare Worker KV
    try {
      const res = await Api.getRouteWaypoints();
      if (res && res.success && res.data) {
        if (Array.isArray(res.data.waypoints)) {
          this.routeWaypoints = res.data.waypoints;
          try {
            localStorage.setItem(STORAGE_WAYPOINTS_KEY, JSON.stringify(this.routeWaypoints));
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
    // 1. Save to local storage
    try {
      localStorage.setItem(STORAGE_WAYPOINTS_KEY, JSON.stringify(this.routeWaypoints));
    } catch (e) {
      console.warn("Failed to persist route waypoints to local storage:", e);
    }

    // 2. Save to backend KV
    try {
      await Api.saveRouteWaypoints(this.routeWaypoints, this.originAddress);
    } catch (err) {
      console.warn("Failed to persist route waypoints to backend:", err);
    }
  },

  populateRestaurantDatalist() {
    const listEl = document.getElementById("fsRestaurantsDatalist");
    if (!listEl) return;
    listEl.innerHTML = this.cachedRestaurants.slice(0, 150).map(r => {
      return `<option value="${r.name}">${Restaurants.escapeHtml(Restaurants.formatRegion(r.region))} · ${r.address || ""}</option>`;
    }).join("");
  },

  addRestaurantToRoute(restaurant, jumpToTab = false) {
    const exists = this.routeWaypoints.some(w => (w.placeId && w.placeId === restaurant.placeId) || w.name === restaurant.name);
    if (exists) {
      const msg = i18n.t("fs_msg_already_in_route", { name: restaurant.name });
      if (window.showToast) window.showToast(msg);
      else alert(msg);
      return;
    }
    this.routeWaypoints.push(restaurant);
    this.saveRouteWaypoints();
    this.renderRouteWaypoints();

    if (jumpToTab && window.switchTab) {
      window.switchTab("tab-fieldsale");
      this.switchSubTab("route");
    }

    const msg = i18n.t("fs_msg_added_to_route", { name: restaurant.name });
    if (window.showToast) window.showToast(msg);
    else alert(msg);
  },

  addMultipleToRoute(restaurants, jumpToTab = false) {
    if (!Array.isArray(restaurants) || restaurants.length === 0) return;
    let addedCount = 0;
    restaurants.forEach(r => {
      const exists = this.routeWaypoints.some(w => (w.placeId && w.placeId === r.placeId) || w.name === r.name);
      if (!exists) {
        this.routeWaypoints.push(r);
        addedCount++;
      }
    });

    this.saveRouteWaypoints();
    this.renderRouteWaypoints();

    if (jumpToTab && window.switchTab) {
      window.switchTab("tab-fieldsale");
      this.switchSubTab("route");
    }
    
    if (addedCount > 0) {
      const skipped = restaurants.length - addedCount;
      const skipMsg = skipped > 0 ? i18n.t("fs_msg_batch_skipped", { count: skipped }) : "";
      const msg = i18n.t("fs_msg_batch_added", { count: addedCount, skipMsg });
      if (window.showToast) window.showToast(msg);
      else alert(msg);
    } else {
      const msg = i18n.t("fs_msg_all_in_route");
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
    this.routeWaypoints.splice(index, 1);
    this.saveRouteWaypoints();
    this.renderRouteWaypoints();
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
    const originInput = document.getElementById("fsRouteOriginInput");
    const address = originInput ? originInput.value.trim() : this.originAddress;
    return {
      name: "Green Oil Inc",
      address: address || DEFAULT_ORIGIN_ADDRESS,
      lat: 43.6532,
      lng: -79.3832
    };
  },

  openGoogleMapsNavigation() {
    if (this.routeWaypoints.length === 0) {
      alert(i18n.t("fs_alert_no_waypoints"));
      return;
    }

    const origin = this.getEffectiveOrigin();
    const destination = this.routeWaypoints[this.routeWaypoints.length - 1];
    const intermediates = this.routeWaypoints.slice(0, -1);

    const originStr = encodeURIComponent(origin.address);
    const destStr = encodeURIComponent((destination.name ? destination.name + ", " : "") + (destination.address || ""));
    const wpStr = intermediates.map(w => encodeURIComponent((w.name ? w.name + ", " : "") + (w.address || ""))).join("|");

    let url = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving`;
    if (wpStr) {
      url += `&waypoints=${wpStr}`;
    }

    window.open(url, "_blank");
  },

  renderRouteWaypoints() {
    const listEl = document.getElementById("fsRouteWaypointsList");
    const emptyEl = document.getElementById("fsRouteEmptyNotice");
    const countBadge = document.getElementById("fsRouteStopsBadge");

    if (countBadge) countBadge.textContent = this.routeWaypoints.length;

    if (!listEl) return;

    if (this.routeWaypoints.length === 0) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.style.display = "block";
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";

    listEl.innerHTML = this.routeWaypoints.map((w, index) => {
      const isFirst = index === 0;
      const isLast = index === this.routeWaypoints.length - 1;
      const stopNumber = index + 1;
      const phoneStr = w.phone && w.phone !== "无" ? `<a href="tel:${w.phone}" class="fs-link">${w.phone}</a>` : "";
      const isVisited = !!w.visited;
      const visitedBadge = isVisited 
        ? `<span style="background: #d1fae5; color: #065f46; font-size: 0.72rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">✓ ${i18n.t("visited_yes")}</span>` 
        : `<span style="background: #fef3c7; color: #92400e; font-size: 0.72rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${i18n.t("visited_pending")}</span>`;

      return `
        <div class="fs-waypoint-card ${isVisited ? 'is-visited' : ''}" style="${isVisited ? 'border-left: 4px solid #10b981;' : ''}">
          <div class="fs-wp-badge" style="${isVisited ? 'background: #10b981;' : ''}">${stopNumber}</div>
          <div class="fs-wp-content">
            <div class="fs-wp-header">
              <span class="fs-wp-name">${w.name}</span>
              ${visitedBadge}
              <span class="fs-wp-region">${Restaurants.formatRegion(w.region) || "GTA"}</span>
            </div>
            <div class="fs-wp-address">${w.address || i18n.t("no_address")}</div>
            <div class="fs-wp-meta">${phoneStr}</div>
          </div>
          <div class="fs-wp-actions">
            <button class="fs-btn-action fs-btn-nav" data-action="nav" data-index="${index}" title="${i18n.t("fs_btn_nav_title")}">${i18n.t("fs_btn_nav")}</button>
            <button class="fs-btn-action" data-action="up" data-index="${index}" ${isFirst ? "disabled" : ""} title="${i18n.t("fs_btn_move_up")}">${i18n.t("fs_btn_move_up")}</button>
            <button class="fs-btn-action" data-action="down" data-index="${index}" ${isLast ? "disabled" : ""} title="${i18n.t("fs_btn_move_down")}">${i18n.t("fs_btn_move_down")}</button>
            <button class="fs-btn-action fs-btn-del" data-action="del" data-index="${index}" title="${i18n.t("btn_delete")}">${i18n.t("btn_delete")}</button>
            <button class="fs-btn-action fs-btn-log" data-action="log" data-index="${index}" title="${isVisited ? i18n.t('fs_btn_log_title_edit') : i18n.t('fs_btn_log_title_new')}" style="${isVisited ? 'background: #d1fae5; color: #065f46; border-color: #a7f3d0;' : ''}">${isVisited ? i18n.t('fs_btn_log_recorded') : i18n.t('fs_btn_log_new')}</button>
          </div>
        </div>
      `;
    }).join("");

    // Bind action events
    listEl.querySelectorAll(".fs-btn-action, .fs-btn-icon").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.index, 10);
        if (action === "nav") {
          const rest = this.routeWaypoints[idx];
          const query = encodeURIComponent((rest.name ? rest.name + " " : "") + (rest.address || ""));
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

    if (inPhone) inPhone.value = rest ? (rest.phone || "") : "";
    if (inAddress) inAddress.value = rest ? (rest.address || "") : "";
    if (inContact) inContact.value = rest ? (rest.contactPerson || "") : "";
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
    const chkSyncKv = document.getElementById("fsSyncRestToKv");

    const updatedPhone = inPhone ? inPhone.value.trim() : rest.phone;
    const updatedAddress = inAddress ? inAddress.value.trim() : rest.address;
    const updatedContact = inContact ? inContact.value.trim() : "";

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

    // 2. Sync modified restaurant info to KV if checked
    if (chkSyncKv && chkSyncKv.checked) {
      const restUpdates = {};
      if (updatedPhone && updatedPhone !== rest.phone) restUpdates.phone = updatedPhone;
      if (updatedAddress && updatedAddress !== rest.address) restUpdates.address = updatedAddress;
      if (updatedContact) restUpdates.contactPerson = updatedContact;

      if (Object.keys(restUpdates).length > 0) {
        await Api.updateRestaurant(rest.placeId, rest.name, restUpdates);
        // Update local cache
        rest.phone = updatedPhone;
        rest.address = updatedAddress;
        rest.contactPerson = updatedContact;
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
