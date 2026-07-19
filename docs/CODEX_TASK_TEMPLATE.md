# Codex Task Template

Use this template for future Alpha tasks. Keep stable workflow rules in `docs/CODEX_DEVELOPMENT_STANDARD.md`; do not restate them unless the task needs an exception or stricter rule.

## Task Header

```text
Task ID:
[D#-T# or milestone ID]

Mode:
[Implementation | Documentation | Review | Commit/Push | Investigation | Specification]

Goal:
[One concise outcome]

Problem solved:
[What pain, risk, missing capability, or inefficiency this addresses]

Expected value:
[Why this is worth doing now]

Implementation cost:
[Low | Medium | High, with one sentence]

Operating cost:
[Low | Medium | High, including AI/provider/runtime cost if relevant]

Build-now/backlog decision:
[Build now | Specify only | Backlog, with reason]

Recommended model:
[Task-based model class, not permanent provider dependency]

Recommended reasoning effort:
[Low | Medium | High, with reason]

Expected complexity:
[Low | Medium | High]

Expected token intensity:
[Low | Medium | High]
```

## Stable Rules

```text
Follow:
docs/CODEX_DEVELOPMENT_STANDARD.md
docs/CODEX_TASK_TEMPLATE.md
[Add subsystem specs or authority docs needed for this task]
```

## Unique Scope

```text
Unique required reading:
- [Only task-specific authority docs beyond the standard hierarchy]

Unique scope:
- [What may be changed]

Deliverables:
- [Files, behavior, docs, tests, reports]

Unique business rules:
- [Rules not already covered by version-controlled standards]

Prohibited work:
- [Out-of-scope edits, integrations, refactors, commits, pushes]

Validation additions:
- [Focused tests, scans, docs checks, or commands beyond the standard ladder]

Final-report additions:
- [Extra sections or evidence the owner needs]

Commit/push permission:
- [Not authorized | Commit authorized with exact message | Commit and push authorized]
```

## Task Modes

Implementation:

- Include the approved files or subsystem boundary.
- Include the behavior to add or change.
- Include required focused tests.
- State prohibited source and documentation areas.
- State whether commit and push are not authorized.

Documentation:

- Include exact documents to create or update.
- State the implementation status that must be recorded.
- Require no source-code behavior changes.
- Require path, link, fence, and consistency validation.

Review:

- Ask for findings first, ordered by severity.
- Require file and line references where possible.
- State whether fixes are out of scope.
- Require test gaps and residual risk.

Commit/Push:

- State that owner review is approved.
- State exact commit message.
- Require final validation before commit.
- Require push target.
- Require final clean-tree and local/remote equality checks.

Investigation:

- Require inspection and evidence only.
- Prohibit implementation unless separately authorized.
- Require root cause, options, risks, and recommended next step.

Specification:

- Require architecture and contracts only unless explicitly approved.
- Prohibit implementation, runtime behavior changes, and provider/network/credential additions.
- Require clear implemented/planned/future distinctions.

## Compact Invocation Protocol

Compressed tasks may use this shape when the standard already covers the stable rules:

```text
Task:
[Task ID and title]

Mode:
[Task mode]

Follow:
docs/CODEX_DEVELOPMENT_STANDARD.md
docs/CODEX_TASK_TEMPLATE.md
[Relevant subsystem docs]

Unique requirements:
- [Task-specific requirements only]

Do not:
- [Task-specific prohibitions only]

Return:
Standard report plus [task-specific additions].

[Commit/push permission.]
```

Use a full explicit prompt instead of this compact protocol for capital-control logic, risk constraints, trading lifecycle, financial arithmetic, irreversible migration, production provider integration, credential/security architecture, cross-runtime transaction design, major architectural changes, or ambiguous new domains.
