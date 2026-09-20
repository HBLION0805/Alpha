// Explicit CLI only. No timer, server, production import or execution callback.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {MODEL,SERVED_MODEL,keyStatus,hash,deterministic,requestDecision,shadowDecision} from './decision.mjs';

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

export async function run(mode) {
  if(mode==='offline') {
    const raw=readFileSync(join(dir,'cases.json'),'utf8'), dataset=JSON.parse(raw);
    const rows=dataset.cases.map(c=>({caseId:c.caseId,episodeId:c.episodeId,gold:c.goldLabel,pathA:deterministic(c)}));
    const resolved=rows.filter(r=>!r.pathA.eligible&&r.pathA.decision!=='UNKNOWN');
    const result={version:1,checkedAt:new Date().toISOString(),datasetSha256:hash(raw),clientSha256:hash(readFileSync(join(dir,'decision.mjs'),'utf8')),runnerSha256:hash(readFileSync(join(dir,'run.mjs'),'utf8')),totalCases:rows.length,episodeCount:dataset.episodeCount,deterministicResolved:resolved.length,deterministicCorrect:resolved.filter(r=>r.pathA.decision===r.gold).length,deterministicCoverage:resolved.length/rows.length,jevEligible:rows.filter(r=>r.pathA.eligible).length,jevEvaluated:0,pathB:'NOT_RUN_SMOKE_AUTH_FAILURE',accuracy:null,falseContinue:null,falseOwnerInterrupt:null,incrementalJevCoverage:null,marketCalls:0,rows};
    mkdirSync(join(dir,'results'),{recursive:true});
    writeFileSync(join(dir,'results','offline-v1.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({...result,rows:undefined},null,2));return;
  }
  if(mode==='summary') {const p=JSON.parse(readFileSync(join(dir,'results','benchmark-v1.json'),'utf8'));console.log(JSON.stringify(summarize(p.rows),null,2));return;}
  if(!['smoke','benchmark'].includes(mode))throw new Error('Use smoke, benchmark, offline or summary');
  if(keyStatus(process.env)==='MISSING'){console.log('MISSING');return;}
  const out=join(dir,'results',mode+'-v1.json');
  if(existsSync(out))throw new Error('RESULT_EXISTS_NO_REPEAT');
  let cases,datasetHash=null;
  if(mode==='smoke')cases=smokeCases;
  else {
    const smoke=JSON.parse(readFileSync(join(dir,'results','smoke-v1.json'),'utf8'));
    if(smoke.rows.length!==3||smoke.rows.some(r=>r.result.error||r.result.decision!==r.goldLabel||r.result.servedModel!==SERVED_MODEL))throw new Error('SMOKE_NOT_PASSED');
    const raw=readFileSync(join(dir,'cases.json'),'utf8');datasetHash=hash(raw);cases=JSON.parse(raw).cases;
    if(cases.length<30||cases.length>50)throw new Error('DATASET_BOUND');
  }
  mkdirSync(join(dir,'results'),{recursive:true});
  // Exclusive artifact reservation prevents duplicate live runs. Failures remain evidence.
  writeFileSync(out,JSON.stringify({status:'RUNNING',rows:[]}),{flag:'wx'});
  const artifact={version:1,mode,model:MODEL,servedModel:SERVED_MODEL,datasetHash,clientSha256:hash(readFileSync(join(dir,'decision.mjs'),'utf8')),runnerSha256:hash(readFileSync(join(dir,'run.mjs'),'utf8')),startedAt:new Date().toISOString(),shadowOnly:true,executionAllowed:false,maxCalls:mode==='smoke'?3:cases.length,maxReportedCostUsd:0.01,rows:[]};
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
  artifact.completedAt=new Date().toISOString();artifact.status=artifact.rows.length===cases.length?'COMPLETED':'STOPPED';artifact.summary=summarize(artifact.rows);
  writeFileSync(out,JSON.stringify(artifact,null,2)+'\n');
  console.log(JSON.stringify(artifact.summary,null,2));
}
if(process.argv[1]===fileURLToPath(import.meta.url))run(process.argv[2]).catch(()=>{console.error('EXPERIMENT_STOPPED_CHECK_LOCAL_PRECONDITIONS');process.exitCode=1;});
