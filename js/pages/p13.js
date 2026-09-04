/* pages/p13.js — v1.2.0 · route `home` (the role dispatcher) and P13 Worker home.

   `home` is the one route every persona shares. It renders the page
   U.homeFor(role) names — worker · country · portfolio · reviews · viewer ·
   dashboard (admin) — WITHOUT touching the hash, so a deep link of the form
   #/home/<project id> survives the dispatch and its ui.focusId still reaches
   the row that must be highlighted (F4, F28).

   P13 itself is the Team Member's home: the projects this person owns or backs
   up, each one a card carrying the four-rung stepper, the GOV.UK-style task
   list from D.projectTaskList, and the headroom left in that project's country.
   Records that came back from review lead the page in their own strip, with the
   reason the reviewer gave. Nothing else on the page — a worker's home is a
   worklist, not a dashboard. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, W = CBP.W, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};

  /* ======================================================= route: home ==== */

  /* No hash write here: `#/home` and `#/home/<id>` both stay exactly as typed
     and the page underneath is chosen from the signed-in role. */
  CBP.pages.home = function (state) {
    var target = U.homeFor(state.user.role);
    var page = CBP.pages[target];
    if (!page) return CBP.pages.worker(state);
    return page(state);
  };

  /* The admin's home IS the dashboard (T-11), but p2.js only listens while
     ui.route === 'dashboard', so a board rendered under #/home would be inert.
     A capture-phase listener — capture runs before every bubble listener no
     matter which file registered first — moves the route to the real dashboard
     on the first dashboard control the admin touches, and p2's own handler then
     sees the state it expects on the same click. */
  document.addEventListener('click', function (ev) {
    var s = CBP.state;
    if (!s || !s.ui || s.ui.route !== 'home') return;
    if (U.homeFor(s.user.role) !== 'dashboard') return;
    var t = ev.target.closest ? ev.target.closest('[data-p2]') : null;
    if (!t) return;
    s.ui.route = 'dashboard';
    s.ui.param = null;
    try { location.hash = '#/dashboard'; } catch (err) { /* file:// guard */ }
  }, true);

  /* --------------------------------------------------------- focus (F28) -
     ui.focusId arrives from a mail deep link (#/home/<id>). The row markup is
     already marked .is-focused by the page that drew it; bringing it into view
     is the page's job, once per render, after the html is in the DOM. Shared by
     P13, P14 and P16 (P6/P10 keep their own copy for the .p6-card selector). */

  var scrollPending = false;

  CBP.home = CBP.home || {};
  CBP.home.scrollToFocus = function () {
    if (scrollPending) return;
    scrollPending = true;
    setTimeout(function () {
      scrollPending = false;
      var el = document.querySelector('.home-wrap .is-focused, .p16-list .is-focused');
      if (el && el.scrollIntoView) {
        try { el.scrollIntoView({ block: 'center' }); } catch (err) { el.scrollIntoView(); }
      }
    }, 0);
  };

  /* ================================================== P13 · Worker home === */

  var RETURN_RE = /return/i;

  function countryName(code) {
    var c = (CBP.state.countries || []).filter(function (x) { return x.code === code; })[0];
    return c ? c.name : String(code || '');
  }

  /* why did this record come back? the reviewer's reason is on the project when
     the action recorded one, otherwise it is the newest system line that talks
     about a return (D.chainFor reads the same stream). */
  function returnReason(p) {
    if (p.return_reason) return String(p.return_reason);
    var st = CBP.state;
    var hit = null;
    (st.activity || []).forEach(function (a) {
      if (a.project !== p.id || a.type !== 'system') return;
      if (!RETURN_RE.test(a.body || '')) return;
      hit = a;
    });
    if (!hit) return '';
    var body = String(hit.body || '');
    var m = body.match(/—\s*(.+)$/);
    return m ? m[1] : body;
  }

  function myProjects(state) {
    var uid = state.user.id;
    return D.visibleProjects(state.user, state.projects, state.countries)
      .filter(function (p) { return p.owner === uid || p.backup === uid; });
  }

  /* one headroom reading per country, shared by every card on the page so the
     100% rule sits on one line down the column */
  function headroomMap(state, projects) {
    var codes = [];
    projects.forEach(function (p) {
      if (codes.indexOf(p.country) === -1) codes.push(p.country);
    });
    var scoped = state.projects.filter(function (p) { return codes.indexOf(p.country) > -1; });
    var rows = D.countryRollup(scoped, state.countries, codes);
    var scale = D.barScale(rows.map(function (r) {
      return r.ceiling ? (r.committed / r.ceiling * 100) : 0;
    }));
    var map = {};
    rows.forEach(function (r) {
      var by = D.spendByStatus(r.projects);
      map[r.code] = {
        row: r, scale: scale,
        byStatus: { 1: by.s1, 2: by.s2, 3: by.s3, 4: by.s4 }
      };
    });
    return map;
  }

  function headroomBar(h) {
    if (!h) return '';
    var r = h.row;
    var bar = (W && W.budgetBar) ? W.budgetBar(h.byStatus, r.ceiling, { scale: h.scale }) : '';
    return '<div class="home-head-bar">' +
      '<div class="hhb-lab"><span>' + e(r.name) + ' headroom</span>' +
      '<b class="num' + (r.headroom < 0 ? ' neg' : '') + '">' + e(D.money(r.headroom)) + '</b></div>' +
      bar +
      '<div class="hhb-fig num">' + e(D.money(r.committed)) + ' committed of ' +
      e(D.money(r.ceiling)) + ' ceiling · ' + e(D.pct(r.coverage)) + '</div>' +
      '</div>';
  }

  function projectCard(state, p, hmap, focused) {
    var rows = D.projectTaskList(p);
    var open = rows.filter(function (r) { return r.status === 'todo'; }).length;

    return '<section class="home-card home-proj' + (focused ? ' is-focused' : '') +
      '" data-id="' + e(p.id) + '">' +
      '<header class="home-card-hd">' +
        '<div class="hc-title">' +
          '<a class="hc-id num" href="#/project/' + e(p.id) + '">' + e(p.id) + '</a>' +
          '<b>' + U.flagMark(p.country) + e(p.name) + '</b>' +
        '</div>' +
        '<div class="hc-meta">' + e(D.money(p.amount)) +
          ' · ' + e(countryName(p.country)) +
          ' · ' + e(p.owner === state.user.id ? 'you own this' : 'you are the backup') +
        '</div>' +
      '</header>' +
      '<div class="home-card-bd">' +
        '<div class="hc-left">' + U.stepper(p) +
          '<div class="hc-tasks"><h3>What is left to do' +
          (open ? ' <span class="num">' + open + '</span>' : '') + '</h3>' +
          U.taskList(rows) + '</div>' +
        '</div>' +
        '<div class="hc-right">' + headroomBar(hmap[p.country]) + '</div>' +
      '</div>' +
      '</section>';
  }

  function returnedStrip(state, mine) {
    var back = mine.filter(function (p) { return D.wasReturned(p); });
    if (!back.length) return '';
    return '<section class="home-card home-returned">' +
      '<header class="home-card-hd"><div class="hc-title"><b>Returned to you</b></div>' +
      '<div class="hc-meta">' + back.length + ' record' + (back.length === 1 ? '' : 's') +
      ' came back from review — read the reason, fix it, submit again.</div></header>' +
      '<ul class="home-rlist">' + back.map(function (p) {
        var why = returnReason(p);
        return '<li><a href="#/project/' + e(p.id) + '">' +
          '<span class="rl-id num">' + e(p.id) + '</span>' +
          '<span class="rl-name">' + U.flagMark(p.country) + e(p.name) + '</span>' +
          '<span class="rl-why">' + e(why || 'Returned to Review — see the activity stream') +
          '</span></a></li>';
      }).join('') + '</ul></section>';
  }

  CBP.pages.worker = function (state) {
    if (!U.requireRole(state, ['m3', 'm2', 'm1', 'admin'])) return '';

    var mine = myProjects(state);
    var hmap = headroomMap(state, mine);
    var focus = state.ui.focusId;

    var html = '<div class="crumb">Home · My projects</div>' +
      '<div class="pagehead"><h1>My projects</h1>' +
      '<span class="sub">' + e(state.user.name) + ' · ' +
      mine.length + ' record' + (mine.length === 1 ? '' : 's') + ' you own or back up · ' +
      e(D.money(D.committedTotal(mine))) + ' committed</span></div>';

    if (!mine.length) {
      return html + U.card('Nothing is assigned to you yet',
        '<p>This home lists only the records where you are the owner or the named backup, ' +
        'which is what a Team Member is asked to keep moving. Nothing carries your name in ' +
        'the seeded data for <b>' + e(state.user.name) + '</b>.</p>' +
        '<p>The full register is at <a href="#/projects">Projects</a>.</p>',
        { cls: 'home-empty' });
    }

    html += '<div class="home-wrap">';
    html += returnedStrip(state, mine);
    /* the focused record first, then the rest in register order */
    var order = mine.slice().sort(function (a, b) {
      var fa = (focus === a.id) ? 0 : 1, fb = (focus === b.id) ? 0 : 1;
      return (fa - fb) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    html += order.map(function (p) {
      return projectCard(state, p, hmap, focus === p.id);
    }).join('');
    html += '</div>';
    if (focus) CBP.home.scrollToFocus();

    html += '<p class="pagenote">Task rows follow the record itself: a row reads Done when the ' +
      'platform can see the work, To do when it is your move, and Cannot start yet while it ' +
      'waits on a step above it. Day counts are derived against ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + ', never stored.</p>';

    /* audit G1 — the row acts open the shared P4 modal; render it here like P6/P10 */
    return html + (CBP.p4 && CBP.p4.modal ? CBP.p4.modal(state) : '');
  };

  /* the focused record is scrolled to, exactly as P6 and P10 do (F28) */
  CBP.pages.worker.focus = true;

})();
