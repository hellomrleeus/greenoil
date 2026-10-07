#!/usr/bin/env python3
"""
Toronto Public Health DineSafe - Daily Sync & Newly Opened Restaurants Ingestion

1. Dynamically discovers latest Dinesafe.csv URL via City of Toronto Open Data CKAN API.
2. Streams and parses inspection records.
3. Groups inspections by establishment and determines the earliest date (first_inspection_date).
4. Determines newly opened restaurants (first inspection within target period).
5. Cleans and formats restaurant name, address, latitude, longitude, and phone.
6. Authenticates with Green Oil Worker API and synchronizes/upserts newly opened restaurants.
"""

import os
import sys
import csv
import json
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from collections import defaultdict

CKAN_PACKAGE_URL = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=dinesafe"


def load_env(custom_path=None):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        custom_path,
        os.path.abspath(".env"),
        os.path.abspath(os.path.join(script_dir, "../.env"))
    ]
    for p in candidates:
        if p and os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            k, v = line.split("=", 1)
                            k, v = k.strip(), v.strip()
                            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                                v = v[1:-1]
                            if k not in os.environ:
                                os.environ[k] = v
                return p
            except Exception:
                pass
    return None


_loaded_env = load_env()
if _loaded_env:
    print(f"[DineSafe] Loaded environment variables from {_loaded_env}")

DEFAULT_WORKER_URL = os.environ.get("WORKER_URL", "https://greenoil-api.ydxhjw4j5w.workers.dev")


