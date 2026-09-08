# Alpha options workbench

Daily guidance is now the default seventh page. It shows the current conditional
view, attributed news interpretation, event waiting windows, bounded contract
candidates, indicative stops/targets and immutable issued history. Declare fees
and slippage explicitly before expecting net-R targets. Inspect a candidate in
the existing planner; this never sends an order. Discard changes clears only an
unsaved guidance-assumption draft. See [delivery](OPTIONS_DAILY_GUIDANCE_DELIVERY.md).

While the local workbench process runs, public headlines/BTC refresh hourly and
Treasury/BLS/FOMC refresh daily after 09:00 New York. The browser reads local
updates every minute while visible and idle; it preserves drafts and open dialogs.
Robinhood quote reads require the separately configured Host schedule. Neither
an open browser nor a successful past login guarantees current option quotes.

Double-click [Start Alpha.cmd](<../Start Alpha.cmd>) in this checkout, or run:

```powershell
npm run options:workbench
```

Open **http://127.0.0.1:4173** in a browser. The double-click launcher starts a
hidden local Node service, checks the workspace and owner-ledger identity, and
opens the browser. It reuses an existing matching service. Node 24.12 or newer
and the repository dependencies are required; install missing dependencies with
`npm ci`. No paid service or new package was added for this frontend.

The terminal command runs in the foreground; Ctrl+C stops that instance. A
different development port can be selected with
`npm run options:workbench -- --port 4174`. Do not run multiple writers against
one ledger. The workbench does not start with Windows or create a scheduled task.

## Pages

| Page | What you can do | Meaning of the data |
| --- | --- | --- |
| Overview | Inspect the two ETFs, saved coverage, upcoming events and ten-workstream/six-gate progress | The $1,000 baseline and $50 allocation are declared planning values, not account balances |
| Options & activity | Select a saved board, filter ETF/expiry/side/strike, sort, paginate, open contract details and copy a scenario | Original quote clocks, unknown counter dates and unconfirmed activity explanations stay visible |
| Trade planner | Calculate whole-contract premium, costs, planned loss, net R, indicative target and blockers | Existing long-call/long-put feasibility rules, including the separate stress cap, remain unchanged |
| Trade journal | Register trades, optionally record plans/activity links, enter fills, correct or void records | Owner-reported records; no brokerage verification or order placement |
| Reviews & lessons | Review open/closed cases, original corrections, separate paper/research cases and candidate lessons | Descriptive accounting and process diagnostics; no established market cause or strategy probability |
| News & calendar | Search saved headlines, inspect source health, Treasury/BTC observations and official calendars | Reload reads saved journals; it does not refresh a source or establish complete event coverage |

## Recording a trade

1. Register a unique lowercase trade ID, ETF, option side, expiration and strike.
   Leave the optional plan absent if no original plan is available. UTC plan
   timestamps use three fractional digits; actual execution timestamps retain up
   to nine. A later-recorded declaration remains retrospective.
2. Preview the registration, then **Save local record**. A registration creates
   no fill. The default ledger is `owner-manual-gld-ibit`.
3. On **Record fill**, select the registered trade. Enter a unique fill ID, the
   execution sequence within the trade, actual UTC timestamp, whole quantity,
   per-share premium and total fee for that fill. A blank fee remains unknown.
   Optional execution/document references help later reconciliation; no document
   is uploaded and a digest does not authenticate it.
4. Preview the recomputed position and costs, then save. Partial sales leave the
   remaining exposure visible. Review the resulting candidate notes.
5. On **Correct / void**, select the trade and fill, explain the change and preview
   its effect. The revision is checked again on save. Voiding preserves original
   events and may be rejected if it would make subsequent sales inconsistent.

Plans transferred from the calculator are editable declarations. Check the
contract, times and thesis. The copied entry-debit ceiling includes the entire
declared round-trip fee reserve conservatively; replace it with the intended
entry-cost allowance when known. Entering a scenario or a reported fill does not
authenticate quotes, account eligibility, an execution or a stop trigger.

## Drafts, reloads and recovery

- Navigation within the tab retains each form draft. Drafts are kept in memory,
  not persisted to the browser. Closing a tab with unsaved edits triggers the
  browser's normal unsaved-change prompt; clearing a draft is explicit.
- **Reload saved data** recovers local stores. Original quote refresh, publication,
  receipt and execution times do not change. Source errors are isolated to their
  affected panels. An unreadable latest board requires an explicit choice rather
  than silently falling back to old evidence.
- An interrupted save may already have completed. Retry the same preview; its
  request ID is preserved and a recorded request is a no-op. If the local server
  restarted, close the preview, reload, and preview the retained draft again.
- The server rejects a new save when its reviewed ledger head has changed. Return
  to the draft and preview again. This is a local single-process interface, not a
  multi-user transaction service; use the existing CLI writer locks and avoid
  simultaneous independent writers.
- JSON downloads contain the selected evidence report and original clocks. They
  exclude the process session token. Existing immutable evidence packages remain
  the full export/recovery mechanism; downloads do not replace them.

Saved manual events live under `data/runtime/options-manual-ledger`. Original
workbench command inputs live under `data/runtime/options-workbench-inputs`.
Launcher logs are under `data/runtime/options-workbench-development`. These
directories are Git-ignored. No original source journal is rewritten.

The default service is loopback-only. There is no account, order, arbitrary file,
shell or market-refresh route. Keep it local; remote hosting and multi-user
authentication are outside this phase. See the [specification](specifications/OPTIONS_WORKBENCH_V1.md)
and [delivery evidence](OPTIONS_WORKBENCH_DELIVERY.md).
