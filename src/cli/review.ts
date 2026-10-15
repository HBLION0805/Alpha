/** npm run review [-- --date YYYY-MM-DD | --week] [--journal data/journal/paper.json] → data/out/review-<date>.md */
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderReview } from "../options/reviewreport.ts";
const { values } = parseArgs({ options: { journal: { type: "string", default: "data/journal/paper.json" }, date: { type: "string" }, week: { type: "boolean" }, out: { type: "string" } } });
const j = JSON.parse(readFileSync(values.journal!, "utf8"));
const to = values.date ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const from = values.week ? new Date(Date.parse(to) - 6 * 86400_000).toISOString().slice(0, 10) : to;
const md = renderReview(j.entries, j.capital, from, to);
const out = values.out ?? `data/out/review-${to}.md`;
mkdirSync("data/out", { recursive: true }); writeFileSync(out, md + "\n");
process.stdout.write(`[review] ${from}${from === to ? "" : `→${to}`} → ${out}\n`);
