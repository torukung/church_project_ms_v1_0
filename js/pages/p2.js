/* pages/p2.js — P2 Dashboard.
   The confirmed design ported from reference/P2_Dashboard_UI_Sample_v3.html:
   tabs are named dashboards, one C-20 country scope per dashboard tab, and a
   single render() pass recomputes every widget from the selection.

   store.js owns the RM-4 seed: CBP.state.dashboards is the authoritative board
   list (id / name / widgets / layout) and is rendered VERBATIM here — this page
   adds no boards of its own and, since v1.0.1, creates none either: dashboards
   are created by the area office on the Administration page (A.dashCreate), and
   boards created there simply appear as tabs.

   v1.0.1 layout contract. A board carries `layout: { widgetId: { w:1|2|3,
   order:n } }` over a 3-track grid. This page renders that verbatim in VIEW
   mode; "Edit layout" copies it into ui.dashDraft (A.dashEditStart) and every
   move / resize / add / remove writes to that draft through CBP.actions, so
   Cancel restores exactly what was there and Save commits it.

   Page state lives under CBP.state.ui.dash (scope pane, per-board table sort);
   the scope selection lives in the store's CBP.state.scopeByDashboard. */
(function () {
  'use strict';

  var D = CBP.D, U = CBP.ui, W = CBP.W, e = CBP.ui.esc;
  CBP.pages = CBP.pages || {};

  /* One line of orientation per seeded board. Keyed by the store's board ids;
     a board with no entry (any board added in Administration) simply renders
     without it. */
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
        sort: {},         /* boardId → { col, dir } for C-04 sortable tables */
        scopeOpen: false,
        hint: null
      };
    }

    if (!boards.filter(function (x) { return x.id === d.active; }).length) {
      d.active = boards.length ? boards[0].id : null;
    }

    /* a board being edited is the board on screen — the tab strip cannot move
       out from under a half-finished draft */
    var editing = state.ui.dashEdit;
    if (editing && boards.filter(function (x) { return x.id === editing; }).length) {
      d.active = editing;
    }
    return d;
  }

  function activeDash(state) {
    var d = ensure(state);
    return state.dashboards.filter(function (x) { return x.id === d.active; })[0];
  }

  /* true while THIS board is in layout-edit mode with a live draft */
  function editingBoard(state, dashId) {
    var ui = state.ui;
    return !!(ui.dashEdit && ui.dashEdit === dashId && ui.dashDraft);
  }

  /* what to render: the draft while editing, otherwise the board itself */
  function source(state, dash) {
    return editingBoard(state, dash.id) ? state.ui.dashDraft : dash;
  }

  /* ================================================= the 3-track layout ===
     A board's layout is { widgetId: { w:1|2|3, order:n } } over a 3-track
     minmax(0,1fr) grid. Widgets render in `order`; `w` is how many of the three
     tracks each one asks for. Widgets are packed into rows in that order and a
     row breaks as soon as the next widget would need more than the three tracks
     left, so a row NEVER wraps mid-widget and the order is never shuffled.

     A row whose widgets ask for fewer than 3 tracks between them shares the row
     out in the ratio they asked for, rather than leaving a hole: two 1× widgets
     alone on a row are the confirmed 50/50 pair, and a single 1× widget with no
     partner takes the full width — which is exactly what the seeded spans in
     store.js describe, and exactly what v1.0 drew. Three 1× widgets on one row
     are thirds, and 1× + 2× is a third and two thirds, because those rows fill
     the three tracks outright. */

  function span(id, cell) {
    var w = cell ? cell.w : null;
    if (w === 1 || w === 2 || w === 3) return w;
    return W.defaultSpan(id);
  }

  function items(board) {
    var layout = board.layout || {};
    return (board.widgets || []).map(function (id, i) {
      var cell = layout[id];
      var order = (cell && typeof cell.order === 'number' && isFinite(cell.order))
        ? cell.order : (i + 1);
      return { id: id, w: span(id, cell), order: order, seq: i };
    }).sort(function (a, b) {
      return (a.order - b.order) || (a.seq - b.seq);
    });
  }

  function pack(list) {
    var rows = [], cur = [], used = 0;
    list.forEach(function (it) {
      if (cur.length && used + it.w > 3) { rows.push(cur); cur = []; used = 0; }
      cur.push(it);
      used += it.w;
    });
    if (cur.length) rows.push(cur);
    return rows;
  }

  /* ============================================================== render == */

  CBP.pages.dashboard = function (state) {
    var d = ensure(state);
    var dash = activeDash(state);
    var user = state.user;
    var canEdit = D.can(user, 'edit');

    /* the store seeds the boards; if none are present, say so rather than
       inventing a board list here */
    if (!dash) {
      return '<div class="p2-page"><div class="crumb">Dashboard</div>' +
        '<div class="pagehead"><h1>Dashboard</h1></div>' +
        '<div class="p2-blank"><b>No dashboards are configured</b>' +
        '<span>The seeded boards come from the store. Dashboards are created by the ' +
        'area office in Administration.</span>' +
        '<a class="btn" href="#/admin">Open Administration</a>' +
        '</div></div>';
    }

    var editing = editingBoard(state, dash.id);
    var board = source(state, dash);

    var allowed = W.allowedCodes(state);
    var codes = W.scopeFor(state, dash.id);
    var ctx = W.ctx(state, codes, dash.id);

    var html = '<div class="p2-page' + (editing ? ' p2-editing' : '') + '">';

    /* ---------------------------------------------------------- head ---- */
    html += '<div class="crumb">Dashboard · ' + e(dash.name) +
            ' · Budget year ' + e(CBP.CONFIG.BUDGET_YEAR) +
            (editing ? ' · editing layout' : '') + '</div>';

    html += '<div class="pagehead"><h1>' + e(ctx.title) + ' — ' +
      e(CBP.CONFIG.BUDGET_YEAR) + '</h1>' +
      '<span class="sub">' + e(W.plural(ctx.projects.length, 'project')) + ' in scope · ' +
      e(D.money(ctx.committed)) + ' committed</span>' +
      '<div class="sp">' + scopeSelector(state, d, allowed, codes) +
        '<span class="sel">Budget year ' + e(CBP.CONFIG.BUDGET_YEAR) + '</span>' +
        (canEdit && !editing
          ? '<button class="btn" data-act="dash-edit" data-id="' + e(dash.id) +
            '">Edit layout</button>' : '') +
        (D.can(user, 'export')
          ? '<button class="btn" data-p2="export">Export</button>' : '') +
      '</div></div>';

    /* --------------------------------------------------------- tabs ----- */
    /* Boards created in Administration appear here like any other tab. While a
       layout is being edited the strip locks to the board under edit, so a
       draft can never be stranded behind another tab. */
    html += '<div class="p2-tabs" role="tablist">' +
      state.dashboards.map(function (x) {
        var on = x.id === dash.id;
        return '<button class="p2-tab' + (on ? ' on' : '') +
          (editing && !on ? ' locked' : '') + '" role="tab" aria-selected="' + on + '"' +
          (editing && !on ? ' aria-disabled="true" disabled' : ' data-p2="tab"') +
          ' data-id="' + e(x.id) + '">' + e(x.name) + '</button>';
      }).join('') +
      (editing
        ? '<span class="p2-manage">Finish or cancel this layout to change tab</span>'
        : '<a class="p2-manage" href="#/admin">Manage dashboards in Administration</a>') +
      '</div>';

    /* ------------------------------------------- RD-3 print pre-read ----- */
    html += printHead(state, dash, ctx, codes);

    if (d.hint) html += '<div class="p2-hint">' + e(d.hint) + '</div>';

    if (editing) html += editBar(state, dash, board);

    if (LEAD[dash.id]) {
      html += '<p class="p2-lead">' + e(LEAD[dash.id]) + '</p>';
    }

    /* ------------------------------------------------------- widgets ---- */
    var list = items(board);
    if (!list.length) {
      html += '<div class="p2-blank">' +
        '<b>This dashboard is empty</b>' +
        '<span>' + (editing
          ? 'Place widgets from the catalogue below; each one arrives at the end of the board.'
          : 'Widgets are placed in Edit layout, from the predefined catalogue.') + '</span>' +
        (canEdit && !editing
          ? '<button class="btn brass" data-act="dash-edit" data-id="' + e(dash.id) +
            '">Edit layout</button>' : '') +
        '</div>';
    } else {
      html += '<div class="p2-grid">' + pack(list).map(function (row) {
        var tracks = row.reduce(function (a, it) { return a + it.w; }, 0) || 1;
        return '<div class="p2-row" style="grid-template-columns:repeat(' + tracks +
          ',minmax(0,1fr))">' +
          row.map(function (it) {
            return widgetFrame(it, state, codes, ctx, dash, editing, list.length);
          }).join('') + '</div>';
      }).join('') + '</div>';
    }

    /* --------------------------------------------- predefined catalogue -- */
    if (editing) html += tray(state, dash, board);

    html += '<p class="pagenote">Amounts in USD. Coverage compares committed budget across ' +
      'statuses 1–4 with the country ceiling; values above 100% appear in red and every bar ' +
      'column shares one scale, so the 100% line runs straight down it. Day counts are ' +
      'derived against ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) + ', never stored. The country ' +
      'scope is global to this dashboard tab, remembered per dashboard, never empty, and only ' +
      'offers the ' + e(W.plural(allowed.length, 'country', 'countries')) +
      ' inside your data scope. Layout — the order and the width of each widget — is saved ' +
      'with the board; new boards and the widget catalogue itself are managed in ' +
      'Administration.</p>';

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

  /* ================================================ Save / Cancel bar ===== */

  /* Pinned to the top of the board while editing, so Save and Cancel are always
     one click away however far down the page the drag went. */
  function editBar(state, dash, board) {
    var n = (board.widgets || []).length;
    return '<div class="p2-editbar">' +
      '<span class="p2-editttl">Editing the layout of “' + e(dash.name) + '”</span>' +
      '<span class="p2-edithow">Drag a widget by its header, or use ← → to reorder. ' +
      '1× 2× 3× sets how many of the three columns it takes. ' +
      e(W.plural(n, 'widget')) + ' on the board.</span>' +
      '<span class="p2-editacts">' +
        '<button class="btn" data-act="dash-edit-cancel">Cancel</button>' +
        '<button class="btn brass" data-act="dash-edit-save">Save layout</button>' +
      '</span></div>';
  }

  /* ================================================ C-18 widget frame ===== */

  function widgetFrame(it, state, codes, ctx, dash, editing, count) {
    var id = it.id;
    var w = W.byId(id);
    if (!w) return '';
    var body, title = w.title;
    try {
      body = w.render(state, codes, ctx);
      if (w.titleFor) title = w.titleFor(ctx);
    } catch (err) {
      body = '<div class="p2-empty">This widget could not render.</div>';
    }

    /* the span is inline (it comes from data, not from a stylesheet); the
       matching dw-w1|2|3 class lets dash.css react to how narrow the card is */
    var cell = 'grid-column:span ' + it.w;
    var attrs = ' data-w="' + e(id) + '" style="' + cell + '"' +
      (editing ? ' draggable="true"' : '');
    var wide = ' dw-w' + it.w;

    var tools = editing ? editTools(dash.id, id, it, title, count) : '';

    if (w.bare) {
      return '<section class="dw dw-bare' + wide + (editing ? ' dw-edit' : '') + '"' + attrs + '>' +
        '<div class="dw-hd bare">' + (editing ? handle() : '') +
        '<h2>' + e(title) + '</h2></div>' + tools +
        body + '</section>';
    }

    var more = (w.more && !editing)
      ? '<a class="dw-more" href="' + e(w.moreHref || '#/projects') + '">' + e(w.more) + '</a>'
      : '';
    var dated = w.dated
      ? '<span class="dw-date num">as at ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) + '</span>' : '';

    return '<section class="dw' + wide + (editing ? ' dw-edit' : '') + '"' + attrs + '>' +
      '<div class="dw-hd">' + (editing ? handle() : '') +
      '<h2>' + e(title) + '</h2>' +
      '<span class="dw-tools">' + dated + more + '</span></div>' +
      (editing ? tools : '') +
      '<div class="dw-bd">' + body + '</div></section>';
  }

  function handle() {
    return '<span class="dw-grip" aria-hidden="true">⋮⋮</span>';
  }

  /* Quiet edit affordances: one row of small controls under the header, in the
     existing token grammar — no new colours, no tinted cards. The ← → buttons
     are the guaranteed keyboard path; dragging the header does the same thing
     through the same action. */
  function editTools(dashId, wid, it, title, count) {
    var mv = function (dir, glyph, label) {
      var edge = (dir === -1 && it.order <= 1) || (dir === 1 && it.order >= count);
      return '<button class="p2-eb" data-act="dash-move" data-id="' + e(dashId) +
        '" data-w="' + e(wid) + '" data-dir="' + dir + '"' + (edge ? ' disabled' : '') +
        ' title="' + e(label + ' ' + title) + '" aria-label="' + e(label + ' ' + title) +
        '">' + glyph + '</button>';
    };

    var spans = [1, 2, 3].map(function (n) {
      return '<button class="p2-eb p2-span' + (it.w === n ? ' on' : '') +
        '" data-act="dash-resize" data-id="' + e(dashId) + '" data-w="' + e(wid) +
        '" data-span="' + n + '" aria-pressed="' + (it.w === n) +
        '" title="' + e(title + ' spans ' + n + ' of 3 columns') + '">' + n + '×</button>';
    }).join('');

    return '<div class="dw-tools edit">' +
      '<span class="p2-ebg">' + mv(-1, '←', 'Move earlier —') + mv(1, '→', 'Move later —') +
        '</span>' +
      '<span class="p2-ebg">' + spans + '</span>' +
      '<span class="p2-ebpos num" title="Position on the board">' + it.order + ' of ' +
        count + '</span>' +
      '<button class="p2-eb p2-x" data-act="dash-remove" data-id="' + e(dashId) +
        '" data-w="' + e(wid) + '" title="Remove ' + e(title) +
        '" aria-label="Remove ' + e(title) + '">×</button>' +
      '</div>';
  }

  /* ======================================== predefined catalogue tray ===== */

  /* Everything in W.registry that is not already on this board, with the
     dataset line the area office maintains (state.widgetMeta[id].desc wins over
     the registered blurb — the same read as the Administration catalogue). */
  function tray(state, dash, board) {
    var on = board.widgets || [];
    var rest = W.registry.filter(function (w) { return on.indexOf(w.id) === -1; });

    var cards = rest.map(function (w) {
      return '<button class="p2-pick" data-act="dash-add" data-id="' + e(dash.id) +
        '" data-w="' + e(w.id) + '">' +
        '<b>' + e(w.title) + '</b>' +
        '<span>' + e(W.widgetDesc(state, w)) + '</span>' +
        '<em>add · ' + (W.defaultSpan(w.id) === 3 ? 'arrives full width'
          : 'arrives 1 of 3 columns') + '</em></button>';
    }).join('');

    return '<section class="p2-tray">' +
      '<div class="p2-trayhd"><h2>Widget catalogue</h2>' +
      '<span>' + (rest.length
        ? e(W.plural(rest.length, 'widget') + ' not yet on “' + dash.name + '”')
        : 'Every predefined widget is already on this board') +
      ' · dataset definitions are maintained in Administration</span></div>' +
      (rest.length
        ? '<div class="p2-pickgrid">' + cards + '</div>'
        : '<div class="p2-empty">Nothing left to place — remove a widget to put it back ' +
          'in the catalogue.</div>') +
      '</section>';
  }

  /* ================================================ RD-3 meeting pack ===== */

  function printHead(state, dash, ctx, codes) {
    var names = codes.map(function (c) { return W.countryName(state, c); }).join(', ');
    return '<div class="p2-print">' +
      '<h2>' + e(dash.name) + ' — ' + e(ctx.title) + '</h2>' +
      '<p>Budget year ' + e(CBP.CONFIG.BUDGET_YEAR) + ' · prepared ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + ' · ' + e(state.user.name) + '</p>' +
      '<p>Country scope: ' + e(names) + ' · committed ' + e(D.money(ctx.committed)) +
      ' of ' + e(D.money(ctx.ceiling)) + ' ceiling · coverage ' + e(D.pct(ctx.coverage)) +
      '</p></div>';
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

  /* ==================================================== event wiring ======
     Every listener below is registered ONCE, at load, on document — never per
     render. The layout actions themselves are the wired data-act handlers in
     actions.js (dash-edit / dash-edit-save / dash-edit-cancel / dash-move /
     dash-resize / dash-add / dash-remove); this file only adds the pointer
     enhancement on top of them. */

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
    if (!dash) return;

    if (act === 'tab') {
      ev.preventDefault();
      /* the strip is locked while a draft is open, so this can only ever be a
         board the user is free to move to */
      if (state.ui.dashEdit) return;
      d.active = t.getAttribute('data-id');
      d.scopeOpen = false; d.hint = null;
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
     scope pane */
  document.addEventListener('keydown', function (ev) {
    if (!dashOn()) return;
    var d = CBP.state.ui.dash;

    if (ev.key === 'Escape') {
      if (!d.scopeOpen) return;
      d.scopeOpen = false;
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

  /* ------------------------------------------------- drag to reorder ----- */
  /* Enhancement only. It moves the widget through the SAME action the ← →
     buttons use (A.dashMove on the draft), one step at a time, so drag and
     keyboard can never disagree about what a reorder means — and a browser
     with no HTML5 drag still has the buttons. */

  var dragId = null;

  function editingNow() {
    if (!dashOn()) return null;
    var state = CBP.state;
    var id = state.ui.dashEdit;
    if (!id || !state.ui.dashDraft) return null;
    if (!D.can(state.user, 'edit')) return null;
    return id;
  }

  function draftOrder() {
    var draft = CBP.state.ui.dashDraft;
    return (draft && draft.widgets) ? draft.widgets.slice() : [];
  }

  function moveTo(dashId, wid, target) {
    var order = draftOrder();
    var from = order.indexOf(wid), to = order.indexOf(target);
    if (from === -1 || to === -1 || from === to) return false;
    var dir = to > from ? 1 : -1;
    var steps = Math.abs(to - from), moved = false;
    for (var i = 0; i < steps; i++) {
      var r = CBP.actions.dashMove(dashId, wid, dir);
      if (!r || r.ok === false) break;
      moved = true;
    }
    return moved;
  }

  function clearCues() {
    var nodes = document.querySelectorAll
      ? document.querySelectorAll('.dw.dragging,.dw.dropat') : [];
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.remove('dragging');
      nodes[i].classList.remove('dropat');
    }
  }

  document.addEventListener('dragstart', function (ev) {
    if (!editingNow()) return;
    var s = closest(ev.target, '.dw[data-w]');
    if (!s) return;
    dragId = s.getAttribute('data-w');
    s.classList.add('dragging');
    try {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', dragId);
    } catch (err) { /* some browsers refuse the payload — the id is in dragId */ }
  });

  document.addEventListener('dragover', function (ev) {
    if (!dragId || !editingNow()) return;
    var s = closest(ev.target, '.dw[data-w]');
    if (!s || s.getAttribute('data-w') === dragId) return;
    ev.preventDefault();
    try { ev.dataTransfer.dropEffect = 'move'; } catch (err) { /* noop */ }
    if (!s.classList.contains('dropat')) {
      clearCues();
      var src = document.querySelector
        ? document.querySelector('.dw[data-w="' + dragId + '"]') : null;
      if (src) src.classList.add('dragging');
      s.classList.add('dropat');
    }
  });

  document.addEventListener('drop', function (ev) {
    var dashId = editingNow();
    if (!dragId || !dashId) return;
    var s = closest(ev.target, '.dw[data-w]');
    if (!s) return;
    ev.preventDefault();
    var target = s.getAttribute('data-w'), wid = dragId;
    dragId = null;
    clearCues();
    if (target && target !== wid && moveTo(dashId, wid, target)) CBP.render();
  });

  document.addEventListener('dragend', function () {
    dragId = null;
    clearCues();
  });

})();
