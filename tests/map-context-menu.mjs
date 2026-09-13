import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MapExplorer as map } from '../assets/js/map-explorer.js';

globalThis.document = { getElementById: () => null };

const data = JSON.parse(fs.readFileSync(new URL('../assets/data/official_subareas.json', import.meta.url)));
map.neighbourhoodsGeoJson = data;
map.neighbourhoodsMap = new Map(data.features.map(feature => [feature.id, feature]));
map.getCurrentLanguage = () => 'zh';
assert.deepEqual(map.activeCityIds, new Set(['vaughan']), 'Map explorer defaults to Vaughan as the loaded area');
assert.deepEqual(map.getMapEventCoordinate({ lat: () => 43.66, lng: () => -79.39 }), { lat: 43.66, lng: -79.39 });
assert.deepEqual(map.getMapEventCoordinate({ lat: 43.66, lng: -79.39 }), { lat: 43.66, lng: -79.39 });
assert.equal(map.getMapEventCoordinate({ lat: 'invalid', lng: -79.39 }), null);

const ward = id => data.features.find(feature => feature.id === id);
const nearbyWard = ward('vaughan_ward_2');
const selectedWard = ward('vaughan_ward_3');
const globalWard = ward('markham_ward_4');

map.activeCityIds = new Set(['vaughan']);
map.activeNeighborhoodIds = new Set([selectedWard.id]);

assert.equal(map.isCoordinateInsideSelectedArea(selectedWard.center.lat, selectedWard.center.lng), true);

const nearbyMatch = map.findWardAtCoordinate(nearbyWard.center.lat, nearbyWard.center.lng);
assert.equal(nearbyMatch?.ward.id, nearbyWard.id);
assert.equal(nearbyMatch?.source, 'nearby', 'Adjacent recommended wards are checked first');

const globalMatch = map.findWardAtCoordinate(globalWard.center.lat, globalWard.center.lng);
assert.equal(globalMatch?.ward.id, globalWard.id);
assert.equal(globalMatch?.source, 'global', 'The complete ward set is used as a fallback');

assert.equal(map.findWardAtCoordinate(43.5, -80.5), null, 'Points outside all official wards remain unassigned');

// Toronto has neighbourhood boundaries in the current dataset but no WARD
// polygons. The context menu should still be able to add the matching area.
const torontoNeighbourhoods = JSON.parse(fs.readFileSync(new URL('../assets/data/gta_neighbourhoods.json', import.meta.url)));
map.neighbourhoodsGeoJson = {
  type: 'FeatureCollection',
  features: [...torontoNeighbourhoods.features, ...data.features]
};
map.neighbourhoodsMap = new Map(map.neighbourhoodsGeoJson.features.map(feature => [feature.id, feature]));
map.activeCityIds = new Set(['toronto']);
map.activeNeighborhoodIds = new Set(['to_169']);
const westQueen = map.findAdministrativeAreaAtCoordinate(43.66215, -79.39633);
assert.equal(westQueen?.area.id, 'to_079');
assert.equal(westQueen?.kind, 'neighborhood', 'Neighbourhood boundaries are used where Toronto has no WARD polygon');
assert.equal(westQueen?.source, 'nearby');
console.log('PASS: context-menu ward lookup prioritizes nearby recommendations and falls back globally');
