# Alpha Architecture

> Alpha System Architecture

---

# Vision

Alpha is a Personal Capital Operating System designed to help protect, allocate, grow, and compound capital over the long term.

Alpha is not a trading bot.

Alpha is not an automatic execution system.

Alpha is a decision-support platform that helps its owner make disciplined financial decisions.

---

# Mission

The permanent mission of Alpha is to use strictly risk-controlled short-term
decision support to build capital, progressively transfer approved profits
into long-term ownership of quality stocks, compound that capital, and
ultimately support financial freedom.

- Capital protection
- Intelligent allocation
- Disciplined execution
- Continuous learning
- Long-term compounding

Short-term trading exists only to support long-term investing.

---

# System Philosophy

Protect Capital
|
v
Allocate Capital
|
v
Grow Capital
|
v
Compound Capital

---

# Core Architecture

Alpha consists of the following major systems.

## Current Runtime Boundary

TypeScript is Alpha's only product runtime and owns product orchestration,
validation, decision support, and the planned unified short-term Risk
Authority.

- The TypeScript core contains product contracts, deterministic engines,
  repository ports, validation, provider boundaries, and application
  integration foundations.
- Python contains historical portfolio, dashboard, decision, and risk
  prototypes. It is restricted to research, prototype work, and statistical
  validation. The sample terminal Dashboard is deprecated as a product entry.

The TypeScript application layer may invoke the registered
`risk.calculate_limits` Python operation only as a compatibility/research
calculation through the versioned read-only boundary. That operation is not
product Risk Authority. No product consumer may treat Python output as an
approval to allocate or risk capital. Python does not invoke TypeScript and
cannot mutate TypeScript product decisions, journal records, or capital state.

## Phase 1A Operational Boundary

Commit `574a9c2c0329bdb87a94b19ad4517be562c37aa6` is the implementation source
baseline; it is not represented as the current HEAD after Phase 1A changes.
Phase 1A is offline-only. The Owner may run `alpha:daily-scan` only in
`dry-run` or `fixture` mode; `live-readonly` fail-closes before any transport
or credential path. Network, Broker, Paper Trading, and Order Execution are
closed. T3B15-C5 and the audit packet remain excluded in the frozen original
worktree.

Phase 1A-C3 separates current Quote authority from completed-session Bar
authority. Quotes are evaluated by wall-clock age at Snapshot `asOf`.
Intraday timeframe endpoints must be two distinct, strictly ordered,
finalized Bars in the exact Snapshot-selected completed session. `P1D` uses
the immediately prior completed session plus the selected completed session,
because one daily Bar cannot occur twice in one session. Source Bar freshness
remains visible metadata and cannot override the explicit exchange-calendar
and completed-window proof.

## Phase 1B-D2 Offline Authorization Boundary

Phase 1B remains `NOT_STARTED`. D2 adds only offline contracts and deterministic
preflight validation for a future, single-use Owner-authorized market-data
read. The signed authorization body binds an exact five-request plan; its
approval envelope is verified with an actual Ed25519 public key supplied by
pinned product configuration or a trusted external verifier. Manifest key IDs,
fingerprints, and caller-provided keys are not trust roots. If the trusted key
is unavailable, preflight returns
`OWNER_AUTHORIZATION_VERIFICATION_KEY_UNAVAILABLE` before any credential path.

D2-C1 makes this ownership boundary structural. A product composition root
constructs one `OwnerAuthorizationVerifier` from an `OwnerTrustRootProvider`
and captures a defensive copy of the pinned public verification identity.
`LiveReadonlyPreflightInput` contains only `asOf`, Manifest, and Calendar
evidence. It cannot carry a key, fingerprint, key ID, trust source, or
replacement verifier. Unknown input and CLI override fields fail closed. The
factory is a trusted-code assembly boundary, not a business-request option.

D2-C2-R2 makes the no-argument product composition root the only product entry.
It fixes the absent trust-root configuration and unproven Provider authority
inside product assembly; business inputs cannot replace the verifier, key,
fingerprint, authority, or Transport. A physically separate test factory is not
exported by the product barrel. Raw Manifest bodies and caller-forged
`VERIFIED` objects cannot enter the chain. Query fingerprints bind ordering, symbols, windows,
requested limit, feed, currency, adjustment, sort, timeout, response-byte
ceiling, calendar fingerprint, and mapping registry ID/version/fingerprint.
Missing, excess, substituted, reordered, non-final, out-of-window, paginated,
duplicate, ghost, or untraced evidence fails closed with no partial output.
The Transport boundary returns only allow-listed headers, HTTP status,
timestamps, and a bounded raw body. Product code performs parsing,
normalization, provenance, ProviderRequestAttempt, and EvidenceResolution
construction. A single-use dispatch permit increments attempted calls exactly
when a local dispatcher reports one request start; completed calls increment
only after the outer bounded response is accepted. Retry-like second starts are
blocked. These are offline lifecycle-model tests, not evidence that real HTTP
has occurred.

The repository has no authoritative evidence that Alpaca applies `limit=2`
per symbol in a multi-symbol Bars request. The nominal five-request / 36-Bar /
seven-Quote / 43-resolution budget is therefore structural only. The product
path uses product-owned unproven Provider-semantics evidence and returns
`PROVIDER_LIMIT_SEMANTICS_UNPROVEN` before Transport or credential access.
Fixtures cannot override that authority or enter the product live path. Mapping
identity hashes the normalized approved mapping contents and benchmarks, so an
ID/version-preserving semantic change alters the fingerprint. No concrete
Alpaca HTTPS Transport is wired; calendar continuity remains D2-C3 and live
acquisition remains D3.

## Phase 1B-D3A Bars Limit Qualification Boundary

D3A adds one narrow vertical slice, not general market-data acquisition. The
product-controlled flow is signed Owner authorization and signed Exchange
Calendar, one exact `MU,QQQ` daily Bars plan, an exact request validator, a raw
bounded Alpaca HTTPS Transport, strict response validation, and a sanitized
count-only result. The Transport cannot construct Canonical Bars or
`EvidenceResolution`, and the product entry cannot accept caller-controlled
authority or Transport dependencies. Test injection exists only in a
non-exported testing module.

The one request binds method, host, path, symbol order, `1Day`, `limit=2`,
start/end, feed, adjustment, sort, currency, ordinal, timeout, byte budget,
mapping-registry identity and full-content fingerprint, calendar fingerprint,
and request/plan fingerprints. Preflight and credential failures are `0/0`;
dispatch begins at `1/0`; only a fully valid bounded response becomes `1/1`.
Retry, replay, pagination, a second request, partial output, persistence, and
execution are forbidden. Until a separately signed one-shot Manifest is
approved and a real response is observed, Provider limit semantics remain
`UNPROVEN` and the full five-request / 43-evidence plan remains blocked.

Exchange-calendar evidence has an independent version, fingerprint, approval,
producer, authority source, validity window, closure buffer, and explicit
records for trading days, weekends, holidays, early closes, and DST-aware UTC
offsets. D2 performs no credential read, HTTP request, Snapshot construction,
persistence, account access, recommendation, or execution. See
`docs/specifications/PERSONAL_DAILY_SCAN_PHASE_1B_AUTHORIZATION_AND_CALENDAR.md`.

## Python-TypeScript Integration Boundary

Responsible for:

- Preserving a versioned provider-independent request and response contract across runtimes
- Keeping TypeScript consumers independent from Python modules, commands, exceptions, and serialization details
- Restricting invocation to an explicit immutable Python operation registry
- Validating requests and responses on both sides
- Normalizing validation, compatibility, domain, transport, timeout, protocol, and internal failures
- Returning minimal request, operation, duration, status, contract-version, and completion metadata without logging payloads

The initial transport starts a configured Python executable without a shell and always invokes the fixed `app.integration.entrypoint` module. JSON passes through stdin/stdout under bounded timeout and output limits. The transport is replaceable behind a TypeScript port.

The only v1 operation is the read-only deterministic historical Risk Engine
limit summary. The boundary owns translation and validation only. Python owns
that prototype calculation, while the planned TypeScript Unified Short-Term
Risk Authority owns future product approval. There is no dashboard
integration, mutable operation, service deployment, remote network, retry
loop, AI call, provider SDK, credential, broker, live-market source, or
cross-runtime transaction.

## Production Persistence and Recovery

Responsible for:

- Defining future durable repository, transaction, crash-recovery, backup, restore, retention, and integrity requirements
- Preserving the existing development persistence model while making clear that local NDJSON is not production storage
- Requiring transactional or reviewed outbox/inbox boundaries before production workflows depend on multi-repository durability
- Requiring crash-safe execution claims before any live provider, broker, market, or other external side effect can be enabled
- Keeping repository persistence beneath provider-neutral ports without moving domain logic into storage

D6-T2 defines this architecture in `docs/PRODUCTION_PERSISTENCE_RECOVERY_SPECIFICATION.md`. It does not implement a database, change local repositories, change runtime behavior, add provider/network/credential integration, or begin D6-T3.

## Portfolio System

Responsible for:

- Authoritative portfolio and cash state
- Applying only separately approved future capital-state changes
- Portfolio tracking
- Cash management
- Asset distribution

The Portfolio System does not calculate the Day14 Capital Allocation Recommendation. The Capital Allocation Framework reads an immutable portfolio reference and cannot mutate Portfolio state.

---

## Capital Bucket Compatibility

The product capital model must support three independently accounted buckets:

- `OPERATING_CAPITAL` funds separately approved short-term activity.
- `LONG_TERM_COMPOUNDING_CAPITAL` holds capital transferred for long-term
  quality-stock ownership and compounding.
- `CASH_RESERVE` remains outside short-term risk availability.

Existing `capital_usd` inputs are legacy single-balance inputs. They must not be
silently classified as operating capital. A later versioned migration requires
an explicit Owner-approved allocation, preserves the original amount and
provenance, and enforces that short-term risk can consume only
`OPERATING_CAPITAL`. Transfer percentages, thresholds, and automation are not
defined or authorized in Phase 0. Automatic allocation, migration, and
transfer are prohibited.

---

## Dashboard

Responsible for:

- Daily overview
- Opportunity monitoring
- Portfolio status
- Risk status

---

## Decision Engine

Responsible for:

- Combining research, opportunity, prediction, instrument, and risk outputs
- Producing the final capital decision
- Producing and preserving the final decision record
- Producing an approved trade plan when action is justified

The Decision Engine does not replace the specialized evaluation systems. It coordinates their outputs and may return WAIT, Cash, or NO TRADE.

---

## Config System

Responsible for:

- Global configuration
- Strategy settings
- Risk parameters
- System options

---

## Risk Engine

Responsible for:

- Position sizing
- Maximum daily loss
- Portfolio exposure
- Capital preservation

The future product authority is a single TypeScript Unified Short-Term Risk
Authority shared by ETF and Event candidates. The Owner-approved Phase 0
record is versioned but not enforced: ETF maximum planned loss `$8`, Event
maximum cost risk `$5`, daily maximum loss `$20`, weekly maximum loss `$40`,
total drawdown pause `$80`, initial leveraged-ETF position limit `10%` of
capital, and one concurrent short-term theme. Implementing or wiring these
rules requires a later separately approved phase. The record grants no
recommendation, position-sizing, order, Paper Trading, or execution authority.

---

## Research Framework

Responsible for:

- Research methodology
- Evidence and source standards
- Separation of verified facts, inferences, assumptions, and unknowns
- Scenario and confidence requirements
- Research report structure

---

## Opportunity Score Engine

Responsible for:

- Evaluating opportunity quality
- Determining whether an opportunity deserves further consideration
- Tracking opportunity state and confidence
- Advancing, waiting, rejecting, or archiving opportunities

The Opportunity Score Engine evaluates the opportunity itself. It does not select an execution instrument.

---

## Instrument Ranking Engine

Responsible for:

- Comparing eligible execution instruments
- Evaluating execution quality and holding-period suitability
- Ranking instruments by capital protection, risk-adjusted return, and execution quality
- Returning WAIT or Cash when no instrument is suitable

---

## AI Infrastructure v1 Flow

```text
Provider-neutral advisory request
  -> AI Router
  -> AI Cost Governor
  -> AI Reservation Manager
  -> AI Cost Ledger reservation append
  -> Unified Audit pre-execution evidence
  -> AI Execution Coordinator
  -> AI Provider Adapter boundary
  -> Reservation settlement
  -> Cost Ledger settlement and reconciliation
  -> Unified Audit final trace
```

Router selects models deterministically. Cost Governor decides whether AI operating cost is permitted. Reservation Manager owns current reservation state. Cost Ledger is the monetary source of truth for historical AI cost events. Unified Audit Repository is the evidence-ordering and trace-integrity source of truth. Runtime Workflow coordinates these authorities without replacing them.

The current adapter boundary has no production adapter, SDK, credentials, network transport, or live model call. Neutral test fixtures prove the contract only. AI output remains advisory and cannot approve or mutate portfolio, risk, decision, trade, or strategy state.

---

## AI Router

Responsible for:

- Deterministically planning the most appropriate eligible AI model
- Balancing capability, cost, and speed
- Remaining provider-independent
- Supporting future AI models without redesign

The current Router stops at selection, fallback planning, and in-memory audit generation. It does not call providers.

---

## AI Cost Governor

Responsible for:

