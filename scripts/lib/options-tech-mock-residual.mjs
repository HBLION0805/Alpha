import {replayMockSpread} from './options-tech-mock-spread.mjs';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';

const clock=snapshotNs;
const int=(v,min=0,max=100000000)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const check=(v,c)=>{if(!v)throw Error('MOCK_RESIDUAL_'+c);};
const sameKeys=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join()===keys.split(' ').sort().join();
const ID=/^mock-[a-z0-9-]{1,80}$/;
const identity=['id','symbol','expiry','type','strike','multiplier','deliverable','exerciseStyle','tradability'];
const fillFields='id eventId mode origin contract side quantity priceCents feesCents executedAt receivedAt';
const missingFields=['executionId','exactContract','side','quantity','priceCents','feesCents','executedAt','receivedAt'];

export function unavailableResidualPreview(code){
 return {version:'TECH_MOCK_RESIDUAL_PREVIEW_V1',mode:'MOCK',readOnly:true,status:'BLOCKED',blockers:[code],modelLedger:null,evidenceCalculation:null,
  operationalState:{availableFundsCents:null,actualClosed:'UNKNOWN',actualNetPnlCents:null,residualMaximumLossCents:null,completeSpreadMaximumLossApplies:false},
  actions:[],actualOrdersCreated:0,stateUnlockAllowed:false,fundsReleasedCents:0,executionAllowed:false,productionPaperAdmissionAllowed:false,realAcceptance:'NOT_TESTED'};
}

