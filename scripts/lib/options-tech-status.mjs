import fs from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {verifyMockJournalRecords} from './options-isolated-mock-journal.mjs';
import {replayMockSpread} from './options-tech-mock-spread.mjs';
import {techStatusCodes} from './options-tech-status-codes.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const one=(v,values)=>values.includes(v)?v:'UNKNOWN';
const clock=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v)&&Number.isFinite(Date.parse(v))?v:null;
const symbols=['AAPL','TSM','QQQ','TSLA'];
const states=['UNKNOWN','BLOCKED','PASS','NOT_ASSESSED','NOT_ADMISSIBLE','SNAPSHOT_ONLY','MISSING','NOT_EXECUTABLE','COHERENT_BATCH_EVIDENCE_ONLY','MOCK_PLAN_READY','REAL_QUOTE_PAPER_PLAN_READY','NO_ENTRY','OPEN_UNRESOLVED','CLOSED_MODELED','BLOCKED_UNSUPPORTED_RESIDUAL','RETAINED_UNVALIDATED','CONTINUE_EVENT_RESEARCH','NOT_ARMED','NOT_ADMITTED','EXPLICIT_MOCK_ASSUMPTION','TEST_FIXTURE','ATTRIBUTED_NOT_AUTHENTICATED','ATTRIBUTED_REVIEW_PASSED','UNQUALIFIED_EVIDENCE','DOCUMENT_EVIDENCE_PASSED'];
const accounts=['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'];
const codes=values=>[...new Set(values.filter(v=>typeof v==='string').map(v=>techStatusCodes.has(v)?v:'UNRECOGNIZED_REASON_REVIEW_LOCAL_RECEIPT'))].slice(0,100);
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs,s.nlink].join('|');
const check=(v,code)=>{if(!v)throw Error(code);};
const checkedCodes=r=>[...(r.checks??[]).filter(c=>c.status!=='PASS').flatMap(c=>[c.code,...(c.detail?.blockers??[])]),...(r.blockers??[])];
const context=r=>r.evidenceContext==='TEST_FIXTURE'||r.testFixtureOnly===true?'TEST_FIXTURE':r.mode==='MOCK'||r.mode==='MOCK_CONTROL'?'MOCK':r.evidenceContext==='ATTRIBUTED_REAL_EVIDENCE'?'ATTRIBUTED_REAL_EVIDENCE':r.mode==='REAL_SAVED_SOURCE_REPLAY'?'REAL_SAVED_SOURCE_REPLAY':'UNKNOWN';

/** Allowlist projection only: never serialize source text, account data, raw envelopes or local paths. */
export function projectTechReceipt(r,digest,at){
 const a=r.assessment??r,kind=one(r.version,['TECH36_CANDIDATE_RECEIPT_V1','TECH_PAPER_FEASIBILITY_RECEIPT_V1','TECH_SPREAD_PREFLIGHT_V1','TECH_SPREAD_PLAN_PREVIEW_V1','TECH_QUOTE_PAPER_DEBIT_SPREAD_REPORT_V1','TECH_MOCK_DEBIT_SPREAD_REPORT_V1','TECH_MOCK_DEBIT_SPREAD_REPORT_V2','TECH_MOCK_DEBIT_SPREAD_RESIDUAL_REPORT_V2']);
 check(kind!=='UNKNOWN','UNSUPPORTED_RECEIPT');
 const recordedAt=clock(r.recordedAt??a.assessedAt??a.plan?.provenance?.preflightAt);
 check(!recordedAt||Date.parse(recordedAt)<=Date.parse(at),'FUTURE_RECEIPT');
 const research=a.research??a.plan?.research,quote=a.quote??a.quotePair??a.preflight?.quotePair;
 const researchStatus=research?.status??(research?.researchPlan?'RETAINED_UNVALIDATED':'UNKNOWN');
 return {sourceRef:digest,kind,recordedAt,recordClockBasis:r.recordedAt?'RECORDED_AT':a.assessedAt?'ASSESSED_AT':a.plan?.provenance?.preflightAt?'PREFLIGHT_AT':'UNKNOWN',temporalStatus:recordedAt?'HISTORICAL_SAVED_EVIDENCE':'SOURCE_CLOCK_UNKNOWN',
  evidenceContext:context(a),mode:one(a.mode,['MOCK','MOCK_CONTROL','REAL_SAVED_SOURCE_REPLAY','REAL_QUOTE_PAPER']),
  symbol:one(a.symbol??research?.symbol??a.candidate?.symbol??a.plan?.candidate?.symbol??a.legs?.[0]?.snapshot?.symbol,symbols),
  research:{status:one(researchStatus,states),direction:one(research?.direction??research?.fundamental?.direction,['UP','DOWN','NEUTRAL']),registeredAt:clock(research?.conditions?.registeredAt??research?.researchPlan?.registeredAt),blockers:codes(research?.blockers??[])},
  quote:{status:one(quote?.status,states),blockers:codes([...(quote?.blockers??[]),...(a.legs??[]).flatMap(l=>l.blockers??[])]),sourceClocks:(a.legs??[]).map(l=>clock(l.snapshot?.updatedAt)).filter(Boolean).slice(0,2)},
  accountEvidence:Object.fromEntries(accounts.map(k=>[k,one(a.accountChecks?.[k]?.status??a.evidenceState?.[k],states)])),
  planStatus:one(a.status,states),
  paperStatus:one(a.admission?.status??a.paper?.status??(Array.isArray(a.orders)?a.status:'NOT_ASSESSED'),states),
  modeledOrderCount:Array.isArray(a.orders)?a.orders.length:null,
  blockers:codes([...checkedCodes(a),...(a.admission?.blockers??[]),...(a.paper?.blockers??[]),...(a.frozenBlockers??[]),...(a.diagnostics??[]).flatMap(d=>d.codes??[])]),
  authority:'SAVED_RECEIPT_NOT_REVALIDATED',currentAdmission:'NOT_EVALUATED',realAcceptance:'NOT_TESTED',executionAllowed:false};
}

