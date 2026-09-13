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

// GTA Community Hierarchy with Exact Polygon Boundaries (reference municipal GIS boundaries)
export const GTA_COMMUNITIES = [
  {
    id: "all",
    name: "全部大区 (All GTA)",
    nameEn: "All GTA",
    nameKo: "광역 토론토 전체",
    center: { lat: 43.7282, lng: -79.3832 },
    zoom: 11,
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
    id: "downtown",
    name: "多伦多市中心 (Downtown Toronto)",
    nameEn: "Downtown Toronto",
    nameKo: "다운타운 토론토",
    center: { lat: 43.6532, lng: -79.3832 },
    zoom: 14,
    polygonPaths: [
      { lat: 43.6730, lng: -79.4180 }, // Dupont & Bathurst
      { lat: 43.6760, lng: -79.3850 }, // Rosedale / Yonge
      { lat: 43.6750, lng: -79.3580 }, // Bayview / DVP
      { lat: 43.6550, lng: -79.3450 }, // Don River mouth
      { lat: 43.6350, lng: -79.3550 }, // Port Lands
      { lat: 43.6320, lng: -79.3900 }, // Waterfront / Harbourfront
      { lat: 43.6330, lng: -79.4250 }, // Exhibition Place
      { lat: 43.6480, lng: -79.4300 }, // Dufferin & Queen
      { lat: 43.6650, lng: -79.4240 }  // Bloor & Ossington
    ],
    neighborhoods: [
      {
        id: "dt_chinatown",
        name: "唐人街 / 肯辛顿 (Chinatown & Kensington)",
        nameEn: "Chinatown & Kensington",
        keywords: ["spadina", "kensington", "dundas w", "college", "chinatown"],
        center: { lat: 43.6535, lng: -79.3985 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.6590, lng: -79.4050 },
          { lat: 43.6595, lng: -79.3940 },
          { lat: 43.6495, lng: -79.3920 },
          { lat: 43.6490, lng: -79.4030 }
        ]
      },
      {
        id: "dt_bay_financial",
        name: "金融区 / 湾街 (Financial District & Bay St)",
        nameEn: "Financial District & Bay St",
        keywords: ["bay st", "king st w", "front st w", "financial", "university"],
        center: { lat: 43.6485, lng: -79.3817 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.6540, lng: -79.3880 },
          { lat: 43.6545, lng: -79.3760 },
          { lat: 43.6435, lng: -79.3750 },
          { lat: 43.6430, lng: -79.3870 }
        ]
      },
      {
        id: "dt_yonge_dundas",
        name: "央街登打士 (Yonge-Dundas & Eaton Centre)",
        nameEn: "Yonge-Dundas",
        keywords: ["dundas", "yonge", "gould", "church", "victoria", "eaton"],
        center: { lat: 43.6560, lng: -79.3802 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.6620, lng: -79.3860 },
          { lat: 43.6625, lng: -79.3750 },
          { lat: 43.6515, lng: -79.3740 },
          { lat: 43.6510, lng: -79.3850 }
        ]
      },
      {
        id: "dt_entertainment",
        name: "娱乐时尚区 (Entertainment District & King W)",
        nameEn: "Entertainment District",
        keywords: ["king w", "peter", "john st", "mercer", "wellington", "blue jays"],
        center: { lat: 43.6465, lng: -79.3905 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.6510, lng: -79.3970 },
          { lat: 43.6515, lng: -79.3850 },
          { lat: 43.6415, lng: -79.3830 },
          { lat: 43.6410, lng: -79.3960 }
        ]
      },
      {
        id: "dt_queen_west",
        name: "西皇后街 / 艺术区 (Queen West & Trinity)",
        nameEn: "Queen West",
        keywords: ["queen w", "ossington", "augusta", "bellwoods"],
        center: { lat: 43.6480, lng: -79.4100 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.6520, lng: -79.4220 },
          { lat: 43.6525, lng: -79.4010 },
          { lat: 43.6440, lng: -79.4000 },
          { lat: 43.6435, lng: -79.4210 }
        ]
      },
      {
        id: "dt_koreatown",
        name: "布鲁尔韩国城 (Koreatown Bloor)",
        nameEn: "Koreatown Bloor",
        keywords: ["bloor w", "christie", "manning", "bathurst", "markham st"],
        center: { lat: 43.6645, lng: -79.4180 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.6680, lng: -79.4260 },
          { lat: 43.6685, lng: -79.4080 },
          { lat: 43.6610, lng: -79.4070 },
          { lat: 43.6605, lng: -79.4250 }
        ]
      },
      {
        id: "dt_yorkville",
        name: "约克维尔 (Bloor-Yorkville & Annex)",
        nameEn: "Yorkville & Annex",
        keywords: ["yorkville", "cumberland", "bloor e", "avenue rd", "hazelton"],
        center: { lat: 43.6702, lng: -79.3905 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.6760, lng: -79.4050 },
          { lat: 43.6765, lng: -79.3820 },
          { lat: 43.6660, lng: -79.3810 },
          { lat: 43.6655, lng: -79.4040 }
        ]
      },
      {
        id: "dt_waterfront",
        name: "湖滨港口区 (Waterfront & CityPlace)",
        nameEn: "Waterfront & CityPlace",
        keywords: ["queens quay", "fort york", "harbour", "lake shore", "cityplace"],
        center: { lat: 43.6390, lng: -79.3870 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.6430, lng: -79.4050 },
          { lat: 43.6440, lng: -79.3720 },
          { lat: 43.6330, lng: -79.3710 },
          { lat: 43.6320, lng: -79.4040 }
        ]
      }
    ]
  },
  {
    id: "north_york",
    name: "北约克 (North York)",
    nameEn: "North York",
    nameKo: "노스욕 (North York)",
    center: { lat: 43.7615, lng: -79.4111 },
    zoom: 13,
    polygonPaths: [
      { lat: 43.8010, lng: -79.5350 }, // Steeles & Hwy 400
      { lat: 43.8060, lng: -79.4220 }, // Steeles & Yonge
      { lat: 43.8110, lng: -79.3320 }, // Steeles & Victoria Park
      { lat: 43.7520, lng: -79.3280 }, // Victoria Park & 401
      { lat: 43.7160, lng: -79.3520 }, // Eglinton & Leslie
      { lat: 43.7120, lng: -79.4420 }, // Eglinton & Dufferin
      { lat: 43.7290, lng: -79.5210 }, // Lawrence & Jane
      { lat: 43.7680, lng: -79.5420 }  // Finch & Weston
    ],
    neighborhoods: [
      {
        id: "ny_yonge_finch",
        name: "央街芬治韩国城 (Yonge & Finch / Koreatown North)",
        nameEn: "Yonge & Finch Koreatown",
        keywords: ["finch", "koreatown", "olive", "byng", "drewry", "cummer", "northtown"],
        center: { lat: 43.7795, lng: -79.4155 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.7920, lng: -79.4250 },
          { lat: 43.7925, lng: -79.4060 },
          { lat: 43.7700, lng: -79.4050 },
          { lat: 43.7695, lng: -79.4240 }
        ]
      },
      {
        id: "ny_city_centre",
        name: "北约克城市中心 (Willowdale & NYCC)",
        nameEn: "Willowdale & NYCC",
        keywords: ["sheppard", "empress", "park home", "mel lastman", "doris", "beecroft"],
        center: { lat: 43.7675, lng: -79.4125 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.7740, lng: -79.4220 },
          { lat: 43.7745, lng: -79.4040 },
          { lat: 43.7580, lng: -79.4030 },
          { lat: 43.7575, lng: -79.4210 }
        ]
      },
      {
        id: "ny_fairview",
        name: "锦绣商圈 / 唐米尔斯 (Don Mills & Fairview Mall)",
        nameEn: "Fairview Mall & Don Mills",
        keywords: ["fairview", "don mills", "sheppard e", "godstone"],
        center: { lat: 43.7780, lng: -79.3440 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.7880, lng: -79.3560 },
          { lat: 43.7885, lng: -79.3330 },
          { lat: 43.7680, lng: -79.3320 },
          { lat: 43.7675, lng: -79.3550 }
        ]
      },
      {
        id: "ny_bayview",
        name: "湾景村社区 (Bayview Village)",
        nameEn: "Bayview Village",
        keywords: ["bayview", "sheppard e", "rector", "mallingham"],
        center: { lat: 43.7690, lng: -79.3870 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.7780, lng: -79.3980 },
          { lat: 43.7785, lng: -79.3750 },
          { lat: 43.7610, lng: -79.3740 },
          { lat: 43.7605, lng: -79.3970 }
        ]
      },
      {
        id: "ny_york_u",
        name: "约克大学高地 (York University Heights & Downsview)",
        nameEn: "York University Heights",
        keywords: ["keele", "finch w", "steeles w", "allen", "chesswood", "dufferin"],
        center: { lat: 43.7730, lng: -79.4950 },
        zoom: 14,
        polygonPaths: [
          { lat: 43.7850, lng: -79.5150 },
          { lat: 43.7860, lng: -79.4750 },
          { lat: 43.7600, lng: -79.4740 },
          { lat: 43.7590, lng: -79.5140 }
        ]
      }
    ]
  },
  {
    id: "markham",
    name: "万锦 (Markham)",
    nameEn: "Markham",
    nameKo: "마컴 (Markham)",
    center: { lat: 43.8561, lng: -79.3370 },
    zoom: 13,
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
    neighborhoods: [
      {
        id: "mk_unionville",
        name: "于家村历史老街 (Historic Main St Unionville)",
        nameEn: "Unionville & Main St",
        keywords: ["main st", "unionville", "carlton", "fred varley", "kennedy"],
        center: { lat: 43.8670, lng: -79.3135 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.8790, lng: -79.3260 },
          { lat: 43.8795, lng: -79.3010 },
          { lat: 43.8550, lng: -79.3000 },
          { lat: 43.8545, lng: -79.3250 }
        ]
      },
      {
        id: "mk_pacific_mall",
        name: "太古商圈 / 太子中心 (Pacific Mall & Milliken)",
        nameEn: "Pacific Mall & Milliken",
        keywords: ["pacific mall", "steeles", "silver star", "redlea", "milliken"],
        center: { lat: 43.8258, lng: -79.3060 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.8340, lng: -79.3170 },
          { lat: 43.8345, lng: -79.2950 },
          { lat: 43.8180, lng: -79.2940 },
          { lat: 43.8175, lng: -79.3160 }
        ]
      },
      {
        id: "mk_fmp",
        name: "万锦广场 / 寰宇角 (First Markham Place & Commerce Gate)",
        nameEn: "First Markham Place & Commerce Gate",
        keywords: ["first markham", "commerce gate", "hwy 7", "woodbine", "montgomery"],
        center: { lat: 43.8485, lng: -79.3490 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.8570, lng: -79.3620 },
          { lat: 43.8575, lng: -79.3360 },
          { lat: 43.8400, lng: -79.3350 },
          { lat: 43.8395, lng: -79.3610 }
        ]
      },
      {
        id: "mk_village_cornell",
        name: "万锦村 / 康奈尔 (Markham Village & Cornell)",
        nameEn: "Markham Village & Cornell",
        keywords: ["cornell", "bur oak", "markham rd", "16th ave", "9th line", "box grove"],
        center: { lat: 43.8820, lng: -79.2550 },
        zoom: 14,
        polygonPaths: [
          { lat: 43.8960, lng: -79.2750 },
          { lat: 43.8970, lng: -79.2350 },
          { lat: 43.8670, lng: -79.2340 },
          { lat: 43.8660, lng: -79.2740 }
        ]
      },
      {
        id: "mk_cachet",
        name: "凯旋豪宅商圈 (Cachet & Woodbine)",
        nameEn: "Cachet & Woodbine",
        keywords: ["cachet", "woodbine", "16th", "apple creek", "angus glen"],
        center: { lat: 43.8620, lng: -79.3620 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.8740, lng: -79.3750 },
          { lat: 43.8745, lng: -79.3490 },
          { lat: 43.8500, lng: -79.3480 },
          { lat: 43.8495, lng: -79.3740 }
        ]
      }
    ]
  },
  {
    id: "scarborough",
    name: "士嘉堡 (Scarborough)",
    nameEn: "Scarborough",
    nameKo: "스카버러 (Scarborough)",
    center: { lat: 43.7764, lng: -79.2318 },
    zoom: 13,
    polygonPaths: [
      { lat: 43.8160, lng: -79.3320 }, // Steeles & Victoria Park
      { lat: 43.8360, lng: -79.2220 }, // Steeles & Markham Rd
      { lat: 43.8410, lng: -79.1320 }, // Steeles & Meadowvale (Rouge)
      { lat: 43.7860, lng: -79.1120 }, // Lake Ontario / Rouge mouth
      { lat: 43.7420, lng: -79.1920 }, // Scarborough Bluffs (Guildwood)
      { lat: 43.7020, lng: -79.2620 }, // Bluffs / Victoria Park
      { lat: 43.7160, lng: -79.2970 }, // Victoria Park & Danforth
      { lat: 43.7660, lng: -79.3120 }  // Victoria Park & 401
    ],
    neighborhoods: [
      {
        id: "sc_agincourt",
        name: "爱静阁美食商圈 (Agincourt / Midland & Sheppard)",
        nameEn: "Agincourt / Midland & Sheppard",
        keywords: ["agincourt", "midland", "glen watford", "rural", "dragon centre"],
        center: { lat: 43.7885, lng: -79.2780 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.7990, lng: -79.2920 },
          { lat: 43.7995, lng: -79.2640 },
          { lat: 43.7780, lng: -79.2630 },
          { lat: 43.7775, lng: -79.2910 }
        ]
      },
      {
        id: "sc_stc",
        name: "士嘉堡市中心 (Scarborough Town Centre)",
        nameEn: "Scarborough Town Centre",
        keywords: ["borough", "mccowan", "ellesmere", "town centre"],
        center: { lat: 43.7745, lng: -79.2575 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.7840, lng: -79.2710 },
          { lat: 43.7845, lng: -79.2440 },
          { lat: 43.7650, lng: -79.2430 },
          { lat: 43.7645, lng: -79.2700 }
        ]
      },
      {
        id: "sc_silverstar",
        name: "东方广场 / 锦绣中华 (Steeles & Silver Star)",
        nameEn: "Steeles & Silver Star",
        keywords: ["silver star", "steeles e", "splendid china", "redlea", "milliken"],
        center: { lat: 43.8235, lng: -79.2980 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.8320, lng: -79.3110 },
          { lat: 43.8325, lng: -79.2850 },
          { lat: 43.8150, lng: -79.2840 },
          { lat: 43.8145, lng: -79.3100 }
        ]
      },
      {
        id: "sc_warden_finch",
        name: "丰泰商圈 / 华登 (Warden & Finch / Bridlewood)",
        nameEn: "Warden & Finch / Bridlewood",
        keywords: ["warden", "bridlewood", "finch e", "bamburgh"],
        center: { lat: 43.7990, lng: -79.3190 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.8090, lng: -79.3330 },
          { lat: 43.8095, lng: -79.3050 },
          { lat: 43.7890, lng: -79.3040 },
          { lat: 43.7885, lng: -79.3320 }
        ]
      },
      {
        id: "sc_kingston",
        name: "悬崖公园湖滨走廊 (Guildwood & Kingston Rd)",
        nameEn: "Guildwood & Kingston Rd",
        keywords: ["kingston", "guildwood", "lawrence e", "eglinton e", "scarborough golf"],
        center: { lat: 43.7420, lng: -79.2150 },
        zoom: 14,
        polygonPaths: [
          { lat: 43.7580, lng: -79.2380 },
          { lat: 43.7590, lng: -79.1920 },
          { lat: 43.7260, lng: -79.1910 },
          { lat: 43.7250, lng: -79.2370 }
        ]
      }
    ]
  },
  {
    id: "richmond_hill",
    name: "列治文山 (Richmond Hill)",
    nameEn: "Richmond Hill",
    nameKo: "리치몬드 힐 (Richmond Hill)",
    center: { lat: 43.8828, lng: -79.4403 },
    zoom: 13,
    polygonPaths: [
      { lat: 43.9570, lng: -79.4670 }, // Bloomington & Bathurst
      { lat: 43.9620, lng: -79.3770 }, // Bloomington & Hwy 404
      { lat: 43.8810, lng: -79.3800 }, // Major Mackenzie & 404
      { lat: 43.8410, lng: -79.3820 }, // Hwy 7 & 404
      { lat: 43.8390, lng: -79.4620 }, // Hwy 7 & Bathurst
      { lat: 43.9010, lng: -79.4640 }  // Elgin Mills & Bathurst
    ],
    neighborhoods: [
      {
        id: "rh_times_square",
        name: "时代广场 / 黄金商场 (Times Square & Beaver Creek)",
        nameEn: "Times Square & Beaver Creek",
        keywords: ["times square", "beaver creek", "leslie", "hwy 7", "highway 7"],
        center: { lat: 43.8430, lng: -79.3875 },
        zoom: 16,
        polygonPaths: [
          { lat: 43.8520, lng: -79.4000 },
          { lat: 43.8525, lng: -79.3750 },
          { lat: 43.8340, lng: -79.3740 },
          { lat: 43.8335, lng: -79.3990 }
        ]
      },
      {
        id: "rh_centre",
        name: "央街老街市中心 (Richmond Hill Centre & Yonge)",
        nameEn: "Richmond Hill Centre & Yonge",
        keywords: ["yonge", "major mackenzie", "crosby", "wright"],
        center: { lat: 43.8765, lng: -79.4385 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.8880, lng: -79.4520 },
          { lat: 43.8885, lng: -79.4250 },
          { lat: 43.8650, lng: -79.4240 },
          { lat: 43.8645, lng: -79.4510 }
        ]
      },
      {
        id: "rh_hillcrest",
        name: "喜尔客 / 富豪山庄 (Hillcrest Mall & South Richvale)",
        nameEn: "Hillcrest Mall & South Richvale",
        keywords: ["hillcrest", "16th ave", "carrville", "weldrick"],
        center: { lat: 43.8580, lng: -79.4350 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.8690, lng: -79.4480 },
          { lat: 43.8695, lng: -79.4220 },
          { lat: 43.8470, lng: -79.4210 },
          { lat: 43.8465, lng: -79.4470 }
        ]
      },
      {
        id: "rh_elgin_mills",
        name: "爱尔金湖畔社区 (Elgin Mills & Jefferson)",
        nameEn: "Elgin Mills & Jefferson",
        keywords: ["elgin mills", "jefferson", "tower hill", "gamble"],
        center: { lat: 43.9050, lng: -79.4450 },
        zoom: 14,
        polygonPaths: [
          { lat: 43.9220, lng: -79.4620 },
          { lat: 43.9225, lng: -79.4280 },
          { lat: 43.8880, lng: -79.4270 },
          { lat: 43.8875, lng: -79.4610 }
        ]
      }
    ]
  },
  {
    id: "mississauga",
    name: "密西沙加 (Mississauga)",
    nameEn: "Mississauga",
    nameKo: "미시사가 (Mississauga)",
    center: { lat: 43.5890, lng: -79.6441 },
    zoom: 13,
    polygonPaths: [
      { lat: 43.6680, lng: -79.7420 }, // Derry & Winston Churchill
      { lat: 43.6820, lng: -79.6220 }, // Derry & Airport / 427
      { lat: 43.6420, lng: -79.5470 }, // 401 & Etobicoke Creek
      { lat: 43.5920, lng: -79.5520 }, // Dundas & Etobicoke Creek
      { lat: 43.5420, lng: -79.5720 }, // Lake Ontario / Port Credit
      { lat: 43.5120, lng: -79.6420 }, // Lake Ontario / Clarkson
      { lat: 43.5520, lng: -79.7420 }, // Dundas & Winston Churchill
      { lat: 43.6120, lng: -79.7520 }  // Eglinton & Winston Churchill
    ],
    neighborhoods: [
      {
        id: "ms_square_one",
        name: "第一广场市中心 (Square One & City Centre)",
        nameEn: "Square One & City Centre",
        keywords: ["square one", "burnhamthorpe", "duke of york", "hurontario", "rathburn"],
        center: { lat: 43.5930, lng: -79.6425 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.6050, lng: -79.6580 },
          { lat: 43.6055, lng: -79.6270 },
          { lat: 43.5810, lng: -79.6260 },
          { lat: 43.5805, lng: -79.6570 }
        ]
      },
      {
        id: "ms_chinatown",
        name: "密市中国城 (Chinatown Mississauga & Cooksville)",
        nameEn: "Chinatown Mississauga & Cooksville",
        keywords: ["cawthra", "dundas e", "cooksville", "golden square", "central pkwy"],
        center: { lat: 43.5840, lng: -79.6050 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.5940, lng: -79.6200 },
          { lat: 43.5945, lng: -79.5900 },
          { lat: 43.5740, lng: -79.5890 },
          { lat: 43.5735, lng: -79.6190 }
        ]
      },
      {
        id: "ms_dixie",
        name: "迪克西餐饮长廊 (Dixie & Dundas Commercial)",
        nameEn: "Dixie & Dundas Commercial",
        keywords: ["dixie", "matheson", "tomken", "aimco"],
        center: { lat: 43.6050, lng: -79.5780 },
        zoom: 14,
        polygonPaths: [
          { lat: 43.6200, lng: -79.5950 },
          { lat: 43.6205, lng: -79.5610 },
          { lat: 43.5900, lng: -79.5600 },
          { lat: 43.5895, lng: -79.5940 }
        ]
      },
      {
        id: "ms_streetsville",
        name: "斯特里茨维尔历史小镇 (Streetsville Village)",
        nameEn: "Streetsville Village",
        keywords: ["streetsville", "queen st s", "britannia"],
        center: { lat: 43.5820, lng: -79.7130 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.5930, lng: -79.7280 },
          { lat: 43.5935, lng: -79.6980 },
          { lat: 43.5710, lng: -79.6970 },
          { lat: 43.5705, lng: -79.7270 }
        ]
      },
      {
        id: "ms_port_credit",
        name: "湖滨游艇港镇 (Port Credit Waterfront)",
        nameEn: "Port Credit Waterfront",
        keywords: ["port credit", "lakeshore", "stavebank"],
        center: { lat: 43.5510, lng: -79.5850 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.5620, lng: -79.6010 },
          { lat: 43.5625, lng: -79.5690 },
          { lat: 43.5390, lng: -79.5680 },
          { lat: 43.5385, lng: -79.6000 }
        ]
      }
    ]
  },
  {
    id: "vaughan",
    name: "旺市 (Vaughan)",
    nameEn: "Vaughan",
    nameKo: "본 (Vaughan)",
    center: { lat: 43.8563, lng: -79.5085 },
    zoom: 13,
    polygonPaths: [
      { lat: 43.9230, lng: -79.6320 }, // King-Vaughan & Hwy 50
      { lat: 43.9280, lng: -79.4670 }, // King-Vaughan & Bathurst
      { lat: 43.8420, lng: -79.4620 }, // Hwy 7 & Bathurst
      { lat: 43.7870, lng: -79.4620 }, // Steeles & Bathurst
      { lat: 43.7770, lng: -79.6120 }, // Steeles & Hwy 50
      { lat: 43.8320, lng: -79.6220 }  // Hwy 7 & Hwy 50
    ],
    neighborhoods: [
      {
        id: "vg_vmc",
        name: "旺市大都会中心 (VMC & Jane St)",
        nameEn: "VMC & Jane St",
        keywords: ["vmc", "metropolitan", "portage", "jane", "edgeley"],
        center: { lat: 43.7940, lng: -79.5280 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.8050, lng: -79.5420 },
          { lat: 43.8055, lng: -79.5140 },
          { lat: 43.7830, lng: -79.5130 },
          { lat: 43.7825, lng: -79.5410 }
        ]
      },
      {
        id: "vg_promenade",
        name: "康山商业走廊 (Thornhill & Promenade Mall)",
        nameEn: "Thornhill & Promenade Mall",
        keywords: ["promenade", "bathurst", "centre st", "clark"],
        center: { lat: 43.8060, lng: -79.4520 },
        zoom: 15,
        polygonPaths: [
          { lat: 43.8170, lng: -79.4660 },
          { lat: 43.8175, lng: -79.4380 },
          { lat: 43.7950, lng: -79.4370 },
          { lat: 43.7945, lng: -79.4650 }
        ]
      },
      {
        id: "vg_woodbridge",
        name: "伍德布里奇意大利街区 (Woodbridge & Weston Rd)",
        nameEn: "Woodbridge & Weston Rd",
        keywords: ["woodbridge", "weston rd", "hwy 7", "islington"],
        center: { lat: 43.7870, lng: -79.5950 },
        zoom: 14,
        polygonPaths: [
          { lat: 43.8020, lng: -79.6150 },
          { lat: 43.8025, lng: -79.5750 },
          { lat: 43.7720, lng: -79.5740 },
          { lat: 43.7715, lng: -79.6140 }
        ]
      },
      {
        id: "vg_mills_maple",
        name: "枫树镇 / 旺市购物中心 (Maple & Vaughan Mills)",
        nameEn: "Maple & Vaughan Mills",
        keywords: ["vaughan mills", "rutherford", "bass pro", "major mackenzie w"],
        center: { lat: 43.8260, lng: -79.5390 },
        zoom: 14,
        polygonPaths: [
          { lat: 43.8420, lng: -79.5580 },
          { lat: 43.8425, lng: -79.5200 },
          { lat: 43.8100, lng: -79.5190 },
          { lat: 43.8095, lng: -79.5570 }
        ]
      }
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
  displayedPlaces: [],
  selectedMap: new Map(), // key -> Restaurant

  // Fallback map state
  isFallbackMode: false,
  fallbackMap: null,
  fallbackLayerGroup: null,

  // KV Identification Tracking Sets
  kvPlaceIdsSet: new Set(),
  kvNormalizedNamesSet: new Set(),
  
  // Filter States (Locality / Cities only)
  activeCityId: "north_york",
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

    this.setupAuthFailureHandler();
    this.bindEvents();
    this.setupResizeObserver();
    this.renderPopover();
    this.updateAreaSummaryBtn();

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

  updateAreaSummaryBtn() {
    const summaryEl = document.getElementById("areaActiveTagsSummary");
    if (!summaryEl) return;

    const city = GTA_COMMUNITIES.find(c => c.id === this.activeCityId);
    const cityName = city ? city.name.split(" (")[0] : "全部大区";

    summaryEl.innerHTML = `
      <span class="area-tag-pill active">
        ${this.escapeHtml(cityName)}
      </span>
    `;
  },

  renderPopover() {
    // 1. Render Active Tags Row
    const tagsRow = document.getElementById("popoverActiveTagsRow");
    if (tagsRow) {
      const city = GTA_COMMUNITIES.find(c => c.id === this.activeCityId);
      const isCityAll = !city || city.id === "all";

      let html = "";
      if (isCityAll) {
        html += `<span class="area-tag-pill">全部大区 (All GTA)</span>`;
      } else {
        html += `
          <span class="area-tag-pill" data-city-id="${city.id}">
            ${this.escapeHtml(city.name.split(" (")[0])}
            <span class="tag-remove" onclick="event.stopPropagation(); window.mapExplorerResetToAllGta();">✕</span>
          </span>
        `;
      }
      tagsRow.innerHTML = html;
    }

    // 2. Render Cities Pills (Administrative Locality)
    const cityPillsRow = document.getElementById("popoverCityPills");
    if (cityPillsRow) {
      const q = (this.popoverSearchQuery || "").toLowerCase();
      let html = "";
      GTA_COMMUNITIES.forEach(c => {
        const title = c.name;
        if (q && !title.toLowerCase().includes(q)) return;
        const isActive = this.activeCityId === c.id;
        const shortName = c.name.split(" (")[0];
        html += `
          <button type="button" class="popover-pill-btn ${isActive ? 'active' : ''}" data-city="${c.id}">
            ${isActive ? '✓ ' : '+ '}${this.escapeHtml(shortName)}
          </button>
        `;
      });
      cityPillsRow.innerHTML = html;
    }
  },

  // -------------------------------------------------------------
  // Pan and Focus on Selected Locality / City (Administrative Level)
  // -------------------------------------------------------------
  panToSelectedArea() {
    const city = GTA_COMMUNITIES.find(c => c.id === this.activeCityId) || GTA_COMMUNITIES[0];
    if (!city || !city.center) return;

    if (this.googleMap && !this.isFallbackMode) {
      this.googleMap.panTo(city.center);
      this.googleMap.setZoom(city.zoom || 12);
    } else if (this.fallbackMap) {
      this.fallbackMap.setView([city.center.lat, city.center.lng], city.zoom || 12);
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
    // No-op (polygons removed)
  },

  drawSelectedBoundaries() {
    this.panToSelectedArea();
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
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⏳</div>
          <div style="font-weight: 600;">正在获取区域 Google Maps 餐馆列表...</div>
        </div>
      `;
    }

    const city = GTA_COMMUNITIES.find(c => c.id === this.activeCityId);
    let areaQuery = "";

    if (this.searchKeyword) {
      areaQuery = this.searchKeyword;
    } else if (city && city.id !== "all") {
      areaQuery = `restaurants in ${city.name.split(" (")[0]} Ontario`;
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
    const regionKeyword = city && city.id !== "all" ? city.name.split(" (")[0] : "";
    let localMatches = this.allRestaurants;
    if (regionKeyword) {
      localMatches = localMatches.filter(r => r.region && r.region.includes(regionKeyword));
    }

    // Merge Google places with local KV items, prioritizing Google places
    const combinedMap = new Map();
    rawPlaces.forEach(p => {
      const key = p.placeId || p.name;
      combinedMap.set(key, p);
    });

    localMatches.slice(0, 40).forEach(r => {
      const key = r.placeId || r.name;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, r);
      }
    });

    // Check KV status and visit records for each place
    this.displayedPlaces = Array.from(combinedMap.values()).map(place => {
      const inKV = this.checkIsInKv(place);
      place.inKV = inKV;

      // Match visit record from KV if exists
      const matchedKv = this.allRestaurants.find(r => 
        (r.placeId && r.placeId === place.placeId) || 
        (r.name && r.name.toLowerCase() === place.name.toLowerCase())
      );

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

    const total = this.filteredPlaces.length;
    const unsaved = this.filteredPlaces.filter(r => !r.inKV).length;

    if (countEl) countEl.textContent = total.toLocaleString();
    if (unsavedCountEl) unsavedCountEl.textContent = unsaved.toLocaleString();

    const city = GTA_COMMUNITIES.find(c => c.id === this.activeCityId);
    const cityName = city ? city.name.split(" (")[0] : "全大区";

    if (regionTitleEl) {
      regionTitleEl.textContent = `${cityName}餐馆列表 (${total} 家)`;
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

    // Plot only the places in the current list (typically 20-50)
    this.filteredPlaces.forEach((r, idx) => {
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
    const marker = this.markersMap.get(key);
    if (!marker) return;

    const r = this.filteredPlaces.find(item => (item.placeId || item.name) === key);
    if (!r) return;

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
  // Right Side Restaurant Cards Rendering
  // -------------------------------------------------------------
  renderPlacesCards() {
    const container = document.getElementById("mapPlacesCardsContainer");
    if (!container) return;

    if (this.filteredPlaces.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          <div style="font-weight: 600; font-size: 0.95rem;">当前区域暂未检索到符合条件的餐馆</div>
          <div style="font-size: 0.8rem; margin-top: 0.35rem;">尝试切换分类或搜索其它商圈</div>
        </div>
      `;
      this.renderPagination(0);
      return;
    }

    const total = this.filteredPlaces.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageItems = this.filteredPlaces.slice(startIdx, startIdx + this.pageSize);

    container.innerHTML = pageItems.map(r => {
      const key = r.placeId || r.name;
      const isSelected = this.selectedMap.has(key);

      const kvBadge = r.inKV
        ? `<span class="badge" style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; font-size:0.72rem; padding:2px 7px; border-radius:4px; font-weight:600;">✓ 已在KV库</span>`
        : `<span class="badge" style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; font-size:0.72rem; padding:2px 7px; border-radius:4px; font-weight:700;">Google新店</span>`;

      const visitBadge = r.isVisited
        ? `<span class="badge" style="background:#ecfdf5; color:#047857; border:1px solid #6ee7b7; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:600;" title="最近拜访: ${this.escapeHtml(r.lastVisitTime || '')}">已拜访 · ${this.escapeHtml(r.lastOutcome || '已记录')}</span>`
        : `<span class="badge" style="background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; font-size:0.7rem; padding:2px 6px; border-radius:4px;">未拜访</span>`;

      const ratingStr = r.rating ? `★ ${parseFloat(r.rating).toFixed(1)}` : "★ 4.2";
      const reviewsStr = r.reviews ? `(${r.reviews})` : "(15+)";
      const categoryStr = r.categoriesRaw || (r.categories ? r.categories.slice(0, 2).join(" · ") : "餐饮美食");

      const saveKvBtn = !r.inKV ? `
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.mapExplorerAddSingleToKv('${this.escapeQuotes(key)}');" style="background:#059669; border-color:#059669; font-size:0.75rem; padding:0.25rem 0.55rem; font-weight:600;" title="立即一键保存到云端KV">
          <span>保存至KV</span>
        </button>
      ` : "";

      const visitActionBtn = r.inKV ? `
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.mapExplorerLogVisit('${this.escapeQuotes(key)}');" style="font-size:0.75rem; padding:0.25rem 0.5rem;" title="登记现场拜访记录">
          <span>拜访记录</span>
        </button>
      ` : "";

      return `
        <div class="map-place-card" data-key="${this.escapeHtml(key)}" onmouseenter="window.mapExplorerHighlight('${this.escapeQuotes(key)}', true);" onmouseleave="window.mapExplorerHighlight('${this.escapeQuotes(key)}', false);" onclick="window.mapExplorerCardClick('${this.escapeQuotes(key)}');">
          <div class="card-thumb">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M18 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path><path d="M6 2v20"></path><path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2"></path></svg>
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
              ${this.escapeHtml(r.address || "安大略省 GTA")}
            </div>

            <div class="card-actions-row">
              ${saveKvBtn}
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.mapExplorerAddSingleToRoute('${this.escapeQuotes(key)}');" style="color:#2563eb; border-color:rgba(37,99,235,0.3); font-size:0.75rem; padding:0.25rem 0.5rem;" title="${i18n.t("btn_add_waypoint")}">
                ${i18n.t("btn_add_waypoint")}
              </button>
              ${visitActionBtn}
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.mapExplorerOpenNav('${this.escapeQuotes(r.name)}', '${this.escapeQuotes(r.address)}');" style="font-size:0.75rem; padding:0.25rem 0.45rem;" title="Google Maps 导航">
                导航
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    this.renderPagination(total);
  },

  renderPagination(total) {
    const infoEl = document.getElementById("mapPaginationInfo");
    const controlsEl = document.getElementById("mapPaginationControls");
    if (!infoEl || !controlsEl) return;

    if (total === 0) {
      infoEl.textContent = "显示 0 - 0 / 共 0 家餐馆";
      controlsEl.innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(total / this.pageSize) || 1;
    const startIdx = (this.currentPage - 1) * this.pageSize + 1;
    const endIdx = Math.min(this.currentPage * this.pageSize, total);

    infoEl.textContent = `显示 ${startIdx} - ${endIdx} / 共 ${total} 家餐馆`;

    let html = `
      <button class="btn btn-secondary btn-sm" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.mapExplorerGoToPage(${this.currentPage - 1})">&lt;</button>
    `;

    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= this.currentPage - 1 && p <= this.currentPage + 1)) {
        html += `
          <button class="btn ${p === this.currentPage ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.mapExplorerGoToPage(${p})">${p}</button>
        `;
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
    const kvBadge = r.inKV 
      ? `<span style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;">✓ 已在KV</span>`
      : `<span style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">未入库</span>`;

    const saveBtn = !r.inKV ? `
      <button onclick="window.mapExplorerAddSingleToKv('${this.escapeQuotes(key)}')" style="background:#059669; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:11px; font-weight:600; cursor:pointer;">
        保存至KV
      </button>
    ` : "";

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 4px; gap:6px;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.3;">${this.escapeHtml(r.name)}</h4>
          <div>${kvBadge}</div>
        </div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">
          ★ ${r.rating ? parseFloat(r.rating).toFixed(1) : "4.2"} (${r.reviews || 10}) · <b>${this.escapeHtml(r.price || "$$")}</b>
        </div>
        <div style="font-size: 12px; color: #334155; margin-bottom: 6px;">
          ${this.escapeHtml(r.address || "暂无地址")}
        </div>
        <div style="display:flex; gap: 6px; border-top: 1px solid #e2e8f0; padding-top: 6px; flex-wrap: wrap;">
          ${saveBtn}
          <button onclick="window.mapExplorerAddSingleToRoute('${this.escapeQuotes(key)}')" style="background:#2563eb; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:11px; font-weight:600; cursor:pointer;">
            ${i18n.t("btn_add_waypoint")}
          </button>
          <button onclick="window.mapExplorerOpenNav('${this.escapeQuotes(r.name)}', '${this.escapeQuotes(r.address)}')" style="background:#0f172a; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">
            导航
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

  // -------------------------------------------------------------
  // Actions: Add to KV, Batch Add to KV, Add to Route
  // -------------------------------------------------------------
  async addSingleToKv(key) {
    const r = this.displayedPlaces.find(item => (item.placeId || item.name) === key);
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
      
      this.highlightMarker(key, false);
      this.renderMarkers();
      this.renderPlacesCards();
      this.updateResultsSummary();
      alert(`🎉 餐馆【${r.name}】已成功添加至云端 KV 数据库！`);
    } else {
      alert("添加失败: " + (res?.error || "未知错误"));
    }
  },

  async batchAddToKv() {
    const unsaved = this.filteredPlaces.filter(r => !r.inKV);
    if (unsaved.length === 0) {
      alert("当前列表中的所有餐馆都已存在于 KV 数据库中，无需重复添加！");
      return;
    }

    if (!confirm(`检测到当前列表共有 ${unsaved.length} 家未入库新店。\n是否将这 ${unsaved.length} 家餐馆全部批量保存到云端 KV 数据库？`)) {
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
        alert(`🎉 成功将 ${unsaved.length} 家餐馆批量保存至云端 KV 数据库！`);
      } else {
        alert("批量保存失败: " + (res?.error || "未知错误"));
      }
    } catch (e) {
      alert("批量保存出错: " + e.message);
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
        this.activeCityId = "all";
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
    }

    // Popover City Pills Click Handler
    const cityPillsRow = document.getElementById("popoverCityPills");
    if (cityPillsRow) {
      cityPillsRow.addEventListener("click", (e) => {
        const btn = e.target.closest(".popover-pill-btn");
        if (!btn) return;
        const cityId = btn.dataset.city;
        if (!cityId) return;

        this.activeCityId = cityId;
        this.renderPopover();
        this.updateAreaSummaryBtn();
        this.panToSelectedArea();
        this.loadPlacesForCurrentArea();
      });
    }

    // Reset To Central GTA Shortcut
    const resetCenterBtn = document.getElementById("popoverCurrentLocationBtn");
    if (resetCenterBtn) {
      resetCenterBtn.addEventListener("click", () => {
        this.activeCityId = "all";
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
            "KV状态": r.inKV ? "已在KV" : "未入库新店",
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
        const marker = MapExplorer.markersMap.get(key);
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
  };

  window.mapExplorerResetToAllGta = function() {
    MapExplorer.activeCityId = "all";
    MapExplorer.renderPopover();
    MapExplorer.updateAreaSummaryBtn();
    MapExplorer.panToSelectedArea();
    MapExplorer.loadPlacesForCurrentArea();
  };
}
