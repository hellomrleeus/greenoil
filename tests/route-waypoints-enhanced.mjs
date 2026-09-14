import assert from 'node:assert/strict';
import { FieldSales } from '../assets/js/field-sales.js';
import { MapExplorer } from '../assets/js/map-explorer.js';
import { i18n } from '../assets/js/i18n.js';

console.log('Testing Route Waypoints Enhanced Features...');

// Setup Mock DOM & Storage
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear()
};

globalThis.window = {
  open: () => {},
  showToast: () => {},
  XLSX: null
};

globalThis.confirm = () => true;
globalThis.alert = () => {};

// -------------------------------------------------------------
// 1. Test Canonical Name Resolution & Consistency
// -------------------------------------------------------------
console.log('1. Testing Canonical Name Resolution...');

FieldSales.cachedRestaurants = [
  {
    placeId: 'ChIJ_yupin_markham',
    name: '御品',
    address: '280 West Beaver Creek Rd, Richmond Hill, ON',
    phone: '(905) 888-8888',
    openingHours: 'Mon-Sun: 11:00 AM - 10:00 PM'
  }
];

// Restaurant added from Google Places search with English name
const googleSearchResult = {
  placeId: 'ChIJ_yupin_markham',
  name: 'Kingsfield Chinese Cuisine',
  address: '280 West Beaver Creek Rd, Richmond Hill, ON',
  phone: '(905) 888-8888',
  openingHours: 'Mon-Sun: 11:00 AM - 10:00 PM'
};

const normalized = FieldSales.normalizeRestaurantName(googleSearchResult);
assert.equal(normalized.name, '御品', 'Canonical Chinese name must be restored');
assert.equal(normalized.nameEn, 'Kingsfield Chinese Cuisine', 'English name must be preserved in nameEn');

// Test MapExplorer mergeAreaPlaces name resolution
MapExplorer.allRestaurants = [
  {
    placeId: 'ChIJ_yupin_markham',
    name: '御品',
    isVisited: true,
    lastOutcome: '有意向'
  }
];
MapExplorer.googleAreaPlaces = [
  {
    placeId: 'ChIJ_yupin_markham',
    name: 'Kingsfield Chinese Cuisine',
    address: '280 West Beaver Creek Rd'
  }
];

// Stub filterAndRenderPlaces for MapExplorer
MapExplorer.filterAndRenderPlaces = () => {};
MapExplorer.mergeAreaPlaces();

const mergedPlace = MapExplorer.displayedPlaces.find(p => p.placeId === 'ChIJ_yupin_markham');
assert(mergedPlace, 'Merged place must exist in MapExplorer.displayedPlaces');
assert.equal(mergedPlace.name, '御品', 'MapExplorer must retain Chinese name 御品');
assert.equal(mergedPlace.nameEn, 'Kingsfield Chinese Cuisine', 'MapExplorer must retain English name Kingsfield Chinese Cuisine');

console.log('PASS: Canonical name resolution verified.');

// -------------------------------------------------------------
// 2. Test Route Waypoints Search & Filtering
// -------------------------------------------------------------
console.log('2. Testing Waypoints Search & Filtering...');

FieldSales.routeWaypoints = [
  { _uid: 'wp_1', placeId: 'p1', name: '御品', nameEn: 'Kingsfield Chinese Cuisine', address: '280 West Beaver Creek Rd', phone: '905-111-1111' },
  { _uid: 'wp_2', placeId: 'p2', name: '全聚德', nameEn: 'QJD Roast Duck', address: '7095 Woodbine Ave', phone: '905-222-2222' },
  { _uid: 'wp_3', placeId: 'p3', name: '大槐树牛肉面', nameEn: 'Big Tree Noodle', address: '3250 Midland Ave', phone: '416-333-3333' }
];

// No filter
FieldSales.routeSearchQuery = '';
assert.equal(FieldSales.getFilteredWaypoints().length, 3, 'Empty query should return all waypoints');

// Filter by Chinese name
FieldSales.routeSearchQuery = '御品';
assert.equal(FieldSales.getFilteredWaypoints().length, 1);
assert.equal(FieldSales.getFilteredWaypoints()[0].name, '御品');

