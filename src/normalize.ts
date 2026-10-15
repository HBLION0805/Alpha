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
    .replace(/[^\p{L}\p{N}%$ ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "a an the and or but of to in on at for from by with as is are was were be been it its this that these those after before over under into about than more new says said say will would could may can amid as up down out not no vs via how why what who when where us u s live latest news update updates video watch here".split(" "),
);

/** crude stemming so "tariffs"/"tariff", "rates"/"rate" collide */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

const ALIASES: Array<[RegExp, string]> = [
  [/\bfederal reserve\b|\bfomc\b/g, "fed"],
  [/\bbitcoin\b/g, "btc"],
  [/\bethereum\b/g, "eth"],
  [/\bconsumer price index\b/g, "cpi"],
  [/\bnonfarm payrolls?\b/g, "payrolls"],
  [/\bunited states\b/g, "us"],
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
