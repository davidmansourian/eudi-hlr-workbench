  // ============================================================
  // Help / Meta-glossary modal
  // ============================================================
  const helpOverlay = document.getElementById('helpOverlay');
  const helpBody = document.getElementById('helpBody');
  function _stat(key) { return HLR_DATA.stats[key]; }

  function _resetKeysWithPrefix(prefix) {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    return toRemove.length;
  }

  function resetHlrStatuses() {
    if (!confirm('Reset all HLR statuses (started / implemented / verified)? Notes, file links, and bookmarks are preserved.\n\nNote: this does NOT affect the "In Progress" badges on features (Issuance, Presentation, etc.) — those are static EU reference-implementation status, not personal.')) return;
    let n = 0;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PL_KEY_PREFIX) && k.endsWith(':status')) {
        localStorage.removeItem(k); n++;
      }
    }
    showToast(`Cleared status for ${n} HLRs — reloading…`);
    setTimeout(() => location.reload(), 250);
  }

  function resetPathProgress() {
    if (!confirm('Reset progress on all learning paths (steps marked complete, auto-sync toggle, active path)?')) return;
    let n = 0;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PL_KEY_PREFIX + 'path:')) {
        localStorage.removeItem(k); n++;
      }
    }
    showToast(`Cleared ${n} path-state keys — reloading…`);
    setTimeout(() => location.reload(), 250);
  }

  function resetQuizState() {
    if (!confirm('Reset all quiz state (card review history, streak, today counter)?')) return;
    let n = 0;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PL_KEY_PREFIX + 'quiz:')) {
        localStorage.removeItem(k); n++;
      }
    }
    showToast(`Cleared ${n} quiz keys — reloading…`);
    setTimeout(() => location.reload(), 250);
  }

  function resetAllPersonal() {
    if (!confirm('Reset EVERYTHING personal — HLR statuses, notes, file links, bookmarks, path progress, quiz state? This cannot be undone.\n\nNote: the "In Progress" badges on features (Issuance, Presentation, etc.) are NOT personal — they reflect the public EU reference-implementation shipping status and will remain.')) return;
    const n = _resetKeysWithPrefix(PL_KEY_PREFIX);
    showToast(`Cleared ${n} keys — reloading…`);
    // Hard reload guarantees every cached UI state is rebuilt from scratch.
    setTimeout(() => location.reload(), 250);
  }

  function renderHelpBody() {
    const stats = HLR_DATA.stats;
    const refImplDocsLink = '';
    helpBody.innerHTML = `
      <div class="help-section">
        <h3>The map</h3>
        <p style="font-size:13px;line-height:1.6;color:var(--text-muted);margin:0 0 8px 0;">
          The graph in the centre shows every node referenced from the EUDI Architecture and Reference Framework
          (ARF), plus curated overlays. Each node type has a distinct shape and colour, and edges encode different
          kinds of relationships.
        </p>
      </div>

      <div class="help-section">
        <h3>Hierarchy</h3>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 6px 0;line-height:1.5;">
          Legal docs are the only <em>mandatory</em> tier. Everything else is informative — Technical Specs implement
          requirements, Discussion papers refine them ahead of integration, Topics group HLRs, HLRs are atomic.
          The bottom row (Features / Paths / Narratives / Tensions) is the workbench's own curation layer.
        </p>
        <div class="help-mermaid-host" id="helpHierarchy" data-mmd-src="">Loading…</div>
      </div>

      <div class="help-section">
        <h3>Node types</h3>

        <div class="help-row">
          <div class="term"><span class="swatch" style="background:var(--cat-wp)"></span>HLR <span class="count">${stats.hlr_nodes}</span></div>
          <div class="desc"><strong>High-Level Requirement.</strong> The atomic spec elements from ARF Annex 2. Each is identified by a prefix (e.g. <code>WIAM_14</code>) tied to a Topic. Coloured by actor category (Wallet Provider, Member State, Attestation Provider, etc.). Empty/placeholder HLRs render at low opacity.</div>
        </div>

        <div class="help-row">
          <div class="term"><span class="swatch hex" style="background:var(--type-topic)"></span>Topic <span class="count">${stats.topic_nodes}</span></div>
          <div class="desc"><strong>ARF Topic.</strong> A grouping in Annex 2.02 (e.g. Topic 9 = Wallet Unit Attestation). Each Topic has child HLRs and may have a curated narrative + service blueprint. Diamond shape.</div>
        </div>

        <div class="help-row">
          <div class="term"><span class="swatch sq" style="background:var(--type-ts)"></span>TS <span class="count">${stats.ts_nodes}</span></div>
          <div class="desc"><strong>Technical Specification.</strong> EC-published technical specs that implement requirements (e.g. TS3 = Wallet Unit Attestations spec). Rounded square.</div>
        </div>

        <div class="help-row">
          <div class="term"><span class="swatch sq" style="background:var(--type-legal-cir)"></span>Legal doc <span class="count">${stats.legal_nodes}</span></div>
          <div class="desc"><strong>CIR / Reg / Dir / GDPR.</strong> The mandatory legal instruments — Commission Implementing Regulations, the EUDI Regulation 2024/1183, GDPR. Click to read the full parsed text (recitals, articles, annexes). Square.</div>
        </div>

        <div class="help-row">
          <div class="term"><span class="swatch tri"></span>Discussion paper <span class="count">${stats.disc_nodes}</span></div>
          <div class="desc"><strong>EUDI Cooperation Group working paper.</strong> 30 papers — drafts, integrated versions, and active 2026 <strong>refinement-round (RR)</strong> revisions for Topics C / E / J / X. RR papers render as a chevron (▼-style). Each RR has a curated "what's changing" delta on its detail panel.</div>
        </div>
      </div>

      <div class="help-section">
        <h3>Curated overlays (not nodes)</h3>

        <div class="help-row">
          <div class="term">Feature <span class="count">${stats.feature_count}</span></div>
          <div class="desc"><strong>Functional cluster.</strong> Hand-curated bundles of HLRs that together deliver a user-facing capability — PID Issuance, Remote Presentation, QES, etc. Found in the <em>Lens</em> tab. Used to filter the graph and to score implementation coverage. Each feature now also surfaces a reference-implementation status (Completed / In Progress / Planned) sourced from the EU's public feature-map.</div>
        </div>

        <div class="help-row">
          <div class="term">Narrative <span class="count">${stats.narratives}</span></div>
          <div class="desc"><strong>Engineer-flavoured topic explainer.</strong> ~250-word TL;DR + body for the most-touched topics, plus a "common pitfalls" list. Renders inside the Topic detail panel.</div>
        </div>

        <div class="help-row">
          <div class="term">Path <span class="count">${stats.path_count}</span></div>
          <div class="desc"><strong>Guided learning sequence.</strong> Ordered steps that walk you through related HLRs, topics, TS, legal docs, and features. Track per-step completion. The <em>Atlas</em> shows which paths cover which HLRs — useful when you ask "I want to learn X, which path?"</div>
        </div>

        <div class="help-row">
          <div class="term">Tension <span class="count">${stats.tension_edges}</span></div>
          <div class="desc"><strong>Heuristic exception/override link.</strong> Detected when ARF text uses words like "unless / however / except / instead / overrides" near a cross-referenced HLR. May include false positives — read both HLRs to confirm. Rendered as red dashed edges.</div>
        </div>

        <div class="help-row">
          <div class="term">Glossary tooltip <span class="count">${stats.definition_count}</span></div>
          <div class="desc"><strong>Dotted-underlined acronyms in any panel</strong> — hover for an Annex-1 (or supplemental) definition. Sources: ARF Annex 1, the EU Regulation 2024/1183, and 25 hand-curated supplemental terms (WIA, KA, mdoc, mDL, SD-JWT VC, PAdES, HAIP, OpenID4VP, OpenID4VCI, etc.).</div>
        </div>

        <div class="help-row">
          <div class="term">Quiz card <span class="count">${stats.quiz_card_count}</span></div>
          <div class="desc"><strong>Active recall.</strong> 65 hand-curated flashcards from <code>flashcards.tsv</code> + 36 auto-generated "true/false" cards from narrative pitfalls + 8 from detected tensions. Open via the <strong>📖 Learn</strong> button.</div>
        </div>

        <div class="help-row">
          <div class="term">Service blueprint <span class="count">${stats.blueprints_total}</span></div>
          <div class="desc"><strong>Sequence diagram.</strong> 12 ARF Annex 4 service blueprints. 4 hand-curated as Mermaid (Activation, Online ID/Auth, mDL Issuing, Remote QES); the other 8 link out to the source PDF.</div>
        </div>
      </div>

      <div class="help-section">
        <h3>Edges (graph relationships)</h3>
        <div class="help-row"><div class="term">Solid line</div><div class="desc"><strong>Parent → child HLR</strong> (e.g. <code>WIAM_14</code> → <code>WIAM_14a</code>, <code>WIAM_14b</code>).</div></div>
        <div class="help-row"><div class="term">Dashed line</div><div class="desc"><strong>HLR cross-reference.</strong> One HLR's text mentions another.</div></div>
        <div class="help-row"><div class="term">Dotted line</div><div class="desc"><strong>Topic contains HLR.</strong> Each Topic owns its HLRs.</div></div>
        <div class="help-row"><div class="term">Thin coloured</div><div class="desc"><strong>TS implements / Legal governs / Disc discusses Topic.</strong></div></div>
        <div class="help-row"><div class="term">Red dashed</div><div class="desc"><strong>Tension</strong> (heuristic).</div></div>
      </div>

      <div class="help-section">
        <h3>My layer (your personal annotations)</h3>
        <div class="help-callout">
          <strong>Important — visiting an HLR does not change its status.</strong> Status only changes via three deliberate actions:
          <ol style="margin:6px 0 0 0; padding-left:18px;">
            <li>Click a status button (None · In prog. · Impl. · Verified) on the HLR detail panel.</li>
            <li>Have <em>auto-sync</em> turned ON (toggle in active-path panel) AND check off a path step. The step's HLRs flip from None → In progress.</li>
            <li>Click the <em>Apply (N)</em> bulk button in the path panel.</li>
          </ol>
        </div>
        <div class="help-row">
          <div class="term">Status</div>
          <div class="desc">Per-HLR: <code>None</code> / <code>In progress</code> / <code>Impl.</code> / <code>Verified</code>. Renders as a coloured ring around the node in the graph.</div>
        </div>
        <div class="help-row">
          <div class="term">Bookmark</div>
          <div class="desc">Click the bookmark button on any HLR detail. Bookmarked HLRs get a red ring. Filter by them in the Filters tab.</div>
        </div>
        <div class="help-row">
          <div class="term">Notes &amp; file link</div>
          <div class="desc">Free-text notes per HLR + an optional <code>file.swift:42</code> code reference.</div>
        </div>
        <div class="help-row">
          <div class="term">Path step done</div>
          <div class="desc">Round circle on each path step. Independent of HLR status, unless auto-sync is on.</div>
        </div>
        <div class="help-row">
          <div class="term">Quiz card state</div>
          <div class="desc">Per-card SM-2-lite review state (ease, interval, due date). Resets a card when you answer "Again".</div>
        </div>
      </div>

      <div class="help-section">
        <h3>Reset / Clear</h3>
        <div class="help-callout" style="margin-bottom:10px;">
          <strong>Two different "In Progress" badges exist — only one is yours.</strong>
          <ul style="margin:6px 0 0 0;padding-left:18px;font-size:12px;">
            <li><strong>Reference-impl status</strong> ("Issuance: <span style="background:color-mix(in srgb,var(--status-started) 22%,transparent);color:var(--status-started);padding:1px 4px;border-radius:3px;font-weight:600;">In Progress</span>" + roadmap link, on feature lens cards / topic panels / HLR detail). This is <em>static</em> data sourced from the EU's public <code>feature-map.md</code>. It reflects shipped vs. planned in the EU's reference Android/iOS apps. It does <strong>not</strong> reflect anything you did. Resetting will <strong>not</strong> change these.</li>
            <li><strong>Your personal HLR status</strong> ("In prog." button highlighted + amber ring on the graph node). This <em>is</em> yours and <em>does</em> get cleared by the reset. It only changes via the three deliberate actions described above.</li>
          </ul>
        </div>
        <p style="font-size:11px;color:var(--text-muted);margin:0 0 8px 0;">All personal state lives in your browser's localStorage and never leaves your device. Each reset reloads the page so the UI is guaranteed fresh.</p>
        <div class="help-reset-grid">
          <button class="help-reset-btn" id="helpResetStatus">Reset HLR statuses</button>
          <button class="help-reset-btn" id="helpResetPaths">Reset path progress</button>
          <button class="help-reset-btn" id="helpResetQuiz">Reset quiz state</button>
          <button class="help-reset-btn danger" id="helpResetAll">Reset EVERYTHING personal</button>
        </div>
      </div>

      <div class="help-section">
        <h3>Sources</h3>
        <div class="help-row"><div class="term">ARF</div><div class="desc">Architecture and Reference Framework — <a href="https://eudi.dev/latest/" target="_blank" rel="noopener">eudi.dev/latest/</a>. The map is built from Annex 2 (HLRs), Annex 1 (definitions), Annex 3 (rulebooks references), Annex 4 (blueprints), the discussion-topics directory, and the technical-specifications directory.</div></div>
        <div class="help-row"><div class="term">Legal</div><div class="desc">14 CIRs / Regs / Dirs / GDPR full text. Parsed locally — no fetches against EUR-Lex (which is WAF-blocked).</div></div>
        <div class="help-row"><div class="term">Reference impl</div><div class="desc"><a href="https://eu-digital-identity-wallet.github.io/" target="_blank" rel="noopener">eu-digital-identity-wallet.github.io</a> + the public feature-map.md.</div></div>
        <div class="help-row"><div class="term">Disclaimer</div><div class="desc">The ARF is <strong>informative</strong>. Only the EU Regulation 2024/1183 and adopted CIRs are <strong>mandatory</strong>. This tool reflects the published material as of the bundle date.</div></div>
      </div>
    `;
    // Run glossary pass on the help body so acronyms (WSCA, mdoc, OpenID4VCI…)
    // get hover tooltips. Do this on text nodes only so we don't disturb
    // <a href> tags etc.
    helpBody.querySelectorAll('.help-row .desc, .help-callout, .help-section > p').forEach(el => {
      el.innerHTML = applyGlossary(el.innerHTML);
    });
    document.getElementById('helpResetStatus').addEventListener('click', resetHlrStatuses);
    document.getElementById('helpResetPaths').addEventListener('click', resetPathProgress);
    document.getElementById('helpResetQuiz').addEventListener('click', resetQuizState);
    document.getElementById('helpResetAll').addEventListener('click', resetAllPersonal);
  }

  const HIERARCHY_MERMAID = `flowchart TB
    classDef legal fill:#FDE68A,stroke:#92400E,color:#1A1A1F
    classDef ts fill:#A5F3FC,stroke:#0E7490,color:#1A1A1F
    classDef disc fill:#C7D2FE,stroke:#6366F1,color:#1A1A1F
    classDef topic fill:#BFDBFE,stroke:#1E3A8A,color:#1A1A1F
    classDef hlr fill:#E5E7EB,stroke:#003399,color:#1A1A1F
    classDef overlay fill:#FFE4E6,stroke:#B91C1C,color:#1A1A1F,stroke-dasharray:3 3
    L["📜 Legal docs<br/>(CIRs / Regs / Dirs)<br/><i>mandatory</i>"]:::legal
    TS["📐 Technical Specs<br/>14 EC TS docs"]:::ts
    D["▲ Discussion papers<br/>30 papers · 4 RR refinements"]:::disc
    T["◆ Topics<br/>34 ARF Topics"]:::topic
    H["● HLRs<br/>656 atomic requirements"]:::hlr
    L  -->|governs| T
    TS -->|implements| T
    D  -->|discusses| T
    T  -->|contains| H
    H  -. parent / child .- H
    F["📊 Features"]:::overlay
    P["🎓 Paths"]:::overlay
    N["📖 Narratives"]:::overlay
    X["⚠ Tensions"]:::overlay
    F -. groups .-> H
    P -. walks .-> T
    P -. walks .-> H
    N -. annotates .-> T
    X -. exception .-> H
    `;

  async function renderHierarchyMermaid() {
    const host = document.getElementById('helpHierarchy');
    if (!host) return;
    if (host.dataset.rendered === '1' && host.dataset.theme === (document.body.classList.contains('dark') ? 'dark' : 'default')) return;
    host.dataset.mmdSrc = HIERARCHY_MERMAID;
    const theme = document.body.classList.contains('dark') ? 'dark' : 'default';
    await _renderMermaidBlock(host, HIERARCHY_MERMAID, theme);
    host.dataset.rendered = '1';
    host.dataset.theme = theme;
  }

  function openHelp() {
    if (!helpBody.innerHTML) renderHelpBody();
    helpOverlay.classList.add('open');
    // Render the hierarchy diagram on first open (lazy mermaid load).
    requestAnimationFrame(() => renderHierarchyMermaid());
  }
  function closeHelp() { helpOverlay.classList.remove('open'); }
  document.getElementById('helpLauncher').addEventListener('click', openHelp);
  document.getElementById('helpClose').addEventListener('click', closeHelp);
  helpOverlay.addEventListener('click', e => { if (e.target === helpOverlay) closeHelp(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && helpOverlay.classList.contains('open')) {
      e.preventDefault(); closeHelp();
    }
  });

  document.getElementById('atlasClose').addEventListener('click', closeAtlas);
  atlasOverlay.addEventListener('click', e => { if (e.target === atlasOverlay) closeAtlas(); });
  atlasSearch.addEventListener('input', debounce(renderAtlasResults, 100));
  document.querySelectorAll('.atlas-typefilter button').forEach(btn => {
    btn.addEventListener('click', () => {
      atlasTypeFilter = btn.dataset.atype;
      document.querySelectorAll('.atlas-typefilter button').forEach(b => b.classList.toggle('active', b === btn));
      renderAtlasResults();
    });
  });
  // Esc closes; also Cmd-Shift-K could open as alt — keep simple: just Esc.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && atlasOverlay.classList.contains('open')) {
      e.preventDefault();
      closeAtlas();
    }
  });