- Deterministically evaluating estimated AI cost before execution
- Enforcing versioned per-request, daily, monthly, task, provider, and model budgets
- Accounting for committed and reserved usage
- Requiring low-cost mode at soft thresholds and rejecting hard-limit breaches
- Returning bounded critical-override decisions, reservation plans, and audit records

The AI Cost Governor is provider-independent and uses integer minor-unit arithmetic. It returns plans but does not acquire reservations, ingest live usage, or call providers.

---

## AI Reservation Manager

Responsible for:

- Atomically acquiring an approved Cost Governor reservation plan in one repository boundary
- Applying versioned commit, partial commit, release, expiration, cancellation, and rejection transitions
- Enforcing idempotency, amount conservation, currency identity, and optimistic concurrency
- Returning append-only Cost Ledger instructions and complete in-memory audits
- Providing a deterministic in-memory repository for tests and local use

The manager does not approve cost, route, execute AI, call providers, or persist a durable ledger. The in-memory repository is not durable or distributed-safe. A production replacement must preserve the same port while transacting reservation state, operation history, ledger entries, and audit records atomically.

---

## AI Cost Ledger

Responsible for:

- Appending immutable reservation, usage, release, expiration, override, and manual-adjustment accounting events
- Assigning deterministic monotonic accounting sequences independently from caller timestamps
- Preventing duplicate entry, operation, idempotency, and execution-settlement identities
- Returning stable currency-separated queries and usage summaries
- Reconciliation that reports reservation accounting inconsistencies without changing source state
- Providing in-memory and local append-only NDJSON repository implementations behind a durable persistence port

The Cost Ledger is the source of truth for historical AI cost events, while the Reservation Manager remains the source of truth for current reservation state. The local file repository is single-process personal-development storage, not a production transactional database. It contains no prompts, credentials, provider payloads, routing logic, budget approval, or capital-domain state.

---

## Unified Audit Repository

Responsible for:

- Preserving normalized append-only evidence from AI subsystem audit records
- Assigning one deterministic audit sequence independently from source timestamps
- Correlating request, route, budget, reservation, execution, and ledger references
- Reconstructing stable traces and reporting missing, cyclic, or conflicting evidence
- Enforcing privacy-aware in-memory export and retention metadata boundaries
- Providing in-memory and local canonical NDJSON repositories behind a durable port

The Audit Repository is an evidence index, not a business or accounting engine. Source systems retain ownership of their decisions and state, and the AI Cost Ledger remains the monetary source of truth. Local audit persistence is single-process development storage; it contains no raw prompts, credentials, provider-native payloads, network code, or update/delete path.

---

## Development Validation Log

Responsible for:

- Preserving immutable engineering-task records for requested goals, approved scope, inspections, implementation, structured tests, validations, warnings, defects, risks, assumptions, owner review, approval/rejection, Git milestones, handoff, lessons, and follow-ups
- Enforcing deterministic `PLANNED -> IN_PROGRESS -> IMPLEMENTED -> VALIDATED -> OWNER_REVIEWED -> APPROVED -> COMMITTED -> PUSHED -> HANDED_OFF -> CLOSED` evidence ordering with terminal rejected/blocked/cancelled states
- Keeping environment warnings distinct from code failures and requiring explicit owner exceptions for blocking failed validation
- Recording verified branch, base/commit/push/synchronization evidence supplied by a caller without executing or replacing Git
- Providing sequence-ordered queries, task histories, summaries, statistics, privacy-aware export, pure Unified Audit translation, and defensive in-memory/canonical local NDJSON repositories

Git remains the source of truth for code and version history. Unified Audit remains normalized cross-system trace truth. HANDOFF and CHANGELOG remain project-state and released-capability summaries. Alpha Journal remains context/reflection truth. Development Validation Log owns detailed structured engineering-memory evidence only; it stores no full diffs, huge raw logs, or secrets.

The repository exposes no update, overwrite, delete, Git execution, issue creation, provider, network, live-market, broker, capital-state, or Python integration. Local persistence is unencrypted single-owner, single-process development storage. A future, separately approved integration task may define how task reports populate these contracts; that integration is planned and has not started.

---

## Development Efficiency Standard

Responsible for:

- Centralizing repeated Codex implementation, validation, reporting, owner-review, and Git-safety rules
- Defining a context-loading hierarchy so future tasks can use shorter prompts without losing relevant authority documents
- Preserving quality-first model selection, deterministic-software-first behavior, provider independence, runtime-data boundaries, and owner approval authority
- Providing a concise task template, owner review template, and deterministic local validation bundle

The Development Efficiency Standard is documentation and workflow guidance only. It does not modify Python or TypeScript runtime behavior, automate owner approval, populate the Development Validation Log, execute Git commits or pushes, add provider/network/credential integration, or change capital-domain logic.

---

## AI Provider Adapter Boundary

Responsible for:

- Defining provider-neutral execution requests and normalized responses
- Verifying compatibility with an already-selected provider and model
- Reporting provider-neutral capabilities and static health metadata
- Normalizing output, usage, timeout, cancellation, and provider failures
- Registering adapter interfaces deterministically by provider ID

Adapters do not own routing, budget approval, retries, reservation or ledger state, persistence, or business logic. The current foundation contains no production adapter, provider SDK, credential, network call, or health polling.

---

## AI Execution Coordinator

Responsible for:

- Validating Router, Cost Governor, reservation, adapter, health, and trace preconditions
- Invoking exactly one already-selected provider adapter
- Validating normalized output, usage, latency, cost, and reference integrity
- Returning deterministic retry or return-to-Router recommendations
- Returning reservation and usage settlement instructions
- Producing an in-memory execution audit record

The coordinator does not reroute, run retry loops, persist records, mutate reservations or ledgers, or call any production provider. The current foundation uses only neutral test fixtures.

---

## AI Runtime Workflow

Responsible for:

- Coordinating one provider-neutral request through Router, Cost Governor, reservation, accounting, audit, Coordinator, settlement, reconciliation, and final trace validation
- Enforcing deterministic stage ordering, caller-supplied identity, immutable inputs, and fail-closed subsystem boundaries
- Applying at most one explicit low-cost reroute while leaving Router as the only model selector
- Persisting an idempotent in-memory workflow result so replay cannot repeat provider execution or monetary state changes
- Reporting explicit compensation and replay instructions when separate repositories cannot change atomically

The workflow coordinates existing subsystem authorities; it does not own business policy, select hidden fallbacks, recompute accounting truth, repair history, or contain provider integrations. The current foundation uses only injected repositories and neutral fixture adapters. Before live provider use, production design requires a crash-safe durable execution claim plus transactional or reviewed outbox-backed workflow, reservation, ledger, and audit persistence.

---

## Prediction Log

Responsible for:

- Appending deterministic prediction identities and immutable evidence snapshots before outcome
- Enforcing Draft -> Submitted -> Locked -> Outcome Known -> Reviewed -> Archived transitions
- Preserving immutable opportunity, risk, Router, model, configuration, policy, and timestamp decision context
- Appending outcomes and reviews without changing the original forecast
- Measuring prediction accuracy independently from trade profitability
- Providing defensive in-memory and local NDJSON repositories, filtering, statistics, translation, and export
- Supporting later comparison with decisions, trade outcomes, learning, journals, research, and strategy versions through references

The implemented local repository is single-owner, single-process development persistence. It exposes no delete or overwrite path and contains no live market, provider, broker, portfolio, or trade execution integration. Outcome/review compound appends are not a production transaction boundary.

---

## Trade Outcome Log (Planned)

Responsible for:

- Recording completed trade results
- Comparing planned and actual execution
- Separating prediction quality, execution quality, and profitability
- Preserving risk, adherence, attribution, and lesson records

---

## Knowledge Approval and Future Strategy Change Boundary

Responsible for:

- Preserving Candidate Knowledge derived from completed Strategy Reviews without treating it as approved truth
- Enforcing versioned evidence, provenance, sample, compatibility, conflict, and owner-authority gates
- Recording immutable Approved Knowledge plus supersession, deprecation, and revocation history
- Requiring a separate Strategy Change Proposal and normal Strategy Versioning approval before any future strategy change

The architecture is defined in `docs/specifications/KNOWLEDGE_APPROVAL_LAYER.md`. Its governing rule is “No Strategy Change Without Approved Knowledge.” Deterministic checks may block or establish eligibility for owner review, but they cannot approve knowledge. AI may assist drafting and objection discovery but cannot approve, reject, resolve evidence blockers, or mutate strategy. Approved Knowledge is necessary for a future change proposal but does not itself require or authorize a change.

---

## Alpha Journal

Responsible for:

- Preserving immutable point-in-time observations, rationale, assumptions, uncertainty, actions, and expected outcomes
- Appending finalized authoritative entries, amendments, reviews, lessons, and archive history without overwrite or deletion
- Linking Prediction, Research, Decision, Trade, Strategy, Portfolio, Audit, Journal, and Development Validation evidence without taking ownership
- Preserving immutable opportunity, risk, prediction, configuration, strategy, policy, Router/model, market, portfolio, and owner-decision context when available
- Enforcing privacy-aware deterministic query, statistics, summary, export, and Unified Audit translation boundaries
- Providing defensive in-memory and canonical local NDJSON repositories

Drafts are workspace state outside the authoritative repository. Prediction Log remains the prediction source of truth; Journal records explanation, context, reflection, and lessons and cannot mutate predictions or strategies. The local repository is single-owner, single-process development persistence with no encryption, multi-writer safety, or production transaction guarantee.

---

## Strategy Versioning

Responsible for:

- Preserving immutable strategy definitions, version snapshots, semantic lineage, status history, changes, validation, approval, activation, suspension, retirement, and performance evidence
- Enforcing the authoritative `PROPOSED -> VALIDATING -> APPROVED -> ACTIVE -> SUSPENDED -> RETIRED -> ARCHIVED` lifecycle, with explicit owner rejection and no reverse transitions
- Classifying changes as PATCH, MINOR, or MAJOR and validating the exact semantic-version increment against the declared change set
- Linking frozen Research, Prediction, Journal, Decision, Risk, Trade, Audit, Backtest, Validation, and Event Replay references without taking ownership of those records
- Comparing two versions deterministically across behavior, parameters, constraints, risk, evidence, validation, and performance
- Freezing the exact active version, ruleset fingerprint, parameters, risk-policy reference, decision timestamp, and owner approval into a provider-neutral trade-plan contract
- Supporting rollback only by proposing, validating, approving, and activating a new version that explicitly references the trusted and failed versions
- Providing defensive in-memory and canonical append-only local NDJSON repositories, privacy-aware export, statistics, and pure Unified Audit translation

Draft editing remains workspace state outside the authoritative repository. Only the owner may approve or reject a version, activation must be an owner action backed by matching owner approval, and AI can propose or analyze but cannot approve or activate. Suspension, retirement, and rollback use explicit policy/evidence records rather than hidden state changes. One active version per strategy definition is enforced by default. Suspension blocks new plan snapshots but does not rewrite an already frozen snapshot, and retirement never deletes historical evidence.

Strategy Versioning owns strategy truth only. Prediction Log owns prediction truth, Research Lab owns research truth, Alpha Journal owns context and reflection truth, and Unified Audit owns normalized trace truth. This foundation defines a trade-plan freeze contract but contains no trade repository, execution path, broker integration, live market source, provider SDK, network call, credential handling, or Python runtime integration. Local persistence is single-owner, single-process development storage.

---

## Research Lab

Responsible for:

- Preserving immutable point-in-time questions, sources, evidence, assumptions, uncertainty, thesis, conclusions, confidence, and scenarios
- Appending finalized research, amendments, reviews, supersession, and archive history without overwrite or deletion
- Linking Prediction, Journal, Strategy, Portfolio, Audit, Historical Pattern, Research, Decision, Trade, Development Validation, market-snapshot, catalyst, and future Event Replay evidence without taking ownership
- Enforcing deterministic identity, lifecycle, query, statistics, privacy-aware export, and Unified Audit translation
- Providing defensive in-memory and canonical local NDJSON repositories

Draft collection and analysis remain workspace state outside the authoritative repository. Research Lab is research truth, Prediction Log is prediction truth, Alpha Journal is context and reflection truth, and Unified Audit is normalized trace truth. The foundation has no live source retrieval, market-data API, provider integration, or business execution. Local persistence is single-owner, single-process development storage.

---

## Historical Pattern Library

Responsible for:

- Preserving immutable historical events with explicit date precision, categories, regimes, observation windows, asset reactions, source evidence, uncertainty, disputed interpretations, and frozen subsystem references
- Preserving reusable historical patterns as records distinct from their supporting events, with qualifying conditions, causal-mechanism classification, counterexamples, regime dependencies, limitations, invalidation conditions, and minimum support counts
- Keeping historical facts, quantitative observations, source claims, interpretations, inferences, hypotheses, disputed claims, counterevidence, and unknowns structurally distinct
- Appending event/pattern amendments and reviews plus pattern supersession and archive history without update, overwrite, or deletion
- Providing deterministic queries, related-record traversal, pagination, statistics, privacy-aware export, pure Unified Audit translation, and defensive in-memory/canonical local NDJSON repositories
- Freezing stable record/version/status/summary references for Research Lab and future consumers without mutating their records

Historical Pattern Library is historical-event and reusable-pattern truth. Research Lab remains current structured-research truth, Prediction Log remains prediction truth, Alpha Journal remains context/reflection truth, Strategy Versioning remains strategy truth, and Unified Audit remains normalized trace truth.

