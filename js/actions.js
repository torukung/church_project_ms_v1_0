/* actions.js — CBP.actions, the single mutation layer for the whole app.
   Every page (P3, P4, P6 now; P5/P8/P10 later) routes its writes through here,
   so the permission matrix, the clocks, the typed activity stream and the alert
   outbox can never drift apart.

   Each action: checks can() → mutates state.projects / state.events /
   state.activity → appends a system entry → restarts the clock fields the
   change affects → pushes any alert (05_ALERTS A-01…A-07) into state.outbox →
   calls CBP.render(). Failures return { ok:false, error } and leave a message
   in state.ui.err for the page to render beside the control that failed. */
(function () {
  'use strict';

  var D = CBP.D;
  var A = {};
  CBP.actions = A;

  function S()     { return CBP.state; }
  function me()    { return CBP.state.user; }
  function TODAY() { return CBP.CONFIG.TODAY; }

  function pad4(n) { n = String(n); while (n.length < 4) n = '0' + n; return n; }

  function fail(key, msg) {
    S().ui.err = { key: key, msg: msg };
    return { ok: false, error: msg };
  }

  function done(extra) {
    S().ui.err = null;
    var r = { ok: true };
    if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
    CBP.render();
    return r;
  }

  function countryName(code) {
    var c = S().countries.filter(function (x) { return x.code === code; })[0];
    return c ? c.name : code;
  }

  /* ==================================================== gate + permissions ==
     The external gate has three lives, not two: not opened, opened but nothing
     lodged yet, and lodged. derive.js only knows "has a gate record", so the
     opened-but-empty state is carried by project.gate_opened_at and the
     project-level half of can() is re-stated here. Role permission still comes
     straight from D.can(), so the persona switcher stays the single source. */

  A.gateOpen = function (p) {
    return !!p.gate_opened_at || D.gateStarted(p);
  };

  A.bothApproved = function (p) {
    return D.gate(p).every(function (g) { return g.state === 'approved'; });
  };

  /* A-07 — both gates ✓ but the project is still at status 3 */
  A.readyToMark = function (p) {
    return p.status === 3 && A.gateOpen(p) && A.bothApproved(p);
  };

  A.can = function (user, action, p) {
    var base = action === 'start' ? 'markApproved' : action;
    if (!D.can(user, base)) return false;          /* role + read-only gate */
    if (!p) return true;

    switch (action) {
      case 'submit':       return p.status === 4;
      case 'review':       return p.status === 3 && !A.gateOpen(p);
      case 'gate':         return p.status === 3 && A.gateOpen(p);
      case 'markApproved': return A.readyToMark(p);
      case 'start':        return p.status === 2;
      default:             return D.can(user, action, p);
    }
  };

  /* ============================================================== alerts ===
     Demo "sends" are rows in state.outbox; Phase C renders the outbox panel.
     Every send also writes a System entry naming the recipients — the blueprint
     rule that stops email drifting back into being the real channel. */

  function inScope(u, code) {
    var s = u.role === 'viewer' ? u.view_scope : u.country_scope;
    if (!s || s === 'all') return true;
    return s.indexOf(code) > -1;
  }

  /* kinds: 'owner' ∣ 'backup' ∣ a role key ('m1', 'm2', 'admin') */
  A.recipients = function (p, kinds) {
    var ids = [];
    kinds.forEach(function (k) {
      if (k === 'owner')       { if (p.owner)  ids.push(p.owner); }
      else if (k === 'backup') { if (p.backup) ids.push(p.backup); }
      else S().users.forEach(function (u) {
        if (u.role === k && inScope(u, p.country)) ids.push(u.id);
      });
    });
    var seen = {}, out = [];
    ids.forEach(function (i) { if (i && !seen[i]) { seen[i] = 1; out.push(i); } });
    return out;
  };

  function bodyFor(p, lines) {
    return [p.name + ' — ' + p.id + ' · ' + countryName(p.country) + ' · ' + D.money(p.amount)]
      .concat(lines)
      .concat(['Owner: ' + (p.owner ? CBP.userName(p.owner) : 'unassigned') +
               (p.backup ? ' · backup: ' + CBP.userName(p.backup) : ''),
               'Open the project: #/project/' + p.id])
      .join('\n');
  }

  function send(rule, p, kinds, subject, lines) {
    var ids = A.recipients(p, kinds);
    var names = ids.map(function (i) { return CBP.userName(i); });
    S().outbox.push({
      rule: rule, to: names, to_ids: ids,
      subject: subject, body: bodyFor(p, lines),
      at: TODAY(), project: p.id
    });
    CBP.addLog(p.id, 'system',
      'Alert ' + rule + ' sent to ' + (names.join(', ') || 'no recipient — no owner set') +
      ' — ' + subject);
    return ids;
  }

  /* ===================================================== project records ===*/

  /* WE + budget year (2 digits) + ISO3 + next free 4-digit sequence for that
     country. BGD holds 0002/0003/0005 today, so the next is WE26BGD0006. */
  A.nextProjectId = function (country) {
    var max = 0;
    S().projects.forEach(function (p) {
      if (p.country !== country) return;
      var m = /(\d{4})$/.exec(p.id);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'WE' + String(CBP.CONFIG.BUDGET_YEAR).slice(2) + country + pad4(max + 1);
  };

  A.createProject = function (fields) {
    var u = me();
    if (!A.can(u, 'create')) return fail('create', 'Your role cannot create projects.');

    var f = fields || {};
    var name = (f.name || '').trim();
    var country = f.country || (D.visibleCountries(u, S().countries)[0]);
    var amount = Number(String(f.amount === undefined ? '' : f.amount).replace(/[^0-9.\-]/g, ''));

    if (!name) return fail('create', 'A project name is required.');
    if (!country) return fail('create', 'A country is required.');
    if (D.visibleCountries(u, S().countries).indexOf(country) === -1) {
      return fail('create', 'That country is outside your data scope.');
    }
    if (!isFinite(amount) || amount < 0) return fail('create', 'Enter the requested amount in USD.');

    var p = {
      id: A.nextProjectId(country),
      name: name,
      country: country,
      status: 4,                       /* every new record starts In Development */
      amount: Math.round(amount),
      owner: f.owner || u.id,
      backup: f.backup || null,
      primary_implementer: (f.primary_implementer || '').trim() || null,
      strategic_priority: (f.strategic_priority || '').trim() || null,
      classification: (f.classification || '').trim() || null,
      project_type: (f.project_type || '').trim() || null,
      city: (f.city || '').trim() || null,
      target_date: f.target_date || null,
      created_at: TODAY(),             /* status-4 stage clock starts here */
      watchers: []
    };

    S().projects.push(p);
    CBP.addLog(p.id, 'system',
      CBP.userName(u.id) + ' created the project at status 4 In Development · ' + D.money(p.amount));
    return done({ id: p.id, project: p });
  };

  /* v1.0.1 — the editable set now covers every detail on the record, plus the
     free-text description and the implementation phase dates the timeline
     drags write back. Order matters only for the log line. */
  var EDITABLE = ['name', 'city', 'primary_implementer', 'strategic_priority',
                  'classification', 'project_type', 'target_date', 'owner', 'backup',
                  'description'];

  var ISO = /^\d{4}-\d{2}-\d{2}$/;

  /* A.projectUpdate is the single record-edit action. A.editProject is kept as
     its original name so nothing that already calls it has to change. */
  A.projectUpdate = function (id, fields) {
    var u = me(), p = CBP.projectById(id);
    if (!p) return fail('edit', 'Project ' + id + ' not found.');
    if (!A.can(u, 'edit', p)) {
      return fail('edit', u.role === 'm3'
        ? 'M3 can edit only their own projects while they are at status 4.'
        : 'Your role cannot edit this project.');
    }

    var f = fields || {}, changed = [];

    EDITABLE.forEach(function (k) {
      if (!(k in f)) return;
      var v = typeof f[k] === 'string' ? f[k].trim() : f[k];
      if (v === '') v = null;
      if (v !== null && (k === 'target_date') && !ISO.test(v)) {
        v = String(v);   /* a date input always hands back ISO; anything else is text */
      }
      if ((p[k] || null) === (v || null)) return;
      changed.push(k.replace(/_/g, ' ') + ' → ' + (v === null ? '—' : v));
      p[k] = v;
    });

    if ('amount' in f && f.amount !== '' && f.amount !== null) {
      var amt = Math.round(Number(String(f.amount).replace(/[^0-9.\-]/g, '')));
      if (!isFinite(amt) || amt < 0) return fail('edit', 'Enter the amount in whole USD.');
      if (amt !== p.amount) {
        /* M3 may only touch a draft amount (permission matrix) */
        if (!D.can(u, 'editBudget', p)) {
          return fail('edit', 'Your role can edit the amount only while the project is a draft.');
        }
        changed.push('amount ' + D.money(p.amount) + ' → ' + D.money(amt));
        p.amount = amt;
      }
    }

    /* implementation phase dates — what a timeline balloon drag writes back */
    if ('phases' in f && f.phases) {
      var ph = f.phases;
      var wellFormed = ph.length && ph.every(function (x) {
        return x && x.phase && ISO.test(x.start || '') && ISO.test(x.end || '');
      });
      if (!wellFormed) {
        return fail('edit', 'Every phase needs a name, a start and an end date.');
      }
      if (ph.some(function (x) { return D.daysBetween(x.start, x.end) < 0; })) {
        return fail('edit', 'A phase cannot end before it starts.');
      }
      if (JSON.stringify(ph) !== JSON.stringify(p.phases || [])) {
        var was = (p.phases || []).length;
        p.phases = JSON.parse(JSON.stringify(ph));
        changed.push('timeline ' + (was ? 'phase dates' : 'phases') + ' → ' +
          ph.map(function (x) {
            return x.phase + ' ' + D.fmtDate(x.start) + ' – ' + D.fmtDate(x.end);
          }).join(' · '));
      }
    }

    if (!changed.length) return fail('edit', 'Nothing changed.');

    CBP.addLog(p.id, 'system', CBP.userName(u.id) + ' edited the record — ' + changed.join(' · '));

    /* the return-flow principle: after a record save the page offers the way
       back to the level-1 register rather than leaving the user inside the
       record. A timeline-only change (a dragged balloon) is not a record save
       and must not throw a "Back to projects" bar over the timeline. */
    if (!changed.every(function (c) { return c.indexOf('timeline ') === 0; })) {
      S().ui.returnTo = 'projects';
    }
    return done({ id: p.id, changed: changed });
  };

  A.editProject = A.projectUpdate;

  /* ====================================================== approval flow ====*/

  /* Process 4 · M2 clicks Request submitted → 4 → 3, stage clock restarts */
  A.requestSubmitted = function (id) {
    var u = me(), p = CBP.projectById(id);
    if (!p) return fail('submit', 'Project ' + id + ' not found.');
    if (p.status !== 4) return fail('submit', 'Only a status-4 project can be submitted.');
    if (!A.can(u, 'submit', p)) return fail('submit', 'Only M2 (or M1) can click Request submitted.');

    CBP.setStatus(id, 3, {
      note: CBP.userName(u.id) + ' clicked Request submitted — status 4 → 3. Stage-3 clock started.'
    });
    p.d_in_q_start = p.d_in_q_start || TODAY();
    p.return_reason = null;

    send('A-01', p, ['m1', 'owner'],
      '[Approval] ' + p.id + ' — request submitted for review',
      ['Submitted ' + D.fmtDateY(TODAY()) + ' by ' + CBP.userName(u.id) +
       '. The record is now at status 3 Submitted and waiting on the Regional Manager.']);

    return done({ id: id });
  };

  /* Process 3 · M1 Request approved → opens the external gate (still status 3) */
  A.requestApproved = function (id, remark) {
    var u = me(), p = CBP.projectById(id);
    if (!p) return fail('review', 'Project ' + id + ' not found.');
    if (!A.can(u, 'review', p)) {
      return fail('review', 'Only the Regional Manager can approve a request for the gate.');
    }

    p.gate_opened_at = TODAY();
    p.gate = p.gate || {};
    p.review_days = D.daysInStage(p);
    CBP.addLog(id, 'system',
      CBP.userName(u.id) + ' clicked Request approved (Process 3)' +
      (p.review_days !== null ? ' after ' + D.days(p.review_days) + ' in review' : '') +
      '. External gate opened — Decision Point and CHaS now tracked.' +
      (remark ? ' Remark: ' + remark : ''));

    send('A-02', p, ['m2', 'owner'],
      '[Gate open] ' + p.id + ' — lodge in Decision Point and CHaS',
      ['Approved for the external gate on ' + D.fmtDateY(TODAY()) + ' by ' + CBP.userName(u.id) + '.',
       'Please lodge the request in Decision Point and in CHaS; each system is tracked ' +
       'separately with its own day counter until it records an approval.']);

    return done({ id: id });
  };

  /* Process 3 · Return to Review → 3 → 4. Reason is mandatory (A-03). */
  A.returnToReview = function (id, reason) {
    var u = me(), p = CBP.projectById(id);
    if (!p) return fail('return', 'Project ' + id + ' not found.');
    if (!A.can(u, 'review', p)) {
      return fail('return', 'Only the Regional Manager can return a submission.');
    }
    reason = (reason || '').trim();
    if (!reason) return fail('return', 'A reason is required before a project can be returned.');

    CBP.setStatus(id, 4, {
      reason: reason,
      note: CBP.userName(u.id) + ' returned the request to review — status 3 → 4. Reason: ' + reason
    });
    p.created_at = TODAY();          /* status-4 stage clock restarts */
    p.submitted_at = null;
    p.gate_opened_at = null;

    send('A-03', p, ['m2', 'owner'],
      '[Returned] ' + p.id + ' — returned to review',
      ['Returned on ' + D.fmtDateY(TODAY()) + ' by ' + CBP.userName(u.id) + '.',
       'Reason: ' + reason,
       'The record is back at status 4 In Development. Resubmit with Request submitted once ' +
       'the point above is addressed.']);

    return done({ id: id });
  };

  /* Process 3 · Reject → Declined. R-3: a declined project comes back under a
     new ID, it is never revived in place. */
  A.reject = function (id, reason) {
    var u = me(), p = CBP.projectById(id);
    if (!p) return fail('reject', 'Project ' + id + ' not found.');
    if (!A.can(u, 'review', p)) return fail('reject', 'Only the Regional Manager can reject.');
    reason = (reason || '').trim();
    if (!reason) return fail('reject', 'A reason is required before a project can be rejected.');

    CBP.setStatus(id, 'declined', {
      reason: reason,
      note: CBP.userName(u.id) + ' rejected the request — status 3 → Declined. Reason: ' + reason
    });
    p.decline_reason = reason;
    p.gate_opened_at = null;

    send('A-04', p, ['m2', 'owner', 'm1'],
      '[Declined] ' + p.id + ' — request declined',
      ['Declined on ' + D.fmtDateY(TODAY()) + ' by ' + CBP.userName(u.id) + '.',
       'Reason: ' + reason,
       'A declined project is not reopened: a replacement is created under a new ID (R-3).']);

    return done({ id: id });
  };

  /* ------------------------------------------- C-15 external gate (R-2) ---*/

  /* One click-done action: system = decision_point ∣ chas, step = submitted ∣
     approved. M1 only. Each click starts (or stops) that sub-step's counter. */
  A.gateClick = function (id, system, step, remark) {
    var u = me(), p = CBP.projectById(id);
    if (!p) return fail('gate', 'Project ' + id + ' not found.');
    if (!D.can(u, 'gate')) {
      return fail('gate', 'Gate clicks are recorded by the Regional Manager only (R-2).');
    }
    if (p.status !== 3) return fail('gate', 'The gate is tracked only while the project is at status 3.');
    if (!A.gateOpen(p)) return fail('gate', 'Click Request approved first — the gate is not open yet.');

    var sys = CBP.CONFIG.GATE_SYSTEMS.filter(function (s) { return s.key === system; })[0];
    if (!sys) return fail('gate', 'Unknown external system.');
    if (step !== 'submitted' && step !== 'approved') return fail('gate', 'Unknown gate step.');

    p.gate = p.gate || {};
    var g = p.gate[system] = p.gate[system] || {};

    if (step === 'approved' && !g.submitted_at) {
      return fail('gate', 'Record the request as submitted to ' + sys.label + ' first.');
    }
    if (g[step === 'approved' ? 'approved_at' : 'submitted_at']) {
      return fail('gate', sys.label + ' is already marked ' + step + '.');
    }

    remark = (remark || '').trim();
    CBP.recordGate(id, system, step, remark || null);

    var waited = (step === 'approved' && g.submitted_at)
      ? D.daysBetween(g.submitted_at, TODAY()) : null;

    send('A-05', p, ['owner', 'm2'],
      '[Gate] ' + p.id + ' — ' + sys.label + ' request ' + step,
      [sys.label + ' recorded as ' + step + ' on ' + D.fmtDateY(TODAY()) + ' by ' +
       CBP.userName(u.id) + '.' + (waited !== null ? ' That sub-step took ' + D.days(waited) + '.' : ''),
       remark ? 'Remark: ' + remark : 'No remark recorded.']);

    /* A-07 — both systems cleared while the project is still at status 3 */
    if (A.readyToMark(p) && !p.ready_to_mark) {
      p.ready_to_mark = true;
      send('A-07', p, ['m1'],
        '[Action needed] ' + p.id + ' — both gates approved, still at status 3',
        ['Decision Point and CHaS have both recorded an approval.',
         'Mark Approved (3 → 2) with both reference numbers to move the project on.']);
    }

    return done({ id: id, system: system, step: step });
  };

  /* Manual 3 → 2. Both reference numbers are mandatory free text (R-4). */
  A.markApproved = function (id, refDP, refCHaS) {
    var u = me(), p = CBP.projectById(id);
    if (!p) return fail('mark', 'Project ' + id + ' not found.');
    if (!D.can(u, 'markApproved')) return fail('mark', 'Only the Regional Manager can mark a project approved.');
    if (p.status !== 3) return fail('mark', 'Only a status-3 project can be marked approved.');
    if (!A.readyToMark(p)) {
      return fail('mark', 'Both external systems must show approved before the project can be marked approved.');
    }

    refDP = (refDP || '').trim();
    refCHaS = (refCHaS || '').trim();
    var missing = [];
    if (!refDP) missing.push('Decision Point');
    if (!refCHaS) missing.push('CHaS');
    if (missing.length) {
      return fail('mark', 'Both reference numbers are required (R-4) — missing: ' +
                  missing.join(' and ') + '.');
    }

    CBP.setStatus(id, 2, {
      refs: { decision_point: refDP, chas: refCHaS },
      note: CBP.userName(u.id) + ' marked the project approved — status 3 → 2. ' +
            'References: Decision Point ' + refDP + ' · CHaS ' + refCHaS + '.'
    });
    p.ready_to_mark = false;

    /* docs/05 has no dedicated rule for the manual 3 → 2: this event is what
       resolves the A-07 prompt, so it carries a neutral system id rather than
       borrowing an id the catalogue already spends on something else. */
    send('SYS-approved', p, ['m2', 'owner'],
      '[Approved] ' + p.id + ' — marked approved, status 2',
      ['Marked approved on ' + D.fmtDateY(TODAY()) + ' by ' + CBP.userName(u.id) + '.',
       'Decision Point reference: ' + refDP,
       'CHaS reference: ' + refCHaS,
       'Implementation progress starts once the project moves to status 1.']);

    return done({ id: id });
  };

  /* 2 → 1 when implementation starts */
  A.startImplementation = function (id) {
    var u = me(), p = CBP.projectById(id);
    if (!p) return fail('start', 'Project ' + id + ' not found.');
    if (!A.can(u, 'start', p)) {
      return fail('start', 'Only the Regional Manager moves an approved project into implementation.');
    }

    CBP.setStatus(id, 1, {
      note: CBP.userName(u.id) + ' started implementation — status 2 → 1.'
    });

    /* likewise 2 → 1: A-05 is the gate-update rule and A-11 is project closure,
       so implementation start gets its own neutral system id. */
    send('SYS-implementation', p, ['owner', 'm2'],
      '[Implementation] ' + p.id + ' — implementation started',
      ['Implementation started ' + D.fmtDateY(TODAY()) + '. Progress now reports against the ' +
       'implementation phases on the timeline.']);

    return done({ id: id });
  };

  /* ============================================ §7 conversation entries ====*/

  A.postEntry = function (project, fields) {
    var u = me();
    var id = (project && project.id) ? project.id : project;
    var p = CBP.projectById(id);
    if (!p) return fail('post', 'Project ' + id + ' not found.');
    if (!D.can(u, 'post', p)) return fail('post', 'Your role is read-only on this project.');

    var f = fields || {};
    var type = f.type || 'note';
    var body = (f.body || '').trim();
    if (['note', 'question', 'decision'].indexOf(type) === -1) {
      return fail('post', 'Pick note, question or decision.');
    }
    if (!body) return fail('post', 'Write something before posting.');

    var parent = f.parent || null;
    if (parent) {
      var par = CBP.entryById(parent);
      if (!par) return fail('post', 'The entry being replied to no longer exists.');
      if (par.parent) parent = par.parent;      /* replies stay one level deep */
    }

    var assigned = f.assigned_to || null;
    if (type === 'question' && !parent && !assigned) {
      return fail('post', 'A question must name an assignee.');
    }

    var entry = {
      id: 'E' + (++S().entrySeq),
      project: id, project_id: id,
      type: type, body: body,
      author: u.id, at: TODAY(),
      assigned_to: type === 'question' ? assigned : null,
      resolved_at: null, resolved_by: null,
      pinned: false, parent: parent
    };
    S().activity.push(entry);

    if (type === 'question' && assigned) {
      /* A-12 — question assigned to you */
      S().outbox.push({
        rule: 'A-12', to: [CBP.userName(assigned)], to_ids: [assigned],
        subject: '[Question] ' + p.id + ' — ' + CBP.userName(u.id) + ' asked you a question',
        body: bodyFor(p, [body]), at: TODAY(), project: p.id
      });
      CBP.addLog(p.id, 'system',
        'Alert A-12 sent to ' + CBP.userName(assigned) + ' — question assigned.');
    }

    S().ui.draft = null;
    S().ui.replyTo = null;
    return done({ entry: entry });
  };

  A.resolveQuestion = function (entryId) {
    var u = me(), en = CBP.entryById(entryId);
    if (!en) return fail('resolve', 'Entry not found.');
    if (en.type !== 'question') return fail('resolve', 'Only a question can be resolved.');
    if (en.resolved_at) return fail('resolve', 'That question is already resolved.');

    var mayResolve = !u.read_only &&
      (en.assigned_to === u.id || u.role === 'm1' || u.role === 'admin' || en.author === u.id);
    if (!mayResolve) {
      return fail('resolve', 'Only the assignee, the person who asked, or M1 and above can resolve.');
    }

    en.resolved_at = TODAY();
    en.resolved_by = u.id;
    CBP.addLog(en.project || en.project_id, 'system',
      CBP.userName(u.id) + ' resolved the question raised by ' + CBP.userName(en.author) + '.');
    return done({ entry: en });
  };

  /* C-10 — one active pin per project; pinning archives the previous one. */
  A.pinDecision = function (entryId) {
    var u = me(), en = CBP.entryById(entryId);
    if (!en) return fail('pin', 'Entry not found.');
    if (en.type !== 'decision') return fail('pin', 'Only a decision can be pinned to the header.');
    var pid = en.project || en.project_id;
    var p = CBP.projectById(pid);
    if (!D.can(u, 'pinDecision', p)) {
      return fail('pin', 'M3 and viewers cannot pin a decision to the project header.');
    }
    if (en.pinned) return fail('pin', 'That decision is already pinned.');

    var archived = 0;
    S().activity.forEach(function (x) {
      if ((x.project || x.project_id) === pid && x.pinned && x.id !== en.id) {
        x.pinned = false;
        x.archived_pin_at = TODAY();
        archived++;
      }
    });
    en.pinned = true;
    en.pinned_by = u.id;
    en.pinned_at = TODAY();

    CBP.addLog(pid, 'system', CBP.userName(u.id) + ' pinned a decision to the project header' +
      (archived ? ' — the previous pin was archived.' : '.'));
    return done({ entry: en, archived: archived });
  };

  A.unpinDecision = function (entryId) {
    var u = me(), en = CBP.entryById(entryId);
    if (!en || !en.pinned) return fail('pin', 'That decision is not pinned.');
    var pid = en.project || en.project_id;
    if (!D.can(u, 'pinDecision', CBP.projectById(pid))) {
      return fail('pin', 'Your role cannot change the pinned decision.');
    }
    en.pinned = false;
    en.archived_pin_at = TODAY();
    CBP.addLog(pid, 'system', CBP.userName(u.id) + ' archived the pinned decision.');
    return done({ entry: en });
  };

  /* D-12 — entries are editable with an edited-by/at stamp, never deleted. */
  A.editEntry = function (entryId, body) {
    var u = me(), en = CBP.entryById(entryId);
    if (!en) return fail('editEntry', 'Entry not found.');
    if (en.type === 'system') return fail('editEntry', 'System entries are immutable.');
    if (en.author !== u.id && u.role !== 'admin') {
      return fail('editEntry', 'Only the author (or an administrator) can edit an entry.');
    }
    body = (body || '').trim();
    if (!body) return fail('editEntry', 'An entry cannot be emptied — entries are never deleted (D-12).');
    if (body === en.body) return fail('editEntry', 'Nothing changed.');

    en.body = body;
    en.edited_by = u.id;
    en.edited_at = TODAY();
    S().ui.editEntry = null;
    return done({ entry: en });
  };

  /* ============================================== v1.0.1 · comments ========
     Comments are the conversation layer: a flat per-project feed that the
     Messages & Alerts hub reads across every project in scope. They are a
     SEPARATE array from state.activity — the audit stream stays the audit
     stream, and nothing here writes a system log line for an ordinary remark.

     Every clock is deterministic: the demo must replay identically, so a new
     comment takes TODAY plus a time derived from its own sequence number
     rather than anything that reads the wall clock. */

  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  A.commentClock = function (n) {
    var h = 9 + (Math.floor((n - 1) / 6) % 9);   /* 09:00 … 17:50, then wraps */
    var m = ((n - 1) % 6) * 10;
    return pad2(h) + ':' + pad2(m);
  };

  function VIEWER_MSG() {
    return 'The viewer account is read-only — every other role can take part in the conversation.';
  }

  A.commentAdd = function (pid, body, kind) {
    var u = me();
    var id = (pid && pid.id) ? pid.id : pid;
    var p = CBP.projectById(id);
    if (!p) return fail('comment', 'Project ' + id + ' not found.');
    if (!D.can(u, 'comment', p)) return fail('comment', VIEWER_MSG());
    if (!inScope(u, p.country)) return fail('comment', 'That project is outside your data scope.');

    kind = kind || 'comment';
    if (['comment', 'approval_note'].indexOf(kind) === -1) {
      return fail('comment', 'An entry is either a comment or an approval note.');
    }
    body = (body || '').trim();
    if (!body) return fail('comment', 'Write something before posting.');

    var n = ++S().commentSeq;
    var c = {
      id: 'C' + n, project_id: id,
      author: u.id, at: TODAY(), time: A.commentClock(n),
      body: body, kind: kind, edited_at: null, priority: false
    };
    S().comments.push(c);

    /* you have read what you just wrote */
    S().readBy[c.id] = {};
    S().readBy[c.id][u.id] = true;

    return done({ comment: c, id: c.id });
  };

  /* D-12 in the conversation layer: edits are stamped, never deleted, and only
     the author can make them. */
  A.commentEdit = function (cid, body) {
    var u = me(), c = CBP.commentById(cid);
    if (!c) return fail('comment', 'Comment not found.');
    if (!D.can(u, 'comment')) return fail('comment', VIEWER_MSG());
    if (c.author !== u.id) return fail('comment', 'Only the author can edit a comment.');
    body = (body || '').trim();
    if (!body) return fail('comment', 'A comment cannot be emptied — comments are never deleted.');
    if (body === c.body) return fail('comment', 'Nothing changed.');

    c.body = body;
    c.edited_at = TODAY();
    return done({ comment: c });
  };

  /* per-user read state. `read` omitted = toggle. */
  A.commentRead = function (cid, read) {
    var u = me(), c = CBP.commentById(cid);
    if (!c) return fail('comment', 'Comment not found.');
    if (!D.can(u, 'comment')) return fail('comment', VIEWER_MSG());
    if (c.author === u.id) return done({ id: cid, read: true });   /* own words: always read */

    if (read === undefined || read === null) read = D.isUnread(u, c);
    var marks = S().readBy[cid] = S().readBy[cid] || {};
    if (read) marks[u.id] = true; else delete marks[u.id];
    return done({ id: cid, read: !!read });
  };

  /* pid = one project, or null for everything in the user's scope */
  A.commentReadAll = function (pid) {
    var u = me();
    if (!D.can(u, 'comment')) return fail('comment', VIEWER_MSG());

    var list;
    if (pid) {
      var p = CBP.projectById(pid);
      if (!p) return fail('comment', 'Project ' + pid + ' not found.');
      if (!inScope(u, p.country)) return fail('comment', 'That project is outside your data scope.');
      list = D.commentsFor(pid);
    } else {
      list = D.commentsVisible(u);
    }

    var n = 0;
    list.forEach(function (c) {
      if (!D.isUnread(u, c)) return;
      (S().readBy[c.id] = S().readBy[c.id] || {})[u.id] = true;
      n++;
    });
    if (!n) return fail('comment', 'Nothing here is unread.');
    return done({ marked: n });
  };

  /* the hub's priority flag — sorts a row to the top of its group */
  A.commentPriority = function (cid) {
    var u = me(), c = CBP.commentById(cid);
    if (!c) return fail('comment', 'Comment not found.');
    if (!D.can(u, 'comment')) return fail('comment', VIEWER_MSG());
    c.priority = !c.priority;
    return done({ id: cid, priority: c.priority });
  };

  /* the hub's pinned rail — a plain toggle on a list of project ids */
  A.pinProject = function (pid) {
    var u = me(), p = CBP.projectById(pid);
    if (!p) return fail('pinProject', 'Project ' + pid + ' not found.');
    if (!D.can(u, 'comment')) return fail('pinProject', VIEWER_MSG());
    if (!inScope(u, p.country)) return fail('pinProject', 'That project is outside your data scope.');

    var list = S().pinnedProjects;
    var i = list.indexOf(pid);
    if (i > -1) list.splice(i, 1); else list.push(pid);
    return done({ id: pid, pinned: i === -1 });
  };

  /* ============================================ v1.0.1 · editable gate =====
     A gate date can be wrong: a clerk lodges on the 12th and records it on the
     14th. M1 and the area office may correct either date, or clear it. The
     reference numbers are NOT touched here — those only ever arrive through
     Mark Approved (R-4). */

  A.gateSet = function (pid, system, field, value) {
    var u = me(), p = CBP.projectById(pid);
    if (!p) return fail('gate_edit', 'Project ' + pid + ' not found.');
    if (!D.can(u, 'gate_edit')) {
      return fail('gate_edit', 'Gate dates are corrected by the Regional Manager or the area office.');
    }
    var sys = CBP.CONFIG.GATE_SYSTEMS.filter(function (s) { return s.key === system; })[0];
    if (!sys) return fail('gate_edit', 'Unknown external system.');
    if (field !== 'submitted_at' && field !== 'approved_at') {
      return fail('gate_edit', 'Only the submitted and the approved date are editable.');
    }

    if (value === '' || value === undefined) value = null;
    if (value !== null) {
      if (!ISO.test(String(value))) return fail('gate_edit', 'Enter the date as YYYY-MM-DD.');
      if (D.daysSince(value) < 0) return fail('gate_edit', 'A gate date cannot be in the future.');
    }

    p.gate = p.gate || {};
    var g = p.gate[system] = p.gate[system] || {};
    if ((g[field] || null) === value) return fail('gate_edit', 'Nothing changed.');

    var sub = field === 'submitted_at' ? value : (g.submitted_at || null);
    var app = field === 'approved_at'  ? value : (g.approved_at || null);
    if (app && !sub) {
      return fail('gate_edit', 'Record the submitted date first — an approval cannot pre-date its own request.');
    }
    if (app && sub && D.daysBetween(sub, app) < 0) {
      return fail('gate_edit', 'The approved date cannot be earlier than the submitted date.');
    }

    g[field] = value;
    CBP.addLog(p.id, 'system', CBP.userName(u.id) + ' edited the ' + sys.label + ' gate — ' +
      field.replace(/_/g, ' ') + ' → ' + (value === null ? 'cleared' : value));
    return done({ id: p.id, system: system, field: field, value: value });
  };

  /* ========================================= v1.0.1 · dashboard layout =====
     A board is { id, name, widgets:[id], layout:{ id:{w,order} } }. Edit mode
     works on a deep copy in ui.dashDraft so Cancel restores exactly what was
     there; Save copies the draft back over the board. Creation is NOT here —
     it lives on the Administration page (A.dashCreate). */

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function editingDraft(dashId) {
    var ui = S().ui;
    return (ui.dashEdit === dashId && ui.dashDraft) ? ui.dashDraft : null;
  }

  /* the object an edit writes to: the draft while this board is being edited,
     otherwise the board itself */
  function boardTarget(dashId) {
    return editingDraft(dashId) || CBP.dashboardById(dashId);
  }

  function widgetSpan(wid) {
    var w = (CBP.W && CBP.W.byId) ? CBP.W.byId(wid) : null;
    return (w && !w.bare && w.size !== 'full') ? 1 : 3;
  }

  /* every widget on the board has a layout entry, numbered in board order */
  function renumber(b) {
    b.layout = b.layout || {};
    (b.widgets || []).forEach(function (id, i) {
      var cell = b.layout[id] || { w: widgetSpan(id) };
      cell.order = i + 1;
      if ([1, 2, 3].indexOf(cell.w) === -1) cell.w = widgetSpan(id);
      b.layout[id] = cell;
    });
    Object.keys(b.layout).forEach(function (id) {
      if ((b.widgets || []).indexOf(id) === -1) delete b.layout[id];
    });
    return b;
  }
  A.dashRenumber = renumber;

  A.dashEditStart = function (dashId) {
    var u = me(), b = CBP.dashboardById(dashId);
    if (!b) return fail('dash', 'Dashboard not found.');
    if (!D.can(u, 'edit')) return fail('dash', 'The viewer account cannot change a dashboard.');
    S().ui.dashEdit = dashId;
    S().ui.dashDraft = renumber({
      id: b.id, widgets: (b.widgets || []).slice(), layout: clone(b.layout || {})
    });
    return done({ id: dashId });
  };

  A.dashEditCancel = function () {
    S().ui.dashEdit = false;
    S().ui.dashDraft = null;
    return done({});
  };

  A.dashEditSave = function () {
    var d = S().ui.dashDraft;
    if (!d) return fail('dash', 'Nothing is being edited.');
    var b = CBP.dashboardById(d.id);
    if (!b) return fail('dash', 'Dashboard not found.');
    renumber(d);
    b.widgets = d.widgets.slice();
    b.layout = clone(d.layout);
    S().ui.dashEdit = false;
    S().ui.dashDraft = null;
    CBP.notice('Layout saved for “' + b.name + '” — ' + b.widgets.length +
               ' widget' + (b.widgets.length === 1 ? '' : 's') + ' in this order.');
    return done({ id: b.id });
  };

  /* dir: -1 / 'left' / 'up' move earlier, +1 / 'right' / 'down' move later */
  A.dashMove = function (dashId, wid, dir) {
    var u = me(), b = boardTarget(dashId);
    if (!b) return fail('dash', 'Dashboard not found.');
    if (!D.can(u, 'edit')) return fail('dash', 'The viewer account cannot change a dashboard.');

    var step = (dir === -1 || dir === '-1' || dir === 'left' || dir === 'up') ? -1
             : (dir === 1 || dir === '1' || dir === '+1' || dir === 'right' || dir === 'down') ? 1
             : (typeof dir === 'number' && dir < 0) ? -1 : 1;

    var i = b.widgets.indexOf(wid);
    if (i === -1) return fail('dash', 'That widget is not on this dashboard.');
    var j = i + step;
    if (j < 0 || j >= b.widgets.length) return fail('dash', 'That widget is already at the end.');

    b.widgets[i] = b.widgets[j];
    b.widgets[j] = wid;
    renumber(b);
    return done({ id: dashId, widget: wid, from: i + 1, to: j + 1 });
  };

  A.dashResize = function (dashId, wid, w) {
    var u = me(), b = boardTarget(dashId);
    if (!b) return fail('dash', 'Dashboard not found.');
    if (!D.can(u, 'edit')) return fail('dash', 'The viewer account cannot change a dashboard.');
    if (b.widgets.indexOf(wid) === -1) return fail('dash', 'That widget is not on this dashboard.');

    w = Math.round(Number(w));
    if (!isFinite(w) || w < 1 || w > 3) return fail('dash', 'A widget spans 1, 2 or 3 columns.');
    renumber(b);
    b.layout[wid].w = w;
    return done({ id: dashId, widget: wid, w: w });
  };

  A.dashAddWidget = function (dashId, wid) {
    var u = me(), b = boardTarget(dashId);
    if (!b) return fail('dash', 'Dashboard not found.');
    if (!D.can(u, 'edit')) return fail('dash', 'The viewer account cannot change a dashboard.');
    if (CBP.W && CBP.W.byId && !CBP.W.byId(wid)) {
      return fail('dash', 'That widget is not in the catalogue.');
    }
    if (b.widgets.indexOf(wid) > -1) return fail('dash', 'That widget is already on this dashboard.');

    b.widgets.push(wid);
    renumber(b);
    return done({ id: dashId, widget: wid });
  };

  A.dashRemoveWidget = function (dashId, wid) {
    var u = me(), b = boardTarget(dashId);
    if (!b) return fail('dash', 'Dashboard not found.');
    if (!D.can(u, 'edit')) return fail('dash', 'The viewer account cannot change a dashboard.');
    var i = b.widgets.indexOf(wid);
    if (i === -1) return fail('dash', 'That widget is not on this dashboard.');

    b.widgets.splice(i, 1);
    renumber(b);
    return done({ id: dashId, widget: wid });
  };

  /* ToR 29 Aug — boards are created by the area office on P9, not on P2 */
  A.dashCreate = function (name) {
    var u = me();
    if (!D.can(u, 'manageUsers')) {
      return fail('dashCreate', 'Dashboards are created by the area office in Administration.');
    }
    name = (name || '').trim();
    if (!name) return fail('dashCreate', 'Give the dashboard a name.');
    if (S().dashboards.some(function (b) {
      return b.name.toLowerCase() === name.toLowerCase();
    })) return fail('dashCreate', 'A dashboard with that name already exists.');

    var base = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'board';
    var id = base, n = 1;
    while (CBP.dashboardById(id)) { n++; id = base + n; }

    var board = { id: id, name: name, widgets: [], layout: {}, custom: true };
    S().dashboards.push(board);
    CBP.notice('Dashboard “' + name + '” created. Add widgets from the catalogue below, ' +
               'or open it on the Dashboard page and use Edit layout.');
    return done({ id: id, dashboard: board });
  };

  /* ============================================ v1.0.1 · 2027 planning =====*/

  A.planSet = function (code, value) {
    var u = me();
    if (!D.can(u, 'plan')) return fail('plan', 'Planning figures are set by M1, M2 or the area office.');
    var c = S().countries.filter(function (x) { return x.code === code; })[0];
    if (!c) return fail('plan', 'Unknown country.');
    if (!inScope(u, code)) return fail('plan', 'That country is outside your data scope.');

    /* a plan cell is typed by hand, so an entry with no digits in it must not
       fall through to zero — that would silently wipe a country's plan */
    var raw = String(value === undefined || value === null ? '' : value);
    var v = Math.round(Number(raw.replace(/[^0-9.\-]/g, '')));
    if (!/\d/.test(raw) || !isFinite(v) || v < 0) {
      return fail('plan', 'Enter the 2027 plan in whole USD.');
    }

    var was = S().plan2027[code];
    if (was === v) return fail('plan', 'Nothing changed.');
    S().plan2027[code] = v;
    CBP.notice('2027 plan for ' + c.name + ': ' + D.money(was) + ' → ' + D.money(v) +
               ' (' + D.pct(D.utilisation(v, c.ceiling)) + ' of the ceiling). ' +
               'Nothing else is stored — the forecast recomputes from here.');
    return done({ code: code, value: v, was: was });
  };

  /* ========================================= v1.0.1 · dashboard sync =======
     P7 pushes the year-comparison widget onto the Budget Utilisation board so
     the budget page and the dashboard tell the same story. The widget itself
     is registered in widgets.js; this only puts it on a board. */

  A.syncDashboards = function () {
    var u = me();
    if (!D.can(u, 'edit')) return fail('sync', 'The viewer account cannot change a dashboard.');
    var b = CBP.dashboardById('budgetutil');
    if (!b) return fail('sync', 'The Budget Utilisation dashboard is not part of this demo set.');

    var added = (b.widgets || []).indexOf('yearcompare') === -1;
    if (added) b.widgets.push('yearcompare');
    renumber(b);
    b.layout.yearcompare.w = 3;
    S().dashSyncedAt = TODAY();

    CBP.notice(added
      ? 'Synced ' + D.fmtDateY(TODAY()) + ' — “Budget years 2024–2027” added to the Budget ' +
        'Utilisation dashboard. It reads the same history and 2027 plan as this page.'
      : 'Synced ' + D.fmtDateY(TODAY()) + ' — the Budget Utilisation dashboard already carries ' +
        '“Budget years 2024–2027”; its figures were re-read from the current plan.');
    return done({ added: added, at: TODAY() });
  };

  /* ======================================================== controller =====
     One delegated click handler for every P4 / P6 control. It is registered
     before app.js's handler (script order), so anything handled here is
     stopped before the Phase A "wired in phase B" notice can fire. */

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function remarkFor(system) {
    var el = document.querySelector('[data-remark-for="' + system + '"]');
    return el ? el.value : '';
  }

  /* keep whatever is typed in an open modal across the re-render */
  function keepModalValues() {
    var m = S().ui.modal;
    if (!m) return;
    m.values = m.values || {};
    ['mReason', 'mRemark', 'mRefDP', 'mRefCH', 'mDesc'].forEach(function (k) {
      var el = document.getElementById(k);
      if (el) m.values[k] = el.value;
    });
  }

  function openModal(kind, id) {
    S().ui.modal = { kind: kind, id: id, values: {} };
    S().ui.err = null;
  }

  function closeModal() {
    S().ui.modal = null;
    S().ui.err = null;
  }

  /* collect the record form (create + edit share the field ids) */
  function recordFields() {
    return {
      name: val('fName'),
      country: val('fCountry'),
      amount: val('fAmount'),
      primary_implementer: val('fImplementer'),
      strategic_priority: val('fPriority'),
      city: val('fCity'),
      target_date: val('fTarget'),
      owner: val('fOwner'),
      backup: val('fBackup')
    };
  }

  function draft() {
    var ui = S().ui;
    ui.draft = ui.draft || { type: 'note', body: '', assigned_to: '' };
    return ui.draft;
  }

  function keepDraft() {
    var el = document.getElementById('actBody');
    if (el) draft().body = el.value;
    var as = document.getElementById('actAssignee');
    if (as) draft().assigned_to = as.value;
  }

  var HANDLERS = {

    /* ---------------------------------------------------------- P4 tabs -- */
    'p4tab': function (t) {
      keepDraft();
      S().ui.p4Tab = t.getAttribute('data-tab');
      S().ui.err = null;
      return true;
    },
    'actfilter': function (t) {
      keepDraft();
      S().ui.actFilter = t.getAttribute('data-f');
      return true;
    },

    /* ------------------------------------------------------- C-11 post --- */
    'draft-type': function (t) {
      keepDraft();
      draft().type = t.getAttribute('data-t');
      S().ui.err = null;
      return true;
    },
    'post-entry': function (t) {
      keepDraft();
      var d = draft();
      A.postEntry(t.getAttribute('data-id'), {
        type: d.type, body: d.body, assigned_to: d.assigned_to
      });
      return true;
    },
    'reply-open': function (t) {
      keepDraft();
      S().ui.replyTo = t.getAttribute('data-id');
      S().ui.err = null;
      return true;
    },
    'reply-cancel': function () { S().ui.replyTo = null; S().ui.err = null; return true; },
    'reply-post': function (t) {
      var parent = t.getAttribute('data-id');
      A.postEntry(t.getAttribute('data-project'), {
        type: 'note', body: val('replyBody'), parent: parent
      });
      return true;
    },
    'resolve': function (t) { A.resolveQuestion(t.getAttribute('data-id')); return true; },
    'pin': function (t) { A.pinDecision(t.getAttribute('data-id')); return true; },
    'unpin': function (t) { A.unpinDecision(t.getAttribute('data-id')); return true; },
    'entry-edit': function (t) {
      keepDraft();
      S().ui.editEntry = t.getAttribute('data-id');
      S().ui.err = null;
      return true;
    },
    'entry-edit-cancel': function () { S().ui.editEntry = null; S().ui.err = null; return true; },
    'entry-edit-save': function (t) {
      A.editEntry(t.getAttribute('data-id'), val('entryBody'));
      return true;
    },

    /* ------------------------------------------------ record create/edit -- */
    'p4-edit': function () { S().ui.p4Edit = true; S().ui.err = null; return true; },
    'p4-edit-cancel': function () { S().ui.p4Edit = false; S().ui.err = null; return true; },
    'p4-edit-save': function (t) {
      var res = A.editProject(t.getAttribute('data-id'), recordFields());
      if (res.ok) S().ui.p4Edit = false;
      return true;
    },
    'p4-create': function () {
      var res = A.createProject(recordFields());
      if (res.ok) {
        S().ui.p4Tab = 'overview';
        location.hash = '#/project/' + res.id;   /* hashchange runs render() */
      }
      return true;
    },
    'p4-create-cancel': function () { location.hash = '#/projects'; return true; },
    'p4-new': function () { S().ui.err = null; location.hash = '#/project/new'; return true; },

    /* ------------------------------------------------- approval actions --- */
    'ask-submit':  function (t) { openModal('submit', t.getAttribute('data-id')); return true; },
    'ask-approve': function (t) { openModal('approve', t.getAttribute('data-id')); return true; },
    'ask-return':  function (t) { openModal('return', t.getAttribute('data-id')); return true; },
    'ask-reject':  function (t) { openModal('reject', t.getAttribute('data-id')); return true; },
    'ask-gate':    function (t) { openModal('gate', t.getAttribute('data-id')); return true; },
    'ask-mark':    function (t) { openModal('mark', t.getAttribute('data-id')); return true; },
    'ask-start':   function (t) { openModal('start', t.getAttribute('data-id')); return true; },

    'do-submit': function (t) {
      var res = A.requestSubmitted(t.getAttribute('data-id'));
      if (res.ok) closeModal();
      return true;
    },
    'do-approve': function (t) {
      keepModalValues();
      var res = A.requestApproved(t.getAttribute('data-id'), val('mRemark'));
      if (res.ok) closeModal();
      return true;
    },
    'do-return': function (t) {
      keepModalValues();
      var res = A.returnToReview(t.getAttribute('data-id'), val('mReason'));
      if (res.ok) closeModal();
      return true;
    },
    'do-reject': function (t) {
      keepModalValues();
      var res = A.reject(t.getAttribute('data-id'), val('mReason'));
      if (res.ok) closeModal();
      return true;
    },
    'do-start': function (t) {
      var res = A.startImplementation(t.getAttribute('data-id'));
      if (res.ok) closeModal();
      return true;
    },
    'gate-click': function (t) {
      keepModalValues();
      var sys = t.getAttribute('data-sys');
      A.gateClick(t.getAttribute('data-id'), sys, t.getAttribute('data-step'), remarkFor(sys));
      return true;
    },
    'do-mark': function (t) {
      keepModalValues();
      var id = t.getAttribute('data-id');
      var dp = val('mRefDP') || val('refDP');
      var ch = val('mRefCH') || val('refCH');
      var res = A.markApproved(id, dp, ch);
      if (res.ok) closeModal();
      return true;
    },
    'mclose': function (t, ev) {
      /* the backdrop closes; a click inside the panel does not */
      if (ev.target.closest && ev.target.closest('.modal')) return false;
      closeModal();
      return true;
    },
    'modal-cancel': function () { closeModal(); return true; },

    /* ------------------------------------------------------ P1 sign in ---- */

    /* the demo way in: pick a role, land where that role's work is */
    'p1-signin': function (t) {
      var id = t.getAttribute('data-id');
      if (!CBP.setUser(id)) return true;
      S().ui.err = null;
      S().ui.notice = null;
      location.hash = '#/' + CBP.landingFor(S().user);
      return true;
    },

    /* D-10 — the credential form is prebuilt, not wired: anything signs in as
       the Area Office Admin, and the page says so */
    'p1-credentials': function () {
      S().ui.p1Email = val('p1Email');
      CBP.setUser('admin');
      S().ui.notice = null;
      location.hash = '#/' + CBP.landingFor(S().user);
      return true;
    },

    /* item 11 hook — simulated device detection */
    'p1-mobile': function () {
      S().ui.mobileSim = !S().ui.mobileSim;
      return true;
    },

    'signout': function () {
      S().ui.notice = null;
      S().ui.modal = null;
      S().ui.err = null;
      location.hash = '#/signin';
      return true;
    },

    /* ------------------------------------------------ P5 / P9 view state -- */
    'p5group': function (t) {
      S().ui.p5Group = t.getAttribute('data-g');       /* Country ∣ Status ∣ Owner */
      return true;
    },
    'p9tab': function (t) {
      S().ui.p9Tab = t.getAttribute('data-tab');
      S().ui.err = null;
      return true;
    },

    /* ------------------------------------------------ v1.0.1 view state --- */
    /* Same shape as p5group / p9tab above: a page names the key it wants and
       the one render() pass rebuilds from state. Wave-2 pages may use these or
       register their own delegated listener, as pages/p2.js already does. */
    'p7tab':     function (t) { S().ui.p7Tab = t.getAttribute('data-tab'); S().ui.err = null; return true; },
    'msgfilter': function (t) { S().ui.msgFilter = t.getAttribute('data-f'); return true; },
    'msgsort':   function (t) { S().ui.msgSort = t.getAttribute('data-s'); return true; },
    'msggroup':  function () { S().ui.msgGroup = !S().ui.msgGroup; return true; },
    'returnto':  function () {
      var to = S().ui.returnTo || 'projects';
      S().ui.returnTo = null;
      S().ui.p4Edit = false;
      location.hash = '#/' + to;
      return true;
    },

    /* --------------------------------------------- v1.0.1 comment state --- */
    /* Every one of these is driven by data attributes only, so no page has to
       agree with this file about field ids. Composers stay with the page that
       renders them. */
    'comment-read': function (t) {
      var r = t.getAttribute('data-read');
      A.commentRead(t.getAttribute('data-id'), r === null ? undefined : r === 'true');
      return true;
    },
    'comment-readall':  function (t) { A.commentReadAll(t.getAttribute('data-id') || null); return true; },
    'comment-priority': function (t) { A.commentPriority(t.getAttribute('data-id')); return true; },
    'pin-project':      function (t) { A.pinProject(t.getAttribute('data-id')); return true; },

    /* ------------------------------------------ v1.0.1 dashboard layout --- */
    'dash-edit':        function (t) { A.dashEditStart(t.getAttribute('data-id')); return true; },
    'dash-edit-cancel': function () { A.dashEditCancel(); return true; },
    'dash-edit-save':   function () { A.dashEditSave(); return true; },
    'dash-move':        function (t) {
      A.dashMove(t.getAttribute('data-id'), t.getAttribute('data-w'), t.getAttribute('data-dir'));
      return true;
    },
    'dash-resize': function (t) {
      A.dashResize(t.getAttribute('data-id'), t.getAttribute('data-w'), t.getAttribute('data-span'));
      return true;
    },
    'dash-add':    function (t) { A.dashAddWidget(t.getAttribute('data-id'), t.getAttribute('data-w')); return true; },
    'dash-remove': function (t) { A.dashRemoveWidget(t.getAttribute('data-id'), t.getAttribute('data-w')); return true; },
    'sync-dash':   function () { A.syncDashboards(); return true; },

    /* -------------------------------- v1.0.1 P9 dashboards & datasets ----- */
    'p9-dash-create': function () {
      A.dashCreate(val('p9DashName'));
      return true;
    },
    'p9-wdesc': function (t) {
      openModal('wdesc', t.getAttribute('data-w'));
      var wid = t.getAttribute('data-w');
      var meta = S().widgetMeta[wid];
      var w = (CBP.W && CBP.W.byId) ? CBP.W.byId(wid) : null;
      S().ui.modal.values = { mDesc: (meta && meta.desc) || (w ? w.blurb : '') };
      return true;
    },
    'p9-wdesc-save': function (t) {
      keepModalValues();
      var wid = t.getAttribute('data-w');
      var desc = (val('mDesc') || '').trim();
      if (desc) { S().widgetMeta[wid] = S().widgetMeta[wid] || {}; S().widgetMeta[wid].desc = desc; }
      else delete S().widgetMeta[wid];
      closeModal();
      CBP.notice('Dataset definition saved for “' + wid + '”. In the demo this is the description ' +
                 'line only — every chart keeps deriving its figures from the seeded data.');
      return true;
    },
    'p9-wdesc-reset': function (t) {
      delete S().widgetMeta[t.getAttribute('data-w')];
      closeModal();
      return true;
    },

    /* --------------------------------------------------------- misc ------- */
    'deeplink': function () {
      CBP.notice('“Open full editor in TimeBlock” deep-links the TimeBlock add-on module in a new tab (D-07). ' +
                 'The demo stops at the link — there is no data round-trip.');
      return true;
    },
    /* Phase A left every P3 control on a placeholder act. Now that the action
       layer exists, those controls open the project where the action lives. */
    'phaseb': function (t) {
      var label = (t.textContent || '').trim();
      if (label.indexOf('New project') > -1) { location.hash = '#/project/new'; return true; }
      var id = t.getAttribute('data-id');
      if (id) {
        S().ui.p4Tab = label.indexOf('editor') > -1 || label === 'Configure' ? 'timeline' : 'overview';
        location.hash = '#/project/' + id;
        return true;
      }
      return false;      /* Export etc. — leave the Phase A notice to app.js */
    }
  };

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!t) return;
    var h = HANDLERS[t.getAttribute('data-act')];
    if (!h) return;
    if (h(t, ev) === false) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();     /* keep app.js's Phase A notice quiet */
    CBP.render();
  });

  /* keep the composer / modal text in state as it is typed, so a re-render
     triggered by anything else does not throw it away */
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t || !t.id) return;
    if (t.id === 'actBody' || t.id === 'actAssignee') { keepDraft(); return; }
    if (S().ui.modal) keepModalValues();
  });

})();
