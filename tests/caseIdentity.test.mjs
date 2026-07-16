import test from 'node:test';
import assert from 'node:assert/strict';

import { dedupeCasesByIndustry, normalizeIndustryKey, reportTimestamp } from '../src/caseIdentity.js';

test('normalizes cosmetic industry-name differences', () => {
  assert.equal(normalizeIndustryKey(' 半导体行业 '), '半导体');
  assert.equal(normalizeIndustryKey('AI 算力'), 'ai算力');
});

test('uses the complete analysis timestamp when reports share a date', () => {
  const earlier = { industry: '半导体', date: '2026-07-16 00:50:48 +08:00', title: 'earlier' };
  const later = { industry: '半导体行业', date: '2026-07-16 09:53:31 +08:00', title: 'later' };
  assert.ok(reportTimestamp(later) > reportTimestamp(earlier));
  assert.deepEqual(dedupeCasesByIndustry([earlier, later], { preferLatestDate: true }), [later]);
});
