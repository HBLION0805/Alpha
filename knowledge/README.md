# Knowledge / 知识库

**中文：** 这里保存的是老交易员 20 多年的经验：宏观手册、交易心理、偏误自检问题、各阶段提示语、交易工作表，以及宏观研究（第 1、2 批及其评审）。所有内容均**逐字**从 `codex/weekly-source-integration-20261011` 分支恢复，没有改写或摘要。它们是教育与反思材料，不是自动交易规则。

**English:** The owner's 20+ years of trading experience: macro playbook, trading psychology, bias self-check questions, phase prompts, trade worksheet, and the macro research (batch 1 & 2 with reviews). Everything is restored **verbatim** from branch `codex/weekly-source-integration-20261011` — nothing reworded or summarized. Educational/reflection material, not automatic trading rules.

## Index / 目录

| File | Content | Count |
|---|---|---|
| [catalog.json](catalog.json) | Canonical data, extracted verbatim from the legacy TS catalogs (`macroCatalog()` output, revision `OWNER_PSYCHOLOGY_20260928_V6`) | 62 items · 17 biases · 21 prompts · 12 worksheet fields · 20 sources |
| [PLAYBOOK.md](PLAYBOOK.md) | All 62 knowledge items (principle / application / limits), grouped: Macro reasoning 5, Decision process 5, Exit and exposure 13, Profit and curves 7, Psychology and evidence 32 | 62 |
| [BIAS_QUESTIONS.md](BIAS_QUESTIONS.md) | Cognitive-bias reflection questions | 17 |
| [PHASE_PROMPTS.md](PHASE_PROMPTS.md) | Before entry / While holding / After a decision prompts + adoption status | 21 + 3 |
| [WORKSHEET.md](WORKSHEET.md) | Trade worksheet fields | 12 |
| [SOURCES.md](SOURCES.md) | Source citations and coverage notes | 20 |
| [delivery/](delivery/) | `OPTIONS_MACRO_PLAYBOOK_DELIVERY.md`, `OPTIONS_MACRO_PSYCHOLOGY_DELIVERY{,_V2,_V3,_V4,_V6}.md` (V5 delivery doc never existed on the branch) | 6 |
| [specifications/](specifications/) | `OPTIONS_MACRO_PLAYBOOK_V1.md`, `OPTIONS_MACRO_PSYCHOLOGY_V1…V6.md` | 7 |
| [status/](status/) | `macro-context/playbook/psychology*.json` status records | 5 |
| [research/macro/](research/macro/) | batch-1 (M01–M05 + synthesis + review), batch-2 (M06–M10 + synthesis + review), world-model real-news validations | 20 |
| [owner-capital/](owner-capital/) | Owner capital shopping list (research universe, not allocation) — JSON data + spec + status | 50 entries |
| [options/](options/STRATEGIES.md) | 期权课程目录 / options course catalog: `course.json` (verbatim export of `course-catalog.mjs` + `course-framework.mjs`), `STRATEGIES.md`, structure-comparison spec + delivery, course framework/archive delivery docs, status JSON, synthetic comparison fixture; `source-code/` has `OptionsStructureComparisonEngine.ts` payoff math + fixtures/tests and the two `.mjs` originals as `.txt` | 19 strategies · 7 framework checks · 21 chapters |
| [courses/](courses/README.md) | **两门课程原文（逐字）** from https://emacrotrading.com/ — `macro/` 《如何成为更好的宏观交易员》 index + 16 chapters + 附录 A–D (21 pages), `options/` 《美股期权交易》 index + 16 chapters + 附录 A–E (22 pages); 336,614 chars total | 43 |
| [options/COURSE_OUTLINE.md](options/COURSE_OUTLINE.md) | Options course outline page (verbatim, same as courses/options/00-index.md) | 1 |
| [mentor/](mentor/) | **大佬补充（两门课之外）/ Mentor's supplement beyond the two courses** — [MENTOR_NOTE_CLASS_AND_UPBRINGING.md](mentor/MENTOR_NOTE_CLASS_AND_UPBRINGING.md) 家教与阶级 (byte-for-byte). Drives the "actors" prompt in the macro risk view and digest (谁在制定规则 / 谁在承担代价 / 谁拥有选择 / 激励与恐惧) | 1 |
| [mentor/reviews/](mentor/reviews/) | **大佬复盘 / Mentor trade reviews** (byte-for-byte; more will be added here): [REVIEW_HYG_IWM_TLT_TQQQ.md](mentor/reviews/REVIEW_HYG_IWM_TLT_TQQQ.md) — lessons enforced in `src/options/pretrade.ts` (assignment plan, per-leg risk, buying power for full short notional on Robinhood, time buffer, adjustments = new trades, full accounting) and `matrix.ts` (credit spreads de-prioritised) | 1 |
| [source-code/](source-code/) | Original catalog sources as `.txt` (provenance for the JSON; not built) | 3 |

The markdown views are generated: `node scripts/render-knowledge.ts` (edit `catalog.json`, not the .md).
Verified: all 602 text fields in `catalog.json` occur verbatim in the original catalog source and in the markdown views; every restored doc is byte-identical to the original branch.
