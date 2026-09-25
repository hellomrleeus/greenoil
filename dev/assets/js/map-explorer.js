/**
 * Green Oil Map Explorer & Dynamic Route Planner (地图找店与路径规划)
 * 3-Column Split Workbench:
 * - Left Column: Google Maps places search results & 1-click add to route
 * - Middle Column: Interactive Google Map with live Google-blue route polyline & floating status ribbon
 * - Right Column: User waypoints with HTML5 drag-and-drop, schedule optimization, and navigation
 *
 * Subject to Google Maps Platform Terms of Service:
 * https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_git_agentskills_v1
 */

import { displayGeometry } from "./map-geometry.js";
import { Api } from "./api.js";
import { i18n } from "./i18n.js";
import { BusinessHours } from "./business-hours.js";

// GTA Region / City Hierarchy
export const GTA_COMMUNITIES = [
  {
    id: "all",
    name: "全部大区 (All GTA)",
    nameZh: "全部大区",
    nameEn: "All GTA",
    nameKo: "광역 토론토 전체",
    center: { lat: 43.7282, lng: -79.3832 },
    zoom: 11,
    bbox: [-79.7200, 43.5800, -79.1600, 43.9500],
    neighborhoods: []
  },
  {
    id: "toronto",
    name: "多伦多 (Toronto)",
    nameZh: "多伦多",
    nameEn: "Toronto",
    nameKo: "토론토",
    center: { lat: 43.7001, lng: -79.4163 },
    zoom: 12,
    bbox: [-79.6390, 43.5810, -79.1150, 43.8550],
    neighborhoods: []
  },
  {
    id: "scarborough",
    name: "士嘉堡 (Scarborough)",
    nameZh: "士嘉堡",
    nameEn: "Scarborough",
    nameKo: "스카버러",
    center: { lat: 43.7764, lng: -79.2318 },
    zoom: 12,
    bbox: [-79.34985, 43.67108, -79.11527, 43.85546],
    neighborhoods: []
  },
  {
    id: "markham",
    name: "万锦 (Markham)",
    nameZh: "万锦",
    nameEn: "Markham",
    nameKo: "마컴",
    center: { lat: 43.8561, lng: -79.3370 },
    zoom: 13,
    bbox: [-79.3790, 43.8190, -79.1760, 43.9310],
    neighborhoods: []
  },
  {
    id: "richmond_hill",
    name: "列治文山 (Richmond Hill)",
    nameZh: "列治文山",
    nameEn: "Richmond Hill",
    nameKo: "리치몬드 힐",
    center: { lat: 43.8828, lng: -79.4403 },
    zoom: 13,
    bbox: [-79.4670, 43.8320, -79.3700, 43.9570],
    neighborhoods: []
  },
  {
    id: "mississauga",
    name: "密西沙加 (Mississauga)",
    nameZh: "密西沙加",
    nameEn: "Mississauga",
    nameKo: "미시사가",
    center: { lat: 43.5890, lng: -79.6441 },
    zoom: 12,
    bbox: [-79.7600, 43.4800, -79.5400, 43.7200],
    neighborhoods: []
  },
  {
    id: "vaughan",
    name: "旺市 (Vaughan)",
    nameZh: "旺市",
    nameEn: "Vaughan",
    nameKo: "본",
    center: { lat: 43.8372, lng: -79.5083 },
    zoom: 13,
    bbox: [-79.6200, 43.7600, -79.4300, 43.9200],
    neighborhoods: []
  }
];

const DEFAULT_ORIGIN_ADDRESS = "Green Oil Inc. 4490 Chesswood Dr Unit 3, North York, ON M3J 2B9";
const DEFAULT_ORIGIN_COORDS = { lat: 43.7643, lng: -79.4768 };

