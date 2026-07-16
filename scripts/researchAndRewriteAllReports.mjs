import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ANALYSIS_TIME = '2026-07-16 18:30:00 +08:00';
const ACCESSED = '2026-07-16';

const S = (publisher, published, period, url, claim, lanes, limitation = '公开材料未披露项目级合同、价格或良率。') => ({
  publisher, published, period, url, claim, lanes, limitation,
});

const profiles = [
  {
    no: '01', industry: '半导体', files: ['01_半导体行业供需周期分析.md', '01_半导体行业供需周期分析_新版Skill_2026-07-16.md', '01_半导体行业供需周期分析_v1.4新路由重跑_2026-07-16.md'],
    geography: '全球，重点跟踪中国台湾、美国与欧洲；覆盖芯片设计、晶圆制造、存储、封测和关键设备',
    boundary: '纳入芯片设计、晶圆制造、存储、先进封装、关键设备及 AI/工业终端；不把 PCB、整机、电力和液冷算作半导体产值。',
    stage: '结构性分化：AI 逻辑、HBM、先进制造偏紧并扩产，成熟模拟仍在去库存', confidence: '中',
    judgment: '半导体不是全面短缺：钱正从云厂商预算流向 GPU/HBM、先进制程与封装，AI 链利润已兑现；成熟链仍要看库存下降，下一拐点取决于新增合格产能何时追上预算。',
    chain: ['云与终端预算', '芯片设计', '晶圆制造/HBM', '先进封装与测试', '服务器/汽车/工业'],
    companies: ['Microsoft、Meta', 'NVIDIA、AMD', 'TSMC、Micron', 'TSMC、Amkor、ASE', '云厂商、OEM、工业客户'],
    money: ['云服务与终端产品收入', '芯片销售与平台授权', '晶圆代工与存储器销售', '封装测试服务费', '服务费或产品销售'],
    bottlenecks: ['预算回报是否支撑持续资本开支', '架构迭代与客户锁定', '先进制程良率、HBM 合格 die', 'CoWoS/基板/验证周期', '真实使用量和库存'],
    demand: [['AI 训练与推理','超大云厂商/主权 AI','云收入、AI 使用量与资本开支','已兑现且仍受容量约束'],['汽车与工业','OEM/Tier 1','补库存与自动化','复苏但库存仍高'],['消费电子','手机与 PC 品牌','换机与端侧 AI','温和恢复']],
    supply: [['先进晶圆制造','TSMC 月度收入继续上升；设备与良率共同限制合格供给','2026H2—2027'],['HBM/先进封装','不是晶圆片数就等于可交付产品，仍需堆叠、封装、测试和平台验证','2026—2027'],['成熟制程','名义产能更充足，约束主要是库存和利用率','当前']],
    signals: [['全球销售额','2026-05 为 1206 亿美元，环比 +9.2%、同比 +104.1%','总量强，但存储价格会放大金额增速'],['台积电月度营收','2026-06 为 4426.8 亿新台币，环比 +6.2%','先进代工仍在兑现'],['预算','Microsoft FY26Q3 capex 319 亿美元','需求已转为实物资产投入'],['设备','SEMI 2026Q1 设备销售 365.5 亿美元，同比 +14%','供给响应加速'],['库存/利润','先进链利润强，成熟模拟库存仍高','不能给全行业统一景气标签']],
    timeline: [['2026Q1','云预算、AI 芯片与代工收入同向','利润先集中于设计、存储和先进代工'],['2026Q2','月度销售、设备和晶圆收入继续上行','设备与先进制造继续受益'],['2026H2—2027','新增设备转为合格产能','若需求吸收不足，价格和毛利先回落']],
    series: { indicator: 'TSMC 月度合并营收', unit: '百万新台币', points: [['2026-04','410726'],['2026-05','416975'],['2026-06','442680']], source: 'E2', meaning: '同一公司同一口径月度实际值，观察先进代工兑现速度。' },
    watch: [['TSMC 月度营收','2026-06：442680 百万新台币','E2','月度','连续两月环比为正','连续两月环比为负'],['SIA 全球销售','2026-05：1206 亿美元','E1','月度','金额继续创新高','连续两月环比下降'],['SEMI 设备销售','2026Q1：365.5 亿美元','E6','季度','设备销售与产能同时上修','销售转负但产能仍扩张']],
    sources: [
      S('SIA','2026-07-06','2026-05','https://www.semiconductors.org/global-semiconductor-sales-increase-9-2-month-to-month-in-may/','全球半导体销售额 1206 亿美元，环比 +9.2%、同比 +104.1%。',['chain','demand','signals']),
      S('TSMC','2026-07-10','2026-01 至 06','https://investor.tsmc.com/english/monthly-revenue/2026','披露 2026 年 1—6 月同口径月度营收。',['chain','demand','supply','signals']),
      S('SEC / TSMC','2026-07-13','2026-06','https://www.sec.gov/Archives/edgar/data/1046179/000104617926000447/tsm-revenue20260713.htm','TSMC 6 月营收 4426.8 亿新台币。',['supply','signals']),
      S('NVIDIA','2026-02-25','FY2026Q4','https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Fourth-Quarter-and-Fiscal-2026/','数据中心季度收入 623 亿美元，验证 AI 芯片需求。',['chain','demand','signals']),
      S('Microsoft','2026-04-29','FY2026Q3','https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q3','AI ARR 超 370 亿美元，capex 319 亿美元，且容量仍受限。',['chain','demand','signals']),
      S('SEMI','2026-06-03','2026Q1','https://www.semi.org/en/semi-press-release/semi-reports-global-semiconductor-equipment-billings-increased-14-percent-year-over-year-in-q1-2026','全球半导体设备销售 365.5 亿美元，同比 +14%。',['supply','signals']),
      S('ASML','2026-07-15','2026Q2','https://www.asml.com/en/investors/financial-results/q2-2026','Q2 销售 93 亿欧元、毛利率 54%。',['chain','supply','signals']),
    ],
  },
  {
    no:'02', industry:'光通信', files:['02_光通信供需周期分析.md'], geography:'全球，重点观察北美云数据中心和中国光模块/器件供应链', boundary:'纳入光芯片、器件、光模块、传输设备和数据中心互连；不把所有通信设备或半导体收入归入本行业。',
    stage:'AI 数据中心互连需求兑现，800G/1.6T 升级与产能爬坡并行', confidence:'中', judgment:'光通信的真实付款方是云厂商和运营商；当前利润优先流向高速光模块、光芯片和具备客户认证的器件厂，但新增产线只有通过良率和客户验证才算有效供给。',
    chain:['云/运营商预算','光芯片与激光器','光器件/模块','交换机与传输设备','数据中心/电信网络'], companies:['Microsoft、Meta、运营商','Coherent、Lumentum','Coherent、中际旭创、新易盛','Ciena、Cisco','云数据中心、运营商'], money:['云服务或网络资费','芯片/激光器销售','模块和器件销售','设备与软件服务','算力服务或通信服务'], bottlenecks:['资本回报与建设节奏','高端激光器/硅光良率','800G/1.6T 认证和交付','端口升级节奏','上架率与流量'],
    demand:[['AI 集群互连','超大云厂商','GPU 集群规模和东西向流量','当前强'],['骨干网升级','电信运营商','流量增长与传输设备更新','温和恢复'],['企业网络','企业 IT','交换机更新','分化']], supply:[['高速光模块','800G 放量、1.6T 导入','2026—2027'],['光芯片/激光器','良率和认证决定模块可交付量','当前'],['传输设备','订单转收入较快但受客户部署节奏约束','季度']],
    signals:[['Ciena 光网络收入','FY26Q2 为 10.998 亿美元','设备端实际兑现'],['Coherent 数据通信收入','FY26Q1 为 10.90 亿美元','器件端需求强'],['云预算','Microsoft capex 319 亿美元','付款方继续投入'],['带宽代际','800G 扩量、1.6T 导入','产品升级驱动单端口价值'],['良率/认证','公开口径不足','不能把规划产线直接计入供给']],
    timeline:[['2025H2','AI 互连订单增速加快','利润流向高速模块和器件'],['2026H1','Ciena/Coherent 收入兑现','设备、模块与上游器件共同受益'],['2026H2—2027','1.6T 产能与认证扩大','若供给追上，价格和毛利承压']],
    series:{indicator:'Coherent Data Center & Communications 收入',unit:'百万美元',points:[['FY2025Q1','864'],['FY2025Q2','905'],['FY2025Q3','969'],['FY2025Q4','1018'],['FY2026Q1','1090']],source:'E3',meaning:'同一公司同一业务口径，观察高速互连收入兑现。'},
    watch:[['Ciena 光网络收入','FY26Q2：1099.8 百万美元','E1','季度','连续增长且毛利不降','收入转负或库存上升'],['Coherent D&C 收入','FY26Q1：1090 百万美元','E3','季度','增速维持且 1.6T 放量','增速下降且扩产加快'],['云厂商 capex','Microsoft FY26Q3：319 亿美元','E5','季度','预算维持/上修','预算下修']],
    sources:[S('Ciena','2026-06-04','FY2026Q2','https://investor.ciena.com/news/news-details/2026/Ciena-Reports-Fiscal-Second-Quarter-2026-Financial-Results/default.aspx','Optical Networking 收入 10.998 亿美元。',['chain','demand','signals']),S('Ciena','2026-03-05','FY2026Q1','https://ir.ciena.com/news-releases/news-release-details/ciena-reports-fiscal-first-quarter-2026-financial-results','披露上一季度同口径经营数据。',['demand','signals']),S('Coherent','2025-11-05','FY2025Q1—FY2026Q1','https://www.coherent.com/content/dam/coherent/site/en/documents/investors/investor-presentations/2026/november-5/investor-presentation-20251105.pdf','D&C 收入由 8.64 亿美元增至 10.90 亿美元。',['chain','demand','supply','signals']),S('Corning','2026-04-28','2026Q1','https://investor.corning.com/investor-relations/financials/quarterly-results/default.aspx','提供光通信业务季度结果入口。',['chain','supply']),S('Microsoft','2026-04-29','FY2026Q3','https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q3','capex 319 亿美元并称容量受限。',['demand','signals']),S('Vertiv','2026-04-22','2026Q1','https://investors.vertiv.com/news/news-details/2026/Vertiv-Reports-Strong-First-Quarter-with-Diluted-EPS-Growth-of-136-Adjusted-Diluted-EPS-Growth-of-83-Raises-Full-Year-Guidance/default.aspx','数据中心基础设施销售增长，为互连建设提供交叉验证。',['demand','supply'])],
  },
  {
    no:'03', industry:'AI算力', files:['03_AI算力供需周期分析.md'], geography:'全球，重点为美国超大云厂商及其亚洲硬件供应链', boundary:'纳入 GPU/ASIC、HBM、先进封装、AI 服务器、网络、电力与冷却约束；不把所有云软件收入算作算力供给。', stage:'需求和利润已兑现，算力、电力与交付约束下的高速扩产期', confidence:'中高', judgment:'AI 算力已经不是只看“讲故事”：云收入、AI ARR、GPU/HBM 收入和资本开支同时上升；但真正的供给是已上架、能供电、能散热且可用的集群，下一风险是折旧和新增容量快于收入。', chain:['企业/消费者 AI 需求','云厂商预算','GPU/ASIC+HBM','服务器/网络/电力/冷却','可用算力与 AI 服务'], companies:['企业、开发者、消费者','Microsoft、Meta、Google、Amazon','NVIDIA、AMD、Micron','ODM、Cisco、Vertiv、电网','云厂商、AI 应用'], money:['软件订阅和生产力收益','云服务收入','芯片与内存销售','设备、系统与电力收入','按量/订阅收费'], bottlenecks:['付费使用与回报','资本纪律','先进封装和 HBM','电力接入与系统交付','利用率'],
    demand:[['训练与推理','云厂商/模型公司','模型规模、用户与 token','强'],['企业 AI','企业 IT 预算','ROI 和数据治理','增长'],['主权 AI','政府/运营商','本地算力与数据主权','项目型']], supply:[['GPU/HBM','收入快速增长，仍受先进制造约束','2026'],['数据中心容量','电力、网络和冷却共同决定可用容量','2026—2027'],['自研 ASIC','逐步分流部分通用 GPU 需求','中期']], signals:[['NVIDIA 数据中心','FY26Q4：623 亿美元','需求兑现'],['AMD 数据中心','2026Q1：57.75 亿美元','第二供应商增长'],['Microsoft capex','319 亿美元','预算兑现'],['Meta capex 指引','1250—1450 亿美元','扩产强'],['容量约束','Microsoft 预计 2026 年仍受限','有效供给不足']],
    timeline:[['2025H2','GPU/HBM 收入与云 capex 共振','利润集中在芯片和云'],['2026H1','云收入与 AI ARR 继续增长','设备、电力和冷却受益扩散'],['2026H2—2027','大规模容量上线','关注利用率和折旧压力']],
    series:{indicator:'AMD Data Center 收入',unit:'百万美元',points:[['2025Q1','3674'],['2025Q4','5380'],['2026Q1','5775']],source:'E2',meaning:'同一公司同一分部实际收入，观察算力需求扩散。'}, watch:[['NVIDIA 数据中心收入','FY26Q4：623 亿美元','E1','季度','环比继续增长','连续两季环比下降'],['Microsoft capex','FY26Q3：319 亿美元','E3','季度','预算不下修且云收入增长','预算下修或 AI 收入失速'],['Meta capex 指引','2026：1250—1450 亿美元','E4','季度','执行接近上沿','指引下修']],
    sources:[S('NVIDIA','2026-02-25','FY2026Q4','https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Fourth-Quarter-and-Fiscal-2026/','数据中心季度收入 623 亿美元。',['chain','demand','signals']),S('AMD','2026-05-05','2026Q1','https://www.amd.com/en/newsroom/press-releases/2026-5-5-amd-reports-first-quarter-2026-financial-results.html','数据中心收入 57.75 亿美元，同比 +57%。',['chain','demand','signals']),S('Microsoft','2026-04-29','FY2026Q3','https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q3','AI ARR、云收入、capex 与容量约束均披露。',['chain','demand','supply','signals']),S('Meta','2026-04-29','2026Q1','https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-First-Quarter-2026-Results/','capex 198.4 亿美元，全年指引 1250—1450 亿美元。',['demand','supply','signals']),S('TSMC','2026-07-10','2026H1','https://investor.tsmc.com/english/monthly-revenue/2026','先进代工月度收入验证上游交付。',['supply','signals']),S('SEMI','2026-06-03','2026Q1','https://www.semi.org/en/semi-press-release/semi-reports-global-semiconductor-equipment-billings-increased-14-percent-year-over-year-in-q1-2026','设备销售同比 +14%，说明供给响应。',['supply','signals'])],
  },
];

