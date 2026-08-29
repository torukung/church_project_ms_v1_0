/* pages/stubs.js — every route Phase A does not build yet renders a titled card
   naming the phase that delivers it, so navigation never 404s. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, e = CBP.ui.esc;
  CBP.pages = CBP.pages || {};

  var SPEC = {
    dashboard: {
      title: 'Dashboard',
      lead: 'Multiple user-arranged dashboards from a widget library, with one global country ' +
            'scope per dashboard tab that recomputes every widget.',
      items: ['Four seeded demo dashboards behind tabs (C-18)',
              'C-20 country scope selector — global per dashboard, remembered, never empty',
              'Budget bar vs ceiling (C-03) and the four KPI tiles (C-02)',
              'RD-1 country league table, RD-4 decisions roll-up, RD-5 delegation view']
    },
    project: {
      title: 'Project detail',
      lead: 'The full record: header with the pinned decision slot, four-click gate detail, and ' +
            'the typed activity stream.',
      items: ['Tabs: Overview ∣ Budget ∣ Timeline ∣ Activity ∣ Files-as-links',
              'C-08 approval side panel with return / reject and inline gate controls',
              'C-09 activity log — note, question, decision, system; one reply level',
              'C-11 composer with @mention and attachment']
    },
    approvals: {
      title: 'Approvals inbox',
      lead: 'The M1 queue: submissions awaiting review, gate items with their own sub-counters, ' +
            'and ready-to-mark-approved prompts, sorted by age.',
      items: ['Request approved / Return to Review with a mandatory reason',
              'C-15 external gate tracker — two systems × two click-done actions, M1-only (R-2)',
              'Mark Approved with mandatory reference numbers (R-4)']
    },
    timeline: {
      title: 'Timeline',
      lead: 'Cross-project Gantt for a country or region, reusing the C-06 block already built ' +
            'for the P3 expanded rows.',
      items: ['Group-by country / owner / status switch',
              'Owner name on each bar (D-14)',
              'Dashed planned bars before approval']
    },
    budget: {
      title: 'Budget',
      lead: 'Country ceilings against committed and queued amounts for the selected year.',
      items: ['Ceilings editor (M1 and Admin only)',
              'Coverage table carrying the RD-1 metrics',
              'Year selector — 2026 seeded']
    },
    alerts: {
      title: 'Alerts',
      lead: 'The rule catalogue A-01…A-14 with per-rule on/off, plus the template editor and the ' +
            'in-app outbox that stands in for real sending.',
      items: ['C-14 template editor with token palette and live preview',
              'RD-2 director exception digest preview',
              'Send log with the 24-hour dedupe guard']
    },
    admin: {
      title: 'Administration',
      lead: 'Read-only administration surface: users and roles, approval tiers, master data and ' +
            'the import / export and API configuration.',
      items: ['Users table including viewer scopes',
              'Amount-threshold routing (D-03) and gate requirement (R-1)',
              'Squads and delegations — the RD-5 source',
              'Per-user comfort font toggle']
    },
    signin: {
      title: 'Sign in',
      lead: 'Standalone demo authentication (D-10) with the SSO button prebuilt but stubbed, and ' +
            'the mobile detection toggle that routes to the P10 quick view.',
      items: ['Role picker: Admin / M1 / M2 / M3 / Viewer',
              'SSO button present, not wired',
              'Mobile toggle → #/mobile']
    },
    mobile: {
      title: 'Mobile quick view',
      lead: 'Device-detected mode showing approvals and updates only, with period chips and a ' +
            '“Full site” escape remembered per device (RM-7).',
      items: ['Period chips: Today / 7 d / 30 d / Custom',
              'Approval cards carrying the P6 actions',
              'Update feed reusing C-09']
    }
  };

  function stub(route) {
    return function (state) {
      var s = SPEC[route];
      var phase = CBP.CONFIG.PHASE_OF[route] || 'B';
      var codes = D.visibleCountries(state.user, state.countries);
      var scoped = D.visibleProjects(state.user, state.projects, state.countries);

      var body =
        '<p>' + e(s.lead) + '</p>' +
        '<ul class="stublist">' + s.items.map(function (i) {
          return '<li><span>' + e(i) + '</span></li>';
        }).join('') + '</ul>';

      var context =
        '<p>Signed in as <b>' + e(state.user.name) + '</b> — ' +
        e(CBP.CONFIG.ROLE_LABEL[state.user.role]) + '. This page will open on ' +
        e(codes.length === state.countries.length ? 'all seeded countries'
          : codes.join(', ')) + ', covering ' + scoped.length + ' project' +
        (scoped.length === 1 ? '' : 's') + ' and ' +
        D.money(D.committedTotal(scoped)) + ' committed.</p>' +
        '<p>The register at <a href="#/projects">#/projects</a> is built and live; this route is ' +
        'scheduled for build-plan phase ' + e(phase) + '.</p>';

      return '<div class="crumb">' + e(s.title) + '</div>' +
        '<div class="pagehead"><h1>' + e(s.title) + '</h1>' +
        '<span class="sub">' + U.phaseTag(phase) + ' — not built yet</span></div>' +
        '<div class="stubgrid">' +
          U.card('What this page will do', body) +
          U.card('Your scope right now', context) +
        '</div>';
    };
  }

  Object.keys(SPEC).forEach(function (r) { CBP.pages[r] = stub(r); });

})();
