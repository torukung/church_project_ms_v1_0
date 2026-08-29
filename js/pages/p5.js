/* pages/p5.js — P5 Timeline, route #/timeline (build-plan item 6, v1.0.1 item 8).
   The cross-project Gantt: one row per project in the signed-in user's scope,
   grouped by country, status or owner, in the same visual grammar as the C-06
   mini chart on P3 and P4 — pill bars, month grid, one rose line for today —
   so nobody has to learn a second chart.

   v1.0.1: the balloons are live. A user who may edit the record drags a phase
   balloon (or the target-date diamond) along its row; the drag snaps to whole
   days against the same scale the chart is drawn on, a tooltip carries the live
   date, and the drop writes back through A.projectUpdate — which appends the
   system log line. Clicking a balloon selects it instead, and a small tray under
   the row offers ← / → one-day nudges and a Done dismiss, so the whole feature
   is reachable without a pointer. Viewers and out-of-scope personas get plain
   divs: no handles, no selection, no cursor change.

   Local pure helpers (iso, monthsBetween, spansFor, model) live here rather
   than in derive.js because derive.js is not this round's to edit; they are
   side-effect free and can move up later. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, A = CBP.actions, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};

  var GROUPS = [
    { k: 'country', label: 'Country' },
    { k: 'status',  label: 'Status' },
    { k: 'owner',   label: 'Owner' }
  ];

  var NOMINAL_PLAN_DAYS = 90;    /* window used when a record has no target date */
  var NOMINAL_IMPL_DAYS = 120;   /* window used when status 1 has no phases */
  var DAY = 86400000;

  /* ------------------------------------------------------- pure helpers -- */

  function iso(d) {
    return d.getUTCFullYear() + '-' +
           ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' +
           ('0' + d.getUTCDate()).slice(-2);
  }

  function plus(isoDate, days) { return iso(D.addDays(D.parse(isoDate), days)); }

  function earlier(a, b) { return D.parse(a) <= D.parse(b) ? a : b; }
  function later(a, b)   { return D.parse(a) >= D.parse(b) ? a : b; }

  /* What this project occupies on the chart.
     status 1  → the real implementation phases, solid
     status 2  → approved → target, dashed (planned, not started)
     status 3/4→ today → target, dashed (it cannot start before it is approved)
     a target date already passed inverts into a rose "target passed" band
     declined  → no bar at all, just a note in the track

     A span that carries `pi` is backed by a real stored phase, and only those
     are draggable — a nominal stand-in window has nothing to write back to. */
  function spansFor(p) {
    var T = CBP.CONFIG.TODAY;

    if (p.status === 'declined') {
      return { spans: [], note: 'declined' + (p.declined_at ? ' ' + D.fmtDate(p.declined_at) : '') };
    }

    if (p.status === 1) {
      var ph = D.phases(p);
      if (ph.length) {
        return {
          spans: ph.map(function (x, i) {
            return { start: x.start, end: x.end, label: x.phase, plan: false, v: i % 2, pi: i };
          })
        };
      }
      var s = p.implementation_date || p.approved_at || T;
      return {
        spans: [{ start: s, end: p.target_date || plus(s, NOMINAL_IMPL_DAYS),
                  label: 'In implementation', plan: false, v: 0 }],
        note: p.target_date ? null : 'phases not entered'
      };
    }

    var start = (p.status === 2 ? (p.approved_at || T) : T);
    var end = p.target_date || plus(start, NOMINAL_PLAN_DAYS);
    var over = D.parse(end) < D.parse(start);
    if (over) { var t = start; start = end; end = t; }

    return {
      spans: [{
        start: start, end: end, plan: true, over: over, v: 0,
        label: over ? 'Target passed ' + D.days(D.daysSince(p.target_date))
                    : (p.status === 2 ? 'Planned — awaiting kickoff' : 'Planned implementation')
      }],
      note: p.target_date ? null : 'no target date · nominal ' + NOMINAL_PLAN_DAYS + ' d'
    };
  }

  /* the chart frame: whole months covering every span plus today */
  function model(rows) {
    var min = null, max = null;
    var T = CBP.CONFIG.TODAY;
    rows.forEach(function (r) {
      r.spans.forEach(function (s) {
        min = min === null ? s.start : earlier(min, s.start);
        max = max === null ? s.end : later(max, s.end);
      });
      if (r.project.target_date) {
        min = min === null ? r.project.target_date : earlier(min, r.project.target_date);
        max = max === null ? r.project.target_date : later(max, r.project.target_date);
      }
    });
    min = min === null ? T : earlier(min, T);
    max = max === null ? plus(T, 30) : later(max, T);

    var a = D.parse(min), b = D.parse(max);
    var from = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
    var to = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 1));
    var total = (to - from) || 1;

    var months = [];
    var cur = from;
    while (cur < to) {
      var next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
      months.push({
        label: D.monthName(cur) + ' ’' + String(cur.getUTCFullYear()).slice(2),
        width: (Math.min(next, to) - cur) / total * 100,
        offset: (cur - from) / total * 100
      });
      cur = next;
    }

    return {
      from: from, to: to, total: total, months: months,
      fromMs: +from, toMs: +to, totalDays: total / DAY,
      pos: function (isoDate) {
        var d = D.parse(isoDate);
        if (!d) return null;
        return Math.max(0, Math.min(100, (d - from) / total * 100));
      }
    };
  }

  function pct(n) { return (Math.round(n * 100) / 100) + '%'; }

  /* full-height overlay position, measured across the whole chart including
     the fixed label column */
  function overlay(f) {
    return 'calc(var(--p5-lab) + (100% - var(--p5-lab)) * ' + (f / 100) + ')';
  }

  /* may this persona move this record's dates? One gate, used by the markup
     and re-checked by every handler, so a stale DOM can never write. */
  function mayMove(user, p) { return D.can(user, 'edit', p); }

  /* ============================================================== page ====*/

  CBP.pages.timeline = function (state) {
    var user = state.user;
    var codes = D.visibleCountries(user, state.countries);
    var scoped = D.visibleProjects(user, state.projects, state.countries);
    var group = state.ui.p5Group || 'country';

    var rows = scoped.map(function (p) {
      var s = spansFor(p);
      return { project: p, spans: s.spans, note: s.note, may: mayMove(user, p) };
    });

    var m = model(rows);
    MODEL = m;                       /* the frame the pointer handlers measure against */

    /* a selection never survives a persona switch or a scope change */
    var sel = state.ui.p5Sel || null;
    if (sel) {
      var keep = rows.filter(function (r) {
        return r.project.id === sel.pid && r.may;
      })[0];
      if (!keep) { sel = null; state.ui.p5Sel = null; }
    }

    var movable = rows.filter(function (r) { return r.may; }).length;

    var scopeName = codes.length === state.countries.length
      ? 'Asia Area' : codes.map(countryName).join(' · ');

    var html = '<div class="crumb">TimeBlock · ' + e(scopeName) +
      ' · Budget year ' + e(CBP.CONFIG.BUDGET_YEAR) + '</div>' +
      '<div class="pagehead"><h1>TimeBlock<span class="p5-addon" title="Optional add-on module (D-07)">Add-on module</span></h1>' +
      '<span class="sub">' + scoped.length + ' project' + (scoped.length === 1 ? '' : 's') +
      ' in scope · ' + e(D.fmtDateY(iso(m.from))) + ' – ' + e(D.fmtDateY(iso(D.addDays(m.to, -1)))) +
      '</span><div class="sp">' +
        (D.can(user, 'viewGantt')
          ? '<button class="btn" data-act="deeplink">Open full editor in TimeBlock ↗</button>' : '') +
      '</div></div>';

    /* group-by switch */
    html += '<div class="filters p5-controls"><span class="p5-glab">Group by</span>' +
      GROUPS.map(function (g) {
        return '<button class="chip' + (group === g.k ? ' on' : '') +
               '" data-act="p5group" data-g="' + g.k + '">' + e(g.label) + '</button>';
      }).join('') +
      '<span class="p5-legend">' +
        '<span class="p5-key solid"></span>Implementation' +
        '<span class="p5-key plan"></span>Planned (dashed until approved)' +
        '<span class="p5-key over"></span>Target passed' +
        '<span class="p5-key mile"></span>Target date' +
        '<span class="p5-key today"></span>Today' +
      '</span></div>';

    if (!rows.length) {
      return html + U.card('TimeBlock',
        '<div class="p5-empty">No projects in your scope carry a timeline yet.</div>');
    }

    if (movable) {
      html += '<p class="p5-lead">Drag a phase balloon or the target diamond along its row to ' +
        'reschedule — it snaps to whole days and the drop is written to the record with a log ' +
        'line. Prefer the keyboard? Click a balloon to select it, then nudge a day at a time.</p>';
    }

    /* -------------------------------------------------------- the chart */
    var chart = '<div class="p5-gantt"><div class="p5-scroll"><div class="p5-inner">';

    m.months.forEach(function (mo, i) {
      if (i) chart += '<div class="p5-div" style="left:' + overlay(mo.offset) + '"></div>';
    });

    var todayF = m.pos(CBP.CONFIG.TODAY);
    if (todayF !== null) {
      chart += '<div class="p5-today" style="left:' + overlay(todayF) + '"></div>' +
               '<div class="p5-todaypill" style="left:' + overlay(todayF) + '">today · ' +
               e(D.fmtDateY(CBP.CONFIG.TODAY)) + '</div>';
    }

    chart += '<div class="p5-head"><div class="p5-lab">Project</div><div class="p5-months">' +
      m.months.map(function (mo) {
        return '<div class="p5-mh" style="width:' + pct(mo.width) + '">' + e(mo.label) + '</div>';
      }).join('') + '</div></div>';

    groupRows(rows, group, state).forEach(function (g) {
      chart += '<div class="p5-grp"><div class="p5-lab"><b>' + e(g.label) + '</b>' +
        '<small>' + e(g.sub) + '</small></div><div class="p5-track grp"></div></div>';
      g.rows.forEach(function (r) {
        chart += rowHtml(r, m, sel);
        if (sel && sel.pid === r.project.id) chart += trayHtml(state, r, sel);
      });
    });

    chart += '</div></div></div>';

    html += U.card('', chart, { cls: 'p5-card' });

    html += '<p class="pagenote">One row per project, oldest start first inside each group. ' +
      'Bars before approval are dashed: a record cannot start implementing until it is marked ' +
      'approved, so the planned window runs from today (or from the approval date at status 2) ' +
      'to the target date — a nominal ' + NOMINAL_PLAN_DAYS + '-day window stands in where no ' +
      'target date is set. Status 1 draws the real implementation phases. The owner carries on ' +
      'the label column and the bar (D-14); the diamond is the target date. ' +
      (movable
        ? 'Moving dates is owner + M1-and-above (D-06): drag a balloon, or select it and nudge, ' +
          'and the record is saved here with its own activity line — the full phase editor still ' +
          'lives on the project page and in the TimeBlock full editor (D-07).'
        : 'Moving dates is owner + M1-and-above (D-06), so this chart is read-only for you — ' +
          'the balloons carry no handles.') +
      ' Scope: ' + e(codes.join(', ')) + '.</p>';

    return html;
  };

  function countryName(code) {
    var c = CBP.state.countries.filter(function (x) { return x.code === code; })[0];
    return c ? c.name : code;
  }

  /* --------------------------------------------------------- grouping ---- */

  function groupRows(rows, group, state) {
    var keyOf, labelOf, order;

    if (group === 'status') {
      keyOf = function (r) { return String(r.project.status); };
      labelOf = function (k) { return CBP.CONFIG.STATUS[k === 'declined' ? 'declined' : +k].label; };
      order = CBP.CONFIG.STATUS_ORDER.map(String);
    } else if (group === 'owner') {
      keyOf = function (r) { return r.project.owner || '—'; };
      labelOf = function (k) { return k === '—' ? 'Unassigned' : CBP.userName(k); };
      order = null;
    } else {
      keyOf = function (r) { return r.project.country; };
      labelOf = countryName;
      order = state.countries.map(function (c) { return c.code; });
    }

    var buckets = {}, keys = [];
    rows.forEach(function (r) {
      var k = keyOf(r);
      if (!buckets[k]) { buckets[k] = []; keys.push(k); }
      buckets[k].push(r);
    });

    if (order) {
      keys.sort(function (a, b) {
        var ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    } else {
      keys.sort(function (a, b) {
        if (a === '—') return 1;
        if (b === '—') return -1;
        return labelOf(a).localeCompare(labelOf(b));
      });
    }

    return keys.map(function (k) {
      var list = buckets[k].slice().sort(function (a, b) {
        var sa = a.spans[0], sb = b.spans[0];
        if (!sa || !sb) return sa ? -1 : (sb ? 1 : 0);
        return D.parse(sa.start) - D.parse(sb.start);
      });
      var money = list.reduce(function (acc, r) {
        return acc + (r.project.status === 'declined' ? 0 : (r.project.amount || 0));
      }, 0);
      var unowned = list.filter(function (r) { return !r.project.owner; }).length;
      return {
        label: labelOf(k),
        sub: list.length + ' project' + (list.length === 1 ? '' : 's') + ' · ' + D.money(money) +
             (group !== 'owner' && unowned ? ' · ' + unowned + ' unassigned' : ''),
        rows: list
      };
    });
  }

  /* ------------------------------------------------------------- a row --- */

  var MIN_TEXT_WIDTH = 8;   /* % of the range a bar needs before its label fits inside */
  var FLOAT_FLIP = 62;      /* past this, a floating label is hung before the bar instead */

  /* a balloon is a <button> only where it can actually be moved; everywhere else
     it stays a plain <div>, which is what keeps the viewer's chart inert */
  function balloon(tag, cls, style, title, attrs, inner) {
    var live = tag === 'button';
    return '<' + tag + (live ? ' type="button"' : '') + ' class="' + cls + '"' +
      ' style="' + style + '" title="' + title + '"' + attrs + '>' + inner +
      '</' + tag + '>';
  }

  function rowHtml(r, m, sel) {
    var p = r.project;
    var owner = p.owner ? CBP.userName(p.owner) : 'unassigned';
    var outside = [];       /* labels too long for their bar, plus the row note */

    var bars = r.spans.map(function (s) {
      var a = m.pos(s.start), b = m.pos(s.end);
      var w = Math.max(1.4, b - a);
      /* a "target passed" band always hangs its label outside: the band is the
         alarming part, and the label is more legible beside it than clipped */
      var roomy = w >= MIN_TEXT_WIDTH && !s.over;
      var live = r.may && s.pi !== undefined;
      var on = live && sel && sel.pid === p.id && sel.kind === 'phase' && sel.idx === s.pi;
      var cls = 'p5-bar ' +
                (s.plan ? (s.over ? 'plan over' : 'plan') : (s.v ? 'v2' : '')) +
                (roomy ? '' : ' tiny') + (live ? ' p5-live' : '') + (on ? ' on' : '');
      var text = s.label + ((s.plan && !s.over) ? ' · ' + owner : '');
      if (!roomy) outside.push({ text: s.label, over: s.over });

      var attrs = live
        ? ' data-act="p5sel" data-p5drag="phase" data-pid="' + e(p.id) + '" data-idx="' + s.pi +
          '" data-start="' + e(s.start) + '" data-end="' + e(s.end) + '"' +
          ' aria-pressed="' + (on ? 'true' : 'false') + '"'
        : '';

      return balloon(live ? 'button' : 'div', cls,
        'left:' + pct(a) + ';width:' + pct(w),
        e(s.label + ' · ' + D.fmtDateY(s.start) + ' – ' + D.fmtDateY(s.end) + ' · ' + owner +
          (live ? ' · drag or click to reschedule' : '')),
        attrs,
        '<i></i>' + (roomy ? '<span>' + e(text) + '</span>' : ''));
    }).join('');

    var mile = '';
    if (p.target_date) {
      var mlive = r.may;
      var mon = mlive && sel && sel.pid === p.id && sel.kind === 'target';
      mile = balloon(mlive ? 'button' : 'div',
        'p5-mile' + (D.pastTarget(p) ? ' over' : '') + (mlive ? ' p5-live' : '') +
          (mon ? ' on' : ''),
        'left:' + pct(m.pos(p.target_date)),
        e('Target date ' + D.fmtDateY(p.target_date) +
          (mlive ? ' · drag or click to move' : '')),
        mlive
          ? ' data-act="p5sel" data-p5drag="target" data-pid="' + e(p.id) + '" data-idx="0"' +
            ' data-date="' + e(p.target_date) + '" aria-pressed="' + (mon ? 'true' : 'false') +
            '" aria-label="Target date ' + e(D.fmtDateY(p.target_date)) + '"'
          : '',
        '');
    }

    if (r.note) outside.push({ text: r.note, muted: true });

    /* one floating label per row, hung after the last bar — or before the first
       bar when that would run off the right edge of the chart */
    var float = '';
    if (outside.length) {
      var last = r.spans.length ? m.pos(r.spans[r.spans.length - 1].end) : m.pos(CBP.CONFIG.TODAY);
      var first = r.spans.length ? m.pos(r.spans[0].start) : last;
      var hot = outside.some(function (x) { return x.over; });
      var text = outside.map(function (x) { return x.text; }).join(' · ');
      float = last <= FLOAT_FLIP
        ? '<span class="p5-note' + (hot ? ' over' : '') + '" style="left:' + pct(last) + '">' +
          e(text) + '</span>'
        : '<span class="p5-note before' + (hot ? ' over' : '') + '" style="right:' +
          pct(100 - first) + '">' + e(text) + '</span>';
    }

    /* the whole label column stays the link to the record — the balloons sit in
       the track and are controls of their own, so nothing interactive nests */
    return '<div class="p5-row' + (sel && sel.pid === p.id ? ' sel' : '') + '">' +
      '<div class="p5-lab">' +
        '<a class="p5-plink" href="#/project/' + e(p.id) + '" title="' +
        e(p.id + ' · ' + p.name + ' · ' + owner) + '">' +
        '<b>' + e(p.name) + '</b>' +
        '<small' + (p.owner ? '' : ' class="unowned"') + '>' +
        '<i class="p5-id">' + e(p.id) + '</i> · ' + e(owner) + ' · ' +
        e(CBP.CONFIG.STATUS[p.status].short) + '</small></a>' +
      '</div>' +
      '<div class="p5-track">' + bars + mile + float + '</div></div>';
  }

  /* ------------------------------------------------- the selection tray --- */

  /* What a selected balloon currently spans, in words. */
  function selDates(p, sel) {
    if (sel.kind === 'target') {
      return p.target_date
        ? { name: 'Target date', when: D.fmtDateY(p.target_date) } : null;
    }
    var ph = D.phases(p)[sel.idx];
    if (!ph) return null;
    return {
      name: ph.phase,
      when: D.fmtDateY(ph.start) + ' – ' + D.fmtDateY(ph.end) +
            ' · ' + D.days(D.daysBetween(ph.start, ph.end))
    };
  }

  function trayHtml(state, r, sel) {
    var what = selDates(r.project, sel);
    if (!what) return '';
    var err = (state.ui.err && state.ui.err.key === 'edit')
      ? '<span class="p5-editerr">' + e(state.ui.err.msg) + '</span>' : '';

    return '<div class="p5-edit">' +
      '<span class="p5-editlab">Moving <b>' + e(what.name) + '</b> ' +
        '<span class="num">' + e(what.when) + '</span></span>' +
      '<span class="p5-nudge">' +
        '<button type="button" class="btn sm" data-act="p5nudge" data-dir="-1" ' +
          'aria-label="Move one day earlier">← 1 day</button>' +
        '<button type="button" class="btn sm" data-act="p5nudge" data-dir="1" ' +
          'aria-label="Move one day later">1 day →</button>' +
      '</span>' +
      '<button type="button" class="btn sm" data-act="p5done">Done</button>' +
      err +
      '<span class="p5-editnote">Each move is saved to the record with its own activity line.' +
      '</span></div>';
  }

  /* ===================================================== interaction ====== */
  /* Registered ONCE at load, delegated, and route-guarded — the page markup is
     rebuilt on every render() pass, so nothing may bind to an element. */

  var MODEL = null;      /* the frame of the chart currently on screen */
  var DRAG = null;       /* the balloon under the pointer, mid-drag */
  var TIP = null;        /* the live date tooltip, parked on <body> */
  var SUPPRESS = 0;      /* a committed drag must not also read as a click */

  function onP5() {
    return !!(CBP.state && CBP.state.ui && CBP.state.ui.route === 'timeline' && MODEL);
  }

  function closest(node, sel) {
    return (node && node.closest) ? node.closest(sel) : null;
  }

  /* ------------------------------------------------------------ tooltip -- */

  function tipEl() {
    if (TIP) return TIP;
    try {
      TIP = document.createElement('div');
      TIP.className = 'p5-tip';
      document.body.appendChild(TIP);
    } catch (err) { TIP = null; }
    return TIP;
  }

  function showTip(ev, text) {
    var t = tipEl();
    if (!t) return;
    t.textContent = text;
    t.style.left = ev.clientX + 'px';
    t.style.top = ev.clientY + 'px';
    t.classList.add('on');
  }

  function hideTip() {
    if (TIP) TIP.classList.remove('on');
  }

  /* --------------------------------------------------------- the maths --- */

  /* how far this balloon may travel before it leaves the drawn window */
  function clampDays(d, days) {
    var s = D.parse(d.start), en = D.parse(d.end);
    var lo = Math.ceil((MODEL.fromMs - (+s)) / DAY);
    var hi = Math.floor((MODEL.toMs - DAY - (+en)) / DAY);
    if (days < lo) days = lo;
    if (days > hi) days = hi;
    return days;
  }

  function dragLabel(d, days) {
    if (d.kind === 'target') return 'Target ' + D.fmtDateY(plus(d.start, days));
    return D.fmtDateY(plus(d.start, days)) + ' – ' + D.fmtDateY(plus(d.end, days));
  }

  /* ------------------------------------------------------------- commit -- */

  /* Both paths — drag drop and keyboard nudge — land here, so there is exactly
     one way a timeline date reaches the store. A phases-only save deliberately
     leaves ui.returnTo alone (CORE contract), so no "Back to projects" bar
     jumps over the chart. */
  function commit(kind, pid, idx, days) {
    var p = CBP.projectById(pid);
    if (!p || !days) { CBP.render(); return; }
    if (!mayMove(CBP.state.user, p)) { CBP.render(); return; }

    var res;
    if (kind === 'target') {
      if (!p.target_date) { CBP.render(); return; }
      res = A.projectUpdate(pid, { target_date: plus(p.target_date, days) });
      /* a target move is a timeline gesture, not a record save: projectUpdate
         arms ui.returnTo for record saves, which would leave a stale "Back to
         projects" bar on the next P4 visit — clear it here (audit fix). */
      if (res && res.ok) CBP.state.ui.returnTo = null;
    } else {
      var sorted = D.phases(p);
      var moved = sorted[idx];
      if (!moved) { CBP.render(); return; }
      var out = (p.phases || []).map(function (x) {
        var o = {}, k;
        for (k in x) { if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k]; }
        if (x === moved) { o.start = plus(x.start, days); o.end = plus(x.end, days); }
        return o;
      });
      res = A.projectUpdate(pid, { phases: out });
    }
    /* the action renders on success; a refusal only leaves ui.err behind */
    if (!res || !res.ok) CBP.render();
  }

  /* ------------------------------------------------------------- events -- */

  document.addEventListener('pointerdown', function (ev) {
    if (!onP5()) return;
    var t = closest(ev.target, '[data-p5drag]');
    if (!t) return;

    var pid = t.getAttribute('data-pid');
    var p = CBP.projectById(pid);
    if (!p || !mayMove(CBP.state.user, p)) return;

    var track = closest(t, '.p5-track');
    var rect = track && track.getBoundingClientRect ? track.getBoundingClientRect() : null;
    if (!rect || !rect.width) return;

    var isTarget = t.getAttribute('data-p5drag') === 'target';
    DRAG = {
      el: t,
      kind: isTarget ? 'target' : 'phase',
      pid: pid,
      idx: parseInt(t.getAttribute('data-idx'), 10) || 0,
      start: isTarget ? t.getAttribute('data-date') : t.getAttribute('data-start'),
      end: isTarget ? t.getAttribute('data-date') : t.getAttribute('data-end'),
      x0: ev.clientX,
      w: rect.width,
      left0: parseFloat(t.style.left) || 0,
      days: 0,
      moved: false
    };
    try { t.setPointerCapture(ev.pointerId); } catch (err) { /* older engines */ }
    ev.preventDefault();
  });

  document.addEventListener('pointermove', function (ev) {
    if (!DRAG || !MODEL) return;
    var dx = ev.clientX - DRAG.x0;
    if (Math.abs(dx) > 3) DRAG.moved = true;

    var days = clampDays(DRAG, Math.round(dx / DRAG.w * MODEL.totalDays));
    DRAG.days = days;
    DRAG.el.style.left = (DRAG.left0 + (days / MODEL.totalDays * 100)) + '%';
    showTip(ev, dragLabel(DRAG, days));
  });

  function endDrag(ev) {
    if (!DRAG) return;
    var d = DRAG;
    DRAG = null;
    hideTip();
    try { d.el.releasePointerCapture(ev.pointerId); } catch (err) { /* noop */ }

    if (!d.moved || !d.days) {
      /* a tap, or a wobble smaller than a day — put the balloon back and let the
         click handler turn it into a selection */
      d.el.style.left = d.left0 + '%';
      return;
    }
    SUPPRESS = 1;
    CBP.state.ui.p5Sel = { pid: d.pid, kind: d.kind, idx: d.idx };
    commit(d.kind, d.pid, d.idx, d.days);
  }

  document.addEventListener('pointerup', endDrag);

  /* a cancelled gesture (scroll take-over, lost capture) puts the balloon back
     and writes nothing */
  document.addEventListener('pointercancel', function () {
    if (!DRAG) return;
    var d = DRAG;
    DRAG = null;
    hideTip();
    d.el.style.left = d.left0 + '%';
  });

  /* click = the keyboard-and-mouse fallback path: select, nudge, dismiss */
  document.addEventListener('click', function (ev) {
    if (!CBP.state || !CBP.state.ui || CBP.state.ui.route !== 'timeline') return;
    var t = closest(ev.target, '[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act !== 'p5sel' && act !== 'p5nudge' && act !== 'p5done') return;
    ev.preventDefault();

    if (act === 'p5done') {
      CBP.state.ui.p5Sel = null;
      CBP.state.ui.err = null;
      CBP.render();
      return;
    }

    if (act === 'p5sel') {
      if (SUPPRESS) { SUPPRESS = 0; return; }
      var pid = t.getAttribute('data-pid');
      var p = CBP.projectById(pid);
      if (!p || !mayMove(CBP.state.user, p)) return;
      var next = {
        pid: pid,
        kind: t.getAttribute('data-p5drag') === 'target' ? 'target' : 'phase',
        idx: parseInt(t.getAttribute('data-idx'), 10) || 0
      };
      var cur = CBP.state.ui.p5Sel;
      CBP.state.ui.p5Sel = (cur && cur.pid === next.pid && cur.kind === next.kind &&
                            cur.idx === next.idx) ? null : next;
      CBP.state.ui.err = null;
      CBP.render();
      return;
    }

    /* p5nudge — ±1 day on whatever is selected */
    var sel = CBP.state.ui.p5Sel;
    if (!sel) return;
    var dir = parseInt(t.getAttribute('data-dir'), 10);
    commit(sel.kind, sel.pid, sel.idx, dir === -1 ? -1 : 1);
  });

  /* exposed for the build harness: the same commit path the UI uses */
  CBP.p5 = { commit: commit, spansFor: spansFor, model: model };

})();
