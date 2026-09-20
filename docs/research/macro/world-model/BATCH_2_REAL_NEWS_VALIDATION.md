# Batch 2 World Model — saved real-material retrieval validation

Status: **VALIDATION_ONLY**. Result: **A — READY_FOR_BATCH2_REVIEWED_STORYLINE_USE**, limited to explicit, human-reviewed selection of research context; never automatic classification.

Executed September 20, 2026. Baseline: `a917635ed62cd082e113280c5ebd3fac6bc77adc`. Runtime remains 10 themes, 74 approved items, 9 approved edges and 28 audit guardrails. Reviewer: **Codex Host**, not an independent human reviewer and not an Owner confirmation. No production storyline was created or revised.

## Scope and evidence limits

This uses six already-saved **source-derived historical research notes** plus one saved real-news headline. N1–N6 are EXCERPT-level retained material in the sense of **selected paraphrased notes**, not a verbatim source archive and not BODY coverage. Their original source maps retain the earlier reading scope (including prior full short-release reads where recorded), without promoting the locally retained notes to bodies. Exact original response-receipt times are UNKNOWN; the separately saved read clocks are not substituted for them. This validation does not authenticate source truth or add source coverage.

The local news inventory had no direct M06, M07 or M10 headline cases: **NO_SAVED_CASE in that news-feed subset**. The existing source-material archive supplies those themes. These six notes also contributed to the approved catalog, so this is an in-sample practical retrieval check, **not an independent held-out recall/precision benchmark**. No new source was fetched to close that limitation. All material is historical; nothing becomes current-state knowledge or pre-event evidence.

## Cases and preserved clocks

All read clocks below are UTC on 2026-09-20. N1–N6 were already saved by research commit `b57f983ce48ca6b778cc918a544d3be7573ec783` at `2026-09-20T15:51:19-04:00`. That persistence time is not a source receipt time.

| Case / source | Publisher | Publication / reference period | Retained coverage | Original read clock / actual receipt |
| --- | --- | --- | --- | --- |
| N1: M06.S03 | PRC Ministry of Foreign Affairs | 2026-05-15 (date only) | EXCERPT — source-derived paraphrase | 2026-09-20T19:30:08Z / UNKNOWN |
| N2: M06.S09 | US Department of Commerce / BIS; Federal Register | 2026-01-15 (date only; same effective date) | EXCERPT — source-derived paraphrase | 2026-09-20T19:31:23Z / UNKNOWN |
| N3: M07.S05 | IMF Working Paper authors (not institutional policy) | 2025-06 (month only) | EXCERPT — source-derived paraphrase | 2026-09-20T19:30:32Z / UNKNOWN |
| N4: M08.S03 | PJM Interconnection | 2026-01-14 (date only) | EXCERPT — source-derived paraphrase | 2026-09-20T19:24:39Z / UNKNOWN |
| N5: M09.S06 | Trafigura / Lobito Atlantic Railway | 2024-08-22 (date only) | EXCERPT — source-derived paraphrase | 2026-09-20T19:30:50Z / UNKNOWN |
| N6: M10.S08 | Hambantota International Port Group (operator claim) | 2026-01-11 (date only) | EXCERPT — source-derived paraphrase | 2026-09-20T19:30:50Z / UNKNOWN |
| N7: coindesk:6cc290e6-ace1-44cd-adc3-94bf6aed2900 | CoinDesk | 2026-09-16T12:00:41.000Z | HEADLINE_ONLY | not separately recorded / 2026-09-17T15:00:07.072Z |

Saved source locators (original URLs are in each unchanged section M):

- N1: [M06_CHINA_TAIWAN_SEMICONDUCTORS.md](../batch-2/M06_CHINA_TAIWAN_SEMICONDUCTORS.md), D: PRC attributed position; M: S03. SHA-256 `a1ec19000bc7190aedf075b86860819947501d79ced41f175babe18330c528eb`.
- N2: [M06_CHINA_TAIWAN_SEMICONDUCTORS.md](../batch-2/M06_CHINA_TAIWAN_SEMICONDUCTORS.md), E/H: H200 conditional case-by-case licensing; M: S09. SHA-256 `a1ec19000bc7190aedf075b86860819947501d79ced41f175babe18330c528eb`.
- N3: [M07_GLOBALIZATION_RECONFIGURATION.md](../batch-2/M07_GLOBALIZATION_RECONFIGURATION.md), D/F/G: connector-country and Vietnam findings; M: S05, PDF pp1–8. SHA-256 `d44b871001bf2858e6b30e965a9a2741c5f120bea766c2fd485608df63bbdd2d`.
- N4: [M08_AI_POWER_DATA_CENTERS.md](../batch-2/M08_AI_POWER_DATA_CENTERS.md), D/F/G/H: large-load verification and near-term forecast revision; M: S03. SHA-256 `30e64f9f636a7fbc185b1a6293110969e098507731eed934a70d47d608b58bb4`.
- N5: [M09_AFRICA_STRATEGIC_RESOURCES.md](../batch-2/M09_AFRICA_STRATEGIC_RESOURCES.md), D/E: Kolwezi–Lobito–US shipment and employment boundary; M: S06. SHA-256 `b01c23a11f0069849cb50982377337707c46ab69b51682af4d179156840029fb`.
- N6: [M10_BELT_AND_ROAD.md](../batch-2/M10_BELT_AND_ROAD.md), F/H: FY2025 throughput versus end-2026 capacity target; M: S08. SHA-256 `7f550d90f1d06cd47b2f8402f4074dd5ab868f19162ad66045163bf7cf9787a9`.
- N7: private saved focused-news record, item `6cc290e6-ace1-44cd-adc3-94bf6aed2900`, record fingerprint `sha256:6b77aac31a1acf018279b0d4cb2014673a4d6a0e2f2cf47f4632a422aba89c18`; retained receipt locates the exact private file. No full headline/body is copied here.

