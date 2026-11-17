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

  // Color mode and contrast. Auto follows the system. The choice goes on <html> as
  // data-tm-mode or data-tm-contrast, which the theme and site.css read. Diagrams are drawn
  // once, in the page's mode, so a change of mode reloads a page that has diagrams.
  for (const group of document.querySelectorAll('[data-look]')) {
    const key = group.dataset.look;
    const show = () => group.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.value === (document.documentElement.dataset[key] || '')));
    });
    show();
    group.addEventListener('click', (e) => {
      const value = e.target.closest('button')?.dataset.value;
      if (value == null) return;
      if (value) document.documentElement.dataset[key] = value;
      else delete document.documentElement.dataset[key];
      show();
      try {
        const look = JSON.parse(localStorage.getItem('idk-look') || '{}');
        look[key] = value;
        localStorage.setItem('idk-look', JSON.stringify(look));
      } catch { /* storage may be blocked */ }
      if (key === 'tmMode' && document.querySelector('pre.mermaid')) window.location.reload();
    });
  }

  // The sidebar, on wide screens: the chevron button collapses it to a rail, and its right edge
  // drags (or takes the arrow keys) to set its width. Double-click the edge for the default
  // width. Both stay in the reader's browser.
  const html = document.documentElement;
  const remember = (key, value) => {
    try {
      const look = JSON.parse(localStorage.getItem('idk-look') || '{}');
      look[key] = value;
      localStorage.setItem('idk-look', JSON.stringify(look));
    } catch { /* storage may be blocked */ }
  };
  const collapse = document.querySelector('.collapse');
  const showCollapsed = () => {
    const collapsed = html.dataset.sidebar === 'collapsed';
    const label = collapsed ? 'Expand the sidebar' : 'Collapse the sidebar';
    collapse?.setAttribute('aria-expanded', String(!collapsed));
    collapse?.setAttribute('aria-label', label);
    collapse?.setAttribute('title', label);
  };
  showCollapsed();
  collapse?.addEventListener('click', () => {
    if (html.dataset.sidebar === 'collapsed') delete html.dataset.sidebar;
    else html.dataset.sidebar = 'collapsed';
    remember('sidebar', html.dataset.sidebar || '');
    showCollapsed();
  });

  const edge = document.querySelector('.resize');
  const sidebar = document.querySelector('.sidebar');
  const MIN = 200;
  const MAX = 560;
  const width = () => Math.round(sidebar.getBoundingClientRect().width);
  const setWidth = (w) => {
    const clamped = Math.round(Math.min(MAX, Math.max(MIN, w)));
    html.style.setProperty('--sidebar', `${clamped}px`);
    edge.setAttribute('aria-valuenow', String(clamped));
  };
  if (edge && sidebar) {
    edge.setAttribute('aria-valuemin', String(MIN));
    edge.setAttribute('aria-valuemax', String(MAX));
    edge.setAttribute('aria-valuenow', String(width()));
    edge.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      edge.setPointerCapture(e.pointerId);
      const start = e.clientX;
      const from = width();
      html.classList.add('resizing');
      const move = (ev) => setWidth(from + ev.clientX - start);
      const end = () => {
        edge.removeEventListener('pointermove', move);
        edge.removeEventListener('pointerup', end);
        edge.removeEventListener('pointercancel', end);
        html.classList.remove('resizing');
        remember('sidebarWidth', width());
      };
      edge.addEventListener('pointermove', move);
      edge.addEventListener('pointerup', end);
      edge.addEventListener('pointercancel', end);
    });
    edge.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 64 : 16;
      const to = { ArrowLeft: width() - step, ArrowRight: width() + step, Home: MIN, End: MAX }[e.key];
      if (to == null) return;
      e.preventDefault();
      setWidth(to);
      remember('sidebarWidth', width());
    });
    edge.addEventListener('dblclick', () => {
      html.style.removeProperty('--sidebar');
      edge.setAttribute('aria-valuenow', String(width()));
      remember('sidebarWidth', 0);
    });
  }

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
