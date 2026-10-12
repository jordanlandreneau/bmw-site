/*
 * Site engine. You normally never need to edit this file —
 * change words in /content/*.md and settings in site.config.js.
 */
(function () {
  const S = window.SITE;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  let currentTab = null;
  const searchIndex = [];

  marked.setOptions({ gfm: true, breaks: true });

  /* ---------- Header / footer ---------- */
  document.title = `${S.title} · ${S.subtitle}`;
  $('#siteTitle').textContent = S.title;
  $('#siteSubtitle').textContent = S.subtitle;
  $('#footerText').textContent = S.footer;
  if (S.footerLogo) $('#footerLogo').src = S.footerLogo; else $('#footerLogo').remove();


  // Keep sticky elements lined up under the header
  const syncHeader = () => document.documentElement.style.setProperty('--topbar-h', $('.topbar').offsetHeight + 'px');
  syncHeader(); window.addEventListener('resize', syncHeader);

  /* ---------- Live clock (dealership time) ---------- */
  const clockFmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: S.timeZone
  });
  const tick = () => { $('#clock').textContent = clockFmt.format(new Date()); };
  tick(); setInterval(tick, 1000);

  function todayIndex() {
    const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: S.timeZone }).format(new Date());
    return DAYS.indexOf(wd.slice(0, 3).toLowerCase());
  }

  /* ---------- Load + render all content ---------- */
  async function load() {
    const content = $('#content');
    try {
      const r = await fetch('content/sections.json', { cache: 'no-cache' });
      if (r.ok) { S.sectionsJson = await r.text(); S.tabs = JSON.parse(S.sectionsJson).tabs; }
    } catch (e) { console.warn('Using tabs from site.config.js', e); }
    S.tabs = S.tabs || [];
    $('#tabs').innerHTML = S.tabs.map(t => `<a href="#/${t.id}" data-tab="${t.id}">${t.label}</a>`).join('');
    const jobs = [];
    S.tabs.forEach(tab => tab.sections.forEach(sec => {
      jobs.push(fetch(`content/${sec.file}`, { cache: 'no-cache' })
        .then(r => r.ok ? r.text() : Promise.reject(new Error(`${r.status} ${sec.file}`)))
        .then(md => { sec.md = md; })
        .catch(err => { sec.error = err.message; }));
    }));
    jobs.push(fetch('content/banners.md', { cache: 'no-cache' })
      .then(r => r.ok ? r.text() : '')
      .then(md => { S.bannersMd = md; S.banners = parseBanners(md); })
      .catch(() => { S.banners = S.banners || []; }));
    await Promise.all(jobs);

    content.innerHTML = '';
    S.tabs.forEach(tab => {
      const page = document.createElement('div');
      page.className = 'page'; page.dataset.tab = tab.id; page.hidden = true;
      tab.sections.forEach(sec => page.appendChild(renderSection(tab, sec)));
      content.appendChild(page);
    });
    buildSearchIndex();
    route();
  }

  function renderSection(tab, sec) {
    const wrap = document.createElement('section');
    wrap.className = 'section' + (sec.style ? ' ' + sec.style : '');
    wrap.id = 's-' + sec.id;
    wrap.dataset.tab = tab.id;

    const body = document.createElement('div');
    body.className = 'section-body content';
    if (sec.error) body.innerHTML = `<p class="error">Couldn't load <code>content/${sec.file}</code> (${sec.error}).</p>`;
    else body.innerHTML = marked.parse(sec.md);

    // First "## Heading" in the file becomes the section title
    let title = sec.label;
    const first = body.firstElementChild;
    if (first && first.tagName === 'H2') { title = first.textContent; first.remove(); }

    wrap.innerHTML = `<div class="section-head"><h2>${escapeHtml(title)}</h2>${S.editing !== false && !sec.error ? `<button type="button" class="edit" data-edit="${sec.id}" title="Edit this section">✎ Edit</button>` : ''}</div>`;
    wrap.appendChild(body);

    // A line like "Map: 555 W 57th St, New York, NY" becomes an English Google Map
    $$('p', body).forEach(p => {
      const m = p.textContent.trim().match(/^map:\s*(.+)$/i);
      if (!m || p.children.length > 1) return;
      const f = document.createElement('iframe');
      f.className = 'map'; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade'; f.allowFullscreen = true;
      f.title = 'Map of ' + m[1];
      f.src = 'https://maps.google.com/maps?q=' + encodeURIComponent(m[1]) + '&hl=en&z=16&output=embed';
      p.replaceWith(f);
    });
    if (sec.collapsible) makeCollapsible(body);
    if (sec.style === 'logins') makeLoginCards(body);
    $$('table', body).forEach(t => {
      const w = document.createElement('div'); w.className = 'table-wrap';
      t.replaceWith(w); w.appendChild(t);
      highlightToday(t);
    });
    $$('a[href^="http"]', body).forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    // Email addresses become click-to-copy (instead of opening a mail app)
    $$('a[href^="mailto:"]', body).forEach(a => { if (a.textContent.includes('@')) a.replaceWith(copyButton(a.textContent)); });
    autoCopy(body);
    return wrap;
  }

  // Each "## Heading" (after the first) becomes a click-to-open panel
  function makeCollapsible(body) {
    let panel = null;
    [...body.childNodes].forEach(node => {
      if (node.nodeType === 1 && node.tagName === 'H2') {
        panel = document.createElement('details');
        panel.className = 'panel';
        panel.innerHTML = `<summary>${node.innerHTML}</summary><div class="panel-body"></div>`;
        node.replaceWith(panel);
      } else if (panel) {
        panel.lastElementChild.appendChild(node);
      }
    });
  }

  // Each "### Name" + its lines becomes a login card; values after "User:" / "Pass:" are click-to-copy
  function makeLoginCards(body) {
    const grid = document.createElement('div'); grid.className = 'logins-grid';
    let card = null;
    [...body.childNodes].forEach(node => {
      if (node.nodeType === 1 && node.tagName === 'H3') {
        card = document.createElement('div'); card.className = 'login-card';
        grid.appendChild(card); card.appendChild(node);
      } else if (card) card.appendChild(node);
    });
    if (grid.children.length) body.prepend(grid);
    $$('li', grid).forEach(li => {
      const strong = li.firstElementChild;
      if (!strong || strong.tagName !== 'STRONG') return;
      const value = li.textContent.slice(strong.textContent.length).trim();
      if (!value) return;
      [...li.childNodes].slice(1).forEach(n => n.remove());
      li.append(' ', copyButton(value));
    });
  }

  // Highlight today's column/row in schedule tables (Mon, Tue, …, or ranges like "Mon - Fri")
  function highlightToday(table) {
    const today = todayIndex();
    const headCells = $$('thead th', table);
    headCells.forEach((th, col) => {
      if (col === 0) return;
      if (daysIn(th.textContent).has(today)) {
        th.classList.add('today');
        $$('tbody tr', table).forEach(tr => tr.children[col] && tr.children[col].classList.add('today'));
      }
    });
  }
  function daysIn(text) {
    const set = new Set();
    const t = text.toLowerCase();
    const found = [...t.matchAll(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*/g)].map(m => DAYS.indexOf(m[1]));
    if (!found.length) return set;
    if (found.length === 2 && /[-–]/.test(t)) {
      for (let d = found[0]; ; d = (d + 1) % 7) { set.add(d); if (d === found[1]) break; }
    } else found.forEach(d => set.add(d));
    return set;
  }

  // Turn every email address and phone number into a click-to-copy button
  const COPY_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|((?:\+?1[-. ]?)?\(?\b\d{3}\)?[-. ]\d{2,3}[-. ]\d{4}\b)/g;
  function autoCopy(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest('a,button,summary,code,script,iframe,h2') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const text = n.nodeValue; COPY_RE.lastIndex = 0;
      if (!COPY_RE.test(text)) return;
      COPY_RE.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = COPY_RE.exec(text))) {
        frag.append(text.slice(last, m.index), copyButton(m[0]));
        last = m.index + m[0].length;
      }
      frag.append(text.slice(last));
      n.replaceWith(frag);
    });
  }
  function copyButton(value) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'copy'; b.textContent = value; b.title = 'Click to copy';
    return b;
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('button.copy'); if (!b) return;
    const v = b.textContent;
    try { await navigator.clipboard.writeText(v); }
    catch { const i = document.createElement('textarea'); i.value = v; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); }
    b.classList.add('copied'); setTimeout(() => b.classList.remove('copied'), 1500);
    toast(`Copied: ${v}`);
  });
  let toastTimer;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1600); }

  /* ---------- Routing: #/tab or #/tab/section ---------- */
  function route() {
    const [, tabId, secId] = (location.hash.match(/^#\/([^/]+)(?:\/(.+))?/) || []);
    const tab = S.tabs.find(t => t.id === tabId) || S.tabs[0];
    showTab(tab);
    if (secId) scrollToSection(secId);
    else window.scrollTo(0, 0);
    document.body.classList.remove('nav-open');
  }
  function showTab(tab, force) {
    if (currentTab === tab.id && !force) return;
    currentTab = tab.id;
    $$('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab.id));
    $$('.page').forEach(p => { p.hidden = p.dataset.tab !== tab.id; });
    renderNav(tab);
    if (!force) setupBanner(tab);
    observeSections();
  }
  function renderNav(tab) {
    $('#sectionNav').innerHTML = tab.sections.map(s =>
      `<a href="#/${tab.id}/${s.id}" data-sec="${s.id}" class="${s.style === 'alert' ? 'alert-link' : ''}">${escapeHtml(s.label)}</a>`).join('') +
      (S.editing !== false ? `<button type="button" class="add-section" data-tab="${tab.id}">+ Add section</button>` : '');
  }
  function scrollToSection(id) {
    const el = document.getElementById('s-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.addEventListener('hashchange', route);
  $('#sectionNav').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return;
    if (a.getAttribute('href') === location.hash) { e.preventDefault(); scrollToSection(a.dataset.sec); document.body.classList.remove('nav-open'); }
  });

  // Highlight the section you're currently reading in the sidebar
  let observer;
  function observeSections() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const id = en.target.id.slice(2);
          $$('#sectionNav a').forEach(a => a.classList.toggle('current', a.dataset.sec === id));
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$(`.page[data-tab="${currentTab}"] .section`).forEach(s => observer.observe(s));
  }

  /* ---------- Banner carousel ---------- */
  function parseBanners(md) {
    return (md || '').split('\n').map(l => l.match(/^\s*[-*]\s+(?:!\[[^\]]*\]\()?(\S+?)\)?\s*$/)).filter(Boolean).map(m => m[1]);
  }
  let bannerTimer;
  function setupBanner(tab) {
    const box = $('#banner'); clearInterval(bannerTimer);
    if (!tab.showBanners || ((!S.banners || !S.banners.length) && S.editing === false)) { box.hidden = true; return; }
    box.hidden = false;
    S.banners = S.banners || [];
    box.classList.toggle('empty', !S.banners.length);
    box.innerHTML = (S.editing !== false ? '<button type="button" class="banner-edit" id="bannerEdit">✎ Edit images</button>' : '') + S.banners.map((src, i) => `<img src="${src}" alt="" class="${i ? '' : 'on'}" onerror="this.remove()">`).join('') +
      `<div class="dots">${S.banners.map((_, i) => `<button class="${i ? '' : 'on'}" data-i="${i}" aria-label="Banner ${i + 1}"></button>`).join('')}</div>`;
    let i = 0;
    const show = n => { const imgs = $$('img', box), dots = $$('.dots button', box); if (!imgs.length) return;
      i = (n + imgs.length) % imgs.length; imgs.forEach((im, k) => im.classList.toggle('on', k === i)); dots.forEach((d, k) => d.classList.toggle('on', k === i)); };
    box.onclick = e => { const d = e.target.closest('.dots button'); if (d) { show(+d.dataset.i); } };
    bannerTimer = setInterval(() => show(i + 1), 6000);
  }

  /* ---------- Search across every tab ---------- */
  function buildSearchIndex() {
    searchIndex.length = 0;
    S.tabs.forEach(tab => tab.sections.forEach(sec => {
      const el = document.getElementById('s-' + sec.id); if (!el) return;
      const title = $('.section-head h2', el).textContent;
      $$('p, li, tr, h3, summary', el).forEach(node => {
        if (node.tagName === 'LI' && node.querySelector('li')) return; // use the inner items
        const text = node.textContent.replace(/\s+/g, ' ').trim();
        if (text) searchIndex.push({ tab, sec, title, node, text, lower: text.toLowerCase() });
      });
    }));
  }
  const searchBox = $('#search'), results = $('#searchResults');
  searchBox.addEventListener('input', () => {
    const q = searchBox.value.trim().toLowerCase();
    if (q.length < 2) { results.hidden = true; $('#sectionNav').hidden = false; return; }
    const terms = q.split(/\s+/);
    const hits = searchIndex.filter(r => terms.every(t => r.lower.includes(t))).slice(0, 60);
    results.hidden = false; $('#sectionNav').hidden = true;
    results.innerHTML = hits.length ? hits.map((h, i) =>
      `<a href="#" data-i="${searchIndex.indexOf(h)}"><span class="where">${escapeHtml(h.tab.label)} › ${escapeHtml(h.title)}</span>${snippet(h.text, terms)}</a>`).join('')
      : `<div class="none">No matches for “${escapeHtml(searchBox.value)}”.</div>`;
  });
  results.addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    const r = searchIndex[+a.dataset.i];
    if (location.hash !== `#/${r.tab.id}`) { history.replaceState(null, '', `#/${r.tab.id}`); }
    showTab(r.tab);
    const det = r.node.closest('details'); if (det) det.open = true;
    r.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    r.node.animate([{ background: '#ffe14d' }, { background: 'transparent' }], { duration: 2200 });
    document.body.classList.remove('nav-open');
  });
  function snippet(text, terms) {
    const i = Math.max(0, text.toLowerCase().indexOf(terms[0]) - 40);
    let s = escapeHtml((i ? '…' : '') + text.slice(i, i + 140) + (text.length > i + 140 ? '…' : ''));
    terms.forEach(t => { s = s.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>'); });
    return s;
  }
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); document.body.classList.add('nav-open'); searchBox.focus(); }
    if (e.key === 'Escape') { searchBox.value = ''; searchBox.dispatchEvent(new Event('input')); document.body.classList.remove('nav-open'); }
  });

  /* ---------- Mobile menu ---------- */
  $('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
  $('#scrim').onclick = () => document.body.classList.remove('nav-open');


  // Hooks used by editor.js
  window.SiteApp = {
    renderSection, buildSearchIndex, toast, escapeHtml, parseBanners,
    currentTab: () => S.tabs.find(t => t.id === currentTab),
    refreshNav() { const t = S.tabs.find(x => x.id === currentTab); if (t) showTab(t, true); },
    refreshBanner() { const t = S.tabs.find(x => x.id === currentTab); if (t) setupBanner(t); },
    find(id) { for (const tab of S.tabs) for (const sec of tab.sections) if (sec.id === id) return { tab, sec }; return null; }
  };

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  load();
})();
