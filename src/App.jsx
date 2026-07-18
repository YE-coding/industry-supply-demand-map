import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dataset from './data/cases.json';
import { loadMarkdownText } from './staticAssets';
import { officialIndustryLayer, relationSeeds } from './industryTaxonomy';
import { dedupeCasesByIndustry } from './caseIdentity';
import { comparePeriodLabels } from './periodSort';
import { comparisonBottleneck, comparisonSupplyStatus } from './comparisonCopy';
import { clampGraphScale, graphDefaultView, pinchGraphView } from './graphViewport';

const introWords = ['看懂行业'];
const baseCases = dedupeCasesByIndustry(dataset.cases || [], { preferLatestDate: true });

const categories = {
  core: { label: '分析框架', color: '#b8c7c5' },
  dimension: { label: '分析维度', color: '#c7d2d0' },
  tech: { label: '科技成长', color: '#9cc7d8' },
  ai: { label: 'AI 基建', color: '#c5b9df' },
  traditional: { label: '传统周期', color: '#b5d2c0' },
  energy: { label: '能源电力', color: '#e6c58d' },
  material: { label: '材料化工', color: '#ddb2a5' },
};

const pulseSteps = [
  ['预算', '谁决定花钱'],
  ['订单', '需求如何传递'],
  ['产能', '哪里真正卡住'],
  ['利润', '价值最终留下'],
];

const graphConcepts = [
  { id: 'concept-ai', name: 'AI需求', short: 'AI', category: 'dimension', keywords: ['AI', '算力', 'GPU', '大模型', '数据中心'] },
  { id: 'concept-dc', name: '数据中心', short: '数中', category: 'dimension', keywords: ['数据中心', '服务器', '机柜', 'PUE'] },
  { id: 'concept-power', name: '电力约束', short: '电力', category: 'dimension', keywords: ['电力', '电网', '用电', 'PUE', '算电'] },
  { id: 'concept-capacity', name: '产能扩张', short: '产能', category: 'dimension', keywords: ['产能', '扩产', '利用率', '过剩'] },
  { id: 'concept-price', name: '价格库存', short: '价格', category: 'dimension', keywords: ['价格', '库存', '订单', '利润', '毛利'] },
  { id: 'concept-material', name: '上游材料', short: '材料', category: 'dimension', keywords: ['材料', '硅', '锂', '铁矿', '焦煤', '化工'] },
  { id: 'concept-equipment', name: '设备工艺', short: '设备', category: 'dimension', keywords: ['设备', '光刻', '封装', '良率', '工艺'] },
];

const industryLayerOrder = ['一级产业', '二级环节', '待归类案例'];

const lensCards = [
  ['上下游', '从原材料、设备、制造到终端需求，先知道行业站在链条哪里。'],
  ['利益走向', '看谁付款、谁有定价权、谁吃利润、谁承担扩产风险。'],
  ['供需矛盾', '判断真正卡住产业的瓶颈，而不是只看概念热度。'],
  ['周期位置', '识别成长、短缺、扩张、过剩、出清等阶段和反证信号。'],
];

function publicationLabel(item) {
  return '官方示例';
}

