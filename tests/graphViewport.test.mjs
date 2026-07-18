import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_GRAPH_SCALE,
  MIN_GRAPH_SCALE,
  clampGraphScale,
  graphDefaultView,
  pinchGraphView,
} from '../src/graphViewport.js';

test('mobile graph starts zoomed out and centered inside the viewport', () => {
  assert.deepEqual(graphDefaultView(true), { scale: 0.82, x: 9, y: 9 });
  assert.deepEqual(graphDefaultView(false), { scale: 1.14, x: -6.8, y: -7.6 });
});

test('pinch zoom keeps the graph point under the gesture midpoint', () => {
  const startView = { scale: 1, x: 0, y: 0 };
  const next = pinchGraphView({
    startView,
    startMidpoint: { x: 40, y: 55 },
    currentMidpoint: { x: 46, y: 51 },
    startDistance: 100,
    currentDistance: 150,
  });

  assert.equal(next.scale, 1.5);
  assert.equal((46 - next.x) / next.scale, 40);
  assert.equal((51 - next.y) / next.scale, 55);
});

test('graph scale remains usable when pinching far in or out', () => {
  assert.equal(clampGraphScale(0.1), MIN_GRAPH_SCALE);
  assert.equal(clampGraphScale(10), MAX_GRAPH_SCALE);
});