export const MapExplorer = {
  isInitialized: false,
  googleMap: null,
  placesService: null,
  directionsService: null,
  routesApiEnabled: false,
  routesApiDisabled: false,
  routePolyline: null,
  originMarker: null,
  markersMap: new Map(), // key -> Google Marker or Leaflet Marker
  infoWindow: null,
  displayedPlaces: [],
  filteredPlaces: [],
  googleAreaPlaces: [],
  poiPlaces: new Map(),
  activePopupKey: null,
  poiRequestId: 0,
  googlePhotosCache: new Map(),
  googleApiKey: "",
  mapContextMenuEl: null,
  mapContextMenuPoint: null,
  routeRenderGeneration: 0,
  googleNextPageToken: null,
  isLoadingMore: false,
  isViewportSearchMode: false,
  lastSearchedCenter: null,
  lastSearchedZoom: null,

  // Route Planning State (Multi-Route Groups)
  routeGroups: [
    {
      id: "group_default",
      name: "路线 1",
      origin: DEFAULT_ORIGIN_ADDRESS,
      waypoints: []
    }
  ],
  activeGroupId: "group_default",
  get routeWaypoints() {
    const grp = this.getActiveRouteGroup();
    return grp ? grp.waypoints : [];
  },
  set routeWaypoints(val) {
    const grp = this.getActiveRouteGroup();
    if (grp) {
      grp.waypoints = Array.isArray(val) ? val : [];
    }
  },
  getActiveRouteGroup() {
    if (!Array.isArray(this.routeGroups) || this.routeGroups.length === 0) {
      this.routeGroups = [
        {
          id: "group_default",
          name: (typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_default_name") : "路线 1") || "路线 1",
          origin: this.originAddress || DEFAULT_ORIGIN_ADDRESS,
          waypoints: []
        }
      ];
      this.activeGroupId = "group_default";
    }
    let grp = this.routeGroups.find(g => g.id === this.activeGroupId);
    if (!grp) {
      grp = this.routeGroups[0];
      this.activeGroupId = grp.id;
    }
    if (!Array.isArray(grp.waypoints)) {
      grp.waypoints = [];
    }
    return grp;
  },
  selectedWaypointKeys: new Set(),
  waypointSearchKeyword: "",
  isRouteMode: true,
  originAddress: DEFAULT_ORIGIN_ADDRESS,
  originCoords: { ...DEFAULT_ORIGIN_COORDS },
  _saveDebounceTimer: null,
  _isSyncingFromBackend: false,

  // GeoJSON Municipal Boundaries Dataset & Hash Map Index
  neighbourhoodsGeoJson: null,
  neighbourhoodsMap: new Map(),

  // Fallback map state
  isFallbackMode: false,
  fallbackMap: null,
  fallbackLayerGroup: null,

  // Filter States
  activeCityIds: new Set(["scarborough"]),
  activeNeighborhoodIds: new Set(),
  polygonsMap: new Map(),
  activeCategory: "全部",
  searchKeyword: "",
  popoverSearchQuery: "",
  resizeObserver: null,

  // Pagination
  currentPage: 1,
  pageSize: 15,
  areaLoadId: 0,
  areaAbort: null,
  googleSearchId: 0,

  // Marker animation & caching
  markerRenderGeneration: 0,
  markerBatchTimer: null,
  growingMarkers: new Map(),
  pinIconCache: new Map(),
  pinZoomScale: 1,
  highlightedPinKey: null,

  // -------------------------------------------------------------
  // Filter State Persistence
  // -------------------------------------------------------------
  saveFilterState() {
    try {
      const state = {
        activeCityIds: Array.from(this.activeCityIds),
        activeNeighborhoodIds: Array.from(this.activeNeighborhoodIds),
        activeCategory: this.activeCategory,
        activeVisited: this.activeVisited,
        activeOutcome: this.activeOutcome,
        searchKeyword: this.searchKeyword
      };
      const json = JSON.stringify(state);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("greenoil_map_filter_state", json);
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("greenoil_map_filter_state_v2", json);
      }
    } catch (e) {
      console.warn("Failed to save map filter state:", e);
    }
  },

  restoreFilterState() {
    try {
      let saved = null;
      if (typeof sessionStorage !== "undefined") {
        saved = sessionStorage.getItem("greenoil_map_filter_state_v2");
      }
      if (!saved && typeof localStorage !== "undefined") {
        saved = localStorage.getItem("greenoil_map_filter_state");
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.activeCityIds)) {
          this.activeCityIds = new Set(parsed.activeCityIds);
        }
        if (Array.isArray(parsed.activeNeighborhoodIds)) {
          this.activeNeighborhoodIds = new Set(parsed.activeNeighborhoodIds);
        }
        if (parsed.activeCategory) this.activeCategory = parsed.activeCategory;
        if (parsed.activeVisited) this.activeVisited = parsed.activeVisited;
        if (parsed.activeOutcome) this.activeOutcome = parsed.activeOutcome;
        if (typeof parsed.searchKeyword === "string") this.searchKeyword = parsed.searchKeyword;
        return true;
      }
      return false;
    } catch (e) {
      console.warn("Failed to restore map filter state:", e);
      return false;
    }
  },

  syncFilterControlsFromState() {
    const catSelect = document.getElementById("mapCategorySelect");
    if (catSelect && this.activeCategory) catSelect.value = this.activeCategory;

    const visitedSelect = document.getElementById("mapVisitedSelect");
    if (visitedSelect && this.activeVisited) visitedSelect.value = this.activeVisited;

    const outcomeSelect = document.getElementById("mapOutcomeSelect");
    if (outcomeSelect && this.activeOutcome) outcomeSelect.value = this.activeOutcome;

    const keywordInput = document.getElementById("mapKeywordInput");
    if (keywordInput && this.searchKeyword) keywordInput.value = this.searchKeyword;
  },

  // -------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.googleApiKey = await Api.getGoogleMapsApiKey();

    // 1. Load official GTA municipal GeoJSON boundaries dataset
    await this.loadNeighbourhoodsGeoJson();

    // 2. Restore filter state & route waypoints
    this.restoreFilterState();
    this.initRouteState();

    this.setupAuthFailureHandler();
    this.bindEvents();
    this.syncFilterControlsFromState();
    this.setupResizeObserver();
    this.renderPopover();
    this.updateAreaSummaryBtn();
    this.updateFilterDropdownsLanguage();
    this.updateResultsSummary();
    this.renderPagination();

    const onLangChangeHandler = () => {
      this.updateAreaSummaryBtn();
      this.renderPopover();
      this.updateResultsSummary();
      this.updateFilterDropdownsLanguage();
      this.renderPlacesCards();
      this.renderWaypoints();
      this.renderMarkers();
      this.renderPagination();
      const badgeEl = document.getElementById("mapWaypointsBadge");
      if (badgeEl) badgeEl.textContent = `${this.routeWaypoints.length} ${i18n.t("map_waypoints_unit")}`;
    };

    if (i18n && typeof i18n.onLanguageChange === "function") {
      i18n.onLanguageChange(onLangChangeHandler);
    }

    // 3. Initialize Google Map instance
    await this.initGoogleMap();

    // 4. Fit initial Scarborough area & load places
    const hasExplicitInitialArea = !(this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0);
    if (hasExplicitInitialArea) this.panToSelectedArea();
    await this.loadPlacesForCurrentArea();

    // 5. Initial route render
    this.updateRoute();
  },

  setupAuthFailureHandler() {
    window.gm_authFailure = () => {
      console.warn("Google Maps JavaScript API error (authFailure). Switching to fallback map.");
      const notice = document.getElementById("mapApiNotice");
      if (notice) notice.style.display = "block";
      this.triggerFallbackMode();
    };
  },

  triggerFallbackMode() {
    if (this.isFallbackMode) return;
    this.isFallbackMode = true;
    this.googleMap = null;
    this.initFallbackMap();
  },

  getQueryBounds() {
    const selectedAreas = this.activeNeighborhoodIds.size > 0
      ? this.getAllNeighborhoods().filter(nb => this.activeNeighborhoodIds.has(nb.id))
      : this.activeCityIds.has("all")
        ? []
        : GTA_COMMUNITIES.filter(c => this.activeCityIds.has(c.id));

    if (selectedAreas.length === 0) {
      return [-79.7200, 43.5800, -79.1600, 43.9500];
    }
    let west = 180, south = 90, east = -180, north = -90;
    selectedAreas.forEach(a => {
      if (a.bbox && a.bbox.length === 4) {
        west = Math.min(west, a.bbox[0]);
        south = Math.min(south, a.bbox[1]);
        east = Math.max(east, a.bbox[2]);
        north = Math.max(north, a.bbox[3]);
      }
    });
    return [west, south, east, north];
  },

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // Route State Management & Cloud Persistence (Cloudflare KV)
  // -------------------------------------------------------------
  initRouteState() {
    // 1. Clean up any stale legacy route keys from localStorage
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("greenoil_map_route_groups_v1");
        localStorage.removeItem("greenoil_map_active_group_id_v1");
        localStorage.removeItem("greenoil_map_routes_updated_at");
        localStorage.removeItem("greenoil_route_waypoints_v2");
        localStorage.removeItem("greenoil_route_updated_at");
        localStorage.removeItem("greenoil_route_origin_v2");
      }
    } catch (e) {}

    // 2. Initialize in-memory default state
    this.routeGroups = [
      {
        id: "group_default",
        name: (typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_default_name") : "路线 1") || "路线 1",
        origin: DEFAULT_ORIGIN_ADDRESS,
        waypoints: []
      }
    ];
    this.activeGroupId = "group_default";
    this.originAddress = DEFAULT_ORIGIN_ADDRESS;
    this.originCoords = { ...DEFAULT_ORIGIN_COORDS };

    const originInput = document.getElementById("mapRouteOriginInput");
    if (originInput) {
      originInput.value = this.originAddress;
    }
    this.renderWaypoints();

    // 3. Directly sync authoritative route state from Cloudflare KV backend
    this.syncRouteFromBackend();
  },

  async syncRouteFromBackend() {
    if (this._isSyncingFromBackend) return;
    this._isSyncingFromBackend = true;
    try {
      const res = await Api.getMapRoutes();
      if (!res || !res.success || !res.data) return;

      const serverData = res.data;
      const serverGroups = Array.isArray(serverData.groups) && serverData.groups.length > 0 ? serverData.groups : null;

      if (serverGroups) {
        serverGroups.forEach(grp => {
          if (Array.isArray(grp.waypoints)) {
            grp.waypoints.forEach(w => {
              if (!w._uid) {
                w._uid = "wp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
              }
            });
          } else {
            grp.waypoints = [];
          }
        });
      }

      if (serverGroups && serverGroups.length > 0) {
        this.routeGroups = serverGroups;
        if (serverData.activeGroupId && this.routeGroups.some(g => g.id === serverData.activeGroupId)) {
          this.activeGroupId = serverData.activeGroupId;
        } else {
          this.activeGroupId = this.routeGroups[0].id;
        }

        const isLegacyOrigin = (addr) => {
          if (!addr || typeof addr !== "string") return true;
          const s = addr.trim();
          return s.includes("Progress Ave") || s === "Green Oil Inc, Toronto, ON" || s === "Green Oil Inc";
        };

        if (Array.isArray(this.routeGroups)) {
          this.routeGroups.forEach(g => {
            if (isLegacyOrigin(g.origin)) {
              g.origin = DEFAULT_ORIGIN_ADDRESS;
            }
          });
        }

        const activeGroup = this.getActiveRouteGroup();
        if (activeGroup && activeGroup.origin && !isLegacyOrigin(activeGroup.origin)) {
          this.originAddress = activeGroup.origin;
        } else if (serverData.origin && !isLegacyOrigin(serverData.origin)) {
          this.originAddress = serverData.origin;
        } else {
          this.originAddress = DEFAULT_ORIGIN_ADDRESS;
          if (activeGroup) activeGroup.origin = DEFAULT_ORIGIN_ADDRESS;
          this.originCoords = { ...DEFAULT_ORIGIN_COORDS };
        }

        const originInput = document.getElementById("mapRouteOriginInput");
        if (originInput) originInput.value = this.originAddress;

        this.renderWaypoints();
        this.updateRoute();
        this.renderMarkers();
        this.renderPlacesCards();
      } else if (serverData.origin && !this.originAddress) {
        const isLegacyOrigin = (addr) => {
          if (!addr || typeof addr !== "string") return true;
          const s = addr.trim();
          return s.includes("Progress Ave") || s === "Green Oil Inc, Toronto, ON" || s === "Green Oil Inc";
        };
        this.originAddress = isLegacyOrigin(serverData.origin) ? DEFAULT_ORIGIN_ADDRESS : serverData.origin;
        const originInput = document.getElementById("mapRouteOriginInput");
        if (originInput) originInput.value = this.originAddress;
      }
    } catch (err) {
      console.warn("Failed to sync route groups from cloud:", err);
    } finally {
      this._isSyncingFromBackend = false;
    }
  },

  saveRouteWaypoints(options = {}) {
    // 1. Immediate in-memory state update
    const activeGroup = this.getActiveRouteGroup();
    if (activeGroup) {
      const originInput = document.getElementById("mapRouteOriginInput");
      const effectiveOrigin = (originInput ? originInput.value.trim() : this.originAddress) || DEFAULT_ORIGIN_ADDRESS;
      activeGroup.origin = effectiveOrigin;
      this.originAddress = effectiveOrigin;
    }

    // 2. Debounced or immediate sync directly to Cloudflare KV backend
    if (this._saveDebounceTimer) {
      clearTimeout(this._saveDebounceTimer);
      this._saveDebounceTimer = null;
    }

    if (options.immediate) {
      this._pushRouteWaypointsToBackend();
    } else {
      this._saveDebounceTimer = setTimeout(() => {
        this._pushRouteWaypointsToBackend();
      }, 800);
    }
  },

  async _pushRouteWaypointsToBackend() {
    this._saveDebounceTimer = null;
    try {
      const originInput = document.getElementById("mapRouteOriginInput");
      const effectiveOrigin = (originInput ? originInput.value.trim() : this.originAddress) || DEFAULT_ORIGIN_ADDRESS;

      await Api.saveMapRoutes(
        this.routeGroups,
        this.activeGroupId,
        effectiveOrigin
      );
    } catch (err) {
      console.warn("Failed to persist map route groups to backend:", err);
    }
  },

  // -------------------------------------------------------------
  // Route Groups & Tabs UI Operations
  // -------------------------------------------------------------
  renderRouteTabs() {
    const bar = document.getElementById("mapRouteTabsBar");
    if (!bar) return;

    this.getActiveRouteGroup();

    const canDelete = this.routeGroups.length > 1;
    const btnDel = document.getElementById("mapRouteBtnDeleteTab");
    if (btnDel) {
      btnDel.disabled = !canDelete;
      btnDel.style.opacity = canDelete ? "1" : "0.45";
      btnDel.style.cursor = canDelete ? "pointer" : "not-allowed";
      btnDel.title = (typeof i18n !== "undefined" && i18n.t)
        ? (canDelete ? i18n.t("fs_route_tab_delete") : i18n.t("fs_route_tab_min_alert"))
        : (canDelete ? "删除当前路线标签" : "至少保留一个路线标签");
    }

    bar.innerHTML = this.routeGroups.map(grp => {
      const isActive = grp.id === this.activeGroupId;
      const count = Array.isArray(grp.waypoints) ? grp.waypoints.length : 0;
      const safeName = (grp.name || "路线").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `
        <button type="button" class="map-route-tab-pill ${isActive ? "active" : ""}" data-group-id="${grp.id}" title="${safeName}">
          <span class="tab-pill-name">${safeName}</span>
          <span class="tab-count-badge">${count}</span>
        </button>
      `;
    }).join("");

    const activePill = (bar && typeof bar.querySelector === "function") ? bar.querySelector(".map-route-tab-pill.active") : null;
    if (activePill && typeof activePill.scrollIntoView === "function") {
      activePill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }

    if (bar && typeof bar.querySelectorAll === "function") {
      bar.querySelectorAll(".map-route-tab-pill").forEach(pill => {
        const gid = pill.dataset.groupId;
        pill.addEventListener("click", () => {
          if (gid && gid !== this.activeGroupId) {
            this.switchRouteGroup(gid);
          }
        });
        pill.addEventListener("dblclick", e => {
          e.stopPropagation();
          if (gid) {
            this.renameRouteGroup(gid);
          }
        });
      });
    }
  },

  switchRouteGroup(groupId) {
    if (!groupId || groupId === this.activeGroupId) return;
    const target = this.routeGroups.find(g => g.id === groupId);
    if (!target) return;

    // Persist current origin to current active group
    const originInput = document.getElementById("mapRouteOriginInput");
    if (originInput && this.activeGroupId) {
      const curGroup = this.routeGroups.find(g => g.id === this.activeGroupId);
      if (curGroup) {
        curGroup.origin = originInput.value.trim() || DEFAULT_ORIGIN_ADDRESS;
      }
    }

    this.activeGroupId = groupId;
    this.selectedWaypointKeys.clear();
    this.waypointSearchKeyword = "";
    const wpSearchInput = document.getElementById("mapWaypointsSearchInput");
    if (wpSearchInput) wpSearchInput.value = "";
    const wpSearchClear = document.getElementById("mapWaypointsSearchClear");
    if (wpSearchClear) wpSearchClear.style.display = "none";

    // Set origin to target group's origin
    if (target.origin) {
      this.originAddress = target.origin;
      if (originInput) originInput.value = this.originAddress;
    }

    this.saveRouteWaypoints();
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();
    this.renderPlacesCards();
  },

  newRouteGroup(name = null) {
    if (!name) {
      let num = this.routeGroups.length + 1;
      const basePrefix = (typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_default_name") : "路线 1").replace(/\d+$/, "").trim();
      while (this.routeGroups.some(g => g.name === `${basePrefix} ${num}` || g.name === `路线 ${num}` || g.name === `Route ${num}`)) {
        num++;
      }
      name = `${basePrefix || "路线"} ${num}`;
    }

    const newGroup = {
      id: "group_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      name: name.trim(),
      origin: this.originAddress || DEFAULT_ORIGIN_ADDRESS,
      waypoints: []
    };

    this.routeGroups.push(newGroup);
    this.activeGroupId = newGroup.id;
    this.selectedWaypointKeys.clear();

    this.saveRouteWaypoints();
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();
    this.renderPlacesCards();

    const msg = (typeof i18n !== "undefined" && i18n.t)
      ? i18n.t("toast_created_tab", { name: newGroup.name })
      : `已新建路线标签「${newGroup.name}」`;
    if (window.showToast) window.showToast(msg);
    return newGroup;
  },

  duplicateRouteGroup(groupId = this.activeGroupId) {
    const target = this.routeGroups.find(g => g.id === groupId) || this.getActiveRouteGroup();
    if (!target) return;

    const copySuffix = (typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_copy_suffix") : " (副本)") || " (副本)";
    const newName = `${target.name || "路线"}${copySuffix}`;

    const copiedWaypoints = (target.waypoints || []).map(w => ({
      ...w,
      _uid: "wp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7)
    }));

    const newGroup = {
      id: "group_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      name: newName,
      origin: target.origin || this.originAddress || DEFAULT_ORIGIN_ADDRESS,
      waypoints: copiedWaypoints
    };

    this.routeGroups.push(newGroup);
    this.activeGroupId = newGroup.id;
    this.selectedWaypointKeys.clear();

    this.saveRouteWaypoints();
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();
    this.renderPlacesCards();

    const msg = (typeof i18n !== "undefined" && i18n.t)
      ? i18n.t("toast_copied_tab", { name: newGroup.name })
      : `已复制为新路线标签「${newGroup.name}」`;
    if (window.showToast) window.showToast(msg);
    return newGroup;
  },

  renameRouteGroup(groupId = this.activeGroupId) {
    const grp = this.routeGroups.find(g => g.id === groupId) || this.getActiveRouteGroup();
    if (!grp) return;

    const promptText = (typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_rename_prompt") : "请输入路线标签名称：") || "请输入路线标签名称：";
    const newName = prompt(promptText, grp.name || "");
    if (newName === null) return; // User cancelled
    const trimmed = newName.trim();
    if (!trimmed) {
      alert((typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_rename_empty") : "标签名称不能为空") || "标签名称不能为空");
      return;
    }

    grp.name = trimmed;
    this.saveRouteWaypoints();
    this.renderRouteTabs();

    const msg = (typeof i18n !== "undefined" && i18n.t)
      ? i18n.t("toast_renamed_tab", { name: grp.name })
      : `已重命名路线标签为「${grp.name}」`;
    if (window.showToast) window.showToast(msg);
  },

  deleteRouteGroup(groupId = this.activeGroupId) {
    if (this.routeGroups.length <= 1) {
      const minAlert = (typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_min_alert") : "至少保留一个路线标签") || "至少保留一个路线标签";
      alert(minAlert);
      return;
    }

    const idx = this.routeGroups.findIndex(g => g.id === groupId);
    if (idx < 0) return;
    const grp = this.routeGroups[idx];
    const deletedName = grp.name || "";

    const confirmPattern = (typeof i18n !== "undefined" && i18n.t ? i18n.t("fs_route_tab_delete_confirm") : "确定要删除标签「{name}」及其中的站点吗？") || "确定要删除标签「{name}」及其中的站点吗？";
    const confirmMsg = confirmPattern.replace("{name}", grp.name || "");
    if (!confirm(confirmMsg)) return;

    this.routeGroups.splice(idx, 1);
    const nextGroup = this.routeGroups[Math.min(idx, this.routeGroups.length - 1)];
    this.activeGroupId = nextGroup.id;
    this.selectedWaypointKeys.clear();

    if (nextGroup.origin) {
      this.originAddress = nextGroup.origin;
      const originInput = document.getElementById("mapRouteOriginInput");
      if (originInput) originInput.value = this.originAddress;
    }

    this.saveRouteWaypoints();
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();
    this.renderPlacesCards();

    const delMsg = (typeof i18n !== "undefined" && i18n.t)
      ? i18n.t("toast_deleted_tab", { name: deletedName })
      : `已删除路线标签「${deletedName}」`;
    if (window.showToast) window.showToast(delMsg);
  },

  getEffectiveOrigin() {
    const originInput = document.getElementById("mapRouteOriginInput");
    const address = originInput ? originInput.value.trim() : this.originAddress;
    return {
      name: "Green Oil HQ",
      address: address || DEFAULT_ORIGIN_ADDRESS,
      lat: this.originCoords.lat,
      lng: this.originCoords.lng
    };
  },

  addWaypointToRoute(place) {
    if (!place) return;
    const key = place.placeId || place.name;
    const exists = this.routeWaypoints.some(w => (w.placeId && w.placeId === place.placeId) || ((w.name || "").trim().toLowerCase() === (place.name || "").trim().toLowerCase()));
    if (exists) {
      this.scrollWaypointCardIntoView(key);
      return;
    }

    const waypoint = {
      _uid: "wp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      placeId: place.placeId || "",
      name: place.name || "Unknown Place",
      nameEn: place.nameEn || "",
      address: place.address || "",
      latitude: parseFloat(place.latitude || place.lat) || 0,
      longitude: parseFloat(place.longitude || place.lng) || 0,
      phone: place.phone || "",
      rating: place.rating || "",
      reviews: place.reviews || "",
      openingHours: place.openingHours || "",
      photoUrl: place.photoUrl || ""
    };

    this.routeWaypoints.push(waypoint);
    this.saveRouteWaypoints();
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();
    this.renderPlacesCards();

    // Scroll to new waypoint in right column
    setTimeout(() => {
      this.scrollWaypointCardIntoView(key);
    }, 50);
  },

  removeWaypointFromRoute(indexOrKey) {
    let index = -1;
    if (typeof indexOrKey === "number") {
      index = indexOrKey;
    } else {
      index = this.routeWaypoints.findIndex(w => (w.placeId || w.name) === indexOrKey || w._uid === indexOrKey);
    }

    if (index >= 0 && index < this.routeWaypoints.length) {
      const target = this.routeWaypoints[index];
      if (target && target.lockGroupId) {
        alert(i18n.t("alert_single_locked_delete") || "该站点处于锁定组合中，请先解锁后再删除。");
        return;
      }
      this.routeWaypoints.splice(index, 1);
      const key = target ? (target.placeId || target.name) : null;
      if (key) this.selectedWaypointKeys.delete(key);
      this.saveRouteWaypoints();
      this.renderWaypoints();
      this.updateRoute();
      this.renderMarkers();
      this.renderPlacesCards();
    }
  },

  moveWaypoint(index, delta) {
    if (index < 0 || index >= this.routeWaypoints.length) return;
    const cur = this.routeWaypoints[index];
    if (!cur) return;

    // Case 1: Waypoint belongs to a locked group -> move whole group together as a block
    if (cur.lockGroupId) {
      const grpId = cur.lockGroupId;
      let grpStart = index;
      while (grpStart > 0 && this.routeWaypoints[grpStart - 1].lockGroupId === grpId) {
        grpStart--;
      }
      let grpEnd = index;
      while (grpEnd < this.routeWaypoints.length - 1 && this.routeWaypoints[grpEnd + 1].lockGroupId === grpId) {
        grpEnd++;
      }
      const grpLen = grpEnd - grpStart + 1;

      if (delta < 0) {
        // Move UP
        if (grpStart === 0) return;
        const prevIdx = grpStart - 1;
        const prevItem = this.routeWaypoints[prevIdx];
        let targetInsertIndex = prevIdx;
        if (prevItem.lockGroupId) {
          const prevGrpId = prevItem.lockGroupId;
          while (targetInsertIndex > 0 && this.routeWaypoints[targetInsertIndex - 1].lockGroupId === prevGrpId) {
            targetInsertIndex--;
          }
        }
        const groupItems = this.routeWaypoints.splice(grpStart, grpLen);
        this.routeWaypoints.splice(targetInsertIndex, 0, ...groupItems);
      } else if (delta > 0) {
        // Move DOWN
        if (grpEnd === this.routeWaypoints.length - 1) return;
        const nextIdx = grpEnd + 1;
        const nextItem = this.routeWaypoints[nextIdx];
        let nextBlockEnd = nextIdx;
        if (nextItem.lockGroupId) {
          const nextGrpId = nextItem.lockGroupId;
          while (nextBlockEnd < this.routeWaypoints.length - 1 && this.routeWaypoints[nextBlockEnd + 1].lockGroupId === nextGrpId) {
            nextBlockEnd++;
          }
        }
        const groupItems = this.routeWaypoints.splice(grpStart, grpLen);
        const insertPos = nextBlockEnd - grpLen + 1;
        this.routeWaypoints.splice(insertPos, 0, ...groupItems);
      }
    } else {
      // Case 2: Standalone waypoint -> jump over any adjacent locked group without splitting it
      if (delta < 0) {
        if (index === 0) return;
        const prevItem = this.routeWaypoints[index - 1];
        let targetPos = index - 1;
        if (prevItem.lockGroupId) {
          const prevGrpId = prevItem.lockGroupId;
          while (targetPos > 0 && this.routeWaypoints[targetPos - 1].lockGroupId === prevGrpId) {
            targetPos--;
          }
        }
        const item = this.routeWaypoints.splice(index, 1)[0];
        this.routeWaypoints.splice(targetPos, 0, item);
      } else if (delta > 0) {
        if (index === this.routeWaypoints.length - 1) return;
        const nextItem = this.routeWaypoints[index + 1];
        let targetBlockEnd = index + 1;
        if (nextItem.lockGroupId) {
          const nextGrpId = nextItem.lockGroupId;
          while (targetBlockEnd < this.routeWaypoints.length - 1 && this.routeWaypoints[targetBlockEnd + 1].lockGroupId === nextGrpId) {
            targetBlockEnd++;
          }
        }
        const item = this.routeWaypoints.splice(index, 1)[0];
        this.routeWaypoints.splice(targetBlockEnd, 0, item);
      }
    }

    this.saveRouteWaypoints();
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();
    this.renderPlacesCards();
  },

  lockSelectedWaypoints() {
    const selectedIndices = [];
    this.routeWaypoints.forEach((w, idx) => {
      const key = w.placeId || w.name;
      if (this.selectedWaypointKeys.has(key)) {
        selectedIndices.push(idx);
      }
    });

    if (selectedIndices.length < 2) {
      alert(i18n.t("alert_lock_min_two") || "至少需要选择 2 个站点才能锁定为组合。");
      return;
    }

    const lockGroupId = "lock_" + Date.now();
    const anchorIndex = Math.min(...selectedIndices);
    const selectedItems = [];
    const remainingItems = [];

    this.routeWaypoints.forEach((w, idx) => {
      if (selectedIndices.includes(idx)) {
        w.lockGroupId = lockGroupId;
        selectedItems.push(w);
      } else {
        remainingItems.push(w);
      }
    });

    // Reinsert grouped items contiguously at anchorIndex
    let insertIdx = 0;
    let counted = 0;
    for (let i = 0; i < this.routeWaypoints.length; i++) {
      if (i === anchorIndex) {
        insertIdx = counted;
        break;
      }
      if (!selectedIndices.includes(i)) counted++;
    }
    remainingItems.splice(insertIdx, 0, ...selectedItems);
    this.routeWaypoints = remainingItems;

    this.selectedWaypointKeys.clear();
    this.saveRouteWaypoints();
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();

    const toastMsg = i18n.t("toast_locked_group_success", { count: selectedItems.length }) || `已将 ${selectedItems.length} 个站点锁定为组合`;
    if (window.showToast) window.showToast(toastMsg);
    else alert(toastMsg);
  },

  unlockSelectedWaypoints() {
    const selectedItems = this.routeWaypoints.filter(w => this.selectedWaypointKeys.has(w.placeId || w.name));
    if (selectedItems.length === 0) return;

    let unlockedCount = 0;
    selectedItems.forEach(w => {
      if (w.lockGroupId) {
        w.lockGroupId = null;
        unlockedCount++;
      }
    });

    this.selectedWaypointKeys.clear();
    this.saveRouteWaypoints();
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();

    const toastMsg = i18n.t("toast_unlocked_group_success") || "已解除站点的锁定组合";
    if (window.showToast) window.showToast(toastMsg);
    else alert(toastMsg);
  },

  deleteSelectedWaypoints() {
    if (this.selectedWaypointKeys.size === 0) return;

    const selectedWaypoints = this.routeWaypoints.filter(w => this.selectedWaypointKeys.has(w.placeId || w.name));
    const hasLocked = selectedWaypoints.some(w => !!w.lockGroupId);
    if (hasLocked) {
      alert(i18n.t("alert_locked_delete_forbidden") || "所选站点包含已被锁定的站点，必须先解锁后再删除！");
      return;
    }

    if (!confirm(`确定删除选中的 ${selectedWaypoints.length} 个途经站点？`)) return;

    this.routeWaypoints = this.routeWaypoints.filter(w => !this.selectedWaypointKeys.has(w.placeId || w.name));
    this.selectedWaypointKeys.clear();
    this.saveRouteWaypoints();
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();
    this.renderPlacesCards();
  },

  toggleSelectWaypoint(key, checked) {
    if (checked) {
      this.selectedWaypointKeys.add(key);
    } else {
      this.selectedWaypointKeys.delete(key);
    }
    this.updateBatchBar();
  },

  toggleSelectAllWaypoints(checked) {
    if (checked) {
      this.routeWaypoints.forEach(w => {
        const key = w.placeId || w.name;
        this.selectedWaypointKeys.add(key);
      });
    } else {
      this.selectedWaypointKeys.clear();
    }
    this.renderWaypoints();
  },

  updateBatchBar() {
    const selectAllCb = document.getElementById("mapWaypointsSelectAll");
    const labelEl = document.getElementById("mapWaypointsSelectAllLabel");
    const lockBtn = document.getElementById("mapBtnLockWaypoints");
    const unlockBtn = document.getElementById("mapBtnUnlockWaypoints");
    const deleteBtn = document.getElementById("mapBtnBatchDeleteWaypoints");

    const total = this.routeWaypoints.length;
    const selectedCount = this.selectedWaypointKeys.size;

    if (selectAllCb) {
      selectAllCb.checked = total > 0 && selectedCount === total;
      selectAllCb.indeterminate = selectedCount > 0 && selectedCount < total;
    }
    if (labelEl) {
      labelEl.textContent = selectedCount > 0
        ? (i18n.t("batch_selected_count", { count: selectedCount }) || `已选 ${selectedCount} 项`)
        : (i18n.t("batch_select_all") || "全选");
    }

    const selectedList = this.routeWaypoints.filter(w => this.selectedWaypointKeys.has(w.placeId || w.name));
    const anyLocked = selectedList.some(w => !!w.lockGroupId);

    if (lockBtn) {
      lockBtn.disabled = selectedCount < 2;
      lockBtn.title = i18n.t("tip_lock_stops") || "锁定选中的站点为整体组合（需>=2个）";
    }
    if (unlockBtn) {
      unlockBtn.style.display = anyLocked ? "inline-flex" : "none";
      unlockBtn.title = i18n.t("tip_unlock_stops") || "解除选中站点的锁定";
    }
    if (deleteBtn) {
      deleteBtn.disabled = selectedCount === 0;
      deleteBtn.title = i18n.t("tip_batch_delete") || "批量移除选中的站点";
      deleteBtn.innerHTML = `<span data-i18n="btn_batch_delete">${this.escapeHtml(i18n.t("btn_batch_delete") || "批量删除")}</span>${selectedCount > 0 ? ` (${selectedCount})` : ""}`;
    }
  },

  clearRoute() {
    if (this.routeWaypoints.length === 0) return;
    if (!confirm(i18n.t("confirm_clear_waypoints"))) {
      return;
    }
    this.routeWaypoints = [];
    this.selectedWaypointKeys.clear();
    this.saveRouteWaypoints({ immediate: true });
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();
    this.renderPlacesCards();
  },

  // -------------------------------------------------------------
  // Real-Time Route Drawing & Metrics
  // -------------------------------------------------------------
  updateRouteMetrics(distanceKm, durationMins) {
    const distEl = document.getElementById("mapRouteDistance");
    const timeEl = document.getElementById("mapRouteTime");
    const stopsEl = document.getElementById("mapRouteStopsCount");
    const badgeEl = document.getElementById("mapWaypointsBadge");

    if (distEl) distEl.textContent = distanceKm;
    if (timeEl) timeEl.textContent = durationMins;
    if (stopsEl) stopsEl.textContent = this.routeWaypoints.length;
    if (badgeEl) badgeEl.textContent = `${this.routeWaypoints.length} ${i18n.t("map_waypoints_unit")}`;
  },

  async updateRoute() {
    const stopsCount = this.routeWaypoints.length;
    const stopsEl = document.getElementById("mapRouteStopsCount");
    const badgeEl = document.getElementById("mapWaypointsBadge");
    if (stopsEl) stopsEl.textContent = stopsCount;
    if (badgeEl) badgeEl.textContent = `${stopsCount} ${i18n.t("map_waypoints_unit")}`;

    // Clear previous polyline
    if (this.directionsRenderer) {
      this.directionsRenderer.set("directions", null);
    }
    if (this.routePolyline) {
      if (this.googleMap && this.routePolyline.setMap) this.routePolyline.setMap(null);
      else if (this.fallbackMap && this.fallbackMap.removeLayer) this.fallbackMap.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }

    if (stopsCount === 0) {
      this.updateRouteMetrics("0", "0");
      this.updateOriginMarker();
      return;
    }

    this.updateOriginMarker();
    await this.renderRoadRoute();
  },

  decodePolyline(encoded) {
    if (!encoded) return [];
    if (window.google && window.google.maps && window.google.maps.geometry && window.google.maps.geometry.encoding) {
      try {
        const decoded = google.maps.geometry.encoding.decodePath(encoded);
        return decoded.map(p => ({ lat: p.lat(), lng: p.lng() }));
      } catch (e) {}
    }
    const points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
  },

  async renderRoadRoute() {
    const routeGen = ++this.routeRenderGeneration;
    const origin = this.getEffectiveOrigin();
    const coords = [
      { lat: origin.lat, lng: origin.lng },
      ...this.routeWaypoints.map(w => ({ lat: parseFloat(w.latitude), lng: parseFloat(w.longitude) }))
    ].filter(c => !isNaN(c.lat) && !isNaN(c.lng));

    if (coords.length < 2) {
      if (this.routePolyline) {
        if (this.googleMap && this.routePolyline.setMap) this.routePolyline.setMap(null);
        else if (this.fallbackMap) this.fallbackMap.removeLayer(this.routePolyline);
        this.routePolyline = null;
      }
      this.updateRouteMetrics("0.0", 0);
      return;
    }

    let finalPath = null;
    let totalKm = null;
    let totalMins = null;

    // 1. Attempt modern Google Routes API (v2:computeRoutes) only if explicitly enabled in project
    // (Disabled by default because project 510154627987 does not have routes.googleapis.com activated)
    if (this.routesApiEnabled && !this.routesApiDisabled && window.google && window.google.maps) {
      try {
        const apiKey = this.googleApiKey || await Api.getGoogleMapsApiKey();
        if (apiKey) {
          const originCoord = coords[0];
          const destCoord = coords[coords.length - 1];
          const intermediates = coords.slice(1, -1);

          const resp = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
              "X-Goog-Maps-Solution-ID": "gmp_git_agentskills_v1"
            },
            body: JSON.stringify({
              origin: { location: { latLng: { latitude: originCoord.lat, longitude: originCoord.lng } } },
              destination: { location: { latLng: { latitude: destCoord.lat, longitude: destCoord.lng } } },
              intermediates: intermediates.map(pt => ({
                location: { latLng: { latitude: pt.lat, longitude: pt.lng } }
              })),
              travelMode: "DRIVE",
              routingPreference: "TRAFFIC_UNAWARE"
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            if (data.routes && data.routes[0]) {
              const r = data.routes[0];
              if (r.polyline?.encodedPolyline) {
                finalPath = this.decodePolyline(r.polyline.encodedPolyline);
              }
              if (r.distanceMeters) {
                totalKm = (r.distanceMeters / 1000).toFixed(1);
              }
              if (r.duration) {
                const secs = parseInt(r.duration.replace("s", ""), 10);
                if (!isNaN(secs)) totalMins = Math.max(5, Math.round(secs / 60));
              }
            }
          } else {
            // Suppress repeating failed calls if Routes API is not enabled in Google Cloud Console
            this.routesApiDisabled = true;
          }
        }
      } catch (err) {
        this.routesApiDisabled = true;
      }
    }

    // 2. Open Road Network Routing (OSRM) Turn-by-Turn Road Geometry
    if (!finalPath) {
      try {
        const osrmQuery = coords.map(c => `${c.lng.toFixed(6)},${c.lat.toFixed(6)}`).join(";");
        const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${osrmQuery}?overview=full&geometries=geojson`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.code === "Ok" && data.routes && data.routes[0]) {
            const route = data.routes[0];
            if (route.geometry && Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length > 0) {
              finalPath = route.geometry.coordinates.map(pt => ({ lat: pt[1], lng: pt[0] }));
              totalKm = (route.distance / 1000).toFixed(1);
              totalMins = Math.max(5, Math.round(route.duration / 60));
            }
          }
        }
      } catch (e) {
        console.warn("OSRM road routing fallback failed, using geodesic coordinates:", e);
      }
    }

    // 3. Last-resort fallback: straight-line path
    if (!finalPath) {
      finalPath = coords;
      let straightKm = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        straightKm += this.getHaversineDistance(coords[i].lat, coords[i].lng, coords[i + 1].lat, coords[i + 1].lng);
      }
      totalKm = (straightKm * 1.3).toFixed(1);
      totalMins = Math.max(5, Math.round((straightKm * 1.3 / 35) * 60));
    }

    if (routeGen !== this.routeRenderGeneration) return;

    // Render smooth road polyline on active map
    if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
      if (this.directionsRenderer) {
        this.directionsRenderer.set("directions", null);
      }
      if (this.routePolyline) {
        this.routePolyline.setMap(null);
      }
      this.routePolyline = new google.maps.Polyline({
        path: finalPath,
        geodesic: false,
        strokeColor: "#2563eb",
        strokeOpacity: 0.85,
        strokeWeight: 6,
        map: this.googleMap,
        zIndex: 20
      });
    } else if (this.fallbackMap && window.L) {
      if (this.routePolyline) {
        this.fallbackMap.removeLayer(this.routePolyline);
      }
      const latLngs = finalPath.map(c => [c.lat, c.lng]);
      this.routePolyline = L.polyline(latLngs, {
        color: "#2563eb",
        weight: 6,
        opacity: 0.85
      }).addTo(this.fallbackMap);
    }

    this.updateRouteMetrics(totalKm || "0.0", totalMins || 0);
  },

  updateOriginMarker() {
    const origin = this.getEffectiveOrigin();
    const pos = { lat: origin.lat, lng: origin.lng };
    const hqTitle = i18n.t("map_origin_hq_title") || "Green Oil HQ (Origin)";
    const hqPopup = i18n.t("map_origin_hq_popup") || "Origin: Green Oil HQ";

    if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
      const useAdvanced = !!(window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement);

      if (!this.originMarker) {
        if (useAdvanced) {
          try {
            this.originMarker = new google.maps.marker.AdvancedMarkerElement({
              position: pos,
              map: this.googleMap,
              title: hqTitle,
              content: this.buildOriginElement(),
              zIndex: 1000
            });
          } catch (err) {
            this.originMarker = new google.maps.Marker({
              position: pos,
              map: this.googleMap,
              title: hqTitle,
              icon: this.getOriginIcon(),
              zIndex: 1000
            });
          }
        } else {
          this.originMarker = new google.maps.Marker({
            position: pos,
            map: this.googleMap,
            title: hqTitle,
            icon: this.getOriginIcon(),
            zIndex: 1000
          });
        }

        this.originMarker.addListener("click", () => {
          if (this.infoWindow) {
            this.infoWindow.setContent(`
              <div style="padding: 4px 6px; font-family: -apple-system, sans-serif;">
                <div style="font-weight: 700; color: #dc2626; font-size: 13px;">${this.escapeHtml(hqPopup)}</div>
                <div style="font-size: 11px; color: #475569; margin-top: 4px;">${this.escapeHtml(origin.address)}</div>
              </div>
            `);
            this.infoWindow.open({ map: this.googleMap, anchor: this.originMarker });
          }
        });
      } else {
        if (this.originMarker.position !== undefined) {
          this.originMarker.position = pos;
        } else if (this.originMarker.setPosition) {
          this.originMarker.setPosition(pos);
        }
      }
    } else if (this.fallbackMap && window.L) {
      if (this.originMarker) {
        this.fallbackMap.removeLayer(this.originMarker);
      }
      this.originMarker = L.marker([pos.lat, pos.lng], {
        icon: L.divIcon({
          className: "origin-leaflet-marker",
          html: `<div style="width:28px;height:28px;background:#dc2626;color:#fff;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);">HQ</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(this.fallbackMap);
      this.originMarker.bindPopup(`<b>${this.escapeHtml(hqPopup)}</b><br/><span style="font-size:11px;">${this.escapeHtml(origin.address)}</span>`);
    }
  },

  fitRouteToBounds() {
    const origin = this.getEffectiveOrigin();
    const points = [
      { lat: origin.lat, lng: origin.lng },
      ...this.routeWaypoints.map(w => ({ lat: parseFloat(w.latitude), lng: parseFloat(w.longitude) }))
    ].filter(p => !isNaN(p.lat) && !isNaN(p.lng));

    if (points.length === 0) return;

    if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach(p => bounds.extend(p));
      this.googleMap.fitBounds(bounds, 50);
    } else if (this.fallbackMap && window.L) {
      const latLngs = points.map(p => [p.lat, p.lng]);
      this.fallbackMap.fitBounds(latLngs, { padding: [40, 40] });
    }
  },

  // -------------------------------------------------------------
  // Right Column Waypoints UI & HTML5 Drag-and-Drop
  // -------------------------------------------------------------
  renderWaypoints() {
    this.renderRouteTabs();

    const badgeEl = document.getElementById("mapWaypointsBadge");
    if (badgeEl) badgeEl.textContent = `${this.routeWaypoints.length} ${typeof i18n !== "undefined" && i18n.t ? i18n.t("map_waypoints_unit") : "个"}`;

    const container = document.getElementById("mapWaypointsCardsContainer");
    if (!container) return;

    const list = this.routeWaypoints;
    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="display: flex; justify-content: center; margin-bottom: 0.6rem;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
          <div style="font-weight: 600; font-size: 0.95rem; color: #475569;">${i18n.t("waypoints_empty_title")}</div>
          <div style="font-size: 0.8rem; margin-top: 0.35rem; color: #94a3b8; line-height: 1.5;">
            ${i18n.t("waypoints_empty_desc")}
          </div>
        </div>
      `;
      this.updateBatchBar();
      return;
    }

    const kw = (this.waypointSearchKeyword || "").trim().toLowerCase();
    const groupNumberMap = new Map();
    let nextGroupNum = 1;
    list.forEach(w => {
      if (w.lockGroupId && !groupNumberMap.has(w.lockGroupId)) {
        groupNumberMap.set(w.lockGroupId, nextGroupNum++);
      }
    });

    container.innerHTML = list.map((w, index) => {
      const key = w.placeId || w.name;
      const isSelected = this.selectedWaypointKeys.has(key);
      const isLocked = !!w.lockGroupId;
      const groupNum = isLocked ? groupNumberMap.get(w.lockGroupId) : null;

      const isMatch = !kw || 
        (w.name && w.name.toLowerCase().includes(kw)) || 
        (w.nameEn && w.nameEn.toLowerCase().includes(kw)) || 
        (w.address && w.address.toLowerCase().includes(kw));

      const displayName = this.getRestaurantDisplayName(w);

      let statusObj = w.openingHours ? BusinessHours.getBusinessStatus(w.openingHours) : null;
      if (!statusObj && w.status) {
        const sLower = String(w.status).toLowerCase();
        if (w.status === "营业中" || sLower === "open") {
          statusObj = { cls: "open", label: i18n.t("status_open") || "营业中" };
        } else if (w.status === "已打烊" || sLower === "closed") {
          statusObj = { cls: "closed", label: i18n.t("status_closed") || "已打烊" };
        }
      }
      const hoursBadge = statusObj
        ? `<span class="status-badge ${statusObj.cls}" style="font-size:0.68rem; padding:1px 5px; border-radius:3px;">${statusObj.label}</span>`
        : "";

      const lockBadgeText = (i18n.t("badge_locked_group") || "组{groupNum}").replace("{groupNum}", groupNum);
      const lockBadgeTip = i18n.t("badge_locked_group_tip") || "已锁定为不可分割整体";
      const lockBadgeHtml = isLocked 
        ? `<span class="waypoint-lock-badge" title="${this.escapeHtml(lockBadgeTip)}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:2px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>${this.escapeHtml(lockBadgeText)}</span>` 
        : "";

      return `
        <div class="map-waypoint-card ${isLocked ? 'is-locked' : ''}" 
             draggable="true" 
             data-index="${index}" 
             data-key="${this.escapeHtml(key)}" 
             data-lock-group="${w.lockGroupId || ''}"
             style="${isMatch ? '' : 'display: none;'}"
             onclick="window.mapExplorerWaypointClick('${this.escapeQuotes(key)}', ${index});">
          
          <input type="checkbox" class="waypoint-checkbox" data-key="${this.escapeHtml(key)}" ${isSelected ? "checked" : ""} onclick="event.stopPropagation(); window.mapExplorerToggleSelectWaypoint('${this.escapeQuotes(key)}', this.checked);" />

          <div class="waypoint-drag-handle" title="${this.escapeHtml(i18n.t("waypoints_drag_handle_tip") || "拖拽排序")}">
            <svg width="10" height="14" viewBox="0 0 10 14" fill="#94a3b8"><circle cx="3" cy="2.5" r="1.3"/><circle cx="7" cy="2.5" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="3" cy="11.5" r="1.3"/><circle cx="7" cy="11.5" r="1.3"/></svg>
          </div>
          <div class="waypoint-seq-badge">${index + 1}</div>
          <div class="waypoint-card-body">
            <div class="waypoint-title" title="${this.escapeHtml(displayName)}">
              ${this.escapeHtml(displayName)}
              ${lockBadgeHtml}
            </div>
            ${hoursBadge ? `<div class="waypoint-tag-row">${hoursBadge}</div>` : ""}
            <div class="waypoint-meta">
              <span class="waypoint-rating"><svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="none" style="vertical-align: -1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${w.rating ? parseFloat(w.rating).toFixed(1) : "4.2"}</span>
              <span class="waypoint-address" title="${this.escapeHtml(w.address || '')}">${this.escapeHtml(w.address || "Ontario GTA")}</span>
            </div>
            ${w._estArrivalStr ? `<div class="waypoint-eta">${i18n.t("fs_route_est_arrival")} ${w._estArrivalStr}</div>` : ""}
          </div>
          <div class="waypoint-card-actions">
            <button type="button" class="btn-wp-action" onclick="event.stopPropagation(); window.mapExplorerMoveWaypoint(${index}, -1);" ${index === 0 ? "disabled" : ""} title="${this.escapeHtml(i18n.t("fs_btn_move_up"))}">↑</button>
            <button type="button" class="btn-wp-action" onclick="event.stopPropagation(); window.mapExplorerMoveWaypoint(${index}, 1);" ${index === list.length - 1 ? "disabled" : ""} title="${this.escapeHtml(i18n.t("fs_btn_move_down"))}">↓</button>
            <button type="button" class="btn-wp-action btn-wp-nav" onclick="event.stopPropagation(); window.mapExplorerOpenNav('${this.escapeQuotes(displayName)}', '${this.escapeQuotes(w.address)}');" title="${this.escapeHtml(i18n.t("fs_btn_nav_title"))}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg></button>
            <button type="button" class="btn-wp-action btn-wp-remove ${isLocked ? 'is-locked-action' : ''}" onclick="event.stopPropagation(); window.mapExplorerRemoveWaypoint(${index});" title="${isLocked ? this.escapeHtml(i18n.t("alert_single_locked_delete")) : this.escapeHtml(i18n.t("btn_remove_stop"))}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
          </div>
        </div>
      `;
    }).join("");

    this.updateBatchBar();
    this.setupWaypointsDragAndDrop();
  },

  setupWaypointsDragAndDrop() {
    const container = document.getElementById("mapWaypointsCardsContainer");
    if (!container) return;

    let draggedIndex = null;

    container.querySelectorAll(".map-waypoint-card").forEach(card => {
      card.addEventListener("dragstart", (e) => {
        draggedIndex = parseInt(card.dataset.index, 10);
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(draggedIndex));
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        container.querySelectorAll(".map-waypoint-card").forEach(c => c.classList.remove("drag-over"));
        draggedIndex = null;
      });

      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const targetCard = e.currentTarget;
        if (targetCard && targetCard !== card) {
          targetCard.classList.add("drag-over");
        }
      });

      card.addEventListener("dragleave", (e) => {
        const targetCard = e.currentTarget;
        if (targetCard) {
          targetCard.classList.remove("drag-over");
        }
      });

      card.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetCard = e.currentTarget;
        if (!targetCard) return;
        targetCard.classList.remove("drag-over");
        const toIndex = parseInt(targetCard.dataset.index, 10);
        const fromIndex = draggedIndex !== null ? draggedIndex : parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (isNaN(fromIndex) || isNaN(toIndex) || fromIndex === toIndex) return;

        const fromItem = this.routeWaypoints[fromIndex];
        if (!fromItem) return;

        // If dragging a locked group: move entire locked group as a contiguous block
        if (fromItem.lockGroupId) {
          const grpId = fromItem.lockGroupId;
          const groupItems = this.routeWaypoints.filter(w => w.lockGroupId === grpId);
          const targetItem = this.routeWaypoints[toIndex];
          const targetGrpId = targetItem ? targetItem.lockGroupId : null;

          // Filter out the moving group
          this.routeWaypoints = this.routeWaypoints.filter(w => w.lockGroupId !== grpId);

          // Find where targetItem is in the updated array
          let newTargetPos = this.routeWaypoints.findIndex(w => (w.placeId || w.name) === (targetItem.placeId || targetItem.name));
          if (newTargetPos === -1) newTargetPos = Math.min(toIndex, this.routeWaypoints.length);

          if (targetGrpId && targetGrpId !== grpId) {
            if (fromIndex < toIndex) {
              while (newTargetPos < this.routeWaypoints.length - 1 && this.routeWaypoints[newTargetPos + 1].lockGroupId === targetGrpId) {
                newTargetPos++;
              }
              newTargetPos++;
            } else {
              while (newTargetPos > 0 && this.routeWaypoints[newTargetPos - 1].lockGroupId === targetGrpId) {
                newTargetPos--;
              }
            }
          }

          this.routeWaypoints.splice(newTargetPos, 0, ...groupItems);
        } else {
          // Dragging standalone item: cannot insert into middle of another locked group
          const targetItem = this.routeWaypoints[toIndex];
          const targetGrpId = targetItem ? targetItem.lockGroupId : null;
          let insertPos = toIndex;

          if (targetGrpId) {
            if (fromIndex < toIndex) {
              while (insertPos < this.routeWaypoints.length - 1 && this.routeWaypoints[insertPos + 1].lockGroupId === targetGrpId) {
                insertPos++;
              }
            } else {
              while (insertPos > 0 && this.routeWaypoints[insertPos - 1].lockGroupId === targetGrpId) {
                insertPos--;
              }
            }
          }

          const item = this.routeWaypoints.splice(fromIndex, 1)[0];
          this.routeWaypoints.splice(insertPos, 0, item);
        }

        this.saveRouteWaypoints();
        this.renderWaypoints();
        this.updateRoute();
        this.renderMarkers();
        this.renderPlacesCards();
      });
    });
  },

  scrollWaypointCardIntoView(key) {
    const container = document.getElementById("mapWaypointsCardsContainer");
    if (!container) return;
    const card = container.querySelector(`.map-waypoint-card[data-key="${CSS.escape(key)}"]`);
    if (card) {
      container.querySelectorAll(".map-waypoint-card").forEach(el => el.classList.remove("active-highlight"));
      card.classList.add("active-highlight");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  },

  // -------------------------------------------------------------
  // Schedule Optimization: Corridor Slicing & 2-Opt TSP
  // -------------------------------------------------------------
  optimizeRoute() {
    if (this.routeWaypoints.length < 2) {
      alert(i18n.t("alert_min_2_stops_optimize"));
      return;
    }

    const origin = this.getEffectiveOrigin();
    const originCoords = { lat: origin.lat, lng: origin.lng };
    const optimized = this.sortWaypointsBySchedule(this.routeWaypoints, new Date(), originCoords);
    this.routeWaypoints = optimized;
    this.saveRouteWaypoints();
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();
    this.renderPlacesCards();

    const toastMsg = i18n.t("toast_route_optimized");
    if (window.showToast) window.showToast(toastMsg);
    else alert(toastMsg);
  },

  sortWaypointsBySchedule(waypoints, departureTime = null, originCoords = null) {
    if (!Array.isArray(waypoints) || waypoints.length <= 1) {
      return Array.isArray(waypoints) ? [...waypoints] : [];
    }

    const startCoords = originCoords || this.getEffectiveOrigin();
    const oLat = parseFloat(startCoords.lat) || DEFAULT_ORIGIN_COORDS.lat;
    const oLng = parseFloat(startCoords.lng) || DEFAULT_ORIGIN_COORDS.lng;
    const depDate = departureTime instanceof Date ? new Date(departureTime.getTime()) : new Date();

    const axisInfo = this.calculatePrincipalTravelAxis({ lat: oLat, lng: oLng }, waypoints);
    const SLICE_LENGTH_KM = 2.0;

    const decorated = waypoints.map(w => {
      const rLat = parseFloat(w.latitude);
      const rLng = parseFloat(w.longitude);
      if (isNaN(rLat) || isNaN(rLng) || (rLat === 0 && rLng === 0)) {
        return { ...w, _along_track_km: 0, _cross_track_km: 0, _slice_idx: 0 };
      }
      const { s, w: lateral } = this.projectToCorridor(rLat, rLng, oLat, oLng, axisInfo.uX, axisInfo.uY);
      const sliceIdx = axisInfo.isCorridor ? Math.max(0, Math.floor(Math.max(0, s) / SLICE_LENGTH_KM)) : 0;
      return { ...w, _along_track_km: s, _cross_track_km: lateral, _slice_idx: sliceIdx };
    });

    let curLat = oLat;
    let curLng = oLng;
    let curTime = new Date(depDate.getTime());
    const remaining = [...decorated];
    const initialRoute = [];
    const VISIT_DURATION_MINS = 20;

    let currentSliceIdx = 0;
    if (axisInfo.isCorridor) {
      const sliceIds = Array.from(new Set(remaining.map(r => r._slice_idx))).sort((a, b) => a - b);
      if (sliceIds.length > 0) currentSliceIdx = sliceIds[0];
    }

    while (remaining.length > 0) {
      let bestIdx = 0;
      let minCost = Infinity;

      let candidateIndices = [];
      if (axisInfo.isCorridor) {
        candidateIndices = remaining
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) => item._slice_idx === currentSliceIdx)
          .map(x => x.idx);

        if (candidateIndices.length === 0) {
          const remainingSlices = Array.from(new Set(remaining.map(r => r._slice_idx))).sort((a, b) => a - b);
          if (remainingSlices.length > 0) {
            currentSliceIdx = remainingSlices[0];
            candidateIndices = remaining
              .map((item, idx) => ({ item, idx }))
              .filter(({ item }) => item._slice_idx === currentSliceIdx)
              .map(x => x.idx);
          }
        }
      }

      if (candidateIndices.length === 0) {
        candidateIndices = remaining.map((_, idx) => idx);
      }

      for (const i of candidateIndices) {
        const item = remaining[i];
        const rLat = parseFloat(item.latitude) || curLat;
        const rLng = parseFloat(item.longitude) || curLng;
        const dist = this.getHaversineDistance(curLat, curLng, rLat, rLng);
        const driveMins = Math.max(5, Math.round((dist / 35) * 60));
        const estArrival = new Date(curTime.getTime() + driveMins * 60000);

        let cost = dist;
        if (item.openingHours && typeof item.openingHours === "string" && item.openingHours.trim()) {
          const statusObj = BusinessHours.getBusinessStatus(item.openingHours, estArrival);
          if (statusObj.statusKey === "status_open" || statusObj.status === "营业中") {
            const remMins = statusObj.remainingMinutes;
            if (remMins !== null && remMins < 90) {
              cost = dist - Math.max(0, (90 - remMins) * 0.15);
            }
          } else if (statusObj.statusKey === "status_opening" || statusObj.status === "未开门") {
            cost = dist + 500 + (statusObj.remainingMinutes || 60) * 2;
          } else if (statusObj.statusKey === "status_closed" || statusObj.status === "已打烊") {
            cost = dist + 5000;
          }
        }

        if (axisInfo.isCorridor) {
          const sliceDiff = item._slice_idx - currentSliceIdx;
          if (sliceDiff > 0) cost += sliceDiff * 20;
          else if (sliceDiff < 0) cost += Math.abs(sliceDiff) * 100;
        }

        if (cost < minCost) {
          minCost = cost;
          bestIdx = i;
        }
      }

      const bestItem = remaining.splice(bestIdx, 1)[0];
      currentSliceIdx = bestItem._slice_idx;

      const rLat = parseFloat(bestItem.latitude) || curLat;
      const rLng = parseFloat(bestItem.longitude) || curLng;
      const legDist = this.getHaversineDistance(curLat, curLng, rLat, rLng);
      const legDriveMins = Math.max(5, Math.round((legDist / 35) * 60));
      const arrival = new Date(curTime.getTime() + legDriveMins * 60000);

      initialRoute.push(bestItem);
      curTime = new Date(arrival.getTime() + VISIT_DURATION_MINS * 60000);
      curLat = rLat;
      curLng = rLng;

      // If bestItem belongs to a locked group, immediately pull in all other members of this group in their original relative order!
      if (bestItem.lockGroupId) {
        const grpId = bestItem.lockGroupId;
        for (let ri = 0; ri < remaining.length; ) {
          if (remaining[ri].lockGroupId === grpId) {
            const sibling = remaining.splice(ri, 1)[0];
            const sLat = parseFloat(sibling.latitude) || curLat;
            const sLng = parseFloat(sibling.longitude) || curLng;
            const sDist = this.getHaversineDistance(curLat, curLng, sLat, sLng);
            const sMins = Math.max(3, Math.round((sDist / 35) * 60));
            const sArrival = new Date(curTime.getTime() + sMins * 60000);

            initialRoute.push(sibling);
            curTime = new Date(sArrival.getTime() + VISIT_DURATION_MINS * 60000);
            curLat = sLat;
            curLng = sLng;
          } else {
            ri++;
          }
        }
      }
    }

    const refined = this.twoOptOptimization(initialRoute, { lat: oLat, lng: oLng }, depDate);

    let finalTime = new Date(depDate.getTime());
    let fLat = oLat;
    let fLng = oLng;

    for (const item of refined) {
      const rLat = parseFloat(item.latitude) || fLat;
      const rLng = parseFloat(item.longitude) || fLng;
      const legDist = this.getHaversineDistance(fLat, fLng, rLat, rLng);
      const legDriveMins = Math.max(5, Math.round((legDist / 35) * 60));
      const arrival = new Date(finalTime.getTime() + legDriveMins * 60000);

      const arrHours = String(arrival.getHours()).padStart(2, "0");
      const arrMins = String(arrival.getMinutes()).padStart(2, "0");
      item._estArrivalStr = `${arrHours}:${arrMins}`;

      finalTime = new Date(arrival.getTime() + VISIT_DURATION_MINS * 60000);
      fLat = rLat;
      fLng = rLng;
    }

    return refined;
  },

  projectToCorridor(lat, lon, originLat, originLon, uX, uY) {
    const meanLatRad = (originLat * Math.PI) / 180;
    const dxKm = (lon - originLon) * (Math.PI / 180) * 6371 * Math.cos(meanLatRad);
    const dyKm = (lat - originLat) * (Math.PI / 180) * 6371;
    const s = dxKm * uX + dyKm * uY;
    const w = Math.abs(dxKm * (-uY) + dyKm * uX);
    return { s, w, dxKm, dyKm };
  },

  calculatePrincipalTravelAxis(originCoords, waypoints) {
    const oLat = parseFloat(originCoords.lat) || DEFAULT_ORIGIN_COORDS.lat;
    const oLng = parseFloat(originCoords.lng) || DEFAULT_ORIGIN_COORDS.lng;
    const validPts = (waypoints || []).filter(w => {
      const lat = parseFloat(w.latitude);
      const lng = parseFloat(w.longitude);
      return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
    });

    if (validPts.length === 0) {
      return { uX: 1, uY: 0, isCorridor: false, spanKm: 0 };
    }

    let sumLat = 0, sumLng = 0;
    validPts.forEach(p => {
      sumLat += parseFloat(p.latitude);
      sumLng += parseFloat(p.longitude);
    });
    const centLat = sumLat / validPts.length;
    const centLng = sumLng / validPts.length;

    const meanLatRad = (oLat * Math.PI) / 180;
    const dx = (centLng - oLng) * (Math.PI / 180) * 6371 * Math.cos(meanLatRad);
    const dy = (centLat - oLat) * (Math.PI / 180) * 6371;
    const norm = Math.hypot(dx, dy);

    if (norm < 0.5) {
      return { uX: 1, uY: 0, isCorridor: false, spanKm: norm };
    }

    const uX = dx / norm;
    const uY = dy / norm;

    let minS = Infinity, maxS = -Infinity;
    validPts.forEach(p => {
      const { s } = this.projectToCorridor(parseFloat(p.latitude), parseFloat(p.longitude), oLat, oLng, uX, uY);
      if (s < minS) minS = s;
      if (s > maxS) maxS = s;
    });

    const spanKm = Math.max(0, maxS - minS);
    return { uX, uY, isCorridor: spanKm >= 2.5, spanKm, minS, maxS };
  },

  isTourScheduleFeasible(tour, originCoords, depDate) {
    let curTime = new Date(depDate.getTime());
    let curLat = parseFloat(originCoords.lat) || DEFAULT_ORIGIN_COORDS.lat;
    let curLng = parseFloat(originCoords.lng) || DEFAULT_ORIGIN_COORDS.lng;

    for (const item of tour) {
      const rLat = parseFloat(item.latitude) || curLat;
      const rLng = parseFloat(item.longitude) || curLng;
      const dist = this.getHaversineDistance(curLat, curLng, rLat, rLng);
      const driveMins = Math.max(5, Math.round((dist / 35) * 60));
      const estArrival = new Date(curTime.getTime() + driveMins * 60000);

      if (item.openingHours && typeof item.openingHours === "string" && item.openingHours.trim()) {
        const statusObj = BusinessHours.getBusinessStatus(item.openingHours, estArrival);
        if (statusObj && (statusObj.statusKey === "status_closed" || statusObj.status === "已打烊")) {
          return false;
        }
      }
      curTime = new Date(estArrival.getTime() + 20 * 60000);
      curLat = rLat;
      curLng = rLng;
    }
    return true;
  },

  twoOptOptimization(route, originCoords, depDate) {
    if (!Array.isArray(route) || route.length < 4) return route;

    const oLat = parseFloat(originCoords.lat) || DEFAULT_ORIGIN_COORDS.lat;
    const oLng = parseFloat(originCoords.lng) || DEFAULT_ORIGIN_COORDS.lng;

    const calcTotalDist = tour => {
      let total = 0;
      let curL = oLat, curG = oLng;
      for (const item of tour) {
        const rLat = parseFloat(item.latitude) || curL;
        const rLng = parseFloat(item.longitude) || curG;
        total += this.getHaversineDistance(curL, curG, rLat, rLng);
        curL = rLat;
        curG = rLng;
      }
      return total;
    };

    let bestTour = [...route];
    let bestDist = calcTotalDist(bestTour);
    let improved = true;
    let iterations = 0;
    const MAX_ITERATIONS = 40;

    const isTourGroupIntact = tour => {
      const seenGroups = new Set();
      let currentGrp = null;
      for (const item of tour) {
        if (item.lockGroupId) {
          if (item.lockGroupId !== currentGrp) {
            if (seenGroups.has(item.lockGroupId)) return false;
            seenGroups.add(item.lockGroupId);
            currentGrp = item.lockGroupId;
          }
        } else {
          currentGrp = null;
        }
      }
      return true;
    };

    while (improved && iterations < MAX_ITERATIONS) {
      improved = false;
      iterations++;

      for (let i = 0; i < bestTour.length - 1; i++) {
        for (let k = i + 1; k < bestTour.length; k++) {
          const candidate = [
            ...bestTour.slice(0, i),
            ...bestTour.slice(i, k + 1).reverse(),
            ...bestTour.slice(k + 1)
          ];
          if (!isTourGroupIntact(candidate)) continue;
          const candDist = calcTotalDist(candidate);
          if (candDist < bestDist - 0.005) {
            if (this.isTourScheduleFeasible(candidate, originCoords, depDate)) {
              bestTour = candidate;
              bestDist = candDist;
              improved = true;
              break;
            }
          }
        }
        if (improved) break;
      }
    }

    return bestTour;
  },

  getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const toRad = x => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // English Normalization Helpers for Excel Export (Headers & Content)
  // -------------------------------------------------------------
  toEnglishRestaurantName(name, nameEn) {
    const CJK_ALL_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g;
    if (nameEn && nameEn.trim() && /[a-zA-Z]/.test(nameEn)) {
      const cleaned = nameEn.replace(CJK_ALL_REGEX, " ").replace(/\s+/g, " ").trim();
      if (/[a-zA-Z]/.test(cleaned)) return cleaned;
    }
    if (!name || typeof name !== "string") return "N/A";

    if (/[a-zA-Z]/.test(name)) {
      let en = name;
      en = en.replace(/（/g, " (").replace(/）/g, ") ").replace(/【/g, " [").replace(/】/g, "] ");
      en = en.replace(/([a-zA-Z0-9])\(/g, "$1 (");
      en = en.replace(CJK_ALL_REGEX, " ");
      en = en.replace(/\(\s*\)/g, " ").replace(/\[\s*\]/g, " ");
      en = en.replace(/\s+/g, " ").trim();
      en = en.replace(/^[-–—,;:.\s&]+|[-–—,;:.\s&]+$/g, "");
      if (en && /[a-zA-Z]/.test(en)) {
        return en;
      }
    }
    return name.trim();
  },

  toChineseRestaurantName(name, nameZh, nameEn) {
    const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
    if (nameZh && CJK_REGEX.test(nameZh)) {
      return nameZh.trim();
    }
    if (!name || typeof name !== "string") return nameEn || "未命名餐馆";

    if (CJK_REGEX.test(name)) {
      if (/[a-zA-Z]/.test(name)) {
        let zh = name.replace(/（/g, " (").replace(/）/g, ") ").replace(/【/g, " [").replace(/】/g, "] ");
        zh = zh.replace(/[a-zA-Z][a-zA-Z0-9'’&.\s-]*[a-zA-Z0-9]/g, " ");
        zh = zh.replace(/[a-zA-Z]/g, " ");
        zh = zh.replace(/\(\s*\)/g, " ").replace(/\[\s*\]/g, " ");
        zh = zh.replace(/\s*&\s*/g, " ");
        zh = zh.replace(/\s+/g, " ").trim();
        zh = zh.replace(/^[-–—,;:.\s&]+|[-–—,;:.\s&]+$/g, "");
        zh = zh.replace(/^\s*[\(\[（【]\s*/, "").replace(/\s*[\)\]）】]\s*$/, "").trim();
        if (CJK_REGEX.test(zh)) {
          return zh;
        }
      }
      return name.trim();
    }

    return name.trim();
  },

  getRestaurantDisplayName(restaurant, lang) {
    if (!restaurant) return "";
    const name = typeof restaurant === "string" ? restaurant : (restaurant.name || "");
    const nameEn = typeof restaurant === "object" ? (restaurant.nameEn || "") : "";
    const nameZh = typeof restaurant === "object" ? (restaurant.nameZh || "") : "";

    let currentLang = lang;
    if (!currentLang && typeof i18n !== "undefined" && i18n.currentLang) {
      currentLang = i18n.currentLang;
    }
    const isZh = (currentLang || "zh").toLowerCase().startsWith("zh");

    return isZh ? this.toChineseRestaurantName(name, nameZh, nameEn) : this.toEnglishRestaurantName(name, nameEn);
  },

  toEnglishAddress(raw) {
    if (!raw || /^(?:未提供|无|未知|not provided|unknown|none|null|n\/a)$/i.test(String(raw).trim())) {
      return "N/A";
    }
    let s = String(raw).trim();
    if (!/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\uac00-\ud7af]/.test(s)) {
      return s;
    }

    const termMap = [
      [/(?:邮政编码|郵區編號|邮编|우편번호)[:：]?\s*/g, " "],
      [/(?:单元|室|房)\s*/g, "Unit "],
      [/号|호/g, " #"],
      [/大道/g, " Ave"],
      [/路/g, " Rd"],
      [/街/g, " St"],
      [/巷/g, " Ln"],
      [/广场/g, " Plaza"],
      [/商场/g, " Mall"],
      [/楼|层|층/g, " Fl"]
    ];

    const cityMap = [
      ["加拿大", "Canada"], ["캐나다", "Canada"],
      ["美国", "USA"], ["미국", "USA"],
      ["新西兰", "New Zealand"], ["뉴질랜드", "New Zealand"],
      ["澳大利亚", "Australia"], ["호주", "Australia"],
      ["安大略省", "ON"], ["安大略", "ON"], ["安省", "ON"], ["온타리오주", "ON"], ["온타리오", "ON"],
      ["卑诗省", "BC"], ["卑诗", "BC"], ["BC省", "BC"],
      ["魁北克省", "QC"], ["魁北克", "QC"],
      ["多伦多市中心", "Downtown Toronto"],
      ["多伦多", "Toronto"], ["토론토", "Toronto"],
      ["士嘉堡", "Scarborough"], ["스카버러", "Scarborough"],
      ["万锦市", "Markham"], ["万锦", "Markham"], ["마컴", "Markham"],
      ["列治文山市", "Richmond Hill"], ["列治文山", "Richmond Hill"], ["리치먼드힐", "Richmond Hill"],
      ["北约克", "North York"], ["노스요크", "North York"],
      ["密西沙加", "Mississauga"], ["미시소가", "Mississauga"],
      ["旺市", "Vaughan"], ["본", "Vaughan"],
      ["奥克维尔", "Oakville"], ["오크빌", "Oakville"],
      ["伯灵顿", "Burlington"], ["벌링턴", "Burlington"],
      ["宾顿", "Brampton"], ["布兰普顿", "Brampton"], ["브램턴", "Brampton"],
      ["皮克林", "Pickering"], ["피커링", "Pickering"],
      ["阿贾克斯", "Ajax"], ["아약스", "Ajax"],
      ["惠特比", "Whitby"], ["휘트비", "Whitby"],
      ["奥沙瓦", "Oshawa"], ["오샤와", "Oshawa"],
      ["纽马克特", "Newmarket"], ["新市", "Newmarket"], ["뉴마켓", "Newmarket"],
      ["奥罗拉", "Aurora"], ["极光镇", "Aurora"], ["오로라", "Aurora"],
      ["东贵林", "East Gwillimbury"],
      ["滑铁卢", "Waterloo"], ["워털루", "Waterloo"],
      ["基奇纳", "Kitchener"], ["키치너", "Kitchener"],
      ["贵湖", "Guelph"], ["圭尔夫", "Guelph"], ["궬프", "Guelph"],
      ["哈密尔顿", "Hamilton"], ["汉密尔顿", "Hamilton"], ["해밀턴", "Hamilton"],
      ["市中心", "Downtown"],
      ["约克巷", "York Lane"]
    ];

    for (const [pat, rep] of termMap) {
      s = s.replace(pat, rep);
    }
    for (const [zh, en] of cityMap) {
      s = s.replaceAll(zh, ` ${en} `);
    }

    s = s.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\uac00-\ud7af]/g, " ");
    s = s.replace(/[,，]+/g, ", ");
    s = s.replace(/\s+/g, " ");
    s = s.replace(/,\s*,/g, ", ");
    s = s.replace(/ON Toronto/g, "Toronto, ON").replace(/ON Markham/g, "Markham, ON");
    s = s.replace(/ON Scarborough/g, "Scarborough, ON").replace(/ON North York/g, "North York, ON");
    s = s.replace(/Canada ON/g, "ON, Canada").replace(/USA TN/g, "TN, USA");
    s = s.replace(/^[,\s]+|[,\s]+$/g, "").trim();
    return s || "N/A";
  },

