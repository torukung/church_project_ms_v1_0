/* derive.js — PURE functions only. No DOM, no state mutation, no globals besides CBP.D.
   Every number shown in the UI comes from here; nothing is stored pre-computed. */
(function () {
  'use strict';
  var D = {};
  CBP.D = D;

  /* ------------------------------------------------------------ dates --- */

  D.parse = function (iso) {
    if (!iso) return null;
    var p = String(iso).split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  };

  D.today = function () { return D.parse(CBP.CONFIG.TODAY); };

  /* whole days from a to b (b - a). Same convention everywhere: a plain
     calendar difference, so 30 Jan → 28 Aug 2026 = 210 d. */
  D.daysBetween = function (a, b) {
    var A = (a instanceof Date) ? a : D.parse(a);
    var B = (b instanceof Date) ? b : D.parse(b);
    if (!A || !B) return null;
    return Math.round((B - A) / 86400000);
  };

  /* days elapsed from an ISO date up to CONFIG.TODAY */
  D.daysSince = function (iso) {
    if (!iso) return null;
    return D.daysBetween(D.parse(iso), D.today());
  };

  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  D.fmtDate = function (iso) {
    var d = D.parse(iso);
    if (!d) return '—';
    return d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
  };

  D.fmtDateY = function (iso) {
    var d = D.parse(iso);
    if (!d) return '—';
    return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2);
  };

  D.monthName = function (date) { return MON[date.getUTCMonth()]; };

  D.addDays = function (date, n) {
    return new Date(date.getTime() + n * 86400000);
  };

  /* --------------------------------------------------------- numbers ---- */

  D.money = function (n) {
    if (n === null || n === undefined) return '—';
    var s = Math.abs(Math.round(n)).toLocaleString('en-US');
    return (n < 0 ? '−$' : '$') + s;
  };

  D.pct = function (n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Math.round(n) + '%';
  };

  D.days = function (n) {
    if (n === null || n === undefined) return '—';
    return n + ' d';
  };

  /* ------------------------------------------------------ money rollups -- */

  /* committed per country = sum(amount) across every status. Derived here so
     Bangladesh reads 1,310,801 only because the fixtures say so. */
  D.committedByCountry = function (projects) {
    var out = {};
    projects.forEach(function (p) {
      if (p.status === 'declined') return;         /* declined is not committed */
      out[p.country] = (out[p.country] || 0) + (p.amount || 0);
    });
    return out;
  };

  D.committedTotal = function (projects) {
    return projects.reduce(function (a, p) {
      return a + (p.status === 'declined' ? 0 : (p.amount || 0));
    }, 0);
  };

  D.coverage = function (committed, ceiling) {
    if (!ceiling) return null;
    return committed / ceiling * 100;
  };

  D.coverageClass = function (cov) {
    if (cov === null) return '';
    if (cov > 100) return 'over';
    if (cov >= CBP.CONFIG.COVERAGE_WARN) return 'warn';
    return '';
  };

  /* Queue depth = everything not yet in implementation (statuses 4, 3 and 2).
     Audit ruling 28 Aug: the P2 "Queue" column reads the whole pipeline, not the
     status-3 slice — which is why Lao PDR shows 1 project and never an em dash. */
  D.queueCount = function (projects) {
    return projects.filter(function (p) {
      return p.status === 4 || p.status === 3 || p.status === 2;
    }).length;
  };

  /* one row per country in scope, with derived committed / coverage */
  D.countryRollup = function (projects, countries, codes) {
    return countries
      .filter(function (c) { return !codes || codes.indexOf(c.code) > -1; })
      .map(function (c) {
        var mine = projects.filter(function (p) { return p.country === c.code; });
        var committed = D.committedTotal(mine);
        var cov = D.coverage(committed, c.ceiling);
        return {
          code: c.code, name: c.name, ceiling: c.ceiling,
          projects: mine, count: mine.length,
          committed: committed, coverage: cov,
          over: committed > c.ceiling ? committed - c.ceiling : 0,
          headroom: c.ceiling - committed,
          queue: D.queueCount(mine),
          oldest: D.oldestWaiting(mine)
        };
      });
  };

  /* ---------------------------------------------------------- clocks ----- */

  /* D-in-Q: how long the record has been in the queue overall */
  D.dInQ = function (p) {
    var from = p.d_in_q_start || p.submitted_at || p.approved_at || p.implementation_date;
    return from ? D.daysSince(from) : null;
  };

  /* the date the project entered its current status */
  D.stageStart = function (p) {
    if (p.status === 1) return p.implementation_date || p.approved_at || null;
    if (p.status === 2) return p.approved_at || null;
    if (p.status === 3) return p.submitted_at || null;
    if (p.status === 'declined') return p.declined_at || null;
    return p.created_at || null;   /* status 4 has no seeded entry date */
  };

  D.daysInStage = function (p) {
    var s = D.stageStart(p);
    return s ? D.daysSince(s) : null;
  };

  D.oldestWaiting = function (projects) {
    var vals = projects.map(function (p) {
      return p.status === 3 || p.status === 2 ? (D.dInQ(p) || D.daysInStage(p)) : null;
    }).filter(function (v) { return v !== null; });
    return vals.length ? Math.max.apply(null, vals) : null;
  };

  D.pastTarget = function (p) {
    if (!p.target_date || p.status === 1 || p.status === 'declined') return null;
    var n = D.daysSince(p.target_date);
    return n > 0 ? n : null;
  };

  /* --------------------------------------------------- external gate ----- */

  /* per-system sub-counter (D-11): submitted → approved, or submitted → today */
  D.gateSystem = function (p, key) {
    var g = (p.gate || {})[key] || {};
    var label = key === 'chas' ? 'CHaS' : 'Decision Point';
    var ref = (p.refs || {})[key] || null;

    if (g.approved_at) {
      return { key: key, label: label, state: 'approved', ref: ref,
               submitted_at: g.submitted_at || null, approved_at: g.approved_at,
               days: g.submitted_at ? D.daysBetween(g.submitted_at, g.approved_at) : null,
               remark: g.remark || null, open: false };
    }
    if (g.submitted_at) {
      var waited = D.daysSince(g.submitted_at);
      return { key: key, label: label, state: 'waiting', ref: ref,
               submitted_at: g.submitted_at, approved_at: null,
               days: waited, remark: g.remark || null, open: true,
               overdue: waited > CBP.CONFIG.GATE_THRESHOLD_DAYS };
    }
    /* no gate record: statuses 2 and 1 cleared it before the demo window —
       the reference numbers are the evidence. */
    if (p.status === 2 || p.status === 1) {
      return { key: key, label: label, state: 'approved', ref: ref,
               submitted_at: null, approved_at: p.approved_at || null,
               days: null, remark: null, open: false, inferred: true };
    }
    return { key: key, label: label, state: 'todo', ref: ref,
             submitted_at: null, approved_at: null, days: null, remark: null, open: false };
  };

  D.gate = function (p) {
    return CBP.CONFIG.GATE_SYSTEMS.map(function (s) { return D.gateSystem(p, s.key); });
  };

  D.gateStarted = function (p) {
    return D.gate(p).some(function (g) { return g.state !== 'todo'; });
  };

  D.openGates = function (p) {
    return D.gate(p).filter(function (g) { return g.open; });
  };

  /* the single worst open gate across a set — drives the P2 KPI and P3 sub-line */
  D.worstOpenGate = function (projects) {
    var worst = null;
    projects.forEach(function (p) {
      D.openGates(p).forEach(function (g) {
        if (!worst || g.days > worst.days) worst = { project: p, gate: g, days: g.days };
      });
    });
    return worst;
  };

  /* --------------------------------------------------- stage sub-line ---- */

  /* the live line under the status pill in the P3 register */
  D.stageSubLine = function (p) {
    var late = D.pastTarget(p);

    if (p.status === 'declined') {
      return { text: 'declined' + (p.declined_at ? ' ' + D.fmtDate(p.declined_at) : ''), tone: 'hot' };
    }

    if (p.status === 4) {
      if (p.target_date) {
        var t = D.daysSince(p.target_date);
        if (t > 0) return { text: 'in development · target passed ' + D.days(t), tone: 'warm' };
        return { text: 'in development · target ' + D.fmtDate(p.target_date) +
                       ' (' + D.days(-t) + ')', tone: '' };
      }
      return { text: 'in development · not submitted', tone: '' };
    }

    if (p.status === 3) {
      var open = D.openGates(p);
      if (open.length) {
        var g = open.sort(function (a, b) { return b.days - a.days; })[0];
        return { text: 'gate · ' + g.label + ' waiting ' + D.days(g.days),
                 tone: g.overdue ? 'hot' : 'warm' };
      }
      if (D.gateStarted(p)) {
        return { text: 'gate cleared · ready to mark approved', tone: 'warm' };
      }
      var w = D.daysInStage(p);
      var txt = 'M1 review · ' + D.days(w);
      if (late) txt += ' · target passed ' + D.days(late);
      return { text: txt,
               tone: late ? 'warm' : (w > CBP.CONFIG.REVIEW_THRESHOLD_DAYS ? 'warm' : '') };
    }

    if (p.status === 2) {
      var k = D.daysInStage(p);
      return { text: 'awaiting kickoff · ' + D.days(k),
               tone: k > CBP.CONFIG.KICKOFF_THRESHOLD_DAYS ? 'warm' : '' };
    }

    if (p.status === 1) {
      var s = D.daysInStage(p);
      var pr = D.progress(p);
      /* the progress column already carries the no-timeline case — don't say it twice */
      var tail = pr.mode === 'bar' ? ' · ' + D.pct(pr.pct) + ' complete' : '';
      return { text: 'in stage ' + D.days(s) + tail, tone: '' };
    }

    return { text: '', tone: '' };
  };

  /* --------------------------------------------------- C-17 progress ----- */

  /* Implementation phases only. A project only has progress once it is IN
     implementation (status 1) — every earlier status renders an italic,
     non-numeric line, never a 0% bar. */
  D.progress = function (p) {
    if (p.status === 'declined') return { mode: 'none', label: '—' };
    if (p.status === 4) return { mode: 'na', label: 'not submitted' };
    if (p.status === 3) return { mode: 'na', label: 'starts after approval' };
    if (p.status === 2) return { mode: 'na', label: 'starts at kickoff' };

    var ph = D.phases(p);
    if (!ph.length) return { mode: 'na', label: 'timeline not entered' };

    var start = D.parse(ph[0].start);
    var end = D.parse(ph[ph.length - 1].end);
    var total = D.daysBetween(start, end);
    var done = D.daysBetween(start, D.today());
    var pct = total > 0 ? Math.max(0, Math.min(100, done / total * 100)) : 0;
    return { mode: 'bar', pct: pct, tone: pct >= 50 ? '' : 'mid', label: D.pct(pct) };
  };

  D.phases = function (p) {
    var ph = (p.phases || []).slice();
    ph.sort(function (a, b) { return D.parse(a.start) - D.parse(b.start); });
    return ph;
  };

  /* per-phase completion, weighted by elapsed time inside the phase */
  D.phaseProgress = function (phase) {
    var s = D.parse(phase.start), e = D.parse(phase.end), t = D.today();
    if (t <= s) return 0;
    if (t >= e) return 100;
    var span = D.daysBetween(s, e);
    return span > 0 ? D.daysBetween(s, t) / span * 100 : 0;
  };

  /* ------------------------------------------------- C-06 gantt model ---- */

  /* 16-cell track, 4 month-group headers — the geometry of the confirmed sample */
  D.ganttModel = function (p) {
    var ph = D.phases(p);
    if (!ph.length) return null;

    var start = D.parse(ph[0].start);
    var end = ph.reduce(function (m, x) {
      var e = D.parse(x.end); return e > m ? e : m;
    }, D.parse(ph[0].end));

    var span = Math.max(1, D.daysBetween(start, end));
    var CELLS = 16;
    var cell = span / CELLS;
    var planned = (p.status !== 1);

    var bars = ph.map(function (x, i) {
      var s = D.parse(x.start), e = D.parse(x.end);
      var from = Math.max(0, Math.floor(D.daysBetween(start, s) / cell));
      var to = Math.min(CELLS, Math.max(from + 1, Math.ceil(D.daysBetween(start, e) / cell)));
      var done = planned ? 0 : D.phaseProgress(x);
      return {
        /* D-14: a phase may name its own lead; otherwise the project owner
           carries it, and the Gantt still shows a name. */
        label: x.phase, owner: x.owner || p.owner || null,
        col: from + 1, span: to - from,
        start: x.start, end: x.end,
        pct: done, planned: planned || done === 0,
        variant: i % 2 === 1 ? 'v2' : ''
      };
    });

    /* Four month-group headers, each covering 4 cells. A group boundary rarely
       lands exactly on the 1st, so label each group from its interior (an
       eighth in from either edge) — otherwise a one-day spill makes a group
       claim a month it barely touches. */
    var heads = [];
    var groupLen = (span + 1) / 4;
    for (var i = 0; i < 4; i++) {
      var a = D.addDays(start, (i * groupLen) + groupLen / 8);
      var b = D.addDays(start, ((i + 1) * groupLen) - groupLen / 8);
      var la = D.monthName(a), lb = D.monthName(b);
      var yr = b.getUTCFullYear() !== start.getUTCFullYear()
        ? ' ’' + String(b.getUTCFullYear()).slice(2) : '';
      heads.push(la === lb ? la + yr : la + '–' + lb + yr);
    }

    var t = D.today();
    var todayUnit = null;
    if (t >= start && t <= end) todayUnit = D.daysBetween(start, t) / cell;

    return {
      cells: CELLS, start: start, end: end, bars: bars, heads: heads,
      todayUnit: todayUnit, todayLabel: 'today · ' + D.fmtDateY(CBP.CONFIG.TODAY),
      planned: planned
    };
  };

  /* -------------------------------------------------------- rollups ------ */

  D.statusRollups = function (projects) {
    var out = { 1: 0, 2: 0, 3: 0, 4: 0, declined: 0, all: projects.length };
    projects.forEach(function (p) { out[p.status] = (out[p.status] || 0) + 1; });
    return out;
  };

  D.amountByStatus = function (projects) {
    var out = { 1: 0, 2: 0, 3: 0, 4: 0, declined: 0 };
    projects.forEach(function (p) { out[p.status] += (p.amount || 0); });
    return out;
  };

  /* items sitting on an M1 desk: status-3 review, open gate, or ready to mark */
  D.awaitingM1 = function (projects) {
    return projects.filter(function (p) { return p.status === 3; });
  };

  /* The approvals badge counts what THIS user can actually act on, not every
     status-3 record in scope (architect ruling). Projects must already be
     scoped to the user before being passed in. */
  D.actionableFor = function (user, projects) {
    if (!user) return [];
    var owns = function (p) { return p.owner === user.id || p.backup === user.id; };

    if (user.role === 'm1') {
      return projects.filter(function (p) {
        if (p.status !== 3) return false;
        if (!D.gateStarted(p)) return true;            /* awaiting my review */
        if (D.openGates(p).length) return true;        /* my open gate items */
        return true;                                   /* ready to mark approved */
      });
    }
    if (user.role === 'm2') {
      return projects.filter(function (p) { return p.status === 4 && owns(p); });
    }
    /* M3, viewer and admin hold no approval queue of their own */
    return [];
  };

  D.badgeCount = function (user, projects) {
    return D.actionableFor(user, projects).length;
  };

  /* RD-1 country league table */
  D.leagueTable = function (projects, countries, codes) {
    return D.countryRollup(projects, countries, codes).map(function (r) {
      var reviews = r.projects.filter(function (p) { return p.status === 3 && !D.gateStarted(p); });
      var gates = [];
      r.projects.forEach(function (p) {
        D.gate(p).forEach(function (g) { if (g.days !== null) gates.push(g.days); });
      });
      var avg = function (a) {
        return a.length ? Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length) : null;
      };
      r.avgReviewDays = avg(reviews.map(function (p) { return D.daysInStage(p); }));
      r.avgGateDays = avg(gates);
      r.delayed = r.projects.filter(function (p) {
        return D.pastTarget(p) || D.openGates(p).some(function (g) { return g.overdue; });
      }).length;
      r.unassigned = r.projects.filter(function (p) { return !p.owner; }).length;
      return r;
    }).sort(function (a, b) { return (b.coverage || 0) - (a.coverage || 0); });
  };

  /* ------------------------------------------------- scope + permissions -- */

  D.visibleCountries = function (user, countries) {
    var all = countries.map(function (c) { return c.code; });
    if (!user) return [];
    var scope = user.role === 'viewer' ? user.view_scope : user.country_scope;
    if (scope === 'all' || !scope) return all;
    return all.filter(function (c) { return scope.indexOf(c) > -1; });
  };

  D.visibleProjects = function (user, projects, countries) {
    var codes = D.visibleCountries(user, countries);
    return projects.filter(function (p) { return codes.indexOf(p.country) > -1; });
  };

  /* Permission matrix from docs/01. Returns a boolean for every action the UI
     can offer; the persona switcher shows/hides controls purely through this. */
  var MATRIX = {
    /* action            admin  m1     m2     m3     viewer */
    create:            { admin: 1, m1: 1, m2: 1, m3: 1, viewer: 0 },
    edit:              { admin: 1, m1: 1, m2: 1, m3: 1, viewer: 0 },
    'delete':          { admin: 1, m1: 0, m2: 0, m3: 0, viewer: 0 },
    editBudget:        { admin: 1, m1: 1, m2: 1, m3: 1, viewer: 0 },
    submit:            { admin: 0, m1: 1, m2: 1, m3: 0, viewer: 0 },
    review:            { admin: 0, m1: 1, m2: 0, m3: 0, viewer: 0 },
    gate:              { admin: 0, m1: 1, m2: 0, m3: 0, viewer: 0 },
    markApproved:      { admin: 0, m1: 1, m2: 0, m3: 0, viewer: 0 },
    editGantt:         { admin: 1, m1: 1, m2: 1, m3: 1, viewer: 0 },
    post:              { admin: 1, m1: 1, m2: 1, m3: 1, viewer: 0 },
    /* v1.0.1 — comments for every persona except the viewer (ToR 29 Aug),
       gate date editing for M1 and Admin, 2027 planning for M1/M2/Admin. */
    comment:           { admin: 1, m1: 1, m2: 1, m3: 1, viewer: 0 },
    gate_edit:         { admin: 1, m1: 1, m2: 0, m3: 0, viewer: 0 },
    plan:              { admin: 1, m1: 1, m2: 1, m3: 0, viewer: 0 },
    pinDecision:       { admin: 1, m1: 1, m2: 1, m3: 0, viewer: 0 },
    setCeiling:        { admin: 1, m1: 1, m2: 0, m3: 0, viewer: 0 },
    manageUsers:       { admin: 1, m1: 0, m2: 0, m3: 0, viewer: 0 },
    'export':          { admin: 1, m1: 1, m2: 1, m3: 0, viewer: 1 },
    watch:             { admin: 1, m1: 1, m2: 1, m3: 1, viewer: 1 },
    viewGantt:         { admin: 1, m1: 1, m2: 1, m3: 1, viewer: 1 }
  };

  D.can = function (user, action, project) {
    if (!user) return false;
    var row = MATRIX[action];
    if (!row) return false;
    if (!row[user.role]) return false;
    if (user.read_only && action !== 'export' && action !== 'watch' && action !== 'viewGantt') {
      return false;
    }
    if (!project) return true;

    /* project-level narrowing */
    var owns = project.owner === user.id || project.backup === user.id;

    if (user.role === 'm3') {
      if (action === 'edit' || action === 'editBudget' || action === 'editGantt') {
        return owns && project.status === 4;
      }
    }
    if (user.role === 'm2' && action === 'editGantt') return owns;
    if (action === 'submit') return project.status === 4;
    if (action === 'review') return project.status === 3 && !D.gateStarted(project);
    if (action === 'gate') return project.status === 3 && D.gateStarted(project);
    if (action === 'markApproved') {
      return project.status === 3 && D.gateStarted(project) && D.openGates(project).length === 0;
    }
    if (action === 'editGantt') return project.status !== 'declined';
    return true;
  };

  /* does this user have ANY action control on this page at all? */
  D.hasAnyAction = function (user) {
    return ['create','edit','submit','review','gate','markApproved','editGantt']
      .some(function (a) { return D.can(user, a); });
  };

  /* ================================================ v1.0.1 · comments ======
     Comments are conversation and live in state.comments; the activity stream
     stays the audit trail. Read state is state.readBy — a per-user mark, never
     a flag on the comment itself, so two personas can disagree about what is
     new without the seed data changing. */

  function S() { return CBP.state; }

  /* every comment on one project, oldest first (the flat feed order) */
  D.commentsFor = function (pid) {
    if (!S() || !S().comments) return [];
    return S().comments.filter(function (c) {
      return c.project_id === pid;
    }).sort(D.commentOrder);
  };

  /* chronological: date, then the deterministic clock string, then id */
  D.commentOrder = function (a, b) {
    if (a.at !== b.at) return a.at < b.at ? -1 : 1;
    if ((a.time || '') !== (b.time || '')) return (a.time || '') < (b.time || '') ? -1 : 1;
    return D.commentSeqOf(a) - D.commentSeqOf(b);
  };

  D.commentSeqOf = function (c) {
    var m = /(\d+)$/.exec(c.id || '');
    return m ? parseInt(m[1], 10) : 0;
  };

  /* country scope, resolved through the comment's project — a comment on a
     project outside your scope does not exist for you, badge included */
  D.commentsVisible = function (user) {
    if (!S() || !S().comments || !user) return [];
    var codes = D.visibleCountries(user, S().countries);
    return S().comments.filter(function (c) {
      var p = CBP.projectById(c.project_id);
      return !!p && codes.indexOf(p.country) > -1;
    }).sort(D.commentOrder);
  };

  /* your own words are never unread */
  D.isUnread = function (user, c) {
    if (!user || !c) return false;
    if (c.author === user.id) return false;
    var marks = (S().readBy || {})[c.id];
    return !(marks && marks[user.id]);
  };

  /* THE single unread number: sidebar balloon, P4 alert strip and the hub all
     read this one function, so they can never disagree. */
  D.unreadCount = function (user) {
    if (!user) return 0;
    return D.commentsVisible(user).filter(function (c) {
      return D.isUnread(user, c);
    }).length;
  };

  D.unreadFor = function (user, pid) {
    return D.commentsFor(pid).filter(function (c) { return D.isUnread(user, c); }).length;
  };

  /* ============================================ v1.0.1 · budget history ====
     2024 and 2025 are fixture history (data.js). 2026 is never stored — it is
     summed from the live projects, so an edit in the demo moves it.

     v1.0.3 — a history year's committed amount is now CONFIGURABLE: the store
     seeds state.histEdit = { code: { year: committed } } from the fixture at
     init and every read below prefers it, so the fixture stays the seed and
     never the live number. Years added by the user (2023, 2022 …) exist only in
     state.histEdit. The per-year ceiling is fixed demo furniture — the fixture
     carries 1,000,000 for every seeded year and an added year takes the same. */

  D.HIST_CEILING = 1000000;

  function histRow(code) {
    var rows = (window.CBP_DATA && CBP_DATA.budget_history) || [];
    return rows.filter(function (r) { return r.code === code; })[0] || null;
  }

  function histFixture(code, year) {
    var row = histRow(code);
    return row ? ((row.years || {})[String(year)] || null) : null;
  }

  /* the ceiling a history year is measured against — fixture first, then the
     standing 1,000,000 an added year inherits */
  D.histCeiling = function (code, year) {
    var f = histFixture(code, year);
    return (f && f.ceiling) ? f.ceiling : D.HIST_CEILING;
  };

  /* state-backed: the committed figure comes from state.histEdit when it is
     there, the fixture otherwise. Shape is unchanged — { ceiling, committed,
     spent_q } — so widgets.js and anything else reading D.history(code, 2024)
     keeps working. D.history(code) with no year still returns the fixture row
     (that is where plan_2027 lives). */
  D.history = function (code, year) {
    if (year === undefined || year === null) return histRow(code);
    var f = histFixture(code, year);
    var st = S();
    var ed = (st && st.histEdit && st.histEdit[code])
      ? st.histEdit[code][String(year)] : undefined;
    if (ed === undefined || ed === null) return f;
    return {
      ceiling: D.histCeiling(code, year),
      committed: ed,
      spent_q: f ? f.spent_q : []
    };
  };

  /* every stored history year, ascending — fixture years plus anything the
     Forecasting tab has added */
  D.historyYears = function () {
    var rows = (window.CBP_DATA && CBP_DATA.budget_history) || [];
    var seen = {}, out = [];
    function take(y) { if (!seen[y]) { seen[y] = 1; out.push(String(y)); } }
    rows.forEach(function (r) { Object.keys(r.years || {}).forEach(take); });
    var st = S();
    if (st && st.histEdit) {
      Object.keys(st.histEdit).forEach(function (c) {
        Object.keys(st.histEdit[c] || {}).forEach(take);
      });
    }
    return out.sort(function (a, b) { return (+a) - (+b); });
  };

  /* the years that carry an ACTUAL figure: every history year plus the live
     budget year, ascending. The projection is the year after the last of them. */
  D.actualYears = function () {
    var out = D.historyYears().map(Number);
    var live = +CBP.CONFIG.BUDGET_YEAR;
    if (out.indexOf(live) === -1) out.push(live);
    return out.sort(function (a, b) { return a - b; });
  };

  /* the committed amount for one country in one actual year: the live sum for
     the budget year, the configured/fixture figure for anything earlier */
  D.actualCommitted = function (code, year, projects) {
    if (+year === +CBP.CONFIG.BUDGET_YEAR) {
      var st = S();
      var pool = projects || (st ? st.projects : []);
      return D.committedTotal(pool.filter(function (p) { return p.country === code; }));
    }
    var h = D.history(code, year);
    return h ? h.committed : null;
  };

  D.actualCeiling = function (code, year, countries) {
    if (+year === +CBP.CONFIG.BUDGET_YEAR) {
      var st = S();
      var list = countries || (st ? st.countries : []);
      var c = list.filter(function (x) { return x.code === code; })[0];
      return c ? c.ceiling : null;
    }
    return D.histCeiling(code, year);
  };

  /* 2024–2027 are the demo's fixed columns; anything else was added and can be
     removed again */
  D.FIXED_YEARS = [2024, 2025, 2026, 2027];

  D.isFixedYear = function (year) { return D.FIXED_YEARS.indexOf(+year) > -1; };

  /* spent across the four quarters of a stored year */
  D.spentTotal = function (code, year) {
    var y = D.history(code, year);
    if (!y) return null;
    return (y.spent_q || []).reduce(function (a, b) { return a + b; }, 0);
  };

  /* utilisation = committed against the ceiling, as a percentage. Same shape
     as D.coverage; named for the P7 tab that reads it. */
  D.utilisation = function (committed, ceiling) {
    if (!ceiling) return null;
    return committed / ceiling * 100;
  };

  /* ------------------------------------------------------- plan years ---- */
  /* v1.0.3 — the plan is no longer a single 2027 map. state.planYears keys a
     { code: amount } map by year, and state.plan2027 IS state.planYears[2027]
     (the same object, not a copy), so every v1.0.1 caller — D.plan2027,
     A.planSet(code, value), the yearcompare widget — keeps reading and writing
     exactly what it did. */

  D.PLAN_BASE_YEAR = 2027;

  D.planYears = function () {
    var st = S();
    var out = [];
    if (st && st.planYears) {
      Object.keys(st.planYears).forEach(function (y) { out.push(+y); });
    }
    if (out.indexOf(D.PLAN_BASE_YEAR) === -1) out.push(D.PLAN_BASE_YEAR);
    return out.sort(function (a, b) { return a - b; });
  };

  D.planMap = function (year) {
    var st = S();
    if (!st) return null;
    if (st.planYears && st.planYears[String(year)]) return st.planYears[String(year)];
    if (+year === D.PLAN_BASE_YEAR && st.plan2027) return st.plan2027;
    return null;
  };

  D.planFor = function (code, year) {
    year = (year === undefined || year === null) ? D.PLAN_BASE_YEAR : +year;
    var map = D.planMap(year);
    if (map && map[code] !== undefined && map[code] !== null) return map[code];
    if (year === D.PLAN_BASE_YEAR) {
      var row = histRow(code);
      return row ? row.plan_2027 : null;
    }
    return null;
  };

  /* kept verbatim for every v1.0.1 caller (widgets.js, p7.js, actions.js) */
  D.plan2027 = function (code) { return D.planFor(code, D.PLAN_BASE_YEAR); };

  /* One row per seeded country. The three v1.0.1 percentages and the 2027 plan
     stay on the row under their old names — widgets.js reads them — and the
     v1.0.3 generalisation rides alongside as `years` (every actual year) and
     `plans` (every plan year). 2026 comes from the live project set, so it
     moves with the demo; the earlier years come from state.histEdit. */
  D.forecastRows = function (projects, countries) {
    var st = S();
    projects = projects || (st ? st.projects : []);
    countries = countries || (st ? st.countries : []);

    var actual = D.actualYears();
    var plans = D.planYears();
    var live = +CBP.CONFIG.BUDGET_YEAR;

    return countries.map(function (c) {
      var years = actual.map(function (y) {
        var committed = D.actualCommitted(c.code, y, projects);
        var ceiling = D.actualCeiling(c.code, y, countries);
        return {
          year: y,
          committed: committed,
          ceiling: ceiling,
          pct: (committed === null || committed === undefined)
            ? null : D.utilisation(committed, ceiling),
          live: y === live,
          added: !D.isFixedYear(y)
        };
      });

      var pcts = years.map(function (x) { return x.pct; });
      var proj = D.trendNext(pcts);
      var projYear = actual[actual.length - 1] + 1;

      var planRows = plans.map(function (y) {
        var v = D.planFor(c.code, y);
        return {
          year: y, value: v,
          pct: (v === null || v === undefined) ? null : D.utilisation(v, c.ceiling),
          added: !D.isFixedYear(y)
        };
      });

      function pctOf(y) {
        var hit = years.filter(function (x) { return x.year === y; })[0];
        return hit ? hit.pct : null;
      }

      var firstPlan = planRows[0] || { pct: null };
      var committed26 = D.actualCommitted(c.code, live, projects);

      return {
        code: c.code, name: c.name, ceiling: c.ceiling,
        committed2026: committed26,
        years: years, plans: planRows,
        projYear: projYear,
        /* v1.0.1 names — unchanged contract for widgets.js and P7 */
        y2024pct: pctOf(2024), y2025pct: pctOf(2025), y2026pct: pctOf(live),
        plan2027: D.planFor(c.code, D.PLAN_BASE_YEAR),
        plan2027pct: D.utilisation(D.planFor(c.code, D.PLAN_BASE_YEAR), c.ceiling),
        proj2027pct: proj,
        proj2027: proj === null ? null : Math.round(proj / 100 * c.ceiling),
        note: forecastNote(pcts, pctOf(live), firstPlan.pct)
      };
    });
  };

  /* v1.0.2 → v1.0.3 — the simulated projection: a least-squares line through
     EVERY actual utilisation point we hold, in year order, extended one step
     past the last of them. `vals` is that ordered list; nulls are the years a
     country carries no figure for and simply drop out of the fit. Pure — no
     seeded number anywhere — so an edited history year or an edited project
     re-simulates it. Clamped at 0. */
  D.trendNext = function (vals) {
    var pts = [];
    (vals || []).forEach(function (v, i) {
      if (v !== null && v !== undefined && isFinite(v)) pts.push([i, v]);
    });
    var next = (vals || []).length;
    if (pts.length < 2) return pts.length === 1 ? Math.round(pts[0][1]) : null;
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; });
    var den = (n * sxx - sx * sx);
    if (!den) return Math.round(sy / n);
    var slope = (n * sxy - sx * sy) / den;
    var icept = (sy - slope * sx) / n;
    return Math.max(0, Math.round(icept + slope * next));
  };

  /* v1.0.1 signature kept so nothing that calls the three-argument form breaks */
  D.trend2027 = function (y24, y25, y26) { return D.trendNext([y24, y25, y26]); };

  /* A seeded amount for a year the user has just added — the same least-squares
     line, fitted to the committed AMOUNTS of every actual year and read off at
     the new year (so it back-casts as happily as it forecasts). Rounded to the
     nearest $5,000 and clamped at zero, because a seeded figure is a starting
     point to type over, not a derived number pretending to be data. */
  D.SEED_ROUND = 5000;

  D.trendAmount = function (code, year, projects, countries) {
    var actual = D.actualYears();
    var xs = [], ys = [];
    actual.forEach(function (y) {
      var v = D.actualCommitted(code, y, projects);
      if (v !== null && v !== undefined && isFinite(v)) { xs.push(y); ys.push(v); }
    });
    if (!xs.length) return 0;
    var out;
    if (xs.length === 1) {
      out = ys[0];
    } else {
      var n = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (var i = 0; i < n; i++) {
        sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i];
      }
      var den = (n * sxx - sx * sx);
      out = den ? (((sy - ((n * sxy - sx * sy) / den) * sx) / n) +
                   ((n * sxy - sx * sy) / den) * (+year)) : (sy / n);
    }
    if (!isFinite(out) || out < 0) out = 0;
    return Math.max(0, Math.round(out / D.SEED_ROUND) * D.SEED_ROUND);
  };

  /* the variance sentence beside each forecast row — derived, never seeded.
     Keyed to the live budget year against the FIRST plan year, exactly as in
     v1.0.1; the "years running" counters now span every actual year held. */
  function forecastNote(pcts, live, planPct) {
    if (live === null || live === undefined) return '';
    var held = (pcts || []).filter(function (v) { return v !== null && v !== undefined; });
    var overYears = held.filter(function (v) { return v > 100; }).length;
    if (overYears >= 2) return 'Over ceiling for ' + overYears + ' years running — plan needs a decision';
    if (live > 100) return 'First year over ceiling';
    var low = held.filter(function (v) { return v < 40; }).length;
    if (low >= 2) return 'Persistently under-using the allocation';
    if (planPct !== null && planPct !== undefined && held.length > 1) {
      var lift = Math.round(planPct - live);
      if (lift > 0) return 'Plan lifts ' + lift + ' pts on ' + CBP.CONFIG.BUDGET_YEAR;
      if (lift < 0) return 'Plan trims ' + (-lift) + ' pts on ' + CBP.CONFIG.BUDGET_YEAR;
    }
    return 'Tracking flat against the ceiling';
  }

  /* ================================================ v1.0.4 · dashboard =====
     Four pure helpers behind the v1.0.4 Overview board. Every one of them takes
     the project set it is asked about — never a country list, never a code — so
     a seventh country arriving in the fixtures flows through untouched. */

  /* The spend split across the D-01 ladder, in ladder order. Declined money is
     NOT committed and is excluded, so s1 + s2 + s3 + s4 === total ===
     D.committedTotal(projects) for the same set — which is what lets the
     budgettrack header columns and its expanded rungs agree by construction. */
  D.spendByStatus = function (projects) {
    var out = { s1: 0, s2: 0, s3: 0, s4: 0, total: 0 };
    (projects || []).forEach(function (p) {
      if (p.status === 'declined') return;
      var key = 's' + p.status;
      if (out[key] === undefined) return;       /* an unknown rung is never invented */
      var v = p.amount || 0;
      out[key] += v;
      out.total += v;
    });
    return out;
  };

  /* Records sitting at status 3 (submitted) longer than the configured wait.
     Sorted longest first; ties break on the id so the order is deterministic. */
  D.approvalRequired = function (projects) {
    var wait = CBP.CONFIG.APPROVAL_WAIT_DAYS;
    var out = [];
    (projects || []).forEach(function (p) {
      if (p.status !== 3 || !p.submitted_at) return;
      var waited = D.daysSince(p.submitted_at);
      if (waited === null || waited <= wait) return;
      out.push({ p: p, waited: waited });
    });
    return out.sort(function (a, b) {
      return (b.waited - a.waited) || (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0);
    });
  };

  /* Implementation phases whose END falls between TODAY and TODAY + warnDays,
     inclusive at both edges. A phase that has already ended is not a deadline
     any more and drops out; only status-1 records carry a live timeline at all
     (D.progress says so), so nothing earlier on the ladder is inspected.
     Sorted soonest first. */
  D.phaseDeadlines = function (projects, warnDays) {
    var win = (typeof warnDays === 'number' && isFinite(warnDays))
      ? warnDays : CBP.CONFIG.PHASE_WARN_DAYS;
    var out = [];
    (projects || []).forEach(function (p) {
      if (p.status !== 1) return;
      D.phases(p).forEach(function (ph) {
        if (!ph.end) return;
        var left = D.daysBetween(D.today(), D.parse(ph.end));
        if (left === null || left < 0 || left > win) return;
        out.push({ p: p, phase: ph, name: ph.phase, end: ph.end, daysLeft: left });
      });
    });
    return out.sort(function (a, b) {
      return (a.daysLeft - b.daysLeft) || (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0);
    });
  };

  /* { countryCode: unreadCount } for one user, summed over the projects passed
     in through D.unreadFor — so the per-country numbers decompose the single
     D.unreadCount(user) figure exactly, as long as the caller passes that
     user's visible projects. Every country represented in the set gets a key,
     zero included, so a country with nothing new still renders a row. */
  D.unreadByCountry = function (user, projects) {
    var out = {};
    if (!user) return out;
    (projects || []).forEach(function (p) {
      if (out[p.country] === undefined) out[p.country] = 0;
      out[p.country] += D.unreadFor(user, p.id);
    });
    return out;
  };

  /* ============================================== v1.0.1 · shared bar =======
     Every aligned-100% bar row shares ONE scale, so the 100% rule line sits at
     the same x down the whole column and an over-run visibly crosses it.
     rows may be numbers, or objects carrying pct / coverage / utilisation. */

  D.barPct = function (row) {
    if (row === null || row === undefined) return 0;
    if (typeof row === 'number') return isFinite(row) ? row : 0;
    var v = row.pct;
    if (v === undefined || v === null) v = row.coverage;
    if (v === undefined || v === null) v = row.utilisation;
    if (v === undefined || v === null) v = row.value;
    return (typeof v === 'number' && isFinite(v)) ? v : 0;
  };

  D.barScale = function (rows) {
    var max = 0;
    (rows || []).forEach(function (r) {
      var v = D.barPct(r);
      if (v > max) max = v;
    });
    return Math.max(140, Math.ceil(max / 20) * 20);
  };

})();
