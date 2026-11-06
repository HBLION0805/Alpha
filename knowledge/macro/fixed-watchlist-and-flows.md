# 每日简报固定栏：宏观盯盘清单 + 资金流观察

As of 2026-11-05. Day-to-day focus = this list only; dig into single stocks only for mentor list, named event trades, or pre-written thesis + hard stop.

## 固定盯盘清单

- 大盘/广度: SPY QQQ IWM DIA RSP · VIX
- 利率/美元/信用: TLT IEF SHY · UUP/DXY · HYG LQD
- 商品: CL/BZ · USO UCO · GLD GLDM · CPER
- 板块: SMH XLK · XLE · XLF · XLI XLB · XLY XLP · XLV · XLU XLRE · XLC · IYT JETS
- 地区/领先: EWY FXI/KWEB · LEN · KRE

Page: 宏观板块关联图 (correlations + scenarios + fund-flow section).

## 资金流观察（每期简报必报，中文一小段）

推断资金偏向（相对强弱，不是精确净流入）：

1. 板块轮动: SMH / XLE / XLF / XLU（+ XLY vs XLP）谁领涨领跌
2. 广度: RSP、IWM 相对 SPY
3. 风险 vs 避险: HYG vs TLT/GLD
4. 成交量确认: 放量涨更像真流入；缩量反弹偏空头回补
5. 辅助: GEX、0DTE put/call（已有则一句）

结论格式示例: 「资金流：偏防守 / 偏进攻成长 / 混乱并列」+ 一句依据。

## Alpha `data/in/watchlist.json` (synced 2026-11-06)

35 tradeable symbols only (no VIX/DXY/CL/BZ futures — those stay in brief/market data via proxies UUP / USO·UCO / VIX series):
SPY QQQ IWM DIA RSP · TLT IEF SHY UUP HYG LQD · USO UCO GLD GLDM CPER · SMH XLK XLE XLF XLI XLB XLY XLP XLV XLU XLRE XLC IYT JETS · EWY FXI KWEB LEN KRE.

Operational universe = `data/in/watchlist.json` = this list (local file; `data/` is gitignored, so the committed copy is `FIXED_UNIVERSE` in `src/macro/universe.ts`, which is also the fallback when the file is missing). volume / earnings / chains `--need` / bars all read it.
The daily routine must NOT rewrite `watchlist.json` from Robinhood personal watchlists (`get_watchlists` / RH 自选). If the file ever drifts, restore it from this list — never from RH 自选. No default mega-cap scan (NVDA/AAPL/MSFT/AMZN/GOOGL/META/AVGO/TSLA); individual names only via mentor / event-followup / explicit thesis.

## Alpha 宏观辅佐定位（2026-11-06）

用户是宏观交易者；Alpha 跟着同一套框架辅佐：
1. 先判宏观趋势与方向（利率/美元/油/信用/风险偏好/板块资金流），再谈个股。
2. 日常宇宙 = 本文件固定 ETF 名单；个股仅战术（导师名单、具名事件、已写好止损的 thesis）。
3. K 线 / FIB 只细化入场与时机；趋势对 + 硬止损到位即可。
4. 积累资本阶段：少亏优先；NO_TRADE 是合法且常见结论。
