/* 笔记管理 · 共享存储层
   正文阅读页（xujun-intro/text/）与笔记管理空间（notes/）共用同一份 localStorage。
   数据：notes（段落笔记）/ marks（选区高亮）/ deleted（软删除）/ settings。
   每条都带 book 字段，当前只收《自体心理学入门》，结构预留跨书目。
   纯前端本地存储，不上传；换设备用「数据管理 → JSON 导出／导入」迁移。 */
(function (global) {
  'use strict';
  var KEY = 'xj_self_psychology_notes_hub_v1';
  var BOOK = '徐钧《自体心理学入门》';

  function blank() {
    return { v: 1, book: BOOK, notes: {}, marks: {}, deleted: [], settings: {}, updatedAt: '' };
  }
  var data = blank();
  var started = false;

  function now() { return new Date().toISOString(); }
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function arr(o) { return Object.keys(o || {}).map(function (k) { return o[k]; }); }

  function read() {
    try { return JSON.parse(global.localStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }
  }
  function sync() {
    var r = read();
    if (!r || !r.v) return;
    var d = blank();
    d.notes = r.notes || {};
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
    o.deleted = data.deleted.indexOf(o.uid) >= 0;
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
    allMarks: function (includeDeleted) {
      return arr(data.marks).map(function (x) { return decorate(x, 'mark'); })
        .filter(function (x) { return includeDeleted || !x.deleted; }).sort(byTime);
    },
    all: function (includeDeleted) {
      return Hub.allNotes(includeDeleted).concat(Hub.allMarks(includeDeleted));
    },
    chapterNotes: function (ch, includeDeleted) {
      return Hub.allNotes(includeDeleted).filter(function (x) { return String(x.ch) === String(ch); });
    },
    chapterMarks: function (ch, includeDeleted) {
      return Hub.allMarks(includeDeleted).filter(function (x) { return String(x.ch) === String(ch); });
    },
    chapterAll: function (ch, includeDeleted) {
      return Hub.chapterNotes(ch, includeDeleted).concat(Hub.chapterMarks(ch, includeDeleted));
    },
    counts: function () {
      return { notes: Hub.allNotes().length, marks: Hub.allMarks().length,
               deleted: data.deleted.length };
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
        source: p.source || 'hub',
        createdAt: t, updatedAt: t
      };
      write();
      return data.notes[id];
    },
    updateNote: function (id, patch) {
      var n = data.notes[id];
      if (!n) return null;
      var p = patch || {};
      ['book', 'ch', 'sec', 'pid', 'preview', 'text', 'tags', 'color'].forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(p, k)) n[k] = p[k];
      });
      if (p.ch !== undefined) n.ch = Number(p.ch) || 1;
      n.updatedAt = now();
      write();
      return n;
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
        createdAt: t
      };
      write();
      return data.marks[id];
    },
    updateMark: function (id, patch) {
      var m = data.marks[id];
      if (!m) return null;
      var p = patch || {};
      ['ch', 'sec', 'pid', 'start', 'end', 'quote', 'color'].forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(p, k)) m[k] = p[k];
      });
      if (p.ch !== undefined) m.ch = Number(p.ch) || 1;
      write();
      return m;
    },

    remove: function (id) {
      if (!data.notes[id] && !data.marks[id]) return false;
      if (data.deleted.indexOf(id) < 0) data.deleted.push(id);
      write();
      return true;
    },
    restore: function (id) {
      var i = data.deleted.indexOf(id);
      if (i < 0) return false;
      data.deleted.splice(i, 1);
      write();
      return true;
    },
    purge: function (id) {
      delete data.notes[id]; delete data.marks[id];
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
        d.notes = incoming.notes || {}; d.marks = incoming.marks || {};
        d.deleted = incoming.deleted || []; d.settings = incoming.settings || {};
        data = d;
      } else {
        Object.keys(incoming.notes || {}).forEach(function (k) { data.notes[k] = incoming.notes[k]; });
        Object.keys(incoming.marks || {}).forEach(function (k) { data.marks[k] = incoming.marks[k]; });
        (incoming.deleted || []).forEach(function (k) {
          if (data.deleted.indexOf(k) < 0) data.deleted.push(k);
        });
      }
      write();
      return Hub.counts();
    },
    clearAll: function () { data = blank(); write(); }
  };

  global.NotesHub = Hub;
})(typeof window !== 'undefined' ? window : this);
