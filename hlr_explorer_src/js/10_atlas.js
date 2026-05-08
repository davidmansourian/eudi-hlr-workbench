  // ============================================================
  // Path Atlas — coverage matrix + reverse lookup
  // ============================================================
  const atlasOverlay = document.getElementById('atlasOverlay');
  const atlasSearch = document.getElementById('atlasSearch');
  const atlasResults = document.getElementById('atlasResults');
  const atlasMatrixWrap = document.getElementById('atlasMatrixWrap');
  const atlasPathCards = document.getElementById('atlasPathCards');
  const atlasStat = document.getElementById('atlasStat');
  let atlasTypeFilter = 'all';
  let atlasTargetId = null; // currently focused HLR/topic/TS/legal id

  // pathCoverage(path) → { hlrs, topics, ts, legal, stepsByTarget }
  // stepsByTarget maps node-id → [step indices that cover it]
  function pathCoverage(path) {
    const hlrs = new Set();
    const topics = new Set();
    const tsSet = new Set();
    const legalSet = new Set();
    const stepsByTarget = {}; // id → [stepIdx]

    const recordStep = (stepIdx, ids) => {
      ids.forEach(id => {
        if (!id) return;
        if (!stepsByTarget[id]) stepsByTarget[id] = [];
        if (!stepsByTarget[id].includes(stepIdx)) stepsByTarget[id].push(stepIdx);
      });
    };

    path.steps.forEach((step, idx) => {
      const ids = [step.primary, ...(step.covers || [])].filter(Boolean);
      const expanded = new Set();
      ids.forEach(id => {
        const n = nodeLookup[id];
        if (n) {
          expanded.add(id);
          if (n.type === 'hlr') {
            hlrs.add(id);
            topics.add(n.topic);
            // Also expose the HLR's topic / ts / legal as covered targets so the
            // search matches "I want to learn TS3" → paths that cover any HLR with TS3.
            (n.ts || []).forEach(t => tsSet.add(t));
            (n.legal || []).forEach(l => legalSet.add(l));
          } else if (n.type === 'topic') {
            topics.add(n.topic);
            (n.ts || []).forEach(t => tsSet.add(t));
            (n.legal || []).forEach(l => legalSet.add(l));
          } else if (n.type === 'ts') {
            tsSet.add(n.label);
          } else if (n.type === 'legal') {
            legalSet.add(n.label);
          }
        } else if (id.startsWith('feat_')) {
          const feat = (HLR_DATA.features || []).find(f => f.id === id);
          if (feat) {
            (feat.key_hlrs || []).forEach(h => { if (nodeLookup[h]) { hlrs.add(h); expanded.add(h); topics.add(nodeLookup[h].topic); } });
            (feat.primary_topics || []).forEach(t => { topics.add(t); expanded.add('topic_' + t); });
            (feat.ts || []).forEach(t => { tsSet.add(t); expanded.add('ts_' + t); });
            (feat.legal || []).forEach(l => { legalSet.add(l); const aid = legalAliases[l]; if (aid) expanded.add(aid); });
            expanded.add(id);
          }
        }
      });
      recordStep(idx, [...expanded]);
    });

    // Inflate topic-level membership for ts/legal so a search for "ts_TS3" matches paths that touch topic 9.
    topics.forEach(tn => {
      const topicNode = nodeLookup['topic_' + tn];
      if (topicNode) {
        (topicNode.ts || []).forEach(t => {
          tsSet.add(t);
          // Also bind step refs: if any step covers this topic, treat the TS id as covered.
          path.steps.forEach((step, idx) => {
            const stepIds = new Set([step.primary, ...(step.covers || [])]);
            if (stepIds.has('topic_' + tn) || (stepIds.has(step.primary) && nodeLookup[step.primary] && nodeLookup[step.primary].topic === tn)) {
              if (!stepsByTarget['ts_' + t]) stepsByTarget['ts_' + t] = [];
              if (!stepsByTarget['ts_' + t].includes(idx)) stepsByTarget['ts_' + t].push(idx);
            }
          });
        });
        (topicNode.legal || []).forEach(l => {
          legalSet.add(l);
          const aid = legalAliases[l];
          if (!aid) return;
          path.steps.forEach((step, idx) => {
            const stepIds = new Set([step.primary, ...(step.covers || [])]);
            if (stepIds.has('topic_' + tn) || (stepIds.has(step.primary) && nodeLookup[step.primary] && nodeLookup[step.primary].topic === tn)) {
              if (!stepsByTarget[aid]) stepsByTarget[aid] = [];
              if (!stepsByTarget[aid].includes(idx)) stepsByTarget[aid].push(idx);
            }
          });
        });
      }
    });

    return {
      hlrs: [...hlrs],
      topics: [...topics],
      ts: [...tsSet],
      legal: [...legalSet],
      stepsByTarget,
    };
  }

  // Topic-level coverage counts: returns {pathId: {topic: count}} for the matrix.
  function buildMatrixCounts() {
    const result = {};
    const allTopics = new Set();
    (HLR_DATA.paths || []).forEach(path => {
      const cov = pathCoverage(path);
      const counts = {};
      cov.hlrs.forEach(hid => {
        const n = nodeLookup[hid];
        if (!n) return;
        counts[n.topic] = (counts[n.topic] || 0) + 1;
        allTopics.add(n.topic);
      });
      // Also capture topics that are referenced directly without HLRs
      cov.topics.forEach(t => {
        if (!counts[t]) counts[t] = 0;
        allTopics.add(t);
      });
      result[path.id] = counts;
    });
    return { counts: result, topics: [...allTopics].sort((a, b) => +a - +b) };
  }

  function intensityClass(count) {
    if (count === 0) return 'empty';
    if (count === 1) return 'lvl1';
    if (count <= 3) return 'lvl2';
    if (count <= 6) return 'lvl3';
    return 'lvl4';
  }

  function pathTopicProgressMark(path, topic) {
    // For each topic cell, what fraction of the steps that touch this topic are done?
    let touched = 0, done = 0;
    path.steps.forEach((step, idx) => {
      const ids = new Set([step.primary, ...(step.covers || [])].filter(Boolean));
      let stepTouchesTopic = false;
      ids.forEach(id => {
        const n = nodeLookup[id];
        if (n && (n.type === 'hlr' || n.type === 'topic') && n.topic === topic) stepTouchesTopic = true;
      });
      if (stepTouchesTopic) {
        touched++;
        if (personal.getStepDone(path.id, idx)) done++;
      }
    });
    if (!touched) return null;
    if (done === touched) return 'complete';
    if (done > 0) return 'in-progress';
    return null;
  }

  function renderAtlasMatrix(highlightTopics, highlightPaths) {
    const { counts, topics } = buildMatrixCounts();
    const paths = HLR_DATA.paths || [];
    if (!topics.length || !paths.length) {
      atlasMatrixWrap.innerHTML = '<div class="atlas-empty">No path coverage data available.</div>';
      return;
    }
    let h = '<table class="atlas-matrix"><thead><tr><th class="path-col"></th>';
    topics.forEach(t => {
      const tn = nodeLookup['topic_' + t];
      const title = tn ? `T${t} · ${tn.topic_title}` : 'T' + t;
      h += `<th class="topic-col" title="${escapeHtml(title)}" data-jump="topic_${escapeHtml(t)}">T${escapeHtml(t)}</th>`;
    });
    h += '<th class="row-totals">Σ</th></tr></thead><tbody>';
    paths.forEach(path => {
      const cellsCount = topics.reduce((acc, t) => acc + (counts[path.id][t] || 0), 0);
      const isHighlightedPath = !highlightPaths || highlightPaths.has(path.id);
      const rowOpacity = isHighlightedPath ? '' : 'style="opacity:0.35;"';
      h += `<tr ${rowOpacity}><td class="path-col" data-path="${escapeHtml(path.id)}" title="Click to open"><span class="icon">${escapeHtml(path.icon)}</span>${escapeHtml(path.name)}</td>`;
      topics.forEach(t => {
        const c = counts[path.id][t] || 0;
        const cls = intensityClass(c);
        const progress = c > 0 ? pathTopicProgressMark(path, t) : null;
        const progClass = progress === 'complete' ? ' complete' : (progress === 'in-progress' ? ' in-progress' : '');
        const targetClass = (highlightTopics && highlightTopics.has(t)) ? ' target-match' : '';
        const cellTitle = c > 0
          ? `${path.name} · T${t} · ${c} HLR${c === 1 ? '' : 's'} covered${progress ? ' · ' + progress : ''}`
          : `${path.name} · T${t} · not covered`;
        h += `<td class="cell ${cls}${progClass}${targetClass}" data-path="${escapeHtml(path.id)}" data-topic="${escapeHtml(t)}" title="${escapeHtml(cellTitle)}">${c || ''}</td>`;
      });
      h += `<td class="row-totals">${cellsCount}</td></tr>`;
    });
    h += '</tbody></table>';
    atlasMatrixWrap.innerHTML = h;

    atlasMatrixWrap.querySelectorAll('.cell').forEach(td => {
      if (td.classList.contains('empty')) return;
      td.addEventListener('click', () => {
        const pid = td.dataset.path;
        const t = td.dataset.topic;
        activatePathById(pid);
        closeAtlas();
        // Filter graph to that topic
        activeTopics.clear();
        activeTopics.add(t);
        document.querySelectorAll('#topicFilters .filter-pill').forEach(p => p.classList.toggle('active', p.dataset.topic === t));
        applyFilters();
        focusNode('topic_' + t);
      });
    });
    atlasMatrixWrap.querySelectorAll('[data-path]:not(.cell)').forEach(td => {
      td.addEventListener('click', () => {
        const pid = td.dataset.path;
        activatePathById(pid);
        closeAtlas();
      });
    });
    atlasMatrixWrap.querySelectorAll('[data-jump]').forEach(th => {
      th.addEventListener('click', () => { focusNode(th.dataset.jump); closeAtlas(); });
    });
  }

  function renderAtlasPathCards() {
    const paths = HLR_DATA.paths || [];
    let h = '';
    paths.forEach(path => {
      const cov = pathCoverage(path);
      const prog = personal.pathProgress(path);
      const minutesText = path.estimated_minutes >= 60 ? `~${Math.round(path.estimated_minutes / 60)}h` : `~${path.estimated_minutes}min`;
      const isComplete = prog.done === prog.total && prog.total > 0;
      h += `
        <div class="atlas-path-card ${isComplete ? 'complete' : ''}">
          <div class="atlas-path-card-head">
            <span class="icon">${escapeHtml(path.icon)}</span>
            <span style="flex:1;">${escapeHtml(path.name)}</span>
          </div>
          <div class="atlas-path-card-meta">
            <span>${minutesText}</span>
            <span>·</span>
            <span>${path.steps.length} steps</span>
          </div>
          <div class="atlas-path-card-summary">${escapeHtml(path.summary)}</div>
          <div class="atlas-path-card-stats">
            <div class="stat"><span class="num">${cov.hlrs.length}</span><span class="lbl">HLRs</span></div>
            <div class="stat"><span class="num">${cov.topics.length}</span><span class="lbl">Topics</span></div>
            <div class="stat"><span class="num">${cov.ts.length}</span><span class="lbl">TS</span></div>
            <div class="stat"><span class="num">${cov.legal.length}</span><span class="lbl">Legal</span></div>
          </div>
          <div class="atlas-path-card-progress">
            <div class="bar"><div class="fill" style="width:${prog.pct}%"></div></div>
            <span class="pct">${prog.pct}%</span>
          </div>
          <div class="atlas-path-card-actions">
            <button class="open-btn" data-path-open="${escapeHtml(path.id)}">${prog.done > 0 && !isComplete ? 'Continue' : (isComplete ? 'Review' : 'Open')}</button>
            <button class="focus-btn" data-path-focus="${escapeHtml(path.id)}" title="Show only this path's HLRs in the graph">Focus graph</button>
          </div>
        </div>
      `;
    });
    atlasPathCards.innerHTML = h;

    atlasPathCards.querySelectorAll('[data-path-open]').forEach(btn => {
      btn.addEventListener('click', () => { activatePathById(btn.dataset.pathOpen); closeAtlas(); });
    });
    atlasPathCards.querySelectorAll('[data-path-focus]').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = (HLR_DATA.paths || []).find(p => p.id === btn.dataset.pathFocus);
        if (!path) return;
        const cov = pathCoverage(path);
        const ids = new Set(cov.hlrs);
        cov.topics.forEach(t => ids.add('topic_' + t));
        cov.ts.forEach(t => ids.add('ts_' + t));
        cov.legal.forEach(l => { const aid = legalAliases[l]; if (aid) ids.add(aid); });
        // Silently clear any active lens so our focus isn't overridden by lens-applyFilters.
        if (activeLens) {
          activeLens = null;
          renderActiveLens();
          renderFeatureList();
        }
        cy.batch(() => {
          cy.nodes().forEach(node => {
            node.style('display', ids.has(node.id()) ? 'element' : 'none');
          });
        });
        const eles = cy.collection();
        ids.forEach(id => { const n = cy.getElementById(id); if (!n.empty()) eles.merge(n); });
        if (eles.length) cy.fit(eles, 60);
        document.getElementById('statPill').textContent = `Path focus · ${cov.hlrs.length} HLRs · ${path.name}`;
        closeAtlas();
        showToast(`Graph focused: ${path.name}. Click "Reset view" to clear.`);
      });
    });
  }

  function renderAtlasStat() {
    const paths = HLR_DATA.paths || [];
    const allHlrs = new Set();
    let totalSteps = 0, totalMin = 0;
    paths.forEach(p => {
      pathCoverage(p).hlrs.forEach(h => allHlrs.add(h));
      totalSteps += p.steps.length;
      totalMin += p.estimated_minutes || 0;
    });
    const totalH = (totalMin / 60).toFixed(1);
    atlasStat.textContent = `${paths.length} paths · ${allHlrs.size} unique HLRs · ${totalSteps} steps · ~${totalH}h`;
  }

  function searchAtlasTargets(q) {
    if (!q) return [];
    const lower = q.toLowerCase().trim();
    const results = [];
    HLR_DATA.nodes.forEach(n => {
      if (atlasTypeFilter !== 'all' && n.type !== atlasTypeFilter) return;
      let score = 0;
      const idLower = (n.id || '').toLowerCase();
      const labelLower = (n.label || '').toLowerCase();
      const titleLower = (n.title || n.topic_title || '').toLowerCase();
      const textLower = (typeof n.text === 'string' ? n.text : '').toLowerCase();
      if (idLower === lower) score += 1000;
      else if (idLower.startsWith(lower)) score += 500;
      else if (idLower.includes(lower)) score += 200;
      if (labelLower === lower) score += 800;
      else if (labelLower.startsWith(lower)) score += 400;
      else if (labelLower.includes(lower)) score += 150;
      if (titleLower.includes(lower)) score += 80;
      if (textLower.includes(lower)) score += 30;
      if (n.type === 'topic' && (lower === 'topic ' + n.topic || lower === 't' + n.topic || lower === n.topic)) score += 700;
      if (score > 0) results.push({ n, score });
    });
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 8).map(r => r.n);
  }

  function pathsCovering(targetId) {
    // Returns [{ path, stepIndices, prog, depth }] for paths whose stepsByTarget includes target.
    const out = [];
    (HLR_DATA.paths || []).forEach(path => {
      const cov = pathCoverage(path);
      const stepIndices = cov.stepsByTarget[targetId] || [];
      if (!stepIndices.length) return;
      const prog = personal.pathProgress(path);
      // depth = how directly the path covers it: lower index in steps = earlier
      // exposure; ratio of covering-steps/total = how much of the path is on it.
      const depthRatio = stepIndices.length / path.steps.length;
      out.push({ path, stepIndices, prog, depthRatio });
    });
    out.sort((a, b) => {
      // 1) prefer paths with higher depthRatio (more focused)
      if (b.depthRatio !== a.depthRatio) return b.depthRatio - a.depthRatio;
      // 2) prefer shorter paths
      return a.path.steps.length - b.path.steps.length;
    });
    return out;
  }

  function renderAtlasResults() {
    const q = atlasSearch.value.trim();
    if (!q) {
      atlasResults.classList.remove('show');
      atlasResults.innerHTML = '';
      atlasTargetId = null;
      // Re-render matrix without highlight
      renderAtlasMatrix(null, null);
      return;
    }
    const candidates = searchAtlasTargets(q);
    if (!candidates.length) {
      atlasResults.classList.add('show');
      atlasResults.innerHTML = `<div class="atlas-empty">No matches for <strong>${escapeHtml(q)}</strong>. Try an HLR ID like <strong>WIAM_14</strong>, a topic like <strong>topic 9</strong>, or a TS like <strong>TS3</strong>.</div>`;
      renderAtlasMatrix(null, null);
      return;
    }
    // Pick top result as target
    const target = candidates[0];
    atlasTargetId = target.id;
    const others = candidates.slice(1, 6);

    // Compute a meaningful summary for the target
    const summaryHtml = (() => {
      if (target.type === 'hlr') return `<span class="target-meta">HLR · T${escapeHtml(target.topic)} · ${escapeHtml(target.topic_title)}</span>`;
      if (target.type === 'topic') return `<span class="target-meta">Topic · ${escapeHtml(target.topic_title)} · ${target.hlr_count} HLRs</span>`;
      if (target.type === 'ts') return `<span class="target-meta">TS · ${escapeHtml(target.title || '')}</span>`;
      if (target.type === 'legal') return `<span class="target-meta">${escapeHtml(target.title || '')} (${escapeHtml(target.year || '')})</span>`;
      return '';
    })();

    const covering = pathsCovering(target.id);

    let html = `<h3>Find a path to learn <strong style="color:var(--text);">${escapeHtml(target.label || target.id)}</strong></h3>`;
    html += `<div class="atlas-result-target">
      <span class="id">${escapeHtml(target.label || target.id)}</span>
      ${summaryHtml}
      <button style="margin-left:auto;" class="open-link" data-jump-target="${escapeHtml(target.id)}">Open in graph →</button>
    </div>`;

    if (!covering.length) {
      html += `<div class="atlas-empty">No path currently covers <strong>${escapeHtml(target.label || target.id)}</strong>. Reading the requirement directly is the fastest route — click "Open in graph" above.</div>`;
    } else {
      html += `<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">${covering.length} path${covering.length === 1 ? '' : 's'} cover this${covering.length > 1 ? ' — sorted by focus' : ''}:</div>`;
      html += '<div class="atlas-paths-list">';
      covering.forEach(({ path, stepIndices, prog, depthRatio }) => {
        const stepsLabel = stepIndices.length === 1 ? `step ${stepIndices[0] + 1}` : `steps ${stepIndices.map(i => i + 1).join(', ')}`;
        const focusPct = Math.round(depthRatio * 100);
        html += `<div class="atlas-path-row">
          <span class="icon">${escapeHtml(path.icon)}</span>
          <div>
            <div class="name">${escapeHtml(path.name)}</div>
            <div class="step-refs">${escapeHtml(stepsLabel)} · ${focusPct}% of path on this</div>
          </div>
          <div class="progress-mini">
            <div class="progress-mini-bar"><div class="fill" style="width:${prog.pct}%"></div></div>
            ${prog.pct}%
          </div>
          <button class="open-link" data-path-step="${escapeHtml(path.id)}|${stepIndices[0]}">Jump →</button>
          <button class="open-link" style="background:var(--bg-soft);color:var(--text-muted);" data-path-open="${escapeHtml(path.id)}">Open path</button>
        </div>`;
      });
      html += '</div>';
    }

    if (others.length) {
      html += `<div style="margin-top:14px;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-subtle);font-weight:700;margin-bottom:6px;">Other matches</div><div class="atlas-paths-list">`;
      others.forEach(o => {
        const oCov = pathsCovering(o.id);
        html += `<div class="atlas-path-row" data-other-target="${escapeHtml(o.id)}" style="cursor:pointer;">
          <span class="icon" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent);">${escapeHtml(o.label || o.id)}</span>
          <div>
            <div class="step-refs" style="color:var(--text);font-family:'Inter',sans-serif;font-weight:500;">${escapeHtml(o.title || o.topic_title || '')}</div>
            <div class="step-refs">${oCov.length} path${oCov.length === 1 ? '' : 's'} cover this</div>
          </div>
          <span style="font-size:10px;color:var(--text-subtle);">${escapeHtml((o.type || '').toUpperCase())}</span>
          <span></span>
          <button class="open-link" data-pick="${escapeHtml(o.id)}">Pick</button>
        </div>`;
      });
      html += '</div>';
    }

    atlasResults.classList.add('show');
    atlasResults.innerHTML = html;

    atlasResults.querySelectorAll('[data-jump-target]').forEach(btn => {
      btn.addEventListener('click', () => { focusNode(btn.dataset.jumpTarget); closeAtlas(); });
    });
    atlasResults.querySelectorAll('[data-path-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [pid, idx] = btn.dataset.pathStep.split('|');
        activatePathById(pid);
        closeAtlas();
        // After activation, scroll the step into view in the panel
        setTimeout(() => {
          const stepEl = document.querySelector(`#pathActiveBox .path-step[data-step-idx="${idx}"]`);
          if (stepEl) {
            stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            stepEl.style.transition = 'box-shadow 0.3s ease';
            stepEl.style.boxShadow = '0 0 0 3px var(--accent)';
            setTimeout(() => { stepEl.style.boxShadow = ''; }, 1500);
          }
        }, 80);
      });
    });
    atlasResults.querySelectorAll('[data-path-open]').forEach(btn => {
      btn.addEventListener('click', () => { activatePathById(btn.dataset.pathOpen); closeAtlas(); });
    });
    atlasResults.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.pick;
        const n = nodeLookup[id];
        if (n) { atlasSearch.value = n.label || n.id; renderAtlasResults(); }
      });
    });
    atlasResults.querySelectorAll('[data-other-target]').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.dataset.pick) return;
        const id = row.dataset.otherTarget;
        const n = nodeLookup[id];
        if (n) { atlasSearch.value = n.label || n.id; renderAtlasResults(); }
      });
    });

    // Highlight in matrix: if target is HLR, highlight its topic; if topic, highlight that
    let highlightTopics = new Set();
    let highlightPaths = new Set(covering.map(c => c.path.id));
    if (target.type === 'hlr') highlightTopics.add(target.topic);
    else if (target.type === 'topic') highlightTopics.add(target.topic);
    renderAtlasMatrix(highlightTopics, highlightPaths.size ? highlightPaths : null);
  }

  function openAtlas() {
    renderAtlasStat();
    renderAtlasMatrix(null, null);
    renderAtlasPathCards();
    atlasSearch.value = '';
    atlasResults.classList.remove('show');
    atlasResults.innerHTML = '';
    atlasOverlay.classList.add('open');
    setTimeout(() => atlasSearch.focus(), 50);
  }

  function closeAtlas() {
    atlasOverlay.classList.remove('open');
  }

