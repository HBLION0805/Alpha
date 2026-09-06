import { assessRobinhoodToolCatalog as assess, ROBINHOOD_DATA_BOUNDARIES, ROBINHOOD_DATA_ENDPOINT,
  ROBINHOOD_DATA_TOOL_NAMES, type RobinhoodToolCatalogAssessment } from "./RobinhoodDataReadinessEngine";

let passed = 0;
function test(label: string, run: () => void): void { run(); passed++; console.log("PASS " + label); }
function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Expected " + JSON.stringify(expected) + "; got " + JSON.stringify(actual));
}
function truth(value: unknown): asserts value { if (!value) throw new Error("Assertion failed."); }
function rejects(input: unknown, code: string): void {
  let error: unknown; try { assess(input); } catch (caught) { error = caught; }
  truth(error instanceof Error); equal(error.message, code);
}
function tool(name: string = "get_option_quotes", overrides: Record<string, unknown> = {}) {
  return { name, inputSchema: { type: "object", properties: { symbols: { type: "array", items: { type: "string" } } } },
    outputSchema: { type: "object", properties: { quotes: { type: "array" } } }, annotations: { readOnlyHint: true }, ...overrides };
}
function complete() { return { tools: ROBINHOOD_DATA_TOOL_NAMES.map((name) => tool(name)) }; }
function blocked(result: RobinhoodToolCatalogAssessment, code: string): void { truth(result.blockers.includes(code)); }
function boundaries(result: RobinhoodToolCatalogAssessment): void {
  for (const [key, value] of Object.entries(ROBINHOOD_DATA_BOUNDARIES)) equal(result[key as keyof RobinhoodToolCatalogAssessment], value);
  equal(result.status, "LOCAL_CATALOG_REVIEW_ONLY"); equal(result.catalogOrigin, "UNVERIFIED_LOCAL_TOOLS_LIST");
}

