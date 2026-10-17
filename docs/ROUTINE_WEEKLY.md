# Routine: Friday weekly review (16:45 ET)

> Weekly review (READ-ONLY; never place/cancel/modify orders; never push git). Every Friday at 16:45 America/New_York:
> in /workspace/Alpha (branch dk/news-mvp) run `export PATH=/home/box/.local/node24/bin:$PATH && npm run -s review -- --week --print`.
> Deliver the printed report (everything above "附：逐笔明细") to the user in chat, in Chinese, unchanged — do not add numbers,
> do not fill gaps marked 缺/未知. Mention the full file path data/out/review-week-<date>.md. If the command fails, report the error verbatim.
> §八之三 七宗罪: auto tags are candidates only. After delivering, ask the user to confirm or reject them
> (`npm run paper -- sin --id <id> --sin <sin>` / `--remove <sin>`) and to add the manual-only ones (absent at open, FOMO, moved stop, blaming others).
> §八之四 交易信心: report the ratio as printed; do not reclassify trades.

## 周末清单（手动，不自动打分）

Source: 导师 周末提醒 + 周末没有闲聊（knowledge/mentor/psychology/mentor-routine-and-origin.md, verbatim）; DK checklist below is not mentor wording. Nothing here is checked by code.

1. **复盘 + 交易日志**：每笔平仓的单子回答 6 问（`npm run paper -- journal --id … --why … --thesis … --right … --wrong … --violated … --redo …`）。赚钱的单子也要问：是判断对，还是运气？（`--profitable-but-wrong yes|no`）。亏损的单子归类：判断 / 执行 / 风险管理 / 正常概率波动（`--error-class`）。
2. **补宏观**：把这周没看完的宏观、利率、美元、债券、地缘内容补上（data/out/brief-*.md）。
3. **多读东西**：一本书最重要的章节/观点（可以让 AI 整理）。
4. **学一点英语**：财经新闻、公司公告、期权术语、券商指令。
5. **该休息就休息**：吃饭、运动、出去走走、陪家人朋友；不学习的时候不盯盘（身体和情绪资本，见 knowledge/mentor/psychology/video-the-trading-game.md）。
6. **看周报**：§八之二 门槛校准（心理提示标签 warn_72h_event / warn_add_to_loser_* / warn_size_up_after_wins / warn_day_after_big_win / warn_pyramid_add_larger / warn_put_strike_unrealistic 也在里面）、§八之三 七宗罪、§八之四 交易信心。下周想提高信心 → 先降低分母：少交易、提高筛选标准。
