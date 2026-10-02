import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ps=readFileSync(new URL('./options-real-data-paper-runner.ps1',import.meta.url),'utf8');
const mcp=readFileSync(new URL('./options-real-data-paper-mcp.mjs',import.meta.url),'utf8');

assert(ps.includes("$date -ne '2026-10-08'"));
assert(ps.includes("2026-10-08T15:51:00")===false,'task start belongs to Task Scheduler, not a hidden runner clock');
assert(ps.includes("1550-run.json"));
assert(ps.includes("$source.status -ne 'PASS'"));
assert(ps.includes("$bridge --arm --workspace $alpha"));
assert(ps.includes("decisionAt"));
assert(ps.includes("timeExitAt"));
assert(ps.includes("alpha_paper_host prepare_capture exactly once"));
assert(ps.includes("alpha_paper_host accept_capture exactly once"));
for(const tool of ['get_option_chains','get_option_instruments','get_equity_quotes','get_option_quotes'])assert(ps.includes(tool));
for(const forbidden of ['get_account(','place_order(','submit_order(','get_positions('])assert(!ps.includes(forbidden));
assert(ps.includes("strategyValidationEligible=$false"));
assert(ps.includes("liveOrderAuthority=$false"));
assert(ps.includes("'NO_TRADE_VALID'"));
assert(ps.includes("'BLOCKED_DATA_INTEGRITY'"));
assert(ps.includes("'SYSTEM_FAILURE'"));
assert(ps.includes("'INCOMPLETE_EXPERIMENT'"));
assert(ps.includes("'PAPER_FILLED'"));
assert(ps.includes("No market, account, position, or order call was made."));

for(const name of ["name:'health'","name:'prepare_capture'","name:'accept_capture'"])assert(mcp.includes(name));
assert(!mcp.includes("get_account"));
assert(!mcp.includes("place_order"));
assert(mcp.includes("No brokerage calls are made"));
console.log('Real-data paper runner boundary tests passed');
