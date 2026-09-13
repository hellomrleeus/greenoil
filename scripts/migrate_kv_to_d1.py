"""Build a one-time D1 import from private KV export files; never prints record contents.
Usage: python3 scripts/migrate_kv_to_d1.py BASE PATCHES SALES OUTPUT.sql
Export the three KV keys with wrangler kv key get --remote first.
Existing D1 IDs are left untouched, making retry safe after cutover.
"""
import json, sys, os
from datetime import datetime, timezone
base_path, patch_path, sales_path, output = sys.argv[1:]
with open(base_path) as f: base = json.load(f) or []
with open(patch_path) as f: patches = json.load(f) or {}
with open(sales_path) as f: sales = json.load(f) or []
rows = {}
for record in [*patches.get('added', []), *base]:
    key = record.get('placeId') or record.get('name')
    if not key: raise ValueError('Restaurant without identity')
    if key in rows: continue
    rows[key] = {**record, **patches.get('updated', {}).get(key, {})}
quote = lambda value: "'" + value.replace("'", "''") + "'"
with open(output, 'w') as f:
    os.chmod(output, 0o600)
    for key, record in rows.items():
        f.write('INSERT OR IGNORE INTO restaurants(id,data) VALUES(%s,%s);\n' % (quote(key), quote(json.dumps(record, ensure_ascii=False))))
    for record in sales:
        f.write('INSERT OR IGNORE INTO sales(id,data) VALUES(%s,%s);\n' % (quote(record['id']), quote(json.dumps(record, ensure_ascii=False))))
    f.write("INSERT OR IGNORE INTO metadata(key,value) VALUES('last_updated',%s);\n" % quote(datetime.now(timezone.utc).isoformat()))
    f.write('ANALYZE;\n')
print(json.dumps({'source_restaurants': len(base)+len(patches.get('added', [])), 'unique_restaurants':len(rows),'sales':len(sales),'patches':len(patches.get('updated', {}))}))
