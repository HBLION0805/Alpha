/**
 * npm run trump — Trump posts from BOTH platforms, read-only, no login. Called by scripts/run.sh before poll.
 *   Truth Social: official public API → trumpstruth.org mirror → data/in/truth-trump.json (only overwritten on success)
 *   X: data/in/x-trump.json (written by the routine from the x connector; this script never calls X)
 *   Merged, deduped (cross-posts → one post, both URLs): data/in/trump-posts.json
 * A Truth failure prints ONE warning line and exits 0 (the run continues with X only).
 */
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, statSync } from "node:fs";
import { fetchTruth, TRUTH_FILE, type TrumpPost, type TruthFile, type Fetcher } from "../ingest/truthTrump.ts";
import { mergeTrumpPosts } from "../trumpPosts.ts";
import { parseInput, XPostsFileSchema } from "../adapters/schemas.ts";
import { unwrapJson } from "../options/robinhood.ts";

export const X_FILE = "data/in/x-trump.json", MERGED_FILE = "data/in/trump-posts.json";
const write = (p: string, body: unknown) => { mkdirSync(p.replace(/\/[^/]+$/, ""), { recursive: true }); writeFileSync(p + ".tmp", JSON.stringify(body, null, 1) + "\n"); renameSync(p + ".tmp", p); };
const ageMin = (p: string) => Math.round((Date.now() - statSync(p).mtimeMs) / 60000);

export function readXPosts(path = X_FILE): { posts: TrumpPost[]; status: string } {
  if (!existsSync(path)) return { posts: [], status: "x-trump.json 不存在" };
  try {
    const f = parseInput(XPostsFileSchema, unwrapJson(readFileSync(path, "utf8")), "x-trump.json");
    return { posts: f.data.map((p) => ({ id: p.id, text: p.text, created_at: new Date(p.created_at).toISOString(), url: p.url ?? `https://x.com/realDonaldTrump/status/${p.id}`, source: "x" as const, repost: /^RT @/.test(p.text) })), status: `${f.data.length} 条，文件 ${ageMin(path)} 分钟前` };
  } catch (e) { return { posts: [], status: `x-trump.json 读取失败：${(e as Error).message.split("\n")[0]}` }; }
}

export async function runTrumpFetch(o: { fetcher?: Fetcher; truthPath?: string; xPath?: string; mergedPath?: string; now?: Date } = {}): Promise<{ truth: TruthFile; warning: string | null; merged: number; line: string }> {
  const truthPath = o.truthPath ?? TRUTH_FILE, mergedPath = o.mergedPath ?? MERGED_FILE;
  const truth = await fetchTruth({ fetcher: o.fetcher, now: o.now });
  let warning: string | null = null, truthPosts = truth.data;
  if (truth.via === "none") {
    const old = existsSync(truthPath) ? (JSON.parse(readFileSync(truthPath, "utf8")) as TruthFile).data ?? [] : [];
    truthPosts = old;
    warning = `[trump] ⚠️ Truth Social 抓取失败（${truth.errors.join("；")}）→ 本轮只用 X${old.length ? `（沿用旧 truth-trump.json ${old.length} 条）` : ""}`;
  } else write(truthPath, truth);
  const x = readXPosts(o.xPath ?? X_FILE);
  const merged = mergeTrumpPosts([...x.posts, ...truthPosts]);
  write(mergedPath, { generatedAt: (o.now ?? new Date()).toISOString(), sources: { truth: { via: truth.via, count: truth.data.length, errors: truth.errors }, x: { status: x.status, count: x.posts.length } }, data: merged });
  const cross = merged.filter((m) => m.platforms.length > 1).length;
  return { truth, warning, merged: merged.length, line: `[trump] Truth Social ${truth.via === "none" ? "失败" : `${truth.data.length} 条（${truth.via === "official" ? "官方 API" : "trumpstruth.org 镜像"}${truth.errors.length ? `；${truth.errors.join("；")}` : ""}）`} · X ${x.status} · 合并去重 ${merged.length} 条（跨平台同帖 ${cross}）→ ${mergedPath}` };
}

if (import.meta.main) {
  try { const r = await runTrumpFetch(); if (r.warning) console.error(r.warning); console.log(r.line); }
  catch (e) { console.error(`[trump] ⚠️ 抓取步骤出错（${(e as Error).message.split("\n")[0]}）→ 本轮只用 X`); }
}
