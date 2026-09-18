import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BusinessHours } from "../assets/js/business-hours.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Starting Business Hours test suite...");

// 1. Test missing / unprovided hours
console.log("  1. Testing missing/unprovided hours...");
assert.equal(BusinessHours.getBusinessStatus(null).status, "未知");
assert.equal(BusinessHours.getBusinessStatus("").status, "未知");
assert.equal(BusinessHours.getBusinessStatus("未提供").status, "未知");
assert.equal(BusinessHours.getBusinessStatus("Not provided").status, "未知");
assert.equal(BusinessHours.getBusinessStatus("未知").status, "未知");

// 2. Test closed / rest days
console.log("  2. Testing closed days...");
const closedSchedule = "星期一: 休息\n星期二: 休息\n星期三: 休息\n星期四: 休息\n星期五: 休息\n星期六: 休息\n星期日: 休息";
assert.equal(BusinessHours.getBusinessStatus(closedSchedule).status, "已打烊");

// 3. Test 24-hour operations
console.log("  3. Testing 24-hour operations...");
const all24h = "星期一: 24小时营业\n星期二: 24小时营业\n星期三: 24小时营业\n星期四: 24小时营业\n星期五: 24小时营业\n星期六: 24小时营业\n星期日: 24小时营业";
const res24h = BusinessHours.getBusinessStatus(all24h);
assert.equal(res24h.status, "营业中");
assert.equal(res24h.is24h, true);
assert.equal(res24h.label, "24小时营业");

// 4. Test regular daytime shift: Monday 11:00–22:00
console.log("  4. Testing regular daytime shifts at different times...");
const monSchedule = "星期一: 11:00–22:00\n星期二: 11:00–22:00\n星期三: 休息\n星期四: 休息\n星期五: 休息\n星期六: 休息\n星期日: 休息";

// 2026-09-14 is Monday
const monMorning = new Date("2026-09-14T09:30:00-04:00");
const monLunch = new Date("2026-09-14T12:00:00-04:00");
const monAfternoon = new Date("2026-09-14T19:30:00-04:00");
const monNight = new Date("2026-09-14T22:30:00-04:00");
const wedRestDay = new Date("2026-09-16T12:00:00-04:00");

// Morning 09:30 opens at 11:00 (in 90 min) -> "未开门" / "剩1小时30分开业"
const statusMorning = BusinessHours.getBusinessStatus(monSchedule, monMorning);
assert.equal(statusMorning.status, "未开门");
assert.equal(statusMorning.statusKey, "status_opening");
assert.equal(statusMorning.cls, "status-opening");
assert.equal(statusMorning.remainingMinutes, 90);
assert.equal(statusMorning.label, "剩1小时30分开业");

// English & Korean translations for opening soon
const statusMorningEn = BusinessHours.getBusinessStatus(monSchedule, monMorning, { lang: "en" });
assert.equal(statusMorningEn.label, "Opens in 1h 30m");
const statusMorningKo = BusinessHours.getBusinessStatus(monSchedule, monMorning, { lang: "ko" });
assert.equal(statusMorningKo.label, "오픈 1시간 30분 전");

const statusLunch = BusinessHours.getBusinessStatus(monSchedule, monLunch);
assert.equal(statusLunch.status, "营业中");
assert.equal(statusLunch.remainingMinutes, 600); // 10 hours left
assert.equal(statusLunch.label, "剩10小时打烊");

const statusDinner = BusinessHours.getBusinessStatus(monSchedule, monAfternoon);
assert.equal(statusDinner.status, "营业中");
assert.equal(statusDinner.remainingMinutes, 150); // 2h 30m left
assert.equal(statusDinner.label, "剩2小时30分打烊");

// Monday night 22:30 opens Tuesday 11:00 (12.5h away) -> "未开门" / "剩12小时30分开业"
const statusNight = BusinessHours.getBusinessStatus(monSchedule, monNight);
assert.equal(statusNight.status, "未开门");
assert.equal(statusNight.remainingMinutes, 750);
assert.equal(statusNight.label, "剩12小时30分开业");

// Wednesday 12:00 is rest day, next open is Monday (5 days away > 24h) -> "已打烊"
const statusWed = BusinessHours.getBusinessStatus(monSchedule, wedRestDay);
assert.equal(statusWed.status, "已打烊");
assert.equal(statusWed.statusKey, "status_closed");
assert.equal(statusWed.cls, "status-closed");

