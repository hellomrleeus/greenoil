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
    polygonPaths: [
      { lat: 43.6200, lng: -79.6200 }, // Mississauga South
      { lat: 43.7200, lng: -79.7200 }, // Mississauga North
      { lat: 43.8600, lng: -79.6000 }, // Vaughan West
      { lat: 43.9500, lng: -79.4600 }, // Vaughan / Richmond Hill North
      { lat: 43.9400, lng: -79.2800 }, // Markham North
      { lat: 43.8500, lng: -79.1600 }, // Scarborough North / East
      { lat: 43.7100, lng: -79.1800 }, // Scarborough Lake Ontario
      { lat: 43.6300, lng: -79.3600 }, // Toronto Waterfront
      { lat: 43.5800, lng: -79.5200 }  // Port Credit / Etobicoke
    ],
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
    polygonPaths: [
      { lat: 43.5810, lng: -79.5410 },
      { lat: 43.7600, lng: -79.6390 },
      { lat: 43.7950, lng: -79.5300 },
      { lat: 43.8550, lng: -79.1800 },
      { lat: 43.7800, lng: -79.1150 },
      { lat: 43.6600, lng: -79.2800 },
      { lat: 43.6300, lng: -79.3800 }
    ],
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
    polygonPaths: [
      { lat: 43.9190, lng: -79.3780 }, // 19th Ave & Bayview
      { lat: 43.9260, lng: -79.2420 }, // 19th Ave & McCowan
      { lat: 43.9310, lng: -79.1820 }, // 19th Ave & York-Durham Line
      { lat: 43.8520, lng: -79.1760 }, // Steeles & York-Durham Line
      { lat: 43.8210, lng: -79.2220 }, // Steeles & Markham Rd
      { lat: 43.8190, lng: -79.3310 }, // Steeles & Victoria Park
      { lat: 43.8210, lng: -79.3790 }, // Steeles & Bayview / 404
      { lat: 43.8710, lng: -79.3770 }  // 16th Ave & 404
    ],
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
    polygonPaths: [
      { lat: 43.9570, lng: -79.4670 }, // Bloomington & Bathurst
      { lat: 43.9620, lng: -79.3950 }, // Bloomington & Hwy 404
      { lat: 43.8520, lng: -79.3800 }, // Hwy 7 & Hwy 404
      { lat: 43.8320, lng: -79.3850 }, // Steeles & Hwy 404
      { lat: 43.8310, lng: -79.4620 }, // Steeles & Bathurst
      { lat: 43.8950, lng: -79.4650 }  // Major Mackenzie & Bathurst
    ],
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
    polygonPaths: [
      { lat: 43.7200, lng: -79.7200 }, // Derry & 10th Line
      { lat: 43.7100, lng: -79.6100 }, // Derry & Dixie
      { lat: 43.6200, lng: -79.5400 }, // Dundas & Etobicoke Creek
      { lat: 43.4800, lng: -79.6100 }, // Lake Ontario / Clarkson
      { lat: 43.5300, lng: -79.7600 }  // Winston Churchill & 403
    ],
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
    polygonPaths: [
      { lat: 43.9200, lng: -79.6200 }, // King-Vaughan Rd & Hwy 50
      { lat: 43.9300, lng: -79.4600 }, // King-Vaughan Rd & Bathurst
      { lat: 43.7900, lng: -79.4500 }, // Steeles & Bathurst
      { lat: 43.7800, lng: -79.5900 }, // Steeles & Hwy 27
      { lat: 43.8400, lng: -79.6200 }  // Major Mackenzie & Hwy 50
    ],
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
  selectedMap: new Map(), // key -> Restaurant
  googlePhotosCache: new Map(), // placeId -> Google Places photo URL
  googleApiKey: "",

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
  activeCityIds: new Set(["all"]),
  activeNeighborhoodIds: new Set(),
  polygonsMap: new Map(), // Boundary polygons
  localityFeatureLayer: null,
  activeCategory: "全部",
  activeVisited: "all", // "all", "visited", "unvisited"
  activeOutcome: "all",
  searchKeyword: "",
  popoverSearchQuery: "",
  followBounds: false,
  boundsDebounceTimer: null,
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

    // 2. Load all restaurants data from KV
    await this.loadAllRestaurants();

    // 3. Pan to initial locality and load places
    this.panToSelectedArea();
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

  async loadAllRestaurants() {
    try {
      const data = await Api.getMapRestaurants({ pageSize: 3500, format: "map" });
      if (Array.isArray(data) && data.length > 0) {
        this.allRestaurants = data.map(r => {
          r.inKV = true;
          if (r.placeId) this.kvPlaceIdsSet.add(r.placeId);
          if (r.name) this.kvNormalizedNamesSet.add(r.name.trim().toLowerCase());
          return r;
        });
      } else {
        const res = await Api.queryRestaurants({ page: 1, pageSize: 300 });
        this.allRestaurants = (res.data || []).map(r => {
          r.inKV = true;
          if (r.placeId) this.kvPlaceIdsSet.add(r.placeId);
          if (r.name) this.kvNormalizedNamesSet.add(r.name.trim().toLowerCase());
          return r;
        });
      }
    } catch (e) {
      console.warn("Failed to load KV restaurants dataset:", e);
    }
  },

  async loadNeighbourhoodsGeoJson() {
    try {
      const resp = await fetch("assets/data/gta_neighbourhoods.json");
      if (resp.ok) {
        this.neighbourhoodsGeoJson = await resp.json();
        if (this.neighbourhoodsGeoJson && Array.isArray(this.neighbourhoodsGeoJson.features)) {
          this.neighbourhoodsMap.clear();
          this.neighbourhoodsGeoJson.features.forEach(ft => {
            this.neighbourhoodsMap.set(ft.id, ft);
            if (ft.code) this.neighbourhoodsMap.set(ft.code, ft);
          });
        }
      }
    } catch (e) {
      console.warn("Failed to load gta_neighbourhoods.json dataset:", e);
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

  updateAreaSummaryBtn() {
    const summaryEl = document.getElementById("areaActiveTagsSummary");
    if (!summaryEl) return;

    const lang = this.getCurrentLanguage();
    const sep = lang === "zh" ? "、" : ", ";

    const isAll = this.activeCityIds.has("all") && this.activeNeighborhoodIds.size === 0;
    const selectedCities = GTA_COMMUNITIES.filter(c => c.id !== "all" && this.activeCityIds.has(c.id));
    const allNbs = this.getAllNeighborhoods();
    const selectedNbs = allNbs.filter(nb => this.activeNeighborhoodIds.has(nb.id));

    let label = this.getLocalizedAllGta();
    if (selectedNbs.length > 0) {
      if (selectedNbs.length === 1) {
        label = this.getLocalizedName(selectedNbs[0]);
      } else if (selectedNbs.length === 2) {
        label = `${this.getLocalizedName(selectedNbs[0])}${sep}${this.getLocalizedName(selectedNbs[1])}`;
      } else {
        label = `${this.getLocalizedName(selectedNbs[0])}${sep}${this.getLocalizedName(selectedNbs[1])} (+${selectedNbs.length - 2})`;
      }
    } else if (!isAll && selectedCities.length > 0) {
      if (selectedCities.length === 1) {
        label = this.getLocalizedName(selectedCities[0]);
      } else if (selectedCities.length === 2) {
        label = `${this.getLocalizedName(selectedCities[0])}${sep}${this.getLocalizedName(selectedCities[1])}`;
      } else {
        label = `${this.getLocalizedName(selectedCities[0])}${sep}${this.getLocalizedName(selectedCities[1])} (+${selectedCities.length - 2})`;
      }
    }

    summaryEl.innerHTML = `
      <span class="area-tag-pill active">
        ${this.escapeHtml(label)}
      </span>
    `;
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
      const allItem = GTA_COMMUNITIES.find(c => c.id === "all") || GTA_COMMUNITIES[0];
      if (this.googleMap && !this.isFallbackMode) {
        this.googleMap.panTo(allItem.center);
        this.googleMap.setZoom(allItem.zoom || 11);
      } else if (this.fallbackMap) {
        this.fallbackMap.setView([allItem.center.lat, allItem.center.lng], allItem.zoom || 11);
      }
      return;
    }

    if (selectedCities.length === 1) {
      const c = selectedCities[0];
      if (this.googleMap && !this.isFallbackMode) {
        this.googleMap.panTo(c.center);
        this.googleMap.setZoom(c.zoom || 13);
      } else if (this.fallbackMap) {
        this.fallbackMap.setView([c.center.lat, c.center.lng], c.zoom || 13);
      }
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

  setupLocalityFeatureLayer() {
    if (!this.googleMap || this.isFallbackMode || !window.google || !window.google.maps) return;
    try {
      if (typeof this.googleMap.getFeatureLayer === "function" && google.maps.FeatureType && google.maps.FeatureType.LOCALITY) {
        this.localityFeatureLayer = this.googleMap.getFeatureLayer(google.maps.FeatureType.LOCALITY);
      }
    } catch (e) {
      console.warn("Locality FeatureLayer not available:", e);
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

    if (this.localityFeatureLayer) {
      try {
        this.localityFeatureLayer.style = null;
      } catch (e) {}
    }
  },

  extractGooglePolygonPaths(geometry) {
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

    // 1. Google Maps FeatureLayer Administrative Boundaries styling
    if (this.localityFeatureLayer) {
      try {
        this.localityFeatureLayer.style = () => {
          return {
            strokeColor: "#16a34a",
            strokeWeight: 2,
            strokeOpacity: 0.8,
            fillColor: "#22c55e",
            fillOpacity: isAll ? 0.04 : 0.12
          };
        };
      } catch (e) {
        console.warn("Error setting localityFeatureLayer style:", e);
      }
    }

    // 2. High-precision vector Polygons for selected neighborhoods
    if (selectedNbs.length > 0) {
      if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
        selectedNbs.forEach(nb => {
          const ft = this.neighbourhoodsMap?.get(nb.id) || nb;
          if (ft && ft.geometry) {
            const polygonRingsList = this.extractGooglePolygonPaths(ft.geometry);
            polygonRingsList.forEach((polyRings, idx) => {
              const poly = new google.maps.Polygon({
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
            const poly = new google.maps.Polygon({
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
            const layer = L.geoJSON(ft, {
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
            const poly = L.polygon(latLngs, {
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
    const itemsToDraw = [];
    if (isAll) {
      const allItem = GTA_COMMUNITIES.find(c => c.id === "all");
      if (allItem && Array.isArray(allItem.polygonPaths)) {
        itemsToDraw.push({ id: "all", paths: allItem.polygonPaths });
      }
    } else {
      selectedCities.forEach(c => {
        if (Array.isArray(c.polygonPaths)) {
          itemsToDraw.push({ id: c.id, paths: c.polygonPaths });
        }
      });
    }

    if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
      itemsToDraw.forEach(item => {
        const poly = new google.maps.Polygon({
          paths: item.paths,
          strokeColor: "#16a34a",
          strokeOpacity: 0.85,
          strokeWeight: 2,
          fillColor: "#22c55e",
          fillOpacity: 0.10,
          zIndex: 5
        });
        poly.setMap(this.googleMap);
        this.polygonsMap.set(item.id, poly);
      });
    } else if (this.fallbackMap && window.L) {
      itemsToDraw.forEach(item => {
        const latLngs = item.paths.map(pt => [pt.lat, pt.lng]);
        const poly = L.polygon(latLngs, {
          color: "#16a34a",
          weight: 2,
          opacity: 0.85,
          fillColor: "#22c55e",
          fillOpacity: 0.10
        }).addTo(this.fallbackMap);
        this.polygonsMap.set(item.id, poly);
      });
    }
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
      const defaultCenter = { lat: 43.7615, lng: -79.4111 }; // North York default
      this.googleMap = new google.maps.Map(canvas, {
        center: defaultCenter,
        zoom: 13,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true
      });

      this.setupLocalityFeatureLayer();

      if (google.maps.places) {
        this.placesService = new google.maps.places.PlacesService(this.googleMap);
      }

      this.infoWindow = new google.maps.InfoWindow();

      this.googleMap.addListener("idle", () => {
        if (this.followBounds) {
          clearTimeout(this.boundsDebounceTimer);
          this.boundsDebounceTimer = setTimeout(() => {
            this.filterAndRenderPlaces();
          }, 250);
        }
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

    const defaultCenter = [43.7615, -79.4111];
    this.fallbackMap = L.map(canvas).setView(defaultCenter, 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors | Green Oil'
    }).addTo(this.fallbackMap);

    this.fallbackLayerGroup = L.layerGroup().addTo(this.fallbackMap);
  },

  // -------------------------------------------------------------
  // Area Google Places Fetching & KV Joining
  // -------------------------------------------------------------
  async loadPlacesForCurrentArea() {
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

    this.drawSelectedBoundaries();

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

    let rawPlaces = [];
    try {
      const res = await Api.searchGooglePlaces(areaQuery);
      if (res && res.success && Array.isArray(res.places) && res.places.length > 0) {
        rawPlaces = res.places;
      }
    } catch (err) {
      console.warn("Google Places proxy query error:", err);
    }

    // Merge with known KV restaurants in this area
    let localMatches = this.allRestaurants;
    if (selectedNbs.length > 0) {
      const keywords = [];
      selectedNbs.forEach(nb => {
        if (Array.isArray(nb.keywords)) {
          nb.keywords.forEach(kw => keywords.push(kw.toLowerCase()));
        }
        if (nb.nameEn) keywords.push(nb.nameEn.toLowerCase());
        const cn = (nb.nameZh || nb.name || "").split(" (")[0];
        if (cn) keywords.push(cn.toLowerCase());
      });

      localMatches = localMatches.filter(r => {
        // 1. Spatial bbox check if coordinates exist
        const rLat = parseFloat(r.latitude || r.lat);
        const rLng = parseFloat(r.longitude || r.lng);
        if (!isNaN(rLat) && !isNaN(rLng)) {
          const inAnyBbox = selectedNbs.some(nb => {
            const ft = this.neighbourhoodsMap?.get(nb.id) || nb;
            if (ft.bbox && Array.isArray(ft.bbox) && ft.bbox.length === 4) {
              return rLng >= ft.bbox[0] && rLng <= ft.bbox[2] && rLat >= ft.bbox[1] && rLat <= ft.bbox[3];
            }
            return false;
          });
          if (inAnyBbox) return true;
        }

        // 2. Fallback text search on region and address
        const reg = (r.region || "").toLowerCase();
        const addr = (r.address || "").toLowerCase();
        return keywords.some(kw => reg.includes(kw) || addr.includes(kw));
      });
    } else if (!isAll && selectedCities.length > 0) {
      const keywords = [];
      selectedCities.forEach(c => {
        const cn = c.name.split(" (")[0];
        const en = c.nameEn || "";
        if (cn) keywords.push(cn.toLowerCase());
        if (en) keywords.push(en.toLowerCase());
      });

      localMatches = localMatches.filter(r => {
        const reg = (r.region || "").toLowerCase();
        const addr = (r.address || "").toLowerCase();
        return keywords.some(kw => reg.includes(kw) || addr.includes(kw));
      });
    }

    // Merge Google places with local KV items, prioritizing Google places for discovery
    const combinedMap = new Map();
    rawPlaces.forEach(p => {
      const key = p.placeId || p.name;
      combinedMap.set(key, p);
    });

    // Merge ALL matching local KV restaurants WITHOUT slicing
    localMatches.forEach(r => {
      const key = r.placeId || r.name;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, r);
      }
    });

    // Check KV status and visit records for each place with fast O(1) hash maps
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

    this.currentPage = 1;
    this.filterAndRenderPlaces();
  },

  filterAndRenderPlaces() {
    let result = [...this.displayedPlaces];

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

    // 5. Follow Bounds Filter
    if (this.followBounds) {
      if (this.googleMap && !this.isFallbackMode && this.googleMap.getBounds()) {
        const bounds = this.googleMap.getBounds();
        result = result.filter(r => {
          const lat = parseFloat(r.latitude);
          const lng = parseFloat(r.longitude);
          if (isNaN(lat) || isNaN(lng)) return false;
          return bounds.contains(new google.maps.LatLng(lat, lng));
        });
      } else if (this.fallbackMap && this.fallbackMap.getBounds()) {
        const bounds = this.fallbackMap.getBounds();
        result = result.filter(r => {
          const lat = parseFloat(r.latitude);
          const lng = parseFloat(r.longitude);
          if (isNaN(lat) || isNaN(lng)) return false;
          return bounds.contains([lat, lng]);
        });
      }
    }

    this.filteredPlaces = result;
    this.currentPage = 1;

    this.updateResultsSummary();
    this.renderMarkers();
    this.renderPlacesCards();
  },

  updateResultsSummary() {
    const countEl = document.getElementById("mapResultsCount");
    const unsavedCountEl = document.getElementById("mapUnsavedCount");
    const regionTitleEl = document.getElementById("mapResultsRegionTitle");
    const summaryEl = document.getElementById("mapResultsSummary");

    const total = this.filteredPlaces.length;
    const unsaved = this.filteredPlaces.filter(r => !r.inKV).length;

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
  clearMarkers() {
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

    // A. Current page items
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = this.filteredPlaces.slice(startIdx, startIdx + this.pageSize);
    pageItems.forEach(r => {
      const key = r.placeId || r.name;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        markerPlaces.push(r);
      }
    });

    // B. Google Places (unsaved)
    this.filteredPlaces.forEach(r => {
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
    for (let i = 0; i < this.filteredPlaces.length && markerPlaces.length < maxMarkers; i++) {
      const r = this.filteredPlaces[i];
      const key = r.placeId || r.name;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        markerPlaces.push(r);
      }
    }

    markerPlaces.forEach(r => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const key = r.placeId || r.name;

      if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: this.googleMap,
          title: r.name,
          icon: this.getPinIcon(r, false),
          zIndex: !r.inKV ? 30 : 10
        });

        marker.addListener("click", () => {
          this.showInfoWindow(r, marker);
          this.scrollCardIntoView(key);
        });

        this.markersMap.set(key, marker);
      } else if (this.fallbackMap && this.fallbackLayerGroup && window.L) {
        const color = !r.inKV ? "#f59e0b" : "#10b981";
        const marker = L.circleMarker([lat, lng], {
          radius: !r.inKV ? 8 : 7,
          fillColor: color,
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.95
        });

        marker.bindPopup(this.getPopupHtml(r), { maxWidth: 300 });
        marker.on("click", () => {
          this.scrollCardIntoView(key);
        });

        this.fallbackLayerGroup.addLayer(marker);
        this.markersMap.set(key, marker);
      }
    });
  },

  getPinIcon(r, isHighlight) {
    const color = !r.inKV ? "#f59e0b" : "#10b981";
    const scale = isHighlight ? 1.7 : 1.35;
    const strokeColor = isHighlight ? "#2563eb" : "#ffffff";
    const strokeWeight = isHighlight ? 2.8 : 1.8;

    return {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
      fillColor: isHighlight ? "#2563eb" : color,
      fillOpacity: 1,
      strokeWeight: strokeWeight,
      strokeColor: strokeColor,
      scale: scale,
      anchor: new google.maps.Point(12, 22)
    };
  },

  highlightMarker(key, highlight) {
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
          this.markersMap.set(key, marker);
        }
      }
    }

    if (!marker) return;

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

    const card = container.querySelector(`.map-place-card[data-key="${CSS.escape(key)}"]`);
    if (card) {
      container.querySelectorAll(".map-place-card").forEach(el => el.classList.remove("is-active"));
      card.classList.add("is-active");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  },

  // -------------------------------------------------------------
  // Restaurant Photo Resolver (Real Google Places Photos & Curated Fallbacks)
  // -------------------------------------------------------------
  getRestaurantPhoto(r) {
    if (!r) {
      return {
        url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&h=300&q=80",
        emoji: "🍽️",
        isGoogle: false
      };
    }

    // 1. Direct photoUrl on restaurant record (Google Places Photo or custom)
    if (r.photoUrl || r.imageUrl || r.photo) {
      let rawUrl = r.photoUrl || r.imageUrl || r.photo;
      if (rawUrl.startsWith("/") && !rawUrl.startsWith("//")) {
        rawUrl = `${Api.getWorkerUrl()}${rawUrl}`;
      }
      return { url: rawUrl, emoji: "📸", isGoogle: true };
    }

    // 2. In-memory Google Places photo cache
    if (r.placeId && this.googlePhotosCache && this.googlePhotosCache.has(r.placeId)) {
      return { url: this.googlePhotosCache.get(r.placeId), emoji: "📸", isGoogle: true };
    }

    // 3. Browser sessionStorage cache
    if (r.placeId && r.placeId.startsWith("ChIJ")) {
      try {
        const cached = sessionStorage.getItem("gphoto_" + r.placeId);
        if (cached) {
          if (this.googlePhotosCache) this.googlePhotosCache.set(r.placeId, cached);
          return { url: cached, emoji: "📸", isGoogle: true };
        }
      } catch (e) {}
    }

    // 4. Fallback cuisine-matched placeholder (while Google Photo loads asynchronously)
    const nameLower = (r.name || "").toLowerCase();
    const catStr = (r.categoriesRaw || (r.categories ? r.categories.join(" ") : "") + " " + (r.primaryType || "")).toLowerCase();

    const pools = {
      korean: {
        emoji: "🍗",
        images: [
          "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=300&h=300&q=80"
        ]
      },
      chinese: {
        emoji: "🥢",
        images: [
          "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=300&h=300&q=80"
        ]
      },
      western: {
        emoji: "🍔",
        images: [
          "https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=300&h=300&q=80"
        ]
      },
      fish_chips: {
        emoji: "🐟",
        images: [
          "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=300&h=300&q=80"
        ]
      },
      japanese: {
        emoji: "🍱",
        images: [
          "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=300&h=300&q=80"
        ]
      },
      sweets: {
        emoji: "🍩",
        images: [
          "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1627834377411-8da5f4f09de8?auto=format&fit=crop&w=300&h=300&q=80"
        ]
      },
      pizza: {
        emoji: "🍕",
        images: [
          "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&h=300&q=80"
        ]
      },
      general: {
        emoji: "🍽️",
        images: [
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=300&h=300&q=80",
          "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=300&h=300&q=80"
        ]
      }
    };

    let targetGroup = pools.general;
    if (catStr.includes("韩式") || catStr.includes("korean") || nameLower.includes("bb.q") || nameLower.includes("korean")) {
      targetGroup = pools.korean;
    } else if (catStr.includes("中式") || catStr.includes("台式") || catStr.includes("chinese") || catStr.includes("taiwanese")) {
      targetGroup = pools.chinese;
    } else if (catStr.includes("炸鱼") || catStr.includes("薯条") || catStr.includes("fish") || catStr.includes("chips")) {
      targetGroup = pools.fish_chips;
    } else if (catStr.includes("日式") || catStr.includes("japanese") || catStr.includes("katsu") || catStr.includes("tempura") || nameLower.includes("katsu")) {
      targetGroup = pools.japanese;
    } else if (catStr.includes("甜甜圈") || catStr.includes("吉事果") || catStr.includes("热狗") || catStr.includes("donut") || catStr.includes("churro")) {
      targetGroup = pools.sweets;
    } else if (catStr.includes("披萨") || catStr.includes("pizza")) {
      targetGroup = pools.pizza;
    } else if (catStr.includes("西式") || catStr.includes("快餐") || catStr.includes("炸鸡翅") || catStr.includes("burger") || catStr.includes("wings") || catStr.includes("fried chicken") || nameLower.includes("popeyes") || nameLower.includes("church") || nameLower.includes("kfc")) {
      targetGroup = pools.western;
    }

    const seed = r.placeId || r.name || "greenoil";
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % targetGroup.images.length;
    return {
      url: targetGroup.images[idx],
      emoji: targetGroup.emoji,
      isGoogle: false
    };
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
      if (r.photoUrl) return false;
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
              const badgeEl = cardEl.querySelector(".card-thumb-badge");
              if (badgeEl) {
                badgeEl.textContent = "📸";
                badgeEl.title = "Google 实景照片";
              }
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

    if (this.filteredPlaces.length === 0) {
      const emptyTitle = lang === "en" ? "No matching restaurants found in this area" :
                         lang === "ko" ? "선택한 지역에 일치하는 음식점이 없습니다" :
                         "当前区域暂未检索到符合条件的餐馆";
      const emptySub = lang === "en" ? "Try switching category or selecting another area" :
                       lang === "ko" ? "다른 카테고리를 선택하거나 지역을 변경해 보세요" :
                       "尝试切换分类或搜索其它商圈";
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          <div style="font-weight: 600; font-size: 0.95rem;">${emptyTitle}</div>
          <div style="font-size: 0.8rem; margin-top: 0.35rem;">${emptySub}</div>
        </div>
      `;
      this.renderPagination(0);
      return;
    }

    const total = this.filteredPlaces.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = this.filteredPlaces.slice(startIdx, startIdx + this.pageSize);

    const txtInKv = lang === "en" ? "✓ In KV" : (lang === "ko" ? "✓ KV 등록" : "✓ 已在KV库");
    const txtNewPlace = lang === "en" ? "Not in KV" : (lang === "ko" ? "KV 미등록" : "未在KV库");
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
      const fallbackUrl = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&h=300&q=80";

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
        <div class="map-place-card" data-key="${this.escapeHtml(key)}" onmouseenter="window.mapExplorerHighlight('${this.escapeQuotes(key)}', true);" onmouseleave="window.mapExplorerHighlight('${this.escapeQuotes(key)}', false);" onclick="window.mapExplorerCardClick('${this.escapeQuotes(key)}');">
          <div class="card-thumb">
            <img 
              src="${photoInfo.url}" 
              alt="${this.escapeHtml(r.name)}" 
              loading="lazy" 
              class="card-img" 
              onerror="this.onerror=null; this.src='${fallbackUrl}';" 
            />
            <span class="card-thumb-badge">${photoInfo.emoji}</span>
          </div>
          <div class="card-main">
            <div class="card-title-row">
              <h4 class="card-title" title="${this.escapeHtml(r.name)}">${this.escapeHtml(r.name)}</h4>
              <span style="font-size: 0.78rem; font-weight: 700; color: #475569;">${this.escapeHtml(r.price || "$$")}</span>
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

  // -------------------------------------------------------------
  // Info Window / Popup Content
  // -------------------------------------------------------------
  getPopupHtml(r) {
    const key = r.placeId || r.name;
    const lang = this.getCurrentLanguage();
    const photoInfo = this.getRestaurantPhoto(r);
    const fallbackUrl = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&h=300&q=80";

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
          <div style="width: 48px; height: 48px; border-radius: 6px; overflow: hidden; position: relative; flex-shrink: 0; background: #f1f5f9; box-shadow: 0 1px 3px rgba(0,0,0,0.12);">
            <img src="${photoInfo.url}" alt="${this.escapeHtml(r.name)}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.onerror=null; this.src='${fallbackUrl}';" />
            <span style="position: absolute; bottom: 2px; right: 2px; font-size: 10px; line-height: 1;">${photoInfo.emoji}</span>
          </div>
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

  showInfoWindow(r, marker) {
    if (this.isFallbackMode && marker && marker.openPopup) {
      marker.openPopup();
      return;
    }

    if (!this.infoWindow || !this.googleMap) return;

    this.infoWindow.setContent(this.getPopupHtml(r));
    this.infoWindow.open(this.googleMap, marker);

    // Asynchronously resolve authentic Google photo for popup if not cached yet
    if (r.placeId && r.placeId.startsWith("ChIJ") && !r.photoUrl && !this.googlePhotosCache.has(r.placeId)) {
      this.fetchGooglePhotoForPlace(r.placeId).then(photoUrl => {
        if (photoUrl && this.infoWindow) {
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
    const r = this.displayedPlaces.find(item => (item.placeId || item.name) === key);
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

  async batchAddToKv() {
    const lang = this.getCurrentLanguage();
    const unsaved = this.filteredPlaces.filter(r => !r.inKV);
    if (unsaved.length === 0) {
      alert(lang === "en" ? "All restaurants in current view are already in KV database!" :
            lang === "ko" ? "현재 목록의 모든 매장이 이미 KV 데이터베이스에 등록되어 있습니다!" :
            "当前列表中的所有餐馆都已存在于 KV 数据库中，无需重复添加！");
      return;
    }

    const confirmMsg = lang === "en" ? `Found ${unsaved.length} restaurants not in KV database.\nBatch save all ${unsaved.length} restaurants to KV database?` :
                       lang === "ko" ? `KV 미등록 매장 ${unsaved.length}개가 발견되었습니다.\n${unsaved.length}개 매장을 클라우드 KV 데이터베이스에 일괄 저장하시겠습니까?` :
                       `检测到当前列表共有 ${unsaved.length} 家未在KV库餐馆。\n是否将这 ${unsaved.length} 家餐馆全部批量保存到云端 KV 数据库？`;

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

    const popoverSearchSubmit = document.getElementById("popoverSearchSubmit");
    if (popoverSearchSubmit) {
      popoverSearchSubmit.addEventListener("click", () => {
        if (popoverSearch) {
          this.popoverSearchQuery = popoverSearch.value.trim();
        }
        this.renderPopover();
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
        this.filterAndRenderPlaces();
      });
    }

    // Visited Select
    const visitedSelect = document.getElementById("mapVisitedSelect");
    if (visitedSelect) {
      visitedSelect.addEventListener("change", (e) => {
        this.activeVisited = e.target.value;
        this.filterAndRenderPlaces();
      });
    }

    // Outcome Select
    const outcomeSelect = document.getElementById("mapOutcomeSelect");
    if (outcomeSelect) {
      outcomeSelect.addEventListener("change", (e) => {
        this.activeOutcome = e.target.value;
        this.filterAndRenderPlaces();
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

    // Reset View Button
    const resetViewBtn = document.getElementById("mapResetViewBtn");
    if (resetViewBtn) {
      resetViewBtn.addEventListener("click", () => {
        this.drawSelectedBoundaries();
      });
    }

    // Follow Viewport Bounds
    const followBoundsCb = document.getElementById("mapFollowBounds");
    if (followBoundsCb) {
      followBoundsCb.addEventListener("change", (e) => {
        this.followBounds = e.target.checked;
        this.filterAndRenderPlaces();
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
        const places = this.filteredPlaces.slice(0, 10);
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

    // Select All
    const selectAllBtn = document.getElementById("mapBtnSelectAll");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () => {
        const pageItems = this.filteredPlaces.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize);
        pageItems.forEach(r => this.selectedMap.set(r.placeId || r.name, r));
        const msg = `已选择 ${pageItems.length} 家餐馆`;
        if (window.showToast) window.showToast(msg);
        else alert(msg);
      });
    }

    // Export Excel
    const exportExcelBtn = document.getElementById("mapBtnExportExcel");
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener("click", () => {
        if (window.XLSX && this.filteredPlaces.length > 0) {
          const rows = this.filteredPlaces.map(r => ({
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
    const r = MapExplorer.filteredPlaces.find(item => (item.placeId || item.name) === key);
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
    const r = MapExplorer.filteredPlaces.find(item => (item.placeId || item.name) === key);
    if (!r) return;
    import("./field-sales.js").then(({ FieldSales }) => {
      FieldSales.addMultipleToRoute([r], false);
    });
  };

  window.mapExplorerLogVisit = function(key) {
    const r = MapExplorer.filteredPlaces.find(item => (item.placeId || item.name) === key);
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
    MapExplorer.currentPage = p;
    MapExplorer.renderPlacesCards();
    MapExplorer.renderMarkers();
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
}