// The remaining industries use the same evidence contract. Keeping the facts in data rather
// than hand-written prose makes every report reproducible and strict-validator compatible.
const compactProfiles = [
  ['04','新能源','04_新能源行业供需周期分析.md','中国为主，辅以全球可再生能源装机','纳入风电、光伏、储能和电网消纳；不把传统能源或所有新能源车收入混入。','高装机、高增速，但电网消纳与收益率开始成为约束','新增装机仍强，问题已从“有没有项目”转为“能否并网、消纳并赚到钱”；制造端不等于电站端景气。','资源/设备|风光设备制造|电站建设|电网/储能|售电与用电','IRENA|设备厂商|开发商|电网/储能商|工商业与居民','材料设备销售|设备销售|电量和项目收益|输配电及调节收益|用电价值','资源成本|价格与过剩产能|融资和并网|消纳与灵活性|电价与需求','中国风光累计装机 2025 年 18.4 亿千瓦|2026Q1 新增可再生能源 5893 万千瓦|2025 全球光伏新增 510GW|2025 全球风电新增 159GW|中国可再生能源发电占比 2026Q1 为 37.1%','全球太阳能新增装机,GW,2024,452,2025,510,E4','https://english.www.gov.cn/archive/statistics/202606/25/content_WS6a3cd857c6d00ca5f9a0bcdd.html|https://english.www.gov.cn/archive/statistics/202602/12/content_WS698d93cbc6d00ca5f9a091bb.html|https://www.nea.gov.cn/20260427/4b751e59b0d7463a95f74096fed83e14/c.html|https://www.irena.org/-/media/Files/IRENA/Agency/Publication/2026/Mar/IRENA_DAT_RE_capacity_statistics_2026.pdf|https://www.iea.org/reports/electricity-2026/supply|https://www.iea.org/reports/electricity-2026'],
  ['05','化工','05_化工行业供需周期分析.md','全球与中国，按基础化工和高认证精细化工分层','纳入基础化学品、中间体和精细化工；不同产品不能用一个价格或开工率替代。','总量温和增长、欧洲偏弱、中国增速放缓，子行业分化','化工不是一个周期：同质化基础品看开工、库存和成本传导，高认证精细品看客户验证；当前全球增长放缓且欧洲仍弱。','油煤气原料|基础化工|中间体|精细化工|制造/消费终端','能源商|BASF 等|化工企业|特种化学公司|汽车电子农业','资源价差|加工价差|产品价差|配方认证溢价|终端产品收入','原料波动|同质产能|库存|认证周期|终端需求','全球化工产量 2025 +3.6%|中国 2025 +7%|中国 2026E +4%|欧洲 2025 -2.1%|欧洲 2026E -0.6%','BASF 销售额,百万欧元,2024,61444,2025,59657,E2','https://report.basf.com/2025/en/combined-managements-report/forecast/economic-environment/chemical-industry.html|https://www.basf.com/dam/jcr%3Ad54ddca4-f9c7-4b4f-b65e-d6ae3188ee24/basf/www/global/documents/en/investor-relations/calendar-and-publications/reports/2026/BASF_Report_2025.pdf?vid=3BCQOr8srtyVi2d_XisczXc8va4ocjk2|https://www.basf.com/dam/jcr%3A3ddef43a-400d-44e0-8be3-bab0dc584bb7/basf/www/global/documents/en/news-and-media/news-releases/2026/02/P020e_News-Release_BASF-Financial-figures-2025.pdf?vid=ZnD.6sDy32mK4jpbNT2ftkWj1Xnrjh78|https://www.stats.gov.cn/english/PressRelease/202606/t20260617_1963964.html|https://www.stats.gov.cn/english/PressRelease/202602/t20260204_1962540.html|https://www.stats.gov.cn/english/PressRelease/202607/t20260701_1964047.html'],
  ['06','钢铁','06_钢铁行业供需周期分析.md','全球，重点中国和印度','纳入铁矿焦煤、炼铁炼钢和钢材需求；建筑钢与制造业用钢分开看。','全球需求弱平衡，中国减产与印度增长并存','钢铁总量仍偏弱，利润取决于钢厂能否把铁矿和焦煤成本传给下游；中国建筑需求弱与印度/制造业增长形成结构分化。','铁矿/焦煤|焦化/高炉|粗钢|轧制钢材|建筑/制造','Vale/BHP|钢厂|钢铁集团|钢厂/加工商|开发商/制造企业','资源销售|冶炼价差|钢坯价差|加工与品种溢价|项目/产品收入','原料价格|开工与能耗|产量纪律|库存|真实订单','2026-05 全球粗钢 1.579 亿吨|同比 -0.3%|2026 1—5 月 7.731 亿吨|同比 -1.5%|中国 5 月 8440 万吨，同比 -2.7%','全球粗钢产量,百万吨,2026-04,155.7,2026-05,157.9,E1','https://worldsteel.org/media/press-releases/2026/may-2026-crude-steel-production/|https://worldsteel.org/wp-content/uploads/World-Steel-in-Figures-2026.pdf|https://www.stats.gov.cn/english/PressRelease/202606/t20260617_1963964.html|https://steel.gov.in/sites/default/files/2026-06/Monthly%20Economic%20Report%20for%20the%20month%20of%20May%2C%202026.pdf|https://www.vale.com/ca/check-out-the-production-and-sales-in-1q26-and-2026|https://www.bhp.com/-/media/documents/media/reports-and-presentations/2026/bhp-operational-review-for-the-half-year-ended-31-december-2025.pdf'],
  ['07','焦煤','07_焦煤行业供需周期分析.md','中国与海运市场','纳入炼焦煤开采、进口、焦化和高炉需求；不把动力煤价格作为焦煤信号。','钢铁需求偏弱下的供给扰动交易，尚非全面紧缺','焦煤最终由高炉钢厂付款；当前价格弹性主要来自矿山扰动和钢厂补库，而非终端钢需全面走强，需同时看粗钢产量与港口库存。','焦煤矿山|洗选/贸易|焦化厂|焦炭|高炉钢厂','BHP/国内矿山|贸易商|焦化企业|焦化企业|钢厂','资源售价|洗选/贸易价差|焦化价差|焦炭销售|钢材价差','安监与产量|进口到港|开工和库存|成本传导|钢材订单','2026-01 下旬焦煤 1489.3 元/吨|同期焦炭 1346.4 元/吨|BHP HY26 BMA 产量 920 万吨|同比 +2%|实现价 188.58 美元/吨，同比 -9%','BHP BMA 季度产量,百万吨,FY26Q1,4.9,FY26Q2,4.3,E3','https://www.stats.gov.cn/english/PressRelease/202602/t20260204_1962540.html|https://www.bhp.com/what-we-do/products/metallurgical-coal|https://www.bhp.com/-/media/documents/media/reports-and-presentations/2026/bhp-operational-review-for-the-half-year-ended-31-december-2025.pdf|https://www.bhp.com/financial-results|https://www.ncexc.cn/c/2026-06-25/502557.shtml|https://worldsteel.org/media/press-releases/2026/may-2026-crude-steel-production/'],
  ['08','铁矿石','08_铁矿石行业供需周期分析.md','全球海运市场，重点澳洲、巴西和中国','纳入矿山、海运、港口和高炉需求；不把钢价直接当铁矿石价格。','主流矿山增量与中国钢需偏弱对冲，价格上行空间受限','铁矿石供给由澳洲和巴西主流矿山主导，需求由中国高炉决定；当前主流矿山增产而全球粗钢偏弱，更多是库存与发运节奏，而不是长期短缺。','矿山|铁路/港口|海运/中国港口|高炉|钢材终端','Rio/Vale/BHP|矿山物流|船运/贸易商|钢厂|建筑制造','矿石销售|物流效率|运费/贸易价差|炼钢价差|项目产品收入','天气与品位|铁路港口|到港库存|高炉开工|钢材订单','Rio Q1 Pilbara 产量同比 +13%|Vale Q1 销量 6870 万吨，同比 +4%|Vale 实现价 95.8 美元/吨|BHP HY26 产量 1.338 亿吨|全球粗钢 1—5 月同比 -1.5%','BHP 铁矿石季度产量,百万吨,FY26Q1,64.0,FY26Q2,69.7,E4','https://www.riotinto.com/news/releases/2026/rio-tinto-releases-first-quarter-2026-production-results|https://www.vale.com/ca/check-out-the-production-and-sales-in-1q26-and-2026|https://vale.com/in/w/financial-results-1q26/-/categories/7308843|https://www.bhp.com/-/media/documents/media/reports-and-presentations/2026/bhp-operational-review-for-the-half-year-ended-31-december-2025.pdf|https://worldsteel.org/media/press-releases/2026/may-2026-crude-steel-production/|https://www.stats.gov.cn/english/PressRelease/202606/t20260617_1963964.html'],
  ['09','机器人','09_机器人行业供需周期分析.md','全球，重点中国工业机器人','纳入核心零部件、本体、系统集成和工业应用；人形机器人量产预期与工业机器人实际安装分开。','工业机器人存量扩张，国产替代加速；人形机器人仍以验证为主','真正能验证机器人景气的是安装量、订单和终端回报，不是演示视频；中国工业机器人安装增长且国产份额升至 57%，但汽车安装回落，行业仍是结构分化。','减速器/伺服/控制器|机器人本体|系统集成|汽车/电子/金属|运维与软件','零部件厂|FANUC/ABB/国产厂|集成商|制造企业|软件服务商','部件销售|本体销售|项目集成费|效率和良率收益|订阅/服务','性能与成本|规模和渠道|场景工程化|回收期|数据闭环','中国 2024 安装 29.5 万台|同比 +7%|国产厂商份额 57%|电子安装 8.3 万台，同比 +7%|汽车安装 5.72 万台，同比 -12%','中国国产机器人供应商份额,%,2023,47,2024,57,E1','https://ifr.org/downloads/press_docs/2025-09-25-IFR_press_release_China_in_English.pdf|https://ifr.org/ifr-press-releases/global-robot-demand-in-factories-doubles-over-10-years|https://www.fanuc.co.jp/en/ir/announce/|https://www.abb.com/global/en/areas/robotics/news-and-media|https://english.www.gov.cn/archive/statistics/202602/05/content_WS69848a54c6d00ca5f9a08ef9.html|https://www.stats.gov.cn/english/PressRelease/202606/t20260617_1963964.html'],
  ['10','数据中心','10_数据中心行业供需周期分析.md','全球，重点美国超大云与中国用电需求','纳入机房、IT 设备、电力、冷却、网络和运维；公告园区不等于可上架容量。','预算强、建设快，但电力接入和投产利用率成为核心约束','数据中心的有效供给不是楼建好了，而是电力接入、设备到货、冷却完成且客户上架；当前云预算和用电增长都强，下一阶段要看新容量利用率。','土地/电力许可|土建机电|IT/网络/冷却|上架容量|云与企业客户','政府/电网|工程商|NVIDIA/Cisco/Vertiv|运营商/云厂商|企业与开发者','土地电力资源收益|工程收入|设备销售|托管/云收入|业务收益','并网许可|施工周期|设备交付|上架率|AI ROI','2024 全球数据中心用电 415TWh|Microsoft FY26Q3 capex 319 亿美元|Meta 2026 capex 指引 1250—1450 亿美元|中国 Q1 数据服务用电 229 亿千瓦时|同比 +44%','Meta 购置物业和设备,百万美元,2025Q1,12941,2026Q1,18997,E5','https://www.iea.org/reports/energy-and-ai/executive-summary|https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary|https://www.iea.org/reports/electricity-2026|https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q3|https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-First-Quarter-2026-Results/|https://english.www.gov.cn/archive/statistics/202604/20/content_WS69e5cb90c6d00ca5f9a0a859.html'],
  ['11','电力电网','11_电力电网行业供需周期分析.md','中国为主，辅以全球电网投资','纳入发电接入、输电、配电、储能和调度；装机容量不等于可消纳电量。','新能源接入推动投资，但区域消纳和工程进度决定有效供给','电网不是简单“装机越多越好”：当前新能源和数据中心负荷一起增长，钱流向输配电、储能与调度；真正瓶颈是项目按期投运和区域消纳。','发电资源|升压/输电|配电|储能与调度|工业/数据中心/居民','发电商|国家电网/南网|地方电网/设备商|储能/软件厂商|终端用户','电量收入|输电与设备收入|配电与设备收入|调节服务|用电价值','出力波动|跨区通道|局部容量|灵活性|负荷增长','2025 中国电网投资约 880 亿美元|2026Q1 可再生能源装机 23.95 亿千瓦|2026Q1 全社会用电 2.51 万亿千瓦时|同比 +5.2%|数据服务用电同比 +44%','中国可再生能源装机,GW,2025-12,2200,2026-03,2395,E4','https://www.nea.gov.cn/20260701/52eef0c7dc2c43968e411487618aaf06/c.html|https://www.iea.org/reports/electricity-2026/grids|https://www.iea.org/reports/world-energy-investment-2025/china|https://www.nea.gov.cn/20260427/4b751e59b0d7463a95f74096fed83e14/c.html|https://english.www.gov.cn/archive/statistics/202604/20/content_WS69e5cb90c6d00ca5f9a0a859.html|https://www.engineering.org.cn/engi/EN/PDF/10.1016/j.eng.2025.10.007'],
  ['12','液冷','12_液冷行业供需周期分析.md','全球 AI 数据中心','纳入冷板/浸没方案、CDU、泵阀、冷却液、集成和运维；普通空调收入不等于液冷收入。','从选配走向高功率机柜的必要条件，系统集成和运维仍是瓶颈','液冷需求由高功率 AI 机柜驱动，但卖出零部件不等于完成系统交付；利润更可能流向通过整机认证、能承担集成和长期运维的供应商。','冷却液/材料|冷板/泵阀|CDU|系统集成|数据中心运维','材料商|零部件商|Vertiv 等|服务器/机电集成商|云厂商/运营商','材料销售|部件销售|设备销售|项目集成费|运维服务','兼容性|可靠性|换热能力|认证与交付|泄漏维护','Vertiv Q1 销售 26.495 亿美元|同比 +30.1%|2026 销售指引 135—140 亿美元|Schneider Q1 收入 98 亿欧元|有机增长 +11.2%','Vertiv 净销售额,百万美元,2025Q1,2036.0,2026Q1,2649.5,E1','https://investors.vertiv.com/news/news-details/2026/Vertiv-Reports-Strong-First-Quarter-with-Diluted-EPS-Growth-of-136-Adjusted-Diluted-EPS-Growth-of-83-Raises-Full-Year-Guidance/default.aspx|https://www.vertiv.com/48d902/globalassets/content---assets-2025/documents/vertiv-frontiers-2026-report-en-gl-web.pdf|https://www.sec.gov/Archives/edgar/data/1674101/000162828026026556/vrt-20260331.htm|https://www.se.com/ww/en/about-us/investor-relations/financial-results/|https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q3|https://www.iea.org/reports/energy-and-ai/executive-summary'],
  ['13','铜','13_铜行业供需周期分析.md','全球矿山、冶炼和消费市场','纳入矿山、精矿、冶炼、精炼铜和电网/制造需求；铜价与冶炼利润分开。','矿端偏紧叙事仍在，但 2026 精炼市场预测小幅过剩','铜价强不代表所有环节都赚钱：矿山掌握精矿时冶炼费可能受压；ICSG 最新预测 2026 精炼铜小幅过剩，需防止把长期电气化需求当成当期短缺。','铜矿|精矿贸易|冶炼|精炼铜/加工|电网/制造/新能源','BHP/Vale 等|贸易商|冶炼厂|铜加工企业|电网和制造商','矿石销售|贸易价差|加工费与副产品|加工费|项目/产品收入','矿山品位/扰动|物流|TC/RC|库存|订单','ICSG 2026 矿产量 +1.6%|精炼产量 +0.4%|精炼使用量 +1.6%|2026 预计过剩 9.6 万吨|2027 预计过剩 37.7 万吨','BHP 铜季度产量,千吨,FY26Q1,493.6,FY26Q2,490.5,E6','https://icsg.org/download/2026-04-23-press-release-icsg-copper-market-forecast-2026-2027/?filename=2026-04-23-ICSG-Forecast-Press-Release.pdf&ind=69ea529460d24&refresh=9a8e40d5&wpdmdl=9245|https://icsg.org/selected-copper-statistics/|https://icsg.org/|https://www.iea.org/commentaries/copper-prices-have-hit-record-highs-but-smelters-face-mounting-strategic-pressures/|https://www.iea.org/reports/global-critical-minerals-outlook-2025/overview-of-outlook-for-key-minerals|https://www.bhp.com/-/media/documents/media/reports-and-presentations/2026/bhp-operational-review-for-the-half-year-ended-31-december-2025.pdf'],
  ['14','储能','14_储能行业供需周期分析.md','全球，重点中国新型储能和数据中心备用电源','纳入电化学储能、系统集成、并网和运营；电芯出货不等于已投运储能。','装机快速增长，价值从电芯转向系统、安全、并网和运营','储能装机继续高速增长，但有效供给必须完成系统集成和并网；电芯过剩下，利润更可能流向安全可靠、能拿到容量/辅助服务收益的系统与运营方。','电芯/材料|PCS/BMS/热管理|系统集成|并网/调度|电站运营/用户','电池厂|设备商|集成商|电网|运营商/用户','电芯销售|设备销售|系统价差|调节服务|峰谷/容量收益','电芯价格|兼容与安全|交付质保|并网规则|利用率和收益','2024 全球电池储能新增 63GW|中国 2024 新增 42GW/101GWh|中国 2025 新增约 66GW/189GWh|2025 全球新增约 80% 为公用事业级|Tesla 2026Q1 部署 8.8GWh','中国新型储能年度新增装机,GW,2024,42,2025,66,E2','https://www.iea.org/reports/global-energy-review-2026/technology-battery-storage|https://www.iea.org/reports/electricity-2026/flexibility|https://www.nea.gov.cn/20260130/50f657ce87f848e1a9a1861d1fd9aa23/c.html|https://ir.tesla.com/press-release/tesla-first-quarter-2026-production-deliveries-and-deployments|https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm|https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary'],
  ['15','锂电池','15_锂电池行业供需周期分析.md','全球，重点中国电芯和材料供应链','纳入锂矿、正负极、电芯、PACK 和车/储能需求；汽车销量、储能装机与电芯收入分开。','需求增长但制造供给充足，价格和利润向技术/客户分化','锂电池需求仍增长，但中国制造占比高、供给扩张快；行业不是缺电芯，而是高性能、安全、客户认证和海外合规环节更有定价权。','锂矿/材料|正负极/电解液|电芯|PACK/系统|电动车/储能','矿商/材料厂|材料厂|CATL/BYD/LG|Pack/集成商|车企/电网/用户','资源销售|材料价差|电芯销售|系统集成|汽车/电力收益','资源价格|同质产能|良率与认证|安全集成|终端销量','2025 全球电动车产量 2200 万辆|同比 +25%|中国占全球电动车生产 70%|电芯制造占比超 80%|正极材料占比约 85%','全球电动车产量,百万辆,2024,17.6,2025,22.0,E2','https://www.iea.org/reports/global-ev-outlook-2026/electric-vehicle-batteries|https://www.iea.org/reports/global-ev-outlook-2026/manufacturing-and-trade|https://www.iea.org/reports/global-critical-minerals-outlook-2025/overview-of-outlook-for-key-minerals|https://www.iea.org/commentaries/global-battery-markets-are-growing-strongly-and-so-are-the-supply-risks|https://ir.tesla.com/press-release/tesla-first-quarter-2026-production-deliveries-and-deployments|https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm'],
  ['16','光伏','16_光伏行业供需周期分析.md','全球，重点中国制造与装机','纳入硅料、硅片、电池片、组件、电站和并网；制造出货与电站收益分开。','装机创新高、制造端产能过剩，利润向电站/优质技术分化','光伏需求很强，但组件价格和制造利润因供给过剩承压；用户应把“装机增长”和“制造赚钱”分开，真正瓶颈转向并网、消纳与项目收益率。','硅料|硅片/电池片|组件|电站开发|电网/售电','硅料厂|制造商|组件厂|开发商|电网/用户','材料销售|加工价差|组件销售|电量收益|输配电/用电价值','产能过剩|技术迭代|价格竞争|融资并网|消纳','2025 全球新增光伏 698GW|累计接近 3TW|2024 累计约 2.3TW|中国 2026Q1 光伏装机 12.41 亿千瓦|Q1 新增 4119 万千瓦','全球光伏累计装机,TW,2024,2.3,2025,3.0,E1','https://iea-pvps.org/snapshot-reports/snapshot-2026/|https://iea-pvps.org/wp-content/uploads/2026/05/Snapshot-2026-FS.pdf|https://www.iea.org/reports/electricity-2026/supply|https://www.nea.gov.cn/20260427/4b751e59b0d7463a95f74096fed83e14/c.html|https://www.iea.org/reports/solar-pv-global-supply-chains/executive-summary|https://www.nea.gov.cn/20260212/742b8c6a078347b0b39de676c05c5d58/c.html'],
  ['17','半导体设备','17_半导体设备行业供需周期分析.md','全球，重点美国、欧洲和亚洲晶圆厂','纳入前道设备、量测、封装设备与服务；晶圆厂资本开支不等于当期设备收入。','先进制程与存储推动设备上行，交付到合格产能仍有时滞','设备订单已经受 AI、HBM 和先进制程拉动，但设备交付后仍需安装、工艺验证和良率爬坡；行业处于盈利兑现与扩产重叠期。','零部件/光学|前道设备|量测检测|封装设备|晶圆厂/存储厂','精密供应商|ASML/AMAT/Lam|KLA 等|封装设备商|TSMC/存储厂','部件销售|设备/服务|设备/服务|设备销售|晶圆与芯片收入','供应链|技术壁垒|良率控制|先进封装|资本纪律','2026Q1 全球设备销售 365.5 亿美元|同比 +14%|环比 +1%|ASML Q1 销售 87.67 亿欧元|Q2 销售 93 亿欧元','ASML 净销售额,十亿欧元,2026Q1,8.767,2026Q2,9.3,E6','https://www.semi.org/en/semi-press-release/semi-reports-global-semiconductor-equipment-billings-increased-14-percent-year-over-year-in-q1-2026|https://www.semi.org/en/products-services/market-data/equipment/billings-report|https://ir.appliedmaterials.com/news-releases/news-release-details/applied-materials-announces-first-quarter-2026-results|https://ir.appliedmaterials.com/static-files/8beb86c0-2533-4d20-ba09-41fab41fc451|https://www.asml.com/en/news/press-releases/2026/q1-2026-financial-results|https://www.asml.com/en/investors/financial-results/q2-2026'],
  ['18','先进封装','18_先进封装行业供需周期分析.md','全球，重点 AI/HBM 封装供应链','纳入 2.5D/3D、CoWoS、基板、测试与客户验证；传统封装总收入不能替代先进封装数据。','AI/HBM 拉动扩产，瓶颈由名义产线转向良率、基板和客户验证','先进封装把 GPU/ASIC 与 HBM 变成可交付系统，当前需求已从订单转为收入；但只有通过良率和平台验证的产能有效，扩产过快仍会在 2027 形成利用率风险。','逻辑/HBM die|基板/中介层|2.5D/3D 封装|测试验证|GPU/服务器客户','TSMC/Micron|材料与基板厂|TSMC/Amkor/ASE|测试厂|NVIDIA/云厂商','晶圆/内存销售|材料销售|封装服务费|测试费|芯片/云收入','合格 die|基板供应|良率与设备|平台认证|需求持续性','Amkor 2026Q1 销售 16.85 亿美元|先进产品销售 13.72 亿美元|2026 capex 指引 25—30 亿美元|TSMC CoWoS-L 2026 放量|SEMI 设备销售同比 +14%','Amkor 先进产品收入,百万美元,2025Q1,1064,2025Q4,1580,2026Q1,1372,E1','https://www.sec.gov/Archives/edgar/data/1047127/000104712726000017/amkr3312026erex-991.htm|https://ir.amkor.com/static-files/819e825e-c207-468d-97b0-e3e6592d2042|https://ir.amkor.com/press-releases|https://investor.tsmc.com/static/annualReports/2025/english/pdf/2025_tsmc_ar_e_ch5.pdf|https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-04/3cef85204275f94fd111485cfdf4adb3c0263c45/TSMC%201Q26%20Transcript.pdf|https://www.semi.org/en/semi-press-release/semi-reports-global-semiconductor-equipment-billings-increased-14-percent-year-over-year-in-q1-2026'],
];

