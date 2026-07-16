# Alpha Development Standard

This document defines the official software engineering standard for Alpha. It exists to keep development consistent, reviewable, cost-aware, and aligned with the long-term direction of the project.

Version: 1.0
Revision date: 2026-07-15

## 1. Architecture First

Architecture is the source of truth for technical structure and system boundaries.

Implementation must follow the documented architecture. If implementation conflicts with architecture, the architecture must be reviewed before code changes are made. Code should not redefine system behavior or ownership boundaries without an explicit architecture update.

## 2. AI-Native Development

Alpha uses an AI-native development workflow:

Owner
|
v
ChatGPT (Architect)
|
v
Codex (Engineer)
|
v
Review
|
v
Owner Approval
|
v
Git Commit
|
v
Git Push

Roles:

- Owner: Sets priorities, approves direction, and authorizes commits and pushes.
- ChatGPT (Architect): Translates goals into architecture, task design, acceptance criteria, and implementation guidance.
- Codex (Engineer): Implements approved tasks, validates changes, and reports results.
- Review: Confirms that changes match requirements, architecture, and quality standards.
- Owner Approval: Required before committing, pushing, merging, or changing project direction.
- Git Commit: Records a small, focused, approved change.
- Git Push: Publishes approved committed work to the remote repository.

## 3. AI Dispatch Card

Every implementation task should include an AI Dispatch Card with:

- Task ID
- Title
- Recommended Model
- Reasoning Level
- Complexity
- Estimated Time
- Expected Cost
- Files Allowed
- Restrictions
- Acceptance Criteria

Model selection should balance quality and cost. Use the lowest-cost model capable of producing the required quality for the task.

## 4. Git Safety

- Never auto commit.
- Never auto push.
- Owner approval is required before commits, pushes, merges, or pull requests.
- Always review diffs before requesting approval.
- Keep commits small and focused.
- Do not mix unrelated changes in one commit.

## 5. Documentation Rules

Each project document has a distinct responsibility:

- README.md: Provides the project introduction, setup guidance, and high-level entry point.
- ARCHITECTURE.md: Defines system structure, boundaries, components, and technical direction.
- CORE_PRINCIPLES.md: Defines the durable principles that guide product and engineering decisions.
- ROADMAP.md: Tracks planned direction, major milestones, and future work.
- DECISIONS.md: Records important business, product, and architecture decisions.
- CHANGELOG.md: Records meaningful changes to behavior, business logic, and system capabilities.
- HANDOFF.md: Captures current project state, active context, and work needed by the next contributor.
- AGENTS.md: Provides operating instructions for AI coding agents.

Documentation should stay concise, accurate, and aligned with the current project state.

## 6. Business Rule Protection

Business logic changes must be documented. When business logic changes, both of the following must be updated:

- DECISIONS.md
- CHANGELOG.md

This protects the reasoning behind business behavior and preserves a clear history of functional change.

## 7. Cost Awareness

Always use the lowest-cost AI model capable of producing the required quality.

Avoid using stronger models when unnecessary. Higher-cost models should be reserved for tasks that require deeper reasoning, broader context, higher risk analysis, or more complex implementation judgment.

## 8. Maintainability First

Never optimize for cleverness.

Optimize for maintainability.

Readable, understandable, and predictable systems are preferred over clever implementations. Alpha is intended to compound over time, so long-term maintainability matters more than short-term novelty.

## 9. Evidence Before Confidence

Never claim success without evidence.

Whenever practical, provide:

- Commands executed
- Tests performed
- Results obtained

If validation cannot be performed, explain exactly why and identify the remaining risk.

## 10. One Source of Truth

Alpha uses clear sources of truth:

- GitHub = Source of Truth for code.
- Documentation = Source of Truth for project vision.
- Configuration = Source of Truth for runtime behavior.

Changes should respect the correct source of truth and avoid duplicating authority across files or systems.

## 11. Continuous Improvement

This standard is versioned. Future improvements should update:

- Version number
- Revision date
- Summary of changes

Updates should be intentional, reviewed, and aligned with the long-term needs of the Alpha project.