formatOpeningHoursEnglish(rawHours) {
  if (!rawHours) return "N/A";
  let rawStr = typeof rawHours === "string" ? rawHours : (Array.isArray(rawHours) ? rawHours.join("\n") : String(rawHours));
  let cleanStr = rawStr.replace(/[\u202F\u00A0\u2009\u200A\u3000]/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!cleanStr || /^(?:未提供|无|未知|not provided|unknown|none|null|n\/a)$/i.test(cleanStr)) {
    return "N/A";
  }

  // Quick 24-hour check
  if (/^(?:24\s*(?:hours?|小时|小時)?(?:\s*(?:营业|營業))?|open\s*24(?:\s*hours?)?|全天营业|全天營業|24\/7|24시간(?:\s*영업)?)$/i.test(cleanStr)) {
    return "Open 24 hours";
  }

  const DAY_MAP = {
    "monday": "Mon", "mon": "Mon", "星期一": "Mon", "周一": "Mon", "礼拜一": "Mon", "禮拜一": "Mon", "월요일": "Mon", "월": "Mon",
    "tuesday": "Tue", "tue": "Tue", "tues": "Tue", "星期二": "Tue", "周二": "Tue", "礼拜二": "Tue", "禮拜二": "Tue", "화요일": "Tue", "화": "Tue",
    "wednesday": "Wed", "wed": "Wed", "星期三": "Wed", "周三": "Wed", "礼拜三": "Wed", "禮拜三": "Wed", "수요일": "Wed", "수": "Wed",
    "thursday": "Thu", "thu": "Thu", "thur": "Thu", "thurs": "Thu", "星期四": "Thu", "周四": "Thu", "礼拜四": "Thu", "禮拜四": "Thu", "목요일": "Thu", "목": "Thu",
    "friday": "Fri", "fri": "Fri", "星期五": "Fri", "周五": "Fri", "礼拜五": "Fri", "禮拜五": "Fri", "금요일": "Fri", "금": "Fri",
    "saturday": "Sat", "sat": "Sat", "星期六": "Sat", "周六": "Sat", "礼拜六": "Sat", "禮拜六": "Sat", "토요일": "Sat", "토": "Sat",
    "sunday": "Sun", "sun": "Sun", "星期日": "Sun", "星期天": "Sun", "周日": "Sun", "周天": "Sun", "礼拜天": "Sun", "禮拜天": "Sun", "礼拜日": "Sun", "禮拜日": "Sun", "일요일": "Sun", "일": "Sun"
  };

  const DAYS_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAY_INDEX = { "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6 };

  // Parse time token (e.g. "11:00 AM", "11:00am", "下午 9:30", "08:30") to "HH:MM"
  const parseTimeToken = (token) => {
    token = token.trim();
    const m = token.match(/^(?:(上午|下午|早上|晚上|中午)\s*)?(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm|a\.m\.|p\.m\.))?$/i);
    if (!m) return token;

    const zhMod = m[1];
    let h = parseInt(m[2], 10);
    const minute = m[3] ? parseInt(m[3], 10) : 0;
    const enMod = m[4];

    let isPm = false;
    if (enMod && enMod.toLowerCase().startsWith("p")) isPm = true;
    else if (zhMod && (zhMod === "下午" || zhMod === "晚上")) isPm = true;

    if (isPm) {
      if (h < 12) h += 12;
    } else {
      if ((enMod && enMod.toLowerCase().startsWith("a")) || (zhMod && (zhMod === "上午" || zhMod === "早上"))) {
        if (h === 12) h = 0;
      }
    }
    return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  // Normalize hours value (e.g. "08:30–16:00", "休息", "11:00–15:00, 17:00–22:00 營業時間可能不同")
  const normalizeVal = (valRaw) => {
    let v = valRaw
      .replace(/營業時間可能不同|营业时间可能不同|hours?\s+might\s+differ/gi, "")
      .replace(/\(.*?\)|（.*?）/g, "")
      .replace(/ 到 /g, "-")
      .replace(/ to /gi, "-")
      .replace(/ - /g, "-")
      .trim();

    if (/^(?:closed|close|off|day off|休息|打烊|不营业|不營業|未营业|未營業|휴무)$/i.test(v) || /^休息|^打烊|^不营业|^不營業|^closed/i.test(v)) {
      return "Closed";
    }
    if (/24\s*(?:hours|小时|小時)|open\s*24|全天营业|全天營業|24\/7|24시간/i.test(v)) {
      return "Open 24 hours";
    }

    const shifts = v.split(/[,，;；]/).map(s => s.trim()).filter(Boolean);
    const normShifts = [];
    for (const s of shifts) {
      const parts = s.split(/\s*(?:[–—~至到]|-)\s*/);
      if (parts.length === 2) {
        const t1 = parseTimeToken(parts[0]);
        const t2 = parseTimeToken(parts[1]);
        normShifts.push(`${t1}-${t2}`);
      } else {
        normShifts.push(s);
      }
    }
    return normShifts.length > 0 ? normShifts.join(", ") : v;
  };

  // 1. Normalize day delimiters: pipe (|), semicolon (;), middle dot (·), newlines (\n)
  let s = cleanStr
    .replace(/[|\uFF5C;\uFF1B]+/g, "\n")
    .replace(/ · |·/g, "\n")
    .replace(/,\s*(?=(?:星期|周|礼拜|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon\b|Tue\b|Wed\b|Thu\b|Fri\b|Sat\b|Sun\b|월|화|수|목|금|토|일))/gi, "\n");

  const lines = s.split(/[\r\n]+/);
  const parsedDays = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let dayRaw = "";
    let valRaw = "";

    const colonIdx = line.search(/[:：]/);
    if (colonIdx !== -1) {
      dayRaw = line.substring(0, colonIdx).trim();
      valRaw = line.substring(colonIdx + 1).trim();
    } else {
      const matchSpace = line.match(/^([^\d]+)\s+([\d].*)$/);
      if (matchSpace) {
        dayRaw = matchSpace[1].trim();
        valRaw = matchSpace[2].trim();
      } else {
        continue;
      }
    }

    // Strip holiday or extra notes from day name, e.g. "星期三(全國真相與和解日)" -> "星期三"
    const dayClean = dayRaw.replace(/\(.*?\)|（.*?）/g, "").trim().toLowerCase();

    // Check day range (e.g. "Daily", "Mon-Thu", "Fri-Sun", "周一至周五", "Mon-Sun")
    let targetDays = [];
    if (/^(?:daily|everyday|every\s*day|每天|天天|7\s*days)$/i.test(dayClean)) {
      targetDays = [...DAYS_ORDER];
    } else {
      const rangeMatch = dayClean.match(/^([a-z\u4e00-\u9fa5]+)\s*(?:[–—\-~至到]|\bto\b)\s*([a-z\u4e00-\u9fa5]+)$/i);
      if (rangeMatch) {
        let sDay = null;
        let eDay = null;
        for (const [k, v] of Object.entries(DAY_MAP)) {
          if (rangeMatch[1] === k.toLowerCase()) { sDay = v; break; }
        }
        for (const [k, v] of Object.entries(DAY_MAP)) {
          if (rangeMatch[2] === k.toLowerCase()) { eDay = v; break; }
        }
        if (sDay && eDay) {
          const sIdx = DAY_INDEX[sDay];
          const eIdx = DAY_INDEX[eDay];
          let cur = sIdx;
          while (true) {
            targetDays.push(DAYS_ORDER[cur]);
            if (cur === eIdx) break;
            cur = (cur + 1) % 7;
          }
        }
      } else {
        for (const [k, v] of Object.entries(DAY_MAP)) {
          if (dayClean === k.toLowerCase()) {
            targetDays = [v];
            break;
          }
        }
      }
    }

    if (targetDays.length === 0) continue;

    const valNorm = normalizeVal(valRaw);
    for (const d of targetDays) {
      parsedDays[d] = valNorm;
    }
  }

  // Fallback if no structured days were extracted
  if (Object.keys(parsedDays).length === 0) {
    return cleanStr
      .replace(/24小时营业|24小時營業|全天营业|全天營業/g, "Open 24 hours")
      .replace(/休息|打烊|不营业|不營業/g, "Closed")
      .replace(/星期一|周一/g, "Mon")
      .replace(/星期二|周二/g, "Tue")
      .replace(/星期三|周三/g, "Wed")
      .replace(/星期四|周四/g, "Thu")
      .replace(/星期五|周五/g, "Fri")
      .replace(/星期六|周六/g, "Sat")
      .replace(/星期日|周日|星期天/g, "Sun")
      .replace(/[|\uFF5C]/g, ",")
      .replace(/\n+/g, ", ");
  }

  // Group consecutive days that share identical schedules
  const presentDays = DAYS_ORDER.filter(d => d in parsedDays);
  if (presentDays.length === 0) return "N/A";

  const groups = [];
  let curVal = parsedDays[presentDays[0]];
  let curList = [presentDays[0]];

  for (let i = 1; i < presentDays.length; i++) {
    const d = presentDays[i];
    const val = parsedDays[d];
    const prevD = presentDays[i - 1];

    if (DAY_INDEX[d] === DAY_INDEX[prevD] + 1 && val === curVal) {
      curList.push(d);
    } else {
      groups.push({ start: curList[0], end: curList[curList.length - 1], val: curVal });
      curList = [d];
      curVal = val;
    }
  }
  groups.push({ start: curList[0], end: curList[curList.length - 1], val: curVal });

  const resultParts = groups.map(g => {
    let label = "";
    if (g.start === g.end) {
      label = g.start;
    } else if (g.start === "Mon" && g.end === "Sun") {
      label = "Mon-Sun";
    } else {
      label = `${g.start}-${g.end}`;
    }
    return `${label}: ${g.val}`;
  });

  return resultParts.join(", ");
}

  exportWaypoints() {
    const targets = this.routeWaypoints;
    if (targets.length === 0) {
      alert(i18n.t("alert_no_waypoints_export") || "当前路线清单中暂无经停点可导出。");
      return;
    }

    const isZh = (typeof i18n !== "undefined" && i18n.currentLang && i18n.currentLang.startsWith("zh"));

    const exportRows = targets.map((w, idx) => {
      const displayName = this.getRestaurantDisplayName(w, isZh ? "zh" : "en");
      const address = isZh ? (w.address || "N/A") : this.toEnglishAddress(w.address);
      const openHours = this.formatOpeningHoursEnglish(w.openingHours);
      const phone = (w.phone && w.phone !== "无" && w.phone !== "未提供" && w.phone !== "未知") ? w.phone : "N/A";
      const eta = (w._estArrivalStr && w._estArrivalStr !== "-") ? w._estArrivalStr : "N/A";

      if (isZh) {
        return {
          "序号": idx + 1,
          "餐厅名称": displayName,
          "地址": address,
          "电话": phone,
          "营业时间": openHours,
          "预计到达时间 (ETA)": eta
        };
      } else {
        return {
          "Stop #": idx + 1,
          "Restaurant Name": displayName,
          "Address": address,
          "Phone": phone,
          "Opening Hours": openHours,
          "Estimated Arrival (ETA)": eta
        };
      }
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const xlsxLib = typeof window !== "undefined" && window.XLSX ? window.XLSX : null;

    if (xlsxLib) {
      const ws = xlsxLib.utils.json_to_sheet(exportRows);
      ws["!cols"] = [
        { wch: 8 },
        { wch: 32 },
        { wch: 42 },
        { wch: 18 },
        { wch: 30 },
        { wch: 14 }
      ];
      const wb = xlsxLib.utils.book_new();
      xlsxLib.utils.book_append_sheet(wb, ws, "Route Stops");
      xlsxLib.writeFile(wb, `GreenOil_Route_Stops_${dateStr}.xlsx`);
    } else {
      const headers = Object.keys(exportRows[0]);
      const csvLines = [headers.join(",")];
      exportRows.forEach(row => {
        csvLines.push(headers.map(h => `"${(row[h] || "").toString().replace(/"/g, '""')}"`).join(","));
      });
      const csv = csvLines.join("\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `GreenOil_Route_Stops_${dateStr}.csv`;
      link.click();
    }
  },

  // -------------------------------------------------------------
  // Waypoint Import Modal & Parsing Logic
  // -------------------------------------------------------------
  openImportModal() {
    const modal = document.getElementById("mapWaypointImportModalOverlay");
    const input = document.getElementById("mapImportTextInput");
    const fileStatus = document.getElementById("mapImportFileStatus");
    const fileInput = document.getElementById("mapImportFileInput");
    if (!modal) return;
    if (input) input.value = "";
    if (fileStatus) fileStatus.style.display = "none";
    if (fileInput) fileInput.value = "";
    this.switchImportTab("text");
    modal.classList.add("active");
    if (input) setTimeout(() => input.focus(), 50);
  },

  closeImportModal() {
    const modal = document.getElementById("mapWaypointImportModalOverlay");
    if (modal) modal.classList.remove("active");
  },

  switchImportTab(tab) {
    const btnText = document.getElementById("mapImportTabBtnText");
    const btnFile = document.getElementById("mapImportTabBtnFile");
    const modeText = document.getElementById("mapImportModeText");
    const modeFile = document.getElementById("mapImportModeFile");
    if (tab === "text") {
      if (btnText) btnText.className = "btn btn-sm btn-primary";
      if (btnFile) btnFile.className = "btn btn-sm btn-outline";
      if (modeText) modeText.style.display = "block";
      if (modeFile) modeFile.style.display = "none";
    } else {
      if (btnText) btnText.className = "btn btn-sm btn-outline";
      if (btnFile) btnFile.className = "btn btn-sm btn-primary";
      if (modeText) modeText.style.display = "none";
      if (modeFile) modeFile.style.display = "block";
    }
  },

  async handleImportSubmit() {
    const modeText = document.getElementById("mapImportModeText");
    const isTextMode = modeText && modeText.style.display !== "none";

    if (isTextMode) {
      const input = document.getElementById("mapImportTextInput");
      const text = input ? input.value.trim() : "";
      if (!text) {
        alert("请输入至少一行地址或餐馆名称");
        return;
      }
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      await this.importStopsFromLines(lines);
    } else {
      const fileInput = document.getElementById("mapImportFileInput");
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("请选择要导入的 Excel 或 CSV 文件");
        return;
      }
      const file = fileInput.files[0];
      await this.importStopsFromFile(file);
    }
  },

  async importStopsFromLines(lines) {
    if (!lines || lines.length === 0) return;

    let pool = this.googleAreaPlaces || [];
    if (window.Restaurants && Array.isArray(window.Restaurants.fullDataset) && window.Restaurants.fullDataset.length > 0) {
      pool = window.Restaurants.fullDataset;
    }

    let addedCount = 0;
    for (const line of lines) {
      const matched = this.matchAddressToPlace(line, pool);
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
          latitude: DEFAULT_ORIGIN_COORDS.lat + (Math.random() - 0.5) * 0.05,
          longitude: DEFAULT_ORIGIN_COORDS.lng + (Math.random() - 0.5) * 0.05,
          placeId: `addr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          isCustomAddress: true,
          _matched: false,
          _sourceAddress: line
        };
      }

      const exists = this.routeWaypoints.some(w => 
        (stopItem.placeId && !stopItem.isCustomAddress && w.placeId === stopItem.placeId) ||
        (w.name === stopItem.name && w.address === stopItem.address)
      );

      if (!exists) {
        this.routeWaypoints.push(stopItem);
        addedCount++;
      }
    }

    this.closeImportModal();
    this.saveRouteWaypoints();
    this.renderWaypoints();
    this.updateRoute();
    this.renderMarkers();
    this.renderPlacesCards();

    const toastMsg = i18n.t("import_success_toast", { count: addedCount }) || `成功导入 ${addedCount} 个途经站点`;
    if (window.showToast) window.showToast(toastMsg);
    else alert(toastMsg);
  },

  matchAddressToPlace(inputLine, pool) {
    if (!inputLine || !Array.isArray(pool) || pool.length === 0) return null;
    const lower = inputLine.toLowerCase().trim();

    // 1. Direct name match
    const nameMatch = pool.find(p => p.name && (p.name.toLowerCase() === lower || lower.includes(p.name.toLowerCase())));
    if (nameMatch) return nameMatch;

    // 2. Postal code match
    const postalMatch = inputLine.match(/\b([A-Za-z]\d[A-Za-z])[\s-]?(\d[A-Za-z]\d)\b/);
    if (postalMatch) {
      const code = (postalMatch[1] + postalMatch[2]).toUpperCase();
      const pMatch = pool.find(p => {
        if (!p.address) return false;
        const m = p.address.match(/\b([A-Za-z]\d[A-Za-z])[\s-]?(\d[A-Za-z]\d)\b/);
        return m && (m[1] + m[2]).toUpperCase() === code;
      });
      if (pMatch) return pMatch;
    }

    // 3. Street address substring match
    const addrMatch = pool.find(p => p.address && (lower.includes(p.address.toLowerCase()) || p.address.toLowerCase().includes(lower)));
    if (addrMatch) return addrMatch;

    return null;
  },

  async importStopsFromFile(file) {
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const xlsxLib = typeof window !== "undefined" && window.XLSX ? window.XLSX : null;
      if (!xlsxLib) {
        alert("Excel 解析库尚未加载，请稍候重试");
        return;
      }
      const workbook = xlsxLib.read(new Uint8Array(arrayBuffer), { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = xlsxLib.utils.sheet_to_json(worksheet, { defval: "" });

      if (!rows || rows.length === 0) {
        alert("所选文件中未找到有效数据行");
        return;
      }

      const lines = [];
      rows.forEach(row => {
        const addr = row["Address"] || row["address"] || row["地址"] || row["详细地址"] || "";
        const name = row["Restaurant Name"] || row["Name"] || row["name"] || row["餐厅名称"] || row["店名"] || row["餐馆名称"] || "";
        const line = addr ? (name ? `${name}, ${addr}` : addr) : name;
        if (line && line.trim()) lines.push(line.trim());
      });

      if (lines.length === 0) {
        alert("未能从表格中提取出有效地址或餐馆名称");
        return;
      }

      await this.importStopsFromLines(lines);
    } catch (e) {
      console.error("Failed to parse file:", e);
      alert("文件解析失败: " + e.message);
    }
  },

  formatWeekdayOpeningHours(rawHours) {
    if (!rawHours) return "未提供";
    let rawStr = typeof rawHours === "string" ? rawHours : (Array.isArray(rawHours) ? rawHours.join("\n") : String(rawHours));
    let cleanStr = rawStr.replace(/[\u202F\u00A0\u2009\u200A\u3000]/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    if (!cleanStr || cleanStr === "未提供" || cleanStr === "无") return "未提供";
    return cleanStr.replace(/\n+/g, " · ");
  },

  // -------------------------------------------------------------
  // External Google Maps Navigation
  // -------------------------------------------------------------
  openGoogleMapsNavigation() {
    if (this.routeWaypoints.length === 0) {
      alert(i18n.t("alert_add_waypoints_first"));
      return;
    }

    const origin = this.getEffectiveOrigin();
    const originAddress = origin.address || DEFAULT_ORIGIN_ADDRESS;
    const fullSlashUrl = this.buildGoogleMapsSlashUrl(originAddress, this.routeWaypoints);

    if (this.routeWaypoints.length <= 9) {
      window.open(fullSlashUrl, "_blank");
      return;
    }

    this.openRouteNavModal(originAddress, this.routeWaypoints, fullSlashUrl);
  },

  buildGoogleMapsSlashUrl(originAddress, stops) {
    const originStr = encodeURIComponent(originAddress);
    const stopStrs = stops.map(s => {
      const target = (s.name ? s.name + ", " : "") + (s.address || "");
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

      const fromLabel = i === 0 ? "Green Oil HQ" : (stops[startIdx - 1].name || i18n.t("map_card_stop_num", { n: startIdx }));
      const toLabel = legStops[legStops.length - 1].name || i18n.t("map_card_stop_num", { n: endIdx });

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
    const modalOverlay = document.getElementById("fsRouteNavModalOverlay");
    const tipEl = document.getElementById("fsRouteNavModalTip");
    const btnFull = document.getElementById("fsRouteNavBtnFull");
    const btnOpenAll = document.getElementById("fsRouteNavBtnOpenAll");
    const legsListEl = document.getElementById("fsRouteNavLegsList");

    if (!modalOverlay) return;

    if (tipEl) {
      tipEl.textContent = i18n.t("fs_route_nav_modal_tip", { count: targetWaypoints.length });
    }

    const legs = this.buildRouteLegs(originAddress, targetWaypoints);

    if (btnFull) {
      btnFull.onclick = () => window.open(fullSlashUrl, "_blank");
    }

    if (btnOpenAll) {
      btnOpenAll.onclick = () => {
        legs.forEach(leg => window.open(leg.url, "_blank"));
      };
    }

    if (legsListEl) {
      legsListEl.innerHTML = legs.map(leg => `
        <div class="fs-route-nav-leg-card">
          <div class="fs-route-nav-leg-info">
            <div class="fs-route-nav-leg-title">
              ${i18n.t("fs_route_nav_leg_title", { leg: leg.legIndex, from: leg.from, to: leg.to, count: leg.stopsCount })}
            </div>
            <div class="fs-route-nav-leg-stops" title="${this.escapeHtml(leg.stopNames)}">
              ${this.escapeHtml(leg.stopNames)}
            </div>
          </div>
          <button class="btn btn-sm btn-primary fs-btn-leg-nav" data-url="${encodeURI(leg.url)}" style="white-space: nowrap; font-size: 0.8rem; padding: 0.4rem 0.75rem; background: #2563eb; border-color: #2563eb; color: white;">
            ${i18n.t("fs_route_nav_btn_leg")}
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
    const modalOverlay = document.getElementById("fsRouteNavModalOverlay");
    if (modalOverlay) modalOverlay.classList.remove("active");
  },

  // -------------------------------------------------------------
  // Left Column Restaurant Cards & Google Discovery
  // -------------------------------------------------------------
  async loadPlacesForCurrentArea(searchGoogle = true, autoExpand = true) {
    const requestId = ++this.areaLoadId;
    this.areaAbort?.abort();
    this.areaAbort = new AbortController();
    this.currentPage = 1;
    const searchId = searchGoogle ? ++this.googleSearchId : this.googleSearchId;
    if (searchGoogle) this.googleAreaPlaces = [];
    this.cancelMarkerBatches();
    this.filteredPlaces = this.filteredPlaces || [];
    const container = document.getElementById("mapPlacesCardsContainer");
    const loadingMsg = i18n.t("map_loading_places");

    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div class="loading-spinner" style="width: 24px; height: 24px; border: 2px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem auto;"></div>
          <div style="font-weight: 500; font-size: 0.9rem; color: #64748b;">${loadingMsg}</div>
        </div>
      `;
    }

    if (searchGoogle && !this.isViewportSearchMode) {
      this.drawSelectedBoundaries();
    } else if (this.isViewportSearchMode) {
      this.clearBoundaries();
    }

    const isAll = this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0;
    const selectedCities = GTA_COMMUNITIES.filter(c => c.id !== "all" && this.activeCityIds.has(c.id));
    const allNbs = this.getAllNeighborhoods();
    const selectedNbs = allNbs.filter(nb => this.activeNeighborhoodIds.has(nb.id));

    let areaQuery = "";
    let bounds = null;

    if (this.isViewportSearchMode) {
      if (this.googleMap && this.googleMap.getBounds()) {
        const b = this.googleMap.getBounds();
        bounds = {
          sw: { lat: b.getSouthWest().lat(), lng: b.getSouthWest().lng() },
          ne: { lat: b.getNorthEast().lat(), lng: b.getNorthEast().lng() }
        };
      } else if (this.fallbackMap && typeof this.fallbackMap.getBounds === "function") {
        const b = this.fallbackMap.getBounds();
        bounds = {
          sw: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng },
          ne: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng }
        };
      }
      areaQuery = this.searchKeyword ? this.searchKeyword : "restaurants";
    } else if (this.searchKeyword) {
      areaQuery = this.searchKeyword;
    } else if (selectedNbs.length > 0) {
      const nbNames = selectedNbs.map(nb => nb.nameEn || nb.name.split(" (")[0]).join(" ");
      const cityName = selectedNbs[0].cityName || "Toronto";
      areaQuery = `restaurants in ${nbNames} ${cityName} Ontario`;
    } else if (!isAll && selectedCities.length > 0) {
      const cityNames = selectedCities.map(c => c.nameEn || c.name.split(" (")[0]).join(" ");
      areaQuery = `restaurants in ${cityNames} Ontario`;
    } else {
      areaQuery = "restaurants in Scarborough Toronto Ontario";
    }

    if (searchGoogle) {
      try {
        this.lastSearchQuery = areaQuery;
        this.lastSearchBounds = bounds;
        const result = await Api.searchGooglePlaces(areaQuery, { bounds });
        if (requestId !== this.areaLoadId) return;
        if (searchId === this.googleSearchId) {
          this.googleAreaPlaces = result?.success ? (result.places || []) : [];
          this.googleNextPageToken = result?.nextPageToken || null;
          this.displayedPlaces = this.googleAreaPlaces;
          this.filterAndRenderPlaces();

          if (this.isViewportSearchMode && window.showToast) {
            window.showToast(i18n.t("map_viewport_toast", { count: this.displayedPlaces.length }) || `已刷新当前视野商户：共 ${this.displayedPlaces.length} 家`);
          }

          // Auto-expand results up to 60 (Google max for single query)
          if (autoExpand && this.googleNextPageToken) {
            this.autoExpandResults(requestId, searchId, 60);
          }
        }
      } catch (error) {
        if (requestId !== this.areaLoadId) return;
        console.warn("Google discovery failed:", error);
        this.displayedPlaces = [];
        this.googleNextPageToken = null;
        this.filterAndRenderPlaces();
      }
    } else {
      this.displayedPlaces = this.googleAreaPlaces;
      this.filterAndRenderPlaces();
    }
  },

  async autoExpandResults(requestId, searchId, maxTarget = 60) {
    if (!this.googleNextPageToken || this.isLoadingMore) return;
    this.isLoadingMore = true;

    try {
      while (this.googleNextPageToken && this.googleAreaPlaces.length < maxTarget) {
        if (requestId !== this.areaLoadId || searchId !== this.googleSearchId) break;

        await new Promise(r => setTimeout(r, 600));
        if (requestId !== this.areaLoadId || searchId !== this.googleSearchId) break;

        const bounds = this.lastSearchBounds || null;
        const query = this.lastSearchQuery || this.searchKeyword || "restaurants";
        const result = await Api.searchGooglePlaces(query, {
          bounds,
          pageToken: this.googleNextPageToken
        });

        if (requestId !== this.areaLoadId || searchId !== this.googleSearchId) break;

        if (result && result.success && Array.isArray(result.places) && result.places.length > 0) {
          this.googleNextPageToken = result.nextPageToken || null;
          const existingKeys = new Set(this.googleAreaPlaces.map(p => p.placeId || p.name));
          const newPlaces = result.places.filter(p => !existingKeys.has(p.placeId || p.name));
          if (newPlaces.length === 0) {
            this.googleNextPageToken = null;
            break;
          }
          this.googleAreaPlaces = [...this.googleAreaPlaces, ...newPlaces];
          this.displayedPlaces = this.googleAreaPlaces;
          this.filterAndRenderPlaces(true);
        } else {
          this.googleNextPageToken = null;
          break;
        }
      }
    } catch (e) {
      console.warn("autoExpandResults error:", e);
    } finally {
      this.isLoadingMore = false;
      this.renderPlacesCards();
    }
  },

  async searchPlacesInCurrentBounds() {
    let hasMap = false;
    if (this.googleMap && this.googleMap.getBounds()) {
      hasMap = true;
      const center = this.googleMap.getCenter();
      if (center) {
        this.lastSearchedCenter = { lat: center.lat(), lng: center.lng() };
        this.lastSearchedZoom = this.googleMap.getZoom();
      }
    } else if (this.fallbackMap && typeof this.fallbackMap.getBounds === "function") {
      hasMap = true;
      const center = this.fallbackMap.getCenter();
      if (center) {
        this.lastSearchedCenter = { lat: center.lat, lng: center.lng };
        this.lastSearchedZoom = this.fallbackMap.getZoom();
      }
    }

    if (!hasMap) return;

    this.isViewportSearchMode = true;
    this.clearBoundaries();

    const btn = document.getElementById("mapSearchThisAreaBtn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="loading-spinner" style="width:12px;height:12px;border:2px solid #94a3b8;border-top-color:#2563eb;border-radius:50%;display:inline-block;animation:spin 0.8s linear infinite;"></span> <span>${i18n.t("btn_search_this_area_loading") || "正在搜索当前视野..."}</span>`;
    }

    try {
      await this.loadPlacesForCurrentArea(true, true);
    } finally {
      if (btn) {
        btn.style.display = "none";
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span data-i18n="btn_search_this_area">${i18n.t("btn_search_this_area") || "在当前地图视野内找店"}</span>
        `;
      }
    }
  },

  async deepSearchGooglePlaces() {
    if (this.isLoadingMore) return;
    this.isLoadingMore = true;
    this.renderPlacesCards();
    if (window.showToast) {
      window.showToast(i18n.t("deep_searching") || "正在深度探测周边商家...");
    }

    const bounds = this.lastSearchBounds || null;
    const additionalQueries = [
      "chinese restaurant",
      "asian restaurant",
      "fast food",
      "bakery cafe"
    ];

    try {
      for (const subQuery of additionalQueries) {
        let q = subQuery;
        if (!bounds && !q.includes("Ontario")) q = `${q} Ontario Canada`;
        const res = await Api.searchGooglePlaces(q, { bounds });
        if (res && res.success && Array.isArray(res.places)) {
          const existingKeys = new Set(this.googleAreaPlaces.map(p => p.placeId || p.name));
          const newPlaces = res.places.filter(p => !existingKeys.has(p.placeId || p.name));
          if (newPlaces.length > 0) {
            this.googleAreaPlaces = [...this.googleAreaPlaces, ...newPlaces];
            this.displayedPlaces = this.googleAreaPlaces;
            this.filterAndRenderPlaces(true);
          }
        }
        await new Promise(r => setTimeout(r, 400));
      }
      if (window.showToast) {
        window.showToast(i18n.t("deep_search_toast", { count: this.displayedPlaces.length }) || `深度探测完成：共聚合 ${this.displayedPlaces.length} 家商户`);
      }
    } catch (err) {
      console.warn("deepSearchGooglePlaces error:", err);
    } finally {
      this.isLoadingMore = false;
      this.renderPlacesCards();
    }
  },

  async loadMoreGooglePlaces() {
    if (!this.googleNextPageToken || this.isLoadingMore) return;
    this.isLoadingMore = true;
    this.renderPlacesCards();

    const bounds = this.lastSearchBounds || null;
    const query = this.lastSearchQuery || this.searchKeyword || "restaurants";
    try {
      const result = await Api.searchGooglePlaces(query, {
        bounds,
        pageToken: this.googleNextPageToken
      });

      this.isLoadingMore = false;
      if (result && result.success && Array.isArray(result.places) && result.places.length > 0) {
        this.googleNextPageToken = result.nextPageToken || null;
        const existingKeys = new Set(this.googleAreaPlaces.map(p => p.placeId || p.name));
        const newPlaces = result.places.filter(p => !existingKeys.has(p.placeId || p.name));
        this.googleAreaPlaces = [...this.googleAreaPlaces, ...newPlaces];
        this.displayedPlaces = this.googleAreaPlaces;
        this.filterAndRenderPlaces(true);
      } else {
        this.googleNextPageToken = null;
        this.renderPlacesCards();
      }
    } catch (e) {
      this.isLoadingMore = false;
      this.googleNextPageToken = null;
      this.renderPlacesCards();
    }
  },

  mergeAreaPlaces() {
    const rawPlaces = this.googleAreaPlaces || [];
    const localMatches = this.allRestaurants || [];

    const combinedMap = new Map();
    rawPlaces.forEach(p => {
      const key = p.placeId || p.name;
      combinedMap.set(key, p);
    });

    localMatches.forEach(r => {
      const key = r.placeId || r.name;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, r);
      }
    });

    const kvByPlaceId = new Map();
    const kvByName = new Map();
    (this.allRestaurants || []).forEach(r => {
      if (r.placeId) kvByPlaceId.set(r.placeId, r);
      if (r.name) kvByName.set(r.name.trim().toLowerCase(), r);
    });

    this.displayedPlaces = Array.from(combinedMap.values()).map(place => {
      const inKV = this.checkIsInKv ? this.checkIsInKv(place) : (place.inKV || false);
      place.inKV = inKV;

      const normName = (place.name || "").trim().toLowerCase();
      const matchedKv = (place.placeId && kvByPlaceId.get(place.placeId)) || 
                        (normName && kvByName.get(normName));

      if (matchedKv) {
        if (matchedKv.name && matchedKv.name !== place.name) {
          if (!place.nameEn) place.nameEn = place.name;
          place.name = matchedKv.name;
          if (place._raw) place._raw["餐馆名称 (Name)"] = matchedKv.name;
        }
        place.isVisited = matchedKv.isVisited || false;
        place.lastOutcome = matchedKv.lastOutcome || "";
        place.lastVisitTime = matchedKv.lastVisitTime || "";
      } else {
        place.isVisited = place.isVisited || false;
        place.lastOutcome = place.lastOutcome || "";
        place.lastVisitTime = place.lastVisitTime || "";
      }

      return place;
    });

    this.filterAndRenderPlaces(true);
  },

  filterAndRenderPlaces(preservePage = false) {
    const selectedSubareas = this.getAllNeighborhoods().filter(area => this.activeNeighborhoodIds.has(area.id));
    const selectedAreas = selectedSubareas.length > 0 ? selectedSubareas :
      this.activeCityIds.has("all") ? [] : GTA_COMMUNITIES.filter(city => this.activeCityIds.has(city.id));

    let result = (this.displayedPlaces || []).filter(place => {
      if (this.isViewportSearchMode) return true;
      return selectedAreas.length === 0 || selectedAreas.some(area => this.isPlaceInGeometry(place, area.geometry));
    });

    // Category filter
    if (this.activeCategory !== "全部") {
      result = result.filter(r => {
        const catText = [r.categoriesRaw, r.categories ? r.categories.join(" ") : ""].join(" ");
        return catText.includes(this.activeCategory);
      });
    }

    // Keyword search
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      result = result.filter(r => {
        const str = [r.name, r.address, r.phone, r.categoriesRaw].join(" ").toLowerCase();
        return str.includes(kw);
      });
    }

    this.filteredPlaces = result;
    this.currentPage = preservePage ? Math.min(this.currentPage, Math.ceil(result.length / this.pageSize) || 1) : 1;

    // Prune selections that no longer match current filtered results
    if (this.selectedMap && typeof this.selectedMap.keys === "function") {
      const validKeys = new Set(result.map(r => r.placeId || r.name));
      for (const key of this.selectedMap.keys()) {
        if (!validKeys.has(key)) {
          this.selectedMap.delete(key);
        }
      }
    }

    this.updateResultsSummary();
    this.renderMarkers();
    this.renderPlacesCards();
  },

  updateResultsSummary() {
    const regionTitleEl = document.getElementById("mapResultsRegionTitle");
    const summaryEl = document.getElementById("mapResultsSummary");
    const countEl = document.getElementById("mapResultsCount");

    const list = Array.isArray(this.filteredPlaces) ? this.filteredPlaces : [];
    const total = list.length;
    const lang = this.getCurrentLanguage();
    const sep = lang === "zh" ? "、" : ", ";

    let titleText = "";
    if (this.isViewportSearchMode) {
      titleText = i18n.t("map_viewport_title") || "当前地图视野";
    } else {
      const isAll = this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0;
      const selectedCities = GTA_COMMUNITIES.filter(c => c.id !== "all" && this.activeCityIds.has(c.id));
      const allNbs = this.getAllNeighborhoods();
      const selectedNbs = allNbs.filter(nb => this.activeNeighborhoodIds.has(nb.id));

      titleText = this.getLocalizedAllGta();
      if (selectedNbs.length > 0) {
        if (selectedNbs.length === 1) {
          titleText = this.getLocalizedName(selectedNbs[0]);
        } else if (selectedNbs.length === 2) {
          titleText = `${this.getLocalizedName(selectedNbs[0])}${sep}${this.getLocalizedName(selectedNbs[1])}`;
        } else {
          titleText = `${this.getLocalizedName(selectedNbs[0])}${sep}${this.getLocalizedName(selectedNbs[1])} (+${selectedNbs.length - 2})`;
        }
      } else if (!isAll && selectedCities.length > 0) {
        if (selectedCities.length === 1) {
          titleText = this.getLocalizedName(selectedCities[0]);
        } else if (selectedCities.length === 2) {
          titleText = `${this.getLocalizedName(selectedCities[0])}${sep}${this.getLocalizedName(selectedCities[1])}`;
        } else {
          titleText = `${this.getLocalizedName(selectedCities[0])}${sep}${this.getLocalizedName(selectedCities[1])} (+${selectedCities.length - 2})`;
        }
      }
    }

    if (regionTitleEl) {
      regionTitleEl.textContent = `${titleText} (${total})`;
    }

    if (summaryEl) {
      if (this.isViewportSearchMode) {
        summaryEl.innerHTML = i18n.t("map_viewport_summary", { count: `<span style="font-weight:700; color:#2563eb;">${total}</span>` }) || `当前地图视野内共检索到 <span style="font-weight:700; color:#2563eb;">${total}</span> 家商家`;
      } else {
        summaryEl.innerHTML = i18n.t("map_results_found", { count: `<span style="font-weight:700; color:#2563eb;">${total}</span>` });
      }
    } else if (countEl) {
      countEl.textContent = total;
    }
  },

  renderPlacesCards() {
    const container = document.getElementById("mapPlacesCardsContainer");
    if (!container) return;
    const list = Array.isArray(this.filteredPlaces) ? this.filteredPlaces : [];

    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-weight: 600; font-size: 0.95rem;">${i18n.t("map_empty_title")}</div>
          <div style="font-size: 0.8rem; margin-top: 0.35rem;">${i18n.t("map_empty_desc")}</div>
        </div>
      `;
      this.renderPagination(0);
      return;
    }

    const total = list.length;
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = list.slice(startIdx, startIdx + this.pageSize);

    let cardsHtml = pageItems.map(r => {
      const key = r.placeId || r.name;
      const displayName = this.getRestaurantDisplayName(r);
      const photoInfo = this.getRestaurantPhoto(r);
      const inRouteIdx = this.routeWaypoints.findIndex(w => (w.placeId && w.placeId === r.placeId) || ((w.name || "").trim().toLowerCase() === (r.name || "").trim().toLowerCase()));
      const isInRoute = inRouteIdx !== -1;

      let statusObj = r.openingHours ? BusinessHours.getBusinessStatus(r.openingHours) : null;
      if (!statusObj && r.status) {
        const sLower = String(r.status).toLowerCase();
        if (r.status === "营业中" || sLower === "open") {
          statusObj = { cls: "open", label: i18n.t("status_open") || "营业中" };
        } else if (r.status === "已打烊" || sLower === "closed") {
          statusObj = { cls: "closed", label: i18n.t("status_closed") || "已打烊" };
        }
      }
      const hoursBadge = statusObj
        ? `<span class="status-badge ${statusObj.cls}" style="font-size:0.7rem; padding:2px 6px; border-radius:4px; line-height:1.2;">${statusObj.label}</span>`
        : "";

      const ratingStr = `<svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="none" style="vertical-align: -1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${r.rating ? parseFloat(r.rating).toFixed(1) : "4.2"}`;
      const reviewsStr = r.reviews ? `(${r.reviews})` : "(15+)";
      const rawCategory = r.categoriesRaw || (r.categories ? r.categories.slice(0, 2).join(" · ") : (i18n.t("cat_food") || "Food & Dining"));
      const categoryStr = this.formatCategory(rawCategory);

      const routeBtn = !isInRoute ? `
        <button class="btn btn-primary btn-sm btn-card-add-route" onclick="event.stopPropagation(); window.mapExplorerAddSingleToRoute('${this.escapeQuotes(key)}');" style="background:#2563eb; border-color:#2563eb; font-size:0.75rem; padding:0.25rem 0.55rem; font-weight:600;" title="${this.escapeHtml(i18n.t('map_card_add_stop'))}">
          <span>${this.escapeHtml(i18n.t('map_card_add_stop'))}</span>
        </button>
      ` : `
        <button class="btn btn-secondary btn-sm btn-card-in-route" onclick="event.stopPropagation(); window.mapExplorerRemoveSingleFromRoute('${this.escapeQuotes(key)}');" style="background:#eff6ff; color:#2563eb; border-color:#bfdbfe; font-size:0.75rem; padding:0.25rem 0.55rem; font-weight:600;" title="${this.escapeHtml(i18n.t('btn_remove_stop'))}">
          <span>${this.escapeHtml(i18n.t('map_card_stop_num', { n: inRouteIdx + 1 }))}</span>
        </button>
      `;

      return `
        <div tabindex="-1" class="map-place-card ${isInRoute ? 'in-route' : ''}" data-key="${this.escapeHtml(key)}" onmouseenter="window.mapExplorerHighlight('${this.escapeQuotes(key)}', true);" onmouseleave="window.mapExplorerHighlight('${this.escapeQuotes(key)}', false);" onclick="window.mapExplorerCardClick('${this.escapeQuotes(key)}');">
          <div class="card-thumb" style="${photoInfo.url ? '' : 'display:none'}">
            <img ${photoInfo.url ? `src="${this.escapeHtml(photoInfo.url)}"` : ''} alt="${this.escapeHtml(displayName)}" loading="lazy" class="card-img" onload="this.parentElement.style.display=''" onerror="this.parentElement.style.display='none'" />
          </div>
          <div class="card-main">
            <div class="card-title-row" style="display: flex; align-items: center; gap: 0.5rem;">
              <h4 class="card-title" title="${this.escapeHtml(displayName)}" style="flex: 1; margin: 0;">${this.escapeHtml(displayName)}</h4>
              <span style="font-size: 0.78rem; font-weight: 700; color: #475569; flex-shrink: 0;">${this.escapeHtml(this.formatPrice(r.price || "$$"))}</span>
            </div>

            <div class="card-meta-row">
              <span class="card-rating">${ratingStr}</span>
              <span>${reviewsStr}</span>
              <span>·</span>
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.escapeHtml(categoryStr)}</span>
            </div>

            <div class="card-badges-row">
              ${hoursBadge}
            </div>

            <div class="card-address" title="${this.escapeHtml(r.address || '')}">
              ${this.escapeHtml(r.address || "Ontario, GTA")}
            </div>

            <div class="card-actions-row">
              ${routeBtn}
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.mapExplorerOpenNav('${this.escapeQuotes(displayName)}', '${this.escapeQuotes(r.address)}');" style="font-size:0.75rem; padding:0.25rem 0.45rem;" title="Google Maps 导航">
                ${this.escapeHtml(i18n.t("map_card_nav"))}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (this.googleNextPageToken) {
      cardsHtml += `
        <div style="padding: 0.75rem 0.25rem 0.5rem; text-align: center;">
          <button type="button" class="btn btn-outline btn-sm w-100" id="btnLoadMorePlaces" onclick="window.mapExplorerLoadMore();" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;font-weight:600;font-size:0.82rem;border-color:#cbd5e1;color:#1e293b;background:#ffffff;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.05);cursor:pointer;">
            ${this.isLoadingMore
              ? `<span class="loading-spinner" style="width:12px;height:12px;border:2px solid #94a3b8;border-top-color:#2563eb;border-radius:50%;display:inline-block;animation:spin 0.8s linear infinite;"></span> ${i18n.t('map_loading_more') || '正在加载更多...'}`
              : `${i18n.t('map_load_more_batch') || '加载更多商家 (+20)'} · 已有 ${this.displayedPlaces.length} 家`}
          </button>
        </div>
      `;
    } else if (this.displayedPlaces.length >= 20) {
      cardsHtml += `
        <div style="padding: 0.75rem 0.25rem 0.5rem; text-align: center; border-top: 1px dashed #e2e8f0; margin-top: 0.5rem;">
          <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 0.4rem;">
            ${i18n.t('map_all_loaded', { count: this.displayedPlaces.length }) || `已加载全部 ${this.displayedPlaces.length} 家商户`}
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btnDeepSearchPlaces" onclick="window.mapExplorerDeepSearch();" style="font-size: 0.78rem; padding: 5px 12px; border-radius: 6px; font-weight: 600; background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
            ${this.isLoadingMore
              ? `<span class="loading-spinner" style="width:11px;height:11px;border:2px solid #94a3b8;border-top-color:#2563eb;border-radius:50%;display:inline-block;animation:spin 0.8s linear infinite;"></span> 探测中...`
              : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> ${i18n.t('btn_deep_search') || '深度探测 (100+)'}`}
          </button>
        </div>
      `;
    }

    container.innerHTML = cardsHtml;

    this.renderPagination(total);
  },

  renderPagination(total) {
    if (total === undefined || total === null) {
      total = Array.isArray(this.filteredPlaces) ? this.filteredPlaces.length : 0;
    }
    const infoEl = document.getElementById("mapPaginationInfo");
    const controlsEl = document.getElementById("mapPaginationControls");
    if (!infoEl || !controlsEl) return;

    if (total === 0) {
      infoEl.textContent = i18n.t("pagination_showing_empty");
      controlsEl.innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(total / this.pageSize) || 1;
    const startIdx = (this.currentPage - 1) * this.pageSize + 1;
    const endIdx = Math.min(this.currentPage * this.pageSize, total);

    infoEl.textContent = i18n.t("pagination_showing", { start: startIdx, end: endIdx, total });

    let html = `<button class="btn btn-secondary btn-sm" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.mapExplorerGoToPage(${this.currentPage - 1})">&lt;</button>`;

    let lastRendered = 0;
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= this.currentPage - 1 && p <= this.currentPage + 1)) {
        if (lastRendered > 0 && p - lastRendered > 1) {
          html += `<span style="display:inline-flex; align-items:center; padding:0 4px; color:var(--text-muted); font-size:0.8rem; user-select:none;">...</span>`;
        }
        html += `<button class="btn ${p === this.currentPage ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.mapExplorerGoToPage(${p})">${p}</button>`;
        lastRendered = p;
      }
    }

    html += `<button class="btn btn-secondary btn-sm" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.mapExplorerGoToPage(${this.currentPage + 1})">&gt;</button>`;
    controlsEl.innerHTML = html;
  },

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredPlaces.length / this.pageSize) || 1;
    this.currentPage = Math.max(1, Math.min(Number(page) || 1, totalPages));
    this.renderPlacesCards();
  },

  addAllToRoute() {
    const list = Array.isArray(this.filteredPlaces) ? this.filteredPlaces : [];
    if (list.length === 0) {
      alert(i18n.t("alert_no_places_to_add"));
      return;
    }

    let addedCount = 0;
    list.forEach(place => {
      const exists = this.routeWaypoints.some(w => (w.placeId && w.placeId === place.placeId) || ((w.name || "").trim().toLowerCase() === (place.name || "").trim().toLowerCase()));
      if (!exists) {
        this.routeWaypoints.push({
          _uid: "wp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          placeId: place.placeId || "",
          name: place.name || "Unknown Place",
          nameEn: place.nameEn || "",
          address: place.address || "",
          latitude: parseFloat(place.latitude || place.lat) || 0,
          longitude: parseFloat(place.longitude || place.lng) || 0,
          phone: place.phone || "",
          rating: place.rating || "",
          reviews: place.reviews || "",
          openingHours: place.openingHours || "",
          photoUrl: place.photoUrl || ""
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      this.saveRouteWaypoints();
      this.renderWaypoints();
      this.updateRoute();
      this.renderMarkers();
      this.renderPlacesCards();
      const msg = i18n.t("toast_added_stops", { count: addedCount });
      if (window.showToast) window.showToast(msg);
      else alert(msg);
    } else {
      alert(i18n.t("alert_all_places_already_in_route"));
    }
  },

  // -------------------------------------------------------------
  // Map Markers & SVG Icons
  // -------------------------------------------------------------
  clearMarkers() {
    this.cancelMarkerBatches();
    this.markersMap.forEach(marker => {
      if (marker.map !== undefined) marker.map = null;
      else if (marker.setMap) marker.setMap(null);
      else if (this.fallbackLayerGroup) this.fallbackLayerGroup.removeLayer(marker);
    });
    this.markersMap.clear();
  },

  cancelMarkerBatches() {
    this.markerRenderGeneration++;
    if (this.markerBatchTimer) {
      clearTimeout(this.markerBatchTimer);
      this.markerBatchTimer = null;
    }
    this.growingMarkers.clear();
  },

  renderMarkers() {
    this.clearMarkers();

    const markerPlaces = [];
    const seenKeys = new Set();
    const list = Array.isArray(this.filteredPlaces) ? this.filteredPlaces : [];

    // 1. Waypoint places are always rendered first
    this.routeWaypoints.forEach(w => {
      const key = w.placeId || w.name;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        markerPlaces.push(w);
      }
    });

    // 2. Current page places
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = list.slice(startIdx, startIdx + this.pageSize);
    pageItems.forEach(r => {
      const key = r.placeId || r.name;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        markerPlaces.push(r);
      }
    });

    // 3. Remaining places up to 400
    for (let i = 0; i < list.length && markerPlaces.length < 400; i++) {
      const r = list[i];
      const key = r.placeId || r.name;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        markerPlaces.push(r);
      }
    }

    const createMarker = (r) => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const key = r.placeId || r.name;
      const wpIdx = this.routeWaypoints.findIndex(w => (w.placeId && w.placeId === r.placeId) || ((w.name || "").trim().toLowerCase() === (r.name || "").trim().toLowerCase()));
      const isWaypoint = wpIdx !== -1;
      const displayName = this.getRestaurantDisplayName(r);

      if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
        const useAdvanced = !!(window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement);
        let marker;

        if (useAdvanced) {
          try {
            const content = isWaypoint
              ? this.buildWaypointElement(wpIdx + 1, false)
              : this.buildPinElement(r, false);

            marker = new google.maps.marker.AdvancedMarkerElement({
              position: { lat, lng },
              map: this.googleMap,
              title: displayName,
              content: content,
              zIndex: isWaypoint ? 100 + (wpIdx + 1) : 20
            });
          } catch (err) {
            const icon = isWaypoint ? this.getNumberedWaypointIcon(wpIdx + 1, false) : this.getPinIcon(r, false);
            marker = new google.maps.Marker({
              position: { lat, lng },
              map: this.googleMap,
              title: displayName,
              icon: icon,
              zIndex: isWaypoint ? 100 + (wpIdx + 1) : 20
            });
          }
        } else {
          const icon = isWaypoint ? this.getNumberedWaypointIcon(wpIdx + 1, false) : this.getPinIcon(r, false);
          marker = new google.maps.Marker({
            position: { lat, lng },
            map: this.googleMap,
            title: displayName,
            icon: icon,
            zIndex: isWaypoint ? 100 + (wpIdx + 1) : 20
          });
        }

        marker.addListener("click", () => {
          this.showInfoWindow(r, marker);
          this.scrollCardIntoView(key);
          this.scrollWaypointCardIntoView(key);
        });

        marker.restaurant = r;
        this.markersMap.set(key, marker);
      } else if (this.fallbackMap && this.fallbackLayerGroup && window.L) {
        const marker = isWaypoint
          ? L.marker([lat, lng], {
              icon: L.divIcon({
                className: "custom-leaflet-marker",
                html: `<div style="width:28px;height:28px;background:#2563eb;color:#fff;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;box-shadow:0 2px 5px rgba(0,0,0,0.3);">${wpIdx + 1}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
              })
            })
          : L.circleMarker([lat, lng], {
              radius: 8,
              fillColor: "#f59e0b",
              color: "#ffffff",
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            });

        marker.bindPopup(this.getPopupHtml(r), { maxWidth: 300 });
        marker.on("click", () => {
          this.scrollCardIntoView(key);
          this.scrollWaypointCardIntoView(key);
        });

        this.fallbackLayerGroup.addLayer(marker);
        marker.restaurant = r;
        this.markersMap.set(key, marker);
      }
    };

    const generation = this.markerRenderGeneration;
    let next = 0;
    const renderBatch = () => {
      if (generation !== this.markerRenderGeneration) return;
      this.markerBatchTimer = null;
      let count = 0;
      while (next < markerPlaces.length && count < 25) {
        const place = markerPlaces[next++];
        const key = place.placeId || place.name;
        if (!this.markersMap.has(key)) createMarker(place);
        count++;
      }
      if (next < markerPlaces.length) this.markerBatchTimer = setTimeout(renderBatch, 16);
    };
    renderBatch();
  },

  buildWaypointElement(stopNumber, isHighlight = false) {
    const size = isHighlight ? 34 : 28;
    const bgColor = isHighlight ? "#1d4ed8" : "#2563eb";
    const div = document.createElement("div");
    div.className = "greenoil-waypoint-pin";
    div.style.width = `${size}px`;
    div.style.height = `${size}px`;
    div.style.borderRadius = "50%";
    div.style.backgroundColor = bgColor;
    div.style.color = "#ffffff";
    div.style.border = "2.5px solid #ffffff";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.justifyContent = "center";
    div.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    div.style.fontSize = `${Math.round(size * 0.44)}px`;
    div.style.fontWeight = "700";
    div.style.boxShadow = "0 2px 6px rgba(0,0,0,0.35)";
    div.style.cursor = "pointer";
    div.style.userSelect = "none";
    div.innerText = `${stopNumber}`;
    return div;
  },

  buildPinElement(r, isHighlight = false) {
    const div = document.createElement("div");
    div.className = "greenoil-restaurant-pin";
    div.style.cursor = "pointer";
    div.style.filter = "drop-shadow(0 2px 5px rgba(0,0,0,0.32))";
    div.style.transition = "transform 0.15s ease";
    if (isHighlight) div.style.transform = "scale(1.2)";
    const fillColor = isHighlight ? "#2563eb" : "#f59e0b";
    const strokeColor = isHighlight ? "#1d4ed8" : "#ffffff";
    div.innerHTML = `
      <svg width="26" height="34" viewBox="0 0 24 32" style="display:block;">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
      </svg>
    `;
    return div;
  },

  buildOriginElement(isHighlight = false) {
    const size = isHighlight ? 36 : 30;
    const div = document.createElement("div");
    div.className = "greenoil-origin-pin";
    div.style.width = `${size}px`;
    div.style.height = `${size}px`;
    div.style.borderRadius = "50%";
    div.style.backgroundColor = "#dc2626";
    div.style.color = "#ffffff";
    div.style.border = "2.5px solid #ffffff";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.justifyContent = "center";
    div.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    div.style.fontSize = "11px";
    div.style.fontWeight = "700";
    div.style.boxShadow = "0 2px 6px rgba(0,0,0,0.35)";
    div.style.cursor = "pointer";
    div.style.userSelect = "none";
    div.innerText = "HQ";
    return div;
  },

  getNumberedWaypointIcon(stopNumber, isHighlight = false) {
    const size = isHighlight ? 36 : 28;
    const bgColor = isHighlight ? "#1d4ed8" : "#2563eb";
    const strokeColor = "#ffffff";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${bgColor}" stroke="${strokeColor}" stroke-width="2.5"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="${size * 0.44}px" font-weight="700">${stopNumber}</text>
    </svg>`;
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(size / 2, size / 2)
    };
  },

  getOriginIcon(isHighlight = false) {
    const size = isHighlight ? 38 : 32;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#dc2626" stroke="#ffffff" stroke-width="2.5"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="${size * 0.38}px" font-weight="700">HQ</text>
    </svg>`;
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(size / 2, size / 2)
    };
  },

  getPinIcon(r, isHighlight) {
    const color = "#f59e0b";
    const scale = isHighlight ? 1.6 : 1.3;
    const strokeColor = isHighlight ? "#2563eb" : "#ffffff";
    const strokeWeight = isHighlight ? 2.8 : 1.8;
    const fillColor = isHighlight ? "#2563eb" : color;

    return {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
      fillColor: fillColor,
      fillOpacity: 1,
      strokeWeight: strokeWeight,
      strokeColor: strokeColor,
      scale: scale,
      anchor: new google.maps.Point(12, 22)
    };
  },

  highlightMarker(key, highlight) {
    if (highlight) this.highlightedPinKey = key;
    else if (this.highlightedPinKey === key) this.highlightedPinKey = null;

    let marker = this.markersMap.get(key);
    const r = this.findPlace(key);
    if (!r || !marker) return;

    const wpIdx = this.routeWaypoints.findIndex(w => (w.placeId && w.placeId === r.placeId) || ((w.name || "").trim().toLowerCase() === (r.name || "").trim().toLowerCase()));
    const isWaypoint = wpIdx !== -1;

    if (this.googleMap && !this.isFallbackMode) {
      if (marker.content !== undefined) {
        marker.content = isWaypoint ? this.buildWaypointElement(wpIdx + 1, highlight) : this.buildPinElement(r, highlight);
        marker.zIndex = highlight ? 999 : (isWaypoint ? 100 + (wpIdx + 1) : 20);
      } else if (marker.setIcon) {
        const icon = isWaypoint ? this.getNumberedWaypointIcon(wpIdx + 1, highlight) : this.getPinIcon(r, highlight);
        marker.setIcon(icon);
        marker.setZIndex(highlight ? 999 : (isWaypoint ? 100 + (wpIdx + 1) : 20));
      }
    }
  },

  scrollCardIntoView(key) {
    const container = document.getElementById("mapPlacesCardsContainer");
    if (!container) return;

    const index = this.filteredPlaces.findIndex(place => (place.placeId || place.name) === key);
    if (index >= 0) {
      const page = Math.floor(index / this.pageSize) + 1;
      if (this.currentPage !== page) {
        this.currentPage = page;
        this.renderPlacesCards();
      }
      const card = container.querySelector(`.map-place-card[data-key="${CSS.escape(key)}"]`);
      if (card) {
        container.querySelectorAll(".map-place-card").forEach(el => {
          el.classList.remove("is-active");
          el.classList.remove("active-highlight");
        });
        card.classList.add("is-active");
        card.classList.add("active-highlight");
        card.focus({ preventScroll: true });
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  },

  // -------------------------------------------------------------
  // Info Window / Popup Content
  // -------------------------------------------------------------
  getPopupHtml(r) {
    const key = r.placeId || r.name;
    const displayName = this.getRestaurantDisplayName(r);
    const photoInfo = this.getRestaurantPhoto(r);
    const inRouteIdx = this.routeWaypoints.findIndex(w => (w.placeId && w.placeId === r.placeId) || ((w.name || "").trim().toLowerCase() === (r.name || "").trim().toLowerCase()));
    const isInRoute = inRouteIdx !== -1;

    let statusObj = r.openingHours ? BusinessHours.getBusinessStatus(r.openingHours) : null;
    if (!statusObj && r.status) {
      const sLower = String(r.status).toLowerCase();
      if (r.status === "营业中" || sLower === "open") {
        statusObj = { cls: "open", label: i18n.t("status_open") || "营业中" };
      } else if (r.status === "已打烊" || sLower === "closed") {
        statusObj = { cls: "closed", label: i18n.t("status_closed") || "已打烊" };
      }
    }
    const hoursBadge = statusObj
      ? `<span class="status-badge ${statusObj.cls}" style="font-size:10px; padding:1px 5px; border-radius:4px;">${statusObj.label}</span>`
      : "";

    const routeBtn = !isInRoute ? `
      <button onclick="window.mapExplorerAddSingleToRoute('${this.escapeQuotes(key)}')" style="background:#2563eb; color:white; border:none; border-radius:4px; padding:4px 9px; font-size:11px; font-weight:600; cursor:pointer;">
        ${this.escapeHtml(i18n.t("map_card_add_stop"))}
      </button>
    ` : `
      <button onclick="window.mapExplorerRemoveSingleFromRoute('${this.escapeQuotes(key)}')" style="background:#fee2e2; color:#b91c1c; border:none; border-radius:4px; padding:4px 9px; font-size:11px; font-weight:600; cursor:pointer;">
        ${this.escapeHtml(i18n.t("btn_remove_stop"))}
      </button>
    `;

    const rawCategory = r.categoriesRaw || (r.categories ? r.categories.slice(0, 2).join(" · ") : (i18n.t("cat_food") || "Food & Dining"));
    const categoryStr = this.formatCategory(rawCategory);

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2px; max-width: 260px;">
        <div style="display:flex; gap: 8px; align-items: center; margin-bottom: 6px;">
          ${photoInfo.url ? `<div style="width:48px;height:48px;flex-shrink:0;overflow:hidden;border-radius:6px"><img src="${this.escapeHtml(photoInfo.url)}" alt="${this.escapeHtml(displayName)}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.remove()" /></div>` : ''}
          <div style="min-width: 0; flex: 1;">
            <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(displayName)}">${this.escapeHtml(displayName)}</h4>
            <div style="margin-top: 3px; display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
              ${hoursBadge}
            </div>
          </div>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="none" style="vertical-align: -1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${r.rating ? parseFloat(r.rating).toFixed(1) : "4.2"} (${r.reviews || 10}) · <b>${this.escapeHtml(this.formatPrice(r.price || "$$"))}</b> · <span>${this.escapeHtml(categoryStr)}</span>
        </div>
        <div style="font-size: 11px; color: #334155; margin-bottom: 6px; line-height: 1.3;">
          ${this.escapeHtml(r.address || "Ontario, GTA")}
        </div>
        <div style="display:flex; gap: 6px; border-top: 1px solid #e2e8f0; padding-top: 6px; flex-wrap: wrap;">
          ${routeBtn}
          <button onclick="window.mapExplorerOpenNav('${this.escapeQuotes(displayName)}', '${this.escapeQuotes(r.address)}')" style="background:#0f172a; color:white; border:none; border-radius:4px; padding:3px 7px; font-size:11px; cursor:pointer;">
            ${this.escapeHtml(i18n.t("map_card_nav"))}
          </button>
        </div>
      </div>
    `;
  },

  findPlace(key) {
    return this.poiPlaces.get(key) ||
           this.routeWaypoints.find(w => (w.placeId || w.name) === key) ||
           this.displayedPlaces.find(r => (r.placeId || r.name) === key) ||
           this.filteredPlaces?.find(r => (r.placeId || r.name) === key);
  },

  showInfoWindow(r, marker) {
    if (this.isFallbackMode && marker && marker.openPopup) {
      marker.openPopup();
      return;
    }
    if (!this.infoWindow || !this.googleMap) return;

    this.poiRequestId++;
    this.activePopupKey = r.placeId || r.name;
    this.infoWindow.setContent(this.getPopupHtml(r));
    this.infoWindow.open({ map: this.googleMap, anchor: marker });
  },

  async openGooglePoi(placeId, position) {
    const requestId = ++this.poiRequestId;
    this.activePopupKey = placeId;
    this.infoWindow.setContent(`<div style="padding:8px">${this.escapeHtml(i18n.t("map_loading_place_details") || "Loading place details...")}</div>`);
    if (position) this.infoWindow.setPosition(position);
    this.infoWindow.open({ map: this.googleMap });

    let restaurant = this.findPlace(placeId);
    if (!restaurant) {
      // 1. Direct modern Google Places API (New) from browser with referrer
      try {
        const apiKey = this.googleApiKey || await Api.getGoogleMapsApiKey();
        if (apiKey) {
          const resp = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
            headers: {
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": "id,displayName,formattedAddress,location,rating,userRatingCount,types,regularOpeningHours,internationalPhoneNumber"
            }
          });
          if (resp.ok) {
            const data = await resp.json();
            const lat = data.location?.latitude || (position && typeof position.lat === "function" ? position.lat() : 0);
            const lng = data.location?.longitude || (position && typeof position.lng === "function" ? position.lng() : 0);
            restaurant = {
              placeId: data.id || placeId,
              name: data.displayName?.text || "Unknown Place",
              address: data.formattedAddress || "",
              latitude: lat,
              longitude: lng,
              rating: data.rating || "",
              reviews: data.userRatingCount || "",
              phone: data.internationalPhoneNumber || "",
              openingHours: data.regularOpeningHours?.weekdayDescriptions?.join(" | ") || "",
              types: data.types || []
            };
          }
        }
      } catch (err) {
        console.warn("Direct Places API (New) details failed:", err);
      }
    }

    // 2. Modern google.maps.places.Place fallback
    if (!restaurant && typeof window !== "undefined" && window.google?.maps?.places?.Place) {
      try {
        const place = new google.maps.places.Place({ id: placeId });
        await place.fetchFields({
          fields: ["id", "displayName", "formattedAddress", "location", "rating", "userRatingCount", "nationalPhoneNumber", "regularOpeningHours", "types"]
        });
        const lat = place.location ? (typeof place.location.lat === "function" ? place.location.lat() : place.location.lat) : (position && typeof position.lat === "function" ? position.lat() : 0);
        const lng = place.location ? (typeof place.location.lng === "function" ? place.location.lng() : place.location.lng) : (position && typeof position.lng === "function" ? position.lng() : 0);
        restaurant = {
          placeId: place.id || placeId,
          name: place.displayName || "Unknown Place",
          address: place.formattedAddress || "",
          latitude: lat,
          longitude: lng,
          rating: place.rating || "",
          reviews: place.userRatingCount || "",
          phone: place.nationalPhoneNumber || "",
          openingHours: place.regularOpeningHours?.weekdayDescriptions?.join(" | ") || "",
          types: place.types || []
        };
      } catch (err) {
        console.warn("Place fetchFields fallback failed:", err);
      }
    }

    // 3. Fallback to API worker proxy
    if (!restaurant) {
      try {
        const result = await Api.getGooglePlaceDetails(placeId, "zh-CN");
        if (result && result.success && result.place) {
          restaurant = result.place;
        }
      } catch (e) {}
    }

    if (requestId !== this.poiRequestId) return;
    if (!restaurant) {
      this.infoWindow.setContent(`<div style="padding:10px;font-size:13px;color:#64748b;">${this.escapeHtml(i18n.t("map_place_details_failed") || "Failed to load place details. Please try again.")}</div>`);
      return;
    }

    this.poiPlaces.set(placeId, restaurant);
    this.infoWindow.setContent(this.getPopupHtml(restaurant));
  },

  // -------------------------------------------------------------
  getRestaurantPhoto(r) {
    if (!r) return { url: null, isGoogle: false };
    const raw = r.photoUrl;
    // Omit places.googleapis / googleusercontent photo URLs to avoid connection errors and billing
    if (typeof raw === "string" && raw.startsWith("http") && !raw.includes("places.googleapis.com") && !raw.includes("googleusercontent.com")) {
      return { url: raw, isGoogle: true };
    }
    return { url: null, isGoogle: false };
  },

  async fetchGooglePhotoForPlace(placeId) {
    // Disabled: prevent "无法连接服务器" errors from lh3.googleusercontent.com CDN
    return null;
  },

  async resolveVisibleGooglePhotos(pageItems) {
    // Disabled: prevent "无法连接服务器" errors from lh3.googleusercontent.com CDN
    return;
  },

  // -------------------------------------------------------------
  // Map Creation & Fallback
  // -------------------------------------------------------------
  async initGoogleMap() {
    const canvas = document.getElementById("mapExplorerCanvas");
    if (!canvas) return;

    if (window.google && window.google.maps) {
      this.createMapInstance();
      return;
    }

    const apiKey = this.googleApiKey || await Api.getGoogleMapsApiKey();
    if (!apiKey) {
      this.triggerFallbackMode();
      return;
    }

    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,marker&loading=async&callback=__greenOilInitMapCallback`;
        script.async = true;
        script.defer = true;
        window.__greenOilInitMapCallback = () => {
          delete window.__greenOilInitMapCallback;
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
      this.createMapInstance();
    } catch (err) {
      console.warn("Failed to load Google Maps JS API:", err);
      this.triggerFallbackMode();
    }
  },

  createMapInstance() {
    const canvas = document.getElementById("mapExplorerCanvas");
    if (!canvas || !window.google || !window.google.maps) {
      this.triggerFallbackMode();
      return;
    }

    try {
      const defaultCommunity = GTA_COMMUNITIES.find(city => city.id === "scarborough") || GTA_COMMUNITIES[0];
      this.googleMap = new google.maps.Map(canvas, {
        center: { ...defaultCommunity.center },
        zoom: defaultCommunity.zoom || 13,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true
      });

      this.infoWindow = new google.maps.InfoWindow();
      this.infoWindow.addListener("closeclick", () => {
        this.activePopupKey = null;
        this.poiRequestId++;
      });

      this.googleMap.addListener("click", event => {
        this.hideMapContextMenu();
        if (event.placeId) {
          event.stop();
          this.openGooglePoi(event.placeId, event.latLng);
          return;
        }

        // Proximity hit-test: if clicked on POI text/canvas without explicit placeId
        if (event.latLng && window.google?.maps?.places?.Place?.searchNearby) {
          const lat = typeof event.latLng.lat === "function" ? event.latLng.lat() : event.latLng.lat;
          const lng = typeof event.latLng.lng === "function" ? event.latLng.lng() : event.latLng.lng;
          try {
            google.maps.places.Place.searchNearby({
              locationRestriction: { center: { lat, lng }, radius: 35 },
              fields: ["id", "location"],
              maxResultCount: 1
            }).then(({ places }) => {
              if (places && places.length > 0 && places[0].id) {
                this.openGooglePoi(places[0].id, places[0].location || event.latLng);
              }
            }).catch(() => {});
          } catch (e) {}
        }
      });

      this.googleMap.addListener("rightclick", event => {
        event.domEvent?.preventDefault?.();
        event.stop?.();
        const coordinate = this.getMapEventCoordinate(event.latLng);
        if (!coordinate) return;
        const domEvent = event.domEvent;
        this.showMapContextMenu(coordinate.lat, coordinate.lng, domEvent?.clientX ?? 0, domEvent?.clientY ?? 0);
      });

      this.googleMap.addListener("idle", () => {
        const center = this.googleMap.getCenter();
        const zoom = this.googleMap.getZoom();
        if (!center) return;
        if (this.lastSearchedCenter) {
          const dist = this.getHaversineDistance(
            this.lastSearchedCenter.lat, this.lastSearchedCenter.lng,
            center.lat(), center.lng()
          );
          if (dist > 0.35 || Math.abs(zoom - (this.lastSearchedZoom || zoom)) >= 1) {
            const btn = document.getElementById("mapSearchThisAreaBtn");
            if (btn) btn.style.display = "inline-flex";
          }
        } else {
          this.lastSearchedCenter = { lat: center.lat(), lng: center.lng() };
          this.lastSearchedZoom = zoom;
        }
      });

      this.updateOriginMarker();
    } catch (err) {
      console.warn("Google Maps instantiation failed:", err);
      this.triggerFallbackMode();
    }
  },

  async initFallbackMap() {
    const canvas = document.getElementById("mapExplorerCanvas");
    if (!canvas) return;

    if (!document.getElementById("leafletCss")) {
      const link = document.createElement("link");
      link.id = "leafletCss";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    if (!window.L) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.id = "leafletJs";
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      } catch (e) {
        console.error("Leaflet load error:", e);
        return;
      }
    }

    if (!window.L) return;

    canvas.innerHTML = "";
    if (this.fallbackMap) {
      this.fallbackMap.remove();
      this.fallbackMap = null;
    }

    const defaultCommunity = GTA_COMMUNITIES.find(city => city.id === "scarborough") || GTA_COMMUNITIES[0];
    const defaultCenter = [defaultCommunity.center.lat, defaultCommunity.center.lng];
    this.fallbackMap = L.map(canvas, { preferCanvas: true }).setView(defaultCenter, defaultCommunity.zoom || 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors | Green Oil"
    }).addTo(this.fallbackMap);

    this.fallbackLayerGroup = L.layerGroup().addTo(this.fallbackMap);
    this.fallbackMap.on("click", () => this.hideMapContextMenu());
    this.fallbackMap.on("contextmenu", event => {
      event.originalEvent?.preventDefault?.();
      const point = this.getMapEventCoordinate(event.latlng);
      if (!point) return;
      const original = event.originalEvent;
      this.showMapContextMenu(point.lat, point.lng, original?.clientX ?? 0, original?.clientY ?? 0);
    });

    this.fallbackMap.on("moveend", () => {
      const center = this.fallbackMap.getCenter();
      const zoom = this.fallbackMap.getZoom();
      if (!center) return;
      if (this.lastSearchedCenter) {
        const dist = this.getHaversineDistance(
          this.lastSearchedCenter.lat, this.lastSearchedCenter.lng,
          center.lat, center.lng
        );
        if (dist > 0.35 || Math.abs(zoom - (this.lastSearchedZoom || zoom)) >= 1) {
          const btn = document.getElementById("mapSearchThisAreaBtn");
          if (btn) btn.style.display = "inline-flex";
        }
      } else {
        this.lastSearchedCenter = { lat: center.lat, lng: center.lng };
        this.lastSearchedZoom = zoom;
      }
    });

    this.drawSelectedBoundaries();
    this.renderMarkers();
    this.updateOriginMarker();
    this.updateRoute();
  },

  // -------------------------------------------------------------
  // GeoJSON & Boundary Polygons
  // -------------------------------------------------------------
  async loadNeighbourhoodsGeoJson() {
    try {
      const municipalities = await fetch("assets/data/official_municipalities.json");
      if (municipalities.ok) {
        const cityData = await municipalities.json();
        if (cityData && Array.isArray(cityData.features)) {
          cityData.features.forEach(feature => {
            const city = GTA_COMMUNITIES.find(c => c.id === feature.id);
            if (city) Object.assign(city, { geometry: feature.geometry, bbox: feature.bbox });
          });
        }
      }
    } catch (e) {}

    try {
      const resp = await fetch("assets/data/gta_neighbourhoods.json");
      if (resp.ok) {
        this.neighbourhoodsGeoJson = await resp.json();
      }
    } catch (e) {}

    if (!this.neighbourhoodsGeoJson) {
      this.neighbourhoodsGeoJson = { type: "FeatureCollection", features: [] };
    }

    try {
      const subareasResponse = await fetch("assets/data/official_subareas.json");
      if (subareasResponse.ok) {
        const subareas = await subareasResponse.json();
        if (subareas && Array.isArray(subareas.features)) {
          this.neighbourhoodsGeoJson.features.push(...subareas.features);
        }
      }
    } catch (e) {}

    if (this.neighbourhoodsGeoJson && Array.isArray(this.neighbourhoodsGeoJson.features)) {
      this.neighbourhoodsMap.clear();
      this.neighbourhoodsGeoJson.features.forEach(ft => {
        if (ft.id) this.neighbourhoodsMap.set(ft.id, ft);
        if (ft.code) this.neighbourhoodsMap.set(ft.code, ft);
      });
    }
  },

  clearBoundaries() {
    this.polygonsMap.forEach(poly => {
      if (poly.setMap) poly.setMap(null);
      else if (this.fallbackMap && this.fallbackMap.removeLayer) this.fallbackMap.removeLayer(poly);
    });
    this.polygonsMap.clear();
  },

  extractGooglePolygonPaths(geometry) {
    if (!geometry || !geometry.coordinates) return [];
    if (geometry.type === "Polygon") {
      return [geometry.coordinates.map(ring => ring.map(([lng, lat]) => ({ lat, lng })))];
    }
    if (geometry.type === "MultiPolygon") {
      return geometry.coordinates.map(polygon =>
        polygon.map(ring => ring.map(([lng, lat]) => ({ lat, lng })))
      );
    }
    return [];
  },

  drawSelectedBoundaries() {
    this.clearBoundaries();

    const selectedAreas = this.activeNeighborhoodIds.size > 0
      ? this.getAllNeighborhoods().filter(nb => this.activeNeighborhoodIds.has(nb.id))
      : this.activeCityIds.has("all")
        ? []
        : GTA_COMMUNITIES.filter(c => this.activeCityIds.has(c.id));

    if (selectedAreas.length === 0) return;

    selectedAreas.forEach(area => {
      if (!area.geometry) return;
      if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
        const polygonRingsList = this.extractGooglePolygonPaths(area.geometry);
        polygonRingsList.forEach((polyRings, idx) => {
          if (!polyRings || polyRings.length === 0) return;
          const polygon = new google.maps.Polygon({
            clickable: false,
            paths: polyRings,
            strokeColor: "#16a34a",
            strokeOpacity: 0.85,
            strokeWeight: 2,
            fillColor: "#22c55e",
            fillOpacity: 0.12,
            map: this.googleMap,
            zIndex: 10
          });
          this.polygonsMap.set(`${area.id}_${idx}`, polygon);
        });
      } else if (this.fallbackMap && window.L) {
        try {
          const layer = L.geoJSON(area.geometry, {
            style: {
              color: "#16a34a",
              weight: 2,
              opacity: 0.85,
              fillColor: "#22c55e",
              fillOpacity: 0.12
            }
          }).addTo(this.fallbackMap);
          this.polygonsMap.set(area.id, layer);
        } catch (e) {
          console.warn("Fallback boundary render error:", e);
        }
      }
    });
  },

  isPlaceInGeometry(place, geometry) {
    if (!place) return false;
    const latitude = place.latitude ?? place.lat;
    const longitude = place.longitude ?? place.lng;
    if (latitude == null || longitude == null || String(latitude).trim() === "" || String(longitude).trim() === "") return false;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;

    const polygons = geometry?.type === "Polygon" ? [geometry.coordinates] :
      geometry?.type === "MultiPolygon" ? geometry.coordinates : [];

    const inRing = ring => {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = ring[j];
        const [bx, by] = ring[i];
        const cross = (lng - ax) * (by - ay) - (lat - ay) * (bx - ax);
        if (Math.abs(cross) <= 1e-12 && lng >= Math.min(ax, bx) && lng <= Math.max(ax, bx) &&
            lat >= Math.min(ay, by) && lat <= Math.max(ay, by)) return 2;
        if ((ay > lat) !== (by > lat) && lng < (bx - ax) * (lat - ay) / (by - ay) + ax) inside = !inside;
      }
      return inside ? 1 : 0;
    };

    return polygons.some(rings => {
      if (!rings?.length) return false;
      const outer = inRing(rings[0]);
      if (outer === 0) return false;
      const holes = rings.slice(1).map(inRing);
      return !holes.includes(1);
    });
  },

  // -------------------------------------------------------------
  // Neighborhoods & Area Popover
  // -------------------------------------------------------------
  getAllNeighborhoods() {
    if (this.neighbourhoodsGeoJson && Array.isArray(this.neighbourhoodsGeoJson.features)) {
      return this.neighbourhoodsGeoJson.features.map(ft => {
        const props = ft.properties || {};
        const cityId = ft.cityId || props.cityId || props.CITY || "toronto";
        const cityName = ft.cityName || props.cityName || props.CITY || "Toronto";
        return {
          id: ft.id || props.AREA_ID || props.AREA_SHORT_CODE || ft.code,
          code: ft.code || props.AREA_SHORT_CODE || props.AREA_ID,
          name: ft.name || props.AREA_NAME || props.NAME || ft.id,
          nameZh: ft.nameZh || props.AREA_NAME_ZH || props.NAME_ZH || ft.name || props.AREA_NAME || props.NAME || ft.id,
          nameEn: ft.nameEn || props.AREA_NAME_EN || props.NAME_EN || ft.name || props.AREA_NAME || props.NAME || ft.id,
          nameKo: ft.nameKo || props.AREA_NAME_KO || props.NAME_KO || ft.name || props.AREA_NAME || props.NAME || ft.id,
          boundaryType: ft.boundaryType || props.boundaryType || "neighbourhood",
          cityId: cityId,
          cityName: cityName,
          cityNameZh: ft.cityNameZh || props.cityNameZh,
          cityNameKo: ft.cityNameKo || props.cityNameKo,
          center: ft.center,
          bbox: ft.bbox,
          geometry: ft.geometry,
          neighbors: ft.neighbors || [],
          parentCityId: cityId,
          parentCityName: cityName
        };
      });
    }
    const list = [];
    GTA_COMMUNITIES.forEach(c => {
      if (Array.isArray(c.neighborhoods)) {
        c.neighborhoods.forEach(nb => {
          list.push({ ...nb, parentCityId: c.id, parentCityName: c.name });
        });
      }
    });
    return list;
  },

  getNeighborhoodById(nbId) {
    if (this.neighbourhoodsMap && this.neighbourhoodsMap.has(nbId)) {
      const ft = this.neighbourhoodsMap.get(nbId);
      const props = ft.properties || {};
      const cityId = ft.cityId || props.cityId || props.CITY || "toronto";
      const cityName = ft.cityName || props.cityName || props.CITY || "Toronto";
      return {
        id: ft.id || props.AREA_ID || props.AREA_SHORT_CODE || ft.code,
        code: ft.code || props.AREA_SHORT_CODE || props.AREA_ID,
        name: ft.name || props.AREA_NAME || props.NAME || ft.id,
        nameZh: ft.nameZh || props.AREA_NAME_ZH || props.NAME_ZH || ft.name || props.AREA_NAME || props.NAME || ft.id,
        nameEn: ft.nameEn || props.AREA_NAME_EN || props.NAME_EN || ft.name || props.AREA_NAME || props.NAME || ft.id,
        nameKo: ft.nameKo || props.AREA_NAME_KO || props.NAME_KO || ft.name || props.AREA_NAME || props.NAME || ft.id,
        boundaryType: ft.boundaryType || props.boundaryType || "neighbourhood",
        cityId: cityId,
        cityName: cityName,
        cityNameZh: ft.cityNameZh || props.cityNameZh,
        cityNameKo: ft.cityNameKo || props.cityNameKo,
        center: ft.center,
        bbox: ft.bbox,
        geometry: ft.geometry,
        neighbors: ft.neighbors || [],
        parentCityId: cityId,
        parentCityName: cityName
      };
    }
    for (const c of GTA_COMMUNITIES) {
      if (Array.isArray(c.neighborhoods)) {
        const found = c.neighborhoods.find(n => n.id === nbId);
        if (found) return { ...found, parentCityId: c.id, parentCityName: c.name };
      }
    }
    return null;
  },

  findWardAtCoordinate(lat, lng) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const wards = this.getAllNeighborhoods().filter(area => area.boundaryType === "ward");
    if (wards.length === 0) return null;

    const byId = new Map(wards.map(ward => [ward.id, ward]));
    const selectedNbs = this.getAllNeighborhoods().filter(area => this.activeNeighborhoodIds.has(area.id));
    const nearbyIds = [];
    selectedNbs.forEach(area => (area.neighbors || []).forEach(id => {
      if (!nearbyIds.includes(id)) nearbyIds.push(id);
    }));
    const selectedCityIds = this.activeCityIds.has("all")
      ? []
      : Array.from(this.activeCityIds);
    selectedCityIds.forEach(cityId => wards.filter(ward => ward.parentCityId === cityId).forEach(ward => {
      if (!nearbyIds.includes(ward.id)) nearbyIds.push(ward.id);
    }));

    const inBbox = ward => {
      const box = ward.bbox;
      return !Array.isArray(box) || box.length !== 4 ||
        (longitude >= Number(box[0]) && longitude <= Number(box[2]) &&
         latitude >= Number(box[1]) && latitude <= Number(box[3]));
    };
    const contains = ward => inBbox(ward) && this.isPlaceInGeometry({ lat: latitude, lng: longitude }, ward.geometry);

    for (const id of nearbyIds) {
      const ward = byId.get(id);
      if (ward && contains(ward)) return { ward, source: "nearby" };
    }
    for (const ward of wards) {
      if (nearbyIds.includes(ward.id)) continue;
      if (contains(ward)) return { ward, source: "global" };
    }
    return null;
  },

  findNeighborhoodAtCoordinate(lat, lng) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const neighborhoods = this.getAllNeighborhoods().filter(area => area.boundaryType !== "ward");
    if (neighborhoods.length === 0) return null;
    const byId = new Map(neighborhoods.map(area => [area.id, area]));
    const selectedNbs = this.getAllNeighborhoods().filter(area => this.activeNeighborhoodIds.has(area.id));
    const nearbyIds = [];
    selectedNbs.forEach(area => (area.neighbors || []).forEach(id => {
      if (byId.has(id) && !nearbyIds.includes(id)) nearbyIds.push(id);
    }));
    const selectedCityIds = this.activeCityIds.has("all") ? [] : Array.from(this.activeCityIds);
    selectedCityIds.forEach(cityId => neighborhoods.filter(area => area.parentCityId === cityId).forEach(area => {
      if (!nearbyIds.includes(area.id)) nearbyIds.push(area.id);
    }));

    const contains = area => this.isPointInBbox({ lat: latitude, lng: longitude }, area.bbox) &&
      this.isPlaceInGeometry({ lat: latitude, lng: longitude }, area.geometry);
    for (const id of nearbyIds) {
      const area = byId.get(id);
      if (area && contains(area)) return { area, source: "nearby", kind: "neighborhood" };
    }
    for (const area of neighborhoods) {
      if (nearbyIds.includes(area.id)) continue;
      if (contains(area)) return { area, source: "global", kind: "neighborhood" };
    }
    return null;
  },

  findAdministrativeAreaAtCoordinate(lat, lng) {
    const wardMatch = this.findWardAtCoordinate(lat, lng);
    if (wardMatch?.ward) return { area: wardMatch.ward, source: wardMatch.source, kind: "ward" };
    return this.findNeighborhoodAtCoordinate(lat, lng);
  },

  isCoordinateInsideSelectedArea(lat, lng) {
    const point = { lat: Number(lat), lng: Number(lng) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
    const selectedNbs = this.getAllNeighborhoods().filter(area => this.activeNeighborhoodIds.has(area.id));
    if (selectedNbs.length > 0) return selectedNbs.some(area =>
      this.isPlaceInGeometry(point, area.geometry) || this.isPointInBbox(point, area.bbox));

    const selectedCities = GTA_COMMUNITIES.filter(city => city.id !== "all" && this.activeCityIds.has(city.id));
    if (selectedCities.length > 0) return selectedCities.some(city =>
      this.isPlaceInGeometry(point, city.geometry) || this.isPointInBbox(point, city.bbox));

    const allGta = GTA_COMMUNITIES.find(city => city.id === "all");
    return this.isPointInBbox(point, allGta?.bbox) ||
      GTA_COMMUNITIES.filter(city => city.id !== "all").some(city => this.isPlaceInGeometry(point, city.geometry));
  },

  isPointInBbox(point, bbox) {
    if (!point || !Array.isArray(bbox) || bbox.length !== 4) return false;
    const [west, south, east, north] = bbox.map(Number);
    return Number.isFinite(west) && Number.isFinite(south) && Number.isFinite(east) && Number.isFinite(north) &&
      point.lng >= west && point.lng <= east && point.lat >= south && point.lat <= north;
  },

  togglePopover(forceState) {
    const panel = document.getElementById("areaPopoverPanel");
    if (!panel) return;
    const isVisible = panel.style.display !== "none";
    const nextState = typeof forceState === "boolean" ? forceState : !isVisible;
    panel.style.display = nextState ? "block" : "none";
    if (nextState) {
      const searchInput = document.getElementById("popoverSearchInput");
      if (searchInput) searchInput.focus();
      this.renderPopover();
    }
  },

  getCurrentLanguage() {
    return i18n?.currentLang || "zh";
  },

  getLocalizedName(item) {
    const lang = this.getCurrentLanguage();
    if (lang === "en") return item.nameEn || item.name;
    if (lang === "ko") return item.nameKo || item.name;
    return item.nameZh || item.name;
  },

  getLocalizedAllGta() {
    const lang = this.getCurrentLanguage();
    if (lang === "en") return "All GTA";
    if (lang === "ko") return "광역 토론토 전체";
    return "全部大区";
  },

  updateAreaSummaryBtn() {
    const summary = document.getElementById("areaActiveTagsSummary");
    if (!summary) return;

    if (this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0) {
      summary.innerHTML = `<span class="area-tag-pill active">${this.getLocalizedAllGta()}</span>`;
      return;
    }

    const tags = [];
    const allNbs = this.getAllNeighborhoods();

    this.activeCityIds.forEach(id => {
      const city = GTA_COMMUNITIES.find(c => c.id === id);
      if (city) {
        tags.push(`<span class="area-tag-pill">${this.getLocalizedName(city)}</span>`);
      }
    });

    this.activeNeighborhoodIds.forEach(id => {
      const nb = allNbs.find(n => n.id === id);
      if (nb) {
        tags.push(`<span class="area-tag-pill">${this.getLocalizedName(nb)}</span>`);
      }
    });

    summary.innerHTML = tags.join("") || `<span class="area-tag-pill active">${this.getLocalizedAllGta()}</span>`;
  },

  renderPopover() {
    const lang = this.getCurrentLanguage();
    const cityContainer = document.getElementById("popoverCityPills");
    const nbContainer = document.getElementById("popoverNeighborhoodPills");
    const nbSection = document.getElementById("popoverNeighborhoodSection");
    const activeTagsRow = document.getElementById("popoverActiveTagsRow");
    const search = (this.popoverSearchQuery || "").toLowerCase();

    const allNbs = this.getAllNeighborhoods();
    const isAll = this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0;
    const selectedCities = GTA_COMMUNITIES.filter(c => c.id !== "all" && this.activeCityIds.has(c.id));
    const selectedNbs = allNbs.filter(nb => this.activeNeighborhoodIds.has(nb.id));

    // 1. Active Tags Row
    if (activeTagsRow) {
      const activeTags = [];
      if (isAll || (selectedCities.length === 0 && selectedNbs.length === 0)) {
        activeTags.push(`<span class="popover-tag-item active">${this.escapeHtml(this.getLocalizedAllGta())}</span>`);
      } else {
        selectedCities.forEach(city => {
          activeTags.push(`
            <span class="popover-tag-item">
              ${this.escapeHtml(this.getLocalizedName(city))}
              <span class="popover-tag-remove" onclick="event.stopPropagation(); window.mapExplorerRemoveCity('${city.id}')">&times;</span>
            </span>
          `);
        });

        selectedNbs.forEach(nb => {
          activeTags.push(`
            <span class="popover-tag-item">
              ${this.escapeHtml(this.getLocalizedName(nb))}
              <span class="popover-tag-remove" onclick="event.stopPropagation(); window.mapExplorerRemoveNeighborhood('${nb.id}')">&times;</span>
            </span>
          `);
        });
      }
      activeTagsRow.innerHTML = activeTags.join("");
    }

    // 2. Nearby Neighborhoods Section
    const nearbySection = document.getElementById("popoverNearbySection");
    const nearbyTitle = document.getElementById("popoverNearbyTitle");
    const nearbyPills = document.getElementById("popoverNearbyPills");
    if (nearbySection && nearbyTitle && nearbyPills) {
      if (selectedNbs.length > 0) {
        const currentNb = selectedNbs[selectedNbs.length - 1];
        const neighbors = currentNb.neighbors || [];
        const unselectedNeighbors = neighbors.filter(nid => !this.activeNeighborhoodIds.has(nid));
        if (unselectedNeighbors.length > 0) {
          nearbySection.style.display = "block";
          const baseName = this.getLocalizedName(currentNb);
          const cityName = lang === "en" ? (currentNb.cityName || "Toronto") :
                           lang === "ko" ? (currentNb.cityNameKo || currentNb.cityName || "토론토") :
                           (currentNb.cityNameZh || currentNb.cityName || "多伦多");
          if (lang === "en") {
            nearbyTitle.textContent = `NEARBY ${baseName.toUpperCase()} - ${cityName.toUpperCase()}, ON`;
          } else if (lang === "ko") {
            nearbyTitle.textContent = `인근 추천 지역: ${baseName} - ${cityName}, ON`;
          } else {
            nearbyTitle.textContent = `周边推荐社区: ${baseName} - ${cityName}, ON`;
          }

          let nearbyHtml = "";
          unselectedNeighbors.slice(0, 8).forEach(nid => {
            const nFt = this.getNeighborhoodById(nid);
            if (!nFt) return;
            const label = `${this.getLocalizedName(nFt)}, ON`;
            nearbyHtml += `
              <button type="button" class="popover-pill-btn nearby-pill" data-neighborhood="${nFt.id}">
                + ${this.escapeHtml(label)}
              </button>
            `;
          });
          nearbyPills.innerHTML = nearbyHtml;
        } else {
          nearbySection.style.display = "none";
        }
      } else {
        nearbySection.style.display = "none";
      }
    }

    // 3. City Pills Section
    if (cityContainer) {
      const cities = GTA_COMMUNITIES.filter(c => {
        if (!search) return true;
        const nameStr = `${c.name} ${c.nameEn || ''} ${c.nameZh || ''} ${c.nameKo || ''}`.toLowerCase();
        return nameStr.includes(search);
      });

      const checkIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

      cityContainer.innerHTML = cities.map(c => {
        const isSelected = this.activeCityIds.has(c.id);
        return `
          <button type="button" class="popover-pill-btn ${isSelected ? 'active selected' : ''}" data-city="${c.id}">
            ${isSelected ? checkIcon : '+ '}${this.escapeHtml(this.getLocalizedName(c))}
          </button>
        `;
      }).join("");
    }

    // 4. Neighborhoods & Wards Section
    if (nbContainer) {
      const isAllCity = this.activeCityIds.has("all");
      let candidateNbs = isAllCity
        ? allNbs
        : allNbs.filter(nb => this.activeCityIds.has(nb.parentCityId));

      const titleEl = nbSection?.querySelector(".popover-section-title");
      if (titleEl) {
        const wardsOnly = candidateNbs.length > 0 && candidateNbs.every(nb => nb.boundaryType === "ward");
        titleEl.textContent = wardsOnly
          ? ({ zh: "官方行政选区 (Wards)", en: "Official Wards", ko: "공식 선거구" }[lang] || "官方行政选区 (Wards)")
          : (i18n.t("map_filter_neighborhood") || "社区 / 行政选区");
      }

      if (search) {
        candidateNbs = candidateNbs.filter(nb => {
          const nameStr = `${nb.name} ${nb.nameEn || ''} ${nb.nameZh || ''} ${nb.nameKo || ''}`.toLowerCase();
          return nameStr.includes(search);
        });
      }

      if (candidateNbs.length === 0) {
        if (search) {
          const noMatchText = lang === "en" ? "No matching subareas found" : (lang === "ko" ? "일치하는 지역이 없습니다" : "未找到匹配社区/选区");
          nbContainer.innerHTML = `<span style="font-size: 0.8rem; color: #94a3b8; padding: 0.25rem 0.5rem;">${this.escapeHtml(noMatchText)}</span>`;
          if (nbSection) nbSection.style.display = "block";
        } else if (!isAllCity) {
          if (nbSection) nbSection.style.display = "none";
        }
      } else {
        if (nbSection) nbSection.style.display = "block";
        const checkIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        const displayList = isAllCity && !search ? candidateNbs.slice(0, 50) : candidateNbs;
        nbContainer.innerHTML = displayList.map(nb => {
          const isSelected = this.activeNeighborhoodIds.has(nb.id);
          const label = `${this.getLocalizedName(nb)}, ON`;
          return `
            <button type="button" class="popover-pill-btn ${isSelected ? 'active selected' : ''}" data-neighborhood="${nb.id}">
              ${isSelected ? checkIcon : '+ '}${this.escapeHtml(label)}
            </button>
          `;
        }).join("");
      }
    }
  },

  toggleCity(cityId) {
    this.isViewportSearchMode = false;
    if (cityId === "all") {
      this.activeCityIds = new Set(["all"]);
      this.activeNeighborhoodIds.clear();
    } else {
      this.activeCityIds.delete("all");
      if (this.activeCityIds.has(cityId)) {
        this.activeCityIds.delete(cityId);
      } else {
        this.activeCityIds.add(cityId);
      }
      if (this.activeCityIds.size === 0 && this.activeNeighborhoodIds.size === 0) {
        this.activeCityIds.add("all");
      }
    }
    this.renderPopover();
    this.updateAreaSummaryBtn();
    this.panToSelectedArea();
    this.drawSelectedBoundaries();
    this.saveFilterState();
    this.loadPlacesForCurrentArea();
  },

  removeCity(cityId) {
    this.isViewportSearchMode = false;
    this.activeCityIds.delete(cityId);
    if (this.activeCityIds.size === 0 && this.activeNeighborhoodIds.size === 0) {
      this.activeCityIds.add("all");
    }
    this.renderPopover();
    this.updateAreaSummaryBtn();
    this.panToSelectedArea();
    this.drawSelectedBoundaries();
    this.saveFilterState();
    this.loadPlacesForCurrentArea();
  },

  toggleNeighborhood(nbId) {
    this.isViewportSearchMode = false;
    this.activeCityIds.delete("all");
    if (this.activeNeighborhoodIds.has(nbId)) {
      this.activeNeighborhoodIds.delete(nbId);
    } else {
      this.activeNeighborhoodIds.add(nbId);
    }
    if (this.activeCityIds.size === 0 && this.activeNeighborhoodIds.size === 0) {
      this.activeCityIds.add("all");
    }
    this.renderPopover();
    this.updateAreaSummaryBtn();
    this.panToSelectedArea();
    this.drawSelectedBoundaries();
    this.saveFilterState();
    this.loadPlacesForCurrentArea();
  },

  removeNeighborhood(nbId) {
    this.isViewportSearchMode = false;
    this.activeNeighborhoodIds.delete(nbId);
    if (this.activeCityIds.size === 0 && this.activeNeighborhoodIds.size === 0) {
      this.activeCityIds.add("all");
    }
    this.renderPopover();
    this.updateAreaSummaryBtn();
    this.panToSelectedArea();
    this.drawSelectedBoundaries();
    this.saveFilterState();
    this.loadPlacesForCurrentArea();
  },

  panToSelectedArea() {
    const selectedAreas = this.activeNeighborhoodIds.size > 0
      ? this.getAllNeighborhoods().filter(nb => this.activeNeighborhoodIds.has(nb.id))
      : this.activeCityIds.has("all")
        ? [GTA_COMMUNITIES.find(c => c.id === "scarborough") || GTA_COMMUNITIES[0]]
        : GTA_COMMUNITIES.filter(c => this.activeCityIds.has(c.id));

    if (selectedAreas.length === 0) return;

    if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
      const bounds = new google.maps.LatLngBounds();
      selectedAreas.forEach(area => {
        if (area.bbox && area.bbox.length === 4) {
          bounds.extend({ lat: area.bbox[1], lng: area.bbox[0] });
          bounds.extend({ lat: area.bbox[3], lng: area.bbox[2] });
        } else if (area.center) {
          bounds.extend(area.center);
        }
      });
      this.googleMap.fitBounds(bounds, 30);
    } else if (this.fallbackMap && window.L) {
      const latLngs = [];
      selectedAreas.forEach(area => {
        if (area.bbox && area.bbox.length === 4) {
          latLngs.push([area.bbox[1], area.bbox[0]], [area.bbox[3], area.bbox[2]]);
        } else if (area.center) {
          latLngs.push([area.center.lat, area.center.lng]);
        }
      });
      if (latLngs.length > 0) this.fallbackMap.fitBounds(latLngs, { padding: [30, 30] });
    }
  },

  updateFilterDropdownsLanguage() {},

  // -------------------------------------------------------------
  // Map Context Menu & Helpers
  // -------------------------------------------------------------
  getMapEventCoordinate(latLng) {
    if (!latLng) return null;
    const rawLat = typeof latLng.lat === "function" ? latLng.lat() : latLng.lat;
    const rawLng = typeof latLng.lng === "function" ? latLng.lng() : latLng.lng;
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  },

  getMapContextMenuCopy() {
    const lang = this.getCurrentLanguage();
    if (lang === "en") {
      return {
        title: "Add Area",
        add: (area, kind) => kind === "ward" ? `Add ${area.nameEn || area.name}` : `Add ${area.nameEn || area.name} Neighborhood`,
        matchedNearby: "Matched in nearby recommended wards",
        matchedGlobal: "Matched in all official wards",
        matchedNeighborhood: "No ward polygon here; matched local neighbourhood boundary",
        noWard: "No official ward or neighbourhood covers this point",
        close: "Close"
      };
    }
    if (lang === "ko") {
      return {
        title: "행정 구역 추가",
        add: (area, kind) => kind === "ward" ? `${area.nameKo || area.name} 추가` : `${area.nameKo || area.name} 지역 추가`,
        matchedNearby: "주변 추천 선거구에서 찾음",
        matchedGlobal: "전체 공식 선거구에서 찾음",
        matchedNeighborhood: "선거구 경계가 없어 인근 지역 경계로 찾음",
        noWard: "해당 지점의 공식 선거구 또는 지역을 찾지 못했습니다",
        close: "닫기"
      };
    }
    return {
      title: "添加区划",
      add: (area, kind) => kind === "ward" ? `添加 ${area.nameZh || area.name}` : `添加 ${area.nameZh || area.name}（社区）`,
      matchedNearby: "已在周边推荐选区中匹配",
      matchedGlobal: "已在全部官方选区中匹配",
      matchedNeighborhood: "此处没有 WARD 边界，已匹配到社区边界",
      noWard: "此位置没有覆盖的官方选区或社区",
      close: "关闭"
    };
  },

  hideMapContextMenu() {
    if (this.mapContextMenuEl) {
      this.mapContextMenuEl.remove();
      this.mapContextMenuEl = null;
    }
    this.mapContextMenuPoint = null;
  },

  addNeighborhoodFromMapContext(nbId) {
    const nb = this.getNeighborhoodById(nbId);
    if (!nb) return;
    this.popoverSearchQuery = "";
    const searchInput = document.getElementById("popoverSearchInput");
    if (searchInput) searchInput.value = "";
    if (this.activeCityIds.has("all")) this.activeCityIds.clear();
    if (nb.parentCityId && nb.parentCityId !== "all") this.activeCityIds.add(nb.parentCityId);
    this.activeNeighborhoodIds.add(nb.id);
    this.hideMapContextMenu();
    this.renderPopover();
    this.updateAreaSummaryBtn();
    this.panToSelectedArea();
    this.drawSelectedBoundaries();
    this.saveFilterState();
    this.loadPlacesForCurrentArea();
  },

  showMapContextMenu(lat, lng, clientX, clientY) {
    this.hideMapContextMenu();

    const match = this.findAdministrativeAreaAtCoordinate(lat, lng);
    const copy = this.getMapContextMenuCopy();
    const coordsText = `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
    const coordsHeader = i18n.t("map_context_coords", { coords: coordsText }) || `Coordinates: ${coordsText}`;
    const setOriginText = i18n.t("map_context_set_origin") || "设为路线起点";

    const menu = document.createElement("div");
    menu.className = "map-context-menu";
    menu.setAttribute("role", "menu");
    menu.style.position = "fixed";
    menu.style.left = `${Math.max(8, Number(clientX) || 8)}px`;
    menu.style.top = `${Math.max(8, Number(clientY) || 8)}px`;
    menu.style.zIndex = "9999";
    menu.style.background = "#ffffff";
    menu.style.border = "1px solid #e2e8f0";
    menu.style.borderRadius = "8px";
    menu.style.boxShadow = "0 8px 24px rgba(0,0,0,0.14)";
    menu.style.padding = "6px";
    menu.style.minWidth = "200px";

    let contentHtml = `
      <div style="padding: 6px 10px; font-size: 11px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">
        ${this.escapeHtml(coordsHeader)}
      </div>
    `;

    if (match?.area) {
      const area = match.area;
      const noteText = match.kind === "neighborhood"
        ? copy.matchedNeighborhood
        : (match.source === "nearby" ? copy.matchedNearby : copy.matchedGlobal);
      const actionText = copy.add(area, match.kind);

      contentHtml += `
        <div style="padding: 6px 10px; font-size: 11px; color: #16a34a; font-weight: 500;">
          ${this.escapeHtml(noteText)}
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="mapContextAddArea" style="width: 100%; text-align: left; margin-bottom: 4px; font-size: 12px; padding: 6px 10px;">
          + ${this.escapeHtml(actionText)}
        </button>
      `;
    }

    contentHtml += `
      <button type="button" class="btn btn-secondary btn-sm" id="mapContextSetOrigin" style="width: 100%; text-align: left; margin-top: 2px; font-size: 12px; border: none; padding: 6px 10px;">
        ${this.escapeHtml(setOriginText)}
      </button>
      <button type="button" class="btn btn-sm" id="mapContextClose" style="width: 100%; text-align: left; margin-top: 2px; font-size: 11px; color: #94a3b8; background: transparent; border: none; padding: 4px 10px;">
        ${this.escapeHtml(copy.close)}
      </button>
    `;

    menu.innerHTML = contentHtml;
    document.body.appendChild(menu);
    this.mapContextMenuEl = menu;
    this.mapContextMenuPoint = { lat: Number(lat), lng: Number(lng) };

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) menu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
    if (rect.bottom > window.innerHeight - 8) menu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;

    if (match?.area) {
      const addBtn = menu.querySelector("#mapContextAddArea");
      if (addBtn) {
        addBtn.addEventListener("click", e => {
          e.stopPropagation();
          this.addNeighborhoodFromMapContext(match.area.id);
        });
      }
    }

    const setOriginBtn = menu.querySelector("#mapContextSetOrigin");
    if (setOriginBtn) {
      setOriginBtn.addEventListener("click", () => {
        this.originCoords = { lat: Number(lat), lng: Number(lng) };
        this.originAddress = `${i18n.t("map_coord_prefix") || "Coordinates: "}${coordsText}`;
        const input = document.getElementById("mapRouteOriginInput");
        if (input) input.value = this.originAddress;
        this.updateOriginMarker();
        this.updateRoute();
        this.hideMapContextMenu();
      });
    }

    const closeBtn = menu.querySelector("#mapContextClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hideMapContextMenu());
    }
  },

  setupResizeObserver() {
    const el = document.getElementById("tab-mapexplorer");
    if (!el || typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(el);
  },

  handleResize() {
    if (this.googleMap && window.google && window.google.maps) {
      google.maps.event.trigger(this.googleMap, "resize");
    } else if (this.fallbackMap) {
      this.fallbackMap.invalidateSize();
    }
  },

  // -------------------------------------------------------------
  // Events Binding
  // -------------------------------------------------------------
  bindEvents() {
    // Area Search Popover
    const pillBtn = document.getElementById("areaSearchPillBtn");
    if (pillBtn) {
      pillBtn.addEventListener("click", e => {
        e.stopPropagation();
        this.togglePopover();
      });
    }

    document.addEventListener("click", e => {
      const container = document.getElementById("areaSearchPillContainer");
      if (container && !container.contains(e.target)) {
        this.togglePopover(false);
      }
      if (this.mapContextMenuEl && !this.mapContextMenuEl.contains(e.target)) {
        this.hideMapContextMenu();
      }
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        this.togglePopover(false);
        this.hideMapContextMenu();
        this.closeRouteNavModal();
        const rightCol = document.getElementById("mapExplorerRightColumn");
        const toggleExpandBtn = document.getElementById("mapBtnToggleWaypointsExpand");
        if (rightCol && rightCol.classList.contains("is-expanded")) {
          rightCol.classList.remove("is-expanded");
          if (toggleExpandBtn) {
            const expandIcon = toggleExpandBtn.querySelector(".toggle-icon-expand");
            const collapseIcon = toggleExpandBtn.querySelector(".toggle-icon-collapse");
            if (expandIcon && collapseIcon) {
              expandIcon.style.display = "block";
              collapseIcon.style.display = "none";
            }
            toggleExpandBtn.title = i18n.t("btn_expand_waypoints") || "展开站点列表";
            toggleExpandBtn.setAttribute("data-i18n-title", "btn_expand_waypoints");
          }
        }
      }
    });

    const clearAllBtn = document.getElementById("popoverClearAllBtn");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        this.isViewportSearchMode = false;
        this.activeCityIds = new Set(["all"]);
        this.activeNeighborhoodIds.clear();
        this.renderPopover();
        this.updateAreaSummaryBtn();
        this.panToSelectedArea();
        this.saveFilterState();
        this.loadPlacesForCurrentArea();
      });
    }

    const popoverSearch = document.getElementById("popoverSearchInput");
    if (popoverSearch) {
      popoverSearch.addEventListener("input", e => {
        this.popoverSearchQuery = e.target.value.trim();
        this.renderPopover();
      });
    }

    const cityPillsRow = document.getElementById("popoverCityPills");
    if (cityPillsRow) {
      cityPillsRow.addEventListener("click", e => {
        const btn = e.target.closest(".popover-pill-btn");
        if (!btn || !btn.dataset.city) return;
        this.toggleCity(btn.dataset.city);
      });
    }

    const nbPillsRow = document.getElementById("popoverNeighborhoodPills");
    if (nbPillsRow) {
      nbPillsRow.addEventListener("click", e => {
        const btn = e.target.closest(".popover-pill-btn");
        if (!btn || !btn.dataset.neighborhood) return;
        this.toggleNeighborhood(btn.dataset.neighborhood);
      });
    }

    const resetCenterBtn = document.getElementById("popoverCurrentLocationBtn");
    if (resetCenterBtn) {
      resetCenterBtn.addEventListener("click", () => {
        this.isViewportSearchMode = false;
        this.activeCityIds = new Set(["all"]);
        this.activeNeighborhoodIds.clear();
        this.renderPopover();
        this.updateAreaSummaryBtn();
        this.panToSelectedArea();
        this.saveFilterState();
        this.loadPlacesForCurrentArea();
        this.togglePopover(false);
      });
    }

    // Infinite scroll for left column cards
    const cardsContainer = document.getElementById("mapPlacesCardsContainer");
    if (cardsContainer) {
      cardsContainer.addEventListener("scroll", () => {
        if (cardsContainer.scrollTop + cardsContainer.clientHeight >= cardsContainer.scrollHeight - 80) {
          if (this.googleNextPageToken && !this.isLoadingMore) {
            this.loadMoreGooglePlaces();
          }
        }
      }, { passive: true });
    }

    // Category Select
    const catSelect = document.getElementById("mapCategorySelect");
    if (catSelect) {
      catSelect.addEventListener("change", e => {
        this.activeCategory = e.target.value;
        this.saveFilterState();
        this.filterAndRenderPlaces();
      });
    }

    // Search Keyword
    const searchInput = document.getElementById("mapKeywordInput");
    const searchBtn = document.getElementById("mapBtnSearchGmap");
    const doSearch = () => {
      this.isViewportSearchMode = false;
      this.searchKeyword = searchInput ? searchInput.value.trim() : "";
      this.saveFilterState();
      this.loadPlacesForCurrentArea();
    };

    if (searchBtn) searchBtn.addEventListener("click", doSearch);
    if (searchInput) {
      searchInput.addEventListener("keydown", e => {
        if (e.key === "Enter") doSearch();
      });
    }

    // Left column: + 全部加入路线
    const addAllBtn = document.getElementById("mapBtnAddAllToRoute");
    if (addAllBtn) {
      addAllBtn.addEventListener("click", () => this.addAllToRoute());
    }

    // Middle column: Fit route bounds
    const fitRouteBtn = document.getElementById("mapBtnFitRoute");
    if (fitRouteBtn) {
      fitRouteBtn.addEventListener("click", () => this.fitRouteToBounds());
    }

    // Middle column: Toggle route mode
    const toggleRouteBtn = document.getElementById("mapBtnToggleRoute");
    if (toggleRouteBtn) {
      toggleRouteBtn.addEventListener("click", () => {
        this.isRouteMode = !this.isRouteMode;
        const label = document.getElementById("mapRouteToggleLabel");
        if (label) label.textContent = this.isRouteMode ? (i18n.t("map_route_status_active") || "规划中") : (i18n.t("map_route_status_paused") || "已暂停");
        toggleRouteBtn.style.background = this.isRouteMode ? "#2563eb" : "#64748b";
        toggleRouteBtn.style.borderColor = this.isRouteMode ? "#2563eb" : "#64748b";
      });
    }

    // Right column: Origin input change
    const originInput = document.getElementById("mapRouteOriginInput");
    if (originInput) {
      originInput.addEventListener("change", e => {
        this.originAddress = e.target.value.trim();
        this.saveRouteWaypoints();
        this.updateRoute();
      });
      originInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          this.originAddress = e.target.value.trim();
          this.saveRouteWaypoints();
          this.updateRoute();
        }
      });
    }

    // Right column: Optimize route
    const optBtn = document.getElementById("mapBtnOptimizeRoute");
    if (optBtn) {
      optBtn.addEventListener("click", () => this.optimizeRoute());
    }

    // Right column: Import waypoints
    const importBtn = document.getElementById("mapBtnImportWaypoints");
    if (importBtn) {
      importBtn.addEventListener("click", () => this.openImportModal());
    }

    // Right column: Export waypoints
    const exportBtn = document.getElementById("mapBtnExportWaypoints");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportWaypoints());
    }

    // Right column: Clear route
    const clearRouteBtn = document.getElementById("mapBtnClearRoute");
    if (clearRouteBtn) {
      clearRouteBtn.addEventListener("click", () => this.clearRoute());
    }

    // Right column: Search waypoints
    const wpSearchInput = document.getElementById("mapWaypointsSearchInput");
    const wpSearchClear = document.getElementById("mapWaypointsSearchClear");
    if (wpSearchInput) {
      wpSearchInput.addEventListener("input", e => {
        this.waypointSearchKeyword = e.target.value;
        if (wpSearchClear) wpSearchClear.style.display = e.target.value ? "block" : "none";
        this.renderWaypoints();
      });
    }
    if (wpSearchClear) {
      wpSearchClear.addEventListener("click", () => {
        if (wpSearchInput) wpSearchInput.value = "";
        this.waypointSearchKeyword = "";
        wpSearchClear.style.display = "none";
        this.renderWaypoints();
      });
    }

    // Right column: Batch actions
    const selectAllCb = document.getElementById("mapWaypointsSelectAll");
    if (selectAllCb) {
      selectAllCb.addEventListener("change", e => this.toggleSelectAllWaypoints(e.target.checked));
    }
    const lockBtn = document.getElementById("mapBtnLockWaypoints");
    if (lockBtn) {
      lockBtn.addEventListener("click", () => this.lockSelectedWaypoints());
    }
    const unlockBtn = document.getElementById("mapBtnUnlockWaypoints");
    if (unlockBtn) {
      unlockBtn.addEventListener("click", () => this.unlockSelectedWaypoints());
    }
    const batchDeleteBtn = document.getElementById("mapBtnBatchDeleteWaypoints");
    if (batchDeleteBtn) {
      batchDeleteBtn.addEventListener("click", () => this.deleteSelectedWaypoints());
    }

    // Right column: Route Group Tabs Actions
    const newTabBtn = document.getElementById("mapRouteBtnNewTab");
    if (newTabBtn) {
      newTabBtn.addEventListener("click", () => this.newRouteGroup());
    }
    const renameTabBtn = document.getElementById("mapRouteBtnRenameTab");
    if (renameTabBtn) {
      renameTabBtn.addEventListener("click", () => this.renameRouteGroup(this.activeGroupId));
    }
    const dupTabBtn = document.getElementById("mapRouteBtnDuplicateTab");
    if (dupTabBtn) {
      dupTabBtn.addEventListener("click", () => this.duplicateRouteGroup(this.activeGroupId));
    }
    const deleteTabBtn = document.getElementById("mapRouteBtnDeleteTab");
    if (deleteTabBtn) {
      deleteTabBtn.addEventListener("click", () => this.deleteRouteGroup(this.activeGroupId));
    }

    // Right column: Toggle Expand/Collapse Wide Overlay Mode
    const toggleExpandBtn = document.getElementById("mapBtnToggleWaypointsExpand");
    const rightCol = document.getElementById("mapExplorerRightColumn");
    if (toggleExpandBtn && rightCol) {
      toggleExpandBtn.addEventListener("click", () => {
        const isExpanded = rightCol.classList.toggle("is-expanded");
        const expandIcon = toggleExpandBtn.querySelector(".toggle-icon-expand");
        const collapseIcon = toggleExpandBtn.querySelector(".toggle-icon-collapse");
        if (expandIcon && collapseIcon) {
          expandIcon.style.display = isExpanded ? "none" : "block";
          collapseIcon.style.display = isExpanded ? "block" : "none";
        }
        const titleKey = isExpanded ? "btn_collapse_waypoints" : "btn_expand_waypoints";
        const titleText = i18n.t(titleKey) || (isExpanded ? "收起站点列表" : "展开站点列表");
        toggleExpandBtn.title = titleText;
        toggleExpandBtn.setAttribute("data-i18n-title", titleKey);
      });
    }

    // Import modal event bindings
    const importModalClose = document.getElementById("mapWaypointImportModalClose");
    const importModalCancel = document.getElementById("mapWaypointImportModalCancel");
    const importModalSubmit = document.getElementById("mapWaypointImportModalSubmit");
    const importTabBtnText = document.getElementById("mapImportTabBtnText");
    const importTabBtnFile = document.getElementById("mapImportTabBtnFile");
    const importDropZone = document.getElementById("mapImportDropZone");
    const importFileInput = document.getElementById("mapImportFileInput");
    const importFileStatus = document.getElementById("mapImportFileStatus");

    if (importModalClose) importModalClose.addEventListener("click", () => this.closeImportModal());
    if (importModalCancel) importModalCancel.addEventListener("click", () => this.closeImportModal());
    if (importTabBtnText) importTabBtnText.addEventListener("click", () => this.switchImportTab("text"));
    if (importTabBtnFile) importTabBtnFile.addEventListener("click", () => this.switchImportTab("file"));
    if (importModalSubmit) importModalSubmit.addEventListener("click", () => this.handleImportSubmit());

    if (importDropZone && importFileInput) {
      importDropZone.addEventListener("click", () => importFileInput.click());
      importDropZone.addEventListener("dragover", e => {
        e.preventDefault();
        importDropZone.style.borderColor = "#0f766e";
        importDropZone.style.background = "#f0fdfa";
      });
      importDropZone.addEventListener("dragleave", () => {
        importDropZone.style.borderColor = "#cbd5e1";
        importDropZone.style.background = "#f8fafc";
      });
      importDropZone.addEventListener("drop", e => {
        e.preventDefault();
        importDropZone.style.borderColor = "#cbd5e1";
        importDropZone.style.background = "#f8fafc";
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          importFileInput.files = e.dataTransfer.files;
          if (importFileStatus) {
            importFileStatus.textContent = `已选择文件: ${e.dataTransfer.files[0].name}`;
            importFileStatus.style.display = "block";
          }
        }
      });
      importFileInput.addEventListener("change", () => {
        if (importFileInput.files && importFileInput.files.length > 0 && importFileStatus) {
          importFileStatus.textContent = `已选择文件: ${importFileInput.files[0].name}`;
          importFileStatus.style.display = "block";
        }
      });
    }

    // Right column: External navigation
    const extNavBtn = document.getElementById("mapBtnExternalNav");
    if (extNavBtn) {
      extNavBtn.addEventListener("click", () => this.openGoogleMapsNavigation());
    }

    // Nav Modal Close buttons
    const navModalClose = document.getElementById("fsRouteNavModalClose");
    const navModalCancel = document.getElementById("fsRouteNavModalBtnCancel");
    if (navModalClose) navModalClose.addEventListener("click", () => this.closeRouteNavModal());
    if (navModalCancel) navModalCancel.addEventListener("click", () => this.closeRouteNavModal());

    // Flush pending route save before page unloads
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        if (this._saveDebounceTimer) {
          clearTimeout(this._saveDebounceTimer);
          this._saveDebounceTimer = null;
          this._pushRouteWaypointsToBackend();
        }
      });
    }
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[m]);
  },

  escapeQuotes(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "\'").replace(/"/g, "&quot;");
  },

  formatPrice(price) {
    if (i18n && typeof i18n.formatPrice === "function") {
      return i18n.formatPrice(price);
    }
    return price || "$$";
  },

  formatCategory(cat) {
    if (i18n && typeof i18n.formatCategory === "function") {
      return i18n.formatCategory(cat);
    }
    return cat || "-";
  }
};

