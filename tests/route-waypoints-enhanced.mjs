import assert from 'node:assert/strict';
import { Api } from '../assets/js/api.js';
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

// Test glued strings without newlines (e.g. from raw database/Excel imports)
const gluedCafe = 'Monday: 9:00 AM – 8:00 PMTuesday: 9:00 AM – 8:00 PMWednesday: 9:00 AM – 8:00 PMThursday: 9:00 AM – 8:00 PMFriday: 9:00 AM – 8:00 PMSaturday: 9:00 AM – 8:00 PMSunday: 9:00 AM – 8:00 PM';
assert.equal(
  FieldSales.formatWeekdayOpeningHours(gluedCafe),
  '9:00 AM – 8:00 PM',
  'Glued string without newlines should be successfully split and aggregated'
);

const gluedIsland = 'Monday: ClosedTuesday: 11:00 AM – 7:00 PMWednesday: 11:00 AM – 7:00 PMThursday: 11:00 AM – 7:00 PMFriday: 11:00 AM – 7:00 PMSaturday: 11:00 AM – 7:00 PMSunday: Closed';
assert.equal(
  FieldSales.formatWeekdayOpeningHours(gluedIsland),
  '11:00 AM – 7:00 PM (周一休息)',
  'Glued string with closed Monday should be parsed with special day'
);

