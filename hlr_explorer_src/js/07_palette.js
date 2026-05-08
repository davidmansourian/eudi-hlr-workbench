  // ============================================================
  // Cmd-K Command Palette
  // ============================================================
  const overlay = document.getElementById('paletteOverlay');
  const paletteInput = document.getElementById('paletteInput');
  const paletteResults = document.getElementById('paletteResults');
  const paletteCount = document.getElementById('paletteCount');
  let paletteFocusedIdx = -1;
  let paletteCurrentResults = [];

  function openPalette() {
    overlay.classList.add('open');
    paletteInput.value = '';
    paletteFocusedIdx = -1;
    renderPalette('');
    setTimeout(() => paletteInput.focus(), 30);
  }
  function closePalette() {
    overlay.classList.remove('open');
  }

  function rankResults(q) {
    if (!q) {
      // Show recently-bookmarked + most-referenced HLRs by default
      const bookmarked = HLR_DATA.nodes.filter(n => n.type === 'hlr' && personal.isBookmarked(n.id));
      const popular = HLR_DATA.nodes.filter(n => n.type === 'hlr' && !n.is_empty)
        .sort((a, b) => (b.referenced_by || []).length - (a.referenced_by || []).length).slice(0, 8);
      const topics = HLR_DATA.nodes.filter(n => n.type === 'topic').slice(0, 6);
      return [...bookmarked.slice(0, 6), ...popular, ...topics];
    }
    const lower = q.toLowerCase();
    const scored = [];
    HLR_DATA.nodes.forEach(n => {
      let score = 0;
      const idLower = (n.id || '').toLowerCase();
      const labelLower = (n.label || '').toLowerCase();
      const titleLower = (n.title || n.topic_title || '').toLowerCase();
      const textLower = (typeof n.text === 'string' ? n.text : '').toLowerCase();
      // Exact ID match: huge boost
      if (idLower === lower) score += 1000;
      else if (idLower.startsWith(lower)) score += 500;
      else if (idLower.includes(lower)) score += 200;
      if (labelLower === lower) score += 800;
      else if (labelLower.startsWith(lower)) score += 400;
      else if (labelLower.includes(lower)) score += 150;
      if (titleLower.includes(lower)) score += 80;
      if (textLower.includes(lower)) score += 30;
      // Topic-number match (e.g. "topic 9" or "9")
      if (n.type === 'topic') {
        if (lower === 'topic ' + n.topic || lower === 't' + n.topic || lower === n.topic) score += 700;
      }
      if (score > 0) scored.push({ n, score });
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 40).map(s => s.n);
  }

  function groupResults(results) {
    const groups = { hlr: [], topic: [], ts: [], legal: [], disc: [] };
    results.forEach(n => groups[n.type].push(n));
    return groups;
  }

  function renderPalette(q) {
    const results = rankResults(q);
    paletteCurrentResults = results;
    paletteFocusedIdx = -1;
    paletteCount.textContent = results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : '';
    if (!results.length) {
      paletteResults.innerHTML = '<div class="palette-empty">No matches</div>';
      return;
    }
    const groups = groupResults(results);
    const groupOrder = ['hlr', 'topic', 'ts', 'legal', 'disc'];
    const groupLabels = { hlr: 'HLRs', topic: 'Topics', ts: 'Technical Specs', legal: 'Legal instruments', disc: 'Discussion papers' };
    let html = '';
    let runningIdx = 0;
    groupOrder.forEach(g => {
      if (!groups[g].length) return;
      html += `<div class="palette-group">${groupLabels[g]}</div>`;
      groups[g].forEach(n => {
        const cv = n.type === 'hlr' ? (CAT_COLOR_VAR[n.category] || '--text-subtle')
          : (n.type === 'topic' ? '--type-topic'
            : (n.type === 'ts' ? '--type-ts'
              : (n.type === 'disc' ? discColorVar(n.is_rr)
                : legalColorVar(n.kind))));
        const swatchCls = n.type === 'topic' ? 'swatch hex'
          : ((n.type === 'ts' || n.type === 'legal') ? 'swatch sq'
            : (n.type === 'disc' ? ('swatch tri' + (n.is_rr ? ' rr' : ''))
              : 'swatch'));
        const labelText = n.type === 'hlr'
          ? `${escapeHtml(n.topic_title)}<span class="preview"> — ${escapeHtml(n.text.slice(0, 70))}…</span>`
          : (n.type === 'disc'
            ? `${escapeHtml(n.title || '')}${n.is_rr ? '<span class="preview"> — Refinement Round</span>' : ''}`
            : `${escapeHtml(n.title || n.topic_title)}`);
        const typeBadge = n.type === 'hlr' ? `T${n.topic}`
          : (n.type === 'disc' ? (n.is_rr ? n.letter + '·rr' : n.letter)
            : (n.type.toUpperCase()));
        const swatchStyle = n.type === 'disc' ? '' : ` style="background:var(${cv})"`;
        html += `<div class="palette-result" data-idx="${runningIdx}" data-id="${escapeHtml(n.id)}">
          <span class="${swatchCls}"${swatchStyle}></span>
          <div style="overflow:hidden;">
            <span class="id">${escapeHtml(n.label || n.id)}</span>
            <span class="label-text">${labelText}</span>
          </div>
          <span class="type-badge">${escapeHtml(typeBadge)}</span>
        </div>`;
        runningIdx++;
      });
    });
    paletteResults.innerHTML = html;
    paletteResults.querySelectorAll('.palette-result').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        focusNode(id);
        closePalette();
      });
    });
  }

  function paletteNavigate(delta) {
    const items = paletteResults.querySelectorAll('.palette-result');
    if (!items.length) return;
    paletteFocusedIdx = Math.max(0, Math.min(items.length - 1, paletteFocusedIdx + delta));
    items.forEach(it => it.classList.remove('focused'));
    const it = items[paletteFocusedIdx];
    it.classList.add('focused');
    it.scrollIntoView({ block: 'nearest' });
  }

  paletteInput.addEventListener('input', debounce(() => renderPalette(paletteInput.value.trim()), 80));
  paletteInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); paletteNavigate(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); paletteNavigate(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const items = paletteResults.querySelectorAll('.palette-result');
      const target = items[paletteFocusedIdx >= 0 ? paletteFocusedIdx : 0];
      if (target) {
        focusNode(target.dataset.id);
        closePalette();
      }
    }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) closePalette(); });
  document.getElementById('cmdkHint').addEventListener('click', openPalette);

  // Global keyboard shortcuts
  document.addEventListener('keydown', e => {
    const isMac = navigator.platform.includes('Mac');
    const cmdK = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k';
    const slash = e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName) && !overlay.classList.contains('open');
    if (cmdK || slash) {
      e.preventDefault();
      if (overlay.classList.contains('open')) closePalette();
      else openPalette();
    }
  });

