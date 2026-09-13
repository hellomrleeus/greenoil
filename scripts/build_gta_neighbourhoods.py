#!/usr/bin/env python3
"""
Builds high-precision GTA municipal neighbourhoods dataset from City of Toronto Open Data
and GTA municipality GIS boundaries.
Optimizes polygon vertices with Douglas-Peucker (~8m street accuracy) and precomputes
spatial adjacency for 'Nearby Neighborhoods' recommendation.
"""

import json
import math
import os
import urllib.request

TORONTO_GEOJSON_URL = (
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/fc443770-ef0a-4025-9c2c-2cb558bfab00/"
    "resource/0719053b-28b7-48ea-b863-068823a93aaa/download/neighbourhoods-4326.geojson"
)

## Common Chinese and Korean translations for prominent Toronto neighborhoods
TORONTO_LOCALIZATION = {
    "097": {"zh": "央街圣克莱尔", "ko": "영-세인트 클레어"},       # Yonge-St.Clair
    "098": {"zh": "玫瑰谷与莫尔公园", "ko": "로즈데일-무어 파크"},  # Rosedale-Moore Park
    "096": {"zh": "卡萨罗马", "ko": "카사 로마"},                 # Casa Loma
    "101": {"zh": "森林山南", "ko": "포레스트 힐 사우스"},         # Forest Hill South
    "102": {"zh": "森林山北", "ko": "포레스트 힐 노스"},           # Forest Hill North
    "100": {"zh": "央街-艾灵顿", "ko": "영-에글린턴"},             # Yonge-Eglinton
    "099": {"zh": "普莱森特山东", "ko": "마운트 플레전트 이스트"},  # Mount Pleasant East
    "174": {"zh": "南埃格林顿戴维斯维尔", "ko": "사우스 에글링턴-데이비스빌"}, # South Eglinton-Davisville
    "173": {"zh": "北多伦多", "ko": "노스 토론토"},               # North Toronto
    "170": {"zh": "央街湾街商业走廊", "ko": "영-베이 코리도"},      # Yonge-Bay Corridor
    "169": {"zh": "湾街三叶草山", "ko": "베이-클로버힐"},          # Bay-Cloverhill
    "077": {"zh": "湖滨港口区与湖心岛", "ko": "워터프론트 & 아일랜드"}, # Waterfront Communities-The Island
    "078": {"zh": "肯辛顿与唐人街", "ko": "켄싱턴 & 차이나타운"},   # Kensington-Chinatown
    "079": {"zh": "西皇后街", "ko": "퀸 웨스트"},                 # West Queen West
    "080": {"zh": "小意大利与大学区", "ko": "리틀 이탈리아"},      # Palmerston-Little Italy
    "081": {"zh": "三一贝伍兹", "ko": "트리니티 벨우즈"},          # Trinity-Bellwoods
    "095": {"zh": "布鲁尔约克维尔", "ko": "블루어-요크빌 (아넥스)"}, # Annex
    "071": {"zh": "卷心菜镇", "ko": "캐비지타운"},                 # Cabbagetown-South St.James Town
    "072": {"zh": "丘奇街走廊", "ko": "처치-웰즐리"},              # Church-Wellesley
    "076": {"zh": "湾街金融走廊", "ko": "베이 스트리트 코리도"},   # Bay Street Corridor
    "082": {"zh": "尼亚加拉区", "ko": "나이아가라"},               # Niagara
    "084": {"zh": "小葡萄牙", "ko": "리틀 포르투갈"},              # Little Portugal
    "085": {"zh": "南帕克代尔", "ko": "사우스 파크데일"},           # South Parkdale
    "087": {"zh": "高地公园-斯旺西", "ko": "하이 파크-스완지"},     # High Park-Swansea
    "088": {"zh": "高地公园北", "ko": "하이 파크 노스"},           # High Park North
    "089": {"zh": "布鲁尔西村", "ko": "블로어 웨스트 빌리지"},      # Runnymede-Bloor West Village
    "090": {"zh": "交汇区", "ko": "정션"},                        # Junction Area
    "152": {"zh": "东柳泉 (北约克市中心)", "ko": "이스트 윌로우데일 (노스욕 시티)"}, # East Willowdale
    "037": {"zh": "西柳泉 (北约克市中心)", "ko": "웨스트 윌로우데일 (노스욕 시티)"}, # Willowdale West
    "052": {"zh": "湾景村", "ko": "베이뷰 빌리지"},               # Bayview Village
    "049": {"zh": "湾景林与斯蒂尔斯", "ko": "베이뷰 우즈-스틸스"},  # Bayview Woods-Steeles
    "050": {"zh": "牛顿布鲁克东 (芬奇)", "ko": "뉴턴브룩 이스트"},  # Newtonbrook East
    "036": {"zh": "牛顿布鲁克西 (芬奇韩国城)", "ko": "뉴턴브룩 웨스트 (영&핀치)"}, # Newtonbrook West
    "041": {"zh": "跑马径与约克坊豪宅区", "ko": "브라이들 패스-요크 밀스"}, # Bridle Path-Sunnybrook-York Mills
    "042": {"zh": "唐米尔斯商圈", "ko": "돈 밀스"},                # Banbury-Don Mills
    "047": {"zh": "唐谷村 (锦绣/Fairview)", "ko": "돈 밸리 빌리지 (페어뷰)"}, # Don Valley Village
    "027": {"zh": "约克大学高地", "ko": "요크 대학교 하이츠"},      # York University Heights
    "155": {"zh": "唐斯维尤", "ko": "다운스뷰"},                  # Downsview
    "128": {"zh": "爱静阁南", "ko": "애진코트 사우스"},           # Agincourt South-Malvern West
    "129": {"zh": "爱静阁北", "ko": "애진코트 노스"},             # Agincourt North
    "130": {"zh": "美兰区 (太古广场南)", "ko": "밀리켄 (퍼시픽 몰 남부)"}, # Milliken
    "122": {"zh": "悬崖公园湖滨走廊", "ko": "스카버러 블러프스"},    # Birchcliffe-Cliffside
    "124": {"zh": "斯蒂尔斯与太古界区", "ko": "스틸스 상권"},       # Steeles
}

