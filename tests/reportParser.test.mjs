import assert from 'node:assert/strict';
import test from 'node:test';

import { parseReportMarkdown } from '../src/reportParser.js';

test('extracts Chinese nodes for a new industry without generic fallbacks', () => {
  const report = `# 铜行业供需周期分析

分析日期：2026-07-13 17:03:19 +08:00
地理范围：全球
数据时效：2026年1-4月实际数据

## 0. 一句话判断

铜行业处于结构性扩张阶段，矿端约束正在累积。

## 1. 产业链

\`\`\`text
铜矿勘探/开发 -> 采选与铜精矿 -> 冶炼/精炼 -> 铜杆线板带箔 -> 电网/建筑/汽车/新能源/数据中心
\`\`\`

**关键瓶颈：**

- 新矿许可和建设周期长。
- 矿石品位下降并推高成本。

数据来源：ICSG 2026年6月月报。
来源：IEA铜产业展望。
最新信号：矿山产量同比-1.4%，精炼铜消费同比+2.0%。
反证条件：若矿山产量连续两个季度快于消费增速，则下调判断。
`;

  const result = parseReportMarkdown(report, '铜行业供需周期分析.md');

  assert.equal(result.quality.score, 100);
  assert.equal(result.caseItem.industry, '铜');
  assert.equal(result.caseItem.stage, '扩张期');
  assert.deepEqual(result.caseItem.chainNodes, [
    '铜矿勘探/开发',
    '采选与铜精矿',
    '冶炼/精炼',
    '铜杆线板带箔',
    '电网/建筑/汽车/新能源/数据中心',
  ]);
  assert.equal(result.caseItem.bottlenecks.length, 2);
});

test('accepts English report-template metadata and headings', () => {
  const report = `# Copper Supply-Demand Cycle Analysis

Research date: 2026-07-13
Geography: Global
Data Currency: Actual data through 2026 Q1

## 0. One-Sentence Judgment

Copper is in an expansion phase with a delayed mine supply response.

## 1. Industry Chain

\`\`\`text
Copper mine -> Concentrate -> Refining -> Fabrication -> Grid demand
\`\`\`

Key bottlenecks:

- Mine permitting is slow.
- Ore grades are declining.

Source: ICSG.
Source: IEA.
Risk: demand may weaken if grid capex is delayed.
`;

  const result = parseReportMarkdown(report, 'copper.md');

  assert.equal(result.caseItem.industry, 'Copper');
  assert.equal(result.caseItem.date, '2026-07-13');
  assert.equal(result.caseItem.geography, 'Global');
  assert.equal(result.caseItem.dataCurrency, 'Actual data through 2026 Q1');
  assert.equal(result.caseItem.stage, '扩张期');
  assert.deepEqual(result.caseItem.chainNodes, [
    'Copper mine',
    'Concentrate',
    'Refining',
    'Fabrication',
    'Grid demand',
  ]);
});

test('keeps the established fallback chain for a known industry with an incomplete chain', () => {
  const report = `# 半导体行业供需周期分析

分析日期：2026-07-13
地理范围：全球
数据时效：2026Q1

## 0. 一句话判断
半导体处于结构性扩张阶段。

## 1. 产业链
材料 -> 制造 -> 应用

关键瓶颈：
- 先进设备交付周期长。
- 先进封装良率爬坡慢。

来源：SIA。
来源：WSTS。
若库存连续上升则构成反证。
`;

  const result = parseReportMarkdown(report, '半导体.md');

  assert.deepEqual(result.caseItem.chainNodes, [
    '硅材料/特种气体',
    '设备',
    '晶圆制造',
    '先进封装',
    '测试',
    '芯片设计',
    '终端应用',
  ]);
});

test('does not turn a multi-column box diagram into fake chain nodes', () => {
  const report = `# 化工行业供需周期分析

分析日期：2026-07-13
地理范围：中国
数据时效：2025全年实际数据

## 0. 一句话判断
化工行业处于分化期。

## 1. 产业链

上游原料                  中游加工                    下游应用
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│ 原油/煤炭/天然气 │─────>│ 基础化工与精细化工 │─────>│ 制造业与农业      │
└─────────────┘      └──────────────────┘      └─────────────────┘

来源：行业年度数据。
来源：代表企业年报。
风险：若终端需求继续下滑则判断失效。
`;

  const result = parseReportMarkdown(report, '化工行业供需周期分析.md');

  assert.deepEqual(result.caseItem.chainNodes, [
    '原油/煤炭/天然气',
    '基础化工原料',
    '中间体',
    '精细化工',
    '终端制造',
  ]);
});

