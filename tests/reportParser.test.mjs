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

  assert.equal(result.quality.level, '旧版待重跑');
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

test('keeps incomplete legacy chains as reported instead of hard-coded industry fallbacks', () => {
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

  assert.deepEqual(result.caseItem.chainNodes, ['材料', '制造', '应用']);
  assert.match(result.caseItem.chainNodeDetails[0].evidence, /页面不自动补写/u);
});

test('does not turn a multi-column box diagram into fake chain nodes or hard-coded fallbacks', () => {
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

  assert.deepEqual(result.caseItem.chainNodes, []);
});

test('does not synthesize bottlenecks for legacy reports without a bottleneck heading', () => {
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

  assert.deepEqual(result.caseItem.bottlenecks, ['未提取到明确关键瓶颈']);
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

test('treats rerun/version suffixes as report metadata rather than a new industry', () => {
  const report = `# 半导体行业供需周期分析（v1.4 新路由重跑）

分析日期：2026-07-16 09:53:31 +08:00
地理范围：全球
数据时效：截至 2026 年 6 月

## 0. 结论与证据就绪度

一句话判断：AI 逻辑与成熟制程处于结构性分化。

## 2. 产业链与关系

\`\`\`text
设备 -> 晶圆制造 -> 先进封装 -> 终端需求
\`\`\`

## 5. 供需矛盾与高频信号

### Core conflict

- 当前偏紧的是达到良率并通过客户验证的有效产能。
- 名义扩产必须经过设备安装、良率爬坡和客户验证。
`;
  const result = parseReportMarkdown(report, '01_半导体行业供需周期分析_v1.4新路由重跑_2026-07-16.md');
  assert.equal(result.caseItem.industry, '半导体');
  assert.equal(result.caseItem.bottlenecks.length, 2);
  assert.match(result.caseItem.bottlenecks[0], /有效产能/u);
});

test('extracts beginner-facing profit, cycle, watch and real time-series structures', () => {
  const report = `# 半导体行业供需周期分析

分析日期：2026-07-16 09:53:31 +08:00
地理范围：全球
数据时效：实际数据截至 2026 年 6 月

## 0. 结论与证据就绪度

一句话判断：先进半导体进入盈利兑现期。

## 2. 产业链与关系

### 2.3 Chain Node Explanation

| Node | What It Does | Suppliers | Buyers | Representative Companies | Monetization | Bottleneck Role | Evidence IDs |
|---|---|---|---|---|---|---|---|
| AI 预算方 | 购买算力服务 | 芯片与云平台 | 企业客户 | Microsoft | 云服务收入 | 决定订单上限 | E1 |
| 芯片设计 | 设计 AI 芯片 | EDA 与 IP | 晶圆厂 | NVIDIA | 芯片销售 | 决定性能 | E2 |
| 晶圆制造 | 把设计转为晶圆 | 设备与材料 | 芯片设计商 | TSMC | 代工服务 | 良率约束 | E3 |

### 2.4 Power and Profit Map

| Question | Answer | Evidence IDs | Gap |
|---|---|---|---|
| Who pays? | 云厂商承担最终预算 | E1 | 其他云厂商未拆解 |
| Who captures gross profit? | AI 芯片与先进代工 | E2、E3 | 口径不可直接横比 |

## 5. 供需矛盾与高频信号

| Signal | Latest Value / Direction | Period | Evidence IDs | Interpretation | Gap |
|---|---|---|---|---|---|
| Inventory | 80 天 | 2026Q1 | E3 | 先进链库存可控 | 缺全行业口径 |

## 6. 周期与利润/订单传导

| Stage / Date | Signal | Profit Pool Shift | Key Lag | Evidence IDs | Next Verification |
|---|---|---|---|---|---|
| 2026Q1 | 资本开支与收入改善 | AI 设计与代工先兑现 | 预算到收入 | E1、E3 | 下一季度实际值 |
| 2026H2 计划 | 设备投资上修 | 设备受益、制造承担折旧 | 安装到量产 | E3 | 资本开支执行率 |

### Current stage

- Phase：盈利兑现与扩产并行。
- Entry date / anchor：2026Q1，预算、收入和毛利形成验证。
- Expected transition：若库存升高则转向供给释放。
- Confidence：中。
- What would prove this wrong：预算下调且收入连续回落。

## 9. 观察哨与跟踪

| Indicator | Baseline | Source | Frequency | Positive Trigger | Disconfirming Trigger | Meaning |
|---|---|---|---|---|---|---|
| 台积电月度营收 | 2026-06：442680 百万新台币 | E3 | monthly | 高于 440000 | 低于 380000 | 订单强度代理 |

### 9.1 可比时间序列

| Date | Indicator | Value | Unit | Source | Meaning |
|---|---|---:|---|---|---|
| 2026-05 | 台积电月度营收 | 416975 | 百万新台币 | E3 | 订单强度代理 |
| 2026-06 | 台积电月度营收 | 442680 | 百万新台币 | E3 | 订单强度代理 |
`;

  const result = parseReportMarkdown(report, '半导体行业供需周期分析.md');
  const { caseItem } = result;

  assert.equal(caseItem.chainNodeDetails[0].what, '');
  assert.equal(caseItem.chainNodeDetails[0].does, '购买算力服务');
  assert.equal(caseItem.profitMap.length, 2);
  assert.equal(caseItem.profitMap[0].answer, '云厂商承担最终预算');
  assert.equal(caseItem.signalRows[0].interpretation, '先进链库存可控');
  assert.equal(caseItem.cycleTimeline.length, 2);
  assert.match(caseItem.currentStage.proveWrong, /预算下调/u);
  assert.equal(caseItem.watchIndicators[0].frequency, 'monthly');
  assert.equal(caseItem.comparableSeries.length, 1);
  assert.deepEqual(caseItem.comparableSeries[0].points.map((point) => point.value), [416975, 442680]);
});

test('keeps company role punctuation and dual listings inside one representative company row', () => {
  const report = `# 半导体行业供需周期分析

分析日期：2026-07-17
地理范围：全球
数据时效：2026 年第二季度
供给判断：先进产能扩张仍需经过良率爬坡和客户认证。

## 1. 产业链地图

### 1.2 各环节详解

#### 1.2.1 晶圆代工与 IDM

晶圆制造把设计版图转成硅片上的电路。[E3]

| 代表企业 | 角色 | 上市地/代码 | 观察意义 |
|---|---|---|---|
| TSMC | 全球晶圆代工 | 台湾证券交易所 / 2330；纽约证券交易所 / TSM | 先进制程价格与产能 |
| Samsung Electronics | DRAM、NAND、HBM 存储 IDM | 韩国交易所 / 005930 | 存储周期 |

#### 1.2.2 封装测试

封装测试把芯片集成为可交付产品。[E4]

| 代表企业 | 角色 | 上市地/代码 | 观察意义 |
|---|---|---|---|
| ASE | 封装与测试 | 台湾证券交易所 / 3711 | 封测利用率 |

#### 1.2.3 终端系统

终端系统形成最终采购需求。[E5]

| 代表企业 | 角色 | 上市地/代码 | 观察意义 |
|---|---|---|---|
| Microsoft | 云计算与 AI 服务 | 纳斯达克 / MSFT | AI 资本开支 |
`;

  const result = parseReportMarkdown(report, '半导体行业供需周期分析.md');
  const detail = result.caseItem.chainNodeDetails.find((node) => node.name === '晶圆代工与 IDM');

  assert.equal(detail.companyRows.length, 2);
  assert.deepEqual(detail.companyRows[0], {
    name: 'TSMC',
    role: '全球晶圆代工',
    code: '台湾证券交易所 / 2330；纽约证券交易所 / TSM',
    why: '先进制程价格与产能',
  });
  assert.equal(detail.companyRows[1].role, 'DRAM、NAND、HBM 存储 IDM');
  assert.match(detail.companies, /DRAM、NAND、HBM/u);
  assert.equal(result.caseItem.supplyStatus, '先进产能扩张仍需经过良率爬坡和客户认证。');
});

test('parses the current Chinese profit-map headers and sorts Chinese quarters chronologically', () => {
  const report = `# 半导体行业供需周期分析

分析日期：2026-07-17
地理范围：全球
数据时效：2026 年第二季度

## 0. 一页看懂

半导体处于结构性短缺与扩产并行阶段。

### 当前判断

- **周期位置**：结构性短缺与扩产并行
- **置信度**：中等偏高

## 1. 产业链地图

晶圆制造 -> 封装测试 -> 终端系统

### 1.3 钱怎么流：利益传导

| 问题 | 回答（必须点名具体环节和企业，禁止通用套话） | 证据 | 缺口 |
|---|---|---|---|
| 谁最终付款？ | 云厂商和企业客户 | E1 | 消费端未拆分 |
| 利润当前集中在哪个环节，为什么？ | 先进晶圆制造 | E2 | 口径不可横比 |

## 9. 观察哨与跟踪

### 9.1 可比时间序列

| 日期 | 指标 | 数值 | 单位 | 来源 | 含义 |
|---|---|---:|---|---|---|
| 2025 年第二季度 | 季度收入 | 300.7 | 亿美元 | E2 | 同口径 |
| 2026 年第二季度 | 季度收入 | 402.0 | 亿美元 | E2 | 同口径 |
| 2026 年第一季度 | 季度收入 | 359.0 | 亿美元 | E2 | 同口径 |
`;

  const { caseItem } = parseReportMarkdown(report, '半导体行业供需周期分析.md');

  assert.equal(caseItem.profitMap.length, 2);
  assert.equal(caseItem.profitMap[0].answer, '云厂商和企业客户');
  assert.equal(caseItem.currentStage.confidence, '中等偏高');
  assert.deepEqual(
    caseItem.comparableSeries[0].points.map((point) => point.date),
    ['2025 年第二季度', '2026 年第一季度', '2026 年第二季度'],
  );
});

test('does not treat a repeated core-conflict sentence as the bottleneck', () => {
  const report = `# 光通信供需周期分析

分析日期：2026-07-16 18:30:00 +08:00
地理范围：全球
数据时效：事实截至 2026-07-16
一句话判断：光通信的真实付款方是云厂商和运营商；当前利润优先流向高速光模块、光芯片和具备客户认证的器件厂，但新增产线只有通过良率和客户验证才算有效供给。

## 1. 产业链与关系

### 1.2 产业链节点说明

| 节点 | 节点定义与作用 | 供应方 | 采购方 | 代表企业 | 变现方式 | 瓶颈作用 | 证据ID |
|---|---|---|---|---|---|---|---|
| 云/运营商预算 | 形成最终付款 | 终端客户 | 光模块厂 | Microsoft | 云收入 | 资本回报与建设节奏 | E1 |
| 光芯片与激光器 | 定义性能和规格 | 上游材料 | 模块厂 | Coherent | 芯片销售 | 高端激光器/硅光良率 | E2 |
| 光器件/模块 | 集成为客户可用产品 | 光芯片厂 | 交换机厂 | 中际旭创 | 模块销售 | 800G/1.6T 认证和交付 | E3 |

## 4. 供需矛盾与高频信号

供给判断：资本回报与建设节奏；高端激光器/硅光良率；800G/1.6T 认证和交付。

核心矛盾：光通信的真实付款方是云厂商和运营商；当前利润优先流向高速光模块、光芯片和具备客户认证的器件厂，但新增产线只有通过良率和客户验证才算有效供给。
`;

  const { caseItem } = parseReportMarkdown(report, '02_光通信供需周期分析.md');

  assert.notEqual(caseItem.bottlenecks[0], caseItem.judgment);
  assert.deepEqual(caseItem.bottlenecks.slice(0, 2), [
    '高端激光器/硅光良率',
    '800G/1.6T 认证和交付',
  ]);
});

test('parses the five independent v1.5 node fields without copying content', () => {
  const report = `# 液冷行业供需周期分析

分析日期：2026-07-18 10:00:00 +08:00
地理范围：全球
数据时效：事实截至 2026-07-18

## 1. 产业链地图

### 1.2 各环节详解

#### 1.2.1 冷板与快接

**它是干什么的**：把芯片热量传入液体回路。

**向谁采购**：向铜材、密封件和精密加工厂采购部件。

**卖给谁**：向服务器厂和液冷系统集成商销售冷板组件。

**怎么赚钱、议价能力**：通过可靠性认证、低漏液率和平台适配获得溢价。

**为什么会卡住**：密封、腐蚀、洁净度和批量良率必须同时通过验证。

| 企业/机构 | 上市地/代码或属性 | 角色 | 代表性依据 | 证据 |
|---|---|---|---|---|
| Vertiv | 纽约证券交易所 / VRT | 系统供应商 | 可观察批量交付 | E1 |
| Schneider | 巴黎泛欧交易所 / SU | 基础设施供应商 | 可观察设计验证 | E2 |

**进阶视角**：批量验收而非样机发布决定有效供给，现场故障和运维工时应与订单同步观察（E1、E2）。

#### 1.2.2 CDU

**它是干什么的**：控制液体流量与换热。
**向谁采购**：向泵阀和控制器厂采购。
**卖给谁**：向液冷系统集成商销售。
**怎么赚钱、议价能力**：通过控制精度与可靠性收费。
**为什么会卡住**：冗余设计和现场调试限制交付。
**进阶视角**：批量运行数据决定设备价值（E2）。

#### 1.2.3 机房部署

**它是干什么的**：完成液冷系统现场安装。
**向谁采购**：向设备商和工程商采购。
**卖给谁**：向数据中心运营商交付。
**怎么赚钱、议价能力**：通过工程和运维服务收费。
**为什么会卡住**：停机窗口和验收流程限制改造。
**进阶视角**：投运节点比设备到货更重要（E2）。
`;

  const node = parseReportMarkdown(report, '12_液冷行业供需周期分析.md').caseItem.chainNodeDetails[0];
  assert.equal(node.suppliers, '向铜材、密封件和精密加工厂采购部件。');
  assert.equal(node.buyers, '向服务器厂和液冷系统集成商销售冷板组件。');
  assert.equal(node.money, '通过可靠性认证、低漏液率和平台适配获得溢价。');
  assert.equal(node.why, '密封、腐蚀、洁净度和批量良率必须同时通过验证。');
  assert.equal(new Set([node.what, node.suppliers, node.buyers, node.money, node.why]).size, 5);
});

test('leaves ambiguous legacy upstream and downstream text blank', () => {
  const report = `# 测试行业供需周期分析

分析日期：2026-07-18 10:00:00 +08:00
地理范围：全球
数据时效：事实截至 2026-07-18

## 1. 产业链地图

### 1.2 各环节详解

#### 1.2.1 模糊节点

**它是干什么的**：提供一种无法从旧文可靠判断方向的服务。

**上游买什么 / 下游卖给谁**：客户、供应商和合作伙伴共同参与，具体采购与销售方向没有披露。

#### 1.2.2 模糊节点二

**它是干什么的**：提供另一项方向不清的服务。
**上游买什么 / 下游卖给谁**：参与方很多，但原文没有说明谁采购或谁销售。

#### 1.2.3 模糊节点三

**它是干什么的**：提供第三项方向不清的服务。
**上游买什么 / 下游卖给谁**：只列出客户和伙伴，没有可验证的交易方向。
`;

  const node = parseReportMarkdown(report, '测试行业供需周期分析.md').caseItem.chainNodeDetails[0];
  assert.equal(node.suppliers, '');
  assert.equal(node.buyers, '');
});
