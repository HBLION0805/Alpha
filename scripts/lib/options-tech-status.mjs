import fs from 'node:fs';
import {readWeeklyResearchView} from './options-weekly-research-view.mjs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {verifyMockJournalRecords} from './options-isolated-mock-journal.mjs';
import {replayMockSpread} from './options-tech-mock-spread.mjs';
import {techStatusCodes} from './options-tech-status-codes.mjs';
import {readTechResearchView} from './options-tech-research-view.mjs';
import {readEngineeringStatus} from './options-engineering-status.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const one=(v,values)=>values.includes(v)?v:'UNKNOWN';
const clock=v=>{try{snapshotNs(v);return v;}catch{return null;}};
const symbols=['AAPL','TSM','QQQ','TSLA'];
const researchStates=['UNKNOWN','BLOCKED','RETAINED_UNVALIDATED','CONTINUE_EVENT_RESEARCH'];
const quoteStates=['UNKNOWN','BLOCKED','NOT_ASSESSED','NOT_ADMISSIBLE','SNAPSHOT_ONLY','MISSING','NOT_EXECUTABLE','COHERENT_BATCH_EVIDENCE_ONLY'];
const accountStates=['UNKNOWN','BLOCKED','EXPLICIT_MOCK_ASSUMPTION','TEST_FIXTURE','ATTRIBUTED_NOT_AUTHENTICATED','ATTRIBUTED_REVIEW_PASSED','UNQUALIFIED_EVIDENCE','DOCUMENT_EVIDENCE_PASSED','SIMULATED_ACCOUNT_ASSUMPTION'];
const paperStates=['UNKNOWN','NO_ENTRY','OPEN_UNRESOLVED','CLOSED_MODELED','BLOCKED_UNSUPPORTED_RESIDUAL'];
const accounts=['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'];
const codes=values=>[...new Set(values.filter(v=>typeof v==='string').map(v=>techStatusCodes.has(v)?v:'UNRECOGNIZED_REASON_REVIEW_LOCAL_RECEIPT'))].slice(0,100);
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs,s.nlink].join('|');
const check=(v,code)=>{if(!v)throw Error(code);};
const checkedCodes=r=>[...(r.checks??[]).filter(c=>c.status!=='PASS').flatMap(c=>[c.code,...(c.detail?.blockers??[])]),...(r.blockers??[])];
const context=r=>['SIMULATED_ACCOUNT_REAL_MARKET_DATA','TEST_FIXTURE_SIMULATED_ACCOUNT'].includes(r.evidenceContext)?r.evidenceContext:r.evidenceContext==='TEST_FIXTURE'||r.testFixtureOnly===true?'TEST_FIXTURE':r.mode==='MOCK'||r.mode==='MOCK_CONTROL'?'MOCK':r.evidenceContext==='ATTRIBUTED_REAL_EVIDENCE'?'ATTRIBUTED_REAL_EVIDENCE':r.mode==='REAL_SAVED_SOURCE_REPLAY'?'REAL_SAVED_SOURCE_REPLAY':'UNKNOWN';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const candidateVersion='TECH36_CANDIDATE_ASSESSMENT_V1';
function candidateSchema(a){
 check(object(a)&&a.version===candidateVersion&&['scanId','candidateId','eventId'].every(k=>typeof a[k]==='string'&&a[k].length>0&&a[k].length<=240)&&symbols.includes(a.symbol),'INVALID_CANDIDATE_SCHEMA');
 check(['SAVED_SOURCE_ASSESSMENT_NO_LIFECYCLE','CLOSED_SESSION_SAVED_SOURCE_REPLAY'].includes(a.validationMode)&&object(a.research)&&object(a.quote)&&object(a.accountChecks)&&object(a.admission),'INVALID_CANDIDATE_SCHEMA');
 check(a.admission.status==='NOT_ADMITTED'&&a.admission.paperAdmissionAllowed===false&&a.admission.executionAllowed===false&&a.admission.fills===0&&a.admission.pnl===null&&Array.isArray(a.admission.blockers),'INVALID_CANDIDATE_SCHEMA');
 return {claimRef:hash(canonical([a.scanId,a.candidateId,a.eventId,a.assessedAt])),assessmentDigest:hash(canonical(a))};
}

