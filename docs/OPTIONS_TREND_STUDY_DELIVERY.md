# Prospective trend and contract study

September 17, 2026 New York. [Specification](specifications/OPTIONS_TREND_STUDY_V1.md),
[checkpoint](status/trend-study.json).

The Owner approved freezing one trend-entry and contract-selection rule, recording
future signals and independent outcomes, and improving data and exit monitoring.
The new research panel connects those steps without reopening completed paper
engineering or promoting an untested rule into canonical recommendations.

## Frozen rule and first cohort

`gld-ibit-trend-v1-20260918` was registered at 2026-09-18T01:51:18.674Z, before
the next session, for September 18 through October 15: 20 reviewed trading days.
Both ETFs start with zero observations, signals, entries and closed outcomes.
Twenty dates are an observation plan, not a requirement to trade or a pass mark.

The fixed experiment uses the first hour's 3/12 close means and last 30-minute
range. It requires two aligned five-minute closes outside that range plus 10 bps,
limited chasing, and second-bar volume at least 1.2 times the baseline mean.
Only the first match is considered. A blocked match cannot be replaced by a later
winner. Same-side contracts must meet frozen DTE, delta, bid/ask, size, spread and
the unchanged allocation checks. Ranking and all rejected reasons remain visible.
These numerical choices are untested research assumptions, not fitted parameters.
This technical experiment is separate from the news/macro canonical decision.

Selection is not a fill. A later independent quote must satisfy the frozen limit
within five minutes. Existing V3 snapshot-paper code models later bid exits with
saved 20% / net-2R assumptions, a one-tick exit allowance and explicitly dated
estimated fees. Actual costs stay unknown. No same-quote entry, synthetic market
fill, historical backfill or guaranteed stop is used in production.

## Evidence and remaining constraints

The first baseline and first decision persist. Later revisions and matching audit
conflicts are retained. Unknown interpolation can show a shadow pattern, but it
cannot create a paper plan. Late processing, missing opening history and unusable
quotes are recorded as failures of observation, not evidence of no market signal.

An offline check uses the existing service tick and guidance publication. It reads
saved files only. Existing routine 15:50 quotes and conditional event-hour samples
do not cover this intraday rule or continuous exits. There is no new ETF collector,
contract tracking expansion, source timer or brokerage call. **This implementation
does not yet provide a reliably populated forward trial.** Fresh suitably timed
ETF/option receipts and resolution of the existing source issues remain necessary.

If an entry is modeled, missing or unusable exit quotes keep it unresolved. The
panel distinguishes stale monitoring, overdue time exits, unknown net results and
unobserved price paths. Returning inside the ETF range is a research warning,
not a retrospective change to the frozen premium/time exit. Candidate lessons
remain unapproved, with causes unestablished. Separate ETF scenarios are not a
combined funded portfolio. The $190 buying-power statement does not replace the
historical $1,000 equity declaration or establish available settled funds.

## Storage and operation

Private ignored records are under `data/runtime/options-trend-study`. Exclusive
append-only registrations and daily reports contain copied source/audit/quote
inputs, hashes and reproducible results. Copied records recover independently of
the original stores. Repeated unchanged checks do not create duplicate reports;
restart gaps remain explicit. Existing reports and journals are unchanged.

- `npm run options:trend-study -- --desk`: read current cohort and results.
- `npm run options:trend-study -- --observe`: record eligible saved evidence.
- `npm run options:trend-study -- --verify <record>`: recompute a copied record.
- `npm run options:trend-study -- --start <id>`: register a future cohort; a second
  active cohort is rejected. Do not repeat this for the already registered study.

Daily guidance exposes the frozen rule, 20-day denominator, decisions, screening,
outcomes and candidate lessons. Its protected local recording action now passes
through the browser request allowlist. No account or order route was added.

Validation: `npm run test:options-trend-study` passed 40 checks; strict TypeScript
and `node scripts/alpha-validate.mjs` passed, with 4,728 tests / zero failures across
178 components. Checks include copied-only outcome recovery, chronology, blocked
first signals, gap losses, unresolved exits and failure isolation from canonical
publication. Desktop and 390-pixel mobile views showed the registered cohort and
fixed rules without page overflow. The authenticated local recording action
returned without a source request; browser errors were empty. The exact-workspace
service restart preserved registration and zero future counts, with offline status
OK at 2026-09-18T02:02:55.913Z. Private records remain ignored by Git.

Overall workstream status remains 4 local / 4 partial / 2 unvalidated. Source
qualification, strategy benefit and strict live execution remain open.
