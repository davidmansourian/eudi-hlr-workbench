  // ============================================================
  // Personal layer (localStorage)
  // ============================================================
  const PL_KEY_PREFIX = 'eudi-hlr:';
  const personal = {
    getStatus(id) { return localStorage.getItem(PL_KEY_PREFIX + id + ':status') || 'none'; },
    setStatus(id, status) {
      if (status === 'none') localStorage.removeItem(PL_KEY_PREFIX + id + ':status');
      else localStorage.setItem(PL_KEY_PREFIX + id + ':status', status);
    },
    getNotes(id) { return localStorage.getItem(PL_KEY_PREFIX + id + ':notes') || ''; },
    setNotes(id, val) {
      if (!val) localStorage.removeItem(PL_KEY_PREFIX + id + ':notes');
      else localStorage.setItem(PL_KEY_PREFIX + id + ':notes', val);
    },
    getFile(id) { return localStorage.getItem(PL_KEY_PREFIX + id + ':file') || ''; },
    setFile(id, val) {
      if (!val) localStorage.removeItem(PL_KEY_PREFIX + id + ':file');
      else localStorage.setItem(PL_KEY_PREFIX + id + ':file', val);
    },
    isBookmarked(id) { return localStorage.getItem(PL_KEY_PREFIX + id + ':bookmark') === '1'; },
    setBookmarked(id, val) {
      if (val) localStorage.setItem(PL_KEY_PREFIX + id + ':bookmark', '1');
      else localStorage.removeItem(PL_KEY_PREFIX + id + ':bookmark');
    },
    counts() {
      let started = 0, impl = 0, verified = 0, bookmarked = 0, notes = 0, files = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(PL_KEY_PREFIX)) continue;
        if (k.endsWith(':status')) {
          const v = localStorage.getItem(k);
          if (v === 'started') started++;
          else if (v === 'implemented') impl++;
          else if (v === 'verified') verified++;
        } else if (k.endsWith(':bookmark')) bookmarked++;
        else if (k.endsWith(':notes')) notes++;
        else if (k.endsWith(':file')) files++;
      }
      return { started, impl, verified, bookmarked, notes, files };
    },
  };

