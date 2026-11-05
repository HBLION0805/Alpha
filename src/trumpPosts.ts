/**
 * One deduped list of Trump posts across X and Truth Social. A cross-post is the same text (normalized; links,
 * punctuation and case ignored; token Jaccard ≥ 0.8 or one contains the other) within 6 hours → one post, both
 * platforms and both URLs kept. Used by poll's merged view (data/in/trump-posts.json), alerts (trump.ts) and the brief.
 */
export const SAME_POST_HOURS = 6;
export const SAME_POST_JACCARD = 0.8;
export const normPost = (t: string) => t.replace(/<[^>]+>/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/^RT:?\s*/i, "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
const tokens = (t: string) => new Set(normPost(t).split(" ").filter((w) => w.length > 1));
/** trumpstruth.org title for a post with no text, e.g. "Video post from October 18, 2026" (normalized) */
export const MEDIA_PLACEHOLDER = /^(image|video|quote|media) post from /;
export function similarText(a: string, b: string): boolean {
  const na = normPost(a), nb = normPost(b);
  if (!na || !nb) return false;
  if (MEDIA_PLACEHOLDER.test(na) || MEDIA_PLACEHOLDER.test(nb)) return false; // mirror titles for text-less media/quote posts — not evidence of the same post
  if (na === nb) return true;
  if (na.length >= 40 && nb.length >= 40 && (na.includes(nb.slice(0, 120)) || nb.includes(na.slice(0, 120)))) return true;
  const A = tokens(a), B = tokens(b); if (A.size < 4 || B.size < 4) return false;
  let i = 0; for (const w of A) if (B.has(w)) i++;
  return i / (A.size + B.size - i) >= SAME_POST_JACCARD;
}
export const samePost = (a: { text: string; at: string }, b: { text: string; at: string }) => Math.abs(Date.parse(a.at) - Date.parse(b.at)) <= SAME_POST_HOURS * 3600_000 && similarText(a.text, b.text);

export type Platform = "X" | "Truth Social";
export interface MergedPost { text: string; created_at: string; platforms: Platform[]; urls: Partial<Record<Platform, string>>; repost: boolean; ids: Partial<Record<Platform, string>> }
/** group anything with {text, at} by samePost (earliest first) */
export function groupPosts<T>(xs: T[], key: (x: T) => { text: string; at: string }): T[][] {
  const groups: T[][] = [];
  for (const x of [...xs].sort((a, b) => key(a).at.localeCompare(key(b).at))) {
    const g = groups.find((gr) => gr.some((y) => samePost(key(x), key(y))));
    if (g) g.push(x); else groups.push([x]);
  }
  return groups;
}
export function mergeTrumpPosts(posts: Array<{ id: string; text: string; created_at: string; url: string; source: "x" | "truth"; repost?: boolean }>): MergedPost[] {
  const P = (s: "x" | "truth"): Platform => (s === "x" ? "X" : "Truth Social");
  return groupPosts(posts, (p) => ({ text: p.text, at: p.created_at })).map((g) => {
    const m: MergedPost = { text: g[0]!.text, created_at: g[0]!.created_at, platforms: [], urls: {}, ids: {}, repost: g.every((p) => !!p.repost) };
    for (const p of g) { const k = P(p.source); if (!m.platforms.includes(k)) m.platforms.push(k); m.urls[k] ??= p.url; m.ids[k] ??= p.id; if (p.text.length > m.text.length) m.text = p.text; }
    return m;
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