## Query protocol and immutable receipts

The first query in each case is the literal, natural entry. Subsequent keywords and filters are **manual analyst refinements**, not automatic classification or hidden retries. All initial misses remain below. Queries are conjunctive whole-word search after the small repair; theme links broaden filters but do not assert that all returned items describe the case. Item and edge relevance are evaluated separately from evidence grade.

- baseline: `2026-09-20T21:30:46.796Z`, private `data/runtime/options-workbench-development/batch2-news-retrieval-baseline.json`, SHA-256 `68f6f381a0dbe1b50ac24df207f8d9c6a4cce0fb954463fee9e1e55eeb2154f2`. Contains exact query arguments, returned IDs, approved text/grades, source references, file hashes and production-link hashes.
- after: `2026-09-20T21:34:30.720Z`, private `data/runtime/options-workbench-development/batch2-news-retrieval-after.json`, SHA-256 `f39a85104cf770f5a2a123dec7c3701ad1b5905760609096e43937d6b97d718a`. Contains exact query arguments, returned IDs, approved text/grades, source references, file hashes and production-link hashes.

Full IDs are in receipts; tables use unique runtime review labels (`B2-` means Batch 2; unprefixed labels are Batch 1). Repeated hits receive one case-specific assessment applying to every occurrence; no returned hit is omitted.

## N1 — PRC attributed statement

1. **What happened:** The saved MFA source note attributes a May 15, 2026 reaffirmation of the PRC One-China Principle to the PRC government. It does not adjudicate sovereignty.
2. **Relevant themes:** M06 only.
3. **Useful approved structure:** K01 is directly useful; K02 provides a boundary against a chips-only account. The broader Taiwan query is intentionally noisy.
4. **What is actually new:** The dated speech is the reported event. This is a September 20 historical retrieval check, not new geopolitical intelligence.
5. **Possible mechanism and missing intermediates:** No new commercial mechanism is established. Policy implementation, actual restrictions, shipments and reactions would need separate dated observations.
6. **UNKNOWN / DISPUTED / INCOMPARABLE:** The full current US policy and Taiwan legal texts were not re-read here. K01 preserves their separate attribution categories; the saved MAC coverage remains index excerpts. No probability of war, universal legal consensus or political ranking follows.

| Query (literal first; then manual refinement) | Baseline hits | After repair hits |
| --- | --- | --- |
| `{"keyword":"One-China Principle"}` | B2-K01 | B2-K01 |
| `{"keyword":"Taiwan"}` | B2-K01, B2-K02, B2-K03, B2-K04, B2-K05, B2-ME01, B2-W01, B2-Q01, B2-CF01, B2-L1, B2-L3 | B2-K01, B2-K02, B2-K03, B2-K04, B2-K05, B2-ME01, B2-W01, B2-Q01, B2-CF01, B2-L1, B2-L3 |
| `{"theme":"M06","knowledgeType":"MEASUREMENT_FRAMEWORK"}` | B2-K04, B2-K05, B2-K07, B2-K10 | B2-K04, B2-K05, B2-K07, B2-K10 |
| `{"theme":"M06","knowledgeType":"OPEN_QUESTION","evidenceStatus":"UNKNOWN"}` | B2-Q01 | B2-Q01 |

| Returned item / edge | Relevance | Case-specific reason |
| --- | --- | --- |
| B2-K01 | DIRECTLY_RELEVANT | Separates the named PRC statement from US policy, specific Taiwan authority statements and corporate activity. |
| B2-K02 | CONTEXTUALLY_RELEVANT | Avoids reducing a political statement to chip dependence or a war prediction. |
| B2-K03 | WEAK_MATCH | Semiconductor layers are not the subject of this political statement. |
| B2-K04 | WEAK_MATCH | No output, qualification or substitution quantities are reported here. |
| B2-K05 | WEAK_MATCH | No foundry-share measurement is in this case. |
| B2-ME01 | WEAK_MATCH | A separate executed export restriction would be needed; a political statement is not that event. |
| B2-W01 | WEAK_MATCH | Deliveries are a possible separate research question, not evidence in this statement. |
| B2-Q01 | WEAK_MATCH | Current chip rules and exports remain unknown but are not answered by this statement. |
| B2-CF01 | IRRELEVANT | Foundry denominators are unrelated to the stated political position. |
| B2-L1 | POTENTIALLY_MISLEADING | Inferring changed trade routes from this political statement would skip executed restrictions. |
| B2-L3 | IRRELEVANT | Hardware dependence does not interpret the political statement. |
| B2-K07 | IRRELEVANT | No factory relocation or trade-routing observation is reported. |
| B2-K10 | IRRELEVANT | No AI workload evidence is reported. |

## N2 — Advanced-computing licensing

1. **What happened:** The saved Federal Register note reports a January 15, 2026 conditional, case-by-case advanced-computing license-review change, including eligible H200-class products.
2. **Relevant themes:** M06; M07 only as possible downstream trade/production context.
3. **Useful approved structure:** ME01 and W01 separate authorization, access and delivery. K04 supplies product qualification boundaries; K01/K02 from N1 prevent political misattribution.
4. **What is actually new:** The dated licensing change is new relative to its own publication. No actual shipment, denial, lost output or current complete rule matrix is newly observed in this validation.
5. **Possible mechanism and missing intermediates:** Executed permissions/restrictions could affect qualified supply, lead times, costs and later location decisions. Actual licenses, shipments, product/end-user conditions and substitutes are missing.
6. **UNKNOWN / DISPUTED / INCOMPARABLE:** Later amendments were not exhaustively checked; prior EAR web failures remain. No legal compliance conclusion, blanket embargo, production loss, war cause or investment-as-government-position inference is made.

