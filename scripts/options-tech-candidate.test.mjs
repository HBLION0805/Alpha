// MOCK only: synthetic provenance files and injected source callbacks; no real market or account.
import nodeTest,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {TECH36_POOL,loadTechCandidate,prepareTechCandidate,assessTechCandidate,assessCandidateInputs} from './lib/options-tech-candidate.mjs';
import {classifyAndRank} from './lib/options-tech-review-ranking.mjs';
import {collectTechOptionQuotes,validateTechQuoteSelection} from './lib/options-tech-quote-adapter.mjs';
import {techCandidateCli} from './options-tech-candidate.mjs';
let total=0,passed=0;const test=(n,f)=>{total++;nodeTest('MOCK '+n,async()=>{await f();passed++;});};after(()=>console.log('Tech candidate handoff: '+passed+'/'+total+' tests passed.'));
const hash=b=>createHash('sha256').update(b).digest('hex'),at='2026-10-10T14:00:00.000Z',scanId='alpha-tech36-MOCK',scan='runs/'+scanId+'/';
const roots=[];after(()=>{for(const root of roots){const r=relative(tmpdir(),root);assert(!isAbsolute(r)&&r.startsWith('alpha-tech36-mock-')&&!r.startsWith('..'));fs.rmSync(root,{recursive:true,force:true});}});
function fixture(){
 const root=fs.mkdtempSync(join(tmpdir(),'alpha-tech36-mock-'));roots.push(root);
 const put=(p,data)=>{const f=join(root,p);fs.mkdirSync(join(f,'..'),{recursive:true});const b=typeof data==='string'?data:JSON.stringify(data);fs.writeFileSync(f,b);return hash(b);};
 const load=p=>JSON.parse(fs.readFileSync(join(root,p),'utf8'));
 const change=(p,f)=>{const data=load(p);f(data);put(p,data);};
 const policy={version:'ALPHA_TECH36_DISCOVERY_V1.1',scanId,mode:'MOCK',pool:[...TECH36_POOL],frozenAt:'2026-10-08T03:00:00.000Z',cutoffAt:'2026-10-08T03:00:00.000Z',lookbackStart:'2026-10-01T03:00:00.000Z'};
 const policySha=put(scan+'policy.json',policy);put(scan+'policy.sha256',policySha);
 const rules={version:'TECH36_REVIEW_RULES_V1.2',parentRunId:scanId,originalCutoff:policy.cutoffAt,maxFocus:5,frozenAt:'2026-10-08T04:00:00.000Z',mode:'MOCK_RETROSPECTIVE'};
 const rulesSha=put('review-rules-v1.2.json',rules);
 const reviews=['TSLA','SNPS'].map((symbol,i)=>({symbol,eventId:'MOCK-'+symbol,originalVerified:true,materialityReviewed:true,companyEventVerified:true,materialConflict:false,dimensions:{impact:3-i,catalyst:2,evidence:3,valuation:null}}));
 const inputSha=put('review-input-v1.2.json',{createdAt:'2026-10-08T04:01:00.000Z',parentRunId:scanId,ruleSha256:rulesSha,reviews});
 const events=reviews.map(r=>({eventId:r.eventId,symbols:[r.symbol]})),eventSha=put(scan+'events.json',events);
 const coverage=TECH36_POOL.flatMap(symbol=>['SEC_SUBMISSIONS','GOOGLE_NEWS_RSS'].map(sourceId=>{
  const rawPath='raw/'+symbol+'-'+sourceId+'.txt',sha256=put(scan+rawPath,'MOCK '+symbol+' '+sourceId);
  return {symbol,sourceId,status:'SUCCESS',attempted:true,rawPath,sha256,url:'https://example.invalid/'+rawPath,startedAt:'2026-10-08T03:01:00.000Z',receivedAt:'2026-10-08T03:01:01.000Z'};
 }));put(scan+'coverage.json',coverage);put(scan+'http-receipts.json',coverage);
 const originals=reviews.map(row=>{const r=coverage.find(x=>x.symbol===row.symbol&&x.sourceId==='SEC_SUBMISSIONS');return {...r,eventId:row.eventId};});put(scan+'originals.json',originals);
 const supplements=reviews.map(row=>{const rawPath='verification/'+row.symbol+'.txt';return {eventId:row.eventId,symbol:row.symbol,status:'SUCCESS',startedAt:'2026-10-08T03:02:00.000Z',receivedAt:'2026-10-08T03:02:01.000Z',rawPath,sha256:put(scan+rawPath,'MOCK exhibit '+row.symbol)};});put(scan+'verification/receipts.json',supplements);
 const ranked=classifyAndRank(policy.pool,reviews,5);put('derived-review-v1.2/candidates.json',ranked);
 put('derived-review-v1.2/summary.json',{parentRunId:scanId,parentPolicySha256:policySha,ruleSha256:rulesSha,inputSha256:inputSha,parentEventsSha256:eventSha,originalDiscoveryRecords:events.length,processedAt:'2026-10-08T04:02:00.000Z'});
 put('verification-batch2-errata-v1/summary.json',{parentRunId:scanId,errataVersion:1,priorityResearch:['TSLA','SNPS']});
 put('verification-batch2-errata-v1/company-coverage-and-candidates.json',TECH36_POOL.map(symbol=>({symbol,classification:reviews.some(x=>x.symbol===symbol)?'PRIORITY_RESEARCH':'MISSING_DATA',sourceReceipts:[]})));
 const research={parentRunId:scanId,candidateId:scanId+'-TSLA',eventId:'MOCK-TSLA',threeFacet:{version:'THREE_FACET_INPUT_V1',symbol:'TSLA',instrumentType:'EQUITY',asOf:at,holdingFrom:at,holdingThrough:'2026-10-23T20:00:00.000Z',researchPlan:{id:'MOCK',registeredAt:at,sourceIds:['MOCK-TSLA'],hypothesis:'MOCK unknown directional thesis',triggerCondition:'MOCK requires evidence',invalidationCondition:'MOCK counterevidence',exitCondition:'MOCK future review'}},quoteSelection:{symbol:'TSLA',expiry:'2026-10-23',strike:'380.00'},windows:{optionExpiry:'2026-10-23',sixMonthOutlookStart:at,sixMonthOutlookEnd:'2027-04-10T14:00:00.000Z'}};
 research.threeFacet.news={direction:'UNKNOWN',status:'UNKNOWN',validFrom:at,validThrough:research.threeFacet.holdingThrough,assumptionImpact:'NONE',materialChanges:[],trigger:'MOCK future event',triggerState:'PENDING',evidence:[{id:'MOCK-TSLA',kind:'NEWS',source:'MOCK SOURCE ONLY',receivedAt:'2026-10-08T04:02:00.000Z',reviewedAt:at,publishedAt:null}]};
 put('research-input.json',research);fs.mkdirSync(join(root,'data/runtime/options-workbench-development'),{recursive:true});
 const prepare=()=>prepareTechCandidate({root,sourceRoot:root,researchPath:join(root,'research-input.json'),runId:'mock-run',now:()=>at});
 return {root,put,load,change,prepare,research};
}
test('replays all 36 coverage rows and original rank without imputing valuation',()=>{const f=fixture(),r=loadTechCandidate(f.root);assert.equal(r.lineage.coverage.length,72);assert.equal(r.lineage.candidate.symbol,'TSLA');assert.equal(r.lineage.candidate.coreScore,8);assert.equal(r.lineage.candidate.dimensions.valuation,null);assert.equal(r.lineage.completePoolOpportunityScreen,false);});
for(const [name,mutate,code] of [
 ['manual five-company substitute',f=>f.change(scan+'policy.json',x=>x.pool=x.pool.slice(0,5)),'POLICY_HASH'],
 ['altered original bytes',f=>f.put(scan+'raw/TSLA-SEC_SUBMISSIONS.txt','tampered'),'RAW_HASH'],
 ['missing company source',f=>f.change(scan+'coverage.json',x=>x.pop()),'DISCOVERY_COVERAGE'],
 ['unbound source receipt',f=>f.change(scan+'coverage.json',x=>x[0].url='https://example.invalid/changed'),'COVERAGE_RECEIPT'],
 ['rewritten ranking',f=>f.change('derived-review-v1.2/candidates.json',x=>x.reverse()),'RANK_REPLAY'],
 ['later disqualification',f=>f.change('verification-batch2-errata-v1/company-coverage-and-candidates.json',x=>x.find(y=>y.symbol==='TSLA').classification='PENDING_VERIFICATION'),'FOLLOWUP_CONFLICT'],
 ['out-of-scope source path',f=>f.change(scan+'http-receipts.json',x=>x[0].rawPath='../'.repeat(9)+'private'),'PATH'],
 ['source before freeze',f=>f.change(scan+'http-receipts.json',x=>x[0].startedAt='2026-10-07T00:00:00Z'),'SOURCE_CLOCK'],
])test(name+' rejects with explicit lineage failure',()=>{const f=fixture();mutate(f);assert.throws(()=>loadTechCandidate(f.root),new RegExp(code));});
test('self-contained prepare is exclusive and never changes source bytes',()=>{const f=fixture(),before=fs.readFileSync(join(f.root,scan+'events.json')),p=f.prepare();assert(fs.existsSync(join(p.runPath,'source',scan,'events.json')));assert.throws(()=>f.prepare(),/EEXIST/);assert(fs.readFileSync(join(f.root,scan+'events.json')).equals(before));});
test('wrong research candidate cannot create a prepared run',()=>{const f=fixture();f.change('research-input.json',x=>x.candidateId='SNPS');assert.throws(()=>f.prepare(),/RESEARCH_LINK/);});
test('future research cannot be retrospectively frozen',()=>{const f=fixture();f.change('research-input.json',x=>x.threeFacet.asOf='2026-10-11T00:00:00Z');assert.throws(()=>f.prepare(),/RESEARCH_CLOCK/);});
test('research continues while each unknown account dimension locally blocks admission',()=>{const f=fixture();f.prepare();const r=assessTechCandidate({root:f.root,runId:'mock-run',now:()=>at}).assessment;assert.equal(r.research.status,'CONTINUE_EVENT_RESEARCH');assert.equal(r.research.direction,'UNKNOWN');for(const x of Object.values(r.accountChecks)){assert.equal(x.status,'UNKNOWN');assert.equal(x.directionInferenceAllowed,false);}assert.equal(r.admission.status,'NOT_ADMITTED');assert.equal(r.admission.fills,0);assert(r.quote.blockers.includes('ASSESSMENT_OUTSIDE_SESSION'));});
test('prepared input mutation is detected before assessment',()=>{const f=fixture(),p=f.prepare();fs.appendFileSync(join(p.runPath,'research.json'),' ');assert.throws(()=>assessTechCandidate({root:f.root,runId:'mock-run',now:()=>at}),/PREPARED_HASH/);});
test('TSLA source selection admitted but whole-pool quote expansion remains rejected',()=>{assert(validateTechQuoteSelection({symbol:'TSLA',expiry:'2026-10-23',strike:'380.00'}));assert.throws(()=>validateTechQuoteSelection({symbol:'SNPS',expiry:'2026-10-23',strike:'380.00'}),/SELECTION/);});
test('synthetic capture cannot become real candidate source evidence',()=>{const f=fixture(),p=f.prepare(),lineage=f.load('data/runtime/options-workbench-development/mock-run/lineage.json'),capture={origin:'SYNTHETIC_FIXTURE'};assert.throws(()=>assessCandidateInputs({prepared:p.prepared,lineage,research:f.research,quoteReceipt:{capture,captureSha256:hash(JSON.stringify(capture))},at}),/QUOTE_INTEGRITY/);});
test('saved source quotes before research retain exact clocks and fail prospective admission',async()=>{
 const f=fixture(),p=f.prepare(),lineage=f.load('data/runtime/options-workbench-development/mock-run/lineage.json');
 const chain='11111111-1111-4111-8111-111111111111',id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',old='2026-10-09T19:59:59.000Z';
 const source={get_option_chains:{chains:[{id:chain,symbol:'TSLA',expiration_dates:['2026-10-23'],trade_value_multiplier:'100',late_close_state:'disabled'}]},get_option_instruments:{instruments:[{id,chain_id:chain,chain_symbol:'TSLA',expiration_date:'2026-10-23',strike_price:'380.00',type:'call',state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}}]},get_equity_quotes:{results:[{quote:{symbol:'TSLA',last_trade_price:'380.00',venue_last_trade_time:old,state:'active',has_traded:true}}]},get_option_quotes:{results:[{quote:{instrument_id:id,bid_price:'4.00',ask_price:'4.50',bid_size:10,ask_size:10,updated_at:old}}]}};
 let calls=0;const capture=await collectTechOptionQuotes({selection:f.research.quoteSelection,clock:async()=>new Date(Date.parse(at)+1000*(++calls)).toISOString(),call:async name=>({data:source[name]})});
 const quoteReceipt={version:'TECH_QUOTES_RECEIPT_V1',capture,captureSha256:hash(JSON.stringify(capture)),intent:{selection:f.research.quoteSelection,requestedAt:at}};
 const a=assessCandidateInputs({prepared:p.prepared,lineage,research:f.research,quoteReceipt,at:'2026-10-10T14:01:00.000Z'});
 assert.equal(a.quote.normalized.quotes[0].snapshot.updatedAt,old);assert(a.quote.blockers.includes('QUOTE_NOT_AFTER_RESEARCH'));assert(a.quote.blockers.includes('QUOTE_STALE_NOW'));assert(a.quote.blockers.includes('ASSESSMENT_OUTSIDE_SESSION'));assert(a.quote.blockers.includes('EXISTING_MECHANICAL_SPREAD_LIMIT'));assert.equal(a.admission.fills,0);
 const wrong=structuredClone(quoteReceipt);wrong.intent.selection={...wrong.intent.selection,symbol:'AAPL'};assert.throws(()=>assessCandidateInputs({prepared:p.prepared,lineage,research:f.research,quoteReceipt:wrong,at:'2026-10-10T14:01:00.000Z'}),/QUOTE_BINDING/);
 const laterPrepared={...p.prepared,preparedAt:'2026-10-10T14:00:30.000Z'};const replay=assessCandidateInputs({prepared:laterPrepared,lineage,research:f.research,quoteReceipt,at:'2026-10-10T14:01:00.000Z'});assert(replay.quote.blockers.includes('CAPTURE_BEFORE_RESEARCH_PREPARATION_REPLAY_ONLY'));assert.equal(replay.admission.paperAdmissionAllowed,false);
});
test('CLI rejects out-of-scope arguments before writing',()=>{assert.throws(()=>techCandidateCli(['--assess','--run-id','x','--source-root','x']),/ARGUMENTS/);assert.throws(()=>techCandidateCli(['--prepare','--run-id','x','--research','x']),/ARGUMENTS/);});
