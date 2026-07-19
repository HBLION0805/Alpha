# Codex Development Standard

Version: 1.0
Date: 2026-07-19
Task: D6-T1 Development Efficiency Standard v1

## 1. Purpose and Scope

This standard is the stable source of truth for repeated Codex implementation rules in Alpha. It exists so future tasks can use shorter prompts and less repeated context without reducing architecture quality, implementation quality, test coverage, validation rigor, owner review quality, auditability, or safety boundaries.

This standard governs Codex task execution, reporting, validation, review, and Git workflow. It does not replace `AGENTS.md`, `docs/DEVELOPMENT_STANDARD.md`, `docs/CORE_PRINCIPLES.md`, or subsystem specifications. When a task has unique business rules, those rules must still be stated in the task prompt or a version-controlled specification.

Token optimization is accepted only when stable requirements remain version-controlled and all required validation remains intact.

## 2. Quality-First Cost Policy

Alpha optimizes repeated prompt text, not reasoning quality.

- Quality has priority over token savings.
- Cost is a constraint, not the primary objective.
- A shorter prompt or cheaper model must not be used when it materially increases ambiguity, omission risk, architecture drift, security risk, rework risk, or owner-review burden.
- The lowest-cost model is acceptable only when it can satisfy the required quality, validation, and safety boundaries.
- Escalate model strength or reasoning depth when task ambiguity, capital impact, cross-system integration, security exposure, or defect risk increases.
- Critical final decisions use the strongest justified model.
- A cheaper model must not be used when expected rework cost exceeds expected savings.

## 3. Required Reading Hierarchy

Read only the context needed for the task, but never omit a relevant authority document to save tokens.

Layer 1 - Permanent Core Context:

- `AGENTS.md`
- `docs/CORE_PRINCIPLES.md`
- `docs/DEVELOPMENT_STANDARD.md`
- `docs/CODEX_DEVELOPMENT_STANDARD.md`

Layer 2 - Architecture Context:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- Current `docs/HANDOFF.md`
- Relevant `docs/ROADMAP.md` section

Layer 3 - Subsystem Context:

- Relevant subsystem specifications
- Relevant contracts, repositories, engines, tests, exports, and documentation
- Dependency subsystems that the task reads from, writes to, translates into, or validates against

Layer 4 - Task Context:

- Task goal
- Unique business rules
- Approved scope
- Deliverables
- Unique validation requirements
- Prohibited work

Layer 5 - Evidence Context:

- Exact Git state
- Relevant commit references
- Prior task output only when needed to avoid conflict, preserve continuity, or validate a milestone

Do not read every specification by default. Load dependency-relevant subsystem context. Uncertainty must cause targeted inspection, not guessing. Duplicate prompt text should be replaced by a version-controlled rule only after that rule exists and is unambiguous.

## 4. Context-Loading Policy

Use the smallest context set that preserves correctness.

- Start with repository state and the required reading hierarchy for the task type.
- Inspect package scripts, existing tests, exports, and local patterns before editing.
- Prefer targeted searches and direct file reads over loading broad unrelated history.
- Load current handoff when it contains active project state.
- Load specification files only for subsystems touched by the task or by dependency boundaries.
- Load prior task output only when current state or milestone continuity depends on it.
- If required context is missing, stop or perform targeted inspection before deciding.

## 5. Architecture-First Behavior

Architecture is the source of truth for system ownership and boundaries. Implementation follows architecture; code does not silently redefine architecture.

Before implementing or documenting a subsystem, confirm:

- Which system owns the source of truth.
- Which systems are only references or consumers.
- Whether the change is implemented, planned, or future production work.
- Which state transitions are authoritative.
- Whether owner approval, deterministic enforcement, or immutable evidence is required.

Major new subsystems require a specification before implementation. If implementation and architecture conflict, pause and report the conflict instead of hiding it inside code.

## 6. Inspect-Before-Modify Requirement

Before modifying a file, inspect the relevant existing file and nearby patterns. Before modifying source behavior, inspect relevant tests and exports. Before modifying documentation, inspect the documents that should remain consistent.

Do not assume a file is stale or wrong because the task says so. Verify first.

## 7. Change Scope

Alpha prefers small, reversible changes.

- Keep edits focused on the assigned task.
- Do not perform unrelated refactors.
- Do not rename, move, or reformat files unless required by the task.
- Do not modify unrelated source, package, configuration, Python, portfolio, risk, decision, trade, provider, network, credential, or runtime-data files.
- Preserve existing working code and tests.
- Report any unexpected dirty working-tree state before changing overlapping files.

## 8. Deterministic Software Before AI

Never use AI when deterministic software can solve the task more accurately, faster, and cheaper.

