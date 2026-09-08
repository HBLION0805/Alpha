# Local options workbench v1

Reviewed before implementation, September 7, 2026 New York. Task OPT-WEB-1;
current model and reasoning, one implementation session, high integration
complexity, no delegation or paid dependencies. The Owner approved completing
the frontend stage and standing save/commit/push authority applies.

## Scope and architecture

Deliver a browser application for the existing GLD/IBIT system: overview, option
chain/activity filters, a manual risk planner, reported trade registration/fills/
corrections, reviews/candidate lessons, and saved news/calendar context. English
product text. Use modular browser ES modules and CSS, native controls and a
small Node loopback service; no new framework, external assets, model call or
market connector. This is an interface to existing deterministic engines.

The Node entry point is scripts/options-workbench.mjs. Assets are under
apps/options-workbench. Data composition lives under scripts/lib. All browser
requests use a fixed same-origin /api route allowlist. The service binds only
127.0.0.1; validate the exact Host, reject foreign origins/fetch sites, require
a per-process session header and same Origin for POST, cap bodies and timeouts,
disable caching and cross-origin framing. No CORS, arbitrary file serving,
user-selected filesystem paths, shell commands, account or brokerage endpoints.
The existing network scan gains one exact approved browser client, with checks
for same-origin routes and no external endpoints; core network prohibitions stay.

## Data and mutation boundaries

- Recompute selected saved chain boards, activity studies, owner ledger and
  paper/research outcomes through their existing readers. Catalog only bounded
  safe directories. Failed or missing sources are visible, never silently
  converted to zero or qualified data. Newest selection is based on saved clocks;
  damaged selected evidence blocks that panel. Users may explicitly choose an
  older board. Original quote clocks and evidence origins stay visible.
- Reload reads local stores only. Public headlines, Treasury, BTC and event
  calendars use existing journal recovery; no feed refresh or host mutation.
  Report each failed component independently. Reject unsafe journal paths before
  calling readers. Source reads may use existing transient locks, but append no
  source events. The page does not promise continuous coverage.
- The planner calls evaluateOptionsRetailFeasibility unchanged. Show premium,
  full-premium stress, all-in R, target and blockers. Blank costs remain null;
  account values are declared scenarios. No conditional 10% allocation or trade
  permission. Quote selection can populate an explicitly unverified scenario,
  preserving source identity/time and never pretending it is a live fill.
- UI registration, fill entry, correction and void submit typed commands to the
  existing manual ledger CLI. Original input commands are saved exclusively under
  a new Git-ignored workbench input folder. Preview validates/reconciles with the
  existing engine; the save operation repeats authoritative validation. Idempotent
  request IDs persist across uncertain retries. Saving a plan registers a trade
  without creating a fill. No deletes, automatic exits or market-data-to-fill path.
- One configured ledger ID is fixed at server startup, default owner-manual-gld-ibit.
  A fixture workspace/ledger can be explicitly selected at startup for QA, and
  its synthetic origin is prominent. Never place QA trades in the owner ledger.
  Missing owner ledger requires an explicit initialize action; no GET mutation.
- JSON downloads export the displayed report without process session tokens.
  No external publishing, authentication, global settings or schedule changes.

## Interface and acceptance

Responsive light workbench with dark navigation, restrained gold/teal accents,
clear numbers and evidence labels. Desktop sidebar becomes an accessible mobile
menu. Keyboard navigation, labels, focus states, loading/empty/error states,
search/filter/sort/pagination, selected-contract details and explicit save
confirmation are functional. Filters and navigation preserve unsaved form drafts
within the tab; leaving a changed form or closing the tab warns before loss.
No credentials or account identifiers are requested. Review notes translate
codes into readable English and retain original codes in details.

Validate pure UI selectors and decimal conversion; service route/origin/body
controls; read failure isolation; registration, partial fills, correction,
idempotency and restart through real repositories in a temporary workspace.
Browser QA exercises all pages and a synthetic form-to-save-to-review sequence,
desktop and narrow layouts, validation and error states. Run the full validation
bundle, verify protected original bytes and a clean pushed Git state. Record the
six UI page acceptance results separately; ten-workstream counts and three open
real-price gates cannot advance merely because the frontend works.
