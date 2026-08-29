/* pages/p6.js — P6 Approvals inbox at #/approvals.
   One page, four sections, each sorted oldest-first, because to the Regional
   Manager a review and an open external gate are the same job: something is
   waiting and nobody can see how long. Every card deep-links to #/project/<id>;
   every control is gated by CBP.actions.can, so the viewer sees the same
   counters with no buttons at all.

   v1.0.1 — an inbox entry now expands in place (one at a time) onto two
   blocks: the editable gate panel (M1 / area office correct a wrong submitted
   or approved date, day counters re-derive on the spot) and the approval-note
   thread for that project (flat, chronological, own notes editable). After any
   approval action the entry collapses back to the list — the same return-flow
   principle as the record editor, so no depth is ever a dead end. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, A = CBP.actions, P4 = CBP.p4, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};

  /* ---------------------------------------------------------- page state --
     Three keys, all owned by this page and initialised lazily so the store
     never has to know about them: which entry is expanded, the per-project
     composer draft, and which gate field a failed A.gateSet belongs beside. */

  function ensure(state) {
    var u = state.ui;
    if (u.p6Open === undefined) u.p6Open = null;
    if (!u.p6Draft) u.p6Draft = {};
    if (u.p6GateErr === undefined) u.p6GateErr = null;
    return u;
  }

  /* ---------------------------------------------------------- age model -- */

  /* what this row is waiting on, and for how long — the sort key of the page */
  function waiting(p) {
    if (p.status === 4) {
      return { days: D.daysInStage(p), at: 'In development', tone: '' };
    }
    var open = D.openGates(p);
    if (open.length) {
      var g = open.sort(function (a, b) { return b.days - a.days; })[0];
      return { days: g.days, at: 'Gate · ' + g.label, tone: g.overdue ? 'hot' : 'warm' };
    }
    if (A.readyToMark(p)) {
      var k = D.daysInStage(p);
      return { days: k === null ? 0 : k, at: 'Both gates ✓', tone: 'warm' };
    }
    if (A.gateOpen(p)) {
      return { days: D.daysSince(p.gate_opened_at) || 0, at: 'Gate · nothing lodged', tone: 'warm' };
    }
    var w = D.daysInStage(p);
    return {
      days: w === null ? 0 : w, at: 'Process 3 · review',
      tone: (w !== null && w > CBP.CONFIG.REVIEW_THRESHOLD_DAYS) ? 'warm' : ''
    };
  }

  function byAge(a, b) { return (waiting(b).days || 0) - (waiting(a).days || 0); }

  /* ====================================================== notes thread =====
     The thread is the kind='approval_note' slice of the project's comment feed
     — the requester↔approver exchange that belongs to this decision. Ordinary
     project comments stay on P4; the block says so rather than quietly hiding
     them, because the unread count on the row is the whole project's. */

  function notesFor(pid) {
    return D.commentsFor(pid).filter(function (c) { return c.kind === 'approval_note'; });
  }

  function plainFor(pid) {
    return D.commentsFor(pid).filter(function (c) { return c.kind !== 'approval_note'; }).length;
  }

  /* Who may take part: M1, the area office and the M2 requester side — the two
     voices the thread is for. M3 keeps the conversation on the project page and
     the viewer never writes anywhere. One expression, so a persona switch
     shows or hides the composer in the same render pass as everything else. */
  function canNote(user) {
    return D.can(user, 'comment') &&
      (D.can(user, 'review') || D.can(user, 'submit') || D.can(user, 'gate_edit'));
  }

  /* the two voices in an approval thread, derived from the author's role */
  function voice(authorId) {
    var u = CBP.userById(authorId);
    var r = u ? u.role : null;
    return (r === 'm1' || r === 'admin') ? 'ok' : 'ask';
  }

  function voiceMark(v) { return v === 'ok' ? '✓' : '↩'; }
  function voiceName(v) { return v === 'ok' ? 'Approver' : 'Requester'; }

  function noteHtml(c, state) {
    var user = state.user;
    var unread = D.isUnread(user, c);
    var v = voice(c.author);
    var editing = state.ui.editComment === c.id;
    var mine = c.author === user.id && D.can(user, 'comment');

    var meta = '<div class="p6n-nm">' +
      '<b>' + e(CBP.userName(c.author)) + '</b>' +
      '<span class="num">' + e(D.fmtDateY(c.at)) + '</span>' +
      '<span class="num">' + e(c.time || '') + '</span>' +
      '<span class="p6n-voice ' + v + '">' + e(voiceName(v)) + '</span>' +
      (c.edited_at ? '<span class="p6n-ed" title="Edited ' + e(D.fmtDateY(c.edited_at)) +
        ' — notes are stamped, never deleted (D-12)">(edited)</span>' : '') +
      (unread ? '<span class="p6n-new">new</span>' : '') +
      '</div>';

    var body = editing
      ? '<div class="p6n-editbox">' +
          '<textarea id="p6nEdit" class="p4-input" rows="3">' + e(c.body) + '</textarea>' +
          P4.err(state, 'comment') +
          '<div class="p6n-nacts">' +
            P4.btn('Save edit', 'p6n-edit-save', c.id, { brass: true }) +
            P4.btn('Cancel', 'p6n-edit-cancel', c.id) +
          '</div>' +
        '</div>'
      : '<div class="p6n-nt">' + e(c.body) + '</div>' +
        (mine ? '<div class="p6n-nacts">' + P4.btn('Edit', 'p6n-edit', c.id) + '</div>' : '');

    return '<article class="p6n-note' + (unread ? ' new' : '') + '">' +
      '<span class="p6n-ic ' + v + '" aria-hidden="true">' + voiceMark(v) + '</span>' +
      '<div class="p6n-nb">' + meta + body + '</div>' +
      '</article>';
  }

  function composer(p, state) {
    var user = state.user;
    if (!canNote(user)) {
      return '<div class="p6n-comp readonly">' + (D.can(user, 'comment')
        ? 'The approval thread is written by the Regional Manager, the area office and the ' +
          'Area Manager who raised the request. Post on the project page instead — ' +
          'open ' + e(p.id) + ' and use the Activity tab.'
        : 'Read-only role — you can follow the thread and export it, but not post (RD/RM-3).') +
        '</div>';
    }

    var draft = (state.ui.p6Draft && state.ui.p6Draft[p.id]) || '';
    return '<div class="p6n-comp">' +
      '<textarea id="p6nBody" class="p4-input" rows="2" data-pid="' + e(p.id) + '" ' +
        'placeholder="Write a note on this approval — what is holding it, what you need next…">' +
        e(draft) + '</textarea>' +
      (state.ui.editComment ? '' : P4.err(state, 'comment')) +
      '<div class="p6n-crow">' +
        '<span class="p6n-chint">Notes stay with the approval and are never deleted — an edit ' +
        'is stamped “(edited)” (D-12).</span>' +
        '<button class="btn brass sm" data-act="p6n-note" data-id="' + e(p.id) +
        '">Post note</button>' +
      '</div></div>';
  }

  function notesBlock(p, state) {
    var user = state.user;
    var list = notesFor(p.id);
    var unread = D.unreadFor(user, p.id);
    var others = plainFor(p.id);

    var head = '<div class="p6n-h"><h3>Notes<span class="n num">' + list.length + '</span></h3>' +
      (unread && D.can(user, 'comment')
        ? '<button class="btn sm" data-act="comment-readall" data-id="' + e(p.id) + '">' +
          'Mark read</button>'
        : '') +
      '</div>' +
      '<div class="p6n-leg">✓ approver · ↩ requester · newest last</div>';

    var thread = list.length
      ? '<div class="p6n-thread">' +
          list.map(function (c) { return noteHtml(c, state); }).join('') + '</div>'
      : P4.empty('No approval notes on this record yet.');

    var tail = others
      ? '<p class="p4-note">' + others + ' ordinary project comment' + (others === 1 ? '' : 's') +
        ' sit' + (others === 1 ? 's' : '') + ' on the project page — ' +
        '<a href="#/project/' + e(p.id) + '">open ' + e(p.id) + '</a> to read them.</p>'
      : '';

    return head + thread + tail + composer(p, state);
  }

  /* ==================================================== editable gate ======
     A gate date can simply be wrong: a clerk lodges on the 12th and records it
     on the 14th. M1 and the area office correct either date here, or clear it
     with the ×; CORE guards the format, a future date and an approval that
     pre-dates its own request, and the failure lands beside the field that
     caused it. Nothing here touches the reference numbers — those only ever
     arrive through Mark Approved (R-4). */

  var FIELDS = [
    { k: 'submitted_at', label: 'Submitted' },
    { k: 'approved_at',  label: 'Approved' }
  ];

  function gateField(p, state, key, f) {
    var g = (p.gate || {})[key] || {};
    var v = g[f.k] || '';
    var id = 'p6nG-' + key + '-' + f.k;
    var mark = key + '|' + f.k;

    return '<label class="p6n-gf"><span class="p6n-gl">' + e(f.label) + '</span>' +
      '<span class="p6n-gin">' +
        '<input class="p4-input sm num" type="date" id="' + id + '" data-act="p6n-gate" ' +
          'data-id="' + e(p.id) + '" data-sys="' + e(key) + '" data-field="' + e(f.k) + '" ' +
          'max="' + e(CBP.CONFIG.TODAY) + '" value="' + e(v) + '">' +
        (v ? '<button class="p6n-x" data-act="p6n-gate-clear" data-id="' + e(p.id) +
             '" data-sys="' + e(key) + '" data-field="' + e(f.k) + '" ' +
             'title="Clear the ' + e(f.label.toLowerCase()) + ' date">×</button>' : '') +
      '</span>' +
      (state.ui.p6GateErr === mark ? P4.err(state, 'gate_edit') : '') +
      '</label>';
  }

  function gateCounter(g) {
    if (g.state === 'approved') {
      return g.submitted_at && g.approved_at
        ? 'submitted ' + D.fmtDateY(g.submitted_at) + ' → approved ' + D.fmtDateY(g.approved_at) +
          ' · <b class="num">' + D.days(g.days) + '</b>'
        : (g.approved_at ? 'approved ' + D.fmtDateY(g.approved_at) : 'cleared before the demo window');
    }
    if (g.state === 'waiting') {
      return 'submitted ' + D.fmtDateY(g.submitted_at) + ', no approval yet · waiting ' +
        '<b class="num">' + D.days(g.days) + '</b>' +
        (g.overdue ? ' · past the ' + CBP.CONFIG.GATE_THRESHOLD_DAYS + '-day threshold' : '');
    }
    return 'nothing lodged';
  }

  function gatePill(g) {
    var cls = g.state === 'approved' ? 'ok' : (g.state === 'waiting' ? (g.overdue ? 'hot' : 'wait') : 'todo');
    var txt = g.state === 'approved' ? 'approved ✓'
      : (g.state === 'waiting' ? 'waiting <span class="num">' + D.days(g.days) + '</span>'
                               : 'not lodged');
    return '<span class="p6-gp ' + cls + '">' + txt + '</span>';
  }

  function gateBlock(p, state) {
    /* correcting a date only means something once the record is in the approval
       process; a status-4 draft has nothing lodged anywhere to correct */
    var editable = D.can(state.user, 'gate_edit') && p.status === 3;

    var rows = D.gate(p).map(function (g) {
      var fields = editable
        ? '<div class="p6n-gfields">' +
            FIELDS.map(function (f) { return gateField(p, state, g.key, f); }).join('') +
          '</div>'
        : '<div class="p6n-gread">' +
            FIELDS.map(function (f) {
              var v = ((p.gate || {})[g.key] || {})[f.k];
              return '<span><small>' + e(f.label) + '</small><b class="num">' +
                     e(v ? D.fmtDateY(v) : '—') + '</b></span>';
            }).join('') +
          '</div>';

      return '<div class="p6n-gsys' + (g.overdue ? ' hot' : '') + '">' +
        '<div class="p6n-gh"><b>' + e(g.label) + '</b>' + gatePill(g) + '</div>' +
        fields +
        '<div class="p6n-gc">' + gateCounter(g) + '</div>' +
        '</div>';
    }).join('');

    var note = editable
      ? 'Dates only — the reference numbers arrive with Mark Approved (R-4) and are never ' +
        'touched here. Every day count on this page re-derives against ' +
        e(D.fmtDateY(CBP.CONFIG.TODAY)) + ' the moment a date changes.'
      : (p.status === 3
          ? 'Gate dates are corrected by the Regional Manager or the area office (R-2). ' +
            'Everyone else sees the same counters, read-only.'
          : 'The external gate opens when the Regional Manager approves the request — nothing ' +
            'is lodged yet, so there is nothing to correct.');

    return '<div class="p6n-h"><h3>Gate dates</h3></div>' +
      '<div class="p6n-gsysl">' + rows + '</div>' +
      '<p class="p4-note">' + note + '</p>';
  }

  /* ------------------------------------------------------------- a card -- */

  function card(p, state, acts, extra, unread) {
    var w = waiting(p);
    var gate = D.gate(p).map(function (g) {
      var cls = g.state === 'approved' ? 'ok' : (g.state === 'waiting' ? (g.overdue ? 'hot' : 'wait') : 'todo');
      var txt = g.state === 'approved' ? 'approved ✓'
        : (g.state === 'waiting' ? 'waiting ' + D.days(g.days) : 'not lodged');
      return '<span class="p6-gp ' + cls + '">' + e(g.label) + ' · <span class="num">' +
             e(txt) + '</span></span>';
    }).join('');

    return '<article class="p6-card' + (w.tone === 'hot' ? ' hot' : '') + '">' +
      '<div class="p6-who">' +
        '<a class="p6-id num" href="#/project/' + e(p.id) + '">' + e(p.id) + '</a>' +
        (unread ? '<span class="p6n-dot num" title="Unread comments and approval notes on ' +
          'this project">' + unread + ' new</span>' : '') +
        '<b>' + e(p.name) + '</b>' +
        '<div class="p6-meta">' + e(P4.countryName(p.country)) + ' · <span class="num">' +
          D.money(p.amount) + '</span> · owner ' +
          e(p.owner ? CBP.userName(p.owner) : 'unassigned') + '</div>' +
        (A.gateOpen(p) ? '<div class="p6-gates">' + gate + '</div>' : '') +
      '</div>' +
      '<div class="p6-age ' + w.tone + '">' +
        '<span class="v num">' + (w.days === null ? '—' : D.days(w.days)) + '</span>' +
        '<small>' + e(w.at) + '</small>' +
      '</div>' +
      '<div class="p6-acts">' + acts.join('') +
        '<a class="btn sm" href="#/project/' + e(p.id) + '">Open</a>' +
      '</div>' +
      (extra || '') +
      '</article>';
  }

  /* one inbox entry: the card, its own actions, and — when it is the expanded
     one — the gate panel and the note thread underneath */
  function entry(p, state, acts) {
    var isOpen = state.ui.p6Open === p.id;
    var unread = D.unreadFor(state.user, p.id);
    var notes = notesFor(p.id).length;

    var label = isOpen
      ? 'Hide notes and dates'
      : 'Notes and dates' + (notes ? ' · ' + notes : '');

    var all = acts.concat([P4.btn(label, 'p6n-toggle', p.id)]);

    var panel = isOpen
      ? '<div class="p6n-panel">' +
          '<section class="p6n-block">' + gateBlock(p, state) + '</section>' +
          '<section class="p6n-block">' + notesBlock(p, state) + '</section>' +
        '</div>'
      : '';

    return card(p, state, all, panel, unread);
  }

  function section(title, sub, cards, emptyText) {
    return '<section class="p6-sec">' +
      '<div class="p6-sech"><h2>' + e(title) + '<span class="n num">' + cards.length +
      '</span></h2><span class="sub">' + e(sub) + '</span></div>' +
      (cards.length ? cards.join('') : P4.empty(emptyText)) +
      '</section>';
  }

  /* =============================================================== page ===*/

  CBP.pages.approvals = function (state) {
    ensure(state);

    var user = state.user;
    var scoped = D.visibleProjects(user, state.projects, state.countries);
    var codes = D.visibleCountries(user, state.countries);
    var canReview = D.can(user, 'review');
    var canSubmit = D.can(user, 'submit');

    var reviews = scoped.filter(function (p) { return p.status === 3 && !A.gateOpen(p); }).sort(byAge);
    var gates = scoped.filter(function (p) {
      return p.status === 3 && A.gateOpen(p) && !A.bothApproved(p);
    }).sort(byAge);
    var ready = scoped.filter(function (p) { return A.readyToMark(p); }).sort(byAge);
    var mine = scoped.filter(function (p) {
      return p.status === 4 && (p.owner === user.id || p.backup === user.id);
    }).sort(byAge);

    var actionable = (canReview ? reviews.length + gates.length + ready.length : 0) +
                     (canSubmit ? mine.length : 0);

    var scopeName = codes.length === state.countries.length
      ? 'Asia Area' : codes.map(P4.countryName).join(' · ');

    var html = '<div class="crumb">Approvals · ' + e(scopeName) + '</div>' +
      '<div class="pagehead"><h1>Approvals</h1>' +
      '<span class="sub">' + (actionable
        ? actionable + ' item' + (actionable === 1 ? '' : 's') + ' waiting on you · oldest first'
        : 'Nothing is waiting on you right now') + '</span>' +
      '<div class="sp">' + (D.can(user, 'export')
        ? '<button class="btn" data-act="phaseb">Export</button>' : '') + '</div></div>';

    if (!canReview && !canSubmit) {
      html += '<div class="p6-readonly">Approvals are read-only for your role. ' +
        'You can follow every counter below and export them, but no approval action is yours to ' +
        'take (permission matrix · RD/RM-3).</div>';
    }

    /* (a) submissions awaiting review — M1 */
    if (canReview) {
      html += section('Submissions awaiting review',
        'Status 3, nothing lodged with the external systems yet. Request approved opens the gate; ' +
        'Return to Review needs a reason.',
        reviews.map(function (p) {
          return entry(p, state, [
            P4.btn('Request approved', 'ask-approve', p.id, { brass: true }),
            P4.btn('Return to Review', 'ask-return', p.id)
          ]);
        }),
        'No submissions are waiting for your review.');

      /* (b) open gate items */
      html += section('Open gate items',
        'Lodged with Decision Point and CHaS. Each system carries its own submitted → approved ' +
        'counter (D-11); the ' + CBP.CONFIG.GATE_THRESHOLD_DAYS + '-day threshold turns a counter red.',
        gates.map(function (p) {
          return entry(p, state, [P4.btn('Update gate', 'ask-gate', p.id, { brass: true })]);
        }),
        'No external gate is open in your scope.');

      /* (c) ready to mark approved */
      html += section('Ready to Mark Approved',
        'Both systems have recorded an approval and the project is still at status 3 — the A-07 ' +
        'prompt. Both reference numbers are mandatory (R-4).',
        ready.map(function (p) {
          return entry(p, state, [P4.btn('Mark Approved', 'ask-mark', p.id, { brass: true })]);
        }),
        'Nothing is sitting between a cleared gate and status 2.');
    }

    /* (d) M2 — my projects ready to submit */
    if (canSubmit && (mine.length || user.role === 'm2')) {
      html += section('My projects ready to submit',
        'Status 4 records you own. Request submitted completes Process 4 and moves them to ' +
        'status 3 for review (A-01).',
        mine.map(function (p) {
          return entry(p, state, [P4.btn('Request submitted', 'ask-submit', p.id, { brass: true })]);
        }),
        'You own no status-4 project that is ready to submit.');
    }

    /* everyone else sees the same queue, read-only */
    if (!canReview) {
      var elsewhere = scoped.filter(function (p) { return p.status === 3; }).sort(byAge);
      html += section('Waiting on others',
        'Submitted records in your scope, with the same counters the Regional Manager sees.',
        elsewhere.map(function (p) { return entry(p, state, []); }),
        'Nothing in your scope is at status 3.');
    }

    html += '<p class="pagenote">Sorted oldest first. Every day count is derived against ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + ' — a gate counter runs from the date that system ' +
      'recorded the request as submitted, and stops the day it records an approval (D-11). ' +
      'Open an entry to read its approval notes and, where your role allows, correct a gate ' +
      'date. Scope: ' + e(codes.join(', ')) + '.</p>';

    return html + P4.modal(state);
  };

  /* ============================================================= wiring ====
     ONE delegated listener per event, registered once at load — never per
     render. It runs in the CAPTURE phase so it sees a click before the handler
     in actions.js, which stops propagation on everything it owns. Two jobs:

       · the p6n- controls this page renders, and
       · the return flow — any completed approval action collapses the expanded
         entry back to the inbox list, so the page never leaves the user deep
         inside a record with no way out. A failed action still shows its
         message in the modal that raised it. */

  var FINISH = {
    'do-submit': 1, 'do-approve': 1, 'do-return': 1, 'do-reject': 1,
    'do-mark': 1, 'do-start': 1, 'gate-click': 1
  };

  function onP6() {
    return !!(CBP.state && CBP.state.ui && CBP.state.ui.route === 'approvals');
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  /* the search-refocus pattern from app.js: render() replaces the markup the
     event came from, so put the caret back where the typist left it */
  function refocus(id) {
    var el = document.getElementById(id);
    if (!el) return;
    try { el.focus(); } catch (err) { return; }
    try { el.setSelectionRange(el.value.length, el.value.length); } catch (err2) { /* date input */ }
  }

  /* keep whatever is in the composer in state, so a re-render never eats it */
  function keepDraft() {
    var el = document.getElementById('p6nBody');
    if (!el || !el.getAttribute) return;
    var pid = el.getAttribute('data-pid');
    var u = CBP.state.ui;
    if (pid && u.p6Draft) u.p6Draft[pid] = el.value;
  }

  function setGate(t, value) {
    var u = CBP.state.ui;
    var pid = t.getAttribute('data-id');
    var sys = t.getAttribute('data-sys');
    var field = t.getAttribute('data-field');

    u.p6GateErr = null;
    var res = A.gateSet(pid, sys, field, value);
    if (!res.ok) u.p6GateErr = sys + '|' + field;
    CBP.render();
    refocus('p6nG-' + sys + '-' + field);
    return res;
  }

  document.addEventListener('click', function (ev) {
    if (!onP6()) return;
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!t) return;

    var act = t.getAttribute('data-act');
    var u = CBP.state.ui;

    /* an approval action collapses the entry, then runs as it always has */
    if (FINISH[act]) { u.p6Open = null; u.p6GateErr = null; return; }
    if (act.indexOf('p6n-') !== 0) return;
    if (t.tagName === 'INPUT') return;      /* the date field is driven by change */

    ev.preventDefault();
    ev.stopPropagation();

    var id = t.getAttribute('data-id');
    var focusAfter = null;

    if (act === 'p6n-toggle') {
      keepDraft();
      u.p6Open = (u.p6Open === id) ? null : id;
      u.editComment = null;
      u.p6GateErr = null;
      u.err = null;

    } else if (act === 'p6n-note') {
      keepDraft();
      var res = A.commentAdd(id, (u.p6Draft[id] || ''), 'approval_note');
      if (res.ok) u.p6Draft[id] = '';
      else focusAfter = 'p6nBody';

    } else if (act === 'p6n-edit') {
      keepDraft();
      u.editComment = id;
      u.err = null;
      focusAfter = 'p6nEdit';

    } else if (act === 'p6n-edit-cancel') {
      u.editComment = null;
      u.err = null;

    } else if (act === 'p6n-edit-save') {
      var r2 = A.commentEdit(id, val('p6nEdit'));
      if (r2.ok) u.editComment = null;
      else focusAfter = 'p6nEdit';

    } else if (act === 'p6n-gate-clear') {
      setGate(t, null);
      return;                               /* setGate renders and refocuses */

    } else {
      return;
    }

    CBP.render();
    if (focusAfter) refocus(focusAfter);
  }, true);

  /* a date field commits on change — one A.gateSet, one render, counters
     re-derived; clearing the field by hand is the same call with null */
  document.addEventListener('change', function (ev) {
    if (!onP6()) return;
    var t = ev.target;
    if (!t || !t.getAttribute || t.getAttribute('data-act') !== 'p6n-gate') return;
    setGate(t, t.value || null);
  }, true);

  /* the composer text lives in state as it is typed; no render is forced here,
     so nothing has to be refocused */
  document.addEventListener('input', function (ev) {
    if (!onP6()) return;
    var t = ev.target;
    if (!t || t.id !== 'p6nBody' || !t.getAttribute) return;
    var pid = t.getAttribute('data-pid');
    var u = CBP.state.ui;
    if (pid && u.p6Draft) u.p6Draft[pid] = t.value;
  }, true);

})();
