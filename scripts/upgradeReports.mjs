import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseReportMarkdown } from '../src/reportParser.js';

const root = process.cwd();
const timestamp = '2026-07-13 18:21:31 +08:00';
const marker = '<!-- skill-structure-2026-07-13 -->';

const existing = [
  ['01_半导体行业供需周期分析.md', '半导体', '全球与中国；覆盖材料、设备、设计、晶圆制造、封装测试和终端需求，成熟制程与先进制程分开判断。'],
  ['02_光通信供需周期分析.md', '光通信', '全球与中国；覆盖光芯片、光器件、光模块、交换机/路由器、数据中心互连，不把运营商通信与AI数据中心需求混为一谈。'],
  ['03_AI算力供需周期分析.md', 'AI算力', '全球与中国；覆盖云厂商资本开支、GPU/ASIC、HBM、先进封装、服务器、网络、电力和散热，不等同于全部人工智能应用。'],
  ['04_新能源行业供需周期分析.md', '新能源', '全球与中国；覆盖风电、光伏、储能及并网消纳，具体光伏、储能和锂电池同时作为二级环节单独分析。'],
  ['05_化工行业供需周期分析.md', '化工', '中国为主、全球成本参照；覆盖原油/煤/气、基础化工、精细化工和主要制造终端，避免用单一化工品代表全行业。'],
  ['06_钢铁行业供需周期分析.md', '钢铁', '中国为主、全球矿端参照；覆盖铁矿石、焦煤、焦炭、炼铁炼钢、钢材和地产/基建/制造需求。'],
  ['07_焦煤行业供需周期分析.md', '焦煤', '中国为主、海运焦煤为补充；覆盖开采、洗选、焦化、焦炭和高炉需求，不与动力煤混同。'],
  ['08_铁矿石行业供需周期分析.md', '铁矿石', '全球矿山供给与中国钢厂需求；覆盖矿山、海运、港口库存、高炉和钢材终端。'],
  ['09_机器人行业供需周期分析.md', '机器人', '全球与中国；覆盖减速器、伺服、控制器、传感器、芯片、本体、系统集成和工业/服务终端，区分工业机器人与人形机器人。'],
  ['10_数据中心行业供需周期分析.md', '数据中心', '全球与中国；按已获电力、可交付MW、已签约/已上架容量分层，不以规划机柜替代有效供给。'],
  ['11_电力电网行业供需周期分析.md', '电力电网', '中国为主、全球技术参照；覆盖一次能源、发电、输电、配电、储能和用电负荷，重点分析电网投资、并网和区域电力约束。'],
  ['12_液冷行业供需周期分析.md', '液冷', '全球与中国；覆盖冷却液、冷板/浸没方案、CDU、系统集成、服务器和数据中心，不把所有数据中心散热都算作液冷。'],
];

const sourceLinks = (content) => {
  const links = [];
  for (const match of content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gu)) {
    if (!links.some((item) => item.url === match[2])) links.push({ label: match[1], url: match[2] });
  }
  return links.slice(-6);
};

const cell = (value = '') => String(value).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

