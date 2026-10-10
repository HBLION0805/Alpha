# TECH36_EVENT_REVIEW_REQUEST_V1

`--research-inputs` accepts either the existing historical candidate bundle or an original scanner directory containing `policy.json` and `policy.sha256`. A copied root with exactly one `runs/<scan-id>` directory is also supported. Fixed-36 policy identity and available receipt/raw hashes are checked. Missing optional discovery/coverage/original catalogs remain explicit unknowns; broken declared hashes fail integrity. No machine authentication of source meaning is implied. The existing `--prepare` and `--assess` paths retain their strict selected-candidate behavior.

`--event-reviews` reads the immutable base and all committed revisions, verifies their hashes/parents/source bytes, replays their rankings, and returns the current hash plus a V2 research-input view. It does not save another snapshot. The saved V1 base remains byte-identical.

An append request has exactly these fields:

| Field | Contract |
| --- | --- |
| `version` | `TECH36_EVENT_REVIEW_REQUEST_V1` |
| `requestId` | Stable lowercase identifier, maximum 80 characters; retry uses the same exact JSON bytes |
| `parent` | `scanId`, `baseReceiptSha256`, `revisionSha256`, from the current read view |
| `symbol`, `eventId` | An actual discovered company/event association in that base batch |
| `mode` | `SAVED_SOURCE_REVIEW` or `SYNTHETIC_FIXTURE`; synthetic history remains synthetic |
| `evidence` | Up to 6 new source envelopes, or empty when citing a copied original already in the batch |
| `review` | Attributed review fields described below; no direction, order or probability fields |
| `links` | Up to 20 discovered associations: `eventId`, `relationship`, `verifiedScope`; same company and exact original event IDs only |

Each new evidence envelope contains `rawPath` relative to the request directory, exact byte `sha256`, `url`, `startedAt`, `receivedAt`, `publishedAt` (nullable) and `provenance`. Provenance is `SAVED_PUBLIC_ORIGINAL`, `NEW_PUBLIC_ORIGINAL` or `SYNTHETIC_FIXTURE`. These are attributed origin declarations, not machine authentication. Maximum raw size is 2 MiB per envelope; the complete revision cannot exceed 12 MiB. New public acquisition is external to this command. Source receipt must not precede request start or follow the append operation; a known publication clock cannot follow its receipt. Old source evidence is allowed in a later operation without rewriting either time.

`review` contains exactly `originalVerified`, `companyEventVerified`, `materialityReviewed`, `materialConflict` (booleans), `dimensions` (`impact` 0–3, `valuation` null or 0–2, `catalyst` 0–2, `evidence` 0–3), `fact`, `analysis`, `nextEvidence`, `eventWindow` (nullable), and `citations`. Each citation is `{sha256, blockIndex}` pointing to an extractable body block for that exact event. A verified/material review or linked association requires at least one body citation. Citation validation proves the referenced bytes/block exist; semantic claims remain attributed, not automatically authenticated.

Latest review is selected independently per company/event pair. All earlier revisions persist. Multiple events per company are scored through the existing ranking function; ties use score, evidence, impact and then event ID. Only the chosen company event enters the same existing fixed-pool ranking. The view preserves the initial ranking and every revision's change reasons. An account record is not an input to this process.

The local base directory gains `event-reviews/000001/record.json`, then subsequent numbered revisions (maximum 64). Each immutable record contains the exact request, source envelopes/bytes, operation clock, implementation hashes, parent binding, replayable ranking and content hash. A complete temporary directory is atomically renamed to its exclusive sequence destination. Readers ignore incomplete pending directories. A second different writer for the same parent fails with a stale-parent error; an identical retry returns the winning record. No shared ledger chain, background process or transaction across unrelated stores is created.

Original source files, base material and old ranking files are never rewritten. Same hash under the same event produces one document with multiple receipt references; different bodies remain visible. A changed body is not automatically a factual contradiction: the reviewer must retain or explicitly assess the conflict. The output keeps direction, numeric facts, guidance revision and consensus surprise unqualified as in V1.