The library does not fetch historical prices, ingest live data, calculate external market values, compare current events, predict outcomes, backtest, replay timelines, execute providers, or authorize capital decisions. The separate Historical Analogy Engine may read frozen finalized records without modifying historical truth. Event Replay may reference finalized historical records without modifying historical truth. Local persistence is unencrypted single-owner, single-process development storage governed by the production boundary in `docs/PRODUCTION_PERSISTENCE_RECOVERY_SPECIFICATION.md`.

---

## Historical Analogy Engine

Responsible for:

- Freezing caller-supplied current-situation snapshots and exact finalized Historical Event or Historical Pattern candidates
- Applying owner-approved immutable weight profiles and explicit missing-data policies
- Comparing typed dimensions through transparent integer basis-point arithmetic
- Keeping similarity, difference, completeness, evidence quality, candidate quality, and comparison confidence separate
- Reporting strongest similarities, strongest differences, missing dimensions, exclusions, historical outcome observations, regime differences, limitations, bias risks, and invalidation conditions
- Ranking eligible completed comparisons deterministically with stable candidate and analogy identity tie-breaking
- Preserving append-only request, snapshot, profile, result, review, amendment, supersession, archive, query, statistics, export, and Unified Audit evidence
- Providing defensive in-memory and canonical local NDJSON repositories under a Git-ignored runtime path

Historical Pattern Library remains historical truth. Research Lab remains interpretation truth. Prediction Log and Strategy Versioning may later freeze reviewed analogy evidence but are not mutated. Decision Engine cannot treat raw similarity as an automatic decision, and Risk Engine constraints cannot be bypassed.

The engine performs no AI scoring, embeddings, semantic search, vector database, external search, live data retrieval, prediction, trade recommendation, backtest, Event Replay, provider/network call, broker integration, or capital-state mutation. Local persistence is unencrypted single-owner, single-process development storage.

---

## Event Replay Architecture

Responsible for:

- Preserving deterministic historical-event replay timelines from caller-supplied evidence
- Freezing chronological events, observation windows, immutable checkpoints, references, provenance, missing-data policy, completeness, confidence, quality, and limitations
- Creating replay sessions that reconstruct ordered evidence without prediction, execution simulation, strategy optimization, or capital authority
- Linking Historical Events, Historical Patterns, Historical Analogies, Research Lab, Prediction Log, Alpha Journal, snapshots, and source evidence without taking ownership
- Providing defensive in-memory and canonical local NDJSON repositories, privacy-aware export, statistics, lifecycle review/supersession/archive, and pure Unified Audit translation

Event Replay is evidence reconstruction only. Historical Pattern Library remains historical truth, Historical Analogy Engine remains comparison truth, Research Lab remains interpretation truth, and Decision/Risk/Portfolio/Trade systems retain their existing authority. The foundation has no backtesting, trading simulation, live market-data source, provider SDK, network/API code, broker integration, Python runtime integration, or production persistence.

---

## Historical Evidence Product Surface

Responsible for:

- Presenting existing Historical Pattern, Historical Analogy, and Event Replay records through one deterministic read-only response
- Preserving already-recorded strategy, prediction, confidence, limitation, and replay-reference metadata without recalculation
- Reporting unavailable replay timelines explicitly without mutating source records

The product surface is an adapter over existing repository read ports. Historical Pattern Library, Historical Analogy Engine, and Event Replay retain authority. It performs no historical reasoning, ranking, recommendation, AI call, persistence, dashboard presentation, or source-record mutation.

---

## Cross-System Evidence Linking

Responsible for:

- Validating explicit typed links among Prediction, Strategy Version, Historical Pattern, Historical Analogy, Event Replay, Prediction Outcome, and Journal Entry records
- Resolving fixed repository read ports into deterministic, version-aware, read-only link results
- Preserving relation type, source/target identity, resolution status, source status, trace/audit metadata, and explicit missing or unavailable states

Cross-System Evidence Linking is a link resolver, not a graph database, source authority, inference engine, or persistence layer. It follows the dependency direction `authoritative repositories -> narrow read adapters -> linking/product surfaces -> future consumers`. It never discovers relationships from text, uses fuzzy matching, recursively explores a graph, changes domain records, or invokes arbitrary repositories.

---

## Evidence Assessment and Evaluation Layer

This layer consumes explicit evidence links without changing source ownership:

1. Evidence Assessment Foundation is implemented, reviewed, and committed. It calculates published completeness, availability, freshness, consistency, version-compatibility, provenance, and limitation indicators from explicit evidence.
2. Strategy Review Foundation is implemented, reviewed, committed, and pushed. It evaluates one explicitly completed prediction/plan/execution/outcome cycle across separate prediction-quality, execution-quality, risk-discipline, and realized-profitability dimensions. It accepts normalized read snapshots only; a future durable Trade Outcome Log remains required for production outcome authority and multi-cycle performance evaluation.
3. Knowledge Approval Layer separates facts, interpretations, Candidate Knowledge, owner decisions, Approved Knowledge, Strategy Change Proposals, and Strategy Versions. The local D8-T3B foundation implements deterministic eligibility, owner-only decisions, append-only in-memory lifecycle records, a read-only projection, and audit translation; no strategy mutation is authorized.

“No Evidence, No Decision” is the entry gate to downstream decision evaluation. A request must fail closed when required evidence is `INSUFFICIENT`, `CONFLICTING`, or `UNAVAILABLE`; only an explicitly `SUFFICIENT` assessment under a traceable versioned policy may proceed. Sufficiency is necessary but does not itself produce a recommendation or authorize action. Decision evaluation, Risk Engine review, frozen-plan requirements, owner approval, and execution controls remain separate downstream gates.

The Evidence Assessment, Strategy Review, and bounded local Knowledge Approval foundations are committed and pushed. Production persistence, cryptographic authorization, Strategy Change Proposals, AI drafting, and broad retrieval remain unimplemented. AI cannot create facts, override evidence or policy blockers, approve knowledge, activate a strategy, bypass Risk/Decision controls, or authorize capital action. A general-purpose Alpha Memory database is not approved because it would duplicate existing authorities; a future read-only knowledge-retrieval policy requires a concrete consumer and production persistence/privacy review.

---

## Market Data Layer Foundation

D9-T1 adds a quote-first provider boundary: `future provider -> provider adapter -> raw response -> explicit normalization -> deterministic validation -> canonical Market Data result -> future read-only consumers`. Canonical instrument IDs belong to Alpha; provider symbols remain source metadata. Fixed-decimal prices preserve precision, and observation, publication, receipt, normalization, evaluation, and processing times remain distinct.

The layer returns explicit transport, normalization, validation, operation, and quality states. Invalid, incomplete, stale, unavailable, unsupported, out-of-order, or conflicting data fails closed. The foundation adds no live provider, network/API code, credential, persistence, automatic fallback, downstream Evidence/Replay wiring, paper trading, recommendation, Risk/Decision behavior, Dashboard behavior, broker, or execution path. See [Market Data Layer](specifications/MARKET_DATA_LAYER.md).

D9-T2 adds the separate immutable [Provider Registry](specifications/PROVIDER_REGISTRY.md) as the provider-discovery metadata authority. It owns canonical provider identity, status, declared capabilities and asset classes, static discovery priority, default enablement, and documentation references. Adapter descriptors describe implementation compatibility only. The registry holds no adapters, performs no calls, and has no selection, routing, fallback, reflection, AI, or runtime registration path.

Day10-T3B adds a separate immutable composition boundary between registry metadata and runtime adapters. It verifies provider ID, lifecycle/default enablement, declared capability, and asset-class compatibility without making the registry instantiate adapters. One provider may bind distinct Quote and Bar adapters; duplicates fail per provider ID plus capability. `MarketDataService` remains a small compatibility facade over separate Quote and Bar orchestrators. There is no universal provider adapter, automatic provider selection, routing, or fallback.

D9-T3 through D9-T5 complete the Canonical Market Domain with one authoritative [Canonical Instrument](specifications/CANONICAL_INSTRUMENT.md), [Canonical Quote](specifications/CANONICAL_QUOTE.md), and [Canonical Bar](specifications/CANONICAL_BAR.md). Provider symbols are adapter-owned mappings rather than canonical identity. Quote and Bar values remain immutable, fixed-decimal, timestamp-explicit, quality-aware, and provenance-preserving. Bar identity excludes OHLCV content so later corrections can retain logical identity while changing the content fingerprint.

Day 10 External World Integration began with evidence and policy, then committed the [Twelve Data provider-specific fixture adapter foundation](specifications/TWELVE_DATA_ADAPTER.md). Provider authentication, payloads, symbols, limits, and errors remain inside the integration boundary; provider-native schemas are not global shared contracts. Canonical normalization cannot upgrade partial-market data to full-market, infer NBBO, fabricate timestamps or units, or hide unresolved quality. Quote and Bar observation fingerprints exclude local receipt/normalization/evaluation metadata, while logical identity remains stable across provider content corrections.

Day11-T1 adds the narrowly allow-listed [Twelve Data Live Smoke Transport](specifications/TWELVE_DATA_LIVE_SMOKE.md) behind the existing port. It is reachable only through an explicit manual command, defaults to a network-free dry run, requires `--confirm-live-smoke`, accepts only AAPL/PT5M, one request, 10 records, one API credit, and at most one regular trading day, and has no retry, polling, persistence, streaming, scheduling, or downstream domain wiring. Automated validation injects fake executors and makes zero live calls. Because official live equity-volume units remain unresolved, provider transport/parser success cannot yield accepted Canonical Bars.

---

## Market Regime Engine Foundation

Day11-T2 adds one provider-independent [Market Regime Engine](specifications/MARKET_REGIME_ENGINE.md) downstream of canonical observations: `canonical market observations -> immutable regime snapshot -> deterministic fixed-decimal features -> versioned rules -> immutable assessment -> Evidence references / Unified Audit translation`. The engine fetches and normalizes nothing and has no dependency on Twelve Data or another provider.

One primary price-structure regime is reported separately from secondary conditions. `HIGH_VOLATILITY` may coexist with `BULL_TREND`, `BEAR_TREND`, `CORRECTION`, `RELIEF_RALLY`, or `RANGE_BOUND`. `DISTRIBUTION_RISK` and `ACCUMULATION_CANDIDATE` require verified volume-unit semantics and verified breadth evidence; price alone cannot produce them. Evidence strength describes deterministic coverage, never probability or expected profitability.

The engine emits no signal, recommendation, plan, risk override, position size, portfolio mutation, or execution instruction. Missing observations, stale/rejected quality, unresolved canonical identity, contradiction, or missing source evidence fails closed as `INSUFFICIENT_EVIDENCE`. Decision Engine, Risk Engine, Evidence Engine, Unified Audit, Strategy Versioning, and authoritative market-data systems retain their existing responsibilities.

## Broad Market Evidence Foundation

Day12-T1 adds the provider-independent [Broad Market Evidence](specifications/BROAD_MARKET_EVIDENCE.md) boundary before future Market Regime consumption: `reviewed Canonical Bar references -> immutable benchmark snapshot -> fixed-decimal features -> deterministic multi-benchmark assessment -> future regime input adapter`. The layer owns benchmark evidence composition, not regime classification.

Reviewed ETF or index Canonical Instrument IDs define explicit required and optional benchmark membership. Deterministic output contains positive/negative/neutral direction facts, agreement/disagreement counts, drawdown, rebound, range, recovery, and bounded volatility facts plus `COMPLETE`, `PARTIAL`, `STALE`, `CONTRADICTORY`, or `INSUFFICIENT` quality. It cannot emit bull, bear, correction, relief-rally, trade, signal, probability, or expected-return outcomes.

Market Regime remains authoritative for environment classification. Day12-T1 adds no live fetch, provider dependency, startup wiring, persistence, Decision/Risk/Portfolio change, AI, or execution path. Unified Audit receives only deterministic translation; it remains the audit authority.

## Evidence Fusion Layer Foundation

Day13-T1 adds [Evidence Fusion](specifications/EVIDENCE_FUSION.md) as the stable composition boundary for future multi-domain evidence: `authoritative evidence assessment -> explicit source adapter -> immutable fusion input -> deterministic policy checks -> immutable fusion snapshot -> future Decision/Risk consumers`.

V1 accepts only `BroadMarketEvidenceAssessment` through a dedicated adapter. Fusion preserves source assessment, snapshot, policy, rule, feature, evidence, and audit references without embedding benchmark observations or provider-native data. Missing, partial, stale, future-dated, contradictory, schema-incompatible, or untraceable required evidence produces a blocked snapshot. Only complete, current, policy-compatible evidence produces `READY`.

Fusion does not score evidence, calculate probability, classify a regime, recommend action, or mutate another domain. Future Decision and Risk integrations may consume only a reviewed Fusion Snapshot, never raw benchmark observations. Day13-T1 adds no consumer wiring, live data, AI, persistence, provider, HTTP, trading, or execution behavior.

## Event Analyzer Console Prototype

Day13-T2 adds an isolated [Event Analyzer Console](specifications/EVENT_ANALYZER_CONSOLE.md): `explicit BTC 15-minute test inputs -> fixed-decimal validation -> deterministic uncalibrated heuristic -> fair value and edge -> prototype recommendation plus risk explanation`.

