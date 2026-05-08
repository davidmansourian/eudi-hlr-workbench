  // ============================================================
  // Filters
  // ============================================================
  const TYPE_LABELS = { hlr: 'HLRs', topic: 'Topics', ts: 'TS', legal: 'Legal (CIR / Reg / Dir)', disc: 'Discussion papers' };
  const activeTypes = new Set(['hlr', 'topic', 'ts', 'legal', 'disc']);
  const activeCategories = new Set(HLR_DATA.stats.categories);
  const activeTopics = new Set(HLR_DATA.nodes.filter(n => n.type === 'topic').map(n => n.topic));
  const personalFilters = {
    started: false, implemented: false, verified: false,
    bookmarked: false, hasNotes: false, hasFile: false,
  };

  function buildTypeFilters() {
    const wrap = document.getElementById('typeFilters');
    Object.entries(TYPE_LABELS).forEach(([type, label]) => {
      const count = HLR_DATA.nodes.filter(n => n.type === type).length;
      const div = document.createElement('div');
      div.className = 'filter-pill active';
      div.dataset.type = type;
      const swatchClass = type === 'topic' ? 'swatch hex' : (type === 'ts' || type === 'legal' ? 'swatch sq' : (type === 'disc' ? 'swatch tri' : 'swatch'));
      const swatchVar = type === 'hlr' ? '--cat-wp' : (type === 'topic' ? '--type-topic' : (type === 'ts' ? '--type-ts' : (type === 'disc' ? '--type-disc' : '--type-legal-cir')));
      div.innerHTML = `<span class="check"></span><span class="${swatchClass}" style="background:var(${swatchVar})"></span><span class="label">${label}</span><span class="count">${count}</span>`;
      div.addEventListener('click', () => {
        if (activeTypes.has(type)) { activeTypes.delete(type); div.classList.remove('active'); }
        else { activeTypes.add(type); div.classList.add('active'); }
        applyFilters();
      });
      wrap.appendChild(div);
    });
  }

  function buildCategoryFilters() {
    const wrap = document.getElementById('categoryFilters');
    HLR_DATA.stats.categories.forEach(c => {
      const cnt = HLR_DATA.nodes.filter(n => n.type === 'hlr' && n.category === c).length;
      const div = document.createElement('div');
      div.className = 'filter-pill active';
      div.dataset.category = c;
      const cv = CAT_COLOR_VAR[c] || '--text-subtle';
      div.innerHTML = `<span class="check"></span><span class="swatch" style="background:var(${cv})"></span><span class="label">${escapeHtml(c)}</span><span class="count">${cnt}</span>`;
      div.addEventListener('click', () => {
        if (activeCategories.has(c)) { activeCategories.delete(c); div.classList.remove('active'); }
        else { activeCategories.add(c); div.classList.add('active'); }
        applyFilters();
      });
      wrap.appendChild(div);
    });
  }

  function buildTopicFilters() {
    const wrap = document.getElementById('topicFilters');
    const topicNodes = HLR_DATA.nodes.filter(n => n.type === 'topic')
      .sort((a, b) => +a.topic - +b.topic);
    document.getElementById('topicsCount').textContent = topicNodes.length;
    topicNodes.forEach(t => {
      const div = document.createElement('div');
      div.className = 'filter-pill active';
      div.dataset.topic = t.topic;
      const title = t.topic_title.length > 30 ? t.topic_title.slice(0, 30) + '…' : t.topic_title;
      div.innerHTML = `<span class="check"></span><span class="label">T${t.topic} · ${escapeHtml(title)}</span><span class="count">${t.hlr_count}</span>`;
      div.addEventListener('click', () => {
        if (activeTopics.has(t.topic)) { activeTopics.delete(t.topic); div.classList.remove('active'); }
        else { activeTopics.add(t.topic); div.classList.add('active'); }
        applyFilters();
      });
      wrap.appendChild(div);
    });
  }

  function buildPersonalFilters() {
    const wrap = document.getElementById('personalFilters');
    const c = personal.counts();
    const items = [
      { key: 'bookmarked', label: 'Bookmarked', count: c.bookmarked, color: '--bookmark' },
      { key: 'started', label: 'In progress', count: c.started, color: '--status-started' },
      { key: 'implemented', label: 'Implemented', count: c.impl, color: '--status-impl' },
      { key: 'verified', label: 'Verified', count: c.verified, color: '--status-verified' },
      { key: 'hasNotes', label: 'Has notes', count: c.notes, color: '--text-muted' },
      { key: 'hasFile', label: 'Has file link', count: c.files, color: '--text-muted' },
    ];
    wrap.innerHTML = '';
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'filter-pill' + (personalFilters[it.key] ? ' active' : '');
      div.innerHTML = `<span class="check"></span><span class="swatch" style="background:var(${it.color})"></span><span class="label">${it.label}</span><span class="count">${it.count}</span>`;
      div.addEventListener('click', () => {
        personalFilters[it.key] = !personalFilters[it.key];
        div.classList.toggle('active', personalFilters[it.key]);
        applyFilters();
      });
      wrap.appendChild(div);
    });
  }

  document.querySelector('[data-action=all-cats]').addEventListener('click', () => {
    HLR_DATA.stats.categories.forEach(c => activeCategories.add(c));
    document.querySelectorAll('#categoryFilters .filter-pill').forEach(p => p.classList.add('active'));
    applyFilters();
  });
  document.querySelector('[data-action=none-cats]').addEventListener('click', () => {
    activeCategories.clear();
    document.querySelectorAll('#categoryFilters .filter-pill').forEach(p => p.classList.remove('active'));
    applyFilters();
  });
  document.querySelector('[data-action=all-topics]').addEventListener('click', () => {
    HLR_DATA.nodes.filter(n => n.type === 'topic').forEach(t => activeTopics.add(t.topic));
    document.querySelectorAll('#topicFilters .filter-pill').forEach(p => p.classList.add('active'));
    applyFilters();
  });
  document.querySelector('[data-action=none-topics]').addEventListener('click', () => {
    activeTopics.clear();
    document.querySelectorAll('#topicFilters .filter-pill').forEach(p => p.classList.remove('active'));
    applyFilters();
  });

  function nodePassesPersonalFilter(n) {
    // If no personal filter is active, pass all
    const anyActive = Object.values(personalFilters).some(v => v);
    if (!anyActive) return true;
    if (n.type !== 'hlr') return false; // Personal filters only apply to HLRs
    const id = n.id;
    if (personalFilters.bookmarked && !personal.isBookmarked(id)) return false;
    if (personalFilters.hasNotes && !personal.getNotes(id)) return false;
    if (personalFilters.hasFile && !personal.getFile(id)) return false;
    const status = personal.getStatus(id);
    const wantStatus = personalFilters.started || personalFilters.implemented || personalFilters.verified;
    if (wantStatus) {
      if (personalFilters.started && status === 'started') return true;
      if (personalFilters.implemented && status === 'implemented') return true;
      if (personalFilters.verified && status === 'verified') return true;
      // If status filter active but this HLR doesn't match, only pass if other personal filters match
      if (!personalFilters.bookmarked && !personalFilters.hasNotes && !personalFilters.hasFile) return false;
    }
    return true;
  }

  function applyFilters() {
    let visible = 0;
    cy.batch(() => {
      cy.nodes().forEach(node => {
        const n = nodeLookup[node.id()];
        if (!n) return;
        const okType = activeTypes.has(n.type);
        const okCat = n.type !== 'hlr' || activeCategories.has(n.category);
        const okTopic = !n.topic || activeTopics.has(n.topic);
        const okEmpty = n.type !== 'hlr' || !hideEmpty || !n.is_empty;
        const okPersonal = nodePassesPersonalFilter(n);
        if (okType && okCat && okTopic && okEmpty && okPersonal) {
          node.style('display', 'element');
          if (n.type === 'hlr') visible++;
        } else {
          node.style('display', 'none');
        }
      });
    });
    document.getElementById('statPill').textContent =
      `${visible} / ${HLR_DATA.stats.hlr_nodes} HLRs visible · ${HLR_DATA.stats.total_nodes} total`;
  }

