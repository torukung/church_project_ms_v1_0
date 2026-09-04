/* pages/p8.js — Alert centre, route #/alerts (build-plan item 7).
   Four surfaces: the outbox that stands in for real sending, the A-01…A-21 rule
   catalogue with per-rule on/off, the C-14 template editor with a live preview
   (A-08 and every v1.1.0 rule fully editable), and the RD-2 director exception
   digest.

   Nothing here sends anything: state.outbox is filled by CBP.actions during the
   demo walk and this page only renders it. The digest is built from
   CBP.W.exceptionSet(), the same derivation behind the P2 attention widget, so
   the two can never disagree about a number.

   Managing templates and rules is Admin-only (docs/01 permission matrix); every
   other persona gets the sent log and the digest for their own data scope. */
(function () {
  'use strict';

  var D = CBP.D, U = CBP.ui, W = CBP.W, e = CBP.ui.esc;
  CBP.pages = CBP.pages || {};

  /* ------------- A-01…A-14 from docs/05, A-15…A-21 added in v1.1.0 -------- */
  var RULES = [
    { id: 'A-01', trigger: 'Request submitted (4→3) by M2', to: 'M1, owner',
      timing: 'Immediate', kind: 'Approval stage' },
    { id: 'A-02', trigger: 'Request approved by M1 — gate opens',
      to: 'M2, owner — with a prompt to lodge in Decision Point & CHaS',
      timing: 'Immediate', kind: 'Approval stage' },
    { id: 'A-03', trigger: 'Return to Review', to: 'M2, owner',
      timing: 'Immediate', kind: 'Approval stage' },
    { id: 'A-04', trigger: 'Reject — Declined', to: 'M2, owner, M1 copy',
      timing: 'Immediate', kind: 'Approval stage' },
    { id: 'A-05', trigger: 'Gate updated — DP or CHaS marked submitted / approved',
      to: 'Owner, M2', timing: 'Immediate', kind: 'Approval stage' },
    { id: 'A-06', trigger: 'Gate idle — submitted to a system, no approval recorded',
      to: 'M1, M2, owner', timing: 'At 90 d, repeating every 30 d', kind: 'Delay' },
    { id: 'A-07', trigger: 'Both gates ✓ but status still 3',
      to: 'M1 — prompt to Mark Approved', timing: 'Next morning, then weekly',
      kind: 'Follow-up' },
    { id: 'A-08', trigger: 'Stage threshold exceeded — any status',
      to: 'Owner, backup, M1', timing: 'Per-stage threshold (Admin), repeating 30 d',
      kind: 'Delay (D-11)', editable: true },
    { id: 'A-09', trigger: 'Target date approaching', to: 'Owner, backup',
      timing: '14 d and 3 d before', kind: 'Targeted date' },
    { id: 'A-10', trigger: 'Target date passed, not at status 1', to: 'Owner, backup, M2',
      timing: 'Day after, then weekly', kind: 'Delay' },
    { id: 'A-11', trigger: 'Project closed / completed', to: 'Owner, M1, M2',
      timing: 'Immediate', kind: 'Project closed' },
    { id: 'A-12', trigger: 'Question assigned to you', to: 'Assignee',
      timing: 'Immediate', kind: 'Task' },
    { id: 'A-13', trigger: 'Country coverage crosses 100%', to: 'M2, M1, Admin',
      timing: 'Immediate, once per year per country', kind: 'Budget visibility' },
    { id: 'A-14', trigger: 'Weekly digest', to: 'Per user preference',
      timing: 'Monday 07:00 local', kind: 'Digest' },

    /* v1.1.0 · F1 EGC — the two rules the connector raises */
    { id: 'A-15', trigger: 'Sync failed — outbound op to CHaS / Decision Point failed after retries',
      to: 'Admin, M1', timing: 'Immediate', kind: 'Integration', editable: true },
    { id: 'A-16', trigger: 'Gate proposal awaiting confirmation',
      to: 'M1', timing: 'Immediate', kind: 'Integration', editable: true },

    /* v1.1.0 · F2 Corporate Agreement — the five rules of the contract gate */
    { id: 'A-17', trigger: 'Corporate Agreement drafting required — project Marked Approved',
      to: 'Owner, M2', timing: 'Immediate', kind: 'Contract', editable: true },
    { id: 'A-18', trigger: 'Contract review due — OGC / Finance',
      to: 'Reviewer', timing: 'At submit, then at the review SLA', kind: 'Contract', editable: true },
    { id: 'A-19', trigger: 'Signature due',
      to: 'Signatory', timing: 'At signing start, then at the signature SLA',
      kind: 'Contract', editable: true },
    { id: 'A-20', trigger: 'Contract idle 14 d',
      to: 'Owner, M2', timing: 'Derived, repeating', kind: 'Contract', editable: true },
    { id: 'A-21', trigger: 'Agreement sent out — Implementation may start',
      to: 'Owner, M1, M2', timing: 'Immediate', kind: 'Contract', editable: true }
  ];

  /* ids CBP.actions emits that sit outside the numbered catalogue */
  var SYSTEM_RULES = {
    'SYS-approved': 'Marked Approved 3 → 2 — resolves the A-07 prompt',
    'SYS-implementation': 'Implementation started 2 → 1',
    /* v1.2.0 — the four contract system lines (audit F13); all immediate */
    'SYS-contract-returned': 'Corporate Agreement returned by a reviewer',
    'SYS-contract-cleared': 'Corporate Agreement cleared review — approved for signature',
    'SYS-contract-executed': 'Corporate Agreement executed — all signatures in',
    'SYS-contract-declined': 'Corporate Agreement declined'
  };
  /* v1.2.0 — bucket per rule from CONFIG (T-12); SYS-* are always immediate.
     CATALOGUE_ONLY rows are never raised by any code path (F12). */
  function bucketOf(id) {
    if (/^SYS-/.test(id)) return 'immediate';
    return (CBP.CONFIG.ALERT_BUCKET || {})[id] || 'immediate';
  }
  function catalogueOnly(id) { return (CBP.CONFIG.ALERT_CATALOGUE_ONLY || []).indexOf(id) > -1; }
  RULES.forEach(function (r) { r.bucket = bucketOf(r.id); r.raised = !catalogueOnly(r.id); });

  var TOKENS = [
    { t: '{{project.id}}',   d: 'record id' },
    { t: '{{project.name}}', d: 'project name' },
    { t: '{{country}}',      d: 'country name' },
    { t: '{{days}}',         d: 'days in the current stage' },
    { t: '{{owner}}',        d: 'owner name' },
    { t: '{{threshold}}',    d: 'stage threshold in days' },
    /* v1.1.0 — the EGC and Corporate Agreement merge fields. Same double-brace
       grammar as every token above, so one merge() serves the whole palette. */
    { t: '{{system}}',       d: 'external system name' },
    { t: '{{source}}',       d: 'how the portal learned it' },
    { t: '{{ref}}',          d: 'external reference number' },
    { t: '{{contract_no}}',  d: 'Corporate Agreement number' },
    { t: '{{division}}',     d: 'reviewing division' },
    { t: '{{signer}}',       d: 'the signatory now due' }
  ];

  var DEFAULT_TPL = {
    subject: '{{project.id}} has been at this stage for {{days}} days',
    body: 'Hello {{owner}},\n\n' +
      '{{project.name}} ({{project.id}}, {{country}}) has now been at its current stage for ' +
      '{{days}} days, past the {{threshold}}-day threshold for this stage.\n\n' +
      'Please review the record and move it on, or record why it is held.\n\n' +
      'Open the project: #/project/{{project.id}}'
  };

  /* v1.1.0 — one editable template per new rule, in the same shape. The editor
     picks which rule it is editing; A-08 stays the one it opens on. */
  var TEMPLATES = {
    'A-08': DEFAULT_TPL,

    'A-15': {
      subject: '[Sync failed] {{project.id}} — {{system}} did not answer',
      body: 'The portal could not reach {{system}} for {{project.name}} ({{project.id}}, ' +
        '{{country}}).\n\nNothing is blocked: the approval ladder does not depend on the ' +
        'connector. Record the step directly in {{system}} using the deep link on the project, ' +
        'and retry the operation from Administration › Integrations once the connector is ' +
        'healthy again.\n\nOpen the project: #/project/{{project.id}}'
    },
    'A-16': {
      subject: '{{system}} reported a gate step on {{project.id}} — please confirm',
      body: 'Hello,\n\n{{system}} reported a gate step for {{project.name}} ({{project.id}}, ' +
        '{{country}}), learned {{source}}, reference {{ref}}.\n\nThe portal has not written it ' +
        'onto the gate: in this mode an inbound event waits for you. Confirm it in Approvals to ' +
        'record it with its own date and source, or dismiss it with a reason.\n\n' +
        'Open Approvals: #/approvals'
    },
    'A-17': {
      subject: '{{project.id}} is approved — the Corporate Agreement is now needed',
      body: 'Hello {{owner}},\n\n{{project.name}} ({{project.id}}, {{country}}) has been marked ' +
        'approved, so agreement {{contract_no}} has been opened as a draft.\n\nImplementation ' +
        'cannot start until the agreement has been reviewed, signed and sent out. Please ' +
        'complete the draft and submit it for review.\n\nOpen Contracts: #/contracts'
    },
    'A-18': {
      subject: '{{division}} review due — {{contract_no}} ({{project.id}})',
      body: 'Hello,\n\nAgreement {{contract_no}} for {{project.name}} ({{project.id}}, ' +
        '{{country}}) is waiting on the {{division}} review.\n\nOGC and Finance review in ' +
        'parallel: a return sends the agreement back to draft with your comment, which is ' +
        'mandatory.\n\nOpen Contracts: #/contracts'
    },
    'A-19': {
      subject: 'Signature due — {{contract_no}} ({{project.id}})',
      body: 'Hello {{signer}},\n\nAgreement {{contract_no}} for {{project.name}} ' +
        '({{project.id}}, {{country}}) has been approved for signature and is waiting on you.\n\n' +
        'Signatures are taken in order, and only within your signing authority for this amount ' +
        'and country.\n\nOpen Contracts: #/contracts'
    },
    'A-20': {
      subject: '{{contract_no}} has not moved for {{days}} days',
      body: 'Hello {{owner}},\n\nNothing has moved on agreement {{contract_no}} for ' +
        '{{project.name}} ({{project.id}}, {{country}}) for {{days}} days.\n\n' +
        'While it is unsent, {{project.id}} cannot start implementation. Please move it on, or ' +
        'record on the project why it is held.\n\nOpen Contracts: #/contracts'
    },
    'A-21': {
      subject: '{{contract_no}} has been sent out — {{project.id}} may start',
      body: 'Hello,\n\nAgreement {{contract_no}} for {{project.name}} ({{project.id}}, ' +
        '{{country}}) has been sent out to the partner, so the contract gate is met and ' +
        'implementation may now be started by the Regional Manager.\n\n' +
        'Open the project: #/project/{{project.id}}'
    }
  };

  var TABS = [
    { k: 'outbox', label: 'Sent log' },
    { k: 'rules',  label: 'Rule catalogue' },
    { k: 'tpl',    label: 'Template editor', admin: true },
    { k: 'digest', label: 'Director digest' }
  ];

  /* --------------------------------------------------------- page state -- */

  function ensure(state) {
    var s = state.ui.p8;
    if (!s) {
      s = state.ui.p8 = {
        tab: 'outbox',
        ruleFilter: 'all',
        on: {},
        tpls: {},             /* rule id → { subject, body } */
        tplRule: 'A-08',      /* which rule the editor is open on */
        field: 'body',        /* which editor field last held the caret */
        caret: null,          /* and where in it — token insertion needs this */
        saved: false,
        open: {}              /* outbox entry index → expanded */
      };
    }

    /* F22 — every call fills the ids it does not yet hold, so a rule added in a
       later pack (A-15…A-21 in this one) defaults ON and carries its template
       without a state migration. An id switched off by hand stays off.

       The two maps are re-established here rather than only at creation: a
       ui.p8 that arrives from anywhere else — a demo script setting
       {tab:'digest'}, a future store seed — must not be able to make the
       catalogue throw on the first rule it reads. */
    if (!s.on || typeof s.on !== 'object') s.on = {};
    if (!s.tpls || typeof s.tpls !== 'object') s.tpls = {};
    if (typeof s.tab !== 'string') s.tab = 'outbox';
    if (typeof s.ruleFilter !== 'string') s.ruleFilter = 'all';
    if (!s.open || typeof s.open !== 'object') s.open = {};
    if (!s.tplRule) s.tplRule = 'A-08';

    RULES.forEach(function (r) {
      if (s.on[r.id] === undefined) s.on[r.id] = true;
      if (!s.tpls[r.id] && TEMPLATES[r.id]) {
        s.tpls[r.id] = { subject: TEMPLATES[r.id].subject, body: TEMPLATES[r.id].body };
      }
    });
    if (!TEMPLATES[s.tplRule]) s.tplRule = 'A-08';
    return s;
  }

  /* the template the editor is currently on */
  function tplOf(s) {
    s.tpls[s.tplRule] = s.tpls[s.tplRule] ||
      { subject: TEMPLATES[s.tplRule].subject, body: TEMPLATES[s.tplRule].body };
    return s.tpls[s.tplRule];
  }

  function isAdmin(user) { return D.can(user, 'manageUsers'); }

  function tabsFor(user) {
    return TABS.filter(function (t) { return !t.admin || isAdmin(user); });
  }

  /* ============================================================== render == */

  CBP.pages.alerts = function (state) {
    var s = ensure(state);
    var user = state.user;
    var admin = isAdmin(user);
    var tabs = tabsFor(user);
    if (!tabs.filter(function (t) { return t.k === s.tab; }).length) s.tab = tabs[0].k;

    var codes = D.visibleCountries(user, state.countries);
    var mine = visibleOutbox(state, codes, admin);

    var html = '<div class="p8-page">';

    html += '<div class="crumb">Alerts · ' +
      e(admin ? 'Area office' : 'Your scope') + ' · ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + '</div>';

    html += '<div class="pagehead"><h1>Alert centre</h1>' +
      '<span class="sub">' + e(W.plural(mine.length, 'alert')) + ' in this session · ' +
      RULES.length + ' rules' + (admin ? '' : ' · read-only') + '</span></div>';

    html += '<div class="p8-tabs" role="tablist">' + tabs.map(function (t) {
      return '<button class="p8-tab' + (t.k === s.tab ? ' on' : '') +
        '" role="tab" aria-selected="' + (t.k === s.tab) +
        '" data-p8="tab" data-k="' + e(t.k) + '">' + e(t.label) + '</button>';
    }).join('') + '</div>';

    if (s.tab === 'outbox') html += outbox(state, s, mine, admin);
    else if (s.tab === 'rules') html += catalogue(state, s, admin);
    else if (s.tab === 'tpl') html += editor(state, s);
    else html += digest(state, codes);

    return html + '</div>';
  };

  /* ============================================== (a) outbox / sent log === */

  /* an alert belongs to a persona's log when its project sits in their scope;
     Admin sees everything, including anything not tied to a project */
  function visibleOutbox(state, codes, admin) {
    return (state.outbox || []).map(function (m, i) {
      return { m: m, i: i };
    }).filter(function (x) {
      if (admin) return true;
      var p = x.m.project ? CBP.projectById(x.m.project) : null;
      return p ? codes.indexOf(p.country) > -1 : false;
    }).reverse();                                   /* newest first */
  }

  function ruleLabel(id) {
    var r = RULES.filter(function (x) { return x.id === id; })[0];
    if (r) return r.id + ' · ' + r.kind;
    return id + (SYSTEM_RULES[id] ? ' · system' : '');
  }

  /* the bucket a sent row belongs to — written by A.send, defaulted here for a
     row that predates the field so an old snapshot still renders */
  function rowBucket(m) {
    if (m.bucket) return m.bucket;
    return bucketOf(m.rule);
  }

  /* T-12 — an immediate mail carries its own action buttons when the call site
     passed them. Where it did not, P8 DERIVES the obvious ones from the rule:
     this is rendering, not sending — nothing here writes to state, and the
     buttons are links to the recipient's own home, never a second action path. */
  var DEFAULT_ACTIONS = {
    'A-01': [{ label: 'Approve', act: 'ask-approve' }, { label: 'Return', act: 'p6r-return' }],
    'A-16': [{ label: 'Confirm', act: 'p6x-confirm' }],
    'A-18': [{ label: 'Review', act: 'p6x-open-contract' }],
    'A-19': [{ label: 'Sign', act: 'p6x-open-contract' }]
  };

  function actionsOf(m) {
    if (m.actions && m.actions.length) return m.actions;
    if (rowBucket(m) !== 'immediate' || !m.project) return [];
    var id = m.focus_id || m.project;
    return (DEFAULT_ACTIONS[m.rule] || []).map(function (a) {
      return { label: a.label, act: a.act, id: id };
    });
  }

  /* F4 — #/home/<id> is the only routable deep link (a query string is not in
     the hash), and it is a real anchor: one click lands the persona on their
     own home with the row already focused. */
  function actionBar(m) {
    var acts = actionsOf(m);
    if (!acts.length) return '';
    return '<div class="p8-macts">' + acts.map(function (a, i) {
      return '<a class="btn sm' + (i === 0 ? ' brass' : '') + '" data-p8="mailact" href="#/home/' +
        e(a.id) + '">' + e(a.label) + '</a>';
    }).join('') + '<span class="p8-mnote">opens the recipient\'s home with this row in view</span>' +
      '</div>';
  }

  function deliveryChip(m) {
    var b = rowBucket(m);
    var delivered = m.delivered !== false;
    return '<span class="p8-bchip b-' + e(b) + (delivered ? '' : ' queued') + '">' +
      e(b === 'digest' ? (delivered ? 'digest · delivered' : 'digest · queued')
                       : (delivered ? 'immediate' : 'immediate · queued')) + '</span>';
  }

  /* T-12 · F21 — the digest is folded by the clock (A.advanceDay) or by hand,
     here, and nowhere else: a render path must never send anything. The control
     lives ON the sent log, which is the surface it changes. */
  function digestControl(state, admin) {
    if (!admin) return '';
    var queued = (state.digestQueue || []).length;
    return '<div class="p8-drun">' +
      '<button class="btn" data-p8="digest-run">Run daily digest</button>' +
      '<span class="p8-qn">' + (queued
        ? e(W.plural(queued, 'queued line')) + ' waiting — folding them writes one ' +
          e(CBP.CONFIG.DIGEST_RULE) + ' mail per person and moves no clock'
        : 'Nothing queued right now. Digest rules queue as they are raised; ' +
          'Advance day on Admin › Data folds them on its own.') + '</span></div>';
  }

  function outbox(state, s, rows, admin) {
    if (!rows.length) {
      return U.card('Sent log', digestControl(state, admin) +
        '<div class="p8-empty"><b>No alerts yet in this session</b>' +
        '<span>Actions in this session generate alerts — submit a request, tick an ' +
        'external gate or assign a question, and every send lands here. ' +
        'Demo sends render to this outbox, never to real mail.</span></div>');
    }

    /* filter chips carry only the rules that actually fired */
    var seen = [];
    rows.forEach(function (x) { if (seen.indexOf(x.m.rule) === -1) seen.push(x.m.rule); });
    seen.sort();

    var chips = '<div class="p8-chips"><button class="chip' +
      (s.ruleFilter === 'all' ? ' on' : '') + '" data-p8="rulefilter" data-r="all">All' +
      ' <span class="n">' + rows.length + '</span></button>' +
      seen.map(function (id) {
        var n = rows.filter(function (x) { return x.m.rule === id; }).length;
        return '<button class="chip' + (s.ruleFilter === id ? ' on' : '') +
          '" data-p8="rulefilter" data-r="' + e(id) + '">' + e(id) +
          ' <span class="n">' + n + '</span></button>';
      }).join('') + '</div>';

    var shown = rows.filter(function (x) {
      return s.ruleFilter === 'all' || x.m.rule === s.ruleFilter;
    });

    function mailRow(x) {
      var m = x.m, open = !!s.open[x.i];
      /* the folded A-14 row spans projects and carries project: null (F33) */
      var p = m.project ? CBP.projectById(m.project) : null;
      var head = '<button class="p8-mailhd" data-p8="mail" data-i="' + x.i +
        '" aria-expanded="' + open + '">' +
        /* the capsule is a fixed width, so a system id shortens to SYS and
           spells itself out in the expanded row and in the filter chips */
        '<span class="p8-rule" title="' + e(ruleLabel(m.rule)) + '">' +
        e(SYSTEM_RULES[m.rule] ? 'SYS' : m.rule) + '</span>' +
        '<span class="p8-mailtx"><b>' + e(m.subject) + '</b>' +
        '<span>' + e((m.to && m.to.length ? m.to.join(', ') : 'no recipient — no owner set') +
          (p ? ' · ' + W.countryName(state, p.country) : '') +
          ' · ' + D.fmtDateY(m.at)) + '</span></span>' +
        deliveryChip(m) +
        '<span class="p8-chev">' + (open ? '▴' : '▾') + '</span></button>';

      var body = open
        ? '<div class="p8-mail">' +
            '<div class="p8-meta"><span>Rule</span><b>' + e(ruleLabel(m.rule)) + '</b></div>' +
            '<div class="p8-meta"><span>Bucket</span><b>' + e(rowBucket(m)) +
              (m.delivered === false ? ' · queued for the daily digest' : ' · delivered') +
              '</b></div>' +
            '<div class="p8-meta"><span>To</span><b>' +
              e(m.to && m.to.length ? m.to.join(', ') : '—') +
              (m.to_ids && m.to_ids.length
                ? ' <small>(' + e(m.to_ids.join(', ')) + ')</small>' : '') + '</b></div>' +
            (p ? '<div class="p8-meta"><span>Project</span><b><a href="#/project/' +
                 e(p.id) + '">' + e(p.id + ' · ' + p.name) + '</a></b></div>'
               : '<div class="p8-meta"><span>Project</span><b>several — one line per record ' +
                 'in the body</b></div>') +
            '<div class="p8-meta"><span>Subject</span><b>' + e(m.subject) + '</b></div>' +
            '<pre class="p8-body">' + e(m.body) + '</pre>' +
            actionBar(m) +
          '</div>'
        : '';

      return '<div class="p8-row' + (open ? ' open' : '') + '">' + head + body + '</div>';
    }

    /* T-12 — grouped by bucket, so what was sent the moment it happened and
       what waited for the digest read as two different things on the page. */
    var GROUPS = [
      { k: 'immediate', label: 'Sent immediately',
        note: 'Raised and delivered in the same pass.' },
      { k: 'digest', label: 'Daily digest',
        note: 'Queued when raised; folded into one ' + CBP.CONFIG.DIGEST_RULE +
              ' mail per person by Run daily digest or Advance day.' }
    ];

    var list = GROUPS.map(function (g) {
      var mine = shown.filter(function (x) { return rowBucket(x.m) === g.k; });
      if (!mine.length) return '';
      var nq = mine.filter(function (x) { return x.m.delivered === false; }).length;
      return '<div class="p8-bgroup"><h4>' + e(g.label) +
        '<span class="n num">' + mine.length + '</span>' +
        (nq ? '<span class="p8-bchip b-' + e(g.k) + ' queued">' + nq + ' queued</span>' : '') +
        '<small>' + e(g.note) + '</small></h4>' +
        '<div class="p8-list">' + mine.map(mailRow).join('') + '</div></div>';
    }).join('');

    return U.card('Sent log — newest first',
      digestControl(state, admin) + chips +
      (shown.length ? list
                    : '<div class="p8-empty"><b>Nothing under this rule</b></div>') +
      '<p class="p8-note">Demo sends render here rather than to real mail. Every send also ' +
      'writes a System entry on the project naming its recipients, so email never becomes ' +
      'the only record. A 24-hour dedupe guard applies per rule, project and recipient.</p>');
  }

  /* =========================================== (b) rule catalogue A-01…14 = */

  function catalogue(state, s, admin) {
    var body = RULES.map(function (r) {
      var on = s.on[r.id] !== false;
      var toggle = admin
        ? '<button class="p8-toggle' + (on ? ' on' : '') + '" data-p8="rule" data-r="' +
          e(r.id) + '" role="switch" aria-checked="' + on + '">' +
          '<span class="p8-knob"></span><span class="p8-state">' +
          (on ? 'On' : 'Off') + '</span></button>'
        : '<span class="p8-state ' + (on ? 'ison' : 'isoff') + '">' +
          (on ? 'On' : 'Off') + '</span>';

      /* p8-nw is what keeps "A-01" on one line — the id is a capsule of text in
         a fixed-width column, never a wrapping phrase (v1.0.3 defect fix) */
      /* F12 — a rule that no code path raises is marked as such rather than
         quietly listed beside the eight that fire. */
      return '<tr' + (r.raised ? '' : ' class="p8-cat"') + '>' +
        '<td class="p8-id num p8-nw">' + e(r.id) + '</td>' +
        '<td class="p8-trig">' + e(r.trigger) +
        (r.editable ? ' <span class="p8-tag">template editable</span>' : '') +
        (r.raised ? '' : ' <span class="p8-tag p8-only">catalogue only — not raised ' +
          'in this demo</span>') + '</td>' +
        '<td class="p8-to">' + e(r.to) + '</td>' +
        '<td class="p8-when">' + e(r.timing) + '</td>' +
        '<td class="p8-nw p8-buck"><span class="p8-bchip b-' + e(r.bucket) + '">' +
          e(r.bucket) + '</span></td>' +
        '<td class="p8-kind">' + e(r.kind) + '</td>' +
        '<td class="r p8-stat">' + toggle + '</td></tr>';
    }).join('');

    var offs = RULES.filter(function (r) { return s.on[r.id] === false; }).length;

    /* built here rather than through U.table: the heads carry the same width
       classes as their cells, which is what pins the column balance */
    var head = '<tr><th class="p8-nw">#</th><th class="p8-trig">Trigger</th>' +
      '<th class="p8-to">Recipients</th><th class="p8-when">Timing</th>' +
      '<th class="p8-nw p8-buck">Bucket</th>' +
      '<th class="p8-kind">Type</th><th class="r p8-stat">Status</th></tr>';

    return U.card('Alert rules — A-01 to A-' + RULES[RULES.length - 1].id.slice(2),
      '<div class="tblwrap"><table class="tbl"><thead>' + head +
      '</thead><tbody>' + body + '</tbody></table></div>' +
      '<p class="p8-note">' +
      (admin ? 'Switching a rule off stops it firing for this demo session. '
             : 'Only Admin can switch a rule on or off (docs/01 permission matrix). ') +
      'Every rule is a templated email with merge tokens; a <b>24-hour dedupe guard</b> ' +
      'runs per rule, project and recipient, so a repeating rule cannot flood one inbox. ' +
      (offs ? offs + ' rule' + (offs === 1 ? ' is' : 's are') + ' currently off. ' : '') +
      'A-14 carries the weekly digest machinery that RD-2 extends; A-15 and A-16 belong to the ' +
      'external gate connector, and A-17 to A-21 to the Corporate Agreement. ' +
      'The <b>bucket</b> is a property of the RULE, not of the recipient: an immediate rule ' +
      'is delivered the moment it is raised, a digest rule waits in the queue and is folded ' +
      'into one ' + CBP.CONFIG.DIGEST_RULE + ' mail per person at ' +
      CBP.CONFIG.DIGEST_HOUR + ':00 (T-12).</p>');
  }

  /* ================================= (c) C-14 template editor — one rule == */

  /* the sample record every preview renders against */
  function sample(state) {
    return CBP.projectById('WE26BGD0002') || state.projects[0];
  }

  /* per-stage threshold behind A-08 (D-11) */
  function threshold(p) {
    if (p.status === 3) return CBP.CONFIG.REVIEW_THRESHOLD_DAYS;
    if (p.status === 2) return CBP.CONFIG.KICKOFF_THRESHOLD_DAYS;
    return CBP.CONFIG.GATE_THRESHOLD_DAYS;
  }

  /* token values are DERIVED from the record, never typed in */
  function values(state, p) {
    /* v1.1.0 — the EGC and contract fields come from the same derivations the
       pages read, so a preview cannot promise a value the mail would not carry */
    var sys = CBP.CONFIG.GATE_SYSTEMS[1] || CBP.CONFIG.GATE_SYSTEMS[0];
    var src = D.gateSource ? (D.gateSource(p, sys.key, 'approved') ||
                              D.gateSource(p, sys.key, 'submitted')) : null;
    var c = D.primaryContract ? D.primaryContract(p) : null;
    var next = (c && CBP.contracts && CBP.contracts.nextSignatory)
      ? CBP.contracts.nextSignatory(c) : null;

    return {
      '{{project.id}}': p.id,
      '{{project.name}}': p.name,
      '{{country}}': W.countryName(state, p.country),
      '{{days}}': String(D.daysInStage(p)),
      '{{owner}}': p.owner ? CBP.userName(p.owner) : 'unassigned',
      '{{threshold}}': String(threshold(p)),
      '{{system}}': (D.integration ? (D.integration(sys.key).label || sys.label) : sys.label),
      '{{source}}': src ? ('from a ' + src.source + ' event') : 'from a manual entry',
      '{{ref}}': (p.refs || {})[sys.ref_field || sys.key] ||
                 (src && src.ref) || 'not recorded yet',
      '{{contract_no}}': c ? c.id : 'no agreement yet',
      '{{division}}': (CBP.CONFIG.REVIEW_DIVISIONS[0] || {}).label || 'OGC',
      '{{signer}}': next
        ? (next.user_id ? CBP.userName(next.user_id) : (next.name || 'the next signatory'))
        : 'the next signatory'
    };
  }

  function merge(tpl, vals) {
    var out = String(tpl || '');
    Object.keys(vals).forEach(function (k) {
      out = out.split(k).join(vals[k]);
    });
    return out;
  }

  function editor(state, s) {
    var p = sample(state);
    var vals = values(state, p);
    var rule = RULES.filter(function (r) { return r.id === s.tplRule; })[0] || RULES[7];
    var tpl = tplOf(s);

    /* v1.1.0 — eight rules now ship a template, so the editor names which one
       it is on rather than hard-coding A-08 in its own heading. */
    var picker = '<div class="p8-chips">' + RULES.filter(function (r) {
        return !!TEMPLATES[r.id];
      }).map(function (r) {
        return '<button class="chip' + (s.tplRule === r.id ? ' on' : '') +
          '" data-p8="tplrule" data-r="' + e(r.id) + '">' + e(r.id) + '</button>';
      }).join('') + '</div>';

    var palette = '<div class="p8-tokens">' + TOKENS.map(function (t) {
      return '<button class="p8-token" data-p8="token" data-t="' + e(t.t) + '" title="' +
        e(t.d + ' — ' + vals[t.t]) + '">' + e(t.t) + '</button>';
    }).join('') + '</div>';

    var form =
      '<div class="p8-field"><label for="p8subject">Subject</label>' +
      '<input id="p8subject" class="p8-input" type="text" data-p8="tpl" data-f="subject" ' +
      'autocomplete="off" value="' + e(tpl.subject) + '"></div>' +
      '<div class="p8-field"><label for="p8body">Body</label>' +
      '<textarea id="p8body" class="p8-input p8-area" rows="10" data-p8="tpl" ' +
      'data-f="body">' + e(tpl.body) + '</textarea></div>' +
      '<div class="p8-acts">' +
        '<button class="btn brass" data-p8="save">Save template</button>' +
        '<button class="btn" data-p8="reset">Reset to default</button>' +
        (s.saved ? '<span class="p8-saved">Saved — ' + e(s.tplRule) +
          ' previews use this template.</span>' : '') +
      '</div>';

    var preview =
      '<div class="p8-prev">' +
        '<div class="p8-prevhd"><span>To</span><b>' +
          e(previewRecipients(state, p)) + '</b></div>' +
        '<div class="p8-prevhd"><span>Subject</span><b>' +
          e(merge(tpl.subject, vals)) + '</b></div>' +
        '<pre class="p8-body">' + e(merge(tpl.body, vals)) + '</pre>' +
      '</div>';

    var others = RULES.filter(function (r) { return !TEMPLATES[r.id]; }).map(function (r) {
      return '<li><b>' + e(r.id) + '</b><span>' + e(r.trigger) + '</span>' +
        '<em>editable in full product</em></li>';
    }).join('');

    return '<div class="p8-editor">' +
      U.card('Template editor',
        '<div class="p8-flabel">Rule</div>' + picker +
        '<p class="p8-lead"><b>' + e(rule.id) + '</b> · ' + e(rule.trigger) +
        ' · recipients ' + e(rule.to) + ' · ' + e(rule.timing) + '</p>' +
        '<div class="p8-flabel">Token palette — click to insert at the caret</div>' +
        palette + form) +
      U.card('Live preview — rendered against ' + p.id,
        '<p class="p8-lead">Every token below is substituted with this record’s real derived ' +
        'values as they stand on ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) + '.</p>' +
        preview +
        '<div class="p8-vals">' + TOKENS.map(function (t) {
          return '<div class="p8-meta"><span>' + e(t.t) + '</span><b>' +
            e(vals[t.t]) + '</b></div>';
        }).join('') + '</div>') +
      U.card('Every other rule',
        '<ul class="p8-others">' + others + '</ul>' +
        '<p class="p8-note">The demo ships the approval-threshold rule and every v1.1.0 rule ' +
        '(A-15 to A-21) fully editable. The rest use the same token palette and the same live ' +
        'preview in the full product.</p>') +
      '</div>';
  }

  /* A-08 goes to owner, backup and the country's M1 — de-duplicated, because
     the backup and the Regional Manager are often the same person */
  function previewRecipients(state, p) {
    var names = [p.owner, p.backup].filter(Boolean).map(CBP.userName);
    names.push(recipientM1(state, p));
    var seen = {}, out = [];
    names.forEach(function (n) { if (n && !seen[n]) { seen[n] = 1; out.push(n); } });
    return out.join(', ') || 'unassigned';
  }

  function recipientM1(state, p) {
    var m1 = state.users.filter(function (u) {
      if (u.role !== 'm1') return false;
      var sc = W.userCountries(u);
      return sc === null || sc.indexOf(p.country) > -1;
    })[0];
    return m1 ? m1.name : 'Regional Manager';
  }

  /* ================================= (d) RD-2 director exception digest === */

  function digest(state, codes) {
    var ctx = W.ctx(state, codes);
    var x = W.exceptionSet(ctx);
    var user = state.user;

    /* group each section by country so a director reads it queue by queue */
    var order = codes.slice();
    function group(items) {
      var by = {};
      items.forEach(function (i) { (by[i.country] = by[i.country] || []).push(i); });
      return order.filter(function (c) { return by[c]; })
        .map(function (c) { return { code: c, name: W.countryName(state, c), items: by[c] }; });
    }

    /* F10 · S-15 (audit D-1) — the footer and the lead are derived from what
       was actually BUILT, never from a hard-coded "of 4". The four v1.0.4
       groups are always weighed; a v1.1.0 group joins the tally only when it
       has something to say, so on a quiet week this mail reads exactly as it
       did in v1.0.4, down to the byte. */
    var CONSIDERED = [
      'over-ceiling countries',
      'gate items past threshold',
      'overdue reviews',
      'unowned projects'
    ];
    var sections = [];

    if (x.over.length) {
      sections.push({
        title: 'Countries over their ' + CBP.CONFIG.BUDGET_YEAR + ' ceiling',
        n: x.over.length,
        groups: group(x.over).map(function (g) {
          return { name: g.name, lines: g.items.map(function (i) {
            return { lead: D.pct(i.coverage) + ' of ceiling', tone: 'hot',
                     text: i.text, href: '#/budget' };
          }) };
        })
      });
    }

    if (x.gate.length) {
      sections.push({
        title: 'External gate items past the ' + CBP.CONFIG.GATE_THRESHOLD_DAYS + '-day threshold',
        n: x.gate.length,
        groups: group(x.gate).map(function (g) {
          return { name: g.name, lines: g.items.map(function (i) {
            return { lead: D.days(i.days), tone: 'hot',
                     text: i.project.id + ' · ' + i.project.name + ' — ' + i.text,
                     href: '#/project/' + i.project.id };
          }) };
        })
      });
    }

    if (x.overdue.length) {
      sections.push({
        title: 'Overdue reviews',
        n: x.overdue.length,
        groups: group(x.overdue).map(function (g) {
          return { name: g.name, lines: g.items.map(function (i) {
            return { lead: D.days(i.days), tone: 'hot',
                     text: i.project.id + ' · ' + i.project.name + ' — ' + i.text,
                     href: '#/project/' + i.project.id };
          }) };
        })
      });
    }

    if (x.unowned.length) {
      sections.push({
        title: 'Projects without an owner',
        n: x.unowned.length,
        groups: group(x.unowned).map(function (g) {
          return { name: g.name, lines: g.items.map(function (i) {
            /* a status is not an exception magnitude — it stays neutral */
            return { lead: CBP.CONFIG.STATUS[i.project.status].short, tone: '',
                     text: i.project.id + ' · ' + i.project.name + ' — ' + x.unownedText,
                     href: '#/project/' + i.project.id };
          }) };
        })
      });
    }

    /* F11 · S-15 — the two v1.1.0 groups. They are built HERE, from state, and
       never extend W.exceptionSet (that derivation is the P2 attention widget's
       and is byte-identical to v1.0.4 on the v1.0.4 fixture set). Each counts
       only when it is non-empty, exactly like the four above. */

    var failed = (state.syncQueue || []).filter(function (r) {
      if (r.status !== 'failed') return false;
      var p = CBP.projectById(r.project_id);
      return p && codes.indexOf(p.country) > -1;
    }).map(function (r) {
      var p = CBP.projectById(r.project_id);
      var sys = D.integration ? (D.integration(r.system).label || r.system) : r.system;
      return { country: p.country, project: p, row: r, system: sys };
    });

    if (failed.length) {
      CONSIDERED.push('failed synchronisations');
      sections.push({
        title: 'Failed synchronisations',
        n: failed.length,
        groups: group(failed).map(function (g) {
          return { name: g.name, lines: g.items.map(function (i) {
            return { lead: i.row.attempts + ' of ' + CBP.CONFIG.SYNC_RETRY_MAX, tone: 'hot',
                     text: i.project.id + ' · ' + i.project.name + ' — ' + i.system +
                           ' could not ' + i.row.op.replace(/_/g, ' ') +
                           '. The ladder is not blocked; record it by hand and retry.',
                     href: '#/project/' + i.project.id };
          }) };
        })
      });
    }

    var idle = (D.contractsFor && D.contractIdle)
      ? D.contractsFor().filter(function (c) {
          return codes.indexOf(c.country) > -1 && D.contractIdle(c);
        }).map(function (c) {
          var p = CBP.projectById(c.project_id);
          return { country: c.country, contract: c, project: p, days: D.contractAge(c) };
        })
      : [];

    if (idle.length) {
      CONSIDERED.push('idle Corporate Agreements');
      sections.push({
        title: 'Corporate Agreements with no movement for ' +
               CBP.CONFIG.CONTRACT_IDLE_DAYS + ' days',
        n: idle.length,
        groups: group(idle).map(function (g) {
          return { name: g.name, lines: g.items.map(function (i) {
            var st = (CBP.CONFIG.CONTRACT_STATUS[i.contract.status] || {}).label ||
                     i.contract.status;
            return { lead: D.days(i.days), tone: 'hot',
                     text: i.contract.id + ' · ' + (i.project ? i.project.id + ' ' : '') +
                           (i.contract.partner || '') + ' — ' + st +
                           ', and implementation waits until it is sent out.',
                     href: '#/contracts' };
          }) };
        })
      });
    }

    var scopeText = codes.length === state.countries.length
      ? 'all ' + codes.length + ' seeded countries'
      : codes.map(function (c) { return W.countryName(state, c); }).join(', ');

    var mail = sections.length
      ? sections.map(function (sec) {
          return '<section class="p8-sec" data-sec="' + e(sec.title) + '">' +
            '<h4>' + e(sec.title) + ' <span class="num">' + sec.n + '</span></h4>' +
            sec.groups.map(function (g) {
              return '<div class="p8-grp"><b>' + e(g.name) + '</b>' +
                g.lines.map(function (l) {
                  return '<a class="p8-line" href="' + e(l.href) + '">' +
                    '<span class="p8-lead2 num' + (l.tone ? ' hot' : '') + '">' +
                    e(l.lead) + '</span>' +
                    '<span>' + e(l.text) + '</span></a>';
                }).join('') + '</div>';
            }).join('') + '</section>';
        }).join('')
      : '<div class="p8-quiet"><b>A quiet week</b><span>No exception in ' + e(scopeText) +
        ' — every section was omitted, so this digest would not be sent.</span></div>';

    var subject = sections.length
      ? 'Exceptions for ' + scopeText + ' — week to ' + D.fmtDateY(CBP.CONFIG.TODAY)
      : 'No exceptions for ' + scopeText + ' — week to ' + D.fmtDateY(CBP.CONFIG.TODAY);

    return U.card('RD-2 · Director exception digest — preview',
      '<p class="p8-lead">Weekly, Monday 07:00, per director scope. Exceptions only — ' +
      e(CONSIDERED.slice(0, -1).join(', ') + ' and ' + CONSIDERED[CONSIDERED.length - 1]) +
      '. Empty sections are omitted, so a quiet week is a short email.</p>' +
      '<div class="p8-digest">' +
        '<div class="p8-prevhd"><span>To</span><b>' + e(user.name) + ' · ' +
          e(CBP.CONFIG.ROLE_LABEL[user.role]) + '</b></div>' +
        '<div class="p8-prevhd"><span>Scope</span><b>' + e(scopeText) + '</b></div>' +
        '<div class="p8-prevhd"><span>Subject</span><b>' + e(subject) + '</b></div>' +
        '<div class="p8-digestbody">' + mail + '</div>' +
        '<p class="p8-foot">' + e(sections.length + ' of ' + CONSIDERED.length +
          ' sections carried content; ' + (CONSIDERED.length - sections.length) +
          ' omitted. A record already listed at the external gate is not repeated under ' +
          'overdue reviews.') + '</p>' +
      '</div>' +
      '<p class="p8-note">Built on A-14’s digest machinery with a scope filter, from the same ' +
      'derived exception set as the dashboard’s attention widget — the numbers here and there ' +
      'are one calculation, not two.</p>');
  }

  /* ==================================================== event wiring ====== */

  function on8() {
    return CBP.state && CBP.state.ui && CBP.state.ui.route === 'alerts' && CBP.state.ui.p8;
  }

  function closest(node, sel) {
    return (node && node.closest) ? node.closest(sel) : null;
  }

  document.addEventListener('click', function (ev) {
    if (!on8()) return;
    var state = CBP.state, s = state.ui.p8;
    var t = closest(ev.target, '[data-p8]');
    if (!t) return;
    var act = t.getAttribute('data-p8');

    if (act === 'tab') {
      ev.preventDefault();
      s.tab = t.getAttribute('data-k');
      CBP.render();

    } else if (act === 'digest-run') {
      /* F21 — the ONLY places A.runDigest is called are A.advanceDay and this
         button. It folds the queue without moving the clock. */
      ev.preventDefault();
      if (!isAdmin(state.user)) return;
      CBP.actions.runDigest();
      CBP.render();

    } else if (act === 'mailact') {
      /* a real anchor: let it navigate. The hash sets ui.focusId, the home page
         scrolls the row into view (F4/F28) — one click, no interception. */
      return;

    } else if (act === 'rulefilter') {
      ev.preventDefault();
      s.ruleFilter = t.getAttribute('data-r');
      CBP.render();

    } else if (act === 'mail') {
      ev.preventDefault();
      var i = t.getAttribute('data-i');
      s.open[i] = !s.open[i];
      CBP.render();

    } else if (act === 'rule') {
      ev.preventDefault();
      if (!isAdmin(state.user)) return;
      var id = t.getAttribute('data-r');
      s.on[id] = s.on[id] === false;
      CBP.render();

    } else if (act === 'token') {
      ev.preventDefault();
      insertToken(s, t.getAttribute('data-t'));

    } else if (act === 'save') {
      ev.preventDefault();
      s.saved = true;
      CBP.render();

    } else if (act === 'reset') {
      ev.preventDefault();
      var def = TEMPLATES[s.tplRule] || DEFAULT_TPL;
      s.tpls[s.tplRule] = { subject: def.subject, body: def.body };
      s.saved = false;
      CBP.render();

    } else if (act === 'tplrule') {
      ev.preventDefault();
      s.tplRule = t.getAttribute('data-r');
      s.saved = false;
      s.caret = null;
      CBP.render();
    }
  });

  /* typing in either field re-renders the preview in the same single pass, then
     puts the caret back where it was — the pattern app.js uses for search */
  document.addEventListener('input', function (ev) {
    if (!on8()) return;
    var t = ev.target;
    if (!t || !t.getAttribute || t.getAttribute('data-p8') !== 'tpl') return;
    var s = CBP.state.ui.p8;
    var f = t.getAttribute('data-f');
    var caret = t.selectionStart;
    tplOf(s)[f] = t.value;
    s.field = f;
    s.saved = false;
    CBP.render();
    restore(f, caret);
  });

  document.addEventListener('focusin', function (ev) {
    if (!on8()) return;
    var t = ev.target;
    if (t && t.getAttribute && t.getAttribute('data-p8') === 'tpl') {
      CBP.state.ui.p8.field = t.getAttribute('data-f');
      snap();
    }
  });

  /* Remember where the caret is while it is still in a field. Clicking a token
     button moves focus to the button first, so by the time the click handler
     runs the selection is gone — mousedown fires before that blur, and keyup
     covers arrow keys and typing. */
  ['keyup', 'mouseup', 'select'].forEach(function (evt) {
    document.addEventListener(evt, function (ev) {
      if (!on8()) return;
      var t = ev.target;
      if (t && t.getAttribute && t.getAttribute('data-p8') === 'tpl') snap();
    });
  });

  document.addEventListener('mousedown', function (ev) {
    if (!on8()) return;
    if (closest(ev.target, '[data-p8="token"]')) snap();
  });

  function snap() {
    var s = CBP.state.ui.p8;
    var el = document.activeElement;
    if (!el || !el.getAttribute || el.getAttribute('data-p8') !== 'tpl') return;
    s.field = el.getAttribute('data-f');
    try { s.caret = el.selectionStart; } catch (err) { s.caret = null; }
  }

  function fieldEl(f) {
    return document.getElementById(f === 'subject' ? 'p8subject' : 'p8body');
  }

  function restore(f, caret) {
    var el = fieldEl(f);
    if (!el) return;
    el.focus();
    try { el.setSelectionRange(caret, caret); } catch (err) { /* older engines */ }
  }

  /* a token lands at the remembered caret of whichever field was last focused */
  function insertToken(s, token) {
    var f = s.field === 'subject' ? 'subject' : 'body';
    var tpl = tplOf(s);
    var cur = tpl[f] || '';
    var at = (typeof s.caret === 'number' && s.caret >= 0 && s.caret <= cur.length)
      ? s.caret : cur.length;
    tpl[f] = cur.slice(0, at) + token + cur.slice(at);
    s.caret = at + token.length;
    s.saved = false;
    CBP.render();
    restore(f, s.caret);
  }

})();
