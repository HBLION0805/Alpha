/**
 * 【大佬情景对照】 deterministic classifier of the mentor's market-scenario matrix
 * (knowledge/mentor/macro/market-scenario-matrix.md, source mentor-scenario-matrix).
 * Dimensions: rates (10Y 5d + 20d), oil (WTI 5d + 20d), tech earnings (PROXY: SMH vs QQQ 20d relative trend; no earnings
 * revisions feed), jobs (FRED initial claims ICSA + payrolls PAYEMS; UNKNOWN if missing). Unknown dimensions never count.
 */
import type { Obs } from "./fetch.ts";

type Dir = "up" | "down" | "flat" | "unknown";
type Jobs = "good" | "bad" | "very_bad" | "unknown";
export interface Stage { id: string; name: string; rates: "up" | "down"; oil: "up" | "down"; tech: "up" | "down"; jobs: "good" | "bad" | "very_bad" }
export const MATRIX: Stage[] = [
  { id: "bull", name: "牛市", rates: "down", oil: "down", tech: "up", jobs: "good" },
  { id: "rotation", name: "轮动", rates: "down", oil: "down", tech: "down", jobs: "good" },
  { id: "bear1", name: "熊市·第一阶段", rates: "up", oil: "up", tech: "up", jobs: "good" },
  { id: "bear2", name: "熊市·第二阶段", rates: "down", oil: "up", tech: "up", jobs: "bad" },
  { id: "bear3", name: "熊市·第三阶段", rates: "down", oil: "down", tech: "down", jobs: "very_bad" },
];
/** mentor stage → closest existing scenario ids (scenarios.ts), for the disagreement flag */
export const STAGE_TO_SCENARIO: Record<string, string[]> = { bull: ["melt_up", "base"], rotation: ["base"], bear1: ["hawkish"], bear2: ["risk_off"], bear3: ["risk_off"] };

const chg = (o: Obs[] | undefined, k: number, bp = false) => (!o || o.length <= k ? null : bp ? (o.at(-1)!.v - o[o.length - 1 - k]!.v) * 100 : ((o.at(-1)!.v - o[o.length - 1 - k]!.v) / o[o.length - 1 - k]!.v) * 100);
/** direction when 5d and 20d agree beyond a threshold; disagreement → flat */
function trend(o: Obs[] | undefined, bp: boolean, t5: number, t20: number): { dir: Dir; detail: string } {
  const a = chg(o, 5, bp), b = chg(o, 20, bp), u = bp ? "bp" : "%";
  if (a == null || b == null) return { dir: "unknown", detail: "无数据" };
  const d = `5日 ${a > 0 ? "+" : ""}${a.toFixed(1)}${u} / 20日 ${b > 0 ? "+" : ""}${b.toFixed(1)}${u}`;
  if (b > t20 && a > -t5) return { dir: "up", detail: d };
  if (b < -t20 && a < t5) return { dir: "down", detail: d };
  return { dir: "flat", detail: d };
}
export function jobsState(icsa?: Obs[], payems?: Obs[]): { state: Jobs; detail: string } {
  const avg = (o: Obs[], n: number, off = 0) => o.slice(o.length - n - off, o.length - off).reduce((s, x) => s + x.v, 0) / n;
  const parts: string[] = []; let score = 0, n = 0;
  if (icsa && icsa.length >= 13) { const r = (avg(icsa, 4) / avg(icsa, 13) - 1) * 100; parts.push(`初请 4周均值 vs 13周 ${r > 0 ? "+" : ""}${r.toFixed(1)}%`); n++; score += r > 25 ? 2 : r > 10 ? 1 : 0; }
  if (payems && payems.length >= 4) { const m = (payems.at(-1)!.v - payems[payems.length - 4]!.v) / 3; parts.push(`非农 3个月均增 ${m.toFixed(0)}k`); n++; score += m < 0 ? 2 : m < 50 ? 1 : 0; }
  if (!n) return { state: "unknown", detail: "无就业数据（UNKNOWN）" };
  const s = score / n;
  return { state: s >= 1.5 ? "very_bad" : s >= 0.5 ? "bad" : "good", detail: parts.join("，") };
}

