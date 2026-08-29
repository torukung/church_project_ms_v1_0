/* pages/p1.js — P1 Sign in, route #/signin (build-plan item 9).
   Standalone demo authentication (D-10): the credential fields and the SSO
   button are prebuilt but not wired, and the real way into the demo is the
   persona picker — five role cards that sign in and land each role where its
   work actually is. This route is also the unknown-route fallback, so it has
   to read as a front door rather than an error page.

   Rendered without the app shell (CBP.pages.signin.fullbleed), because a sign
   in page that already shows the signed-in sidebar answers its own question. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};

  /* where each role lands after signing in — the first screen on which that
     role has something to do */
  var LANDING = {
    m1:     'approvals',
    m2:     'projects',
    m3:     'projects',
    viewer: 'dashboard',
    admin:  'dashboard'
  };

  CBP.landingFor = function (user) {
    if (!user) return CBP.CONFIG.DEFAULT_ROUTE;
    if (CBP.state && CBP.state.ui && CBP.state.ui.mobileSim) return 'mobile';
    return LANDING[user.role] || CBP.CONFIG.DEFAULT_ROUTE;
  };

  /* the five demo accounts, in the order the walkthrough uses them */
  var CARDS = ['anik', 'daniel', 'priya', 'santoso', 'admin'];

  function scopeLine(u, state) {
    var codes = D.visibleCountries(u, state.countries);
    if (codes.length === state.countries.length) return 'All ' + codes.length + ' seeded countries';
    return codes.map(function (c) {
      var row = state.countries.filter(function (x) { return x.code === c; })[0];
      return row ? row.name : c;
    }).join(', ');
  }

  function initials(name) {
    var parts = String(name).replace(/[^A-Za-z .]/g, '').split(/\s+/).filter(Boolean);
    return ((parts[0] || '?').charAt(0) + (parts[1] || '').charAt(0)).toUpperCase();
  }

  function roleCard(u, state) {
    var landing = LANDING[u.role] || CBP.CONFIG.DEFAULT_ROUTE;
    var nav = CBP.CONFIG.NAV.filter(function (n) { return n.route === landing; })[0];
    return '<button class="p1-card' + (u.role === 'viewer' ? ' viewer' : '') +
      '" data-act="p1-signin" data-id="' + e(u.id) + '">' +
      '<span class="p1-av">' + e(initials(u.name)) + '</span>' +
      '<span class="p1-cbody">' +
        '<b>' + e(u.name) + '</b>' +
        '<small>' + e(CBP.CONFIG.ROLE_LABEL[u.role]) + '</small>' +
        '<span class="p1-scope">' + e(scopeLine(u, state)) + '</span>' +
      '</span>' +
      '<span class="p1-go">' + e(nav ? nav.label : landing) + ' →</span>' +
      '</button>';
  }

  CBP.pages.signin = function (state) {
    var unknown = !!state.ui.notice;

    var html = '<div class="p1-wrap"><div class="p1-box">' +

      '<div class="p1-head">' +
        '<div class="p1-mark">Church Project-Budget Management Platform' +
        '<small>Demo v1.0.2 · Asia Area · budget year ' + CBP.CONFIG.BUDGET_YEAR + '</small></div>' +
      '</div>';

    if (unknown) {
      html += '<div class="p1-alert">That address does not exist in the demo — sign in to pick ' +
              'up where you left off.</div>';
    }

    /* ------------------------------------------------ the demo way in --- */
    html += '<section class="p1-panel">' +
      '<h2>Choose a demo role</h2>' +
      '<p class="p1-lead">Every screen, every number and every control in this demo follows the ' +
      'signed-in role. Pick one to start; the persona switcher in the top bar swaps roles later ' +
      'without losing your place.</p>' +
      '<div class="p1-cards">' +
        CARDS.map(function (id) {
          var u = CBP.userById(id);
          return u ? roleCard(u, state) : '';
        }).join('') +
      '</div>' +
      '<p class="p1-foot">Each role lands where its work is: the Regional Manager on Approvals, ' +
      'the Area and Team Members on Projects, the Viewer and the Administrator on the ' +
      'Dashboard.</p>' +
      '</section>';

    /* ----------------------------------------- the real sign-in surface - */
    html += '<section class="p1-panel p1-auth">' +
      '<h2>Sign in</h2>' +
      '<div class="p1-form">' +
        '<label class="p1-lab">Email' +
          '<input class="p1-input" type="email" id="p1Email" autocomplete="username" ' +
          'placeholder="name@church.org" value="' + e(state.ui.p1Email || '') + '"></label>' +
        '<label class="p1-lab">Password' +
          '<input class="p1-input" type="password" id="p1Pass" ' +
          'autocomplete="current-password" placeholder="••••••••"></label>' +
      '</div>' +
      '<div class="p1-actions">' +
        '<button class="btn brass" data-act="p1-credentials">Sign in</button>' +
        '<button class="btn" disabled title="SSO-ready — enabled at deployment (D-10)">' +
        'Sign in with Church SSO</button>' +
      '</div>' +
      '<p class="p1-note">Demo: the fields are not validated — any input signs you in as the ' +
      'Area Office Admin. Church SSO is prebuilt and disabled: SSO-ready, enabled at deployment ' +
      '(D-10).</p>' +

      '<button class="p1-toggle' + (state.ui.mobileSim ? ' on' : '') + '" ' +
      'data-act="p1-mobile" role="switch" aria-checked="' +
      (state.ui.mobileSim ? 'true' : 'false') + '">' +
        '<span class="p1-sw"><i></i></span>' +
        '<span><b>Mobile device</b>' +
        '<small>' + (state.ui.mobileSim
          ? 'On — signing in routes to the mobile quick view (P10), as a phone browser would.'
          : 'Off — signing in opens the full desktop site.') + '</small></span>' +
      '</button>' +
      '</section>';

    html += '<p class="p1-legal">Demo build · client-side only · no real authentication and no ' +
      'data leaves this page. State resets on reload.</p>';

    return html + '</div></div>';
  };

  /* rendered without the sidebar and top bar */
  CBP.pages.signin.fullbleed = true;

})();
