/* pages/p4.js — P4 Project detail at #/project/<id>, plus the create form at
   #/project/new. Header (C-10 pinned decision) · vertical approval panel (C-08
   carrying the C-15 gate tracker) · tabs Overview ∣ Budget ∣ Timeline ∣
   Activity (C-09 + C-11) ∣ Files. Every control is gated by CBP.actions.can,
   so a persona switch shows or hides the whole surface in one render pass. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, A = CBP.actions, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};
  CBP.p4 = {};

  var TABS = [
    { k: 'overview', label: 'Overview' },
    { k: 'budget',   label: 'Budget' },
    { k: 'timeline', label: 'Timeline' },
    { k: 'comments', label: 'Comments' },
    { k: 'activity', label: 'Activity' },
    { k: 'files',    label: 'Files' }
  ];

  var TYPE_LABEL = { note: 'Note', question: 'Question', decision: 'Decision', system: 'System' };

  /* ------------------------------------------------------------ helpers -- */

  function err(state, key) {
    var x = state.ui.err;
    if (!x || x.key !== key) return '';
    return '<div class="p4-err">' + e(x.msg) + '</div>';
  }
  CBP.p4.err = err;

  function initials(id) {
    var n = CBP.userName(id) || '?';
    var parts = n.replace(/[^A-Za-z .]/g, '').split(/\s+/).filter(Boolean);
    return ((parts[0] || '?').charAt(0) + (parts[1] || '').charAt(0)).toUpperCase();
  }

  function countryName(code) {
    var c = CBP.state.countries.filter(function (x) { return x.code === code; })[0];
    return c ? c.name : code;
  }
  CBP.p4.countryName = countryName;

  function tag(txt) { return txt ? '<span class="p4-tag">' + e(txt) + '</span>' : ''; }

  function btn(label, act, id, opts) {
    opts = opts || {};
    return '<button class="btn' + (opts.brass ? ' brass' : '') + (opts.sm === false ? '' : ' sm') +
           '" data-act="' + e(act) + '" data-id="' + e(id) + '"' +
           (opts.sys ? ' data-sys="' + e(opts.sys) + '"' : '') +
           (opts.step ? ' data-step="' + e(opts.step) + '"' : '') +
           (opts.disabled ? ' disabled' : '') + '>' + e(label) + '</button>';
  }
  CBP.p4.btn = btn;

  function empty(text) { return '<div class="p4-empty">' + e(text) + '</div>'; }
  CBP.p4.empty = empty;

  /* the pinned decision for a project, if any (C-10) */
  function pinnedEntry(id) {
    return CBP.entriesFor(id).filter(function (x) {
      return x.type === 'decision' && x.pinned;
    }).pop() || null;
  }

  function archivedPins(id) {
    return CBP.entriesFor(id).filter(function (x) { return x.archived_pin_at; }).length;
  }

  /* ============================================================ the page ==*/

  CBP.pages.project = function (state) {
    var id = state.ui.param;

    if (!id) {
      return page('Project', U.card('No project selected',
        '<p>Open a project from the register at <a href="#/projects">#/projects</a>.</p>'));
    }
    if (id === 'new') return createPage(state);

    var p = CBP.projectById(id);
    if (!p) {
      return page('Project not found', U.card('Not found',
        '<p>No project with the id <b>' + e(id) + '</b> is loaded. ' +
        'Back to the <a href="#/projects">register</a>.</p>'));
    }
    if (D.visibleCountries(state.user, state.countries).indexOf(p.country) === -1) {
      return page('Project', U.card('Outside your data scope',
        '<p><b>' + e(p.id) + '</b> belongs to ' + e(countryName(p.country)) +
        ', which is not in your scope. Signed in as ' + e(state.user.name) + '.</p>'));
    }

    /* the record editor lives on the Overview tab, so "Edit record" clicked
       from any other tab brings the tab pointer with it */
    if (state.ui.p4Edit) state.ui.p4Tab = 'overview';

    var html = header(p, state) + returnBar(p, state) + unreadStrip(p, state) +
      banner(p, state) +
      '<div class="p4-cols">' +
        '<div class="p4-main">' + tabs(state) + tabBody(p, state) + '</div>' +
        '<div class="p4-aside">' + approvalPanel(p, state) + peopleCard(p, state) + '</div>' +
      '</div>' + CBP.p4.modal(state);

    return html;
  };

  function page(title, body) {
    return '<div class="crumb">Projects</div><div class="pagehead"><h1>' + e(title) +
           '</h1></div>' + body;
  }

  /* ------------------------------------------------------------- header -- */

  function header(p, state) {
    var user = state.user;
    var open = D.openGates(p);
    var gatePill = '';
    if (open.length) {
      var g = open.sort(function (a, b) { return b.days - a.days; })[0];
      gatePill = '<span class="p4-warn' + (g.overdue ? ' hot' : '') + '">' +
                 e(g.label) + ' gate · waiting ' + D.days(g.days) + '</span>';
    }

    var acts = [];
    if (A.can(user, 'edit', p) && !state.ui.p4Edit) {
      acts.push(btn('Edit record', 'p4-edit', p.id, { sm: false }));
    }
    if (A.can(user, 'create')) acts.push(btn('+ New project', 'p4-new', '', { sm: false }));

    /* Projects › Country › Project — the first crumb is always a one-click way
       back to the level-1 register, from every tab and from edit mode (RD 3.5) */
    return '<nav class="crumb p4-crumb" aria-label="Breadcrumb">' +
      '<a href="#/projects">Projects</a><span class="sep" aria-hidden="true">›</span>' +
      '<span>' + e(countryName(p.country)) + '</span>' +
      '<span class="sep" aria-hidden="true">›</span>' +
      '<b>' + e(p.name) + '</b><span class="pid num">' + e(p.id) + '</span></nav>' +
      '<div class="p4-head">' +
        '<div class="p4-htitle">' +
          '<h1>' + e(p.name) + '</h1>' +
          '<div class="p4-tags">' + U.statusPill(p.status) +
            tag(countryName(p.country)) + tag(p.primary_implementer) +
            tag(p.strategic_priority) + gatePill +
          '</div>' +
        '</div>' +
        (acts.length ? '<div class="p4-hacts">' + acts.join('') + '</div>' : '') +
      '</div>' +
      '<div class="p4-hmeta">' +
        '<span>Requested <b class="num">' + D.money(p.amount) + '</b></span>' +
        '<span>Owner <b>' + e(p.owner ? CBP.userName(p.owner) : 'unassigned') + '</b></span>' +
        (D.dInQ(p) !== null ? '<span>In queue <b class="num">' + D.days(D.dInQ(p)) + '</b></span>' : '') +
        (D.daysInStage(p) !== null
          ? '<span>In current stage <b class="num">' + D.days(D.daysInStage(p)) + '</b></span>' : '') +
        '<span class="p4-hprog">Progress ' + U.progressBar(p) + '</span>' +
      '</div>';
  }

  /* ------------------------------------- v1.0.1 · return + unread strips -- */

  /* After a record save A.projectUpdate sets ui.returnTo. The record does not
     bounce the user anywhere on its own — it offers the way back to the
     level-1 register and lets them decide (RD 3.5). */
  function returnBar(p, state) {
    if (state.ui.returnTo !== 'projects') return '';
    return '<div class="p4-return">' +
      '<b>Changes saved</b>' +
      '<span>The register and every derived total already read the new values.</span>' +
      '<span class="sp">' +
        btn('Back to projects', 'returnto', p.id, { brass: true, sm: false }) +
        btn('Stay on the record', 'p4c-stay', p.id, { sm: false }) +
      '</span></div>';
  }

  /* The unread alert: 3px left rule and a red value, no tinted card (rule 4).
     The count is D.unreadFor — the same function behind the sidebar balloon. */
  function unreadStrip(p, state) {
    var n = D.unreadFor(state.user, p.id);
    if (!n) return '';
    return '<div class="p4-unread">' +
      '<b class="num">' + n + '</b>' +
      '<span>new message' + (n === 1 ? '' : 's') + ' — ' +
        '<button class="p4-inlink" data-act="p4c-gotocomments" data-id="' + e(p.id) +
        '">view comments</button></span>' +
      (D.can(state.user, 'comment')
        ? '<span class="sp">' + btn('Mark all read', 'comment-readall', p.id) + '</span>' : '') +
      '</div>';
  }

  /* ------------------------------------------------- C-10 pinned banner -- */

  function banner(p, state) {
    var pin = pinnedEntry(p.id);
    if (!pin) {
      return '<div class="p4-pin empty">No decision pinned. Pin one from the Activity tab so the ' +
             'answer to “why is this held” sits at the top of the record (C-10).</div>';
    }
    var archived = archivedPins(p.id);
    var can = D.can(state.user, 'pinDecision', p);
    return '<div class="p4-pin">' +
      '<span class="p4-pinlab">Pinned decision</span>' +
      '<div class="p4-pinbody">' + mention(pin.body) +
        '<small>Pinned by ' + e(CBP.userName(pin.pinned_by || pin.author)) + ' · ' +
        e(D.fmtDateY(pin.pinned_at || pin.at)) +
        (archived ? ' · replaces ' + archived + ' earlier pin' + (archived === 1 ? '' : 's') : '') +
        '</small>' +
      '</div>' +
      (can ? '<div class="p4-pinact">' + btn('Unpin', 'unpin', pin.id) + '</div>' : '') +
      '</div>';
  }

  /* ---------------------------------------------------------------tabs -- */

  function tabs(state) {
    var openQ = 0, unread = 0;
    if (state.ui.param) {
      openQ = CBP.entriesFor(state.ui.param).filter(function (x) {
        return x.type === 'question' && !x.resolved_at;
      }).length;
      unread = D.unreadFor(state.user, state.ui.param);
    }
    return '<div class="p4-tabs">' + TABS.map(function (t) {
      var n = (t.k === 'activity') ? openQ : (t.k === 'comments' ? unread : 0);
      var badge = n ? ' <span class="p4-tbadge num">' + n + '</span>' : '';
      return '<button class="p4-tab' + (state.ui.p4Tab === t.k ? ' on' : '') +
             '" data-act="p4tab" data-tab="' + t.k + '">' + e(t.label) + badge + '</button>';
    }).join('') + '</div>';
  }

  function tabBody(p, state) {
    switch (state.ui.p4Tab) {
      case 'budget':   return budgetTab(p, state);
      case 'timeline': return timelineTab(p, state);
      case 'comments': return commentsTab(p, state);
      case 'activity': return activityTab(p, state);
      case 'files':    return filesTab(p, state);
      default:         return overviewTab(p, state);
    }
  }

  /* ------------------------------------------------------------ overview --*/

  function field(label, value) {
    return '<div class="p4-field"><span>' + e(label) + '</span><b>' +
           (value === null || value === undefined || value === '' ? '—' : e(value)) + '</b></div>';
  }

  function overviewTab(p, state) {
    if (state.ui.p4Edit) return recordForm(p, state);

    var rec = field('Project id', p.id) +
      field('Country', countryName(p.country)) +
      field('City', p.city) +
      field('Primary implementer', p.primary_implementer) +
      field('Strategic priority', p.strategic_priority) +
      field('Classification', p.classification) +
      field('Project type', p.project_type) +
      field('Target date', p.target_date ? D.fmtDateY(p.target_date) : null) +
      field('Budget year', CBP.CONFIG.BUDGET_YEAR) +
      field('CHaS sync', 'manual entry (D-09)');

    var dates = field('Created', p.created_at ? D.fmtDateY(p.created_at) : 'before the demo window') +
      field('Submitted (4 → 3)', p.submitted_at ? D.fmtDateY(p.submitted_at) : '—') +
      field('Gate opened', p.gate_opened_at ? D.fmtDateY(p.gate_opened_at) : '—') +
      field('Approved (3 → 2)', p.approved_at ? D.fmtDateY(p.approved_at) : '—') +
      field('Implementation (2 → 1)', p.implementation_date ? D.fmtDateY(p.implementation_date) : '—') +
      (p.status === 'declined' ? field('Declined', D.fmtDateY(p.declined_at)) : '') +
      (p.return_reason ? field('Last returned because', p.return_reason) : '');

    var desc = p.description
      ? '<p class="p4-desc">' + e(p.description) + '</p>'
      : '<p class="p4-desc empty">No description on the record yet — add one from ' +
        '“Edit record”.</p>';

    return '<div class="p4-two">' +
      U.card('Record', '<div class="p4-fields">' + rec + '</div>' + desc) +
      U.card('Stage dates', '<div class="p4-fields">' + dates + '</div>' +
        '<p class="p4-note">Every day count on this page is derived against ' +
        e(D.fmtDateY(CBP.CONFIG.TODAY)) + ' — nothing is stored as a counter.</p>') +
      '</div>' + budgetLine(p) + watchersCard(p, state);
  }

  function budgetLine(p) {
    var country = CBP.state.countries.filter(function (c) { return c.code === p.country; })[0];
    var ceiling = country ? country.ceiling : 0;
    var share = ceiling ? (p.amount / ceiling) * 100 : null;
    var label = { 4: 'draft', 3: 'requested', 2: 'approved', 1: 'approved',
                  declined: 'requested' }[p.status];

    return U.card('Budget line',
      '<div class="p4-bl">' +
        '<div class="p4-blv"><span class="num">' + D.money(p.amount) + '</span><small>' +
          e(label) + ' · USD (D-08)</small></div>' +
        '<div class="p4-blbar"><i style="width:' +
          Math.max(1, Math.min(100, Math.round(share || 0))) + '%"></i></div>' +
        '<div class="p4-blr"><span class="num">' + D.pct(share) + '</span><small>of the ' +
          e(countryName(p.country)) + ' ceiling ' + D.money(ceiling) + '</small></div>' +
      '</div>');
  }

  function watchersCard(p, state) {
    var w = (p.watchers || []).map(function (x) { return CBP.userName(x); });
    var body =
      '<div class="p4-fields">' +
        field('Accountable owner', p.owner ? CBP.userName(p.owner) : 'unassigned') +
        field('Backup owner (D-14)', p.backup ? CBP.userName(p.backup) : 'none') +
        field('Watchers (B-1)', w.length ? w.join(', ') : 'none yet') +
      '</div>' +
      (!p.owner ? '<p class="p4-note alert">No owner set — alerts cannot route until one is ' +
        'assigned (D-14).</p>' : '');
    return U.card('Owner and watchers', body);
  }

  /* -------------------------------------------------------------- budget --*/

  function budgetTab(p, state) {
    var country = CBP.state.countries.filter(function (c) { return c.code === p.country; })[0];
    var ceiling = country ? country.ceiling : 0;
    var mine = state.projects.filter(function (x) { return x.country === p.country; });
    var committed = D.committedTotal(mine);
    var rows = [
      ['Requested', p.status === 4 ? '—' : D.money(p.amount)],
      ['Draft', p.status === 4 ? D.money(p.amount) : '—'],
      ['Approved', (p.status === 2 || p.status === 1) ? D.money(p.amount) : '—'],
      ['Budget year', String(CBP.CONFIG.BUDGET_YEAR)],
      ['Share of the ' + countryName(p.country) + ' ceiling',
        D.pct(ceiling ? p.amount / ceiling * 100 : null)]
    ].map(function (r) {
      return '<tr><td>' + e(r[0]) + '</td><td class="r num">' + e(r[1]) + '</td></tr>';
    }).join('');

    var cov = D.coverage(committed, ceiling);
    var ctx = '<div class="p4-fields">' +
      field('Country ceiling', D.money(ceiling)) +
      field('Committed across statuses 1–4', D.money(committed)) +
      field('Coverage', D.pct(cov)) +
      field(committed > ceiling ? 'Over ceiling' : 'Headroom',
            D.money(Math.abs(ceiling - committed))) +
      '</div>' +
      (committed > ceiling
        ? '<p class="p4-note alert">' + e(countryName(p.country)) + ' is committed above its ' +
          CBP.CONFIG.BUDGET_YEAR + ' allocation — every new request here adds to the overrun.</p>'
        : '');

    return '<div class="p4-two">' +
      U.card('This project', '<div class="tblwrap"><table class="tbl p4-btbl"><tbody>' + rows +
        '</tbody></table></div>' + (D.can(state.user, 'editBudget', p)
          ? '<p class="p4-note">Edit the amount from the record editor. ' +
            'M3 can change it only while the project is a draft.</p>' : '')) +
      U.card(countryName(p.country) + ' ' + CBP.CONFIG.BUDGET_YEAR, ctx) +
      '</div>' + budgetLine(p);
  }

  /* ------------------------------------------------------------ timeline --*/

  function timelineTab(p, state) {
    var model = D.ganttModel(p);
    var planned = (p.status !== 1);
    var head = '<div class="p4-thead">' +
      '<span>' + (planned ? 'Planned implementation timeline' : 'Implementation timeline') + '</span>' +
      '<span class="r">' +
        (A.can(state.user, 'editGantt', p) ? btn('Configure phases', 'deeplink', p.id) : '') +
        btn('Open full editor in TimeBlock ↗', 'deeplink', p.id) +
      '</span></div>';

    var body = model
      ? U.gantt(p) + '<p class="p4-note">' + (planned
          ? 'Dashed bars are planned — phase dates shift from the approval date. ' +
            'Progress reports only once the project reaches status 1 (C-17).'
          : 'Progress is the elapsed share of each implementation phase; the red line is ' +
            e(D.fmtDateY(CBP.CONFIG.TODAY)) + '.') +
        ' “Open full editor in TimeBlock” deep-links the TimeBlock add-on in a new tab (D-07) — no data round-trip.</p>'
      : empty('No phases entered yet. The mini Gantt appears here once phases are added ' +
              '(D-06 / D-07); the full editor is the TimeBlock add-on.');

    return U.card('', head + body, { cls: 'p4-tl' });
  }

  /* ------------------------------------------------------------- files ----*/

  function filesTab(p, state) {
    var files = [
      { n: 'Project proposal — signed', k: 'SharePoint link', by: p.owner, at: p.submitted_at || p.created_at },
      { n: 'Partner budget breakdown', k: 'SharePoint link', by: p.owner, at: p.submitted_at || p.created_at },
      { n: 'CHaS submission pack', k: 'External system', by: 'priya', at: (p.gate || {}).chas ? p.gate.chas.submitted_at : null }
    ];
    var rows = files.map(function (f) {
      return '<tr><td><b>' + e(f.n) + '</b></td><td class="dim">' + e(f.k) + '</td>' +
             '<td class="dim">' + e(f.by ? CBP.userName(f.by) : 'unassigned') + '</td>' +
             '<td class="r dim num">' + e(f.at ? D.fmtDateY(f.at) : '—') + '</td>' +
             '<td class="r">' + btn('Open ↗', 'deeplink', p.id) + '</td></tr>';
    }).join('');

    return U.card('Files as links',
      U.table([{ label: 'Document' }, { label: 'Held in' }, { label: 'Added by' },
               { label: 'Date', right: true }, { label: '', right: true }], [rows]) +
      '<p class="p4-note">v1 stores links, not uploads: documents stay in the systems that already ' +
      'own them and the project record points at them. Attachment upload is deliberately out of ' +
      'scope for the demo.</p>');
  }

  /* ============================================ v1.0.1 · comments feed =====
     The conversation layer, deliberately NOT the audit stream: one flat
     chronological list, oldest first, name + date + time, no threading, no
     type chips beyond the one distinction that matters here (a decision note
     carried over from the approval flow). Reading is never implicit — nothing
     is marked read by opening the tab, only by the affordances below. */

  function commentRow(c, p, state) {
    var user = state.user;
    var mine = c.author === user.id;
    var unread = D.isUnread(user, c);
    var note = c.kind === 'approval_note';

    var meta = '<div class="cm-meta">' +
      '<b>' + e(CBP.userName(c.author)) + '</b>' +
      '<span class="num">' + e(D.fmtDateY(c.at)) + '</span>' +
      '<span class="num">' + e(c.time || '') + '</span>' +
      (note ? '<span class="cm-kind"><span class="ic" aria-hidden="true">✓</span>' +
        'Approval note</span>' : '') +
      (c.priority ? '<span class="cm-flag">Priority</span>' : '') +
      (c.edited_at ? '<span class="cm-edited">(edited ' + e(D.fmtDateY(c.edited_at)) +
        ')</span>' : '') +
      (unread ? '<span class="cm-new">new</span>' : '') +
      '</div>';

    var body;
    if (state.ui.editComment === c.id && mine) {
      body = '<div class="cm-edit">' +
        '<textarea id="p4cEdit" class="p4-input" rows="3" data-act="p4c-edraft">' +
        e(c.body) + '</textarea>' + err(state, 'comment') +
        '<div class="cm-btns">' +
          btn('Save comment', 'p4c-edit-save', c.id, { brass: true }) +
          btn('Cancel', 'p4c-edit-cancel', c.id) +
        '</div></div>';
    } else {
      body = '<div class="cm-txt">' + mention(c.body) + '</div>';
    }

    var acts = [];
    if (state.ui.editComment !== c.id) {
      if (mine && D.can(user, 'comment', p)) acts.push(btn('Edit', 'p4c-edit', c.id));
      if (!mine && D.can(user, 'comment')) {
        acts.push('<button class="btn sm" data-act="comment-read" data-id="' + e(c.id) +
          '" data-read="' + (unread ? 'true' : 'false') + '">' +
          (unread ? 'Mark read' : 'Mark unread') + '</button>');
      }
    }

    return '<article class="cm' + (note ? ' note' : '') + (unread ? ' unread' : '') +
      '" id="cm-' + e(c.id) + '">' +
      '<div class="cm-av' + (note ? ' note' : '') + '">' + e(initials(c.author)) + '</div>' +
      '<div class="cm-b">' + meta + body +
        (acts.length ? '<div class="cm-btns">' + acts.join('') + '</div>' : '') +
      '</div></article>';
  }

  function commentComposer(p, state) {
    var user = state.user;
    if (!D.can(user, 'comment', p)) {
      return '<div class="cm-composer readonly">Read-only role — you can follow the ' +
        'conversation and export it, but not post (RD/RM-3).</div>';
    }
    /* an unsent message belongs to the project it was written on */
    var draft = (state.ui.p4cDraftFor === p.id && typeof state.ui.p4cDraft === 'string')
      ? state.ui.p4cDraft : '';

    return '<div class="cm-composer">' +
      '<label class="vh" for="p4cBody">Write a comment</label>' +
      '<textarea id="p4cBody" class="p4-input" rows="2" data-act="p4c-draft" ' +
      'placeholder="Write to the people on this project — @mention to point at someone">' +
      e(draft) + '</textarea>' +
      err(state, 'comment') +
      '<div class="cm-crow">' +
        '<span class="cm-hint">Comments are conversation and stay on the project. ' +
        'Nothing is deleted — an edit is stamped “(edited)”.</span>' +
        '<span class="sp"><button class="btn brass sm" data-act="p4c-post" data-id="' +
        e(p.id) + '">Post comment</button></span>' +
      '</div></div>';
  }

  function commentsTab(p, state) {
    var list = D.commentsFor(p.id);                 /* D.commentOrder — oldest first */
    var unread = D.unreadFor(state.user, p.id);
    var notes = list.filter(function (c) { return c.kind === 'approval_note'; }).length;

    var head = '<div class="cm-head">' +
      '<div class="cm-htitle"><b>Conversation</b>' +
        '<small class="num">' + list.length + ' message' + (list.length === 1 ? '' : 's') +
        (notes ? ' · ' + notes + ' approval note' + (notes === 1 ? '' : 's') : '') +
        (unread ? ' · ' + unread + ' unread' : '') + '</small></div>' +
      '<div class="cm-hacts">' +
        (D.can(state.user, 'comment') && unread
          ? btn('Mark all read', 'comment-readall', p.id) : '') +
        '<a class="btn sm" href="#/projects">Back to projects</a>' +
      '</div></div>';

    var feed = list.length
      ? list.map(function (c) { return commentRow(c, p, state); }).join('')
      : empty('No comments on this project yet. The first message starts the thread.');

    return '<section class="card cm-card" id="p4comments">' + head +
      '<div class="cm-feed">' + feed + '</div>' +
      commentComposer(p, state) +
      '<p class="cm-foot">Opening this tab does not mark anything read — use ' +
      '“Mark all read”, or the control on a single message, so the balloon count stays ' +
      'something you chose.</p>' +
      '</section>';
  }

  /* ================================================ C-09 activity stream ==*/

  function mention(body) {
    return e(body).replace(/@([A-Za-z][A-Za-z0-9_.'-]*(?:\s[A-Z][A-Za-z.]*)?)/g,
      '<span class="act-mention">@$1</span>');
  }

  function activityTab(p, state) {
    var all = CBP.entriesFor(p.id);
    var tops = all.filter(function (x) { return !x.parent; });
    var counts = {
      all: tops.length,
      note: tops.filter(function (x) { return x.type === 'note'; }).length,
      question: tops.filter(function (x) { return x.type === 'question'; }).length,
      decision: tops.filter(function (x) { return x.type === 'decision'; }).length,
      system: tops.filter(function (x) { return x.type === 'system'; }).length
    };
    var f = state.ui.actFilter || 'all';
    var shown = tops.filter(function (x) { return f === 'all' || x.type === f; });

    shown.sort(function (a, b) {
      if (a.at === b.at) return seq(b.id) - seq(a.id);
      return a.at < b.at ? 1 : -1;                        /* newest first */
    });

    var filters = [['all', 'All'], ['note', 'Notes'], ['question', 'Questions'],
                   ['decision', 'Decisions'], ['system', 'System']]
      .map(function (x) {
        return '<button class="act-ftab' + (f === x[0] ? ' on' : '') +
               '" data-act="actfilter" data-f="' + x[0] + '">' + e(x[1]) +
               ' <span class="n num">' + counts[x[0]] + '</span></button>';
      }).join('');

    var stream = shown.length
      ? shown.map(function (x) { return entryHtml(x, all, p, state); }).join('')
      : empty('Nothing in this filter yet.');

    return '<section class="card act-card">' +
      '<div class="act-sep">This is the audit stream — every status move, gate click and ' +
      'record edit, in the order it happened. Person-to-person conversation lives in the ' +
      '<button class="p4-inlink" data-act="p4c-gotocomments" data-id="' + e(p.id) +
      '">Comments tab</button>.</div>' +
      '<div class="act-ftabs">' + filters + '</div>' +
      '<div class="act-stream">' + stream + '</div>' +
      composer(p, state) +
      '</section>';
  }

  function seq(id) {
    var m = /(\d+)$/.exec(String(id || ''));
    return m ? parseInt(m[1], 10) : 0;
  }

  function entryHtml(x, all, p, state) {
    var user = state.user;
    var replies = all.filter(function (r) { return r.parent === x.id; })
      .sort(function (a, b) { return seq(a.id) - seq(b.id); });

    var meta = '<div class="act-meta">' +
      (x.type === 'system' ? '<b>System</b>' : '<b>' + e(CBP.userName(x.author)) + '</b>') +
      '<span class="num">' + e(D.fmtDateY(x.at)) + '</span>' +
      '<span class="act-type t-' + x.type + '">' + e(TYPE_LABEL[x.type] || x.type) + '</span>' +
      (x.type === 'question'
        ? '<span class="act-type ' + (x.resolved_at ? 't-resolved' : 't-open') + '">' +
          (x.resolved_at
            ? 'Resolved by ' + e(CBP.userName(x.resolved_by)) + ' · ' + e(D.fmtDateY(x.resolved_at))
            : 'Open → ' + e(CBP.userName(x.assigned_to))) + '</span>'
        : '') +
      (x.pinned ? '<span class="act-type t-pinned">Pinned</span>' : '') +
      (x.archived_pin_at ? '<span class="act-type t-arch">Pin archived ' +
        e(D.fmtDateY(x.archived_pin_at)) + '</span>' : '') +
      (x.edited_at ? '<span class="act-edited">edited by ' + e(CBP.userName(x.edited_by)) +
        ' · ' + e(D.fmtDateY(x.edited_at)) + '</span>' : '') +
      '</div>';

    var bodyHtml = (state.ui.editEntry === x.id)
      ? '<div class="act-edit">' +
          '<textarea id="entryBody" class="p4-input" rows="3">' + e(x.body) + '</textarea>' +
          err(state, 'editEntry') +
          '<div class="act-btns">' + btn('Save edit', 'entry-edit-save', x.id, { brass: true }) +
            btn('Cancel', 'entry-edit-cancel', x.id) + '</div>' +
        '</div>'
      : '<div class="act-txt">' + mention(x.body) + '</div>';

    /* controls, each behind the matching permission */
    var acts = [];
    if (state.ui.editEntry !== x.id) {
      if (x.type === 'question' && !x.resolved_at &&
          (x.assigned_to === user.id || x.author === user.id ||
           user.role === 'm1' || user.role === 'admin') && !user.read_only) {
        acts.push(btn('Mark resolved', 'resolve', x.id, { brass: true }));
      }
      if (x.type === 'decision' && !x.pinned && D.can(user, 'pinDecision', p)) {
        acts.push(btn('Pin to header', 'pin', x.id));
      }
      if (x.type === 'decision' && x.pinned && D.can(user, 'pinDecision', p)) {
        acts.push(btn('Unpin', 'unpin', x.id));
      }
      if (x.type !== 'system' && D.can(user, 'post', p) && state.ui.replyTo !== x.id) {
        acts.push(btn('Reply', 'reply-open', x.id));
      }
      if (x.type !== 'system' && !user.read_only &&
          (x.author === user.id || user.role === 'admin')) {
        acts.push(btn('Edit', 'entry-edit', x.id));
      }
    }

    var errKey = (state.ui.err && (state.ui.err.key === 'resolve' || state.ui.err.key === 'pin'))
      ? err(state, state.ui.err.key) : '';

    var replyBox = '';
    if (state.ui.replyTo === x.id) {
      replyBox = '<div class="act-reply-box">' +
        '<textarea id="replyBody" class="p4-input" rows="2" ' +
        'placeholder="Reply — one level only, so a project log never becomes a forum"></textarea>' +
        err(state, 'post') +
        '<div class="act-btns">' +
          '<button class="btn brass sm" data-act="reply-post" data-id="' + e(x.id) +
          '" data-project="' + e(p.id) + '">Post reply</button>' +
          btn('Cancel', 'reply-cancel', x.id) +
        '</div></div>';
    }

    var repliesHtml = replies.map(function (r) {
      return '<div class="act-reply">' +
        '<div class="act-meta"><b>' + e(CBP.userName(r.author)) + '</b>' +
        '<span class="num">' + e(D.fmtDateY(r.at)) + '</span>' +
        (r.edited_at ? '<span class="act-edited">edited by ' + e(CBP.userName(r.edited_by)) +
          ' · ' + e(D.fmtDateY(r.edited_at)) + '</span>' : '') +
        '</div>' +
        (state.ui.editEntry === r.id
          ? '<div class="act-edit"><textarea id="entryBody" class="p4-input" rows="2">' +
            e(r.body) + '</textarea>' + err(state, 'editEntry') + '<div class="act-btns">' +
            btn('Save edit', 'entry-edit-save', r.id, { brass: true }) +
            btn('Cancel', 'entry-edit-cancel', r.id) + '</div></div>'
          : '<div class="act-txt">' + mention(r.body) + '</div>' +
            (!state.user.read_only && (r.author === state.user.id || state.user.role === 'admin')
              ? '<div class="act-btns">' + btn('Edit', 'entry-edit', r.id) + '</div>' : '')) +
        '</div>';
    }).join('');

    return '<article class="act-entry t-' + x.type +
      (x.type === 'question' && !x.resolved_at ? ' open-q' : '') + '">' +
      '<div class="act-av' + (x.type === 'system' ? ' sys' : '') + '">' +
        (x.type === 'system' ? '⚙' : e(initials(x.author))) + '</div>' +
      '<div class="act-b">' + meta + bodyHtml +
        (acts.length ? '<div class="act-btns">' + acts.join('') + '</div>' : '') +
        errKey + repliesHtml + replyBox +
      '</div></article>';
  }

  /* -------------------------------------------------------- C-11 composer -*/

  function composer(p, state) {
    var user = state.user;
    if (!D.can(user, 'post', p)) {
      return '<div class="act-composer readonly">Read-only role — you can follow the stream and ' +
             'export it, but not post (RD/RM-3).</div>';
    }
    var d = state.ui.draft || { type: 'note', body: '', assigned_to: '' };
    var types = [['note', 'Note'], ['question', 'Question'], ['decision', 'Decision']]
      .map(function (t) {
        var on = (d.type || 'note') === t[0];
        return '<button class="act-tchip t-' + t[0] + (on ? ' on' : '') +
               '" data-act="draft-type" data-t="' + t[0] + '">' + e(t[1]) + '</button>';
      }).join('');

    var people = state.users.filter(function (u) { return u.role !== 'viewer'; });
    var assignee = (d.type === 'question')
      ? '<label class="act-assign">Assign to' +
        '<select class="sel sm" id="actAssignee">' +
        people.map(function (u) {
          return '<option value="' + e(u.id) + '"' +
                 (d.assigned_to === u.id ? ' selected' : '') + '>' + e(u.name) + '</option>';
        }).join('') + '</select></label>'
      : '';

    return '<div class="act-composer">' +
      '<textarea id="actBody" class="p4-input" rows="2" ' +
      'placeholder="Write a note, ask a question, or record a decision… @mention to notify">' +
      e(d.body || '') + '</textarea>' +
      err(state, 'post') +
      '<div class="act-crow">' + types + assignee +
        '<span class="sp">' +
          '<button class="btn brass sm" data-act="post-entry" data-id="' + e(p.id) + '">Post</button>' +
        '</span>' +
      '</div>' +
      '<div class="act-chint">A question must name an assignee and stays open until resolved. ' +
      'A decision can be pinned to the header. Nothing is ever deleted — edits are stamped ' +
      '(D-12).</div></div>';
  }

  /* ====================================== C-08 vertical approval panel ====*/

  function stepRow(mark, cls, title, sub) {
    return '<div class="p4-step ' + cls + '"><span class="mk">' + e(mark) + '</span>' +
           '<div><b>' + e(title) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div></div>';
  }

  /* C-15 — two systems × two click-done actions, per-system counter, M1 only */
  function gateSystems(p, state, inModal) {
    var canGate = A.can(state.user, 'gate', p);
    return D.gate(p).map(function (g) {
      var pill, sub;
      if (g.state === 'approved') {
        pill = '<span class="p4-gp ok">approved ✓</span>';
        sub = g.submitted_at && g.approved_at
          ? 'submitted ' + D.fmtDateY(g.submitted_at) + ' → approved ' + D.fmtDateY(g.approved_at) +
            ' · <b class="num">' + D.days(g.days) + '</b>'
          : (g.approved_at ? 'approved ' + D.fmtDateY(g.approved_at) : 'cleared before the demo window');
        if (g.ref) sub += ' · ref ' + e(g.ref);
      } else if (g.state === 'waiting') {
        pill = '<span class="p4-gp ' + (g.overdue ? 'hot' : 'wait') + '">waiting <span class="num">' +
               D.days(g.days) + '</span></span>';
        sub = 'submitted ' + D.fmtDateY(g.submitted_at) + ', no approval yet' +
              (g.overdue ? ' · past the ' + CBP.CONFIG.GATE_THRESHOLD_DAYS + '-day threshold' : '');
      } else {
        pill = '<span class="p4-gp todo">not lodged</span>';
        sub = A.gateOpen(p) ? 'waiting for the request to be lodged' : 'opens after Request approved';
      }
      if (g.remark) sub += '<em class="p4-grem">Remark: ' + e(g.remark) + '</em>';

      var rec = (p.gate || {})[g.key] || {};
      var buttons = canGate
        ? '<div class="p4-gbtns">' +
            btn('Request submitted ✓', 'gate-click', p.id,
                { sys: g.key, step: 'submitted', disabled: !!rec.submitted_at }) +
            btn('Request approved ✓', 'gate-click', p.id,
                { sys: g.key, step: 'approved', brass: true,
                  disabled: !rec.submitted_at || !!rec.approved_at }) +
          '</div>' +
          (g.state === 'approved' ? '' :
            '<input class="p4-input sm" type="text" data-remark-for="' + e(g.key) + '" ' +
            'placeholder="Optional remark for the next click">')
        : '';

      return '<div class="p4-gsys' + (g.overdue ? ' hot' : '') + '">' +
        '<div class="p4-gh"><b>' + e(g.label) + '</b>' + pill + '</div>' +
        '<div class="p4-gsub">' + sub + '</div>' + buttons + '</div>';
    }).join('') + (canGate ? '' :
      '<p class="p4-note">Gate clicks are recorded by the Regional Manager only (R-2). ' +
      'Everyone else sees the same counters, read-only.</p>');
  }
  CBP.p4.gateSystems = gateSystems;

  function approvalPanel(p, state) {
    var user = state.user;
    var gateOpen = A.gateOpen(p);
    var declined = p.status === 'declined';
    var done2 = (p.status === 2 || p.status === 1);
    var html = '';

    /* 1 · Request submitted (Process 4) */
    if (p.status === 4) {
      html += stepRow('◷', 'wait', 'Request submitted — M2',
        'waiting on the Area Manager' +
        (D.daysInStage(p) !== null ? ' · in development <b class="num">' +
          D.days(D.daysInStage(p)) + '</b>' : ''));
    } else {
      html += stepRow('✓', 'ok', 'Request submitted — M2',
        p.submitted_at ? 'recorded ' + D.fmtDateY(p.submitted_at) : 'recorded before the demo window');
    }

    /* 2 · Request approved (Process 3) */
    if (declined) {
      html += stepRow('✕', 'hot', 'Rejected — M1',
        (p.declined_at ? D.fmtDateY(p.declined_at) : '') +
        (p.decline_reason ? ' · ' + e(p.decline_reason) : '') +
        '<em class="p4-grem">A declined project returns under a new ID (R-3).</em>');
    } else if (done2 || gateOpen) {
      html += stepRow('✓', 'ok', 'Request approved — M1',
        (p.gate_opened_at ? 'gate opened ' + D.fmtDateY(p.gate_opened_at) : 'advanced to the gate') +
        (p.review_days !== undefined && p.review_days !== null
          ? ' · review <b class="num">' + D.days(p.review_days) + '</b>' : ''));
    } else if (p.status === 3) {
      html += stepRow('◷', 'wait', 'Request approved — M1',
        'in review <b class="num">' + D.days(D.daysInStage(p)) + '</b>');
    } else {
      html += stepRow('◻', 'todo', 'Request approved — M1', 'after the request is submitted');
    }

    /* 3 · external gate */
    html += '<div class="p4-gate"><div class="p4-glab">External gate — Decision Point and CHaS</div>' +
      (declined ? empty('The gate never opened for this record.') : gateSystems(p, state)) +
      '</div>';

    /* 4 · Mark Approved */
    if (done2) {
      var refs = p.refs || {};
      html += stepRow('✓', 'ok', 'Marked approved — 3 → 2',
        (p.approved_at ? D.fmtDateY(p.approved_at) : '') +
        (refs.decision_point ? ' · DP ' + e(refs.decision_point) : '') +
        (refs.chas ? ' · CHaS ' + e(refs.chas) : ''));
    } else if (A.readyToMark(p)) {
      html += '<div class="p4-ready">' +
        '<b>Both gates cleared — ready to mark approved</b>' +
        '<small>A-07 prompt: the project is still at status 3. Both reference numbers are ' +
        'mandatory (R-4).</small>' +
        (D.can(user, 'markApproved')
          ? '<label class="p4-lab">Decision Point reference' +
            '<input class="p4-input" type="text" id="refDP" placeholder="e.g. DP-2026-0501"></label>' +
            '<label class="p4-lab">CHaS reference' +
            '<input class="p4-input" type="text" id="refCH" placeholder="e.g. CHS-78110"></label>' +
            err(state, 'mark') +
            '<div class="p4-actrow">' + btn('Mark Approved · 3 → 2', 'do-mark', p.id,
              { brass: true, sm: false }) + '</div>'
          : '<small>Only the Regional Manager can mark the project approved.</small>') +
        '</div>';
    } else if (!declined) {
      html += stepRow('◻', 'todo', 'Mark Approved — 3 → 2', 'unlocks when both gates show ✓');
    }

    /* 5 · implementation */
    if (p.status === 2) {
      html += stepRow('◷', 'wait', 'Implementation — 2 → 1',
        'awaiting kickoff <b class="num">' + D.days(D.daysInStage(p)) + '</b>');
    } else if (p.status === 1) {
      html += stepRow('✓', 'ok', 'In implementation — status 1',
        'started ' + D.fmtDateY(p.implementation_date));
    }

    /* action buttons per role */
    var acts = [];
    if (A.can(user, 'submit', p)) acts.push(btn('Request submitted', 'ask-submit', p.id, { brass: true, sm: false }));
    if (A.can(user, 'review', p)) {
      acts.push(btn('Request approved', 'ask-approve', p.id, { brass: true, sm: false }));
      acts.push(btn('Return to Review', 'ask-return', p.id, { sm: false }));
      acts.push(btn('Reject', 'ask-reject', p.id, { sm: false }));
    }
    if (A.can(user, 'start', p)) acts.push(btn('Start implementation', 'ask-start', p.id, { brass: true, sm: false }));

    var errBlock = ['submit', 'review', 'return', 'reject', 'gate', 'start']
      .map(function (k) { return err(state, k); }).join('');

    var tail = acts.length
      ? '<div class="p4-actrow">' + acts.join('') + '</div>'
      : (A.can(user, 'gate', p) || A.readyToMark(p)
          ? ''                                   /* the gate controls above are the action */
          : '<p class="p4-note">Nothing here is waiting on your role right now.</p>');

    return U.card('Approval status',
      '<div class="p4-steps">' + html + '</div>' + errBlock + tail, { cls: 'p4-appr' });
  }

  function peopleCard(p, state) {
    var o = p.owner;
    return U.card('Owner',
      '<div class="p4-owner">' +
        '<span class="act-av">' + e(o ? initials(o) : '—') + '</span>' +
        '<div><b>' + e(o ? CBP.userName(o) : 'unassigned') + '</b>' +
        '<small>' + e(o && CBP.userById(o)
          ? (CBP.userById(o).title || CBP.CONFIG.ROLE_LABEL[CBP.userById(o).role])
          : 'country staff · ' + countryName(p.country)) + '</small></div>' +
      '</div>' +
      '<div class="p4-fields">' +
        field('Backup', p.backup ? CBP.userName(p.backup) : 'none') +
        field('Alert routing', p.owner ? 'owner + backup' : 'blocked — no owner') +
      '</div>' +
      (A.can(state.user, 'edit', p)
        ? '<div class="p4-actrow">' + btn('Owner settings', 'p4-edit', p.id) + '</div>' : ''));
  }

  /* ================================================= create / edit form ===*/

  function opt(v, label, sel) {
    return '<option value="' + e(v) + '"' + (sel ? ' selected' : '') + '>' + e(label) + '</option>';
  }

  function recordForm(p, state, isNew) {
    var user = state.user;
    var codes = D.visibleCountries(user, state.countries);
    var people = state.users.filter(function (u) { return u.role !== 'viewer'; });
    var v = p || { owner: user.id, country: codes[0] };   /* a new record starts on you */

    var countrySel = isNew
      ? '<label class="p4-lab">Country<select class="sel" id="fCountry">' +
        codes.map(function (c) { return opt(c, countryName(c), v.country === c); }).join('') +
        '</select></label>'
      : '<label class="p4-lab">Country<input class="p4-input" type="text" id="fCountry" value="' +
        e(countryName(v.country)) + '" disabled></label>';

    var ownerOpts = opt('', 'unassigned', !v.owner) +
      people.map(function (u) { return opt(u.id, u.name, v.owner === u.id); }).join('') +
      (v.owner && !CBP.userById(v.owner) ? opt(v.owner, CBP.userName(v.owner), true) : '');

    var backupOpts = opt('', 'none', !v.backup) +
      people.map(function (u) { return opt(u.id, u.name, v.backup === u.id); }).join('') +
      (v.backup && !CBP.userById(v.backup) ? opt(v.backup, CBP.userName(v.backup), true) : '');

    var amountDisabled = !isNew && !D.can(user, 'editBudget', p);

    var body =
      '<div class="p4-form">' +
        '<label class="p4-lab wide">Project name<input class="p4-input" type="text" id="fName" ' +
          'value="' + e(v.name || '') + '" placeholder="e.g. Emergency Shelter Kits"></label>' +
        countrySel +
        '<label class="p4-lab">Requested amount (USD)<input class="p4-input num" type="text" ' +
          'id="fAmount" value="' + e(v.amount === undefined ? '' : v.amount) + '" ' +
          'placeholder="250000"' + (amountDisabled ? ' disabled' : '') + '></label>' +
        '<label class="p4-lab">Primary implementer<input class="p4-input" type="text" ' +
          'id="fImplementer" value="' + e(v.primary_implementer || '') + '"></label>' +
        '<label class="p4-lab">Strategic priority<input class="p4-input" type="text" ' +
          'id="fPriority" value="' + e(v.strategic_priority || '') + '"></label>' +
        '<label class="p4-lab">City<input class="p4-input" type="text" id="fCity" value="' +
          e(v.city || '') + '"></label>' +
        '<label class="p4-lab">Target date<input class="p4-input num" type="date" id="fTarget" ' +
          'value="' + e(v.target_date || '') + '"></label>' +
        '<label class="p4-lab">Accountable owner<select class="sel" id="fOwner">' + ownerOpts +
          '</select></label>' +
        '<label class="p4-lab">Backup owner<select class="sel" id="fBackup">' + backupOpts +
          '</select></label>' +
        /* v1.0.1 — the contract's remaining record fields, so the edit area
           covers the whole record and not just the half it used to. They are
           edit-only: A.createProject takes the starting set above. */
        (isNew ? '' :
          '<label class="p4-lab">Classification<input class="p4-input" type="text" ' +
            'id="fClassification" value="' + e(v.classification || '') + '"></label>' +
          '<label class="p4-lab">Project type<input class="p4-input" type="text" ' +
            'id="fType" value="' + e(v.project_type || '') + '"></label>' +
          '<label class="p4-lab wide">Description<textarea class="p4-input" rows="3" ' +
            'id="fDescription" placeholder="What the project does, in the words the ' +
            'reviewers will read">' + e(v.description || '') + '</textarea></label>') +
      '</div>' +
      err(state, isNew ? 'create' : 'edit') +
      '<div class="p4-actrow">' +
        (isNew
          ? btn('Create project', 'p4-create', '', { brass: true, sm: false }) +
            btn('Cancel', 'p4-create-cancel', '', { sm: false })
          : btn('Save changes', 'p4c-save', v.id, { brass: true, sm: false }) +
            btn('Cancel', 'p4-edit-cancel', v.id, { sm: false }) +
            '<a class="btn" href="#/projects">Back to projects</a>') +
      '</div>' +
      '<p class="p4-note">' + (isNew
        ? 'A new record always starts at status 4 In Development and takes the next free id for ' +
          'its country — the next ' + e(countryName(codes[0])) + ' id is ' +
          e(A.nextProjectId(codes[0])) + '. Progress reads “not submitted”, never 0% (C-17).'
        : 'Every field on the record is editable here — name, amount, owner, backup, ' +
          'implementer, priority, target date and description. M3 can edit their own projects ' +
          'only while they sit at status 4, and only draft amounts (permission matrix). Every ' +
          'save writes a system entry to the activity stream and offers the way back to the ' +
          'register.') + '</p>';

    return U.card(isNew ? 'Project record' : 'Edit record', body, { cls: 'p4-formcard' });
  }

  function createPage(state) {
    var user = state.user;
    if (!A.can(user, 'create')) {
      return page('New project', U.card('Not available',
        '<p>Your role cannot create projects. Signed in as ' + e(user.name) + ' — ' +
        e(CBP.CONFIG.ROLE_LABEL[user.role]) + '.</p>'));
    }
    return '<div class="crumb"><a href="#/projects">Projects</a> · New</div>' +
      '<div class="pagehead"><h1>New project</h1>' +
      '<span class="sub">Status 4 In Development · budget year ' + CBP.CONFIG.BUDGET_YEAR +
      '</span></div>' + recordForm(null, state, true);
  }

  /* ======================================================= C-12 modals ====*/

  CBP.p4.modal = function (state) {
    var m = state.ui.modal;
    if (!m) return '';
    var p = CBP.projectById(m.id);
    if (!p) return '';
    var v = m.values || {};
    var head = '<p class="p4-msub">' + e(p.id) + ' · ' + e(p.name) + ' · ' +
               e(countryName(p.country)) + ' · <span class="num">' + D.money(p.amount) + '</span></p>';
    var title = '', body = '', acts = '';

    if (m.kind === 'submit') {
      title = 'Request submitted';
      body = head + '<p>This completes Process 4 and moves the record from status 4 to status 3. ' +
        'The stage clock restarts and the Regional Manager is alerted (A-01).</p>';
      acts = btn('Cancel', 'modal-cancel', p.id, { sm: false }) +
             btn('Request submitted', 'do-submit', p.id, { brass: true, sm: false });

    } else if (m.kind === 'approve') {
      title = 'Request approved';
      body = head + '<p>Process 3. The project stays at status 3 and moves to the external gate: ' +
        'Decision Point and CHaS are then tracked separately, each with its own day counter. ' +
        'The Area Manager and owner are prompted to lodge the request (A-02).</p>' +
        '<label class="p4-lab wide">Remark (optional)<input class="p4-input" type="text" ' +
        'id="mRemark" value="' + e(v.mRemark || '') + '"></label>' + err(state, 'review');
      acts = btn('Cancel', 'modal-cancel', p.id, { sm: false }) +
             btn('Request approved', 'do-approve', p.id, { brass: true, sm: false });

    } else if (m.kind === 'return') {
      title = 'Return to Review';
      body = head + '<p>The project drops back to status 4 In Development and the status-4 clock ' +
        'restarts. A reason is mandatory — it is sent to the Area Manager and the owner (A-03) ' +
        'and kept on the record.</p>' +
        '<label class="p4-lab wide">Reason<textarea class="p4-input" id="mReason" rows="3" ' +
        'placeholder="What has to change before this can be resubmitted?">' + e(v.mReason || '') +
        '</textarea></label>' + err(state, 'return');
      acts = btn('Cancel', 'modal-cancel', p.id, { sm: false }) +
             btn('Return to Review', 'do-return', p.id, { brass: true, sm: false });

    } else if (m.kind === 'reject') {
      title = 'Reject — Declined';
      body = head + '<p>The project moves to Declined. It is never reopened in place: a replacement ' +
        'is created under a new ID (R-3). A reason is mandatory (A-04).</p>' +
        '<label class="p4-lab wide">Reason<textarea class="p4-input" id="mReason" rows="3">' +
        e(v.mReason || '') + '</textarea></label>' + err(state, 'reject');
      acts = btn('Cancel', 'modal-cancel', p.id, { sm: false }) +
             btn('Reject', 'do-reject', p.id, { brass: true, sm: false });

    } else if (m.kind === 'gate') {
      title = 'Update the external gate';
      body = head + '<p>Four click-done actions across the two systems. Each click stamps today’s ' +
        'date and starts or stops that sub-step’s own counter; a remark is optional. ' +
        'M1 only (R-2).</p>' +
        '<div class="p4-gate">' + gateSystems(p, state, true) + '</div>' + err(state, 'gate') +
        (A.readyToMark(p)
          ? '<div class="p4-ready compact"><b>Both gates cleared — ready to mark approved</b>' +
            '<small>A-07 prompt sent to the Regional Manager.</small></div>' : '');
      acts = btn('Done', 'modal-cancel', p.id, { sm: false }) +
             (A.readyToMark(p) && D.can(state.user, 'markApproved')
               ? btn('Mark Approved…', 'ask-mark', p.id, { brass: true, sm: false }) : '');

    } else if (m.kind === 'mark') {
      title = 'Mark Approved · 3 → 2';
      body = head + '<p>Both external reference numbers are mandatory free text (R-4) — they are ' +
        'what joins this record to the church’s systems of record before any API exists.</p>' +
        '<label class="p4-lab wide">Decision Point reference<input class="p4-input" type="text" ' +
        'id="mRefDP" value="' + e(v.mRefDP || '') + '" placeholder="e.g. DP-2026-0501"></label>' +
        '<label class="p4-lab wide">CHaS reference<input class="p4-input" type="text" ' +
        'id="mRefCH" value="' + e(v.mRefCH || '') + '" placeholder="e.g. CHS-78110"></label>' +
        err(state, 'mark');
      acts = btn('Cancel', 'modal-cancel', p.id, { sm: false }) +
             btn('Mark Approved', 'do-mark', p.id, { brass: true, sm: false });

    } else if (m.kind === 'start') {
      title = 'Start implementation · 2 → 1';
      body = head + '<p>Moves the project to status 1 and starts the implementation clock. ' +
        'Progress then reports against the timeline phases.</p>' + err(state, 'start');
      acts = btn('Cancel', 'modal-cancel', p.id, { sm: false }) +
             btn('Start implementation', 'do-start', p.id, { brass: true, sm: false });
    }

    return '<div class="modal-wrap" data-act="mclose"><div class="modal p4-modal">' +
      '<h3>' + e(title) + '</h3>' + body +
      '<div class="acts">' + acts + '</div></div></div>';
  };

  /* ================================================ delegated listener ====
     Registered ONCE at load, never per render. actions.js owns every data-act
     it already knows; anything prefixed 'p4c-' is this page's own wiring — the
     comment composer, the inline comment editor and the full-record save, none
     of which can live in actions.js because the field ids belong to the page.
     Same one-pass rule throughout: read the DOM, call CBP.actions, render. */

  function S() { return CBP.state; }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  /* app.js's search box refocus, generalised: render() replaces the markup the
     event came from, so a control that survives it has to be given the caret
     back or the user loses their place mid-sentence. */
  function refocus(id, toEnd) {
    var el = document.getElementById(id);
    if (!el) return;
    try {
      el.focus();
      if (toEnd && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
    } catch (err) {}
  }

  function scrollToComments() {
    var el = document.getElementById('p4comments');
    if (el && el.scrollIntoView) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      catch (err) { try { el.scrollIntoView(); } catch (err2) {} }
    }
  }

  /* every editable field on the record — the contract set, in one object */
  function recordFieldsFull() {
    return {
      name: val('fName'),
      amount: val('fAmount'),
      owner: val('fOwner'),
      backup: val('fBackup'),
      primary_implementer: val('fImplementer'),
      strategic_priority: val('fPriority'),
      city: val('fCity'),
      classification: val('fClassification'),
      project_type: val('fType'),
      target_date: val('fTarget'),
      description: val('fDescription')
    };
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (!act || act.indexOf('p4c-') !== 0) return;
    var id = t.getAttribute('data-id');
    var after = null;

    if (act === 'p4c-gotocomments') {
      S().ui.p4Tab = 'comments';
      S().ui.err = null;
      after = scrollToComments;

    } else if (act === 'p4c-post') {
      var body = val('p4cBody');
      if (!body && S().ui.p4cDraftFor === id && typeof S().ui.p4cDraft === 'string') {
        body = S().ui.p4cDraft;
      }
      S().ui.p4cDraft = body;
      S().ui.p4cDraftFor = id;
      var res = A.commentAdd(id, body, 'comment');
      if (res.ok) { S().ui.p4cDraft = ''; S().ui.p4cDraftFor = null; }
      after = function () { refocus('p4cBody', true); };

    } else if (act === 'p4c-edit') {
      S().ui.editComment = id;
      S().ui.err = null;
      after = function () { refocus('p4cEdit', true); };

    } else if (act === 'p4c-edit-cancel') {
      S().ui.editComment = null;
      S().ui.err = null;

    } else if (act === 'p4c-edit-save') {
      var r2 = A.commentEdit(id, val('p4cEdit'));
      if (r2.ok) S().ui.editComment = null;
      else after = function () { refocus('p4cEdit', true); };

    } else if (act === 'p4c-save') {
      var r3 = A.projectUpdate(id, recordFieldsFull());
      if (r3.ok) S().ui.p4Edit = false;

    } else if (act === 'p4c-stay') {
      S().ui.returnTo = null;

    } else {
      return;
    }

    ev.preventDefault();
    ev.stopImmediatePropagation();
    CBP.render();
    if (after) after();
  });

  /* the composer and the inline editor keep their text in ui, so any other
     render (a persona switch, a mark-read click) cannot throw a half-written
     message away. Typing itself never triggers a render. */
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-act') === 'p4c-draft') {
      S().ui.p4cDraft = t.value;
      S().ui.p4cDraftFor = S().ui.param;
    }
  });

})();
