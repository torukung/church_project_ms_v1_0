# Church Project-Budget Management Platform - Demo v1.2.0

A fully client-side demo of a budget approval and visibility platform for a church humanitarian
area office running **22 countries × $1,000,000/year** (7 countries seeded). Built from
**Blueprint v1.5 (confirmed 28 Aug 2026)** - decisions D-01…D-15, R-1…R-4 and the Regional
Director basics RD-1…RD-5 are all in scope. v1.1.0 added the External Gate Connector (EGC) and
the Corporate Agreement (Contracts) gate; v1.2.0 adds browser persistence with backup/restore, a
single four-rung stepper, a one-list "Needs you" queue, two-bucket alerts, nine role-scoped home
pages and a mobile approve reduction — see below.

## What is new in v1.2.0

Seven features, one release, on top of v1.1.0:

- **Persistence + backup** — every mutation is saved to IndexedDB (localStorage fallback, then
  in-memory with a banner if neither is available); reloading the tab restores your work exactly.
  Administration › Data offers Backup now (a checksum-stamped, downloadable file), a scheduled
  backup written automatically whenever the clock advances (keeps the last 7), Restore from file
  (tamper-detected — a modified file is refused with a checksum message), Reset to fixtures, CSV
  export (projects, contracts, gate events, activity, outbox) and a `schema_version` with
  migrations, so a schema-2 (v1.1.0-shaped) snapshot loads and upgrades automatically.
- **Production database design pack** — `docs/db/` holds an ERD, a PostgreSQL 16 DDL (35 tables
  including 4 reference tables, row-level security by country scope, an append-only audit log),
  a backup/retention runbook and a data dictionary generated from the fixtures. Documents only;
  the demo's own snapshot format is the same logical model, mapped table by table in the ERD.
- **Four-rung stepper** — every project shows exactly four rungs, In development → Submitted →
  Approved → Implementation, from one shared helper, on the register, the project page, the
  Needs-you list, mobile and e-mail text. A declined project shows all four rungs with the one
  it died at struck through and a Declined tag, instead of the old two-pill shortcut.
- **"Needs you"** — Approvals becomes one ordered list (oldest wait first) with filter chips in
  place of the old six sections; each row carries a budget bar and a "who acted before me" chain
  line. Return/Reject/Dismiss take their reason inline, on the row — no modal. Personas with
  nothing to approve still see their read-only "Watching" rows rather than an empty page.
- **Role home pages** — signing in lands every persona on a home built for their role: Worker
  "My projects" (own records + a task checklist), Country Head "Needs you" plus a country
  roll-up, Regional Head "Portfolio" (countries as an ordered bar list, drilling to country then
  project in two clicks), Reviewer "My reviews" (money on the left, versions/attestations/
  screening on the right — there is no document store, so nothing here says "documents"), Viewer
  a curated read-only summary with one Export. Administration keeps the dashboard and gets a
  visibly tinted shell.
- **Two-bucket alerts** — every alert rule is classed immediate or digest; digest rules batch
  into one daily A-14 mail per recipient, folded by Administration › Data's "Advance day" or the
  Alerts page's "Run daily digest" button — never during a page render. Immediate mails carry
  Approve/Return/Confirm action buttons that deep-link straight to the row, pre-focused. Users
  set their own digest hour and a mute toggle on Approvals' "My alerts" panel.
- **Mobile approve** — the phone quick-view's rows now carry the same Needs-you actions and the
  same inline reason pattern as the desktop list, one tap to a dossier; signing an agreement
  stays a desktop-preferred flow.

## Run it

- **Local:** double-click `index.html`. No build step, no server, no network required
  (Google Fonts load when online; system fonts otherwise).
- **GitHub Pages:** serve this folder as the site root (Settings → Pages → deploy from branch).
  `.nojekyll` is included.

## The demo walk (under 12 minutes, no refresh)

Sign in from the front door, or use the persona switcher (top right) at any time. Since v1.2.0
every persona lands on a role home (`#/home`) rather than a shared board — Worker for Anik,
Portfolio for a Regional Head, and so on; the sidebar's old "Approvals" label now reads "Needs
you". From the home page, open Projects (P3) or a project directly to follow the walk below.

