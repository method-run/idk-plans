// idk-plans site: tree tabs, mobile menu, search, and clickable diagram boxes.
(() => {
  const root = window.IDK_ROOT || './';

  // Tree tabs in the sidebar.
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  const panels = [...document.querySelectorAll('.tree-panel')];
  const select = (tree) => {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tree === tree)));
    panels.forEach((p) => { p.hidden = p.dataset.tree !== tree; });
  };
  tabs.forEach((t) => t.addEventListener('click', () => {
    select(t.dataset.tree);
    try { localStorage.setItem('idk-tree', t.dataset.tree); } catch { /* storage may be blocked */ }
  }));
  const current = document.querySelector('.tree-panel:not([hidden])')?.dataset.tree;
  const here = panels.find((p) => p.querySelector('[aria-current="page"]'));
  let saved = null;
  try { saved = localStorage.getItem('idk-tree'); } catch { /* ignore */ }
  const savedHasPage = saved && panels.find((p) => p.dataset.tree === saved)?.querySelector('[aria-current="page"]');
  select(savedHasPage ? saved : here?.dataset.tree || current);

  // Mobile menu.
  const menu = document.querySelector('.menu');
  menu?.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    menu.setAttribute('aria-expanded', String(open));
  });

  // Search over titles, aliases, and summaries.
  const input = document.querySelector('.search input');
  const results = document.querySelector('.search .results');
  const index = window.IDK_INDEX || [];
  const render = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.hidden = true; results.innerHTML = ''; return; }
    const scored = [];
    for (const item of index) {
      const title = item.title.toLowerCase();
      const aliases = item.aliases.map((a) => a.toLowerCase());
      let score = 0;
      if (title.startsWith(q)) score = 4;
      else if (title.includes(q)) score = 3;
      else if (aliases.some((a) => a.includes(q))) score = 2;
      else if (item.summary.toLowerCase().includes(q) || item.id.includes(q)) score = 1;
      if (score) scored.push([score, item]);
    }
    scored.sort((a, b) => b[0] - a[0] || a[1].title.localeCompare(b[1].title));
    results.innerHTML = '';
    for (const [, item] of scored.slice(0, 12)) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = root + item.url.replace(/index\.html$/, '');
      a.textContent = item.title;
      const p = document.createElement('span');
      p.textContent = item.summary;
      a.append(p);
      li.append(a);
      results.append(li);
    }
    if (!scored.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No pages match.';
      results.append(li);
    }
    results.hidden = false;
  };
  input?.addEventListener('input', render);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.value = ''; render(); }
    if (e.key === 'Enter') results.querySelector('a')?.click();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !/input|textarea/i.test(document.activeElement?.tagName)) {
      e.preventDefault();
      input?.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search')) results.hidden = true;
  });

  // Make diagram boxes that name a page into links (called after Mermaid renders).
  window.idkLinkDiagrams = () => {
    for (const pre of document.querySelectorAll('pre.mermaid')) {
      let links = {};
      try { links = JSON.parse(pre.dataset.links || '{}'); } catch { /* ignore */ }
      for (const g of pre.querySelectorAll('g.node')) {
        const m = g.id.match(/flowchart-(.+?)-\d+$/);
        const url = m && links[m[1]];
        if (!url) continue;
        g.classList.add('linked');
        g.setAttribute('role', 'link');
        g.setAttribute('tabindex', '0');
        const go = () => { window.location.href = url; };
        g.addEventListener('click', go);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      }
    }
  };
})();
