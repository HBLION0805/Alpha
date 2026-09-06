import { createHash } from "node:crypto";

export const ROBINHOOD_DATA_ENDPOINT = "https://agent.robinhood.com/mcp/trading";
export const ROBINHOOD_DATA_TOOL_NAMES = Object.freeze([
  "get_option_chains", "get_option_instruments", "get_option_quotes", "get_option_historicals", "get_equity_quotes",
] as const);
export const ROBINHOOD_DATA_BOUNDARIES = Object.freeze({ executionAllowed: false, marketDataConnected: false,
  accountAccessPerformed: false, schemaSemanticsVerified: false, actualQuoteReplay: "NOT_RUN", winProbability: null } as const);

const MAX_BYTES = 512 * 1024, MAX_NODES = 20_000, MAX_DEPTH = 24;
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type CandidateName = typeof ROBINHOOD_DATA_TOOL_NAMES[number];
export interface RobinhoodCatalogCandidate {
  readonly name: CandidateName;
  readonly presence: "PRESENT" | "MISSING";
  readonly inputSchemaFingerprint: string | null;
  readonly outputSchemaFingerprint: string | null;
  readonly readOnlyHint: "TRUE" | "FALSE" | "UNKNOWN";
}
export interface RobinhoodToolCatalogAssessment {
  readonly schemaVersion: "1.0";
  readonly engineVersion: "ROBINHOOD_DATA_READINESS_V1";
  readonly status: "LOCAL_CATALOG_REVIEW_ONLY";
  readonly catalogOrigin: "UNVERIFIED_LOCAL_TOOLS_LIST";
  readonly candidates: readonly RobinhoodCatalogCandidate[];
  readonly excludedToolCount: number;
  readonly paginationPresent: boolean;
  readonly blockers: readonly string[];
  readonly limitations: readonly string[];
  readonly executionAllowed: false;
  readonly marketDataConnected: false;
  readonly accountAccessPerformed: false;
  readonly schemaSemanticsVerified: false;
  readonly actualQuoteReplay: "NOT_RUN";
  readonly winProbability: null;
}

