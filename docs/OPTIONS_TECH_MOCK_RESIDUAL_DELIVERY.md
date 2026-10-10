# Read-only MOCK residual reconciliation preview

The atomic spread model previously kept its original cash, whole-spread position
and even a closed modeled P&L in ordinary output fields after a contradictory
partial-fill report. Those numbers were historical model results, not a recovered
residual account. The ordinary residual account, actual position/close and risk
fields now stay UNKNOWN/null. The original outputs are retained under
`modelLedger`, explicitly labeled `ORIGINAL_ATOMIC_MOCK_MODEL_ONLY_NOT_RECONCILED`.
The complete-spread terminal loss is not a residual loss bound. Non-residual V1
outputs keep their existing shape; residual projections identify themselves as V2.

The new entrypoint is `npm run options:tech-mock-residual -- --preview --run-id
mock-ID --at UTC [--evidence FILE]`. It has no save, append, arm or repair command.
The supported command disables the tsx transform cache. The preview uses only
stat/list/read operations and a pure shared hash/order verifier.
It never calls the existing mutating recovery function, creates missing folders,
removes staging links, writes logs or changes journal state. Missing paths,
corruption, broken ordering and external links return a blocked preview. Matching
same-directory staging hard links are verified and retained, not cleaned up.
Reads are bounded to 2 MB per file and 32 MiB for a journal snapshot. Read receipts
identify copied hashes and pending names without authenticating their sources.

`previewMockSpreadResidual` is the pure calculation entrypoint. Neither original
atomic model fills nor quoted bid/ask values supply missing execution fields.
Each residual event lists missing execution ID, exact contract, side, quantity,
price, fees and execution/receipt clocks. Only an explicit envelope with version
`TECH_MOCK_RESIDUAL_EVIDENCE_V1`, mode MOCK, SYNTHETIC_FIXTURE origin, the exact
candidate, MOCK account and basis COMPLETE_MOCK_EXECUTION_HISTORY is accepted for
arithmetic. This completeness declaration is not independent verification.

Each supplied fill requires `id`, `eventId`, `mode`, `origin`, the frozen full
`contract`, `side`, whole-contract `quantity`, `priceCents`, `feesCents`,
`executedAt` and `receivedAt`. The reference event must exist in the visible
journal. Execution must precede its event report; supplementary receipt must
follow that report and precede the preview cutoff. Plan/session boundaries and
the exact long/short opening/closing directions remain checked. An earlier
atomic entry cannot be borrowed as an actual fill: its two executions must also
be supplied explicitly if a later partial exit is being examined.

Duplicate IDs, conflicting or repeated execution claims, wrong quantities or
contracts, reversed time, closing without an explicit prior opening, impossible
position quantities and contradictions with a closed original model withhold
all arithmetic. There is no implicit netting, correction, evidence merge or
state unlock. A single-leg report cannot silently become a complete-pair fill.
Real or UNKNOWN evidence and unknown plan permission/funds remain blocked.

When these checks pass, the output is only `MOCK_EVIDENCE_ARITHMETIC_ONLY`:
cash flow and signed quantities derived from the supplied fictional fills.
It is not an account reconstruction. Even zero reported quantity does not prove
flat exposure. Available funds, actual closed status, actual P&L and residual
maximum loss stay unknown; released funds are zero; action lists are empty.
No residual disposal, compensating orders, settlement, exercise/assignment,
production admission, source calls or account tools are implemented.

Tests cover partial entry/exit, old closed-P&L ambiguity, missing/conflicting
events and fields, duplicate evidence, exact contracts/quantities, time order,
corrupt journals, missing paths, pre/post-publication staging, denied filesystem
mutation primitives, frozen pure inputs and fresh-process reads. Before/after
inventories compare file content hashes, names, sizes, modification times,
inodes, link counts and directories. Earlier atomic and single-leg tests remain
in the exact publication validation. See [checkpoint](status/tech-mock-residual.json).

All fixtures and runtime receipts remain isolated and ignored. Original journals,
source bytes, CPI, production, schedules and the challenge ledger are preserved.
Real Paper acceptance remains NOT_TESTED. The next directly related development
increment is read-only mapping of existing saved real two-leg quote receipts
into synchronized identity/price/size/clock checks; missing account or source
evidence must still block admission, with no new collection or execution implied.
