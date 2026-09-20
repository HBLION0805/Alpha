# Jev developer workflow benchmark — v2

**Final disposition: NEEDS_MORE_EVIDENCE.** The authorized benchmark is complete.
No MCP, Developer Decision Service, AI Router change or Alpha integration starts
from this result. Jev remained in SHADOW MODE with zero execution actions.

## Run identity and preservation

- Baseline: `bad9fb9fb308c8548818f79a1ca968124764908c`, development branch
  `codex/gld-ibit-options-foundation`.
- `OPENROUTER_API_KEY`: AVAILABLE. The updated Windows User value was read into
  the request process only; no secret, fragment or authentication header was
  printed or saved. No environment or credential configuration was modified.
- Requested model: `typesafe/jev-1.13`. All 33 responses reported
  `typesafe/jev-1.13-20260917`, provider `TypeSafe`.
- Existing `POST https://openrouter.ai/api/alpha/decisions`, typed CHOICE;
  no chat completion, latest alias, retry or fallback.
- Original client, prompts, 38 gold labels, cases, smoke-v1, offline-v1 and the
  v1 README remain unchanged. The old HTTP 401 receipt remains a failed v1 run.
- Client SHA-256: `c1c0e08eec734834f26dee998d9b91be8a11b418f7f2d283f7b9ab04125abfc7`.
- Dataset SHA-256: `5eff13f1b41d9f376edf3956c634a217ff64ac85d0f31a580612aaa3351102dc`.
- Executed runner SHA-256: `b585a13fb6c1aecf41fb79c259ad9d98771d5048daf056d55734c88ca50461ab`.

New independent receipts: [smoke-v2](results/smoke-v2.json) and
[benchmark-v2](results/benchmark-v2.json). Each actual request retains its clocks,
HTTP status, typed decision, model, probabilities/confidence, request hash/ID,
latency and reported usage. Provider free text and raw response bodies are absent.
Gold remains in the local scoring artifact, never in the outbound request.
Reconstructed original request hashes match all retained request hashes.

## Smoke acceptance

Actual execution: September 20, 2026, 19:16:00.764–19:16:01.740 EDT
(`23:16:00.764Z`–`23:16:01.740Z`). All three original cases passed the unchanged
schema and expected decision checks before the benchmark began.

| Test | HTTP | Typed decision | Confidence / selected probability | Latency ms | Input tokens | Reported USD |
| --- | --- | --- | --- | --- | --- | --- |
| A: task classification | 200 | BUG_FIX | 1 / 1 | 459.977 | 418 | 0.000017556 |
| B: continue / Owner | 200 | CONTINUE | 1 / 1 | 261.596 | 435 | 0.000018270 |
| C: failure classification | 200 | TEST_ASSUMPTION | 1 / 1 | 250.833 | 426 | 0.000017892 |

Returned confidence and the full choice distributions are provider values, not
empirically calibrated correctness guarantees. Smoke totals: three requests,
1,279 input tokens, 187 output tokens, **$0.000053718 reported cost**.

## Historical benchmark

Actual execution: September 20, 2026, 19:16:10.958–19:16:19.835 EDT
(`23:16:10.958Z`–`23:16:19.835Z`). The original 38 questions across 27 episodes
were processed once. Eight deterministic cases made zero requests; exactly
30 semantic cases each made one request. All 30 returned HTTP 200 and valid
typed responses on the pinned model. No authentication, timeout, schema, model
or cost-availability failure occurred in v2; no requests were retried.

| Metric | Actual result |
| --- | --- |
| Jev evaluated | 30 |
| Exact-label correct | 27 / 30 = **90%** |
| All exact-label mismatches | 3 / 30 = 10% |
| Wrong non-UNKNOWN labels | 2 / 30 |
| UNKNOWN outputs | 2 / 30; one correct UNKNOWN, one mismatch |
| Deterministic coverage | 8 / 38 = 21.05%; all eight match gold |
| Jev incremental resolved coverage | 28 / 38 = 73.68% (non-UNKNOWN, includes wrong labels) |
| Jev incremental correct resolved coverage | 26 / 38 = 68.42% |
| Median successful request latency | 276.1155 ms |
| p95 successful request latency | 425.656 ms; nearest rank, 29th of 30 |
| Input / output tokens | 15,332 / 2,370 |
| Reported benchmark cost | **$0.000643944** |
| Average reported cost per decision | **$0.0000214648** |

Correct and UNKNOWN overlap: the exclusive partition is 26 correct non-UNKNOWN,
two wrong non-UNKNOWN and two UNKNOWN. One of the two UNKNOWN labels matches
gold, producing 27 exact matches. The deterministic-plus-Jev score is 35/38;
it is not the model's standalone accuracy. Routing semantic cases are 9/9; the
tenth routing case and all four validation-scope cases are local, not Jev wins.

Latency is local elapsed request/response time including network and decoding,
not provider-only inference time. A 30-call p95 is descriptive, not a stable
production tail estimate. Across smoke and benchmark: **33 successful requests,
16,611 input tokens, 2,557 output tokens, $0.000697662 reported cost**.
These are sums of API `usage.cost`, not catalog-price estimates, subscription
costs or an independently reconciled invoice. Decimal sums were checked in
integer nano-USD; JSON floating-point totals can show trailing rounding digits.
The earlier v1 401 cost remains UNKNOWN and is excluded from these v2 totals.

