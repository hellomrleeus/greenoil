import assert from "node:assert/strict";

const CITY_MAP = [
  ["加拿大", "Canada"],
  ["美国", "USA"],
  ["新西兰", "New Zealand"],
  ["澳大利亚", "Australia"],
  ["安大略省", "ON"],
  ["安大略", "ON"],
  ["安省", "ON"],
  ["卑诗省", "BC"],
  ["BC省", "BC"],
  ["魁北克省", "QC"],
  ["多伦多市中心", "Downtown Toronto"],
  ["多伦多", "Toronto"],
  ["士嘉堡", "Scarborough"],
  ["万锦市", "Markham"],
  ["万锦", "Markham"],
  ["列治文山市", "Richmond Hill"],
  ["列治文山", "Richmond Hill"],
  ["北约克", "North York"],
  ["密西沙加", "Mississauga"],
  ["旺市", "Vaughan"],
  ["奥克维尔", "Oakville"],
  ["伯灵顿", "Burlington"],
  ["宾顿", "Brampton"],
  ["布兰普顿", "Brampton"],
  ["皮克林", "Pickering"],
  ["阿贾克斯", "Ajax"],
  ["惠特比", "Whitby"],
  ["奥沙瓦", "Oshawa"],
  ["纽马克特", "Newmarket"],
  ["新市", "Newmarket"],
  ["奥罗拉", "Aurora"],
  ["极光镇", "Aurora"],
  ["东贵林", "East Gwillimbury"],
  ["滑铁卢", "Waterloo"],
  ["基奇纳", "Kitchener"],
  ["贵湖", "Guelph"],
  ["圭尔夫", "Guelph"],
  ["哈密尔顿", "Hamilton"],
  ["汉密尔顿", "Hamilton"],
  ["市中心", "Downtown"],
  ["约克巷", "York Lane"]
];

const TERM_MAP = [
  [/(?:邮政编码|郵區編號|邮编)[:：]?\s*/g, " "],
  [/(?:单元|室|房)\s*/g, "Unit "],
  [/号/g, " #"],
  [/大道/g, " Ave"],
  [/路/g, " Rd"],
  [/街/g, " St"],
  [/巷/g, " Ln"],
  [/广场/g, " Plaza"],
  [/商场/g, " Mall"]
];

export function toEnglishAddress(raw) {
  if (!raw || /^(?:未提供|无|未知|not provided|unknown|none|null|n\/a)$/i.test(String(raw).trim())) {
    return "N/A";
  }
  let s = String(raw).trim();
  if (!/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\uac00-\ud7af]/.test(s)) {
    return s;
  }

  for (const [pat, rep] of TERM_MAP) {
    s = s.replace(pat, rep);
  }
  for (const [zh, en] of CITY_MAP) {
    s = s.replaceAll(zh, ` ${en} `);
  }

  s = s.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\uac00-\ud7af]/g, " ");
  s = s.replace(/[,，]+/g, ", ");
  s = s.replace(/\s+/g, " ");
  s = s.replace(/,\s*,/g, ", ");
  s = s.replace(/ON Toronto/g, "Toronto, ON").replace(/ON Markham/g, "Markham, ON");
  s = s.replace(/ON Scarborough/g, "Scarborough, ON").replace(/ON North York/g, "North York, ON");
  s = s.replace(/Canada ON/g, "ON, Canada").replace(/USA TN/g, "TN, USA");
  s = s.replace(/^[,\s]+|[,\s]+$/g, "").trim();
  return s || "N/A";
}

export function toEnglishRestaurantName(name, nameEn) {
  if (nameEn && nameEn.trim() && /[a-zA-Z]/.test(nameEn)) {
    return nameEn.trim();
  }
  if (!name || typeof name !== "string") return "N/A";

  if (/[a-zA-Z]/.test(name)) {
    let en = name;
    en = en.replace(/（/g, " (").replace(/）/g, ") ").replace(/【/g, " [").replace(/】/g, "] ");
    en = en.replace(/([a-zA-Z0-9])\(/g, "$1 (");
    en = en.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\uac00-\ud7af\u1100-\u11ff\u3040-\u30ff]/g, " ");
    en = en.replace(/\(\s*\)/g, " ").replace(/\[\s*\]/g, " ");
    en = en.replace(/\s+/g, " ").trim();
    en = en.replace(/^[-–—,;:.\s]+|[-–—,;:.\s]+$/g, "");
    if (en && /[a-zA-Z]/.test(en)) {
      return en;
    }
  }
  return name.trim();
}

