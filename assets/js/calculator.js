/**
 * Green Oil Pure Frontend Oil Consumption Calculator
 */

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

  init() {
    this.bindEvents();
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

    this.latestResult = {
      totalMonthlyLiters,
      standardDrums,
      ucoRecoveryLiters,
      recyclingDrums55Gal,
      pickupAdvice,
      restaurantName: this.currentRestaurant ? this.currentRestaurant.name : "普通餐馆"
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

    const { totalMonthlyLiters, standardDrums, ucoRecoveryLiters, pickupAdvice, restaurantName } = this.latestResult;
    const text = [
      `【用油测算】`,
      `餐馆：${restaurantName}`,
      `炸锅：${this.fryers.length} 个 (平均 ${(this.fryers.reduce((s,f)=>s+f.capacity,0)/this.fryers.length).toFixed(0)}L)`,
      `更换频率：每 ${this.frequency.days} 天 ${this.frequency.times} 次 (每次 ${this.frequency.fryerCount} 锅)`,
      `月耗油量：${totalMonthlyLiters} 升 (约 ${standardDrums} 桶 16L)`,
      `预估月废油：${ucoRecoveryLiters} 升`,
      `建议方案：${pickupAdvice}`
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      alert("已复制测算结果");
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