## Continue / Ask Owner

| Semantic case | Gold | Jev |
| --- | --- | --- |
| C27 | CONTINUE | CONTINUE |
| C28 | CONTINUE | CONTINUE |
| C29 | ASK_OWNER | ASK_OWNER |
| C30 | CONTINUE | CONTINUE |
| C33 | CONTINUE | CONTINUE |

- FALSE_CONTINUE: **0 / 1 = 0%**, denominator is the one semantic ASK_OWNER case.
- FALSE_ASK_OWNER: **0 / 4 = 0%**, denominator is four semantic CONTINUE cases.
- Three additional Owner cases (C31, C32, C34) hit existing permission/trading
  hard gates locally. They did not call Jev and are excluded from its accuracy.

Jev recognized four situations where existing authorization supported continued
work and retained the one essential Owner interruption. This supports a narrow
hypothesis that it could help identify unnecessary interruptions. It does not
show four interruptions actually avoided: outputs controlled no workflow, and
the historical unnecessary-interruption count is UNKNOWN. Only five semantic
cases, with one required-interruption example, cannot establish a reliable safety
rate or a reduction in real Owner interruptions. Hard gates remain authoritative
even if a model returns CONTINUE.

## Failure triage

| Gold category | Cases | Exact matches | Other returned labels |
| --- | --- | --- | --- |
| CODE_REGRESSION | 6 | 5 | DATA_STATE: 1 |
| TEST_ASSUMPTION | 4 | 3 | UNKNOWN: 1 |
| ENVIRONMENT | 2 | 2 | None |
| EXTERNAL_DEPENDENCY | 1 | 0 | ENVIRONMENT: 1 |
| DATA_STATE | 1 | 1 | None |
| DOCUMENTATION_ONLY | 1 | 1 | None |
| UNKNOWN | 1 | 1 | None |

Triage exact-label score: **13/16 = 81.25%**. Original gold is unchanged:

- C07: omitted displayed limitations from a local search index. Gold
  CODE_REGRESSION, returned DATA_STATE (confidence .85, selected probability
  .87). This could misdirect investigation away from the indexing defect.
- C08: test compares a short review label with a full knowledge identifier.
  Gold TEST_ASSUMPTION, returned UNKNOWN (.73 / .76). Unresolved, not a proved
  alternative cause.
- C14: external service allowance exhausted before task execution. Gold
  EXTERNAL_DEPENDENCY, returned ENVIRONMENT (.46 / .53). The neighboring category
  boundary does not justify changing the frozen gold after seeing the answer.
- C15 correctly returned UNKNOWN where the original cause was unestablished.

Classification is first-pass triage, not proof of root cause. In particular,
C07's confident error rules out treating confidence alone as permission to act.
No failed classification was rerun, tuned or relabeled to improve the score.

## Interpretation, verification and scope

The sample is a historical convenience set with shared episodes and some
already-diagnosed observations, not 30 independent blind debugging incidents.
Gold was extracted by Codex in v1, not independently relabeled by the Owner.
No current-Codex comparison has measured latency, tokens, cost or interruptions;
therefore relative savings remain UNKNOWN. No vendor benchmark was used to
infer Alpha results. Low measured API cost and short latency alone do not prove
net value after validation, security and maintenance work.

Implementation complexity in this continuation is low: the existing runner gained
explicit v2 artifact selection, smoke prerequisites and clarified metrics. The
client, endpoint, prompt rubric and gold dataset were reused unchanged. Three new
files are the two result JSONs and this report; only runner and experiment tests
were edited. No dependency, product code, production import, process, schedule,
market call or financial policy changed. A future service would additionally
need maintained authentication, API/model pinning, schema, cost and deadline
guards; it is not implemented or approved here.

Focused experiment tests: **29/29 passed in this run**, including missing secret,
secret-safe output, all ten hard gates and a late gate, deterministic zero-call
cases, no gold/path leakage, malformed/model-mismatch responses, timeout/no retry,
shadow-only execution, v1 preservation, original-source anchors, v2 actual-receipt
schema/hash/clock checks, independent cost reconciliation, and duplicate v2
run refusal without network. Syntax, scoped Markdown, secret-content and
worktree/staged whitespace checks also passed. No Alpha full product suite was
rerun because no shared product code changed.

Offline review from the repository root:

```text
node --test scripts/experiments/jev-dev-workflow/experiment.test.mjs
node scripts/experiments/jev-dev-workflow/run.mjs summary v2
```

These commands do not make external requests. Existing v1/v2 live output paths
refuse another run. Old auth failure and independent Alpha natural-collection /
targeted-quote acceptance states are unchanged.

**NEEDS_MORE_EVIDENCE:** the small Owner subset suggests value worth further
independent shadow evaluation, but does not yet justify building a Developer
Decision Service or MCP. Establishing actual interruption reduction and acceptable
triage errors should precede that engineering decision. This phase ends here.
