import fs from 'node:fs';
import {resolve,relative,isAbsolute,sep,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {classifyAndRank} from './options-tech-review-ranking.mjs';
import {assessTechPaperFeasibility} from './options-tech-paper-feasibility.mjs';
import {normalizeTechOptionCapture,validateTechQuoteSelection} from './options-tech-quote-adapter.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {buildTechResearchInputs} from './options-tech-research-inputs.mjs';

export const TECH36_POOL=Object.freeze('AAPL MSFT GOOGL AMZN META NVDA TSLA AVGO AMD TSM ASML AMAT LRCX KLAC MU ARM QCOM ORCL CRM NOW PANW CRWD ADBE PLTR SNOW SNPS CDNS ANET CSCO VRT DELL HPE STX WDC APH ETN'.split(' '));
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=c=>{throw Error('TECH_CANDIDATE_'+c);};
const check=(v,c)=>{if(!v)fail(c);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const json=b=>parseChainSurveyJson(new TextDecoder('utf8',{fatal:true}).decode(b).replace(/^\uFEFF/,''));
const time=s=>{const t=Date.parse(s);check(Number.isFinite(t),'CLOCK');return t;};
function safePath(root,p){check(typeof p==='string'&&!isAbsolute(p),'PATH');const f=resolve(root,p),r=relative(root,f);check(r&&!r.startsWith('..')&&!isAbsolute(r),'PATH');return f;}
function reader(root){
 const base=fs.realpathSync(root),files=new Map();
 const read=p=>{const full=safePath(base,p),s=fs.lstatSync(full);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=12*1024*1024,'FILE');check(fs.realpathSync(full)===full,'PATH');const bytes=fs.readFileSync(full);files.set(p.replaceAll('\\','/'),bytes);check(files.size<=200,'FILE_COUNT');return bytes;};
 return {base,files,read,load:p=>json(read(p))};
}

/** Read-only replay of the existing fixed-pool discovery and retrospective ranking. */
export function loadTechCandidate(sourceRoot){
 const r=reader(sourceRoot),summary=r.load('derived-review-v1.2/summary.json');
 check(/^alpha-tech36-[a-zA-Z0-9-]+$/.test(summary.parentRunId),'RUN_ID');
 const scan='runs/'+summary.parentRunId+'/',policyBytes=r.read(scan+'policy.json'),policy=json(policyBytes);
 check(sha(policyBytes)===r.read(scan+'policy.sha256').toString().trim()&&sha(policyBytes)===summary.parentPolicySha256,'POLICY_HASH');
 check(policy.version==='ALPHA_TECH36_DISCOVERY_V1.1'&&policy.scanId===summary.parentRunId&&same(policy.pool,TECH36_POOL),'FIXED_POOL');
 const rulesBytes=r.read('review-rules-v1.2.json'),rules=json(rulesBytes),inputBytes=r.read('review-input-v1.2.json'),input=json(inputBytes);
 check(rules.version==='TECH36_REVIEW_RULES_V1.2'&&rules.parentRunId===policy.scanId&&rules.originalCutoff===policy.cutoffAt&&rules.maxFocus===5,'RULE_LINEAGE');
 check(sha(rulesBytes)===summary.ruleSha256&&input.ruleSha256===summary.ruleSha256&&sha(inputBytes)===summary.inputSha256&&input.parentRunId===policy.scanId,'REVIEW_HASH');
 check(time(input.createdAt)>=time(rules.frozenAt)&&time(summary.processedAt)>=time(input.createdAt),'REVIEW_CLOCK');
 const eventBytes=r.read(scan+'events.json'),events=json(eventBytes),coverage=r.load(scan+'coverage.json');
 check(sha(eventBytes)===summary.parentEventsSha256&&events.length===summary.originalDiscoveryRecords,'EVENT_HASH');
 check(coverage.length===72&&new Set(coverage.map(c=>c.symbol+'|'+c.sourceId)).size===72&&TECH36_POOL.every(s=>['SEC_SUBMISSIONS','GOOGLE_NEWS_RSS'].every(id=>coverage.some(c=>c.symbol===s&&c.sourceId===id))),'DISCOVERY_COVERAGE');
 const originals=r.load(scan+'originals.json'),receipts=r.load(scan+'http-receipts.json'),supplements=r.load(scan+'verification/receipts.json');
 for(const receipt of [...receipts,...supplements]){
  check(time(receipt.startedAt)>=time(policy.frozenAt)&&time(receipt.receivedAt)>=time(receipt.startedAt),'SOURCE_CLOCK');
  if(receipt.rawPath)check(sha(r.read(scan+receipt.rawPath))===receipt.sha256,'RAW_HASH');
 }
 for(const c of coverage){check(c.attempted===true&&receipts.some(x=>x.rawPath===c.rawPath&&x.sha256===c.sha256&&x.url===c.url),'COVERAGE_RECEIPT');}
 for(const row of input.reviews){check(events.some(e=>e.eventId===row.eventId&&e.symbols.includes(row.symbol)),'EVENT_COMPANY');if(row.originalVerified)check(originals.some(o=>o.eventId===row.eventId&&o.status==='SUCCESS'&&receipts.some(x=>x.rawPath===o.rawPath&&x.sha256===o.sha256)),'ORIGINAL_LINK');}
 const ranked=classifyAndRank(policy.pool,input.reviews,rules.maxFocus),saved=r.load('derived-review-v1.2/candidates.json');
 check(saved.length===36&&same(ranked.map(x=>[x.symbol,x.category,x.eventId??null,x.coreScore,x.dimensions]),saved.map(x=>[x.symbol,x.category,x.eventId??null,x.coreScore,x.dimensions])),'RANK_REPLAY');
 const selected=ranked.find(x=>x.category==='SELECTED');check(selected,'NO_CANDIDATE');
 const batchRoot='verification-batch2-errata-v1/',batch=r.load(batchRoot+'summary.json'),latest=r.load(batchRoot+'company-coverage-and-candidates.json');
 check(batch.parentRunId===policy.scanId&&batch.errataVersion===1&&latest.length===36&&new Set(latest.map(x=>x.symbol)).size===36&&latest.every(x=>TECH36_POOL.includes(x.symbol)),'FOLLOWUP_LINEAGE');
 const followup=latest.find(x=>x.symbol===selected.symbol);check(followup.classification==='PRIORITY_RESEARCH'&&batch.priorityResearch.includes(selected.symbol),'FOLLOWUP_CONFLICT');
 for(const receipt of followup.sourceReceipts??[]){if(receipt.rawPath)check(sha(r.read(batchRoot+receipt.rawPath))===receipt.sha256,'FOLLOWUP_RAW_HASH');}
 const selectedOriginals=[...originals,...supplements].filter(x=>x.eventId===selected.eventId);
 check(selectedOriginals.some(x=>x.rawPath.startsWith('verification/')&&x.status==='SUCCESS'),'EXHIBIT_REQUIRED');
 const candidate={...selected,candidateId:policy.scanId+'-'+selected.symbol,rank:1};
 return {files:r.files,lineage:{version:'TECH36_CANDIDATE_LINEAGE_V1',scanId:policy.scanId,scanPolicySha256:sha(policyBytes),rulesSha256:sha(rulesBytes),rulesMode:rules.mode,originalCutoff:policy.cutoffAt,lookbackStart:policy.lookbackStart,pool:policy.pool,coverage,candidate,ranking:ranked.map(x=>({symbol:x.symbol,category:x.category,coreScore:x.coreScore,valuation:x.dimensions.valuation,eventId:x.eventId??null})),originals:selectedOriginals,followup,followupBatch:batch,sourceReceiptCount:receipts.length+supplements.length,completePoolOpportunityScreen:false,excludedEventDoesNotExcludeCompany:true,executionAllowed:false}};
}

function runDirectory(root,id,create=false){
 check(/^[a-z0-9][a-z0-9-]{0,79}$/.test(id),'OUTPUT_ID');
 const base=resolve(fs.realpathSync(root),'data/runtime/options-workbench-development');check(fs.realpathSync(base)===base,'OUTPUT_SCOPE');
 const out=resolve(base,id);if(create)fs.mkdirSync(out);check(fs.realpathSync(out)===out&&!fs.lstatSync(out).isSymbolicLink(),'OUTPUT_SCOPE');return out;
}
const write=(p,data)=>fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
/** Explicit offline derivation: all 36 rows, inherited ranking, cited original text; no plan freeze. */
export function prepareTechResearchInputs({root,sourceRoot,runId,now=()=>new Date().toISOString()}){
 const {files,lineage}=loadTechCandidate(sourceRoot),at=now(),inputs=buildTechResearchInputs({files,lineage,at});
 const out=runDirectory(root,runId,true),manifest=[];
 for(const [p,b] of files){const target=resolve(out,'source',p);fs.mkdirSync(dirname(target),{recursive:true});fs.writeFileSync(target,b,{flag:'wx',mode:0o600});manifest.push({path:'source/'+p,sha256:sha(b)});}
 write(out+'/research-inputs.json',inputs);manifest.push({path:'research-inputs.json',sha256:sha(fs.readFileSync(out+'/research-inputs.json'))});
 const receipt={version:'TECH36_RESEARCH_INPUTS_RECEIPT_V1',runId,recordedAt:at,scanId:lineage.scanId,
  implementation:Object.fromEntries(['options-tech-candidate.mjs','options-tech-research-inputs.mjs','options-tech-review-ranking.mjs'].map(p=>[p,sha(fs.readFileSync(new URL(p,import.meta.url)))])),
  manifest,screeningTrace:inputs.screeningTrace,sourceReads:0,marketCalls:0,executionAllowed:false,paperAdmissionAllowed:false};
 write(out+'/receipt.json',receipt);return {runPath:out,receiptPath:out+'/receipt.json',...receipt};
}
export function prepareTechCandidate({root,sourceRoot,researchPath,runId,now=()=>new Date().toISOString()}){
 const {files,lineage}=loadTechCandidate(sourceRoot),r=reader(dirname(resolve(researchPath))),bytes=r.read(relative(r.base,resolve(researchPath))),research=json(bytes),at=now();
 check(research.parentRunId===lineage.scanId&&research.candidateId===lineage.candidate.candidateId&&research.eventId===lineage.candidate.eventId&&research.threeFacet?.symbol===lineage.candidate.symbol,'RESEARCH_LINK');
 check(time(research.threeFacet.asOf)<=time(at)&&time(research.threeFacet.researchPlan?.registeredAt)<=time(at),'RESEARCH_CLOCK');
 check(research.threeFacet.researchPlan.sourceIds.includes(lineage.candidate.eventId),'RESEARCH_EVENT');
 check(assessTechPaperFeasibility({research:research.threeFacet,at}).research.status==='RETAINED_UNVALIDATED','RESEARCH_SCHEMA');
 validateTechQuoteSelection(research.quoteSelection);check(research.quoteSelection.symbol===lineage.candidate.symbol,'SELECTION_SYMBOL');
 check(research.windows?.optionExpiry===research.quoteSelection.expiry&&time(research.windows.sixMonthOutlookEnd)>time(research.windows.sixMonthOutlookStart),'WINDOWS');
 const out=runDirectory(root,runId,true),manifest=[];
 for(const [p,b] of files){const target=resolve(out,'source',p);fs.mkdirSync(dirname(target),{recursive:true});fs.writeFileSync(target,b,{flag:'wx',mode:0o600});manifest.push({path:'source/'+p,sha256:sha(b)});}
 fs.writeFileSync(out+'/research.json',bytes,{flag:'wx',mode:0o600});manifest.push({path:'research.json',sha256:sha(bytes)});
 write(out+'/lineage.json',lineage);manifest.push({path:'lineage.json',sha256:sha(fs.readFileSync(out+'/lineage.json'))});
 const prepared={version:'TECH36_CANDIDATE_PREPARED_V1',runId,preparedAt:at,candidateId:lineage.candidate.candidateId,symbol:lineage.candidate.symbol,manifest,sourceAuthority:'COPIED_ORIGINALS_AND_ATTRIBUTED_REVIEW_NOT_MACHINE_AUTHENTICATION',executionAllowed:false};
 write(out+'/prepared.json',prepared);return {prepared,runPath:out};
}

/** Missing account evidence is a local admission blocker, never a company-direction verdict. */
export function assessCandidateInputs({prepared,lineage,research,quoteReceipt=null,evidence=null,at}){
 check(prepared.symbol===research.threeFacet?.symbol&&prepared.candidateId===research.candidateId&&lineage.candidate.candidateId===prepared.candidateId,'ASSESSMENT_IDENTITY');
 if(evidence){check(evidence.symbol===prepared.symbol&&time(evidence.decisionAt)>=time(prepared.preparedAt),'ACCOUNT_EVIDENCE_BINDING');}
 const base=assessTechPaperFeasibility({research:research.threeFacet,evidence,at});
 let quotes=null;const quoteBlockers=[];
 if(quoteReceipt){
  const c=quoteReceipt.capture;
  check(quoteReceipt.version==='TECH_QUOTES_RECEIPT_V1'&&c?.origin==='HOST_MARKET_TOOL_RESPONSES'&&sha(JSON.stringify(c))===quoteReceipt.captureSha256,'QUOTE_INTEGRITY');
  check(same(c.selection,research.quoteSelection)&&same(quoteReceipt.intent?.selection,research.quoteSelection)&&time(c.startedAt)>=time(quoteReceipt.intent.requestedAt),'QUOTE_BINDING');
  if(time(c.startedAt)<time(prepared.preparedAt)||time(quoteReceipt.intent.requestedAt)<time(prepared.preparedAt))quoteBlockers.push('CAPTURE_BEFORE_RESEARCH_PREPARATION_REPLAY_ONLY');
  quotes=normalizeTechOptionCapture(c,at);
  if(evidence){const supplied=evidence.records?.find(x=>x.kind==='QUOTE');check(supplied&&quotes.quotes.some(x=>x.snapshot&&same(json(Buffer.from(supplied.rawJson)),x.snapshot)),'ACCOUNT_QUOTE_BINDING');}
  if(!quotes.quotes?.length)quoteBlockers.push('EXACT_OPTION_QUOTE_MISSING');
  for(const q of quotes.quotes??[]){quoteBlockers.push(...q.blockers);if(!q.snapshot?.updatedAt||snapshotNs(q.snapshot.updatedAt)<=snapshotNs(research.threeFacet.researchPlan.registeredAt))quoteBlockers.push('QUOTE_NOT_AFTER_RESEARCH');}
 }else quoteBlockers.push('QUOTE_NOT_SUPPLIED');
 const session=paperSession(at,quotes?.quotes?.[0]?.snapshot?.chainSession);
 if(!session.isOpen)quoteBlockers.push('ASSESSMENT_OUTSIDE_SESSION');
 const accountChecks=Object.fromEntries(['DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS'].map(kind=>{
  const record=evidence?.records?.find(x=>x.kind===kind);
  return [kind,{status:record?(base.feasibilityPassed?'ATTRIBUTED_REVIEW_PASSED':'UNQUALIFIED_EVIDENCE'):'UNKNOWN',blocker:record?null:kind+'_UNKNOWN',affects:'PAPER_ADMISSION_ONLY',directionInferenceAllowed:false}];
 }));
 return {version:'TECH36_CANDIDATE_ASSESSMENT_V1',assessedAt:at,scanId:lineage.scanId,candidateId:prepared.candidateId,eventId:lineage.candidate.eventId,symbol:prepared.symbol,
  validationMode:session.isOpen?'SAVED_SOURCE_ASSESSMENT_NO_LIFECYCLE':'CLOSED_SESSION_SAVED_SOURCE_REPLAY',
  research:{status:'CONTINUE_EVENT_RESEARCH',direction:base.research.direction,ranking:lineage.candidate.rank,coreScore:lineage.candidate.coreScore,conditions:research.threeFacet.researchPlan,windows:research.windows,engine:base.research,accountUnknownDoesNotRejectDirection:true},
  quote:{status:quoteBlockers.length?'NOT_ADMISSIBLE':'SNAPSHOT_ONLY',blockers:[...new Set(quoteBlockers)],normalized:quotes,session,spreadPolicy:'INHERITED_GLD_IBIT_ENGINEERING_REFERENCE_TECH_APPLICABILITY_UNAPPROVED'},
  accountChecks,productChecks:{contractIdentity:quotes?.quotes?.length?'SOURCE_MAPPED_ONLY':'UNKNOWN',deliverable:'UNKNOWN_UNLESS_EXISTING_FEASIBILITY_PASSES',fees:evidence?'SEE_EXISTING_FEASIBILITY':'UNKNOWN',hedgeComparison:'UNKNOWN_NO_OPTION_RECOMMENDATION'},existingFeasibility:base,
  admission:{status:'NOT_ADMITTED',paperAdmissionAllowed:false,executionAllowed:false,fills:0,pnl:null,blockers:[...new Set(['TECH_SYMBOL_LIFECYCLE_NOT_INTEGRATED',...quoteBlockers,...Object.values(accountChecks).flatMap(x=>x.blocker?[x.blocker]:[]),...base.blockers,...base.research.blockers])]},
  limitations:['Historical scan and retrospective ranking are preserved; this is not a new full-pool scan.','Only the selected event is qualified for research; other company events remain unresolved.','No market-timing, account authentication, hedge cost or completed Paper lifecycle is established.']};
}
export function assessTechCandidate({root,runId,quotePath=null,evidencePath=null,now=()=>new Date().toISOString()}){
 const out=runDirectory(root,runId),r=reader(out),prepared=r.load('prepared.json');
 check(prepared.version==='TECH36_CANDIDATE_PREPARED_V1'&&prepared.runId===runId&&prepared.manifest.length<=200,'PREPARED');
 for(const f of prepared.manifest)check(sha(r.read(f.path))===f.sha256,'PREPARED_HASH');
 const research=r.load('research.json'),lineage=r.load('lineage.json');
 const replay=loadTechCandidate(out+'/source');check(same(replay.lineage,lineage),'LINEAGE_REPLAY');
 const external=p=>{if(!p)return null;const a=reader(dirname(resolve(p))),b=a.read(relative(a.base,resolve(p)));return {sha256:sha(b),utf8:b.toString('utf8'),data:json(b)};};
 const quote=external(quotePath),evidence=external(evidencePath),at=now();check(time(at)>=time(prepared.preparedAt),'ASSESSMENT_CLOCK');
 const assessment=assessCandidateInputs({prepared,lineage,research,quoteReceipt:quote?.data,evidence:evidence?.data,at});
 const implementation=Object.fromEntries(['options-tech-candidate.mjs','options-tech-review-ranking.mjs','options-tech-paper-feasibility.mjs','options-tech-quote-adapter.mjs'].map(p=>[p,sha(fs.readFileSync(new URL(p,import.meta.url)))]));
 const receipt={version:'TECH36_CANDIDATE_RECEIPT_V1',preparedSha256:sha(r.read('prepared.json')),recordedAt:at,implementation,inputs:{quote,evidence},assessment};
 const receiptPath=out+'/assessment-'+at.replace(/[:.]/g,'-')+'.json';write(receiptPath,receipt);
 return {receiptPath,assessment};
}
