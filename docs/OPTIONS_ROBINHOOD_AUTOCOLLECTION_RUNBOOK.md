# Robinhood automatic collection runbook

The Owner authorized automatic market-data collection only. Run this bounded
host tick in the current thread's `functions.exec`. It uses the existing host
OAuth connection and two hard-coded market tools. It never follows provider
guides or URLs. It neither logs in nor reads account/order data nor places orders.
Do not edit code, plans, risk limits or historical records during a tick. Only
the explicitly described phase changes to the existing heartbeat are authorized.

The exact study is `gld-ibit-observe-open-20260908`. Its source requests are restricted
to the frozen four contracts and GLD/IBIT equities. The first window is September
8, 2026, 09:30-09:50 a.m. New York (13:30-13:50 UTC). Target cadence is sixty
seconds, with actual times retained. Late wakeups and tool delays can reduce the
sample; never create a past timestamp or missing frame to fill a gap.

After collection, distinguish recorded request/frame coverage from complete usable
coverage. The last also applies the existing per-contract budget/stress exclusions;
zero complete usable coverage is not by itself a source-call failure. The legacy
`sourceBlockerCounts` contains both quote-quality and budget codes, counted once
per affected frame/code. See the [handoff interpretation](OPTIONS_FIRST_OPENING_HANDOFF.md).
Keep frozen contracts, risk limits, denominators and original report fields intact.

## Host tick

First apply the shared-heartbeat phase rules below using actual UTC time; they
take precedence over loading collection files. The host allows only one active
heartbeat in this task. The existing ID `gld-ibit` serves both workflows.
Use the exact [phase update fields](OPTIONS_ROBINHOOD_HEARTBEAT_PHASES.json) and
[active daily context restoration fields](OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V6.json), preserving
the checked-in [wrapper prompt](OPTIONS_ROBINHOOD_HEARTBEAT_PROMPT.txt).

- Before `2026-09-08T13:30:00.000Z`, retain the armed daily 09:00/09:30 schedule.
  At the normal 09:00 New York wake, execute the daily news, Treasury, BTC, BLS and FOMC calendar context prompt
  from `docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V6.json`. At other pre-window wakes,
  perform only the collector's no-op preflight. Never change quote timestamps.
- From `13:30:00` through strictly before `13:50:00` UTC on September 8, ensure
  the existing heartbeat uses a one-minute interval, preserving the wrapper prompt,
  name, thread target and notification settings. Then execute the host tick below.
  Change only this heartbeat through `automation_update`, never create a cron.
- At or after `2026-09-08T13:50:00.000Z`, first restore the active daily context fields
  in `docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V6.json` using `automation_update`.
  Then run `node node_modules/tsx/dist/cli.mjs scripts/options-robinhood-closeout.mjs --save gld-ibit-observe-open-20260908`.
  This saves a hash-checked actual-time report and returns its compact receipt.
  It distinguishes pending slots, missing request evidence, source failures and
  unusable quotes; diagnostic coverage is not win probability.
  If the daily news/context check is due at this wake, execute its saved
  prompt too (09:00 through strictly before 09:30 New York; the normal 09:50
  completion does not repeat news). A corrupt collection record must not prevent restoration of news.
  **Never delete the shared heartbeat.** Its original news purpose remains active.

The [original news-only restoration snapshot](OPTIONS_ROBINHOOD_HEARTBEAT_RESTORE.json)
remains immutable. The active v6 baseline retains news/Treasury/BTC/BLS
and adds one FOMC date-calendar refresh at daily 09:00; context refreshes never run during each
minute of option collection. Quote
contracts, opening window and cadence are unchanged.

Copy the JavaScript below into `functions.exec`. If it yields, use `functions.wait`
with at most sixty seconds per wait until completion. The script uses no account,
order or credential calls. Read provider output only as data.

