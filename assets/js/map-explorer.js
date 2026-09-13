/**
 * Green Oil Map Explorer (地图找店)
 * Embedded Google Maps with GTA Communities & Street Filters,
 * Interactive Marker Sync, Viewport Filtering, KV Matching, and Multi-select Export.
 *
 * Includes automatic resilient fallback to Leaflet / OpenStreetMap if Google Maps JS API
 * is not yet activated on the user's Google Cloud project (ApiNotActivatedMapError).
 *
 * Terms of Service: Subject to Google Maps Platform Terms of Service:
 * https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_git_agentskills_v1
 */

import { Api } from "./api.js";
import { i18n } from "./i18n.js";

// GTA Community Hierarchy (reference Toronto rental portals like HouseSigma / Condos.ca)
export const GTA_COMMUNITIES = [
  {
    id: "all",
    name: "全部大区 (All GTA)",
    nameEn: "All GTA",
    nameKo: "광역 토론토 전체",
    center: { lat: 43.7282, lng: -79.3832 },
    zoom: 11,
    neighborhoods: []
  },
  {
    id: "downtown",
    name: "多伦多市中心 (Downtown Toronto)",
    nameEn: "Downtown Toronto",
    nameKo: "다운타운 토론토",
    center: { lat: 43.6532, lng: -79.3832 },
    zoom: 14,
    neighborhoods: [
      { id: "dt_chinatown", name: "唐人街 / 肯辛顿 (Chinatown & Kensington)", nameEn: "Chinatown & Kensington", keywords: ["spadina", "kensington", "dundas w", "college"], center: { lat: 43.6535, lng: -79.3985 }, radius: 1300, zoom: 16 },
      { id: "dt_bay_financial", name: "金融区 / 湾街 (Financial District & Bay St)", nameEn: "Financial District & Bay St", keywords: ["bay st", "king st w", "front st w", "financial", "university"], center: { lat: 43.6485, lng: -79.3817 }, radius: 1200, zoom: 16 },
      { id: "dt_yonge_dundas", name: "央街登打士 (Yonge-Dundas & Garden District)", nameEn: "Yonge-Dundas", keywords: ["dundas", "yonge", "gould", "church", "victoria"], center: { lat: 43.6560, lng: -79.3802 }, radius: 1200, zoom: 16 },
      { id: "dt_entertainment", name: "娱乐时尚区 (Entertainment District & King W)", nameEn: "Entertainment District", keywords: ["king w", "peter", "john st", "mercer", "wellington", "blue jays"], center: { lat: 43.6465, lng: -79.3905 }, radius: 1300, zoom: 16 },
      { id: "dt_queen_west", name: "西皇后街 / 艺术区 (Queen West & Trinity)", nameEn: "Queen West", keywords: ["queen w", "ossington", "augusta", "bellwoods"], center: { lat: 43.6480, lng: -79.4100 }, radius: 1500, zoom: 16 },
      { id: "dt_koreatown", name: "布鲁尔韩国城 (Koreatown Bloor)", nameEn: "Koreatown Bloor", keywords: ["bloor w", "christie", "manning", "bathurst", "markham st"], center: { lat: 43.6645, lng: -79.4180 }, radius: 1200, zoom: 16 },
      { id: "dt_yorkville", name: "约克维尔 (Bloor-Yorkville & Annex)", nameEn: "Yorkville & Annex", keywords: ["yorkville", "cumberland", "bloor e", "avenue rd", "hazelton"], center: { lat: 43.6702, lng: -79.3905 }, radius: 1300, zoom: 16 },
      { id: "dt_waterfront", name: "湖滨港口区 (Waterfront & CityPlace)", nameEn: "Waterfront & CityPlace", keywords: ["queens quay", "fort york", "harbour", "lake shore", "danforth"], center: { lat: 43.6390, lng: -79.3870 }, radius: 1800, zoom: 15 }
    ]
  },
  {
    id: "markham",
    name: "万锦 (Markham)",
    nameEn: "Markham",
    nameKo: "마컴 (Markham)",
    center: { lat: 43.8561, lng: -79.3370 },
    zoom: 13,
    neighborhoods: [
      { id: "mk_unionville", name: "于家村历史老街 (Historic Main St Unionville)", nameEn: "Unionville & Main St", keywords: ["main st", "unionville", "carlton", "fred varley", "kennedy"], center: { lat: 43.8670, lng: -79.3135 }, radius: 2200, zoom: 15 },
      { id: "mk_pacific_mall", name: "太古商圈 / 太子中心 (Pacific Mall & Milliken)", nameEn: "Pacific Mall & Milliken", keywords: ["pacific mall", "steeles", "silver star", "redlea", "milliken"], center: { lat: 43.8258, lng: -79.3060 }, radius: 1800, zoom: 16 },
      { id: "mk_fmp", name: "万锦广场 / 寰宇角 (First Markham Place & Commerce Gate)", nameEn: "First Markham Place & Commerce Gate", keywords: ["first markham", "commerce gate", "hwy 7", "woodbine", "montgomery"], center: { lat: 43.8485, lng: -79.3490 }, radius: 2000, zoom: 16 },
      { id: "mk_village_cornell", name: "万锦村 / 康奈尔 (Markham Village & Cornell)", nameEn: "Markham Village & Cornell", keywords: ["cornell", "bur oak", "markham rd", "16th ave", "9th line", "box grove"], center: { lat: 43.8820, lng: -79.2550 }, radius: 3000, zoom: 14 },
      { id: "mk_cachet", name: "凯旋豪宅商圈 (Cachet & Woodbine)", nameEn: "Cachet & Woodbine", keywords: ["cachet", "woodbine", "16th", "apple creek", "angus glen"], center: { lat: 43.8620, lng: -79.3620 }, radius: 2500, zoom: 15 }
    ]
  },
  {
    id: "north_york",
    name: "北约克 (North York)",
    nameEn: "North York",
    nameKo: "노스욕 (North York)",
    center: { lat: 43.7615, lng: -79.4111 },
    zoom: 13,
    neighborhoods: [
      { id: "ny_yonge_finch", name: "央街芬治韩国城 (Yonge & Finch / Koreatown North)", nameEn: "Yonge & Finch Koreatown", keywords: ["finch", "koreatown", "olive", "byng", "drewry", "cummer", "northtown"], center: { lat: 43.7795, lng: -79.4155 }, radius: 1600, zoom: 16 },
      { id: "ny_city_centre", name: "北约克城市中心 (Willowdale & NYCC)", nameEn: "Willowdale & NYCC", keywords: ["sheppard", "empress", "park home", "mel lastman", "doris", "beecroft"], center: { lat: 43.7675, lng: -79.4125 }, radius: 1800, zoom: 16 },
      { id: "ny_fairview", name: "锦绣商圈 / 唐米尔斯 (Don Mills & Fairview Mall)", nameEn: "Fairview Mall & Don Mills", keywords: ["fairview", "don mills", "sheppard e", "godstone"], center: { lat: 43.7780, lng: -79.3440 }, radius: 2000, zoom: 15 },
      { id: "ny_bayview", name: "湾景村社区 (Bayview Village)", nameEn: "Bayview Village", keywords: ["bayview", "sheppard e", "rector", "mallingham"], center: { lat: 43.7690, lng: -79.3870 }, radius: 1800, zoom: 15 },
      { id: "ny_york_u", name: "约克大学高地 (York University Heights & Downsview)", nameEn: "York University Heights", keywords: ["keele", "finch w", "steeles w", "allen", "chesswood", "dufferin"], center: { lat: 43.7730, lng: -79.4950 }, radius: 2600, zoom: 14 }
    ]
  },
  {
    id: "scarborough",
    name: "士嘉堡 (Scarborough)",
    nameEn: "Scarborough",
    nameKo: "스카버러 (Scarborough)",
    center: { lat: 43.7764, lng: -79.2318 },
    zoom: 13,
    neighborhoods: [
      { id: "sc_agincourt", name: "爱静阁美食商圈 (Agincourt / Midland & Sheppard)", nameEn: "Agincourt / Midland & Sheppard", keywords: ["agincourt", "midland", "glen watford", "rural", "dragon centre"], center: { lat: 43.7885, lng: -79.2780 }, radius: 2200, zoom: 15 },
      { id: "sc_stc", name: "士嘉堡市中心 (Scarborough Town Centre)", nameEn: "Scarborough Town Centre", keywords: ["borough", "mccowan", "ellesmere", "town centre"], center: { lat: 43.7745, lng: -79.2575 }, radius: 2200, zoom: 15 },
      { id: "sc_silverstar", name: "东方广场 / 锦绣中华 (Steeles & Silver Star)", nameEn: "Steeles & Silver Star", keywords: ["silver star", "steeles e", "splendid china", "redlea", "milliken"], center: { lat: 43.8235, lng: -79.2980 }, radius: 1800, zoom: 16 },
      { id: "sc_warden_finch", name: "丰泰商圈 / 华登 (Warden & Finch / Bridlewood)", nameEn: "Warden & Finch / Bridlewood", keywords: ["warden", "bridlewood", "finch e", "bamburgh"], center: { lat: 43.7990, lng: -79.3190 }, radius: 2200, zoom: 15 },
      { id: "sc_kingston", name: "悬崖公园湖滨走廊 (Guildwood & Kingston Rd)", nameEn: "Guildwood & Kingston Rd", keywords: ["kingston", "guildwood", "lawrence e", "eglinton e", "scarborough golf"], center: { lat: 43.7420, lng: -79.2150 }, radius: 3000, zoom: 14 }
    ]
  },
  {
    id: "richmond_hill",
    name: "列治文山 (Richmond Hill)",
    nameEn: "Richmond Hill",
    nameKo: "리치몬드 힐 (Richmond Hill)",
    center: { lat: 43.8828, lng: -79.4403 },
    zoom: 13,
    neighborhoods: [
      { id: "rh_times_square", name: "时代广场 / 黄金商场 (Times Square & Beaver Creek)", nameEn: "Times Square & Beaver Creek", keywords: ["times square", "beaver creek", "leslie", "hwy 7", "highway 7"], center: { lat: 43.8430, lng: -79.3875 }, radius: 1800, zoom: 16 },
      { id: "rh_centre", name: "央街老街市中心 (Richmond Hill Centre & Yonge)", nameEn: "Richmond Hill Centre & Yonge", keywords: ["yonge", "major mackenzie", "crosby", "wright"], center: { lat: 43.8765, lng: -79.4385 }, radius: 2200, zoom: 15 },
      { id: "rh_hillcrest", name: "喜尔客 / 富豪山庄 (Hillcrest Mall & South Richvale)", nameEn: "Hillcrest Mall & South Richvale", keywords: ["hillcrest", "16th ave", "carrville", "weldrick"], center: { lat: 43.8580, lng: -79.4350 }, radius: 2000, zoom: 15 },
      { id: "rh_elgin_mills", name: "爱尔金湖畔社区 (Elgin Mills & Jefferson)", nameEn: "Elgin Mills & Jefferson", keywords: ["elgin mills", "jefferson", "tower hill", "gamble"], center: { lat: 43.9050, lng: -79.4450 }, radius: 3000, zoom: 14 }
    ]
  },
  {
    id: "mississauga",
    name: "密西沙加 (Mississauga)",
    nameEn: "Mississauga",
    nameKo: "미시사가 (Mississauga)",
    center: { lat: 43.5890, lng: -79.6441 },
    zoom: 13,
    neighborhoods: [
      { id: "ms_square_one", name: "第一广场市中心 (Square One & City Centre)", nameEn: "Square One & City Centre", keywords: ["square one", "burnhamthorpe", "duke of york", "hurontario", "rathburn", "livingarts"], center: { lat: 43.5930, lng: -79.6425 }, radius: 2500, zoom: 15 },
      { id: "ms_chinatown", name: "密市中国城 (Chinatown Mississauga & Cooksville)", nameEn: "Chinatown Mississauga & Cooksville", keywords: ["cawthra", "dundas e", "cooksville", "golden square", "central pkwy"], center: { lat: 43.5840, lng: -79.6050 }, radius: 2000, zoom: 15 },
      { id: "ms_dixie", name: "迪克西餐饮长廊 (Dixie & Dundas Commercial)", nameEn: "Dixie & Dundas Commercial", keywords: ["dixie", "matheson", "tomken", "aimco"], center: { lat: 43.6050, lng: -79.5780 }, radius: 2500, zoom: 14 },
      { id: "ms_streetsville", name: "斯特里茨维尔历史小镇 (Streetsville Village)", nameEn: "Streetsville Village", keywords: ["streetsville", "queen st s", "britannia"], center: { lat: 43.5820, lng: -79.7130 }, radius: 2200, zoom: 15 },
      { id: "ms_port_credit", name: "湖滨游艇港镇 (Port Credit Waterfront)", nameEn: "Port Credit Waterfront", keywords: ["port credit", "lakeshore", "stavebank"], center: { lat: 43.5510, lng: -79.5850 }, radius: 2000, zoom: 15 }
    ]
  },
  {
    id: "vaughan",
    name: "旺市 (Vaughan)",
    nameEn: "Vaughan",
    nameKo: "본 (Vaughan)",
    center: { lat: 43.8563, lng: -79.5085 },
    zoom: 13,
    neighborhoods: [
      { id: "vg_vmc", name: "旺市大都会中心 (VMC & Jane St)", nameEn: "VMC & Jane St", keywords: ["vmc", "metropolitan", "portage", "jane", "edgeley"], center: { lat: 43.7940, lng: -79.5280 }, radius: 2200, zoom: 15 },
      { id: "vg_promenade", name: "康山商业走廊 (Thornhill & Promenade Mall)", nameEn: "Thornhill & Promenade Mall", keywords: ["promenade", "bathurst", "centre st", "clark"], center: { lat: 43.8060, lng: -79.4520 }, radius: 2200, zoom: 15 },
      { id: "vg_woodbridge", name: "伍德布里奇意大利街区 (Woodbridge & Weston Rd)", nameEn: "Woodbridge & Weston Rd", keywords: ["woodbridge", "weston rd", "hwy 7", "islington"], center: { lat: 43.7870, lng: -79.5950 }, radius: 3000, zoom: 14 },
      { id: "vg_mills_maple", name: "枫树镇 / 旺市购物中心 (Maple & Vaughan Mills)", nameEn: "Maple & Vaughan Mills", keywords: ["vaughan mills", "rutherford", "bass pro", "major mackenzie w"], center: { lat: 43.8260, lng: -79.5390 }, radius: 3000, zoom: 14 }
    ]
  }
];

