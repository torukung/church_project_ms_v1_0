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

  var D = CBP.D, A = CBP.actions, P4 = CBP.p4, e = CBP.ui.esc;
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

    /* -------------------------------------------------- (c) approvals ---- */
    html += approvals(state, user, scoped);

    /* ---------------------------------------------------- (d) updates ---- */
    html += updates(state, s, scoped);

    html += '<p class="p10-note">Quick view shows approvals and updates only. ' +
      'Day counts derive against ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) +
      '; the feed covers ' + e(periodLabel(s)) + '. Open the full site for the register, ' +
      'dashboards, timeline and budget.</p>';

    return html + '</div></div>' + P4.modal(state);
  };

  /* =============================================== (c) approvals section == */

  /* The same four queues P6 builds, from the same helpers — read only, never a
     second copy of the rules. */
  function queues(user, scoped) {
    return {
      reviews: scoped.filter(function (p) { return p.status === 3 && !A.gateOpen(p); }),
      gates: scoped.filter(function (p) {
        return p.status === 3 && A.gateOpen(p) && !A.bothApproved(p);
      }),
      ready: scoped.filter(function (p) { return A.readyToMark(p); }),
      mine: scoped.filter(function (p) {
        return p.status === 4 && (p.owner === user.id || p.backup === user.id);
      })
    };
  }

  function waitLine(p) {
    var open = D.openGates(p);
    if (open.length) {
      var g = open.sort(function (a, b) { return b.days - a.days; })[0];
      return { days: g.days, at: 'Gate · ' + g.label, tone: g.overdue ? 'hot' : 'warm' };
    }
    if (A.readyToMark(p)) return { days: D.daysInStage(p), at: 'Both gates ✓', tone: 'warm' };
    if (p.status === 4) return { days: D.daysInStage(p), at: 'In development', tone: '' };
    var w = D.daysInStage(p);
    return { days: w, at: 'Process 3 · review',
             tone: (w !== null && w > CBP.CONFIG.REVIEW_THRESHOLD_DAYS) ? 'warm' : '' };
  }

  function card(p, acts) {
    var w = waitLine(p);
    return '<article class="p10-card">' +
      '<div class="p10-cardhd">' +
        '<a class="p10-id num" href="#/project/' + e(p.id) + '">' + e(p.id) + '</a>' +
        '<span class="p10-age ' + w.tone + ' num">' +
          e(w.days === null ? '—' : D.days(w.days)) + '</span>' +
      '</div>' +
      '<b class="p10-name">' + e(p.name) + '</b>' +
      '<div class="p10-meta">' + e(P4.countryName(p.country)) + ' · ' +
        '<span class="num">' + e(D.money(p.amount)) + '</span> · ' + e(w.at) + '</div>' +
      (acts.length ? '<div class="p10-acts">' + acts.join('') + '</div>' : '') +
      '</article>';
  }

  function group(title, cards) {
    if (!cards.length) return '';
    return '<div class="p10-group"><h3>' + e(title) +
      '<span class="n num">' + cards.length + '</span></h3>' + cards.join('') + '</div>';
  }

  function approvals(state, user, scoped) {
    var canReview = D.can(user, 'review');
    var canSubmit = D.can(user, 'submit');
    var q = queues(user, scoped);

    /* (e) viewers and M3 hold no approval queue — a read-only note, then the feed */
    if (!canReview && !canSubmit) {
      var waiting = scoped.filter(function (p) { return p.status === 3; }).length;
      return '<section class="p10-sec"><h2>Approvals</h2>' +
        '<div class="p10-readonly"><b>Nothing actionable for you</b>' +
        '<span>No approval action is yours to take in this role (permission matrix · RD/RM-3). ' +
        (waiting
          ? waiting + ' record' + (waiting === 1 ? ' is' : 's are') +
            ' at status 3 in your scope; follow them in the updates below.'
          : 'Nothing in your scope is at status 3.') +
        '</span></div></section>';
    }

    var body = '';
    if (canReview) {
      body += group('Awaiting your review', q.reviews.map(function (p) {
        return card(p, [
          P4.btn('Request approved', 'ask-approve', p.id, { brass: true }),
          P4.btn('Return to Review', 'ask-return', p.id)
        ]);
      }));
      body += group('Open gate items', q.gates.map(function (p) {
        return card(p, [P4.btn('Update gate', 'ask-gate', p.id, { brass: true })]);
      }));
      body += group('Ready to Mark Approved', q.ready.map(function (p) {
        return card(p, [P4.btn('Mark Approved', 'ask-mark', p.id, { brass: true })]);
      }));
    }
    if (canSubmit) {
      body += group('Ready to submit', q.mine.map(function (p) {
        return card(p, [P4.btn('Request submitted', 'ask-submit', p.id, { brass: true })]);
      }));
    }

    var n = (canReview ? q.reviews.length + q.gates.length + q.ready.length : 0) +
            (canSubmit ? q.mine.length : 0);

    return '<section class="p10-sec">' +
      '<h2>Approvals<span class="n num">' + n + '</span></h2>' +
      (body || '<div class="p10-empty">Nothing is waiting on you right now.</div>') +
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
