import {createHash} from 'node:crypto';

const hash=b=>createHash('sha256').update(b).digest('hex');
const unique=a=>[...new Set(a)];
const decode=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(raw,x)=>{
 if(x[0]!=='#')return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[x.toLowerCase()];
 const n=x[1].toLowerCase()==='x'?parseInt(x.slice(2),16):Number(x.slice(1));
 return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):raw;
});
function maskHidden(source){
 const stack=[],ranges=[];
 for(const m of source.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>/gi)){
  const tag=m[1].toLowerCase(),closing=m[0].startsWith('</');
  if(closing){const i=stack.findLastIndex(s=>s.tag===tag);if(i>=0){const [entry]=stack.splice(i);if(entry.hidden)ranges.push([entry.start,m.index+m[0].length]);}}
  else if(!/\/>$/.test(m[0])&&!['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(tag)){
   stack.push({tag,start:m.index,hidden:/\shidden(?:\s|=|>)/i.test(m[0])||/style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(m[0])});
  }
 }
 for(const entry of stack)if(entry.hidden)ranges.push([entry.start,source.length]);
 for(const [from,to] of ranges)source=source.slice(0,from)+' '.repeat(to-from)+source.slice(to);
 return source;
}

/** Offline text projection only. Offsets address decoded UTF-8 source characters, not DOM nodes.
 * No scripts, links, or external resources are executed. Original bytes remain the authority. */
