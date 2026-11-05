/**
 * 入场前计划卡: npm run card -- --sym NVDA --dir bear [--structure put_spread] [--legs "+210P,-200P"] --exp 2026-10-23
 *   [--thesis "因为…所以…"] [--invalidation "收盘站上 225"] [--save] [--out data/out/card-<sym>.md (latest copy; kept: <journal>/cards/<id>.md/.json)]
 *   confidence: [--confidence low|medium|high|highest] [--tech-entry] → per-trade cap 0.5–2% of live paper equity (high/highest need macro + scenario plan + technical entry aligned)
 *   stock long: --structure long_stock [--shares 100] → protection / covered-call reminder in a sideways or junk phase (info only)
 *   bearish (做空清单, src/options/shortside.ts): [--sector SMH] [--squeeze-check "SI 3% · float 4B · gamma + · 无梗股热度"] [--horizon 10]
 * --save appends to <journal>/pending-cards.json (journal = ALPHA_JOURNAL_DIR, default data/journal; src/storage/paths.ts); later: npm run paper -- open ... --card <id>.
 * Read-only data: Yahoo daily bars, CBOE delayed quotes (+ data/in/rh-option-quotes.json when fresh), brief-latest.json,
 * official calendar + OpEx, data/in/earnings.json, the paper journal. Nothing here can place an order.
 */
import { loadLevels } from "../macro/mentorLevels.ts";
import { loadPhases, marketPhase } from "../macro/marketPhase.ts";
import { STOCK_LONG_RE } from "../review/mentor.ts";
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { buildCard, renderCard, type Quote } from "../review/card.ts";
import { cardOrderBlock, renderOrderBlock, reservedRiskUsd } from "../review/orderBlock.ts";
import { fetchCboeRaw, gexFromRaw, cboeQuotes } from "../options/gex.ts";
import { yahooDaily } from "../adapters/yahoo.ts";
import { referenceLevels } from "../levels.ts";
import { withOpex } from "../macro/opex.ts";
import { parseEarnings } from "../options/events.ts";
import { defaultCapital } from "../config.ts";
import { loadEarningsBook, nextEarnings } from "../options/earningsStore.ts";
import { loadFedSpeakers } from "../ingest/fedSpeakers.ts";
import { SECTOR_OF, BROAD_ETFS } from "../options/shortside.ts";
import { cardRel, journalPath, outPath, writeAtomic } from "../storage/paths.ts";
import { dirname } from "node:path";

