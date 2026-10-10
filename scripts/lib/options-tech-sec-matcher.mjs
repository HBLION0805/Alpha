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
const escapeRx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const endedDates=text=>[...text.matchAll(new RegExp('\\b(?:ended|ending)\\s+('+datePattern+')','gi'))].map(m=>({text:m[1],value:dateOnly(m[1]),index:m.index}));
const annual=text=>/\b(?:annual|full[ -]year)\b/i.test(text)||(!periodLabels(text).length&&/\bfiscal year\s+(?:20\d{2}|\d{2})\s+results\b/i.test(text));
const comparisonRx=/\b(?:compared (?:with|to)|versus|vs\.?|relative to|prior[ -](?:year|quarter|period)|year[ -]ago|previous (?:quarter|year|period))\b/i;
function supportedAnnouncement(text,issuer,symbol){
 // Deliberately closed grammar, not a dependency parser or co-occurrence test.
 const prefix='(?:[A-Z][A-Z .,\\-]{0,70} -- '+datePattern+' -- )?';
 const subject=escapeRx(issuer.name).replace(/\s+/g,'\\s+')+' \\((?:NYSE|NASDAQ): '+escapeRx(symbol)+'\\)';
 const tail=' (?:today )?(?:announced|reported) (?:financial )?results for (?:its|the) (?:first|second|third|fourth) quarter(?: fiscal(?: year)? 20\\d{2}| 20\\d{2})? ended '+datePattern+'\\.?';
 return !/\b(?:said|according|quote|customer|partner|joint|together|behalf)\b/i.test(text)&&new RegExp('^'+prefix+subject+tail+'$').test(text);
}
function quotationScope(raw){
 // Strict saved-markup subset, not HTML error recovery. Keep source offsets used by
 // extractTechOriginal; quoted tag attributes and raw-text bodies are not tags.
 const stack=[],ranges=[],voids=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
 const invalid=reason=>({status:'UNKNOWN',reason,ranges});
 let cursor=0;
 while(cursor<raw.length){const start=raw.indexOf('<',cursor);if(start<0)break;
  if(raw.startsWith('<!--',start)){const end=raw.indexOf('-->',start+4);if(end<0)return invalid('UNCLOSED_COMMENT');cursor=end+3;continue;}
  const declaration=raw.slice(start).match(/^<!doctype\s+html\s*>/i);if(declaration){cursor=start+declaration[0].length;continue;}
  let end=start+1,quote=null;for(;end<raw.length;end++){const c=raw[end];if(quote){if(c===quote)quote=null;}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;else if(c==='<')return invalid('UNSUPPORTED_TAG_SYNTAX');}
  if(end===raw.length||quote)return invalid('UNCLOSED_TAG_OR_ATTRIBUTE');
  const token=raw.slice(start,end+1),m=token.match(/^<(\/?)([a-z][\w:-]*)([^]*)>$/i);if(!m)return invalid('UNSUPPORTED_TAG_SYNTAX');
  const tag=m[2].toLowerCase(),closing=!!m[1],tail=m[3];cursor=end+1;
  if(closing){if(!/^\s*$/.test(tail)||voids.has(tag)||stack.at(-1)?.tag!==tag)return invalid('MISMATCHED_CLOSING_TAG');const entry=stack.pop();if(tag==='q'||tag==='blockquote')ranges.push({tag,sourceStart:entry.start,sourceEnd:cursor});continue;}
  if(!/^(?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"<>]*"|'[^'<>]*'|[^\s"'=<>`]+))?)*\s*\/?$/.test(tail))return invalid('UNSUPPORTED_ATTRIBUTE_SYNTAX');
  if(['svg','math','template','noscript','plaintext'].includes(tag))return invalid('UNSUPPORTED_CONTENT_MODEL');
  if(voids.has(tag))continue;
  if(/\/\s*$/.test(tail))return invalid('NONVOID_SELF_CLOSING_TAG');
  if(['script','style','textarea','title','xmp','iframe','noembed','noframes'].includes(tag)){
   const close=new RegExp('</'+tag+'\\s*>','ig');close.lastIndex=cursor;const found=close.exec(raw);if(!found)return invalid('UNCLOSED_RAW_TEXT');cursor=found.index+found[0].length;ranges.push({tag,sourceStart:start,sourceEnd:cursor});continue;
  }
  stack.push({tag,start});
 }
 if(stack.length)return invalid('UNCLOSED_ELEMENT');
 return {status:'PARSED_RESTRICTED_MARKUP',reason:null,ranges};
}
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
 let issuerAnnouncement=false,quotes=null;
 if(!main){const raw=source.bytes.toString('utf8');quotes=quotationScope(raw);if(quotes.status==='UNKNOWN')issues.push('QUOTATION_SCOPE_UNKNOWN_'+quotes.reason);
  for(const b of body.blocks){if(/<(?:td|th)\b/i.test(raw.slice(b.sourceStart,b.sourceEnd))||b.text.search(comparisonRx)===0||!/\b(?:announced|reported)\b/i.test(b.text)||!/\bresults\b/i.test(b.text))continue;
   const quoted=quotes.status==='UNKNOWN'||quotes.ranges.some(r=>r.sourceStart<b.sourceEnd&&r.sourceEnd>b.sourceStart)||/["“”‘’]/.test(b.text);
   if(!quoted&&supportedAnnouncement(b.text,issuer,symbol)){issuerAnnouncement=true;claims.push({kind:'RESTRICTED_ISSUER_SUBJECT_CLAUSE',value:b.text,citation:citation(source,b)});}
   else issues.push('UNSUPPORTED_OR_THIRD_PARTY_ANNOUNCEMENT');
  }
 }
 const complete=!!named&&(main?mainCik:issuerAnnouncement);
 return {status:issues.some(r=>/^ISSUER_.*CONFLICT$/.test(r))?'CONFLICT':issues.length?'UNKNOWN':complete?'MATCH':'UNKNOWN',reasons:issues.length?uniq(issues):complete?[]:['ISSUER_BODY_BINDING_INCOMPLETE'],claims,...(!main?{quotationScope:quotes}:{})};
}
function resultPeriod(source,body,{at}={}){
 const claims=[],disclosures=[],guidanceMentions=[],mentions=[],endClaims=[],reasons=[],raw=source.bytes.toString('utf8');let multiPeriod=false,section='UNSCOPED';
 for(const block of body.blocks){
  const table=/<(?:td|th)\b/i.test(raw.slice(block.sourceStart,block.sourceEnd));
  if(!table&&block.text.length<100){if(/^(?:financial )?(?:guidance|outlook)$/i.test(block.text))section='GUIDANCE';else if(/results|highlights|statements/i.test(block.text))section='UNSCOPED';}
  for(const sentence of block.text.split(/(?<=[.!?;])\s+(?=[A-Z])/)){
   const cite=citation(source,block);
   const comparisonAt=sentence.search(comparisonRx),parts=comparisonAt<0?[{text:sentence,comparison:false}]:[{text:sentence.slice(0,comparisonAt),comparison:false},{text:sentence.slice(comparisonAt),comparison:true}];
   for(const part of parts){const text=part.text,labels=periodLabels(text),ends=endedDates(text),isAnnual=annual(text),guide=/guidance|outlook|expect|forecast/i.test(text)||section==='GUIDANCE',results=/\bresults\b/i.test(text);
    const role=part.comparison?'COMPARISON':table?'TABLE_NOT_TARGET':guide?'GUIDANCE':isAnnual?'ANNUAL':results?'RESULTS':'UNSCOPED';
    if(labels.length||ends.length||isAnnual||guide||results)mentions.push({text,role,labels,endedDates:ends,annual:isAnnual,citation:cite});
    if(role==='COMPARISON'||role==='TABLE_NOT_TARGET')continue;
    if(role==='GUIDANCE'){guidanceMentions.push({text,labels,endedDates:ends,citation:cite});if(results&&(labels.length||ends.length))reasons.push('MIXED_RESULTS_GUIDANCE_REQUIRES_REVIEW');continue;}
    if(role==='ANNUAL'){multiPeriod=true;continue;}
    if(role==='UNSCOPED'){if(labels.length||ends.length)reasons.push('UNSCOPED_PERIOD_REQUIRES_REVIEW');continue;}
    for(const end of ends){endClaims.push({...end,citation:cite});if(!end.value)reasons.push('INVALID_PERIOD_END');}
    for(const p of labels)claims.push({quarter:p.quarter,fiscalYear:p.fiscalYear,yearLabel:p.yearLabel,yearBasis:p.yearBasis,periodEnd:ends.length===1?ends[0].value:null,citation:cite});
   }
   if(table||comparisonAt===0)continue;
   const verb=sentence.search(/\b(?:announced|reported)\b/i),prefix=verb>=0?sentence.slice(0,verb):/^(?:disclosure date|release date|published|press release dated)\s*:/i.test(sentence)?sentence:'';
   for(const d of prefix.matchAll(new RegExp(datePattern,'gi'))){const value=dateOnly(d[0]);if(value)disclosures.push({value,precision:'DATE_ONLY_NOT_FIRST_DISSEMINATION',citation:cite});else reasons.push('INVALID_DISCLOSURE_DATE');}
  }
 }
 const values=key=>uniq(claims.map(c=>c[key]).filter(v=>v!==null)),quarter=values('quarter'),fiscalYear=values('fiscalYear'),periodEnd=uniq(endClaims.map(c=>c.value).filter(Boolean)),yearLabel=values('yearLabel'),dates=uniq(disclosures.map(c=>c.value));
 if([quarter,fiscalYear,periodEnd,yearLabel,dates].some(v=>v.length>1))reasons.push('MULTIPLE_RESULT_PERIOD_OR_DISCLOSURE_CLAIMS');
 if(multiPeriod)reasons.push('MULTI_PERIOD_RELEASE_REQUIRES_REVIEW');
 if(periodEnd.length===1&&dates.length===1&&periodEnd[0]>dates[0])reasons.push('RESULT_PERIOD_AFTER_DISCLOSURE');
 const disclosureOrder=[];
 for(const date of dates)for(const [bound,clock]of [['RECEIPT',source.receivedAt],['AS_OF',at]])if(stamp(clock)){
  // Calendar-date bounds over UTC-12..UTC+14, not an asserted midnight publication.
  const day=Date.parse(date+'T00:00:00Z'),t=Date.parse(clock),earliest=day-14*3600000,latestExclusive=day+36*3600000;
  const status=t<earliest?'DEFINITELY_FUTURE':t<latestExclusive?'ORDER_UNKNOWN_TIMEZONE_PRECISION':'DATE_ENTIRELY_BEFORE_BOUND';
  disclosureOrder.push({date,bound,clock,status,precision:'DATE_ONLY',timezone:'UNKNOWN'});
  if(status==='DEFINITELY_FUTURE')reasons.push('DISCLOSURE_DEFINITELY_AFTER_'+bound);else if(status==='ORDER_UNKNOWN_TIMEZONE_PRECISION')reasons.push('DISCLOSURE_ORDER_UNKNOWN_'+bound);
 }
 return {quarter:quarter.length===1?quarter[0]:null,fiscalYear:fiscalYear.length===1?fiscalYear[0]:null,yearLabel:yearLabel.length===1?yearLabel[0]:null,yearBasis:fiscalYear.length===1?'FISCAL':yearLabel.length===1?'UNSPECIFIED':'UNKNOWN',periodEnd:periodEnd.length===1?periodEnd[0]:null,disclosureDate:dates.length===1?dates[0]:null,claims,disclosures,disclosureOrder,mentions,endClaims,guidanceMentions,reasons:uniq(reasons)};
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
 const title=typeof event.title==='string'?event.title:null,queryLabels=title?periodLabels(title):[];
 const ambiguousQuery=uniq(queryLabels.map(p=>JSON.stringify([p.quarter,p.fiscalYear,p.yearLabel,p.yearBasis]))).length>1;
 const query=ambiguousQuery?null:queryLabels[0]??null,queryEnds=endedDates(title??''),queryEndValues=uniq(queryEnds.map(e=>e.value).filter(Boolean)),queryPeriodEnd=queryEndValues.length===1?queryEndValues[0]:null;
 const titleTickers=[...(title??'').matchAll(/\b(?:NYSE|NASDAQ)\s*:\s*([A-Z][A-Z0-9.]{0,8})\b/g)].map(m=>m[1]);
 for(const m of (title??'').matchAll(/(?:^([A-Z]{1,5})\b|\(([A-Z]{1,5})\))/g)){const symbol=m[1]??m[2];if(lineage.pool.includes(symbol))titleTickers.push(symbol);}
 const issuerConflicts=uniq(titleTickers.filter(s=>s!==request.symbol));
 const out={version:'TECH36_SEC_MATERIAL_MATCH_V1',parsePolicy:'RESTRICTED_ISSUER_PERIOD_DATE_QUOTATION_V3',scanId:lineage.scanId,eventId:event.eventId,symbol:request.symbol,accession:request.accession,generatedAt:at,
  sourcePolicySha256:lineage.scanPolicySha256,sourceCutoff:lineage.originalCutoff,
  authority:'SAVED_MATERIAL_CANDIDATES_NOT_FACT_VERIFICATION',sourceReads:0,marketCalls:0,automaticAppend:false,pendingCleared:false,executionAllowed:false,
  query:{title,authority:'UNVERIFIED_DISCOVERY_QUERY_NOT_BODY_EVIDENCE',discoveryPublishedAt:event.publishedAt??null,discoveryReceivedAt:event.receivedAt??null,period:query,periodLabels:queryLabels,endedDates:queryEnds,annual:annual(title??''),periodEnd:queryPeriodEnd,issuerConflicts,ambiguous:ambiguousQuery||queryEndValues.length>1,topic:/guidance|outlook/i.test(title??'')?'GUIDANCE':'RESULTS_OR_UNSPECIFIED'},
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
  const id=identity(main,body,issuer,request.symbol,{main:true}),mainPeriod=resultPeriod(main,body,{at});
  const periodConflict=p=>p.reasons.some(r=>/MULTIPLE_RESULT|AFTER_DISCLOSURE|DISCLOSURE_DEFINITELY_AFTER/.test(r));
  out.mainDocuments.push({source:envelope(main),sourceReceipts:sources.filter(s=>s.url===main.url&&s.sha256===main.sha256).map(envelope),status:id.status==='CONFLICT'||periodConflict(mainPeriod)?'CONFLICT':mainPeriod.reasons.length?'UNKNOWN':id.status,identity:id,period:mainPeriod});
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
    candidate.issuer=identity(source,extracted,issuer,request.symbol);candidate.period=resultPeriod(source,extracted,{at});
    const p=candidate.period;candidate.reasons.push(...id.reasons,...candidate.issuer.reasons,...p.reasons,...mainPeriod.reasons.map(r=>'PRIMARY_'+r));
    candidate.reviewCitations=uniq([...candidate.issuer.claims,...p.claims,...p.disclosures].map(c=>c.citation.blockIndex).filter(n=>Number.isInteger(n))).map(blockIndex=>({sha256:source.sha256,blockIndex}));
    if(id.status==='CONFLICT'||candidate.issuer.status==='CONFLICT'||periodConflict(p)||periodConflict(mainPeriod)){candidate.status='CONFLICT';continue;}
    if(['quarter','fiscalYear','periodEnd'].some(k=>mainPeriod[k]!=null&&p[k]!=null&&mainPeriod[k]!==p[k])){candidate.status='CONFLICT';candidate.reasons.push('PRIMARY_ATTACHMENT_PERIOD_CONFLICT');continue;}
    if(issuerConflicts.length){candidate.status='CONFLICT';candidate.reasons.push('QUERY_ISSUER_CONFLICT');continue;}
    if(out.query.topic==='GUIDANCE'){candidate.reasons.push('RESULT_PERIOD_IS_NOT_GUIDANCE_TARGET_COMPARABLE_PAIR_REQUIRED');continue;}
    if(out.query.annual){candidate.reasons.push('QUERY_ANNUAL_OR_MULTI_PERIOD_REQUIRES_REVIEW');continue;}
    if(ambiguousQuery){candidate.reasons.push('QUERY_MULTIPLE_PERIOD_LABELS');continue;}
    if(queryEndValues.length>1){candidate.reasons.push('QUERY_MULTIPLE_PERIOD_ENDS');continue;}
    if(queryEnds.some(e=>!e.value)){candidate.reasons.push('QUERY_INVALID_PERIOD_END');continue;}
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
