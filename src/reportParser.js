import { comparePeriodLabels } from './periodSort.js';

const stripMarkdown = (text = '') =>
  String(text)
    .replace(/\r/g, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const compactLines = (text = '') =>
  String(text)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const slugify = (value = '') =>
  stripMarkdown(value)
    .replace(/[^\w\u4e00-\u9fa5-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'user-report';

const normalizeTableHeader = (value = '') =>
  stripMarkdown(value)
    .toLowerCase()
    .replace(/[\s/_-]+/gu, '');

const matchLine = (content, label) => {
  const match = content.match(new RegExp(`${label}(?:\\*\\*)?[：:]\\s*([^\\n]+)`, 'u'));
  return match ? stripMarkdown(match[1]) : '';
};

const matchAnyLine = (content, labels) => {
  for (const label of labels) {
    const value = matchLine(content, label);
    if (value) return value;
  }
  return '';
};

const sectionAfter = (content, headingPattern) => {
  const start = content.search(headingPattern);
  if (start < 0) return '';
  const rest = content.slice(start);
  const next = rest.slice(1).search(/\n##\s+/u);
  return next < 0 ? rest : rest.slice(0, next + 1);
};

const subsectionAfter = (content, headingPattern) => {
  const start = content.search(headingPattern);
  if (start < 0) return '';
  const rest = content.slice(start);
  const next = rest.slice(1).search(/\n#{1,6}\s+/u);
  return next < 0 ? rest : rest.slice(0, next + 1);
};

const splitMarkdownRow = (line = '') =>
  line
    .trim()
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => stripMarkdown(cell));

const isMarkdownSeparator = (line = '') => {
  const cells = splitMarkdownRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell.replace(/\s+/g, '')));
};

const tableRowsFromLines = (lines, startIndex = 0) => {
  for (let i = startIndex; i < lines.length - 1; i += 1) {
    if (!lines[i].trim().startsWith('|') || !isMarkdownSeparator(lines[i + 1])) continue;
    const headers = splitMarkdownRow(lines[i]);
    const rows = [];
    for (let j = i + 2; j < lines.length; j += 1) {
      if (!lines[j].trim().startsWith('|')) break;
      const values = splitMarkdownRow(lines[j]);
      if (values.some(Boolean)) {
        rows.push(Object.fromEntries(headers.map((header, index) => [normalizeTableHeader(header), values[index] || ''])));
      }
    }
    return rows;
  }
  return [];
};

const readFirstTableInSection = (section = '') => tableRowsFromLines(section.replace(/\r/g, '').split('\n'));

const readTableAfterHeading = (content, headingPattern) => {
  const lines = content.replace(/\r/g, '').split('\n');
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start < 0) return null;
  const startLevel = lines[start].match(/^#+/u)?.[0].length || 6;

  for (let i = start + 1; i < lines.length - 1; i += 1) {
    const headingLevel = lines[i].match(/^#+(?=\s)/u)?.[0].length;
    if (headingLevel && headingLevel <= startLevel && i > start + 1) return null;
    if (!lines[i].trim().startsWith('|') || !isMarkdownSeparator(lines[i + 1])) continue;
    return tableRowsFromLines(lines, i);
  }
  return null;
};

const textAfterHeading = (content, headingPattern) => {
  const section = subsectionAfter(content, headingPattern);
  return compactLines(section)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('#') && !line.startsWith('|') && !line.startsWith('---'))
    .map((line) => stripMarkdown(line.replace(/^[-*]\s*/u, '')))
    .find(Boolean) || '';
};

const pickTableValue = (row, aliases) => {
  for (const alias of aliases) {
    const value = row?.[normalizeTableHeader(alias)];
    if (value) return value;
  }
  return '';
};

const normalizeMeaning = (value = '') => stripMarkdown(value)
  .replace(/[\s，。；;：:、“”‘’]/gu, '')
  .toLocaleLowerCase();

const bottleneckScore = (line = '', index = 0) => {
  let score = 10 - index * 0.01;
  if (/良率|认证|验证|交付|交期|供电|散热|电力|并网|消纳|容量|产能|上架|封装|HBM|库存|过剩|开工|品位|扰动|合规|安全|可靠|利用率/iu.test(line)) score += 8;
  if (/资本纪律|回报|成本|价格|同质|技术|壁垒|客户/iu.test(line)) score += 3;
  if (/付款|预算|需求|流量/iu.test(line)) score -= 2;
  return score;
};

const rankedUniqueBottleneckLines = (lines = [], ignoredKeys = new Set()) => {
  const seen = new Set();
  return lines
    .map((line, index) => ({ line: stripMarkdown(line), index }))
    .filter(({ line }) => {
      const key = normalizeMeaning(line);
      if (!key || seen.has(key) || ignoredKeys.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({ ...item, score: bottleneckScore(item.line, item.index) }))
    .sort((left, right) => right.score - left.score)
    .map((item) => item.line);
};

const resolveBottlenecks = (rawBottlenecks = [], { judgment, supplyStatus, chainNodeDetails = [] } = {}) => {
  const ignoredKeys = new Set([
    normalizeMeaning(judgment),
    normalizeMeaning(supplyStatus),
  ].filter(Boolean));

  const explicit = rankedUniqueBottleneckLines(rawBottlenecks, ignoredKeys)
    .filter((line) => !/未提取到明确关键瓶颈/u.test(line));
  if (explicit.length) return explicit.slice(0, 5);

  return rankedUniqueBottleneckLines(
    chainNodeDetails.map((node) => node.why),
    ignoredKeys,
  ).slice(0, 5);
};

const parseComparableNumber = (value = '') => {
  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/u);
  return match ? Number(match[0]) : Number.NaN;
};

const firstSentence = (text = '') => {
  const line = stripMarkdown(text);
  return line.match(/^(.+?[。；;])/u)?.[1] || line;
};

const extractSentenceAround = (content, keyword) => {
  const compact = stripMarkdown(content).replace(/([。；;])/g, '$1\n');
  return compact.split('\n').map((line) => line.trim()).find((line) => line.includes(keyword) && line.length <= 180) || '';
};

const extractIndustry = (title, file) =>
  stripMarkdown(title)
    .replace(/^#\s*/u, '')
    .replace(/行业供需周期分析[：:—\-].*$/u, '')
    .replace(/行业供需周期分析(?:（v2）)?/u, '')
    .replace(/供需周期分析(?:（v2）)?/u, '')
    .replace(/Industry Supply-Demand Cycle Analysis/iu, '')
    .replace(/Supply-Demand Cycle Analysis/iu, '')
    .replace(/（v2）/u, '')
    .replace(/(?:（[^）]*(?:v\d|skill|重跑|新路由|最新)[^）]*）|\([^)]*(?:v\d|skill|rerun|new route|latest)[^)]*\))$/iu, '')
    .trim() || file.replace(/\.md$/u, '');

const extractJudgment = (content) => {
  const onePage = sectionAfter(content, /##\s*0[.、]?\s*(?:一页看懂|One Page)/iu);
  const onePageLabeled = onePage.match(/(?:一句话判断|当前判断)[：:]\s*([^\n]+)/iu);
  if (onePageLabeled) return stripMarkdown(onePageLabeled[1]);
  const cyclePosition = onePage.match(/(?:\*\*)?周期(?:位置|阶段)(?:\*\*)?[：:]\s*([^\n]+)/iu);
  if (cyclePosition) return stripMarkdown(cyclePosition[1]);

  const readiness = sectionAfter(content, /##\s*0[.、]?\s*(?:结论与证据就绪度|Conclusion and Evidence Readiness)/iu);
  const labeled = readiness.match(/(?:一句话判断|One-Sentence Judgment)[：:]\s*([^\n]+)/iu);
  if (labeled) return stripMarkdown(labeled[1]);

  const topLevelLabeled = content.match(/(?:^|\n)(?:一句话判断|当前判断|One-Sentence Judgment)[：:]\s*([^\n]+)/iu);
  if (topLevelLabeled) return stripMarkdown(topLevelLabeled[1]);

  const currentJudgment = textAfterHeading(content, /###\s*(?:当前判断|Current Judgment)/iu);
  if (currentJudgment) return currentJudgment;

  const stageJudgment = sectionAfter(content, /##\s*5[.、]?\s*周期位置与传导/iu)
    .match(/阶段判断[：:]\s*(?:\*\*)?([^*\n]+)(?:\*\*)?/iu)?.[1];
  if (stageJudgment) return stripMarkdown(stageJudgment);

  const section =
    sectionAfter(content, /##\s*0[.、]?\s*(?:一句话判断|One-Sentence Judgment)/iu) ||
    sectionAfter(content, /##\s*(?:一句话判断|One-Sentence Judgment)/iu);
  const bold = section.match(/\*\*([\s\S]*?)\*\*/u);
  if (bold) return stripMarkdown(bold[1]);
  const line = compactLines(section).map(stripMarkdown).find((item) => !item.startsWith('##') && !item.startsWith('---'));
  return line || '该报告未提取到一句话判断。';
};

const extractChain = (content) => {
  const newSection = sectionAfter(content, /##\s*1[.、]?\s*(?:产业链地图)/iu);
  const mermaid = newSection.match(/```mermaid\s*([\s\S]*?)```/iu);
  if (mermaid) return mermaid[1].trim();

  const section =
    sectionAfter(content, /##\s*2[.、]?\s*(?:产业链与关系|Industry Chain and Relationships)/iu) ||
    sectionAfter(content, /##\s*1[.、]?\s*(?:产业链|Industry Chain)/iu) ||
    sectionAfter(content, /##\s*(?:产业链|Industry Chain)/iu);
  const block = section.match(/```(?:text)?\s*([\s\S]*?)```/u);
  if (block) return block[1].trim();
  return section
    .split('\n')
    .filter((line) => /-->|->|→|↓/u.test(line))
    .slice(0, 8)
    .join('\n')
    .trim();
};

const cleanChainNode = (part = '') =>
  stripMarkdown(part)
    .replace(/\(.+?\)|（.+?）/g, '')
    .replace(/[┌┐└┘│─>]/g, '')
    .trim();

const isUsefulChainNode = (part) =>
  Boolean(part) && part.length >= 2 && part.length <= 34 && /[\p{L}\p{N}]/u.test(part);

const extractMermaidNodes = (chain = '') => {
  if (!/flowchart|graph|-->/iu.test(chain)) return [];
  const nodes = [];
  const matches = chain.matchAll(/(?:^|\s)[A-Za-z0-9_]+\s*(?:\["?([^\]"]+)"?\]|\(([^)]+)\)|\{([^}]+)\})/gmu);
  for (const match of matches) {
    const label = stripMarkdown(match[1] || match[2] || match[3]);
    if (isUsefulChainNode(label)) nodes.push(label);
  }
  return [...new Set(nodes)].slice(0, 12);
};

const extractChainNodesFromText = (chain = '') => {
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
      .filter(isUsefulChainNode);
    const unique = [...new Set(nodes)].slice(0, 12);
    if (unique.length >= 3) return unique;
  }
  const uniqueVertical = [...new Set(lines.map(cleanChainNode))]
    .filter(isUsefulChainNode)
    .filter((node) => !/^#{1,6}\s/u.test(node))
    .filter((node) => !/^(来源|数据来源|Source|风险|反证|关键瓶颈)[：:]/iu.test(node))
    .slice(0, 12);
  return uniqueVertical.length >= 3 ? uniqueVertical : [];
};

const extractOnePage = (content) => {
  const section = sectionAfter(content, /##\s*0[.、]?\s*(?:一页看懂|One Page)/iu);
  if (!section) return {};
  const introSection = subsectionAfter(section, /###\s*(?:这个行业是做什么的|What This Industry Does)/iu);
  const currentSection = subsectionAfter(section, /###\s*(?:当前判断|Current Judgment)/iu);
  const keyNumbers = readTableAfterHeading(section, /^###\s*(?:三个最重要的数字|Three Most Important Numbers)/iu)
    || readFirstTableInSection(section)
    || [];
  const boldIntro = matchAnyLine(section, ['这个行业是做什么的', 'What This Industry Does']);
  const boldJudgment = matchAnyLine(section, ['一句话判断', '当前判断', 'Current Judgment']);
  return {
    industryIntro: stripMarkdown(introSection.split('\n').filter((line) => line && !line.startsWith('#')).join(' ')) || boldIntro,
    keyNumbers: keyNumbers.map((row) => ({
      number: pickTableValue(row, ['数字', 'Number']),
      period: pickTableValue(row, ['截止期间', '期间', '时点', 'Period']),
      question: pickTableValue(row, ['它回答什么问题', '含义', 'Meaning']),
      conclusion: pickTableValue(row, ['结论', '当前解读', '为什么它最重要', 'Why It Matters']),
      evidence: pickTableValue(row, ['证据', 'Evidence']),
    })).filter((row) => row.number),
    currentJudgment: (currentSection
      .split('\n')
      .map((line) => stripMarkdown(line.replace(/^[-*]\s*/u, '')))
      .filter((line) => line && !line.startsWith('###'))).length
      ? currentSection
        .split('\n')
        .map((line) => stripMarkdown(line.replace(/^[-*]\s*/u, '')))
        .filter((line) => line && !line.startsWith('###'))
      : [boldJudgment].filter(Boolean),
  };
};

const extractChainNodeDetails = (content) => {
  const newSection = sectionAfter(content, /###\s*1\.2\s*(?:各环节详解|环节详解)/iu);
  if (newSection) {
    const lines = newSection.replace(/\r/g, '').split('\n');
    const starts = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /^#{3,4}\s*1\.2\.\d+\s+/u.test(line));
    const parts = starts.map(({ line, index }, itemIndex) => {
      const level = line.match(/^#+/u)?.[0].length || 4;
      const nextStart = lines.findIndex((candidate, candidateIndex) => (
        candidateIndex > index
        && candidateIndex < (starts[itemIndex + 1]?.index ?? lines.length)
        && (candidate.match(/^#+(?=\s)/u)?.[0].length || 99) <= level
      ));
      const end = starts[itemIndex + 1]?.index ?? (nextStart >= 0 ? nextStart : lines.length);
      return lines.slice(index, end).join('\n');
    });
    const nodes = parts.map((part) => {
      const heading = stripMarkdown(part.match(/^#{3,4}\s*1\.2\.\d+\s+(.+)$/mu)?.[1] || '');
      if (!heading) return null;
      const rows = readFirstTableInSection(part);
      const companyRows = rows.map((row) => ({
        name: pickTableValue(row, ['代表企业', '公司']),
        role: pickTableValue(row, ['角色', '在该环节的地位']),
        code: pickTableValue(row, ['上市地/代码', '上市地', '代码']),
        why: pickTableValue(row, ['观察意义', '为什么能代表该环节', '为什么具有代表性', '代表性']),
      })).filter((company) => company.name);
      const companies = companyRows.map((company) => (
        [company.name, company.code, company.role || company.why].filter(Boolean).join(' · ')
      ));
      const paragraphs = part
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && !line.startsWith('|') && !/^[-*]\s+\*\*/u.test(line) && !/^\*\*进阶视角/u.test(line));
      const advancedLines = part
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^(?:[-*]\s*)?\*\*(?:进阶视角|口径陷阱|争议)/u.test(line))
        .map((line) => stripMarkdown(line.replace(/^[-*]\s*/u, '')));
      // Parse **label**：value lines to extract structured fields
      const extractLabeledField = (patterns) => {
        const line = paragraphs.find((p) => patterns.some((pat) => pat.test(p)));
        if (!line) return '';
        return stripMarkdown(line).replace(/^[^：:]+[：:]\s*/u, '').trim();
      };
      const what = extractLabeledField([/它是干什么的|What It Does|What It Is|核心动作/iu])
        || stripMarkdown(paragraphs[0] || '').replace(/^[^：:]{2,20}[：:]\s*/u, '');
      const suppliers = extractLabeledField([/上游买什么|上游.*下游|供应商|Suppliers|Key Suppliers/iu]);
      const buyers = extractLabeledField([/下游卖给谁|买家|客户|Buyers|Key Buyers/iu]);
      const money = extractSentenceAround(part, '怎么赚钱') || extractSentenceAround(part, '收入') || extractSentenceAround(part, '收费') || extractSentenceAround(part, '毛利') || '';
      const why = extractSentenceAround(part, '约束') || extractSentenceAround(part, '瓶颈') || extractSentenceAround(part, '争议') || '';
      return {
        name: heading,
        position: '报告环节',
        what,
        does: what,
        suppliers,
        buyers,
        companyRows,
        companies: companies.join('；'),
        money,
        why,
        evidence: [...new Set([...part.matchAll(/\bE\d+\b/gu)].map((match) => match[0]))].join('、'),
        advanced: advancedLines,
      };
    }).filter(Boolean);
    if (nodes.length) return nodes;
  }

  const compactNodeSection = subsectionAfter(
    content,
    /###\s*1\.2\s*(?:节点与可替代性|节点与替代性|有效供给不是名义投资)/iu,
  );
  const compactRows = readFirstTableInSection(compactNodeSection);
  if (compactRows.length) {
    const advanced = compactLines(compactNodeSection)
      .filter((line) => /^\*\*进阶视角/u.test(line))
      .map(stripMarkdown);
    return compactRows.map((row, index) => {
      const name = pickTableValue(row, ['节点', '环节']);
      const companies = pickTableValue(row, ['代表企业', '代表公司/机构']);
      const code = pickTableValue(row, ['上市地/代码', '上市地与代码']);
      const what = pickTableValue(row, ['节点功能', '作用', '关键变量']);
      return {
        name,
        position: '报告节点表',
        what,
        does: what,
        suppliers: '',
        buyers: '',
        companyRows: companies ? [{ name: companies, role: what, code, why: '' }] : [],
        companies: [companies, code].filter(Boolean).join(' · '),
        money: pickTableValue(row, ['关键变量']),
        why: what,
        evidence: pickTableValue(row, ['证据', '证据ID']),
        advanced: index === 0 ? advanced : [],
      };
    }).filter((node) => node.name);
  }

  const rows = readTableAfterHeading(
    content,
    /^###\s*(?:(?:1\.2|1\.3|2\.3)[.、]?\s*)?(?:Chain Node Explanation|产业链节点说明)/iu,
  );
  if (!rows?.length) return [];
  return rows.map((row) => {
    const name = pickTableValue(row, ['Node', 'Chain Node', '节点']);
    const what = pickTableValue(row, ['What It Is / Does', 'What It Is', '节点定义与作用']);
    const does = pickTableValue(row, ['What It Does', '作用']) || what;
    const companies = pickTableValue(row, ['Representative Companies', '代表企业']);
    return {
      name,
      position: '显式关系节点',
      what,
      does,
      suppliers: pickTableValue(row, ['Suppliers', 'Who Supplies It', '供应方']),
      buyers: pickTableValue(row, ['Buyers', 'Who Buys It', '采购方']),
      companyRows: companies ? [{ name: companies, role: '', code: '', why: '' }] : [],
      companies,
      money: pickTableValue(row, ['Monetization', 'How It Makes Money', '变现方式']),
      why: pickTableValue(row, ['Bottleneck Role', 'Why It Matters', '瓶颈作用']),
      evidence: pickTableValue(row, ['Evidence IDs', 'Evidence ID', '证据ID']),
      advanced: [],
    };
  }).filter((node) => node.name);
};

const makeMissingNodeDetail = (node) => ({
  name: node,
  position: '结构缺口',
  what: '',
  does: '',
  suppliers: '',
  buyers: '',
  companyRows: [],
  companies: '',
  money: '',
  why: '',
  evidence: '该报告没有按新版 Skill 单独写出此节点的作用、上下游、代表企业和证据；页面不自动补写。',
  advanced: [],
});

const extractProfitMap = (content) => {
  const rows = readTableAfterHeading(
    content,
    /^###\s*(?:(?:1\.3|2\.4)[.、]?\s*)?(?:Power and Profit Map|权力与利润(?:地图|分配)|钱怎么流|利益传导|利润传导)/iu,
  );
  if (rows?.length) return rows.map((row) => ({
    question: pickTableValue(row, ['Question', '问题']),
    answer: pickTableValue(row, ['Answer', '回答', '结论', '回答（必须点名具体环节和企业，禁止通用套话）']),
    evidence: pickTableValue(row, ['Evidence IDs', 'Evidence ID', '证据ID', '证据']),
    gap: pickTableValue(row, ['Gap', 'Gap / Limitation', '缺口', '局限']),
  })).filter((row) => row.question && row.answer);

  const valueRows = readTableAfterHeading(
    content,
    /^###\s*1\.1\s*[^\n]*(?:价值|创造|钱怎么流)[^\n]*/iu,
  ) || [];
  return valueRows.map((row) => {
    const node = pickTableValue(row, ['环节', '节点']);
    const companies = pickTableValue(row, ['代表公司/机构', '代表企业']);
    const variable = pickTableValue(row, ['关键变量', '节点功能']);
    return {
      question: node,
      answer: [companies && `代表主体：${companies}`, variable && `价值与利润关键变量：${variable}`].filter(Boolean).join('；'),
      evidence: pickTableValue(row, ['证据', '证据ID']),
      gap: '',
    };
  }).filter((row) => row.question && row.answer);
};

const extractSignalRows = (content) => {
  const rows = readTableAfterHeading(
    content,
    /^##\s*(?:(?:4|5)[.、]?\s*)?(?:供需矛盾与高频信号|Supply-Demand Conflict and High-Frequency Signals?)/iu,
  );
  if (!rows?.length) return [];
  return rows.map((row) => {
    const tight = pickTableValue(row, ['偏紧组合', '偏强组合']);
    const loose = pickTableValue(row, ['偏松组合', '偏弱组合', '反证组合']);
    return {
    signal: pickTableValue(row, ['Signal', '信号', '指标', '高频信号', '矛盾']),
    latest: pickTableValue(row, ['Latest Value / Direction', 'Latest Value', '最新值 / 方向', '最新值', '最新值/方向', '目前读数']) || (tight ? `偏紧/偏强：${tight}` : ''),
    period: pickTableValue(row, ['Period', '时期', '时间', '数据期间', '截止期间']),
    interpretation: pickTableValue(row, ['Interpretation', '含义', '解释', '解读', '解读（这个数说明了什么）']) || (loose ? `转松/转弱组合：${loose}` : ''),
    gap: pickTableValue(row, ['Gap', 'Gap / Limitation', '缺口', '局限']),
    evidence: pickTableValue(row, ['Evidence IDs', 'Evidence ID', '证据ID', '证据']),
  };
  }).filter((row) => row.signal && row.latest);
};

const extractCycleTimeline = (content) => {
  const rows = readTableAfterHeading(
    content,
    /^##\s*(?:(?:5|6)[.、]?\s*)?(?:周期位置与传导|周期与利润\s*[/／]\s*订单传导|周期与利润传导|Cycle and Profit\s*[/／]\s*Order Transmission)/iu,
  );
  const parsedRows = (rows || []).map((row) => ({
    period: pickTableValue(row, ['Stage / Date', 'Stage', 'Date', '阶段 / 日期', '时期', '时间', '阶段/日期']),
    signal: pickTableValue(row, ['Signal', '信号', '需求']),
    profitShift: pickTableValue(row, ['Profit Pool Shift', '利润池变化', '利润变化', '利润池往哪移', '价格/利润']),
    lag: pickTableValue(row, ['Key Lag', '关键时滞', '关键滞后', '时滞']),
    evidence: pickTableValue(row, ['Evidence IDs', 'Evidence ID', '证据ID', '证据']),
    next: pickTableValue(row, ['Next Verification', '下一步验证', '下次验证', '周期解释']),
  })).filter((row) => row.period && row.signal);
  if (parsedRows.length) return parsedRows;

  const comparable = extractComparableSeries(content)[0];
  if (comparable?.points?.length) {
    return comparable.points.map((point) => ({
      period: point.date,
      signal: `${point.indicator}：${point.rawValue}${point.unit ? ` ${point.unit}` : ''}`,
      profitShift: point.meaning || '',
      lag: '',
      evidence: point.source || '',
      next: '',
    }));
  }

  const current = extractCurrentStage(content);
  return [
    current.phase && {
      period: current.entryAnchor || '当前阶段',
      signal: current.phase,
      profitShift: '',
      lag: '',
      evidence: '',
      next: current.expectedTransition || '',
    },
    current.proveWrong && {
      period: '反证条件',
      signal: current.proveWrong,
      profitShift: '',
      lag: '',
      evidence: '',
      next: '',
    },
  ].filter(Boolean);
};

const extractCurrentStage = (content) => {
  // Try specific subsection with numbered-heading support (e.g. ### 5.1 当前处于哪一段)
  const specificSection = subsectionAfter(
    content,
    /###\s*(?:\d+\.\d+\s+)?(?:Current stage|当前阶段|当前处于哪一段|周期定位)/iu,
  );
  // Full section 5 as intermediate fallback (contains 进阶视角 with proveWrong)
  const section5 = sectionAfter(content, /##\s*5[.、]?\s*周期位置与传导/iu);
  // Section 0's 当前判断 as last fallback
  const judgmentSection = subsectionAfter(content, /###\s*当前判断/iu);
  const section = specificSection || section5 || judgmentSection;
  if (!section) return {};
  const field = (labels) => matchAnyLine(specificSection, labels)
    || matchAnyLine(section5, labels)
    || matchAnyLine(judgmentSection, labels);
  // proveWrong may live in 进阶视角 within section 5, so search section5 broadly
  const proveWrongArea = section5 || section;
  const proveWrongField = (labels) => matchAnyLine(proveWrongArea, labels);
  const proveWrongText = textAfterHeading(
    proveWrongArea,
    /###\s*(?:\d+\.\d+\s+)?(?:什么会证明这个判断错了|反证条件)/iu,
  );
  const phase = field(['Phase', '阶段', '阶段判断', '当前阶段', '周期位置', '周期阶段'])
    || stripMarkdown(section5.match(/阶段判断[：:]\s*\*\*([^*]+)\*\*/u)?.[1] || '');
  return {
    phase,
    entryAnchor: field(['Entry date / anchor', 'Entry anchor', '进入时间 / 锚点', '进入时间/锚点', '进入锚点']),
    expectedTransition: field(['Expected transition', '预期转换', '下一阶段', '预期切换条件']),
    confidence: field(['Confidence', '置信度']),
    proveWrong: proveWrongField(['What would prove this wrong', 'What proves this wrong', '反证条件', '什么会证明判断错误', '什么会证明这个判断错了']) || proveWrongText,
  };
};

const extractWatchIndicators = (content) => {
  const rowSets = [
    readTableAfterHeading(content, /^###\s*9\.2\s*(?:观察表|观察框架|跟踪数据库与下一次更新动作)/iu),
    readTableAfterHeading(
      content,
      /^##\s*(?:(?:9)[.、]?\s*)?(?:观察哨与跟踪|Watchlist and Tracking|Watch and Tracking)/iu,
    ),
  ];
  const parseRows = (rows = []) => rows.map((row) => ({
    indicator: pickTableValue(row, ['Indicator', '指标', '观察指标', '指标（写指标名，不是数值）']),
    baseline: pickTableValue(row, ['Baseline', '基线', '基线（数值+日期）']),
    source: pickTableValue(row, ['Source', '来源']),
    frequency: pickTableValue(row, ['Frequency', '频率']),
    positiveTrigger: pickTableValue(row, ['Positive Trigger', '正向触发']),
    disconfirmingTrigger: pickTableValue(row, ['Disconfirming Trigger', '反证触发']),
    meaning: pickTableValue(row, ['Meaning', '含义', '解释']),
  })).filter((row) => row.indicator && row.baseline);
  return rowSets.map((rows) => parseRows(rows || [])).find((rows) => rows.length) || [];
};

const extractComparableSeries = (content) => {
  const rows = readTableAfterHeading(
    content,
    /^###\s*(?:(?:9\.1)[.、]?\s*)?(?:可比时间序列|Comparable Time Series|Historical Data Series)/iu,
  );
  if (!rows?.length) return [];
  const points = rows.map((row) => {
    const rawValue = pickTableValue(row, ['Value', '数值']);
    return {
      date: pickTableValue(row, ['Date', '日期', '时期', '期间', '时点']),
      indicator: pickTableValue(row, ['Indicator', '指标']),
      value: parseComparableNumber(rawValue),
      rawValue,
      unit: pickTableValue(row, ['Unit', '单位']),
      source: pickTableValue(row, ['Source', '来源']),
      meaning: pickTableValue(row, ['Meaning', '含义']),
    };
  }).filter((point) => point.date && point.indicator && Number.isFinite(point.value));
  const grouped = new Map();
  points.forEach((point) => {
    const key = `${point.indicator}::${point.unit}`;
    grouped.set(key, [...(grouped.get(key) || []), point]);
  });
  return [...grouped.entries()].map(([id, seriesPoints]) => ({
    id,
    indicator: seriesPoints[0].indicator,
    unit: seriesPoints[0].unit,
    source: seriesPoints.find((point) => point.source)?.source || '',
    points: seriesPoints.sort((a, b) => comparePeriodLabels(a.date, b.date)),
  })).filter((series) => series.points.length >= 2).sort((a, b) => b.points.length - a.points.length);
};

const extractCapitalFlows = (content) => {
  const section = sectionAfter(content, /##\s*6[.、]?\s*资金动向/iu);
  if (!section) return { attempts: [], pricingRows: [], summary: [] };
  const attempts = readTableAfterHeading(section, /^###\s*6\.1/u) || readFirstTableInSection(section);
  const pricingRows = readTableAfterHeading(section, /^###\s*6\.2/u) || [];
  const summary = compactLines(section)
    .filter((line) => !line.trim().startsWith('#'))  // skip heading lines like ### 6.2
    .map((line) => stripMarkdown(line.replace(/^[-*]\s*/u, '')))
    .filter((line) => /已定价|未完全定价|未定价|暂不能判断|缺口/u.test(line))
    .slice(0, 6);
  return {
    attempts: (attempts || []).map((row) => ({
      sourceType: pickTableValue(row, ['尝试的来源类型', '来源类型', '检索项目']),
      source: pickTableValue(row, ['具体来源', '来源', '代表对象', '对象', '实际来源与访问日', '实际来源']),
      result: pickTableValue(row, ['结果', '研究结果', '结果（拿到数据 / 无公开数据 / 口径不可比）', '能否支持结论']),
      limitation: pickTableValue(row, ['缺口', '限制', '局限']),
    })).filter((row) => row.sourceType || row.source || row.result),
    pricingRows: (pricingRows || []).map((row) => ({
      reality: pickTableValue(row, ['产业现实']),
      narrative: pickTableValue(row, ['市场叙事/定价证据']),
      stage: pickTableValue(row, ['预期阶段（未定价/扩散/已定价/消化/反转）', '预期阶段']),
      source: pickTableValue(row, ['来源']),
      interpretation: pickTableValue(row, ['解读']),
    })).filter((row) => row.reality || row.narrative),
    summary,
  };
};

const extractFutureCapitalFlows = (content) => {
  const section = sectionAfter(content, /##\s*7[.、]?\s*未来资金可能流向/iu);
  if (!section) return [];
  const rows = readFirstTableInSection(section);
  if (rows.length) {
    return rows.map((row) => ({
      scenario: pickTableValue(row, ['情景']),
      trigger: pickTableValue(row, ['触发条件', '条件']),
      flow: pickTableValue(row, ['利润池往哪个环节移动', '利润池移动', '产业链可能受益环节']),
      first: pickTableValue(row, ['先受益的环节', '先受益']),
      later: pickTableValue(row, ['后受益/受损的环节', '后受益/受损']),
      evidence: pickTableValue(row, ['需要盯的证据', '观察证据', '需要验证的变量', '验证变量', '验证']),
    })).filter((row) => row.scenario);
  }
  return section.split(/\n(?=###\s+)/u).slice(1).map((part) => ({
    scenario: stripMarkdown(part.match(/^###\s+(.+)$/mu)?.[1] || ''),
    trigger: '',
    flow: stripMarkdown(part.split('\n').filter((line) => line && !line.startsWith('#')).join(' ')),
    first: '',
    later: '',
    evidence: [...part.matchAll(/\[E\d+\]/gu)].map((match) => match[0].slice(1, -1)).join('、'),
  })).filter((row) => row.scenario && row.flow);
};

const extractDisagreements = (content) => {
  const rows = readTableAfterHeading(content, /^##\s*8[.、]?\s*分歧与反证/iu) || [];
  const parsed = rows.map((row) => ({
    narrative: pickTableValue(row, ['市场主流叙事', '主流叙事']),
    judgment: pickTableValue(row, ['本报告判断']),
    difference: pickTableValue(row, ['分歧在哪', '分歧']),
    strongerEvidence: pickTableValue(row, ['谁的证据更硬', '更硬证据']),
    evidence: pickTableValue(row, ['证据', '后续反证']),
  })).filter((row) => row.narrative || row.judgment);
  if (parsed.length) return parsed;

  const section = sectionAfter(content, /^##\s*8[.、]?\s*分歧与反证/imu);
  const narrative = textAfterHeading(section, /###\s*(?:主流叙事|市场主流叙事)/iu);
  const counter = textAfterHeading(section, /###\s*(?:需要保留的反证|反证)/iu)
    || compactLines(section)
      .map((line) => stripMarkdown(line.replace(/^\d+[.、]\s*/u, '')))
      .find((line) => /反证[：:]|不能|不等于|并非/u.test(line) && !line.startsWith('##'))
    || '';
  const advanced = compactLines(section)
    .filter((line) => /^\*\*(?:进阶视角|口径陷阱|争议)/u.test(line))
    .map(stripMarkdown)[0] || '';
  return (narrative || counter || advanced) ? [{
    narrative: narrative || '报告保留的分歧与口径约束',
    judgment: extractJudgment(content),
    difference: counter || advanced,
    strongerEvidence: '',
    evidence: [...new Set([...section.matchAll(/\bE\d+\b/gu)].map((match) => match[0]))].join('、'),
  }] : [];
};

const extractGlossary = (content) => {
  const rows = readTableAfterHeading(content, /^##\s*10[.、]?\s*术语表/iu) || [];
  return rows.map((row) => ({
    term: pickTableValue(row, ['术语']),
    explanation: pickTableValue(row, ['人话解释（一两句，外行能懂）', '人话解释', '小白解释', '含义', '解释']),
    why: pickTableValue(row, ['为什么重要']),
  })).filter((row) => row.term && row.explanation);
};

const extractEvidenceLedger = (content) => {
  const rows = readTableAfterHeading(content, /^##\s*附录A\s*证据台账/iu) || [];
  return rows.map((row) => ({
    id: pickTableValue(row, ['证据ID']),
    publisher: pickTableValue(row, ['发布方']),
    date: pickTableValue(row, ['发布日期']),
    accessDate: pickTableValue(row, ['访问日期']),
    freshness: pickTableValue(row, ['时效']),
    locator: pickTableValue(row, ['原文链接/定位', '链接', '原文链接']),
    conclusion: pickTableValue(row, ['结论', '事实/用途', '用途']),
    limitation: pickTableValue(row, ['局限']),
  })).filter((row) => row.id || row.publisher || row.locator);
};

const extractBottlenecks = (content) => {
  const onePage = sectionAfter(content, /##\s*0[.、]?\s*(?:一页看懂|One Page)/iu);
  const constraints = [...onePage.matchAll(/(?:最紧约束|最大风险)[^：:]*[：:]\s*([^\n]+)/gu)].map((match) => stripMarkdown(match[1]));
  if (constraints.length) return constraints.slice(0, 5);

  const lines = content.replace(/\r/g, '').split('\n');
  const headingPattern = /^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:关键瓶颈|核心瓶颈|核心矛盾|Key Bottlenecks?|Core Conflict)/iu;
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start < 0) {
    const conflict = sectionAfter(content, /##\s*4[.、]?\s*供需矛盾与高频信号/iu)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('|') && !line.startsWith('---'))
      .map(stripMarkdown)
      .find((line) => line.length >= 12 && line.length <= 260);
    if (conflict) return [firstSentence(conflict)];
    const signal = extractSignalRows(content)[0];
    return signal ? [`${signal.signal}：${signal.latest}`] : [];
  }
  const found = [];
  const inline = lines[start].split(/[：:]/u).slice(1).join(':').trim();
  if (inline) found.push(stripMarkdown(inline));
  for (let i = start + 1; i < Math.min(lines.length, start + 16); i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('---') || /^#{2,}\s+/u.test(line)) break;
    if (/^(\d+\.|-|\*)\s+/u.test(line) || /\*\*.+?\*\*/u.test(line)) {
      found.push(stripMarkdown(line.replace(/^(\d+\.|-|\*)\s+/u, '')));
    }
  }
  return found.filter(Boolean).slice(0, 5).filter((item) => !/未提取到明确关键瓶颈/u.test(item));
};

const extractSourceHints = (content) => {
  const ledger = extractEvidenceLedger(content);
  if (ledger.length) {
    return ledger.slice(0, 10).map((row) => [row.id, row.publisher, row.date, row.locator].filter(Boolean).join(' · '));
  }
  return compactLines(content)
    .map(stripMarkdown)
    .filter((line) => /数据来源|来源|Source|source|财报|年报|季报|IR|SIA|TrendForce|IDC|Dell'Oro|Wind|WSTS|Counterpoint/u.test(line))
    .map((line) => line.replace(/^[-*]\s*/u, ''))
    .slice(0, 8);
};

const extractMetricHints = (content) => {
  const matches =
    stripMarkdown(content).match(/[\d,.]+(?:\.\d+)?\s*(?:%|亿美元|万亿美元|万亿|亿元|GW|kW|MW|个月|年|倍|家|wpm|百万新台币)/g) || [];
  return [...new Set(matches)].slice(0, 12);
};

const inferStage = (judgment) => {
  const rules = [
    ['结构性短缺与扩产并行', '结构性短缺与扩产并行'],
    ['结构性短缺', '结构性短缺期'],
    ['盈利兑现', '盈利兑现期'],
    ['扩张兑现', '扩张期'],
    ['加速扩张', '扩张期'],
    ['结构性扩张', '扩张期'],
    ['扩张', '扩张期'],
    ['供不应求', '短缺期'],
    ['短缺', '短缺期'],
    ['过剩', '过剩期'],
    ['出清', '出清期'],
    ['成长', '成长期'],
    ['导入', '导入期'],
    ['earnings realization', '盈利兑现期'],
    ['oversupply', '过剩期'],
    ['clearing', '出清期'],
    ['expansion', '扩张期'],
    ['shortage', '短缺期'],
  ];
  const normalized = String(judgment).toLowerCase();
  const hit = rules.find(([keyword]) => normalized.includes(keyword.toLowerCase()));
  return hit ? hit[1] : '待验证';
};

const buildQuality = ({ date, geography, dataCurrency, judgment, chain, chainNodes, bottlenecks, sourceHints, metricHints, capitalFlows, futureCapitalFlows, glossary, evidenceLedger }, content) => {
  const checks = [
    ['reportDate', '分析日期', Boolean(date)],
    ['dataCurrency', '数据时效', Boolean(dataCurrency)],
    ['geography', '地理范围', Boolean(geography)],
    ['judgment', '一句话判断/当前判断', judgment && !judgment.includes('未提取')],
    ['chain', '产业链', Boolean(chain) && chainNodes.length >= 3],
    ['bottlenecks', '关键瓶颈', bottlenecks.length >= 1],
    ['sources', '来源线索', sourceHints.length >= 2],
    ['metrics', '量化线索', metricHints.length >= 2],
    ['falsification', '反证或风险条件', /反证|证伪|风险|若|如果|一旦|下修/u.test(content)],
    ['capitalFlows', '资金动向', Boolean(capitalFlows?.attempts?.length || capitalFlows?.summary?.length)],
    ['futureCapitalFlows', '未来资金流向', futureCapitalFlows.length >= 2],
    ['glossary', '术语表', glossary.length >= 3],
    ['evidenceLedger', '证据台账', evidenceLedger.length >= 3],
  ].map(([id, label, ok]) => ({ id, label, ok }));
  const passed = checks.filter((item) => item.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const level = score >= 78 ? '新版结构完整' : score >= 56 ? '建议补充' : '旧版待重跑';
  return { score, passed, total: checks.length, level, checks };
};

export function parseReportMarkdown(content, filename = '行业分析报告.md') {
  const title = content.match(/^#\s+(.+)$/mu)?.[1] || filename.replace(/\.md$/u, '');
  const industry = extractIndustry(title, filename);
  const judgment = extractJudgment(content);
  const chain = extractChain(content);
  const explicitChainNodeDetails = extractChainNodeDetails(content);
  const mermaidNodes = extractMermaidNodes(chain);
  const chainNodes = explicitChainNodeDetails.length >= 3
    ? explicitChainNodeDetails.map((node) => node.name)
    : mermaidNodes.length >= 3
      ? mermaidNodes
      : extractChainNodesFromText(chain || sectionAfter(content, /##\s*(?:1|2)[.、]?\s*(?:产业链(?:与关系)?|Industry Chain)/iu));
  const rawBottlenecks = extractBottlenecks(content);
  const onePage = extractOnePage(content);
  const profitMap = extractProfitMap(content);
  const signalRows = extractSignalRows(content);
  const cycleTimeline = extractCycleTimeline(content);
  const currentStage = extractCurrentStage(content);
  const watchIndicators = extractWatchIndicators(content);
  const comparableSeries = extractComparableSeries(content);
  const capitalFlows = extractCapitalFlows(content);
  const futureCapitalFlows = extractFutureCapitalFlows(content);
  const disagreements = extractDisagreements(content);
  const glossary = extractGlossary(content);
  const evidenceLedger = extractEvidenceLedger(content);
  const sourceHints = extractSourceHints(content);
  const metricHints = extractMetricHints(content);
  const date = matchAnyLine(content, ['分析日期', '分析时间', 'Research date', 'Analysis Timestamp']);
  const geography = matchAnyLine(content, ['地理范围', 'Geography']);
  const dataCurrency = matchAnyLine(content, ['数据时效', '信息搜集范围', '数据范围', 'Data Currency']);
  const supplyStatus = matchAnyLine(content, ['供给判断', 'Supply Judgment', 'Supply Status']);
  const stageRaw = matchAnyLine(content, ['周期阶段', '周期位置', 'Cycle stage']);
  const bottlenecks = resolveBottlenecks(rawBottlenecks, {
    judgment,
    supplyStatus,
    chainNodeDetails: explicitChainNodeDetails,
  });
  // Truncate at first sentence break to avoid capturing full explanatory paragraphs
  const truncateStage = (raw) =>
    raw ? raw.replace(/（[^）]*）|\([^)]*\)/gu, '').split(/[。；;]/u)[0].trim() : '';
  const stage = truncateStage(stageRaw) || truncateStage(currentStage.phase) || inferStage(judgment);
  const quality = buildQuality({
    date,
    geography,
    dataCurrency,
    judgment,
    chain,
    chainNodes,
    bottlenecks,
    sourceHints,
    metricHints,
    capitalFlows,
    futureCapitalFlows,
    glossary,
    evidenceLedger,
  }, content);

  return {
    quality,
    caseItem: {
      id: `report-${slugify(industry)}`,
      file: filename,
      sourceType: 'parsed',
      industry,
      title: stripMarkdown(title),
      date: date || '未标注',
      geography: geography || '未标注',
      dataCurrency: dataCurrency || '未标注',
      supplyStatus,
      stage,
      judgment,
      bottlenecks: bottlenecks.length ? bottlenecks : ['未提取到明确关键瓶颈'],
      sourceHints,
      metricHints,
      chain,
      chainNodes,
      chainNodeDetails: explicitChainNodeDetails.length >= 3
        ? explicitChainNodeDetails
        : chainNodes.map(makeMissingNodeDetail),
      profitMap,
      signalRows,
      cycleTimeline,
      currentStage,
      watchIndicators,
      comparableSeries,
      onePage,
      capitalFlows,
      futureCapitalFlows,
      disagreements,
      glossary,
      evidenceLedger,
      originalMarkdown: content,
      quality,
    },
  };
}
