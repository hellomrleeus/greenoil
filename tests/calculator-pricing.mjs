import assert from 'node:assert/strict';
import { Calculator } from '../assets/js/calculator.js';
import { i18n } from '../assets/js/i18n.js';

console.log('Testing UCO Pricing Logic...');

// 1. Test tier classification and rates
const t0 = Calculator.determineUcoPricing(0);
assert.equal(t0.tierIndex, 0);
assert.equal(t0.rate, 0.25);
assert.equal(t0.tierRange, '< 100 L / month');
assert.equal(t0.monthlyEstimate, 0);
assert.equal(t0.monthlyEstimateDisplay, '$0.00');

const t50 = Calculator.determineUcoPricing(50);
assert.equal(t50.tierIndex, 0);
assert.equal(t50.rate, 0.25);
assert.equal(t50.monthlyEstimate, 12.5);
assert.equal(t50.monthlyEstimateDisplay, '$12.50');

const t99 = Calculator.determineUcoPricing(99);
assert.equal(t99.tierIndex, 0);
assert.equal(t99.rate, 0.25);
assert.equal(t99.monthlyEstimate, 24.75);

const t100 = Calculator.determineUcoPricing(100);
assert.equal(t100.tierIndex, 1);
assert.equal(t100.rate, 0.30);
assert.equal(t100.tierRange, '100–200 L / month');
assert.equal(t100.monthlyEstimate, 30);
assert.equal(t100.monthlyEstimateDisplay, '$30.00');

const t199 = Calculator.determineUcoPricing(199);
assert.equal(t199.tierIndex, 1);
assert.equal(t199.rate, 0.30);
assert.equal(t199.monthlyEstimate, 59.7);

const t200 = Calculator.determineUcoPricing(200);
assert.equal(t200.tierIndex, 2);
assert.equal(t200.rate, 0.35);
assert.equal(t200.tierRange, '200–300 L / month');
assert.equal(t200.monthlyEstimate, 70);
assert.equal(t200.monthlyEstimateDisplay, '$70.00');

const t299 = Calculator.determineUcoPricing(299);
assert.equal(t299.tierIndex, 2);
assert.equal(t299.rate, 0.35);
assert.equal(t299.monthlyEstimate, 104.65);

const t300 = Calculator.determineUcoPricing(300);
assert.equal(t300.tierIndex, 3);
assert.equal(t300.rate, 0.40);
assert.equal(t300.tierRange, '300 L+ / month');
assert.equal(t300.isOrMore, true);
assert.equal(t300.monthlyEstimate, 120);
assert.equal(t300.monthlyEstimateDisplay, '≥ $120.00');

const t500 = Calculator.determineUcoPricing(500);
assert.equal(t500.tierIndex, 3);
assert.equal(t500.rate, 0.40);
assert.equal(t500.monthlyEstimate, 200);
assert.equal(t500.monthlyEstimateDisplay, '≥ $200.00');

console.log('PASS: All tier boundary conditions and rates (<100, 100-200, 200-300, 300+) verified.');

// 2. Test calculate() with DOM mock and dual basis modes (Total Oil vs UCO Rate)
function createMockClassList(initialClasses = []) {
  const set = new Set(initialClasses);
  return {
    add(c) { set.add(c); },
    remove(c) { set.delete(c); },
    contains(c) { return set.has(c); },
    toggle(c, force) {
      if (force === undefined) {
        if (set.has(c)) set.delete(c); else set.add(c);
      } else if (force) {
        set.add(c);
      } else {
        set.delete(c);
      }
    }
  };
}

const domElements = {
  btnModeTotalOil: { classList: createMockClassList(['active']) },
  btnModeUcoRate: { classList: createMockClassList() },
  pricingBasisHint: { textContent: '' },
  resMonthlyOil: { textContent: '' },
  resStandardDrums: { textContent: '' },
  resUcoRecovery: { textContent: '' },
  resUcoPrice: { textContent: '' },
  resUcoIncome: { textContent: '' },
  res200LDrums: { textContent: '' },
  resPickupAdvice: { textContent: '' },
  ucoCurrentTierPill: { textContent: '' },
  ucoTierRow0: { classList: createMockClassList() },
  ucoTierRow1: { classList: createMockClassList() },
  ucoTierRow2: { classList: createMockClassList() },
  ucoTierRow3: { classList: createMockClassList() }
};

globalThis.document = {
  documentElement: { lang: 'zh' },
  getElementById: (id) => domElements[id] || null,
  querySelector: () => null,
  querySelectorAll: () => []
};

// Default setup: 2 fryers of 20L, every 7 days 2 times with 2 fryers:
// monthlyChanges = 30 * (2 / 7) = 8.5714
// oilPerChange = 40
// totalMonthlyLiters = 343 L
// ucoRecoveryLiters = 343 * 0.75 = 257 L
Calculator.fryers = [{ id: 1, capacity: 20 }, { id: 2, capacity: 20 }];
Calculator.frequency = { days: 7, times: 2, fryerCount: 2 };

// 2a. Default Mode: 'total' (按总用油量)
Calculator.pricingMode = 'total';
Calculator.calculate();

