/**
 * Green Oil Pure Frontend Oil Consumption Calculator
 */

import { i18n } from "./i18n.js";

export const Calculator = {
  fryers: [
    { id: 1, capacity: 20 },
    { id: 2, capacity: 20 }
  ],
  nextFryerId: 3,
  frequency: {
    days: 7,
    times: 2,
    fryerCount: 2
  },
  currentRestaurant: null,
  latestResult: null,

  init() {
    this.bindEvents();
    this.renderFryers();
    this.calculate();

    i18n.onLanguageChange(() => {
      this.renderFryers();
      this.calculate();
      if (this.currentRestaurant) {
        this.setRestaurant(this.currentRestaurant);
      }
    });
  },

  bindEvents() {
    const btnAddFryer = document.getElementById("btnAddFryer");
    if (btnAddFryer) {
      btnAddFryer.addEventListener("click", () => this.addFryer());
    }

    this.setupPureNumberInput("freqDays", (val) => {
      this.frequency.days = Math.max(1, parseInt(val, 10) || 1);
      this.calculate();
    });

    this.setupPureNumberInput("freqTimes", (val) => {
      this.frequency.times = Math.max(1, parseInt(val, 10) || 1);
      this.calculate();
    });

    this.setupPureNumberInput("freqFryers", (val) => {
      this.frequency.fryerCount = Math.max(1, parseInt(val, 10) || 1);
      this.validateFryerCount();
      this.calculate();
    });

    const btnCalculate = document.getElementById("btnCalculateOil");
    if (btnCalculate) {
      btnCalculate.addEventListener("click", () => {
        this.calculate(true);
      });
    }

    const btnCopyQuote = document.getElementById("btnCopyQuote");
    if (btnCopyQuote) {
      btnCopyQuote.addEventListener("click", () => this.copyQuoteText());
    }

    const btnResetCalc = document.getElementById("btnResetCalc");
    if (btnResetCalc) {
      btnResetCalc.addEventListener("click", () => this.resetDefaults());
    }
  },

  setupPureNumberInput(elementId, onChange) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.addEventListener("keypress", (e) => {
      if (!/[\d]/.test(e.key)) e.preventDefault();
    });

    el.addEventListener("input", (e) => {
      const cleanVal = e.target.value.replace(/[^\d]/g, "");
      e.target.value = cleanVal;
      if (onChange) onChange(cleanVal);
    });
  },

  addFryer(capacity = 20) {
    const prevCount = this.fryers.length;
    this.fryers.push({
      id: this.nextFryerId++,
      capacity: capacity
    });
    // When adding a fryer, if user was replacing all fryers, automatically increment fryerCount
    if (this.frequency.fryerCount >= prevCount) {
      this.frequency.fryerCount = this.fryers.length;
      const input = document.getElementById("freqFryers");
      if (input) input.value = this.fryers.length;
    }
    this.renderFryers();
    this.validateFryerCount();
    this.calculate();
  },

  removeFryer(id) {
    if (this.fryers.length <= 1) {
      alert(i18n.t("alert_at_least_one_fryer"));
      return;
    }
    const prevCount = this.fryers.length;
    this.fryers = this.fryers.filter(f => f.id !== id);
    if (this.frequency.fryerCount >= prevCount || this.frequency.fryerCount > this.fryers.length) {
      this.frequency.fryerCount = this.fryers.length;
      const input = document.getElementById("freqFryers");
      if (input) input.value = this.fryers.length;
    }
    this.renderFryers();
    this.validateFryerCount();
    this.calculate();
  },

  updateCapacity(id, value) {
    const num = Math.max(0, parseFloat(value) || 0);
    const fryer = this.fryers.find(f => f.id === id);
    if (fryer) {
      fryer.capacity = num;
      this.calculate();
    }
  },

  validateFryerCount() {
    const total = this.fryers.length;
    const input = document.getElementById("freqFryers");
    if (this.frequency.fryerCount > total) {
      this.frequency.fryerCount = total;
      if (input) input.value = total;
    }
  },

  renderFryers() {
    const container = document.getElementById("fryerListContainer");
    if (!container) return;

    const unitLiter = i18n.t("calc_unit_liter");
    const capPlaceholder = i18n.t("calc_capacity_placeholder");

    container.innerHTML = this.fryers.map((f, index) => {
      const badgeText = i18n.t("calc_fryer_badge", { index: index + 1 });
      return `
        <div class="fryer-item" data-id="${f.id}">
          <span class="fryer-badge">${badgeText}</span>
          <div class="fryer-input-wrap">
            <input 
              type="text" 
              inputmode="decimal" 
              class="form-input fryer-capacity-input" 
              value="${f.capacity}" 
              data-id="${f.id}"
              placeholder="${capPlaceholder}"
            />
            <span class="fryer-unit">${unitLiter}</span>
          </div>
          ${this.fryers.length > 1 ? `
            <button class="btn btn-danger btn-sm" onclick="window.removeFryerItem(${f.id})" title="Delete">
              ✕
            </button>
          ` : ''}
        </div>
      `;
    }).join("");

    container.querySelectorAll(".fryer-capacity-input").forEach(input => {
      input.addEventListener("keypress", (e) => {
        if (!/[\d.]/.test(e.key)) e.preventDefault();
      });
      input.addEventListener("input", (e) => {
        let val = e.target.value.replace(/[^0-9.]/g, "");
        const parts = val.split(".");
        if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
        e.target.value = val;
        const id = parseInt(input.dataset.id, 10);
        this.updateCapacity(id, val);
      });
    });

    const totalEl = document.getElementById("totalFryerCountText");
    if (totalEl) {
      totalEl.textContent = i18n.t("calc_fryer_count_unit", { count: this.fryers.length });
    }

    this.validateFryerCount();
  },

  determineContainerConfig(ucoRecoveryLiters) {
    if (ucoRecoveryLiters <= 200) {
      return {
        type: "drum",
        spec: "200L Drum",
        capacity: 200,
        count: 1,
        advice: i18n.t("advice_drum_200")
      };
    } else if (ucoRecoveryLiters <= 400) {
      return {
        type: "bin",
        spec: "400L Bin",
        capacity: 400,
        count: 1,
        advice: i18n.t("advice_bin_400")
      };
    } else if (ucoRecoveryLiters <= 600) {
      return {
        type: "bin",
        spec: "600L Bin",
        capacity: 600,
        count: 1,
        advice: i18n.t("advice_bin_600")
      };
    } else if (ucoRecoveryLiters <= 800) {
      return {
        type: "bin",
        spec: "800L Bin",
        capacity: 800,
        count: 1,
        advice: i18n.t("advice_bin_800")
      };
    } else if (ucoRecoveryLiters <= 1000) {
      return {
        type: "bin",
        spec: "1000L Bin",
        capacity: 1000,
        count: 1,
        advice: i18n.t("advice_bin_1000")
      };
    } else {
      const count = Math.ceil(ucoRecoveryLiters / 1000);
      const spec = `${count} × 1000L Bin`;
      return {
        type: "bin",
        spec: spec,
        capacity: 1000,
        count: count,
        advice: i18n.t("advice_bin_multi", { count })
      };
    }
  },

  calculate(isUserClick = false) {
    const { days, times, fryerCount } = this.frequency;

    if (!days || days <= 0 || !times || times <= 0 || !fryerCount || fryerCount <= 0) {
      if (isUserClick) alert(i18n.t("alert_invalid_input"));
      return;
    }

    // Calculation formulas
    const totalCap = this.fryers.reduce((sum, f) => sum + (Number(f.capacity) || 0), 0);
    const avgCap = this.fryers.length > 0 ? totalCap / this.fryers.length : 20;

    const monthlyChanges = 30 * (times / days);
    const oilPerChange = fryerCount * avgCap;
    const totalMonthlyLiters = Math.round(monthlyChanges * oilPerChange);

    const standardDrums = (totalMonthlyLiters / 16).toFixed(1);
    const ucoRecoveryLiters = Math.round(totalMonthlyLiters * 0.75);

    const containerConfig = this.determineContainerConfig(ucoRecoveryLiters);

    const resMonthly = document.getElementById("resMonthlyOil");
    if (resMonthly) resMonthly.textContent = totalMonthlyLiters.toLocaleString();

    const resDrums = document.getElementById("resStandardDrums");
    if (resDrums) resDrums.textContent = `${standardDrums} ${i18n.t("calc_unit_drum")}`;

    const resUco = document.getElementById("resUcoRecovery");
    if (resUco) resUco.textContent = `${ucoRecoveryLiters.toLocaleString()} ${i18n.t("calc_unit_liter")}`;

    const resContainer = document.getElementById("res200LDrums");
    if (resContainer) {
      resContainer.textContent = containerConfig.spec;
    }

    const resAdvice = document.getElementById("resPickupAdvice");
    if (resAdvice) resAdvice.textContent = containerConfig.advice;

    this.latestResult = {
      totalMonthlyLiters,
      standardDrums,
      ucoRecoveryLiters,
      containerConfig,
      pickupAdvice: containerConfig.advice,
      avgCap,
      restaurantName: this.currentRestaurant ? this.currentRestaurant.name : ""
    };

    if (isUserClick) {
      this.animateResult();
    }
  },

  animateResult() {
    const card = document.querySelector("#tab-calculator .calc-results-card");
    if (card) {
      card.style.transition = "transform 0.15s ease";
      card.style.transform = "scale(1.02)";
      setTimeout(() => {
        card.style.transform = "scale(1)";
      }, 150);
    }
  },

  resetDefaults() {
    this.fryers = [
      { id: 1, capacity: 20 },
      { id: 2, capacity: 20 }
    ];
    this.nextFryerId = 3;
    this.frequency = { days: 7, times: 2, fryerCount: 2 };

    const inDays = document.getElementById("freqDays");
    const inTimes = document.getElementById("freqTimes");
    const inFryers = document.getElementById("freqFryers");
    if (inDays) inDays.value = 7;
    if (inTimes) inTimes.value = 2;
    if (inFryers) inFryers.value = 2;

    this.renderFryers();
    this.calculate();
  },

  setRestaurant(restaurant) {
    this.currentRestaurant = restaurant;
    const badge = document.getElementById("calcTargetRestBadge");
    if (badge) {
      const prefix = i18n.t("calc_linked_rest");
      badge.innerHTML = `${prefix}：<b>${restaurant.name}</b> <button onclick="window.clearCalcRestaurant()" style="background:none; border:none; color:white; cursor:pointer; margin-left:6px;">✕</button>`;
      badge.style.display = "inline-flex";
    }
    this.calculate();
  },

  clearRestaurant() {
    this.currentRestaurant = null;
    const badge = document.getElementById("calcTargetRestBadge");
    if (badge) badge.style.display = "none";
    this.calculate();
  },

  copyQuoteText() {
    if (!this.latestResult) {
      alert(i18n.t("alert_calc_first"));
      return;
    }

    const { 
      totalMonthlyLiters, 
      standardDrums, 
      ucoRecoveryLiters, 
      containerConfig,
      pickupAdvice, 
      avgCap,
      restaurantName 
    } = this.latestResult;

    const currentLang = i18n.getLanguage();
    let text = "";

    if (currentLang === "en") {
      const restDisplay = restaurantName || "Standard Restaurant";
      const lines = [
        `[Green Oil Recycling - Cooking Oil & UCO Estimate]`,
        `Restaurant: ${restDisplay}`,
        `----------------------------------------`,
        `[Usage & Waste Oil Projection]`,
        `· Fryer Setup: ${this.fryers.length} deep fryers (Avg capacity: ${avgCap.toFixed(0)} L)`,
        `· Oil Change Frequency: Every ${this.frequency.days} days, ${this.frequency.times} times (${this.frequency.fryerCount} fryers each time)`,
        `· Est. Monthly Oil Consumption: ${totalMonthlyLiters} L (~ ${standardDrums} jugs of 16L commercial oil)`,
        `· Est. Monthly UCO Recovery: ${ucoRecoveryLiters} L (75% recovery)`,
        `· Recommended Container Setup: ${containerConfig ? containerConfig.spec : '200L Drum'}`,
        `· Recommended Pickup Plan: ${pickupAdvice}`,
        `----------------------------------------`,
        `* Estimates are for reference only. Actual specifications are subject to on-site inspection and service agreement.`
      ];
      text = lines.join("\n");
    } else if (currentLang === "ko") {
      const restDisplay = restaurantName || "일반 식당";
      const lines = [
        `[Green Oil 친환경 식용유 및 폐유 산정 견적서]`,
        `식당명: ${restDisplay}`,
        `----------------------------------------`,
        `[식용유 사용 및 폐유 수거 예상]`,
        `· 튀김기 구성: ${this.fryers.length}대 (평균 용량: ${avgCap.toFixed(0)} L)`,
        `· 기름 교체 주기: ${this.frequency.days}일마다 ${this.frequency.times}회 (회당 ${this.frequency.fryerCount}대 교체)`,
        `· 예상 월간 식용유 사용량: ${totalMonthlyLiters} L (약 ${standardDrums}캔 16L 업소용 식용유)`,
        `· 예상 월간 폐식용유 수거량: ${ucoRecoveryLiters} L (회수율 75%)`,
        `· 권장 수거용기 구성: ${containerConfig ? containerConfig.spec : '200L Drum'}`,
        `· 권장 수거 솔루션: ${pickupAdvice}`,
        `----------------------------------------`,
        `* 본 산정 결과는 참고용이며, 실제 조건은 현장 실사 및 서비스 계약서에 따릅니다.`
      ];
      text = lines.join("\n");
    } else {
      const restDisplay = restaurantName || "普通餐馆";
      const lines = [
        `【Green Oil 环保回收用油测算】`,
        `餐馆名称：${restDisplay}`,
        `----------------------------------------`,
        `[用油与废油预估]`,
        `· 炸锅配置：${this.fryers.length} 个炸锅 (均容 ${avgCap.toFixed(0)} 升)`,
        `· 更换频率：每 ${this.frequency.days} 天 ${this.frequency.times} 次 (每次换 ${this.frequency.fryerCount} 锅)`,
        `· 预计月用油：${totalMonthlyLiters} 升 (约 ${standardDrums} 桶 16L 商用油)`,
        `· 预计月废油回收：${ucoRecoveryLiters} 升 (出油率 75%)`,
        `· 推荐回收设备配置：${containerConfig ? containerConfig.spec : '200L Drum'}`,
        `· 建议回收方案：${pickupAdvice}`,
        `----------------------------------------`,
        `* 测算数据仅供参考，实际以现场勘测及回收服务协议为准。`
      ];
      text = lines.join("\n");
    }

    navigator.clipboard.writeText(text).then(() => {
      alert(i18n.t("toast_copied_oil_quote"));
    }).catch(() => {
      prompt("Copy:", text);
    });
  }
};

if (typeof window !== "undefined") {
  window.removeFryerItem = function(id) {
    Calculator.removeFryer(id);
  };

  window.clearCalcRestaurant = function() {
    Calculator.clearRestaurant();
  };

  window.importRestaurantToCalculator = function(restaurant) {
    if (window.switchTab) {
      window.switchTab("tab-calculator");
    }
    Calculator.setRestaurant(restaurant);
  };
}