AI may advise, summarize, classify, or draft. Deterministic Alpha systems perform calculations, validation, budget enforcement, source-of-truth persistence, accounting, reservation state, risk constraints, decision gates, and capital controls.

AI output is advisory and cannot approve owner decisions, mutate capital state, execute trades, bypass validation, or replace deterministic enforcement.

## 9. Provider-Independent Boundaries

Business logic must not depend on OpenAI, Claude, Gemini, or any specific provider.

- Provider SDKs belong only in future owner-approved production adapter tasks.
- Router, budget, ledger, audit, prediction, research, journal, strategy, and development-validation logic must use provider-neutral contracts.
- Provider display names must not define business behavior.
- No production provider adapter, credential path, health polling, network transport, live model call, or billing ingestion may be introduced without a dedicated specification and owner approval.

## 10. Python and TypeScript Boundaries

The Python prototype/runtime and TypeScript foundations are currently not integrated into one application runtime.

- Do not modify Python business logic unless the task explicitly approves it.
- Do not make TypeScript code mutate Python portfolio, risk, decision, or trade state unless a reviewed integration design exists.
- Do not make Python invoke TypeScript AI infrastructure as part of a documentation or infrastructure-standard task.
- TypeScript local NDJSON repositories are single-process development persistence unless a future production persistence task says otherwise.

## 11. Runtime-Data, Credential, and Secret Boundaries

Runtime data is not source code.

- Do not commit local ledger, audit, prediction, journal, research, strategy, or development-validation runtime data.
- Keep runtime data beneath Git-ignored `data/runtime/` paths.
- Do not add credentials, API keys, tokens, private keys, `.env` files, or secret-bearing metadata.
- Do not store raw provider payloads, raw prompts containing sensitive data, raw copyrighted content archives, or secrets in audit or validation records.
- Secret-scan warnings must be investigated and either fixed or explicitly reported.

## 12. Repository Conventions

Use existing Alpha patterns before adding new ones.

- TypeScript contracts live under `src/contracts/`.
- Deterministic engines live under `src/engines/`.
- Repository ports and local implementations live under `src/repositories/`.
- Specifications and milestone documents live under `docs/`.
- Local runtime persistence lives under Git-ignored `data/runtime/`.
- Tests remain deterministic and network-free.
- Commands in `package.json` must remain individually accessible when a bundle script is added.

## 13. Append-Only Conventions

Append-only repositories preserve historical truth.

- Do not add update, overwrite, or delete paths to append-only evidence systems unless a later approved specification changes the authority model.
- Corrections append new evidence; they do not rewrite prior records.
- Repository-assigned sequence is authoritative for local event ordering.
- Local NDJSON persistence is development storage, not production durability, encryption, signing, or cross-repository transaction safety.

## 14. Test Requirements

Run tests in proportion to risk and scope.

- Documentation-only changes still require typecheck and aggregate tests when milestone validation asks for them.
- Source changes require focused tests for changed subsystems.
- Shared contract, repository, export, or integration changes require dependency-subsystem tests.
- Major infrastructure changes require aggregate tests.
- Any omitted test must be reported with the reason and residual risk.

## 15. Validation Standard

Use this validation ladder unless the task gives a stricter standard:

1. Required-file and repository-state verification
2. TypeScript strict typecheck
3. Changed-subsystem focused tests
4. Dependency-subsystem focused tests
5. Aggregate suite
6. Documentation, path, link, and fence checks
7. Provider, network, API, and credential scan
8. Python and unrelated-business-change scan
9. Runtime-data tracking scan
10. Secret-metadata scan
11. Merge-marker scan
12. `git diff --check`
13. Final Git status

A task may omit a step only when the step is irrelevant, unsafe, impossible in the current environment, or replaced by a stricter equivalent. The final report must state the omission and reason. Existing validation requirements must not be reduced for token savings.

## 16. Documentation-Update Requirements

Update documentation narrowly when a task changes architecture, implementation status, test totals, production limitations, milestone history, or owner-approved workflow.

Keep documentation clear about:

- Implemented behavior
- Planned but not implemented behavior
- Future production work
- Known limitations
- Current validation baseline
- Commit and milestone references when relevant

Do not broadly rewrite unrelated documentation.

## 17. Owner Review Requirements

Owner authority is never delegated to AI.

AI may prepare summaries, reviews, and recommendations. Only the owner can approve architecture direction, production risk changes, capital-control logic, commits, pushes, pull requests, production adapters, credential integration, or execution integration.

Commit/push tasks must use an explicit owner approval or task instruction authorizing those actions.

## 18. Git Commit and Push Rules