// Test array of lines
assert.equal(
  FieldSales.formatWeekdayOpeningHours([
    'Monday: 10:00 AM - 9:00 PM',
    'Tuesday: 10:00 AM - 9:00 PM',
    'Wednesday: 10:00 AM - 9:00 PM',
    'Thursday: 10:00 AM - 9:00 PM',
    'Friday: 10:00 AM - 10:00 PM'
  ]),
  '10:00 AM - 9:00 PM (周五: 10:00 AM - 10:00 PM)',
  'Array of strings should be supported'
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

// Test enrichment of waypoint that originally lacked openingHours (e.g. Zen Japanese Restaurant added from map)
const wpZenNoHours = {
  placeId: 'ChIJ_UhzjJ7U1IkRxCoo1LUCK_0',
  name: 'Zen Japanese Restaurant',
  address: '7634 Woodbine Ave, Markham, ON L3R 2N2',
  phone: '(905) 604-7211'
};
FieldSales.cachedRestaurants = [{
  placeId: 'ChIJ_UhzjJ7U1IkRxCoo1LUCK_0',
  name: 'Zen Japanese Restaurant',
  openingHours: '星期一: 休息\n星期二: 12:00–14:30, 17:30–22:00\n星期三: 12:00–14:30, 17:30–22:00\n星期四: 12:00–14:30, 17:30–22:00\n星期五: 12:00–14:30, 17:30–22:00\n星期六: 12:00–14:30, 17:30–22:00\n星期日: 休息'
}];
FieldSales.routeWaypoints = [wpZenNoHours];
FieldSales.selectedWaypointIds = new Set();
await FieldSales.exportWaypointsToExcel();
const zenExportRows = exportedWb.Sheets['Waypoints']._rows;
assert.equal(zenExportRows.length, 1);
assert.equal(zenExportRows[0]['餐厅名称'], 'Zen Japanese Restaurant');
assert.equal(zenExportRows[0]['营业时间'], '12:00–14:30, 17:30–22:00 (周一休息)');
assert.equal(wpZenNoHours.openingHours, FieldSales.cachedRestaurants[0].openingHours, 'Waypoint in route should be enriched with openingHours');

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

// -------------------------------------------------------------
// 6. Test Sales Visit Opening Hours Sync to Database
// -------------------------------------------------------------
console.log('6. Testing Sales Visit Opening Hours Sync...');
let updatedRestArgs = null;
Api.updateRestaurant = async (placeId, name, updates) => {
  updatedRestArgs = { placeId, name, updates };
  return { success: true };
};
Api.createSale = async (record) => ({ success: true, record });
Api.updateSale = async (id, record) => ({ success: true, record });
globalThis.window.Api = Api;

const restToEdit = {
  placeId: 'ChIJ_zen_test',
  name: 'Zen Japanese Restaurant',
  address: '7634 Woodbine Ave',
  phone: '(905) 604-7211',
  openingHours: '12:00–14:30'
};
FieldSales.routeWaypoints = [{ ...restToEdit }];
FieldSales.selectedRestaurantForSale = restToEdit;

// Mock DOM elements for visit modal
globalThis.document = {
  documentElement: { lang: 'en' },
  querySelectorAll: () => [],
  getElementById: (id) => {
    if (id === 'fsRecordRestSelect') return { value: 'ChIJ_zen_test' };
    if (id === 'fsRecordTime') return { value: '2026-09-14T10:00' };
    if (id === 'fsEditRestPhone') return { value: '(905) 604-7211' };
    if (id === 'fsEditRestAddress') return { value: '7634 Woodbine Ave' };
    if (id === 'fsEditRestContact') return { value: 'Manager Tanaka' };
    if (id === 'fsEditRestHours') return { value: '12:00–14:30, 17:30–22:00 (周一休息)' };
    if (id === 'fsSyncRestToKv') return { checked: true };
    if (id === 'fsBtnSubmitRecord') return { textContent: '' };
    if (id === 'fsRecordModalOverlay') return { classList: { remove: () => {} } };
    return null;
  },
  querySelector: (sel) => {
    if (sel.includes('fsMethod')) return { value: 'onsite' };
    if (sel.includes('fsOutcome')) return { value: 'interested' };
    return null;
  }
};

await FieldSales.handleSaveRecord();

assert(updatedRestArgs, 'Api.updateRestaurant must be called when sync is checked');
assert.equal(updatedRestArgs.placeId, 'ChIJ_zen_test');
assert.equal(updatedRestArgs.updates.openingHours, '12:00–14:30, 17:30–22:00 (周一休息)', 'Opening hours must be synced in updates');
assert.equal(updatedRestArgs.updates.contactPerson, 'Manager Tanaka');
assert.equal(FieldSales.routeWaypoints[0].openingHours, '12:00–14:30, 17:30–22:00 (周一休息)', 'Waypoint openingHours in route must be updated');
console.log('PASS: Sales visit opening hours sync to database verified.');

// -------------------------------------------------------------
// 7. Verify KV Terminology Completely Removed from UI Translations
// -------------------------------------------------------------
console.log('7. Verifying KV Terminology Removed from UI...');
const i18nKeysToCheck = [
  'legend_in_kv',
  'legend_new_place',
  'btn_batch_add_to_kv',
  'map_filter_kv',
  'th_kv_status',
  'fs_edit_rest_section',
  'fs_rest_sync_tip'
];
['zh', 'en', 'ko'].forEach(lang => {
  i18n.setLanguage(lang);
  for (const key of i18nKeysToCheck) {
    const text = i18n.t(key);
    assert(!text.includes('KV'), `Translation for "${key}" in "${lang}" must not contain "KV" (was: "${text}")`);
  }
});
console.log('PASS: All UI translations are free of legacy "KV" terminology.');

// -------------------------------------------------------------
// 8. Test Route Tabs Lifecycle & Operations
// -------------------------------------------------------------
console.log('8. Testing Route Tabs Lifecycle & Operations...');

// Reset language and state
i18n.setLanguage('zh');
FieldSales.routeTabs = [];
FieldSales.activeRouteTabId = null;
FieldSales.getActiveRouteTab();

assert.equal(FieldSales.routeTabs.length, 1, 'Should initialize with 1 default tab');
const defaultTab = FieldSales.getActiveRouteTab();
assert(defaultTab, 'Default tab must exist');
assert.equal(defaultTab.id, FieldSales.activeRouteTabId);

// 8.1 Create Tab
const tab2 = FieldSales.createRouteTab('路线 2');
assert.equal(FieldSales.routeTabs.length, 2);
assert.equal(FieldSales.activeRouteTabId, tab2.id, 'New tab becomes active');
assert.equal(tab2.name, '路线 2');

// 8.2 Add waypoint to tab 2 and duplicate
tab2.waypoints.push({
  _uid: 'wp_tab2_1',
  placeId: 'p_tab2_1',
  name: '测试餐馆',
  address: '100 Test Ave'
});

const tab3 = FieldSales.duplicateRouteTab(tab2.id);
assert.equal(FieldSales.routeTabs.length, 3);
assert.equal(tab3.name, '路线 2 (副本)', 'Duplicated tab name has suffix');
assert.equal(tab3.waypoints.length, 1);
assert.notEqual(tab3.waypoints[0]._uid, 'wp_tab2_1', 'Duplicated waypoints must have new unique _uids');
assert.equal(tab3.waypoints[0].name, '测试餐馆');

// Deep copy check: modifying tab 3 must not affect tab 2
tab3.waypoints.push({ _uid: 'wp_tab3_new', name: '独立站点' });
assert.equal(tab2.waypoints.length, 1, 'Modifying copy must not affect original tab');
assert.equal(tab3.waypoints.length, 2);

// 8.3 Rename Tab
FieldSales._renamingTabId = tab3.id;
globalThis.document.getElementById = (id) => {
  if (id === 'fsRouteRenameInput') return { value: '重命名路线' };
  if (id === 'fsRouteRenameModalOverlay') return { classList: { remove: () => {} } };
  return null;
};
FieldSales.saveRenameTab();
assert.equal(tab3.name, '重命名路线', 'Tab should be renamed');

// 8.4 Delete Tab
FieldSales.deleteRouteTab(tab3.id);
assert.equal(FieldSales.routeTabs.length, 2, 'Tab 3 should be deleted');
assert(!FieldSales.routeTabs.some(t => t.id === tab3.id));

// 8.5 Delete Protection (at least 1 tab)
FieldSales.deleteRouteTab(tab2.id);
assert.equal(FieldSales.routeTabs.length, 1);
const lastTabId = FieldSales.routeTabs[0].id;
FieldSales.deleteRouteTab(lastTabId);
assert.equal(FieldSales.routeTabs.length, 1, 'Last tab must not be deleted');

// 8.6 Single tab vs Multi-tab adding behavior
let modalOpened = false;
let modalTargetRestaurants = null;
const origOpenSelectTabModal = FieldSales.openSelectTabModal.bind(FieldSales);
FieldSales.openSelectTabModal = (restaurants, jumpToTab) => {
  modalOpened = true;
  modalTargetRestaurants = restaurants;
  FieldSales._pendingImportRestaurants = restaurants;
  FieldSales._pendingImportJumpToTab = jumpToTab;
};

// Single tab: adds directly without opening modal
FieldSales.addRestaurantToRoute({ placeId: 'auto_p1', name: '自动直达餐馆' });
assert.equal(modalOpened, false, 'With 1 tab, addRestaurantToRoute should not open selection modal');
assert(FieldSales.getActiveRouteTab().waypoints.some(w => w.name === '自动直达餐馆'));

// Multi tab: opens selection modal
const tabB = FieldSales.createRouteTab('路线 B');
assert.equal(FieldSales.routeTabs.length, 2);
FieldSales.addRestaurantToRoute({ placeId: 'select_p2', name: '需选择餐馆' });
assert.equal(modalOpened, true, 'With >1 tabs, addRestaurantToRoute must open selection modal');

// 8.7 Verify adding to chosen tab from selection modal
// Suppose user chose tabB ('路线 B')
FieldSales.executeAddMultipleToRoute(modalTargetRestaurants, tabB.id, false);
assert.equal(FieldSales.routeTabs.length, 2, 'Must not wipe out any tabs');
assert.equal(FieldSales.activeRouteTabId, tabB.id, 'Active tab must switch to the target tab chosen by user');
assert(tabB.waypoints.some(w => w.name === '需选择餐馆'), 'Must be added to 路线 B');
const tab1 = FieldSales.routeTabs.find(t => t.id !== tabB.id);
assert(!tab1.waypoints.some(w => w.name === '需选择餐馆'), 'Must NOT be added to 路线 1');

// 8.8 Verify "+ 新建标签并添加" flow
const newTabCreated = FieldSales.createRouteTab();
FieldSales.executeAddMultipleToRoute([{ placeId: 'new_p3', name: '第三标签餐馆' }], newTabCreated.id, false);
assert.equal(FieldSales.routeTabs.length, 3, 'Must have 3 tabs now');
assert.equal(FieldSales.activeRouteTabId, newTabCreated.id, 'Must be active on new tab');
assert(newTabCreated.waypoints.some(w => w.name === '第三标签餐馆'));

// 8.9 Verify loadRouteWaypoints does NOT wipe multiple tabs when server returns legacy waypoints without tabs
Api.getRouteWaypoints = async () => ({
  success: true,
  data: {
    origin: 'Green Oil Inc, Toronto, ON',
    waypoints: [{ placeId: 'legacy_p', name: '旧版站点' }]
    // tabs is undefined/null!
  }
});
await FieldSales.loadRouteWaypoints();
assert.equal(FieldSales.routeTabs.length, 3, 'Existing multiple tabs must NOT be wiped by legacy server waypoints');

// 8.10 Verify Tab UI: only tab name on each tab item, right toolbar buttons exist
let tabsBarHtml = "";
let deleteBtnDisabled = false;
globalThis.document.getElementById = (id) => {
  if (id === "fsRouteTabsBar") {
    return {
      set innerHTML(val) { tabsBarHtml = val; },
      querySelectorAll: () => []
    };
  }
  if (id === "fsRouteBtnDeleteTab") {
    return {
      set disabled(val) { deleteBtnDisabled = val; },
      style: {}
    };
  }
  return null;
};

FieldSales.renderRouteTabs();
assert(tabsBarHtml.includes('class="fs-route-tab-item'), 'Tabs must use fs-route-tab-item styling');
assert(!tabsBarHtml.includes('fs-route-tab-count'), 'Tab items must NOT include count badges');
assert(!tabsBarHtml.includes('fs-route-tab-action-btn'), 'Tab items must NOT contain nested action buttons');
assert.equal(deleteBtnDisabled, false, 'Delete button on right toolbar must be enabled when >1 tabs exist');

// When only 1 tab exists, delete button must be disabled
FieldSales.routeTabs = [{ id: 'tab_single', name: '独苗路线', waypoints: [] }];
FieldSales.activeRouteTabId = 'tab_single';
FieldSales.renderRouteTabs();
assert.equal(deleteBtnDisabled, true, 'Delete button on right toolbar must be disabled when only 1 tab exists');

// Restore
FieldSales.openSelectTabModal = origOpenSelectTabModal;

console.log('PASS: Route tabs lifecycle, tab styling, and toolbar operations verified.');

// -------------------------------------------------------------
// 9. Test Address Matching Engine & Manual Add
// -------------------------------------------------------------
console.log('9. Testing Address Matching Engine & Manual Add...');

// Mock restaurants database
FieldSales.cachedRestaurants = [
  {
    placeId: 'ChIJ_taqueria',
    name: 'Taquería el Tapatio',
    nameEn: 'Taqueria el Tapatio',
    address: '915 Danforth Ave, Toronto, ON M4J 1L8',
    phone: '(416) 463-2288',
    openingHours: '11:00 AM - 10:00 PM',
    latitude: 43.6806,
    longitude: -79.3364,
    region: 'Toronto'
  },
  {
    placeId: 'ChIJ_woodbine_rest',
    name: 'Woodbine Cafe',
    address: '7095 Woodbine Ave, Markham, ON L3R 1A3',
    phone: '(905) 555-0199',
    region: 'York'
  }
];

// 9.1 Postal code extraction
const pc1 = FieldSales.extractPostalCode('915 Danforth Ave, Toronto, ON M4J 1L8');
assert.equal(pc1.full, 'M4J1L8');
assert.equal(pc1.formatted, 'M4J 1L8');

const pc2 = FieldSales.extractPostalCode('3235 Hwy 7 Unit 17, Markham, on l3r-3p3 Canada');
assert.equal(pc2.full, 'L3R3P3');

const pc3 = FieldSales.extractPostalCode('No Postal Code Here');
assert.equal(pc3, null);

// 9.2 Street normalization
const normStreet = FieldSales.normalizeStreet('915 Danforth Avenue, Unit 102, Toronto, Ontario');
assert(normStreet.includes('915'), 'Number should be preserved');
assert(normStreet.includes('danforth ave'), 'Avenue should normalize to ave');
assert(!normStreet.includes('unit 102'), 'Unit info should be stripped');

// 9.3 Address matching: Exact postal + street number
const match1 = FieldSales.matchAddressToRestaurant('915 Danforth Ave, Toronto, ON M4J 1L8');
assert(match1, 'Must match Taquería el Tapatio');
assert.equal(match1.placeId, 'ChIJ_taqueria');
assert.equal(match1.name, 'Taquería el Tapatio');

// 9.4 Address matching: Street number + normalized street (no postal code)
const match2 = FieldSales.matchAddressToRestaurant('915 Danforth Avenue, Toronto');
assert(match2, 'Must match Taquería el Tapatio even without postal code');
assert.equal(match2.placeId, 'ChIJ_taqueria');

// 9.5 Batch Add from Multiline Text
const activeTab = FieldSales.getActiveRouteTab();
activeTab.waypoints = [];

const multilineInput = `
915 Danforth Ave, Toronto, ON M4J 1L8
7095 Woodbine Ave, Markham, ON L3R 1A3
99999 Nonexistent Blvd, Nowhere, ON X9X 9X9
`;

FieldSales.batchAddAddressesFromText(multilineInput, activeTab.id);

assert.equal(activeTab.waypoints.length, 3, 'Must have added 3 waypoints');

// Stop 1: Matched Taquería el Tapatio
assert.equal(activeTab.waypoints[0].name, 'Taquería el Tapatio');
assert.equal(activeTab.waypoints[0].placeId, 'ChIJ_taqueria');
assert.equal(activeTab.waypoints[0]._matched, true);

// Stop 2: Matched Woodbine Cafe
assert.equal(activeTab.waypoints[1].name, 'Woodbine Cafe');
assert.equal(activeTab.waypoints[1].placeId, 'ChIJ_woodbine_rest');
assert.equal(activeTab.waypoints[1]._matched, true);

// Stop 3: Unmatched pure address
assert.equal(activeTab.waypoints[2].isCustomAddress, true);
assert.equal(activeTab.waypoints[2]._matched, false);
assert.equal(activeTab.waypoints[2].address, '99999 Nonexistent Blvd, Nowhere, ON X9X 9X9');
assert(activeTab.waypoints[2].placeId.startsWith('addr_'));

console.log('PASS: Address matching engine & batch manual add verified.');

// -------------------------------------------------------------
// 10. Verify No Emoji in UI Elements & Conciseness of Copy
// -------------------------------------------------------------
console.log('10. Verifying No Emojis & Clean Copy across i18n...');

// Regex matching unicode emojis
const tabEmojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

const newKeysToCheck = [
  'fs_route_btn_manual_add',
  'fs_route_tab_new',
  'fs_route_tab_rename',
  'fs_route_tab_duplicate',
  'fs_route_tab_delete',
  'fs_route_tab_default_name',
  'fs_route_tab_copy_suffix',
  'fs_route_tab_min_alert',
  'fs_route_tab_rename_title',
  'fs_route_tab_rename_prompt',
  'fs_route_tab_rename_empty',
  'fs_route_select_tab_title',
  'fs_route_select_tab_desc',
  'fs_route_select_tab_new_option',
  'fs_route_manual_modal_title',
  'fs_route_manual_modal_desc',
  'fs_route_manual_tab_label',
  'fs_route_manual_btn_submit',
  'fs_route_manual_empty_alert',
  'fs_route_manual_result_toast',
  'fs_route_custom_address_tag'
];

['zh', 'en', 'ko'].forEach(lang => {
  i18n.setLanguage(lang);
  for (const key of newKeysToCheck) {
    const text = i18n.t(key);
    assert(text, `Key "${key}" in "${lang}" must exist`);
    assert(!tabEmojiRegex.test(text), `Text for "${key}" in "${lang}" must not contain emojis (was: "${text}")`);
  }
});

// Check that verbose explanation is stripped from manual add description
i18n.setLanguage('zh');
const zhDesc = i18n.t('fs_route_manual_modal_desc');
assert.equal(zhDesc, '支持批量粘贴多行地址', 'Must match clean concise wording requested by user');
assert(!zhDesc.includes('系统将优先匹配'), 'Verbose explanation must not be in modal desc');

console.log('PASS: Zero emojis found and concise copy verified.');

// -------------------------------------------------------------
// 11. Testing Schedule-Aware TSP Optimization & Departure Time
// -------------------------------------------------------------
console.log('11. Testing Schedule-Aware TSP Optimization & Departure Time...');

// Scenario: Depart at 10:00 AM on Monday
// Store A is 1km away but opens at 14:00 (2:00 PM) -> Must NOT be visited first!
// Store B is 8km away and opens at 10:00 AM -> Must be visited first!
// Store C is 13km away and opens at 11:00 AM -> Visited after Store B!
const depTime10Am = new Date('2026-09-14T10:00:00-04:00');

const storeA = {
  placeId: 'store_a',
  name: 'Store A (Opens 2 PM)',
  latitude: 43.6600,
  longitude: -79.3800,
  openingHours: '星期一: 14:00–22:00\n星期二: 14:00–22:00\n星期三: 14:00–22:00\n星期四: 14:00–22:00\n星期五: 14:00–22:00\n星期六: 14:00–22:00\n星期日: 14:00–22:00'
};

const storeB = {
  placeId: 'store_b',
  name: 'Store B (Opens 10 AM)',
  latitude: 43.7200,
  longitude: -79.4000,
  openingHours: '星期一: 10:00–21:00\n星期二: 10:00–21:00\n星期三: 10:00–21:00\n星期四: 10:00–21:00\n星期五: 10:00–21:00\n星期六: 10:00–21:00\n星期日: 10:00–21:00'
};

const storeC = {
  placeId: 'store_c',
  name: 'Store C (Opens 11 AM)',
  latitude: 43.7600,
  longitude: -79.4100,
  openingHours: '星期一: 11:00–22:00\n星期二: 11:00–22:00\n星期三: 11:00–22:00\n星期四: 11:00–22:00\n星期五: 11:00–22:00\n星期六: 11:00–22:00\n星期日: 11:00–22:00'
};

const scheduledRoute = FieldSales.sortWaypointsBySchedule(
  [storeA, storeB, storeC],
  depTime10Am,
  { lat: 43.6532, lng: -79.3832 }
);

assert.equal(scheduledRoute.length, 3);
assert.equal(scheduledRoute[0].placeId, 'store_b', 'Store B (open at 10 AM) must be visited first');
assert.notEqual(scheduledRoute[0].placeId, 'store_a', 'Store A (opens at 2 PM) must NOT be visited first despite being closest');
assert(scheduledRoute[0]._estArrivalStr, 'Waypoints must have estimated arrival time');

// Verify Departure Time translations and absence of emojis
const scheduleKeys = [
  'status_opening',
  'status_opening_hours_mins',
  'status_opening_hours',
  'status_opening_mins',
  'fs_route_departure_time',
  'fs_route_btn_now',
  'fs_route_est_arrival'
];

['zh', 'en', 'ko'].forEach(lang => {
  i18n.setLanguage(lang);
  for (const k of scheduleKeys) {
    const text = i18n.t(k, { hours: 2, mins: 30, time: '10:15' });
    assert(text, `Key ${k} in ${lang} must exist`);
    assert(!tabEmojiRegex.test(text), `Text for ${k} in ${lang} must not contain emojis (was: ${text})`);
  }
});
i18n.setLanguage('zh');

console.log('PASS: Schedule-Aware TSP optimization & departure time rules verified.');

// -------------------------------------------------------------
// 12. Testing Anti-Shuttle Corridor Slicing & 2-Opt Optimization
// -------------------------------------------------------------
console.log('12. Testing Anti-Shuttle Corridor Slicing & 2-Opt Optimization...');

// 12.1 Corridor Projection & Principal Travel Axis
const originPoint = { lat: 43.6532, lng: -79.3832 }; // Downtown Toronto
const eastWaypoints = [
  { placeId: 'e1', name: 'Danforth Stop', latitude: 43.6800, longitude: -79.3200 },
  { placeId: 'e2', name: 'Scarborough Stop', latitude: 43.7400, longitude: -79.2500 },
  { placeId: 'e3', name: 'Markham East Stop', latitude: 43.8500, longitude: -79.2400 }
];

const axis = FieldSales.calculatePrincipalTravelAxis(originPoint, eastWaypoints);
assert.equal(axis.isCorridor, true, 'Eastward sequence must be detected as travel corridor');
assert(axis.uX > 0, 'Principal axis uX component should be Eastward (positive)');
assert(axis.spanKm > 10, 'Along-track span across GTA should exceed 10km');

// 12.2 Anti-Shuttle Corridor Slice Monotonic Forward Progression
// Candidates positioned in three progressive slices along the corridor
const corridorCandidates = [
  { placeId: 's3_far', name: 'Far Stop 1 (Markham)', latitude: 43.8500, longitude: -79.2600, openingHours: 'Mon-Sun 10:00-22:00' },
  { placeId: 's1_near1', name: 'Near Stop 1 (Danforth)', latitude: 43.6750, longitude: -79.3300, openingHours: 'Mon-Sun 10:00-22:00' },
  { placeId: 's2_mid', name: 'Mid Stop 1 (Scarborough)', latitude: 43.7400, longitude: -79.2700, openingHours: 'Mon-Sun 10:00-22:00' },
  { placeId: 's1_near2', name: 'Near Stop 2 (Greektown)', latitude: 43.6800, longitude: -79.3250, openingHours: 'Mon-Sun 10:00-22:00' },
  { placeId: 's3_far2', name: 'Far Stop 2 (Unionville)', latitude: 43.8600, longitude: -79.2500, openingHours: 'Mon-Sun 10:00-22:00' }
];

const sweptRoute = FieldSales.sortWaypointsBySchedule(
  corridorCandidates,
  new Date('2026-09-18T10:00:00'),
  originPoint
);

assert.equal(sweptRoute.length, 5);
const sweptIds = sweptRoute.map(r => r.placeId);
// Near stops (s1) must be visited BEFORE mid stop (s2)
assert(sweptIds.indexOf('s1_near1') < sweptIds.indexOf('s2_mid'), 'Near stop 1 must precede mid stop');
assert(sweptIds.indexOf('s1_near2') < sweptIds.indexOf('s2_mid'), 'Near stop 2 must precede mid stop');
// Mid stop (s2) must be visited BEFORE far stops (s3)
assert(sweptIds.indexOf('s2_mid') < sweptIds.indexOf('s3_far'), 'Mid stop must precede far stop 1');
assert(sweptIds.indexOf('s2_mid') < sweptIds.indexOf('s3_far2'), 'Mid stop must precede far stop 2');

// 12.3 2-Opt Tour Untangling Verification (Eliminating Crossed Edges)
// Construct a crossed "hourglass" quad of points:
// p1: (43.70, -79.30) -> p2: (43.71, -79.20)
// p3: (43.71, -79.30) -> p4: (43.70, -79.20)
// Visiting in crossed order p1 -> p2 -> p3 -> p4 causes crossed edges.
// 2-Opt should uncross to p1 -> p3 -> p2 -> p4 (or equivalent loop without crossings).
const crossedTour = [
  { placeId: 'p1', latitude: 43.7000, longitude: -79.3000 },
  { placeId: 'p2', latitude: 43.7100, longitude: -79.2000 },
  { placeId: 'p3', latitude: 43.7100, longitude: -79.3000 },
  { placeId: 'p4', latitude: 43.7000, longitude: -79.2000 }
];

const calcDist = (tour) => {
  let d = 0;
  let lat = 43.6532, lng = -79.3832;
  for (const p of tour) {
    d += FieldSales.getHaversineDistance(lat, lng, p.latitude, p.longitude);
    lat = p.latitude;
    lng = p.longitude;
  }
  return d;
};

const initialCrossedDist = calcDist(crossedTour);
const uncrossedTour = FieldSales.twoOptOptimization(
  crossedTour,
  originPoint,
  new Date('2026-09-18T10:00:00')
);
const uncrossedDist = calcDist(uncrossedTour);

assert(uncrossedDist < initialCrossedDist, `2-Opt must reduce tour distance (was ${initialCrossedDist.toFixed(2)} km, now ${uncrossedDist.toFixed(2)} km)`);

console.log(`PASS: 2-Opt tour optimization untangled crossings (distance reduced from ${initialCrossedDist.toFixed(2)} km to ${uncrossedDist.toFixed(2)} km).`);
console.log('PASS: Anti-Shuttle Corridor Slicing & 2-Opt verified.');

console.log('ALL ENHANCED ROUTE WAYPOINT TESTS PASSED!');