1. **Anik (M3, Bangladesh)** — create and edit a status-4 project; progress reads *"not submitted"*, never 0%.
2. **Daniel (M2)** — open WE26BGD0005, **Request submitted** → status 3; stage clock restarts; the Needs-you queue gains an item.
3. **Priya (M1)** — Needs you: **Return to Review** (reason now inline, no modal), **Request approved** on WE26BGD0005 → external gate opens.
4. **Still Priya** — tick the gate: Decision Point submitted → approved, CHaS submitted → approved; **Mark Approved** demands both reference numbers → status 2. Contrast WE26BGD0002's CHaS counter (197 days and counting).
5. **Dashboard** — deselect Bangladesh in the scope selector: over-ceiling flips to headroom. Open the country league table (RD-1) and the director exception digest (RD-2) under Alerts.
6. **Bp. Santoso (Viewer)** — same dashboards, Bangladesh + Nepal only, every action gone, Export (RD-3 print pre-read) still works.
7. **Mobile** — toggle "Mobile device" on the sign-in page: quick view with period chips, approval cards, update feed, "Full site" escape (remembered).

## v1.1.0 demo walks

Two more walks on top of the seven steps above, exercising the External
Gate Connector and the Contracts gate. `tools/walk_egc.js` and
`tools/walk_contracts.js` automate both end to end - see "Run the tools"
below.

### EGC - admin flips a system, Priya confirms, the ladder shows why it's blocked

1. **Admin** - Administration › Integrations: put CHaS into **Assisted**
   mode.
2. **Still Admin** - pick project WE26NPL0010 in the simulator, step
   "approved", a reference and a date, **Simulate inbound event**. The
   panel reports back that a proposal was raised - nothing has written the
   gate yet.
3. **Priya (M1)** - Approvals: the new **Sync proposals** section lists
   it. **Confirm.** The gate pill on the project now reads "CHaS ·
   approved · via sim" with a deep link into CHaS.
4. **Priya, on WE26BGD0002** - a manual click of the CHaS gate, then
   **Mark Approved** with both references - the header gains the
   Corporate Agreement chip, in Draft.
5. **Admin, on WE26HKG0004** (status 2, no agreement yet, and the country
   the area office runs directly per the v1.0.4 ruling) - **Start
   implementation** is visibly disabled, its title reading "Corporate
   Agreement must be sent out first."

### Contracts - the full lifecycle, two reviewers, a signing ceremony

1. **Daniel (M2)** - Corporate Agreements: the register, the country
   chips, a new draft opened from the CT6 wizard on a status-2 project
   with no agreement.
2. **Daniel** - completes the draft-exit checklist (four attestations,
   due diligence verified, screening clear, partner, amount) and submits
   for review.
3. **Elena (OGC)** approves her review; **Rafael (Finance)** returns his
   with a comment - the agreement drops back to draft.
4. **Daniel** resubmits; **Elena** and **Rafael** both approve this
   round - the agreement clears for signature.
5. **Priya/Admin** starts the signing ceremony; **Daniel**, an eligible
   church signatory, opens CT3: scrolls the document to its end, ticks
   intent, types his name - only then does Sign enable.
6. The partner signature is recorded (wet ink) by the Area or Regional
   Manager - the agreement executes.
7. **Daniel** marks it Sent out, with a channel and reference - the
   contract gate is now met, and Start implementation on that project
   unblocks.

## v1.2.0 demo walks

Full presenter script: `docs/DEMO_SCRIPT_v1.2.0.md`. In brief, on top of
the walks above: edit a project as any persona, reload the tab — the edit
is still there; Administration › Data → **Backup now**, tamper the
downloaded file's bytes, **Restore from file** → refused with a checksum
message; **Advance day +1** as admin → one folded digest mail per
recipient with queued items plus one scheduled backup row; **Reset to
fixtures** → back to the fixture day with a two-step confirm. `tools/
test_persist.js` and `tools/walk_flow.js`/`tools/walk_roles.js` automate
persistence, the Needs-you list and all nine role homes end to end — see
"Run the tools" below.

## Personas

| Persona | id | Role | Scope | Notes |
|---|---|---|---|---|
| Area Office Admin | `admin` | admin | all | configures Integrations, Process, templates, signing authority |
| Priya N. | `priya` | m1 | BGD, NPL, IND | Regional Manager · South Asia |
| Marco T. | `marco` | m1 | KHM, MMR, LAO | Regional Manager · Mekong |
| Daniel K. | `daniel` | m2 | all | Area Manager; runs HKG's approvals and contracts (no M1 covers HKG) |
| Anik R. | `anik` | m3 | BGD | |
| Sunita M. | `sunita` | m3 | NPL | |
| Bp. Santoso | `santoso` | viewer | BGD, NPL | read-only; export still works |
| **Elena V.** | `elena` | **ogc** | all | **new in v1.1.0** - Office of General Counsel, Asia Area; contract reviewer only |
| **Rafael T.** | `rafael` | **finance** | all | **new in v1.1.0** - Area Finance Reviewer; contract reviewer only |

