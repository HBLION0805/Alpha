# Shared option pagination budget — September 25, 2026

The saved 11:19 EDT live capture reached eight GLD instrument pages (800 unique
records) with another valid cursor remaining. IBIT reached its terminal third
page (248 records). No cursor parsing error occurred. Both the September 24 and
September 25 partial captures remain unchanged; this correction applies only to
future collection.

The loaded tool supports `chain_id`, `chain_symbol`, `cursor`,
`expiration_dates`, `ids`, `state`, exact `strike_price`, `tradability` and `type`.
It provides no strike range, strike list, ordering or page-size/limit control.
Every returned September 25 record already passed the active/tradable/standard
equity checks. Guessing exact strikes cannot prove nearest-three completeness;
expiry/type partitioning cannot eliminate those eligible records and can consume
more calls. Provider-side narrowing was therefore rejected.

The existing [Host collector](../scripts/lib/options-guidance-host.mjs) now reads
the equity batch and both chain lookups before instrument pagination. Its shared
instrument budget is **24 - 1 equity - 2 chains - 2 quote batches = 19 calls**.
Two quote calls are reserved conservatively for up to 36 selected IDs in batches
of at most 20, even when fewer IDs eventually require only one batch.

Active symbols receive one page per round in the existing stable GLD/IBIT order.
A terminal or failed symbol leaves the rotation; the other may use remaining
capacity. No symbol has its own fixed page allocation or size assumption. If
both stay active for all 19 turns, they receive 10 and 9 turns. Small lists stop
without spending unused capacity. A failed request consumes its attempted call
and is not retried.

Only absent/null `next` establishes a terminal list. Malformed/repeated cursors
retain `CURSOR_INVALID`; malformed pages and source failures retain their existing
codes. Every unfinished list receives `INSTRUMENT_LIST_PARTIAL`, including at the
shared-budget or three-minute request-start boundary. Reserved call capacity does
not override that deadline or guarantee quote delivery. Existing normalization
still requires all collection conditions to pass before capture completeness.

Tracked identities still join the selected expiration scope, require matching
returned metadata and retain priority within the shared six-ID/18-per-ETF/
36-total bounds. Missing tracked metadata remains an explicit failure. Expiry
targets, eligible contracts and nearest-strike ordering are unchanged. A partial
list yields only nearest-among-observed descriptive samples, never proof of
globally nearest contracts or full option-chain coverage.

Focused synthetic tests cover a list beyond eight pages, swapped symbol sizes,
two oversized lists, small lists, tracked metadata, cursor/source failures,
Host serialization and deadline exhaustion. They do not establish the actual
live GLD terminal page count. A separate Owner-authorized live validation is
still required. No live calls, schedule, strategy, risk, 120-second freshness,
official-close history or historical-evidence change is part of this correction.
