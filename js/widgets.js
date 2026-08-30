/* widgets.js — C-18 dashboard widget library.
   Every widget is { id, title, size, render(state, scopeCountries, ctx) } and is
   registered in CBP.W.registry. Widgets are pure string builders: they read the
   scoped context built by CBP.W.ctx() and never touch the DOM or mutate state.

   Nothing here is hard-coded. Every number comes back through CBP.D (derive.js)
   from window.CBP_DATA, so the scope selector recomputes the whole board in one
   render() pass — the engine ported from reference/P2_Dashboard_UI_Sample_v3.html.

   Helpers that P2 needs but ui.js does not carry live here under CBP.W (the
   architect brief forbids adding them to ui.js). */
(function () {
  'use strict';

  var D = CBP.D, U = CBP.ui, e = CBP.ui.esc;
  var W = {};
  CBP.W = W;

  /* ====================================================== small helpers === */

  W.money = D.money;
  W.pct = D.pct;
  W.days = D.days;

  W.plural = function (n, one, many) {
    return n + ' ' + (n === 1 ? one : (many || one + 's'));
  };

  /* status ladder as the budget bar draws it: 1 → 4, left to right */
  var LADDER = [1, 2, 3, 4];
  var SCOL = { 1: 'var(--s1)', 2: 'var(--s2)', 3: 'var(--s3)', 4: 'var(--s4)' };

  W.countryName = function (state, code) {
    var c = state.countries.filter(function (x) { return x.code === code; })[0];
    return c ? c.name : code;
  };

  /* ------------------------------------------- v1.0.4 · country identity ---
     The same grammar the P3 register and the P11 hub use: the flag glyph plus
     the .cc-<code> palette class from css/app.css (C-21). Both resolve from the
     CODE alone, and a country the palette has never heard of falls back to the
     neutral .cc-x swatch with no glyph — so a seventh country arriving in the
     fixtures renders a complete row on day one, and the dash.css rules below
     name every colour with a .cc-x fallback so it is legible even before the
     palette learns its three tones. */
  var FLAG = {
    BGD: '🇧🇩', NPL: '🇳🇵', KHM: '🇰🇭', IND: '🇮🇳',
    MMR: '🇲🇲', LAO: '🇱🇦', HKG: '🇭🇰'
  };

  W.ccOf = function (code) {
    var k = String(code || '').toUpperCase();
    return FLAG[k] ? 'cc-' + k.toLowerCase() : 'cc-x';
  };

  /* aria-hidden: the country name is always printed beside the glyph */
  W.flagMark = function (code) {
    var f = FLAG[String(code || '').toUpperCase()];
    return f ? '<span class="ccflag" aria-hidden="true">' + f + '</span>' : '';
  };

  /* ================================================== scope (C-20 engine) == */

  /* countries this user may ever see — the scope selector offers no more */
  W.allowedCodes = function (state) {
    return D.visibleCountries(state.user, state.countries);
  };

  /* the remembered selection for a dashboard, sanitised against the user's data
     scope and never empty (unticking the last one re-ticks it) */
  W.scopeFor = function (state, dashId) {
    var allowed = W.allowedCodes(state);
    var saved = state.scopeByDashboard[dashId];
    var picked = (saved || []).filter(function (c) { return allowed.indexOf(c) > -1; });
    if (!picked.length) picked = allowed.slice();
    /* keep the canonical country order so the label reads predictably */
    return allowed.filter(function (c) { return picked.indexOf(c) > -1; });
  };

  W.setScope = function (state, dashId, codes) {
    var allowed = W.allowedCodes(state);
    var next = codes.filter(function (c) { return allowed.indexOf(c) > -1; });
    if (!next.length) return false;                    /* never empty */
    state.scopeByDashboard[dashId] = next;
    return true;
  };

  W.toggleCountry = function (state, dashId, code) {
    var cur = W.scopeFor(state, dashId);
    var next = cur.indexOf(code) > -1
      ? cur.filter(function (c) { return c !== code; })
      : cur.concat([code]);
    return W.setScope(state, dashId, next);            /* false = kept, was last */
  };

  W.scopeLabel = function (state, codes) {
    var allowed = W.allowedCodes(state);
    if (codes.length === allowed.length) return 'All countries';
    if (codes.length === 1) return W.countryName(state, codes[0]);
    return codes.length + ' countries';
  };

  /* C-04 sort state, remembered per dashboard board id so one widget placed on
     two boards sorts independently on each */
  W.sortFor = function (state, dashId) {
    var d = state.ui && state.ui.dash;
    var all = (d && d.sort) || {};
    return all[dashId] || { col: 'coverage', dir: 'desc' };
  };

  W.scopeTitle = function (state, codes) {
    var allowed = W.allowedCodes(state);
    if (codes.length === allowed.length && allowed.length === state.countries.length) {
      return 'Asia Area';
    }
    if (codes.length === 1) return W.countryName(state, codes[0]);
    return codes.map(function (c) { return W.countryName(state, c); }).join(' · ');
  };

  /* ================================================= the scoped context === */

  /* Built once per render pass and handed to every widget, so all of them agree
     on the same derived numbers. */
  W.ctx = function (state, codes, dashId) {
    var inScopeOfUser = D.visibleProjects(state.user, state.projects, state.countries);
    var projects = inScopeOfUser.filter(function (p) { return codes.indexOf(p.country) > -1; });

    /* r.queue already carries D.queueCount() from derive.js */
    var rows = D.countryRollup(projects, state.countries, codes).map(function (r) {
      r.unassigned = r.projects.filter(function (p) { return !p.owner; }).length;
      return r;
    });

    var ceiling = rows.reduce(function (a, r) { return a + r.ceiling; }, 0);
    var committed = rows.reduce(function (a, r) { return a + r.committed; }, 0);
    var over = rows.filter(function (r) { return r.over > 0; });

    return {
      state: state,
      codes: codes,
      dashId: dashId || null,
      projects: projects,
      rows: rows,
      countries: state.countries.filter(function (c) { return codes.indexOf(c.code) > -1; }),
      ceiling: ceiling,
      committed: committed,
      coverage: D.coverage(committed, ceiling),
      overRows: over,
      overAmount: over.reduce(function (a, r) { return a + r.over; }, 0),
      headroom: ceiling - committed,
      byStatus: D.amountByStatus(projects),
      counts: D.statusRollups(projects),
      unassigned: projects.filter(function (p) { return !p.owner; }),
      today: CBP.CONFIG.TODAY,
      title: W.scopeTitle(state, codes)
    };
  };

  /* ======================================================= activity feed == */

  /* RD-4 reads the typed activity stream. B1's store seeds state.activity from
     CBP_DATA.activity_seed; until it does, fall back to the raw seed so this
     page is never blocked. Entries posted during the demo (state.log) join in. */
  W.activity = function (state) {
    var base = (state.activity && state.activity.length)
      ? state.activity
      : ((window.CBP_DATA && CBP_DATA.activity_seed) || []);

    var out = base.map(function (x) {
      return {
        id: x.id || null,
        project: x.project || x.project_id,
        type: x.type,
        body: x.body,
        author: x.author,
        at: x.at,
        pinned: !!x.pinned,
        assigned_to: x.assigned_to || null,
        resolved_at: x.resolved_at || null
      };
    });

    /* state.log is an alias of state.activity in the current store; only fold it
       in when it is genuinely a second ledger, and never twice for one entry */
    var seen = {};
    out.forEach(function (x) { if (x.id) seen[x.id] = true; });
    var extra = (state.log && state.log !== base && state.log !== state.activity)
      ? state.log : [];
    extra.forEach(function (l) {
      if (l.id && seen[l.id]) return;
      out.push({
        id: l.id || null, project: l.project || l.project_id, type: l.type,
        body: l.body, author: l.author, at: l.at, pinned: !!l.pinned,
        assigned_to: l.assigned_to || null, resolved_at: l.resolved_at || null
      });
    });

    return out;
  };

  W.activityInScope = function (ctx) {
    var ids = {};
    ctx.projects.forEach(function (p) { ids[p.id] = p; });
    return W.activity(ctx.state).filter(function (a) { return !!ids[a.project]; })
      .map(function (a) { a._p = ids[a.project]; return a; });
  };

  /* ========================================================= delegations == */

  W.delegations = function (state) {
    var raw = (state.delegations && state.delegations.length)
      ? state.delegations
      : ((window.CBP_DATA && CBP_DATA.delegations) || []);
    return raw.map(function (d) {
      var from = d.from, to = d.to;
      var startsIn = D.daysBetween(CBP.CONFIG.TODAY, from);
      var endsIn = D.daysBetween(CBP.CONFIG.TODAY, to);
      return {
        away: d.away, delegate: d.delegate, from: from, to: to,
        reason: d.reason || null,
        active: startsIn <= 0 && endsIn >= 0,
        startsIn: startsIn, endsIn: endsIn,
        awayUser: CBP.userById(d.away), delegateUser: CBP.userById(d.delegate)
      };
    });
  };

  W.userCountries = function (u) {
    if (!u) return [];
    var scope = u.role === 'viewer' ? u.view_scope : u.country_scope;
    if (!scope || scope === 'all') return null;      /* null = every country */
    return scope;
  };

  W.coversAny = function (u, codes) {
    var s = W.userCountries(u);
    if (s === null) return true;
    return s.some(function (c) { return codes.indexOf(c) > -1; });
  };

  /* ============================================== attention alert engine == */

  /* The seeded rows in CBP_DATA.seed_attention carry the client-confirmed
     WORDING; the numbers always come from the live derivation. A seed string
     that embeds a value can therefore go stale the moment the demo walk moves
     the data — the over-ceiling seed hard-codes "$310,801", which is wrong as
     soon as a Bangladesh project is approved. So `okIf` lets each caller state
     what must still be true for the confirmed wording to be usable; when it no
     longer holds, the derived line is used instead.

     At a pristine load every derived line below is byte-identical to its seed,
     so this guard changes nothing until the data actually moves. */
  function seedText(rule, match, okIf) {
    var seeds = (window.CBP_DATA && CBP_DATA.seed_attention) || [];
    var hit = seeds.filter(function (s) {
      if (s.rule !== rule) return false;
      if (match.project && s.project !== match.project) return false;
      if (match.country && s.country !== match.country) return false;
      if (match.system && s.system !== match.system) return false;
      return true;
    })[0];
    if (!hit) return null;
    if (okIf && !okIf(hit)) return null;      /* seed has gone stale — derive */
    return hit.text;
  }

  var SEV_RANK = { rose: 0, brass: 1, '': 2 };

  /* ------------------------------------------------------------------------
     ONE derivation of "what is exceptional in this scope", shared by the P2
     attention widget and the RD-2 director digest on P8, so the two can never
     disagree about a number. Four groups, each already scope-filtered.
     ------------------------------------------------------------------------ */
  W.exceptionSet = function (ctx) {
    var gate = [], overdue = [], gated = {};

    /* A · external gate idle — each open sub-step carries its own counter */
    ctx.projects.forEach(function (p) {
      D.openGates(p).forEach(function (g) {
        gated[p.id] = true;
        gate.push({
          project: p, gate: g, days: g.days, overdue: !!g.overdue,
          country: p.country,
          text: seedText('gate-idle', { project: p.id, system: g.key }) ||
                (g.label + ' gate — submitted ' + D.fmtDate(g.submitted_at) +
                 ', no approval yet')
        });
      });
    });

    /* B · country over its ceiling */
    var over = ctx.overRows.map(function (r) {
      return {
        row: r, country: r.code, coverage: r.coverage, amount: r.over,
        /* the seed embeds both the amount and the coverage — usable only while
           the derivation still agrees with it */
        text: seedText('over-ceiling', { country: r.code }, function (sd) {
                return sd.amount_over === Math.round(r.over) &&
                       sd.coverage === Math.round(r.coverage);
              }) ||
              (D.money(r.over) + ' above the ' + CBP.CONFIG.BUDGET_YEAR + ' allocation')
      };
    });

    /* C · overdue review — target passed, or sitting on the M1 desk beyond the
       review threshold, while still short of implementation. A record already
       listed at the gate is not repeated here. */
    ctx.projects.forEach(function (p) {
      if (gated[p.id]) return;
      var late = D.pastTarget(p);
      var waiting = (p.status === 3 && !D.gateStarted(p)) ? D.daysInStage(p) : null;
      var stale = waiting !== null && waiting > CBP.CONFIG.REVIEW_THRESHOLD_DAYS;
      if (!late && !stale) return;
      overdue.push({
        project: p, country: p.country,
        days: late || waiting, late: late, waiting: waiting,
        /* the seed names the status the record was sitting in; if it has since
           moved, derive the line instead */
        text: seedText('target-passed', { project: p.id }, function () {
                return !!late && p.status === 3;
              }) ||
              (late ? 'Target date passed, still in status ' + p.status +
                      (p.status === 3 ? ' review' : '')
                    : 'In M1 review ' + D.days(waiting) + ', past the ' +
                      CBP.CONFIG.REVIEW_THRESHOLD_DAYS + '-day threshold')
      });
    });

    /* D · no owner — alerts cannot route (D-14) */
    var unowned = ctx.unassigned.map(function (p) {
      return { project: p, country: p.country };
    });

    return {
      gate: gate.sort(function (a, b) { return b.days - a.days; }),
      over: over.sort(function (a, b) { return b.coverage - a.coverage; }),
      overdue: overdue.sort(function (a, b) { return b.days - a.days; }),
      unowned: unowned,
      unownedText: seedText('unassigned', {}) || 'No owner set — alerts cannot route',
      count: gate.length + over.length + overdue.length + (unowned.length ? 1 : 0),
      items: gate.length + over.length + overdue.length + unowned.length
    };
  };

  /* the P2 "Needs attention" rows, built from that one exception set.
     v1.0.4 — each row now also carries the country it belongs to (null for the
     one roll-up row that spans several), so the message widget can list a
     country's alerts without deriving them a second time. Nothing about the
     wording, the order or the exception set itself changes. */
  W.alerts = function (ctx) {
    var x = W.exceptionSet(ctx);
    var out = [];

    x.gate.forEach(function (i) {
      out.push({
        sev: i.overdue ? 'rose' : 'brass', pill: D.days(i.days), sort: i.days,
        title: i.project.id + ' · ' + i.project.name,
        sub: W.countryName(ctx.state, i.country) + ' · ' + i.text,
        href: '#/project/' + i.project.id, country: i.country
      });
    });

    x.over.forEach(function (i) {
      out.push({
        sev: 'rose', pill: D.pct(i.coverage), sort: i.coverage,
        title: i.row.name + ' over ceiling', sub: i.text, href: '#/projects',
        country: i.country
      });
    });

    x.overdue.forEach(function (i) {
      out.push({
        sev: 'brass', pill: D.days(i.days), sort: i.days,
        title: i.project.id + ' · ' + i.project.name,
        sub: W.countryName(ctx.state, i.country) + ' · ' + i.text,
        href: '#/project/' + i.project.id, country: i.country
      });
    });

    if (x.unowned.length) {
      out.push({
        sev: '', pill: String(x.unowned.length), sort: x.unowned.length,
        title: 'Projects without an owner', sub: x.unownedText, href: '#/projects',
        country: null
      });
    }

    return out.sort(function (a, b) {
      return (SEV_RANK[a.sev] - SEV_RANK[b.sev]) || (b.sort - a.sort);
    });
  };

  /* the same rows, split by country. The roll-up "no owner" row is expanded
     back into one row per country so every alert lands in exactly one queue and
     the per-country counts add up to the scope's own list. */
  W.alertsByCountry = function (ctx) {
    var by = {};
    function push(code, row) { (by[code] = by[code] || []).push(row); }

    W.alerts(ctx).forEach(function (a) {
      if (a.country) push(a.country, a);
    });

    W.exceptionSet(ctx).unowned.forEach(function (i) {
      push(i.country, {
        sev: '', pill: 'no owner', sort: 0,
        title: i.project.id + ' · ' + i.project.name,
        sub: W.countryName(ctx.state, i.country) + ' · ' +
             (seedText('unassigned', {}) || 'No owner set — alerts cannot route'),
        href: '#/project/' + i.project.id, country: i.country
      });
    });

    return by;
  };

  /* ================================================= micro-layout builders = */

  /* v1.0.1 — the aligned-100% rule (ToR 9). Every bar in this file works in
     PERCENT-OF-CEILING space and divides by one shared scale from D.barScale(),
     so the 100% tick lands on the same x in every bar the demo draws — the
     dashboard, the P7 utilisation column and the year comparison alike. Past
     the tick the same 135° rose hatch shows the over-run crossing the line. */
  W.scaleFor = function (rows) { return D.barScale(rows); };

  /* percent → position along a bar drawn at `scale` */
  function pos(pct, scale) {
    var s = (typeof scale === 'number' && isFinite(scale) && scale > 0) ? scale : 140;
    return (pct / s) * 100;
  }
  W.barPos = pos;

  /* C-03 budget bar vs ceiling — segmented, 100% (ceiling) tick, 135° hatch.
     opts.scale is the shared column scale; omit it and the bar takes the
     standard scale for its own value, which still puts the tick where every
     other bar on the page puts it. */
  W.budgetBar = function (byStatus, ceiling, opts) {
    opts = opts || {};
    var total = LADDER.reduce(function (a, s) { return a + (byStatus[s] || 0); }, 0);

    /* with no ceiling there is no 100% to align to — draw the mix alone */
    if (!ceiling) {
      var flat = total || 1;
      var bare = '';
      LADDER.forEach(function (s) {
        var v = byStatus[s] || 0;
        if (v > 0) {
          bare += '<span class="p2-seg" style="width:' + (v / flat * 100).toFixed(2) +
                  '%;background:' + SCOL[s] + '"></span>';
        }
      });
      return '<div class="p2-bwrap"><div class="p2-bar"><span class="p2-fill">' +
        bare + '</span></div></div>';
    }

    var pct = total / ceiling * 100;
    var scale = opts.scale;
    if (!(typeof scale === 'number' && isFinite(scale) && scale > 0)) {
      scale = D.barScale([pct]);
    }

    var html = '';
    LADDER.forEach(function (s) {
      var v = byStatus[s] || 0;
      if (v > 0) {
        html += '<span class="p2-seg" style="width:' +
                pos(v / ceiling * 100, scale).toFixed(2) +
                '%;background:' + SCOL[s] + '"></span>';
      }
    });
    html = '<span class="p2-fill">' + html + '</span>';

    var cpos = pos(100, scale);
    if (pct > 100) {
      /* the hatch starts ON the tick and ends at the real total, so the bar is
         seen to cross the line rather than stopping at it */
      html += '<span class="p2-over" style="left:' + cpos.toFixed(2) + '%;width:' +
              (pos(pct, scale) - cpos).toFixed(2) + '%"></span>';
    }
    /* the ceiling label sits over its tick, but tucks inside the bar at either
       end so it never spills out of the card */
    var lbl = cpos >= 70
      ? ' end" style="right:' + Math.max(0, 100 - cpos).toFixed(2) + '%'
      : (cpos <= 22 ? ' start" style="left:' + cpos.toFixed(2) + '%'
                    : '" style="left:' + cpos.toFixed(2) + '%');
    html += '<span class="p2-tick" style="left:' + Math.min(cpos, 99.6).toFixed(2) + '%"></span>' +
            '<span class="p2-ticklbl' + lbl + '">ceiling ' + e(D.money(ceiling)) + '</span>';

    return '<div class="p2-bwrap"><div class="p2-bar">' + html + '</div></div>';
  };

  /* legend row — fixed amount / percent columns so every row aligns */
  W.budgetLegend = function (byStatus, ceiling) {
    var total = 0, out = '';
    LADDER.forEach(function (s) {
      var v = byStatus[s] || 0;
      total += v;
      out += '<div class="p2-lrow">' +
        '<span class="p2-dot" style="background:' + SCOL[s] + '"></span>' +
        '<span class="p2-llbl">' + e(CBP.CONFIG.STATUS[s].label.replace(/^(\d) /, '$1 · ')) + '</span>' +
        '<span class="p2-lamt num">' + e(D.money(v)) + '</span>' +
        '<span class="p2-lpct num">' + e(D.pct(ceiling ? v / ceiling * 100 : 0)) + '</span>' +
        '</div>';
    });
    var over = total > ceiling;
    out += '<div class="p2-lrow total">' +
      '<span class="p2-dot" style="background:transparent"></span>' +
      '<span class="p2-llbl">Total committed</span>' +
      '<span class="p2-lamt num">' + e(D.money(total)) + '</span>' +
      '<span class="p2-lpct num' + (over ? ' neg' : '') + '">' +
      e(D.pct(ceiling ? total / ceiling * 100 : 0)) + '</span></div>';
    return '<div class="p2-legend">' + out + '</div>';
  };

  /* one country's committed against its own ceiling, on the shared scale so a
     column of these reads as one continuous 100% line. `scale` is the column
     scale from D.barScale(); omitted, the row takes the standard scale for its
     own value and the tick still lands where every other bar puts it. */
  W.coveragePct = function (r) {
    if (r === null || r === undefined) return 0;
    if (typeof r.coverage === 'number' && isFinite(r.coverage)) return r.coverage;
    var u = D.utilisation(r.committed, r.ceiling);
    return (typeof u === 'number' && isFinite(u)) ? u : 0;
  };

  W.miniCeilingBar = function (r, scale, opts) {
    opts = opts || {};
    var cov = W.coveragePct(r);
    return U.budgetBar(cov, {
      scale: (typeof scale === 'number' && isFinite(scale) && scale > 0)
        ? scale : D.barScale([cov]),
      sm: true,
      label: opts.label === undefined ? false : opts.label,
      title: D.money(r.committed) + ' committed of ' + D.money(r.ceiling) + ' ceiling'
    });
  };

  /* attention row — fixed-width capsule + two-line text */
  W.attentionRow = function (a) {
    return '<a class="p2-arow" href="' + e(a.href || '#/projects') + '">' +
      U.attentionPill(a.pill, a.sev) +
      '<span class="p2-atx"><b>' + e(a.title) + '</b><span>' + e(a.sub) + '</span></span></a>';
  };

  W.empty = function (msg) { return '<div class="p2-empty">' + e(msg) + '</div>'; };

  /* a value that goes red when it breaches a threshold — no tinted rows */
  function flag(txt, bad) {
    return '<span class="num' + (bad ? ' neg' : '') + '">' + e(txt) + '</span>';
  }
  W.flag = flag;

  /* ============================================================ registry == */

  W.registry = [];
  W.byId = function (id) {
    return W.registry.filter(function (w) { return w.id === id; })[0] || null;
  };
  function reg(def) { W.registry.push(def); return def; }

  /* the dataset line a catalogue entry shows. The area office can rewrite it on
     P9 (state.widgetMeta[id].desc); that override wins over the registered
     blurb, exactly as the Administration page reads it. */
  W.widgetDesc = function (state, w) {
    if (!w) return '';
    var meta = state && state.widgetMeta ? state.widgetMeta[w.id] : null;
    return (meta && meta.desc) ? meta.desc : (w.blurb || '');
  };

  /* the span a widget takes on the 3-track grid when a board has no layout
     entry for it — the same mapping store.js and actions.js use */
  W.defaultSpan = function (id) {
    var w = W.byId(id);
    return (w && !w.bare && w.size !== 'full') ? 1 : 3;
  };

  /* ---------------------------------------------------- C-02 · KPI row --- */
  reg({
    id: 'kpis',
    title: 'Headline figures',
    blurb: 'Committed, coverage against ceiling, review queue and target slippage.',
    size: 'full',
    bare: true,
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      var over = ctx.overAmount > 0;

      /* 1 · committed */
      var k1 = '<div class="kpi ok" data-kpi="committed"><div class="k">Committed · ' +
        e(CBP.CONFIG.BUDGET_YEAR) + '</div><div class="v num">' + e(D.money(ctx.committed)) +
        '</div><div class="d">' + e(W.plural(ctx.rows.length, 'country', 'countries')) +
        ' · ceiling ' + e(D.money(ctx.ceiling)) + '</div></div>';

      /* 2 · coverage vs ceiling — flips between over-ceiling and headroom */
      var k2 = '<div class="kpi ' + (over ? 'alert' : 'ok') + '" data-kpi="ceiling">' +
        '<div class="k">' + (over ? 'Over ceiling' : 'Headroom') + '</div>' +
        '<div class="v num">' + e(over ? D.money(-ctx.overAmount) : D.money(ctx.headroom)) +
        '</div><div class="d">coverage ' + e(D.pct(ctx.coverage)) + ' · ' +
        e(over ? W.plural(ctx.overRows.length, 'country', 'countries') + ' over ceiling'
               : 'no country over ceiling') + '</div></div>';

      /* 3 · in review — count plus the oldest D-in-Q in the scope */
      var reviewing = ctx.projects.filter(function (p) { return p.status === 3; });
      var oldest = reviewing.map(function (p) { return D.dInQ(p) || D.daysInStage(p) || 0; });
      var maxQ = oldest.length ? Math.max.apply(null, oldest) : null;
      var k3 = '<div class="kpi ' +
        (maxQ !== null && maxQ > CBP.CONFIG.GATE_THRESHOLD_DAYS ? 'alert' : 'ok') +
        '" data-kpi="review"><div class="k">In review · status 3</div>' +
        '<div class="v num">' + reviewing.length + '</div>' +
        '<div class="d">' + (maxQ === null ? 'nothing waiting for review'
          : 'oldest ' + e(D.days(maxQ)) + ' in queue') + '</div></div>';

      /* 4 · target passed */
      var late = ctx.projects.filter(function (p) { return D.pastTarget(p); });
      var k4 = '<div class="kpi ' + (late.length ? 'alert' : 'ok') + '" data-kpi="target">' +
        '<div class="k">Past target date</div><div class="v num">' + late.length + '</div>' +
        '<div class="d">' + (late.length ? 'not yet in implementation'
          : 'every record inside its target') + '</div></div>';

      return '<div class="kpis">' + k1 + k2 + k3 + k4 + '</div>';
    }
  });

  /* ------------------------------------------------- C-03 · budget bar --- */
  reg({
    id: 'budget',
    title: 'Budget by status vs ceiling',
    blurb: 'Segmented bar with the ceiling tick and hatched overflow, plus the legend.',
    size: 'half',
    more: 'Open budget →',
    moreHref: '#/budget',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      return W.budgetBar(ctx.byStatus, ctx.ceiling) +
             W.budgetLegend(ctx.byStatus, ctx.ceiling);
    }
  });

  /* --------------------------------------------------- needs attention ---
     v1.0.4 — the widget answers the two questions the ToR asks of it, in two
     labelled sections: what is waiting for an approval decision, and which
     implementation phase runs out next. Both lists are derived (derive.js) and
     both state their all-clear in one muted line rather than disappearing, so
     the card keeps its shape whatever the scope holds.

     W.exceptionSet and the RD-2 digest that reads it are untouched. */
  reg({
    id: 'attention',
    title: 'Needs attention — approvals and timelines',
    blurb: 'Two derived lists: records waiting for an approval decision beyond the ' +
           'configured wait, and implementation phases whose end date is close.',
    size: 'half',
    more: 'View all →',
    moreHref: '#/alerts',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);

      /* ---- section 1 · approval required ---- */
      var appr = D.approvalRequired(ctx.projects);
      var s1 = section('Approval required', appr.length,
        'waiting longer than ' + CBP.CONFIG.APPROVAL_WAIT_DAYS + ' days',
        appr.length
          ? appr.map(function (r) {
              return atRow({
                sev: 'rose', pill: D.days(r.waited),
                href: '#/project/' + r.p.id,
                title: r.p.id + ' · ' + r.p.name,
                meta: ccChip(state, r.p.country) +
                  '<span class="at-val neg">waiting ' + e(D.days(r.waited)) +
                  ' since submit</span>' +
                  '<span class="at-when">submitted ' + e(D.fmtDateY(r.p.submitted_at)) +
                  '</span>'
              });
            }).join('')
          : allClear('Nothing has been waiting for an approval decision longer than ' +
                     CBP.CONFIG.APPROVAL_WAIT_DAYS + ' days.'));

      /* ---- section 2 · project timeline alert ---- */
      var due = D.phaseDeadlines(ctx.projects, CBP.CONFIG.PHASE_WARN_DAYS);
      var s2 = section('Project timeline alert', due.length,
        'phase ends inside ' + CBP.CONFIG.PHASE_WARN_DAYS + ' days',
        due.length
          ? due.map(function (r) {
              var hot = r.daysLeft <= 7;
              return atRow({
                sev: hot ? 'rose' : 'brass', pill: D.days(r.daysLeft),
                href: '#/project/' + r.p.id,
                title: r.p.id + ' · ' + r.p.name,
                meta: ccChip(state, r.p.country) +
                  '<span class="at-phase">' + e(r.name) + '</span>' +
                  '<span class="at-val ' + (hot ? 'neg' : 'warn') + '">ends in ' +
                  e(D.days(r.daysLeft)) + '</span>' +
                  '<span class="at-when">' + e(D.fmtDateY(r.end)) + '</span>'
              });
            }).join('')
          : allClear('No implementation phase ends inside the next ' +
                     CBP.CONFIG.PHASE_WARN_DAYS + ' days.'));

      return '<div class="at-secs">' + s1 + s2 + '</div>';
    }
  });

  /* a quiet section header + its rows */
  function section(label, n, note, body) {
    return '<section class="at-sec">' +
      '<div class="at-hd"><span class="at-lbl">' + e(label) + '</span>' +
      '<span class="at-note">' + e(note) + '</span>' +
      '<span class="at-n num">' + n + '</span></div>' + body + '</section>';
  }

  function allClear(msg) {
    return '<div class="at-clear">' + e(msg) + '</div>';
  }

  function atRow(r) {
    return '<a class="at-row" href="' + e(r.href) + '">' +
      U.attentionPill(r.pill, r.sev) +
      '<span class="at-tx"><b>' + e(r.title) + '</b>' +
      '<span class="at-meta">' + r.meta + '</span></span></a>';
  }

  /* the country chip: flag + name in the country's own pastel (C-21) */
  function ccChip(state, code) {
    return '<span class="dwcc ' + W.ccOf(code) + '">' + W.flagMark(code) +
      e(W.countryName(state, code)) + '</span>';
  }
  W.ccChip = ccChip;

  /* ================================ v1.0.4 · budget track (country detail) ==
     "More details" on the Overview board: one row per country in scope showing
     the ceiling, the spend split across the D-01 ladder under a single grouped
     sub-head, and an aligned bar for the total against that ceiling. Clicking a
     row opens the project queue behind those numbers, grouped by rung, so the
     counts on screen are visibly the counts in the header.

     Nothing here knows a country code: the rows come from ctx.rows and the
     colours from the .cc-<code> utility classes, so a seventh country appears
     the moment its projects do. Read-only for every persona, the viewer
     included — the block carries links and counts and no control at all. */

  var SPEND_COLS = [1, 2, 3, 4];      /* ladder order, left to right */

  function uiMap(state, key) {
    var m = state && state.ui ? state.ui[key] : null;
    return (m && typeof m === 'object') ? m : {};
  }

  function btAmount(list) {
    return list.reduce(function (a, p) { return a + (p.amount || 0); }, 0);
  }

  /* the queue behind one country's numbers, rung by rung */
  function btQueue(state, r) {
    if (!r.projects.length) {
      return '<div class="bt-empty">No project records in ' + e(r.name) +
        ' yet — the whole ' + e(D.money(r.ceiling)) + ' ceiling is unallocated.</div>';
    }

    var blocks = CBP.CONFIG.STATUS_ORDER.map(function (s) {
      var list = r.projects.filter(function (p) { return p.status === s; });
      if (!list.length) return '';
      list = list.slice().sort(function (a, b) {
        return (b.amount || 0) - (a.amount || 0) ||
               (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      });

      var rows = list.map(function (p) {
        var remark;
        if (p.status === 1) {
          var from = p.implementation_date || p.approved_at;
          remark = from ? 'implementing since ' + D.fmtDateY(from) : 'in implementation';
        } else if (p.status === 'declined') {
          remark = 'declined' + (p.declined_at ? ' ' + D.fmtDateY(p.declined_at) : '');
        } else {
          var q = D.dInQ(p);
          remark = (q === null) ? 'not yet in the queue' : 'in queue ' + D.days(q);
        }
        return '<a class="bt-prow" href="#/project/' + e(p.id) + '">' +
          '<span class="bt-pid">' + e(p.id) + '</span>' +
          '<span class="bt-pname">' + e(p.name) + '</span>' +
          '<span class="bt-prem">' + e(remark) + '</span>' +
          '<span class="bt-pamt num">' + e(D.money(p.amount || 0)) + '</span></a>';
      }).join('');

      return '<div class="bt-rung">' +
        '<div class="bt-rhd">' + U.statusPill(s) +
        '<span class="bt-rn num">' + e(W.plural(list.length, 'project')) + '</span>' +
        '<span class="bt-ramt num">' + e(D.money(btAmount(list))) + '</span>' +
        (s === 'declined'
          ? '<span class="bt-rnote">not counted in the split</span>' : '') +
        '</div>' + rows + '</div>';
    }).join('');

    return '<div class="bt-q">' + blocks + '</div>';
  }

  reg({
    id: 'budgettrack',
    title: 'Budget track — country detail',
    blurb: 'Per country: the year’s budget ceiling against the spend split across the four ' +
           'ladder rungs, with the project queue behind every number one click away.',
    size: 'full',
    more: 'Open budget →',
    moreHref: '#/budget',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      if (!ctx.rows.length) {
        return W.empty('No country is in this scope yet — tick a country to open its budget track.');
      }

      var open = uiMap(state, 'btOpen');
      var rows = ctx.rows.map(function (r) {
        var sp = D.spendByStatus(r.projects);
        return { r: r, sp: sp, pct: r.ceiling ? (sp.total / r.ceiling * 100) : 0 };
      });
      /* ONE scale across every country in the widget, so the 100% rule is a
         single line down the bar column (ToR 9) */
      var scale = D.barScale(rows.map(function (x) { return x.pct; }));

      var head =
        '<tr>' +
          '<th rowspan="2">Country</th>' +
          '<th rowspan="2" class="r">' + e(CBP.CONFIG.BUDGET_YEAR) + ' budget</th>' +
          '<th colspan="5" class="c bt-grp">Actual spend</th>' +
          '<th rowspan="2" class="bt-barh">vs ceiling</th>' +
        '</tr><tr>' +
          SPEND_COLS.map(function (s) {
            return '<th class="r bt-sub">' + e(CBP.CONFIG.STATUS[s].short) + '</th>';
          }).join('') +
          '<th class="r bt-sub bt-tot">Total</th>' +
        '</tr>';

      var body = rows.map(function (x) {
        var r = x.r, sp = x.sp;
        var on = !!open[r.code];
        var cells = SPEND_COLS.map(function (s) {
          var v = sp['s' + s];
          return '<td class="r num">' + (v ? e(D.money(v)) : '<span class="dim">—</span>') +
            '</td>';
        }).join('');

        var line = '<tr class="bt-row ' + W.ccOf(r.code) + (on ? ' on' : '') +
          '" data-act="w-bt" data-code="' + e(r.code) + '" role="button" tabindex="0"' +
          ' aria-expanded="' + on + '" title="' +
          e((on ? 'Hide' : 'Show') + ' the ' + r.name + ' project queue') + '">' +
          '<td class="bt-cty"><span class="bt-chev" aria-hidden="true">' +
            (on ? '▾' : '▸') + '</span>' + W.flagMark(r.code) +
            '<b>' + e(r.name) + '</b>' +
            '<span class="bt-n num" title="' + e(W.plural(r.count, 'project')) + '">' +
            r.count + '</span></td>' +
          '<td class="r num">' + e(D.money(r.ceiling)) + '</td>' +
          cells +
          '<td class="r num bt-tot' + (sp.total > r.ceiling ? ' neg' : '') + '">' +
            e(D.money(sp.total)) + '</td>' +
          '<td class="bt-bar">' + U.budgetBar(x.pct, {
            scale: scale, sm: true, label: true,
            title: D.money(sp.total) + ' of the ' + D.money(r.ceiling) + ' ' +
                   CBP.CONFIG.BUDGET_YEAR + ' ceiling'
          }) + '</td></tr>';

        if (on) {
          line += '<tr class="bt-exp ' + W.ccOf(r.code) + '"><td colspan="8">' + btQueue(state, r) + '</td></tr>';
        }
        return line;
      }).join('');

      return '<div class="tblwrap"><table class="tbl bt-tbl"><thead>' + head +
        '</thead><tbody>' + body + '</tbody></table></div>' +
        '<p class="p2-note">Actual spend splits the committed budget across the ladder — ' +
        'Implementation, Approved, Submitted and In development — so the four columns add up ' +
        'to the total, and the total is drawn against the country ceiling on one shared scale ' +
        'to ' + e(String(Math.round(scale))) + '%. Open a country to see the records behind ' +
        'its columns, grouped by the same rungs; day counts are derived against ' +
        e(D.fmtDateY(CBP.CONFIG.TODAY)) + '. Declined records are not committed money and sit ' +
        'outside the split.</p>';
    }
  });

  /* ================================ v1.0.4 · unread messages & alerts ======
     One row per country in scope: what is unread for the SIGNED-IN persona
     (D.unreadByCountry, the same read state the sidebar balloon counts) beside
     the exceptions already derived for that country by W.exceptionSet. A row
     with neither collapses to a quiet zero line rather than disappearing, so
     the widget is a full picture of the scope and not only its bad news.

     Viewer-safe: counts, briefs and links, no read/flag/reply control. */

  function maSnippet(body, n) {
    var s = String(body || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.\-]+$/, '') + '…' : s;
  }

  var MA_BRIEFS = 3;      /* how many of the briefest unread items a row shows */
  var MA_SNIP = 92;

  function maUnreadIn(state, r) {
    var user = state.user;
    var ids = {};
    r.projects.forEach(function (p) { ids[p.id] = true; });
    return D.commentsVisible(user).filter(function (c) {
      return ids[c.project_id] && D.isUnread(user, c);
    }).sort(function (a, b) {
      var la = String(a.body || '').length, lb = String(b.body || '').length;
      return (la - lb) || D.commentOrder(a, b);
    });
  }

  reg({
    id: 'msgalert',
    title: 'Unread messages & alerts',
    blurb: 'Per country: what is unread for the signed-in user and how many exceptions that ' +
           'country carries, with the briefest unread items one click away.',
    size: 'full',
    more: 'Open Messages & Alerts →',
    moreHref: '#/messages',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      if (!ctx.rows.length) {
        return W.empty('No country is in this scope yet — tick a country to see its messages.');
      }

      var open = uiMap(state, 'maOpen');
      var unread = D.unreadByCountry(state.user, ctx.projects);
      var alerts = W.alertsByCountry(ctx);

      var items = ctx.rows.map(function (r) {
        var un = unread[r.code] || 0;
        var al = (alerts[r.code] || []).length;
        var quiet = (un === 0 && al === 0);
        var on = !quiet && !!open[r.code];

        var counts =
          '<span class="ma-cnt' + (un ? ' has' : '') + '">' +
            '<b class="num">' + un + '</b>' + (un ? '<i class="ma-dot"></i>' : '') +
            '<span>' + (un === 1 ? 'unread message' : 'unread messages') + '</span></span>' +
          '<span class="ma-cnt' + (al ? ' warn' : '') + '">' +
            '<b class="num">' + al + '</b>' +
            '<span>' + (al === 1 ? 'alert' : 'alerts') + '</span></span>';

        var head = quiet
          ? '<div class="ma-row static ' + W.ccOf(r.code) + '">' +
              '<span class="ma-chev" aria-hidden="true"></span>' + W.flagMark(r.code) +
              '<span class="ma-name">' + e(r.name) + '</span>' +
              '<span class="ma-counts">' + counts + '</span>' +
              '<span class="ma-quiet">nothing new</span></div>'
          : '<div class="ma-row ' + W.ccOf(r.code) + (on ? ' on' : '') +
              '" data-act="w-ma" data-code="' + e(r.code) + '" role="button" tabindex="0"' +
              ' aria-expanded="' + on + '" title="' +
              e((on ? 'Hide' : 'Show') + ' the ' + r.name + ' messages and alerts') + '">' +
              '<span class="ma-chev" aria-hidden="true">' + (on ? '▾' : '▸') + '</span>' +
              W.flagMark(r.code) +
              '<span class="ma-name">' + e(r.name) + '</span>' +
              '<span class="ma-counts">' + counts + '</span></div>';

        var body = '';
        if (on) {
          var list = maUnreadIn(state, r);
          var briefs = list.slice(0, MA_BRIEFS);
          body += '<div class="ma-body">';
          body += '<div class="ma-shd">' + e(W.plural(list.length, 'unread message')) +
            (list.length > briefs.length
              ? ' · showing the ' + briefs.length + ' briefest' : '') + '</div>';
          body += briefs.length
            ? briefs.map(function (c) {
                return '<a class="ma-msg" href="#/project/' + e(c.project_id) + '">' +
                  '<span class="ma-au">' + e(CBP.userName(c.author)) + '</span>' +
                  '<span class="ma-pid">' + e(c.project_id) + '</span>' +
                  '<span class="ma-snip">' + e(maSnippet(c.body, MA_SNIP)) + '</span></a>';
              }).join('')
            : '<div class="ma-none">Nothing unread here — every message in ' + e(r.name) +
              ' has been read.</div>';

          var al2 = alerts[r.code] || [];
          body += '<div class="ma-shd">' + e(W.plural(al2.length, 'alert')) + '</div>';
          body += al2.length
            ? '<div class="p2-att ma-alerts">' + al2.map(W.attentionRow).join('') + '</div>'
            : '<div class="ma-none">No exception is open in ' + e(r.name) + '.</div>';

          body += '<a class="ma-more" href="#/messages">Open Messages &amp; Alerts</a>';
          body += '</div>';
        }

        return '<div class="ma-item ' + W.ccOf(r.code) + '">' + head + body + '</div>';
      }).join('');

      return '<div class="ma-list">' + items + '</div>' +
        '<p class="p2-note">Unread is counted for ' + e(state.user.name) +
        ' — your own messages are never unread, and a country outside your data scope is not ' +
        'counted at all, so these numbers add up to the balloon in the sidebar. Alerts are the ' +
        'same derived exceptions the alert centre sends.</p>';
    }
  });

  /* ------------------------------------------------ countries coverage --- */
  reg({
    id: 'coverage',
    title: 'Countries — coverage',
    blurb: 'Ceiling, committed, coverage cell, queue depth and the oldest waiting record.',
    size: 'full',
    more: 'Open projects →',
    moreHref: '#/projects',
    titleFor: function (ctx) {
      return ctx.rows.length === 1 ? 'Country — coverage'
        : 'Countries — coverage (' + ctx.rows.length + ')';
    },
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      var rows = ctx.rows.slice().sort(function (a, b) {
        return (b.coverage || 0) - (a.coverage || 0);
      }).map(function (r) {
        return '<tr><td>' + e(r.name) + '</td>' +
          '<td class="r">' + e(D.money(r.ceiling)) + '</td>' +
          '<td class="r">' + e(D.money(r.committed)) + '</td>' +
          '<td class="r">' + U.coverageCell(r.coverage) + '</td>' +
          '<td>' + e(W.plural(r.queue, 'project')) + '</td>' +
          '<td class="r' + (r.oldest === null ? ' dim' : '') + '">' +
          e(r.oldest === null ? '—' : D.days(r.oldest)) + '</td></tr>';
      }).join('');

      return U.table([
        { label: 'Country' }, { label: 'Ceiling', right: true },
        { label: 'Committed', right: true }, { label: 'Coverage', right: true },
        { label: 'Queue' }, { label: 'Oldest waiting', right: true }
      ], [rows]);
    }
  });

  /* ------------------------------------------- RD-1 · league table ------- */
  var LEAGUE_COLS = [
    { key: 'name',     label: 'Country' },
    { key: 'coverage', label: 'Coverage', right: true },
    { key: 'committed', label: 'Committed', right: true },
    { key: 'avgReviewDays', label: 'Avg review', right: true },
    { key: 'avgGateDays',   label: 'Avg gate', right: true },
    { key: 'delayed',  label: 'Delayed', right: true },
    { key: 'queue',    label: 'Queue', right: true }
  ];
  W.LEAGUE_COLS = LEAGUE_COLS;

  reg({
    id: 'league',
    title: 'Country league table',
    blurb: 'RD-1 — every country in scope ranked on coverage, review and gate speed.',
    size: 'full',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      /* sort is remembered per board, so the same widget on two boards keeps
         its own column order and nothing leaks between them */
      var sort = ctx.sort || W.sortFor(state, ctx.dashId);
      var col = sort.col, dir = sort.dir === 'asc' ? 1 : -1;

      var rows = D.leagueTable(ctx.projects, state.countries, codes);
      /* the coverage column is a bar column: one scale for every row, so the
         100% rule reads as one line down the table (ToR 9) */
      var scale = D.barScale(rows.map(W.coveragePct));

      rows.sort(function (a, b) {
        if (col === 'name') return a.name.localeCompare(b.name) * dir;
        var x = a[col], y = b[col];
        var xn = (x === null || x === undefined), yn = (y === null || y === undefined);
        if (xn && yn) return a.name.localeCompare(b.name);
        if (xn) return 1;              /* "—" always ranks last, either direction */
        if (yn) return -1;
        return (x - y) * dir || a.name.localeCompare(b.name);
      });

      var head = '<tr><th class="r p2-rank">#</th>' + LEAGUE_COLS.map(function (c) {
        var on = c.key === col;
        return '<th class="' + (c.right ? 'r ' : '') +
          (c.key === 'coverage' ? 'p2-covcol ' : '') + 'p2-sortable' + (on ? ' on' : '') +
          '" data-p2="sort" data-col="' + e(c.key) + '" role="button" tabindex="0">' +
          e(c.label) + '<span class="p2-arrow">' +
          (on ? (dir === 1 ? '▲' : '▼') : '') + '</span></th>';
      }).join('') + '</tr>';

      var body = rows.map(function (r, i) {
        var review = r.avgReviewDays;
        var gate = r.avgGateDays;
        return '<tr><td class="r p2-rank num">' + (i + 1) + '</td>' +
          '<td>' + e(r.name) + '</td>' +
          '<td class="r p2-covcol">' +
            W.miniCeilingBar(r, scale, { label: true }) + '</td>' +
          '<td class="r">' + e(D.money(r.committed)) + '</td>' +
          '<td class="r">' + (review === null ? '<span class="dim">—</span>'
            : flag(D.days(review), review > CBP.CONFIG.REVIEW_THRESHOLD_DAYS)) + '</td>' +
          '<td class="r">' + (gate === null ? '<span class="dim">—</span>'
            : flag(D.days(gate), gate > CBP.CONFIG.GATE_THRESHOLD_DAYS)) + '</td>' +
          '<td class="r">' + (r.delayed ? flag(String(r.delayed), true)
            : '<span class="dim num">0</span>') + '</td>' +
          '<td class="r num">' + r.queue + '</td></tr>';
      }).join('');

      return '<div class="tblwrap"><table class="tbl p2-league"><thead>' + head +
        '</thead><tbody>' + body + '</tbody></table></div>' +
        '<p class="p2-note">Coverage is drawn on one scale to ' +
        e(String(Math.round(scale))) + '%, so the 100% rule is a single line down the ' +
        'column and an over-run crosses it. ' +
        'Outliers carry a red value: coverage above 100%, average review ' +
        'older than ' + CBP.CONFIG.REVIEW_THRESHOLD_DAYS + ' days, average external-gate wait ' +
        'beyond ' + CBP.CONFIG.GATE_THRESHOLD_DAYS + ' days, or any delayed record. ' +
        'Rows are never tinted. Click a column head to re-rank.</p>';
    }
  });

  /* ------------------------------------------ per-country ceiling bars --- */
  reg({
    id: 'ceilings',
    title: 'Ceiling vs committed, by country',
    blurb: 'One C-03 bar per country — the hatch shows exactly who is over.',
    size: 'half',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      var list = ctx.rows.slice().sort(function (a, b) {
        return (b.coverage || 0) - (a.coverage || 0);
      });
      /* ONE scale for the whole widget: the 100% rule is a single straight line
         down the list and an over-run visibly crosses it */
      var scale = D.barScale(list.map(W.coveragePct));
      var rows = list.map(function (r) {
        return '<div class="p2-crow"><span class="p2-cname">' + e(r.name) + '</span>' +
          W.miniCeilingBar(r, scale) +
          '<span class="p2-cval num' + (r.over > 0 ? ' neg' : '') + '">' +
          e(D.pct(r.coverage)) + '</span></div>';
      }).join('');
      return '<div class="p2-clist">' + rows + '</div>' +
        '<p class="p2-note">Every row is drawn on one scale to ' +
        e(String(Math.round(scale))) + '% of the ceiling, so the 100% line runs ' +
        'straight down the list; anything past it is hatched.</p>';
    }
  });

  /* --------------------------------------------- external gate watch ----- */
  reg({
    id: 'gate',
    title: 'Waiting beyond the platform',
    blurb: 'Open Decision Point and CHaS sub-steps with their own day counters (D-11).',
    size: 'half',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      var items = [];
      ctx.projects.forEach(function (p) {
        D.openGates(p).forEach(function (g) { items.push({ p: p, g: g }); });
      });
      if (!items.length) return W.empty('Nothing sits at the external gate in this scope.');
      items.sort(function (a, b) { return b.g.days - a.g.days; });

      var rows = items.map(function (x) {
        return '<tr><td><a href="#/project/' + e(x.p.id) + '">' + e(x.p.id) + '</a></td>' +
          '<td>' + e(x.g.label) + '</td>' +
          '<td>' + e(D.fmtDateY(x.g.submitted_at)) + '</td>' +
          '<td class="r">' + flag(D.days(x.g.days), x.g.overdue) + '</td></tr>';
      }).join('');

      return U.table([
        { label: 'Project' }, { label: 'System' }, { label: 'Submitted' },
        { label: 'Waiting', right: true }
      ], [rows]);
    }
  });

  /* ------------------------------------------------------ status mix ----- */
  reg({
    id: 'statusmix',
    title: 'Records by status',
    blurb: 'Count and amount at each rung of the D-01 ladder.',
    size: 'half',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      var rows = CBP.CONFIG.STATUS_ORDER.filter(function (s) {
        return s !== 'declined' || ctx.counts.declined;
      }).map(function (s) {
        var amt = ctx.byStatus[s] || 0;
        return '<tr><td>' + U.statusPill(s) + '</td>' +
          '<td class="r num">' + (ctx.counts[s] || 0) + '</td>' +
          '<td class="r">' + e(D.money(amt)) + '</td>' +
          '<td class="r num">' + e(D.pct(ctx.ceiling ? amt / ctx.ceiling * 100 : 0)) +
          '</td></tr>';
      }).join('');
      return U.table([
        { label: 'Status' }, { label: 'Records', right: true },
        { label: 'Amount', right: true }, { label: '% ceiling', right: true }
      ], [rows]);
    }
  });

  /* ------------------------------------- RD-4 · decisions & questions ---- */
  function raidRow(a, state, extra) {
    var age = D.daysSince(a.at);
    return '<a class="p2-arow" href="#/project/' + e(a.project) + '">' +
      U.attentionPill(D.days(age), age > 30 ? 'brass' : '') +
      '<span class="p2-atx"><b>' + e(a.body) + '</b><span>' +
      e(a.project + ' · ' + (a._p ? a._p.name : '') + ' · ' + extra) + '</span></span></a>';
  }

  reg({
    id: 'decisions',
    title: 'Pinned decisions',
    blurb: 'RD-4 — every decision pinned to a project header across the scope.',
    size: 'half',
    dated: true,
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      var rows = W.activityInScope(ctx).filter(function (a) {
        return a.type === 'decision' && a.pinned;
      }).sort(function (a, b) { return D.parse(b.at) - D.parse(a.at); });

      if (!rows.length) return W.empty('No pinned decisions in the selected scope.');
      return '<div class="p2-att">' + rows.map(function (a) {
        return raidRow(a, state, 'pinned by ' + CBP.userName(a.author) +
          ' · ' + D.fmtDateY(a.at));
      }).join('') + '</div>';
    }
  });

  reg({
    id: 'questions',
    title: 'Open questions',
    blurb: 'RD-4 — unresolved questions with their assignee and age.',
    size: 'half',
    dated: true,
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      var rows = W.activityInScope(ctx).filter(function (a) {
        return a.type === 'question' && !a.resolved_at;
      }).sort(function (a, b) { return D.parse(a.at) - D.parse(b.at); });

      if (!rows.length) return W.empty('No open questions in the selected scope.');
      return '<div class="p2-att">' + rows.map(function (a) {
        return raidRow(a, state, 'assigned to ' +
          (a.assigned_to ? CBP.userName(a.assigned_to) : 'nobody') +
          ' · asked by ' + CBP.userName(a.author) + ' · ' + D.fmtDateY(a.at));
      }).join('') + '</div>';
    }
  });

  /* ----------------------------------- RD-5 · delegation & coverage ------ */
  reg({
    id: 'delegation',
    title: 'Away & active delegations',
    blurb: 'RD-5 — who is out of office and who is covering their queue.',
    size: 'half',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      /* only delegations whose queue touches the selected scope — and the queue
         is named only as far as the signed-in user's data scope reaches */
      var rows = W.delegations(state).filter(function (d) {
        return W.coversAny(d.awayUser, codes);
      });
      if (!rows.length) {
        return W.empty('Nobody covering ' + W.scopeTitle(state, codes) +
          ' is away — no delegation is active in this scope.');
      }

      return '<div class="p2-att">' + rows.map(function (d) {
        var awayName = d.awayUser ? d.awayUser.name : CBP.userName(d.away);
        var delName = d.delegateUser ? d.delegateUser.name : CBP.userName(d.delegate);
        var own = W.userCountries(d.awayUser);
        var covers = (own === null ? codes : own.filter(function (c) {
          return codes.indexOf(c) > -1;
        })).map(function (c) { return W.countryName(state, c); }).join(', ');
        return '<div class="p2-arow static">' +
          U.attentionPill(d.active ? 'away' : 'set', d.active ? 'brass' : '') +
          '<span class="p2-atx"><b>' + e(awayName + ' — ' + delName + ' is covering') +
          '</b><span>' + e((d.reason ? d.reason + ' · ' : '') +
            D.fmtDateY(d.from) + ' – ' + D.fmtDateY(d.to) +
            (d.active ? ' · active, ' + D.days(d.endsIn) + ' left'
                      : (d.startsIn > 0 ? ' · starts in ' + D.days(d.startsIn) : ' · ended')) +
            ' · queue: ' + covers) + '</span></span></div>';
      }).join('') + '</div>';
    }
  });

  reg({
    id: 'unowned',
    title: 'Projects without an owner',
    blurb: 'RD-5 — records that cannot route an alert until an owner is set (D-14).',
    size: 'half',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      if (!ctx.unassigned.length) return W.empty('Every project in scope has an owner.');
      var rows = ctx.unassigned.map(function (p) {
        var stage = D.daysInStage(p);
        return '<a class="p2-arow" href="#/project/' + e(p.id) + '">' +
          U.attentionPill(String(p.status), '') +
          '<span class="p2-atx"><b>' + e(p.id + ' · ' + p.name) + '</b><span>' +
          e(W.countryName(state, p.country) + ' · ' +
            CBP.CONFIG.STATUS[p.status].short + ' · ' + D.money(p.amount) +
            (stage === null ? '' : ' · ' + D.days(stage) + ' in stage')) +
          '</span></span></a>';
      }).join('');
      return '<div class="p2-att">' + rows + '</div>';
    }
  });

  reg({
    id: 'ownercov',
    title: 'Owner coverage by country',
    blurb: 'RD-5 — the regional manager, the named owners and the gaps, per country.',
    size: 'full',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      var dels = W.delegations(state).filter(function (d) { return d.active; });

      var rows = ctx.rows.map(function (r) {
        var m1 = state.users.filter(function (u) {
          if (u.role !== 'm1') return false;
          var s = W.userCountries(u);
          return s === null || s.indexOf(r.code) > -1;
        });
        var m1txt = m1.map(function (u) {
          var d = dels.filter(function (x) { return x.away === u.id; })[0];
          return u.name + (d ? ' (away — ' + CBP.userName(d.delegate) + ' covering)' : '');
        }).join(', ') || '—';

        var owners = {};
        r.projects.forEach(function (p) { if (p.owner) owners[p.owner] = true; });
        var ownTxt = Object.keys(owners).map(function (id) { return CBP.userName(id); })
          .join(', ') || '—';

        return '<tr><td>' + e(r.name) + '</td>' +
          '<td>' + e(m1txt) + '</td>' +
          '<td>' + e(ownTxt) + '</td>' +
          '<td class="r num">' + r.count + '</td>' +
          '<td class="r">' + (r.unassigned ? flag(String(r.unassigned), true)
            : '<span class="dim num">0</span>') + '</td></tr>';
      }).join('');

      return U.table([
        { label: 'Country' }, { label: 'Regional manager (M1)' }, { label: 'Named owners' },
        { label: 'Projects', right: true }, { label: 'No owner', right: true }
      ], [rows]);
    }
  });

  /* ------------------------------- v1.0.1 · budget years 2024–2027 -------- */
  /* Grouped utilisation bars per country. 2024 and 2025 come from the seeded
     budget_history, 2026 is summed from the live projects (so a demo edit moves
     it) and 2027 is the plan the Forecasting tab writes. ONE scale from
     D.barScale() covers every row AND every year in the widget, so the 100%
     tick sits on the same x in all of them — that is the whole point of the
     comparison. Added to the Budget Utilisation board by A.syncDashboards(),
     but it renders correctly on any board it is placed on. */

  var YC_YEARS = [
    { year: '2024', key: 'y2024pct', src: 'history' },
    { year: '2025', key: 'y2025pct', src: 'history' },
    { year: '2026', key: 'y2026pct', src: 'live' }
  ];

  function ycTrack(inner, label, neg) {
    return '<span class="ubar-wrap sm"><span class="ubar p2-ycplan">' + inner +
      '</span><span class="ubar-val num' + (neg ? ' neg' : '') + '">' + label +
      '</span></span>';
  }

  reg({
    id: 'yearcompare',
    title: 'Budget years 2024–2027',
    blurb: 'budget_history 2024 and 2025, the live 2026 commitment and the 2027 plan — ' +
           'utilisation against each year’s ceiling, per country.',
    size: 'full',
    render: function (state, codes, ctx) {
      ctx = ctx || W.ctx(state, codes);
      var rows = D.forecastRows(ctx.projects, ctx.countries);
      if (!rows.length) {
        return W.empty('No seeded budget history for the countries in this scope.');
      }

      /* the shared scale spans every value the widget draws — three years and
         the plan marker, across every country — so no bar and no marker can sit
         on a scale of its own */
      var all = [];
      rows.forEach(function (r) {
        [r.y2024pct, r.y2025pct, r.y2026pct, r.plan2027pct].forEach(function (v) {
          if (typeof v === 'number' && isFinite(v)) all.push(v);
        });
      });
      var scale = D.barScale(all);
      var tick = pos(100, scale).toFixed(2);

      var blocks = rows.map(function (r) {
        var bars = YC_YEARS.map(function (y) {
          var v = r[y.key];
          var lbl = y.year + (y.src === 'live' ? ' · live' : '');
          if (typeof v !== 'number' || !isFinite(v)) {
            return '<div class="p2-ycrow"><span class="p2-ycyr num">' + e(y.year) +
              '</span>' + ycTrack('<span class="ubar-rule" style="left:' + tick +
              '%"></span>', '—', false) + '</div>';
          }
          return '<div class="p2-ycrow"><span class="p2-ycyr num">' + e(y.year) +
            '</span>' +
            U.budgetBar(v, {
              scale: scale, sm: true, label: true,
              title: lbl + ' · ' + D.pct(v) + ' of the ' + D.money(r.ceiling) + ' ceiling'
            }) + '</div>';
        }).join('');

        /* 2027 is a plan, not a commitment — it reads as a marker on the same
           track geometry rather than a fourth filled bar */
        var p = r.plan2027pct;
        var hasPlan = (typeof p === 'number' && isFinite(p));
        var mark = '<span class="ubar-rule" style="left:' + tick + '%"></span>' +
          (hasPlan
            ? '<span class="p2-ycmark" style="left:' +
              Math.min(pos(p, scale), 100).toFixed(2) + '%" title="' +
              e('2027 plan · ' + D.money(r.plan2027) + ' · ' + D.pct(p)) +
              '"></span>'
            : '');
        var plan = '<div class="p2-ycrow plan"><span class="p2-ycyr num">2027</span>' +
          ycTrack(mark, hasPlan ? e(D.pct(p)) : '—', hasPlan && p > 100) + '</div>';

        return '<div class="p2-ycblock">' +
          '<div class="p2-ychd"><b>' + e(r.name) + '</b>' +
          '<span class="num">' + e(D.money(r.committed2026)) + ' in ' +
          e(CBP.CONFIG.BUDGET_YEAR) + '</span></div>' +
          bars + plan +
          (r.note ? '<div class="p2-ycnote">' + e(r.note) + '</div>' : '') +
          '</div>';
      }).join('');

      return '<div class="p2-yc">' + blocks + '</div>' +
        '<p class="p2-note">Every bar in this widget is drawn on one scale to ' +
        e(String(Math.round(scale))) + '% of the ceiling, so the 100% line sits at the ' +
        'same point in all four rows of all ' + e(String(rows.length)) +
        ' countries and an over-run crosses it with the hatch. 2024 and 2025 are the ' +
        'seeded budget history, ' + e(CBP.CONFIG.BUDGET_YEAR) + ' sums the live ' +
        'commitments, and 2027 is the plan marker (◆) from the Forecasting tab.</p>';
    }
  });

  /* ================================== v1.0.4 · expand / collapse wiring ====
     Registered ONCE, at load, on document — never per render. The two actions
     are names this file owns ('w-bt', 'w-ma'); actions.js does not know them,
     so it never claims the event and never stops it, and the handler below does
     not stop it either: a click anywhere on the board should still close an
     open scope pane, which is p2.js's own listener talking. State goes into
     ui.btOpen / ui.maOpen (seeded in store.js) and one CBP.render() pass
     rebuilds the board from it.

     Toggling is a disclosure, not a mutation — nothing is written to a project,
     so the viewer expands a country exactly like everybody else. */

  var TOGGLE = { 'w-bt': 'btOpen', 'w-ma': 'maOpen' };

  function toggleOpen(act, code) {
    if (!CBP.state || !code || !TOGGLE[act]) return false;
    var key = TOGGLE[act];
    var ui = CBP.state.ui || (CBP.state.ui = {});
    if (!ui[key] || typeof ui[key] !== 'object') ui[key] = {};
    ui[key][code] = !ui[key][code];
    return true;
  }

  function hit(node) {
    return (node && node.closest)
      ? node.closest('[data-act="w-bt"],[data-act="w-ma"]') : null;
  }

  document.addEventListener('click', function (ev) {
    var t = hit(ev.target);
    if (!t) return;
    ev.preventDefault();
    if (toggleOpen(t.getAttribute('data-act'), t.getAttribute('data-code'))) CBP.render();
  });

  /* the rows are role="button" — keep them on the keyboard path */
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
    var t = hit(ev.target);
    if (!t) return;
    ev.preventDefault();
    if (toggleOpen(t.getAttribute('data-act'), t.getAttribute('data-code'))) CBP.render();
  });

})();