export function formatOpeningHoursEnglish(rawHours) {
  if (!rawHours) return "N/A";
  let rawStr = typeof rawHours === "string" ? rawHours : (Array.isArray(rawHours) ? rawHours.join("\n") : String(rawHours));
  let cleanStr = rawStr.replace(/[\u202F\u00A0\u2009\u200A\u3000]/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!cleanStr || /^(?:未提供|无|未知|not provided|unknown|none|null|n\/a)$/i.test(cleanStr)) {
    return "N/A";
  }

  if (/^(?:24\s*(?:hours|小时)|open\s*24|全天营业|24\/7|24시간\s*영업)$/i.test(cleanStr)) {
    return "Open 24 hours";
  }

  // Pre-process: insert newline before any day name preceded by delimiter or whitespace
  cleanStr = cleanStr.replace(
    /([^\r\n])\s*(?=(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon\b|tue\b|wed\b|thu\b|fri\b|sat\b|sun\b|星期[一二三四五六日天]|周[一二三四五六日天]|礼拜[一二三四五六日天]|월요일|화요일|수요일|목요일|금요일|토요일|일요일)[\s:：])/gi,
    "$1\n"
  );

  const DAY_MAP = {
    "星期一": "Mon", "周一": "Mon", "礼拜一": "Mon", "월요일": "Mon", "monday": "Mon", "mon": "Mon",
    "星期二": "Tue", "周二": "Tue", "礼拜二": "Tue", "화요일": "Tue", "tuesday": "Tue", "tue": "Tue",
    "星期三": "Wed", "周三": "Wed", "礼拜三": "Wed", "수요일": "Wed", "wednesday": "Wed", "wed": "Wed",
    "星期四": "Thu", "周四": "Thu", "礼拜四": "Thu", "목요일": "Thu", "thursday": "Thu", "thu": "Thu",
    "星期五": "Fri", "周五": "Fri", "礼拜五": "Fri", "금요일": "Fri", "friday": "Fri", "fri": "Fri",
    "星期六": "Sat", "周六": "Sat", "礼拜六": "Sat", "토요일": "Sat", "saturday": "Sat", "sat": "Sat",
    "星期日": "Sun", "星期天": "Sun", "周日": "Sun", "周天": "Sun", "礼拜天": "Sun", "礼拜日": "Sun", "일요일": "Sun", "sunday": "Sun", "sun": "Sun"
  };

  const DAYS_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const lines = cleanStr.split(/[\r\n]+|\s*[|·;；]\s*/).map(s => s.trim()).filter(Boolean);
  const parsedDays = {};
  let anyMatched = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.search(/[:：]/);
    if (colonIdx === -1) continue;

    const dayPart = trimmed.substring(0, colonIdx).trim().toLowerCase();
    const valPart = trimmed.substring(colonIdx + 1).trim();

    let dayEn = null;
    for (const [k, v] of Object.entries(DAY_MAP)) {
      if (dayPart === k.toLowerCase() || dayPart.replace(/[:：]/g, "") === k.toLowerCase()) {
        dayEn = v;
        break;
      }
    }

    if (dayEn) {
      anyMatched = true;
      let valEn = valPart;
      if (/^(?:closed|close|off|day off|休息|打烊|不营业|未营业|휴무)$/i.test(valPart) || /休息|打烊|휴무/i.test(valPart)) {
        valEn = "Closed";
      } else if (/24\s*(?:hours|小时)|open\s*24|全天营业|24\/7|24시간/i.test(valPart)) {
        valEn = "Open 24 hours";
      } else {
        valEn = valPart
          .replace(/[–—~至到]/g, "-")
          .replace(/上午/g, "AM ")
          .replace(/下午/g, "PM ")
          .replace(/晚上/g, "PM ")
          .replace(/中午/g, "PM ")
          .replace(/凌晨/g, "AM ")
          .replace(/次日|翌日/g, "Next day ")
          .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\uac00-\ud7af]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!valEn) valEn = "N/A";
      }
      parsedDays[dayEn] = valEn;
    }
  }

  if (!anyMatched) {
    let fallback = cleanStr
      .replace(/24小时营业|全天营业/g, "Open 24 hours")
      .replace(/休息|打烊|不营业/g, "Closed")
      .replace(/星期一至星期日|周一至周日/g, "Mon-Sun")
      .replace(/星期一至星期五|周一至周五/g, "Mon-Fri")
      .replace(/星期六至星期日|周六至周日/g, "Sat-Sun")
      .replace(/星期一|周一/g, "Mon")
      .replace(/星期二|周二/g, "Tue")
      .replace(/星期三|周三/g, "Wed")
      .replace(/星期四|周四/g, "Thu")
      .replace(/星期五|周五/g, "Fri")
      .replace(/星期六|周六/g, "Sat")
      .replace(/星期日|周日|星期天/g, "Sun")
      .replace(/上午/g, "AM ")
      .replace(/下午/g, "PM ")
      .replace(/晚上/g, "PM ")
      .replace(/中午/g, "PM ")
      .replace(/凌晨/g, "AM ")
      .replace(/[–—~至到]/g, "-")
      .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\uac00-\ud7af]/g, " ")
      .replace(/[\r\n]+|\s*[|·;；]\s*/g, ", ")
      .replace(/\s+/g, " ")
      .trim();
    return fallback || "N/A";
  }

  if (DAYS_ORDER.every(d => d in parsedDays)) {
    const groups = [];
    let curVal = parsedDays[DAYS_ORDER[0]];
    let startIdx = 0;
    for (let i = 1; i < DAYS_ORDER.length; i++) {
      const v = parsedDays[DAYS_ORDER[i]];
      if (v !== curVal) {
        groups.push({ start: startIdx, end: i - 1, val: curVal });
        startIdx = i;
        curVal = v;
      }
    }
    groups.push({ start: startIdx, end: DAYS_ORDER.length - 1, val: curVal });

    const resultParts = groups.map(g => {
      let label = "";
      if (g.start === g.end) {
        label = DAYS_ORDER[g.start];
      } else if (g.start === 0 && g.end === 6) {
        label = "Mon-Sun";
      } else {
        label = `${DAYS_ORDER[g.start]}-${DAYS_ORDER[g.end]}`;
      }
      return `${label}: ${g.val}`;
    });
    return resultParts.join(", ");
  }

  const presentDays = DAYS_ORDER.filter(d => d in parsedDays);
  if (presentDays.length > 0) {
    const groups = [];
    let curVal = parsedDays[presentDays[0]];
    let startIdx = 0;
    for (let i = 1; i < presentDays.length; i++) {
      const v = parsedDays[presentDays[i]];
      const prevOrderIdx = DAYS_ORDER.indexOf(presentDays[i - 1]);
      const curOrderIdx = DAYS_ORDER.indexOf(presentDays[i]);
      if (v !== curVal || curOrderIdx !== prevOrderIdx + 1) {
        groups.push({ start: presentDays[startIdx], end: presentDays[i - 1], val: curVal });
        startIdx = i;
        curVal = v;
      }
    }
    groups.push({ start: presentDays[startIdx], end: presentDays[presentDays.length - 1], val: curVal });

    return groups.map(g => {
      const label = g.start === g.end ? g.start : `${g.start}-${g.end}`;
      return `${label}: ${g.val}`;
    }).join(", ");
  }

  return Object.entries(parsedDays).map(([d, v]) => `${d}: ${v}`).join(", ");
}