## Run the tools

From this repo's root (`. tools/env.sh` first sets up the browser path):

```
. tools/env.sh
node tools/gen-data.js          # regenerate js/data.js from fixtures/*.json
node tools/gen-data.js --check  # verify js/data.js is byte-identical to a fresh regen
node tools/smoke.js             # boot every persona through every route, file://, headless
node tools/test_egc.js          # unit-level checks on the EGC state machine
node tools/test_contracts.js    # unit-level checks on the Contracts state machine
node tools/walk_egc.js          # WP2 UI walk: admin flips CHaS, Priya confirms, the blocked ladder
node tools/walk_contracts.js    # WP4 UI walk: the full contract lifecycle through the real UI
node tools/test_persist.js      # v1.2.0: persistence engine, real headless Chromium (playwright)
node tools/test_flow.js         # v1.2.0: D.needsYou / D.rungOf / U.stepper / U.needsRow
node tools/walk_flow.js         # v1.2.0 UI walk: Needs-you list, inline return, P8 buckets/digest
node tools/walk_roles.js        # v1.2.0 UI walk: all nine role homes, the Data tab, Advance day
node tools/gen-dictionary.js    # regenerates docs/db/DATA_DICTIONARY.md from fixtures/*.json
```

`gen-data.js` is the only thing allowed to write `js/data.js` - never
hand-edit it; edit the matching file under `fixtures/` and regenerate.
Both walk scripts drive real Chromium against `app/index.html` over
file://, fail on any console error, and drop screenshots at 1440px and
390px into `tools/shots_wp2/` and `tools/shots_wp4/`.

## Apply on a fresh clone

This folder (`app/`, alongside `fixtures/`, `tools/` and `docs/` at the
repo root) is the **complete, self-contained application** - not a patch
or a change-pack layered onto some other checkout. There is no "base" to
apply this on top of and no pack stacking: clone the repo, open
`app/index.html`, and every v1.0 through v1.1.0 change is already there,
generated from the fixtures already in `fixtures/`.

## Structure

```
index.html          shell + script wiring (load order matters)
css/                app.css (tokens + shared components) · page styles ·
                    home.css / p9data.css (v1.2.0)
js/config.js        TODAY constant + thresholds - the demo ages from here
js/data.js          GENERATED from ../fixtures/*.json - the only place numbers live
js/derive.js        pure derivations (coverage, clocks, league table, permissions,
                    v1.2.0: D.needsYou, D.rungOf, D.portfolio, D.countryHome, …)
js/store.js         state + dashboard seed (5 boards per blueprint RM-4)
js/actions.js       every mutation: submit / return / reject / gate / mark approved / activity /
                    advanceDay / runDigest / setAlertPref (v1.2.0)
js/persist.js       v1.2.0 - the whole persistence engine: boot/save/restore/reset, backups,
                    CSV export, IndexedDB → localStorage → memory fallback ladder
js/ui.js, widgets.js  shared components + 13-widget dashboard library +
                    v1.2.0 U.stepper/U.needsRow/U.taskList/U.chain/U.countryBarRow
js/egc.js           v1.1.0 - External Gate Connector: sync modes, proposals, outbound queue
js/contracts.js     v1.1.0 - Corporate Agreement lifecycle: reviews, signing, amendments
js/pages/           p1 sign-in · p2 dashboard · p3 register · p4 detail · p5 timeline ·
                    p6 needs you · p7 budget · p8 alerts · p9 admin · p10 mobile ·
                    p11 messages & alerts · p12 Corporate Agreements (v1.1.0) ·
                    p13 worker home · p14 country home · p15 portfolio · p16 reviewer home ·
                    p17 viewer home (v1.2.0 role homes)
```

## Ground rules honoured

Every number on screen is **derived** from the fixture data - nothing hard-coded. Day counters
derive from `CONFIG.TODAY` (2026-08-28). The status ladder keeps the client's original numbers:
**4 In Development → 3 Submitted → 2 Approved → 1 Implementation** (+ Declined). Formal approval
happens outside the platform (Decision Point + CHaS); the platform tracks it as a clocked,
M1-only gate with mandatory reference numbers at Mark Approved.

## Known demo simplifications (say these out loud to the client)

