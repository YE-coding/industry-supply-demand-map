import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseReportMarkdown } from '../src/reportParser.js';

const root = process.cwd();
const outputDir = path.join(root, 'src', 'data');
const outputFile = path.join(outputDir, 'cases.json');
const officialReportsDir = path.join(root, 'public', 'official-reports');

const files = (await readdir(root))
  .filter((file) => /^\d+_.*供需周期分析.*\.md$/u.test(file))
  .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));

const stripMarkdown = (text = '') =>
  text
    .replace(/\r/g, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const matchLine = (content, label) => {
  const match = content.match(new RegExp(`${label}[：:]\\s*([^\\n]+)`, 'iu'));
  return match ? stripMarkdown(match[1]) : '未标注';
};

const matchAnyLine = (content, labels) => {
  for (const label of labels) {
    const value = matchLine(content, label);
    if (value !== '未标注') return value;
  }
  return '未标注';
};

const sectionAfter = (content, headingPattern) => {
  const start = content.search(headingPattern);
  if (start < 0) return '';
  const rest = content.slice(start);
  const next = rest.slice(1).search(/\n##\s+/u);
  return next < 0 ? rest : rest.slice(0, next + 1);
};

const extractJudgment = (content) => {
  const section =
    sectionAfter(content, /##\s*0[.、]?\s*(?:一句话判断|One-Sentence Judgment)/iu) ||
    sectionAfter(content, /##\s*(?:一句话判断|One-Sentence Judgment)/iu);
  const bold = section.match(/\*\*([\s\S]*?)\*\*/u);
  if (bold) return stripMarkdown(bold[1]);
  const lines = section
    .split('\n')
    .map((line) => stripMarkdown(line))
    .filter((line) => line && !line.startsWith('##') && !line.startsWith('---'));
  return lines[0] || '该报告未提取到一句话判断。';
};

const extractChain = (content) => {
  const section =
    sectionAfter(content, /##\s*1[.、]?\s*(?:产业链|Industry Chain)/iu) ||
    sectionAfter(content, /##\s*(?:产业链|Industry Chain)/iu);
  const block = section.match(/```(?:text)?\s*([\s\S]*?)```/u);
  return block ? block[1].trim() : '';
};

const fallbackChains = {
  半导体: ['硅材料/特种气体', '设备', '晶圆制造', '先进封装', '测试', '芯片设计', '终端应用'],
  光通信: ['光芯片', '光器件', '光模块', '交换机/路由器', '数据中心', 'AI训练/推理'],
  AI算力: ['GPU/ASIC', 'HBM', '先进封装', 'AI服务器', '交换机/网络', '电力', '散热', '数据中心', '模型/应用需求'],
  新能源: ['硅料/锂矿', '硅片/正负极', '电池片/电芯', '组件/PACK', '电站/整车', '电网/储能'],
  化工: ['原油/煤炭/天然气', '基础化工原料', '中间体', '精细化工', '终端制造'],
  钢铁: ['铁矿石/焦煤', '焦炭/烧结', '高炉炼铁', '转炉炼钢', '钢材轧制', '建筑/制造需求'],
  焦煤: ['焦煤开采', '洗选配煤', '焦化厂', '焦炭', '高炉炼钢'],
  铁矿石: ['矿山开采', '海运/港口', '钢厂高炉', '粗钢/钢材', '地产/基建/制造'],
  机器人: ['核心零部件', '本体制造', '系统集成', '终端应用', '数据/软件服务'],
  数据中心: ['土建/机电', 'IT设备', '电力系统', '冷却系统', '运维服务', '终端客户'],
  电力: ['能源资源', '发电', '输电', '配电', '用电负荷'],
  电力电网: ['能源资源', '发电', '输电', '配电', '储能/调度', '用电负荷'],
  液冷: ['冷却液', '冷板/浸没方案', 'CDU', '系统集成', '数据中心/服务器'],
};

const fallbackBottlenecks = {
  化工: ['不同子行业的有效产能与真实终端需求错配', '原油、煤炭和天然气成本能否向下游传导', '同质化产能与高认证精细化工的盈利分化'],
  钢铁: ['地产需求偏弱与制造业需求增长之间的结构分化', '高炉产量、钢材库存和终端订单能否同步改善', '铁矿石与焦煤成本能否向钢价传导'],
  焦煤: ['钢厂和焦化厂真实开工需求', '国内安监与矿山产量扰动', '进口焦煤增量对港口库存和价格的冲击'],
  铁矿石: ['主流矿山增量兑现与非主流高成本供给退出', '中国粗钢产量和高炉开工需求', '港口库存、钢厂补库与海运到港节奏'],
  数据中心: ['可获得且可按期接入的电力容量', '土建、机电、网络和冷却系统协同交付', '预租订单能否转为上架容量和持续利用率'],
  电力电网: ['跨区输电、配电和并网工程的实际建设进度', '新能源接入速度与区域消纳能力的错配', '储能、调度和需求响应能否提供足够灵活性'],
  液冷: ['服务器和芯片平台的客户认证与规模导入', '冷板、CDU、泵阀和冷却液的系统可靠性', '全生命周期运维标准和泄漏风险控制'],
};

const cleanChainNode = (part = '') =>
  stripMarkdown(part)
    .replace(/\(.+?\)|（.+?）/g, '')
    .replace(/上游|中游|下游|终端需求|终端|核心环节|关键瓶颈/g, '')
    .replace(/[┌┐└┘│─>]/g, '')
    ?.trim();

const extractChainNodesFromText = (chain, industry) => {
  const lines = chain
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const arrowLine = lines.find((line) => /-->|->|→/u.test(line) && !/^\|/u.test(line));
  if (arrowLine) {
    const nodes = arrowLine
      .split(/-->|->|→/u)
      .map(cleanChainNode)
      .filter((part) => part && part.length >= 2 && part.length <= 28 && /[\p{L}\p{N}]/u.test(part));
    const unique = [...new Set(nodes)].slice(0, 9);
    if (fallbackChains[industry] && unique.length < fallbackChains[industry].length) return fallbackChains[industry];
    if (unique.length >= 3) return unique;
  }

  const verticalNodes = lines
    .filter((line) => !/^(\||↓|\||[-\s]+)$/u.test(line))
    .filter((line) => !/[|]{2,}/u.test(line))
    .filter((line) => !/\s{3,}/u.test(line))
    .map(cleanChainNode)
    .filter((part) => part && part.length >= 2 && part.length <= 28 && /[\p{L}\p{N}]/u.test(part));

  const uniqueVertical = [...new Set(verticalNodes)].slice(0, 9);
  if (fallbackChains[industry] && uniqueVertical.length < fallbackChains[industry].length) return fallbackChains[industry];
  if (uniqueVertical.length >= 3) return uniqueVertical;

  return fallbackChains[industry] || ['上游资源', '核心环节', '终端需求'];
};

const extractSentenceAround = (content, keyword) => {
  const compact = stripMarkdown(content).replace(/([。；;])/g, '$1\n');
  const lines = compact.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => line.includes(keyword) && line.length <= 180) || '';
};

const describeNode = (node, industry, content, bottlenecks, chainNodes, index) => {
  const total = chainNodes.length;
  const position =
    index === 0
      ? '上游入口'
      : index === total - 1
        ? '终端需求'
        : index <= Math.floor(total / 2)
          ? '中游转化'
          : '下游兑现';
  const next = chainNodes[index + 1] || '下游客户';
  const prev = chainNodes[index - 1] || '上游供应商';
  const context = extractSentenceAround(content, node);
  const bottleneck = bottlenecks.find((item) => item.includes(node)) || bottlenecks[index] || bottlenecks[0] || '';

  const rules = [
    [/硅|材料|气体|锂|铁矿|焦煤|冷却液|原油|煤炭|天然气|资源/u, {
      what: '原材料与基础资源',
      does: `为 ${industry} 后续生产提供物理基础和成本底座。`,
      money: '通常通过资源品价格、长协合同、加工价差或材料认证溢价赚钱。',
    }],
    [/设备|光刻|刻蚀|沉积|工艺|CDU|发电/u, {
      what: '设备与基础设施能力',
      does: `决定 ${industry} 的产能释放速度、效率上限和扩产周期。`,
      money: '通过设备销售、系统集成、运维服务或技术壁垒形成利润。',
    }],
    [/制造|晶圆|封装|测试|电池|组件|模块|服务器|中间体|精细/u, {
      what: '制造与集成环节',
      does: `把上游投入转成可交付产品，是订单、收入和毛利兑现的关键位置。`,
      money: '通过加工制造、规模效应、良率提升和客户认证获取利润。',
    }],
    [/芯片|GPU|ASIC|HBM|光芯片|器件|交换机|网络/u, {
      what: '核心部件与性能节点',
      does: `决定产品性能、交付能力和供需弹性，短缺时会限制整条链交付。`,
      money: '通过产品定价权、稀缺产能、技术代际差和客户锁定赚钱。',
    }],
    [/数据中心|电站|电网|输电|配电|终端|应用|需求|AI|模型|用电/u, {
      what: '需求承接与付款场景',
      does: `决定 ${industry} 增长来自真实使用、资本开支、政策约束还是库存周期。`,
      money: '通过服务收费、资源运营、终端产品销售或预算支出体现价值。',
    }],
  ];
  const matched = rules.find(([rule]) => rule.test(node));
  const base = matched?.[1] || {
    what: '产业链节点',
    does: `处在 ${industry} 产业链的 ${position}，需要和上下游一起判断价值。`,
    money: '通过产品销售、服务、加工费、价差或规模效率获取收益。',
  };

  return {
    name: node,
    position,
    what: `${node} 是${base.what}，不是孤立概念，而是产业链里承担具体功能的节点。`,
    does: base.does,
    suppliers: index === 0 ? '资源、设备、工艺、资本或政策条件' : prev,
    buyers: index === total - 1 ? '终端客户、预算方或使用场景' : next,
    money: base.money,
    why: context || bottleneck || `它影响 ${industry} 从需求到订单、价格、产能和利润的传导速度。`,
    evidence: bottleneck || context || '原始报告未给出该节点的独立证据，需回到完整报告继续核验。',
  };
};

const extractBottlenecks = (content, industry) => {
  const lines = content.replace(/\r/g, '').split('\n');
  const start = lines.findIndex((line) => /关键瓶颈|Key Bottlenecks?/iu.test(line));
  if (start < 0) return fallbackBottlenecks[industry] || ['未提取到明确关键瓶颈'];

  const found = [];
  const inline = lines[start].split(/[：:]/u).slice(1).join(':').trim();
  if (inline) found.push(stripMarkdown(inline));

  for (let i = start + 1; i < Math.min(lines.length, start + 12); i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('---') || /^#{2,}\s+/u.test(line)) break;
    if (/^(\d+\.|-|\*)\s+/u.test(line) || /\*\*.+?\*\*/u.test(line)) {
      found.push(stripMarkdown(line.replace(/^(\d+\.|-|\*)\s+/u, '')));
    }
  }

  const cleaned = found.filter(Boolean).slice(0, 5).filter((item) => !/未提取到明确关键瓶颈/u.test(item));
  return cleaned.length ? cleaned : fallbackBottlenecks[industry] || ['未提取到明确关键瓶颈'];
};

const extractSourceHints = (content) => {
  const lines = content
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => stripMarkdown(line))
    .filter(Boolean);

  return lines
    .filter((line) => /数据来源|来源|Source|source|财报|年报|季报|IR|SIA|TrendForce|IDC|Dell'Oro|Wind/u.test(line))
    .map((line) => line.replace(/^[-*]\s*/u, ''))
    .slice(0, 8);
};

const extractMetricHints = (content) => {
  const matches =
    stripMarkdown(content).match(/[\d,.]+(?:\.\d+)?\s*(?:%|亿美元|万亿美元|万亿|亿元|GW|kW|MW|个月|年|倍|家|wpm)/g) || [];
  return [...new Set(matches)].slice(0, 12);
};

const inferStage = (judgment) => {
  const rules = [
    ['出清', '出清期'],
    ['盈利兑现', '盈利兑现期'],
    ['加速扩张', '扩张期'],
    ['结构性扩张', '扩张期'],
    ['扩张', '扩张期'],
    ['爆发增长', '成长期'],
    ['超级周期', '短缺期'],
    ['供不应求', '短缺期'],
    ['短缺', '短缺期'],
    ['过剩', '过剩期'],
    ['成长', '成长期'],
    ['导入', '导入期'],
  ];
  const hit = rules.find(([keyword]) => judgment.includes(keyword));
  return hit ? hit[1] : '待验证';
};

const extractIndustry = (title, file) =>
  stripMarkdown(title)
    .replace(/^#\s*/u, '')
    .replace(/行业供需周期分析(?:（v2）)?/u, '')
    .replace(/供需周期分析(?:（v2）)?/u, '')
    .replace(/Supply-Demand Cycle Analysis(?:\s*\(v2\))?/iu, '')
    .replace(/（v2）/u, '')
    .trim() || file.replace(/\.md$/u, '');

const cases = [];

await rm(officialReportsDir, { recursive: true, force: true });
await mkdir(officialReportsDir, { recursive: true });

for (const file of files) {
  const fullPath = path.join(root, file);
  const content = await readFile(fullPath, 'utf8');
  const title = content.match(/^#\s+(.+)$/mu)?.[1] || file.replace(/\.md$/u, '');
  const judgment = extractJudgment(content);
  const industry = extractIndustry(title, file);
  const bottlenecks = extractBottlenecks(content, industry);
  const chain = extractChain(content);
  const chainNodes = extractChainNodesFromText(chain || sectionAfter(content, /##\s*1[.、]?\s*产业链/u), industry);
  const quality = parseReportMarkdown(content, file).quality;

  const id = file.replace(/\.md$/u, '').replace(/[^\w\u4e00-\u9fa5-]+/gu, '-');
  await writeFile(path.join(officialReportsDir, `${id}.md`), content, 'utf8');

  cases.push({
    id,
    file,
    industry,
    title: stripMarkdown(title),
    date: matchAnyLine(content, ['分析日期', '分析时间', 'Research date', 'Analysis Timestamp']),
    geography: matchAnyLine(content, ['地理范围', 'Geography']),
    dataCurrency: matchAnyLine(content, ['数据时效', '信息搜集范围', '数据范围', 'Data Currency']),
    stage: inferStage(judgment),
    judgment,
    bottlenecks,
    sourceHints: extractSourceHints(content),
    metricHints: extractMetricHints(content),
    chain,
    chainNodes,
    chainNodeDetails: chainNodes.map((node, index) => describeNode(node, industry, content, bottlenecks, chainNodes, index)),
    quality,
    markdownUrl: `official-reports/${encodeURIComponent(id)}.md`,
  });
}

await mkdir(outputDir, { recursive: true });
await writeFile(
  outputFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceCount: cases.length,
      cases,
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Extracted ${cases.length} industry cases to ${path.relative(root, outputFile)}`);