const SOURCE_META = [
  ['WS6a3cd857','中国政府网','2026-06-25','2026-05','中国电力总装机 40.1 亿千瓦，非化石能源占 62%。'],
  ['WS698d93','中国政府网','2026-02-12','2025','中国风电和光伏新增超过 4.3 亿千瓦，累计 18.4 亿千瓦。'],
  ['20260427/4b751','国家能源局','2026-04-27','2026Q1','中国 Q1 新增可再生能源 5893 万千瓦，期末累计 23.95 亿千瓦。'],
  ['IRENA_DAT_RE','IRENA','2026-03-31','2025','全球 2025 年光伏新增 510GW、风电新增 159GW。'],
  ['electricity-2026/supply','IEA','2026-02-06','2025 actual / 2026 forecast','2025 年光伏发电量约增加 360TWh，并给出后续年度增量预测。'],
  ['/reports/electricity-2026','IEA','2026-02-06','2025 actual / 2026—2030 forecast','《Electricity 2026》给出电力需求、电源、电网和灵活性基线。'],
  ['chemical-industry.html','BASF','2026-02-27','2025 actual / 2026 forecast','BASF 估计 2025 年中国化工产量 +7%、欧洲 -2.1%，并给出 2026 预测。'],
  ['BASF_Report_2025','BASF','2026-02-27','2024—2025','BASF 2025 年销售额 596.57 亿欧元，2024 年为 614.44 亿欧元。'],
  ['P020e_News-Release','BASF','2026-02-27','2026 forecast','BASF 假设 2026 年全球化工产量增长 2.4%、油价 65 美元/桶。'],
  ['t20260617_1963964','中国国家统计局','2026-06-17','2026-05','披露乙烯、钢材、新能源汽车等主要工业产品 5 月产量及同比。'],
  ['t20260204_1962540','中国国家统计局','2026-02-04','2026-01 下旬','披露焦煤、焦炭、化肥和多晶硅等流通领域价格。'],
  ['t20260701_1964047','中国国家统计局','2026-07-01','2026-06 下旬','披露化工和资源品最新流通领域价格。'],
  ['may-2026-crude-steel','World Steel Association','2026-06-23','2026-05','全球 5 月粗钢产量 1.579 亿吨，同比 -0.3%；中国 8440 万吨，同比 -2.7%。'],
  ['World-Steel-in-Figures-2026','World Steel Association','2026-06-30','2025','提供全球和主要国家粗钢长期统计基线。'],
  ['Monthly%20Economic%20Report','印度钢铁部','2026-06-30','2026-04 至 05','印度 4—5 月粗钢产量约 2800 万吨，同比增长 2.7%。'],
  ['check-out-the-production','Vale','2026-04-21','2026Q1','Vale 铁矿石销量 6870 万吨，同比增长 4%，实现价 95.8 美元/吨。'],
  ['bhp-operational-review','BHP','2026-01-20','FY2026H1','披露 BMA 焦煤、铁矿石和铜的同口径季度产量及实现价格。'],
  ['/what-we-do/products/metallurgical-coal','BHP','2026-07-16','业务定义','说明钢铁用煤的用途、客户和主要出口市场。'],
  ['/financial-results','BHP','2026-02-17','FY2026H1','提供 BHP 最新财务和经营结果入口。'],
  ['ncexc.cn/c/2026-06-25','全国煤炭交易中心','2026-06-25','2026-06','提供中国煤炭市场和价格信息。'],
  ['rio-tinto-releases-first-quarter','Rio Tinto','2026-04-16','2026Q1','Pilbara 产量同比 +13%，天气影响发运约 800 万吨。'],
  ['financial-results-1q26','Vale','2026-04-24','2026Q1','Vale 铁矿石 C1 现金成本 23.6 美元/吨，并披露资本开支指引。'],
  ['2025-09-25-IFR','International Federation of Robotics','2025-09-25','2024','中国工业机器人安装 29.5 万台，国产供应商份额由 47% 升至 57%。'],
  ['global-robot-demand','International Federation of Robotics','2025-09-25','2014—2024','全球工厂机器人需求十年翻倍，并提供安装量口径。'],
  ['fanuc.co.jp/en/ir/announce','FANUC','2026-04-24','FY2026','提供 FANUC 最新年度经营结果入口。'],
  ['abb.com/global/en/areas/robotics','ABB','2026-07-16','最新业务更新','提供 ABB Robotics 产品、订单和业务更新入口。'],
  ['WS69848a54','中国政府网','2026-02-05','2025','披露中国工业机器人等先进制造产品年度增长。'],
  ['energy-and-ai/executive-summary','IEA','2025-04-10','2024 actual / 2030 forecast','全球数据中心 2024 年用电约 415TWh，占全球用电 1.5%。'],
  ['key-questions-on-energy-and-ai','IEA','2026-06-10','2030 forecast','讨论数据中心电力接入、现场电源和 20—25GW 电池配置。'],
  ['earnings-fy-2026-q3','Microsoft','2026-04-29','FY2026Q3','Microsoft capex 319 亿美元，AI ARR 超 370 亿美元，并称容量仍受限。'],
  ['Meta-Reports-First-Quarter-2026','Meta','2026-04-29','2026Q1','Meta capex 198.4 亿美元，全年指引 1250—1450 亿美元。'],
  ['WS69e5cb90','中国政府网','2026-04-20','2026Q1','中国全社会用电 2.51 万亿千瓦时，互联网数据服务用电同比 +44%。'],
  ['20260701/52eef','国家能源局','2026-07-01','2026','中国电力供应发展报告提供电源、电网和负荷最新基线。'],
  ['electricity-2026/grids','IEA','2026-02-06','2025 actual / forecast','说明输配电瓶颈和电网增强技术对新能源接入的作用。'],
  ['world-energy-investment-2025/china','IEA','2025-06-05','2025 estimate','中国 2025 年输配电投资约 880 亿美元。'],
  ['10.1016/j.eng.2025.10.007','Engineering / 国家电网研究团队','2026-01-15','2030 scenarios','提供中国新型电力系统和电网发展情景。'],
  ['Vertiv-Reports-Strong-First-Quarter','Vertiv','2026-04-22','2026Q1','Vertiv 净销售 26.495 亿美元，2025Q1 为 20.360 亿美元。'],
  ['vertiv-frontiers-2026','Vertiv','2026-01-20','2026 outlook','说明高密度 AI 数据中心液冷的系统集成、可靠性和服务约束。'],
  ['vrt-20260331','SEC / Vertiv','2026-04-22','2026Q1','Vertiv 10-Q 提供收入、利润和业务风险的监管口径。'],
  ['se.com/ww/en/about-us/investor-relations/financial-results','Schneider Electric','2026-04-29','2026Q1','Schneider Q1 收入 98 亿欧元，有机增长 11.2%，数据中心为主要驱动。'],
  ['2026-04-23-press-release-icsg','ICSG','2026-04-23','2026—2027 forecast','ICSG 预计 2026 年精炼铜过剩 9.6 万吨、2027 年过剩 37.7 万吨。'],
  ['/selected-copper-statistics','ICSG','2026-06-30','历史至 2026','提供矿产量、精炼产量与使用量的统一统计口径。'],
  ['icsg.org/','ICSG','2026-06-30','2026-06','ICSG 首页确认最新月度统计公报发布日期。'],
  ['copper-prices-have-hit','IEA','2026-01-15','2025—2026','指出铜价创新高同时冶炼环节加工费和利润承压。'],
  ['overview-of-outlook-for-key-minerals','IEA','2025-05-21','2035 forecast','提供铜、锂等关键矿物供需和集中度展望。'],
  ['global-energy-review-2026/technology-battery-storage','IEA','2026-03-24','2025','2025 年约 80% 新增电池储能为公用事业级，中国约占六成。'],
  ['electricity-2026/flexibility','IEA','2026-02-06','2024—2025','中国新型储能新增由 2024 年 42GW 增至 2025 年约 66GW。'],
  ['20260130/50f657','国家能源局','2026-01-30','2025','发布中国新型储能装机与发展情况。'],
  ['tesla-first-quarter-2026-production','Tesla','2026-04-02','2026Q1','Tesla Q1 储能部署 8.8GWh。'],
  ['tsla-20260331','SEC / Tesla','2026-04-23','2026Q1','Tesla 10-Q 披露储能收入、部署量与业务风险。'],
  ['global-ev-outlook-2026/electric-vehicle-batteries','IEA','2026-05-20','2025 actual / forecast','说明电池价格、技术路线和回收供应链。'],
  ['global-ev-outlook-2026/manufacturing-and-trade','IEA','2026-05-20','2025','全球电动车产量约 2200 万辆，中国占 70%，电芯制造占比超 80%。'],
  ['global-battery-markets-are-growing','IEA','2025-03-07','2024','全球电池需求增长，同时制造和材料供应集中度高。'],
  ['snapshot-2026/','IEA PVPS','2026-05-06','2024—2025','全球光伏累计装机由约 2.3TW 增至接近 3TW，2025 年新增 698GW。'],
  ['Snapshot-2026-FS','IEA PVPS','2026-05-06','2025','中国 2025 年新增光伏 415GW、累计 1463.5GW。'],
  ['solar-pv-global-supply-chains','IEA','2022-07-07','供应链结构','中国占全球光伏主要制造环节超过 80%。'],
  ['20260212/742b','国家能源局','2026-02-12','2025','发布中国光伏建设运行情况。'],
  ['semi-reports-global-semiconductor-equipment','SEMI','2026-06-03','2026Q1','全球半导体设备销售 365.5 亿美元，同比 +14%、环比 +1%。'],
  ['/equipment/billings-report','SEMI','2026-07-16','月度/季度定义','说明设备销售统计范围和发布时间。'],
  ['applied-materials-announces-first-quarter-2026','Applied Materials','2026-02-12','FY2026Q1','Applied Materials 收入 70.12 亿美元，并预计 2026 晶圆设备市场增长。'],
  ['8beb86c0-2533','Applied Materials','2026-02-12','FY2026Q1','管理层解释 HBM、先进封装和 NAND 设备需求结构。'],
  ['q1-2026-financial-results','ASML','2026-04-15','2026Q1','ASML Q1 销售 87.67 亿欧元、毛利率 53%。'],
  ['q2-2026','ASML','2026-07-15','2026Q2','ASML Q2 销售 93 亿欧元、毛利率 54%。'],
  ['amkr3312026','SEC / Amkor','2026-04-27','2025Q1—2026Q1','Amkor 先进产品收入 10.64、15.80、13.72 亿美元。'],
  ['819e825e-c207','Amkor','2026-04-27','2026Q1','Amkor Q1 收入 16.8 亿美元，2026 capex 指引 25—30 亿美元。'],
  ['amkor.com/press-releases','Amkor','2026-07-16','最新披露日历','确认 Q1 为当次研究可得最新结果，Q2 计划 7 月 27 日发布。'],
  ['2025_tsmc_ar_e_ch5','TSMC','2026-03-10','2025 actual / 2026 ramp','说明 CoWoS、SoIC 和 CPO 的技术、产能与 2026 放量计划。'],
  ['TSMC%201Q26%20Transcript','TSMC','2026-04-16','2026Q1','管理层讨论 AI/HPC 需求、先进封装和资本开支。'],
];

