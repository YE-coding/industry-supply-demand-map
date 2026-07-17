const chineseNumber = {
  '一': 1,
  '二': 2,
  '三': 3,
  '四': 4,
};

export function periodSortKey(value = '') {
  const text = String(value).trim();
  const yearMatch = text.match(/(?:FY\s*)?((?:19|20)\d{2})/iu);
  if (!yearMatch) return Number.POSITIVE_INFINITY;

  const year = Number(yearMatch[1]);
  let month = 1;
  let day = 1;

  const quarterMatch = text.match(/(?:第\s*)?([一二三四1-4])\s*季度|Q\s*([1-4])/iu);
  const chineseMonthMatch = text.match(/年\s*(1[0-2]|0?[1-9])\s*月/u);
  const isoDateMatch = text.match(/(?:19|20)\d{2}[-/.](1[0-2]|0?[1-9])(?:[-/.]([0-3]?\d))?/u);

  if (quarterMatch) {
    const rawQuarter = quarterMatch[1] || quarterMatch[2];
    const quarter = chineseNumber[rawQuarter] || Number(rawQuarter);
    month = (quarter - 1) * 3 + 1;
  } else if (/下半年|H\s*2/iu.test(text)) {
    month = 7;
  } else if (/上半年|H\s*1/iu.test(text)) {
    month = 1;
  } else if (chineseMonthMatch) {
    month = Number(chineseMonthMatch[1]);
  } else if (isoDateMatch) {
    month = Number(isoDateMatch[1]);
    day = Number(isoDateMatch[2] || 1);
  }

  return year * 10000 + month * 100 + day;
}

export function comparePeriodLabels(left = '', right = '') {
  const leftKey = periodSortKey(left);
  const rightKey = periodSortKey(right);
  if (leftKey !== rightKey) return leftKey - rightKey;
  return String(left).localeCompare(String(right), 'zh-CN', { numeric: true });
}
