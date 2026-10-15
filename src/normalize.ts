import { stemWord } from "./adapters/nlp.ts";
const TRACKING = /^(utm_|fbclid|gclid|mc_|cmpid|ref$|src$|taid$|yptr$|mod$|siteid$|__source)/i;

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.protocol = "https:";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+[-|–—]\s+[^-|–—]{2,40}$/u, "") // trailing " - Outlet"
    .replace(/(\d)[.,](\d)/g, "$1_$2") // keep 3.7% / 0.6 as one token
    .replace(/[^\p{L}\p{N}%$_ ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "a an the and or but of to in on at for from by with as is are was were be been it its this that these those after before over under into about than more new says said say will would could may can amid as up down out not no vs via how why what who when where us u s live latest news update updates video watch here".split(" "),
);

/** Irregular verbs the Porter stemmer cannot join (rose/rise, fell/fall). */
const IRREGULAR: Record<string, string> = { rose: "rise", risen: "rise", rising: "rise", fell: "fall", fallen: "fall", falling: "fall", jumped: "jump", slid: "slide", sank: "sink", hiked: "hike", cut: "cut", cuts: "cut", soared: "soar", surged: "surge", tumbled: "tumble", plunged: "plunge" };

/** Porter stem (adapters/nlp.ts → natural) after the irregular map; tokens with digits/%/$/_ are kept as-is. */
export function stem(w: string): string {
  const irr = IRREGULAR[w];
  if (irr) return stemWord(irr);
  return /[\d%$_]/.test(w) ? w : stemWord(w);
}

const ALIASES: Array<[RegExp, string]> = [
  [/\bfederal reserve\b|\bfomc\b/g, "fed"],
  [/\bbitcoin\b/g, "btc"],
  [/\bethereum\b/g, "eth"],
  [/\bconsumer price index\b|\bconsumer prices?\b/g, "cpi"],
  [/\bproducer price index\b|\bproducer prices?\b/g, "ppi"],
  [/(\d+(?:_\d+)?) percent\b/g, "$1%"],
  [/\bnonfarm payrolls?\b/g, "payrolls"],
  [/\bunited states\b/g, "us"],
  // same-event anchors for chokepoint stories (world line #17)
  [/\bstrait of hormuz\b/g, "hormuz"],
  [/\b(container ship|cargo ship|vessels?|tankers?|ships?)\b/g, "ship"],
  [/\bsaudi aramco\b/g, "aramco"],
  [/\b(strikes?|struck|attacks?|attacked|attacking)\b/g, "attack"],
  [/\bred sea\b/g, "redsea"],
];

export function tokens(text: string): Set<string> {
  const out = new Set<string>();
  let norm = normalizeTitle(text);
  for (const [re, to] of ALIASES) norm = norm.replace(re, to);
  for (const w of norm.split(" ")) {
    if (w.length < 2 || STOP.has(w)) continue;
    out.add(stem(w));
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** overlap coefficient: robust when one headline is much longer */
export function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

/** Headline clause used for clustering: drop a short "Speaker:" prefix, keep text before the first ";". */
export function mainClause(title: string): string {
  let t = title.split(/;\s/)[0] ?? title;
  const m = t.match(/^([^:]{2,25}):\s+(.{12,})$/);
  if (m) t = m[2]!;
  return t;
}