- Do not commit automatically.
- Do not push automatically.
- Do not create or merge pull requests without owner approval.
- Show or summarize the diff before approval when the task has not already granted commit authority.
- Keep commits focused and use the exact requested message when provided.
- After commit or push, verify local and remote refs when requested.

## 19. Final Report Requirements

Default final-report structure:

1. Repository State Verification
2. Inspection Summary
3. Problem Solved
4. Architecture Alignment
5. Files Created
6. Files Modified
7. Implementation Summary
8. Tests Run
9. Test Results
10. Risks
11. Assumptions
12. Recommended Next Step
13. Git Status

Task-specific additions are allowed. Reports should be concise and evidence-based. Do not repeat the entire task specification.

## 20. Environment Warning Versus Code Failure

Separate environment warnings from code failures.

Examples of environment warnings:

- Shell-specific quoting issue corrected without changing repo state
- Dependency cache or local install issue resolved without source changes
- Network unavailable for a task that does not require network

Examples of code failures:

- Typecheck failure
- Test failure
- Broken documentation link
- Runtime data tracked by Git
- Provider SDK added outside approved scope
- Credential or secret detected

Warnings must be reported. Code failures must be fixed or explicitly accepted by the owner before commit.

## 21. Model-Selection Guidance

Model choice must be task-based and provider-independent.

Use the strongest available model with high reasoning for:

- Architecture
- Capital or risk rules
- Trading lifecycle design
- Security and privacy
- Cross-system integration
- Critical owner review
- Complex defect diagnosis

Use a balanced model with medium reasoning for:

- Isolated subsystem implementation
- Well-specified contracts
- Deterministic repositories
- Tests
- Narrow documentation reconciliation

Use a smaller model for:

- Git status checks
- Formatting
- Mechanical documentation updates
- Repetitive validation execution
- Simple file inventory

Escalate when ambiguity or risk increases.

## 22. Token and Context Optimization Rules

Future prompts may be shorter when stable rules are referenced by path and the unique task scope is clear.

Allowed optimizations:

- Reference this standard instead of restating stable Codex workflow rules.
- Reference `docs/CODEX_TASK_TEMPLATE.md` instead of restating common task sections.
- Reference `docs/OWNER_REVIEW_TEMPLATE.md` instead of restating owner-review criteria.
- Load only relevant subsystem specs rather than every spec.
- Summarize repeated validation requirements as "standard validation ladder" plus task-specific additions.

Not allowed:

- Omitting relevant authority documents.
- Omitting validation because a prompt is shorter.
- Guessing instead of targeted inspection.
- Compressing ambiguous capital, risk, security, provider, or architecture requirements.
- Treating a prior chat summary as more authoritative than repository files.

## 23. When a Full Explicit Prompt Is Required

Use a full explicit specification for:

- Capital-control logic
- Risk constraints
- Trading lifecycle
- Financial arithmetic
- Irreversible migration
- Production provider integration
- Credential or security architecture
- Cross-runtime transaction design
- Major architectural changes
- Ambiguous new domains

Full prompts are also required when owner approval conditions, safety boundaries, or deliverables are not yet version-controlled.

## 24. When a Compressed Prompt Is Sufficient

A compressed prompt is sufficient when:

- Stable rules are already version-controlled.
- The task has a clear ID, mode, goal, scope, deliverables, and prohibited work.
- Relevant authority documents are named by path.
- Validation can reference the standard ladder plus explicit additions.
- The task does not change capital control, risk, trading lifecycle, security architecture, production provider integration, or major system ownership.

Example compact protocol:

```text
Task:
D6-T2 Python/TypeScript Boundary v2

Mode:
Specification

Follow:
docs/CODEX_DEVELOPMENT_STANDARD.md
docs/CODEX_TASK_TEMPLATE.md

Unique requirements:
- Define the runtime boundary between Python prototype and TypeScript foundations.
- Preserve deterministic capital controls.

Do not:
- Modify source code.
- Add provider, network, credential, broker, or live-market integration.

Return:
Standard report plus boundary risks and recommended next step.

Do not commit or push.
```

## 25. Failure and Escalation Behavior

Fail closed when a requirement, authority boundary, or validation result is unclear.

- Stop and report exact state if required baseline verification fails.
- Fix in-scope failures before reporting success.
- Ask for owner direction when a fix requires new authority or materially different scope.
- Do not hide skipped validation, warnings, or dirty-tree conflicts.
- Do not continue into the next task unless explicitly instructed.

## 26. Validation Bundle

`npm run alpha:validate` runs a deterministic local validation bundle when available. It must use no network, provider SDK, credentials, runtime-data mutation, hidden commit, or hidden push.

The bundle is a convenience wrapper, not a replacement for task judgment. Component commands remain individually accessible, and task-specific validation additions must still be run and reported.
