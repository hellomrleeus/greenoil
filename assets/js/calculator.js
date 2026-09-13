/**
 * Green Oil Pure Frontend Oil Consumption Calculator
 * 
 * Features:
 * - Dynamic fryer list (default 2 fryers, default 20L each, add/remove)
 * - Frequency: "每 [X] 天换 [Y] 次，每次换 [Z] 个炸锅的油"
 * - Strict pure-numeric input enforcement
 * - Monthly consumption calculation + Green Oil UCO recovery estimation
 * - History & Client Quote Copy
 */

export const Calculator = {
  fryers: [
    { id: 1, capacity: 20 },
    { id: 2, capacity: 20 }
  ],
  nextFryerId: 3,
  frequency: {
    days: 7,       // 每 X 天
    times: 2,      // 换 Y 次
    fryerCount: 2  // 每次换 Z 个炸锅
  },
  currentRestaurant: null,
  history: [],

  init() {
    this.bindEvents();
    this.renderFryers();
    this.calculate(); // initial calculation
  },

  bindEvents() {
    // Add fryer button
    const btnAddFryer = document.getElementById("btnAddFryer");
    if (btnAddFryer) {
      btnAddFryer.addEventListener("click", () => this.addFryer());
    }

    // Frequency inputs with strict pure-number enforcement
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

    // Calculate button
    const btnCalculate = document.getElementById("btnCalculateOil");
    if (btnCalculate) {
      btnCalculate.addEventListener("click", () => {
        this.calculate(true);
      });
    }

    // Copy quote button
    const btnCopyQuote = document.getElementById("btnCopyQuote");
    if (btnCopyQuote) {
      btnCopyQuote.addEventListener("click", () => this.copyQuoteText());
    }

    // Reset button
    const btnResetCalc = document.getElementById("btnResetCalc");
    if (btnResetCalc) {
      btnResetCalc.addEventListener("click", () => this.resetDefaults());
    }
  },

  /**
   * Helper to restrict input element to strictly numbers only
   */
  setupPureNumberInput(elementId, onChange) {
    const el = document.getElementById(elementId);
    if (!el) return;

    // Prevent non-numeric keypresses
    el.addEventListener("keypress", (e) => {
      if (!/[\d]/.test(e.key)) {
        e.preventDefault();
      }
    });

    // Handle paste or typing with regex cleanup
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
      alert("至少需要保留 1 个炸锅！");
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
            <span class="fryer-unit">升 (L)</span>
          </div>
          ${this.fryers.length > 1 ? `
            <button class="btn btn-danger btn-sm" onclick="window.removeFryerItem(${f.id})" title="删除炸锅">
              ✕
            </button>
          ` : ''}
        </div>
      `;
    }).join("");

    // Bind inputs with strict pure-number filter
    container.querySelectorAll(".fryer-capacity-input").forEach(input => {
      input.addEventListener("keypress", (e) => {
        if (!/[\d.]/.test(e.key)) e.preventDefault();
      });
      input.addEventListener("input", (e) => {
        // Only allow one decimal point and digits
        let val = e.target.value.replace(/[^0-9.]/g, "");
        const parts = val.split(".");
        if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
        e.target.value = val;
        const id = parseInt(input.dataset.id, 10);
        this.updateCapacity(id, val);
      });
    });

    // Update total fryer summary badge
    const totalEl = document.getElementById("totalFryerCountText");
    if (totalEl) totalEl.textContent = `${this.fryers.length} 个`;

    // Ensure frequency count does not exceed fryers count
    this.validateFryerCount();
  },

  calculate(isUserClick = false) {
    const { days, times, fryerCount } = this.frequency;

    if (!days || days <= 0 || !times || times <= 0 || !fryerCount || fryerCount <= 0) {
      if (isUserClick) alert("请输入有效的更换周期和数量！");
      return;
    }

    // Average capacity of active fryers
    const totalCap = this.fryers.reduce((sum, f) => sum + (Number(f.capacity) || 0), 0);
    const avgCap = this.fryers.length > 0 ? totalCap / this.fryers.length : 20;

    // Monthly calculation (standard 30 days)
    // Daily changes = times / days
    // Monthly changes = 30 * (times / days)
    // Liters per change = fryerCount * avgCap
    const monthlyChanges = 30 * (times / days);
    const oilPerChange = fryerCount * avgCap;
    const totalMonthlyLiters = Math.round(monthlyChanges * oilPerChange);

    // Green Oil Commercial Metrics:
    // 1. Standard Commercial Oil JIB/Drum: 16 Liters (35 lb)
    const standardDrums = (totalMonthlyLiters / 16).toFixed(1);

    // 2. Used Cooking Oil (UCO) Recoverable:
    // Standard industry food absorption and evaporation loss is ~25%, meaning ~75% recoverable waste oil
    const ucoRecoveryLiters = Math.round(totalMonthlyLiters * 0.75);

    // 3. 55-Gallon waste oil recycling drums (~208 Liters each)
    const recyclingDrums55Gal = (ucoRecoveryLiters / 208).toFixed(1);

    // 4. Recommended Pickup Frequency
    let pickupAdvice = "建议每 4 周回收 1 次";
    if (ucoRecoveryLiters >= 600) {
      pickupAdvice = "高用油大户：建议每 1-2 周回收 1 次，配置 2-3 个 55加仑收集桶";
    } else if (ucoRecoveryLiters >= 250) {
      pickupAdvice = "中型餐馆：建议每 2-3 周回收 1 次，配置 1-2 个 55加仑收集桶";
    } else {
      pickupAdvice = "小型餐馆：建议每月回收 1 次，配置 1 个标准废油收集桶";
    }

    // Update UI
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

    // Save result state
    this.latestResult = {
      totalMonthlyLiters,
      standardDrums,
      ucoRecoveryLiters,
      recyclingDrums55Gal,
      pickupAdvice,
      restaurantName: this.currentRestaurant ? this.currentRestaurant.name : "普通餐馆",
      calculatedAt: new Date().toLocaleString("zh-CN")
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
      badge.innerHTML = `📍 当前关联餐馆：<b>${restaurant.name}</b> (${restaurant.region}) <button onclick="window.clearCalcRestaurant()" style="background:none; border:none; color:white; cursor:pointer; margin-left:6px;">✕</button>`;
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
      alert("请先点击计算！");
      return;
    }

    const { totalMonthlyLiters, standardDrums, ucoRecoveryLiters, pickupAdvice, restaurantName } = this.latestResult;
    const text = [
      `【Green Oil 绿色油脂服务核算单】`,
      `🏢 餐馆客户：${restaurantName}`,
      `🔥 炸锅配置：${this.fryers.length} 个炸锅 (平均容量 ${(this.fryers.reduce((s,f)=>s+f.capacity,0)/this.fryers.length).toFixed(0)}L)`,
      `⏱️ 换油频率：每 ${this.frequency.days} 天换油 ${this.frequency.times} 次 (每次换 ${this.frequency.fryerCount} 个锅)`,
      `------------------------`,
      `🛢️ 预估每月食用油消耗总量：${totalMonthlyLiters} 升 (约 ${standardDrums} 桶标准 16L/35lb 油)`,
      `♻️ 预估每月废油 (UCO) 回收量：${ucoRecoveryLiters} 升`,
      `🚛 回收建议方案：${pickupAdvice}`,
      `Green Oil 专业废油回收与新油配送服务`
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      alert("✅ 已复制【Green Oil 用油与废油回收核算单】到剪贴板，可直接发送微信/短信沟通！");
    }).catch(() => {
      prompt("请手动复制以下核算单文本：", text);
    });
  }
};

// Global helper bindings
window.removeFryerItem = function(id) {
  Calculator.removeFryer(id);
};

window.clearCalcRestaurant = function() {
  Calculator.clearRestaurant();
};

window.importRestaurantToCalculator = function(restaurant) {
  // Switch to calculator tab
  if (window.switchTab) {
    window.switchTab("tab-calculator");
  }
  Calculator.setRestaurant(restaurant);
};