function projectedClocks(r,a,{at,cli,candidate,feasibility}){
 check(clock(at),'INVALID_RECEIPT_CLOCK');const now=snapshotNs(at);
 const read=(value,required=false)=>{
  if(value===undefined||value===null){check(!required,'RECEIPT_CLOCK_MISSING');return null;}
  check(clock(value),'INVALID_RECEIPT_CLOCK');check(snapshotNs(value)<=now,'FUTURE_RECEIPT');return value;
 };
 const savedAt=read(r.recordedAt,(candidate&&!cli)||feasibility),assessmentAt=read(a.assessedAt,candidate||feasibility),preflightAt=read(a.plan?.provenance?.preflightAt);
 if(savedAt)for(const v of [assessmentAt,preflightAt])if(v)check(snapshotNs(v)<=snapshotNs(savedAt),'RECEIPT_CLOCK_ORDER');
 if(assessmentAt&&preflightAt)check(snapshotNs(preflightAt)<=snapshotNs(assessmentAt),'RECEIPT_CLOCK_ORDER');
 const research=a.research??a.plan?.research,registrations=[read(research?.conditions?.registeredAt),read(research?.researchPlan?.registeredAt)].filter(Boolean);
 if(registrations.length===2)check(snapshotNs(registrations[0])===snapshotNs(registrations[1]),'RECEIPT_CLOCK_ORDER');
 const evaluatedAt=assessmentAt??preflightAt??savedAt;
 for(const v of registrations)if(evaluatedAt)check(snapshotNs(v)<=snapshotNs(evaluatedAt),'RECEIPT_CLOCK_ORDER');
 // Do not hide a malformed/future displayed quote clock behind a valid report clock.
 for(const leg of a.legs??[])read(leg.snapshot?.updatedAt);
 return {savedAt,assessmentAt,preflightAt};
}

// Correlate claims only; retain every source independently. Never join pipeline stages.
export function associateTechSources(records){
 for(const r of records){
  const peers=r.claimRef?records.filter(p=>p!==r&&p.claimRef===r.claimRef):[];
  r.association={status:peers.some(p=>p.assessmentDigest!==r.assessmentDigest)?'CONFLICTING_ASSESSMENTS':peers.length?'DUPLICATE_ASSESSMENT':'INDEPENDENT_SOURCE',
   sameAssessmentSources:peers.filter(p=>p.assessmentDigest===r.assessmentDigest).map(p=>p.locationRef),conflictingSources:peers.filter(p=>p.assessmentDigest!==r.assessmentDigest).map(p=>p.locationRef),merged:false};
 }
}

/** Allowlist projection only: never serialize source text, account data, raw envelopes or local paths. */
export function projectTechReceipt(r,digest,at){
 check(object(r),'INVALID_SAVED_EVIDENCE');
 const cli=r.version===undefined&&r.assessment?.version===candidateVersion;
 if(r.version===undefined&&r.report?.version==='TECH_MOCK_RESIDUAL_PREVIEW_V1')throw Error('UNVERSIONED_RESIDUAL_AUDIT_WRAPPER');
 if(cli)check(Object.keys(r).sort().join(',')==='assessment,receiptPath'&&typeof r.receiptPath==='string'&&r.receiptPath.length>0&&r.receiptPath.length<=2000,'INVALID_CANDIDATE_CLI_ENVELOPE');
 const a=r.assessment??r,kind=cli?candidateVersion:one(r.version,['TECH36_CANDIDATE_RECEIPT_V1','TECH_PAPER_FEASIBILITY_RECEIPT_V1','TECH_SPREAD_PREFLIGHT_V1','TECH_SPREAD_PLAN_PREVIEW_V1','TECH_QUOTE_PAPER_DEBIT_SPREAD_REPORT_V1','TECH_MOCK_DEBIT_SPREAD_REPORT_V1','TECH_MOCK_DEBIT_SPREAD_REPORT_V2','TECH_MOCK_DEBIT_SPREAD_RESIDUAL_REPORT_V2']);
 check(kind!=='UNKNOWN','UNSUPPORTED_RECEIPT');
 const candidate=cli||kind==='TECH36_CANDIDATE_RECEIPT_V1',claim=candidate?candidateSchema(a):{};
 const feasibility=kind==='TECH_PAPER_FEASIBILITY_RECEIPT_V1',planPreview=kind==='TECH_SPREAD_PLAN_PREVIEW_V1';
 const journalReport=['TECH_QUOTE_PAPER_DEBIT_SPREAD_REPORT_V1','TECH_MOCK_DEBIT_SPREAD_REPORT_V1','TECH_MOCK_DEBIT_SPREAD_REPORT_V2','TECH_MOCK_DEBIT_SPREAD_RESIDUAL_REPORT_V2'].includes(kind);
 const clocks=projectedClocks(r,a,{at,cli,candidate,feasibility});
 const recordedAt=clocks.savedAt??clocks.assessmentAt??clocks.preflightAt;
 const research=a.research??a.plan?.research,quote=a.quote??a.quotePair??a.preflight?.quotePair;
 const researchStatus=research?.status??(research?.researchPlan?'RETAINED_UNVALIDATED':'UNKNOWN');
 return {sourceRef:digest,kind,...claim,clocks,envelope:cli?'PUBLISHED_CLI_RESULT_WITHOUT_ENVELOPE_VERSION':'VERSIONED_RECEIPT',recordedAt,recordClockBasis:r.recordedAt?'RECORDED_AT':a.assessedAt?'ASSESSED_AT':a.plan?.provenance?.preflightAt?'PREFLIGHT_AT':'UNKNOWN',temporalStatus:recordedAt?'HISTORICAL_SAVED_EVIDENCE':'SOURCE_CLOCK_UNKNOWN',
  evidenceContext:context(a),mode:one(a.mode,['MOCK','MOCK_CONTROL','REAL_SAVED_SOURCE_REPLAY','REAL_QUOTE_PAPER']),
  symbol:one(a.symbol??research?.symbol??a.candidate?.symbol??a.plan?.candidate?.symbol??a.legs?.[0]?.snapshot?.symbol,symbols),
  research:{status:one(researchStatus,researchStates),direction:one(research?.direction??research?.fundamental?.direction,['UP','DOWN','NEUTRAL']),registeredAt:clock(research?.conditions?.registeredAt??research?.researchPlan?.registeredAt),blockers:codes(research?.blockers??[])},
  quote:{status:one(quote?.status,quoteStates),blockers:codes([...(quote?.blockers??[]),...(a.legs??[]).flatMap(l=>l.blockers??[])]),sourceClocks:(a.legs??[]).map(l=>clock(l.snapshot?.updatedAt)).filter(Boolean).slice(0,2)},
  accountEvidence:Object.fromEntries(accounts.map(k=>[k,one(a.accountChecks?.[k]?.status??a.evidenceState?.[k],accountStates)])),
  planStatus:planPreview?one(a.status,['BLOCKED','MOCK_PLAN_READY','REAL_QUOTE_PAPER_PLAN_READY']):'NOT_ASSESSED',
  paperStatus:candidate?'NOT_ADMITTED':feasibility?one(a.paper?.status,['NOT_ARMED']):journalReport?one(a.status,paperStates):'NOT_ASSESSED',
  modeledOrderCount:journalReport&&Array.isArray(a.orders)?a.orders.length:null,
  blockers:codes([...checkedCodes(a),...(a.admission?.blockers??[]),...(a.paper?.blockers??[]),...(a.frozenBlockers??[]),...(a.diagnostics??[]).flatMap(d=>d.codes??[])]),
  authority:'SAVED_RECEIPT_NOT_REVALIDATED',currentAdmission:'NOT_EVALUATED',realAcceptance:'NOT_TESTED',executionAllowed:false};
}