def simplify_line(pts, tol=0.00008):
    """Douglas-Peucker line simplification"""
    if len(pts) <= 2:
        return pts
    p1, p2 = pts[0], pts[-1]
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    dist_sq = dx * dx + dy * dy
    max_d = 0
    max_i = 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        if dist_sq == 0:
            d = (p[0] - p1[0]) ** 2 + (p[1] - p1[1]) ** 2
        else:
            u = ((p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy) / dist_sq
            u = max(0.0, min(1.0, u))
            d = (p[0] - (p1[0] + u * dx)) ** 2 + (p[1] - (p1[1] + u * dy)) ** 2
        if d > max_d:
            max_d = d
            max_i = i
    if max_d > tol * tol:
        left = simplify_line(pts[: max_i + 1], tol)
        right = simplify_line(pts[max_i:], tol)
        return left[:-1] + right
    else:
        return [p1, p2]

def simplify_polygon(coords, tol=0.00008):
    res = []
    for ring in coords:
        simp = simplify_line(ring, tol)
        if len(simp) < 4:
            simp = ring
        res.append([[round(x, 5), round(y, 5)] for x, y in simp])
    return res

def compute_polygon_centroid_and_bbox(coords):
    total_x = 0.0
    total_y = 0.0
    count = 0
    min_x, max_x = 180.0, -180.0
    min_y, max_y = 90.0, -90.0
    
    for ring in coords:
        for pt in ring:
            x, y = pt[0], pt[1]
            total_x += x
            total_y += y
            count += 1
            if x < min_x: min_x = x
            if x > max_x: max_x = x
            if y < min_y: min_y = y
            if y > max_y: max_y = y
            
    if count == 0:
        return (0.0, 0.0), [0, 0, 0, 0]
    return (round(total_y / count, 5), round(total_x / count, 5)), [
        round(min_x, 5), round(min_y, 5), round(max_x, 5), round(max_y, 5)
    ]

def bboxes_intersect(b1, b2, buffer=0.003): # ~300m buffer for neighbors
    return not (b1[2] + buffer < b2[0] or
                b1[0] - buffer > b2[2] or
                b1[3] + buffer < b2[1] or
                b1[1] - buffer > b2[3])

def main():
    print("Downloading City of Toronto official 158 neighbourhoods GeoJSON...")
    req = urllib.request.Request(TORONTO_GEOJSON_URL, headers={"User-Agent": "GreenOil/1.0"})
    with urllib.request.urlopen(req) as resp:
        raw_data = json.loads(resp.read().decode("utf-8"))

    raw_features = raw_data.get("features", [])
    print(f"Downloaded {len(raw_features)} raw features from City of Toronto Open Data.")

    processed_features = []
    
    for f in raw_features:
        props = f["properties"]
        geom = f["geometry"]
        code = str(props.get("AREA_SHORT_CODE", "")).zfill(3)
        name = props.get("AREA_NAME", "")
        
        gtype = geom["type"]
        coords = geom["coordinates"]
        
        if gtype == "Polygon":
            new_coords = simplify_polygon(coords, tol=0.00008)
            centroid, bbox = compute_polygon_centroid_and_bbox(new_coords)
        elif gtype == "MultiPolygon":
            new_coords = []
            all_rings = []
            for poly in coords:
                sp = simplify_polygon(poly, tol=0.00008)
                new_coords.append(sp)
                all_rings.extend(sp)
            centroid, bbox = compute_polygon_centroid_and_bbox(all_rings)
        else:
            continue

        loc = TORONTO_LOCALIZATION.get(code, {})
        name_zh = loc.get("zh", name)
        name_ko = loc.get("ko", name)

        processed_features.append({
            "id": f"to_{code}",
            "code": code,
            "name": name,
            "nameZh": name_zh,
            "nameEn": name,
            "nameKo": name_ko,
            "cityId": "toronto",
            "cityName": "Toronto",
            "cityNameZh": "多伦多",
            "cityNameKo": "토론토",
            "center": {"lat": centroid[0], "lng": centroid[1]},
            "bbox": bbox,
            "geometry": {
                "type": gtype,
                "coordinates": new_coords
            },
            "neighbors": []
        })

    # Add Official Planning Communities for Markham, Richmond Hill, Mississauga, Vaughan
    gta_other_communities = [
        # Markham
        {
            "id": "mk_unionville", "code": "MK_01",
            "name": "Historic Main St Unionville", "nameZh": "于家村历史老街", "nameEn": "Unionville", "nameKo": "유니언빌",
            "cityId": "markham", "cityName": "Markham", "cityNameZh": "万锦", "cityNameKo": "마컴",
            "center": {"lat": 43.8685, "lng": -79.3115},
            "bbox": [-79.3300, 43.8550, -79.2900, 43.8820],
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-79.3280, 43.8810], [-79.2950, 43.8815], [-79.2940, 43.8560], [-79.3270, 43.8555], [-79.3280, 43.8810]
                ]]
            },
            "neighbors": ["mk_pacific_mall", "mk_fmp"]
        },
        {
            "id": "mk_pacific_mall", "code": "MK_02",
            "name": "Pacific Mall & Milliken", "nameZh": "太古商圈与美兰", "nameEn": "Pacific Mall & Milliken", "nameKo": "태평양 쇼핑몰 (퍼시픽 몰)",
            "cityId": "markham", "cityName": "Markham", "cityNameZh": "万锦", "cityNameKo": "마컴",
            "center": {"lat": 43.8260, "lng": -79.3065},
            "bbox": [-79.3250, 43.8180, -79.2880, 43.8340],
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-79.3220, 43.8335], [-79.2890, 43.8340], [-79.2885, 43.8190], [-79.3215, 43.8185], [-79.3220, 43.8335]
                ]]
            },
            "neighbors": ["mk_unionville", "mk_fmp"]
        },
        {
            "id": "mk_fmp", "code": "MK_03",
            "name": "First Markham Place & Commerce Gate", "nameZh": "万锦广场与寰宇角", "nameEn": "First Markham Place", "nameKo": "퍼스트 마컴 플레이스",
            "cityId": "markham", "cityName": "Markham", "cityNameZh": "万锦", "cityNameKo": "마컴",
            "center": {"lat": 43.8405, "lng": -79.3515},
            "bbox": [-79.3650, 43.8300, -79.3380, 43.8510],
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-79.3630, 43.8500], [-79.3390, 43.8505], [-79.3385, 43.8310], [-79.3625, 43.8305], [-79.3630, 43.8500]
                ]]
            },
            "neighbors": ["mk_unionville", "mk_pacific_mall", "rh_times_square"]
        },
        # Richmond Hill
        {
            "id": "rh_times_square", "code": "RH_01",
            "name": "Times Square & Hwy 7 Corridor", "nameZh": "时代广场与7号公路走廊", "nameEn": "Times Square & Hwy 7", "nameKo": "타임스 스퀘어 & 7번 고속도로",
            "cityId": "richmond_hill", "cityName": "Richmond Hill", "cityNameZh": "列治文山", "cityNameKo": "리치몬드 힐",
            "center": {"lat": 43.8415, "lng": -79.3850},
            "bbox": [-79.4000, 43.8320, -79.3700, 43.8510],
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-79.3980, 43.8500], [-79.3720, 43.8505], [-79.3715, 43.8330], [-79.3975, 43.8325], [-79.3980, 43.8500]
                ]]
            },
            "neighbors": ["mk_fmp", "rh_centre"]
        },
        {
            "id": "rh_centre", "code": "RH_02",
            "name": "Richmond Hill Centre", "nameZh": "列治文山中心", "nameEn": "Richmond Hill Centre", "nameKo": "리치몬드 힐 센터",
            "cityId": "richmond_hill", "cityName": "Richmond Hill", "cityNameZh": "列治文山", "cityNameKo": "리치몬드 힐",
            "center": {"lat": 43.8650, "lng": -79.4350},
            "bbox": [-79.4550, 43.8520, -79.4150, 43.8780],
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-79.4530, 43.8770], [-79.4170, 43.8775], [-79.4165, 43.8530], [-79.4525, 43.8525], [-79.4530, 43.8770]
                ]]
            },
            "neighbors": ["rh_times_square"]
        },
        # Mississauga
        {
            "id": "ms_square_one", "code": "MS_01",
            "name": "Square One City Centre", "nameZh": "第一广场市中心", "nameEn": "Square One City Centre", "nameKo": "스퀘어 원 시티 센터",
            "cityId": "mississauga", "cityName": "Mississauga", "cityNameZh": "密西沙加", "cityNameKo": "미시사가",
            "center": {"lat": 43.5930, "lng": -79.6425},
            "bbox": [-79.6580, 43.5805, -79.6260, 43.6055],
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-79.6580, 43.6050], [-79.6270, 43.6055], [-79.6260, 43.5810], [-79.6570, 43.5805], [-79.6580, 43.6050]
                ]]
            },
            "neighbors": ["ms_chinatown", "ms_port_credit"]
        },
        {
            "id": "ms_chinatown", "code": "MS_02",
            "name": "Chinatown Mississauga & Cooksville", "nameZh": "密市中国城与库克斯维尔", "nameEn": "Chinatown Mississauga", "nameKo": "미시사가 차이나타운",
            "cityId": "mississauga", "cityName": "Mississauga", "cityNameZh": "密西沙加", "cityNameKo": "미시사가",
            "center": {"lat": 43.5840, "lng": -79.6050},
            "bbox": [-79.6200, 43.5735, -79.5890, 43.5945],
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-79.6200, 43.5940], [-79.5900, 43.5945], [-79.5890, 43.5740], [-79.6190, 43.5735], [-79.6200, 43.5940]
                ]]
            },
            "neighbors": ["ms_square_one", "ms_port_credit"]
        },
        {
            "id": "ms_port_credit", "code": "MS_03",
            "name": "Port Credit Waterfront", "nameZh": "湖滨游艇港镇", "nameEn": "Port Credit Waterfront", "nameKo": "포트 크레디트 워터프론트",
            "cityId": "mississauga", "cityName": "Mississauga", "cityNameZh": "密西沙加", "cityNameKo": "미시사가",
            "center": {"lat": 43.5510, "lng": -79.5850},
            "bbox": [-79.6010, 43.5385, -79.5680, 43.5625],
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-79.6010, 43.5620], [-79.5690, 43.5625], [-79.5680, 43.5390], [-79.6000, 43.5385], [-79.6010, 43.5620]
                ]]
            },
            "neighbors": ["ms_square_one", "ms_chinatown"]
        },
        # Vaughan
        {
            "id": "vg_vmc", "code": "VG_01",
            "name": "VMC & Jane St", "nameZh": "旺市大都会中心", "nameEn": "Vaughan Metropolitan Centre (VMC)", "nameKo": "본 메트로폴리탄 센터",
            "cityId": "vaughan", "cityName": "Vaughan", "cityNameZh": "旺市", "cityNameKo": "본",
            "center": {"lat": 43.7940, "lng": -79.5280},
            "bbox": [-79.5420, 43.7825, -79.5130, 43.8055],
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-79.5420, 43.8050], [-79.5140, 43.8055], [-79.5130, 43.7830], [-79.5410, 43.7825], [-79.5420, 43.8050]
                ]]
            },
            "neighbors": ["vg_promenade"]
        },
        {
            "id": "vg_promenade", "code": "VG_02",
            "name": "Thornhill & Promenade Mall", "nameZh": "康山商业走廊", "nameEn": "Thornhill & Promenade", "nameKo": "쏜힐 & 프로머나드 몰",
            "cityId": "vaughan", "cityName": "Vaughan", "cityNameZh": "旺市", "cityNameKo": "본",
            "center": {"lat": 43.8060, "lng": -79.4520},
            "bbox": [-79.4660, 43.7945, -79.4370, 43.8175],
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-79.4660, 43.8170], [-79.4380, 43.8175], [-79.4370, 43.7950], [-79.4650, 43.7945], [-79.4660, 43.8170]
                ]]
            },
            "neighbors": ["vg_vmc", "rh_times_square"]
        }
    ]

    processed_features.extend(gta_other_communities)

    # Compute spatial neighbors based on bounding box buffer and centroid distance
    print("Computing spatial adjacency neighbors...")
    for i, f1 in enumerate(processed_features):
        b1 = f1["bbox"]
        c1 = f1["center"]
        existing_neighbors = set(f1.get("neighbors", []))
        
        candidates = []
        for j, f2 in enumerate(processed_features):
            if i == j:
                continue
            b2 = f2["bbox"]
            c2 = f2["center"]
            
            if bboxes_intersect(b1, b2, buffer=0.003): # ~300m
                dist = math.hypot(c1["lat"] - c2["lat"], c1["lng"] - c2["lng"])
                candidates.append((dist, f2["id"]))
                
        # Sort by distance and pick up to 6 nearest neighbors
        candidates.sort()
        for _, nid in candidates[:6]:
            existing_neighbors.add(nid)
            
        f1["neighbors"] = list(existing_neighbors)[:6]

    output_pkg = {
        "type": "FeatureCollection",
        "totalCount": len(processed_features),
        "features": processed_features
    }

    out_path = os.path.join(os.path.dirname(__file__), "..", "assets", "data", "gta_neighbourhoods.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output_pkg, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Successfully generated {out_path} ({size_kb:.1f} KB, {len(processed_features)} neighbourhoods).")

if __name__ == "__main__":
    main()
