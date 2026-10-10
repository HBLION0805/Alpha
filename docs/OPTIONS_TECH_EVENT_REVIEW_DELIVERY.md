# Unselected scan inputs and append-only event review — October 10, 2026

Research inputs now accept the original scanner's saved batch without a selected candidate, historical ranking or followup artifact. The existing strict candidate/Paper handoff keeps its old requirements. The new path reads the fixed-36 policy, discovery, source receipts and raw files, verifies their available integrity links, and exposes missing coverage locally. It does not run the scanner or restore its old ranking implementation.

The same candidate CLI also supports event review revisions:

```powershell
npm run options:tech-candidate -- --research-inputs --source-root <saved-scan-directory> --run-id <new-run-id>
npm run options:tech-candidate -- --event-reviews --run-id <run-id>
npm run options:tech-candidate -- --append-event-review --run-id <run-id> --request <request.json>
```

The read command returns the base receipt hash and current revision hash needed by the next request. The [request and persistence contract](specifications/OPTIONS_TECH_EVENT_REVIEW_V1.md) specifies the fields. This is an explicit local operation, not automatic research approval or a new service.

## What changed

- An unreviewed or interrupted scan can generate original-body materials and the entire company/event pending list. Missing catalog/source rows remain unknown; no saved event does not mean no opportunity. Available originals can be read before materiality review.
- Each append binds the original scan ID, base receipt hash, parent revision hash, original event/company, exact source hashes and body-block citations. Original source clocks and the actual operation clock remain separate. New bytes are retained inside the immutable revision record.
- Each company can retain multiple reviewed events. For company ranking, each event is evaluated through existing `classifyAndRank`; the best eligible event is chosen by its existing score/evidence/impact ordering, then event ID for an exact tie. The final fixed-pool ranking also uses `classifyAndRank`. No old scanner scoring is reintroduced.
- The output explains before/after event, category, score and position for changed rankings. A repeated source envelope does not add a new event or score. Different bytes at the same URL retain both versions and an explicit source-change marker; substantive conflict status remains an attributed review, not automatic language interpretation.
- Same-request retries return the original revision; changed content cannot reuse a request ID. Concurrent different requests for the same parent cannot overwrite or both commit. A conflicting caller must read the new head and explicitly prepare a new request.

## Saved-original and simulated demonstrations

Both demonstrations use copies of the October 8 fixed-36 scan. **No new public or market collection occurred.**

| Demonstration | Observed result |
| --- | --- |
| Unselected raw scan | 36 companies; 2,679 discovered events; 2,835 company/event associations, including 2,830 headline associations; 5 events with material; 7 extracted documents; 0 reviewed events and 0 selected candidates |
| Saved-original append | One existing SNPS review was reused retrospectively with two exact SEC exhibit body citations and two existing related headline associations. This derived branch now has 1 reviewed/selected event and 35 companies without ranking reviews. That is research priority, not a stock recommendation or a new market finding. |
| Separate synthetic append demo | Three explicitly synthetic revisions: additional fixture body, identical-byte retransmission with no ranking change, and changed same-URL body with a declared conflict returning the event to pending verification |

Real run: `tech36-unselected-replay-20261010`. Actual append operation: `2026-10-10T20:20:33.185Z` (16:20:33.185 EDT). Its source records and earlier review retain their October 8 clocks. The original historical two-selected ranking and limited 2/12/11/11 followup remain unchanged; the derived branch does not overwrite or claim to supersede their coverage.

Synthetic run: `tech36-event-append-simulated-20261010`. Its mock bytes, clocks and assessments are isolated and labeled. A synthetic review history cannot transition back to real-source mode. Neither run creates a direction, surprise, forecast, trade plan or Paper fill.

## Validation and remaining work

The existing candidate test group covers no candidate, explicitly zero candidates, partial/interrupted scans, original duplication, source retransmission, conflicts, old-source/later-operation ordering, future clocks, cross-batch/event references, concurrent identical and competing requests, immutable replay and ranking-change explanations. Final combination results and preservation checks are recorded in the status file and ignored delivery receipt.

Still missing: continuous scanner operation and scheduling, broad original retrieval, substantive company analysis and automation of reviewer judgment. This increment adds the saved-scan/review connection only. It does not claim full-pool continuous or real-time coverage. Guidance revision still needs comparable same-target-period evidence; consensus surprise needs verified pre-announcement consensus. Account gaps do not block discovery.

No deployment, production schedule, October 12 trial, CPI workspace, 15:50 routine, challenge ledger or real-account/order changes. All source copies, review requests and receipts remain ignored and local.
