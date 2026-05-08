  // ============================================================
  // Learning Paths
  // ============================================================
  let activePath = null;

  // Extend personal API for paths
  personal.getStepDone = (pathId, idx) => localStorage.getItem(PL_KEY_PREFIX + 'path:' + pathId + ':' + idx) === '1';
  personal.setStepDone = (pathId, idx, done) => {
    if (done) localStorage.setItem(PL_KEY_PREFIX + 'path:' + pathId + ':' + idx, '1');
    else localStorage.removeItem(PL_KEY_PREFIX + 'path:' + pathId + ':' + idx);
  };
  personal.getActivePath = () => localStorage.getItem(PL_KEY_PREFIX + 'path:active') || '';
  personal.setActivePath = (id) => { if (id) localStorage.setItem(PL_KEY_PREFIX + 'path:active', id); else localStorage.removeItem(PL_KEY_PREFIX + 'path:active'); };
  personal.pathProgress = (path) => {
    let done = 0;
    path.steps.forEach((_, i) => { if (personal.getStepDone(path.id, i)) done++; });
    return { done, total: path.steps.length, pct: path.steps.length ? Math.round(done / path.steps.length * 100) : 0 };
  };
  personal.getAutoSync = () => localStorage.getItem(PL_KEY_PREFIX + 'path:autoSync') === '1';
  personal.setAutoSync = (v) => { if (v) localStorage.setItem(PL_KEY_PREFIX + 'path:autoSync', '1'); else localStorage.removeItem(PL_KEY_PREFIX + 'path:autoSync'); };

  // Returns ids of HLRs touched by a step (primary + covers, expanding features into key_hlrs).
  function hlrsTouchedByStep(step) {
    const ids = new Set();
    const consider = id => {
      if (!id) return;
      const n = nodeLookup[id];
      if (n && n.type === 'hlr') { ids.add(id); return; }
      if (id.startsWith && id.startsWith('feat_')) {
        const feat = (HLR_DATA.features || []).find(f => f.id === id);
        if (feat) (feat.key_hlrs || []).forEach(h => { if (nodeLookup[h]) ids.add(h); });
      }
    };
    consider(step.primary);
    (step.covers || []).forEach(consider);
    return [...ids];
  }

  // When a step is marked complete and auto-sync is on, bump 'none' HLRs to 'started'.
  // Returns a list of HLR ids whose status changed (for undo / toast).
  function bumpHlrsForStep(step) {
    const bumped = [];
    hlrsTouchedByStep(step).forEach(id => {
      if (personal.getStatus(id) === 'none') {
        personal.setStatus(id, 'started');
        updateNodeStatusClasses(id);
        bumped.push(id);
      }
    });
    return bumped;
  }

  // Bulk apply: walk all completed steps in a path and bump their HLRs.
  function applyPathToHlrs(path) {
    const allBumped = new Set();
    path.steps.forEach((step, idx) => {
      if (!personal.getStepDone(path.id, idx)) return;
      hlrsTouchedByStep(step).forEach(id => {
        if (personal.getStatus(id) === 'none') {
          personal.setStatus(id, 'started');
          updateNodeStatusClasses(id);
          allBumped.add(id);
        }
      });
    });
    return [...allBumped];
  }

  function renderPathList() {
    const el = document.getElementById('pathList');
    if (!el) return;
    el.innerHTML = '';
    if (activePath) { el.style.display = 'none'; return; }
    el.style.display = '';

    const atlasBtn = document.createElement('button');
    atlasBtn.className = 'atlas-trigger';
    atlasBtn.innerHTML = '📊 Path Atlas — coverage map across all paths';
    atlasBtn.addEventListener('click', openAtlas);
    el.appendChild(atlasBtn);

    (HLR_DATA.paths || []).forEach(path => {
      const prog = personal.pathProgress(path);
      const card = document.createElement('div');
      card.className = 'feature-card';
      const progBadge = prog.done > 0 ? `<span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--status-verified);font-weight:600;">${prog.done}/${prog.total}</span>` : `<span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-subtle);">${prog.total} steps</span>`;
      const minutesText = path.estimated_minutes >= 60 ? `~${Math.round(path.estimated_minutes / 60)}h` : `~${path.estimated_minutes}min`;
      card.innerHTML = `
        <div class="feature-card-head">
          <span class="icon">${escapeHtml(path.icon)}</span>
          <span style="flex:1;">${escapeHtml(path.name)}</span>
          ${progBadge}
        </div>
        <div class="feature-card-summary">${escapeHtml(path.summary)}</div>
        <div style="margin-top:6px;font-size:10px;color:var(--text-subtle);display:flex;gap:10px;">
          <span style="font-family:'JetBrains Mono',monospace;">${minutesText}</span>
          <span>${escapeHtml(path.audience || '')}</span>
        </div>
      `;
      card.addEventListener('click', () => activatePathById(path.id));
      el.appendChild(card);
    });
  }

  function statusDotForId(id) {
    if (!nodeLookup[id] || nodeLookup[id].type !== 'hlr') return '';
    const st = personal.getStatus(id);
    if (st !== 'none') {
      const stcv = st === 'started' ? '--status-started' : (st === 'implemented' ? '--status-impl' : '--status-verified');
      return `<span class="chip-status-dot" style="background:var(${stcv});" title="${st}"></span>`;
    }
    if (personal.isBookmarked(id)) {
      return `<span class="chip-status-dot" style="background:var(--bookmark);" title="bookmarked"></span>`;
    }
    return '';
  }

  function renderActivePath() {
    const box = document.getElementById('pathActiveBox');
    const list = document.getElementById('pathList');
    if (!box) return;
    if (!activePath) { box.innerHTML = ''; document.getElementById('pathsBadge').style.display = 'none'; if (list) list.style.display = ''; return; }
    if (list) list.style.display = 'none';
    const prog = personal.pathProgress(activePath);
    document.getElementById('pathsBadge').style.display = '';
    document.getElementById('pathsBadge').textContent = `${prog.done}/${prog.total}`;
    const minutesText = activePath.estimated_minutes >= 60 ? `~${Math.round(activePath.estimated_minutes / 60)}h total` : `~${activePath.estimated_minutes}min total`;

    // Pre-compute how many "untouched" HLRs the bulk-apply button could bump.
    // De-dupe across steps — same HLR may appear in multiple steps.
    const pendingBulkSet = new Set();
    activePath.steps.forEach((step, idx) => {
      if (!personal.getStepDone(activePath.id, idx)) return;
      hlrsTouchedByStep(step).forEach(id => {
        if (personal.getStatus(id) === 'none') pendingBulkSet.add(id);
      });
    });
    const pendingBulk = pendingBulkSet.size;

    const stepsHtml = activePath.steps.map((step, idx) => {
      const done = personal.getStepDone(activePath.id, idx);
      const coversTags = (step.covers || []).map(cid => {
        const target = nodeLookup[cid];
        if (!target) return '';
        const cv = target.type === 'hlr' ? (CAT_COLOR_VAR[target.category] || '--text-subtle')
          : (target.type === 'topic' ? '--type-topic' : (target.type === 'ts' ? '--type-ts' : (target.type === 'legal' ? legalColorVar(target.kind) : '--accent')));
        return `<span class="detail-tag" data-jump="${escapeHtml(cid)}" style="background:color-mix(in srgb,var(${cv}) 14%,transparent);color:var(${cv});">${statusDotForId(cid)}${escapeHtml(target.label || cid)}</span>`;
      }).join(' ');
      const primaryExists = nodeLookup[step.primary] || (step.primary || '').startsWith('feat_');
      // Choose a verb for the Open button based on the primary node type so it's
      // clear what clicking does. Annotation is the *actual reading*; this is
      // just the in-map anchor.
      let openVerb = 'Open in map';
      if (primaryExists && step.primary) {
        const pn = nodeLookup[step.primary];
        if (pn) {
          if (pn.type === 'topic') openVerb = 'Open Topic in map';
          else if (pn.type === 'hlr') openVerb = 'Open HLR in map';
          else if (pn.type === 'ts') openVerb = 'Open TS in map';
          else if (pn.type === 'legal') openVerb = 'Open legal doc';
          else if (pn.type === 'disc') openVerb = 'Open disc paper';
        } else if (step.primary.startsWith('feat_')) {
          openVerb = 'Open feature lens';
        }
      }
      const openBtn = primaryExists
        ? `<button class="open-btn" data-jump="${escapeHtml(step.primary)}" title="Click to focus the primary node in the center map">${openVerb} →</button>`
        : '';
      return `
        <div class="path-step ${done ? 'complete' : ''}" data-step-idx="${idx}">
          <button class="path-step-check" data-toggle-step="${idx}" aria-label="Mark complete"></button>
          <div>
            <div class="path-step-num">Step ${idx + 1} of ${activePath.steps.length}</div>
            <div class="path-step-title">${escapeHtml(step.title)}</div>
            <div class="path-step-annotation"><span style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-right:6px;">What to do</span>${glossifyText(step.annotation)}</div>
            <div class="path-step-actions">
              ${openBtn}
              ${step.estimated_minutes ? `<span class="est">~${step.estimated_minutes}min</span>` : ''}
            </div>
            ${coversTags ? `<div class="path-step-covers"><span style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-subtle);margin-right:6px;">Touches</span>${coversTags}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const celebrate = prog.done === prog.total && prog.total > 0
      ? `<div class="path-celebrate"><div class="big">🎉 Path complete</div><div class="small">${prog.total} steps · ${minutesText}</div></div>`
      : '';

    const autoSyncOn = personal.getAutoSync();

    box.innerHTML = `
      <div class="path-active-panel">
        <div class="path-active-head">
          <span class="icon">${escapeHtml(activePath.icon)}</span>
          <div class="path-active-name">${escapeHtml(activePath.name)}</div>
          <button class="atlas-trigger in-active-path" id="atlasTriggerInline" title="Open Path Atlas">📊 Atlas</button>
        </div>
        <div class="path-meta-row">
          <span style="font-family:'JetBrains Mono',monospace;">${minutesText}</span>
          <span class="audience">${escapeHtml(activePath.audience || '')}</span>
        </div>

        ${celebrate}

        <div class="path-progress-summary">
          <div class="pct">${prog.pct}<span style="font-size:13px;">%</span></div>
          <div class="meta"><strong>${prog.done} of ${prog.total}</strong> steps complete<br><span style="color:var(--text-subtle);">Click the circle to mark a step done.</span></div>
        </div>
        <div class="path-bar-bg"><div class="path-bar" style="width:${prog.pct}%"></div></div>

        <details style="margin:10px 0 12px;font-size:11px;color:var(--text-muted);background:var(--bg-soft);padding:8px 10px;border-radius:6px;line-height:1.55;">
          <summary style="cursor:pointer;color:var(--text);font-weight:600;font-size:11px;">How to read a step</summary>
          <ul style="margin:6px 0 0 0;padding-left:16px;">
            <li><strong>What to do</strong> (the prose) is the actual reading. Some steps point to external files (e.g. the engineering briefing markdown), some to in-map nodes, some to hands-on activities.</li>
            <li><strong>Open … in map</strong> focuses the step's primary node in the centre graph — optional convenience.</li>
            <li><strong>Touches</strong> chips are related nodes — scan them, click any to dive in.</li>
            <li>HLR/topic/legal IDs inside the prose are clickable too. Acronyms have hover tooltips.</li>
            <li>Click the circle on the left to mark a step complete. Marking does <em>not</em> change HLR status unless auto-sync (below) is on.</li>
          </ul>
        </details>

        <div class="path-autosync-row">
          <label class="autosync-toggle">
            <input type="checkbox" id="autoSyncCheck" ${autoSyncOn ? 'checked' : ''}>
            <span class="autosync-track"></span>
            <span class="autosync-text">Auto-mark HLRs as <strong>in progress</strong> when I check off a step <span style="color:var(--text-subtle);font-size:10px;">(off by default — visiting an HLR never changes its status)</span></span>
          </label>
          <button class="path-bulk-btn" id="bulkApplyHlrs" ${pendingBulk === 0 ? 'disabled' : ''} title="${pendingBulk === 0 ? 'No HLRs to bump' : 'Mark ' + pendingBulk + ' HLRs covered by completed steps as in-progress'}">
            ${pendingBulk > 0 ? 'Mark ' + pendingBulk + ' as in-prog.' : 'Mark…'}
          </button>
        </div>

        ${stepsHtml}

        <div class="feature-actions">
          <button class="btn-secondary" id="exitPathBtn">Exit path</button>
          <button class="btn-secondary" id="resetPathBtn">Reset progress</button>
        </div>
      </div>
    `;

    box.querySelectorAll('[data-jump]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const id = el.dataset.jump;
        // feat_* are features, route to the lens instead of focusNode
        if (id.startsWith('feat_')) {
          const feat = (HLR_DATA.features || []).find(f => f.id === id);
          if (feat) {
            // Switch to lens tab and activate
            document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'lens'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-lens'));
            activateLens(feat);
          }
        } else {
          focusNode(id);
        }
      });
    });
    box.querySelectorAll('[data-toggle-step]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.dataset.toggleStep, 10);
        const wasDone = personal.getStepDone(activePath.id, idx);
        const becomingDone = !wasDone;
        personal.setStepDone(activePath.id, idx, becomingDone);

        // Auto-sync: when checking ON (not off) and toggle is enabled, bump HLRs.
        if (becomingDone && personal.getAutoSync()) {
          const bumped = bumpHlrsForStep(activePath.steps[idx]);
          if (bumped.length) {
            buildPersonalFilters();
            const sample = bumped.slice(0, 3).join(', ');
            const more = bumped.length > 3 ? ` (+${bumped.length - 3} more)` : '';
            showToast(`Bumped to in-progress: ${sample}${more}`);
          }
        }
        renderActivePath();
        renderPathList();
      });
    });

    const autoCheck = document.getElementById('autoSyncCheck');
    if (autoCheck) {
      autoCheck.addEventListener('change', () => {
        personal.setAutoSync(autoCheck.checked);
        showToast(autoCheck.checked ? 'Auto-sync ON · status bumps when steps complete' : 'Auto-sync OFF');
      });
    }

    const bulkBtn = document.getElementById('bulkApplyHlrs');
    if (bulkBtn) {
      bulkBtn.addEventListener('click', () => {
        if (bulkBtn.disabled) return;
        const bumped = applyPathToHlrs(activePath);
        if (bumped.length) {
          buildPersonalFilters();
          renderActivePath();
          showToast(`Applied: ${bumped.length} HLRs marked in-progress`);
        } else {
          showToast('Nothing to apply — all touched HLRs already have status');
        }
      });
    }

    const inlineAtlas = document.getElementById('atlasTriggerInline');
    if (inlineAtlas) inlineAtlas.addEventListener('click', openAtlas);

    document.getElementById('exitPathBtn').addEventListener('click', deactivatePath);
    document.getElementById('resetPathBtn').addEventListener('click', () => {
      if (!confirm('Clear progress for this path?')) return;
      activePath.steps.forEach((_, i) => personal.setStepDone(activePath.id, i, false));
      renderActivePath();
      renderPathList();
      showToast('Path progress reset');
    });
  }

  function activatePathById(id) {
    const path = (HLR_DATA.paths || []).find(p => p.id === id);
    if (!path) return;
    activePath = path;
    personal.setActivePath(id);
    // Switch to Paths tab so the user actually sees the activated path.
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'paths'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-paths'));
    renderActivePath();
    showToast(`Path: ${path.name}`);
  }

  function deactivatePath() {
    activePath = null;
    personal.setActivePath('');
    renderActivePath();
    renderPathList();
  }

  // Restore active path from localStorage on load
  const savedPath = personal.getActivePath();
  if (savedPath) {
    const found = (HLR_DATA.paths || []).find(p => p.id === savedPath);
    if (found) activePath = found;
  }

