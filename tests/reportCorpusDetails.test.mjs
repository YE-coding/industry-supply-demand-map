import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseReportMarkdown } from '../src/reportParser.js';

const reportFiles = (await readdir(new URL('..', import.meta.url)))
  .filter((file) => /^\d+_.*\.md$/u.test(file))
  .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }));

const nonTemplateReports = reportFiles.filter((file) => !file.startsWith('01_'));

test('all 17 non-template demos expose complete detail-card data', async () => {
  assert.equal(nonTemplateReports.length, 17);

  for (const file of nonTemplateReports) {
    const content = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const { caseItem, quality } = parseReportMarkdown(content, file);
    const advancedCount = (caseItem.disagreements?.length || 0)
      + (caseItem.chainNodeDetails || []).reduce((count, node) => count + (node.advanced?.length || 0), 0);

    assert.equal(quality.score, 100, `${file}: parser quality should be 100`);
    assert.ok(caseItem.onePage?.industryIntro, `${file}: missing industry intro`);
    assert.ok(caseItem.onePage?.keyNumbers?.length >= 3, `${file}: missing three key numbers`);
    assert.ok(caseItem.chainNodeDetails?.length >= 3, `${file}: missing chain-node details`);
    assert.equal(
      caseItem.chainNodeDetails.filter((node) => node.position === '结构缺口').length,
      0,
      `${file}: contains synthetic structure-gap nodes`,
    );
    assert.ok(caseItem.profitMap?.length >= 3, `${file}: missing profit-flow details`);
    assert.ok(caseItem.signalRows?.length >= 3, `${file}: missing supply-demand signals`);
    assert.ok(caseItem.cycleTimeline?.length >= 1, `${file}: missing cycle timeline`);
    assert.ok(caseItem.watchIndicators?.length >= 3, `${file}: missing watch indicators`);
    assert.ok(caseItem.capitalFlows?.attempts?.length >= 3, `${file}: missing capital-flow attempts`);
    assert.ok(caseItem.futureCapitalFlows?.length >= 3, `${file}: missing capital-flow scenarios`);
    assert.ok(
      caseItem.futureCapitalFlows.every((row) => row.flow || row.trigger),
      `${file}: capital-flow scenario has no readable condition or flow`,
    );
    assert.ok(advancedCount >= 1, `${file}: missing disagreements or advanced insights`);
    assert.ok(caseItem.glossary?.length >= 3, `${file}: missing glossary entries`);
    assert.ok(caseItem.evidenceLedger?.length >= 3, `${file}: missing evidence-ledger entries`);

    if (!caseItem.comparableSeries?.length) {
      assert.match(content, /可比时间序列缺口/u, `${file}: missing an explicit same-basis series gap`);
    }
  }
});
