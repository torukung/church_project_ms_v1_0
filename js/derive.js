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
     summed from the live projects, so an edit in the demo moves it. */

  D.history = function (code, year) {
    var rows = (window.CBP_DATA && CBP_DATA.budget_history) || [];
    var row = rows.filter(function (r) { return r.code === code; })[0];
    if (!row) return null;
    if (year === undefined || year === null) return row;
    return (row.years || {})[String(year)] || null;
  };

  D.historyYears = function () {
    var rows = (window.CBP_DATA && CBP_DATA.budget_history) || [];
    var seen = {}, out = [];
    rows.forEach(function (r) {
      Object.keys(r.years || {}).forEach(function (y) { if (!seen[y]) { seen[y] = 1; out.push(y); } });
    });
    return out.sort();
  };

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

  D.plan2027 = function (code) {
    var st = S();
    if (st && st.plan2027 && st.plan2027[code] !== undefined && st.plan2027[code] !== null) {
      return st.plan2027[code];
    }
    var row = D.history(code, null);
    return row ? row.plan_2027 : null;
  };

  /* One row per seeded country: three derived utilisation percentages plus the
     2027 plan. 2026 comes from the live project set, so it moves with the demo. */
  D.forecastRows = function (projects, countries) {
    var st = S();
    projects = projects || (st ? st.projects : []);
    countries = countries || (st ? st.countries : []);

    return countries.map(function (c) {
      var mine = projects.filter(function (p) { return p.country === c.code; });
      var committed = D.committedTotal(mine);
      var h24 = D.history(c.code, 2024), h25 = D.history(c.code, 2025);
      var y24 = h24 ? D.utilisation(h24.committed, h24.ceiling) : null;
      var y25 = h25 ? D.utilisation(h25.committed, h25.ceiling) : null;
      var y26 = D.utilisation(committed, c.ceiling);
      var plan = D.plan2027(c.code);
      var planPct = D.utilisation(plan, c.ceiling);

      var proj = D.trend2027(y24, y25, y26);

      return {
        code: c.code, name: c.name, ceiling: c.ceiling,
        committed2026: committed,
        y2024pct: y24, y2025pct: y25, y2026pct: y26,
        plan2027: plan, plan2027pct: planPct,
        proj2027pct: proj,
        proj2027: proj === null ? null : Math.round(proj / 100 * c.ceiling),
        note: forecastNote(y24, y25, y26, planPct)
      };
    });
  };

  /* v1.0.2 — simulated 2027 projection: a least-squares line through the
     utilisation points we actually hold (2024/2025/2026), extended one year.
     Pure derivation from the history fixtures + live 2026 data — nothing
     seeded — so editing a project re-simulates it. Clamped at 0. */
  D.trend2027 = function (y24, y25, y26) {
    var pts = [];
    if (y24 !== null && y24 !== undefined) pts.push([0, y24]);
    if (y25 !== null && y25 !== undefined) pts.push([1, y25]);
    if (y26 !== null && y26 !== undefined) pts.push([2, y26]);
    if (pts.length < 2) return pts.length === 1 ? Math.round(pts[0][1]) : null;
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; });
    var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    var icept = (sy - slope * sx) / n;
    return Math.max(0, Math.round(icept + slope * 3));
  };

  /* the variance sentence beside each forecast row — derived, never seeded */
  function forecastNote(y24, y25, y26, planPct) {
    if (y26 === null) return '';
    var overYears = [y24, y25, y26].filter(function (v) { return v !== null && v > 100; }).length;
    if (overYears >= 2) return 'Over ceiling for ' + overYears + ' years running — plan needs a decision';
    if (y26 > 100) return 'First year over ceiling';
    var low = [y24, y25, y26].filter(function (v) { return v !== null && v < 40; }).length;
    if (low >= 2) return 'Persistently under-using the allocation';
    var move = (y25 === null) ? null : Math.round(y26 - y25);
    if (planPct !== null && move !== null) {
      var lift = Math.round(planPct - y26);
      if (lift > 0) return 'Plan lifts ' + lift + ' pts on 2026';
      if (lift < 0) return 'Plan trims ' + (-lift) + ' pts on 2026';
    }
    return 'Tracking flat against the ceiling';
  }

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
