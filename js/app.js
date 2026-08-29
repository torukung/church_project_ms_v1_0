/* app.js — hash router, shell, and the single render() pass.
   Any mutation (persona switch, filter, route) mutates CBP.state then calls
   CBP.render(); nothing reloads the page. */
(function () {
  'use strict';
  var D, U, e;

  /* -------------------------------------------------------------- route -- */

  function readHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    if (!h) return { route: CBP.CONFIG.DEFAULT_ROUTE, param: null };
    var parts = h.split('/');
    var r = parts[0];
    if (CBP.CONFIG.ROUTES.indexOf(r) === -1) {
      return { route: CBP.CONFIG.FALLBACK_ROUTE, param: null, unknown: true };
    }
    return { route: r, param: parts[1] || null };
  }

  /* --------------------------------------------------------- C-01 shell -- */

  function sidebar(state) {
    /* badge = what this user can act on, hidden at zero or where the role has
       no approval queue (M3, viewer, admin) */
    var awaiting = D.badgeCount(state.user,
      D.visibleProjects(state.user, state.projects, state.countries));

    /* v1.0.1 — the unread balloon. ONE derived number (D.unreadCount) feeds the
       sidebar, the P4 alert strip and the hub, so they cannot disagree. It is
       shown for every persona including the viewer: for the viewer it is only
       ever a count, because the read marks are a write the viewer cannot make. */
    var unread = D.unreadCount(state.user);

    var counts = { approvals: awaiting, messages: unread };

    var nav = CBP.CONFIG.NAV.map(function (n) {
      if (n.group) return '<div class="grp">' + e(n.group) + '</div>';
      var on = state.ui.route === n.route ||
               (n.route === 'projects' && state.ui.route === 'project');
      var count = n.badge ? (counts[n.badge] || 0) : 0;
      var badge = count > 0
        ? '<span class="badge num">' + count + '</span>' : '';
      var addon = n.addon
        ? '<span class="addon" title="Optional add-on module">Add-on</span>' : '';
      return '<a href="#/' + e(n.route) + '"' + (on ? ' class="on"' : '') + '>' +
             '<span>' + e(n.label) + addon + '</span>' + badge + '</a>';
    }).join('');

    /* v1.0.2 brand mark — inline SVG chapel with a soft gold shimmer + glints */
    var brandIcon =
      '<svg class="bico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<defs><linearGradient id="bg-gold" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#C9A54E"/>' +
          '<stop offset=".5" stop-color="#9A7833"/>' +
          '<stop offset="1" stop-color="#7C5F26"/></linearGradient></defs>' +
        '<g fill="url(#bg-gold)">' +
          '<path d="M11.4 2h1.2v1.6H14v1.2h-1.4v1.7l4.9 3.6v1.4l-1.5-.5V18H8V11l-1.5.5V10.1l4.9-3.6V4.8H10V3.6h1.4V2z"/>' +
          '<path d="M4.5 12.6 7 11.8V18H4.5v-5.4zM19.5 12.6 17 11.8V18h2.5v-5.4z"/>' +
          '<rect x="3.2" y="18.6" width="17.6" height="1.6" rx=".8"/>' +
        '</g>' +
        '<path class="bico-door" d="M10.8 18v-3.2a1.2 1.2 0 0 1 2.4 0V18z"/>' +
        '<circle class="glint g1" cx="18.6" cy="4.6" r=".9"/>' +
        '<circle class="glint g2" cx="4.9" cy="7.4" r=".7"/>' +
        '<circle class="glint g3" cx="20.4" cy="9.8" r=".55"/>' +
      '</svg>';

    return '<aside class="side">' +
      '<div class="brand brand-v2">' + brandIcon +
        '<span class="btxt"><span class="bname">Church Budget&amp;Project MS</span>' +
        '<small>Asia Area</small></span></div>' +
      '<nav class="nav">' + nav + '</nav>' +
      '<div class="me"><b>' + e(state.user.name) + '</b>' +
      e(state.user.title || CBP.CONFIG.ROLE_LABEL[state.user.role]) + '</div>' +
      '</aside>';
  }

  function topbar(state) {
    var order = CBP_DATA.persona_switcher_order.slice();
    if (order.indexOf('admin') === -1) order.push('admin');

    var opts = order.map(function (id) {
      var u = CBP.userById(id);
      if (!u) return '';
      var role = CBP.CONFIG.ROLE_LABEL[u.role].split(' · ')[0];
      return '<option value="' + e(u.id) + '"' +
             (state.user.id === u.id ? ' selected' : '') + '>' +
             e(u.name + ' — ' + role) + '</option>';
    }).join('');

    var codes = D.visibleCountries(state.user, state.countries);
    var scopeTxt = codes.length === state.countries.length
      ? 'All ' + codes.length + ' seeded countries'
      : codes.join(' · ');

    return '<div class="topbar">' +
      '<span class="where">Data scope: ' + e(scopeTxt) + '</span>' +
      '<div class="rt">' +
        '<button class="btn sm" data-act="comfort" aria-pressed="' +
          (state.ui.comfort ? 'true' : 'false') + '">Comfort font: ' +
          (state.ui.comfort ? 'on' : 'off') + '</button>' +
        '<span class="rolechip' + (state.user.role === 'viewer' ? ' viewer' : '') + '">' +
          e(CBP.CONFIG.ROLE_LABEL[state.user.role]) + '</span>' +
        '<div class="persona">' +
          '<label for="personaSel">Signed in as</label>' +
          '<select class="sel" id="personaSel" data-act="persona">' + opts + '</select>' +
        '</div>' +
        '<button class="btn sm" data-act="signout">Sign out</button>' +
      '</div></div>';
  }

  /* ------------------------------------------------------------ render -- */

  CBP.render = function () {
    var state = CBP.state;
    var page = CBP.pages[state.ui.route] || CBP.pages[CBP.CONFIG.FALLBACK_ROUTE];
    var body = page(state);

    document.body.classList.toggle('comfort', !!state.ui.comfort);
    document.body.classList.toggle('fullbleed', !!page.fullbleed);

    /* a front door (P1) renders on its own, with no sidebar and no top bar —
       and carries its own notice, so the shell hint bar stays out of it */
    if (page.fullbleed) {
      document.getElementById('app').innerHTML = body;
      return;
    }

    var notice = state.ui.notice
      ? '<div class="hintbar">' + e(state.ui.notice) + '</div>' : '';

    document.getElementById('app').innerHTML =
      '<div class="shell">' + sidebar(state) +
      '<div style="min-width:0">' + topbar(state) +
      '<main class="main" id="page">' + body + notice + '</main></div></div>';
  };

  /* ------------------------------------------------------------ events -- */

  function boot() {
    CBP.initConfig(window.CBP_DATA);
    D = CBP.D; U = CBP.ui; e = CBP.ui.esc;
    CBP.initStore(window.CBP_DATA);

    var r = readHash();
    CBP.state.ui.route = r.route;
    CBP.state.ui.param = r.param;
    if (r.unknown) CBP.state.ui.notice = 'Unknown route — showing sign in.';
    if (!location.hash) location.replace('#/' + CBP.CONFIG.DEFAULT_ROUTE);

    window.addEventListener('hashchange', function () {
      var h = readHash();
      CBP.state.ui.route = h.route;
      CBP.state.ui.param = h.param;
      CBP.state.ui.notice = h.unknown ? 'Unknown route — showing sign in.' : null;
      CBP.render();
    });

    /* one delegated click handler for the whole app */
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!t) return;
      var act = t.getAttribute('data-act');

      if (act === 'filter') {
        ev.preventDefault();
        CBP.setFilter(t.getAttribute('data-f'));
        CBP.render();
      } else if (act === 'comfort') {
        CBP.toggleComfort();
        CBP.render();
      } else if (act === 'phaseb') {
        /* CBP.actions handles every control that now has a real action behind
           it and stops the event before this fallback. What is left is the
           scoped register export, which arrives with phase C. */
        ev.preventDefault();
        CBP.notice('Export from this page arrives in build-plan phase C, alongside the alerts ' +
                   'centre, the timeline and administration. The dated print pre-read (RD-3) ' +
                   'already works from the Dashboard — open Dashboard and press Export there.');
        CBP.render();
      } else if (act === 'modal-close') {
        CBP.notice(null);
        CBP.render();
      }
    });

    /* search — same one-pass render; refocus the box and restore the caret,
       because render() replaces the markup the event came from */
    document.addEventListener('input', function (ev) {
      var t = ev.target;
      if (!t || !t.getAttribute || t.getAttribute('data-act') !== 'search') return;
      CBP.setSearch(t.value);
      CBP.render();
      var box = document.getElementById('p3search');
      if (box) {
        box.focus();
        try { box.setSelectionRange(box.value.length, box.value.length); } catch (err) {}
      }
    });

    /* persona switch — mutate state, then one render() pass rebuilds everything */
    document.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t && t.getAttribute && t.getAttribute('data-act') === 'persona') {
        CBP.setUser(t.value);
        CBP.render();
      }
    });

    /* <details> toggle does not bubble — capture it so open rows survive a
       re-render without forcing one on every click */
    document.addEventListener('toggle', function (ev) {
      var d = ev.target;
      if (d && d.tagName === 'DETAILS' && d.classList.contains('prj')) {
        CBP.toggleRow(d.getAttribute('data-id'), d.open);
      }
    }, true);

    CBP.render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
