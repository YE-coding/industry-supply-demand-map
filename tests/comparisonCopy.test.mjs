import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonBottleneck, comparisonSupplyStatus } from '../src/comparisonCopy.js';

test('keeps supply status distinct from a duplicated core-conflict judgment', () => {
  const judgment = '当前利润兑现，但新增产线只有通过良率和客户验证才算有效供给。';
  const item = {
    judgment,
    supplyStatus: '高端器件扩产仍在良率爬坡和客户验证阶段。',
    bottlenecks: [judgment],
    chainNodeDetails: [
      { why: '高端激光器与硅光良率' },
      { why: '800G/1.6T 认证和交付' },
    ],
  };

  assert.equal(comparisonSupplyStatus(item), '高端器件扩产仍在良率爬坡和客户验证阶段。');
  assert.equal(comparisonBottleneck(item), '高端激光器与硅光良率；800G/1.6T 认证和交付');
  assert.notEqual(comparisonSupplyStatus(item), comparisonBottleneck(item));
});

test('uses a supply-related signal when a report has no explicit supply judgment', () => {
  const item = {
    signalRows: [
      { signal: '收入', latest: '上升', interpretation: '需求兑现' },
      { signal: '容量约束', latest: '2026 年仍受限', interpretation: '有效供给不足' },
    ],
  };

  assert.equal(comparisonSupplyStatus(item), '容量约束：2026 年仍受限；有效供给不足');
});

test('prefers concrete supply signals over broad supply summaries', () => {
  const item = {
    supplyStatus: '资本回报与建设节奏；高端激光器/硅光良率；800G/1.6T 认证和交付；端口升级节奏；上架率与流量。',
    signalRows: [
      { signal: 'Ciena 光网络收入', latest: 'FY26Q2 为 10.998 亿美元', interpretation: '设备端实际兑现' },
      { signal: '良率/认证', latest: '公开口径不足', interpretation: '不能把规划产线直接计入供给' },
    ],
  };

  assert.equal(comparisonSupplyStatus(item), '良率/认证：公开口径不足；不能把规划产线直接计入供给');
});

test('uses chain-node constraints when bottlenecks repeat judgment and supply text', () => {
  const judgment = 'AI 算力已经不是只看故事，但真正供给是已上架、能供电、能散热且可用的集群。';
  const item = {
    judgment,
    supplyStatus: '付费使用与回报；资本纪律；先进封装和 HBM；电力接入与系统交付；利用率。',
    bottlenecks: [judgment],
    chainNodeDetails: [
      { why: '付费使用与回报' },
      { why: '资本纪律' },
      { why: '先进封装和 HBM' },
      { why: '电力接入与系统交付' },
      { why: '利用率' },
    ],
  };

  assert.equal(comparisonBottleneck(item), '先进封装和 HBM；电力接入与系统交付；利用率');
});