// Filter by English name
FieldSales.routeSearchQuery = 'kingsfield';
assert.equal(FieldSales.getFilteredWaypoints().length, 1);
assert.equal(FieldSales.getFilteredWaypoints()[0].name, '御品');

// Filter by address (e.g. Midland)
FieldSales.routeSearchQuery = 'midland';
assert.equal(FieldSales.getFilteredWaypoints().length, 1);
assert.equal(FieldSales.getFilteredWaypoints()[0].name, '大槐树牛肉面');

// Filter by phone
FieldSales.routeSearchQuery = '222-2222';
assert.equal(FieldSales.getFilteredWaypoints().length, 1);
assert.equal(FieldSales.getFilteredWaypoints()[0].name, '全聚德');

console.log('PASS: Waypoints search and filtering verified.');

// -------------------------------------------------------------
// 3. Test Multi-Select, Select All & Batch Delete
// -------------------------------------------------------------
console.log('3. Testing Multi-Select & Batch Delete...');

FieldSales.routeSearchQuery = '';
FieldSales.selectedWaypointIds = new Set(['wp_1', 'wp_3']);
assert.equal(FieldSales.selectedWaypointIds.size, 2);

// Batch delete
FieldSales.deleteSelectedWaypoints();
assert.equal(FieldSales.routeWaypoints.length, 1, 'Only unselected waypoint should remain');
assert.equal(FieldSales.routeWaypoints[0].name, '全聚德', 'Remaining waypoint should be 全聚德');
assert.equal(FieldSales.selectedWaypointIds.size, 0, 'Selection must be cleared after batch delete');

console.log('PASS: Multi-select and batch delete verified.');

// -------------------------------------------------------------
// 4. Test Excel Export Data Construction
// -------------------------------------------------------------
console.log('4. Testing Excel Export Data Construction...');

FieldSales.salesRecords = [
  {
    id: 's1',
    restaurantId: 'p1',
    restaurantName: '御品',
    visitTime: '2026-09-12 14:30',
    method: 'onsite',
    outcome: 'contract_signed',
    notes: '已签署月结回收合同'
  },
  {
    id: 's2',
    restaurantId: 'p1',
    restaurantName: '御品',
    visitTime: '2026-08-20 10:00',
    method: 'phone',
    outcome: 'interested',
    notes: '电话初访'
  }
];

const wpVisited = { placeId: 'p1', name: '御品', nameEn: 'Kingsfield Chinese Cuisine', address: '280 West Beaver Creek Rd', phone: '905-888-8888', openingHours: '11:00-22:00' };
const wpUnvisited = { placeId: 'p99', name: '新店', address: '100 Yonge St', phone: '416-000-0000', openingHours: '10:00-20:00' };

const visitedSummary = FieldSales.formatWaypointVisitRecords(wpVisited);
assert(visitedSummary.includes('已签署月结回收合同'), 'Visit records must include notes');
assert(visitedSummary.includes('现场拜访'), 'Visit records must include method');
assert(visitedSummary.includes('签订合同'), 'Visit records must include outcome');

const unvisitedSummary = FieldSales.formatWaypointVisitRecords(wpUnvisited);
assert.equal(unvisitedSummary, '未拜访', 'Unvisited waypoint should display 未拜访');

// Test weekday opening hours aggregation (Mon-Fri only, ignore Sat/Sun)
console.log('4.1. Testing Weekday Opening Hours Aggregation...');
const hoursAllSame = [
  'Monday: 11:00 AM – 10:00 PM',
  'Tuesday: 11:00 AM – 10:00 PM',
  'Wednesday: 11:00 AM – 10:00 PM',
  'Thursday: 11:00 AM – 10:00 PM',
  'Friday: 11:00 AM – 10:00 PM',
  'Saturday: 11:00 AM – 11:00 PM',
  'Sunday: 11:00 AM – 9:00 PM'
].join('\n');
assert.equal(
  FieldSales.formatWeekdayOpeningHours(hoursAllSame),
  '11:00 AM – 10:00 PM',
  'When Mon-Fri are identical, return clean operating hours ignoring weekend'
);

