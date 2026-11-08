/* Freud作品 · 正文阅读页专用门禁
   用户 2026-11-08：模块其它页面完全不设密码；仅正文阅读页密码 = Freud。
   会话键 freud_text_unlocked 与旅行侧 essie_unlocked、学习区 essie_learn_unlocked
   三者互不相通，避免任一处解锁后连带放行。
   注意：纯静态站只挡「随手点开」，HTML 源码与公开仓库仍含全文。 */
(function () {
  var PASSWORD = 'Freud';
  var SESSION_KEY = 'freud_text_unlocked';
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
