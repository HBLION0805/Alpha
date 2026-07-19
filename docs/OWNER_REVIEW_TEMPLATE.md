# Owner Review Template

AI may prepare this review, but only the owner can approve. Owner approval is required before commits, pushes, production provider integration, credential integration, execution integration, or changes to capital/risk authority.

## Review Scope

Task ID:

Task title:

Review date:

Prepared by:

Owner reviewer:

Approval decision:

- Approved
- Approved with conditions
- Changes requested
- Rejected

## Architecture Alignment

- Does the change follow `docs/ARCHITECTURE.md`?
- Does it preserve documented subsystem ownership?
- Does it distinguish implemented, planned, and future production work?
- Does it avoid redefining business behavior in code without documentation?

## Problem Solved and Expected Value

- What problem does this solve?
- Why is the change valuable now?
- Is the implementation cost justified by the expected value?
- Does any cheaper or simpler deterministic approach satisfy the need?

## Scope Accuracy

- Files expected to change:
- Files actually changed:
- Unrelated files changed:
- Source behavior changed:
- Documentation changed:
- Package/configuration changed:
- Runtime data changed or tracked:

## Business-Rule Verification

- Capital controls preserved:
- Risk constraints preserved:
- Trading lifecycle preserved:
- Owner execution authority preserved:
- AI advisory-only boundary preserved:
- Deterministic software used where appropriate:

## Authority-Boundary Verification

- Provider-independent boundary preserved:
- No provider SDK added:
- No production adapter added:
- No network/API code added:
- No credentials or secrets added:
- Python/TypeScript runtime boundary preserved:
- Runtime-data boundary preserved:
- Append-only evidence boundaries preserved:

## Test and Validation Verification

- TypeScript strict typecheck:
- Changed-subsystem focused tests:
- Dependency-subsystem focused tests:
- Aggregate suite:
- Documentation/path/link/fence checks:
- Provider/network/API/credential scan:
- Python and unrelated-business-change scan:
- Runtime-data tracking scan:
- Secret-metadata scan:
- Merge-marker scan:
- `git diff --check`:
- Final Git status:
- Omissions and reasons:

## Risks

- Remaining technical risks:
- Remaining product risks:
- Remaining production limitations:
- Accepted risks:
- Required follow-ups:

## Assumptions

- Assumption:
- Evidence:
- Invalidation condition:

## Technical Debt

- New debt introduced:
- Existing debt reduced:
- Existing debt unchanged:
- Backlog recommendation:

## Production Limitations

- Local-only persistence:
- No production transaction boundary:
- No encryption/signing:
- No live provider integration:
- No live market-data integration:
- No broker/execution integration:
- Other limitations:

## Approval Conditions

- Required fixes before commit:
- Required documentation updates:
- Required validation reruns:
- Required follow-up task:
- Commit message authorized:
- Push target authorized:

## Commit Authorization

Commit authorized:

Exact commit message:

Push authorized:

Remote/branch:

## Next Task

Recommended next task:

Explicitly not started:

Owner notes:
