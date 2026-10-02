# Alpha Event Intelligence & Point-in-Time Replay V1 — Reuse Matrix

Baseline: `alpha-live-acceptance-rc1-20261001` / `c18d03f`

This milestone reuses existing Alpha components where their semantics match. It does not create a parallel second trading system.

| Existing component | Reuse | V1 role | Gap / change |
| --- | --- | --- | --- |
| OptionsMarketExpectation | HIGH | Scheduled pre-event expectation evidence | Preserve forecast classes and frozen clocks; add direct binding into replay cases |
| options-event-facts | HIGH | Verified event facts projection | Must remain distinct from interpretation/hypothesis |
| Source Comparison | HIGH | Fact/source reconciliation | Replay needs as-of visibility and immutable correction history |
| Storyline | MEDIUM | Mechanism context | Must not become causal attribution |
| Focused News | HIGH | Public-source observations | Add point-in-time case binding; professional feed remains a later source integration |
| Existing component | Reuse | V1 role | Gap / change |
| --- | --- | --- | --- |
| EventReplayEngine | MEDIUM | Repository/lifecycle design reference | Current engine reconstructs historical evidence but lacks receivedAt/generation-time visibility semantics |
| OptionsHistoricalReplay | LOW/MEDIUM | Historical comparison only | Cannot satisfy prospective pre-event acceptance by itself |
| Prediction Evidence | HIGH | Immutable decision-input pattern | Current projection is not the Replay Console historical decision artifact |
| Decision Evidence | HIGH | Immutable decision pattern | Bind historical generatedAt/cutoff/version rather than recomputing current UI state |
| Context Cutoff | HIGH | Point-in-time filtering pattern | Extend from context cutoff to evidence + decision visibility |
| MarketExpectation fixtures | TEST ONLY | Scheduled program tests | Synthetic data cannot satisfy real-case acceptance |
| Existing option strategy engines | FROZEN | Downstream consumer after V1 | No strategy expansion during this milestone |
## Do not reuse without semantic correction

### EventReplay confidenceScore

The legacy EventReplay `confidenceScore` measures evidence-bearing event coverage. It must not be displayed as thesis probability or decision confidence in this V1.

### Current-state recomputation

Workbench current state may change after a historical decision. V1 must verify frozen decision artifacts directly rather than compare them with today's recomputed state.

### Historical hindsight

Old news, bars and documents can support LIMITED_RETROSPECTIVE_REPLAY, but they cannot be labeled as prospective pre-event state unless Alpha actually recorded them before the event.
## Worktree isolation

Implementation branch:
`codex/event-intelligence-replay-v1`

Implementation worktree:
`C:\projects\Alpha-event-intelligence-v1`

Do not implement V1 in:
- dirty `C:\projects\Alpha` main worktree
- dirty decision-plan-draft worktree
- legacy Phase 2 worktrees

Those worktrees may be read for reusable ideas only. RC1 stays unchanged while V1 is developed.
