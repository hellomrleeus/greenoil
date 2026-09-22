import assert from "node:assert/strict";

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const CJK_ALL_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g;

export function toEnglishRestaurantName(name, nameEn) {
  if (nameEn && nameEn.trim() && /[a-zA-Z]/.test(nameEn)) {
    const cleaned = nameEn.replace(CJK_ALL_REGEX, " ").replace(/\s+/g, " ").trim();
    if (/[a-zA-Z]/.test(cleaned)) return cleaned;
  }
  if (!name || typeof name !== "string") return "N/A";

  if (/[a-zA-Z]/.test(name)) {
    let en = name;
    en = en.replace(/（/g, " (").replace(/）/g, ") ").replace(/【/g, " [").replace(/】/g, "] ");
    en = en.replace(/([a-zA-Z0-9])\(/g, "$1 (");
    en = en.replace(CJK_ALL_REGEX, " ");
    en = en.replace(/\(\s*\)/g, " ").replace(/\[\s*\]/g, " ");
    en = en.replace(/\s+/g, " ").trim();
    en = en.replace(/^[-–—,;:.\s&]+|[-–—,;:.\s&]+$/g, "");
    if (en && /[a-zA-Z]/.test(en)) {
      return en;
    }
  }
  return name.trim();
}

export function toChineseRestaurantName(name, nameZh, nameEn) {
  if (nameZh && CJK_REGEX.test(nameZh)) {
    return nameZh.trim();
  }
  if (!name || typeof name !== "string") return nameEn || "未命名餐馆";

  if (CJK_REGEX.test(name)) {
    if (/[a-zA-Z]/.test(name)) {
      let zh = name.replace(/（/g, " (").replace(/）/g, ") ").replace(/【/g, " [").replace(/】/g, "] ");
      zh = zh.replace(/[a-zA-Z][a-zA-Z0-9'’&.\s-]*[a-zA-Z0-9]/g, " ");
      zh = zh.replace(/[a-zA-Z]/g, " ");
      zh = zh.replace(/\(\s*\)/g, " ").replace(/\[\s*\]/g, " ");
      zh = zh.replace(/\s*&\s*/g, " ");
      zh = zh.replace(/\s+/g, " ").trim();
      zh = zh.replace(/^[-–—,;:.\s&]+|[-–—,;:.\s&]+$/g, "");
      zh = zh.replace(/^\s*[\(\[（【]\s*/, "").replace(/\s*[\)\]）】]\s*$/, "").trim();
      if (CJK_REGEX.test(zh)) {
        return zh;
      }
    }
    return name.trim();
  }

  // Western restaurant or no Chinese characters
  return name.trim();
}

export function getRestaurantDisplayName(restaurant, lang = "zh") {
  if (!restaurant) return "";
  const name = typeof restaurant === "string" ? restaurant : (restaurant.name || "");
  const nameEn = typeof restaurant === "object" ? (restaurant.nameEn || "") : "";
  const nameZh = typeof restaurant === "object" ? (restaurant.nameZh || "") : "";
  const isZh = (lang || "").toLowerCase().startsWith("zh");

  return isZh ? toChineseRestaurantName(name, nameZh, nameEn) : toEnglishRestaurantName(name, nameEn);
}

const testCases = [
  {
    name: "Miss Qu Barbecue & Restaurant 曲小姐江湖菜烧烤酒馆",
    nameEn: null,
    expectedEn: "Miss Qu Barbecue & Restaurant",
    expectedZh: "曲小姐江湖菜烧烤酒馆"
  },
  {
    name: "马记牛羊馆 Whole Sheep Feast Restaurant",
    nameEn: null,
    expectedEn: "Whole Sheep Feast Restaurant",
    expectedZh: "马记牛羊馆"
  },
  {
    name: "肠酒烧烤&Changjiu BBQ Restaurant",
    nameEn: null,
    expectedEn: "Changjiu BBQ Restaurant",
    expectedZh: "肠酒烧烤"
  },
  {
    name: "Zao Men Kan 灶门坎烧烤小酒馆",
    nameEn: null,
    expectedEn: "Zao Men Kan",
    expectedZh: "灶门坎烧烤小酒馆"
  },
  {
    name: "福记全羊馆",
    nameEn: null,
    expectedEn: "福记全羊馆",
    expectedZh: "福记全羊馆"
  },
  {
    name: "Yang's Braised Chicken Rice(First Markham Place)杨铭宇黄焖鸡米饭",
    nameEn: null,
    expectedEn: "Yang's Braised Chicken Rice (First Markham Place)",
    expectedZh: "杨铭宇黄焖鸡米饭"
  },
  {
    name: "Congee Queen 皇后名粥",
    nameEn: null,
    expectedEn: "Congee Queen",
    expectedZh: "皇后名粥"
  },
  {
    name: "Dayali (大鸭梨)",
    nameEn: null,
    expectedEn: "Dayali",
    expectedZh: "大鸭梨"
  },
  {
    name: "御品",
    nameEn: "Kingsfield Chinese Cuisine",
    expectedEn: "Kingsfield Chinese Cuisine",
    expectedZh: "御品"
  },
  {
    name: "Popeyes Louisiana Kitchen",
    nameEn: null,
    expectedEn: "Popeyes Louisiana Kitchen",
    expectedZh: "Popeyes Louisiana Kitchen"
  },
  {
    name: "Little Caesars Pizza",
    nameEn: null,
    expectedEn: "Little Caesars Pizza",
    expectedZh: "Little Caesars Pizza"
  },
  {
    name: "气泡眼",
    nameEn: "Popeyes Louisiana Kitchen",
    expectedEn: "Popeyes Louisiana Kitchen",
    expectedZh: "气泡眼"
  }
];

testCases.forEach((tc, idx) => {
  const en = getRestaurantDisplayName(tc, "en");
  const zh = getRestaurantDisplayName(tc, "zh");
  console.log(`[#${idx + 1}] Input: "${tc.name}"`);
  console.log(`       EN -> "${en}" (expected: "${tc.expectedEn}")`);
  console.log(`       ZH -> "${zh}" (expected: "${tc.expectedZh}")`);
  assert.equal(en, tc.expectedEn, `EN mismatch for ${tc.name}`);
  assert.equal(zh, tc.expectedZh, `ZH mismatch for ${tc.name}`);
});

console.log("\nALL RESTAURANT NAME LOCALIZATION TESTS PASSED!");