const hoursFriLate = [
  'Monday: 11:00 AM – 10:00 PM',
  'Tuesday: 11:00 AM – 10:00 PM',
  'Wednesday: 11:00 AM – 10:00 PM',
  'Thursday: 11:00 AM – 10:00 PM',
  'Friday: 11:00 AM – 11:00 PM',
  'Saturday: 11:00 AM – 11:00 PM',
  'Sunday: 11:00 AM – 10:00 PM'
].join('\n');
assert.equal(
  FieldSales.formatWeekdayOpeningHours(hoursFriLate),
  '11:00 AM – 10:00 PM (周五: 11:00 AM – 11:00 PM)',
  'Friday special hours should be annotated in parentheses'
);

const hoursMonClosed = [
  'Monday: Closed',
  'Tuesday: 11:00 AM – 10:00 PM',
  'Wednesday: 11:00 AM – 10:00 PM',
  'Thursday: 11:00 AM – 10:00 PM',
  'Friday: 11:00 AM – 10:00 PM',
  'Saturday: 11:00 AM – 11:00 PM',
  'Sunday: 11:00 AM – 10:00 PM'
].join('\n');
assert.equal(
  FieldSales.formatWeekdayOpeningHours(hoursMonClosed),
  '11:00 AM – 10:00 PM (周一休息)',
  'Monday closed should be annotated as 周一休息'
);

const hoursMultiClosedAndSpecial = [
  'Monday: 休息',
  'Tuesday: 休息',
  'Wednesday: 11:30 AM – 9:30 PM',
  'Thursday: 11:30 AM – 9:30 PM',
  'Friday: 11:30 AM – 10:30 PM'
].join('\n');
assert.equal(
  FieldSales.formatWeekdayOpeningHours(hoursMultiClosedAndSpecial),
  '11:30 AM – 9:30 PM (周一、周二休息, 周五: 11:30 AM – 10:30 PM)',
  'Multiple closed days and special hours should be grouped cleanly'
);

assert.equal(
  FieldSales.formatWeekdayOpeningHours('Mon-Sun: 11:00 AM - 10:00 PM'),
  '11:00 AM - 10:00 PM',
  'Single line Mon-Sun range prefix should be stripped'
);
assert.equal(
  FieldSales.formatWeekdayOpeningHours('周一至周五: 10:00 - 21:00'),
  '10:00 - 21:00',
  'Single line Mon-Fri range prefix should be stripped'
);
assert.equal(
  FieldSales.formatWeekdayOpeningHours('11:00 - 22:00'),
  '11:00 - 22:00',
  'Plain single line should be preserved'
);

// Test export row generation with aggregated hours
const wpMultiLineHours = {
  placeId: 'p3',
  name: '川味香',
  address: '500 Hwy 7',
  phone: '905-999-9999',
  openingHours: hoursFriLate
};
FieldSales.routeWaypoints = [wpVisited, wpUnvisited, wpMultiLineHours];
FieldSales.selectedWaypointIds = new Set(); // none selected -> export all

let exportedWb = null;
let exportedFileName = null;
globalThis.window.XLSX = {
  utils: {
    json_to_sheet: (rows) => ({ '!ref': 'A1:F4', _rows: rows }),
    book_new: () => ({ Sheets: {}, SheetNames: [] }),
    book_append_sheet: (wb, ws, name) => { wb.Sheets[name] = ws; wb.SheetNames.push(name); }
  },
  writeFile: (wb, fn) => { exportedWb = wb; exportedFileName = fn; }
};

FieldSales.exportWaypointsToExcel();
assert(exportedWb, 'XLSX.writeFile must be called');
assert(exportedFileName.startsWith('GreenOil_Route_Waypoints_'), 'File name must follow convention');
const exportedRows = exportedWb.Sheets['Waypoints']._rows;
assert.equal(exportedRows.length, 3, 'Exported rows count must match waypoints');
assert.equal(exportedRows[0]['序号'], 1);
assert.equal(exportedRows[0]['餐厅名称'], '御品 (Kingsfield Chinese Cuisine)');
assert.equal(exportedRows[0]['地址'], '280 West Beaver Creek Rd');
assert.equal(exportedRows[0]['电话'], '905-888-8888');
assert.equal(exportedRows[0]['营业时间'], '11:00-22:00');
assert(exportedRows[0]['拜访记录'].includes('已签署月结回收合同'));
assert.equal(exportedRows[2]['营业时间'], '11:00 AM – 10:00 PM (周五: 11:00 AM – 11:00 PM)');

