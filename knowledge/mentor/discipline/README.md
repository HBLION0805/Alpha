# 大佬 纪律 channel series

Verbatim mentor texts. Each file is the canonical source; `knowledge/catalog.json` items cite it rather than restating it.

| File | Topic | Status |
|---|---|---|
| [stop-loss.md](stop-loss.md) | 止损学: 13 stop types, 30/30 rule, re-entering & adding (15,628 bytes, cmp-verified) | saved 2026-10-14; encoded in `src/options/stops.ts`, `adjust.ts`, `pretrade.ts` |
| [discipline-01-20.md](discipline-01-20.md) | 纪律系列 01–20 (31,110 bytes, cmp-verified; author names and timestamps stripped at the user's request) | saved 2026-10-14; mapped onto existing catalog ids. New checks in `src/options/discipline.ts` |
| [take-profit.md](take-profit.md) (+ pristine [take-profit.verbatim.md](take-profit.verbatim.md), [take-profit-img/](take-profit-img/) 01–11) | 止盈学: 11 option P&L curves + core (§1–§12). The images are embedded at their sections and the text is unaltered | saved 2026-10-14; encoded in `src/options/takeprofit.ts` |
| [premarket-routine.md](premarket-routine.md) | Premarket Routine, 3 videos: **video transcription, near-verbatim** (not word-for-word; saved unchanged, 5,137 bytes) | done 2026-10-14; run daily at 7:30 ET by `src/macro/premarket.ts` (`npm run premarket`) → data/out/premarket-latest.md 【大佬流程】 + 【DK 补充】 |