The prototype supports only YES/NO or UP/DOWN views of one BTC 15-minute target event. Day13-T3 adds a bounded local `PT1M` candle-series boundary and deterministic returns, candle direction, body pressure, close location, range expansion, acceleration, relative-volume, reversal, and richer momentum features. Candle timestamps are completed interval starts; the final candle, observation time, exact scale-normalized current price, canonical instrument, event identity, and bounded local provenance must agree. Malformed, stale, untraceable, insufficient, legacy-only, unstable, or side-contradictory evidence produces `NO_TRADE`.

High probability alone cannot produce `BUY`; sufficient candle evidence, positive edge, acceptable market price, no severe contradiction, and minimum remaining time are separate gates. Prediction accuracy remains separate from profitability, which is explicitly `NOT_EVALUATED` because fees, liquidity, execution, sizing, portfolio state, and outcome are absent.

The console is not the Decision Engine and does not bypass Evidence Fusion or Risk. Every output is `PROTOTYPE_ONLY_NOT_AUTHORIZED`; future production consumption requires a separate evidence, Decision, Risk, owner-approval, and execution design. Local structured JSON is preferred to screenshots because deterministic validation requires exact values and timestamps. No UI, OCR, provider, API, live data, AI, persistence, portfolio mutation, order, or execution path is present.

## Capital Allocation Framework v1.0

Day14-T1 adds the provider-independent [Capital Allocation Framework](specifications/CAPITAL_ALLOCATION_FRAMEWORK.md) construction boundary: `current Portfolio reference + READY Fusion + accepted Market Regime + completed Risk gate -> deterministic validation -> immutable unranked allocation recommendation`.

The framework owns the standardized `AllocationCandidate` and `AllocationRecommendation` envelopes, not their authoritative upstream facts. Portfolio System remains portfolio truth, Evidence Fusion remains evidence-gate truth, Market Regime remains environment truth, and Risk Engine remains risk authority. Runtime objects are recursively allow-listed, eligible candidates bind to the exact gated Fusion record, and Risk must be evaluated no earlier than Fusion and Regime; `CONSTRAINED` Risk requires explicit unique constraints. Candidate ticker is display metadata beside a required canonical instrument ID. Confidence means evidence strength, never probability.

V1 constructs only an eligible-for-review recommendation. It does not rank candidates, calculate suggested weights, optimize a portfolio, decide leverage, produce a trade plan, mutate Portfolio state, or authorize execution. `topCandidates` remains deterministically ordered by Alpha candidate ID and every candidate priority is `UNRANKED`. Suggested weight is an optional validated basis-point placeholder supplied by a future reviewed workflow, never calculated by v1.

Future Leverage Decision and Opportunity Ranking engines remain external downstream extension points. Earnings Research and Capital Rotation may become upstream evidence only through explicit versioned references or adapters. Event Analyzer output is not accepted as upstream allocation authority. No AI, provider, API, persistence, Dashboard, broker, order, or execution path is added.

Capital allocation pipeline:

```text
Reviewed Market Evidence
  -> Evidence Fusion
  -> Risk Engine Review
  -> Capital Allocation Framework
  -> immutable unranked recommendation
  -> future Leverage Decision Engine (external)
  -> future Opportunity Ranking Engine (external)
  -> future owner-approved final allocation
```

## BTC Event Contract Observation Foundation

Day15-T1 adds the first normalized event-market fact boundary:

```text
owner-supplied Robinhood terms
  + declared BRTI reference-price observation
  + exact UP/DOWN quotes
  + exact UP/DOWN fee previews
  + bounded evidence identities
  -> strict validation and chronology
  -> exact fee arithmetic
  -> immutable observation record
```

The exchange contract terms remain settlement truth, the declared settlement source remains reference-price truth, and Robinhood/exchange order previews remain cost truth. The observation boundary owns only the normalized point-in-time capture, deterministic maximum-profit arithmetic, and fee-inclusive break-even probability. It does not estimate the event outcome.

Every nested object is allow-listed. BTC instrument identity, 15-minute window, evaluation method, threshold operator, trading close, evaluation time, reference-price freshness, quote freshness, order-preview freshness, quote-to-preview identity, subtotal, fees, total cost, payout, and evidence type/source/time are validated fail closed. Both UP and DOWN sides are mandatory and are not forced to sum to one dollar.

Every result is `OBSERVATION_ONLY_NOT_TRADE_AUTHORITY`. Day15-T1 adds no calibrated model, recommendation, expected value, sizing, Prediction Log, Trade Outcome Log, persistence, live Robinhood/exchange/BRTI adapter, API, network, credential, OCR, screenshot ingestion, polling, Dashboard, Paper Trading, broker, order, or execution behavior. See [BTC Event Contract Observation](specifications/EVENT_CONTRACT_OBSERVATION.md).

## Event Contract Shadow Ledger

Day15-T2 adds a local, append-only research history after the Day15-T1 observation gate:

```text
validated point-in-time observation
  -> canonical append-only NDJSON
  -> exact official settlement reference
  -> hypothetical UP and DOWN fee-inclusive outcomes
  -> aggregate shadow summary
```

Observation replay is idempotent only when the complete record matches. A settlement must bind to the exact observation, terms, contract, and declared settlement source; one observation can have only one official settlement. Repository sequence, event fingerprints, canonical serialization, timestamps, and stored domain fingerprints are revalidated during reload. Truncated, malformed, non-canonical, reordered, or reference-invalid history fails closed.

The local console accepts owner-supplied JSON only. The ledger is single-process development persistence and emits `SHADOW_ONLY_NOT_TRADE_AUTHORITY`; it does not estimate probability, recommend a side, size capital, contact Robinhood/BRTI, read credentials, place orders, or authorize execution. See [Event Contract Shadow Ledger](specifications/EVENT_CONTRACT_SHADOW_LEDGER.md).

## Research Integrity and Leakage Prevention

Day15-T3A adds a deterministic point-in-time eligibility gate before calibration, backtesting, or model comparison:

- occurrence, source publication, supported availability, and local receipt times remain distinct;
- `FORWARD` research requires both receipt and dataset freeze by the decision cutoff;
- `HISTORICAL_REPLAY` may be assembled later but every exact source version must independently prove it was available by the historical cutoff;
- Canonical Bar evidence must be final and its interval must end by the cutoff;
- outcome-bearing and settlement evidence cannot enter pre-outcome research;
- one frozen manifest binds the exact evidence identities and content fingerprints.

The result is only `ELIGIBLE` or `BLOCKED` for research integrity and always remains `RESEARCH_ONLY_NOT_TRADE_AUTHORITY`. It does not assess sample sufficiency, train or calibrate a model, report probability or returns, recommend a side, size capital, or authorize execution. See [Research Integrity](specifications/RESEARCH_INTEGRITY.md).

## Research Dataset Qualification and Temporal Split

Day15-T3B adds the deterministic dataset gate after individual Day15-T3A audits and before any model research. A collection plan must be frozen strictly before its first event cutoff and enumerate a continuous BTC-USD 15-minute event sequence. Every completed sample must bind the planned event, exact observation and outcome records, feature schema/version, and one eligible Research Integrity audit.

The default policy requires at least 1,000 completed samples, 30 distinct UTC dates, 90% planned-event and outcome coverage, at least 200 observations for each UP/DOWN outcome, and no outcome above 80%. IDs must be unique, feature and integrity-policy versions cannot be mixed, and every outcome must become known only after its event cutoff.

Qualified samples are sorted by event cutoff and split deterministically into chronological 60% training, 20% calibration, and 20% sealed final-test partitions, with four-sample embargo gaps and label-availability checks between partitions. Any issue produces `BLOCKED` with no split. `QUALIFIED` means only that the declared minimum research gate passed; it is not statistical proof, a probability claim, a profitable backtest, or trading authority. See [Research Dataset Qualification](specifications/RESEARCH_DATASET_QUALIFICATION.md).

## Research Shadow Dataset Assembly

Day15-T3B2 adds a narrow offline adapter between the append-only Day15-T2 shadow ledger and the Day15-T3B qualification input. It accepts one owner-supplied frozen plan, explicit event-to-observation bindings, complete Day15-T3A audit inputs, immutable feature versions, and a read-only ledger snapshot. It recomputes each audit and requires the exact observation identity and fingerprint in its evidence before deriving a label exclusively from the official settlement.

Missing or unsettled events remain explicit and produce `BLOCKED`; assembly never repairs history, infers a label, or substitutes a favorable record. `ASSEMBLED` means only that a canonical T3B input was constructed. The existing T3B engine remains the sole dataset qualification and temporal-split authority. The boundary adds no console, repository, automated collection, provider, network, model, probability, recommendation, or execution behavior. See [Research Shadow Dataset Assembly](specifications/RESEARCH_SHADOW_DATASET_ASSEMBLY.md).

## Forward Shadow Collection Control

Day15-T3B3 adds a deterministic control surface before T3B2 assembly. It creates a continuous aligned BTC-USD 15-minute plan from one caller-declared creation time, first future cutoff, and bounded event count. Event IDs are derived from UTC cutoffs, and the result uses the canonical T3B collection-plan contract and fingerprint.

A separate read-only audit projects exact Day15-T2 histories into stable `UPCOMING`, `OVERDUE_MISSING`, `CAPTURED_UNSETTLED`, or `SETTLED_CANDIDATE` states. It lists every matching observation and settled candidate without selecting one; later T3B2 binding remains explicit. The caller-supplied creation time proves only local deterministic coherence, not an externally signed freeze time or guaranteed Robinhood listing. The boundary adds no scheduler, network, provider, persistence, automatic capture, model, recommendation, or execution behavior. See [Forward Shadow Collection Control](specifications/FORWARD_SHADOW_COLLECTION_CONTROL.md).

## Forward Shadow Collection Operator

Day15-T3B4 adds an explicit local operator surface over T3B3. `freeze-plan` constructs a verified plan from caller-authored JSON and creates one new artifact with exclusive file creation; it never overwrites an existing plan. `progress` reconstructs and verifies that artifact before opening one explicitly named, already-existing Day15-T2 ledger, then emits the unchanged T3B3 read-only audit.

The operator surface uses strict option parsing, refuses missing or corrupt ledgers, and does not initialize or mutate ledger storage. It remains single-host development tooling with caller-owned paths, not a production persistence or hostile-filesystem sandbox. It adds no network, provider, credential, polling, scheduler, background capture, research-sample selection, model, recommendation, or execution authority. See [Forward Shadow Collection Operator](specifications/FORWARD_SHADOW_COLLECTION_OPERATOR.md).

## Event Contract Collection Source Architecture

Day15-T3B5 defines the admission boundary for future real event-contract evidence. Robinhood platform facts, exchange-native market facts, official settlement-reference values, and operator-captured evidence remain distinct source classes. A single observation may compose them only while preserving every source identity, record identity, timestamp, and authority.

Because Robinhood may offer contracts from multiple exchanges, a future exchange adapter must prove an exact reviewed platform-to-exchange mapping across exchange, market, contract, side semantics, BTC instrument, event window, threshold, evaluation method, settlement source, and terms version. Similar titles, cutoffs, or target prices cannot establish identity. Exchange quotes cannot be relabeled as Robinhood quotes, and exchange fees cannot stand in for a Robinhood order preview.

The staged release sequence requires provider-neutral source contracts, a fixture-only adapter, a separately approved bounded live-read smoke, collection-runner architecture, and only then a limited forward pilot. Undocumented Robinhood interfaces, authenticated brokerage-session automation, direct adapter-to-ledger writes, and any trading authority are prohibited. See [Event Contract Collection Source Architecture](specifications/EVENT_CONTRACT_COLLECTION_SOURCE_ARCHITECTURE.md).

## Event Contract Source Contracts

Day15-T3B6 implements the provider-neutral contract layer required by T3B5. Immutable provider descriptors declare one source class, bounded capabilities, supported execution modes, official documentation, and either no credential or a read-only data credential. Credential types with brokerage, session, or write authority do not exist.

Exact mapping records bind one exchange provider to explicit Robinhood and exchange-native identities plus complete canonical BTC 15-minute terms. A `REVIEWED_EXACT` mapping is eligible only when all identity and terms fields agree; pending and rejected mappings remain immutable but ineligible.

Source snapshots preserve provider and mapping fingerprints, one declared capability, provenance chronology, payload fingerprint, and bounded byte/record metadata without retaining a raw payload. The default T3B6 policy remains fixture-only. T3B8 adds exactly one separately named bounded-live policy with a 100,000-byte and one-record ceiling; all other live policies remain rejected. Outputs remain research-source evidence, not T1 observations or trade authority. See [Event Contract Source Contracts](specifications/EVENT_CONTRACT_SOURCE_CONTRACTS.md).

## Kalshi Event Contract Fixture Adapter

Day15-T3B7 introduces one concrete fixture-only Kalshi provider and validates the official `KXBTC15M-26JUL232045-45` market together with its `KXBTC15M` series metadata. Its official-evidence correction adds one sanitized fixture from the exact public Robinhood event page. The adapter normalizes exact UTC interval, target, BRTI rule, terms-document references, finalized settlement facts, platform page identity, and content-addressed terms version from bounded static JSON without a runtime transport, credential, network request, persistence path, or raw-payload output.

