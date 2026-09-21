// NOT_IMPORTED_BY_PRODUCTION / NOT_USED_BY_ALPHA_RUNTIME. Explicit CLI only.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,rmdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {HARD_GATES,MODEL,SERVED_MODEL,hash} from './decision.mjs';
import {PHASE_QUESTIONS,prospectiveRequest,prospectiveInference} from './prospective-client.mjs';

const dir=fileURLToPath(new URL('.',import.meta.url));
export const POLICY=Object.freeze({phase:'prospective-shadow-phase-2',maxReportedCostUsd:0.01,maxSemanticPoints:50,targetMinimum:30,maxPointsPerEpisode:2,shadowOnly:true,executionAllowed:false});
const families=Object.keys(PHASE_QUESTIONS),labels=type=>Object.keys(PHASE_QUESTIONS[type].criteria);
class ShadowError extends Error{constructor(code){super(code);this.code=code;}}
const requireThat=(v,code)=>{if(!v)throw new ShadowError(code);};
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(v);
const normalized=s=>s.trim().replace(/\s+/g,' ').toLowerCase();
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const safe=(s,key)=>typeof s==='string'&&s.trim().length>0&&s.length<=4000&&!(key&&s.includes(key))&&!/sk-(?:or-)?[A-Za-z0-9_-]{12,}|Bearer\s+\S+|BEGIN.*PRIVATE KEY/i.test(s);
function fields(input,allowed,key){requireThat(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>allowed.includes(k)),'UNEXPECTED_INPUT_FIELD');const text=JSON.stringify(input);requireThat(!(key&&text.includes(key))&&!/sk-(?:or-)?[A-Za-z0-9_-]{12,}|Bearer\s+\S+|BEGIN.*PRIVATE KEY/i.test(text),'SECRET_IN_INPUT');}

