# Alpha Architecture Decisions

## 2026-07-18 - Deterministic AI Cost Governor Boundary

### Integer Monetary Enforcement

- Decision: AI cost policy is evaluated in non-negative safe integer minor units under one declared currency and scale.
- Context or problem: Floating-point arithmetic and mixed currencies can make exact budget boundaries ambiguous.
- Rationale: Integer arithmetic makes equality, remaining budget, reservations, and audit values deterministic.
- Consequences: The Router boundary converts major-unit estimates once using a 1,000,000-unit scale; invalid, unsafe, or currency-mismatched values fail closed.

### Reservation and Persistence Separation

- Decision: The foundation returns a reservation plan and defines a ledger repository port but performs no persistence or provider execution.
- Context or problem: Reliable concurrent budget enforcement requires transactional reservation storage and reconciliation that do not yet exist.
- Rationale: Separating pure evaluation from atomic acquisition keeps policy testable while making the future consistency boundary explicit.
- Consequences: An allowed plan is not permission to execute until a future coordinator atomically reserves it. Live usage ingestion, durable audit, commit, release, and expiry are separate reviewed work.

### Router Integration Boundary

- Decision: Router estimates and aggregate usage are translated through a provider-neutral mapping boundary before governor evaluation.
- Context or problem: Directly embedding budget persistence or provider concerns in the Router would couple planning, enforcement, and execution.
- Rationale: A narrow mapping preserves existing Router behavior and lets both engines evolve behind stable contracts.
- Consequences: Core business logic depends only on neutral contracts; future provider or ledger implementations do not change capital-domain rules.

## 2026-07-18 - Deterministic AI Router Planning Boundary

### Provider-Independent Selection

- Decision: The AI Router planning engine evaluates provider-neutral profiles using hard eligibility constraints followed by deterministic, stable ordering.
- Context or problem: Alpha needs to balance capability, privacy, reliability, latency, context, and cost without coupling business logic to a provider or introducing random routing.
- Rationale: Provider-neutral contracts and explicit rejection and ranking rules allow providers and models to be replaced through configuration while keeping every selection reproducible and auditable.
- Consequences: Provider display names never affect selection, all rejected candidates retain normalized reasons, and identical request, configuration, budget, and clock snapshots produce identical decisions.

### Planning and Execution Separation

- Decision: The minimum Router Engine ends after returning a routing decision, fallback plan, and audit record.
- Context or problem: Combining selection with provider execution would introduce SDK, credential, network, retry, and persistence concerns before the deterministic boundary is proven.
- Rationale: A planning-only engine is easier to validate and preserves the architecture rule that provider adapters remain replaceable infrastructure.
- Consequences: The engine performs no network calls, model invocation, retries, audit persistence, or business action. Those capabilities require separate reviewed tasks.

## 2026-07-16 - Architecture Consistency Review

### Prediction Freeze Placement

- Decision: Finalize and freeze prediction records before the final capital decision and execution.
- Context or problem: Predictions recorded after decisions or execution could be changed with hindsight.
- Rationale: Preserving the original forecast enables an honest comparison between prediction quality, decision quality, execution quality, and outcomes.
- Consequences: Later evidence must be stored as a linked amendment or resolution and must not rewrite the original prediction.

### Decision Engine Ownership

- Decision: Specialized systems own opportunity evaluation, prediction records, instrument ranking, and risk constraints. The Decision Engine combines those outputs and owns the final capital decision and approved trade plan.
- Context or problem: Broad Decision Engine responsibilities overlapped with specialized systems and made ownership unclear.
- Rationale: Explicit boundaries prevent duplicated logic and preserve independent evaluation stages.
- Consequences: The Decision Engine coordinates validated outputs but does not replace upstream evaluation or Risk Engine enforcement.

### Execution Boundary

- Decision: Execution remains external and owner-controlled. Future broker integration must not bypass owner approval, the frozen trade plan, or Risk Engine limits.
- Context or problem: Alpha is a decision-support system, and execution authority must remain explicit.
- Rationale: Owner control and deterministic risk enforcement protect capital and prevent unauthorized automated execution.
- Consequences: Execution automation requires separate approval and must preserve the existing approval and risk boundaries.

### Learning and Strategy Approval

- Decision: The Learning Loop proposes improvements, Strategy Versioning reviews changes, and the owner approves activation or rollback. Automatic production strategy replacement is prohibited.
- Context or problem: Learning outputs must not silently alter active production strategies.
- Rationale: Separating proposal, review, and approval protects historical integrity and prevents reactive strategy changes.
- Consequences: Old strategy versions remain available, and every activation or rollback requires an auditable owner approval.

### Implementation Order

- Decision: Define deterministic record and storage contracts before implementing the new intelligence and learning systems. Add AI Router integration only after deterministic boundaries are stable.
- Context or problem: Implementing orchestration before stable system contracts would create unclear dependencies and provider coupling.
- Rationale: Deterministic contracts provide reliable ownership, validation, storage, and enforcement boundaries.
- Consequences: Record schemas and storage behavior are the next architecture task; AI routing remains downstream work.
