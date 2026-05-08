  // ============================================================
  // Glossary popover (singleton, delegated hover)
  // ============================================================
  (function () {
    const pop = document.createElement('div');
    pop.className = 'gloss-popover';
    pop.id = 'glossPopover';
    document.body.appendChild(pop);
    let hideT = null;

    function position(el) {
      const r = el.getBoundingClientRect();
      // Try to place below; if too close to bottom, place above.
      const popH = Math.min(220, pop.offsetHeight || 120);
      const placeBelow = r.bottom + popH + 8 < window.innerHeight;
      const top = (placeBelow ? r.bottom + 6 : r.top - popH - 6) + window.scrollY;
      let left = r.left + window.scrollX;
      const popW = Math.min(380, pop.offsetWidth || 320);
      if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
      if (left < 8) left = 8;
      pop.style.top = top + 'px';
      pop.style.left = left + 'px';
    }

    function show(el) {
      const key = el.dataset.gloss;
      const defn = (HLR_DATA.definitions || {})[key];
      if (!defn) return;
      const topicLink = defn.topic_ref
        ? `<button class="gp-topic-link" data-gloss-topic="${escapeHtml(defn.topic_ref)}">↗ See Topic ${escapeHtml(defn.topic_ref)}</button>`
        : '';
      pop.innerHTML = `
        <div class="gp-head">
          <span class="gp-term">${escapeHtml(defn.display || defn.term)}</span>
          <span class="gp-source gp-${escapeHtml(defn.source)}">${escapeHtml(defn.source)}</span>
        </div>
        <p class="gp-body">${escapeHtml(defn.body)}</p>
        ${topicLink}
      `;
      position(el);
      pop.classList.add('show');
      pop.querySelectorAll('[data-gloss-topic]').forEach(b => {
        b.addEventListener('click', e => {
          e.stopPropagation();
          const tn = b.dataset.glossTopic;
          hide();
          focusNode('topic_' + tn);
        });
      });
    }
    function hide() { pop.classList.remove('show'); }

    // Delegate hover from anywhere in the document — covers HLR detail body,
    // notes, narratives, lens panel, atlas, quiz, paths, blueprints, etc.
    document.body.addEventListener('mouseover', e => {
      const t = e.target.closest('.gloss');
      if (!t) return;
      clearTimeout(hideT);
      show(t);
    });
    document.body.addEventListener('mouseout', e => {
      const t = e.target.closest('.gloss');
      if (!t) return;
      // Delay so the user can move onto the popover itself (e.g. to click "See Topic").
      hideT = setTimeout(hide, 220);
    });
    pop.addEventListener('mouseenter', () => clearTimeout(hideT));
    pop.addEventListener('mouseleave', () => { hideT = setTimeout(hide, 100); });

    // Esc closes
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && pop.classList.contains('show')) hide();
    });

    // Hide on scroll/click-outside
    document.addEventListener('scroll', hide, true);
    document.addEventListener('click', e => {
      if (e.target.closest('.gloss') || e.target.closest('.gloss-popover')) return;
      hide();
    });
  })();

  // Tension edges in graph: distinctive style
  cy.style().selector('edge[type="tension"]').style({
    'line-color': '#DC2626',
    'line-style': 'dashed',
    'line-dash-pattern': [6, 3],
    'opacity': 0.55,
    'width': 1.6,
    'target-arrow-shape': 'none',
    'curve-style': 'bezier',
  }).update();

