/* pages/p10.js — P10 mobile quick view, route #/mobile (build-plan item 11).
   C-19: the device-detected mode. Approvals and updates only, a period filter,
   and a "Full site" escape that is remembered per device (RM-7).

   Everything here is a READ of existing derivations — D.*, CBP.actions.* and
   CBP.entriesFor — and every action control is the same markup P4 and P6 emit
   (CBP.p4.btn + CBP.p4.modal), so the approve / return / gate / mark flows run
   through the one handler map in actions.js with no action code of its own.

   Real device detection is out of scope for the demo (build plan item 11); P1
   carries the toggle that routes here, and this route also stands on its own. */
(function () {
  'use strict';

  var D = CBP.D, U = CBP.ui, A = CBP.actions, P4 = CBP.p4, e = CBP.ui.esc;
  CBP.pages = CBP.pages || {};

  var PERIODS = [
    { k: 'today',  label: 'Today',  days: 0 },
    { k: '7d',     label: '7 d',    days: 7 },
    { k: '30d',    label: '30 d',   days: 30 },
    { k: 'custom', label: 'Custom' }
  ];

  var TYPE_LABEL = { note: 'Note', question: 'Question', decision: 'Decision', system: 'System' };

  /* --------------------------------------------------------- page state -- */

  function ensure(state) {
    var s = state.ui.p10;
    if (!s) {
      var today = CBP.CONFIG.TODAY;
      s = state.ui.p10 = {
        period: '7d',
        from: iso(D.addDays(D.parse(today), -14)),
        to: today,
        /* RM-7 — set the first time the escape is used, and remembered for the
           rest of the session. It never traps: #/mobile keeps rendering the
           quick view and shows a hint bar offering the full site again. */
        fullSite: false
      };
    }
    return s;
  }

  function iso(d) {
    return d.getUTCFullYear() + '-' +
      ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }

  /* the window an entry has to fall inside, against CONFIG.TODAY */
  function inPeriod(s, at) {
    if (!at) return false;
    if (s.period === 'custom') {
      var a = s.from || '0000-01-01', b = s.to || CBP.CONFIG.TODAY;
      return at >= a && at <= b;
    }
    var p = PERIODS.filter(function (x) { return x.k === s.period; })[0] || PERIODS[1];
    var age = D.daysSince(at);
    return age !== null && age >= 0 && age <= p.days;
  }

  function periodLabel(s) {
    if (s.period === 'custom') return D.fmtDateY(s.from) + ' – ' + D.fmtDateY(s.to);
    var p = PERIODS.filter(function (x) { return x.k === s.period; })[0];
    return p.k === 'today' ? 'today' : 'the last ' + p.days + ' days';
  }

  /* ============================================================== render == */

  CBP.pages.mobile = function (state) {
    var s = ensure(state);
    var user = state.user;
    var scoped = D.visibleProjects(user, state.projects, state.countries);
    var codes = D.visibleCountries(user, state.countries);

    var html = '<div class="p10-stage"><div class="p10-phone">';

    /* ------------------------------------------------------- (a) header -- */
    html += '<header class="p10-head">' +
      '<div class="p10-mark">Church Budget&amp;Project MS<small>Asia Area · quick view</small></div>' +
      '<a class="p10-escape" href="#/dashboard" data-p10="fullsite">Full site ↗</a>' +
      '</header>' +
      '<div class="p10-me"><b>' + e(user.name) + '</b>' +
      '<span>' + e(CBP.CONFIG.ROLE_LABEL[user.role]) + ' · ' +
      e(codes.length === state.countries.length ? 'all countries' : codes.join(', ')) +
      '</span></div>';

    if (s.fullSite) {
      html += '<div class="p10-remember">' +
        '<b>Full site is remembered on this device</b>' +
        '<span>You chose the full site earlier, so this device opens there by default. ' +
        'The quick view still works whenever you come back to it.</span>' +
        '<div class="p10-remacts">' +
          '<button class="btn sm brass" data-p10="stay">Use quick view here</button>' +
          '<a class="btn sm" href="#/dashboard">Open full site</a>' +
        '</div></div>';
    }

    /* ------------------------------------------------- (b) period chips -- */
    html += '<div class="p10-chips">' + PERIODS.map(function (x) {
      return '<button class="p10-chip' + (s.period === x.k ? ' on' : '') +
        '" data-p10="period" data-k="' + e(x.k) + '">' + e(x.label) + '</button>';
    }).join('') + '</div>';

    if (s.period === 'custom') {
      html += '<div class="p10-custom">' +
        '<label>From<input type="date" data-p10="from" value="' + e(s.from) + '"></label>' +
        '<label>To<input type="date" data-p10="to" value="' + e(s.to) + '"></label>' +
        '</div>';
    }

    /* -------------------------------------------------- (c) approvals ----
       v1.2.0 (T-13): one list, the same D.needsYou P6 reads, drawn by the same
       U.needsRow in its compact form. The three v1.1.0 duplicates — queues(),
       card() and the two read-only "To confirm" / "To sign" lists — are gone;
       what the phone lost is a second copy of the rules, not an action. */
    html += approvals(state, user);

    /* ---------------------------------------------------- (d) updates ---- */
    html += updates(state, s, scoped);

    html += '<p class="p10-note">Quick view shows approvals and updates only. ' +
      'Day counts derive against ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) +
      '; the feed covers ' + e(periodLabel(s)) + '. Open the full site for the register, ' +
      'dashboards, timeline and budget.</p>';

    return html + '</div></div>' + P4.modal(state);
  };

  /* =============================================== (c) approvals section ==
     One derive, one row renderer. The groups below are D.NEEDS_CHIPS in its
     frozen order, so the phone and the desktop cannot disagree about what is
     owed or what it is called; the row itself is U.needsRow in compact mode —
     no bullet bar, no chain, no rung sub-line, the same acts. Return, Reject
     and Dismiss open the inline composer that p6.js's document-level listener
     answers, so the phone never opens the refs modal except for Mark Approved,
     where two mandatory reference numbers are not a one-line answer (R-4). */

  function group(title, cards) {
    if (!cards.length) return '';
    return '<div class="p10-group"><h3>' + e(title) +
      '<span class="n num">' + cards.length + '</span></h3>' + cards.join('') + '</div>';
  }

  /* the phone's one-tap way into the agreement: the row's own "Open agreement"
     control routes to #/contracts/<id>, where the detail view opens and CT3 is
     one control away — so there is nothing to add here beyond the shared row.
     CBP.p6.needsRow is U.needsRow with the page-level composer masking P6 and
     P10 both need; the fallback keeps the phone rendering if p6.js is absent. */
  function rowHtml(item) {
    return (CBP.p6 && CBP.p6.needsRow)
      ? CBP.p6.needsRow(item, { compact: true })
      : U.needsRow(item, { compact: true });
  }

  function approvals(state, user) {
    var items = D.needsYou(user);
    var owed = items.filter(function (it) {
      return it.kind !== 'watching' && (it.actions || []).length > 0;
    });

    /* (e) viewers and M3 hold no approval queue — the same read-only note as
       v1.1.0, with the rows they may still follow underneath it */
    var watching = items.filter(function (it) { return it.kind === 'watching'; });
    if (!owed.length) {
      return '<section class="p10-sec"><h2>Approvals</h2>' +
        '<div class="p10-readonly"><b>Nothing actionable for you</b>' +
        '<span>No approval action is yours to take in this role (permission matrix · RD/RM-3). ' +
        (watching.length
          ? watching.length + ' record' + (watching.length === 1 ? ' is' : 's are') +
            ' at status 3 in your scope, listed below read-only.'
          : 'Nothing in your scope is at status 3.') +
        '</span></div>' +
        watching.map(rowHtml).join('') +
        '</section>';
    }

    var body = D.NEEDS_CHIPS.filter(function (c) {
      return !!c.kinds;                      /* 'all' and 'mine' are not groups */
    }).map(function (c) {
      return group(c.label, items.filter(function (it) {
        return c.kinds.indexOf(it.kind) > -1;
      }).map(rowHtml));
    }).join('');

    return '<section class="p10-sec">' +
      '<h2>Needs you<span class="n num">' + owed.length + '</span></h2>' +
      (body || '<div class="p10-empty">Nothing is waiting on you right now.</div>') +
      '<p class="p10-note">A reason is typed on the row itself. Mark Approved opens the ' +
      'reference form, and an agreement opens in the register, where the signing ceremony ' +
      'needs the whole document scrolled before a signature is taken.</p>' +
      '</section>';
  }

  /* ================================================= (d) updates feed ===== */

  function updates(state, s, scoped) {
    var byId = {};
    scoped.forEach(function (p) { byId[p.id] = p; });

    var rows = (state.activity || []).filter(function (x) {
      var pid = x.project || x.project_id;
      return byId[pid] && inPeriod(s, x.at);
    }).slice().sort(function (a, b) {
      if (a.at !== b.at) return a.at < b.at ? 1 : -1;      /* newest first */
      return seq(b.id) - seq(a.id);
    });

    var list = rows.map(function (x) {
      var pid = x.project || x.project_id;
      var p = byId[pid];
      return '<a class="p10-entry" href="#/project/' + e(pid) + '">' +
        '<div class="p10-emeta">' +
          '<span class="p10-type t-' + e(x.type) + '">' +
            e(TYPE_LABEL[x.type] || x.type) + '</span>' +
          '<b>' + e(x.type === 'system' ? 'System' : CBP.userName(x.author)) + '</b>' +
          '<span class="num">' + e(D.fmtDateY(x.at)) + '</span>' +
          (x.type === 'question' && !x.resolved_at
            ? '<span class="p10-type t-open">Open → ' +
              e(CBP.userName(x.assigned_to)) + '</span>' : '') +
          (x.pinned ? '<span class="p10-type t-pinned">Pinned</span>' : '') +
        '</div>' +
        '<div class="p10-etx">' + e(x.body) + '</div>' +
        '<div class="p10-eprj num">' + e(pid) + ' · ' + e(p.name) + '</div>' +
        '</a>';
    }).join('');

    return '<section class="p10-sec">' +
      '<h2>Updates<span class="n num">' + rows.length + '</span></h2>' +
      (rows.length ? '<div class="p10-feed">' + list + '</div>'
        : '<div class="p10-empty">No update in your scope ' + e(periodLabel(s)) +
          '. Try a longer period.</div>') +
      '</section>';
  }

  function seq(id) {
    var m = /(\d+)$/.exec(String(id || ''));
    return m ? parseInt(m[1], 10) : 0;
  }

  /* ==================================================== event wiring ====== */

  function on10() {
    return CBP.state && CBP.state.ui && CBP.state.ui.route === 'mobile' && CBP.state.ui.p10;
  }

  function closest(node, sel) {
    return (node && node.closest) ? node.closest(sel) : null;
  }

  document.addEventListener('click', function (ev) {
    if (!on10()) return;
    var s = CBP.state.ui.p10;
    var t = closest(ev.target, '[data-p10]');
    if (!t) return;
    var act = t.getAttribute('data-p10');

    if (act === 'period') {
      ev.preventDefault();
      s.period = t.getAttribute('data-k');
      CBP.render();

    } else if (act === 'fullsite') {
      /* RM-7 — remember the escape, then let the link navigate */
      s.fullSite = true;

    } else if (act === 'stay') {
      ev.preventDefault();
      s.fullSite = false;
      CBP.render();
    }
  });

  document.addEventListener('change', function (ev) {
    if (!on10()) return;
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    var k = t.getAttribute('data-p10');
    if (k !== 'from' && k !== 'to') return;
    var s = CBP.state.ui.p10;
    s[k] = t.value || s[k];
    if (s.from > s.to) {                 /* keep the window the right way round */
      var a = s.from; s.from = s.to; s.to = a;
    }
    CBP.render();
  });

})();
