import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detailCaseFromSearch, detailSearchFor } from '../src/detailRoute.js';

const dataset = JSON.parse(await readFile(new URL('../src/data/cases.json', import.meta.url), 'utf8'));

test('all 18 industries have a stable direct-detail query route', () => {
  assert.equal(dataset.cases.length, 18);
  const searches = new Set();

  for (const item of dataset.cases) {
    const search = detailSearchFor(item);
    assert.ok(search.startsWith('?industry='), `${item.industry}: missing industry route`);
    assert.ok(!searches.has(search), `${item.industry}: duplicate industry route`);
    searches.add(search);
    assert.equal(detailCaseFromSearch(dataset.cases, search)?.id, item.id, `${item.industry}: route did not resolve`);
  }
});

test('direct-detail route also accepts the stable report id and rejects unknown industries', () => {
  const item = dataset.cases[0];
  assert.equal(detailCaseFromSearch(dataset.cases, `?industry=${encodeURIComponent(item.id)}`)?.id, item.id);
  assert.equal(detailCaseFromSearch(dataset.cases, '?industry=不存在的产业'), null);
});