export interface MatrixResult { best: Stage[]; matches: number; known: number; dims: Array<{ dim: string; value: string; detail: string }>; perStage: Array<{ stage: Stage; match: string[]; mismatch: string[] }>; unknown: string[] }
const LBL: Record<string, string> = { up: "↑", down: "↓", flat: "→", unknown: "?", good: "好", bad: "差", very_bad: "很差" };

/** `adjusted`: series ids whose older history is back-adjusted continuous (futContract.ts) → their multi-day details are labelled 回溯调整 */
export function classifyMatrix(d: Record<string, Obs[]>, adjusted: ReadonlySet<string> = new Set()): MatrixResult {
  const rates = trend(d.UST10Y, true, 5, 10), oil = trend(d.WTI ?? d.USO, false, 2, 4);
  const rel: Obs[] = (() => { const s = d.SMH, q = d.QQQ ?? d.NDX; if (!s || !q) return []; const m = new Map(q.map((o) => [o.t.slice(0, 10), o.v])); return s.filter((o) => m.has(o.t.slice(0, 10))).map((o) => ({ t: o.t, v: o.v / m.get(o.t.slice(0, 10))! })); })();
  const tech = trend(rel.length ? rel : undefined, false, 1, 2);
  const jobs = jobsState(d.ICSA, d.PAYEMS);
  const dims = [
    { dim: "利率", value: rates.dir, detail: `10Y ${rates.detail}` }, { dim: "油价", value: oil.dir, detail: `WTI ${oil.detail}${adjusted.has("WTI") && oil.dir !== "unknown" ? "（回溯调整连续合约）" : ""}` },
    { dim: "科技盈利", value: tech.dir, detail: `代理指标：SMH/QQQ 相对强弱 ${tech.detail}（非盈利修正数据）` }, { dim: "就业", value: jobs.state, detail: jobs.detail },
  ];
  const unknown = dims.filter((x) => x.value === "unknown").map((x) => x.dim);
  const perStage = MATRIX.map((s) => {
    const want: Record<string, string> = { 利率: s.rates, 油价: s.oil, 科技盈利: s.tech, 就业: s.jobs };
    const match: string[] = [], mismatch: string[] = [];
    for (const x of dims) { if (x.value === "unknown") continue; (x.value === want[x.dim] ? match : mismatch).push(x.dim); }
    return { stage: s, match, mismatch };
  });
  const matches = Math.max(...perStage.map((p) => p.match.length));
  return { best: perStage.filter((p) => p.match.length === matches).map((p) => p.stage), matches, known: 4 - unknown.length, dims, perStage, unknown };
}

export function renderMatrix(r: MatrixResult, leader: string | null): string[] {
  const best = r.perStage.filter((p) => r.best.includes(p.stage));
  const agree = leader != null && r.best.some((s) => STAGE_TO_SCENARIO[s.id]?.includes(leader));
  return [
    `- **【大佬情景对照】** 最接近：**${r.best.map((s) => s.name).join(" / ")}**（匹配 ${r.matches}/4${r.unknown.length ? `，未知：${r.unknown.join("、")}` : ""}）`,
    `  - 当前：${r.dims.map((x) => `${x.dim} ${LBL[x.value]}`).join(" · ")}`,
    ...best.map((p) => `  - ${p.stage.name}：吻合 ${p.match.join("、") || "—"}；不吻合 ${p.mismatch.join("、") || "—"}`),
    `  - 依据：${r.dims.map((x) => `${x.dim}（${x.detail}）`).join("；")}`,
    ...(r.matches < 3 ? ["  - 匹配不足 3/4：没有清晰对应的阶段，不据此下结论"] : []),
    ...(leader && !agree ? [`  - ⚠️ 与领先情景（${leader}）不一致：两套框架分歧 → 方向不清，降低信心`] : []),
    "  - _来源：knowledge/mentor/macro/market-scenario-matrix.md（大佬）。科技盈利为代理指标。_",
  ];
}
