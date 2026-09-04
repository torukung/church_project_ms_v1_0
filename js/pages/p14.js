/* pages/p14.js — v1.2.0 · P14 Country Head home, route #/country[/<code>].

   The Regional Manager's home reads top to bottom in the order the job is
   done: what needs this person now (D.needsYou, already ordered overdue →
   oldest → id), then the money behind it (the budgettrack widget for the
   countries in view), then the exceptions, then everything that is simply
   sitting there past its wait.

   The Needs-you rows are U.needsRow(item, {}) — the same row P6 and P10 draw,
   so the p6r-* inline composer registered by p6.js works here with no listener
   of our own (T-10/F29). The widget is called in the frozen shape
   W.byId('budgettrack').render(state, codes, W.ctx(state, codes)) (F14) inside
   this page's own .home-card chrome, because the .dw-* frame belongs to p2.js
   and is not a shared component. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, W = CBP.W, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};

  var WAIT_DAYS = 14;   /* the "waiting more than N days" cut for the tail list */

  function countryName(state, code) {
    var c = (state.countries || []).filter(function (x) { return x.code === code; })[0];
    return c ? c.name : String(code || '');
  }

  /* which countries this page is looking at: the one picked (chip, or the code
     in #/country/<code>) or, for an M1 with several, all of them. */
  function codesInView(state) {
    var all = D.visibleCountries(state.user, state.countries);
    var pick = (state.ui.route === 'country' && state.ui.param) || state.ui.homeCountry || null;
    if (pick && all.indexOf(pick) > -1) return { codes: [pick], pick: pick, all: all };
    return { codes: all, pick: null, all: all };
  }

  function chips(state, view) {
    if (view.all.length < 2) return '';
    var one = view.all.map(function (c) {
      return '<button class="cchip ccsel ' + U.ccOf(c) + (view.pick === c ? ' on' : '') +
        '" data-act="p14-country" data-c="' + e(c) + '" aria-pressed="' +
        (view.pick === c ? 'true' : 'false') + '">' + U.flagMark(c) +
        e(countryName(state, c)) + '</button>';
    }).join('');
    return '<div class="cselect home-chips" role="group" aria-label="Choose a country">' +
      '<span class="cslab">Country</span>' +
      '<button class="cchip' + (view.pick ? '' : ' on') + '" data-act="p14-country" data-c="" ' +
      'aria-pressed="' + (view.pick ? 'false' : 'true') + '">All ' + view.all.length +
      ' <span class="n num">' + view.all.length + '</span></button>' + one +
      '<span class="cshint">' + e(view.pick
        ? 'Showing ' + countryName(state, view.pick) + ' only.'
        : 'Showing every country you cover.') + '</span></div>';
  }

  /* one D.countryHome per country in view, merged */
  function gather(state, codes) {
    var needs = [], exceptions = [], waiting = [], rollups = [];
    codes.forEach(function (code) {
      var h = D.countryHome(state.user, code);
      if (!h) return;
      needs = needs.concat(h.needs || []);
      exceptions = exceptions.concat(h.exceptions || []);
      waiting = waiting.concat(h.waiting || []);
      if (h.rollup) rollups.push(h.rollup);
    });
    /* D.needsYou is already ordered; concatenating per country breaks that, so
       re-apply the one ordering rule (overdue → waiting desc → id asc) */
    needs.sort(function (a, b) {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if ((b.waiting_days || 0) !== (a.waiting_days || 0)) {
        return (b.waiting_days || 0) - (a.waiting_days || 0);
      }
      return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0);
    });
    waiting.sort(function (a, b) {
      return (b.days - a.days) || (a.project.id < b.project.id ? -1 : 1);
    });
    return { needs: needs, exceptions: exceptions, waiting: waiting, rollups: rollups };
  }

  function card(title, sub, body, cls) {
    return '<section class="home-card' + (cls ? ' ' + cls : '') + '">' +
      '<header class="home-card-hd"><div class="hc-title"><b>' + e(title) + '</b></div>' +
      (sub ? '<div class="hc-meta">' + e(sub) + '</div>' : '') + '</header>' +
      '<div class="home-card-bd home-card-flow">' + body + '</div></section>';
  }

  function budgetTrack(state, codes) {
    var w = W.byId('budgettrack');            /* W.registry is an array (F14) */
    if (!w) return '';
    var body;
    try {
      body = w.render(state, codes, W.ctx(state, codes));
    } catch (err) {
      body = '<p class="p2-empty">The budget track could not render for this scope.</p>';
    }
    return card('Budget track — country detail',
      'Ceiling against the spend split across the four rungs. Open a country row to see the ' +
      'records behind its columns.', body, 'home-wide');
  }

  function exceptionsBlock(rows) {
    if (!rows.length) {
      return card('Exceptions', 'Nothing is over ceiling, past target or unowned in this scope.',
        '<p class="home-quiet">All clear.</p>');
    }
    var list = '<ul class="home-ex">' + rows.map(function (x) {
      var text = '<span class="ex-dot ' + e(x.tone || '') + '" aria-hidden="true"></span>' +
                 e(x.text);
      return '<li class="' + e(x.tone || '') + '">' + (x.project_id
        ? '<a href="#/project/' + e(x.project_id) + '">' + text + '</a>'
        : text) + '</li>';
    }).join('') + '</ul>';
    return card('Exceptions', rows.length + ' item' + (rows.length === 1 ? '' : 's') +
      ' in this scope', list);
  }

  function waitingBlock(state, rows) {
    var late = rows.filter(function (r) { return r.days > WAIT_DAYS; });
    if (!late.length) {
      return card('Waiting more than ' + WAIT_DAYS + ' days',
        'Nothing in this scope has been sitting longer than ' + WAIT_DAYS + ' days.',
        '<p class="home-quiet">Nothing is stuck.</p>');
    }
    var list = '<ul class="home-wait">' + late.map(function (r) {
      var p = r.project;
      return '<li><a href="#/project/' + e(p.id) + '">' +
        '<span class="wl-id num">' + e(p.id) + '</span>' +
        '<span class="wl-name">' + U.flagMark(p.country) + e(p.name) + '</span>' +
        '<span class="wl-at">' + e(r.at || '') + '</span>' +
        '<span class="wl-days num ' + e(r.tone || '') + '">' + e(D.days(r.days)) + '</span>' +
        '</a></li>';
    }).join('') + '</ul>';
    return card('Waiting more than ' + WAIT_DAYS + ' days',
      late.length + ' record' + (late.length === 1 ? '' : 's') + ' · oldest first', list);
  }

  CBP.pages.country = function (state) {
    if (!U.requireRole(state, ['m1', 'm2', 'admin'])) return '';

    var view = codesInView(state);
    var g = gather(state, view.codes);
    var title = view.pick ? countryName(state, view.pick) : 'My countries';

    var committed = g.rollups.reduce(function (a, r) { return a + r.committed; }, 0);
    var ceiling = g.rollups.reduce(function (a, r) { return a + r.ceiling; }, 0);

    var html = '<div class="crumb">Home · Country</div>' +
      '<div class="pagehead"><h1>' + e(title) + '</h1>' +
      '<span class="sub">' + g.needs.length + ' item' + (g.needs.length === 1 ? '' : 's') +
      ' need you · ' + e(D.money(committed)) + ' committed of ' + e(D.money(ceiling)) +
      ' ceiling · ' + e(D.pct(D.coverage(committed, ceiling))) + ' coverage</span></div>';

    html += chips(state, view);
    html += '<div class="home-wrap">';

    /* ------------------------------------------------- needs you (top) --- */
    var needsBody = g.needs.length
      ? '<div class="p6-list">' + g.needs.map(function (it) {
          return U.needsRow(it, {});
        }).join('') + '</div>'
      : '<p class="home-quiet">Nothing is waiting on you in this scope right now. ' +
        'The full list across every country you cover is at ' +
        '<a href="#/approvals">Needs you</a>.</p>';

    html += card('Needs you',
      g.needs.length
        ? 'Overdue first, then longest waiting. Return and Reject ask for a reason on the row.'
        : 'Nothing to act on.',
      needsBody, 'home-needs');

    html += budgetTrack(state, view.codes);
    html += exceptionsBlock(g.exceptions);
    html += waitingBlock(state, g.waiting);
    html += '</div>';
    if (state.ui.focusId && CBP.home) CBP.home.scrollToFocus();

    html += '<p class="pagenote">Amounts in USD. Day counts are derived against ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + ', never stored. This page shows only the countries ' +
      'inside your data scope.</p>';

    /* audit G1 — Needs-you rows emit ask-* acts; the P4 modal must be on this page too */
    return html + (CBP.p4 && CBP.p4.modal ? CBP.p4.modal(state) : '');
  };

  /* ------------------------------------------------------ country picker -- */

  /* one page-owned delegated listener, registered once (house rule) */
  if (!CBP.p14) {
    CBP.p14 = { wired: true };
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-act="p14-country"]') : null;
      if (!t) return;
      var s = CBP.state;
      if (!s || !s.ui || (s.ui.route !== 'country' && s.ui.route !== 'home')) return;
      ev.preventDefault();
      var code = t.getAttribute('data-c') || null;
      s.ui.homeCountry = code || null;
      /* a code in the hash outranks the chip, so clear it when one is set */
      if (s.ui.route === 'country' && s.ui.param) {
        s.ui.param = null;
        try { location.hash = '#/country'; return; } catch (err) { /* fall through */ }
      }
      CBP.render();
    });
  }

})();
