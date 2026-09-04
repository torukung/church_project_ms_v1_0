/* pages/p17.js — v1.2.0 · P17 Viewer home, route #/viewer.

   The area authority's read: one headline, the counts behind it, the handful of
   exceptions worth knowing about, and coverage per country. Everything comes
   from D.viewerSummary(user), which is read-only by construction — it contains
   no act name, no permission and no control.

   The page holds exactly ONE button: Export (RD-3), which prints the shared
   U.printPack pre-read (F27). Every other affordance is a link. That is the
   DoD 6 assertion — a viewer has zero action controls — and the walk checks it
   by counting button[data-act] on the rendered page. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};

  function card(title, sub, body, cls) {
    return '<section class="home-card' + (cls ? ' ' + cls : '') + '">' +
      '<header class="home-card-hd"><div class="hc-title"><b>' + e(title) + '</b></div>' +
      (sub ? '<div class="hc-meta">' + e(sub) + '</div>' : '') + '</header>' +
      '<div class="home-card-bd home-card-flow">' + body + '</div></section>';
  }

  function tiles(s) {
    return U.kpiRow([
      U.kpi('Committed', D.money(s.committed), 'across ' + s.counts.all + ' records'),
      U.kpi('Ceiling', D.money(s.ceiling), CBP.CONFIG.BUDGET_YEAR + ' budget year'),
      U.kpi('Coverage', D.pct(s.coverage), 'committed against ceiling',
            D.coverageClass(s.coverage) === 'over'),
      U.kpi('In implementation', String(s.counts.s1), 'of ' + s.counts.all + ' records'),
      U.kpi('Awaiting a decision', String(s.counts.s3), 'submitted and in review'),
      U.kpi('Declined', String(s.counts.declined), 'not committed money')
    ]);
  }

  function coverageRows(s) {
    if (!s.countries.length) return '<p class="home-quiet">No country is inside your view scope.</p>';
    return '<div class="home-bars">' + s.countries.map(function (c) {
      return U.countryBarRow(c);
    }).join('') + '</div>';
  }

  function exceptions(s) {
    if (!s.topExceptions.length) {
      return '<p class="home-quiet">Nothing is over ceiling, past target or unowned.</p>';
    }
    return '<ul class="home-ex">' + s.topExceptions.map(function (x) {
      var text = '<span class="ex-dot ' + e(x.tone || '') + '" aria-hidden="true"></span>' +
                 e(x.text);
      return '<li class="' + e(x.tone || '') + '">' + (x.project_id
        ? '<a href="#/project/' + e(x.project_id) + '">' + text + '</a>'
        : '<a href="#/country/' + e(x.code) + '">' + text + '</a>') + '</li>';
    }).join('') + '</ul>';
  }

  function printHeader(state, s) {
    return '<h2>Area summary — ' + e(CBP.CONFIG.BUDGET_YEAR) + '</h2>' +
      '<p>Prepared ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) + ' · ' + e(state.user.name) + '</p>' +
      '<p>' + e(s.headline) + '</p>' +
      '<ol>' + s.countries.map(function (c) {
        return '<li>' + e(c.name) + ' — ' + e(D.money(c.committed)) + ' of ' +
          e(D.money(c.ceiling)) + ' · ' + e(D.pct(c.coverage)) + '</li>';
      }).join('') + '</ol>';
  }

  CBP.pages.viewer = function (state) {
    if (!U.requireRole(state, ['viewer', 'admin'])) return '';

    var s = D.viewerSummary(state.user);
    if (!s) return U.card('Summary', '<p>No data is in view.</p>');

    var html = '<div class="crumb">Home · Summary</div>' +
      '<div class="pagehead"><h1>Area summary</h1>' +
      '<span class="sub">' + e(s.headline) + '</span>' +
      (D.can(state.user, 'export')
        ? '<div class="sp"><button class="btn" data-act="p17-export">Export</button></div>' : '') +
      '</div>';

    html += U.printPack(printHeader(state, s));

    html += '<div class="home-wrap">';
    html += card('Where the money is', 'Budget year ' + CBP.CONFIG.BUDGET_YEAR, tiles(s),
                 'home-wide');
    html += card('Worth knowing about',
      s.topExceptions.length ? 'The ' + s.topExceptions.length + ' loudest exceptions'
                             : 'All clear', exceptions(s));
    html += card('Coverage by country', 'Committed against ceiling, highest first',
      coverageRows(s), 'home-wide');
    html += '</div>';

    html += '<p class="pagenote">This view is read-only: it reports the record, it does not ' +
      'change it. Amounts in USD; coverage compares committed budget across statuses 1–4 with ' +
      'the country ceiling, derived against ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) + '.</p>';

    return html;
  };

  /* ------------------------------------------------------------- events -- */

  if (!CBP.p17) {
    CBP.p17 = { wired: true };
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-act="p17-export"]') : null;
      if (!t) return;
      ev.preventDefault();
      document.body.classList.add('p2-printing');
      var clear = function () { document.body.classList.remove('p2-printing'); };
      try { window.addEventListener('afterprint', clear, { once: true }); } catch (err) {}
      try { window.print(); } catch (err) {}
      window.setTimeout(clear, 1200);
    });
  }

})();