export const GTA_STREETS = [
  { id: "all", name: "全部商业街廊 (All Streets)", keyword: "", path: [] },
  {
    id: "hwy7",
    name: "7号公路走廊 (Highway 7 Corridor)",
    keyword: "hwy 7",
    path: [
      { lat: 43.785, lng: -79.610 },
      { lat: 43.830, lng: -79.520 },
      { lat: 43.845, lng: -79.430 },
      { lat: 43.854, lng: -79.340 },
      { lat: 43.865, lng: -79.280 },
      { lat: 43.875, lng: -79.220 }
    ]
  },
  {
    id: "yonge",
    name: "央街走廊 (Yonge St Corridor)",
    keyword: "yonge",
    path: [
      { lat: 43.642, lng: -79.378 },
      { lat: 43.670, lng: -79.387 },
      { lat: 43.705, lng: -79.398 },
      { lat: 43.765, lng: -79.412 },
      { lat: 43.805, lng: -79.423 },
      { lat: 43.855, lng: -79.436 },
      { lat: 43.905, lng: -79.447 }
    ]
  },
  {
    id: "spadina",
    name: "士巴丹拿大道 (Spadina Ave)",
    keyword: "spadina",
    path: [
      { lat: 43.639, lng: -79.392 },
      { lat: 43.653, lng: -79.398 },
      { lat: 43.666, lng: -79.403 }
    ]
  },
  {
    id: "dundas",
    name: "登打士街 (Dundas St)",
    keyword: "dundas",
    path: [
      { lat: 43.657, lng: -79.370 },
      { lat: 43.653, lng: -79.398 },
      { lat: 43.650, lng: -79.430 },
      { lat: 43.648, lng: -79.480 },
      { lat: 43.590, lng: -79.620 }
    ]
  },
  {
    id: "steeles",
    name: "士刁大道 (Steeles Ave Strip)",
    keyword: "steeles",
    path: [
      { lat: 43.780, lng: -79.620 },
      { lat: 43.795, lng: -79.520 },
      { lat: 43.810, lng: -79.420 },
      { lat: 43.823, lng: -79.310 },
      { lat: 43.835, lng: -79.230 }
    ]
  },
  {
    id: "sheppard",
    name: "雪柏大道 (Sheppard Ave Corridor)",
    keyword: "sheppard",
    path: [
      { lat: 43.755, lng: -79.520 },
      { lat: 43.762, lng: -79.412 },
      { lat: 43.775, lng: -79.330 },
      { lat: 43.788, lng: -79.250 },
      { lat: 43.805, lng: -79.180 }
    ]
  },
  {
    id: "midland",
    name: "米兰街 (Midland Ave Food Strip)",
    keyword: "midland",
    path: [
      { lat: 43.715, lng: -79.250 },
      { lat: 43.755, lng: -79.263 },
      { lat: 43.788, lng: -79.278 },
      { lat: 43.823, lng: -79.298 }
    ]
  },
  {
    id: "burnhamthorpe",
    name: "伯纳姆索普路 (Burnhamthorpe Rd / Square One)",
    keyword: "burnhamthorpe",
    path: [
      { lat: 43.645, lng: -79.540 },
      { lat: 43.615, lng: -79.600 },
      { lat: 43.593, lng: -79.645 },
      { lat: 43.560, lng: -79.720 }
    ]
  },
  {
    id: "queen",
    name: "皇后街 (Queen St Commercial Strip)",
    keyword: "queen",
    path: [
      { lat: 43.665, lng: -79.300 },
      { lat: 43.655, lng: -79.375 },
      { lat: 43.648, lng: -79.415 },
      { lat: 43.640, lng: -79.445 }
    ]
  },
  {
    id: "bloor",
    name: "布鲁尔街 (Bloor St Corridor)",
    keyword: "bloor",
    path: [
      { lat: 43.673, lng: -79.370 },
      { lat: 43.668, lng: -79.395 },
      { lat: 43.664, lng: -79.420 },
      { lat: 43.652, lng: -79.465 },
      { lat: 43.645, lng: -79.530 }
    ]
  },
  {
    id: "major_mackenzie",
    name: "麦健时少校大道 (Major Mackenzie Dr)",
    keyword: "major mackenzie",
    path: [
      { lat: 43.840, lng: -79.590 },
      { lat: 43.865, lng: -79.510 },
      { lat: 43.876, lng: -79.435 },
      { lat: 43.885, lng: -79.350 },
      { lat: 43.895, lng: -79.250 }
    ]
  }
];

