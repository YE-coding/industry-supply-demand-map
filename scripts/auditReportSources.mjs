import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const input = path.join(root, 'scripts', 'report-sources', 'all-industries-research-audit-2026-07-16.json');
const output = path.join(root, 'scripts', 'report-sources', 'all-industries-source-access-2026-07-16.json');
const reports = JSON.parse(await readFile(input, 'utf8'));
const checkedAt = new Date().toISOString();

async function withTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { redirect: 'follow', ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function discover(industry) {
  const query = encodeURIComponent(`${industry} 2026 供需 产量 订单 库存 官方`);
  try {
    const response = await withTimeout(`http://127.0.0.1:8080/search?q=${query}&format=json&language=zh-CN`, {}, 10000);
    const body = response.ok ? await response.json() : null;
    return { ok: response.ok, status: response.status, resultCount: body?.results?.length ?? 0 };
  } catch (error) {
    return { ok: false, status: 0, resultCount: 0, error: error.name };
  }
}

async function openOriginal(url) {
  try {
    const response = await withTimeout(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; industry-cycle-research-audit/1.0)',
        accept: 'text/html,application/pdf,application/xhtml+xml,*/*;q=0.8',
      },
    });
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get('content-type') || '',
    };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: url, contentType: '', error: error.name };
  }
}

const uniqueUrls = [...new Set(reports.flatMap((report) => report.sources))];
const urlResults = new Map();
for (let index = 0; index < uniqueUrls.length; index += 8) {
  const batch = uniqueUrls.slice(index, index + 8);
  const results = await Promise.all(batch.map(async (url) => [url, await openOriginal(url)]));
  results.forEach(([url, result]) => urlResults.set(url, result));
}

const audit = [];
for (const report of reports) {
  audit.push({
    industry: report.industry,
    checkedAt,
    discovery: await discover(report.industry),
    sources: report.sources.map((url) => ({ url, ...urlResults.get(url) })),
  });
}

await writeFile(output, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
const opened = [...urlResults.values()].filter((item) => item.ok).length;
console.log(`Audited ${uniqueUrls.length} unique original URLs: ${opened} directly reachable, ${uniqueUrls.length - opened} blocked/timeout and retained for browser/manual verification.`);
