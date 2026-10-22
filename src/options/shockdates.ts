/** Shock days for readiness: VIX > VIX3M (macro store) + high-impact release days (calendar/releases-YYYY.json). */
import { existsSync, readFileSync } from "node:fs";
import { Store } from "../store.ts";
import { initMacro, loadObs } from "../macro/store.ts";
export function loadShockDates(years: Iterable<string>): string[] {
  const shock = new Set<string>();
  try {
    const st = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite"); initMacro(st.db);
    const v3 = new Map(loadObs(st.db, "VIX3M").map((o) => [o.t.slice(0, 10), o.v]));
    for (const o of loadObs(st.db, "VIX")) { const m = v3.get(o.t.slice(0, 10)); if (m != null && o.v > m) shock.add(o.t.slice(0, 10)); }
  } catch { /* no store → calendar only */ }
  for (const y of new Set(years)) {
    const f = new URL(`../../calendar/releases-${y}.json`, import.meta.url);
    if (existsSync(f)) for (const e of JSON.parse(readFileSync(f, "utf8")).events ?? []) shock.add(String(e.date).slice(0, 10));
  }
  return [...shock];
}
