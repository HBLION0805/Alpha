# Futures: same-contract changes (all Yahoo `=F` series)

This generalizes PR #15's oil method (docs/OIL_VIX.md) to every futures series in the brief. Code: `src/macro/futContract.ts`; oil (`oilContract.ts`) is now a client of it.

- **Front contract** = the `underlyingSymbol` of the continuous quote (Yahoo v7 quote). The contract quote is accepted only if Yahoo's own `symbol` field is that contract.
- **1-day change** = the contract's price ÷ the SAME contract's previous close − 1. It is never computed from the continuous daily bars, which splice contracts on roll days.
- **History** (5-day, SMA, 52-week high) = the contract's own bars via `frontContinuous`. Only the last ~10 trading days are that contract; older history is ratio back-adjusted (回溯调整连续合约). The series' last two points are pinned to the contract quote and to its previous close.
- **Missing data:**
  - No quote or no underlyingSymbol → empty series → n/a and no alarm or flag.
  - Contract bars missing or short → price only, so the 5-day change, SMA and 52-week high are n/a.
- **Roll label** 「已换月至 X」 comes only from the saved state `data/out/futures-front.json`, keyed by series id. Entries from the legacy `data/out/oil-front.json` are carried over.
- **`--offline`**: the old continuous method is used, with a note.
- Stocks, ETFs and indices (^VIX, ^TNX, SPY, …) are unchanged.

## Audit (Yahoo `=F` symbols, 2026-10-29)

| Symbol | Where used | underlyingSymbol (live 10-29) | Converted |
|---|---|---|---|
| ES=F, NQ=F, RTY=F | premarket ④ 期货焦虑度 (🔥 \|1d\| ≥ 1% flag), scenarios/matrix inputs | ESZ26.CME, NQZ26.CME, RTYZ26.CME | yes |
| NQ=F | mentorSignals live-first quote (brief.ts `yahooQuote`), dead-cat NQ level, mentor levels (levels.json) | NQZ26.CME | yes (the live quote is the contract itself) |
| GC=F | premarket 黄金, DXY cross-confirmation, scenarios (20-day), mentorSignals live quote | GCZ26.CMX | yes |
| HG=F | oilvix driver (copper 5-day) | HGZ26.CMX | yes |
| RB=F | oil block 汽油 vs 原油 | RBZ26.NYM | yes |
| CL=F, BZ=F | oil block and alarms (PR #15), scenarios/matrix | CLZ26.NYM, BZF27.NYM | yes (data.WTI/BRENT now contract series too) |
| EWF=F | dead-cat EWF row | EWFZ26.CME | yes |
| GC=F, ZT=F | `src/macro/series.ts` macro SERIES → SQLite → macro report/regime | GCZ26.CMX, ZTZ26.CBT | **no** (left open: refreshMacro stores daily bars; converting needs the store schema) |
| CL=F | `src/cli/shadow.ts` (WTI 5-day), `src/cli/crisisPath.ts` (history behind the front series) | CLZ26.NYM | **no** (outside the brief/alerts) |
| YM=F, SI=F, NG=F, ZN=F, ZB=F | not used by Alpha | YMZ26.CBT, SIZ26.CMX, NGZ26.NYM, ZNZ26.CBT, ZBZ26.CBT | n/a (picked up automatically if added to PM_SERIES/DEADCAT_SERIES) |
| VX=F | not used (Alpha uses ^VIX / ^VIX3M indices) | **Yahoo returns no quote at all** | resolves to null → n/a, no alarm |

Alerts (`src/alerts.ts`) read the alarms the brief inserts into the store, so they inherit the same-contract numbers.
Tests: test/futcontract.test.ts (ES Dec→Mar roll: the fake +1.05% 🔥 is gone), test/oilcontract.test.ts.
