/* pages/p11.js — P11 Messages & Alerts, route #/messages (v1.0.1, item 7).

   The unified hub. Project comments and approval notes from every project in
   the signed-in persona's scope arrive in one list, ranked and filtered, with
   the same unread number the sidebar balloon carries — both read
   D.unreadCount, so they can never disagree.

   Everything on this page is derived. The hub stores nothing of its own beyond
   view state: which row is expanded (ui.msgOpen) and what is typed in the quick
   reply (ui.msgDraft). Read marks, priority flags, pins and posted replies all
   go through CBP.actions, so the permission matrix is enforced in exactly one
   place and the viewer cannot write by any route.

   Viewer: sees the scope-filtered list and the thread excerpts, and nothing
   else — no composer, no read toggle, no flag, no pin. Those controls are not
   rendered at all rather than rendered-and-blocked.

   OWNER: builder D (wave 2). Page file + css/v101-msg.css only. */
(function () {
  'use strict';

  var D = CBP.D, U = CBP.ui, A = CBP.actions, e = CBP.ui.esc;
  CBP.pages = CBP.pages || {};

  var SORTS = [
    { k: 'new',     label: 'Newest' },
    { k: 'old',     label: 'Oldest' },
    { k: 'project', label: 'By project' }
  ];

  var FEED_EXCERPT = 4;      /* how many recent comments an expanded row shows */
  var SNIPPET = 120;         /* body characters in a collapsed row */

  /* --------------------------------------------------------- page state --
     ui.msgFilter / msgSearch / msgSort / msgGroup are CORE's (store.js).
     ui.msgOpen and ui.msgDraft are this page's, assigned directly with a safe
     default so a persona switch or a cold state never renders undefined. */

  function ensure(state) {
    var ui = state.ui;
    if (['unread', 'all'].indexOf(ui.msgFilter) === -1) ui.msgFilter = 'unread';
    if (['new', 'old', 'project'].indexOf(ui.msgSort) === -1) ui.msgSort = 'new';
    if (typeof ui.msgSearch !== 'string') ui.msgSearch = '';
    ui.msgGroup = !!ui.msgGroup;
    if (ui.msgOpen === undefined) ui.msgOpen = null;
    if (typeof ui.msgDraft !== 'string') ui.msgDraft = '';
    return ui;
  }

  /* ------------------------------------------------------------ helpers -- */

  function countryName(state, code) {
    var c = state.countries.filter(function (x) { return x.code === code; })[0];
    return c ? c.name : code;
  }

  /* ------------------------------------------------- v1.0.3 · country identity
     Same grammar as the P3 register, so the two pages read as one system: the
     flag glyph plus the .cc-<code> palette class from css/app.css (C-21). Both
     resolve from the CODE alone; an unseeded code falls back to the neutral
     .cc-x swatch and no glyph, so a project in a country the palette has never
     heard of still renders a complete, legible row. */
  var FLAG = {
    BGD: '🇧🇩', NPL: '🇳🇵', KHM: '🇰🇭', IND: '🇮🇳', MMR: '🇲🇲', LAO: '🇱🇦', HKG: '🇭🇰'
  };

  function ccOf(code) {
    var k = String(code || '').toUpperCase();
    return FLAG[k] ? 'cc-' + k.toLowerCase() : 'cc-x';
  }

  /* aria-hidden: the country name is always printed beside the glyph */
  function flagMark(code) {
    var f = FLAG[String(code || '').toUpperCase()];
    return f ? '<span class="ccflag" aria-hidden="true">' + f + '</span>' : '';
  }

  function projectOf(c) { return CBP.projectById(c.project_id); }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function snippet(body, n) {
    var s = String(body || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.\-]+$/, '') + '…' : s;
  }

  function stamp(c) {
    return D.fmtDateY(c.at) + ' · ' + (c.time || '');
  }

  /* the kind capsule — an approval note must never read as a plain remark */
  function kindTag(c) {
    var note = c.kind === 'approval_note';
    return '<span class="p11-kind' + (note ? ' note' : '') + '">' +
      '<span class="mk">' + (note ? '✓' : '“') + '</span>' +
      (note ? 'Approval note' : 'Comment') + '</span>';
  }

  /* search matches the message text, the author's name and the project name
     or id — the three things a person actually remembers about a message */
  function matcher(state, q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return function () { return true; };
    return function (c) {
      var p = projectOf(c);
      var hay = [
        c.body || '',
        CBP.userName(c.author),
        p ? p.name : '',
        p ? p.id : '',
        p ? countryName(state, p.country) : ''
      ].join(' ').toLowerCase();
      return hay.indexOf(q) > -1;
    };
  }

  /* Sort contract: a priority flag lifts a row to the top of ITS OWN group —
     the country section when grouping is on, the project cluster under "By
     project", the whole list otherwise. It never jumps a row out of its group. */
  function sortRows(rows, mode) {
    var out = rows.slice();
    out.sort(function (a, b) {
      if (mode === 'project') {
        var pa = projectOf(a), pb = projectOf(b);
        var la = (pa ? pa.name : '') + a.project_id;
        var lb = (pb ? pb.name : '') + b.project_id;
        if (la !== lb) return la < lb ? -1 : 1;
      }
      if (!!a.priority !== !!b.priority) return a.priority ? -1 : 1;
      var o = D.commentOrder(a, b);
      return mode === 'old' ? o : -o;
    });
    return out;
  }

  function orderPhrase(mode) {
    if (mode === 'old') return 'oldest first';
    if (mode === 'project') return 'by project';
    return 'newest first';
  }

  /* ============================================================== render == */

  CBP.pages.messages = function (state) {
    var ui = ensure(state);
    var user = state.user;
    var mayWrite = D.can(user, 'comment');          /* every role except viewer */

    var visible = D.commentsVisible(user);          /* country scope, chronological */
    var unreadAll = D.unreadCount(user);            /* THE number, same as the badge */

    var searched = visible.filter(matcher(state, ui.msgSearch));
    var unreadHere = searched.filter(function (c) { return D.isUnread(user, c); });
    var rows = ui.msgFilter === 'unread' ? unreadHere : searched;

    /* the error strip is consumed by the composer when one is on screen, so a
       rejected reply is answered where it was typed */
    var err = (state.ui.err && ['comment', 'pinProject'].indexOf(state.ui.err.key) > -1)
      ? state.ui.err.msg : null;
    var box = { err: err, taken: false };

    var list = renderList(state, ui, user, mayWrite, rows, visible, box);
    var unreadShown = unreadHere.length;

    var codes = D.visibleCountries(user, state.countries);
    var scopeTxt = codes.length === state.countries.length
      ? 'all ' + codes.length + ' seeded countries'
      : codes.map(function (c) { return countryName(state, c); }).join(', ');

    var html = '<div class="p11-page">';

    html += '<div class="crumb">Messages &amp; alerts · ' + e(scopeTxt) + ' · ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + '</div>';

    html += '<div class="pagehead"><h1>Messages &amp; alerts</h1>' +
      '<span class="sub"><span class="num">' + unreadAll + '</span> unread of ' +
      '<span class="num">' + visible.length + '</span> in your scope' +
      (mayWrite ? '' : ' · read-only') + '</span></div>';

    /* the arrival hint — the same derived count the sidebar balloon shows */
    if (unreadAll > 0) {
      html += '<div class="p11-new"><b class="num">' + plural(unreadAll, 'new message') +
        '</b> since you arrived — the sidebar balloon counts the same set.' +
        (mayWrite ? ' Open a row to reply, or mark it read to clear it.' : '') + '</div>';
    }

    html += rail(state, user, mayWrite);
    html += alertPanel(state, user, mayWrite);
    html += controls(state, ui, user, mayWrite, unreadShown, searched.length, unreadAll);
    html += list;

    html += '<p class="pagenote">Every message here is a project comment or an approval note ' +
      'from a project inside your data scope; the audit stream on each project is separate and ' +
      'untouched. Unread is per person — marking a message read changes nothing for anyone ' +
      'else, and your own messages are never unread to you.</p>';

    return html + '</div>';
  };

  /* ================================================ (a) pinned projects === */

  function rail(state, user, mayWrite) {
    var pins = (state.pinnedProjects || []).filter(function (pid) {
      var p = CBP.projectById(pid);
      if (!p) return false;
      return D.visibleCountries(user, state.countries).indexOf(p.country) > -1;
    });

    if (!pins.length) {
      if (!mayWrite) return '';
      return U.card('Pinned projects',
        '<div class="p11-empty"><b>Nothing pinned yet</b>' +
        '<span>Pin a project from any message row and it sits here with its own unread ' +
        'count and its last message, so a conversation you are steering never scrolls away.</span>' +
        '</div>');
    }

    var cards = pins.map(function (pid) {
      var p = CBP.projectById(pid);
      var feed = D.commentsFor(pid);
      var last = feed.length ? feed[feed.length - 1] : null;
      var un = D.unreadFor(user, pid);

      /* v1.0.3 — the pin's left rule is now the project country's flag accent
         rather than the v1.0.1 brass "has unread" rule. The unread signal moves
         onto its own dot beside the id, so it stays visible on every card
         instead of being carried by a border colour the country now owns. */
      return '<article class="p11-pin ' + ccOf(p.country) + (un ? ' has' : '') + '">' +
        '<div class="p11-pintop">' +
          (un ? '<span class="p11-dot" title="' + e(plural(un, 'unread message')) +
                '" aria-label="' + e(plural(un, 'unread message')) + '"></span>' : '') +
          '<span class="p11-pinid num">' + e(p.id) + '</span>' +
          (mayWrite
            ? '<button class="p11-x" data-act="pin-project" data-id="' + e(p.id) +
              '" title="Unpin ' + e(p.name) + '" aria-label="Unpin ' + e(p.name) +
              '">✕</button>'
            : '') +
        '</div>' +
        '<b class="p11-pinname">' + e(p.name) + '</b>' +
        '<div class="p11-pinmeta">' + flagMark(p.country) +
          e(countryName(state, p.country)) +
          ' · <span class="num' + (un ? ' hot' : '') + '">' +
          (un ? plural(un, 'unread') : 'nothing unread') + '</span></div>' +
        (last
          ? '<p class="p11-pinsnip">' + e(snippet(last.body, 96)) + '</p>' +
            '<div class="p11-pinby num">' + e(CBP.userName(last.author) + ' · ' + stamp(last)) +
            '</div>'
          : '<p class="p11-pinsnip dim">No messages on this project yet.</p>') +
        '<a class="p11-link" href="#/project/' + e(p.id) + '">Open project</a>' +
        '</article>';
    }).join('');

    return U.card('Pinned projects', '<div class="p11-pins">' + cards + '</div>');
  }

  /* ============================================ v1.2.0 · (a2) My alerts ====
     T-12 — the two preferences a person actually holds over their own mail:
     what hour the daily digest lands, and whether it lands at all. Both are
     per-user (state.alertPrefs[user.id]) and both go through A.setAlertPref, so
     the rule catalogue on P8 stays the Admin's surface and this stays theirs.

     The viewer sees the same panel read-only rather than not at all: a
     read-only account still receives mail, and hiding the control would leave
     them unable to see when it arrives. */

  function alertPanel(state, user, mayWrite) {
    var pref = (state.alertPrefs || {})[user.id] ||
      { digest_hour: CBP.CONFIG.DIGEST_HOUR, mute: false };
    var hour = (pref.digest_hour === undefined || pref.digest_hour === null)
      ? CBP.CONFIG.DIGEST_HOUR : pref.digest_hour;
    var muted = !!pref.mute;

    function hh(n) { return (n < 10 ? '0' + n : String(n)) + ':00'; }

    var body;
    if (!mayWrite) {
      body = '<div class="p4-fields">' +
        '<div class="p4-field"><span>Daily digest arrives at</span><b class="num">' +
          e(hh(hour)) + '</b></div>' +
        '<div class="p4-field"><span>Alert mail</span><b>' +
          (muted ? 'muted' : 'on') + '</b></div>' +
        '</div>' +
        '<p class="p4-note">Read-only for your role — these are the settings your account ' +
        'carries today.</p>';
    } else {
      var opts = '';
      for (var h = 0; h < 24; h++) {
        opts += '<option value="' + h + '"' + (h === hour ? ' selected' : '') + '>' +
          e(hh(h)) + '</option>';
      }
      body = '<div class="p4-fields p6-alerts">' +
        '<label class="p4-field" for="p11digest"><span>Daily digest arrives at</span>' +
          '<select class="sel sm" id="p11digest" data-act="p11-pref" data-f="digest_hour">' +
          opts + '</select></label>' +
        '<label class="p4-field" for="p11mute"><span>Mute my alert mail</span>' +
          '<input type="checkbox" id="p11mute" data-act="p11-pref" data-f="mute"' +
          (muted ? ' checked' : '') + '></label>' +
        '</div>' +
        '<p class="p4-note">Digest rules wait in the queue and are folded into one ' +
        e(CBP.CONFIG.DIGEST_RULE) + ' mail at the hour above; immediate rules are never held ' +
        'back, because a return or a rejection is not news that can wait. Muting stops the ' +
        'mail, not the record: everything still lands on the project and in this hub.</p>';
    }

    return U.card('My alerts', body);
  }

  /* ====================================================== (b) controls ==== */

  function controls(state, ui, user, mayWrite, nUnread, nAll, unreadAll) {
    var seg = function (label, on, act, attr, count) {
      return '<button class="chip' + (on ? ' on' : '') + '" data-act="' + act + '"' +
        attr + ' aria-pressed="' + (on ? 'true' : 'false') + '">' + e(label) +
        (count === undefined ? '' : ' <span class="n num">' + count + '</span>') + '</button>';
    };

    var filter =
      seg('Unread', ui.msgFilter === 'unread', 'msgfilter', ' data-f="unread"', nUnread) +
      seg('All', ui.msgFilter === 'all', 'msgfilter', ' data-f="all"', nAll);

    var sort = SORTS.map(function (s) {
      return seg(s.label, ui.msgSort === s.k, 'msgsort', ' data-s="' + s.k + '"');
    }).join('');

    return '<div class="p11-controls">' +
      '<div class="p11-seg" role="group" aria-label="Show">' + filter + '</div>' +
      '<input id="p11search" class="search" type="search" data-act="p11-search" ' +
        'autocomplete="off" placeholder="Search messages, people and projects" value="' +
        e(ui.msgSearch) + '">' +
      (ui.msgSearch
        ? '<button class="btn sm" data-act="p11-clear">Clear</button>' : '') +
      '<span class="p11-lab">Sort</span>' +
      '<div class="p11-seg" role="group" aria-label="Sort">' + sort + '</div>' +
      '<button class="chip' + (ui.msgGroup ? ' on' : '') + '" data-act="msggroup" ' +
        'aria-pressed="' + (ui.msgGroup ? 'true' : 'false') + '">Group by country</button>' +
      (mayWrite
        ? '<button class="btn sm" data-act="comment-readall"' +
          (unreadAll ? '' : ' disabled') +
          ' title="Marks every unread message in your scope read">Mark all read</button>'
        : '') +
      '</div>';
  }

  /* ========================================================== (c) list ==== */

  function renderList(state, ui, user, mayWrite, rows, visible, box) {
    var title = (ui.msgFilter === 'unread' ? 'Unread' : 'All messages') +
      ' — ' + orderPhrase(ui.msgSort) +
      (ui.msgGroup ? ' · grouped by country' : '') +
      ' · ' + plural(rows.length, 'message');

    if (!rows.length) {
      var strip = box.err ? '<div class="p11-err">' + e(box.err) + '</div>' : '';
      box.taken = !!box.err;
      return U.card(title, strip + empty(state, ui, user, visible));
    }

    var body = '';

    if (ui.msgGroup) {
      var codes = D.visibleCountries(user, state.countries);
      var by = {};
      rows.forEach(function (c) {
        var p = projectOf(c);
        if (!p) return;
        (by[p.country] = by[p.country] || []).push(c);
      });

      body = codes.filter(function (code) { return by[code]; }).map(function (code) {
        var un = visible.filter(function (c) {
          var p = projectOf(c);
          return p && p.country === code && D.isUnread(user, c);
        }).length;

        return '<div class="p11-ghd ' + ccOf(code) + '">' + flagMark(code) +
          '<b>' + e(countryName(state, code)) + '</b>' +
          '<span class="cnt num">' + e(plural(by[code].length, 'message')) + '</span>' +
          '<span class="rt num' + (un ? ' hot' : '') + '">' +
          (un ? plural(un, 'unread') : 'nothing unread') + '</span></div>' +
          sortRows(by[code], ui.msgSort).map(function (c) {
            return row(state, ui, user, mayWrite, c, box);
          }).join('');
      }).join('');

    } else {
      body = sortRows(rows, ui.msgSort).map(function (c) {
        return row(state, ui, user, mayWrite, c, box);
      }).join('');
    }

    var top = (box.err && !box.taken)
      ? '<div class="p11-err">' + e(box.err) + '</div>' : '';

    return U.card(title, top + '<div class="p11-list">' + body + '</div>');
  }

  function empty(state, ui, user, visible) {
    if (ui.msgSearch) {
      return '<div class="p11-empty"><b>No messages match “' + e(ui.msgSearch) + '”</b>' +
        '<span>Search looks at the message text, the author’s name and the project name, ' +
        'id or country. Clear the search, or switch to All to widen the set — ' +
        e(plural(visible.length, 'message')) + ' sit in your scope.</span>' +
        '<span class="p11-emptyacts"><button class="btn sm" data-act="p11-clear">' +
        'Clear the search</button></span></div>';
    }
    if (!visible.length) {
      return '<div class="p11-empty"><b>No messages in your scope</b>' +
        '<span>Comments and approval notes appear here as soon as they are posted on a ' +
        'project in one of your countries.</span></div>';
    }
    if (ui.msgFilter === 'unread') {
      return '<div class="p11-empty"><b>You’re all caught up</b>' +
        '<span>Nothing is unread in your scope. Switch to All to re-read the ' +
        e(plural(visible.length, 'message')) + ' on your projects.</span>' +
        '<span class="p11-emptyacts"><button class="chip" data-act="msgfilter" data-f="all">' +
        'Show all messages</button></span></div>';
    }
    return '<div class="p11-empty"><b>Nothing to show</b>' +
      '<span>No message matches the current controls.</span></div>';
  }

  /* ------------------------------------------------------------ one row -- */

  function row(state, ui, user, mayWrite, c, box) {
    var p = projectOf(c);
    if (!p) return '';
    var unread = D.isUnread(user, c);
    var open = ui.msgOpen === c.id;

    /* v1.0.3 — the row carries its project's country palette class: a 3px left
       rule in that country's flag accent, and the country chip in its pastel
       bold. A priority flag still adds its own brass rule beside it, so the two
       signals stack instead of one overwriting the other. */
    var cls = 'p11-row ' + ccOf(p.country) + (unread ? ' unread' : '') +
              (open ? ' open' : '') + (c.priority ? ' pri' : '');

    var main = '<button class="p11-main" data-act="p11-open" data-id="' + e(c.id) +
      '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
      kindTag(c) +
      '<span class="p11-tx">' +
        '<span class="p11-top">' +
          (c.priority ? '<span class="p11-flag" title="Priority">⚑</span>' : '') +
          '<b>' + e(p.name) + '</b>' +
          '<span class="p11-cc">' + flagMark(p.country) +
            e(countryName(state, p.country)) + '</span>' +
          '<span class="p11-pid num">' + e(p.id) + '</span>' +
          (unread ? '<span class="p11-dot" title="Unread"></span>' : '') +
        '</span>' +
        '<span class="p11-by num">' + e(CBP.userName(c.author) + ' · ' + stamp(c)) +
          (c.edited_at ? ' <span class="p11-ed">(edited)</span>' : '') + '</span>' +
        '<span class="p11-snip">' + e(snippet(c.body, SNIPPET)) + '</span>' +
      '</span>' +
      '<span class="p11-chev">' + (open ? '▴' : '▾') + '</span></button>';

    var acts = '<div class="p11-acts">';
    if (mayWrite) {
      acts += '<button class="btn sm" data-act="comment-read" data-id="' + e(c.id) +
        '" data-read="' + (unread ? 'true' : 'false') + '">' +
        (unread ? 'Mark read' : 'Mark unread') + '</button>';
      acts += '<button class="btn sm' + (c.priority ? ' on' : '') +
        '" data-act="comment-priority" data-id="' + e(c.id) +
        '" aria-pressed="' + (c.priority ? 'true' : 'false') + '">⚑ ' +
        (c.priority ? 'Flagged' : 'Flag') + '</button>';
      acts += '<button class="btn sm" data-act="pin-project" data-id="' + e(p.id) + '">' +
        ((state.pinnedProjects || []).indexOf(p.id) > -1 ? 'Unpin' : 'Pin') + '</button>';
    }
    acts += '<a class="btn sm" href="#/project/' + e(p.id) + '">Open</a></div>';

    return '<div class="' + cls + '">' + main + acts +
      (open ? panel(state, ui, user, mayWrite, c, p, box) : '') + '</div>';
  }

  /* ------------------------------------------- expanded thread + reply --- */

  function panel(state, ui, user, mayWrite, c, p, box) {
    var feed = D.commentsFor(p.id);
    var shown = feed.slice(Math.max(0, feed.length - FEED_EXCERPT));

    var items = shown.map(function (x) {
      var un = D.isUnread(user, x);
      var cls = (x.id === c.id ? ' on' : '') + (un ? ' unread' : '');
      return '<li' + (cls ? ' class="' + cls.slice(1) + '"' : '') + '>' +
        '<span class="p11-fh">' + kindTag(x) +
          '<b>' + e(CBP.userName(x.author)) + '</b>' +
          '<span class="num">' + e(stamp(x)) + '</span>' +
          (x.edited_at ? '<span class="p11-ed">(edited)</span>' : '') +
        '</span>' +
        '<span class="p11-fb">' + e(x.body) + '</span></li>';
    }).join('');

    var head = '<div class="p11-ph">Recent on this project' +
      '<span class="num">' + e(shown.length + ' of ' + plural(feed.length, 'message')) +
      '</span></div>';

    var composer = '';
    if (mayWrite) {
      var err = (box.err && !box.taken) ? box.err : null;
      if (err) box.taken = true;
      composer =
        '<div class="p11-composer">' +
          '<label class="fldlab" for="p11reply">Quick reply</label>' +
          '<textarea id="p11reply" class="p11-input" rows="3" data-act="p11-draft" ' +
            'data-id="' + e(p.id) + '" placeholder="Reply on ' + e(p.name) +
            '">' + e(ui.msgDraft) + '</textarea>' +
          (err ? '<div class="p11-err">' + e(err) + '</div>' : '') +
          '<div class="p11-cacts">' +
            '<button class="btn brass" data-act="p11-reply" data-id="' + e(p.id) +
              '">Post reply</button>' +
            '<span class="p11-hint">Posts as ' + e(user.name) + ' on ' +
              e(D.fmtDateY(CBP.CONFIG.TODAY)) + ' — the same feed the project page shows, ' +
              'and read for you the moment it lands.</span>' +
          '</div>' +
        '</div>';
    } else {
      composer = '<p class="p11-hint">This account is read-only: the thread is here to read, ' +
        'and replying, flagging and marking read belong to the other roles.</p>';
    }

    return '<div class="p11-panel">' + head +
      '<ul class="p11-feed">' + items + '</ul>' + composer +
      '<a class="p11-link" href="#/project/' + e(p.id) + '">Open ' + e(p.id) +
      ' — full record and activity</a></div>';
  }

  /* ==================================================== event wiring ======
     Registered once at load. CORE already wires msgfilter / msgsort / msggroup
     / comment-read / comment-readall / comment-priority / pin-project through
     actions.js; everything below is this page's own, under a p11- prefix, and
     ends in CBP.actions.* + CBP.render() exactly like every other page. */

  function on11() {
    return CBP.state && CBP.state.ui && CBP.state.ui.route === 'messages';
  }

  function closest(node, sel) {
    return (node && node.closest) ? node.closest(sel) : null;
  }

  /* render() replaces the markup an event came from, so a focused field has to
     be found again and its caret put back — the pattern app.js uses for the
     P3 search box */
  function refocus(id, caret) {
    var el = document.getElementById(id);
    if (!el) return;
    el.focus();
    if (caret === undefined || caret === null) caret = el.value.length;
    try { el.setSelectionRange(caret, caret); } catch (err) { /* older engines */ }
  }

  document.addEventListener('click', function (ev) {
    if (!on11()) return;
    var t = closest(ev.target, '[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act !== 'p11-open' && act !== 'p11-reply' && act !== 'p11-clear') return;

    var ui = CBP.state.ui;
    ev.preventDefault();
    ev.stopImmediatePropagation();

    if (act === 'p11-open') {
      var id = t.getAttribute('data-id');
      ui.msgOpen = (ui.msgOpen === id) ? null : id;
      ui.msgDraft = '';                /* a new thread starts on a clean sheet */
      ui.err = null;
      CBP.render();

    } else if (act === 'p11-clear') {
      ui.msgSearch = '';
      CBP.render();
      refocus('p11search');

    } else {
      /* the composer: CBP.actions owns the write, the viewer never gets here
         because the control is not rendered for a read-only account */
      var pid = t.getAttribute('data-id');
      var el = document.getElementById('p11reply');
      if (el) ui.msgDraft = el.value;
      var res = A.commentAdd(pid, ui.msgDraft, 'comment');
      if (res.ok) {
        /* the row stays open: the reply lands in the thread excerpt directly
           under the composer, which is the confirmation. It is not added to the
           Unread list because your own words are never unread to you. */
        ui.msgDraft = '';
        CBP.render();
      } else {
        CBP.render();
        refocus('p11reply');
      }
    }
  });

  /* the two alert preferences — a change, not a click, and the write goes
     through A.setAlertPref like every other mutation on this page */
  document.addEventListener('change', function (ev) {
    if (!on11()) return;
    var t = ev.target;
    if (!t || !t.getAttribute || t.getAttribute('data-act') !== 'p11-pref') return;
    var f = t.getAttribute('data-f');
    var user = CBP.state.user;
    if (!D.can(user, 'comment')) return;          /* the viewer's panel is read-only */
    /* A.setAlertPref renders itself (WP1) — a second render here would be one
       save too many */
    CBP.actions.setAlertPref(user.id, f, f === 'mute' ? t.checked : t.value);
  });

  /* typing: one state mutation, one render pass, caret restored */
  document.addEventListener('input', function (ev) {
    if (!on11()) return;
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    var act = t.getAttribute('data-act');
    if (act !== 'p11-search' && act !== 'p11-draft') return;

    var caret = null;
    try { caret = t.selectionStart; } catch (err) { caret = null; }

    if (act === 'p11-search') {
      CBP.state.ui.msgSearch = t.value;
      CBP.render();
      refocus('p11search', caret);
    } else {
      CBP.state.ui.msgDraft = t.value;
      CBP.state.ui.err = null;
      CBP.render();
      refocus('p11reply', caret);
    }
  });

})();