console.log('PASS: Excel export data construction & weekday hours aggregation verified.');

// -------------------------------------------------------------
// 4.2. Verify Button Emojis Removed from Translations & UI
// -------------------------------------------------------------
console.log('4.2. Verifying Button Emojis Removed...');
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const checkedKeys = [
  'fs_route_btn_batch_nav',
  'fs_route_btn_batch_delete',
  'fs_route_btn_export_excel',
  'fs_route_nav_btn_full',
  'fs_route_nav_btn_open_all',
  'fs_route_nav_btn_leg'
];

for (const lang of ['zh', 'en', 'ko']) {
  i18n.currentLang = lang;
  for (const k of checkedKeys) {
    const text = i18n.t(k);
    assert(!emojiRegex.test(text), `Translation key ${k} in ${lang} must not contain emojis (got: ${text})`);
  }
}
i18n.currentLang = 'zh';
console.log('PASS: All button translation texts are emoji-free.');

// -------------------------------------------------------------
// 5. Test Google Maps Slash URL & Segmented Navigation
// -------------------------------------------------------------
console.log('5. Testing Google Maps Slash URL & Segmented Navigation...');

const originAddress = 'Green Oil Inc, Toronto, ON';
const sampleStops = Array.from({ length: 22 }, (_, i) => ({
  name: `餐馆 ${i + 1}`,
  address: `Street Address ${i + 1}, Toronto, ON`
}));

// Test slash URL formatting
const slashUrl = FieldSales.buildGoogleMapsSlashUrl(originAddress, sampleStops.slice(0, 3));
assert(slashUrl.startsWith('https://www.google.com/maps/dir/Green%20Oil%20Inc%2C%20Toronto%2C%20ON/'));
assert(slashUrl.includes('Street%20Address%201'));
assert(slashUrl.includes('Street%20Address%203'));

// Test 22 stops partitioned into legs
const legs = FieldSales.buildRouteLegs(originAddress, sampleStops);
assert.equal(legs.length, 3, '22 stops with step=9 must produce exactly 3 legs (9 + 9 + 4)');

// Leg 1: origin HQ, stops 1..9
assert.equal(legs[0].legIndex, 1);
assert.equal(legs[0].from, 'Green Oil HQ');
assert.equal(legs[0].to, '餐馆 9');
assert.equal(legs[0].stopsCount, 9);
assert(legs[0].url.startsWith(`https://www.google.com/maps/dir/${encodeURIComponent(originAddress)}/`));
assert(legs[0].url.includes(encodeURIComponent('餐馆 9, Street Address 9, Toronto, ON')));

// Leg 2: origin Stop 9, stops 10..18
assert.equal(legs[1].legIndex, 2);
assert.equal(legs[1].from, '餐馆 9');
assert.equal(legs[1].to, '餐馆 18');
assert.equal(legs[1].stopsCount, 9);
assert(legs[1].url.startsWith(`https://www.google.com/maps/dir/${encodeURIComponent('餐馆 9, Street Address 9, Toronto, ON')}/`));
assert(legs[1].url.includes(encodeURIComponent('餐馆 18, Street Address 18, Toronto, ON')));

// Leg 3: origin Stop 18, stops 19..22
assert.equal(legs[2].legIndex, 3);
assert.equal(legs[2].from, '餐馆 18');
assert.equal(legs[2].to, '餐馆 22');
assert.equal(legs[2].stopsCount, 4);
assert(legs[2].url.startsWith(`https://www.google.com/maps/dir/${encodeURIComponent('餐馆 18, Street Address 18, Toronto, ON')}/`));
assert(legs[2].url.includes(encodeURIComponent('餐馆 22, Street Address 22, Toronto, ON')));

console.log('PASS: Google Maps Slash URL and Segmented Navigation verified.');

console.log('ALL ENHANCED ROUTE WAYPOINT TESTS PASSED!');
