  // ============================================================
  // Cosmos — full-screen cinematic graph mode
  // ============================================================
  // Spectacle goals:
  //   * Treat the ARF graph as a stellar map. Topics are gravitational hubs;
  //     HLRs orbit them; TS / Legal / Disc circle the system on outer rims.
  //   * Drown the chrome. Maximise the canvas. Add a starfield + vignette.
  //   * Restyle cytoscape: brighter colours, generous glows, bigger nodes,
  //     animated edge dash flow for "alive" feel.
  //   * Curated tours (1-9): jump to interesting subgraphs (PID flow, QES,
  //     auth contract, refinement frontier, etc.).
  //   * Auto-pilot (C): slow camera drift through the topic ring.
  //   * Hover any node → tasteful readout panel near the bottom.

  const COSMOS_CENTER = { x: 0, y: 0 };
  const TOPIC_ORBIT_R = 880;        // radius of the topic ring
  const HLR_ORBIT_BASE_R = 50;      // base radius for HLRs around their topic
  const HLRS_PER_RING = 22;         // HLRs per orbit ring; crowded topics get multiple rings
  const RING_SPACING = 18;          // px between concentric HLR rings
  const OUTER_RIM_R = 1450;         // TS / Legal / Disc outer rim
  const DISC_RIM_R = 1200;          // Disc papers slightly inboard of TS/Legal

  // The canonical "normal" cytoscape stylesheet is exported from 04_graph.js
  // as window.__buildNormalCyStyle so we can rebuild it cleanly on exit.
  // Falls back to a no-op if unavailable.
  function rebuildNormalStyle() {
    if (window.__buildNormalCyStyle) {
      try {
        cy.style().fromJson(window.__buildNormalCyStyle()).update();
        return true;
      } catch (e) { console.warn('Cosmos: normal-style rebuild failed', e); }
    }
    return false;
  }

  // --- Cosmos cytoscape style sheet
  function cosmosStyle() {
    return [
      { selector: 'node', style: {
        'background-color': ele => nodeColor(nodeLookup[ele.data('id')]),
        'shape': ele => nodeShape(ele.data('type'), ele.data('isRr')),
        'label': 'data(label)',
        'color': '#ffffff',
        'font-size': ele => ele.data('type') === 'hlr' ? 7 : 12,
        'font-family': "'JetBrains Mono', monospace",
        'font-weight': ele => ele.data('type') === 'hlr' ? 500 : 700,
        'text-valign': 'center',
        'text-halign': ele => ele.data('type') === 'hlr' ? 'right' : 'center',
        'text-margin-x': ele => ele.data('type') === 'hlr' ? 5 : 0,
        'text-outline-color': '#000',
        'text-outline-opacity': 0.85,
        'text-outline-width': 2,
        'width': ele => {
          const t = ele.data('type'); const d = ele.data('degree');
          if (t === 'topic') return Math.max(48, 38 + Math.sqrt(d) * 7);
          if (t === 'ts') return 36;
          if (t === 'legal') return 38;
          if (t === 'disc') return 30;
          return Math.max(10, 10 + Math.sqrt(d) * 4);
        },
        'height': ele => {
          const t = ele.data('type'); const d = ele.data('degree');
          if (t === 'topic') return Math.max(48, 38 + Math.sqrt(d) * 7);
          if (t === 'ts') return 30;
          if (t === 'legal') return 30;
          if (t === 'disc') return 30;
          return Math.max(10, 10 + Math.sqrt(d) * 4);
        },
        'border-width': ele => ele.data('type') === 'hlr' ? 0 : 1.5,
        'border-color': '#ffffff',
        'border-opacity': 0.18,
        // Glow via cytoscape shadow
        'shadow-blur': ele => {
          const t = ele.data('type');
          if (t === 'topic') return 38;
          if (t === 'ts' || t === 'legal') return 22;
          if (t === 'disc') return 18;
          return ele.data('isEmpty') ? 4 : 12;
        },
        'shadow-color': ele => nodeColor(nodeLookup[ele.data('id')]),
        'shadow-opacity': ele => ele.data('isEmpty') ? 0.15 : 0.85,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
        'background-opacity': ele => ele.data('isEmpty') ? 0.25 : 1,
        'opacity': ele => ele.data('isEmpty') ? 0.4 : 1,
        'text-opacity': ele => ele.data('type') !== 'hlr' ? 1 : 0,
        'overlay-opacity': 0,
      }},
      // HLR labels show on hover or for high-degree
      { selector: 'node[type = "hlr"][degree >= 5]', style: { 'text-opacity': 0.8 } },
      { selector: 'node:selected', style: {
        'border-width': 3,
        'border-color': '#ffffff',
        'border-opacity': 0.95,
        'shadow-blur': 60,
        'shadow-opacity': 1,
        'text-opacity': 1, 'font-size': 14, 'font-weight': 700, 'z-index': 999,
      }},
      { selector: 'node.cosmos-hover', style: {
        'shadow-blur': 50,
        'shadow-opacity': 1,
        'text-opacity': 1, 'font-weight': 700, 'z-index': 50,
        'border-width': 2, 'border-color': '#ffffff', 'border-opacity': 0.6,
      }},
      { selector: 'node.cosmos-dim', style: {
        'opacity': 0.18,
        'text-opacity': 0,
        'shadow-opacity': 0.15,
      }},
      { selector: 'node.cosmos-focus', style: {
        'shadow-blur': 80,
        'shadow-opacity': 1,
        'text-opacity': 1,
        'font-size': 16, 'font-weight': 700,
        'border-width': 3, 'border-color': '#ffffff', 'border-opacity': 0.7,
        'z-index': 999,
      }},
      { selector: 'node.bookmarked', style: { 'border-width': 3, 'border-color': '#F87171', 'border-opacity': 0.9 } },
      { selector: 'node.status-started',     style: { 'border-width': 3, 'border-color': '#FBBF24', 'border-opacity': 0.9 } },
      { selector: 'node.status-implemented', style: { 'border-width': 3, 'border-color': '#60A5FA', 'border-opacity': 0.95 } },
      { selector: 'node.status-verified',    style: { 'border-width': 3, 'border-color': '#4ADE80', 'border-opacity': 0.95 } },
      { selector: 'edge', style: {
        'width': ele => {
          const t = ele.data('type');
          if (t === 'parent-child' || t === 'refines') return 1.4;
          if (t === 'reference') return 0.7;
          if (t === 'discusses') return 1.0;
          return 0.6;
        },
        'line-color': ele => {
          const t = ele.data('type');
          if (t === 'parent-child') return '#7BA5F0';
          if (t === 'reference') return '#A6A6AE';
          if (t === 'contains') return '#93C5FD';
          if (t === 'implements') return '#67E8F9';
          if (t === 'governs') return '#FDBA74';
          if (t === 'tension') return '#FCA5A5';
          if (t === 'discusses') return '#A78BFA';
          if (t === 'refines') return '#C4B5FD';
          return '#A6A6AE';
        },
        'line-style': ele => {
          const t = ele.data('type');
          if (t === 'reference') return 'dashed';
          if (t === 'contains') return 'dotted';
          if (t === 'discusses') return 'dashed';
          if (t === 'refines') return 'dotted';
          if (t === 'tension') return 'dashed';
          return 'solid';
        },
        'line-dash-pattern': ele => {
          const t = ele.data('type');
          if (t === 'reference') return [4, 4];
          if (t === 'contains') return [1.5, 4];
          if (t === 'discusses') return [3, 3];
          if (t === 'refines') return [1, 3];
          if (t === 'tension') return [6, 3];
          return [];
        },
        'curve-style': 'bezier',
        'opacity': ele => {
          const t = ele.data('type');
          if (t === 'contains') return 0.16;
          if (t === 'reference') return 0.30;
          if (t === 'discusses') return 0.55;
          if (t === 'refines') return 0.7;
          if (t === 'tension') return 0.65;
          return 0.40;
        },
        'target-arrow-shape': 'none',
      }},
      { selector: 'edge.cosmos-hover', style: { 'opacity': 0.95, 'width': 1.8, 'z-index': 40 } },
      { selector: 'edge.cosmos-dim', style: { 'opacity': 0.04 } },
    ];
  }

  // --- Custom cosmos layout: topics in a ring, HLRs orbiting, outer rim for TS/Legal/Disc.
  function cosmosLayoutPositions() {
    const pos = {};
    const topics = HLR_DATA.nodes.filter(n => n.type === 'topic')
      .sort((a, b) => +a.topic - +b.topic);
    const N = topics.length;

    // Topics in a ring, evenly spaced
    topics.forEach((t, i) => {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      const tx = COSMOS_CENTER.x + Math.cos(angle) * TOPIC_ORBIT_R;
      const ty = COSMOS_CENTER.y + Math.sin(angle) * TOPIC_ORBIT_R;
      pos[t.id] = { x: tx, y: ty };

      const hlrs = HLR_DATA.nodes.filter(n => n.type === 'hlr' && n.topic === t.topic);
      const M = hlrs.length;
      // Crowded topics use multiple concentric rings so HLRs don't overlap.
      const numRings = Math.max(1, Math.ceil(M / HLRS_PER_RING));
      hlrs.forEach((h, j) => {
        const ring = Math.floor(j / HLRS_PER_RING);
        const inRing = j % HLRS_PER_RING;
        // Last ring may be partial; size = remaining items
        const ringSize = (ring < numRings - 1)
          ? HLRS_PER_RING
          : (M - ring * HLRS_PER_RING);
        const orbitR = HLR_ORBIT_BASE_R + ring * RING_SPACING;
        // Stagger ring rotation so adjacent rings don't align on a single radial spoke.
        const ringRotation = (ring * 0.42);
        const sub = (inRing / ringSize) * Math.PI * 2 + ringRotation + angle * 0.4;
        // High-degree HLRs sit slightly inboard (visual hierarchy hint)
        const ringR = orbitR - Math.min(8, (h.referenced_by?.length || 0) * 1.0);
        pos[h.id] = {
          x: tx + Math.cos(sub) * ringR,
          y: ty + Math.sin(sub) * ringR,
        };
      });
    });

    // Disc papers — placed near their primary topic but pulled slightly outward.
    const discs = HLR_DATA.nodes.filter(n => n.type === 'disc');
    discs.forEach((d, i) => {
      const tn = (d.topics || [])[0];
      let baseAngle = (i / discs.length) * Math.PI * 2;
      if (tn) {
        const t = topics.find(t => t.topic === tn);
        if (t && pos[t.id]) {
          baseAngle = Math.atan2(pos[t.id].y - COSMOS_CENTER.y, pos[t.id].x - COSMOS_CENTER.x);
        }
      }
      // RR papers slightly further out + offset, so RR + integrated don't overlap.
      const r = DISC_RIM_R + (d.is_rr ? 60 : 0);
      const angleNudge = (d.is_rr ? 0.04 : -0.04);
      pos[d.id] = {
        x: COSMOS_CENTER.x + Math.cos(baseAngle + angleNudge) * r,
        y: COSMOS_CENTER.y + Math.sin(baseAngle + angleNudge) * r,
      };
    });

    // TS + Legal — outer rim, TS top-half, Legal bottom-half.
    const ts = HLR_DATA.nodes.filter(n => n.type === 'ts').sort((a, b) => +a.label.slice(2) - +b.label.slice(2));
    const legal = HLR_DATA.nodes.filter(n => n.type === 'legal').sort((a, b) => a.label.localeCompare(b.label));
    ts.forEach((n, i) => {
      const angle = -Math.PI + (i / Math.max(1, ts.length - 1)) * Math.PI * 0.95;
      pos[n.id] = {
        x: COSMOS_CENTER.x + Math.cos(angle) * OUTER_RIM_R,
        y: COSMOS_CENTER.y + Math.sin(angle) * OUTER_RIM_R,
      };
    });
    legal.forEach((n, i) => {
      const angle = (i / Math.max(1, legal.length - 1)) * Math.PI * 0.95;
      pos[n.id] = {
        x: COSMOS_CENTER.x + Math.cos(angle) * OUTER_RIM_R,
        y: COSMOS_CENTER.y + Math.sin(angle) * OUTER_RIM_R,
      };
    });

    return pos;
  }

  // --- Tour stops: curated camera positions + spotlight subgraphs.
  // Each stop names a focus subgraph; entering it dims everything else.
  const TOUR_STOPS = [
    { key: '1', icon: '🪪', name: 'PID issuance',         feat: 'feat_pid_issuance' },
    { key: '2', icon: '🌐', name: 'Remote presentation',  feat: 'feat_remote_presentation' },
    { key: '3', icon: '📡', name: 'Proximity (mDL)',      feat: 'feat_proximity_presentation' },
    { key: '4', icon: '✍️',  name: 'Qualified e-signature', feat: 'feat_qes' },
    { key: '5', icon: '🔁', name: 'Wallet-to-Wallet',     feat: 'feat_w2w' },
    { key: '6', icon: '🎭', name: 'Pseudonyms',           feat: 'feat_pseudonyms' },
    { key: '7', icon: '⚡', name: 'Activation & WIAM',     feat: 'feat_activation' },
    { key: '8', icon: '🚫', name: 'Wallet revocation',    feat: 'feat_wu_revocation' },
    { key: '9', icon: '⚠',  name: '2026 refinements',     mode: 'refinements' },
  ];

  // --- Cosmos state
  let cosmosActive = false;
  let cosmosFlying = false;       // animation in flight
  let autoPilot = false;
  let autoPilotRaf = null;
  let autoPilotPaused = false;
  let autoPilotStart = 0;
  let activeTour = null;
  let cosmosHoverEl = null;
  let dashFlowRaf = null;
  let dashFlowOffset = 0;

  // DOM is the source of truth — robust against state-flag desync (e.g. user
  // presses F during the 1.2s enter animation when cosmosActive is still false).
  function isCosmos() { return document.body.classList.contains('cosmos'); }

  // --- Enter cosmos
  function enterCosmos() {
    if (cosmosActive || cosmosFlying) return;
    cosmosFlying = true;

    // Try native fullscreen (best-effort; we still proceed if it fails).
    if (document.documentElement.requestFullscreen) {
      try { document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* ok */ }
    }

    document.body.classList.add('cosmos');
    requestAnimationFrame(() => {
      document.body.classList.add('fade-in');

      // Apply cosmos cytoscape style
      cy.style().fromJson(cosmosStyle()).update();
      cy.resize();

      // Apply cosmos layout with animation.
      const positions = cosmosLayoutPositions();
      cy.layout({
        name: 'preset',
        positions: node => positions[node.id()] || { x: 0, y: 0 },
        animate: true,
        animationDuration: 1100,
        animationEasing: 'ease-in-out-cubic',
        fit: true,
        padding: 100,
      }).run();

      // Gentle zoom-in reveal after layout settles.
      setTimeout(() => {
        try { cy.animate({ zoom: cy.zoom() * 1.05, center: { eles: cy.elements() } }, { duration: 1400, easing: 'ease-in-out-cubic' }); } catch (e) {}
        cosmosActive = true;
        cosmosFlying = false;
      }, 1200);
    });

    startDashFlow();
  }

  // --- Dash flow: animate the line-dash-offset on contains/discusses/refines
  // edges so the graph feels "alive". 60fps lite — just edits a cy style.
  function startDashFlow() {
    if (dashFlowRaf) return;
    function tick() {
      if (!cosmosActive) { dashFlowRaf = null; return; }
      dashFlowRaf = requestAnimationFrame(tick);
      dashFlowOffset = (dashFlowOffset + 0.4) % 100;
      cy.style().selector('edge[type = "contains"]').style({ 'line-dash-offset': -dashFlowOffset })
        .selector('edge[type = "discusses"]').style({ 'line-dash-offset': -dashFlowOffset * 1.4 })
        .selector('edge[type = "refines"]').style({ 'line-dash-offset': -dashFlowOffset * 1.8 })
        .update();
    }
    dashFlowRaf = requestAnimationFrame(tick);
  }
  function stopDashFlow() {
    if (dashFlowRaf) cancelAnimationFrame(dashFlowRaf);
    dashFlowRaf = null;
  }

  // --- Exit cosmos (synchronous teardown of cosmos chrome, then cytoscape
  // resize sequenced AFTER the browser exits native fullscreen — otherwise
  // the canvases stay sized to fullscreen dimensions and overflow the
  // sidebars after viewport shrinks back).
  function exitCosmos() {
    if (!isCosmos() && !cosmosActive && !cosmosFlying) return;

    // Stop any running animations FIRST.
    stopAutoPilot();
    stopDashFlow();
    activeTour = null;
    cosmosActive = false;
    cosmosFlying = false;

    // Tear down cosmos chrome — chrome reappears immediately.
    document.body.classList.remove('cosmos', 'fade-in', 'auto-pilot');
    const ro = document.getElementById('cosmosReadout');
    if (ro) ro.classList.remove('show');
    try { cy.elements().removeClass('cosmos-hover cosmos-dim cosmos-focus'); } catch (e) {}
    try { rebuildNormalStyle(); } catch (e) { console.warn('Cosmos exit: style restore failed', e); }

    // Sequence: if we're in native fullscreen, exit it FIRST, then wait for
    // viewport to reflow before resizing cytoscape + re-laying out. If we
    // resize cytoscape while still in fullscreen, the canvases get the
    // fullscreen dimensions, then the viewport shrinks underneath them and
    // they overflow the sidebars (which is the bug the user reported).
    const finishExit = () => {
      // Force a synchronous reflow so #cy reads its post-cosmos dimensions.
      void document.body.offsetWidth;
      try { cy.resize(); } catch (e) {}
      try { applyAllStatusClasses(); } catch (e) {}
      try {
        runForceLayout();
        cy.fit(undefined, 30);
      } catch (e) { console.warn('Cosmos exit: layout failed', e); }
    };

    if (document.fullscreenElement && document.exitFullscreen) {
      // Don't resize cytoscape until viewport is back to non-fullscreen size.
      let done = false;
      const onceFsChange = () => {
        if (done) return;
        done = true;
        document.removeEventListener('fullscreenchange', onceFsChange);
        // One more frame so layout has settled.
        requestAnimationFrame(finishExit);
      };
      document.addEventListener('fullscreenchange', onceFsChange);
      // Safety net: if fullscreenchange never fires (browser quirk), still
      // run the cleanup after a short delay.
      setTimeout(onceFsChange, 350);
      try { document.exitFullscreen().catch(() => {}); } catch (e) { /* ok */ }
    } else {
      // Not in fullscreen — resize immediately (next frame so CSS class
      // removal has had a chance to reflow).
      requestAnimationFrame(finishExit);
    }
  }

  function toggleCosmos() { isCosmos() ? exitCosmos() : enterCosmos(); }

  // --- Render the tour stop list
  function renderCosmosTour() {
    const wrap = document.getElementById('cosmosTourStops');
    if (!wrap) return;
    wrap.innerHTML = TOUR_STOPS.map((s, i) => {
      let count = '';
      if (s.feat) {
        const feat = (HLR_DATA.features || []).find(f => f.id === s.feat);
        if (feat) count = (feat.key_hlrs || []).length + ' HLRs';
      } else if (s.mode === 'refinements') {
        count = '4 RR papers';
      }
      return `<button class="cosmos-tour-stop" data-tour-idx="${i}">
        <span class="num">${s.key}</span>
        <span class="icon">${s.icon}</span>
        <span class="name">${escapeHtml(s.name)}</span>
        <span class="meta">${escapeHtml(count)}</span>
      </button>`;
    }).join('');
    wrap.querySelectorAll('[data-tour-idx]').forEach(btn => {
      btn.addEventListener('click', () => activateTour(+btn.dataset.tourIdx));
    });
  }

  function renderCosmosStats() {
    const stats = HLR_DATA.stats || {};
    const map = {
      hlr: stats.hlr_nodes,
      topic: stats.topic_nodes,
      ts: stats.ts_nodes,
      legal: stats.legal_nodes,
      disc: stats.disc_nodes,
      edges: stats.edges,
    };
    document.querySelectorAll('#cosmosStats [data-stat]').forEach(el => {
      const k = el.dataset.stat;
      if (map[k] != null) el.textContent = map[k];
    });
  }

  // --- Tour activation: highlight subgraph, fly camera to fit it.
  function activateTour(idx) {
    const stop = TOUR_STOPS[idx];
    if (!stop) return;
    activeTour = idx;
    document.querySelectorAll('.cosmos-tour-stop').forEach((el, i) =>
      el.classList.toggle('active', i === idx));

    let focusIds = new Set();
    if (stop.feat) {
      const feat = (HLR_DATA.features || []).find(f => f.id === stop.feat);
      if (feat) {
        (feat.key_hlrs || []).forEach(h => focusIds.add(h));
        (feat.primary_topics || []).forEach(t => focusIds.add('topic_' + t));
        (feat.ts || []).forEach(t => focusIds.add('ts_' + t));
        (feat.legal || []).forEach(l => {
          const aid = legalAliases[l]; if (aid) focusIds.add(aid);
        });
        // Pull HLRs from the same topic clusters
        HLR_DATA.nodes.forEach(n => {
          if (n.type === 'hlr' && (feat.primary_topics || []).includes(n.topic)) {
            focusIds.add(n.id);
          }
        });
      }
    } else if (stop.mode === 'refinements') {
      HLR_DATA.nodes.forEach(n => {
        if (n.type === 'disc' && n.is_rr) {
          focusIds.add(n.id);
          if (n.rr_pair) focusIds.add(n.rr_pair);
          (n.topics || []).forEach(t => focusIds.add('topic_' + t));
        }
      });
    }

    // Apply spotlight: focused get cosmos-focus, others get cosmos-dim.
    cy.batch(() => {
      cy.elements().removeClass('cosmos-focus cosmos-dim cosmos-hover');
      cy.nodes().forEach(n => {
        if (focusIds.has(n.id())) n.addClass('cosmos-focus');
        else n.addClass('cosmos-dim');
      });
      cy.edges().forEach(e => {
        const sd = e.source().id();
        const td = e.target().id();
        if (focusIds.has(sd) && focusIds.has(td)) {
          /* keep visible */
        } else {
          e.addClass('cosmos-dim');
        }
      });
    });

    // Fit camera to focus
    const eles = cy.collection();
    focusIds.forEach(id => { const n = cy.getElementById(id); if (!n.empty()) eles.merge(n); });
    if (eles.length) {
      cy.animate({ fit: { eles, padding: 120 } }, { duration: 900, easing: 'ease-in-out-cubic' });
    }
    showToast(`Tour: ${stop.name}`);
  }

  function clearTour() {
    activeTour = null;
    document.querySelectorAll('.cosmos-tour-stop').forEach(el => el.classList.remove('active'));
    cy.elements().removeClass('cosmos-focus cosmos-dim cosmos-hover');
    cy.animate({ fit: { eles: cy.elements(), padding: 100 } }, { duration: 700, easing: 'ease-in-out-cubic' });
  }

  // --- Auto-pilot: a slow camera orbit around the topic ring.
  let _apPauseAccum = 0;
  let _apPauseStart = 0;
  function startAutoPilot() {
    if (autoPilot) return;
    autoPilot = true;
    autoPilotPaused = false;
    _apPauseAccum = 0;
    _apPauseStart = 0;
    document.body.classList.add('auto-pilot');
    autoPilotStart = performance.now();
    const initialZoom = cy.zoom();
    function tick(t) {
      if (!autoPilot) return;
      autoPilotRaf = requestAnimationFrame(tick);
      if (autoPilotPaused) {
        if (!_apPauseStart) _apPauseStart = t;
        return;
      } else if (_apPauseStart) {
        _apPauseAccum += (t - _apPauseStart);
        _apPauseStart = 0;
      }
      const elapsed = (t - autoPilotStart - _apPauseAccum) / 1000;
      // Slow orbit: 60s per revolution
      const angle = (elapsed / 60) * Math.PI * 2;
      const r = TOPIC_ORBIT_R * 0.55;
      const cx_ = COSMOS_CENTER.x + Math.cos(angle) * r;
      const cy_ = COSMOS_CENTER.y + Math.sin(angle) * r;
      // Gentle zoom breathing (±5%, period ~16s)
      const zoom = initialZoom * (1 + 0.05 * Math.sin(elapsed * 0.4));
      const w = window.innerWidth;
      const h = window.innerHeight;
      cy.viewport({ zoom, pan: { x: w / 2 - cx_ * zoom, y: h / 2 - cy_ * zoom } });
    }
    autoPilotRaf = requestAnimationFrame(tick);
    showToast('Auto-pilot ON · Space to pause · C to exit');
  }

  function stopAutoPilot() {
    if (!autoPilot) return;
    autoPilot = false;
    autoPilotPaused = false;
    document.body.classList.remove('auto-pilot');
    if (autoPilotRaf) cancelAnimationFrame(autoPilotRaf);
    autoPilotRaf = null;
  }

  function toggleAutoPilot() {
    autoPilot ? stopAutoPilot() : startAutoPilot();
  }

  // --- Hover readout: show node info as a tasteful overlay.
  const cosmosReadout = document.getElementById('cosmosReadout');
  let _cosmosReadoutHide = null;
  function showCosmosReadout(nodeId) {
    if (!cosmosReadout) return;
    const n = nodeLookup[nodeId];
    if (!n) return hideCosmosReadout();
    let metaHtml = '';
    let textHtml = '';
    if (n.type === 'hlr') {
      metaHtml = `${escapeHtml(n.category)} · Topic ${escapeHtml(n.topic)} · ${escapeHtml(n.topic_title)}`;
      textHtml = applyGlossary(escapeHtml((n.text || '').slice(0, 280) + ((n.text || '').length > 280 ? '…' : '')));
    } else if (n.type === 'topic') {
      metaHtml = `Topic · ${n.hlr_count} HLRs`;
      textHtml = applyGlossary(escapeHtml(n.topic_title)) + (n.narrative ? '<br><em style="color:rgba(180,200,240,0.6);">— narrative available</em>' : '');
    } else if (n.type === 'ts') {
      metaHtml = `Technical Specification`;
      textHtml = escapeHtml(n.title || '');
    } else if (n.type === 'legal') {
      metaHtml = `Legal · ${escapeHtml(n.year)} · ${escapeHtml(n.kind)}`;
      textHtml = escapeHtml(n.title || '');
    } else if (n.type === 'disc') {
      metaHtml = `Discussion paper${n.is_rr ? ' · 2026 Refinement Round' : ''}`;
      textHtml = escapeHtml(n.title || '');
    }
    cosmosReadout.innerHTML = `
      <div class="ro-id">${escapeHtml(n.label || n.id)}</div>
      <div class="ro-meta">${metaHtml}</div>
      <div class="ro-text">${textHtml}</div>
    `;
    cosmosReadout.classList.add('show');
    if (_cosmosReadoutHide) clearTimeout(_cosmosReadoutHide);
  }
  function hideCosmosReadout() {
    if (!cosmosReadout) return;
    if (_cosmosReadoutHide) clearTimeout(_cosmosReadoutHide);
    _cosmosReadoutHide = setTimeout(() => cosmosReadout.classList.remove('show'), 100);
  }

  // --- Keyboard (single consolidated handler — no race between cosmos-on
  // and cosmos-off handlers fighting over the F key).
  function onCosmosKey(e) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return; // never hijack modifier-combos
    const k = e.key.toLowerCase();

    if (isCosmos()) {
      // In cosmos: handle cosmos-mode keys, eat the event so nothing else
      // sees the keypress.
      if (k === 'escape') {
        e.preventDefault();
        if (activeTour != null) { clearTour(); }
        else if (autoPilot) { stopAutoPilot(); }
        else { exitCosmos(); }
        return;
      }
      if (k === 'f') { e.preventDefault(); exitCosmos(); return; }
      if (k === 'c') { e.preventDefault(); toggleAutoPilot(); return; }
      if (k === ' ') {
        if (autoPilot) {
          e.preventDefault();
          autoPilotPaused = !autoPilotPaused;
          showToast(autoPilotPaused ? 'Auto-pilot paused' : 'Auto-pilot resumed');
        }
        return;
      }
      if (k === 'r') {
        e.preventDefault();
        clearTour();
        try { cy.fit(undefined, 100); } catch (err) {}
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < TOUR_STOPS.length) { e.preventDefault(); activateTour(idx); }
      }
      return;
    }

    // Not in cosmos: F enters (when no modal is open).
    if (k === 'f'
        && !document.querySelector('.atlas-overlay.open, .quiz-overlay.open, .help-overlay.open, .palette-overlay.open')) {
      e.preventDefault();
      enterCosmos();
    }
  }

  // Hover behaviour: spotlight + readout.
  cy.on('mouseover', 'node', evt => {
    if (!isCosmos()) return;
    const node = evt.target;
    cosmosHoverEl = node.id();
    showCosmosReadout(cosmosHoverEl);
    if (activeTour != null) return; // don't override tour spotlight
    cy.batch(() => {
      cy.nodes().not(node.closedNeighborhood()).addClass('cosmos-dim');
      node.closedNeighborhood().removeClass('cosmos-dim').addClass('cosmos-hover');
    });
  });
  cy.on('mouseout', 'node', evt => {
    if (!isCosmos()) return;
    cosmosHoverEl = null;
    hideCosmosReadout();
    if (activeTour != null) return;
    cy.elements().removeClass('cosmos-hover cosmos-dim');
  });
  // Click in cosmos: focus + open detail (keep the existing focusNode behavior).
  cy.on('tap', 'node', evt => {
    if (!isCosmos()) return;
    // Don't push history — cosmos navigation is exploratory.
    detailSuppressHistory = true;
    focusNode(evt.target.id());
    detailSuppressHistory = false;
  });
  // Click empty space → clear tour
  cy.on('tap', evt => {
    if (!isCosmos()) return;
    if (evt.target === cy && activeTour != null) clearTour();
  });

  // Render tour + stats once at module-load (they don't depend on cosmos state).
  // Doing this here (instead of inside enterCosmos) avoids the async-await
  // gap when entering cosmos.
  renderCosmosTour();
  renderCosmosStats();

  // Wire the launcher button + a SINGLE consolidated keyboard handler (used
  // both for entering and exiting). The handler stays attached for the page's
  // life — no bind/unbind ping-pong on enter/exit.
  document.getElementById('cosmosLauncher').addEventListener('click', toggleCosmos);
  document.getElementById('cosmosExit').addEventListener('click', exitCosmos);
  document.addEventListener('keydown', onCosmosKey);
  // Exit cosmos if user leaves browser fullscreen via Esc or system gesture.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isCosmos()) exitCosmos();
  });
