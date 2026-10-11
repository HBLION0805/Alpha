# Version-bound course research archive — October 11, 2026

The initial course panel kept declarations only in browser memory. This addition
lets the Owner explicitly preview and confirm a separate immutable research
supplement against an exact already-saved thesis draft or frozen plan version.
It reuses the existing bounded comparison store and protected local session API.
It does not add fields to or rewrite a frozen plan, prediction or manual ledger.

The record retains its own identity, actual savedAt, framework/catalog versions,
plan key/version/registration clock, declared fields, exact derived plan inputs
and course assessment. Recovery verifies the original plan version and recomputes
the assessment. Newer drafts never replace the original binding. Repeating an
unchanged confirmed save returns the same record and clock; changed requests or
stale previews fail. Unknown optional values are omitted consistently before
fingerprinting and remain missing in assessment. Tampered and unavailable records
stay visible as errors rather than being silently replaced.

The planner offers a separate saved-version selector and preview/confirmation.
Reloading restores the archive; explicit loading copies only declarations into a
local draft. Journal / Evidence loop displays the exact archive references and
original input. These are supplemental research links, not finalized Alpha Journal
entries, new Prediction Log evidence, scored outcomes or approved lessons. A draft
archive remains bound to that draft if a later frozen version exists. It is not
silently promoted to frozen pre-entry evidence. Existing mathematical structures
and technology admission gates remain unchanged.

This archive surface currently binds the existing manual planner's saved thesis
versions. The separately reviewed `--course-research` file channel binds mathematical
comparisons by exact input fingerprint and research record ID/version/time. Saved
technology trace remains an association of the fixed-36 original review/ranking;
it does not create a strategy request, a concrete trade plan or an automatic
course archive for unrelated technology records.

Independent checks passed: archive/recovery/API **11/11**, asynchronous stale-state
checks **5/5**. Real Chrome desktop/mobile acceptance at
2026-10-11T16:26:37.693Z–16:26:39.532Z saved, reloaded, restored and displayed a
fixture archive in Journal, rejected an edited old preview, and preserved the
fixture ledger head with zero fills, zero page errors and zero external requests.
The test used a newly created isolated workspace; no real Owner plan was archived.

Real-browser testing found an undefined-field serialization mismatch missed by
the earlier fixtures. The narrow repair normalizes only the archive's JSON input
before hashing. An independent equality check retained all 24 missing requirements
and both false admission flags. The earlier failed fixture original remains local
and unchanged. Final full-suite evidence is recorded in the course status file.

Original source cadence, the two running finite continuations, October 12 frozen
2dabc114, CPI/15:50, challenge ledger, account/order authority and risk settings
are unchanged. Production-like 4178 stays on its reviewed archive until the new
read-only preview is separately verified and reviewed. Local raw receipts and
browser artifacts remain ignored.

Final regression: 247 components, 6,152 passed, zero failed. Expanded archive details also passed desktop/mobile layout checks at 16:33:27.557Z–16:33:29.309Z. The private browser harness now explicitly waits for reload completion.
