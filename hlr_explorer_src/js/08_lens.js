  // ============================================================
  // Tabs (Filters / Lens)
  // ============================================================
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + target));
    });
  });

  // ============================================================
  // Compliance Lens
  // ============================================================
  let activeLens = null;

  function hlrsForFeature(feat) {
    const set = new Set();
    HLR_DATA.nodes.forEach(n => {
      if (n.type !== 'hlr') return;
      const inTopic = (feat.primary_topics || []).includes(n.topic);
      const inPrefix = (feat.primary_prefixes || []).includes(n.prefix);
      const inKey = (feat.key_hlrs || []).includes(n.id);
      if (inTopic || inPrefix || inKey) set.add(n.id);
    });
    return [...set];
  }

  function featureCoverage(feat) {
    const hlrIds = hlrsForFeature(feat);
    let started = 0, impl = 0, verified = 0, none = 0, empty = 0;
    hlrIds.forEach(id => {
      const n = nodeLookup[id];
      if (n.is_empty) { empty++; return; }
      const s = personal.getStatus(id);
      if (s === 'started') started++;
      else if (s === 'implemented') impl++;
      else if (s === 'verified') verified++;
      else none++;
    });
    return { total: hlrIds.length, started, impl, verified, none, empty, hlrIds };
  }

  function renderFeatureList() {
    const el = document.getElementById('lensFeatureList');
    el.innerHTML = '';
    HLR_DATA.features.forEach(feat => {
      const card = document.createElement('div');
      card.className = 'feature-card' + (activeLens && activeLens.id === feat.id ? ' active' : '');
      const ri = feat.reference_impl;
      const refBadge = ri ? `<div style="margin-top:6px;">${renderRefStatusBadge(ri.status, null, null)}</div>` : '';
      card.innerHTML = `
        <div class="feature-card-head">
          <span class="icon">${escapeHtml(feat.icon)}</span>
          <span>${escapeHtml(feat.name)}</span>
        </div>
        <div class="feature-card-summary">${glossifyText(feat.summary.slice(0, 130))}${feat.summary.length > 130 ? '…' : ''}</div>
        ${refBadge}
      `;
      card.addEventListener('click', () => activateLens(feat));
      el.appendChild(card);
    });
  }

  function renderActiveLens() {
    const box = document.getElementById('lensActiveBox');
    if (!activeLens) { box.innerHTML = ''; document.getElementById('lensBadge').style.display = 'none'; return; }
    document.getElementById('lensBadge').style.display = '';
    const cov = featureCoverage(activeLens);
    const pct = cov.total ? Math.round(((cov.impl + cov.verified) / cov.total) * 100) : 0;
    const tsHtml = (activeLens.ts || []).map(t => `<span class="detail-tag" data-jump="ts_${escapeHtml(t)}">${escapeHtml(t)}</span>`).join(' ');
    const legalHtml = (activeLens.legal || []).map(l => {
      const aliasId = legalAliases[l];
      return `<span class="detail-tag" ${aliasId ? `data-jump="${aliasId}"` : ''}>${escapeHtml(l)}</span>`;
    }).join(' ');
    const extHtml = (activeLens.external_specs || []).map(e => `<span class="detail-tag" style="background:var(--bg-soft);color:var(--text-muted);">${escapeHtml(e)}</span>`).join(' ');

    const refImplHtml = activeLens.reference_impl ? `
        <div style="margin: 8px 0 12px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-subtle);font-weight:700;margin-bottom:4px;">Reference implementation</div>
          ${renderRefStatusBadge(activeLens.reference_impl.status, activeLens.reference_impl.name, activeLens.reference_impl.roadmap_specific || activeLens.reference_impl.roadmap_url)}
        </div>` : '';

    box.innerHTML = `
      <div class="feature-active-panel">
        <div class="feature-active-head">
          <span class="icon">${escapeHtml(activeLens.icon)}</span>
          <div class="feature-active-name">${escapeHtml(activeLens.name)}</div>
        </div>
        <div class="feature-summary">${glossifyText(activeLens.summary)}</div>

        ${refImplHtml}

        <div class="coverage-summary">
          <div class="pct">${pct}<span style="font-size:14px;">%</span></div>
          <div class="pct-label">Implemented or verified · ${cov.impl + cov.verified} / ${cov.total - cov.empty} non-empty HLRs</div>
        </div>

        <div class="coverage-bars">
          ${[
            ['Verified', cov.verified, 'verified'],
            ['Implemented', cov.impl, 'implemented'],
            ['In progress', cov.started, 'started'],
            ['Not started', cov.none, 'not-started'],
          ].map(([label, count, cls]) => {
            const w = cov.total ? Math.max(2, Math.round(count / cov.total * 100)) : 0;
            return `<div class="coverage-row">
              <div class="coverage-label">${label}</div>
              <div class="coverage-bar-bg"><div class="coverage-bar ${cls}" style="width:${count ? w : 0}%"></div></div>
              <div class="coverage-count">${count}</div>
            </div>`;
          }).join('')}
        </div>

        ${tsHtml ? `<div style="margin:10px 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-subtle);font-weight:700;">Implementing TS</div><div>${tsHtml}</div>` : ''}
        ${legalHtml ? `<div style="margin:10px 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-subtle);font-weight:700;">Legal basis</div><div>${legalHtml}</div>` : ''}
        ${extHtml ? `<div style="margin:10px 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-subtle);font-weight:700;">External specs</div><div>${extHtml}</div>` : ''}

        <div class="feature-actions">
          <button class="btn-primary" id="exportReportBtn">Copy report</button>
          <button class="btn-secondary" id="exitLensBtn">Exit lens</button>
        </div>
      </div>
    `;
    box.querySelectorAll('[data-jump]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); focusNode(el.dataset.jump); });
    });
    document.getElementById('exportReportBtn').addEventListener('click', () => exportLensReport(activeLens));
    document.getElementById('exitLensBtn').addEventListener('click', deactivateLens);
  }

  function activateLens(feat) {
    activeLens = feat;
    renderActiveLens();
    renderFeatureList();
    applyFilters();
    // Pan/zoom to fit lens nodes
    const ids = hlrsForFeature(feat);
    const eles = cy.collection();
    ids.forEach(id => { const n = cy.getElementById(id); if (!n.empty()) eles.merge(n); });
    if (eles.length > 0) cy.fit(eles, 60);
    showToast(`Lens: ${feat.name} — ${ids.length} HLRs`);
  }

  function deactivateLens() {
    activeLens = null;
    renderActiveLens();
    renderFeatureList();
    applyFilters();
    cy.fit(undefined, 30);
    showToast('Lens cleared');
  }

  function exportLensReport(feat) {
    const cov = featureCoverage(feat);
    const lines = [];
    lines.push(`# Compliance report — ${feat.name}`);
    lines.push(`*Generated ${new Date().toISOString().slice(0, 10)} via EUDI HLR Workbench.*`);
    lines.push('');
    lines.push(feat.summary);
    lines.push('');
    lines.push(`## Coverage`);
    const pct = cov.total ? Math.round(((cov.impl + cov.verified) / cov.total) * 100) : 0;
    lines.push(`- **${cov.total - cov.empty}** non-empty HLRs in scope (+ ${cov.empty} empty/placeholder)`);
    lines.push(`- **${cov.verified}** verified · **${cov.impl}** implemented · **${cov.started}** in progress · **${cov.none}** not started`);
    lines.push(`- **${pct}%** implemented or verified`);
    lines.push('');

    const sections = [
      ['Verified', 'verified', cov.hlrIds.filter(id => personal.getStatus(id) === 'verified')],
      ['Implemented', 'implemented', cov.hlrIds.filter(id => personal.getStatus(id) === 'implemented')],
      ['In progress', 'started', cov.hlrIds.filter(id => personal.getStatus(id) === 'started')],
      ['Not started', 'none', cov.hlrIds.filter(id => personal.getStatus(id) === 'none' && !nodeLookup[id].is_empty)],
    ];
    sections.forEach(([label, status, ids]) => {
      if (!ids.length) return;
      lines.push(`### ${label} (${ids.length})`);
      ids.sort().forEach(id => {
        const n = nodeLookup[id];
        const file = personal.getFile(id);
        const notes = personal.getNotes(id);
        const summary = n.text.slice(0, 110) + (n.text.length > 110 ? '…' : '');
        lines.push(`- **${id}** — ${summary}`);
        if (file) lines.push(`  - Code: \`${file}\``);
        if (notes) lines.push(`  - Notes: ${notes.replace(/\n/g, ' ')}`);
      });
      lines.push('');
    });

    if (feat.ts && feat.ts.length) {
      lines.push(`## Technical Specifications`);
      feat.ts.forEach(t => lines.push(`- ${t} — ${(HLR_DATA.nodes.find(n => n.id === 'ts_' + t) || {}).title || ''}`));
      lines.push('');
    }
    if (feat.legal && feat.legal.length) {
      lines.push(`## Legal basis`);
      feat.legal.forEach(l => lines.push(`- ${l}`));
      lines.push('');
    }
    if (feat.external_specs && feat.external_specs.length) {
      lines.push(`## External specs`);
      feat.external_specs.forEach(e => lines.push(`- ${e}`));
      lines.push('');
    }

    const text = lines.join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast('Report copied to clipboard ✓'));
    } else {
      // Fallback: download as file
      const blob = new Blob([text], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-${feat.id}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Report downloaded');
    }
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // Override applyFilters to honour lens
  const origApplyFilters = applyFilters;
  applyFilters = function() {
    if (!activeLens) { origApplyFilters(); return; }
    const lensHlrIds = new Set(hlrsForFeature(activeLens));
    const lensTopics = new Set((activeLens.primary_topics || []));
    const lensTs = new Set((activeLens.ts || []).map(t => 'ts_' + t));
    const lensLegal = new Set((activeLens.legal || []).map(l => 'legal_' + l.replace(/ /g, '_').replace(/\//g, '-')));
    let visible = 0;
    cy.batch(() => {
      cy.nodes().forEach(node => {
        const n = nodeLookup[node.id()];
        if (!n) return;
        let show = false;
        if (n.type === 'hlr') show = lensHlrIds.has(n.id);
        else if (n.type === 'topic') show = lensTopics.has(n.topic);
        else if (n.type === 'ts') show = lensTs.has(n.id);
        else if (n.type === 'legal') show = lensLegal.has(n.id);
        if (show && n.type === 'hlr') visible++;
        node.style('display', show ? 'element' : 'none');
      });
    });
    document.getElementById('statPill').textContent =
      `Lens · ${visible} HLRs · ${activeLens.name}`;
  };

