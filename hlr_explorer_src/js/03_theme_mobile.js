  // ============================================================
  // Theme
  // ============================================================
  const themeBtn = document.getElementById('themeBtn');
  const saved = localStorage.getItem('hlr-theme');
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && sysDark)) document.body.classList.add('dark');
  themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('hlr-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    requestAnimationFrame(() => cy.style().update());
  });

  // ============================================================
  // Mobile toggles
  // ============================================================
  document.getElementById('mtFilters').addEventListener('click', () => {
    document.getElementById('leftPanel').classList.toggle('open');
    document.getElementById('rightPanel').classList.remove('open');
  });
  document.getElementById('mtDetail').addEventListener('click', () => {
    document.getElementById('rightPanel').classList.toggle('open');
    document.getElementById('leftPanel').classList.remove('open');
  });