assert.equal(Calculator.latestResult.totalMonthlyLiters, 343);
assert.equal(Calculator.latestResult.ucoRecoveryLiters, 257);
assert.equal(Calculator.latestResult.pricingMode, 'total');
assert.equal(Calculator.latestResult.basisVolume, 343);
// In Total Oil mode: 343 L falls in Tier 3 (300 L+ / month)
assert.equal(Calculator.latestResult.ucoPricing.tierIndex, 3);
assert.equal(Calculator.latestResult.ucoPricing.rate, 0.40);
assert.equal(domElements.resUcoPrice.textContent, '$0.40/L 或更高');
assert.equal(domElements.resUcoIncome.textContent, '≥ $137.20');
assert.equal(domElements.ucoTierRow3.classList.contains('uco-tier-active'), true);
assert.equal(domElements.ucoTierRow2.classList.contains('uco-tier-active'), false);
assert(domElements.pricingBasisHint.textContent.includes('按总用油量 343 升/月'));

// 2b. Toggle Mode to 'uco' (按出油率 75%)
Calculator.setPricingMode('uco');
assert.equal(Calculator.pricingMode, 'uco');
assert.equal(domElements.btnModeTotalOil.classList.contains('active'), false);
assert.equal(domElements.btnModeUcoRate.classList.contains('active'), true);
assert.equal(Calculator.latestResult.pricingMode, 'uco');
assert.equal(Calculator.latestResult.basisVolume, 257);
// In UCO recovery mode: 257 L falls in Tier 2 (200–300 L / month)
assert.equal(Calculator.latestResult.ucoPricing.tierIndex, 2);
assert.equal(Calculator.latestResult.ucoPricing.rate, 0.35);
assert.equal(domElements.resUcoPrice.textContent, '$0.35 / L');
assert.equal(domElements.resUcoIncome.textContent, '$89.95');
assert.equal(domElements.ucoTierRow2.classList.contains('uco-tier-active'), true);
assert.equal(domElements.ucoTierRow3.classList.contains('uco-tier-active'), false);
assert(domElements.pricingBasisHint.textContent.includes('按废油出油率 (75%) 257 升/月'));

// 2c. Switch back to 'total'
Calculator.setPricingMode('total');
assert.equal(Calculator.pricingMode, 'total');
assert.equal(domElements.btnModeTotalOil.classList.contains('active'), true);
assert.equal(domElements.btnModeUcoRate.classList.contains('active'), false);
assert.equal(Calculator.latestResult.ucoPricing.tierIndex, 3);

// 2d. Change to small volume: 1 fryer of 10L, every 14 days 1 time:
// totalMonthlyLiters = 21 L
// ucoRecoveryLiters = 16 L (Tier 0: < 100 L in both modes)
Calculator.fryers = [{ id: 1, capacity: 10 }];
Calculator.frequency = { days: 14, times: 1, fryerCount: 1 };
Calculator.calculate();

assert.equal(Calculator.latestResult.totalMonthlyLiters, 21);
assert.equal(Calculator.latestResult.basisVolume, 21);
assert.equal(Calculator.latestResult.ucoPricing.tierIndex, 0);
assert.equal(domElements.resUcoPrice.textContent, '$0.25 / L');
assert.equal(domElements.resUcoIncome.textContent, '$5.25');
assert.equal(domElements.ucoTierRow0.classList.contains('uco-tier-active'), true);
assert.equal(domElements.ucoTierRow3.classList.contains('uco-tier-active'), false);

console.log('PASS: Dual pricing modes (Total vs UCO), DOM tab updates, and tier recalculations verified.');

// 3. Test quote text formatting with pricing basis indication
let copiedText = '';
Object.defineProperty(globalThis, 'navigator', {
  value: {
    clipboard: {
      writeText: async (t) => { copiedText = t; }
    }
  },
  configurable: true
});
globalThis.alert = () => {};

// zh quote (total mode)
i18n.setLanguage('zh');
Calculator.pricingMode = 'total';
Calculator.calculate();
Calculator.copyQuoteText();
assert(copiedText.includes('测算基准口径：按总用油量 (21 升/月)'));
assert(copiedText.includes('建议回收报价：$0.25 / L'));
assert(copiedText.includes('预估月回收返还：$5.25'));

// zh quote (uco mode)
Calculator.pricingMode = 'uco';
Calculator.calculate();
Calculator.copyQuoteText();
assert(copiedText.includes('测算基准口径：按出油率 (75%) (16 升/月)'));
assert(copiedText.includes('预估月回收返还：$4.00'));

// en quote (total mode)
i18n.setLanguage('en');
Calculator.pricingMode = 'total';
Calculator.calculate();
Calculator.copyQuoteText();
assert(copiedText.includes('Pricing Basis: Total Cooking Oil (21 L/mo)'));
assert(copiedText.includes('Suggested UCO Price: $0.25 / L'));

// ko quote (total mode)
i18n.setLanguage('ko');
Calculator.pricingMode = 'total';
Calculator.calculate();
Calculator.copyQuoteText();
assert(copiedText.includes('단가 산정기준: 총 식용유량 기준 (21 L/월)'));
assert(copiedText.includes('권장 폐유 수格단가') || copiedText.includes('권장 폐유 수거단가'));

console.log('PASS: Multilingual quote export text with calculation basis verified.');
console.log('ALL UCO PRICING TESTS PASSED!');
