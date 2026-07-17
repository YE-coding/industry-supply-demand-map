import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseReportMarkdown } from '../src/reportParser.js';
import { dedupeCasesByIndustry, reportTimestamp } from '../src/caseIdentity.js';

const root = process.cwd();
const outputDir = path.join(root, 'src', 'data');
const outputFile = path.join(outputDir, 'cases.json');
const officialReportsDir = path.join(root, 'public', 'official-reports');

const files = (await readdir(root))
  .filter((file) => /^\d+_.*供需周期分析.*\.md$/u.test(file))
  .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));

const candidates = [];

await rm(officialReportsDir, { recursive: true, force: true });
await mkdir(officialReportsDir, { recursive: true });

for (const file of files) {
  const content = await readFile(path.join(root, file), 'utf8');
  const { caseItem, quality } = parseReportMarkdown(content, file);
  const id = file.replace(/\.md$/u, '').replace(/[^\w\u4e00-\u9fa5-]+/gu, '-');

  candidates.push({
    id,
    file,
    industry: caseItem.industry,
    title: caseItem.title,
    date: caseItem.date,
    geography: caseItem.geography,
    dataCurrency: caseItem.dataCurrency,
    supplyStatus: caseItem.supplyStatus,
    stage: caseItem.stage,
    judgment: caseItem.judgment,
    bottlenecks: caseItem.bottlenecks,
    sourceHints: caseItem.sourceHints,
    metricHints: caseItem.metricHints,
    chain: caseItem.chain,
    chainNodes: caseItem.chainNodes,
    chainNodeDetails: caseItem.chainNodeDetails,
    profitMap: caseItem.profitMap,
    signalRows: caseItem.signalRows,
    cycleTimeline: caseItem.cycleTimeline,
    currentStage: caseItem.currentStage,
    watchIndicators: caseItem.watchIndicators,
    comparableSeries: caseItem.comparableSeries,
    onePage: caseItem.onePage,
    capitalFlows: caseItem.capitalFlows,
    futureCapitalFlows: caseItem.futureCapitalFlows,
    disagreements: caseItem.disagreements,
    glossary: caseItem.glossary,
    evidenceLedger: caseItem.evidenceLedger,
    quality,
    markdownUrl: `official-reports/${encodeURIComponent(id)}.md`,
    originalContent: content,
  });
}

const cases = dedupeCasesByIndustry(candidates, { preferLatestDate: true });
const latestReportTimestamp = Math.max(0, ...cases.map((item) => reportTimestamp(item)));
const generatedAt = latestReportTimestamp > 0
  ? new Date(latestReportTimestamp).toISOString()
  : '1970-01-01T00:00:00.000Z';

for (const item of cases) {
  await writeFile(path.join(officialReportsDir, `${item.id}.md`), item.originalContent, 'utf8');
  delete item.originalContent;
}

await mkdir(outputDir, { recursive: true });
await writeFile(
  outputFile,
  `${JSON.stringify({ generatedAt, sourceCount: cases.length, cases }, null, 2)}\n`,
  'utf8',
);

console.log(`Extracted ${cases.length} unique industries from ${candidates.length} reports to ${path.relative(root, outputFile)}`);
