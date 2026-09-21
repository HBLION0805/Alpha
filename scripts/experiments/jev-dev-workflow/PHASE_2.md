# Jev prospective shadow phase 2

Supporting developer experiment only: NOT_IMPORTED_BY_PRODUCTION and
NOT_USED_BY_ALPHA_RUNTIME. Normal authorized Alpha work remains primary.
This protocol does not select a new product task, create a timer, or run after a
development session ends. No MCP, service, dependency, router or trading change.

## Enrollment and authority

Only two natural, unresolved semantic decision families are eligible:

- `OWNER_GATE`: CONTINUE / ASK_OWNER / UNKNOWN.
- `TRIAGE`: CODE_REGRESSION / TEST_ASSUMPTION / ENVIRONMENT /
  EXTERNAL_DEPENDENCY / DATA_STATE / DOCUMENTATION_ONLY / UNKNOWN.

Routing, document categorization and test-scope routing are excluded. Known HTTP
status, exit codes, file existence and explicit policy flags are deterministic
facts. If those facts already settle the question, record the local conclusion
in normal development evidence and make no Jev call. An observed HTTP failure
does not necessarily establish its root cause; an unresolved cause may qualify.

All ten historical hard gates remain authoritative: new paid service, new external
permission, secret exposure, destructive migration, force push, history rewrite,
main merge, trading-boundary change, automatic execution change and capital/risk
policy change. Any present gate skips the model. Scope authority comes from the
Owner and project policy; a model label never supplies permission.

Use only subsequent real Alpha episodes, not phase setup, unit tests, rewritten
historical states or deliberately created failures. Target 30–50 semantic points;
the local cap is 50 attempted points and two per episode. A second point needs
a genuinely distinct decision and a recorded independence basis. Exact repeated
states, IDs and historical dataset states are rejected. Paraphrases and episode
identity cannot be reliably authenticated by software: the recording Codex must
not manufacture or split episodes. Correlated points must remain disclosed.

No minimum ASK_OWNER quota is manufactured. Insufficient natural ASK_OWNER cases
remain insufficient evidence. Reaching 30 or 50 does not automatically qualify
adoption. Do not delay product work until samples or outcomes become available.

## Version, cost and failure boundaries

Fixed `typesafe/jev-1.13`, expected served version
`typesafe/jev-1.13-20260917`, provider TypeSafe; existing Decisions CHOICE endpoint,
price ceiling, 15-second deadline and response/input bounds. No latest, fallback,
retry, chat-completion route, key purchase or subscription. The immutable v1/v2
client and artifacts remain unchanged. A small phase-specific transport adapter
reuses its constants, request sanitization and response schema, adding UNKNOWN
only to the phase-2 Owner choices. Its first real API use is not yet verified;
no artificial smoke case is authorized just to start this phase.

Use the existing dedicated key through the process environment. Print only its
availability if checking it; never save the secret or authentication header.
The existing local reported-cost stopping limit is **$0.01 per phase**. Phase 2
accumulates across sessions, without per-command reset. The key's actual provider
budget is not queried or changed. The local limit is checked between calls and
is not a provider-side hard spend guarantee; API-reported cost is recorded, not
inferred from the price ceiling. Historical v1 unknown fees and v2 reported fees
remain separate, not converted to zero or charged again to this phase's records.

Any provider, schema, model, timeout or unknown-cost failure stops further Jev
sampling. No auto-resume or retry command exists. Ordinary Alpha work continues.
An incomplete receipt makes both actual request count and total cost UNKNOWN;
it does not authorize trying the same case again. Concurrent captures use one
exclusive phase lock; a crash-held lock is left for review, never silently removed
by the next invocation. No result can execute commands or trigger Owner messages.

## Private append-only workflow

All states, receipts, actions and outcomes live under ignored
`data/runtime/jev-dev-workflow/phase-2/`. Keep prepared JSON files in that same
private area. Do not add the directory to Git or copy provider free text into it.
Only sanitized protocol/code and later aggregate reports may be committed after
review. Inputs and original receipts use exclusive creation, never replacement.
The phase manifest pins the policy, original dataset and code fingerprints.

The explicit CLI is `scripts/experiments/jev-dev-workflow/prospective.mjs`.
Run from the repository root; these are manual developer commands, not a scheduler.

1. `init`: creates the private manifest once; no inference and no samples.
2. `capture <private-input.json>`: validates eligibility, saves the state using
   the actual current clock, reserves the case, makes at most one request and
   saves its sanitized receipt. Returns receipt status, not the recommendation.
3. `action <caseId> <private-action.json>`: records what Codex actually did under
   the unchanged workflow, then permits viewing the shadow result. Do not wait
   for or consult Jev to decide what to do.
4. `label <caseId> <private-outcome.json>`: after the actual outcome is established,
   appends verified gold and its evidence basis. An unresolved outcome can instead
   be recorded as UNKNOWN with verified false, and is excluded from accuracy.
5. `review <caseId>` / `report`: local-only recovery and metrics; no inference.

Full invocation prefix:

```text
node scripts/experiments/jev-dev-workflow/prospective.mjs
```

Capture JSON fields (no gold, final outcome or actual Codex action allowed):