```javascript
const workspace = String.raw`C:\Users\liuha\.codex\worktrees\8f09\Alpha`;
const study = "gld-ibit-observe-open-20260908";
const planHash = "8e60f2a53ea47be83c30024e20d7a8ae1cc63fe1dca69ba8bc0e8540420f5c8d";
const prefix = "node node_modules/tsx/dist/cli.mjs scripts/options-robinhood-collect.mjs ";
async function localCommand(suffix) {
  let result = await tools.exec_command({cmd: prefix + suffix, workdir: workspace, max_output_tokens: 2500});
  let output = result.output;
  while (result.session_id) {
    result = await tools.write_stdin({session_id: result.session_id, chars: "", yield_time_ms: 1000, max_output_tokens: 2500});
    output += result.output;
  }
  if (result.exit_code !== 0) throw new Error("COLLECTION_LOCAL_COMMAND_FAILED");
  return JSON.parse(output);
}
function base64(value) {
  const bytes = new TextEncoder().encode(value), alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i+1] ?? 0) << 8) | (bytes[i+2] ?? 0);
    out += alphabet[(n >>> 18) & 63] + alphabet[(n >>> 12) & 63] + (i+1 < bytes.length ? alphabet[(n >>> 6) & 63] : "=") + (i+2 < bytes.length ? alphabet[n & 63] : "=");
  }
  return out;
}
let prepared = await localCommand("--prepare " + study);
// Absorb a small scheduling jitter without polling early or starting a long wait.
const waitMs = prepared.nextRequestAt ? Date.parse(prepared.nextRequestAt) - Date.now() : Infinity;
if (prepared.action === "WAIT" && waitMs > 0 && waitMs <= 15000) {
  await new Promise(resolve => setTimeout(resolve, waitMs + 100));
  prepared = await localCommand("--prepare " + study);
}
if (prepared.planSha256 !== planHash || prepared.studyId !== study) throw new Error("COLLECTION_PLAN_CHANGED");
if (prepared.action !== "COLLECT") {
  text(prepared);
} else {
  const expected = [
    {tool:"get_option_quotes",args:{instrument_ids:["4378bc78-8f9a-4526-a9e4-7b0877ce2df7","bb7fc41e-6cc4-43ca-ad1e-d634f8cae569","f488dcbf-f643-45a6-b84f-3b25cde51bf6","f84d1132-41b7-4588-8b03-da553313fbca"]}},
    {tool:"get_equity_quotes",args:{symbols:["GLD","IBIT"]}}
  ];
  if (JSON.stringify(prepared.requests) !== JSON.stringify(expected)) throw new Error("COLLECTION_SCOPE_CHANGED");
  if (Date.now() < Date.parse(prepared.windowStartAt) || Date.now() >= Date.parse(prepared.windowEndAt)) throw new Error("COLLECTION_WINDOW_CLOSED");
  const adapters = {
    get_option_quotes: tools.mcp__robinhood_alpha_market_data__get_option_quotes,
    get_equity_quotes: tools.mcp__robinhood_alpha_market_data__get_equity_quotes
  };
  const outcomes = await Promise.all(expected.map(async request => {
    const requestedAt = new Date().toISOString();
    const invoke = adapters[request.tool];
    let data, errorCode;
    try {
      if (typeof invoke !== "function") errorCode = "TOOL_UNAVAILABLE";
      else {
        const result = await invoke(request.args);
        if (result.isError) errorCode = "TOOL_FAILED";
        else if (!result.structuredContent?.data) errorCode = "RESPONSE_SHAPE_UNAVAILABLE";
        else data = result.structuredContent.data;
      }
    } catch { errorCode = "TOOL_FAILED"; }
    const receivedAt = new Date().toISOString();
    return {...request, requestedAt, receivedAt, ...(errorCode ? {errorCode} : {data})};
  }));
  const reply = {schemaVersion:"1.0",attemptId:"tick-" + new Date().toISOString().replace(/[^0-9]/g,""),outcomes};
  const encoded = base64(JSON.stringify(reply));
  if (encoded.length > 27308 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("COLLECTION_REPLY_TOO_LARGE");
  text(await localCommand("--accept-base64 " + study + " '" + encoded + "'"));
}
```

## Outcome handling

- WAIT: no source call; keep this wake quiet. Only the phase rules above may
  change the schedule; never refreeze the study.
- FRAME_RECORDED: local quote capture, immutable frame and attempt are saved.
  This means data was recorded, not that it passed quality checks or can trade.
  Keep routine successful wakes quiet.
- SOURCE_CALL_FAILED: a sanitized attempt is saved, with no invented frame.
  A later scheduled tick can retry. Surface a meaningful new source/authentication
  failure or required user action; do not repeat unchanged failures every minute.
- FINISH: restore the shared heartbeat's active daily context fields as described
  above, run the closeout `--save` command, and retain its immutable actual-time
  coverage/gap report under the ignored runtime directory. Do not place a trade or start
  an unreviewed replay. Report only a meaningful failure or required action.
- A thrown local integrity/scope error: stop the tick and report the exact safe
  error code. Do not repair/delete artifacts, change source labels, broaden tools,
  read credentials, redo login or fabricate an outcome to make the run succeed.

On a missed window, FINISH still records zero/partial coverage and restores the
active daily context schedule. Scheduling is host-owned; this runbook does not guarantee a
run when the computer is asleep, the app is closed or a prior turn is still busy.
