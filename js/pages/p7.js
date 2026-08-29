/* pages/p7.js — Budget, route #/budget (v1.0.1 item 9).

   Three sub-menus over one derived model:

     Utilisation  the country ceilings editor and every utilisation bar on ONE
                  shared scale (D.barScale → U.budgetBar({scale})), so the 100%
                  rule forms a single continuous line down the column and an
                  over-run — Bangladesh at 131% — visibly crosses it as hatch.
     Reports      a report builder: country chips, status chips, a column
                  picker, a live table that rebuilds from derive on every
                  change, print/export on the RD-3 path, save-as-default.
     Forecasting  utilisation per country for every year the demo holds, the
                  simulated projection and the plan years, plus a grouped
                  comparison block on the same shared scale with one caret per
                  plan year.

   Nothing is stored pre-computed: a ceiling edit or a plan edit mutates state
   and one CBP.render() pass rebuilds every figure above and below it.

   v1.0.3 — the Forecasting tab's numbers are configurable, not fixtures. Every
   history year is an editable committed amount in state.histEdit (seeded from
   budget_history at init), the live budget year stays summed from the records
   and is deliberately NOT editable, and the year set itself grows in both
   directions: 'Add earlier year' prepends min(history)−1 back-cast from the
   trend, 'Add later year' appends a plan year after the last one, and an added
   column carries an × to take it away again. The projection re-fits over
   whatever actual years are on screen (D.trendNext), so the table, the ≈
   simulation bar and the comparison block can never disagree. */
