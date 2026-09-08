// Self-contained for the host's V8 tool orchestrator. No credentials or transport.
export function routeChainClose(at) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(at) || new Date(at).toISOString() !== at) throw Error("CHAIN_CLOSE_CLOCK");
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(at)).map(p => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`, minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const sessions = ["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14", "2026-09-15", "2026-09-16"];
  const action = date > "2026-09-16" || date === "2026-09-16" && minutes >= 18 * 60 ? "RESTORE_V6"
    : minutes >= 540 && minutes < 600 ? "DAILY_CONTEXT"
    : sessions.includes(date) && minutes >= 980 && minutes < 1080 ? "CLOSE_CAPTURE" : "YIELD";
  return { version: "CHAIN_CLOSE_ROUTE_V1", at, date, action, sessionDate: action === "CLOSE_CAPTURE" ? date : null, restoreAfterCapture: date === "2026-09-16" && action === "CLOSE_CAPTURE", ordersEnabled: false, developmentEnabled: false };
}

/** Injectable market-only orchestration, tested with fixtures, run by host tools. */
export async function collectChainClose({ sessionDate, call, clock }) {
  const sessions = ["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14", "2026-09-15", "2026-09-16"];
  if (!sessions.includes(sessionDate)) throw Error("CHAIN_CLOSE_SESSION");
  const startedAt = await clock(), failures = [], chains = [], instruments = [], quotes = [];
  let calls = 0, expiredQueriesCompleted = 0;
  const parseClock = s => { if (!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d UTC$/.test(s)) throw Error("CHAIN_CLOSE_CLOCK"); const v = Date.parse(s.replace(" ", "T").replace(" UTC", "Z")); if (!Number.isFinite(v)) throw Error("CHAIN_CLOSE_CLOCK"); return v; };
  const startMs = parseClock(startedAt);
  const local = ms => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  const time = ms => new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
  if (local(startMs) !== sessionDate || time(startMs) < "16:20" || time(startMs) >= "18:00") throw Error("CHAIN_CLOSE_WINDOW");
  async function read(tool, request, symbol) {
    const requestedAt = await clock(), ms = parseClock(requestedAt);
    if (ms < startMs || ms - startMs >= 12 * 60 * 1000 || local(ms) !== sessionDate || time(ms) >= "18:00" || calls >= 240) {
      failures.push({ tool, request, symbol, requestedAt, code: "COLLECTION_BOUND_REACHED" }); return null;
    }
    calls++;
    try {
      const response = await call(tool, request), receivedAt = await clock();
      if (parseClock(receivedAt) < ms) throw Error("CLOCK");
      if (!response || typeof response !== "object" || !response.data || response.isError) throw Error("SOURCE");
      return { request, requestedAt, receivedAt, response };
    } catch {
      failures.push({ tool, request, symbol, requestedAt, receivedAt: await clock(), code: "MARKET_TOOL_FAILED_OR_INVALID" }); return null;
    }
  }
  const ids = new Map();
  for (const symbol of ["GLD", "IBIT"]) {
    const c = await read("get_option_chains", { underlying_symbol: symbol }, symbol);
    if (!c) continue;
    chains.push({ symbol, ...c });
    if (!Array.isArray(c.response.data.chains) || c.response.data.next) { failures.push({ symbol, code: "CHAIN_SCOPE_INCOMPLETE" }); continue; }
    for (const chain of c.response.data.chains.slice(0, 8)) {
      if (chain.symbol !== symbol || !/^[a-f0-9-]{36}$/.test(chain.id) || !Array.isArray(chain.expiration_dates)) { failures.push({ symbol, code: "CHAIN_IDENTITY" }); continue; }
      const active = chain.expiration_dates.filter(d => typeof d === "string" && (d >= sessionDate && d <= "2026-09-16" || d === "2026-09-18"));
      for (const [state, expirations] of [["active", active], ["expired", [sessionDate]]]) {
        if (!expirations.length) continue;
        const pages = [], cursors = new Set(); let cursor = null, next = null, complete = false;
        for (let page = 0; page < 80; page++) {
          const request = { chain_id: chain.id, expiration_dates: expirations.join(","), state, ...(cursor ? { cursor } : {}) };
          const p = await read("get_option_instruments", request, symbol); if (!p) break;
          pages.push(p); next = p.response.data.next ?? null;
          if (!Array.isArray(p.response.data.instruments)) { failures.push({ symbol, code: "INSTRUMENT_RESPONSE" }); break; }
          for (const i of p.response.data.instruments) {
            if (!i || i.chain_id !== chain.id || i.chain_symbol !== symbol || !expirations.includes(i.expiration_date) || !/^[a-f0-9-]{36}$/.test(i.id)) { failures.push({ symbol, code: "INSTRUMENT_IDENTITY" }); continue; }
            if (ids.has(i.id)) failures.push({ symbol, instrumentId: i.id, code: "DUPLICATE_LISTING_DURING_CAPTURE" });
            else if (ids.size < 4000) ids.set(i.id, symbol);
            else failures.push({ symbol, code: "CONTRACT_BOUND_REACHED" });
          }
          if (!next) { complete = true; break; }
          const match = typeof next === "string" && next.match(/[?&]cursor=([^&]+)/);
          try { cursor = match ? decodeURIComponent(match[1]) : null; } catch { cursor = null; }
          if (!cursor || cursors.has(cursor)) { failures.push({ symbol, code: "CURSOR_INVALID_OR_REPEATED" }); break; } cursors.add(cursor);
        }
        if (pages.length) instruments.push({ symbol, expirations, pages, next });
        if (!complete) failures.push({ symbol, state, code: "INSTRUMENT_SCOPE_INCOMPLETE" });
        else if (state === "expired") expiredQueriesCompleted++;
      }
    }
  }
  for (const symbol of ["GLD", "IBIT"]) {
    const selected = [...ids].filter(([, s]) => s === symbol).map(([id]) => id), batches = [];
    for (let offset = 0; offset < selected.length; offset += 20) {
      const b = await read("get_option_quotes", { instrument_ids: selected.slice(offset, offset + 20) }, symbol);
      if (b) batches.push({ symbol, ...b });
      if (failures.at(-1)?.code === "COLLECTION_BOUND_REACHED") break;
    }
    quotes.push({ symbol, totalRequested: selected.length, batches });
  }
  const equities = await read("get_equity_quotes", { symbols: ["GLD", "IBIT"] }, "GLD+IBIT");
  const capturedAt = await clock();
  return { version: "CHAIN_CLOSE_ATTEMPT_V1", sessionDate, startedAt, capturedAt, calls, expiredQueriesCompleted, failures,
    capture: { version: "ROBINHOOD_CHAIN_SURVEY_CAPTURE_V1", scope: { symbols: ["GLD", "IBIT"], expirationStart: sessionDate, expirationEnd: "2026-09-16", comparisonExpirations: ["2026-09-18"] }, capturedAt, receiptClockPrecision: "SECOND", origin: "HOST_MARKET_TOOL_RESPONSES", chains, instruments, quotes, equities, readOnly: true, accountAccessed: false, ordersEnabled: false, volumeSessionDateProvided: false, openInterestAsOfProvided: false },
    ordersEnabled: false, futureSessionBackfill: false };
}