The exact Robinhood page links directly to Kalshi's `CRYPTO15M` terms and agrees with the Kalshi fixture on the interval, `$64,839.26` target, BRTI source, and complete primary and secondary rules. The mapping preserves each native title separately, the Robinhood page slug, its routable deep-link UUID, and the opaque `ec_id` without assigning undocumented semantics. The output is `NORMALIZED_EXACT_MAPPING`, constructs one T3B6 fixture settlement snapshot, and still has no T1 observation, quote/fee, live-read, or trading authority. See [Kalshi Event Contract Fixture Adapter](specifications/KALSHI_EVENT_CONTRACT_FIXTURE_ADAPTER.md).

## Kalshi Bounded Live-Read Smoke

Day15-T3B8 adds one isolated public HTTPS boundary for `GET /trade-api/v2/markets/KXBTC15M-26JUL232045-45`. The exact endpoint, market, method, timeout, request count, response bytes, and record count are fixed. The path has no credential, query, retry, redirect, polling, scheduling, streaming, persistence, or raw-payload output.

The manual command defaults to network-free dry run. A confirmed invocation requires a separate owner decision and may perform exactly one request. The returned market must pass the complete T3B7 exact-market schema and mapping before the source engine can produce a `BOUNDED_LIVE_READ` settlement snapshot. Kalshi quote fields remain exchange-native and are not surfaced as Robinhood quote or fee evidence. Automated tests inject the transport and never call the network. See [Kalshi Event Contract Bounded Live-Read Smoke](specifications/KALSHI_EVENT_CONTRACT_LIVE_SMOKE.md).

The owner-authorized first request completed successfully with one request, one normalized settlement record, zero retries, zero credentials, and zero persistence writes. This validates the transport and exact mapping for the single historical market only; it does not authorize repetition or scheduling.

## Event Contract Collection Runner Architecture

Day15-T3B9 defines the future continuous collector as a deterministic research orchestrator over frozen plans and already admitted sources. It separates platform and exchange evidence lanes, requires an immutable admission bundle per source task, and preserves missed pre-event evidence as `MISSED` rather than backfilling it.

The architecture defines pilot and task state machines, injected UTC and monotonic clocks, one-worker leases, a maximum of two attempts, strict retry classification, deadlines, budgets, graceful and emergency stop, sanitized health, and crash recovery. A future local pilot uses transactional SQLite with unique idempotency keys and an atomic task/attempt/evidence/outbox commit; existing NDJSON repositories are not sufficient for this concurrency and recovery boundary.

The current Kalshi source can scale exchange-native evidence but cannot automatically supply Robinhood quotes or fee previews. Therefore T3B9 cannot claim complete T1 observations or dataset qualification. It adds no implementation, database, scheduler, background worker, request, or trading authority. See [Event Contract Collection Runner Architecture](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_ARCHITECTURE.md).

### Runner Contract and State-Validation Foundation

Day15-T3B10-T1 turns the T3B9 authority and lifecycle model into provider-neutral immutable contracts. The deterministic engine constructs and verifies runner definitions, owner-approval evidence, exact per-task admission bundles, and scheduled tasks; derives the complete idempotency identity; and enforces compare-and-swap pilot and task transitions.

The initial ceilings remain one pilot, one worker, one in-flight request, one request per second, two total task attempts, and a one-second clock-offset policy. Exchange tasks require an admitted exact mapping while platform tasks prohibit exchange mapping identity. The implementation adds no current-time decision, clock, lease, retry execution, repository, SQLite store, scheduler, worker, adapter invocation, network request, observation, ledger mutation, model, or trading authority. See [Event Contract Collection Runner Contracts](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_CONTRACTS.md).

### Runner SQLite and Transaction Boundary Design

Day15-T3B10-T2 specifies a single-host local research store using SQLite `STRICT` tables, WAL, `synchronous=FULL`, verified foreign-key enforcement, checksum-bound forward migrations, compare-and-swap aggregate updates, immutable attempt claims/results, unique evidence idempotency, and a transactional outbox.

The critical evidence transaction verifies pilot/task/lease/attempt/budget and exact source authority, appends the attempt result and normalized evidence, moves the task to `COMMITTED`, updates counters, removes the lease, and appends the outbox event in one `BEGIN IMMEDIATE` transaction. The design also separates same-session monotonic timing from restart-safe UTC recovery, defines invariant checks, and requires verified backup, offline restore, and corruption drills. See [Event Contract Collection Runner SQLite](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE.md).

Day15-T3B10-T3A selects the Node 24.12+ `node:sqlite` standard-library binding for the local research pilot and implements only safe path resolution, hardened database opening, verified connection pragmas, capability/integrity checks, and checksum-bound migration 001. The public store surface exposes no raw database handle or arbitrary mutation method. No third-party SQLite package, application runtime store, repository transaction, scheduler, worker, provider request, pilot activation, or trading authority is added. The binding remains disallowed for commercial/production persistence while Node documents it as active development. See [Event Contract Collection Runner SQLite Dependency and Migration](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_MIGRATION.md).

Day15-T3B10-T3B adds a restricted repository port over that private store. Named `BEGIN IMMEDIATE` transactions implement T2-T10 plus the explicit T8B `IN_FLIGHT -> VALIDATING` bridge, revalidate exact domain/source authority, enforce compare-and-swap versions and bounded attempts, and atomically bind results, normalized evidence, counters, leases, transitions, and sanitized outbox records. The public surface returns immutable sanitized views and exposes neither SQL nor raw canonical JSON. It still creates no application runtime store and starts no scheduler, worker, retry loop, provider request, real pilot, model, recommendation, broker, order, or execution path. See [Event Contract Collection Runner SQLite Repository](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_REPOSITORY.md).

Day15-T3B10-T3C adds fail-closed startup recovery inspection, independently verified SQLite online backups with digest-bound canonical manifests, and offline restore to a new non-existing path. Recovery blockers prohibit repository mutation, and operational pilots require explicit owner resume after restart. Restore never switches configuration or resumes work. See [Event Contract Collection Runner SQLite Recovery](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_RECOVERY.md).

Day15-T3B10-T4 specifies the subsequent recovery-control plane. Resume is not an `ACTIVE -> ACTIVE` lifecycle mutation; it is a one-time owner decision bound to the exact recovery assessment, activation version, store identity, new boot identity, and process session. Emergency Stop has precedence over resume, leases, retries, and new requests; terminal states never reopen. The design was approved and pushed as `bfe4751d39ae3d0a9e4c0bc70d6889198f9f0516`. See [Event Contract Collection Runner Recovery Control](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_RECOVERY_CONTROL.md).

Day15-T3B10-T4A implements the provider-neutral immutable contracts and pure deterministic engine for recovery assessment, owner-decision validation, assessment verification, and Emergency Stop classification. It strictly rejects undeclared inputs and validates exact owner, activation version, store/report identities, boot/session bindings, clock bounds, chronology, expiry, and disposition/action compatibility. It is committed and pushed as `12848f9621e6d9abf9477cdb5c24260b50351a97`.

Day15-T3B10-T4B adds checksum-bound migration 002 and a separately restricted recovery-control repository. Five new `STRICT` tables preserve assessments, owner decisions, session authorizations, Emergency Stop evidence, and execution receipts. Named `BEGIN IMMEDIATE` transactions revalidate deterministic records and exact recovery/store/schema/Pilot identities, consume decisions once, give Emergency Stop precedence, use compare-and-swap terminal/stop transitions, and commit receipts with outbox evidence atomically. Resume creates only a one-time session-authorization record; it does not unlock the ordinary runner repository. Populated v1 stores fail closed until a separately verified pre-migration backup exists. T4B adds no operator command, authenticated runtime gate, scheduler/worker, provider request, or real resume.

Day15-T3B10-T4C adds a local-only Owner command and an authenticated process-session repository gate. Owner secrets enter only through standard input, are checked with fixed-policy `scrypt` and constant-time comparison, and are never placed in command arguments, environment options, output, decisions, receipts, or audit records. The exact command becomes the authentication challenge. A resumed repository rejects new definitions, Pilots, and task authority; every allowed write revalidates the unexpired, unrevoked session, exact store/report/schema/Pilot version, process/boot identity, task membership, and absence of a later Emergency Stop. An irreversible process-local stop barrier blocks writes even if durable stop persistence fails. T4C still starts no scheduler, worker, provider request, or continuous runner.

Day15-T3B10-T4D exercises the recovery-control boundary with temporary, network-free SQLite stores. Two independent store connections cover both Stop/Resume commit orderings; close/reopen drills prove old recovery contexts cannot reuse a prior session; an injected SQLite abort proves the Resume transaction leaves no partial consumption, session, or receipt; and an injected durable-stop failure proves the process barrier still blocks mutation. Revoking a session now updates its lifecycle fields and authorization fingerprint in the same transaction so durable reads remain coherent. T4D adds validation evidence only and starts no runtime loop.

The Day15-T3B10 milestone review accepts the runner foundation for runtime architecture design only. It explicitly blocks operation because no single-instance process owner, runtime clocks, scheduler/worker composition, complete Pilot operator surface, future-market provider composition, automatic platform-evidence lane, T1/T2 assembly path, or health/outbox consumer exists. See [Event Contract Collection Runner Milestone Review](EVENT_CONTRACT_COLLECTION_RUNNER_MILESTONE_REVIEW.md).

Day15-T3B11-T1 specifies the missing local runtime boundary without implementing it. One foreground process must acquire a fail-closed single-instance lock, create rather than accept its boot/process-session identity, validate immutable configuration, use injected wall/monotonic/clock-health ports, and route every mutation through the session-gated repository. The deterministic scheduler may select at most one already-materialized task; the first Worker composition is fixture-only. Runtime Stop, local control, status/outbox projection, evidence integration, crash handling, and bounded-live admission remain separately gated. See [Event Contract Collection Runner Runtime Architecture](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME.md).

Day15-T3B11-T2 implements the non-operational runtime foundation. A strict immutable `FIXTURE_ONLY` configuration resolves separate local control and SQLite roots, rejects UNC, traversal, substituted roots, and unsafe store entries, and binds a deterministic configuration/path/store identity. Single-process ownership uses atomic lock-directory creation and an immutable canonical ownership record; a duplicate or stale lock blocks startup and is never auto-stolen. Boot identity remains an injected reviewed port, the process nonce comes from the operating-system CSPRNG, the process-session identity is minted after lock acquisition, and a local process-liveness port is available for later authenticated recovery. Wall, monotonic, and clock-health ports remain separate, and unknown, stale, future-dated, expired, unsynchronized, or excessive-offset health evidence fails closed. T2 adds no preflight command, scheduler, Worker, adapter, timer, SQLite mutation, provider request, or Pilot operation.

Day15-T3B11-T3 composes the first bounded fixture execution primitives without starting a runtime. A pure scheduler validates a closed snapshot and emits exactly one immutable action with stable platform-first ordering. Only an already-`DUE` task may be acquired; `SCHEDULED` and eligible `RETRY_WAIT` tasks explicitly wait for the existing durable due-transition boundary. A separately constructed Worker runs exactly one caller-invoked cycle, accepts only an exact fixture adapter binding, verifies immutable activation/task artifacts and clock/budget/cutoff authority, and writes only through the session-gated repository in T7, T8, T8B, T9, or T10 order. Cancellation is persisted after claim, and any unresolved post-lease failure trips the irreversible process Stop barrier. There is still no timer, loop, daemon, network transport, lifecycle command, real Pilot startup, probability, recommendation, or capital authority.

Day15-T3B11-T4 adds a local programmatic Operator and Health surface without starting the runtime. Preflight and Status are immutable deterministic projections; `HEALTHY` requires exact configuration, ownership, store, integrity, clock, recovery-session, and Stop-barrier evidence. Status reads one bounded SQLite projection containing only Pilot/task/budget/lease chronology and payload-free Outbox identities; it never returns `sanitized_event_json` or normalized evidence bodies. Stop commands use the existing local Owner verifier, trip the process barrier, persist either an exact graceful Pilot CAS or recovery-control Emergency Stop, and then publish a fingerprint-bound process-local notification. Persistence or notification failure cannot clear the barrier or invent success. T4 adds no CLI runtime start, timer, polling loop, lock takeover, outbox delivery, provider request, or trading authority.

Day15-T3B11-T5 validates the local runtime boundary through real child-process ownership contention plus deterministic timeout, cutoff/deadline, Stop, restart, and replay drills. A duplicate process is rejected without changing owner evidence; forced exit leaves a stale immutable lock that blocks restart rather than being auto-stolen. Retry-wait work cannot be acquired without its durable due transition, cutoff and deadline prevent acquisition, and Stop has scheduler precedence. Exact Stop replay is deterministic, changed replay fails closed, and post-Stop health cannot be reported healthy. T5 adds test fixtures only and creates no runtime loop, stale-lock recovery authority, network provider, Pilot operation, recommendation, or trading path.

Day15-T3B11-MR1 accepts the T3B11 fixture-runtime components as reusable foundations but does not authorize runtime start. No single reviewed composition root currently owns immutable startup, lock acquisition, SQLite readiness/recovery, process-session binding, T6 due transition, one-cycle execution, Stop/shutdown timeout, clean release, and terminal reporting. Real process-kill evidence also covers ownership only, not the lease/attempt/validation/commit boundaries. The next permitted work is assembly-and-recovery architecture design; automatic stale-lock recovery, background execution, providers, real Pilot activation, and capital authority remain blocked. See [Event Contract Collection Runner Runtime Milestone Review](EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_MILESTONE_REVIEW.md).