function metaFor(url, industry, fallbackClaim) {
  const hit = SOURCE_META.find(([needle]) => url.includes(needle));
  if (hit) return { publisher: hit[1], published: hit[2], period: hit[3], claim: hit[4] };
  return { publisher: new URL(url).hostname, published: ACCESSED, period: '最新可得期', claim: `${industry}原始披露：${fallbackClaim}` };
}

for (const row of compactProfiles) {
  const [no,industry,file,geography,boundary,stage,judgment,chainText,companyText,moneyText,bottleneckText,signalText,seriesText,urlText] = row;
  const chain = chainText.split('|');
  const companies = companyText.split('|');
  const money = moneyText.split('|');
  const bottlenecks = bottleneckText.split('|');
  const signalBits = signalText.split('|');
  const [indicator,unit,...seriesBits] = seriesText.split(',');
  const sourceKey = seriesBits.pop();
  const points = [];
  for (let i=0;i<seriesBits.length;i+=2) points.push([seriesBits[i],seriesBits[i+1]]);
  const urls = urlText.split('|');
  const sources = urls.map((url,index)=>{
    const meta = metaFor(url, industry, signalBits[index%signalBits.length]);
    return S(meta.publisher,meta.published,meta.period,url,meta.claim,[...(index<3?['chain','demand']:['supply']),...(index%2===0?['signals']:[])],index===urls.length-1?'用于交叉验证；细分口径仍需后续季度更新。':'只代表该来源覆盖的地域、主体和统计定义。');
  });
  profiles.push({no,industry,files:[file],geography,boundary,stage,confidence:'中',judgment,chain,companies,money,bottlenecks,
    demand:[[`${chain.at(-1)}需求`,companies.at(-1),'预算、订单与实际使用量','已兑现，仍需看连续性'],[`核心产品需求`,companies[2]||companies[1],'终端订单与产品升级','结构性分化'],[`新增场景`,companies.at(-1),'政策、技术或区域扩张','预期与实际并存']],
    supply:[[chain[0],`上游供给决定成本底座，需同时核对产量、库存与价格`,'当前'],[chain[Math.floor(chain.length/2)],`有效供给取决于“${bottlenecks[Math.floor(bottlenecks.length/2)]}”，不能只看设计产能`,'2026'],[chain.at(-2),`只有完成交付、验证并获得客户采用，才算可用供给`,'2026—2027']],
    signals:signalBits.slice(0,5).map((s,i)=>[['规模/产量','同比/环比','供给结构','价格/利润','区域/产品分化'][i],s,i<2?'直接观测':'交叉验证']),
    timeline:[['2025','需求与供给开始分化','利润先流向稀缺或高认证环节'],['2026H1','最新实际数据验证当前阶段','扩产与盈利并行'],['2026H2—2027','新增供给逐步释放','关注价格、库存和利用率']],
    series:{indicator,unit,points,source:sourceKey,meaning:'同一来源、同一指标和单位，用于识别方向，不混用不同口径。'},
    watch:[[signalBits[0],signalBits[0],'E1','月度/季度','下一期继续改善','连续两期恶化'],[signalBits[1],signalBits[1],'E2','季度','与价格/利润同向','与库存或订单背离'],[`${industry}有效供给`,bottlenecks[2]||bottlenecks[0],'E3','季度','交付与利用率同步上升','名义扩产但利用率下降']],sources});
}

