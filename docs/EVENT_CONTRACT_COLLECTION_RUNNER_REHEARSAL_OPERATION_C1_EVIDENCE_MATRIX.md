# Event Contract Collection Runner Rehearsal Operation C1 Evidence Matrix

## Identity

- Task: `Day15-T3B15-C1`
- Date: `2026-07-26`
- Source review: `Day15-T3B15-MR1`
- Scope: operation authority, verification, isolation, and process-evidence
  correction
- Authority: fixture-only correction; no rehearsal execution authority

## Correction matrix

| MR1 finding | C1 correction | Evidence |
| --- | --- | --- |
| Post-ownership authority drift | Reinspect manifest, validation authority, commit, roots, store, lifecycle, recovery, Stop, and Control snapshot after ownership and before authorization | Unit rejection plus fresh-process drift drill |
| Stop during phase/result race | `appendResult` checks durable Stop inside the same `BEGIN IMMEDIATE` transaction before result insertion | SQLite Stop-during-phase test |
| Phase evidence trusted | Required independent durable-truth port rereads evidence; canonical mismatch preserves ambiguity | Unit mismatch test plus fresh-process mismatch drill |
| Injected validation receipt | Validation receipt is append-only in Control schema `1.1`; verifier reconstructs its fingerprint and every authority field | Verification test with persisted receipt and forged-field rejection |
| Control ledger omitted | Fresh verifier checks exact authorization/result/Stop history against every non-VERIFY plan entry | Missing-result and durable-Stop rejection |
| Ambient npm executable | Validation resolves the Node executable and adjacent npm CLI through fixed real paths only | Fixed-executable assertion |
| Untracked files ignored | Both Preflight and actual validation use `--untracked-files=all` | Exact Git-argument assertion |
| Runtime-only network guard | Node guard denies unapproved subprocesses and network Git actions; Python guard denies subprocess creation; Preflight capability comes from the closed phase composition | OS Node/Python/socket/subprocess probe |
| No closed composition | Added an exact five-phase composition with separate invoke and durable-observe authority; missing/extra phases fail closed | Closed-set and capability-attestation tests |
| Consumption outside fingerprint | `consumed: true` participates in authorization fingerprint and is required on read | Tampered-consumption rollback test |
| Non-completed result advances | Prior non-`COMPLETED` result adds a deterministic blocker in Preflight and Status | `INCOMPLETE` result progression test |

## Boundary interpretation

The enhanced Node/Python guards and closed composition are deterministic
application-level isolation controls. They do not claim to be a host firewall,
container, VM, or operating-system sandbox. A new independent MR2 must decide
whether this reviewed trusted-code threat model is sufficient for one exact
local fixture rehearsal. C1 itself cannot make that decision.

The closed composition intentionally exposes no general runnable command and
contains no real Operation Manifest or root registration. Adding a real
manifest or invoking a phase remains a separate authority decision after MR2.

## Focused validation

- Operation manifest/registry: `31/31`
- Operation control and correction tests: `33/33`
- Validation/final verification tests: `4/4`
- Fresh-process security drills: `11/11`
- Complete Alpha validation: `2456/2456`

## Prohibited scope

C1 adds no real Operation Manifest, rehearsal run, automatic recovery,
continuous runtime, provider/network request, Robinhood automation,
credential, real Pilot, T1/T2 delivery, dataset qualification, recommendation,
order, execution, or capital authority.
