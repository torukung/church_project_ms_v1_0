/* pages/p15.js — v1.2.0 · P15 Portfolio, route #/portfolio.

   The Area Manager's home: every country in scope as one ordered bar list, so
   an outlier shows without opening anything. The drill is deliberately two
   clicks to a project — country row (→ #/country/<code>) then a project link on
   that country's Needs-you or waiting list (→ #/project/<id>) — which is the
   DoD 6 measurement.

   The rows come from D.portfolio(user) and are drawn by U.countryBarRow(c);
   this page contributes the sort control, the status mix strip and the
   exceptions block, and nothing else computes a rollup of its own. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};

  /* the four sorts the page offers. `exceptions` is a page-level ordering:
     D.PORTFOLIO_SORTS has no such key, so derive returns its default order and
     this page re-sorts by how many exceptions each country carries. */
  var SORTS = [
    { k: 'coverage',   label: 'Coverage' },
    { k: 'committed',  label: 'Committed' },
    { k: 'name',       label: 'Name' },
    { k: 'exceptions', label: 'Exceptions' }
  ];

  function sortKey(state) {
    var k = state.ui.portfolioSort || 'coverage';
    return SORTS.filter(function (s) { return s.k === k; })[0] ? k : 'coverage';
  }

  function sortBar(state) {
    var cur = sortKey(state);
    return '<div class="home-sort" role="group" aria-label="Order the country list">' +
      '<span class="cslab">Order by</span>' +
      SORTS.map(function (s) {
        return '<button class="cchip' + (cur === s.k ? ' on' : '') +
          '" data-act="p15-sort" data-s="' + e(s.k) + '" aria-pressed="' +
          (cur === s.k ? 'true' : 'false') + '">' + e(s.label) + '</button>';
      }).join('') + '</div>';
  }

  function statusMix(rows) {
    var tot = { s1: 0, s2: 0, s3: 0, s4: 0, declined: 0 };
    rows.forEach(function (r) {
      tot.s1 += r.counts.s1; tot.s2 += r.counts.s2; tot.s3 += r.counts.s3;
      tot.s4 += r.counts.s4; tot.declined += r.counts.declined;
    });
    var live = tot.s1 + tot.s2 + tot.s3 + tot.s4;
    var CELLS = [
      { k: 's1', c: '1', label: 'Implementation' },
      { k: 's2', c: '2', label: 'Approved' },
      { k: 's3', c: '3', label: 'Submitted' },
      { k: 's4', c: '4', label: 'In development' }
    ];
    var bar = '<div class="mix-bar">' + CELLS.map(function (x) {
      var v = tot[x.k];
      if (!v || !live) return '';
      return '<span class="mix-seg s' + x.c + '" style="width:' +
        (v / live * 100).toFixed(2) + '%" title="' + e(x.label + ' — ' + v) + '"></span>';
    }).join('') + '</div>';

    var keys = '<ul class="mix-keys">' + CELLS.map(function (x) {
      return '<li><span class="mix-dot s' + x.c + '"></span>' + e(x.label) +
        '<b class="num">' + tot[x.k] + '</b></li>';
    }).join('') +
      (tot.declined ? '<li class="mix-dec"><span class="mix-dot sx"></span>Declined' +
        '<b class="num">' + tot.declined + '</b></li>' : '') + '</ul>';

    return bar + keys +
      '<p class="home-note">' + live + ' live record' + (live === 1 ? '' : 's') +
      ' across ' + rows.length + ' countr' + (rows.length === 1 ? 'y' : 'ies') +
      (tot.declined ? '; declined records are counted separately and carry no committed money.'
                    : '.') + '</p>';
  }

  function card(title, sub, body, cls) {
    return '<section class="home-card' + (cls ? ' ' + cls : '') + '">' +
      '<header class="home-card-hd"><div class="hc-title"><b>' + e(title) + '</b></div>' +
      (sub ? '<div class="hc-meta">' + e(sub) + '</div>' : '') + '</header>' +
      '<div class="home-card-bd home-card-flow">' + body + '</div></section>';
  }

  CBP.pages.portfolio = function (state) {
    if (!U.requireRole(state, ['m2', 'admin'])) return '';

    var rows = D.portfolio(state.user);
    if (sortKey(state) === 'exceptions') {
      rows = rows.slice().sort(function (a, b) {
        return (b.exceptions.length - a.exceptions.length) ||
               ((b.coverage || 0) - (a.coverage || 0));
      });
    }

    var committed = rows.reduce(function (a, r) { return a + r.committed; }, 0);
    var ceiling = rows.reduce(function (a, r) { return a + r.ceiling; }, 0);
    var ex = [];
    rows.forEach(function (r) { ex = ex.concat(r.exceptions); });

    var html = '<div class="crumb">Home · Portfolio</div>' +
      '<div class="pagehead"><h1>Portfolio</h1>' +
      '<span class="sub">' + rows.length + ' countr' + (rows.length === 1 ? 'y' : 'ies') +
      ' · ' + e(D.money(committed)) + ' committed of ' + e(D.money(ceiling)) + ' ceiling · ' +
      e(D.pct(D.coverage(committed, ceiling))) + ' coverage</span></div>';

    html += '<div class="home-wrap">';

    var list = rows.length
      ? '<div class="home-bars">' + rows.map(function (c) {
          return U.countryBarRow(c);
        }).join('') + '</div>'
      : '<p class="home-quiet">No country is inside your data scope.</p>';

    html += card('Countries', 'Open a country to reach its queue — a project is two clicks away.',
      sortBar(state) + list, 'home-wide');

    html += card('Status mix', 'Every record in scope by rung', statusMix(rows));

    var exBody = ex.length
      ? '<ul class="home-ex">' + ex.map(function (x) {
          var text = '<span class="ex-dot ' + e(x.tone || '') + '" aria-hidden="true"></span>' +
                     e(x.text);
          return '<li class="' + e(x.tone || '') + '">' + (x.project_id
            ? '<a href="#/project/' + e(x.project_id) + '">' + text + '</a>'
            : '<a href="#/country/' + e(x.code) + '">' + text + '</a>') + '</li>';
        }).join('') + '</ul>'
      : '<p class="home-quiet">Nothing is over ceiling, past target or unowned.</p>';

    html += card('Exceptions', ex.length ? ex.length + ' across the portfolio' : 'All clear',
      exBody);

    html += '</div>';

    html += '<p class="pagenote">Coverage compares committed budget across statuses 1–4 with ' +
      'the country ceiling; values above 100% appear in red. Amounts in USD, derived against ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + '.</p>';

    return html;
  };

  /* ------------------------------------------------------------- events -- */

  if (!CBP.p15) {
    CBP.p15 = { wired: true };
    document.addEventListener('click', function (ev) {
      var s = CBP.state;
      if (!s || !s.ui) return;

      var sortBtn = ev.target.closest ? ev.target.closest('[data-act="p15-sort"]') : null;
      if (sortBtn) {
        ev.preventDefault();
        s.ui.portfolioSort = sortBtn.getAttribute('data-s') || 'coverage';
        CBP.render();
        return;
      }

      /* the country row is a real link; remember which country it opened so the
         chip strip on P14 arrives on the right one */
      var row = ev.target.closest ? ev.target.closest('a.cbar-row') : null;
      if (!row) return;
      var href = row.getAttribute('href') || '';
      var m = href.match(/#\/country\/(.+)$/);
      if (m) s.ui.homeCountry = decodeURIComponent(m[1]);
    });
  }

})();
