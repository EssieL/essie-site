/* 河南旅行 · 密码门
   与「2026 澳新旅行手册」用同一个密码。
   要改密码，只改下面这行 PW；PW 留空 = 不上锁（正常浏览）。
   输一次，本次浏览的所有页面都放行（sessionStorage）。 */
(function () {
  var PW  = "";              // ← 密码，与澳新手册一致
  var KEY = "henan-ok";      // 本次浏览的放行标记
  var root = document.documentElement;

  function unlock() { root.classList.remove("locked"); }

  // 没设密码 → 不锁
  if (!PW) { unlock(); return; }

  // 本次浏览已输过 → 直接放行
  try { if (sessionStorage.getItem(KEY) === "1") { unlock(); return; } } catch (e) {}

  function build() {
    var g = document.createElement("div");
    g.className = "gate";
    g.innerHTML =
      '<div class="gate-inner">' +
        '<div class="lock">🔒</div>' +
        '<h2>河南旅行</h2>' +
        '<p>私人行程册，请输入密码。<br>与「澳新旅行手册」同一个密码。</p>' +
        '<input id="gpw" type="password" autocomplete="current-password" placeholder="密码">' +
        '<button id="gbtn" type="button">进入</button>' +
        '<div class="gate-err" id="gerr"></div>' +
        '<p class="hint">输一次就行，本次浏览的其它页面不用再输。</p>' +
      '</div>';
    document.body.appendChild(g);

    var inp = g.querySelector("#gpw");
    var err = g.querySelector("#gerr");

    function tryIt() {
      if (inp.value.trim() === PW) {
        try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
        unlock();
        g.remove();
      } else {
        err.textContent = "密码不对，再试一次";
        inp.value = "";
        inp.focus();
      }
    }

    g.querySelector("#gbtn").addEventListener("click", tryIt);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") tryIt(); });
    setTimeout(function () { inp.focus(); }, 60);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
