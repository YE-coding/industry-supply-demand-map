const normalizeCopy = (value = '') => String(value)
  .replace(/[\s，。；;：:、“”‘’]/gu, '')
  .toLocaleLowerCase();

const supplyTerms = /供给|供应|产能|容量|良率|认证|验证|交期|利用率|扩产|爬坡|上架|供电|散热|封装|约束|限制|并网|消纳/iu;
const hardSupplyTerms = /有效供给|容量约束|产能|良率|认证|验证|交期|利用率|上架|供电|散热|封装|约束|限制|并网|消纳/iu;
const weakDemandTerms = /收入|营收|毛利|预算|capex|资本开支|需求兑现/iu;

const formatSignal = (signal) => {
  const detail = [signal.latest, signal.interpretation].filter(Boolean).join('；');
  return `${signal.signal || '供给信号'}${detail ? `：${detail}` : ''}`;
};

const supplySignalScore = (row = {}, index = 0) => {
  const signal = String(row.signal || '');
  const text = [row.signal, row.latest, row.interpretation].filter(Boolean).join(' ');
  if (!supplyTerms.test(text)) return 0;

  let score = 10 - index * 0.01;
  if (hardSupplyTerms.test(text)) score += 8;
  if (/公开口径不足|有效供给不足|不能把规划产线直接计入供给|瓶颈尚未解除/iu.test(text)) score += 4;
  if (weakDemandTerms.test(signal) && !hardSupplyTerms.test(signal)) score -= 3;
  return score;
};

const pickSupplySignal = (rows = []) => rows
  .map((row, index) => ({ row, score: supplySignalScore(row, index) }))
  .filter((item) => item.score > 0)
  .sort((left, right) => right.score - left.score)[0]?.row;

const bottleneckScore = (line = '', index = 0) => {
  let score = 10 - index * 0.01;
  if (/良率|认证|验证|交付|交期|供电|散热|电力|并网|消纳|容量|产能|上架|封装|HBM|库存|过剩|开工|品位|扰动|合规|安全|可靠|利用率/iu.test(line)) score += 8;
  if (/资本纪律|回报|成本|价格|同质|技术|壁垒|客户/iu.test(line)) score += 3;
  if (/付款|预算|需求|流量/iu.test(line)) score -= 2;
  return score;
};

const rankedUniqueLines = (lines = [], ignoredKeys = new Set()) => {
  const seen = new Set();
  return lines
    .map((line, index) => ({ line: String(line || '').trim(), index }))
    .filter(({ line }) => {
      const key = normalizeCopy(line);
      if (!key || seen.has(key) || ignoredKeys.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({ ...item, score: bottleneckScore(item.line, item.index) }))
    .sort((left, right) => right.score - left.score)
    .map((item) => item.line);
};

export function comparisonSupplyStatus(item = {}) {
  const signal = pickSupplySignal(item.signalRows || []);
  if (signal) return formatSignal(signal);

  if (item.supplyStatus) return item.supplyStatus;
  if (supplyTerms.test(item.currentStage?.phase || '')) return item.currentStage.phase;
  return '报告未单独披露有效供给、扩产或利用率状态。';
}

export function comparisonBottleneck(item = {}) {
  const ignoredKeys = new Set([
    normalizeCopy(item.judgment),
    normalizeCopy(item.supplyStatus),
  ].filter(Boolean));

  const explicit = (item.bottlenecks || []).find((line) => (
    line && !ignoredKeys.has(normalizeCopy(line)) && !/未提取到明确关键瓶颈/u.test(line)
  ));
  if (explicit) return explicit;

  const nodeConstraints = rankedUniqueLines(
    (item.chainNodeDetails || []).map((node) => node.why),
    ignoredKeys,
  )
    .slice(0, 3);

  return nodeConstraints.length
    ? nodeConstraints.join('；')
    : '报告只披露了核心矛盾，未把具体瓶颈单独拆出。';
}
