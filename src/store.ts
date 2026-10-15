import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { FeedItem, Source, StoredItem, Stance } from "./types.ts";
import { normalizeTitle, normalizeUrl } from "./normalize.ts";
import type { FeedState } from "./ingest/rss.ts";

/** Same normalized title from any source within this window counts as a duplicate (syndication). */
export const TITLE_DEDUPE_HOURS = 48;

export class Store {
  readonly db: DatabaseSync;
  constructor(path = "data/alpha-news.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY,
        source_id TEXT NOT NULL, stance TEXT NOT NULL, tier INTEGER NOT NULL,
        title TEXT NOT NULL, title_norm TEXT NOT NULL,
        url TEXT NOT NULL, url_norm TEXT NOT NULL UNIQUE,
        guid TEXT, summary TEXT NOT NULL DEFAULT '',
        published_at TEXT NOT NULL, fetched_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS items_title ON items(title_norm, published_at);
      CREATE INDEX IF NOT EXISTS items_pub ON items(published_at);
      CREATE TABLE IF NOT EXISTS feed_state (
        source_id TEXT PRIMARY KEY, etag TEXT, last_modified TEXT,
        last_status TEXT, last_error TEXT, last_count INTEGER, last_ms INTEGER, checked_at TEXT
      );
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, score INTEGER NOT NULL, headline TEXT NOT NULL, payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS alerted_items (item_id INTEGER NOT NULL, alert_id INTEGER NOT NULL, score INTEGER NOT NULL, PRIMARY KEY (item_id, alert_id));
      CREATE INDEX IF NOT EXISTS alerted_item ON alerted_items(item_id);`);
  }

  feedState(sourceId: string): FeedState {
    const r = this.db.prepare("SELECT etag, last_modified FROM feed_state WHERE source_id = ?").get(sourceId) as { etag: string | null; last_modified: string | null } | undefined;
    return r ? { etag: r.etag, lastModified: r.last_modified } : {};
  }

  saveFeedState(sourceId: string, s: { etag?: string | null; lastModified?: string | null; status: string; error?: string; count: number; ms: number }): void {
    this.db
      .prepare(`INSERT INTO feed_state VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET
        etag=excluded.etag, last_modified=excluded.last_modified, last_status=excluded.last_status,
        last_error=excluded.last_error, last_count=excluded.last_count, last_ms=excluded.last_ms, checked_at=excluded.checked_at`)
      .run(sourceId, s.etag ?? null, s.lastModified ?? null, s.status, s.error ?? null, s.count, s.ms, new Date().toISOString());
  }

  /** Insert with dedupe by normalized URL, then by normalized title within TITLE_DEDUPE_HOURS. Returns inserted count. */
  insert(items: FeedItem[], src: Pick<Source, "stance" | "tier">, now = new Date()): number {
    const byTitle = this.db.prepare("SELECT 1 FROM items WHERE title_norm = ? AND published_at >= ? AND published_at <= ? LIMIT 1");
    const ins = this.db.prepare(`INSERT OR IGNORE INTO items (source_id, stance, tier, title, title_norm, url, url_norm, guid, summary, published_at, fetched_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    let n = 0;
    this.db.exec("BEGIN");
    try {
      for (const it of items) {
        const tn = normalizeTitle(it.title);
        if (!tn) continue;
        const t = Date.parse(it.publishedAt);
        const w = TITLE_DEDUPE_HOURS * 3600_000;
        if (byTitle.get(tn, new Date(t - w).toISOString(), new Date(t + w).toISOString())) continue;
        const r = ins.run(it.sourceId, src.stance, src.tier, it.title, tn, it.url, normalizeUrl(it.url), it.guid ?? null, it.summary, it.publishedAt, now.toISOString());
        n += Number(r.changes);
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return n;
  }

  since(iso: string): StoredItem[] {
    const rows = this.db.prepare("SELECT * FROM items WHERE published_at >= ? ORDER BY published_at").all(iso) as Record<string, unknown>[];
    return rows.map((r) => {
      const s: StoredItem = {
        id: Number(r.id), sourceId: String(r.source_id), stance: r.stance as Stance, tier: Number(r.tier),
        title: String(r.title), url: String(r.url), summary: String(r.summary), publishedAt: String(r.published_at), fetchedAt: String(r.fetched_at),
      };
      if (r.guid) s.guid = String(r.guid);
      return s;
    });
  }

  /** Highest score at which any of these items was already alerted, or null if never. */
  priorAlertScore(itemIds: number[]): number | null {
    if (!itemIds.length) return null;
    const r = this.db.prepare(`SELECT MAX(score) AS s FROM alerted_items WHERE item_id IN (${itemIds.map(() => "?").join(",")})`).get(...itemIds) as { s: number | null };
    return r.s ?? null;
  }

  recordAlert(score: number, headline: string, itemIds: number[], payload: unknown, now = new Date()): number {
    const r = this.db.prepare("INSERT INTO alerts (created_at, score, headline, payload) VALUES (?,?,?,?)").run(now.toISOString(), score, headline, JSON.stringify(payload));
    const id = Number(r.lastInsertRowid);
    const ins = this.db.prepare("INSERT OR IGNORE INTO alerted_items VALUES (?,?,?)");
    for (const i of itemIds) ins.run(i, id, score);
    return id;
  }

  feedReport(): Array<Record<string, unknown>> {
    return this.db.prepare("SELECT * FROM feed_state ORDER BY source_id").all() as Array<Record<string, unknown>>;
  }

  close(): void {
    this.db.close();
  }
}
