# Weekly trading plan V1 delivery

The weekly plan now has an Owner-facing Chinese `#weekly-plan` route and a small
status card on 总览 and 每日决策. The Workbench uses its existing protected local
session to preview, explicitly review, and append a later amendment. Plans live
under the ignored data root at `data/runtime/options-weekly-plan/`; each numbered
revision is fingerprinted, linked to its predecessor, and read back after an
exclusive write. Reloading recovers original reviewed versions rather than
rewriting them. The weekly status does not enter Daily Guidance's decision
gates and gives no execution authority.
Only the active New York target week can be newly reviewed. A later calendar
revision appears as an unsaved preview until the Owner explicitly adds an
amendment; the page keeps the earlier reviewed snapshot distinct. Cancelled
calendar items remain visible with their source status, outside active daily
checkpoints.

The preview composes the saved BLS and FOMC calendars without requesting either
source again. It also uses saved Focused News for context, existing Event Research
and Trade planner draft identities for optional links, and the current Owner
Capital Shopping List as a research universe. The 48 non-excluded Shopping List
entries retain their identity/status caveats; WATCH is not a buy instruction.
Source titles, Owner notes and persisted enums retain their original text. Manual event entries are
source-charactered as `OWNER_DECLARED` or `UNVERIFIED` and cannot impersonate an
official saved event. Unscheduled watch topics do not become scheduled events.

At the actual local-only read `2026-09-28T02:34:03.727Z` (September 27 New York),
the next-week preview covered September 28–October 2. The saved BLS receipt from
`2026-09-25T13:00:57.475Z` supplied three scheduled items: September 29 JOLTS
at 10:00 New York, September 30 Metropolitan Area Employment and Unemployment
(Monthly) at 10:00, and October 2 Employment Situation at 08:30. The saved FOMC
receipt from `2026-09-25T13:00:57.862Z` supplied no meeting in that week. These
are scheduled-calendar observations, not actual release results. The retrievals
were older than the existing 26-hour calendar check at preview time, so both
macro and central-bank coverage stayed `UNKNOWN`; no event-free conclusion was
drawn. Earnings, company events, conferences, Treasury/fiscal, policy and options
market coverage remained `MISSING_SOURCE`. News risk remained `UNKNOWN`. The
local preview saw no saved weekly revision and did not create a plan directory.
It linked the existing `gld-employment-20261002` manual plan draft by its
read-only ledger identity and original saved-at/fingerprint receipt. That draft
was not frozen, rewritten or turned into a trade.

No earnings or conference provider was added. Source-backed manual additions can
be reviewed later, but a few entries do not establish exhaustive coverage.
Weekly review retains original source/receipt clocks and time precision, including
date-only FOMC events with no fabricated midnight time. No source, market,
account, order or model call was made for this preview. There was no scheduler,
allocation, risk, Employment plan or Daily Guidance rule change.

Implementation and verification: see
[`OPTIONS_WEEKLY_TRADING_PLAN_V1.md`](specifications/OPTIONS_WEEKLY_TRADING_PLAN_V1.md)
and [`weekly-trading-plan.json`](status/weekly-trading-plan.json). The first
preview is a DRAFT/INCOMPLETE observation; it is not an Owner-reviewed plan.
