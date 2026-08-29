/* config.js — global namespace + tunables.
   Loads BEFORE data.js (brief script order), so anything sourced from CBP_DATA
   is filled in by CBP.initConfig(), which app.js calls once at boot. */
window.CBP = window.CBP || {};

CBP.CONFIG = {
  /* filled by initConfig from CBP_DATA */
  TODAY: null,
  BUDGET_YEAR: null,

  /* stage + gate thresholds (Admin-configurable in the real product, R-1/D-03) */
  GATE_THRESHOLD_DAYS: 90,     /* a gate sub-step older than this is an exception */
  REVIEW_THRESHOLD_DAYS: 14,   /* M1 review older than this is overdue */
  KICKOFF_THRESHOLD_DAYS: 30,  /* approved but not started */
  COVERAGE_WARN: 80,           /* coverage % at which the bar turns brass */

  /* D-01 ladder — the client's original numbers, never renumbered */
  STATUS: {
    4: { key: 's4', label: '4 In Development', short: 'In development' },
    3: { key: 's3', label: '3 Submitted',      short: 'Submitted' },
    2: { key: 's2', label: '2 Approved',       short: 'Approved' },
    1: { key: 's1', label: '1 Implementation', short: 'Implementation' },
    declined: { key: 'sx', label: 'Declined', short: 'Declined' }
  },
  STATUS_ORDER: [1, 2, 3, 4, 'declined'],

  GATE_SYSTEMS: [
    { key: 'decision_point', label: 'Decision Point' },
    { key: 'chas',           label: 'CHaS' }
  ],

  ROLE_LABEL: {
    admin:  'Admin · Area office',
    m1:     'M1 · Regional Manager',
    m2:     'M2 · Area Manager',
    m3:     'M3 · Team Member',
    viewer: 'Viewer · read-only'
  },

  /* hash routes; anything not listed falls back to FALLBACK_ROUTE */
  ROUTES: ['dashboard','projects','project','timeline','approvals','budget',
           'messages','alerts','admin','signin','mobile'],
  DEFAULT_ROUTE: 'signin',    /* the front door (P1) */
  FALLBACK_ROUTE: 'signin',    /* unknown route, per the brief */

  /* v1.0.1 — Dashboard leads (ToR 29 Aug), and the Messages & Alerts hub sits
     under Budget carrying the unread balloon. `badge` names the counter app.js
     resolves: 'approvals' → D.badgeCount, 'messages' → D.unreadCount. A badge
     is hidden at zero. */
  NAV: [
    { route: 'dashboard', label: 'Dashboard' },
    { route: 'projects',  label: 'Projects' },
    { route: 'approvals', label: 'Approvals', badge: 'approvals' },
    { route: 'timeline',  label: 'Timeline' },
    { route: 'budget',    label: 'Budget' },
    { route: 'messages',  label: 'Messages & Alerts', badge: 'messages' },
    { group: 'Admin' },
    { route: 'alerts',    label: 'Alerts' },
    { route: 'admin',     label: 'Administration' }
  ],

  /* which phase of the build plan delivers each stubbed route */
  PHASE_OF: {
    dashboard: 'B', project: 'B', approvals: 'B',
    timeline: 'C', alerts: 'C', budget: 'C', admin: 'C',
    signin: 'D', mobile: 'D'
  }
};

CBP.initConfig = function (data) {
  CBP.CONFIG.TODAY = data.TODAY;
  CBP.CONFIG.BUDGET_YEAR = data.budget_year;
  return CBP.CONFIG;
};