/** Bounded immediate-directory inventory. No recover(): it can mkdir/unlink pending journal files. */
export function readTechStatus({root=process.cwd(),engineeringRoot=root,weeklyResearchRoot=engineeringRoot,at=new Date().toISOString()}={}){
 const out={version:'TECH_WORKBENCH_STATUS_V1',checkedAt:clock(at),state:'MISSING',records:[],issues:[],
  scope:'DIRECT_LOCAL_DEVELOPMENT_RECEIPTS_AND_SPREAD_JOURNALS',capability:'ISOLATED_ONE_CONTRACT_SAME_DAY_CDS_PDS',
  realAcceptance:'NOT_TESTED',executionAllowed:false,sourceCalls:0,fileSystemWrites:0,weeklyResearch:readWeeklyResearchView({root:weeklyResearchRoot,at}),researchDetails:readTechResearchView({root,at}),engineering:readEngineeringStatus({root:engineeringRoot,at})};
 let bytesRead=0;
 const read=p=>{const before=fs.lstatSync(p);check(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<2e6,'UNSAFE_OR_OVERSIZE_FILE');bytesRead+=before.size;check(bytesRead<=32*1024*1024,'READ_BOUND');const bytes=fs.readFileSync(p);check(stamp(before)===stamp(fs.lstatSync(p)),'CHANGED_DURING_READ');let data;try{data=parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('MALFORMED_JSON');}return {data,digest:hash(bytes)};};
 const issue=(ref,code,digest=null)=>out.issues.push({locationRef:hash(ref),sourceRef:digest,code:['READ_BOUND','DIRECTORY_BOUND','FILE_BOUND','UNSAFE_PATH','UNSAFE_OR_OVERSIZE_FILE','CHANGED_DURING_READ','FUTURE_RECEIPT','RECEIPT_CLOCK_MISSING','INVALID_RECEIPT_CLOCK','RECEIPT_CLOCK_ORDER','UNSUPPORTED_RECEIPT','UNVERSIONED_RESIDUAL_AUDIT_WRAPPER','INVALID_CANDIDATE_SCHEMA','INVALID_CANDIDATE_CLI_ENVELOPE','MALFORMED_JSON','CONFLICTING_ASSESSMENTS'].includes(code)?code:'INVALID_SAVED_EVIDENCE'});
 try{
  check(out.checkedAt,'INVALID_CLOCK');let base=fs.realpathSync(root);
  for(const part of ['data','runtime','options-workbench-development']){base=resolve(base,part);let s;try{s=fs.lstatSync(base);}catch(e){if(e.code==='ENOENT')return out;throw e;}check(s.isDirectory()&&!s.isSymbolicLink()&&fs.realpathSync(base)===base,'UNSAFE_PATH');}
  const dirs=fs.readdirSync(base,{withFileTypes:true}).filter(d=>d.isDirectory()||d.isSymbolicLink());check(dirs.length<=100,'DIRECTORY_BOUND');
  for(const dir of dirs){
   const beforeCount=out.records.length;
   try{
    const path=resolve(base,dir.name);check(!dir.isSymbolicLink()&&fs.realpathSync(path)===path,'UNSAFE_PATH');
    const names=fs.readdirSync(path).sort();check(names.length<=2100,'FILE_BOUND');
    if(names.includes('start.json')){
     const m=read(resolve(path,'start.json'));
     if(m.data.version==='TECH_MOCK_SPREAD_START_V1'){
      check(/^(mock|paper)-[a-z0-9-]{1,60}$/.test(dir.name)&&dir.name.startsWith(m.data.input.mode==='REAL_QUOTE_PAPER'?'paper-':'mock-'),'RUN_MODE_SCOPE');
      const rows=names.filter(n=>n.startsWith('event-')).map(name=>({name,value:read(resolve(path,name)).data}));
      const verified=verifyMockJournalRecords(m.data,rows,'TECH_MOCK_SPREAD_START_V1');
      const report=replayMockSpread(verified.manifest.input,verified.events,at),row=projectTechReceipt(report,m.digest,at);
      row.authority='VERIFIED_JOURNAL_REPLAY_NOT_SOURCE_AUTHENTICATION';row.recordedAt=clock(m.data.recordedAt);row.recordClockBasis='JOURNAL_START_RECORDED_AT';check(row.recordedAt&&snapshotNs(row.recordedAt)<=snapshotNs(at),'FUTURE_RECEIPT');
      row.temporalStatus='SAVED_JOURNAL_REPLAY';row.planStatus=report.mode==='MOCK'?'MOCK_PLAN_READY':'REAL_QUOTE_PAPER_PLAN_READY';row.research=projectTechReceipt({...report,research:m.data.input.research},m.digest,at).research;
      const simulated=['SIMULATED_ACCOUNT_REAL_MARKET_DATA','TEST_FIXTURE_SIMULATED_ACCOUNT'].includes(report.evidenceContext);if(simulated)check(dir.name===m.data.input.account.id,'SIMULATED_ACCOUNT_RUN_SCOPE');
      row.accountEvidence=Object.fromEntries(accounts.map(k=>[k,simulated&&k!=='DATA_ENTITLEMENT'?'SIMULATED_ACCOUNT_ASSUMPTION':report.mode==='MOCK'?'EXPLICIT_MOCK_ASSUMPTION':['TEST_FIXTURE','TEST_FIXTURE_SIMULATED_ACCOUNT'].includes(report.evidenceContext)?'TEST_FIXTURE':'ATTRIBUTED_NOT_AUTHENTICATED']));
      row.containerRef=hash(dir.name);row.locationRef=hash(dir.name+'/start.json');out.records.push(row);
     }
    }
    const candidates=names.filter(n=>/^(?:assessment-.*|[A-Z]+-tech-feasibility-v1|real-report-\d+|real-rejection-\d+|[a-z0-9-]+-preview)\.json$/.test(n));check(candidates.length<=100,'FILE_BOUND');
    for(const name of candidates){let r;try{r=read(resolve(path,name));out.records.push({...projectTechReceipt(r.data,r.digest,at),containerRef:hash(dir.name),locationRef:hash(dir.name+'/'+name)});}catch(e){issue(dir.name+'/'+name,e.message,r?.digest);}}
    check(JSON.stringify(names)===JSON.stringify(fs.readdirSync(path).sort()),'CHANGED_DURING_READ');
   }catch(e){out.records.length=beforeCount;issue(dir.name,e.message);}
  }
  out.records.sort((a,b)=>(b.recordedAt??'').localeCompare(a.recordedAt??'')||a.sourceRef.localeCompare(b.sourceRef));
  associateTechSources(out.records);
  for(const row of out.records.filter(r=>r.association.status==='CONFLICTING_ASSESSMENTS'))out.issues.push({locationRef:row.locationRef,sourceRef:row.sourceRef,code:'CONFLICTING_ASSESSMENTS'});
  out.state=out.issues.length?'PARTIAL':out.records.length?'AVAILABLE':'MISSING';
 }catch(e){out.state='BLOCKED';out.records=[];issue('inventory',e.message);}
 return out;
}
