import {createHash} from 'node:crypto';
import {assessTechPaperFeasibility,TECH_PAPER_SCOPE} from './options-tech-paper-feasibility.mjs';
import {replayTechnologyMockSnapshot,snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {createIsolatedMockJournal} from './options-isolated-mock-journal.mjs';
const check=(ok,code)=>{if(!ok)throw Error('TECH_MOCK_'+code);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const clock=t=>snapshotNs(t);
const regular=q=>{check(q.chainSession?.lateCloseState==='disabled','REGULAR_SESSION_ONLY');};
function validateStart(input){
 check(input?.version==='TECH_MOCK_LIFECYCLE_V1'&&input.mode==='MOCK'&&input.path==='TRIAL_REHEARSAL','MODE');
 check(Object.keys(input).sort().join()==='candidate,evidence,mode,path,research,selectionQuote,settings,version','FIELDS');
 const {candidate,evidence:e,research:r,selectionQuote:q,settings:s}=input;
 check(candidate?.origin==='SYNTHETIC_FIXTURE'&&/^mock-[a-z0-9-]+$/.test(candidate.id)&&candidate.symbol===r.symbol&&TECH_PAPER_SCOPE.includes(r.symbol),'CANDIDATE');
 check(e?.symbol===r.symbol&&e.accountId==='MOCK'&&e.quantity===1&&e.records?.length===5&&e.records.every(x=>x.origin==='SYNTHETIC_FIXTURE'&&x.kind!=='QUOTE'),'SYNTHETIC_EVIDENCE_ONLY');
 check(s?.stopLossBps===2000&&s.rewardMultipleMilliR===2000,'EXISTING_REHEARSAL_POLICY');
 check(q.symbol===r.symbol&&clock(q.receivedAt)<=clock(r.asOf)&&clock(q.updatedAt)<=clock(q.receivedAt)&&clock(r.asOf)<clock(e.decisionAt),'PRE_DECISION_SELECTION');regular(q);
 const contract=JSON.parse(e.records.find(x=>x.kind==='CONTRACT')?.rawJson??'null');
 check(contract&&['id','symbol','expiry','type','strike','multiplier'].every(k=>contract[k]===q[k]),'SELECTION_IDENTITY');
 const funds=JSON.parse(e.records.find(x=>x.kind==='ACCOUNT_FUNDS')?.rawJson??'null');
 const risk=JSON.parse(e.records.find(x=>x.kind==='RISK_LIMITS')?.rawJson??'null');
 check(funds&&risk&&s.settledCashCents===funds.settledCashCents-funds.reservedCashCents&&s.currentEquityCents===s.settledCashCents&&s.tradeBudget?.maxCents===risk.tradeBudgetMaxCents,'ACCOUNT_BINDING');
 return input;
}
const frame=(quote,path)=>({path,sha256:sha(JSON.stringify(quote)),recordedAt:quote.receivedAt,capturedAt:quote.receivedAt,origin:'SYNTHETIC_FIXTURE',quotes:[quote]});
function calculate(start,events,asOf){
 validateStart(start);const {evidence:e,research,selectionQuote,settings}=start;
 check(clock(asOf)>=clock(research.asOf),'AS_OF');
 const plan={version:'OPTIONS_SNAPSHOT_PAPER_PLAN_V3',id:start.candidate.id,createdAt:research.asOf,contract:selectionQuote,selectionPath:'mock-selection',decisionAt:e.decisionAt,entryDeadlineAt:e.entryDeadlineAt,timeExitAt:e.timeExitAt,quantity:1,entryLimitCents:e.entryLimitCents,entryFeeCents:e.entryFeeCents,exitFeeCents:e.exitFeeCents,exitSlippageCents:e.exitSlippageCents,maxSpreadCents:e.maxSpreadCents,settings,feeBasis:'DECLARED_FEES'};
 const frames=[frame(selectionQuote,'mock-selection')],admissions=[];
 let report=replayTechnologyMockSnapshot(plan,frames,asOf);
 for(const event of events){
  const q=event.quote;check(event.origin==='SYNTHETIC_FIXTURE','SYNTHETIC_QUOTE_ONLY');regular(q);
  check(paperSession(q.receivedAt,q.chainSession).date===paperSession(e.decisionAt,q.chainSession).date,'OVERNIGHT_UNSUPPORTED');
  if(clock(q.receivedAt)>clock(asOf))continue;
  if(report.fills.length===0){
   const rawJson=JSON.stringify(q),quoteRecord={kind:'QUOTE',origin:'SYNTHETIC_FIXTURE',source:e.records.find(x=>x.kind==='CONTRACT').source,reviewedBy:'MOCK',observedAt:q.updatedAt,receivedAt:q.receivedAt,reviewedAt:q.receivedAt,validThrough:e.timeExitAt,verdict:'PASS',rawJson,sha256:sha(rawJson)};
   const assessment=assessTechPaperFeasibility({research,evidence:{...e,records:[...e.records,quoteRecord]},at:q.receivedAt});
   admissions.push({eventId:event.id,assessment});
   if(!assessment.mechanicalChecksPassed||assessment.research.trial.status!=='PRE_CONFIRMATION_RESEARCH_CANDIDATE')continue;
   const direction=assessment.research.direction;
   if((direction==='UP'?'call':'put')!==q.type)continue;
  }
  frames.push(frame(q,event.id));report=replayTechnologyMockSnapshot(plan,frames,asOf);
 }
 const orders=report.fills.map((f,i)=>({orderId:start.candidate.id+'-'+f.kind,mode:'MOCK',status:'MODELED_FILLED',side:i===0?'BUY_TO_OPEN':'SELL_TO_CLOSE',legs:[{contractId:selectionQuote.id,symbol:selectionQuote.symbol,type:selectionQuote.type,expiry:selectionQuote.expiry,strike:selectionQuote.strike,quantity:f.quantity,multiplier:100,side:i===0?'BUY_TO_OPEN':'SELL_TO_CLOSE'}],...f}));
 const entry=report.fills[0],exit=report.fills[1],initial=settings.settledCashCents;
 const settled=initial-(entry?entry.premiumCents+entry.feeCents:0),unsettled=exit?exit.premiumCents-exit.feeCents:0;
 check(settled>=0&&settled+unsettled===report.account.cashLedgerCents,'CASH_INVARIANT');
 return {version:'TECH_MOCK_LIFECYCLE_REPORT_V1',mode:'MOCK',candidate:start.candidate,assessedAt:asOf,status:report.status,orders,position:{quantity:entry&&!exit?1:0,contract:selectionQuote,maximumPremiumExposureCents:report.account.openPremiumExposureCents},account:{initialCashCents:initial,settledCashCents:settled,unsettledProceedsCents:unsettled,reservedOtherCashCents:JSON.parse(e.records.find(x=>x.kind==='ACCOUNT_FUNDS').rawJson).reservedCashCents,totalCashCents:settled+unsettled,netPnlCents:report.account.netPnlCents},admissions,engine:report,actualTrades:0,executionAllowed:false,productionPaperAdmissionAllowed:false,realAcceptance:'NOT_TESTED',unsupported:['MULTI_LEG','SHORT_OPTIONS','OVERNIGHT','EXERCISE_ASSIGNMENT','PARTIAL_FILLS','SCALING','CASH_SETTLEMENT','PRODUCTION_ARMING']};
}

const journal=createIsolatedMockJournal({validateStart,calculate,startVersion:'TECH_MOCK_START_V1',validateEvent:event=>check(event&&Object.keys(event).sort().join()==='id,origin,quote'&&/^mock-[a-z0-9-]{1,60}$/.test(event.id)&&event.origin==='SYNTHETIC_FIXTURE','EVENT')});
export const startTechMock=journal.start,appendTechMock=journal.append,recoverTechMock=journal.recover;