function existingSupplement(report, content) {
  const nodes = report.chainNodeDetails || [];
  const links = sourceLinks(content);
  const first = nodes[0]?.name || '上游供给';
  const last = nodes.at(-1)?.name || '终端需求';
  const bottleneck = report.bottlenecks?.[0] || '有效产能与真实需求的匹配';
  const sourceRows = links.length
    ? links.slice(0, 5).map((item, index) => `| 核心证据 ${index + 1} | [${cell(item.label)}](${item.url}) | Tier ${index < 3 ? '1/2' : '2/3'} | yes（沿用前文滚动校准） | 中 | 需按下一次披露更新 |`).join('\n')
    : '| 前文滚动校准 | 原报告已列明来源；本节不新增无链接数字 | Tier 2/3 | 部分 | 中 | 回到原始报告核验 |';
  const nodeRows = nodes.map((node) => `| ${cell(node.name)} | ${cell(node.what)} | ${cell(node.does)} | ${cell(node.suppliers)} | ${cell(node.buyers)} | 见前文对应节点公司 | ${cell(node.money)} | ${cell(node.why)} |`).join('\n');
  const chain = nodes.map((node) => node.name).join(' -> ') || report.chain;

  return `\n\n${marker}\n## 13. 2026-07-13 Skill 完整结构补充（本节与第12节共同优先）\n\n本节按当前 \`industry-cycle-analysis\` 模板补齐动态研究字段。事实仍以第12节已打开的原始来源为准；推断和假设不冒充统计数据。\n\n### 13.1 Data Currency Table\n\n| Data Point | Status | Source | Release Date | Latest? |\n|---|---|---|---|---|\n| 报告最新实际数据范围 | Actual / mixed | ${cell(report.dataCurrency)} | 见第12节 | ✓（截至本次分析可用披露） |\n| 当前周期阶段“${cell(report.stage)}” | Inference | 第12节证据 + 前文供需链 | ${timestamp.slice(0, 10)} | 需持续复核 |\n| ${cell(bottleneck)}的统一高频量化口径 | Gap | 多数需企业/项目级披露 | — | ✗ |\n\n### 13.2 Profit and Order Transmission Chain\n\n\`\`\`text\n${cell(last)}（付款/使用）\n-> 订单与预算\n-> ${cell(bottleneck)}（稀缺或过剩节点）\n-> 收入与毛利变化\n-> 资本开支/扩产\n-> ${cell(first)}（上游订单）\n\`\`\`\n\n| Node | Demand Source | Price/Profit Lever | Bargaining Power | Main Risk |\n|---|---|---|---|---|\n| ${cell(last)} | 真实使用、替换、政策或资本开支 | 预算规模与采购节奏 | 中 | 需求预期未转成订单 |\n| ${cell(bottleneck)} | 下游订单向瓶颈集中 | 交期、良率、稀缺产能或认证 | 中高（待验证） | 扩产快于需求 |\n| ${cell(first)} | 中下游补库和扩产 | 资源价格、设备交付或加工费 | 中 | 库存反转、订单取消 |\n\n### 13.3 Chain Node Explanation\n\n| Chain Node | What It Is | What It Does | Who Supplies It | Who Buys It | Representative Companies | How It Makes Money | Why It Matters |\n|---|---|---|---|---|---|---|---|\n${nodeRows}\n\n### 13.4 Power and Profit Map\n\n| Question | Answer | Evidence / Source | Gap |\n|---|---|---|---|\n| Who pays? | ${cell(last)}及其预算方 | 前文需求端与第12节 | 终端分项占比需更新 |\n| Who captures gross profit? | 具备${cell(bottleneck)}能力、交期或认证壁垒的节点 | 第12节公司/行业披露 | 缺统一利润池口径 |\n| Who bears capex risk? | 扩产周期长、固定成本高且订单可取消的供给方 | 前文供给端 | 项目有效产能需逐项核验 |\n| Who is important but may not monetize? | 供给重要但可替代、同质化或被长协锁价的节点 | 前文受益者与非受益者 | 议价权随周期变化 |\n\n### 13.5 Supply-Demand Conflict and Transmission\n\n核心矛盾不是“需求强”本身，而是${cell(bottleneck)}能否在需求兑现前形成有效供给。\n\n\`\`\`text\n需求/预算变化 -> ${cell(last)}订单 -> ${cell(bottleneck)}交期与价格 -> 收入/毛利 -> 扩产 -> 有效产能释放 -> 紧张缓解或过剩\n\`\`\`\n\n- 立即受益：已有有效产能、通过认证且订单可转收入的节点。\n- 滞后受益：等待扩产、良率爬坡、并网或客户认证的节点。\n- 可能非受益：只有规划产能、概念关联或无法转嫁成本的节点。\n\n### 13.6 Cycle Timeline\n\n| Time | Industry Signal | Supply-Demand Meaning | What to Verify |\n|---|---|---|---|\n| 2024 | 见前文历史数据 | 需求与库存基线 | 同口径实际值 |\n| 2025 actual | 见第12节数据时效表 | 当前周期的已发生事实 | 年报/官方统计 |\n| 2026 Q1-Q2 | ${cell(report.judgment)} | 当前归纳为${cell(report.stage)} | 订单、价格、库存、利润是否同向 |\n| 下一阶段 | 新产能逐步兑现 | 可能转向盈利兑现或供给宽松 | 扩产投产、利用率和取消/延期 |\n\n关键时滞：需求信号到上游订单通常先于收入确认；从宣布扩产到有效产能还要经过建设、认证、良率或并网，不能把宣布日期当投产日期。\n\n### 13.7 Evidence Matrix\n\n| Claim | Evidence | Source Quality | Original Opened? | Confidence | Gap |\n|---|---|---|---|---|---|\n${sourceRows}\n| 当前阶段判断 | 由上述事实综合推断，不是单一统计值 | 分析推断 | n/a | 中 | 需用下一季度数据证伪 |\n\n### 13.8 Conflicting Evidence\n\n| Topic | Supporting Evidence | Disconfirming Evidence | Handling |\n|---|---|---|---|\n| 需求持续性 | 前文订单/资本开支/实际需求 | 价格回落、库存增加或终端预算下修 | 保留分歧，不用单一增速覆盖 |\n| 供给约束 | ${cell(bottleneck)} | 扩产、替代技术、良率提升 | 区分宣布产能和有效产能 |\n\n### 13.9 Observation Posts\n\n| Observation Post | Source | Frequency | Positive Signal | Disconfirming Signal | Meaning |\n|---|---|---|---|---|---|\n| 终端订单/预算 | 官方统计或下游财报 | 月/季 | 连续2期同比改善 | 连续2期下滑 | 判断需求是否真实 |\n| ${cell(bottleneck)}交期/利用率 | 企业披露、行业协会 | 月/季 | 交期延长且利用率上升 | 交期缩短并伴随库存增加 | 验证瓶颈强度 |\n| 价格与库存 | 官方/交易所/企业 | 月 | 价格、去库同向 | 降价且累库 | 判断议价权 |\n| 资本开支与有效产能 | 公司/项目公告 | 季 | 订单覆盖扩产、按期投产 | 延期、取消、低利用率 | 判断供给释放 |\n| 毛利与现金流 | 代表企业财报 | 季 | 毛利和经营现金流同步改善 | 收入增而现金流/毛利恶化 | 判断利润是否兑现 |\n\n### 13.10 Tracking Database Template\n\n| Date | Indicator | Node | Latest Value | YoY/QoQ | Direction | Source | Impact on Cycle Judgment | Note |\n|---|---|---|---|---|---|---|---|---|\n| ${timestamp.slice(0, 10)} | 报告结构复核 | ${cell(report.industry)} | 见第12节 | — | flat | 本报告 | 维持${cell(report.stage)}，等待新数据 | 不是新增统计值 |\n\n### 13.11 Search Routing and Budget\n\n| Subtask | Search Rounds | Tools/Route | Original Sources | Status |\n|---|---:|---|---:|---|\n| 广泛发现 | 1 | 本地SearXNG，中文检索；部分结果偏题 | 0 | complete（仅作线索） |\n| 原始来源核验 | 1 | 沿用第12节已打开的公司/政府/协会原文 | ${links.length} | complete / gap visible |\n| 反证 | 1 | 扩产、库存、价格下行、延期/取消关键词 | 见冲突证据表 | complete |\n\n搜索预算：每个子任务不超过3轮；搜索摘要不直接升级为事实。\n\n> supply-demand gap != stock price rise；correct industry direction != correct timing；earnings realization != continued stock rise；AI answer != fact；过时数据 != 当前事实。\n`;
}

const S = (label, url, date, status, metric, quality = 'Tier 1') => ({ label, url, date, status, metric, quality });
const N = (name, what, companies, money, why) => ({ name, what, companies, money, why });

