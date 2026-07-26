# Day15-T3B15-MR5 Independent Owner Review

## Overall recommendation

`NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`

This is a review recommendation only. It is not Owner rehearsal approval.

## Reviewed state

- C4 commit:
  `7d1e11a62943ed02d2f432067278c8664e8c7dbb`
- MR4 baseline: `a66a111`
- `HEAD` and `origin/main`: exact C4 commit
- Worktree during independent review: clean
- Review actions: read-only
- No Manifest, rehearsal, network, Provider, commit, or push action occurred

## Findings ordered by severity

### High — Fixed runtime still accepts caller-supplied phase authority

The fixed authority accepts registry, raw paths, readiness, Owner, Stop,
ownership, five mutation adapters, and validation staging. The composition
fingerprint identifies only the phase names and policy, not the actual adapter
objects. Source-file digests therefore do not prove that the runtime invokes
those reviewed sources.

### High — Registered roots and actual runtime paths remain separate

The phase-authority inspector checks all six roots from the registry, while
Control, observer, and verifier open separately supplied raw paths. The seal
can describe registered root A while the runtime operates on path B.

### High — VALIDATE and PACKAGE observer authority is not wired

The corrected observer requires the validation journal for VALIDATE and the
evidence root for PACKAGE. The fixed runtime constructs it with only the
rehearsal root and store ID. These two phases therefore cannot complete through
the fixed composition.

### High — Positive process evidence bypasses the target runtime

The positive test directly invokes T3B14 fixture functions, manually builds the
operation validation receipt, and manually inserts every Control authorization
and result. The child proves that the final verifier can validate this state,
but does not prove that the target fixed runtime, Owner gate, Stop, ownership,
and real adapters can generate it.

### Medium — Phase authority remains optional

The general gate retains a legacy static authority fallback when no phase
authority is supplied. A production-shaped operation path must require the
concrete authority rather than silently accept the fallback.

## Confirmed C4 improvements

- Claimed mutation evidence is no longer copied into durable truth.
- The validation journal uses exclusive creation and integrity verification.
- Phase authority is recomputed before authorization and after mutation.
- A new OS process can verify real rehearsal, Control, envelope, and backup
  evidence.
- Journal and package substitution are rejected.
- The runtime exposes no execution command.

## Independent validation

- TypeScript typecheck: passed
- Operation Control: `44/44`
- Operation verification: `4/4`
- C3 authority: `3/3`
- C4 authority: `3/3`
- Security process drills: `11/11`
- Fixture SQLite v3: `19/19`
- Validation Reporting: `6/6`
- Complete Alpha validation: `2474/2474`
- C4 whitespace check: passed
- Final Git status: clean

Passing tests demonstrate regression stability and the verifier improvement.
They do not close the fixed-composition findings above.

## Required next task

`Day15-T3B15-C5 — Truly Closed Operation Composition and End-to-end Gate
Evidence Correction`

C5 must:

1. accept registered operation identities rather than raw paths or phase
   adapters;
2. resolve and use every actual root through the six-purpose registry;
3. internally construct the real five phases, Owner, Stop, ownership, Control,
   observer, validation journal, executables, guards, and verifier;
4. bind concrete adapter identity into phase authority;
5. wire the journal and evidence root into durable observation;
6. generate positive Control history through the actual fixed gate in a new
   process rather than inserting it manually;
7. reject path separation, adapter substitution, journal omission, and
   phase-authority omission; and
8. undergo independent T3B15-MR6 before any rehearsal authorization.

No Operation Manifest or rehearsal phase is authorized.
