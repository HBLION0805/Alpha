/** Adapter: rss-parser (MIT) — the only file that imports it. RSS 2.0 / RSS 1.0 (RDF) / Atom → raw entries. Conditional GET stays in ingest/rss.ts. */
import Parser from "rss-parser";

export interface RawEntry { title?: string; link?: string; guid?: string; date?: string; summary?: string }

const parser = new Parser({ customFields: { item: [["dc:date", "dcDate"], ["summary", "atomSummary"], ["content:encoded", "contentEncoded"]] } });

export async function parseXmlFeed(xml: string): Promise<RawEntry[]> {
  const f = await parser.parseString(xml);
  return (f.items ?? []).map((i) => {
    const r = i as unknown as Record<string, unknown>;
    const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : undefined);
    // Atom summary may parse as an object ({_: text}); fall back across fields
    const atomSum = typeof r.atomSummary === "object" && r.atomSummary ? String((r.atomSummary as { _?: unknown })._ ?? "") : s("atomSummary");
    return { title: s("title"), link: s("link"), guid: s("guid") ?? s("id"), date: s("pubDate") ?? s("dcDate") ?? s("isoDate"), summary: s("content") ?? s("contentEncoded") ?? atomSum ?? s("summary") };
  });
}
