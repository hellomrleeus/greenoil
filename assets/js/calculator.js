/**
 * Green Oil Pure Frontend Oil Consumption & Grease Trap Cleaning Calculator
 */

const GALLON_TO_LITER = 3.78541;

export function formatTrapSize(gal) {
  const liters = Math.round(gal * GALLON_TO_LITER);
  return `${liters} 升 (${gal} 加仑)`;
}

// 隔油池清洁价格矩阵 (单位: 加仑 -> CAD税前价格)
// 依据安省实付收费标准：税前价 + 13% HST = 税后合计
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
  greaseTrap: {
    enabled: true,
    count: 1,
    size: 25
  },
  currentRestaurant: null,
  latestResult: null,

  init() {
    this.bindEvents();
    this.populateTrapSizes(this.greaseTrap.count, this.greaseTrap.size);
    this.bindTrapEvents();
    this.renderFryers();
    this.calculate();
  },

  bindEvents() {
    const btnAddFryer = document.getElementById("btnAddFryer");
    if (btnAddFryer) {
      btnAddFryer.addEventListener("click", () => this.addFryer());
    }

    this.setupPureNumberInput("freqDays", (val) => {
      this.frequency.days = Math.max(1, parseInt(val, 10) || 1);
    });

    this.setupPureNumberInput("freqTimes", (val) => {
      this.frequency.times = Math.max(1, parseInt(val, 10) || 1);
    });

    this.setupPureNumberInput("freqFryers", (val) => {
      this.frequency.fryerCount = Math.max(1, parseInt(val, 10) || 1);
      this.validateFryerCount();
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

  bindTrapEvents() {
    const chkEnabled = document.getElementById("chkGreaseTrap");
    const countSelect = document.getElementById("trapCountSelect");
    const sizeSelect = document.getElementById("trapSizeSelect");
    const controlsWrap = document.getElementById("greaseTrapControls");
    const priceCard = document.getElementById("trapPriceCard");

    if (chkEnabled) {
      chkEnabled.addEventListener("change", (e) => {
        this.greaseTrap.enabled = e.target.checked;
        if (controlsWrap) {
          controlsWrap.classList.toggle("disabled", !this.greaseTrap.enabled);
        }
        if (priceCard) {
          priceCard.classList.toggle("disabled", !this.greaseTrap.enabled);
        }
        this.calculate();
      });
    }

    if (countSelect) {
      countSelect.addEventListener("change", (e) => {
        const count = parseInt(e.target.value, 10) || 1;
        this.greaseTrap.count = count;
        this.populateTrapSizes(count);
        this.calculate();
      });
    }

    if (sizeSelect) {
      sizeSelect.addEventListener("change", (e) => {
        const size = parseInt(e.target.value, 10);
        this.greaseTrap.size = size;
        this.calculate();
      });
    }
  },

  populateTrapSizes(count, preferredSize = null) {
    const sizeSelect = document.getElementById("trapSizeSelect");
    if (!sizeSelect) return;

    const sizesObj = GREASE_TRAP_PRICES[count] || GREASE_TRAP_PRICES[1];
    const availableSizes = Object.keys(sizesObj).map(Number).sort((a, b) => a - b);

    let currentSelected = preferredSize || this.greaseTrap.size;
    if (!availableSizes.includes(currentSelected)) {
      currentSelected = availableSizes[0];
    }
    this.greaseTrap.size = currentSelected;

    sizeSelect.innerHTML = availableSizes.map(gal => {
      const label = formatTrapSize(gal);
      const isSelected = gal === currentSelected ? "selected" : "";
      return `<option value="${gal}" ${isSelected}>${label}</option>`;
    }).join("");
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
    this.fryers.push({
      id: this.nextFryerId++,
      capacity: capacity
    });
    this.renderFryers();
    this.validateFryerCount();
  },

  removeFryer(id) {
    if (this.fryers.length <= 1) {
      alert("至少保留 1 个炸锅");
      return;
    }
    this.fryers = this.fryers.filter(f => f.id !== id);
    this.renderFryers();
    this.validateFryerCount();
  },

  updateCapacity(id, value) {
    const num = Math.max(1, parseFloat(value) || 0);
    const fryer = this.fryers.find(f => f.id === id);
    if (fryer) {
      fryer.capacity = num;
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

    container.innerHTML = this.fryers.map((f, index) => {
      return `
        <div class="fryer-item" data-id="${f.id}">
          <span class="fryer-badge">炸锅 #${index + 1}</span>
          <div class="fryer-input-wrap">
            <input 
              type="text" 
              inputmode="decimal" 
              class="form-input fryer-capacity-input" 
              value="${f.capacity}" 
              data-id="${f.id}"
              placeholder="容量"
            />
            <span class="fryer-unit">升</span>
          </div>
          ${this.fryers.length > 1 ? `
            <button class="btn btn-danger btn-sm" onclick="window.removeFryerItem(${f.id})" title="删除">
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
    if (totalEl) totalEl.textContent = `${this.fryers.length} 个`;

    this.validateFryerCount();
  },

  calculate(isUserClick = false) {
    const { days, times, fryerCount } = this.frequency;

    if (!days || days <= 0 || !times || times <= 0 || !fryerCount || fryerCount <= 0) {
      if (isUserClick) alert("请输入有效的周期与数值");
      return;
    }

    // 用油量与废油测算
    const totalCap = this.fryers.reduce((sum, f) => sum + (Number(f.capacity) || 0), 0);
    const avgCap = this.fryers.length > 0 ? totalCap / this.fryers.length : 20;

    const monthlyChanges = 30 * (times / days);
    const oilPerChange = fryerCount * avgCap;
    const totalMonthlyLiters = Math.round(monthlyChanges * oilPerChange);

    const standardDrums = (totalMonthlyLiters / 16).toFixed(1);
    const ucoRecoveryLiters = Math.round(totalMonthlyLiters * 0.75);
    const recyclingDrums55Gal = (ucoRecoveryLiters / 208).toFixed(1);

    let pickupAdvice = "配置 1 个标准桶，每月回收 1 次";
    if (ucoRecoveryLiters >= 600) {
      pickupAdvice = "配置 2-3 个 55加仑桶，每 1-2 周回收 1 次";
    } else if (ucoRecoveryLiters >= 250) {
      pickupAdvice = "配置 1-2 个 55加仑桶，每 2-3 周回收 1 次";
    }

    const resMonthly = document.getElementById("resMonthlyOil");
    if (resMonthly) resMonthly.textContent = totalMonthlyLiters.toLocaleString();

    const resDrums = document.getElementById("resStandardDrums");
    if (resDrums) resDrums.textContent = `${standardDrums} 桶`;

    const resUco = document.getElementById("resUcoRecovery");
    if (resUco) resUco.textContent = `${ucoRecoveryLiters.toLocaleString()} 升`;

    const res55Gal = document.getElementById("res55GalDrums");
    if (res55Gal) res55Gal.textContent = `约 ${recyclingDrums55Gal} 桶`;

    const resAdvice = document.getElementById("resPickupAdvice");
    if (resAdvice) resAdvice.textContent = pickupAdvice;

    // 隔油池清洁费用测算
    let trapPrice = 0;
    let trapTax = 0;
    let trapTotal = 0;
    const trapCount = this.greaseTrap.count;
    const trapSizeGal = this.greaseTrap.size;
    const trapSizeLiters = Math.round(trapSizeGal * GALLON_TO_LITER);
    const trapEnabled = this.greaseTrap.enabled;

    if (trapEnabled) {
      const countPrices = GREASE_TRAP_PRICES[trapCount] || {};
      trapPrice = countPrices[trapSizeGal] || 0;
      trapTax = +(trapPrice * 0.13).toFixed(2);
      trapTotal = +(trapPrice + trapTax).toFixed(2);
    }

    const resTrapPrice = document.getElementById("resTrapPrice");
    const resTrapTax = document.getElementById("resTrapTax");
    const resTrapTotal = document.getElementById("resTrapTotal");
    const resTrapSpecPill = document.getElementById("resTrapSpecPill");

    if (resTrapPrice) {
      resTrapPrice.textContent = trapEnabled ? `$${trapPrice.toFixed(2)}` : "--";
    }
    if (resTrapTax) {
      resTrapTax.textContent = trapEnabled ? `$${trapTax.toFixed(2)}` : "--";
    }
    if (resTrapTotal) {
      resTrapTotal.textContent = trapEnabled ? `$${trapTotal.toFixed(2)}` : "未启用";
    }
    if (resTrapSpecPill) {
      if (trapEnabled) {
        resTrapSpecPill.textContent = `规格：${trapCount} 个隔油池 · ${trapSizeLiters} 升 (${trapSizeGal} 加仑)`;
      } else {
        resTrapSpecPill.textContent = "当前未勾选隔油池清洗服务";
      }
    }

    this.latestResult = {
      totalMonthlyLiters,
      standardDrums,
      ucoRecoveryLiters,
      recyclingDrums55Gal,
      pickupAdvice,
      restaurantName: this.currentRestaurant ? this.currentRestaurant.name : "普通餐馆",
      trapEnabled,
      trapCount,
      trapSizeGal,
      trapSizeLiters,
      trapPrice,
      trapTax,
      trapTotal
    };

    if (isUserClick) {
      this.animateResult();
    }
  },

  animateResult() {
    const card = document.querySelector(".calc-results-card");
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
    this.greaseTrap = { enabled: true, count: 1, size: 25 };

    const inDays = document.getElementById("freqDays");
    const inTimes = document.getElementById("freqTimes");
    const inFryers = document.getElementById("freqFryers");
    if (inDays) inDays.value = 7;
    if (inTimes) inTimes.value = 2;
    if (inFryers) inFryers.value = 2;

    const chkTrap = document.getElementById("chkGreaseTrap");
    const countSelect = document.getElementById("trapCountSelect");
    const controlsWrap = document.getElementById("greaseTrapControls");
    const priceCard = document.getElementById("trapPriceCard");

    if (chkTrap) chkTrap.checked = true;
    if (countSelect) countSelect.value = "1";
    if (controlsWrap) controlsWrap.classList.remove("disabled");
    if (priceCard) priceCard.classList.remove("disabled");

    this.populateTrapSizes(1, 25);
    this.renderFryers();
    this.calculate();
  },

  setRestaurant(restaurant) {
    this.currentRestaurant = restaurant;
    const badge = document.getElementById("calcTargetRestBadge");
    if (badge) {
      badge.innerHTML = `餐馆：<b>${restaurant.name}</b> <button onclick="window.clearCalcRestaurant()" style="background:none; border:none; color:white; cursor:pointer; margin-left:6px;">✕</button>`;
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
      alert("请先计算");
      return;
    }

    const { 
      totalMonthlyLiters, 
      standardDrums, 
      ucoRecoveryLiters, 
      recyclingDrums55Gal,
      pickupAdvice, 
      restaurantName,
      trapEnabled,
      trapCount,
      trapSizeGal,
      trapSizeLiters,
      trapPrice,
      trapTax,
      trapTotal
    } = this.latestResult;

    const lines = [
      `【Green Oil 环保回收与隔油池清洁测算】`,
      `餐馆名称：${restaurantName}`,
      `----------------------------------------`,
      `[用油与废油预估]`,
      `· 炸锅配置：${this.fryers.length} 个炸锅 (均容 ${(this.fryers.reduce((s,f)=>s+f.capacity,0)/this.fryers.length).toFixed(0)} 升)`,
      `· 更换频率：每 ${this.frequency.days} 天 ${this.frequency.times} 次 (每次换 ${this.frequency.fryerCount} 锅)`,
      `· 预计月用油：${totalMonthlyLiters} 升 (约 ${standardDrums} 桶 16L 商用油)`,
      `· 预计月废油回收：${ucoRecoveryLiters} 升 (约 ${recyclingDrums55Gal} 桶 55加仑标准桶)`,
      `· 废油回收方案：${pickupAdvice}`,
      `----------------------------------------`
    ];

    if (trapEnabled) {
      lines.push(
        `[隔油池清洁服务]`,
        `· 隔油池配置：${trapCount} 个隔油池`,
        `· 规格容量：${trapSizeLiters} 升 (${trapSizeGal} 加仑)`,
        `· 税前服务费：$${trapPrice.toFixed(2)} CAD`,
        `· 安省税 (HST 13%)：$${trapTax.toFixed(2)} CAD`,
        `· 清洁税后合计：$${trapTotal.toFixed(2)} CAD`,
        `· 维保建议：隔油池建议每 1-3 个月定期清洗，确保持续符合市政排污环保标准。`
      );
    } else {
      lines.push(
        `[隔油池清洁服务]：未包含`
      );
    }

    lines.push(`----------------------------------------\n* 测算报价仅供参考，实际以现场勘测及服务协议为准。`);

    const text = lines.join("\n");

    navigator.clipboard.writeText(text).then(() => {
      alert("已复制完整测算与报价结果");
    }).catch(() => {
      prompt("复制内容：", text);
    });
  }
};

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
