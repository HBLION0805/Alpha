import { closeSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assessRobinhoodToolCatalog, ROBINHOOD_DATA_BOUNDARIES, ROBINHOOD_DATA_ENDPOINT, ROBINHOOD_DATA_TOOL_NAMES } from "../src/engines/options-robinhood-data/RobinhoodDataReadinessEngine.ts";

const sourceReferences = [
  { topic: "Documented tool purposes, not runtime schemas", url: "https://robinhood.com/us/en/support/articles/trading-with-your-agent/" },
  { topic: "Official endpoint, broad account access and onboarding", url: "https://robinhood.com/us/en/support/articles/agentic-trading-overview/" },
  { topic: "Codex client-side tool filter and disabled configuration", url: "https://learn.chatgpt.com/docs/config-file/config-reference" },
];
const requirements = [
  { id: "CONTRACT_IDENTITY_AND_TERMS", needed: "Provider contract/underlying IDs linked to GLD or IBIT, expiry, strike, call/put, multiplier, currency and adjustment/deliverable evidence." },
  { id: "OPTION_BID_ASK", needed: "Both quote sides with documented per-share USD units and exact precision. OHLC, mark and last cannot substitute." },
  { id: "DISPLAYED_SIZE", needed: "Bid/ask size in contracts, nullable separately from zero, with documented size timing. Volume and open interest cannot substitute." },
  { id: "SOURCE_QUOTE_CLOCK", needed: "Source quote time and its meaning, separately from last-trade time, request time and receipt time. Cached data cannot become fresh on receipt." },
  { id: "UNDERLYING_ALIGNMENT", needed: "Linked underlying bid/ask, price meaning, its own source clock and explicit maximum skew/freshness. Same receipt time does not establish alignment." },
  { id: "COVERAGE_AND_DELIVERY", needed: "Actual option-specific intervals, retention, expired-contract support, revision/gap behavior, delivery delay, pagination and rate limits." },
  { id: "ENTITLEMENT_AND_COST", needed: "Owner-specific access rights, permitted retention/use and any options-data fees. Public tool documentation proves none of these." },
  { id: "SOURCE_SPECIFIC_ADAPTER", needed: "A separately reviewed Robinhood adapter. Existing Cboe source IDs, interval-end clocks and size rules cannot be assigned to Robinhood responses." },
];

export function buildRobinhoodDataReadinessReport() {
  return { schemaVersion: "1.0", engineVersion: "ROBINHOOD_DATA_READINESS_V1", reviewedOn: "2026-09-06",
    status: "PUBLIC_DOCUMENTATION_REVIEW_ONLY", endpoint: ROBINHOOD_DATA_ENDPOINT, candidateTools: [...ROBINHOOD_DATA_TOOL_NAMES],
    documentedHistoricalCapability: "OPTION_OHLC_BARS_ONLY_DESCRIPTION_NOT_HISTORICAL_BID_ASK_EVIDENCE",
    documentedCurrentCapability: "OPTION_CHAINS_INSTRUMENTS_AND_REAL_TIME_QUOTES_WITHOUT_PUBLIC_FIELD_SCHEMA",
    runtimeSchemas: "NOT_OBTAINED", authenticatedConnection: "NOT_ESTABLISHED", optionsDataCost: "UNKNOWN_NO_PURCHASE_AUTHORIZED",
    serverAccountReadScope: "PUBLIC_DOCUMENTATION_DESCRIBES_ALL_ACCOUNTS", granularReadOnlyOAuthScope: "NOT_DOCUMENTED",
    configurationExample: "fixtures/options-robinhood-data/codex.disabled.example.toml", configurationInstalled: false,
    configurationMeaning: "Disabled example. A client tool-name filter does not narrow server authorization, prove behavior or enforce GLD/IBIT arguments.",
    requirements: structuredClone(requirements), sourceReferences: structuredClone(sourceReferences),
    nextSteps: ["Owner reviews connection scope and completes any authorized login through official UI; do not open an Agentic account automatically.",
      "Inspect a complete authorized tools/list schema export, then market-data-only responses and documented units/timestamps before designing an adapter.",
      "Evaluate prospective capture separately if historical bid/ask paths are unavailable; retain unknown fields and do not backdate availability."],
    ...ROBINHOOD_DATA_BOUNDARIES };
}

