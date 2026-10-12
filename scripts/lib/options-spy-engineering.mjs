import fs from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createIsolatedMockJournal} from './options-isolated-mock-journal.mjs';
import {snapshotNs,snapshotUnderlyingMicros} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {verifyEquityProbeOriginals,recoverEquityProbe} from '../options-equity-source-probe.mjs';

export const SPY_ENGINEERING_ACCOUNT='paper-sim-tech-1000-20261010';
export const engineeringHash=s=>createHash('sha256').update(s).digest('hex');
const check=(ok,c)=>{if(!ok)throw Error('SPY_ENGINEERING_'+c);};
const keys=(v,k)=>check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===k.split(' ').sort().join(),'FIELDS');
const ns=snapshotNs,parse=parseChainSurveyJson;
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const session=t=>paperSession(t,{lateCloseState:'disabled',chainId:'ENGINEERING_STOCK_SESSION_ONLY',receivedAt:t});
const iso=n=>new Date(Number(n/1000000n)).toISOString();
const real=p=>p.context==='REAL_MARKET_DATA_SIMULATION';
export function validateSpyEngineeringPlan(p){
 keys(p,'version mode context symbol quantity research decisionAt entryDeadlineAt holdSeconds budgetMicros costs account protocolSha256');
 check(p.version==='SPY_ENGINEERING_PLAN_V1'&&p.mode==='ENGINEERING_ONLY'&&['REAL_MARKET_DATA_SIMULATION','SYNTHETIC_FIXTURE'].includes(p.context)&&p.symbol==='SPY'&&p.quantity===1,'SCOPE');
 keys(p.research,'asOf qualification');check(p.research.qualification==='NOT_APPLICABLE_ENGINEERING_ONLY'&&p.research.asOf===p.decisionAt,'REGISTRATION');
 check(new Date(p.decisionAt).toISOString()===p.decisionAt,'APPLICATION_PRECISION');const t=ns(p.decisionAt);check(ns(p.entryDeadlineAt)===t+120000000000n&&p.holdSeconds===420,'WINDOW');
 check(session(p.decisionAt).isOpen&&session(iso(t+540000000000n)).isOpen,'REGULAR_SESSION');
 check(integer(p.budgetMicros,1,1000000000)&&/^[a-f0-9]{64}$/.test(p.protocolSha256),'BUDGET_OR_PROTOCOL');
 keys(p.costs,'commissionPerSideMicros frictionPerSideMicros slippagePerSideMicros basis');
 check(p.costs.commissionPerSideMicros===0&&p.costs.frictionPerSideMicros===10000&&p.costs.slippagePerSideMicros===10000&&p.costs.basis==='FIXED_ENGINEERING_ASSUMPTIONS_NOT_BROKER_FEES','COSTS');
 keys(p.account,'id fundsOriginalRawJson fundsOriginalSha256');
 check(real(p)?p.account.id===SPY_ENGINEERING_ACCOUNT:/^paper-spy-fixture-[a-z0-9-]{1,30}$/.test(p.account.id),'ACCOUNT_SCOPE');
 check(typeof p.account.fundsOriginalRawJson==='string'&&p.account.fundsOriginalRawJson.length<=20000&&engineeringHash(p.account.fundsOriginalRawJson)===p.account.fundsOriginalSha256,'FUNDS_HASH');
 const e=parse(p.account.fundsOriginalRawJson),f=parse(e.rawJson);
 check(e.kind==='ACCOUNT_FUNDS'&&e.origin==='SIMULATED_ACCOUNT_ASSUMPTION'&&e.verdict==='PASS'&&engineeringHash(e.rawJson)===e.sha256&&ns(e.reviewedAt)<=t&&ns(e.validThrough)>=t+540000000000n,'FUNDS_ENVELOPE');
 check(f.accountId===p.account.id&&f.currency==='USD'&&f.basis==='ISOLATED_SIMULATED_CAPITAL_V1'&&integer(f.initialCapitalCents,1,100000)&&f.settledCashCents===f.initialCapitalCents&&f.reservedCashCents===0&&f.unsettledCashCents===0&&f.additionalDepositsCents===0&&f.borrowingCents===0&&Array.isArray(f.initialPositions)&&f.initialPositions.length===0,'FUNDS_STATE');
 if(real(p))check(p.account.fundsOriginalSha256==='833f0bd41f0cdae738343405546dd55e24181b1d0965b511a5d3b18181aff27f'&&e.sha256==='e3b99a245c5b24fef8ed395f419d4aedf9619f678ee346c3e07825fd18bb8180'&&f.initialCapitalCents===100000,'EXISTING_FUNDS_ONLY');
 return f;
}
export function makeSpyEngineeringPlan({at,accountId=SPY_ENGINEERING_ACCOUNT,fundsEnvelope,protocolSha256,context='REAL_MARKET_DATA_SIMULATION'}){
 const raw=JSON.stringify(fundsEnvelope);const p={version:'SPY_ENGINEERING_PLAN_V1',mode:'ENGINEERING_ONLY',context,symbol:'SPY',quantity:1,research:{asOf:at,qualification:'NOT_APPLICABLE_ENGINEERING_ONLY'},decisionAt:at,entryDeadlineAt:iso(ns(at)+120000000000n),holdSeconds:420,budgetMicros:1000000000,costs:{commissionPerSideMicros:0,frictionPerSideMicros:10000,slippagePerSideMicros:10000,basis:'FIXED_ENGINEERING_ASSUMPTIONS_NOT_BROKER_FEES'},account:{id:accountId,fundsOriginalRawJson:raw,fundsOriginalSha256:engineeringHash(raw)},protocolSha256};validateSpyEngineeringPlan(p);return p;
}
function retained(raw,hash){check(typeof raw==='string'&&Buffer.byteLength(raw)<=500000&&engineeringHash(raw)===hash,'SOURCE_HASH');return raw;}
export function validateSpyEngineeringEvent(e,p,asOf){
 keys(e,'id origin quote appliedAt source');keys(e.quote,'receivedAt action');
 check(typeof e.id==='string'&&/^[a-z0-9-]{1,90}$/.test(e.id)&&e.origin===(real(p)?'HOST_MARKET_TOOL_RESPONSES':'SYNTHETIC_FIXTURE')&&['ENTRY','EXIT'].includes(e.quote.action),'EVENT_SCOPE');
 check(ns(e.quote.receivedAt)<=ns(e.appliedAt)&&ns(e.appliedAt)<=ns(asOf),'EVENT_TIME');
 check(new Date(e.appliedAt).toISOString()===e.appliedAt,'APPLICATION_PRECISION');
 keys(e.source,'kind originalsRawJson sha256');check(e.source.kind==='RETAINED_EQUITY_PROBE','SOURCE_KIND');
 const bundle=parse(retained(e.source.originalsRawJson,e.source.sha256)),verified=verifyEquityProbeOriginals(bundle,e.appliedAt),{capture,intent,run}=verified;
 check(intent.origin===e.origin&&run.origin===e.origin&&(capture?.receivedAt??run.processFinishedAt)===e.quote.receivedAt,'SOURCE_BINDING');
 check(real(p)?intent.runId.startsWith('spy-engineering-'):intent.runId.startsWith('mock-'),'SOURCE_RUN_CONTEXT');
 return capture;
}
function usable(e,p,asOf){
 const c=validateSpyEngineeringEvent(e,p,asOf),errors=[];
 if(!c)return {errors:['SOURCE_CALL_FAILED']};
 if(c.toolStatus!=='completed'||c.toolError||c.response?.isError||c.response?.is_error)return {errors:['SOURCE_CALL_FAILED']};
 let body;try{body=c.response?.structuredContent??c.response?.structured_content??parse(c.response.content.find(x=>x.type==='text').text);}catch{return {errors:['SOURCE_BODY']};}
 const rows=body?.data?.results,q=rows?.[0]?.quote;
 if(!Array.isArray(rows)||rows.length!==1||q?.symbol!=='SPY'||q.state!=='active')return {errors:['QUOTE_IDENTITY_OR_STATE']};
 const bid=snapshotUnderlyingMicros(q.bid_price),ask=snapshotUnderlyingMicros(q.ask_price);
 if(bid===null||ask===null||bid>ask)return {errors:['BID_ASK_INVALID']};
 let bidAt,askAt;try{bidAt=ns(q.venue_bid_time);askAt=ns(q.venue_ask_time);}catch{return {errors:['QUOTE_CLOCK_UNKNOWN']};}
 const receipt=ns(c.receivedAt),applied=ns(e.appliedAt),t=ns(p.decisionAt);
 if(ns(c.requestedAt)<=t||bidAt<=t||askAt<=t)errors.push('QUOTE_NOT_AFTER_T0');
 if(bidAt>receipt||askAt>receipt)errors.push('FUTURE_QUOTE');
 if(applied-bidAt>120000000000n||applied-askAt>120000000000n)errors.push('STALE_QUOTE');
 if(!session(e.appliedAt).isOpen||session(e.appliedAt).date!==session(p.decisionAt).date)errors.push('OUTSIDE_SESSION');
 return {errors,bid,ask,bidAt,askAt,bidClock:q.venue_bid_time,askClock:q.venue_ask_time,requestedAt:ns(c.requestedAt)};
}
export function replaySpyEngineering(p,events,asOf){
 const funds=validateSpyEngineeringPlan(p),at=ns(asOf);check(at>=ns(p.decisionAt)&&Array.isArray(events)&&events.length<=2,'REPLAY_SCOPE');
 let settled=BigInt(funds.settledCashCents)*10000n,unsettled=0n,entry=null,exit=null,attempted=false,last=ns(p.decisionAt);const diagnostics=[],ids=new Set();
 for(const e of events){
  check(!ids.has(e.id)&&ns(e.quote.receivedAt)>last,'EVENT_ORDER_OR_DUPLICATE');ids.add(e.id);last=ns(e.quote.receivedAt);
  const q=usable(e,p,asOf);check(!exit,'ALREADY_CLOSED');
  if(e.quote.action==='ENTRY'){
   check(!attempted&&!entry,'ONE_ENTRY_ONLY');attempted=true;
   if(ns(e.appliedAt)>ns(p.entryDeadlineAt))q.errors.push('ENTRY_WINDOW_EXPIRED');
   if(!q.errors.length){const price=q.ask+10000n,debit=price+10000n,reserve=20000n;
    if(debit+reserve>settled||debit+reserve>BigInt(p.budgetMicros))q.errors.push('INSUFFICIENT_SETTLED_CASH_OR_BUDGET');
    else{settled-=debit;entry={eventId:e.id,at:e.appliedAt,sourceBidAt:q.bidClock,sourceAskAt:q.askClock,priceMicros:Number(price),feeMicros:10000,cashDebitMicros:Number(debit),exitDueAt:iso(ns(e.appliedAt)+420000000000n)};}
   }
  }else{
   check(entry,'EXIT_WITHOUT_POSITION');const due=ns(entry.exitDueAt);
   if(ns(e.appliedAt)<due||q.requestedAt!==undefined&&q.requestedAt<due||q.bidAt!==undefined&&q.bidAt<due||q.askAt!==undefined&&q.askAt<due)q.errors.push('EXIT_NOT_AFTER_SEVEN_MINUTES');
   if(!q.errors.length){const price=q.bid>10000n?q.bid-10000n:0n,net=price-10000n;if(net<0n){settled+=net;unsettled=0n;}else unsettled=net;exit={eventId:e.id,at:e.appliedAt,priceMicros:Number(price),feeMicros:10000,netProceedsMicros:Number(net)};}
  }
  diagnostics.push({eventId:e.id,action:e.quote.action,blockers:q.errors});
 }
 const pnl=exit?exit.netProceedsMicros-entry.cashDebitMicros:null,status=exit?'CLOSED_MODELED':entry?'OPEN_UNRESOLVED':attempted||at>ns(p.entryDeadlineAt)?'NO_TRADE':'PENDING_ENTRY';
 return {version:'SPY_ENGINEERING_REPORT_V1',context:p.context,mode:'ENGINEERING_ONLY',status,asOf,symbol:'SPY',quantity:1,researchQualification:'NOT_APPLICABLE_ENGINEERING_ONLY',strategyQualification:'NOT_APPLICABLE_ENGINEERING_ONLY',entry,exit,positionShares:entry&&!exit?1:0,account:{id:p.account.id,initialCapitalMicros:funds.initialCapitalCents*10000,settledCashMicros:Number(settled),unsettledProceedsMicros:Number(unsettled),reservedCashMicros:entry&&!exit?20000:0,totalCashMicros:Number(settled+unsettled),netPnlMicros:pnl,settlement:'T_PLUS_1_STOCK_SALE_ASSUMPTION_NO_SETTLEMENT_CREDIT_APPLIED',unsettledUsableForEntry:false,newDepositsMicros:0},diagnostics,fillModel:'ONE_SHARE_AT_DISPLAYED_ASK_OR_BID_PLUS_FIXED_ADVERSE_SLIPPAGE_SIZE_UNKNOWN_NOT_EXECUTION_GUARANTEE',costBasis:p.costs.basis,realBrokerFills:0,simulatedFills:Number(!!entry)+Number(!!exit),executionAllowed:false,realTradingAdmission:false};
}
const journal=createIsolatedMockJournal({validateStart:validateSpyEngineeringPlan,validateEvent:validateSpyEngineeringEvent,calculate:replaySpyEngineering,startVersion:'SPY_ENGINEERING_START_V1',eventAvailableAt:e=>e.appliedAt,runIdPattern:/^paper-[a-z0-9-]{1,60}$/,validateRunScope:(p,id)=>check(id===p.account.id,'ACCOUNT_JOURNAL_SCOPE')});
function exclusive(root,runId,fn){
 const base=resolve(fs.realpathSync(root),'data/runtime/options-workbench-development');fs.mkdirSync(base,{recursive:true});check(fs.realpathSync(base)===base,'DIRECTORY');
 check(/^paper-[a-z0-9-]{1,60}$/.test(runId),'RUN_ID');const dir=join(base,runId);fs.mkdirSync(dir,{recursive:true});check(fs.realpathSync(dir)===dir,'DIRECTORY');
 const lock=join(dir,'.spy-engineering-writer.lock'),fd=fs.openSync(lock,'wx',0o600);try{return fn();}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
export {exclusive as withSpyEngineeringWriter};
export function startSpyEngineering({root,input,recordedAt=new Date().toISOString()}){
 validateSpyEngineeringPlan(input);if(real(input)){recordedAt=new Date().toISOString();check(ns(recordedAt)>=ns(input.decisionAt)&&ns(recordedAt)-ns(input.decisionAt)<=5000000000n,'FRESH_T0');}
 return exclusive(root,input.account.id,()=>journal.start({root,runId:input.account.id,input,recordedAt}));
}
export function appendSpyEngineering({root,runId,event,recordedAt=new Date().toISOString()}){
 return exclusive(root,runId,()=>{const state=journal.recover({root,runId,asOf:recordedAt});if(real(state.manifest.input)){recordedAt=new Date().toISOString();check(ns(recordedAt)>=ns(event.appliedAt)&&ns(recordedAt)-ns(event.appliedAt)<=5000000000n,'FRESH_APPLICATION');}return journal.append({root,runId,event,recordedAt});});
}
export function recoverSpyEngineering({root,runId,asOf}){return exclusive(root,runId,()=>journal.recover({root,runId,asOf}));}
export function eventFromSpyProbe({root,directory,action,appliedAt=new Date().toISOString()}){
 check(['ENTRY','EXIT'].includes(action),'ACTION');recoverEquityProbe(root,directory,appliedAt);
 const originals={};for(const name of ['manifest.json','intent.json','host-prompt.txt','host.jsonl','host-stderr.txt','events.json','capture.json','assessment.json','run.json']){try{originals[name]=fs.readFileSync(join(directory,name),'utf8');}catch(e){if(name!=='capture.json'||e.code!=='ENOENT')throw e;}}
 const verified=verifyEquityProbeOriginals(originals,appliedAt),originalsRawJson=JSON.stringify(originals),source={kind:'RETAINED_EQUITY_PROBE',originalsRawJson,sha256:engineeringHash(originalsRawJson)},receipt=verified.capture?.receivedAt??verified.run.processFinishedAt;
 return {id:'spy-'+action.toLowerCase()+'-'+source.sha256.slice(0,24),origin:verified.run.origin,quote:{receivedAt:receipt,action},appliedAt,source};
}
