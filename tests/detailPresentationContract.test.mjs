import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const dataset = JSON.parse(await readFile(new URL('../src/data/cases.json', import.meta.url), 'utf8'));

test('hero separates stage, conclusion status, confidence and evidence cutoff', () => {
  for (const label of ['阶段判断', '结论状态', '置信度', '证据截至']) {
    assert.match(app, new RegExp(label, 'u'));
  }
  assert.doesNotMatch(
    app.match(/<div className="cycle-stage-answer">[\s\S]*?<\/div>\s*<\/div>/u)?.[0] || '',
    /evidenceStatusLabel\(item\)/u,
  );
});

test('future-flow cards render every scenario field instead of one summary sentence', () => {
  for (const field of ['row.trigger', 'row.flow', 'row.first', 'row.later', 'row.evidence']) {
    assert.match(app, new RegExp(field.replace('.', '\\.'), 'u'));
  }
});

test('capital cards render proxy evidence and keep attempts secondary', () => {
  assert.match(app, /market-proxy-grid/u);
  assert.match(app, /capital-attempts/u);
  assert.match(app, /缺少可核验指标时，不把尝试本身算作结论/u);
});

test('detail view offers a true beginner path without removing the full report', () => {
  for (const copy of ['只看这三段就够了', '行业做什么 · 三个关键数字 · 当前阶段与反证', '小白极简路径', '完整主线']) {
    assert.match(app, new RegExp(copy, 'u'));
  }
  assert.match(app, /beginnerOnly \? \(/u);
  assert.match(app, /继续看产业链与完整报告/u);
});

test('mobile timeline marker sits in the gutter and cannot cover the year', () => {
  assert.match(styles, /\.cycle-time-marker i\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?left:\s*-36px;/u);
  assert.match(
    styles,
    /@media \(max-width: 900px\)[\s\S]*?\.cycle-overview,[\s\S]*?\.research-basis\s*\{[\s\S]*?grid-column:\s*1;/u,
  );
});

test('mobile detail fits the Mermaid diagram and wraps the complete evidence index', () => {
  assert.match(app, /const MIN_MERMAID_ZOOM = 0\.12;/u);
  assert.match(app, /viewportWidth <= 640[\s\S]*?getMermaidFitZoom\(viewport, width, height\)/u);
  assert.match(
    styles,
    /@media \(max-width: 900px\)[\s\S]*?\.source-list p,[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?font-size:\s*10px;/u,
  );
});

test('generated cases preserve conclusion and split quality fields used by the detail UI', () => {
  assert.equal(dataset.cases.length, 18);
  for (const item of dataset.cases) {
    assert.ok(item.conclusionStatus, `${item.industry}: missing generated conclusion status`);
    assert.ok(item.confidence, `${item.industry}: missing generated confidence`);
    assert.ok(item.evidenceAsOf, `${item.industry}: missing generated evidence cutoff`);
    assert.equal(item.structureScore, 100, `${item.industry}: structure score drifted`);
    assert.equal(item.evidenceScore, 100, `${item.industry}: evidence score drifted`);
  }
});
