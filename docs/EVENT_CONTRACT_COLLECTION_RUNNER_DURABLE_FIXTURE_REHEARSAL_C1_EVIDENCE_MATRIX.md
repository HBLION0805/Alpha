# T3B14-C1 Phase Composition and Process Evidence Matrix

## Scope

This record maps the twenty durable fixture-rehearsal requirements to
version-controlled process evidence after `Day15-T3B14-C1`.

The C1 surface is test-only and closed. The test parent selects one declared
phase; every phase starts one fresh child process, performs at most one phase,
writes one bounded result, and exits. No child starts, schedules, loops over,
or predicts the next phase.

The clean sequence is:

`PREPARE -> STEP 1 -> STEP 2 -> STEP 3 -> VALIDATE -> FREEZE -> PACKAGE -> VERIFY`

It uses the durable PREPARE coordinator, the real T3B12 foreground-step
implementation, the fixed local validation adapter, the terminal freeze
transaction, the online-backup envelope builder, and the fresh verifier.

## Exact requirement mapping

| # | Required drill | Process evidence |
| --- | --- | --- |
| 1 | Clean preparation through fresh-process verification | C1 process drill clean run |
| 2 | Two clean runs preserve scenario truth | C1 two-run comparison |
| 3 | Crash before phase-claim commit | Runtime transaction drill: crash before ownership |
| 4 | Crash after phase claim and before action | Durable coordinator unresolved-claim and restart evidence |
| 5 | Crash after T6 and before rehearsal receipt | Runtime transaction process drill: crash after T6 |
| 6 | Crash after T7 lease | Runtime transaction process drill: crash after T7 |
| 7 | Crash after T8 attempt claim | Runtime transaction process drill: crash after T8 |
| 8 | Crash during T8B validation | Runtime transaction process drill: crash during validation |
| 9 | Crash after T10 and before rehearsal receipt | Runtime transaction process drill: crash after T10 |
| 10 | Stop before every mutable phase | Coordinator Stop boundaries and runtime Stop process drills |
| 11 | Stale ownership with authenticated quarantine | Runtime ownership-recovery drills |
| 12 | Old process session rejected after restart | Runtime transaction and ownership-recovery restart drills |
| 13 | Exact phase replay without duplicate mutation | Durable coordinator PREPARE/STEP replay evidence |
| 14 | Changed phase, ordinal, recovery, or manifest rejection | Coordinator replay-conflict evidence |
| 15 | Backup or backup-manifest substitution | Durable evidence process drills |
| 16 | Crash during backup and publication | Durable evidence backup/publication process drills |
| 17 | Package artifact and validation-receipt substitution | Durable evidence and package process drills |
| 18 | Excluded-data leakage | Package excluded-evidence process drill and verifier scan |
| 19 | Missing backup is `INCOMPLETE` | Durable evidence missing-backup process drill |
| 20 | Verifier cannot access mutable source | Durable evidence source-isolation process drill |

## C1 corrections

- `CompleteAndExit` now requires an explicit Pilot-completion persistence
  receipt when the Pilot is active.
- Fresh verification requires a pre-registered manifest-bound validation
  authority: repository commit, validation policy, suite fingerprint, and
  registered test total.
- A self-consistent but unregistered passing receipt fails closed.
- Opening an `EVIDENCE_FROZEN` rehearsal store enables SQLite query-only mode
  and exposes no mutable Runner or rehearsal repository.
- Windows validation invokes the fixed npm CLI through Node without a shell
  string.

## Authority boundary

The phase drill uses a test-owned, clean, network-free Git repository with a
fixed one-test validation bundle. This exercises the production validation
adapter without recursively invoking Alpha validation from inside itself.

This evidence proves composition mechanics. It does not authorize a real
fixture rehearsal, continuous runtime, provider access, T1/T2 delivery,
recommendation, Portfolio mutation, broker, order, or execution.

`T3B14-MR2` must independently review the correction and complete Alpha
validation before any exact Owner-approved rehearsal operation is considered.
