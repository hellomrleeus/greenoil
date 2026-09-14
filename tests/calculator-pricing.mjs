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

// 2. Test calculate() with DOM mock
const domElements = {
  resMonthlyOil: { textContent: '' },
  resStandardDrums: { textContent: '' },
  resUcoRecovery: { textContent: '' },
  resUcoPrice: { textContent: '' },
  resUcoIncome: { textContent: '' },
  res200LDrums: { textContent: '' },
  resPickupAdvice: { textContent: '' },
  ucoCurrentTierPill: { textContent: '' },
  ucoTierRow0: { classList: new Set() },
  ucoTierRow1: { classList: new Set() },
  ucoTierRow2: { classList: new Set() },
  ucoTierRow3: { classList: new Set() }
};

for (let i = 0; i <= 3; i++) {
  const row = domElements[`ucoTierRow${i}`];
  row.classList.add = function(c) { this.has(c) || Set.prototype.add.call(this, c); };
  row.classList.remove = function(c) { Set.prototype.delete.call(this, c); };
  row.classList.contains = function(c) { return Set.prototype.has.call(this, c); };
}

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
// ucoRecoveryLiters = 343 * 0.75 = 257 L (Tier 2: 200-300 L)
Calculator.fryers = [{ id: 1, capacity: 20 }, { id: 2, capacity: 20 }];
Calculator.frequency = { days: 7, times: 2, fryerCount: 2 };
Calculator.calculate();

assert.equal(Calculator.latestResult.totalMonthlyLiters, 343);
assert.equal(Calculator.latestResult.ucoRecoveryLiters, 257);
assert.equal(Calculator.latestResult.ucoPricing.tierIndex, 2);
assert.equal(Calculator.latestResult.ucoPricing.rate, 0.35);
assert.equal(domElements.resUcoPrice.textContent, '$0.35 / L');
assert.equal(domElements.resUcoIncome.textContent, '$89.95');
assert.equal(domElements.ucoTierRow2.classList.contains('uco-tier-active'), true);
assert.equal(domElements.ucoTierRow0.classList.contains('uco-tier-active'), false);
assert.equal(domElements.ucoTierRow1.classList.contains('uco-tier-active'), false);
assert.equal(domElements.ucoTierRow3.classList.contains('uco-tier-active'), false);

// Change to high volume: 4 fryers of 25L, every 3 days 2 times with 4 fryers:
// monthlyChanges = 30 * (2 / 3) = 20
// oilPerChange = 4 * 25 = 100
// totalMonthlyLiters = 2000 L
// ucoRecoveryLiters = 1500 L (Tier 3: 300 L+)
Calculator.fryers = [{ id: 1, capacity: 25 }, { id: 2, capacity: 25 }, { id: 3, capacity: 25 }, { id: 4, capacity: 25 }];
Calculator.frequency = { days: 3, times: 2, fryerCount: 4 };
Calculator.calculate();

assert.equal(Calculator.latestResult.totalMonthlyLiters, 2000);
assert.equal(Calculator.latestResult.ucoRecoveryLiters, 1500);
assert.equal(Calculator.latestResult.ucoPricing.tierIndex, 3);
assert.equal(domElements.resUcoIncome.textContent, '≥ $600.00');
assert.equal(domElements.ucoTierRow3.classList.contains('uco-tier-active'), true);
assert.equal(domElements.ucoTierRow2.classList.contains('uco-tier-active'), false);

// Change to small volume: 1 fryer of 10L, every 14 days 1 time:
// monthlyChanges = 30 * (1 / 14) = 2.1428
// oilPerChange = 10
// totalMonthlyLiters = 21 L
// ucoRecoveryLiters = 16 L (Tier 0: < 100 L)
Calculator.fryers = [{ id: 1, capacity: 10 }];
Calculator.frequency = { days: 14, times: 1, fryerCount: 1 };
Calculator.calculate();

assert.equal(Calculator.latestResult.totalMonthlyLiters, 21);
assert.equal(Calculator.latestResult.ucoRecoveryLiters, 16);
assert.equal(Calculator.latestResult.ucoPricing.tierIndex, 0);
assert.equal(domElements.resUcoPrice.textContent, '$0.25 / L');
assert.equal(domElements.resUcoIncome.textContent, '$4.00');
assert.equal(domElements.ucoTierRow0.classList.contains('uco-tier-active'), true);
assert.equal(domElements.ucoTierRow3.classList.contains('uco-tier-active'), false);

console.log('PASS: calculate() DOM updates and active tier switching verified.');

// 3. Test quote text formatting
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

// zh quote
i18n.setLanguage('zh');
Calculator.copyQuoteText();
assert(copiedText.includes('建议回收报价：$0.25 / L'));
assert(copiedText.includes('预估月回收返还：$4.00'));

// en quote
i18n.setLanguage('en');
Calculator.copyQuoteText();
assert(copiedText.includes('Suggested UCO Price: $0.25 / L'));
assert(copiedText.includes('Est. Monthly Rebate: $4.00'));

// ko quote
i18n.setLanguage('ko');
Calculator.copyQuoteText();
assert(copiedText.includes('권장 폐유 수거단가: $0.25 / L'));
assert(copiedText.includes('예상 월간 수거 보상금: $4.00'));

console.log('PASS: Multilingual quote export text verified.');
console.log('ALL UCO PRICING TESTS PASSED!');
