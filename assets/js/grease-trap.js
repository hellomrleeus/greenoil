/**
 * Green Oil Grease Trap Cleaning Workbench Module
 */

import { i18n } from "./i18n.js";

const GALLON_TO_LITER = 3.78541;

export function formatTrapSize(gal) {
  const liters = Math.round(gal * GALLON_TO_LITER);
  const currentLang = i18n.getLanguage();
  if (currentLang === "en") {
    return `${liters} L (${gal} Gal)`;
  } else if (currentLang === "ko") {
    return `${liters} L (${gal} 갤런)`;
  }
  return `${liters} 升 (${gal} 加仑)`;
}

// Grease trap cleaning pricing matrix (Gallons -> CAD Pre-tax)
// Conforming to Ontario standards: Pre-tax + 13% HST = Total
export const GREASE_TRAP_PRICES = {
  1: {
    25: 100, 30: 110, 40: 120, 50: 130, 60: 140, 70: 150, 80: 160, 90: 170,
    100: 180, 110: 190, 120: 200, 130: 210, 140: 220, 150: 230, 160: 240,
    170: 250, 180: 260, 190: 270, 200: 280, 210: 290, 220: 300, 230: 310,
    240: 320, 250: 330
  },
  2: {
    50: 170, 60: 180, 70: 190, 80: 200, 90: 210, 100: 220, 110: 230,
    120: 240, 130: 250, 140: 260, 150: 270, 160: 280, 170: 290, 180: 300,
    190: 310, 200: 320
  },
  3: {
    80: 210, 90: 220, 100: 230, 110: 240, 120: 250, 130: 260, 140: 270,
    150: 280, 160: 290, 170: 300, 180: 310, 190: 320, 200: 330
  },
  4: {
    100: 280, 110: 290, 120: 300, 130: 310, 140: 320, 150: 330, 160: 340,
    170: 350, 180: 360, 190: 370, 200: 380
  }
};

