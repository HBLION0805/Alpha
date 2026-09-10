# Robinhood snapshot paper workflow V2

Reviewed September 10, 2026 UTC. Scope: new local paper plans and their English
workbench surface. No account/order calls or source schedule changes.

V1 plans, source mappings, reports and fingerprints retain their original model.
V2 uses source-linked chain late-close metadata plus a bounded reviewed 2026
NYSE options holiday calendar. Normal close is 16:00 Eastern, or 16:15 when the
saved chain explicitly enables late close. November 27 and December 24 close
at 13:00/13:15. Unknown years are unsupported; unknown chain late-close state
uses 16:00 conservatively. Expiration-day plans remain unsupported. Source,
underlying and receipt clocks must all be in the supported session, with the
existing 60-second alignment checks. This is a session model, not verified
deliverable, entitlement, halt or execution evidence.

New plans explicitly choose manual fees (null stays unknown) or a dated Robinhood
nonprofessional, one-execution-per-side fee assumption. The latter uses the
existing reviewed cost arithmetic; entry and target-exit fee reserve converge
with net R. A modeled exit computes its fee from its own sale proceeds. Fees are
counted once. Slippage remains an explicit per-share amount. No global settings
or historical fee profile changes. Allocation remains $100–$500 / $1,000 equity.

Practical paper state is separate from strict source qualification: waiting for
cost assumptions, awaiting the declared window, awaiting an eligible quote,
entry window ended, open unresolved, or closed modeled. Independent side clocks
are limitations rather than an additional veto on this declared snapshot model.
No missing quote, closed market or future window becomes a fill. Stop/time exits
remain latched across invalid observations; quotes cannot prove the unseen path.

Persistence copies exact source bytes; new requests and plans select V2 explicitly.
Recovery dispatches by the frozen version, independently of current sources and
settings. Frontend preview/freeze/save, current fee assumptions, source session
and candidate notebook stay synchronized. Validation covers V1 fingerprints,
late/early/holiday/DST boundaries, missing metadata, cost rounding/convergence,
complete synthetic win/loss paths, copied-source recovery and API/UI workflow.

Sources reviewed:
- https://robinhood.com/us/en/support/articles/options-trading-hours/
- https://robinhood.com/us/en/support/articles/trading-fees-on-robinhood/
- https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx

Review decision: additive version dispatch is smaller and safer than replacing
V1 or altering market timestamps. The practical model can run on valid future
saved quotes while strict execution qualification stays unestablished.