| Query (literal first; then manual refinement) | Baseline hits | After repair hits |
| --- | --- | --- |
| `{"keyword":"advanced computing"}` | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE |
| `{"keyword":"export controls"}` | B2-K04, B2-ME01 | B2-K04, B2-ME01 |
| `{"theme":"M06","knowledgeType":"MECHANISM","evidenceStatus":"CONDITIONAL_HYPOTHESIS"}` | B2-ME01 | B2-ME01 |
| `{"theme":"M06","knowledgeType":"WATCH_QUESTION"}` | B2-W01, B2-W02 | B2-W01, B2-W02 |

| Returned item / edge | Relevance | Case-specific reason |
| --- | --- | --- |
| B2-K04 | CONTEXTUALLY_RELEVANT | Product qualification and substitutability constrain any inferred effect of a licensing change. |
| B2-ME01 | DIRECTLY_RELEVANT | Separates licensing from actual access, deliveries and production location; retains conditional grade. |
| B2-W01 | DIRECTLY_RELEVANT | Asks whether permission actually changed qualified deliveries. |
| B2-W02 | CONTEXTUALLY_RELEVANT | Route or production changes require later observations, not the legal headline alone. |

## N3 — Vietnam and connector-country research

1. **What happened:** The saved IMF WP25/129 abstract/introduction notes distinguish connector-country responses; the reported Vietnam sample favors real production reallocation over pure rerouting in some findings.
2. **Relevant themes:** M07, without automatic expansion to other countries.
3. **Useful approved structure:** K06/K07 distinguish levels, growth, routes, value added, FDI flows/stocks/valuations and operating factories. W02 asks the correct measurement question.
4. **What is actually new:** The historical working-paper finding is an author interpretation from its sample, not a fresh global trade total or official IMF policy.
5. **Possible mechanism and missing intermediates:** Tariff incentives may change sourcing and investment. Product-level value added, operating output, common-vintage flows, ultimate upstream dependence and alternative explanations remain necessary.
6. **UNKNOWN / DISPUTED / INCOMPARABLE:** No universal transshipment/evasion result, end of globalization, guaranteed resilience or current FDI vintage bridge. Announced factories, FDI flows and FDI stocks cannot substitute for one another.

| Query (literal first; then manual refinement) | Baseline hits | After repair hits |
| --- | --- | --- |
| `{"keyword":"Vietnam"}` | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE | B2-K07 |
| `{"keyword":"connector countries"}` | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE | B2-K07 |
| `{"keyword":"trade diversion"}` | B2-K06, B2-K07, B2-ME03 | B2-K06, B2-K07, B2-ME03 |
| `{"theme":"M07","knowledgeType":"MEASUREMENT_FRAMEWORK"}` | B2-K06, B2-K07 | B2-K06, B2-K07 |
| `{"theme":"M07","knowledgeType":"WATCH_QUESTION"}` | B2-W02 | B2-W02 |
| `{"theme":"M07","knowledgeType":"OPEN_QUESTION","evidenceStatus":"UNKNOWN"}` | B2-Q02 | B2-Q02 |

| Returned item / edge | Relevance | Case-specific reason |
| --- | --- | --- |
| B2-K06 | DIRECTLY_RELEVANT | Separates world levels/growth, bilateral rerouting and value added. |
| B2-K07 | DIRECTLY_RELEVANT | Vietnam-specific study findings do not generalize to all connectors; production differs from transshipment. |
| B2-ME03 | WEAK_MATCH | Infrastructure could affect routes, but this study extract does not identify a project or prove that channel. |
| B2-W02 | DIRECTLY_RELEVANT | Directly asks whether the observed change is contraction, routing or production. |
| B2-Q02 | CONTEXTUALLY_RELEVANT | Unbridged trade/FDI vintages prevent turning the study into a current global estimate. |

## N4 — PJM load forecast

1. **What happened:** PJM’s saved January 14, 2026 note describes large-load verification and a nearer-term downward forecast revision while retaining substantial long-run forecast growth.
2. **Relevant themes:** M08. M06 hardware dependence is context only.
3. **Useful approved structure:** K08–K10 plus ME02/W03/Q03 distinguish announced, contracted, interconnected, energized and actual-load stages; GW versus TWh; and all data centers versus AI workloads.
4. **What is actually new:** A revised forecast and its screening method, not newly metered actual AI demand. The saved note does not give project-level actual energized or utilized amounts.
5. **Possible mechanism and missing intermediates:** Actual deployment and utilization can meet local grid constraints. Node-specific capacity, timing, project deduplication, metered load curves, PUE and AI workload share are missing.
6. **UNKNOWN / DISPUTED / INCOMPARABLE:** Actual AI load remains UNKNOWN. A forecast reduction does not prove all AI demand fictitious. K11/PP&E was found diagnostically, but this case contains no company CapEx observation and cannot validate R06 on real news.

| Query (literal first; then manual refinement) | Baseline hits | After repair hits |
| --- | --- | --- |
| `{"keyword":"PJM"}` | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE | B2-K08 |
| `{"keyword":"AI power"}` | ME01, B2-K03, B2-K08, B2-K09, B2-K10, B2-K11, B2-ME02, B2-W01, B2-W03, B2-Q03, B2-L3 | B2-K03, B2-K08, B2-K09, B2-K10, B2-K11, B2-ME02, B2-W03, B2-Q03, B2-L3 |
| `{"theme":"M08","knowledgeType":"MEASUREMENT_FRAMEWORK"}` | B2-K04, B2-K08, B2-K09, B2-K10, B2-K11 | B2-K04, B2-K08, B2-K09, B2-K10, B2-K11 |
| `{"theme":"M08","knowledgeType":"MECHANISM"}` | B2-ME02, B2-ME04 | B2-ME02, B2-ME04 |
| `{"theme":"M08","knowledgeType":"WATCH_QUESTION"}` | B2-W01, B2-W03 | B2-W01, B2-W03 |
| `{"theme":"M08","knowledgeType":"OPEN_QUESTION","evidenceStatus":"UNKNOWN"}` | B2-Q03 | B2-Q03 |

