/* pages/p16.js — v1.2.0 · P16 Reviewer home, route #/reviews.

   OGC and Finance review Corporate Agreements, and what they are asked for is
   an opinion on two things at once: the money, and whether the record supports
   it. So the row is split — money on the left (the amount and the country
   ceiling it sits inside), the record on the right (the version list, the four
   attestations as a ✓/◻ checklist, and the screening + due-diligence line).

   This platform has no file store and this page never pretends otherwise: the
   word used across it is "version", never the one F17 forbids.

   Approve / Return reuse p12.js's own acts (p12-review-approve /
   p12-review-return) with the same data attributes, so the decision runs
   through A.reviewDecide and lands in the agreement's history exactly as it
   does on CT2. p12's listener is keyed on the act prefix only — it is not route
   guarded — so the buttons work from here unchanged. The one page-owned act is
   the composer toggle, because p12 reads the comment from a single element id
   (#p12rc_<division>) and only one of those may exist in the page at a time. */
(function () {
  'use strict';
  var D = CBP.D, U = CBP.ui, W = CBP.W, e = CBP.ui.esc;

  CBP.pages = CBP.pages || {};

  function divisionsOf(state, c) {
    var role = state.user.role;
    var mine = (CBP.CONFIG.REVIEW_DIVISIONS || []).filter(function (d) {
      return d.role === role;
    }).map(function (d) { return d.key; });
    var pend = (c && c.reviews ? c.reviews : []).filter(function (r) {
      return r.status === 'pending';
    });
    /* the admin sees every pending review; a reviewer sees only their own */
    return pend.filter(function (r) {
      return role === 'admin' || mine.indexOf(r.division) > -1;
    });
  }

  function divisionLabel(key) {
    var d = (CBP.CONFIG.REVIEW_DIVISIONS || []).filter(function (x) { return x.key === key; })[0];
    return d ? d.label : key;
  }

  function moneyPane(item) {
    var cb = item.ceilingBar || {};
    var bar = (W && W.budgetBar && cb.ceiling)
      ? W.budgetBar(cb.byStatus || {}, cb.ceiling, { scale: cb.scale }) : '';
    var p = item.project;
    return '<div class="p16-money">' +
      '<div class="p16-amt num">' + e(D.money(item.amount)) + '</div>' +
      '<div class="p16-amt-lab">value of this agreement</div>' +
      (bar ? '<div class="p16-bar">' + bar + '</div>' : '') +
      (cb.ceiling
        ? '<div class="p16-fig num">' + e(D.money(cb.committed)) + ' committed of ' +
          e(D.money(cb.ceiling)) + ' ceiling' +
          (p ? ' · ' + e(p.country) : '') + '</div>'
        : '') +
      '<ul class="p16-facts">' +
        '<li><span>Waiting</span><b class="num ' + e(item.tone || '') + '">' +
          e(D.days(item.waiting_days)) + '</b></li>' +
        (item.due_at ? '<li><span>Due</span><b>' + e(D.fmtDateY(item.due_at)) + '</b></li>' : '') +
        (item.contract && item.contract.partner
          ? '<li><span>Partner</span><b>' + e(item.contract.partner) + '</b></li>' : '') +
        (p ? '<li><span>Project</span><b><a href="#/project/' + e(p.id) + '">' +
          e(p.id) + '</a></b></li>' : '') +
      '</ul></div>';
  }

  function recordPane(item) {
    var versions = item.versions || [];
    var vlist = versions.length
      ? '<ol class="p16-vers">' + versions.slice().reverse().map(function (v) {
          return '<li><span class="pv-no num">v' + e(String(v.no)) + '</span>' +
            '<span class="pv-sum">' + e(v.summary || 'Version recorded') + '</span>' +
            '<span class="pv-at num">' + e(v.at ? D.fmtDateY(v.at) : '') + '</span>' +
            (v.author ? '<span class="pv-by">' + e(v.author) + '</span>' : '') + '</li>';
        }).join('') + '</ol>'
      : '<p class="home-quiet">No version has been recorded on this agreement yet.</p>';

    var att = '<ul class="p16-att">' + (item.attestations || []).map(function (a) {
      return '<li class="' + (a.ok ? 'ok' : 'no') + '">' +
        '<span class="att-mk" aria-hidden="true">' + (a.ok ? '✓' : '◻') + '</span>' +
        e(a.label) + '</li>';
    }).join('') + '</ul>';

    var scr = item.screening || { text: '', ok: false };

    return '<div class="p16-record">' +
      '<h4>Versions</h4>' + vlist +
      '<h4>Attestations</h4>' + att +
      '<h4>Screening and due diligence</h4>' +
      '<p class="p16-scr' + (scr.ok ? ' ok' : ' no') + '">' + e(scr.text) + '</p>' +
      '</div>';
  }

  function decisions(state, item) {
    var c = item.contract;
    if (!c) return '';
    var pend = divisionsOf(state, c);
    if (!pend.length) {
      return '<div class="p16-acts"><a class="btn sm" href="#/contracts/' + e(c.id) +
        '">Open agreement</a></div>';
    }
    var open = state.ui.p16Reason;
    return pend.map(function (r) {
      var showing = open && open.id === c.id && open.division === r.division;
      var head = pend.length > 1
        ? '<span class="p16-div">' + e(divisionLabel(r.division)) + ' review</span>' : '';
      var box = showing
        ? '<div class="p6-inline" data-for="' + e(c.id) + '">' +
            '<label class="vh" for="p12rc_' + e(r.division) + '">Why is this going back?</label>' +
            '<textarea class="p4-input p6-reason" id="p12rc_' + e(r.division) + '" rows="2" ' +
            'placeholder="Why is this going back? The drafter must be able to act on it."></textarea>' +
            '<div class="p6-iacts">' +
              '<button class="btn brass sm" data-act="p12-review-return" data-id="' + e(c.id) +
                '" data-d="' + e(r.division) + '">Confirm return</button>' +
              '<button class="btn sm" data-act="p16-cancel">Cancel</button>' +
            '</div></div>'
        : '';
      return '<div class="p16-acts">' + head +
        '<button class="btn brass sm" data-act="p12-review-approve" data-id="' + e(c.id) +
          '" data-d="' + e(r.division) + '">Approve</button>' +
        (showing ? '' : '<button class="btn sm" data-act="p16-return" data-id="' + e(c.id) +
          '" data-d="' + e(r.division) + '">Return with comment</button>') +
        '<a class="btn sm" href="#/contracts/' + e(c.id) + '">Open agreement</a>' +
        box + '</div>';
    }).join('');
  }

  function queueRow(state, item) {
    var c = item.contract;
    var focused = state.ui.focusId &&
      (state.ui.focusId === item.id || (item.project && state.ui.focusId === item.project.id));
    var title = c ? (c.partner || c.id) : item.id;

    return '<article class="home-card p16-row' + (item.overdue || item.tone === 'hot' ? ' hot' : '') +
      (focused ? ' is-focused' : '') + '" data-id="' + e(item.id) + '">' +
      '<header class="home-card-hd">' +
        '<div class="hc-title">' +
          '<a class="hc-id num" href="#/contracts/' + e(item.id) + '">' + e(item.id) + '</a>' +
          '<b>' + U.flagMark(item.project ? item.project.country : null) + e(title) + '</b>' +
        '</div>' +
        '<div class="hc-meta">' + e(item.waiting_at || 'In review') +
          (item.project ? ' · ' + e(item.project.name) : '') + '</div>' +
      '</header>' +
      '<div class="home-card-bd p16-split">' +
        moneyPane(item) + recordPane(item) +
      '</div>' +
      decisions(state, item) +
      '</article>';
  }

  function printHeader(state, items) {
    var total = items.reduce(function (a, i) { return a + (i.amount || 0); }, 0);
    return '<h2>My reviews — ' + e(state.user.name) + '</h2>' +
      '<p>Prepared ' + e(D.fmtDateY(CBP.CONFIG.TODAY)) + ' · ' + items.length +
      ' agreement' + (items.length === 1 ? '' : 's') + ' awaiting a decision · ' +
      e(D.money(total)) + ' in total value</p>' +
      '<ol>' + items.map(function (i) {
        return '<li>' + e(i.id) + ' — ' + e((i.contract && i.contract.partner) || '') +
          ' · ' + e(D.money(i.amount)) + ' · waiting ' + e(D.days(i.waiting_days)) + '</li>';
      }).join('') + '</ol>';
  }

  CBP.pages.reviews = function (state) {
    if (!U.requireRole(state, ['ogc', 'finance', 'admin'])) return '';

    var items = D.reviewerQueue(state.user);

    var html = '<div class="crumb">Home · My reviews</div>' +
      '<div class="pagehead"><h1>My reviews</h1>' +
      '<span class="sub">' + items.length + ' agreement' + (items.length === 1 ? '' : 's') +
      ' waiting on you' + (items.length ? ' · oldest first' : '') + '</span>' +
      (D.can(state.user, 'export')
        ? '<div class="sp"><button class="btn" data-act="p16-export">Export</button></div>' : '') +
      '</div>';

    html += U.printPack(printHeader(state, items));

    if (!items.length) {
      return html + U.card('Nothing is waiting on your review',
        '<p>An agreement reaches this page when its drafter submits it and the ' +
        '<b>' + e(CBP.CONFIG.ROLE_LABEL[state.user.role] || state.user.role) + '</b> review ' +
        'is still pending. Nothing is in that state right now.</p>' +
        '<p>Every agreement, at any status, is in the ' +
        '<a href="#/contracts">register</a>.</p>', { cls: 'home-empty' });
    }

    html += '<div class="home-wrap p16-list">' + items.map(function (it) {
      return queueRow(state, it);
    }).join('') + '</div>';
    if (state.ui.focusId && CBP.home) CBP.home.scrollToFocus();

    html += '<p class="pagenote">Approving records your division’s decision against this ' +
      'version; returning supersedes the other pending review and sends the agreement back to ' +
      'the drafter with your comment attached. Both are written to the agreement’s history and ' +
      'are visible to everyone who can open it. Day counts are derived against ' +
      e(D.fmtDateY(CBP.CONFIG.TODAY)) + '.</p>';

    return html;
  };

  /* ------------------------------------------------------------- events --
     Only the composer toggle and the print pack are ours; the two decisions
     themselves belong to p12.js and are emitted with its act names. */

  if (!CBP.p16) {
    CBP.p16 = { wired: true };

    /* a decision closes the composer. Capture phase runs before p12's bubble
       listener, so the flag is already down by the time p12 renders. */
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!t) return;
      var a = t.getAttribute('data-act');
      if (a === 'p12-review-approve' || a === 'p12-review-return') {
        if (CBP.state && CBP.state.ui) CBP.state.ui.p16Reason = null;
      }
    }, true);

    document.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act !== 'p16-return' && act !== 'p16-cancel' && act !== 'p16-export') return;
      var s = CBP.state;
      ev.preventDefault();

      if (act === 'p16-export') {
        document.body.classList.add('p2-printing');
        var clear = function () { document.body.classList.remove('p2-printing'); };
        try { window.addEventListener('afterprint', clear, { once: true }); } catch (err) {}
        try { window.print(); } catch (err) {}
        window.setTimeout(clear, 1200);
        return;
      }

      s.ui.p16Reason = (act === 'p16-return')
        ? { id: t.getAttribute('data-id'), division: t.getAttribute('data-d') }
        : null;
      CBP.render();
    });
  }

})();
