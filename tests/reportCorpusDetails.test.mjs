import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseReportMarkdown } from '../src/reportParser.js';

const reportFiles = (await readdir(new URL('..', import.meta.url)))
  .filter((file) => /^\d+_.*\.md$/u.test(file))
  .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }));

test('all 18 demos expose the v1.5 detail-card contract', async () => {
  assert.equal(reportFiles.length, 18);

  for (const file of reportFiles) {
    const content = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const { caseItem, quality } = parseReportMarkdown(content, file);
    const advancedCount = (caseItem.disagreements?.length || 0)
      + (caseItem.chainNodeDetails || []).reduce((count, node) => count + (node.advanced?.length || 0), 0);

    assert.equal(quality.score, 100, `${file}: parser quality should be 100`);
    assert.ok(caseItem.onePage?.industryIntro, `${file}: missing industry intro`);
    assert.ok(caseItem.onePage?.keyNumbers?.length >= 3, `${file}: missing three key numbers`);
    assert.ok(caseItem.chainNodeDetails?.length >= 4, `${file}: missing chain-node details`);
    assert.equal(
      caseItem.chainNodeDetails.filter((node) => node.position === '结构缺口').length,
      0,
      `${file}: contains synthetic structure-gap nodes`,
    );
    for (const node of caseItem.chainNodeDetails) {
      assert.ok(node.what, `${file}/${node.name}: missing what field`);
      assert.ok(node.suppliers, `${file}/${node.name}: missing suppliers field`);
      assert.ok(node.buyers, `${file}/${node.name}: missing buyers field`);
      assert.notEqual(node.suppliers, node.buyers, `${file}/${node.name}: suppliers and buyers are duplicated`);
      assert.ok(node.money, `${file}/${node.name}: missing monetization field`);
      assert.ok(node.why, `${file}/${node.name}: missing bottleneck field`);
      assert.ok(node.companyRows?.length >= 2, `${file}/${node.name}: missing representative companies`);
      assert.ok(node.advanced?.length >= 1, `${file}/${node.name}: missing advanced view`);
    }
    assert.ok(quality.nodeMetrics.averageInformation >= 200, `${file}: node information is too thin`);
    assert.ok(caseItem.profitMap?.length >= 4, `${file}: missing profit-flow details`);
    assert.ok(caseItem.signalRows?.length >= 5, `${file}: missing supply-demand signals`);
    assert.ok(caseItem.cycleTimeline?.length >= 3, `${file}: missing cycle timeline`);
    assert.ok(caseItem.watchIndicators?.length >= 5, `${file}: missing watch indicators`);
    assert.ok(caseItem.capitalFlows?.attempts?.length >= 3, `${file}: missing capital-flow attempts`);
    assert.ok(caseItem.futureCapitalFlows?.length >= 3, `${file}: missing capital-flow scenarios`);
    assert.ok(
      caseItem.futureCapitalFlows.every((row) => row.flow || row.trigger),
      `${file}: capital-flow scenario has no readable condition or flow`,
    );
    assert.ok(advancedCount >= caseItem.chainNodeDetails.length, `${file}: missing node-level advanced insights`);
    assert.ok(caseItem.glossary?.length >= 3, `${file}: missing glossary entries`);
    assert.ok(caseItem.evidenceLedger?.length >= 8, `${file}: missing evidence-ledger entries`);

    if (!caseItem.comparableSeries?.length) {
      assert.match(content, /可比时间序列缺口/u, `${file}: missing an explicit same-basis series gap`);
    }
  }
});