function readCatalog(path) {
  const maximum = 512 * 1024, before = lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maximum) throw new Error("ROBINHOOD_CATALOG_UNSAFE_OR_OVERSIZED_FILE");
  const same = (stat) => stat.isFile() && !stat.isSymbolicLink() && stat.dev === before.dev && stat.ino === before.ino
    && stat.size === before.size && stat.mtimeMs === before.mtimeMs && stat.ctimeMs === before.ctimeMs;
  const fd = openSync(path, "r");
  try {
    if (!same(fstatSync(fd)) || !same(lstatSync(path))) throw new Error("ROBINHOOD_CATALOG_FILE_CHANGED");
    const bytes = Buffer.alloc(maximum + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (count === 0) break;
      length += count;
    }
    if (length > maximum) throw new Error("ROBINHOOD_CATALOG_UNSAFE_OR_OVERSIZED_FILE");
    if (length !== before.size || !same(fstatSync(fd)) || !same(lstatSync(path))) throw new Error("ROBINHOOD_CATALOG_FILE_CHANGED");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)));
  } finally { closeSync(fd); }
}
function validClock(value) {
  return typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

/** Anonymous HTTP reachability only. No MCP handshake, OAuth or tool invocation. */
export async function probeRobinhoodPublicEndpoint({ fetchImplementation = globalThis.fetch, now = () => new Date().toISOString(), timeoutMs = 12_000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 12_000) throw new Error("ROBINHOOD_PROBE_INVALID_TIMEOUT");
  const requestedAt = now();
  if (!validClock(requestedAt)) throw new Error("ROBINHOOD_PROBE_INVALID_CLOCK");
  const controller = new AbortController();
  let timer, observation;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("DEADLINE")); }, timeoutMs); });
  try {
    observation = await Promise.race([deadline, (async () => {
      const response = await fetchImplementation(ROBINHOOD_DATA_ENDPOINT, { method: "GET", credentials: "omit", redirect: "manual", signal: controller.signal,
        headers: { Accept: "application/json, text/event-stream", "User-Agent": "Alpha-Options-Research/0.3 (anonymous endpoint check)" } });
      const httpStatus = response.status, authenticationChallengePresent = response.headers.has("www-authenticate");
      if (response.body) await response.body.cancel();
      if (!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599 || response.redirected) throw new Error("UNEXPECTED_TRANSPORT");
      const status = httpStatus === 401 ? "AUTHENTICATION_REQUIRED" : httpStatus === 403 ? "ACCESS_DENIED"
        : httpStatus >= 300 && httpStatus < 400 ? "REDIRECT_REFUSED"
        : httpStatus >= 200 && httpStatus < 300 ? "ENDPOINT_RESPONDED_SCHEMA_UNVERIFIED" : "HTTP_UNAVAILABLE";
      return { status, httpStatus, authenticationChallengePresent };
    })()]);
  } catch {
    observation = { status: "NETWORK_UNAVAILABLE", httpStatus: null, authenticationChallengePresent: false };
  } finally { clearTimeout(timer); controller.abort(); }
  const finishedAt = now();
  if (!validClock(finishedAt) || finishedAt < requestedAt) throw new Error("ROBINHOOD_PROBE_INVALID_CLOCK");
  return { schemaVersion: "1.0", engineVersion: "ROBINHOOD_DATA_READINESS_V1", operation: "ANONYMOUS_HTTP_GET_ONLY", endpoint: ROBINHOOD_DATA_ENDPOINT,
    requestedAt, finishedAt, ...observation, requestCount: 1, responseBodyRead: false, authenticationAttempted: false, mcpSessionInitialized: false,
    meaning: "HTTP status only; no server tool schemas, quotes, data rights, account access or free-data entitlement were established.", ...ROBINHOOD_DATA_BOUNDARIES };
}

export async function runOptionsRobinhoodDataCommand(args, options = {}) {
  if (args.length === 0 || (args.length === 1 && args[0] === "--report")) return buildRobinhoodDataReadinessReport();
  if (args.length === 1 && args[0] === "--help") return { command: "options:robinhood-data", usage: "--report | --inspect-tools <local tools/list result JSON> | --probe-public | --help", ...ROBINHOOD_DATA_BOUNDARIES };
  if (args.length === 1 && args[0] === "--probe-public") return probeRobinhoodPublicEndpoint(options);
  if (args.length === 2 && args[0] === "--inspect-tools" && typeof args[1] === "string" && !args[1].startsWith("--")) {
    try { return assessRobinhoodToolCatalog(readCatalog(resolve(options.workspaceRoot ?? process.cwd(), args[1]))); }
    catch { throw new Error("ROBINHOOD_CATALOG_INPUT_REJECTED"); }
  }
  throw new Error("ROBINHOOD_DATA_UNSUPPORTED_COMMAND");
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const report = await runOptionsRobinhoodDataCommand(process.argv.slice(2));
    console.log(JSON.stringify(report, null, 2));
    if (["NETWORK_UNAVAILABLE", "HTTP_UNAVAILABLE", "ACCESS_DENIED", "REDIRECT_REFUSED"].includes(report.status)) process.exitCode = 3;
  } catch {
    console.error(JSON.stringify({ status: "ROBINHOOD_DATA_COMMAND_REJECTED", ...ROBINHOOD_DATA_BOUNDARIES })); process.exitCode = 2;
  }
}
