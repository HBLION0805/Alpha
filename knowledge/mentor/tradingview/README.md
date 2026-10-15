# K线阅读 · Bzzb — mentor's TradingView indicator (Pine Script v6)

- File: [kline-reading-bzzb.pine](kline-reading-bzzb.pine), a byte-for-byte copy of the mentor's attachment `01M4YJYBSYBGCKM054Q926B69D.txt` (110,107 bytes, 2,412 lines). Load it in TradingView via Pine Editor → paste → Add to chart.
- Mentor's words (verbatim, [../MENTOR_KELLY_INTC_2026-10-14.md](../MENTOR_KELLY_INTC_2026-10-14.md)): "再次安利一下这个价格行为学的划线的指标 小级别很好用 可以放在trandingview上我的脚本里。"

What it draws, read from the script's feature switches (overlay on price, `indicator("K线阅读 · Bzzb", overlay=true)`):
- **Auto trendlines / triangles** (`showTL`): fits lines through ≥3 swing touches, with pierce/violation tolerance and staleness rules.
- **Support/resistance** (`showSR`): the 2 nearest S/R zones, merged within 0.5 ATR.
- **Candlestick patterns** (`showPatterns`): doji, long shadows, big bars, liquidity sweeps (`swp*`).
- **Chart patterns** (`showChartPat`): head-and-shoulders, etc.
- **Divergences** (`showDiv`): RSI(14) / MACD(12,26,9). Also KDJ, Bollinger(20,2), volume MA.
- **TD sequential counts** (`showTD`), **open-interest change** (`showOi`), and a **trend gate** (`showGate`) that flags flat or choppy conditions.
- **Info panel + trade plan** (`showPanel`, `showPlan`). The risk group "风险 / 仓位（结构止损反推仓位）" sizes the position from the structural stop, with 1% risk per trade by default, round-trip cost, and a minimum plan R:R of 1.0.

Our use: read-only charting aid for spotting levels on small timeframes. Nothing in `src/` executes it. Its support levels feed the INTC-style "near support → convert to PDS" check in `src/options/adjust.ts` only when you enter them yourself.
