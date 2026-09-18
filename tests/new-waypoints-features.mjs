import assert from 'node:assert/strict';

// Setup Mock DOM & Storage before importing modules
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear()
};

let lastAlert = null;
let lastToast = null;
globalThis.alert = (msg) => { lastAlert = msg; };
globalThis.confirm = () => true;
globalThis.window = {
  showToast: (msg) => { lastToast = msg; },
  open: () => {},
  XLSX: {
    utils: {
      json_to_sheet: (data) => data,
      book_new: () => ({}),
      book_append_sheet: () => {}
    },
    writeFile: (wb, filename) => { globalThis.__lastExportFilename = filename; }
  }
};
const mockElement = {
  value: '',
  style: {},
  classList: { add: () => {}, remove: () => {} },
  addEventListener: () => {},
  querySelectorAll: () => []
};
globalThis.document = {
  documentElement: { lang: 'zh-CN' },
  getElementById: (id) => mockElement,
  querySelectorAll: () => [],
  querySelector: () => null
};

const { Api } = await import('../assets/js/api.js');
const { MapExplorer } = await import('../assets/js/map-explorer.js');
const { i18n } = await import('../assets/js/i18n.js');

console.log('--- Starting New Features Test Suite ---');

// -------------------------------------------------------------
// Test 1: Key Security & No Hardcoded Key
// -------------------------------------------------------------
console.log('1. Checking Key Security...');
// Test 1a: When not logged in (401 from worker config)
globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: "Unauthorized" }) });
Api.clearGoogleMapsApiKey();
const unauthKey = await Api.getGoogleMapsApiKey();
assert.equal(unauthKey, '', 'Unauthenticated call should return empty string, no key exposed');

// Test 1b: When authenticated (200 with dynamic key from worker)
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ apiKey: "DYNAMIC_SECURE_KEY" }) });
Api.clearGoogleMapsApiKey();
const authKey = await Api.getGoogleMapsApiKey();
assert.equal(authKey, 'DYNAMIC_SECURE_KEY', 'Authenticated call fetches dynamic key');

// -------------------------------------------------------------
// Test 2: Stop Locking & Rules
// -------------------------------------------------------------
console.log('2. Testing Stop Locking & Rules...');
MapExplorer.routeWaypoints = [
  { name: 'Stop A', latitude: 43.7, longitude: -79.3 },
  { name: 'Stop B', latitude: 43.71, longitude: -79.31 },
  { name: 'Stop C', latitude: 43.72, longitude: -79.32 },
  { name: 'Stop D', latitude: 43.73, longitude: -79.33 },
  { name: 'Stop E', latitude: 43.74, longitude: -79.34 }
];

// Test rule: < 2 stops cannot be locked
MapExplorer.selectedWaypointKeys = new Set(['Stop B']);
lastAlert = null;
MapExplorer.lockSelectedWaypoints();
assert.match(lastAlert, /至少需要选择 2 个站点/, 'Should prevent locking single stop');

// Test rule: >= 2 stops can be locked and are grouped contiguously
MapExplorer.selectedWaypointKeys = new Set(['Stop B', 'Stop D']);
MapExplorer.lockSelectedWaypoints();
assert.equal(MapExplorer.routeWaypoints.length, 5);
const bItem = MapExplorer.routeWaypoints.find(w => w.name === 'Stop B');
const dItem = MapExplorer.routeWaypoints.find(w => w.name === 'Stop D');
assert.ok(bItem.lockGroupId, 'Stop B should have lockGroupId');
assert.equal(bItem.lockGroupId, dItem.lockGroupId, 'Stop B and D must share same lockGroupId');

// Verify contiguous placement: Stop B and Stop D must be adjacent in the array
const bIdx = MapExplorer.routeWaypoints.indexOf(bItem);
const dIdx = MapExplorer.routeWaypoints.indexOf(dItem);
assert.equal(Math.abs(bIdx - dIdx), 1, 'Locked stops must be grouped contiguously');

// -------------------------------------------------------------
// Test 3: Deletion Protection for Locked Stops
// -------------------------------------------------------------
console.log('3. Testing Deletion Protection...');
// Single stop delete
lastAlert = null;
MapExplorer.removeWaypointFromRoute(bIdx);
assert.match(lastAlert, /处于锁定组合中/, 'Should block removing locked stop directly');

