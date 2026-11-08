/* 站内通用展示层门禁（旅行手册除外）
   用户 2026-11-08 要求：旅行手册密码保持原样；网站其它部分如需密码，
   统一换成另一个。因此本站所有「非旅行」门禁共用下列一对常量：
     PASSWORD     = esgrmima
     SESSION_KEY  = essie_learn_unlocked
   与 travel/index.html、rec-*.html、records-*.html 的密码及 essie_unlocked
   完全隔离：解锁旅行不会放行正文，解锁正文也不会放行旅行。
   日后站内其它区域新增门禁，请引用本文件（或复制这一对常量），勿另设密码。
   注意：纯静态站没有服务端鉴权，HTML 源码与公开仓库里仍含全文，
   此门禁只挡「随手点开」，不构成真正的访问控制。 */
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
      input.focus();
      input.select();
      return;
    }
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
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
