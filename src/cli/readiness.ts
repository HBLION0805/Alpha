/**
 * npm run readiness [-- --journal data/journal/paper.json --capital 5000 --out data/out/readiness-latest.md]
 * Live-readiness scorecard from the paper-trade journal (src/options/readiness.ts). Shock days = VIX > VIX3M
 * (term-structure backwardation, from the macro store) + high-impact release days (calendar/releases-YYYY.json).
 */
import { defaultCapital } from "../config.ts";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { loadShockDates } from "../options/shockdates.ts";
import { readiness, renderReadiness } from "../options/readiness.ts";
import type { JournalEntry } from "../options/journal.ts";
import { buildDashboard, renderDashboard } from "../options/readinessDashboard.ts";

const { values } = parseArgs({ options: { journal: { type: "string", default: "data/journal/paper.json" }, capital: { type: "string" }, out: { type: "string", default: "data/out/readiness-latest.md" }, json: { type: "boolean", default: false } } });
const raw = existsSync(values.journal!) ? JSON.parse(readFileSync(values.journal!, "utf8")) : { entries: [] };
const journal: JournalEntry[] = Array.isArray(raw) ? raw : raw.entries ?? [];
const capital = Number(values.capital ?? raw.capital ?? defaultCapital());

const shock = loadShockDates(journal.map((e) => e.openedAt.slice(0, 4)));

const r = readiness({ journal, capital, shockDates: [...shock] });
const dash = buildDashboard(journal, capital);
const md = renderDashboard(dash) + "\n" + renderReadiness(r);
writeFileSync((values.out!).replace(/\.md$/, "") + "-dashboard.json", JSON.stringify(dash, null, 2) + "\n");
mkdirSync(dirname(values.out!), { recursive: true });
writeFileSync(values.out!, md);
process.stdout.write(values.json ? JSON.stringify(r, null, 2) + "\n" : md);
if (!journal.some((e) => e.mode === "paper")) process.stderr.write(`[readiness] no paper trades in ${values.journal} — add entries with "mode": "paper" (see examples/paper-journal.json)\n`);
