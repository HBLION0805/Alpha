# Research protocol declaration assessment

September 7, 2026. Task OPT-RESEARCH-PROTOCOL-1, design and first pure unit.
Base `14ec922`. Development router time `2026-09-07T20:16:42.999Z`; deadline
`2026-09-07T20:26:42.999Z`.

## Change and purpose

The [reviewed specification](specifications/OPTIONS_RESEARCH_PROTOCOL_V1.md)
separates full protocol definitions, actual registration storage and subsequent
decision references. This unit adds the typed declaration and deterministic
assessment. It freezes complete bounded feature/outcome definition text and
their hashes, strategy version, GLD/IBIT scope and declared partition windows.
The original sample auditor validates the window/gap contract with zero samples;
its empty-partition blockers remain unchanged.

The supplied registration clock is explicitly DECLARED_UNVERIFIED. Equality with
the first window start is late; later declarations are preserved with the exact
clock. No file is registered, no future partition is selected for the user and
no existing case is qualified. This distinction prevents a bare reference/hash
or a current receipt from acquiring historical research authority.

Original window descriptors are validated before cloning/hashing, preventing
getters or hidden fields from being normalized into accepted data. Scope ordering
is canonical. Definitions accept ordinary multiline text up to 16,384 characters
each; blank, invalid Unicode and disallowed control text are rejected. Definition
text is data and is never executed or treated as instructions.

Changed files: `src/contracts/OptionsResearchProtocol.ts`, the engine and tests
under `options-sample-partition`, the full validation registration, specification,
this delivery and checkpoint, and narrow HANDOFF/ROADMAP notes. Source, context,
sample-partition, paper/review and risk engines remain unchanged.

## Validation and review

Commands: the focused protocol test through tsx; TypeScript checking; the full
`node scripts/alpha-validate.mjs`; protected-file and capture-pair hash comparison;
JSON/link checks and `git diff --check`. Measured final results are in
[the checkpoint](status/research-protocol-declaration.json).

All 12 focused behaviors initially passed. Type checking then found an unavailable
Node assert declaration and arrow-function narrowing mismatch; these were fixed
using the repository's existing assertion and failure-function patterns. The
final validation includes those fixes. Review checked original validation reuse,
equal/late clock semantics, unchanged hashes, zero samples and absence of claimed
registration, complete features, sealed holdout or trading permission.

## Limits, assumptions and continuation

This is a pure declaration assessment. The new protocol registration CLI and its
actual post-write receipt are still pending, followed by independently verified
context/protocol references for new research decisions. No actual protocol was
invented or registered from the synthetic test windows, and the first local
context capture is unchanged. Local clock/checksum limits remain explicit.

Next bounded unit implements exclusive protocol payload/receipt storage and
isolated recovery according to the specification. It must record actual time,
preserve late/partial attempts and accept no historical registration-clock input.
The Owner's standing authorization covers saving, the scoped commit and push;
final refs are verified in Git. No user action is needed for continued code work.
