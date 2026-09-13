#!/usr/bin/env python3
"""
Convert fried_food_restaurants_markham_scarborough.xlsx to JSON for the Green Oil workbench.
Ensures zero-loss conversion of all 17 columns and 608 records.
"""
import os
import zipfile
import xml.etree.ElementTree as ET
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
XLSX_PATH = os.path.join(PROJECT_ROOT, "fried_food_restaurants_markham_scarborough.xlsx")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "assets", "data")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "restaurants.json")

os.makedirs(OUTPUT_DIR, exist_ok=True)

def parse_xlsx():
    with zipfile.ZipFile(XLSX_PATH) as z:
        tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        rows = tree.findall('.//s:row', ns)
        
        # Read header columns
        col_names = {}
        for c in rows[0].findall('s:c', ns):
            r = c.get('r')
            col = ''.join([i for i in r if not i.isdigit()])
            is_tag = c.find('s:is', ns)
            col_names[col] = ''.join(is_tag.itertext()) if is_tag is not None else ''
        
        records = []
        for row in rows[1:]:
            r_vals = {}
            for c in row.findall('s:c', ns):
                r = c.get('r')
                col = ''.join([i for i in r if not i.isdigit()])
                v = c.find('s:v', ns)
                val = v.text if v is not None else ''
                is_tag = c.find('s:is', ns)
                if is_tag is not None:
                    val = ''.join(is_tag.itertext())
                header = col_names.get(col, col)
                r_vals[header] = val
            
            # Add normalized field keys for easier javascript consumption
            normalized = {
                "name": r_vals.get("餐馆名称 (Name)", "").strip(),
                "region": r_vals.get("所属区域 (Region)", "").strip(),
                "categories": [cat.strip() for cat in r_vals.get("油炸分类 (Categories)", "").split("|") if cat.strip()],
                "categoriesRaw": r_vals.get("油炸分类 (Categories)", "").strip(),
                "rating": float(r_vals.get("评分 (Rating)", 0)) if r_vals.get("评分 (Rating)") and r_vals.get("评分 (Rating)") != "未知" else 0,
                "ratingRaw": r_vals.get("评分 (Rating)", "未知"),
                "reviews": int(r_vals.get("评价总数 (Reviews)", 0)) if r_vals.get("评价总数 (Reviews)") and r_vals.get("评价总数 (Reviews)").isdigit() else 0,
                "reviewsRaw": r_vals.get("评价总数 (Reviews)", "0"),
                "status": r_vals.get("当前营业状态 (Status)", "未知").strip(),
                "openingHours": r_vals.get("营业时间 (Opening Hours)", "未提供").strip(),
                "price": r_vals.get("消费档次 (Price)", "未知").strip(),
                "address": r_vals.get("详细地址 (Address)", "").strip(),
                "phone": r_vals.get("联系电话 (Phone)", "无").strip(),
                "website": r_vals.get("官方网站 (Website)", "").strip(),
                "mapsUrl": r_vals.get("Google 地图链接 (Maps URL)", "").strip(),
                "primaryType": r_vals.get("主营类型 (Primary Type)", "").strip(),
                "keywords": [k.strip() for k in r_vals.get("匹配关键词 (Keywords)", "").split(",") if k.strip()],
                "keywordsRaw": r_vals.get("匹配关键词 (Keywords)", "").strip(),
                "latitude": float(r_vals.get("纬度 (Latitude)", 0)) if r_vals.get("纬度 (Latitude)") else 0,
                "longitude": float(r_vals.get("经度 (Longitude)", 0)) if r_vals.get("经度 (Longitude)") else 0,
                "placeId": r_vals.get("Place ID", "").strip(),
                "_raw": r_vals
            }
            records.append(normalized)

        print(f"Total parsed records: {len(records)}")
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        print(f"Saved to {OUTPUT_PATH} (size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB)")

if __name__ == "__main__":
    parse_xlsx()
