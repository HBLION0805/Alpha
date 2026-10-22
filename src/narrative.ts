import type { Cluster, Stance } from "./types.ts";
import { tokens } from "./normalize.ts";

export const STANCE_LABEL: Record<Stance, string> = {
  left: "Left-leaning",
  center: "Center / business",
  right: "Right-leaning",
  cn_official: "Chinese official",
  us_official: "US official",
};

export interface StanceView {
  stance: Stance;
  headlines: Array<{ sourceId: string; title: string; url: string }>;
  /** words this stance uses that no other stance in the cluster uses */
  distinctive: string[];
}

export interface Narrative {
  views: StanceView[];
  missing: Stance[];
  /** true if at least two different stances cover the story */
  crossStance: boolean;
}

const ALL: Stance[] = ["left", "center", "right", "cn_official", "us_official"];

export function compareNarratives(c: Cluster): Narrative {
  const by = new Map<Stance, Cluster["items"]>();
  for (const it of c.items) by.set(it.stance, [...(by.get(it.stance) ?? []), it]);
  const tokBy = new Map<Stance, Set<string>>();
  for (const [s, items] of by) tokBy.set(s, new Set(items.flatMap((i) => [...tokens(i.title)])));
  const views: StanceView[] = [];
  for (const [stance, items] of by) {
    const mine = tokBy.get(stance)!;
    const others = new Set([...tokBy].filter(([s]) => s !== stance).flatMap(([, t]) => [...t]));
    const distinctive = others.size ? [...mine].filter((t) => !others.has(t) && t.length > 3).slice(0, 6) : [];
    views.push({ stance, headlines: items.map((i) => ({ sourceId: i.sourceId, title: i.title, url: i.url })), distinctive });
  }
  views.sort((a, b) => ALL.indexOf(a.stance) - ALL.indexOf(b.stance));
  return { views, missing: ALL.filter((s) => !by.has(s)), crossStance: by.size >= 2 };
}
