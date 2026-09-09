import { createHash } from "node:crypto";
import { canonicalizeDeterministicValue } from "../../contracts/DeterministicFingerprint";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";

export const TREASURY_VERSION = "TREASURY_REAL_YIELDS_V1";
export const TREASURY_XML_BASE = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml";
export const TREASURY_MAX_BYTES = 524288;
export const TREASURY_TENORS = [5, 7, 10, 20, 30] as const;
export const TREASURY_ERRORS = ["NETWORK_FAILED", "DEADLINE_EXCEEDED", "HTTP_STATUS", "CONTENT_TYPE", "BODY_TOO_LARGE", "BODY_MISSING", "INVALID_UTF8", "SOURCE_SCHEMA"] as const;
export type TreasuryError = typeof TREASURY_ERRORS[number];
export type TreasuryRates = Record<typeof TREASURY_TENORS[number], number | null>;
export interface TreasuryRow { sourceId: number; sourceDate: string; entryUpdatedAt: string; ratesBps: TreasuryRates }
export interface TreasuryInput { requestedAt: string; receivedAt: string; url: string; sourceText: string | null; errorCode: TreasuryError | null }
export interface TreasuryRetrieval {
  version: typeof TREASURY_VERSION; requestedAt: string; receivedAt: string; url: string; queryMonth: string;
  status: "OK" | "EMPTY" | "FAILED"; errorCode: TreasuryError | null; sourceSha256: string | null;
  feedUpdatedAt: string | null; rows: TreasuryRow[];
}
function fail(code: string): never { throw Error("TREASURY_" + code); }
export const treasurySha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
export const treasuryFingerprint = (value: unknown): string => treasurySha(canonicalizeDeterministicValue(value));
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export function treasuryClock(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail("CLOCK");
}
export function treasuryUrl(requestedAt: string): string {
  treasuryClock(requestedAt);
  return TREASURY_XML_BASE + "?data=daily_treasury_real_yield_curve&field_tdr_date_value_month=" + exchangeLocalDate(requestedAt, "America/New_York").slice(0, 7).replace("-", "");
}
function exactKeys(value: unknown, keys: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) fail("SHAPE");
}

