# Batch 1 real-news retrieval validation

Status: **VALIDATION_ONLY**

Conclusion: **A. READY_FOR_MANUAL_NEWS_LINKING**, after the two local retrieval fixes below. This is readiness for manually selected, reviewed context in these five cases, not automatic classification, factual verification, general retrieval accuracy or trade integration.

Baseline: `f06a32790ae77decab873000bcdb45306b4a5688`. Baseline queries recorded 2026-09-20T18:05:53.684Z; after-repair queries recorded 2026-09-20T18:07:05.151Z. All case materials were already saved before either pass. The two receipts are private: `data/runtime/options-workbench-development/world-model-news-validation-baseline.json` and `data/runtime/options-workbench-development/world-model-news-validation-after.json`. Their hashes appear below; raw bodies and production news are not copied into this document.

## Method and boundaries

Five purposive cases cover shipping, oil/product costs, rates/Treasury operations, BOJ/risk assets and an out-of-scope software control. Four have HEADLINE_ONLY coverage; one has saved primary EXCERPT coverage. This validates retrieval against retained material, not article truth. No new source was opened and no production news, plan, comparison or knowledge record was created. Full titles remain in original private records; the headings here are paraphrases.

Literal queries run first; analyst expansions and diagnostic filters are stated explicitly. All initial zero hits and every returned item/edge are retained. Case tables label the union of returned results; repeated appearances retain the same case-specific label. Labels are a same-Host qualitative review, not independent human/Owner approval. Direct relevance may mean a directly useful question or distinction, never proof of the news claim. Guardrails are supplied by the existing reader and applied in these notes; the application does not automatically police narrative reasoning.

## Minimal repair

The existing search indexed title, statement, aliases and the primary theme name, but omitted visible approved detail text. Searching crack spreads therefore missed ME01. Search now includes string values in the already approved details; it still excludes source-map prose and guardrails. Bank of Japan and BOJ are normalized as one actor name. No item, grade, approval, schema, ranking or trade consumer changed. Original approved catalog SHA-256 remains `887e71e7205c60aabc9ac1c834f406610418848e5c4b6bfba4a09decf0b13b39`.

The wider text search also adds W03 to the broad interest query: this weak match is retained below, not hidden. Literal Hormuz remains unmatched; manually chosen generic shipping context does not become a route-specific fact. No automatic geolocation/classification alias was added.

## N1 — Reported US allegation about Hormuz toll payments through a bitcoin exchange

