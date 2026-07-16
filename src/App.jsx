import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dataset from './data/cases.json';
import { loadMarkdownText } from './staticAssets';
import { officialIndustryLayer, relationSeeds } from './industryTaxonomy';
import { dedupeCasesByIndustry } from './caseIdentity';

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
  return ['上游资源', '核心环节', '终端需求'];
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
  const text = `${node} ${item.judgment} ${item.bottlenecks.join(' ')}`;
  const position =
    index === 0
      ? '上游入口'
      : index === total - 1
        ? '终端需求'
        : index <= Math.floor(total / 2)
          ? '中游转化'
          : '下游兑现';

  const dictionary = [
    [/硅|材料|气体|锂|铁矿|焦煤|冷却液|原料/u, ['原材料与基础资源', '它提供后续生产所需的物理基础，价格波动会向中下游传导。']],
    [/设备|光刻|刻蚀|沉积|工艺|CDU/u, ['设备与工艺能力', '它决定产能释放速度、良率上限和技术路线，通常也是扩产周期最长的环节。']],
    [/制造|晶圆|封装|测试|电池|组件|模块|服务器/u, ['制造与集成环节', '它把上游资源变成可交付产品，是产能利用率、订单和毛利率最容易体现的位置。']],
    [/芯片|GPU|ASIC|HBM|光芯片|器件/u, ['核心部件', '它通常决定产品性能和供需弹性，一旦短缺，会让下游订单无法顺利兑现。']],
    [/数据中心|电站|电网|终端|应用|需求|AI|模型/u, ['需求承接方', '它代表最终付款或使用场景，决定行业增长是真实需求、政策推动还是库存周期。']],
  ];

  const matched = dictionary.find(([rule]) => rule.test(text));
  const [what, role] = matched ? matched[1] : ['产业链节点', '它是产业传导中的一个环节，需要继续确认它的客户、供应商、产能和定价权。'];
  const related = item.bottlenecks[index] || item.bottlenecks[0] || item.judgment;

  return {
    position,
    what,
    role,
    why: `在 ${item.industry} 中，这个节点要和上下游一起看：${related}`,
    suppliers: index === 0 ? '上游资源、设备、资本或政策条件' : '上一环节',
    buyers: index === total - 1 ? '终端客户或预算方' : '下一环节',
    money: '通过产品销售、加工费、价差、服务费或规模效率获取收益。',
    evidence: related,
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

  for (let i = 0; i < next.length; i += 1) {
    for (let j = i + 1; j < next.length; j += 1) {
      const a = next[i];
      const b = next[j];
      if (activeNodeId && (!activeIds.has(a.id) || !activeIds.has(b.id))) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 0.001;
      const minDistance = collisionRadius(a) + collisionRadius(b) + 0.22;
      if (distance >= minDistance) continue;

      const push = ((minDistance - distance) / distance) * 0.38 * alpha;
      const px = dx * push;
      const py = dy * push;
      if (a.fx == null) {
        a.vx -= px;
        a.vy -= py;
      }
      if (b.fx == null) {
        b.vx += px;
        b.vy += py;
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

    if (activeIds && !activeIds.has(node.id)) {
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

  const clearAllGraphFilters = () => {
    clearGraphFocus();
    setActiveLensId(null);
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
          <button className="library-trigger" onClick={() => setLibraryOpen(true)}>案例档案</button>
          <button className="guide-trigger" onClick={() => setGuideOpen(true)}>生成调用词</button>
          <button className="graph-reset" onClick={clearAllGraphFilters}>回到全图</button>
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
        <IndustryGraph
          nodes={graph.nodes}
          links={graph.links}
          filteredIds={filteredIds}
          neighborSet={neighborSet}
          hoveredId={hoveredId}
          focusedId={focusedGraphId}
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
4. 必须包含网站解析所需章节：
   ## 0. 一句话判断
   ## 1. 产业链
   关键瓶颈
   来源与数据提示
5. 尽量保留 skill 原本输出的事实、推断、假设、反证、供需、利润、周期和观察清单。
6. 不要输出买卖建议，不要做短线荐股。`;
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
    <section className="guide-layer" aria-label="Skill 调用词生成器">
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
    <section className="library-layer" aria-label="案例库">
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
  const localNodeRef = useRef(null);
  const defaultView = { scale: 1.14, x: -6.8, y: -7.6 };
  const [view, setView] = useState(defaultView);
  const [dragStart, setDragStart] = useState(null);
  const [nodeDragStart, setNodeDragStart] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);
  const dragMovedRef = useRef(false);
  const [layoutNodes, setLayoutNodes] = useState(() => createLayoutNodes(nodes, links));
  const layoutNodesRef = useRef(layoutNodes);

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
      scale: Math.min(2.4, Math.max(0.72, current.scale + delta)),
    }));
  };

  const handleWheel = (event) => {
    event.preventDefault();
    zoom(event.deltaY > 0 ? -0.08 : 0.08);
  };

  const handlePointerMove = (event) => {
    if (!svgRef.current) return;
    const box = svgRef.current.getBoundingClientRect();

    if (nodeDragStart) {
      const dx = ((event.clientX - nodeDragStart.x) / box.width) * 100 / view.scale;
      const dy = ((event.clientY - nodeDragStart.y) / box.height) * 100 / view.scale;
      if (Math.abs(event.clientX - nodeDragStart.x) + Math.abs(event.clientY - nodeDragStart.y) <= 3) return;
      dragMovedRef.current = true;
      const fixed = {
        id: nodeDragStart.id,
        x: Math.max(4, Math.min(96, nodeDragStart.nodeX + dx)),
        y: Math.max(4, Math.min(96, nodeDragStart.nodeY + dy)),
      };
      dragFixedRef.current = fixed;
      layoutNodesRef.current = layoutNodesRef.current.map((node) =>
        node.id === fixed.id
          ? { ...node, x: fixed.x, y: fixed.y, fx: fixed.x, fy: fixed.y, vx: 0, vy: 0 }
          : node,
      );
      setLayoutNodes(layoutNodesRef.current);
      warmLayout(0.16);
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
    if (event.target.closest?.('.graph-node')) return;
    if (event.target.closest?.('.graph-tools')) return;
    if (event.target.closest?.('.relation-tooltip')) return;
    onClearFocus();
    setDragStart({ x: event.clientX, y: event.clientY, view });
  };

  const startNodeDrag = (event, node) => {
    event.preventDefault();
    event.stopPropagation();
    const current = layoutNodesRef.current.find((item) => item.id === node.id) || node;
    setNodeDragStart({
      id: node.id,
      x: event.clientX,
      y: event.clientY,
      nodeX: current.x,
      nodeY: current.y,
    });
    dragMovedRef.current = false;
    localNodeRef.current = node.id;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const stopDrag = () => {
    if (nodeDragStart && dragMovedRef.current) {
      layoutNodesRef.current = layoutNodesRef.current.map((node) =>
        node.id === nodeDragStart.id
          ? { ...node, fx: null, fy: null, baseX: node.x, baseY: node.y, vx: 0, vy: 0 }
          : node,
      );
      setLayoutNodes(layoutNodesRef.current);
      dragFixedRef.current = null;
      localNodeRef.current = nodeDragStart.id;
      warmLayout(0.1);
    } else {
      dragFixedRef.current = null;
      localNodeRef.current = null;
    }
    setDragStart(null);
    setNodeDragStart(null);
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
        <button onClick={() => zoom(0.12)}>+</button>
        <button onClick={() => zoom(-0.12)}>-</button>
        <button onClick={() => setView(defaultView)}>复位</button>
      </div>
      <svg
        ref={svgRef}
        className="industry-graph"
        viewBox="0 0 100 100"
        role="img"
        aria-label="行业关系网络"
        onWheel={handleWheel}
        onPointerDown={startDrag}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={stopDrag}
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
        const labelVisible = (node.type === 'case' && (isFocus || view.scale >= 1.1)) || node.type === 'core';
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
      <p className="graph-hint">悬停高亮，拖动节点；单击打开摘要，双击进入详情。</p>
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

function getInsightCopy(item, type, chainNodes, metricHints) {
  const firstNode = chainNodes[0] || '上游';
  const lastNode = chainNodes[chainNodes.length - 1] || '终端需求';
  const bottleneck = item.bottlenecks[0] || '报告未提取到明确瓶颈';
  const metrics = metricHints.length ? `当前可跟踪的量化线索包括 ${metricHints.slice(0, 4).join('、')}。` : '当前报告没有足够的量化指标，需要回到原始报告补充价格、订单、库存或产能数据。';

  if (type === 'profit') {
    return `${item.industry} 的利益走向要从 ${lastNode} 反推到 ${firstNode}：先确认谁是真正付款方，再看付款压力会被哪个稀缺环节截留。当前最值得盯住的是“${bottleneck}”，它决定利润是留在瓶颈节点、传导给上游，还是被下游压价吸收。`;
  }

  if (type === 'signal') {
    return `供需信号不能只看需求热度，要同时看需求、产能、价格和库存。对 ${item.industry} 来说，${bottleneck} 是验证链条是否顺畅的第一观察点；一旦价格松动、交期缩短或库存累积，就说明原来的短缺假设需要重新校准。${metrics}`;
  }

  return `当前阶段被归纳为“${item.stage}”，但阶段不是结论，而是待验证假设。下一步要观察 ${item.industry} 是否从 ${firstNode} 到 ${lastNode} 都能兑现订单、收入和利润；如果扩产集中释放、终端预算下修或库存转向累积，周期位置就要下修。`;
}

function getChartProfile(item, type) {
  const text = `${item.industry} ${item.stage} ${item.judgment} ${item.bottlenecks.join(' ')} ${item.chain}`;
  const metricScore = Math.min(18, (item.metricHints?.length || 0) * 2.2);
  const sourceScore = Math.min(12, (item.sourceHints?.length || 0) * 1.5);
  const bottleneckScore = Math.min(24, item.bottlenecks.length * 4);
  const growth = signalCount(text, ['AI', '增长', '扩张', '复苏', '需求', '订单', '资本开支', '供不应求', '短缺']) * 5;
  const shortage = signalCount(text, ['短缺', '稀缺', '瓶颈', '垄断', '卡', '交期', '良率不足', '受限']) * 5.5;
  const oversupply = signalCount(text, ['过剩', '库存', '出清', '价格下行', '承压', '亏损', '下修']) * 5.5;
  const riskSignal = signalCount(text, ['风险', '反证', '不确定', '若', '如果', '放缓', '下修', '累积']) * 3.8;
  const stableJitter = seededJitter(item.id || item.industry, 14);

  const demand = clampScore(48 + growth + metricScore * 0.6 - oversupply * 0.35 + stableJitter);
  const supply = clampScore(50 + bottleneckScore + shortage * 0.75 + oversupply * 0.45 - growth * 0.25 - stableJitter * 0.4);
  const price = clampScore(42 + shortage * 0.65 + growth * 0.35 - oversupply * 0.5 + metricScore * 0.35);
  const inventory = clampScore(36 + oversupply * 0.8 + riskSignal * 0.45 - shortage * 0.28 + Math.abs(stableJitter));

  if (type === 'profit') {
    return [
      clampScore(42 + demand * 0.28 + growth * 0.28),
      clampScore(46 + supply * 0.34 + shortage * 0.35),
      clampScore(36 + bottleneckScore + metricScore * 0.8),
      clampScore(30 + inventory * 0.35 + oversupply * 0.45 + riskSignal * 0.2),
    ];
  }

  if (type === 'signal') {
    const demandTrend = item.stage.includes('扩张') || item.stage.includes('成长') || item.stage.includes('短缺') ? 12 : -4;
    const supplyTrend = item.stage.includes('过剩') || item.stage.includes('出清') ? 10 : shortage > oversupply ? -5 : 4;
    return {
      demand: [
        clampScore(demand - 14 + stableJitter * 0.25),
        clampScore(demand - 2 + demandTrend * 0.45),
        clampScore(price + demandTrend * 0.5),
        clampScore(demand - inventory * 0.18 + demandTrend),
      ],
      supply: [
        clampScore(supply - 5),
        clampScore(supply + supplyTrend),
        clampScore(price - shortage * 0.2 + oversupply * 0.25),
        clampScore(inventory + supplyTrend * 0.65),
      ],
    };
  }

  const realityBase =
    item.stage.includes('扩张') || item.stage.includes('短缺')
      ? 43
      : item.stage.includes('过剩') || item.stage.includes('出清')
        ? 50
        : 36;
  const expectationBase =
    item.stage.includes('成长') || item.stage.includes('扩张')
      ? 36
      : item.stage.includes('待验证')
        ? 28
        : 24;
  const riskBase =
    item.stage.includes('过剩') || item.stage.includes('待验证') || item.stage.includes('出清')
      ? 32
      : 22;

  return normalizeSegments([
    realityBase + sourceScore + metricScore * 0.35 + shortage * 0.08,
    expectationBase + growth * 0.24 + stableJitter * 0.4,
    riskBase + riskSignal * 0.22 + oversupply * 0.22 + shortage * 0.08,
  ]);
}

function signalCount(text, keywords) {
  return keywords.reduce((count, keyword) => {
    const matches = String(text).match(new RegExp(keyword, 'gu'));
    return count + (matches?.length || 0);
  }, 0);
}

function clampScore(value, min = 18, max = 92) {
  return Math.round(Math.max(min, Math.min(max, value)));
}

function normalizeSegments(values) {
  const safe = values.map((value) => Math.max(12, value));
  const total = safe.reduce((sum, value) => sum + value, 0) || 1;
  let first = Math.round((safe[0] / total) * 100);
  let second = Math.round((safe[1] / total) * 100);
  let third = Math.max(8, 100 - first - second);
  const overflow = first + second + third - 100;
  if (overflow > 0) {
    if (first >= second) first = Math.max(8, first - overflow);
    else second = Math.max(8, second - overflow);
  }
  third = 100 - first - second;
  return [first, second, third];
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
  return item.quality?.score == null ? '未评分' : `${item.quality.score}分`;
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
  const hasOriginalMarkdown = Boolean(item.originalMarkdown);
  const canDownloadOriginal = hasOriginalMarkdown || Boolean(item.markdownUrl);

  return (
    <section className="detail-flow">
      <button className="close-detail" onClick={close}>返回图谱</button>
      <div className="selected-orb" style={{ '--orb-color': category.color }}>
        <span>{shortName(item.industry)}</span>
        <small>{item.stage}</small>
      </div>

      <article className="industry-brief">
        <div className="brief-heading">
          <div>
            <p className="micro-title">行业入口 / {caseOriginLabel(item)}</p>
            <h2>{item.title}</h2>
          </div>
          <span className="brief-stage">{item.stage}</span>
        </div>
        <p className="brief-judgment">{item.judgment}</p>
        <SupplyDemandPulse />
        <div className="brief-grid">
          <span>案例来源：{caseOriginLabel(item)}</span>
          <span>可见状态：{publicationLabel(item)}</span>
          <span>质量状态：{qualityLabel(item)}</span>
          <span>报告生成/分析时间：{reportDate(item)}</span>
          <span>范围：{item.geography}</span>
          <span>信息搜集范围：{dataFreshness(item)}</span>
        </div>
      </article>

      <ConclusionAudit item={item} chainNodes={chainNodes} metricHints={metricHints} />

      <EvidenceTrace item={item} metricHints={metricHints} />

      <article className="flow-card">
        <div className="card-head">
          <div>
            <p className="micro-title">上下游产业链</p>
            <h3>把行业拆成可以点击的传导链</h3>
          </div>
          <span>悬停看节点，点击锁定</span>
        </div>
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
      </article>

      <div className="analysis-grid">
        <InsightSlide
          title="利益走向"
          kicker="谁付款，谁拿利润"
          copy={getInsightCopy(item, 'profit', chainNodes, metricHints)}
          chart={<MiniChart type="bar" labels={['付款方', '瓶颈方', '扩产方', '承压方']} values={getChartProfile(item, 'profit')} color={category.color} note="模型评分 0-100：用于表达利润压力和瓶颈强弱，不是原始统计值。" />}
        />
        <InsightSlide
          title="供需信号"
          kicker="需求、产能、价格、库存一起看"
          copy={getInsightCopy(item, 'signal', chainNodes, metricHints)}
          chart={<MiniChart type="line" labels={['需求', '产能', '价格', '库存']} values={getChartProfile(item, 'signal')} color="#8db6d9" note="抽象信号曲线：不同指标没有共用真实单位，只比较方向和相对强弱。" />}
        />
        <InsightSlide
          title="周期位置"
          kicker="阶段不是标签，是假设"
          copy={getInsightCopy(item, 'cycle', chainNodes, metricHints)}
          chart={<MiniChart type="donut" labels={['现实', '预期', '风险']} values={getChartProfile(item, 'cycle')} color={category.color} note="阶段分布为分析模型的拆解视图，真实判断仍需由证据链校验。" />}
        />
      </div>

      <ComparisonTable item={item} cases={cases} />

      <UpdateHistory item={item} />

      <WatchList item={item} chainNodes={chainNodes} />

      <article className="flow-card">
        <p className="micro-title">关键瓶颈</p>
        <h3>先看哪里卡住</h3>
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
        <h3>文字压缩，证据显性化</h3>
        <div className="source-row">
          <span>原始报告：{item.file}</span>
          <span>报告生成/分析时间：{reportDate(item)}</span>
          <span>信息搜集范围：{dataFreshness(item)}</span>
          <span>边界：不输出买卖建议</span>
        </div>
        <div className="source-list">
          {(item.sourceHints?.length ? item.sourceHints : ['该报告未提取到显式来源行，需回到原始 Markdown 查看证据矩阵。']).slice(0, 4).map((source) => (
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
          <p>图谱和卡片只是压缩视图，关键判断仍应回到完整 Markdown 里核对上下文、来源和反证条件。</p>
        </div>
        <div className="raw-report-actions">
          <button onClick={() => setRawOpen(true)} disabled={!hasOriginalMarkdown}>
            {hasOriginalMarkdown ? '打开原始 MD' : '原文未保存'}
          </button>
          {canDownloadOriginal && <button className="secondary-button" onClick={() => onDownloadMarkdown(item)}>下载原始 MD</button>}
        </div>
      </article>

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
          ['供给状态', (row) => compactText(row.judgment, 46)],
          ['核心瓶颈', (row) => compactText(row.bottlenecks[0], 54)],
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
  const fields = [
    ['这是什么', description.what],
    ['它做什么', description.does || description.role],
    ['上游是谁', description.suppliers],
    ['下游是谁', description.buyers],
    ['怎么赚钱', description.money],
    ['为什么重要', description.why],
  ];
  return (
    <div className="node-readout">
      <div className="node-title">
        <span>{description.position}</span>
        <strong>{currentNode}</strong>
      </div>
      <div className="node-copy">
        {fields.map(([label, value]) => (
          <section key={label}>
            <span>{label}</span>
            <p>{value || '该节点需要回到原始报告继续补充。'}</p>
          </section>
        ))}
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

function InsightSlide({ title, kicker, copy, chart }) {
  return (
    <article className="insight-slide">
      <div>
        <p className="micro-title">{kicker}</p>
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
      {chart}
    </article>
  );
}

function MiniChart({ type = 'bar', labels, values = [42, 78, 64, 34], color, note }) {
  const numericValues = Array.isArray(values) ? values : values?.values || values?.segments || [42, 78, 64, 34];
  const barValues = numericValues.slice(0, 4).map((value) => Math.max(24, Math.min(92, value)));
  const chartColors = [color, '#d9b88f', '#e79aa8'];
  const pointX = [8, 34, 60, 88];
  const toLinePoints = (series) =>
    series.slice(0, 4).map((value, index) => [pointX[index], 78 - Math.max(18, Math.min(92, value)) * 0.56]);

  if (type === 'line') {
    const demandSeries = values?.demand || barValues;
    const supplySeries = values?.supply || [barValues[1], barValues[2], barValues[3], barValues[0]];
    const demandPoints = toLinePoints(demandSeries);
    const supplyPoints = toLinePoints(supplySeries);
    const demandPath = demandPoints.map(([x, y]) => `${x},${y}`).join(' ');
    const supplyPath = supplyPoints.map(([x, y]) => `${x},${y}`).join(' ');
    return (
      <div className="chart-shell">
        <div className="line-chart">
          <svg viewBox="0 0 100 88" aria-label="供需信号折线图">
            {[24, 40, 56, 72].map((y) => <line key={y} x1="6" x2="94" y1={y} y2={y} className="grid-line" />)}
            <polygon points={`8,80 ${demandPath} 88,80`} className="line-area" />
            <polyline points={demandPath} fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={supplyPath} fill="none" stroke={chartColors[1]} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            {demandPoints.map(([x, y], index) => (
              <g key={labels[index]}>
                <circle cx={x} cy={y} r="2.9" fill={color} />
                <circle cx={supplyPoints[index][0]} cy={supplyPoints[index][1]} r="2.4" fill={chartColors[1]} />
                <text x={x} y="84">{labels[index]}</text>
              </g>
            ))}
            <text x="12" y="16" className="chart-note">需求侧</text>
            <text x="70" y="16" className="chart-note secondary">供给侧</text>
            <text x="12" y="26" className="chart-note muted">看斜率差，而不是单点高低</text>
          </svg>
        </div>
        <p className="chart-footnote">{note}</p>
      </div>
    );
  }

  if (type === 'donut') {
    const segments = normalizeSegments(numericValues.slice(0, 3));
    const first = segments[0];
    const second = segments[0] + segments[1];
    return (
      <div className="chart-shell">
        <div className="donut-chart">
          <div
            className="donut-core"
            style={{
              '--chart-color': color,
              '--chart-second': chartColors[1],
              '--chart-third': chartColors[2],
              '--donut-first': `${first}%`,
              '--donut-second': `${second}%`,
            }}
          >
            <strong>阶段</strong>
            <span>假设</span>
          </div>
          <ul>
            {labels.map((label, index) => (
              <li key={label} style={{ '--legend-color': chartColors[index] }}>
                {label}<small>{segments[index]}% · {['产业现实', '市场预期', '反证风险'][index]}</small>
              </li>
            ))}
          </ul>
        </div>
        <p className="chart-footnote">{note}</p>
      </div>
    );
  }

  return (
    <div className="chart-shell">
      <div className="mini-chart" aria-label="利益走向柱状图">
        <div className="bar-grid">
          <span>强</span>
          <span>中</span>
          <span>弱</span>
        </div>
        <div className="bars">
          {labels.map((label, index) => (
            <div key={label} style={{ '--bar-height': `${barValues[index]}%` }}>
              <strong>{barValues[index]}</strong>
              <span style={{ height: `${barValues[index]}%`, background: index === 1 ? color : '#e3e8ef' }} />
              <small>{label}</small>
            </div>
          ))}
        </div>
      </div>
      <p className="chart-footnote">{note}</p>
    </div>
  );
}

export default App;
