# Paper and headline journal recovery correction

September 7, 2026. A bounded follow-up to the Treasury writer review reproduced
the same class of persistence error in two existing local components.

`LocalOptionsPaperRepository` could return its older in-memory account report or
accept another append after a write/fsync exception. The disk may already contain
some or all of the attempted record, so a second append could use an incorrect
predecessor and cached balances could be mistaken for recovered state.

The headline journal also allowed callers to retain its append function after
the writer callback returned, and did not reject thenable callbacks that implied
asynchronous lock ownership. After uncertain persistence it could accept a second
append from an unverified predecessor.

## Change and validation

Changed `src/repositories/LocalOptionsPaperRepository.ts` and
`scripts/lib/options-driver-io.mjs`, with regressions in their existing I/O test
files. Paper access now fails after uncertain persistence until full recovery.
Headline append access expires with its synchronous callback; thenable results
are rejected and uncertain writes require recovery before another append.
Inert prior observation arrays are snapshots, not live recovered state.

The regressions failed before the fixes. Fault-injection checks cover both a
complete write followed by fsync failure and a partial append. A complete record
can be rechecked on restart; a truncated record remains untouched and blocks
recovery. No silent truncation, rollback, deduplication bypass or lock deletion
is introduced. Existing journal formats, hashes, trade calculations and lessons
remain unchanged. All fault injection used isolated synthetic test directories.

Strict typecheck and `npm run alpha:validate` passed **2,716/2,716 tests**, across
103 components with zero failures (44,538 ms). This includes 18 paper I/O, 20
headline I/O, 31 Treasury I/O and 16 readiness I/O tests. Warnings concern the
uncommitted task and Git line endings. A fresh local readiness read preserved
all twelve protected artifacts and the host schedule, finding the same five
closed paper trades, five reviews and four candidate paper lessons.
See [actual correction evidence](status/journal-recovery-guards.json).

The corrected components remain single-process local journals. Interrupted or
truncated files need an explicit reviewed recovery procedure; these guards do
not make the filesystem transactional or claim broker execution. There were no
real-data refreshes, journal appends, simulated trades, account reads or orders
during verification. Source quality and the frozen opening collection dependency
are unchanged. Continue preparing the first observation window and its review.
