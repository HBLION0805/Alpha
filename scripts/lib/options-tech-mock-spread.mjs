import {createIsolatedMockJournal} from './options-isolated-mock-journal.mjs';
import {assessTechPaperFeasibility,TECH_PAPER_SCOPE} from './options-tech-paper-feasibility.mjs';
import {assessSnapshotQuote,snapshotNs,snapshotCents} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {inferOptionsStructure,structureQuotedEconomics,structureTerminalPayoff} from '../../src/engines/options-structure-comparison/OptionsStructureComparisonEngine.ts';
import {engineeringObservationPolicy} from './options-real-data-paper-timing.mjs';
import {validateMockSpreadPlanBinding,validateMockSpreadEventBinding} from './options-tech-spread-plan-binding.mjs';

const check=(ok,code)=>{if(!ok)throw Error('SPREAD_MOCK_'+code);};
const keys=(o,k)=>check(o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join()===k.split(' ').sort().join(),'FIELDS');
const integer=(v,min=0,max=100000000)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const clock=snapshotNs;
const identity=['id','symbol','expiry','type','strike','multiplier','deliverable','exerciseStyle','tradability'];
const mapLeg=l=>({side:l.role==='LONG'?'BUY':'SELL',contract:{contractId:l.contract.id,optionType:l.contract.type.toUpperCase(),strikePriceCents:snapshotCents(l.contract.strike)},quote:null});
const product=s=>s==='CDS'?'BULL_CALL_DEBIT':'BEAR_PUT_DEBIT';

