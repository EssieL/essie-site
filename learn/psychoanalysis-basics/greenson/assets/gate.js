/* 精分基础 · Ursano《简明指南》正文阅读页门禁
   按站内约定（README 2026-11-08）：学习区新增门禁沿用通用密码与独立会话键
   essie_learn_unlocked，与旅行侧 essie_unlocked、Freud 模块 freud_text_unlocked 互不相通。
   注意：纯静态站只挡「随手点开」，HTML 源码与公开仓库仍含全文。 */
(function () {
  var PASSWORD = 'esgrmima';
  var SESSION_KEY = 'essie_learn_unlocked';
  var root = document.documentElement;
  if ((' ' + root.className + ' ').indexOf(' xj-locked ') < 0) return;
  var input = document.getElementById('xjPwd');
  var btn = document.getElementById('xjGo');
  var err = document.getElementById('xjErr');
  if (!input || !btn) return;
  function unlock() {
    if (input.value !== PASSWORD) {
      if (err) err.style.display = 'block';
      input.focus(); input.select(); return;
    }
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
    root.className = (' ' + root.className + ' ').replace(' xj-locked ', ' ').replace(/^\s+|\s+$/g, '');
  }
  btn.addEventListener('click', unlock);
  input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') unlock(); });
  input.addEventListener('input', function () { if (err) err.style.display = 'none'; });
  input.focus();
})();