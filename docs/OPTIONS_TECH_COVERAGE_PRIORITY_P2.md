# Direct review coverage priority — October 10, 2026

The first coverage correction still allowed a verified event A's related link to clear event B even when B's own latest review was unresolved. The isolated regression reproduced this with B's conflict recorded before A's link. The failed test output is retained locally; the previous delivery and its saved projections are not overwritten.

Current read projections use `ATTRIBUTED_VERIFIED_SCOPE_V2_DIRECT_REVIEW_PRIORITY`:

- For the same company/event pair, the latest explicit direct review controls coverage. A conflict, missing verification/body, or excluded company-event attribution stays unresolved regardless of whether an incoming link was saved before or after that review.
- Only independently qualified canonical reviews contribute their explicitly scoped, one-hop links. Inherited association coverage does not activate another event's outgoing links. Cycles cannot create qualification.
- An unreviewed target may retain a scoped association to a verified event. This never verifies its publisher body; `publisherBodyVerified` remains false. Unsupported relations do not qualify coverage.
- Same event IDs in different companies are resolved independently. Duplicate requested links remain rejected; multiple canonical sources cover a target at most once and cannot defeat its direct review.
- A later evidenced direct review can resolve a conflict. Earlier revision bytes remain unchanged. Existing append replay retains only the latest explicit review per pair; if historical input repeats a pair, the last explicit row controls coverage rather than unioning superseded rows.

`companies[].blockedRelatedAssociations` identifies each blocked canonical/target pair with `DIRECT_REVIEW_UNRESOLVED`. The original direct event coverage status, related provenance, ranking and saved revision hashes remain intact. A verified but low-materiality event can still complete coverage: a ranking rejection is not itself a denial of the underlying factual attribution. The projection does not interpret prose or authenticate source meaning.

The regression matrix covers both append orders, all three missing verification flags, declared conflict, missing body, company-event exclusion, A→B→C, cycles with and without a qualified source, unreviewed targets with historical outgoing links, shared event IDs across companies, new resolution evidence followed by renewed uncertainty, repeated links/sources, historical repeated rows and unsupported relations.

Read-only replay of the real nine-revision run retains 3 qualified and 2,931 unresolved associations out of 2,934, with the same revision head. Earlier saved-source and synthetic demonstrations also replay with explicit policy identity. No real review was appended or original artifact rewritten. Full isolated validation and preservation results are recorded in the separate status file.

This P2 repair adds no source acquisition, quote, Paper action, account access, schedule, deployment or matcher. The proposed SEC release/fiscal-period matcher remains unstarted pending independent re-review of this repair.
