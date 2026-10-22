/** npm run review [-- --date YYYY-MM-DD | --week] [--journal data/journal/paper.json] → data/out/review-<date>.md */
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderReview } from "../options/reviewreport.ts";
import { weeklyReport } from "../options/weekly.ts";
import { readiness } from "../options/readiness.ts";
import { loadShockDates } from "../options/shockdates.ts";
import { defaultCapital } from "../config.ts";
import { existsSync } from "node:fs";
import { buildDashboard, renderDashboard } from "../options/readinessDashboard.ts";
import { shadowReport } from "../shadow/engine.ts";
const { values } = parseArgs({ options: { journal: { type: "string", default: "data/journal/paper.json" }, date: { type: "string" }, week: { type: "boolean" }, out: { type: "string" }, print: { type: "boolean" } } });
const j = JSON.parse(readFileSync(values.journal!, "utf8"));
const to = values.date ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const from = values.week ? new Date(Date.parse(to) - 6 * 86400_000).toISOString().slice(0, 10) : to;
const capital = j.capital ?? defaultCapital();
const shadowF = "data/out/shadow/ledger.json", shadowLines = values.week && existsSync(shadowF) ? shadowReport(JSON.parse(readFileSync(shadowF, "utf8"))) : undefined;
const md = values.week
  ? weeklyReport({ shadowLines, entries: j.entries, capital, from, to, readiness: readiness({ journal: j.entries, capital, shockDates: loadShockDates(j.entries.map((e: { openedAt: string }) => e.openedAt.slice(0, 4))) }) }).md
    + "\n\n---\n\n" + renderDashboard(buildDashboard(j.entries, capital))
    + "\n\n---\n\n## 附：逐笔明细\n\n" + renderReview(j.entries, capital, from, to).split("\n").slice(1).join("\n")
  : renderReview(j.entries, capital, from, to);
const out = values.out ?? `data/out/review-${values.week ? "week-" : ""}${to}.md`;
mkdirSync("data/out", { recursive: true }); writeFileSync(out, md + "\n");
if (values.week && values.print) process.stdout.write(md + "\n");
process.stdout.write(`[review] ${from}${from === to ? "" : `→${to}`} → ${out}\n`);
