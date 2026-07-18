const normalizeIndustryRoute = (value) => String(value || '').trim().toLocaleLowerCase('zh-CN');

export function detailCaseFromSearch(cases, search = '') {
  const requested = new URLSearchParams(search).get('industry');
  const normalized = normalizeIndustryRoute(requested);
  if (!normalized) return null;

  return cases.find((item) => (
    normalizeIndustryRoute(item.industry) === normalized
    || normalizeIndustryRoute(item.id) === normalized
  )) || null;
}

export function detailSearchFor(item) {
  if (!item?.industry) return '';
  const params = new URLSearchParams();
  params.set('industry', item.industry);
  return `?${params.toString()}`;
}