State is client-side, saved to the browser's own IndexedDB (v1.2.0) — a reload keeps your work,
but the record lives only on this machine, in this browser profile; nothing is synced to a
server and clearing site data loses it. Emails render to the in-app outbox (Alerts → Sent log)
and to a simulated daily digest; there is no real mail transport. The CHaS pull is a fixture,
not a live call. Sign-in accepts anything; SSO is a stubbed button (SSO-ready UI per D-10).
Dashboards live in shared demo state across personas. The eight catalogue-only alert rules
(A-06, A-08 through A-11, A-13, A-20) are listed with a bucket for completeness but never
actually raised anywhere in this build. There is no document store: Contracts and the Reviewer
home show version history, attestation checkboxes and a screening line — never a file.

## As-built rulings (deviations from the papers, decided in build)

- v1.2.0: byte-identity of the RD-2 digest and the P2 attention headline holds only at
  `advanced_days === 0` with a wiped store (`?nopersist` on the URL query, never the hash) -
  advancing the clock legitimately changes wording after that point.
- v1.2.0: the folded daily digest reuses the catalogue's own **A-14** id rather than a new
  literal id, retimed to daily.
- v1.2.0: `D.phaseDeadlines`'s overdue (negative-day) branch is opt-in (`{overdue:true}`) rather
  than always on - two day-0 fixtures already have an ended phase, and an unconditional branch
  would have changed the P2 attention text and broken the byte-identity gate.
- v1.2.0: Worker home (P13) is strictly own-records-only for every role that can reach it,
  including admin and a Regional/Area Manager opening `#/worker` directly by URL - admin and
  Daniel see an empty state pointing at the Projects register rather than every project.
- v1.2.0: P15's fourth portfolio sort option is `exceptions` (count of open exceptions per
  country), not `headroom`, to match the brief's chip set; `headroom` and `queue` stay reachable
  through the underlying derive helper but are not offered as a chip.
- v1.2.0: P1's persona-routing footer sentence still describes the pre-v1.2.0 destinations
  (Regional Manager → Approvals, etc.) - routing itself now sends every persona to a role home;
  the sentence was not updated in this release (`app/js/pages/p1.js`).