test('supplies concrete bottlenecks for legacy reports without a bottleneck heading', () => {
  const report = `# 电力电网行业供需周期分析

分析日期：2026-07-13
地理范围：中国
数据时效：2025全年实际数据

## 0. 一句话判断
电力电网处于新能源接入和负荷增长共同驱动的扩张期。

## 1. 产业链

能源资源 -> 发电 -> 输电 -> 配电 -> 储能/调度 -> 用电负荷

## 4. Supply-Demand Conflict

新能源接入和数据中心负荷增长快于部分区域的并网与配电建设。

来源：国家能源局。
来源：国家电网年度报告。
`;

  const result = parseReportMarkdown(report, '电力电网行业供需周期分析.md');

  assert.equal(result.caseItem.bottlenecks.length, 3);
  assert.match(result.caseItem.bottlenecks[0], /输电|配电|并网/u);
  assert.doesNotMatch(result.caseItem.bottlenecks.join(' '), /未提取|待补充/u);
});

test('uses explicit chain relationships instead of inferring suppliers and buyers from row order', () => {
  const report = `# 先进封装行业供需周期分析

分析日期：2026-07-15 12:00:00 +08:00
地理范围：全球
数据时效：2026Q1实际数据及2026年已发布经营更新
行业边界：2.5D/3D、CoWoS类封装、基板、设备和测试

## 0. 结论与证据就绪度

一句话判断：先进封装处于扩张兑现阶段，但价格、交期和良率的公开证据仍有缺口。

## 2. 产业链与关系

### 2.1 Physical / Production Flow

封装材料与基板 --> 2.5D/3D集成
封装设备 --> 2.5D/3D集成
GPU/HBM --> 2.5D/3D集成 --> OSAT与测试 --> AI服务器

### 2.3 Chain Node Explanation

| Node | What It Is / Does | Suppliers | Buyers | Representative Companies | Monetization | Bottleneck Role | Evidence IDs |
|---|---|---|---|---|---|---|---|
| 封装材料与基板 | 提供中介层、基板与底填材料 | 材料厂、基板厂 | 2.5D/3D集成厂 | Ibiden | 材料销售 | 尺寸与翘曲约束 | E1 |
| 封装设备 | 提供键合、切割与检测设备 | 精密零部件和软件供应商 | 2.5D/3D集成厂、OSAT | Besi | 设备和服务 | 精度与产能约束 | E2 |
| GPU/HBM | 提供待集成的逻辑与存储芯片 | 晶圆厂、存储厂 | 2.5D/3D集成厂 | NVIDIA、SK hynix | 芯片销售 | 规格和需求触发 | E3 |
| 2.5D/3D集成 | 完成芯粒和HBM互连 | 材料、设备、GPU/HBM供应商 | OSAT、芯片客户 | TSMC | 加工与产能服务 | 良率决定有效供给 | E4 |
| OSAT与测试 | 量产封装和测试 | 集成厂、测试设备商 | 芯片客户、服务器厂 | Amkor | 封装测试服务 | 认证与测试吞吐 | E5 |
| AI服务器 | 最终使用和预算场景 | 芯片与系统供应商 | 云厂商 | OEM | 系统销售 | 形成付款链 | E6 |

关键瓶颈：

- 大尺寸封装良率与翘曲控制。
- 基板、中介层、键合和测试协同。

来源：TSMC年报。
来源：Amkor季报。
反证条件：若收入增长而库存、毛利持续恶化，则下调阶段判断。
`;

  const result = parseReportMarkdown(report, '先进封装行业供需周期分析.md');
  const material = result.caseItem.chainNodeDetails.find((node) => node.name === '封装材料与基板');
  const equipment = result.caseItem.chainNodeDetails.find((node) => node.name === '封装设备');

  assert.equal(result.caseItem.judgment, '先进封装处于扩张兑现阶段，但价格、交期和良率的公开证据仍有缺口。');
  assert.equal(material.suppliers, '材料厂、基板厂');
  assert.equal(material.buyers, '2.5D/3D集成厂');
  assert.equal(equipment.suppliers, '精密零部件和软件供应商');
  assert.equal(equipment.buyers, '2.5D/3D集成厂、OSAT');
  assert.notEqual(equipment.suppliers, '封装材料与基板');
});