Day15-T3B12-T1 designs that missing composition without implementing it. The first assembled form is one foreground fixture step: immutable startup and recovery gates produce a bounded work snapshot, a pure planner selects exactly one action, and the invocation performs either one T6 transition, one existing fixture Worker cycle, Stop/close, or no mutation before exiting. T6 and Worker execution never occur in the same step. Stale ownership requires exact local Owner authentication and is atomically quarantined with immutable evidence rather than deleted or automatically taken over. Real child-process drills must cover session, T6, lease, attempt, validation, T10, Stop, and quarantine crash points before runtime start can be reviewed. See [Event Contract Collection Runner Runtime Assembly and Recovery Architecture](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_RECOVERY.md).

Day15-T3B12-T2 implements only the deterministic seam of that design. Strict immutable contracts describe the invocation lifecycle, bounded sanitized work snapshot, closed one-action decision, exact T6 request/result, and terminal report. A pure planner evaluates current authority and durable evidence in a fixed order, while narrow ports reserve bounded snapshot reads and separately gated T6 execution for later composition. This layer owns no command, filesystem recovery, repository implementation, SQLite connection, provider, clock, wait, loop, or runtime start.

Day15-T3B12-T3 implements authenticated ownership recovery without assembling or starting the runtime. A read-only inspector binds exact configuration, path, lock, boot, PID/liveness, store-recovery, Pilot, lease, attempt, and durable Stop evidence. Only verified stale candidates can receive one challenge-bound local Owner decision. The sole mutation writes and flushes an immutable receipt, then atomically renames the complete lock directory into a deterministic same-filesystem quarantine. Invalid evidence, live ownership, uncertain liveness, store failure, Stop state, changed reinspection, or conflicting replay remains fail closed. Quarantine authorizes neither Pilot Resume nor a new runtime session.

Day15-T3B12-T4 implements the first foreground one-action composition boundary. A closed startup session supplies exact fixture-only identity and Preflight; the step samples fresh clocks, reads and verifies one bounded work snapshot, calls the pure planner once, and invokes at most one T6, fixture Worker, or Stop executor. T6 never falls through into fixture work. The step rereads terminal safety, closes resources, and releases ownership only after verified clean completion; any ambiguous mutation or cleanup preserves ownership for recovery. This programmatic boundary adds no executable command, loop, timer, network provider, Pilot activation, recommendation, or trading authority.

Day15-T3B12-T5 validates that composition and its existing repository boundaries with real fixture-only child-process termination. Eleven network-free drills cover startup ownership/store boundaries, T6/T7/T8, validation, authenticated-session restart, in-transaction Stop rollback, post-rename quarantine replay, and post-T10 evidence replay. SQLite/WAL is always reopened before committed truth is asserted. Stale ownership remains evidence, old process-session authority is rejected, unknown request outcomes are not retried, uncommitted Stop records vanish atomically, and committed evidence/quarantine receipts replay without duplication. No production fault-injection surface or runtime command is added.

Day15-T3B12-MR1 accepts the assembled fixture-runtime and recovery foundations and permits only a separately reviewed fixture-rehearsal design. The current boundary remains programmatic and one-action; it cannot be wrapped in a loop or exposed as a general runtime command. A future rehearsal must be owner-invoked, network-free, content-addressed, temporary, sanitized, and explicit that fixture success does not establish live-source, Robinhood-platform, T1/T2, dataset, recommendation, or trading readiness. See [Event Contract Collection Runner Runtime Assembly Milestone Review](EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_MILESTONE_REVIEW.md).

Day15-T3B13-T1 designs that fixture rehearsal without implementing or running it. One immutable manifest and allow-listed catalog entry bind a synthetic isolated Pilot, exact fixture source, expected per-invocation actions, bounds, and evidence policy. Separate manual foreground invocations each execute at most one T3B12 action; no internal loop arranges the next step. A bounded content-addressed evidence package retains sanitized receipts, terminal reports, recovery/quarantine identities, payload-free Outbox chronology, SQLite integrity/backup evidence, and a mandatory non-authority declaration. An independent verifier distinguishes the environment-specific execution package from the deterministic scenario result. See [Event Contract Collection Runner Fixture Rehearsal and Evidence Architecture](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL.md).

Day15-T3B13-T2 implements only the pure contract boundary from that design. The content-derived manifest freezes approval, build, runner, plan, fixture, provider/mapping, synthetic Pilot/task, expected action sequence, terminal truth, evidence policy, retention, and non-authority identity. Append-only lifecycle and exact-ordinal receipts cannot reopen terminal states or substitute actions. The independent verifier produces only `PASS`, `FAIL_CLOSED`, or `INCOMPLETE`; its stable scenario fingerprint excludes process, boot, workspace, store, and timing identity, while the execution-package fingerprint preserves them. No filesystem, SQLite, command, fixture execution, or network authority is present.

Day15-T3B13-T3 adds the separately approved preparation boundary. A trusted composition root registers immutable catalog entries and pre-existing allowed roots; runtime requests choose only their identifiers. The workspace name derives from the manifest fingerprint and cannot overlap the repository, a filesystem root, or pre-existing unrelated content. Preparation creates separate control and SQLite roots, applies the existing strict migrations, writes one synthetic fixture-only Runner/Pilot/task set through named repository transactions, verifies the seeded state, closes SQLite, and writes one exclusive canonical preparation record. Exact replay reopens and verifies the same store and receipt. Failure preserves the workspace through quarantine rename; it does not recursively delete evidence.

Day15-T3B13-T4 adds one programmatic rehearsal invocation boundary. Each call binds an exact manifest, rehearsal, lifecycle version, recovery fingerprint, scenario phase, and ordinal to at most one existing T3B12 foreground action. Exact replay returns the prior sanitized receipt without repeating work; changed replay, substitution, stale state, and skipped ordinals fail closed. The coordinator independently rereads durable task and Pilot truth before recording success, and any ambiguous mutation or identity mismatch moves the rehearsal to recovery-required state. It adds no command, loop, timer, scheduler, provider request, real Pilot, recommendation, broker, order, or execution authority.

Day15-T3B13-T5 adds the post-completion evidence boundary. A trusted evidence port must verify SQLite, backup, and validation identities before a repository-disjoint package root can be mutated. Fifteen bounded sanitized artifacts are written durably to staging and then atomically renamed into one immutable evidence directory. A separate verifier rereads the exact directory, rejects missing or extra files, recomputes lengths and digests, scans excluded data, and invokes the pure package verifier. Exact replay never rewrites the directory; partial staging is quarantined rather than deleted. Test-only child processes prove pre-commit and post-commit crash behavior plus fresh-process Stop and leakage rejection. No executable rehearsal command or operational authority is added.

Day15-T3B13-MR1 accepts the T3B13 components as deterministic fixture-rehearsal foundations but blocks a rehearsal run. The exact-ordinal coordinator currently has only an in-memory rehearsal ledger, the SQLite/backup/validation evidence gate has no concrete authoritative implementation, the final package does not itself reopen the referenced backup, and no fresh-process drill assembles preparation, the real T3B12 foreground step, durable recovery, backup, packaging, and verification. The next permitted work is durable rehearsal-composition and evidence architecture design. Executable or continuous runtime, providers, real Pilot activation, T1/T2 delivery, dataset qualification, recommendation, and capital authority remain blocked. See [Event Contract Collection Runner Fixture Rehearsal Milestone Review](EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_MILESTONE_REVIEW.md).

Day15-T3B14-T1 designs that missing composition without implementing it. A new rehearsal-only SQLite schema profile would keep a durable compare-and-swap projection plus append-only lifecycle, operation-claim, receipt, failure, and artifact-binding history in the same isolated database as the synthetic Runner/Pilot/task truth. Each future Owner invocation selects one closed phase and exits; a committed runner action without a rehearsal receipt enters deterministic recovery rather than replay. After terminal freeze, one online backup, fixed local validation receipt, bounded package, and envelope manifest are atomically published together. A fresh process must reopen the backup and reconstruct registry, Runner, Outbox, validation, and package truth before returning `PASS`. See [Durable Fixture Rehearsal Composition and Evidence Architecture](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COMPOSITION.md).

Day15-T3B14-T2 implements only the durable record and database-profile
foundation. Closed immutable contracts and a pure verifier reconstruct
lifecycle, exact invocation ordinals, claims, receipts, failure disposition,
and evidence-plan placement. Migration 003 extends only a newly created empty
v2 foundation into the explicit `FIXTURE_REHEARSAL_V3` profile with six
`STRICT` tables, append-only history triggers, exact migration/build lineage,
and deterministic read-only schema inspection. Ordinary runner v2 stores
remain incompatible and unchanged. No phase coordinator, command, rehearsal
execution, backup/envelope production, provider, real Pilot, T1/T2 delivery,
recommendation, broker, order, or execution authority is added.

Day15-T3B14-T3 composes the first three closed durable phases without adding
an executable operation surface. `PREPARE` reuses the registered T3B13
preparation boundary and then atomically records `PLANNED -> PREPARING ->
PREPARED` in the new v3 store. `STEP` atomically commits its immutable claim
and `READY -> STEPPING` transition before invoking the T3B12 foreground
boundary at most once; a verified terminal report and independent durable
observation are required before its receipt and completion transition commit.
An interrupted or failed post-claim process remains explicitly ambiguous.
Exact replay cannot repeat the action. Owner-authenticated `RECOVER` only
reconciles existing Runner, task, Outbox, and recovery evidence: proven exact
success may write the missing receipt, while unknown or conflicting evidence
becomes `RECOVERY_REQUIRED` or `FAILED_CLOSED`. Stop precedes ownership and
each mutation/action boundary, and ownership is released only after a clean
result.

Day15-T3B14-T4 closes the durable evidence-production boundary. A reviewed
fixed-process adapter binds clean repository commit, fixed validation-suite
identity, registered test total, exit status, timing, and sanitized output
digest into an immutable receipt. The final SQLite transaction binds one
`FREEZE` claim, that receipt fingerprint, planned backup/package/envelope
identities, and `COMPLETED -> VALIDATED -> EVIDENCE_FROZEN` history without
altering Migration 003. Packaging opens the frozen store read-only, uses the
Node SQLite online-backup boundary, writes fixed bounded JSON artifacts, and
publishes the complete envelope by same-filesystem rename. The independent
verifier receives only a registered evidence-root ID and expected envelope and
manifest fingerprints, recomputes all digests, inspects the v3 backup, and
reconstructs durable rehearsal truth. Full OS-process and crash proof remains
T3B14-T5 work.

Day15-T3B14-T5 proves the evidence boundary in separate Node processes and
test-owned temporary roots. The drills kill builders after the online backup,
after complete staging, and after atomic publication; incomplete staging is
quarantined and cannot be mistaken for a valid envelope. Independent verifier
processes reject backup, backup-manifest, validation-receipt, extra-file, and
expected-identity substitution; a missing backup is `INCOMPLETE`, never
`PASS`. Two isolated stores preserve one scenario-result fingerprint while
their execution-package fingerprints differ. Final backup inspection also
requires a completed Pilot, terminal tasks, no leases, no unresolved attempts,
evidence for committed tasks, coherent budget counters, Outbox evidence, and
valid durable rehearsal history. These remain fixture drills, not authority to
run a real rehearsal.

Day15-T3B14-MR1 accepts the durable schema, coordinator, recovery, freeze,
backup, envelope, and independent-verification components, but keeps
`NO_GO_FOR_REHEARSAL_RUN`. The T5 clean process fixture directly seeds terminal
Runner and rehearsal records and directly constructs a passing validation
receipt; it therefore proves the evidence boundary, not the complete reviewed
phase sequence or fixed-validator authority. The coordinator also remains
limited to programmatic `PREPARE`, `STEP`, and `RECOVER`, and post-freeze
source immutability is not yet proven as a store-wide writer barrier. The next
permitted work is the narrow T3B14-C1 end-to-end phase-composition and
validation-authority correction, followed by a separate MR2. See
[Event Contract Collection Runner Durable Fixture Rehearsal Milestone Review](EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_MILESTONE_REVIEW.md).

Day15-T3B14-C1 closes that correction locally with a test-only closed phase
surface. PREPARE, three real foreground STEP invocations, VALIDATE, FREEZE,
PACKAGE, and VERIFY each execute in a fresh process without arranging the
next phase. Fresh verification requires registered commit, suite, policy, and
test-total authority, and an evidence-frozen source store exposes no mutable
repository. C1 remains non-operational and requires T3B14-MR2; it grants no
rehearsal-run, provider, continuous-runtime, or capital authority.

Day15-T3B14-MR2 accepts C1's process separation, validation authority, Pilot
completion, and frozen-store controls but retains `NO_GO_FOR_REHEARSAL_RUN`.
The C1 evidence action reaches the real foreground-step boundary yet uses a
direct-SQL test executor instead of the reviewed T7/T8/T8B/T10 Worker
transaction composition. Several required crash, Stop, recovery, and replay
cases remain component rather than fresh-process evidence, and validation
reporting omits the executed durable-evidence process count. T3B14-C2 must
close those narrow evidence gaps before a separate T3B14-MR3.

Day15-T3B14-C2 closes those narrow gaps locally. The test-only STEP phase now
constructs the real fixture Worker and session-gated repository, so its single
foreground cycle executes the reviewed T7 lease, T8 attempt claim, T8B
validation transition, and T10 atomic evidence commit. New child-process
drills persist and inspect crash-after-claim and Stop-after-claim ambiguity,
prove Stop precedence before every mutable phase, and prove exact replay plus
changed-replay rejection without duplicate mutation. Normalized validation now
counts the durable process suite's `drills passed` output. These are evidence
and accounting corrections only; a separate T3B14-MR3 remains required and no
real rehearsal or runtime authority is granted.