| Returned item / edge | Relevance | Case-specific reason |
| --- | --- | --- |
| ME01 | IRRELEVANT | Oil-delivery mechanism was a substring false positive (AI inside unrelated words); removed. |
| B2-K03 | CONTEXTUALLY_RELEVANT | Qualified hardware is complementary context; PJM forecasts do not measure chip availability. |
| B2-K08 | DIRECTLY_RELEVANT | The project pipeline and verified stages explain why announced load differs from actual use. |
| B2-K09 | DIRECTLY_RELEVANT | Forecast power, metered energy, period and system boundary cannot be interchanged. |
| B2-K10 | DIRECTLY_RELEVANT | PJM total large load cannot be relabelled AI-only electricity. |
| B2-K11 | WEAK_MATCH | No company PP&E or AI-use breakdown is supplied; a useful warning, not an exercised accounting case. |
| B2-ME02 | DIRECTLY_RELEVANT | Identifies actual workload/utilization and local constraints, while leaving future magnitude unknown. |
| B2-W01 | WEAK_MATCH | The broader theme filter returns chip permissions/deliveries; this case supplies neither. |
| B2-W03 | DIRECTLY_RELEVANT | Asks for deduplicated energization and actual metered use. |
| B2-Q03 | DIRECTLY_RELEVANT | Actual AI load and AI-specific CapEx remain explicitly unknown. |
| B2-L3 | CONTEXTUALLY_RELEVANT | Hardware plus power is a dependency, not proof of present chip scarcity or energy-price direction. |
| B2-K04 | WEAK_MATCH | Chip output is not observed in the grid forecast. |
| B2-ME04 | WEAK_MATCH | No project cash, debt-service or guarantee observation is supplied. |

## N5 — Lobito actual-shipment report

1. **What happened:** Trafigura/LAR’s saved August 22, 2024 report describes a Kolwezi–Lobito–US copper shipment. It is a company-reported movement, without independent customs reconciliation in the archive.
2. **Relevant themes:** M09; M10 as a transport/finance measurement comparison, not a BRI classification.
3. **Useful approved structure:** K12/K13 distinguish ownership, processing, exports, transport and net local distribution. ME03/W04/Q04 help interpret a real route without upgrading finance.
4. **What is actually new:** Reported actual shipment on a specified route, rather than only an agreement. A reported 650-plus workforce includes transferred employees and is not all net new jobs.
5. **Possible mechanism and missing intermediates:** Cargo can support transport utilization/route viability (L7). Charges, volumes, recurrence, costs, debt, drawdowns and actual local fiscal/community outcomes are not supplied.
6. **UNKNOWN / DISPUTED / INCOMPARABLE:** Not proof of all planned corridor extensions being operational, Mopani cargo using this route, complete national resource control, independent shipment verification or BRI success. Ownership, finance and benefits remain separate unknowns.

| Query (literal first; then manual refinement) | Baseline hits | After repair hits |
| --- | --- | --- |
| `{"keyword":"Lobito"}` | B2-W04, B2-Q04 | B2-K12, B2-K14, B2-ME03, B2-W04, B2-Q04 |
| `{"keyword":"mineral rights"}` | B2-K12 | B2-K12 |
| `{"theme":"M09","knowledgeType":"MEASUREMENT_FRAMEWORK"}` | B2-K12, B2-K13, B2-K15, B2-K16 | B2-K12, B2-K13, B2-K15, B2-K16 |
| `{"theme":"M09","knowledgeType":"MECHANISM"}` | B2-ME03, B2-ME04 | B2-ME03, B2-ME04 |
| `{"theme":"M09","knowledgeType":"WATCH_QUESTION"}` | B2-W04, B2-W05 | B2-W04, B2-W05 |
| `{"theme":"M09","knowledgeType":"OPEN_QUESTION","evidenceStatus":"UNKNOWN"}` | B2-Q04, B2-Q05 | B2-Q04, B2-Q05 |

| Returned item / edge | Relevance | Case-specific reason |
| --- | --- | --- |
| B2-W04 | DIRECTLY_RELEVANT | Requests delivered volumes and local distribution rather than counting announcements. |
| B2-Q04 | DIRECTLY_RELEVANT | Shipment amount, full route performance, drawdowns and local benefit gaps remain. |
| B2-K12 | DIRECTLY_RELEVANT | Shipment and route are distinct from equity, processing, permissions and national control. |
| B2-K13 | DIRECTLY_RELEVANT | Transferred workers cannot all become net new jobs; shipment does not prove local benefit. |
| B2-K15 | WEAK_MATCH | No loan/equity/grant terms are supplied by the shipment report. |
| B2-K16 | WEAK_MATCH | No borrower, recourse or guarantee document is supplied. |
| B2-ME03 | DIRECTLY_RELEVANT | Real cargo and working transport support route use, not completion of all planned extensions. |
| B2-ME04 | CONTEXTUALLY_RELEVANT | Explains why charges, operating costs, drawdowns and debt still need separate evidence. |
| B2-W05 | CONTEXTUALLY_RELEVANT | Financing and operating cash are separate follow-up questions, unanswered here. |
| B2-Q05 | IRRELEVANT | Niger legal/security dispute is a separate country and case; an M09 filter must not merge them. |
| B2-K14 | CONTEXTUALLY_RELEVANT | The explicit Lobito limitation prevents automatic BRI attribution. |

## N6 — Hambantota port use

