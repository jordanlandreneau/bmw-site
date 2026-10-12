/*
 * In-page editor: click "Edit" on any section, change it right on the page, click Save.
 * Saving sends the section to /api/save, which updates the file in GitHub;
 * Vercel then republishes the site for everyone (about a minute).
 */
(function () {
  const App = window.SiteApp;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  let active = null; // { tab, sec, wrap, area, original }

  document.addEventListener('click', e => {
    const btn = e.target.closest('button.edit[data-edit]');
    if (btn) startEditing(btn.dataset.edit);
  });

  window.addEventListener('beforeunload', e => {
    if (active && toMarkdown(active.area) !== active.original) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- Enter / leave edit mode ---------- */
  function startEditing(id) {
    if (active) {
      if (active.sec.id === id) return;
      if (!confirm('You are already editing another section. Discard those changes?')) return;
      stopEditing();
    }
    const found = App.find(id); if (!found) return;
    const { tab, sec } = found;
    const wrap = document.getElementById('s-' + id);

    const area = document.createElement('div');
    area.className = 'section-body content edit-area';
    area.contentEditable = 'true';
    area.spellcheck = true;
    area.innerHTML = marked.parse(sec.md);
    $$('iframe', area).forEach(f => { f.contentEditable = 'false'; });

    const bar = document.createElement('div');
    bar.className = 'edit-bar';
    bar.innerHTML = `
      <div class="edit-tools">
        <button data-cmd="bold" title="Bold"><b>B</b></button>
        <button data-cmd="red" title="Red warning text"><span class="swatch red-sw"></span>Red</button>
        <button data-cmd="blue" title="Blue text"><span class="swatch blue-sw"></span>Blue</button>
        <button data-cmd="yellow" title="Yellow highlight"><span class="swatch yellow-sw"></span>Highlight</button>
        <button data-cmd="clear" title="Remove bold/colors from the selected text">Clear style</button>
        <span class="sep"></span>
        <button data-cmd="ul" title="Bullet list">• List</button>
        <button data-cmd="ol" title="Numbered list">1. List</button>
        <button data-cmd="heading" title="Make this line a sub-heading (click again to undo)">Heading</button>
        <button data-cmd="link" title="Turn the selected text into a link">Link</button>
        <span class="sep table-only"></span>
        <button data-cmd="rowAbove" class="table-only" title="Add a row above the one you're in">+ Row above</button>
        <button data-cmd="rowBelow" class="table-only" title="Add a row below the one you're in">+ Row below</button>
        <button data-cmd="rowDelete" class="table-only" title="Delete the row you're in">− Delete row</button>
      </div>
      <div class="edit-actions">
        <button data-cmd="deleteSection" class="ghost danger-text" title="Remove this whole section from the site">Delete section</button>
        <span class="edit-hint">Click any text to change it.</span>
        <button data-cmd="cancel" class="ghost">Cancel</button>
        <button data-cmd="save" class="primary">Save</button>
      </div>`;

    const body = $('.section-body', wrap);
    body.replaceWith(area);
    wrap.insertBefore(bar, area);
    wrap.classList.add('editing');
    if ($('details', wrap)) $$('details', wrap).forEach(d => d.open = true);

    active = { tab, sec, wrap, area, bar, original: toMarkdown(area) };

    bar.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); }); // keep text selection
    bar.addEventListener('click', e => { const b = e.target.closest('button[data-cmd]'); if (b) run(b.dataset.cmd); });
    document.addEventListener('selectionchange', updateTableButtons);
    updateTableButtons();
    area.focus();
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function stopEditing(newMd) {
    if (!active) return;
    const { tab, sec, wrap } = active;
    document.removeEventListener('selectionchange', updateTableButtons);
    if (newMd != null) sec.md = newMd;
    const fresh = App.renderSection(tab, sec);
    wrap.replaceWith(fresh);
    active = null;
    App.buildSearchIndex();
  }

  /* ---------- Toolbar ---------- */
  function run(cmd) {
    const { area } = active;
    if (cmd === 'save') return save();
    if (cmd === 'deleteSection') return deleteSection();
    if (cmd === 'cancel') {
      if (toMarkdown(area) !== active.original && !confirm('Discard your changes to this section?')) return;
      return stopEditing();
    }
    area.focus();
    document.execCommand('styleWithCSS', false, false);
    switch (cmd) {
      case 'bold': document.execCommand('bold'); break;
      case 'red': colorSelection('red'); break;
      case 'blue': colorSelection('blue'); break;
      case 'yellow': colorSelection('yellow'); break;
      case 'clear': document.execCommand('removeFormat'); unwrapColorSpans(); break;
      case 'ul': document.execCommand('insertUnorderedList'); break;
      case 'ol': document.execCommand('insertOrderedList'); break;
      case 'heading': {
        const block = currentBlock();
        document.execCommand('formatBlock', false, block && block.tagName === 'H3' ? 'p' : 'h3');
        break;
      }
      case 'link': {
        const url = prompt('Paste the link (web address):', 'https://');
        if (url && url !== 'https://') {
          if (window.getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${App.escapeHtml(url)}">${App.escapeHtml(url)}</a>`);
          else document.execCommand('createLink', false, url);
        }
        break;
      }
      case 'rowAbove': case 'rowBelow': {
        const tr = currentRow(); if (!tr) return;
        const row = document.createElement('tr');
        [...tr.children].forEach(() => { const td = document.createElement('td'); td.innerHTML = '<br>'; row.appendChild(td); });
        if (cmd === 'rowAbove' && tr.parentElement.tagName !== 'THEAD') tr.before(row);
        else if (tr.parentElement.tagName === 'THEAD') { const tb = tr.closest('table').tBodies[0] || tr.closest('table').createTBody(); tb.prepend(row); }
        else tr.after(row);
        placeCaret(row.firstElementChild);
        break;
      }
      case 'rowDelete': {
        const tr = currentRow(); if (!tr) return;
        if (tr.parentElement.tagName === 'THEAD') { alert("That's the header row. Click inside a regular row to delete it."); return; }
        if (confirm('Delete this row?')) tr.remove();
        break;
      }
    }
    updateTableButtons();
  }

  function colorSelection(cls) {
    const sel = window.getSelection();
    if (sel.isCollapsed) { App.toast('Select some text first, then click the color.'); return; }
    unwrapColorSpans(sel.getRangeAt(0));
    const range = sel.getRangeAt(0);
    // keep the change inside one line/cell (a triple-click selects past the end of the line)
    const startEl = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const blockEl = startEl.closest('li, p, h3, h4, td, th, blockquote') || active.area;
    if (!blockEl.contains(range.endContainer) || range.endContainer === blockEl.parentElement) {
      const last = [...blockEl.childNodes].filter(n => !(n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName))).pop();
      if (last) range.setEndAfter(last);
    }
    const span = document.createElement('span'); span.className = cls;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    sel.removeAllRanges(); const r = document.createRange(); r.selectNodeContents(span); sel.addRange(r);
  }
  function unwrapColorSpans(range) {
    const sel = window.getSelection(); if (!range && sel.rangeCount) range = sel.getRangeAt(0); if (!range) return;
    $$('span.red, span.blue, span.yellow, font[color]', active.area).forEach(sp => {
      if (range.intersectsNode(sp)) sp.replaceWith(...sp.childNodes);
    });
  }
  function currentNode() { const s = window.getSelection(); if (!s.rangeCount) return null; let n = s.getRangeAt(0).startContainer; return n.nodeType === 1 ? n : n.parentElement; }
  function currentBlock() { const n = currentNode(); return n && n.closest('p,h1,h2,h3,h4,li,div'); }
  function currentRow() { const n = currentNode(); const tr = n && n.closest('tr'); return tr && active.area.contains(tr) ? tr : null; }
  function placeCaret(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  function updateTableButtons() { if (!active) return; const inTable = !!currentRow(); $$('.table-only', active.bar).forEach(b => b.classList.toggle('dim', !inTable)); }

  /* ---------- Save ---------- */
  async function save() {
    const md = toMarkdown(active.area);
    if (md === active.original) { stopEditing(); App.toast('No changes to save.'); return; }
    const saveBtn = $('button[data-cmd="save"]', active.bar);
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    try {
      const sec = active.sec;
      const baseSha = sec.sha || await gitBlobSha(sec.originalMd ?? sec.md);
      let res = await post({ file: 'content/' + sec.file, content: md, baseSha });
      if (res.status === 401) {
        const pw = prompt('Enter the editor password to save changes:');
        if (!pw) throw new Error('Not saved — the editor password is needed.');
        try { localStorage.setItem('editorPassword', pw); } catch {}
        res = await post({ file: 'content/' + sec.file, content: md, baseSha });
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        if (!confirm('Someone else changed this section after you opened the page.\n\nOK = save yours anyway (replaces their change)\nCancel = keep editing (then reload the page to see their version)')) throw new Error('Not saved.');
        const r2 = await post({ file: 'content/' + sec.file, content: md, force: true });
        const d2 = await r2.json().catch(() => ({}));
        if (!r2.ok) throw new Error(d2.error || 'Save failed.');
        data.sha = d2.sha;
      } else if (!res.ok) {
        throw new Error(data.error || `Save failed (${res.status}).`);
      }
      if (sec.originalMd == null) sec.originalMd = sec.md;
      sec.sha = data.sha;
      stopEditing(md);
      App.toast('Saved! Everyone will see the change in about a minute.');
    } catch (err) {
      saveBtn.disabled = false; saveBtn.textContent = 'Save';
      alert(err.message || 'Save failed.');
    }
  }
  function post(body) {
    let pw = ''; try { pw = localStorage.getItem('editorPassword') || ''; } catch {}
    return fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Editor-Password': pw }, body: JSON.stringify(body) });
  }
  async function gitBlobSha(text) {
    const bytes = new TextEncoder().encode(text);
    const head = new TextEncoder().encode(`blob ${bytes.length}\0`);
    const all = new Uint8Array(head.length + bytes.length); all.set(head); all.set(bytes, head.length);
    const hash = await crypto.subtle.digest('SHA-1', all);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- HTML → Markdown (the format the content files use) ---------- */
  const COLOR_CLASSES = ['red', 'blue', 'yellow'];
  function colorClassOf(el) {
    if (el.tagName === 'SPAN') { const c = COLOR_CLASSES.find(k => el.classList.contains(k)); if (c) return c; }
    const col = (el.getAttribute('color') || el.style.color || '').toLowerCase();
    if (!col) return null;
    const rgb = toRgb(col); if (!rgb) return null;
    const [r, g, b] = rgb;
    if (r > 150 && g < 110 && b < 110) return 'red';
    if (b > 150 && r < 120) return 'blue';
    if (r > 150 && g > 100 && b < 80) return 'yellow';
    return null;
  }
  function toRgb(c) {
    let m = c.match(/^#([0-9a-f]{6})$/i); if (m) return [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16));
    m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/); if (m) return m.slice(1, 4).map(Number);
    return null;
  }
  const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'TABLE', 'IFRAME', 'HR', 'PRE']);

  function toMarkdown(root) {
    return blocks(root).filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function blocks(parent) {
    const out = []; let inlineBuf = [];
    const flush = () => { const t = inlineBuf.join('').trim(); if (t) out.push(t); inlineBuf = []; };
    parent.childNodes.forEach(n => {
      if (n.nodeType === 1 && BLOCK.has(n.tagName)) { flush(); out.push(block(n)); }
      else if (n.nodeType === 1 && n.tagName === 'BR') { inlineBuf.push('\n'); }
      else inlineBuf.push(inline(n));
    });
    flush();
    return out;
  }
  function block(el) {
    switch (el.tagName) {
      case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6':
        return '#'.repeat(+el.tagName[1]) + ' ' + inlineOf(el).replace(/\n/g, ' ').trim();
      case 'P': return inlineOf(el).trim();
      case 'DIV': return blocks(el).join('\n\n');
      case 'UL': case 'OL': return list(el, 0);
      case 'BLOCKQUOTE': return blocks(el).join('\n\n').split('\n').map(l => l ? '> ' + l : '>').join('\n');
      case 'TABLE': return table(el);
      case 'IFRAME': {
        const a = ['class', 'src', 'loading', 'referrerpolicy'].filter(k => el.getAttribute(k)).map(k => `${k}="${el.getAttribute(k)}"`);
        if (el.hasAttribute('allowfullscreen')) a.push('allowfullscreen');
        return `<iframe ${a.join(' ')}></iframe>`;
      }
      case 'HR': return '---';
      case 'PRE': return '```\n' + el.textContent.replace(/\n$/, '') + '\n```';
    }
    return inlineOf(el);
  }
  function list(el, depth) {
    const ordered = el.tagName === 'OL'; let i = 1;
    const pad = '    '.repeat(depth);
    return [...el.children].filter(li => li.tagName === 'LI').map(li => {
      const marker = ordered ? `${i++}. ` : '- ';
      const text = []; const nested = [];
      li.childNodes.forEach(n => {
        if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) nested.push(list(n, depth + 1));
        else if (n.nodeType === 1 && (n.tagName === 'P' || n.tagName === 'DIV')) text.push(' ' + inlineOf(n).trim() + ' ');
        else text.push(n.nodeType === 1 && n.tagName === 'BR' ? ' ' : inline(n));
      });
      const line = pad + marker + text.join('').replace(/\s+/g, ' ').trim();
      return [line, ...nested].join('\n');
    }).join('\n');
  }
  function table(el) {
    const rows = [...el.rows];
    if (!rows.length) return '';
    const cell = c => inlineOf(c).replace(/\n/g, ' ').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
    const head = [...rows[0].cells].map(cell);
    const lines = ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|'];
    rows.slice(1).forEach(r => {
      const cells = [...r.cells].map(cell);
      while (cells.length < head.length) cells.push('');
      lines.push('| ' + cells.map(c => c || ' ').join(' | ').replace(/\| {2}\|/g, '|  |') + ' |');
    });
    return lines.join('\n');
  }
  function inlineOf(el) { return [...el.childNodes].map(inline).join(''); }
  function inline(n) {
    if (n.nodeType === 3) return escapeMd(n.nodeValue.replace(/\u00a0/g, ' ').replace(/\s*\n\s*/g, ' '));
    if (n.nodeType !== 1) return '';
    const tag = n.tagName;
    if (tag === 'BR') return '\n';
    if (tag === 'IFRAME') return '';
    if (tag === 'IMG') return `![${n.alt || ''}](${n.getAttribute('src')})`;
    const inner = inlineOf(n);
    if (tag === 'STRONG' || tag === 'B') return wrap(inner, '**');
    if (tag === 'EM' || tag === 'I') return wrap(inner, '*');
    if (tag === 'A') {
      const href = n.getAttribute('href') || '';
      if (href.startsWith('mailto:') && inner.trim() === href.slice(7)) return inner;
      return inner.trim() ? `[${inner.trim()}](${href})` : '';
    }
    if (tag === 'CODE') return '`' + n.textContent + '`';
    const color = (tag === 'SPAN' || tag === 'FONT') ? colorClassOf(n) : null;
    if (color && inner.trim()) {
      const lead = inner.match(/^\s*/)[0], trail = inner.match(/\s*$/)[0];
      return `${lead}<span class="${color}">${inner.trim()}</span>${trail}`;
    }
    if (tag === 'SPAN' && n.style.fontWeight >= 600) return wrap(inner, '**');
    return inner;
  }
  function wrap(inner, mark) {
    if (!inner.trim()) return inner;
    const lead = inner.match(/^\s*/)[0], trail = inner.match(/\s*$/)[0];
    return `${lead}${mark}${inner.trim()}${mark}${trail}`;
  }
  function escapeMd(t) {
    return t.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/`/g, '\\`')
      .replace(/</g, '&lt;').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  }


  /* ---------- Banner images editor ---------- */
  document.addEventListener('click', e => { if (e.target.closest('#bannerEdit')) openBannerEditor(); });

  function openBannerEditor() {
    const S = window.SITE;
    let items = (S.banners || []).map(src => ({ src }));
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-label="Banner images">
        <h3>Banner images</h3>
        <p class="muted">These rotate at the top of the Main tab, in this order. Wide images look best (about 3 times wider than tall).</p>
        <div class="ban-list"></div>
        <div class="ban-add">
          <label class="upload-btn">⬆ Upload an image<input type="file" accept="image/*" multiple hidden></label>
          <span class="muted">or</span>
          <input type="url" placeholder="Paste an image link (https://…)">
          <button type="button" data-a="addurl">Add</button>
        </div>
        <div class="modal-actions">
          <button type="button" class="ghost" data-a="cancel">Cancel</button>
          <button type="button" class="primary" data-a="save">Save</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const list = $('.ban-list', modal), urlIn = $('input[type=url]', modal), fileIn = $('input[type=file]', modal);

    const draw = () => {
      list.innerHTML = items.length ? items.map((it, i) => `
        <div class="ban-row">
          <img src="${App.escapeHtml(it.dataUrl || it.src)}" alt="">
          <span class="ban-name">${it.dataUrl ? App.escapeHtml(it.name) + ' <em>(new)</em>' : App.escapeHtml(it.src.split('/').pop())}</span>
          <button type="button" data-a="up" data-i="${i}" title="Move earlier" ${i ? '' : 'disabled'}>↑</button>
          <button type="button" data-a="down" data-i="${i}" title="Move later" ${i < items.length - 1 ? '' : 'disabled'}>↓</button>
          <button type="button" data-a="del" data-i="${i}" title="Remove" class="danger">✕</button>
        </div>`).join('') : '<p class="muted">No images yet. Upload one or paste a link.</p>';
    };
    draw();

    fileIn.onchange = async () => {
      for (const f of fileIn.files) {
        try { items.push({ dataUrl: await shrinkImage(f), name: f.name }); } catch { alert(`Couldn't read ${f.name}.`); }
      }
      fileIn.value = ''; draw();
    };
    modal.addEventListener('click', async e => {
      if (e.target === modal) return close();
      const b = e.target.closest('button[data-a]'); if (!b) return;
      const i = +b.dataset.i, a = b.dataset.a;
      if (a === 'up') { [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); }
      if (a === 'down') { [items[i + 1], items[i]] = [items[i], items[i + 1]]; draw(); }
      if (a === 'del') { items.splice(i, 1); draw(); }
      if (a === 'addurl') {
        const u = urlIn.value.trim();
        if (!/^https?:\/\/\S+$/i.test(u)) { alert('Paste a full image link starting with https://'); return; }
        items.push({ src: u }); urlIn.value = ''; draw();
      }
      if (a === 'cancel') close();
      if (a === 'save') {
        b.disabled = true; b.textContent = 'Saving…';
        try { await saveBanners(items); close(); App.toast('Saved! Everyone will see the new images in about a minute.'); }
        catch (err) { alert(err.message || 'Save failed.'); b.disabled = false; b.textContent = 'Save'; }
      }
    });
    function close() { modal.remove(); }
  }

  async function saveBanners(items) {
    const S = window.SITE;
    const finalSrcs = [], displaySrcs = [];
    for (const it of items) {
      if (it.dataUrl) {
        const slug = it.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'banner';
        const path = `content/images/${Date.now()}-${slug}.jpg`;
        const res = await postWithPassword({ file: path, base64: it.dataUrl.split(',')[1] });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Upload failed.'); }
        finalSrcs.push(path); displaySrcs.push(it.dataUrl);
      } else { finalSrcs.push(it.src); displaySrcs.push(it.src); }
    }
    const header = (S.bannersMd || '').split('\n').filter(l => !/^\s*[-*]\s+/.test(l)).join('\n').replace(/\n+$/, '');
    const md = (header || '# Banner images') + '\n\n' + finalSrcs.map(s => `- ${s}`).join('\n') + '\n';
    const baseSha = S.bannersSha || await gitBlobSha(S.bannersMd || '');
    let res = await postWithPassword({ file: 'content/banners.md', content: md, baseSha });
    if (res.status === 409) res = await postWithPassword({ file: 'content/banners.md', content: md, force: true });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Save failed.');
    S.bannersSha = d.sha; S.bannersMd = md; S.banners = displaySrcs;
    App.refreshBanner();
  }

  async function postWithPassword(body) {
    let res = await post(body);
    if (res.status === 401) {
      const pw = prompt('Enter the editor password to save changes:');
      if (!pw) throw new Error('Not saved — the editor password is needed.');
      try { localStorage.setItem('editorPassword', pw); } catch {}
      res = await post(body);
    }
    return res;
  }

  // Shrink big photos so uploads are quick (max 2000px wide, JPEG)
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 2000 / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }


  /* ---------- Add / delete sections ---------- */
  document.addEventListener('click', e => { const b = e.target.closest('button.add-section'); if (b) openAddSection(b.dataset.tab); });

  function openAddSection(tabId) {
    const S = window.SITE;
    const tab = S.tabs.find(t => t.id === tabId); if (!tab) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-label="Add a section">
        <h3>Add a section to “${App.escapeHtml(tab.label)}”</h3>
        <p class="muted">You can add the text right after it's created.</p>
        <label class="field">Section name
          <input type="text" name="name" maxlength="60" placeholder="e.g. Recall Updates" autofocus></label>
        <label class="field">Put it after
          <select name="after">
            <option value="__top">At the very top</option>
            ${tab.sections.map((s, i) => `<option value="${s.id}" ${i === tab.sections.length - 1 ? 'selected' : ''}>${App.escapeHtml(s.label)}</option>`).join('')}
          </select></label>
        <label class="field">Look
          <select name="style">
            <option value="">Regular section</option>
            <option value="alert">Red warning box</option>
            <option value="logins">Login cards</option>
            <option value="collapsible">Click-to-open panels (like the Directory)</option>
          </select></label>
        <div class="modal-actions">
          <button type="button" class="ghost" data-a="cancel">Cancel</button>
          <button type="button" class="primary" data-a="create">Add section</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const nameIn = $('input[name=name]', modal); nameIn.focus();
    const close = () => modal.remove();
    modal.addEventListener('click', async e => {
      if (e.target === modal) return close();
      const b = e.target.closest('button[data-a]'); if (!b) return;
      if (b.dataset.a === 'cancel') return close();
      const name = nameIn.value.trim();
      if (!name) { nameIn.focus(); alert('Give the section a name.'); return; }
      b.disabled = true; b.textContent = 'Adding…';
      try {
        const sec = await createSection(tab, name, $('select[name=after]', modal).value, $('select[name=style]', modal).value);
        close();
        App.toast('Section added! Type its content, then click Save.');
        location.hash = `#/${tab.id}/${sec.id}`;
        setTimeout(() => {
          startEditing(sec.id);
          const ph = active && [...active.area.querySelectorAll('p')].find(p => /Click Edit to add text/.test(p.textContent));
          if (ph) { const r = document.createRange(); r.selectNodeContents(ph); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
        }, 300);
      } catch (err) { alert(err.message || 'Could not add the section.'); b.disabled = false; b.textContent = 'Add section'; }
    });
    nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') $('button[data-a=create]', modal).click(); });
  }

  async function createSection(tab, name, afterId, look) {
    const S = window.SITE;
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'section';
    const taken = new Set(S.tabs.flatMap(t => t.sections.map(s => s.id)));
    let id = base, n = 2; while (taken.has(id) || document.getElementById('s-' + id)) id = `${base}-${n++}`;
    const sec = { id, label: name, file: `${tab.id}/${id}.md` };
    if (look === 'alert' || look === 'logins') sec.style = look;
    if (look === 'collapsible') sec.collapsible = true;
    const starter = look === 'logins'
      ? `### System name\n[Open it](https://)\n\n- **User:** username\n- **Pass:** password\n`
      : look === 'collapsible'
        ? `## ${name}\n\n## First panel\n\nText inside the first panel.\n\n## Second panel\n\nText inside the second panel.\n`
        : `## ${name}\n\nClick **Edit** to add text here.\n`;

    // 1) create the section's file, 2) add it to the section list
    let res = await postWithPassword({ file: `content/${sec.file}`, content: starter });
    let d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Could not create the section.');
    sec.md = starter; sec.sha = d.sha; sec.originalMd = starter;

    const list = tab.sections.map(stripRuntime);
    let at = afterId === '__top' ? 0 : list.findIndex(s => s.id === afterId) + 1;
    if (afterId !== '__top' && at === 0) at = list.length;
    list.splice(at, 0, stripRuntime(sec));
    await saveSectionList(tab, list);

    tab.sections.splice(at, 0, sec);
    const el = App.renderSection(tab, sec);
    const page = document.querySelector(`.page[data-tab="${tab.id}"]`);
    const before = afterId === '__top' ? page.firstElementChild : document.getElementById('s-' + afterId);
    if (afterId === '__top') page.prepend(el); else if (before) before.after(el); else page.appendChild(el);
    App.refreshNav(); App.buildSearchIndex();
    return sec;
  }

  async function deleteSection() {
    const { tab, sec } = active;
    if (!confirm(`Delete the whole “${sec.label}” section from the site?\n\n(It can be recovered from GitHub's history if needed.)`)) return;
    try {
      const list = tab.sections.filter(s => s.id !== sec.id).map(stripRuntime);
      await saveSectionList(tab, list);
      document.removeEventListener('selectionchange', updateTableButtons);
      active.wrap.remove(); active = null;
      tab.sections.splice(tab.sections.indexOf(sec), 1);
      App.refreshNav(); App.buildSearchIndex();
      App.toast('Section deleted. Everyone will see the change in about a minute.');
    } catch (err) { alert(err.message || 'Could not delete the section.'); }
  }

  function stripRuntime(s) {
    const o = { id: s.id, label: s.label, file: s.file };
    if (s.style) o.style = s.style; if (s.collapsible) o.collapsible = true;
    return o;
  }

  async function saveSectionList(tab, newList) {
    const S = window.SITE;
    const data = JSON.parse(S.sectionsJson);
    const t = data.tabs.find(x => x.id === tab.id);
    t.sections = newList;
    const json = JSON.stringify(data, null, 2) + '\n';
    const baseSha = S.sectionsSha || await gitBlobSha(S.sectionsJson);
    let res = await postWithPassword({ file: 'content/sections.json', content: json, baseSha });
    if (res.status === 409) throw new Error('Someone else changed the section list a moment ago. Reload the page and try again.');
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Could not update the section list.');
    S.sectionsJson = json; S.sectionsSha = d.sha;
  }


  /* ---------- Logo & browser icon ---------- */
  document.addEventListener('click', e => { if (e.target.closest('#logoBtn')) openLogoEditor(); });

  function openLogoEditor() {
    const cur = document.getElementById('siteLogo');
    const hasLogo = cur && !cur.hidden && cur.naturalWidth > 0;
    let pending = null;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-label="Logo and browser icon">
        <h3>Logo &amp; browser icon</h3>
        <p class="muted">Shown at the top left of every page and on the browser tab. A PNG with a transparent background looks best.</p>
        <div class="logo-preview">${hasLogo ? `<img src="${cur.src}" alt="Current logo">` : '<span>No logo uploaded yet.</span>'}</div>
        <div class="ban-add">
          <label class="upload-btn">⬆ Upload logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label>
        </div>
        <div class="modal-actions">
          <button type="button" class="ghost" data-a="cancel">Cancel</button>
          <button type="button" class="primary" data-a="save" disabled>Save</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const fileIn = $('input[type=file]', modal), saveBtn = $('button[data-a=save]', modal), preview = $('.logo-preview', modal);
    const close = () => modal.remove();
    fileIn.onchange = async () => {
      const f = fileIn.files[0]; if (!f) return;
      try { pending = await toPng(f, 512); preview.innerHTML = `<img src="${pending}" alt="New logo">`; saveBtn.disabled = false; }
      catch { alert(`Couldn't read ${f.name}. Try a PNG or JPG.`); }
    };
    modal.addEventListener('click', async e => {
      if (e.target === modal) return close();
      const b = e.target.closest('button[data-a]'); if (!b) return;
      if (b.dataset.a === 'cancel') return close();
      b.disabled = true; b.textContent = 'Saving…';
      try {
        const res = await postWithPassword({ file: 'content/images/logo.png', base64: pending.split(',')[1] });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Upload failed.');
        if (cur) { cur.src = pending; cur.hidden = false; }
        const fav = document.getElementById('favicon'); if (fav) fav.href = pending;
        close(); App.toast('Logo saved! Everyone will see it in about a minute.');
      } catch (err) { alert(err.message || 'Upload failed.'); b.disabled = false; b.textContent = 'Save'; }
    });
  }

  // Keep transparency; limit size so it uploads fast
  function toPng(file, max) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const w = img.naturalWidth || max, h = img.naturalHeight || max;
        const scale = Math.min(1, max / Math.max(w, h));
        const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  // exposed for testing
  window.SiteEditor = { toMarkdown };
})();
