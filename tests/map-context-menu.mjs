import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MapExplorer as map } from '../assets/js/map-explorer.js';

globalThis.document = { getElementById: () => null };

const data = JSON.parse(fs.readFileSync(new URL('../assets/data/official_subareas.json', import.meta.url)));
map.neighbourhoodsGeoJson = data;
map.neighbourhoodsMap = new Map(data.features.map(feature => [feature.id, feature]));
map.getCurrentLanguage = () => 'zh';

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
console.log('PASS: context-menu ward lookup prioritizes nearby recommendations and falls back globally');
