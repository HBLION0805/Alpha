import { reconcileManualLedger as run, validateManualLedgerCommand } from "./OptionsManualLedger";
import { manualDemoCommands, manualFill, manualRegistration, manualFixtureCreatedAt } from "./OptionsManualLedgerFixtures";
import type { ManualLedgerCommand, ManualLedgerInput } from "../../contracts/OptionsManualLedger";
let passed = 0;
const eq = (a: unknown,b: unknown) => { if(JSON.stringify(a)!==JSON.stringify(b)) throw Error("VALUES_DIFFER "+JSON.stringify([a,b])); };
const ok = (x: unknown) => { if(!x) throw Error("EXPECTED_TRUE"); };
function throws(fn:()=>unknown,code:string) { let error:unknown;try{fn();}catch(e){error=e;}if(!(error instanceof Error)||!error.message.includes(code))throw Error("EXPECTED_ERROR "+code); }
function test(name:string,fn:()=>void){fn();passed++;console.log("PASS "+name);}
const at="2026-09-07T20:00:00.000Z";
function ledger(commands=manualDemoCommands()): ManualLedgerInput { return {ledgerId:"test-ledger",origin:"SYNTHETIC_FIXTURE",createdAt:manualFixtureCreatedAt,events:commands.map((command,i)=>({sequence:i+1,recordedAt:at,savedAt:at,command}))}; }
const result = (c=manualDemoCommands())=>run(ledger(c),at);
const amend = (mutate:(c:any[])=>void) => { const c:any[]=manualDemoCommands();mutate(c);return c as ManualLedgerCommand[]; };
const codes = (r=result())=>r.trades[0]!.candidateLessons.map(l=>l.code);
test("empty owner ledger has no trades or broker balance",()=>{const r=run({...ledger([]),origin:"OWNER_REPORTED_UNVERIFIED"},at);eq(r.counts.trades,0);eq(r.accountBalanceUsd,null);eq(r.brokerVerified,false);eq(r.winProbability,null);});
test("FIFO partial close and fee remainder reconcile exactly",()=>{const t=result(manualDemoCommands().slice(0,3)).trades[0]!;eq(t.openContracts,2);eq(t.status,"PARTIALLY_CLOSED");eq(t.realizedNetPnlUsd,"4.986667");eq(t.remainingCostBasisUsd,"20.006667");eq(t.netCashFlowUsd,"-15.020000");});
test("final fee remainder closes every micro dollar",()=>{const t=result(manualDemoCommands().slice(0,5)).trades[0]!;eq(t.matches.map(m=>m.entryFeeAllocatedUsd),["0.003333","0.003333","0.003334"]);eq(t.closedTradeNetPnlUsd,"14.960000");eq(t.remainingCostBasisUsd,"0.000000");eq(t.netCashFlowUsd,t.realizedNetPnlUsd);});
test("correction recalculates all affected results and retains original history",()=>{const input=ledger(),before=JSON.stringify(input),r=run(input,at),t=r.trades[0]!;eq(t.closedTradeNetPnlUsd,"4.960000");eq(t.effectiveFills[3]!.revision,2);eq(r.eventCount,6);eq(JSON.stringify(input),before);ok(codes(r).includes("CORRECTED_RECORDS_REVIEW"));});
test("unknown entry fee retains gross but cannot invent net profit",()=>{const r=result(amend(c=>c[1].fill.feesUsd=null)),t=r.trades[0]!;eq(t.grossRealizedPnlUsd,"5.000000");eq(t.realizedNetPnlUsd,null);eq(t.remainingCostBasisUsd,"0.000000");eq(t.netCashFlowUsd,null);ok(codes(r).includes("FEES_UNKNOWN"));});
test("unknown close fees propagate independently",()=>{const t=result(amend(c=>c[2].fill.feesUsd=null)).trades[0]!;eq(t.entryFeesUsd,"0.010000");eq(t.exitFeesUsd,null);eq(t.closedTradeNetPnlUsd,null);});
test("explicit zero fees are preserved as zero",()=>{const c:any[]=manualDemoCommands().slice(0,5);for(const x of c)if(x.fill)x.fill.feesUsd="0";eq(result(c).trades[0]!.closedTradeNetPnlUsd,"15.000000");});
test("zero-price reported sale is retained without fabricated expiry settlement",()=>{const c:any[]=manualDemoCommands().slice(0,5);c[4].fill.pricePerShareUsd="0";const t=result(c).trades[0]!;eq(t.closedTradeNetPnlUsd,"-0.040000");ok(codes(result(c)).includes("NEGATIVE_REPORTED_OUTCOME"));});
test("unknown fees in a remaining lot do not contaminate a known earlier match",()=>{const c:any[]=manualDemoCommands().slice(0,2);c[1].fill.quantity=1;c.push({type:"RECORD_FILL",requestId:"buy-second",tradeId:c[0].tradeId,fillId:"second-lot",fill:manualFill(2,{action:"BUY_TO_OPEN",quantity:1,feesUsd:null,exitReason:"NOT_APPLICABLE"})},{type:"RECORD_FILL",requestId:"sell-first",tradeId:c[0].tradeId,fillId:"sell-first",fill:manualFill(3)});const t=result(c).trades[0]!;eq(t.realizedNetPnlUsd,"4.980000");eq(t.remainingCostBasisUsd,null);});
test("multiple opening lots and a closing fee allocate with conserved remainders",()=>{const c:any[]=manualDemoCommands().slice(0,2);c[1].fill.quantity=1;c.push({type:"RECORD_FILL",requestId:"buy-second",tradeId:c[0].tradeId,fillId:"second-lot",fill:manualFill(2,{action:"BUY_TO_OPEN",quantity:2,pricePerShareUsd:"0.12",exitReason:"NOT_APPLICABLE"})},{type:"RECORD_FILL",requestId:"sell-three",tradeId:c[0].tradeId,fillId:"sell-three",fill:manualFill(3,{quantity:3})});const t=result(c).trades[0]!;eq(t.matches.map(m=>m.closingFeeAllocatedUsd),["0.003333","0.006667"]);eq(t.closedTradeNetPnlUsd,"10.970000");});
test("void preserves fill history and reopens a partially closed position",()=>{const c:any[]=manualDemoCommands();c[5].replacement=null;const r=result(c);eq(r.counts.voidedFills,1);eq(r.trades[0]!.openContracts,1);eq(r.trades[0]!.closedTradeNetPnlUsd,null);});
for(const [name,mutate,code] of [
  ["oversell",(c:any[])=>c[2].fill.quantity=4,"OVERSELL"],
  ["missing buy",(c:any[])=>{c[5].fillId="fixture-fill-1";c[5].replacement=null;}, "OVERSELL"],
  ["stale revision",(c:any[])=>c[5].expectedRevision=2,"STALE_CORRECTION"],
  ["duplicate request",(c:any[])=>c[2].requestId=c[1].requestId,"DUPLICATE_REQUEST"],
  ["reused fill id",(c:any[])=>c[2].fillId=c[1].fillId,"FILL_ID_REUSED"],
  ["duplicate external ref",(c:any[])=>c[2].fill.externalExecutionRef=c[1].fill.externalExecutionRef,"DUPLICATE_EXECUTION_REF"],
  ["duplicate execution sequence",(c:any[])=>c[2].fill.executionSequence=1,"EXECUTION_ORDER"],
  ["regressed execution time",(c:any[])=>c[2].fill.executedAt="2026-09-01T13:00:00Z","EXECUTION_ORDER"],
  ["wrong symbol",(c:any[])=>c[0].contract.symbol="SPY","CONTRACT_SCOPE"],
  ["adjusted deliverable",(c:any[])=>c[0].contract.multiplier=10,"CONTRACT_SCOPE"],
  ["fractional quantity",(c:any[])=>c[1].fill.quantity=0.5,"COUNT"],
  ["short opening",(c:any[])=>c[1].fill.action="SELL_TO_OPEN","ACTION"],
  ["future execution",(c:any[])=>c[1].fill.executedAt="2026-09-08T00:00:00Z","FUTURE_EXECUTION"],
  ["negative fee",(c:any[])=>c[1].fill.feesUsd="-1","MONEY"],
  ["false buy exit reason",(c:any[])=>c[1].fill.exitReason="TARGET","EXIT_REASON"],
  ["new authority field",(c:any[])=>c[0].brokerVerified=true,"FIELDS"],
] as const)test(name+" fails closed",()=>throws(()=>result(amend(mutate)),code));
test("same-looking fills without distinct references remain reviewable",()=>{const c:any[]=manualDemoCommands().slice(0,4);c[2].fill.executedAt=c[3].fill.executedAt;c[2].fill.externalExecutionRef=null;c[3].fill.externalExecutionRef=null;const r=result(c);eq(r.counts.possibleDuplicateFills,2);eq(r.counts.activeFills,3);ok(codes(r).includes("POSSIBLE_DUPLICATE_FILL"));});
test("distinct external refs distinguish identical-looking partial fills",()=>{const c:any[]=manualDemoCommands().slice(0,4);c[2].fill.executedAt=c[3].fill.executedAt;eq(result(c).counts.possibleDuplicateFills,0);});
test("reopening a flat trade requires a new trade identity",()=>{const c:any[]=manualDemoCommands().slice(0,5);c.push({type:"RECORD_FILL",requestId:"reopen-order",tradeId:c[0].tradeId,fillId:"reopen-fill",fill:manualFill(5,{action:"BUY_TO_OPEN",exitReason:"NOT_APPLICABLE"})});throws(()=>result(c),"CLOSED_TRADE_REOPENED");});
test("later correction cannot pretend the plan was saved before entry",()=>{const r=result();eq(r.trades[0]!.planTiming,"RETROSPECTIVE_DECLARATION");});
test("durable receipt rather than registration start decides pre-entry evidence",()=>{const input=ledger(manualDemoCommands().slice(0,3));input.events[0]!.recordedAt="2026-09-01T13:59:00.000Z";input.events[0]!.savedAt="2026-09-01T14:01:01.000Z";eq(run(input,at).trades[0]!.planTiming,"RETROSPECTIVE_DECLARATION");input.events[0]!.savedAt="2026-09-01T14:00:00.000Z";eq(run(input,at).trades[0]!.planTiming,"LOCALLY_RECORDED_BEFORE_REPORTED_ENTRY");});
test("missing plan and evidence remain explicit",()=>{const r=result(amend(c=>{c[0].plan=null;c[1].fill.evidence=null;}));ok(codes(r).includes("PLAN_MISSING"));ok(codes(r).includes("DOCUMENT_EVIDENCE_MISSING"));eq(r.trades[0]!.realizedR,null);});
test("quantity budget and risk deviations produce candidate notes only",()=>{const r=result(amend(c=>{c[0].plan.maxContracts=1;c[0].plan.maxEntryDebitUsd="10";c[1].fill.pricePerShareUsd="1";}));for(const code of ["DECLARED_QUANTITY_EXCEEDED","DECLARED_ENTRY_DEBIT_EXCEEDED","ENTRY_DEBIT_EXCEEDS_50_USD_DIAGNOSTIC","CLOSED_LOSS_EXCEEDS_DECLARED_RISK"])ok(codes(r).includes(code));eq(r.executionAllowed,false);eq(r.approvedKnowledge,false);});
test("below-stop sale does not infer a stop-rule violation or intraday path",()=>{const r=result();ok(codes(r).includes("EXIT_PRICE_BELOW_DECLARED_STOP_NOT_PROOF_OF_VIOLATION"));eq(r.trades[0]!.stopTargetPathKnown,false);eq(r.trades[0]!.slippageUsd,null);});
test("expired open exposure never disappears automatically",()=>{const r=run(ledger(manualDemoCommands().slice(0,3)),"2026-09-21T14:00:00.000Z");eq(r.trades[0]!.openContracts,2);ok(codes(r).includes("PAST_EXPIRY_POSITION_UNRESOLVED"));eq(r.trades[0]!.unrealizedPnlUsd,null);});
test("invalid object accessors are rejected without evaluation",()=>{let hit=false;const c=manualRegistration();Object.defineProperty(c,"plan",{get(){hit=true;return null;}});throws(()=>validateManualLedgerCommand(c,at),"FIELDS");eq(hit,false);});
test("submillisecond execution order is preserved exactly",()=>{const c:any[]=manualDemoCommands().slice(0,3);c[1].fill.executedAt="2026-09-01T14:00:00.000000002Z";c[2].fill.executedAt="2026-09-01T14:00:00.000000001Z";throws(()=>result(c),"EXECUTION_ORDER");});
test("caller-owned commands remain mutable after a report is frozen",()=>{const input=ledger(),r=run(input,at);ok(Object.isFrozen(r));eq(Object.isFrozen(input.events[0]!.command),false);});
test("both ETF and option sides preserve the same reported-fill accounting",()=>{for(const symbol of ["GLD","IBIT"])for(const optionType of ["CALL","PUT"]){const c=amend(x=>{x[0].contract.symbol=symbol;x[0].contract.optionType=optionType;x[0].contract.strikeUsd=symbol==="GLD"?"410":"45";});const t=result(c).trades[0]!;eq(t.contract.symbol,symbol);eq(t.contract.optionType,optionType);eq(t.closedTradeNetPnlUsd,"4.960000");eq(t.openContracts,0);}});
test("document hashes reject coercible arrays instead of accepting a false typed reference",()=>{throws(()=>result(amend(c=>c[1].fill.evidence.documentSha256=["a".repeat(64)])),"DOCUMENT_HASH");});
console.log(`${passed}/${passed} tests passed.`);