1. **What happened:** HIPG’s saved January 11, 2026 operator note reports FY2025 cargo: 8.24 million tonnes and 428,036 TEU. These are different units, not additive measures.
2. **Relevant themes:** M10; M07 accessibility and M09 utilization are contextual only.
3. **Useful approved structure:** K14–K17 and ME03/ME04 separate initiative, contract actors, funding instruments, borrowing/guarantees and physical versus financial performance.
4. **What is actually new:** The operator’s FY2025 throughput report. Its end-2026 two-million-TEU capacity target is not 2025 actual throughput; no audited profit or cash figure was acquired.
5. **Possible mechanism and missing intermediates:** Use can produce service revenue only with prices, costs, reliability and contracts. Maintenance, debt service, currency, guarantees and social distribution still require evidence.
6. **UNKNOWN / DISPUTED / INCOMPARABLE:** Profitability, net social benefit and debt-service coverage UNKNOWN. The older 2017 lease is not a new event in this case; R12 has only diagnostic boundary review, not a real lease-news exercise. No debt-trap/win-win or automatic debt-seizure conclusion.

| Query (literal first; then manual refinement) | Baseline hits | After repair hits |
| --- | --- | --- |
| `{"keyword":"Hambantota"}` | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE | B2-K17 |
| `{"keyword":"project debt"}` | B2-K14, B2-K15, B2-K16, B2-ME04, B2-W05 | B2-K14, B2-K15, B2-K16, B2-ME04, B2-W05, B2-Q06, B2-L7 |
| `{"keyword":"debt trap"}` | B2-K14, B2-K17 | B2-K14, B2-K17 |
| `{"theme":"M10","knowledgeType":"CONCEPTUAL_BOUNDARY"}` | B2-K14, B2-K17 | B2-K14, B2-K17 |
| `{"theme":"M10","knowledgeType":"MECHANISM"}` | B2-ME03, B2-ME04 | B2-ME03, B2-ME04 |
| `{"theme":"M10","knowledgeType":"WATCH_QUESTION"}` | B2-W02, B2-W04, B2-W05 | B2-W02, B2-W04, B2-W05 |
| `{"theme":"M10","knowledgeType":"OPEN_QUESTION","evidenceStatus":"UNKNOWN"}` | B2-Q04, B2-Q06 | B2-Q04, B2-Q06 |

| Returned item / edge | Relevance | Case-specific reason |
| --- | --- | --- |
| B2-K14 | CONTEXTUALLY_RELEVANT | Identify the actual operator and contract parties; BRI is not one borrower or creditor. |
| B2-K15 | CONTEXTUALLY_RELEVANT | Any inference about financing needs instrument and counterparty terms, absent from throughput data. |
| B2-K16 | CONTEXTUALLY_RELEVANT | Port use does not establish project/sovereign/SOE debt balances or guarantees. |
| B2-ME04 | DIRECTLY_RELEVANT | Throughput lacks charges/costs/currency/debt-service cash needed to judge financial performance. |
| B2-W05 | DIRECTLY_RELEVANT | Asks for actual operating cash, funding and debt service. |
| B2-K17 | DIRECTLY_RELEVANT | Directly distinguishes 2025 use from profit and debt coverage; historical lease interpretation remains attributed. |
| B2-ME03 | DIRECTLY_RELEVANT | Actual cargo is relevant to transport use; customs, feeders, prices and reliability still matter. |
| B2-W02 | WEAK_MATCH | A single port report is not a world trade/FDI relocation observation. |
| B2-W04 | WEAK_MATCH | Local benefits are relevant in principle, but no mineral-flow or net community dataset is provided. |
| B2-Q04 | WEAK_MATCH | Mineral deliveries elsewhere cannot fill this port-specific finance gap. |
| B2-Q06 | DIRECTLY_RELEVANT | Demand, cost, cash and guarantee gaps remain unknown. |
| B2-L7 | POTENTIALLY_MISLEADING | Found through its explicit debt limitation. Freight supports utilization only; treating this as finance evidence would reverse the limitation. |

## N7 — Software control

1. **What happened:** The retained CoinDesk headline reports Bitcoin Core software entering final testing, with validation, fees and security changes.
2. **Relevant themes:** None: no relevant approved Batch 2 theme is supported by this headline.
3. **Useful approved structure:** None. All three explicit searches return NO_RELEVANT_APPROVED_KNOWLEDGE.
4. **What is actually new:** Software testing/version changes at headline coverage only.
5. **Possible mechanism and missing intermediates:** No macro funding, capital-flow, energy or semiconductor mechanism is evidenced.
6. **UNKNOWN / DISPUTED / INCOMPARABLE:** Body, implementation outcomes and market effects were not read. Bitcoin or software vocabulary cannot justify IBIT direction, yen-carry exposure or a forced macro storyline.

| Query (literal first; then manual refinement) | Baseline hits | After repair hits |
| --- | --- | --- |
| `{"keyword":"Bitcoin Core"}` | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE |
| `{"keyword":"fee changes"}` | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE |
| `{"keyword":"Bitcoin"}` | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE | ZERO — NO_RELEVANT_APPROVED_KNOWLEDGE |

No hit to review. The zero result is valid; no alternative macro story was generated.

## Additional diagnostic queries (not additional real-news cases)

