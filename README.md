# Alpha — news & event alerts (MVP)

Low-latency market news pipeline for US stocks/options, crypto and gold.
Requires **Node 24+** (`node:sqlite`, native TypeScript type-stripping).

```
npm install
npm run poll                 # fetch all enabled feeds in sources.yaml (+ Alpaca REST backfill if ALPACA_KEY/ALPACA_SECRET set)
npm run stream               # Alpaca/Benzinga websocket → SQLite (low latency); --seconds N to stop
npm run digest -- --hours 24 --out digest.md
npm test && npm run typecheck
```

Pipeline: `sources.yaml` → `src/ingest/{rss,alpacaNewsWs,officialCalendar}.ts` → `src/store.ts`
(SQLite, dedupe by normalized URL / title) → `src/cluster.ts` (token similarity + time window) →
`src/score.ts` (source tier, macro topics, multi-source/stance confirmation, recency, official bonus) →
`src/narrative.ts` (left / center / right / Chinese official / US official framing) → `src/digest.ts` (markdown).

The previous Codex-built tree was removed; it is recoverable from branch
`codex/weekly-source-integration-20261011`. `src/reuse/OptionsContractQuote.ts` is kept for the options phase.
