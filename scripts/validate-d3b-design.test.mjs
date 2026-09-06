import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const specification = readFileSync(
  resolve(
    root,
    "docs/specifications/ALPACA_BARS_LIMIT_D3B_LIVE_READONLY_QUALIFICATION_PROTOCOL.md",
  ),
  "utf8",
);
const status = JSON.parse(
  readFileSync(resolve(root, "docs/status/current.json"), "utf8"),
);

const tests = [
  ["canonical conclusions use observation rather than permanent proof language", () => {
    for (const conclusion of [
      "OBSERVED_PER_SYMBOL",
      "OBSERVED_GLOBAL",
      "INCONCLUSIVE",
      "BLOCKED",
    ]) {
      assert(specification.includes(`\"${conclusion}\"`));
    }
    assert.equal(/PROVEN_(?:PER_SYMBOL|GLOBAL)/u.test(specification), false);
  }],
  ["the design fixes exactly three one-day limit-two requests", () => {
    assert(specification.includes("| 1 | `MU` | `BARS` | `timeframe=1Day`, `limit=2` |"));
    assert(specification.includes("| 2 | `QQQ` | `BARS` | `timeframe=1Day`, `limit=2` |"));
    assert(specification.includes("| 3 | `MU,QQQ` | `BARS` | `timeframe=1Day`, `limit=2` |"));
    assert(specification.includes("`timeframe=1Day`"));
    assert(specification.includes("`limit=2`"));
    assert(specification.includes("maximum request attempts `3`"));
  }],
  ["all request identities share one window and one evidence identity", () => {
    assert(/All three requests use one signed plan/iu.test(specification));
    assert(/At the HTTP request\s+identity layer, requested-symbol scope is the only field that differs/iu.test(specification));
    for (const field of [
      "calendarEvidenceFingerprint",
      "mappingRegistryFingerprint",
      "providerVersion",
      "adapterVersion",
      "redactedRequestFingerprint",
    ]) {
      assert(specification.includes(field));
    }
  }],
  ["the exact positive response patterns are observation-only", () => {
    assert(specification.includes("multi returns `MU=2,QQQ=2`, total four"));
    assert(specification.includes("`OBSERVED_PER_SYMBOL`"));
    assert(specification.includes("multi returns `MU=1,QQQ=1`, total two"));
    assert(specification.includes("`OBSERVED_GLOBAL`"));
    assert(specification.includes("One exact-run observation only"));
  }],
  ["ambiguous bounded responses remain inconclusive", () => {
    for (const scenario of [
      "total two as `2+0`",
      "requested symbol is missing",
      "token is present",
      "symbol is unexpected",
      "returned count is abnormal",
    ]) {
      assert(specification.includes(scenario));
    }
    assert(specification.includes("`INCONCLUSIVE` | Fail closed"));
  }],
  ["security and request-window failures are blocked", () => {
    assert(specification.includes("Authorization, credential, HTTP, timeout"));
    assert(specification.includes("request-window"));
    assert(specification.includes("completed-session/Calendar Evidence"));
    assert(specification.includes("`BLOCKED` | Fail closed"));
  }],
  ["the evidence contract preserves bounded diagnostics and identity", () => {
    for (const field of [
      "requestAttemptId",
      "requestFingerprint",
      "responseFingerprint",
      "actualObservedBarsBySymbol",
      "totalObservedBars",
      "responseSymbols",
      "paginationTokenPresent",
      "providerTimestamps",
      "receivedAt",
      "schemaVersion",
    ]) {
      assert(specification.includes(field));
    }
  }],
  ["sensitive and unverifiable material is excluded", () => {
    assert(specification.includes("must not contain credentials"));
    assert(specification.includes("page token value"));
    assert(specification.includes("complete raw response"));
    assert(/Business callers cannot populate or\s+override/iu.test(specification));
  }],
  ["network counters are owned by the product transport lifecycle", () => {
    assert(specification.includes("Dispatch start increments"));
    assert(specification.includes("attempted=0`, `completed=0"));
    assert(specification.includes("A request is `completed=1` only after"));
    assert(specification.includes("cannot be reset to zero or hidden"));
  }],
  ["fixture evidence cannot claim a real provider observation", () => {
    assert(specification.includes("Test factory restricted to `TEST_INJECTED`"));
    assert(specification.includes("Test-injected response claims `REAL_HTTPS` or `OBSERVED_*`"));
    assert(specification.includes("Rejected; zero network counts; `UNPROVEN`"));
  }],
  ["caller-controlled response source cannot create provider authority", () => {
    assert(specification.includes("Caller-provided"));
    assert(specification.includes("response origin"));
    assert(specification.includes("cannot enter the product"));
    assert(specification.includes("response source, fingerprints"));
  }],
  ["implementation and one-shot network approval remain separate", () => {
    assert(specification.includes("separately authorize implementation"));
    assert(specification.includes("separately authorize the exact run"));
    assert(specification.includes("DESIGN_APPROVED` always transitions to `LIVE_RUN_NOT_AUTHORIZED"));
    assert(/approved\s+implementation also remains `LIVE_RUN_NOT_AUTHORIZED/iu.test(specification));
  }],
  ["D3B remains preserved but frozen outside the current product direction", () => {
    assert.equal(status.legacyProductLanes.etfDailyScan.status, "FROZEN_PRODUCT_ENTRY_CODE_RETAINED");
    assert.equal(status.legacyProductLanes.etfDailyScan.formerNextAction, "ALPACA_D3B_IMPLEMENTATION");
    assert.equal(status.legacyProductLanes.etfDailyScan.expansion, "PROHIBITED_WITHOUT_OWNER_APPROVAL");
    assert(status.frozen.includes("ALPACA_D3B_NEXT_ACTION"));
    assert(!status.next.includes("D3B_IMPLEMENTATION_OWNER_APPROVAL_REQUIRED"));
    assert.deepEqual(status.next, ["IMPLEMENT_GLD_IBIT_VERIFIED_OPTION_DATA_AND_RISK"]);
    assert.equal(status.executionBoundaries.network, "CLOSED");
    assert.equal(status.executionBoundaries.broker, "CLOSED");
    assert.equal(status.executionBoundaries.robinhoodAccountRead, "PROHIBITED");
    assert.equal(status.executionBoundaries.paperTrading, "CLOSED");
    assert.equal(status.executionBoundaries.orderExecution, "CLOSED");
    assert.equal(status.automatedExecutionAllowed, false);
  }],
  ["all three request and response fingerprints bind the conclusion", () => {
    const value = qualificationFingerprint(baseQualificationInput());
    const changed = baseQualificationInput();
    changed.responseFingerprints[2] = "response-3-changed";
    assert.notEqual(qualificationFingerprint(changed), value);
    const changedConclusion = baseQualificationInput();
    changedConclusion.conclusion = "OBSERVED_GLOBAL";
    assert.notEqual(qualificationFingerprint(changedConclusion), value);
  }],
  ["equivalent object and normalized response-row order replay deterministically", () => {
    const first = baseQualificationInput();
    const second = {
      conclusion: first.conclusion,
      responseRows: [...first.responseRows].reverse(),
      responseFingerprints: [...first.responseFingerprints],
      requestFingerprints: [...first.requestFingerprints],
    };
    assert.equal(qualificationFingerprint(first), qualificationFingerprint(second));
  }],
  ["approved symbol order is a critical fingerprint input", () => {
    const canonical = requestFingerprint({ symbols: ["MU", "QQQ"] });
    const reordered = requestFingerprint({ symbols: ["QQQ", "MU"] });
    assert.notEqual(canonical, reordered);
  }],
  ["ordinal is plan-owned sequencing rather than an HTTP identity mutation", () => {
    const request = requestFingerprint({ symbols: ["MU"] });
    assert.equal(request, requestFingerprint({ symbols: ["MU"] }));
    assert.notEqual(
      sha256([[1, request], [2, request]]),
      sha256([[2, request], [1, request]]),
    );
    assert(/signed plan\s+fingerprint separately binds the ordered `\(ordinal, requestFingerprint\)` tuple/iu.test(specification));
  }],
  ["the current task changes neither implementation nor network authority", () => {
    assert(/Phase D3B design does not add\s+TypeScript contracts or exports/iu.test(specification));
    assert(specification.includes("Network remains `CLOSED`"));
    assert(specification.includes("persistenceWrites=0"));
    assert(specification.includes("automatedExecutionAllowed=false"));
  }],
];

let passed = 0;
for (const [name, test] of tests) {
  try {
    test();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`D3B design validation: ${passed}/${tests.length} tests passed.`);

function baseQualificationInput() {
  return {
    requestFingerprints: ["request-1", "request-2", "request-3"],
    responseFingerprints: ["response-1", "response-2", "response-3"],
    responseRows: [
      { symbol: "MU", timestamp: "2026-07-31T20:00:00.000Z" },
      { symbol: "QQQ", timestamp: "2026-07-31T20:00:00.000Z" },
    ],
    conclusion: "OBSERVED_PER_SYMBOL",
  };
}

function qualificationFingerprint(value) {
  return sha256({
    requestFingerprints: value.requestFingerprints,
    responseFingerprints: value.responseFingerprints,
    responseRows: [...value.responseRows].sort((left, right) =>
      `${left.symbol}:${left.timestamp}`.localeCompare(`${right.symbol}:${right.timestamp}`),
    ),
    conclusion: value.conclusion,
  });
}

function requestFingerprint({ symbols }) {
  return sha256({
    method: "GET",
    host: "data.alpaca.markets",
    path: "/v2/stocks/bars",
    timeframe: "1Day",
    limit: 2,
    symbols,
  });
}

function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