function downloadMarkdown(item) {
  if (typeof document === 'undefined') return;
  if (item?.markdownUrl) {
    const link = document.createElement('a');
    link.href = item.markdownUrl;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  if (!item?.originalMarkdown) return;
  const originalName = String(item.file || `${item.industry || 'industry-report'}.md`);
  const filename = /\.md$/iu.test(originalName) ? originalName : `${originalName}.md`;
  const blob = new Blob([item.originalMarkdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function classifyCase(item) {
  const text = `${item.title} ${item.industry} ${item.judgment} ${item.chain}`.toLowerCase();
  if (/ai|算力|光通信|半导体|机器人/.test(text)) return item.industry === 'AI算力' ? 'ai' : 'tech';
  if (/新能源|电力|液冷|数据中心/.test(text)) return item.industry === '数据中心' || item.industry === '液冷' ? 'ai' : 'energy';
  if (/化工|焦煤|铁矿|钢铁/.test(text)) return item.industry === '化工' ? 'material' : 'traditional';
  return 'traditional';
}

function classifyIndustryLayer(item) {
  return officialIndustryLayer(item.industry);
}

function shortName(name) {
  const compact = name.replace(/行业|供需|周期|分析|（v2）|\(v2\)/g, '');
  if (/AI算力/i.test(compact)) return 'AI';
  if (compact.length <= 3) return compact;
  return compact.slice(0, 3);
}

function extractChainNodes(item) {
  if (item.chainNodes?.length) return item.chainNodes;
  const chain = item.chain || '';
  const normalized = chain
    .replace(/[↓]/g, '->')
    .replace(/[→]/g, '->')
    .replace(/\n\s*\|\s.*$/gm, '')
    .replace(/\n/g, '->');

  const parts = normalized
    .split(/->+/)
    .map((part) => part.replace(/\(.+?\)|（.+?）/g, '').trim())
    .map((part) => part.split(/[\/、,，]/)[0]?.trim())
    .filter((part) => part && part.length <= 12)
    .slice(0, 8);

  if (parts.length >= 3) return [...new Set(parts)];
  return [];
}

function extractMetricHints(item) {
  if (item.metricHints?.length) return item.metricHints.slice(0, 6);
  const text = `${item.judgment} ${item.bottlenecks.join(' ')}`;
  const matches = text.match(/[\d,.]+(?:\.\d+)?\s*(?:%|亿美元|万亿|GW|kW|个月|年|倍|家|wpm)/g) || [];
  return [...new Set(matches)].slice(0, 5);
}

function describeChainNode(node, item, index, total) {
  const fromData = item.chainNodeDetails?.find((detail) => detail.name === node) || item.chainNodeDetails?.[index];
  if (fromData) return fromData;
  const position =
    index === 0
      ? '上游入口'
      : index === total - 1
        ? '终端需求'
        : index <= Math.floor(total / 2)
          ? '中游转化'
          : '下游兑现';

  return {
    position,
    what: '',
    role: '',
    why: '',
    suppliers: '',
    buyers: '',
    money: '',
    evidence: '这份报告没有按新版 Skill 单独写出该节点的具体动作、上下游、代表企业和证据；页面不自动补写。',
  };
}

function createGraph(cases) {
  const layerGroups = cases.reduce((groups, item) => {
    const layer = classifyIndustryLayer(item);
    groups[layer] = [...(groups[layer] || []), item];
    return groups;
  }, {});
  const layerGeometry = {
    一级产业: { radiusX: 24, radiusY: 20, phase: -Math.PI / 2, size: 1.34 },
    二级环节: { radiusX: 42, radiusY: 34, phase: -Math.PI / 2 + 0.18, size: 1.02 },
    待归类案例: { radiusX: 46, radiusY: 38, phase: -Math.PI / 2 + 0.36, size: 0.95 },
  };
  const caseNodes = industryLayerOrder.flatMap((layer) => {
    const layerCases = layerGroups[layer] || [];
    const geometry = layerGeometry[layer];
    return layerCases.map((item, index) => {
      const angle = geometry.phase + (index / Math.max(1, layerCases.length)) * Math.PI * 2;
      return {
        id: item.id,
        type: 'case',
        name: item.industry,
        title: item.title,
        short: shortName(item.industry),
        category: classifyCase(item),
        layer,
        x: 50 + geometry.radiusX * Math.cos(angle),
        y: 52 + geometry.radiusY * Math.sin(angle),
        size: geometry.size + Math.min(0.24, item.bottlenecks.length * 0.035),
        settleX: Math.cos((index + 1) * 1.7) * 2.2,
        settleY: Math.sin((index + 1) * 1.3) * 1.9,
      };
    });
  });

  const links = [];
  relationSeeds.forEach((relation) => {
    const source = caseNodes.find((node) => node.name === relation.source);
    const target = caseNodes.find((node) => node.name === relation.target);
    if (source && target) links.push({ source: source.id, target: target.id, kind: 'industry', label: relation.label });
  });

  return { nodes: caseNodes, links };
}

function casesForLens(cases, lensId) {
  if (!lensId) return null;
  const concept = graphConcepts.find((item) => item.id === lensId);
  if (!concept) return null;
  const ids = cases
    .filter((item) => {
      const text = `${item.title} ${item.industry} ${item.judgment} ${item.bottlenecks.join(' ')} ${item.chain} ${item.dataCurrency}`;
      return concept.keywords.some((keyword) => text.includes(keyword));
    })
    .map((item) => item.id);
  return new Set(ids);
}

function neighborsOf(id, links) {
  const set = new Set([id]);
  links.forEach((link) => {
    if (link.source === id) set.add(link.target);
    if (link.target === id) set.add(link.source);
  });
  return set;
}

function collisionRadius(node) {
  if (node.type === 'core') return node.size + 2.8;
  if (node.type === 'case') return node.size + 2.3;
  return node.size + 1.75;
}

function seededJitter(value, range = 1) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 9973;
  }
  return ((hash / 9973) - 0.5) * range;
}

function buildAdjacency(nodes, links) {
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  links.forEach((link) => {
    adjacency.get(link.source)?.add(link.target);
    adjacency.get(link.target)?.add(link.source);
  });
  return adjacency;
}

function chooseCenterNode(nodes, adjacency, focusNodeId) {
  const focused = nodes.find((node) => node.id === focusNodeId);
  if (focused) return focused;
  const core = nodes.find((node) => node.type === 'core');
  if (core) return core;
  return [...nodes].sort((a, b) => (adjacency.get(b.id)?.size || 0) - (adjacency.get(a.id)?.size || 0))[0];
}

function initializeRadialLayout(nodes, links, focusNodeId = null) {
  const centerX = 50;
  const centerY = 54;
  const adjacency = buildAdjacency(nodes, links);
  const hasCore = nodes.some((node) => node.type === 'core');

  if (!hasCore) {
    return nodes.map((node) => ({
      ...node,
      baseX: node.x,
      baseY: node.y,
      graphLevel: node.layer === '一级产业' ? 1 : node.layer === '二级环节' ? 2 : 3,
    }));
  }

  const coreX = 50;
  const coreY = 11;
  const ringCenterY = 58;
  const centerNode = chooseCenterNode(nodes, adjacency, focusNodeId);
  if (!centerNode) return nodes;

  const levelMap = new Map([[centerNode.id, 0]]);
  const queue = [centerNode.id];
  while (queue.length) {
    const currentId = queue.shift();
    const currentLevel = levelMap.get(currentId);
    adjacency.get(currentId)?.forEach((neighborId) => {
      if (!levelMap.has(neighborId)) {
        levelMap.set(neighborId, currentLevel + 1);
        queue.push(neighborId);
      }
    });
  }

  const groups = new Map();
  nodes.forEach((node) => {
    const level = Math.min(levelMap.get(node.id) ?? 3, 3);
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(node);
  });

  const radiusByLevel = {
    0: 0,
    1: 12.5,
    2: 25.5,
    3: 37,
  };

  return nodes.map((node) => {
    const graphLevel = Math.min(levelMap.get(node.id) ?? 3, 3);
    if (graphLevel === 0) {
      return {
        ...node,
        x: coreX,
        y: coreY,
        baseX: coreX,
        baseY: coreY,
        fx: coreX,
        fy: coreY,
        graphLevel,
      };
    }

    const group = groups.get(graphLevel) || [];
    const index = group.findIndex((item) => item.id === node.id);
    const radius = radiusByLevel[graphLevel] ?? radiusByLevel[3];
    const angle = (Math.PI * 2 * index) / Math.max(1, group.length) + graphLevel * 0.34 + Math.PI / 2 + seededJitter(node.id, 0.16);
    const jitter = seededJitter(`${node.id}-radius`, 2.4);
    const x = Math.max(5, Math.min(95, centerX + Math.cos(angle) * (radius + jitter)));
    const y = Math.max(24, Math.min(95, ringCenterY + Math.sin(angle) * (radius + jitter)));

    return { ...node, x, y, baseX: x, baseY: y, graphLevel };
  });
}

function createLayoutNodes(nodes, links, focusNodeId = null) {
  return initializeRadialLayout(nodes, links, focusNodeId).map((node) => ({
    ...node,
    vx: 0,
    vy: 0,
    fx: node.fx ?? null,
    fy: node.fy ?? null,
  }));
}

function linkDistance(link) {
  if (link.kind === 'framework') return 47;
  if (link.kind === 'industry') return 21;
  return 17.5;
}

function tickForceLayout(nodes, links, alpha, radialStrength = 0, activeNodeId = null) {
  const next = nodes.map((node) => ({ ...node }));
  const byId = new Map(next.map((node) => [node.id, node]));
  const activeIds = activeNodeId ? neighborsOf(activeNodeId, links) : null;

  links.forEach((link) => {
    if (activeNodeId && link.source !== activeNodeId && link.target !== activeNodeId) return;
    const source = byId.get(link.source);
    const target = byId.get(link.target);
    if (!source || !target) return;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 0.001;
    const linkStrength = activeNodeId ? 0.012 : link.kind === 'framework' ? 0.012 : 0.026;
    const force = ((distance - linkDistance(link)) / distance) * linkStrength * alpha;
    const sx = dx * force;
    const sy = dy * force;

    if (source.fx == null) {
      source.vx += sx;
      source.vy += sy;
    }
    if (target.fx == null) {
      target.vx -= sx;
      target.vy -= sy;
    }
  });

  // Collision is global, even while one node is being dragged. A dragged node may be
  // unrelated to the node underneath it, so adjacency must never gate collision checks.
  // Resolve overlap directly instead of waiting for a weak velocity force to catch up.
  const collisionPasses = activeNodeId ? 3 : 2;
  for (let pass = 0; pass < collisionPasses; pass += 1) {
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i];
        const b = next[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 0.001) {
          const angle = (seededJitter(`${a.id}-${b.id}`, Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const minDistance = collisionRadius(a) + collisionRadius(b) + 0.22;
        if (distance >= minDistance) continue;

        const overlapX = (dx / distance) * (minDistance - distance + 0.04);
        const overlapY = (dy / distance) * (minDistance - distance + 0.04);
        if (a.fx != null && b.fx == null) {
          b.x += overlapX;
          b.y += overlapY;
          b.vx += overlapX * 0.22;
          b.vy += overlapY * 0.22;
        } else if (b.fx != null && a.fx == null) {
          a.x -= overlapX;
          a.y -= overlapY;
          a.vx -= overlapX * 0.22;
          a.vy -= overlapY * 0.22;
        } else if (a.fx != null && b.fx != null && activeNodeId === a.id) {
          b.x += overlapX;
          b.y += overlapY;
          b.fx = b.x;
          b.fy = b.y;
          b.baseX = b.x;
          b.baseY = b.y;
        } else if (a.fx != null && b.fx != null && activeNodeId === b.id) {
          a.x -= overlapX;
          a.y -= overlapY;
          a.fx = a.x;
          a.fy = a.y;
          a.baseX = a.x;
          a.baseY = a.y;
        } else if (a.fx == null && b.fx == null) {
          a.x -= overlapX * 0.5;
          a.y -= overlapY * 0.5;
          b.x += overlapX * 0.5;
          b.y += overlapY * 0.5;
          a.vx -= overlapX * 0.11;
          a.vy -= overlapY * 0.11;
          b.vx += overlapX * 0.11;
          b.vy += overlapY * 0.11;
        }
      }
    }
  }

  next.forEach((node) => {
    if (node.fx != null) {
      node.x = node.fx;
      node.y = node.fy;
      node.vx = 0;
      node.vy = 0;
      return;
    }

    const anchorStrength = node.graphLevel === 0 ? 0.055 : 0.032 + radialStrength;
    node.vx += (node.baseX - node.x) * anchorStrength * alpha;
    node.vy += (node.baseY - node.y) * anchorStrength * alpha;
    node.vx *= 0.58;
    node.vy *= 0.58;
    node.x = Math.max(4, Math.min(96, node.x + node.vx));
    node.y = Math.max(4, Math.min(96, node.y + node.vy));
  });

  return next;
}

function App() {
  const [officialMarkdownCache, setOfficialMarkdownCache] = useState({});
  const cases = baseCases;
  const [entered, setEntered] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [query, setQuery] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [activeLensId, setActiveLensId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [focusedGraphId, setFocusedGraphId] = useState(null);
  const [graphResetKey, setGraphResetKey] = useState(0);
  const [resetAcknowledged, setResetAcknowledged] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [activeChainIndex, setActiveChainIndex] = useState(0);
  const [lockedChainIndex, setLockedChainIndex] = useState(null);

  const graph = useMemo(() => createGraph(cases), [cases]);
  const selectedCase = cases.find((item) => item.id === selectedId);
  const detailCase = selectedCase?.originalMarkdown || !selectedCase ? selectedCase : officialMarkdownCache[selectedCase.id] ? { ...selectedCase, originalMarkdown: officialMarkdownCache[selectedCase.id] } : selectedCase;
  const hoveredCase = cases.find((item) => item.id === hoveredId);
  const focusedCase = cases.find((item) => item.id === focusedGraphId);

  useEffect(() => {
    if (!selectedCase?.markdownUrl || selectedCase.originalMarkdown || officialMarkdownCache[selectedCase.id]) return;
    let active = true;
    loadMarkdownText(selectedCase.markdownUrl)
      .then((markdown) => {
        if (active) setOfficialMarkdownCache((current) => ({ ...current, [selectedCase.id]: markdown }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [officialMarkdownCache, selectedCase]);

  const searchFilteredIds = useMemo(() => {
    if (!query.trim()) return new Set(graph.nodes.map((node) => node.id));
    const q = normalize(query);
    return new Set(
      graph.nodes
        .filter((node) => {
          if (normalize(node.name).includes(q) || normalize(node.title).includes(q)) return true;
          const item = cases.find((caseItem) => caseItem.id === node.id);
          return item ? normalize(item.judgment + item.bottlenecks.join(' ') + item.chain).includes(q) : false;
        })
        .map((node) => node.id),
    );
  }, [cases, graph.nodes, query]);

  const lensFilteredIds = useMemo(() => casesForLens(cases, activeLensId), [activeLensId, cases]);
  const filteredIds = useMemo(() => {
    if (!lensFilteredIds) return searchFilteredIds;
    return new Set([...searchFilteredIds].filter((id) => lensFilteredIds.has(id)));
  }, [lensFilteredIds, searchFilteredIds]);

  const graphFocusId = hoveredId || focusedGraphId || selectedId;
  const neighborSet = useMemo(() => (graphFocusId ? neighborsOf(graphFocusId, graph.links) : null), [graphFocusId, graph.links]);

  const activateIndustry = (id) => {
    const isIndustry = cases.some((item) => item.id === id);
    if (focusedGraphId === id && isIndustry) {
      setSelectedId(id);
      return;
    }
    setFocusedGraphId(id);
    if (selectedId && selectedId !== id) setSelectedId(null);
  };

  const clearGraphFocus = () => {
    setFocusedGraphId(null);
    setHoveredId(null);
    if (selectedId) setSelectedId(null);
  };

  const clearAllGraphFilters = (event) => {
    setGuideOpen(false);
    setLibraryOpen(false);
    clearGraphFocus();
    setQuery('');
    setActiveLensId(null);
    setGraphResetKey((current) => current + 1);
    setResetAcknowledged(true);
    event?.currentTarget?.blur?.();
    window.setTimeout(() => setResetAcknowledged(false), 1200);
  };

  const openCaseFromLibrary = (id) => {
    setFocusedGraphId(id);
    setSelectedId(id);
    setLibraryOpen(false);
  };

  const openExperience = () => {
    if (zooming) return;
    setZooming(true);
    window.setTimeout(() => setEntered(true), 1700);
  };

  useEffect(() => {
    const onWheel = () => {
      if (!entered) openExperience();
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [entered, zooming]);

  useEffect(() => {
    setActiveChainIndex(0);
    setLockedChainIndex(null);
  }, [selectedId]);

  useEffect(() => {
    if (!guideOpen && !libraryOpen) return undefined;
    const closePanelOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setGuideOpen(false);
      setLibraryOpen(false);
    };
    window.addEventListener('keydown', closePanelOnEscape);
    return () => window.removeEventListener('keydown', closePanelOnEscape);
  }, [guideOpen, libraryOpen]);

  if (!entered) {
    return (
      <main className={`intro-screen ${zooming ? 'is-zooming' : ''}`} onClick={openExperience}>
        <div className="intro-lockup">
          <span className="intro-kicker">INDUSTRY SUPPLY / DEMAND ATLAS</span>
          <button className="intro-word" aria-label="进入行业图谱">{introWords[0]}</button>
          <SupplyDemandPulse compact />
        </div>
        <p>点击或滑动，沿着订单进入产业链</p>
      </main>
    );
  }

  return (
    <main className={`knowledge-shell ${selectedCase ? 'has-selection' : ''}`}>
      <IndustrySidebar
        cases={cases}
        activeId={focusedGraphId}
        selectedId={selectedId}
        onHover={setHoveredId}
        onActivate={activateIndustry}
      />
      <header className={`search-row ${selectedCase ? 'is-muted' : ''}`}>
        <div className="atlas-brand" aria-label="产业供需地图">
          <strong>供需地图</strong>
          <span>{cases.length} 个行业 · 静态研究库</span>
        </div>
        <div className="search-box">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索行业、瓶颈、上游、利润流向" />
          <kbd>SEARCH</kbd>
        </div>
        <nav className="atlas-actions" aria-label="页面工具">
          <button className="library-trigger" onClick={() => { setGuideOpen(false); setLibraryOpen(true); }}>案例档案</button>
          <button className="guide-trigger" onClick={() => { setLibraryOpen(false); setGuideOpen(true); }}>生成调用词</button>
          <button
            type="button"
            className={`graph-reset ${resetAcknowledged ? 'is-confirmed' : ''}`}
            title="清除搜索、分析透镜和行业选择，并恢复图谱缩放位置"
            onClick={clearAllGraphFilters}
          >
            {resetAcknowledged ? '已恢复' : '恢复全图'}
          </button>
        </nav>
      </header>
      <section className={`graph-stage ${selectedCase ? 'is-faded' : ''}`} aria-label="产业关系图谱">
        <div className="purpose-line">
          <div className="purpose-copy">
            <p className="micro-title">从付款方开始</p>
            <h1>沿着订单，找到利润</h1>
            <p>关系图只画真实产业连接。先看谁付钱，再追踪需求经过哪些瓶颈，最后判断利润落在哪个环节。</p>
          </div>
          <SupplyDemandPulse />
        </div>
        <div className="graph-workbench">
          <IndustryGraph
            nodes={graph.nodes}
            links={graph.links}
            filteredIds={filteredIds}
            neighborSet={neighborSet}
            hoveredId={hoveredId}
            focusedId={focusedGraphId}
            resetKey={graphResetKey}
            onHover={setHoveredId}
            onFocus={activateIndustry}
            onOpenDetail={setSelectedId}
            onClearFocus={clearGraphFocus}
          />
          <AnalysisLensPanel
            cases={cases}
            activeLensId={activeLensId}
            onSelect={(id) => {
              setActiveLensId((current) => (current === id ? null : id));
              clearGraphFocus();
            }}
          />
        </div>
        <GraphLegend />
        <FocusCard item={focusedCase} onOpen={() => focusedCase && setSelectedId(focusedCase.id)} />
        <HoverCaption item={hoveredCase} />
      </section>

      <PromptGuidePanel
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />

      <CaseLibraryPanel
        open={libraryOpen}
        cases={cases}
        onClose={() => setLibraryOpen(false)}
        onOpenCase={openCaseFromLibrary}
        onDownloadMarkdown={downloadMarkdown}
      />

      {detailCase && (
        <IndustryPanel
          item={detailCase}
          cases={cases}
          activeChainIndex={activeChainIndex}
          setActiveChainIndex={setActiveChainIndex}
          lockedChainIndex={lockedChainIndex}
          setLockedChainIndex={setLockedChainIndex}
          onDownloadMarkdown={downloadMarkdown}
          close={() => setSelectedId(null)}
        />
      )}
    </main>
  );
}

function SupplyDemandPulse({ compact = false }) {
  return (
    <div className={`supply-pulse ${compact ? 'is-compact' : ''}`} aria-label="预算到利润的传导路径">
      <div className="pulse-track" aria-hidden="true"><i /></div>
      {pulseSteps.map(([title, description], index) => (
        <div className="pulse-step" key={title}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <strong>{title}</strong>
          {!compact && <small>{description}</small>}
        </div>
      ))}
    </div>
  );
}

function buildSkillPrompt({ industry, geography, dataScope, depth }) {
  const target = industry.trim() || '请替换为你要研究的行业';
  const scope = geography.trim() || '中国 + 全球关键市场';
  const currency = dataScope.trim() || '尽量使用最近 12-24 个月公开数据，并标明数据截至时间';
  const depthText = {
    quick: '快速版',
    standard: '标准版',
    deep: '深度版',
  }[depth] || '标准版';

  return `请调用我已安装的 industry-cycle-analysis skill（也可用触发词：产析skill），分析「${target}」。

如果当前环境没有安装该 skill，请不要临时仿写 skill 内容；请提示我先从 GitHub 安装该 skill 后再运行。

本次任务参数：
- 行业/赛道：${target}
- 地理范围：${scope}
- 信息搜集范围：${currency}
- 分析深度：${depthText}
- 目标读者：学生、城市青年、创业者等非专业投资人

输出要求：
1. 严格使用已安装的 industry-cycle-analysis skill 完成分析。
2. 只输出 Markdown，方便自行保存、复核和分享。
3. 必须保留这三行元信息，便于后续更新和追溯：
   分析日期：YYYY-MM-DD
   地理范围：${scope}
   数据时效：${currency}
4. 必须按 skill 的新版 full report 模板输出，保留这些章节契约：
   ## 0. 一页看懂
   ## 1. 产业链地图
   ## 4. 供需矛盾与高频信号
   ## 5. 周期位置与传导
   ## 6. 资金动向
   ## 7. 未来资金可能流向
   ## 8. 分歧与反证
   ## 9. 观察哨与跟踪
   ## 10. 术语表
   ## 附录A 证据台账
5. 平行输入要用 mermaid 分支表达；代表企业要写上市地/代码、位置和代表性，不要只列名字。
6. 缺数据时明确写缺口和下一步监控来源，不要用通用套话补齐。
7. 不要输出买卖建议，不要做短线荐股。`;
}

function PromptGuidePanel({ open, onClose }) {
  const [industry, setIndustry] = useState('低空经济');
  const [geography, setGeography] = useState('中国');
  const [dataScope, setDataScope] = useState('最近 12-24 个月公开数据，尽量更新到最新季度');
  const [depth, setDepth] = useState('standard');
  const [copyState, setCopyState] = useState('');

  if (!open) return null;

  const prompt = buildSkillPrompt({ industry, geography, dataScope, depth });
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState('已复制');
    } catch {
      setCopyState('复制失败，请手动全选复制');
    }
  };

  return (
    <section
      className="guide-layer"
      aria-label="Skill 调用词生成器"
      role="dialog"
      aria-modal="true"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="guide-panel">
        <button className="guide-close" onClick={onClose}>关闭</button>
        <div className="guide-head">
          <p className="micro-title">Skill 调用词</p>
          <h2>调用已安装的 GitHub Skill</h2>
          <p>这里不内置 skill 内容，只生成一段任务调用词。用户需要先安装 GitHub skill，再把调用词复制到自己的模型里运行，并自行保存生成的 Markdown。</p>
        </div>

        <div className="guide-form">
          <label>
            <span>行业/赛道</span>
            <input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="例如：AI眼镜、铜箔、低空经济" />
          </label>
          <label>
            <span>地理范围</span>
            <input value={geography} onChange={(event) => setGeography(event.target.value)} placeholder="例如：中国、全球、美国" />
          </label>
          <label>
            <span>信息范围</span>
            <input value={dataScope} onChange={(event) => setDataScope(event.target.value)} placeholder="例如：最近 12-24 个月公开数据" />
          </label>
          <label>
            <span>分析深度</span>
            <select value={depth} onChange={(event) => setDepth(event.target.value)}>
              <option value="quick">快速版</option>
              <option value="standard">标准版</option>
              <option value="deep">深度版</option>
            </select>
          </label>
        </div>

        <textarea className="guide-prompt" value={prompt} readOnly />

        <div className="guide-actions">
          <button onClick={copyPrompt}>复制调用词</button>
          {copyState && <span>{copyState}</span>}
        </div>
      </div>
    </section>
  );
}

function CaseLibraryPanel({ open, cases, onClose, onOpenCase, onDownloadMarkdown }) {
  if (!open) return null;
  const groups = [['官方示例', cases]];

  return (
    <section
      className="library-layer"
      aria-label="案例库"
      role="dialog"
      aria-modal="true"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="library-panel">
        <button className="library-close" onClick={onClose}>关闭</button>
        <div className="library-head">
          <p className="micro-title">案例库</p>
          <h2>浏览案例和原始材料</h2>
          <p>当前案例库由静态行业报告生成。可以进入详情阅读分析，也可以下载对应的原始 Markdown。</p>
          <div className="library-stats">
            <span>静态案例：{cases.length}</span>
          </div>
        </div>

        {groups.map(([title, items]) => (
          <section key={title} className="library-section">
            <div className="library-section-head">
              <strong>{title}</strong>
              <span>{items.length} 份报告</span>
            </div>
            <div className="library-grid">
              {items.map((item) => {
                const qualityScore = item.quality?.score;
                return (
                  <article key={item.id} className="library-card">
                    <div className="library-card-top">
                      <span className="case-badge official">{publicationLabel(item)}</span>
                      <span className="quality-pill">{qualityScore == null ? '未评分' : `${qualityScore} 分`}</span>
                    </div>
                    <h3>{item.industry}</h3>
                    <p>{compactText(item.judgment, 108)}</p>
                    <dl>
                      <div>
                        <dt>报告时间</dt>
                        <dd>{reportDate(item)}</dd>
                      </div>
                      <div>
                        <dt>信息范围</dt>
                        <dd>{dataFreshness(item)}</dd>
                      </div>
                      <div>
                        <dt>来源线索</dt>
                        <dd>{item.sourceHints?.length || 0} 条</dd>
                      </div>
                    </dl>
                    <div className="library-card-actions">
                      <button onClick={() => onOpenCase(item.id)}>查看详情</button>
                      {(item.originalMarkdown || item.markdownUrl) && <button className="secondary-button" onClick={() => onDownloadMarkdown(item)}>下载 MD</button>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function IndustryGraph({
  nodes,
  links,
  filteredIds,
  neighborSet,
  hoveredId,
  focusedId,
  resetKey,
  onHover,
  onFocus,
  onOpenDetail,
  onClearFocus,
}) {
  const svgRef = useRef(null);
  const frameRef = useRef(null);
  const pendingViewRef = useRef(null);
  const rafRef = useRef(null);
  const layoutRafRef = useRef(null);
  const alphaRef = useRef(0);
  const radialUntilRef = useRef(0);
  const dragFixedRef = useRef(null);
  const nodeDragStartRef = useRef(null);
  const localNodeRef = useRef(null);
  const touchPointersRef = useRef(new Map());
  const pinchGestureRef = useRef(null);
  const viewRef = useRef(graphDefaultView(false));
  const [isCompactGraph, setIsCompactGraph] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  const [view, setView] = useState(() => graphDefaultView(window.matchMedia('(max-width: 640px)').matches));
  const [dragStart, setDragStart] = useState(null);
  const [nodeDragStart, setNodeDragStart] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);
  const dragMovedRef = useRef(false);
  const [layoutNodes, setLayoutNodes] = useState(() => createLayoutNodes(nodes, links));
  const layoutNodesRef = useRef(layoutNodes);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const updateCompactGraph = (event) => {
      const compact = event.matches;
      setIsCompactGraph(compact);
      setView(graphDefaultView(compact));
    };
    media.addEventListener?.('change', updateCompactGraph);
    return () => media.removeEventListener?.('change', updateCompactGraph);
  }, []);

  function runLayoutFrame() {
    const radialStrength = performance.now() < radialUntilRef.current ? 0.15 : 0;
    const activeNodeId = dragFixedRef.current?.id || localNodeRef.current;
    const next = tickForceLayout(layoutNodesRef.current, links, alphaRef.current, radialStrength, activeNodeId);
    layoutNodesRef.current = next;
    setLayoutNodes(next);

    const dragging = dragFixedRef.current != null;
    alphaRef.current *= dragging ? 0.9 : 0.88;
    if (alphaRef.current > 0.012 || dragging) {
      layoutRafRef.current = window.requestAnimationFrame(runLayoutFrame);
    } else {
      layoutRafRef.current = null;
      alphaRef.current = 0;
      localNodeRef.current = null;
    }
  }

  const warmLayout = (alpha) => {
    alphaRef.current = Math.max(alphaRef.current, alpha);
    if (!layoutRafRef.current) {
      layoutRafRef.current = window.requestAnimationFrame(runLayoutFrame);
    }
  };

  useEffect(() => {
    const seeded = createLayoutNodes(nodes, links, 'concept-core');
    layoutNodesRef.current = seeded;
    setLayoutNodes(seeded);
    alphaRef.current = 0.72;
    radialUntilRef.current = performance.now() + 800;
    if (!layoutRafRef.current) {
      layoutRafRef.current = window.requestAnimationFrame(runLayoutFrame);
    }
    return () => {
      if (layoutRafRef.current) {
        window.cancelAnimationFrame(layoutRafRef.current);
        layoutRafRef.current = null;
      }
    };
  }, [nodes, links]);

  const zoom = (delta) => {
    setView((current) => ({
      ...current,
      scale: clampGraphScale(current.scale + delta),
    }));
  };

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const handleWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      setView((current) => ({
        ...current,
        scale: clampGraphScale(current.scale + delta),
      }));
    };
    frame.addEventListener('wheel', handleWheel, { passive: false });
    return () => frame.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    if (!resetKey) return;
    const seeded = createLayoutNodes(nodes, links, 'concept-core');
    layoutNodesRef.current = seeded;
    setLayoutNodes(seeded);
    setView(graphDefaultView(isCompactGraph));
    alphaRef.current = 0.58;
    radialUntilRef.current = performance.now() + 600;
    if (!layoutRafRef.current) layoutRafRef.current = window.requestAnimationFrame(runLayoutFrame);
  }, [resetKey, isCompactGraph]);

  const pointerToGraphPoint = (event) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM?.();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(matrix.inverse());
    return {
      x: (svgPoint.x - view.x) / view.scale,
      y: (svgPoint.y - view.y) / view.scale,
    };
  };

  const handlePointerMove = (event) => {
    if (!svgRef.current) return;
    const box = svgRef.current.getBoundingClientRect();

    const activeNodeDrag = nodeDragStartRef.current;
    if (activeNodeDrag) {
      const pointer = pointerToGraphPoint(event);
      if (!pointer) return;
      const dx = pointer.x - activeNodeDrag.pointerX;
      const dy = pointer.y - activeNodeDrag.pointerY;
      if (Math.abs(event.clientX - activeNodeDrag.x) + Math.abs(event.clientY - activeNodeDrag.y) <= 3) return;
      dragMovedRef.current = true;
      const fixed = {
        id: activeNodeDrag.id,
        x: Math.max(4, Math.min(96, activeNodeDrag.nodeX + dx)),
        y: Math.max(4, Math.min(96, activeNodeDrag.nodeY + dy)),
      };
      dragFixedRef.current = fixed;
      layoutNodesRef.current = layoutNodesRef.current.map((node) =>
        node.id === fixed.id
          ? { ...node, x: fixed.x, y: fixed.y, fx: fixed.x, fy: fixed.y, vx: 0, vy: 0 }
          : node,
      );
      // The animation frame publishes only the newest pointer position. Avoid queuing a
      // React render for every pointer event, which made the node visibly trail the cursor.
      warmLayout(0.42);
      return;
    }

    if (!dragStart) return;
    const dx = ((event.clientX - dragStart.x) / box.width) * 100;
    const dy = ((event.clientY - dragStart.y) / box.height) * 100;
    pendingViewRef.current = {
      ...dragStart.view,
      x: dragStart.view.x + dx / dragStart.view.scale,
      y: dragStart.view.y + dy / dragStart.view.scale,
    };
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      setView(pendingViewRef.current);
      rafRef.current = null;
    });
  };

  const startDrag = (event) => {
    if (pinchGestureRef.current) return;
    if (event.target.closest?.('.graph-node')) return;
    if (event.target.closest?.('.graph-tools')) return;
    if (event.target.closest?.('.relation-tooltip')) return;
    onClearFocus();
    setDragStart({ x: event.clientX, y: event.clientY, view });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const startNodeDrag = (event, node) => {
    if (pinchGestureRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    // Only the most recently placed non-core node stays pinned. Releasing older
    // manual pins guarantees the next dragged node can still collide with them.
    layoutNodesRef.current = layoutNodesRef.current.map((item) =>
      item.id !== node.id && item.graphLevel !== 0 && item.fx != null
        ? { ...item, fx: null, fy: null, vx: 0, vy: 0 }
        : item,
    );
    const current = layoutNodesRef.current.find((item) => item.id === node.id) || node;
    const pointer = pointerToGraphPoint(event);
    if (!pointer) return;
    const start = {
      id: node.id,
      x: event.clientX,
      y: event.clientY,
      pointerX: pointer.x,
      pointerY: pointer.y,
      nodeX: current.x,
      nodeY: current.y,
    };
    nodeDragStartRef.current = start;
    dragFixedRef.current = { id: node.id, x: current.x, y: current.y };
    setNodeDragStart(start);
    dragMovedRef.current = false;
    localNodeRef.current = node.id;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const stopDrag = () => {
    const activeNodeDrag = nodeDragStartRef.current;
    if (activeNodeDrag && dragMovedRef.current) {
      layoutNodesRef.current = layoutNodesRef.current.map((node) =>
        node.id === activeNodeDrag.id
          ? { ...node, fx: node.x, fy: node.y, baseX: node.x, baseY: node.y, vx: 0, vy: 0 }
          : node,
      );
      setLayoutNodes(layoutNodesRef.current);
      dragFixedRef.current = null;
      localNodeRef.current = activeNodeDrag.id;
      warmLayout(0.1);
    } else {
      dragFixedRef.current = null;
      localNodeRef.current = null;
    }
    setDragStart(null);
    nodeDragStartRef.current = null;
    setNodeDragStart(null);
  };

  const clientToSvgViewportPoint = (clientX, clientY) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box?.width || !box?.height) return null;
    return {
      x: ((clientX - box.left) / box.width) * 100,
      y: ((clientY - box.top) / box.height) * 100,
    };
  };

  const beginPinchGesture = () => {
    const pointers = [...touchPointersRef.current.values()];
    if (pointers.length < 2) return;
    const [first, second] = pointers;
    const startMidpoint = clientToSvgViewportPoint(
      (first.x + second.x) / 2,
      (first.y + second.y) / 2,
    );
    if (!startMidpoint) return;
    pinchGestureRef.current = {
      startView: viewRef.current,
      startMidpoint,
      startDistance: Math.hypot(second.x - first.x, second.y - first.y),
    };
    dragMovedRef.current = true;
    dragFixedRef.current = null;
    nodeDragStartRef.current = null;
    localNodeRef.current = null;
    setDragStart(null);
    setNodeDragStart(null);
  };

  const handleTouchPointerDown = (event) => {
    if (event.pointerType !== 'touch') return;
    touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPointersRef.current.size === 2) beginPinchGesture();
  };

  const handleTouchPointerMove = (event) => {
    if (event.pointerType !== 'touch' || !touchPointersRef.current.has(event.pointerId)) return;
    touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPointersRef.current.size < 2) return;
    if (!pinchGestureRef.current) beginPinchGesture();
    const gesture = pinchGestureRef.current;
    const [first, second] = [...touchPointersRef.current.values()];
    const currentMidpoint = clientToSvgViewportPoint(
      (first.x + second.x) / 2,
      (first.y + second.y) / 2,
    );
    if (!gesture || !currentMidpoint) return;
    event.preventDefault();
    setView(pinchGraphView({
      ...gesture,
      currentMidpoint,
      currentDistance: Math.hypot(second.x - first.x, second.y - first.y),
    }));
  };

  const handleTouchPointerEnd = (event) => {
    if (event.pointerType !== 'touch') return;
    touchPointersRef.current.delete(event.pointerId);
    if (touchPointersRef.current.size < 2) pinchGestureRef.current = null;
  };

  return (
    <div
      ref={frameRef}
      className="graph-frame"
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => {
        if (!event.target.closest?.('.graph-tools')) {
          document.activeElement?.blur?.();
          event.preventDefault();
        }
      }}
    >
      <div className="graph-tools" aria-label="图谱缩放控制">
        <button type="button" title="放大图谱" onClick={() => zoom(0.12)}>＋ 放大</button>
        <button type="button" title="缩小图谱" onClick={() => zoom(-0.12)}>－ 缩小</button>
        <button type="button" title="恢复默认缩放和位置" onClick={() => setView(graphDefaultView(isCompactGraph))}>适应图谱</button>
      </div>
      <svg
        ref={svgRef}
        className="industry-graph"
        viewBox="0 0 100 100"
        role="img"
        aria-label="行业关系网络"
        onPointerDownCapture={handleTouchPointerDown}
        onPointerMoveCapture={handleTouchPointerMove}
        onPointerUpCapture={handleTouchPointerEnd}
        onPointerCancelCapture={handleTouchPointerEnd}
        onPointerDown={startDrag}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={(event) => {
          handleTouchPointerEnd(event);
          stopDrag();
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
      <defs>
        <radialGradient id="nodeGlow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="graph-world" transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
      {links.map((link, index) => {
        const source = layoutNodes.find((node) => node.id === link.source);
        const target = layoutNodes.find((node) => node.id === link.target);
        if (!source || !target) return null;
        const visible = filteredIds.has(source.id) || filteredIds.has(target.id);
        const highlighted = neighborSet && neighborSet.has(source.id) && neighborSet.has(target.id);
        const linkKey = `${link.source}-${link.target}-${index}`;
        const isHoveredLink = hoveredLink?.key === linkKey;
        return (
          <g
            key={linkKey}
            onMouseEnter={() => setHoveredLink({
              key: linkKey,
              source: source.name,
              target: target.name,
              label: link.label || '相关关系',
            })}
            onMouseLeave={() => setHoveredLink(null)}
          >
            <line
              className="graph-link-hit"
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
            />
            <line
              className={`graph-link ${highlighted || isHoveredLink ? 'is-lit' : ''} ${visible ? '' : 'is-hidden'}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
            />
          </g>
        );
      })}

      {layoutNodes.map((node) => {
        const category = categories[node.category] || categories.traditional;
        const isFocus = hoveredId === node.id || focusedId === node.id;
        const isSelected = focusedId === node.id;
        const isDim = !isFocus && ((neighborSet && !neighborSet.has(node.id)) || !filteredIds.has(node.id));
        const labelVisible = (node.type === 'case' && (isCompactGraph || isFocus || neighborSet?.has(node.id) || view.scale >= 1.1)) || node.type === 'core';
        return (
          <g
            key={node.id}
            className={`graph-node ${isFocus ? 'is-focus' : ''} ${isSelected ? 'is-selected' : ''} ${isDim ? 'is-dim' : ''} ${nodeDragStart?.id === node.id ? 'is-dragging' : ''} ${node.type}`}
            transform={`translate(${node.x} ${node.y})`}
            onMouseEnter={() => onHover(node.id)}
            onMouseLeave={() => onHover(null)}
            onPointerDown={(event) => startNodeDrag(event, node)}
            onPointerUp={() => {
              if (!dragMovedRef.current) onFocus(node.id);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (node.type === 'case') onOpenDetail(node.id);
            }}
            role="button"
            aria-label={`${node.name}，${node.layer || category.label}`}
            data-layer={node.layer || ''}
            data-name={node.name}
            style={{ '--settle-x': `${node.settleX || 0}px`, '--settle-y': `${node.settleY || 0}px` }}
          >
            {isFocus && <circle className="node-halo" r={node.size + 5.8} fill="url(#nodeGlow)" />}
            <circle className="hit-area" r={node.type === 'case' ? node.size + 5.8 : node.size + 3.2} />
            <circle r={isFocus ? node.size + 0.75 : node.size} fill={category.color} />
            {labelVisible && (
              <>
                {isFocus && (
                  <text className="node-caption" y={-(node.size + 5.4)}>
                    {node.layer || category.label}
                  </text>
                )}
                <text className="node-label" y={node.size + 5.35}>
                  {node.name}
                </text>
              </>
            )}
            {!labelVisible && node.type === 'concept' && (
              <text className="concept-label" y={node.size + 3.2}>
                {node.short}
              </text>
            )}
          </g>
        );
      })}
      </g>
    </svg>
      <aside className={`relation-tooltip ${hoveredLink ? 'is-visible' : ''}`}>
        {hoveredLink && (
          <>
            <strong>{hoveredLink.source} → {hoveredLink.target}</strong>
            <span>关系：{hoveredLink.label}</span>
          </>
        )}
      </aside>
      <p className="graph-hint">
        {isCompactGraph
          ? '单指拖动画布 · 双指缩放 · 点节点看摘要 · 再点进入详情'
          : '图谱内滚轮缩放 · 拖动画布或节点 · 单击看摘要 · 双击进详情'}
      </p>
    </div>
  );
}

function AnalysisLensPanel({ cases, activeLensId, onSelect }) {
  return (
    <aside className="analysis-lens" aria-label="分析透镜">
      <div>
        <p className="micro-title">分析透镜</p>
        <strong>按方法维度高亮行业</strong>
      </div>
      <div className="lens-list">
        {graphConcepts.map((lens) => {
          const matched = casesForLens(cases, lens.id);
          const isActive = activeLensId === lens.id;
          return (
            <button
              key={lens.id}
              className={isActive ? 'is-active' : ''}
              onClick={() => onSelect(lens.id)}
            >
              <span>{lens.name}</span>
              <small>{matched?.size || 0} 个行业</small>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function GraphLegend() {
  const visibleCategories = Object.entries(categories).filter(([key]) => !['core', 'dimension'].includes(key));
  return (
    <div className="graph-legend">
      {visibleCategories.map(([key, value]) => (
        <span key={key}>
          <i style={{ background: value.color }} />
          {value.label}
        </span>
      ))}
    </div>
  );
}

function IndustrySidebar({ cases, activeId, selectedId, onHover, onActivate }) {
  const groupedCases = industryLayerOrder
    .map((layer) => ({
      layer,
      items: cases.filter((item) => classifyIndustryLayer(item) === layer),
    }))
    .filter((group) => group.items.length);

  return (
    <aside className="industry-sidebar" aria-label="行业列表">
      <div className="sidebar-head">
        <span className="sidebar-index">INDEX</span>
        <strong>产业索引</strong>
        <span>按产业层级进入研究对象</span>
      </div>
      <div className="sidebar-list">
        {groupedCases.map((group) => (
          <section key={group.layer} className="sidebar-group">
            <p>{group.layer}</p>
            {group.items.map((item) => {
              const category = categories[classifyCase(item)] || categories.traditional;
              const isActive = activeId === item.id || selectedId === item.id;
              return (
                <button
                  key={item.id}
                  className={isActive ? 'is-active' : ''}
                  style={{ '--item-color': category.color }}
                  onMouseEnter={() => onHover(item.id)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onActivate(item.id)}
                >
                  <i />
                  <span>{item.industry}</span>
                  <small>{caseOriginLabel(item)} · {item.stage}</small>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </aside>
  );
}

function FocusCard({ item, onOpen }) {
  if (!item) return null;
  const sourceCount = item.sourceHints?.length || 0;
  return (
    <aside
      className="focus-card"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <span>{caseOriginLabel(item)} · {classifyIndustryLayer(item)} · {item.stage}</span>
      <strong>{item.industry}</strong>
      <p>{item.judgment}</p>
      <dl>
        <div>
          <dt>核心瓶颈</dt>
          <dd>{item.bottlenecks[0]}</dd>
        </div>
        <div>
          <dt>证据线索</dt>
          <dd>{sourceCount ? `${sourceCount} 条来源/指标线索` : '需要补充来源线索'}</dd>
        </div>
        <div>
          <dt>报告时间</dt>
          <dd>{item.date || '未标注分析日期'}</dd>
        </div>
        <div>
          <dt>信息范围</dt>
          <dd>{item.dataCurrency || '未标注数据时效'}</dd>
        </div>
        <div>
          <dt>质量状态</dt>
          <dd>{qualityLabel(item)}</dd>
        </div>
      </dl>
      <button onClick={onOpen}>查看完整分析</button>
    </aside>
  );
}

function HoverCaption({ item }) {
  return (
    <aside className={`hover-caption ${item ? 'is-visible' : ''}`}>
      {item && (
        <>
          <span>{item.stage}</span>
          <strong>{item.title}</strong>
          <p>{item.bottlenecks[0]}</p>
        </>
      )}
    </aside>
  );
}

const stagePlainLanguage = {
  导入期: '产品或商业模式刚开始被采用。需求已有苗头，但订单、收入和盈利还没有形成稳定验证。',
  成长期: '需求和订单正在快速增加，行业仍以抢客户、抢产能和扩大渗透率为主。',
  短缺期: '真实需求超过可交付的有效供给，交期、价格或利润通常会向稀缺环节集中。',
  扩张期: '企业已经看到需求，正在投入设备和产能；利润可能仍好，但未来供给压力也在累积。',
  盈利兑现期: '需求不再只是故事：订单已经进入收入和毛利，利润开始在关键环节的财报里出现；与此同时，扩产也在加速。',
  结构性短缺期: '不是全行业都缺，而是特定环节的合格产能、认证、良率或交期跟不上真实订单。',
  结构性短缺与扩产并行: '最紧的先进环节仍供不应求，但企业已经加速投设备和产能；短期利润强，后续要防供给追上后的价格和毛利变化。',
  震荡期: '需求、库存、价格和产能信号没有同向确认，行业可能在修复与回落之间反复，需要用观察哨继续验证。',
  过剩期: '可交付供给超过真实需求，库存、价格、利用率和利润开始承压。',
  出清期: '低效率或高成本供给开始退出，库存和资本开支收缩，为下一轮修复腾出空间。',
  待验证: '当前证据还不足以把行业放进一个明确阶段，需要补充订单、供给、库存或利润数据。',
};

function explainStage(stage) {
  return stagePlainLanguage[stage] || `“${stage}”是报告当前的阶段假设，必须由订单、供给、库存和利润共同验证。`;
}

function evidenceStatusLabel(item) {
  if (item.quality?.structureScore != null && item.quality?.evidenceScore != null) {
    return `结构 ${item.quality.structureScore} · 证据 ${item.quality.evidenceScore}`;
  }
  if (item.quality?.level) return item.quality.level;
  const score = item.quality?.score;
  if (score == null) return '证据状态未评估';
  if (score >= 78) return '多环节已有证据';
  if (score >= 56) return '部分环节已有证据';
  return '关键证据仍缺失';
}

function stageReasons(item) {
  const actualTimeline = (item.cycleTimeline || []).filter((row) => !/计划|风险|预测|预期|E$/iu.test(row.period));
  const reasons = actualTimeline.map((row) => `${row.period}：${row.signal}`);
  (item.signalRows || []).forEach((row) => {
    if (reasons.length < 3 && row.interpretation) reasons.push(`${signalName(row.signal)}：${row.interpretation}`);
  });
  if (!reasons.length) reasons.push(firstSentence(item.judgment));
  return [...new Set(reasons)].slice(0, 3);
}

function stageInvalidation(item) {
  return item.currentStage?.proveWrong
    || buildConclusionLayers(item, extractChainNodes(item), extractMetricHints(item)).find(([label]) => label === '反证')?.[1]
    || '如果订单、价格、库存、资本开支和利润同时反向变化，就要重新判断阶段。';
}

function profitQuestionLabel(question = '') {
  const normalizedQuestion = String(question).toLowerCase();
  if (/who pays|谁付款|谁出钱|谁最终付款/u.test(normalizedQuestion)) return '谁出钱';
  if (/captures gross profit|拿走.*利润|利润.*集中|利润当前集中/u.test(normalizedQuestion)) return '利润主要留在哪';
  if (/bears capex|inventory risk|承担.*风险|谁承担.*资本开支/u.test(normalizedQuestion)) return '谁承担扩产与库存风险';
  if (/pricing power|定价权|谁有定价权/u.test(normalizedQuestion)) return '谁更有定价权';
  if (/monetize less|变现.*弱|赚钱.*少|赚不到钱|谁重要但/u.test(normalizedQuestion)) return '谁重要，但未必更赚钱';
  return question;
}

function profitRows(item, chainNodes) {
  if (item.profitMap?.length) return item.profitMap;
  const lastNode = chainNodes[chainNodes.length - 1] || '终端需求';
  return [
    {
      question: 'Who pays?',
      answer: `当前报告只把“${lastNode}”放在需求末端，没有单独识别最终预算方。`,
      gap: '需用采购、资本开支或订单数据补充。',
    },
    {
      question: 'Who captures gross profit?',
      answer: '当前报告没有把利润池按产业环节拆开，页面不做推测。',
      gap: '需补充各环节收入、毛利和定价证据。',
    },
    {
      question: 'Who bears capex and inventory risk?',
      answer: item.bottlenecks?.[0] || '当前报告没有明确扩产和库存风险承担者。',
      gap: '需补充资本开支、库存和利用率。',
    },
  ];
}

function splitCompanies(value = '') {
  return [...new Set(String(value)
    .split(/\s*(?:\r?\n|\|)\s*/u)
    .map((company) => company.trim())
    .filter(Boolean))]
    .slice(0, 8);
}

function representativeCompanies(description = {}) {
  if (!Array.isArray(description.companyRows) || !description.companyRows.length) {
    return splitCompanies(description.companies);
  }

  const seen = new Set();
  return description.companyRows
    .map((company) => {
      const name = String(company.name || '').trim();
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) return '';
      seen.add(key);
      return [name, company.code, company.role || company.why]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' · ');
    })
    .filter(Boolean)
    .slice(0, 8);
}

function signalName(value = '') {
  const labels = {
    Price: '价格',
    'Budget / Orders': '预算与订单',
    Inventory: '库存',
    'Utilization / Yield': '利用率与良率',
    'Margin / Cash Flow': '利润与现金流',
    Expansion: '扩产',
  };
  return labels[value] || value;
}

function reportDate(item) {
  return item.date || '未标注分析日期';
}

function dataFreshness(item) {
  return item.dataCurrency || '未标注数据时效';
}

function caseOriginLabel(item) {
  return '官方示例';
}

function qualityLabel(item) {
  return evidenceStatusLabel(item);
}

function compactText(text, max = 136) {
  if (!text) return '该项需要回到原始报告继续补充。';
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function firstSentence(text) {
  const match = String(text || '').match(/^(.+?[。；;])/);
  return match ? match[1] : compactText(text, 110);
}

function getPrimarySourceHints(item) {
  const raw = item.sourceHints?.length ? item.sourceHints : [];
  const clean = raw
    .map((source) => source.replace(/^\|\s*|\s*\|$/g, '').trim())
    .filter((source) => source && !/^指标\s*\|/.test(source) && !/^[-\s|]+$/.test(source));
  return clean.length ? clean.slice(0, 6) : ['该报告未提取到显式来源行，需回到原始 Markdown 查看证据矩阵。'];
}

function buildConclusionLayers(item, chainNodes, metricHints) {
  const firstNode = chainNodes[0] || '上游';
  const lastNode = chainNodes[chainNodes.length - 1] || '终端需求';
  const bottleneck = item.bottlenecks[0] || '核心瓶颈尚未明确';
  const metricLine = metricHints.length
    ? `报告提取到 ${metricHints.slice(0, 5).join('、')} 等量化线索；报告生成/分析时间为 ${reportDate(item)}，信息搜集范围为 ${dataFreshness(item)}。`
    : `当前报告没有提取到足够量化指标；报告生成/分析时间为 ${reportDate(item)}，信息搜集范围为 ${dataFreshness(item)}。`;

  return [
    ['事实', metricLine],
    ['推断', `据这些线索，页面把 ${item.industry} 暂归为“${item.stage}”：${firstSentence(item.judgment)}`],
    ['假设', `该判断成立的前提是 ${firstNode} 到 ${lastNode} 的订单、产能和利润传导没有被“${bottleneck}”打断。`],
    ['反证', '若出现价格下行、库存累积、交付周期缩短、资本开支下修或终端预算削弱，需要下调当前周期判断。'],
  ];
}

function buildEvidenceRows(item, metricHints) {
  if (item.watchIndicators?.length) {
    return item.watchIndicators.slice(0, 6).map((row) => ({
      metric: row.indicator,
      source: `${row.source || '见原报告'} · 当前基线：${row.baseline}`,
      scope: row.frequency,
      supports: row.meaning || '用于检验当前周期判断',
    }));
  }
  if (item.signalRows?.length) {
    return item.signalRows.slice(0, 6).map((row) => ({
      metric: signalName(row.signal),
      source: `${row.evidence || '见原报告'} · ${row.period || dataFreshness(item)}`,
      scope: row.period,
      supports: row.interpretation || '用于检验当前周期判断',
    }));
  }
  const sources = getPrimarySourceHints(item);
  const metrics = metricHints.length ? metricHints.slice(0, 5) : ['阶段判断', '核心瓶颈', '数据时效'];
  return metrics.map((metric, index) => ({
    metric,
    source: sources[index % sources.length],
    scope: dataFreshness(item),
    supports: index === 0 ? `${item.stage} 判断` : compactText(item.bottlenecks[index - 1] || item.judgment, 72),
  }));
}

function buildWatchpoints(item, chainNodes) {
  if (item.watchIndicators?.length) {
    return item.watchIndicators.slice(0, 6).map((row) => `${row.indicator}：基线 ${row.baseline}；正向触发 ${row.positiveTrigger || '见原报告'}；反证触发 ${row.disconfirmingTrigger || '见原报告'}。`);
  }
  const firstNode = chainNodes[0] || '上游';
  const middleNode = chainNodes[Math.floor(chainNodes.length / 2)] || '核心环节';
  const lastNode = chainNodes[chainNodes.length - 1] || '终端需求';
  return [
    `${firstNode} 的价格、交期或认证是否继续支撑当前判断。`,
    `${middleNode} 的产能利用率、扩产进度和良率是否出现拐点。`,
    `${lastNode} 的订单、预算和库存是否能兑现到收入。`,
    `${item.bottlenecks[0] || '核心瓶颈'} 是否缓解，利润是否从瓶颈环节向其他环节转移。`,
    '若报告中的关键数字过期，优先补充最新财报、协会数据和价格/库存指标。',
  ];
}

function buildUpdateHistory(item) {
  return [
    {
      date: reportDate(item),
      title: `当前版本：${item.stage}`,
      body: `基于 ${dataFreshness(item)} 形成当前判断，并保留反证条件用于后续校准。`,
    },
    {
      date: '下一次更新',
      title: '等待证据触发',
      body: '当订单、价格、库存、产能利用率或资本开支出现方向性变化时，应记录本次判断是否维持、上调或下修。',
    },
  ];
}

function pickComparisonCases(item, cases) {
  const candidates = [
    item,
    cases.find((caseItem) => caseItem.id !== item.id && classifyCase(caseItem) === classifyCase(item)),
    cases.find((caseItem) => caseItem.id !== item.id && caseItem.stage !== item.stage),
    cases.find((caseItem) => caseItem.id !== item.id && classifyIndustryLayer(caseItem) !== classifyIndustryLayer(item)),
  ].filter(Boolean);
  return [...new Map(candidates.map((caseItem) => [caseItem.id, caseItem])).values()].slice(0, 3);
}

function IndustryPanel({ item, cases, activeChainIndex, setActiveChainIndex, lockedChainIndex, setLockedChainIndex, onDownloadMarkdown, close }) {
  const chainNodes = useMemo(() => extractChainNodes(item), [item]);
  const currentIndex = lockedChainIndex ?? activeChainIndex;
  const currentNode = chainNodes[currentIndex] || chainNodes[0];
  const metricHints = extractMetricHints(item);
  const category = categories[classifyCase(item)] || categories.traditional;
  const [rawOpen, setRawOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const hasOriginalMarkdown = Boolean(item.originalMarkdown);
  const canDownloadOriginal = hasOriginalMarkdown || Boolean(item.markdownUrl);

  return (
    <section className="detail-flow">
      <button className="close-detail" onClick={close}>返回图谱</button>
      <div className="selected-orb" style={{ '--orb-color': category.color }}>
        <span>{shortName(item.industry)}</span>
        <small>{item.stage}</small>
      </div>

      <CycleOverview item={item} />

      <article className="flow-card chain-story-card">
        <div className="card-head">
          <div>
            <p className="micro-title">01 · 产业怎么运转</p>
            <h3>有哪些环节、公司，以及它们彼此怎么做生意</h3>
          </div>
          <span>点一个环节，下方只解释这个环节</span>
        </div>
        <MermaidChainPanel item={item} />
        {chainNodes.length ? (
          <>
            <div className="chain-axis">
              {chainNodes.map((node, index) => (
                <button
                  key={`${node}-${index}`}
                  className={currentIndex === index ? 'is-current' : ''}
                  onMouseEnter={() => setActiveChainIndex(index)}
                  onClick={() => setLockedChainIndex(index)}
                >
                  <i />
                  <span>{node}</span>
                </button>
              ))}
            </div>
            <NodeReadout item={item} currentNode={currentNode} index={currentIndex} />
          </>
        ) : (
          <div className="data-gap-box">
            <strong>这份报告没有可安全拆分的产业链节点</strong>
            <p>页面不会把框图、来源行或通用行业词硬拆成节点。请按新版 Skill 的 1.2 环节详解补齐。</p>
          </div>
        )}
      </article>

      <ProfitFlowMap item={item} chainNodes={chainNodes} />

      <SupplySignalBoard item={item} />

      <CycleHistory item={item} />

      <CapitalFlowCard item={item} />

      <FutureCapitalFlowCard item={item} />

      <section className={`research-basis ${advancedOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="research-basis-toggle"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((current) => !current)}
        >
          <div>
            <span>进阶视角</span>
            <strong>查看分歧、反证、术语和证据台账</strong>
          </div>
          <em>{advancedOpen ? '收起' : '展开'}</em>
        </button>
        {advancedOpen && <div className="research-basis-body">
          <ConclusionAudit item={item} chainNodes={chainNodes} metricHints={metricHints} />
          <AdvancedInsightCard item={item} />
          <EvidenceTrace item={item} metricHints={metricHints} />
          <GlossaryCard item={item} />
          <EvidenceLedgerCard item={item} />
          <ComparisonTable item={item} cases={cases} />
          <UpdateHistory item={item} />
          <WatchList item={item} chainNodes={chainNodes} />

          <article className="flow-card">
            <p className="micro-title">关键瓶颈</p>
            <h3>报告认为哪里最容易卡住</h3>
            <div className="bottleneck-stack">
              {item.bottlenecks.map((bottleneck, index) => (
                <div key={bottleneck}>
                  <span>{index + 1}</span>
                  <p>{bottleneck}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="flow-card">
            <p className="micro-title">来源与数据提示</p>
            <h3>完整证据索引</h3>
            <div className="source-row">
              <span>原始报告：{item.file}</span>
              <span>报告生成/分析时间：{reportDate(item)}</span>
              <span>信息搜集范围：{dataFreshness(item)}</span>
              <span>边界：不输出买卖建议</span>
            </div>
            <div className="source-list">
              {(item.sourceHints?.length ? item.sourceHints : ['该报告未提取到显式来源行，需回到原始 Markdown 查看证据矩阵。']).slice(0, 6).map((source) => (
                <p key={source}>{source}</p>
              ))}
            </div>
            <div className="metric-hints">
              {metricHints.length ? metricHints.map((hint) => <strong key={hint}>{hint}</strong>) : <strong>该报告未提取到量化指标</strong>}
            </div>
          </article>

          <article className="method-strip">
            {lensCards.map(([title, body]) => (
              <div key={title}>
                <strong>{title}</strong>
                <span>{body}</span>
              </div>
            ))}
          </article>

          <article className="flow-card raw-report-card">
            <div>
              <p className="micro-title">原始材料</p>
              <h3>阅读原始 MD 文件</h3>
              <p>上面的页面是解释层；需要审查数字、来源、口径和反证条件时，再回到完整 Markdown。</p>
            </div>
            <div className="raw-report-actions">
              <button onClick={() => setRawOpen(true)} disabled={!hasOriginalMarkdown}>
                {hasOriginalMarkdown ? '打开原始 MD' : '原文加载中'}
              </button>
              {canDownloadOriginal && <button className="secondary-button" onClick={() => onDownloadMarkdown(item)}>下载原始 MD</button>}
            </div>
          </article>
        </div>}
      </section>

      {rawOpen && <OriginalMarkdownModal item={item} onClose={() => setRawOpen(false)} onDownload={() => onDownloadMarkdown(item)} />}
    </section>
  );
}

function OriginalMarkdownModal({ item, onClose, onDownload }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <section className="raw-modal" aria-label="原始 Markdown 报告">
      <div className="raw-modal-panel">
        <div className="raw-modal-head">
          <div>
            <p className="micro-title">原始 MD</p>
            <h2>{item.title}</h2>
            <span>{item.file} · {reportDate(item)} · {dataFreshness(item)}</span>
          </div>
          <div className="raw-modal-actions">
            <button className="secondary-button" onClick={onDownload}>下载 MD</button>
            <button onClick={onClose}>关闭并返回详情</button>
          </div>
        </div>
        <pre>{item.originalMarkdown || '该案例没有保存原始 Markdown。'}</pre>
      </div>
    </section>,
    document.body,
  );
}

let mermaidRenderCount = 0;
const MIN_MERMAID_ZOOM = 0.25;
const MAX_MERMAID_ZOOM = 2.5;
const MERMAID_STAGE_MARGIN = 18;

function clampMermaidZoom(value) {
  return Math.min(MAX_MERMAID_ZOOM, Math.max(MIN_MERMAID_ZOOM, value));
}

function MermaidChainPanel({ item }) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const [renderState, setRenderState] = useState('loading');
  const [renderError, setRenderError] = useState('');
  const [diagramSize, setDiagramSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const hasDiagram = /flowchart|graph|-->/iu.test(item.chain || '');

  const positionAfterZoom = (nextZoom, anchorX, anchorY) => {
    const viewport = viewportRef.current;
    if (!viewport || !diagramSize.width) return;
    const oldZoom = zoom;
    const resolvedX = anchorX ?? viewport.clientWidth / 2;
    const resolvedY = anchorY ?? viewport.clientHeight / 2;
    const graphX = (viewport.scrollLeft + resolvedX - MERMAID_STAGE_MARGIN) / oldZoom;
    const graphY = (viewport.scrollTop + resolvedY - MERMAID_STAGE_MARGIN) / oldZoom;

    setZoom(nextZoom);
    requestAnimationFrame(() => {
      viewport.scrollLeft = MERMAID_STAGE_MARGIN + graphX * nextZoom - resolvedX;
      viewport.scrollTop = MERMAID_STAGE_MARGIN + graphY * nextZoom - resolvedY;
    });
  };

  const changeZoom = (factor) => {
    const nextZoom = clampMermaidZoom(Number((zoom * factor).toFixed(3)));
    if (nextZoom !== zoom) positionAfterZoom(nextZoom);
  };

  const fitDiagram = () => {
    const viewport = viewportRef.current;
    if (!viewport || !diagramSize.width || !diagramSize.height) return;
    const availableWidth = Math.max(1, viewport.clientWidth - MERMAID_STAGE_MARGIN * 2);
    const availableHeight = Math.max(1, viewport.clientHeight - MERMAID_STAGE_MARGIN * 2);
    const nextZoom = clampMermaidZoom(Math.min(
      availableWidth / diagramSize.width,
      availableHeight / diagramSize.height,
      1,
    ));
    setZoom(nextZoom);
    requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
    });
  };

  const resetDiagram = () => {
    const viewport = viewportRef.current;
    setZoom(1);
    requestAnimationFrame(() => {
      if (!viewport) return;
      viewport.scrollLeft = 0;
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
    });
  };

  const startDragging = (event) => {
    if (event.button !== 0 || !viewportRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    };
    setIsDragging(true);
  };

  const dragDiagram = (event) => {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag || !viewport || drag.pointerId !== event.pointerId) return;
    viewport.scrollLeft = drag.scrollLeft - (event.clientX - drag.x);
    viewport.scrollTop = drag.scrollTop - (event.clientY - drag.y);
  };

  const stopDragging = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
  };

  const moveWithKeyboard = (event) => {
    const viewport = viewportRef.current;
    if (!viewport || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const movement = event.shiftKey ? 160 : 64;
    if (event.key === 'ArrowLeft') viewport.scrollLeft -= movement;
    if (event.key === 'ArrowRight') viewport.scrollLeft += movement;
    if (event.key === 'ArrowUp') viewport.scrollTop -= movement;
    if (event.key === 'ArrowDown') viewport.scrollTop += movement;
  };

  useEffect(() => {
    if (!hasDiagram) return undefined;
    let cancelled = false;
    const renderDiagram = async () => {
      setRenderState('loading');
      setRenderError('');
      setDiagramSize({ width: 0, height: 0 });
      setZoom(1);
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          suppressErrorRendering: true,
          theme: 'base',
          themeVariables: {
            primaryColor: '#edf6f2',
            primaryTextColor: '#193338',
            primaryBorderColor: '#6aa69c',
            lineColor: '#6f8888',
            secondaryColor: '#f7f2e9',
            tertiaryColor: '#ffffff',
            fontFamily: 'Inter, "Noto Sans SC", sans-serif',
          },
          flowchart: {
            curve: 'basis',
            htmlLabels: false,
            useMaxWidth: false,
          },
        });
        mermaidRenderCount += 1;
        const { svg, bindFunctions } = await mermaid.render(`industry-chain-${mermaidRenderCount}`, item.chain);
        if (cancelled || !canvasRef.current) return;
        canvasRef.current.innerHTML = svg;
        bindFunctions?.(canvasRef.current);
        const svgElement = canvasRef.current.querySelector('svg');
        const width = Math.max(1, svgElement?.viewBox?.baseVal?.width || 1200);
        const height = Math.max(1, svgElement?.viewBox?.baseVal?.height || 360);
        if (svgElement) {
          svgElement.removeAttribute('width');
          svgElement.removeAttribute('height');
          svgElement.style.maxWidth = 'none';
        }
        const viewportWidth = viewportRef.current?.clientWidth || 960;
        const initialZoom = clampMermaidZoom(Math.min(1, Math.max(0.72, (viewportWidth * 1.9) / width)));
        setDiagramSize({ width, height });
        setZoom(initialZoom);
        setRenderState('ready');
        requestAnimationFrame(() => {
          const viewport = viewportRef.current;
          if (!viewport) return;
          viewport.scrollLeft = 0;
          viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
        });
      } catch (error) {
        if (cancelled) return;
        if (canvasRef.current) canvasRef.current.replaceChildren();
        setRenderError(error instanceof Error ? error.message : '结构图语法无法识别');
        setRenderState('error');
      }
    };

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [hasDiagram, item.chain]);

  if (!hasDiagram) return null;
  return (
    <section className="mermaid-chain-panel">
      <div className="mermaid-chain-head">
        <div>
          <span>报告原始结构图</span>
          <strong>保留平行输入，不压平成一条线</strong>
        </div>
        <div className="mermaid-chain-toolbar" role="group" aria-label="结构图缩放控制">
          <button type="button" aria-label="缩小结构图" title="缩小" onClick={() => changeZoom(1 / 1.2)} disabled={zoom <= MIN_MERMAID_ZOOM}>−</button>
          <output aria-live="polite">{Math.round(zoom * 100)}%</output>
          <button type="button" aria-label="放大结构图" title="放大" onClick={() => changeZoom(1.2)} disabled={zoom >= MAX_MERMAID_ZOOM}>+</button>
          <button type="button" aria-label="让结构图适应视口" title="适应视口" onClick={fitDiagram}>⛶</button>
          <button type="button" className="mermaid-reset-button" aria-label="恢复结构图百分之百大小" title="恢复 100%" onClick={resetDiagram}>1:1</button>
        </div>
      </div>
      <div
        className={`mermaid-chain-viewport is-${renderState} ${isDragging ? 'is-dragging' : ''}`}
        ref={viewportRef}
        role="img"
        aria-label="可缩放、可拖动的产业链结构图"
        tabIndex={0}
        onPointerDown={startDragging}
        onPointerMove={dragDiagram}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onKeyDown={moveWithKeyboard}
      >
        <div
          className="mermaid-chain-stage"
          style={{
            width: diagramSize.width ? diagramSize.width * zoom : 0,
            height: diagramSize.height ? diagramSize.height * zoom : 0,
          }}
        >
          <div
            className="mermaid-chain-canvas"
            ref={canvasRef}
            aria-live="polite"
            style={{
              width: diagramSize.width || undefined,
              height: diagramSize.height || undefined,
              transform: `scale(${zoom})`,
            }}
          />
        </div>
      </div>
      {renderState === 'loading' && <p className="mermaid-chain-loading">正在绘制产业链...</p>}
      {renderState === 'error' && (
        <div className="mermaid-chain-error">
          <strong>结构图暂时无法绘制</strong>
          <p>{renderError}</p>
          <details>
            <summary>查看原始 Mermaid</summary>
            <pre>{item.chain}</pre>
          </details>
        </div>
      )}
    </section>
  );
}

function CycleOverview({ item }) {
  const reasons = stageReasons(item);
  const confidence = String(item.currentStage?.confidence || '报告未单独标注')
    .split(/[。；;!！]/u)[0]
    .trim();
  const keyNumbers = item.onePage?.keyNumbers || [];
  const intro = item.onePage?.industryIntro;

  return (
    <article className="industry-brief cycle-overview">
      <div className="cycle-overview-head">
        <div>
          <p className="micro-title">先看最重要的答案</p>
          <h2>{item.industry}</h2>
          <p className="report-version">{item.title}</p>
        </div>
        <div className="cycle-stage-answer">
          <span>阶段判断</span>
          <strong>{item.stage}</strong>
          <div className="cycle-status-meta">
            <small><b>结论状态</b>{item.conclusionStatus || '未单独标注'}</small>
            <small><b>置信度</b>{item.confidence || confidence}</small>
            <small><b>证据截至</b>{item.evidenceAsOf || reportDate(item)}</small>
          </div>
        </div>
      </div>

      {intro && (
        <section className="industry-intro">
          <span>这个行业是做什么的</span>
          <p>{intro}</p>
        </section>
      )}

      {keyNumbers.length > 0 && (
        <div className="key-number-grid">
          {keyNumbers.slice(0, 3).map((row) => (
            <section key={`${row.number}-${row.period}`}>
              <strong>{row.number}</strong>
              <span>{row.period}</span>
              <p>{row.conclusion || row.question}</p>
            </section>
          ))}
        </div>
      )}

      <div className="cycle-explainer-grid">
        <section className="stage-in-plain-words">
          <span>这句话到底是什么意思</span>
          <p>{explainStage(item.stage)}</p>
          {item.currentStage?.phase && <small>报告原话：{item.currentStage.phase}</small>}
        </section>
        <section className="stage-reasons">
          <span>为什么这样判断</span>
          <ol>
            {reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ol>
        </section>
        <section className="stage-falsifier">
          <span>什么出现，就说明判断错了</span>
          <p>{stageInvalidation(item)}</p>
          <small>报告置信度：{String(item.confidence || confidence).replace(/[。；;，,\s]+$/u, '')}。这是证据等级，不是概率。</small>
        </section>
      </div>

      <SupplyDemandPulse />
      <div className="brief-grid">
        <span>报告时间：{reportDate(item)}</span>
        <span>数据范围：{dataFreshness(item)}</span>
        <span>地理范围：{item.geography}</span>
        <span>页面不提供买卖建议</span>
      </div>
    </article>
  );
}

function ProfitFlowMap({ item, chainNodes }) {
  const rows = profitRows(item, chainNodes);
  const isStructured = Boolean(item.profitMap?.length);

  return (
    <article className="flow-card profit-story-card">
      <div className="card-head">
        <div>
          <p className="micro-title">02 · 钱与利润怎么走</p>
          <h3>不再打分，直接说谁出钱、谁赚钱、谁担风险</h3>
        </div>
        <span>{isStructured ? '来自报告的 Power and Profit Map' : '当前 Markdown 未写利益传导表：缺失项明确留空'}</span>
      </div>
      <div className="profit-story-grid">
        {rows.map((row, index) => (
          <section key={`${row.question}-${index}`}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <strong>{profitQuestionLabel(row.question)}</strong>
              <p>{row.answer}</p>
              {row.gap && <small>还不能确定：{row.gap}</small>}
              {row.evidence && <em>证据：{row.evidence}</em>}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function SupplySignalBoard({ item }) {
  const rows = item.signalRows?.length
    ? item.signalRows
    : (item.watchIndicators || []).map((row) => ({
      signal: row.indicator,
      latest: row.baseline,
      period: row.frequency,
      interpretation: row.meaning,
      gap: '当前 Markdown 未按结构化表格拆分供需信号。',
    }));

  return (
    <article className="flow-card signal-story-card">
      <div className="card-head">
        <div>
          <p className="micro-title">03 · 哪些真实信号正在变化</p>
          <h3>先看最新值，再用同一指标的时间轴看趋势</h3>
        </div>
        <span>不同单位不拼成“综合指数”</span>
      </div>

      {rows.length ? (
        <div className="signal-fact-grid">
          {rows.slice(0, 6).map((row) => (
            <section key={`${row.signal}-${row.period}`}>
              <div>
                <strong>{signalName(row.signal)}</strong>
                <span>{row.period}</span>
              </div>
              <p>{row.latest}</p>
              {row.interpretation && <small>说明：{row.interpretation}</small>}
              {row.gap && <em>缺口：{row.gap}</em>}
            </section>
          ))}
        </div>
      ) : (
        <div className="data-gap-box">
          <strong>这份报告没有结构化供需信号</strong>
          <p>页面不会用关键词生成一条看似专业的曲线；需要在 Markdown 中补充需求、订单、价格、库存、利用率、利润和扩产数据。</p>
        </div>
      )}

      <ActualTimeSeries item={item} />
    </article>
  );
}

function chartValueLabel(value, unit, compact = false) {
  if (/百万新台币/u.test(unit)) {
    const valueInYi = value / 100;
    return compact ? `${Math.round(valueInYi)}亿` : `${valueInYi.toFixed(1)} 亿新台币`;
  }
  if (/%/u.test(unit)) return `${value.toFixed(1)}%`;
  return `${Math.round(value).toLocaleString('zh-CN')} ${unit || ''}`.trim();
}

function ActualTimeSeries({ item }) {
  const series = item.comparableSeries?.[0];
  if (!series) {
    const watchRows = (item.watchIndicators || []).slice(0, 3);
    return (
      <section className="time-series-panel time-series-empty">
        <div>
          <p className="micro-title">真实时间序列</p>
          <h4>这份报告还没有足够的同口径历史数据</h4>
          <p>至少需要同一个指标、同一个单位、两个以上日期才能画线。没有数据时，页面明确留空，不再画抽象趋势。</p>
        </div>
        {watchRows.length > 0 && (
          <div className="next-data-list">
            {watchRows.map((row) => (
              <p key={row.indicator}><strong>{row.indicator}</strong><span>{row.baseline}</span></p>
            ))}
          </div>
        )}
      </section>
    );
  }

  const points = [...series.points].sort((a, b) => comparePeriodLabels(a.date, b.date));
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.16, rawMax * 0.035, 1);
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const width = 900;
  const height = 360;
  const left = 88;
  const right = 80;
  const top = 42;
  const bottom = 72;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (index) => left + (plotWidth * index) / Math.max(1, points.length - 1);
  const y = (value) => top + ((max - value) / Math.max(1, max - min)) * plotHeight;
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.value)}`).join(' ');
  const ticks = Array.from({ length: 5 }, (_, index) => max - ((max - min) * index) / 4);

  return (
    <section className="time-series-panel">
      <div className="time-series-head">
        <div>
          <p className="micro-title">真实时间序列</p>
          <h4>{series.indicator}</h4>
          <p>{series.points[0]?.meaning || '用同一口径观察产业趋势。'}</p>
        </div>
        <span>实际值 · {series.unit} · 来源 {series.source || '见原报告'}</span>
      </div>
      <div className="time-series-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${series.indicator}时间序列折线图`}>
          <title>{series.indicator}，{points[0].date} 至 {points[points.length - 1].date}</title>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="series-grid-line" />
              <text x={left - 14} y={y(tick) + 4} className="series-y-label">{chartValueLabel(tick, series.unit, true)}</text>
            </g>
          ))}
          <path d={`${path} L ${x(points.length - 1)} ${top + plotHeight} L ${x(0)} ${top + plotHeight} Z`} className="series-area" />
          <path d={path} className="series-line" />
          {points.map((point, index) => (
            <g key={`${point.date}-${point.value}`}>
              <circle cx={x(index)} cy={y(point.value)} r="6" className="series-point" />
              <text x={x(index)} y={y(point.value) - 16} className="series-value-label">{chartValueLabel(point.value, series.unit, true)}</text>
              <text x={x(index)} y={top + plotHeight + 32} className="series-x-label">{point.date}</text>
            </g>
          ))}
          <line x1={left} x2={width - right} y1={top + plotHeight} y2={top + plotHeight} className="series-axis" />
        </svg>
      </div>
      <p className="series-disclaimer">只连接同一指标、同一口径、同一单位的实际值；不把预测值、毛利率和库存天数混在这条线上。</p>
    </section>
  );
}

function CycleHistory({ item }) {
  const rows = [...(item.cycleTimeline || [])].sort((a, b) => comparePeriodLabels(a.period, b.period));
  const actualIndexes = rows
    .map((row, index) => (/计划|风险|预测|预期/iu.test(`${row.type || ''}${row.period}`) ? -1 : index))
    .filter((index) => index >= 0);
  const currentIndex = actualIndexes.at(-1);

  return (
    <article className="flow-card cycle-history-card">
      <div className="card-head">
        <div>
          <p className="micro-title">04 · 历史上走到哪一步</p>
          <h3>把已发生、当前锚点和未来风险放在同一条时间线上</h3>
        </div>
        <span>{item.currentStage?.entryAnchor || `当前阶段：${item.stage}`}</span>
      </div>

      {rows.length ? (
        <div className="cycle-history-track">
          {rows.map((row, index) => {
            const future = /计划|风险|预测|预期/iu.test(`${row.type || ''}${row.period}`);
            const current = index === currentIndex;
            return (
              <section key={`${row.period}-${row.signal}`} className={`${future ? 'is-future' : 'is-actual'} ${current ? 'is-current' : ''}`}>
                <div className="cycle-time-marker"><i /><time>{row.period}</time></div>
                <span>{current ? '当前证据锚点' : row.type || (future ? '计划 / 风险窗口' : '已发布实际信号')}</span>
                <h4>{row.signal}</h4>
                {row.profitShift && <p><strong>利润变化：</strong>{row.profitShift}</p>}
                {row.lag && <p><strong>还要等多久：</strong>{row.lag}</p>}
                {row.next && <small>下一次验证：{row.next}</small>}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="data-gap-box">
          <strong>这份报告没有结构化周期时间线</strong>
          <p>当前只能显示“{item.stage}”这个阶段标签，无法可靠还原从订单到利润、再到扩产或过剩的历史过程；需要回到 Markdown 补充可审计的阶段和日期。</p>
        </div>
      )}
    </article>
  );
}

function CapitalFlowCard({ item }) {
  const attempts = item.capitalFlows?.attempts || [];
  const proxies = item.capitalFlows?.proxyRows || [];
  const summary = item.capitalFlows?.summary || [];

  return (
    <article className="flow-card capital-card">
      <div className="card-head">
        <div>
          <p className="micro-title">05 · 资金动向</p>
          <h3>先看市场已经交易了什么，再看缺口在哪里</h3>
        </div>
        <span>{item.marketEvidenceCoverage?.status || '证据覆盖未评估'}</span>
      </div>
      {proxies.length > 0 ? (
        <div className="market-proxy-grid">
          {proxies.map((row) => (
            <section key={`${row.tier}-${row.instrument}-${row.metric}`}>
              <div><span>{row.tier || '代理'}</span><strong>{row.instrument}</strong></div>
              <p>{row.metric}</p>
              <dl>
                <div><dt>覆盖</dt><dd>{row.coverage}</dd></div>
                <div><dt>结论</dt><dd>{row.conclusion}</dd></div>
                <div><dt>局限</dt><dd>{row.limitation}</dd></div>
              </dl>
              {row.source && <small>来源：{row.source}</small>}
            </section>
          ))}
        </div>
      ) : (
        <div className="data-gap-box">
          <strong>资本市场代理证据尚未形成</strong>
          <p>下面只保留检索记录；缺少可核验指标时，不把尝试本身算作结论。</p>
        </div>
      )}
      {attempts.length ? (
        <details className="capital-attempts">
          <summary>查看检索尝试与失败项（{attempts.length}）</summary>
          <div className="capital-attempt-grid">
            {attempts.slice(0, 5).map((row) => (
              <section key={`${row.sourceType}-${row.result}`}>
                <strong>{row.sourceType || row.source}</strong>
                <p>{row.result || row.source}</p>
                {row.limitation && <small>{row.limitation}</small>}
              </section>
            ))}
          </div>
        </details>
      ) : (
        <div className="data-gap-box">
          <strong>这份报告没有资金动向规定动作记录</strong>
          <p>新版 Skill 要求先记录估值、ETF/资金流、两融或同类指标、龙头股价与盈利剪刀差等尝试，再判断已定价或未定价。</p>
        </div>
      )}
      {summary.length > 0 && (
        <div className="capital-summary">
          {summary.map((line) => <p key={line}>{line}</p>)}
        </div>
      )}
    </article>
  );
}

function FutureCapitalFlowCard({ item }) {
  const rows = item.futureCapitalFlows || [];
  return (
    <article className="flow-card future-flow-card">
      <div className="card-head">
        <div>
          <p className="micro-title">06 · 未来资金可能流向</p>
          <h3>按情景看利润池可能往哪里移动</h3>
        </div>
        <span>不构成买卖建议</span>
      </div>
      {rows.length ? (
        <div className="future-flow-grid">
          {rows.slice(0, 4).map((row) => (
            <section key={row.scenario}>
              <strong>{row.scenario}</strong>
              <dl className="future-flow-details">
                <div><dt>触发条件</dt><dd>{row.trigger || '原报告未单独披露'}</dd></div>
                <div><dt>利润池移动</dt><dd>{row.flow || '原报告未单独披露'}</dd></div>
                <div><dt>先受益</dt><dd>{row.first || '原报告未单独披露'}</dd></div>
                <div><dt>后受益 / 受损</dt><dd>{row.later || '原报告未单独披露'}</dd></div>
              </dl>
              {row.evidence && <small>证据：{row.evidence}</small>}
            </section>
          ))}
        </div>
      ) : (
        <div className="data-gap-box">
          <strong>这份报告没有未来资金流向情景</strong>
          <p>页面不会从股价走势推演资金去向；需要按订单、交期、认证壁垒和产能弹性补写基准、上行、下行情景。</p>
        </div>
      )}
    </article>
  );
}

function AdvancedInsightCard({ item }) {
  const nodeInsights = (item.chainNodeDetails || []).flatMap((node) =>
    (node.advanced || []).map((line) => ({ title: node.name, body: line })),
  );
  const disagreements = item.disagreements || [];
  return (
    <article className="flow-card advanced-card">
      <p className="micro-title">分歧与进阶视角</p>
      <h3>把口径陷阱、争议和反证条件放在一起</h3>
      {nodeInsights.length || disagreements.length ? (
        <div className="advanced-grid">
          {nodeInsights.slice(0, 6).map((row) => (
            <section key={`${row.title}-${row.body}`}>
              <span>{row.title}</span>
              <p>{row.body}</p>
            </section>
          ))}
          {disagreements.slice(0, 5).map((row) => (
            <section key={`${row.narrative}-${row.judgment}`}>
              <span>{row.narrative}</span>
              <p>{row.difference || row.judgment}</p>
              {row.strongerEvidence && <small>{row.strongerEvidence}</small>}
            </section>
          ))}
        </div>
      ) : (
        <div className="data-gap-box">
          <strong>这份报告没有结构化进阶视角</strong>
          <p>新版 Skill 要求每个关键节点写口径陷阱或争议，并在第 8 节比较主流叙事与本报告判断。</p>
        </div>
      )}
    </article>
  );
}

function GlossaryCard({ item }) {
  const rows = item.glossary || [];
  return (
    <article className="flow-card glossary-card">
      <p className="micro-title">术语表</p>
      <h3>小白读报告时不用离开页面查词</h3>
      {rows.length ? (
        <div className="glossary-grid">
          {rows.slice(0, 18).map((row) => (
            <section key={row.term}>
              <strong>{row.term}</strong>
              <p>{row.explanation}</p>
              {row.why && <small>{row.why}</small>}
            </section>
          ))}
        </div>
      ) : (
        <div className="data-gap-box">
          <strong>这份报告没有术语表</strong>
          <p>新版 Skill 要求正文首次出现的术语、缩写全部进入第 10 节，用人话解释。</p>
        </div>
      )}
    </article>
  );
}

function EvidenceLedgerCard({ item }) {
  const rows = item.evidenceLedger || [];
  return (
    <article className="flow-card ledger-card">
      <p className="micro-title">证据台账</p>
      <h3>每条证据都要能回到发布方、日期和局限</h3>
      {rows.length ? (
        <div className="ledger-list">
          {rows.slice(0, 10).map((row) => (
            <section key={`${row.id}-${row.publisher}`}>
              <strong>{row.id || row.publisher}</strong>
              <p>{[row.publisher, row.date, row.freshness].filter(Boolean).join(' · ')}</p>
              <small>{row.locator || row.conclusion || row.limitation}</small>
            </section>
          ))}
        </div>
      ) : (
        <div className="data-gap-box">
          <strong>这份报告没有附录A证据台账</strong>
          <p>新版 Skill 要求记录发布方、发布日期、访问日期、数据期间、原文定位、是否打开、时效和局限。</p>
        </div>
      )}
    </article>
  );
}

function ConclusionAudit({ item, chainNodes, metricHints }) {
  return (
    <article className="flow-card trust-card">
      <p className="micro-title">结论可审查</p>
      <h3>事实、推断、假设和反证条件分开看</h3>
      <div className="trust-grid">
        {buildConclusionLayers(item, chainNodes, metricHints).map(([label, body]) => (
          <section key={label}>
            <span>{label}</span>
            <p>{body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}

function EvidenceTrace({ item, metricHints }) {
  const rows = buildEvidenceRows(item, metricHints);
  return (
    <article className="flow-card evidence-card">
      <div className="card-head">
        <div>
          <p className="micro-title">证据链</p>
          <h3>每个关键数字都要知道它支撑什么</h3>
        </div>
        <span>{reportDate(item)} · {dataFreshness(item)}</span>
      </div>
      <div className="evidence-table">
        <div className="evidence-head">
          <span>指标/线索</span>
          <span>来源</span>
          <span>支持的判断</span>
        </div>
        {rows.map((row) => (
          <div key={`${row.metric}-${row.supports}`}>
            <strong>{row.metric}</strong>
            <p>{row.source}</p>
            <small>{row.supports}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function ComparisonTable({ item, cases }) {
  const rows = pickComparisonCases(item, cases);
  return (
    <article className="flow-card compare-card">
      <p className="micro-title">行业对比</p>
      <h3>看单个行业是知识，看对比才有判断</h3>
      <div className="compare-table">
        <div className="compare-head">
          <span>维度</span>
          {rows.map((row) => <strong key={row.id}>{row.industry}</strong>)}
        </div>
        {[
          ['对象层级', (row) => classifyIndustryLayer(row)],
          ['周期阶段', (row) => row.stage],
          ['供给状态', (row) => comparisonSupplyStatus(row)],
          ['核心瓶颈', (row) => comparisonBottleneck(row)],
          ['报告时间', (row) => reportDate(row)],
          ['信息搜集范围', (row) => dataFreshness(row)],
        ].map(([label, getter]) => (
          <div key={label}>
            <span>{label}</span>
            {rows.map((row) => <p key={`${label}-${row.id}`}>{getter(row)}</p>)}
          </div>
        ))}
      </div>
    </article>
  );
}

function UpdateHistory({ item }) {
  return (
    <article className="flow-card update-card">
      <p className="micro-title">更新机制</p>
      <h3>产业周期结论必须随证据变化</h3>
      <div className="update-list">
        {buildUpdateHistory(item).map((entry) => (
          <section key={`${entry.date}-${entry.title}`}>
            <time>{entry.date}</time>
            <strong>{entry.title}</strong>
            <p>{entry.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}

function WatchList({ item, chainNodes }) {
  return (
    <article className="flow-card watch-card">
      <p className="micro-title">观察清单</p>
      <h3>接下来该跟踪什么</h3>
      <ol>
        {buildWatchpoints(item, chainNodes).map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ol>
    </article>
  );
}

function NodeReadout({ item, currentNode, index }) {
  const chainNodes = extractChainNodes(item);
  const description = describeChainNode(currentNode, item, index, chainNodes.length);
  const role = description.does || description.what || description.role || '该节点的具体作用尚未在报告中结构化披露。';
  const companies = representativeCompanies(description);
  const fields = [
    ['向谁采购', description.suppliers],
    ['卖给谁', description.buyers],
    ['怎么赚钱', description.money],
    ['为什么会卡住', description.why],
  ];
  const visibleFields = fields.filter(([, value]) => value && !/未在节点表中单独披露/u.test(value));
  const missingFields = fields.filter(([, value]) => !value || /未在节点表中单独披露/u.test(value)).map(([label]) => label);
  return (
    <div className="node-readout">
      <div className="node-title">
        <span>{description.position}</span>
        <strong>{currentNode}</strong>
        <p>{role}</p>
        <div className="company-list">
          <span>代表公司</span>
          {companies.length
            ? companies.map((company) => <b key={company}>{company}</b>)
            : <em>报告未列出</em>}
        </div>
      </div>
      <div className="node-copy">
        {visibleFields.map(([label, value]) => (
          <section key={label}>
            <span>{label}</span>
            <p>{value}</p>
          </section>
        ))}
        {missingFields.length > 0 && (
          <p className="node-missing-notice">
            原报告尚未可靠拆分：{missingFields.join('、')}。页面保留为空，不用其他字段重复填充。
          </p>
        )}
        {description.evidence && (
          <section className="node-evidence">
            <span>报告证据</span>
            <p>{description.evidence}</p>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