test("empty declaration reports all five missing with zero authority", () => {
  const result = assess({ tools: [] }); boundaries(result); equal(result.excludedToolCount, 0); equal(result.paginationPresent, false);
  blocked(result, "EMPTY_TOOL_CATALOG"); equal(result.candidates.map((item) => item.name), ROBINHOOD_DATA_TOOL_NAMES);
  for (const item of result.candidates) { equal(item.presence, "MISSING"); equal(item.inputSchemaFingerprint, null); equal(item.outputSchemaFingerprint, null); equal(item.readOnlyHint, "UNKNOWN"); blocked(result, "MISSING_CANDIDATE:" + item.name); }
});
test("complete names and schemas remain an unauthenticated local review", () => {
  const result = assess(complete()); boundaries(result); equal(result.excludedToolCount, 0); equal(result.blockers.length, 4);
  blocked(result, "LOCAL_CATALOG_NOT_AUTHENTICATED"); blocked(result, "SCHEMA_SEMANTICS_UNVERIFIED");
  blocked(result, "AUTHORIZED_DATA_CONNECTION_MISSING"); blocked(result, "ACTUAL_QUOTE_RESPONSE_EVIDENCE_MISSING");
  for (const item of result.candidates) { equal(item.presence, "PRESENT"); equal(item.readOnlyHint, "TRUE"); truth(/^sha256:[a-f0-9]{64}$/.test(item.inputSchemaFingerprint!)); truth(/^sha256:[a-f0-9]{64}$/.test(item.outputSchemaFingerprint!)); }
});
test("only fixed names appear; excluded orders, descriptions, properties and cursor never escape", () => {
  const secret = "DO_NOT_ECHO_SENTINEL";
  const result = assess({ tools: [...complete().tools, tool("place_order_" + secret, { description: secret, annotations: { readOnlyHint: false } }),
    tool("get_account_" + secret), tool("get_crypto_quotes_" + secret)], nextCursor: secret,
    _meta: { [secret]: secret } });
  boundaries(result); equal(result.excludedToolCount, 3); equal(result.paginationPresent, true); blocked(result, "TOOL_CATALOG_PAGINATED");
  truth(!JSON.stringify(result).includes(secret)); truth(!result.blockers.some((code) => code.startsWith("READ_ONLY_HINT_CONTRADICTION:")));
  const schemaResult = assess({ tools: [tool(undefined, { inputSchema: { type: "object", properties: { [secret]: { description: secret } } } })] });
  truth(!JSON.stringify(schemaResult).includes(secret));
});
test("descriptor order and schema object key order do not change the assessment", () => {
  const first = complete();
  const second = { tools: [...first.tools].reverse().map((item) => ({ ...item, inputSchema: { properties: { symbols: { items: { type: "string" }, type: "array" } }, type: "object" } })) };
  equal(assess(first), assess(second));
});
test("schema changes alter only their corresponding local fingerprint", () => {
  const first = assess({ tools: [tool()] }).candidates[2]!;
  const second = assess({ tools: [tool(undefined, { inputSchema: { type: "object", additionalProperties: false } })] }).candidates[2]!;
  truth(first.inputSchemaFingerprint !== second.inputSchemaFingerprint); equal(first.outputSchemaFingerprint, second.outputSchemaFingerprint);
  const third = assess({ tools: [tool(undefined, { outputSchema: { type: "object", required: ["quotes"] } })] }).candidates[2]!;
  equal(first.inputSchemaFingerprint, third.inputSchemaFingerprint); truth(first.outputSchemaFingerprint !== third.outputSchemaFingerprint);
});
test("missing output schema is permitted but remains an explicit blocker", () => {
  const candidate = tool(); Reflect.deleteProperty(candidate, "outputSchema");
  const result = assess({ tools: [candidate] }); equal(result.candidates[2]!.outputSchemaFingerprint, null); blocked(result, "OUTPUT_SCHEMA_MISSING:get_option_quotes");
});
test("missing annotations and missing hint remain unknown, not implicitly read-only", () => {
  const candidate = tool(); Reflect.deleteProperty(candidate, "annotations");
  for (const value of [candidate, tool(undefined, { annotations: {} })]) {
    const result = assess({ tools: [value] }); equal(result.candidates[2]!.readOnlyHint, "UNKNOWN"); blocked(result, "READ_ONLY_HINT_UNKNOWN:get_option_quotes");
  }
});
test("explicit false read-only hint is a contradiction even with every schema present", () => {
  const result = assess({ tools: [tool(undefined, { annotations: { readOnlyHint: false } })] });
  equal(result.candidates[2]!.readOnlyHint, "FALSE"); blocked(result, "READ_ONLY_HINT_CONTRADICTION:get_option_quotes"); boundaries(result);
});
test("annotation types are validated for candidates and excluded tools", () => {
  for (const annotations of [null, [], "safe", { readOnlyHint: "true" }, { destructiveHint: 0 }, { idempotentHint: null }, { openWorldHint: "false" }, { title: 7 }]) {
    for (const name of ["get_option_quotes", "place_order"]) rejects({ tools: [tool(name, { annotations })] }, "ROBINHOOD_CATALOG_INVALID_ANNOTATIONS");
  }
  const result = assess({ tools: [tool(undefined, { annotations: { readOnlyHint: true, title: "PRIVATE_TITLE", futureHint: { private: "PRIVATE_HINT" } } })] });
  truth(!JSON.stringify(result).includes("PRIVATE_"));
});
test("opaque pagination is bounded and never treated as complete coverage", () => {
  for (const nextCursor of ["x", "x".repeat(2048)]) blocked(assess({ ...complete(), nextCursor }), "TOOL_CATALOG_PAGINATED");
  for (const nextCursor of ["", "x".repeat(2049), false, 1, null, []]) rejects({ tools: [], nextCursor }, "ROBINHOOD_CATALOG_INVALID_CURSOR");
});
test("root envelope shape is strict and metadata is an object", () => {
  for (const input of [null, [], {}, { tools: {} }, { tools: [], result: {} }, { tools: [], executionAllowed: true }]) rejects(input, "ROBINHOOD_CATALOG_INVALID_ENVELOPE");
  for (const _meta of [null, [], "private", 0]) rejects({ tools: [], _meta }, "ROBINHOOD_CATALOG_INVALID_META");
  equal(assess({ tools: [], _meta: { privateValue: "PRIVATE_META" } }), assess({ tools: [] }));
});
test("256 descriptors are allowed and 257 fail without silently truncating", () => {
  const tools = Array.from({ length: 256 }, (_, index) => tool("excluded_" + index));
  equal(assess({ tools }).excludedToolCount, 256); rejects({ tools: [...tools, tool("excluded_last")] }, "ROBINHOOD_CATALOG_TOOL_LIMIT");
});
test("duplicate names reject for candidate and excluded descriptors", () => {
  for (const name of ["get_option_quotes", "place_order"]) rejects({ tools: [tool(name), tool(name)] }, "ROBINHOOD_CATALOG_DUPLICATE_TOOL_NAME");
});
test("ASCII identifiers are bounded and malformed names fail without disclosure", () => {
  equal(assess({ tools: [tool("a".repeat(128)), tool("_private.tool-name")] }).excludedToolCount, 2);
  for (const name of ["", "a".repeat(129), "get option quotes", "get_期权", "get\nquotes", "1tool", "PRIVATE_SECRET!"]) rejects({ tools: [tool(name)] }, "ROBINHOOD_CATALOG_INVALID_TOOL_NAME");
  rejects({ tools: [{ inputSchema: { type: "object" } }] }, "ROBINHOOD_CATALOG_INVALID_TOOL_NAME");
});
test("schemas must be actual object schemas on all descriptors", () => {
  for (const schema of [null, [], "object", {}, { type: "array" }, { type: ["object"] }]) {
    for (const name of ["get_option_quotes", "place_order"]) {
      rejects({ tools: [tool(name, { inputSchema: schema })] }, "ROBINHOOD_CATALOG_INVALID_INPUT_SCHEMA");
      rejects({ tools: [tool(name, { outputSchema: schema })] }, "ROBINHOOD_CATALOG_INVALID_OUTPUT_SCHEMA");
    }
  }
  rejects({ tools: [{ name: "get_option_quotes" }] }, "ROBINHOOD_CATALOG_INVALID_INPUT_SCHEMA");
  for (const value of [null, [], false, "get_option_quotes"]) rejects({ tools: [value] }, "ROBINHOOD_CATALOG_INVALID_TOOL");
});
test("external schema references are hashed but never echoed or semantically verified", () => {
  const result = assess({ tools: [tool(undefined, { inputSchema: { type: "object", $ref: "https://DO_NOT_FETCH.invalid/private" } })] });
  truth(!JSON.stringify(result).includes("DO_NOT_FETCH")); boundaries(result);
});
test("data getters are rejected without execution at the root and in ignored fields", () => {
  let called = 0; const root = Object.defineProperty({}, "tools", { enumerable: true, get() { called++; return []; } });
  rejects(root, "ROBINHOOD_CATALOG_NON_JSON_DATA");
  const nested = Object.defineProperty({}, "private", { enumerable: true, get() { called++; return true; } });
  rejects({ tools: [tool(undefined, { ignored: nested })] }, "ROBINHOOD_CATALOG_NON_JSON_DATA"); equal(called, 0);
});
test("symbols and non-enumerable fields cannot hide unvalidated declarations", () => {
  rejects({ tools: [], [Symbol("private")]: true }, "ROBINHOOD_CATALOG_NON_JSON_DATA");
  rejects(Object.defineProperty({ tools: [] }, "private", { value: true }), "ROBINHOOD_CATALOG_NON_JSON_DATA");
});
test("non-JSON primitives are rejected even in ignored descriptor fields", () => {
  for (const ignored of [undefined, () => true, 1n, Number.NaN, Infinity, -Infinity, Symbol("private")]) rejects({ tools: [tool(undefined, { ignored })] }, "ROBINHOOD_CATALOG_NON_JSON_DATA");
});
test("custom prototypes and built-in objects cannot execute serialization hooks", () => {
  class Foreign { privateValue = true; }
  for (const ignored of [new Date(), new Map(), new Set(), new Foreign(), Object.create({ privateValue: true })]) rejects({ tools: [tool(undefined, { ignored })] }, "ROBINHOOD_CATALOG_NON_PLAIN_DATA");
  let called = 0; rejects({ tools: [], _meta: { toJSON() { called++; return {}; } } }, "ROBINHOOD_CATALOG_NON_JSON_DATA"); equal(called, 0);
});
test("cycles reject while repeated noncyclic JSON subtrees are allowed", () => {
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  rejects({ tools: [], _meta: cycle }, "ROBINHOOD_CATALOG_CYCLE");
  const array: unknown[] = []; array.push(array); rejects({ tools: [], _meta: { array } }, "ROBINHOOD_CATALOG_CYCLE");
  const shared = { value: "same" }; equal(assess({ tools: [], _meta: { a: shared, b: shared } }), assess({ tools: [] }));
});
test("sparse arrays, array accessors, extra keys and array subclasses reject", () => {
  rejects({ tools: [], _meta: { values: new Array(1) } }, "ROBINHOOD_CATALOG_NON_JSON_ARRAY");
  const extra = Object.assign([], { privateValue: true }); rejects({ tools: [], _meta: { values: extra } }, "ROBINHOOD_CATALOG_NON_JSON_ARRAY");
  let called = 0; const accessor = Object.defineProperty([null], "0", { enumerable: true, get() { called++; return true; } });
  rejects({ tools: [], _meta: { values: accessor } }, "ROBINHOOD_CATALOG_NON_JSON_ARRAY"); equal(called, 0);
  class ForeignArray extends Array<unknown> {} rejects({ tools: [], _meta: { values: new ForeignArray() } }, "ROBINHOOD_CATALOG_NON_PLAIN_DATA");
});
test("null-prototype JSON objects are accepted without changing schema hashes", () => {
  const normal = { tools: [tool(undefined, { inputSchema: { type: "object" } })] };
  const safeSchema = Object.assign(Object.create(null), { type: "object" });
  const safeRoot = Object.assign(Object.create(null), { tools: [tool(undefined, { inputSchema: safeSchema })] }); equal(assess(normal), assess(safeRoot));
});
test("the depth 24 boundary is inclusive and a deeper ignored field rejects", () => {
  const nested = (count: number) => { let value: Record<string, unknown> = { leaf: null }; for (let index = 0; index < count; index++) value = { child: value }; return value; };
  assess({ tools: [], _meta: nested(22) }); rejects({ tools: [], _meta: nested(23) }, "ROBINHOOD_CATALOG_DEPTH_LIMIT");
});
test("the 20000-node boundary is inclusive and cannot hide excessive metadata", () => {
  assess({ tools: [], _meta: { values: Array(19996).fill(0) } });
  rejects({ tools: [], _meta: { values: Array(19997).fill(0) } }, "ROBINHOOD_CATALOG_NODE_LIMIT");
});
test("the 512 KiB serialized byte boundary is inclusive", () => {
  const overhead = JSON.stringify({ tools: [], _meta: { padding: "" } }).length;
  assess({ tools: [], _meta: { padding: "a".repeat(512 * 1024 - overhead) } });
  rejects({ tools: [], _meta: { padding: "a".repeat(512 * 1024 - overhead + 1) } }, "ROBINHOOD_CATALOG_BYTE_LIMIT");
});
test("UTF-8 and JSON escapes count bytes, including surrogate pairs and lone surrogates", () => {
  const overhead = JSON.stringify({ tools: [], _meta: { padding: "" } }).length;
  for (const [unit, bytes] of [["é", 2], ["金", 3], ["😀", 4], ["\ud800", 6], ["\udc00", 6], ["\u0000", 6], ["\n", 2], ["\"", 2], ["\\", 2]] as const) {
    const repeats = Math.floor((512 * 1024 - overhead) / bytes); assess({ tools: [], _meta: { padding: unit.repeat(repeats) } });
    rejects({ tools: [], _meta: { padding: unit.repeat(repeats + 1) } }, "ROBINHOOD_CATALOG_BYTE_LIMIT");
  }
});
test("property names consume the serialized byte budget too", () => {
  rejects({ tools: [], _meta: { ["key".repeat(180000)]: null } }, "ROBINHOOD_CATALOG_BYTE_LIMIT");
});
test("all report collections and exported constants are immutable without freezing the caller", () => {
  const input = complete(); const before = JSON.stringify(input); const result = assess(input); const saved = JSON.stringify(result);
  for (const value of [result, result.candidates, ...result.candidates, result.blockers, result.limitations, ROBINHOOD_DATA_TOOL_NAMES, ROBINHOOD_DATA_BOUNDARIES]) truth(Object.isFrozen(value));
  truth(!Object.isFrozen(input)); truth(!Object.isFrozen(input.tools)); equal(JSON.stringify(input), before);
  input.tools[0]!.inputSchema.properties.symbols.type = "mutated"; equal(JSON.stringify(result), saved);
  equal(ROBINHOOD_DATA_ENDPOINT, "https://agent.robinhood.com/mcp/trading");
});
test("authority-looking descriptor content cannot enable data, account or trading access", () => {
  const result = assess({ tools: complete().tools.map((item) => ({ ...item, executionAllowed: true, marketDataConnected: true,
    schemaSemanticsVerified: true, authenticated: true, winProbability: 0.99, description: "CONNECTED_READY_PRIVATE" })),
    _meta: { executionAllowed: true, accountAccessPerformed: true, actualQuoteReplay: "SUCCESS" } });
  boundaries(result); truth(!JSON.stringify(result).includes("CONNECTED_READY_PRIVATE"));
});
test("inherited required fields and read-only hints cannot influence assessment", () => {
  const prior = new Map<string, PropertyDescriptor | undefined>();
  const set = (key: string, value: unknown) => { prior.set(key, Object.getOwnPropertyDescriptor(Object.prototype, key)); Object.defineProperty(Object.prototype, key, { value, configurable: true, writable: true }); };
  try {
    set("name", "get_option_quotes"); set("inputSchema", { type: "object" }); set("type", "object"); set("readOnlyHint", true);
    rejects({ tools: [{}] }, "ROBINHOOD_CATALOG_INVALID_TOOL_NAME");
    rejects({ tools: [{ name: "get_option_quotes" }] }, "ROBINHOOD_CATALOG_INVALID_INPUT_SCHEMA");
    rejects({ tools: [tool(undefined, { inputSchema: {} })] }, "ROBINHOOD_CATALOG_INVALID_INPUT_SCHEMA");
    rejects({ tools: [tool(undefined, { outputSchema: {} })] }, "ROBINHOOD_CATALOG_INVALID_OUTPUT_SCHEMA");
    equal(assess({ tools: [tool(undefined, { annotations: {} })] }).candidates[2]!.readOnlyHint, "UNKNOWN");
  } finally { for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(Object.prototype, key, descriptor); else Reflect.deleteProperty(Object.prototype, key); } }
});

console.log("Robinhood data readiness engine: " + passed + "/" + passed + " passed.");
