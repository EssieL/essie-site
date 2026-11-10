/* 正文阅读页 · 批注层（运行时注入，不改动生成的正文文本）
   层级：划线＝重点句（四色，默认优先）；高亮＝划线句内的词级重点（原四色，保留）。
   笔记中，划线自动成为摘抄，摘抄里的高亮词被标记；摘抄由 NotesHub.excerpt() 实时合成。
   段落笔记 + 划线想法 + 选区标注，全部与 learn/self-psychology/notes/ 共用同一份数据，双向编辑。 */
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
  var article, wrap, ch, btns = {};
  var book = H.BOOK, notesUrl = '../../notes/', chLabel = '';
  var toolbar, panel, editor, editing = null;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
  function last(a) { return a.length ? a[a.length - 1] : null; }
  function closestP(node) {
    while (node && node !== article) {
      if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-pid')) return node;
      node = node.parentNode;
    }
    return null;
  }
  function plainText(node) {
    // 去掉运行时注入的 ✎ 按钮文本；划线/高亮只包裹文本，不影响取词
    var c = node.cloneNode(true);
    var bs = c.querySelectorAll('.ann-note-btn');
    for (var i = bs.length - 1; i >= 0; i--) bs[i].parentNode.removeChild(bs[i]);
    return (c.textContent || '').trim();
  }
  function secOf(p) {
    if (p.getAttribute && p.getAttribute('data-sec')) return p.getAttribute('data-sec');
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
      if (h) secTitle = plainText(h);
    }
    var txt = plainText(p);
    // 小标题自身就是归属小节，避免把标题重复拼两遍
    if (p.getAttribute && p.getAttribute('data-sec')) return '〔小节〕' + cut(txt, 42);
    return (secTitle ? '〔' + cut(secTitle, 16) + '〕' : '') + cut(txt, 42);
  }

  /* ---------- 标注重绘：按边界切分，划线包高亮，跨文本节点自动拆 ---------- */
  function clearAnn() {
    var els = article.querySelectorAll('[data-ann]');
    for (var i = els.length - 1; i >= 0; i--) {
      var x = els[i], parent = x.parentNode;
      if (!parent) continue;
      while (x.firstChild) parent.insertBefore(x.firstChild, x);
      parent.removeChild(x);
    }
    Array.prototype.forEach.call(article.querySelectorAll('[data-pid]'), function (p) {
      if (p.normalize) p.normalize();
    });
  }
  function wrapSegments(p, segs) {
    if (!segs.length) return;
    var tw = document.createTreeWalker(p, 4 /* SHOW_TEXT */, null, false);
    var items = [], pos = 0, node;
    while ((node = tw.nextNode())) {
      var len = node.nodeValue.length;
      items.push({ node: node, s: pos, e: pos + len });
      pos += len;
    }
    if (!pos) return;
    var ops = [];
    segs.forEach(function (sg) {
      items.forEach(function (it) {
        var a = Math.max(sg.a, it.s), b = Math.min(sg.b, it.e);
        if (a < b) ops.push({ node: it.node, a: a - it.s, b: b - it.s, abs: a, u: sg.u, m: sg.m });
      });
    });
    ops.sort(function (x, y) { return y.abs - x.abs || y.a - x.a; });
    ops.forEach(function (op) {
      var r = document.createRange();
      try { r.setStart(op.node, op.a); r.setEnd(op.node, op.b); }
      catch (e) { return; }
      var frag;
      try { frag = r.extractContents(); } catch (e2) { return; }
      var host = null;
      if (op.m) {
        host = el('mark', 'ann-mark ann-' + (op.m.color || 'y'));
        host.setAttribute('data-ann', 'm');
        host.setAttribute('data-mid', op.m.uid);
      }
      if (op.u) {
        var sp = el('span', 'ann-under ann-u-' + (op.u.color || 'y'));
        sp.setAttribute('data-ann', 'u');
        sp.setAttribute('data-uid', op.u.uid);
        if (host) { sp.appendChild(host); host.appendChild(frag); }
        else sp.appendChild(frag);
        host = sp;
      } else if (host) host.appendChild(frag);
      if (host) r.insertNode(host);
    });
  }
  function paintAnn() {
    clearAnn();
    var groups = {};
    function bucket(pid) { return groups[pid] || (groups[pid] = { u: [], m: [] }); }
    H.chapterUnderlines(ch).forEach(function (u) { bucket(u.pid).u.push(u); });
    H.chapterMarks(ch).forEach(function (m) { bucket(m.pid).m.push(m); });

    Object.keys(groups).forEach(function (pid) {
      var p = article.querySelector('[data-pid="' + pid + '"]');
      if (!p) return;
      var g = groups[pid], len = p.textContent.length, bounds = [0, len];
      g.u.concat(g.m).forEach(function (x) {
        [x.start, x.end].forEach(function (v) {
          v = Math.max(0, Math.min(len, Number(v) || 0));
          if (bounds.indexOf(v) < 0) bounds.push(v);
        });
      });
      bounds.sort(function (a, b) { return a - b; });
      var segs = [];
      for (var i = 0; i < bounds.length - 1; i++) {
        var a = bounds[i], b = bounds[i + 1];
        if (a >= b) continue;
        var covers = function (x) { return Number(x.start) <= a && Number(x.end) >= b; };
        var u = last(g.u.filter(covers)), m = last(g.m.filter(covers));
        if (!u && !m) continue;
        segs.push({ a: a, b: b, u: u, m: m });
      }
      wrapSegments(p, segs);
    });

    Array.prototype.forEach.call(article.querySelectorAll('mark[data-ann="m"]'), function (m) {
      m.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (window.confirm('移除这处句内高亮？')) H.remove(m.getAttribute('data-mid'));
      });
    });
    Array.prototype.forEach.call(article.querySelectorAll('span[data-ann="u"]'), function (s) {
      s.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (window.confirm('移除这条划线？其句内高亮会保留，但不再属于摘抄。')) H.remove(s.getAttribute('data-uid'));
      });
    });
  }

  /* ---------- 段落笔记按钮 ---------- */
  function paintButtons() {
    var notes = H.chapterNotes(ch);
    Object.keys(btns).forEach(function (pid) {
      var b = btns[pid];
      var n = notes.filter(function (x) { return x.pid === pid; }).length;
      var isSec = !!(b.parentNode && b.parentNode.getAttribute('data-sec'));
      b.textContent = n ? '✎ ' + n : '✎';
      // 保留小节标题按钮的专用样式类，别在状态刷新时抹掉
      b.className = 'ann-note-btn' + (isSec ? ' ann-note-btn-sec' : '') + (n ? ' has' : '');
    });
  }

  /* ---------- 侧栏 ---------- */
  function buildPanel() {
    panel = el('aside', 'ann-panel');
    panel.id = 'annPanel';
    var head = el('div', 'ann-head');
    head.appendChild(el('b', '', '本章批注'));
    var link = el('a', 'ann-link', '↗ 笔记管理');
    link.href = notesUrl;
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
    var notes = H.chapterNotes(ch), us = H.chapterUnderlines(ch), ms = H.chapterMarks(ch);
    var html = '<div class="ann-stat">' + notes.length + ' 条笔记 · ' + us.length +
               ' 处划线 · ' + ms.length + ' 处句内高亮</div>';
    if (!notes.length && !us.length && !ms.length) {
      html += '<p class="ann-empty">还没有批注。<br>选中句子先<b>划线</b>（重点句，会自动摘抄），<br>再选中句中词汇<b>高亮</b>（句内重点）；<br>点段落或小节标题后的 ✎ 可写笔记。</p>';
    }
    if (us.length) {
      html += '<div class="ann-h">划线摘抄（含高亮标记）</div>';
      us.forEach(function (u) {
        var ex = H.excerpt(u.uid);
        html += '<div class="ann-item ann-excerpt" data-goto="' + esc(u.pid) + '" data-open="' + esc(u.uid) + '">' +
          '<span class="ann-dot ann-u-dot ann-u-' + esc(u.color || 'y') + '"></span>' +
          '<span class="ann-ex-txt">' + (ex ? ex.html : esc(cut(u.quote, 46))) + '</span>' +
          (ex && ex.parts.filter(function (p) { return p.color; }).length
            ? '<span class="ann-hl-n">含 ' + ex.parts.filter(function (p) { return p.color; }).length + ' 处句内重点</span>' : '') +
          (u.note ? '<span class="ann-txt">💭 ' + esc(cut(u.note, 34)) + '</span>' : '') +
          '</div>';
      });
    }
    if (notes.length) {
      html += '<div class="ann-h">笔记</div>';
      notes.forEach(function (n) {
        html += '<div class="ann-item" data-goto="' + esc(n.pid) + '" data-open="' + esc(n.uid) + '">' +
          '<span class="ann-src">' + esc(cut(n.preview || '（未定位段落）', 22)) + '</span>' +
          '<span class="ann-txt">' + esc(cut(n.text, 60)) + '</span></div>';
      });
    }
    if (ms.length) {
      html += '<div class="ann-h">句内高亮</div>';
      ms.forEach(function (m) {
        html += '<div class="ann-item" data-goto="' + esc(m.pid) + '">' +
          '<span class="ann-dot ann-' + esc(m.color || 'y') + '"></span>' +
          '<span class="ann-txt">' + esc(cut(m.quote, 46)) + '</span>' +
          (m.under ? '<span class="ann-src">隶属某条划线摘抄</span>' : '') + '</div>';
      });
    }
    body.innerHTML = html;
    Array.prototype.forEach.call(body.querySelectorAll('.ann-item'), function (it) {
      it.onclick = function () {
        var pid = it.getAttribute('data-goto');
        var p = pid && article.querySelector('[data-pid="' + pid + '"]');
        if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var uid = it.getAttribute('data-open');
        if (uid) {
          if (it.classList.contains('ann-excerpt')) openUnderEditor(uid);
          else openEditor(uid);
        }
      };
    });
  }

  /* ---------- 弹层：段落笔记 / 划线想法 ---------- */
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
    showEditor();
    document.getElementById('annClose').onclick = closeEditor;
    document.getElementById('annSave').onclick = function () {
      var text = document.getElementById('annText').value.trim();
      var tg = document.getElementById('annTags').value.split(/[,，]/)
        .map(function (x) { return x.trim(); }).filter(Boolean);
      if (!text) { alert('笔记内容不能为空'); return; }
      if (editing.uid) H.updateNote(editing.uid, { text: text, tags: tg });
      else H.addNote({ book: book, ch: ch, sec: sec, pid: editing.pid,
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
  function openUnderEditor(uid) {
    var u = H.allUnderlines().filter(function (x) { return x.uid === uid; })[0];
    if (!u) return;
    var ex = H.excerpt(uid);
    var opts = COLORS.map(function (c) {
      return '<option value="' + c.k + '"' + (u.color === c.k ? ' selected' : '') + '>' + c.name + '</option>';
    }).join('');
    editor.innerHTML =
      '<div class="ann-box"><div class="ann-box-h"><b>划线摘抄 · 我的想法</b>' +
      '<button type="button" id="annClose">×</button></div>' +
      '<div class="ann-anchor">' + esc(chLabel) + ' · ' + esc(cut(u.preview || u.pid, 30)) + '</div>' +
      '<div class="ann-quote-box">' + (ex ? ex.html : esc(u.quote)) + '</div>' +
      '<div class="ann-quote-tip">上为自动摘抄；句中的<b>底色词</b>是后来加的句内高亮，会随高亮增删自动变化。</div>' +
      '<textarea id="annUnderNote" placeholder="针对这句摘抄写下想法…">' + esc(u.note || '') + '</textarea>' +
      '<label class="ann-color-lb">划线颜色 <select id="annUnderColor">' + opts + '</select></label>' +
      '<div class="ann-box-f">' +
      '<button type="button" id="annDel" class="danger">删除划线</button>' +
      '<button type="button" id="annSave" class="primary">保存</button></div></div>';
    showEditor();
    document.getElementById('annClose').onclick = closeEditor;
    document.getElementById('annSave').onclick = function () {
      H.updateUnderline(uid, {
        note: document.getElementById('annUnderNote').value.trim(),
        color: document.getElementById('annUnderColor').value
      });
      closeEditor();
    };
    document.getElementById('annDel').onclick = function () {
      if (confirm('删除这条划线？摘抄会一并移除，句内高亮保留。')) { H.remove(uid); closeEditor(); }
    };
    var ta = document.getElementById('annUnderNote');
    if (ta.focus) ta.focus();
  }
  function showEditor() { if (editor) editor.classList.add('show'); }
  function closeEditor() { if (editor) editor.classList.remove('show'); }

  /* ---------- 选区工具条：划线优先（主）+ 保留高亮（次） ---------- */
  function buildToolbar() {
    toolbar = el('div', 'ann-toolbar');
    toolbar.id = 'annToolbar';

    var g1 = el('span', 'ann-grp');
    g1.appendChild(el('span', 'ann-grp-lb', '划线 · 重点句'));
    COLORS.forEach(function (c) {
      var b = el('button', 'ann-color ann-ucolor ann-u-' + c.k + (c.k === 'y' ? ' ann-primary' : ''), '');
      b.type = 'button'; b.title = '划线 · ' + c.name + '（重点句，自动摘抄）';
      b.onclick = function () { addUnderline(c.k); };
      g1.appendChild(b);
    });
    toolbar.appendChild(g1);
    toolbar.appendChild(el('span', 'ann-sep'));

    var g2 = el('span', 'ann-grp');
    g2.appendChild(el('span', 'ann-grp-lb', '高亮 · 句内重点'));
    COLORS.forEach(function (c) {
      var b = el('button', 'ann-color ann-' + c.k, '');
      b.type = 'button'; b.title = '高亮 · ' + c.name + '（句中的重点词）';
      b.onclick = function () { addHighlight(c.k); };
      g2.appendChild(b);
    });
    toolbar.appendChild(g2);
    toolbar.appendChild(el('span', 'ann-sep'));

    var clear = el('button', 'ann-clear', '清除本段');
    clear.type = 'button'; clear.title = '清除本段全部划线与高亮';
    clear.onclick = clearParagraphAnn;
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
  /* 选区矩形：iOS Safari 有时返回空矩形，退回第一个 clientRect */
  function selRect() {
    try {
      var r = window.getSelection().getRangeAt(0);
      var b = r.getBoundingClientRect();
      if (b && (b.width || b.height)) return b;
      var list = r.getClientRects();
      return list && list.length ? list[0] : b;
    } catch (e) { return null; }
  }
  /* 工具条贴在选区下方，越界时翻到上方；左右夹在视口内（平板窄屏必需） */
  function placeToolbar(rect) {
    if (!toolbar || !rect) return;
    toolbar.style.visibility = 'hidden';
    toolbar.classList.add('show');
    var w = toolbar.offsetWidth || 320, h = toolbar.offsetHeight || 42;
    var vw = window.innerWidth || document.documentElement.clientWidth || w;
    var vh = window.innerHeight || document.documentElement.clientHeight || h;
    var left = Math.max(8, Math.min(rect.left, Math.max(8, vw - w - 8)));
    var top = rect.bottom + 8;
    if (top + h > vh - 8) top = Math.max(8, rect.top - h - 8);
    toolbar.style.left = left + 'px';
    toolbar.style.top = top + 'px';
    toolbar.style.visibility = '';
  }
  function showToolbar(s) {
    var rect = selRect();
    if (!rect) return;
    pendingSel = s;
    placeToolbar(rect);
  }
  function hideToolbar() { if (toolbar) toolbar.classList.remove('show'); pendingSel = null; }
  function repositionToolbar() {
    if (!toolbar || !toolbar.classList.contains('show')) return;
    var rect = selRect();
    if (rect) placeToolbar(rect);
  }
  function clearSelection() {
    try { window.getSelection().removeAllRanges(); } catch (e) {}
    hideToolbar();
  }
  /* 划线：句子级重点；同时把范围内的已有高亮归属到这条摘抄 */
  function addUnderline(color) {
    var s = pendingSel || selectionInfo();
    if (!s) return;
    var p = s.p, pid = p.getAttribute('data-pid');
    var u = H.addUnderline({ book: book, ch: ch, sec: secOf(p), pid: pid,
                             start: s.start, end: s.end, quote: s.quote, color: color,
                             preview: previewOf(p, secOf(p)) });
    H.chapterMarks(ch).forEach(function (m) {
      if (m.pid === pid && !m.under &&
          Number(m.start) >= s.start && Number(m.end) <= s.end) H.updateMark(m.uid, { under: u.uid });
    });
    clearSelection();
  }
  /* 高亮：句内重点；落在划线内则自动成为该句摘抄里的标记 */
  function addHighlight(color) {
    var s = pendingSel || selectionInfo();
    if (!s) return;
    var p = s.p, pid = p.getAttribute('data-pid');
    H.addMark({ book: book, ch: ch, sec: secOf(p), pid: pid,
                start: s.start, end: s.end, quote: s.quote, color: color,
                under: H.findUnderline(ch, pid, s.start, s.end) });
    clearSelection();
  }
  function clearParagraphAnn() {
    var s = pendingSel;
    if (!s) return;
    var pid = s.p.getAttribute('data-pid');
    H.chapterUnderlines(ch).forEach(function (u) { if (u.pid === pid) H.remove(u.uid); });
    H.chapterMarks(ch).forEach(function (m) { if (m.pid === pid) H.remove(m.uid); });
    hideToolbar();
  }

  /* ---------- 初始化 ---------- */
  function refresh() { paintAnn(); paintButtons(); paintPanel(); }

  function boot() {
    article = document.querySelector('article.article');
    if (!article) return;
    wrap = document.querySelector('body > .wrap') || document.body;
    ch = Number(article.getAttribute('data-ch')) || 1;
    book = article.getAttribute('data-book') || H.BOOK;
    notesUrl = article.getAttribute('data-notes-url') || '../../notes/';
    chLabel = article.getAttribute('data-ch-label') || ('第 ' + ch + ' 章');

    // 小标题也挂笔记按钮：用其稳定的 data-sec 作 pid，复用段落笔记的全套机制
    // （运行时注入，不改动生成好的正文 HTML）
    Array.prototype.forEach.call(article.querySelectorAll('[data-sec]'), function (h) {
      if (!h.getAttribute('data-pid')) h.setAttribute('data-pid', h.getAttribute('data-sec'));
    });

    Array.prototype.forEach.call(article.querySelectorAll('[data-pid]'), function (p) {
      var pid = p.getAttribute('data-pid');
      var isSec = !!p.getAttribute('data-sec');
      var b = el('button', 'ann-note-btn' + (isSec ? ' ann-note-btn-sec' : ''), '✎');
      b.type = 'button'; b.title = isSec ? '给这一小节写笔记' : '给这一段写笔记';
      b.setAttribute('data-pid', pid);
      b.onclick = function (ev) { ev.stopPropagation(); openEditor(null, pid); };
      p.appendChild(b);
      btns[pid] = b;
    });

    buildPanel(); buildEditor(); buildToolbar();
    refresh();
    window.addEventListener('noteschange', refresh);

    var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var selTimer = null, changeTimer = null, lastTouchAt = 0;
    /* 桌面 mouseup / 平板 touchend / 触控笔 pointerup 统一走同一套选区判定；
       触屏要等系统把选区稳定下来（长按选词、拖动手柄都在 touchend 之后才落定）。 */
    function scheduleSelection(wait) {
      clearTimeout(selTimer);
      selTimer = setTimeout(function () {
        var s = selectionInfo();
        if (s) showToolbar(s); else hideToolbar();
      }, wait);
    }
    function afterSelection(ev) {
      if (toolbar && ev && ev.target && toolbar.contains(ev.target)) return;
      if (editor && ev && ev.target && editor.contains(ev.target)) return;
      var t = (ev && ev.type) || '';
      if (t === 'touchend' || (t === 'pointerup' && ev.pointerType === 'touch')) lastTouchAt = Date.now();
      /* 触屏随后会派发合成 mouseup，别让它把 160ms 的等待缩短 */
      var touchLike = coarse || t === 'touchend' || (Date.now() - lastTouchAt) < 600;
      scheduleSelection(touchLike ? 160 : 20);
    }
    document.addEventListener('mouseup', afterSelection);
    document.addEventListener('touchend', afterSelection, { passive: true });
    document.addEventListener('pointerup', afterSelection);
    /* iOS 上选区常在 touchend 之后才通过 selectionchange 通知，用独立计时器兜底，不打断主判定 */
    document.addEventListener('selectionchange', function () {
      clearTimeout(changeTimer);
      changeTimer = setTimeout(function () {
        if (pendingSel !== null) return;
        var s = selectionInfo();
        if (s) showToolbar(s);
      }, 260);
    });
    document.addEventListener('mousedown', function (ev) {
      if (toolbar && !toolbar.contains(ev.target) && editor && !editor.contains(ev.target)) hideToolbar();
    });
    document.addEventListener('touchstart', function (ev) {
      if (toolbar && !toolbar.contains(ev.target) && editor && !editor.contains(ev.target)) hideToolbar();
    }, { passive: true });
    /* 系统中断手势（来电、上滑返回、多指切换）时清掉待判定，避免工具条卡在屏幕上 */
    document.addEventListener('touchcancel', function () {
      clearTimeout(selTimer); clearTimeout(changeTimer); hideToolbar();
    }, { passive: true });
    /* 桌面滚走即收起；触屏滚动时改为跟随选区重新定位，避免工具条飘走或一点就消失 */
    document.addEventListener('scroll', coarse ? repositionToolbar : hideToolbar, true);
    window.addEventListener('resize', repositionToolbar);
    // 优先划线：选中文字后按回车，直接应用默认黄色划线
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || !pendingSel) return;
      var t = ev.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '')) return;
      if (editor && editor.classList.contains('show')) return;
      if (ev.preventDefault) ev.preventDefault();
      addUnderline('y');
    });
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