| Field | Meaning |
| --- | --- |
| caseId / episodeId | Stable safe local IDs; never sent to Jev |
| decisionType | OWNER_GATE or TRIAGE |
| sanitizedState | Only facts known at this decision, without secrets, paths or later outcomes |
| hardSafetyFlags | Explicit array of applicable existing hard-gate constants; empty only after checking |
| deterministicResolution | null if genuinely unresolved; otherwise decision plus basis, which skips inference |
| independenceBasis | Why this is a distinct real decision, not a repeated episode fragment |
| newRealDecision / preDecisionOnly | Both true; Codex attestations, not machine proof or Owner approval |

The CLI generates decisionTimestamp; it does not accept a backdated timestamp.
Only sanitizedState plus the fixed question rubric and provider limits are sent.
Case IDs, episode IDs, independence notes, local evidence, actual actions, gold
and eventual outcomes stay local. Natural-language state still requires careful
human/agent sanitization; a field allowlist alone cannot prove absence of hindsight.

Action JSON fields: actualCodexDecision (the relevant family's label),
ownerInterruptionMade (boolean about an actual interruption, not a suggestion),
and basis (what was actually done and why under the original workflow). The local
save timestamp must follow the input timestamp. This is a Codex-reported action,
not independently observed execution or Owner verification. Missing actions stay
pending and must not be treated as zero actual interruptions.

Outcome JSON fields: goldLabel, verified, verifiedOutcome and goldBasis. Gold
must follow the saved actual action and cite concrete later evidence. For triage,
use the cause established by the real investigation/fix, not Jev's suggestion or
just a passing test. If unclear, use UNKNOWN / verified false. For Owner decisions,
use the actual authorization need and subsequent evidence, not merely whether an
Owner message was sent. Corrections require correctionReason and append a new
version linked to the previous version; earlier labels remain inspectable.
The same Codex's outcome review is not independent blind human labeling.

Recommendation display is deferred until the actual action is saved to reduce
feedback contamination. Private raw files remain locally readable; this is not a
blinding guarantee. Do not read the receipt early to alter the actual decision.

## Metrics and interpretation

`report` separates receipt failures, valid UNKNOWN, pending actions, unresolved
gold and verified outcomes. Zero denominators produce null rates, not perfect
accuracy. Pending/unrecoverable receipts produce unknown calls/cost with a known
subtotal separately. Successful latency is local elapsed request/response time;
p95 uses nearest rank only when at least 20 successful requests exist.

Owner reporting includes class counts, verified scored count, exact accuracy,
false_continue / false_ask_owner with their separate gold denominators, UNKNOWN,
recorded actual interruptions and the following counterfactuals:

- Would-have-avoided: an actual interruption with Jev CONTINUE.
- Would-have-added: no actual interruption with Jev ASK_OWNER.
- Verified unnecessary interruptions it would avoid: the first group with
  verified gold CONTINUE. Required interruptions it would miss are separate.
- Verified unnecessary interruptions it would add: the second group with
  verified gold CONTINUE. UNKNOWN never becomes CONTINUE.

These are hypothetical differences, not actual interruptions prevented by Jev.
FALSE_CONTINUE is more serious than FALSE_ASK_OWNER. An ambiguous UNKNOWN is a
safe abstention, though it can be an exact-label mismatch against later knowledge.
Do not hide failures or unresolved labels by reporting accuracy alone.

Triage reporting contains the seven-label confusion matrix, per-class count and
accuracy, UNKNOWN and case-level mistakes. Overall reporting contains successful
median/p95 latency, input/output tokens, API-reported cost, average per request,
known subtotal and categorized provider/schema/timeout/auth failures. No overall
accuracy substitutes for family-level performance.

The report deliberately does not auto-assign a disposition. After enough verified
prospective evidence, explicitly review low false_continue, meaningful supported
interruption reduction, triage quality, API stability and maintenance burden.
Only then choose ADOPT_CANDIDATE / NEEDS_MORE_EVIDENCE / REJECT. An adoption
candidate permits a separate Developer Decision Service / MCP evaluation decision;
it never creates that integration or grants action authority automatically.

## Setup verification — September 20, 2026

Focused local tests passed **46/46** (29 preserved historical checks and 17 phase-2
checks), using injected transport and temporary isolated stores. They
exercise the two families, pre-request persistence, action/gold separation,
hard-gate zero calls, duplicate/episode/sample bounds, cumulative cost stops,
concurrency, missing receipts, timeout/auth/schema/model/secret failures, UNKNOWN,
append-only gold corrections, clocks, restoration and counterfactual statistics.
Historical tests verify v1/v2 preservation. No production sample, live Jev call,
market request, product modification or auto-enrollment is part of setup.

```text
node --test scripts/experiments/jev-dev-workflow/experiment.test.mjs scripts/experiments/jev-dev-workflow/prospective.test.mjs
```

The private manifest was initialized at `2026-09-20T23:59:57.519Z`; the real local
CLI report read back `READY_FOR_NATURAL_DECISIONS`, zero natural prospective
decisions and zero Phase-2 API requests. The private directory is confirmed
excluded by Git. Syntax, existing Markdown checks, exact-secret/pattern scan,
production-import exclusion and worktree/staged diff checks passed. No full Alpha
product suite was rerun because no shared product code changed.

Initial state: zero natural prospective decisions and zero Phase-2 API requests.
This is readiness for later real development, not evidence of improved safety,
root-cause accuracy or fewer Owner interruptions. With no separately specified
new Alpha product task, do not invent backlog work to produce cases.
