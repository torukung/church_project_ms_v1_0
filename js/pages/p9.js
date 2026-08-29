/* pages/p9.js — P9 Administration, route #/admin (build-plan item 8).
   Read-only throughout: this surface documents how the platform is configured,
   it does not configure it. Nothing here is used daily, so it is deliberately
   plain — five tabs of tables and config cards.
   Excluded per the build plan: the import runner and live API configuration. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};

  var TABS = [
    { k: 'users',    label: 'Users & roles' },
    { k: 'process',  label: 'Approval process' },
    { k: 'squads',   label: 'Squads & delegations' },
    { k: 'master',   label: 'Master data' },
    { k: 'dash',     label: 'Dashboards & datasets' },
    { k: 'io',       label: 'Import, export & API' }
  ];

  /* capabilities listed per user, each answered by the real permission matrix
     so this table can never drift from what the buttons actually do */
  var RIGHTS = [
    { a: 'submit',       t: 'Process 4 · Request submitted' },
    { a: 'review',       t: 'Process 3 · approve / return / reject' },
    { a: 'gate',         t: 'External gate clicks (R-2)' },
    { a: 'markApproved', t: 'Mark Approved 3 → 2' },
    { a: 'setCeiling',   t: 'Set country ceiling' },
    { a: 'manageUsers',  t: 'Manage users & thresholds' },
    { a: 'export',       t: 'Export' }
  ];

  function countryName(code) {
    var c = CBP.state.countries.filter(function (x) { return x.code === code; })[0];
    return c ? c.name : code;
  }

  function scopeText(u) {
    var s = u.role === 'viewer' ? u.view_scope : u.country_scope;
    if (!s || s === 'all') return 'All countries';
    return s.map(countryName).join(', ');
  }

  function rightsText(u) {
    var held = RIGHTS.filter(function (r) { return D.can(u, r.a); })
      .map(function (r) { return r.t; });
    return held.length ? held.join(' · ') : '— no approval rights';
  }

  function pill(text, tone) {
    return '<span class="p9-pill' + (tone ? ' ' + tone : '') + '">' + e(text) + '</span>';
  }

  function row(cells) { return '<tr>' + cells.join('') + '</tr>'; }
  function td(v, cls) { return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</td>'; }

  function kv(label, value, note) {
    return '<div class="p9-kv"><span>' + e(label) + '</span><b>' + value + '</b>' +
           (note ? '<small>' + e(note) + '</small>' : '') + '</div>';
  }

  /* ============================================================== page ====*/

  CBP.pages.admin = function (state) {
    var user = state.user;

    if (!D.can(user, 'manageUsers')) {
      return '<div class="crumb">Administration</div>' +
        '<div class="pagehead"><h1>Administration</h1>' +
        '<span class="sub">Requires the Admin role</span></div>' +
        U.card('Administration is Admin-only',
          '<p>Users and roles, approval thresholds, master data and the integration ' +
          'configuration are administered by the area office. You are signed in as <b>' +
          e(user.name) + '</b> — ' + e(CBP.CONFIG.ROLE_LABEL[user.role]) + '.</p>' +
          '<p>Switch to <b>Area Office Admin</b> in the persona switcher to see this page in ' +
          'full. Everything on it is read-only in the demo.</p>', { cls: 'p9-gate' });
    }

    var tab = state.ui.p9Tab || 'users';

    var html = '<div class="crumb">Administration · Area office</div>' +
      '<div class="pagehead"><h1>Administration</h1>' +
      '<span class="sub">Read-only in the demo · ' + state.users.length + ' users · ' +
      state.countries.length + ' seeded countries</span></div>';

    html += '<div class="p9-tabs">' + TABS.map(function (t) {
      return '<button class="p9-tab' + (tab === t.k ? ' on' : '') +
             '" data-act="p9tab" data-tab="' + t.k + '">' + e(t.label) + '</button>';
    }).join('') + '</div>';

    if (tab === 'process')     html += processTab(state);
    else if (tab === 'squads') html += squadsTab(state);
    else if (tab === 'master') html += masterTab(state);
    else if (tab === 'dash')   html += dashTab(state);
    else if (tab === 'io')     html += ioTab(state);
    else                       html += usersTab(state);

    return html + modal(state);
  };

  /* inline validation, same pattern as P4/P6 — the message lands beside the
     control that produced it, never in a dialog */
  function err(state, key) {
    var x = state.ui.err;
    return (x && x.key === key) ? '<p class="p9-note alert">' + e(x.msg) + '</p>' : '';
  }

  /* ----------------------------------------------------- users & roles --- */

  function usersTab(state) {
    var dels = CBP_DATA.delegations || [];

    var rows = state.users.map(function (u) {
      var d = dels.filter(function (x) { return x.away === u.id; })[0];
      return row([
        td('<b>' + e(u.name) + '</b>'),
        td(e(CBP.CONFIG.ROLE_LABEL[u.role])),
        td(e(scopeText(u)) + (u.role === 'viewer' ? '<small class="p9-sub">Admin-set view scope' +
           ' (D-05)</small>' : '')),
        td('<span class="p9-rights">' + e(rightsText(u)) + '</span>'),
        td(u.read_only ? pill('Read-only', 'rose') : pill('Active', 'verd')),
        td(d ? e(CBP.userName(d.delegate) + ' → ' + D.fmtDateY(d.to)) : '—', 'dim')
      ]);
    });

    var body = U.table([
      { label: 'Name' }, { label: 'Role' }, { label: 'Data scope' },
      { label: 'Approval rights' }, { label: 'Status' }, { label: 'Delegate' }
    ], rows) +
      '<p class="p9-note">Rights are read straight from the permission matrix the UI enforces, so ' +
      'this table cannot drift from what each persona can actually click. The viewer carries a ' +
      'separate Admin-set view scope and every action control is hidden for that account.</p>';

    var prefs =
      '<div class="p9-prefs">' +
        kv('Comfort font (Atkinson Hyperlegible)',
           state.ui.comfort ? pill('On', 'verd') : pill('Off'),
           'Per-user accessibility preference — one CSS variable swap (docs/03).') +
        '<button class="btn" data-act="comfort" aria-pressed="' +
          (state.ui.comfort ? 'true' : 'false') + '">Turn comfort font ' +
          (state.ui.comfort ? 'off' : 'on') + '</button>' +
      '</div>' +
      '<p class="p9-note">The same control sits in the top bar so it is reachable from every ' +
      'page; both write the one preference.</p>';

    return U.card('Users, roles and scopes', body) +
           U.card('Per-user preferences', prefs);
  }

  /* -------------------------------------------------- approval process --- */

  function processTab(state) {
    var C = CBP.CONFIG;

    /* R-1 / D-03 — amount-tier routing. The demo default is one tier: the
       external gate is required for every amount. */
    var tiers = [
      row([td('<b>' + D.money(0) + ' and above</b>'), td('All projects'),
           td(pill('Required', 'brass')), td('Decision Point + CHaS', 'dim')])
    ];

    var ladder = [
      ['Process 4', 'M2 · Request submitted', 'status 4 → 3'],
      ['Process 3', 'M1 · Request approved / Return to Review / Reject', 'status 3 → gate, → 4, → declined'],
      ['External gate', 'M1 only (R-2) · two systems × submitted / approved', 'stays at status 3'],
      ['Mark Approved', 'M1 · both reference numbers mandatory (R-4)', 'status 3 → 2'],
      ['Implementation', 'M1 · implementation started', 'status 2 → 1']
    ].map(function (r) {
      return row([td('<b>' + e(r[0]) + '</b>'), td(e(r[1])), td(e(r[2]), 'dim')]);
    });

    var clocks =
      kv('External gate idle', D.days(C.GATE_THRESHOLD_DAYS),
         'A-06 fires at this age, then repeats every 30 days until the system records an approval.') +
      kv('M1 review overdue', D.days(C.REVIEW_THRESHOLD_DAYS),
         'Status 3 with no gate movement past this age is flagged on P3 and P6.') +
      kv('Approved, not started', D.days(C.KICKOFF_THRESHOLD_DAYS),
         'Status 2 waiting longer than this shows as awaiting kickoff.') +
      kv('Country coverage warning', C.COVERAGE_WARN + '%',
         'Coverage bars turn brass here and rose above 100%.');

    return '<div class="p9-two">' +
      U.card('Amount-threshold routing (R-1 · D-03)',
        U.table([{ label: 'Amount tier' }, { label: 'Applies to' },
                 { label: 'External gate' }, { label: 'Systems' }], tiers) +
        '<p class="p9-note">Confirmed demo default: the gate is required for every amount. ' +
        'Additional tiers — a value above which a second approver or a different route applies — ' +
        'are configured here in the product; the demo ships the single tier the client confirmed.</p>') +
      U.card('Stage clocks and thresholds',
        '<div class="p9-kvs">' + clocks + '</div>' +
        '<p class="p9-note">Every clock is derived at render time against ' +
        e(D.fmtDateY(CBP.CONFIG.TODAY)) + ' — the platform stores dates, never counters, so a ' +
        'threshold change re-reads history instead of rewriting it.</p>') +
      '</div>' +
      U.card('The approval ladder (D-01)',
        U.table([{ label: 'Step' }, { label: 'Who and what' }, { label: 'Effect' }], ladder) +
        '<p class="p9-note">The ladder keeps the client’s original status numbers. Formal ' +
        'approval happens outside the platform in Decision Point and CHaS; the platform tracks ' +
        'that gate and records the manual 3 → 2 with both reference numbers.</p>');
  }

  /* -------------------------------------------- squads & delegations ----- */

  function squadsTab(state) {
    var T = CBP.CONFIG.TODAY;
    var dels = (CBP_DATA.delegations || []).map(function (d) {
      var active = D.parse(d.from) <= D.parse(T) && D.parse(T) <= D.parse(d.to);
      return row([
        td('<b>' + e(CBP.userName(d.away)) + '</b><small class="p9-sub">' +
           e(CBP.CONFIG.ROLE_LABEL[(CBP.userById(d.away) || {}).role] || '') + '</small>'),
        td(e(CBP.userName(d.delegate))),
        td(e(D.fmtDateY(d.from) + ' – ' + D.fmtDateY(d.to)), 'dim'),
        td(e(d.reason || '—'), 'dim'),
        td(active ? pill('Active today', 'brass') : pill('Scheduled'))
      ]);
    });

    var cov = D.countryRollup(state.projects, state.countries, null).map(function (r) {
      var owners = {}, unowned = 0, backups = 0;
      r.projects.forEach(function (p) {
        if (p.owner) owners[p.owner] = 1; else unowned++;
        if (p.backup) backups++;
      });
      var n = Object.keys(owners).length;
      return row([
        td('<b>' + e(r.name) + '</b>'),
        td(String(r.count), 'r num'),
        td(n ? Object.keys(owners).map(function (o) { return e(CBP.userName(o)); }).join(', ')
             : '<span class="p9-alertv">none</span>'),
        td(String(backups), 'r num'),
        td(unowned ? '<span class="p9-alertv num">' + unowned + '</span>' : '<span class="num">0</span>', 'r')
      ]);
    });

    var unownedTotal = state.projects.filter(function (p) { return !p.owner; }).length;

    return U.card('Delegations (RD-5 source)',
      (dels.length
        ? U.table([{ label: 'Away' }, { label: 'Delegate' }, { label: 'Period' },
                   { label: 'Reason' }, { label: 'State' }], dels)
        : '<div class="p9-empty">No delegations recorded.</div>') +
      '<p class="p9-note">A delegation re-points approvals and alerts for the period only; it ' +
      'never changes project ownership. This table is the source the RD-5 delegation and ' +
      'coverage widget reads on the dashboard.</p>') +

    U.card('Owner coverage by country',
      U.table([{ label: 'Country' }, { label: 'Projects', right: true }, { label: 'Owners' },
               { label: 'With backup', right: true }, { label: 'No owner', right: true }], cov) +
      (unownedTotal
        ? '<p class="p9-note alert">' + unownedTotal + ' project' +
          (unownedTotal === 1 ? '' : 's') + ' across the seeded set have no owner — alerts cannot ' +
          'route until one is assigned (D-14).</p>'
        : '<p class="p9-note">Every project has an owner.</p>'));
  }

  /* ------------------------------------------------------- master data --- */

  function masterTab(state) {
    var rollup = D.countryRollup(state.projects, state.countries, null);
    var rows = rollup.map(function (r) {
      return row([
        td('<b>' + e(r.name) + '</b><small class="p9-sub">' + e(r.code) + '</small>'),
        td(D.money(r.ceiling), 'r num'),
        td(String(r.count), 'r num'),
        td(D.money(r.committed), 'r num'),
        td(U.coverageCell(r.coverage), 'r')
      ]);
    });

    var ladder = CBP.CONFIG.STATUS_ORDER.map(function (s) {
      var st = CBP.CONFIG.STATUS[s];
      var n = state.projects.filter(function (p) { return String(p.status) === String(s); }).length;
      return row([
        td(U.statusPill(s)),
        td(e(st.short)),
        td(String(n), 'r num')
      ]);
    });

    return '<div class="p9-two">' +
      U.card('Countries and ceilings',
        U.table([{ label: 'Country' }, { label: 'Ceiling ' + CBP.CONFIG.BUDGET_YEAR, right: true },
                 { label: 'Projects', right: true }, { label: 'Committed', right: true },
                 { label: 'Coverage', right: true }], rows) +
        '<p class="p9-note">Six of the area’s 22 countries are seeded for the demo, each on the ' +
        'confirmed $1,000,000 annual ceiling (D-08, USD only in v1). Ceilings are set here and ' +
        'on P7 by Admin and M1; every figure above is summed from the fixture set at render ' +
        'time.</p>') +
      U.card('Status ladder (D-01)',
        U.table([{ label: 'Status' }, { label: 'Short form' },
                 { label: 'Projects', right: true }], ladder) +
        '<p class="p9-note">The client’s original numbering is master data, not a display ' +
        'choice: 4 In Development counts down to 1 Implementation, with Declined off the ladder. ' +
        'A declined project is re-created under a new ID rather than revived (R-3).</p>') +
      '</div>';
  }

  /* --------------------------------------- dashboards & datasets (v1.0.1) --
     ToR 29 Aug: boards are created HERE, not on P2, and the widget catalogue
     is predefined. What an admin can change in the demo is the dataset
     description line each widget advertises — the charts keep deriving their
     figures from the seeded data, which is the point of the whole build. */

  function widgetSpanLabel(w) {
    return (w && !w.bare && w.size !== 'full') ? '1 of 3 columns' : 'Full width';
  }

  function widgetDesc(state, w) {
    var meta = state.widgetMeta[w.id];
    return (meta && meta.desc) ? meta.desc : w.blurb;
  }

  function boardsCarrying(state, wid) {
    return state.dashboards.filter(function (b) {
      return (b.widgets || []).indexOf(wid) > -1;
    }).map(function (b) { return b.name; });
  }

  function dashTab(state) {
    var reg = (CBP.W && CBP.W.registry) ? CBP.W.registry : [];

    /* ---- the boards themselves, with the layout the store seeds ---- */
    var boardRows = state.dashboards.map(function (b) {
      var ids = b.widgets || [];
      var layout = b.layout || {};
      var spans = ids.map(function (id) {
        var w = (CBP.W && CBP.W.byId) ? CBP.W.byId(id) : null;
        return (w ? w.title : id) + ' · ' + ((layout[id] || {}).w || 3) + '×';
      });
      return row([
        td('<b>' + e(b.name) + '</b><small class="p9-sub">' + e(b.id) + '</small>'),
        td(String(ids.length), 'r num'),
        td(spans.length
          ? '<span class="p9-rights">' + e(spans.join(' · ')) + '</span>'
          : '<span class="p9-empty">No widgets yet</span>'),
        td(b.custom ? pill('Custom', 'brass') : pill('Seeded', 'verd'))
      ]);
    });

    var create =
      '<div class="fldrow">' +
        '<label class="vh" for="p9DashName">New dashboard name</label>' +
        '<input class="fld" id="p9DashName" type="text" placeholder="e.g. Regional review">' +
        '<button class="btn brass" data-act="p9-dash-create">+ New dashboard</button>' +
      '</div>' + err(state, 'dashCreate');

    var synced = state.dashSyncedAt
      ? 'Last synced from the Budget page on ' + e(D.fmtDateY(state.dashSyncedAt)) + '.'
      : 'Not synced from the Budget page yet.';

    var boardsCard = U.card('Dashboards',
      create +
      U.table([{ label: 'Dashboard' }, { label: 'Widgets', right: true },
               { label: 'Layout — widget · column span' }, { label: 'Origin' }], boardRows) +
      '<p class="p9-note">Creating a board here is the only way to add one: the Dashboard page ' +
      'owns layout, not the board list. A new board starts empty — open it on the Dashboard page ' +
      'and use Edit layout to place widgets, or add them from the catalogue below. Each layout ' +
      'entry is a column span over a three-track grid, held per board so two people can arrange ' +
      'the same widgets differently. ' + synced + '</p>');

    /* ---- the predefined widget catalogue ---- */
    var catRows = reg.map(function (w) {
      var on = boardsCarrying(state, w.id);
      var overridden = !!(state.widgetMeta[w.id] && state.widgetMeta[w.id].desc);
      return row([
        td('<b>' + e(w.title) + '</b><small class="p9-sub">' + e(w.id) + ' · ' +
           e(widgetSpanLabel(w)) + '</small>'),
        td('<span class="p9-rights">' + e(widgetDesc(state, w)) + '</span>' +
           (overridden ? ' ' + pill('Edited', 'brass') : '')),
        td(on.length
          ? '<span class="p9-rights">' + e(on.join(', ')) + '</span>'
          : '<span class="p9-empty">On no dashboard</span>'),
        td('<button class="btn sm" data-act="p9-wdesc" data-w="' + e(w.id) +
           '">Edit dataset definition</button>', 'r')
      ]);
    });

    var catalogue = U.card('Predefined widget catalogue',
      (catRows.length
        ? U.table([{ label: 'Widget' }, { label: 'Dataset' },
                   { label: 'On dashboards' }, { label: '', right: true }], catRows)
        : '<div class="p9-empty">The widget library has not loaded.</div>') +
      '<p class="p9-note">The catalogue is fixed in the demo — a board picks from these, it does ' +
      'not invent one. “Edit dataset definition” changes the description line this widget ' +
      'advertises, which is what an administrator would use to explain a dataset to their ' +
      'region. It never changes where a number comes from: every chart keeps deriving from the ' +
      'seeded project data against ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) + '.</p>');

    return boardsCard + catalogue;
  }

  /* ------------------------------------------------- C-12 dataset modal --- */

  function modal(state) {
    var m = state.ui.modal;
    if (!m || m.kind !== 'wdesc') return '';
    var w = (CBP.W && CBP.W.byId) ? CBP.W.byId(m.id) : null;
    if (!w) return '';
    var v = (m.values && m.values.mDesc !== undefined) ? m.values.mDesc : w.blurb;
    var overridden = !!(state.widgetMeta[w.id] && state.widgetMeta[w.id].desc);

    return '<div class="modal-wrap" data-act="mclose"><div class="modal">' +
      '<h3>Dataset definition</h3>' +
      '<p>' + e(w.title) + ' · ' + e(w.id) + ' · ' + e(widgetSpanLabel(w)) + '</p>' +
      '<label class="fldlab" for="mDesc">Description shown with this widget</label>' +
      '<textarea class="fld wide" id="mDesc" rows="3">' + e(v) + '</textarea>' +
      '<p class="p9-note">Demo-level: this saves the description only. The widget keeps reading ' +
      'the same derived data, so nothing on any dashboard changes value.</p>' +
      '<div class="acts">' +
        (overridden
          ? '<button class="btn sm" data-act="p9-wdesc-reset" data-w="' + e(w.id) +
            '">Reset to default</button>' : '') +
        '<button class="btn" data-act="modal-cancel">Cancel</button>' +
        '<button class="btn brass" data-act="p9-wdesc-save" data-w="' + e(w.id) +
        '">Save definition</button>' +
      '</div></div></div>';
  }

  /* -------------------------------------------- import, export and API --- */

  function ioTab(state) {
    var integrations = [
      ['CHaS · Dynamics 365', 'Manual gate — read-only pull on the roadmap (D-09 · RM-5)', 'brass'],
      ['“Decision Point”', 'Manual gate — API on the roadmap', 'brass'],
      ['TimeBlock · Gantt (add-on)', 'Deep link only, no data round-trip (D-07)', 'verd'],
      ['SMTP · outbound mail', 'Demo sends render to the in-app outbox', 'verd']
    ].map(function (r) {
      return '<div class="p9-int"><span>' + e(r[0]) + '</span>' + pill(r[1], r[2]) + '</div>';
    }).join('');

    var bullets = function (list) {
      return '<ul class="p9-list">' + list.map(function (x) {
        return '<li>' + e(x) + '</li>';
      }).join('') + '</ul>';
    };

    return '<div class="p9-two">' +
      U.card('Import and export',
        bullets([
          'Excel import — one tab per country, mapped on upload',
          'Dry-run preview with row-level errors before commit',
          'Full export: projects, approvals, activity stream, audit log',
          'Scheduled nightly backup to storage'
        ]) +
        '<p class="p9-note">Excluded from this build: the import runner itself. The demo shows ' +
        'the surface and the rules, not a live migration.</p>') +
      U.card('Integrations',
        integrations +
        '<p class="p9-note">Excluded from this build: live API configuration. CHaS stays a ' +
        'manual, mirrored record in v1 — the two external systems are tracked as a clocked gate, ' +
        'not written to.</p>') +
      '</div>' +
      U.card('Audit',
        '<p>Every status change, gate click, owner change and record edit writes an immutable ' +
        'system entry into the project’s activity stream, and edits to a human entry are stamped ' +
        'with who changed them and when (D-12). Nothing in the stream is deletable, which is what ' +
        'makes the log worth more than the spreadsheet it replaces.</p>' +
        '<p class="p9-note">Audit visibility follows the matrix: Admin sees everything, M1 their ' +
        'own region, M2 their own country, M3 none.</p>');
  }

})();