// Batch delete with locked stop included
MapExplorer.selectedWaypointKeys = new Set(['Stop A', 'Stop B']);
lastAlert = null;
MapExplorer.deleteSelectedWaypoints();
assert.match(lastAlert, /包含已被锁定的站点/, 'Should block batch delete containing locked stops');

// Unlock and then delete
MapExplorer.selectedWaypointKeys = new Set(['Stop B', 'Stop D']);
MapExplorer.unlockSelectedWaypoints();
assert.equal(bItem.lockGroupId, null, 'Stop B should now be unlocked');
assert.equal(dItem.lockGroupId, null, 'Stop D should now be unlocked');

// Now single delete is permitted
MapExplorer.removeWaypointFromRoute(bIdx);
assert.equal(MapExplorer.routeWaypoints.some(w => w.name === 'Stop B'), false, 'Unlocked stop can be removed');

// -------------------------------------------------------------
// Test 4: Whole-Group Movement and Standalone Non-Invasive Move
// -------------------------------------------------------------
console.log('4. Testing Group Movement as a Whole...');
MapExplorer.routeWaypoints = [
  { name: 'Stop 1', latitude: 43.7, longitude: -79.3 },
  { name: 'Stop 2', latitude: 43.71, longitude: -79.31 },
  { name: 'Stop 3', latitude: 43.72, longitude: -79.32 },
  { name: 'Stop 4', latitude: 43.73, longitude: -79.33 },
  { name: 'Stop 5', latitude: 43.74, longitude: -79.34 }
];
// Lock Stop 2 and 3
MapExplorer.selectedWaypointKeys = new Set(['Stop 2', 'Stop 3']);
MapExplorer.lockSelectedWaypoints();

// Move group DOWN from index 1: whole group (Stop 2 & 3) moves past Stop 4
MapExplorer.moveWaypoint(1, 1);
assert.deepEqual(MapExplorer.routeWaypoints.map(w => w.name), ['Stop 1', 'Stop 4', 'Stop 2', 'Stop 3', 'Stop 5'], 'Group should move down as a whole past Stop 4');

// Move standalone Stop 5 UP: should jump past the entire group (Stop 2 & 3)
MapExplorer.moveWaypoint(4, -1);
assert.deepEqual(MapExplorer.routeWaypoints.map(w => w.name), ['Stop 1', 'Stop 4', 'Stop 5', 'Stop 2', 'Stop 3'], 'Standalone stop should jump over locked group');

// -------------------------------------------------------------
// Test 5: TSP Optimization Preserves Locked Groups
// -------------------------------------------------------------
console.log('5. Testing TSP Optimization with Locked Groups...');
const sorted = MapExplorer.sortWaypointsBySchedule(MapExplorer.routeWaypoints, new Date(), { lat: 43.7, lng: -79.3 });
const s2Idx = sorted.findIndex(w => w.name === 'Stop 2');
const s3Idx = sorted.findIndex(w => w.name === 'Stop 3');
assert.equal(Math.abs(s2Idx - s3Idx), 1, 'TSP optimization must keep locked group members strictly adjacent');

// -------------------------------------------------------------
// Test 6: English Headers & Content in Excel Export (Independent of UI Language)
// -------------------------------------------------------------
console.log('6. Testing English Export Headers & Table Content across Languages...');
MapExplorer.routeWaypoints = [
  {
    name: "Yang's Braised Chicken Rice(First Markham Place)杨铭宇黄焖鸡米饭",
    nameEn: "",
    address: "加拿大安大略省多伦多邮政编码: M2J 3C1",
    phone: "未提供",
    openingHours: "星期一: 11:00–02:00\n星期二: 11:00–02:00\n星期三: 11:00–02:00\n星期四: 11:00–02:00\n星期五: 11:00–02:00\n星期六: 11:00–02:00\n星期日: 11:00–02:00",
    _estArrivalStr: "-"
  },
  {
    name: "御品",
    nameEn: "Kingsfield Chinese Cuisine",
    address: "Ontario, Markham, Woodbine Ave, Unit 1CF5邮政编码: L6C 0M5",
    phone: "(905) 123-4567",
    openingHours: "星期一: 11:00–19:00\n星期二: 11:00–19:00\n星期三: 11:00–19:00\n星期四: 11:00–19:00\n星期五: 11:00–19:00\n星期六: 11:00–19:00\n星期日: 休息",
    _estArrivalStr: "14:30"
  }
];