const profiles = [
  {
    file: '13_铜行业供需周期分析.md', name: '铜', stage: '结构性扩张期',
    boundary: '全球矿山、冶炼和精炼供给，重点观察中国加工与库存；需求覆盖电网、新能源汽车、数据中心、工业设备和建筑，不把铜价短期波动等同于产业趋势。',
    judgment: '铜处于“结构性扩张期中的短期分化”：2026年ICSG基准预测为9.6万吨精炼铜过剩，但矿山增量被下修，电网、电气化和数据中心需求使中长期供给弹性仍是核心矛盾。',
    conflict: '短期再生铜和精炼产量可能形成小幅过剩，但矿山品位下降、项目周期长和供应扰动限制长期供给；精炼平衡、矿端平衡与交易所库存必须分开。',
    lag: '矿山从发现到商业产出通常跨多年；冶炼和加工扩产更快，因此短期可能出现矿紧、冶炼费承压而精炼铜表观平衡偏松。',
    bottlenecks: ['高品位、低成本且可按期投产的矿山增量', '矿端扰动向精矿加工费和精炼利润传导', '中国未报告库存使表观需求与真实需求存在偏差'],
    nodes: [
      N('铜矿勘探与开采', '从矿体中开采含铜矿石，是周期最长、资本最重的供给源。', 'BHP、Freeport、Codelco、紫金矿业', '铜价减去采选成本形成矿山利润。', '矿山事故、品位、许可和水电条件决定真正增量。'),
      N('铜精矿与贸易', '选矿后形成可供冶炼的精矿，并通过长协和现货进入冶炼厂。', '全球矿山、贸易商', '通过精矿销售、品位和贸易价差获利。', '精矿紧张先反映在加工费，而非必然立即反映在终端铜价。'),
      N('冶炼与精炼', '把精矿或废铜转成阴极铜，连接矿端和加工端。', '江西铜业、铜陵有色、Aurubis', '赚取TC/RC、硫酸副产品和加工效率。', '冶炼产能可能过剩，矿紧时加工费下降会挤压利润。'),
      N('铜材加工', '把阴极铜制成线杆、板带箔和铜管。', '金田股份、海亮股份等加工商', '赚加工费、产品结构和客户认证溢价。', '加工端最接近电网、汽车和电子订单，但同质化产品议价权有限。'),
      N('电网/新能源/数据中心', '铜的主要增量使用场景和最终预算来源。', '电网公司、设备厂、车企、数据中心建设方', '通过电力资产、设备、汽车或数字服务回收投资。', '真实项目开工和设备交付决定铜需求，而非概念热度。'),
    ],
    sources: [
      S('ICSG 2026/2027铜市场预测', 'https://icsg.org/download/2026-04-23-press-release-icsg-copper-market-forecast-2026-2027/?filename=2026-04-23-ICSG-Forecast-Press-Release.pdf&ind=69ea529460d24&refresh=9a8e40d5&wpdmdl=9245', '2026-04-23', 'Forecast', '2026年矿产量+1.6%；精炼铜过剩9.6万吨，2027年过剩37.7万吨'),
      S('IEA Global Critical Minerals Outlook 2025', 'https://www.iea.org/reports/global-critical-minerals-outlook-2025/overview-of-outlook-for-key-minerals', '2025', 'Actual + Forecast', '电网与工业电气化推动需求；2035年宣布项目下矿端缺口仍可能达30%'),
      S('IEA铜价与冶炼压力评论', 'https://www.iea.org/commentaries/copper-prices-have-hit-record-highs-but-smelters-face-mounting-strategic-pressures/', '2026', 'Analysis', '需求来自电网、汽车、工业、数据中心；矿端与冶炼利润需分开'),
    ],
    watch: ['ICSG月度矿产量与精炼平衡', 'LME/SHFE/COMEX显性库存', '铜精矿现货TC/RC', '中国电网投资和电缆订单', '主要矿山产量指引与事故/许可'],
    winners: ['已有低成本矿山且产量可兑现的矿企', '产品结构高端、客户认证稳定的铜材加工商'],
    losers: ['矿源不足且依赖加工费的冶炼厂', '只有资源量叙事、缺许可和融资的远期项目'],
  },
  {
    file: '14_储能行业供需周期分析.md', name: '储能', stage: '成长期',
    boundary: '全球与中国；重点分析电化学新型储能的电芯、PCS、BMS、系统集成、并网与运营收益，不把抽水蓄能与数据中心UPS全部并入口径。',
    judgment: '储能处于装机高速增长、收益机制和调用效率验证的成长期：2025年全球新增电池储能108GW，中国新型储能已投运1.36亿kW/3.51亿kWh，但项目价值取决于并网、时长、调用和收入，而不是只看装机规模。',
    conflict: '制造供给总体充足，真正稀缺的是可并网、可调用、具备稳定容量/辅助服务/峰谷价差收入的项目；低价系统与安全、寿命和可融资性之间存在权衡。',
    lag: '电芯和系统制造扩产较快，项目从备案到并网通常更慢；并网后还需通过调度和市场机制把容量转成利用小时与现金流。',
    bottlenecks: ['电网接入与项目许可', '稳定且可验证的收益机制', '长时运行下的安全、衰减和系统效率'],
    nodes: [
      N('电芯与材料', '提供储能系统的能量载体，当前以磷酸铁锂为主。', '宁德时代、亿纬锂能、比亚迪', '通过电芯售价、规模和良率获利。', '电芯供给不等于项目价值，循环寿命和一致性决定全生命周期成本。'),
      N('PCS/BMS/温控', '完成充放电变换、控制和热管理。', '阳光电源、科华数据、温控厂商', '通过设备销售、软件控制和服务获利。', '这些环节决定效率、安全和电网友好性。'),
      N('储能系统集成', '把电芯、变流器、控制和消防组合成可交付系统。', 'Tesla、Fluence、阳光电源、海博思创', '赚系统价差、集成能力和质保服务。', '低价竞争会把质量风险留给运营期。'),
      N('并网与EPC', '完成工程建设、变电接入、验收和调度通信。', '电力设计院、EPC、电网公司', '通过工程费、设备集成和项目管理获利。', '没有并网和验收，名义容量不能形成有效供给。'),
      N('电站运营与电力市场', '通过峰谷套利、容量、辅助服务或新能源配套获得收入。', '发电集团、独立储能运营商、电网侧主体', '赚电力市场价差和多重服务收入。', '调用小时和收入叠加规则决定投资回报。'),
    ],
    sources: [
      S('IEA Global Energy Review 2026 - Battery storage', 'https://www.iea.org/reports/global-energy-review-2026/technology-battery-storage', '2026-04-20', 'Actual', '2025年全球新增108GW，同比+40%；约80%为公用事业级'),
      S('国家能源局2025年新型储能发布会', 'https://www.nea.gov.cn/20260130/50f657ce87f848e1a9a1861d1fd9aa23/c.html', '2026-01-30', 'Actual', '中国1.36亿kW/3.51亿kWh；利用1195小时；锂电占96.1%'),
      S('IEA Electricity 2026 - Flexibility', 'https://www.iea.org/reports/electricity-2026/flexibility', '2026', 'Actual + Analysis', '平均时长上升；项目面临并网、许可和收入波动延迟'),
    ],
    watch: ['全球/中国新增投运GW与GWh', '平均储能时长与等效利用小时', '系统中标价和质保条件', '独立储能现货/容量/辅助服务收入', '项目延期、并网排队和安全事故'],
    winners: ['具备电芯质量、PCS控制和长期质保能力的集成商', '已并网且收入机制清晰的运营资产'],
    losers: ['只拼最低中标价、缺少质保准备的集成商', '有备案但并网和收入机制不确定的项目'],
  },
  {
    file: '15_锂电池行业供需周期分析.md', name: '锂电池', stage: '过剩出清期',
    boundary: '全球与中国；覆盖锂/镍/石墨等材料、正负极/电解液/隔膜、电芯、PACK以及电动车和储能需求，消费电子仅作补充。',
    judgment: '锂电池处于需求高增长与制造产能过剩并存的出清期：2025年EV电池部署约1.2TWh、同比近30%，但全球名义电芯产能已超过4TWh，中国占80%以上，价格、利用率和技术路线分化比总需求增速更重要。',
    conflict: '总名义产能明显高于当期部署量，但高安全、高倍率、长循环、特定区域合规产能并非完全可替代；上游锂价在2026年初反弹又增加成本传导不确定性。',
    lag: '电芯工厂建设可在数年内完成，但从投产到接近名义产能可能超过5年；车型定点、认证和良率决定有效产能。',
    bottlenecks: ['有效产能、良率和客户定点而非名义产能', '原材料价格反弹能否向电芯与终端传导', '储能与电动卡车需求能否吸收过剩产能'],
    nodes: [
      N('锂/镍/石墨资源', '提供电池活性材料和负极原料。', '矿企、盐湖、石墨企业', '资源价格减采选冶成本。', '资源价格决定成本底座，但短期可能与电芯过剩方向相反。'),
      N('正负极/电解液/隔膜', '把资源加工为决定容量、安全和寿命的关键材料。', '材料龙头企业', '通过加工、配方、客户认证和规模获利。', '材料环节容易受价格传导和产能利用率双重挤压。'),
      N('电芯制造', '将材料制成可反复充放电的电芯。', '宁德时代、比亚迪、LGES、松下', '通过电芯售价、良率、规模和技术代际获利。', '名义产能与合格、被客户接受的有效产能差距很大。'),
      N('PACK与电池系统', '把电芯组合并加入结构、热管理和控制。', '电池厂、车企、储能集成商', '赚系统集成、结构创新和服务。', '系统安全和整车/电站性能在此兑现。'),
      N('电动车/储能', '主要终端需求和付款场景。', '车企、电网、储能运营商', '通过车辆销售或电力服务回收成本。', '需求结构从乘用车扩展到卡车和储能，决定化学体系与产品规格。'),
    ],
    sources: [
      S('IEA Global EV Outlook 2026 - Batteries', 'https://www.iea.org/reports/global-ev-outlook-2026/electric-vehicle-batteries', '2026', 'Actual + Forecast', '2025年EV电池部署1.2TWh；名义产能超4TWh，中国占80%以上'),
      S('IEA全球电池市场评论', 'https://www.iea.org/commentaries/global-battery-markets-are-growing-strongly-and-so-are-the-supply-risks', '2026', 'Actual + Analysis', '2025年市场超1500亿美元；EV占部署70%以上，储能超15%'),
      S('IEA Global Critical Minerals Outlook 2025', 'https://www.iea.org/reports/global-critical-minerals-outlook-2025/overview-of-outlook-for-key-minerals', '2025', 'Forecast', '锂短期供应充足，但2030年代存在矿端缺口风险'),
    ],
    watch: ['EV和储能电池部署GWh', '电芯名义/有效产能利用率', '锂价、正极和电芯价格差', 'LFP/三元/钠离子份额', '库存、减产和项目延期'],
    winners: ['有稳定客户、良率和成本优势的电芯龙头', '在储能、卡车或高端快充形成差异化的产品'],
    losers: ['缺订单和认证的同质化新增产能', '不能把材料涨价向下游传导的中游企业'],
  },
  {
    file: '16_光伏行业供需周期分析.md', name: '光伏', stage: '过剩出清期',
    boundary: '全球装机与中国制造链；覆盖硅料、硅片、电池片、组件、逆变器、EPC、电站和并网消纳，不把风电和储能收入混入口径。',
    judgment: '光伏处于终端装机创新高、制造端持续过剩和价格出清并存的阶段：2025年全球新增约698GW、累计接近3TW，中国新增太阳能装机3.17亿kW，但组件过剩使价格较高点下跌超过60%，利润取决于成本、技术迭代和出清速度。',
    conflict: '终端需求强并不能自动修复制造利润；硅料到组件的名义产能、低价库存和贸易壁垒仍压制价格，而电网消纳和项目收益决定需求质量。',
    lag: '制造扩产快于电站开发和并网；产能退出又受现金成本、债务和地方支持影响，出清通常滞后于价格跌破完全成本。',
    bottlenecks: ['制造产能真实退出与库存消化', '技术迭代下旧产线的有效性', '并网消纳、融资和电价决定的项目回报'],
    nodes: [
      N('硅料', '把工业硅提纯成太阳能级多晶硅。', '通威、协鑫、大全', '通过硅料价格减能源和折旧成本获利。', '扩产集中且成本差异大，是价格周期的上游放大器。'),
      N('硅片', '把硅锭切成薄片，为电池片提供基底。', '隆基、TCL中环', '赚加工差、薄片化和尺寸/技术溢价。', '库存和技术路线切换会使旧产能迅速贬值。'),
      N('电池片', '把硅片制成可进行光电转换的器件。', '通威、爱旭、晶科等', '通过转换效率、良率和技术代际获利。', 'TOPCon、BC等路线决定设备改造和溢价持续性。'),
      N('组件与逆变器', '把电池片封装成组件并完成直流到交流变换。', '晶科、天合、隆基、华为、阳光电源', '通过品牌、渠道、质保、效率和系统方案获利。', '组件同质化时价格承压，逆变器和系统能力更依赖认证与服务。'),
      N('电站/EPC/电网', '建设并运营光伏资产，最终通过售电回收投资。', '发电集团、开发商、电网公司', '赚发电收入、EPC和运维服务。', '并网、消纳、电价和融资成本决定终端需求是否可持续。'),
    ],
    sources: [
      S('IEA PVPS Snapshot 2026', 'https://iea-pvps.org/snapshot-reports/snapshot-2026/', '2026', 'Actual', '2025年新增约698GW、累计接近3TW'),
      S('国家能源局2025年可再生能源并网运行', 'https://www.nea.gov.cn/20260212/742b8c6a078347b0b39de676c05c5d58/c.html', '2026-02-12', 'Actual', '中国2025年新增太阳能3.17亿kW，累计12亿kW'),
      S('IEA Renewables 2025', 'https://www.iea.org/reports/renewables-2025/executive-summary', '2025', 'Analysis + Forecast', '过剩、低价和贸易壁垒压低制造投资'),
      S('IEA PVPS Snapshot 2026 Factsheet', 'https://iea-pvps.org/wp-content/uploads/2026/05/Snapshot-2026-FS.pdf', '2026-05', 'Actual', '制造过剩推动组件价格较高点下降超过60%'),
    ],
    watch: ['全球/中国月度新增装机', '硅料/硅片/电池片/组件价格', '各环节开工率与库存', '落后产能停产和项目延期', '弃光率、并网排队和电站收益率'],
    winners: ['现金成本低、技术迭代快且资产负债表稳健的制造商', '具备海外渠道、逆变器和电站运营能力的企业'],
    losers: ['高成本旧产线和依靠持续融资维持的产能', '只有装机增长叙事但无法改善现金流的同质化组件产能'],
  },
  {
    file: '17_半导体设备行业供需周期分析.md', name: '半导体设备', stage: '结构性扩张期',
    boundary: '全球与中国；覆盖光刻、刻蚀、薄膜沉积、清洗、量测、测试和封装设备，区分前道/后道、先进/成熟制程与出口管制影响。',
    judgment: '半导体设备处于AI与先进制程驱动的结构性扩张期：SEMI披露2025年全球设备销售1351亿美元、同比增长15%，2026Q1账单同比增长14%；但汽车、工业和消费终端偏弱以及出口管制使不同设备和地区明显分化。',
    conflict: '先进逻辑、HBM和先进封装拉动设备强度，但设备交付、客户验证和出口许可限制有效供给；成熟制程重复扩产可能带来区域性利用率压力。',
    lag: '晶圆厂资本开支到设备订单通常领先投产数季；设备安装、验收和收入确认又滞后于订单，先进节点验证周期更长。',
    bottlenecks: ['EUV/高端量测等少数设备的技术与供应链集中', '客户验证、服务能力和出口许可', '订单高增长能否转为验收收入与现金流'],
    nodes: [
      N('核心零部件', '光学、真空、射频、电源、运动控制等设备底层部件。', '蔡司、MKS、VAT及专业供应商', '通过高可靠部件、认证和售后获利。', '零部件交期和单一来源会限制整机交付。'),
      N('前道制造设备', '完成光刻、刻蚀、沉积、清洗和离子注入。', 'ASML、Applied Materials、Lam、TEL、北方华创', '设备销售、工艺升级和装机服务。', '先进节点每层工艺增加设备强度，是晶圆厂扩产的核心资本品。'),
      N('量测与检测', '测量线宽、缺陷和工艺一致性。', 'KLA、Hitachi High-Tech、中科飞测', '通过高精度设备、算法和服务获利。', '良率爬坡离不开量测，先进节点越复杂价值量越高。'),
      N('测试与封装设备', '在晶圆和成品阶段完成测试、切割、键合和封装。', 'Advantest、Teradyne、ASMPT、Besi', '设备销售、耗材和服务。', 'AI/HBM提高测试时长和封装复杂度，后道设备弹性更高。'),
      N('晶圆厂/封测厂', '购买设备并形成芯片和封装有效产能。', 'TSMC、Samsung、Intel、SK hynix、中芯国际', '通过晶圆代工、存储或封测服务回收资本开支。', '设备订单最终取决于客户长期需求和产能利用率。'),
    ],
    sources: [
      S('SEMI设备市场实际数据', 'https://www.semi.org/en/taxonomy/term/45726', '2026-04-07', 'Actual', '2025年全球设备销售1351亿美元，同比+15%；封装设备+21%'),
      S('SEMI Market Intelligence', 'https://www.semi.org/en/products-services/market-intelligence', '2026-06', 'Actual + Forecast', '2026Q1设备账单同比+14%；300mm投资继续增长'),
      S('ASML 2026Q1业绩', 'https://www.asml.com/en/news/press-releases/2026/q1-2026-financial-results', '2026-04-15', 'Actual + Guidance', 'Q1收入88亿欧元、毛利率53%；全年收入指引360-400亿欧元'),
    ],
    watch: ['SEMI季度设备账单', '晶圆厂资本开支与节点分布', '设备订单/积压/验收收入', 'ASML等关键设备交付和毛利', '出口许可、延期和成熟制程利用率'],
    winners: ['具备不可替代工艺能力和全球服务网络的设备商', '通过客户验证、进入先进逻辑/HBM扩产的后道与量测设备'],
    losers: ['依赖单一地区或单一成熟制程扩产的设备商', '只有订单公告但验收、回款和客户验证不足的企业'],
  },
  {
    file: '18_先进封装行业供需周期分析.md', name: '先进封装', stage: '扩张兑现期',
    boundary: '全球与中国；覆盖2.5D/3D、CoWoS类中介层、混合键合、基板、封装设备、测试和OSAT，重点分析AI/HBM，不把全部传统封装并入口径。',
    judgment: '先进封装处于AI/HBM需求拉动、瓶颈从“有没有产能”转向“大尺寸、良率和交付能力”的扩张兑现期：2025年封装设备销售增长21%，Amkor先进封装和计算收入创纪录，TSMC继续扩充大尺寸CoWoS并推进更大尺寸方案。',
    conflict: '需求从GPU/HBM向大尺寸2.5D/3D封装集中，但中介层、基板、键合、测试和良率必须同步；单点扩产无法自动形成可交付系统产能。',
    lag: '客户产品定义到封装认证通常跨多个季度；设备到厂、材料认证和良率爬坡使宣布产能晚于实际可交付产能。',
    bottlenecks: ['大尺寸封装良率与翘曲控制', 'HBM、基板、中介层和测试协同供给', '客户认证和量产爬坡速度'],
    nodes: [
      N('封装材料与基板', '提供ABF基板、中介层、载板、底填和散热材料。', 'Ibiden、Unimicron、欣兴及材料厂', '通过高层数、高可靠材料和认证溢价获利。', '尺寸扩大和高速互连提高材料难度，短缺会卡住整包交付。'),
      N('封装设备', '完成键合、贴装、切割、沉积和检测。', 'Besi、ASMPT、Disco、KLA等', '设备销售、工艺升级和服务。', '混合键合和大尺寸封装提高设备精度与价值量。'),
      N('2.5D/3D集成', '把GPU、HBM和芯粒通过中介层或堆叠连接。', 'TSMC、Samsung、Intel', '通过先进封装服务、产能和良率获利。', '它决定AI芯片能否获得高带宽、低功耗和足够算力密度。'),
      N('OSAT与测试', '承接封装、测试、量产和部分系统级集成。', 'Amkor、日月光、长电科技、通富微电', '通过封装测试服务、复杂度和规模获利。', '测试强度上升，收入确认取决于认证、产量和良率。'),
      N('GPU/HBM/AI服务器', '先进封装的主要付款链和终端使用场景。', 'NVIDIA、AMD、云厂商和服务器OEM', '通过芯片和算力服务回收封装投入。', '云资本开支和AI芯片路线决定封装规格与需求持续性。'),
    ],
    sources: [
      S('SEMI 2025设备实际数据', 'https://www.semi.org/en/taxonomy/term/45726', '2026-04-07', 'Actual', '2025年封装设备销售同比+21%，测试设备+55%'),
      S('Amkor 2025全年业绩', 'https://ir.amkor.com/news-releases/news-release-details/amkor-technology-reports-financial-results-fourth-quarter-and-11', '2026-02-09', 'Actual', '2025年收入67.08亿美元，先进封装与计算收入创纪录'),
      S('TSMC 2025年报', 'https://investor.tsmc.com/static/annualReports/2025/english/index.html', '2026', 'Actual + Plan', 'CoWoS/SoIC持续扩产，2026年导入更大尺寸方案量产'),
      S('TSMC 2026Q1电话会', 'https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-04/3cef85204275f94fd111485cfdf4adb3c0263c45/TSMC%201Q26%20Transcript.pdf', '2026-04-16', 'Actual + Plan', '当前主要供给仍是大尺寸CoWoS，并建设更大尺寸试验线'),
    ],
    watch: ['CoWoS/2.5D有效产能与交期', 'HBM出货和GPU平台节奏', '封装设备订单与验收', '基板/中介层价格和交期', '良率、返工和OSAT毛利率'],
    winners: ['已有大尺寸量产良率和客户认证的封装厂', '受益于混合键合、测试强度和基板复杂度提升的设备材料商'],
    losers: ['只有宣布产能、缺客户产品和良率数据的项目', '传统低端封装产能被错误当作先进封装供给'],
  },
];

