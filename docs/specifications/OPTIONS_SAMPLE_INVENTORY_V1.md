# Existing options outcome sample inventory v1

Task OPT-SAMPLE-INVENTORY-1, September 7, 2026. This is the next authorized
integration after the declared partition engine. Medium complexity; current
model, no delegation. Add a pure inventory composition and bounded local CLI
with tests. Extract only the already implemented outcome-audit history loader;
preserve its read sequence, clocks, repository validation and report bytes.

Recompute existing paper/historical reports before consuming any case. One
inventory entry per current scenario/run retains source system, ID, origin,
symbol (including unknown), original status, declared decision clock, original
recording clock when available, plan/source hashes and review presence. Show
the original outcome state without discarding no-trade, blocked, pending or
unresolved cases. Count revisions through the existing repository's current
scenario reconstruction, never as extra independent outcomes.

Use existing scenario.plan.createdAt and research.config.plan.decisionAt as
declared clocks, not proof of an actual historical decision. Never substitute
scenario.asOf, a source quote, an import time or the current inventory clock
for a missing actual receipt. Closed reviews have modeled exit times; these
are not evidence that a historical outcome was known then.

Hash exact paper quote paths and exact historical row arrays separately from
plans to expose repeated paths under multiple research variants. Path hashes
group within their source-system semantics only; same New York decision dates
group across both systems and ETFs. A match means declared dependence to review,
not complete duplicate detection or guaranteed statistical dependence. Counts
of distinct dates/paths never become an independent sample estimate.

No existing case provides a complete feature lookback and features-known
manifest, reviewed dependence groups, preregistered protocol and protected
holdout evaluation. Retain these requirements as missing. Export no automatic
partition input or fabricated clocks, no model metrics and no dataset-qualified
or calibrated status. The existing partition engine remains explicitly declared.

CLI --report [--save <new-id>] and --verify <saved-id>. Read-only default,
exclusive saved artifacts in the new sample-partition directory, containing
the exact recovered histories and recomputed inventory. Recompute saved evidence
without reopening active stores in a fresh process; store original source
check/construct clocks and actual saving clock separately. File-size limits,
strict JSON/UTF-8/duplicate keys and safe existing I/O apply. Missing/busy/corrupt
stores stay separate; default report returns status code 3 for blocked stores.
No active journal changes, source refresh, host change, market call or orders.

Test all original dispositions, revisions, source/plan/path distinctions,
original-versus-modeled clock semantics, no invented sample readiness, missing
and corrupt stores, future recording, mutation rejection, stable recomputation,
exclusive persistence, byte preservation, fresh-process recovery and no network.
Run the original outcome-audit tests after the loader extraction and full bundle
after this integration. Record actual inventory counts and preserved hashes;
this is the useful next data-preparation result, not a profitable strategy.
