#!/usr/bin/env python3
"""Export Statistics Canada 2021 CSD boundaries via Esri Canada's public mirror."""
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

SOURCE = 'https://services.arcgis.com/wjcPoefzjpzCgffS/arcgis/rest/services/CensusSubdivision/FeatureServer/0'
CITIES = {'Toronto': 'toronto', 'Markham': 'markham', 'Richmond Hill': 'richmond_hill', 'Mississauga': 'mississauga', 'Vaughan': 'vaughan'}

def build(data):
    assert len(data['features']) == len(CITIES), 'Incomplete municipal boundaries'
    for feature in data['features']:
        feature['id'] = CITIES[feature['properties']['CSDNAME']]
        rings = feature['geometry']['coordinates']
        if feature['geometry']['type'] == 'MultiPolygon':
            rings = [ring for polygon in rings for ring in polygon]
        points = [point for ring in rings for point in ring]
        feature['bbox'] = [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]
    data['source'] = {'publisher': 'Statistics Canada', 'vintage': '2021 Census subdivisions', 'mirror': SOURCE, 'reference': 'https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm'}
    output = Path(__file__).resolve().parents[1] / 'assets/data/official_municipalities.json'
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))

if __name__ == '__main__':
    query = urlencode({'where': "PRUID='35' AND CSDNAME IN ('Toronto','Markham','Richmond Hill','Mississauga','Vaughan')", 'outFields': 'CSDUID,CSDNAME', 'outSR': 4326, 'f': 'geojson', 'geometryPrecision': 6})
    with urlopen(SOURCE + '/query?' + query, timeout=60) as response:
        build(json.load(response))
