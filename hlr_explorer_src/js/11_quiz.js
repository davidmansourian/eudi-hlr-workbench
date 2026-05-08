  // ============================================================
  // Quiz / Learn modal — SM-2-lite spaced repetition
  // ============================================================
  const QUIZ_KEY = PL_KEY_PREFIX + 'quiz:';
  const DAY_MS = 24 * 60 * 60 * 1000;
  personal.getCardState = (id) => {
    const raw = localStorage.getItem(QUIZ_KEY + id + ':state');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  };
  personal.setCardState = (id, st) => {
    if (!st) localStorage.removeItem(QUIZ_KEY + id + ':state');
    else localStorage.setItem(QUIZ_KEY + id + ':state', JSON.stringify(st));
  };
  personal.resetCardStates = () => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(QUIZ_KEY) && k.endsWith(':state')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  };
  personal.getQuizStreak = () => parseInt(localStorage.getItem(QUIZ_KEY + 'streak') || '0', 10);
  personal.setQuizStreak = (n) => localStorage.setItem(QUIZ_KEY + 'streak', String(n));
  personal.getQuizToday = () => {
    const raw = localStorage.getItem(QUIZ_KEY + 'today');
    if (!raw) return { date: '', count: 0 };
    try { return JSON.parse(raw); } catch (e) { return { date: '', count: 0 }; }
  };
  personal.bumpQuizToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    let t = personal.getQuizToday();
    if (t.date !== today) t = { date: today, count: 0 };
    t.count += 1;
    localStorage.setItem(QUIZ_KEY + 'today', JSON.stringify(t));
    return t.count;
  };

  const quizOverlay = document.getElementById('quizOverlay');
  const quizCardArea = document.getElementById('quizCardArea');
  const quizStat = document.getElementById('quizStat');
  const quizPos = document.getElementById('quizPos');
  const quizStreakEl = document.getElementById('quizStreak');
  const quizTodayEl = document.getElementById('quizToday');
  const quizFilterSource = document.getElementById('quizFilterSource');
  const quizFilterTopic = document.getElementById('quizFilterTopic');
  const quizFilterDeck = document.getElementById('quizFilterDeck');
  const quizFilterMyHlrs = document.getElementById('quizFilterMyHlrs');
  const quizFilterDueOnly = document.getElementById('quizFilterDueOnly');

  const QUIZ_CARDS = HLR_DATA.quiz || [];
  let quizSession = { cards: [], idx: 0, revealed: false, sessionStats: { reviewed: 0 } };

  // Card text supports light markdown (**bold**, *italic*, code), and gets the
  // full linkify pass (HLR / legal / TS / glossary). Paragraphs separated by
  // blank lines; single newlines become <br>.
  function quizCardMd(text) {
    let html = linkifyText(text);
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^\w])\*([^*\n]+)\*([^\w]|$)/g, '$1<em>$2</em>$3');
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    // Paragraph breaks
    html = html.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    return html;
  }

  function quizDueCount() {
    const now = Date.now();
    let due = 0;
    QUIZ_CARDS.forEach(c => {
      const st = personal.getCardState(c.id);
      if (!st || (st.due && st.due <= now)) due++;
    });
    return due;
  }

  function refreshLauncherBadge() {
    const due = quizDueCount();
    const badge = document.getElementById('learnDueBadge');
    if (!badge) return;
    if (due > 0 && due < QUIZ_CARDS.length) {
      badge.textContent = due;
      badge.style.display = '';
    } else if (due === QUIZ_CARDS.length) {
      // First-time use: hide badge so we don't display "109" on launch
      badge.style.display = 'none';
    } else {
      badge.style.display = 'none';
    }
  }

  function buildQuizFilters() {
    // Topics dropdown
    const topics = new Set();
    QUIZ_CARDS.forEach(c => { if (c.tags && c.tags.topic) topics.add(c.tags.topic); });
    const sortedTopics = [...topics].sort((a, b) => +a - +b);
    quizFilterTopic.innerHTML = '<option value="all">All topics</option>' +
      sortedTopics.map(t => {
        const tn = nodeLookup['topic_' + t];
        const lbl = tn ? `T${t} · ${tn.topic_title}` : `T${t}`;
        return `<option value="${escapeHtml(t)}">${escapeHtml(lbl)}</option>`;
      }).join('');
    // Decks dropdown
    const decks = HLR_DATA.stats.quiz_decks || [];
    quizFilterDeck.innerHTML = '<option value="all">All decks</option>' +
      decks.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  }

  function quizFilteredCards() {
    const src = quizFilterSource.value;
    const tp = quizFilterTopic.value;
    const dk = quizFilterDeck.value;
    const myOnly = quizFilterMyHlrs.checked;
    const dueOnly = quizFilterDueOnly.checked;
    const now = Date.now();
    const myHlrs = new Set();
    if (myOnly) {
      HLR_DATA.nodes.forEach(n => {
        if (n.type === 'hlr' && personal.getStatus(n.id) === 'started') myHlrs.add(n.id);
      });
    }
    return QUIZ_CARDS.filter(c => {
      if (src !== 'all' && c.source !== src) return false;
      if (tp !== 'all' && (c.tags || {}).topic !== tp) return false;
      if (dk !== 'all' && (c.tags || {}).deck !== dk) return false;
      if (myOnly) {
        const refs = c.hlr_refs || [];
        if (!refs.some(r => myHlrs.has(r))) return false;
      }
      if (dueOnly) {
        const st = personal.getCardState(c.id);
        if (st && st.due && st.due > now) return false;
      }
      return true;
    });
  }

  function startQuizSession() {
    let cards = quizFilteredCards();
    // Sort: due-now first (ascending due), then unseen, then rest by due ascending
    const now = Date.now();
    cards.sort((a, b) => {
      const sa = personal.getCardState(a.id);
      const sb = personal.getCardState(b.id);
      const da = sa && sa.due ? sa.due : Infinity;
      const db = sb && sb.due ? sb.due : Infinity;
      // Unseen (no state) treated as "due now" — sort them between strictly-due and not-yet-due
      const ka = sa ? (da <= now ? 0 : 2) : 1;
      const kb = sb ? (db <= now ? 0 : 2) : 1;
      if (ka !== kb) return ka - kb;
      return da - db;
    });
    // Light shuffle within the unseen tier so the order isn't deterministic
    const unseenStart = cards.findIndex(c => !personal.getCardState(c.id));
    const unseenEnd = cards.findIndex((c, i) => i > unseenStart && personal.getCardState(c.id));
    if (unseenStart >= 0) {
      const slice = cards.slice(unseenStart, unseenEnd > 0 ? unseenEnd : undefined);
      for (let i = slice.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slice[i], slice[j]] = [slice[j], slice[i]];
      }
      cards.splice(unseenStart, slice.length, ...slice);
    }
    quizSession = { cards, idx: 0, revealed: false, sessionStats: { reviewed: 0 } };
    renderQuizCard();
  }

  function renderQuizCard() {
    const { cards, idx, revealed } = quizSession;
    if (!cards.length) {
      quizCardArea.innerHTML = `
        <div class="quiz-empty">
          <strong>No cards match these filters.</strong><br>
          Try widening the filter, or pick a different source.
        </div>`;
      quizPos.textContent = '0 / 0';
      return;
    }
    if (idx >= cards.length) {
      quizCardArea.innerHTML = `
        <div class="quiz-empty">
          🎉 <strong>Session complete</strong> — ${quizSession.sessionStats.reviewed} cards reviewed.<br>
          Cards you rated will return when due. <button class="btn-text" id="quizDoMore">Start a new session →</button>
        </div>`;
      quizPos.textContent = `${cards.length} / ${cards.length}`;
      const more = document.getElementById('quizDoMore');
      if (more) more.addEventListener('click', startQuizSession);
      return;
    }
    const c = cards[idx];
    const tagBits = [];
    if (c.tags && c.tags.topic) {
      const tn = nodeLookup['topic_' + c.tags.topic];
      tagBits.push(`<span class="quiz-card-tag topic" data-jump="topic_${escapeHtml(c.tags.topic)}">T${escapeHtml(c.tags.topic)}${tn ? ' · ' + escapeHtml(tn.topic_title) : ''}</span>`);
    }
    if (c.tags && c.tags.deck) {
      tagBits.push(`<span class="quiz-card-tag">${escapeHtml(c.tags.deck)}</span>`);
    }
    (c.hlr_refs || []).slice(0, 3).forEach(h => {
      if (nodeLookup[h]) tagBits.push(`<span class="quiz-card-tag hlr" data-jump="${escapeHtml(h)}">${escapeHtml(h)}</span>`);
    });
    const sourceLabel = c.source === 'deck' ? 'Curated' : (c.source === 'pitfall' ? 'Pitfall' : 'Tension');
    const front = `
      <span class="quiz-card-source-badge ${c.source}">${sourceLabel}</span>
      <div class="quiz-card-q">${quizCardMd(c.q)}</div>
      ${revealed ? `<div class="quiz-card-a">${quizCardMd(c.a)}</div>` : ''}
      ${tagBits.length ? `<div class="quiz-card-tags">${tagBits.join('')}</div>` : ''}
    `;
    let controls;
    if (!revealed) {
      controls = `<div class="quiz-controls"><button class="quiz-btn" id="quizRevealBtn">Reveal answer <kbd>Space</kbd></button></div>`;
    } else {
      controls = `
        <div class="quiz-rate">
          <button data-rate="again">Again<kbd>1</kbd></button>
          <button data-rate="hard">Hard<kbd>2</kbd></button>
          <button data-rate="good">Good<kbd>3</kbd></button>
          <button data-rate="easy">Easy<kbd>4</kbd></button>
        </div>`;
    }
    quizCardArea.innerHTML = front + controls;
    quizPos.textContent = `${idx + 1} / ${cards.length}`;
    quizStat.textContent = `${quizSession.sessionStats.reviewed} reviewed · ${cards.length - idx} to go`;
    // Wire jumps and controls
    quizCardArea.querySelectorAll('[data-jump]').forEach(el => {
      el.addEventListener('click', () => { focusNode(el.dataset.jump); closeQuiz(); });
    });
    const revealBtn = quizCardArea.querySelector('#quizRevealBtn');
    if (revealBtn) revealBtn.addEventListener('click', revealCurrent);
    quizCardArea.querySelectorAll('[data-rate]').forEach(b => {
      b.addEventListener('click', () => rateCurrent(b.dataset.rate));
    });
  }

  function revealCurrent() {
    quizSession.revealed = true;
    renderQuizCard();
  }

  function rateCurrent(rate) {
    const { cards, idx } = quizSession;
    if (idx >= cards.length) return;
    const c = cards[idx];
    const prev = personal.getCardState(c.id) || { ease: 2.5, interval: 0, due: 0, last: 0, streak: 0, history: [] };
    const now = Date.now();
    let { ease, interval, streak } = prev;
    let newInterval;
    if (rate === 'again') {
      newInterval = 1; // 1 day
      streak = 0;
    } else if (rate === 'hard') {
      newInterval = Math.max(1, Math.round((interval || 1) * 1.2));
      ease = Math.max(1.3, ease - 0.15);
    } else if (rate === 'good') {
      newInterval = Math.max(1, Math.round((interval || 1) * ease));
      streak = (streak || 0) + 1;
    } else if (rate === 'easy') {
      newInterval = Math.max(2, Math.round((interval || 1) * ease * 1.3));
      ease = ease + 0.15;
      streak = (streak || 0) + 1;
    }
    const newState = {
      ease, interval: newInterval,
      due: now + newInterval * DAY_MS,
      last: now, streak,
      history: [...(prev.history || []), rate].slice(-12),
    };
    personal.setCardState(c.id, newState);
    quizSession.sessionStats.reviewed++;
    // Update streak: 'good'/'easy' increments global streak, 'again' resets it.
    let globalStreak = personal.getQuizStreak();
    if (rate === 'again') globalStreak = 0;
    else globalStreak++;
    personal.setQuizStreak(globalStreak);
    quizStreakEl.textContent = globalStreak;
    quizTodayEl.textContent = personal.bumpQuizToday();
    quizSession.idx++;
    quizSession.revealed = false;
    refreshLauncherBadge();
    renderQuizCard();
  }

  function openQuiz() {
    quizOverlay.classList.add('open');
    quizStreakEl.textContent = personal.getQuizStreak();
    const today = personal.getQuizToday();
    const isToday = today.date === new Date().toISOString().slice(0, 10);
    quizTodayEl.textContent = isToday ? today.count : 0;
    if (!quizFilterTopic.options.length) buildQuizFilters();
    startQuizSession();
  }
  function closeQuiz() { quizOverlay.classList.remove('open'); }

  document.getElementById('learnLauncher').addEventListener('click', openQuiz);
  document.getElementById('quizClose').addEventListener('click', closeQuiz);
  quizOverlay.addEventListener('click', e => { if (e.target === quizOverlay) closeQuiz(); });
  [quizFilterSource, quizFilterTopic, quizFilterDeck, quizFilterMyHlrs, quizFilterDueOnly].forEach(el => {
    el.addEventListener('change', startQuizSession);
  });
  document.getElementById('quizReshuffle').addEventListener('click', startQuizSession);

  // Keyboard shortcuts within quiz
  document.addEventListener('keydown', e => {
    if (!quizOverlay.classList.contains('open')) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'Escape') { e.preventDefault(); closeQuiz(); return; }
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (!quizSession.revealed && quizSession.idx < quizSession.cards.length) revealCurrent();
      return;
    }
    if (quizSession.revealed) {
      const map = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
      if (map[e.key]) { e.preventDefault(); rateCurrent(map[e.key]); }
    }
  });

  // Initialise launcher badge on load
  refreshLauncherBadge();