function validateStart(p){
 const bound=p?.version==='TECH_MOCK_DEBIT_SPREAD_V2';
 keys(p,'version mode executionModel candidate research structure decisionAt entryDeadlineAt timeExitAt quantity legs entryDebitLimitCents maxLegSpreadCents account'+(bound?' provenance':''));
 check(['TECH_MOCK_DEBIT_SPREAD_V1','TECH_MOCK_DEBIT_SPREAD_V2'].includes(p.version)&&p.mode==='MOCK'&&p.executionModel==='ATOMIC_TWO_LEG_ASSUMPTION','MODE');
 keys(p.candidate,'id symbol origin');
 check(p.candidate.origin==='SYNTHETIC_FIXTURE'&&/^mock-[a-z0-9-]{1,60}$/.test(p.candidate.id)&&TECH_PAPER_SCOPE.includes(p.candidate.symbol)&&p.research.symbol===p.candidate.symbol,'CANDIDATE');
 check(['PDS','CDS'].includes(p.structure)&&p.quantity===1&&Array.isArray(p.legs)&&p.legs.length===2,'SUPPORTED_STRUCTURE');
 const roles=new Set(),ids=new Set();
 for(const l of p.legs){
  keys(l,'role quantity contract entryFeeCents exitFeeCents exitSlippageCents');
  check(['LONG','SHORT'].includes(l.role)&&!roles.has(l.role)&&l.quantity===p.quantity,'EQUAL_LEG_QUANTITY');roles.add(l.role);
  keys(l.contract,identity.join(' '));const c=l.contract;
  check(typeof c.id==='string'&&c.id.length>0&&c.id.length<=100&&!ids.has(c.id)&&c.symbol===p.candidate.symbol&&['call','put'].includes(c.type)&&c.multiplier===100&&integer(snapshotCents(c.strike),1)&&c.deliverable==='STANDARD_100_SHARES_USD'&&c.exerciseStyle==='AMERICAN'&&c.tradability==='tradable','CONTRACT');ids.add(c.id);
  clock(c.expiry+'T00:00:00.000Z');check(/^\d{4}-\d\d-\d\d$/.test(c.expiry),'EXPIRY');
  for(const k of ['entryFeeCents','exitFeeCents','exitSlippageCents'])check(l[k]===null||integer(l[k],0,10000),'COST');
 }
 check(p.legs[0].contract.expiry===p.legs[1].contract.expiry&&p.legs[0].contract.type===p.legs[1].contract.type&&snapshotCents(p.legs[0].contract.strike)!==snapshotCents(p.legs[1].contract.strike),'COMMON_EXPIRY_AND_TYPE');
 check(inferOptionsStructure(p.legs.map(mapLeg))===product(p.structure),'STRIKE_ORIENTATION');
 const decision=clock(p.decisionAt),end=clock(p.timeExitAt);clock(p.entryDeadlineAt);
 check(clock(p.research.asOf)<decision&&clock(p.research.researchPlan.registeredAt)<=clock(p.research.asOf),'FROZEN_BEFORE_DECISION');
 const chain={lateCloseState:'disabled',chainId:'mock',receivedAt:p.research.asOf};
 const policy=engineeringObservationPolicy(new Date(Number((decision-30000000000n)/1000000n)).toISOString(),chain);
 check(policy.sufficient&&clock(p.entryDeadlineAt)===decision+120000000000n&&end===decision+420000000000n,'EXISTING_INTRADAY_WINDOW');
 const session=paperSession(p.decisionAt,chain);
 check(session.isOpen&&paperSession(p.timeExitAt,chain).isOpen&&session.date===paperSession(p.timeExitAt,chain).date&&p.legs[0].contract.expiry>session.date,'PRE_EXPIRY_SAME_DAY_ONLY');
 check(integer(p.entryDebitLimitCents,1,100000)&&integer(p.maxLegSpreadCents,1,10000),'LIMITS');
 const a=p.account;keys(a,'mode id currency provider permission products dataEntitlement settledCashCents reservedCashCents maximumLossCents tradeBudgetMaxCents reviewedAt validThrough'+(bound?' unsettledCashCents':''));
 check(a.mode==='MOCK'&&a.id==='MOCK'&&a.currency==='USD'&&a.provider==='SYNTHETIC_TEST_ONLY'&&['PASS','UNKNOWN','DENIED'].includes(a.permission)&&['PASS','UNKNOWN','DENIED'].includes(a.dataEntitlement)&&Array.isArray(a.products)&&a.products.every(x=>['PDS','CDS'].includes(x)),'MOCK_ACCOUNT');
 for(const k of ['settledCashCents','reservedCashCents','maximumLossCents','tradeBudgetMaxCents'])check(a[k]===null||integer(a[k]),'ACCOUNT_MONEY');
 if(bound){check(integer(a.unsettledCashCents),'UNSETTLED_MONEY');validateMockSpreadPlanBinding(p);}
 check(clock(a.reviewedAt)<=clock(p.research.asOf)&&clock(a.validThrough)>=end,'ACCOUNT_CLOCK');
 return p;
}
function validateEvent(e){
 const bound=e?.version==='TECH_MOCK_SPREAD_BATCH_EVENT_V1';
 keys(e,'id origin quote'+(bound?' version provenance':''));check(/^mock-[a-z0-9-]{1,60}$/.test(e.id)&&e.origin==='SYNTHETIC_FIXTURE','EVENT_ORIGIN');
 if(bound)validateMockSpreadEventBinding(e);
 keys(e.quote,'receivedAt source executionState action legs');const q=e.quote;
 clock(q.receivedAt);check(new Date(q.receivedAt).toISOString()===q.receivedAt,'RECEIPT_PRECISION');
 check(q.source==='SYNTHETIC_TEST_ONLY'&&['ATOMIC_QUOTE_PAIR','PARTIAL_FILL','SINGLE_LEG_FILL'].includes(q.executionState)&&['OBSERVE','CLOSE'].includes(q.action)&&Array.isArray(q.legs)&&q.legs.length<=2,'EVENT');
}
function pair(p,e,high){
 const errors=[],q=e.quote,quotes=p.legs.map(l=>q.legs.find(x=>x?.id===l.contract.id));
 if(q.legs.length!==2||quotes.some(x=>!x)||new Set(q.legs.map(x=>x?.id)).size!==2)return {errors:['BOTH_EXACT_LEG_QUOTES_REQUIRED'],quotes};
 for(const [i,x]of quotes.entries()){
  const l=p.legs[i];
  if(!identity.every(k=>x[k]===l.contract[k]))errors.push('LEG_IDENTITY_CHANGED');
  try{
   if(x.receivedAt!==q.receivedAt||x.chainSession?.lateCloseState!=='disabled')errors.push('LEG_RECEIPT_OR_SESSION');
   const assessment=assessSnapshotQuote(x,q.receivedAt,true,true);errors.push(...assessment.blockers);if(assessment.staleNow)errors.push('STALE_NOW');
   const source=clock(x.updatedAt);if(source<=clock(p.decisionAt))errors.push('SOURCE_PRECEDES_DECISION');
   if(high.has(x.id)&&source<=high.get(x.id))errors.push('REPEATED_OR_REGRESSED_LEG_SOURCE');
   if(!high.has(x.id)||source>high.get(x.id))high.set(x.id,source);
   if(!integer(x.tickCents,1,100)||l.exitSlippageCents!==null&&l.exitSlippageCents<x.tickCents)errors.push('TICK_OR_SLIPPAGE_RESERVE');
  }catch{errors.push('LEG_QUOTE_INVALID');}
 }
 if(new Set(quotes.map(x=>x.updatedAt)).size!==1||new Set(quotes.map(x=>x.underlyingAt)).size!==1||new Set(quotes.map(x=>x.underlyingPriceUsd)).size!==1)errors.push('UNSYNCHRONIZED_LEG_QUOTES');
 return {errors:[...new Set(errors)],quotes};
}
export function replayMockSpread(p,events,asOf){
 validateStart(p);check(clock(asOf)>=clock(p.research.asOf),'AS_OF');
 const a=p.account,available=a.settledCashCents===null||a.reservedCashCents===null?null:a.settledCashCents-a.reservedCashCents;
 const costsKnown=p.legs.every(l=>['entryFeeCents','exitFeeCents','exitSlippageCents'].every(k=>integer(l[k])));
 const entryFees=costsKnown?p.legs.reduce((n,l)=>n+l.entryFeeCents,0):null,exitFees=costsKnown?p.legs.reduce((n,l)=>n+l.exitFeeCents,0):null;
 const slippage=costsKnown?p.legs.reduce((n,l)=>n+l.exitSlippageCents*100*p.quantity,0):null;
 const frozenBlockers=[];if(a.permission!=='PASS'||!a.products.includes(p.structure))frozenBlockers.push('MOCK_SPREAD_PERMISSION_NOT_PASSED');
 if(a.dataEntitlement!=='PASS')frozenBlockers.push('MOCK_ENTITLEMENT_NOT_PASSED');
 if(available===null||available<0)frozenBlockers.push('MOCK_FUNDS_UNKNOWN_OR_INVALID');
 if(!integer(a.maximumLossCents,1)||!integer(a.tradeBudgetMaxCents,1))frozenBlockers.push('MOCK_RISK_LIMITS_UNKNOWN');
 if(!costsKnown)frozenBlockers.push('COSTS_UNKNOWN');
 const high=new Map(),orders=[],diagnostics=[];let pendingExit=null,residual=false,entry=null,exit=null,terminal=null,last=null,gap=false;
 for(const e of events){
  validateEvent(e);check(p.version==='TECH_MOCK_DEBIT_SPREAD_V2'?e.provenance?.parentPlanSha256===p.provenance.planSha256:!e.version,'BOUND_EVENT_PLAN');const q=e.quote;if(clock(q.receivedAt)>clock(asOf))continue;
  if(q.executionState!=='ATOMIC_QUOTE_PAIR'){residual=true;diagnostics.push({eventId:e.id,codes:['PARTIAL_OR_RESIDUAL_EXECUTION_UNSUPPORTED'],actualResidualExposure:'UNMODELED_NOT_CLEARED'});continue;}
  if(paperSession(q.receivedAt).date!==paperSession(p.decisionAt).date){diagnostics.push({eventId:e.id,codes:['OVERNIGHT_UNSUPPORTED']});continue;}
  if(last&&entry&&!exit&&clock(q.receivedAt)-clock(last)>60000000000n)gap=true;last=q.receivedAt;
  if(residual){diagnostics.push({eventId:e.id,codes:['UNSUPPORTED_RESIDUAL_LATCHED']});continue;}
  if(exit){diagnostics.push({eventId:e.id,codes:['ALREADY_CLOSED_NO_NEW_FILL']});continue;}
  if(entry&&(q.action==='CLOSE'||clock(q.receivedAt)>=clock(p.timeExitAt)))pendingExit??=q.action==='CLOSE'?'EXPLICIT_MOCK_CLOSE':'TIME_EXIT';
  const {errors,quotes}=pair(p,e,high),codes=[...errors];
  if(!entry){
   codes.push(...frozenBlockers);if(q.action==='CLOSE')codes.push('CLOSE_WITHOUT_POSITION');
   if(clock(q.receivedAt)<=clock(p.decisionAt)||clock(q.receivedAt)>clock(p.entryDeadlineAt))codes.push('ENTRY_WINDOW');
   const research=assessTechPaperFeasibility({research:p.research,at:q.receivedAt}).research;
   if(research.trial.status!=='PRE_CONFIRMATION_RESEARCH_CANDIDATE'||research.direction!==(p.structure==='CDS'?'UP':'DOWN'))codes.push('TRIAL_RESEARCH_OR_DIRECTION');
  }
  if(!errors.length){
   for(const x of quotes){
    if(!entry&&(x.askSize<p.quantity||x.bidSize<p.quantity))codes.push('ENTRY_AND_CLOSING_SIZE_REQUIRED');
    const max=Math.max(x.tickCents,Math.min(10,Math.floor(x.askCents/10/x.tickCents)*x.tickCents||x.tickCents));
    if(!entry&&x.askCents-x.bidCents>Math.min(p.maxLegSpreadCents,max))codes.push('LEG_SPREAD_EXCEEDED');
   }
  }
  if(!codes.length&&!entry){
   const candidate={candidateId:p.candidate.id,structure:product(p.structure),quantity:p.quantity,legs:p.legs.map((l,i)=>({...mapLeg(l),quote:{askPerShareCents:quotes[i].askCents,bidPerShareCents:quotes[i].bidCents}}))};
   const econ=structureQuotedEconomics(candidate),debit=econ.grossLongPremiumCents-econ.grossShortCreditCents;
   const width=Math.abs(snapshotCents(p.legs[0].contract.strike)-snapshotCents(p.legs[1].contract.strike))*100*p.quantity;
   const curve=structureTerminalPayoff(candidate,debit,entryFees+exitFees+slippage,[0]);
   if(debit<=0||debit>=width||debit>p.entryDebitLimitCents*100*p.quantity)codes.push('DEBIT_OR_WIDTH_OR_LIMIT');
   if(curve.maximumLossCents>available||curve.maximumLossCents>a.maximumLossCents||curve.maximumLossCents>a.tradeBudgetMaxCents)codes.push('CASH_OR_MAXIMUM_LOSS_OR_BUDGET');
   if(!codes.length){terminal=curve;entry={eventId:e.id,at:q.receivedAt,debitCents:debit,feesCents:entryFees};
    orders.push({orderId:p.candidate.id+'-ENTRY',mode:'MOCK',executionModel:p.executionModel,kind:'ENTRY',reason:'LATER_TWO_LEG_BID_ASK_ASSUMPTION',netCashFlowCents:-debit-entryFees,legs:p.legs.map((l,i)=>({contract:l.contract,quantity:p.quantity,side:l.role==='LONG'?'BUY_TO_OPEN':'SELL_TO_OPEN',priceCents:l.role==='LONG'?quotes[i].askCents:quotes[i].bidCents,feeCents:l.entryFeeCents,sourceAt:quotes[i].updatedAt,receivedAt:quotes[i].receivedAt}))});
   }
  }else if(!codes.length&&entry&&pendingExit){
   const legs=p.legs.map((l,i)=>{const x=quotes[i],sell=l.role==='LONG',raw=sell?x.bidCents-l.exitSlippageCents:x.askCents+l.exitSlippageCents;
    let price=raw;for(let n=0;n<3;n++){const tick=price>=x.cutoffCents?x.aboveTickCents:x.belowTickCents;price=(sell?Math.floor(raw/tick):Math.ceil(raw/tick))*tick;}
    const finalTick=price>=x.cutoffCents?x.aboveTickCents:x.belowTickCents;
    if((sell?x.bidSize:x.askSize)<p.quantity)codes.push('BOTH_EXIT_SIZES_REQUIRED');if(!integer(price,0,100000000)||!integer(finalTick,1)||price%finalTick!==0)codes.push('EXIT_PRICE_INVALID');
    return {contract:l.contract,quantity:p.quantity,side:sell?'SELL_TO_CLOSE':'BUY_TO_CLOSE',priceCents:price,feeCents:l.exitFeeCents,adverseSlippagePerShareCents:sell?x.bidCents-price:price-x.askCents,sourceAt:x.updatedAt,receivedAt:x.receivedAt};});
   const cashflow=legs.reduce((n,l)=>n+(l.side==='SELL_TO_CLOSE'?1:-1)*l.priceCents*100*p.quantity-l.feeCents,0);
   if(available-entry.debitCents-entry.feesCents+Math.min(0,cashflow)<0)codes.push('EXIT_CASH_INSUFFICIENT');
   if(!codes.length){exit={eventId:e.id,at:q.receivedAt,cashflowCents:cashflow,feesCents:exitFees};orders.push({orderId:p.candidate.id+'-EXIT',mode:'MOCK',executionModel:p.executionModel,kind:'EXIT',reason:pendingExit,netCashFlowCents:cashflow,legs});}
  }
  diagnostics.push({eventId:e.id,codes:[...new Set(codes)]});
 }
 const initialUnsettled=p.version==='TECH_MOCK_DEBIT_SPREAD_V2'?a.unsettledCashCents:0;
 const settled=available===null?null:available-(entry?entry.debitCents+entry.feesCents:0)+(exit?Math.min(0,exit.cashflowCents):0),unsettled=initialUnsettled+(exit?Math.max(0,exit.cashflowCents):0);
 const total=settled===null?null:settled+unsettled,pnl=exit?total-available-initialUnsettled:null;
 check(settled===null||settled>=0,'CASH_INVARIANT');
 if(entry&&!exit&&last&&clock(asOf)-clock(last)>60000000000n)gap=true;
 if(entry&&!exit&&clock(asOf)>=clock(p.timeExitAt))pendingExit??='TIME_EXIT';
 const modelAccount={mode:'MOCK',...(p.version==='TECH_MOCK_DEBIT_SPREAD_V2'?{initialUnsettledCashCents:initialUnsettled,unsettledAvailableForEntry:false}:{}),initialAvailableCashCents:available,otherReservedCashCents:a.reservedCashCents,settledCashCents:settled,unsettledProceedsCents:unsettled,totalCashCents:total,netPnlCents:pnl};
 const modelPosition={modeledLegs:p.legs.map(l=>({contract:l.contract,signedQuantity:entry&&!exit?(l.role==='LONG'?1:-1)*p.quantity:0})),unmodeledResidual:residual?'UNKNOWN_NOT_CLEARED':null,pendingExit:entry&&!exit?pendingExit:null};
 return {version:residual?'TECH_MOCK_DEBIT_SPREAD_RESIDUAL_REPORT_V2':p.version==='TECH_MOCK_DEBIT_SPREAD_V2'?'TECH_MOCK_DEBIT_SPREAD_REPORT_V2':'TECH_MOCK_DEBIT_SPREAD_REPORT_V1',mode:'MOCK',...(p.provenance?{planBinding:{planSha256:p.provenance.planSha256,parentIds:p.provenance.parentIds,costModel:p.provenance.costModel,conditions:p.provenance.conditions}}:{}),executionModel:p.executionModel,atomicFillsAreBrokerGuarantee:false,candidate:p.candidate,structure:p.structure,assessedAt:asOf,
  status:residual?'BLOCKED_UNSUPPORTED_RESIDUAL':exit?'CLOSED_MODELED':entry?'OPEN_UNRESOLVED':'NO_ENTRY',orders,
  position:residual?{status:'UNKNOWN_UNRECONCILED_RESIDUAL',unmodeledResidual:'UNKNOWN_NOT_CLEARED',actualClosed:'UNKNOWN',actualLegs:p.legs.map(l=>({contract:l.contract,signedQuantity:null})),pendingExit:null}:modelPosition,
  account:residual?{mode:'MOCK',status:'UNKNOWN_UNRECONCILED_RESIDUAL',availableFundsCents:null,settledCashCents:null,unsettledProceedsCents:null,totalCashCents:null,netPnlCents:null}:modelAccount,terminalRisk:residual?null:terminal,
  ...(residual?{modelLedger:{basis:'ORIGINAL_ATOMIC_MOCK_MODEL_ONLY_NOT_RECONCILED',status:exit?'CLOSED_MODELED':entry?'OPEN_UNRESOLVED':'NO_ENTRY',account:modelAccount,position:modelPosition,orders,terminalRisk:terminal},residualRisk:{status:'UNKNOWN',maximumLossCents:null,completeSpreadMaximumLossApplies:false},fundsReleasedCents:0,stateUnlockAllowed:false}:{}),
  maximumLossIsTerminalModelOnly:true,earlyCloseLossExceededTerminalModel:residual?null:pnl!==null&&terminal!==null&&-pnl>terminal.maximumLossCents,
  frozenBlockers,diagnostics,quoteGapObserved:gap,actualTrades:0,executionAllowed:false,productionPaperAdmissionAllowed:false,realAcceptance:'NOT_TESTED',
  unsupported:['PARTIAL_OR_SEPARATE_LEG_EXECUTION','NAKED_SHORT','CALENDAR_SPREAD','OVERNIGHT','EXERCISE_ASSIGNMENT','STOP_TARGET_STRATEGY','SCALING','CASH_SETTLEMENT','PRODUCTION_ARMING']};
}
const journal=createIsolatedMockJournal({validateStart,validateEvent,calculate:replayMockSpread,startVersion:'TECH_MOCK_SPREAD_START_V1'});
export const startMockSpread=journal.start,appendMockSpread=journal.append,recoverMockSpread=journal.recover;
