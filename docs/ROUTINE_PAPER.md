# Routine step: refresh paper-ledger quotes (Robinhood, READ-ONLY)

Scripts cannot call the Robinhood MCP, so the routine agent does this **before** `scripts/run.sh` on weekdays between 15:45 and 16:59 ET.
Only these read-only tools are used: `get_option_instruments` and `get_option_quotes`. Never place, cancel or modify anything.

1. Run `node src/cli/paper.ts legs`. It writes `data/in/paper-open-legs.json` = `{generatedAt, legs:[{underlying,type,strike,expiration}]}`.
2. For each leg, call `get_option_instruments` with `chain_symbol=<underlying>`, `expiration_dates=<expiration>`, `type=<type>`, `strike_price=<strike with 4 decimals>` and take `instruments[0].id`.
   - VIX and other index chains work the same way.
   - Skip a leg if no instrument is found.
3. Call `get_option_quotes` with all ids (≤20 per call).
4. Write `data/in/rh-option-quotes.json` exactly in this shape (no account numbers, nothing else):
   ```json
   {"source":"robinhood get_option_quotes (read-only)","fetchedAt":"<now, ISO UTC>",
    "quotes":[{"underlying":"NVDA","type":"call","strike":220,"expiration":"2026-10-23",
               "mark":<mark_price>,"bid":<bid_price>,"ask":<ask_price>,"iv":<implied_volatility or null>,"updatedAt":"<quote.updated_at>"}]}
   ```
5. VIX expiry days only (VIX options settle at the open on the expiration date, e.g. 2026-10-21): if the official VIX settlement value (VRO) is published, write
   `data/in/settle.json` = `{"date":"<YYYY-MM-DD ET>","VIX":<VRO>}`. Otherwise write nothing. The VIX trade stays open with `settlePending`. Never use the VIX close.

`scripts/run.sh` then does the rest:
- **`paper mark`:** one mark per trade per ET day. It warns if the quotes file is >60 min old; missing legs fall back to Black-Scholes, marked 估算.
- **`paper expire`:**
  - Equity/ETF expiries settle at the Yahoo close after 16:00 ET.
  - VIX settles from `settle.json`.
  - Friday 15:45+: the mentor weekend rule.
- **`npm run review`:** writes `data/out/review-<date>.md`.

## 分类规则（2026-10-29 用户决定）
- Alpha 根据自己事先写好的计划卡开的纸面单（如 `data/out/intraday-YYYY-MM-DD.md`、`swing-spreads-*.md`）= **正式单**（kind=formal, source=paper_sim），计入 30 笔 readiness。走正式开仓路径：`npx tsx src/cli/paper.ts open --kind formal --card <卡id> …`（需 proposal / 计划卡关联），并在 entry 中保留 cardId/planRef 与 preWrittenPlan=true，避免 no_pre_written_plan。
- 只有直接照抄导师的交易才用 `macro-open`（宏观单，不计入）。
- 计划卡里的【导师】/【Alpha】标签不改变分类；决定分类的是"是否由 Alpha 自己预写计划"。
- 环境注意：本机 / run.sh 用 Node 24+（系统 /usr/local/bin/node → v24.22.1；项目本地 /home/box/.local/node24/bin → v24.22.0；package.json `engines` node>=24）。`scripts/run.sh` 先加 `ALPHA_NODE_BIN`，否则把上述 Node 24 目录加到 PATH 前面，Node <24 时直接拒绝运行。`npm run readiness` 在 Node 24 下可用（node:sqlite）。Cron/routine 请经由 `scripts/run.sh` 调用，或先 `export PATH=/home/box/.local/node24/bin:$PATH`（或设 `ALPHA_NODE_BIN`）。
- 先例：2026-10-29 RSP/META 两笔由 macro 改为 formal（id 改为 rsp-/meta-stock-long-2026-10-29-paper，oldId 保留；备份 data/journal/paper.pre-reclass-2026-10-29.json）。