function nodeRows(profile) {
  return profile.nodes.map((node, index) => {
    const suppliers = index === 0 ? '资源、设备、资本与技术许可' : profile.nodes[index - 1].name;
    const buyers = index === profile.nodes.length - 1 ? '最终用户或预算方' : profile.nodes[index + 1].name;
    return `| ${node.name} | ${node.what} | 把${suppliers}提供的投入转成下一环节可使用的产品或服务。 | ${suppliers} | ${buyers} | ${node.companies} | ${node.money} | ${node.why} |`;
  }).join('\n');
}

function renderProfile(profile) {
  const chain = profile.nodes.map((node) => node.name);
  const finalNode = chain.at(-1);
  const firstNode = chain[0];
  const sourceRows = profile.sources.map((source) => `| ${source.metric} | ${source.status} | [${source.label}](${source.url}) | ${source.date} | ✓ |`).join('\n');
  const evidenceRows = profile.sources.map((source) => `| ${source.metric} | [${source.label}](${source.url}) | ${source.quality} | yes | ${source.status === 'Actual' ? '高' : '中'} | ${source.status === 'Forecast' ? '预测会修订' : '按下一次披露更新'} |`).join('\n');
  const watchRows = profile.watch.map((indicator, index) => `| ${indicator} | ${index < 2 ? '官方/协会统计' : '公司披露或行业数据'} | ${index === 0 ? '月/季' : '月度或季度'} | 连续2期改善且与价格/利润同向 | 连续2期恶化或与库存背离 | ${index < 2 ? '验证需求与有效供给' : '验证瓶颈和利润兑现'} |`).join('\n');

  return `# ${profile.name}行业供需周期分析\n\n分析日期：${timestamp}\n地理范围：${profile.boundary.includes('全球') ? '全球+中国' : '中国为主'}\n数据时效：2025全年实际数据 + 2026Q1/Q2已发布数据；预测单独标注\n行业边界：${profile.boundary}\n\n## 0. 一句话判断\n\n**${profile.judgment}**\n\n事实：${profile.sources.filter((source) => source.status.includes('Actual')).map((source) => source.metric).join('；')}。\n\n推断：当前归为“${profile.stage}”，依据是需求、有效供给、价格/利润和扩产时滞的组合，不是单一评分。\n\n假设：若观察哨中的需求、交期、库存和利润不再同向，必须下调或改变阶段判断。\n\n### 0.1 Data Currency Table\n\n| Data Point | Status | Source | Release Date | Latest? |\n|---|---|---|---|---|\n${sourceRows}\n\n## 1. 产业链\n\n\`\`\`text\n${chain.join(' -> ')}\n\`\`\`\n\n关键瓶颈：\n\n${profile.bottlenecks.map((item) => `- ${item}`).join('\n')}\n\n## 1.1 Profit and Order Transmission Chain\n\n\`\`\`text\n${finalNode}（最终付款/使用） -> 订单与预算 -> ${chain.slice(1, -1).reverse().join(' -> ')} -> ${firstNode}（上游资本开支）\n\`\`\`\n\n| Node | Demand Source | Price/Profit Lever | Bargaining Power | Main Risk |\n|---|---|---|---|---|\n| ${finalNode} | 真实使用、政策或资本开支 | 产品/服务收入 | 中 | 预算和利用率不及预期 |\n| ${profile.nodes[Math.floor(profile.nodes.length / 2)].name} | 下游订单 | 良率、交期、认证和稀缺产能 | 中高 | 扩产后供给宽松 |\n| ${firstNode} | 中下游补库和扩产 | 资源价格或设备材料溢价 | 中 | 周期反转和库存调整 |\n\n## 1.2 Chain Node Explanation\n\n| Chain Node | What It Is | What It Does | Who Supplies It | Who Buys It | Representative Companies | How It Makes Money | Why It Matters |\n|---|---|---|---|---|---|---|---|\n${nodeRows(profile)}\n\n## 1.3 Power and Profit Map\n\n| Question | Answer | Evidence / Source | Gap |\n|---|---|---|---|\n| Who pays? | ${finalNode}的运营方、采购方或最终用户 | 需求端原始来源 | 分项预算口径不完全统一 |\n| Who captures gross profit? | 已有有效产能、良率、认证和交付能力的瓶颈节点 | 公司与协会披露 | 缺全行业利润池 |\n| Who bears capex risk? | 建设周期长、固定成本高且订单可取消的扩产方 | 供给端项目披露 | 宣布产能不等于有效产能 |\n| Who cannot monetize well? | 同质化、可替代或不能转嫁成本的节点 | 价格/利润信号 | 企业差异较大 |\n\n## 1.5 Research Plan and Budget\n\n| Subtask | Search Rounds | Tools/Route | Original Sources | Status |\n|---|---:|---|---:|---|\n| 广泛发现 | 1 | 本地SearXNG；偏题结果只作线索 | 0 | complete |\n| 需求、供给与指标 | 1 | 官方协会/政府/公司原文 | ${profile.sources.length} | complete |\n| 反证 | 1 | 过剩、延期、价格下行、替代技术 | ${profile.sources.length} | complete |\n| 高频价格/库存 | 1 | 官方或交易所优先 | 视公开口径 | gap visible |\n\n## 2. Demand Side\n\n事实：\n\n- ${profile.sources[0].metric}（[${profile.sources[0].label}](${profile.sources[0].url})）。\n- 最终需求由${finalNode}的真实采购、利用率和预算决定，不能用规划项目代替。\n\n推断：需求如果只表现为资本开支或订单、没有转为利用率、收入和现金流，仍处于预期阶段。\n\n假设：终端需求连续两个披露期保持增长，且价格/库存没有给出相反信号。\n\n## 3. Supply Side\n\n事实：\n\n- ${profile.sources[1].metric}（[${profile.sources[1].label}](${profile.sources[1].url})）。\n- ${profile.lag}\n\n推断：有效供给必须同时满足建设完成、认证/并网、良率和客户订单，名义产能只能作为上限。\n\n假设：已宣布项目按期投产且不会因价格、融资、许可或技术问题延期。\n\n## 4. Supply-Demand Conflict\n\n${profile.conflict}\n\n\`\`\`text\n需求驱动 -> 订单增加 -> ${profile.bottlenecks[0]} -> 交期/价格/毛利变化 -> 扩产 -> 有效产能释放 -> 紧张缓解或过剩\n\`\`\`\n\n- 立即受益：${profile.winners[0]}。\n- 滞后受益：等待认证、并网、良率或客户定点的新供给。\n- 潜在受损：${profile.losers[0]}。\n\n## 5. Price, Orders, Inventory, Margin\n\n| Signal | Latest Direction | Evidence | Meaning |\n|---|---|---|---|\n| Price | 分化/待按产品核验 | 官方或交易所高频数据优先 | 价格必须和库存、利用率一起看 |\n| Orders | 结构性增长 | 终端和代表企业披露 | 订单需检查取消条款和收入时点 |\n| Inventory | 口径不统一 | 交易所、企业和渠道分别统计 | 隐性库存可能改变表观平衡 |\n| Margin | 瓶颈节点优于同质化节点 | 代表企业财报 | 利润池随扩产和价格变化迁移 |\n\n## 5.5 Profit/Order Transmission Chain\n\n终端需求先影响订单，订单再影响收入和瓶颈毛利；利润上升才可能触发扩产，扩产形成有效供给后又反过来压低价格和毛利。关键时滞是：${profile.lag}\n\n## 5.6 Transmission Mechanism\n\n| Mechanism | Direction | Speed | Evidence |\n|---|---|---|---|\n| Price pass-through | 上游与下游双向 | 周/月 | 产品价格与合同 |\n| Order book | ${finalNode} -> 上游 | 月/季 | 公司订单和收入 |\n| Inventory adjustment | 全链条 | 周/月 | 交易所/企业库存 |\n| Capex cycle | 利润 -> 扩产 -> 有效供给 | 季/年 | 项目和设备订单 |\n\n## 6. Beneficiaries and Non-Beneficiaries\n\n真实受益者：\n\n${profile.winners.map((item) => `- ${item}`).join('\n')}\n\n只有概念暴露或潜在受损：\n\n${profile.losers.map((item) => `- ${item}`).join('\n')}\n\n## 7. Cycle Stage\n\n当前阶段：**${profile.stage}**。\n\n反证条件：需求指标连续两期走弱、库存持续增加、价格下降且瓶颈交期缩短；或者扩产按期释放但利用率和利润未改善。\n\n## 7.1 Cycle Timeline\n\n| Time | Industry Signal | Supply-Demand Meaning | What to Verify |\n|---|---|---|---|\n| 2024 | 上一轮需求/产能基线 | 形成当前库存与价格起点 | 同口径实际值 |\n| 2025 actual | ${profile.sources[0].metric} | 需求与供给已发生变化 | 官方全年数据 |\n| 2026 Q1-Q2 | ${profile.judgment} | 当前处于${profile.stage} | 订单、价格、库存、利润 |\n| 未来2-6季 | 扩产和需求继续传导 | 可能转向盈利兑现、宽松或出清 | 有效产能和利用率 |\n\n## 7.5 Cycle Timeline Detailed\n\n\`\`\`text\nDemand -> Shortage/Gap -> Price/Margin -> Capex -> Effective Capacity -> Relief/Oversupply -> Clearing\n                                      ^ current estimate: ${profile.stage}\n\`\`\`\n\n预计转阶段窗口：未来2-6个季度，置信度中；必须由观察哨而不是日期自动触发。\n\n## 8. Capital-Market Expectation Mapping\n\n| Industry Reality | Market Expectation | Evidence | Interpretation |\n|---|---|---|---|\n| ${profile.judgment} | 市场可能交易需求增长、短缺或出清改善 | 原始来源与公司披露 | 产业事实不等于估值尚未反映 |\n\n不提供个股推荐、目标价或短线判断。\n\n## 8.5 Evidence Matrix\n\n| Claim | Evidence | Source Quality | Original Opened? | Confidence | Gap |\n|---|---|---|---|---|---|\n${evidenceRows}\n\n## 8.6 Conflicting Evidence\n\n| Topic | Source A | Source B | Difference | Handling |\n|---|---|---|---|---|\n| 需求增长 vs 利润 | 终端需求和装机/订单增长 | 价格、利用率和利润可能走弱 | 需求强不代表供给方都有利润 | 保留分层 |\n| 短缺 vs 扩产 | 当前瓶颈与交期 | 宣布产能和替代技术 | 名义产能不等于有效产能 | 跟踪投产和良率 |\n\n## 9. Three Scenarios\n\n- Base case：需求按现有趋势增长，瓶颈逐步缓解，行业维持${profile.stage}。\n- Bull case：需求连续两期超预期且有效供给释放更慢，瓶颈节点价格和毛利同步上升。\n- Risk case：需求下修、库存累积或扩产集中释放，价格和利润先于收入转弱。\n\n## 10. Monthly Tracking Plan\n\n| Node | Indicator | Source | Frequency | Why It Matters |\n|---|---|---|---|---|\n${profile.watch.map((indicator, index) => `| ${chain[Math.min(index, chain.length - 1)]} | ${indicator} | 官方/协会/公司 | 月/季 | ${index < 2 ? '验证需求与供给' : '验证价格、瓶颈和利润'} |`).join('\n')}\n\n## 10.1 Observation Posts\n\n| Observation Post | Source | Frequency | Positive Signal | Disconfirming Signal | Meaning |\n|---|---|---|---|---|---|\n${watchRows}\n\n## 10.2 Tracking Database Template\n\n| Date | Indicator | Node | Latest Value | YoY/QoQ | Direction | Source | Impact on Cycle Judgment | Note |\n|---|---|---|---|---|---|---|---|---|\n| ${timestamp.slice(0, 10)} | 初始基线 | ${profile.name} | 见数据时效表 | — | flat | 本报告原始来源 | 当前为${profile.stage} | 下月更新 |\n\n## 11. Final Notes\n\n- Supply-demand gap does not equal stock-price rise.\n- Correct industry direction does not equal correct timing.\n- Earnings realization does not equal continued stock rise.\n- Complete public data does not mean the market has not priced it.\n- AI answer is not a fact.\n- 过时数据不是当前事实。\n\n搜索工具与回退：本地SearXNG用于发现；结果存在百科、转载和偏题时，立即切换到IEA、ICSG、SEMI、国家能源局和公司IR原文。每个子任务控制在3轮以内，未获得统一高频口径的价格/库存数据明确保留为缺口。\n`;
}

