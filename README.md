# Church Project-Budget Management Platform — Demo v1.0.2

A fully client-side demo of a budget approval and visibility platform for a church humanitarian
area office running **22 countries × $1,000,000/year** (6 countries seeded). Built from
**Blueprint v1.5 (confirmed 28 Aug 2026)** — decisions D-01…D-15, R-1…R-4 and the Regional
Director basics RD-1…RD-5 are all in scope.

## Run it

- **Local:** double-click `index.html`. No build step, no server, no network required
  (Google Fonts load when online; system fonts otherwise).
- **GitHub Pages:** serve this folder as the site root (Settings → Pages → deploy from branch).
  `.nojekyll` is included.

## The demo walk (under 12 minutes, no refresh)

Sign in from the front door, or use the persona switcher (top right) at any time.

1. **Anik (M3, Bangladesh)** — create and edit a status-4 project; progress reads *"not submitted"*, never 0%.
2. **Daniel (M2)** — open WE26BGD0005, **Request submitted** → status 3; stage clock restarts; the Approvals queue gains an item.
3. **Priya (M1)** — Approvals inbox: **Return to Review** (reason mandatory), **Request approved** on WE26BGD0005 → external gate opens.
4. **Still Priya** — tick the gate: Decision Point submitted → approved, CHaS submitted → approved; **Mark Approved** demands both reference numbers → status 2. Contrast WE26BGD0002's CHaS counter (197 days and counting).
5. **Dashboard** — deselect Bangladesh in the scope selector: over-ceiling flips to headroom. Open the country league table (RD-1) and the director exception digest (RD-2) under Alerts.
6. **Bp. Santoso (Viewer)** — same dashboards, Bangladesh + Nepal only, every action gone, Export (RD-3 print pre-read) still works.
7. **Mobile** — toggle "Mobile device" on the sign-in page: quick view with period chips, approval cards, update feed, "Full site" escape (remembered).

## Structure

```
index.html          shell + script wiring (load order matters)
css/                app.css (tokens + shared components) · page styles
js/config.js        TODAY constant + thresholds — the demo ages from here
js/data.js          GENERATED from ../fixtures/*.json — the only place numbers live
js/derive.js        pure derivations (coverage, clocks, league table, permissions)
js/store.js         state + dashboard seed (5 boards per blueprint RM-4)
js/actions.js       every mutation: submit / return / reject / gate / mark approved / activity
js/ui.js, widgets.js  shared components + 13-widget dashboard library
js/pages/           p1 sign-in · p2 dashboard · p3 register · p4 detail · p5 timeline ·
                    p6 approvals · p7 budget · p8 alerts · p9 admin · p10 mobile
```

## Ground rules honoured

Every number on screen is **derived** from the fixture data — nothing hard-coded. Day counters
derive from `CONFIG.TODAY` (2026-08-28). The status ladder keeps the client's original numbers:
**4 In Development → 3 Submitted → 2 Approved → 1 Implementation** (+ Declined). Formal approval
happens outside the platform (Decision Point + CHaS); the platform tracks it as a clocked,
M1-only gate with mandatory reference numbers at Mark Approved.

## Known demo simplifications (say these out loud to the client)

State is client-side; a page refresh resets the walkthrough. Emails render to the in-app outbox
(Alerts → Sent log). The CHaS pull is a fixture, not a live call. Sign-in accepts anything; SSO
is a stubbed button (SSO-ready UI per D-10). Dashboards live in shared demo state across personas.

## As-built rulings (deviations from the papers, decided in build)

