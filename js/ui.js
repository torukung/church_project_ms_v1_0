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

  /* ------------------------------------------- C-16 one-line stepper ---- */

  /* Submitted → Approved → Decision Point → CHaS → Mark Approved.
     Each pill carries ✓ / ◷ / dashed plus its date and reference sub-label. */
  U.stepper = function (p) {
    var steps = [];
    var g = D.gate(p);
    var dp = g[0], chas = g[1];
    var done = (p.status === 1 || p.status === 2);
    var declined = (p.status === 'declined');

    /* 1 · Submitted (Process 4, M2 clicks Request submitted) */
    if (p.status === 4) {
      steps.push({ st: 'wait', mark: '◷', label: 'Submitted', sub: 'M2 to submit' });
    } else if (p.submitted_at) {
      steps.push({ st: 'ok', mark: '✓', label: 'Submitted', sub: 'M2 · ' + D.fmtDate(p.submitted_at) });
    } else {
      steps.push({ st: 'ok', mark: '✓', label: 'Submitted', sub: 'recorded' });
    }

    if (declined) {
      steps.push({ st: 'wait', mark: '✕', label: 'Rejected',
                   sub: 'M1' + (p.declined_at ? ' · ' + D.fmtDate(p.declined_at) : '') +
                        (p.decline_reason ? ' — ' + p.decline_reason : '') });
      return U.stepline(steps);
    }

    /* 2 · Approved (Process 3, M1 advances to the external gate) */
    if (done) {
      steps.push({ st: 'ok', mark: '✓', label: 'Approved', sub: 'M1 · advanced to gate' });
    } else if (p.status === 3 && D.gateStarted(p)) {
      steps.push({ st: 'ok', mark: '✓', label: 'Approved', sub: 'M1 · advanced to gate' });
    } else if (p.status === 3) {
      steps.push({ st: 'wait', mark: '◷', label: 'Approved',
                   sub: 'M1 review · waiting ' + D.days(D.daysInStage(p)) });
    } else {
      steps.push({ st: 'todo', mark: '◻', label: 'Approved', sub: '' });
    }

    /* 3 & 4 · the two external systems, each with its own sub-counter */
    [dp, chas].forEach(function (x) {
      if (x.state === 'approved') {
        var bits = [];
        if (x.ref) bits.push(x.ref);
        if (x.submitted_at && x.approved_at) {
          bits.push(D.fmtDate(x.submitted_at) + ' → ' + D.fmtDate(x.approved_at) + ' · ' + D.days(x.days));
        } else if (x.approved_at) {
          bits.push('approved ' + D.fmtDate(x.approved_at));
        } else {
          bits.push('cleared');
        }
        steps.push({ st: 'ok', mark: '✓', label: x.label, sub: bits.join(' · ') });
      } else if (x.state === 'waiting') {
        var sub = 'submitted ' + D.fmtDate(x.submitted_at) + ' · waiting ' + D.days(x.days);
        if (x.remark) sub += ' · ' + x.remark;
        steps.push({ st: 'wait', mark: '◷', label: x.label, sub: sub });
      } else {
        steps.push({ st: 'todo', mark: '◻', label: x.label, sub: '' });
      }
    });

    /* 5 · Mark Approved (manual 3→2 by M1, mandatory references R-4) */
    if (done) {
      var refs = p.refs ? [p.refs.decision_point, p.refs.chas].filter(Boolean).join(' / ') : '';
      steps.push({ st: 'ok', mark: '✓', label: 'Marked Approved',
                   sub: 'M1' + (p.approved_at ? ' · ' + D.fmtDate(p.approved_at) : '') +
                        (refs ? ' · ' + refs : '') });
    } else if (D.openGates(p).length === 0 && D.gateStarted(p)) {
      steps.push({ st: 'wait', mark: '◷', label: 'Mark Approved', sub: 'both gates cleared · M1' });
    } else {
      steps.push({ st: 'todo', mark: '◻', label: 'Mark Approved', sub: 'locked · M1' });
    }

    return U.stepline(steps);
  };

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

  /* ------------------------------------------ C-03 · aligned budget bar --
     v1.0.1 contract. One utilisation bar, drawn against a scale that is shared
     by every row in its column, so the 100% rule sits at the SAME x all the way
     down and an over-run visibly crosses it as hatch.

       U.budgetBar(pct, { scale })

     `scale` is the column-wide maximum from D.barScale(rows) — pass it and the
     rows align. Omit it and the bar falls back to the older self-scaling
     behaviour (scale = max(100, pct)), which is what a single stand-alone bar
     wants and what keeps every caller written before this change rendering
     unchanged until wave 2 updates it.

     Other options, all optional: label (value text to the right), sm (slim),
     tone ('' | 'warn' | 'over', otherwise derived), title (tooltip),
     tick (false hides the 100% rule). */
  U.budgetBar = function (pct, opts) {
    opts = opts || {};
    var v = (typeof pct === 'number' && isFinite(pct)) ? Math.max(0, pct) : 0;
    var scale = opts.scale;
    if (!(typeof scale === 'number' && isFinite(scale)) || scale <= 0) {
      scale = Math.max(100, v);          /* backward-compatible self-scaling */
    }

    var x = function (n) { return (n / scale * 100); };
    var tick = x(100);
    var fill = x(Math.min(v, 100));
    var over = v > 100 ? x(v) - tick : 0;

    var tone = opts.tone;
    if (tone === undefined || tone === null) tone = D.coverageClass(v);

    var bar =
      '<span class="ubar-fill' + (tone ? ' ' + tone : '') +
        '" style="width:' + fill.toFixed(2) + '%"></span>' +
      (over > 0
        ? '<span class="ubar-over" style="left:' + tick.toFixed(2) + '%;width:' +
          over.toFixed(2) + '%"></span>' : '') +
      (opts.tick === false
        ? '' : '<span class="ubar-rule" style="left:' + tick.toFixed(2) + '%"></span>');

    var val = '';
    if (opts.label !== undefined && opts.label !== null && opts.label !== false) {
      val = '<span class="ubar-val num' + (tone === 'over' ? ' neg' : '') + '">' +
            e(opts.label === true ? D.pct(v) : opts.label) + '</span>';
    }

    return '<span class="ubar-wrap' + (opts.sm ? ' sm' : '') + '"' +
      (opts.title ? ' title="' + e(opts.title) + '"' : '') +
      '><span class="ubar" role="img" aria-label="' +
      e(D.pct(v) + ' of the ceiling') + '">' + bar + '</span>' + val + '</span>';
  };

})();