// ----------------- RUN TESTS -----------------
console.log("Testing English translation functions...");

// 1. Restaurant Name tests
assert.equal(
  toEnglishRestaurantName("Yang's Braised Chicken Rice(First Markham Place)杨铭宇黄焖鸡米饭", ""),
  "Yang's Braised Chicken Rice (First Markham Place)"
);
assert.equal(
  toEnglishRestaurantName("御品", "Kingsfield Chinese Cuisine"),
  "Kingsfield Chinese Cuisine"
);
assert.equal(
  toEnglishRestaurantName("Hualien Tai Ping Hsiang BBQ 花蓮太平香", ""),
  "Hualien Tai Ping Hsiang BBQ"
);

// 2. Address tests
const addr1 = toEnglishAddress("Ontario, Markham, Woodbine Ave, Unit 1CF5邮政编码: L6C 0M5");
assert.ok(!/[\u4e00-\u9fff]/.test(addr1), "Must not contain Chinese characters");
assert.ok(addr1.includes("Woodbine Ave") && addr1.includes("L6C 0M5"));

const addr2 = toEnglishAddress("加拿大安大略省多伦多邮政编码: M2J 3C1");
assert.ok(!/[\u4e00-\u9fff]/.test(addr2), "Must not contain Chinese characters");
assert.ok(addr2.includes("Toronto") && addr2.includes("M2J 3C1"));