/** Bounded immediate-directory inventory. No recover(): it can mkdir/unlink pending journal files. */
export function readTechStatus({root=process.cwd(),at=new Date().toISOString()}={}){
 const out={version:'TECH_WORKBENCH_STATUS_V1',checkedAt:clock(at),state:'MISSING',records:[],issues:[],
  scope:'DIRECT_LOCAL_DEVELOPMENT_RECEIPTS_AND_SPREAD_JOURNALS',capability:'ISOLATED_ONE_CONTRACT_SAME_DAY_CDS_PDS',
  realAcceptance:'NOT_TESTED',executionAllowed:false,sourceCalls:0,fileSystemWrites:0};
 let bytesRead=0;
 const read=p=>{const before=fs.lstatSync(p);check(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<2e6,'UNSAFE_OR_OVERSIZE_FILE');bytesRead+=before.size;check(bytesRead<=32*1024*1024,'READ_BOUND');const bytes=fs.readFileSync(p);check(stamp(before)===stamp(fs.lstatSync(p)),'CHANGED_DURING_READ');return {data:parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),digest:hash(bytes)};};
 const issue=(ref,code)=>out.issues.push({sourceRef:hash(ref),code:['READ_BOUND','DIRECTORY_BOUND','FILE_BOUND','UNSAFE_PATH','UNSAFE_OR_OVERSIZE_FILE','CHANGED_DURING_READ','FUTURE_RECEIPT','UNSUPPORTED_RECEIPT'].includes(code)?code:'INVALID_SAVED_EVIDENCE'});
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
      row.authority='VERIFIED_JOURNAL_REPLAY_NOT_SOURCE_AUTHENTICATION';row.recordedAt=clock(m.data.recordedAt);row.recordClockBasis='JOURNAL_START_RECORDED_AT';check(row.recordedAt&&Date.parse(row.recordedAt)<=Date.parse(at),'FUTURE_RECEIPT');
      row.temporalStatus='SAVED_JOURNAL_REPLAY';row.planStatus=report.mode==='MOCK'?'MOCK_PLAN_READY':'REAL_QUOTE_PAPER_PLAN_READY';row.research=projectTechReceipt({...report,research:m.data.input.research},m.digest,at).research;
      row.accountEvidence=Object.fromEntries(accounts.map(k=>[k,report.mode==='MOCK'?'EXPLICIT_MOCK_ASSUMPTION':report.evidenceContext==='TEST_FIXTURE'?'TEST_FIXTURE':'ATTRIBUTED_NOT_AUTHENTICATED']));
      out.records.push(row);
     }
    }
    const candidates=names.filter(n=>/^(?:assessment-.*|[A-Z]+-tech-feasibility-v1|real-report-\d+|real-rejection-\d+|[a-z0-9-]+-preview)\.json$/.test(n));check(candidates.length<=100,'FILE_BOUND');
    for(const name of candidates){try{const r=read(resolve(path,name));out.records.push(projectTechReceipt(r.data,r.digest,at));}catch(e){issue(dir.name+'/'+name,e.message);}}
    check(JSON.stringify(names)===JSON.stringify(fs.readdirSync(path).sort()),'CHANGED_DURING_READ');
   }catch(e){out.records.length=beforeCount;issue(dir.name,e.message);}
  }
  out.records.sort((a,b)=>(b.recordedAt??'').localeCompare(a.recordedAt??'')||a.sourceRef.localeCompare(b.sourceRef));
  out.state=out.issues.length?'PARTIAL':out.records.length?'AVAILABLE':'MISSING';
 }catch(e){out.state='BLOCKED';out.records=[];issue('inventory',e.message);}
 return out;
}
