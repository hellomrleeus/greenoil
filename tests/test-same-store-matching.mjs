import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanAddress,
  parseAddress,
  normalizeAddressKey,
  normalizeNameKey,
  isSimilarBusinessName,
  clusterEstablishments
} from '../scripts/sync_utils.mjs';

test('parseAddress extracts base address and unit correctly', () => {
  // Case 1: Trailing unit number vs None (Bulakenyos scenario)
  const a1 = parseAddress('2901 Markham Rd 5 M1X 0B6');
  const a2 = parseAddress('2901 Markham Rd None M1X 0B6');
  assert.equal(a1.base, '2901 markham rd');
  assert.equal(a1.unit, '5');
  assert.equal(a2.base, '2901 markham rd');
  assert.equal(a2.unit, '');

  // Case 2: Explicit unit keywords
  const a3 = parseAddress('3331 MARKHAM RD, Unit-120 None M1X 1S8');
  assert.equal(a3.base, '3331 markham rd');
  assert.equal(a3.unit, '120');

  // Case 3: Compass direction + unit
  const a4 = parseAddress('65 Front St W Unit-442 M5J 1E6');
  const a5 = parseAddress('65 Front St W 442 M5J 1E6');
  assert.equal(a4.base, '65 front st w');
  assert.equal(a4.unit, '442');
  assert.equal(a5.base, '65 front st w');
  assert.equal(a5.unit, '442');

  // Case 4: Prefix units (YorkSafe / Markham format)
  const a6 = parseAddress('1046L - 5000 Highway 7, Markham, ON, L3R 4M9');
  assert.equal(a6.base, '5000 hwy 7');
  assert.equal(a6.unit, '1046l');

  // Case 5: Highway route numbers should not be mistaken for unit numbers
  const a7 = parseAddress('5000 Highway 7, Markham, ON');
  assert.equal(a7.base, '5000 hwy 7');
  assert.equal(a7.unit, '');
});

test('normalizeNameKey and isSimilarBusinessName rules', () => {
  // Identical names with different casing
  const n1 = normalizeNameKey('Bulakenyos');
  const n2 = normalizeNameKey('BULAKENYOS');
  assert.equal(n1, 'bulakenyos');
  assert.equal(n2, 'bulakenyos');
  assert.equal(isSimilarBusinessName(n1, n2), true);

  // Substring brand extension
  const n3 = normalizeNameKey('Bulakenyos Filipino Cuisine');
  assert.equal(isSimilarBusinessName(n1, n3), true);

  // Different stores sharing generic stopwords must NOT match
  const star = normalizeNameKey('Star Restaurant');
  const moon = normalizeNameKey('Moon Restaurant');
  assert.equal(isSimilarBusinessName(star, moon), false);

  // Completely different business names
  const happy = normalizeNameKey('Happy Wok');
  assert.equal(isSimilarBusinessName(happy, n1), false);
});

test('clusterEstablishments merges same store across unit/None variations', () => {
  const records = [
    {
      id: '001Vo00001FnCdCIAV',
      name: 'Bulakenyos',
      address: '2901 Markham Rd 5 M1X 0B6',
      dates: ['2026-01-21', '2026-06-05'],
      status: 'Pass'
    },
    {
      id: '001Vo0000204wkLIAQ',
      name: 'BULAKENYOS',
      address: '2901 Markham Rd None M1X 0B6',
      dates: ['2026-09-30'],
      status: 'Pass'
    }
  ];

  const { results, relicensedMerged } = clusterEstablishments(records);
  assert.equal(results.length, 1, 'Should merge into a single establishment');
  assert.equal(relicensedMerged, 1, 'Should increment relicensedMerged count');

  const est = results[0];
  assert.equal(est.firstInspectionDate, '2026-01-21', 'Must preserve earliest historical inspection');
  assert.equal(est.latestInspectionDate, '2026-09-30', 'Must reflect latest inspection');
  assert.equal(est.inspectionCount, 3, 'Must sum inspection counts');
});

test('clusterEstablishments keeps different stores at same address separate', () => {
  const records = [
    {
      id: 'old_1',
      name: 'Old Pizza Joint',
      address: '2901 Markham Rd 5 M1X 0B6',
      dates: ['2022-03-01'],
      status: 'Pass'
    },
    {
      id: 'new_1',
      name: 'Bulakenyos',
      address: '2901 Markham Rd 5 M1X 0B6',
      dates: ['2026-01-21'],
      status: 'Pass'
    }
  ];

  const { results } = clusterEstablishments(records);
  assert.equal(results.length, 2, 'Different store names must remain distinct establishments');
});

test('clusterEstablishments keeps different physical branches separate', () => {
  const records = [
    {
      id: 'branch_1',
      name: 'Bulakenyos Filipino Cuisine',
      address: '3331 Markham Rd Unit-120 M1X 1S8',
      dates: ['2024-12-19'],
      status: 'Pass'
    },
    {
      id: 'branch_2',
      name: 'Bulakenyos',
      address: '2901 Markham Rd 5 M1X 0B6',
      dates: ['2026-01-21'],
      status: 'Pass'
    }
  ];

  const { results } = clusterEstablishments(records);
  assert.equal(results.length, 2, 'Branches at different street addresses must remain distinct');
});
