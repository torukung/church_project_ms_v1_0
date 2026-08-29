/* pages/p3.js — P3 Projects register (v1.0.1 reframe).
   Design ported from reference/P3_Projects_List_UI_Sample.html, retyped onto the
   confirmed 03 design system (one family, no mono, no tracked-uppercase).

   v1.0.1 · A — the register is now layered rather than flat: a multi-country
   selector sits above the status filters, each country becomes its own glass
   band carrying the derived committed / ceiling / queue figures, and its
   projects sit on white cards inset under the band with a hairline connector,
   so "country" can never be mistaken for "project" once a row is open.
   Every number below still comes from derive.js at render time. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};

  /* ------------------------------------------------- v1.0.3 · country identity
     The flag glyph and the palette class are the two halves of the country
     identity system (palette defined once in css/app.css, C-21). Both are
     resolved from the country CODE only, so an unseeded code degrades to the
     neutral .cc-x swatch and an empty flag rather than throwing or printing
     "undefined". The demo runs on macOS, where the regional-indicator pairs
     below render as flags natively — no image files, so file:// stays clean. */
  var FLAG = {
    BGD: '🇧🇩', NPL: '🇳🇵', KHM: '🇰🇭', IND: '🇮🇳', MMR: '🇲🇲', LAO: '🇱🇦'
  };

  function flagOf(code) { return FLAG[String(code || '').toUpperCase()] || ''; }

  /* '' → the palette class for this code, or the neutral fallback */
  function ccOf(code) {
    var k = String(code || '').toUpperCase();
    return FLAG[k] ? 'cc-' + k.toLowerCase() : 'cc-x';
  }

  /* the glyph as markup — aria-hidden, because the country NAME is always
     printed beside it and a screen reader must not hear the flag twice */
  function flagMark(code) {
    var f = flagOf(code);
    return f ? '<span class="ccflag" aria-hidden="true">' + f + '</span>' : '';
  }

  /* ------------------------------------------------ country selection ----
     ui.p3Countries — null (or anything unusable) means "every country in
     scope". CBP.setUser does not know about this key, so the selection is
     repaired here on every render: a persona switch that hides a selected
     country simply falls back to the whole scope rather than emptying the
     register. */
  function selectedCodes(state, codes) {
    var sel = state.ui.p3Countries;
    if (!sel || Object.prototype.toString.call(sel) !== '[object Array]' || !sel.length) {
      state.ui.p3Countries = null;
      return codes.slice();
    }
    var keep = codes.filter(function (c) { return sel.indexOf(c) > -1; });
    if (!keep.length || keep.length === codes.length) {
      state.ui.p3Countries = null;                 /* nothing legal left, or all of it */
      return codes.slice();
    }
    if (keep.length !== sel.length) state.ui.p3Countries = keep;   /* drop invisible codes */
    return keep;
  }

  CBP.pages.projects = function (state) {
    var user = state.user;
    var codes = D.visibleCountries(user, state.countries);
    var sel = selectedCodes(state, codes);
    var narrowed = sel.length !== codes.length;

    var scoped = D.visibleProjects(user, state.projects, state.countries);
    var inSel = scoped.filter(function (p) { return sel.indexOf(p.country) > -1; });
    var counts = D.statusRollups(inSel);

    var filter = state.ui.p3Filter;
    var q = (state.ui.p3Search || '').trim().toLowerCase();
    var shown = inSel.filter(function (p) {
      return (filter === 'all' || String(p.status) === String(filter)) && matches(p, q);
    });

    var rollup = D.countryRollup(inSel, state.countries, sel);
    var totalCeiling = rollup.reduce(function (a, r) { return a + r.ceiling; }, 0);
    var totalCommitted = rollup.reduce(function (a, r) { return a + r.committed; }, 0);
    var totalCoverage = D.coverage(totalCommitted, totalCeiling);

    var scopeName = sel.length === state.countries.length
      ? 'Asia Area'
      : rollup.map(function (r) { return r.name; }).join(' · ');

    /* -------------------------------------------------------- page head */
    var html = '<div class="crumb">Projects · ' + e(scopeName) +
               ' · Budget year ' + e(CBP.CONFIG.BUDGET_YEAR) + '</div>' +
      '<div class="pagehead"><h1>Projects</h1>' +
      '<span class="sub num">' +
      (narrowed
        ? inSel.length + ' of ' + scoped.length + ' projects · selected ceiling ' + D.money(totalCeiling)
        : scoped.length + ' project' + (scoped.length === 1 ? '' : 's') +
          ' in scope · ceiling ' + D.money(totalCeiling)) +
      '</span>' +
      '<div class="sp">' +
        (D.can(user, 'export') ? U.btn('Export', { act: 'phaseb' }) : '') +
        U.action(user, 'create', null, '+ New project', { brass: true }) +
      '</div></div>';

    /* -------------------------------------------- multi-country selector */
    html += countrySelector(inSel, scoped, codes, sel, state);

    /* --------------------------------------------------- status filters */
    var chips = [{ f: 'all', label: 'All', n: counts.all }];
    CBP.CONFIG.STATUS_ORDER.forEach(function (s) {
      chips.push({ f: String(s), label: CBP.CONFIG.STATUS[s].label, n: counts[s] || 0 });
    });
    html += '<div class="filters">' + chips.map(function (c) {
      return '<button class="chip' + (String(filter) === c.f ? ' on' : '') +
             '" data-act="filter" data-f="' + e(c.f) + '">' + e(c.label) +
             ' <span class="n num">' + c.n + '</span></button>';
    }).join('') +
      '<input class="search" id="p3search" type="search" data-act="search" ' +
      'autocomplete="off" aria-label="Search projects" ' +
      'placeholder="Search project, owner, implementer…" value="' + e(state.ui.p3Search || '') + '">' +
      '</div>';

    /* ------------------------------------------------------- the register */
    html += '<div class="preg">' +
      '<div class="lhead"><span>Project</span>' +
      '<span class="c-stage">Phase / approval stage</span>' +
      '<span class="r">Budget</span>' +
      '<span class="c-prog">Implementation progress</span>' +
      '<span class="c-cmt r">Comments</span><span></span></div>';

    var anyRow = false;
    rollup.forEach(function (r) {
      var rows = shown.filter(function (p) { return p.country === r.code; });
      if (!rows.length) return;
      anyRow = true;
      rows.sort(function (a, b) {
        return statusRank(a.status) - statusRank(b.status) || a.id.localeCompare(b.id);
      });
      /* the palette class rides on the section, so the band header (--ccb) and
         the project-card area (--ccl) both resolve from one declaration */
      var cc = ccOf(r.code);
      html += '<section class="cgrp ' + cc + '">' + countryBand(r, cc) +
        '<div class="cbody">' +
        rows.map(function (p) { return projectRow(p, state); }).join('') +
        '</div></section>';
    });

    if (!anyRow) {
      html += '<div class="cempty"><b>No projects match' +
              (q ? ' “' + e(state.ui.p3Search.trim()) + '”' : ' this filter') + '</b>' +
              '<span>in ' + e(scopeName) + '</span></div>';
    }
    html += '</div>';

    /* ------------------------------------------------------ foot totals */
    var neg = totalCommitted > totalCeiling;
    html += '<div class="foot">' +
      '<span>Committed across statuses 1–4: <b>' + D.money(totalCommitted) +
      '</b> of <b>' + D.money(totalCeiling) + '</b> ceiling' +
      (narrowed ? ' · ' + sel.length + ' of ' + codes.length + ' countries selected' : '') + '</span>' +
      '<span class="' + (neg ? 'neg' : '') + '">' +
      (neg ? 'Budget minus total: ' + D.money(totalCeiling - totalCommitted) + ' · ' : 'Headroom: ' +
        D.money(totalCeiling - totalCommitted) + ' · ') +
      'coverage ' + D.pct(totalCoverage) + '</span></div>';

    html += '<p class="pagenote">Amounts in USD. Every figure is summed from the fixture set at ' +
      'render time — country totals, coverage and all day counts are derived against ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + ', never stored. Rows are scoped to the signed-in ' +
      'user’s countries (' + e(codes.join(', ')) + ')' +
      (narrowed ? ' and narrowed to the countries selected above' : '') + '. ' +
      'The comment count on each row is that project’s conversation; a dot marks messages you ' +
      'have not read yet.</p>';

    return html;
  };

  function statusRank(s) {
    return { 1: 0, 2: 1, 3: 2, 4: 3, declined: 4 }[s];
  }

  /* free-text search across project name, id, owner and implementer */
  function matches(p, q) {
    if (!q) return true;
    return [p.name, p.id, p.primary_implementer, p.strategic_priority,
            p.owner ? CBP.userName(p.owner) : 'unassigned', p.owner]
      .filter(Boolean).join(' ').toLowerCase().indexOf(q) > -1;
  }

  /* ------------------------------------------- multi-country chip row ---- */

  function countrySelector(inSel, scoped, codes, sel, state) {
    var all = sel.length === codes.length;
    var chips = '<button class="cchip' + (all ? ' on' : '') +
      '" data-act="p4c-countries-all" aria-pressed="' + (all ? 'true' : 'false') + '">' +
      'All countries <span class="n num">' + codes.length + '</span></button>';

    chips += codes.map(function (code) {
      var c = state.countries.filter(function (x) { return x.code === code; })[0];
      var n = scoped.filter(function (p) { return p.country === code; }).length;
      var on = !all && sel.indexOf(code) > -1;
      return '<button class="cchip ' + ccOf(code) + (on ? ' on' : '') +
        '" data-act="p4c-country" ' +
        'data-c="' + e(code) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        flagMark(code) + e(c ? c.name : code) +
        ' <span class="n num">' + n + '</span></button>';
    }).join('');

    return '<div class="cselect" role="group" aria-label="Filter by country">' +
      '<span class="cslab">Countries</span>' + chips +
      '<span class="cshint">' + (all
        ? 'Showing every country in your scope.'
        : 'Groups, totals and the status counts below follow this selection.') +
      '</span></div>';
  }

  /* --------------------------- country band with the derived totals ------ */
  function countryBand(r, cc) {
    var over = r.over > 0;
    return '<header class="cband ' + cc + '">' +
      '<div class="cbtitle">' + flagMark(r.code) + '<b>' + e(r.name) + '</b>' +
        '<span class="cnt num">' + r.count + ' project' + (r.count === 1 ? '' : 's') + '</span>' +
      '</div>' +
      '<div class="cbfig">' +
        '<span class="cbmoney">committed <b class="num">' + D.money(r.committed) + '</b>' +
        ' of <span class="num">' + D.money(r.ceiling) + '</span></span>' +
        U.coverageCell(r.coverage) +
        (over ? '<span class="over num">' + D.money(r.over) + ' over</span>' : '') +
        '<span class="cbq">queue <b class="num">' + r.queue + '</b></span>' +
      '</div></header>';
  }

  /* ------------------------------------------------ C-05 expandable row -- */
  function projectRow(p, state) {
    var sub = D.stageSubLine(p);
    var open = !!state.ui.openRows[p.id];
    var meta = [];
    meta.push('Owner: ' + (p.owner ? CBP.userName(p.owner) : 'unassigned'));
    if (p.primary_implementer) meta.push(p.primary_implementer);
    if (p.strategic_priority) meta.push(p.strategic_priority);

    var budgetSub = { 4: 'draft', 3: 'requested', 2: 'approved', 1: 'approved',
                      declined: 'requested' }[p.status];

    return '<details class="prj" data-id="' + e(p.id) + '"' + (open ? ' open' : '') + '>' +
      '<summary class="prow">' +
        '<span class="pname"><span class="id num">' + e(p.id) + '</span>' +
        '<b>' + e(p.name) + '</b><small>' + e(meta.join(' · ')) + '</small></span>' +
        '<span class="stage">' + U.statusPill(p.status) +
        '<small class="' + e(sub.tone) + '">' + e(sub.text) + '</small></span>' +
        '<span class="amt num">' + D.money(p.amount) + '<small>' + e(budgetSub) + '</small></span>' +
        U.progressBar(p) +
        commentPill(p, state) +
        '<span class="chev">▾</span>' +
      '</summary>' + panel(p, state) + '</details>';
  }

  /* the conversation count, straight through to that project's comments */
  function commentPill(p, state) {
    var n = D.commentsFor(p.id).length;
    var unread = D.unreadFor(state.user, p.id);
    var title = n
      ? n + ' comment' + (n === 1 ? '' : 's') +
        (unread ? ' · ' + unread + ' unread' : ' · all read')
      : 'No comments yet — open the project to start the conversation';

    return '<span class="cmtcell"><button class="cpill' + (unread ? ' unread' : '') +
      (n ? '' : ' none') + '" data-act="p4c-comments" data-id="' + e(p.id) + '" ' +
      'title="' + e(title) + '" aria-label="' + e(title) + '">' +
      '<span class="ic" aria-hidden="true">❝</span>' +
      '<span class="n num">' + n + '</span>' +
      (unread ? '<span class="dot" aria-hidden="true"></span>' : '') +
      '</button></span>';
  }

  /* -------------------------------------------------------- open panel */
  function panel(p, state) {
    var user = state.user;
    var html = '<div class="panel">';

    /* approval stage — C-16 */
    html += '<div class="ph">Approval stage' + rowActions(p, user) + '</div>';
    html += U.stepper(p);

    var dq = D.dInQ(p);
    var bits = [];
    if (dq !== null) bits.push('<b>' + D.days(dq) + '</b> in queue');
    if (D.daysInStage(p) !== null) bits.push('<b>' + D.days(D.daysInStage(p)) + '</b> in current stage');
    if (p.target_date) bits.push('target <b>' + D.fmtDateY(p.target_date) + '</b>');
    if (p.backup) bits.push('backup <b>' + e(CBP.userName(p.backup)) + '</b>');
    var nc = D.commentsFor(p.id).length;
    var nu = D.unreadFor(user, p.id);
    bits.push('comments <b class="num">' + nc + '</b>' +
      (nu ? ' · <b class="num neg">' + nu + '</b> unread' : ''));
    if (bits.length) html += '<div class="pmeta"><span>' + bits.join('</span><span>') + '</span></div>';

    /* timeline — C-06 */
    var model = D.ganttModel(p);
    var planned = (p.status !== 1);
    if (model) {
      html += '<div class="ph">' + (planned ? 'Planned implementation timeline' : 'Implementation timeline') +
        '<span class="r">' +
          U.action(user, 'editGantt', p, 'Configure', { sm: true }) +
          U.action(user, 'editGantt', p, 'Open full editor in TimeBlock ↗', { sm: true }) +
        '</span></div>';
      html += U.gantt(p);
      html += '<div class="gnote">' + (planned
        ? 'Dashed until Marked Approved — phase dates shift from the approval date (D-07).'
        : 'Progress is the elapsed share of each implementation phase; the red line is ' +
          D.fmtDateY(CBP.CONFIG.TODAY) + '.') + '</div>';
    } else {
      html += '<div class="ph">Implementation timeline' +
        '<span class="r">' + U.action(user, 'editGantt', p, 'Configure', { sm: true }) + '</span></div>' +
        '<div class="gnote">No phases entered yet — the mini Gantt appears here once ' +
        'phases are added (D-06/D-07).</div>';
    }

    if (!p.owner) {
      html += '<div class="gnote">No owner set — alerts cannot route until one is assigned (D-14).</div>';
    }

    return html + '</div>';
  }

  /* action controls, each gated by can() — the viewer renders none of them */
  function rowActions(p, user) {
    var acts = [
      '<a class="btn sm" href="#/project/' + e(p.id) + '">Open project detail</a>',
      '<button class="btn sm" data-act="p4c-comments" data-id="' + e(p.id) + '">Open comments</button>',
      U.action(user, 'submit', p, 'Request submitted', { sm: true, brass: true }),
      U.action(user, 'review', p, 'Request approved', { sm: true, brass: true }),
      U.action(user, 'review', p, 'Return to Review', { sm: true }),
      U.action(user, 'gate', p, 'Update gate', { sm: true }),
      U.action(user, 'markApproved', p, 'Mark Approved', { sm: true, brass: true })
    ].filter(Boolean);
    return acts.length ? '<span class="r">' + acts.join('') + '</span>' : '';
  }

  /* ================================================ delegated listener ====
     Registered ONCE, at load. The country chips are the only P3 controls that
     are not already wired in actions.js; 'p4c-comments' is shared with P4 and
     is handled here because P3 is where it is clicked most. Everything follows
     the one-pass rule: mutate CBP.state, then CBP.render(). */

  function toggleCountry(code) {
    var state = CBP.state;
    var codes = D.visibleCountries(state.user, state.countries);
    if (codes.indexOf(code) === -1) return;

    var sel = state.ui.p3Countries;
    if (!sel || Object.prototype.toString.call(sel) !== '[object Array]' || !sel.length) {
      state.ui.p3Countries = [code];               /* from "all" → just this one */
      return;
    }
    var next = codes.filter(function (c) {
      return c === code ? sel.indexOf(c) === -1 : sel.indexOf(c) > -1;
    });
    state.ui.p3Countries = (!next.length || next.length === codes.length) ? null : next;
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!t) return;
    var act = t.getAttribute('data-act');

    if (act === 'p4c-country') {
      toggleCountry(t.getAttribute('data-c'));
    } else if (act === 'p4c-countries-all') {
      CBP.state.ui.p3Countries = null;
    } else if (act === 'p4c-comments') {
      /* straight to the conversation on that project — the register's row pill
         and the panel button both land on the P4 comments tab */
      CBP.state.ui.p4Tab = 'comments';
      CBP.state.ui.err = null;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      location.hash = '#/project/' + t.getAttribute('data-id');
      return;                                      /* hashchange runs render() */
    } else {
      return;
    }

    ev.preventDefault();
    ev.stopImmediatePropagation();                 /* keep app.js's fallbacks quiet */
    CBP.render();
  });

})();
