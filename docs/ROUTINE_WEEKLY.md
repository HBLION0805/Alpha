# Routine: Friday weekly review (16:45 ET)

> Weekly review (READ-ONLY; never place/cancel/modify orders; never push git). Every Friday at 16:45 America/New_York:
> in /workspace/Alpha (branch dk/news-mvp) run `export PATH=/home/box/.local/node24/bin:$PATH && npm run -s review -- --week --print`.
> Deliver the printed report (everything above "附：逐笔明细") to the user in chat, in Chinese, unchanged — do not add numbers,
> do not fill gaps marked 缺/未知. Mention the full file path data/out/review-week-<date>.md. If the command fails, report the error verbatim.
> §八之三 七宗罪: auto tags are candidates only. After delivering, ask the user to confirm or reject them
> (`npm run paper -- sin --id <id> --sin <sin>` / `--remove <sin>`) and to add the manual-only ones (absent at open, FOMO, moved stop, blaming others).
