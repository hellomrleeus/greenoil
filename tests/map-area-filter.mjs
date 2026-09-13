import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MapExplorer as map, GTA_COMMUNITIES } from '../assets/js/map-explorer.js';
import { Api } from '../assets/js/api.js';

const polygon = { type: 'Polygon', coordinates: [
  [[0,0],[4,0],[4,1],[1,1],[1,4],[0,4],[0,0]],
  [[0.2,0.2],[0.8,0.2],[0.8,0.8],[0.2,0.8],[0.2,0.2]]
] };
const point = (lng, lat) => ({ longitude: lng, latitude: lat });
assert(map.isPlaceInGeometry(point(0.5, 2), polygon));
assert(!map.isPlaceInGeometry(point(2, 2), polygon), 'Inside bbox but outside polygon');
assert(!map.isPlaceInGeometry(point(0.5, 0.5), polygon), 'Exclude polygon holes');
assert(map.isPlaceInGeometry(point(1, 2), polygon), 'Include boundary edges');
assert(map.isPlaceInGeometry(point(0, 0), polygon), 'Include vertices and zero coordinates');
for (const value of [undefined, null, '', ' ', 'NaN', Infinity, '43oops']) {
  assert(!map.isPlaceInGeometry(point(value, 2), polygon), `Reject invalid coordinate ${value}`);
}
assert(map.isPlaceInGeometry({lat: '2', lng: '0.5'}, polygon));
const second = {type: 'Polygon', coordinates: [[[10,10],[12,10],[12,12],[10,12],[10,10]]]};
assert(map.isPlaceInGeometry(point(11,11), {type:'MultiPolygon', coordinates:[polygon.coordinates,second.coordinates]}));

let fixtures = [];
Api.getMapRestaurants = async () => ({success:true,data:fixtures.map(r=>({...r})),page:1,total:fixtures.length,totalPages:1});
map.getQueryBounds = () => [-180,-90,180,90];

// Exercise discovery + saved-place merging and the shared map/card result list.
globalThis.document = { getElementById: () => null };
map.getCurrentLanguage = () => 'en';
map.drawSelectedBoundaries = map.updateSelectionUI = map.updateResultsSummary = () => {};
let markerIds, cardIds;
map.renderMarkers = () => { markerIds = map.filteredPlaces.map(p => p.placeId); };
map.renderPlacesCards = () => { cardIds = map.filteredPlaces.map(p => p.placeId); };
map.neighbourhoodsGeoJson = {features:[{id:'one',name:'One',geometry:polygon}, {id:'two',name:'Two',geometry:second}]};
map.activeCityIds = new Set(['markham']);
map.activeNeighborhoodIds = new Set(['one']);
map.activeCategory = '全部'; map.activeVisited = 'all'; map.activeOutcome = 'all'; map.searchKeyword = '';
const place = (placeId, lng, lat) => ({placeId, name:placeId, address:'Ward 7 Markham', ...point(lng,lat)});
fixtures = [place('saved-inside',0.5,2),place('saved-outside',2,2),place('missing',null,null)];
Api.searchGooglePlaces = async () => ({success:true,places:[place('google-inside',0.5,3),place('google-outside',2,2),place('second',11,11)]});
await map.loadPlacesForCurrentArea();
assert.deepEqual(markerIds, ['google-inside','saved-inside']);
assert.deepEqual(cardIds, markerIds);
map.selectedMap.set('google-outside', place('google-outside',2,2));
map.activeNeighborhoodIds.add('two');
map.filterAndRenderPlaces();
assert.deepEqual(markerIds, ['google-inside','second','saved-inside']);
assert(!map.selectedMap.has('google-outside'));
map.activeNeighborhoodIds.clear();
map.activeCityIds = new Set(['all']);
await map.loadPlacesForCurrentArea();
assert.equal(map.filteredPlaces.length, 6, 'All GTA does not impose a subarea filter');

// Regression against the actual Ward 7 boundary: its bbox includes outside land.
const ward = JSON.parse(fs.readFileSync('assets/data/official_subareas.json')).features.find(f => f.id === 'markham_ward_7');
const [west,south,east,north] = ward.bbox;
let inside = 0, outside = 0;
for (let x = 1; x < 20; x++) for (let y = 1; y < 20; y++) {
  const p = point(west+(east-west)*x/20, south+(north-south)*y/20);
  if (map.isPlaceInGeometry(p, ward.geometry)) inside++; else outside++;
}
assert(inside > 0 && outside > 0, 'Ward 7 excludes points inside its bounding rectangle');
console.log('PASS: exact polygons, holes, multipolygons, coordinates, Google/KV merge, multi-selection, shared map/list filtering, Ward 7 regression');

// City selection uses municipal geometry for both data sources, never address text.
const municipalities = JSON.parse(fs.readFileSync('assets/data/official_municipalities.json'));
for (const feature of municipalities.features) {
  Object.assign(GTA_COMMUNITIES.find(city => city.id === feature.id), {geometry: feature.geometry});
}
map.activeNeighborhoodIds.clear();
map.activeCityIds = new Set(['markham']);
const markham = place('markham', -79.31, 43.86);
markham.address = 'No city label';
const aurora = place('aurora', -79.466, 44.006);
const scarborough = place('scarborough', -79.25, 43.77);
const richmondHill = place('richmond-hill', -79.438, 43.884);
fixtures = [markham, aurora];
Api.searchGooglePlaces = async () => ({success:true,places:[scarborough,richmondHill]});
await map.loadPlacesForCurrentArea();
assert.deepEqual(markerIds, ['markham'], 'Keep city-inside point without text; reject outside points with matching text');
assert.deepEqual(cardIds, markerIds);
map.activeCityIds.add('richmond_hill');
map.filterAndRenderPlaces();
assert.deepEqual(markerIds, ['richmond-hill','markham'], 'Multiple cities form a union');
map.activeNeighborhoodIds.add('one');
map.filterAndRenderPlaces();
assert.deepEqual(markerIds, [], 'Subarea still takes precedence over cities');
console.log('PASS: municipal boundaries, misleading addresses, city union and subarea precedence');
