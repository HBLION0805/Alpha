# T3B14-C1/C2 Phase Composition and Process Evidence Matrix

## Scope

This record maps the twenty durable fixture-rehearsal requirements to exact
version-controlled process evidence after `Day15-T3B14-C3`.

The C1/C2 surface is test-only and closed. The test parent selects one declared
phase; every phase starts one fresh child process, performs at most one phase,
writes one bounded result, and exits. No child starts, schedules, loops over,
or predicts the next phase.

The clean sequence is:

`PREPARE -> STEP 1 -> STEP 2 -> STEP 3 -> VALIDATE -> FREEZE -> PACKAGE -> VERIFY`

It uses the durable PREPARE coordinator, the real T3B12 foreground-step
implementation with the real fixture Worker transaction chain, the fixed local
validation adapter, the terminal freeze transaction, the online-backup envelope
builder, and the fresh verifier.

## Exact requirement mapping

| # | Required drill | Exact test and case | OS-process boundary |
| --- | --- | --- | --- |
| 1 | Clean preparation through fresh-process verification | `EventContractCollectionRunnerDurableFixtureRehearsalC1ProcessDrill.test.ts` — `clean C1 run executes one phase per fresh process` | Parent starts one child for PREPARE, three STEP actions, VALIDATE, FREEZE, PACKAGE, and VERIFY. |
| 2 | Two clean runs preserve scenario truth | `EventContractCollectionRunnerDurableFixtureRehearsalC1ProcessDrill.test.ts` — `two C1 runs preserve scenario truth and separate execution identity` | Two isolated roots execute the complete child-process sequence. |
| 3 | Crash before phase-claim commit | `EventContractCollectionRunnerDurableFixtureRehearsalC3ProcessDrill.test.ts` — `process crash before rehearsal phase claim commits no claim or action` | Child exits after rehearsal request/state validation but before `claimStep`; a fresh child proves no claim, receipt, or Runner mutation. |
| 4 | Crash after phase claim and before action | `EventContractCollectionRunnerDurableFixtureRehearsalC2ProcessDrill.test.ts` — `process crash after claim preserves durable unresolved ambiguity` | Child exits with code 91 after claim commit and before foreground action; a fresh child inspects durable truth. |
| 5 | Crash after T6 and before rehearsal receipt | `EventContractCollectionRunnerDurableFixtureRehearsalC3ProcessDrill.test.ts` — `process crash after T6 precedes rehearsal receipt and preserves dual-store truth` | Assembled STEP child exits after foreground T6 and before `completeStep`; a fresh child proves `DUE`, one unresolved claim, and no receipt. |
| 6 | Crash after T7 lease | `EventContractCollectionRunnerRuntimeTransactionDrill.test.ts` — `crash after T7 preserves lease ambiguity without attempt` | Child exits after durable lease acquisition; parent reopens SQLite read-only. |
| 7 | Crash after T8 attempt claim | `EventContractCollectionRunnerRuntimeTransactionDrill.test.ts` — `crash after T8 preserves unknown request outcome without result` | Child exits after durable attempt claim; parent reopens SQLite read-only. |
| 8 | Crash during T8B validation | `EventContractCollectionRunnerRuntimeTransactionDrill.test.ts` — `crash during validation persists no raw body or evidence` | Child exits in validation; parent reopens SQLite read-only. |
| 9 | Crash after T10 and before rehearsal receipt | `EventContractCollectionRunnerDurableFixtureRehearsalC3ProcessDrill.test.ts` — `process crash after T10 precedes rehearsal receipt and preserves dual-store truth` | Assembled STEP child exits after Worker T10 and before `completeStep`; a fresh child proves committed Runner evidence, no lease, and one unresolved rehearsal claim. |
| 10 | Stop before every mutable phase | `EventContractCollectionRunnerDurableFixtureRehearsalC2ProcessDrill.test.ts` — `Owner Stop precedes every mutable phase in fresh processes` and `fresh process observes Stop after claim as durable unresolved ambiguity` | A separate child attempts each mutable phase with durable Stop already visible; another child observes Stop after claim and before action. |
| 11 | Stale ownership with authenticated quarantine | `EventContractCollectionRunnerRuntimeTransactionDrill.test.ts` — `crash after quarantine rename replays the exact durable receipt` | Child is terminated after quarantine rename; a fresh recovery process replays the persisted receipt. |
| 12 | Old process session rejected after restart | `EventContractCollectionRunnerRuntimeTransactionDrill.test.ts` — `crash after session authorization preserves evidence but rejects old authority` | Child exits after session authorization; a fresh process proves old-session rejection. |
| 13 | Exact phase replay without duplicate mutation | `EventContractCollectionRunnerDurableFixtureRehearsalC2ProcessDrill.test.ts` — `fresh-process exact replay is idempotent and changed replay fails closed` | Separate replay child executes the same STEP request; fresh inspection proves no duplicate mutation. |
| 14 | Changed phase, ordinal, recovery, or manifest rejection | `EventContractCollectionRunnerDurableFixtureRehearsalC3ProcessDrill.test.ts` — `fresh processes reject changed phase ordinal recovery and manifest replays` | Four separate changed-replay children alter exactly phase, ordinal, recovery fingerprint, or manifest fingerprint; fresh inspection after each proves no mutation. |
| 15 | Backup or backup-manifest substitution | `EventContractCollectionRunnerDurableFixtureRehearsalProcessDrill.test.ts` — `backup substitution fails closed` and `backup-manifest substitution fails closed` | A fresh verifier child opens each substituted envelope. |
| 16 | Crash during backup and publication | `EventContractCollectionRunnerDurableFixtureRehearsalProcessDrill.test.ts` — `crash after backup never publishes a valid envelope`, `crash before publication quarantines staging and rebuilds`, and `crash after atomic publication preserves independently verifiable truth` | Builder child exits at each durable boundary; fresh builder/verifier children reconcile the result. |
| 17 | Package artifact and validation-receipt substitution | `EventContractCollectionRunnerDurableFixtureRehearsalC3ProcessDrill.test.ts` — `fresh verifier rejects substituted package artifact`; `EventContractCollectionRunnerDurableFixtureRehearsalProcessDrill.test.ts` — `validation receipt substitution fails closed` | One child substitutes the published package artifact and a later fresh verifier rejects it; the existing fresh verifier also rejects substituted validation. |
| 18 | Excluded-data leakage | `EventContractCollectionRunnerFixtureRehearsalPackageProcessDrill.test.ts` — `fresh process rejects excluded evidence before package commit`; `EventContractCollectionRunnerDurableFixtureRehearsalProcessDrill.test.ts` — `extra evidence file fails closed` | Package child rejects excluded input and fresh verifier rejects post-package extra data. |
| 19 | Missing backup is `INCOMPLETE` | `EventContractCollectionRunnerDurableFixtureRehearsalProcessDrill.test.ts` — `missing backup is INCOMPLETE and never PASS` | Fresh verifier child opens an envelope whose backup was removed. |
| 20 | Verifier cannot access mutable source | `EventContractCollectionRunnerDurableFixtureRehearsalProcessDrill.test.ts` — `fresh verifier does not require access to mutable source` | Source root is renamed before an independent verifier child starts. |

