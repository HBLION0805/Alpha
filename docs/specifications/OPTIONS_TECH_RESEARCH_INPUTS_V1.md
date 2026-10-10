# TECH36_RESEARCH_INPUTS_V1

The explicit `options:tech-candidate --research-inputs` operation loads the existing verified candidate source bundle, replays the original ranking and derives materials for all companies in the original fixed pool. It accepts `--source-root` and a new `--run-id` only. Quote/evidence/manual research inputs are not accepted in this mode.

The saved projection has three separate collections:

1. `documents`: original event ID, company scope, URL, original-byte SHA-256, relative source path, independent filing/receipt clocks and extracted text blocks. `sourceStart` / `sourceEnd` are offsets into the original bytes decoded as UTF-8, with an exclusive end. They are not byte positions or rendered DOM coordinates. Original bytes remain authoritative.
2. `eventInputs`: one row per saved company/event review, document references, attributed related discoveries, the saved interpretation and unfinished structured research fields. Interpretation is not machine-verified numerical evidence. Material conflicts and unavailable bodies remain local issues.
3. `companies`: all 36 company IDs, source coverage, full discovered event IDs, reviewed event IDs, unresolved IDs, inherited ranking and the distinct limited-followup classification. Research availability does not change qualification or score.

Same-event original envelopes deduplicate by event ID plus byte hash. Different events with identical bodies remain separate. Only original saved review relations bind headline IDs; the linked record must exist and include the reviewed company. Unbound associations stay unresolved. A linked headline does not establish readable publisher content or a new independent opportunity.

Guidance and surprise fields carry no numeric delta in V1. Numerical extraction and comparison are deliberately absent: any future comparator must require matched target fiscal period/metric/basis/currency/unit/scope and qualified consensus captured before announcement. Cross-period differences or a missing pre-event baseline cannot imply revised guidance or a beat.

Generation must not precede source receipts, review processing or followup clocks. Unknown document publication time remains null and is never replaced by filing acceptance or receipt time. The mode is saved-original replay, not current-market research or an original plan freeze.

Output is a new ignored local directory containing copied originals, `research-inputs.json` and `receipt.json`. The receipt binds implementation hashes and every copied file/output hash. It carries no execution or Paper admission authority. Missing source content is local; broken bundle integrity fails before output creation. Original inputs are never rewritten.

Supported parser scope: UTF-8 HTML body text, structural blocks, table-row text, numeric/basic entities, script/comment/style and explicit inline-hidden omission. External CSS, visual layout, arbitrary PDF/JSON documents, numeric table semantics and automatic language interpretation are unsupported. The retained original permits review of parsing limitations.
