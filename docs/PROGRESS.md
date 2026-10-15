# Alpha progress

**Goal:** a macro-trading decision aid for one user. In priority order:
1. News and event alerts (the core feature).
2. Daily macro brief with a macro-first conclusion.
3. Risk and discipline gates: defined risk, caps, NO_TRADE.
4. Mentor knowledge base feeding 1–3.

Technicals are for timing only. Update this file after every task.

_Last updated 2026-10-14 22:30 ET (scope review)._

## Status

| Goal | Modules | Wired into run.sh | Actually ran | Status |
|---|---|---|---|---|
| (1) Alerts | ingest/rss, adapters/rss, sources, store, normalize, adapters/nlp, cluster, noise, score, alerts, cli/poll, cli/alerts | yes, every run | **2 runs ever** (21:07, 21:15 ET 10/14) | ⚠️ Works, but not scheduled and not delivered |
| (1) | ingest/alpacaNewsWs, cli/stream | no (needs a long-running process + keys) | REST backfill only, through poll | optional |
| (1) | ingest/officialCalendar, calendar/releases-2026.json | read by macro, premarket, scenarios | yes | ok |
| (2) Brief | macro/* (series, fetch, stats, regime, confirm, risk, build, render, store), cli/macro, digest, cli/digest | yes | yes | ok, but split across 3 reports (see below) |
| (2) | macro/premarket, cli/premarket | 07:00–09:29 ET only | never in a scheduled run | ⚠️ |
| (2) | macro/scenarios, cli/scenarios | 16:15–16:59 ET only | manual only | ⚠️ new |
| (2) timing | macro/volume, levels, adapters/bars, adapters/indicators | premarket/16:30 windows | manual only; `data/in/` does not exist | ⚠️ no Robinhood inputs yet |
| (3) Gates | options/rules, pretrade, discipline, stops, adjust, payoff, bs | only via `options --proposal` (manual) | tests + examples only | ✅ logic / ⚠️ no entry point in the daily flow |
| (3) | options/kelly, options/takeprofit | **nowhere** (tests only) | – | ⚠️ unwired |
| (3) | options/journal | `options --journal` (manual) | examples only | ⚠️ no real journal file |
| (3/2) | options/chain, robinhood, dashboard, matrix, ivhistory, events | run.sh runs `options` only if `data/in/spy-chain.json` exists | never (no file) | ⚠️ over-built for current use |
| (4) KB | knowledge/*, catalog.json, scripts/render-knowledge.ts | cited by risk, premarket, scenarios | yes | ok |
| infra | adapters/yahoo, adapters/schemas, types | – | yes | ok |
| OFF-GOAL | none found | | | |

## Gaps that block the core (1)

1. **No scheduler.** `run.sh` ran twice, the first time at 21:07 ET. The hot CPI (released 08:30 ET) alerted about 12.5 hours late. Needs a cron or routine every 5–15 minutes, 06:00–20:00 ET.
2. **No delivery.** Alerts go to `data/out/alerts-latest.md` and stdout. Nothing pushes them to the user (no email, push or chat).
3. **Scoring misses geopolitical/oil shocks.** The Strait of Hormuz ship sinkings and the Aramco attack (10/14, 4+ outlets) never reached the threshold:
   - "Container ship sinks in Strait of Hormuz as Iran steps up attacks" scored 43 with no topic.
   - The geopolitics regex matches `attack` but not `attacks`.
   - There is no shipping/chokepoint vocabulary (Hormuz, tanker, shipping, Aramco). This is world line #17.
   - The Hormuz items landed in separate clusters instead of one.

## Over-built / duplicated (recommendations)

- **Three overlapping macro reports:** macro, premarket and scenarios each fetch similar series and each produce a NO_TRADE view. Merge them into one daily brief (2) with sections: premarket checks, regime, scenarios.
- **Options layer (about 1,600 lines)** has never had real data. Freeze it: no new features until a Robinhood chain is actually saved daily.
- **kelly.ts and takeprofit.ts** are used only by tests. Either wire them into `pretrade` / `options --journal` or drop them from the roadmap.
- **Dead code, still present:**
  - `rules.managementPlan` (unused; it also says "never add to a losing long option", which contradicts the one-disciplined-add rule).
  - `discipline.SESSION_QUESTIONS` (unused).
  - Both should be wired into the decision card or deleted.
- **Dead code, deleted in this review:** `src/reuse/OptionsContractQuote.ts`, `fetchFomcCalendar`, `ALARM_SCORE`, `VOLUME_ALARM_SCORE`.

## Next 3 priorities

1. **Schedule and deliver alerts:** a routine or cron running `scripts/run.sh` every 10 minutes, 06:00–20:00 ET, sending new alerts to the user.
2. **Fix alert recall for geopolitical/oil/shipping shocks:** regex plurals, chokepoint terms, an oil/war topic boost. Add the 10/14 Hormuz items as a regression fixture.
3. **One daily brief:** fold premarket, macro and scenarios into a single Chinese brief with one macro-first conclusion and one NO_TRADE verdict.
