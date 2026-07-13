import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { officialIndustryLayer, primaryIndustryNames, relationSeeds, secondaryIndustryNames } from '../src/industryTaxonomy.js';

const expectedPrimary = ['半导体', '数据中心', '电力电网', '光通信', '新能源', '化工', '钢铁', '机器人'];
const expectedSecondary = ['AI算力', '液冷', '储能', '锂电池', '光伏', '铜', '铁矿石', '焦煤', '半导体设备', '先进封装'];

test('official graph contains the exact two requested industry layers', async () => {
  assert.deepEqual(primaryIndustryNames, expectedPrimary);
  assert.deepEqual(secondaryIndustryNames, expectedSecondary);

  const dataset = JSON.parse(await readFile(new URL('../src/data/cases.json', import.meta.url), 'utf8'));
  const names = new Set(dataset.cases.map((item) => item.industry));
  assert.equal(dataset.cases.length, 18);
  assert.equal(names.size, 18);
  for (const name of expectedPrimary) {
    assert.ok(names.has(name), `missing primary industry: ${name}`);
    assert.equal(officialIndustryLayer(name), '一级产业');
  }
  for (const name of expectedSecondary) {
    assert.ok(names.has(name), `missing secondary industry: ${name}`);
    assert.equal(officialIndustryLayer(name), '二级环节');
  }
  for (const report of dataset.cases) {
    assert.ok(Number.isInteger(report.quality?.score), `missing quality score: ${report.industry}`);
    assert.ok(report.quality.score >= 56, `report quality too low: ${report.industry}`);
  }
});

test('every seeded relationship connects two published reports', async () => {
  const dataset = JSON.parse(await readFile(new URL('../src/data/cases.json', import.meta.url), 'utf8'));
  const names = new Set(dataset.cases.map((item) => item.industry));
  for (const relation of relationSeeds) {
    assert.ok(names.has(relation.source), `missing relation source: ${relation.source}`);
    assert.ok(names.has(relation.target), `missing relation target: ${relation.target}`);
    assert.ok(relation.label.length >= 4, `relationship needs a meaningful label: ${relation.source} -> ${relation.target}`);
  }
});