## C1 and C2 corrections

- `CompleteAndExit` requires an explicit Pilot-completion persistence receipt
  when the Pilot is active.
- Fresh verification requires a pre-registered manifest-bound validation
  authority: repository commit, validation policy, suite fingerprint, and
  registered test total.
- A self-consistent but unregistered passing receipt fails closed.
- Opening an `EVIDENCE_FROZEN` rehearsal store enables SQLite query-only mode
  and exposes no mutable Runner or rehearsal repository.
- Windows validation invokes the fixed npm CLI through Node without a shell
  string.
- The STEP evidence action invokes the real fixture Worker and its T7, T8,
  T8B, and T10 repository transactions; it no longer directly creates
  Worker-owned rows.
- Fresh child processes prove the previously component-only claim/Stop/replay
  requirements.
- Normalized validation counts both `tests passed` and `drills passed` suite
  formats.
- C3 places the pre-claim, post-T6, and post-T10 faults on the assembled
  rehearsal STEP boundary, changes each required replay binding in its own
  child, and substitutes a published package artifact before fresh
  verification.

## Authority boundary

The phase drill uses a test-owned, clean, network-free Git repository with a
fixed one-test validation bundle. This exercises the production validation
adapter without recursively invoking Alpha validation from inside itself.

This evidence proves composition mechanics. It does not authorize a real
fixture rehearsal, continuous runtime, provider access, T1/T2 delivery,
recommendation, Portfolio mutation, broker, order, or execution.

`T3B14-MR4` must independently review C3 and complete Alpha validation before
any exact Owner-approved rehearsal operation is considered.