export const GreaseTrap = {
  count: 1,
  size: 25,
  frequencyIntervalMonths: 1, // 1 month, 2 months, 3 months
  currentRestaurant: null,
  latestResult: null,

  init() {
    this.bindEvents();
    this.renderCountPills();
    this.renderSizes();
    this.calculate();

    i18n.onLanguageChange(() => {
      this.renderCountPills();
      this.renderSizes();
      this.calculate();
      if (this.currentRestaurant) {
        this.setRestaurant(this.currentRestaurant);
      }
    });
  },

  bindEvents() {
    // Trap Count Buttons
    const countContainer = document.getElementById("trapCountPills");
    if (countContainer) {
      countContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".trap-count-btn");
        if (!btn) return;
        document.querySelectorAll(".trap-count-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.count = parseInt(btn.dataset.count, 10) || 1;
        this.renderSizes();
        this.calculate();
      });
    }

    // Trap Size Select
    const sizeSelect = document.getElementById("gtTrapSizeSelect");
    if (sizeSelect) {
      sizeSelect.addEventListener("change", (e) => {
        this.size = parseInt(e.target.value, 10);
        this.calculate();
      });
    }

    // Clean Frequency Select
    const freqSelect = document.getElementById("gtCleanFrequency");
    if (freqSelect) {
      freqSelect.addEventListener("change", (e) => {
        this.frequencyIntervalMonths = parseInt(e.target.value, 10) || 1;
        this.calculate();
      });
    }

    // Buttons
    const btnCalc = document.getElementById("btnCalculateTrap");
    if (btnCalc) {
      btnCalc.addEventListener("click", () => this.calculate(true));
    }

    const btnReset = document.getElementById("btnResetTrap");
    if (btnReset) {
      btnReset.addEventListener("click", () => this.resetDefaults());
    }

    const btnCopy = document.getElementById("btnCopyTrapQuote");
    if (btnCopy) {
      btnCopy.addEventListener("click", () => this.copyQuoteText());
    }
  },

  renderCountPills() {
    const btns = document.querySelectorAll(".trap-count-btn");
    btns.forEach(btn => {
      const c = btn.dataset.count;
      btn.textContent = i18n.t("trap_count_n", { n: c });
      btn.classList.toggle("active", parseInt(c, 10) === this.count);
    });
  },

  renderSizes(preferredSize = null) {
    const sizeSelect = document.getElementById("gtTrapSizeSelect");
    if (!sizeSelect) return;

    const sizesObj = GREASE_TRAP_PRICES[this.count] || GREASE_TRAP_PRICES[1];
    const availableSizes = Object.keys(sizesObj).map(Number).sort((a, b) => a - b);

    let currentSelected = preferredSize || this.size;
    if (!availableSizes.includes(currentSelected)) {
      currentSelected = availableSizes[0];
    }
    this.size = currentSelected;

    sizeSelect.innerHTML = availableSizes.map(gal => {
      const label = formatTrapSize(gal);
      const isSelected = gal === currentSelected ? "selected" : "";
      return `<option value="${gal}" ${isSelected}>${label}</option>`;
    }).join("");
  },

  calculate(animate = false) {
    const countPrices = GREASE_TRAP_PRICES[this.count] || {};
    const price = countPrices[this.size] || 100;
    const tax = +(price * 0.13).toFixed(2);
    const total = +(price + tax).toFixed(2);

    // Annual expenditure estimate (12 months / interval)
    const cleansPerYear = Math.round(12 / this.frequencyIntervalMonths);
    const annualTotal = +(total * cleansPerYear).toFixed(2);

    const sizeLiters = Math.round(this.size * GALLON_TO_LITER);
    const currentLang = i18n.getLanguage();
    let specSummary = "";
    if (currentLang === "en") {
      specSummary = `${this.count} unit(s) · ${sizeLiters} L (${this.size} Gal)`;
    } else if (currentLang === "ko") {
      specSummary = `${this.count}개 · ${sizeLiters} L (${this.size} 갤런)`;
    } else {
      specSummary = `${this.count} 个 · ${sizeLiters} 升 (${this.size} 加仑)`;
    }

    const elTotal = document.getElementById("gtResTotal");
    const elPrice = document.getElementById("gtResPrice");
    const elTax = document.getElementById("gtResTax");
    const elSpec = document.getElementById("gtResSpecText");
    const elAnnual = document.getElementById("gtResAnnualTotal");

    if (elTotal) elTotal.textContent = `$${total.toFixed(2)}`;
    if (elPrice) elPrice.textContent = `$${price.toFixed(2)}`;
    if (elTax) elTax.textContent = `$${tax.toFixed(2)}`;
    if (elSpec) elSpec.textContent = specSummary;
    if (elAnnual) elAnnual.textContent = `$${annualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${i18n.t("trap_per_year")}`;

    this.latestResult = {
      price,
      tax,
      total,
      count: this.count,
      sizeGal: this.size,
      sizeLiters,
      frequencyMonths: this.frequencyIntervalMonths,
      cleansPerYear,
      annualTotal,
      restaurantName: this.currentRestaurant ? this.currentRestaurant.name : ""
    };

    if (animate) {
      const card = document.querySelector("#tab-greasetrap .calc-results-card");
      if (card) {
        card.style.transition = "transform 0.15s ease";
        card.style.transform = "scale(1.02)";
        setTimeout(() => {
          card.style.transform = "scale(1)";
        }, 150);
      }
    }
  },

  resetDefaults() {
    this.count = 1;
    this.size = 25;
    this.frequencyIntervalMonths = 1;

    const countBtns = document.querySelectorAll(".trap-count-btn");
    countBtns.forEach(b => {
      b.classList.toggle("active", b.dataset.count === "1");
    });

    const freqSelect = document.getElementById("gtCleanFrequency");
    if (freqSelect) freqSelect.value = "1";

    this.renderSizes(25);
    this.calculate();
  },

  setRestaurant(restaurant) {
    this.currentRestaurant = restaurant;
    const badge = document.getElementById("trapTargetRestBadge");
    if (badge) {
      const prefix = i18n.t("calc_linked_rest");
      badge.innerHTML = `${prefix}：<b>${restaurant.name}</b> <button onclick="window.clearTrapRestaurant()" style="background:none; border:none; color:white; cursor:pointer; margin-left:6px;">✕</button>`;
      badge.style.display = "inline-flex";
    }
    this.calculate();
  },

  clearRestaurant() {
    this.currentRestaurant = null;
    const badge = document.getElementById("trapTargetRestBadge");
    if (badge) badge.style.display = "none";
    this.calculate();
  },

  copyQuoteText() {
    if (!this.latestResult) {
      alert(i18n.t("alert_calc_first"));
      return;
    }

    const {
      price,
      tax,
      total,
      count,
      sizeGal,
      sizeLiters,
      frequencyMonths,
      annualTotal,
      restaurantName
    } = this.latestResult;

    const currentLang = i18n.getLanguage();
    let text = "";

    if (currentLang === "en") {
      const restDisplay = restaurantName || "Standard Restaurant";
      const freqDesc = frequencyMonths === 1 
        ? "Once a month (12 services / year)" 
        : (frequencyMonths === 2 ? "Every 2 months (6 services / year)" : "Every quarter (4 services / year)");

      const lines = [
        `[Green Oil Commercial Grease Trap Cleaning Quote]`,
        `Client / Restaurant: ${restDisplay}`,
        `----------------------------------------`,
        `[Grease Trap Specifications]`,
        `· Interceptor Count: ${count} unit(s)`,
        `· Capacity per Trap: ${sizeLiters} L (${sizeGal} Gallons)`,
        `· Recommended Frequency: ${freqDesc}`,
        `----------------------------------------`,
        `[Pricing Schedule (CAD)]`,
        `· Service Fee (Pre-tax): $${price.toFixed(2)}`,
        `· Ontario HST (13%): $${tax.toFixed(2)}`,
        `· Total per Service (Tax incl.): $${total.toFixed(2)}`,
        `· Est. Annual Maintenance Budget: $${annualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / yr`,
        `----------------------------------------`,
        `[Compliance & Service Standards]`,
        `1. Full vacuum pump-out of grease cap and heavy bottom sludge, followed by high-pressure wall scraping`,
        `2. 100% compliant with Ontario Building Code & Municipal Sewer Use Bylaws`,
        `----------------------------------------`,
        `* Quote is for reference. Final pricing subject to on-site pipeline inspection and service agreement.`
      ];
      text = lines.join("\n");
    } else if (currentLang === "ko") {
      const restDisplay = restaurantName || "일반 식당";
      const freqDesc = frequencyMonths === 1 
        ? "매월 1회 (연간 12회)" 
        : (frequencyMonths === 2 ? "2개월마다 1회 (연간 6회)" : "분기별 1회 (연간 4회)");

      const lines = [
        `[Green Oil 그리스 트랩 전문 세척 견적서]`,
        `고객 / 식당명: ${restDisplay}`,
        `----------------------------------------`,
        `[그리스 트랩 규격 사양]`,
        `· 트랩 수량: ${count}개`,
        `· 개별 트랩 용량: ${sizeLiters} L (${sizeGal} 갤런)`,
        `· 권장 세척 주기: ${freqDesc}`,
        `----------------------------------------`,
        `[청소 요금 기준 (CAD)]`,
        `· 세전 1회 서비스 요금: $${price.toFixed(2)}`,
        `· 온타리오주 세금 (13% HST): $${tax.toFixed(2)}`,
        `· 1회 최종 결제 금액 (세금 포함): $${total.toFixed(2)}`,
        `· 연간 예상 유지보수 예산: $${annualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 년`,
        `----------------------------------------`,
        `[서비스 보증 및 환경 규정 준수]`,
        `1. 상부 유지류 및 바닥 침전 오니 100% 완전 흡입 배출 및 내벽 고압 제트 세척`,
        `2. Ontario Building Code 및 지자체 하수도 조례 완벽 준수`,
        `----------------------------------------`,
        `* 본 견적은 참고용이며, 현장 배관 상태 및 최종 서비스 계약에 따라 확정됩니다.`
      ];
      text = lines.join("\n");
    } else {
      const restDisplay = restaurantName || "普通餐馆";
      const freqDesc = frequencyMonths === 1 
        ? "每月清洗 1 次 (全年 12 次)" 
        : (frequencyMonths === 2 ? "每 2 个月清洗 1 次 (全年 6 次)" : "每季度清洗 1 次 (全年 4 次)");

      const lines = [
        `【Green Oil 隔油池清洁专业报价单】`,
        `客户/餐馆：${restDisplay}`,
        `----------------------------------------`,
        `[隔油池规格配置]`,
        `· 隔油池数量：${count} 个`,
        `· 单池容量规格：${sizeLiters} 升 (${sizeGal} 加仑)`,
        `· 建议维保频率：${freqDesc}`,
        `----------------------------------------`,
        `[收费标准 (CAD)]`,
        `· 单次税前服务费：$${price.toFixed(2)}`,
        `· 安省税金 (HST 13%)：$${tax.toFixed(2)}`,
        `· 单次税后实付总额：$${total.toFixed(2)}`,
        `· 预估年度维保预算：$${annualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 年`,
        `----------------------------------------`,
        `[服务保障与环保合规]`,
        `1. 包含彻底抽吸沉淀浮油与高压冲洗池壁`,
        `2. 100% 满足 Ontario Building Code 与 Municipal Sewer Use Bylaw 环保要求`,
        `----------------------------------------`,
        `* 报价仅供参考，具体以现场管线勘测与服务协议为准。`
      ];
      text = lines.join("\n");
    }

    navigator.clipboard.writeText(text).then(() => {
      alert(i18n.t("toast_copied_trap_quote"));
    }).catch(() => {
      prompt("Copy:", text);
    });
  }
};

if (typeof window !== "undefined") {
  window.clearTrapRestaurant = function() {
    GreaseTrap.clearRestaurant();
  };

  window.importRestaurantToGreaseTrap = function(restaurant) {
    if (window.switchTab) {
      window.switchTab("tab-greasetrap");
    }
    GreaseTrap.setRestaurant(restaurant);
  };
}
