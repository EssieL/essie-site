/* ============================================================
   统一闪卡库 · 共享存储层
   ------------------------------------------------------------
   同一 origin 下所有页面共用一份 localStorage：
     · 五套按章闪卡网页（xujun-intro/ch{1,2,3,4,5}-flashcards.html）
     · 自体心理学层级的闪卡空间（flashcards/）
   因此「按章页面复习」与「闪卡空间编辑／学习」双向同步。
   数据主键 uid = "章号|题干指纹sid"，编辑与新增都按 uid 覆盖。
   新增章节只需在此登记旧 KEY，按章网页自行调用 chapterLoad/chapterPersist。
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'xj_self_psychology_flashcard_hub_v1';
  var LEGACY = [
    { ch: 1, key: 'xj_ch1_knowledge_cards_v1' },
    { ch: 2, key: 'xj_ch2_knowledge_cards_v4' },
    { ch: 3, key: 'xj_ch3_knowledge_cards_v1' },
    { ch: 4, key: 'xj_ch4_knowledge_cards_v1' },
    { ch: 5, key: 'xj_ch5_knowledge_cards_v1' }
  ];

  function blank() {
    return {
      v: 1,
      status: {},    // uid -> 0 未评 / 1 不会 / 2 模糊 / 3 记得
      edits: {},     // uid -> 覆盖字段
      custom: [],    // 新增卡（完整对象）
      deleted: [],   // 软删除的 uid
      groups: {},    // 命名卡组 -> [uid]
      settings: {},  // 各页设置：ch1 / ch2 / ch3 / ch4 / hub
      migrated: [],  // 已迁移的旧 KEY
      updatedAt: ''
    };
  }

  function rawRead() {
    try {
      var t = localStorage.getItem(KEY);
      if (t) {
        var o = JSON.parse(t), b = blank();
        for (var k in b) { if (!(k in o) || o[k] == null) o[k] = b[k]; }
        return o;
      }
    } catch (e) { /* 忽略损坏数据 */ }
    return blank();
  }

  var data = rawRead();

  /* 原地更新，保持 data 引用不变，避免其他页面持有旧对象 */
  function sync() {
    var fresh = rawRead();
    Object.keys(data).forEach(function (k) { delete data[k]; });
    Object.assign(data, fresh);
  }

  function broadcast() {
    try { window.dispatchEvent(new CustomEvent('hubchange', { detail: data })); } catch (e) { }
  }

  function write() {
    data.updatedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { }
    broadcast();
  }

  window.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) { sync(); broadcast(); }
  });

  /* 旧五套按章页面的复习进度首次接入时合并（只在 hub 尚无记录时写入） */
  function migrate() {
    var changed = false;
    LEGACY.forEach(function (L) {
      if (data.migrated.indexOf(L.key) >= 0) return;
      try {
        var t = localStorage.getItem(L.key);
        if (t) {
          var o = JSON.parse(t);
          Object.keys(o.status || {}).forEach(function (sid) {
            var u = L.ch + '|' + sid;
            if (!(u in data.status)) { data.status[u] = o.status[sid]; changed = true; }
          });
          if (o.settings && !data.settings['ch' + L.ch]) {
            data.settings['ch' + L.ch] = o.settings; changed = true;
          }
        }
      } catch (e) { }
      data.migrated.push(L.key);
      changed = true;
    });
    if (changed) write();
  }

  function init() { migrate(); return data; }

  function uid(ch, sid) { return ch + '|' + sid; }

  /* 只反映「编辑／新增／删除」，复习状态变化不应触发按章页面的刷新提示 */
  function editVersion() {
    return JSON.stringify([data.edits || {}, data.custom || [], data.deleted || []]);
  }

  /* ---------- 统一库视图：基线数据 + 编辑 + 新增 - 删除 ---------- */
  function allCards() {
    var del = {};
    (data.deleted || []).forEach(function (u) { del[u] = 1; });
    var out = (window.HUB_CARDS || []).filter(function (c) { return !del[c.uid]; })
      .map(function (c) { return Object.assign({}, c); });
    var FIELDS = ['q', 'a', 'k', 'src', 'cat', 'module', 'moduleNote', 'ctx', 'case',
      'follow', 'type', 'intro', 'refs', 'refUids', 'sourceSection', 'chapter', 'pages'];
    out.forEach(function (c) {
      var e = data.edits[c.uid];
      if (e) {
        FIELDS.forEach(function (f) { if (f in e) c[f] = e[f]; });
        c.edited = true;
      }
    });
    (data.custom || []).forEach(function (c) {
      if (del[c.uid]) return;
      out.push(Object.assign({ custom: true }, c));
    });
    out.forEach(function (c) { c.status = data.status[c.uid] || 0; });
    return out;
  }

  /* ---------- 按章页面适配：把统一库的编辑/新增/删除应用到章内 CARDS ---------- */
  function applyToChapter(cards, cats, ch) {
    var del = {};
    (data.deleted || []).forEach(function (u) { del[u] = 1; });

    for (var i = cards.length - 1; i >= 0; i--) {
      if (del[ch + '|' + cards[i].sid]) cards.splice(i, 1);
    }

    cards.forEach(function (c) {
      var e = data.edits[ch + '|' + c.sid];
      if (!e) return;
      ['q', 'a', 'k', 'src', 'cat', 'ctx', 'case', 'follow', 'refs'].forEach(function (f) {
        if (f in e) c[f] = e[f];
      });
      if ('type' in e) {
        if (e.type === '案例情节卡') c.intro = 1;
        else delete c.intro;
      }
    });

    /* 新增/编辑可能带来新模块，补进章内 CATS（供筛选下拉与排序使用） */
    var need = {};
    (data.custom || []).forEach(function (c) {
      if (c.ch === ch) need[c.cat] = c.module || '自定义';
    });
    Object.keys(data.edits || {}).forEach(function (u) {
      if (u.indexOf(ch + '|') === 0 && data.edits[u].cat) {
        need[data.edits[u].cat] = data.edits[u].module || '自定义';
      }
    });
    Object.keys(need).forEach(function (k) {
      if (!cats.some(function (x) { return x.k === k; })) {
        cats.push({ k: k, label: need[k], color: '#6b7a8f', note: '闪卡空间新增／编辑' });
      }
    });

    (data.custom || []).forEach(function (c) {
      if (c.ch !== ch || del[c.uid]) return;
      if (cards.some(function (x) { return x.sid === c.sid; })) return;
      cards.push({
        id: c.id, sid: c.sid, cat: c.cat, q: c.q, a: c.a, k: c.k,
        src: c.src, refs: c.refs || [], ctx: c.ctx || '',
        intro: c.intro ? 1 : undefined, case: c.case || '', follow: c.follow || ''
      });
    });
    return cards.length;
  }

  /* 按章页面读：把 hub.status 中该章的部分还原成 {status:{sid:v},settings:{}} */
  function chapterLoad(ch, legacyKey) {
    var status = {}, prefix = ch + '|';
    Object.keys(data.status || {}).forEach(function (u) {
      if (u.indexOf(prefix) === 0) status[u.slice(prefix.length)] = data.status[u];
    });
    var st = data.settings['ch' + ch];
    if (!st) {
      try {
        var t = localStorage.getItem(legacyKey);
        if (t) st = (JSON.parse(t) || {}).settings || {};
      } catch (e) { }
    }
    return JSON.stringify({ status: status, settings: st || {} });
  }

  /* 按章页面写：先同步最新 hub（不覆盖其它章），再重写本章状态 */
  function chapterPersist(ch, legacyKey, saved) {
    sync();
    var prefix = ch + '|';
    Object.keys(data.status).forEach(function (u) {
      if (u.indexOf(prefix) === 0) delete data.status[u];
    });
    Object.keys(saved.status || {}).forEach(function (sid) {
      data.status[prefix + sid] = saved.status[sid];
    });
    data.settings['ch' + ch] = saved.settings || {};
    write();
  }

  /* ---------- 闪卡空间写操作 ---------- */
  function setStatus(u, v) {
    sync();
    if (v) data.status[u] = v; else delete data.status[u];
    write();
  }

  function setEdit(u, patch) {
    sync();
    /* 自定义新增卡直接改 custom 记录；基线卡才用覆盖层 */
    var cu = (data.custom || []).filter(function (c) { return c.uid === u; })[0];
    if (cu) { Object.assign(cu, patch); write(); return; }
    var base = (window.HUB_CARDS || []).filter(function (c) { return c.uid === u; })[0];
    var e = data.edits[u] || {};
    Object.assign(e, patch);
    /* 与基线相同的字段不再重复保存 */
    if (base) Object.keys(e).forEach(function (f) {
      if (JSON.stringify(e[f]) === JSON.stringify(base[f])) delete e[f];
    });
    if (Object.keys(e).length) data.edits[u] = e; else delete data.edits[u];
    write();
  }

  function addCustom(card) {
    sync();
    var stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var ch = Number(card.ch) || 1;
    var sid = 'c_' + stamp;
    var u = uid(ch, sid);
    var c = Object.assign({
      uid: u, ch: ch, sid: sid, id: '自' + (data.custom.length + 1).toString().padStart(3, '0'),
      book: '徐钧《自体心理学入门》', chapter: '', pages: '', sourceFile: '',
      sourceSection: '', cat: 'custom', module: '自定义', moduleNote: '',
      web: '', legacyKey: '', type: '题卡', q: '', a: [], k: [], src: '',
      refs: [], refUids: [], ctx: '', intro: 0, case: '', follow: ''
    }, card, { uid: u, ch: ch, sid: sid, custom: true });
    data.custom.push(c);
    write();
    return c;
  }

  function remove(u) {
    sync();
    if (data.deleted.indexOf(u) < 0) data.deleted.push(u);
    write();
  }

  function restore(u) {
    sync();
    data.deleted = data.deleted.filter(function (x) { return x !== u; });
    write();
  }

  function saveGroup(name, list) {
    sync();
    data.groups[name] = list.slice();
    write();
  }

  function deleteGroup(name) {
    sync();
    delete data.groups[name];
    write();
  }

  function setSetting(name, obj) {
    sync();
    data.settings[name] = obj;
    write();
  }

  function exportAll() {
    return JSON.stringify({
      format: 'xj-flashcard-hub', version: 1,
      book: '徐钧《自体心理学入门》', exportedAt: new Date().toISOString(),
      hub: data
    }, null, 1);
  }

  function importAll(text) {
    var o = JSON.parse(text);
    var h = o && o.hub ? o.hub : o;
    if (!h || typeof h !== 'object') throw new Error('文件格式不正确');
    var b = blank();
    for (var k in b) { if (!(k in h) || h[k] == null) h[k] = b[k]; }
    Object.keys(data).forEach(function (k) { delete data[k]; });
    Object.assign(data, h);
    write();
    return true;
  }

  function clearStatus(chapterFilter) {
    sync();
    Object.keys(data.status).forEach(function (u) {
      if (!chapterFilter || u.indexOf(chapterFilter + '|') === 0) delete data.status[u];
    });
    write();
  }

  function resetEdits() {
    sync();
    data.edits = {}; data.custom = []; data.deleted = [];
    write();
  }

  window.Hub = {
    KEY: KEY, LEGACY: LEGACY,
    init: init, data: function () { return data; }, reload: sync, save: write,
    uid: uid, editVersion: editVersion,
    allCards: allCards, applyToChapter: applyToChapter,
    chapterLoad: chapterLoad, chapterPersist: chapterPersist,
    setStatus: setStatus, setEdit: setEdit, addCustom: addCustom,
    remove: remove, restore: restore,
    saveGroup: saveGroup, deleteGroup: deleteGroup,
    setSetting: setSetting, getSetting: function (n) { return data.settings[n] || {}; },
    exportAll: exportAll, importAll: importAll,
    clearStatus: clearStatus, resetEdits: resetEdits,
    statusName: function (v) { return ['未评', '不会', '模糊', '记得'][v || 0]; }
  };
})();