| ID / query | Baseline | After repair |
| --- | --- | --- |
| D-CF06: `{"theme":"M06","knowledgeType":"CONFLICT"}` | B2-CF01 | B2-CF01 |
| D-CF07: `{"theme":"M07","knowledgeType":"CONFLICT"}` | B2-CF02, B2-CF03 | B2-CF02, B2-CF03 |
| D-CF09: `{"theme":"M09","knowledgeType":"CONFLICT"}` | B2-CF04 | B2-CF04 |
| D-EDGE06: `{"theme":"M06","evidenceStatus":"FACTUAL_DEPENDENCY"}` | B2-K03, B2-K04, B2-L3 | B2-K03, B2-K04, B2-L3 |
| D-EDGE10: `{"theme":"M10","evidenceStatus":"SUPPORTED_MECHANISM"}` | B2-K07, B2-K13, B2-K17, B2-ME03, B2-L4, B2-L7 | B2-K07, B2-K13, B2-K17, B2-ME03, B2-L4, B2-L7 |
| D-AI: `{"keyword":"AI"}` | F06, F09, H01, ME01, ME02, ME04, ME06, ME07, FL01, T01, T02, W03, W05, Q01, Q03, Q04, Q05, EIA_DEFINITION_BRIDGE, B2-K01, B2-K02, B2-K03, B2-K04, B2-K05, B2-K08, B2-K09, B2-K10, B2-K11, B2-K13, B2-K17, B2-ME01, B2-ME02, B2-ME03, B2-ME04, B2-W01, B2-W03, B2-W05, B2-Q01, B2-Q03, B2-Q04, B2-Q05, B2-Q06, B2-CF01, B2-CF02, B2-CF03, B2-CF04, L1, L3, B2-L1, B2-L3 | B2-K03, B2-K08, B2-K09, B2-K10, B2-K11, B2-ME02, B2-W03, B2-Q03, B2-L3 |
| D-PORT: `{"keyword":"port"}` | F10, ME01, ME02, ME05, ME06, ME07, W01, W02, W04, Q01, B2-K04, B2-K06, B2-K07, B2-K12, B2-ME01, B2-ME03, B2-W02, B2-W04, B2-Q01, B2-Q04, B2-CF01, B2-CF04, B2-L1, B2-L7 | ME07, B2-ME03 |
| D-CAPEX: `{"keyword":"PP&E"}` | B2-K11, B2-W03 | B2-K11, B2-W03 |
| D-GLD: `{"keyword":"GLD"}` | T01 | T01 |
| D-IBIT: `{"keyword":"IBIT"}` | T02, Q04 | T02, Q04 |

Every diagnostic hit is reviewed below. Labels here measure relevance **to the stated diagnostic purpose**, not to an invented news event. This does not turn unexercised real-news guardrails green.

| Diagnostic / hits | Relevance | Reason |
| --- | --- | --- |
| D-CF06: B2-CF01 | DIRECTLY_RELEVANT | Tests incompatible foundry denominators, not a canonical market share. |
| D-CF07: B2-CF02 | DIRECTLY_RELEVANT | Tests both trade/FDI vintage conflicts without choosing a newer winner. |
| D-CF07: B2-CF03 | DIRECTLY_RELEVANT | Tests both trade/FDI vintage conflicts without choosing a newer winner. |
| D-CF09: B2-CF04 | DIRECTLY_RELEVANT | Tests attributed SOMAIR legal dispute without adjudication. |
| D-EDGE06: B2-K03 | DIRECTLY_RELEVANT | Tests hardware qualification/dependence and the narrow L3 edge. |
| D-EDGE06: B2-K04 | DIRECTLY_RELEVANT | Tests hardware qualification/dependence and the narrow L3 edge. |
| D-EDGE06: B2-L3 | DIRECTLY_RELEVANT | Tests hardware qualification/dependence and the narrow L3 edge. |
| D-EDGE10: B2-K07 | DIRECTLY_RELEVANT | Tests actual production/distribution/use and transport edges while retaining missing finance. |
| D-EDGE10: B2-K13 | DIRECTLY_RELEVANT | Tests actual production/distribution/use and transport edges while retaining missing finance. |
| D-EDGE10: B2-K17 | DIRECTLY_RELEVANT | Tests actual production/distribution/use and transport edges while retaining missing finance. |
| D-EDGE10: B2-ME03 | DIRECTLY_RELEVANT | Tests actual production/distribution/use and transport edges while retaining missing finance. |
| D-EDGE10: B2-L4 | DIRECTLY_RELEVANT | Tests actual production/distribution/use and transport edges while retaining missing finance. |
| D-EDGE10: B2-L7 | DIRECTLY_RELEVANT | Tests actual production/distribution/use and transport edges while retaining missing finance. |
| D-AI: F06 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: F09 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: H01 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: ME01 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: ME02 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: ME04 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: ME06 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: ME07 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: FL01 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: T01 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: T02 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: W03 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: W05 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: Q01 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: Q03 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: Q04 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: Q05 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: EIA_DEFINITION_BRIDGE | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-K01 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-K02 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-K03 | CONTEXTUALLY_RELEVANT | Actual AI hardware/power/accounting context; a broad term still does not identify a specific news mechanism. |
| D-AI: B2-K04 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-K05 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-K08 | CONTEXTUALLY_RELEVANT | Actual AI hardware/power/accounting context; a broad term still does not identify a specific news mechanism. |
| D-AI: B2-K09 | CONTEXTUALLY_RELEVANT | Actual AI hardware/power/accounting context; a broad term still does not identify a specific news mechanism. |
| D-AI: B2-K10 | CONTEXTUALLY_RELEVANT | Actual AI hardware/power/accounting context; a broad term still does not identify a specific news mechanism. |
| D-AI: B2-K11 | CONTEXTUALLY_RELEVANT | Actual AI hardware/power/accounting context; a broad term still does not identify a specific news mechanism. |
| D-AI: B2-K13 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-K17 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-ME01 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-ME02 | CONTEXTUALLY_RELEVANT | Actual AI hardware/power/accounting context; a broad term still does not identify a specific news mechanism. |
| D-AI: B2-ME03 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-ME04 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-W01 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-W03 | CONTEXTUALLY_RELEVANT | Actual AI hardware/power/accounting context; a broad term still does not identify a specific news mechanism. |
| D-AI: B2-W05 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-Q01 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-Q03 | CONTEXTUALLY_RELEVANT | Actual AI hardware/power/accounting context; a broad term still does not identify a specific news mechanism. |
| D-AI: B2-Q04 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-Q05 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-Q06 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-CF01 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-CF02 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-CF03 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-CF04 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: L1 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: L3 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-L1 | IRRELEVANT | Substring noise (for example financial, chain, Taiwan or remaining), not an AI assertion. Removed by whole-word matching. |
| D-AI: B2-L3 | CONTEXTUALLY_RELEVANT | Actual AI hardware/power/accounting context; a broad term still does not identify a specific news mechanism. |
| D-PORT: F10 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: ME01 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: ME02 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: ME05 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: ME06 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: ME07 | CONTEXTUALLY_RELEVANT | Actual port/routing mechanism, conditional on observed cargo and operations. |
| D-PORT: W01 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: W02 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: W04 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: Q01 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-K04 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-K06 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-K07 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-K12 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-ME01 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-ME03 | CONTEXTUALLY_RELEVANT | Actual port/routing mechanism, conditional on observed cargo and operations. |
| D-PORT: B2-W02 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-W04 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-Q01 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-Q04 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-CF01 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-CF04 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-L1 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-PORT: B2-L7 | IRRELEVANT | Substring match in export/import/support or related prose; not port-project evidence. Removed. |
| D-CAPEX: B2-K11 | DIRECTLY_RELEVANT | Displays cash/non-cash and AI-use accounting boundaries; no real company CapEx case was selected. |
| D-CAPEX: B2-W03 | DIRECTLY_RELEVANT | Displays cash/non-cash and AI-use accounting boundaries; no real company CapEx case was selected. |
| D-GLD: T01 | DIRECTLY_RELEVANT | Existing hypothesis only; no new GLD permission, prediction or quote. |
| D-IBIT: T02 | DIRECTLY_RELEVANT | Existing risk-funding hypothesis and unknown exposure; no new IBIT permission or observed unwind. |
| D-IBIT: Q04 | DIRECTLY_RELEVANT | Existing risk-funding hypothesis and unknown exposure; no new IBIT permission or observed unwind. |

