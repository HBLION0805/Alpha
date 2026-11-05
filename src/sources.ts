import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Source, Stance } from "./types.ts";

const STANCES: Stance[] = ["left", "center", "right", "cn_official", "us_official"];

export function parseSources(text: string): Source[] {
  const doc = parse(text) as { sources?: unknown[] };
  if (!doc || !Array.isArray(doc.sources)) throw new Error("sources.yaml: missing `sources` list");
  const seen = new Set<string>();
  return doc.sources.map((raw, i) => {
    const s = raw as Record<string, unknown>;
    const id = String(s.id ?? "");
    if (!id || seen.has(id)) throw new Error(`sources.yaml[${i}]: missing or duplicate id`);
    seen.add(id);
    const stance = s.stance as Stance;
    if (!STANCES.includes(stance)) throw new Error(`sources.yaml[${id}]: bad stance ${String(stance)}`);
    const tier = Number(s.tier);
    if (![1, 2, 3].includes(tier)) throw new Error(`sources.yaml[${id}]: bad tier`);
    const src: Source = { id, name: String(s.name ?? id), stance, tier: tier as 1 | 2 | 3, url: String(s.url), enabled: s.enabled === true };
    if (s.kind === "alpaca" || s.kind === "xfile" || s.kind === "truthapi" || s.kind === "truthfile") src.kind = s.kind;
    if (s.note) src.note = String(s.note);
    return src;
  });
}

export function loadSources(path = new URL("../sources.yaml", import.meta.url)): Source[] {
  return parseSources(readFileSync(path, "utf8"));
}
