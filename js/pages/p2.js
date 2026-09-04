/* pages/p2.js — P2 Dashboard.
   The confirmed design ported from reference/P2_Dashboard_UI_Sample_v3.html:
   tabs are named dashboards, one C-20 country scope per dashboard tab, and a
   single render() pass recomputes every widget from the selection.

   store.js owns the RM-4 seed: CBP.state.dashboards is the authoritative board
   list (id / name / widgets) and is rendered VERBATIM here — this page adds no
   boards of its own. Boards the user creates are appended with custom:true.
   Page state lives under CBP.state.ui.dash (initialised lazily here); the scope
   selection lives in the store's CBP.state.scopeByDashboard, keyed by board id. */
(function () {
  'use strict';

  var D = CBP.D, U = CBP.ui, W = CBP.W, e = CBP.ui.esc;
  CBP.pages = CBP.pages || {};

  /* One line of orientation per seeded board. Keyed by the store's board ids;
     a board with no entry (any user-created one) simply renders without it. */
  var LEAD = {
    overview: 'The area board: committed against ceiling, what needs attention, and coverage ' +
              'per country. Every figure recomputes from the country scope.',
    approval: 'Where approvals actually sit: the external gate with its own day counters, the ' +
              'status mix behind it, and who is covering each queue.',
    budgetutil: 'RD-1 — the benchmarking view: ceiling against committed per country, then all ' +
                'countries in scope ranked so outliers show without opening a project.',
    impl: 'Implementation health: the status ladder, owner coverage per country, and the ' +
          'records that still have nobody on them.',
    chats: 'RD-4 — the platform’s native RAID list, built from the typed activity stream.'
  };

  /* --------------------------------------------------------- page state -- */

  function ensure(state) {
    var boards = state.dashboards || (state.dashboards = []);

    var d = state.ui.dash;
    if (!d) {
      d = state.ui.dash = {
        active: boards.length ? boards[0].id : null,
        layout: {},   /* boardId → [widgetId] — seeded from the store, then user-edited */
        sort: {},     /* boardId → { col, dir } for C-04 sortable tables */
        scopeOpen: false,
        picker: false,
        hint: null,
        seq: 0
      };
    }

    /* first sight of a board takes its widget list from the store; after that
       the user's add / remove edits own it */
    boards.forEach(function (x) {
      if (!d.layout[x.id]) d.layout[x.id] = (x.widgets || []).slice();
    });

    if (!boards.filter(function (x) { return x.id === d.active; }).length) {
      d.active = boards.length ? boards[0].id : null;
    }
    return d;
  }

  function activeDash(state) {
    var d = ensure(state);
    return state.dashboards.filter(function (x) { return x.id === d.active; })[0];
  }

  /* ============================================================== render == */

  CBP.pages.dashboard = function (state) {
    var d = ensure(state);
    var dash = activeDash(state);
    var user = state.user;
    var editable = !user.read_only;

    /* the store seeds the boards; if none are present, say so rather than
       inventing a board list here */
    if (!dash) {
      return '<div class="p2-page"><div class="crumb">Dashboard</div>' +
        '<div class="pagehead"><h1>Dashboard</h1></div>' +
        '<div class="p2-blank"><b>No dashboards are configured</b>' +
        '<span>The seeded boards come from the store; none were found.</span>' +
        (editable ? '<button class="btn brass" data-p2="newdash">+ New dashboard</button>' : '') +
        '</div></div>';
    }

    var allowed = W.allowedCodes(state);
    var codes = W.scopeFor(state, dash.id);
    var ctx = W.ctx(state, codes, dash.id);

    var html = '<div class="p2-page">';

    /* ---------------------------------------------------------- head ---- */
    html += '<div class="crumb">Dashboard · ' + e(dash.name) +
            ' · Budget year ' + e(CBP.CONFIG.BUDGET_YEAR) + '</div>';

    html += '<div class="pagehead"><h1>' + e(ctx.title) + ' — ' +
      e(CBP.CONFIG.BUDGET_YEAR) + '</h1>' +
      '<span class="sub">' + e(W.plural(ctx.projects.length, 'project')) + ' in scope · ' +
      e(D.money(ctx.committed)) + ' committed</span>' +
      '<div class="sp">' + scopeSelector(state, d, allowed, codes) +
        '<span class="sel">Budget year ' + e(CBP.CONFIG.BUDGET_YEAR) + '</span>' +
        (editable ? '<button class="btn" data-p2="addwidget">+ Add widget</button>' : '') +
        (D.can(user, 'export')
          ? '<button class="btn" data-p2="export">Export</button>' : '') +
      '</div></div>';

    /* --------------------------------------------------------- tabs ----- */
    html += '<div class="p2-tabs" role="tablist">' +
      state.dashboards.map(function (x) {
        return '<button class="p2-tab' + (x.id === dash.id ? ' on' : '') +
          '" role="tab" aria-selected="' + (x.id === dash.id) +
          '" data-p2="tab" data-id="' + e(x.id) + '">' + e(x.name) + '</button>';
      }).join('') +
      (editable ? '<button class="p2-tab new" data-p2="newdash">+ New dashboard</button>' : '') +
      '</div>';

    /* ------------------------------------------- RD-3 print pre-read ----- */
    html += printHead(state, dash, ctx, codes);

    if (d.hint) html += '<div class="p2-hint">' + e(d.hint) + '</div>';

    if (LEAD[dash.id]) {
      html += '<p class="p2-lead">' + e(LEAD[dash.id]) + '</p>';
    }

    /* ------------------------------------------------------- widgets ---- */
    var ids = d.layout[dash.id] || [];
    if (!ids.length) {
      html += '<div class="p2-blank">' +
        '<b>This dashboard is empty</b>' +
        '<span>Pick widgets from the library and they are placed in order.</span>' +
        (editable ? '<button class="btn brass" data-p2="addwidget">+ Add widget</button>' : '') +
        '</div>';
    } else {
      var sizes = pairUp(ids);
      html += '<div class="p2-grid">' + ids.map(function (id, i) {
        return widgetFrame(id, state, codes, ctx, editable, sizes[i]);
      }).join('') + '</div>';
    }

    /* -------------------------------------------------------- picker ---- */
    if (d.picker && editable) html += picker(state, d, dash);

    html += '<p class="pagenote">Amounts in USD. Coverage compares committed budget across ' +
      'statuses 1–4 with the country ceiling; values above 100% appear in red. Day counts are ' +
      'derived against ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) + ', never stored. The country ' +
      'scope is global to this dashboard tab, remembered per dashboard, never empty, and only ' +
      'offers the ' + e(W.plural(allowed.length, 'country', 'countries')) +
      ' inside your data scope.</p>';

    return html + '</div>';
  };

  /* ============================================== C-20 scope selector ===== */

  function scopeSelector(state, d, allowed, codes) {
    var list = allowed.map(function (c) {
      var on = codes.indexOf(c) > -1;
      return '<label><input type="checkbox" data-p2="scope-country" value="' + e(c) + '"' +
        (on ? ' checked' : '') + '><span>' + e(W.countryName(state, c)) + '</span></label>';
    }).join('');

    return '<div class="scope p2-scope">' +
      '<button class="scope-btn" data-p2="scope-toggle" aria-haspopup="true" aria-expanded="' +
        (d.scopeOpen ? 'true' : 'false') + '">' +
        '<span>' + e(W.scopeLabel(state, codes)) + '</span>' +
        '<span class="chip num">' + codes.length + '</span>' +
        '<span aria-hidden="true">▾</span></button>' +
      '<div class="p2-scope-pane' + (d.scopeOpen ? ' open' : '') + '" role="menu">' +
        '<div class="hd"><span>Country scope</span>' +
        '<button data-p2="scope-all">Select all</button></div>' +
        '<div class="p2-scope-list">' + list + '</div>' +
        '<div class="ft">' + allowed.length + ' of 22 countries are inside your data scope in ' +
        'this demo. The same scope drives every widget on this dashboard tab and is remembered ' +
        'per dashboard. At least one country always stays ticked.</div>' +
      '</div></div>';
  }

  /* ================================================ C-18 widget frame ===== */

  /* Two-up layout, in board order: consecutive half-width widgets pair off, and
     a half-width widget with no partner takes the whole row rather than leaving
     an empty cell. Nothing is reordered — the store's order is the order. */
  function pairUp(ids) {
    var size = ids.map(function (id) {
      var w = W.byId(id);
      return (w && !w.bare && w.size !== 'full') ? 'half' : 'full';
    });
    var out = [], i = 0;
    while (i < size.length) {
      if (size[i] === 'half' && size[i + 1] === 'half') { out[i] = out[i + 1] = 'half'; i += 2; }
      else { out[i] = 'full'; i += 1; }
    }
    return out;
  }

  function widgetFrame(id, state, codes, ctx, editable, size) {
    var w = W.byId(id);
    if (!w) return '';
    var body, title = w.title;
    try {
      body = w.render(state, codes, ctx);
      if (w.titleFor) title = w.titleFor(ctx);
    } catch (err) {
      body = '<div class="p2-empty">This widget could not render.</div>';
    }

    var tools = (editable
      ? '<button class="p2-x" data-p2="remove" data-id="' + e(id) +
        '" title="Remove widget" aria-label="Remove ' + e(w.title) + '">×</button>' : '');

    if (w.bare) {
      return '<section class="dw dw-bare dw-full" data-w="' + e(id) + '">' +
        '<div class="dw-hd bare"><h2>' + e(title) + '</h2>' +
        (tools ? '<span class="dw-tools">' + tools + '</span>' : '') + '</div>' +
        body + '</section>';
    }

    var more = w.more
      ? '<a class="dw-more" href="' + e(w.moreHref || '#/projects') + '">' + e(w.more) + '</a>'
      : '';
    var dated = w.dated
      ? '<span class="dw-date num">as at ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) + '</span>' : '';

    return '<section class="dw dw-' + (size === 'half' ? 'half' : 'full') +
      '" data-w="' + e(id) + '">' +
      '<div class="dw-hd"><h2>' + e(title) + '</h2>' +
      '<span class="dw-tools">' + dated + more + tools + '</span></div>' +
      '<div class="dw-bd">' + body + '</div></section>';
  }

  /* ========================================== click-to-place widget picker = */

  function picker(state, d, dash) {
    var on = d.layout[dash.id] || [];
    var cards = W.registry.map(function (w) {
      var placed = on.indexOf(w.id) > -1;
      return '<button class="p2-pick' + (placed ? ' placed' : '') + '"' +
        (placed ? ' disabled' : '') + ' data-p2="pick" data-id="' + e(w.id) + '">' +
        '<b>' + e(w.title) + '</b><span>' + e(w.blurb) + '</span>' +
        '<em>' + (placed ? 'already on this dashboard' : 'click to place · ' +
          (w.size === 'full' ? 'full width' : 'half width')) + '</em></button>';
    }).join('');

    return '<div class="p2-picker" data-p2="picker-close">' +
      '<div class="p2-pickbox" data-p2="picker-stop" role="dialog" aria-label="Widget library">' +
      '<h3>Widget library</h3>' +
      '<p>Click a widget to place it at the end of “' + e(dash.name) + '”. ' +
      'Widgets inherit this dashboard’s country scope.</p>' +
      '<div class="p2-pickgrid">' + cards + '</div>' +
      '<div class="p2-pickacts"><button class="btn" data-p2="picker-close">Close</button></div>' +
      '</div></div>';
  }

  /* ================================================ RD-3 meeting pack ===== */

  function printHead(state, dash, ctx, codes) {
    var names = codes.map(function (c) { return W.countryName(state, c); }).join(', ');
    return U.printPack(
      '<h2>' + e(dash.name) + ' — ' + e(ctx.title) + '</h2>' +
      '<p>Budget year ' + e(CBP.CONFIG.BUDGET_YEAR) + ' · prepared ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + ' · ' + e(state.user.name) + '</p>' +
      '<p>Country scope: ' + e(names) + ' · committed ' + e(D.money(ctx.committed)) +
      ' of ' + e(D.money(ctx.ceiling)) + ' ceiling · coverage ' + e(D.pct(ctx.coverage)) +
      '</p>');   /* F27 — shared U.printPack */
  }

  function doExport() {
    document.body.classList.add('p2-printing');
    var clear = function () { document.body.classList.remove('p2-printing'); };
    if (window.matchMedia) {
      try { window.addEventListener('afterprint', clear, { once: true }); } catch (err) { /* noop */ }
    }
    try { window.print(); } catch (err) { /* headless / blocked */ }
    window.setTimeout(clear, 1200);
  }

  /* ==================================================== event wiring ====== */

  function dashOn() {
    return CBP.state && CBP.state.ui && CBP.state.ui.route === 'dashboard' &&
           CBP.state.ui.dash;
  }

  function closest(node, sel) {
    return (node && node.closest) ? node.closest(sel) : null;
  }

  document.addEventListener('click', function (ev) {
    if (!dashOn()) return;
    var state = CBP.state, d = state.ui.dash;
    var t = closest(ev.target, '[data-p2]');
    var act = t ? t.getAttribute('data-p2') : null;

    /* click outside the open scope pane closes it */
    if (!act || act === 'scope-country') {
      if (d.scopeOpen && !closest(ev.target, '.p2-scope')) {
        d.scopeOpen = false;
        CBP.render();
      }
      return;
    }

    var dash = activeDash(state);
    /* every action but "new dashboard" needs a board to act on */
    if (!dash && act !== 'newdash') return;

    if (act === 'tab') {
      ev.preventDefault();
      d.active = t.getAttribute('data-id');
      d.scopeOpen = false; d.picker = false; d.hint = null;
      CBP.render();

    } else if (act === 'newdash') {
      ev.preventDefault();
      var name = null;
      try { name = window.prompt('Name this dashboard', 'My dashboard'); } catch (err) { name = null; }
      if (!name || !String(name).trim()) return;
      d.seq += 1;
      var id = 'user' + d.seq;   /* v1.2.0 — deterministic (T-04, R2); no Date.now */
      /* same shape as the store's seeded boards, marked as the user's own */
      state.dashboards.push({ id: id, name: String(name).trim(), widgets: [], custom: true });
      d.layout[id] = [];
      d.active = id;
      d.scopeOpen = false;
      d.picker = true;                    /* a new board opens the library */
      d.hint = null;
      CBP.render();

    } else if (act === 'scope-toggle') {
      ev.preventDefault();
      d.scopeOpen = !d.scopeOpen;
      d.hint = null;
      CBP.render();

    } else if (act === 'scope-all') {
      ev.preventDefault();
      W.setScope(state, dash.id, W.allowedCodes(state));
      d.hint = null;
      CBP.render();

    } else if (act === 'export') {
      ev.preventDefault();
      doExport();

    } else if (act === 'addwidget') {
      ev.preventDefault();
      d.picker = true; d.scopeOpen = false;
      CBP.render();

    } else if (act === 'picker-close') {
      ev.preventDefault();
      d.picker = false;
      CBP.render();

    } else if (act === 'picker-stop') {
      /* clicks inside the box must not close it */

    } else if (act === 'pick') {
      ev.preventDefault();
      var wid = t.getAttribute('data-id');
      var list = d.layout[dash.id] || (d.layout[dash.id] = []);
      if (list.indexOf(wid) === -1) list.push(wid);
      d.picker = false;
      CBP.render();

    } else if (act === 'remove') {
      ev.preventDefault();
      var rid = t.getAttribute('data-id');
      d.layout[dash.id] = (d.layout[dash.id] || []).filter(function (x) { return x !== rid; });
      CBP.render();

    } else if (act === 'sort') {
      ev.preventDefault();
      var col = t.getAttribute('data-col');
      var cur = W.sortFor(state, dash.id);
      d.sort[dash.id] = (cur.col === col)
        ? { col: col, dir: cur.dir === 'desc' ? 'asc' : 'desc' }
        : { col: col, dir: col === 'name' ? 'asc' : 'desc' };
      CBP.render();
    }
  });

  /* sortable table heads reachable from the keyboard (C-04); Escape closes the
     scope pane and the widget library */
  document.addEventListener('keydown', function (ev) {
    if (!dashOn()) return;
    var d = CBP.state.ui.dash;

    if (ev.key === 'Escape') {
      if (!d.picker && !d.scopeOpen) return;
      d.picker = false; d.scopeOpen = false;
      CBP.render();
      return;
    }
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var t = closest(ev.target, '[data-p2="sort"]');
    if (!t) return;
    ev.preventDefault();
    t.click();
  });

  /* the scope engine: tick / untick a country, never empty, one render pass */
  document.addEventListener('change', function (ev) {
    if (!dashOn()) return;
    var t = ev.target;
    if (!t || !t.getAttribute || t.getAttribute('data-p2') !== 'scope-country') return;

    var state = CBP.state, d = state.ui.dash;
    var dash = activeDash(state);
    var ok = W.toggleCountry(state, dash.id, t.value);
    d.hint = ok ? null
      : 'Country scope never empties — ' + W.countryName(state, t.value) + ' stays selected.';
    d.scopeOpen = true;
    CBP.render();
  });

})();
