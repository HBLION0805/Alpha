# Preserve terminal evidence during explicit owner recovery — October 11, 2026

Both existing finite-run recovery functions previously appended an interrupted
terminal even when a valid FINISHED record already existed. A process that exited
between writing its final journal record and removing active.json could therefore
have a normal budget/expiry result displayed as a later interruption.

The minimal repair verifies a single recognized terminal at the end of the
existing hash-linked journal. After the unchanged dead-PID and unchanged owner-token
checks, it releases only that owner file and returns
`TERMINAL_PRESERVED_OWNER_RELEASED` with the complete `originalTerminal`.
The original manifest, journal, source receipts and source claims remain byte-for-byte
unchanged; no replacement clock is requested. Nonterminal interrupted recovery
retains the old append-only behavior. Duplicate terminals, events after a terminal,
unrecognized reasons and invalid hash chains block cleanup rather than picking a
favorable result. A second recovery after owner release retains the existing
NOT_ACTIVE rejection, without writing anything.

The new tests use temporary directories and mocked PID observations only. They
cover normal/failed/company-specific terminal reasons, live and unknown owners,
changed owner tokens, corruption, invalid terminal sequences, repeated recovery
and the original nonterminal path. **12/12 passed.** Independent review found no
remaining P1/P2. Neither actual public nor company recovery command was invoked.

This does not add resume, retry, source-lock removal, budget reset, deadline
extension, automatic startup or persistent service. It does not modify either
loaded natural runner. Source cadence, immutable October 12 inputs, original
CPI/15:50 workflow, risk settings and the challenge ledger remain unchanged.
4178 stays on the reviewed 549fb29 archive.

See [read-only inspection](OPTIONS_WEEKLY_RECOVERY_INSPECTION_DELIVERY.md) for
ambiguous initialization/request evidence and the remaining distinct recovery
gaps. Local records and operational evidence remain ignored and private.
