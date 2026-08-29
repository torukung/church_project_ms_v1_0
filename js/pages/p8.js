/* pages/p8.js — Alert centre, route #/alerts (build-plan item 7).
   Four surfaces: the outbox that stands in for real sending, the A-01…A-14 rule
   catalogue with per-rule on/off, the C-14 template editor with a live preview
   (one rule fully editable — A-08), and the RD-2 director exception digest.

   Nothing here sends anything: state.outbox is filled by CBP.actions during the
   demo walk and this page only renders it. The digest is built from
   CBP.W.exceptionSet(), the same derivation behind the P2 attention widget, so
   the two can never disagree about a number.

   Managing templates and rules is Admin-only (docs/01 permission matrix); every
   other persona gets the sent log and the digest for their own data scope. */
(function () {
  'use strict';

  var D = CBP.D, U = CBP.ui, W = CBP.W, e = CBP.ui.esc;
  CBP.pages = CBP.pages || {};

  /* ------------------------------------------ A-01…A-14, from docs/05 ---- */
  var RULES = [
    { id: 'A-01', trigger: 'Request submitted (4→3) by M2', to: 'M1, owner',
      timing: 'Immediate', kind: 'Approval stage' },
    { id: 'A-02', trigger: 'Request approved by M1 — gate opens',
      to: 'M2, owner — with a prompt to lodge in Decision Point & CHaS',
      timing: 'Immediate', kind: 'Approval stage' },
    { id: 'A-03', trigger: 'Return to Review', to: 'M2, owner',
      timing: 'Immediate', kind: 'Approval stage' },
    { id: 'A-04', trigger: 'Reject — Declined', to: 'M2, owner, M1 copy',
      timing: 'Immediate', kind: 'Approval stage' },
    { id: 'A-05', trigger: 'Gate updated — DP or CHaS marked submitted / approved',
      to: 'Owner, M2', timing: 'Immediate', kind: 'Approval stage' },
    { id: 'A-06', trigger: 'Gate idle — submitted to a system, no approval recorded',
      to: 'M1, M2, owner', timing: 'At 90 d, repeating every 30 d', kind: 'Delay' },
    { id: 'A-07', trigger: 'Both gates ✓ but status still 3',
      to: 'M1 — prompt to Mark Approved', timing: 'Next morning, then weekly',
      kind: 'Follow-up' },
    { id: 'A-08', trigger: 'Stage threshold exceeded — any status',
      to: 'Owner, backup, M1', timing: 'Per-stage threshold (Admin), repeating 30 d',
      kind: 'Delay (D-11)', editable: true },
    { id: 'A-09', trigger: 'Target date approaching', to: 'Owner, backup',
      timing: '14 d and 3 d before', kind: 'Targeted date' },
    { id: 'A-10', trigger: 'Target date passed, not at status 1', to: 'Owner, backup, M2',
      timing: 'Day after, then weekly', kind: 'Delay' },
    { id: 'A-11', trigger: 'Project closed / completed', to: 'Owner, M1, M2',
      timing: 'Immediate', kind: 'Project closed' },
    { id: 'A-12', trigger: 'Question assigned to you', to: 'Assignee',
      timing: 'Immediate', kind: 'Task' },
    { id: 'A-13', trigger: 'Country coverage crosses 100%', to: 'M2, M1, Admin',
      timing: 'Immediate, once per year per country', kind: 'Budget visibility' },
    { id: 'A-14', trigger: 'Weekly digest', to: 'Per user preference',
      timing: 'Monday 07:00 local', kind: 'Digest' }
  ];

  /* ids CBP.actions emits that sit outside the numbered catalogue */
  var SYSTEM_RULES = {
    'SYS-approved': 'Marked Approved 3 → 2 — resolves the A-07 prompt',
    'SYS-implementation': 'Implementation started 2 → 1'
  };

  var TOKENS = [
    { t: '{{project.id}}',   d: 'record id' },
    { t: '{{project.name}}', d: 'project name' },
    { t: '{{country}}',      d: 'country name' },
    { t: '{{days}}',         d: 'days in the current stage' },
    { t: '{{owner}}',        d: 'owner name' },
    { t: '{{threshold}}',    d: 'stage threshold in days' }
  ];

  var DEFAULT_TPL = {
    subject: '{{project.id}} has been at this stage for {{days}} days',
    body: 'Hello {{owner}},\n\n' +
      '{{project.name}} ({{project.id}}, {{country}}) has now been at its current stage for ' +
      '{{days}} days, past the {{threshold}}-day threshold for this stage.\n\n' +
      'Please review the record and move it on, or record why it is held.\n\n' +
      'Open the project: #/project/{{project.id}}'
  };

  var TABS = [
    { k: 'outbox', label: 'Sent log' },
    { k: 'rules',  label: 'Rule catalogue' },
    { k: 'tpl',    label: 'Template editor', admin: true },
    { k: 'digest', label: 'Director digest' }
  ];

  /* --------------------------------------------------------- page state -- */

  function ensure(state) {
    var s = state.ui.p8;
    if (!s) {
      var on = {};
      RULES.forEach(function (r) { on[r.id] = true; });   /* default: all on */
      s = state.ui.p8 = {
        tab: 'outbox',
        ruleFilter: 'all',
        on: on,
        tpl: { subject: DEFAULT_TPL.subject, body: DEFAULT_TPL.body },
        field: 'body',        /* which editor field last held the caret */
        caret: null,          /* and where in it — token insertion needs this */
        saved: false,
        open: {}              /* outbox entry index → expanded */
      };
    }
    return s;
  }

  function isAdmin(user) { return D.can(user, 'manageUsers'); }

  function tabsFor(user) {
    return TABS.filter(function (t) { return !t.admin || isAdmin(user); });
  }

  /* ============================================================== render == */

  CBP.pages.alerts = function (state) {
    var s = ensure(state);
    var user = state.user;
    var admin = isAdmin(user);
    var tabs = tabsFor(user);
    if (!tabs.filter(function (t) { return t.k === s.tab; }).length) s.tab = tabs[0].k;

    var codes = D.visibleCountries(user, state.countries);
    var mine = visibleOutbox(state, codes, admin);

    var html = '<div class="p8-page">';

    html += '<div class="crumb">Alerts · ' +
      e(admin ? 'Area office' : 'Your scope') + ' · ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + '</div>';

    html += '<div class="pagehead"><h1>Alert centre</h1>' +
      '<span class="sub">' + e(W.plural(mine.length, 'alert')) + ' in this session · ' +
      RULES.length + ' rules' + (admin ? '' : ' · read-only') + '</span></div>';

    html += '<div class="p8-tabs" role="tablist">' + tabs.map(function (t) {
      return '<button class="p8-tab' + (t.k === s.tab ? ' on' : '') +
        '" role="tab" aria-selected="' + (t.k === s.tab) +
        '" data-p8="tab" data-k="' + e(t.k) + '">' + e(t.label) + '</button>';
    }).join('') + '</div>';

    if (s.tab === 'outbox') html += outbox(state, s, mine, admin);
    else if (s.tab === 'rules') html += catalogue(state, s, admin);
    else if (s.tab === 'tpl') html += editor(state, s);
    else html += digest(state, codes);

    return html + '</div>';
  };

  /* ============================================== (a) outbox / sent log === */

  /* an alert belongs to a persona's log when its project sits in their scope;
     Admin sees everything, including anything not tied to a project */
  function visibleOutbox(state, codes, admin) {
    return (state.outbox || []).map(function (m, i) {
      return { m: m, i: i };
    }).filter(function (x) {
      if (admin) return true;
      var p = x.m.project ? CBP.projectById(x.m.project) : null;
      return p ? codes.indexOf(p.country) > -1 : false;
    }).reverse();                                   /* newest first */
  }

  function ruleLabel(id) {
    var r = RULES.filter(function (x) { return x.id === id; })[0];
    if (r) return r.id + ' · ' + r.kind;
    return id + (SYSTEM_RULES[id] ? ' · system' : '');
  }

  function outbox(state, s, rows, admin) {
    if (!rows.length) {
      return U.card('Sent log',
        '<div class="p8-empty"><b>No alerts yet in this session</b>' +
        '<span>Actions in this session generate alerts — submit a request, tick an ' +
        'external gate or assign a question, and every send lands here. ' +
        'Demo sends render to this outbox, never to real mail.</span></div>');
    }

    /* filter chips carry only the rules that actually fired */
    var seen = [];
    rows.forEach(function (x) { if (seen.indexOf(x.m.rule) === -1) seen.push(x.m.rule); });
    seen.sort();

    var chips = '<div class="p8-chips"><button class="chip' +
      (s.ruleFilter === 'all' ? ' on' : '') + '" data-p8="rulefilter" data-r="all">All' +
      ' <span class="n">' + rows.length + '</span></button>' +
      seen.map(function (id) {
        var n = rows.filter(function (x) { return x.m.rule === id; }).length;
        return '<button class="chip' + (s.ruleFilter === id ? ' on' : '') +
          '" data-p8="rulefilter" data-r="' + e(id) + '">' + e(id) +
          ' <span class="n">' + n + '</span></button>';
      }).join('') + '</div>';

    var shown = rows.filter(function (x) {
      return s.ruleFilter === 'all' || x.m.rule === s.ruleFilter;
    });

    var list = shown.map(function (x) {
      var m = x.m, open = !!s.open[x.i];
      var p = m.project ? CBP.projectById(m.project) : null;
      var head = '<button class="p8-mailhd" data-p8="mail" data-i="' + x.i +
        '" aria-expanded="' + open + '">' +
        /* the capsule is a fixed width, so a system id shortens to SYS and
           spells itself out in the expanded row and in the filter chips */
        '<span class="p8-rule" title="' + e(ruleLabel(m.rule)) + '">' +
        e(SYSTEM_RULES[m.rule] ? 'SYS' : m.rule) + '</span>' +
        '<span class="p8-mailtx"><b>' + e(m.subject) + '</b>' +
        '<span>' + e((m.to && m.to.length ? m.to.join(', ') : 'no recipient — no owner set') +
          (p ? ' · ' + W.countryName(state, p.country) : '') +
          ' · ' + D.fmtDateY(m.at)) + '</span></span>' +
        '<span class="p8-chev">' + (open ? '▴' : '▾') + '</span></button>';

      var body = open
        ? '<div class="p8-mail">' +
            '<div class="p8-meta"><span>Rule</span><b>' + e(ruleLabel(m.rule)) + '</b></div>' +
            '<div class="p8-meta"><span>To</span><b>' +
              e(m.to && m.to.length ? m.to.join(', ') : '—') +
              (m.to_ids && m.to_ids.length
                ? ' <small>(' + e(m.to_ids.join(', ')) + ')</small>' : '') + '</b></div>' +
            (p ? '<div class="p8-meta"><span>Project</span><b><a href="#/project/' +
                 e(p.id) + '">' + e(p.id + ' · ' + p.name) + '</a></b></div>' : '') +
            '<div class="p8-meta"><span>Subject</span><b>' + e(m.subject) + '</b></div>' +
            '<pre class="p8-body">' + e(m.body) + '</pre>' +
          '</div>'
        : '';

      return '<div class="p8-row' + (open ? ' open' : '') + '">' + head + body + '</div>';
    }).join('');

    return U.card('Sent log — newest first',
      chips +
      (shown.length ? '<div class="p8-list">' + list + '</div>'
                    : '<div class="p8-empty"><b>Nothing under this rule</b></div>') +
      '<p class="p8-note">Demo sends render here rather than to real mail. Every send also ' +
      'writes a System entry on the project naming its recipients, so email never becomes ' +
      'the only record. A 24-hour dedupe guard applies per rule, project and recipient.</p>');
  }

  /* =========================================== (b) rule catalogue A-01…14 = */

  function catalogue(state, s, admin) {
    var body = RULES.map(function (r) {
      var on = s.on[r.id] !== false;
      var toggle = admin
        ? '<button class="p8-toggle' + (on ? ' on' : '') + '" data-p8="rule" data-r="' +
          e(r.id) + '" role="switch" aria-checked="' + on + '">' +
          '<span class="p8-knob"></span><span class="p8-state">' +
          (on ? 'On' : 'Off') + '</span></button>'
        : '<span class="p8-state ' + (on ? 'ison' : 'isoff') + '">' +
          (on ? 'On' : 'Off') + '</span>';

      return '<tr><td class="p8-id num">' + e(r.id) + '</td>' +
        '<td>' + e(r.trigger) +
        (r.editable ? ' <span class="p8-tag">template editable</span>' : '') + '</td>' +
        '<td>' + e(r.to) + '</td>' +
        '<td>' + e(r.timing) + '</td>' +
        '<td>' + e(r.kind) + '</td>' +
        '<td class="r">' + toggle + '</td></tr>';
    }).join('');

    var offs = RULES.filter(function (r) { return s.on[r.id] === false; }).length;

    return U.card('Alert rules — A-01 to A-14',
      U.table([
        { label: '#' }, { label: 'Trigger' }, { label: 'Recipients' },
        { label: 'Timing' }, { label: 'Type' }, { label: 'Status', right: true }
      ], [body]) +
      '<p class="p8-note">' +
      (admin ? 'Switching a rule off stops it firing for this demo session. '
             : 'Only Admin can switch a rule on or off (docs/01 permission matrix). ') +
      'Every rule is a templated email with merge tokens; a <b>24-hour dedupe guard</b> ' +
      'runs per rule, project and recipient, so a repeating rule cannot flood one inbox. ' +
      (offs ? offs + ' rule' + (offs === 1 ? ' is' : 's are') + ' currently off. ' : '') +
      'A-14 carries the weekly digest machinery that RD-2 extends.</p>');
  }

  /* ================================= (c) C-14 template editor — one rule == */

  /* the sample record every preview renders against */
  function sample(state) {
    return CBP.projectById('WE26BGD0002') || state.projects[0];
  }

  /* per-stage threshold behind A-08 (D-11) */
  function threshold(p) {
    if (p.status === 3) return CBP.CONFIG.REVIEW_THRESHOLD_DAYS;
    if (p.status === 2) return CBP.CONFIG.KICKOFF_THRESHOLD_DAYS;
    return CBP.CONFIG.GATE_THRESHOLD_DAYS;
  }

  /* token values are DERIVED from the record, never typed in */
  function values(state, p) {
    return {
      '{{project.id}}': p.id,
      '{{project.name}}': p.name,
      '{{country}}': W.countryName(state, p.country),
      '{{days}}': String(D.daysInStage(p)),
      '{{owner}}': p.owner ? CBP.userName(p.owner) : 'unassigned',
      '{{threshold}}': String(threshold(p))
    };
  }

  function merge(tpl, vals) {
    var out = String(tpl || '');
    Object.keys(vals).forEach(function (k) {
      out = out.split(k).join(vals[k]);
    });
    return out;
  }

  function editor(state, s) {
    var p = sample(state);
    var vals = values(state, p);
    var rule = RULES.filter(function (r) { return r.id === 'A-08'; })[0];

    var palette = '<div class="p8-tokens">' + TOKENS.map(function (t) {
      return '<button class="p8-token" data-p8="token" data-t="' + e(t.t) + '" title="' +
        e(t.d + ' — ' + vals[t.t]) + '">' + e(t.t) + '</button>';
    }).join('') + '</div>';

    var form =
      '<div class="p8-field"><label for="p8subject">Subject</label>' +
      '<input id="p8subject" class="p8-input" type="text" data-p8="tpl" data-f="subject" ' +
      'autocomplete="off" value="' + e(s.tpl.subject) + '"></div>' +
      '<div class="p8-field"><label for="p8body">Body</label>' +
      '<textarea id="p8body" class="p8-input p8-area" rows="10" data-p8="tpl" ' +
      'data-f="body">' + e(s.tpl.body) + '</textarea></div>' +
      '<div class="p8-acts">' +
        '<button class="btn brass" data-p8="save">Save template</button>' +
        '<button class="btn" data-p8="reset">Reset to default</button>' +
        (s.saved ? '<span class="p8-saved">Saved — A-08 previews use this template.</span>' : '') +
      '</div>';

    var preview =
      '<div class="p8-prev">' +
        '<div class="p8-prevhd"><span>To</span><b>' +
          e(previewRecipients(state, p)) + '</b></div>' +
        '<div class="p8-prevhd"><span>Subject</span><b>' +
          e(merge(s.tpl.subject, vals)) + '</b></div>' +
        '<pre class="p8-body">' + e(merge(s.tpl.body, vals)) + '</pre>' +
      '</div>';

    var others = RULES.filter(function (r) { return !r.editable; }).map(function (r) {
      return '<li><b>' + e(r.id) + '</b><span>' + e(r.trigger) + '</span>' +
        '<em>editable in full product</em></li>';
    }).join('');

    return '<div class="p8-editor">' +
      U.card('A-08 · stage threshold exceeded — template',
        '<p class="p8-lead">' + e(rule.trigger) + ' · recipients ' + e(rule.to) +
        ' · ' + e(rule.timing) + '</p>' +
        '<div class="p8-flabel">Token palette — click to insert at the caret</div>' +
        palette + form) +
      U.card('Live preview — rendered against ' + p.id,
        '<p class="p8-lead">Every token below is substituted with this record’s real derived ' +
        'values as they stand on ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) + '.</p>' +
        preview +
        '<div class="p8-vals">' + TOKENS.map(function (t) {
          return '<div class="p8-meta"><span>' + e(t.t) + '</span><b>' +
            e(vals[t.t]) + '</b></div>';
        }).join('') + '</div>') +
      U.card('Every other rule',
        '<ul class="p8-others">' + others + '</ul>' +
        '<p class="p8-note">The demo ships one rule fully editable, per the build plan. ' +
        'The remaining thirteen use the same token palette and preview in the full product.</p>') +
      '</div>';
  }

  /* A-08 goes to owner, backup and the country's M1 — de-duplicated, because
     the backup and the Regional Manager are often the same person */
  function previewRecipients(state, p) {
    var names = [p.owner, p.backup].filter(Boolean).map(CBP.userName);
    names.push(recipientM1(state, p));
    var seen = {}, out = [];
    names.forEach(function (n) { if (n && !seen[n]) { seen[n] = 1; out.push(n); } });
    return out.join(', ') || 'unassigned';
  }

  function recipientM1(state, p) {
    var m1 = state.users.filter(function (u) {
      if (u.role !== 'm1') return false;
      var sc = W.userCountries(u);
      return sc === null || sc.indexOf(p.country) > -1;
    })[0];
    return m1 ? m1.name : 'Regional Manager';
  }

  /* ================================= (d) RD-2 director exception digest === */

  function digest(state, codes) {
    var ctx = W.ctx(state, codes);
    var x = W.exceptionSet(ctx);
    var user = state.user;

    /* group each section by country so a director reads it queue by queue */
    var order = codes.slice();
    function group(items) {
      var by = {};
      items.forEach(function (i) { (by[i.country] = by[i.country] || []).push(i); });
      return order.filter(function (c) { return by[c]; })
        .map(function (c) { return { code: c, name: W.countryName(state, c), items: by[c] }; });
    }

    var sections = [];

    if (x.over.length) {
      sections.push({
        title: 'Countries over their ' + CBP.CONFIG.BUDGET_YEAR + ' ceiling',
        n: x.over.length,
        groups: group(x.over).map(function (g) {
          return { name: g.name, lines: g.items.map(function (i) {
            return { lead: D.pct(i.coverage) + ' of ceiling', tone: 'hot',
                     text: i.text, href: '#/budget' };
          }) };
        })
      });
    }

    if (x.gate.length) {
      sections.push({
        title: 'External gate items past the ' + CBP.CONFIG.GATE_THRESHOLD_DAYS + '-day threshold',
        n: x.gate.length,
        groups: group(x.gate).map(function (g) {
          return { name: g.name, lines: g.items.map(function (i) {
            return { lead: D.days(i.days), tone: 'hot',
                     text: i.project.id + ' · ' + i.project.name + ' — ' + i.text,
                     href: '#/project/' + i.project.id };
          }) };
        })
      });
    }

    if (x.overdue.length) {
      sections.push({
        title: 'Overdue reviews',
        n: x.overdue.length,
        groups: group(x.overdue).map(function (g) {
          return { name: g.name, lines: g.items.map(function (i) {
            return { lead: D.days(i.days), tone: 'hot',
                     text: i.project.id + ' · ' + i.project.name + ' — ' + i.text,
                     href: '#/project/' + i.project.id };
          }) };
        })
      });
    }

    if (x.unowned.length) {
      sections.push({
        title: 'Projects without an owner',
        n: x.unowned.length,
        groups: group(x.unowned).map(function (g) {
          return { name: g.name, lines: g.items.map(function (i) {
            /* a status is not an exception magnitude — it stays neutral */
            return { lead: CBP.CONFIG.STATUS[i.project.status].short, tone: '',
                     text: i.project.id + ' · ' + i.project.name + ' — ' + x.unownedText,
                     href: '#/project/' + i.project.id };
          }) };
        })
      });
    }

    var scopeText = codes.length === state.countries.length
      ? 'all ' + codes.length + ' seeded countries'
      : codes.map(function (c) { return W.countryName(state, c); }).join(', ');

    var mail = sections.length
      ? sections.map(function (sec) {
          return '<section class="p8-sec" data-sec="' + e(sec.title) + '">' +
            '<h4>' + e(sec.title) + ' <span class="num">' + sec.n + '</span></h4>' +
            sec.groups.map(function (g) {
              return '<div class="p8-grp"><b>' + e(g.name) + '</b>' +
                g.lines.map(function (l) {
                  return '<a class="p8-line" href="' + e(l.href) + '">' +
                    '<span class="p8-lead2 num' + (l.tone ? ' hot' : '') + '">' +
                    e(l.lead) + '</span>' +
                    '<span>' + e(l.text) + '</span></a>';
                }).join('') + '</div>';
            }).join('') + '</section>';
        }).join('')
      : '<div class="p8-quiet"><b>A quiet week</b><span>No exception in ' + e(scopeText) +
        ' — every section was omitted, so this digest would not be sent.</span></div>';

    var subject = sections.length
      ? 'Exceptions for ' + scopeText + ' — week to ' + D.fmtDateY(CBP.CONFIG.TODAY)
      : 'No exceptions for ' + scopeText + ' — week to ' + D.fmtDateY(CBP.CONFIG.TODAY);

    return U.card('RD-2 · Director exception digest — preview',
      '<p class="p8-lead">Weekly, Monday 07:00, per director scope. Exceptions only — ' +
      'over-ceiling countries, gate items past threshold, overdue reviews and unowned ' +
      'projects. Empty sections are omitted, so a quiet week is a short email.</p>' +
      '<div class="p8-digest">' +
        '<div class="p8-prevhd"><span>To</span><b>' + e(user.name) + ' · ' +
          e(CBP.CONFIG.ROLE_LABEL[user.role]) + '</b></div>' +
        '<div class="p8-prevhd"><span>Scope</span><b>' + e(scopeText) + '</b></div>' +
        '<div class="p8-prevhd"><span>Subject</span><b>' + e(subject) + '</b></div>' +
        '<div class="p8-digestbody">' + mail + '</div>' +
        '<p class="p8-foot">' + e(sections.length + ' of 4 sections carried content; ' +
          (4 - sections.length) + ' omitted. A record already listed at the external gate ' +
          'is not repeated under overdue reviews.') + '</p>' +
      '</div>' +
      '<p class="p8-note">Built on A-14’s digest machinery with a scope filter, from the same ' +
      'derived exception set as the dashboard’s attention widget — the numbers here and there ' +
      'are one calculation, not two.</p>');
  }

  /* ==================================================== event wiring ====== */

  function on8() {
    return CBP.state && CBP.state.ui && CBP.state.ui.route === 'alerts' && CBP.state.ui.p8;
  }

  function closest(node, sel) {
    return (node && node.closest) ? node.closest(sel) : null;
  }

  document.addEventListener('click', function (ev) {
    if (!on8()) return;
    var state = CBP.state, s = state.ui.p8;
    var t = closest(ev.target, '[data-p8]');
    if (!t) return;
    var act = t.getAttribute('data-p8');

    if (act === 'tab') {
      ev.preventDefault();
      s.tab = t.getAttribute('data-k');
      CBP.render();

    } else if (act === 'rulefilter') {
      ev.preventDefault();
      s.ruleFilter = t.getAttribute('data-r');
      CBP.render();

    } else if (act === 'mail') {
      ev.preventDefault();
      var i = t.getAttribute('data-i');
      s.open[i] = !s.open[i];
      CBP.render();

    } else if (act === 'rule') {
      ev.preventDefault();
      if (!isAdmin(state.user)) return;
      var id = t.getAttribute('data-r');
      s.on[id] = s.on[id] === false;
      CBP.render();

    } else if (act === 'token') {
      ev.preventDefault();
      insertToken(s, t.getAttribute('data-t'));

    } else if (act === 'save') {
      ev.preventDefault();
      s.saved = true;
      CBP.render();

    } else if (act === 'reset') {
      ev.preventDefault();
      s.tpl = { subject: DEFAULT_TPL.subject, body: DEFAULT_TPL.body };
      s.saved = false;
      CBP.render();
    }
  });

  /* typing in either field re-renders the preview in the same single pass, then
     puts the caret back where it was — the pattern app.js uses for search */
  document.addEventListener('input', function (ev) {
    if (!on8()) return;
    var t = ev.target;
    if (!t || !t.getAttribute || t.getAttribute('data-p8') !== 'tpl') return;
    var s = CBP.state.ui.p8;
    var f = t.getAttribute('data-f');
    var caret = t.selectionStart;
    s.tpl[f] = t.value;
    s.field = f;
    s.saved = false;
    CBP.render();
    restore(f, caret);
  });

  document.addEventListener('focusin', function (ev) {
    if (!on8()) return;
    var t = ev.target;
    if (t && t.getAttribute && t.getAttribute('data-p8') === 'tpl') {
      CBP.state.ui.p8.field = t.getAttribute('data-f');
      snap();
    }
  });

  /* Remember where the caret is while it is still in a field. Clicking a token
     button moves focus to the button first, so by the time the click handler
     runs the selection is gone — mousedown fires before that blur, and keyup
     covers arrow keys and typing. */
  ['keyup', 'mouseup', 'select'].forEach(function (evt) {
    document.addEventListener(evt, function (ev) {
      if (!on8()) return;
      var t = ev.target;
      if (t && t.getAttribute && t.getAttribute('data-p8') === 'tpl') snap();
    });
  });

  document.addEventListener('mousedown', function (ev) {
    if (!on8()) return;
    if (closest(ev.target, '[data-p8="token"]')) snap();
  });

  function snap() {
    var s = CBP.state.ui.p8;
    var el = document.activeElement;
    if (!el || !el.getAttribute || el.getAttribute('data-p8') !== 'tpl') return;
    s.field = el.getAttribute('data-f');
    try { s.caret = el.selectionStart; } catch (err) { s.caret = null; }
  }

  function fieldEl(f) {
    return document.getElementById(f === 'subject' ? 'p8subject' : 'p8body');
  }

  function restore(f, caret) {
    var el = fieldEl(f);
    if (!el) return;
    el.focus();
    try { el.setSelectionRange(caret, caret); } catch (err) { /* older engines */ }
  }

  /* a token lands at the remembered caret of whichever field was last focused */
  function insertToken(s, token) {
    var f = s.field === 'subject' ? 'subject' : 'body';
    var cur = s.tpl[f] || '';
    var at = (typeof s.caret === 'number' && s.caret >= 0 && s.caret <= cur.length)
      ? s.caret : cur.length;
    s.tpl[f] = cur.slice(0, at) + token + cur.slice(at);
    s.caret = at + token.length;
    s.saved = false;
    CBP.render();
    restore(f, s.caret);
  }

})();
