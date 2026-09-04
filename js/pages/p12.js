/* pages/p12.js — v1.1.0 · P12 Contracts (WP4).
   The Corporate Agreement section at #/contracts, CT1…CT6 from the pre-design,
   re-based on the real state machine in js/contracts.js.

   Routing (F6): readHash keeps route + param only, so the hash is
   `#/contracts` or `#/contracts/AS-0143` and everything else is a VIEW held in
   ui.p12View ('list' | 'detail' | 'sign' | 'templates' | 'signatures' | 'new').
   ui.p12Id remembers which agreement is in focus; it is added at runtime here
   rather than in store.js, which this WP does not own.

   House rules kept: vanilla ES5 in an IIFE, every function returns a string,
   no Date.now (clocks from CONFIG.TODAY through derive.js), permissions only
   through D.can / D.canContract, ONE delegated listener for the whole 'p12-*'
   namespace registered once at load, and exactly one CBP.render() per action.

   Two exports are consumed by p4.js (WP2): CBP.p12.headerChip(p, state) and
   CBP.p12.projectTab(p, state). Both are pure string builders and both are safe
   to call for a project that has no agreement at all. */
(function () {
  'use strict';

  var D = CBP.D, U = CBP.ui, A = CBP.actions, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};
  CBP.p12 = CBP.p12 || {};
  var P12 = CBP.p12;

  function S()   { return CBP.state; }
  function UI()  { return CBP.state.ui; }
  function CFG() { return CBP.CONFIG; }
  function CT()  { return CBP.contracts || {}; }
  function me()  { return CBP.state.user; }

  /* ===================================================== small grammar === */

  function countryName(code) {
    var c = (S().countries || []).filter(function (x) { return x.code === code; })[0];
    return c ? c.name : code;
  }

  /* the contract status pill — same C-13 anatomy as U.statusPill, tone from
     CONFIG.CONTRACT_STATUS so the two ladders can never drift apart */
  function ctPill(status) {
    var row = CFG().CONTRACT_STATUS[status] ||
              { label: status || 'unknown', tone: 's4' };
    return '<span class="pill p-' + e(row.tone) + '"><span class="dot"></span>' +
           e(row.label) + '</span>';
  }

  /* flag + name, tinted with the C-21 country identity */
  function ccChip(code) {
    return '<span class="p12-cc ' + U.ccOf(code) + '">' + U.flagMark(code) +
           e(countryName(code)) + '</span>';
  }

  function userName(id) { return id ? CBP.userName(id) : 'unassigned'; }

  function money(n) { return D.money(n || 0); }

  function dateY(iso) { return iso ? D.fmtDateY(iso) : '—'; }

  function empty(msg) { return '<div class="p12-empty">' + e(msg) + '</div>'; }

  function note(msg) { return '<p class="pagenote">' + e(msg) + '</p>'; }

  function btn(label, act, opts) {
    opts = opts || {};
    return '<button class="btn' + (opts.brass ? ' brass' : '') + (opts.sm ? ' sm' : '') +
      '" data-act="' + e(act) + '"' +
      (opts.id ? ' data-id="' + e(opts.id) + '"' : '') +
      (opts.data ? dataAttrs(opts.data) : '') +
      (opts.disabled ? ' disabled' : '') + '>' + e(label) + '</button>';
  }

  function dataAttrs(map) {
    return Object.keys(map).map(function (k) {
      return ' data-' + e(k) + '="' + e(map[k]) + '"';
    }).join('');
  }

  function divisionLabel(key) {
    var d = CFG().REVIEW_DIVISIONS.filter(function (x) { return x.key === key; })[0];
    return d ? d.label : key;
  }

  function templateById(id) {
    return (S().contractTemplates || []).filter(function (t) { return t.id === id; })[0] || null;
  }

  /* the error strip: contracts.js writes {key, msg} into ui.err on refusal */
  function errStrip() {
    var err = UI().err;
    if (!err || !err.msg) return '';
    return '<div class="p12-err" role="alert">' + e(err.msg) + '</div>';
  }

  /* ============================================ CT1 · the stage stepper ===
     draft → review → signature → signing → executed → sent, six dots that read
     at a glance in a table cell. Dead ends (cancelled/terminated/expired) drop
     the ladder and say so instead of pretending to be on it. */

  var STAGES = [
    { key: 'draft',     label: 'Draft' },
    { key: 'review',    label: 'Review' },
    { key: 'signature', label: 'Approved for signature' },
    { key: 'signing',   label: 'Signing' },
    { key: 'executed',  label: 'Executed' },
    { key: 'sent',      label: 'Sent out' }
  ];

  var STAGE_AT = {
    draft: 0, in_review: 1, approved_for_signature: 2, signing: 3,
    executed: 4, sent: 5, active: 5, amending: 5
  };

  var DEAD = { expired: 1, terminated: 1, cancelled: 1 };

  function miniStepper(c) {
    if (DEAD[c.status]) {
      return '<span class="p12-mini dead" title="' +
        e(CFG().CONTRACT_STATUS[c.status].label) + '">' +
        e(CFG().CONTRACT_STATUS[c.status].label) + '</span>';
    }
    var at = STAGE_AT[c.status];
    if (at === undefined) at = 0;
    /* the accessible name rides on the group itself (role="img" + aria-label)
       rather than on a visually-hidden child: a clipped 1px child is a real
       piece of clipped text on the page, and it says the same thing twice. */
    return '<span class="p12-mini" role="img" aria-label="' + e(stageTitle(at)) +
      '" title="' + e(stageTitle(at)) + '">' +
      STAGES.map(function (s, i) {
        var cls = i < at ? 'done' : (i === at ? 'now' : 'todo');
        return '<i class="' + cls + '" aria-hidden="true"></i>';
      }).join('') + '</span>';
  }

  function stageTitle(at) {
    return 'Stage ' + (at + 1) + ' of ' + STAGES.length + ' · ' + STAGES[at].label;
  }

  /* ============================================== next action + its owner ==
     One reader, used by the register column, the P4 tab and the widget, so the
     three can never name a different next step for the same agreement. */

  function nextAction(c) {
    var p = CBP.projectById(c.project_id);
    var owner = p && p.owner ? userName(p.owner) : 'the drafting team';

    if (c.status === 'draft') {
      return { label: 'Complete and submit for review', who: owner, due: null };
    }
    if (c.status === 'in_review') {
      var pend = (c.reviews || []).filter(function (r) { return r.status === 'pending'; });
      var due = null, over = false;
      pend.forEach(function (r) {
        var d = D.reviewDue(c, r.division);
        if (d && d.due_at && (!due || d.due_at < due)) due = d.due_at;
        if (d && d.overdue) over = true;
      });
      return {
        label: pend.map(function (r) { return divisionLabel(r.division) + ' review'; }).join(' · ') ||
               'Reviews complete',
        who: pend.map(function (r) { return userName(r.assignee); }).join(' · ') || '—',
        due: due, overdue: over
      };
    }
    if (c.status === 'approved_for_signature') {
      return { label: 'Start the signing ceremony', who: 'Regional Manager or Admin', due: null };
    }
    if (c.status === 'signing') {
      var next = CT().nextSignatory ? CT().nextSignatory(c) : null;
      var sd = D.signatureDue(c);
      return {
        label: next && next.party === 'partner' ? 'Record the partner signature' : 'Signature',
        who: next ? (next.user_id ? userName(next.user_id) : next.name) : '—',
        due: sd ? sd.due_at : null, overdue: !!(sd && sd.overdue)
      };
    }
    if (c.status === 'executed') {
      return { label: 'Send out and record the transmittal', who: owner, due: null };
    }
    if (c.status === 'sent')     return { label: 'Awaiting the countersigned copy', who: c.partner || '—', due: null };
    if (c.status === 'active')   return { label: 'In force', who: '—', due: c.end_date || null };
    if (c.status === 'amending') return { label: 'Amendment in progress', who: owner, due: null };
    return { label: CFG().CONTRACT_STATUS[c.status] ? CFG().CONTRACT_STATUS[c.status].label : '—',
             who: '—', due: null };
  }

  /* =============================================================== route ===
     The hash carries at most an id; the sub-view is state. Keeping the two in
     step here means a pasted deep link, a Back button and an in-page control
     all land on the same screen. */

  function syncRoute(state) {
    var u = state.ui;
    if (u.p12View === undefined || u.p12View === null) u.p12View = 'list';
    if (u.p12Id === undefined) u.p12Id = null;

    var param = u.param || null;
    if (param) {
      if (u.p12Id !== param) {
        u.p12Id = param;
        if (u.p12View !== 'sign') u.p12View = 'detail';
      }
      if (u.p12View !== 'detail' && u.p12View !== 'sign') u.p12View = 'detail';
      if (!D.contractById(param)) { u.p12View = 'list'; }
    } else {
      if (u.p12View === 'detail' || u.p12View === 'sign') u.p12View = 'list';
    }
    return u.p12View;
  }

  /* =============================================================== page ====*/

  CBP.pages.contracts = function (state) {
    var user = state.user;

    if (!D.can(user, 'contract_view')) {
      return '<div class="crumb">Contracts</div>' +
        '<div class="pagehead"><h1>Corporate agreements</h1></div>' +
        empty('Corporate agreements are not part of your role’s view.');
    }

    var view = syncRoute(state);
    var body;

    if (view === 'templates')       body = viewTemplates(state);
    else if (view === 'signatures') body = viewSignatures(state);
    else if (view === 'new')        body = viewWizard(state);
    else if (view === 'sign')       body = viewSign(state);
    else if (view === 'detail')     body = viewDetail(state);
    else                            body = viewList(state);

    return body + modal(state);
  };

  /* =========================================================== CT1 list ====*/

  function switcher(state, current) {
    var user = state.user;
    var items = [{ v: 'list', label: 'Register' }];
    if (D.can(user, 'contract_admin')) {
      items.push({ v: 'templates', label: 'Templates' });
      items.push({ v: 'signatures', label: 'Signature management' });
    }
    if (items.length === 1) return '';
    return '<div class="p12-switch" role="group" aria-label="Contracts views">' +
      items.map(function (i) {
        return '<button class="p12-sw' + (i.v === current ? ' on' : '') +
          '" data-act="p12-view" data-v="' + e(i.v) + '" aria-pressed="' +
          (i.v === current ? 'true' : 'false') + '">' + e(i.label) + '</button>';
      }).join('') + '</div>';
  }

  function matches(c, q) {
    if (!q) return true;
    var p = CBP.projectById(c.project_id);
    return [c.id, c.partner, c.project_id, p ? p.name : '', countryName(c.country),
            c.template_id, CFG().CONTRACT_STATUS[c.status] ? CFG().CONTRACT_STATUS[c.status].label : '']
      .filter(Boolean).join(' ').toLowerCase().indexOf(q) > -1;
  }

  function viewList(state) {
    var user = state.user;
    var all = D.contractsFor({ user: user });
    var codes = D.visibleCountries(user, state.countries);

    /* every code in scope carries a count, including the ones at zero — a chip
       with no number reads as a chip that has not been counted */
    var byCountry = {};
    codes.forEach(function (code) { byCountry[code] = 0; });
    all.forEach(function (c) { byCountry[c.country] = (byCountry[c.country] || 0) + 1; });

    var sel = U.selectedCodes(state, 'p12Countries', codes);
    var inSel = all.filter(function (c) { return sel.indexOf(c.country) > -1; });

    var byStatus = {};
    inSel.forEach(function (c) { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });

    var filter = state.ui.p12Filter || 'all';
    var q = (state.ui.p12Search || '').trim().toLowerCase();
    var shown = inSel.filter(function (c) {
      return (filter === 'all' || c.status === filter) && matches(c, q);
    });

    var owed = D.contractsRequiringAction(user);
    var scopeName = sel.length === state.countries.length
      ? 'Asia Area' : sel.map(countryName).join(' · ');

    var html = '<div class="crumb">Contracts · ' + e(scopeName) + '</div>' +
      '<div class="pagehead"><h1>Corporate agreements</h1>' +
      '<span class="sub num">' + all.length + ' agreement' + (all.length === 1 ? '' : 's') +
      ' in scope' + (owed.length ? ' · ' + owed.length + ' waiting on you' : '') + '</span>' +
      '<div class="sp">' + switcher(state, 'list') +
      (D.can(user, 'contract_submit')
        ? btn('New agreement', 'p12-view', { brass: true, data: { v: 'new' } }) : '') +
      '</div></div>';

    html += errStrip();

    html += U.countryChips({
      state: state, stateKey: 'p12Countries', actPrefix: 'p12',
      codes: codes, counts: byCountry, label: 'Countries',
      hint: sel.length === codes.length
        ? 'Showing every country in your scope.'
        : 'The status counts and the table below follow this selection.'
    });

    /* status chips — the whole CONTRACT_STATUS_ORDER, so a status with nothing
       in it still reads as a filter that exists rather than one that vanished */
    var chips = [{ f: 'all', label: 'All', n: inSel.length }];
    CFG().CONTRACT_STATUS_ORDER.forEach(function (k) {
      chips.push({ f: k, label: CFG().CONTRACT_STATUS[k].label, n: byStatus[k] || 0 });
    });
    html += '<div class="filters p12-filters">' + chips.map(function (c) {
      return '<button class="chip' + (filter === c.f ? ' on' : '') +
        (c.n ? '' : ' zero') + '" data-act="p12-filter" data-f="' + e(c.f) + '">' +
        e(c.label) + ' <span class="n num">' + c.n + '</span></button>';
    }).join('') +
      '<input class="search" id="p12search" type="search" data-act="p12-search" ' +
      'autocomplete="off" aria-label="Search agreements" ' +
      'placeholder="Search agreement, partner, project…" value="' +
      e(state.ui.p12Search || '') + '">' +
      '</div>';

    if (!shown.length) {
      html += empty(q
        ? 'No agreement matches “' + (state.ui.p12Search || '').trim() + '” in ' + scopeName + '.'
        : 'No agreement in ' + scopeName + ' sits at this status.');
    } else {
      html += '<div class="p12-tblwrap p12-cards"><table class="tbl p12-tbl"><thead><tr>' +
        '<th>Agreement</th><th>Project</th><th>Partner</th><th>Country</th>' +
        '<th class="r">Value</th><th>Status</th><th>Stage</th>' +
        '<th>Next action</th><th>Due</th><th class="r">Updated</th>' +
        '</tr></thead><tbody>' +
        shown.map(function (c) { return listRow(c); }).join('') +
        '</tbody></table></div>';
    }

    html += note('Every agreement above is scoped to your countries (' + codes.join(', ') +
      '). Day counts, due dates and the stage of each agreement are derived against ' +
      D.fmtDateY(CFG().TODAY) + ' at render time. A Corporate Agreement is required at or ' +
      'above ' + money(CFG().CONTRACT_THRESHOLD_USD) + ' and must reach “Sent out” before ' +
      'implementation can start.');

    return html;
  }

  function listRow(c) {
    var p = CBP.projectById(c.project_id);
    var na = nextAction(c);
    var moved = D.contractLastMove(c);
    var idle = D.contractIdle(c);

    return '<tr class="p12-row" data-act="p12-open" data-id="' + e(c.id) + '" tabindex="0">' +
      '<td><b class="num">' + e(c.id) + '</b>' +
        (c.parent_contract_id
          ? '<small class="p12-sub">amendment ' + e(c.amendment_no) + ' of ' +
            e(c.parent_contract_id) + '</small>'
          : '<small class="p12-sub">v' + e(c.version_no || 1) + ' · ' +
            e(c.template_id || 'no template') + '</small>') + '</td>' +
      '<td data-label="Project"><a href="#/project/' + e(c.project_id) + '">' +
        e(c.project_id) + '</a><small class="p12-sub">' + e(p ? p.name : '—') + '</small></td>' +
      '<td data-label="Partner">' + e(c.partner || 'to be named') +
        '<small class="p12-sub">' + e(c.partner_type || '—') + '</small></td>' +
      '<td data-label="Country">' + ccChip(c.country) + '</td>' +
      '<td class="r num" data-label="Value">' + e(money(c.amount_usd)) + '</td>' +
      '<td data-label="Status">' + ctPill(c.status) + '</td>' +
      '<td data-label="Stage">' + miniStepper(c) + '</td>' +
      '<td data-label="Next action">' + e(na.label) +
        '<small class="p12-sub">' + e(na.who) + '</small></td>' +
      '<td data-label="Due" class="' + (na.overdue ? 'p12-over' : '') + '">' +
        (na.due ? e(D.fmtDate(na.due)) + (na.overdue ? ' <b>overdue</b>' : '') : '—') + '</td>' +
      '<td data-label="Updated" class="r num' + (idle ? ' p12-over' : '') + '">' +
        (moved ? e(D.fmtDate(moved)) : '—') + '</td>' +
      '</tr>';
  }

  /* ========================================================= CT2 detail ====*/

  var TABS = [
    { k: 'document',    label: 'Document' },
    { k: 'details',     label: 'Details' },
    { k: 'reviews',     label: 'Reviews' },
    { k: 'signatures',  label: 'Signatures' },
    { k: 'obligations', label: 'Obligations' },
    { k: 'log',         label: 'Log' }
  ];

  function viewDetail(state) {
    var c = D.contractById(state.ui.p12Id);
    if (!c || !D.canContract(state.user, 'contract_view', c)) return viewList(state);
    var user = state.user, p = CBP.projectById(c.project_id);
    var tab = state.ui.p12Tab || 'document';
    if (!TABS.filter(function (t) { return t.k === tab; }).length) tab = 'document';

    var html = '<div class="crumb"><a href="#/contracts">Contracts</a> · ' + e(c.id) + '</div>';

    html += '<div class="pagehead"><h1>' + e(c.id) + '</h1>' +
      '<span class="sub">' + ctPill(c.status) + '</span>' +
      '<div class="sp">' + btn('Back to register', 'p12-back', {}) + '</div></div>';

    html += '<div class="p12-head">' +
      hf('Project', '<a href="#/project/' + e(c.project_id) + '">' + e(c.project_id) + '</a>' +
        (p ? ' · ' + e(p.name) : '')) +
      hf('Partner', e(c.partner || 'to be named') + ' · ' + e(c.partner_type || '—')) +
      hf('Value', '<span class="num">' + e(money(c.amount_usd)) + '</span>' +
        (c.currency && c.currency !== 'USD' ? ' (' + e(c.currency) + ')' : '')) +
      hf('Country', ccChip(c.country)) +
      hf('Version', 'v' + e(c.version_no || 1) +
        (c.parent_contract_id ? ' · amendment ' + e(c.amendment_no) + ' of ' +
          '<a href="#/contracts/' + e(c.parent_contract_id) + '">' + e(c.parent_contract_id) + '</a>' : '')) +
      hf('Last movement', e(dateY(D.contractLastMove(c))) +
        (D.contractIdle(c) ? ' <b class="p12-over">idle</b>' : '')) +
      '</div>';

    html += errStrip();
    html += actionBar(user, c);

    html += '<div class="p12-tabs" role="tablist">' + TABS.map(function (t) {
      return '<button class="p12-tab' + (t.k === tab ? ' on' : '') +
        '" data-act="p12-tab" data-t="' + e(t.k) + '" role="tab" aria-selected="' +
        (t.k === tab ? 'true' : 'false') + '">' + e(t.label) + '</button>';
    }).join('') + '</div>';

    html += '<div class="p12-body">';
    if (tab === 'document')         html += tabDocument(c, p);
    else if (tab === 'details')     html += tabDetails(c, user);
    else if (tab === 'reviews')     html += tabReviews(c, user);
    else if (tab === 'signatures')  html += tabSignatures(c, user);
    else if (tab === 'obligations') html += tabObligations(c, user);
    else                            html += tabLog(c);
    html += '</div>';

    return html;
  }

  function hf(label, value) {
    return '<div class="p12-hf"><span class="k">' + e(label) + '</span>' +
           '<span class="v">' + value + '</span></div>';
  }

  /* every control is asked of D.canContract; nothing role-checks inline */
  function actionBar(user, c) {
    var acts = [];
    var can = function (a) { return D.canContract(user, a, c); };

    if (can('contract_edit')) {
      acts.push(btn(UI().p12Edit ? 'Stop editing' : 'Edit', 'p12-edit', { id: c.id }));
      acts.push(btn('New version', 'p12-newver', { id: c.id }));
    }
    if (c.status === 'draft' && can('contract_submit')) {
      acts.push(btn('Submit for review', 'p12-submit', { id: c.id, brass: true }));
    }
    if (c.status === 'in_review' && can('contract_approve_sig')) {
      acts.push(btn('Approve for signature', 'p12-approve-sig', { id: c.id, brass: true }));
    }
    if (c.status === 'approved_for_signature' && can('contract_approve_sig')) {
      acts.push(btn('Start signing', 'p12-start-signing', { id: c.id, brass: true }));
    }
    if (c.status === 'signing' && can('contract_sign')) {
      acts.push(btn('Open signing ceremony', 'p12-open-sign', { id: c.id, brass: true }));
    }
    if (c.status === 'executed' && can('contract_send')) {
      acts.push(btn('Mark sent out', 'p12-mark-sent', { id: c.id, brass: true }));
    }
    if (c.status === 'sent' && can('contract_send')) {
      acts.push(btn('Activate', 'p12-activate', { id: c.id }));
    }
    if (can('contract_amend')) {
      acts.push(btn('Amend', 'p12-amend', { id: c.id }));
    }
    if (D.can(user, 'contract_submit') &&
        ['sent', 'active', 'amending', 'cancelled', 'terminated', 'expired'].indexOf(c.status) < 0) {
      acts.push(btn('Cancel', 'p12-cancel', { id: c.id }));
    }

    if (!acts.length) {
      return '<div class="p12-acts none">Nothing on this agreement is yours to act on right now.</div>';
    }
    return '<div class="p12-acts">' + acts.join('') + '</div>';
  }

  /* ---------------------------------------------------- tab · document --- */

  /* the merge map behind the rendered agreement — one place, so the Data Sheet
     and every clause read the same values */
  function tokensFor(c, p) {
    return {
      '{project_id}': c.project_id,
      '{project_name}': p ? p.name : '',
      '{partner}': c.partner || 'to be named',
      '{partner_type}': c.partner_type || 'local',
      '{country}': countryName(c.country),
      '{amount_usd}': money(c.amount_usd),
      '{currency}': c.currency || 'USD',
      '{decision_point_ref}': (p && p.refs && p.refs.decision_point) || 'not recorded',
      '{chas_ref}': (p && p.refs && p.refs.chas) || 'not recorded',
      '{chas_guid}': (p && p.chas_guid) || 'not recorded',
      '{start_date}': c.start_date ? D.fmtDateY(c.start_date) : 'on execution',
      '{end_date}': c.end_date ? D.fmtDateY(c.end_date) : 'on completion of the project',
      '{parent_contract_id}': c.parent_contract_id || '—',
      '{amendment_no}': String(c.amendment_no || 0),
      '{change_summary}': lastVersionSummary(c),
      '{agreement_id}': c.id,
      '{version_no}': String(c.version_no || 1)
    };
  }

  function lastVersionSummary(c) {
    var v = (c.versions || [])[(c.versions || []).length - 1];
    return v ? v.summary : '';
  }

  function merge(text, map) {
    return String(text).replace(/\{[a-z_]+\}/g, function (m) {
      return map[m] !== undefined ? map[m] : m;
    });
  }

  /* a short, honest body per clause — the demo renders an agreement, not a
     legal instrument, so every clause states what it governs and carries the
     merge fields that actually belong in it. */
  var CLAUSE_BODY = {
    'Purpose': 'This Agreement records the terms on which the Church supports {project_name} ' +
      '({project_id}) in {country} through {partner}.',
    'Reference to original agreement': 'This is amendment {amendment_no} to agreement ' +
      '{parent_contract_id} in respect of {project_id}.',
    'Amended terms': '{change_summary}',
    'Effect on budget': 'The agreed value of the original agreement is amended to {amount_usd}.',
    'Scope of work': 'The scope is the approved project record {project_id}, as recorded in ' +
      'Decision Point ({decision_point_ref}) and CHaS ({chas_ref}).',
    'Funding and disbursement': 'The Church will contribute up to {amount_usd} in {currency}, ' +
      'disbursed against the approved phase schedule.',
    'Funding and disbursement (tranches)': 'The Church will contribute up to {amount_usd} in ' +
      '{currency}, released in tranches against the approved phase schedule.',
    'Reporting': 'Narrative and financial reporting is due at each phase end and at closure, ' +
      'quoting {project_id}.',
    'Term and termination': 'The Agreement runs from {start_date} until {end_date} and may be ' +
      'terminated by either party on written notice.',
    'Signatures': 'Signed for the Church and for {partner} in the order recorded on the ' +
      'Signatures tab of {agreement_id}.'
  };

  function clauseBody(name, map) {
    var body = CLAUSE_BODY[name] ||
      ('The parties agree the standard ' + name.toLowerCase() +
       ' terms of the Church’s Corporate Agreement, version {version_no} of {agreement_id}.');
    return merge(body, map);
  }

  function tabDocument(c, p) {
    var tpl = templateById(c.template_id);
    var map = tokensFor(c, p);

    /* the Data Sheet: both external references, always, at the top (open item 3
       in the scaffold — settled "yes, both refs on the Data Sheet") */
    var sheet = '<div class="p12-sheet"><h3>Data Sheet</h3><div class="p12-sheetgrid">' +
      [['Agreement', c.id + ' · version ' + (c.version_no || 1)],
       ['Template', tpl ? tpl.name + ' · ' + tpl.version : (c.template_id || 'none chosen')],
       ['Project', c.project_id + (p ? ' · ' + p.name : '')],
       ['Country', countryName(c.country)],
       ['Partner', (c.partner || 'to be named') + ' · ' + (c.partner_type || '—')],
       ['Value', money(c.amount_usd) + ' ' + (c.currency || 'USD')],
       ['Decision Point reference', map['{decision_point_ref}']],
       ['CHaS reference', map['{chas_ref}']],
       ['Term', map['{start_date}'] + ' — ' + map['{end_date}']],
       ['Status', CFG().CONTRACT_STATUS[c.status] ? CFG().CONTRACT_STATUS[c.status].label : c.status]]
        .map(function (r) {
          return '<div class="p12-sf"><span class="k">' + e(r[0]) + '</span>' +
                 '<span class="v">' + e(r[1]) + '</span></div>';
        }).join('') + '</div></div>';

    if (!tpl) {
      return '<article class="p12-doc">' + sheet +
        empty('No template is attached to this agreement yet — choose one on the Details tab ' +
              'and the clause set appears here.') + '</article>';
    }

    var clauses = (tpl.clauses || []).map(function (name, i) {
      return '<section class="p12-clause"><h4><span class="num">' + (i + 1) + '.</span> ' +
        e(name) + '</h4><p>' + e(clauseBody(name, map)) + '</p></section>';
    }).join('');

    var tokens = (tpl.tokens || []).map(function (t) {
      return '<span class="p12-token"><b>' + e(t) + '</b>' +
        e(map[t] !== undefined ? map[t] : 'no value') + '</span>';
    }).join('');

    return '<article class="p12-doc">' + sheet +
      '<div class="p12-docbody">' +
        '<h3>' + e(tpl.name) + '</h3>' +
        '<p class="p12-lead">' + e(merge('Between the Church and {partner} in respect of ' +
          '{project_name} ({project_id}), {country}. Value {amount_usd}.', map)) + '</p>' +
        clauses +
      '</div>' +
      (tokens ? '<div class="p12-tokens"><h4>Merge fields</h4>' + tokens + '</div>' : '') +
      '</article>';
  }

  /* ----------------------------------------------------- tab · details --- */

  var ATTESTATIONS = [
    { k: 'supplements_local',   label: 'The support supplements, and does not replace, local resources' },
    { k: 'no_dependency',       label: 'The support does not create long-term dependency' },
    { k: 'not_primary_support', label: 'The Church is not the partner’s primary source of support' },
    { k: 'partner_verified',    label: 'The partner organisation has been verified' }
  ];

  function tabDetails(c, user) {
    var editable = D.canContract(user, 'contract_edit', c) && !!UI().p12Edit;
    var canEdit = D.canContract(user, 'contract_edit', c);
    var att = c.attestations || {};
    var scr = c.screening || {};
    var gaps = CT().draftGaps ? CT().draftGaps(c) : [];

    var dis = editable ? '' : ' disabled';

    var html = '<div class="p12-form">';

    html += '<div class="p12-fgrid">' +
      field('Partner', '<input class="inp" id="p12Partner" value="' + e(c.partner || '') + '"' + dis + '>') +
      field('Partner type', select('p12PartnerType',
        [['un', 'UN agency'], ['ingo', 'International NGO'], ['local', 'Local partner']],
        c.partner_type, dis)) +
      field('Value (USD)', '<input class="inp num" id="p12Amount" type="number" value="' +
        e(c.amount_usd || 0) + '"' + dis + '>') +
      field('Currency', '<input class="inp" id="p12Currency" value="' + e(c.currency || 'USD') + '"' + dis + '>') +
      field('Template', select('p12Template',
        (S().contractTemplates || []).map(function (t) { return [t.id, t.name]; }),
        c.template_id, dis)) +
      field('Due diligence', select('p12DueDiligence',
        [['pending', 'Pending'], ['verified', 'Verified'], ['failed', 'Failed']],
        c.due_diligence, dis)) +
      field('Screening date', '<input class="inp" id="p12ScreenDate" type="date" value="' +
        e(scr.date || '') + '"' + dis + '>') +
      field('Screening result', select('p12ScreenResult',
        [['pending', 'Pending'], ['clear', 'Clear'], ['hit', 'Hit — escalate']],
        scr.result, dis)) +
      '</div>';

    html += '<fieldset class="p12-atts"><legend>Attestations</legend>' +
      ATTESTATIONS.map(function (a) {
        return '<label class="p12-check"><input type="checkbox" id="p12Att_' + e(a.k) + '"' +
          (att[a.k] ? ' checked' : '') + dis + '><span>' + e(a.label) + '</span></label>';
      }).join('') + '</fieldset>';

    if (editable) {
      html += '<div class="p12-formacts">' +
        btn('Save details', 'p12-save', { id: c.id, brass: true }) +
        btn('Cancel', 'p12-edit-cancel', {}) + '</div>';
    } else if (canEdit) {
      html += '<div class="p12-formacts">' + btn('Edit', 'p12-edit', { id: c.id }) + '</div>';
    } else {
      html += '<p class="p12-hint">This agreement is read-only for you at status ' +
        e(CFG().CONTRACT_STATUS[c.status] ? CFG().CONTRACT_STATUS[c.status].label : c.status) + '.</p>';
    }

    if (c.status === 'draft') {
      html += gaps.length
        ? '<div class="p12-gaps"><b>Before this draft can be submitted for review:</b><ul>' +
          gaps.map(function (g) { return '<li>' + e(g) + '</li>'; }).join('') + '</ul></div>'
        : '<div class="p12-gaps ok"><b>The draft is complete.</b> It can be submitted for ' +
          'the ' + e(CFG().REVIEW_DIVISIONS.map(function (d) { return d.label; }).join(' and ')) +
          ' reviews.</div>';
    }

    html += '</div>';

    html += '<h3 class="p12-h3">Versions</h3>' +
      '<div class="p12-tblwrap"><table class="tbl"><thead><tr><th>Version</th><th>Date</th>' +
      '<th>Author</th><th>Summary</th></tr></thead><tbody>' +
      (c.versions || []).slice().reverse().map(function (v) {
        return '<tr><td class="num">v' + e(v.no) + (v.returned ? ' · returned' : '') + '</td>' +
          '<td>' + e(dateY(v.at)) + '</td><td>' + e(userName(v.author)) + '</td>' +
          '<td>' + e(v.summary || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    return html;
  }

  function field(label, control) {
    return '<label class="p12-field"><span class="k">' + e(label) + '</span>' + control + '</label>';
  }

  function select(id, pairs, value, dis) {
    return '<select class="sel inp" id="' + e(id) + '"' + (dis || '') + '>' +
      pairs.map(function (p) {
        return '<option value="' + e(p[0]) + '"' + (p[0] === value ? ' selected' : '') + '>' +
          e(p[1]) + '</option>';
      }).join('') + '</select>';
  }

  /* ----------------------------------------------------- tab · reviews --- */

  function tabReviews(c, user) {
    if (!(c.reviews || []).length) {
      return empty('No review has been raised yet — reviews are created when the draft is ' +
        'submitted, one per division, in parallel.');
    }

    var rows = c.reviews.map(function (r) {
      var due = D.reviewDue(c, r.division);
      var mine = c.status === 'in_review' && r.status === 'pending' &&
                 D.canContract(user, 'contract_review', c) &&
                 roleOfDivision(r.division) === user.role;

      var acts = mine
        ? '<div class="p12-rvacts">' +
            '<textarea class="inp" id="p12rc_' + e(r.division) + '" rows="2" ' +
            'placeholder="Comment — required when returning the draft"></textarea>' +
            btn('Approve', 'p12-review-approve', { id: c.id, data: { d: r.division }, brass: true, sm: true }) +
            btn('Return with comment', 'p12-review-return', { id: c.id, data: { d: r.division }, sm: true }) +
          '</div>'
        : '';

      return '<article class="p12-rv ' + e(r.status) + '">' +
        '<div class="p12-rvhd"><b>' + e(divisionLabel(r.division)) + '</b>' +
        reviewPill(r.status) + '</div>' +
        '<div class="p12-rvmeta">' +
          '<span>Assignee <b>' + e(userName(r.assignee)) + '</b></span>' +
          '<span>Due <b>' + e(dateY(r.due_at)) + '</b>' +
            (due && due.overdue ? ' <b class="p12-over">overdue</b>' : '') + '</span>' +
          '<span>Decided <b>' + e(dateY(r.decided_at)) + '</b>' +
            (r.decided_by ? ' by ' + e(userName(r.decided_by)) : '') + '</span>' +
        '</div>' +
        (r.comment ? '<p class="p12-rvc">' + e(r.comment) + '</p>' : '') +
        acts + '</article>';
    }).join('');

    return '<div class="p12-rvs">' + rows + '</div>' +
      note('Both divisions review in parallel, each with ' + CFG().REVIEW_SLA_DAYS +
        ' working days. A return sends the whole agreement back to draft with the comment ' +
        'attached to the version history; every division must approve before it can be ' +
        'approved for signature.');
  }

  function roleOfDivision(key) {
    var d = CFG().REVIEW_DIVISIONS.filter(function (x) { return x.key === key; })[0];
    return d ? d.role : key;
  }

  function reviewPill(status) {
    var tone = { approved: 's1', pending: 's3', returned: 'sx', superseded: 's4' }[status] || 's4';
    var label = { approved: 'Approved', pending: 'Pending', returned: 'Returned',
                  superseded: 'Superseded' }[status] || status;
    return '<span class="pill p-' + tone + '"><span class="dot"></span>' + e(label) + '</span>';
  }

  /* -------------------------------------------------- tab · signatures --- */

  function tabSignatures(c, user) {
    var list = (c.signatories || []).slice().sort(function (a, b) {
      return a.order_index - b.order_index;
    });
    if (!list.length) return empty('No signatory has been seeded on this agreement.');

    var next = CT().nextSignatory ? CT().nextSignatory(c) : null;
    var canSign = c.status === 'signing' && D.canContract(user, 'contract_sign', c);

    var rows = list.map(function (s) {
      var isNext = next && s.order_index === next.order_index;
      var who = s.user_id ? userName(s.user_id) : (s.name || 'to be named');
      var acts = '';
      if (isNext && canSign) {
        acts = s.party === 'church'
          ? btn('Sign now', 'p12-open-sign', { id: c.id, brass: true, sm: true })
          : btn('Record partner signature', 'p12-sign-partner',
              { id: c.id, data: { i: s.order_index }, brass: true, sm: true });
      }

      return '<article class="p12-sig' + (isNext ? ' next' : '') + ' ' + e(s.status) + '">' +
        '<span class="p12-signo num">' + e(s.order_index) + '</span>' +
        '<div class="p12-sigwho"><b>' + e(who) + '</b>' +
          '<small>' + e(s.title || '') + ' · ' +
          e(s.party === 'church' ? 'for the Church' : 'for the partner') + '</small></div>' +
        '<div class="p12-sigmeta">' +
          '<span>Method <b>' + e(s.method === 'wet_ink' ? 'wet ink' : 'click to sign') + '</b></span>' +
          '<span>Due <b>' + e(dateY(s.due_at)) + '</b></span>' +
          '<span>Signed <b>' + e(dateY(s.signed_at)) + '</b></span>' +
          '<span>Authority <b>' + (s.party === 'partner' ? 'n/a'
            : (s.authority_ok ? 'in band' : '<span class="p12-over">not held</span>')) + '</b></span>' +
        '</div>' +
        signPill(s) +
        (s.decline_reason ? '<p class="p12-rvc">Declined — ' + e(s.decline_reason) + '</p>' : '') +
        (acts ? '<div class="p12-sigacts">' + acts + '</div>' : '') +
        '</article>';
    }).join('');

    var hint = '';
    if (c.status === 'signing' && next && !canSign) {
      hint = note('Signatory ' + next.order_index + ' (' +
        (next.user_id ? userName(next.user_id) : next.name) +
        ') is next. Signatures are taken strictly in order and only the eligible signatory, ' +
        'or the manager recording a wet-ink partner signature, can take the next one.');
    }

    return '<div class="p12-sigs">' + rows + '</div>' + hint;
  }

  function signPill(s) {
    var tone = { signed: 's1', pending: 's3', declined: 'sx' }[s.status] || 's4';
    var label = { signed: 'Signed', pending: 'Pending', declined: 'Declined' }[s.status] || s.status;
    return '<span class="pill p-' + tone + '"><span class="dot"></span>' + e(label) + '</span>';
  }

  /* ------------------------------------------------- tab · obligations --- */

  function tabObligations(c, user) {
    var canEdit = D.canContract(user, 'contract_edit', c);
    var list = c.obligations || [];

    var body = list.length
      ? '<div class="p12-tblwrap"><table class="tbl"><thead><tr><th>Type</th><th>Obligation</th>' +
        '<th>Due</th><th>Owner</th><th>Status</th></tr></thead><tbody>' +
        list.map(function (o) {
          var over = o.due_date && o.status !== 'done' && D.daysSince(o.due_date) > 0;
          return '<tr><td>' + e(o.type || '—') + '</td><td>' + e(o.title || '') + '</td>' +
            '<td class="' + (over ? 'p12-over' : '') + '">' + e(dateY(o.due_date)) + '</td>' +
            '<td>' + e(o.owner ? userName(o.owner) : 'unassigned') + '</td>' +
            '<td>' + e(o.status || 'open') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : empty('No obligation has been recorded on this agreement yet.');

    var add = canEdit
      ? '<div class="p12-form"><h3 class="p12-h3">Add an obligation</h3><div class="p12-fgrid">' +
          field('Type', select('p12ObType',
            [['report', 'Report'], ['payment', 'Payment'], ['visit', 'Monitoring visit'],
             ['audit', 'Audit'], ['other', 'Other']], 'report', '')) +
          field('Title', '<input class="inp" id="p12ObTitle" value="" placeholder="What is owed">') +
          field('Due date', '<input class="inp" id="p12ObDue" type="date" value="">') +
          field('Owner', select('p12ObOwner',
            [['', 'unassigned']].concat((S().users || []).map(function (u) { return [u.id, u.name]; })),
            (CBP.projectById(c.project_id) || {}).owner || '', '')) +
        '</div><div class="p12-formacts">' +
        btn('Add obligation', 'p12-oblig-add', { id: c.id, brass: true }) + '</div></div>'
      : '';

    return body + add;
  }

  /* --------------------------------------------------------- tab · log --- */

  /* F26 — the Log tab is a PROJECTION. Nothing is stored twice: the entries are
     read back out of state.activity by the ids the engine put on c.log_ids, and
     the status ladder comes from c.history. */
  function tabLog(c) {
    var ids = {}; (c.log_ids || []).forEach(function (i) { ids[i] = true; });
    var entries = (S().activity || []).filter(function (a) { return ids[a.id]; });

    var rows = entries.map(function (a) {
      return { at: a.at, kind: 'entry', who: a.author, text: a.body };
    }).concat((c.history || []).map(function (h) {
      return {
        at: h.at, kind: 'status', who: h.actor,
        text: 'Status ' + (h.from ? statusLabel(h.from) + ' → ' : 'set to ') + statusLabel(h.to)
      };
    }));

    if (!rows.length) return empty('Nothing has been recorded against this agreement yet.');

    rows.sort(function (a, b) {
      if (a.at === b.at) return a.kind === 'status' ? -1 : 1;
      return a.at < b.at ? 1 : -1;
    });

    return '<ol class="p12-log">' + rows.map(function (r) {
      return '<li class="p12-logrow ' + e(r.kind) + '">' +
        '<span class="p12-logat num">' + e(dateY(r.at)) + '</span>' +
        '<span class="p12-logtx"><b>' + e(userName(r.who)) + '</b> ' + e(r.text) + '</span></li>';
    }).join('') + '</ol>' +
      note('Every line above is the project activity stream filtered to this agreement — the ' +
        'contract keeps no second ledger of its own.');
  }

  function statusLabel(k) {
    return CFG().CONTRACT_STATUS[k] ? CFG().CONTRACT_STATUS[k].label : k;
  }

  /* ================================================ CT3 signing ceremony ===*/

  function viewSign(state) {
    var c = D.contractById(state.ui.p12Id);
    if (!c || !D.canContract(state.user, 'contract_view', c)) return viewList(state);
    var user = state.user, p = CBP.projectById(c.project_id);
    var next = CT().nextSignatory ? CT().nextSignatory(c) : null;

    var html = '<div class="crumb"><a href="#/contracts">Contracts</a> · ' +
      '<a href="#/contracts/' + e(c.id) + '" data-act="p12-open" data-id="' + e(c.id) + '">' +
      e(c.id) + '</a> · Signing</div>';

    html += '<div class="pagehead"><h1>Sign ' + e(c.id) + '</h1>' +
      '<span class="sub">' + e(c.partner || 'the partner') + ' · ' + e(money(c.amount_usd)) +
      ' · ' + e(countryName(c.country)) + '</span>' +
      '<div class="sp">' + btn('Back to the agreement', 'p12-open', { id: c.id }) + '</div></div>';

    html += errStrip();

    if (c.status !== 'signing' || !next) {
      return html + empty('This agreement is not open for signature. Every signature may ' +
        'already be recorded, or the ceremony has not been started yet.');
    }
    if (!D.canContract(user, 'contract_sign', c)) {
      return html + empty('Signatory ' + next.order_index + ' (' +
        (next.user_id ? userName(next.user_id) : next.name) +
        ') is next and this signature is not yours to take.');
    }

    var whoName = next.user_id ? userName(next.user_id) : (next.name || '');
    var scrolled = !!state.ui.signScrolled;
    var intent = !!state.ui.signIntent;
    var typed = (state.ui.signName || '').trim();
    var nameOk = typed.toLowerCase() === whoName.trim().toLowerCase();
    var ready = scrolled && intent && nameOk;
    var band = next.party === 'church' ? D.signerEligible(user, c) : null;

    html += '<div class="p12-sign">';

    /* left — the document, in a scroll area with an end marker */
    html += '<div class="p12-signdoc">' +
      '<div class="p12-scroll" id="p12SignScroll" data-act="p12-scrollzone">' +
        tabDocument(c, p) +
        '<div class="p12-endmark" id="p12SignEnd">End of the agreement · ' + e(c.id) +
        ' version ' + e(c.version_no || 1) + '</div>' +
      '</div>' +
      '<div class="p12-scrollnote">' +
        (scrolled
          ? '<span class="ok">You have read to the end of the agreement.</span>'
          : '<span>Read to the end of the agreement to enable signing.</span>' +
            btn('I have read to the end', 'p12-scrolled', { sm: true })) +
      '</div></div>';

    /* right — the three gates */
    html += '<aside class="p12-signpanel">' +
      '<h3>Signature ' + e(next.order_index) + ' of ' + e((c.signatories || []).length) + '</h3>' +
      '<div class="p12-signwho"><b>' + e(whoName) + '</b><small>' + e(next.title || '') + ' · ' +
      e(next.party === 'church' ? 'for the Church' : 'for the partner') + '</small></div>' +

      '<ol class="p12-gates">' +
        gateRow(1, 'Read the agreement to the end', scrolled) +
        gateRow(2, 'Confirm your intent to be bound', intent) +
        gateRow(3, 'Type your full name exactly as it appears above', nameOk) +
      '</ol>' +

      '<label class="p12-check big"><input type="checkbox" id="p12Intent" data-act="p12-intent"' +
      (intent ? ' checked' : '') + '><span>I intend to be bound by this agreement and I hold ' +
      'the authority to sign it' +
      (band ? ' (authority up to ' + e(band.max_usd === null || band.max_usd === undefined
        ? 'no ceiling' : money(band.max_usd)) +
        (band.delegated_from ? ', delegated from ' + e(userName(band.delegated_from)) : '') + ')'
      : '') + '.</span></label>' +

      '<label class="p12-field"><span class="k">Type your full name</span>' +
      '<input class="inp" id="p12SignName" data-act="p12-signname" autocomplete="off" ' +
      'placeholder="' + e(whoName) + '" value="' + e(state.ui.signName || '') + '"></label>' +
      (typed && !nameOk
        ? '<p class="p12-hint neg">The typed name must match ' + e(whoName) + ' exactly.</p>' : '') +

      '<div class="p12-signacts">' +
        btn('Sign', 'p12-do-sign', { id: c.id, data: { i: next.order_index },
                                     brass: true, disabled: !ready }) +
        btn('Decline to sign', 'p12-decline', { id: c.id, data: { i: next.order_index } }) +
      '</div>' +
      '<p class="p12-hint">Signing is recorded against ' + e(D.fmtDateY(CFG().TODAY)) +
      ' with your name, the version you read and the authority band that allowed it.</p>' +
      '</aside>';

    html += '</div>';
    return html;
  }

  function gateRow(n, label, ok) {
    return '<li class="p12-gate' + (ok ? ' ok' : '') + '">' +
      '<span class="mk" aria-hidden="true">' + (ok ? '✓' : n) + '</span>' +
      '<span>' + e(label) + '</span></li>';
  }

  /* ====================================================== CT4 templates ====*/

  function viewTemplates(state) {
    var user = state.user;
    if (!D.can(user, 'contract_admin')) {
      return notAdmin('Templates and clause sets are maintained by the Area Office Admin.');
    }
    var list = S().contractTemplates || [];

    var html = '<div class="crumb"><a href="#/contracts">Contracts</a> · Templates</div>' +
      '<div class="pagehead"><h1>Agreement templates</h1>' +
      '<span class="sub num">' + list.length + ' template' + (list.length === 1 ? '' : 's') +
      '</span><div class="sp">' + switcher(state, 'templates') +
      btn('New template', 'p12-tpl-new', { brass: true }) + '</div></div>';

    html += errStrip();

    html += '<div class="p12-tblwrap"><table class="tbl"><thead><tr><th>Template</th>' +
      '<th>Partner types</th><th>Countries</th><th>Version</th><th>Status</th>' +
      '<th class="r">Clauses</th><th></th></tr></thead><tbody>' +
      list.map(function (t) {
        return '<tr><td><b>' + e(t.id) + '</b><small class="p12-sub">' + e(t.name) + '</small></td>' +
          '<td>' + e((t.partner_type_scope || []).join(' · ') || 'any') + '</td>' +
          '<td>' + e(t.country_scope === 'all' || !t.country_scope
            ? 'all' : [].concat(t.country_scope).join(' · ')) + '</td>' +
          '<td class="num">' + e(t.version || '') + '</td>' +
          '<td>' + e(t.status || 'active') + '</td>' +
          '<td class="r num">' + ((t.clauses || []).length) + '</td>' +
          '<td class="r">' + btn('Edit', 'p12-tpl-edit', { id: t.id, sm: true }) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    html += note('A template supplies the clause set and the merge fields the Document tab ' +
      'renders. Changing a template never rewrites an agreement already drafted from it — the ' +
      'agreement keeps the clause set it was created with until a new version is issued.');

    return html;
  }

  /* ============================================ CT5 signature management ===*/

  function viewSignatures(state) {
    var user = state.user;
    if (!D.can(user, 'contract_admin')) {
      return notAdmin('Signing authority and delegations are maintained by the Area Office Admin.');
    }
    var auth = S().signingAuthority || [];
    var dels = S().signingDelegations || [];

    var html = '<div class="crumb"><a href="#/contracts">Contracts</a> · Signature management</div>' +
      '<div class="pagehead"><h1>Signature management</h1>' +
      '<span class="sub num">' + auth.length + ' authority band' + (auth.length === 1 ? '' : 's') +
      ' · ' + dels.length + ' delegation' + (dels.length === 1 ? '' : 's') + '</span>' +
      '<div class="sp">' + switcher(state, 'signatures') + '</div></div>';

    html += errStrip();

    html += '<h3 class="p12-h3">Signing authority</h3>' +
      '<div class="p12-tblwrap"><table class="tbl"><thead><tr><th>User</th><th>Role</th>' +
      '<th>Countries</th><th class="r">Band</th><th>Agreement types</th><th></th>' +
      '</tr></thead><tbody>' +
      auth.map(function (r) {
        return '<tr><td><b>' + e(userName(r.user_id)) + '</b></td>' +
          '<td>' + e(CFG().ROLE_LABEL[r.role] || r.role || '') + '</td>' +
          '<td>' + e(r.country_scope === 'all' || !r.country_scope
            ? 'all' : [].concat(r.country_scope).join(' · ')) + '</td>' +
          '<td class="r num">' + e(money(r.min_usd || 0)) + ' — ' +
            e(r.max_usd === null || r.max_usd === undefined ? 'no ceiling' : money(r.max_usd)) + '</td>' +
          '<td>' + e((r.types || []).join(' · ')) + '</td>' +
          '<td class="r">' + btn('Edit', 'p12-auth-edit', { id: r.user_id, sm: true }) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    html += '<h3 class="p12-h3">Delegations</h3>';
    html += dels.length
      ? '<div class="p12-tblwrap"><table class="tbl"><thead><tr><th>From</th><th>To</th>' +
        '<th>Scope</th><th>From date</th><th>To date</th><th>Approved by</th><th></th>' +
        '</tr></thead><tbody>' +
        dels.map(function (d) {
          return '<tr><td>' + e(userName(d.from_user_id)) + '</td>' +
            '<td>' + e(userName(d.to_user_id)) + '</td>' +
            '<td>' + e(d.scope === 'all' || !d.scope ? 'all' : [].concat(d.scope).join(' · ')) + '</td>' +
            '<td>' + e(dateY(d.start_at)) + '</td><td>' + e(dateY(d.end_at)) + '</td>' +
            '<td>' + e(userName(d.approved_by)) + '</td>' +
            '<td class="r">' + btn('Remove', 'p12-deleg-remove',
              { sm: true, data: { from: d.from_user_id, to: d.to_user_id } }) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : empty('No signing delegation is in force.');

    var signers = (S().users || []).filter(function (u) {
      return ['admin', 'm1', 'm2'].indexOf(u.role) > -1;
    }).map(function (u) { return [u.id, u.name]; });

    html += '<div class="p12-form"><h3 class="p12-h3">Add a delegation</h3><div class="p12-fgrid">' +
      field('From', select('p12DelFrom', signers, '', '')) +
      field('To', select('p12DelTo', signers, '', '')) +
      field('Scope', '<input class="inp" id="p12DelScope" value="all" ' +
        'placeholder="all, or BGD,NPL">') +
      field('From date', '<input class="inp" id="p12DelStart" type="date" value="' +
        e(CFG().TODAY) + '">') +
      field('To date', '<input class="inp" id="p12DelEnd" type="date" value="">') +
      '</div><div class="p12-formacts">' +
      btn('Add delegation', 'p12-deleg-add', { brass: true }) + '</div></div>';

    html += note('An authority band decides who may sign an agreement of a given value, in a ' +
      'given country, of a given type. A delegation lends the delegator’s bands to the ' +
      'delegate for a dated window, and the signature records that it was signed under a ' +
      'delegation.');

    return html;
  }

  function notAdmin(msg) {
    return '<div class="crumb"><a href="#/contracts">Contracts</a></div>' +
      '<div class="pagehead"><h1>Corporate agreements</h1></div>' + empty(msg);
  }

  /* ======================================================= CT6 wizard =====*/

  function draft(state) {
    var d = state.ui.ctDraft;
    if (!d || typeof d !== 'object') {
      d = { step: 1, project_id: null, partner: '', partner_type: 'local',
            template_id: null, amount: null, currency: 'USD' };
      state.ui.ctDraft = d;
    }
    if (!d.step) d.step = 1;
    return d;
  }

  /* the projects a draft may be opened on: drafting is allowed from the gate
     opening (status 3) onwards, the project must not already carry a primary
     agreement, and it must be one this persona could draft for */
  function wizardProjects(state) {
    var user = state.user;
    return D.visibleProjects(user, state.projects, state.countries).filter(function (p) {
      if (!CT().draftAllowed || !CT().draftAllowed(p)) return false;
      if (p.primary_contract_id) return false;
      return D.canContract(user, 'contract_edit', null);
    });
  }

  function viewWizard(state) {
    var user = state.user;
    if (!D.can(user, 'contract_submit')) {
      return notAdmin('Opening a new Corporate Agreement is not part of your role.');
    }
    var d = draft(state);
    var list = wizardProjects(state);
    var p = d.project_id ? CBP.projectById(d.project_id) : null;

    var html = '<div class="crumb"><a href="#/contracts">Contracts</a> · New agreement</div>' +
      '<div class="pagehead"><h1>New Corporate Agreement</h1>' +
      '<span class="sub">Step ' + d.step + ' of 3</span>' +
      '<div class="sp">' + btn('Cancel', 'p12-back', {}) + '</div></div>';

    html += errStrip();

    html += '<ol class="p12-steps">' +
      ['Choose the project', 'Partner and template', 'Value'].map(function (s, i) {
        return '<li class="p12-step' + (d.step === i + 1 ? ' on' : (d.step > i + 1 ? ' done' : '')) +
          '"><span class="mk num">' + (i + 1) + '</span>' + e(s) + '</li>';
      }).join('') + '</ol>';

    if (d.step === 1) {
      html += list.length
        ? '<div class="p12-tblwrap"><table class="tbl"><thead><tr><th>Project</th><th>Country</th>' +
          '<th class="r">Amount</th><th>Status</th><th>Implementer</th><th></th></tr></thead><tbody>' +
          list.map(function (x) {
            return '<tr' + (d.project_id === x.id ? ' class="on"' : '') + '>' +
              '<td><b>' + e(x.id) + '</b><small class="p12-sub">' + e(x.name) + '</small></td>' +
              '<td>' + ccChip(x.country) + '</td>' +
              '<td class="r num">' + e(money(x.amount)) + '</td>' +
              '<td>' + U.statusPill(x.status) + '</td>' +
              '<td>' + e(x.primary_implementer || '—') + '</td>' +
              '<td class="r">' + btn(d.project_id === x.id ? 'Chosen' : 'Choose',
                'p12-wiz-pick', { id: x.id, sm: true, brass: d.project_id === x.id }) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : empty('Every project in your scope that is far enough along already carries an ' +
                'agreement. An existing agreement is changed with Amend, not with a new draft.');

      html += '<div class="p12-formacts">' +
        btn('Next', 'p12-wiz-next', { brass: true, disabled: !d.project_id }) + '</div>';

    } else if (d.step === 2) {
      var tpl = templateById(d.template_id) ||
                (CT().templateFor ? CT().templateFor(d.partner_type, p ? p.country : null) : null);
      html += '<div class="p12-form"><div class="p12-fgrid">' +
        field('Project', '<input class="inp" value="' + e(d.project_id + (p ? ' · ' + p.name : '')) +
          '" disabled>') +
        field('Partner', '<input class="inp" id="p12WizPartner" value="' +
          e(d.partner || (p ? p.primary_implementer : '') || '') + '">') +
        field('Partner type', select('p12WizType',
          [['un', 'UN agency'], ['ingo', 'International NGO'], ['local', 'Local partner']],
          d.partner_type || (p && CT().partnerTypeOf ? CT().partnerTypeOf(p) : 'local'), '')) +
        field('Template', select('p12WizTemplate',
          (S().contractTemplates || []).filter(function (t) { return t.id !== 'T-AMEND'; })
            .map(function (t) { return [t.id, t.name]; }),
          (tpl && tpl.id) || null, '')) +
        '</div>';

      html += tpl
        ? '<div class="p12-preview"><h4>' + e(tpl.name) + ' · version ' + e(tpl.version) + '</h4>' +
          '<ol>' + (tpl.clauses || []).map(function (cl) {
            return '<li>' + e(cl) + '</li>';
          }).join('') + '</ol></div>'
        : empty('No template matches this partner type yet.');

      html += '<div class="p12-formacts">' + btn('Back', 'p12-wiz-back', {}) +
        btn('Next', 'p12-wiz-next', { brass: true }) + '</div></div>';

    } else {
      html += '<div class="p12-form"><div class="p12-fgrid">' +
        field('Agreement value', '<input class="inp num" id="p12WizAmount" type="number" value="' +
          e(d.amount !== null && d.amount !== undefined ? d.amount : (p ? p.amount : 0)) + '">') +
        field('Currency', '<input class="inp" id="p12WizCurrency" value="' +
          e(d.currency || 'USD') + '">') +
        '</div>' +
        '<p class="p12-hint">' + e('The agreement opens as a draft. The attestations, due ' +
          'diligence and screening are completed on the Details tab before it can be submitted ' +
          'for the ' + CFG().REVIEW_DIVISIONS.map(function (x) { return x.label; }).join(' and ') +
          ' reviews.') + '</p>' +
        '<div class="p12-formacts">' + btn('Back', 'p12-wiz-back', {}) +
        btn('Create the agreement', 'p12-wiz-create', { brass: true }) + '</div></div>';
    }

    return html;
  }

  /* ============================================================= modals ====*/

  function modal(state) {
    var m = state.ui.p12Modal;
    if (!m || !m.kind) return '';
    var body = '', title = '', acts = '';

    if (m.kind === 'newver') {
      title = 'New version of ' + m.id;
      body = '<label class="p12-field"><span class="k">What changed in this version</span>' +
        '<textarea class="inp" id="p12ModalText" rows="3"></textarea></label>';
      acts = btn('Issue version', 'p12-do-newver', { id: m.id, brass: true });

    } else if (m.kind === 'sent') {
      title = 'Mark ' + m.id + ' sent out';
      body = '<div class="p12-fgrid">' +
        field('Channel', select('p12ModalChannel',
          [['email', 'E-mail'], ['courier', 'Courier'], ['hand', 'Delivered by hand']], 'email', '')) +
        field('Transmittal reference', '<input class="inp" id="p12ModalRef" value="" ' +
          'placeholder="e.g. MAIL-2026-0912">') +
        field('Evidence', '<input class="inp" id="p12ModalEvidence" value="" ' +
          'placeholder="optional — file name or note">') +
        '</div>';
      acts = btn('Mark sent out', 'p12-do-sent', { id: m.id, brass: true });

    } else if (m.kind === 'amend') {
      title = 'Amend ' + m.id;
      body = '<label class="p12-field"><span class="k">What the amendment changes</span>' +
        '<textarea class="inp" id="p12ModalText" rows="3"></textarea></label>';
      acts = btn('Open the amendment', 'p12-do-amend', { id: m.id, brass: true });

    } else if (m.kind === 'cancel') {
      title = 'Cancel ' + m.id;
      body = '<label class="p12-field"><span class="k">Reason (recorded on the project)</span>' +
        '<textarea class="inp" id="p12ModalText" rows="3"></textarea></label>';
      acts = btn('Cancel the agreement', 'p12-do-cancel', { id: m.id, brass: true });

    } else if (m.kind === 'decline') {
      title = 'Decline to sign ' + m.id;
      body = '<label class="p12-field"><span class="k">Reason (returns the agreement to draft)</span>' +
        '<textarea class="inp" id="p12ModalText" rows="3"></textarea></label>';
      acts = btn('Decline', 'p12-do-decline', { id: m.id, data: { i: m.order }, brass: true });

    } else if (m.kind === 'template') {
      var t = templateById(m.id) || { id: m.id, name: '', version: '1.0', status: 'active',
                                      clauses: [], tokens: [] };
      title = 'Template ' + t.id;
      body = '<div class="p12-fgrid">' +
        field('Id', '<input class="inp" id="p12TplId" value="' + e(t.id) + '"' +
          (templateById(m.id) ? ' disabled' : '') + '>') +
        field('Name', '<input class="inp" id="p12TplName" value="' + e(t.name || '') + '">') +
        field('Version', '<input class="inp" id="p12TplVersion" value="' + e(t.version || '') + '">') +
        field('Status', select('p12TplStatus',
          [['active', 'Active'], ['retired', 'Retired']], t.status || 'active', '')) +
        '</div>' +
        '<label class="p12-field"><span class="k">Clauses (one per line)</span>' +
        '<textarea class="inp" id="p12TplClauses" rows="8">' +
        e((t.clauses || []).join('\n')) + '</textarea></label>' +
        '<label class="p12-field"><span class="k">Merge fields (one per line)</span>' +
        '<textarea class="inp" id="p12TplTokens" rows="4">' +
        e((t.tokens || []).join('\n')) + '</textarea></label>';
      acts = btn('Save template', 'p12-tpl-save', { id: t.id, brass: true });

    } else if (m.kind === 'authority') {
      var r = (S().signingAuthority || []).filter(function (x) {
        return x.user_id === m.id;
      })[0] || { user_id: m.id, country_scope: 'all', min_usd: 0, max_usd: null, types: [] };
      title = 'Signing authority · ' + userName(m.id);
      body = '<div class="p12-fgrid">' +
        field('Countries', '<input class="inp" id="p12AuthScope" value="' +
          e(r.country_scope === 'all' || !r.country_scope ? 'all'
            : [].concat(r.country_scope).join(',')) + '" placeholder="all, or BGD,NPL">') +
        field('Minimum value', '<input class="inp num" id="p12AuthMin" type="number" value="' +
          e(r.min_usd || 0) + '">') +
        field('Maximum value', '<input class="inp num" id="p12AuthMax" type="number" value="' +
          e(r.max_usd === null || r.max_usd === undefined ? '' : r.max_usd) +
          '" placeholder="blank = no ceiling">') +
        field('Agreement types', '<input class="inp" id="p12AuthTypes" value="' +
          e((r.types || []).join(',')) + '" placeholder="un,ingo,local,amend">') +
        '</div>';
      acts = btn('Save authority', 'p12-auth-save', { id: m.id, brass: true }) +
             btn('Remove band', 'p12-auth-remove', { id: m.id });
    } else {
      return '';
    }

    return '<div class="modal-wrap" data-act="p12-modal-close"><div class="modal p12-modal">' +
      '<h3>' + e(title) + '</h3>' + body + errStrip() +
      '<div class="acts">' + acts +
      btn('Close', 'p12-modal-close', {}) + '</div></div></div>';
  }

  /* =========================================== exports consumed by p4.js ===*/

  /* the small header pill on P4: where this project's agreement stands, and a
     way into it. 'na' is a legitimate answer, not an empty state. */
  P12.headerChip = function (p, state) {
    state = state || CBP.state;
    if (!p) return '';
    if (!D.can(state.user, 'contract_view')) return '';

    var g = D.contractGate(p);
    if (g.state === 'na') {
      return '<span class="p12-chip na" title="Below the ' +
        e(money(CFG().CONTRACT_THRESHOLD_USD)) + ' threshold, or exempted">' +
        'Agreement: no agreement needed</span>';
    }
    if (g.state === 'todo' || !g.contract) {
      return '<a class="p12-chip todo" href="#/contracts">Agreement: to be drafted</a>';
    }
    var c = g.contract;
    var tone = g.met ? 'ok' : (g.state === 'drafting' ? 'todo' : 'work');
    return '<a class="p12-chip ' + tone + '" href="#/contracts/' + e(c.id) + '">' +
      'Agreement ' + e(c.id) + ': ' + e(statusLabel(c.status)) + '</a>';
  };

  /* the P4 "Contracts" tab body: this project's agreements including every
     amendment, plus the two ways forward the state machine allows. */
  P12.projectTab = function (p, state) {
    state = state || CBP.state;
    if (!p) return '';
    var user = state.user;
    if (!D.can(user, 'contract_view')) {
      return empty('Corporate agreements are not part of your role’s view.');
    }

    var list = D.contractsFor({ project: p.id });
    var primary = D.primaryContract(p);
    var required = D.contractRequired(p);
    var canDraft = D.canContract(user, 'contract_edit', null) &&
                   CT().draftAllowed && CT().draftAllowed(p);

    var head = '<div class="p12-ptab-head">' +
      '<span>' + (required
        ? 'A Corporate Agreement is required on this project (' + e(money(p.amount)) +
          ' is at or above the ' + e(money(CFG().CONTRACT_THRESHOLD_USD)) + ' threshold) and ' +
          'must be sent out before implementation can start.'
        : 'No Corporate Agreement is required on this project.') + '</span>' +
      '<span class="p12-ptab-acts">' +
        (canDraft && !primary
          ? btn('New draft', 'p12-view', { brass: true, sm: true, data: { v: 'new', p: p.id } })
          : '') +
        (primary && D.canContract(user, 'contract_amend', primary)
          ? btn('Amend', 'p12-amend', { id: primary.id, sm: true }) : '') +
      '</span></div>';

    if (!list.length) {
      return head + empty(required
        ? 'No agreement has been opened on this project yet. One is created automatically when ' +
          'the project is Marked Approved, or can be drafted from here once the gate is open.'
        : 'No agreement has been opened on this project.');
    }

    var rows = list.map(function (c) {
      var na = nextAction(c);
      return '<tr class="p12-row" data-act="p12-open" data-id="' + e(c.id) + '" tabindex="0">' +
        '<td><b class="num">' + e(c.id) + '</b>' +
          '<small class="p12-sub">' +
          e((c.parent_contract_id ? 'amendment ' + c.amendment_no : 'primary · v' + (c.version_no || 1)) +
            ' · moved ' + dateY(D.contractLastMove(c))) + '</small></td>' +
        '<td data-label="Partner">' + e(c.partner || 'to be named') + '</td>' +
        '<td class="r num" data-label="Value">' + e(money(c.amount_usd)) + '</td>' +
        '<td data-label="Status">' + ctPill(c.status) + '</td>' +
        '<td data-label="Stage">' + miniStepper(c) + '</td>' +
        '<td data-label="Next action">' + e(na.label) +
          '<small class="p12-sub">' + e(na.who) + '</small></td></tr>';
    }).join('');

    return head +
      '<div class="p12-tblwrap p12-cards"><table class="tbl p12-tbl narrow"><thead><tr><th>Agreement</th>' +
      '<th>Partner</th><th class="r">Value</th><th>Status</th><th>Stage</th>' +
      '<th>Next action</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
  };

  /* ================================================ delegated listener ====
     ONE listener for the whole 'p12-*' namespace, registered once at load and
     guarded against a second registration if this file is ever evaluated twice.
     Every branch mutates CBP.state (or calls an action that does) and ends in a
     single CBP.render(). */

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }
  function checked(id) {
    var el = document.getElementById(id);
    return !!(el && el.checked);
  }
  function refocus(id, toEnd) {
    var el = document.getElementById(id);
    if (!el) return;
    try {
      el.focus();
      if (toEnd && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
    } catch (err) {}
  }
  function goto(id) {
    CBP.state.ui.p12Id = id;
    CBP.state.ui.p12View = 'detail';
    if (('#/contracts/' + id) === location.hash) return false;   /* no hashchange coming */
    location.hash = '#/contracts/' + id;
    return true;                                                  /* hashchange renders */
  }
  function resetSign() {
    var u = CBP.state.ui;
    u.signScrolled = false;
    u.signIntent = false;
    u.signName = '';
  }

  function detailsFields() {
    return {
      partner: val('p12Partner'),
      partner_type: val('p12PartnerType'),
      amount_usd: Number(val('p12Amount')) || 0,
      amount: Number(val('p12Amount')) || 0,
      currency: val('p12Currency') || 'USD',
      template_id: val('p12Template') || null,
      due_diligence: val('p12DueDiligence'),
      screening: { date: val('p12ScreenDate') || null, result: val('p12ScreenResult') },
      attestations: {
        supplements_local: checked('p12Att_supplements_local'),
        no_dependency: checked('p12Att_no_dependency'),
        not_primary_support: checked('p12Att_not_primary_support'),
        partner_verified: checked('p12Att_partner_verified')
      }
    };
  }

  function onClick(ev) {
    var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (!act || act.indexOf('p12-') !== 0) return;

    /* a real link inside a clickable row wins — the project column must reach
       the project, not the agreement */
    var a = ev.target.closest ? ev.target.closest('a[href]') : null;
    if (a && a !== t && t.tagName === 'TR') return;

    var u = CBP.state.ui;
    var id = t.getAttribute('data-id');
    var after = null;
    var navigated = false;

    if (act === 'p12-view') {
      u.p12View = t.getAttribute('data-v') || 'list';
      u.err = null;
      if (u.p12View === 'new') {
        u.ctDraft = null;
        var pid = t.getAttribute('data-p');
        if (pid) { draft(CBP.state).project_id = pid; }
      }
      if (u.param) { location.hash = '#/contracts'; navigated = true; }

    } else if (act === 'p12-open') {
      u.err = null;
      u.p12Tab = u.p12Tab || 'document';
      if (u.p12Id !== id) u.p12Edit = false;    /* edit mode never follows a link */
      resetSign();
      navigated = goto(id);

    } else if (act === 'p12-back') {
      u.p12View = 'list';
      u.err = null;
      u.ctDraft = null;
      if (u.param) { location.hash = '#/contracts'; navigated = true; }

    } else if (act === 'p12-country') {
      U.toggleCountry(CBP.state, 'p12Countries',
        D.visibleCountries(CBP.state.user, CBP.state.countries), t.getAttribute('data-c'));

    } else if (act === 'p12-countries-all') {
      u.p12Countries = null;

    } else if (act === 'p12-filter') {
      u.p12Filter = t.getAttribute('data-f') || 'all';

    } else if (act === 'p12-tab') {
      u.p12Tab = t.getAttribute('data-t');
      u.err = null;

    } else if (act === 'p12-edit') {
      u.p12Edit = !u.p12Edit;
      u.p12Tab = 'details';
      u.err = null;

    } else if (act === 'p12-edit-cancel') {
      u.p12Edit = false;
      u.err = null;

    } else if (act === 'p12-save') {
      var r = A.contractEdit(id, detailsFields());
      if (r && r.ok) u.p12Edit = false;

    } else if (act === 'p12-submit') {
      A.contractSubmitReview(id);

    } else if (act === 'p12-approve-sig') {
      A.contractApproveForSignature(id);

    } else if (act === 'p12-start-signing') {
      A.contractStartSigning(id);

    } else if (act === 'p12-open-sign') {
      resetSign();
      u.err = null;
      u.p12View = 'sign';
      u.p12Id = id;
      if (u.param !== id) { location.hash = '#/contracts/' + id; navigated = true; }

    } else if (act === 'p12-scrolled') {
      u.signScrolled = true;

    } else if (act === 'p12-intent') {
      u.signIntent = !u.signIntent;

    } else if (act === 'p12-do-sign') {
      var res = A.contractSign(id, Number(t.getAttribute('data-i')), { intent: true });
      if (res && res.ok) {
        resetSign();
        u.p12View = 'detail';
        u.p12Tab = 'signatures';
        u.notice = res.executed
          ? 'Signature recorded — ' + id + ' is fully executed and can be sent out.'
          : 'Signature recorded on ' + id + '.';
      }

    } else if (act === 'p12-sign-partner') {
      var rp = A.contractSign(id, Number(t.getAttribute('data-i')), { intent: true });
      if (rp && rp.ok) {
        u.p12Tab = 'signatures';
        u.notice = rp.executed
          ? 'Partner signature recorded — ' + id + ' is fully executed.'
          : 'Partner signature recorded on ' + id + '.';
      }

    } else if (act === 'p12-decline') {
      u.p12Modal = { kind: 'decline', id: id, order: Number(t.getAttribute('data-i')) };

    } else if (act === 'p12-do-decline') {
      var rd = A.contractDecline(id, Number(t.getAttribute('data-i')), val('p12ModalText'));
      if (rd && rd.ok) { u.p12Modal = null; resetSign(); u.p12View = 'detail'; }

    } else if (act === 'p12-newver') {
      u.p12Modal = { kind: 'newver', id: id };

    } else if (act === 'p12-do-newver') {
      var rv = A.contractNewVersion(id, val('p12ModalText'));
      if (rv && rv.ok) u.p12Modal = null;

    } else if (act === 'p12-mark-sent') {
      u.p12Modal = { kind: 'sent', id: id };

    } else if (act === 'p12-do-sent') {
      var rs = A.contractMarkSent(id, {
        channel: val('p12ModalChannel'), ref: val('p12ModalRef'),
        evidence: val('p12ModalEvidence')
      });
      if (rs && rs.ok) u.p12Modal = null;

    } else if (act === 'p12-activate') {
      A.contractActivate(id);

    } else if (act === 'p12-amend') {
      u.p12Modal = { kind: 'amend', id: id };

    } else if (act === 'p12-do-amend') {
      var ra = A.contractAmend(id, val('p12ModalText'));
      if (ra && ra.ok) {
        u.p12Modal = null;
        u.p12Tab = 'document';
        navigated = goto(ra.id);
      }

    } else if (act === 'p12-cancel') {
      u.p12Modal = { kind: 'cancel', id: id };

    } else if (act === 'p12-do-cancel') {
      var rc = A.contractCancel(id, val('p12ModalText'));
      if (rc && rc.ok) u.p12Modal = null;

    } else if (act === 'p12-modal-close') {
      if (t.tagName !== 'BUTTON' && ev.target.closest && ev.target.closest('.modal')) return;
      u.p12Modal = null;
      u.err = null;

    } else if (act === 'p12-review-approve') {
      A.reviewDecide(id, t.getAttribute('data-d'), 'approve', val('p12rc_' + t.getAttribute('data-d')));

    } else if (act === 'p12-review-return') {
      A.reviewDecide(id, t.getAttribute('data-d'), 'return', val('p12rc_' + t.getAttribute('data-d')));

    } else if (act === 'p12-oblig-add') {
      var c0 = D.contractById(id);
      if (c0) {
        var title = val('p12ObTitle');
        if (!title) {
          u.err = { key: 'contract', msg: 'An obligation needs a title.' };
        } else {
          A.contractEdit(id, {
            obligations: (c0.obligations || []).concat([{
              type: val('p12ObType'), title: title, due_date: val('p12ObDue') || null,
              owner: val('p12ObOwner') || null, status: 'open'
            }])
          });
        }
      }

    } else if (act === 'p12-tpl-new') {
      u.p12Modal = { kind: 'template', id: 'T-NEW' };

    } else if (act === 'p12-tpl-edit') {
      u.p12Modal = { kind: 'template', id: id };

    } else if (act === 'p12-tpl-save') {
      var tid = val('p12TplId') || id;
      var rt = A.templateSet(tid, {
        name: val('p12TplName'), version: val('p12TplVersion'), status: val('p12TplStatus'),
        clauses: lines(val('p12TplClauses')), tokens: lines(val('p12TplTokens'))
      });
      if (rt && rt.ok) u.p12Modal = null;

    } else if (act === 'p12-auth-edit') {
      u.p12Modal = { kind: 'authority', id: id };

    } else if (act === 'p12-auth-save') {
      var maxv = val('p12AuthMax');
      var types = csv(val('p12AuthTypes'));
      var rau = A.authoritySet(id, {
        country_scope: csv(val('p12AuthScope')),
        min_usd: Number(val('p12AuthMin')) || 0,
        max_usd: maxv === '' ? null : Number(maxv),
        types: types === 'all'
          ? ['un', 'ingo', 'local', 'amend']
          : types.map(function (x) { return x.toLowerCase(); })
      });
      if (rau && rau.ok) u.p12Modal = null;

    } else if (act === 'p12-auth-remove') {
      var rr = A.authoritySet(id, { remove: true });
      if (rr && rr.ok) u.p12Modal = null;

    } else if (act === 'p12-deleg-add') {
      A.delegationSet({
        from_user_id: val('p12DelFrom'), to_user_id: val('p12DelTo'),
        scope: csv(val('p12DelScope')),
        start_at: val('p12DelStart') || CFG().TODAY,
        end_at: val('p12DelEnd') || null
      });

    } else if (act === 'p12-deleg-remove') {
      A.delegationSet({
        from_user_id: t.getAttribute('data-from'), to_user_id: t.getAttribute('data-to'),
        remove: true
      });

    } else if (act === 'p12-wiz-pick') {
      var d1 = draft(CBP.state);
      d1.project_id = id;
      var pp = CBP.projectById(id);
      if (pp) {
        d1.partner = pp.primary_implementer || '';
        d1.partner_type = CT().partnerTypeOf ? CT().partnerTypeOf(pp) : 'local';
        d1.amount = pp.amount;
      }

    } else if (act === 'p12-wiz-next') {
      var d2 = draft(CBP.state);
      if (d2.step === 2) {
        d2.partner = val('p12WizPartner');
        d2.partner_type = val('p12WizType');
        d2.template_id = val('p12WizTemplate');
      }
      if (d2.step === 1 && !d2.project_id) {
        u.err = { key: 'ct6', msg: 'Choose a project for the agreement.' };
      } else {
        d2.step = Math.min(3, d2.step + 1);
        u.err = null;
      }

    } else if (act === 'p12-wiz-back') {
      var d3 = draft(CBP.state);
      if (d3.step === 2) {
        d3.partner = val('p12WizPartner');
        d3.partner_type = val('p12WizType');
        d3.template_id = val('p12WizTemplate');
      }
      if (d3.step === 3) {
        d3.amount = Number(val('p12WizAmount'));
        d3.currency = val('p12WizCurrency');
      }
      d3.step = Math.max(1, d3.step - 1);
      u.err = null;

    } else if (act === 'p12-wiz-create') {
      var d4 = draft(CBP.state);
      d4.amount = Number(val('p12WizAmount'));
      d4.currency = val('p12WizCurrency') || 'USD';
      var rw = A.contractCreate({
        project_id: d4.project_id, partner: d4.partner, partner_type: d4.partner_type,
        template_id: d4.template_id, amount: d4.amount, amount_usd: d4.amount,
        currency: d4.currency
      });
      if (rw && rw.ok && rw.id) {
        u.ctDraft = null;
        u.p12Tab = 'details';
        u.p12Edit = true;
        u.notice = 'Agreement ' + rw.id + ' opened as a draft.';
        navigated = goto(rw.id);
      }

    } else {
      return;
    }

    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (!navigated) CBP.render();
    if (after) after();
  }

  function lines(s) {
    return String(s || '').split('\n').map(function (x) { return x.trim(); })
      .filter(function (x) { return !!x; });
  }
  function csv(s) {
    s = String(s || '').trim();
    if (!s || s.toLowerCase() === 'all') return 'all';
    return s.split(',').map(function (x) { return x.trim().toUpperCase(); })
      .filter(function (x) { return !!x; });
  }

  function onInput(ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    var act = t.getAttribute('data-act');
    if (act === 'p12-search') {
      CBP.state.ui.p12Search = t.value;
      CBP.render();
      refocus('p12search', true);
    } else if (act === 'p12-signname') {
      CBP.state.ui.signName = t.value;
      CBP.render();
      refocus('p12SignName', true);
    }
  }

  /* The CT3 read-to-end gate. The document is not clipped into an inner pane
     (an off-screen clause inside one still has a box outside it, which reads as
     an overlap with the panel beside it), so the page is the scroll surface and
     the gate is simply "the end marker has come into view". 'scroll' does not
     bubble, so the listener is captured — that catches the window and any inner
     scroller alike. The button beside the document is the accessible, and
     headless, equivalent. */
  function onScroll() {
    var s = CBP.state;
    if (!s || !s.ui || s.ui.signScrolled || s.ui.p12View !== 'sign') return;
    var end = document.getElementById('p12SignEnd');
    if (!end || !end.getBoundingClientRect) return;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (end.getBoundingClientRect().top <= vh - 8) {
      s.ui.signScrolled = true;
      CBP.render();
    }
  }

  if (!P12._wired) {
    P12._wired = true;
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('scroll', onScroll, true);
    /* the register rows are focusable — keep them on the keyboard path */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      var t = ev.target;
      if (!t || !t.getAttribute || t.getAttribute('data-act') !== 'p12-open') return;
      ev.preventDefault();
      onClick({ target: t, preventDefault: function () {}, stopImmediatePropagation: function () {} });
    });
  }

})();