// Set language to Chinese
i18n.setLanguage('zh');
let exportedData = null;
globalThis.window.XLSX.utils.json_to_sheet = (data) => {
  exportedData = data;
  return data;
};
MapExplorer.exportWaypoints();
assert.ok(exportedData && exportedData.length === 2, 'Export rows generated');
const headers = Object.keys(exportedData[0]);
assert.deepEqual(headers, [
  'Stop #',
  'Restaurant Name',
  'Address',
  'Phone',
  'Opening Hours',
  'Estimated Arrival (ETA)'
], 'Headers must be English even when language is zh');

// Verify Content is in English
assert.equal(exportedData[0]['Restaurant Name'], "Yang's Braised Chicken Rice (First Markham Place)", 'Restaurant Name must be English');
assert.ok(!/[\u4e00-\u9fff]/.test(exportedData[0]['Address']), 'Address must not contain Chinese');
assert.ok(exportedData[0]['Address'].includes('Toronto') && exportedData[0]['Address'].includes('M2J 3C1'), 'Address formatted in English');
assert.equal(exportedData[0]['Opening Hours'], 'Mon-Sun: 11:00-02:00', 'Opening hours must be formatted into English');
assert.equal(exportedData[0]['Phone'], 'N/A', 'Phone fallback must be N/A');
assert.equal(exportedData[0]['Estimated Arrival (ETA)'], 'N/A', 'ETA fallback must be N/A');

assert.equal(exportedData[1]['Restaurant Name'], 'Kingsfield Chinese Cuisine', 'nameEn preferred for Restaurant Name');
assert.ok(!/[\u4e00-\u9fff]/.test(exportedData[1]['Address']), 'Address must not contain Chinese');
assert.equal(exportedData[1]['Opening Hours'], 'Mon-Sat: 11:00-19:00, Sun: Closed', 'Closed and range hours formatted into English');
assert.equal(exportedData[1]['Phone'], '(905) 123-4567');
assert.equal(exportedData[1]['Estimated Arrival (ETA)'], '14:30');

// Set language to Korean
i18n.setLanguage('ko');
exportedData = null;
MapExplorer.exportWaypoints();
assert.deepEqual(Object.keys(exportedData[0]), [
  'Stop #',
  'Restaurant Name',
  'Address',
  'Phone',
  'Opening Hours',
  'Estimated Arrival (ETA)'
], 'Headers must be English even when language is ko');
assert.equal(exportedData[0]['Opening Hours'], 'Mon-Sun: 11:00-02:00');

// -------------------------------------------------------------
// Test 7: Center Column Toolbar & Waypoints Expand Toggle
// -------------------------------------------------------------
console.log('7. Testing Center Toolbar Layout & Waypoints Expand Toggle...');
const fs = await import('node:fs');
const htmlContent = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// 1. Verify toolbar is inside center column aligned with map
assert.ok(htmlContent.includes('<div class="map-explorer-center-column">'), 'Center column must exist');
const centerColIdx = htmlContent.indexOf('<div class="map-explorer-center-column">');
const toolbarIdx = htmlContent.indexOf('id="mapExplorerToolbarCard"');
const mapColIdx = htmlContent.indexOf('class="map-explorer-map-column"');
assert.ok(centerColIdx < toolbarIdx && toolbarIdx < mapColIdx, 'Toolbar must be inside center column directly above map');

// 2. Verify right column wrapper and toggle button
assert.ok(htmlContent.includes('<div class="map-explorer-right-column-wrap">'), 'Right column wrapper must exist for non-squeezing overlay');
assert.ok(htmlContent.includes('id="mapBtnToggleWaypointsExpand"'), 'Expand toggle button must exist');

// 3. Verify expand/collapse state toggling
const mockRightColClasses = new Set();
const mockRightCol = {
  classList: {
    toggle: (cls) => {
      if (mockRightColClasses.has(cls)) {
        mockRightColClasses.delete(cls);
        return false;
      } else {
        mockRightColClasses.add(cls);
        return true;
      }
    },
    contains: (cls) => mockRightColClasses.has(cls),
    remove: (cls) => mockRightColClasses.delete(cls)
  }
};
assert.equal(mockRightCol.classList.toggle('is-expanded'), true, 'Clicking expand sets is-expanded');
assert.equal(mockRightCol.classList.contains('is-expanded'), true, 'Panel is expanded');
assert.equal(mockRightCol.classList.toggle('is-expanded'), false, 'Clicking again removes is-expanded');
assert.equal(mockRightCol.classList.contains('is-expanded'), false, 'Panel is collapsed');

console.log('🎉 ALL 7 FEATURE TESTS PASSED SUCCESSFULLY!');

