# Church Project-Budget Management Platform — Demo v1.0.4

A fully client-side demo of a budget approval and visibility platform for a church humanitarian
area office running **22 countries × $1,000,000/year** (7 countries seeded). Built from
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

## v1.0.3 (29 Aug 2026) — minor edit

- **Country identity system** — every seeded country carries its flag (emoji) and a pastel
  palette drawn from its international flag colors (bold pastel headers, light pastel row
  areas, saturated accent rules; AA-contrast tuned, C-21 tokens in app.css). Applied to the
  Projects country selector chips, the country group bands, and mirrored across the Messages
  & Alerts hub (rows, chips, group headers, pinned cards) so both pages read as one system.
- **TimeBlock** — the "Add-on" chip is now **Required Licenses** (nav, page badge, admin
  integrations row). Phase bars are resizable by dragging either end (day-snapped, start<end
  guarded); the date remarks tied to the bar update live during the drag, and the selection
  tray gains Start/End ±1 day nudges. Commits keep the single projectUpdate path + log line.
- **Alerts** — column widths rechecked in all four sections; rule ids no longer wrap.
- **Forecasting** — per-country, per-year numbers are configurable (history years editable;
  2026 stays derived from live records); the comparison graph and the trend projection
  re-derive from configured numbers; years can be added backward (back-cast seeds) and
  forward (new plan years, trend seeds), added years removable (×).

### v1.0.3 as-built rulings

- Pastel country tints are an explicit client request and override the "no tinted cards"
  rule for country bands/rows only; text on pastel steps up to slate/ink for AA contrast,
  and the IND/MMR accent rules are darkened from literal flag yellows to clear 3:1.
- Flags are emoji (macOS demo); unknown countries fall back to a neutral palette, no glyph.
- LAO pairs a red pastel with the flag's blue accent rule to stay distinct from NPL crimson.
- A.histSet stays country-scope-checked; year add/remove is area-level (plan permission).
- The projection column keeps targeting the first year after the live budget year (2027).

## v1.0.4 (29 Aug 2026) — dashboard enhancement

- **Hong Kong (HKG)** — the 7th seeded country, with data across the whole platform: 4
  projects (WE26HKG0001 status 1 with phases, WE26HKG0002 status 3 submitted 20 Aug,
  WE26HKG0003 status 4, WE26HKG0004 status 2; committed $975,000 = 97.5% of the $1,000,000
  ceiling), 2024/2025 history (58%/66%) plus an editable 2027 plan of $900,000, 3 seeded
  comments (C15–C17), 2 activity entries, and the 🇭🇰 flag wherever flags render (P3, P11).
  It carries its own **bauhinia-purple** `cc-hkg` palette rather than a literal red/white
  reading of the flag — see the ruling below.
- **Dashboard — Overview reworked** — a new **Budget track — country detail** widget leads
  the board: per-country rows show the year's ceiling, the committed spend split
  Implementation / Approved / Submitted / In development under one "Actual spend" group
  header, and a mini budget bar for every country aligned to a single shared scale.
  Expanding a row lists that country's projects grouped by status rung, with counts and
  totals matching the header columns, each project linking to its page; open records show
  "in queue N d" from the queue clock, status-1 records show "implementing since" their
  start date.
- **Dashboard — new Unread messages & alerts widget** replaces the segmented budget bar on
  Overview (the bar and the compact country coverage widgets stay in the predefined
  catalogue, one click away in Edit layout). Per-country rows show the signed-in persona's
  unread count and that country's open alert count; expanding a row shows an "N unread
  messages" header, up to 3 of the briefest unread items linking to their projects, that
  country's alert lines, and a link through to Messages & Alerts.
- **Dashboard — Needs attention reworked** into two labelled sections: **Approval
  required** (status-3 records waiting longer than the configured wait since submission,
  longest first, red day counts) and **Project timeline alert** (implementation phases
  ending inside the configured window, soonest first, brass at 30 days or closer, red at 7
  days or closer). Both thresholds live in `config.js` (Admin-configurable in the real
  product); the RD-2 director exception digest is untouched.
- **Live examples** — with `CONFIG.TODAY` at 2026-08-28, WE26HKG0002 shows 8 days waiting
  in Approval required (submitted 20 Aug); WE26HKG0001's "Distribution rounds" phase ends
  15 Sep, 18 days out, in Project timeline alert. WE26BGD0002 is a standing reminder that
  the platform runs two independent clocks off two different start dates: its approval
  wait derives from `submitted_at` (210 days), while its CHaS gate clock derives from the
  gate's own `submitted_at` (197 days) — both correct, neither the other.

### v1.0.4 as-built rulings

- Hong Kong's flag is red and white; its bauhinia flower is purple. The country's palette
  is built from the bauhinia, not the flag ground, because a red `cc-hkg` would sit next
  to NPL's crimson and LAO's red with nothing to tell them apart at a glance.
- Hong Kong ships with area-office scope only: **daniel** (M2, area-wide) and **admin**
  see it; **priya**, **anik** and the viewer persona do not, and no seeded M1 covers it
  (Priya's scope is South Asia, Marco's is Mekong). Accepted for the demo — approvals for
  Hong Kong sit with the area office until an M1 region is assigned.
- `budgettrack` and `msgalert` both carry a full, scrollable per-country list rather than a
  single figure, so the Overview seed gives each the full board width; `budget` and
  `coverage` are unchanged widgets that simply leave this one board's default seed.
- `W.exceptionSet` and the RD-2 director digest read from it unchanged; the two attention
  sections on Overview are a new read of the same derived exception set, not a new one.
