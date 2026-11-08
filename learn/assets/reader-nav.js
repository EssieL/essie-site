/* 正文阅读页 · 左侧浮动导航栏（《自体心理学入门》与 Freud作品 共用）
   页面用 <script type="application/json" id="xjNavData"> 提供当前篇目的跳转数据；
   章内小节目录直接读 <article> 里的 .toc，永远与正文同步。
   运行时挂到 body > .wrap 内，随前端密码门一起隐藏；不改动正文文本。 */
(function () {
  'use strict';
  var dataEl = document.getElementById('xjNavData');
  if (!dataEl) return;                       // 非正文阅读页：不挂载
  var d;
  try { d = JSON.parse(dataEl.textContent || '{}'); } catch (err) { return; }

  var FOLD_KEY = 'xj_reader_nav_fold_v1';
  var wrap = document.querySelector('body > .wrap') || document.body;
  var article = document.querySelector('article.article');

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    return n;
  }
  function a(href, cls, txt, title) {
    var n = el('a', cls, txt);
    n.href = href;
    if (title) n.title = title;
    return n;
  }
  function group(label) {
    var box = el('div');
    box.appendChild(el('div', 'xj-nav-lbl', label));
    return box;
  }

  /* ---------- 章内目录：优先读 .toc，空状态读 .sec-list 原书目录 ---------- */
  var tocItems = [];
  if (article) {
    var lis = article.querySelectorAll('.toc ol > li');
    for (var i = 0; i < lis.length; i++) {
      var link = lis[i].querySelector('a[href^="#"]');
      if (!link) continue;
      tocItems.push({
        href: link.getAttribute('href'),
        text: (link.textContent || '').replace(/^·\s*/, ''),
        sub: lis[i].className.indexOf('sub') >= 0
      });
    }
    if (!tocItems.length) {
      var secs = article.querySelectorAll('.sec-list li .tt');
      for (var j = 0; j < secs.length; j++) {
        tocItems.push({ href: '', text: secs[j].textContent || '', sub: false });
      }
    }
  }

  /* ---------- 结构 ---------- */
  var nav = el('nav', 'xj-sidenav');
  nav.id = 'xjSideNav';
  nav.setAttribute('aria-label', '章节导航');

  var toggle = el('button', 'xj-nav-toggle');
  toggle.type = 'button';
  var whenFolded = el('span', 'xj-nav-when-folded', '☰ ');
  whenFolded.appendChild(el('span', '', '导航'));
  toggle.appendChild(whenFolded);
  toggle.appendChild(el('span', 'xj-nav-when-open', '‹ 收起导航'));
  nav.appendChild(toggle);

  var panel = el('div', 'xj-nav-panel');
  var hd = el('div', 'xj-nav-hd');
  hd.appendChild(el('div', 'xj-nav-kicker', '章节导航'));
  hd.appendChild(el('div', 'xj-nav-title', d.label || ''));
  if (d.pos) hd.appendChild(el('div', 'xj-nav-pos', d.pos));
  panel.appendChild(hd);

  var body = el('div', 'xj-nav-body');

  /* 快捷跳转 */
  var jump = group('快捷跳转');
  var grid = el('div', 'xj-nav-grid');
  function jumpLink(obj, text, cls, disText) {
    var n = a(obj && obj.href ? obj.href : '#',
      'xj-nav-jump ' + cls + (obj && obj.href ? '' : ' dis'), text,
      obj && obj.title ? obj.title : '');
    if (!obj || !obj.href) n.removeAttribute('href');
    return n;
  }
  grid.appendChild(jumpLink(d.prev, '‹ 上一章', '', '已是第一篇'));
  grid.appendChild(jumpLink(d.next, '下一章 ›', '', '已是最后一篇'));
  grid.appendChild(jumpLink(d.up, '↑ 上一层', 'full'));
  grid.appendChild(jumpLink(d.home, '⌂ 首页', 'full'));
  jump.appendChild(grid);
  body.appendChild(jump);

  /* 章内目录 */
  var tocBox = group(d.tocLabel || '本章小节');
  var ol = el('ol', 'xj-nav-toc');
  var tocLinks = [];
  tocItems.forEach(function (it) {
    var li = el('li', it.sub ? 'sub' : '');
    if (it.href) {
      var n = a(it.href, '', it.text);
      ol.appendChild(li).appendChild(n);
      tocLinks.push(n);
    } else {
      li.appendChild(el('span', 'plain', it.text));
      ol.appendChild(li);
    }
  });
  if (!tocItems.length) {
    tocBox.appendChild(el('div', 'xj-nav-empty', '本篇正文尚未提交，暂无小节目录。'));
  } else {
    tocBox.appendChild(ol);
  }
  body.appendChild(tocBox);

  /* 相关链接 */
  var links = d.links || [];
  if (links.length) {
    var rel = group('相关链接');
    links.forEach(function (it) {
      if (it && it.href) rel.appendChild(a(it.href, 'xj-nav-link', it.label || it.href));
    });
    body.appendChild(rel);
  }
  panel.appendChild(body);
  nav.appendChild(panel);

  /* ---------- 展开 / 收起，记住偏好 ---------- */
  var folded = false;
  try {
    var saved = localStorage.getItem(FOLD_KEY);
    folded = saved === null ? (window.innerWidth < 1360) : saved === '1';
  } catch (err2) { folded = window.innerWidth < 1360; }

  function setFold(v, persist) {
    folded = !!v;
    if (folded) nav.classList.add('folded'); else nav.classList.remove('folded');
    toggle.setAttribute('aria-expanded', folded ? 'false' : 'true');
    toggle.setAttribute('aria-label', folded ? '展开章节导航' : '收起章节导航');
    if (persist !== false) {
      try { localStorage.setItem(FOLD_KEY, folded ? '1' : '0'); } catch (err3) {}
    }
  }
  setFold(folded, false);
  toggle.addEventListener('click', function () { setFold(!folded); });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !folded && window.innerWidth <= 700) setFold(true);
  });

  /* ---------- 目录点击平滑滚动 + 当前小节高亮 ---------- */
  var heads = article ? Array.prototype.slice.call(
    article.querySelectorAll('[data-sec]')) : [];
  function syncCurrent() {
    if (!heads.length || !tocLinks.length) return;
    var cur = heads[0].id, limit = 96;
    for (var k = 0; k < heads.length; k++) {
      if (heads[k].getBoundingClientRect().top <= limit) cur = heads[k].id;
      else break;
    }
    tocLinks.forEach(function (n) {
      n.classList.toggle('cur', n.getAttribute('href') === '#' + cur);
    });
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    (window.requestAnimationFrame || function (fn) { fn(); })(function () {
      syncCurrent(); ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, false);
  window.addEventListener('resize', onScroll, false);

  tocLinks.forEach(function (n) {
    n.addEventListener('click', function (ev) {
      var id = n.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      ev.preventDefault();
      if (target.scrollIntoView) {
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        catch (err4) { target.scrollIntoView(); }
      }
      try {
        if (window.history && history.replaceState) history.replaceState(null, '', '#' + id);
      } catch (err5) { /* 本地 file:// 预览等场景忽略 */ }
      tocLinks.forEach(function (x) { x.classList.toggle('cur', x === n); });
      if (window.innerWidth <= 700) setFold(true);
    });
  });

  wrap.appendChild(nav);
  syncCurrent();
})();
