/**
 * Daily trade plan (brief §2.1, src/macro/tradeplan.ts) persisted to <journal>/plans/YYYY-MM-DD.json (ET date).
 * `plan` is the latest run's list (what `paper open` links formal trades to, same as brief-latest.json); `history`
 * gains a row only when the verdict or the plan ids change, so earlier intraday versions are not lost.
 */
import { existsSync, readFileSync } from "node:fs";
import { journalPath, planRel, writeAtomic } from "./paths.ts";
import type { PlanItem } from "../options/planlink.ts";

export interface PlanDay { date: string; generatedAt: string; verdict: string | null; plan: PlanItem[]; history: Array<{ generatedAt: string; verdict: string | null; ids: string[] }> }
/** plan rows as brief.ts writes them (tradeplan candidates + the §2.0 gate card), each with its plan id */
export interface PlanSnapshot { date: string; generatedAt: string; verdict: string | null; plan: Array<{ id: string }> }
const read = (p: string): PlanDay | null => { try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) as PlanDay : null; } catch { return null; } };

export function mergePlanDay(prev: PlanDay | null, s: PlanSnapshot): PlanDay {
  const history = [...(prev?.history ?? [])], ids = s.plan.map((p) => p.id), last = history.at(-1);
  if (!last || last.verdict !== s.verdict || last.ids.join(",") !== ids.join(",")) history.push({ generatedAt: s.generatedAt, verdict: s.verdict, ids });
  return { date: s.date, generatedAt: s.generatedAt, verdict: s.verdict, plan: s.plan as PlanItem[], history };
}
export function savePlanDay(s: PlanSnapshot): string {
  const p = journalPath(planRel(s.date));
  writeAtomic(p, JSON.stringify(mergePlanDay(read(p), s), null, 2) + "\n");
  return p;
}
export const loadPlanDay = (dateEt: string): PlanDay | null => read(journalPath(planRel(dateEt)));