// 5. Test overnight shift: Friday 16:00–01:30, Saturday 16:00–01:30
console.log("  5. Testing overnight cross-midnight shifts...");
const overnightSchedule = `
星期一: 休息
星期二: 休息
星期三: 休息
星期四: 休息
星期五: 16:00–01:30
星期六: 16:00–01:30
星期日: 休息
`;
// Friday evening at 23:00 (EDT)
const friLate = new Date("2026-09-18T23:00:00-04:00");
const resFriLate = BusinessHours.getBusinessStatus(overnightSchedule, friLate);
assert.equal(resFriLate.status, "营业中");
assert.equal(resFriLate.remainingMinutes, 150); // 2h 30m until 01:30
assert.equal(resFriLate.label, "剩2小时30分打烊");

// Saturday past midnight at 00:45 AM (EDT) - should still be open from Friday night!
const satEarly = new Date("2026-09-19T00:45:00-04:00");
const resSatEarly = BusinessHours.getBusinessStatus(overnightSchedule, satEarly);
assert.equal(resSatEarly.status, "营业中");
assert.equal(resSatEarly.remainingMinutes, 45); // 45 mins until 01:30
assert.equal(resSatEarly.label, "剩45分钟打烊");

// Saturday morning at 02:00 AM (EDT) - next shift is Saturday 16:00 (14 hours away) -> "未开门"
const satMorning = new Date("2026-09-19T02:00:00-04:00");
const resSatMorning = BusinessHours.getBusinessStatus(overnightSchedule, satMorning);
assert.equal(resSatMorning.status, "未开门");
assert.equal(resSatMorning.remainingMinutes, 840);
assert.equal(resSatMorning.label, "剩14小时开业");

// Monday morning on overnightSchedule - next shift is Friday 16:00 (> 24h) -> "已打烊"
const monOvernight = new Date("2026-09-14T10:00:00-04:00");
assert.equal(BusinessHours.getBusinessStatus(overnightSchedule, monOvernight).status, "已打烊");

// 6. Test English standard formats
console.log("  6. Testing English opening hours (12-hour AM/PM)...");
const engSchedule = `
Monday: 11:00 AM – 11:00 PM
Tuesday: 11:00 AM – 11:00 PM
Wednesday: Closed
Thursday: 11:00 AM – 11:00 PM
Friday: 11:00 AM – 2:00 AM
Saturday: 11:00 AM – 2:00 AM
Sunday: 12:00 PM – 10:00 PM
`;
const engLunch = BusinessHours.getBusinessStatus(engSchedule, monLunch, { lang: "en" });
assert.equal(engLunch.status, "营业中");
assert.equal(engLunch.label, "Closes in 11h");

const engKo = BusinessHours.getBusinessStatus(engSchedule, monLunch, { lang: "ko" });
assert.equal(engKo.status, "营业中");
assert.equal(engKo.label, "마감 11시간 전");

// 7. Test English day ranges
console.log("  7. Testing English day range format...");
const engRange = `
Monday - Friday: 9:00 AM - 5:00 PM
Saturday: 10:00 AM - 4:00 PM
Sunday: Closed
`;
assert.equal(BusinessHours.getBusinessStatus(engRange, monLunch).status, "营业中");

// 8. Regression test on real dataset of 2955 restaurants
console.log("  8. Testing regression across full 2955 restaurant dataset...");
const jsonPath = "/Users/xlee/.gemini/antigravity/brain/08b7c4a7-3e7f-4138-bd5c-9dc5bd01eef5/scratch/all_restaurants.json";
if (fs.existsSync(jsonPath)) {
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  assert.equal(data.length, 2955);
  let unknownCount = 0;
  let parsedCount = 0;
  for (const r of data) {
    const res = BusinessHours.getBusinessStatus(r.openingHours);
    assert.ok(["未知", "已打烊", "营业中", "未开门"].includes(res.status));
    assert.ok(["status-unknown", "status-closed", "status-open", "status-opening"].includes(res.cls));
    if (res.status === "未知") {
      unknownCount++;
    } else {
      parsedCount++;
    }
  }
  assert.equal(unknownCount, 42);
  assert.equal(parsedCount, 2913);
  console.log(`  Successfully verified all 2955 restaurants (2913 parsed, 42 unknown)!`);
}

console.log("ALL BUSINESS HOURS TESTS PASSED!");

