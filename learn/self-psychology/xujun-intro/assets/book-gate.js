/* 正文阅读区 · 前端展示层门禁
   与 travel/index.html 使用同一个密码、同一个 sessionStorage 键（essie_unlocked），
   因此同一标签页里解锁过旅行手册后，正文也直接放行；反之亦然。
   注意：纯静态站没有服务端鉴权，HTML 源码与公开仓库里仍含全文，
   此门禁只挡「随手点开」，不构成真正的访问控制。 */
(function () {
  var PASSWORD = 'lxjh2026';
  var KEY = 'essie_unlocked';
  var root = document.documentElement;
  if ((' ' + root.className + ' ').indexOf(' xj-locked ') < 0) return;

  var input = document.getElementById('xjPwd');
  var btn = document.getElementById('xjGo');
  var err = document.getElementById('xjErr');
  if (!input || !btn) return;

  function unlock() {
    if (input.value !== PASSWORD) {
      if (err) err.style.display = 'block';
      input.focus();
      input.select();
      return;
    }
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    root.className = (' ' + root.className + ' ').replace(' xj-locked ', ' ').replace(/^\s+|\s+$/g, '');
  }

  btn.addEventListener('click', unlock);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') unlock();
  });
  input.addEventListener('input', function () {
    if (err) err.style.display = 'none';
  });
  input.focus();
})();