- Gate day-counters always derive; the seeded "196 d" was a day-old snapshot — it derives to 197 at TODAY.
- Status-2 progress reads italic *"starts at kickoff"* (blueprint semantics outrank the sample's 0%).
- Country queue = statuses 4+3+2 (`D.queueCount`) — the only self-consistent reading; Lao PDR = 1.
- Approvals badge counts items actionable *by me* (hidden for M3 / viewer / admin).
- Mark-approved and 2→1 notices use `SYS-*` ids; catalogue ids A-01…A-14 fire only at their docs/05 triggers.

Provenance: built 28 Aug 2026 by the Adeptio working session (orchestrator/architect + two
builders + independent auditor) from the `cbp-demo` build kit; spec lineage lives in
`../docs/` and `../reference/` in the vault, which are not part of this deployable folder.

## v1.0.1 (29 Aug 2026) — change set

Built on v1.0 by the same working-team pattern (architect + core builder + five parallel page
builders + independent audit; full contract in `../ARCH_v1.0.1.md` + `../CORE_API_v1.0.1.md`).

- **Navigation** — Dashboard moved to the top of the sidebar; new **Messages & Alerts** menu
  (`#/messages`) with a live unread balloon; "+ New dashboard" removed from the Dashboard page
  and relocated to Administration → Dashboards & datasets (with the predefined widget catalog).
- **Projects** — multi-country selector chips; layered country bands (structural glass tint)
  with inset project cards; per-project comment pill; breadcrumb + "Back to projects" return
  flow after every record save; edit area covers all record fields.
- **Comments** — flat, editable ("(edited)"-stamped) per-project comments with name, date and
  time; unread strip on the project page; viewer reads but never writes.
- **Approvals** — requester↔approver notes thread per entry (✓/↩ voices); Decision Point and
  CHaS dates editable by M1/Admin with derivation-guarded validation; counters re-derive live.
- **Messages & Alerts hub** — unified comments + approval notes; Unread/All, search, sort,
  group-by-country, priority flags, per-row read toggles, pinned-projects rail, mark-all-read.
- **Dashboard** — per-board edit mode (drag/arrow reorder, 1×/2×/3× resize, remove, add from
  catalog, Save/Cancel on a draft); layouts persist per board.
- **Timeline** — phase balloons and target diamonds draggable (day-snapped, live date tooltip)
  with click + nudge fallback; every move logs to the activity stream.
- **Budget** — all utilisation bars share one scale so every 100% mark aligns on a single rule
  (over-ceiling crosses it, hatched); new **Reports** (custom report builder + print) and
  **Forecasting** (2024/2025 history vs 2026, editable 2027 plan) sub-menus; **Sync dashboards**
  adds the "Budget years 2024–2027" widget to the Budget Utilisation board.
- **Data** — new fixtures `comments_seed.json` and `budget_history.json` (2024/2025 are
  synthesized demo history; 2027 plan editable in-session), regenerated into `js/data.js`.

### v1.0.1 as-built rulings

- Viewer's unread balloon is a count only — read/flag/pin/composer controls are not rendered
  and the API refuses them.
- Approval-note composer = approver + requester side (M1/M2/Admin); M3 is routed to the
  project's own comments instead.
- Approvals entries collapse after completed approval actions; gate edits and notes keep the
  entry open so the re-deriving counters stay visible.
- Dashboard spans are proportional within their row (1+1 renders 50/50), reproducing the v1.0
  layouts exactly from the seeded `layout` maps.
- A phases-only or timeline-gesture save never arms the "Back to projects" bar; record saves do.
- Report-builder defaults are a session preference and stay available to the viewer (no data
  write), consistent with "export still works".

## v1.0.2 (29 Aug 2026) — minor edit

- **TimeBlock** — the Timeline page is remarked as the TimeBlock add-on module: sidebar entry
  "TimeBlock" with an "Add-on" chip, page header badge, and every full-editor remark now reads
  "Open full editor in TimeBlock" (P3, P4, P5, deep-link notice, admin integrations row).
- **Forecasting simulation** — new "2027 projected" column and a faded fourth comparison bar:
  a least-squares extension of the 2024–2026 utilisation trend (`D.trend2027`), derived on
  every render, marked with "≈" and italics so simulation never reads as record data.
- **Brand** — sidebar mark is now "Church Budget&Project MS" with a gold chapel glyph carrying
  a slow lux shimmer and three twinkling glints (pure CSS, honours `prefers-reduced-motion`;
  the mobile quick-view mark follows).
