/* store.js — CBP.state and the mutation helpers. Every mutation ends with a
   CBP.render() call from the caller; the store itself never touches the DOM. */
(function () {
  'use strict';

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  CBP.state = null;

  /* v1.0.1 — seeded read marks: { commentId: { userId: true } }. Kept here and
     not in the fixture because "what have I read" is per-session view state,
     not budget data. The seed is calibrated so the hub opens with a live
     balloon on the two demo personas that drive the walk: Priya 3 unread
     (C4, C6, C8), Daniel 2 unread (C7, C11). Anik reads down to 3 unread on
     his own country; the viewer has no marks and simply sees the count. */
  var READ_SEED = {
    C1:  { priya: true, daniel: true },
    C2:  { daniel: true, anik: true },
    C3:  { daniel: true, anik: true },
    C4:  { daniel: true },
    C5:  { priya: true },
    C8:  { daniel: true },
    C9:  { priya: true, daniel: true },
    C10: { priya: true, daniel: true },
    C12: { daniel: true },
    C13: { priya: true, daniel: true }
  };

  /* v1.0.1 — a dashboard's layout is { widgetId: { w:1|2|3, order:n } } over a
     3-track grid. The seed reproduces the board's current visual order exactly
     and maps the current rendered size onto the nearest span: a widget that
     renders full width today takes all 3 tracks, and a half-width widget that
     currently pairs with a neighbour takes 1 track so the pair still sits side
     by side. An unpaired half renders full width today, so it seeds to 3. */
  function widgetIsHalf(id) {
    var w = (CBP.W && CBP.W.byId) ? CBP.W.byId(id) : null;
    return !!(w && !w.bare && w.size !== 'full');
  }

  function defaultLayout(ids) {
    var half = ids.map(widgetIsHalf);
    var span = [], i = 0;
    while (i < ids.length) {
      if (half[i] && half[i + 1]) { span[i] = span[i + 1] = 1; i += 2; }
      else { span[i] = 3; i += 1; }
    }
    var out = {};
    ids.forEach(function (id, n) { out[id] = { w: span[n], order: n + 1 }; });
    return out;
  }
  CBP.defaultLayout = defaultLayout;

  CBP.initStore = function (data) {
    var users = clone(data.users);
    var start = users.filter(function (u) { return u.id === 'priya'; })[0] || users[0];

    /* the typed conversation stream (§7). Seeded from the fixtures, then
       appended to by CBP.actions. state.log is the same array under the older
       Phase A name so nothing has to choose between them. */
    var activity = clone(data.activity_seed || []);

    /* v1.0.1 — the conversation feed, a SEPARATE array from state.activity */
    var comments = clone(data.comments_seed || []);

    /* v1.0.1 — the mutable 2027 plan, seeded from budget_history */
    var plan2027 = {};
    (data.budget_history || []).forEach(function (r) { plan2027[r.code] = r.plan_2027; });

    /* v1.0.3 — the history years become configurable numbers rather than fixed
       fixtures. state.histEdit = { code: { year: committed } } is seeded from
       budget_history at init, so the fixture is the SEED and state is the live
       source D.history() reads. Years the Forecasting tab adds (2023, 2022 …)
       exist here and nowhere else; their ceiling is the standing 1,000,000. */
    var histEdit = {};
    (data.budget_history || []).forEach(function (r) {
      var per = histEdit[r.code] = {};
      Object.keys(r.years || {}).forEach(function (y) { per[y] = r.years[y].committed; });
    });

    /* v1.0.3 — plan years keyed by year. The 2027 entry IS the plan2027 object
       above (same reference, not a copy), so state.plan2027, D.plan2027 and
       A.planSet(code, value) keep behaving exactly as they did in v1.0.1 while
       2028, 2029 … live alongside it. */
    var planYears = { '2027': plan2027 };

    CBP.state = {
      user: start,
      users: users,
      countries: clone(data.countries),
      projects: clone(data.projects),

      /* append-only demo ledgers — Phase B writes into these */
      events: [],           /* status_event { project_id, from, to, at, actor } */
      activity: activity,   /* log_entry    { id, project, type, body, author, at, … } */
      log: activity,        /* alias of activity — same array, older name */
      entrySeq: 0,          /* counter behind generated log_entry ids */
      outbox: [],           /* rendered alert emails { rule, to[], to_ids[], subject, body, at, project }
                               v1.2.0 rows also carry { bucket, delivered, actions[], focus_id } (T-12) */

      /* v1.0.1 — comments (conversation) alongside the activity audit stream */
      comments: comments,
      readBy: clone(READ_SEED),          /* { commentId: { userId: true } } */
      commentSeq: comments.length,       /* C-ids continue after the seed */
      pinnedProjects: ['WE26BGD0002'],   /* the hub's pinned rail opens on the walk project */

      /* v1.0.1 — 2027 planning + the dashboard sync stamp */
      plan2027: plan2027,
      planYears: planYears,   /* v1.0.3 — { year: { code: amount } }, 2027 aliased above */
      histEdit: histEdit,     /* v1.0.3 — { code: { year: committed } } */
      dashSyncedAt: null,
      widgetMeta: {},       /* { widgetId: { desc } } — demo-level dataset definitions */

      /* v1.1.0 — F1 External Gate Connector (S-02, S-04, S-06). All in-memory,
         all clocks from CONFIG.TODAY. gateEvents is append-only. */
      integrations: clone(data.integrations || {}),
      gateEvents: clone(data.gate_events_seed || []),
      gateEventSeq: (data.gate_events_seed || []).length,
      gateProposals: [],    /* { id, project_id, system, step, proposed_at, proposed_ref, proposed_date, source, reason, status, decided_by, decided_at } */
      proposalSeq: 0,
      syncQueue: [],        /* { id, project_id, system, op, status, attempts, at, err } */
      syncSeq: 0,

      /* v1.1.0 — F2 Contracts (S-08…S-11). Contract log entries live in
         state.activity (type 'contract'); c.log_ids is a projection (F26). */
      contracts: clone(data.contracts || []),
      contractSeq: data.contract_seq || 1,
      contractTemplates: clone(data.contract_templates || []),
      signingAuthority: clone(data.signing_authority || []),
      signingDelegations: clone(data.signing_delegations || []),   /* NOT state.delegations (RD-5) */

      /* RM-4 — the five seeded demo dashboards behind the P2 tab strip. This is
         the single authoritative seed: names are the blueprint's tab names and
         `widgets` are CBP.W.registry ids, consumed verbatim by pages/p2.js.
         Boards a user adds carry custom:true and live alongside these. */
      /* v1.2.0 — demo clock, alert preferences, digest queue (T-04, T-12).
         state.clock.today feeds CONFIG.TODAY through persist.boot()/A.advanceDay;
         backup_seq lives here so backup names never collide across a reload
         (F34). state.backups is METADATA ONLY, mirrored from the IDB `backups`
         store for rendering — persist.listBackups() is the source of truth and
         this key is never part of the snapshot (F23). */
      clock: { today: data.TODAY, advanced_days: 0, backup_seq: 0 },
      alertPrefs: {},        /* { user_id: { digest_hour, mute } } → user_alert_pref */
      digestQueue: [],       /* { user_id, rule, project_id, subject, line, queued_on } */
      backups: [],           /* mirror of IDB store rows { id, name, saved_at, actor, bytes, checksum, kind } */

      dashboards: [
        /* v1.0.4 — the Overview board leads with the country budget track
           (ToR 30 Aug: "move to the top"), then the headline figures, then the
           two lists. msgalert and attention both carry a real, scrollable list
           of rows rather than a single figure, so each takes the full three
           tracks: paired at 1× they would each be a third of the board at
           1280 and the message briefs would wrap to two lines a piece. The
           layout is seeded explicitly rather than left to defaultLayout, so it
           stays what the ToR asked for however a widget's own size changes.
           'budget' and 'coverage' stay in the catalogue and are one click away
           in Edit layout — they simply leave this board's seed. */
        { id: 'overview',   name: 'Overview',
          widgets: ['budgettrack', 'kpis', 'msgalert', 'attention'],
          layout: {
            budgettrack: { w: 3, order: 1 },
            kpis:        { w: 3, order: 2 },
            msgalert:    { w: 3, order: 3 },
            attention:   { w: 3, order: 4 }
          } },
        { id: 'approval',   name: 'Approval Status',
          widgets: ['gate', 'statusmix', 'delegation'] },
        { id: 'budgetutil', name: 'Budget Utilisation',
          widgets: ['ceilings', 'league'] },
        { id: 'impl',       name: 'Project Implementation Status',
          widgets: ['statusmix', 'ownercov', 'unowned'] },
        { id: 'chats',      name: 'Active Chats & Comments',
          widgets: ['decisions', 'questions'] }
      ],
      scopeByDashboard: {},   /* remembered C-20 selection per dashboard */

      ui: {
        /* v1.0.1 — Messages & Alerts hub */
        msgFilter: 'unread',    /* unread ∣ all */
        msgSearch: '',
        msgSort: 'new',         /* new ∣ old ∣ project */
        msgGroup: false,        /* group by country */

        /* v1.0.1 — P2 dashboard edit mode (layout only; creation lives in P9) */
        dashEdit: false,        /* the dashboard id being edited, or false */
        dashDraft: null,        /* deep copy of { widgets, layout } while editing */

        /* v1.0.4 — which country blocks are expanded on the two new Overview
           widgets, { countryCode: true }. Pure disclosure state: nothing here
           is written to a project, so the viewer opens a country like anybody
           else, and a code that leaves the data simply stops being read. */
        btOpen: {},             /* budgettrack — the country project queues */
        maOpen: {},             /* msgalert — the country message blocks */

        /* v1.0.1 — P7 sub-menus */
        p7Tab: 'util',          /* util ∣ reports ∣ forecast */
        p7Report: {
          countries: [],        /* empty = every country in scope */
          statuses: [],         /* empty = every status */
          cols: ['committed', 'ceiling', 'utilisation', 'queue', 'gates', 'unread']
        },

        /* v1.0.1 — the route a save flow returns to ("Back to projects") */
        returnTo: null,
        editComment: null,      /* comment id being edited inline (P4 feed, hub) */

        route: CBP.CONFIG.DEFAULT_ROUTE,
        param: null,
        p3Filter: 'all',
        p3Search: '',
        openRows: { WE26BGD0002: true, WE25NPL0007: true },
        comfort: false,
        notice: null,

        /* P4 / P6 (Phase B) */
        p4Tab: 'overview',      /* overview ∣ budget ∣ timeline ∣ activity ∣ files */
        actFilter: 'all',       /* C-09 filter tabs */
        draft: null,            /* C-11 composer { type, body, assigned_to } */
        replyTo: null,          /* entry id the inline reply composer hangs under */
        editEntry: null,        /* entry id being edited (D-12) */
        p4Edit: false,          /* project record edit mode */
        modal: null,            /* C-12 { kind, id, values } */
        err: null,              /* { key, msg } — inline validation message */

        /* P5 / P9 (Phase C) */
        p5Group: 'country',     /* cross-project Gantt grouping: country ∣ status ∣ owner */
        p9Tab: 'users',         /* administration tab (v1.1.0 adds the value 'integrations') */
        /* v1.1.0 */
        p6Section: null,        /* approvals inbox: focused section */
        p12View: 'list',        /* contracts: list ∣ detail ∣ sign ∣ templates ∣ signatures ∣ new (CT3 is a view, not a 3rd hash segment) */
        p12Filter: 'all',       /* CT1 status filter */
        p12Search: '',
        p12Countries: null,     /* CT1 country chips (null = all), own key per S-12 */
        p12Tab: 'document',     /* CT2 tab: document ∣ details ∣ reviews ∣ signatures ∣ obligations ∣ log */
        p12Modal: null,
        ctDraft: null,          /* CT6 wizard draft */
        ctReviewReason: '',
        signScrolled: false,    /* CT3 scroll-to-end gate */
        signIntent: false,      /* CT3 intent checkbox */
        p9IntSys: 'chas',       /* Admin › Integrations focused system */

        /* v1.2.0 — flow pass (T-09…T-11) */
        p6Filter: 'all',        /* Needs-you chip: all ∣ reviews ∣ gates ∣ ready ∣ proposals ∣ contracts ∣ mine ∣ watching */
        p6Inline: null,         /* { id, act } — the row whose inline reason composer is open */
        focusId: null,          /* set from #/home/<id>; consumed by P6/P10, cleared on hashchange (F28) */
        homeCountry: null,      /* Regional drill: the country P14 shows for M2 */
        portfolioSort: 'coverage',

        /* P1 (Phase D) */
        mobileSim: false,       /* simulated device detection → sign in lands on P10 */
        p1Email: ''             /* remembered only so the stub field survives a render */
      }
    };

    /* v1.0.1 — every board carries a layout map beside its widget id list. The
       `widgets` array stays the authoritative id list; layout only says how
       wide each one is and in what order it sits.

       v1.0.4 — a board that seeds its own layout (Overview) keeps it; every
       other board still derives one from the widget sizes. */
    CBP.state.dashboards.forEach(function (b) {
      b.layout = b.layout || defaultLayout(b.widgets || []);
    });

    /* v1.1.0 — primary_contract_id is derived once from the contracts seed: the
       first non-amendment agreement of each project (S-09). */
    CBP.state.contracts.forEach(function (c) {
      if (c.parent_contract_id) return;
      var p = CBP.state.projects.filter(function (x) { return x.id === c.project_id; })[0];
      if (p && !p.primary_contract_id) p.primary_contract_id = c.id;
    });

    return CBP.state;
  };

  CBP.dashboardById = function (id) {
    return CBP.state.dashboards.filter(function (b) { return b.id === id; })[0] || null;
  };

  /* ------------------------------------------------------- persona ------ */

  CBP.setUser = function (id) {
    var u = CBP.state.users.filter(function (x) { return x.id === id; })[0];
    if (!u) return false;
    CBP.state.user = u;
    /* scope changed — a remembered dashboard scope may no longer be legal */
    CBP.state.scopeByDashboard = {};
    CBP.state.ui.p3Filter = 'all';
    CBP.state.ui.p3Search = '';
    CBP.state.ui.notice = null;

    /* v1.0.1 — the hub re-scopes to the new persona, and a half-finished
       dashboard edit belongs to the person who started it */
    CBP.state.ui.msgFilter = 'unread';
    CBP.state.ui.msgSearch = '';
    CBP.state.ui.dashEdit = false;
    CBP.state.ui.dashDraft = null;
    CBP.state.ui.returnTo = null;
    return true;
  };

  CBP.userById = function (id) {
    if (!id) return null;
    return CBP.state.users.filter(function (x) { return x.id === id; })[0] || null;
  };

  /* Owner ids appear on projects that have no seeded user record (country staff
     outside the persona set). Only a null owner is genuinely unassigned — an
     unknown id still names a person, so fall back to the id itself. */
  CBP.userName = function (id) {
    if (!id) return 'unassigned';
    var u = CBP.userById(id);
    if (u) return u.name;
    return id.charAt(0).toUpperCase() + id.slice(1);
  };

  /* ------------------------------------------------ project mutations --- */

  CBP.projectById = function (id) {
    return CBP.state.projects.filter(function (p) { return p.id === id; })[0] || null;
  };

  /* status change: appends a status_event and restarts the stage clock by
     writing the new stage's start date. Phase B drives this from P6. */
  CBP.setStatus = function (id, to, meta) {
    var p = CBP.projectById(id);
    if (!p) return null;
    var from = p.status;
    var at = CBP.CONFIG.TODAY;

    p.status = to;
    if (to === 3) p.submitted_at = at;
    if (to === 2) { p.approved_at = at; if (meta && meta.refs) p.refs = meta.refs; }
    if (to === 1) p.implementation_date = at;
    if (to === 'declined') p.declined_at = at;
    if (to === 4 && meta && meta.reason) p.return_reason = meta.reason;
    if (!p.d_in_q_start) p.d_in_q_start = at;

    CBP.state.events.push({
      project_id: id, from: from, to: to, at: at,
      actor: CBP.state.user.id, reason: (meta && meta.reason) || null
    });
    CBP.addLog(id, 'system', (meta && meta.note) ||
      ('Status ' + from + ' → ' + to + ((meta && meta.reason) ? ' — ' + meta.reason : '')));
    return p;
  };

  /* external gate click (M1 only, R-2). Starts that sub-step's own counter. */
  /* v1.1.0 — 5th arg `at` (ISO date) lets an inbound EGC event carry its own
     date (F3); defaults to TODAY so every v1.0.4 caller is unchanged. */
  CBP.recordGate = function (id, system, step, remark, at) {
    var p = CBP.projectById(id);
    if (!p) return null;
    p.gate = p.gate || {};
    p.gate[system] = p.gate[system] || {};
    p.gate[system][step === 'approved' ? 'approved_at' : 'submitted_at'] = at || CBP.CONFIG.TODAY;
    if (remark) p.gate[system].remark = remark;
    CBP.addLog(id, 'system', (system === 'chas' ? 'CHaS' : 'Decision Point') +
      ' — request ' + step + (remark ? ' · ' + remark : ''));
    return p;
  };

  /* one typed entry appended to the single stream (§7). Nothing is ever
     removed — D-12 allows edits, stamped, never deletion. */
  CBP.addLog = function (id, type, body, extra) {
    var entry = {
      id: 'E' + (++CBP.state.entrySeq),
      project: id, project_id: id, type: type, body: body,
      author: CBP.state.user.id, at: CBP.CONFIG.TODAY
    };
    if (extra) { Object.keys(extra).forEach(function (k) { entry[k] = extra[k]; }); }
    CBP.state.activity.push(entry);
    return entry;
  };

  CBP.entryById = function (id) {
    return CBP.state.activity.filter(function (x) { return x.id === id; })[0] || null;
  };

  /* v1.0.1 — comments live in their own array; this is the only lookup pages
     need, everything else goes through CBP.actions and CBP.D. */
  CBP.commentById = function (id) {
    return CBP.state.comments.filter(function (c) { return c.id === id; })[0] || null;
  };

  CBP.entriesFor = function (projectId) {
    return CBP.state.activity.filter(function (x) {
      return (x.project || x.project_id) === projectId;
    });
  };

  /* ------------------------------------------------------------- ui ----- */

  CBP.setFilter = function (f) { CBP.state.ui.p3Filter = f; };

  CBP.setSearch = function (q) { CBP.state.ui.p3Search = q || ''; };

  CBP.toggleRow = function (id, open) { CBP.state.ui.openRows[id] = !!open; };

  CBP.toggleComfort = function () {
    CBP.state.ui.comfort = !CBP.state.ui.comfort;
    return CBP.state.ui.comfort;
  };

  CBP.notice = function (msg) { CBP.state.ui.notice = msg || null; };

})();