Day15-T3B14-MR3 independently accepts C2's real Worker composition, new
claim/Stop/replay process evidence, and corrected validation accounting. It
does not accept the exact twenty-drill gate. The current matrix maps a runtime
pre-ownership crash to the rehearsal pre-claim requirement; maps T6/T10
runtime crashes without a rehearsal claim or receipt to assembled
pre-receipt requirements; changes only invocation ID for the changed
phase/ordinal/recovery/manifest requirement; and maps a package-build crash to
package-artifact substitution. T3B14-C3 must add those exact child-process
boundaries before a separate MR4. MR3 grants no rehearsal or runtime
authority.

Day15-T3B14-C3 closes the exact MR3 evidence gaps locally without changing the
production coordinator contract. Test-only fault checkpoints now exit the
assembled STEP child before `claimStep`, after foreground T6 and before
`completeStep`, or after Worker T10 and before `completeStep`; a new process
then reconstructs both Runner and rehearsal truth. Four separate replay
children alter phase, ordinal, recovery fingerprint, or manifest fingerprint
and prove no mutation. A package-substitution child changes one published
artifact before an independent verifier rejects the envelope. C3 remains
non-operational and requires a separate T3B14-MR4.

Day15-T3B14-MR4 accepts the durable fixture-rehearsal foundation and all twenty
matching process drills. It preserves the operation boundary: the existing
phase child remains a test harness with test-selected roots, hard-coded
synthetic identities, fault modes, and a generated one-test validation
repository. It is not an Owner-authenticated operation and may not be invoked
as a rehearsal. The next permitted work is design-only T3B15-T1 for one exact
Owner-gated, fixed-root, actual-Alpha-validation, network-free rehearsal
operation.

Day15-T3B15-T1 designs that operation boundary without implementing or running
it. One content-addressed operation manifest binds the exact clean Alpha
commit, fixture catalog and mapping, runtime build, registered fixed roots,
phase plan, complete validation suite and test total, Owner approval, expiry,
and non-authority declaration. Every mutable invocation requires stdin-only
local Owner authentication, consumes one durable authorization, invokes one
closed phase in one foreground process, records one sanitized result, and
exits. Preflight and Status are read-only; Stop has precedence; crash ambiguity
cannot be retried automatically; validation must run the actual complete Alpha
bundle with recursion blocked; and final verification starts in a fresh
process from a registered evidence root. Implementation, independent review,
and authorization for one rehearsal remain separate future decisions. See
[Exact Owner-Gated Network-Free Rehearsal Operation Architecture](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_OWNER_GATED_REHEARSAL_OPERATION.md).

Day15-T3B15-T2 implements the non-operational contract and registry
foundation. Six immutable root registrations must cover Control, Workspace,
SQLite, Backup, Evidence, and the read-only Alpha repository exactly once,
with canonical non-overlapping paths and inspected filesystem identities. A
fixed validation authority binds one full 40-character Alpha commit, clean
tree, package and suite fingerprints, exact registered test total, fixed
validation command, recursion policy, zero network, and zero credential
access. The operation proposal freezes the catalog/mapping/Runner/plan/root/
validation identities and closed PREPARE/STEP/VALIDATE/FREEZE/PACKAGE/VERIFY
sequence before Owner approval; the approval binds that proposal fingerprint,
and the final manifest derives its operation identity from both records. A
read-only in-memory registry verifies every cross-binding and exposes only
defensive queries. T2 adds no SQLite migration, phase authorization
transaction, filesystem inspection, Owner command, phase invocation, or
rehearsal authority.

Day15-T3B15-T3 implements the local operation-control boundary without
creating or running a real rehearsal. The command parser accepts only closed
operation, manifest, phase, lifecycle, ordinal, recovery, commit, time, and
nonce identities; phase and Stop secrets use the existing stdin-only local
Owner-verifier boundary. Registered roots resolve through manifest IDs and
current non-link filesystem inspection, never caller paths. Preflight and
Status are bounded read-only projections.

One fixed `rehearsal-operation-control.sqlite3` ledger under the registered
Control root owns append-only one-use authorization, result, and Stop
receipts. This separate ledger is required because PREPARE must be authorized
before the rehearsal-profile SQLite store exists. It does not duplicate
Runner or rehearsal lifecycle truth. The phase gate orders Preflight, Owner
authentication, Stop, exclusive ownership, atomic authorization consumption,
a second Stop check, exactly one injected T3B14 phase, evidence validation,
durable result append, and exit. An authorization without a result remains
ambiguous and cannot be replayed.

Day15-T3B15-T4 binds VALIDATE to the actual registered Alpha repository through
one fixed executable/argument policy. It rechecks the exact clean commit,
package and validation-suite fingerprints before execution, strips
credential-bearing environment state, requires the network-disabled process
marker, rejects recursive invocation, bounds output, and accepts exactly one
unified validation summary whose registered, passed, and failed counts match
the immutable authority. Its operation validation receipt is separate from,
and content-bound to, the existing T3B14 evidence receipt.

Final `verify` is a read-only fresh-process command. It accepts only registered
operation/evidence identities and binds the operation manifest and validation
receipt to the existing envelope inventory, digests, backup, SQLite profile,
durable snapshot, and validation-authority verifier. It never reads an Owner
secret or creates a mutable authorization. Explicit RECOVER reconciliation
remains part of the later crash and recovery boundary.

Day15-T3B15-T5 exercises the operation boundary in fresh OS processes. The
drills use the real append-only operation Control SQLite store and inject
process termination before authorization, after authorization, after artifact
publication, and after result commit. They also race durable Stop around
authorization, attempt exact and changed replay, and independently inspect
authorization, result, artifact, Stop, and ownership truth after restart.

Fixed Alpha validation additionally preloads version-controlled Node
`network-disabled-bootstrap.cjs` and Python `sitecustomize.py` guards into
validation children. The guards
replaces HTTP, HTTPS, socket, TLS, datagram, DNS, Fetch, and WebSocket entry
points with deterministic rejection. Their bytes participate in the validation
suite fingerprint, while the fixed environment removes credential-like and
proxy state. This is a validation-process isolation boundary, not a general
host firewall or permission to compose network providers.

Independent Day15-T3B15-MR1 does not accept this foundation for rehearsal
execution. Post-ownership authority is not fully revalidated, Stop can race
phase/result completion, returned phase evidence is not independently
reconstructed, and fresh verification does not open the T3B15 Control ledger
or reconstruct validation-receipt authority. Ambient executable resolution,
ignored untracked files, runtime-only network guards, the missing closed
composition root, authorization-consumption integrity, and non-completed
phase progression also require correction. The architecture therefore retains
`NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL` and permits only T3B15-C1
correction followed by a new independent MR2.

Day15-T3B15-C1 corrects the operation authority chain. After ownership, the
gate reopens readiness and Control truth before authorization. Phase evidence
must match a separate durable observation, durable Stop is checked inside the
result transaction, and non-completed results cannot advance the plan.
Control schema `1.1` stores immutable operation validation receipts and exposes
query-only complete history for final verification. Final verification
reconstructs validation and authorization/result/Stop authority rather than
accepting caller-injected receipt objects.

Validation resolves the real Node executable and its adjacent npm CLI, rejects
all influential untracked files, and inherits Node/Python guards that also
deny unapproved subprocess escape. An exact closed composition exposes only
PREPARE, STEP, VALIDATE, FREEZE, and PACKAGE adapters with separate action and
durable-observation authority. This remains application-level trusted-code
isolation, not a host firewall. C1 grants no run authority; independent MR2
must review the correction before any separate rehearsal decision.

Independent Day15-T3B15-MR2 confirms the C1 Stop/result, authorization,
non-completed-result, validation-receipt, Control-history, and untracked-file
corrections, but does not accept the operation for rehearsal. The current
composition delegates action and observation to the same concrete phase
adapter, so the observation is not structurally independent. There is also no
production composition root or exact package command binding the real five
phase adapters, registry, writable Control store, query-only fresh verifier,
Owner authentication, Stop, and ownership boundaries.

Git authority is still resolved from ambient `PATH`; filesystem authority may
drift after post-ownership inspection and before invocation; and the
trusted-code Node/Python guard retains untested child-process, worker, Python
exec, and Git escape classes. Control schema `1.1` also needs an explicit
upgrade/replacement rule, and a validation receipt committed before its Control
result needs deterministic recovery. Therefore the architecture retains
`NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL` and permits only T3B15-C2
correction followed by a new independent MR3.

Day15-T3B15-C2 makes those authorities structurally distinct. One exact
five-phase mutation composition can only invoke phase adapters; a second exact
five-phase composition can only reopen and observe durable truth. The same
concrete object is rejected at assembly. A closed production-shaped runtime
binds registry, Control, readiness, local Owner verification, Stop, ownership,
both compositions, staged validation evidence, and fresh final verification.
It intentionally exposes Preflight, Status, and final verification only—there
is no execution method or package command before MR3.

Git is a registered canonical executable plus SHA-256 file identity, and
validation uses fixed Node, Git, and Python identities. A structural authority
seal over commit, clean-tree, package, suite, registered total, registered
roots, fixture binding, capabilities, approval, and Stop state is checked
again immediately before authorization and after phase observation. Drift
fails closed; post-authorization drift preserves ambiguity.

Control `1.0` handling is explicit: a structurally present empty store may
migrate to `1.1` in one immediate transaction, while a non-empty `1.0` store
returns `MIGRATION_REQUIRED` without adding `1.1` objects. Validate evidence is
staged only in process and is persisted in the same SQLite transaction as its
bound phase result, so a durable validation receipt cannot exist without that
result. Node isolation rejects non-absolute or unregistered executables,
non-read-only Git actions, cleared guard environments, and Worker threads;
Python additionally denies subprocess, spawn, `posix_spawn`, fork, and
`os.exec*` escape. These remain application-level trusted-code controls, not a
host firewall. C2 grants no rehearsal authority and requires independent
T3B15-MR3.

Independent Day15-T3B15-MR3 reviews exact C2 commit `385aa9b` and returns
`NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`. It accepts C2's canonical
digest-bound Git, atomic normal Validate receipt/result path, fail-closed
non-empty legacy handling, tested Node/Python escape denial, query-only Control
reads, and deliberate absence of an execution method.

The operation is still not closed end to end. Durable observation is an
injected interface rather than a concrete query-only reconstruction from the
rehearsal SQLite store. The production-shaped runtime receives rather than
fixes its real adapters, six roots, stores, Owner, Stop, ownership, executable
identities, and verifier. Node and Python lack digest identity; transient
authority substitution may occur between seal checks; guard/Git allowlists do
not bind the complete child invocation; legacy migration does not recognize an
exact schema; standalone validation-receipt persistence remains reachable; and
final verification does not independently reopen both durable stores
query-only in a fresh OS process.

Therefore the next permitted work is T3B15-C3 correction followed by a new
independent MR4. No real Operation Manifest or rehearsal is authorized.

Day15-T3B15-C3 closes those implementation gaps while preserving the
non-executable boundary. A concrete durable observer independently opens the
registered rehearsal database read-only/query-only and reconstructs verified
phase truth. The fixed composition root constructs its Control repository,
durable observer, and child-only final verifier from registered roots; those
authorities can no longer be replaced by caller implementations. Final
verification requires a dedicated process and independently reopens the live
rehearsal store, query-only Control history, and the immutable packaged backup.

Git, Node, Python, and both network guards are bound to canonical paths and
SHA-256 identities and are checked immediately before and after validation.
Consumed authorization records bind the immutable post-ownership authority
snapshot. Git and child admission use exact argument sets, exact guard
environment values, disabled external diff/text conversion, and no ambient
Git helper/config environment. Control migration recognizes only the exact
reviewed 1.0 schema, verifies exact 1.1 on every open, rejects lookalikes, and
classifies an orphan validation receipt as explicit recovery-required truth.
The public standalone validation-receipt write is removed.

C3 focused authority evidence passes `3/3`, Control passes `42/42`, and the
complete validation bundle passes `2469/2469`. The new fixed runtime remains
`NON_EXECUTABLE_PENDING_INDEPENDENT_MR4`; C3 creates no real manifest, invokes
no rehearsal, and grants no provider, network, recommendation, order,
execution, or capital authority.

Independent Day15-T3B15-MR4 reviews exact C3 commit `43bcca8` and returns
`NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`. It accepts C3's exact Control
schema recognition, transactional Validate path, orphan-receipt handling,
query-only durable-store access, digest-bound executable/guard identities, and
narrowed Git/child admission.

MR4 finds that the non-executable composition still accepts caller-supplied
phase adapters and several critical authorities rather than internally
constructing the real five-stage T3B14 composition. The durable observer
reopens SQLite query-only but still incorporates claimed evidence instead of
rebuilding the entire phase result from durable records. Authorization binds a
partial readiness snapshot rather than complete executable, guard, root,
store, and adapter authority at every phase boundary. The fresh-process test
proves a safe fail-closed path, not a positive `PASS` over real Control,
rehearsal, envelope, and packaged-backup evidence.