const addr3 = toEnglishAddress("安大略省多伦多士嘉堡");
assert.ok(!/[\u4e00-\u9fff]/.test(addr3), "Must not contain Chinese characters");
assert.ok(addr3.includes("Toronto") && addr3.includes("Scarborough"));

// 3. Opening Hours tests
const hours1 = formatOpeningHoursEnglish(
  "星期一: 11:00–02:00\n星期二: 11:00–02:00\n星期三: 11:00–02:00\n星期四: 11:00–02:00\n星期五: 11:00–02:00\n星期六: 11:00–02:00\n星期日: 11:00–02:00"
);
assert.equal(hours1, "Mon-Sun: 11:00-02:00");

const hours2 = formatOpeningHoursEnglish(
  "星期一: 11:00–19:00\n星期二: 11:00–19:00\n星期三: 11:00–19:00\n星期四: 11:00–19:00\n星期五: 11:00–19:00\n星期六: 11:00–19:00\n星期日: 休息"
);
assert.equal(hours2, "Mon-Sat: 11:00-19:00, Sun: Closed");

const hours3 = formatOpeningHoursEnglish("24小时营业");
assert.equal(hours3, "Open 24 hours");

const hours4 = formatOpeningHoursEnglish("未提供");
assert.equal(hours4, "N/A");

// Pipe-delimited string matching user screenshot (Row 2: Gal's Sushi)
const hoursPipeAllSame = formatOpeningHoursEnglish(
  "Mon: 11:30-22:00 | 星期二: 11:30-22:00 | 星期三: 11:30-22:00 | 星期四: 11:30-22:00 | 星期五: 11:30-22:00 | 星期六: 11:30-22:00 | 星期日: 11:30-22:00"
);
assert.equal(hoursPipeAllSame, "Mon-Sun: 11:30-22:00");
assert.ok(!/[\u4e00-\u9fff]/.test(hoursPipeAllSame), "Must not contain Chinese characters");

// Pipe-delimited string with Closed on Mon (Row 3: Sushi Umi)
const hoursPipeClosedMon = formatOpeningHoursEnglish(
  "Mon: Closed | 星期二: 11:30-22:00 | 星期三: 11:30-22:00 | 星期四: 11:30-22:00 | 星期五: 11:30-22:00 | 星期六: 11:30-22:00 | 星期日: 11:30-22:00"
);
assert.equal(hoursPipeClosedMon, "Mon: Closed, Tue-Sun: 11:30-22:00");
assert.ok(!/[\u4e00-\u9fff]/.test(hoursPipeClosedMon), "Must not contain Chinese characters");

// Pipe-delimited with split shifts (Row 7: Akoya Izakaya)
const hoursPipeSplit = formatOpeningHoursEnglish(
  "Mon: 11:00-14:30, 17:00-22:30 | 星期二: 11:00-14:30, 17:00-22:30 | 星期三: 11:00-14:30, 17:00-22:30 | 星期四: 11:00-14:30, 17:00-22:30 | 星期五: 11:00-14:30, 17:00-22:30 | 星期六: 11:00-14:30, 17:00-22:30 | 星期日: 11:00-14:30, 17:00-22:30"
);
assert.equal(hoursPipeSplit, "Mon-Sun: 11:00-14:30, 17:00-22:30");
assert.ok(!/[\u4e00-\u9fff]/.test(hoursPipeSplit), "Must not contain Chinese characters");

// Pipe-delimited with varied shifts (Row 8: Pizza Pizza)
const hoursPipeVaried = formatOpeningHoursEnglish(
  "Mon: 11:00-02:00 | 星期二: 11:00-02:00 | 星期三: 11:00-02:00 | 星期四: 11:00-03:00 | 星期五: 11:00-03:00 | 星期六: 11:00-03:00 | 星期日: 11:00-02:00"
);
assert.equal(hoursPipeVaried, "Mon-Wed: 11:00-02:00, Thu-Sat: 11:00-03:00, Sun: 11:00-02:00");
assert.ok(!/[\u4e00-\u9fff]/.test(hoursPipeVaried), "Must not contain Chinese characters");

console.log("All English Export tests passed successfully!");
