  // ============================================================
  // Topic narrative rendering
  // ============================================================
  function renderNarrativeMarkdown(text) {
    // Very light markdown: **bold**, *italic*, `code`, paragraphs from blank lines
    let html = escapeHtml(text);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    // Apply glossary tooltips to acronyms in narrative prose
    html = applyGlossary(html);
    return html;
  }

  // ============================================================
  // Service blueprints — lazy Mermaid render
  // ============================================================
  let _bpRenderId = 0;
  async function _ensureMermaid() {
    if (window.mermaid) return window.mermaid;
    if (!window.__loadMermaid) return null;
    return await window.__loadMermaid(document.body.classList.contains('dark') ? 'dark' : 'default');
  }
  async function _renderMermaidBlock(host, src, theme) {
    const m = await _ensureMermaid();
    if (!m) {
      host.innerHTML = `<div class="bp-loading">Mermaid library failed to load (offline?). View the source diagram via the PDF link below.</div>`;
      return;
    }
    // Re-init theme each time (cheap)
    try { m.initialize({ startOnLoad: false, theme: theme, securityLevel: 'loose', sequence: { mirrorActors: false, wrap: true } }); } catch (e) {}
    const id = 'mmd_' + (++_bpRenderId);
    try {
      const { svg } = await m.render(id, src);
      host.innerHTML = svg;
    } catch (err) {
      console.error('Mermaid render failed:', err);
      host.innerHTML = `<div class="bp-loading">Mermaid couldn't render this diagram. ${escapeHtml(String(err.message || err))}</div>`;
    }
  }

  window.__renderTopicBlueprint = function(n, detail) {
    const blueprints = HLR_DATA.blueprints || [];
    const matches = blueprints.filter(b => b.topic === n.topic || (b.topics_extra || []).includes(n.topic));
    if (!matches.length) return;
    // Sort: ones with Mermaid first
    matches.sort((a, b) => Number(!!b.mermaid) - Number(!!a.mermaid) || a.id.localeCompare(b.id));
    const main = matches[0];
    const sec = document.createElement('div');
    sec.className = 'detail-section blueprint-section';
    const pdfLink = main.pdf_rel ? `<a class="legal-pdf-link" href="${escapeHtml(main.pdf_rel)}" target="_blank">↗ View original PDF (Annex ${escapeHtml(main.id)})</a>` : '';
    if (main.mermaid) {
      sec.innerHTML = `
        <h4>Service blueprint <span class="count">Annex ${escapeHtml(main.id)}</span></h4>
        <div class="blueprint-summary">${glossifyText(main.summary || '')}</div>
        <div class="blueprint-mermaid-host" id="bp-host-${escapeHtml(main.id)}">
          <div class="bp-loading">Loading sequence diagram…</div>
        </div>
        <div style="margin-top:8px;">${pdfLink}</div>
      `;
    } else {
      sec.innerHTML = `
        <h4>Service blueprint <span class="count">Annex ${escapeHtml(main.id)}</span></h4>
        <div class="blueprint-summary">${glossifyText(main.summary || '')}</div>
        ${main.text_excerpt ? `<pre class="bp-text-fallback">${escapeHtml(main.text_excerpt)}</pre>` : ''}
        <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">No curated sequence diagram for this blueprint yet — view the source PDF for the full swim-lane.</div>
        <div style="margin-top:8px;">${pdfLink}</div>
      `;
    }
    // Other blueprints (siblings)
    const others = matches.slice(1);
    if (others.length) {
      const otherHtml = others.map(o => {
        const lnk = o.pdf_rel ? ` · <a class="disc-github" href="${escapeHtml(o.pdf_rel)}" target="_blank" style="font-size:10px;padding:2px 6px;">PDF</a>` : '';
        return `<li><strong>Annex ${escapeHtml(o.id)}</strong> — ${escapeHtml(o.title)}${lnk}</li>`;
      }).join('');
      const oth = document.createElement('div');
      oth.className = 'bp-other';
      oth.innerHTML = `<strong>Other blueprints touching this topic:</strong><ul>${otherHtml}</ul>`;
      sec.appendChild(oth);
    }
    detail.appendChild(sec);

    if (main.mermaid) {
      const host = sec.querySelector('.blueprint-mermaid-host');
      host.dataset.mmdSrc = main.mermaid;
      const theme = document.body.classList.contains('dark') ? 'dark' : 'default';
      _renderMermaidBlock(host, main.mermaid, theme);
    }
  };

  // Re-render any visible Mermaid blocks when the user toggles dark mode.
  const themeObserver = new MutationObserver(() => {
    // Cover both the in-detail blueprint hosts AND the help-modal hierarchy diagram.
    const hosts = document.querySelectorAll('[data-mmd-src]');
    if (!hosts.length || !window.mermaid) return;
    const theme = document.body.classList.contains('dark') ? 'dark' : 'default';
    hosts.forEach(host => {
      // Find the source Mermaid by looking up the section's id or stashing it as data attribute
      const src = host.dataset.mmdSrc;
      if (src) _renderMermaidBlock(host, src, theme);
    });
  });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Patch renderTopicDetail to inject the narrative + discussion papers
  const originalRenderTopicDetail = renderTopicDetail;
  renderTopicDetail = function(n) {
    originalRenderTopicDetail(n);
    const detail = detailPane.querySelector('.detail');
    if (!detail) return;

    if (n.narrative) {
      const narrEl = document.createElement('div');
      narrEl.className = 'narrative-section';
      narrEl.innerHTML = `
        <div style="font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--accent);margin-bottom:8px;">Narrative · ${escapeHtml(n.narrative.title)}</div>
        <p class="narrative-tldr">${escapeHtml(n.narrative.tldr)}</p>
        <div class="narrative-body">${renderNarrativeMarkdown(n.narrative.body)}</div>
        ${n.narrative.pitfalls && n.narrative.pitfalls.length ? `
          <div class="pitfalls-list">
            <div class="pitfalls-label">⚠ Common pitfalls</div>
            <ul>${n.narrative.pitfalls.map(p => `<li>${glossifyText(p)}</li>`).join('')}</ul>
          </div>
        ` : ''}
      `;
      detail.querySelector('.detail-header').after(narrEl);
    }

    // Discussion papers covering this topic
    const relatedDiscs = HLR_DATA.nodes.filter(x => x.type === 'disc' && (x.topics || []).includes(n.topic));
    if (relatedDiscs.length) {
      // Sort: integrated first, then RR (so the user sees the foundation before the refinement)
      relatedDiscs.sort((a, b) => Number(a.is_rr) - Number(b.is_rr) || a.letter.localeCompare(b.letter));
      const discEl = document.createElement('div');
      discEl.className = 'detail-section';
      const rrCount = relatedDiscs.filter(d => d.is_rr).length;
      const banner = rrCount > 0 ? `<div class="disc-rr-banner integrated" style="margin-bottom:10px;">
        <strong>2026 refinement coming:</strong> ${rrCount} active rr paper${rrCount === 1 ? '' : 's'} below — read the delta to see what's about to change.
      </div>` : '';
      discEl.innerHTML = `
        <h4>Discussion papers <span class="count">${relatedDiscs.length}</span></h4>
        ${banner}
        <ul class="detail-link-list">${relatedDiscs.map(d => renderHlrLink(d.id)).join('')}</ul>
      `;
      // Insert after the narrative if present, else right after header
      const lastSection = detail.querySelector('.narrative-section') || detail.querySelector('.detail-header');
      if (lastSection) lastSection.after(discEl);
      discEl.querySelectorAll('[data-jump]').forEach(el => {
        el.addEventListener('click', e => { e.preventDefault(); focusNode(el.dataset.jump); });
      });
    }

    // Reference-implementation status section
    if (n.reference_impl && n.reference_impl.length) {
      const riEl = document.createElement('div');
      riEl.className = 'detail-section';
      const rows = n.reference_impl.map(it =>
        `<div class="ref-impl-row">${renderRefStatusBadge(it.status, it.label, it.roadmap_url, { featId: it.feat_id })}</div>`
      ).join('');
      riEl.innerHTML = `
        <h4>Reference implementation <span class="count">${n.reference_impl.length}</span></h4>
        ${rows}
        <div style="font-size:10px;color:var(--text-subtle);font-style:italic;margin-top:6px;">Status from the EUDI Wallet Reference Implementation feature-map; reflects shipped vs. planned in the public Android/iOS demo apps + verifier.</div>
      `;
      // Insert at the end of the detail
      detail.appendChild(riEl);
      riEl.querySelectorAll('[data-feat-id]').forEach(el => {
        el.addEventListener('click', () => {
          const feat = (HLR_DATA.features || []).find(f => f.id === el.dataset.featId);
          if (feat) {
            document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'lens'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-lens'));
            activateLens(feat);
          }
        });
      });
    }

    // Service blueprint section (if any blueprint targets this topic)
    if (window.__renderTopicBlueprint) window.__renderTopicBlueprint(n, detail);
  };

  // ============================================================
  // Tension surfacing in HLR detail
  // ============================================================
  const originalRenderHlrDetail = renderHlrDetail;
  renderHlrDetail = function(n) {
    originalRenderHlrDetail(n);

    // Inject reference-impl row under "My layer"
    if (n.reference_impl_inferred) {
      const ri = n.reference_impl_inferred;
      const detail = detailPane.querySelector('.detail');
      const personalSection = detail && detail.querySelector('.personal-section');
      if (personalSection) {
        const row = document.createElement('div');
        row.className = 'hlr-refimpl-inline';
        row.innerHTML = `
          <span style="text-transform:uppercase;letter-spacing:0.08em;font-size:9px;color:var(--text-subtle);font-weight:700;">Ref impl</span>
          ${renderRefStatusBadge(ri.status, ri.feat_name, ri.roadmap_url, { featId: ri.feat_id })}
        `;
        personalSection.appendChild(row);
        const featNameEl = row.querySelector('[data-feat-id]');
        if (featNameEl) featNameEl.addEventListener('click', () => {
          const feat = (HLR_DATA.features || []).find(f => f.id === featNameEl.dataset.featId);
          if (feat) {
            document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'lens'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-lens'));
            activateLens(feat);
          }
        });
      }
    }

    if (n.tensions && n.tensions.length) {
      const detail = detailPane.querySelector('.detail');
      if (!detail) return;
      const sec = document.createElement('div');
      sec.className = 'detail-section tension-section';
      const rows = n.tensions.map(t => {
        const target = nodeLookup[t.b];
        if (!target) return '';
        const cv = CAT_COLOR_VAR[target.category] || '--text-subtle';
        return `<div class="tension-row">
          <div class="tension-head">
            <span class="swatch" style="width:8px;height:8px;border-radius:50%;background:var(${cv});display:inline-block;"></span>
            <span class="id" data-jump="${escapeHtml(t.b)}">${escapeHtml(t.b)}</span>
            <span class="tension-kind">${escapeHtml(t.kind)}</span>
          </div>
          <div class="tension-context">…${escapeHtml(t.context)}…</div>
        </div>`;
      }).join('');
      sec.innerHTML = `
        <h4>⚠ Possible tensions <span class="count">${n.tensions.length}</span></h4>
        ${rows}
        <div class="tension-disclaimer">Heuristically detected from "unless / however / except / etc." patterns near cross-references. May include false positives — read both HLRs to confirm.</div>
      `;
      // Insert before the Topic section
      const topicSec = [...detail.querySelectorAll('.detail-section h4')].find(h => h.textContent.trim() === 'Topic');
      if (topicSec) topicSec.closest('.detail-section').before(sec);
      else detail.appendChild(sec);
      sec.querySelectorAll('[data-jump]').forEach(el => {
        el.addEventListener('click', e => { e.preventDefault(); focusNode(el.dataset.jump); });
      });
    }
  };

