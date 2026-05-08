  // ============================================================
  // Build cy data
  // ============================================================
  const refCount = {};
  HLR_DATA.nodes.forEach(n => {
    refCount[n.id] = (n.referenced_by || []).length + (n.children || []).length;
    if (n.type === 'topic') refCount[n.id] = n.hlr_count;
    if (n.type === 'ts' || n.type === 'legal') refCount[n.id] = (n.topics || []).length * 3;
    if (n.type === 'disc') refCount[n.id] = (n.topics || []).length + (n.hlr_refs || []).length / 5;
  });

  const cyNodes = HLR_DATA.nodes.map(n => ({
    data: {
      id: n.id,
      label: n.label,
      type: n.type,
      category: n.category || '',
      topic: n.topic || '',
      isEmpty: n.is_empty || false,
      isRr: n.is_rr || false,
      degree: refCount[n.id] || 0,
    }
  }));
  const cyEdges = HLR_DATA.edges.map((e, i) => ({
    data: { id: 'e' + i, source: e.source, target: e.target, type: e.type }
  }));

  // ============================================================
  // Cytoscape
  // ============================================================
  // Build the normal-mode cytoscape style sheet as a function so cosmos mode
  // can restore it on exit (instead of relying on cy.style().json() which can
  // miss live extensions like the tension edge style added later).
  function buildNormalCyStyle() {
    return [
      { selector: 'node', style: {
        'background-color': ele => nodeColor(nodeLookup[ele.data('id')]),
        'shape': ele => nodeShape(ele.data('type'), ele.data('isRr')),
        'label': 'data(label)',
        'color': () => getCSS('--text'),
        'font-size': ele => ele.data('type') === 'hlr' ? 8 : 11,
        'font-family': "'JetBrains Mono', monospace",
        'font-weight': ele => ele.data('type') === 'hlr' ? 500 : 600,
        'text-valign': 'center',
        'text-halign': ele => ele.data('type') === 'hlr' ? 'right' : 'center',
        'text-margin-x': ele => ele.data('type') === 'hlr' ? 4 : 0,
        'width': ele => {
          const t = ele.data('type');
          const d = ele.data('degree');
          if (t === 'topic') return Math.max(28, 24 + Math.sqrt(d) * 5);
          if (t === 'ts') return 26;
          if (t === 'legal') return 28;
          if (t === 'disc') return 22;
          return Math.max(8, 9 + Math.sqrt(d) * 3.5);
        },
        'height': ele => {
          const t = ele.data('type');
          const d = ele.data('degree');
          if (t === 'topic') return Math.max(28, 24 + Math.sqrt(d) * 5);
          if (t === 'ts') return 22;
          if (t === 'legal') return 22;
          if (t === 'disc') return 22;
          return Math.max(8, 9 + Math.sqrt(d) * 3.5);
        },
        'border-width': 0,
        'opacity': ele => ele.data('isEmpty') ? 0.35 : 0.95,
        'text-opacity': ele => ele.data('type') !== 'hlr' ? 1 : 0,
        'overlay-opacity': 0,
      }},
      { selector: 'node[type = "hlr"][degree >= 4]', style: { 'text-opacity': 0.7 } },
      { selector: 'node:selected', style: {
        'border-width': 3, 'border-color': () => getCSS('--accent'), 'border-opacity': 1,
        'text-opacity': 1, 'font-size': 12, 'font-weight': 700, 'z-index': 999,
      }},
      { selector: 'node.highlighted', style: { 'text-opacity': 1, 'font-weight': 700, 'z-index': 50 } },
      { selector: 'node.dimmed', style: { 'opacity': 0.05, 'text-opacity': 0 } },
      { selector: 'node.bookmarked', style: { 'border-width': 2, 'border-color': () => getCSS('--bookmark'), 'border-opacity': 0.9 } },
      { selector: 'node.status-started', style: { 'border-width': 3, 'border-color': () => getCSS('--status-started'), 'border-opacity': 0.85 } },
      { selector: 'node.status-implemented', style: { 'border-width': 3, 'border-color': () => getCSS('--status-impl'), 'border-opacity': 0.9 } },
      { selector: 'node.status-verified', style: { 'border-width': 3, 'border-color': () => getCSS('--status-verified'), 'border-opacity': 0.95 } },
      { selector: 'edge', style: {
        'width': ele => ele.data('type') === 'parent-child' ? 1.4 : (ele.data('type') === 'refines' ? 1.4 : 0.8),
        'line-color': ele => {
          const t = ele.data('type');
          if (t === 'parent-child') return getCSS('--accent');
          if (t === 'reference') return getCSS('--text-subtle');
          if (t === 'discusses') return getCSS('--type-disc');
          if (t === 'refines') return getCSS('--type-disc-rr');
          if (t === 'contains') return getCSS('--type-topic');
          if (t === 'implements') return getCSS('--type-ts');
          if (t === 'governs') return getCSS('--type-legal-cir');
          return getCSS('--text-subtle');
        },
        'line-style': ele => {
          const t = ele.data('type');
          if (t === 'parent-child') return 'solid';
          if (t === 'reference') return 'dashed';
          if (t === 'contains') return 'dotted';
          if (t === 'discusses') return 'dashed';
          if (t === 'refines') return 'dotted';
          return 'solid';
        },
        'line-dash-pattern': ele => {
          const t = ele.data('type');
          if (t === 'reference') return [4, 3];
          if (t === 'contains') return [2, 4];
          if (t === 'discusses') return [3, 3];
          if (t === 'refines') return [1, 3];
          return [];
        },
        'curve-style': 'bezier',
        'opacity': ele => {
          const t = ele.data('type');
          if (t === 'contains') return 0.18;
          if (t === 'discusses') return 0.45;
          if (t === 'refines') return 0.65;
          return 0.32;
        },
        'target-arrow-shape': ele => ele.data('type') === 'parent-child' ? 'triangle' : 'none',
        'target-arrow-color': () => getCSS('--accent'),
        'arrow-scale': 0.7,
      }},
      { selector: 'edge.highlighted', style: { 'opacity': 1, 'width': 2, 'z-index': 40 } },
      { selector: 'edge.dimmed', style: { 'opacity': 0.04 } },
    ];
  }
  // Make accessible to cosmos restore.
  window.__buildNormalCyStyle = buildNormalCyStyle;

  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements: { nodes: cyNodes, edges: cyEdges },
    minZoom: 0.08,
    maxZoom: 4,
    wheelSensitivity: 0.2,
    style: buildNormalCyStyle(),
    layout: { name: 'preset' },
  });
  document.getElementById('graphStatus').textContent = 'Layout: laying out 718 nodes…';

  function updateNodeStatusClasses(hlrId) {
    const node = cy.getElementById(hlrId);
    if (!node || node.empty()) return;
    node.removeClass('status-started status-implemented status-verified bookmarked');
    const status = personal.getStatus(hlrId);
    if (status !== 'none') node.addClass('status-' + status);
    if (personal.isBookmarked(hlrId)) node.addClass('bookmarked');
  }

  function applyAllStatusClasses() {
    HLR_DATA.nodes.forEach(n => { if (n.type === 'hlr') updateNodeStatusClasses(n.id); });
  }

  // ============================================================
  // Layouts
  // ============================================================
  // Cose seeds initial node positions with Math.random(), which is why the
  // graph looks different on every page reload. Swap in a deterministic LCG
  // PRNG for the duration of the layout call so the same data always renders
  // the same picture. The seed can be bumped via runForceLayout(true) to get a
  // fresh layout on demand (e.g. when the user clicks "Force layout" again).
  let _layoutSeed = 0xC0DE;
  function _seededRandomScope(fn) {
    const orig = Math.random;
    let s = _layoutSeed;
    Math.random = function() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    try { return fn(); } finally { Math.random = orig; }
  }
  function runForceLayout(reshuffle) {
    if (reshuffle) _layoutSeed = (_layoutSeed * 1103515245 + 12345) >>> 0;
    _seededRandomScope(() => {
      cy.layout({
        name: 'cose',
        animate: false,
        randomize: true,
        idealEdgeLength: e => {
          const t = e.data('type');
          if (t === 'contains') return 50;
          if (t === 'parent-child') return 60;
          if (t === 'implements' || t === 'governs') return 110;
          return 90;
        },
        nodeRepulsion: 7000,
        gravity: 1.5,
        numIter: 1500,
        coolingFactor: 0.95,
        initialTemp: 240,
      }).run();
    });
    document.getElementById('graphStatus').textContent = 'Force layout · ' + HLR_DATA.stats.total_nodes + ' nodes';
    document.getElementById('layoutCose').classList.add('active');
    document.getElementById('layoutGrid').classList.remove('active');
  }

  function runTopicGrid() {
    const topics = [...new Set(cy.nodes().filter(n => n.data('type') === 'topic').map(n => n.data('id')))];
    topics.sort((a, b) => +(nodeLookup[a].topic) - +(nodeLookup[b].topic));
    const cols = Math.ceil(Math.sqrt(topics.length));
    const cellW = 380, cellH = 320;
    const positions = {};
    topics.forEach((topicId, i) => {
      const cellX = (i % cols) * cellW;
      const cellY = Math.floor(i / cols) * cellH;
      positions[topicId] = { x: cellX, y: cellY };
      // Find HLRs in this topic
      const tn = nodeLookup[topicId].topic;
      const hlrs = cy.nodes().filter(n => n.data('type') === 'hlr' && n.data('topic') === tn);
      const tCols = Math.ceil(Math.sqrt(Math.max(1, hlrs.length)));
      hlrs.forEach((n, j) => {
        positions[n.id()] = {
          x: cellX + 30 + (j % tCols) * 32,
          y: cellY + 30 + Math.floor(j / tCols) * 32,
        };
      });
    });
    // Place TS / Legal nodes in a footer band
    const footerY = Math.ceil(topics.length / cols) * cellH + 40;
    let tsX = 0, legalX = 0;
    cy.nodes().forEach(n => {
      if (n.data('type') === 'ts') { positions[n.id()] = { x: tsX, y: footerY }; tsX += 60; }
      if (n.data('type') === 'legal') { positions[n.id()] = { x: legalX, y: footerY + 60 }; legalX += 110; }
    });
    cy.layout({
      name: 'preset',
      positions: node => positions[node.id()] || { x: 0, y: 0 },
      animate: true, animationDuration: 700,
      fit: true, padding: 50,
    }).run();
    document.getElementById('graphStatus').textContent = 'Topic grid · ' + topics.length + ' clusters';
    document.getElementById('layoutGrid').classList.add('active');
    document.getElementById('layoutCose').classList.remove('active');
  }

  // Click → re-shuffle (gives the user a fresh layout on demand). The initial
  // load (in init) still calls runForceLayout() with no args → deterministic,
  // so the picture is stable across refreshes.
  document.getElementById('layoutCose').addEventListener('click', () => runForceLayout(true));
  document.getElementById('layoutGrid').addEventListener('click', runTopicGrid);
  document.getElementById('resetView').addEventListener('click', () => {
    // Re-apply current filters in case a path-focus override is in effect.
    applyFilters();
    cy.fit(undefined, 30);
  });
  let hideEmpty = false;
  document.getElementById('hideEmpty').addEventListener('click', e => {
    hideEmpty = !hideEmpty;
    e.target.classList.toggle('active', hideEmpty);
    applyFilters();
  });

