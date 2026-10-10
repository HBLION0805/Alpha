# Technology candidate isolated MOCK lifecycle

The technology research/feasibility lane previously stopped before lifecycle
admission. The existing snapshot engine already modeled long-option entry,
independent exits, costs and cash, but validated only GLD/IBIT. This delivery adds
an explicit synthetic entrypoint and isolated persistence without expanding the
production entrypoint. It does not continue company investment research.

Implemented: AAPL, TSM, QQQ and TSLA fictional candidates; one standard long call
or put; BUY_TO_OPEN and SELL_TO_CLOSE legs; exact quote clocks, fees and cash;
stop/target/time exits; retained unresolved positions; immutable input and ordered
event receipts; idempotent retries and fresh-process recovery. Original symbols
are retained. The existing feasibility, quote/session, economics and snapshot
exit engine are reused. The real candidate assessment still refuses admission.

The MOCK path is explicitly `TRIAL_REHEARSAL`: it requires the existing eligible
trial research opinion, direction/product agreement and complete synthetic
permission/funds/entitlement/risk evidence. It does not treat absent technical
confirmation as confirmed. Existing 20%/net-2R engineering assumptions are copied
into this test profile, not made into a new Owner strategy or sizing rule.

CLI: `npm run options:tech-mock -- --help`. Start accepts a complete fictional
input, append accepts one fictional quote event, and recover recomputes from
originals. All files remain under ignored
`data/runtime/options-workbench-development/mock-*`. Input files distinguish
simulated source clocks from actual receipt-recording time. No production
registration, enrollment, market call, scheduler or account API is invoked.

Unsupported: spreads/multiple legs, short options, overnight positions, exercise
or assignment, partial fills, scaling, settlement and production arming. Missing
exit quotes retain exposure; an overnight quote cannot manufacture a close.
Sale proceeds remain unsettled. Each run is an independent fictional cash case,
not a portfolio, real account, $160 challenge record or strategy outcome.

Validation: focused tests cover both products, four identities, all three exit
reasons, unavailable liquidity and rebound, stale/unknown quotes, independent
UNKNOWN gates, duplicate/conflicting requests, journal corruption and missing
sequence, pre/post-publication interruptions, and fresh-process restart. The
exact publication combination is validated separately from unrelated local edits.
See `docs/status/tech-mock-lifecycle.json` for the final counts.

Atomic publication uses same-directory exclusive hard links after fsync. A
matching retained staging link from an interruption is cleaned up on recovery;
unpublished staging originals remain local. Unknown external links or broken
hash/sequence fail closed. This supports process interruption on the local
filesystem, not an off-device backup or a guarantee against storage failure.

Real acceptance remains NOT_TESTED: no current qualified technology quote series,
authenticated account/funds/permission proof, real-price complete Paper round
trip, or trading advantage is established by synthetic tests. Production UNKNOWN
blockers, CPI workspace, installed schedules and the challenge ledger are unchanged.
