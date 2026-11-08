/* 笔记管理 · 共享存储层
   正文阅读页（xujun-intro/text/）与笔记管理空间（notes/）共用同一份 localStorage。
   数据：notes（段落笔记）/ underlines（划线＝重点句，自动摘抄）/ marks（高亮＝句内重点）
        / deleted（软删除）/ settings。
   层级：划线是句子级重点；落在划线范围内的高亮是该句的句内重点。
   摘抄由「划线原文 + 其内高亮词」实时合成，不另存冗余副本，故高亮增删会同步反映。
   每条都带 book 字段，当前只收《自体心理学入门》，结构预留跨书目。
   纯前端本地存储，不上传；换设备用「数据管理 → JSON 导出／导入」迁移。 */
(function (global) {
  'use strict';
  var KEY = 'xj_self_psychology_notes_hub_v1';
  var BOOK = '徐钧《自体心理学入门》';

  function blank() {
    return { v: 2, book: BOOK, notes: {}, underlines: {}, marks: {},
             deleted: [], settings: {}, updatedAt: '' };
  }
  var data = blank();
  var started = false;

  function now() { return new Date().toISOString(); }
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function arr(o) { return Object.keys(o || {}).map(function (k) { return o[k]; }); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isDel(id) { return data.deleted.indexOf(id) >= 0; }

  function read() {
    try { return JSON.parse(global.localStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }
  }
  function sync() {
    var r = read();
    if (!r || !r.v) return;
    var d = blank();
    d.notes = r.notes || {};
    d.underlines = r.underlines || {};          // v1 备份无此表 → 空对象，旧数据不丢
    d.marks = r.marks || {};
    d.deleted = r.deleted || [];
    d.settings = r.settings || {};
    d.updatedAt = r.updatedAt || '';
    data = d;
  }
  function emit() {
    try {
      global.dispatchEvent(new CustomEvent('noteschange', { detail: { at: data.updatedAt } }));
    } catch (e) {
      try {
        var ev = global.document.createEvent('Event');
        ev.initEvent('noteschange', true, true);
        global.dispatchEvent(ev);
      } catch (e2) {}
    }
  }
  function write() {
    data.updatedAt = now();
    try { global.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    emit();
    return data.updatedAt;
  }

  function decorate(x, type) {
    var o = copy(x);
    o.type = type;
    o.deleted = isDel(o.uid);
    return o;
  }
  function byTime(a, b) { return String(a.createdAt || '').localeCompare(String(b.createdAt || '')); }

  var Hub = {
    KEY: KEY,
    BOOK: BOOK,
    CHAPTERS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],

    init: function () {
      if (started) return;
      started = true;
      sync();
      try {
        global.addEventListener('storage', function (e) {
          if (e && e.key && e.key !== KEY) return;
          sync();
          emit();
        });
      } catch (e) {}
    },

    data: function () { return data; },
    refresh: sync,

    allNotes: function (includeDeleted) {
      return arr(data.notes).map(function (x) { return decorate(x, 'note'); })
        .filter(function (x) { return includeDeleted || !x.deleted; }).sort(byTime);
    },
    allUnderlines: function (includeDeleted) {
      return arr(data.underlines).map(function (x) { return decorate(x, 'underline'); })
        .filter(function (x) { return includeDeleted || !x.deleted; }).sort(byTime);
    },
    allMarks: function (includeDeleted) {
      return arr(data.marks).map(function (x) { return decorate(x, 'mark'); })
        .filter(function (x) { return includeDeleted || !x.deleted; }).sort(byTime);
    },
    all: function (includeDeleted) {
      return Hub.allNotes(includeDeleted)
        .concat(Hub.allUnderlines(includeDeleted))
        .concat(Hub.allMarks(includeDeleted));
    },
    chapterNotes: function (ch, includeDeleted) {
      return Hub.allNotes(includeDeleted).filter(function (x) { return String(x.ch) === String(ch); });
    },
    chapterUnderlines: function (ch, includeDeleted) {
      return Hub.allUnderlines(includeDeleted).filter(function (x) { return String(x.ch) === String(ch); });
    },
    chapterMarks: function (ch, includeDeleted) {
      return Hub.allMarks(includeDeleted).filter(function (x) { return String(x.ch) === String(ch); });
    },
    chapterAll: function (ch, includeDeleted) {
      return Hub.chapterNotes(ch, includeDeleted)
        .concat(Hub.chapterUnderlines(ch, includeDeleted))
        .concat(Hub.chapterMarks(ch, includeDeleted));
    },
    counts: function () {
      return { notes: Hub.allNotes().length, underlines: Hub.allUnderlines().length,
               marks: Hub.allMarks().length, deleted: data.deleted.length };
    },

    addNote: function (patch) {
      var p = patch || {};
      var id = uid('n');
      var t = now();
      data.notes[id] = {
        uid: id, book: p.book || BOOK, ch: Number(p.ch) || 1,
        sec: p.sec || '', pid: p.pid || '',
        preview: p.preview || '', text: p.text || '',
        tags: p.tags || [], color: p.color || '',
        source: p.source || 'hub', underUid: p.underUid || '',
        createdAt: t, updatedAt: t
      };
      write();
      return data.notes[id];
    },
    updateNote: function (id, patch) {
      var n = data.notes[id];
      if (!n) return null;
      var p = patch || {};
      ['book', 'sec', 'pid', 'preview', 'text', 'tags', 'color'].forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(p, k)) n[k] = p[k];
      });
      if (p.ch !== undefined) n.ch = Number(p.ch) || 1;
      n.updatedAt = now();
      write();
      return n;
    },

    /* 划线：句子级重点，自动成为笔记里的摘抄 */
    addUnderline: function (patch) {
      var p = patch || {};
      var id = uid('u');
      var t = now();
      data.underlines[id] = {
        uid: id, book: p.book || BOOK, ch: Number(p.ch) || 1,
        sec: p.sec || '', pid: p.pid || '',
        start: Number(p.start) || 0, end: Number(p.end) || 0,
        quote: p.quote || '', color: p.color || 'y',
        note: p.note || '',                 // 对这条摘抄的想法，可双向编辑
        preview: p.preview || '',
        createdAt: t, updatedAt: t
      };
      write();
      return data.underlines[id];
    },
    updateUnderline: function (id, patch) {
      var u = data.underlines[id];
      if (!u) return null;
      var p = patch || {};
      ['sec', 'pid', 'start', 'end', 'quote', 'color', 'note', 'preview'].forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(p, k)) u[k] = p[k];
      });
      if (p.ch !== undefined) u.ch = Number(p.ch) || 1;
      u.updatedAt = now();
      write();
      return u;
    },

    addMark: function (patch) {
      var p = patch || {};
      var id = uid('m');
      var t = now();
      data.marks[id] = {
        uid: id, book: p.book || BOOK, ch: Number(p.ch) || 1,
        sec: p.sec || '', pid: p.pid || '',
        start: Number(p.start) || 0, end: Number(p.end) || 0,
        quote: p.quote || '', color: p.color || 'y',
        under: p.under || '',              // 所属划线 uid；空＝独立高亮
        createdAt: t
      };
      write();
      return data.marks[id];
    },
    updateMark: function (id, patch) {
      var m = data.marks[id];
      if (!m) return null;
      var p = patch || {};
      ['sec', 'pid', 'start', 'end', 'quote', 'color', 'under'].forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(p, k)) m[k] = p[k];
      });
      if (p.ch !== undefined) m.ch = Number(p.ch) || 1;
      write();
      return m;
    },

    /* 找包含选区的最内层划线（用于给新高亮自动归属） */
    findUnderline: function (ch, pid, start, end) {
      var best = null, bestLen = Infinity;
      Hub.chapterUnderlines(ch).forEach(function (u) {
        if (u.pid !== pid) return;
        if (Number(u.start) <= start && Number(u.end) >= end) {
          var len = Number(u.end) - Number(u.start);
          if (len < bestLen) { best = u; bestLen = len; }
        }
      });
      return best ? best.uid : '';
    },
    /* 某条划线内的高亮：优先按 under 字段，兼容旧数据的几何包含 */
    marksWithin: function (uid) {
      var u = data.underlines[uid];
      if (!u || isDel(uid)) return [];
      return arr(data.marks).filter(function (m) {
        if (isDel(m.uid) || m.pid !== u.pid) return false;
        if (m.under) return m.under === uid;
        return Number(m.start) >= Number(u.start) && Number(m.end) <= Number(u.end);
      }).map(function (m) { return decorate(m, 'mark'); }).sort(function (a, b) {
        return Number(a.start) - Number(b.start);
      });
    },
    /* 摘抄合成：划线原文 + 其内高亮的标记；返回 html / md / parts */
    excerpt: function (uid) {
      var u = data.underlines[uid];
      if (!u) return null;
      var q = String(u.quote || '');
      var spans = Hub.marksWithin(uid).map(function (m) {
        return { s: Number(m.start) - Number(u.start),
                 e: Number(m.end) - Number(u.start), color: m.color || 'y' };
      }).filter(function (x) {
        return x.s >= 0 && x.e <= q.length && x.s < x.e;
      }).sort(function (a, b) { return a.s - b.s || a.e - b.e; });

      var parts = [], pos = 0;
      spans.forEach(function (x) {
        if (x.s < pos) return;                       // 重叠高亮：保留先出现的
        if (x.s > pos) parts.push({ text: q.slice(pos, x.s), color: '' });
        parts.push({ text: q.slice(x.s, x.e), color: x.color });
        pos = x.e;
      });
      if (pos < q.length) parts.push({ text: q.slice(pos), color: '' });
      if (!parts.length) parts.push({ text: q, color: '' });

      return {
        uid: uid, quote: q, color: u.color || 'y', note: u.note || '', parts: parts,
        html: parts.map(function (p) {
          return p.color ? '<mark class="ann-mark ann-' + esc(p.color) + '">' + esc(p.text) + '</mark>'
                         : esc(p.text);
        }).join(''),
        md: parts.map(function (p) { return p.color ? '**' + p.text + '**' : p.text; }).join('')
      };
    },

    remove: function (id) {
      if (!data.notes[id] && !data.underlines[id] && !data.marks[id]) return false;
      if (!isDel(id)) data.deleted.push(id);
      // 划线删除后，其句内高亮保留但解除归属，避免指向失效摘抄
      if (data.underlines[id]) {
        arr(data.marks).forEach(function (m) { if (m.under === id) m.under = ''; });
      }
      write();
      return true;
    },
    restore: function (id) {
      var i = data.deleted.indexOf(id);
      if (i < 0) return false;
      data.deleted.splice(i, 1);
      // 恢复划线时，把几何落在其范围内的独立高亮重新归属
      var u = data.underlines[id];
      if (u) {
        arr(data.marks).forEach(function (m) {
          if (!m.under && !isDel(m.uid) && m.pid === u.pid &&
              Number(m.start) >= Number(u.start) && Number(m.end) <= Number(u.end)) m.under = id;
        });
      }
      write();
      return true;
    },
    purge: function (id) {
      delete data.notes[id]; delete data.underlines[id]; delete data.marks[id];
      var i = data.deleted.indexOf(id);
      if (i >= 0) data.deleted.splice(i, 1);
      write();
    },

    setSetting: function (k, v) { data.settings[k] = v; write(); },
    getSetting: function (k, def) {
      return Object.prototype.hasOwnProperty.call(data.settings, k) ? data.settings[k] : def;
    },

    exportAll: function () { return JSON.stringify(data, null, 2); },
    importAll: function (text, merge) {
      var incoming;
      try { incoming = typeof text === 'string' ? JSON.parse(text) : text; }
      catch (e) { throw new Error('JSON 解析失败'); }
      if (!incoming || typeof incoming !== 'object' || !incoming.notes || !incoming.marks) {
        throw new Error('不是有效的笔记备份');
      }
      if (!merge) {
        var d = blank();
        d.notes = incoming.notes || {};
        d.underlines = incoming.underlines || {};
        d.marks = incoming.marks || {};
        d.deleted = incoming.deleted || [];
        d.settings = incoming.settings || {};
        data = d;
      } else {
        [['notes', 'notes'], ['underlines', 'underlines'], ['marks', 'marks']].forEach(function (pair) {
          Object.keys(incoming[pair[1]] || {}).forEach(function (k) { data[pair[0]][k] = incoming[pair[1]][k]; });
        });
        (incoming.deleted || []).forEach(function (k) {
          if (!isDel(k)) data.deleted.push(k);
        });
      }
      write();
      return Hub.counts();
    },
    clearAll: function () { data = blank(); write(); }
  };

  global.NotesHub = Hub;
})(typeof window !== 'undefined' ? window : this);