Day15-T3B15-C4 removes claimed phase evidence from the authority path. The
observer now rebuilds PREPARE and STEP from registry, transition, claim, and
invocation records; VALIDATE from an append-only fsync-backed validation
journal; FREEZE from the durable evidence plan and transition history; and
PACKAGE from the published immutable envelope manifest. The operation
validation adapter writes its receipt to the journal before returning claimed
evidence, while Control still commits the bound validation receipt and result
atomically.

One digest-bound phase-authority snapshot now includes all six registered
root identities, Node, both network guards, reviewed real phase-source files,
the closed mutation composition, and the query-only durable-truth composition.
The gate recomputes it before authorization and after mutation; pre-consumption
drift mutates nothing, while post-consumption drift preserves ambiguity.
Final envelope verification now binds to the underlying rehearsal manifest
fingerprint carried by the Operation Manifest proposal.

C4 positive evidence builds the real T3B14 rehearsal state, Control history,
published envelope, and packaged backup, then verifies all four in a new OS
process. Adversarial coverage rejects phase-authority drift, validation-journal
tampering, and packaged-artifact substitution. Focused Control tests pass
`44/44`, C3 authority tests pass `3/3`, C4 authority tests pass `3/3`, and the
complete validation bundle passes `2474/2474`.

The corrected runtime remains
`NON_EXECUTABLE_PENDING_INDEPENDENT_MR5`. The next permitted task is an
independent T3B15-MR5 review. No real Operation Manifest, rehearsal, provider,
network, recommendation, order, execution, or capital authority is authorized.

Independent Day15-T3B15-MR5 reviews exact C4 commit `7d1e11a` and returns
`NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`. It confirms C4's durable-only
observation, validation journal, repeated phase-authority calculation, and
positive fresh-process verifier.

MR5 finds that the target fixed runtime still accepts caller-supplied
mutation adapters, readiness, Owner, Stop, ownership, validation staging, and
raw Control/Rehearsal/evidence paths. Its composition fingerprint does not
identify the actual adapters. Registered-root authority can therefore describe
different paths from those the runtime opens. The runtime also fails to pass
the new validation journal and evidence root into its observer, making
VALIDATE and PACKAGE incomplete through that composition. Finally, the
positive C4 process test manually prepares Control history rather than driving
the target fixed runtime and Operation gate.

The next permitted implementation is T3B15-C5: a truly closed composition that
uses only registry-resolved roots, internally constructs every mutable and
control authority, binds concrete adapter identities, wires journal/evidence
observation, and proves one end-to-end gate-generated positive process path.
Independent MR6 remains mandatory. No real Operation Manifest or rehearsal is
authorized.

Personal MVP-T3G-C3 binds the first corrected live-smoke evidence back into the
deterministic provider coverage gate. Alpaca Basic IEX has a reviewed adapter,
but its 2026-07-24 P1D response omitted required symbol `MULS`; the exact
12-symbol provider path is therefore `BLOCKED`. The other symbols remain
pending because PT1H, PT15M, PT5M, and latest Quotes did not run. The diagnosis
does not infer whether the omission was caused by no IEX observation, metadata,
halt, or provider availability. A missing Bar cannot be synthesized,
substituted, or treated as full-market evidence. This correction adds no new
network, persistence, recommendation, or trading authority. See
[Alpaca Personal Market Data Coverage Diagnosis](specifications/ALPACA_PERSONAL_MARKET_DATA_COVERAGE_DIAGNOSIS.md).

Personal MVP-T3G-C4 introduces a separately Owner-gated, read-only diagnostic for
exact symbol `MULS` through Alpaca's Paper Assets endpoint. The default operation
is a zero-network dry run. A later confirmed operation can issue exactly one
`GET /v2/assets/MULS` request with no retry, redirect, pagination, persistence,
or access to orders, accounts, or positions. The validator accepts only the
reviewed bounded asset schema and emits a sanitized classification from symbol,
asset class, exchange, status, and tradability; raw provider payloads, asset IDs,
names, credentials, and borrow details never cross the diagnostic boundary. Even
an active/tradable result cannot qualify IEX Bars, Quotes, liquidity, or the
complete provider. No real C4 request is authorized by this implementation. See
[Alpaca MULS Asset Metadata Diagnostic](specifications/ALPACA_PERSONAL_MULS_ASSET_METADATA_DIAGNOSTIC.md).

Personal MVP-T3G-C5 records the later Owner-authorized C4 result: one exact
Paper Assets request completed with HTTP 404 and sanitized `ASSET_NOT_FOUND`,
with zero retries, writes, account access, or order access. A deterministic
alternative-provider planner preserves all 12 symbols and selects no provider.
It rejects Alpaca Basic for the complete path, prioritizes network-free Twelve
Data capability research, defers Alpaca SIP until exact coverage and cost
approval exist, and keeps multi-provider composition behind a separate
architecture review. It grants no network, purchase, collection,
recommendation, or trading authority. See [Personal Market Data Alternative
Provider Qualification](specifications/PERSONAL_MARKET_DATA_ALTERNATIVE_PROVIDER_QUALIFICATION.md).

Personal MVP-T3G-C6 performs the planned network-free Twelve Data qualification.
It binds the exact C5 plan, preserves all 12 symbols and four Bar intervals, and
calculates provider-credit feasibility without using a credential or transport.
The result is `NOT_QUALIFIED_AS_COMPLETE_PROVIDER`: exact `MULS` coverage,
two-sided Quote fields, and Quote quantity semantics remain unverified; P1D and
live Bar volume units remain blocked; and the Basic allowance cannot support
the intended five-minute 12-symbol decision cadence. Twelve Data remains a
Bars-research candidate only and gains no network, collection, recommendation,
or trading authority. See [Personal Market Data Twelve Data Qualification](specifications/PERSONAL_MARKET_DATA_TWELVE_DATA_QUALIFICATION.md).

Personal MVP-T3G-C7 is a design-only boundary for one exact Twelve Data `MULS`
ETF reference diagnostic. It freezes `GET /etfs/list` with exact symbol and
country filters, one page, one record, one request, one credit, a ten-second
timeout, bounded response size, default dry run, strict identity validation,
sanitized results, and terminal stop semantics. It explicitly rejects the
legacy `/etf` path and grants no implementation or network authority. See
[Twelve Data Personal MULS Reference Diagnostic](specifications/TWELVE_DATA_PERSONAL_MULS_REFERENCE_DIAGNOSTIC.md).

Personal MVP-T3G-C8 implements the network-free C7 core: immutable fixed-request
contracts, an exact `/etfs/list` planner, strict bounded response validation,
the existing redacted Twelve Data credential handle, and an injected Transport
seam that must attest `FIXTURE_ONLY` and `networkCapable=false`. Dry run invokes
no Transport; fixture rehearsal invokes it once while network request counts
remain zero. No concrete HTTPS Transport, CLI, persistence, provider selection,
recommendation, or trading authority exists.

Personal MVP-T3G-C9 adds a dedicated exact-host HTTPS Transport and local
command around the C8 parser. The Transport accepts only the frozen
`/etfs/list` request, injects the official `Authorization: apikey` header only
in memory, rejects every endpoint/query/budget mutation, and terminates after
one response or failure. The command remains zero-network by default; a live
attempt requires the exact confirmation flag, current UTC date, and immutable
request fingerprint. Automated tests inject a fake executor. No real request is
authorized by the implementation, and no persistence, collection, provider
qualification, recommendation, portfolio, broker, order, or trading path is
added. See [Twelve Data Personal MULS Reference Live Operation](specifications/TWELVE_DATA_PERSONAL_MULS_REFERENCE_LIVE_OPERATION.md).

Personal MVP-T3G-C10 adds a second fail-closed disclosure boundary for non-2xx
responses from that exact operation. It reads only a bounded JSON object,
copies only allow-listed top-level provider-error fields, normalizes and caps
the message, redacts configured and secret-shaped credentials, and re-sanitizes
the result at the live-operation boundary. Unknown fields and raw bodies remain
unobservable. C10 changes diagnostic quality only: the one-request limit, fresh
Owner authorization, no-retry rule, zero persistence, and absence of market,
recommendation, account, order, and trading authority remain unchanged.

Personal MVP-T3G-C11 closes the current complete-provider qualification round.
It converts the separately authorized C10 result into immutable
`SYMBOL_NOT_FOUND` evidence without retaining the provider narrative or raw
payload. Alpaca Basic IEX and Twelve Data Basic remain rejected as complete
providers for the exact 12-symbol requirement; Alpaca SIP remains deferred;
no replacement provider is selected. The only permitted continuation is
network-free research of new zero-cost candidates. See
[Personal Market Data Provider Qualification Closure](specifications/PERSONAL_MARKET_DATA_PROVIDER_QUALIFICATION_CLOSURE.md).

Personal MVP-T3G-C12 performs a network-free official-evidence screen of five
zero-cost candidates. Massive Basic, Finnhub Free, Alpha Vantage Free, and FMP
Basic fail the exact intraday Bars and current two-sided Quote requirement.
Tradier documents the strongest capability fit, but its real-time data requires
a brokerage account and a production credential belonging to a broader
brokerage API surface. It advances only to a read-only credential-isolation and
exact-symbol diagnostic design review; it is not selected or authorized. See
[Personal Market Data Zero-cost Provider Screening](specifications/PERSONAL_MARKET_DATA_ZERO_COST_PROVIDER_SCREENING.md).

Personal MVP-T3G-C13 records the Owner's prospective withdrawal of `MULS` and
freezes the active personal set at eleven ordered symbols. Historical C5-C12
evidence continues to bind the former twelve-symbol requirement. Active
watchlist mapping, Alpaca planning, normalization, and provider assessment no
longer include `MULS`; the MU bullish `MULL` path remains. Alpaca Basic IEX
returns to `READY_FOR_BOUNDED_SMOKE`, not collection readiness, because the
complete four-interval plus latest-Quote path still requires a fresh bounded
verification. No network request, Tradier integration, Paper-account access,
recommendation, order, or trading authority is added. See
[Personal Market Data Eleven-symbol Scope Correction](specifications/PERSONAL_MARKET_DATA_ELEVEN_SYMBOL_SCOPE_CORRECTION.md).

T3G-C13-C1 corrects the active catalog's immutable identity to registry version
`1.1` with a new creation time. It removes both real-MULS package command
surfaces and installs a shared fail-closed retirement gate at the start of each
retained foreground script, before arguments, credentials, or Transport can be
examined. Historical diagnostic engines and fixtures remain auditable; they
carry no live operational authority.

---

# Event Contract Framework

Event contracts are considered a temporary capital-building tool.

Their purpose is:

- Build capital
- Generate stable cash flow
- Improve execution discipline

They are NOT Alpha's final investment objective.

---

# Long-Term Investment Framework

As capital grows, Alpha gradually shifts toward:

- High-quality stocks
- Long-term ownership
- Dividend growth
- Capital appreciation

The percentage allocated to event contracts should decrease as long-term investments increase.

---

# Design Principles

Every module must satisfy:

- Small and independent
- Easy to test
- Easy to replace
- Easy to expand

Large refactoring should be avoided whenever possible.

---

# Decision Intelligence and Learning Flow

Research Framework
|
v
Opportunity Score Engine
|
v
Prediction Log (Forecast Freeze)
|
v
Instrument Ranking Engine
|
v
Evidence Assessment Gate
|
v
Decision Engine Evaluation
|
v
Risk Engine Review
|
v
Permitted Downstream Action, If Any
|
v
Execution
|
v
Trade Outcome Log (planned)
|
v
Strategy Review Foundation
|
v
Candidate Knowledge (local foundation)
|
v
Owner Knowledge Approval (local foundation)
|
v
Approved Knowledge (local foundation)
|
v
Strategy Change Proposal (future separate gate)
|
v
Strategy Versioning
|
v
Future Decision Improvement

The Prediction Log precedes the final decision and execution so Alpha can preserve the original forecast without hindsight changes.

The Portfolio System and Config System provide control inputs across the flow. Required evidence must pass the deterministic Evidence Assessment gate before Decision Engine evaluation. The Risk Engine may then reject or constrain a proposed decision before any downstream action is permitted. The Dashboard presents state and outputs but does not own decision logic. The Alpha Journal may summarize decisions and lessons but does not replace source records.

Execution is currently an external, owner-controlled action. Future broker integration must not bypass owner approval, the approved trade plan, or Risk Engine limits.

Strategy Review does not make the durable Trade Outcome Log production-ready. It reviews only explicit finalized read snapshots, preserves prediction quality, execution quality, risk discipline, and profitability independently, and cannot reopen a completed trade or change a strategy.

Knowledge approval occurs only after completed Strategy Review. One outcome may create a candidate but does not normally create durable Approved Knowledge. Approved Knowledge remains informational until a separate Strategy Change Proposal passes its own validation and owner approval and becomes a new immutable Strategy Version. Existing active or frozen plans are never mutated by this learning path.

---

# Future Expansion

Future systems may include:

- Production-grade transactional AI workflow, reservation, ledger, and audit persistence or a reviewed outbox architecture
- Durable provider-execution claims and provider-billing reconciliation
- Production provider adapters and durable, crash-recoverable runtime workflow execution
- Historical Analogy Engine product integration and production hardening
- Event Replay product integration and production hardening
- Portfolio Analytics
- Backtesting Engine
- Mobile Dashboard
- Multi-Broker Support

---

# Architecture Goal

Alpha should remain maintainable for many years.

Every new feature must strengthen the system instead of increasing unnecessary complexity.
