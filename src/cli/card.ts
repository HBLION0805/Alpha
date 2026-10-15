/**
 * 入场前计划卡: npm run card -- --sym NVDA --dir bear [--structure put_spread] [--legs "+210P,-200P"] --exp 2026-10-23
 *   [--thesis "因为…所以…"] [--invalidation "收盘站上 225"] [--save] [--out data/out/card-<sym>.md]
 * --save appends to data/journal/pending-cards.json; later: npm run paper -- open ... --card <id>.
 * Read-only data: Yahoo daily bars, CBOE delayed quotes (+ data/in/rh-option-quotes.json when fresh), brief-latest.json,
 * official calendar + OpEx, data/in/earnings.json, the paper journal. Nothing here can place an order.
 */
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { buildCard, renderCard, type Quote } from "../review/card.ts";
import { fetchCboeRaw, gexFromRaw, cboeQuotes } from "../options/gex.ts";
import { yahooDaily } from "../adapters/yahoo.ts";
import { referenceLevels } from "../levels.ts";
import { withOpex } from "../macro/opex.ts";
import { parseEarnings } from "../options/events.ts";
import { defaultCapital } from "../config.ts";
import { loadEarningsBook, nextEarnings } from "../options/earningsStore.ts";
import { loadFedSpeakers } from "../ingest/fedSpeakers.ts";

const { values } = parseArgs({ options: { sym: { type: "string" }, dir: { type: "string" }, structure: { type: "string" }, legs: { type: "string" }, exp: { type: "string" },
  thesis: { type: "string" }, invalidation: { type: "string" }, save: { type: "boolean" }, out: { type: "string" }, journal: { type: "string", default: "data/journal/paper.json" } } });
const fail = (m: string) => { process.stderr.write(m + "\n"); process.exit(2); };
const sym = values.sym?.toUpperCase() ?? fail("缺少 --sym")!;
const dir = (/^(bear|short|空|看空)/i.test(values.dir ?? "") ? "bear" : /^(bull|long|多|看多)/i.test(values.dir ?? "") ? "bull" : fail("--dir bear|bull")) as "bear" | "bull";
const legs = values.legs ? values.legs.split(",").map((x) => { const m = /^([+-]?)(?:(\d+)x\s*)?(\d+(?:\.\d+)?)([CP])$/i.exec(x.trim()); if (!m) fail(`--legs 格式：+210P,-200P（收到 ${x}）`);
  return { qty: (m![1] === "-" ? -1 : 1) * Number(m![2] || 1), type: (m![4]!.toUpperCase() === "C" ? "call" : "put") as "call" | "put", strike: Number(m![3]) }; }) : undefined;
const now = new Date();
const [bars, raw] = await Promise.all([yahooDaily(sym, 400).catch(() => []), fetchCboeRaw(sym)]);
const quotes: Quote[] = cboeQuotes(raw.json).map((q) => ({ type: q.type, strike: q.strike, expiration: q.expiration, bid: q.bid, ask: q.ask, src: "CBOE 延时" }));
if (existsSync("data/in/rh-option-quotes.json")) { // fresher Robinhood quotes (≤60 min) override CBOE for the same contract
  const f = JSON.parse(readFileSync("data/in/rh-option-quotes.json", "utf8"));
  if (now.getTime() - Date.parse(f.fetchedAt) <= 3600_000) for (const q of f.quotes.filter((x: { underlying: string }) => x.underlying === sym)) {
    const i = quotes.findIndex((x) => x.type === q.type && x.strike === q.strike && x.expiration === q.expiration);
    const v: Quote = { type: q.type, strike: q.strike, expiration: q.expiration, bid: q.bid, ask: q.ask, src: "Robinhood" };
    if (i >= 0) quotes[i] = v; else quotes.push(v);
  }
}
const spot = (raw.json as { data?: { current_price?: number } } | null)?.data?.current_price ?? bars.at(-1)?.c ?? null;
const brief = existsSync("data/out/brief-latest.json") ? JSON.parse(readFileSync("data/out/brief-latest.json", "utf8")) : null;
const calF = `calendar/releases-${now.getFullYear()}.json`;
const calendar = withOpex(existsSync(calF) ? JSON.parse(readFileSync(calF, "utf8")).events ?? [] : [], now.getFullYear());
const earnings = existsSync("data/in/earnings.json") ? parseEarnings(JSON.parse(readFileSync("data/in/earnings.json", "utf8"))) : null;
const j = existsSync(values.journal!) ? JSON.parse(readFileSync(values.journal!, "utf8")) : { capital: defaultCapital(), entries: [] };
const card = buildCard({ now, sym, dir, structure: values.structure, legs, exp: values.exp, spot, bars, levels: bars.length > 30 ? referenceLevels(bars as never) : null, quotes,
  brief, gex: gexFromRaw(sym, raw), calendar, earnings, earningsNext: nextEarnings(loadEarningsBook(), sym, now.toLocaleDateString("en-CA", { timeZone: "America/New_York" })), fed: (await loadFedSpeakers({ now })).data,
  journal: j.entries, capital: j.capital ?? defaultCapital(), thesis: values.thesis, invalidation: values.invalidation });
const md = renderCard(card, spot, values.exp ?? null);
const out = values.out ?? `data/out/card-${sym}.md`;
mkdirSync("data/out", { recursive: true }); writeFileSync(out, md + "\n"); writeFileSync(out.replace(/\.md$/, ".json"), JSON.stringify(card, null, 2) + "\n");
if (values.save) {
  const p = "data/journal/pending-cards.json", pc = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : { cards: [] };
  pc.cards.push({ id: card.id, createdAt: card.createdAt, sym, dir, verdict: card.verdict, trade: card.trade, thesis: values.thesis ?? null });
  mkdirSync("data/journal", { recursive: true }); writeFileSync(p, JSON.stringify(pc, null, 2) + "\n");
}
process.stdout.write(md + `\n\n[card] ${card.verdictText} → ${out}${values.save ? "（已保存待开仓：paper open --card " + card.id + "）" : ""}\n`);