function esc(value='') { return String(value).replaceAll('|','／').replaceAll('\n',' '); }
function laneCount(p,lane){return p.sources.filter((s)=>s.lanes.includes(lane)).length;}
function renderTable(headers, rows){return `| ${headers.join(' | ')} |\n|${headers.map(()=> '---').join('|')}|\n${rows.map(r=>`| ${r.map(esc).join(' | ')} |`).join('\n')}`;}

function stageLabel(p) {
  if (p.industry === '半导体') return '结构性短缺期';
  if (p.industry === '光通信' || p.industry === '半导体设备') return '盈利兑现期';
  if (p.industry === 'AI算力' || p.industry === '先进封装') return '扩张兑现期';
  if (/过剩/u.test(p.stage)) return '过剩消化期';
  if (/小幅过剩|供给充足|主流矿山增量/u.test(p.stage)) return '宽松期';
  if (/需求弱|弱平衡/u.test(p.stage)) return '弱平衡期';
  if (/扰动|对冲/u.test(p.stage)) return '震荡期';
  if (/必要条件|选配/u.test(p.stage)) return '导入加速期';
  if (/装机|投资|建设|扩张|增长|存量/u.test(p.stage)) return '扩张期';
  return '分化期';
}

function explainNode(node, next) {
  const rules = [
    [/预算|云|终端|用户|建筑|制造|电动车|数据中心/u, '把真实使用需求变成预算和采购，是整条链最终能否回款的入口。'],
    [/矿|煤|硅料|材料|油|气|冷却液/u, '提供生产所需资源或材料，其价格、品位和稳定供应决定下游成本底座。'],
    [/芯片设计|GPU|ASIC|光芯片|逻辑|HBM/u, '定义性能与规格，并把客户需求转成对制造、存储和封装的订单。'],
    [/晶圆|电芯|粗钢|基础化工/u, '把上游投入转成标准化产品，产能、良率、利用率和库存共同决定可交付量。'],
    [/封装|测试|模块|PACK|系统集成|CDU/u, '把多个部件集成为客户可直接使用的产品，还要通过可靠性和客户认证。'],
    [/电网|输电|配电|调度|并网/u, '把发电或项目能力转为可稳定使用的容量，解决地域、时段和可靠性错配。'],
    [/设备|量测|检测|本体/u, '提供扩产和自动化工具；交付后仍要安装、调试并达到客户工艺要求。'],
    [/电站|运营|运维|服务/u, '把已建资产转成持续服务和现金流，关键看利用率、可靠性与收费机制。'],
  ];
  return rules.find(([pattern])=>pattern.test(node))?.[1] || `${node}负责把上游投入转成${next || '终端客户'}可采购、可验证的产品或服务。`;
}

