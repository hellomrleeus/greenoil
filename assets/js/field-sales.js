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
import { Auth } from "./auth.js";

const DEFAULT_ORIGIN_ADDRESS = "Green Oil Inc, Toronto, ON";
const STORAGE_ORIGIN_KEY = "greenoil_start_address";
const STORAGE_SALES_CACHE_KEY = "greenoil_field_sales_cache";

export const FieldSales = {
  activeSubTab: "route", // route | records | analytics
  routeWaypoints: [],
  originAddress: DEFAULT_ORIGIN_ADDRESS,
  useGpsOrigin: false,
  userGps: null,
  cachedRestaurants: [],
  salesRecords: [],
  filterOutcome: "all",
  filterMethod: "all",
  searchKeyword: "",
  editingRecordId: null,
  selectedRestaurantForSale: null,

  async init() {
    this.originAddress = localStorage.getItem(STORAGE_ORIGIN_KEY) || DEFAULT_ORIGIN_ADDRESS;
    this.bindSubTabEvents();
    this.bindRouteEvents();
    this.bindRecordEvents();
    this.bindGmapSearchEvents();
    this.bindAnalyticsEvents();

    // Load initial data
    await this.loadSalesRecords();
    this.loadCachedRestaurants();
    this.renderRouteWaypoints();
    this.requestUserLocation(false);
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

  requestUserLocation(showNotice = false) {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userGps = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        if (showNotice) {
          alert(`✅ 已获取您的当前定位 (${this.userGps.lat.toFixed(4)}, ${this.userGps.lng.toFixed(4)})`);
        }
        if (this.useGpsOrigin) {
          const originInput = document.getElementById("fsRouteOriginInput");
          if (originInput) originInput.value = `GPS: ${this.userGps.lat.toFixed(4)}, ${this.userGps.lng.toFixed(4)}`;
        }
      },
      (err) => {
        if (showNotice) {
          alert(`⚠️ 获取定位失败: ${err.message}`);
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
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
      });
    }

    const chkGps = document.getElementById("fsRouteUseGps");
    if (chkGps) {
      chkGps.addEventListener("change", (e) => {
        this.useGpsOrigin = e.target.checked;
        if (this.useGpsOrigin) {
          this.requestUserLocation(true);
          if (this.userGps && originInput) {
            originInput.value = `GPS: ${this.userGps.lat.toFixed(4)}, ${this.userGps.lng.toFixed(4)}`;
          }
        } else {
          if (originInput) originInput.value = this.originAddress;
        }
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

    // Clear Route
    const btnClear = document.getElementById("fsRouteBtnClear");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        if (confirm("确定清空当前路线规划中的所有餐馆？")) {
          this.routeWaypoints = [];
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

  populateRestaurantDatalist() {
    const listEl = document.getElementById("fsRestaurantsDatalist");
    if (!listEl) return;
    listEl.innerHTML = this.cachedRestaurants.slice(0, 150).map(r => {
      return `<option value="${r.name}">${r.region || ""} · ${r.address || ""}</option>`;
    }).join("");
  },

  addRestaurantToRoute(restaurant) {
    const exists = this.routeWaypoints.some(w => (w.placeId && w.placeId === restaurant.placeId) || w.name === restaurant.name);
    if (exists) {
      alert(`餐馆 “${restaurant.name}” 已在路线中！`);
      return;
    }
    this.routeWaypoints.push(restaurant);
    this.renderRouteWaypoints();
  },

  addMultipleToRoute(restaurants) {
    if (!Array.isArray(restaurants) || restaurants.length === 0) return;
    let addedCount = 0;
    restaurants.forEach(r => {
      const exists = this.routeWaypoints.some(w => (w.placeId && w.placeId === r.placeId) || w.name === r.name);
      if (!exists) {
        this.routeWaypoints.push(r);
        addedCount++;
      }
    });

    this.renderRouteWaypoints();
    window.switchTab("tab-fieldsale");
    this.switchSubTab("route");
    alert(`已将 ${addedCount} 家餐馆加入拜访路线规划！`);
  },

  moveWaypoint(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= this.routeWaypoints.length) return;
    const temp = this.routeWaypoints[index];
    this.routeWaypoints[index] = this.routeWaypoints[targetIdx];
    this.routeWaypoints[targetIdx] = temp;
    this.renderRouteWaypoints();
  },

  removeWaypoint(index) {
    this.routeWaypoints.splice(index, 1);
    this.renderRouteWaypoints();
  },

  optimizeRoute() {
    if (this.routeWaypoints.length < 2) {
      alert("路线中至少需包含 2 家餐馆方可进行最短路径优化");
      return;
    }

    // Start location coordinates (default Downtown Toronto / Green Oil if GPS disabled)
    let curLat = (this.useGpsOrigin && this.userGps) ? this.userGps.lat : 43.6532;
    let curLng = (this.useGpsOrigin && this.userGps) ? this.userGps.lng : -79.3832;

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
    this.renderRouteWaypoints();
    alert("✅ 已按经纬度几何最短拓扑排序调整拜访顺序！");
  },

  getEffectiveOrigin() {
    if (this.useGpsOrigin && this.userGps) {
      return {
        name: "当前GPS定位",
        address: `${this.userGps.lat},${this.userGps.lng}`,
        lat: this.userGps.lat,
        lng: this.userGps.lng
      };
    }
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
      alert("请先添加途经餐馆后再发起导航");
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
      const phoneStr = w.phone && w.phone !== "无" ? `<a href="tel:${w.phone}" class="fs-link">📞 ${w.phone}</a>` : "";

      return `
        <div class="fs-waypoint-card">
          <div class="fs-wp-badge">${stopNumber}</div>
          <div class="fs-wp-content">
            <div class="fs-wp-header">
              <span class="fs-wp-name">${w.name}</span>
              <span class="fs-wp-region">${w.region || "GTA"}</span>
            </div>
            <div class="fs-wp-address">📍 ${w.address || "无地址信息"}</div>
            <div class="fs-wp-meta">${phoneStr}</div>
          </div>
          <div class="fs-wp-actions">
            <button class="fs-btn-icon fs-btn-nav" data-action="nav" data-index="${index}" title="在 Google 地图导航到此处">🧭</button>
            <button class="fs-btn-icon" data-action="up" data-index="${index}" ${isFirst ? "disabled" : ""} title="上移">⬆️</button>
            <button class="fs-btn-icon" data-action="down" data-index="${index}" ${isLast ? "disabled" : ""} title="下移">⬇️</button>
            <button class="fs-btn-icon" data-action="del" data-index="${index}" title="删除">🗑️</button>
            <button class="fs-btn-icon fs-btn-log" data-action="log" data-index="${index}" title="记录拜访">📝</button>
          </div>
        </div>
      `;
    }).join("");

    // Bind action events
    listEl.querySelectorAll(".fs-btn-icon").forEach(btn => {
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

  openSalesRecordModal(existingRecord = null, presetRestaurant = null) {
    this.editingRecordId = existingRecord ? existingRecord.id : null;
    const modal = document.getElementById("fsRecordModalOverlay");
    const title = document.getElementById("fsRecordModalTitle");

    if (title) {
      title.textContent = existingRecord ? i18n.t("fs_record_title_edit") : i18n.t("fs_record_title_new");
    }

    // Prefill form
    const now = new Date();
    const localHour = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 13) + ":00";

    const timeInput = document.getElementById("fsRecordTime");
    if (timeInput) timeInput.value = existingRecord ? existingRecord.visitTime : localHour;

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
    }

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

    let optionsList = [...this.cachedRestaurants];

    // If user GPS is available, calculate proximity distance and sort ascending
    if (this.userGps) {
      optionsList.forEach(r => {
        const rLat = parseFloat(r.latitude) || 43.76;
        const rLng = parseFloat(r.longitude) || -79.41;
        r._distKm = this.getHaversineDistance(this.userGps.lat, this.userGps.lng, rLat, rLng);
      });
      optionsList.sort((a, b) => (a._distKm || 999) - (b._distKm || 999));
    }

    // Ensure selected rest is available
    if (selectedRest && !optionsList.some(r => r.name === selectedRest.name)) {
      optionsList.unshift(selectedRest);
    }

    let html = `<option value="">-- 请选择关联餐馆 --</option>`;

    optionsList.slice(0, 100).forEach((r, idx) => {
      let label = r.name;
      if (r._distKm !== undefined) {
        const distStr = r._distKm < 1 ? `${Math.round(r._distKm * 1000)}m` : `${r._distKm.toFixed(1)}km`;
        label = `📍 [${distStr}] ${r.name} (${r.region || "GTA"})`;
      } else {
        label = `${r.name} (${r.region || "GTA"})`;
      }
      const isSelected = selectedRest && (selectedRest.name === r.name || (selectedRest.placeId && selectedRest.placeId === r.placeId));
      html += `<option value="${r.placeId || r.name}" ${isSelected ? "selected" : ""}>${label}</option>`;
    });

    selectEl.innerHTML = html;

    // Listen for select changes
    selectEl.onchange = (e) => {
      const key = e.target.value;
      const found = optionsList.find(r => (r.placeId && r.placeId === key) || r.name === key);
      if (found) {
        this.selectedRestaurantForSale = found;
        this.updateRestaurantEditInputs(found);
      }
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

    let rest = this.selectedRestaurantForSale;
    if (!rest && selectedKey) {
      rest = this.cachedRestaurants.find(r => (r.placeId && r.placeId === selectedKey) || r.name === selectedKey);
    }

    if (!rest) {
      alert("请选择要关联的餐馆，或通过 Google 地图搜索添加新餐馆");
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
    if (btnSubmit) btnSubmit.textContent = "正在保存...";

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

    this.closeSalesRecordModal();
    this.renderSalesRecords();
    if (this.activeSubTab === "analytics") this.renderAnalytics();
    alert("✅ 拜访记录已成功保存！");
  },

  async deleteRecord(recordId) {
    if (!confirm("确定删除这条拜访记录吗？")) return;
    this.salesRecords = this.salesRecords.filter(r => r.id !== recordId);
    try {
      localStorage.setItem(STORAGE_SALES_CACHE_KEY, JSON.stringify(this.salesRecords));
    } catch (e) {}

    this.renderSalesRecords();
    await Api.deleteSale(recordId);
  },

  renderSalesRecords() {
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

    listEl.innerHTML = filtered.map(r => {
      const outcomeBadge = this.getOutcomeBadge(r.outcome);
      const methodBadge = r.method === "onsite" ? `<span class="fs-tag fs-tag-onsite">🚗 现场拜访</span>` : `<span class="fs-tag fs-tag-phone">📞 电话沟通</span>`;
      const timeFormatted = r.visitTime ? r.visitTime.replace("T", " ") : "";

      let detailsBlock = "";
      if (r.outcome === "rejected" && (r.rejectionReason || r.rejectionReasonDetails)) {
        detailsBlock = `
          <div class="fs-record-rejection">
            <span class="fs-reject-tag">拒绝原因：${r.rejectionReason || "未注明"}</span>
            ${r.rejectionReasonDetails ? `<span class="fs-reject-desc">${r.rejectionReasonDetails}</span>` : ""}
          </div>
        `;
      } else if (r.outcome === "signed_others") {
        detailsBlock = `
          <div class="fs-record-competitor">
            <div class="fs-comp-title">🏢 签其他服务商：${r.signedOthersReason || "未注明原因"}</div>
            ${r.competitorName ? `<div><strong>供应商：</strong>${r.competitorName}</div>` : ""}
            ${r.competitorQuote ? `<div><strong>报价/政策：</strong>${r.competitorQuote}</div>` : ""}
            ${r.contractExpiryDate ? `<div><strong>预计到期：</strong>${r.contractExpiryDate}</div>` : ""}
          </div>
        `;
      }

      return `
        <div class="fs-record-card">
          <div class="fs-rec-header">
            <div class="fs-rec-rest-info">
              <h4 class="fs-rec-name">${r.restaurantName}</h4>
              <span class="fs-rec-region">${r.region || "GTA"}</span>
            </div>
            <div class="fs-rec-badges">
              ${methodBadge}
              ${outcomeBadge}
            </div>
          </div>

          <div class="fs-rec-meta">
            <span>🕒 ${timeFormatted}</span>
            <span>📍 ${r.restaurantAddress || "无地址"}</span>
            ${r.restaurantPhone ? `<span>📞 ${r.restaurantPhone}</span>` : ""}
            <span>👤 业务员: ${r.salesRep || "greenoil"}</span>
          </div>

          ${detailsBlock}

          ${r.notes ? `<div class="fs-rec-notes"><strong>沟通纪要：</strong>${r.notes}</div>` : ""}

          <div class="fs-rec-actions">
            <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${r.id}">编辑</button>
            <button class="btn btn-secondary btn-sm fs-btn-delete" data-action="delete" data-id="${r.id}">删除</button>
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll("button[data-action='edit']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const item = this.salesRecords.find(r => r.id === id);
        if (item) this.openSalesRecordModal(item);
      });
    });

    listEl.querySelectorAll("button[data-action='delete']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        this.deleteRecord(id);
      });
    });
  },

  getOutcomeBadge(outcome) {
    switch (outcome) {
      case "contract_signed":
        return `<span class="fs-badge fs-badge-signed">🤝 签订合同</span>`;
      case "interested":
        return `<span class="fs-badge fs-badge-interested">💡 有意向</span>`;
      case "rejected":
        return `<span class="fs-badge fs-badge-rejected">❌ 拒绝</span>`;
      case "signed_others":
        return `<span class="fs-badge fs-badge-others">🏢 已签其他</span>`;
      default:
        return `<span class="fs-badge">${outcome}</span>`;
    }
  },

  // -------------------------------------------------------------
  // Sub-Module 3: Google Maps Search & Add Modal
  // -------------------------------------------------------------
  bindGmapSearchEvents() {
    const btnOpen = document.getElementById("fsBtnOpenGmapSearch");
    const modal = document.getElementById("fsGmapModalOverlay");
    const btnClose = document.getElementById("fsGmapModalClose");
    const btnSearch = document.getElementById("fsGmapBtnSearch");
    const inputQuery = document.getElementById("fsGmapSearchInput");

    if (btnOpen) {
      btnOpen.addEventListener("click", () => {
        if (modal) modal.classList.add("active");
        if (inputQuery) inputQuery.focus();
      });
    }

    if (btnClose && modal) {
      btnClose.addEventListener("click", () => modal.classList.remove("active"));
    }

    const doSearch = async () => {
      const q = inputQuery ? inputQuery.value.trim() : "";
      if (!q) return;
      const loader = document.getElementById("fsGmapLoader");
      const resultsContainer = document.getElementById("fsGmapResults");

      if (loader) loader.style.display = "block";
      if (resultsContainer) resultsContainer.innerHTML = "";

      const res = await Api.searchGooglePlaces(q);
      if (loader) loader.style.display = "none";

      if (res && res.success && Array.isArray(res.places) && res.places.length > 0) {
        this.renderGmapSearchResults(res.places);
      } else {
        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div class="fs-empty-notice">
              ${res && res.error ? `<p style="color: #ef4444;">${res.error}</p>` : ""}
              <p>${i18n.t("fs_gmap_no_results")}</p>
              <button class="btn btn-primary btn-sm" id="fsBtnManualEntry" style="margin-top: 0.5rem;">手动录入此餐馆</button>
            </div>
          `;
          const btnManual = document.getElementById("fsBtnManualEntry");
          if (btnManual) {
            btnManual.addEventListener("click", () => {
              const newRest = {
                name: q,
                address: q,
                region: "全部 (All GTA)",
                phone: "无",
                placeId: "manual_" + Date.now(),
                latitude: 43.76,
                longitude: -79.41
              };
              this.addAndSelectNewRestaurant(newRest);
              if (modal) modal.classList.remove("active");
            });
          }
        }
      }
    };

    if (btnSearch) btnSearch.addEventListener("click", doSearch);
    if (inputQuery) {
      inputQuery.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doSearch();
        }
      });
    }
  },

  renderGmapSearchResults(places) {
    const container = document.getElementById("fsGmapResults");
    if (!container) return;

    container.innerHTML = places.map((p, idx) => {
      return `
        <div class="fs-gmap-item">
          <div class="fs-gmap-info">
            <h4 class="fs-gmap-name">${p.name}</h4>
            <div class="fs-gmap-addr">📍 ${p.address || "无地址"}</div>
            <div class="fs-gmap-meta">
              <span>⭐ ${p.rating || "4.2"} (${p.reviews || 0} 条评价)</span>
              ${p.phone && p.phone !== "无" ? `<span>📞 ${p.phone}</span>` : ""}
            </div>
          </div>
          <button class="btn btn-primary btn-sm fs-btn-select-gmap" data-idx="${idx}">
            ${i18n.t("fs_gmap_btn_add")}
          </button>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".fs-btn-select-gmap").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const selectedPlace = places[idx];
        if (selectedPlace) {
          this.addAndSelectNewRestaurant(selectedPlace);
          const modal = document.getElementById("fsGmapModalOverlay");
          if (modal) modal.classList.remove("active");
        }
      });
    });
  },

  async addAndSelectNewRestaurant(restaurant) {
    // 1. Add to backend Cloudflare KV
    await Api.addRestaurant(restaurant);

    // 2. Add to local cached restaurants
    this.cachedRestaurants.unshift(restaurant);
    this.populateRestaurantDatalist();

    // 3. Select in current sales record modal
    this.selectedRestaurantForSale = restaurant;
    this.populateProximityRestaurantOptions(restaurant);
    this.updateRestaurantEditInputs(restaurant);

    alert(`🎉 已成功收录餐馆 “${restaurant.name}” 并同步至云端 KV 数据库！`);
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
      { label: "签订合同", count: signed, color: "#10b981" },
      { label: "有意向", count: interested, color: "#3b82f6" },
      { label: "拒绝", count: rejected, color: "#94a3b8" },
      { label: "已签其他", count: others, color: "#f59e0b" }
    ]);

    // 2. Render Rejection / Others Reasons Donut Chart
    const reasonsMap = {};
    this.salesRecords.forEach(r => {
      if (r.outcome === "rejected" && r.rejectionReason) {
        reasonsMap[r.rejectionReason] = (reasonsMap[r.rejectionReason] || 0) + 1;
      }
      if (r.outcome === "signed_others" && r.signedOthersReason) {
        reasonsMap[r.signedOthersReason] = (reasonsMap[r.signedOthersReason] || 0) + 1;
      }
    });

    const reasonsData = Object.entries(reasonsMap).map(([label, count], i) => {
      const palette = ["#ef4444", "#f97316", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];
      return { label, count, color: palette[i % palette.length] };
    });

    this.renderDonutChart("fsChartReasonsContainer", reasonsData.length > 0 ? reasonsData : [
      { label: "暂无拒绝数据", count: 1, color: "#e2e8f0" }
    ]);

    // 3. Render Sales Methods Comparison Bar Chart
    const onsiteSigned = this.salesRecords.filter(r => r.method === "onsite" && r.outcome === "contract_signed").length;
    const phoneSigned = this.salesRecords.filter(r => r.method === "phone" && r.outcome === "contract_signed").length;
    const onsiteInt = this.salesRecords.filter(r => r.method === "onsite" && r.outcome === "interested").length;
    const phoneInt = this.salesRecords.filter(r => r.method === "phone" && r.outcome === "interested").length;

    this.renderGroupedBarChart("fsChartMethodsContainer", [
      { category: "签约合同", onsite: onsiteSigned, phone: phoneSigned },
      { category: "意向跟进", onsite: onsiteInt, phone: phoneInt },
      { category: "总拜访数", onsite: onsite, phone: total - onsite }
    ]);

    // 4. Render Regional Distribution Bar Chart
    const regionCounts = {};
    this.salesRecords.forEach(r => {
      const reg = (r.region || "其他").split(" ")[0].replace("(", "");
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
      container.innerHTML = `<div class="fs-chart-empty">暂无统计数据</div>`;
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
            <text x="50%" y="62%" text-anchor="middle" font-size="11" fill="var(--text-muted)">记录总计</text>
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
            <div class="fs-bar-col fs-bar-onsite" style="height: ${Math.max(8, hOnsite)}%;" title="现场: ${d.onsite}">
              <span class="fs-bar-col-val">${d.onsite}</span>
            </div>
            <div class="fs-bar-col fs-bar-phone" style="height: ${Math.max(8, hPhone)}%;" title="电话: ${d.phone}">
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
          <span><span class="fs-legend-dot" style="background: #10b981;"></span> 现场拜访</span>
          <span><span class="fs-legend-dot" style="background: #3b82f6;"></span> 电话沟通</span>
        </div>
      </div>
    `;
  },

  renderSimpleBarChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML = `<div class="fs-chart-empty">暂无区域数据</div>`;
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
          <div class="fs-hbar-val">${d.count} 次</div>
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
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">暂无收集到的竞品供应商报价数据</td></tr>`;
      return;
    }

    tableBody.innerHTML = compRecords.map(r => {
      return `
        <tr>
          <td style="font-weight: 600;">${r.restaurantName}</td>
          <td><span class="fs-tag fs-tag-others">${r.competitorName || "未知供应商"}</span></td>
          <td style="color: #d97706; font-weight: 600;">${r.competitorQuote || "未透露具体价格"}</td>
          <td>${r.contractExpiryDate || "未填"}</td>
          <td>${r.signedOthersReason || r.notes || "-"}</td>
        </tr>
      `;
    }).join("");
  },

  exportSalesToExcel() {
    if (this.salesRecords.length === 0) {
      alert("当前暂无拜访记录可导出");
      return;
    }

    const exportRows = this.salesRecords.map(r => ({
      "拜访时间": r.visitTime,
      "餐馆名称": r.restaurantName,
      "所属区域": r.region,
      "详细地址": r.restaurantAddress,
      "联系电话": r.restaurantPhone,
      "负责人/联系人": r.contactPerson || "",
      "拜访方式": r.method === "onsite" ? "现场拜访" : "电话沟通",
      "销售结果": this.getOutcomeText(r.outcome),
      "拒绝原因": r.rejectionReason,
      "拒绝详细说明": r.rejectionReasonDetails,
      "签其他原因": r.signedOthersReason,
      "竞品供应商": r.competitorName,
      "竞品报价/补贴": r.competitorQuote,
      "竞品合同到期日": r.contractExpiryDate,
      "沟通纪要": r.notes,
      "业务员": r.salesRep,
      "创建时间": r.createdAt
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
      case "contract_signed": return "签订合同";
      case "interested": return "有意向";
      case "rejected": return "拒绝";
      case "signed_others": return "已签其他";
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
