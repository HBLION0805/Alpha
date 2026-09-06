# Options Research Input Preparation v1

Date: 2026-09-06. Scope: preparation for the first entitled GLD/IBIT quote run.

## Problem and decision

Source extraction, market import and replay currently take separate files. The
extraction parent hash does not accompany the child into a replay record, and a
wrong dataset ID, contract or session can be supplied independently. Add a small
local preflight composition that checks these links and saves a reviewable input
package. It does not alter existing engines, qualification gates or journals.
The Owner has authorized implementation and Git publication. After the automatic
purchase-review rejection, the Owner deferred paid data and directed continued
local preparation.

## Command and inputs

`options:research-preflight --manifest <JSON> --metadata <JSON> --config <JSON>`
checks and returns a report without saving. Add `--save` to publish an immutable
preparation artifact. `--help` explains all boundaries. All input files must be
bounded regular non-symlink files, decoded as fatal UTF-8. Manifest and metadata
are at most 64 KiB / 16 KiB; config at most 64 KiB. No network or credentials.

The manifest must be the existing SOURCE_PRESERVING_CSV_SUBSET_V1 format under
the current workspace's data/runtime/options-historical-replay/extracts directory.
Reject symlink/junction directories, path escapes and files outside that location.
Use the manifest's own directory plus the literal quotes.csv, never an input
redirect path, to locate the child. Retain the sourcePath as an unverified label;
do not dereference a manifest-supplied parent path. Check exact manifest fields,
selection (reuse existing validation without changing extractor semantics),
selection fingerprint, complete manifest fingerprint, exact UTC timestamps,
bounded integral counts, hashes, classification and record normalization.
Require manifest requestedAt <= finishedAt <= actual preparation requestedAt.
The parent hash remains an extractor claim; the parent bytes are not reverified.

For EXTRACTED, hash the exact child bytes and compare to childSha256; parse with
the existing CSV parser. Compare total/normalized/duplicate counts, require every
retained row to match the declared Eastern date and selected standard GLD/IBIT
keys, and no non-target rows. For NO_MATCH, require zero selected counts, null
child hash and no child file. Bad integrity is an error; it is never repaired.

Validate config through validateHistoricalReplayConfig and metadata through the
existing market-evidence constructor (a header-only CSV is valid for structural
metadata validation). Never synthesize an actual quote, size, fee or data right.
Require metadata.datasetId to equal config.datasetId; selected contract must be
declared and present; plan decision Eastern date must match selection/session.
Require HISTORICAL_FILE and an interval of 1..15 minutes. Preserve source origin; OWNER files
without OWNER_ATTESTED_LOCAL_USE cannot pass, and synthetic remains synthetic.

## Output and missing inputs

Report engineVersion INPUT_PREPARATION_V1, immutable input fingerprints, full
metadata and config, selected source manifest, child path/hash, and the exact
normalized evidence candidate when available. Candidate importedAt is the actual
preparation read clock, explicitly not a saved market import or historical clock.
Provide blockers for NO_TARGET_QUOTES, missing selected contract, ID/date
mismatches, missing contract/session/cost assumptions and counterfactual
acknowledgement, undeclared rights and incompatible delivery/interval/size model.
On or after 2026-06-22 the contemporaneous-size model remains unproven.

Status is INPUTS_LINKED_FOR_RESEARCH or BLOCKED. INPUTS_LINKED means only coherent
declared inputs. It does not certify source rights, publisher identity, actual
contract listing, session/fee accuracy, affordability, liquidity or strategy.
Include executionAllowed:false, marketValidated:false, winProbability:null,
brokerAccountVerified:false, originalQualificationUnchanged:true, and no trades.
Every report lists the next explicit manual import and research steps, retaining
the old gate and counterfactual warning. Do not run the replay or append its
journal from this preflight command.

## Optional immutable preparation record

Publish one JSON artifact below
data/runtime/options-historical-replay/preparations/<SHA256-of-runId>.json using
exclusive creation, fsync and bounded safe paths. Hash the complete artifact.
Cap the complete preparation artifact at 16 MiB. Store workspace-relative
manifest/child paths; validate their absolute resolved locations during every read.
Bind original requestedAt to the report; an identical repeat must preserve its
first clock. Semantic identity uses full config, metadata, source manifest and
child hash (not candidate ingestion time); changed inputs under one run ID fail.
Saved reads recompute semantic results at the original saved preparation clock
and check exact stored output/fingerprint. Validate the current supplied files
before returning an idempotent saved artifact. Partial/corrupt output fails;
never erase or rewrite it. Output publication has no multi-journal transaction.

## Dated broker reference

Separately provide primary-source research on Robinhood fees, account rules,
option order behavior and GLD/IBIT sessions. Use an integer-arithmetic single
execution fee estimator for the specifically reviewed 2026-09-04 research date,
ordinary nonprofessional GLD/IBIT long option orders only. The estimate must keep
SEC proceeds-dependence and each published rounding rule. It must never modify
the existing replay's fixed fee assumptions automatically. Unknown or unsupported
dates, account approval and fragmented fills cannot become broker-confirmed fees.

## Acceptance

Test source/child/count/clock/selection integrity, mismatched IDs/date/contracts,
missing assumptions/rights, source classification, size-model limits, exact fees
and rounding boundaries, idempotence, changed inputs, partial/corrupt output,
safe paths, and byte-for-byte preservation of all prior journals. Exercise the
actual zero-target official sample honestly as BLOCKED. Run focused suites,
typecheck, the aggregate and a final recorded report. No real data outcome may
be reported until an entitled GLD/IBIT file is actually acquired.
