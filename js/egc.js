/* egc.js — v1.1.0 · F1 External Gate Connector (WP1).

   The approval process stays in this portal. The EGC only (a) tells CHaS and
   Decision Point where a request has got to, and (b) reads their decision back,
   so all three systems tell the same story. Everything here is simulated
   in-memory: no network, no persistence, no wall clock (S-15 — every date comes
   from CONFIG.TODAY or from the event's own `at`).

   ONE GATE CLOCK (S-01): p.gate[system] stays the only place the gate state
   lives. This file never creates a parallel gate store; it decides *whether* a
   write happens and records *how* it happened in state.gateEvents (S-02).

   ------------------------------------------------------------------ mode matrix
   Per system, state.integrations[sys].mode. "Manual click" is always M1 (R-2).

   | inbound / mode        | manual                | assisted              | auto                    |
   |-----------------------|-----------------------|-----------------------|-------------------------|
   | manual click (M1)     | writes the gate       | writes the gate       | writes the gate         |
   | portal lodge (submit) | not lodged (M1 clicks)| writes, source portal | writes, source portal   |
   | inbound authoritative | PROPOSAL (+A-16)      | PROPOSAL (+A-16)      | writes, source = driver |
   | inbound advisory      | PROPOSAL (+A-16)      | PROPOSAL (+A-16)      | PROPOSAL (+A-16)        |
   | inbound, gate already |                       |                       |                         |
   | set to another date   | PROPOSAL 'conflict'   | PROPOSAL 'conflict'   | PROPOSAL 'conflict'     |
   | inbound, same date    | no-op                 | no-op                 | no-op                   |

   Driver (manual ∣ deeplink ∣ excel ∣ email ∣ flow ∣ rest ∣ sim) says HOW we
   talk; mode says how much we TRUST it (S-05). Excel imports are always
   advisory, so a pasted export can never write a gate on its own.

   Outbound ops live in state.syncQueue (S-06): 'lodge', 'contract_sent',
   'reconcile', 'status_mirror'. A failed op raises A-15 and never blocks the
   ladder.

   This file registers no click listener: it owns no UI (WP2 owns the pages). */