/** Pure calculation. Atomic modeled fills and bid/ask observations are not execution evidence. */
export function previewMockSpreadResidual({input,events,asOf,evidence=null}){
 check(Array.isArray(events)&&events.length<=1000,'EVENT_BOUND');let previous=clock(input.research.asOf);const eventIds=new Set();
 for(const e of events){check(!eventIds.has(e.id),'DUPLICATE_OR_CONFLICTING_EVENT');eventIds.add(e.id);const t=clock(e.quote.receivedAt);check(t>previous,'EVENT_ORDER');previous=t;}
 const report=replayMockSpread(input,events,asOf),visible=events.filter(e=>clock(e.quote.receivedAt)<=clock(asOf)),byId=new Map(visible.map(e=>[e.id,e]));
 const residuals=visible.filter(e=>e.quote.executionState!=='ATOMIC_QUOTE_PAIR');
 const modelLedger=report.modelLedger??{basis:'ORIGINAL_ATOMIC_MOCK_MODEL_ONLY_NOT_RECONCILED',status:report.status,account:report.account,position:report.position,orders:report.orders,terminalRisk:report.terminalRisk};
 const required=new Set(residuals.map(e=>e.id));
 for(const order of modelLedger.orders){const e=visible.find(e=>e.quote.receivedAt===order.legs[0]?.receivedAt);if(e)required.add(e.id);}
 const blockers=[...report.frozenBlockers],gaps=[],findings=[],accepted=[],seenIds=new Set(),seenExecutions=new Set();
 const result={...unavailableResidualPreview(''),candidateId:input.candidate.id,asOf,persistedModelStatus:report.status,modelLedger,
  residualEventIds:residuals.map(e=>e.id),journalIntegrity:'PURE_INPUT_NOT_STORAGE_VERIFIED',evidenceGaps:gaps,findings,
  executionEvidenceBasis:'DECLARED_COMPLETE_MOCK_HISTORY_NOT_AUTHENTICATED',existingStateUnchanged:true};
 if(evidence!==null){
  if(!sameKeys(evidence,'version mode origin basis candidateId accountId fills')||evidence.version!=='TECH_MOCK_RESIDUAL_EVIDENCE_V1'||evidence.mode!=='MOCK'||evidence.origin!=='SYNTHETIC_FIXTURE'||evidence.basis!=='COMPLETE_MOCK_EXECUTION_HISTORY'||evidence.candidateId!==input.candidate.id||evidence.accountId!=='MOCK'||!Array.isArray(evidence.fills)||evidence.fills.length>2000){blockers.push('EXPLICIT_MOCK_HISTORY_REQUIRED');}
  else for(const [index,f]of evidence.fills.entries()){
   const errors=[],id=typeof f?.id==='string'?f.id:'unknown-'+index;
   if(!sameKeys(f,fillFields))errors.push('FILL_FIELDS');
   for(const k of fillFields.split(' '))if(f?.[k]===null||f?.[k]===undefined)gaps.push({fillId:id,field:k,reason:'EXPLICIT_EXECUTION_VALUE_MISSING'});
   if(!f||typeof f!=='object'){findings.push({fillId:id,codes:['FILL_INVALID']});continue;}
   if(!ID.test(f.id??'')||f.mode!=='MOCK'||f.origin!=='SYNTHETIC_FIXTURE')errors.push('FILL_NOT_EXPLICIT_MOCK');
   if(seenIds.has(f.id))errors.push('DUPLICATE_OR_CONFLICTING_FILL_ID');seenIds.add(f.id);
   const signature=paperFingerprint(Object.fromEntries(Object.entries(f).filter(([k])=>k!=='id')));
   if(seenExecutions.has(signature))errors.push('DUPLICATE_EXECUTION_DIFFERENT_ID');seenExecutions.add(signature);
   const event=byId.get(f.eventId);if(!event)errors.push('EVENT_MISSING_OR_FUTURE');
   const leg=input.legs.find(l=>l.contract.id===f.contract?.id);
   if(!leg||!sameKeys(f.contract,identity.join(' '))||!identity.every(k=>f.contract[k]===leg.contract[k]))errors.push('EXACT_CONTRACT_MISMATCH');
   const validSides=leg?.role==='LONG'?['BUY_TO_OPEN','SELL_TO_CLOSE']:['SELL_TO_OPEN','BUY_TO_CLOSE'];
   if(!leg||!validSides.includes(f.side))errors.push('LEG_DIRECTION_MISMATCH');
   if(!int(f.quantity,1,input.quantity))errors.push('CONTRACT_QUANTITY_MISMATCH');
   if(!int(f.priceCents,1)||!int(f.feesCents,0,10000))errors.push('EXECUTION_PRICE_OR_FEES_UNKNOWN');
   try{
    const executed=clock(f.executedAt),received=clock(f.receivedAt);
    if(executed<=clock(input.decisionAt)||received<executed||received>clock(asOf)||event&&(executed>clock(event.quote.receivedAt)||received<clock(event.quote.receivedAt)))errors.push('EXECUTION_TIME_ORDER');
    if(paperSession(f.executedAt).date!==paperSession(input.decisionAt).date||!paperSession(f.executedAt).isOpen)errors.push('EXECUTION_OUTSIDE_SAME_DAY_SESSION');
    if(f.side?.endsWith('_OPEN')&&executed>clock(input.entryDeadlineAt))errors.push('OPEN_OUTSIDE_FROZEN_WINDOW');
   }catch{errors.push('EXECUTION_CLOCK_MISSING_OR_INVALID');}
   if(errors.length)findings.push({fillId:id,eventId:f.eventId??null,codes:[...new Set(errors)]});else accepted.push(f);
  }
 }
 for(const eventId of required){if(!accepted.some(f=>f.eventId===eventId))for(const field of missingFields)gaps.push({eventId,field,reason:'QUOTE_OR_MODEL_IS_NOT_EXECUTION_EVIDENCE'});}
 // Explicit claims are never silently combined with the atomic model's assumed fills.
 const quantities=new Map(input.legs.map(l=>[l.contract.id,0])),opened=new Map(),lastOpen=new Map(),grouped=new Map();let cashDelta=0,fees=0,lastExecution=null,lastReceipt=null;
 for(const f of accepted){
  const leg=input.legs.find(l=>l.contract.id===f.contract.id),opening=f.side.endsWith('_OPEN'),buy=f.side.startsWith('BUY'),t=clock(f.executedAt),received=clock(f.receivedAt);
  if(lastExecution!==null&&(t<lastExecution||received<lastReceipt))findings.push({fillId:f.id,codes:['FILL_SEQUENCE_CONFLICT']});lastExecution=t;lastReceipt=received;
  const before=quantities.get(f.contract.id),after=before+(buy?1:-1)*f.quantity;
  if(leg.role==='LONG'?(after<0||after>input.quantity):(after>0||after< -input.quantity))findings.push({fillId:f.id,codes:['POSITION_QUANTITY_CONFLICT']});
  if(!opening&&(!lastOpen.has(f.contract.id)||t<=lastOpen.get(f.contract.id)))findings.push({fillId:f.id,codes:['CLOSE_WITHOUT_EARLIER_EXPLICIT_OPEN']});
  if(opening){lastOpen.set(f.contract.id,t);opened.set(f.contract.id,(opened.get(f.contract.id)??0)+f.quantity);if(opened.get(f.contract.id)>input.quantity)findings.push({fillId:f.id,codes:['MORE_THAN_ONE_FROZEN_ENTRY_QUANTITY']});}quantities.set(f.contract.id,after);
  cashDelta+=(buy?-1:1)*f.priceCents*f.quantity*f.contract.multiplier-f.feesCents;fees+=f.feesCents;
  const group=grouped.get(f.eventId)??[];group.push(f);grouped.set(f.eventId,group);
 }
 for(const [eventId,fills]of grouped){
  const event=byId.get(eventId),opening=fills[0].side.endsWith('_OPEN');
  if(fills.some(f=>f.side.endsWith('_OPEN')!==opening))findings.push({eventId,codes:['MIXED_OPEN_CLOSE_EVENT']});
  const contracts=new Set(fills.map(f=>f.contract.id));
  if(event.quote.executionState!=='ATOMIC_QUOTE_PAIR'&&contracts.size===2&&fills.every(f=>f.quantity===input.quantity))findings.push({eventId,codes:['PARTIAL_REPORT_CONFLICTS_WITH_COMPLETE_PAIR']});
  const original=modelLedger.orders.find(o=>o.legs[0]?.receivedAt===event.quote.receivedAt);
  if(!original&&event.quote.executionState==='ATOMIC_QUOTE_PAIR')findings.push({eventId,codes:['EXECUTION_CLAIM_WITHOUT_ELIGIBLE_MODEL_EVENT']});
  if(original){
   if(contracts.size!==2||fills.length!==2)findings.push({eventId,codes:['ORIGINAL_ATOMIC_EVENT_INCOMPLETE_EXECUTION_EVIDENCE']});
   if(fills.some(f=>!original.legs.some(l=>l.contract.id===f.contract.id&&l.side===f.side)))findings.push({eventId,codes:['ORIGINAL_MODEL_DIRECTION_CONFLICT']});
  }
 }
 if(modelLedger.status==='CLOSED_MODELED'&&residuals.length)findings.push({codes:['RESIDUAL_REPORT_CONFLICTS_WITH_ORIGINAL_CLOSED_MODEL']});
 if(findings.length)blockers.push('EXECUTION_EVIDENCE_CONFLICT_OR_INVALID');
 if(gaps.length)blockers.push('EXECUTION_EVIDENCE_INCOMPLETE');
 if(!residuals.length)blockers.push('NO_RESIDUAL_EVENT_TO_RECONCILE');
 if(evidence===null&&required.size===0)blockers.push('EXECUTION_EVIDENCE_MISSING');
 const ready=blockers.length===0;
 return {...result,status:ready?'MOCK_EVIDENCE_ARITHMETIC_ONLY':'BLOCKED',blockers:[...new Set(blockers)],evidenceCalculation:ready?{
  basis:'SUPPLIED_MOCK_FILLS_ONLY_NOT_ACCOUNT_RECONSTRUCTION',cashFlowCents:cashDelta,feesCents:fees,
  reportedNetQuantities:input.legs.map(l=>({contract:l.contract,signedQuantity:quantities.get(l.contract.id)})),
  availableFundsCents:null,actualClosed:'UNKNOWN',netPnlCents:null,residualMaximumLossCents:null,zeroQuantityIsVerifiedFlat:false}:null};
}
