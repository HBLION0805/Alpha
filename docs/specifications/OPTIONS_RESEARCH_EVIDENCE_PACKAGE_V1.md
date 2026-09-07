# Selected observation evidence package

OPT-RESEARCH-EVIDENCE-1. Reviewed September 7, 2026 against the original evidence
export storage helpers and observation verifier. Current model, no delegation.

The current study-based v1/v2 exports do not contain new observation/protocol/
context pairs. Add a separate opt-in selected-observation package, preserving
those formats and commands. Scope is exactly one existing observation and its
two declared prerequisites: six files, no directory discovery or source refresh.

Commands: --create <observation-id> <new-package-id> and --verify <package-id>.
Use data/runtime/options-research-evidence/<package-id>/ with six fixed payload
names and manifest.json. Original paths derive only from validated IDs and fixed
store roots. Payload bounds reuse observation 128 MiB, protocol 2 MiB, context
64 MiB and receipt 64 KiB limits; total is at most 200 MiB, manifest 64 KiB.

Before copying, run the existing observation --verify and match exact bytes to
its verified observation and prerequisite references. Preserve every original
byte and clock. Exclusively claim the whole package directory; never overwrite
or resume an existing complete, partial or empty package. Use the original
exclusive fsync/close writer. Recheck sources and copies. Record the actual
payloadsCopiedAt after all six writes, then write the canonical manifest binding
IDs, exact paths, sizes and SHA-256 values. This clock is not the later manifest's
completed-write time. No supplied historical package clock is accepted.

Verification requires only the package. Strict JSON, canonical reconstruction,
exact seven entries and fixed mappings reject unknown paths, missing/extra files,
unsafe links, oversized files and edited content. Copy the six verified files to
a fresh bounded temporary workspace and invoke the existing observation verifier.
It in turn recomputes original protocol and context evidence. Recheck package
bytes afterward. Actual verification must follow payloadsCopiedAt and semantic
recovery clocks. Never replace original observation clocks with recovery clocks.

The temporary workspace is removed only after resolving and verifying it remains
under the explicitly created temporary parent/prefix; never delete active data.
No active restore or off-device backup is claimed. Partial packages remain visible.
The package is local consistency evidence, not externally attested publication,
complete feature knowledge, sample independence or market validation.

Acceptance: original-byte preservation; duplicate/partial IDs; clock regression;
every missing dependency; foreign IDs/paths; malformed and rehashed tampering;
extra files; unsafe paths/hard links; bounds; independent process recovery with
only seven package files; and original note/outcome semantics. All old exports,
journals, studies and host configuration remain unchanged. Workstream totals and
the three open first-paper-flow gates do not advance from packaging alone.
