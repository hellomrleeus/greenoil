/**
 * Green Oil Map Explorer (地图找店)
 * Embedded Google Maps with GTA Communities, Exact Geometric Polygon Boundaries,
 * Google Places Discovery & Live Cloudflare KV Matching,
 * Apartments.com-style Left-Right Split Screen, Floating Area Popover,
 * and Synchronized Card-to-Marker Hover & Scroll Highlighting.
 *
 * Terms of Service: Subject to Google Maps Platform Terms of Service:
 * https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_git_agentskills_v1
 */

import { displayGeometry } from "./map-geometry.js";

import { Api } from "./api.js";
import { i18n } from "./i18n.js";

/// GTA Region / City Hierarchy
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

export const MapExplorer = {
  isInitialized: false,
  googleMap: null,
  placesService: null,
  markersMap: new Map(), // key -> Google Marker or Leaflet Marker
  infoWindow: null,
  allRestaurants: [],
  displayedPlaces: [],
  filteredPlaces: [],
  selectedMap: new Map(), // key -> Restaurant
  poiPlaces: new Map(),
  activePopupKey: null,
  poiRequestId: 0,
  googlePhotosCache: new Map(), // placeId -> Google Places photo URL
  googleApiKey: "",
  mapContextMenuEl: null,
  mapContextMenuPoint: null,

  // GeoJSON Municipal Boundaries Dataset & Hash Map Index
  neighbourhoodsGeoJson: null,
  neighbourhoodsMap: new Map(),

  // Fallback map state
  isFallbackMode: false,
  fallbackMap: null,
  fallbackLayerGroup: null,

  // KV Identification Tracking Sets
  kvPlaceIdsSet: new Set(),
  kvNormalizedNamesSet: new Set(),
  
  // Filter States (Locality / Cities Multi-Select & Neighborhoods)
  // Start the map explorer in Vaughan and load only Vaughan restaurants.
  // Users can still choose All GTA from the area popover when needed.
  activeCityIds: new Set(["vaughan"]),
  activeNeighborhoodIds: new Set(),
  polygonsMap: new Map(), // Boundary polygons
  activeCategory: "全部",
  activeVisited: "all", // "all", "visited", "unvisited"
  activeOutcome: "all",
  searchKeyword: "",
  popoverSearchQuery: "",
  resizeObserver: null,

  // Pagination for right list
  currentPage: 1,
  pageSize: 20,

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.googleApiKey = await Api.getGoogleMapsApiKey();

    // 1. Load official GTA municipal GeoJSON boundaries dataset
    await this.loadNeighbourhoodsGeoJson();

    this.setupAuthFailureHandler();
    this.bindEvents();
    this.setupResizeObserver();
    this.renderPopover();
    this.updateAreaSummaryBtn();
    this.updateFilterDropdownsLanguage();

    const onLangChangeHandler = () => {
      this.updateAreaSummaryBtn();
      this.renderPopover();
      this.updateResultsSummary();
      this.updateFilterDropdownsLanguage();
      this.renderPlacesCards();
    };

    if (i18n && typeof i18n.onLanguageChange === "function") {
      i18n.onLanguageChange(onLangChangeHandler);
    }
    if (typeof window !== "undefined" && window.i18n && typeof window.i18n.onLanguageChange === "function" && window.i18n !== i18n) {
      window.i18n.onLanguageChange(onLangChangeHandler);
    }

    // 1. Fetch Google Maps API Key and initialize map
    await this.initGoogleMap();


    // 3. Fit the initial Vaughan selection and load only its restaurants.
    // Explicit city/ward changes use the same pan-and-load path.
    const hasExplicitInitialArea = !(this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0);
    if (hasExplicitInitialArea) this.panToSelectedArea();
    await this.loadPlacesForCurrentArea();
  },

  setupAuthFailureHandler() {
    window.gm_authFailure = () => {
      console.warn("Google Maps JavaScript API error (ApiNotActivatedMapError / authFailure). Switching to resilient fallback interactive map.");
      this.triggerFallbackMode();
    };
  },

  triggerFallbackMode() {
    if (this.isFallbackMode) return;
    this.isFallbackMode = true;

    const noticeEl = document.getElementById("mapApiNotice");
    if (noticeEl) {
      noticeEl.style.display = "block";
    }

    this.initFallbackMap();
  },

  checkIsInKv(r) {
    if (!r) return false;
    if (r.inKV === true) return true;
    if (r.placeId && this.kvPlaceIdsSet.has(r.placeId)) return true;
    const norm = (r.name || "").trim().toLowerCase();
    if (norm && this.kvNormalizedNamesSet.has(norm)) return true;
    return false;
  },

  areaLoadId: 0,
  areaAbort: null,
  mapQueryTimer: null,
  mapQueryPage: 0,
  mapQueryTotal: 0,
  mapQueryHasMore: false,
  mapQueryLoading: false,
  mapQueryBbox: null,
  googleAreaPlaces: [],
  googleSearchId: 0,

  getQueryBounds() {
    // The selected city/subarea defines the result set. Map panning only changes
    // the camera and must not trigger a second query for the same fixed area.
    const subareas = this.getAllNeighborhoods().filter(n => this.activeNeighborhoodIds.has(n.id));
    const areas = subareas.length ? subareas : GTA_COMMUNITIES.filter(c => c.id !== "all" && (this.activeCityIds.has("all") || this.activeCityIds.has(c.id)));
    const boxes = areas.map(a => a.bbox).filter(b => Array.isArray(b) && b.length === 4);
    if (boxes.length) {
      return [Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
    }
    return [-79.72,43.58,-79.16,43.95];
  },

  scheduleViewportQuery() {
    // Kept as a no-op for callers from older cached bundles. Viewport changes
    // intentionally never reload the selected-area result set.
  },

  async loadMoreMapRestaurants() {
    if (this.mapQueryLoading || !this.mapQueryHasMore) return;
    const requestId = this.areaLoadId;
    this.mapQueryLoading = true;
    try {
      const result = await Api.getMapRestaurants({bbox:this.mapQueryBbox,page:this.mapQueryPage+1,category:this.activeCategory,keyword:this.searchKeyword,visited:this.activeVisited,outcome:this.activeOutcome,signal:this.areaAbort?.signal});
      if (requestId !== this.areaLoadId) return;
      this.mapQueryPage = result.page;
      this.mapQueryTotal = result.total;
      this.mapQueryHasMore = result.page < result.totalPages;
      result.data.forEach(r => {
        r.inKV = true;
        if (r.placeId) this.kvPlaceIdsSet.add(r.placeId);
        if (r.name) this.kvNormalizedNamesSet.add(r.name.trim().toLowerCase());
      });
      this.allRestaurants.push(...result.data);
      this.mergeAreaPlaces();
    } catch (error) {
      if (error.name !== "AbortError") {
        console.warn(error);
        if (window.showToast) window.showToast("餐馆加载失败，请重试");
      }
    } finally {
      if (requestId === this.areaLoadId) this.mapQueryLoading = false;
    }
  },

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
    } catch (e) {
      console.warn("Failed to load official_municipalities.json:", e);
    }

    try {
      const resp = await fetch("assets/data/gta_neighbourhoods.json");
      if (resp.ok) {
        this.neighbourhoodsGeoJson = await resp.json();
      }
    } catch (e) {
      console.warn("Failed to load gta_neighbourhoods.json dataset:", e);
    }

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
    } catch (e) {
      console.warn("Failed to load official_subareas.json:", e);
    }

    if (this.neighbourhoodsGeoJson && Array.isArray(this.neighbourhoodsGeoJson.features)) {
      this.neighbourhoodsGeoJson.totalCount = this.neighbourhoodsGeoJson.features.length;
      this.neighbourhoodsMap.clear();
      this.neighbourhoodsGeoJson.features.forEach(ft => {
        if (ft.id) this.neighbourhoodsMap.set(ft.id, ft);
        if (ft.code) this.neighbourhoodsMap.set(ft.code, ft);
      });
    }
  },

  // -------------------------------------------------------------
  // Popover Panel UI Management (Apartments.com inspired)
  // -------------------------------------------------------------
  togglePopover(forceState) {
    const panel = document.getElementById("areaPopoverPanel");
    if (!panel) return;
    const isOpen = panel.style.display === "block";
    const newState = forceState !== undefined ? forceState : !isOpen;
    panel.style.display = newState ? "block" : "none";
    if (newState) {
      this.renderPopover();
      const searchInput = document.getElementById("popoverSearchInput");
      if (searchInput) searchInput.focus();
    }
  },

  getCurrentLanguage() {
    if (i18n && typeof i18n.getLanguage === "function") return i18n.getLanguage();
    if (typeof window !== "undefined" && window.i18n && typeof window.i18n.getLanguage === "function") return window.i18n.getLanguage();
    return "zh";
  },

  getLocalizedName(item) {
    if (!item) return "";
    const lang = this.getCurrentLanguage();
    if (lang === "en") {
      return item.nameEn || item.name.split(" (")[0];
    }
    if (lang === "ko") {
      return item.nameKo || item.nameEn || item.name.split(" (")[0];
    }
    return item.nameZh || item.name.split(" (")[0];
  },

  getLocalizedAllGta() {
    const lang = this.getCurrentLanguage();
    if (lang === "en") return "All GTA";
    if (lang === "ko") return "광역 토론토 전체";
    return "全部大区 (All GTA)";
  },

  getAllNeighborhoods() {
    if (this.neighbourhoodsGeoJson && Array.isArray(this.neighbourhoodsGeoJson.features)) {
      return this.neighbourhoodsGeoJson.features.map(ft => ({
        id: ft.id,
        code: ft.code,
        name: ft.name,
        nameZh: ft.nameZh || ft.name,
        nameEn: ft.nameEn || ft.name,
        nameKo: ft.nameKo || ft.name,
        boundaryType: ft.boundaryType || "neighbourhood",
        cityId: ft.cityId,
        cityName: ft.cityName,
        cityNameZh: ft.cityNameZh,
        cityNameKo: ft.cityNameKo,
        center: ft.center,
        bbox: ft.bbox,
        geometry: ft.geometry,
        neighbors: ft.neighbors || [],
        parentCityId: ft.cityId,
        parentCityName: ft.cityName
      }));
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
      return {
        id: ft.id,
        code: ft.code,
        name: ft.name,
        nameZh: ft.nameZh || ft.name,
        nameEn: ft.nameEn || ft.name,
        nameKo: ft.nameKo || ft.name,
        boundaryType: ft.boundaryType || "neighbourhood",
        cityId: ft.cityId,
        cityName: ft.cityName,
        cityNameZh: ft.cityNameZh,
        cityNameKo: ft.cityNameKo,
        center: ft.center,
        bbox: ft.bbox,
        geometry: ft.geometry,
        neighbors: ft.neighbors || [],
        parentCityId: ft.cityId,
        parentCityName: ft.cityName
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

  /**
   * Return the official ward that contains a coordinate. Neighbouring wards
   * referenced by the currently selected subareas are checked first so a
   * right-click near the current selection remains fast and predictable.
   */
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
    // When only a city is selected, its own wards are the natural nearby set.
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
    // Toronto's current official dataset contains neighbourhood polygons but
    // no ward polygons. Fall back to those boundaries so a valid click still
    // produces a useful filter instead of reporting "no area".
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

    // "All GTA" is represented by its broad GTA bounding box. This keeps
    // context menus from appearing over other GTA municipalities that are not
    // part of the smaller official boundary dataset.
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

  getMapEventCoordinate(latLng) {
    if (!latLng) return null;
    const lat = typeof latLng.lat === "function" ? latLng.lat() : latLng.lat;
    const lng = typeof latLng.lng === "function" ? latLng.lng() : latLng.lng;
    const coordinate = { lat: Number(lat), lng: Number(lng) };
    return Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng) ? coordinate : null;
  },

  getMapContextMenuCopy() {
    const lang = this.getCurrentLanguage();
    if (lang === "en") {
      return {
        title: "Add area",
        add: (area, kind) => kind === "ward" ? `Add ${area.nameEn || area.name}` : `Add ${area.nameEn || area.name} neighborhood`,
        matchedNearby: "Matched in nearby recommended wards",
        matchedGlobal: "Matched in all official wards",
        matchedNeighborhood: "No ward polygon here; matched the local neighbourhood boundary",
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
    this.loadPlacesForCurrentArea();
  },

  showMapContextMenu(lat, lng, clientX, clientY) {
    this.hideMapContextMenu();
    if (this.isCoordinateInsideSelectedArea(lat, lng)) return;

    const match = this.findAdministrativeAreaAtCoordinate(lat, lng);
    const copy = this.getMapContextMenuCopy();
    const menu = document.createElement("div");
    menu.className = "map-context-menu";
    menu.setAttribute("role", "menu");
    menu.style.left = `${Math.max(8, Number(clientX) || 8)}px`;
    menu.style.top = `${Math.max(8, Number(clientY) || 8)}px`;

    const title = document.createElement("div");
    title.className = "map-context-menu-title";
    title.textContent = copy.title;
    menu.appendChild(title);

    if (match?.area) {
      const area = match.area;
      const note = document.createElement("div");
      note.className = "map-context-menu-note";
      note.textContent = match.kind === "neighborhood"
        ? copy.matchedNeighborhood
        : (match.source === "nearby" ? copy.matchedNearby : copy.matchedGlobal);
      menu.appendChild(note);

      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "map-context-menu-action";
      addButton.setAttribute("role", "menuitem");
      addButton.textContent = copy.add(area, match.kind);
      addButton.addEventListener("click", event => {
        event.stopPropagation();
        this.addNeighborhoodFromMapContext(area.id);
      });
      menu.appendChild(addButton);
    } else {
      const empty = document.createElement("div");
      empty.className = "map-context-menu-note";
      empty.textContent = copy.noWard;
      menu.appendChild(empty);
    }

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "map-context-menu-close";
    closeButton.setAttribute("role", "menuitem");
    closeButton.textContent = copy.close;
    closeButton.addEventListener("click", () => this.hideMapContextMenu());
    menu.appendChild(closeButton);

    document.body.appendChild(menu);
    this.mapContextMenuEl = menu;
    this.mapContextMenuPoint = { lat: Number(lat), lng: Number(lng) };
    const rect = menu.getBoundingClientRect?.();
    if (rect) {
      if (rect.right > window.innerWidth - 8) menu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
      if (rect.bottom > window.innerHeight - 8) menu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
    }
  },

  updateAreaSummaryBtn() {
    const summaryEl = document.getElementById("areaActiveTagsSummary");
    if (!summaryEl) return;

    const lang = this.getCurrentLanguage();

    const isAll = this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0;
    const selectedCities = GTA_COMMUNITIES.filter(c => c.id !== "all" && this.activeCityIds.has(c.id));
    const allNbs = this.getAllNeighborhoods();
    const selectedNbs = allNbs.filter(nb => this.activeNeighborhoodIds.has(nb.id));

    const selected = selectedNbs.length ? selectedNbs : selectedCities;
    const labels = selected.length ? selected.map(item => this.getLocalizedName(item)) : [this.getLocalizedAllGta()];
    summaryEl.innerHTML = labels.map(label => `<span class="area-tag-pill active">${this.escapeHtml(label)}</span>`).join("");
  },

  renderPopover() {
    const lang = this.getCurrentLanguage();
    const isAll = this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0;
    const selectedCities = GTA_COMMUNITIES.filter(c => c.id !== "all" && this.activeCityIds.has(c.id));
    const allNbs = this.getAllNeighborhoods();
    const selectedNbs = allNbs.filter(nb => this.activeNeighborhoodIds.has(nb.id));

    // 1. Render Active Tags Row
    const tagsRow = document.getElementById("popoverActiveTagsRow");
    if (tagsRow) {
      let html = "";
      if (isAll || (selectedCities.length === 0 && selectedNbs.length === 0)) {
        html = `<span class="area-tag-pill active">${this.escapeHtml(this.getLocalizedAllGta())}</span>`;
      } else {
        const removeAreaTitle = lang === "en" ? "Remove area" : (lang === "ko" ? "구역 삭제" : "移除此区划");
        const removeNbTitle = lang === "en" ? "Remove neighborhood" : (lang === "ko" ? "지역 삭제" : "移除此社区");

        // Render city tags
        const cityTags = selectedCities.map(c => `
          <span class="area-tag-pill active" data-city-id="${c.id}">
            ${this.escapeHtml(this.getLocalizedName(c))}
            <span class="tag-remove" onclick="event.stopPropagation(); window.mapExplorerRemoveCity('${c.id}');" title="${removeAreaTitle}">✕</span>
          </span>
        `).join("");

        // Render neighborhood tags
        const nbTags = selectedNbs.map(nb => {
          const localizedName = this.getLocalizedName(nb);
          const tagLabel = `${localizedName}, ON`;
          return `
            <span class="area-tag-pill active" data-nb-id="${nb.id}">
              ${this.escapeHtml(tagLabel)}
              <span class="tag-remove" onclick="event.stopPropagation(); window.mapExplorerRemoveNeighborhood('${nb.id}');" title="${removeNbTitle}">✕</span>
            </span>
          `;
        }).join("");

        html = cityTags + nbTags;
      }
      tagsRow.innerHTML = html;
    }

    // 2. Render Nearby Neighborhoods Section (Apartments.com style)
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

    const q = (this.popoverSearchQuery || "").toLowerCase();

    // 3. Render Cities Pills (Administrative Locality)
    const cityPillsRow = document.getElementById("popoverCityPills");
    if (cityPillsRow) {
      let html = "";
      GTA_COMMUNITIES.forEach(c => {
        const titleZh = c.nameZh || c.name || "";
        const titleEn = c.nameEn || "";
        const titleKo = c.nameKo || "";
        if (q && !titleZh.toLowerCase().includes(q) && !titleEn.toLowerCase().includes(q) && !titleKo.toLowerCase().includes(q)) return;
        const isActive = this.activeCityIds.has(c.id);
        const localizedLabel = this.getLocalizedName(c);
        html += `
          <button type="button" class="popover-pill-btn ${isActive ? 'active' : ''}" data-city="${c.id}">
            ${isActive ? '✓ ' : '+ '}${this.escapeHtml(localizedLabel)}
          </button>
        `;
      });
      cityPillsRow.innerHTML = html;
    }

    // 4. Render Neighborhoods Pills (Sub-districts / Official Municipal Boundaries)
    const nbPillsRow = document.getElementById("popoverNeighborhoodPills");
    const nbSection = document.getElementById("popoverNeighborhoodSection");
    if (nbPillsRow) {
      const isAllCity = this.activeCityIds.has("all");
      const candidateNbs = isAllCity ? allNbs : allNbs.filter(nb => this.activeCityIds.has(nb.parentCityId));
      const title = nbSection?.querySelector(".popover-section-title");
      if (title) {
        const wardsOnly = candidateNbs.length && candidateNbs.every(nb => nb.boundaryType === "ward");
        title.textContent = wardsOnly ? ({zh:"官方行政选区 (Wards)",en:"Official wards",ko:"공식 선거구"}[lang]) : i18n.t("map_filter_neighborhood");
      }

      let html = "";
      candidateNbs.forEach(nb => {
        const titleZh = nb.nameZh || nb.name || "";
        const titleEn = nb.nameEn || "";
        const titleKo = nb.nameKo || "";
        const kwMatch = Array.isArray(nb.keywords) && nb.keywords.some(k => k.toLowerCase().includes(q));
        if (q && !titleZh.toLowerCase().includes(q) && !titleEn.toLowerCase().includes(q) && !titleKo.toLowerCase().includes(q) && !kwMatch) return;

        const isActive = this.activeNeighborhoodIds.has(nb.id);
        const localizedLabel = `${this.getLocalizedName(nb)}, ON`;
        html += `
          <button type="button" class="popover-pill-btn ${isActive ? 'active' : ''}" data-neighborhood="${nb.id}">
            ${isActive ? '✓ ' : '+ '}${this.escapeHtml(localizedLabel)}
          </button>
        `;
      });

      if (candidateNbs.length === 0) {
        if (nbSection) nbSection.style.display = "none";
      } else {
        if (nbSection) nbSection.style.display = "block";
        const noMatchText = lang === "en" ? "No matching neighborhoods found" : (lang === "ko" ? "일치하는 지역이 없습니다" : "未找到匹配社区");
        nbPillsRow.innerHTML = html || `<span style="font-size: 0.8rem; color: var(--text-muted); padding: 0.25rem 0.5rem;">${noMatchText}</span>`;
      }
    }
  },

  updateFilterDropdownsLanguage() {
    const lang = this.getCurrentLanguage();

    // 1. Visited status select
    const visitedSelect = document.getElementById("mapVisitedSelect");
    if (visitedSelect) {
      const cur = visitedSelect.value;
      if (lang === "en") {
        visitedSelect.options[0].text = "Visited Status (All)";
        visitedSelect.options[1].text = "Visited";
        visitedSelect.options[2].text = "Unvisited";
      } else if (lang === "ko") {
        visitedSelect.options[0].text = "방문 여부 (전체)";
        visitedSelect.options[1].text = "방문 완료";
        visitedSelect.options[2].text = "미방문";
      } else {
        visitedSelect.options[0].text = "是否拜访 (全部)";
        visitedSelect.options[1].text = "已拜访";
        visitedSelect.options[2].text = "未拜访";
      }
      visitedSelect.value = cur;
    }

    // 2. Outcome select
    const outcomeSelect = document.getElementById("mapOutcomeSelect");
    if (outcomeSelect) {
      const cur = outcomeSelect.value;
      if (lang === "en") {
        outcomeSelect.options[0].text = "Visit Outcome (All)";
        outcomeSelect.options[1].text = "Contract Signed";
        outcomeSelect.options[2].text = "Interested";
        outcomeSelect.options[3].text = "Considering";
        outcomeSelect.options[4].text = "Not Interested";
        outcomeSelect.options[5].text = "Declined";
        outcomeSelect.options[6].text = "Closed / Shut down";
      } else if (lang === "ko") {
        outcomeSelect.options[0].text = "방문 결과 (전체)";
        outcomeSelect.options[1].text = "계약 완료";
        outcomeSelect.options[2].text = "관심 있음";
        outcomeSelect.options[3].text = "고려 중";
        outcomeSelect.options[4].text = "관심 없음";
        outcomeSelect.options[5].text = "거절";
        outcomeSelect.options[6].text = "폐업/영업종료";
      } else {
        outcomeSelect.options[0].text = "拜访结果 (全部)";
        outcomeSelect.options[1].text = "签订合同";
        outcomeSelect.options[2].text = "有意向";
        outcomeSelect.options[3].text = "考虑中";
        outcomeSelect.options[4].text = "暂无意向";
        outcomeSelect.options[5].text = "拒绝合作";
        outcomeSelect.options[6].text = "已打烊/关店";
      }
      outcomeSelect.value = cur;
    }

    // 3. Category select
    const catSelect = document.getElementById("mapCategorySelect");
    if (catSelect) {
      const cur = catSelect.value;
      if (lang === "en") {
        catSelect.options[0].text = "All Categories";
        catSelect.options[1].text = "Chinese / Taiwanese Fried";
        catSelect.options[2].text = "Western Fried Chicken / Fast Food";
        catSelect.options[3].text = "Korean Fried Chicken";
        catSelect.options[4].text = "Fish & Chips";
        catSelect.options[5].text = "Japanese Tempura / Tonkatsu";
        catSelect.options[6].text = "Corn Dogs / Churros / Donuts";
      } else if (lang === "ko") {
        catSelect.options[0].text = "전체 음식 카테고리";
        catSelect.options[1].text = "중식 / 대만식 튀김";
        catSelect.options[2].text = "양식 치킨 / 패스트푸드";
        catSelect.options[3].text = "한국식 치킨";
        catSelect.options[4].text = "피시 앤 칩스";
        catSelect.options[5].text = "일식 튀김 / 돈까스";
        catSelect.options[6].text = "핫도그 / 츄러스 / 도넛";
      } else {
        catSelect.options[0].text = "全部品类 (All Food)";
        catSelect.options[1].text = "中式/台式炸物";
        catSelect.options[2].text = "西式炸鸡快餐";
        catSelect.options[3].text = "韩式炸鸡";
        catSelect.options[4].text = "炸鱼薯条";
        catSelect.options[5].text = "日式炸物";
        catSelect.options[6].text = "热狗/甜甜圈";
      }
      catSelect.value = cur;
    }
  },

  toggleCity(cityId) {
    this.popoverSearchQuery = "";
    const search = document.getElementById("popoverSearchInput");
    if (search) search.value = "";
    if (cityId === "all") {
      this.activeCityIds = new Set(["all"]);
      this.activeNeighborhoodIds.clear();
    } else {
      if (this.activeCityIds.has("all")) {
        this.activeCityIds.clear();
        this.activeCityIds.add(cityId);
      } else {
        if (this.activeCityIds.has(cityId)) {
          this.activeCityIds.delete(cityId);
          // Remove child neighborhoods of this unselected city
          const nbsOfCity = this.getAllNeighborhoods().filter(n => n.parentCityId === cityId);
          nbsOfCity.forEach(n => this.activeNeighborhoodIds.delete(n.id));

          if (this.activeCityIds.size === 0 && this.activeNeighborhoodIds.size === 0) {
            this.activeCityIds.add("all");
          }
        } else {
          this.activeCityIds.add(cityId);
        }
      }
    }
    this.renderPopover();
    this.updateAreaSummaryBtn();
    this.panToSelectedArea();
    this.loadPlacesForCurrentArea();
  },

  removeCity(cityId) {
    if (this.activeCityIds.has(cityId)) {
      this.activeCityIds.delete(cityId);
      const nbsOfCity = this.getAllNeighborhoods().filter(n => n.parentCityId === cityId);
      nbsOfCity.forEach(n => this.activeNeighborhoodIds.delete(n.id));

      if (this.activeCityIds.size === 0 && this.activeNeighborhoodIds.size === 0) {
        this.activeCityIds.add("all");
      }
      this.renderPopover();
      this.updateAreaSummaryBtn();
      this.panToSelectedArea();
      this.loadPlacesForCurrentArea();
    }
  },

  toggleNeighborhood(nbId) {
    const nb = this.getNeighborhoodById(nbId);
    if (!nb) return;

    if (this.activeCityIds.has("all")) {
      this.activeCityIds.clear();
      if (nb.parentCityId && nb.parentCityId !== "all") {
        this.activeCityIds.add(nb.parentCityId);
      }
    }

    if (this.activeNeighborhoodIds.has(nbId)) {
      this.activeNeighborhoodIds.delete(nbId);
      if (this.activeNeighborhoodIds.size === 0 && this.activeCityIds.size === 0) {
        this.activeCityIds.add("all");
      }
    } else {
      this.activeNeighborhoodIds.add(nbId);
      if (nb.parentCityId && nb.parentCityId !== "all") {
        this.activeCityIds.add(nb.parentCityId);
      }
    }

    this.renderPopover();
    this.updateAreaSummaryBtn();
    this.panToSelectedArea();
    this.loadPlacesForCurrentArea();
  },

  removeNeighborhood(nbId) {
    if (this.activeNeighborhoodIds.has(nbId)) {
      this.activeNeighborhoodIds.delete(nbId);
      if (this.activeNeighborhoodIds.size === 0 && this.activeCityIds.size === 0) {
        this.activeCityIds.add("all");
      }
      this.renderPopover();
      this.updateAreaSummaryBtn();
      this.panToSelectedArea();
      this.loadPlacesForCurrentArea();
    }
  },

  // -------------------------------------------------------------
  // Pan and Focus on Selected Locality / City (Administrative Level)
  // -------------------------------------------------------------
  panToSelectedArea() {
    const isAll = this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0;
    const selectedCities = GTA_COMMUNITIES.filter(c => c.id !== "all" && this.activeCityIds.has(c.id));
    const allNbs = this.getAllNeighborhoods();
    const selectedNbs = allNbs.filter(nb => this.activeNeighborhoodIds.has(nb.id));

    // If specific neighborhood(s) are selected, prioritize them
    if (selectedNbs.length > 0) {
      this.fitItemsToBounds(selectedNbs);
      return;
    }

    if (isAll || selectedCities.length === 0) {
      this.fitItemsToBounds(GTA_COMMUNITIES.filter(c => c.id !== "all"));
      return;
    }

    // Multiple cities selected: fit bounds to encompass all selected cities
    this.fitItemsToBounds(selectedCities);
  },

  fitItemsToBounds(items) {
    if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
      const bounds = new google.maps.LatLngBounds();
      items.forEach(it => {
        const ft = this.neighbourhoodsMap?.get(it.id) || it;
        if (ft.bbox && Array.isArray(ft.bbox) && ft.bbox.length === 4) {
          bounds.extend({ lat: ft.bbox[1], lng: ft.bbox[0] });
          bounds.extend({ lat: ft.bbox[3], lng: ft.bbox[2] });
        } else if (ft.center) {
          bounds.extend(ft.center);
        }
        if (Array.isArray(ft.polygonPaths)) {
          ft.polygonPaths.forEach(pt => bounds.extend(pt));
        }
      });
      if (!bounds.isEmpty()) {
        this.googleMap.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      }
    } else if (this.fallbackMap && window.L) {
      const boundsArr = [];
      items.forEach(it => {
        const ft = this.neighbourhoodsMap?.get(it.id) || it;
        if (ft.bbox && Array.isArray(ft.bbox) && ft.bbox.length === 4) {
          boundsArr.push([ft.bbox[1], ft.bbox[0]]);
          boundsArr.push([ft.bbox[3], ft.bbox[2]]);
        } else if (ft.center) {
          boundsArr.push([ft.center.lat, ft.center.lng]);
        }
        if (Array.isArray(ft.polygonPaths)) {
          ft.polygonPaths.forEach(pt => boundsArr.push([pt.lat, pt.lng]));
        }
      });
      if (boundsArr.length > 0) {
        this.fallbackMap.fitBounds(boundsArr, { padding: [50, 50] });
      }
    }
  },

  setupResizeObserver() {
    const canvas = document.getElementById("mapExplorerCanvas");
    if (canvas && window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(canvas);
    }

    window.addEventListener("greenoil:workbench-resize", () => {
      this.handleResize();
    });

    window.addEventListener("resize", () => {
      this.handleResize();
    });
  },

  handleResize() {
    if (this.googleMap && window.google && window.google.maps) {
      google.maps.event.trigger(this.googleMap, "resize");
    }
    if (this.fallbackMap) {
      this.fallbackMap.invalidateSize();
    }
  },

  clearBoundaries() {
    this.polygonsMap.forEach(poly => {
      if (poly.setMap) {
        poly.setMap(null);
      } else if (poly.remove) {
        poly.remove();
      }
    });
    this.polygonsMap.clear();


  },

  extractGooglePolygonPaths(geometry) {
    geometry = displayGeometry(geometry);
    if (!geometry || !geometry.coordinates) return [];
    if (geometry.type === "Polygon") {
      return [geometry.coordinates.map(ring => ring.map(([lng, lat]) => ({ lat, lng })))];
    } else if (geometry.type === "MultiPolygon") {
      return geometry.coordinates.map(poly =>
        poly.map(ring => ring.map(([lng, lat]) => ({ lat, lng })))
      );
    }
    return [];
  },

  drawSelectedBoundaries() {
    this.clearBoundaries();

    const isAll = this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0;
    const selectedCities = GTA_COMMUNITIES.filter(c => c.id !== "all" && this.activeCityIds.has(c.id));
    const allNbs = this.getAllNeighborhoods();
    const selectedNbs = allNbs.filter(nb => this.activeNeighborhoodIds.has(nb.id));

    // Draw only selected official GeoJSON boundaries.
    // 2. High-precision vector Polygons for selected neighborhoods
    if (selectedNbs.length > 0) {
      if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
        selectedNbs.forEach(nb => {
          const ft = this.neighbourhoodsMap?.get(nb.id) || nb;
          if (ft && ft.geometry) {
            const polygonRingsList = this.extractGooglePolygonPaths(ft.geometry);
            polygonRingsList.forEach((polyRings, idx) => {
              const poly = new google.maps.Polygon({ clickable: false,
                paths: polyRings,
                strokeColor: "#16a34a",
                strokeOpacity: 1.0,
                strokeWeight: 2.5,
                fillColor: "#22c55e",
                fillOpacity: 0.16,
                zIndex: 10
              });
              poly.setMap(this.googleMap);
              this.polygonsMap.set(`${nb.id}_${idx}`, poly);
            });
          } else if (Array.isArray(nb.polygonPaths)) {
            const poly = new google.maps.Polygon({ clickable: false,
              paths: nb.polygonPaths,
              strokeColor: "#16a34a",
              strokeOpacity: 1.0,
              strokeWeight: 2.5,
              fillColor: "#22c55e",
              fillOpacity: 0.16,
              zIndex: 10
            });
            poly.setMap(this.googleMap);
            this.polygonsMap.set(nb.id, poly);
          }
        });
      } else if (this.fallbackMap && window.L) {
        selectedNbs.forEach(nb => {
          const ft = this.neighbourhoodsMap?.get(nb.id) || nb;
          if (ft && ft.geometry) {
            const layer = L.geoJSON({ type: "Feature", properties: {}, geometry: displayGeometry(ft.geometry) }, { interactive: false,
              style: {
                color: "#16a34a",
                weight: 2.5,
                opacity: 1.0,
                fillColor: "#22c55e",
                fillOpacity: 0.16
              }
            }).addTo(this.fallbackMap);
            this.polygonsMap.set(nb.id, layer);
          } else if (Array.isArray(nb.polygonPaths)) {
            const latLngs = nb.polygonPaths.map(pt => [pt.lat, pt.lng]);
            const poly = L.polygon(latLngs, { interactive: false,
              color: "#16a34a",
              weight: 2.5,
              opacity: 1.0,
              fillColor: "#22c55e",
              fillOpacity: 0.16
            }).addTo(this.fallbackMap);
            this.polygonsMap.set(nb.id, poly);
          }
        });
      }
      return;
    }

    // 3. Otherwise, draw selected city / all GTA boundaries
    const cities = isAll ? GTA_COMMUNITIES.filter(c => c.id !== "all") : selectedCities;
    cities.filter(c => c.geometry).forEach(city => {
      if (this.googleMap && !this.isFallbackMode && window.google?.maps) {
        this.extractGooglePolygonPaths(city.geometry).forEach((paths, index) => {
          const poly = new google.maps.Polygon({ clickable: false, paths, strokeColor: "#16a34a",
            strokeOpacity: 0.85, strokeWeight: 2, fillColor: "#22c55e", fillOpacity: 0.10, zIndex: 5 });
          poly.setMap(this.googleMap);
          this.polygonsMap.set(`${city.id}_${index}`, poly);
        });
      } else if (this.fallbackMap && window.L) {
        const layer = L.geoJSON({ type: "Feature", properties: {}, geometry: displayGeometry(city.geometry) }, { interactive: false,
          style: { color: "#16a34a", weight: 2, opacity: 0.85, fillColor: "#22c55e", fillOpacity: 0.10 }
        }).addTo(this.fallbackMap);
        this.polygonsMap.set(city.id, layer);
      }
    });
  },

  // -------------------------------------------------------------
  // Google Map / Leaflet Initialization
  // -------------------------------------------------------------
  async initGoogleMap() {
    const canvas = document.getElementById("mapExplorerCanvas");
    if (!canvas) return;

    if (window.google && window.google.maps) {
      this.createMapInstance();
      return;
    }

    const apiKey = this.googleApiKey || await Api.getGoogleMapsApiKey();
    this.googleApiKey = apiKey;
    if (!apiKey) {
      this.triggerFallbackMode();
      return;
    }

    try {
      await new Promise((resolve, reject) => {
        const existingScript = document.getElementById("googleMapsJsScript");
        if (existingScript) {
          existingScript.addEventListener("load", resolve);
          existingScript.addEventListener("error", reject);
          return;
        }

        const script = document.createElement("script");
        script.id = "googleMapsJsScript";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = (err) => {
          console.error("Google Maps API script load error:", err);
          reject(err);
        };
        document.head.appendChild(script);
      });

      this.createMapInstance();
    } catch (e) {
      console.warn("Failed to load Google Maps script, enabling fallback map:", e);
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
      const defaultCommunity = GTA_COMMUNITIES.find(city => city.id === "vaughan") || GTA_COMMUNITIES[0];
      const defaultCenter = { ...defaultCommunity.center }; // Vaughan default
      this.googleMap = new google.maps.Map(canvas, {
        center: defaultCenter,
        zoom: defaultCommunity.zoom || 13,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true
      });


      if (google.maps.places) {
        this.placesService = new google.maps.places.PlacesService(this.googleMap);
      }

      this.pinZoomScale = this.getPinZoomScale(this.googleMap.getZoom());
      this.googleMap.addListener("zoom_changed", () => this.animatePinZoom());
      this.infoWindow = new google.maps.InfoWindow();
      this.infoWindow.addListener("closeclick", () => { this.activePopupKey = null; this.poiRequestId++; });
      this.googleMap.addListener("click", event => {
        this.hideMapContextMenu();
        if (!event.placeId) return;
        event.stop();
        this.openGooglePoi(event.placeId, event.latLng);
      });
      this.googleMap.addListener("rightclick", event => {
        event.domEvent?.preventDefault?.();
        event.stop?.();
        const coordinate = this.getMapEventCoordinate(event.latLng);
        if (!coordinate) return;
        const domEvent = event.domEvent;
        this.showMapContextMenu(
          coordinate.lat,
          coordinate.lng,
          domEvent?.clientX ?? 0,
          domEvent?.clientY ?? 0
        );
      });

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

    const defaultCommunity = GTA_COMMUNITIES.find(city => city.id === "vaughan") || GTA_COMMUNITIES[0];
    const defaultCenter = [defaultCommunity.center.lat, defaultCommunity.center.lng];
    this.fallbackMap = L.map(canvas, { preferCanvas: true }).setView(defaultCenter, defaultCommunity.zoom || 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors | Green Oil'
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
    this.drawSelectedBoundaries();
    this.renderMarkers();
  },

  // -------------------------------------------------------------
  // Area Google Places Fetching & KV Joining
  // -------------------------------------------------------------
  async loadPlacesForCurrentArea(searchGoogle = true) {
    const requestId = ++this.areaLoadId;
    this.areaAbort?.abort();
    this.areaAbort = new AbortController();
    this.mapQueryLoading = false;
    this.mapQueryPage = 0;
    this.currentPage = 1;
    this.mapQueryTotal = 0;
    this.mapQueryBbox = this.getQueryBounds();
    this.mapQueryHasMore = this.mapQueryBbox[0] <= this.mapQueryBbox[2] && this.mapQueryBbox[1] <= this.mapQueryBbox[3];
    this.allRestaurants = [];
    this.kvPlaceIdsSet.clear();
    this.kvNormalizedNamesSet.clear();
    const searchId = searchGoogle ? ++this.googleSearchId : this.googleSearchId;
    if (searchGoogle) this.googleAreaPlaces = [];
    this.cancelMarkerBatches();
    this.selectedMap.clear();
    this.filteredPlaces = this.filteredPlaces || [];
    this.updateSelectionUI();
    const container = document.getElementById("mapPlacesCardsContainer");
    const lang = this.getCurrentLanguage();
    const loadingMsg = lang === "en" ? "Fetching Google Maps restaurants..." :
                       lang === "ko" ? "Google Maps 음식점 목록을 가져오는 중..." :
                       "正在获取区域 Google Maps 餐馆列表...";

    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⏳</div>
          <div style="font-weight: 600;">${loadingMsg}</div>
        </div>
      `;
    }

    if (searchGoogle) this.drawSelectedBoundaries();

    const isAll = this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0;
    const selectedCities = GTA_COMMUNITIES.filter(c => c.id !== "all" && this.activeCityIds.has(c.id));
    const allNbs = this.getAllNeighborhoods();
    const selectedNbs = allNbs.filter(nb => this.activeNeighborhoodIds.has(nb.id));

    let areaQuery = "";
    if (this.searchKeyword) {
      areaQuery = this.searchKeyword;
    } else if (selectedNbs.length > 0) {
      const nbNames = selectedNbs.map(nb => nb.nameEn || nb.name.split(" (")[0]).join(" ");
      const cityName = selectedNbs[0].cityName || "Toronto";
      areaQuery = `restaurants in ${nbNames} ${cityName} Ontario`;
    } else if (!isAll && selectedCities.length > 0) {
      const cityNames = selectedCities.map(c => c.nameEn || c.name.split(" (")[0]).join(" ");
      areaQuery = `restaurants in ${cityNames} Ontario`;
    } else {
      areaQuery = "restaurants in Toronto Ontario";
    }

    // Query the complete restaurant set for this viewport independently of Google discovery.
    this.displayedPlaces = [];
    this.filterAndRenderPlaces();
    const databaseLoad = this.loadMoreMapRestaurants();
    if (searchGoogle) {
      try {
        const result = await Api.searchGooglePlaces(areaQuery);
        if (searchId === this.googleSearchId) {
          this.googleAreaPlaces = result?.success ? (result.places || []) : [];
          this.mergeAreaPlaces();
        }
      } catch (error) { console.warn("Google discovery failed:", error); }
    }
    await databaseLoad;
    if (requestId !== this.areaLoadId) return;
  },

  mergeAreaPlaces() {
    const rawPlaces = this.googleAreaPlaces;
    // Geographic filtering is applied after merging both sources.
    const localMatches = this.allRestaurants;

    // Merge Google places with locally loaded database items, prioritizing Google discovery.
    const combinedMap = new Map();
    rawPlaces.forEach(p => {
      const key = p.placeId || p.name;
      combinedMap.set(key, p);
    });

    // Merge all locally loaded database restaurants for this viewport.
    localMatches.forEach(r => {
      const key = r.placeId || r.name;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, r);
      }
    });

    // Check saved status and visit records for each place with fast O(1) hash maps
    const kvByPlaceId = new Map();
    const kvByName = new Map();
    this.allRestaurants.forEach(r => {
      if (r.placeId) kvByPlaceId.set(r.placeId, r);
      if (r.name) kvByName.set(r.name.trim().toLowerCase(), r);
    });

    this.displayedPlaces = Array.from(combinedMap.values()).map(place => {
      const inKV = this.checkIsInKv(place);
      place.inKV = inKV;

      const normName = (place.name || "").trim().toLowerCase();
      const matchedKv = (place.placeId && kvByPlaceId.get(place.placeId)) || 
                        (normName && kvByName.get(normName));

      if (matchedKv) {
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

  isPlaceInGeometry(place, geometry) {
    const latitude = place.latitude ?? place.lat;
    const longitude = place.longitude ?? place.lng;
    if (latitude == null || longitude == null || String(latitude).trim() === "" || String(longitude).trim() === "") return false;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
    const polygons = geometry?.type === "Polygon" ? [geometry.coordinates] :
      geometry?.type === "MultiPolygon" ? geometry.coordinates : [];

    // Return 0 outside, 1 inside, 2 on an edge. Include boundary points.
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

  filterAndRenderPlaces(preservePage = false) {
    // Apply the same exact boundary to both Google discovery and saved places.
    // Selected subareas take precedence over their parent city tags.
    const selectedSubareas = this.getAllNeighborhoods().filter(area => this.activeNeighborhoodIds.has(area.id));
    const selectedAreas = selectedSubareas.length > 0 ? selectedSubareas :
      this.activeCityIds.has("all") ? [] : GTA_COMMUNITIES.filter(city => this.activeCityIds.has(city.id));
    let result = this.displayedPlaces.filter(place => selectedAreas.length === 0 ||
      selectedAreas.some(area => this.isPlaceInGeometry(place, area.geometry)));

    if (this.mapQueryBbox) {
      const [west,south,east,north] = this.mapQueryBbox;
      result = result.filter(r => Number(r.longitude) >= west && Number(r.longitude) <= east && Number(r.latitude) >= south && Number(r.latitude) <= north);
    }

    // 1. Category Filter
    if (this.activeCategory !== "全部") {
      result = result.filter(r => {
        const catText = [r.categoriesRaw, r.categories ? r.categories.join(" ") : ""].join(" ");
        return catText.includes(this.activeCategory);
      });
    }

    // 2. Visited Filter
    if (this.activeVisited === "visited") {
      result = result.filter(r => r.isVisited === true);
    } else if (this.activeVisited === "unvisited") {
      result = result.filter(r => !r.isVisited);
    }

    // 3. Outcome Filter
    if (this.activeOutcome !== "all") {
      result = result.filter(r => r.lastOutcome === this.activeOutcome);
    }

    // 4. Keyword text search
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
    const validKeys = new Set(result.map(r => r.placeId || r.name));
    for (const key of this.selectedMap.keys()) {
      if (!validKeys.has(key)) {
        this.selectedMap.delete(key);
      }
    }

    this.updateResultsSummary();
    this.renderMarkers();
    this.renderPlacesCards();
    this.updateSelectionUI();
  },

  updateResultsSummary() {
    const countEl = document.getElementById("mapResultsCount");
    const unsavedCountEl = document.getElementById("mapUnsavedCount");
    const regionTitleEl = document.getElementById("mapResultsRegionTitle");
    const summaryEl = document.getElementById("mapResultsSummary");

    const list = Array.isArray(this.filteredPlaces) ? this.filteredPlaces : [];
    const total = list.length;
    const unsaved = list.filter(r => !r.inKV).length;

    const lang = this.getCurrentLanguage();
    const sep = lang === "zh" ? "、" : ", ";

    const isAll = this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0;
    const selectedCities = GTA_COMMUNITIES.filter(c => c.id !== "all" && this.activeCityIds.has(c.id));
    const allNbs = this.getAllNeighborhoods();
    const selectedNbs = allNbs.filter(nb => this.activeNeighborhoodIds.has(nb.id));

    let titleText = this.getLocalizedAllGta();
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

    let formattedRegionTitle = "";
    if (lang === "en") {
      formattedRegionTitle = `${titleText} Restaurants (${total})`;
    } else if (lang === "ko") {
      formattedRegionTitle = `${titleText} 음식점 목록 (${total}개)`;
    } else {
      formattedRegionTitle = `${titleText} 餐馆列表 (${total} 家)`;
    }

    if (regionTitleEl) {
      regionTitleEl.textContent = formattedRegionTitle;
    }

    if (summaryEl) {
      if (lang === "en") {
        summaryEl.innerHTML = `Matched <span id="mapResultsCount" style="font-weight: 700; color: #16a34a;">${total.toLocaleString()}</span> restaurants <span style="color: #64748b;">(New: <span id="mapUnsavedCount" style="font-weight: 700; color: #d97706;">${unsaved.toLocaleString()}</span>)</span>`;
      } else if (lang === "ko") {
        summaryEl.innerHTML = `총 <span id="mapResultsCount" style="font-weight: 700; color: #16a34a;">${total.toLocaleString()}</span>개 매장 매칭 <span style="color: #64748b;">(신규 미등록: <span id="mapUnsavedCount" style="font-weight: 700; color: #d97706;">${unsaved.toLocaleString()}</span>개)</span>`;
      } else {
        summaryEl.innerHTML = `共匹配 <span id="mapResultsCount" style="font-weight: 700; color: #16a34a;">${total.toLocaleString()}</span> 家餐馆 <span style="color: #64748b;">(未入库: <span id="mapUnsavedCount" style="font-weight: 700; color: #d97706;">${unsaved.toLocaleString()}</span> 家)</span>`;
      }
    } else {
      if (countEl) countEl.textContent = total.toLocaleString();
      if (unsavedCountEl) unsavedCountEl.textContent = unsaved.toLocaleString();
    }
  },

  // -------------------------------------------------------------
  // Map Markers Rendering (Google Maps & Leaflet)
  // -------------------------------------------------------------
  markerRenderGeneration: 0,
  markerBatchTimer: null,
  growingMarkers: new Map(),
  markerGrowthFrame: null,
  growthIconCache: new WeakMap(),

  stopMarkerGrowth() {
    if (this.markerGrowthFrame !== null) cancelAnimationFrame(this.markerGrowthFrame);
    this.markerGrowthFrame = null;
    this.growingMarkers.forEach((entry, marker) => marker.setIcon(entry.icon));
    this.growingMarkers.clear();
  },

  growMarker(marker, icon) {
    if (!icon.url || typeof requestAnimationFrame !== "function" ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || this.growingMarkers.size >= 80) return;
    let frames = this.growthIconCache.get(icon);
    if (!frames) {
      frames = Array.from({ length: 13 }, (_, i) => {
        const progress = i / 12;
        const height = 0.08 + 0.92 * (1 - (1 - progress) ** 3);
        return { ...icon,
          scaledSize: new google.maps.Size(icon.scaledSize.width, icon.scaledSize.height * height),
          anchor: new google.maps.Point(icon.anchor.x, icon.anchor.y * height)
        };
      });
      this.growthIconCache.set(icon, frames);
    }
    marker.setIcon(frames[0]);
    this.growingMarkers.set(marker, { icon, frames, started: performance.now(), frame: 0 });
    if (this.markerGrowthFrame !== null) return;
    const tick = now => {
      this.markerGrowthFrame = null;
      this.growingMarkers.forEach((entry, item) => {
        const frame = Math.min(12, Math.floor((now - entry.started) / 280 * 12));
        if (frame !== entry.frame) {
          item.setIcon(frame === 12 ? entry.icon : entry.frames[frame]);
          entry.frame = frame;
        }
        if (frame === 12) this.growingMarkers.delete(item);
      });
      if (this.growingMarkers.size) this.markerGrowthFrame = requestAnimationFrame(tick);
    };
    this.markerGrowthFrame = requestAnimationFrame(tick);
  },

  cancelMarkerBatches() {
    this.stopMarkerGrowth();
    this.markerRenderGeneration++;
    if (this.markerBatchTimer !== null) clearTimeout(this.markerBatchTimer);
    this.markerBatchTimer = null;
  },

  clearMarkers() {
    this.cancelMarkerBatches();
    if (this.isFallbackMode && this.fallbackLayerGroup) {
      this.fallbackLayerGroup.clearLayers();
    } else {
      this.markersMap.forEach(marker => {
        if (marker.setMap) marker.setMap(null);
      });
    }
    this.markersMap.clear();
  },

  renderMarkers() {
    this.clearMarkers();

    // Determine markers to render:
    // 1. Current page items (guarantees card-marker sync)
    // 2. Google Places (unsaved) items
    // 3. Remaining places up to max limit (default 600) to keep 60fps
    const markerPlaces = [];
    const seenKeys = new Set();
    const list = Array.isArray(this.filteredPlaces) ? this.filteredPlaces : [];

    // A. Current page items
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = list.slice(startIdx, startIdx + this.pageSize);
    pageItems.forEach(r => {
      const key = r.placeId || r.name;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        markerPlaces.push(r);
      }
    });

    // A2. Selected items (guarantees cross-page selected items are always on map)
    this.selectedMap.forEach(r => {
      const key = r.placeId || r.name;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        markerPlaces.push(r);
      }
    });

    // B. Google Places (unsaved)
    list.forEach(r => {
      if (!r.inKV) {
        const key = r.placeId || r.name;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          markerPlaces.push(r);
        }
      }
    });

    // C. Remaining places up to max 600
    const maxMarkers = 600;
    for (let i = 0; i < list.length && markerPlaces.length < maxMarkers; i++) {
      const r = list[i];
      const key = r.placeId || r.name;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        markerPlaces.push(r);
      }
    }

    const createMarker = r => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const key = r.placeId || r.name;
      const isSelected = this.selectedMap.has(key);

      if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: this.googleMap,
          title: r.name,
          icon: this.getPinIcon(r, false),
          zIndex: isSelected ? 50 : (!r.inKV ? 30 : 10)
        });

        marker.addListener("click", () => {
          this.showInfoWindow(r, marker);
          this.scrollCardIntoView(key);
        });

        marker.restaurant = r;
        this.markersMap.set(key, marker);
        this.growMarker(marker, this.getPinIcon(r, false));
      } else if (this.fallbackMap && this.fallbackLayerGroup && window.L) {
        const color = isSelected ? "#2563eb" : (!r.inKV ? "#f59e0b" : "#10b981");
        const marker = L.circleMarker([lat, lng], {
          radius: isSelected ? 9 : (!r.inKV ? 8 : 7),
          fillColor: color,
          color: isSelected ? "#1d4ed8" : "#ffffff",
          weight: isSelected ? 3 : 2,
          opacity: 1,
          fillOpacity: 0.95
        });

        marker.bindPopup(this.getPopupHtml(r), { maxWidth: 300 });
        marker.on("click", () => {
          this.scrollCardIntoView(key);
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
      const started = performance.now();
      let count = 0;
      // Bound both work count and elapsed JS time, then yield for interaction/paint.
      while (next < markerPlaces.length && count < 20 && (count === 0 || performance.now() - started < 6)) {
        const place = markerPlaces[next++];
        const key = place.placeId || place.name;
        // Hovering a card can already have created this marker between batches.
        if (!this.markersMap.has(key)) createMarker(place);
        count++;
      }
      if (next < markerPlaces.length) this.markerBatchTimer = setTimeout(renderBatch, 16);
    };
    renderBatch();
  },

  pinIconCache: new Map(),
  pinZoomScale: 1,
  pinZoomFrame: null,
  pinZoomTransition: null,
  highlightedPinKey: null,

  getPinZoomScale(zoom) {
    return Math.max(0.6, Math.min(1.4, 1 + ((zoom ?? 13) - 13) * 0.1));
  },

  animatePinZoom() {
    this.stopMarkerGrowth();
    this.pinZoomTransition = {
      from: this.pinZoomScale,
      target: this.getPinZoomScale(this.googleMap.getZoom()),
      started: performance.now(),
      duration: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 240
    };
    // Retarget the existing loop during continuous scrolling; do not cancel it
    // on every zoom event, which can starve animation frames.
    if (this.pinZoomFrame !== null) return;
    const tick = now => {
      const { from, target, started, duration } = this.pinZoomTransition;
      const progress = duration ? Math.min(1, Math.max(0, (now - started) / duration)) : 1;
      this.pinZoomScale = from + (target - from) * progress;
      // Share each exact-size icon within this frame, without rounding its size.
      const icons = new Map();
      this.markersMap.forEach((marker, key) => {
        const place = marker.restaurant;
        if (!place || !marker.setIcon) return;
        const highlighted = this.highlightedPinKey === key;
        const style = `${!!place.inKV}:${this.selectedMap.has(key)}:${highlighted}`;
        if (!icons.has(style)) icons.set(style, this.getPinIcon(place, highlighted));
        marker.setIcon(icons.get(style));
      });
      this.pinZoomFrame = progress < 1 ? requestAnimationFrame(tick) : null;
    };
    this.pinZoomFrame = requestAnimationFrame(tick);
  },

  getPinIcon(r, isHighlight) {
    const key = r.placeId || r.name;
    const isSelected = this.selectedMap.has(key);
    const color = !r.inKV ? "#f59e0b" : "#10b981";
    const scale = isHighlight ? 1.7 : (isSelected ? 1.55 : 1.35);
    const strokeColor = isHighlight ? "#2563eb" : (isSelected ? "#1d4ed8" : "#ffffff");
    const strokeWeight = isHighlight ? 2.8 : (isSelected ? 2.5 : 1.8);
    const fillColor = isHighlight ? "#2563eb" : (isSelected ? "#2563eb" : color);

    const symbol = {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
      fillColor: fillColor,
      fillOpacity: 1,
      strokeWeight: strokeWeight,
      strokeColor: strokeColor,
      scale: scale,
      anchor: new google.maps.Point(12, 22)
    };
    // Reuse a small set of raster icons instead of per-marker vector paths.
    if (typeof Path2D === "undefined") return symbol;
    const cacheKey = `${fillColor}:${strokeColor}:${scale}:${strokeWeight}`;
    if (!this.pinIconCache.has(cacheKey)) {
      const size = 48;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return symbol;
      ctx.scale(2, 2);
      ctx.translate(size / 2 - 12 * scale, size - 4 - 22 * scale);
      ctx.scale(scale, scale);
      const path = new Path2D(symbol.path);
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWeight / scale;
      ctx.fill(path);
      ctx.stroke(path);
      this.pinIconCache.set(cacheKey, {
        url: canvas.toDataURL(),
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size - 4)
      });
    }
    const icon = this.pinIconCache.get(cacheKey);
    const factor = this.pinZoomScale;
    return { ...icon,
      scaledSize: new google.maps.Size(icon.scaledSize.width * factor, icon.scaledSize.height * factor),
      anchor: new google.maps.Point(icon.anchor.x * factor, icon.anchor.y * factor)
    };
  },

  highlightMarker(key, highlight) {
    if (highlight) this.highlightedPinKey = key;
    else if (this.highlightedPinKey === key) this.highlightedPinKey = null;
    let marker = this.markersMap.get(key);
    const r = this.filteredPlaces.find(item => (item.placeId || item.name) === key);
    if (!r) return;

    if (!marker && highlight) {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
          marker = new google.maps.Marker({
            position: { lat, lng },
            map: this.googleMap,
            title: r.name,
            icon: this.getPinIcon(r, true),
            zIndex: 999
          });
          marker.addListener("click", () => {
            this.showInfoWindow(r, marker);
            this.scrollCardIntoView(key);
          });
          marker.restaurant = r;
        this.markersMap.set(key, marker);
        }
      }
    }

    if (!marker) return;
    this.growingMarkers.delete(marker);

    if (this.googleMap && !this.isFallbackMode && marker.setIcon) {
      marker.setIcon(this.getPinIcon(r, highlight));
      marker.setZIndex(highlight ? 999 : (!r.inKV ? 30 : 10));
    } else if (this.fallbackMap && marker.setStyle) {
      marker.setStyle({
        radius: highlight ? 11 : (!r.inKV ? 8 : 7),
        fillColor: highlight ? "#2563eb" : (!r.inKV ? "#f59e0b" : "#10b981")
      });
    }
  },

  scrollCardIntoView(key) {
    const container = document.getElementById("mapPlacesCardsContainer");
    if (!container) return;

    const index = this.filteredPlaces.findIndex(place => (place.placeId || place.name) === key);
    if (index < 0) return;
    const page = Math.floor(index / this.pageSize) + 1;
    if (this.currentPage !== page) {
      this.currentPage = page;
      this.renderPlacesCards();
      this.updateSelectionUI();
    }
    const card = container.querySelector(`.map-place-card[data-key="${CSS.escape(key)}"]`);
    if (card) {
      container.querySelectorAll(".map-place-card").forEach(el => el.classList.remove("is-active"));
      card.classList.add("is-active");
      card.focus({ preventScroll: true });
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  },

  // -------------------------------------------------------------
  // Restaurant Photo Resolver (Google Places photos only)
  // -------------------------------------------------------------
  getRestaurantPhoto(r) {
    if (!r) return { url: null, isGoogle: false };
    const raw = r.photoUrl;
    if (typeof raw === "string") {
      const url = raw.startsWith("/api/") ? `${Api.getWorkerUrl()}${raw}` : raw;
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "https:" && (/^(places\.googleapis\.com|maps\.googleapis\.com|[^/]+\.googleusercontent\.com|[^/]+\.ggpht\.com)$/.test(parsed.hostname) || (parsed.origin === new URL(Api.getWorkerUrl()).origin && parsed.pathname.includes("photo")))) {
          return { url, isGoogle: true };
        }
      } catch {}
    }
    let cached = this.googlePhotosCache.get(r.placeId);
    if (!cached && r.placeId) {
      try { cached = sessionStorage.getItem("gphoto_" + r.placeId); } catch {}
      if (cached) this.googlePhotosCache.set(r.placeId, cached);
    }
    return { url: cached || null, isGoogle: !!cached };
  },

  /**
   * Fetch authentic Google Places photo for a single Place ID
   * Reads from cache first, then calls Google Places API (New) with public key
   */
  async fetchGooglePhotoForPlace(placeId) {
    if (!placeId || !placeId.startsWith("ChIJ")) return null;
    if (this.googlePhotosCache && this.googlePhotosCache.has(placeId)) {
      return this.googlePhotosCache.get(placeId);
    }
    try {
      const cached = sessionStorage.getItem("gphoto_" + placeId);
      if (cached) {
        if (this.googlePhotosCache) this.googlePhotosCache.set(placeId, cached);
        return cached;
      }
    } catch (e) {}

    const apiKey = this.googleApiKey || await Api.getGoogleMapsApiKey();
    if (!apiKey) return null;

    try {
      const resp = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "photos"
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.photos && data.photos.length > 0 && data.photos[0].name) {
          const photoUrl = `https://places.googleapis.com/v1/${data.photos[0].name}/media?maxHeightPx=300&maxWidthPx=300&key=${apiKey}`;
          if (this.googlePhotosCache) this.googlePhotosCache.set(placeId, photoUrl);
          try {
            sessionStorage.setItem("gphoto_" + placeId, photoUrl);
          } catch (e) {}
          return photoUrl;
        }
      }
    } catch (err) {
      console.warn("fetchGooglePhotoForPlace error:", err);
    }
    return null;
  },

  /**
   * Resolves authentic Google Places photos for all visible cards on the page
   */
  async resolveVisibleGooglePhotos(pageItems) {
    if (!Array.isArray(pageItems) || pageItems.length === 0) return;
    const apiKey = this.googleApiKey || await Api.getGoogleMapsApiKey();
    if (!apiKey) return;

    const itemsToFetch = pageItems.filter(r => {
      if (!r || !r.placeId || !r.placeId.startsWith("ChIJ")) return false;
      if (this.getRestaurantPhoto(r).isGoogle) return false;
      if (this.googlePhotosCache && this.googlePhotosCache.has(r.placeId)) return false;
      try {
        if (sessionStorage.getItem("gphoto_" + r.placeId)) return false;
      } catch (e) {}
      return true;
    });

    if (itemsToFetch.length === 0) return;

    const batchSize = 4;
    for (let i = 0; i < itemsToFetch.length; i += batchSize) {
      const batch = itemsToFetch.slice(i, i + batchSize);
      await Promise.all(batch.map(async r => {
        const photoUrl = await this.fetchGooglePhotoForPlace(r.placeId);
        if (photoUrl) {
          r.photoUrl = photoUrl;
          const key = r.placeId || r.name;
          const safeKey = this.escapeQuotes(key);
          const cardEl = document.querySelector(`.map-place-card[data-key="${safeKey}"]`);
          if (cardEl) {
            const imgEl = cardEl.querySelector(".card-thumb img");
            if (imgEl) {
              imgEl.src = photoUrl;

            }
          }
        }
      }));
    }
  },

  // -------------------------------------------------------------
  // Right Side Restaurant Cards Rendering
  // -------------------------------------------------------------
  renderPlacesCards() {
    const container = document.getElementById("mapPlacesCardsContainer");
    if (!container) return;
    const lang = this.getCurrentLanguage();
    const list = Array.isArray(this.filteredPlaces) ? this.filteredPlaces : [];

    if (list.length === 0) {
      const emptyTitle = lang === "en" ? "No matching restaurants found in this area" :
                         lang === "ko" ? "선택한 지역에 일치하는 음식점이 없습니다" :
                         "当前区域暂未检索到符合条件的餐馆";
      const emptySub = lang === "en" ? "Try switching category or selecting another area" :
                       lang === "ko" ? "다른 카테고리를 선택하거나 지역을 변경해 보세요" :
                       "尝试切换分类或搜索其它商圈";
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-weight: 600; font-size: 0.95rem;">${emptyTitle}</div>
          <div style="font-size: 0.8rem; margin-top: 0.35rem;">${emptySub}</div>
        </div>
      `;
      this.renderPagination(0);
      return;
    }

    const total = list.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = list.slice(startIdx, startIdx + this.pageSize);

    const txtInKv = lang === "en" ? "✓ In database" : (lang === "ko" ? "✓ 데이터베이스 등록" : "✓ 已入库");
    const txtNewPlace = lang === "en" ? "Not saved" : (lang === "ko" ? "미등록" : "未入库");
    const txtVisited = lang === "en" ? "Visited" : (lang === "ko" ? "방문 완료" : "已拜访");
    const txtUnvisited = lang === "en" ? "Unvisited" : (lang === "ko" ? "미방문" : "未拜访");
    const txtLogged = lang === "en" ? "Logged" : (lang === "ko" ? "기록됨" : "已记录");
    const txtRecentVisit = lang === "en" ? "Recent visit" : (lang === "ko" ? "최근 방문" : "最近拜访");
    const txtSaveKv = lang === "en" ? "Save to KV" : (lang === "ko" ? "KV 저장" : "保存至KV");
    const txtSaveKvTitle = lang === "en" ? "Save to KV Database" : (lang === "ko" ? "KV 데이터베이스에 저장" : "立即一键保存到云端KV");
    const txtLogVisit = lang === "en" ? "Log Visit" : (lang === "ko" ? "방문 기록" : "拜访记录");
    const txtLogVisitTitle = lang === "en" ? "Log on-site visit" : (lang === "ko" ? "현장 방문 기록" : "登记现场拜访记录");
    const txtNav = lang === "en" ? "Directions" : (lang === "ko" ? "길찾기" : "导航");
    const txtNavTitle = lang === "en" ? "Navigate in Google Maps" : (lang === "ko" ? "Google 지도 길찾기" : "Google Maps 导航");
    const txtDefaultAddr = lang === "en" ? "Ontario GTA" : (lang === "ko" ? "온타리오 GTA" : "安大略省 GTA");
    const txtDefaultCat = lang === "en" ? "Food & Dining" : (lang === "ko" ? "음식 및 다이닝" : "餐饮美食");

    container.innerHTML = pageItems.map(r => {
      const key = r.placeId || r.name;
      const isSelected = this.selectedMap.has(key);
      const photoInfo = this.getRestaurantPhoto(r);

      const kvBadge = r.inKV
        ? `<span class="badge" style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; font-size:0.72rem; padding:2px 7px; border-radius:4px; font-weight:600;">${txtInKv}</span>`
        : `<span class="badge" style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; font-size:0.72rem; padding:2px 7px; border-radius:4px; font-weight:700;">${txtNewPlace}</span>`;

      const visitBadge = r.isVisited
        ? `<span class="badge" style="background:#ecfdf5; color:#047857; border:1px solid #6ee7b7; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:600;" title="${txtRecentVisit}: ${this.escapeHtml(r.lastVisitTime || '')}">${txtVisited} · ${this.escapeHtml(r.lastOutcome || txtLogged)}</span>`
        : `<span class="badge" style="background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; font-size:0.7rem; padding:2px 6px; border-radius:4px;">${txtUnvisited}</span>`;

      const ratingStr = r.rating ? `★ ${parseFloat(r.rating).toFixed(1)}` : "★ 4.2";
      const reviewsStr = r.reviews ? `(${r.reviews})` : "(15+)";
      const categoryStr = r.categoriesRaw || (r.categories ? r.categories.slice(0, 2).join(" · ") : txtDefaultCat);

      const saveKvBtn = !r.inKV ? `
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.mapExplorerAddSingleToKv('${this.escapeQuotes(key)}');" style="background:#059669; border-color:#059669; font-size:0.75rem; padding:0.25rem 0.55rem; font-weight:600;" title="${txtSaveKvTitle}">
          <span>${txtSaveKv}</span>
        </button>
      ` : "";

      const visitActionBtn = r.inKV ? `
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.mapExplorerLogVisit('${this.escapeQuotes(key)}');" style="font-size:0.75rem; padding:0.25rem 0.5rem;" title="${txtLogVisitTitle}">
          <span>${txtLogVisit}</span>
        </button>
      ` : "";

      return `
        <div tabindex="-1" class="map-place-card ${isSelected ? 'is-selected' : ''}" data-key="${this.escapeHtml(key)}" onmouseenter="window.mapExplorerHighlight('${this.escapeQuotes(key)}', true);" onmouseleave="window.mapExplorerHighlight('${this.escapeQuotes(key)}', false);" onclick="window.mapExplorerCardClick('${this.escapeQuotes(key)}');">
          <div class="card-thumb" style="${photoInfo.url ? '' : 'display:none'}">
            <img ${photoInfo.url ? `src="${this.escapeHtml(photoInfo.url)}"` : ''} alt="${this.escapeHtml(r.name)}" loading="lazy" class="card-img" onload="this.parentElement.style.display=''" onerror="this.parentElement.style.display='none'" />
          </div>
          <div class="card-main">
            <div class="card-title-row" style="display: flex; align-items: center; gap: 0.5rem;">
              <input 
                type="checkbox" 
                class="custom-checkbox map-card-select-cb" 
                ${isSelected ? 'checked' : ''} 
                onclick="event.stopPropagation(); window.mapExplorerToggleSelect('${this.escapeQuotes(key)}');" 
                title="${isSelected ? (i18n.t("btn_clear_selection") || '取消勾选') : (i18n.t("btn_select_all") || '勾选餐馆')}" 
              />
              <h4 class="card-title" title="${this.escapeHtml(r.name)}" style="flex: 1; margin: 0;">${this.escapeHtml(r.name)}</h4>
              <span style="font-size: 0.78rem; font-weight: 700; color: #475569; flex-shrink: 0;">${this.escapeHtml(r.price || "$$")}</span>
            </div>

            <div class="card-meta-row">
              <span class="card-rating">${ratingStr}</span>
              <span>${reviewsStr}</span>
              <span>·</span>
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.escapeHtml(categoryStr)}</span>
            </div>

            <div class="card-badges-row">
              ${kvBadge}
              ${visitBadge}
            </div>

            <div class="card-address" title="${this.escapeHtml(r.address || '')}">
              ${this.escapeHtml(r.address || txtDefaultAddr)}
            </div>

            <div class="card-actions-row">
              ${saveKvBtn}
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.mapExplorerAddSingleToRoute('${this.escapeQuotes(key)}');" style="color:#2563eb; border-color:rgba(37,99,235,0.3); font-size:0.75rem; padding:0.25rem 0.5rem;" title="${i18n.t("btn_add_waypoint")}">
                ${i18n.t("btn_add_waypoint")}
              </button>
              ${visitActionBtn}
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.mapExplorerOpenNav('${this.escapeQuotes(r.name)}', '${this.escapeQuotes(r.address)}');" style="font-size:0.75rem; padding:0.25rem 0.45rem;" title="${txtNavTitle}">
                ${txtNav}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    this.renderPagination(total);
    this.resolveVisibleGooglePhotos(pageItems);
    this.updateSelectionUI();
  },

  renderPagination(total) {
    const infoEl = document.getElementById("mapPaginationInfo");
    const controlsEl = document.getElementById("mapPaginationControls");
    if (!infoEl || !controlsEl) return;
    const lang = this.getCurrentLanguage();

    if (total === 0) {
      infoEl.textContent = lang === "en" ? "Showing 0 - 0 of 0 restaurants" :
                           lang === "ko" ? "0 - 0 / 총 0개 매장" :
                           "显示 0 - 0 / 共 0 家餐馆";
      controlsEl.innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(total / this.pageSize) || 1;
    const startIdx = (this.currentPage - 1) * this.pageSize + 1;
    const endIdx = Math.min(this.currentPage * this.pageSize, total);

    infoEl.textContent = lang === "en" ? `Showing ${startIdx} - ${endIdx} of ${total} restaurants` :
                         lang === "ko" ? `${startIdx} - ${endIdx} / 총 ${total}개 매장` :
                         `显示 ${startIdx} - ${endIdx} / 共 ${total} 家餐馆`;

    let html = `
      <button class="btn btn-secondary btn-sm" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.mapExplorerGoToPage(${this.currentPage - 1})">&lt;</button>
    `;

    let lastRendered = 0;
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= this.currentPage - 1 && p <= this.currentPage + 1)) {
        if (lastRendered > 0 && p - lastRendered > 1) {
          html += `<span style="display:inline-flex; align-items:center; padding:0 4px; color:var(--text-muted); font-size:0.8rem; user-select:none;">...</span>`;
        }
        html += `
          <button class="btn ${p === this.currentPage ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.mapExplorerGoToPage(${p})">${p}</button>
        `;
        lastRendered = p;
      }
    }

    html += `
      <button class="btn btn-secondary btn-sm" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.mapExplorerGoToPage(${this.currentPage + 1})">&gt;</button>
    `;

    controlsEl.innerHTML = html;
  },

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredPlaces.length / this.pageSize) || 1;
    this.currentPage = Math.max(1, Math.min(Number(page) || 1, totalPages));
    this.renderPlacesCards();
  },

  // -------------------------------------------------------------
  // Info Window / Popup Content
  // -------------------------------------------------------------
  getPopupHtml(r) {
    const key = r.placeId || r.name;
    const lang = this.getCurrentLanguage();
    const photoInfo = this.getRestaurantPhoto(r);

    const kvBadge = r.inKV 
      ? `<span style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; padding:1px 5px; border-radius:4px; font-size:10px; font-weight:600;">✓ ${lang === "en" ? "In KV" : (lang === "ko" ? "KV 등록" : "已在KV")}</span>`
      : `<span style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; padding:1px 5px; border-radius:4px; font-size:10px; font-weight:700;">${lang === "en" ? "Not in KV" : (lang === "ko" ? "KV 미등록" : "未在KV库")}</span>`;

    const saveText = lang === "en" ? "Save to KV" : (lang === "ko" ? "KV 저장" : "保存至KV");
    const navText = lang === "en" ? "Directions" : (lang === "ko" ? "길찾기" : "导航");
    const noAddrText = lang === "en" ? "No address" : (lang === "ko" ? "주소 없음" : "暂无地址");

    const saveBtn = !r.inKV ? `
      <button onclick="window.mapExplorerAddSingleToKv('${this.escapeQuotes(key)}')" style="background:#059669; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:11px; font-weight:600; cursor:pointer;">
        ${saveText}
      </button>
    ` : "";

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2px; max-width: 260px;">
        <div style="display:flex; gap: 8px; align-items: center; margin-bottom: 6px;">
          ${photoInfo.url ? `<div style="width:48px;height:48px;flex-shrink:0;overflow:hidden;border-radius:6px"><img src="${this.escapeHtml(photoInfo.url)}" alt="${this.escapeHtml(r.name)}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.remove()" /></div>` : ''}
          <div style="min-width: 0; flex: 1;">
            <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(r.name)}">${this.escapeHtml(r.name)}</h4>
            <div style="margin-top: 3px;">${kvBadge}</div>
          </div>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">
          ★ ${r.rating ? parseFloat(r.rating).toFixed(1) : "4.2"} (${r.reviews || 10}) · <b>${this.escapeHtml(r.price || "$$")}</b>
        </div>
        <div style="font-size: 11px; color: #334155; margin-bottom: 6px; line-height: 1.3;">
          ${this.escapeHtml(r.address || noAddrText)}
        </div>
        <div style="display:flex; gap: 5px; border-top: 1px solid #e2e8f0; padding-top: 6px; flex-wrap: wrap;">
          ${saveBtn}
          <button onclick="window.mapExplorerAddSingleToRoute('${this.escapeQuotes(key)}')" style="background:#2563eb; color:white; border:none; border-radius:4px; padding:3px 7px; font-size:11px; font-weight:600; cursor:pointer;">
            ${i18n.t("btn_add_waypoint")}
          </button>
          <button onclick="window.mapExplorerOpenNav('${this.escapeQuotes(r.name)}', '${this.escapeQuotes(r.address)}')" style="background:#0f172a; color:white; border:none; border-radius:4px; padding:3px 7px; font-size:11px; cursor:pointer;">
            ${navText}
          </button>
        </div>
      </div>
    `;
  },

  findPlace(key) {
    return this.poiPlaces.get(key) || this.displayedPlaces.find(r => (r.placeId || r.name) === key) || this.filteredPlaces?.find(r => (r.placeId || r.name) === key);
  },

  async openGooglePoi(placeId, position) {
    const requestId = ++this.poiRequestId;
    this.activePopupKey = placeId;
    this.infoWindow.setContent(`<div style="padding:8px">${i18n.t("map_poi_loading")}</div>`);
    if (position) this.infoWindow.setPosition(position);
    this.infoWindow.open({ map: this.googleMap });
    let restaurant = this.findPlace(placeId);
    if (!restaurant) {
      const result = await Api.getGooglePlaceDetails(placeId);
      if (requestId !== this.poiRequestId) return;
      if (!result.success || !result.place) {
        const message = { zh: "店铺详情加载失败，请重新点击重试", en: "Unable to load this place. Click it again to retry.", ko: "장소 정보를 불러올 수 없습니다. 다시 클릭해 주세요." };
        this.infoWindow.setContent(`<div style="padding:8px">${message[this.getCurrentLanguage()] || message.en}</div>`);
        return;
      }
      restaurant = result.place;
    }
    if (requestId !== this.poiRequestId) return;
    restaurant.inKV = this.checkIsInKv(restaurant);
    this.poiPlaces.set(placeId, restaurant);
    this.infoWindow.setContent(this.getPopupHtml(restaurant));
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
    this.infoWindow.open(this.googleMap, marker);

    // Asynchronously resolve authentic Google photo for popup if not cached yet
    if (r.placeId && r.placeId.startsWith("ChIJ") && !r.photoUrl && !this.googlePhotosCache.has(r.placeId)) {
      this.fetchGooglePhotoForPlace(r.placeId).then(photoUrl => {
        if (photoUrl && this.infoWindow && this.activePopupKey === (r.placeId || r.name)) {
          r.photoUrl = photoUrl;
          this.infoWindow.setContent(this.getPopupHtml(r));
        }
      });
    }
  },

  // -------------------------------------------------------------
  // Actions: Add to KV, Batch Add to KV, Add to Route
  // -------------------------------------------------------------
  async addSingleToKv(key) {
    const r = this.findPlace(key);
    if (!r) return;
    const lang = this.getCurrentLanguage();

    if (r.inKV) {
      alert(lang === "en" ? "This restaurant is already in the KV database!" :
            lang === "ko" ? "이미 KV 데이터베이스에 등록된 매장입니다!" :
            "该餐馆已在 KV 数据库中！");
      return;
    }

    const res = await Api.addRestaurant(r);
    if (res && res.success) {
      r.inKV = true;
      if (r.placeId) this.kvPlaceIdsSet.add(r.placeId);
      if (r.name) this.kvNormalizedNamesSet.add(r.name.trim().toLowerCase());
      
      this.highlightMarker(key, false);
      this.renderMarkers();
      this.renderPlacesCards();
      this.updateResultsSummary();
      const successMsg = lang === "en" ? `🎉 Successfully added [${r.name}] to cloud KV database!` :
                         lang === "ko" ? `🎉 [${r.name}] 매장이 클라우드 KV 데이터베이스에 저장되었습니다!` :
                         `🎉 餐馆【${r.name}】已成功添加至云端 KV 数据库！`;
      alert(successMsg);
    } else {
      const failMsg = lang === "en" ? "Failed to add: " : (lang === "ko" ? "추가 실패: " : "添加失败: ");
      alert(failMsg + (res?.error || "Unknown error"));
    }
  },

  // -------------------------------------------------------------
  // Multi-Selection Logic & Handlers (Cross-Page Support)
  // -------------------------------------------------------------
  toggleSelect(key) {
    const r = this.findPlace(key);
    if (!r) return;
    if (this.selectedMap.has(key)) {
      this.selectedMap.delete(key);
    } else {
      this.selectedMap.set(key, r);
    }
    this.updateSelectionUI();
    this.updateCardSelectionStyles();
    this.renderMarkers();
  },

  toggleSelectCurrentPage() {
    const list = Array.isArray(this.filteredPlaces) ? this.filteredPlaces : [];
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = list.slice(startIdx, startIdx + this.pageSize);
    if (pageItems.length === 0) return;

    const allSelected = pageItems.every(r => this.selectedMap.has(r.placeId || r.name));
    if (allSelected) {
      pageItems.forEach(r => this.selectedMap.delete(r.placeId || r.name));
    } else {
      pageItems.forEach(r => this.selectedMap.set(r.placeId || r.name, r));
    }
    this.updateSelectionUI();
    this.updateCardSelectionStyles();
    this.renderMarkers();
  },

  clearSelection() {
    this.selectedMap.clear();
    this.updateSelectionUI();
    this.updateCardSelectionStyles();
    this.renderMarkers();
  },

  updateSelectionUI() {
    const count = this.selectedMap.size;
    const countTag = document.getElementById("mapSelectionCountTag");
    const countNum = document.getElementById("mapSelectedCountNum");
    const selectAllText = document.getElementById("mapBtnSelectAllText");

    if (countNum) countNum.textContent = count;
    if (countTag) {
      countTag.style.display = count > 0 ? "inline-flex" : "none";
    }

    const list = Array.isArray(this.filteredPlaces) ? this.filteredPlaces : [];
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = list.slice(startIdx, startIdx + this.pageSize);
    const allCurrentSelected = pageItems.length > 0 && pageItems.every(r => this.selectedMap.has(r.placeId || r.name));

    if (selectAllText) {
      selectAllText.textContent = allCurrentSelected ? i18n.t("btn_deselect_page") : i18n.t("btn_select_all");
    }

    const planRouteBtn = document.getElementById("mapBtnPlanRoute");
    if (planRouteBtn) {
      const span = planRouteBtn.querySelector("span");
      if (span) {
        span.textContent = i18n.t("btn_plan_route");
      }
    }

    const exportBtn = document.getElementById("mapBtnExportExcel");
    if (exportBtn) {
      const span = exportBtn.querySelector("span");
      if (span) {
        span.textContent = i18n.t("btn_export_excel");
      }
    }

    const batchAddBtn = document.getElementById("mapBtnBatchAddToKv");
    if (batchAddBtn) {
      const span = batchAddBtn.querySelector("span");
      if (span) {
        span.textContent = i18n.t("btn_batch_add_to_kv");
      }
    }
  },

  updateCardSelectionStyles() {
    const container = document.getElementById("mapPlacesCardsContainer");
    if (!container) return;
    container.querySelectorAll(".map-place-card").forEach(card => {
      const key = card.dataset.key;
      const isSel = this.selectedMap.has(key);
      card.classList.toggle("is-selected", isSel);
      const cb = card.querySelector(".map-card-select-cb");
      if (cb) cb.checked = isSel;
    });
  },

  async batchAddToKv() {
    const lang = this.getCurrentLanguage();
    const hasSelection = this.selectedMap.size > 0;
    const candidates = hasSelection ? Array.from(this.selectedMap.values()) : (Array.isArray(this.filteredPlaces) ? this.filteredPlaces : []);
    const unsaved = candidates.filter(r => !r.inKV);

    if (unsaved.length === 0) {
      if (hasSelection) {
        alert(lang === "en" ? "All selected restaurants are already in KV database!" :
              lang === "ko" ? "선택한 모든 매장이 이미 KV 데이터베이스에 등록되어 있습니다!" :
              "所选餐馆均已存在于 KV 数据库中，无需重复添加！");
      } else {
        alert(lang === "en" ? "All restaurants in current view are already in KV database!" :
              lang === "ko" ? "현재 목록의 모든 매장이 이미 KV 데이터베이스에 등록되어 있습니다!" :
              "当前列表中的所有餐馆都已存在于 KV 数据库中，无需重复添加！");
      }
      return;
    }

    const confirmMsg = hasSelection
      ? (lang === "en" ? `Found ${unsaved.length} selected restaurants not in KV database.\nBatch save these ${unsaved.length} restaurants to KV database?` :
         lang === "ko" ? `선택한 매장 중 KV 미등록 매장 ${unsaved.length}개가 발견되었습니다.\n클라우드 KV 데이터베이스에 일괄 저장하시겠습니까?` :
         `检测到所选项中有 ${unsaved.length} 家未在KV库餐馆。\n是否将这 ${unsaved.length} 家餐馆批量保存到云端 KV 数据库？`)
      : (lang === "en" ? `Found ${unsaved.length} restaurants not in KV database.\nBatch save all ${unsaved.length} restaurants to KV database?` :
         lang === "ko" ? `KV 미등록 매장 ${unsaved.length}개가 발견되었습니다.\n${unsaved.length}개 매장을 클라우드 KV 데이터베이스에 일괄 저장하시겠습니까?` :
         `检测到当前列表共有 ${unsaved.length} 家未在KV库餐馆。\n是否将这 ${unsaved.length} 家餐馆全部批量保存到云端 KV 数据库？`);

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      const res = await Api.batchAddRestaurants(unsaved);
      if (res && res.success) {
        unsaved.forEach(r => {
          r.inKV = true;
          if (r.placeId) this.kvPlaceIdsSet.add(r.placeId);
          if (r.name) this.kvNormalizedNamesSet.add(r.name.trim().toLowerCase());
        });

        this.renderMarkers();
        this.renderPlacesCards();
        this.updateResultsSummary();
        this.updateSelectionUI();
        const successMsg = lang === "en" ? `🎉 Successfully batch saved ${unsaved.length} restaurants to cloud KV database!` :
                           lang === "ko" ? `🎉 매장 ${unsaved.length}개가 클라우드 KV 데이터베이스에 일괄 저장되었습니다!` :
                           `🎉 成功将 ${unsaved.length} 家餐馆批量保存至云端 KV 数据库！`;
        alert(successMsg);
      } else {
        const failMsg = lang === "en" ? "Batch save failed: " : (lang === "ko" ? "일괄 저장 실패: " : "批量保存失败: ");
        alert(failMsg + (res?.error || "Unknown error"));
      }
    } catch (e) {
      const errMsg = lang === "en" ? "Batch save error: " : (lang === "ko" ? "일괄 저장 오류: " : "批量保存出错: ");
      alert(errMsg + e.message);
    }
  },

  // -------------------------------------------------------------
  // Events Binding
  // -------------------------------------------------------------
  bindEvents() {
    // Popover Trigger Button
    const pillBtn = document.getElementById("areaSearchPillBtn");
    if (pillBtn) {
      pillBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.togglePopover();
      });
    }

    // Close Popover when clicking outside
    document.addEventListener("click", (e) => {
      const container = document.getElementById("areaSearchPillContainer");
      if (container && !container.contains(e.target)) {
        this.togglePopover(false);
      }
      if (this.mapContextMenuEl && !this.mapContextMenuEl.contains(e.target)) {
        this.hideMapContextMenu();
      }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") this.hideMapContextMenu();
    });

    // Popover Clear All
    const clearAllBtn = document.getElementById("popoverClearAllBtn");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        this.activeCityIds = new Set(["all"]);
        this.activeNeighborhoodIds.clear();
        this.renderPopover();
        this.updateAreaSummaryBtn();
        this.panToSelectedArea();
        this.loadPlacesForCurrentArea();
      });
    }

    // Popover Live Search Input
    const popoverSearch = document.getElementById("popoverSearchInput");
    if (popoverSearch) {
      popoverSearch.addEventListener("input", (e) => {
        this.popoverSearchQuery = e.target.value.trim();
        this.renderPopover();
      });
      popoverSearch.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.popoverSearchQuery = e.target.value.trim();
          this.renderPopover();
        }
      });
    }

    // Popover City Pills Click Handler
    const cityPillsRow = document.getElementById("popoverCityPills");
    if (cityPillsRow) {
      cityPillsRow.addEventListener("click", (e) => {
        const btn = e.target.closest(".popover-pill-btn");
        if (!btn) return;
        const cityId = btn.dataset.city;
        if (!cityId) return;

        this.toggleCity(cityId);
      });
    }

    // Popover Neighborhood Pills Click Handler
    const neighborhoodPillsRow = document.getElementById("popoverNeighborhoodPills");
    if (neighborhoodPillsRow) {
      neighborhoodPillsRow.addEventListener("click", (e) => {
        const btn = e.target.closest(".popover-pill-btn");
        if (!btn) return;
        const nbId = btn.dataset.neighborhood;
        if (!nbId) return;

        this.toggleNeighborhood(nbId);
      });
    }

    // Popover Nearby Recommended Neighborhood Pills Click Handler
    const nearbyPillsRow = document.getElementById("popoverNearbyPills");
    if (nearbyPillsRow) {
      nearbyPillsRow.addEventListener("click", (e) => {
        const btn = e.target.closest(".popover-pill-btn");
        if (!btn) return;
        const nbId = btn.dataset.neighborhood;
        if (!nbId) return;

        this.toggleNeighborhood(nbId);
      });
    }

    // Reset To Central GTA Shortcut
    const resetCenterBtn = document.getElementById("popoverCurrentLocationBtn");
    if (resetCenterBtn) {
      resetCenterBtn.addEventListener("click", () => {
        this.activeCityIds = new Set(["all"]);
        this.activeNeighborhoodIds.clear();
        this.renderPopover();
        this.updateAreaSummaryBtn();
        this.panToSelectedArea();
        this.loadPlacesForCurrentArea();
        this.togglePopover(false);
      });
    }

    // Category Select
    const catSelect = document.getElementById("mapCategorySelect");
    if (catSelect) {
      catSelect.addEventListener("change", (e) => {
        this.activeCategory = e.target.value;
        this.loadPlacesForCurrentArea(false);
      });
    }

    // Visited Select
    const visitedSelect = document.getElementById("mapVisitedSelect");
    if (visitedSelect) {
      visitedSelect.addEventListener("change", (e) => {
        this.activeVisited = e.target.value;
        this.loadPlacesForCurrentArea(false);
      });
    }

    // Outcome Select
    const outcomeSelect = document.getElementById("mapOutcomeSelect");
    if (outcomeSelect) {
      outcomeSelect.addEventListener("change", (e) => {
        this.activeOutcome = e.target.value;
        this.loadPlacesForCurrentArea(false);
      });
    }

    // Search Keyword Input & Submit
    const searchInput = document.getElementById("mapKeywordInput");
    const searchBtn = document.getElementById("mapBtnSearchGmap");

    const doSearch = () => {
      this.searchKeyword = searchInput ? searchInput.value.trim() : "";
      this.loadPlacesForCurrentArea();
    };

    if (searchBtn) searchBtn.addEventListener("click", doSearch);
    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });
    }

    // Batch Add to KV
    const batchAddBtn = document.getElementById("mapBtnBatchAddToKv");
    if (batchAddBtn) {
      batchAddBtn.addEventListener("click", () => this.batchAddToKv());
    }

    // Plan Route with Field Sales
    const planRouteBtn = document.getElementById("mapBtnPlanRoute");
    if (planRouteBtn) {
      planRouteBtn.addEventListener("click", () => {
        const selectedList = Array.from(this.selectedMap.values());
        const list = Array.isArray(this.filteredPlaces) ? this.filteredPlaces : [];
        const places = selectedList.length > 0 ? selectedList : list.slice(0, 10);
        if (places.length === 0) {
          const msg = "当前列表暂无餐馆可规划路线";
          if (window.showToast) window.showToast(msg);
          else alert(msg);
          return;
        }
        import("./field-sales.js").then(({ FieldSales }) => {
          FieldSales.addMultipleToRoute(places, false);
        });
      });
    }

    // Select All (Toggle Current Page)
    const selectAllBtn = document.getElementById("mapBtnSelectAll");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () => this.toggleSelectCurrentPage());
    }

    // Clear Selection
    const clearSelectionBtn = document.getElementById("mapBtnClearSelection");
    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener("click", () => this.clearSelection());
    }

    // Export Excel
    const exportExcelBtn = document.getElementById("mapBtnExportExcel");
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener("click", () => {
        const selectedList = Array.from(this.selectedMap.values());
        const list = Array.isArray(this.filteredPlaces) ? this.filteredPlaces : [];
        const candidates = selectedList.length > 0 ? selectedList : list;
        if (window.XLSX && candidates.length > 0) {
          const rows = candidates.map(r => ({
            "餐馆名称": r.name,
            "地址": r.address,
            "电话": r.phone || "",
            "评分": r.rating || "",
            "评价数": r.reviews || "",
            "KV状态": r.inKV ? "已在KV" : "未在KV库",
            "拜访状态": r.isVisited ? `已拜访 (${r.lastOutcome})` : "未拜访"
          }));
          const ws = window.XLSX.utils.json_to_sheet(rows);
          const wb = window.XLSX.utils.book_new();
          window.XLSX.utils.book_append_sheet(wb, ws, "餐馆列表");
          window.XLSX.writeFile(wb, `Google_Restaurants_${Date.now()}.xlsx`);
        } else {
          const msg = "暂无可导出的餐馆数据";
          if (window.showToast) window.showToast(msg);
          else alert(msg);
        }
      });
    }

    // ESC key listener to close InfoWindow / Popovers
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.keyCode === 27) {
        if (this.infoWindow) {
          this.infoWindow.close();
          this.activePopupKey = null;
        }
        if (this.fallbackMap) {
          this.fallbackMap.closePopup();
        }
        this.togglePopover(false);
      }
    });
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[m]);
  },

  escapeQuotes(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
  }
};

// Global Window Helpers for onclick handlers
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
        if (!marker && window.google && window.google.maps) {
          marker = new google.maps.Marker({
            position: { lat, lng },
            map: MapExplorer.googleMap,
            title: r.name,
            icon: MapExplorer.getPinIcon(r, true),
            zIndex: 999
          });
          marker.addListener("click", () => {
            MapExplorer.showInfoWindow(r, marker);
            MapExplorer.scrollCardIntoView(key);
          });
          marker.restaurant = r;
          MapExplorer.markersMap.set(key, marker);
        }
        if (marker) MapExplorer.showInfoWindow(r, marker);
      } else if (MapExplorer.fallbackMap) {
        MapExplorer.fallbackMap.setView([lat, lng], 16);
      }
    }
  };

  window.mapExplorerAddSingleToKv = function(key) {
    MapExplorer.addSingleToKv(key);
  };

  window.mapExplorerAddSingleToRoute = function(key) {
    const r = MapExplorer.findPlace(key);
    if (!r) return;
    import("./field-sales.js").then(({ FieldSales }) => {
      FieldSales.addMultipleToRoute([r], false);
    });
  };

  window.mapExplorerLogVisit = function(key) {
    const r = MapExplorer.findPlace(key);
    if (!r) return;
    import("./field-sales.js").then(({ FieldSales }) => {
      FieldSales.openSalesRecordModal(null, r);
    });
  };

  window.mapExplorerOpenNav = function(name, address) {
    const q = encodeURIComponent(`${name} ${address}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  window.mapExplorerGoToPage = function(p) {
    MapExplorer.goToPage(p);
  };

  window.mapExplorerResetToAllGta = function() {
    MapExplorer.activeCityIds = new Set(["all"]);
    MapExplorer.activeNeighborhoodIds.clear();
    MapExplorer.renderPopover();
    MapExplorer.updateAreaSummaryBtn();
    MapExplorer.panToSelectedArea();
    MapExplorer.loadPlacesForCurrentArea();
  };

  window.mapExplorerRemoveCity = function(cityId) {
    MapExplorer.removeCity(cityId);
  };

  window.mapExplorerRemoveNeighborhood = function(nbId) {
    MapExplorer.removeNeighborhood(nbId);
  };

  window.mapExplorerToggleSelect = function(key) {
    MapExplorer.toggleSelect(key);
  };

  window.mapExplorerClearSelection = function() {
    MapExplorer.clearSelection();
  };
}