export function openPhase(root,{key=process.env.OPENROUTER_API_KEY,clock=()=>new Date().toISOString(),fetcher=fetch,timeoutMs=15000}={}){
  const path=name=>join(root,name);
  const write=(name,value)=>writeFileSync(path(name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const now=()=>{const t=clock();requireThat(Number.isFinite(Date.parse(t)),'INVALID_CLOCK');return t;};
  const manifest=()=>{const m=json(path('phase.json'));requireThat(JSON.stringify(m.policy)===JSON.stringify(POLICY),'POLICY_CHANGED');requireThat(m.model===MODEL&&m.expectedServedModel===SERVED_MODEL,'MODEL_CHANGED');
    for(const [file,fingerprint] of Object.entries(m.codeHashes))requireThat(hash(readFileSync(join(dir,file),'utf8'))===fingerprint,'PHASE_CODE_CHANGED');return m;};
  const rows=()=>{
    if(!existsSync(path('phase.json')))return [];
    manifest();
    return readdirSync(root).filter(f=>f.endsWith('.input.json')).map(f=>{
      const input=json(path(f)),caseId=input.caseId;
      const optional=suffix=>existsSync(path(caseId+suffix))?json(path(caseId+suffix)):null;
      const receipt=optional('.receipt.json'),action=optional('.action.json');
      const goldFiles=readdirSync(root).filter(n=>n.startsWith(caseId+'.gold-')&&n.endsWith('.json')).sort((a,b)=>Number(a.split('.gold-')[1].split('.')[0])-Number(b.split('.gold-')[1].split('.')[0]));
      let prior=null;for(let i=0;i<goldFiles.length;i++){const revision=json(path(goldFiles[i]));requireThat(revision.version===i+1&&revision.supersedes===(prior?hash(prior):null)&&action&&revision.actionHash===hash(action)&&revision.inputHash===hash(input),'GOLD_HISTORY_MISMATCH');prior=revision;}
      const gold=goldFiles.length?json(path(goldFiles.at(-1))):null;
      if(receipt)requireThat(receipt.inputHash===hash(input),'INPUT_RECEIPT_MISMATCH');
      if(action)requireThat(action.inputHash===hash(input),'INPUT_ACTION_MISMATCH');
      if(gold)requireThat(action&&gold.actionHash===hash(action)&&gold.inputHash===hash(input),'GOLD_LINK_MISMATCH');
      return {input,receipt,action,gold,goldRevisions:goldFiles.length};
    });
  };
  async function locked(fn){mkdirSync(root,{recursive:true});const lock=path('phase.lock');try{mkdirSync(lock);}catch{throw new ShadowError('EXPERIMENT_BUSY_OR_UNCLEAN_STOP');}try{return await fn();}finally{rmdirSync(lock);}}
  const health=list=>{
    if(list.some(r=>!r.receipt))return 'INCOMPLETE_RECEIPT_NO_RETRY';
    if(list.some(r=>r.receipt.result.error))return 'PROVIDER_OR_INPUT_FAILURE_STOP';
    if(list.some(r=>r.receipt.result.usage?.costUsd==null))return 'COST_UNKNOWN_STOP';
    if(list.reduce((s,r)=>s+r.receipt.result.usage.costUsd,0)>=POLICY.maxReportedCostUsd)return 'BUDGET_STOP';
    if(list.length>=POLICY.maxSemanticPoints)return 'SAMPLE_CAP_REACHED';
    return 'READY_FOR_NATURAL_DECISIONS';
  };
  return {
    init:()=>locked(()=>{
      if(existsSync(path('phase.json')))return manifest();
      requireThat(readdirSync(root).every(f=>f==='phase.lock'),'NONEMPTY_UNINITIALIZED_PHASE');
      const m={createdAt:now(),policy:POLICY,model:MODEL,expectedServedModel:SERVED_MODEL,
        codeHashes:Object.fromEntries(['decision.mjs','prospective-client.mjs','prospective.mjs'].map(f=>[f,hash(readFileSync(join(dir,f),'utf8'))])),
        historicalCasesHash:hash(readFileSync(join(dir,'cases.json'),'utf8'))};
      write('phase.json',m);return m;
    }),
    capture:input=>locked(async()=>{
      const m=manifest();
      fields(input,['caseId','episodeId','decisionType','sanitizedState','hardSafetyFlags','deterministicResolution','independenceBasis','newRealDecision','preDecisionOnly'],key);
      requireThat(id(input.caseId)&&id(input.episodeId)&&families.includes(input.decisionType),'INVALID_CASE_ID_OR_FAMILY');
      requireThat(input.newRealDecision===true&&input.preDecisionOnly===true,'PROSPECTIVE_ATTESTATION_REQUIRED');
      requireThat(safe(input.sanitizedState,key)&&safe(input.independenceBasis,key),'UNSAFE_STATE');
      requireThat(Array.isArray(input.hardSafetyFlags)&&input.hardSafetyFlags.every(f=>HARD_GATES.includes(f)),'INVALID_HARD_GATE');
      if(input.hardSafetyFlags.length)return {status:'DETERMINISTIC_SKIP',decision:'ASK_OWNER',requestMade:false,executionAllowed:false};
      requireThat(Object.hasOwn(input,'deterministicResolution'),'DETERMINISTIC_CHECK_REQUIRED');
      if(input.deterministicResolution!==null){
        fields(input.deterministicResolution,['decision','basis'],key);
        requireThat(labels(input.decisionType).includes(input.deterministicResolution.decision)&&input.deterministicResolution.decision!=='UNKNOWN'&&safe(input.deterministicResolution.basis,key),'INVALID_DETERMINISTIC_RESULT');
        return {status:'DETERMINISTIC_SKIP',decision:input.deterministicResolution.decision,requestMade:false,executionAllowed:false};
      }
      // No outcome, action, gold, case/episode ID or local evidence path goes out.
      prospectiveRequest({...input,hardSafetyFlag:null},key);
      requireThat(key?.trim(),'MISSING_API_KEY');
      const list=rows();requireThat(health(list)==='READY_FOR_NATURAL_DECISIONS',health(list));
      requireThat(!list.some(r=>r.input.caseId===input.caseId),'DUPLICATE_CASE');
      requireThat(list.filter(r=>r.input.episodeId===input.episodeId).length<POLICY.maxPointsPerEpisode,'EPISODE_LIMIT');
      requireThat(!list.some(r=>normalized(r.input.sanitizedState)===normalized(input.sanitizedState)),'DUPLICATE_STATE');
      const historicalRaw=readFileSync(join(dir,'cases.json'),'utf8');requireThat(hash(historicalRaw)===m.historicalCasesHash,'HISTORICAL_DATASET_CHANGED');
      requireThat(!JSON.parse(historicalRaw).cases.some(c=>normalized(c.sanitizedState)===normalized(input.sanitizedState)),'HISTORICAL_CASE_NOT_ALLOWED');
      const record={...input,decisionTimestamp:now(),shadowOnly:true,executionAllowed:false};
      requireThat(Date.parse(record.decisionTimestamp)>=Date.parse(m.createdAt),'CLOCK_PRECEDES_PHASE');
      write(input.caseId+'.input.json',record);
      const result=await prospectiveInference({decisionType:input.decisionType,sanitizedState:input.sanitizedState,hardSafetyFlag:null},{key,fetcher,timeoutMs});
      write(input.caseId+'.receipt.json',{caseId:input.caseId,inputHash:hash(record),savedAt:now(),result});
      // Delay display until actual action is recorded; never route execution by label.
      return {caseId:input.caseId,status:result.error?'EXPERIMENT_STOPPED':'SHADOW_RECEIPT_SAVED',error:result.error,requestMade:result.requestMade,executionAllowed:false};
    }),
    action:(caseId,input)=>locked(()=>{
      requireThat(id(caseId),'INVALID_CASE_ID');fields(input,['actualCodexDecision','ownerInterruptionMade','basis'],key);
      const row=rows().find(r=>r.input.caseId===caseId);requireThat(row?.receipt,'RECEIPT_REQUIRED');
      requireThat(!row.action,'ACTION_ALREADY_RECORDED');
      requireThat(labels(row.input.decisionType).includes(input.actualCodexDecision)&&typeof input.ownerInterruptionMade==='boolean'&&safe(input.basis,key),'INVALID_ACTION');
      const recordedAt=now();requireThat(Date.parse(recordedAt)>Date.parse(row.input.decisionTimestamp),'ACTION_MUST_FOLLOW_DECISION');
      const action={...input,caseId,recordedAt,inputHash:hash(row.input),attribution:'CODEX_REPORTED_ACTUAL_ACTION_NOT_OWNER_VERIFICATION'};
      write(caseId+'.action.json',action);return {action,shadowResult:row.receipt.result};
    }),
    label:(caseId,input)=>locked(()=>{
      requireThat(id(caseId),'INVALID_CASE_ID');fields(input,['goldLabel','verified','verifiedOutcome','goldBasis','correctionReason'],key);
      const row=rows().find(r=>r.input.caseId===caseId);requireThat(row?.action,'ACTUAL_ACTION_REQUIRED_BEFORE_GOLD');
      requireThat(labels(row.input.decisionType).includes(input.goldLabel)&&typeof input.verified==='boolean'&&safe(input.verifiedOutcome,key)&&safe(input.goldBasis,key),'INVALID_GOLD');
      requireThat(input.goldLabel!=='UNKNOWN'||input.verified===false,'UNKNOWN_CAUSE_IS_UNRESOLVED');
      if(row.gold)requireThat(safe(input.correctionReason,key),'APPEND_CORRECTION_REASON_REQUIRED');
      const recordedAt=now();requireThat(Date.parse(recordedAt)>Date.parse(row.action.recordedAt),'GOLD_MUST_FOLLOW_ACTUAL_ACTION');
      const gold={...input,caseId,recordedAt,version:row.goldRevisions+1,supersedes:row.gold?hash(row.gold):null,inputHash:hash(row.input),actionHash:hash(row.action),attribution:'CODEX_OUTCOME_REVIEW_NOT_INDEPENDENT_OWNER_LABEL'};
      write(caseId+'.gold-'+gold.version+'.json',gold);return gold;
    }),
    review:caseId=>{requireThat(id(caseId),'INVALID_CASE_ID');const row=rows().find(r=>r.input.caseId===caseId);requireThat(row,'CASE_NOT_FOUND');return row.action?row:{input:row.input,status:'RECORD_ACTUAL_ACTION_BEFORE_VIEWING_SHADOW_RESULT'};},
    report:()=>{const list=rows();return {phase:POLICY.phase,initialized:existsSync(path('phase.json')),collectionStatus:!existsSync(path('phase.json'))?'NOT_INITIALIZED':existsSync(path('phase.lock'))?'BUSY_OR_UNCLEAN_STOP':health(list),...metrics(list)};}
  };
}

export function metrics(rows){
  const result=r=>r.receipt?.result;
  const valid=r=>result(r)?.requestMade===true&&!result(r).error&&result(r).httpStatus===200&&result(r).servedModel===SERVED_MODEL;
  const calls=rows.filter(r=>result(r)?.requestMade),success=rows.filter(valid);
  const pending=rows.filter(r=>!r.receipt).length;
  const ratio=(n,d)=>d?n/d:null;
  const labelled=type=>rows.filter(r=>r.input.decisionType===type&&r.gold?.verified&&r.gold.goldLabel!=='UNKNOWN');
  const owners=rows.filter(r=>r.input.decisionType==='OWNER_GATE'),ownerGold=labelled('OWNER_GATE'),scored=ownerGold.filter(valid);
  const goldAsks=scored.filter(r=>r.gold.goldLabel==='ASK_OWNER'),goldContinues=scored.filter(r=>r.gold.goldLabel==='CONTINUE');
  const predicted=(list,label)=>list.filter(r=>result(r).decision===label).length;
  const ownerActions=owners.filter(r=>r.action),comparable=ownerActions.filter(valid);
  const avoided=comparable.filter(r=>r.action.ownerInterruptionMade&&result(r).decision==='CONTINUE');
  const added=comparable.filter(r=>!r.action.ownerInterruptionMade&&result(r).decision==='ASK_OWNER');
  const triage=labelled('TRIAGE').filter(valid),triageLabels=labels('TRIAGE');
  const confusion=Object.fromEntries(triageLabels.map(g=>[g,Object.fromEntries(triageLabels.map(p=>[p,triage.filter(r=>r.gold.goldLabel===g&&result(r).decision===p).length]))]));
  const latency=success.map(r=>result(r).latencyMs).sort((a,b)=>a-b);
  const sum=k=>!pending&&calls.every(r=>result(r).usage?.[k]!=null)?calls.reduce((s,r)=>s+result(r).usage[k],0):null;
  const failures=rows.filter(r=>result(r)?.error);
  return {decisionPoints:rows.length,episodes:new Set(rows.map(r=>r.input.episodeId)).size,pendingReceipts:rows.filter(r=>!r.receipt).length,
    pendingActualActions:rows.filter(r=>!r.action).length,pendingVerifiedGold:rows.filter(r=>!r.gold?.verified).length,
    owner:{sampleCount:owners.length,successfulInferences:owners.filter(valid).length,verifiedGoldCount:ownerGold.length,
      sampleCountByGoldClass:Object.fromEntries(labels('OWNER_GATE').map(l=>[l,ownerGold.filter(r=>r.gold.goldLabel===l).length])),
      unresolvedOutcomeCount:owners.filter(r=>r.gold&&!r.gold.verified).length,
      evaluatedWithVerifiedGold:scored.length,accuracy:ratio(scored.filter(r=>result(r).decision===r.gold.goldLabel).length,scored.length),
      falseContinue:{count:predicted(goldAsks,'CONTINUE'),denominator:goldAsks.length,rate:ratio(predicted(goldAsks,'CONTINUE'),goldAsks.length)},
      falseAskOwner:{count:predicted(goldContinues,'ASK_OWNER'),denominator:goldContinues.length,rate:ratio(predicted(goldContinues,'ASK_OWNER'),goldContinues.length)},
      unknown:owners.filter(r=>valid(r)&&result(r).decision==='UNKNOWN').length,
      failedClosedUnknown:owners.filter(r=>result(r)?.error).length,
      actualActionsRecorded:ownerActions.length,ownerInterruptionsActuallyMade:ownerActions.length===owners.length?ownerActions.filter(r=>r.action.ownerInterruptionMade).length:null,
      knownOwnerInterruptions:ownerActions.filter(r=>r.action.ownerInterruptionMade).length,counterfactualsCompared:comparable.length,
      wouldHaveAvoidedInterruptions:avoided.length,wouldHaveAddedInterruptions:added.length,
      verifiedUnnecessaryInterruptionsWouldAvoid:avoided.filter(r=>r.gold?.verified&&r.gold.goldLabel==='CONTINUE').length,
      verifiedRequiredInterruptionsWouldMiss:avoided.filter(r=>r.gold?.verified&&r.gold.goldLabel==='ASK_OWNER').length,
      verifiedUnnecessaryInterruptionsWouldAdd:added.filter(r=>r.gold?.verified&&r.gold.goldLabel==='CONTINUE').length,
      counterfactualsAreNotActualSavings:true},
    triage:{sampleCount:rows.filter(r=>r.input.decisionType==='TRIAGE').length,evaluatedWithVerifiedGold:triage.length,confusionMatrix:confusion,
      perClassAccuracy:Object.fromEntries(triageLabels.map(l=>{const subset=triage.filter(r=>r.gold.goldLabel===l);return [l,{count:subset.length,correct:predicted(subset,l),accuracy:ratio(predicted(subset,l),subset.length)}];})),
      unknown:success.filter(r=>r.input.decisionType==='TRIAGE'&&result(r).decision==='UNKNOWN').length,
      failedClosedUnknown:rows.filter(r=>r.input.decisionType==='TRIAGE'&&result(r)?.error).length,
      errors:triage.filter(r=>result(r).decision!==r.gold.goldLabel).map(r=>({caseId:r.input.caseId,gold:r.gold.goldLabel,decision:result(r).decision}))},
    api:{calls:pending?null:calls.length,knownCalls:calls.length,unknownAttempts:pending,successful:success.length,providerFailures:failures.length,
      failureCounts:Object.fromEntries([...new Set(failures.map(r=>result(r).error))].map(e=>[e,failures.filter(r=>result(r).error===e).length])),
      medianSuccessfulLatencyMs:latency.length?(latency[Math.floor((latency.length-1)/2)]+latency[Math.floor(latency.length/2)])/2:null,
      p95SuccessfulLatencyMs:latency.length>=20?latency[Math.ceil(latency.length*.95)-1]:null,
      inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),reportedCostUsd:sum('costUsd'),
      knownReportedSubtotalUsd:calls.reduce((s,r)=>s+(result(r).usage?.costUsd??0),0),averageReportedCostUsd:sum('costUsd')===null?null:ratio(sum('costUsd'),calls.length)},
    actualWorkflowActionsByJev:0,disposition:null};
}

async function main(){
  const [command,arg,source]=process.argv.slice(2),phase=openPhase(resolve(dir,'../../../data/runtime/jev-dev-workflow/phase-2'));
  let output;
  if(command==='init')output=await phase.init();
  else if(command==='capture')output=await phase.capture(json(arg));
  else if(command==='action')output=await phase.action(arg,json(source));
  else if(command==='label')output=await phase.label(arg,json(source));
  else if(command==='review')output=phase.review(arg);
  else if(command==='report')output=phase.report();
  else throw new ShadowError('COMMAND_NOT_ALLOWED');
  console.log(JSON.stringify(output,null,2));
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{console.error(JSON.stringify({status:'SHADOW_EXPERIMENT_STOPPED',code:error instanceof ShadowError?error.code:'LOCAL_FAILURE',next:'Continue authorized Alpha work. Do not retry the experiment automatically.'}));process.exitCode=1;});
