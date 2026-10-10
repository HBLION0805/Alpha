# Pending event coverage correction — October 10, 2026

A bounded review of five discovered company events exposed a counting defect: saving an unresolved review removed its company/event association from the pending list. The real operation reduced that list from 2,931 to 2,926 even though all five reviews explicitly retained `companyEventVerified=false`. The original before/after projections and source receipts remain ignored and local.

The research-input projection now distinguishes attempted reviews from attributed verified scope. Coverage requires an extracted original body, explicit original/company-event/materiality review flags, and no declared material conflict. Low materiality can still complete a review; selection score does not determine coverage. A later conflict reopens the canonical event and its scoped associations. A missing unrelated link does not invalidate an otherwise verified association. No saved review, base artifact, ranking, or source clock is rewritten.

Additive fields are `eventInputs[].coverageStatus`, `companies[].qualifiedAssociationIds`, and qualified/unresolved association totals under `screeningTrace`, identified by `coveragePolicy=ATTRIBUTED_VERIFIED_SCOPE_V1`. `reviewedEventIds` continues to mean that a review was recorded. Verification flags remain attributed judgments, not machine authentication. The existing V1 saved base and immutable revision format are unchanged; current read projections use the explicit coverage policy.

## Bounded real operation

Five distinct hypotheses were selected before acquisition: AAPL order-cut reporting, ANET guidance, CRM profit/margin, VRT revenue miss, and MU patent settlement. Twelve public requests produced nine HTTP 200 responses and three IR 403 responses. Denied domains were stopped; independently available SEC originals were retained. One previously saved MU SEC annual report was reused. No retries, quotes, orders, Paper fills or schedule changes occurred.

The AAPL publisher body attributes its claim to another publisher; issuer confirmation remains absent. The ANET/CRM/VRT originals are historical issuer results and cannot authenticate the selected October headlines or comparable consensus. The MU body confirms a settlement date but not the headline consideration. No extra related headlines were cleared or counted as independent corroboration. Thus five attempted event reviews yield zero fully resolved new associations: 2,931 remain pending out of 2,934. Three previously reviewed associations remain qualified. The selected five are not a deduplicated count of the entire discovery corpus, whose independent-event count remains unknown.

Research run `tech36-fresh-research-20261010-203633` now has nine immutable revisions covering eight reviewed canonical events; revisions five through nine were recorded between 2026-10-10T20:53:46.847Z and 20:53:52.235Z (16:53 EDT). Publication dates, SEC acceptance, RSS discovery and actual retrieval/review clocks remain separate. Date-only issuer releases do not establish first dissemination time. Guidance deltas, pre-announcement consensus surprises, shared macro causality and historical coverage gaps remain unqualified.

Tests cover incomplete verification, verified low-materiality coverage, later conflicts and linked scope, unavailable bodies, base preservation and the existing concurrent append behavior. Final isolated results are saved in the status file.

The next useful unimplemented automation is bounded resolution of a discovered earnings headline to its exact issuer release and fiscal period, retaining unmatched cases. This would address repeated manual retrieval without approving facts, altering scores or scheduling collection. It is not implemented by this correction.
