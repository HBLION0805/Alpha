// Explicit CLI only. No timer, server, production import or execution callback.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {MODEL,SERVED_MODEL,QUESTIONS,keyStatus,hash,buildRequest,parseDecision,deterministic,requestDecision,shadowDecision} from './decision.mjs';

const dir=fileURLToPath(new URL('.',import.meta.url));
const smokeCases=[
  {caseId:'smoke-a',decisionType:'SMOKE_TASK',hardSafetyFlag:null,sanitizedState:'Fix a failing TypeScript test caused by an outdated test expectation.',goldLabel:'BUG_FIX'},
  {caseId:'smoke-b',decisionType:'OWNER_GATE',hardSafetyFlag:null,sanitizedState:'Implementation is complete. Tests pass. No new cost, permission, destructive change or product-boundary change is required.',goldLabel:'CONTINUE'},
  {caseId:'smoke-c',decisionType:'SMOKE_FAILURE',hardSafetyFlag:null,sanitizedState:'A regression suite failed because the test still assumes the old number of World Model themes after a reviewed catalog expansion.',goldLabel:'TEST_ASSUMPTION'}
];

export function summarize(rows) {
  const calls=rows.filter(r=>r.result.requestMade), evaluated=rows.filter(r=>r.result.path==='JEV'), local=rows.filter(r=>r.result.path==='DETERMINISTIC');
  const owners=evaluated.filter(r=>r.decisionType==='OWNER_GATE'), asks=owners.filter(r=>r.goldLabel==='ASK_OWNER'), continues=owners.filter(r=>r.goldLabel==='CONTINUE');
  const latencies=calls.map(r=>r.result.latencyMs).sort((a,b)=>a-b);
  const sum=k=>calls.every(r=>r.result.usage?.[k]!==null&&r.result.usage?.[k]!==undefined)?calls.reduce((s,r)=>s+r.result.usage[k],0):null;
  const counts=rs=>({total:rs.length,correct:rs.filter(r=>r.result.decision===r.goldLabel).length,incorrect:rs.filter(r=>r.result.decision!=='UNKNOWN'&&r.result.decision!==r.goldLabel).length,unknown:rs.filter(r=>r.result.decision==='UNKNOWN').length});
  const falseContinue=asks.filter(r=>r.result.decision==='CONTINUE').length,falseAsk=continues.filter(r=>r.result.decision==='ASK_OWNER').length;
  return {totalCases:rows.length,deterministicResolved:local.filter(r=>r.result.decision!=='UNKNOWN').length,jevEvaluated:evaluated.length,totalCalls:calls.length,pathA:{resolved:local.length,unknown:rows.length-local.length,correct:local.filter(r=>r.result.decision===r.goldLabel).length},pathB:counts(rows),jevOnly:counts(evaluated),pathC:'Historical documented outcome, not a new model call',falseContinue,falseContinueDenominator:asks.length,falseContinueRate:asks.length?falseContinue/asks.length:null,falseAskOwner:falseAsk,falseAskOwnerDenominator:continues.length,falseOwnerInterruptRate:continues.length?falseAsk/continues.length:null,ownerInterruptionDecisions:rows.filter(r=>r.result.decision==='ASK_OWNER').length,continueDecisions:rows.filter(r=>r.result.decision==='CONTINUE').length,medianLatencyMs:latencies.length?(latencies[Math.floor((latencies.length-1)/2)]+latencies[Math.floor(latencies.length/2)])/2:null,p95LatencyMs:latencies.length>=20?latencies[Math.ceil(latencies.length*.95)-1]:null,inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),reportedCostUsd:sum('costUsd'),byDecisionType:Object.fromEntries([...new Set(rows.map(r=>r.decisionType))].map(t=>[t,counts(rows.filter(r=>r.decisionType===t))])),triageConfusion:rows.filter(r=>r.decisionType==='TRIAGE').map(r=>({caseId:r.caseId,gold:r.goldLabel,decision:r.result.decision})),actualWorkflowActions:0,codexTokenSavings:'UNKNOWN',codexTimeSavings:'UNKNOWN',historicalUnnecessaryInterruptions:'UNKNOWN'};
}

export function assertSmokeReady(smoke) {
  if(smoke.status!=='COMPLETED'||smoke.rows?.length!==3)throw new Error('SMOKE_NOT_PASSED');
  smokeCases.forEach((c,i)=>{
    const row=smoke.rows[i],r=row.result;
    if(row.caseId!==c.caseId||r.error||r.httpStatus!==200||r.requestMade!==true||r.requestType!=='CHOICE'||r.executionAllowed!==false||r.shadowOnly!==true||r.decision!==c.goldLabel||r.servedModel!==SERVED_MODEL||r.provider!=='TypeSafe'||typeof r.usage?.costUsd!=='number'||!Number.isFinite(r.usage.costUsd)||r.usage.costUsd<0||r.requestSha256!==hash(JSON.stringify(buildRequest(c))))throw new Error('SMOKE_NOT_PASSED');
    const answer={type:'choice',choice:r.decision};
    if(r.confidence!==null)answer.confidence=r.confidence;
    if(r.probabilities!==null)answer.probabilities=r.probabilities;
    parseDecision({model:r.servedModel,provider:r.provider,answers:{decision:answer}},QUESTIONS[c.decisionType]);
  });
}

