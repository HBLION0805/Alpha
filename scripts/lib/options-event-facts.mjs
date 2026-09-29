// Read-only reference assembled from existing verified expectation and comparison records.
// This never supplies an analyst gate, trade condition, or asset direction.
const decimal=value=>{
  if(typeof value!=='string'||! /^-?(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(value))return null;
  const negative=value.startsWith('-'),[whole,fraction='']=(negative?value.slice(1):value).split('.');
  return (negative?-1n:1n)*(BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0')));
};
const formatted=value=>{const sign=value<0n?'-':'';if(value<0n)value=-value;return sign+(value/1000000n).toString()+(value%1000000n?'.'+(value%1000000n).toString().padStart(6,'0').replace(/0+$/,''):'');};
const identity=f=>[f.eventKey,f.metric,f.period,f.unit,f.releaseVersion].join('\u0000');
const unique=values=>[...new Set(values)];

export function projectEventFacts({events=[],expectations=[],comparisons=[],at=null}={}){
  const eventMap=new Map();
  const catalog=new Map(events.filter(e=>e?.key).map(e=>[e.key,e]));
  const snapshots=[...expectations].filter(r=>r?.kind==='expectation'&&r.payload?.request?.eventKey&&(!at||r.savedAt<=at))
    .sort((a,b)=>b.savedAt.localeCompare(a.savedAt)||b.path.localeCompare(a.path));
  const latest=new Map();for(const record of snapshots)if(!latest.has(record.payload.request.eventKey))latest.set(record.payload.request.eventKey,record);
  const saved=[...comparisons].filter(r=>r?.kind==='saved'&&r.payload?.eventKey&&(!at||r.savedAt<=at));
  const factMap=new Map();
  for(const record of saved){
    const facts=record.draft?.payload?.facts??[];
    for(const fact of facts){
      if(fact.eventKey!==record.payload.eventKey)continue;
      const claim=record.payload.assessment?.statements?.find(s=>s.id===fact.claimId);
      const bindings=(record.payload.assessment?.bindings??[]).filter(b=>b.factClaimId===fact.claimId);
      const eligible=claim?.eligible===true&&claim.semanticStatus==='OWNER_REVIEWED_NOT_MACHINE_VERIFIED'&&
        bindings.some(b=>b.status==='EVIDENCE_ELIGIBLE_FOR_ORIGINAL_CHECKER'&&b.evidence&&
          ['eventKey','metric','period','unit','releaseVersion','value','source','sourceAt','receivedAt'].every(k=>b.evidence[k]===fact[k]));
      const key=identity(fact);factMap.set(key,[...(factMap.get(key)??[]),{fact,record,eligible}]);
    }
  }
  for(const key of latest.keys())if(!eventMap.has(key))eventMap.set(key,catalog.get(key)??{key});
  for(const record of saved)if(!eventMap.has(record.payload.eventKey))eventMap.set(record.payload.eventKey,record.event??{key:record.payload.eventKey});
  for(const event of events)if(event?.key&&!eventMap.has(event.key))eventMap.set(event.key,event);
  const rows=[];
  for(const [eventKey,event] of [...eventMap].slice(0,12)){
    const snapshot=latest.get(eventKey),subjects=snapshot?.payload?.request?.rows??
      unique([...factMap.values()].flatMap(facts=>facts.filter(x=>x.fact.eventKey===eventKey).map(x=>identity(x.fact))))
        .slice(0,6).map(key=>({subject:factMap.get(key)[0].fact,forecasts:[],selectedConsensusId:''}));
    const metricRows=[];
    for(const row of subjects.slice(0,6)){
      const subject=row.subject,issues=[],selected=row.forecasts?.find(f=>f.id===row.selectedConsensusId&&f.type==='CONSENSUS'&&f.consensusBasis==='SOURCE_SURVEY')??null;
      const consensus=selected?.value!==null&&selected?.value!==undefined?{value:selected.value,source:selected.source,reference:selected.reference,receivedAt:selected.receivedAt,selectedConsensusId:selected.id,snapshotPath:snapshot.path}:null;
      if(!snapshot)issues.push('MISSING_EXPECTATION');
      if(!consensus)issues.push('MISSING_CONSENSUS');
      if(selected&&['eventKey','metric','period','unit','releaseVersion'].some(k=>selected[k]!==subject[k]))issues.push('CONSENSUS_IDENTITY_MISMATCH');
      const exact=factMap.get(identity(subject))??[];
      const related=[...factMap].filter(([key])=>key.startsWith(eventKey+'\u0000'+subject.metric+'\u0000')).flatMap(([,facts])=>facts);
      if(!exact.length){
        issues.push('MISSING_ACTUAL');
        for(const {fact} of related){
          if(fact.period!==subject.period)issues.push('PERIOD_MISMATCH');
          if(fact.unit!==subject.unit)issues.push('UNIT_MISMATCH');
          if(fact.releaseVersion!==subject.releaseVersion)issues.push('RELEASE_VERSION_MISMATCH');
        }
      }
      if(exact.some(x=>x.record.draft?.payload?.relations?.some(r=>r.kind==='FACTUAL_CONFLICT'&&r.statementIds.includes(x.fact.claimId))))issues.push('CONFLICTING_FACTS');
      if(exact.some(x=>!x.eligible))issues.push('UNVERIFIED_OR_INELIGIBLE_SOURCE');
      const eligible=exact.filter(x=>x.eligible),values=unique(eligible.map(x=>x.fact.value));
      if(values.length>1)issues.push('CONFLICTING_FACTS');
      const chosen=values.length===1?eligible.sort((a,b)=>b.record.savedAt.localeCompare(a.record.savedAt))[0]:null;
      if(!chosen)issues.push('MISSING_ELIGIBLE_ACTUAL');
      const actual=chosen?{value:chosen.fact.value,source:chosen.fact.source,sourceAt:chosen.fact.sourceAt,receivedAt:chosen.fact.receivedAt,comparisonPath:chosen.record.path,claimId:chosen.fact.claimId}:null;
      if(actual&&at&&actual.receivedAt>at)issues.push('STALE_OR_FUTURE_SOURCE');
      if(actual&&event.scheduledAt&&actual.sourceAt<event.scheduledAt)issues.push('STALE_SOURCE_BEFORE_EVENT');
      const a=actual?decimal(actual.value):null,c=consensus?decimal(consensus.value):null;
      if((actual&&a===null)||(consensus&&c===null))issues.push('UNSUPPORTED_NUMERIC_REPRESENTATION');
      const difference=issues.length===0&&a!==null&&c!==null?a-c:null;
      metricRows.push({metric:subject.metric,period:subject.period,unit:subject.unit,releaseVersion:subject.releaseVersion,
        consensus,actual,numericDifference:difference===null?null:formatted(difference),
        qualitativeSurprise:difference===null?'UNKNOWN':difference>0n?'HIGHER_THAN_CONSENSUS':difference<0n?'LOWER_THAN_CONSENSUS':'IN_LINE',issues:unique(issues)});
    }
    if(!metricRows.length)metricRows.push({metric:null,period:null,unit:null,releaseVersion:null,consensus:null,actual:null,numericDifference:null,qualitativeSurprise:'UNKNOWN',issues:['MISSING_EXPECTATION','MISSING_CONSENSUS','MISSING_ACTUAL']});
    rows.push({eventKey,title:event.title??null,source:event.source??null,scheduledAt:event.scheduledAt??null,
      expectationPath:snapshot?.path??null,expectationFrozenAt:snapshot?.payload?.frozenAt??null,metrics:metricRows.slice(0,6),
      issues:unique(metricRows.flatMap(row=>row.issues))});
  }
  if(!rows.length)rows.push({eventKey:null,title:null,source:null,scheduledAt:null,expectationPath:null,expectationFrozenAt:null,
    metrics:[{metric:null,period:null,unit:null,releaseVersion:null,consensus:null,actual:null,numericDifference:null,qualitativeSurprise:'UNKNOWN',issues:['MISSING_EXPECTATION','MISSING_CONSENSUS','MISSING_ACTUAL']}],issues:['MISSING_EVENT','MISSING_EXPECTATION','MISSING_CONSENSUS','MISSING_ACTUAL']});
  return {version:'OPTIONS_EVENT_FACTS_PROJECTION_V1',asOf:at,events:rows,executionAllowed:false,guidanceChanged:false,sourceReads:0,marketCalls:0};
}
