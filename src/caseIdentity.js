export function normalizeIndustryKey(value) {
  const industry = typeof value === 'string' ? value : value?.industry;
  return String(industry || '')
    .toLowerCase()
    .replace(/\s+/gu, '')
    .replace(/行业$/u, '')
    .trim();
}

export function reportTimestamp(item) {
  const raw = String(item?.date || '').trim();
  const timestamp = raw.match(/\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?(?:\s*[+-]\d{2}:?\d{2})?/u)?.[0];
  if (!timestamp) return 0;
  const normalized = timestamp.replace(/^(\d{4}-\d{2}-\d{2})\s/u, '$1T').replace(/\s(?=[+-]\d{2}:?\d{2}$)/u, '');
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? Date.parse(`${timestamp.slice(0, 10)}T00:00:00Z`) : parsed;
}

export function dedupeCasesByIndustry(items, { preferLatestDate = false } = {}) {
  const byIndustry = new Map();
  items.forEach((item) => {
    const key = normalizeIndustryKey(item);
    if (!key) return;
    const current = byIndustry.get(key);
    if (!current || !preferLatestDate || reportTimestamp(item) >= reportTimestamp(current)) {
      byIndustry.set(key, item);
    }
  });
  return [...byIndustry.values()];
}
