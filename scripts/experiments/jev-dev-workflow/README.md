# Jev developer workflow benchmark — v1

**Disposition: NEEDS_MORE_EVIDENCE. External inference stopped at authentication.**
This is an isolated developer experiment, NOT_IMPORTED_BY_PRODUCTION and
NOT_USED_BY_ALPHA_RUNTIME. No MCP, router integration, service, dependency,
schedule, trading calculation or production import was added. Stop here for
Owner review; this artifact is not an adoption recommendation.

## Actual result — September 20, 2026

| Item | Evidence |
| --- | --- |
| `OPENROUTER_API_KEY` | AVAILABLE in the developer process; existence does not prove authentication |
| Requested model | Fixed `typesafe/jev-1.13`; no latest/fallback model |
| Official endpoint catalog | HTTP 200; TypeSafe endpoint names `typesafe/jev-1.13-20260917`, text-to-decisions, 32,000 context |
| Decision endpoint | `POST https://openrouter.ai/api/alpha/decisions`, CHOICE |
| Smoke A | HTTP 401; no decision, served-model identity, probabilities, request ID or usage returned to the retained record |
| Request / receipt | 2026-09-20T22:39:35.879Z / 22:39:36.036Z |
| Latency | 156.853 ms for the authentication failure only; not model inference latency |
| Input | 597 serialized request bytes, 69 state characters; request SHA-256 retained |
| Smoke B / C | NOT_ATTEMPTED after A failed authentication |
| Jev Decisions requests | 1 attempted; 0 successful; no retries |
| Historical dataset | 38 decision questions across 27 episodes |
| Path A | 8 / 38 resolved locally (21.05%); all 8 match documented gold; 30 UNKNOWN |
| Path B | NOT_RUN; smoke acceptance prerequisite not met |
| Jev eligible / evaluated historical cases | 30 / 0 |
| Jev accuracy / incremental coverage | UNKNOWN / UNKNOWN |
| FALSE_CONTINUE / FALSE_ASK_OWNER | NOT_MEASURED; rates UNKNOWN, not zero |
| Successful Jev median / p95 | UNKNOWN / UNKNOWN; one failed request does not support p95 |
| Input / output tokens and USD cost | UNKNOWN; no usage/cost evidence from the 401 |
| Owner interruptions avoided | UNKNOWN; no decision was delegated to Jev and historical unnecessary-interruption counts are unavailable |
| Codex token/time savings | UNKNOWN; no comparable baseline measurements |

The fixed configured date-version is recorded at the top of the smoke artifact
as `servedModel`; this is the expected pin, **not** an observed model response.
The per-request `result.servedModel` is correctly null. Likewise that artifact's
`jevEvaluated: 1` counts an attempted smoke request, not a successful inference
or a historical benchmark case. The offline inventory keeps historical
`jevEvaluated: 0` and all unmeasured quality metrics null.

The bearer request shape and endpoint were checked against official documentation
and an injected-transport test. No documented client/schema discrepancy was
identified. HTTP 401 establishes rejection at authentication; it does not identify
whether the inherited credential is stale, invalid, disabled or rejected for
another reason. Error bodies and arbitrary headers are deliberately not logged.
No alternate credentials, account endpoint, top-up, consent or new authentication
flow was attempted. No further live requests were used to diagnose the key.

**External next step:** Owner should verify/replace the credential through the
existing OpenRouter/environment mechanism and restart the developer process if
needed so it inherits the intended `OPENROUTER_API_KEY`. Never paste the secret
into this task. Preserve this failed receipt. A separately reviewed continuation
can use a new explicitly named result version; the current CLI refuses to
overwrite or rerun its existing v1 artifacts.

## Dataset and comparison protocol

[cases.json](cases.json) contains case ID, sanitized pre-decision state, decision
type, historical gold, document path/hash/line/anchor, episode ID and hard gate.
Gold is extracted from inspected historical Alpha delivery records and completed
actions, not requested from Jev or another fresh model judgment. The extraction
was performed by Codex and is not independently human relabeled. Labels describe
the documented disposition, not an independently certified general truth.

There are 16 triage, 10 routing, 8 continue/Owner and 4 validation-scope questions.
Several questions share an episode; 38 rows are not 38 independent incidents.
States are sanitized reconstructions and sometimes include an already diagnosed
observation, so this is easier than blind root-cause debugging. It is a convenience
sample, not a random or sealed holdout. There is no model quality result yet.

- Path A: explicit machine-readable hard gates, change-scope flags and actual
  clock comparisons resolve a question; otherwise UNKNOWN. No keyword classifier
  or hand-coded gold lookup is disguised as deterministic inference.
- Path B: only unresolved semantic CHOICE inputs are eligible. Send only the
  sanitized development state plus the fixed rubric. Never send case ID, episode,
  historical gold, source documents, outcome or local path.
- Path C: the historical completed disposition is the gold/baseline. Do not ask
  a second model to answer the same cases. Historical latency, tokens and
  unnecessary interruption counts remain UNKNOWN.

Known environment status, process exit status, test counts, dirty state, file
existence, compilation success, HTTP status, numerical budget checks, explicit
permission flags and branch names must be checked by ordinary software. They
are not Jev questions. The experiment itself reads the key status, HTTP result,
cost totals, file existence, clocks, hashes and artifact reservations locally.
The four validation questions and future-window case exercise these explicit
facts. Three historical authorization boundaries exercise hard gates locally.

