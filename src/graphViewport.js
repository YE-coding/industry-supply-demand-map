export const MIN_GRAPH_SCALE = 0.54;
export const MAX_GRAPH_SCALE = 2.6;

export function clampGraphScale(scale) {
  return Math.min(MAX_GRAPH_SCALE, Math.max(MIN_GRAPH_SCALE, scale));
}

export function graphDefaultView(compact = false) {
  return compact
    ? { scale: 0.82, x: 9, y: 9 }
    : { scale: 1.14, x: -6.8, y: -7.6 };
}

export function pinchGraphView({
  startView,
  startMidpoint,
  currentMidpoint,
  startDistance,
  currentDistance,
}) {
  const safeStartDistance = Math.max(1, startDistance);
  const nextScale = clampGraphScale(startView.scale * (currentDistance / safeStartDistance));
  const worldX = (startMidpoint.x - startView.x) / startView.scale;
  const worldY = (startMidpoint.y - startView.y) / startView.scale;

  return {
    scale: nextScale,
    x: currentMidpoint.x - worldX * nextScale,
    y: currentMidpoint.y - worldY * nextScale,
  };
}
