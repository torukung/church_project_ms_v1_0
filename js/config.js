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

  /* v1.0.4 — the two dashboard attention thresholds (ToR 30 Aug). Both are
     Admin-configurable in the real product, exactly like the stage thresholds
     above; the demo ships the client's confirmed defaults. */
  APPROVAL_WAIT_DAYS: 3,       /* a submitted record older than this needs approval */
  PHASE_WARN_DAYS: 30,         /* an implementation phase ending inside this window */

  /* v1.1.0 — EGC + Contracts knobs (ToR 2 Sep). All Admin-configurable in the
     real product (Admin › Process / Admin › Integrations). */
  CONTRACT_THRESHOLD_USD: 50000, /* a project at or above this needs a Corporate Agreement before 2→1 */
  CONTRACT_DRAFT_FROM: 3,        /* drafting may start once the gate is open (status 3); signing needs status 2 */
  CONTRACT_IDLE_DAYS: 14,        /* a contract with no movement for this long is an exception */
  REVIEW_SLA_DAYS: 5,            /* OGC / Finance review due window */
  SIGN_SLA_DAYS: 7,              /* signature due window once signing starts */
  CONTRACT_EXPIRY_WARN_DAYS: 60, /* active agreements ending inside this window */
  SYNC_RETRY_MAX: 3,             /* EGC outbound op attempts before it is marked failed */
  SYNC_MODES: ['manual', 'assisted', 'auto'],
  SYNC_DRIVERS: ['manual', 'deeplink', 'excel', 'email', 'flow', 'rest', 'sim'],

  /* v1.2.0 — persistence, clock and the flow pass (ToR 3 Sep, plan §2).
     APP_VERSION + schema_version + a hash of location.pathname namespace the
     IndexedDB database and record key, because every file:// folder shares one
     origin in Chromium (audit F7). STORAGE_KEY is filled by initConfig. */
  APP_VERSION: '1.2.0',
  SCHEMA_VERSION: null,          /* filled from CBP_DATA.schema_version (3) */
  STORAGE_KEY: null,             /* 'cbp.<schema>.<app>.<hash(pathname)>' */
  DIGEST_HOUR: 7,                /* default per-user digest hour (Ask-gate §7.1) */
  BACKUP_KEEP: 7,                /* scheduled backups kept in the IDB store (§7.2) */
  SNAPSHOT_DEBOUNCE_MS: 150,     /* save() debounce after a render */
  RUNG_LABELS: { 4: 'In development', 3: 'Submitted', 2: 'Approved', 1: 'Implementation' },
  NOPERSIST: false,              /* set at boot from the ?nopersist URL query (F25) */

  /* v1.2.0 — D3 two-bucket alerts: bucket per RULE, never per recipient
     (T-12). Rules absent here are 'immediate'. CATALOGUE_ONLY lists the eight
     rules no code path raises in this demo (audit F12); P8 labels them so. */
  ALERT_BUCKET: {
    'A-01': 'immediate', 'A-02': 'digest', 'A-03': 'immediate', 'A-04': 'immediate',
    'A-05': 'digest', 'A-06': 'digest', 'A-07': 'digest', 'A-08': 'digest',
    'A-09': 'digest', 'A-10': 'digest', 'A-11': 'digest', 'A-12': 'immediate',
    'A-13': 'digest', 'A-14': 'digest', 'A-15': 'immediate', 'A-16': 'immediate',
    'A-17': 'digest', 'A-18': 'immediate', 'A-19': 'immediate', 'A-20': 'digest',
    'A-21': 'digest'
  },
  ALERT_CATALOGUE_ONLY: ['A-06', 'A-08', 'A-09', 'A-10', 'A-11', 'A-13', 'A-20'],
  DIGEST_RULE: 'A-14',           /* the folded daily digest mail id (F33) */

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
    { key: 'decision_point', label: 'Decision Point', ref_field: 'decision_point' },
    { key: 'chas',           label: 'CHaS',           ref_field: 'chas', guid_field: 'chas_guid' }
  ],

  ROLE_LABEL: {
    admin:  'Admin · Area office',
    m1:     'M1 · Regional Manager',
    m2:     'M2 · Area Manager',
    m3:     'M3 · Team Member',
    viewer: 'Viewer · read-only',
    ogc:     'OGC · Contract reviewer',
    finance: 'Finance · Contract reviewer'
  },

  /* v1.1.0 contract lifecycle (F2). Order is the ladder CT2 shows. */
  CONTRACT_STATUS: {
    draft:                  { label: 'Draft',                  tone: 's4' },
    in_review:              { label: 'In review',              tone: 's3' },
    approved_for_signature: { label: 'Approved for signature', tone: 's3' },
    signing:                { label: 'Signing',                tone: 's2' },
    executed:               { label: 'Executed',               tone: 's2' },
    sent:                   { label: 'Sent out',               tone: 's1' },
    active:                 { label: 'Active',                 tone: 's1' },
    amending:               { label: 'Amending',               tone: 's1' },
    expired:                { label: 'Expired',                tone: 'sx' },
    terminated:             { label: 'Terminated',             tone: 'sx' },
    cancelled:              { label: 'Cancelled',              tone: 'sx' }
  },
  CONTRACT_STATUS_ORDER: ['draft','in_review','approved_for_signature','signing','executed','sent','active','amending','expired','terminated','cancelled'],
  CONTRACT_MET: ['sent', 'active', 'amending'],   /* S-08: statuses that satisfy the contract gate */
  REVIEW_DIVISIONS: [ { key: 'ogc', label: 'OGC', role: 'ogc' }, { key: 'finance', label: 'Finance', role: 'finance' } ],


  /* hash routes; anything not listed falls back to FALLBACK_ROUTE */
  ROUTES: ['dashboard','projects','project','timeline','approvals','budget',
           'messages','alerts','admin','signin','mobile','contracts',
           /* v1.2.0 — D4 role homes; `home` dispatches by role (T-11) */
           'home','worker','country','portfolio','reviews','viewer'],
  DEFAULT_ROUTE: 'signin',    /* the front door (P1) */
  FALLBACK_ROUTE: 'signin',    /* unknown route, per the brief */

  /* v1.0.1 — Dashboard leads (ToR 29 Aug), and the Messages & Alerts hub sits
     under Budget carrying the unread balloon. `badge` names the counter app.js
     resolves: 'approvals' → D.badgeCount, 'messages' → D.unreadCount. A badge
     is hidden at zero. */
  NAV: [
    /* v1.2.0 — Home first for every role; Dashboard (P2 boards) stays only for
       admin / M2 / viewer (Ask-gate §7.3); Approvals is now the "Needs you"
       list and its badge is D.needsYou(user).length (T-09, F19). `roles`
       filters the row in app.js sidebar(); absent = every role. */
    { route: 'home',      label: 'Home' },
    { route: 'dashboard', label: 'Dashboard', roles: ['admin', 'm2', 'viewer'] },
    { route: 'projects',  label: 'Projects' },
    { route: 'approvals', label: 'Needs you', badge: 'approvals' },
    { route: 'timeline',  label: 'TimeBlock', addon: true },
    { route: 'budget',    label: 'Budget' },
    { route: 'messages',  label: 'Messages & Alerts', badge: 'messages' },
    { route: 'contracts', label: 'Contracts', badge: 'contracts' },
    { group: 'Admin' },
    { route: 'alerts',    label: 'Alerts' },
    { route: 'admin',     label: 'Administration' }
  ],

  /* which phase of the build plan delivers each stubbed route */
  PHASE_OF: {
    dashboard: 'B', project: 'B', approvals: 'B',
    timeline: 'C', alerts: 'C', budget: 'C', admin: 'C',
    signin: 'D', mobile: 'D', contracts: 'v1.1.0',
    home: 'v1.2.0', worker: 'v1.2.0', country: 'v1.2.0', portfolio: 'v1.2.0',
    reviews: 'v1.2.0', viewer: 'v1.2.0'
  }
};

/* v1.2.0 — deterministic 32-bit FNV-1a of a string, hex. Used for the
   STORAGE_KEY path hash and as the checksum fallback where crypto.subtle is
   not available (file:// in a non-secure engine, T-05). */
CBP.fnv1a = function (str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
};

CBP.storageKey = function (schema, app, pathname) {
  return 'cbp.' + schema + '.' + app + '.' + CBP.fnv1a(String(pathname || ''));
};

CBP.initConfig = function (data) {
  CBP.CONFIG.TODAY = data.TODAY;
  CBP.CONFIG.BUDGET_YEAR = data.budget_year;
  CBP.CONFIG.SCHEMA_VERSION = data.schema_version || 1;
  CBP.CONFIG.STORAGE_KEY = CBP.storageKey(CBP.CONFIG.SCHEMA_VERSION, CBP.CONFIG.APP_VERSION,
    (typeof location !== 'undefined' && location.pathname) || '');
  CBP.CONFIG.NOPERSIST = typeof location !== 'undefined' && /[?&]nopersist(=|&|$)/.test(location.search || '');
  return CBP.CONFIG;
};
