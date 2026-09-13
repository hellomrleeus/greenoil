#!/usr/bin/env python3
"""Build official city subareas; distinguish neighbourhoods from electoral wards."""
import json, re
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlencode
from build_gta_neighbourhoods import simplify_polygon, compute_polygon_centroid_and_bbox, bboxes_intersect
SOURCES = {
 'richmond_hill': ('Richmond Hill','列治文山','리치몬드 힐','ward','WARD','https://services5.arcgis.com/cu2HFDk7AqvG7e31/arcgis/rest/services/Ward_Boundary_read/FeatureServer/0'),
 'markham': ('Markham','万锦','마컴','ward','WARD','https://services3.arcgis.com/OWiFbQmr7Eu5DHn1/arcgis/rest/services/OD_WARDS/FeatureServer/0'),
 'vaughan': ('Vaughan','旺市','본','ward','WARD_NO','https://services2.arcgis.com/9LnN9037wYhPG904/arcgis/rest/services/Wards/FeatureServer/0'),
 'mississauga': ('Mississauga','密西沙加','미시사가','neighbourhood','CENTROID_4','https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/2016_Census_Data_By_Neighbourhoods_Shape_File/FeatureServer/0')
}

def build(raw):
 features=[]
 for city, data in raw.items():
  en,zh,ko,kind,field,url=SOURCES[city]
  assert data.get('features'), city
  for f in data['features']:
   props=f['properties']; name=str(props[field]).strip()
   if kind=='ward':
    number=re.search(r'\d+',name).group();name='Ward '+number;namezh='第 '+number+' 行政选区';nameko=number+'번 선거구'
   else: namezh=nameko=name
   geom=f['geometry']; polys=geom['coordinates'] if geom['type']=='MultiPolygon' else [geom['coordinates']]
   polys=[simplify_polygon(poly) for poly in polys]; center,bbox=compute_polygon_centroid_and_bbox([r for poly in polys for r in poly])
   fid=city+'_'+re.sub(r'[^a-z0-9]+','_',name.lower()).strip('_')
   features.append({'id':fid,'name':name,'nameEn':name,'nameZh':namezh,'nameKo':nameko,'cityId':city,'cityName':en,'cityNameZh':zh,'cityNameKo':ko,'boundaryType':kind,'source':url,'center':{'lat':center[0],'lng':center[1]},'bbox':bbox,'geometry':{'type':'MultiPolygon','coordinates':polys},'neighbors':[]})
 assert len({f['id'] for f in features})==len(features),'Duplicate subarea IDs'
 for f in features:
  f['neighbors']=[g['id'] for g in features if g['id']!=f['id'] and g['cityId']==f['cityId'] and bboxes_intersect(f['bbox'],g['bbox'])][:6]
 out=Path(__file__).resolve().parents[1]/'assets/data/official_subareas.json'
 out.write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')))
 print('Built',len(features),'official subareas')
if __name__=='__main__':
 raw={}
 for city,(_,_,_,_,field,url) in SOURCES.items():
  query=urlencode({'where':'1=1','outFields':field,'outSR':4326,'f':'geojson','geometryPrecision':6})
  with urlopen(url+'/query?'+query,timeout=60) as response:raw[city]=json.load(response)
 build(raw)
