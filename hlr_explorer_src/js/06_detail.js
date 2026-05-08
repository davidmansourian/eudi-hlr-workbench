  // ============================================================
  // Detail panel
  // ============================================================
  const detailPane = document.getElementById('detailPane');
  let savedHintTimers = {};

  // ----- Reference-impl status badge helpers
  const REF_STATUS_LABEL = { completed: 'Completed', in_progress: 'In Progress', planned: 'Planned' };
  function renderRefStatusBadge(status, label, roadmapUrl, opts) {
    if (!status) return '';
    opts = opts || {};
    const cls = `badge ${status}`;
    const lbl = REF_STATUS_LABEL[status] || status;
    const labelText = label ? `<span class="feat-name"${opts.featId ? ` data-feat-id="${escapeHtml(opts.featId)}"` : ''}>${escapeHtml(label)}</span>` : '';
    const link = roadmapUrl ? `<a class="roadmap-link" href="${escapeHtml(roadmapUrl)}" target="_blank" rel="noopener">↗ roadmap</a>` : '';
    return `<span class="ref-status">${labelText}<span class="${cls}">${lbl}</span>${link}</span>`;
  }

  function shapeForLink(t, isRr) {
    if (t === 'disc') return isRr ? 'tri rr' : 'tri';
    return _shapeForLinkInner(t);
  }
  function _shapeForLinkInner(t) {
    if (t === 'topic') return 'hex';
    if (t === 'ts' || t === 'legal') return 'sq';
    return '';
  }

  function renderHlrLink(idOrLegalKey) {
    let n = nodeLookup[idOrLegalKey];
    if (!n) {
      // try legal alias (e.g. "CIR 2024/2977")
      const aliasId = legalAliases[idOrLegalKey];
      if (aliasId) n = nodeLookup[aliasId];
    }
    if (!n) {
      return `<span style="color:var(--text-subtle);font-family:'JetBrains Mono',monospace;font-size:11px;">${escapeHtml(idOrLegalKey)} (unknown)</span>`;
    }
    const cv = n.type === 'hlr' ? (CAT_COLOR_VAR[n.category] || '--text-subtle')
      : (n.type === 'topic' ? '--type-topic'
        : (n.type === 'ts' ? '--type-ts'
          : (n.type === 'disc' ? discColorVar(n.is_rr)
            : legalColorVar(n.kind))));
    const topicTag = n.type === 'hlr' ? `<span class="topic">T${escapeHtml(n.topic)}</span>` : '';
    const meta = n.type === 'topic' ? `<span class="meta-text">${escapeHtml(n.topic_title)}</span>`
      : (n.type === 'ts' || n.type === 'legal' ? `<span class="meta-text">${escapeHtml(n.title || '')}</span>`
        : (n.type === 'disc' ? `<span class="meta-text">${escapeHtml(n.title || '')}${n.is_rr ? ' <em>(RR)</em>' : ''}</span>` : ''));
    const shapeCls = shapeForLink(n.type, n.is_rr);
    const styleAttr = n.type === 'disc' ? '' : ` style="background:var(${cv})"`;
    return `<a class="detail-link" data-jump="${escapeHtml(n.id)}"><span class="swatch ${shapeCls}"${styleAttr}></span><span class="id">${escapeHtml(n.label || n.id)}</span>${meta}${topicTag}</a>`;
  }

  // ----- Glossary regex: built once from HLR_DATA.definition_terms.
  // Sorted longest-first so multi-word phrases beat their substrings.
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // Lightweight: escape, then run glossary pass. For surfaces that don't need
  // HLR/legal/TS linkification but still benefit from acronym tooltips.
  function glossifyText(s) { return applyGlossary(escapeHtml(s == null ? '' : s)); }
  const _glossTerms = (HLR_DATA.definition_terms || []).slice();
  const _glossDefs = HLR_DATA.definitions || {};
  // Use distinct boundary handling for tokens that don't start with a word char
  // (e.g. "(W)" — not relevant here, but keeping the logic clean).
  const GLOSS_REGEX = _glossTerms.length
    ? new RegExp('(' + _glossTerms.map(escapeRegex).join('|') + ')(?![A-Za-z0-9_])', 'g')
    : null;
  // Pre-tokenizer: splits HTML into plain-text segments and tag/anchor segments
  // so we never gloss inside an already-linked anchor or HTML attribute.
  // Matches: <a ...>...</a> (greedy until closing tag), or any other tag <...>.
  const HTML_SPLIT_RE = /(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/g;

  function applyGlossary(html) {
    if (!GLOSS_REGEX) return html;
    const parts = html.split(HTML_SPLIT_RE);
    for (let i = 0; i < parts.length; i++) {
      // Even indices are plain text; odd are tags/anchors — leave odd alone.
      if (i % 2 === 1) continue;
      // For text segments, also leave the `data-` and attribute substrings
      // alone — but since this segment is *outside* any tag, that's already
      // guaranteed by the split.
      parts[i] = parts[i].replace(GLOSS_REGEX, (m) => {
        // Use lowercase key for definitions lookup
        const key = m.toLowerCase();
        if (!_glossDefs[key]) return m;
        return `<span class="gloss" data-gloss="${escapeHtml(key)}">${m}</span>`;
      });
    }
    return parts.join('');
  }

  // ----- CELEX / ELI → legal node id mapper (used to intercept EUR-Lex
  // markdown links from HLR text — they get routed inside instead of opening
  // EUR-Lex which sits behind a JS WAF challenge.)
  const _CELEX = HLR_DATA.legal_celex || {};
  const _ELI = HLR_DATA.legal_eli || {};
  function legalIdFromUrl(url) {
    if (!url) return null;
    // CELEX form (handles literal `:` and URL-encoded `%3A`)
    const cm = url.match(/CELEX(?::|%3A)([0-9A-Z]+)/i);
    if (cm) {
      const lid = _CELEX[cm[1].toUpperCase()];
      if (lid && legalAliases[lid]) return legalAliases[lid];
    }
    // ELI form: /eli/reg_impl/2024/2977 or /eli/reg/2024/1183
    const em = url.match(/\/eli\/(reg(?:_impl)?|dir|cdr)\/(\d{4})\/(\d{1,4})/i);
    if (em) {
      const eliKey = `${em[1].toLowerCase()}/${em[2]}/${parseInt(em[3], 10)}`;
      const lid = _ELI[eliKey];
      if (lid && legalAliases[lid]) return legalAliases[lid];
    }
    return null;
  }

  function linkifyText(text) {
    // Pre-pass: convert markdown links `[label](url)` into either internal
    // article-refs (when the URL is EUR-Lex) or kept-as-text link labels. We
    // operate on the raw text BEFORE escapeHtml so we can see the brackets.
    let pre = String(text == null ? '' : text);
    // Use control-character placeholders that can't appear in source text so
    // the post-escapeHtml substitution can't false-match.
    const _AR = "\x01", _LL = "\x02", _SEP = "\x03";
    pre = pre.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, label, url) => {
      const legalId = legalIdFromUrl(url);
      if (!legalId) return label;
      const am = label.match(/Article\s+(\d+[a-z]?)((?:\(\d+\))*(?:\([a-z]\))?)/i);
      if (am) {
        const ref = am[1] + (am[2] || '');
        return _AR + legalId + _SEP + ref + _SEP + label + _AR;
      }
      return _LL + legalId + _SEP + label + _LL;
    });

    let safe = escapeHtml(pre);
    safe = safe.replace(new RegExp(_AR + "([^" + _SEP + "]+)" + _SEP + "([^" + _SEP + "]+)" + _SEP + "([^" + _AR + "]+)" + _AR, "g"),
      (_m, legalId, ref, label) =>
        `<a class="article-ref" data-article-legal="${legalId}" data-article-ref="${ref}">${label}</a>`);
    safe = safe.replace(new RegExp(_LL + "([^" + _SEP + "]+)" + _SEP + "([^" + _LL + "]+)" + _LL, "g"),
      (_m, legalId, label) => `<a class="detail-tag" data-jump="${legalId}">${label}</a>`);

    // Linkify HLR IDs
    safe = safe.replace(/\b([A-Z][A-Za-z]*?(?:_[A-Z]+)*)_(\d+)([a-z]*)\b/g, (m, pre, num, suf) => {
      const id = pre + '_' + num + suf;
      if (nodeLookup[id]) return `<a class="detail-tag" data-jump="${id}">${id}</a>`;
      return m;
    });
    // Linkify CIR / Reg / Dir references — both modern (year/num) and legacy (num/year) forms
    safe = safe.replace(/\b(CIR|Reg|CDR|CID|Dir|Regulation|Directive|GDPR)\s+(?:\(EU\)\s+|\(EC\)\s+)?(?:No\s+)?(\d{1,4}\/\d{4}|\d{4}\/\d{1,4})\b/g, (m, kind, num) => {
      const candidates = [
        `${kind} ${num}`,
        `Reg ${num}`, `CIR ${num}`, `Dir ${num}`, `CDR ${num}`,
        `Reg (EU) ${num}`, `Reg (EC) ${num}`,
      ];
      for (const lbl of candidates) {
        const id = legalAliases[lbl];
        if (id) return `<a class="detail-tag" data-jump="${id}">${escapeHtml(m)}</a>`;
      }
      // GDPR fallback
      if (/GDPR/i.test(m) && legalAliases['GDPR (Reg 2016/679)']) {
        return `<a class="detail-tag" data-jump="${legalAliases['GDPR (Reg 2016/679)']}">${escapeHtml(m)}</a>`;
      }
      return m;
    });
    // Linkify TS references
    safe = safe.replace(/\bTS(\d+)\b(?!\s*\d{3})/g, (m, num) => {
      const id = 'ts_TS' + num;
      if (nodeLookup[id]) return `<a class="detail-tag" data-jump="${id}">${m}</a>`;
      return m;
    });
    // Bare "Article N(X)(y)" references — pair with the most recently linked
    // legal node within the surrounding ~100 characters.
    safe = safe.replace(/\bArticle\s+(\d+[a-z]?)((?:\(\d+\))*(?:\([a-z]\))?)/g, (m, n, suf, offset) => {
      // Skip if already inside an article-ref tag (defensive)
      const before = safe.slice(Math.max(0, offset - 200), offset);
      const lookback = safe.slice(Math.max(0, offset - 250), offset + 250);
      // Find nearest legal-id link in the surrounding window
      const legalMatches = [...lookback.matchAll(/data-jump="(legal_[^"]+)"/g)];
      if (!legalMatches.length) return m;
      // Pick the closest one by character distance in the window
      const targetOffset = offset - Math.max(0, offset - 250);
      let best = null, bestDist = Infinity;
      for (const lm of legalMatches) {
        const dist = Math.abs(lm.index - targetOffset);
        if (dist < bestDist) { best = lm[1]; bestDist = dist; }
      }
      if (!best) return m;
      const ref = n + (suf || '');
      return `<a class="article-ref" data-article-legal="${best}" data-article-ref="${ref}">${m}</a>`;
    });
    // Glossary tooltips — applied last; HTML-aware split avoids inside-tag matches.
    safe = applyGlossary(safe);
    return safe;
  }

  function renderHlrDetail(n) {
    const cv = CAT_COLOR_VAR[n.category] || '--text-subtle';
    const status = personal.getStatus(n.id);
    const bookmarked = personal.isBookmarked(n.id);
    const notes = personal.getNotes(n.id);
    const fileLink = personal.getFile(n.id);

    let html = `
      <div class="detail">
        <div class="detail-header">
          <button class="bookmark-btn ${bookmarked ? 'active' : ''}" id="bookmarkBtn" title="Bookmark">
            <svg viewBox="0 0 24 24" fill="${bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
          </button>
          <div class="detail-id"><span class="swatch" style="background:var(${cv})"></span>${escapeHtml(n.id)}</div>
          <div class="detail-meta">
            <span><strong>Topic ${escapeHtml(n.topic)}</strong> · ${escapeHtml(n.topic_title)}</span>
            <span>${escapeHtml(n.category)}${n.subsection ? ' · ' + escapeHtml(n.subsection) : ''}</span>
            <span class="harmonized">${escapeHtml(n.harmonized)}</span>
          </div>
        </div>

        <div class="detail-section personal-section">
          <h4>My layer</h4>
          <div class="status-row">
            <button class="status-btn ${status === 'none' ? 'active' : ''}" data-status="none">None</button>
            <button class="status-btn ${status === 'started' ? 'active' : ''}" data-status="started">In prog.</button>
            <button class="status-btn ${status === 'implemented' ? 'active' : ''}" data-status="implemented">Impl.</button>
            <button class="status-btn ${status === 'verified' ? 'active' : ''}" data-status="verified">Verified</button>
          </div>
          <label class="field-label">Notes</label>
          <textarea class="note-textarea" id="notesField" placeholder="Personal notes…">${escapeHtml(notes)}</textarea>
          <label class="field-label" style="margin-top:8px;">Code link (file:line)</label>
          <input type="text" class="file-input" id="fileField" placeholder="WalletKit/PIDIssuance.swift:42" value="${escapeHtml(fileLink)}">
          <div class="save-hint" id="saveHint"></div>
        </div>

        ${n.is_empty ? '<div class="detail-section"><div class="empty-banner">This requirement is marked <strong>Empty</strong> in the source — typically removed or pending.</div></div>' : ''}

        <div class="detail-section">
          <h4>Requirement</h4>
          <p class="detail-text">${linkifyText(n.text) || '<em style="color:var(--text-subtle);">(empty)</em>'}</p>
          ${n.notes ? `<p class="detail-notes">${linkifyText(n.notes)}</p>` : ''}
        </div>

        ${n.parent ? `<div class="detail-section"><h4>Parent</h4><ul class="detail-link-list">${renderHlrLink(n.parent)}</ul></div>` : ''}
        <div class="detail-section">
          <h4>Children <span class="count">${n.children.length}</span></h4>
          <ul class="detail-link-list">${n.children.length ? n.children.map(renderHlrLink).join('') : '<li class="empty">— none —</li>'}</ul>
        </div>
        <div class="detail-section">
          <h4>References (out) <span class="count">${n.references.length}</span></h4>
          <ul class="detail-link-list">${n.references.length ? n.references.map(renderHlrLink).join('') : '<li class="empty">— none —</li>'}</ul>
        </div>
        <div class="detail-section">
          <h4>Referenced by (in) <span class="count">${n.referenced_by.length}</span></h4>
          <ul class="detail-link-list">${n.referenced_by.length ? n.referenced_by.map(renderHlrLink).join('') : '<li class="empty">— none —</li>'}</ul>
        </div>

        <div class="detail-section">
          <h4>Topic</h4>
          <ul class="detail-link-list">${renderHlrLink('topic_' + n.topic)}</ul>
        </div>

        ${n.ts && n.ts.length ? `<div class="detail-section"><h4>Implementing TS <span class="count">${n.ts.length}</span></h4><ul class="detail-link-list">${n.ts.map(t => renderHlrLink('ts_' + t)).join('')}</ul></div>` : ''}
        ${n.legal && n.legal.length ? `<div class="detail-section"><h4>Legal basis <span class="count">${n.legal.length}</span></h4><ul class="detail-link-list">${n.legal.map(l => { const aliasId = legalAliases[l]; return aliasId ? renderHlrLink(aliasId) : `<span class="detail-tag">${escapeHtml(l)}</span>`; }).join('')}</ul></div>` : ''}
      </div>
    `;
    detailPane.innerHTML = html;

    // Wire personal layer
    detailPane.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const st = btn.dataset.status;
        personal.setStatus(n.id, st);
        detailPane.querySelectorAll('.status-btn').forEach(b => b.classList.toggle('active', b.dataset.status === st));
        updateNodeStatusClasses(n.id);
        buildPersonalFilters();
        flashSaved();
      });
    });
    detailPane.querySelector('#bookmarkBtn').addEventListener('click', () => {
      const b = !personal.isBookmarked(n.id);
      personal.setBookmarked(n.id, b);
      detailPane.querySelector('#bookmarkBtn').classList.toggle('active', b);
      const svg = detailPane.querySelector('#bookmarkBtn svg');
      svg.setAttribute('fill', b ? 'currentColor' : 'none');
      updateNodeStatusClasses(n.id);
      buildPersonalFilters();
      flashSaved();
    });
    const notesEl = detailPane.querySelector('#notesField');
    const fileEl = detailPane.querySelector('#fileField');
    const debouncedSaveNotes = debounce(() => { personal.setNotes(n.id, notesEl.value); flashSaved(); buildPersonalFilters(); }, 600);
    const debouncedSaveFile = debounce(() => { personal.setFile(n.id, fileEl.value); flashSaved(); buildPersonalFilters(); }, 600);
    notesEl.addEventListener('input', debouncedSaveNotes);
    fileEl.addEventListener('input', debouncedSaveFile);

    // Wire jump links
    detailPane.querySelectorAll('[data-jump]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); focusNode(el.dataset.jump); });
    });
  }

  function flashSaved() {
    const hint = detailPane.querySelector('#saveHint');
    if (!hint) return;
    hint.textContent = '✓ Saved locally';
    hint.classList.add('saved');
    if (savedHintTimers.t) clearTimeout(savedHintTimers.t);
    savedHintTimers.t = setTimeout(() => {
      hint.textContent = ''; hint.classList.remove('saved');
    }, 1400);
  }

  function renderTopicDetail(n) {
    const hlrsInTopic = HLR_DATA.nodes.filter(x => x.type === 'hlr' && x.topic === n.topic);
    const subsections = {};
    hlrsInTopic.forEach(h => {
      const s = h.subsection || '(no subsection)';
      if (!subsections[s]) subsections[s] = [];
      subsections[s].push(h);
    });
    const subsHtml = Object.entries(subsections).map(([s, hs]) => `
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px;">${escapeHtml(s)}</div>
        <ul class="detail-link-list">${hs.map(h => renderHlrLink(h.id)).join('')}</ul>
      </div>
    `).join('');
    detailPane.innerHTML = `
      <div class="detail">
        <div class="detail-header">
          <div class="detail-id"><span class="swatch hex" style="background:var(--type-topic)"></span>Topic ${escapeHtml(n.topic)}</div>
          <div class="detail-meta">
            <span><strong>${escapeHtml(n.topic_title)}</strong></span>
            <span>${n.hlr_count} HLRs</span>
          </div>
        </div>
        ${n.ts.length ? `<div class="detail-section"><h4>Implementing TS</h4><ul class="detail-link-list">${n.ts.map(t => renderHlrLink('ts_' + t)).join('')}</ul></div>` : ''}
        ${n.legal.length ? `<div class="detail-section"><h4>Legal basis</h4><ul class="detail-link-list">${n.legal.map(l => { const a = legalAliases[l]; return a ? renderHlrLink(a) : `<span class="detail-tag">${escapeHtml(l)}</span>`; }).join('')}</ul></div>` : ''}
        <div class="detail-section">
          <h4>HLRs in this topic <span class="count">${hlrsInTopic.length}</span></h4>
          ${subsHtml || '<div class="empty">— none —</div>'}
        </div>
      </div>
    `;
    detailPane.querySelectorAll('[data-jump]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); focusNode(el.dataset.jump); });
    });
  }

  function renderTSDetail(n) {
    const govTopics = (n.topics || []).map(t => 'topic_' + t);
    detailPane.innerHTML = `
      <div class="detail">
        <div class="detail-header">
          <div class="detail-id"><span class="swatch sq" style="background:var(--type-ts)"></span>${escapeHtml(n.label)}</div>
          <div class="detail-meta">
            <span><strong>${escapeHtml(n.title)}</strong></span>
            <span>EC Technical Specification · published in standards-and-tech-specs repo</span>
          </div>
        </div>
        <div class="detail-section">
          <h4>Implements topics <span class="count">${govTopics.length}</span></h4>
          <ul class="detail-link-list">${govTopics.length ? govTopics.map(renderHlrLink).join('') : '<li class="empty">— none —</li>'}</ul>
        </div>
      </div>
    `;
    detailPane.querySelectorAll('[data-jump]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); focusNode(el.dataset.jump); });
    });
  }

  // Slugify "Article 5(4)(b)" / "5(4)(b)" / "Recital 12" / "Annex I" → stable HTML id.
  function slugifyAnchor(s) {
    return String(s || '').toLowerCase()
      .replace(/article\s+/g, '')
      .replace(/recital\s+/g, 'r-')
      .replace(/annex\s+/g, 'anx-')
      .replace(/[()]/g, '-')
      .replace(/\./g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function renderLegalDetail(n) {
    const govTopics = (n.topics || []).map(t => 'topic_' + t);
    const kindLabel = ({
      regulation: 'Regulation', cir: 'Commission Implementing Regulation',
      directive: 'Directive', delegated: 'Commission Delegated Regulation',
    })[n.kind] || 'Legal instrument';
    const t = n.text || {};
    const recitals = t.recitals || [];
    const articles = t.articles || [];
    const annexes = t.annexes || [];

    // TOC: chips for quick jump
    const tocChips = [];
    if (recitals.length) tocChips.push(`<span class="legal-toc-item" data-leg-anchor="recitals">Recitals (${recitals.length})</span>`);
    articles.forEach(a => tocChips.push(`<span class="legal-toc-item" data-leg-anchor="art-${slugifyAnchor(a.n)}">Art ${escapeHtml(a.n)}</span>`));
    annexes.forEach(a => tocChips.push(`<span class="legal-toc-item" data-leg-anchor="anx-${escapeHtml(a.n.toLowerCase())}">Annex ${escapeHtml(a.n)}</span>`));

    const recitalsHtml = recitals.map(r => `
      <div class="legal-recital" id="r-${escapeHtml(r.n)}"><div class="ln">Recital (${escapeHtml(r.n)})</div>${linkifyText(r.body)}</div>
    `).join('');

    const articlesHtml = articles.map(a => {
      const paragraphsHtml = a.paragraphs.map(p => {
        const subHtml = (p.subpoints || []).map(sp => `
          <div class="legal-subpoint" id="art-${slugifyAnchor(sp.n)}">
            <span class="lt">(${escapeHtml(sp.n.match(/\(([a-z])\)$/)?.[1] || '?')})</span>
            <div>${linkifyText(sp.body)}</div>
          </div>
        `).join('');
        const pAnchor = `art-${slugifyAnchor(p.n)}`;
        return `<div class="legal-paragraph" id="${pAnchor}">
          <span class="pn">${escapeHtml(p.n)}</span>${linkifyText(p.body)}
          ${subHtml}
        </div>`;
      }).join('');
      return `<div class="legal-article" id="art-${slugifyAnchor(a.n)}">
        <div class="ln">Article ${escapeHtml(a.n)}</div>
        ${a.title ? `<div class="title">${escapeHtml(a.title)}</div>` : ''}
        ${paragraphsHtml}
      </div>`;
    }).join('');

    const annexesHtml = annexes.map(a => `
      <div class="legal-annex" id="anx-${escapeHtml(a.n.toLowerCase())}">
        <div class="ln">Annex ${escapeHtml(a.n)}</div>
        ${a.title ? `<div class="title" style="font-family:'Fraunces',Georgia,serif;font-size:13px;font-weight:500;margin-bottom:6px;">${escapeHtml(a.title)}</div>` : ''}
        <pre style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted);background:var(--bg-elev);padding:8px;border-radius:4px;white-space:pre-wrap;max-height:280px;overflow-y:auto;">${escapeHtml(a.body)}</pre>
      </div>
    `).join('');

    const pdfLink = n.pdf_rel ? `<a class="legal-pdf-link" href="${escapeHtml(n.pdf_rel)}" target="_blank">↗ View original PDF</a>` : '';

    detailPane.innerHTML = `
      <div class="detail">
        <div class="detail-header">
          ${renderBackButton()}
          <div class="detail-id"><span class="swatch sq" style="background:var(${legalColorVar(n.kind)})"></span>${escapeHtml(n.label)}</div>
          <div class="detail-meta">
            <span><strong>${escapeHtml(n.title)}</strong></span>
            <span>${kindLabel} · ${escapeHtml(n.year)}</span>
          </div>
        </div>
        <div class="detail-section">
          <h4>Governs topics <span class="count">${govTopics.length}</span></h4>
          <ul class="detail-link-list">${govTopics.length ? govTopics.map(renderHlrLink).join('') : '<li class="empty">— none —</li>'}</ul>
          ${pdfLink}
        </div>
        ${tocChips.length ? `<div class="detail-section"><h4>Quick jump</h4><div class="legal-toc">${tocChips.join('')}</div></div>` : ''}
        ${recitals.length ? `<div class="detail-section legal-section"><h4>Recitals <span class="count">${recitals.length}</span></h4><div id="recitals">${recitalsHtml}</div></div>` : ''}
        ${articles.length ? `<div class="detail-section legal-section"><h4>Articles <span class="count">${articles.length}</span></h4>${articlesHtml}</div>` : ''}
        ${annexes.length ? `<div class="detail-section legal-section"><h4>Annexes <span class="count">${annexes.length}</span></h4>${annexesHtml}</div>` : ''}
        ${!t.recitals && !t.articles ? '<div class="detail-section"><div class="empty-banner">Full text not available for this legal instrument.</div></div>' : ''}
      </div>
    `;
    wireDetailLinks(detailPane);
    detailPane.querySelectorAll('[data-leg-anchor]').forEach(el => {
      el.addEventListener('click', () => scrollToLegalAnchor(el.dataset.legAnchor));
    });
  }

  function scrollToLegalAnchor(anchorId) {
    if (!anchorId) return;
    const el = document.getElementById(anchorId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('legal-anchor-flash', 'target');
    setTimeout(() => el.classList.remove('legal-anchor-flash'), 1500);
  }

  function renderDiscDetail(n) {
    const cv = discColorVar(n.is_rr);
    const triCls = n.is_rr ? 'tri rr' : 'tri';
    const sibling = n.rr_pair ? nodeLookup[n.rr_pair] : null;
    const isOpen = n.arf_version === 'open';
    const versionMeta = [
      n.version ? `Version ${escapeHtml(n.version)}` : '',
      n.date ? escapeHtml(n.date) : '',
    ].filter(Boolean).join(' · ');
    const iterationMeta = n.iteration ? `Iteration ${n.iteration}` : (isOpen ? 'Open' : 'Integrated');

    let bannerHtml = '';
    if (n.is_rr && sibling) {
      bannerHtml = `<div class="disc-rr-banner">
        <strong>Refinement round (RR)</strong> — this is the 2026 revision of <em>${escapeHtml(sibling.title)}</em>.
        See "What's changing" below for the curated delta.
        <div><button data-jump-disc="${escapeHtml(sibling.id)}">↗ Open integrated paper</button></div>
      </div>`;
    } else if (!n.is_rr && sibling) {
      bannerHtml = `<div class="disc-rr-banner integrated">
        <strong>Heads-up:</strong> a 2026 refinement-round version of this paper exists. Read it for what's about to change in the next ARF release.
        <div><button data-jump-disc="${escapeHtml(sibling.id)}">↗ Open RR paper (${escapeHtml(sibling.title)})</button></div>
      </div>`;
    }

    let deltaHtml = '';
    if (n.is_rr && n.delta) {
      const sec = (cls, label, items) => items && items.length ? `<div class="disc-delta-section ${cls}">
        <div class="delta-label">${label}</div>
        <ul>${items.map(x => `<li>${linkifyText(x)}</li>`).join('')}</ul>
      </div>` : '';
      deltaHtml = `<div class="detail-section">
        <h4>What's changing in 2026</h4>
        <div class="disc-delta">
          ${n.delta.summary ? `<div class="disc-delta-summary">${escapeHtml(n.delta.summary)}</div>` : ''}
          ${sec('adds', 'Additions', n.delta.additions)}
          ${sec('changes', 'Changes', n.delta.changes)}
          ${sec('removes', 'Removals', n.delta.removals)}
        </div>
      </div>`;
    }

    const topicLinks = (n.topics || []).map(t => renderHlrLink('topic_' + t)).join('');
    const hlrLinks = (n.hlr_refs || []).slice(0, 30).map(h => renderHlrLink(h)).join('');
    const moreHlrs = (n.hlr_refs || []).length > 30 ? `<div style="font-size:11px;color:var(--text-subtle);font-style:italic;margin-top:4px;">+ ${(n.hlr_refs || []).length - 30} more references in the body…</div>` : '';

    detailPane.innerHTML = `
      <div class="detail">
        <div class="detail-header">
          <div class="detail-id">
            <span class="swatch ${triCls}"></span>
            ${escapeHtml(n.letter || n.label)}${n.is_rr ? ' <em style="color:var(--type-disc-rr);font-style:italic;">·rr</em>' : ''}
          </div>
          <div class="detail-meta">
            <span><strong>${escapeHtml(n.title)}</strong></span>
            <div class="disc-meta-grid">
              ${versionMeta ? `<span class="lbl">Version</span><span class="val">${versionMeta}</span>` : ''}
              <span class="lbl">Status</span><span class="val">${escapeHtml(iterationMeta)}${n.arf_version && n.arf_version !== 'open' && n.arf_version !== 'integrated' ? ' · ARF ' + escapeHtml(n.arf_version) : ''}</span>
              ${n.github ? `<span class="lbl">Discuss</span><span class="val"><a class="disc-github" href="${escapeHtml(n.github)}" target="_blank" rel="noopener">↗ GitHub</a></span>` : ''}
            </div>
          </div>
        </div>
        ${bannerHtml ? `<div class="detail-section">${bannerHtml}</div>` : ''}
        ${n.tldr ? `<div class="detail-section"><h4>TL;DR (from §1.1)</h4><p class="detail-text" style="font-style:italic;">${linkifyText(n.tldr)}</p></div>` : ''}
        ${deltaHtml}
        ${topicLinks ? `<div class="detail-section"><h4>Discusses topics <span class="count">${(n.topics || []).length}</span></h4><ul class="detail-link-list">${topicLinks}</ul></div>` : ''}
        ${hlrLinks ? `<div class="detail-section"><h4>HLRs referenced in this paper <span class="count">${(n.hlr_refs || []).length}</span></h4><ul class="detail-link-list">${hlrLinks}</ul>${moreHlrs}</div>` : ''}
        <div class="detail-section">
          <h4>Body excerpt <span class="count">${escapeHtml(n.filename || '')}</span></h4>
          <div class="disc-body">${escapeHtml(n.body || '').slice(0, 5000)}</div>
        </div>
      </div>
    `;
    detailPane.querySelectorAll('[data-jump]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); focusNode(el.dataset.jump); });
    });
    detailPane.querySelectorAll('[data-jump-disc]').forEach(el => {
      el.addEventListener('click', () => focusNode(el.dataset.jumpDisc));
    });
  }

  // ----- Detail history stack: lets the user "back" out of an article-ref
  // jump or any other in-panel navigation. Top-level actions (Cmd-K, lens
  // activation, atlas activation, path activation) clear the stack.
  const detailHistory = [];
  let detailSuppressHistory = false;
  let currentNodeId = null;

  function clearDetailHistory() { detailHistory.length = 0; }
  function focusBack() {
    const prev = detailHistory.pop();
    if (!prev) return;
    detailSuppressHistory = true;
    focusNode(prev.id, { scrollAnchor: prev.scrollAnchor });
    detailSuppressHistory = false;
  }
  function renderBackButton() {
    if (!detailHistory.length) return '';
    const prev = detailHistory[detailHistory.length - 1];
    const prevNode = nodeLookup[prev.id];
    const label = prevNode ? (prevNode.label || prev.id) : prev.id;
    return `<button class="detail-back" id="detailBackBtn"><span class="arr">←</span> back to ${escapeHtml(label)}</button>`;
  }
  function wireDetailLinks(root) {
    root.querySelectorAll('[data-jump]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        focusNode(el.dataset.jump);
      });
    });
    root.querySelectorAll('[data-article-ref]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const legalId = el.dataset.articleLegal;
        const anchor = el.dataset.articleRef;
        if (legalId && nodeLookup[legalId]) {
          focusNode(legalId, { scrollAnchor: 'art-' + slugifyAnchor(anchor) });
        }
      });
    });
    const back = root.querySelector('#detailBackBtn');
    if (back) back.addEventListener('click', focusBack);
  }

  function injectBackButton() {
    if (!detailHistory.length) return;
    const header = detailPane.querySelector('.detail-header');
    if (!header) return;
    if (header.querySelector('.detail-back')) return; // already injected by renderLegalDetail
    const tmp = document.createElement('div');
    tmp.innerHTML = renderBackButton();
    const btn = tmp.firstElementChild;
    if (!btn) return;
    btn.addEventListener('click', focusBack);
    header.insertBefore(btn, header.firstChild);
  }

  function renderDetail(id) {
    const n = nodeLookup[id];
    if (!n) {
      detailPane.innerHTML = '<div class="detail-empty">Not found.</div>';
      return;
    }
    currentNodeId = id;
    if (n.type === 'hlr') renderHlrDetail(n);
    else if (n.type === 'topic') renderTopicDetail(n);
    else if (n.type === 'ts') renderTSDetail(n);
    else if (n.type === 'legal') renderLegalDetail(n);
    else if (n.type === 'disc') renderDiscDetail(n);
    injectBackButton();
  }

  function focusNode(id, opts) {
    opts = opts || {};
    const ele = cy.getElementById(id);
    if (!ele || ele.empty()) return;
    // Push history when in-panel navigating to a different node.
    if (currentNodeId && currentNodeId !== id && !detailSuppressHistory) {
      detailHistory.push({ id: currentNodeId, scrollAnchor: null });
    }
    // If the lens is active and the target is filtered out, auto-disable the lens
    // so the user can actually see what they navigated to.
    if (activeLens && ele.style('display') === 'none') {
      deactivateLens();
      showToast('Lens cleared (target was out of scope)');
    }
    cy.elements().removeClass('highlighted dimmed');
    cy.elements().not(ele.closedNeighborhood()).addClass('dimmed');
    ele.closedNeighborhood().addClass('highlighted');
    ele.select();
    cy.center(ele);
    if (cy.zoom() < 0.9) cy.zoom({ level: 1.1, renderedPosition: ele.renderedPosition() });
    renderDetail(id);
    if (opts.scrollAnchor) {
      // Render is synchronous, but scroll after the DOM has settled.
      requestAnimationFrame(() => scrollToLegalAnchor(opts.scrollAnchor));
    }
    if (window.innerWidth <= 920) {
      document.getElementById('rightPanel').classList.add('open');
      document.getElementById('leftPanel').classList.remove('open');
    }
  }

  cy.on('tap', 'node', evt => focusNode(evt.target.id()));
  cy.on('tap', e => {
    if (e.target === cy) {
      cy.elements().removeClass('highlighted dimmed');
      cy.elements().unselect();
    }
  });