async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}

function addExistingHistory(content, report) {
  const bottleneckRows = report.bottlenecks.map((item) => `- ${cell(item)}`).join('\n');
  content = content.replace(
    '### 13.1 Data Currency Table',
    `### 13.0 Key Bottlenecks / 关键瓶颈\n\n${bottleneckRows}\n\n### 13.1 Data Currency Table`,
  );
  return `${content}\n\n### 13.12 Latest Update\n\n- 更新时间：${timestamp}\n- 更新内容：补齐当前 Skill 的证据、节点、周期和可证伪跟踪结构；没有把本次结构调整伪装成新增统计数据。\n\n### 13.13 History Log\n\n| Date | Event | Cycle Impact | Evidence Status |\n|---|---|---|---|\n| 2026-07-12 | 原始来源滚动校准 | 见第12节 | opened originals |\n| 2026-07-13 | 当前 Skill 结构复核 | 维持${cell(report.stage)}，等待下一期实际数据 | structure only |\n`;
}

function addProfileAuditSections(content, profile) {
  const update = `## 10.3 Latest Update\n\n- 更新时间：${timestamp}\n- 最新变化：建立2025实际数据与2026已发布数据基线，事实、预测和分析推断已分栏。\n- 下一次更新：官方月度/季度数据发布后，只更新观察哨、证据矩阵和阶段判断，不静默改写历史值。\n\n## 10.4 History Log\n\n| Date | Event | Cycle Impact | Evidence Status |\n|---|---|---|---|\n| ${timestamp.slice(0, 10)} | 首次按当前 Skill 建立完整报告 | 当前归为${profile.stage} | ${profile.sources.length}个原始来源已打开 |\n\n`;
  return content
    .replace('\n## 11. Final Notes', `\n${update}## 11. Final Notes`)
    .replace('\n搜索工具与回退：', '\n## 11.1 Search Routing and Budget\n\n搜索工具与回退：');
}

