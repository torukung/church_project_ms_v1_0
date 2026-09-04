/* ui.js — shared components. Every function returns an HTML string; pages
   compose them and app.js writes the result in one pass. */
(function () {
  'use strict';
  var U = {};
  CBP.ui = U;
  var D = CBP.D;

  U.esc = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };
  var e = U.esc;

  /* ------------------------------------------------------- C-13 pill ---- */

  U.statusPill = function (status) {
    var s = CBP.CONFIG.STATUS[status] || CBP.CONFIG.STATUS.declined;
    return '<span class="pill p-' + s.key + '"><span class="dot"></span>' + e(s.label) + '</span>';
  };

  /* --------------------------------------------------- C-17 progress ---- */

  U.progressBar = function (project) {
    var pr = D.progress(project);
    if (pr.mode === 'bar') {
      return '<span class="prog"><span class="pb ' + (pr.tone || '') + '">' +
             '<i style="width:' + Math.round(pr.pct) + '%"></i></span>' +
             '<span class="pc">' + e(pr.label) + '</span></span>';
    }
    if (pr.mode === 'na') {
      return '<span class="prog"><span class="na">' + e(pr.label) + '</span></span>';
    }
    return '<span class="prog"><span class="na">—</span></span>';
  };

  /* --------------------------------------------- attention pill / cell -- */

  U.attentionPill = function (text, severity) {
    return '<span class="tagpill ' + (severity || '') + '">' + e(text) + '</span>';
  };

  /* C-03 aligned budget bar (v1.0.1 helper the change packs relied on; restored
     in v1.1.0 because the base ui.js never shipped it). pct is a coverage %,
     scale is the shared column scale from D.barScale so the 100% rule lands on
     the same x for every row. opts: { scale, sm, label, title } */
  U.budgetBar = function (pct, opts) {
    opts = opts || {};
    var v = D.barPct(pct);
    var scale = (typeof opts.scale === 'number' && opts.scale > 0) ? opts.scale : D.barScale([v]);
    var cls = D.coverageClass(v);
    var fillW = Math.min(v, 100) / scale * 100;
    var overW = v > 100 ? (Math.min(v, scale) - 100) / scale * 100 : 0;
    var rule = 100 / scale * 100;
    var html = '<span class="ubar-wrap' + (opts.sm ? ' sm' : '') + '"' +
      (opts.title ? ' title="' + e(opts.title) + '"' : '') + '>' +
      '<span class="ubar">' +
        '<span class="ubar-fill' + (cls ? ' ' + cls : '') + '" style="width:' + fillW.toFixed(2) + '%"></span>' +
        (overW > 0 ? '<span class="ubar-over" style="left:' + rule.toFixed(2) + '%;width:' + overW.toFixed(2) + '%"></span>' : '') +
        '<span class="ubar-rule" style="left:' + rule.toFixed(2) + '%"></span>' +
      '</span>';
    if (opts.label !== false) {
      html += '<span class="ubar-val num' + (cls === 'over' ? ' neg' : '') + '">' + e(D.pct(v)) + '</span>';
    }
    return html + '</span>';
  };

  /* ============================== v1.1.0 · C-21 country chips (S-12) ======
     Promoted from pages/p3.js so P12 (Contracts) and any later surface reuse
     ONE component. Each surface owns its state key and data-act namespace:
       U.countryChips({ state, stateKey:'p12Countries', actPrefix:'p12',
                        codes, counts:{code:n}, label:'Countries', hint })
     emits .cselect > .cchip.cc-xxx.ccsel with data-act="<prefix>-country" /
     "<prefix>-countries-all". Tint binds to the .ccsel class (F13), not the act.
     The dashboard C-20 scope engine in widgets.js is a different component and
     is deliberately untouched (F14). P3 keeps its own listener + key. */
  var FLAG = { BGD: '🇧🇩', NPL: '🇳🇵', KHM: '🇰🇭', IND: '🇮🇳', MMR: '🇲🇲', LAO: '🇱🇦', HKG: '🇭🇰' };
  U.flagOf = function (code) { return FLAG[String(code || '').toUpperCase()] || ''; };
  U.ccOf = function (code) {
    var k = String(code || '').toUpperCase();
    return FLAG[k] ? 'cc-' + k.toLowerCase() : 'cc-x';
  };
  U.flagMark = function (code) {
    var f = U.flagOf(code);
    return f ? '<span class="ccflag" aria-hidden="true">' + f + '</span>' : '';
  };
  /* self-repairing selection: null = all; drops codes that left the scope */
  U.selectedCodes = function (state, stateKey, codes) {
    var sel = state.ui[stateKey];
    if (!sel || Object.prototype.toString.call(sel) !== '[object Array]' || !sel.length) {
      state.ui[stateKey] = null; return codes.slice();
    }
    var keep = codes.filter(function (c) { return sel.indexOf(c) > -1; });
    if (!keep.length || keep.length === codes.length) { state.ui[stateKey] = null; return codes.slice(); }
    if (keep.length !== sel.length) state.ui[stateKey] = keep;
    return keep;
  };
  U.toggleCountry = function (state, stateKey, codes, code) {
    if (codes.indexOf(code) === -1) return;
    var sel = state.ui[stateKey];
    if (!sel || Object.prototype.toString.call(sel) !== '[object Array]' || !sel.length) {
      state.ui[stateKey] = [code]; return;
    }
    var next = codes.filter(function (c) { return c === code ? sel.indexOf(c) === -1 : sel.indexOf(c) > -1; });
    state.ui[stateKey] = (!next.length || next.length === codes.length) ? null : next;
  };
  U.countryChips = function (o) {
    var state = o.state, codes = o.codes || [], counts = o.counts || {};
    var sel = U.selectedCodes(state, o.stateKey, codes);
    var all = sel.length === codes.length;
    var chips = '<button class="cchip' + (all ? ' on' : '') + '" data-act="' + e(o.actPrefix) +
      '-countries-all" aria-pressed="' + (all ? 'true' : 'false') + '">All countries <span class="n num">' +
      codes.length + '</span></button>';
    chips += codes.map(function (code) {
      var c = state.countries.filter(function (x) { return x.code === code; })[0];
      var on = !all && sel.indexOf(code) > -1;
      var n = counts[code] === undefined ? '' : ' <span class="n num">' + counts[code] + '</span>';
      return '<button class="cchip ccsel ' + U.ccOf(code) + (on ? ' on' : '') + '" data-act="' + e(o.actPrefix) +
        '-country" data-c="' + e(code) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        U.flagMark(code) + e(c ? c.name : code) + n + '</button>';
    }).join('');
    return '<div class="cselect" role="group" aria-label="Filter by country">' +
      '<span class="cslab">' + e(o.label || 'Countries') + '</span>' + chips +
      (o.hint === false ? '' : '<span class="cshint">' + e(o.hint || (all ? 'Showing every country in your scope.' : 'Totals below follow this selection.')) + '</span>') +
      '</div>';
  };

  U.coverageCell = function (coverage) {
    if (coverage === null || coverage === undefined) {
      return '<span class="covcell"><span class="covbar"><i style="width:0"></i></span>' +
             '<span class="cv">—</span></span>';
    }
    var cls = D.coverageClass(coverage);
    var val = cls === 'over'
      ? '<span class="cv neg num">' + D.pct(coverage) + '</span>'
      : '<span class="cv num">' + D.pct(coverage) + '</span>';
    return '<span class="covcell"><span class="covbar ' + cls + '">' +
           '<i style="width:' + Math.min(coverage, 100) + '%"></i></span>' + val + '</span>';
  };

  /* ------------------------------------------------------ card / kpi ---- */

  U.card = function (title, body, opts) {
    opts = opts || {};
    var h = title
      ? '<h2>' + e(title) + (opts.more ? '<span class="more">' + e(opts.more) + '</span>' : '') + '</h2>'
      : '';
    return '<section class="card' + (opts.cls ? ' ' + opts.cls : '') + '">' + h + body + '</section>';
  };

  U.kpi = function (label, value, sub, alert) {
    return '<div class="kpi ' + (alert ? 'alert' : 'ok') + '">' +
           '<div class="k">' + e(label) + '</div>' +
           '<div class="v num">' + e(value) + '</div>' +
           '<div class="d">' + e(sub) + '</div></div>';
  };

  U.kpiRow = function (kpis) {
    return '<div class="kpis">' + kpis.join('') + '</div>';
  };

  /* ------------------------------------------------------- C-04 table --- */

  U.table = function (cols, rows) {
    var head = cols.map(function (c) {
      return '<th' + (c.right ? ' class="r"' : '') + '>' + e(c.label) + '</th>';
    }).join('');
    return '<div class="tblwrap"><table class="tbl"><thead><tr>' + head +
           '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  };

  /* ------------------------------------------- C-16 one-line stepper ----
     v1.2.0 · T-08 — the five/six-pill C-16 ladder and its two-pill declined
     early return are gone; U.stepper now lives in the FLOW block at the foot of
     this file and renders exactly four rungs from D.rungOf(p). U.stepline is
     kept as the generic pill-row renderer for anything that still wants one. */

  U.stepline = function (steps) {
    var out = '<div class="stepline">';
    steps.forEach(function (s, i) {
      if (i) out += '<span class="conn' + (steps[i - 1].st === 'ok' ? ' ok' : '') + '"></span>';
      out += '<span class="sl ' + s.st + '"><span class="mk">' + e(s.mark) + '</span>' +
             '<b>' + e(s.label) + '</b>' +
             (s.sub ? ' <small>' + e(s.sub) + '</small>' : '') + '</span>';
    });
    return out + '</div>';
  };

  /* =========================== v1.1.0 · C-15b one gate step (EGC · §2) =====
     ONE fragment for a single system's gate state, used by the P3 panel, the
     P4 gate tracker, the P6 inbox cards and P10, so no two surfaces can tell a
     different story about the same gate (S-01). It renders what is known and
     nothing else:

       state pill · source chip · reference · deep link · outbound sync chip

     opts: { compact:true } drops the sub-line and the deep link label prose;
           { label:false }   drops the system name (the caller already printed it).
     The retry control appears only for the area office (D.can 'integrations'). */

  var GS_SOURCE = {
    manual: 'manual',
    portal: 'via portal',
    sim:    'via sim',
    excel:  'excel import',
    email:  'via e-mail',
    flow:   'via flow',
    rest:   'via API'
  };

  var GS_OP = {
    lodge: 'lodge',
    contract_sent: 'contract ref',
    reconcile: 'reconcile',
    status_mirror: 'status mirror'
  };

  U.gateStep = function (p, sys, opts) {
    opts = opts || {};
    var g = D.gateSystem(p, sys);
    var user = CBP.state.user;

    var pill, sub;
    if (g.state === 'approved') {
      pill = '<span class="p4-gp ok">approved ✓</span>';
      sub = (g.submitted_at && g.approved_at)
        ? 'submitted ' + D.fmtDateY(g.submitted_at) + ' → approved ' + D.fmtDateY(g.approved_at) +
          ' · <b class="num">' + D.days(g.days) + '</b>'
        : (g.approved_at ? 'approved ' + D.fmtDateY(g.approved_at)
                         : 'cleared before the demo window');
    } else if (g.state === 'waiting') {
      pill = '<span class="p4-gp ' + (g.overdue ? 'hot' : 'wait') + '">waiting <span class="num">' +
             D.days(g.days) + '</span></span>';
      sub = 'submitted ' + D.fmtDateY(g.submitted_at) + ', no approval yet' +
            (g.overdue ? ' · past the ' + CBP.CONFIG.GATE_THRESHOLD_DAYS + '-day threshold' : '');
    } else {
      pill = '<span class="p4-gp todo">not lodged</span>';
      sub = 'nothing lodged with this system yet';
    }

    /* who said so — the last audit row for the step this pill is showing */
    var step = g.state === 'approved' ? 'approved' : 'submitted';
    var src = D.gateSource ? D.gateSource(p, sys, step) : null;
    var bits = [];

    if (src) {
      bits.push('<span class="gs-src' + (src.confidence === 'advisory' ? ' adv' : '') + '">' +
        e(GS_SOURCE[src.source] || src.source) +
        (src.confidence === 'advisory' ? ' · advisory' : '') + '</span>');
    } else if (g.state !== 'todo') {
      bits.push('<span class="gs-src">manual</span>');
    }

    var ref = g.ref || (src && src.ref) || null;
    if (ref) bits.push('<span class="gs-ref num">ref ' + e(ref) + '</span>');

    /* S-06 — the outbound queue, shown wherever the gate shows */
    var q = D.syncFor ? D.syncFor(p, sys) : null;
    if (q) {
      var cls = q.status === 'ok' ? 'ok' : (q.status === 'failed' ? 'failed' : 'queued');
      bits.push('<span class="gs-sync ' + cls + '" title="' + e(q.err || q.id) + '">sync ' +
        e(GS_OP[q.op] || q.op) + ' · ' + e(q.status) + '</span>');
      if (q.status === 'failed' && D.can(user, 'integrations')) {
        bits.push('<button class="btn sm" data-act="p4g-retry" data-id="' + e(q.id) +
          '">Retry</button>');
      }
    }

    /* S-07 — a deep link is offered in every mode, whenever one can be built */
    var url = D.deepLink ? D.deepLink(p, sys) : null;
    if (url) {
      bits.push('<a class="gs-link" href="' + e(url) + '" target="_blank" rel="noopener">' +
        'Open in ' + e(g.label) + ' ↗</a>');
    }

    return '<div class="gs">' +
      '<div class="gs-hd">' +
        (opts.label === false ? '' : '<b>' + e(g.label) + '</b>') + pill +
        (opts.mode === false ? '' : '<span class="gs-mode">' +
          e(D.syncMode ? D.syncMode(sys) : 'manual') + '</span>') +
      '</div>' +
      (bits.length ? '<div class="gs-line">' + bits.join('') + '</div>' : '') +
      (opts.compact ? '' : '<div class="gs-sub">' + sub +
        (g.remark ? '<em class="p4-grem">Remark: ' + e(g.remark) + '</em>' : '') + '</div>') +
      '</div>';
  };

  /* ------------------------------------------------------- C-06 gantt --- */

  U.gantt = function (p) {
    var m = D.ganttModel(p);
    if (!m) return '';
    var L = 'var(--gantt-label)';
    var pos = function (u) {
      return 'calc(' + L + ' + (100% - ' + L + ') * ' + (u / m.cells) + ')';
    };

    var html = '<div class="gantt"><div class="gantt-scroll"><div class="gantt-inner">';

    if (m.todayUnit !== null) {
      html += '<div class="today" style="left:' + pos(m.todayUnit) + '"></div>' +
              '<div class="today-pill" style="left:' + pos(m.todayUnit) + '">' +
              e(m.todayLabel) + '</div>';
    }

    html += '<div class="gm"><div class="gl">Phase</div><div class="mrow">' +
            m.heads.map(function (h) { return '<div class="mh">' + e(h) + '</div>'; }).join('') +
            '</div></div>';

    m.bars.forEach(function (b) {
      var pctTxt = b.planned ? 'planned' : D.pct(b.pct);
      var fill = (!b.planned && b.pct > 0)
        ? '<div class="fill' + (b.pct >= 100 ? ' full' : '') + '" style="width:' +
          Math.min(100, Math.round(b.pct)) + '%"></div>' : '';
      /* D-14 — the owner's name shows under each phase label on the Gantt */
      html += '<div class="grow2" title="' +
              e(b.label + ' · ' + D.fmtDate(b.start) + ' – ' + D.fmtDate(b.end)) + '">' +
              '<div class="gl"><b>' + e(b.label) + '</b>' +
              '<small>' + e(b.owner ? CBP.userName(b.owner) : 'unassigned') + '</small></div>' +
              '<div class="track"><div class="bar ' +
              (b.planned ? 'plan' : b.variant) + '" style="grid-column:' + b.col +
              '/span ' + b.span + '">' + fill + '<i></i><span>' +
              e(b.label + ' · ' + pctTxt) + '</span></div></div></div>';
    });

    return html + '</div></div></div>';
  };

  /* ------------------------------------------------------- C-12 modal --- */

  U.modal = function (title, body, acts) {
    return '<div class="modal-wrap" data-act="modal-close"><div class="modal">' +
           '<h3>' + e(title) + '</h3>' + body +
           '<div class="acts">' + (acts || '') + '</div></div></div>';
  };

  /* ----------------------------------------------------- misc helpers --- */

  U.btn = function (label, opts) {
    opts = opts || {};
    return '<button class="btn' + (opts.brass ? ' brass' : '') + (opts.sm ? ' sm' : '') +
           (opts.action ? ' act' : '') + '"' +
           (opts.act ? ' data-act="' + e(opts.act) + '"' : '') +
           (opts.id ? ' data-id="' + e(opts.id) + '"' : '') +
           (opts.disabled ? ' disabled' : '') + '>' + e(label) + '</button>';
  };

  /* an action control — rendered only when can() says so */
  U.action = function (user, permission, project, label, opts) {
    if (!D.can(user, permission, project)) return '';
    opts = opts || {};
    opts.action = true;
    opts.act = opts.act || 'phaseb';
    opts.id = project ? project.id : '';
    return U.btn(label, opts);
  };

  U.phaseTag = function (phase) {
    return '<span class="phasetag">Phase ' + e(phase) + '</span>';
  };

  /* === v1.2.0 FLOW === =====================================================
     WP2 · the flow render layer. Everything here draws what D.rungOf,
     D.needsYou, D.projectTaskList, D.chainFor and D.portfolio derive — no page
     computes a rung, a wait or a chain of its own from now on. */

  /* ------------------------------------------------------- rung sub-line -- */

  /* the html of every line D.rungOf put under the current rung. A gate line
     names its systems and U.gateStep draws the source chip + deep link for each
     (T-08); derive never builds that markup itself. */
  U.rungSubline = function (p) {
    var r = D.rungOf(p);
    return r.sub.map(function (s) {
      var line = '<span class="sl-line' + (s.tone ? ' ' + s.tone : '') + '">' +
        (s.chip || '') + e(s.text) + '</span>';
      if (s.systems && s.systems.length) {
        var open = s.systems.filter(function (k) {
          var g = D.gateSystem(p, k);
          return g.state !== 'todo';
        });
        if (open.length) {
          line += '<span class="sl-gates">' + open.map(function (k) {
            return U.gateStep(p, k, { compact: true, mode: false });
          }).join('') + '</span>';
        }
      }
      return line;
    }).join('');
  };

  /* the same wording with no markup — e-mail bodies and the digest read this */
  U.rungSublineText = function (p) {
    return D.rungOf(p).sub.map(function (s) { return s.text; })
      .filter(function (t) { return !!t; }).join('\n');
  };

  /* ------------------------------------------------- T-08 four-rung stepper */

  var RUNG_MARK = { ok: '✓', wait: '◷', todo: '◻', dead: '✕' };

  function rungState(r, n) {
    if (r.declined) {
      if (n > r.diedAt) return 'ok';
      if (n === r.diedAt) return 'dead';
      return 'todo';
    }
    if (n > r.n) return 'ok';            /* the ladder counts down: 4 → 1 */
    if (n === r.n) return n === 1 ? 'ok' : 'wait';
    return 'todo';
  }

  /* the small print under one pill — dates only, never a second sub-line */
  function rungPillSub(p, n, st) {
    if (n === 4) {
      if (st === 'ok') return p.submitted_at ? 'submitted ' + D.fmtDate(p.submitted_at) : 'recorded';
      if (st === 'dead') return 'never submitted';
      return p.target_date ? 'target ' + D.fmtDate(p.target_date) : 'not submitted';
    }
    if (n === 3) {
      if (st === 'ok') return p.gate_opened_at ? 'gate opened ' + D.fmtDate(p.gate_opened_at)
                                               : 'advanced to the gate';
      if (st === 'dead') return p.declined_at ? 'declined ' + D.fmtDate(p.declined_at) : 'declined';
      if (st === 'wait') return p.submitted_at ? 'submitted ' + D.fmtDate(p.submitted_at)
                                               : 'in review';
      return '';
    }
    if (n === 2) {
      if (st === 'ok' || st === 'wait') {
        return p.approved_at ? 'approved ' + D.fmtDate(p.approved_at) : 'marked approved';
      }
      if (st === 'dead') return p.declined_at ? 'declined ' + D.fmtDate(p.declined_at) : 'declined';
      return '';
    }
    if (st === 'ok') {
      return p.implementation_date ? 'started ' + D.fmtDate(p.implementation_date) : 'in implementation';
    }
    if (st === 'dead') return p.declined_at ? 'declined ' + D.fmtDate(p.declined_at) : 'declined';
    return '';
  }

  /* EXACTLY four pills, always — a declined project shows the rung it died at
     struck through with a Declined tag rather than a two-pill early return
     (T-08 / F15). The sub-line under the current rung comes from
     U.rungSubline, which reads the same D.rungOf(p). */
  U.stepper = function (p) {
    var r = D.rungOf(p);
    var labels = CBP.CONFIG.RUNG_LABELS || {};
    var prev = null;
    var out = '<div class="stepline">';

    D.RUNGS.forEach(function (n, i) {
      var st = rungState(r, n);
      var cur = (n === r.n);
      if (i) out += '<span class="conn' + (prev === 'ok' ? ' ok' : '') + '"></span>';
      var cls = (st === 'dead' ? 'wait sl-dead' : st) + (cur ? ' sl-cur' : '');
      var label = labels[n] || String(n);
      var sub = rungPillSub(p, n, st);
      out += '<span class="sl ' + cls + '"><span class="mk">' + e(RUNG_MARK[st]) + '</span>' +
        '<b>' + (st === 'dead' ? '<s>' + e(label) + '</s>' : e(label)) + '</b>' +
        (st === 'dead' ? '<span class="sl-tag">Declined</span>' : '') +
        (sub ? ' <small>' + e(sub) + '</small>' : '') + '</span>';
      prev = st;
    });

    out += '</div>';
    return out + '<div class="sl-sub">' + U.rungSubline(p) + '</div>';
  };

  /* ------------------------------------------------------------- chain ---- */

  U.chain = function (items) {
    if (!items || !items.length) return '';
    return '<ol class="chain">' + items.map(function (x) {
      return '<li><b>' + e(x.who) + '</b><span>' + e(x.what) + '</span>' +
        '<time>' + e(x.at ? D.fmtDateY(x.at) : '') + '</time></li>';
    }).join('') + '</ol>';
  };

  /* ---------------------------------------------------------- needs row --- */

  /* the permission each row act is gated by; an act with no row here is a
     page-owned control and renders as a plain button (T-10). */
  var ACT_PERM = {
    'ask-approve': 'review', 'ask-gate': 'gate', 'ask-mark': 'markApproved',
    'ask-submit': 'submit', 'p6r-return': 'review', 'p6r-reject': 'review',
    'p6x-confirm': 'gate_confirm', 'p6x-dismiss': 'gate_confirm',
    'p6x-correct': 'gate_edit'
  };

  U.inlineReason = function (id, act) {
    var lab = act === 'p6r-reject' ? 'Why is this rejected?'
            : (act === 'p6r-dismiss' ? 'Why is this wrong?' : 'Why is this going back?');
    return '<div class="p6-inline" data-for="' + e(id) + '">' +
      '<label class="vh" for="p6r-reason-' + e(id) + '">' + e(lab) + '</label>' +
      '<textarea class="p4-input p6-reason" id="p6r-reason-' + e(id) + '" rows="2" ' +
        'placeholder="' + e(lab) + '"></textarea>' +
      '<div class="p6-iacts">' +
        '<button class="btn brass sm" data-act="p6r-confirm" data-id="' + e(id) +
          '" data-kind="' + e(act) + '">Confirm</button>' +
        '<button class="btn sm" data-act="p6r-cancel" data-id="' + e(id) + '">Cancel</button>' +
      '</div></div>';
  };

  function needsBtn(user, item, a) {
    var perm = ACT_PERM[a.act];
    var opts = { sm: true, brass: a.brass, act: a.act };
    if (perm && item.project) {
      return U.action(user, perm, item.project, a.label, opts);
    }
    if (perm && !D.can(user, perm)) return '';
    opts.id = item.id;
    return U.btn(a.label, opts);
  }

  U.needsRow = function (item, opts) {
    opts = opts || {};
    var state = CBP.state;
    var user = state.user;
    var p = item.project;
    var compact = !!opts.compact;
    var focused = state.ui.focusId && (state.ui.focusId === item.id ||
                  (p && state.ui.focusId === p.id));

    var pid = p ? p.id : item.id;
    var title = p ? p.name : (item.contract ? item.contract.id : item.id);
    var country = p ? p.country : (item.contract ? item.contract.country : null);
    var cname = country
      ? ((state.countries.filter(function (c) { return c.code === country; })[0] || {}).name || country)
      : '';

    var meta = [];
    if (cname) meta.push(cname);
    meta.push('<span class="num">' + e(D.money(item.amount)) + '</span>');
    if (p && p.primary_implementer) meta.push(e(p.primary_implementer));
    meta.push('owner ' + e(p && p.owner ? CBP.userName(p.owner) : 'unassigned'));

    var bar = '';
    if (!compact && item.ceilingBar && item.ceilingBar.ceiling && CBP.W && CBP.W.budgetBar) {
      bar = '<div class="cbar-row">' +
        CBP.W.budgetBar(item.ceilingBar.byStatus || {}, item.ceilingBar.ceiling,
                        { scale: item.ceilingBar.scale }) + '</div>';
    }

    var chain = compact ? '' : U.chain((item.chain || []).slice(-3));

    var acts = (item.actions || []).map(function (a) {
      return needsBtn(user, item, a);
    }).join('');

    var inline = '';
    var pin = state.ui.p6Inline;
    if (pin && (pin.id === item.id || (p && pin.id === p.id))) {
      inline = U.inlineReason(pin.id, pin.act || 'p6r-return');
    }

    return '<article class="p6-card' + (item.tone === 'hot' || item.overdue ? ' hot' : '') +
      (focused ? ' is-focused' : '') + '" data-id="' + e(item.id) +
      '" data-kind="' + e(item.kind) + '">' +
      '<div class="p6-who">' +
        '<a class="p6-id num" href="#/project/' + e(pid) + '">' + e(pid) + '</a>' +
        '<b>' + U.flagMark(country) + e(title) + '</b>' +
        '<div class="p6-meta">' + meta.join(' · ') + '</div>' +
        (!p ? '' : '<div class="p6-inline-step' + (compact ? ' compact' : '') + '">' + U.stepper(p) + '</div>') +
        bar + chain + inline +
      '</div>' +
      '<div class="p6-age ' + e(item.tone || '') + '">' +
        '<span class="v num">' + e(D.days(item.waiting_days)) + '</span>' +
        '<small>' + e(item.waiting_at || '') + '</small>' +
      '</div>' +
      '<div class="p6-acts">' + acts +
        '<a class="btn sm" href="#/project/' + e(pid) + '">Open</a>' +
      '</div></article>';
  };

  /* --------------------------------------------------------- task list ---- */

  var TASK_TAG = { done: 'Done', todo: 'To do', blocked: 'Cannot start yet', na: 'Not needed' };

  U.taskList = function (rows) {
    if (!rows || !rows.length) return '';
    return '<ul class="tasklist">' + rows.map(function (r) {
      return '<li class="tl-' + e(r.status) + '">' +
        '<a href="' + e(r.href || '#') + '"><span class="tl-lab">' + e(r.label) + '</span>' +
        '<span class="tl-tag tl-' + e(r.status) + '">' + e(TASK_TAG[r.status] || r.status) +
        '</span></a></li>';
    }).join('') + '</ul>';
  };

  /* ------------------------------------------------------- country row ---- */

  U.countryBarRow = function (c) {
    var bar = (CBP.W && CBP.W.budgetBar)
      ? CBP.W.budgetBar(c.byStatus || {}, c.ceiling, { scale: c.scale }) : '';
    return '<a class="cbar-row" href="#/country/' + e(c.code) + '">' +
      '<span class="cbar-name">' + U.flagMark(c.code) + '<b>' + e(c.name) + '</b>' +
      '<small>' + e(c.count + ' project' + (c.count === 1 ? '' : 's') +
        ' · queue ' + c.queue) + '</small></span>' +
      '<span class="cbar-bar">' + bar + '</span>' +
      '<span class="cbar-fig"><b class="num' + (c.cls === 'over' ? ' neg' : '') + '">' +
        e(D.pct(c.coverage)) + '</b>' +
      '<small class="num">' + e(D.money(c.committed)) + ' of ' + e(D.money(c.ceiling)) +
      '</small></span></a>';
  };

  /* ---------------------------------------------------------- print pack -- */

  /* F27 — the RD-3 print pre-read wrapper, promoted from the private copies in
     p2.js (printHead) and p7.js (printHead). Both class names ride on the one
     element so P2, P7 and P17 keep their existing print CSS unchanged. */
  U.printPack = function (headerHtml) {
    return '<div class="p2-print p7-print printpack">' + (headerHtml || '') + '</div>';
  };

  /* --------------------------------------------------------- role guards -- */

  U.homeFor = function (role) {
    if (role === 'm3') return 'worker';
    if (role === 'm1') return 'country';
    if (role === 'm2') return 'portfolio';
    if (role === 'ogc' || role === 'finance') return 'reviews';
    if (role === 'viewer') return 'viewer';
    return 'dashboard';
  };

  /* F18 — routing carries no permission check, so every P13–P17 page opens with
     this guard. Returns true when the persona may stay; otherwise it sets the
     notice and sends them to their own home. */
  U.requireRole = function (state, roles) {
    var role = state && state.user ? state.user.role : null;
    if (role && roles && roles.indexOf(role) > -1) return true;
    state.ui.notice = 'That page belongs to another role — this is your home instead.';
    try { location.replace('#/home'); } catch (err) { location.hash = '#/home'; }
    return false;
  };

  /* === end FLOW === */

})();
