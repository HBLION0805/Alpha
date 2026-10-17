# 大佬 纪律 channel series

Verbatim mentor texts. Each file is the canonical source; `knowledge/catalog.json` items cite it rather than restating it.

| File | Topic | Status |
|---|---|---|
| [stop-loss.md](stop-loss.md) | 止损学: 13 stop types, 30/30 rule, re-entering & adding (15,628 bytes, cmp-verified) | saved 2026-10-14; encoded in `src/options/stops.ts`, `adjust.ts`, `pretrade.ts` |
| [discipline-01-20.md](discipline-01-20.md) | 纪律系列 01–20 (31,110 bytes, cmp-verified; author names and timestamps stripped at the user's request) | saved 2026-10-14; mapped onto existing catalog ids. New checks in `src/options/discipline.ts` |
| [take-profit.md](take-profit.md) (+ pristine [take-profit.verbatim.md](take-profit.verbatim.md), [take-profit-img/](take-profit-img/) 01–11) | 止盈学: 11 option P&L curves + core (§1–§12). The images are embedded at their sections and the text is unaltered | saved 2026-10-14; encoded in `src/options/takeprofit.ts` |
| [premarket-routine.md](premarket-routine.md) | Premarket Routine, 3 videos: **video transcription, near-verbatim** (not word-for-word; saved unchanged, 5,137 bytes) | done 2026-10-14; run daily at 7:30 ET by `src/macro/premarket.ts` (`npm run premarket`) → data/out/premarket-latest.md 【大佬流程】 + 【DK 补充】 |
| [seven-sins.md](seven-sins.md) | 股市七宗罪 (mentor article, Discord 夜雨 [RNMK]; verbatim) + DK checklist | saved 2026-10-17; per-trade behaviour tags in `src/options/sins.ts`, weekly review §八之三 |
| [short-selling.md](short-selling.md) (+ spec [short-selling.rules.json](short-selling.rules.json)) | 做空学 10 条 + 做空赚钱 短笔记（verbatim, 2,988 bytes, cmp-verified; no author/timestamps in source) + DK 做空清单 | saved 2026-10-17; warn tags in `src/options/shortside.ts` (plan card §9, practice opens, review); short stock / covered put recorded as phase-2 reference only, not enabled |