(function () {
  'use strict';

  var D = CBP.D, U = CBP.ui, W = CBP.W, A = CBP.actions, e = CBP.ui.esc;
  CBP.pages = CBP.pages || {};

  var TABS = [
    { k: 'util',     label: 'Utilisation' },
    { k: 'reports',  label: 'Reports' },
    { k: 'forecast', label: 'Forecasting' }
  ];

  /* the report builder's column catalogue — the keys CORE seeds ui.p7Report with */
  var COLS = [
    { k: 'committed',   label: 'Committed',        right: true },
    { k: 'ceiling',     label: 'Ceiling',          right: true },
    { k: 'utilisation', label: 'Utilisation %',    right: true },
    { k: 'queue',       label: 'Queue count',      right: true },
    { k: 'gates',       label: 'Gate exceptions',  right: true },
    { k: 'unread',      label: 'Unread comments',  right: true }
  ];

  function ensure(state) {
    if (!state.ui.p7) {
      state.ui.p7 = {
        sort: { col: 'coverage', dir: 'desc' },   /* the league table below */
        edit: null,                               /* country code being edited */
        err: null
      };
    }
    /* the builder edits a draft; "Save as default" is what writes ui.p7Report */
    if (!state.ui.p7ReportDraft) {
      state.ui.p7ReportDraft = copyReport(state.ui.p7Report);
    }
    return state.ui.p7;
  }

  function copyReport(r) {
    r = r || {};
    return {
      countries: (r.countries || []).slice(),
      statuses:  (r.statuses  || []).slice(),
      cols:      (r.cols      || []).slice()
    };
  }

  function sameReport(a, b) {
    var key = function (x) {
      return (x.countries || []).slice().sort().join(',') + '|' +
             (x.statuses || []).map(String).sort().join(',') + '|' +
             (x.cols || []).slice().sort().join(',');
    };
    return key(a) === key(b);
  }

  /* the one inline-error idiom on this page: message beside the control that
     produced it, 3px rose rule, never a dialog */
  function err(state, key) {
    var x = state.ui.err;
    return (x && x.key === key) ? '<p class="p7-err">' + e(x.msg) + '</p>' : '';
  }

  /* ============================================================== render == */

  CBP.pages.budget = function (state) {
    var s = ensure(state);
    var user = state.user;
    var codes = D.visibleCountries(user, state.countries);
    var ctx = W.ctx(state, codes);
    ctx.sort = s.sort;                     /* the league widget sorts from here */
    var mayEdit = D.can(user, 'setCeiling');
    var tab = state.ui.p7Tab || 'util';
    if (!TABS.filter(function (t) { return t.k === tab; }).length) tab = 'util';

    var html = '<div class="p7-page">';

    html += '<div class="crumb">Budget · ' + e(ctx.title) +
      ' · Budget year ' + e(CBP.CONFIG.BUDGET_YEAR) + '</div>';

    html += '<div class="pagehead"><h1>Budget</h1>' +
      '<span class="sub">' + e(W.plural(ctx.rows.length, 'country', 'countries')) +
      ' in scope · ' + e(D.money(ctx.committed)) + ' of ' + e(D.money(ctx.ceiling)) +
      ' ceiling</span>' +
      '<div class="sp">' +
        '<label class="p7-year" for="p7year">Budget year</label>' +
        '<select class="sel" id="p7year" disabled>' +
          '<option>' + e(CBP.CONFIG.BUDGET_YEAR) + '</option></select>' +
        '<span class="p7-yearnote">2026 only in this demo</span>' +
        (state.dashSyncedAt
          ? '<span class="p7-synced num">Dashboards synced ' +
            e(D.fmtDateY(state.dashSyncedAt)) + '</span>' : '') +
        (D.can(user, 'edit')
          ? '<button class="btn" data-act="sync-dash">Sync dashboards</button>' : '') +
      '</div></div>';

    /* --------------------------------------------------------- sub-menu -- */
    html += '<div class="p7-tabs" role="tablist">' +
      TABS.map(function (t) {
        return '<button type="button" class="p7-tab' + (tab === t.k ? ' on' : '') +
          '" role="tab" aria-selected="' + (tab === t.k) +
          '" data-act="p7tab" data-tab="' + e(t.k) + '">' + e(t.label) + '</button>';
      }).join('') + '</div>';

    if (s.err) html += '<div class="p7-hint">' + e(s.err) + '</div>';

    if (tab === 'reports')       html += reportsTab(state, user, codes);
    else if (tab === 'forecast') html += forecastTab(state, user, codes);
    else                         html += utilTab(state, ctx, mayEdit, s);

    return html + '</div>';
  };

  /* ======================================================= utilisation ==== */

  function utilTab(state, ctx, mayEdit, s) {
    var codes = ctx.codes;
    var scale = D.barScale(ctx.rows);      /* ONE scale for every bar below */

    var html = '<div class="p7-kpis">' +
      W.byId('kpis').render(state, codes, ctx) + '</div>';

    html += U.card('Utilisation against ceiling',
      alignedBars(ctx.rows, scale),
      { cls: 'p7-card' });

    html += ceilingTable(state, ctx, mayEdit, s, scale);

    html += U.card('Country league table',
      W.byId('league').render(state, codes, ctx),
      { cls: 'p7-card' });

    html += '<p class="pagenote">Amounts in USD (D-08). Committed sums every live record ' +
      'across statuses 1–4; declined records are excluded. Coverage is committed against the ' +
      'country ceiling and derives at render time against ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + '. Every bar on this page is drawn against one shared ' +
      'scale (0–' + scale + '%), so the 100% rule sits at the same point on every row and a ' +
      'country over its ceiling crosses the line into hatch rather than filling to the end. ' +
      (mayEdit
        ? 'You may set a country ceiling — every figure on this page and on the dashboard ' +
          'recomputes from it immediately.'
        : 'Setting a country ceiling is limited to Admin and Regional Managers (docs/01), so ' +
          'the ceilings here are read-only for you.') +
      '</p>';

    return html;
  }

  /* The aligned column. Every row is the same grid, the bars carry no value
     column of their own, and one rule is drawn the full height of the block at
     exactly the x the per-row 100% ticks land on — the same calc, so they
     coincide rather than merely look close. */
  function alignedBars(rows, scale) {
    var f = 100 / scale;                   /* where 100% sits inside a track */
    var list = rows.slice().sort(function (a, b) {
      return (b.coverage || 0) - (a.coverage || 0);
    });

    var body = list.map(function (r) {
      var cls = D.coverageClass(r.coverage);
      return '<div class="p7-urow">' +
        '<span class="p7-uname">' + e(r.name) +
          ' <span class="p7-code">' + e(r.code) + '</span></span>' +
        '<span class="p7-ubar">' +
          U.budgetBar(r.coverage, {
            scale: scale,
            title: r.name + ' · ' + D.money(r.committed) + ' of ' + D.money(r.ceiling) +
                   ' · ' + D.pct(r.coverage)
          }) +
        '</span>' +
        '<span class="p7-uval num' + (cls === 'over' ? ' neg' : '') + '">' +
          e(D.pct(r.coverage)) + '</span></div>';
    }).join('');

    if (!body) return '<div class="p7-empty">No countries in your scope.</div>';

    return '<div class="p7-ucol" style="--p7-utick:' + f.toFixed(6) + '">' +
      '<div class="p7-urule" aria-hidden="true"></div>' +
      '<div class="p7-u100">100% of ceiling</div>' +
      body +
      '</div>' +
      '<p class="p7-note">Bars share one 0–' + scale + '% scale, so the 100% rule is a single ' +
      'line down the column. Anything past it is the over-run, hatched in rose.</p>';
  }

  /* ====================================================== ceilings editor = */

  function ceilingTable(state, ctx, mayEdit, s, scale) {
    var rows = ctx.rows.slice().sort(function (a, b) {
      return (b.coverage || 0) - (a.coverage || 0);
    }).map(function (r) {
      /* a text field, not a number one: the demo shows grouped thousands the way
         every other amount on the page does, and strips the separators on input */
      var ceilCell = mayEdit
        ? '<span class="p7-edit"><span class="p7-cur">$</span>' +
          '<input class="p7-ceil num" type="text" inputmode="numeric" ' +
          'autocomplete="off" data-p7="ceiling" data-c="' + e(r.code) + '" value="' +
          e(r.ceiling.toLocaleString('en-US')) +
          '" aria-label="' + e(r.name) + ' ceiling in US dollars"></span>'
        : '<span class="num">' + e(D.money(r.ceiling)) + '</span>';

      var gap = r.over > 0
        ? '<span class="num neg">' + e(D.money(r.over)) + ' over</span>'
        : '<span class="num">' + e(D.money(r.headroom)) + ' left</span>';

      return '<tr><td>' + e(r.name) + ' <span class="p7-code">' + e(r.code) + '</span></td>' +
        '<td class="r">' + ceilCell + '</td>' +
        '<td class="r">' + e(D.money(r.committed)) + '</td>' +
        '<td>' + U.budgetBar(r.coverage, { scale: scale, sm: true,
          title: r.name + ' · ' + D.pct(r.coverage) + ' of the ceiling' }) + '</td>' +
        '<td class="r">' + U.coverageCell(r.coverage) + '</td>' +
        '<td class="r">' + gap + '</td>' +
        '<td class="r num">' + r.queue + '</td></tr>';
    }).join('');

    var totalCov = D.coverage(ctx.committed, ctx.ceiling);
    var foot = '<tr class="p7-tot"><td>Total</td>' +
      '<td class="r num">' + e(D.money(ctx.ceiling)) + '</td>' +
      '<td class="r num">' + e(D.money(ctx.committed)) + '</td>' +
      '<td></td>' +
      '<td class="r">' + U.coverageCell(totalCov) + '</td>' +
      '<td class="r">' + (ctx.committed > ctx.ceiling
        ? '<span class="num neg">' + e(D.money(ctx.committed - ctx.ceiling)) + ' over</span>'
        : '<span class="num">' + e(D.money(ctx.headroom)) + ' left</span>') + '</td>' +
      '<td class="r num">' + ctx.rows.reduce(function (a, r) { return a + r.queue; }, 0) +
      '</td></tr>';

    return U.card('Country ceilings — ' + CBP.CONFIG.BUDGET_YEAR,
      U.table([
        { label: 'Country' }, { label: 'Ceiling', right: true },
        { label: 'Committed', right: true }, { label: 'Utilisation' },
        { label: 'Coverage', right: true }, { label: 'Headroom / over', right: true },
        { label: 'Queue', right: true }
      ], [rows + foot]) +
      (mayEdit
        ? '<p class="p7-note">Type a new ceiling to reset a country’s allocation — coverage, ' +
          'the utilisation bar, the league table and the dashboard all recompute on the spot ' +
          '(nothing here is stored pre-computed).</p>'
        : '<p class="p7-note">Ceilings are set by Admin and Regional Managers. ' +
          'Queue counts every record not yet in implementation.</p>'),
      { cls: 'p7-card' });
  }

  /* =========================================================== reports ==== */

  function statusList() {
    return CBP.CONFIG.STATUS_ORDER.map(function (k) {
      return { k: String(k), label: CBP.CONFIG.STATUS[k].label };
    });
  }

  /* the live model behind the report table — countries down, chosen measures
     across, every figure straight out of derive.js */
  function reportRows(state, user, codes, rep) {
    var pool = D.visibleProjects(user, state.projects, state.countries);
    var wanted = rep.countries.length
      ? codes.filter(function (c) { return rep.countries.indexOf(c) > -1; })
      : codes;

    return state.countries.filter(function (c) {
      return wanted.indexOf(c.code) > -1;
    }).map(function (c) {
      var mine = pool.filter(function (p) {
        if (p.country !== c.code) return false;
        if (!rep.statuses.length) return true;
        return rep.statuses.indexOf(String(p.status)) > -1;
      });
      var committed = D.committedTotal(mine);
      var gates = mine.reduce(function (a, p) { return a + D.openGates(p).length; }, 0);
      var unread = mine.reduce(function (a, p) { return a + D.unreadFor(user, p.id); }, 0);
      return {
        code: c.code, name: c.name, count: mine.length,
        committed: committed, ceiling: c.ceiling,
        utilisation: D.utilisation(committed, c.ceiling),
        queue: D.queueCount(mine), gates: gates, unread: unread
      };
    });
  }

  function cellFor(k, r) {
    if (k === 'committed')   return e(D.money(r.committed));
    if (k === 'ceiling')     return e(D.money(r.ceiling));
    if (k === 'utilisation') return '<span' + (r.utilisation > 100 ? ' class="neg"' : '') + '>' +
                                    e(D.pct(r.utilisation)) + '</span>';
    if (k === 'queue')       return r.queue;
    if (k === 'gates')       return r.gates ? '<span class="neg">' + r.gates + '</span>' : '0';
    if (k === 'unread')      return r.unread;
    return '';
  }

  function totalFor(k, rows) {
    if (k === 'ceiling' || k === 'committed') {
      return e(D.money(rows.reduce(function (a, r) { return a + r[k]; }, 0)));
    }
    if (k === 'utilisation') {
      var cm = rows.reduce(function (a, r) { return a + r.committed; }, 0);
      var cl = rows.reduce(function (a, r) { return a + r.ceiling; }, 0);
      return e(D.pct(D.utilisation(cm, cl)));
    }
    return rows.reduce(function (a, r) { return a + (r[k] || 0); }, 0);
  }

  function reportsTab(state, user, codes) {
    var rep = state.ui.p7ReportDraft;
    var rows = reportRows(state, user, codes, rep);
    var cols = COLS.filter(function (c) { return rep.cols.indexOf(c.k) > -1; });
    var saved = sameReport(rep, state.ui.p7Report);

    /* ------------------------------------------------------- the builder */
    var chips = '<div class="p7-rgrp"><span class="p7-rlab">Countries</span>' +
      '<button type="button" class="chip' + (rep.countries.length ? '' : ' on') +
        '" data-act="p7r-allc">All in scope</button>' +
      codes.map(function (c) {
        var on = rep.countries.indexOf(c) > -1;
        return '<button type="button" class="chip' + (on ? ' on' : '') +
          '" aria-pressed="' + on + '" data-act="p7r-country" data-c="' + e(c) + '">' +
          e(countryName(state, c)) + '</button>';
      }).join('') + '</div>';

    chips += '<div class="p7-rgrp"><span class="p7-rlab">Statuses</span>' +
      '<button type="button" class="chip' + (rep.statuses.length ? '' : ' on') +
        '" data-act="p7r-alls">All statuses</button>' +
      statusList().map(function (s) {
        var on = rep.statuses.indexOf(s.k) > -1;
        return '<button type="button" class="chip' + (on ? ' on' : '') +
          '" aria-pressed="' + on + '" data-act="p7r-status" data-s="' + e(s.k) + '">' +
          e(s.label) + '</button>';
      }).join('') + '</div>';

    chips += '<div class="p7-rgrp"><span class="p7-rlab">Columns</span>' +
      COLS.map(function (c) {
        var on = rep.cols.indexOf(c.k) > -1;
        return '<button type="button" class="chip' + (on ? ' on' : '') +
          '" aria-pressed="' + on + '" data-act="p7r-col" data-col="' + e(c.k) + '">' +
          e(c.label) + '</button>';
      }).join('') + '</div>';

    var acts = '<div class="p7-racts">' +
      (D.can(user, 'export')
        ? '<button type="button" class="btn" data-act="p7r-print">Print / export</button>' : '') +
      '<button type="button" class="btn" data-act="p7r-save"' + (saved ? ' disabled' : '') + '>' +
        'Save as default</button>' +
      '<button type="button" class="btn" data-act="p7r-reset"' + (saved ? ' disabled' : '') + '>' +
        'Reset to saved</button>' +
      '<span class="p7-rstate">' +
        (saved ? 'This is your saved default report.'
               : 'Unsaved changes to the report definition.') +
      '</span></div>';

    /* --------------------------------------------------------- the table */
    var table;
    if (!rows.length) {
      table = '<div class="p7-empty">No country matches this selection.</div>';
    } else if (!cols.length) {
      table = '<div class="p7-empty">Pick at least one column to build the report.</div>';
    } else {
      var head = [{ label: 'Country' }, { label: 'Records', right: true }]
        .concat(cols.map(function (c) { return { label: c.label, right: true }; }));
      var body = rows.map(function (r) {
        return '<tr><td>' + e(r.name) + ' <span class="p7-code">' + e(r.code) + '</span></td>' +
          '<td class="r num">' + r.count + '</td>' +
          cols.map(function (c) {
            return '<td class="r num">' + cellFor(c.k, r) + '</td>';
          }).join('') + '</tr>';
      }).join('');
      var foot = '<tr class="p7-tot"><td>Total</td>' +
        '<td class="r num">' + rows.reduce(function (a, r) { return a + r.count; }, 0) + '</td>' +
        cols.map(function (c) {
          return '<td class="r num">' + totalFor(c.k, rows) + '</td>';
        }).join('') + '</tr>';
      table = U.table(head, [body + foot]);
    }

    var scopeTxt = (rep.countries.length ? rep.countries.join(', ') : 'all countries in scope') +
      ' · ' + (rep.statuses.length
        ? rep.statuses.map(function (k) {
            return CBP.CONFIG.STATUS[k === 'declined' ? 'declined' : +k].short;
          }).join(', ')
        : 'all statuses');

    var html = printHead(state, scopeTxt);

    html += U.card('Report builder', chips + acts, { cls: 'p7-card p7-builder' });

    html += U.card('Report — ' + CBP.CONFIG.BUDGET_YEAR,
      '<p class="p7-rscope">' + e(scopeTxt) + ' · prepared ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + '</p>' + table,
      { cls: 'p7-card' });

    html += '<p class="pagenote">The table rebuilds from derive.js on every chip you touch — ' +
      'nothing here is cached. Gate exceptions count open Decision Point and CHaS sub-steps; ' +
      'unread comments count what is unread for you, from the same D.unreadCount the sidebar ' +
      'balloon uses. Print / export produces the dated one-page pre-read (RD-3) with the ' +
      'builder controls stripped out. “Save as default” stores this definition for your ' +
      'session, so the report you meet next time is the one you built.</p>';

    return html;
  }

  function printHead(state, scopeTxt) {
    return '<div class="p7-print">' +
      '<h2>Budget report — ' + e(CBP.CONFIG.BUDGET_YEAR) + '</h2>' +
      '<p>' + e(scopeTxt) + ' · prepared ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) + ' · ' +
      e(state.user.name) + '</p></div>';
  }

  function countryName(state, code) {
    var c = state.countries.filter(function (x) { return x.code === code; })[0];
    return c ? c.name : code;
  }

  /* ======================================================= forecasting ====
     v1.0.3 — every actual year is a configured number rather than a fixture
     read (state.histEdit), the live budget year stays summed from the records,
     and the year set itself is editable in both directions: 'Add earlier year'
     prepends min(history)-1 back-cast from the trend, 'Add later year' appends
     a plan year after the last one. The projection re-fits over whatever years
     are on screen, so the table, the ≈ simulation and the comparison block can
     never disagree about the same line. */

  var LIVE = function () { return +CBP.CONFIG.BUDGET_YEAR; };

  function amountValue(n) {
    return (n === null || n === undefined) ? '' : n.toLocaleString('en-US');
  }

  /* a money cell that a planner may type into, and plain text for everyone else.
     One idiom for the history years and the plan years alike — the only
     difference is which action the change handler routes to. */
  function moneyCell(may, attrs, label, amount, pctVal) {
    var tail = '<span class="p7-planpct num' +
      (pctVal !== null && pctVal !== undefined && pctVal > 100 ? ' neg' : '') + '">' +
      e(D.pct(pctVal)) + '</span>';
    if (!may) {
      return '<span class="num">' + e(D.money(amount)) + '</span>' + tail;
    }
    return '<span class="p7-edit"><span class="p7-cur">$</span>' +
      '<input class="p7-plan num" type="text" inputmode="numeric" autocomplete="off" ' +
      attrs + ' value="' + e(amountValue(amount)) + '" aria-label="' + e(label) + '"></span>' +
      tail;
  }

  /* a column header, with the × that removes an added year again */
  function yearHead(label, sub, opts) {
    opts = opts || {};
    return '<th class="r p7-yh"' + (opts.title ? ' title="' + e(opts.title) + '"' : '') + '>' +
      '<span class="p7-yhl">' + e(label) +
      (opts.del
        ? '<button type="button" class="p7-ydel" data-act="p7y-del" data-kind="' +
          e(opts.del.kind) + '" data-y="' + e(String(opts.del.year)) + '" title="' +
          e('Remove the ' + opts.del.year + ' column') + '" aria-label="' +
          e('Remove the ' + opts.del.year + ' column') + '">×</button>'
        : '') +
      '</span>' + (sub ? '<small>' + e(sub) + '</small>' : '') + '</th>';
  }

  function forecastTab(state, user, codes) {
    var all = D.forecastRows(state.projects, state.countries);
    var rows = all.filter(function (r) { return codes.indexOf(r.code) > -1; });
    var mayPlan = D.can(user, 'plan');
    var live = LIVE();

    if (!rows.length) {
      return U.card('Forecasting',
        '<div class="p7-empty">No countries in your scope carry budget history.</div>',
        { cls: 'p7-card' });
    }

    var actual = D.actualYears();              /* history years … + the live year */
    var plans = D.planYears();                 /* 2027 … */
    var projYear = rows[0].projYear;
    var multiPlan = plans.length > 1;

    /* one scale across every year, the simulation and every plan, so the
       comparison block and the table read against the same 100% */
    var pcts = [];
    rows.forEach(function (r) {
      r.years.forEach(function (x) { if (x.pct !== null && x.pct !== undefined) pcts.push(x.pct); });
      r.plans.forEach(function (x) { if (x.pct !== null && x.pct !== undefined) pcts.push(x.pct); });
      if (r.proj2027pct !== null && r.proj2027pct !== undefined) pcts.push(r.proj2027pct);
    });
    var scale = D.barScale(pcts);

    var liveTitle = live + ' is summed from the live records on every render — an amount ' +
      'edited anywhere in the demo moves it. It is derived, so it is never typed here.';

    /* ------------------------------------------------------- the header -- */
    var head = '<tr><th>Country</th>';
    actual.forEach(function (y) {
      if (y === live) {
        head += yearHead(String(y), 'live · derived %', { title: liveTitle });
      } else {
        head += yearHead(String(y), 'committed $ · %', {
          del: D.isFixedYear(y) ? null : { kind: 'history', year: y }
        });
      }
    });
    head += yearHead(projYear + ' projected', 'simulated', {
      title: 'A least-squares line through every actual year above, extended one year. ' +
             'Nothing is stored — it re-fits whenever a figure moves.'
    });
    plans.forEach(function (y) {
      head += yearHead(y + ' plan', 'plan $ · %', {
        del: D.isFixedYear(y) ? null : { kind: 'plan', year: y }
      });
    });
    head += '<th>Variance note</th></tr>';

    /* --------------------------------------------------------- the body -- */
    var body = rows.map(function (r) {
      var tds = '<td>' + e(r.name) + ' <span class="p7-code">' + e(r.code) + '</span></td>';

      r.years.forEach(function (x) {
        if (x.live) {
          tds += '<td class="r num' + (x.pct > 100 ? ' neg' : '') + '" title="' +
            e(liveTitle + ' · ' + D.money(x.committed)) + '">' + e(D.pct(x.pct)) + '</td>';
          return;
        }
        tds += '<td class="r">' + moneyCell(mayPlan,
          'data-p7hist="' + e(r.code) + '" data-y="' + e(String(x.year)) + '"',
          r.name + ' ' + x.year + ' committed in US dollars',
          x.committed, x.pct) + '</td>';
      });

      tds += (r.proj2027pct === null || r.proj2027pct === undefined)
        ? '<td class="r num">—</td>'
        : '<td class="r num p7-sim' + (r.proj2027pct > 100 ? ' neg' : '') + '" title="' +
          e('Simulated from the ' + actual[0] + '–' + actual[actual.length - 1] +
            ' trend · ≈ ' + D.money(r.proj2027)) + '">≈ ' + e(D.pct(r.proj2027pct)) + '</td>';

      r.plans.forEach(function (x) {
        tds += '<td class="r">' + moneyCell(mayPlan,
          'data-p7plan="' + e(r.code) + '" data-y="' + e(String(x.year)) + '"',
          r.name + ' ' + x.year + ' plan in US dollars',
          x.value, x.pct) + '</td>';
      });

      return '<tr>' + tds + '<td class="p7-fnote">' + e(r.note) + '</td></tr>';
    }).join('');

    /* enough room for country + every year column + the note, so the table
       scrolls inside its own card rather than widening the page */
    var minW = 190 + (actual.length + plans.length + 1) * 124 + 190;

    var yearActs = mayPlan
      ? '<div class="p7-yacts">' +
          '<button type="button" class="p7-yadd" data-act="p7y-add-hist">+ Add earlier year</button>' +
          '<button type="button" class="p7-yadd" data-act="p7y-add-plan">+ Add later year</button>' +
          '<span class="p7-ynote">A new column is seeded from the trend, rounded to the ' +
            'nearest ' + e(D.money(D.SEED_ROUND)) + ', and is editable like any other.</span>' +
        '</div>'
      : '';

    var table = '<div class="tblwrap"><table class="tbl p7-ftbl" style="min-width:' +
      minW + 'px"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';

    var html = U.card('Utilisation by year — ' + rows.length +
      (rows.length === 1 ? ' country' : ' countries'),
      yearActs + table + err(state, 'hist') + err(state, 'plan') +
      (mayPlan
        ? '<p class="p7-note">Every year except ' + live + ' is a figure you can type: change ' +
          'a committed amount or a plan and the percentage beside it, the variance note, the ' +
          'projection and the comparison block below all recompute in the same render pass. ' +
          live + ' is summed from the live records instead, so it moves only when a project ' +
          'amount does. Planning figures are M1, M2 and the area office (docs/01). ' +
          '“' + projYear + ' projected” is a simulation — a least-squares line through every ' +
          'actual year on this table, extended one year — so the gap to your plan is the ' +
          'decision, not the arithmetic.</p>'
        : '<p class="p7-note">Budget history and the plan are set by M1, M2 and the area ' +
          'office (docs/01), so every figure here is read-only for you. ' + live + ' is ' +
          'summed from the live records and is derived for everyone.</p>'),
      { cls: 'p7-card' });

    html += U.card(actual[0] + ' – ' + plans[plans.length - 1] + ' comparison',
      compareBlock(rows, scale, multiPlan),
      { cls: 'p7-card' });

    html += '<p class="pagenote">The earlier years are configured amounts (seeded from ' +
      'budget_history in data.js and held in state, not read back from the fixture); ' + live +
      ' is summed from the live records on every render, so an amount edited anywhere in the ' +
      'demo moves it here too. Every bar shares one 0–' + scale + '% scale — the 100% rule is ' +
      'the same line on every row, and each caret marks a plan year against the same ceiling. ' +
      'Percentages are committed against the country ceiling, not spend.</p>';

    return html;
  }

  /* per-country grouped bars — one solid bar per actual year, the faded ≈
     simulation, and one caret per plan year at its own x. The rule and the
     carets are placed with the same calc the bars are, so they line up with
     the ticks exactly. */
  function compareBlock(rows, scale, multiPlan) {
    var f = 100 / scale;
    var live = LIVE();

    var groups = rows.map(function (r) {
      var series = r.years.map(function (x) {
        return { y: String(x.year), v: x.pct, live: x.live };
      });
      series.push({ y: String(r.projYear), v: r.proj2027pct, sim: true });

      var span = r.years.length
        ? r.years[0].year + '–' + r.years[r.years.length - 1].year : '';

      var bars = series.map(function (x) {
        if (x.v === null || x.v === undefined) {
          return '<div class="p7-frow"><span class="p7-fy">' + e(x.y) + '</span>' +
            '<span class="p7-fbar"><span class="p7-fnone">no history</span></span>' +
            '<span class="p7-fv num">—</span></div>';
        }
        var simCls = x.sim ? ' sim' : '';
        return '<div class="p7-frow' + simCls + '"><span class="p7-fy">' + e(x.y) +
          (x.sim ? '<small>proj.</small>' : (x.live ? '<small>live</small>' : '')) + '</span>' +
          '<span class="p7-fbar">' +
            U.budgetBar(x.v, { scale: scale, sm: true,
              title: x.sim
                ? r.name + ' ' + x.y + ' · ≈ ' + D.pct(x.v) +
                  ' — simulated from the ' + span + ' trend'
                : r.name + ' ' + x.y + ' · ' + D.pct(x.v) + ' of the ceiling' }) +
          '</span><span class="p7-fv num' + (x.v > 100 ? ' neg' : '') + '">' +
          (x.sim ? '≈ ' : '') + e(D.pct(x.v)) + '</span></div>';
      }).join('');

      /* one caret per plan year; with more than one they carry their year, so
         two carets on the same track can never be read as one number */
      var plan = r.plans.map(function (x) {
        if (x.pct === null || x.pct === undefined) return '';
        return '<span class="p7-fplan" style="--p7-fx:' + (x.pct / scale).toFixed(6) + '" ' +
          'title="' + e(x.year + ' plan ' + D.money(x.value) + ' · ' + D.pct(x.pct)) +
          '"><i></i><b class="num">' +
          e((multiPlan ? x.year + ' · ' : '') + D.pct(x.pct)) + '</b></span>';
      }).join('');

      return '<div class="p7-fgrp"><div class="p7-fname">' + e(r.name) +
        ' <span class="p7-code">' + e(r.code) + '</span></div>' +
        '<div class="p7-ftrack' + (multiPlan ? ' multi' : '') +
        '" style="--p7-utick:' + f.toFixed(6) + '">' +
        '<span class="p7-frule" aria-hidden="true"></span>' + plan + bars +
        '</div></div>';
    }).join('');

    var projYear = rows.length ? rows[0].projYear : '';

    return '<div class="p7-fcompare">' + groups + '</div>' +
      '<p class="p7-note"><span class="p7-fkey"></span>Each caret marks a plan year; the ' +
      'faded last bar is the simulated ' + e(String(projYear)) + ' projection, a least-squares ' +
      'line through every actual year above it. The vertical rule is 100% of the country ' +
      'ceiling — the same x on every bar, so a year that crosses it is over-committed by ' +
      'exactly the hatched part. Every year before ' + live + ' is a configured amount; ' +
      live + ' is summed from the live records.</p>';
  }

  /* ==================================================== event wiring ====== */

  function on7() {
    return !!(CBP.state && CBP.state.ui && CBP.state.ui.route === 'budget' && CBP.state.ui.p7);
  }

  function closest(node, sel) {
    return (node && node.closest) ? node.closest(sel) : null;
  }

  /* RD-3 — the same print path P2 uses: a hidden dated header becomes the page,
     the chrome is dropped by @media print, and the browser's own dialog does
     the rest. There is no file round-trip in the demo. */
  function doExport() {
    try {
      document.body.classList.add('p7-printing');
      var clear = function () { document.body.classList.remove('p7-printing'); };
      try { window.addEventListener('afterprint', clear, { once: true }); } catch (err) { /* noop */ }
      window.print();
      window.setTimeout(clear, 1200);
    } catch (err) { /* headless / blocked */ }
  }

  function toggle(list, v) {
    var i = list.indexOf(v);
    if (i > -1) list.splice(i, 1); else list.push(v);
  }

  /* the league table below carries the shared sortable heads (data-p2="sort");
     P2's handler is route-guarded, so P7 sorts through its own state */
  document.addEventListener('click', function (ev) {
    if (!on7()) return;
    var t = closest(ev.target, '[data-p2="sort"]');
    if (!t) return;
    ev.preventDefault();
    var s = CBP.state.ui.p7;
    var col = t.getAttribute('data-col');
    s.sort = (s.sort.col === col)
      ? { col: col, dir: s.sort.dir === 'desc' ? 'asc' : 'desc' }
      : { col: col, dir: col === 'name' ? 'asc' : 'desc' };
    CBP.render();
  });

  /* report builder — every control is a data-act with the p7r- prefix, one
     delegated listener, registered once at load */
  document.addEventListener('click', function (ev) {
    if (!on7()) return;
    var t = closest(ev.target, '[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (!act || act.indexOf('p7r-') !== 0) return;
    ev.preventDefault();

    var state = CBP.state;
    var rep = state.ui.p7ReportDraft || (state.ui.p7ReportDraft = copyReport(state.ui.p7Report));

    if (act === 'p7r-print')        { doExport(); return; }
    else if (act === 'p7r-country') { toggle(rep.countries, t.getAttribute('data-c')); }
    else if (act === 'p7r-allc')    { rep.countries = []; }
    else if (act === 'p7r-status')  { toggle(rep.statuses, t.getAttribute('data-s')); }
    else if (act === 'p7r-alls')    { rep.statuses = []; }
    else if (act === 'p7r-col')     { toggle(rep.cols, t.getAttribute('data-col')); }
    else if (act === 'p7r-save') {
      state.ui.p7Report = copyReport(rep);
      CBP.notice('Report definition saved as your default — ' +
        (rep.countries.length ? rep.countries.length + ' country selection' : 'all countries') +
        ', ' + (rep.statuses.length ? rep.statuses.length + ' statuses' : 'all statuses') +
        ', ' + rep.cols.length + ' columns. It is what the Reports tab opens with from now on.');
    } else if (act === 'p7r-reset') {
      state.ui.p7ReportDraft = copyReport(state.ui.p7Report);
    } else { return; }

    CBP.render();
  });

  /* ceiling edit — mutate state.countries, then one render pass rebuilds every
     derived number on the page */
  document.addEventListener('input', function (ev) {
    if (!on7()) return;
    var t = ev.target;
    if (!t || !t.getAttribute || t.getAttribute('data-p7') !== 'ceiling') return;
    if (!D.can(CBP.state.user, 'setCeiling')) return;

    var s = CBP.state.ui.p7;
    var code = t.getAttribute('data-c');
    var raw = t.value;
    var n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);

    if (raw === '' || isNaN(n)) {          /* mid-typing — leave the number alone */
      s.err = null;
      return;
    }

    var c = CBP.state.countries.filter(function (x) { return x.code === code; })[0];
    if (!c) return;
    c.ceiling = Math.max(0, n);
    s.edit = code;
    s.err = null;
    CBP.render();

    /* put the caret back in the box the edit came from */
    var el = document.querySelector('[data-p7="ceiling"][data-c="' + code + '"]');
    if (el) {
      el.focus();
      try { el.setSelectionRange(el.value.length, el.value.length); } catch (err) {}
    }
  });

  /* plan and history amounts — committed on change (which is also what a blur
     after an edit fires), never on every keystroke: both are logged, noticed
     writes through CBP.actions, and both are viewer-locked there as well as
     here. A digit-free entry is refused by the action and surfaces inline. */
  document.addEventListener('change', function (ev) {
    if (!on7()) return;
    var t = ev.target;
    if (!t || !t.getAttribute) return;

    var planCode = t.getAttribute('data-p7plan');
    var histCode = t.getAttribute('data-p7hist');
    if (!planCode && !histCode) return;
    if (!D.can(CBP.state.user, 'plan')) return;

    var year = parseInt(t.getAttribute('data-y'), 10);
    var raw = String(t.value === undefined || t.value === null ? '' : t.value);
    var n = Math.round(Number(raw.replace(/[^0-9.\-]/g, '')));
    var typed = /\d/.test(raw) && isFinite(n);

    /* re-entering the same figure is not an edit — skip it rather than let the
       action refuse with "Nothing changed" */
    var res;
    if (planCode) {
      if (!year) year = D.PLAN_BASE_YEAR;
      if (typed && n === D.planFor(planCode, year)) {
        CBP.state.ui.err = null;
        CBP.render();
        return;
      }
      res = A.planSet(planCode, raw, year);
    } else {
      var h = D.history(histCode, year);
      if (typed && h && n === h.committed) {
        CBP.state.ui.err = null;
        CBP.render();
        return;
      }
      res = A.histSet(histCode, year, raw);
    }
    if (!res || !res.ok) CBP.render();     /* a refusal only leaves ui.err behind */
  });

  /* adding and removing a year column — area-level writes, so they carry the
     same 'plan' permission and the same viewer lock as the figures themselves,
     and the buttons are not rendered at all for anyone else */
  document.addEventListener('click', function (ev) {
    if (!on7()) return;
    var t = closest(ev.target, '[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (!act || act.indexOf('p7y-') !== 0) return;
    ev.preventDefault();
    if (!D.can(CBP.state.user, 'plan')) return;

    var res;
    if (act === 'p7y-add-hist')      res = A.histYearAdd();
    else if (act === 'p7y-add-plan') res = A.planYearAdd();
    else if (act === 'p7y-del') {
      res = A.yearRemove(t.getAttribute('data-kind'),
                         parseInt(t.getAttribute('data-y'), 10));
    } else return;

    if (!res || !res.ok) CBP.render();
  });

  /* exposed for the build harness — the same paths the controls use */
  CBP.p7 = { reportRows: reportRows, alignedBars: alignedBars, COLS: COLS };

})();
