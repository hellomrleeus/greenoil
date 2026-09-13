import assert from 'node:assert/strict';
import { MapExplorer as map } from '../assets/js/map-explorer.js';
const tasks = new Map();
let id = 0;
globalThis.setTimeout = callback => { tasks.set(++id, callback); return id; };
globalThis.clearTimeout = key => tasks.delete(key);
const flush = () => { const [key, fn] = tasks.entries().next().value; tasks.delete(key); fn(); };
globalThis.window = { google: { maps: {} } };
globalThis.google = { maps: { Marker: class {
  constructor(options) { this.options = options; }
  addListener() {}
  setMap(value) { this.options.map = value; }
} } };
map.googleMap = {};
map.getPinIcon = () => ({});
map.currentPage = 1;
map.pageSize = 10;
map.filteredPlaces = Array.from({length:85}, (_,i)=>({placeId:String(i),latitude:43.8,longitude:-79.3,inKV:true}));
map.renderMarkers();
assert(map.markersMap.size > 0 && map.markersMap.size <= 20, 'First batch paints without waiting for all markers');
assert(tasks.size === 1);
while(tasks.size) flush();
assert.equal(map.markersMap.size,85);
map.renderMarkers();
const oldBatch = [...tasks.values()][0];
map.filteredPlaces = [{placeId:'new',latitude:43.8,longitude:-79.3,inKV:true}];
map.renderMarkers();
oldBatch();
assert.deepEqual([...map.markersMap.keys()],['new'], 'Cancelled batches cannot add stale markers');
map.filteredPlaces = Array.from({length:85}, (_,i)=>({placeId:String(i),latitude:43.8,longitude:-79.3,inKV:true}));
map.renderMarkers();
map.clearMarkers();
assert.equal(tasks.size,0);
assert.equal(map.markersMap.size,0);
console.log('PASS: progressive markers, eventual completion, stale batch cancellation and cleanup');
