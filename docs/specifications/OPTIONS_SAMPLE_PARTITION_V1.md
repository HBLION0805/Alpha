# Declared options sample partition audit v1

Task OPT-SAMPLE-PARTITION-1, September 7, 2026. Owner explicitly requested
continuous authorized development after reporting. Use the current configured
model without delegation. Complexity: medium/high. Scope: typed Options input,
pure audit engine, synthetic fixtures, bounded local CLI, tests and narrow
documentation. No model training, market collection, host change or orders.

## Reviewed design

The existing all-outcome audit retains failed, open and closed cases but does
not establish independent samples. This module audits a declared manifest with
three explicit chronological half-open windows: TRAIN, VALIDATION and HOLDOUT.
It never chooses favorable windows, shuffles time, infers a sample size threshold
or advertises a sealed test set. All manifests are retrospective declarations;
actual recording is distinct from hypothetical sample clocks.

Input contains a dataset ID, SYNTHETIC_FIXTURE or UNVERIFIED_IMPORT origin,
protocol hash/reference, window starts/ends, a declared minimum gap in elapsed
milliseconds (0-31 days), and 0-2,000 samples. A sample has its ID, GLD/IBIT
symbol, episode ID, strategy version, exact evidence hash, 1-64 observation
keys, feature interval start, decision cutoff, features-known clock, outcome
state (CLOSED, NO_ENTRY, UNRESOLVED) and nullable outcome-known clock.
Unknown feature bounds/availability remain null and block assignment. Unknown
outcome time purges a sample from completed-window comparisons. No outcome
value, PnL or probability is accepted by this schema.

Windows must be ordered, disjoint and separated by at least the declared gap.
The gap is an explicit research assumption, not a validated optimal embargo.
Assign a nominal partition using decision time alone. Keep every sample and its
disposition. Samples outside the windows remain UNASSIGNED. Unknown/inconsistent
feature chronology or features learned after the decision are BLOCKED. A sample
whose feature interval starts before its partition, whose outcome is unresolved,
or whose outcome-known clock reaches/passes the partition end is PURGED. The
whole information interval must be inside one window, conservatively preventing
label overlap and lookback overlap across its boundary. Equality at a decision
cutoff is allowed; equality at a window end is excluded.

Across initially assignable samples, the same New York decision date, declared
episode, exact evidence hash or observation key may not appear in two
partitions, including across GLD and IBIT. Mark every participant in a conflict
BLOCKED; do not pick a favorable representative. Within-partition reuse is
counted and disclosed without asserting statistical independence. Purged and
unassigned samples are excluded from this cross-partition conflict calculation
but retained with their original metadata and reasons. Output all per-partition
IDs/counts, outcome-state counts, symbols, calendar dates and reuse diagnostics.
An empty partition or blocked assigned candidate blocks the declared audit;
purges remain visible. Zero blocked samples does not prove selection completeness,
authentic point-in-time data, independence, statistical power or strategy value.

Stable canonical order is decision time then sample ID. Reject malformed inputs,
duplicate IDs/observation keys, unsupported authority fields, noncanonical clocks,
invalid hashes, oversized arrays and unsafe numbers. Original Options and generic
ResearchIntegrity engines remain unchanged; this module does not relabel their
results or revive the removed Event Contract dataset qualification product.

## Persistence and acceptance

CLI --demo, --input <workspace-json>, optional --save <new-id>, and --verify
<saved-id>. Use exclusive ignored artifacts, bounded existing safe I/O, strict
UTF-8/duplicate-key/depth JSON checks and independent-process recomputation.
Preserve actual recording clocks and source-file byte hashes. Demo identity is
checked against its exact fixture; hashes prove consistency, not authenticity.
No writes to old journals, no source refresh and no sealed-file/access-control
claim. Retain all candidates without reporting strategy performance.

Test temporal boundaries, gaps, label/lookback overlap, unknown clocks, unresolved
and no-entry cases, cross-symbol/date/episode/evidence/observation reuse,
within-partition dependence, empty windows, input permutation, changing outcome
state, all-case conservation, immutability and bounds. Verify exclusive saving,
corrupt/rehash-modified artifacts, strict JSON/links, clock regression, no network
or journal writes and a new-process restart. Run full repository validation.
Preserve existing runtime evidence, frozen September 8 study and actual v6 host.

Next independent integration: inventory the original paper/research journals
through their existing readers, retaining every case and identifying which
required sampling fields are unavailable. Do not manufacture those fields or
auto-select a train/test split from the existing synthetic outcomes.

## Primary references

Inspected September 7, 2026. These inform the separation principle; Alpha's
specific interval and dependence checks above are declared design choices.

- [scikit-learn cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html): chronological dependence, grouped splits and separating model selection from final evaluation.
- [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html): held-out information must not enter fitting or preprocessing.