export const MapExplorer = {
  isInitialized: false,
  googleMap: null,
  placesService: null,
  markersMap: new Map(), // key -> Google Marker or Leaflet Marker
  infoWindow: null,
  allRestaurants: [],
  filteredRestaurants: [],
  selectedMap: new Map(), // key -> Restaurant

  // Fallback map state
  isFallbackMode: false,
  fallbackMap: null,
  fallbackLayerGroup: null,

  // KV Identification Tracking Sets
  kvPlaceIdsSet: new Set(),
  kvNormalizedNamesSet: new Set(),
  
  // Filter States
  activeCityId: "all",
  activeNeighborhoodId: "all",
  activeStreetId: "all",
  activeNeighborhoodIds: new Set(["all"]),
  activeStreetIds: new Set(["all"]),
  boundaryOverlays: [],
  currentZoom: 11,
  zoomDebounceTimer: null,
  activeCategory: "全部",
  activeKvFilter: "all", // "all", "saved", "unsaved"
  searchKeyword: "",
  followBounds: false,
  boundsDebounceTimer: null,

  // Pagination for bottom list
  currentPage: 1,
  pageSize: 25,

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.setupAuthFailureHandler();
    this.populateSelects();
    this.populateNeighborhoodPills();
    this.populateStreetPills();
    this.bindEvents();

    // 1. Fetch Google Maps API Key and initialize map
    await this.initGoogleMap();

    // 2. Load all restaurants data from KV
    await this.loadAllRestaurants();
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

    const badge = document.getElementById("mapMarkerCountBadge");
    if (badge) {
      badge.style.background = "#fef3c7";
      badge.style.color = "#b45309";
    }

    this.initFallbackMap();
  },

  populateSelects() {
    const streetSelect = document.getElementById("mapStreetSelect");
    if (streetSelect) {
      streetSelect.innerHTML = GTA_STREETS.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    }

    this.updateNeighborhoodSelect();
  },

  updateNeighborhoodSelect() {
    const nhSelect = document.getElementById("mapNeighborhoodSelect");
    if (!nhSelect) return;

    const city = GTA_COMMUNITIES.find(c => c.id === this.activeCityId);
    if (!city || !city.neighborhoods || city.neighborhoods.length === 0) {
      nhSelect.innerHTML = `<option value="all">全部社区 (All Neighborhoods)</option>`;
      nhSelect.disabled = true;
      this.activeNeighborhoodId = "all";
      return;
    }

    nhSelect.disabled = false;
    let html = `<option value="all">全部社区 (该区域下全部)</option>`;
    html += city.neighborhoods.map(n => `<option value="${n.id}">${n.name}</option>`).join("");
    nhSelect.innerHTML = html;
    nhSelect.value = this.activeNeighborhoodId;
  },

  populateNeighborhoodPills() {
    const container = document.getElementById("mapNeighborhoodPills");
    if (!container) return;

    const city = GTA_COMMUNITIES.find(c => c.id === this.activeCityId);
    let neighborhoods = [];
    if (city && city.neighborhoods && city.neighborhoods.length > 0) {
      neighborhoods = city.neighborhoods;
    } else {
      GTA_COMMUNITIES.forEach(c => {
        if (c.neighborhoods) neighborhoods.push(...c.neighborhoods);
      });
    }

    const pool = (city && city.id !== "all") 
      ? this.allRestaurants.filter(r => r.region && r.region.includes(city.name.split(" ")[0]))
      : this.allRestaurants;

    const isAll = this.activeNeighborhoodIds.has("all");
    let html = `
      <button type="button" class="map-pill-btn ${isAll ? 'active' : ''}" data-id="all">
        全部社区 <span class="map-pill-count">${pool.length}</span>
      </button>
    `;

    html += neighborhoods.map(nh => {
      const isActive = !isAll && this.activeNeighborhoodIds.has(nh.id);
      let count = 0;
      if (nh.keywords && nh.keywords.length > 0) {
        count = pool.filter(r => {
          const text = [r.address, r.name, r.hubName, r.hubId].join(" ").toLowerCase();
          return nh.keywords.some(kw => text.includes(kw.toLowerCase()));
        }).length;
      }
      const shortName = nh.name.split(" (")[0];
      return `
        <button type="button" class="map-pill-btn ${isActive ? 'active' : ''}" data-id="${nh.id}" title="${nh.name}">
          ${shortName} <span class="map-pill-count">${count}</span>
        </button>
      `;
    }).join("");

    container.innerHTML = html;
    this.updateNeighborhoodBadge();
  },

  populateStreetPills() {
    const container = document.getElementById("mapStreetPills");
    if (!container) return;

    const pool = this.allRestaurants;
    const isAll = this.activeStreetIds.has("all");

    let html = `
      <button type="button" class="map-pill-btn ${isAll ? 'active' : ''}" data-id="all">
        全部走廊 <span class="map-pill-count">${pool.length}</span>
      </button>
    `;

    const streets = GTA_STREETS.filter(s => s.id !== "all");
    html += streets.map(st => {
      const isActive = !isAll && this.activeStreetIds.has(st.id);
      const count = pool.filter(r => (r.address || "").toLowerCase().includes(st.keyword.toLowerCase())).length;
      const shortName = st.name.split(" (")[0];
      return `
        <button type="button" class="map-pill-btn ${isActive ? 'active' : ''}" data-id="${st.id}" title="${st.name}">
          ${shortName} <span class="map-pill-count">${count}</span>
        </button>
      `;
    }).join("");

    container.innerHTML = html;
    this.updateStreetBadge();
  },

  updateNeighborhoodBadge() {
    const badge = document.getElementById("mapSelectedNeighborhoodsCount");
    if (!badge) return;
    if (this.activeNeighborhoodIds.has("all")) {
      badge.textContent = "全部社区";
      badge.style.background = "#e0f2fe";
      badge.style.color = "#0369a1";
    } else {
      const count = this.activeNeighborhoodIds.size;
      badge.textContent = `已选 ${count} 个商圈`;
      badge.style.background = "#dbeafe";
      badge.style.color = "#1d4ed8";
    }
  },

  updateStreetBadge() {
    const badge = document.getElementById("mapSelectedStreetsCount");
    if (!badge) return;
    if (this.activeStreetIds.has("all")) {
      badge.textContent = "全部走廊";
      badge.style.background = "#e0f2fe";
      badge.style.color = "#0369a1";
    } else {
      const count = this.activeStreetIds.size;
      badge.textContent = `已选 ${count} 条走廊`;
      badge.style.background = "#ede9fe";
      badge.style.color = "#6d28d9";
    }
  },

  clearBoundaries() {
    if (this.boundaryOverlays && this.boundaryOverlays.length > 0) {
      this.boundaryOverlays.forEach(overlay => {
        if (overlay.setMap) {
          overlay.setMap(null);
        } else if (overlay.remove) {
          overlay.remove();
        }
      });
      this.boundaryOverlays = [];
    }
  },

  drawSelectedBoundaries() {
    this.clearBoundaries();

    const isAllNhs = this.activeNeighborhoodIds.has("all");
    const isAllSts = this.activeStreetIds.has("all");
    if (isAllNhs && isAllSts) return;

    // Collect coordinates to fit map bounds
    let googleBounds = null;
    let leafletBounds = [];

    if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
      googleBounds = new google.maps.LatLngBounds();
    }

    // 1. Draw Neighborhood boundaries (Circles)
    if (!isAllNhs) {
      this.activeNeighborhoodIds.forEach(nhId => {
        let nh = null;
        for (const city of GTA_COMMUNITIES) {
          const found = (city.neighborhoods || []).find(n => n.id === nhId);
          if (found) { nh = found; break; }
        }
        if (!nh || !nh.center) return;

        const radius = nh.radius || 2000;

        if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
          const circle = new google.maps.Circle({
            strokeColor: "#2563eb",
            strokeOpacity: 0.85,
            strokeWeight: 2,
            fillColor: "#3b82f6",
            fillOpacity: 0.12,
            map: this.googleMap,
            center: nh.center,
            radius: radius,
            clickable: false
          });
          this.boundaryOverlays.push(circle);
          googleBounds.union(circle.getBounds());
        } else if (this.fallbackMap && window.L) {
          const circle = L.circle([nh.center.lat, nh.center.lng], {
            color: "#2563eb",
            weight: 2,
            fillColor: "#3b82f6",
            fillOpacity: 0.12,
            radius: radius
          }).addTo(this.fallbackMap);
          circle.bindTooltip(nh.name.split(" (")[0], { permanent: true, direction: "top", className: "map-boundary-tooltip" });
          this.boundaryOverlays.push(circle);
          leafletBounds.push(circle.getBounds());
        }
      });
    }

    // 2. Draw Commercial Street corridors (Polylines)
    if (!isAllSts) {
      this.activeStreetIds.forEach(stId => {
        const st = GTA_STREETS.find(s => s.id === stId);
        if (!st || !st.path || st.path.length === 0) return;

        if (this.googleMap && !this.isFallbackMode && window.google && window.google.maps) {
          const polyline = new google.maps.Polyline({
            path: st.path,
            geodesic: true,
            strokeColor: "#7c3aed",
            strokeOpacity: 0.85,
            strokeWeight: 5,
            map: this.googleMap
          });
          this.boundaryOverlays.push(polyline);
          st.path.forEach(pt => googleBounds.extend(pt));
        } else if (this.fallbackMap && window.L) {
          const polyline = L.polyline(st.path.map(p => [p.lat, p.lng]), {
            color: "#7c3aed",
            weight: 5,
            opacity: 0.85
          }).addTo(this.fallbackMap);
          polyline.bindTooltip(st.name.split(" (")[0], { sticky: true, className: "map-boundary-tooltip" });
          this.boundaryOverlays.push(polyline);
          leafletBounds.push(polyline.getBounds());
        }
      });
    }

    // Fit map bounds to encompass all selected boundaries
    if (googleBounds && !googleBounds.isEmpty()) {
      this.googleMap.fitBounds(googleBounds);
      const listener = google.maps.event.addListenerOnce(this.googleMap, "idle", () => {
        if (this.googleMap.getZoom() > 16) {
          this.googleMap.setZoom(16);
        }
      });
    } else if (this.fallbackMap && leafletBounds.length > 0) {
      let combined = leafletBounds[0];
      for (let i = 1; i < leafletBounds.length; i++) {
        combined = combined.extend(leafletBounds[i]);
      }
      this.fallbackMap.fitBounds(combined, { maxZoom: 16 });
    }
  },


  async initGoogleMap() {
    const canvas = document.getElementById("mapExplorerCanvas");
    if (!canvas) return;

    if (window.google && window.google.maps) {
      this.createMapInstance();
      return;
    }

    const apiKey = await Api.getGoogleMapsApiKey();
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
      console.warn("Failed to load Google Maps script, enabling fallback interactive map:", e);
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
      const defaultCenter = { lat: 43.7282, lng: -79.3832 }; // Central GTA
      this.googleMap = new google.maps.Map(canvas, {
        center: defaultCenter,
        zoom: 11,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: true,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.TOP_RIGHT
        },
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true
      });

      if (google.maps.places) {
        this.placesService = new google.maps.places.PlacesService(this.googleMap);
      }

      this.infoWindow = new google.maps.InfoWindow();

      this.googleMap.addListener("idle", () => {
        if (this.followBounds) {
          clearTimeout(this.boundsDebounceTimer);
          this.boundsDebounceTimer = setTimeout(() => {
            this.applyFilters(false);
          }, 250);
        }
      });

      this.googleMap.addListener("zoom_changed", () => {
        clearTimeout(this.zoomDebounceTimer);
        this.zoomDebounceTimer = setTimeout(() => {
          const newZoom = this.googleMap.getZoom();
          const wasClustered = this.currentZoom < 14;
          const isClustered = newZoom < 14 && this.activeNeighborhoodIds.has("all");
          this.currentZoom = newZoom;
          this.updateResultsHeader();
          if (wasClustered !== isClustered || isClustered) {
            this.renderMarkers();
          }
        }, 150);
      });

      this.googleMap.addListener("click", (e) => {
        if (e.placeId) {
          e.stop();
          this.handlePoiClick(e.placeId, e.latLng);
        }
      });
    } catch (err) {
      console.warn("Google Maps instantiation failed:", err);
      this.triggerFallbackMode();
    }
  },

  // -------------------------------------------------------------
  // Resilient Fallback Map (Leaflet / OpenStreetMap)
  // -------------------------------------------------------------
  async initFallbackMap() {
    const canvas = document.getElementById("mapExplorerCanvas");
    if (!canvas) return;

    // Load Leaflet CSS
    if (!document.getElementById("leafletCss")) {
      const link = document.createElement("link");
      link.id = "leafletCss";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS
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

    // Reset canvas container
    canvas.innerHTML = "";
    if (this.fallbackMap) {
      this.fallbackMap.remove();
      this.fallbackMap = null;
    }

    const defaultCenter = [43.7282, -79.3832];
    this.fallbackMap = L.map(canvas).setView(defaultCenter, 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors | Green Oil'
    }).addTo(this.fallbackMap);

    this.fallbackLayerGroup = L.layerGroup().addTo(this.fallbackMap);

    this.fallbackMap.on("zoomend", () => {
      clearTimeout(this.zoomDebounceTimer);
      this.zoomDebounceTimer = setTimeout(() => {
        const newZoom = this.fallbackMap.getZoom();
        const wasClustered = this.currentZoom < 14;
        const isClustered = newZoom < 14 && this.activeNeighborhoodIds.has("all");
        this.currentZoom = newZoom;
        this.updateResultsHeader();
        if (wasClustered !== isClustered || isClustered) {
          this.renderMarkers();
        }
      }, 150);
    });

    if (this.filteredRestaurants.length > 0) {
      this.renderMarkers();
    }
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
    const badge = document.getElementById("mapMarkerCountBadge");
    if (badge) badge.textContent = "正在读取全量餐馆数据...";

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
        const res = await Api.queryRestaurants({ page: 1, pageSize: 200 });
        this.allRestaurants = (res.data || []).map(r => {
          r.inKV = true;
          if (r.placeId) this.kvPlaceIdsSet.add(r.placeId);
          if (r.name) this.kvNormalizedNamesSet.add(r.name.trim().toLowerCase());
          return r;
        });
      }
    } catch (e) {
      console.warn("Failed to load map restaurants dataset:", e);
    }

    if (badge) badge.textContent = `已收录 ${this.allRestaurants.length.toLocaleString()} 家餐馆`;
    this.populateNeighborhoodPills();
    this.populateStreetPills();
    this.applyFilters(true);
  },

  bindEvents() {
    const citySelect = document.getElementById("mapCitySelect");
    if (citySelect) {
      citySelect.addEventListener("change", (e) => {
        this.activeCityId = e.target.value;
        this.activeNeighborhoodId = "all";
        this.activeNeighborhoodIds.clear();
        this.activeNeighborhoodIds.add("all");
        this.updateNeighborhoodSelect();
        this.populateNeighborhoodPills();
        this.clearBoundaries();
        this.panToSelectedArea();
        this.applyFilters(true);
      });
    }

    // Neighborhood Pills Multi-Select Click Handler
    const nhContainer = document.getElementById("mapNeighborhoodPills");
    if (nhContainer) {
      nhContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".map-pill-btn");
        if (!btn) return;
        const id = btn.dataset.id;
        if (!id) return;

        if (id === "all") {
          this.activeNeighborhoodIds.clear();
          this.activeNeighborhoodIds.add("all");
        } else {
          this.activeNeighborhoodIds.delete("all");
          if (this.activeNeighborhoodIds.has(id)) {
            this.activeNeighborhoodIds.delete(id);
          } else {
            this.activeNeighborhoodIds.add(id);
          }
          if (this.activeNeighborhoodIds.size === 0) {
            this.activeNeighborhoodIds.add("all");
          }
        }

        this.populateNeighborhoodPills();
        this.drawSelectedBoundaries();
        this.applyFilters(false);
      });
    }

    // Street Pills Multi-Select Click Handler
    const stContainer = document.getElementById("mapStreetPills");
    if (stContainer) {
      stContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".map-pill-btn");
        if (!btn) return;
        const id = btn.dataset.id;
        if (!id) return;

        if (id === "all") {
          this.activeStreetIds.clear();
          this.activeStreetIds.add("all");
        } else {
          this.activeStreetIds.delete("all");
          if (this.activeStreetIds.has(id)) {
            this.activeStreetIds.delete(id);
          } else {
            this.activeStreetIds.add(id);
          }
          if (this.activeStreetIds.size === 0) {
            this.activeStreetIds.add("all");
          }
        }

        this.populateStreetPills();
        this.drawSelectedBoundaries();
        this.applyFilters(false);
      });
    }

    // Quick Action: All / Clear Neighborhoods
    const btnAllNhs = document.getElementById("mapBtnAllNeighborhoods");
    if (btnAllNhs) {
      btnAllNhs.addEventListener("click", () => {
        const city = GTA_COMMUNITIES.find(c => c.id === this.activeCityId);
        let nhs = [];
        if (city && city.neighborhoods && city.neighborhoods.length > 0) {
          nhs = city.neighborhoods;
        } else {
          GTA_COMMUNITIES.forEach(c => {
            if (c.neighborhoods) nhs.push(...c.neighborhoods);
          });
        }
        this.activeNeighborhoodIds.clear();
        nhs.forEach(n => this.activeNeighborhoodIds.add(n.id));
        this.populateNeighborhoodPills();
        this.drawSelectedBoundaries();
        this.applyFilters(false);
      });
    }

    const btnClearNhs = document.getElementById("mapBtnClearNeighborhoods");
    if (btnClearNhs) {
      btnClearNhs.addEventListener("click", () => {
        this.activeNeighborhoodIds.clear();
        this.activeNeighborhoodIds.add("all");
        this.populateNeighborhoodPills();
        this.clearBoundaries();
        this.panToSelectedArea();
        this.applyFilters(false);
      });
    }

    // Quick Action: All / Clear Commercial Streets
    const btnAllSts = document.getElementById("mapBtnAllStreets");
    if (btnAllSts) {
      btnAllSts.addEventListener("click", () => {
        this.activeStreetIds.clear();
        GTA_STREETS.filter(s => s.id !== "all").forEach(s => this.activeStreetIds.add(s.id));
        this.populateStreetPills();
        this.drawSelectedBoundaries();
        this.applyFilters(false);
      });
    }

    const btnClearSts = document.getElementById("mapBtnClearStreets");
    if (btnClearSts) {
      btnClearSts.addEventListener("click", () => {
        this.activeStreetIds.clear();
        this.activeStreetIds.add("all");
        this.populateStreetPills();
        this.clearBoundaries();
        this.panToSelectedArea();
        this.applyFilters(false);
      });
    }

    const kvFilterSelect = document.getElementById("mapKvStatusSelect");
    if (kvFilterSelect) {
      kvFilterSelect.addEventListener("change", (e) => {
        this.activeKvFilter = e.target.value;
        this.applyFilters(false);
      });
    }

    const kwInput = document.getElementById("mapKeywordInput");
    if (kwInput) {
      kwInput.addEventListener("input", (e) => {
        this.searchKeyword = e.target.value.trim().toLowerCase();
        this.applyFilters(false);
      });
      kwInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.searchKeywordGooglePlaces();
        }
      });
    }

    const btnSearchGmap = document.getElementById("mapBtnSearchGmap");
    if (btnSearchGmap) {
      btnSearchGmap.addEventListener("click", () => this.searchKeywordGooglePlaces());
    }

    const btnExploreGmap = document.getElementById("mapBtnExploreGmap");
    if (btnExploreGmap) {
      btnExploreGmap.addEventListener("click", () => this.exploreCurrentAreaGooglePlaces());
    }

    const pillsContainer = document.getElementById("mapCategoryPills");
    if (pillsContainer) {
      pillsContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".cat-pill");
        if (!btn) return;
        pillsContainer.querySelectorAll(".cat-pill").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        this.activeCategory = btn.dataset.category || "全部";
        this.applyFilters(false);
      });
    }

    const followCheck = document.getElementById("mapFollowBounds");
    if (followCheck) {
      followCheck.addEventListener("change", (e) => {
        this.followBounds = e.target.checked;
        if (this.followBounds) {
          this.applyFilters(false);
        }
      });
    }

    const resetBtn = document.getElementById("mapResetViewBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.panToSelectedArea());
    }

    const btnSelectAll = document.getElementById("mapBtnSelectAll");
    if (btnSelectAll) {
      btnSelectAll.addEventListener("click", () => this.toggleSelectCurrentPage());
    }

    const btnSelectArea = document.getElementById("mapBtnSelectArea");
    if (btnSelectArea) {
      btnSelectArea.addEventListener("click", () => this.selectAllFiltered());
    }

    const btnClearSelection = document.getElementById("mapBtnClearSelection");
    if (btnClearSelection) {
      btnClearSelection.addEventListener("click", () => this.clearSelection());
    }

    const thSelectAll = document.getElementById("mapThSelectAll");
    if (thSelectAll) {
      thSelectAll.addEventListener("change", (e) => {
        this.setSelectCurrentPage(e.target.checked);
      });
    }

    const btnBatchKv = document.getElementById("mapBtnBatchAddToKv");
    if (btnBatchKv) {
      btnBatchKv.addEventListener("click", () => this.batchAddToKv());
    }

    const btnExport = document.getElementById("mapBtnExportExcel");
    if (btnExport) {
      btnExport.addEventListener("click", () => this.exportSelectedExcel());
    }

    const btnRoute = document.getElementById("mapBtnPlanRoute");
    if (btnRoute) {
      btnRoute.addEventListener("click", () => this.planRouteSelected());
    }
  },

  panToSelectedArea() {
    // If specific neighborhood or street boundaries are selected, fit to them
    if (!this.activeNeighborhoodIds.has("all") || !this.activeStreetIds.has("all")) {
      this.drawSelectedBoundaries();
      return;
    }

    const city = GTA_COMMUNITIES.find(c => c.id === this.activeCityId);
    if (!city) return;

    let center = city.center;
    let zoom = city.zoom || 12;

    if (this.googleMap && !this.isFallbackMode) {
      this.googleMap.panTo(center);
      this.googleMap.setZoom(zoom);
    } else if (this.fallbackMap) {
      this.fallbackMap.setView([center.lat, center.lng], zoom);
    }
  },

  // -------------------------------------------------------------
  // Live Google Maps Places Exploration & POI Click
  // -------------------------------------------------------------
  async exploreCurrentAreaGooglePlaces() {
    const btn = document.getElementById("mapBtnExploreGmap");
    const origText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>⏳</span> <span>探测中...</span>`;
    }

    try {
      let center = { lat: 43.7615, lng: -79.4111 };
      let radius = 3000;
      let areaLabel = "大多伦多";
      let locationQuery = "";

      const city = GTA_COMMUNITIES.find(c => c.id === this.activeCityId);

      if (!this.activeNeighborhoodIds.has("all")) {
        const selectedNhs = [];
        GTA_COMMUNITIES.forEach(c => {
          (c.neighborhoods || []).forEach(n => {
            if (this.activeNeighborhoodIds.has(n.id)) selectedNhs.push(n);
          });
        });
        if (selectedNhs.length > 0) {
          center = selectedNhs[0].center;
          radius = selectedNhs[0].radius || 2500;
          areaLabel = selectedNhs.map(n => n.name.split(" ")[0]).slice(0, 3).join("+");
          if (selectedNhs.length > 3) areaLabel += `等${selectedNhs.length}商圈`;
          locationQuery = selectedNhs.map(n => n.nameEn || n.name).join(" ");
        }
      } else if (city && city.id !== "all") {
        areaLabel = city.name.split(" ")[0];
        locationQuery = city.nameEn || city.name;
        if (city.center) {
          center = city.center;
          radius = 4500;
        }
      } else if (this.googleMap && this.googleMap.getCenter()) {
        const c = this.googleMap.getCenter();
        center = { lat: c.lat(), lng: c.lng() };
        radius = 3500;
      } else if (this.fallbackMap) {
        const c = this.fallbackMap.getCenter();
        center = { lat: c.lat, lng: c.lng };
        radius = 3500;
      }

      if (!this.activeStreetIds.has("all")) {
        const selectedSts = GTA_STREETS.filter(s => this.activeStreetIds.has(s.id));
        if (selectedSts.length > 0) {
          areaLabel += ` · ${selectedSts.map(s => s.name.split(" ")[0]).join("+")}`;
          locationQuery = `${selectedSts.map(s => s.name.split(" ")[0]).join(" ")} ${locationQuery}`;
        }
      }

      // Build specific search query
      let queryTerm = "";
      if (this.searchKeyword) {
        queryTerm = `${this.searchKeyword} ${locationQuery}`.trim();
      } else if (this.activeCategory !== "全部") {
        queryTerm = `${this.activeCategory} ${locationQuery}`.trim();
      } else {
        queryTerm = locationQuery ? `restaurants in ${locationQuery}` : "restaurants in Toronto GTA";
      }

      const res = await Api.searchGooglePlaces(queryTerm, {
        lat: center.lat,
        lng: center.lng,
        radius
      });

      if (res && res.success && Array.isArray(res.places) && res.places.length > 0) {
        let newAddedCount = 0;
        let totalUnsavedCount = 0;

        res.places.forEach(p => {
          const inKV = this.checkIsInKv(p);
          p.inKV = inKV;
          if (!inKV) totalUnsavedCount++;

          const existingIdx = this.allRestaurants.findIndex(item => 
            (item.placeId && item.placeId === p.placeId) || 
            (item.name.toLowerCase() === p.name.toLowerCase())
          );

          if (existingIdx >= 0) {
            this.allRestaurants[existingIdx].inKV = inKV;
          } else {
            this.allRestaurants.unshift(p);
            newAddedCount++;
          }
        });

        this.applyFilters(false);

        const totalReturned = res.places.length;
        const alreadyInKv = totalReturned - totalUnsavedCount;

        let alertMsg = `📍 探测完成！在【${areaLabel}】共检索到 ${totalReturned} 家 Google 地图餐馆：\n\n`;
        alertMsg += `• 🆕 未入库新店：${totalUnsavedCount} 家（已在列表中以琥珀色标出）\n`;
        alertMsg += `• ✓ 已在 KV 库：${alreadyInKv} 家\n`;
        if (newAddedCount > 0) {
          alertMsg += `• ➕ 本次新载入列表：${newAddedCount} 家\n`;
        }
        if (totalUnsavedCount > 0) {
          alertMsg += `\n💡 提示：您可以勾选餐馆，或直接点击上方绿色的【📥 批量添加到KV】一键永久保存到云端数据库！`;
        }
        alert(alertMsg);
      } else {
        alert(res?.error || "未在当前区域检索到新餐馆，请尝试调整关键词或社区范围。");
      }
    } catch (err) {
      console.error("exploreCurrentAreaGooglePlaces error:", err);
      alert("检索 Google 地图餐馆失败: " + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
  },

  async searchKeywordGooglePlaces() {
    const kw = this.searchKeyword;
    if (!kw) {
      alert("请输入要检索的餐馆名称或关键词（例如 SMSHBRGR）");
      return;
    }

    const btn = document.getElementById("mapBtnSearchGmap");
    const origText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>⏳</span>`;
    }

    try {
      const res = await Api.searchGooglePlaces(kw);
      if (res && res.success && Array.isArray(res.places) && res.places.length > 0) {
        let newCount = 0;
        res.places.forEach(p => {
          const inKV = this.checkIsInKv(p);
          p.inKV = inKV;

          const existing = this.allRestaurants.find(item => 
            (item.placeId && item.placeId === p.placeId) || 
            (item.name.toLowerCase() === p.name.toLowerCase())
          );
          if (!existing) {
            this.allRestaurants.unshift(p);
            if (!inKV) newCount++;
          }
        });

        this.applyFilters(false);

        // Pan to first found item
        const first = res.places[0];
        if (first && first.latitude && first.longitude) {
          const pos = [parseFloat(first.latitude), parseFloat(first.longitude)];
          if (this.googleMap && !this.isFallbackMode) {
            this.googleMap.panTo({ lat: pos[0], lng: pos[1] });
            this.googleMap.setZoom(16);
          } else if (this.fallbackMap) {
            this.fallbackMap.setView(pos, 16);
          }
        }

        alert(`Google 地图检索完成：检索到 ${res.places.length} 家餐馆 (其中 ${newCount} 家为未入库新店)`);
      } else {
        alert("Google 地图未检索到匹配的餐馆");
      }
    } catch (e) {
      console.error(e);
      alert("搜索出错: " + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
  },

  handlePoiClick(placeId, latLng) {
    if (!this.placesService) return;

    this.placesService.getDetails({ placeId, fields: ["name", "formatted_address", "formatted_phone_number", "rating", "user_ratings_total", "price_level", "types", "geometry"] }, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        const norm = {
          placeId,
          name: place.name || "未命名餐馆",
          address: place.formatted_address || "",
          phone: place.formatted_phone_number || "无",
          rating: place.rating || 4.2,
          reviews: place.user_ratings_total || 1,
          price: place.price_level ? "$".repeat(place.price_level) : "$$",
          categoriesRaw: (place.types || []).slice(0, 3).join(", "),
          latitude: place.geometry?.location?.lat() || latLng.lat(),
          longitude: place.geometry?.location?.lng() || latLng.lng(),
          region: "全部 (All GTA)",
          status: "营业中"
        };

        const inKV = this.checkIsInKv(norm);
        norm.inKV = inKV;

        const existing = this.allRestaurants.find(r => (r.placeId || r.name) === placeId);
        if (!existing) {
          this.allRestaurants.unshift(norm);
          this.applyFilters(false);
        }

        const marker = this.markersMap.get(placeId);
        if (marker) {
          this.showInfoWindow(norm, marker);
        }
      }
    });
  },

  // -------------------------------------------------------------
  // Filter Engine
  // -------------------------------------------------------------
  applyFilters(autoCenterIfAppropriate = false) {
    let result = [...this.allRestaurants];

    // Ensure all items have inKV properly evaluated
    result.forEach(r => {
      r.inKV = this.checkIsInKv(r);
    });

    // 1. City Filter
    const regionMap = {
      downtown: "多伦多市中心",
      markham: "万锦",
      north_york: "北约克",
      scarborough: "士嘉堡",
      richmond_hill: "列治文山",
      mississauga: "密西沙加",
      vaughan: "旺市"
    };

    if (this.activeCityId !== "all" && regionMap[this.activeCityId]) {
      const matchCityStr = regionMap[this.activeCityId];
      result = result.filter(r => r.region && r.region.includes(matchCityStr));
    }

    // 2. Multi-Neighborhood Filter
    if (!this.activeNeighborhoodIds.has("all")) {
      const selectedNhs = [];
      GTA_COMMUNITIES.forEach(c => {
        (c.neighborhoods || []).forEach(n => {
          if (this.activeNeighborhoodIds.has(n.id)) {
            selectedNhs.push(n);
          }
        });
      });

      result = result.filter(r => {
        const text = [r.address, r.name, r.hubName, r.hubId].join(" ").toLowerCase();
        return selectedNhs.some(nh => nh.keywords && nh.keywords.some(kw => text.includes(kw.toLowerCase())));
      });
    }

    // 3. Multi-Street Filter
    if (!this.activeStreetIds.has("all")) {
      const selectedStreets = GTA_STREETS.filter(s => this.activeStreetIds.has(s.id));
      result = result.filter(r => {
        const text = (r.address || "").toLowerCase();
        return selectedStreets.some(st => st.keyword && text.includes(st.keyword.toLowerCase()));
      });
    }

    // 4. KV Status Filter
    if (this.activeKvFilter === "saved") {
      result = result.filter(r => r.inKV === true);
    } else if (this.activeKvFilter === "unsaved") {
      result = result.filter(r => r.inKV !== true);
    }

    // 5. Category Filter
    if (this.activeCategory !== "全部") {
      result = result.filter(r => {
        const catText = r.categoriesRaw || (r.categories ? r.categories.join(" ") : "");
        return catText.includes(this.activeCategory);
      });
    }

    // 6. Keyword Search
    if (this.searchKeyword) {
      result = result.filter(r => {
        const text = [
          r.name,
          r.address,
          r.phone,
          r.categoriesRaw,
          r.hubName
        ].join(" ").toLowerCase();
        return text.includes(this.searchKeyword);
      });
    }

    // 7. Viewport Bounds Filter (if enabled)
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

    this.filteredRestaurants = result;
    this.currentPage = 1;

    // Update UI Elements
    this.updateResultsHeader();
    this.renderMarkers();
    this.renderTable();
    this.updateSelectionUI();
  },

  updateResultsHeader() {
    const titleEl = document.getElementById("mapResultsRegionTitle");
    const countEl = document.getElementById("mapResultsCount");
    const unsavedCountEl = document.getElementById("mapUnsavedCount");
    const badgeEl = document.getElementById("mapMarkerCountBadge");

    const city = GTA_COMMUNITIES.find(c => c.id === this.activeCityId);
    let titleStr = city ? city.name : "全大区餐馆";

    if (!this.activeNeighborhoodIds.has("all")) {
      const count = this.activeNeighborhoodIds.size;
      if (count === 1) {
        const nhId = Array.from(this.activeNeighborhoodIds)[0];
        let foundNh = null;
        GTA_COMMUNITIES.forEach(c => (c.neighborhoods || []).forEach(n => { if (n.id === nhId) foundNh = n; }));
        if (foundNh) titleStr += ` · ${foundNh.name.split(" ")[0]}`;
      } else {
        titleStr += ` · 已选 ${count} 个商圈`;
      }
    }

    if (!this.activeStreetIds.has("all")) {
      const count = this.activeStreetIds.size;
      if (count === 1) {
        const stId = Array.from(this.activeStreetIds)[0];
        const st = GTA_STREETS.find(s => s.id === stId);
        if (st) titleStr += ` · ${st.name.split(" ")[0]}`;
      } else {
        titleStr += ` · 已选 ${count} 条走廊`;
      }
    }

    const totalCount = this.filteredRestaurants.length;
    const unsavedCount = this.filteredRestaurants.filter(r => !r.inKV).length;

    if (titleEl) titleEl.textContent = titleStr;
    if (countEl) countEl.textContent = totalCount.toLocaleString();
    if (unsavedCountEl) unsavedCountEl.textContent = unsavedCount.toLocaleString();
    if (badgeEl) {
      const modeLabel = this.isFallbackMode ? " (备用地图模式)" : "";
      const zoom = this.googleMap ? (this.googleMap.getZoom() || 11) : (this.fallbackMap ? (this.fallbackMap.getZoom() || 11) : 11);
      const clusterLabel = (zoom < 14 && (this.activeNeighborhoodIds.has("all") || totalCount > 40)) ? " [区域聚合视图]" : "";
      badgeEl.textContent = `📍 展示: ${totalCount.toLocaleString()} 家 (未入库: ${unsavedCount} 家)${clusterLabel}${modeLabel}`;
    }
  },

  // -------------------------------------------------------------
  // Map Markers Management (Google Maps & Leaflet with Zoom LOD)
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

  computeClusters() {
    const clusters = [];
    const matchedKeys = new Set();

    // 1. Group by defined commercial neighborhoods
    GTA_COMMUNITIES.forEach(city => {
      if (this.activeCityId !== "all" && city.id !== this.activeCityId) return;

      (city.neighborhoods || []).forEach(nh => {
        if (!nh.keywords || !nh.center) return;
        const nhRests = this.filteredRestaurants.filter(r => {
          const text = [r.address, r.name, r.hubName, r.hubId].join(" ").toLowerCase();
          return nh.keywords.some(kw => text.includes(kw.toLowerCase()));
        });

        if (nhRests.length > 0) {
          nhRests.forEach(r => matchedKeys.add(r.placeId || r.name));
          const unsaved = nhRests.filter(r => !r.inKV).length;
          clusters.push({
            id: nh.id,
            name: nh.name.split(" (")[0],
            center: nh.center,
            totalCount: nhRests.length,
            unsavedCount: unsaved
          });
        }
      });
    });

    // 2. Group any remaining restaurants by city center
    const unmatched = this.filteredRestaurants.filter(r => !matchedKeys.has(r.placeId || r.name));
    if (unmatched.length > 0) {
      GTA_COMMUNITIES.forEach(city => {
        if (city.id === "all" || !city.center) return;
        if (this.activeCityId !== "all" && city.id !== this.activeCityId) return;

        const cityName = city.name.split(" ")[0];
        const cityRests = unmatched.filter(r => r.region && r.region.includes(cityName));
        if (cityRests.length > 0) {
          const unsaved = cityRests.filter(r => !r.inKV).length;
          clusters.push({
            id: `city_${city.id}`,
            name: `${cityName}其它社区`,
            center: city.center,
            totalCount: cityRests.length,
            unsavedCount: unsaved
          });
        }
      });
    }

    return clusters;
  },

  renderMarkers() {
    this.clearMarkers();

    const currentZoom = this.googleMap ? (this.googleMap.getZoom() || 11) : (this.fallbackMap ? (this.fallbackMap.getZoom() || 11) : 11);
    const shouldCluster = currentZoom < 14 && (this.activeNeighborhoodIds.has("all") || this.filteredRestaurants.length > 40);

    if (shouldCluster) {
      if (this.isFallbackMode && this.fallbackMap && window.L) {
        this.renderLeafletClusters();
      } else if (this.googleMap && window.google && window.google.maps) {
        this.renderGoogleClusters();
      }
    } else {
      if (this.isFallbackMode && this.fallbackMap && window.L) {
        this.renderLeafletMarkers();
      } else if (this.googleMap && window.google && window.google.maps) {
        this.renderGoogleMarkers();
      }
    }
  },

  renderGoogleClusters() {
    const clusters = this.computeClusters();
    clusters.forEach(c => {
      const hasUnsaved = c.unsavedCount > 0;
      const radius = Math.min(26, Math.max(16, 14 + Math.round(Math.log10(c.totalCount + 1) * 6)));
      const badgeText = `${c.totalCount}${hasUnsaved ? `(+${c.unsavedCount})` : ''}`;

      const marker = new google.maps.Marker({
        position: c.center,
        map: this.googleMap,
        title: `${c.name}: 共 ${c.totalCount} 家餐馆 (未入库: ${c.unsavedCount}) - 点击放大查看详情`,
        label: {
          text: badgeText,
          color: "#ffffff",
          fontSize: "11px",
          fontWeight: "bold"
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: hasUnsaved ? "#d97706" : "#2563eb",
          fillOpacity: 0.95,
          strokeWeight: 3,
          strokeColor: "#ffffff",
          scale: radius
        },
        zIndex: 200 + c.totalCount
      });

      marker.addListener("click", () => {
        this.googleMap.panTo(c.center);
        this.googleMap.setZoom(15);
      });

      this.markersMap.set(c.id, marker);
    });
  },

  renderLeafletClusters() {
    const clusters = this.computeClusters();
    clusters.forEach(c => {
      const hasUnsaved = c.unsavedCount > 0;
      const bgClass = hasUnsaved ? "has-unsaved" : "";
      const size = Math.min(54, Math.max(38, 34 + Math.round(Math.log10(c.totalCount + 1) * 10)));
      const html = `
        <div class="map-cluster-marker ${bgClass}" style="width:${size}px; height:${size}px;" title="${c.name}: 共 ${c.totalCount} 家餐馆 (未入库: ${c.unsavedCount}) - 点击放大查看">
          <span class="map-cluster-count">${c.totalCount}</span>
          ${hasUnsaved ? `<span class="map-cluster-sub">+${c.unsavedCount}新</span>` : ''}
        </div>
      `;

      const icon = L.divIcon({
        className: "map-cluster-icon-wrapper",
        html: html,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const marker = L.marker([c.center.lat, c.center.lng], { icon, zIndexOffset: 200 + c.totalCount });
      marker.on("click", () => {
        this.fallbackMap.setView([c.center.lat, c.center.lng], 15);
      });

      this.fallbackLayerGroup.addLayer(marker);
      this.markersMap.set(c.id, marker);
    });
  },

  renderGoogleMarkers() {
    if (!this.googleMap || !window.google || !window.google.maps) return;

    // Render up to 250 pins when zoomed in for ultra smooth performance
    const pinsToRender = this.filteredRestaurants.slice(0, 250);

    pinsToRender.forEach(r => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const pos = { lat, lng };
      const key = r.placeId || r.name;
      const isSelected = this.selectedMap.has(key);

      const marker = new google.maps.Marker({
        position: pos,
        map: this.googleMap,
        title: `${r.name} ${r.inKV ? '(已入库)' : '(未入库)'}`,
        icon: this.getPinIcon(r, isSelected),
        zIndex: isSelected ? 100 : (!r.inKV ? 50 : 10)
      });

      marker.addListener("click", () => {
        this.showInfoWindow(r, marker);
        this.highlightTableRow(r);
      });

      this.markersMap.set(key, marker);
    });
  },

  renderLeafletMarkers() {
    if (!this.fallbackMap || !this.fallbackLayerGroup || !window.L) return;

    const pinsToRender = this.filteredRestaurants.slice(0, 250);

    pinsToRender.forEach(r => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const key = r.placeId || r.name;
      const isSelected = this.selectedMap.has(key);

      const color = isSelected ? "#2563eb" : (!r.inKV ? "#f59e0b" : "#10b981");

      const marker = L.circleMarker([lat, lng], {
        radius: isSelected ? 9 : (!r.inKV ? 7.5 : 6.5),
        fillColor: color,
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95
      });

      const popupHtml = this.getPopupHtml(r);
      marker.bindPopup(popupHtml, { maxWidth: 300 });

      marker.on("click", () => {
        this.highlightTableRow(r);
      });

      this.fallbackLayerGroup.addLayer(marker);
      this.markersMap.set(key, marker);
    });
  },

  getPinIcon(r, isSelected) {
    if (isSelected) {
      return {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
        fillColor: "#2563eb", // Selected: Royal Blue
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#ffffff",
        scale: 1.6,
        anchor: new google.maps.Point(12, 22)
      };
    }

    if (!r.inKV) {
      return {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
        fillColor: "#f59e0b", // Unsaved: Amber/Orange
        fillOpacity: 0.95,
        strokeWeight: 1.8,
        strokeColor: "#ffffff",
        scale: 1.35,
        anchor: new google.maps.Point(12, 22)
      };
    }

    return {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
      fillColor: "#10b981", // In KV: Emerald Green
      fillOpacity: 0.95,
      strokeWeight: 1.5,
      strokeColor: "#ffffff",
      scale: 1.3,
      anchor: new google.maps.Point(12, 22)
    };
  },

  getPopupHtml(r) {
    const key = r.placeId || r.name;
    const phoneStr = r.phone && r.phone !== "无" ? `<a href="tel:${r.phone}" style="color:#2563eb; text-decoration:none;">📞 ${r.phone}</a>` : "";
    const ratingStr = r.rating ? `★ <b>${parseFloat(r.rating).toFixed(1)}</b> (${r.reviews})` : "-";
    const statusBadge = r.status === "已打烊" 
      ? `<span style="background:#fef2f2; color:#ef4444; padding:2px 6px; border-radius:4px; font-size:11px;">已打烊</span>` 
      : `<span style="background:#ecfdf5; color:#10b981; padding:2px 6px; border-radius:4px; font-size:11px;">营业中</span>`;

    const kvBadge = r.inKV 
      ? `<span style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;">✓ 已在KV</span>`
      : `<span style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">🆕 未入库</span>`;

    const addToKvBtn = !r.inKV ? `
      <button onclick="window.mapExplorerAddSingleToKv('${this.escapeQuotes(key)}')" style="background:#059669; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:11px; font-weight:600; cursor:pointer;">
        📥 保存至KV
      </button>
    ` : "";

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 4px; gap:6px;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.3;">${r.name}</h4>
          <div style="display:flex; gap:4px; flex-shrink:0;">${kvBadge} ${statusBadge}</div>
        </div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">
          <span>${ratingStr}</span> · <span style="font-weight:600; color:#0f172a;">${r.price || "$"}</span>
        </div>
        <div style="font-size: 12px; color: #334155; margin-bottom: 4px;">
          📍 ${r.address || "暂无地址"}
        </div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
          ${r.categoriesRaw || "-"}
        </div>
        ${phoneStr ? `<div style="font-size: 12px; margin-bottom: 8px;">${phoneStr}</div>` : ""}
        <div style="display:flex; gap: 6px; border-top: 1px solid #e2e8f0; padding-top: 8px; flex-wrap: wrap;">
          ${addToKvBtn}
          <button onclick="window.mapExplorerAddSingleToRoute('${this.escapeQuotes(key)}')" style="background:#2563eb; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:11px; font-weight:600; cursor:pointer;">
            🗺️ +路线
          </button>
          <button onclick="window.mapExplorerOpenNav('${this.escapeQuotes(r.name)}', '${this.escapeQuotes(r.address)}')" style="background:#0f172a; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">
            🧭 导航
          </button>
          <button onclick="window.mapExplorerImportCalc('${this.escapeQuotes(key)}')" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">
            🛢️ 算产油
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
  },

  highlightTableRow(r) {
    const key = r.placeId || r.name;
    const rows = document.querySelectorAll("#mapRestaurantsTableBody tr");
    rows.forEach(row => {
      if (row.dataset.key === key) {
        row.classList.add("is-active-row");
        row.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        row.classList.remove("is-active-row");
      }
    });
  },

  focusRestaurantOnMap(r) {
    const lat = parseFloat(r.latitude);
    const lng = parseFloat(r.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const key = r.placeId || r.name;

    if (this.isFallbackMode && this.fallbackMap) {
      const wasMacro = (this.fallbackMap.getZoom() || 11) < 14;
      this.fallbackMap.setView([lat, lng], 16);
      if (wasMacro) {
        this.renderMarkers();
      }
      const marker = this.markersMap.get(key);
      if (marker && marker.openPopup) {
        marker.openPopup();
      }
    } else if (this.googleMap) {
      const wasMacro = (this.googleMap.getZoom() || 11) < 14;
      this.googleMap.panTo({ lat, lng });
      if (this.googleMap.getZoom() < 15) {
        this.googleMap.setZoom(15);
      }
      if (wasMacro) {
        this.renderMarkers();
      }
      const marker = this.markersMap.get(key);
      if (marker) {
        this.showInfoWindow(r, marker);
      }
    }
  },

  // -------------------------------------------------------------
  // Bottom List Rendering & Pagination
  // -------------------------------------------------------------
  renderTable() {
    const tbody = document.getElementById("mapRestaurantsTableBody");
    if (!tbody) return;

    const total = this.filteredRestaurants.length;
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = this.filteredRestaurants.slice(startIdx, startIdx + this.pageSize);

    if (total === 0) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding: 2rem; color: #64748b;">当前区域没有匹配的餐馆</td></tr>`;
      this.renderPagination(0);
      return;
    }

    tbody.innerHTML = pageItems.map((r, idx) => {
      const key = r.placeId || r.name;
      const isSelected = this.selectedMap.has(key);
      const ratingStr = r.rating ? `★ <b>${parseFloat(r.rating).toFixed(1)}</b> (${r.reviews})` : "-";
      const statusBadge = r.status === "已打烊" 
        ? `<span class="status-badge status-closed">已打烊</span>` 
        : `<span class="status-badge status-open">营业中</span>`;

      const kvBadge = r.inKV 
        ? `<span class="badge badge-saved" style="background:#ecfdf5; color:#059669; font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px; border:1px solid #a7f3d0; white-space:nowrap;">✓ 已在KV</span>`
        : `<span class="badge badge-unsaved" style="background:#fffbeb; color:#b45309; font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px; border:1px solid #fde68a; white-space:nowrap;">🆕 未入库</span>`;

      return `
        <tr class="${isSelected ? 'is-selected' : ''}" data-key="${this.escapeQuotes(key)}" onclick="window.mapExplorerFocusByIndex(${startIdx + idx})">
          <td onclick="event.stopPropagation();" style="width: 40px; text-align: center;">
            <input 
              type="checkbox" 
              class="custom-checkbox" 
              ${isSelected ? 'checked' : ''} 
              onchange="window.mapExplorerToggleSelect('${this.escapeQuotes(key)}')"
            />
          </td>
          <td class="col-name" style="font-weight:600; color:#0f172a;">${r.name}</td>
          <td style="text-align:center;">${kvBadge}</td>
          <td>${r.region || "-"}</td>
          <td>${r.hubName || "-"}</td>
          <td style="max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.categoriesRaw || ''}">${r.categoriesRaw || "-"}</td>
          <td>${ratingStr}</td>
          <td>${statusBadge}</td>
          <td>${r.price || "-"}</td>
          <td style="max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.address || ''}">📍 ${r.address || "-"}</td>
          <td>${r.phone || "-"}</td>
          <td onclick="event.stopPropagation();">
            <div style="display:flex; gap:0.35rem; align-items:center; flex-wrap:nowrap;">
              ${!r.inKV ? `
                <button class="btn btn-primary btn-sm" onclick="window.mapExplorerAddSingleToKv('${this.escapeQuotes(key)}')" style="background:#059669; border-color:#059669; padding:0.25rem 0.5rem; font-size:0.75rem; white-space:nowrap;" title="添加到KV">
                  + 入库
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.mapExplorerAddSingleToRoute('${this.escapeQuotes(key)}')" style="color:#2563eb; border-color:rgba(37,99,235,0.3); padding:0.25rem 0.5rem; font-size:0.75rem; white-space:nowrap;" title="加入路线">
                🗺️ +路线
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.mapExplorerOpenNav('${this.escapeQuotes(r.name)}', '${this.escapeQuotes(r.address)}')" style="padding:0.25rem 0.5rem; font-size:0.75rem;" title="导航">
                🧭
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    this.renderPagination(total);
  },

  renderPagination(total) {
    const infoEl = document.getElementById("mapPaginationInfo");
    const controlsEl = document.getElementById("mapPaginationControls");
    if (!controlsEl) return;

    const totalPages = Math.ceil(total / this.pageSize) || 1;
    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(total, this.currentPage * this.pageSize);

    if (infoEl) {
      infoEl.textContent = `显示 ${start} - ${end} / 共 ${total.toLocaleString()} 家餐馆`;
    }

    if (totalPages <= 1) {
      controlsEl.innerHTML = "";
      return;
    }

    let buttons = `
      <button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.mapExplorerGoToPage(${this.currentPage - 1})">&lt;</button>
    `;

    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= this.currentPage - 2 && p <= this.currentPage + 2)) {
        buttons += `<button class="page-btn ${p === this.currentPage ? 'active' : ''}" onclick="window.mapExplorerGoToPage(${p})">${p}</button>`;
      } else if (p === this.currentPage - 3 || p === this.currentPage + 3) {
        buttons += `<span class="page-dots">...</span>`;
      }
    }

    buttons += `
      <button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.mapExplorerGoToPage(${this.currentPage + 1})">&gt;</button>
    `;

    controlsEl.innerHTML = buttons;
  },

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredRestaurants.length / this.pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    this.currentPage = page;
    this.renderTable();
    this.updateSelectionUI();
  },

  // -------------------------------------------------------------
  // Multi-selection & KV Operations
  // -------------------------------------------------------------
  toggleSelect(key) {
    if (this.selectedMap.has(key)) {
      this.selectedMap.delete(key);
    } else {
      const rest = this.allRestaurants.find(r => (r.placeId || r.name) === key);
      if (rest) this.selectedMap.set(key, rest);
    }

    this.updatePinStyle(key);
    this.updateSelectionUI();
  },

  setSelectCurrentPage(shouldSelect) {
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = this.filteredRestaurants.slice(startIdx, startIdx + this.pageSize);
    pageItems.forEach(r => {
      const key = r.placeId || r.name;
      if (shouldSelect) {
        this.selectedMap.set(key, r);
      } else {
        this.selectedMap.delete(key);
      }
      this.updatePinStyle(key);
    });
    this.renderTable();
    this.updateSelectionUI();
  },

  toggleSelectCurrentPage() {
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = this.filteredRestaurants.slice(startIdx, startIdx + this.pageSize);
    const allSelected = pageItems.length > 0 && pageItems.every(r => this.selectedMap.has(r.placeId || r.name));
    this.setSelectCurrentPage(!allSelected);
  },

  selectAllFiltered() {
    const count = this.filteredRestaurants.length;
    if (count === 0) return;

    if (confirm(`确定选中当前区域筛选出的全部 ${count} 家餐馆？`)) {
      this.filteredRestaurants.forEach(r => {
        const key = r.placeId || r.name;
        this.selectedMap.set(key, r);
        this.updatePinStyle(key);
      });
      this.renderTable();
      this.updateSelectionUI();
    }
  },

  clearSelection() {
    const prevKeys = Array.from(this.selectedMap.keys());
    this.selectedMap.clear();
    prevKeys.forEach(k => this.updatePinStyle(k));
    this.renderTable();
    this.updateSelectionUI();
  },

  updatePinStyle(key) {
    const marker = this.markersMap.get(key);
    if (!marker) return;
    const isSelected = this.selectedMap.has(key);
    const rest = this.allRestaurants.find(r => (r.placeId || r.name) === key);

    if (this.isFallbackMode && marker.setStyle) {
      const color = isSelected ? "#2563eb" : (!rest?.inKV ? "#f59e0b" : "#10b981");
      marker.setStyle({
        fillColor: color,
        radius: isSelected ? 9 : (!rest?.inKV ? 7.5 : 6.5)
      });
    } else if (marker.setIcon) {
      marker.setIcon(this.getPinIcon(rest || {}, isSelected));
    }
  },

  updateSelectionUI() {
    const totalSelected = this.selectedMap.size;
    const unsavedSelected = Array.from(this.selectedMap.values()).filter(r => !r.inKV);
    const unsavedInFilter = this.filteredRestaurants.filter(r => !r.inKV);

    const btnRoute = document.getElementById("mapBtnPlanRoute");
    if (btnRoute) {
      btnRoute.querySelector("span:last-child").textContent = `规划路线 (${totalSelected})`;
    }

    const btnExport = document.getElementById("mapBtnExportExcel");
    if (btnExport) {
      btnExport.querySelector("span:last-child").textContent = `导出所选 Excel (${totalSelected})`;
    }

    const btnBatchKv = document.getElementById("mapBtnBatchAddToKv");
    if (btnBatchKv) {
      const count = unsavedSelected.length > 0 ? unsavedSelected.length : unsavedInFilter.length;
      btnBatchKv.querySelector("span:last-child").textContent = `批量添加到KV (${count})`;
    }

    const thSelectAll = document.getElementById("mapThSelectAll");
    if (thSelectAll) {
      const startIdx = (this.currentPage - 1) * this.pageSize;
      const pageItems = this.filteredRestaurants.slice(startIdx, startIdx + this.pageSize);
      const allCurrentSelected = pageItems.length > 0 && pageItems.every(r => this.selectedMap.has(r.placeId || r.name));
      thSelectAll.checked = allCurrentSelected;
      thSelectAll.indeterminate = !allCurrentSelected && pageItems.some(r => this.selectedMap.has(r.placeId || r.name));
    }
  },

  // -------------------------------------------------------------
  // Add to Cloudflare KV Operations (Single & Batch)
  // -------------------------------------------------------------
  async addSingleToKv(key) {
    const r = this.allRestaurants.find(item => (item.placeId || item.name) === key);
    if (!r) return;

    if (r.inKV) {
      alert("该餐馆已在 KV 数据库中！");
      return;
    }

    const res = await Api.addRestaurant(r);
    if (res && res.success) {
      r.inKV = true;
      if (r.placeId) this.kvPlaceIdsSet.add(r.placeId);
      if (r.name) this.kvNormalizedNamesSet.add(r.name.trim().toLowerCase());
      this.updatePinStyle(key);
      this.renderTable();
      this.updateSelectionUI();
      this.updateResultsHeader();
      alert(`🎉 餐馆【${r.name}】已成功添加至云端 KV 数据库！`);
    } else {
      alert("添加失败: " + (res?.error || "未知错误"));
    }
  },

  async batchAddToKv() {
    let unsavedToSave = Array.from(this.selectedMap.values()).filter(r => !r.inKV);

    if (unsavedToSave.length === 0) {
      const unsavedInView = this.filteredRestaurants.filter(r => !r.inKV);
      if (unsavedInView.length === 0) {
        alert("当前列表中的所有餐馆都已存在于 KV 数据库中，无需重复添加！");
        return;
      }

      if (!confirm(`检测到当前筛选列表共有 ${unsavedInView.length} 家未入库餐馆。\n是否将这 ${unsavedInView.length} 家餐馆全部批量保存到云端 KV 数据库？`)) {
        return;
      }
      unsavedToSave = unsavedInView;
    } else {
      if (!confirm(`确定将已勾选的 ${unsavedToSave.length} 家未入库餐馆批量保存到云端 KV 数据库？`)) {
        return;
      }
    }

    const btn = document.getElementById("mapBtnBatchAddToKv");
    const origText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>⏳ 保存中...</span>`;
    }

    try {
      const res = await Api.batchAddRestaurants(unsavedToSave);
      if (res && res.success) {
        unsavedToSave.forEach(r => {
          r.inKV = true;
          if (r.placeId) this.kvPlaceIdsSet.add(r.placeId);
          if (r.name) this.kvNormalizedNamesSet.add(r.name.trim().toLowerCase());
          this.updatePinStyle(r.placeId || r.name);
        });

        this.renderTable();
        this.updateSelectionUI();
        this.updateResultsHeader();

        alert(`🎉 成功将 ${unsavedToSave.length} 家餐馆批量保存至云端 KV 数据库！数据已即刻生效。`);
      } else {
        alert("批量保存失败: " + (res?.error || "未知错误"));
      }
    } catch (e) {
      alert("保存出错: " + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
  },

  // -------------------------------------------------------------
  // Export to Excel (Standard 17-Column Spec matching Restaurant Query)
  // -------------------------------------------------------------
  exportSelectedExcel() {
    const items = Array.from(this.selectedMap.values());
    if (items.length === 0) {
      if (this.filteredRestaurants.length > 0) {
        if (confirm(`当前尚未勾选餐馆。是否直接导出当前筛选区域内的全部 ${this.filteredRestaurants.length} 家餐馆？`)) {
          this.executeExport(this.filteredRestaurants);
          return;
        }
      }
      alert("请先勾选需要导出的餐馆！");
      return;
    }

    this.executeExport(items);
  },

  executeExport(restaurants) {
    if (typeof XLSX === "undefined") {
      alert("Excel 导出组件加载中，请稍后重试");
      return;
    }

    const rows = restaurants.map((r, i) => ({
      "序号": i + 1,
      "餐馆名称 (Name)": r.name || "",
      "KV入库状态": r.inKV ? "已在KV" : "未入库 (新发现)",
      "区域 (Region)": r.region || "",
      "商圈/商场 (Hub/Mall)": r.hubName || "沿街与社区广场",
      "分类 (Category)": r.categoriesRaw || "",
      "评分 (Rating)": r.rating || "",
      "评价数 (Reviews)": r.reviews || "",
      "消费档次 (Price)": r.price || "",
      "营业状态 (Status)": r.status || "",
      "详细地址 (Address)": r.address || "",
      "联系电话 (Phone)": r.phone || "",
      "主要类型 (Primary Type)": r.primaryType || "",
      "经度 (Longitude)": r.longitude || "",
      "纬度 (Latitude)": r.latitude || "",
      "Google 地图链接": r.mapsUrl || ""
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "餐馆地图导出");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `greenoil_map_restaurants_${dateStr}.xlsx`);
  },

  planRouteSelected() {
    const items = Array.from(this.selectedMap.values());
    if (items.length === 0) {
      alert("请先勾选需要规划路线的餐馆！");
      return;
    }

    import("./field-sales.js").then(({ FieldSales }) => {
      FieldSales.addMultipleToRoute(items);
    });
  },

  escapeQuotes(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
  }
};

// Global hooks for inline HTML handlers
if (typeof window !== "undefined") {
  window.mapExplorerFocusByIndex = function(idx) {
    const r = MapExplorer.filteredRestaurants[idx];
    if (r) MapExplorer.focusRestaurantOnMap(r);
  };

  window.mapExplorerToggleSelect = function(key) {
    MapExplorer.toggleSelect(key);
  };

  window.mapExplorerGoToPage = function(page) {
    MapExplorer.goToPage(page);
  };

  window.mapExplorerAddSingleToKv = function(key) {
    MapExplorer.addSingleToKv(key);
  };

  window.mapExplorerAddSingleToRoute = function(key) {
    const r = MapExplorer.allRestaurants.find(item => (item.placeId || item.name) === key);
    if (r) {
      import("./field-sales.js").then(({ FieldSales }) => {
        FieldSales.addMultipleToRoute([r]);
      });
    }
  };

  window.mapExplorerOpenNav = function(name, address) {
    const query = encodeURIComponent(`${name} ${address}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`, "_blank");
  };

  window.mapExplorerImportCalc = function(key) {
    const r = MapExplorer.allRestaurants.find(item => (item.placeId || item.name) === key);
    if (r && window.importRestaurantToCalculator) {
      window.importRestaurantToCalculator(r);
    }
  };
}
