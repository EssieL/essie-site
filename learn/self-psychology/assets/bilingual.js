/* 自体心理学两本英中对照书目共用 · 中文默认折叠，按「书目/页」记忆 */
(function () {
  'use strict';
  var KEY = 'xj_sp_bilingual_cn_open_v1';
  function qsa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function set(btn, open) {
    var t = document.getElementById(btn.getAttribute('data-target'));
    if (!t) return;
    t.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (btn.classList) btn.classList.toggle('on', open);
    var ic = btn.querySelector('.bi-ic'), lb = btn.querySelector('.bi-lb');
    if (ic) ic.textContent = open ? '▾' : '▸';
    if (lb) lb.textContent = open ? '收起中文' : '显示中文';
  }
  function pageKey() { return location.pathname.split('/').slice(-3).join('/'); }
  function save(v) {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || '{}');
      s[pageKey()] = v;
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (err) {}
  }
  function boot() {
    var btns = qsa('.bi-tog');
    if (!btns.length) return;
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (err) {}
    var all = saved && typeof saved[pageKey()] === 'boolean' ? saved[pageKey()] : false;
    btns.forEach(function (b) { if (!b.disabled) set(b, all); });
    document.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('.bi-tog') : null;
      if (b && !b.disabled) set(b, b.getAttribute('aria-expanded') !== 'true');
    });
    var a = document.getElementById('biAll'), n = document.getElementById('biNone');
    if (a) a.onclick = function () { btns.forEach(function (b) { if (!b.disabled) set(b, true); }); save(true); };
    if (n) n.onclick = function () { btns.forEach(function (b) { if (!b.disabled) set(b, false); }); save(false); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