// Global Window Helpers
if (typeof window !== "undefined") {
  window.MapExplorer = MapExplorer;

  window.mapExplorerHighlight = function(key, highlight) {
    MapExplorer.highlightMarker(key, highlight);
  };

  window.mapExplorerCardClick = function(key) {
    const r = MapExplorer.findPlace(key);
    if (!r) return;
    const lat = parseFloat(r.latitude);
    const lng = parseFloat(r.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      if (MapExplorer.googleMap && !MapExplorer.isFallbackMode) {
        MapExplorer.googleMap.panTo({ lat, lng });
        let marker = MapExplorer.markersMap.get(key);
        if (marker) MapExplorer.showInfoWindow(r, marker);
      } else if (MapExplorer.fallbackMap) {
        MapExplorer.fallbackMap.setView([lat, lng], 16);
      }
    }
    MapExplorer.scrollCardIntoView(key);
    MapExplorer.scrollWaypointCardIntoView(key);
  };

  window.mapExplorerWaypointClick = function(key, index) {
    const w = MapExplorer.routeWaypoints[index] || MapExplorer.findPlace(key);
    if (!w) return;
    const lat = parseFloat(w.latitude);
    const lng = parseFloat(w.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      if (MapExplorer.googleMap && !MapExplorer.isFallbackMode) {
        MapExplorer.googleMap.panTo({ lat, lng });
        let marker = MapExplorer.markersMap.get(key);
        if (marker) MapExplorer.showInfoWindow(w, marker);
      } else if (MapExplorer.fallbackMap) {
        MapExplorer.fallbackMap.setView([lat, lng], 16);
      }
    }
    MapExplorer.scrollWaypointCardIntoView(key);
    MapExplorer.scrollCardIntoView(key);
  };

  window.mapExplorerToggleSelectWaypoint = function(key, checked) {
    MapExplorer.toggleSelectWaypoint(key, checked);
  };

  window.mapExplorerAddSingleToRoute = function(key) {
    const r = MapExplorer.findPlace(key);
    if (!r) return;
    MapExplorer.addWaypointToRoute(r);
  };

  window.mapExplorerRemoveSingleFromRoute = function(key) {
    MapExplorer.removeWaypointFromRoute(key);
  };

  window.mapExplorerRemoveWaypoint = function(index) {
    MapExplorer.removeWaypointFromRoute(index);
  };

  window.mapExplorerMoveWaypoint = function(index, delta) {
    MapExplorer.moveWaypoint(index, delta);
  };

  window.mapExplorerLockWaypoints = function() {
    MapExplorer.lockSelectedWaypoints();
  };

  window.mapExplorerUnlockWaypoints = function() {
    MapExplorer.unlockSelectedWaypoints();
  };

  window.mapExplorerOpenNav = function(name, address) {
    const q = encodeURIComponent(`${name} ${address}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  window.mapExplorerGoToPage = function(p) {
    MapExplorer.goToPage(p);
  };

  window.mapExplorerRemoveCity = function(cityId) {
    MapExplorer.removeCity(cityId);
  };

  window.mapExplorerRemoveNeighborhood = function(nbId) {
    MapExplorer.removeNeighborhood(nbId);
  };

  window.mapExplorerSearchThisArea = function() {
    MapExplorer.searchPlacesInCurrentBounds();
  };

  window.mapExplorerLoadMore = function() {
    MapExplorer.loadMoreGooglePlaces();
  };

  window.mapExplorerDeepSearch = function() {
    MapExplorer.deepSearchGooglePlaces();
  };
}
