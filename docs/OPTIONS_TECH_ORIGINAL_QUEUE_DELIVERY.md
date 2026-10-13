# Exact candidate original-body queue

October 13, 2026 UTC / October 12 New York. The existing fixed-source issuer
reader and explicit event-review append path were reusable, but candidate filing
links had only private one-off acquisition scripts. This delivery adds a small
explicit queue around those existing components, without a collector or website
change.

## Entry and limits

```text
node --import tsx scripts/options-tech-originals.mjs --prepare --source-root WORKSPACE --request FILE --run-id NEW_ID
node --import tsx scripts/options-tech-originals.mjs --acquire --run-id ID
node --import tsx scripts/options-tech-originals.mjs --read --run-id ID
```

The request has version `TECH_ORIGINAL_QUEUE_REQUEST_V1`, `parent` containing
`runId`, `baseReceiptSha256`, `headSha256`, and one to three exact `eventIds` from
that batch. No caller-supplied URL is accepted. This first implementation supports
existing weekly SEC filing candidates only: the exact issuer/CIK/accession/primary
document URL is checked against replayed official metadata. It does not infer an
IR event link or fetch an arbitrary website.

Preparation verifies and copies the existing research run into a new private
workspace, preserving its base and review head, original bytes and all clocks.
The queue freezes its event list, source manifest and implementation hashes.
Reading never fetches. Acquisition has one exclusive durable attempt claim,
at most three requests, one attempt per candidate, the unchanged 512 KiB response
limit and 12-second total deadline. It reuses the issuer transport extracted into
`acquireBoundedIssuerResponse`; the fixed-source refresh API and schedule are
unchanged. No credentials, redirect following, browser execution or retries occur.
The first failed/restricted/unsupported response stops remaining queued requests.
An interrupted attempt remains incomplete with unknown call count, never resumed.

Every response retains bytes, safe response headers, URL, request/receipt clocks,
hash and candidate/base binding. A successful HTML extraction is pending material,
not verification or selection. Cover/index cues are distinguished from unreviewed
primary-document content; neither establishes complete filing/exhibit coverage.
Non-HTML and oversized documents stay unsupported/failed; limits are not relaxed.
The latest transport also retains Content-Encoding. Older responses lacking that
header remain unchanged; decoded-byte/declared-length differences remain explicit.

Success writes an all-false review-request **draft** alongside the raw bytes. It
does not append a review. Explicit review uses the unchanged TECH36 append CLI in
another isolated copy of the queue's workspace, so the acquisition queue's pinned
research head remains immutable. A batch of drafts must be reviewed sequentially
against the resulting exact heads; stale parents are rejected by the existing
append API. Injected fixture transport must be labeled TEST_FIXTURE.

## Saved-body and actual acceptance

Saved ANET 8-K cover and exhibit bytes were replayed offline, retaining their
October 10 source receipts and hashes. A TEST_FIXTURE transport supplied the saved
cover to an isolated copied candidate to test plumbing only; no company matching
or financial assertion was claimed. Explicit all-false append produced cited
material with unresolved coverage, no selection, and identical copied recovery.
A saved CRM exhibit exceeded 512 KiB and was not admitted or used to raise the cap.

Exactly **one** real anonymous request was made, for existing TSM accession
`0001046179-26-000680`, 6-K:

`https://www.sec.gov/Archives/edgar/data/1046179/000104617926000680/tsm-revenue20261008.htm`

- Queue: `original-body-tsm-20261013-01`, parent `weekly-batch-007`.
- Original SEC acceptance: `2026-10-08T14:12:39.000Z`; original discovery receipt:
  `2026-10-11T06:11:49.239Z`. These historical clocks were not reset.
- Request: `2026-10-13T00:51:40.611Z` / October 12 **20:51:40.611 ET**.
- Receipt: `2026-10-13T00:51:40.882Z` / October 12 **20:51:40.882 ET**.
- HTTP 200; 89,272 stored decoded bytes; 112 extracted blocks. Raw SHA256:
  `7f98bca23c1bd74ab514b243f437cf62958b994bb25a43bc95467eb6705c3a9c`.
- The saved primary document contains the 6-K cover, company identity/signature,
  September revenue narrative and tables. It is beyond a cover-only result, but
  is not asserted to be the entire filing or all exhibits. NT$ million and NT$
  thousand table units remain distinct.
- Content-Length was 5,247, while stored decoded bytes are 89,272. The transport
  at this actual acquisition did not retain Content-Encoding. Compression versus
  completeness cannot be resolved from the retained headers. No second request
  was made, and no missing header was synthesized.

An explicit pending-material record in a separate research copy cites blocks
5, 13, 29, 32, 35, 36, 37, 43 and 45, retaining all verification flags false.
It was appended at `2026-10-13T00:53:46.838Z` / October 12 **20:53:46.838 ET**.
The existing reader returns `CITED_MATERIAL_READY_FOR_REVIEW`, coverage
`UNRESOLVED`, and TSM ranking `MISSING_DATA`; direction, comparable expectations,
technical conditions and prospective holding window remain unknown. There are no
selected events, quote evaluation, Paper or orders. Research review head:
`748b2ba42be03e7bd5398fef602c9b1d03bdfcf14ef0423f7e93f91e409d9f2d`.
Copied research recovery reproduces this exact head and event inputs.

## Validation and remaining gap

215 targeted tests pass: 11 queue tests plus 204 existing issuer, company,
weekly-input and candidate/review tests. The full repository suite was not run.
Private originals and acceptance records are ignored under
`data/runtime/options-workbench-development/original-queue-acceptance-20261013-01`;
see `complete-trace.json`, `offline-acceptance.json`, `current-readback.json`,
`tests-final-r2.log`, `preservation.json` and `ports-unchanged.json`.

25,910 protected files, 537 prior intake/review files and all three actual account
originals remain unchanged. All three websites retain their pre-task versions and
startup clocks. The published 545/533 counts are unchanged because this work is
isolated and has not been deployed. No CPI pre-release restart, cadence/risk
change, account access or automatic collection was added. Code is locally saved
only; no push or deployment is authorized by this delivery.

The concrete remaining gap is verification of the obtained document's transport
scope/completeness and financial meaning, not another discovery system. Only the
one authorized actual candidate was attempted. This stage proves one bounded
acquisition-to-pending-research route, not 533 completed bodies, an investment
opportunity, fresh market evidence or live Paper acceptance.
