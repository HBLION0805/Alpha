/**
 * npm run readiness [-- --journal data/journal/paper.json --capital 100000 --out data/out/readiness-latest.md]
 * Live-readiness scorecard from the paper-trade journal (src/options/readiness.ts). Shock days = VIX > VIX3M
 * (term-structure backwardation, from the macro store) + high-impact release days (calendar/releases-YYYY.json).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { Store } from "../store.ts";
import { initMacro, loadObs } from "../macro/store.ts";
import { readiness, renderReadiness } from "../options/readiness.ts";
import type { JournalEntry } from "../options/journal.ts";

const { values } = parseArgs({ options: { journal: { type: "string", default: "data/journal/paper.json" }, capital: { type: "string" }, out: { type: "string", default: "data/out/readiness-latest.md" }, json: { type: "boolean", default: false } } });
const raw = existsSync(values.journal!) ? JSON.parse(readFileSync(values.journal!, "utf8")) : { entries: [] };
const journal: JournalEntry[] = Array.isArray(raw) ? raw : raw.entries ?? [];
const capital = Number(values.capital ?? raw.capital ?? process.env.ALPHA_CAPITAL ?? 100000);

const shock = new Set<string>();
try {
  const st = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite"); initMacro(st.db);
  const v3 = new Map(loadObs(st.db, "VIX3M").map((o) => [o.t.slice(0, 10), o.v]));
  for (const o of loadObs(st.db, "VIX")) { const m = v3.get(o.t.slice(0, 10)); if (m != null && o.v > m) shock.add(o.t.slice(0, 10)); }
} catch { /* no store → calendar only */ }
for (const y of new Set(journal.map((e) => e.openedAt.slice(0, 4)))) {
  const f = new URL(`../../calendar/releases-${y}.json`, import.meta.url);
  if (existsSync(f)) for (const e of JSON.parse(readFileSync(f, "utf8")).events ?? []) shock.add(String(e.date).slice(0, 10));
}

const r = readiness({ journal, capital, shockDates: [...shock] });
const md = renderReadiness(r);
mkdirSync(dirname(values.out!), { recursive: true });
writeFileSync(values.out!, md);
process.stdout.write(values.json ? JSON.stringify(r, null, 2) + "\n" : md);
if (!journal.some((e) => e.mode === "paper")) process.stderr.write(`[readiness] no paper trades in ${values.journal} — add entries with "mode": "paper" (see examples/paper-journal.json)\n`);
