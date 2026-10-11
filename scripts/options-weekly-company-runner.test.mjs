import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {runCompanyRunner,companyRunnerStatus,stopCompanyRunner,recoverCompanyRunner} from './lib/options-weekly-company-runner.mjs';
import {COMPANY_REFRESH_IDS,VERIFIED_IR_IDS,VERIFIED_SEC_IDS,companySourceDue,readCompanyRefreshConfig,companyRefreshPlan,refreshCompanySources} from './lib/options-weekly-company-refresh-policy.mjs';
import {refreshWeeklyIssuerSources,readWeeklyIssuerRefreshes} from './lib/options-weekly-issuer-sources.mjs';
import {readPdfMetadata,checkPdfMetadata,PDF_INTERVAL_MS,PDF_METADATA_ID} from './lib/options-weekly-pdf-metadata.mjs';
import {CBOE_PDF_URL} from './lib/options-weekly-source-supplement.mjs';
import {sourceHash} from './lib/options-weekly-source-storage.mjs';
import {runCompanyRefresh} from './options-weekly-company-runner.mjs';
const HOUR=3600000,start=Date.parse('2026-10-11T08:00:00.000Z'),iso=t=>new Date(t).toISOString();
const temp=async f=>{const root=fs.mkdtempSync(join(tmpdir(),'alpha-company-runner-'));try{return await f(root);}finally{fs.rmSync(root,{recursive:true,force:true});}};
const html='<link rel="canonical" href="https://www.microsoft.com/en-us/investor/default"/>The next earnings release will be on October 28, 2026.';
const ok=()=>new Response(html,{headers:{'content-type':'text/html'}});
const seed=(root,t=start-HOUR)=>refreshWeeklyIssuerSources({root,sourceIds:['msft_ir'],now:()=>iso(t),fetchImplementation:async()=>ok()});
const opts=(root,extra={})=>({root,sourceIds:['msft_ir'],until:iso(start+5000),now:()=>iso(start),intervalMinutes:60,maxAttempts:1,evidenceContext:'TEST_FIXTURE',...extra});
let passed=0,total=0;const check=(name,f)=>{total++;test(name,async()=>{await f();passed++;});};after(()=>console.log(`Weekly company runner: ${passed}/${total} tests passed.`));
check('allowlist admits 11 verified IR and 36 SEC only; configs cannot opt blocked sites in',async()=>temp(async root=>{
 assert.equal(VERIFIED_IR_IDS.length,11);assert.equal(VERIFIED_SEC_IDS.length,36);assert(!COMPANY_REFRESH_IDS.includes('aapl_ir'));assert(!COMPANY_REFRESH_IDS.includes('pltr_ir'));
 const path='config.json',config={version:'WEEKLY_COMPANY_REFRESH_CONFIG_V1',enabledSourceIds:['msft_ir'],intervalMinutes:360,maxAttempts:20,batches:{sample:['msft_ir']}};
 fs.writeFileSync(join(root,path),JSON.stringify(config));assert.equal(readCompanyRefreshConfig(root,path).batches.sample.length,1);
 for(const patch of [{enabledSourceIds:['aapl_ir']},{intervalMinutes:59},{maxAttempts:21},{batches:{all:VERIFIED_SEC_IDS}}]){fs.writeFileSync(join(root,path),JSON.stringify({...config,...patch}));assert.throws(()=>readCompanyRefreshConfig(root,path));}
 await assert.rejects(runCompanyRefresh(['--run','--until','a','--until','b']),/ARGUMENTS/);
}));
check('unsafe scope, oversized batch, budget and unbounded lifetime reject before writes',async()=>temp(async root=>{
 for(const extra of [{sourceIds:['aapl_ir']},{sourceIds:VERIFIED_IR_IDS},{maxAttempts:21},{until:iso(start+25*HOUR)},{intervalMinutes:59}])await assert.rejects(runCompanyRunner(opts(root,extra)));
 assert.deepEqual(fs.readdirSync(root),[]);
}));
check('no saved verified baseline means no acquisition and explicit disabled reason',async()=>temp(async root=>{
 const r=await runCompanyRunner(opts(root,{fetchImplementation:()=>assert.fail()}));assert.equal(r.state,'NO_ELIGIBLE_SOURCES_REQUIRES_REVIEW');assert.equal(r.events.at(-2).details.sources[0].blockedReason,'NO_VERIFIED_SAVED_BASELINE');
}));
check('due acquisition preserves original, consumes one budget, and leaves headline ownership untouched',async()=>temp(async root=>{
 await seed(root);const old=readWeeklyIssuerRefreshes(root,iso(start)).records[0],path=join(root,'data/runtime/options-weekly-sources/runner');fs.mkdirSync(path,{recursive:true});fs.writeFileSync(join(path,'active.json'),'original headline ownership');
 let calls=0;const r=await runCompanyRunner(opts(root,{fetchImplementation:async()=>{calls++;return ok();}}));
 assert.equal(r.state,'BUDGET_EXHAUSTED');assert.equal(calls,1);assert.equal(companyRunnerStatus(root).state,'NOT_RUNNING');assert.equal(fs.readFileSync(join(path,'active.json'),'utf8'),'original headline ownership');
 const rows=readWeeklyIssuerRefreshes(root,iso(start)).records;assert.equal(rows.length,2);assert.equal(rows[0].recordFingerprint,old.recordFingerprint);assert.equal(r.events.find(e=>e.type==='ATTEMPT_STARTED').details.eligibility.lastRequestedAt,iso(start-HOUR));
}));
check('restart and configured six-hour interval cannot bypass saved request spacing',async()=>temp(async root=>{
 await seed(root);let t=start,calls=0;
 const r=await runCompanyRunner(opts(root,{intervalMinutes:360,maxAttempts:2,now:()=>iso(t),wait:async ms=>{t+=ms;},fetchImplementation:()=>{calls++;return ok();}}));
 assert.equal(r.state,'EXPIRED');assert.equal(calls,0);assert.equal(r.events.find(e=>e.type==='WAITING').details.nextEligibleAt,iso(start+5*HOUR));
}));
check('HTTP denial stops batch and latest failure remains disabled after restart',async()=>temp(async root=>{
 await seed(root);let calls=0;const r=await runCompanyRunner(opts(root,{maxAttempts:2,fetchImplementation:async()=>{calls++;return new Response('denied',{status:403});}}));assert.equal(r.state,'HTTP_DENIAL_REQUIRES_REVIEW');
 const later=start+2*HOUR,r2=await runCompanyRunner(opts(root,{now:()=>iso(later),until:iso(later+5000),fetchImplementation:()=>assert.fail()}));assert.equal(r2.state,'NO_ELIGIBLE_SOURCES_REQUIRES_REVIEW');assert.equal(calls,1);
}));
check('parse or dynamic-layout failure disables source without an automatic retry',async()=>temp(async root=>{
 await seed(root);const r=await runCompanyRunner(opts(root,{maxAttempts:2,fetchImplementation:async()=>new Response('<main>loading</main>',{headers:{'content-type':'text/html'}})}));assert.equal(r.state,'NO_ELIGIBLE_SOURCES_REQUIRES_REVIEW');assert.equal(r.events.filter(e=>e.type==='ATTEMPT_STARTED').length,1);
}));
check('duplicate company owner and recovery cannot steal a live run; stop is explicit',async()=>temp(async root=>{
 await seed(root);let t=start,once=false;const r=await runCompanyRunner(opts(root,{firstAt:iso(start+3000),now:()=>iso(t),fetchImplementation:()=>assert.fail(),wait:async ms=>{
  if(!once){once=true;const state=companyRunnerStatus(root);await assert.rejects(runCompanyRunner(opts(root)),e=>e.code==='EEXIST');assert.throws(()=>recoverCompanyRunner(root,state.runId),/NOT_PROVEN_ABSENT/);stopCompanyRunner(root,state.runId,()=>iso(t));}t+=ms;
 }}));assert.equal(r.state,'STOPPED_BY_REQUEST');
}));
check('unresolved issuer claim blocks without deleting it or contacting a source',async()=>temp(async root=>{
 await seed(root);const p=join(root,'data/runtime/options-weekly-sources/issuer-refreshes/msft_ir.lock');fs.writeFileSync(p,'unfinished');await assert.rejects(runCompanyRunner(opts(root,{fetchImplementation:()=>assert.fail()})),/SOURCE_STORE_REQUIRES_REVIEW/);assert.equal(fs.readFileSync(p,'utf8'),'unfinished');
}));
check('sleep beyond deadline produces no catch-up requests',async()=>temp(async root=>{
 await seed(root);let t=start;const r=await runCompanyRunner(opts(root,{firstAt:iso(start+3000),now:()=>iso(t),wait:async()=>{t+=HOUR;},fetchImplementation:()=>assert.fail()}));assert.equal(r.state,'EXPIRED');
}));
check('signal cancels bounded transport and retains original failure envelope',async()=>temp(async root=>{
 await seed(root);const c=new AbortController();const r=await runCompanyRunner(opts(root,{signal:c.signal,fetchImplementation:()=>{c.abort();return new Promise(()=>{});}}));assert.equal(r.state,'STOPPED_BY_SIGNAL');assert.equal(readWeeklyIssuerRefreshes(root,iso(start)).records.at(-1).transportError,'CANCELLED');
}));
check('SEC reuses serial spacing, identification and immutable submissions parser',async()=>temp(async root=>{
 const body={cik:'0000320193',name:'Apple Inc.',tickers:['AAPL'],filings:{recent:{accessionNumber:[],filingDate:[],reportDate:[],acceptanceDateTime:[],form:[],primaryDocument:[]},files:[]}};
 const response=()=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
 await refreshWeeklyIssuerSources({root,sourceIds:['aapl_sec'],now:()=>iso(start-HOUR),fetchImplementation:async()=>response()});const wall=Date.now();let calls=0;
 const r=await runCompanyRunner(opts(root,{sourceIds:['aapl_sec'],fetchImplementation:async(url,options)=>{calls++;assert(Date.now()-wall>=1000);assert.match(url,/CIK0000320193/);assert.equal(options.redirect,'manual');assert.equal(options.headers['User-Agent'],'Alpha-Options-Research/0.2 (public source review)');return response();}}));assert.equal(calls,1);assert.equal(r.state,'BUDGET_EXHAUSTED');
}));
function pdfSeed(root,t=start-PDF_INTERVAL_MS){const raw=Buffer.from('%PDF-1.6\nTEST_FIXTURE\n%%EOF'),r={version:'CBOE_PDF_ACQUISITION_V1',url:CBOE_PDF_URL,requestedAt:iso(t),receivedAt:iso(t),bodyComplete:true,error:null,rawBase64:raw.toString('base64'),rawSha256:sourceHash(raw),headers:{etag:'"fixture-v1"'}};const bytes=JSON.stringify(r),path='pdf-baseline.json';fs.writeFileSync(join(root,path),bytes);return {path,sha256:sourceHash(bytes)};}
check('PDF metadata is at least weekly and does not download a body even when changed',async()=>temp(async root=>{
 const baseline=pdfSeed(root);let calls=0;const r=await checkPdfMetadata({root,baseline,now:()=>iso(start),fetchImplementation:async(url,o)=>{calls++;assert.equal(o.method,'HEAD');assert.equal(o.headers['If-None-Match'],'"fixture-v1"');return new Response(null,{headers:{etag:'"fixture-v2"'}});}});
 assert.equal(r.state,'CHANGED_REQUIRES_REVIEW');const saved=readPdfMetadata(root,iso(start),baseline);assert.deepEqual(saved.issues,[]);assert.equal(saved.records.at(-1).downloadedBodyBytes,0);assert.equal(companySourceDue(saved.records,PDF_METADATA_ID,HOUR,iso(start),{pdfMetadataEnabled:true}).blockedReason,'CHANGED_REQUIRES_REVIEW');
 const second=await checkPdfMetadata({root,baseline,now:()=>iso(start+HOUR),fetchImplementation:()=>assert.fail()});assert.equal(second.status,'COOLDOWN');assert.equal(calls,1);
}));
check('PDF missing baseline, early check and redirected/error response never trigger GET fallback',async()=>temp(async root=>{
 await assert.rejects(checkPdfMetadata({root,fetchImplementation:()=>assert.fail()}),/REQUIRES_REVIEW/);const baseline=pdfSeed(root,start-86400000);
 const early=await checkPdfMetadata({root,baseline,now:()=>iso(start),fetchImplementation:()=>assert.fail()});assert.equal(early.status,'COOLDOWN');
 const late=start+PDF_INTERVAL_MS;const r=await checkPdfMetadata({root,baseline,now:()=>iso(late),fetchImplementation:async()=>new Response(null,{status:302,headers:{location:'https://example.test'}})});assert.equal(r.status,'ACQUISITION_FAILED');
}));
check('PDF 304 records server claim without refreshing mapped dates',async()=>temp(async root=>{
 const baseline=pdfSeed(root),r=await checkPdfMetadata({root,baseline,now:()=>iso(start),fetchImplementation:async()=>new Response(null,{status:304})});assert.equal(r.state,'NOT_MODIFIED_BY_SERVER');assert.equal(readPdfMetadata(root,iso(start),baseline).records.at(-1).dateMappingUpdated,false);
}));
check('read-only plan lists configured, disabled, last and next without starting a process',async()=>temp(async root=>{
 await seed(root);const p=companyRefreshPlan(root,{enabledSourceIds:['msft_ir'],intervalMinutes:360},iso(start));assert.equal(p.processStarted,false);assert.equal(p.rows.find(r=>r.sourceId==='msft_ir').nextEligibleAt,iso(start+5*HOUR));assert(p.disabledCatalog.some(r=>r.sourceId==='hpe_ir'));assert.equal(companyRunnerStatus(root).state,'NOT_RUNNING');
}));
check('real-time expiry cancels a pending request and preserves its receipt',async()=>temp(async root=>{
 await seed(root,Date.now()-HOUR-1000);const t=Date.now(),r=await runCompanyRunner({root,sourceIds:['msft_ir'],intervalMinutes:60,until:iso(t+150),fetchImplementation:()=>new Promise(()=>{}),evidenceContext:'TEST_FIXTURE'});
 assert.equal(r.state,'EXPIRED');assert.equal(readWeeklyIssuerRefreshes(root,new Date().toISOString()).records.at(-1).transportError,'DEADLINE_EXCEEDED');assert(Date.now()-t<3000);
}));
check('actual interrupted child is reported and recovery never removes issuer claims',async()=>temp(async root=>{
 await seed(root,Date.now()-HOUR);const config={version:'WEEKLY_COMPANY_REFRESH_CONFIG_V1',enabledSourceIds:['msft_ir'],intervalMinutes:60,maxAttempts:1,batches:{sample:['msft_ir']}};fs.writeFileSync(join(root,'config.json'),JSON.stringify(config));
 const t=Date.now(),child=spawn(process.execPath,['scripts/options-weekly-company-runner.mjs','--run','--workspace',root,'--config','config.json','--batch','sample','--first-at',iso(t+30000),'--until',iso(t+60000)],{cwd:process.cwd(),windowsHide:true,stdio:'ignore'}),exit=new Promise((yes,no)=>{child.once('exit',yes);child.once('error',no);});let state;
 try{for(let i=0;i<80;i++){try{const r=companyRunnerStatus(root);if(r.activeRunId&&r.lastEvent){state=r;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(state);child.kill('SIGKILL');await exit;assert.equal(companyRunnerStatus(root,state.runId).state,'INTERRUPTED_REQUIRES_RECOVERY');
  const claim=join(root,'data/runtime/options-weekly-sources/issuer-refreshes/msft_ir.lock');fs.writeFileSync(claim,'unfinished');recoverCompanyRunner(root,state.runId);assert.equal(fs.readFileSync(claim,'utf8'),'unfinished');assert.equal(companyRunnerStatus(root).state,'NOT_RUNNING');
 }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exit;}}
}));
check('disabled or missing PDF flag rejects retained PDF IDs and batches during config validation',async()=>temp(async root=>{
 const c={version:'WEEKLY_COMPANY_REFRESH_CONFIG_V1',enabledSourceIds:[PDF_METADATA_ID],intervalMinutes:360,maxAttempts:1,batches:{pdf:[PDF_METADATA_ID]}};
 for(const value of [false,undefined,'true',1]){fs.writeFileSync(join(root,'config.json'),JSON.stringify({...c,pdfMetadata:{enabled:value}}));assert.throws(()=>readCompanyRefreshConfig(root,'config.json'),/PDF_METADATA_DISABLED/);}
 fs.writeFileSync(join(root,'config.json'),JSON.stringify({...c,pdfMetadata:{enabled:true}}));assert.equal(readCompanyRefreshConfig(root,'config.json').pdfMetadata.enabled,true);
}));
check('runner independently rejects PDF selection when disabled, even bypassing CLI config parsing',async()=>temp(async root=>{
 const baseline=pdfSeed(root),records=readPdfMetadata(root,iso(start),baseline).records;
 for(const enabled of [false,undefined,'true'])await assert.rejects(runCompanyRunner(opts(root,{sourceIds:[PDF_METADATA_ID],configEvidence:{configuration:{pdfMetadata:{enabled}}},fetchImplementation:()=>assert.fail()})),/PDF_METADATA_DISABLED/);
 assert.equal(companyRunnerStatus(root).state,'NOT_RUNNING');assert.equal(companySourceDue(records,PDF_METADATA_ID,HOUR,iso(start)).blockedReason,'PDF_METADATA_DISABLED');assert.equal(companySourceDue(records,PDF_METADATA_ID,HOUR,iso(start),{pdfMetadataEnabled:true}).blockedReason,null);
 const plan=companyRefreshPlan(root,{enabledSourceIds:[PDF_METADATA_ID],intervalMinutes:360,pdfMetadata:{enabled:false}},iso(start));assert.equal(plan.rows.find(r=>r.sourceId===PDF_METADATA_ID).configured,false);
}));
check('PDF dispatch denies disabled state and permits explicitly enabled due HEAD only',async()=>temp(async root=>{
 const baseline=pdfSeed(root),args={root,sourceIds:[PDF_METADATA_ID],baseline,now:()=>iso(start),fetchImplementation:()=>assert.fail()};
 await assert.rejects(refreshCompanySources(args),/PDF_METADATA_DISABLED/);await assert.rejects(refreshCompanySources({...args,pdfMetadataEnabled:false}),/PDF_METADATA_DISABLED/);
 let calls=0;const r=await refreshCompanySources({...args,pdfMetadataEnabled:true,fetchImplementation:async(url,o)=>{calls++;assert.equal(o.method,'HEAD');return new Response(null,{status:304});}});assert.equal(calls,1);assert.equal(r.results[0].state,'NOT_MODIFIED_BY_SERVER');
}));