(function () {
  'use strict';

  var D = CBP.D;
  var A = CBP.actions;

  function S()     { return CBP.state; }
  function me()    { return CBP.state.user; }
  function TODAY() { return CBP.CONFIG.TODAY; }

  function fail(key, msg) {
    S().ui.err = { key: key, msg: msg };
    return { ok: false, error: msg };
  }

  function done(extra, silent) {
    S().ui.err = null;
    var r = { ok: true };
    if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
    if (!silent) CBP.render();
    return r;
  }

  var FALLBACK = { label: null, mode: 'manual', driver: 'manual', health: 'off' };

  function sysDef(key) {
    return CBP.CONFIG.GATE_SYSTEMS.filter(function (s) { return s.key === key; })[0] || null;
  }

  function sysLabel(key) {
    var i = D.integration(key);
    if (i && i.label) return i.label;
    var s = sysDef(key);
    return s ? s.label : key;
  }

  function stats(key) {
    var i = S().integrations && S().integrations[key];
    if (!i) return null;
    i.stats = i.stats || { ok: 0, failed: 0, proposals: 0 };
    return i.stats;
  }

  /* ======================================================== derived (D.*) ===
     Pure readers, extending CBP.D without touching derive.js (WP ownership). */

  D.integration = function (sys) {
    var i = (S().integrations || {})[sys];
    if (!i) {
      return { label: (sysDef(sys) || {}).label || sys,
               mode: FALLBACK.mode, driver: FALLBACK.driver, health: FALLBACK.health,
               last_sync_at: null, deep_link_template: '', mapping: [],
               stats: { ok: 0, failed: 0, proposals: 0 } };
    }
    return i;
  };

  D.syncMode = function (sys) {
    var m = D.integration(sys).mode;
    return CBP.CONFIG.SYNC_MODES.indexOf(m) > -1 ? m : 'manual';
  };

  /* oldest first, stable on equal dates (insertion order is the tiebreak) */
  D.gateEventsFor = function (p, sys) {
    var pid = (p && p.id) ? p.id : p;
    var rows = (S().gateEvents || []).map(function (e, i) { return { e: e, i: i }; })
      .filter(function (x) {
        return x.e.project_id === pid && (!sys || x.e.system === sys);
      });
    rows.sort(function (a, b) {
      var da = a.e.at || '', db = b.e.at || '';
      if (da < db) return -1;
      if (da > db) return 1;
      return a.i - b.i;
    });
    return rows.map(function (x) { return x.e; });
  };

  /* who said so: the last event for that step, or null */
  D.gateSource = function (p, sys, step) {
    var rows = D.gateEventsFor(p, sys).filter(function (e) {
      return !step || e.step === step;
    });
    if (!rows.length) return null;
    var e = rows[rows.length - 1];
    return { source: e.source, confidence: e.confidence, actor: e.actor,
             at: e.at, ref: e.ref || null, step: e.step, note: e.note || null };
  };

  function proposalsAll() { return S().gateProposals || []; }

  D.proposalsFor = function (p) {
    var pid = (p && p.id) ? p.id : p;
    return proposalsAll().filter(function (r) {
      return r.project_id === pid && r.status === 'open';
    });
  };

  D.openProposals = function (user) {
    var u = user || me();
    var codes = D.visibleCountries(u, S().countries);
    return proposalsAll().filter(function (r) {
      if (r.status !== 'open') return false;
      if (u.role === 'admin') return true;
      var p = CBP.projectById(r.project_id);
      if (!p) return false;
      return codes.indexOf(p.country) > -1;
    });
  };

  D.proposalBadge = function (user) { return D.openProposals(user).length; };

  D.syncHealth = function (sys) {
    var i = D.integration(sys);
    var rows = (S().syncQueue || []).filter(function (r) { return r.system === sys; });
    var queued = rows.filter(function (r) { return r.status === 'queued'; }).length;
    var failed = rows.filter(function (r) { return r.status === 'failed'; }).length;
    var health = i.health || 'off';
    var LABEL = { ok: 'Connected', warn: 'Degraded', failed: 'Failing', off: 'Not configured' };
    return { health: health, last_sync_at: i.last_sync_at || null,
             queued: queued, failed: failed, label: LABEL[health] || health };
  };

  D.syncFor = function (p, sys) {
    var pid = (p && p.id) ? p.id : p;
    var rows = (S().syncQueue || []).filter(function (r) {
      return r.project_id === pid && (!sys || r.system === sys);
    });
    return rows.length ? rows[rows.length - 1] : null;
  };

  /* S-07 — a deep link is offered wherever the gate shows, in every mode. */
  D.deepLink = function (p, sys) {
    var tpl = D.integration(sys).deep_link_template;
    if (!tpl || !p) return null;
    var vals = {
      chas_guid: p.chas_guid || '',
      decision_point_ref: (p.refs || {}).decision_point || '',
      project_id: p.id || ''
    };
    var missing = false;
    var url = String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      var v = vals[k];
      if (!v) { missing = true; return ''; }
      return encodeURIComponent(v);
    });
    return missing ? null : url;
  };

  /* A-06 stays DERIVED (F17): worst open gate past the threshold, or null. */
  D.gateIdle = function (p) {
    var worst = null;
    D.openGates(p).forEach(function (g) {
      if (g.days === null || g.days === undefined) return;
      if (g.days <= CBP.CONFIG.GATE_THRESHOLD_DAYS) return;
      if (!worst || g.days > worst.days) worst = { sys: g.key, days: g.days, label: g.label };
    });
    return worst;
  };

  /* ======================================================== admin (A.*) =====
     Admin › Integrations. Every write is permission-checked through the MATRIX
     row 'integrations' — never an inline role test. */

  var FIELDS = ['mode', 'driver', 'deep_link_template', 'endpoint_masked', 'secret_set', 'health'];

  A.integrationSet = function (sys, field, value) {
    var u = me();
    if (!D.can(u, 'integrations')) {
      return fail('integrations', 'Integrations are configured by the area office only.');
    }
    var i = (S().integrations || {})[sys];
    if (!i) return fail('integrations', 'Unknown system “' + sys + '”.');
    if (FIELDS.indexOf(field) === -1) return fail('integrations', 'That setting is not editable.');

    if (field === 'mode' && CBP.CONFIG.SYNC_MODES.indexOf(value) === -1) {
      return fail('integrations', 'Sync mode is Manual, Assisted or Auto.');
    }
    if (field === 'driver' && CBP.CONFIG.SYNC_DRIVERS.indexOf(value) === -1) {
      return fail('integrations', 'Unknown driver “' + value + '”.');
    }
    if (field === 'health' && ['off', 'ok', 'warn', 'failed'].indexOf(value) === -1) {
      return fail('integrations', 'Health is off, ok, warn or failed.');
    }
    if (field === 'secret_set') value = !!value;

    var was = i[field];
    if ((was === undefined ? null : was) === (value === undefined ? null : value)) {
      return fail('integrations', 'Nothing changed.');
    }
    i[field] = value;

    CBP.addLog(null, 'system', CBP.userName(u.id) + ' set ' + sysLabel(sys) + ' ' +
      field.replace(/_/g, ' ') + ' → ' +
      (value === null || value === '' ? '—' : String(value)) + '.');
    return done({ system: sys, field: field, value: value, was: was });
  };

  /* Simulated connectivity test. A system that is already failing stays failing
     until it is reset, so the "failed sync" demo path is stable. */
  A.integrationTest = function (sys) {
    var u = me();
    if (!D.can(u, 'integrations')) {
      return fail('integrations', 'Integrations are tested by the area office only.');
    }
    var i = (S().integrations || {})[sys];
    if (!i) return fail('integrations', 'Unknown system “' + sys + '”.');

    var msg;
    if (i.health === 'failed') {
      msg = sysLabel(sys) + ' is still failing — reset the connector after fixing the endpoint.';
      CBP.addLog(null, 'system', CBP.userName(u.id) + ' tested ' + sysLabel(sys) + ' — failed.');
      done({ system: sys, health: 'failed' });
      return { ok: false, msg: msg, health: 'failed' };
    }
    i.health = 'ok';
    i.last_sync_at = TODAY();
    msg = sysLabel(sys) + ' answered on ' + D.fmtDateY(TODAY()) + ' — connector ok (simulated).';
    CBP.addLog(null, 'system', CBP.userName(u.id) + ' tested ' + sysLabel(sys) + ' — ok.');
    done({ system: sys, health: 'ok' });
    return { ok: true, msg: msg, health: 'ok' };
  };

  A.integrationReset = function (sys) {
    var u = me();
    if (!D.can(u, 'integrations')) {
      return fail('integrations', 'Integrations are reset by the area office only.');
    }
    var i = (S().integrations || {})[sys];
    if (!i) return fail('integrations', 'Unknown system “' + sys + '”.');

    i.health = 'ok';
    i.stats = i.stats || { ok: 0, failed: 0, proposals: 0 };
    i.stats.failed = 0;
    CBP.addLog(null, 'system', CBP.userName(u.id) + ' reset ' + sysLabel(sys) +
      ' — health ok, failed counter cleared. Queued operations can be retried.');
    return done({ system: sys });
  };

  /* ================================================== inbound gate events ===*/

  function proposalNote(source, reason) {
    if (reason === 'conflict') return 'the portal already holds a different date or reference';
    return 'inbound ' + source + ' event';
  }

  function propose(p, system, step, meta, reason, silent) {
    var st = S();
    st.gateProposals = st.gateProposals || [];
    var row = {
      id: 'GP' + (++st.proposalSeq),
      project_id: p.id,
      system: system,
      step: step,
      proposed_at: TODAY(),
      proposed_date: meta.at || TODAY(),
      proposed_ref: meta.ref || null,
      source: meta.source || 'sim',
      confidence: meta.confidence || 'authoritative',
      reason: reason || 'inbound',
      status: 'open',
      decided_by: null,
      decided_at: null,
      note: meta.note || proposalNote(meta.source || 'sim', reason)
    };
    st.gateProposals.push(row);

    var s = stats(system);
    if (s) s.proposals++;

    CBP.addLog(p.id, 'sync', sysLabel(system) + ' — ' + step + ' proposed for ' +
      D.fmtDateY(row.proposed_date) + ' from a ' + row.source + ' event' +
      (row.proposed_ref ? ' · reference ' + row.proposed_ref : '') +
      (reason === 'conflict' ? ' · conflicts with the date already recorded' : '') +
      '. Waiting for the Regional Manager to confirm.');

    /* A-16 — a proposal is waiting for M1 */
    A.send('A-16', p, ['m1'],
      '[Sync] ' + p.id + ' — ' + sysLabel(system) + ' ' + step + ' proposed',
      [sysLabel(system) + ' reported ' + step + ' on ' + D.fmtDateY(row.proposed_date) +
       ' (source: ' + row.source + ', ' + row.confidence + ').',
       row.proposed_ref ? 'Reference: ' + row.proposed_ref : 'No reference supplied.',
       reason === 'conflict'
         ? 'This conflicts with the date already on the record — confirm or dismiss it in Approvals.'
         : 'Confirm it in Approvals to write it onto the gate, or dismiss it with a reason.']);

    return done({ proposal: row, id: row.id, proposed: true }, silent);
  }

  /* THE single entry point for a gate step. actions.js owns the write path
     (A.gateApply); this router decides whether it runs at all. */
  var applyGate = A.gateEvent;
  A.gateApply = applyGate;

  A.gateEvent = function (p, system, step, meta) {
    meta = meta || {};
    if (!p) return fail('gate', 'Project not found.');
    if (typeof p === 'string') p = CBP.projectById(p);
    if (!p) return fail('gate', 'Project not found.');

    if (!sysDef(system)) return fail('gate', 'Unknown external system.');
    if (step !== 'submitted' && step !== 'approved') return fail('gate', 'Unknown gate step.');

    var source = meta.source || 'manual';
    var mode = D.syncMode(system);
    var silent = !!meta.silent;

    /* a manual click always writes: it IS the human decision (R-2) */
    if (source === 'manual') return applyGate(p, system, step, meta);

    /* the portal lodging what it just did is authoritative in both non-manual
       modes; in manual mode nothing auto-lodges at all (see the matrix) */
    if (source === 'portal') {
      if (mode === 'manual') return fail('gate', sysLabel(system) + ' is in Manual mode — nothing is lodged automatically.');
      return applyGate(p, system, step, meta);
    }

    var g = (p.gate || {})[system] || {};
    var held = g[step === 'approved' ? 'approved_at' : 'submitted_at'] || null;
    var at = meta.at || TODAY();
    var refField = (sysDef(system) || {}).ref_field || system;
    var heldRef = (p.refs || {})[refField] || null;

    if (held) {
      var sameDate = held === at;
      var sameRef = !meta.ref || !heldRef || heldRef === meta.ref;
      if (sameDate && sameRef) {
        /* already recorded, nothing to decide */
        return done({ id: p.id, system: system, step: step, unchanged: true }, silent);
      }
      return propose(p, system, step, meta, 'conflict', silent);
    }

    if (mode === 'auto' && meta.confidence !== 'advisory') {
      return applyGate(p, system, step, meta);
    }
    return propose(p, system, step, meta, meta.reason || 'inbound', silent);
  };

  A.gateConfirm = function (proposalId) {
    var u = me();
    if (!D.can(u, 'gate_confirm')) {
      return fail('gate_confirm', 'Sync proposals are confirmed by the Regional Manager (R-2).');
    }
    var row = (S().gateProposals || []).filter(function (r) { return r.id === proposalId; })[0];
    if (!row) return fail('gate_confirm', 'That proposal no longer exists.');
    if (row.status !== 'open') return fail('gate_confirm', 'That proposal is already ' + row.status + '.');

    var p = CBP.projectById(row.project_id);
    if (!p) return fail('gate_confirm', 'Project ' + row.project_id + ' not found.');

    var res = applyGate(p, row.system, row.step, {
      source: row.source, confidence: 'authoritative',
      at: row.proposed_date, ref: row.proposed_ref,
      note: 'confirmed from proposal ' + row.id,
      silent: true
    });
    if (!res.ok) return res;

    row.status = 'confirmed';
    row.decided_by = u.id;
    row.decided_at = TODAY();

    CBP.addLog(p.id, 'sync', CBP.userName(u.id) + ' confirmed the ' + sysLabel(row.system) +
      ' ' + row.step + ' proposal — recorded ' + D.fmtDateY(row.proposed_date) +
      ' from a ' + row.source + ' event.');

    return done({ id: row.id, project: p.id, system: row.system, step: row.step });
  };

  A.gateDismiss = function (proposalId, reason) {
    var u = me();
    if (!D.can(u, 'gate_confirm')) {
      return fail('gate_confirm', 'Sync proposals are decided by the Regional Manager (R-2).');
    }
    var row = (S().gateProposals || []).filter(function (r) { return r.id === proposalId; })[0];
    if (!row) return fail('gate_confirm', 'That proposal no longer exists.');
    if (row.status !== 'open') return fail('gate_confirm', 'That proposal is already ' + row.status + '.');

    reason = (reason || '').trim();
    if (!reason) return fail('gate_confirm', 'A reason is required before a proposal can be dismissed.');

    row.status = 'dismissed';
    row.decided_by = u.id;
    row.decided_at = TODAY();
    row.note = reason;

    CBP.addLog(row.project_id, 'sync', CBP.userName(u.id) + ' dismissed the ' +
      sysLabel(row.system) + ' ' + row.step + ' proposal. Reason: ' + reason);

    return done({ id: row.id, reason: reason });
  };

  /* --------------------------------------------------------- simulator ---- */

  /* Admin › Integrations "Simulate inbound event". Records as source 'sim';
     what happens next is the mode matrix's business, not the simulator's. */
  A.simInbound = function (sys, projectId, step, meta) {
    var u = me();
    if (!D.can(u, 'integrations')) {
      return fail('integrations', 'The inbound simulator belongs to the area office.');
    }
    var p = CBP.projectById(projectId);
    if (!p) return fail('integrations', 'Project ' + projectId + ' not found.');
    if (!sysDef(sys)) return fail('integrations', 'Only a gate system receives inbound events.');
    if (step !== 'submitted' && step !== 'approved') return fail('integrations', 'Unknown gate step.');

    meta = meta || {};
    if (meta.at && !/^\d{4}-\d{2}-\d{2}$/.test(String(meta.at))) {
      return fail('integrations', 'Enter the event date as YYYY-MM-DD.');
    }
    var i = (S().integrations || {})[sys];
    if (i) i.last_sync_at = TODAY();

    return A.gateEvent(p, sys, step, {
      source: 'sim',
      confidence: meta.confidence === 'advisory' ? 'advisory' : 'authoritative',
      ref: meta.ref || null,
      at: meta.at || TODAY(),
      note: meta.note || 'simulated inbound event from ' + sysLabel(sys)
    });
  };

  /* ------------------------------------------------------ Excel reconcile -- */

  function splitRows(text) {
    return String(text || '').replace(/\r/g, '').split('\n')
      .filter(function (l) { return l.trim() !== ''; });
  }

  function cells(line, delim) {
    return line.split(delim).map(function (c) { return c.trim().replace(/^"|"$/g, ''); });
  }

  function findCol(head, patterns) {
    for (var i = 0; i < head.length; i++) {
      var h = head[i].toLowerCase();
      for (var j = 0; j < patterns.length; j++) {
        if (patterns[j].test(h)) return i;
      }
    }
    return -1;
  }

  /* the pasted "All Humanitarian Projects" export. Pure: no state written. */
  function parseExcel(text) {
    var lines = splitRows(text);
    if (!lines.length) return { error: 'Nothing was pasted.' };

    var delim = lines[0].indexOf('\t') > -1 ? '\t' : ',';
    var head = cells(lines[0], delim);
    var iId = findCol(head, [/project\s*id/, /^project$/, /^id$/]);
    var iStatus = findCol(head, [/status/]);
    var iApproved = findCol(head, [/approved/]);
    var iImpl = findCol(head, [/implementation/]);
    var iSubmitted = findCol(head, [/submitted/]);
    var iRef = findCol(head, [/reference/, /ref\b/, /chas\s*(no|ref)/, /request\s*no/]);

    if (iId === -1 || (iStatus === -1 && iApproved === -1 && iImpl === -1)) {
      return { error: 'The header row must contain “Project ID” and either “Status” or an ' +
                      '“Approved” / “Implementation” date column.' };
    }

    var rows = [];
    for (var n = 1; n < lines.length; n++) {
      var c = cells(lines[n], delim);
      var id = (c[iId] || '').toUpperCase();
      if (!id) continue;
      var status = iStatus > -1 ? (c[iStatus] || '') : '';
      var approved = iApproved > -1 ? (c[iApproved] || '') : '';
      var impl = iImpl > -1 ? (c[iImpl] || '') : '';
      var submitted = iSubmitted > -1 ? (c[iSubmitted] || '') : '';
      var date = null, step = null;

      if (/^\d{4}-\d{2}-\d{2}$/.test(approved) || /approv/i.test(status)) {
        step = 'approved';
        date = /^\d{4}-\d{2}-\d{2}$/.test(approved) ? approved
             : (/^\d{4}-\d{2}-\d{2}$/.test(impl) ? impl : null);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(submitted) || /submit|lodg/i.test(status)) {
        step = 'submitted';
        date = /^\d{4}-\d{2}-\d{2}$/.test(submitted) ? submitted : null;
      }

      rows.push({ id: id, step: step, at: date,
                  ref: iRef > -1 ? (c[iRef] || null) : null,
                  status: status });
    }
    return { rows: rows, head: head, delim: delim === '\t' ? 'tab' : 'comma' };
  }
  CBP.egc = CBP.egc || {};
  CBP.egc.parseExcel = parseExcel;

  A.importExcel = function (sys, text) {
    var u = me();
    if (!D.can(u, 'integrations')) {
      return fail('integrations', 'The reconciliation import belongs to the area office (F12).');
    }
    if (!sysDef(sys)) return fail('integrations', 'Only a gate system can be reconciled.');

    var parsed = parseExcel(text);
    if (parsed.error) return fail('integrations', parsed.error);

    var matched = 0, proposals = 0, ignored = 0, unchanged = 0;
    parsed.rows.forEach(function (r) {
      var p = CBP.projectById(r.id);
      if (!p || !r.step) { ignored++; return; }
      matched++;
      /* an export is evidence, never authority: always advisory (S-05) */
      var res = A.gateEvent(p, sys, r.step, {
        source: 'excel', confidence: 'advisory',
        ref: r.ref || null, at: r.at || TODAY(),
        note: 'CHaS export row · status “' + (r.status || '—') + '”',
        silent: true
      });
      if (res && res.proposed) proposals++;
      else if (res && res.unchanged) unchanged++;
    });

    var i = (S().integrations || {})[sys];
    if (i) i.last_sync_at = TODAY();

    CBP.addLog(null, 'system', CBP.userName(u.id) + ' imported a ' + sysLabel(sys) +
      ' export — ' + parsed.rows.length + ' row' + (parsed.rows.length === 1 ? '' : 's') +
      ' read, ' + matched + ' matched, ' + proposals + ' proposal' +
      (proposals === 1 ? '' : 's') + ' raised, ' + ignored + ' ignored.');

    return done({ matched: matched, proposals: proposals, ignored: ignored, unchanged: unchanged });
  };

  /* ===================================================== outbound queue =====
     S-06: the queue is the portal's outbox towards the external systems. A
     failed op raises A-15 once and never blocks the ladder. */

  var OPS = ['lodge', 'contract_sent', 'reconcile', 'status_mirror'];

  var OP_TEXT = {
    lodge: 'lodge the request',
    contract_sent: 'mirror the Corporate Agreement reference',
    reconcile: 'reconcile the record',
    status_mirror: 'mirror the project status'
  };

  A.enqueueSync = function (p, sys, op, payload, silent) {
    if (typeof p === 'string') p = CBP.projectById(p);
    if (!p) return null;
    if (OPS.indexOf(op) === -1) return null;

    var st = S();
    st.syncQueue = st.syncQueue || [];
    var row = {
      id: 'SQ' + (++st.syncSeq),
      project_id: p.id,
      system: sys,
      op: op,
      status: 'queued',
      attempts: 0,
      at: TODAY(),
      err: null,
      payload: payload || null
    };
    st.syncQueue.push(row);
    A.runQueue(!!silent);      /* silent = the caller ends in its own done() */
    return row;
  };

  /* the simulated transport: an op succeeds unless its system is failing */
  A.runQueue = function (silent) {
    var st = S();
    var ran = 0, ok = 0, failed = 0;

    (st.syncQueue || []).forEach(function (row) {
      if (row.status !== 'queued') return;
      var p = CBP.projectById(row.project_id);
      var i = (st.integrations || {})[row.system];
      row.attempts++;
      ran++;

      if (D.integration(row.system).health === 'failed') {
        row.status = 'failed';
        row.err = sysLabel(row.system) + ' did not answer (simulated connector failure).';
        failed++;
        var s = stats(row.system);
        if (s) s.failed++;
        if (p) {
          CBP.addLog(p.id, 'sync', sysLabel(row.system) + ' — could not ' +
            (OP_TEXT[row.op] || row.op) + ' (attempt ' + row.attempts + ' of ' +
            CBP.CONFIG.SYNC_RETRY_MAX + '). The approval ladder is not blocked; ' +
            'record it directly in ' + sysLabel(row.system) + ' using the deep link.');
          if (!row.alerted) {
            row.alerted = true;
            /* A-15 — sync failed, to the area office and the country's M1 */
            A.send('A-15', p, ['admin', 'm1'],
              '[Sync failed] ' + p.id + ' — ' + sysLabel(row.system) + ' ' + row.op,
              [sysLabel(row.system) + ' could not ' + (OP_TEXT[row.op] || row.op) + ' on ' +
               D.fmtDateY(TODAY()) + ' (operation ' + row.id + ', attempt ' + row.attempts + ').',
               'Reason: ' + row.err,
               'Nothing is blocked: the step can be recorded by hand in ' + sysLabel(row.system) +
               ', and the operation can be retried from Admin › Integrations.']);
          }
        }
        return;
      }

      row.status = 'ok';
      row.err = null;
      ok++;
      var s2 = stats(row.system);
      if (s2) s2.ok++;
      if (i) i.last_sync_at = TODAY();
      if (p) {
        CBP.addLog(p.id, 'sync', sysLabel(row.system) + ' — ' +
          (OP_TEXT[row.op] || row.op) + ' sent on ' + D.fmtDateY(TODAY()) +
          ' (operation ' + row.id + ').');
      }
    });

    return done({ ran: ran, ok: ok, failed: failed }, silent);
  };

  A.retrySync = function (id) {
    var u = me();
    if (!D.can(u, 'integrations')) {
      return fail('integrations', 'Queued operations are retried by the area office.');
    }
    var row = (S().syncQueue || []).filter(function (r) { return r.id === id; })[0];
    if (!row) return fail('integrations', 'That operation is no longer in the queue.');
    if (row.status === 'ok') return fail('integrations', 'That operation already succeeded.');
    if (row.attempts >= CBP.CONFIG.SYNC_RETRY_MAX) {
      return fail('integrations', 'Operation ' + row.id + ' has used all ' +
        CBP.CONFIG.SYNC_RETRY_MAX + ' attempts — reset the connector before retrying.');
    }
    row.status = 'queued';
    row.err = null;
    return A.runQueue();
  };

  /* ------------------------------------------------------------ namespace -- */

  CBP.egc.version = '1.1.0';
  CBP.egc.MODES = CBP.CONFIG.SYNC_MODES;
  CBP.egc.OPS = OPS;
  CBP.egc.systems = function () {
    return CBP.CONFIG.GATE_SYSTEMS.map(function (s) { return s.key; });
  };

})();
