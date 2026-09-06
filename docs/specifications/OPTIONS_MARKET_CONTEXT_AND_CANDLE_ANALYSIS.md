# Options Market Context and Candle Analysis v1.0

## Scope and authority

The Owner's 2026-09-06 instruction to continue Alpha, followed by delegation of
the delivery choice, authorizes the offline implementation path. This work
implements P2-A through P2-D of the existing [Phase 2 plan](../OPTIONS_NEWS_PHASE_2_PLAN.md).
Implementation remains recorded as awaiting explicit acceptance. The Owner's
subsequent 2026-09-06 instruction authorizes development, commit and push;
publication no longer requires another permission question. It does not grant
brokerage execution authority. See the later
[retail specification](GLD_IBIT_RETAIL_FEASIBILITY.md).

The plan's reuse matrix, immutable fixture binding, numerical algorithms,
calendar grids, corporate-action requirements, rejection ordering, and eleven
acceptance scenarios are normative for this specification. The output is
descriptive fixture evidence with four independent timeframe assessments.
It is not option selection, a Decision Card, a risk approval, or a forecast.

## Implementation decisions

- Existing Canonical Bar creation validates each observation. Series integrity
  validates relationships between observations, without replacing single-Bar rules.
- Expose the existing calendar-evidence validator through a read-only wrapper;
  do not fabricate a complete Verified Market Snapshot to access its validation.
- A composition-owned immutable fixture binding and policy authorize inputs.
  An input cannot authorize its own provider, mapping, calendar, or adjustment.
- Every run recomputes features from the complete qualified history. No external
  Wilder state is accepted in v1; seed and recurrence follow the normative plan.
- Fixture policies explicitly supply windows and thresholds. No production
  parameter calibration or numerical default is implied by fixture values.
- All four series qualify before feature calculation. All outputs are staged
  before one immutable in-memory context write. Rejections are returned with
  health and provenance; they never become valid context records.
- Each timeframe retains its exact existing Market Regime input and assessment,
  including unresolved requirements. Agreement is descriptive equality only;
  disagreement never becomes a vote or a composite regime.
- Session calendars, adjustment qualification, and raw fixture manifests are
  local synthetic evidence. They prove software behavior, not market truth.

## Validation and delivery

Use strict typecheck, focused numerical and authority tests, existing calendar,
Bar, Registry/Composition and Regime tests, then the aggregate validation bundle.
Test success cannot set OWNER_APPROVED. Network, credentials, payments, accounts,
orders, Paper Trading, production persistence, and automated execution remain closed.