## Conflict and edge outcomes

| Conflict | Outcome | Preserved boundary |
| --- | --- | --- |
| B2-CF01 | PASS; canonicalValue = null; INCOMPARABLE | FY2025 Foundry 2.0 versus a different foundry definition cannot be averaged, subtracted or silently exchanged. |
| B2-CF02 | PASS; canonicalValue = null; UNBRIDGED | Both WTO nominal-trade vintages remain; this review supplies no reconciliation. |
| B2-CF03 | PASS; canonicalValue = null; UNBRIDGED | Both UNCTAD FDI vintages/scopes remain, including conduit effects; no silent replacement. |
| B2-CF04 | PASS; canonicalValue = null; DISPUTED | Niger/Orano claims remain attributed; no political/legal winner. |

| Edge | Structural retrieval outcome | Actual-case qualification |
| --- | --- | --- |
| B2-L1 M06 → M07 | PASS; conditional export restriction/access → routing | N2 supplies a licensing change, not observed shipment loss/relocation. N1 political statement alone is POTENTIALLY_MISLEADING as evidence for this edge. |
| B2-L3 M06 → M08 | PASS; qualified logic/memory/packaging plus power dependence | Context for N4; no observed hardware bottleneck or energy direction. |
| B2-L4 M10 → M07 | PASS; operating infrastructure + customs + demand → accessibility/routes | N6 reports use, not net new world trade or financial returns. |
| Revised B2-L7 M09 → M10 | PASS; real resource freight → utilization / route viability only | N5 company-reported shipment supplies limited use evidence. Financing viability, profitability and BRI success do not follow. N6 project-debt search finds the explicit limitation, not affirmative finance support. ME03/ME04 still need charges, costs, cash, debt, drawdowns and contracts. |

All four approved edge objects are byte-equivalent before/after the search repair. Edges remain reference context; no source attribution, causal grade or execution permission is upgraded.

## Guardrail outcomes

PASS means the stated boundary survived the cited case review and visible reference; it is **not** an automated semantic validator or proof that every future use will be safe. Compound rules list unexercised subparts. No case was manufactured.

| Guardrail | Real-case status | Evidence and limit |
| --- | --- | --- |
| B2-R01 | PASS | N1/N2 do not infer chips-only motives, war from controls or peace from dependence. No war/peace probability estimated. |
| B2-R02 | PASS | N1 K01 keeps PRC principle, US policy, specific Taiwan statements, corporate action and analyst interpretation separate. US/MAC original truth was not re-audited. |
| B2-R03 | PASS | N3 sample/rerouting does not become aggregate contraction or globalization ending. |
| B2-R04 | PASS | N3 Vietnam result remains sample-specific; no all-connector transshipment or guaranteed resilience. |
| B2-R05 | PASS | N4 forecast/project stages do not become energized/actual AI load or energy. |
| B2-R06 | NOT_EXERCISED | No real company PP&E case selected. K11/W03 diagnostic retrieval and accounting boundary display pass only. |
| B2-R07 | PASS | N5 shipment/jobs do not establish mine ownership, national-flow control or net local benefits. Nationalization-specific news was not exercised. |
| B2-R08 | NOT_EXERCISED | N5 preserves distinct countries, but contains no coup or political-control claim. Diagnostic CF04 attribution is not a real causal test. |
| B2-R09 | PASS | N2 permission is not actual shipment; N5 actual transport is not every planned corridor. MOU/disbursement-specific news not exercised. |
| B2-R10 | PASS | N6 operator usage and N5 route do not prove automatic win-win, debt trap, aid or BRI membership. |
| B2-R11 | PASS | N5 transferred jobs/N6 traffic remain separate from net benefits and financial success. |
| B2-R12 | NOT_EXERCISED | No new lease/restructuring case. K17 keeps historical interpretation attributed and debt risk unresolved in diagnostics only. |
| B2-R13 | PASS | All seven notes produce no asset direction or permission; GLD/IBIT diagnostic outputs remain the original hypothesis/unknown items. |