/** Checks data descriptors before reading values; no toJSON or getter is called. */
function validateJson(input: unknown): asserts input is Json {
  let bytes = 0, nodes = 0;
  const active = new Set<object>();
  const add = (count: number) => { bytes += count; if (bytes > MAX_BYTES) throw new Error("ROBINHOOD_CATALOG_BYTE_LIMIT"); };
  const stringBytes = (text: string) => {
    add(2);
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      if (code === 34 || code === 92 || [8, 9, 10, 12, 13].includes(code)) add(2);
      else if (code < 32) add(6);
      else if (code < 128) add(1);
      else if (code < 2048) add(2);
      else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) { add(4); index++; }
      else if (code >= 0xd800 && code <= 0xdfff) add(6);
      else add(3);
    }
  };
  const visit = (value: unknown, depth: number): void => {
    if (depth > MAX_DEPTH) throw new Error("ROBINHOOD_CATALOG_DEPTH_LIMIT");
    if (++nodes > MAX_NODES) throw new Error("ROBINHOOD_CATALOG_NODE_LIMIT");
    if (value === null || typeof value === "boolean") { add(value === null ? 4 : value ? 4 : 5); return; }
    if (typeof value === "string") { stringBytes(value); return; }
    if (typeof value === "number" && Number.isFinite(value)) { add(JSON.stringify(value).length); return; }
    if (typeof value !== "object") throw new Error("ROBINHOOD_CATALOG_NON_JSON_DATA");
    if (active.has(value)) throw new Error("ROBINHOOD_CATALOG_CYCLE");
    const isArray = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error("ROBINHOOD_CATALOG_NON_PLAIN_DATA");
    const keys = Reflect.ownKeys(value);
    if (keys.length - (isArray ? 1 : 0) > MAX_NODES - nodes) throw new Error("ROBINHOOD_CATALOG_NODE_LIMIT");
    active.add(value); add(2);
    try {
      if (isArray) {
        if (keys.length !== value.length + 1) throw new Error("ROBINHOOD_CATALOG_NON_JSON_ARRAY");
        for (let index = 0; index < value.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) throw new Error("ROBINHOOD_CATALOG_NON_JSON_ARRAY");
          if (index > 0) add(1);
          visit(descriptor.value, depth + 1);
        }
      } else {
        for (let index = 0; index < keys.length; index++) {
          const key = keys[index]!;
          if (typeof key !== "string") throw new Error("ROBINHOOD_CATALOG_NON_JSON_DATA");
          const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
          if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) throw new Error("ROBINHOOD_CATALOG_NON_JSON_DATA");
          if (index > 0) add(1);
          stringBytes(key); add(1); visit(descriptor.value, depth + 1);
        }
      }
    } finally { active.delete(value); }
  };
  visit(input, 0);
}
function object(value: Json | undefined, code: string): { [key: string]: Json } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value;
}
/** Only already-validated plain JSON reaches this local change fingerprint. */
function fingerprint(value: Json): string {
  const canonical = (item: Json): string => item === null || typeof item !== "object" ? JSON.stringify(item)
    : Array.isArray(item) ? `[${item.map(canonical).join(",")}]`
      : `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${canonical(item[key]!)}`).join(",")}}`;
  return "sha256:" + createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

/** A local tools/list declaration is never an authenticated discovery or a tool invocation. */
export function assessRobinhoodToolCatalog(input: unknown): RobinhoodToolCatalogAssessment {
  validateJson(input);
  const envelope = object(input, "ROBINHOOD_CATALOG_INVALID_ENVELOPE");
  if (!Object.hasOwn(envelope, "tools") || Object.keys(envelope).some((key) => !["tools", "nextCursor", "_meta"].includes(key))
    || !Array.isArray(envelope.tools)) throw new Error("ROBINHOOD_CATALOG_INVALID_ENVELOPE");
  if (envelope.tools.length > 256) throw new Error("ROBINHOOD_CATALOG_TOOL_LIMIT");
  if (Object.hasOwn(envelope, "nextCursor") && (typeof envelope.nextCursor !== "string" || envelope.nextCursor.length < 1 || envelope.nextCursor.length > 2048)) throw new Error("ROBINHOOD_CATALOG_INVALID_CURSOR");
  if (Object.hasOwn(envelope, "_meta")) object(envelope._meta, "ROBINHOOD_CATALOG_INVALID_META");
  const names = new Set<string>(), tools = new Map<string, { inputSchema: Json; outputSchema: Json | null; readOnlyHint: RobinhoodCatalogCandidate["readOnlyHint"] }>();
  for (const inputTool of envelope.tools) {
    const tool = object(inputTool, "ROBINHOOD_CATALOG_INVALID_TOOL");
    if (!Object.hasOwn(tool, "name") || typeof tool.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(tool.name)) throw new Error("ROBINHOOD_CATALOG_INVALID_TOOL_NAME");
    if (names.has(tool.name)) throw new Error("ROBINHOOD_CATALOG_DUPLICATE_TOOL_NAME");
    names.add(tool.name);
    const inputSchema = object(Object.hasOwn(tool, "inputSchema") ? tool.inputSchema : undefined, "ROBINHOOD_CATALOG_INVALID_INPUT_SCHEMA");
    if (!Object.hasOwn(inputSchema, "type") || inputSchema.type !== "object") throw new Error("ROBINHOOD_CATALOG_INVALID_INPUT_SCHEMA");
    const outputSchema = Object.hasOwn(tool, "outputSchema") ? object(tool.outputSchema, "ROBINHOOD_CATALOG_INVALID_OUTPUT_SCHEMA") : null;
    if (outputSchema && (!Object.hasOwn(outputSchema, "type") || outputSchema.type !== "object")) throw new Error("ROBINHOOD_CATALOG_INVALID_OUTPUT_SCHEMA");
    let readOnlyHint: RobinhoodCatalogCandidate["readOnlyHint"] = "UNKNOWN";
    if (Object.hasOwn(tool, "annotations")) {
      const annotations = object(tool.annotations, "ROBINHOOD_CATALOG_INVALID_ANNOTATIONS");
      for (const hint of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) {
        if (Object.hasOwn(annotations, hint) && typeof annotations[hint] !== "boolean") throw new Error("ROBINHOOD_CATALOG_INVALID_ANNOTATIONS");
      }
      if (Object.hasOwn(annotations, "title") && typeof annotations.title !== "string") throw new Error("ROBINHOOD_CATALOG_INVALID_ANNOTATIONS");
      if (Object.hasOwn(annotations, "readOnlyHint")) {
        if (annotations.readOnlyHint === true) readOnlyHint = "TRUE";
        if (annotations.readOnlyHint === false) readOnlyHint = "FALSE";
      }
    }
    if (ROBINHOOD_DATA_TOOL_NAMES.some((name) => name === tool.name)) tools.set(tool.name, { inputSchema, outputSchema, readOnlyHint });
  }
  const blockers = ["LOCAL_CATALOG_NOT_AUTHENTICATED", "SCHEMA_SEMANTICS_UNVERIFIED", "AUTHORIZED_DATA_CONNECTION_MISSING", "ACTUAL_QUOTE_RESPONSE_EVIDENCE_MISSING"];
  if (envelope.tools.length === 0) blockers.push("EMPTY_TOOL_CATALOG");
  const paginationPresent = Object.hasOwn(envelope, "nextCursor");
  if (paginationPresent) blockers.push("TOOL_CATALOG_PAGINATED");
  const candidates = ROBINHOOD_DATA_TOOL_NAMES.map((name): RobinhoodCatalogCandidate => {
    const tool = tools.get(name);
    if (!tool) blockers.push(`MISSING_CANDIDATE:${name}`);
    else {
      if (tool.outputSchema === null) blockers.push(`OUTPUT_SCHEMA_MISSING:${name}`);
      if (tool.readOnlyHint === "FALSE") blockers.push(`READ_ONLY_HINT_CONTRADICTION:${name}`);
      if (tool.readOnlyHint === "UNKNOWN") blockers.push(`READ_ONLY_HINT_UNKNOWN:${name}`);
    }
    return Object.freeze({ name, presence: tool ? "PRESENT" : "MISSING", inputSchemaFingerprint: tool ? fingerprint(tool.inputSchema) : null,
      outputSchemaFingerprint: tool?.outputSchema ? fingerprint(tool.outputSchema) : null, readOnlyHint: tool?.readOnlyHint ?? "UNKNOWN" });
  });
  return Object.freeze({ schemaVersion: "1.0", engineVersion: "ROBINHOOD_DATA_READINESS_V1", status: "LOCAL_CATALOG_REVIEW_ONLY",
    catalogOrigin: "UNVERIFIED_LOCAL_TOOLS_LIST", candidates: Object.freeze(candidates), excludedToolCount: envelope.tools.length - tools.size,
    paginationPresent, blockers: Object.freeze(blockers), limitations: Object.freeze([
      "This is an unverified local tools/list declaration. Names, schemas and read-only hints do not authenticate a server or prove tool behavior.",
      "Schema presence and fingerprints provide local change detection, not field compatibility, timestamp units, size timing or usable option quote evidence. External schema references are not fetched.",
      "The five-name client filter does not narrow server OAuth scopes, enforce GLD/IBIT arguments, verify account eligibility or authorize a tool call.",
      "No account, onboarding, credential, order or market-data request is performed. Historical OHLC or last/mark prices cannot substitute for execution bid/ask and displayed sizes.",
    ]), ...ROBINHOOD_DATA_BOUNDARIES });
}