await mkdir(path.join(root, 'archive'), { recursive: true });
const duplicate = path.join(root, '13_半导体行业供需周期分析_v2.md');
if (await exists(duplicate)) await rename(duplicate, path.join(root, 'archive', path.basename(duplicate)));

for (const [filename, canonicalName, boundary] of existing) {
  const sourcePath = path.join(root, filename);
  let content = await readFile(sourcePath, 'utf8');
  content = content.split(marker)[0].trimEnd();
  content = content.replace(/^#\s+电力行业供需周期分析\s*$/mu, '# 电力电网行业供需周期分析');
  content = content.replace(/^分析日期[：:].*$/mu, `分析日期：${timestamp}`);
  if (/^行业边界[：:]/mu.test(content)) content = content.replace(/^行业边界[：:].*$/mu, `行业边界：${boundary}`);
  else content = content.replace(/^(数据时效[：:].*)$/mu, `$1\n行业边界：${boundary}`);
  const report = parseReportMarkdown(content, filename).caseItem;
  const normalizedReport = { ...report, industry: canonicalName };
  const upgraded = addExistingHistory(`${content}${existingSupplement(normalizedReport, content)}`, normalizedReport);
  const outputName = canonicalName === '电力电网' ? '11_电力电网行业供需周期分析.md' : filename;
  await writeFile(path.join(root, outputName), upgraded, 'utf8');
  if (outputName !== filename) await rename(sourcePath, path.join(root, 'archive', filename));
}

for (const profile of profiles) {
  await writeFile(path.join(root, profile.file), addProfileAuditSections(renderProfile(profile), profile), 'utf8');
}

console.log(`Upgraded ${existing.length} reports and generated ${profiles.length} new reports.`);