Ten non-overridable hard gates are tested: new paid service, new external
permission, secret exposure, destructive migration, force push, history rewrite,
main merge, trading boundary, automatic execution and capital/risk policy.
Not all ten occurred in this historical sample; missing incident coverage is not
filled with invented history. Their isolated safety tests are separate from gold.

FALSE_CONTINUE uses historical ASK_OWNER semantic cases as its denominator;
FALSE_ASK_OWNER uses historical CONTINUE semantic cases. Deterministic hard-gate
blocks must be shown separately; they are not evidence of Jev's safety accuracy.
Failed or malformed responses are UNKNOWN and cannot trigger an action. Returned
confidence/probabilities, if ever available, are provider values, not calibration
validated by this experiment. The report generator also lists triage labels and
exact outcome pairs rather than hiding errors behind an overall score.

## Minimal client and reproducibility

Only built-in Node modules/fetch are used. The actual environment is Windows
PowerShell with the repository's existing Node runtime. The documented native
CHOICE Decisions schema was used; no chat-completion workaround or SDK was
installed. The public documentation browser could not retrieve the specific
reference page; an anonymous direct GET to the same official URL returned 200.
This is a documentation-read issue, separate from the authenticated 401.

Client limits: a fixed model/provider, no provider fallback, no redirect, 15-second
total deadline, 16,000 request bytes, 65,536 response bytes, one request per eligible
case, no retry. Model/provider drift, invalid choice/distribution, HTTP failure,
timeout, missing key, duplicate result file and unknown reported cost stop or
fail closed. Response free text and exception messages are never logged. Only
explicit metadata and validated typed decisions can be retained. No request
payload includes private source text, account data, market records or keys.

The published endpoint price was $0.000000042/input token and $0/output token.
This is a catalog quote, **not** proof this failed request cost zero. The client
uses that price ceiling and a local $0.01 reported-cost stop per phase; the latter
is checked between calls, not a provider-side hard spend guarantee. Unknown cost
stops further requests. No purchase or credit reset was made.

All decisions are shadow-only with executionAllowed false. No execution callback,
agent-control tool, process launch, trading action or automatic Owner interruption
is connected to a model label. A second local hard-gate check protects composition
even if state changes while a hypothetical decision is pending.

From the repository root:

```text
node --test scripts/experiments/jev-dev-workflow/experiment.test.mjs
```

This replays local injected tests and verifies actual artifact hashes/anchors with
zero external calls. `run.mjs smoke` and `run.mjs benchmark` are explicit live
operations, not tests. Smoke reserves its result before any call; the benchmark
requires three successful expected smoke decisions on the pinned model. Both
refuse existing output paths. No benchmark output was created in this run.
`run.mjs offline` created the one-time local inventory. `summary` is available
only after a real benchmark artifact exists. No command is added to production
package scripts, the app bundle or the normal Alpha validation suite.

[smoke-v1.json](results/smoke-v1.json) preserves the failed request clocks, request
hash, client hash, original runner hash and failure outcome. The runner gained
offline-only inventory/report checks afterward; the smoke receipt was not edited.
[offline-v1.json](results/offline-v1.json) binds final dataset/client/runner hashes
and reproduces each local disposition. No raw provider body, secret or private
runtime log is stored in these reviewable artifacts.

## Verification, complexity and adoption

Focused offline tests pass **21 / 21**: missing key, no secret leakage (including
echoed error/success bodies), deterministic zero-call routing, invalid response,
deadline, no retries, all hard gates and a late guard, prompt/gold separation,
shadow-only behavior, official request shape, source anchors, request hashes,
offline inventory and explicit safety-rate denominators. No Alpha product code
changed; its full suite was deliberately not repeated. Secret scan, production
import exclusion and worktree/staged whitespace checks are also required before
the scoped development-branch commit.

Eight added experiment files: this README, `decision.mjs`, `run.mjs`,
`experiment.test.mjs`, `cases.json`, two sanitized JSON results and a scoped
`.gitattributes`. No dependency or runtime configuration changed. The single
development-only line-ending file keeps these experiment hashes stable on Windows.
Historical Markdown hashes retain the inspected bytes; verification permits only
equivalent LF/CRLF serialization, never content changes. Three executable/test
source files total 197 nonblank lines; most artifact size is historical cases.
Maintenance includes an alpha API schema, fixed served-model pin, typed response
validation, secret-safe failures, deadlines, budget stops and artifact lineage.

Observed API failure: authentication. Rate limiting, upstream inference failure,
model drift and sustained schema stability were **not exercised live**. No Windows
process/environment defect was established; the inherited key was readable. A
catalog listing is not proof of authenticated model availability.

There is no measured accuracy, latency advantage, cost advantage or reduction
in unnecessary Owner interruptions. Therefore **NEEDS_MORE_EVIDENCE**, not
ADOPT_CANDIDATE or a claim the model itself is unsuitable. No MCP, developer
decision service or Alpha runtime integration starts from this result.

Official references checked for this experiment:

- [OpenRouter Decisions API](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request.md)
- [Fixed model endpoint catalog](https://openrouter.ai/api/v1/models/typesafe/jev-1.13/endpoints)
- [Jev 1.13 model page](https://openrouter.ai/typesafe/jev-1.13)
- [TypeSafe Choice primitive](https://docs.typesafe.ai/primitives/choice)