interface XmlNode { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string }
function decode(value: string): string {
  const replaced = value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, entity => {
    const named: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
    if (named[entity] !== undefined) return named[entity]!;
    const code = entity.startsWith("&#x") ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    if (!Number.isSafeInteger(code) || ![9, 10, 13].includes(code) && (code < 32 || code > 0x10ffff || code >= 0xd800 && code <= 0xdfff || code === 0xfffe || code === 0xffff)) fail("XML_ENTITY");
    return String.fromCodePoint(code);
  });
  if (value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, "").includes("&")) fail("XML_ENTITY");
  return replaced;
}
/** Deliberately restricted XML, not a general XML or HTML interpreter. */
export function xmlTree(source: string): XmlNode {
  if (new TextEncoder().encode(source).byteLength > TREASURY_MAX_BYTES) fail("BODY_TOO_LARGE");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(source) || /[\ud800-\udfff]/u.test(source)) fail("XML_CHARACTER");
  let xml = source;
  if (xml.startsWith("<?xml")) {
    const declaration = /^<\?xml\s+version=["']1\.0["']\s+encoding=["']utf-8["'](?:\s+standalone=["']yes["'])?\s*\?>/i.exec(xml);
    if (!declaration) fail("XML_DECLARATION");
    xml = xml.slice(declaration[0].length);
  }
  if (xml.includes("<!") || xml.includes("<?") || xml.includes("]]>")) fail("XML_DECLARATION");
  const stack: XmlNode[] = [], roots: XmlNode[] = [];
  let offset = 0, nodes = 0;
  while (offset < xml.length) {
    if (xml[offset] !== "<") {
      const end = xml.indexOf("<", offset), text = decode(xml.slice(offset, end < 0 ? xml.length : end));
      if (stack.length) stack.at(-1)!.text += text;
      else if (text.trim()) fail("XML_OUTSIDE_ROOT");
      offset = end < 0 ? xml.length : end; continue;
    }
    const match = /^<(?:[^<>"']|"[^"<]*"|'[^'<]*')*>/.exec(xml.slice(offset));
    if (!match) fail("XML_TAG");
    const token = match[0]; offset += token.length;
    if (token.startsWith("</")) {
      const close = /^<\/([A-Za-z_][\w:.-]*)\s*>$/.exec(token);
      if (!close || stack.pop()?.name !== close[1]) fail("XML_NESTING");
      continue;
    }
    const start = /^<([A-Za-z_][\w:.-]*)([\s\S]*?)(\/?)>$/.exec(token);
    if (!start || ++nodes > 1000 || stack.length > 6) fail("XML_LIMIT");
    let rest = start[2]!;
    const attrs: Record<string, string> = Object.create(null);
    while (rest.trim()) {
      const attr = /^\s+([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/.exec(rest);
      if (!attr || Object.hasOwn(attrs, attr[1]!)) fail("XML_ATTRIBUTE");
      attrs[attr[1]!] = decode(attr[2] ?? attr[3]!); rest = rest.slice(attr[0].length);
    }
    const node: XmlNode = { name: start[1]!, attrs, children: [], text: "" };
    if (stack.length) stack.at(-1)!.children.push(node); else roots.push(node);
    if (!start[3]) stack.push(node);
  }
  if (stack.length || roots.length !== 1) fail("XML_INCOMPLETE");
  return roots[0]!;
}
function attributes(node: XmlNode, required: Record<string, string>, optional: string[] = []): void {
  if (Object.keys(node.attrs).some(k => !Object.hasOwn(required, k) && !optional.includes(k)) || Object.entries(required).some(([k, v]) => node.attrs[k] !== v)) fail("XML_SCHEMA_ATTRIBUTES");
}
function group(node: XmlNode, allowed: string[]): void {
  if (node.text.trim() || node.children.some(c => !allowed.includes(c.name))) fail("XML_SCHEMA_CHILDREN");
}
function one(node: XmlNode, name: string): XmlNode {
  const matches = node.children.filter(c => c.name === name);
  if (matches.length !== 1) fail("XML_FIELD_COUNT");
  return matches[0]!;
}
function leaf(node: XmlNode, required: Record<string, string> = {}, optional: string[] = []): string {
  attributes(node, required, optional);
  if (node.children.length) fail("XML_LEAF");
  return node.text.trim();
}
function updated(node: XmlNode, receivedAt: string): string {
  const raw = leaf(one(node, "updated"));
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw)) fail("SOURCE_CLOCK");
  const value = raw.length === 20 ? raw.replace("Z", ".000Z") : raw;
  treasuryClock(value);
  if (value > receivedAt) fail("SOURCE_CLOCK");
  return value;
}
function metadata(node: XmlNode, rel: string): void {
  const id = leaf(one(node, "id"));
  if (!id || id.length > 2048) fail("XML_ID");
  leaf(one(node, "title"), { type: "text" });
  const link = one(node, "link");
  leaf(link, { rel }, ["title", "href"]);
  if (link.text.trim() || !link.attrs.href) fail("XML_LINK");
}
function parseSource(source: string, requestedAt: string, receivedAt: string) {
  const root = xmlTree(source);
  if (root.name !== "feed") fail("XML_ROOT");
  attributes(root, { "xml:base": TREASURY_XML_BASE, xmlns: "http://www.w3.org/2005/Atom",
    "xmlns:d": "http://schemas.microsoft.com/ado/2007/08/dataservices", "xmlns:m": "http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" });
  group(root, ["id", "title", "updated", "link", "entry"]); metadata(root, "self");
  if (leaf(one(root, "title"), { type: "text" }) !== "DailyTreasuryRealYieldCurveRateData") fail("XML_DATASET");
  const feedUpdatedAt = updated(root, receivedAt), entries = root.children.filter(c => c.name === "entry");
  if (entries.length > 31) fail("ROW_LIMIT");
  const month = exchangeLocalDate(requestedAt, "America/New_York").slice(0, 7), today = exchangeLocalDate(receivedAt, "America/New_York");
  const ids = new Set<number>(), dates = new Set<string>();
  const rows = entries.map(entry => {
    attributes(entry, {}); group(entry, ["id", "title", "updated", "author", "link", "category", "content"]); metadata(entry, "edit");
    const entryUpdatedAt = updated(entry, receivedAt);
    if (entryUpdatedAt > feedUpdatedAt) fail("SOURCE_CLOCK");
    const author = one(entry, "author"); attributes(author, {}); group(author, ["name"]); leaf(one(author, "name"));
    leaf(one(entry, "category"), { term: "TreasuryDataWarehouseModel.DailyTreasuryRealYieldCurveRateDatum", scheme: "http://schemas.microsoft.com/ado/2007/08/dataservices/scheme" });
    const content = one(entry, "content"); attributes(content, { type: "application/xml" }); group(content, ["m:properties"]);
    const properties = one(content, "m:properties"); attributes(properties, {});
    group(properties, ["d:DailyTreasuryRealYieldCurveRateDataId", "d:NEW_DATE", ...TREASURY_TENORS.map(t => `d:TC_${t}YEAR`)]);
    const idText = leaf(one(properties, "d:DailyTreasuryRealYieldCurveRateDataId"), { "m:type": "Edm.Int32" });
    if (!/^[1-9]\d{0,9}$/.test(idText) || Number(idText) > 2147483647) fail("ROW_ID");
    const sourceId = Number(idText), dateText = leaf(one(properties, "d:NEW_DATE"), { "m:type": "Edm.DateTime" });
    if (!/^\d{4}-\d{2}-\d{2}T00:00:00$/.test(dateText)) fail("SOURCE_DATE");
    treasuryClock(dateText + ".000Z");
    const sourceDate = dateText.slice(0, 10);
    if (!sourceDate.startsWith(month + "-") || sourceDate > today) fail("SOURCE_DATE_SCOPE");
    if (ids.has(sourceId) || dates.has(sourceDate)) fail("DUPLICATE_ROW");
    ids.add(sourceId); dates.add(sourceDate);
    const ratesBps = {} as TreasuryRates;
    for (const tenor of TREASURY_TENORS) {
      const field = one(properties, `d:TC_${tenor}YEAR`), raw = leaf(field, { "m:type": "Edm.Double" }, ["m:null"]);
      if (field.attrs["m:null"] !== undefined) {
        if (field.attrs["m:null"] !== "true" || raw) fail("NULL_RATE");
        ratesBps[tenor] = null; continue;
      }
      const rate = /^(-?)(\d{1,5})(?:\.(\d{1,2}))?$/.exec(raw);
      if (!rate) fail("RATE_FORMAT");
      const units = Number(rate[2]) * 100 + Number((rate[3] ?? "").padEnd(2, "0"));
      ratesBps[tenor] = units === 0 ? 0 : rate[1] ? -units : units;
    }
    return { sourceId, sourceDate, entryUpdatedAt, ratesBps };
  }).sort((a, b) => a.sourceDate.localeCompare(b.sourceDate));
  return { feedUpdatedAt, rows };
}
export function assessTreasuryRetrieval(input: TreasuryInput): TreasuryRetrieval {
  exactKeys(input, ["requestedAt", "receivedAt", "url", "sourceText", "errorCode"]);
  treasuryClock(input.requestedAt); treasuryClock(input.receivedAt);
  if (input.receivedAt < input.requestedAt || input.url !== treasuryUrl(input.requestedAt)) fail("RETRIEVAL_SCOPE_OR_CLOCK");
  if (input.errorCode !== null && !(TREASURY_ERRORS as readonly unknown[]).includes(input.errorCode)) fail("ERROR_CODE");
  if (input.errorCode !== null ? input.sourceText !== null : typeof input.sourceText !== "string") fail("SOURCE_ERROR_SHAPE");
  const data = input.sourceText === null ? { feedUpdatedAt: null, rows: [] } : parseSource(input.sourceText, input.requestedAt, input.receivedAt);
  return freeze({ version: TREASURY_VERSION, requestedAt: input.requestedAt, receivedAt: input.receivedAt, url: input.url,
    queryMonth: exchangeLocalDate(input.requestedAt, "America/New_York").slice(0, 7),
    status: input.errorCode !== null ? "FAILED" : data.rows.length ? "OK" : "EMPTY", errorCode: input.errorCode,
    sourceSha256: input.sourceText === null ? null : treasurySha(input.sourceText), ...data });
}
export function reportTreasuryHistory(inputs: readonly TreasuryInput[], assessedAt: string) {
  treasuryClock(assessedAt);
  if (!Array.isArray(inputs) || inputs.length > 1000) fail("HISTORY_LIMIT");
  const retrievals: TreasuryRetrieval[] = inputs.map(input => assessTreasuryRetrieval(input));
  let previousAt: string | null = null;
  const versions: { sourceDate: string; valueSha256: string; firstObservedAt: string; ratesBps: TreasuryRates; retrievalIndex: number }[] = [];
  const latestByDate = new Map<string, string>();
  for (const [index, retrieval] of retrievals.entries()) {
    if (retrieval.receivedAt > assessedAt || previousAt !== null && retrieval.requestedAt < previousAt) fail("HISTORY_CLOCK");
    previousAt = retrieval.receivedAt;
    for (const row of retrieval.rows) {
      const valueSha256 = treasuryFingerprint({ sourceDate: row.sourceDate, ratesBps: row.ratesBps });
      if (latestByDate.get(row.sourceDate) === valueSha256) continue;
      versions.push({ sourceDate: row.sourceDate, valueSha256, firstObservedAt: retrieval.receivedAt, ratesBps: row.ratesBps, retrievalIndex: index });
      latestByDate.set(row.sourceDate, valueSha256);
    }
  }
  const latest = retrievals.at(-1) ?? null, prior = retrievals.at(-2) ?? null;
  const lastKnown = [...retrievals].reverse().find(r => r.rows.length > 0) ?? null;
  const currentRow = latest?.rows.at(-1) ?? null, previousRow = latest?.rows.at(-2) ?? null;
  const lag = (date: string) => Math.floor((Date.parse(exchangeLocalDate(assessedAt, "America/New_York")) - Date.parse(date)) / 86400000);
  const changesBps = {} as TreasuryRates;
  for (const t of TREASURY_TENORS) changesBps[t] = currentRow?.ratesBps[t] != null && previousRow?.ratesBps[t] != null ? currentRow.ratesBps[t]! - previousRow.ratesBps[t]! : null;
  const missingTenors = TREASURY_TENORS.filter(t => currentRow?.ratesBps[t] == null);
  const healthChange = latest === null ? "NO_ATTEMPTS" : prior === null ? "FIRST_ATTEMPT" :
    latest.status !== prior.status || latest.errorCode !== prior.errorCode ? "CHANGED" : "UNCHANGED";
  const body = { version: TREASURY_VERSION, assessedAt, source: "US_TREASURY_DAILY_PAR_REAL_YIELD_CURVE", factorFamily: "real_yields",
    relevantAssets: ["GLD", "IBIT"], units: "WHOLE_BASIS_POINTS_OF_ANNUAL_PERCENT", retrievalCount: retrievals.length,
    latestRetrieval: latest, healthChange, currentRow, missingTenors, currentDateLagDays: currentRow ? lag(currentRow.sourceDate) : null,
    comparison: { method: "CONSECUTIVE_SOURCE_DATES_IN_LATEST_SNAPSHOT", fromDate: previousRow?.sourceDate ?? null, toDate: currentRow?.sourceDate ?? null, changesBps },
    tenMinusFiveYearSlopeBps: currentRow?.ratesBps[10] != null && currentRow?.ratesBps[5] != null ? currentRow.ratesBps[10]! - currentRow.ratesBps[5]! : null,
    lastKnownObservation: lastKnown ? { receivedAt: lastKnown.receivedAt, row: lastKnown.rows.at(-1)!, dateLagDays: lag(lastKnown.rows.at(-1)!.sourceDate), fromLatestRetrieval: lastKnown === latest } : null,
    versions, historicalPublicationTimesKnown: false, releaseCalendarVerified: false, sourceAuthenticatedByParser: false,
    executableQuotes: false, coverageComplete: false, strategySignal: null, winProbability: null, executionAllowed: false, sizeEscalationAllowed: false,
    limitations: ["Daily indicative estimates; not intraday or executable quotes.", "Feed updated times do not establish original row publication times.",
      "First-observed times reflect actual Alpha retrievals; earlier historical vintages are unavailable.", "Date lag is descriptive; no verified publication-calendar freshness rule is applied.",
      "Only five real-yield tenors are connected. Other numerical factors remain incomplete.", "Yield changes alone do not establish GLD or IBIT direction, strategy edge or trading authority."] };
  return freeze({ ...body, reportSha256: treasuryFingerprint(body) });
}