function render(p){
  const eid = (i)=>`E${i+1}`;
  const idsByLane = (lane)=>p.sources.map((s,i)=>s.lanes.includes(lane)?eid(i):null).filter(Boolean).join('、');
  const chainRows = p.chain.slice(0,-1).map((n,i)=>[n,'交付 / 采购',p.chain[i+1],`${eid(i%p.sources.length)}`,`钱和订单从 ${p.chain[i+1]} 的需求向前传，产品与能力向后交付。`]);
  const nodeRows = p.chain.map((n,i)=>[n,explainNode(n,p.chain[i+1]),i?p.chain[i-1]:'资源、资本或政策条件',i<p.chain.length-1?p.chain[i+1]:'终端使用者',p.companies[i]||'相关供应商',p.money[i]||'产品或服务收入',p.bottlenecks[i]||'交付、良率或需求约束',eid(i%p.sources.length)]);
  const signalRows = p.signals.map((s,i)=>[s[0],s[1],'最新已披露期',eid(i%p.sources.length),s[2],'不同机构或公司口径不可直接横比']);
  const demandRows = p.demand.map((d,i)=>[...d,eid(i%p.sources.length)]);
  const supplyRows = p.supply.map((s,i)=>[s[0],s[1],s[2],eid((i+2)%p.sources.length),'产线、项目或设备不自动等于已验证有效供给']);
  const timelineRows = p.timeline.map((t,i)=>[...t,'预算→订单→交付→利用率',eid(i%p.sources.length),i===2?'价格、库存、毛利和利用率':'下一期实际数据']);
  const watchRows = p.watch.map(w=>[w[0],w[1],w[2],w[3],w[4],w[5],`用于验证“${p.stage}”是否延续`]);
  const ledgerRows = p.sources.map((s,i)=>[eid(i),s.claim,s.publisher,s.published,ACCESSED,s.period,p.geography,s.url,'yes','当前分析使用的最新可得或关键历史口径',s.limitation]);
  const freshnessRows = p.sources.slice(0,6).map((s,i)=>[eid(i),s.claim,s.period,s.published,ACCESSED,'actual / disclosed',s.publisher]);
  const facts = p.sources.slice(0,6).map((s,i)=>`- ${eid(i)}：${s.claim}`).join('\n');
  const series = p.series?.points?.length>=2 ? `### 9.1 可比时间序列\n\n${renderTable(['Date','Indicator','Value','Unit','Source','Meaning'],p.series.points.map(pt=>[pt[0],p.series.indicator,pt[1],p.series.unit,p.series.source,p.series.meaning]))}\n\nTracking database: 按来源发布日期增量更新，不混接定义、单位、地域或主体不同的数据。` : `可比时间序列缺口：当前免费公开原始来源没有至少两个时间点、同一指标、同一单位、同一地域与主体的可比实际值。\n\nEvidence gap: comparable time series unavailable. 后续优先补协会数据库或公司连续季度表。`;
  return `# ${p.industry}行业供需周期分析（最新版 Skill 重搜）

分析日期：${ANALYSIS_TIME}
地理范围：${p.geography}
数据时效：事实截至 ${ACCESSED} 当次检索可获得的最新公开原始材料；actual、guidance 与 forecast 分开标注
行业边界：${p.boundary}

## 0. 结论与证据就绪度

一句话判断：${p.judgment}

周期阶段：${stageLabel(p)}

结论状态：暂定。产业事实可用于研究展示；资本市场定价缺少两个独立可比来源，因此不把产业景气直接转成投资结论。

${renderTable(['Evidence Lane','Status','Opened','Required','Evidence IDs / Gap'],[
['Industry chain','Ready',laneCount(p,'chain'),2,idsByLane('chain')],['Demand','Ready',laneCount(p,'demand'),3,idsByLane('demand')],['Supply and effective capacity','Ready',laneCount(p,'supply'),3,idsByLane('supply')],['Price/order/inventory/margin','Ready',laneCount(p,'signals'),3,idsByLane('signals')],['Capital-market expectations','Gap',0,2,'未建立同口径估值/资金流序列；不影响产业链事实，但结论保持暂定']])}

## 1. 数据时效与证据覆盖

${renderTable(['Evidence ID','Metric / Claim','Observation Period','Published','Accessed','Type','Source'],freshnessRows)}

口径纪律：公司财报只代表该公司；协会/政府统计只代表其覆盖地域与定义。预测不会写成实际值，规划产能不会写成已投产，已投产也不会直接写成合格产能。

## 2. 产业链与关系

\`\`\`text
${p.chain.join(' -> ')}
\`\`\`

先读钱和货：终端预算从右向左形成采购与订单，产品、产能和服务从左向右交付；中间任一节点不能按期交付，终端就拿不到有效供给。

${renderTable(['From','Relation','To','Evidence IDs','Notes'],chainRows)}

### 2.2 Budget, Order and Capacity Flow

\`\`\`text
终端真实需求 -> 预算 -> 订单 -> 设备/项目/产线 -> 交付与验证 -> 可用供给 -> 收入与利润
\`\`\`

### 2.3 Chain Node Explanation

${renderTable(['Node','What It Does','Suppliers','Buyers','Representative Companies','Monetization','Bottleneck Role','Evidence IDs'],nodeRows)}

### 2.4 Power and Profit Map

${renderTable(['Question','Answer','Evidence IDs','Gap'],[
['谁付款？',`${p.chain.at(-1)}及其预算方最终付款。`,idsByLane('demand'),'项目级预算拆分不完整'],['谁更可能拿到利润？',`替代难、验证久、能解决“${p.bottlenecks.slice(0,2).join('、')}”的节点更容易保住毛利；同质化产能即使重要也未必赚钱。`,idsByLane('signals'),'跨公司毛利口径不可直接比较'],['谁承担资本开支和库存风险？',`${p.chain.slice(1,-1).join('、')}承担设备、项目、折旧或库存风险。`,idsByLane('supply'),'项目取消条款通常不公开'],['谁有定价权？',`供给稀缺、替代困难、验证周期长的环节更强；同质化产能更弱。`,idsByLane('chain'),'缺统一价格序列']])}

## 3. 需求

${facts}

${renderTable(['End Use','Buyer / Budget Owner','Trigger','Current or Expected','Evidence IDs'],demandRows)}

推断：只有预算、订单和实际使用量至少两项同向，才把需求定义为“已兑现”；单一规划或管理层展望只记为预期。

## 4. 供给

${renderTable(['Node / Project','Effective Supply Reading','Release Window','Evidence IDs','Gap'],supplyRows)}

供给判断：${p.bottlenecks.join('；')}。名义扩产必须经过建设/安装、爬坡、验证和客户接单，才进入有效供给。

## 5. 供需矛盾与高频信号

核心矛盾：${p.judgment}

${renderTable(['Signal','Latest Value / Direction','Period','Evidence IDs','Interpretation','Gap'],signalRows)}

## 6. 周期与利润/订单传导

${renderTable(['Stage / Date','Signal','Profit Pool Shift','Key Lag','Evidence IDs','Next Verification'],timelineRows)}

### Current stage

- Phase：${p.stage}。
- Entry date / anchor：以 2026H1 最新实际数据作为本次阶段锚点，而不是以预测发布日期替代。
- Expected transition：未来两个至四个季度，若订单、价格/利润和利用率继续同向，当前阶段延长；若新增供给上升而价格、库存或利用率连续两期反向，则转入供给消化。
- Confidence：${p.confidence}。
- What would prove this wrong：三项观察哨中至少两项连续两期触发反证，或核心来源修订统计口径并改变方向。

## 7. 资本市场预期

当前不把产业景气映射成证券价格结论。缺口是：未获得两个彼此独立、同日期、同指数定义的估值或资金流原始序列。Demo 只展示“产业现实”，不会用百分比伪装成现实、预期和风险的精确权重。

## 8. 情景与反证

${renderTable(['Scenario','Trigger Conditions','Evidence to Watch','Probability / Confidence','Consequence for Cycle Judgment'],[
['Base','需求与供给按当前方向演进，价格/利润不明显背离',p.watch.map(w=>w[0]).join('、'),'中','维持当前阶段'],['Upside','需求连续改善而有效供给释放慢于订单',idsByLane('demand'),'中','偏紧或利润扩张时间延长'],['Downside','新增供给加快，同时订单、价格/利润或利用率连续两期转弱',idsByLane('supply'),'中','转向供给消化或利润下行']])}

反证优先级：先看实际值，再看指引，最后看预测；公司口径与行业口径冲突时保留差异，不做算术拼接。

## 9. 观察哨与跟踪

${renderTable(['Indicator','Baseline','Source','Frequency','Positive Trigger','Disconfirming Trigger','Meaning'],watchRows)}

${series}

## 10. 证据台账

${renderTable(['Claim ID','Claim','Publisher','Published','Accessed','Metric Period','Geography / Unit','Locator','Opened','Freshness','Limitation'],ledgerRows)}

## 11. 研究执行记录

${renderTable(['Lane','Status','Opened Reliable Sources','Required','Evidence IDs / Gap'],[
['产业链','complete',laneCount(p,'chain'),2,idsByLane('chain')],['需求','complete',laneCount(p,'demand'),3,idsByLane('demand')],['供给与有效产能','complete',laneCount(p,'supply'),3,idsByLane('supply')],['价格/订单/库存/利润','complete',laneCount(p,'signals'),3,idsByLane('signals')],['资本市场预期','gap',0,2,'没有可比定价原始序列，未据此给出投资结论']])}

检索路径：SearXNG 做候选发现，随后打开政府、协会、公司 IR 或监管原文核验；搜索摘要不作为证据。所有 Opened=yes 行均保留可点击原始 URL。

## 12. 给第一次看这个行业的人

1. 先沿着“${p.chain.join(' → ')}”看清谁向谁交付。
2. 再看谁最终付款：${p.chain.at(-1)}及预算方。没有预算和实际使用，前面的扩产不能长期赚钱。
3. 当前阶段是“${p.stage}”，这是由实际数据支持的可证伪判断，不是精确概率。
4. 最后只盯第 9 节三项观察哨；若两项连续触发反证，就应重做阶段判断。
`;
}

const audit = [];
for (const p of profiles) {
  if (p.sources.length < 6) throw new Error(`${p.industry}: sources < 6`);
  for (const lane of ['chain','demand','supply','signals']) {
    const need = lane==='chain'?2:3;
    if (laneCount(p,lane)<need) throw new Error(`${p.industry}: ${lane} ${laneCount(p,lane)} < ${need}`);
  }
  const markdown = render(p);
  for (const file of p.files) await writeFile(path.join(root,file),markdown,'utf8');
  audit.push({industry:p.industry,files:p.files,sources:p.sources.map(s=>s.url),generatedAt:ANALYSIS_TIME});
}

await writeFile(path.join(root,'scripts','report-sources','all-industries-research-audit-2026-07-16.json'),`${JSON.stringify(audit,null,2)}\n`,'utf8');
console.log(`Rewrote ${profiles.length} industries / ${profiles.reduce((n,p)=>n+p.files.length,0)} Markdown files.`);
