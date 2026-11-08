/* 正文阅读页 · 批注层（运行时注入，不改动生成的正文文本）
   选区多色高亮 + 段落笔记；锚定已有 p0001… / s001…
   与 learn/self-psychology/notes/ 共用 NotesHub，双向编辑、跨标签同步。 */
(function () {
  'use strict';
  if (!window.NotesHub) return;
  var H = window.NotesHub;
  H.init();

  var COLORS = [
    { k: 'y', name: '黄', c: '#ffe27a' },
    { k: 'g', name: '绿', c: '#b7e6b0' },
    { k: 'b', name: '蓝', c: '#b9dcf5' },
    { k: 'p', name: '粉', c: '#f7c2d9' }
  ];
  var article, wrap, ch, pid2sec = {}, btns = {};
  var toolbar, panel, editor, editing = null;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
  function closestP(node) {
    while (node && node !== article) {
      if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-pid')) return node;
      node = node.parentNode;
    }
    return null;
  }
  function secOf(p) {
    var cur = p.previousElementSibling;
    while (cur) {
      if (cur.getAttribute && cur.getAttribute('data-sec')) return cur.getAttribute('data-sec');
      cur = cur.previousElementSibling;
    }
    return '';
  }
  function previewOf(p, sec) {
    var secTitle = '';
    if (sec) {
      var h = article.querySelector('[data-sec="' + sec + '"]');
      if (h) secTitle = h.textContent.trim();
    }
    return (secTitle ? '〔' + cut(secTitle, 16) + '〕' : '') + cut(p.textContent.trim(), 42);
  }

  /* ---------- 高亮重绘 ---------- */
  function clearMarks() {
    var ms = article.querySelectorAll('mark[data-mid]');
    for (var i = ms.length - 1; i >= 0; i--) {
      var m = ms[i], parent = m.parentNode;
      if (!parent) continue;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    }
  }
  function wrapRange(p, start, end, mid, color) {
    var tw = document.createTreeWalker(p, 4 /* SHOW_TEXT */, null, false);
    var items = [], pos = 0, node;
    while ((node = tw.nextNode())) {
      var len = node.nodeValue.length;
      items.push({ node: node, s: pos, e: pos + len });
      pos += len;
    }
    if (!pos) return;
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      var a = Math.max(start, it.s), b = Math.min(end, it.e);
      if (a >= b) continue;
      var r = document.createRange();
      r.setStart(it.node, a - it.s);
      r.setEnd(it.node, b - it.s);
      var mk = el('mark', 'ann-mark ann-' + color);
      mk.setAttribute('data-mid', mid);
      try { r.surroundContents(mk); }
      catch (e) {
        try { var frag = r.extractContents(); mk.appendChild(frag); r.insertNode(mk); }
        catch (e2) {}
      }
    }
  }
  function paintMarks() {
    clearMarks();
    H.chapterMarks(ch).forEach(function (m) {
      var p = article.querySelector('[data-pid="' + m.pid + '"]');
      if (!p) return;
      wrapRange(p, Number(m.start) || 0, Number(m.end) || 0, m.uid, m.color || 'y');
    });
    Array.prototype.forEach.call(article.querySelectorAll('mark[data-mid]'), function (m) {
      m.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var mid = m.getAttribute('data-mid');
        if (window.confirm('移除这处高亮？')) H.remove(mid);
      });
    });
  }

  /* ---------- 段落笔记按钮 ---------- */
  function paintButtons() {
    var notes = H.chapterNotes(ch);
    Object.keys(btns).forEach(function (pid) {
      var b = btns[pid];
      var n = notes.filter(function (x) { return x.pid === pid; }).length;
      b.textContent = n ? '✎ ' + n : '✎';
      b.className = 'ann-note-btn' + (n ? ' has' : '');
    });
  }

  /* ---------- 侧栏 ---------- */
  function buildPanel() {
    panel = el('aside', 'ann-panel');
    panel.id = 'annPanel';
    var head = el('div', 'ann-head');
    head.appendChild(el('b', '', '本章批注'));
    var link = el('a', 'ann-link', '↗ 笔记管理');
    link.href = '../../notes/';
    head.appendChild(link);
    var toggle = el('button', 'ann-toggle', '收起');
    toggle.type = 'button';
    toggle.onclick = function () {
      panel.classList.toggle('folded');
      toggle.textContent = panel.classList.contains('folded') ? '展开' : '收起';
      H.setSetting('panelFolded', panel.classList.contains('folded'));
    };
    head.appendChild(toggle);
    panel.appendChild(head);
    panel.appendChild(el('div', 'ann-body'));
    if (H.getSetting('panelFolded', false)) {
      panel.classList.add('folded'); toggle.textContent = '展开';
    }
    wrap.appendChild(panel);
  }
  function paintPanel() {
    if (!panel) return;
    var body = panel.querySelector('.ann-body');
    var notes = H.chapterNotes(ch), marks = H.chapterMarks(ch);
    var html = '<div class="ann-stat">' + notes.length + ' 条笔记 · ' + marks.length + ' 处重点</div>';
    if (!notes.length && !marks.length) {
      html += '<p class="ann-empty">还没有批注。<br>选中文字可高亮，点段落右侧 ✎ 可写笔记。</p>';
    }
    if (notes.length) {
      html += '<div class="ann-h">笔记</div>';
      notes.forEach(function (n) {
        html += '<div class="ann-item" data-goto="' + esc(n.pid) + '" data-open="' + esc(n.uid) + '">' +
          '<span class="ann-src">' + esc(cut(n.preview || '（未定位段落）', 22)) + '</span>' +
          '<span class="ann-txt">' + esc(cut(n.text, 60)) + '</span></div>';
      });
    }
    if (marks.length) {
      html += '<div class="ann-h">重点</div>';
      marks.forEach(function (m) {
        html += '<div class="ann-item" data-goto="' + esc(m.pid) + '">' +
          '<span class="ann-dot ann-' + esc(m.color || 'y') + '"></span>' +
          '<span class="ann-txt">' + esc(cut(m.quote, 46)) + '</span></div>';
      });
    }
    body.innerHTML = html;
    Array.prototype.forEach.call(body.querySelectorAll('.ann-item'), function (it) {
      it.onclick = function () {
        var pid = it.getAttribute('data-goto');
        var p = pid && article.querySelector('[data-pid="' + pid + '"]');
        if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var uid = it.getAttribute('data-open');
        if (uid) openEditor(uid);
      };
    });
  }

  /* ---------- 笔记编辑弹层 ---------- */
  function buildEditor() {
    editor = el('div', 'ann-editor');
    editor.id = 'annEditor';
    wrap.appendChild(editor);
  }
  function openEditor(uid, pid) {
    var n = uid ? H.allNotes().filter(function (x) { return x.uid === uid; })[0] : null;
    var p = n && n.pid ? article.querySelector('[data-pid="' + n.pid + '"]')
                       : (pid ? article.querySelector('[data-pid="' + pid + '"]') : null);
    var sec = n ? n.sec : (p ? secOf(p) : '');
    editing = { uid: uid || '', pid: n ? n.pid : (p ? p.getAttribute('data-pid') : ''),
                preview: n ? n.preview : (p ? previewOf(p, sec) : '') };
    var title = n ? '编辑笔记' : '写笔记';
    var tags = n ? (n.tags || []).join('，') : '';
    editor.innerHTML =
      '<div class="ann-box"><div class="ann-box-h"><b>' + title + '</b>' +
      '<button type="button" id="annClose">×</button></div>' +
      '<div class="ann-anchor">' + esc(editing.preview || '（未定位到段落）') + '</div>' +
      '<textarea id="annText" placeholder="写下这一段的想法…">' + esc(n ? n.text : '') + '</textarea>' +
      '<input id="annTags" placeholder="标签，用逗号分隔" value="' + esc(tags) + '">' +
      '<div class="ann-box-f">' +
      (n ? '<button type="button" id="annDel" class="danger">删除</button>' : '<span></span>') +
      '<button type="button" id="annSave" class="primary">保存</button></div></div>';
    editor.classList.add('show');
    document.getElementById('annClose').onclick = closeEditor;
    document.getElementById('annSave').onclick = function () {
      var text = document.getElementById('annText').value.trim();
      var tg = document.getElementById('annTags').value.split(/[,，]/)
        .map(function (x) { return x.trim(); }).filter(Boolean);
      if (!text) { alert('笔记内容不能为空'); return; }
      if (editing.uid) H.updateNote(editing.uid, { text: text, tags: tg });
      else H.addNote({ book: H.BOOK, ch: ch, sec: sec, pid: editing.pid,
                       preview: editing.preview, text: text, tags: tg, source: 'reader' });
      closeEditor();
    };
    var del = document.getElementById('annDel');
    if (del) del.onclick = function () {
      if (confirm('删除这条笔记？可在笔记管理中恢复。')) { H.remove(editing.uid); closeEditor(); }
    };
    var ta = document.getElementById('annText');
    if (ta.focus) ta.focus();
  }
  function closeEditor() { if (editor) editor.classList.remove('show'); }

  /* ---------- 选区工具条 ---------- */
  function buildToolbar() {
    toolbar = el('div', 'ann-toolbar');
    toolbar.id = 'annToolbar';
    COLORS.forEach(function (c) {
      var b = el('button', 'ann-color ann-' + c.k, '');
      b.type = 'button'; b.title = c.name;
      b.onclick = function () { addHighlight(c.k); };
      toolbar.appendChild(b);
    });
    var clear = el('button', 'ann-clear', '清除本段');
    clear.type = 'button';
    clear.onclick = clearParagraphMarks;
    toolbar.appendChild(clear);
    var note = el('button', 'ann-addnote', '写笔记');
    note.type = 'button';
    note.onclick = function () {
      var s = pendingSel;
      if (s) openEditor(null, s.p.getAttribute('data-pid'));
      hideToolbar();
    };
    toolbar.appendChild(note);
    wrap.appendChild(toolbar);
  }
  var pendingSel = null;
  function selectionInfo() {
    var sel = window.getSelection ? window.getSelection() : null;
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    var r = sel.getRangeAt(0);
    var p = closestP(r.startContainer), p2 = closestP(r.endContainer);
    if (!p || p !== p2) return null;              // 只支持同一段落内选区
    var pre = r.cloneRange();
    pre.selectNodeContents(p);
    pre.setEnd(r.startContainer, r.startOffset);
    var start = pre.toString().length;
    var quote = r.toString();
    if (!quote.trim()) return null;
    return { p: p, start: start, end: start + quote.length, quote: quote };
  }
  function showToolbar(s) {
    var rect;
    try { rect = window.getSelection().getRangeAt(0).getBoundingClientRect(); } catch (e) { return; }
    pendingSel = s;
    toolbar.style.left = Math.max(8, rect.left) + 'px';
    toolbar.style.top = (rect.bottom + 8) + 'px';
    toolbar.classList.add('show');
  }
  function hideToolbar() { if (toolbar) toolbar.classList.remove('show'); pendingSel = null; }
  function addHighlight(color) {
    var s = pendingSel || selectionInfo();
    if (!s) return;
    var p = s.p, pid = p.getAttribute('data-pid');
    H.addMark({ book: H.BOOK, ch: ch, sec: secOf(p), pid: pid,
                start: s.start, end: s.end, quote: s.quote, color: color });
    try { window.getSelection().removeAllRanges(); } catch (e) {}
    hideToolbar();
  }
  function clearParagraphMarks() {
    var s = pendingSel;
    if (!s) return;
    var pid = s.p.getAttribute('data-pid');
    H.chapterMarks(ch).forEach(function (m) { if (m.pid === pid) H.remove(m.uid); });
    hideToolbar();
  }

  /* ---------- 初始化 ---------- */
  function refresh() { paintMarks(); paintButtons(); paintPanel(); }

  function boot() {
    article = document.querySelector('article.article');
    if (!article) return;
    wrap = document.querySelector('body > .wrap') || document.body;
    ch = Number(article.getAttribute('data-ch')) || 1;

    Array.prototype.forEach.call(article.querySelectorAll('[data-pid]'), function (p) {
      var pid = p.getAttribute('data-pid');
      pid2sec[pid] = secOf(p);
      var b = el('button', 'ann-note-btn', '✎');
      b.type = 'button'; b.title = '给这一段写笔记';
      b.setAttribute('data-pid', pid);
      b.onclick = function (ev) { ev.stopPropagation(); openEditor(null, pid); };
      p.appendChild(b);
      btns[pid] = b;
    });

    buildPanel(); buildEditor(); buildToolbar();
    refresh();
    window.addEventListener('noteschange', refresh);

    document.addEventListener('mouseup', function (ev) {
      if (toolbar && toolbar.contains(ev.target)) return;
      setTimeout(function () {
        var s = selectionInfo();
        if (s) showToolbar(s); else hideToolbar();
      }, 10);
    });
    document.addEventListener('mousedown', function (ev) {
      if (toolbar && !toolbar.contains(ev.target) && editor && !editor.contains(ev.target)) hideToolbar();
    });
    document.addEventListener('scroll', hideToolbar, true);
  }

  function whenUnlocked() {
    var root = document.documentElement;
    if ((' ' + root.className + ' ').indexOf(' xj-locked ') < 0) { boot(); return; }
    // 正文有前端门禁，等解锁后再挂载批注层
    var mo = new MutationObserver(function () {
      if ((' ' + root.className + ' ').indexOf(' xj-locked ') < 0) { mo.disconnect(); boot(); }
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', whenUnlocked);
  } else whenUnlocked();
})();
