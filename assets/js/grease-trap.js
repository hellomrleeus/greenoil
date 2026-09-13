/**
 * Green Oil Grease Trap Cleaning Workbench Module
 */

const GALLON_TO_LITER = 3.78541;

export function formatTrapSize(gal) {
  const liters = Math.round(gal * GALLON_TO_LITER);
  return `${liters} 升 (${gal} 加仑)`;
}

// 隔油池清洁收费矩阵 (单位: 加仑 -> CAD税前价格)
// 依据安省持牌标准：税前价 + 13% HST = 税后合计
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
  frequencyIntervalMonths: 1, // 每 1 个月、2 个月、3 个月
  currentRestaurant: null,
  latestResult: null,

  init() {
    this.bindEvents();
    this.renderSizes();
    this.calculate();
  },

  bindEvents() {
    // Trap Count Buttons
    const countBtns = document.querySelectorAll(".trap-count-btn");
    countBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        countBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.count = parseInt(btn.dataset.count, 10) || 1;
        this.renderSizes();
        this.calculate();
      });
    });

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
    const specSummary = `${this.count} 个 · ${sizeLiters} 升 (${this.size} 加仑)`;

    const elTotal = document.getElementById("gtResTotal");
    const elPrice = document.getElementById("gtResPrice");
    const elTax = document.getElementById("gtResTax");
    const elSpec = document.getElementById("gtResSpecText");
    const elAnnual = document.getElementById("gtResAnnualTotal");

    if (elTotal) elTotal.textContent = `$${total.toFixed(2)}`;
    if (elPrice) elPrice.textContent = `$${price.toFixed(2)}`;
    if (elTax) elTax.textContent = `$${tax.toFixed(2)}`;
    if (elSpec) elSpec.textContent = specSummary;
    if (elAnnual) elAnnual.textContent = `$${annualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 年`;

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
      restaurantName: this.currentRestaurant ? this.currentRestaurant.name : "普通餐馆"
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
      badge.innerHTML = `餐馆：<b>${restaurant.name}</b> <button onclick="window.clearTrapRestaurant()" style="background:none; border:none; color:white; cursor:pointer; margin-left:6px;">✕</button>`;
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
      alert("请先计算");
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
      cleansPerYear,
      annualTotal,
      restaurantName
    } = this.latestResult;

    const freqDesc = frequencyMonths === 1 
      ? "每月清洗 1 次 (全年 12 次)" 
      : (frequencyMonths === 2 ? "每 2 个月清洗 1 次 (全年 6 次)" : "每季度清洗 1 次 (全年 4 次)");

    const lines = [
      `【Green Oil 隔油池清洁专业报价单】`,
      `客户/餐馆：${restaurantName}`,
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
      `2. 出具大多伦多市政卫生与水务局认可的标准化排污维保记录单`,
      `3. 100% 满足 Ontario Building Code 与 Municipal Sewer Use Bylaw 环保要求`,
      `----------------------------------------`,
      `* 报价仅供参考，具体以现场管线勘测与服务协议为准。`
    ];

    const text = lines.join("\n");

    navigator.clipboard.writeText(text).then(() => {
      alert("已复制隔油池清洁报价单");
    }).catch(() => {
      prompt("复制内容：", text);
    });
  }
};

window.clearTrapRestaurant = function() {
  GreaseTrap.clearRestaurant();
};

window.importRestaurantToGreaseTrap = function(restaurant) {
  if (window.switchTab) {
    window.switchTab("tab-greasetrap");
  }
  GreaseTrap.setRestaurant(restaurant);
};