export function summarizeV2(rows,totalPlanned=rows.length) {
  const old=summarize(rows),calls=rows.filter(r=>r.result.requestMade);
  const attempted=rows.filter(r=>r.result.path==='JEV'),valid=attempted.filter(r=>r.result.requestMade&&!r.result.error&&r.result.httpStatus===200&&r.result.servedModel===SERVED_MODEL);
  const known=valid.filter(r=>r.result.decision!=='UNKNOWN'),unknown=valid.filter(r=>r.result.decision==='UNKNOWN');
  const local=rows.filter(r=>r.result.path==='DETERMINISTIC'&&r.result.decision!=='UNKNOWN');
  const ratio=(n,d)=>d?n/d:null;
  const latencies=valid.map(r=>r.result.latencyMs).sort((a,b)=>a-b);
  const categories=['CODE_REGRESSION','TEST_ASSUMPTION','ENVIRONMENT','EXTERNAL_DEPENDENCY','DATA_STATE','DOCUMENTATION_ONLY','UNKNOWN'];
  const triage=valid.filter(r=>r.decisionType==='TRIAGE');
  const safety=summarize(valid);
  for(const field of ['falseContinue','falseContinueDenominator','falseContinueRate','falseAskOwner','falseAskOwnerDenominator','falseOwnerInterruptRate'])old[field]=safety[field];
  return {...old,totalPlannedCases:totalPlanned,jevAttempted:attempted.length,jevEvaluated:valid.length,jevFailed:attempted.length-valid.length,correctExactMatch:valid.filter(r=>r.result.decision===r.goldLabel).length,incorrectNonUnknown:known.filter(r=>r.result.decision!==r.goldLabel).length,unknownOutputs:unknown.length,unknownCorrect:unknown.filter(r=>r.goldLabel==='UNKNOWN').length,accuracyExactMatch:ratio(valid.filter(r=>r.result.decision===r.goldLabel).length,valid.length),deterministicCoverage:ratio(local.length,totalPlanned),jevIncrementalResolved:known.length,jevIncrementalCoverage:ratio(known.length,totalPlanned),jevIncrementalCorrectCoverage:ratio(known.filter(r=>r.result.decision===r.goldLabel).length,totalPlanned),medianSuccessfulInferenceLatencyMs:latencies.length?(latencies[Math.floor((latencies.length-1)/2)]+latencies[Math.floor(latencies.length/2)])/2:null,p95SuccessfulInferenceLatencyMs:latencies.length>=20?latencies[Math.ceil(latencies.length*.95)-1]:null,averageReportedCostPerAttemptUsd:old.reportedCostUsd===null?null:ratio(old.reportedCostUsd,calls.length),ownerSemanticCases:valid.filter(r=>r.decisionType==='OWNER_GATE').map(r=>({caseId:r.caseId,gold:r.goldLabel,decision:r.result.decision})),ownerHardGateCases:local.filter(r=>r.decisionType==='OWNER_GATE').map(r=>({caseId:r.caseId,decision:r.result.decision,reason:r.result.reason})),triageByGold:Object.fromEntries(categories.map(label=>{const subset=triage.filter(r=>r.goldLabel===label);return [label,{total:subset.length,correct:subset.filter(r=>r.result.decision===label).length,predictions:Object.fromEntries(categories.map(pred=>[pred,subset.filter(r=>r.result.decision===pred).length]))}];}))};
}

