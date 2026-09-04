/* pages/p9.js — P9 Administration, route #/admin (build-plan item 8).
   Read-only throughout: this surface documents how the platform is configured,
   it does not configure it. Nothing here is used daily, so it is deliberately
   plain — five tabs of tables and config cards.
   Excluded per the build plan: the import runner and live API configuration. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};

  /* Seven tabs since v1.1.0. The labels are the short form so the whole strip
     fits on one row down to 1024; below that the strip scrolls sideways rather
     than stacking into two and three rows (UX probe). The long form each one
     carries is on the card headings inside the tab. */
  var TABS = [
    { k: 'users',    label: 'Users' },
    { k: 'process',  label: 'Process' },
    { k: 'squads',   label: 'Squads' },
    { k: 'master',   label: 'Master data' },
    { k: 'dash',     label: 'Dashboards' },
    /* v1.1.0 · F1 — the EGC console. The old `io` tab keeps import/export and
       the audit note; its four hard-coded integration rows move here, where
       they are driven by state.integrations instead of a literal array. */
    { k: 'integrations', label: 'Integrations' },
    /* v1.2.0 · F26 — the Data tab REPLACES Import/Export (it does not join it),
       so the strip stays at seven and fits one row down to 1024. The old
       import/export prose is folded into one paragraph at the foot of the new
       tab rather than duplicated. */
    { k: 'data',     label: 'Data' }
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
    { a: 'export',       t: 'Export' },
    /* v1.1.0 — the EGC and Corporate Agreement rows, so the reviewer personas
       (OGC, Finance) read as something other than "no approval rights" */
    { a: 'integrations',       t: 'Integrations · sync configuration' },
    { a: 'gate_confirm',       t: 'Confirm sync proposals' },
    { a: 'contract_edit',      t: 'Draft a Corporate Agreement' },
    { a: 'contract_review',    t: 'Corporate Agreement review (OGC / Finance)' },
    { a: 'contract_approve_sig', t: 'Approve for signature' },
    { a: 'contract_sign',      t: 'Sign an agreement (within authority)' },
    { a: 'contract_send',      t: 'Mark an agreement sent out' }
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
    else if (tab === 'integrations') html += integrationsTab(state);
    else if (tab === 'data')   html += dataTab(state);
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
      ['Corporate Agreement', 'M2 drafts · OGC and Finance review · M1 approves for signature · ' +
        'signatories sign · M2 marks sent out', 'gate inside status 2'],
      ['Implementation', 'M1 · implementation started, agreement sent out', 'status 2 → 1']
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

    /* v1.1.0 · S-08 — the Corporate Agreement gate is threshold-driven. This is
       the one knob on this tab an administrator can actually move in the demo;
       everything under it is read-only, as the rest of the page is. */
    var canEdit = D.can(state.user, 'integrations');
    var thr =
      '<div class="p9-kv"><span>Corporate Agreement required from</span>' +
      '<b>' + (canEdit
        ? '<span class="p9i-thr">' +
            '<input class="fld num" id="p9Threshold" type="number" min="0" step="1000" value="' +
            e(C.CONTRACT_THRESHOLD_USD) + '">' +
            '<button class="btn sm" data-act="p9i-threshold">Save</button></span>'
        : e(D.money(C.CONTRACT_THRESHOLD_USD))) + '</b>' +
      '<small>A project at or above this amount cannot start implementation until its ' +
      'agreement has been sent out (S-08). A per-project override still wins. Currently ' +
      e(D.money(C.CONTRACT_THRESHOLD_USD)) + '.</small></div>' + err(state, 'integrations');

    var contractKnobs = thr +
      kv('Drafting may start at status', String(C.CONTRACT_DRAFT_FROM),
         'Once the external gate is open, M2 may open a draft; signing still needs status 2.') +
      kv('Agreement idle', D.days(C.CONTRACT_IDLE_DAYS),
         'Nothing moved on a live agreement for this long — A-20, derived only.') +
      kv('OGC / Finance review window', D.days(C.REVIEW_SLA_DAYS), 'A-18 review due date.') +
      kv('Signature window', D.days(C.SIGN_SLA_DAYS), 'A-19 signature due date.') +
      kv('Expiry warning', D.days(C.CONTRACT_EXPIRY_WARN_DAYS),
         'Active agreements ending inside this window are listed as expiring soon.') +
      kv('Outbound sync attempts', String(C.SYNC_RETRY_MAX),
         'A queued operation is retried up to this many times before the connector must be reset.');

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
      U.card('Corporate Agreement gate (v1.1.0 · S-08)',
        '<div class="p9-kvs">' + contractKnobs + '</div>' +
        '<p class="p9-note">The agreement is a gate <b>inside</b> status 2: the ladder numbers ' +
        'are unchanged, and Start Implementation stays locked until the agreement has been sent ' +
        'out. Every other knob here is read-only in the demo and shipped at the value the client ' +
        'confirmed on 2 September.</p>') +
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

  /* ==================================== v1.2.0 · F26 Admin › Data tab =====
     Replaces the old Import/Export tab. Everything on it is a real call into
     CBP.persist (T-05/T-06) or A.advanceDay (T-04); nothing here is a mock.
     The whole tab is Admin-only twice over: the page itself is behind
     D.can(user,'manageUsers') and every control is behind D.can(user,'backup')
     or D.can(user,'advance_clock').

     Acts are the page-owned `p9d-*` namespace with one delegated listener
     registered once at the foot of this file — HANDLERS in actions.js is
     frozen and gains nothing. */

  function P() { return CBP.persist || null; }

  /* state.backups is a render mirror only and is never persisted (F23), so the
     tab reads the IndexedDB `backups` store through P.listBackups() on entry.
     `loaded` keeps that to one call per visit rather than one per render. */
  var loaded = false, inflight = false, lastTab = null;

  function invalidate() { loaded = false; }

  function ensureBackups(state) {
    var p = P();
    if (!p || !p.listBackups) return;
    if (state.ui.p9Tab !== 'data') { lastTab = state.ui.p9Tab; loaded = false; return; }
    if (lastTab !== 'data') { lastTab = 'data'; loaded = false; }
    if (loaded || inflight) return;
    inflight = true;
    p.listBackups().then(function () {
      inflight = false; loaded = true; CBP.render();
    }, function () { inflight = false; loaded = true; });
  }

  function shortSum(s) {
    s = String(s || '');
    return s ? s.slice(0, 12) : '—';
  }

  function bytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' kB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  function storageCard(state) {
    var p = P();
    var st = (p && p.status) ? p.status() : null;
    if (!st) {
      return U.card('Saved data',
        '<p class="p9-note alert">The persistence engine is not loaded in this build.</p>');
    }

    var banner = '';
    if (st.stale) {
      banner += '<p class="p9d-banner hot">Another tab has newer data — this tab has stopped ' +
        'saving so it cannot overwrite it. Reload to pick the newer record up.</p>';
    }
    if (st.kind === 'memory') {
      banner += '<p class="p9d-banner warn">Persistence unavailable in this browser — the demo ' +
        'is running in memory and this session ends when the tab closes.' +
        (st.note ? ' ' + e(st.note) : '') + '</p>';
    } else if (st.kind === 'localstorage') {
      banner += '<p class="p9d-banner warn">IndexedDB is not available here, so the record is ' +
        'kept in localStorage instead. Everything else works the same way.</p>';
    }

    var KIND = { indexeddb: 'IndexedDB', localstorage: 'localStorage', memory: 'In memory only' };

    return U.card('Saved data',
      banner +
      '<div class="p9-kvs p9d-kvs">' +
        kv('Storage', e(KIND[st.kind] || st.kind),
           st.ready ? 'saving after every change' : 'not saving') +
        kv('Record key', '<span class="num">' + e(st.key || '—') + '</span>',
           'schema · app version · path hash') +
        kv('Revision', '<span class="num">' + e(String(st.rev)) + '</span>',
           'increments once per save') +
        kv('Last saved', '<span class="num">' + e(st.saved_at || 'not yet') + '</span>',
           'day plus a per-session counter — no wall clock') +
        kv('Size', '<span class="num">' + e(bytes(st.bytes)) + '</span>', 'of the stored record') +
        kv('Session', '<span class="num">' + e(st.session_id || '—') + '</span>',
           'this tab, for the two-tab guard') +
        kv('Schema version', '<span class="num">' + e(String(CBP.CONFIG.SCHEMA_VERSION)) + '</span>',
           'app ' + CBP.CONFIG.APP_VERSION) +
      '</div>' +
      '<p class="p9-note">The record is namespaced by schema version, app version and the path ' +
      'this copy is served from, so two builds in two folders never share a store. A record ' +
      'written somewhere else is refused with a notice and the fixtures load instead.</p>');
  }

  function backupsCard(state) {
    var user = state.user;
    var may = D.can(user, 'backup');
    var rows = state.backups || [];

    var head = '<div class="p9d-acts">' +
      (may ? '<button class="btn brass" data-act="p9d-backup">Backup now</button>' : '') +
      '<span class="p9-note">A manual backup downloads a JSON file and keeps a copy in the ' +
      'browser store; the demo also writes one scheduled backup every time the clock advances, ' +
      'keeping the last ' + CBP.CONFIG.BACKUP_KEEP + '.</span></div>';

    var table;
    if (!rows.length) {
      table = '<p class="p9-note">No backup has been written yet in this browser.</p>';
    } else {
      var confirmId = state.ui.p9dConfirm && state.ui.p9dConfirm.kind === 'restore-row'
        ? state.ui.p9dConfirm.id : null;
      table = U.table([
        { label: 'File' }, { label: 'Saved' }, { label: 'Kind' },
        { label: 'Size', right: true }, { label: 'Checksum' }, { label: '' }
      ], rows.map(function (r) {
        var acts = confirmId === r.id
          ? '<span class="p9d-confirm">Replace everything with this backup?' +
            '<button class="btn sm brass" data-act="p9d-restore-go" data-id="' + e(r.id) +
              '">Yes, restore</button>' +
            '<button class="btn sm" data-act="p9d-cancel">Cancel</button></span>'
          : (may ? '<button class="btn sm" data-act="p9d-restore-row" data-id="' + e(r.id) +
              '">Restore</button>' : '') +
            '<button class="btn sm" data-act="p9d-download-row" data-id="' + e(r.id) +
              '">Download</button>';
        return row([
          td('<span class="num">' + e(r.name) + '</span>'),
          td('<span class="num">' + e(r.saved_at) + '</span>'),
          td(pill(r.kind === 'manual' ? 'Manual' : 'Scheduled', r.kind === 'manual' ? 'brass' : '')),
          td('<span class="num">' + e(bytes(r.bytes)) + '</span>', 'r'),
          td('<span class="num" title="' + e(r.checksum_alg || '') + '">' +
             e(shortSum(r.checksum)) + '…</span>'),
          td('<span class="p9d-rowacts">' + acts + '</span>')
        ]);
      }));
    }

    return U.card('Backups', head + table);
  }

  function restoreCard(state) {
    if (!D.can(state.user, 'backup')) return '';
    return U.card('Restore from a file',
      '<p>Pick a backup file written by this demo. The checksum and the schema version are ' +
      'validated before anything is replaced; a file that has been edited since it was written ' +
      'is refused and nothing changes.</p>' +
      '<div class="p9d-acts"><input class="p9d-file" type="file" accept=".json,application/json" ' +
      'id="p9dFile" data-act="p9d-restore-file"></div>');
  }

  var CSV_KINDS = [
    { k: 'projects',    label: 'Projects' },
    { k: 'contracts',   label: 'Agreements' },
    { k: 'gate_events', label: 'Gate events' },
    { k: 'activity',    label: 'Activity' },
    { k: 'outbox',      label: 'Outbox' }
  ];

  function exportCard(state) {
    if (!D.can(state.user, 'export')) return '';
    return U.card('Export CSV',
      '<div class="p9d-acts">' + CSV_KINDS.map(function (x) {
        return '<button class="btn" data-act="p9d-export-' + e(x.k) + '">' + e(x.label) + '</button>';
      }).join('') + '</div>' +
      '<p class="p9-note">Five files, RFC 4180 quoted, one row per record as the demo holds it ' +
      'right now. They are the same five tables the migration pack in docs/db describes.</p>');
  }

  function clockCard(state) {
    var may = D.can(state.user, 'advance_clock');
    var c = state.clock || { today: CBP.CONFIG.TODAY, advanced_days: 0 };
    var folded = (state.outbox || []).filter(function (m) {
      return m.rule === CBP.CONFIG.DIGEST_RULE;
    }).length;
    var queued = (state.digestQueue || []).length;
    var sched = (state.backups || []).filter(function (r) { return r.kind === 'scheduled'; });
    var last = sched.length ? sched[0].saved_at : null;

    return U.card('Clock',
      '<div class="p9-kvs p9d-kvs">' +
        kv('Today', '<span class="num">' + e(D.fmtDateY(c.today)) + '</span>',
           'every day count on every page derives from this') +
        kv('Days advanced', '<span class="num">' + e(String(c.advanced_days || 0)) + '</span>',
           c.advanced_days ? 'byte-identity holds only at day 0' : 'fixture default') +
        kv('Digest mails folded', '<span class="num">' + folded + '</span>',
           queued + ' row' + (queued === 1 ? '' : 's') + ' queued for the next run') +
        kv('Last scheduled backup', '<span class="num">' + e(last || 'none yet') + '</span>',
           sched.length + ' kept of ' + CBP.CONFIG.BACKUP_KEEP) +
      '</div>' +
      (may
        ? '<div class="p9d-acts">' +
            '<button class="btn brass" data-act="p9d-advance-1">Advance day +1</button>' +
            '<button class="btn" data-act="p9d-advance-7">Advance +7</button>' +
          '</div>'
        : '') +
      '<p class="p9-note">Advancing the clock is what makes batching visible: each day folds ' +
      'every queued alert into one daily digest per recipient, writes one scheduled backup, and ' +
      'moves every SLA and wait counter with it.</p>');
  }

  function resetCard(state) {
    if (!D.can(state.user, 'backup')) return '';
    var asking = state.ui.p9dConfirm && state.ui.p9dConfirm.kind === 'reset';
    return U.card('Reset to fixtures',
      '<p>Wipes the saved record and reloads the shipped demo data. The clock returns to ' +
      e(D.fmtDateY(CBP_DATA.TODAY)) + ' and everything done in this browser is lost.</p>' +
      '<div class="p9d-acts">' +
      (asking
        ? '<span class="p9d-confirm">This cannot be undone.' +
          '<button class="btn sm brass" data-act="p9d-reset-confirm">Yes, reset</button>' +
          '<button class="btn sm" data-act="p9d-cancel">Cancel</button></span>'
        : '<button class="btn" data-act="p9d-reset">Reset to fixtures</button>') +
      '</div>', { cls: 'p9d-danger' });
  }

  function dataTab(state) {
    ensureBackups(state);

    return '<div class="p9-two">' + storageCard(state) + clockCard(state) + '</div>' +
      backupsCard(state) +
      '<div class="p9-two">' + restoreCard(state) + exportCard(state) + '</div>' +
      resetCard(state) +
      U.card('Import, export and audit',
        '<p>Bulk import is an Excel workbook with one tab per country, mapped on upload and ' +
        'dry-run previewed with row-level errors before anything is committed; the import ' +
        'runner itself is excluded from this build, which shows the surface and the rules ' +
        'rather than a live migration. Export is the five CSVs above plus the RD-3 print ' +
        'pre-read on the Dashboard. Every status change, gate click, owner change and record ' +
        'edit writes an immutable system entry into the project’s activity stream, and edits to ' +
        'a human entry are stamped with who changed them and when (D-12) — nothing in the ' +
        'stream is deletable, which is what makes the log worth more than the spreadsheet it ' +
        'replaces. Audit visibility follows the matrix: Admin sees everything, M1 their own ' +
        'region, M2 their own country, M3 none. Connector configuration lives on the ' +
        '<b>Integrations</b> tab.</p>');
  }

  /* ------------------------------------------------- p9d-* · one listener - */

  function onData() {
    return CBP.state && CBP.state.ui && CBP.state.ui.route === 'admin' &&
           CBP.state.ui.p9Tab === 'data';
  }

  if (!CBP.p9d) {
    CBP.p9d = { wired: true, invalidate: invalidate };

    document.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (!act || act.indexOf('p9d-') !== 0) return;
      if (!onData()) return;

      var state = CBP.state, p = P(), id = t.getAttribute('data-id');
      ev.preventDefault();

      if (act === 'p9d-backup') {
        if (!D.can(state.user, 'backup') || !p) return;
        p.backupNow('manual').then(function () {
          invalidate(); CBP.render();
        }, function () { CBP.render(); });
        return;
      }

      if (act === 'p9d-restore-row') {
        state.ui.p9dConfirm = { kind: 'restore-row', id: id };
        CBP.render(); return;
      }

      if (act === 'p9d-restore-go') {
        if (!D.can(state.user, 'backup') || !p) return;
        state.ui.p9dConfirm = null;
        invalidate();
        p.restoreBackup(id);              /* renders itself, success or refusal */
        return;
      }

      if (act === 'p9d-download-row') {
        if (p) p.download(id);
        return;
      }

      if (act === 'p9d-cancel') {
        state.ui.p9dConfirm = null;
        CBP.render(); return;
      }

      if (act === 'p9d-reset') {
        state.ui.p9dConfirm = { kind: 'reset' };
        CBP.render(); return;
      }

      if (act === 'p9d-reset-confirm') {
        if (!D.can(state.user, 'backup') || !p) return;
        state.ui.p9dConfirm = null;
        invalidate();
        p.reset();                        /* renders itself (F24) */
        return;
      }

      if (act.indexOf('p9d-export-') === 0) {
        if (!D.can(state.user, 'export') || !p) return;
        p.exportCsv(act.slice('p9d-export-'.length));
        return;
      }

      if (act === 'p9d-advance-1' || act === 'p9d-advance-7') {
        if (!D.can(state.user, 'advance_clock')) return;
        var n = act === 'p9d-advance-7' ? 7 : 1;
        CBP.actions.advanceDay(n);        /* renders itself at the end */
        invalidate();
        /* the scheduled backup lands on a promise; pick it up on the next pass */
        window.setTimeout(function () { invalidate(); CBP.render(); }, 150);
        return;
      }
    });

    /* the file input is a change, not a click */
    document.addEventListener('change', function (ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      if (t.getAttribute('data-act') !== 'p9d-restore-file') return;
      if (!onData()) return;
      var p = P();
      var f = t.files && t.files[0];
      if (!f || !p) return;
      var fr = new FileReader();
      fr.onload = function () {
        var obj = null;
        try { obj = JSON.parse(String(fr.result)); } catch (err) { obj = null; }
        if (!obj) {
          CBP.state.ui.notice = 'That file is not readable JSON.';
          CBP.render();
          return;
        }
        invalidate();
        p.restore(obj);                   /* renders itself, success or refusal */
      };
      fr.onerror = function () {
        CBP.state.ui.notice = 'That file could not be read.';
        CBP.render();
      };
      fr.readAsText(f);
    });
  }

  /* ======================================= v1.1.0 · F1 Integrations (EGC) ===
     The connector console. Two gate systems carry the whole surface (driver,
     mode, health, mapping, simulator); SMTP and TimeBlock are services and
     show what they are, which is what the old literal rows said.

     Every control is behind D.can(user,'integrations'); the engine checks the
     same row again, so a read-only render and a refused action can never
     disagree. Nothing here talks to a network — the drivers are simulated and
     the page says so at the bottom. */

  var SYSTEMS = ['chas', 'decision_point', 'smtp', 'timeblock'];

  var HEALTH_TONE = { ok: 'verd', warn: 'brass', failed: 'rose', off: '' };
  var HEALTH_DOT  = { ok: 'ok', warn: 'warn', failed: 'failed', off: 'off' };

  var MODE_LABEL = { manual: 'Manual', assisted: 'Assisted', auto: 'Auto' };

  var MODE_MEANING = {
    manual: 'Nothing moves on its own: the Regional Manager records every gate step by hand, ' +
            'exactly as in v1.0.4.',
    assisted: 'The portal lodges what it has just done; anything coming back from the system ' +
              'waits in Approvals as a proposal until the Regional Manager confirms it.',
    auto: 'Authoritative inbound events write the gate directly and are logged with their ' +
          'source; only a conflict or an advisory event becomes a proposal.'
  };

  var DRIVER_MEANING = {
    manual: 'no transport — dates typed in the portal',
    deeplink: 'a link out to the system, nothing read back',
    excel: 'a pasted export, reconciled on demand',
    email: 'a parsed notification mailbox',
    flow: 'a Power Automate flow (simulated here)',
    rest: 'the Dataverse Web API (simulated here)',
    sim: 'the built-in simulator, standing in for flow / rest'
  };

  function isGate(k) {
    return CBP.CONFIG.GATE_SYSTEMS.filter(function (s) { return s.key === k; }).length > 0;
  }

  function modeLabel(m) { return MODE_LABEL[m] || m; }

  /* ui keys this tab owns. store.js is not ours to edit (WP0 owns it), so the
     two view-state keys are created lazily on first render, the same shape the
     rest of ui.* uses. */
  function ensureUi(state) {
    state.ui.p9IntFilter = state.ui.p9IntFilter || 'all';
    state.ui.p9IntMsg = state.ui.p9IntMsg || null;
    if (SYSTEMS.indexOf(state.ui.p9IntSys) === -1) state.ui.p9IntSys = 'chas';
    return state.ui;
  }

  function healthDot(k) {
    var h = D.syncHealth(k);
    return '<span class="p9i-dot ' + (HEALTH_DOT[h.health] || 'off') + '" aria-hidden="true"></span>';
  }

  function rail(state) {
    var cur = state.ui.p9IntSys;
    return '<div class="p9i-rail" role="group" aria-label="Connected systems">' +
      SYSTEMS.map(function (k) {
        var i = D.integration(k);
        var h = D.syncHealth(k);
        return '<button class="p9i-sys' + (cur === k ? ' on' : '') + '" data-act="p9i-sys" ' +
          'data-sys="' + e(k) + '" aria-pressed="' + (cur === k) + '">' +
          '<span class="p9i-syst">' + healthDot(k) + '<b>' + e(i.label || k) + '</b></span>' +
          '<small>' + e(h.label) + ' · ' +
          e(isGate(k) ? modeLabel(D.syncMode(k)) : 'service') +
          (h.failed ? ' · ' + h.failed + ' failed' : '') + '</small></button>';
      }).join('') +
      '<p class="p9-note">A <b>driver</b> says how the portal talks to a system; a <b>mode</b> ' +
      'says how much the portal trusts what comes back (S-05). Both are per system.</p>' +
      '</div>';
  }

  function msgBlock(state) {
    var m = state.ui.p9IntMsg;
    if (!m) return '';
    return '<p class="p9-note' + (m.ok === false ? ' alert' : '') + '">' + e(m.text) + '</p>';
  }

  function statusPill(s) {
    var tone = s === 'ok' ? 'verd' : (s === 'failed' ? 'rose' : 'brass');
    return pill(s, tone);
  }

  /* ------------------------------------------------------- system card ---- */

  function serviceCard(k) {
    var i = D.integration(k);
    var h = D.syncHealth(k);
    return U.card(i.label || k,
      '<div class="p9-kvs">' +
        kv('Health', pill(h.label, HEALTH_TONE[h.health] || '')) +
        kv('Driver', e(i.driver || 'sim'), DRIVER_MEANING[i.driver] || '') +
        kv('Last sync', e(i.last_sync_at ? D.fmtDateY(i.last_sync_at) : '—')) +
      '</div>' +
      '<p class="p9-note">' + e(i.note || 'A supporting service, not a gate: it carries no ' +
      'approval state, so it has no sync mode.') + '</p>');
  }

  function gateCard(state, k) {
    var user = state.user;
    var can = D.can(user, 'integrations');
    var i = D.integration(k);
    var h = D.syncHealth(k);
    var mode = D.syncMode(k);

    /* --- driver + mode ------------------------------------------------- */
    var driver = can
      ? '<select class="sel" data-act="p9i-driver" data-sys="' + e(k) + '">' +
        CBP.CONFIG.SYNC_DRIVERS.map(function (d) {
          return '<option value="' + e(d) + '"' + (i.driver === d ? ' selected' : '') + '>' +
            e(d) + ' — ' + e(DRIVER_MEANING[d] || '') + '</option>';
        }).join('') + '</select>'
      : '<b>' + e(i.driver) + '</b>';

    var modeCtl = '<div class="p9i-seg" role="group" aria-label="Sync mode">' +
      CBP.CONFIG.SYNC_MODES.map(function (m) {
        if (!can) {
          return '<span class="p9i-segb' + (mode === m ? ' on' : '') + '">' +
            e(modeLabel(m)) + '</span>';
        }
        return '<button class="p9i-segb' + (mode === m ? ' on' : '') + '" data-act="p9i-mode" ' +
          'data-sys="' + e(k) + '" data-m="' + e(m) + '" aria-pressed="' + (mode === m) + '">' +
          e(modeLabel(m)) + '</button>';
      }).join('') + '</div>' +
      '<p class="p9i-mean">' + e(MODE_MEANING[mode]) + '</p>';

    /* --- endpoint, secret, deep link ----------------------------------- */
    var endpoint = can
      ? '<span class="p9i-inline"><input class="fld" id="p9iEndpoint" type="text" value="' +
        e(i.endpoint_masked || '') + '" placeholder="https://…"> ' +
        '<button class="btn sm" data-act="p9i-endpoint" data-sys="' + e(k) + '">Save</button></span>'
      : '<b>' + e(i.endpoint_masked || '—') + '</b>';

    var secret = can
      ? '<button class="btn sm" data-act="p9i-secret" data-sys="' + e(k) + '">' +
        (i.secret_set ? 'Clear secret' : 'Mark secret set') + '</button>'
      : '';

    var link = can
      ? '<span class="p9i-inline"><input class="fld" id="p9iLink" type="text" value="' +
        e(i.deep_link_template || '') + '" placeholder="https://…/{chas_guid}"> ' +
        '<button class="btn sm" data-act="p9i-deeplink" data-sys="' + e(k) +
        '">Save</button></span>'
      : '<b>' + e(i.deep_link_template || '—') + '</b>';

    var cfg = '<div class="p9-kvs">' +
      '<div class="p9-kv p9i-wide"><span>Driver</span><b>' + driver + '</b>' +
        '<small>' + e(DRIVER_MEANING[i.driver] || '') + '</small></div>' +
      '<div class="p9-kv p9i-wide"><span>Sync mode</span><b>' + modeCtl + '</b></div>' +
      kv('Health', pill(h.label, HEALTH_TONE[h.health] || ''),
         h.failed ? h.failed + ' operation' + (h.failed === 1 ? '' : 's') + ' failed and waiting'
                  : 'No failed operation in the queue.') +
      kv('Last sync', e(i.last_sync_at ? D.fmtDateY(i.last_sync_at) : 'never'),
         'Simulated: a successful test, import or queue run stamps today.') +
      '<div class="p9-kv p9i-wide"><span>Endpoint (masked)</span><b>' + endpoint + '</b>' +
        '<small>Secrets are never stored by the demo — only whether one is set.</small></div>' +
      '<div class="p9-kv"><span>Secret</span><b>' +
        pill(i.secret_set ? 'Set' : 'Not set', i.secret_set ? 'verd' : '') +
        (secret ? ' ' + secret : '') + '</b></div>' +
      '<div class="p9-kv p9i-wide"><span>Deep-link template</span><b>' + link + '</b>' +
        '<small>Tokens: {chas_guid}, {decision_point_ref}, {project_id}. Rendered wherever the ' +
        'gate shows (S-07).</small></div>' +
      '<div class="p9-kv"><span>Counters</span><b class="num">' +
        e((i.stats || {}).ok || 0) + ' ok · ' + e((i.stats || {}).failed || 0) + ' failed · ' +
        e((i.stats || {}).proposals || 0) + ' proposals</b></div>' +
      '</div>';

    /* --- buttons -------------------------------------------------------- */
    var buttons = can
      ? '<div class="p9i-acts">' +
          '<button class="btn brass" data-act="p9i-test" data-sys="' + e(k) +
            '">Test connection</button>' +
          '<button class="btn" data-act="p9i-reset" data-sys="' + e(k) + '">Reset health</button>' +
          '<button class="btn" data-act="p9i-runqueue">Run queue</button>' +
          /* the failure path has to be reachable from the room, not the console:
             this is the switch that shows a red sync chip, the deep link and an
             A-15 while the approval ladder carries on regardless. */
          (h.health === 'failed'
            ? '<span class="p9-note alert">' + e(i.label || k) + ' is failing — new outbound ' +
              'operations queue and fail until the connector is reset.</span>'
            : '<button class="btn" data-act="p9i-fail" data-sys="' + e(k) +
              '">Simulate outage</button>') +
        '</div>'
      : '<p class="p9-note">Connectors are configured, tested and reconciled by the area ' +
        'office only. Everything above is read-only for your role.</p>';

    /* --- mapping table --------------------------------------------------- */
    var mapRows = (i.mapping || []).map(function (m) {
      return row([
        td('<b>' + e(m.portal_field) + '</b>'),
        td(e(m.ext_field)),
        td(pill(m.direction, m.direction === 'read' ? 'verd'
              : (m.direction === 'write' ? 'brass' : ''))),
        td(e(m.note || '—'), 'dim')
      ]);
    });

    var mapping = mapRows.length
      ? U.table([{ label: 'Portal field' }, { label: 'External field' },
                 { label: 'Direction' }, { label: 'Note' }], mapRows)
      : '<div class="p9-empty">No field mapping recorded for this system.</div>';

    return U.card(i.label || k,
        cfg + msgBlock(state) + err(state, 'integrations') + buttons,
        { cls: 'p9i-card' }) +
      U.card('Field mapping', mapping +
        '<p class="p9-note">“key” joins the two records, “read” means the external system is ' +
        'authoritative for that field, “write” means the portal is (S-03). The mapping is ' +
        'fixture-driven in the demo and is what a real driver would be built against.</p>') +
      (can ? simCard(state, k) + importCard(state, k) : '');
  }

  /* --------------------------------------------- simulate an inbound event -*/

  function simCard(state, k) {
    var open = state.projects.filter(function (p) { return p.status === 3; });
    var opts = open.map(function (p) {
      return '<option value="' + e(p.id) + '">' + e(p.id + ' · ' + p.name) + '</option>';
    }).join('');

    var body = open.length
      ? '<div class="p9i-form">' +
          '<label class="p9i-lab">Project<select class="sel" id="p9iProject">' + opts +
            '</select></label>' +
          '<label class="p9i-lab">System<input class="fld" type="text" value="' +
            e(D.integration(k).label || k) + '" disabled></label>' +
          '<label class="p9i-lab">Step<select class="sel" id="p9iStep">' +
            '<option value="submitted">submitted</option>' +
            '<option value="approved" selected>approved</option></select></label>' +
          '<label class="p9i-lab">Reference<input class="fld" type="text" id="p9iRef" ' +
            'placeholder="e.g. CHS-78110"></label>' +
          '<label class="p9i-lab">Event date<input class="fld num" type="date" id="p9iDate" ' +
            'value="' + e(CBP.CONFIG.TODAY) + '"></label>' +
          '<label class="p9i-lab">Confidence<select class="sel" id="p9iConf">' +
            '<option value="authoritative">authoritative</option>' +
            '<option value="advisory">advisory</option></select></label>' +
        '</div>' +
        '<div class="p9i-acts"><button class="btn brass" data-act="p9i-sim" data-sys="' + e(k) +
          '">Simulate inbound event</button></div>'
      : '<div class="p9-empty">No project is at status 3, so there is no open gate to ' +
        'simulate against.</div>';

    return U.card('Simulate an inbound event',
      body +
      '<p class="p9-note">The simulator stands in for the flow / REST drivers. What happens next ' +
      'is the mode’s business, not the simulator’s: in <b>Manual</b> and <b>Assisted</b> the ' +
      'event becomes a proposal for the Regional Manager to confirm in Approvals; in <b>Auto</b> ' +
      'an authoritative event writes the gate directly. An event that conflicts with a date the ' +
      'portal already holds always becomes a proposal.</p>');
  }

  /* ------------------------------------------------- reconciliation import -*/

  function importCard(state, k) {
    return U.card('Import a ' + e(D.integration(k).label || k) + ' export',
      '<label class="vh" for="p9iImport">Paste the export rows</label>' +
      '<textarea class="fld wide" id="p9iImport" rows="5" placeholder="Project ID' + '\t' +
        'Status' + '\t' + 'Approved date&#10;WE26NPL0010' + '\t' + 'Approved' + '\t' +
        '2026-08-20"></textarea>' +
      '<div class="p9i-acts"><button class="btn" data-act="p9i-import" data-sys="' + e(k) +
        '">Import export</button></div>' +
      '<p class="p9-note">Tab- or comma-separated. The header row must carry “Project ID” and ' +
      'either “Status” or an “Approved” / “Implementation” date column. An export is evidence, ' +
      'never authority: every matched row is raised as an <b>advisory</b> proposal, so a pasted ' +
      'spreadsheet can never write a gate on its own (F12).</p>');
  }

  /* ------------------------------------------------------- queue + log ---- */

  function queueCard(state) {
    var can = D.can(state.user, 'integrations');
    var rows = (state.syncQueue || []).slice().reverse().map(function (r) {
      return row([
        td('<b class="num">' + e(r.id) + '</b>'),
        td('<a href="#/project/' + e(r.project_id) + '">' + e(r.project_id) + '</a>'),
        td(e((D.integration(r.system).label || r.system))),
        td(e(r.op)),
        td(statusPill(r.status)),
        td(String(r.attempts), 'r num'),
        td(e(D.fmtDateY(r.at)), 'dim'),
        td(e(r.err || '—'), 'dim'),
        td(r.status === 'failed' && can
          ? '<button class="btn sm" data-act="p9i-retry" data-id="' + e(r.id) + '">Retry</button>'
          : '', 'r')
      ]);
    });

    return U.card('Sync queue — newest first',
      (rows.length
        ? U.table([{ label: 'Operation' }, { label: 'Project' }, { label: 'System' },
                   { label: 'Op' }, { label: 'Status' }, { label: 'Attempts', right: true },
                   { label: 'Queued' }, { label: 'Error' }, { label: '', right: true }], rows)
        : '<div class="p9-empty">The outbound queue is empty. Approving a request at Process 3 ' +
          'in Assisted or Auto mode lodges one operation per system.</div>') +
      '<p class="p9-note">A failed operation never blocks the approval ladder: it raises A-15, ' +
      'shows a red chip beside the gate with the deep link, and waits here to be retried. After ' +
      e(String(CBP.CONFIG.SYNC_RETRY_MAX)) + ' attempts the connector has to be reset first.</p>');
  }

  function logCard(state) {
    var f = state.ui.p9IntFilter;
    var all = (state.gateEvents || []).slice().reverse();
    var shown = all.filter(function (x) { return f === 'all' || x.system === f; });

    var chips = [{ k: 'all', label: 'All systems' }]
      .concat(CBP.CONFIG.GATE_SYSTEMS.map(function (s) { return { k: s.key, label: s.label }; }))
      .map(function (c) {
        var n = c.k === 'all' ? all.length
              : all.filter(function (x) { return x.system === c.k; }).length;
        return '<button class="chip' + (f === c.k ? ' on' : '') + '" data-act="p9i-filter" ' +
          'data-sys="' + e(c.k) + '">' + e(c.label) + ' <span class="n num">' + n + '</span></button>';
      }).join('');

    var rows = shown.slice(0, 60).map(function (x) {
      return row([
        td('<span class="num">' + e(D.fmtDateY(x.at)) + '</span>'),
        td('<a href="#/project/' + e(x.project_id) + '">' + e(x.project_id) + '</a>'),
        td(e(D.integration(x.system).label || x.system)),
        td(e(x.step)),
        td(pill(x.source, x.source === 'manual' ? '' : 'brass')),
        td(e(x.confidence), 'dim'),
        td(e(x.ref || '—'), 'dim num'),
        td(e(x.actor ? CBP.userName(x.actor) : 'system'), 'dim')
      ]);
    });

    return U.card('Gate event log — newest first',
      '<div class="p9-chips">' + chips + '</div>' +
      (rows.length
        ? U.table([{ label: 'Date' }, { label: 'Project' }, { label: 'System' },
                   { label: 'Step' }, { label: 'Source' }, { label: 'Confidence' },
                   { label: 'Reference' }, { label: 'Recorded by' }], rows)
        : '<div class="p9-empty">No gate event under this filter.</div>') +
      '<p class="p9-note">Append-only (S-02). Every manual click lands here beside every inbound ' +
      'event, which is what makes “who said CHaS approved?” a question the record can answer. ' +
      (shown.length > 60 ? 'Showing the 60 most recent of ' + shown.length + '. ' : '') +
      'The gate itself still lives in one place — p.gate — and this log only says how it got ' +
      'there (S-01).</p>');
  }

  function integrationsTab(state) {
    ensureUi(state);
    var k = state.ui.p9IntSys;
    var props = (state.gateProposals || []).filter(function (r) { return r.status === 'open'; });

    var head = '<div class="p9i-head">' +
      '<span>Two gate systems and two supporting services. ' +
      (props.length
        ? '<b>' + props.length + ' proposal' + (props.length === 1 ? '' : 's') +
          '</b> are waiting for a Regional Manager in <a href="#/approvals">Approvals</a>.'
        : 'No sync proposal is waiting for confirmation.') +
      '</span></div>';

    return head +
      '<div class="p9i">' + rail(state) +
        '<div class="p9i-body">' +
          (isGate(k) ? gateCard(state, k) : serviceCard(k)) +
        '</div>' +
      '</div>' +
      queueCard(state) + logCard(state);
  }

  /* ================================================ delegated listener ====
     Registered ONCE at load. Every act is namespaced 'p9i-' so it can never
     collide with the HANDLERS map in actions.js (which is frozen) or with the
     other pages' listeners. One mutation, one CBP.render(). */

  function v(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function note(state, text, ok) {
    state.ui.p9IntMsg = { text: text, ok: ok !== false };
  }

  function onP9() {
    return CBP.state && CBP.state.ui && CBP.state.ui.route === 'admin' &&
           CBP.state.ui.p9Tab === 'integrations';
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (!act || act.indexOf('p9i-') !== 0) return;

    var state = CBP.state;
    var sys = t.getAttribute('data-sys');
    var res;

    if (act === 'p9i-sys') {
      state.ui.p9IntSys = sys;
      state.ui.p9IntMsg = null;
      state.ui.err = null;

    } else if (act === 'p9i-filter') {
      state.ui.p9IntFilter = sys;

    } else if (act === 'p9i-mode') {
      res = CBP.actions.integrationSet(sys, 'mode', t.getAttribute('data-m'));
      if (res.ok) note(state, D.integration(sys).label + ' is now in ' +
        modeLabel(t.getAttribute('data-m')) + ' mode.');

    } else if (act === 'p9i-endpoint') {
      res = CBP.actions.integrationSet(sys, 'endpoint_masked', v('p9iEndpoint'));
      if (res.ok) note(state, 'Endpoint saved.');

    } else if (act === 'p9i-deeplink') {
      res = CBP.actions.integrationSet(sys, 'deep_link_template', v('p9iLink'));
      if (res.ok) note(state, 'Deep-link template saved — every gate surface now uses it.');

    } else if (act === 'p9i-secret') {
      res = CBP.actions.integrationSet(sys, 'secret_set', !D.integration(sys).secret_set);
      if (res.ok) note(state, res.value
        ? 'Secret recorded as set. The demo never stores the value itself.'
        : 'Secret cleared.');

    } else if (act === 'p9i-test') {
      res = CBP.actions.integrationTest(sys);
      note(state, res.msg, res.ok);

    } else if (act === 'p9i-fail') {
      res = CBP.actions.integrationSet(sys, 'health', 'failed');
      if (res.ok) {
        note(state, D.integration(sys).label + ' is now simulating an outage. Anything the ' +
          'portal lodges from here fails and raises A-15 — the approval ladder is not blocked, ' +
          'and Reset health puts it back.', false);
      }

    } else if (act === 'p9i-reset') {
      res = CBP.actions.integrationReset(sys);
      if (res.ok) note(state, D.integration(sys).label +
        ' reset — health ok, failed counter cleared. Queued operations can be retried.');

    } else if (act === 'p9i-runqueue') {
      /* A.runQueue reports counts, not a flag: its `ok` IS the number of
         operations that went through, so it is read as a count here. */
      res = CBP.actions.runQueue();
      note(state, 'Queue run: ' + (res.ran || 0) + ' operation' +
        ((res.ran || 0) === 1 ? '' : 's') + ' attempted, ' + (res.ok || 0) + ' ok, ' +
        (res.failed || 0) + ' failed.', !res.failed);

    } else if (act === 'p9i-retry') {
      res = CBP.actions.retrySync(t.getAttribute('data-id'));
      if (!res.error) {
        note(state, 'Operation retried: ' + (res.ok || 0) + ' ok, ' + (res.failed || 0) +
          ' failed.', !res.failed);
      }

    } else if (act === 'p9i-sim') {
      res = CBP.actions.simInbound(sys, v('p9iProject'), v('p9iStep'), {
        ref: v('p9iRef') || null,
        at: v('p9iDate') || CBP.CONFIG.TODAY,
        confidence: v('p9iConf')
      });
      if (res.ok) {
        note(state, res.proposed
          ? 'Event received — raised as proposal ' + res.id +
            '. The Regional Manager confirms it in Approvals.'
          : (res.unchanged
              ? 'Event received — the portal already holds that date, so nothing changed.'
              : 'Event received and written straight onto the gate (Auto mode).'));
      }

    } else if (act === 'p9i-import') {
      res = CBP.actions.importExcel(sys, v('p9iImport'));
      if (res.ok) {
        note(state, 'Import read: ' + res.matched + ' matched, ' + res.proposals +
          ' proposal' + (res.proposals === 1 ? '' : 's') + ' raised, ' + res.ignored + ' ignored' +
          (res.unchanged ? ', ' + res.unchanged + ' already recorded' : '') + '.');
      }

    } else if (act === 'p9i-threshold') {
      var raw = v('p9Threshold');
      var n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
      if (!D.can(state.user, 'integrations')) {
        state.ui.err = { key: 'integrations', msg: 'Thresholds are set by the area office only.' };
      } else if (isNaN(n) || n < 0) {
        state.ui.err = { key: 'integrations', msg: 'Enter the threshold as a whole number of USD.' };
      } else if (n === CBP.CONFIG.CONTRACT_THRESHOLD_USD) {
        state.ui.err = { key: 'integrations', msg: 'Nothing changed.' };
      } else {
        var was = CBP.CONFIG.CONTRACT_THRESHOLD_USD;
        CBP.CONFIG.CONTRACT_THRESHOLD_USD = n;
        state.ui.err = null;
        CBP.addLog(null, 'system', CBP.userName(state.user.id) +
          ' set the Corporate Agreement threshold — ' + D.money(was) + ' → ' + D.money(n) +
          '. Projects at or above it need an agreement sent out before implementation.');
      }

    } else {
      return;
    }

    ev.preventDefault();
    ev.stopImmediatePropagation();
    CBP.render();
  });

  /* the driver select is a change, not a click */
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-act') !== 'p9i-driver') return;
    var sys = t.getAttribute('data-sys');
    var res = CBP.actions.integrationSet(sys, 'driver', t.value);
    if (res.ok) {
      note(CBP.state, D.integration(sys).label + ' now talks over the ' + t.value + ' driver.');
    }
    CBP.render();
  });

  /* keep the linter's eye on it: the tab guard is used by the smoke walk only */
  CBP.p9 = CBP.p9 || {};
  CBP.p9.onIntegrations = onP9;

})();
