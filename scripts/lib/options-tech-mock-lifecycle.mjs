import fs from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {assessTechPaperFeasibility,TECH_PAPER_SCOPE} from './options-tech-paper-feasibility.mjs';
import {replayTechnologyMockSnapshot,snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';

const check=(ok,code)=>{if(!ok)throw Error('TECH_MOCK_'+code);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const encode=v=>JSON.stringify(v,null,2)+'\n';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clock=t=>snapshotNs(t);
const regular=q=>{check(q.chainSession?.lateCloseState==='disabled','REGULAR_SESSION_ONLY');};
const read=p=>{
 const s=fs.lstatSync(p);check(s.isFile()&&!s.isSymbolicLink()&&s.size<2e6,'FILE');
 // A crash between link publication and staging unlink leaves both names. Only
 // matching inodes under this same run directory can complete that cleanup.
 if(s.nlink!==1){const pending=fs.readdirSync(dirname(p)).filter(n=>/^\.pending-[a-f0-9-]{36}$/.test(n)).map(n=>resolve(dirname(p),n)).filter(n=>{const t=fs.lstatSync(n);return t.isFile()&&!t.isSymbolicLink()&&t.ino===s.ino&&t.dev===s.dev;});check(s.nlink===pending.length+1,'FILE_LINKS');for(const n of pending)fs.unlinkSync(n);}
 return parseChainSurveyJson(fs.readFileSync(p,'utf8'));
};
function directory(root,runId,create=false){
 check(/^mock-[a-z0-9-]{1,60}$/.test(runId),'RUN_ID');
 const base=resolve(fs.realpathSync(root),'data/runtime/options-workbench-development');
 fs.mkdirSync(base,{recursive:true});check(fs.realpathSync(base)===base,'OUTPUT_SCOPE');
 const out=resolve(base,runId);if(create)fs.mkdirSync(out,{recursive:true});
 check(fs.realpathSync(out)===out&&!fs.lstatSync(out).isSymbolicLink(),'OUTPUT_SCOPE');return out;
}
// Complete bytes are fsynced before exclusive publication. An interrupted staging file
// is retained but is not a committed event. No existing event can be overwritten.
function publish(path,value,interrupt){
 const bytes=encode(value);
 if(fs.existsSync(path)){check(fs.readFileSync(path,'utf8')===bytes,'IDEMPOTENCY_CONFLICT');return;}
 const staging=resolve(dirname(path),'.pending-'+randomUUID());
 const fd=fs.openSync(staging,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 if(interrupt==='BEFORE_PUBLICATION')throw Error('MOCK_SIMULATED_INTERRUPTION');
 try{fs.linkSync(staging,path);}catch(e){fs.unlinkSync(staging);if(e.code!=='EEXIST')throw e;check(fs.readFileSync(path,'utf8')===bytes,'CONCURRENT_CONFLICT');return;}
 if(interrupt==='AFTER_LINK')throw Error('MOCK_SIMULATED_INTERRUPTION');
 fs.unlinkSync(staging);
 if(interrupt==='AFTER_PUBLICATION')throw Error('MOCK_SIMULATED_INTERRUPTION');
}
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
export function recoverTechMock({root,runId,asOf}){
 const out=directory(root,runId),manifest=read(out+'/start.json');check(manifest.sha256===sha(encode(manifest.input)),'START_HASH');
 const names=fs.readdirSync(out).filter(n=>/^event-/.test(n)).sort();check(names.length<=1000,'EVENT_BOUND');
 const events=[];let prior=manifest.sha256,last=manifest.input.research.asOf;const ids=new Set();
 for(const [i,name] of names.entries()){
  check(name==='event-'+String(i+1).padStart(4,'0')+'.json','EVENT_SEQUENCE');const row=read(out+'/'+name);
  check(row.previous===prior&&row.sha256===sha(encode(row.event))&&!ids.has(row.event.id),'EVENT_HASH_OR_ID');
  check(clock(row.event.quote.receivedAt)>clock(last),'RECEIPT_ORDER');last=row.event.quote.receivedAt;prior=sha(encode(row));ids.add(row.event.id);events.push(row.event);
 }
 return {out,manifest,events,tip:prior,report:calculate(manifest.input,events,asOf)};
}
export function startTechMock({root,runId,input,recordedAt=new Date().toISOString(),interrupt}){
 validateStart(input);const report=calculate(input,[],input.research.asOf),out=directory(root,runId,true);
 const path=out+'/start.json';let manifest={version:'TECH_MOCK_START_V1',recordedAt,input,sha256:sha(encode(input))};
 if(fs.existsSync(path)){manifest=read(path);check(manifest.sha256===sha(encode(input)),'START_CONFLICT');}
 publish(path,manifest,interrupt);return {runId,report};
}
export function appendTechMock({root,runId,event,recordedAt=new Date().toISOString(),interrupt}){
 check(event&&Object.keys(event).sort().join()==='id,origin,quote'&&/^mock-[a-z0-9-]{1,60}$/.test(event.id)&&event.origin==='SYNTHETIC_FIXTURE','EVENT');
 const state=recoverTechMock({root,runId,asOf:event.quote.receivedAt}),old=state.events.find(x=>x.id===event.id);
 if(old){check(same(old,event),'IDEMPOTENCY_CONFLICT');return state.report;}
 check(state.events.length<1000&&clock(event.quote.receivedAt)>clock(state.events.at(-1)?.quote.receivedAt??state.manifest.input.research.asOf),'RECEIPT_ORDER');
 const report=calculate(state.manifest.input,[...state.events,event],event.quote.receivedAt);
 const row={previous:state.tip,recordedAt,event,sha256:sha(encode(event))};
 publish(state.out+'/event-'+String(state.events.length+1).padStart(4,'0')+'.json',row,interrupt);return report;
}
