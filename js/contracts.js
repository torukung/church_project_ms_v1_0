/* contracts.js — v1.1.0 · WP3 Contracts engine.
   The Corporate Agreement lifecycle (F2, rulings S-08…S-11, S-16) as one state
   machine: CBP.contracts (the two hooks actions.js calls), the D.contract*
   derived readers, and the A.contract* mutations.

   Loads AFTER actions.js and egc.js, BEFORE pages/, so it may extend CBP.D and
   CBP.actions in place without either file knowing about it. It owns no DOM and
   registers no listener: every surface is WP2/WP4's.

   House rules kept: vanilla ES5 in an IIFE, no Date.now (clocks from
   CONFIG.TODAY via D.daysSince / D.addDays), permissions only through the
   MATRIX (D.can) narrowed by D.canContract, one CBP.render() per mutation, and
   every mutation writes exactly one typed 'contract' entry on the project whose
   id is projected onto c.log_ids (F26 — the CT2 Log tab reads the stream, it
   never keeps a second copy). */
(function () {
  'use strict';

  var D = CBP.D;
  var A = CBP.actions;
  var C = {};
  CBP.contracts = C;

  function S()     { return CBP.state; }
  function me()    { return CBP.state.user; }
  function TODAY() { return CBP.CONFIG.TODAY; }
  function CFG()   { return CBP.CONFIG; }

  function pad4(n) { n = String(n); while (n.length < 4) n = '0' + n; return n; }

  function iso(d) {
    return d.getUTCFullYear() + '-' +
           pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  /* TODAY + n days, as an ISO date. The only clock in this file. */
  function inDays(n) { return iso(D.addDays(D.today(), n)); }

  function laterOf(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return a > b ? a : b;
  }

  function countryName(code) {
    var c = (S().countries || []).filter(function (x) { return x.code === code; })[0];
    return c ? c.name : code;
  }

  function projectOf(c) {
    return c ? CBP.projectById(c.project_id) : null;
  }

  function statusLabel(st) {
    var row = CFG().CONTRACT_STATUS[st];
    return row ? row.label : st;
  }

  function divisionLabel(key) {
    var d = CFG().REVIEW_DIVISIONS.filter(function (x) { return x.key === key; })[0];
    return d ? d.label : key;
  }

  function divisionRole(key) {
    var d = CFG().REVIEW_DIVISIONS.filter(function (x) { return x.key === key; })[0];
    return d ? d.role : key;
  }

  /* the countries a persona may see at all — the same reader P3 and the hub use */
  function inScope(user, code) {
    if (!user || !code) return false;
    return D.visibleCountries(user, S().countries).indexOf(code) > -1;
  }

  /* ======================================================== alert plumbing ==
     WP1 may expose A.send; until it does (and it is private in v1.0.4) this
     pushes the identical outbox row shape actions.js writes, so the P8 outbox
     panel and RD-2 never have to tell the two apart. */

  function bodyFor(p, lines) {
    return [p.name + ' — ' + p.id + ' · ' + countryName(p.country) + ' · ' + D.money(p.amount)]
      .concat(lines)
      .concat(['Owner: ' + (p.owner ? CBP.userName(p.owner) : 'unassigned') +
               (p.backup ? ' · backup: ' + CBP.userName(p.backup) : ''),
               'Open the project: #/project/' + p.id])
      .join('\n');
  }

  function mail(rule, p, ids, subject, lines, extra) {
    var seen = {}, to = [];
    ids.forEach(function (i) { if (i && !seen[i]) { seen[i] = 1; to.push(i); } });
    var names = to.map(function (i) { return CBP.userName(i); });
    S().outbox.push({
      rule: rule, to: names, to_ids: to,
      subject: subject, body: bodyFor(p, lines),
      at: TODAY(), project: p.id
    });
    CBP.addLog(p.id, 'system',
      'Alert ' + rule + ' sent to ' + (names.join(', ') || 'no recipient — no owner set') +
      ' — ' + subject, extra || null);
    return to;
  }

  /* kinds go through A.recipients (owner ∣ backup ∣ role key), so 'ogc' and
     'finance' resolve to the reviewer personas in country scope. */
  function alertKinds(rule, p, kinds, subject, lines, extra) {
    if (typeof A.send === 'function') return A.send(rule, p, kinds, subject, lines);
    return mail(rule, p, A.recipients(p, kinds), subject, lines, extra);
  }

  function alertIds(rule, p, ids, subject, lines, extra) {
    return mail(rule, p, ids, subject, lines, extra);
  }

  /* =============================================================== derive ===
     Pure readers. Nothing here mutates; nothing memoises (F27). */

  /* S-08 — is a Corporate Agreement required at all? The Admin › Process
     threshold is the default; a per-project override wins when set. */
  D.contractRequired = function (p) {
    if (!p) return false;
    if (p.contract_required_override !== undefined && p.contract_required_override !== null) {
      return !!p.contract_required_override;
    }
    if (p.contract_required !== undefined && p.contract_required !== null) {
      return !!p.contract_required;
    }
    return (p.amount || 0) >= CFG().CONTRACT_THRESHOLD_USD;
  };

  D.contractById = function (id) {
    if (!id || !S()) return null;
    return (S().contracts || []).filter(function (c) { return c.id === id; })[0] || null;
  };

  /* liberal selector: a project object, a project id, a 3-letter country code,
     or { project, country, user }. Always returns a NEW array, id order. */
  D.contractsFor = function (sel) {
    var all = (S() && S().contracts) ? S().contracts.slice() : [];
    if (!sel) return all.sort(byId);

    var q = sel;
    if (typeof sel === 'string') {
      q = (sel.length === 3) ? { country: sel } : { project: sel };
    } else if (sel.id && sel.country !== undefined && sel.status !== undefined) {
      q = { project: sel };                       /* a project record */
    } else if (sel.role !== undefined && sel.id) {
      q = { user: sel };                          /* a user record */
    }

    var out = all;
    if (q.project) {
      var pid = typeof q.project === 'string' ? q.project : q.project.id;
      out = out.filter(function (c) { return c.project_id === pid; });
    }
    if (q.country) {
      out = out.filter(function (c) { return c.country === q.country; });
    }
    if (q.user) {
      var codes = D.visibleCountries(q.user, S().countries);
      out = out.filter(function (c) { return codes.indexOf(c.country) > -1; });
    }
    return out.sort(byId);
  };

  function byId(a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); }

  /* the agreement the gate reads: the project's first non-amendment contract */
  D.primaryContract = function (p) {
    if (!p) return null;
    if (p.primary_contract_id) {
      var hit = D.contractById(p.primary_contract_id);
      if (hit) return hit;
    }
    return D.contractsFor({ project: p.id }).filter(function (c) {
      return !c.parent_contract_id;
    })[0] || null;
  };

  D.contractChildren = function (c) {
    if (!c) return [];
    return D.contractsFor({ project: c.project_id }).filter(function (x) {
      return x.parent_contract_id === c.id;
    });
  };

  /* the last date anything actually moved on this agreement — the clock behind
     both the gate's `days` and A-20 contract-idle. */
  D.contractLastMove = function (c) {
    if (!c) return null;
    var at = c.created_at || null;
    (c.versions || []).forEach(function (v) { at = laterOf(at, v.at); });
    (c.reviews || []).forEach(function (r) { at = laterOf(at, r.decided_at); });
    (c.signatories || []).forEach(function (s) { at = laterOf(at, s.signed_at); });
    (c.history || []).forEach(function (h) { at = laterOf(at, h.at); });
    at = laterOf(at, c.executed_at);
    at = laterOf(at, c.sent_at);
    return at;
  };

  D.contractAge = function (c) {
    var at = D.contractLastMove(c);
    return at ? D.daysSince(at) : null;
  };

  /* A-20 — nothing has moved for CONTRACT_IDLE_DAYS. Derived only; never sent
     from a render pass (S-15/F17). */
  D.contractIdle = function (c) {
    if (!c) return false;
    if (['sent', 'active', 'expired', 'terminated', 'cancelled'].indexOf(c.status) > -1) return false;
    var days = D.contractAge(c);
    return days !== null && days > CFG().CONTRACT_IDLE_DAYS;
  };

  /* S-08 — the contract gate inside status 2. `met` is the only thing the
     ladder reads; an amendment never un-meets a gate already met (F19). */
  var GATE_STATE = {
    draft:                  'drafting',
    in_review:              'review',
    approved_for_signature: 'review',
    signing:                'signing',
    executed:               'executed',
    sent:                   'sent',
    active:                 'active',
    amending:               'amending'
  };

  D.contractGate = function (p) {
    if (!p || !D.contractRequired(p)) {
      return { state: 'na', contract: null, days: null, met: true };
    }
    var c = D.primaryContract(p);
    if (!c || !GATE_STATE[c.status]) {
      /* no agreement yet, or the only one was cancelled/terminated/expired —
         either way the project owes a draft. */
      return {
        state: 'todo', contract: c || null,
        days: p.approved_at ? D.daysSince(p.approved_at) : null,
        met: false
      };
    }
    return {
      state: GATE_STATE[c.status],
      contract: c,
      days: D.contractAge(c),
      met: CFG().CONTRACT_MET.indexOf(c.status) > -1
    };
  };

  D.reviewDue = function (c, division) {
    if (!c) return null;
    var r = (c.reviews || []).filter(function (x) { return x.division === division; })[0];
    if (!r) return null;
    var days = r.due_at ? D.daysBetween(D.today(), D.parse(r.due_at)) : null;
    return {
      due_at: r.due_at || null,
      days: days,
      overdue: r.status === 'pending' && days !== null && days < 0,
      review: r
    };
  };

  D.signatureDue = function (c) {
    var s = C.nextSignatory(c);
    if (!s) return null;
    var days = s.due_at ? D.daysBetween(D.today(), D.parse(s.due_at)) : null;
    return { due_at: s.due_at || null, days: days, overdue: days !== null && days < 0, signatory: s };
  };

  /* CT5 — may this persona sign THIS agreement? Returns the authority band that
     lets them (so the UI can name it), or null. Delegations in force today
     lend the delegator's bands to the delegate. */
  D.signerEligible = function (user, c) {
    if (!user || !c) return null;
    var amt = c.amount_usd || 0;
    var type = contractType(c);
    var rows = [];

    (S().signingAuthority || []).forEach(function (r) {
      if (r.user_id === user.id) rows.push(r);
    });
    (S().signingDelegations || []).forEach(function (d) {
      if (d.to_user_id !== user.id) return;
      if (d.start_at && TODAY() < d.start_at) return;
      if (d.end_at && TODAY() > d.end_at) return;
      (S().signingAuthority || []).forEach(function (r) {
        if (r.user_id !== d.from_user_id) return;
        var lent = {};
        Object.keys(r).forEach(function (k) { lent[k] = r[k]; });
        lent.delegated_from = d.from_user_id;
        if (d.scope && d.scope !== 'all') lent.country_scope = [].concat(d.scope);
        rows.push(lent);
      });
    });

    var hit = rows.filter(function (r) {
      if (r.country_scope && r.country_scope !== 'all' &&
          r.country_scope.indexOf(c.country) < 0) return false;
      if (r.min_usd !== undefined && r.min_usd !== null && amt < r.min_usd) return false;
      if (r.max_usd !== undefined && r.max_usd !== null && amt > r.max_usd) return false;
      if (r.types && r.types.indexOf(type) < 0) return false;
      return true;
    })[0];
    return hit || null;
  };

  function contractType(c) {
    if (c.parent_contract_id || c.template_id === 'T-AMEND') return 'amend';
    return c.partner_type || 'local';
  }

  /* S-16 — the permission overlay. The MATRIX row still decides the role half;
     everything project- and status-shaped lives here so no page ever
     role-checks inline. `action` may be given long ('contract_edit') or short
     ('edit'). 'amend' is an edit-class action on a live agreement. */
  D.canContract = function (user, action, c) {
    if (!user) return false;
    var act = String(action || '');
    if (act.indexOf('contract_') !== 0) act = 'contract_' + act;

    var row = act === 'contract_amend' ? 'contract_edit' : act;
    if (!D.can(user, row)) return false;
    if (!c) return true;

    var p = projectOf(c);
    var admin = user.role === 'admin';
    var m2    = user.role === 'm2';
    var m1    = user.role === 'm1' && inScope(user, c.country);
    var owns  = !!(p && (p.owner === user.id || p.backup === user.id));
    var scoped = admin || m2 || m1 || owns;

    switch (act) {
      case 'contract_view':
        return admin || user.role === 'ogc' || user.role === 'finance' || inScope(user, c.country);

      case 'contract_edit':
        /* draft only — an agreement returned from review lands back in draft */
        return c.status === 'draft' && scoped;

      case 'contract_submit':
        return c.status === 'draft' && (admin || m2 || m1 || (owns && user.role !== 'm3'));

      case 'contract_review':
        if (c.status !== 'in_review') return false;
        return (c.reviews || []).some(function (r) {
          return r.status === 'pending' && divisionRole(r.division) === user.role;
        });

      case 'contract_approve_sig':
        return (admin || m1) &&
               ['in_review', 'approved_for_signature'].indexOf(c.status) > -1;

      case 'contract_sign':
        if (c.status !== 'signing') return false;
        var next = C.nextSignatory(c);
        if (!next) return false;
        if (next.party === 'partner') return admin || m2 || m1;   /* wet ink, recorded */
        if (next.user_id && next.user_id !== user.id && !admin) return false;
        return !!D.signerEligible(user, c);

      case 'contract_send':
        return (admin || m2 || m1) &&
               ['executed', 'sent'].indexOf(c.status) > -1;

      case 'contract_amend':
        return scoped && CFG().CONTRACT_MET.indexOf(c.status) > -1;

      case 'contract_admin':
        return admin;

      default:
        return scoped;
    }
  };

  /* the next signature the ceremony will take: strictly by order_index, and
     only ever the first still pending (S-08 signing order). */
  C.nextSignatory = function (c) {
    if (!c) return null;
    return (c.signatories || []).slice().sort(function (a, b) {
      return a.order_index - b.order_index;
    }).filter(function (s) { return s.status === 'pending'; })[0] || null;
  };

  /* everything this persona owes right now, one row per owed action */
  D.contractsRequiringAction = function (user) {
    if (!user) return [];
    var out = [];

    /* drafting owed on a project whose gate is still todo — there is no
       contract row yet, so the row carries the project instead */
    D.visibleProjects(user, S().projects, S().countries).forEach(function (p) {
      var g = D.contractGate(p);
      if (g.state !== 'todo') return;
      if (!C.draftAllowed(p)) return;
      if (!canDraftFor(user, p)) return;
      out.push({
        contract: null, project: p, project_id: p.id, kind: 'draft',
        due_at: null, overdue: g.days !== null && g.days > CFG().CONTRACT_IDLE_DAYS,
        label: 'Draft the Corporate Agreement'
      });
    });

    D.contractsFor({ user: user }).forEach(function (c) {
      var p = projectOf(c);
      var base = { contract: c, project: p, project_id: c.project_id };

      if (c.status === 'draft' && D.canContract(user, 'contract_submit', c)) {
        out.push(row(base, 'draft', null, D.contractIdle(c), 'Complete and submit for review'));
      }

      if (c.status === 'in_review') {
        (c.reviews || []).forEach(function (r) {
          if (r.status !== 'pending') return;
          if (divisionRole(r.division) !== user.role) return;
          if (!D.can(user, 'contract_review')) return;
          var due = D.reviewDue(c, r.division);
          out.push(row(base, 'review', r.due_at, !!(due && due.overdue),
            divisionLabel(r.division) + ' review'));
        });
      }

      if (c.status === 'approved_for_signature' && D.canContract(user, 'contract_approve_sig', c)) {
        out.push(row(base, 'approve_sig', null, D.contractIdle(c), 'Start the signing ceremony'));
      }

      if (c.status === 'signing' && D.canContract(user, 'contract_sign', c)) {
        var s = C.nextSignatory(c);
        var due = D.signatureDue(c);
        out.push(row(base, 'sign', s ? (s.due_at || null) : null, !!(due && due.overdue),
          s && s.party === 'partner' ? 'Record the partner signature' : 'Sign the agreement'));
      }

      if (c.status === 'executed' && D.canContract(user, 'contract_send', c)) {
        out.push(row(base, 'send', null, D.contractIdle(c), 'Send out and record the transmittal'));
      }
    });

    return out;
  };

  function row(base, kind, due_at, overdue, label) {
    return {
      contract: base.contract, project: base.project, project_id: base.project_id,
      kind: kind, due_at: due_at || null, overdue: !!overdue, label: label
    };
  }

  /* who may open the first draft for a project that has none yet */
  function canDraftFor(user, p) {
    if (!D.can(user, 'contract_edit')) return false;
    if (user.role === 'admin' || user.role === 'm2') return true;
    if (user.role === 'm1' && inScope(user, p.country)) return true;
    return p.owner === user.id || p.backup === user.id;
  }

  D.contractBadge = function (user) {
    return D.contractsRequiringAction(user).length;
  };

  D.contractRollups = function (user) {
    var list = user ? D.contractsFor({ user: user }) : D.contractsFor();
    var byStatus = {};
    CFG().CONTRACT_STATUS_ORDER.forEach(function (k) { byStatus[k] = 0; });
    list.forEach(function (c) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    });

    var warn = CFG().CONTRACT_EXPIRY_WARN_DAYS;
    var expiringSoon = list.filter(function (c) {
      if (c.status !== 'active' || !c.end_date) return false;
      var left = D.daysBetween(D.today(), D.parse(c.end_date));
      return left !== null && left >= 0 && left <= warn;
    });

    var owed = { draft: 0, review: 0, sign: 0, send: 0 };
    D.contractsRequiringAction(user || me()).forEach(function (r) {
      if (r.kind === 'draft') owed.draft++;
      else if (r.kind === 'review') owed.review++;
      else if (r.kind === 'send') owed.send++;
      else owed.sign++;              /* approve_sig and sign are one queue */
    });

    return { byStatus: byStatus, total: list.length, expiringSoon: expiringSoon, owed: owed };
  };

  /* ====================================================== contracts hooks ===
     The two functions actions.js reaches for; both are safe to call blind. */

  C.gateMet = function (p) {
    if (!p) return true;
    if (!D.contractRequired(p)) return true;
    var c = D.primaryContract(p);
    return !!c && CFG().CONTRACT_MET.indexOf(c.status) > -1;
  };

  /* S-09 — drafting may start once the gate is open (status 3); signing needs
     status 2. The ladder counts DOWN, so "at least CONTRACT_DRAFT_FROM" is
     a status number at or below the knob. */
  C.draftAllowed = function (p) {
    if (!p || p.status === 'declined') return false;
    return typeof p.status === 'number' && p.status <= CFG().CONTRACT_DRAFT_FROM;
  };

  C.signAllowed = function (p) {
    return !!p && typeof p.status === 'number' && p.status <= 2;
  };

  /* ================================================= creation + templates ===*/

  function nextContractId() {
    var n = S().contractSeq || 1;
    S().contractSeq = n + 1;
    return 'AS-' + pad4(n);
  }

  var UN_RE   = /\b(UN|UNICEF|WFP|UNHCR|UNDP|OCHA)\b/i;
  var INGO_RE = /(CARE|Save the Children|Save|Oxfam|World Vision|Red Cross|Red Crescent)/i;

  C.partnerTypeOf = function (p) {
    var imp = (p && p.primary_implementer) || '';
    if (UN_RE.test(imp)) return 'un';
    if (INGO_RE.test(imp)) return 'ingo';
    return 'local';
  };

  C.templateFor = function (partner_type, country) {
    var list = (S().contractTemplates || []).filter(function (t) {
      if (t.status && t.status !== 'active') return false;
      if (t.id === 'T-AMEND') return false;
      if (t.partner_type_scope && t.partner_type_scope.indexOf(partner_type) < 0) return false;
      if (t.country_scope && t.country_scope !== 'all' &&
          t.country_scope.indexOf(country) < 0) return false;
      return true;
    });
    return list[0] || null;
  };

  /* CT5 — who signs for the Church on this agreement: the M1 whose authority
     covers it first, then the M2, then a partner placeholder. */
  function seedSignatories(c) {
    var picked = [], out = [], n = 0;

    ['m1', 'm2'].forEach(function (role) {
      if (picked.length >= 2) return;
      var hit = (S().users || []).filter(function (u) {
        if (u.role !== role) return false;
        if (picked.indexOf(u.id) > -1) return false;
        return !!D.signerEligible(u, c);
      })[0];
      if (hit) picked.push(hit.id);
    });

    picked.forEach(function (uid) {
      var u = CBP.userById(uid);
      out.push({
        order_index: ++n, party: 'church', user_id: uid, name: null,
        title: (u && u.title) || CFG().ROLE_LABEL[u ? u.role : ''] || '',
        method: 'click', status: 'pending', signed_at: null, due_at: null,
        authority_ok: true
      });
    });

    var p = projectOf(c);
    out.push({
      order_index: ++n, party: 'partner', user_id: null,
      name: 'Authorised signatory, ' + (c.partner || (p && p.primary_implementer) || 'partner'),
      title: 'Authorised signatory', method: 'wet_ink',
      status: 'pending', signed_at: null, due_at: null, authority_ok: true
    });
    return out;
  }

  function blankContract(p, opts) {
    opts = opts || {};
    var type = opts.partner_type || C.partnerTypeOf(p);
    var tpl  = opts.template_id ? { id: opts.template_id } : C.templateFor(type, p.country);
    var c = {
      id: nextContractId(),
      project_id: p.id,
      partner: opts.partner || p.primary_implementer || '',
      partner_type: type,
      country: p.country,
      amount: opts.amount !== undefined ? opts.amount : p.amount,
      currency: opts.currency || 'USD',
      amount_usd: opts.amount_usd !== undefined ? opts.amount_usd : p.amount,
      status: 'draft',
      template_id: tpl ? tpl.id : null,
      version_no: 1,
      versions: [{ no: 1, at: TODAY(), author: me().id,
                   summary: opts.summary || ('Initial draft from ' + (tpl ? tpl.id : 'template')) }],
      reviews: [],
      signatories: [],
      attestations: {
        supplements_local: false, no_dependency: false,
        not_primary_support: false, partner_verified: false
      },
      screening: { date: null, result: 'pending' },
      due_diligence: 'pending',
      obligations: [],
      sent_at: null,
      executed_at: null,
      parent_contract_id: opts.parent_contract_id || null,
      amendment_no: opts.amendment_no || 0,
      created_at: TODAY(),
      history: [{ at: TODAY(), from: null, to: 'draft', actor: me().id }],
      log_ids: []
    };
    c.signatories = seedSignatories(c);
    return c;
  }

  /* S-09 — idempotent. Called by A.markApproved and by the CT6 wizard; a second
     call on a project that already carries a primary agreement is a no-op (F7),
     so an early draft is never duplicated. */
  C.createFromProject = function (p, opts) {
    opts = opts || {};
    if (typeof p === 'string') p = CBP.projectById(p);
    if (!p) return { ok: false, error: 'Project not found.' };

    if (!D.contractRequired(p) && !opts.force) {
      return { ok: true, skipped: true, reason: 'not_required', contract: null };
    }
    if (p.primary_contract_id) {
      return { ok: true, skipped: true, reason: 'exists',
               id: p.primary_contract_id, contract: D.contractById(p.primary_contract_id) };
    }
    if (!C.draftAllowed(p) && !opts.force) {
      return { ok: true, skipped: true, reason: 'too_early', contract: null };
    }

    var c = blankContract(p, opts);
    S().contracts.push(c);
    p.primary_contract_id = c.id;

    log(c, 'Corporate Agreement ' + c.id + ' opened as a draft from ' +
           (c.template_id || 'template') + ' — partner ' + (c.partner || 'to be named') +
           ' · ' + D.money(c.amount_usd) + '.');

    alertKinds('A-17', p, ['owner', 'm2'],
      '[Action needed] ' + p.id + ' — Corporate Agreement drafting required',
      ['A Corporate Agreement (' + c.id + ') has been opened as a draft from ' +
       (c.template_id || 'the standard template') + '.',
       'Partner: ' + (c.partner || 'to be named') + ' · value ' + D.money(c.amount_usd) + '.',
       'The agreement must be complete and sent out before implementation can start.',
       'Open the agreement: #/contracts/' + c.id],
      { contract_id: c.id });

    /* opts.silent lets a caller that renders for itself (A.markApproved) keep
       the one-render-per-mutation rule. */
    if (!opts.silent) render();
    return { ok: true, id: c.id, contract: c, created: true };
  };

  /* ============================================================ mutations ===*/

  function fail(key, msg) {
    S().ui.err = { key: key, msg: msg };
    return { ok: false, error: msg };
  }

  function render() { if (CBP.render) CBP.render(); }

  function done(extra) {
    S().ui.err = null;
    var r = { ok: true };
    if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
    render();
    return r;
  }

  /* the one write every mutation makes: a typed entry on the project, its id
     projected onto the contract (F26). */
  function log(c, text) {
    var e = CBP.addLog(c.project_id, 'contract', text, { contract_id: c.id });
    c.log_ids = c.log_ids || [];
    c.log_ids.push(e.id);
    return e;
  }

  function setStatus(c, to) {
    if (c.status === to) return;
    c.history = c.history || [];
    c.history.push({ at: TODAY(), from: c.status, to: to, actor: me().id });
    c.status = to;
  }

  function find(id, key) {
    var c = D.contractById(id);
    if (!c) { fail(key, 'Agreement ' + id + ' not found.'); return null; }
    return c;
  }

  /* --------------------------------------------------------- CT6 wizard --- */

  A.contractCreate = function (fields) {
    fields = fields || {};
    var u = me();
    var p = CBP.projectById(fields.project_id);
    if (!p) return fail('ct6', 'Choose a project for the agreement.');
    if (!canDraftFor(u, p)) return fail('ct6', 'You cannot open a Corporate Agreement on this project.');
    if (!C.draftAllowed(p)) {
      return fail('ct6', 'Drafting opens once the project reaches status ' +
                  CFG().CONTRACT_DRAFT_FROM + '.');
    }
    if (p.primary_contract_id && !fields.amendment) {
      return fail('ct6', 'This project already has agreement ' + p.primary_contract_id +
                  '. Use Amend to change it.');
    }
    if (fields.amendment) {
      return A.contractAmend(p.primary_contract_id, fields.summary || 'Amendment');
    }

    var res = C.createFromProject(p, {
      force: true,
      partner: fields.partner,
      partner_type: fields.partner_type,
      template_id: fields.template_id,
      amount: fields.amount,
      amount_usd: fields.amount_usd,
      currency: fields.currency,
      summary: fields.summary
    });
    if (!res.ok) return fail('ct6', res.error);
    return done({ id: res.id, contract: res.contract });
  };

  /* ------------------------------------------------------------- editing --- */

  var EDITABLE = ['partner', 'partner_type', 'country', 'amount', 'amount_usd', 'currency',
                  'template_id', 'due_diligence', 'end_date', 'start_date', 'notes'];

  A.contractEdit = function (id, fields) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    var u = me();
    if (!D.canContract(u, 'contract_edit', c)) {
      return fail('contract', 'This agreement can only be edited in draft, by the drafting team.');
    }
    fields = fields || {};
    var changed = [];

    EDITABLE.forEach(function (k) {
      if (fields[k] === undefined) return;
      if (c[k] === fields[k]) return;
      c[k] = fields[k];
      changed.push(k.replace(/_/g, ' '));
    });

    if (fields.attestations) {
      c.attestations = c.attestations || {};
      Object.keys(fields.attestations).forEach(function (k) {
        if (c.attestations[k] === !!fields.attestations[k]) return;
        c.attestations[k] = !!fields.attestations[k];
        changed.push('attestation ' + k.replace(/_/g, ' '));
      });
    }
    if (fields.screening) {
      c.screening = c.screening || {};
      Object.keys(fields.screening).forEach(function (k) {
        if (c.screening[k] === fields.screening[k]) return;
        c.screening[k] = fields.screening[k];
        changed.push('screening ' + k);
      });
    }
    if (fields.obligations) { c.obligations = fields.obligations; changed.push('obligations'); }
    if (fields.partner_signatory) {
      var ps = (c.signatories || []).filter(function (s) { return s.party === 'partner'; })[0];
      if (ps) {
        if (fields.partner_signatory.name)  ps.name  = fields.partner_signatory.name;
        if (fields.partner_signatory.title) ps.title = fields.partner_signatory.title;
        changed.push('partner signatory');
      }
    }

    if (!changed.length) return fail('contract', 'Nothing changed.');
    log(c, CBP.userName(me().id) + ' edited ' + c.id + ' — ' + changed.join(' · ') + '.');
    return done({ id: c.id, changed: changed });
  };

  A.contractNewVersion = function (id, summary) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    if (!D.canContract(me(), 'contract_edit', c)) {
      return fail('contract', 'Only the drafting team can issue a new version in draft.');
    }
    summary = (summary || '').trim();
    if (!summary) return fail('contract', 'Describe what changed in this version.');

    c.version_no = (c.version_no || 0) + 1;
    c.versions = c.versions || [];
    c.versions.push({ no: c.version_no, at: TODAY(), author: me().id, summary: summary });
    log(c, CBP.userName(me().id) + ' issued version ' + c.version_no + ' of ' + c.id +
           ' — ' + summary);
    return done({ id: c.id, version_no: c.version_no });
  };

  /* -------------------------------------------------------- draft → review -- */

  /* S-08 draft-exit gate. Returns the list of unmet conditions, so CT2 can show
     the checklist and the action can refuse with the same words. */
  C.draftGaps = function (c) {
    var gaps = [];
    if (!c) return ['no agreement'];
    var att = c.attestations || {};
    ['supplements_local', 'no_dependency', 'not_primary_support', 'partner_verified']
      .forEach(function (k) {
        if (!att[k]) gaps.push('attestation: ' + k.replace(/_/g, ' '));
      });
    if (c.due_diligence !== 'verified') gaps.push('due diligence not verified');
    if (!c.screening || c.screening.result !== 'clear') gaps.push('screening not clear');
    if (!c.partner) gaps.push('partner not named');
    if (!(c.amount_usd > 0)) gaps.push('contract value missing');
    if (!c.template_id) gaps.push('template not chosen');
    return gaps;
  };

  A.contractSubmitReview = function (id) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    var u = me(), p = projectOf(c);
    if (!D.canContract(u, 'contract_submit', c)) {
      return fail('contract', 'Only the drafting team can submit a draft agreement for review.');
    }
    if (c.status !== 'draft') {
      return fail('contract', 'Only a draft agreement can be submitted for review.');
    }
    var gaps = C.draftGaps(c);
    if (gaps.length) {
      return fail('contract', 'The draft is not complete — ' + gaps.join('; ') + '.');
    }

    var due = inDays(CFG().REVIEW_SLA_DAYS);
    c.reviews = CFG().REVIEW_DIVISIONS.map(function (d) {
      var who = (S().users || []).filter(function (x) { return x.role === d.role; })[0];
      return {
        division: d.key, order_index: 1, assignee: who ? who.id : null,
        status: 'pending', due_at: due, decided_at: null, comment: ''
      };
    });
    setStatus(c, 'in_review');
    log(c, CBP.userName(u.id) + ' submitted ' + c.id + ' for review — ' +
           c.reviews.map(function (r) { return divisionLabel(r.division); }).join(' and ') +
           ' in parallel, due ' + D.fmtDateY(due) + '.');

    CFG().REVIEW_DIVISIONS.forEach(function (d) {
      alertKinds('A-18', p, [d.role],
        '[Review due] ' + c.id + ' — ' + divisionLabel(d.key) + ' review of the Corporate Agreement',
        [c.id + ' for ' + (c.partner || 'the partner') + ' is ready for ' +
         divisionLabel(d.key) + ' review.',
         'Value ' + D.money(c.amount_usd) + ' · version ' + c.version_no + '.',
         'Review due ' + D.fmtDateY(due) + ' (' + CFG().REVIEW_SLA_DAYS + ' working days).',
         'Open the agreement: #/contracts/' + c.id],
        { contract_id: c.id });
    });

    return done({ id: c.id, reviews: c.reviews.length, due_at: due });
  };

  A.reviewDecide = function (id, division, decision, comment) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    var u = me(), p = projectOf(c);
    if (c.status !== 'in_review') return fail('review', 'This agreement is not in review.');

    var r = (c.reviews || []).filter(function (x) { return x.division === division; })[0];
    if (!r) return fail('review', 'No ' + divisionLabel(division) + ' review on this agreement.');
    if (r.status !== 'pending') {
      return fail('review', divisionLabel(division) + ' already decided this version.');
    }
    if (!D.can(u, 'contract_review') && u.role !== 'admin') {
      return fail('review', 'Only a contract reviewer can decide a review.');
    }
    if (u.role !== 'admin' && divisionRole(division) !== u.role) {
      return fail('review', 'You can only decide the ' + CFG().ROLE_LABEL[u.role] + ' review.');
    }

    comment = (comment || '').trim();
    if (decision === 'return' && !comment) {
      return fail('review', 'A returned review needs a reason the drafter can act on.');
    }

    r.decided_at = TODAY();
    r.comment = comment;
    r.decided_by = u.id;

    if (decision === 'return') {
      r.status = 'returned';
      (c.reviews || []).forEach(function (x) {
        if (x.status === 'pending') { x.status = 'superseded'; x.decided_at = TODAY(); }
      });
      c.versions = c.versions || [];
      c.versions.push({
        no: c.version_no, at: TODAY(), author: u.id, returned: true,
        summary: 'Returned by ' + divisionLabel(division) + ' — ' + comment
      });
      setStatus(c, 'draft');
      log(c, divisionLabel(division) + ' returned ' + c.id + ' to draft — ' + comment);
      alertKinds('SYS-contract-returned', p, ['owner', 'm2'],
        '[Returned] ' + c.id + ' — ' + divisionLabel(division) + ' returned the agreement to draft',
        [divisionLabel(division) + ' returned ' + c.id + ' on ' + D.fmtDateY(TODAY()) + '.',
         'Reason: ' + comment,
         'Revise the draft and submit it for review again.',
         'Open the agreement: #/contracts/' + c.id],
        { contract_id: c.id });
      return done({ id: c.id, status: c.status, decision: 'return' });
    }

    r.status = 'approved';
    log(c, divisionLabel(division) + ' approved ' + c.id +
           (comment ? ' — ' + comment : '.'));

    var allApproved = (c.reviews || []).every(function (x) { return x.status === 'approved'; });
    if (allApproved) {
      setStatus(c, 'approved_for_signature');
      log(c, c.id + ' cleared every review and is approved for signature.');
      alertKinds('SYS-contract-cleared', p, ['m1', 'm2'],
        '[Ready] ' + c.id + ' — approved for signature',
        ['Every division has approved ' + c.id + '.',
         'Start the signing ceremony to collect signatures in order.',
         'Open the agreement: #/contracts/' + c.id],
        { contract_id: c.id });
    }
    return done({ id: c.id, status: c.status, decision: 'approve', allApproved: allApproved });
  };

  A.contractApproveForSignature = function (id) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    if (!D.canContract(me(), 'contract_approve_sig', c)) {
      return fail('contract', 'Only the Regional Manager or Admin approves an agreement for signature.');
    }
    if (c.status === 'approved_for_signature') return done({ id: c.id, status: c.status });
    if (c.status !== 'in_review') {
      return fail('contract', 'Only an agreement in review can be approved for signature.');
    }
    var pending = (c.reviews || []).filter(function (r) { return r.status !== 'approved'; });
    if (pending.length) {
      return fail('contract', 'Still waiting on ' +
        pending.map(function (r) { return divisionLabel(r.division); }).join(' and ') + '.');
    }
    setStatus(c, 'approved_for_signature');
    log(c, CBP.userName(me().id) + ' approved ' + c.id + ' for signature.');
    return done({ id: c.id, status: c.status });
  };

  /* ------------------------------------------------------------- signing --- */

  A.contractStartSigning = function (id) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    var u = me(), p = projectOf(c);
    if (!D.canContract(u, 'contract_approve_sig', c)) {
      return fail('contract', 'Only the Regional Manager or Admin opens the signing ceremony.');
    }
    if (c.status !== 'approved_for_signature') {
      return fail('contract', 'The agreement must be approved for signature first.');
    }
    if (!C.signAllowed(p)) {
      return fail('contract', 'Signing opens once the project is approved (status 2).');
    }

    var authorised = 0;
    (c.signatories || []).forEach(function (s) {
      if (s.party !== 'church') return;
      var su = s.user_id ? CBP.userById(s.user_id) : null;
      s.authority_ok = !!(su && D.signerEligible(su, c));
      if (s.authority_ok) authorised++;
    });
    if (!authorised) {
      return fail('contract', 'No church signatory on this agreement holds authority for ' +
                  D.money(c.amount_usd) + ' in ' + countryName(c.country) + '.');
    }

    var due = inDays(CFG().SIGN_SLA_DAYS);
    (c.signatories || []).forEach(function (s) {
      if (s.status === 'pending') s.due_at = due;
    });
    setStatus(c, 'signing');
    log(c, CBP.userName(u.id) + ' opened the signing ceremony for ' + c.id +
           ' — signatures due ' + D.fmtDateY(due) + '.');

    var next = C.nextSignatory(c);
    var to = (next && next.user_id) ? [next.user_id] : A.recipients(p, ['m2']);
    alertIds('A-19', p, to,
      '[Signature due] ' + c.id + ' — Corporate Agreement ready for signature',
      [c.id + ' for ' + (c.partner || 'the partner') + ' is ready to sign.',
       'Signature order: ' + (c.signatories || []).map(function (s) {
         return s.order_index + '. ' + (s.user_id ? CBP.userName(s.user_id) : s.name);
       }).join(' · '),
       'Signatures due ' + D.fmtDateY(due) + '.',
       'Open the signing ceremony: #/contracts/' + c.id],
      { contract_id: c.id });

    return done({ id: c.id, status: c.status, due_at: due });
  };

  A.contractSign = function (id, order_index, opts) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    var u = me(), p = projectOf(c);
    opts = opts || {};
    if (c.status !== 'signing') return fail('sign', 'The agreement is not open for signature.');

    var next = C.nextSignatory(c);
    if (!next) return fail('sign', 'Every signature on this agreement is already recorded.');
    if (order_index !== undefined && order_index !== null && +order_index !== next.order_index) {
      return fail('sign', 'Signatures are taken in order — signatory ' + next.order_index +
                  ' (' + (next.user_id ? CBP.userName(next.user_id) : next.name) + ') is next.');
    }
    if (opts.intent !== true) {
      return fail('sign', 'Confirm your intent to be bound before signing.');
    }
    if (!D.canContract(u, 'contract_sign', c)) {
      return next.party === 'partner'
        ? fail('sign', 'Only the Area Manager, Regional Manager or Admin records a partner signature.')
        : fail('sign', 'You do not hold signing authority for ' + D.money(c.amount_usd) +
                       ' in ' + countryName(c.country) + '.');
    }

    next.status = 'signed';
    next.signed_at = TODAY();
    if (next.party === 'church') {
      var band = D.signerEligible(u, c);
      next.authority_ok = !!band;
      if (band && band.delegated_from) next.delegated_from = band.delegated_from;
      next.method = next.method || 'click';
      log(c, CBP.userName(u.id) + ' signed ' + c.id + ' as signatory ' + next.order_index +
             ' of ' + (c.signatories || []).length + '.');
    } else {
      next.method = next.method || 'wet_ink';
      next.recorded_by = u.id;
      log(c, CBP.userName(u.id) + ' recorded the partner signature on ' + c.id + ' — ' +
             next.name + (opts.ref ? ' · ' + opts.ref : '') + '.');
    }

    var allSigned = (c.signatories || []).every(function (s) { return s.status === 'signed'; });
    if (allSigned) {
      c.executed_at = TODAY();
      setStatus(c, 'executed');
      log(c, c.id + ' is fully executed — every signature recorded on ' +
             D.fmtDateY(TODAY()) + '.');
      alertKinds('SYS-contract-executed', p, ['owner', 'm2'],
        '[Executed] ' + c.id + ' — every signature recorded',
        [c.id + ' was executed on ' + D.fmtDateY(TODAY()) + '.',
         'Send the agreement out to the partner and record the transmittal to close the gate.',
         'Open the agreement: #/contracts/' + c.id],
        { contract_id: c.id });
    }

    return done({ id: c.id, status: c.status, signed: next.order_index, executed: allSigned });
  };

  A.contractDecline = function (id, order_index, reason) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    var u = me(), p = projectOf(c);
    if (c.status !== 'signing') return fail('sign', 'The agreement is not open for signature.');
    reason = (reason || '').trim();
    if (!reason) return fail('sign', 'A declined signature needs a reason.');

    var s = (c.signatories || []).filter(function (x) {
      return x.order_index === +order_index;
    })[0] || C.nextSignatory(c);
    if (!s) return fail('sign', 'Signatory not found.');
    if (!D.canContract(u, 'contract_sign', c)) {
      return fail('sign', 'You cannot act on this signature.');
    }

    s.status = 'declined';
    s.decline_reason = reason;
    s.declined_at = TODAY();
    (c.signatories || []).forEach(function (x) { if (x.status === 'signed') return; x.due_at = null; });
    setStatus(c, 'draft');
    log(c, CBP.userName(u.id) + ' declined to sign ' + c.id + ' — ' + reason +
           '. The agreement returns to draft.');
    alertKinds('SYS-contract-declined', p, ['owner', 'm2', 'm1'],
      '[Declined] ' + c.id + ' — a signature was declined',
      [(s.user_id ? CBP.userName(s.user_id) : s.name) + ' declined to sign ' + c.id + '.',
       'Reason: ' + reason,
       'The agreement is back in draft.',
       'Open the agreement: #/contracts/' + c.id],
      { contract_id: c.id });

    return done({ id: c.id, status: c.status });
  };

  /* ------------------------------------------------------- sending out ----- */

  A.contractMarkSent = function (id, meta) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    var u = me(), p = projectOf(c);
    meta = meta || {};
    if (!D.canContract(u, 'contract_send', c)) {
      return fail('contract', 'Only the Area Manager, Regional Manager or Admin sends an agreement out.');
    }
    if (c.status !== 'executed') {
      return fail('contract', 'Only a fully executed agreement can be sent out.');
    }

    c.sent_at = TODAY();
    c.sent_channel  = meta.channel || 'email';
    c.sent_ref      = meta.ref || null;
    c.sent_evidence = meta.evidence || null;
    setStatus(c, 'sent');
    log(c, CBP.userName(u.id) + ' sent ' + c.id + ' out to ' + (c.partner || 'the partner') +
           ' via ' + c.sent_channel + (c.sent_ref ? ' · ref ' + c.sent_ref : '') + '.');

    /* S-11 — mirror the reference outward when EGC is present and the system is
       not in Manual mode. A failed op never blocks the ladder. */
    var sync = null;
    if (CBP.egc && typeof A.enqueueSync === 'function') {
      if (!D.syncMode || D.syncMode('chas') !== 'manual') {
        sync = A.enqueueSync(p, 'chas', 'contract_sent',
          { contract_id: c.id, ref: c.sent_ref, sent_at: c.sent_at });
      }
    }

    /* S-10 — an amendment being sent puts its parent back to active */
    if (c.parent_contract_id) {
      var parent = D.contractById(c.parent_contract_id);
      if (parent && parent.status === 'amending') {
        setStatus(parent, 'active');
        log(parent, 'Amendment ' + c.id + ' was sent out — ' + parent.id +
                    ' returns to active.');
      }
    }

    alertKinds('A-21', p, ['owner', 'm1', 'm2'],
      '[Sent out] ' + c.id + ' — Corporate Agreement sent to the partner',
      [c.id + ' was sent to ' + (c.partner || 'the partner') + ' on ' +
       D.fmtDateY(TODAY()) + ' via ' + c.sent_channel + '.',
       c.sent_ref ? 'Transmittal reference: ' + c.sent_ref : 'No transmittal reference recorded.',
       sync ? 'CHaS mirror queued (' + sync.id + ').'
            : 'Record the agreement reference in CHaS from the project page.',
       'The contract gate is met — implementation can start.',
       'Open the agreement: #/contracts/' + c.id],
      { contract_id: c.id });

    return done({ id: c.id, status: c.status, sync: sync });
  };

  A.contractActivate = function (id) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    var u = me();
    if (!D.canContract(u, 'contract_send', c)) {
      return fail('contract', 'Only the Area Manager, Regional Manager or Admin activates an agreement.');
    }
    if (c.status !== 'sent') {
      return fail('contract', 'Only an agreement that has been sent out can be made active.');
    }
    setStatus(c, 'active');
    log(c, CBP.userName(u.id) + ' marked ' + c.id +
           ' active — countersigned copy received from ' + (c.partner || 'the partner') + '.');
    return done({ id: c.id, status: c.status });
  };

  /* ---------------------------------------------------------- amendments --- */

  A.contractAmend = function (id, summary) {
    var parent = find(id, 'contract'); if (!parent) return { ok: false, error: 'not found' };
    var u = me(), p = projectOf(parent);
    if (!D.canContract(u, 'contract_amend', parent)) {
      return fail('contract', 'Only a live agreement can be amended, by the drafting team.');
    }
    summary = (summary || '').trim() || 'Amendment to ' + parent.id;

    var no = D.contractChildren(parent).length + 1;
    var c = blankContract(p, {
      force: true,
      partner: parent.partner,
      partner_type: parent.partner_type,
      template_id: 'T-AMEND',
      amount: parent.amount,
      amount_usd: parent.amount_usd,
      currency: parent.currency,
      parent_contract_id: parent.id,
      amendment_no: no,
      summary: 'Amendment ' + no + ': ' + summary
    });
    /* an amendment inherits the compliance work already done on the parent */
    c.attestations  = JSON.parse(JSON.stringify(parent.attestations || {}));
    c.screening     = JSON.parse(JSON.stringify(parent.screening || {}));
    c.due_diligence = parent.due_diligence;
    S().contracts.push(c);

    setStatus(parent, 'amending');
    log(c, CBP.userName(u.id) + ' opened amendment ' + no + ' (' + c.id + ') to ' +
           parent.id + ' — ' + summary);
    log(parent, parent.id + ' is being amended by ' + c.id + ' — ' + summary);

    alertKinds('A-17', p, ['owner', 'm2'],
      '[Action needed] ' + p.id + ' — amendment ' + c.id + ' drafting required',
      ['Amendment ' + no + ' to ' + parent.id + ' has been opened as a draft.',
       'Change: ' + summary,
       'The original agreement stays in force until the amendment is sent out.',
       'Open the amendment: #/contracts/' + c.id],
      { contract_id: c.id });

    return done({ id: c.id, contract: c, parent: parent.id, amendment_no: no });
  };

  /* ------------------------------------------------- cancel + terminate ---- */

  A.contractCancel = function (id, reason) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    var u = me();
    if (!(u.role === 'admin' || u.role === 'm1' || u.role === 'm2') ||
        !D.can(u, 'contract_submit')) {
      return fail('contract', 'Only the Area Manager, Regional Manager or Admin cancels an agreement.');
    }
    if (['sent', 'active', 'amending'].indexOf(c.status) > -1) {
      return fail('contract', 'An agreement already sent out is terminated, not cancelled.');
    }
    reason = (reason || '').trim();
    if (!reason) return fail('contract', 'A cancelled agreement needs a reason.');

    setStatus(c, 'cancelled');
    c.cancel_reason = reason;
    var p = projectOf(c);
    if (p && p.primary_contract_id === c.id) p.primary_contract_id = null;
    log(c, CBP.userName(u.id) + ' cancelled ' + c.id + ' — ' + reason);
    return done({ id: c.id, status: c.status });
  };

  A.contractTerminate = function (id, reason) {
    var c = find(id, 'contract'); if (!c) return { ok: false, error: 'not found' };
    var u = me();
    if (!D.can(u, 'contract_approve_sig')) {
      return fail('contract', 'Only the Regional Manager or Admin terminates a live agreement.');
    }
    if (['sent', 'active', 'amending'].indexOf(c.status) < 0) {
      return fail('contract', 'Only a live agreement can be terminated.');
    }
    reason = (reason || '').trim();
    if (!reason) return fail('contract', 'A terminated agreement needs a reason.');

    setStatus(c, 'terminated');
    c.terminated_at = TODAY();
    c.terminate_reason = reason;
    log(c, CBP.userName(u.id) + ' terminated ' + c.id + ' — ' + reason);
    return done({ id: c.id, status: c.status });
  };

  /* ============================================== admin: CT4 + CT5 tables ===*/

  A.templateSet = function (id, fields) {
    if (!D.can(me(), 'contract_admin')) {
      return fail('ct4', 'Only Admin maintains the agreement templates.');
    }
    fields = fields || {};
    S().contractTemplates = S().contractTemplates || [];
    var t = S().contractTemplates.filter(function (x) { return x.id === id; })[0];
    if (!t) {
      t = { id: id, name: id, partner_type_scope: ['local'], country_scope: 'all',
            version: '1.0', status: 'active', tokens: [], clauses: [] };
      S().contractTemplates.push(t);
    }
    Object.keys(fields).forEach(function (k) { if (k !== 'id') t[k] = fields[k]; });
    return done({ id: t.id, template: t });
  };

  A.authoritySet = function (user_id, fields) {
    if (!D.can(me(), 'contract_admin')) {
      return fail('ct5', 'Only Admin maintains signing authority.');
    }
    fields = fields || {};
    S().signingAuthority = S().signingAuthority || [];
    var r = S().signingAuthority.filter(function (x) { return x.user_id === user_id; })[0];
    if (fields.remove) {
      S().signingAuthority = S().signingAuthority.filter(function (x) {
        return x.user_id !== user_id;
      });
      return done({ user_id: user_id, removed: true });
    }
    if (!r) {
      var u = CBP.userById(user_id);
      r = { user_id: user_id, role: u ? u.role : null, country_scope: 'all',
            min_usd: 0, max_usd: null, types: ['un', 'ingo', 'local', 'amend'] };
      S().signingAuthority.push(r);
    }
    Object.keys(fields).forEach(function (k) { if (k !== 'user_id') r[k] = fields[k]; });
    return done({ user_id: user_id, authority: r });
  };

  A.delegationSet = function (rowIn) {
    if (!D.can(me(), 'contract_admin')) {
      return fail('ct5', 'Only Admin maintains signing delegations.');
    }
    rowIn = rowIn || {};
    S().signingDelegations = S().signingDelegations || [];
    if (rowIn.remove) {
      S().signingDelegations = S().signingDelegations.filter(function (d) {
        return !(d.from_user_id === rowIn.from_user_id && d.to_user_id === rowIn.to_user_id);
      });
      return done({ removed: true });
    }
    if (!rowIn.from_user_id || !rowIn.to_user_id) {
      return fail('ct5', 'A delegation needs both a delegator and a delegate.');
    }
    var d = S().signingDelegations.filter(function (x) {
      return x.from_user_id === rowIn.from_user_id && x.to_user_id === rowIn.to_user_id;
    })[0];
    if (!d) {
      d = { from_user_id: rowIn.from_user_id, to_user_id: rowIn.to_user_id,
            scope: 'all', start_at: TODAY(), end_at: null, approved_by: me().id };
      S().signingDelegations.push(d);
    }
    Object.keys(rowIn).forEach(function (k) { d[k] = rowIn[k]; });
    d.approved_by = d.approved_by || me().id;
    return done({ delegation: d });
  };

})();
