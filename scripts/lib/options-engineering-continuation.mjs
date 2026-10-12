import fs from 'node:fs';
import {resolve,join} from 'node:path';
import {engineeringHash as sha,replaySpyEngineering,withSpyEngineeringWriter,SPY_ENGINEERING_ACCOUNT} from './options-spy-engineering.mjs';
import {verifyMockJournalRecords,publishMockJournalRecord,readMockJournalRecord} from './options-isolated-mock-journal.mjs';
import {replayMockSpread} from './options-tech-mock-spread.mjs';
import {assessEngineeringSpreadPreflight} from './options-tech-spread-preflight.mjs';
import {readTechEvidenceRecords} from './options-tech-paper-feasibility.mjs';
import {snapshotNs as ns} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {parseChainSurveyJson as parse} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';

const check=(v,c)=>{if(!v)throw Error('OPTION_CONTINUATION_'+c);};
const encode=v=>JSON.stringify(v,null,2)+'\n',same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const names=['start.json','event-0001.json','event-0002.json'];
const segment='option-engineering-01',claimName='.option-engineering-claim.json',startVersion='OPTION_ENGINEERING_SEGMENT_START_V1';
const realHashes=['6ab2b9b6f516b96ba4eca31307e20d809c1e8f94480b7c435a953af411ec5e44','74c6f916362acd6f7abad2508ce3801605125a62a4e6dcfb3fdbb395b73a084d','9f6ff25b9c34ec4453a29e29cb90f2b736435a9a5c7c017b1801b76bd674935f'];
const fields=(v,s)=>check(v&&Object.keys(v).sort().join()===s.split(' ').sort().join(),'FIELDS');
const integer=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000;
const fixture=p=>p.context==='TEST_FIXTURE_ONLY';
function directory(root,id){
 check(/^paper-[a-z0-9-]{1,60}$/.test(id),'ACCOUNT_ID');
 const p=resolve(fs.realpathSync(root),'data/runtime/options-workbench-development',id);
 check(fs.realpathSync(p)===p&&!fs.lstatSync(p).isSymbolicLink(),'ACCOUNT_DIRECTORY');return p;
}
function pureRead(path){const s=fs.lstatSync(path);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<2e6,'ORIGINAL_FILE');const raw=fs.readFileSync(path);return {data:parse(raw.toString()),sha256:sha(raw)};}
/** No mkdir, lock, unlink, recovery repair, or source call. */
export function readEngineeringParent({root,accountId,asOf}){
 const dir=directory(root,accountId),files=Object.fromEntries(names.map(n=>[n,pureRead(join(dir,n))]));
 const extra=fs.readdirSync(dir).filter(n=>!names.includes(n)&&![segment,claimName,'.spy-engineering-writer.lock'].includes(n)&&!/^\.pending-[a-f0-9-]{36}$/.test(n));check(!extra.length,'PARENT_FILES_CHANGED');
 const v=verifyMockJournalRecords(files['start.json'].data,names.slice(1).map(name=>({name,value:files[name].data})),'SPY_ENGINEERING_START_V1');
 const report=replaySpyEngineering(v.manifest.input,v.events,asOf);
 check(v.manifest.input.account.id===accountId&&report.status==='CLOSED_MODELED'&&report.positionShares===0&&report.account.reservedCashMicros===0,'PARENT_NOT_CLOSED');
 for(const k of ['settledCashMicros','unsettledProceedsMicros','initialCapitalMicros','netPnlMicros'])check(Number.isSafeInteger(report.account[k])&&report.account[k]%10000===0,'PARENT_SUBCENT_FUNDS');
 if(v.manifest.input.context==='REAL_MARKET_DATA_SIMULATION')check(accountId===SPY_ENGINEERING_ACCOUNT&&names.every((n,i)=>files[n].sha256===realHashes[i]),'EXACT_REAL_PARENT');
 return {dir,context:v.manifest.input.context,files:Object.fromEntries(names.map(n=>[n,files[n].sha256])),tipSha256:v.tip,report};
}
export function validateEngineeringContinuation(p,parent){
 fields(p,'version mode context segmentId accountId parent spread evidence protocolSha256 research');
 check(p.version==='OPTION_ENGINEERING_CONTINUATION_V1'&&p.mode==='ENGINEERING_ONLY'&&['TEST_FIXTURE_ONLY','REAL_MARKET_DATA_SIMULATION'].includes(p.context)&&p.segmentId===segment,'SCOPE');
 check(fixture(p)?parent.context==='SYNTHETIC_FIXTURE'&&/^paper-spy-fixture-/.test(p.accountId):parent.context==='REAL_MARKET_DATA_SIMULATION'&&p.accountId===SPY_ENGINEERING_ACCOUNT,'CONTEXT');
 check(p.accountId===parent.report.account.id&&same(p.parent,{files:parent.files,tipSha256:parent.tipSha256}),'PARENT_BINDING');
 check(/^[a-f0-9]{64}$/.test(p.protocolSha256),'PROTOCOL');
 const s=p.spread,a=s.account,t=ns(s.decisionAt),end=ns(s.timeExitAt);
 check(p.research.asOf===s.decisionAt&&p.research.qualification==='NOT_APPLICABLE_ENGINEERING_ONLY'&&same(p.research,s.research),'RESEARCH_NA');
 check(t>ns(parent.report.exit.at)&&s.version==='ENGINEERING_DEBIT_SPREAD_V1'&&s.mode==='ENGINEERING_ONLY'&&s.evidenceContext===p.context&&a.id===p.accountId,'SPREAD_SCOPE');
 check(a.settledCashCents*10000===parent.report.account.settledCashMicros&&a.unsettledCashCents*10000===parent.report.account.unsettledProceedsMicros&&a.reservedCashCents===0,'INHERITED_FUNDS');
 const kinds=['CONTRACT','DATA_ENTITLEMENT','PRODUCT_PERMISSION','COST_MODEL','RISK_LIMITS'];
 const v=readTechEvidenceRecords({inputs:p.evidence,kinds,now:t,decision:t,validThrough:end,simulatedAccount:true});check(!v.blockers.length,'EVIDENCE_CLOCK_OR_VERDICT');
 check(p.evidence.every(r=>fixture(p)?r.origin==='SYNTHETIC_FIXTURE':['COST_MODEL','PRODUCT_PERMISSION','RISK_LIMITS'].includes(r.kind)?r.origin==='SIMULATED_ACCOUNT_ASSUMPTION':['PROVIDER_DOCUMENT','OWNER_DOCUMENT'].includes(r.origin)),'EVIDENCE_ORIGIN');
 const c=v.payloads.get('CONTRACT'),d=v.payloads.get('DATA_ENTITLEMENT'),permission=v.payloads.get('PRODUCT_PERMISSION'),cost=v.payloads.get('COST_MODEL'),risk=v.payloads.get('RISK_LIMITS');
 check(Array.isArray(c.contracts)&&c.contracts.length===2&&c.contracts.every(x=>x.adjustmentStatus==='UNADJUSTED'&&x.standardSeriesEstablished===true&&['DIRECT_SERIES_EVIDENCE','RULE_MAPPED_EXACT_STANDARD_SERIES'].includes(x.basis)&&typeof x.seriesEvidenceReference==='string'&&x.seriesEvidenceReference.trim()&&same(x.contract,s.legs.find(l=>l.contract.id===x.contract.id)?.contract))&&new Set(c.contracts.map(x=>x.contract.id)).size===2,'CONTRACT_EVIDENCE_UNKNOWN');
 check(permission.accountId===p.accountId&&permission.basis==='SIMULATED_PRODUCTS_ONLY'&&permission.brokerQualification==='UNKNOWN'&&permission.enabled===true&&permission.symbols?.includes('SPY')&&permission.products?.includes(s.structure),'PRODUCT_PERMISSION');
 check(d.provider==='ROBINHOOD_OFFICIAL_MCP'&&d.realtimeOptions===true&&d.localRetention===true&&d.symbols?.includes('SPY'),'DATA_ENTITLEMENT');
 check(cost.basis==='EXPLICIT_SIMULATION_COST_ASSUMPTION'&&cost.actualBrokerFees==='UNKNOWN'&&same(cost.legs,s.legs.map(l=>({id:l.contract.id,entryFeeCents:l.entryFeeCents,exitFeeCents:l.exitFeeCents,exitSlippageCents:l.exitSlippageCents}))),'COST_BINDING');
 check(risk.accountId===p.accountId&&risk.basis==='THIS_ENGINEERING_RUN_ONLY'&&[risk.maximumLossCents,risk.tradeBudgetMaxCents].every(integer)&&risk.maximumLossCents===a.maximumLossCents&&risk.tradeBudgetMaxCents===a.tradeBudgetMaxCents&&a.maximumLossCents<=a.settledCashCents&&a.tradeBudgetMaxCents<=a.settledCashCents,'RISK_BINDING');
 check(ns(a.reviewedAt)<=t&&ns(a.validThrough)>=end,'ACCOUNT_CLOCK');
 replayMockSpread(s,[],s.decisionAt);return p;
}
function eventProjection(p,e,asOf){
 fields(e,'version id origin quote appliedAt executionState original source');fields(e.quote,'receivedAt action');fields(e.original,'rawJson sha256');
 check(e.version==='OPTION_ENGINEERING_EVENT_V1'&&e.origin===p.spread.candidate.origin&&/^paper-[a-z0-9-]{1,60}$/.test(e.id)&&['OBSERVE','CLOSE'].includes(e.quote.action),'EVENT_SCOPE');
 check(typeof e.original.rawJson==='string'&&Buffer.byteLength(e.original.rawJson)<1e6&&sha(e.original.rawJson)===e.original.sha256,'ORIGINAL_HASH');
 check(new Date(e.appliedAt).toISOString()===e.appliedAt&&ns(e.quote.receivedAt)<=ns(e.appliedAt)&&ns(e.appliedAt)<=ns(asOf),'APPLICATION_CLOCK');
 const r=parse(e.original.rawJson),s=p.spread;
 verifyEngineeringBatchOriginals(e.source,r,e.original.rawJson,e.origin,e.appliedAt);
 check(r.capture?.origin===e.origin&&r.intent?.origin===e.origin&&r.capture?.version==='TECH_OPTION_CAPTURE_V2'&&r.intent.selection?.maxSourceSkewMs===s.maxSourceSkewMs,'QUOTE_CONTEXT');
 check(ns(r.recordedAt)<=ns(e.appliedAt)&&ns(r.intent.requestedAt)>ns(s.decisionAt)&&r.capture.receipts?.at(-1)?.receivedAt===e.quote.receivedAt,'QUOTE_CLOCK_BINDING');
 const n=assessEngineeringSpreadPreflight({version:'TECH_SPREAD_PREFLIGHT_INPUT_V1',mode:fixture(p)?'MOCK_CONTROL':'REAL_SAVED_SOURCE_REPLAY',at:e.appliedAt,decisionAt:s.decisionAt,originals:[{id:'batch',...e.original}],legs:s.legs.map(l=>({originalId:'batch',direction:l.role,quantity:1,contract:l.contract}))});
 const blockers=n.checks.filter(c=>c.status!=='PASS'&&!['CONTRACT_DELIVERABLE_AND_EXERCISE','COSTS_EXPLICIT','ACCOUNT_EVIDENCE','REAL_SPREAD_ADMISSION_POLICY_UNREGISTERED','REAL_SPREAD_LIFECYCLE_NOT_QUALIFIED'].includes(c.code)).map(c=>c.code);
 if(n.quotePair.status!=='COHERENT_BATCH_EVIDENCE_ONLY')blockers.push('QUOTE_PAIR_NOT_QUALIFIED');
 if(e.quote.action==='OBSERVE'&&ns(e.appliedAt)>ns(s.entryDeadlineAt))blockers.push('LATE_ENTRY_APPLICATION');
 if(e.quote.action==='CLOSE'&&(ns(r.intent.requestedAt)<ns(s.timeExitAt)||n.legs.some(l=>ns(l.snapshot.updatedAt)<ns(s.timeExitAt))))blockers.push('EXIT_NOT_INDEPENDENT_AFTER_T0_PLUS_420_SECONDS');
 const legs=blockers.length?[]:s.legs.map(l=>({...n.legs.find(x=>x.snapshot.id===l.contract.id).snapshot,...l.contract}));
 return {event:{id:e.id,origin:e.origin,quote:{receivedAt:e.quote.receivedAt,action:e.quote.action,source:fixture(p)?'TEST_FIXTURE':'ROBINHOOD_OFFICIAL_MCP',executionState:e.executionState,legs}},blockers};
}
/** Full local Host provenance, never provider authentication or proof of real fills. */
export function verifyEngineeringBatchOriginals(source,r,raw,origin,at){
 fields(source,'kind originalsRawJson sha256');check(source.kind==='RETAINED_TECH_QUOTE_HOST_BATCH'&&typeof source.originalsRawJson==='string'&&Buffer.byteLength(source.originalsRawJson)<1500000&&sha(source.originalsRawJson)===source.sha256,'HOST_BUNDLE_HASH');
 const b=parse(source.originalsRawJson);fields(b,'request.json collector.js host-prompt.txt host.jsonl host-stderr.txt capture.json host-run.json');
 check(Object.values(b).every(v=>typeof v==='string')&&b['capture.json']===raw,'HOST_CAPTURE_BYTES');
 const request=parse(b['request.json']),run=parse(b['host-run.json']);
 check(same(request,r.intent)&&request.origin===origin&&request.collectorSha256===sha(b['collector.js'])&&request.maximumMarketCalls===5&&request.maximumContracts===2&&request.accountAccessed===false&&request.executionAllowed===false,'HOST_INTENT');
 check(run.version==='TECH_QUOTES_HOST_RUN_V1'&&run.origin===origin&&run.batchId===r.capture.batchId&&run.observedCompletedMarketCalls===5&&run.exitCode===0&&run.timedOut===false&&run.persistenceError===null&&run.executionAllowed===false,'HOST_RUN');
 check(origin==='SYNTHETIC_FIXTURE'?run.batchId.startsWith('mock-'):run.batchId.startsWith('option-engineering-'),'HOST_RUN_CONTEXT');
 const clocks=[request.requestedAt,run.startedAt,r.capture.startedAt,r.capture.capturedAt,r.recordedAt,run.finishedAt,at].map(ns);check(clocks.every((t,i)=>i===0||t>=clocks[i-1]),'HOST_PERSISTENCE_CLOCK');
 const lines=b['host.jsonl'].trim().split(/\r?\n/).map(parse),items=lines.filter(x=>x.type?.startsWith('item.')).map(x=>x.item);
 check(items.every(x=>['reasoning','agent_message'].includes(x?.type)||x?.type==='mcp_tool_call'&&(x.server==='robinhood_alpha_market_data'||x.server==='alpha_tech_quotes'&&['prepare_capture','review_capture'].includes(x.tool))),'HOST_UNEXPECTED_ACTION');
 const started=lines.filter(x=>x.type==='item.started'&&x.item?.server==='robinhood_alpha_market_data').map(x=>x.item),completed=lines.filter(x=>x.type==='item.completed'&&x.item?.server==='robinhood_alpha_market_data').map(x=>x.item);
 check(started.length===5&&completed.length===5&&new Set(started.map(x=>x.id)).size===5&&new Set(completed.map(x=>x.id)).size===5,'HOST_CALL_COUNT');
 const body=v=>v?.structured_content??v?.structuredContent??(v?.data?v:parse(v.content.filter(x=>x.type==='text')[0].text));
 for(const [i,receipt]of r.capture.receipts.entries()){
  const a=started[i],z=completed[i];check(a.id===z.id&&a.tool===receipt.tool&&z.tool===receipt.tool&&same(a.arguments,receipt.request)&&same(z.arguments,receipt.request)&&z.status==='completed'&&!z.error&&same(body(z.result),body(receipt.response)),'HOST_CALL_BINDING');
  const ai=lines.findIndex(x=>x.type==='item.started'&&x.item?.id===a.id),zi=lines.findIndex(x=>x.type==='item.completed'&&x.item?.id===z.id);check(ai<zi&&(i===0||lines.findIndex(x=>x.type==='item.completed'&&x.item?.id===completed[i-1].id)<ai),'HOST_CALL_ORDER');
 }
 const helpers=lines.filter(x=>x.type==='item.completed'&&x.item?.server==='alpha_tech_quotes').map(x=>x.item),helperStarts=lines.filter(x=>x.type==='item.started'&&x.item?.server==='alpha_tech_quotes').map(x=>x.item);
 check(helpers.length<=2&&helperStarts.length===helpers.length&&new Set(helpers.map(x=>x.tool)).size===helpers.length&&new Set(helperStarts.map(x=>x.id)).size===helpers.length&&helpers.every(x=>x.status==='completed'&&!x.error&&same(x.arguments,x.tool==='prepare_capture'?{}:{capture:r.capture})),'HOST_HELPER_BINDING');
 for(const h of helpers){const starts=helperStarts.filter(x=>x.id===h.id);check(starts.length===1&&starts[0].tool===h.tool&&same(starts[0].arguments,h.arguments),'HOST_HELPER_BINDING');const a=lines.findIndex(x=>x.type==='item.started'&&x.item?.id===h.id),z=lines.findIndex(x=>x.type==='item.completed'&&x.item?.id===h.id);check(a<z,'HOST_HELPER_ORDER');}
 const allowed=new Map([...completed,...helpers].map(x=>[x.id,x]));check(allowed.size===5+helpers.length,'HOST_DUPLICATE_CALL_ID');
 // Updated/in-progress items are actions too: every one must belong to an exact
 // retained start/completion pair, not merely to the allowed server name.
 for(const item of items.filter(x=>x.type==='mcp_tool_call')){const exact=allowed.get(item.id);check(exact&&item.server===exact.server&&item.tool===exact.tool&&same(item.arguments,exact.arguments),'HOST_UNBOUND_ACTION');}
 return {origin,batchId:run.batchId,sourceCalls:5,authentication:'NOT_ESTABLISHED_BY_LOCAL_HASHES'};
}
export function replayEngineeringContinuation(p,parent,events,asOf){
 validateEngineeringContinuation(p,parent);check(ns(asOf)>=ns(p.spread.decisionAt)&&Array.isArray(events)&&events.length<=2,'EVENT_BOUND');
 const projections=[],ids=new Set();let last=ns(p.spread.decisionAt);
 for(const [i,e]of events.entries()){check(!ids.has(e.id)&&ns(e.quote.receivedAt)>last&&e.quote.action===(i===0?'OBSERVE':'CLOSE'),'EVENT_ORDER');ids.add(e.id);last=ns(e.quote.receivedAt);projections.push(eventProjection(p,e,asOf));}
 const spread=replayMockSpread(p.spread,projections.map(x=>x.event),asOf),a=spread.account,unknown=spread.status==='BLOCKED_UNSUPPORTED_RESIDUAL';
 return {version:'OPTION_ENGINEERING_CONTINUATION_REPORT_V1',context:p.context,mode:'ENGINEERING_ONLY',accountId:p.accountId,segmentId:p.segmentId,parentTipSha256:parent.tipSha256,status:spread.status,asOf,researchQualification:'NOT_APPLICABLE_ENGINEERING_ONLY',strategyQualification:'NOT_APPLICABLE_ENGINEERING_ONLY',spread,sourceDiagnostics:projections.map((x,i)=>({id:events[i].id,blockers:x.blockers})),account:{initialCapitalMicros:parent.report.account.initialCapitalMicros,parentNetPnlMicros:parent.report.account.netPnlMicros,settledCashMicros:unknown?null:a.settledCashCents*10000,unsettledProceedsMicros:unknown?null:a.unsettledProceedsCents*10000,totalCashMicros:unknown?null:a.totalCashCents*10000,segmentNetPnlMicros:a.netPnlCents===null?null:a.netPnlCents*10000,cumulativeNetPnlMicros:unknown||a.netPnlCents===null?null:parent.report.account.netPnlMicros+a.netPnlCents*10000,unsettledUsableForEntry:false,newDepositsMicros:0,claimReleased:false},executionAllowed:false,realBrokerFills:0,realOptionAcceptance:'NOT_TESTED'};
}
function currentParent(root,p,asOf){const v=readEngineeringParent({root,accountId:p.accountId,asOf});check(same(p.parent,{files:v.files,tipSha256:v.tipSha256}),'PARENT_CHANGED');return v;}
const claimFor=p=>({version:'OPTION_ENGINEERING_PARENT_CLAIM_V1',accountId:p.accountId,parent:p.parent,segmentId:p.segmentId,inputSha256:sha(encode(p))});
function load(root,accountId,asOf){
 const parent=readEngineeringParent({root,accountId,asOf}),claim=readMockJournalRecord(join(parent.dir,claimName));
 const dir=join(parent.dir,segment);check(fs.realpathSync(dir)===dir&&!fs.lstatSync(dir).isSymbolicLink(),'SEGMENT_DIRECTORY');
 const manifest=readMockJournalRecord(join(dir,'start.json'));check(same(claim,claimFor(manifest.input)),'CLAIM_BINDING');
 check(fs.readdirSync(dir).every(n=>n==='start.json'||/^event-\d{4}\.json$/.test(n)||/^\.pending-[a-f0-9-]{36}$/.test(n)),'SEGMENT_FILES');
 const rows=fs.readdirSync(dir).filter(n=>n.startsWith('event-')).sort().map(name=>({name,value:readMockJournalRecord(join(dir,name))}));
 const v=verifyMockJournalRecords(manifest,rows,startVersion);check(rows.length<=2,'EVENT_BOUND');
 check(ns(manifest.recordedAt)>=ns(manifest.input.spread.decisionAt)&&ns(manifest.recordedAt)<=ns(asOf)&&rows.every(x=>ns(x.value.recordedAt)>=ns(x.value.event.appliedAt)&&ns(x.value.recordedAt)<=ns(asOf)),'JOURNAL_CLOCK');
 for(const e of v.events)afterFrozenStart(e,manifest.recordedAt);
 const report=replayEngineeringContinuation(manifest.input,parent,v.events,asOf);return {parent,dir,...v,report};
}
export function startEngineeringContinuation({root,input,recordedAt=new Date().toISOString(),interrupt}){
 const p=input;directory(root,p.accountId);
 if(!fixture(p))recordedAt=new Date().toISOString();
 return withSpyEngineeringWriter(root,p.accountId,()=>{
  const parent=currentParent(root,p,recordedAt);validateEngineeringContinuation(p,parent);check(ns(recordedAt)>=ns(p.spread.decisionAt),'START_CLOCK');
  const claim=claimFor(p),path=join(parent.dir,claimName);if(fs.existsSync(path))check(same(readMockJournalRecord(path),claim),'PARENT_ALREADY_CLAIMED');
  else if(!fixture(p))check(ns(recordedAt)>=ns(p.spread.decisionAt)&&ns(recordedAt)-ns(p.spread.decisionAt)<=5000000000n,'FRESH_T0');
  publishMockJournalRecord(path,claim);if(interrupt==='AFTER_CLAIM')throw Error('OPTION_CONTINUATION_SIMULATED_INTERRUPTION');
  const dir=join(parent.dir,segment);if(!fs.existsSync(dir))fs.mkdirSync(dir);check(fs.realpathSync(dir)===dir&&!fs.lstatSync(dir).isSymbolicLink(),'SEGMENT_DIRECTORY');
  const start=join(dir,'start.json'),manifest=fs.existsSync(start)?readMockJournalRecord(start):{version:startVersion,recordedAt,input:p,sha256:sha(encode(p))};
  check(manifest.sha256===sha(encode(p)),'START_CONFLICT');currentParent(root,p,recordedAt);publishMockJournalRecord(start,manifest,interrupt);
  return load(root,p.accountId,recordedAt);
 });
}
export function appendEngineeringContinuation({root,accountId,event,recordedAt=new Date().toISOString(),interrupt}){
 directory(root,accountId);return withSpyEngineeringWriter(root,accountId,()=>{
  const state=load(root,accountId,recordedAt),p=state.manifest.input,old=state.events.find(e=>e.id===event.id);
  if(old){check(same(old,event),'IDEMPOTENCY_CONFLICT');return state.report;}
  if(!fixture(p)){recordedAt=new Date().toISOString();check(ns(recordedAt)>=ns(event.appliedAt)&&ns(recordedAt)-ns(event.appliedAt)<=5000000000n,'FRESH_APPLICATION');}
  check(ns(recordedAt)>=ns(event.appliedAt),'EVENT_PERSISTENCE_CLOCK');afterFrozenStart(event,state.manifest.recordedAt);
  const report=replayEngineeringContinuation(p,state.parent,[...state.events,event],event.appliedAt);currentParent(root,p,recordedAt);
  publishMockJournalRecord(join(state.dir,'event-'+String(state.events.length+1).padStart(4,'0')+'.json'),{previous:state.tip,recordedAt,event,sha256:sha(encode(event))},interrupt);
  return report;
 });
}
function afterFrozenStart(e,at){
 const r=parse(e.original.rawJson);check(ns(r.intent.requestedAt)>ns(at),'QUOTE_BEFORE_FROZEN_START');
 // Missing/stale quotes are retained as failed events; a present pre-start source
 // cannot acquire prospective timing merely by delaying its application.
 const response=r.capture.receipts?.at(-1)?.response;
 const body=response?.structuredContent??response?.structured_content??(response?.data?response:response?.content?.filter(x=>x.type==='text').length===1?parse(response.content.find(x=>x.type==='text').text):null);
 const qs=body?.data?.results;
 if(Array.isArray(qs))for(const row of qs)if(row?.quote?.updated_at)check(ns(row.quote.updated_at)>ns(at),'SOURCE_BEFORE_FROZEN_START');
}
export function recoverEngineeringContinuation({root,accountId,asOf}){directory(root,accountId);return withSpyEngineeringWriter(root,accountId,()=>load(root,accountId,asOf));}
