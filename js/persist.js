/* persist.js — v1.2.0 demo persistence (WP1 body; WP0 shipped the shell).
   Loads immediately before app.js (T-01, F1): CBP.render does not exist earlier,
   so the save hook is armed lazily from boot(). Frozen surface: CORE_API_v1.2.0.md §4/§5.

   Ladder: IndexedDB → localStorage → memory (T-06). Every read/write in try/catch;
   boot() NEVER rejects. No Date.now(), no Math.random(): saved_at is
   state.clock.today + '#' + a per-session counter (T-04). */
(function () {
  'use strict';
  var P = CBP.persist = CBP.persist || {};

  function CFG() { return CBP.CONFIG; }
  function S() { return CBP.state; }
  function KEY() { return CFG().STORAGE_KEY; }
  function PATH() { return (typeof location !== 'undefined' && location.pathname) || ''; }

  /* ------------------------------------------------------------- slices -- */
  /* CORE_API §5 — domain slices only. `plan2027` and `log` are aliases and are
     never stored twice; they are re-pointed on restore (R3). `backups` is a
     metadata mirror of the IDB store and is deliberately absent (F23). */
  var DOMAIN_KEYS = [
    'users', 'countries', 'projects', 'events', 'activity', 'entrySeq', 'outbox',
    'comments', 'readBy', 'commentSeq', 'pinnedProjects', 'planYears', 'histEdit',
    'dashboards', 'widgetMeta', 'dashSyncedAt', 'integrations',
    'gateEvents', 'gateEventSeq', 'gateProposals', 'proposalSeq',
    'syncQueue', 'syncSeq',
    'contracts', 'contractSeq', 'contractTemplates', 'signingAuthority', 'signingDelegations',
    'scopeByDashboard', 'clock', 'alertPrefs', 'digestQueue'
  ];

  /* CORE_API §5 — the safe navigation/disclosure ui keys (F8/F9/F35). */
  var UI_KEYS = [
    'route', 'param', 'p4Tab', 'p9Tab', 'p12View', 'p12Id', 'p12Tab',
    'p3Countries', 'p12Countries', 'comfort',
    'msgFilter', 'msgSearch', 'msgSort', 'msgGroup',
    'openRows', 'p7Tab', 'p7Report', 'p5Group', 'btOpen', 'maOpen',
    'p9IntSys', 'actFilter', 'p6Filter', 'portfolioSort', 'homeCountry'
  ];

  /* ------------------------------------------------------------ session -- */
  /* A per-tab id with no Date.now()/Math.random(): the path hashed together
     with the high-resolution timer, which is not deterministic output and is
     never rendered into any byte-identity surface (T-04, F37). */
  var SESSION = (function () {
    var t = 0;
    try { t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0; } catch (e) { t = 0; }
    return CBP.fnv1a(PATH() + '|' + t + '|' + (SEQ0()));
  }());
  function SEQ0() { try { return String((window.__cbpTabSeq = (window.__cbpTabSeq || 0) + 1)); } catch (e) { return '1'; } }

  var saveSeq = 0;
  function stamp() {
    var today = (S() && S().clock && S().clock.today) || (CFG() && CFG().TODAY) || '0000-00-00';
    return today + '#' + (++saveSeq);
  }

  /* ------------------------------------------------------------ storage -- */

  var kind = 'memory';      /* 'indexeddb' | 'localstorage' | 'memory' */
  var db = null;
  var memRecord = null;     /* memory-mode record */
  var memBackups = [];      /* memory-mode backups */
  var baseRev = 0;          /* the rev this tab last wrote or read */
  var stale = false;
  var lastHash = null;
  var lastBytes = 0;
  var lastSavedAt = null;
  var note = '';
  var timer = null;

  P.ready = false;
  P.initResult = null;   /* WP1 addition: what the last boot()/init() did */

  function idbOpen() {
    return new Promise(function (res, rej) {
      var idb = null;
      try { idb = (typeof indexedDB !== 'undefined') ? indexedDB : null; } catch (e) { idb = null; }
      if (!idb) return rej(new Error('indexedDB unavailable'));
      var req;
      try { req = idb.open(KEY(), 1); } catch (e) { return rej(e); }
      req.onupgradeneeded = function () {
        var d = req.result;
        try {
          if (!d.objectStoreNames.contains('snap')) d.createObjectStore('snap');
          if (!d.objectStoreNames.contains('backups')) d.createObjectStore('backups', { keyPath: 'id' });
        } catch (e) {}
      };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error || new Error('indexedDB open failed')); };
      req.onblocked = function () { rej(new Error('indexedDB blocked')); };
    });
  }

  function tx(store, mode, fn) {
    return new Promise(function (res, rej) {
      var t, os, req;
      try {
        t = db.transaction(store, mode);
        os = t.objectStore(store);
        req = fn(os);
      } catch (e) { return rej(e); }
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error || new Error('idb request failed')); };
    });
  }

  function lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* record IO — resolves null when nothing is stored, never rejects */
  function readRecord() {
    if (kind === 'indexeddb') {
      return tx('snap', 'readonly', function (os) { return os.get(KEY()); })
        .then(function (r) { return r || null; }, function () { return null; });
    }
    if (kind === 'localstorage') return Promise.resolve(lsGet(KEY()));
    return Promise.resolve(memRecord);
  }

  function writeRecord(rec) {
    if (kind === 'indexeddb') {
      return tx('snap', 'readwrite', function (os) { return os.put(rec, KEY()); })
        .then(function () { return true; }, function () { return false; });
    }
    if (kind === 'localstorage') return Promise.resolve(lsSet(KEY(), rec));
    memRecord = rec;
    return Promise.resolve(true);
  }

  function wipeRecord() {
    if (kind === 'indexeddb') {
      return tx('snap', 'readwrite', function (os) { return os['delete'](KEY()); })
        .then(function () { return true; }, function () { return false; });
    }
    if (kind === 'localstorage') { lsDel(KEY()); return Promise.resolve(true); }
    memRecord = null;
    return Promise.resolve(true);
  }

  /* backups store — never part of the snapshot (F23) */
  function backupsAll() {
    if (kind === 'indexeddb') {
      return tx('backups', 'readonly', function (os) { return os.getAll(); })
        .then(function (r) { return r || []; }, function () { return []; });
    }
    if (kind === 'localstorage') return Promise.resolve(lsGet(KEY() + '.backups') || []);
    return Promise.resolve(memBackups.slice());
  }

  function backupsPut(row) {
    if (kind === 'indexeddb') {
      return tx('backups', 'readwrite', function (os) { return os.put(row); })
        .then(function () { return true; }, function () { return false; });
    }
    if (kind === 'localstorage') {
      var rows = lsGet(KEY() + '.backups') || [];
      rows.push(row);
      return Promise.resolve(lsSet(KEY() + '.backups', rows));
    }
    memBackups.push(row);
    return Promise.resolve(true);
  }

  function backupsDel(id) {
    if (kind === 'indexeddb') {
      return tx('backups', 'readwrite', function (os) { return os['delete'](id); })
        .then(function () { return true; }, function () { return false; });
    }
    if (kind === 'localstorage') {
      var rows = (lsGet(KEY() + '.backups') || []).filter(function (r) { return r.id !== id; });
      return Promise.resolve(lsSet(KEY() + '.backups', rows));
    }
    memBackups = memBackups.filter(function (r) { return r.id !== id; });
    return Promise.resolve(true);
  }

  /* ladder: IndexedDB → localStorage → memory */
  function openStore() {
    return idbOpen().then(function (d) {
      db = d; kind = 'indexeddb'; note = '';
      return kind;
    }, function () {
      var ok = false;
      try {
        if (typeof localStorage !== 'undefined' && localStorage) {
          localStorage.setItem(KEY() + '.probe', '1');
          localStorage.removeItem(KEY() + '.probe');
          ok = true;
        }
      } catch (e) { ok = false; }
      kind = ok ? 'localstorage' : 'memory';
      note = ok ? 'IndexedDB unavailable — using local storage.'
                : 'Persistence unavailable in this browser — running in memory.';
      return kind;
    });
  }

  /* ---------------------------------------------------------- migrations - */

  function prune(state) {
    /* R6 — drop widget ids W.byId does not know from every restored board */
    var known = function (id) { try { return !!(CBP.W && CBP.W.byId && CBP.W.byId(id)); } catch (e) { return true; } };
    (state.dashboards || []).forEach(function (b) {
      if (!b || !b.widgets) return;
      b.widgets = b.widgets.filter(known);
      if (b.layout) {
        Object.keys(b.layout).forEach(function (id) { if (!known(id)) delete b.layout[id]; });
      }
    });
    return state;
  }

  P.MIGRATIONS = {
    /* 1 → 2 : v1.0.x → v1.1.0 — the EGC + Contracts slices arrive. */
    1: function (s) {
      var seed = (typeof CBP_DATA !== 'undefined' && CBP_DATA) || {};
      if (!s.planYears) s.planYears = { '2027': s.plan2027 || {} };
      if (!s.histEdit) s.histEdit = {};
      if (!s.widgetMeta) s.widgetMeta = {};
      if (!('dashSyncedAt' in s)) s.dashSyncedAt = null;
      if (!s.scopeByDashboard) s.scopeByDashboard = {};
      if (!s.integrations) s.integrations = JSON.parse(JSON.stringify(seed.integrations || {}));
      if (!s.gateEvents) s.gateEvents = JSON.parse(JSON.stringify(seed.gate_events_seed || []));
      if (typeof s.gateEventSeq !== 'number') s.gateEventSeq = s.gateEvents.length;
      if (!s.gateProposals) s.gateProposals = [];
      if (typeof s.proposalSeq !== 'number') s.proposalSeq = 0;
      if (!s.syncQueue) s.syncQueue = [];
      if (typeof s.syncSeq !== 'number') s.syncSeq = 0;
      if (!s.contracts) s.contracts = JSON.parse(JSON.stringify(seed.contracts || []));
      if (typeof s.contractSeq !== 'number') s.contractSeq = seed.contract_seq || 1;
      if (!s.contractTemplates) s.contractTemplates = JSON.parse(JSON.stringify(seed.contract_templates || []));
      if (!s.signingAuthority) s.signingAuthority = JSON.parse(JSON.stringify(seed.signing_authority || []));
      if (!s.signingDelegations) s.signingDelegations = JSON.parse(JSON.stringify(seed.signing_delegations || []));
      s.ui = s.ui || {};
      if (!('p12View' in s.ui)) s.ui.p12View = 'list';
      if (!('p12Tab' in s.ui)) s.ui.p12Tab = 'document';
      if (!('p9IntSys' in s.ui)) s.ui.p9IntSys = 'chas';
      return s;
    },

    /* 2 → 3 : v1.1.0 → v1.2.0 — clock, alert prefs, digest queue, two-bucket
       outbox rows, the new safe ui keys; unknown widget ids pruned (R6). */
    2: function (s) {
      var seed = (typeof CBP_DATA !== 'undefined' && CBP_DATA) || {};
      if (!s.clock) s.clock = { today: seed.TODAY, advanced_days: 0, backup_seq: 0 };
      if (!s.clock.today) s.clock.today = seed.TODAY;
      if (typeof s.clock.advanced_days !== 'number') s.clock.advanced_days = 0;
      if (typeof s.clock.backup_seq !== 'number') s.clock.backup_seq = 0;
      if (!s.alertPrefs) s.alertPrefs = {};
      if (!s.digestQueue) s.digestQueue = [];
      (s.outbox || []).forEach(function (m) {
        if (!m.bucket) m.bucket = (CFG().ALERT_BUCKET && CFG().ALERT_BUCKET[m.rule]) || 'immediate';
        if (typeof m.delivered !== 'boolean') m.delivered = m.bucket === 'immediate';
        if (!m.actions) m.actions = [];
        if (!('focus_id' in m)) m.focus_id = m.project || null;
      });
      s.ui = s.ui || {};
      if (!('p6Filter' in s.ui)) s.ui.p6Filter = 'all';
      if (!('portfolioSort' in s.ui)) s.ui.portfolioSort = 'coverage';
      if (!('homeCountry' in s.ui)) s.ui.homeCountry = null;
      return prune(s);
    }
  };

  function migrate(rec) {
    var cur = CFG().SCHEMA_VERSION;
    var v = parseInt(rec.schema_version, 10);
    if (!v || v < 1) v = 1;
    if (v > cur) return null;                        /* newer than this build — refused */
    var s = rec.state;
    while (v < cur) {
      var fn = P.MIGRATIONS[v];
      if (!fn) return null;
      try { s = fn(s) || s; } catch (e) { return null; }
      v += 1;
    }
    rec.state = s;
    rec.schema_version = cur;
    return rec;
  }

  /* ----------------------------------------------------------- snapshot -- */

  P.snapshot = function () {
    var s = S();
    if (!s) return null;
    var out = {};
    DOMAIN_KEYS.forEach(function (k) { if (k in s) out[k] = s[k]; });
    out.user_id = s.user ? s.user.id : null;
    var ui = {};
    UI_KEYS.forEach(function (k) { if (s.ui && (k in s.ui)) ui[k] = s.ui[k]; });
    out.ui = ui;
    return {
      schema_version: CFG().SCHEMA_VERSION,
      app_version: CFG().APP_VERSION,
      origin_path: PATH(),
      session_id: SESSION,
      rev: baseRev,
      saved_at: stamp(),
      state: JSON.parse(JSON.stringify(out))
    };
  };

  /* replace CBP.state slices, re-alias, re-point the user, re-apply the clock */
  function applyState(snap) {
    var s = S();
    prune(snap);
    DOMAIN_KEYS.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(snap, k)) s[k] = snap[k];
    });
    /* R3 — the two aliasing traps */
    s.log = s.activity;
    if (s.planYears) {
      s.plan2027 = s.planYears['2027'] || s.plan2027 || {};
      s.planYears['2027'] = s.plan2027;
    }
    if (snap.ui) {
      Object.keys(snap.ui).forEach(function (k) {
        if (UI_KEYS.indexOf(k) > -1) s.ui[k] = snap.ui[k];
      });
    }
    /* R4 — state.user is a reference INTO state.users */
    var u = CBP.userById(snap.user_id);
    if (u) s.user = u;
    /* boards restored from an older build may still hold layout for a dropped id */
    (s.dashboards || []).forEach(function (b) {
      b.layout = b.layout || CBP.defaultLayout(b.widgets || []);
    });
    /* F22 — the clock feeds CONFIG.TODAY, always */
    if (s.clock && s.clock.today) CFG().TODAY = s.clock.today;
    return true;
  }

  /* --------------------------------------------------------------- init -- */

  P.init = function () {
    return openStore().then(function () {
      if (kind === 'memory') return 'unavailable';
      return readRecord().then(function (rec) {
        if (!rec || !rec.state) { baseRev = 0; return 'fresh'; }
        if (rec.origin_path !== PATH()) {                       /* F7 */
          baseRev = 0;
          S().ui.notice = 'Saved data from a different app folder was ignored — starting from fixtures.';
          return 'fresh';
        }
        var was = parseInt(rec.schema_version, 10) || 1;
        var m = migrate(rec);
        if (!m) {
          baseRev = 0;
          S().ui.notice = 'Saved data uses a newer schema (' + rec.schema_version +
            ') than this build (' + CFG().SCHEMA_VERSION + ') — starting from fixtures.';
          return 'fresh';
        }
        applyState(m.state);
        baseRev = parseInt(m.rev, 10) || 0;
        lastSavedAt = m.saved_at || null;
        return was < CFG().SCHEMA_VERSION ? 'migrated' : 'restored';
      });
    }).then(null, function () {
      kind = 'memory';
      note = 'Persistence unavailable in this browser — running in memory.';
      return 'unavailable';
    });
  };

  /* --------------------------------------------------------------- boot -- */

  var wrapped = false;
  function armRenderHook() {
    if (wrapped || typeof CBP.render !== 'function') return;
    var _r = CBP.render;
    CBP.render = function () { _r(); P.save(); };
    wrapped = true;
  }

  P.boot = function () {
    var res;
    try { res = P.init(); } catch (e) { res = Promise.resolve('unavailable'); }
    return res.then(function (r) {
      armRenderHook();
      P.initResult = r;        /* what THIS boot did; Admin › Data reports it */
      P.ready = kind !== 'memory';
      if (kind === 'memory' && !S().ui.notice && note) S().ui.notice = note;
      /* audit G6 — a tab that restored an existing record adopts its hash, so an
         idle second tab never bumps rev and silences the first (F37 still holds
         for real edits). A fresh store still writes its baseline on first render. */
      lastHash = (r === 'restored' || r === 'migrated') ? hashOf(P.snapshot()) : null;
      return r;
    }, function () {
      armRenderHook();
      kind = 'memory';
      P.initResult = 'unavailable';
      P.ready = false;
      return 'unavailable';
    });
  };

  P.disable = function () {
    kind = 'memory';
    P.ready = false;
    P.initResult = 'unavailable';
    note = 'Persistence disabled for this session (?nopersist).';
    if (timer) { clearTimeout(timer); timer = null; }
  };

  /* --------------------------------------------------------------- save -- */

  function hashOf(rec) {
    if (!rec) return null;
    return CBP.fnv1a(JSON.stringify(rec.state));
  }

  function flush() {
    timer = null;
    if (!P.ready) return;
    var rec = P.snapshot();
    if (!rec) return;
    var h = hashOf(rec);
    if (h === lastHash) return;                    /* nothing changed */
    readRecord().then(function (cur) {
      var curRev = cur ? (parseInt(cur.rev, 10) || 0) : 0;
      if (cur && curRev > baseRev) {               /* F37 — another tab is ahead */
        if (!stale) {
          stale = true;
          S().ui.notice = 'Another tab has newer data — this tab is no longer saving.';
          lastHash = h;
        }
        return;
      }
      stale = false;
      rec.rev = baseRev + 1;
      rec.saved_at = stamp();
      var json = JSON.stringify(rec);
      lastBytes = json.length;
      return writeRecord(JSON.parse(json)).then(function (ok) {
        if (ok) { baseRev = rec.rev; lastHash = h; lastSavedAt = rec.saved_at; }
      });
    })['catch'](function () {});
  }

  P.save = function () {
    if (!P.ready) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, CFG().SNAPSHOT_DEBOUNCE_MS || 150);
  };

  /* ------------------------------------------------------------ restore -- */

  P.restore = function (obj) {
    if (!obj || typeof obj !== 'object') {
      S().ui.notice = 'That file is not a CBP backup.';
      CBP.render();
      return Promise.resolve(false);
    }
    var rec = obj.state && obj.state.state ? obj.state : obj;   /* tolerate a wrapped record */
    if (!rec.state) {
      S().ui.notice = 'That file carries no saved state.';
      CBP.render();
      return Promise.resolve(false);
    }
    var stateJson = JSON.stringify(rec.state);

    /* T-05 — the file names its own algorithm, so a mismatched validator can
       never silently pass: fnv1a is recomputed directly, sha-256 only where
       this engine can run it. */
    var verify;
    if (!rec.checksum) verify = Promise.resolve(true);
    else if (rec.checksum_alg === 'fnv1a') verify = Promise.resolve(CBP.fnv1a(stateJson) === rec.checksum);
    else verify = csum(stateJson).then(function (c) {
      return c.alg === 'sha-256' ? c.sum === rec.checksum : true;
    }, function () { return true; });

    return verify.then(function (ok) {
      if (!ok) {
        S().ui.notice = 'Restore refused — the backup checksum does not match. The file has been changed since it was written.';
        CBP.render();
        return false;
      }
      var v = parseInt(rec.schema_version, 10) || 1;
      if (v > CFG().SCHEMA_VERSION) {
        S().ui.notice = 'Restore refused — that backup uses a newer schema (' + v +
          ') than this build (' + CFG().SCHEMA_VERSION + ').';
        CBP.render();
        return false;
      }
      var copy = { schema_version: v, state: JSON.parse(stateJson) };
      var m = migrate(copy);
      if (!m) {
        S().ui.notice = 'Restore refused — that backup could not be migrated to this build.';
        CBP.render();
        return false;
      }
      applyState(m.state);
      CBP.addLog(null, 'system', 'Restored saved data (' + (rec.saved_at || 'no stamp') +
        ', schema ' + v + ' → ' + CFG().SCHEMA_VERSION + ').');
      S().ui.notice = 'Restored saved data.';
      lastHash = null;                                  /* force the next save through */
      CBP.render();                                     /* exactly one render (F24) */
      return true;
    }, function () { return false; });
  };

  P.reset = function () {
    return wipeRecord().then(function () {
      CBP.initStore(window.CBP_DATA);
      CFG().TODAY = CBP.state.clock.today;
      baseRev = 0; lastHash = null; stale = false;
      CBP.state.ui.notice = 'Reset to the shipped fixtures.';
      CBP.render();
      return true;
    }, function () { return false; });
  };

  /* ----------------------------------------------------------- checksum -- */

  function csum(str) {
    var sub = null;
    try { sub = (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) ? crypto.subtle : null; } catch (e) { sub = null; }
    if (sub && typeof TextEncoder !== 'undefined') {
      try {
        return Promise.resolve(sub.digest('SHA-256', new TextEncoder().encode(str)))
          .then(function (buf) {
            var b = new Uint8Array(buf), h = '', i;
            for (i = 0; i < b.length; i++) h += ('0' + b[i].toString(16)).slice(-2);
            return { sum: h, alg: 'sha-256' };
          }, function () { return { sum: CBP.fnv1a(str), alg: 'fnv1a' }; });
      } catch (e) {}
    }
    return Promise.resolve({ sum: CBP.fnv1a(str), alg: 'fnv1a' });
  }

  P.checksum = function (str) { return csum(str).then(function (c) { return c.sum; }); };
  P.checksumAlg = function () { return csum('').then(function (c) { return c.alg; }); };

  /* ------------------------------------------------------------ backups -- */

  function saveAs(name, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 0);
      return true;
    } catch (e) { return false; }
  }

  P.backupNow = function (kindArg) {
    var k = kindArg === 'manual' ? 'manual' : 'scheduled';
    var s = S();
    var snap = P.snapshot();
    if (!snap) return Promise.resolve(null);
    var stateJson = JSON.stringify(snap.state);
    return csum(stateJson).then(function (c) {
      var today = s.clock.today;
      var n = k === 'manual' ? (s.clock.backup_seq = (s.clock.backup_seq || 0) + 1)
                             : (s.clock.backup_seq || 0);
      var name = k === 'manual'
        ? 'cbp-backup-' + today + '-' + n + '.json'
        : 'cbp-backup-' + today + '-scheduled.json';
      var file = {
        schema_version: CFG().SCHEMA_VERSION,
        app_version: CFG().APP_VERSION,
        saved_at: snap.saved_at,
        actor: s.user ? s.user.id : null,
        checksum: c.sum,
        checksum_alg: c.alg,
        state: snap.state
      };
      var blobText = JSON.stringify(file);
      var row = {
        id: k + '-' + today + '-' + (s.clock.advanced_days || 0) + '-' + snap.saved_at,
        name: name,
        saved_at: snap.saved_at,
        actor: file.actor,
        bytes: blobText.length,
        checksum: c.sum,
        checksum_alg: c.alg,
        kind: k,
        blob: blobText
      };
      if (k === 'manual') saveAs(name, blobText, 'application/json');
      return backupsPut(row).then(function () {
        return rotate(k).then(function () { return row; });
      });
    });
  };

  /* keep the last CONFIG.BACKUP_KEEP scheduled rows */
  function rotate(k) {
    if (k !== 'scheduled') return Promise.resolve(true);
    var keep = CFG().BACKUP_KEEP || 7;
    return backupsAll().then(function (rows) {
      var sched = rows.filter(function (r) { return r.kind === 'scheduled'; })
        .sort(function (a, b) { return a.saved_at < b.saved_at ? -1 : a.saved_at > b.saved_at ? 1 : 0; });
      var drop = sched.slice(0, Math.max(0, sched.length - keep));
      if (!drop.length) return true;
      return drop.reduce(function (chain, r) {
        return chain.then(function () { return backupsDel(r.id); });
      }, Promise.resolve(true));
    });
  }

  P.listBackups = function () {
    return backupsAll().then(function (rows) {
      rows = rows.slice().sort(function (a, b) { return a.saved_at < b.saved_at ? 1 : a.saved_at > b.saved_at ? -1 : 0; });
      /* mirror the metadata for rendering; the blob stays in the store (F23) */
      S().backups = rows.map(function (r) {
        return { id: r.id, name: r.name, saved_at: r.saved_at, actor: r.actor,
                 bytes: r.bytes, checksum: r.checksum, checksum_alg: r.checksum_alg, kind: r.kind };
      });
      return rows;
    }, function () { return []; });
  };

  function backupById(id) {
    return backupsAll().then(function (rows) {
      return rows.filter(function (r) { return r.id === id; })[0] || null;
    });
  }

  P.download = function (id) {
    return backupById(id).then(function (r) {
      if (!r) return false;
      return saveAs(r.name, r.blob, 'application/json');
    });
  };

  P.restoreBackup = function (id) {
    return backupById(id).then(function (r) {
      if (!r) return false;
      var obj;
      try { obj = JSON.parse(r.blob); } catch (e) { return false; }
      return P.restore(obj);
    });
  };

  /* ---------------------------------------------------------------- CSV -- */

  function q(v) {
    if (v === null || v === undefined) v = '';
    if (typeof v === 'object') v = JSON.stringify(v);
    v = String(v);
    return /["\n\r,]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function csv(head, rows) {
    return [head.map(q).join(',')]
      .concat(rows.map(function (r) { return r.map(q).join(','); }))
      .join('\r\n') + '\r\n';
  }

  var CSV_KINDS = {
    projects: function (s) {
      return csv(['id', 'name', 'country', 'status', 'amount', 'owner', 'backup',
                  'primary_implementer', 'strategic_priority', 'target_date',
                  'submitted_at', 'approved_at', 'implementation_date', 'declined_at',
                  'primary_contract_id'],
        s.projects.map(function (p) {
          return [p.id, p.name, p.country, p.status, p.amount, p.owner, p.backup,
                  p.primary_implementer, p.strategic_priority, p.target_date,
                  p.submitted_at, p.approved_at, p.implementation_date, p.declined_at,
                  p.primary_contract_id];
        }));
    },
    contracts: function (s) {
      return csv(['id', 'project_id', 'partner', 'partner_type', 'country', 'amount',
                  'currency', 'amount_usd', 'status', 'template_id', 'version_no',
                  'sent_at', 'executed_at', 'parent_contract_id', 'amendment_no'],
        s.contracts.map(function (c) {
          return [c.id, c.project_id, c.partner, c.partner_type, c.country, c.amount,
                  c.currency, c.amount_usd, c.status, c.template_id, c.version_no,
                  c.sent_at, c.executed_at, c.parent_contract_id, c.amendment_no];
        }));
    },
    gate_events: function (s) {
      return csv(['id', 'project_id', 'system', 'step', 'at', 'actor', 'source',
                  'confidence', 'ref', 'note'],
        s.gateEvents.map(function (g) {
          return [g.id, g.project_id, g.system, g.step, g.at, g.actor, g.source,
                  g.confidence, g.ref, g.note];
        }));
    },
    activity: function (s) {
      return csv(['id', 'project', 'type', 'author', 'at', 'assigned_to', 'resolved_at', 'body'],
        s.activity.map(function (a) {
          return [a.id, a.project || a.project_id, a.type, a.author, a.at,
                  a.assigned_to, a.resolved_at, a.body];
        }));
    },
    outbox: function (s) {
      return csv(['rule', 'bucket', 'delivered', 'to', 'to_ids', 'at', 'project', 'focus_id', 'subject', 'body'],
        s.outbox.map(function (m) {
          return [m.rule, m.bucket, m.delivered, (m.to || []).join('; '), (m.to_ids || []).join('; '),
                  m.at, m.project, m.focus_id, m.subject, m.body];
        }));
    }
  };

  P.exportCsv = function (k) {
    var s = S();
    var fn = CSV_KINDS[k];
    if (!fn) return '';
    var text = fn(s);
    saveAs('cbp-' + k + '-' + s.clock.today + '.csv', text, 'text/csv');
    return text;
  };

  /* -------------------------------------------------------------- status - */

  P.storageKind = function () { return kind; };

  P.status = function () {
    return {
      kind: kind,
      ready: P.ready,
      key: KEY(),
      rev: baseRev,
      saved_at: lastSavedAt,
      bytes: lastBytes,
      session_id: SESSION,
      stale: stale,
      note: note
    };
  };
})();
