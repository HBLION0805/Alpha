import type { DatabaseSync } from "node:sqlite";
import type { Obs } from "./fetch.ts";

export function initMacro(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS macro_obs (series TEXT NOT NULL, t TEXT NOT NULL, v REAL NOT NULL, fetched_at TEXT NOT NULL, PRIMARY KEY (series, t));
    CREATE TABLE IF NOT EXISTS macro_intraday (series TEXT NOT NULL, t TEXT NOT NULL, v REAL NOT NULL, PRIMARY KEY (series, t));
    CREATE TABLE IF NOT EXISTS macro_fetch (series TEXT PRIMARY KEY, ok INTEGER, error TEXT, last_t TEXT, n INTEGER, at TEXT);`);
}

export function saveObs(db: DatabaseSync, series: string, obs: Obs[], intraday = false): void {
  const st = intraday
    ? db.prepare("INSERT OR REPLACE INTO macro_intraday VALUES (?,?,?)")
    : db.prepare("INSERT OR REPLACE INTO macro_obs VALUES (?,?,?,?)");
  const now = new Date().toISOString();
  db.exec("BEGIN");
  for (const o of obs) intraday ? st.run(series, o.t, o.v) : st.run(series, o.t, o.v, now);
  db.exec("COMMIT");
}

export function loadObs(db: DatabaseSync, series: string, intraday = false): Obs[] {
  return (db.prepare(`SELECT t, v FROM ${intraday ? "macro_intraday" : "macro_obs"} WHERE series = ? ORDER BY t`).all(series) as Array<{ t: string; v: number }>).map((r) => ({ t: r.t, v: r.v }));
}

export function recordFetch(db: DatabaseSync, series: string, ok: boolean, error: string | null, lastT: string | null, n: number): void {
  db.prepare("INSERT OR REPLACE INTO macro_fetch VALUES (?,?,?,?,?,?)").run(series, ok ? 1 : 0, error, lastT, n, new Date().toISOString());
}

export function fetchReport(db: DatabaseSync): Array<{ series: string; ok: number; error: string | null; last_t: string | null; n: number }> {
  return db.prepare("SELECT series, ok, error, last_t, n FROM macro_fetch ORDER BY series").all() as never;
}