Source: coindesk. Source/news ID: `2efd3d89-00fe-4c22-9da0-589b83e6bb91`. [Original publisher reference](https://www.coindesk.com/policy/2026/09/18/iran-s-strait-of-hormuz-toll-booth-ran-through-a-bitcoin-exchange-u-s-says) (not reopened).

Coverage: **HEADLINE_ONLY**. Publication: **2026-09-18T06:52:23.000Z**. Saved receipt: **2026-09-20T18:00:07.268Z**. Record save: **2026-09-20T18:00:07.269Z**. These are not live market observation clocks.

Private record: `data/runtime/options-focused-news/2026-09-20/2026-09-20T18-00-07-269Z-93f66b84-e527-41b1-af08-01d2b7352d27.json`; fingerprint `sha256:7efe4444db570c58926cf1623dc883db4446478ef5cb6cc918bfe7840cd218c9`. Locator: batch.sources → sourceId → items → itemId; retained feed headline only.

Query rationale: Hormuz is a literal named route. Shipping is an explicit analyst generalization from a strait/toll story, not an automatically assigned theme or proof of disrupted cargo. The M05 conflict filter is a diagnostic check, not a search for evidence about this event.

| Query ID | Exact filter JSON | Baseline labels | After repair labels |
| --- | --- | --- | --- |
| N1.1 | `{"keyword":"Hormuz"}` | NONE | NONE |
| N1.2 | `{"keyword":"shipping"}` | F09, F10, ME07, W05, Q05, MALACCA_CONFLICT, L1 | F09, F10, ME07, W05, Q05, MALACCA_CONFLICT, L1 |
| N1.3 | `{"theme":"M05","knowledgeType":"CONFLICT"}` | MALACCA_CONFLICT, EIA_DEFINITION_BRIDGE | MALACCA_CONFLICT, EIA_DEFINITION_BRIDGE |


**Relevance review (each returned item or edge)**

| Returned label | Relevance | Reason |
| --- | --- | --- |
| F09 | CONTEXTUALLY_RELEVANT | Useful against adding cargo across routes; it supplies no Hormuz payment evidence. |
| F10 | WEAK_MATCH | Vessel/cargo units are not discussed in the available title. |
| ME07 | CONTEXTUALLY_RELEVANT | Offers a conditional route, cost and delivery chain if tolls affect operations; the trigger is unproved here. |
| W05 | DIRECTLY_RELEVANT | Directly supplies the right follow-up distinction: delivered volume versus timing/cost. It is a question, not corroboration. |
| Q05 | CONTEXTUALLY_RELEVANT | Keeps actual voyage/insurance/net costs unknown rather than inferring profit from a toll. |
| MALACCA_CONFLICT | POTENTIALLY_MISLEADING | A different route and 2025Q4 period. Both conflicting values are visible but neither describes current Hormuz flow. |
| L1 | CONTEXTUALLY_RELEVANT | Logistics dependency helps frame a possible physical channel; it is not evidence that supply fell. |
| EIA_DEFINITION_BRIDGE | IRRELEVANT | Capacity-definition history does not resolve the alleged payment route; appears only through the linked-theme conflict diagnostic. |


1. **What happened?** The saved CoinDesk title attributes an allegation about a Hormuz toll/payment route to the US. No body, agency document, transaction records or shipping quantities were saved for this case. It does not establish that the allegation is true.

2. **Which themes?** Shipping chokepoints (M05); dollar/payment access (M02) is only a possible follow-up question. The title mentions a bitcoin exchange, not SWIFT, an embargo or a verified funding channel.

3. **What long-running structure is known?** Routes can be serial (F09). ME07 and L1 distinguish a route constraint from its possible delivery/cost consequences; W05 asks what actually changed.

4. **What is new?** New only relative to the retained material: the attributed toll/payment allegation. Whether it was a first disclosure, when transactions occurred, and whether the route is still operating are UNKNOWN.

5. **Which mechanism and missing intermediate evidence?** Possible channel: payment/toll conditions → actual voyage decisions → delays or arrivals → inventories and delivered supply → costs. Need legal/transaction evidence, matched voyages, deliveries, inventories and substitution before considering downstream macro effects.

6. **What remains UNKNOWN?** Allegation accuracy, payment amount, applicable permissions, effective dates, cargo volume, destination inventories and net costs remain unknown. No current Hormuz knowledge item is created.


**Useful:** W05, with ME07/L1 as explicitly conditional background. A narrow shipping + WATCH_QUESTION query returns only W05.

**False positives / weak matches:** F10 is weak; Malacca is potentially misleading across route/time; EIA bridge is irrelevant to the alleged transaction. Keep these returned results visible in this audit; do not cite them as event confirmation.

**False negatives / limits:** Hormuz gives zero. This is a missing named-route retrieval cue for general shipping context, but no approved Hormuz-specific current fact exists. Manual shipping lookup recovers the usable generic items. Do not fabricate a Hormuz alias on the Malacca conflict or import deferred current-state research.

## N2 — EIA title attributes higher pump prices to crude prices and crack spreads

Source: eia_energy. Source/news ID: `https://www.eia.gov/todayinenergy/detail.php?id=68104`. [Original publisher reference](https://www.eia.gov/todayinenergy/detail.php?id=68104) (not reopened).

Coverage: **HEADLINE_ONLY**. Publication: **UNKNOWN exact timestamp**. Saved receipt: **2026-09-20T18:00:07.178Z**. Record save: **2026-09-20T18:00:07.269Z**. These are not live market observation clocks.

Private record: `data/runtime/options-focused-news/2026-09-20/2026-09-20T18-00-07-269Z-93f66b84-e527-41b1-af08-01d2b7352d27.json`; fingerprint `sha256:7efe4444db570c58926cf1623dc883db4446478ef5cb6cc918bfe7840cd218c9`. Locator: batch.sources → sourceId → items → itemId; retained feed headline only.

Query rationale: crack spreads and oil are literal title terms. UNKNOWN filtering deliberately tests unresolved supply/capacity context; it is not evidence that supply capacity caused the reported pump-price change.

| Query ID | Exact filter JSON | Baseline labels | After repair labels |
| --- | --- | --- | --- |
| N2.1 | `{"keyword":"crack spreads"}` | NONE | ME01 |
| N2.2 | `{"keyword":"oil","knowledgeType":"MECHANISM"}` | ME01 | ME01 |
| N2.3 | `{"keyword":"oil","evidenceStatus":"UNKNOWN"}` | Q01, EIA_DEFINITION_BRIDGE | Q01, EIA_DEFINITION_BRIDGE |


**Relevance review (each returned item or edge)**

| Returned label | Relevance | Reason |
| --- | --- | --- |
| ME01 | DIRECTLY_RELEVANT | Its existing observable-confirmation field explicitly names crack spreads and energy components; the whole macro chain remains conditional. |
| Q01 | WEAK_MATCH | Exportable spare capacity may matter to a supply hypothesis, but the title identifies no physical supply loss. |
| EIA_DEFINITION_BRIDGE | IRRELEVANT | A spare-capacity methodological conflict does not establish the reason for retail fuel pricing. |


1. **What happened?** An EIA saved feed title says crude prices and crack spreads contribute to higher pump prices. Publication time is absent, and no article body, dated series or magnitude was retained. This is the publisher headline claim, not a newly verified numerical result.

2. **Which themes?** Oil (M01). A possible inflation channel may be examined, but no policy or asset outcome is asserted.

3. **What long-running structure is known?** ME01 separates deliverable supply, inventories, product costs, broader inflation and policy, with demand and substitution counterforces. The reported price components alone do not establish its physical-supply trigger.

4. **What is new?** The material reports that combination of price contributors. Their dates, contribution sizes, persistence and revision history are unknown; receipt time cannot be substituted for a publication or price observation time.

5. **Which mechanism and missing intermediate evidence?** Inspect crude/product prices and refining margins, physical deliveries/inventories and demand; then breadth of cost diffusion, wages/expectations, policy responses, real yields and USD. Only with separate asset evidence could a later GLD study examine a response. The title alone cannot traverse this chain.

6. **What remains UNKNOWN?** Price period, units, quantities, contribution estimates, supply-versus-refining-versus-demand attribution and downstream policy response remain unknown. Q01 does not fill those missing observations.


**Useful:** ME01 makes intermediate observations and counterforces explicit; this was the clearest useful narrow retrieval.

**False positives / weak matches:** Q01 is only weak supply background; EIA bridge is not evidence for the retail-price claim.

**False negatives / limits:** Before repair, exact phrase crack spreads returned zero despite being explicitly in approved ME01.details.observableConfirmation. After repair it returns ME01 alone without altering its content/grade.

## N3 — Saved September 16 Federal Reserve implementation-note excerpts

Source: Federal Reserve. Source/news ID: `9f5167cde7cf89f6d899b519951f238d35b48707eb520bb4142cca335be302a1`. [Original publisher reference](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a1.htm) (not reopened).

Coverage: **EXCERPT**. Publication: **UNKNOWN exact timestamp**; saved document date 2026-09-16; effective date 2026-09-17. Saved receipt: **2026-09-20T04:25:54.000Z**. Record save: **2026-09-20T04:27:40.703Z**. These are not live market observation clocks.

Private record: `data/runtime/options-macro-comparisons/source-package-fomc-20260916-body-20260920.json`; fingerprint `sha256:fd96e340804cb7c4b50c119be65f8f58e3f2b72586b664d5dfc2a3245953f26c`. Locator: Decisions Regarding Monetary Policy Implementation; first bullet, directive heading and first/fourth sub-bullets; web rendering lines 9–19; publication DATE only.

Query rationale: Treasury and interest occur in the actual saved excerpt. M03 OPEN_QUESTION is an explicitly labelled analyst boundary check prompted by conditional Treasury purchases, not a claim that the source mentions fiscal dominance.

| Query ID | Exact filter JSON | Baseline labels | After repair labels |
| --- | --- | --- | --- |
| N3.1 | `{"keyword":"Treasury"}` | H01, ME04, FL01, W03, L3, L5 | H01, ME04, FL01, W03, L3, L5 |
| N3.2 | `{"keyword":"interest"}` | ME03 | ME03, W03 |
| N3.3 | `{"theme":"M03","knowledgeType":"OPEN_QUESTION"}` | Q03, Q04 | Q03, Q04 |


**Relevance review (each returned item or edge)**

| Returned label | Relevance | Reason |
| --- | --- | --- |
| H01 | WEAK_MATCH | The 1951 Accord is background, not evidence about this 2026 operational directive. |
| ME04 | CONTEXTUALLY_RELEVANT | Treasury holdings/duration demand may be context, but no executed purchase or net issuance change is observed. |
| FL01 | CONTEXTUALLY_RELEVANT | A structural dollar/Treasury relationship; it must not become a current flow. |
| W03 | WEAK_MATCH | Treasury financing composition is a different question from interest on reserve balances. |
| L3 | CONTEXTUALLY_RELEVANT | Collateral/reserve roles provide background, not evidence of a new transaction. |
| L5 | IRRELEVANT | No Japanese allocation or hedge-cost evidence is in the excerpt. |
| ME03 | POTENTIALLY_MISLEADING | The word interest matches, but fixed-rate debt rollover arithmetic is not reserve-balance remuneration. Applying it to the 3.90% administered rate would be a category error. |
| Q03 | CONTEXTUALLY_RELEVANT | Useful limit: an ample-reserve purchase directive does not establish fiscal dominance. |
| Q04 | IRRELEVANT | The M03 theme link exposes yen leverage, absent from this excerpt. |


1. **What happened?** The retained official excerpt reports reserve-balance interest of 3.90%, effective September 17, and directs operations around a 3.75%–4.00% federal funds target range. Conditional Treasury purchases preserve when appropriate / if needed / three-years-or-less / ample-reserve constraints. This reuses a saved excerpt; it is not a new original-body verification.

2. **Which themes?** Debt/Treasury financing (M03) and dollar asset roles (M02) as context. Batch 1 is not a complete guide to Fed operating instruments.

3. **What long-running structure is known?** ME04/L3 separate duration demand and asset roles from a simple total-debt explanation. FL01 is structural, not actual flow. Q03 leaves fiscal dominance unidentified.

4. **What is new?** The dated announced settings and conditional operating instructions are case facts according to the retained excerpt. Publication date is September 16; precise publication time is unknown. The effect date is separate from later receipt and package-save times.

5. **Which mechanism and missing intermediate evidence?** Directive → any actual Desk operation → reserve/liquidity and duration changes → measured funding/yield conditions. Need operation records, quantities, maturities, balance-sheet observations and counterfactual policy evidence. Do not infer purchases merely because they are directed conditionally.

6. **What remains UNKNOWN?** Actual purchases, reserve changes, market yield response and fiscal constraint evidence remain unknown. ME03 cannot explain reserve-balance interest; Q04 is not applicable. The catalog cannot alone explain all operational distinctions.


**Useful:** Q03 prevents an unsupported regime diagnosis; ME04/L3 provide bounded context. Treasury + MECHANISM yields only ME04, still conditional.

**False positives / weak matches:** ME03 is a potentially misleading lexical interest match; H01/W03 are weak; L5/Q04 are irrelevant. A broad Treasury query has contextual utility but needs user review and filtering.

**False negatives / limits:** The initial queries do not directly surface F12 for the announcement/effect/receipt distinction. This is a query/discoverability limitation, not missing knowledge. No approved item fully explains reserve remuneration versus all operating rates; do not add one in this validation.

## N4 — Saved title pairs a Bank of Japan rate increase with a Bitcoin price statement

Source: coindesk. Source/news ID: `c205a4d1-14ef-4217-9e6a-7076150d1aee`. [Original publisher reference](https://www.coindesk.com/markets/2026/09/17/boj-rate-hike) (not reopened).

Coverage: **HEADLINE_ONLY**. Publication: **2026-09-18T03:03:38.000Z**. Saved receipt: **2026-09-20T18:00:07.268Z**. Record save: **2026-09-20T18:00:07.269Z**. These are not live market observation clocks.

Private record: `data/runtime/options-focused-news/2026-09-20/2026-09-20T18-00-07-269Z-93f66b84-e527-41b1-af08-01d2b7352d27.json`; fingerprint `sha256:7efe4444db570c58926cf1623dc883db4446478ef5cb6cc918bfe7840cd218c9`. Locator: batch.sources → sourceId → items → itemId; retained feed headline only.

Query rationale: Bank of Japan is literal; BOJ is its equivalent acronym. yen carry is an analyst-selected possible mechanism, explicitly not a claim made or proved by the title.

| Query ID | Exact filter JSON | Baseline labels | After repair labels |
| --- | --- | --- | --- |
| N4.1 | `{"keyword":"Bank of Japan"}` | NONE | H02, A02 |
| N4.2 | `{"keyword":"BOJ"}` | H02, A02 | H02, A02 |
| N4.3 | `{"keyword":"yen carry"}` | F07, F08, F12, H02, ME05, ME06, T02, W04, Q04 | F07, F08, F12, H02, ME05, ME06, T02, W04, Q04 |


**Relevance review (each returned item or edge)**

| Returned label | Relevance | Reason |
| --- | --- | --- |
| H02 | CONTEXTUALLY_RELEVANT | The dated 2024 regime change prevents treating the old framework as permanent; it is not this 2026 event. |
| A02 | WEAK_MATCH | The same institution appears, but the title says nothing about a dollar swap draw. |
| F07 | DIRECTLY_RELEVANT | Useful distinction before attributing any move to speculative yen funding. |
| F08 | DIRECTLY_RELEVANT | Stops partial proxies from being treated as total leverage or liquidation. |
| F12 | CONTEXTUALLY_RELEVANT | Keeps headline publication, decision/effect, price and receipt clocks separate. |
| ME05 | CONTEXTUALLY_RELEVANT | Policy-rate differences alone do not give matched-tenor hedged returns. |
| ME06 | CONTEXTUALLY_RELEVANT | Conditional loss/margin/deleveraging chain; not evidence that an unwind occurred. |
| T02 | CONTEXTUALLY_RELEVANT | Explicit ALPHA_INFERENCE / HYPOTHESIS_ONLY_CONTEXT; no direct yen-funded BTC/IBIT exposure is known. |
| W04 | DIRECTLY_RELEVANT | Asks for positions/funding before inferring causation from prices. |
| Q04 | DIRECTLY_RELEVANT | Directly exposes that current global net yen leverage is UNKNOWN. |


1. **What happened?** The saved CoinDesk title reports a 25-basis-point BOJ increase and Bitcoin above a stated price. No BOJ original release, effective clock, price series or body was retained in this case. It does not report or establish yen appreciation, margin calls, or a carry unwind.

2. **Which themes?** Yen carry (M04) as a possible funding lens; T02 is a hypothesis-only risk-asset context, not an identified transmission.

3. **What long-running structure is known?** F07/F08 separate carry from hedged investment and limit proxy coverage. ME05/ME06 distinguish rate/FX effects from funding constraints and actual liquidation.

4. **What is new?** The title’s dated rate-change and price claims are new relative to the case material; they are not independent verification or evidence of surprise versus prior expectations. URL date differs from publication date and is not substituted for it.

5. **Which mechanism and missing intermediate evidence?** Need expected-versus-announced policy, effective dates, FX and matched-tenor funding/hedges, actual net exposures, collateral/margin constraints, and linked position reductions. Consider US macro, crypto-specific news, unlevered buyers and adequate collateral as alternatives.

6. **What remains UNKNOWN?** Prior policy expectation, actual funding changes, exposure size, margin stress and causal price attribution remain unknown. Q04 remains UNKNOWN; A02 facility authorization is not a current draw.


**Useful:** F07/F08/W04/Q04 and conditional ME06 retain the missing intermediate steps. yen carry + WATCH_QUESTION narrows to W04.

**False positives / weak matches:** A02 is a weak actor-only match; H02 is historical context rather than the new decision. No result is allowed to prove carry unwind.

**False negatives / limits:** Bank of Japan initially missed both BOJ-labelled items. The single equivalent-name normalization repairs this without changing knowledge. Broader yen carry retrieval continues to require deliberate manual selection.

## N5 — Bitcoin Core 32 software testing and fee/security changes

Source: coindesk. Source/news ID: `6cc290e6-ace1-44cd-adc3-94bf6aed2900`. [Original publisher reference](https://www.coindesk.com/tech/2026/09/16/bitcoin-core-32-enters-final-testing-with-faster-validation-fee-changes-and-security-fixes) (not reopened).

Coverage: **HEADLINE_ONLY**. Publication: **2026-09-16T12:00:41.000Z**. Saved receipt: **2026-09-17T15:00:07.072Z**. Record save: **2026-09-17T15:00:07.073Z**. These are not live market observation clocks.

Private record: `data/runtime/options-focused-news/2026-09-17/2026-09-17T15-00-07-073Z-c4816f02-77c8-40ad-97d5-559eec22320e.json`; fingerprint `sha256:6b77aac31a1acf018279b0d4cb2014673a4d6a0e2f2cf47f4632a422aba89c18`. Locator: batch.sources → sourceId → items → itemId; retained feed headline only.

Query rationale: Bitcoin Core and fee changes are literal title fragments; no unrelated macro query is substituted to force a hit.

| Query ID | Exact filter JSON | Baseline labels | After repair labels |
| --- | --- | --- | --- |
| N5.1 | `{"keyword":"Bitcoin Core"}` | NONE | NONE |
| N5.2 | `{"keyword":"fee changes"}` | NONE | NONE |


1. **What happened?** The saved CoinDesk title describes software testing with validation, fee and security changes. There is no release body or implementation detail in this case.

2. **Which themes?** No Batch 1 macro theme is established from the supplied material.

3. **What long-running structure is known?** NO_RELEVANT_APPROVED_KNOWLEDGE for the tested queries. T02 is not a protocol-development explanation.

4. **What is new?** The title claims a new software-testing stage; precise release status and technical changes are unverified from this coverage.

5. **Which mechanism and missing intermediate evidence?** The catalog cannot supply a supported protocol-to-macro causal chain. Do not invent adoption, demand, funding or price consequences.

6. **What remains UNKNOWN?** Technical details, adoption, operational impact and any macro relevance remain unknown. No trade interpretation is produced.


**Useful:** Correctly permits no relevant approved knowledge rather than forcing BTC into a carry narrative.

**False positives / weak matches:** None returned for the two scoped queries.

**False negatives / limits:** No obvious approved Batch 1 item answers this software question; zero results are appropriate, not a recall failure.

## All retrieved IDs, types and retained grades

Each row resolves to the unchanged [approved catalog](../../../../src/engines/macro-world-model/BATCH_1_WORLD_MODEL_V1.json) and its candidate → review → dossier → source references. These evidence grades are inherited, not upgraded by this exercise.

| Label | Stable knowledge/edge ID | Type | Evidence status |
| --- | --- | --- | --- |
| F09 | `macro.structural-fact.shipping-routes-and-double-counting.v1` | STRUCTURAL_FACT | VERIFIED |
| F10 | `macro.structural-fact.vessel-tonnage-versus-cargo.v1` | STRUCTURAL_FACT | VERIFIED |
| ME07 | `macro.mechanism.rerouting-vessel-time-cost.v1` | MECHANISM | CONDITIONAL_HYPOTHESIS |
| W05 | `macro.watch.delivered-volume-or-delay.v1` | WATCH_QUESTION | QUESTION_NOT_ASSERTION |
| Q05 | `macro.open.route-specific-insurance-and-cost.v1` | OPEN_QUESTION | UNKNOWN |
| MALACCA_CONFLICT | `macro.conflict.malacca-2025q4-total.v1` | CONFLICT | CONFLICTED |
| L1 | `macro.edge.batch1-l1.v1` | EDGE | FACTUAL_DEPENDENCY |
| EIA_DEFINITION_BRIDGE | `macro.conflict.eia-capacity-definition-bridge.v1` | CONFLICT | UNKNOWN |
| ME01 | `macro.mechanism.deliverable-oil-and-price-transmission.v1` | MECHANISM | CONDITIONAL_HYPOTHESIS |
| Q01 | `macro.open.exportable-spare-capacity.v1` | OPEN_QUESTION | UNKNOWN |
| H01 | `macro.historical-fact.treasury-fed-accord-1951.v1` | HISTORICAL_FACT | VERIFIED |
| ME04 | `macro.mechanism.treasury-duration-and-dollar-demand.v1` | MECHANISM | CONDITIONAL_HYPOTHESIS |
| FL01 | `macro.flow-relation.primary-net-treasury-financing.v1` | STRUCTURAL_FLOW_RELATION | SUPPORTED_MECHANISM |
| W03 | `macro.watch.treasury-financing-composition.v1` | WATCH_QUESTION | QUESTION_NOT_ASSERTION |
| L3 | `macro.edge.batch1-l3.v1` | EDGE | FACTUAL_DEPENDENCY |
| L5 | `macro.edge.batch1-l5.v1` | EDGE | SUPPORTED_MECHANISM |
| ME03 | `macro.mechanism.debt-rollover-cost.v1` | MECHANISM | WELL_ESTABLISHED |
| Q03 | `macro.open.current-fiscal-dominance-identification.v1` | OPEN_QUESTION | UNKNOWN |
| Q04 | `macro.open.global-yen-net-leverage.v1` | OPEN_QUESTION | UNKNOWN |
| H02 | `macro.historical-fact.boj-framework-exit-2024.v1` | HISTORICAL_FACT | VERIFIED |
| A02 | `macro.actor-relation.fed-boj-dollar-backstop.v1` | ACTOR_RELATION | VERIFIED |
| F07 | `macro.structural-fact.unhedged-carry-versus-hedged-assets.v1` | STRUCTURAL_FACT | VERIFIED |
| F08 | `macro.structural-fact.carry-proxy-coverage.v1` | STRUCTURAL_FACT | VERIFIED |
| F12 | `macro.structural-fact.announcement-effect-and-observation-clocks.v1` | EVIDENCE_TIME_RULE | VERIFIED |
| ME05 | `macro.mechanism.cross-currency-hedge-and-allocation.v1` | MECHANISM | CONDITIONAL_HYPOTHESIS |
| ME06 | `macro.mechanism.yen-loss-margin-unwind.v1` | MECHANISM | CONDITIONAL_HYPOTHESIS |
| T02 | `macro.transmission-channel-candidate.funding-to-risk-assets-channels.v1` | HYPOTHESIS_ONLY_CONTEXT | ALPHA_INFERENCE |
| W04 | `macro.watch.yen-unwind-versus-comovement.v1` | WATCH_QUESTION | QUESTION_NOT_ASSERTION |

## Intermediate-variable checks

- **N2 PASS for retention, not causal validation:** ME01 explicitly requires physical/inventory and energy-component evidence, broader prices/expectations and counterforces before policy inference. The note does not jump from fuel costs to a Fed decision or GLD direction. The current source lacks enough evidence to evaluate that chain.
- **N4 PASS for retention, not an observed unwind:** F07/F08, ME05/ME06, W04/Q04 and T02 keep funding, hedges, margin, linked position changes and alternatives in view. The headline does not even establish yen strengthening; it cannot identify funding or causality.
- **N1/N3 additional checks:** A toll allegation is not lost cargo; a conditional Desk instruction is not an executed flow. All four leave current observations unknown where absent.

## Guardrail review

| Guardrail | Case outcome |
| --- | --- |
| R01 — hidden motives/political ranking | N1 retains US attribution; no national personality or hidden motive inferred. PASS in note. |
| R02 — fixed policy/asset chains | N1/N2/N4 retain intermediate observations and alternatives; no fixed GLD/IBIT direction. PASS. |
| R03 — announcement/capacity/stock versus flow | N3 conditions remain conditions; N2 unknown export capacity is not an actual delivery. PASS. |
| R04 — price co-movement versus funding | N4 explicitly lacks margin/exposure/position evidence. PASS. |
| R05 — messaging restrictions versus isolation | N1 payment-route headline says nothing about SWIFT or total isolation; neither is inferred. Actual SWIFT-restriction-event coverage is NOT_EXERCISED in this sample; the original guardrail is readable and unchanged. |
| R06 — debt/QE versus fiscal dominance | N3 Q03 stays UNKNOWN; the excerpt does not identify a regime. PASS. |
| R07 — duplicate totals/units/premiums | N1 does not add Malacca to Hormuz, convert vessel capacity to cargo, or call toll/insurance revenue profit. PASS for rejecting those shortcuts; no quantitative shipping reconciliation is possible. |
| R08 — convenient conflict resolution | N1/N2 diagnostics retain Malacca 24.9 and 24.0 without a canonical value; EIA remains UNBRIDGED/UNKNOWN. No values used for these cases. PASS. |

R01–R08 and D01–D07 remain audit exclusions, not inverse facts or new knowledge. No user needs to open every guardrail for this saved note to retain these limitations. This is not an automatic enforcement claim.

## Assessment and remaining gaps

Useful retrieval is narrow and reviewed: ME01 for crack spreads; W05 for delivery versus delay; W04/Q04 and F07/F08 for funding attribution; Q03 for the regime-identification boundary. Broad keyword/theme queries are noisy, particularly Treasury/interest and cross-theme UNKNOWN filters. No relevance ranker or auto-filter was added; misleading hits are explicitly rejected in the notes.

The two repaired false negatives are reproducible. Remaining named-route discoverability and the need to choose mechanism queries are limits of manual lookup, not permission to invent source content. Four headline-only cases cannot validate claim support from full bodies. No current-state fact, asset direction, probability or plan decision follows. This five-case purposive exercise estimates no population precision/recall metric.

Next stage, only if separately approved: manual/assisted News → Storyline linking. No such link, classifier, connector, current-state refresh or Batch 2 work starts here.

## Verification and cost

Focused tests: **28/28 passed**, including literal saved-news phrases, acronym equivalence, excluded guardrail/source text, out-of-scope zero hits, provenance, UNKNOWN/conflict preservation and legacy behavior. TypeScript and initial diff checks passed. Final full validation, formal browser evidence and artifact/reference checks are recorded in the closing addendum below.

The formal workbench reload used its existing launcher and original workspace, preserving context-refresh settings and completed current source-slot receipts; no extra source request was needed. No second long-running instance. The catalog/approval and original private source records are unchanged.

Task-initiated web/source reads **0**; market calls **0**; external model API calls **0**; queued/new Host tasks or Host CLI draft-generation calls **0**. This Codex session performed five attributed qualitative case reviews and deterministic local lookups; it still consumes Codex usage. Existing scheduled source activity is independent, not counted as a validation request. USD cost **UNKNOWN** without billing. Production plan/ledger/comparison/knowledge writes **0**. Private local validation receipts/logs are not source calls or product knowledge.

Routine natural acceptance remains PENDING_NATURAL_RUN. First real targeted quote remains NOT_VERIFIED_NO_OPEN_POSITIONS_WEEKEND. Neither is revalidated here. **World Model does NOT influence trading decisions.**


Receipt `data/runtime/options-workbench-development/world-model-news-validation-baseline.json`: SHA-256 `637ccee4f0b16c0f5b981efb1de0ca53bce50190f4a1de68e043af5b8ba70c3e`.


Receipt `data/runtime/options-workbench-development/world-model-news-validation-after.json`: SHA-256 `a75a0f94d198a20a11473127ef02fb965c57f7ef6b8f3f471593e3952575a5e8`.

## Closing verification — September 20, 2026

Final product-code validation ran in this stage: **4,907 passed, zero failed**, 184 components, including strict TypeScript, the 28 World Model tests, credential scanning, runtime-data tracking and Markdown checks. Exit code 0. The full run took 135,372 ms. Only the expected uncommitted-work and Windows line-ending warnings remained. The closing documentation below was added afterward; its references/Markdown and both Git whitespace checks were checked separately without repeating the product suite.

Private full log: `data/runtime/options-workbench-development/world-model-news-validation-full.txt`; SHA-256 `de602019f4f7022ff79cad72447c22685fe5e98e202cd420146bdb77ef1770ca`. The unchanged original records, actual before/after results, table references, catalog fingerprint and five formal API queries passed **27 artifact/reference/API checks**. Their receipt is `data/runtime/options-workbench-development/world-model-news-validation-checks.json`, with its actual check time. Local HTTP reads do not retrieve news or market data.

The following refinements were actually run after the broad queries. The first three were checked in both the formal API and browser; the final two were browser checks. They narrow type explicitly; no hidden ranking or query rewriting was used. Their returned IDs/types/grades and case-specific relevance labels are in the tables above.

| Case | Exact filter JSON | Returned label | Purpose |
| --- | --- | --- | --- |
| N1 | `{"keyword":"shipping","knowledgeType":"WATCH_QUESTION"}` | W05 | Delivery versus delay question |
| N3 | `{"keyword":"Treasury","knowledgeType":"MECHANISM"}` | ME04 | Conditional duration/demand mechanism |
| N4 | `{"keyword":"yen carry","knowledgeType":"WATCH_QUESTION"}` | W04 | Unwind versus co-movement question |
| N4 | `{"keyword":"yen carry","knowledgeType":"OPEN_QUESTION"}` | Q04 | Browser confirms UNKNOWN exposure |
| N4 | `{"keyword":"yen carry","knowledgeType":"HYPOTHESIS_ONLY_CONTEXT"}` | T02 | Browser confirms ALPHA_INFERENCE and hypothesis-only restrictions |

Formal browser acceptance used `http://127.0.0.1:4173/#macro-playbook`, completed by 2026-09-20T18:18:56.983Z. Crack spreads showed ME01 with its conditional status, limitations, counterforces, confirmation/falsification and horizon. Bank of Japan showed H02/A02. The shipping conflict filter retained the Malacca CONFLICTED entry; Bitcoin Core showed zero approved matches without filling unknowns. The refinements above showed the expected single result. Expanded T02 explicitly retained funding/basis, margin, risk budgets, actual position reductions, alternative buyers/crypto-specific causes, separate BTC/IBIT evidence and no trade permission. Q04 remained UNKNOWN. Browser error console was empty. Two exact-text expansion attempts used an incorrect/overly strict locator and did not click; inspecting the actual rendered title and matching its text resolved the test interaction. No product defect or source retry resulted.

The final artifact/reference check completed at 2026-09-20T18:19:36.410Z. An invocation without the repository's TypeScript loader failed on extensionless imports; using the existing `tsx` loader completed all 27 checks. This was a validation invocation correction, not a product-code failure.

Result: the observed gaps required only the two bounded lookup changes. Remaining limitations are explicit above; no unresolved product test failure remains. This artifact records a manual research-use validation, not a new approved knowledge item or an automatic linking feature.
