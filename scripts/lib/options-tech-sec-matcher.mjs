import {createHash} from 'node:crypto';
import {extractTechOriginal,extractTechOriginalLinks,techResearchContext} from './options-tech-research-inputs.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex'),uniq=a=>[...new Set(a)],fail=c=>{throw Error('TECH_CANDIDATE_SEC_'+c);};
const keys=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===k.split(',').sort().join(',');
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const cik=s=>String(s).replace(/^0+/,'');
function archive(url){try{const u=new URL(url),m=u.pathname.match(/^\/Archives\/edgar\/data\/(\d+)\/(\d{18})\/([^/]+)$/);return u.protocol==='https:'&&['www.sec.gov','sec.gov'].includes(u.hostname)&&!u.port&&!u.username&&!u.password&&!u.search&&m?{url:u.origin+u.pathname,cik:cik(m[1]),accession:m[2],file:m[3]}:null;}catch{return null;}}
function citation(source,block){return {sha256:source.sha256,url:source.url,receivedAt:source.receivedAt,blockIndex:block.index??block.blockIndex??null,sourceStart:block.sourceStart,sourceEnd:block.sourceEnd,coordinateSystem:'UTF8_DECODED_SOURCE_CHARACTER_OFFSETS'};}
function stamp(s){return typeof s==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s));}
export function validateTechSecMatchRequest(q){
 if(!keys(q,'version,symbol,eventId,accession,savedReceipts')||q.version!=='TECH36_SEC_MATCH_REQUEST_V1'||typeof q.symbol!=='string'||typeof q.eventId!=='string'||!/^\d{10}-\d{2}-\d{6}$/.test(q.accession)||!Array.isArray(q.savedReceipts)||q.savedReceipts.length>6)fail('REQUEST');
 for(const r of q.savedReceipts)if(!keys(r,'rawPath,sha256,url,startedAt,receivedAt,publishedAt,status,httpStatus')||typeof r.rawPath!=='string'||!/^[a-f0-9]{64}$/.test(r.sha256)||typeof r.url!=='string'||r.url.length>2000||!['SUCCESS','FAILED','BLOCKED'].includes(r.status)||!Number.isInteger(r.httpStatus)||r.httpStatus<100||r.httpStatus>599||!stamp(r.startedAt)||!stamp(r.receivedAt)||(r.publishedAt!==null&&!stamp(r.publishedAt)))fail('RECEIPT');
}
const monthNames='January February March April May June July August September October November December'.split(' ');
const datePattern='(?:'+monthNames.join('|')+')\\s+\\d{1,2},?\\s+20\\d{2}';
function dateOnly(s){const m=s.match(new RegExp('^('+monthNames.join('|')+')\\s+(\\d{1,2}),?\\s+(20\\d{2})$','i'));if(!m)return null;const y=+m[3],mo=monthNames.findIndex(n=>n.toLowerCase()===m[1].toLowerCase())+1,d=+m[2],t=new Date(Date.UTC(y,mo-1,d));return t.getUTCFullYear()===y&&t.getUTCMonth()===mo-1&&t.getUTCDate()===d?`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null;}
function periodLabel(text){
 const q=text.match(/\b(?:Q([1-4])|(first|second|third|fourth)\s+(?:fiscal\s+)?quarter)\b/i);if(!q)return null;
 const n=q[1]?+q[1]:['first','second','third','fourth'].indexOf(q[2].toLowerCase())+1;
 const y=text.slice(q.index+q[0].length).match(/^\s*(?:of\s+)?(?:(fiscal(?:\s+year)?|FY)\s*)?(20\d{2}|\d{2})(?!\d)/i);
 return {quarter:n,fiscalYear:y?.[1]&&y[2].length===4?+y[2]:null,yearLabel:y?.[2]??null,yearBasis:y?.[1]?'FISCAL':y?'UNSPECIFIED':'UNKNOWN',index:q.index};
}
function periodLabels(text){return [...text.matchAll(/\b(?:Q[1-4]|(?:first|second|third|fourth)\s+(?:fiscal\s+)?quarter)\b/gi)].map(m=>({...periodLabel(text.slice(m.index)),index:m.index}));}
function identity(source,body,issuer,symbol,{main=false}={}){
 const claims=[],issues=[],nameCore=norm(issuer.name).replace(/\s+(?:inc|incorporated|corp|corporation|co|company)$/,'');
 const intro=body.blocks.slice(0,30),named=intro.find(b=>(' '+norm(b.text)+' ').includes(' '+nameCore+' '));
 if(named)claims.push({kind:'ISSUER_NAME_MENTION',value:issuer.name,citation:citation(source,named)});
 const tickers=intro.flatMap(b=>[...b.text.matchAll(/\b(?:NYSE|NASDAQ)(?:\s+Global\s+Select\s+Market)?\s*:\s*([A-Z][A-Z0-9.]{0,8})\b/gi)].map(m=>({value:m[1].toUpperCase(),citation:citation(source,b)})));
 for(const t of tickers)claims.push({kind:'EXCHANGE_TICKER_MENTION',...t});
 if(tickers.some(t=>t.value!==symbol))issues.push('ISSUER_TICKER_CONFLICT');
 let mainCik=false;
 if(main){const raw=source.bytes.toString('utf8');for(const m of raw.matchAll(/<ix:nonNumeric\b[^>]*\bname=["']dei:(EntityCentralIndexKey|EntityRegistrantName)["'][^>]*>([^]*?)<\/ix:nonNumeric\s*>/gi)){
  const value=m[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();claims.push({kind:'SAVED_XBRL_'+m[1],value,citation:citation(source,{sourceStart:m.index,sourceEnd:m.index+m[0].length})});
  if(m[1]==='EntityCentralIndexKey'){if(cik(value)!==cik(issuer.cik))issues.push('ISSUER_CIK_CONFLICT');else mainCik=true;}
  else if(norm(value)!==norm(issuer.name))issues.push('ISSUER_REGISTRANT_CONFLICT');
 }}
 const issuerAnnouncement=intro.some(b=>{const t=norm(b.text),nameIndex=(' '+t+' ').indexOf(' '+nameCore+' '),verb=t.search(/\b(?:announced|reported)\b/);return nameIndex>=0&&verb>nameIndex&&/\b(?:announced|reported)\b[^.]{0,100}\bresults\b/i.test(b.text)&&new RegExp('\\b(?:NYSE|NASDAQ)\\s*:\\s*'+symbol+'\\b','i').test(b.text);});
 const complete=!!named&&(main?mainCik:issuerAnnouncement);
 return {status:issues.length?'CONFLICT':complete?'MATCH':'UNKNOWN',reasons:issues.length?uniq(issues):complete?[]:['ISSUER_BODY_BINDING_INCOMPLETE'],claims};
}
function resultPeriod(source,body){
 const claims=[],disclosures=[],guidanceMentions=[],reasons=[];let multiPeriod=false;
 for(const block of body.blocks.slice(0,80)){
  const raw=source.bytes.toString('utf8').slice(block.sourceStart,block.sourceEnd);if(/<(?:td|th)\b/i.test(raw))continue;
  for(const sentence of block.text.split(/(?<=[.!?;])\s+(?=[A-Z])/)){
   const labels=periodLabels(sentence);if(!labels.length)continue;
   const cite=citation(source,block);
   if(/guidance|outlook|expect|forecast/i.test(sentence)){for(const p of labels)guidanceMentions.push({text:sentence,...p,citation:cite});continue;}
   if(!/\bresults\b/i.test(sentence))continue;
   if(/\b(?:full[ -]year|annual)\b/i.test(sentence))multiPeriod=true;
   for(let i=0;i<labels.length;i++){const p=labels[i],end=sentence.slice(p.index,labels[i+1]?.index).match(new RegExp('\\b(?:ended|ending)\\s+('+datePattern+')','i'));
   const periodEnd=end?dateOnly(end[1]):null;if(end&&!periodEnd)reasons.push('INVALID_PERIOD_END');
   claims.push({quarter:p.quarter,fiscalYear:p.fiscalYear,yearLabel:p.yearLabel,yearBasis:p.yearBasis,periodEnd,citation:cite});
   }
   // Only an explicit dateline before the announcement verb; never a report/end date.
   const verb=sentence.search(/\b(?:announced|reported)\b/i);
   if(verb>=0)for(const d of sentence.slice(0,verb).matchAll(new RegExp(datePattern,'gi'))){const value=dateOnly(d[0]);if(value)disclosures.push({value,precision:'DATE_ONLY_NOT_FIRST_DISSEMINATION',citation:cite});else reasons.push('INVALID_DISCLOSURE_DATE');}
  }
 }
 const values=key=>uniq(claims.map(c=>c[key]).filter(v=>v!==null)),quarter=values('quarter'),fiscalYear=values('fiscalYear'),periodEnd=values('periodEnd'),yearLabel=values('yearLabel'),dates=uniq(disclosures.map(c=>c.value));
 if([quarter,fiscalYear,periodEnd,yearLabel,dates].some(v=>v.length>1))reasons.push('MULTIPLE_RESULT_PERIOD_OR_DISCLOSURE_CLAIMS');
 if(multiPeriod)reasons.push('MULTI_PERIOD_RELEASE_REQUIRES_REVIEW');
 if(periodEnd.length===1&&dates.length===1&&periodEnd[0]>dates[0])reasons.push('RESULT_PERIOD_AFTER_DISCLOSURE');
 return {quarter:quarter.length===1?quarter[0]:null,fiscalYear:fiscalYear.length===1?fiscalYear[0]:null,yearLabel:yearLabel.length===1?yearLabel[0]:null,yearBasis:fiscalYear.length===1?'FISCAL':yearLabel.length===1?'UNSPECIFIED':'UNKNOWN',periodEnd:periodEnd.length===1?periodEnd[0]:null,disclosureDate:dates.length===1?dates[0]:null,claims,disclosures,guidanceMentions,reasons:uniq(reasons)};
}
function usable(s){return s.status==='SUCCESS'&&s.httpStatus>=200&&s.httpStatus<300&&s.bytes;}
function envelope(s){return {url:s.url,sha256:s.sha256,rawPath:s.rawPath,startedAt:s.startedAt??null,receivedAt:s.receivedAt??null,publishedAt:s.publishedAt??null,httpStatus:s.httpStatus??null,status:s.status};}

/** Bounded, offline candidate matching. MATCH means label alignment, never verified facts. */
export function buildTechSecMatch({files,lineage,request,extraSources=[],at,context=techResearchContext({files,lineage})}){
 validateTechSecMatchRequest(request);
 if(!stamp(at)||!lineage.pool.includes(request.symbol))fail('REQUEST');
 const event=context.events.find(e=>e.eventId===request.eventId&&e.symbols.includes(request.symbol));if(!event)fail('EVENT_COMPANY');
 if(extraSources.length!==request.savedReceipts.length)fail('RECEIPT');
 const sources=[...context.receipts,...context.supplements].map(r=>({...r,bytes:files.get(context.scan+r.rawPath)}));
 for(let i=0;i<extraSources.length;i++){const bytes=extraSources[i];if(!Buffer.isBuffer(bytes)||bytes.length>2*1024*1024||sha(bytes)!==request.savedReceipts[i].sha256)fail('RAW_HASH');sources.push({...request.savedReceipts[i],bytes});}
 for(const s of sources){if(s.bytes&&sha(s.bytes)!==s.sha256)fail('RAW_HASH');for(const t of [s.startedAt,s.receivedAt,s.publishedAt])if(t!=null&&(!stamp(t)||Date.parse(t)>Date.parse(at)))fail('CLOCK');if(s.receivedAt&&s.startedAt&&Date.parse(s.receivedAt)<Date.parse(s.startedAt))fail('CLOCK');if(s.publishedAt&&s.receivedAt&&Date.parse(s.publishedAt)>Date.parse(s.receivedAt))fail('CLOCK');}
 for(const t of [lineage.originalCutoff,event.receivedAt])if(t&&(!stamp(t)||Date.parse(t)>Date.parse(at)))fail('CLOCK');
 const title=typeof event.title==='string'?event.title:null,queryLabels=title?periodLabels(title):[],query=queryLabels[0]??null;
 const ambiguousQuery=uniq(queryLabels.map(p=>JSON.stringify([p.quarter,p.fiscalYear,p.yearLabel,p.yearBasis]))).length>1;
 const queryEnd=title?.match(new RegExp('\\b(?:ended|ending)\\s+('+datePattern+')','i')),queryPeriodEnd=queryEnd?dateOnly(queryEnd[1]):null;
 const titleTickers=[...(title??'').matchAll(/\b(?:NYSE|NASDAQ)\s*:\s*([A-Z][A-Z0-9.]{0,8})\b/g)].map(m=>m[1]);
 for(const m of (title??'').matchAll(/(?:^([A-Z]{1,5})\b|\(([A-Z]{1,5})\))/g)){const symbol=m[1]??m[2];if(lineage.pool.includes(symbol))titleTickers.push(symbol);}
 const issuerConflicts=uniq(titleTickers.filter(s=>s!==request.symbol));
 const out={version:'TECH36_SEC_MATERIAL_MATCH_V1',scanId:lineage.scanId,eventId:event.eventId,symbol:request.symbol,accession:request.accession,generatedAt:at,
  sourcePolicySha256:lineage.scanPolicySha256,sourceCutoff:lineage.originalCutoff,
  authority:'SAVED_MATERIAL_CANDIDATES_NOT_FACT_VERIFICATION',sourceReads:0,marketCalls:0,automaticAppend:false,pendingCleared:false,executionAllowed:false,
  query:{title,authority:'UNVERIFIED_DISCOVERY_QUERY_NOT_BODY_EVIDENCE',discoveryPublishedAt:event.publishedAt??null,discoveryReceivedAt:event.receivedAt??null,period:query,periodLabels:queryLabels,periodEnd:queryPeriodEnd,issuerConflicts,ambiguous:ambiguousQuery,topic:/guidance|outlook/i.test(title??'')?'GUIDANCE':'RESULTS_OR_UNSPECIFIED'},
  status:'UNKNOWN',reasons:[],issuer:null,filing:null,mainDocuments:[],candidates:[],rejectedLinks:[],uniqueCandidate:null,
  guidanceRevision:{status:'UNKNOWN',delta:null,reason:'NO_REVIEWED_PREVIOUS_CURRENT_PAIR_WITH_SAME_TARGET_PERIOD_METRIC_BASIS_CURRENCY_UNIT_SCOPE'},
  consensusSurprise:{status:'UNKNOWN',delta:null,reason:'NO_INDEPENDENT_COMPARABLE_PRE_ANNOUNCEMENT_CONSENSUS'},
  reviewHandoff:{command:'--append-event-review',explicitReviewRequired:true,automaticRequest:false},
  limitations:['Finite English earnings-release patterns only; unsupported formats remain unknown.','An archive path, source hash or issuer mention is not machine authentication.','Date-only disclosure does not establish a first publication instant.','MATCH only aligns explicit labels; it does not verify the headline claim, guidance delta or consensus surprise.']};
 const coverage=lineage.coverage.find(c=>c.symbol===request.symbol&&c.sourceId==='SEC_SUBMISSIONS'),registry=sources.find(s=>s.rawPath===coverage?.rawPath&&s.sha256===coverage?.sha256);
 let issuer;try{issuer=registry&&usable(registry)&&JSON.parse(registry.bytes.toString('utf8'));}catch{}
 if(!issuer||!/^\d{1,10}$/.test(String(issuer.cik))||typeof issuer.name!=='string'||!Array.isArray(issuer.tickers)||!issuer.tickers.includes(request.symbol)){out.reasons.push('SAVED_ISSUER_METADATA_MISSING_OR_UNBOUND');return out;}
 out.issuer={cik:String(issuer.cik),name:issuer.name,symbol:request.symbol,source:envelope(registry)};
 const recent=issuer.filings?.recent,index=Array.isArray(recent?.accessionNumber)?recent.accessionNumber.indexOf(request.accession):-1;
 if(index<0){out.reasons.push('ACCESSION_NOT_IN_SAVED_COMPANY_METADATA');return out;}
 if(recent.accessionNumber.filter(a=>a===request.accession).length!==1){out.reasons.push('MULTIPLE_METADATA_ACCESSION_ROWS');return out;}
 const column=name=>Array.isArray(recent[name])&&typeof recent[name][index]==='string'?recent[name][index]:null;
 const primary=column('primaryDocument'),accepted=column('acceptanceDateTime');
 if(!primary){out.reasons.push('PRIMARY_DOCUMENT_METADATA_LIST_MISSING');return out;}
 out.filing={primaryDocument:primary,form:column('form'),reportDate:column('reportDate'),acceptedAt:stamp(accepted)?accepted:null,acceptanceAuthority:'SAVED_SEC_METADATA_NOT_DISCLOSURE_TIME'};
 if(stamp(accepted)&&Date.parse(accepted)>Date.parse(registry.receivedAt))fail('CLOCK');
 const acc=request.accession.replaceAll('-',''),mains=sources.filter(s=>{const a=archive(s.url);return a&&a.cik===cik(issuer.cik)&&a.accession===acc&&a.file===primary;});
 if(!mains.length){out.status='MISSING';out.reasons.push('SAVED_PRIMARY_DOCUMENT_RECEIPT_MISSING_NO_URL_GUESSED');return out;}
 const seenMain=new Set(),seenCandidate=new Set();let limited=false;
 for(const main of mains){const mk=main.url+'|'+main.sha256;if(seenMain.has(mk))continue;seenMain.add(mk);
  if(!usable(main)){out.mainDocuments.push({source:envelope(main),status:'MISSING',reasons:['PRIMARY_SOURCE_NOT_SUCCESSFUL']});continue;}
  let body,links;try{body=extractTechOriginal(main.bytes);links=extractTechOriginalLinks(main.bytes);}catch{out.mainDocuments.push({source:envelope(main),status:'UNKNOWN',reasons:['PRIMARY_BODY_UNSUPPORTED']});continue;}
  const id=identity(main,body,issuer,request.symbol,{main:true});out.mainDocuments.push({source:envelope(main),sourceReceipts:sources.filter(s=>s.url===main.url&&s.sha256===main.sha256).map(envelope),status:id.status,identity:id});
  if(links.length>200){limited=true;links=links.slice(0,200);}
  const grouped=new Map();
  for(const link of links){let url;try{url=new URL(link.href,main.url).href;}catch{out.rejectedLinks.push({href:link.href,reason:'INVALID_URL',citation:citation(main,link)});continue;}
   const a=archive(url),m=archive(main.url);if(a?.url===m?.url)continue;
   if(!a||a.cik!==cik(issuer.cik)||a.accession!==acc||!/\.html?$/i.test(a.file)){out.rejectedLinks.push({href:link.href,reason:'NOT_SAME_ISSUER_ACCESSION_HTML_ATTACHMENT',citation:citation(main,link)});continue;}
   if(!grouped.has(a.url))grouped.set(a.url,[]);grouped.get(a.url).push(citation(main,link));
  }
  for(const [url,linkCitations]of grouped){if(out.candidates.length>=20){limited=true;break;}
   const found=sources.filter(s=>archive(s.url)?.url===url),versions=found.length?found:[{url,status:'MISSING',sha256:null}];
   for(const source of versions){if(out.candidates.length>=20){limited=true;break;}const key=mk+'|'+url+'|'+source.sha256;if(seenCandidate.has(key))continue;seenCandidate.add(key);
    const candidate={id:'SEC-MATERIAL-'+sha(Buffer.from(key)).slice(0,24),source:envelope(source),sourceReceipts:found.filter(s=>s.sha256===source.sha256).map(envelope),mainSource:envelope(main),linkCitations,status:'UNKNOWN',reasons:[],issuer:null,period:null,reviewCitations:[]};out.candidates.push(candidate);
    if(!usable(source)){candidate.status='MISSING';candidate.reasons.push(source.httpStatus===403?'SAVED_ACCESS_DENIED_NO_RETRY':'LINKED_BODY_NOT_AVAILABLE');continue;}
    let extracted;try{extracted=extractTechOriginal(source.bytes);}catch{candidate.reasons.push('UNSUPPORTED_BODY_ENCODING');continue;}
    candidate.issuer=identity(source,extracted,issuer,request.symbol);candidate.period=resultPeriod(source,extracted);
    const p=candidate.period;candidate.reasons.push(...id.reasons,...candidate.issuer.reasons,...p.reasons);
    candidate.reviewCitations=uniq([...candidate.issuer.claims,...p.claims,...p.disclosures].map(c=>c.citation.blockIndex).filter(n=>Number.isInteger(n))).map(blockIndex=>({sha256:source.sha256,blockIndex}));
    if(id.status==='CONFLICT'||candidate.issuer.status==='CONFLICT'||p.reasons.some(r=>/MULTIPLE_RESULT|AFTER_DISCLOSURE/.test(r))){candidate.status='CONFLICT';continue;}
    if(issuerConflicts.length){candidate.status='CONFLICT';candidate.reasons.push('QUERY_ISSUER_CONFLICT');continue;}
    if(out.query.topic==='GUIDANCE'){candidate.reasons.push('RESULT_PERIOD_IS_NOT_GUIDANCE_TARGET_COMPARABLE_PAIR_REQUIRED');continue;}
    if(ambiguousQuery){candidate.reasons.push('QUERY_MULTIPLE_PERIOD_LABELS');continue;}
    if(queryEnd&&!queryPeriodEnd){candidate.reasons.push('QUERY_INVALID_PERIOD_END');continue;}
    if(query&&((query.quarter&&p.quarter&&query.quarter!==p.quarter)||(query.fiscalYear&&p.fiscalYear&&query.fiscalYear!==p.fiscalYear)||(queryPeriodEnd&&p.periodEnd&&queryPeriodEnd!==p.periodEnd))){candidate.status='CONFLICT';candidate.reasons.push('QUERY_RESULT_PERIOD_CONFLICT');continue;}
    if(!query?.quarter||!query?.fiscalYear){candidate.reasons.push('QUERY_FISCAL_PERIOD_INCOMPLETE');continue;}
    if(!p.quarter||!p.fiscalYear||!p.periodEnd||!p.disclosureDate){candidate.reasons.push('BODY_EXPLICIT_FISCAL_PERIOD_OR_DISCLOSURE_INCOMPLETE');continue;}
    if(candidate.reasons.length===0&&id.status==='MATCH'&&candidate.issuer.status==='MATCH')candidate.status='MATCH';
   }
  }
 }
 if(limited)out.reasons.push('BOUNDED_CANDIDATE_LIMIT_NO_UNIQUE_MATCH');
 if(out.mainDocuments.some(m=>m.status==='CONFLICT')||out.candidates.some(c=>c.status==='CONFLICT')){out.status='CONFLICT';out.reasons.push('ISSUER_OR_PERIOD_CONFLICT_REQUIRES_REVIEW');}
 else if(!limited&&out.mainDocuments.length===1&&out.mainDocuments[0].status==='MATCH'&&out.candidates.length===1&&out.candidates[0].status==='MATCH'){out.status='MATCH';out.uniqueCandidate=out.candidates[0].id;}
 else if(!out.candidates.length||out.candidates.every(c=>c.status==='MISSING')){out.status='MISSING';out.reasons.push('NO_AVAILABLE_LINKED_ATTACHMENT_BODY');}
 else {out.reasons.push(out.candidates.length>1||out.mainDocuments.length>1?'MULTIPLE_CANDIDATES_OR_PRIMARY_VERSIONS_NO_SELECTION':'EXPLICIT_MATCH_CONSTRAINTS_INCOMPLETE');}
 return out;
}