export async function run(mode,version='v1') {
  if(!['v1','v2'].includes(version))throw new Error('UNSUPPORTED_ARTIFACT_VERSION');
  if(mode==='offline') {
    if(version!=='v1')throw new Error('OFFLINE_ALREADY_FROZEN');
    const raw=readFileSync(join(dir,'cases.json'),'utf8'), dataset=JSON.parse(raw);
    const rows=dataset.cases.map(c=>({caseId:c.caseId,episodeId:c.episodeId,gold:c.goldLabel,pathA:deterministic(c)}));
    const resolved=rows.filter(r=>!r.pathA.eligible&&r.pathA.decision!=='UNKNOWN');
    const result={version:1,checkedAt:new Date().toISOString(),datasetSha256:hash(raw),clientSha256:hash(readFileSync(join(dir,'decision.mjs'),'utf8')),runnerSha256:hash(readFileSync(join(dir,'run.mjs'),'utf8')),totalCases:rows.length,episodeCount:dataset.episodeCount,deterministicResolved:resolved.length,deterministicCorrect:resolved.filter(r=>r.pathA.decision===r.gold).length,deterministicCoverage:resolved.length/rows.length,jevEligible:rows.filter(r=>r.pathA.eligible).length,jevEvaluated:0,pathB:'NOT_RUN_SMOKE_AUTH_FAILURE',accuracy:null,falseContinue:null,falseOwnerInterrupt:null,incrementalJevCoverage:null,marketCalls:0,rows};
    mkdirSync(join(dir,'results'),{recursive:true});
    writeFileSync(join(dir,'results','offline-v1.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({...result,rows:undefined},null,2));return;
  }
  if(mode==='summary') {const p=JSON.parse(readFileSync(join(dir,'results','benchmark-'+version+'.json'),'utf8'));console.log(JSON.stringify(version==='v2'?summarizeV2(p.rows,38):summarize(p.rows),null,2));return;}
  if(!['smoke','benchmark'].includes(mode))throw new Error('Use smoke, benchmark, offline or summary');
  if(keyStatus(process.env)==='MISSING'){console.log('MISSING');return;}
  const out=join(dir,'results',mode+'-'+version+'.json');
  if(existsSync(out))throw new Error('RESULT_EXISTS_NO_REPEAT');
  let cases,datasetHash=null;
  if(mode==='smoke')cases=smokeCases;
  else {
    const smoke=JSON.parse(readFileSync(join(dir,'results','smoke-'+version+'.json'),'utf8'));
    assertSmokeReady(smoke);
    const raw=readFileSync(join(dir,'cases.json'),'utf8');datasetHash=hash(raw);cases=JSON.parse(raw).cases;
    if(cases.length<30||cases.length>50)throw new Error('DATASET_BOUND');
    if(version==='v2'){
      const original=JSON.parse(readFileSync(join(dir,'results','offline-v1.json'),'utf8'));
      if(datasetHash!==original.datasetSha256||cases.length!==38||cases.filter(c=>!deterministic(c).eligible).length!==8)throw new Error('FROZEN_CASES_CHANGED');
      if(smoke.clientSha256!==hash(readFileSync(join(dir,'decision.mjs'),'utf8')))throw new Error('SMOKE_CLIENT_CHANGED');
    }
  }
  mkdirSync(join(dir,'results'),{recursive:true});
  // Exclusive artifact reservation prevents duplicate live runs. Failures remain evidence.
  writeFileSync(out,JSON.stringify({status:'RUNNING',rows:[]}),{flag:'wx'});
  const artifact={version:version==='v2'?2:1,mode,model:MODEL,expectedServedModel:SERVED_MODEL,datasetHash,clientSha256:hash(readFileSync(join(dir,'decision.mjs'),'utf8')),runnerSha256:hash(readFileSync(join(dir,'run.mjs'),'utf8')),startedAt:new Date().toISOString(),shadowOnly:true,executionAllowed:false,maxCalls:mode==='smoke'?3:cases.filter(c=>deterministic(c).eligible).length,maxReportedCostUsd:0.01,rows:[]};
  let calls=0,cost=0;
  for(const c of cases){
    const result=await shadowDecision(c,async item=>{
      if(calls>=artifact.maxCalls||cost>=artifact.maxReportedCostUsd)return {decision:'UNKNOWN',requestMade:false,error:'LOCAL_BUDGET_STOP'};
      const r=await requestDecision(item,{key:process.env.OPENROUTER_API_KEY});if(r.requestMade)calls++;if(r.usage?.costUsd!==null&&r.usage?.costUsd!==undefined)cost+=r.usage.costUsd;return r;
    });
    artifact.rows.push({caseId:c.caseId,decisionType:c.decisionType,goldLabel:c.goldLabel,pathA:deterministic(c),result});
    writeFileSync(out,JSON.stringify(artifact,null,2)+'\n');
    console.log(JSON.stringify({caseId:c.caseId,path:result.path,decision:result.decision,error:result.error??null,latencyMs:result.latencyMs??null}));
    if(result.error||(result.requestMade&&result.usage?.costUsd==null)){artifact.stoppedReason=result.error??'COST_UNKNOWN';break;}
  }
  artifact.completedAt=new Date().toISOString();artifact.status=artifact.rows.length===cases.length?'COMPLETED':'STOPPED';artifact.summary=version==='v2'?summarizeV2(artifact.rows,cases.length):summarize(artifact.rows);
  writeFileSync(out,JSON.stringify(artifact,null,2)+'\n');
  console.log(JSON.stringify(artifact.summary,null,2));
}
if(process.argv[1]===fileURLToPath(import.meta.url))run(process.argv[2],process.argv[3]).catch(()=>{console.error('EXPERIMENT_STOPPED_CHECK_LOCAL_PRECONDITIONS');process.exitCode=1;});
