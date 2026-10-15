/**
 * Per-trade post-mortem at close/expiry, wins included (user-approved plan P1 #6–7), and mentor-shadow review against the mentor's actual result.
 * Classification:
 *  - judgment: the thesis or selection was wrong
 *  - execution: sizing, strikes, entry, exit or rules
 *  - luck: won, but the plan wasn't followed or the thesis wasn't why
 *  - good: the plan was followed, whatever the outcome
 */
import type { JournalEntry } from "./journal.ts";
export type PMClass = "judgment" | "execution" | "luck" | "good";
export interface PostMortem { at: string; outcome: "win" | "loss" | "flat"; classification: PMClass; tags: string[]; lesson: string; followed: { stop: boolean | null; takeProfit: boolean | null; size: boolean | null } }
export interface MentorOutcome { at: string; result: "win" | "loss" | "flat" | "unknown"; pnlPct?: number | null; note?: string }
const CLS = ["judgment", "execution", "luck", "good"];
export function needsPostMortem(e: JournalEntry): boolean { return !!e.closedAt && !e.postMortem; }
export function writePostMortem(e: JournalEntry, a: { classification?: string; tags?: string[]; lesson?: string; followed?: PostMortem["followed"]; now: Date }): { entry: JournalEntry | null; refused: string[] } {
  const refused: string[] = [];
  if (!e.closedAt) refused.push(`${e.id} 还没平仓/到期，复盘在平仓后写`);
  if (!a.classification || !CLS.includes(a.classification)) refused.push(`缺少 --class（${CLS.join(" | ")}）`);
  if (!a.lesson?.trim()) refused.push("缺少 --lesson（一句话教训）");
  const pnl = e.pnl ?? 0, outcome = pnl > 0 ? "win" : pnl < 0 ? "loss" : "flat";
  if (outcome === "loss" && (a.classification === "luck")) refused.push("亏损不能归为 luck：判断 / 执行 / good（按计划执行的正常亏损）");
  if (outcome === "loss" && a.classification !== "good" && !a.tags?.length) refused.push("亏损必须有 --tags（用于识别重复错误）");
  if (refused.length) return { entry: null, refused };
  const pm: PostMortem = { at: a.now.toISOString(), outcome, classification: a.classification as PMClass, tags: a.tags ?? [], lesson: a.lesson!, followed: a.followed ?? { stop: null, takeProfit: null, size: null } };
  const lr = outcome === "loss" && (a.classification === "judgment" || a.classification === "execution") ? { lossReview: { at: pm.at, errorClass: a.classification as "judgment" | "execution", errorTags: pm.tags, note: pm.lesson } } : {};
  return { entry: { ...e, postMortem: pm, lesson: e.lesson ?? pm.lesson, ...lr }, refused };
}
/** mentor shadow: our risk-limited copy vs the mentor's actual trade */
export function mentorCompare(e: JournalEntry): string[] {
  if (e.source !== "mentor_shadow") return [];
  const m = e.mentorOutcome, ours = e.closedAt ? e.pnl ?? null : e.marks?.at(-1)?.pnl ?? null;
  const basis = (e.entryPrice ?? 0) * 100, ourPct = ours != null && basis > 0 ? Math.round((ours / basis) * 100) : null;
  const L = [`- 我们：${ours == null ? "未知" : `$${ours}${ourPct != null ? `（${ourPct}%）` : ""}`}${e.closedAt ? `，${e.exitKind}` : "，未平仓"}`];
  if (!m) return [...L, "- 大佬实际：未记录（paper mentor --id … --result win|loss|flat [--pnl-pct N]）"];
  L.push(`- 大佬实际：${m.result}${m.pnlPct != null ? `（${m.pnlPct}%）` : ""}${m.note ? ` · ${m.note}` : ""}`);
  const same = ours == null || m.result === "unknown" ? null : (ours > 0) === (m.result === "win");
  L.push(`- 方向一致：${same == null ? "未知" : same ? "是" : "否"}${e.exitKind === "weekend_rule" ? "；我们因周末规则提前离场" : ""}${(e.violations ?? []).some((v) => /cap/.test(v)) ? "；按 Alpha 风控本单超限（只能缩小仓位或不做）" : ""}`);
  return L;
}
/** repeated mistakes → critique WARN for the next trade */
export function pastMistakes(history: JournalEntry[], symbol: string, lastN = 30): { tags: Array<[string, number]>; sameSymbol: string[] } {
  const closed = history.filter((e) => e.closedAt).sort((a, b) => b.closedAt!.localeCompare(a.closedAt!)).slice(0, lastN);
  const n = new Map<string, number>();
  for (const e of closed) for (const t of new Set([...(e.lossReview?.errorTags ?? []), ...(e.postMortem && /judgment|execution/.test(e.postMortem.classification) ? e.postMortem.tags : [])])) n.set(t, (n.get(t) ?? 0) + 1);
  const sameSymbol = closed.filter((e) => e.symbol === symbol && (e.postMortem?.lesson || e.lesson)).map((e) => `${e.id}：${e.postMortem?.lesson ?? e.lesson}`).slice(0, 3);
  return { tags: [...n].filter(([, k]) => k >= 1).sort((a, b) => b[1] - a[1]).slice(0, 5), sameSymbol };
}
