  // ============================================================
  // Lookups & helpers
  // ============================================================
  const nodeLookup = {};
  HLR_DATA.nodes.forEach(n => { nodeLookup[n.id] = n; });

  // Aliases for legal node lookup (allow searching by "CIR 2024/2977")
  const legalAliases = {};
  HLR_DATA.nodes.forEach(n => {
    if (n.type === 'legal') {
      legalAliases[n.label] = n.id;
      legalAliases[n.label.toLowerCase()] = n.id;
    }
  });

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function getCSS(varName) {
    return getComputedStyle(document.body).getPropertyValue(varName).trim();
  }

  const CAT_COLOR_VAR = {
    'Wallet Providers': '--cat-wp',
    'Member States & Registrars': '--cat-ms',
    'Attestation & PID Providers': '--cat-ap',
    'Relying Parties': '--cat-rp',
    'Protocols & Interoperability': '--cat-pio',
    'Data Models & Attestation Rules': '--cat-dm',
  };

  function legalColorVar(kind) {
    return ({
      'regulation': '--type-legal-reg',
      'cir': '--type-legal-cir',
      'directive': '--type-legal-dir',
      'delegated': '--type-legal-cdr',
    })[kind] || '--type-legal-cir';
  }

  function nodeColor(n) {
    if (n.type === 'hlr') return n.is_empty ? getCSS('--node-empty') : getCSS(CAT_COLOR_VAR[n.category] || '--text-subtle');
    if (n.type === 'topic') return getCSS('--type-topic');
    if (n.type === 'ts') return getCSS('--type-ts');
    if (n.type === 'legal') return getCSS(legalColorVar(n.kind));
    if (n.type === 'disc') return getCSS(n.is_rr ? '--type-disc-rr' : '--type-disc');
    return getCSS('--text-subtle');
  }

  function nodeShape(t, isRr) {
    if (t === 'topic') return 'diamond';
    if (t === 'ts') return 'round-rectangle';
    if (t === 'legal') return 'rectangle';
    if (t === 'disc') return isRr ? 'vee' : 'triangle';
    return 'ellipse';
  }

  function discColorVar(isRr) { return isRr ? '--type-disc-rr' : '--type-disc'; }