Totals: 10 PASS, 3 NOT_EXERCISED, 0 FAIL. Rejected interpretations remain audit exclusions, never affirmative search hits or facts asserting their inverse.

## Retrieval defects, limited repair and remaining gaps

1. **Tokenization false positives:** substring matching found AI inside financial/chain/Taiwan and port inside support/export/import. D-AI fell from 48 to 9 hits; D-PORT from 24 to 2. N4 no longer returns the unrelated Batch 1 oil mechanism. Whole-word Unicode letter/number matching, punctuation separation and the existing Bank-of-Japan alias are the entire repair; no stemming, inferred synonym dictionary, LLM or new alias catalog. Punctuation-only input now returns zero rather than matching everything.
2. **Displayed-field false negatives:** PJM, Vietnam/connector countries and Hambantota were present in approved visible limitations but omitted from the index. The index now includes those limitations. Source maps and guardrail text remain excluded. A limitation hit can warn against an inference, not support it; N6 L7 is explicitly reviewed as POTENTIALLY_MISLEADING if read as a financing claim. The statement, grade and limitation remain together in the existing disclosure.
3. **Remaining literal miss:** advanced computing still returns zero. Explicit manual export controls finds K04/ME01, and M06 filters find W01/Q01. This is a vocabulary gap, not grounds to invent an approved alias or an automatic semiconductor classification. Exact whole words do not infer plurals or arbitrary phrase equivalents; port is not automatically ports. The visible theme filters provide a manual route.
4. **Broad-filter noise remains:** Taiwan returns chip/AI/share context not useful to N1; M09 returns the separate Niger question in N5. These are correctly tagged above, never selected automatically. K11 in a PJM case is a warning only. This limited readiness result does not claim high precision for every broad theme.
5. **Coverage and external validity:** six in-sample source notes, not raw bodies or independent fresh news; exact six response-receipt clocks missing. R06/R08/R12 real-news exercises remain absent. No evidence revision or new approved knowledge was needed for the observed lookup defects.

No filter, renderer, knowledge grade or theme-name defect was reproduced. All 20 existing Batch 2 required searches and the old focused Batch 1 checks pass. Four existing production Owner-reviewed storyline files and all four catalog/approval file hashes stayed unchanged between the receipts. No production link save was performed; isolated compatibility tests are not Owner confirmation.

## Runtime, tests and costs

Search repair is limited to the shared local lookup and three focused regression cases. The initial added test failed because it checked a review-label prefix against the full knowledge ID; the assertion was corrected to use reviewLabel. No source or product result was altered to pass that test. During artifact cross-check, the draft incorrectly called CF02/CF03 CONFLICTED; the final artifact uses the actual unchanged UNBRIDGED grades. This was an analysis-document correction, not a catalog change.

Formal browser checks used the existing workbench on loopback port 4173 and the same workspace fingerprint. At 21:36 UTC the exact matching workbench process was reloaded with its existing launcher after confirming all currently due public-source slots were already claimed. The normal context-refresh setting remained enabled; no second long-running instance or new collection was created.

| Formal check | Observed result |
| --- | --- |
| Desktop, existing viewport | PJM returned K08, with distinct stages and its dated limitation visible. One-China Principle returned K01 with all five attribution layers and MAC excerpt limitation. |
| Desktop L7 disclosure | Project debt exposed L7 with the explicit exclusion of direct financing viability and the ME03/ME04 evidence requirement. |
| Mobile, 390 × 844 | Hambantota returned K17; full statement and historical/financial limitations were readable. Document width 375 px within 390 px viewport, no horizontal overflow observed. |
| Mobile zero control | Bitcoin Core showed 0 items / 0 links and “No approved matches. Unknowns are not filled automatically.” |
| Mobile composed filter | M09 + CONFLICT returned CF04 DISPUTED, both parties attributed and Canonical Value “Unknown / not supplied”. |
| Browser health | No captured console errors. Viewport restored; formal tab left on PJM lookup. No link-save action performed. |

Focused tests in this run: World Model 31/31, Batch 2 World Model 38/38, storyline compatibility 15/15; TypeScript passed. These are current-run results, not the prior integration's results.

Full `node scripts/alpha-validate.mjs` on the final product code: **4,963 passed, zero failed**, including TypeScript; 134,924 ms reported duration. Only expected dirty-workspace and LF/CRLF warnings. Private log: `data/runtime/options-workbench-development/batch2-news-full-validation.log`. Subsequent changes were validation-document completion only; the final document was separately checked with the existing Markdown/link checks and receipt/reference assertions.

Seven formal local API queries matched the same final lookup results. Receipt: `data/runtime/options-workbench-development/batch2-news-formal-check.json`, SHA-256 `190e8c225ebec49c44b0772bbe779e3ff7b512e22a2da3f654d6dde5acc4b5e9`. It also retains catalog and four production-link hash comparisons and the browser observations; its artifact hash refers to the document at that check, before this result paragraph. Final artifact/reference validation covered all 58 distinct case-hit assessments, all 10 diagnostic queries, all guardrails and four actual conflict grades.

Public source reads initiated by this validation = **0**; market calls = **0**; external model API calls = **0**. Local deterministic lookups and browser/API reads are not external model or market calls. Existing autonomous public refresh operation is unchanged and is not credited as new validation input. Dollar cost = **UNKNOWN** (no billing evidence), not free.

Daily guidance, Candidate checks, Trade planner, Market expectation, Position watch, Exit checks, capital/risk, Event approach, frozen trend V1, 09:00/15:50 Host schedule and the two independent real-use acceptance states were not changed.

**Batch 2 World Model still does not influence trading decisions.** This stage stops at reviewed research-context readiness; no Batch 3, EV / Contract Fit, automatic classification or Current State was started.