const { values } = parseArgs({ options: { sym: { type: "string" }, dir: { type: "string" }, structure: { type: "string" }, legs: { type: "string" }, exp: { type: "string" },
  thesis: { type: "string" }, invalidation: { type: "string" }, sector: { type: "string" }, "squeeze-check": { type: "string" }, horizon: { type: "string" }, confidence: { type: "string" }, "tech-entry": { type: "boolean" }, shares: { type: "string" }, save: { type: "boolean" }, out: { type: "string" }, journal: { type: "string", default: journalPath("paper.json") } } });
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
// bearish: benchmarks for 做空清单 relative weakness (SPY + sector ETF); fetch failures are reported as missing by shortside.ts
const sectorSym = dir === "bear" && !BROAD_ETFS.has(sym) ? (values.sector?.toUpperCase() ?? SECTOR_OF[sym] ?? null) : null;
const [spyBars, sectorBars] = dir === "bear" ? await Promise.all([sym === "SPY" ? Promise.resolve([]) : yahooDaily("SPY", 400).catch(() => []), sectorSym ? yahooDaily(sectorSym, 400).catch(() => []) : Promise.resolve([])]) : [[], []];
// stock long: ^NDX bars for the sideways check (src/macro/marketPhase.ts); failure → only the mentor-declared phase is used
const stockLong = dir === "bull" && STOCK_LONG_RE.test(values.structure ?? "");
const ndxBars = stockLong ? await yahooDaily("^NDX", 300).catch(() => []) : [];
const spot = (raw.json as { data?: { current_price?: number } } | null)?.data?.current_price ?? bars.at(-1)?.c ?? null;
const briefF = outPath("brief-latest.json"), brief = existsSync(briefF) ? JSON.parse(readFileSync(briefF, "utf8")) : null;
const calF = `calendar/releases-${now.getFullYear()}.json`;
const calendar = withOpex(existsSync(calF) ? JSON.parse(readFileSync(calF, "utf8")).events ?? [] : [], now.getFullYear());
const earnings = existsSync("data/in/earnings.json") ? parseEarnings(JSON.parse(readFileSync("data/in/earnings.json", "utf8"))) : null;
const j = existsSync(values.journal!) ? JSON.parse(readFileSync(values.journal!, "utf8")) : { capital: defaultCapital(), entries: [] };
const pcF = journalPath("pending-cards.json"), pending = existsSync(pcF) ? JSON.parse(readFileSync(pcF, "utf8")).cards ?? [] : [];
// re-saving: today's unopened pending card for the same sym+dir is superseded (its risk is not counted twice and the entry is replaced)
const prior = pending.find((c: { sym?: string; dir?: string; createdAt: string; id: string }) => c.sym === sym && c.dir === dir && new Date(c.createdAt).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }) && !(j.entries ?? []).some((e: { cardId?: string }) => e.cardId === c.id));
const reserved = reservedRiskUsd(pending, j.entries ?? [], now, prior?.id);
const card = buildCard({ now, reservedUsd: reserved.usd, sym, dir, structure: values.structure, legs, exp: values.exp, spot, bars, levels: bars.length > 30 ? referenceLevels(bars as never) : null, quotes,
  brief, gex: gexFromRaw(sym, raw), calendar, earnings, earningsNext: nextEarnings(loadEarningsBook(), sym, now.toLocaleDateString("en-CA", { timeZone: "America/New_York" })), fed: (await loadFedSpeakers({ now })).data,
  journal: j.entries, capital: j.capital ?? defaultCapital(), thesis: values.thesis, invalidation: values.invalidation,
  shares: values.shares ? Number(values.shares) : null,
  confidence: { tier: values.confidence as never, technical: values["tech-entry"] ?? false }, mentorAll: loadLevels().entries, optionQuotes: existsSync("data/in/rh-option-quotes.json") ? JSON.parse(readFileSync("data/in/rh-option-quotes.json", "utf8")).quotes ?? [] : [],
  marketPhase: stockLong ? marketPhase(now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), ndxBars as Array<{ t: string; c: number }>, loadPhases().entries) : null,
  mentorLevels: loadLevels().entries.find((e) => e.date === now.toLocaleDateString("en-CA", { timeZone: "America/New_York" })) ?? null,
  ...(dir === "bear" ? { short: { spyBars, sectorSym, sectorBars, squeezeCheck: values["squeeze-check"] ?? null, horizonDays: values.horizon ? Number(values.horizon) : null } } : {}) });
const ob = cardOrderBlock(card);
const md = [renderCard(card, spot, values.exp ?? null), "", ...(card.verdict !== "no" ? renderOrderBlock(ob) : [])].join("\n");
const cardJson = JSON.stringify({ ...card, orderBlock: "reason" in ob ? null : ob }, null, 2) + "\n";
// persistent copy per card id (<journal>/cards/), plus the regenerable "latest" copy in data/out for back-compat
const kept = journalPath(cardRel(card.id, "md"));
writeAtomic(kept, md + "\n"); writeAtomic(journalPath(cardRel(card.id, "json")), cardJson);
const out = values.out ?? outPath(`card-${sym}.md`);
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, md + "\n"); writeFileSync(out.replace(/\.md$/, ".json"), cardJson);
if (values.save) {
  // saving reserves the card's max loss against today's new-risk cap until it is opened (paper open --card) or the day ends
  const p = pcF, pc = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : { cards: [] };
  if (prior) pc.cards = pc.cards.filter((c: { id: string }) => c.id !== prior.id);
  pc.cards.push({ id: card.id, createdAt: card.createdAt, sym, dir, verdict: card.verdict, trade: card.trade, thesis: values.thesis ?? null, invalidation: values.invalidation ?? null, warnTags: card.warnTags ?? [], confidence: card.confidence ?? null, scenarioPlan: card.scenarioPlan ?? null, orderBlock: "reason" in ob ? null : ob, reservedUsd: card.verdict !== "no" ? card.trade.maxLoss ?? 0 : 0,
    ...(dir === "bear" ? { squeezeCheck: values["squeeze-check"] ?? null, shortTags: card.shortTags ?? [] } : {}) });
  writeAtomic(p, JSON.stringify(pc, null, 2) + "\n");
}
process.stdout.write(md + `\n\n[card] ${card.verdictText} → ${kept}（最新副本 ${out}）${values.save ? "（已保存待开仓：paper open --card " + card.id + "）" : ""}\n`);
