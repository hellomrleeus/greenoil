import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MapExplorer, GTA_COMMUNITIES } from '../assets/js/map-explorer.js';

console.log('Testing Scarborough & Filter State Persistence...');

// 1. Verify Scarborough community configuration
const scarborough = GTA_COMMUNITIES.find(c => c.id === 'scarborough');
assert(scarborough, 'Scarborough must exist in GTA_COMMUNITIES');
assert.equal(scarborough.nameZh, '士嘉堡');
assert.equal(scarborough.nameEn, 'Scarborough');
assert(scarborough.bbox && scarborough.bbox.length === 4, 'Scarborough must have bbox');

// 2. Verify official_municipalities includes Scarborough geometry
const municipalities = JSON.parse(fs.readFileSync('assets/data/official_municipalities.json', 'utf8'));
const scarbFeature = municipalities.features.find(f => f.id === 'scarborough');
assert(scarbFeature, 'Scarborough must exist in official_municipalities.json');
assert(scarbFeature.geometry && scarbFeature.geometry.coordinates, 'Scarborough must have valid polygon geometry');

Object.assign(scarborough, { geometry: scarbFeature.geometry, bbox: scarbFeature.bbox });

// 3. Verify spatial containment
const placeInScarb = { lat: 43.77, lng: -79.25 }; // Scarborough Center
const placeInMidland = { lat: 43.8185, lng: -79.2885 }; // Midland & Finch
const placeInMarkham = { lat: 43.86, lng: -79.31 }; // Markham
const placeInVaughan = { lat: 43.83, lng: -79.52 }; // Vaughan

assert(MapExplorer.isPlaceInGeometry(placeInScarb, scarborough.geometry), 'Scarborough center must be inside Scarborough geometry');
assert(MapExplorer.isPlaceInGeometry(placeInMidland, scarborough.geometry), 'Midland & Finch must be inside Scarborough geometry');
assert(!MapExplorer.isPlaceInGeometry(placeInMarkham, scarborough.geometry), 'Markham must be outside Scarborough geometry');
assert(!MapExplorer.isPlaceInGeometry(placeInVaughan, scarborough.geometry), 'Vaughan must be outside Scarborough geometry');

console.log('PASS: Scarborough geometry and spatial containment verified.');

// 4. Verify localStorage persistence for map search filters
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear()
};

// Set specific filter criteria
MapExplorer.activeCityIds = new Set(['scarborough']);
MapExplorer.activeNeighborhoodIds = new Set(['to_128']);
MapExplorer.activeCategory = '韩式炸鸡';
MapExplorer.activeVisited = 'unvisited';
MapExplorer.activeOutcome = 'interested';
MapExplorer.searchKeyword = 'chicken';

// Save to storage
MapExplorer.saveFilterState();

const savedRaw = localStorage.getItem('greenoil_map_filter_state');
assert(savedRaw, 'Filter state must be saved to localStorage');
const parsed = JSON.parse(savedRaw);
assert.deepEqual(parsed.activeCityIds, ['scarborough']);
assert.deepEqual(parsed.activeNeighborhoodIds, ['to_128']);
assert.equal(parsed.activeCategory, '韩式炸鸡');
assert.equal(parsed.activeVisited, 'unvisited');
assert.equal(parsed.activeOutcome, 'interested');
assert.equal(parsed.searchKeyword, 'chicken');

// Reset in memory to defaults, then restore from storage
MapExplorer.activeCityIds = new Set(['vaughan']);
MapExplorer.activeNeighborhoodIds = new Set();
MapExplorer.activeCategory = '全部';
MapExplorer.activeVisited = 'all';
MapExplorer.activeOutcome = 'all';
MapExplorer.searchKeyword = '';

const restored = MapExplorer.restoreFilterState();
assert(restored, 'restoreFilterState must return true');
assert.equal(MapExplorer.activeCityIds.has('scarborough'), true);
assert.equal(MapExplorer.activeCityIds.has('vaughan'), false);
assert.equal(MapExplorer.activeNeighborhoodIds.has('to_128'), true);
assert.equal(MapExplorer.activeCategory, '韩式炸鸡');
assert.equal(MapExplorer.activeVisited, 'unvisited');
assert.equal(MapExplorer.activeOutcome, 'interested');
assert.equal(MapExplorer.searchKeyword, 'chicken');

console.log('PASS: Filter state save & restore via localStorage verified.');

// 5. Verify DOM control synchronization from state
const mockElements = {
  mapCategorySelect: { value: '' },
  mapVisitedSelect: { value: '' },
  mapOutcomeSelect: { value: '' },
  mapKeywordInput: { value: '' }
};

globalThis.document = {
  getElementById: (id) => mockElements[id] || null,
  querySelector: () => null,
  querySelectorAll: () => []
};

MapExplorer.syncFilterControlsFromState();
assert.equal(mockElements.mapCategorySelect.value, '韩式炸鸡');
assert.equal(mockElements.mapVisitedSelect.value, 'unvisited');
assert.equal(mockElements.mapOutcomeSelect.value, 'interested');
assert.equal(mockElements.mapKeywordInput.value, 'chicken');

console.log('PASS: DOM controls synchronization from restored state verified.');
console.log('ALL SCARBOROUGH & PERSISTENCE TESTS PASSED!');