export function extractTechOriginal(bytes){
 const source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(!/<body\b[^>]*>/i.test(source)||!/<\/body\s*>/i.test(source))return {status:'UNSUPPORTED_BODY',blocks:[]};
 const start=source.search(/<body\b/i),end=source.search(/<\/body\s*>/i),blocks=[];
 // Mask non-visible regions without changing source coordinates, then split at structural boundaries.
 const masked=maskHidden(source.replace(/<!--[^]*?-->|<(script|style|head|ix:header|ix:hidden)\b[^>]*>[^]*?<\/\1\s*>/gi,m=>' '.repeat(m.length)));
 const body=masked.slice(start,end),pattern=/<\/?(?:p|div|tr|h[1-6]|li|br|table|section|article)\b[^>]*>/gi;
 let from=0,rowDepth=0;
 const add=to=>{const raw=body.slice(from,to),text=decode(raw.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();if(text)blocks.push({index:blocks.length,sourceStart:start+from,sourceEnd:start+to,text});};
 for(const m of body.matchAll(pattern)){
  if(/^<tr\b/i.test(m[0])){if(rowDepth++===0){add(m.index);from=m.index+m[0].length;}continue;}
  if(/^<\/tr\b/i.test(m[0])){if(rowDepth>0&&--rowDepth===0){add(m.index);from=m.index+m[0].length;}continue;}
  if(rowDepth===0){add(m.index);from=m.index+m[0].length;}
 }add(body.length);
 return {status:blocks.length?'BODY_TEXT_EXTRACTED':'EMPTY_BODY',coordinateSystem:'UTF8_DECODED_SOURCE_CHARACTER_OFFSETS',blocks};
}

/** Bridge the already verified fixed-pool replay into cited inputs for further research.
 * Saved human/Host reviews remain attributed interpretations; parsing does not authenticate them. */
export function buildTechResearchInputs({files,lineage,at}){
 const load=p=>JSON.parse(files.get(p).toString('utf8').replace(/^\uFEFF/,''));
 const scan='runs/'+lineage.scanId+'/',events=load(scan+'events.json'),input=load('review-input-v1.2.json');
 const followups=load('verification-batch2-errata-v1/company-coverage-and-candidates.json');
 const receipts=load(scan+'http-receipts.json'),supplements=load(scan+'verification/receipts.json'),originals=load(scan+'originals.json');
 if(!Number.isFinite(Date.parse(at))||Date.parse(at)<Date.parse(input.createdAt)||Date.parse(at)<Date.parse(load('derived-review-v1.2/summary.json').processedAt)||
    [lineage.followupBatch.completedAt,lineage.followupBatch.errataAt,...receipts.map(r=>r.receivedAt),...supplements.map(r=>r.receivedAt)].some(t=>t&&(!Number.isFinite(Date.parse(t))||Date.parse(t)>Date.parse(at))))throw Error('TECH_CANDIDATE_RESEARCH_CLOCK');
 const documents=[],eventInputs=[];
 for(const review of input.reviews){
  const event=events.find(e=>e.eventId===review.eventId&&e.symbols.includes(review.symbol)),issues=[],documentIds=[];
  for(const original of [...originals,...supplements].filter(o=>o.eventId===event.eventId)){
   const path=scan+original.rawPath,bytes=files.get(path),receipt=[...receipts,...supplements].find(r=>r.rawPath===original.rawPath&&r.sha256===original.sha256&&r.status==='SUCCESS');
   if(!receipt||!bytes||hash(bytes)!==original.sha256){issues.push('ORIGINAL_UNAVAILABLE_OR_UNBOUND');continue;}
   const id=event.eventId+':'+original.sha256;
   if(!documents.some(d=>d.id===id)){
    let body;try{body=extractTechOriginal(bytes);}catch{body={status:'UNSUPPORTED_ENCODING',blocks:[]};}
    documents.push({id,eventId:event.eventId,symbols:event.symbols,sourcePath:path,sha256:original.sha256,url:original.url??receipt.url??null,
     sourceKind:'SAVED_EVENT_ORIGINAL',publishedAt:null,publicationClockStatus:'UNKNOWN_DOCUMENT_PUBLICATION_TIME',
     filingAcceptedAt:event.kind==='OFFICIAL_FILING_METADATA'?event.publishedAt??null:null,receivedAt:receipt.receivedAt,...body});
   }
   documentIds.push(id);
  }
  const related=[];
  for(const cluster of input.clusters??[]){
   if(cluster.canonicalEventId!==event.eventId)continue;
   for(const link of cluster.linkedDiscoveryRecords??[]){
    const linked=events.find(e=>e.eventId===link.id&&e.symbols.includes(review.symbol));
    if(!linked){issues.push('UNRESOLVED_DISCOVERY_ASSOCIATION');continue;}
    if(!related.some(r=>r.eventId===link.id))related.push({eventId:link.id,relationship:link.relationship,verifiedScope:link.verifiedScope,
     authority:'ATTRIBUTED_SAVED_REVIEW_RELATION',publisherBodyVerified:false,notIndependentOpportunity:link.notIndependentOpportunity===true});
   }
  }
  const docs=documents.filter(d=>documentIds.includes(d.id));
  if(!docs.some(d=>d.status==='BODY_TEXT_EXTRACTED'))issues.push('ORIGINAL_BODY_UNKNOWN');
  if(review.materialConflict)issues.push('SAVED_MATERIAL_CONFLICT_UNRESOLVED');
  eventInputs.push({eventId:event.eventId,symbol:review.symbol,discoveredAt:event.receivedAt??null,
   filingAcceptedAt:event.kind==='OFFICIAL_FILING_METADATA'?event.publishedAt??null:null,
   documentIds:unique(documentIds),relatedDiscoveryRecords:related,
   savedReview:{authority:'ATTRIBUTED_SAVED_REVIEW_NOT_AUTOMATIC_FACT_VERIFICATION',reviewedAt:input.createdAt,
    fact:review.fact??null,interpretation:review.analysis??null,nextEvidence:review.nextEvidence??null,eventWindow:review.eventWindow??null,
    originalVerified:review.originalVerified,companyEventVerified:review.companyEventVerified,materialityReviewed:review.materialityReviewed,materialConflict:review.materialConflict},
   researchInput:{status:docs.some(d=>d.status==='BODY_TEXT_EXTRACTED')?'CITED_MATERIAL_READY_FOR_REVIEW':'PARTIAL_INPUT_ORIGINAL_BODY_UNKNOWN',
    fundamental:{direction:'UNKNOWN',valuation:null,numericFacts:[],basis:'REVIEW_BODY_AND_SAVED_INTERPRETATION'},
    news:{direction:'UNKNOWN',eventId:event.eventId,documentIds:unique(documentIds)},
    technical:{status:'NOT_ASSESSED',levels:null},
    guidanceRevision:{status:'UNKNOWN',delta:null,reason:'NO_REVIEWED_SAME_TARGET_FISCAL_PERIOD_METRIC_BASIS_CURRENCY_UNIT_SCOPE_PAIR; CROSS_PERIOD_DIFFERENCE_IS_NOT_A_REVISION'},
    consensusSurprise:{status:'UNKNOWN',delta:null,reason:'NO_VERIFIED_COMPARABLE_CONSENSUS_CAPTURED_BEFORE_ANNOUNCEMENT'},
    holdingWindow:null,optionExpiry:null,trialCondition:null,confirmationCondition:null,invalidationCondition:null,
    nextStep:review.nextEvidence??'Review cited original and company-event materiality before any directional research plan.'},issues:unique(issues)});
 }
 const companies=lineage.pool.map(symbol=>{
  const discovered=events.filter(e=>e.symbols.includes(symbol)),rank=lineage.ranking.find(r=>r.symbol===symbol),followup=followups.find(r=>r.symbol===symbol),reviewed=eventInputs.filter(r=>r.symbol===symbol);
  const covered=new Set(reviewed.flatMap(r=>[r.eventId,...r.relatedDiscoveryRecords.filter(l=>l.notIndependentOpportunity).map(l=>l.eventId)]));
  const unresolved=discovered.filter(e=>!covered.has(e.eventId)).map(e=>e.eventId);
  return {symbol,candidateId:lineage.scanId+'-'+symbol,sourceCoverage:lineage.coverage.filter(c=>c.symbol===symbol),
   discoveryEventIds:discovered.map(e=>e.eventId),reviewedEventIds:reviewed.map(r=>r.eventId),unresolvedEventIds:unresolved,
   inheritedRanking:rank,limitedFollowup:{classification:followup.classification,scope:followup.scope??'SAVED_LIMITED_FOLLOWUP',reason:followup.reason??null,nextEvidence:followup.nextEvidence??null},
   researchStatus:reviewed.some(r=>r.researchInput.status==='CITED_MATERIAL_READY_FOR_REVIEW')?'CITED_INPUT_AVAILABLE':'LOCAL_ORIGINAL_OR_REVIEW_GAP',
   completeCompanyOpportunityScreen:false,excludedEventDoesNotExcludeCompany:true};
 });
 return {version:'TECH36_RESEARCH_INPUTS_V1',scanId:lineage.scanId,generatedAt:at,sourceCutoff:lineage.originalCutoff,
  mode:'SAVED_ORIGINAL_REPLAY_NOT_NEW_SCAN',sourceReads:0,marketCalls:0,executionAllowed:false,paperAdmissionAllowed:false,
  authority:'CITED_RESEARCH_MATERIALS_NOT_DIRECTIONAL_PLAN_OR_FORECAST',documents,eventInputs,companies,
  screeningTrace:{poolCompanies:companies.length,discoveryRecords:events.length,companyEventAssociations:companies.reduce((n,c)=>n+c.discoveryEventIds.length,0),
   companyHeadlineAssociations:events.filter(e=>e.kind==='UNVERIFIED_HEADLINE').reduce((n,e)=>n+e.symbols.length,0),
   limitedFollowupSelectedAssociations:lineage.followupBatch.selectedCompanyHeadlineAssociations??null,
   limitedFollowupUnattemptedAssociations:lineage.followupBatch.unattemptedCompanyHeadlineAssociations??null,
   reviewedCanonicalEvents:eventInputs.length,attributedRelatedRecords:eventInputs.reduce((n,e)=>n+e.relatedDiscoveryRecords.length,0),
   extractedDocuments:documents.filter(d=>d.status==='BODY_TEXT_EXTRACTED').length,
   companiesWithCitedInputs:companies.filter(c=>c.researchStatus==='CITED_INPUT_AVAILABLE').length,
   inheritedRankingCategories:Object.fromEntries(unique(companies.map(c=>c.inheritedRanking.category)).map(k=>[k,companies.filter(c=>c.inheritedRanking.category===k).length])),
   limitedFollowupCategories:Object.fromEntries(unique(companies.map(c=>c.limitedFollowup.classification)).map(k=>[k,companies.filter(c=>c.limitedFollowup.classification===k).length])),
   rankingChanged:false,fullPoolOpportunityScreenComplete:false,continuousScan:false},
  limitations:['Source hashes establish copied-byte integrity, not machine authentication or factual accuracy.',
   'Body extraction preserves text blocks and source coordinates; tables require review and are not converted to numeric facts. External CSS and visual layout are not evaluated.',
   'Saved event associations are attributed and scoped; headline links never establish publisher-body verification.',
   'This adapter consumes the existing versioned candidate replay bundle. It does not run or schedule discovery.']};
}