def get_latest_dinesafe_csv_url():
    print("[DineSafe] Fetching dataset metadata from Toronto Open Data CKAN API...")
    req = urllib.request.Request(CKAN_PACKAGE_URL, headers={"User-Agent": "GreenOilSync/1.0"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    
    if not data.get("success") or not data.get("result", {}).get("resources"):
        raise RuntimeError("Invalid CKAN API response structure")
        
    resources = data["result"]["resources"]
    csv_resource = None
    for r in resources:
        fmt = (r.get("format") or "").upper()
        name = (r.get("name") or "").lower()
        url = (r.get("url") or "").lower()
        if fmt == "CSV" and ("dinesafe" in name or url.endswith(".csv")):
            csv_resource = r
            break
            
    if not csv_resource or not csv_resource.get("url"):
        raise RuntimeError("Could not find Dinesafe CSV resource in CKAN response")
        
    url = csv_resource["url"]
    print(f"[DineSafe] Found latest CSV resource: '{csv_resource.get('name')}' -> {url}")
    return url


import re


DINING_STOP_WORDS = {
    "restaurant", "restaurants", "cafe", "coffee", "kitchen", "express",
    "cuisine", "bar", "grill", "bakery", "food", "foods", "inc", "ltd", "corp", "co", "the"
}


def clean_address(raw):
    if not raw:
        return ""
    addr = raw.replace(" None ", " ")
    return " ".join(addr.split()).strip()


def parse_address(raw):
    if not raw:
        return {"base": "", "unit": ""}
    s = raw.lower().strip()

    # Strip Canadian postal codes
    s = re.sub(r"\b[a-z]\d[a-z]\s*\d[a-z]\d\b", " ", s, flags=re.I)
    # Strip "None"
    s = re.sub(r"\bnone\b", " ", s, flags=re.I)

    # Strip city / province names only when preceded by comma or followed by province
    # (Prevents stripping street names like "Markham Rd" or "Toronto St")
    s = re.sub(r",\s*(?:markham|toronto|richmond hill|vaughan|scarborough|mississauga)\b", " ", s, flags=re.I)
    s = re.sub(r"\b(?:markham|toronto|richmond hill|vaughan|scarborough|mississauga)\s*,\s*(?:on|ontario)\b", " ", s, flags=re.I)
    s = re.sub(r"\b(?:on|ontario)\b", " ", s, flags=re.I)

    # Prefix unit: "1046L - 5000 Highway 7"
    unit = ""
    m_prefix = re.match(r"^([a-z0-9\-]+)\s*-\s*(\d+\s+[a-z].*)$", s, flags=re.I)
    if m_prefix:
        unit = re.sub(r"^(?:unit|suite|ste|apt)\s*", "", m_prefix.group(1), flags=re.I)
        s = m_prefix.group(2)

    # Standardize road types
    s = re.sub(r"\bavenue\b", "ave", s)
    s = re.sub(r"\bstreet\b", "st", s)
    s = re.sub(r"\broad\b", "rd", s)
    s = re.sub(r"\bboulevard\b", "blvd", s)
    s = re.sub(r"\bdrive\b", "dr", s)
    s = re.sub(r"\bcourt\b", "crt", s)
    s = re.sub(r"\bcircle\b", "cir", s)
    s = re.sub(r"\bplace\b", "pl", s)
    s = re.sub(r"\bterrace\b", "terr", s)
    s = re.sub(r"\bexpressway\b", "exp", s)
    s = re.sub(r"\bparkway\b", "pkwy", s)
    s = re.sub(r"\bsquare\b", "sq", s)
    s = re.sub(r"\blane\b", "ln", s)
    s = re.sub(r"\bhighway\b", "hwy", s)
    s = re.sub(r"\bway\b", "way", s)
    s = re.sub(r"\bcrescent\b", "cres", s)

    # Standardize directions
    s = re.sub(r"\beast\b", "e", s)
    s = re.sub(r"\bwest\b", "w", s)
    s = re.sub(r"\bnorth\b", "n", s)
    s = re.sub(r"\bsouth\b", "s", s)

    s = re.sub(r"[,#]", " ", s)
    s = " ".join(s.split()).strip()

    if not unit:
        unit_match = re.search(r"\b(?:unit|suite|ste|apt|apartment|bldg|building)\b[\s\-:]*([a-z0-9\-]+)", s, flags=re.I)
        if unit_match:
            unit = unit_match.group(1)
            s = s[:unit_match.start()] + " " + s[unit_match.end():]
        else:
            m_trailing = re.search(r"\b(ave|st|rd|blvd|dr|crt|cir|pl|terr|exp|pkwy|sq|ln|way|cres)(?:\s+([ewns]))\s+([0-9]+[a-z0-9\-]*)$", s, flags=re.I)
            m_trailing_nodir = re.search(r"\b(ave|st|rd|blvd|dr|crt|cir|pl|terr|exp|pkwy|sq|ln|way|cres)\s+([0-9]+[a-z0-9\-]*)$", s, flags=re.I)
            if m_trailing:
                unit = m_trailing.group(3)
                s = s[:m_trailing.start()] + m_trailing.group(1) + " " + m_trailing.group(2)
            elif m_trailing_nodir:
                unit = m_trailing_nodir.group(2)
                s = s[:m_trailing_nodir.start()] + m_trailing_nodir.group(1)

    s = re.sub(r"[^a-z0-9]", " ", s)
    s = " ".join(s.split()).strip()
    unit = re.sub(r"[^a-z0-9]", "", unit).strip()

    return {"base": s, "unit": unit}


def normalize_address_key(raw):
    if not raw:
        return ""
    parsed = parse_address(raw)
    if parsed["base"]:
        return parsed["base"]
    s = raw.lower().replace("none", " ")
    s = re.sub(r"[^a-z0-9]", " ", s)
    return " ".join(s.split()).strip()


def normalize_name_key(raw):
    if not raw:
        return ""
    s = raw.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]", " ", s)
    return " ".join(s.split()).strip()


def is_similar_business_name(n1, n2):
    if not n1 or not n2:
        return False
    if n1 == n2:
        return True
    if n1 in n2 or n2 in n1:
        return True
    words1 = [w for w in n1.split() if len(w) > 1]
    words2 = [w for w in n2.split() if len(w) > 1]

    sig1 = {w for w in words1 if w not in DINING_STOP_WORDS}
    sig2 = {w for w in words2 if w not in DINING_STOP_WORDS}

    if not sig1 or not sig2:
        all1 = set(words1)
        all2 = set(words2)
        common = len(all1 & all2)
        return common == min(len(all1), len(all2))

    common_sig = len(sig1 & sig2)
    min_sig_len = min(len(sig1), len(sig2))
    return min_sig_len > 0 and (common_sig / min_sig_len >= 0.5)


def process_dinesafe_records(lines_iterable):
    reader = csv.DictReader(lines_iterable)
    base_addr_map = defaultdict(list)

    total_rows = 0
    for row in reader:
        total_rows += 1
        est_id = row.get("estId") or row.get("oldEstId")
        name = (row.get("estName") or "").strip()
        address = clean_address(row.get("address"))
        
        if not name:
            continue

        parsed = parse_address(address)
        base_addr = parsed["base"] or address.lower()
        unit = parsed["unit"]
        name_norm = normalize_name_key(name)

        lat_val = None
        lng_val = None
        if row.get("latitude") and row.get("longitude"):
            try:
                lat_val = float(row["latitude"])
                lng_val = float(row["longitude"])
            except ValueError:
                pass

        base_addr_map[base_addr].append({
            "estId": est_id,
            "estName": name,
            "nameNorm": name_norm,
            "address": address,
            "unit": unit,
            "date": (row.get("inspectionDate") or "").strip(),
            "lat": lat_val,
            "lng": lng_val,
            "phone": (row.get("phone") or "").strip(),
            "status": (row.get("inspectionStatus") or "Pass").strip()
        })

    results = []
    relicensed_merged = 0

    for base_addr, items in base_addr_map.items():
        clusters = []
        for item in items:
            matched_cluster = None
            for cl in clusters:
                is_official_id_match = bool(item["estId"] and item["estId"] in cl["ids"])
                is_name_identical = (cl["nameNorm"] == item["nameNorm"])
                is_name_similar = is_similar_business_name(cl["nameNorm"], item["nameNorm"])

                if is_official_id_match or is_name_identical or (is_name_similar and (not cl["unit"] or not item["unit"] or cl["unit"] == item["unit"])):
                    matched_cluster = cl
                    break

            if matched_cluster:
                if item["date"] and re.match(r"^\d{4}-\d{2}-\d{2}$", item["date"]):
                    matched_cluster["dates"].append(item["date"])
                matched_cluster["inspectionCount"] += 1
                if item["estId"]:
                    matched_cluster["ids"].add(item["estId"])
                if not matched_cluster["unit"] and item["unit"]:
                    matched_cluster["unit"] = item["unit"]
                if not matched_cluster["latestDate"] or item["date"] > matched_cluster["latestDate"]:
                    matched_cluster["latestDate"] = item["date"]
                    matched_cluster["id"] = item["estId"] or matched_cluster["id"]
                    matched_cluster["name"] = item["estName"]
                    matched_cluster["address"] = item["address"]
                    matched_cluster["status"] = item["status"]
                    if item["lat"] is not None and item["lng"] is not None:
                        matched_cluster["lat"] = item["lat"]
                        matched_cluster["lng"] = item["lng"]
                    if item["phone"]:
                        matched_cluster["phone"] = item["phone"]
            else:
                cl = {
                    "id": item["estId"] or f"{item['estName']}|{item['address']}",
                    "name": item["estName"],
                    "nameNorm": item["nameNorm"],
                    "unit": item["unit"],
                    "address": item["address"],
                    "lat": item["lat"],
                    "lng": item["lng"],
                    "phone": item["phone"],
                    "status": item["status"],
                    "dates": [item["date"]] if item["date"] and re.match(r"^\d{4}-\d{2}-\d{2}$", item["date"]) else [],
                    "latestDate": item["date"] or "",
                    "inspectionCount": 1,
                    "ids": {item["estId"]} if item["estId"] else set()
                }
                clusters.append(cl)

        unique_ids = {it["estId"] for it in items if it.get("estId")}
        if len(unique_ids) > len(clusters):
            relicensed_merged += (len(unique_ids) - len(clusters))

        for cl in clusters:
            if not cl["dates"]:
                continue
            cl["dates"].sort()
            first_date = cl["dates"][0]
            latest_date = cl["dates"][-1]

            results.append({
                "id": cl["id"],
                "name": cl["name"],
                "address": cl["address"],
                "estimatedOpeningDate": first_date,
                "firstInspectionDate": first_date,
                "latestInspectionDate": latest_date,
                "latitude": cl["lat"],
                "longitude": cl["lng"],
                "phone": cl["phone"],
                "inspectionCount": cl["inspectionCount"],
                "status": cl["status"]
            })

    print(f"[DineSafe] Parsed {total_rows} inspection records into {len(results)} unique establishments (merged {relicensed_merged} relicensed ID transitions).")
    return results


def filter_newly_opened(establishments, max_days=90, reference_date_str=None):
    if not reference_date_str:
        max_date = ""
        for est in establishments:
            if est["latestInspectionDate"] > max_date:
                max_date = est["latestInspectionDate"]
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        reference_date_str = max_date if max_date > today_str else today_str

    ref_date = datetime.strptime(reference_date_str, "%Y-%m-%d")
    cutoff_date = (ref_date - timedelta(days=max_days)).strftime("%Y-%m-%d")

    print(f"[DineSafe] Filtering newly opened restaurants: referenceDate={reference_date_str}, cutoffDate={cutoff_date} ({max_days} days window)")

    filtered = [
        est for est in establishments
        if cutoff_date <= est["firstInspectionDate"] <= reference_date_str
    ]
    filtered.sort(key=lambda x: x["firstInspectionDate"], reverse=True)
    return filtered, reference_date_str, cutoff_date


def upload_to_backend(restaurants, worker_url=None, username=None, password=None, token=None):
    worker_url = worker_url or os.environ.get("WORKER_URL", DEFAULT_WORKER_URL)
    token = token or os.environ.get("WORKER_TOKEN")

    if not token:
        username = username or os.environ.get("WORKER_USERNAME")
        password = password or os.environ.get("WORKER_PASSWORD")

        if not username or not password:
            raise ValueError(
                "Missing backend credentials. Please configure WORKER_TOKEN or WORKER_USERNAME and WORKER_PASSWORD in .env, or specify CLI flags."
            )

        print(f"[DineSafe] Authenticating with Green Oil backend at {worker_url}......")
        login_payload = json.dumps({"username": username, "password": password}).encode("utf-8")
        login_req = urllib.request.Request(
            f"{worker_url}/api/login",
            data=login_payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
        )
        
        with urllib.request.urlopen(login_req) as resp:
            login_res = json.loads(resp.read().decode("utf-8"))
            token = login_res.get("token")

        if not token:
            raise RuntimeError("Login failed: no token returned")
            
        print(f"[DineSafe] Successfully authenticated as '{username}'.")
    else:
        print("[DineSafe] Authenticating with Green Oil backend using session token...")

    batch_size = 100
    total_uploaded = 0
    for i in range(0, len(restaurants), batch_size):
        chunk = restaurants[i:i + batch_size]
        payload = json.dumps({"restaurants": chunk}).encode("utf-8")
        req = urllib.request.Request(
            f"{worker_url}/api/new-restaurants/sync",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
        )
        with urllib.request.urlopen(req) as resp:
            sync_res = json.loads(resp.read().decode("utf-8"))
            if sync_res.get("success"):
                total_uploaded += len(chunk)
                print(f"[DineSafe] Uploaded batch {i // batch_size + 1} ({total_uploaded}/{len(restaurants)} restaurants)")
            else:
                print(f"[DineSafe] Warning: batch {i // batch_size + 1} returned success=false: {sync_res}")

    print(f"[DineSafe] Successfully synced {total_uploaded} restaurants to backend.")
    return total_uploaded


def main():
    parser = argparse.ArgumentParser(description="DineSafe Daily Sync & Ingestion")
    parser.add_argument("--file", help="Path to local Dinesafe.csv file")
    parser.add_argument("--days", type=int, default=90, help="Max days for newly opened filter (default: 90)")
    parser.add_argument("--env", help="Path to custom .env file")
    parser.add_argument("--worker-url", help="Worker API base URL")
    parser.add_argument("--username", help="Worker username")
    parser.add_argument("--password", help="Worker password")
    parser.add_argument("--token", help="Worker session token")
    parser.add_argument("--dry-run", action="store_true", help="Parse and filter without uploading")
    args = parser.parse_args()

    if args.env:
        load_env(args.env)

    worker_url = args.worker_url or os.environ.get("WORKER_URL", DEFAULT_WORKER_URL)
    username = args.username or os.environ.get("WORKER_USERNAME")
    password = args.password or os.environ.get("WORKER_PASSWORD")
    token = args.token or os.environ.get("WORKER_TOKEN")

    if args.file and os.path.exists(args.file):
        print(f"[DineSafe] Reading local CSV file: {args.file}")
        with open(args.file, "r", encoding="utf-8", errors="replace") as f:
            all_establishments = process_dinesafe_records(f)
    else:
        csv_url = get_latest_dinesafe_csv_url()
        print(f"[DineSafe] Streaming download from {csv_url}...")
        req = urllib.request.Request(csv_url, headers={"User-Agent": "GreenOilSync/1.0"})
        with urllib.request.urlopen(req) as resp:
            lines = (line.decode("utf-8", errors="replace") for line in resp)
            all_establishments = process_dinesafe_records(lines)

    newly_opened, ref_date_str, cutoff_date_str = filter_newly_opened(all_establishments, max_days=args.days)
    ref_date = datetime.strptime(ref_date_str, "%Y-%m-%d")

    count_1d = sum(1 for e in newly_opened if (ref_date - datetime.strptime(e["firstInspectionDate"], "%Y-%m-%d")).days <= 1)
    count_7d = sum(1 for e in newly_opened if (ref_date - datetime.strptime(e["firstInspectionDate"], "%Y-%m-%d")).days <= 7)
    count_30d = sum(1 for e in newly_opened if (ref_date - datetime.strptime(e["firstInspectionDate"], "%Y-%m-%d")).days <= 30)

    print("\n========================================")
    print("  DineSafe Data Processing Summary")
    print("========================================")
    print(f"Reference Date:           {ref_date_str}")
    print(f"Newly Opened (1 Day):     {count_1d} restaurants")
    print(f"Newly Opened (7 Days):    {count_7d} restaurants")
    print(f"Newly Opened (30 Days):   {count_30d} restaurants")
    print(f"Total In Target Window:   {len(newly_opened)} restaurants (past {args.days} days)")
    print("========================================\n")

    if args.dry_run:
        print("[DineSafe] Dry run completed. Skipping backend upload.")
        return

    try:
        upload_to_backend(newly_opened, worker_url=worker_url, username=username, password=password, token=token)
    except Exception as e:
        print(f"[DineSafe] Upload to backend failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