- Gate day-counters always derive; the seeded "196 d" was a day-old snapshot - it derives to 197 at TODAY.
- Status-2 progress reads italic *"starts at kickoff"* (blueprint semantics outrank the sample's 0%).
- Country queue = statuses 4+3+2 (`D.queueCount`) - the only self-consistent reading; Lao PDR = 1.
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

## v1.1.0 (2 Sep 2026) - External Gate Connector + Contracts

Built by the same working-team pattern (architect + four parallel builders + independent
audit; full contract in `../docs/ARCH_v1.1.0.md` + `../docs/CORE_API_v1.1.0.md`).

- **External Gate Connector (EGC)** - Admin › Integrations configures CHaS and Decision
  Point (driver, sync mode, health, field mapping, an inbound-event simulator, a
  pasted-export importer). Three sync modes per system - Manual, Assisted (inbound events
  become proposals for a Regional Manager to confirm), Auto (trusted inbound events write
  the gate directly). One append-only event log records every gate write, manual or
  inbound; an outbound sync queue never blocks the approval ladder on a failure, showing a
  red chip and a deep link instead. Every surface that shows a gate step - the Projects
  stepper, the project gate tracker, Approvals, Alerts, the RD-2 digest, mobile quick view,
  the sidebar badge - now reads it through one shared helper.
- **Contracts** - a new Corporate Agreements section (`#/contracts`) holding the full
  Corporate Agreement lifecycle: draft, parallel OGC/Finance review, approved for
  signature, a signing ceremony with a scroll-and-intent gate, executed, sent out, active,
  with amendments as child agreements. Wired as the last gate of project approval: a
  project at or above the Corporate Agreement threshold cannot start Implementation until
  its agreement has been sent out; a draft opens automatically at Mark Approved.
- **Reviewer roles** - two new personas, Elena V. (OGC, Asia Area) and Rafael T. (Area
  Finance Reviewer), added purely to review Corporate Agreements; neither has any project
  action.
- **Data** - new fixtures `contracts.json`, `integrations.json`, `gate_events_seed.json`,
  `contract_templates.json`, `signing_authority.json`, plus `users.json` (the two reviewer
  personas) and small additions to `projects.json`, `delegations.json` and
  `seed_attention.json`; regenerated into `js/data.js` via `tools/gen-data.js`.

### v1.1.0 as-built rulings

- The contract gate is **threshold-driven**: `CONFIG.CONTRACT_THRESHOLD_USD` ($50,000,
  editable in Admin › Process), not always-on - settling the open question left in the
  scaffold plan.
- Hong Kong still has no seeded M1 (per the v1.0.4 ruling), so its Corporate Agreement
  steps in the demo walk - approving for signature, starting the signing ceremony - are
  run by the area office (`daniel`, `admin`) rather than a Regional Manager.
- `state.signingDelegations` is a new slice, kept fully separate from the platform's
  pre-existing (and unrelated) `state.delegations`, which is RD-5 widget data.
- An Excel/CHaS export import is always advisory, regardless of sync mode - a pasted row
  can raise a proposal but never write a gate on its own.
- An amendment in progress (`amending`) never re-blocks a contract gate the project has
  already satisfied; the gate only re-closes if the agreement itself is terminated.
- No persistence, no e-signature vendor, no real network calls - every EGC driver is
  simulated in-memory, and a page refresh resets both new engines along with everything
  else in the demo.

## v1.2.0 (3 Sep 2026) — Flow pass + persistence

Built by the same working-team pattern (architect + five parallel builders + independent audit;
full contract in `../docs/ARCH_v1.2.0.md` + `../docs/CORE_API_v1.2.0.md`).

- **Persistence + backup** — `js/persist.js`, loaded immediately before `app.js`; every render
  saves a debounced snapshot to IndexedDB (localStorage, then in-memory, on failure). Reload
  restores it; Administration › Data adds Backup now, a scheduled backup on every clock advance
  (keeps 7), Restore from file with checksum tamper-detection, Reset to fixtures, and CSV export
  for projects/contracts/gate events/activity/outbox. `schema_version` moves to 3; a v1.1.0-shaped
  (schema 2) snapshot migrates on load.
- **Production database design pack** — `docs/db/` (ERD, PostgreSQL 16 DDL, backup/retention
  runbook, generated data dictionary) — see `docs/db/README.md`.
- **Four-rung stepper, one source** — `D.rungOf(p)` feeds the register, the project page, the
  Needs-you list, mobile and e-mail text; a declined project shows all four rungs, the one it
  died at struck through.
- **"Needs you"** — Approvals (P6) becomes one ordered list with filter chips, replacing the six
  v1.1.0 sections; inline reason composer for Return/Reject/Dismiss.
- **Role homes** — new routes/pages P13 Worker, P14 Country Head, P15 Regional/Portfolio, P16
  Reviewer, P17 Viewer; every persona's sign-in landing is now their role home (`#/home`).
- **Two-bucket alerts** — every rule is `immediate` or `digest`; digest rules fold into one daily
  A-14 mail per recipient from Administration › Data's Advance day or the Alerts page's Run
  daily digest button. Immediate mails carry Approve/Return/Confirm buttons that deep-link to
  the row.
- **Mobile approve** — P10 rows use the same Needs-you actions and inline reason pattern as the
  desktop list, replacing the modal-only approve path.
- **Clock** — `state.clock = {today, advanced_days, backup_seq}`; Administration › Data's
  Advance day (+1/+7) moves `CONFIG.TODAY` forward, which is what makes digest folding, SLA
  nudges and scheduled backups demonstrable.
- **Data** — no new fixture *keys* this cycle beyond `fixtures/meta.json`'s `schema_version: 3`;
  everything else added (`clock`, `alertPrefs`, `digestQueue`, per-row `bucket`/`delivered`/
  `actions`) is runtime state, not fixture data.

### v1.2.0 as-built rulings

See "As-built rulings" above — the six v1.2.0-specific rulings are listed there alongside the
earlier releases' rulings, in the order they were decided.

### v1.2.0 known polish backlog (not defects; not done this cycle)

- A project owing two actions at once (a gate and its agreement) renders as two full Needs-you
  rows rather than one grouped row — this is `D.needsYou`'s shape, not a page bug.
- The country ceiling bar's "ceiling $1,000,000" caption repeats on every row of a bar list
  (P15/P17) where every ceiling is identical; a per-list "print once" option would read cleaner.
- P16's attestation grid puts the fourth attestation on its own second row at 1440px (three fit
  per row).
- The P9 tab strip still scrolls sideways at 390px (pre-existing v1.1.0 behaviour); the new
  "Data" tab sits off-screen until scrolled.
- P8's Sent-log outbox groups (Sent immediately / Daily digest) do not collapse; a long session
  makes the immediate group long.
