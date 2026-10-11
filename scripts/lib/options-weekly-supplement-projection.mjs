import {REVIEWED_SOURCE_MAP} from './options-weekly-reviewed-source-map.mjs';
import {sourceHash,sourceClock,readSourceBytes} from './options-weekly-source-storage.mjs';
import {parsePanwFeaturedEnvelope,CBOE_PDF_URL} from './options-weekly-source-supplement.mjs';
const check=(v,c)=>{if(!v)throw Error(c);};
const clean=s=>s.replace(/<!--[\s\S]*?(?:-->|$)/g,'').replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const visible=s=>s.replace(/<!--[\s\S]*?(?:-->|$)/g,'').replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'');
const historical=(symbol,title,startAt,sourceLocator)=>({symbol,title,startAt,sourceLocator,category:/earnings/i.test(title)?'EARNINGS':/conference/i.test(title)?'CONFERENCE':'COMPANY_EVENT',timePrecision:'DATE_ONLY',timezone:'UNKNOWN',occurrenceVerified:false});

export function interpretFollowup(id,body){
 const s=visible(body);
 if(id==='asml_results'){
  const h=[...s.matchAll(/<h2 class="h3">(ASML Holding NV will announce its Q([1-4]) (20\d\d) financial results on [^<]+)<\/h2>/g)];check(h.length===1,'SUPPLEMENT_ASML_HEADING');const text=clean(h[0][1]);check(text==='ASML Holding NV will announce its Q3 2026 financial results on Wednesday, October 14, 2026.','SUPPLEMENT_ASML_DATE_CHANGED');check(s.includes('The press release will be distributed via GlobeNewswire at 07:00 CET.')&&s.includes('Investor call at 15:00 CET'),'SUPPLEMENT_ASML_CLOCK_TEXT');
  return {events:[{title:'ASML Q3 2026 financial results',startAt:'2026-10-14',category:'EARNINGS',affectedSymbols:['ASML'],sourceLocator:'Quarterly results announcement heading',sourceFields:{printedStatement:text,printedReleaseTime:'07:00 CET',printedInvestorCallTime:'15:00 CET',timeRelationship:'UNRESOLVED_DO_NOT_CONVERT'}}],historical:[],state:'OBTAINED_PENDING_REVIEW',scope:'Single next financial-results announcement, not all ASML events; printed CET retained without timezone correction.'};
 }
 if(id==='etn_events'){
  const m=/<h2>Analyst Conferences<\/h2>([\s\S]*?)<\/div>/.exec(s);check(m,'SUPPLEMENT_ETN_SECTION');const rows=[...m[1].matchAll(/<p><b>([^<]+)<\/b><br\s*\/?>\s*([A-Z][a-z]+ \d{1,2}, 20\d\d)<br/g)];check(rows.length===3,'SUPPLEMENT_ETN_ROWS');const expected=[['Morgan Stanley 14th Annual Laguna Conference','September 16, 2026','2026-09-16'],['Barclays 43rd Annual Industrial Select Conference','February 17, 2026','2026-02-17'],['UBS Global Industrials and Transportation Conference','December 2, 2025','2025-12-02']];const records=rows.map((r,i)=>{check(r[1]===expected[i][0]&&r[2]===expected[i][1],'SUPPLEMENT_ETN_CHANGED');return historical('ETN',r[1],expected[i][2],'Analyst Conferences row '+i);});return {events:[],historical:records,state:'HISTORICAL_BACKGROUND',scope:'Named Analyst Conferences section only; quarterly results without a date are not calendar events.'};
 }
 if(id==='hpe_full'){
  const a=s.indexOf('id="highlight-section"'),z=s.indexOf('id="financial-section"',a);check(a>=0&&z>a,'SUPPLEMENT_HPE_SECTION');const section=s.slice(a,z),cards=section.split('class="box" id="box-').slice(1);check(cards.length===4,'SUPPLEMENT_HPE_ROWS');const records=[],rejected=[];
  for(const [i,card]of cards.entries()){const d=/<p class="highlight-date">([\s\S]*?)<\/p>/.exec(card),t=/<div class="equal-box">\s*<p>([\s\S]*?)<\/p>/.exec(card);check(d&&t,'SUPPLEMENT_HPE_ROW');if(i===2){rejected.push({index:i,reason:'COMBINED_TWO_CONFERENCES_WITH_DISTINCT_POPUP_DATES',printedDate:clean(d[1]),title:clean(t[1])});continue;}const expected=({0:['09/02/2026','2026-09-02','Q3 Fiscal Year 2026 HPE Earnings Conference Call'],1:['09/08/2026','2026-09-08',"Citi's 2026 Global TMT Conference"],3:['09/30/2026','2026-09-30','HPE Networking Investor Day']})[i];check(clean(d[1])===expected[0]&&clean(t[1])===expected[2],'SUPPLEMENT_HPE_CHANGED');records.push(historical('HPE',expected[2],expected[1],'Investor Highlights card '+i));}
  return {events:[],historical:records,rejected,state:'HISTORICAL_BACKGROUND',scope:'Complete homepage Investor Highlights only; combined two-date card left unresolved; no upcoming calendar coverage.'};
 }
 return {events:[],historical:[],state:'UNPARSED_SAVED_HTML',scope:'Saved page has no supported date-bearing calendar; not evidence of no upcoming events.'};
}

export function readWeeklySupplements(root,at,mappings=REVIEWED_SOURCE_MAP){
 check(sourceClock(at),'SUPPLEMENT_ASSESSMENT_CLOCK');const records=[],issues=[];
 for(const map of mappings){let original;try{original=readSourceBytes(root,map.path,3*1024*1024);}catch(e){if(e.code!=='ENOENT')issues.push({source:map.id,state:'INVALID_EVIDENCE',reason:'SUPPLEMENT_SOURCE_UNREADABLE'});continue;}
  try{
   check(sourceClock(map.reviewedAt),'SUPPLEMENT_REVIEW_CLOCK');if(Date.parse(map.reviewedAt)>Date.parse(at))continue;
   check(sourceHash(original)===map.receiptSha256,'SUPPLEMENT_RECEIPT_HASH');const r=JSON.parse(original);check(sourceClock(r.requestedAt)&&sourceClock(r.receivedAt)&&Date.parse(r.requestedAt)<=Date.parse(r.receivedAt),'SUPPLEMENT_SOURCE_CLOCK');if(Date.parse(r.receivedAt)>Date.parse(at))continue;check(Date.parse(map.reviewedAt)>=Date.parse(r.receivedAt),'SUPPLEMENT_REVIEW_ORDER');
   const raw=Buffer.from(r.rawBase64,'base64');check(raw.length<=2*1024*1024&&raw.toString('base64')===r.rawBase64&&sourceHash(raw)===r.rawSha256,'SUPPLEMENT_RAW_HASH');
   let parsed;
   if(map.kind==='CBOE_PDF'){
    check(r.url===CBOE_PDF_URL&&r.bodyComplete===true&&r.httpStatus===200&&r.error===null,'SUPPLEMENT_PDF_SOURCE');const reviewBytes=readSourceBytes(root,map.reviewPath,128*1024);check(sourceHash(reviewBytes)===map.reviewSha256,'SUPPLEMENT_REVIEW_HASH');const review=JSON.parse(reviewBytes);check(sourceClock(review.reviewedAt)&&Date.parse(review.reviewedAt)>=Date.parse(r.receivedAt)&&Date.parse(review.reviewedAt)<=Date.parse(map.reviewedAt),'SUPPLEMENT_VISUAL_REVIEW_CLOCK');check(sourceHash(readSourceBytes(root,map.pdfPath,2*1024*1024))===r.rawSha256&&review.pdfSha256===r.rawSha256&&sourceHash(readSourceBytes(root,map.imagePath,4*1024*1024))===review.pageImageSha256,'SUPPLEMENT_PDF_IMAGE_HASH');check(review.events.length===7,'SUPPLEMENT_PDF_MAPPING');
    parsed={events:review.events.map(e=>({title:'Cboe '+e.productScope+' — '+e.kind,startAt:e.date,category:'OPTIONS_MARKET',affectedSymbols:[],productScope:e.productScope,dateKind:e.kind,sourceLocator:'PDF page 1 October cell '+e.date+' / '+e.visualMarker,sourceFields:{productScope:e.productScope,dateKind:e.kind,printedLegend:e.printedLegend,visualMarker:e.visualMarker},notes:'仅限所列产品类别；不是具体合约验证。10/15 仅为标准 AM 结算股指到期系列最后交易日，不是股票或 ETF 最后交易日规则。日期可能变更，具体结算时间未知。'})),historical:[],state:'VISUALLY_REVIEWED_CATEGORY_DATES',scope:'October 12–16 category/date mapping only. Codex page-image review, not Owner approval, all-exchange coverage or contract qualification.',reviewPath:map.reviewPath,reviewSha256:map.reviewSha256};
   }else if(map.kind==='PANW_HISTORY'){const p=parsePanwFeaturedEnvelope(original);parsed={events:[],historical:p.events,state:'HISTORICAL_BACKGROUND',scope:p.scope};}
   else if(r.error||r.httpStatus!==200)parsed={events:[],historical:[],state:'ACQUISITION_FAILED',scope:r.error==='BODY_TOO_LARGE'?'Local dedicated byte cap; incomplete body, not supplier refusal.':r.httpStatus===403?'Official target denied access (HTTP 403); no bypass or retry.':'Acquisition unresolved.',errorCode:r.error??'HTTP_'+r.httpStatus};
   else{check(/^text\/html/i.test(r.headers['content-type']??''),'SUPPLEMENT_MIME');parsed=interpretFollowup(map.id,new TextDecoder('utf8',{fatal:true}).decode(raw));}
   const freshness=Date.parse(at)-Date.parse(r.receivedAt)>26*3600000?'STALE':'WITHIN_26H_RECEIPT_WINDOW';
   const provenance={sourceId:map.id,sourceRef:r.url,path:map.path,recordFingerprint:map.receiptSha256,rawSha256:r.rawSha256,retrievedAt:r.receivedAt,requestedAt:r.requestedAt,reviewedAt:map.reviewedAt,sourceRoot:'weekly-supplements',receiptFreshness:freshness};
   records.push({...provenance,symbol:map.symbol??null,kind:map.kind,httpStatus:r.httpStatus,bytes:raw.length,...parsed,scopeComplete:false,events:parsed.events.map(e=>({...e,...provenance,timePrecision:'DATE_ONLY',timezone:'UNKNOWN',publishedAt:null,endAt:null,status:'SCHEDULED_UNVERIFIED',sourceCharacter:'OFFICIAL_SAVED',scheduleBasis:'SOURCE_BOUND_REVIEWED_MAPPING',dateInferred:false,affectedThemes:[],eventId:map.id+':'+sourceHash(JSON.stringify(e)),notes:e.notes??parsed.scope})),historical:parsed.historical.map(e=>{check(e.startAt<r.receivedAt.slice(0,10),'SUPPLEMENT_HISTORY_DATE');return {...e,...provenance,status:'HISTORICAL_BACKGROUND',occurrenceVerified:false};})});
  }catch(e){issues.push({source:map.id,state:'INVALID_EVIDENCE',reason:e.message,path:map.path});}
 }
 return {records,issues,sourceCalls:0,fileSystemWrites:0};
}

export function extendWeeklySupplementCoverage(result,snapshot,week){
 const rows=snapshot.records,inside=e=>e.startAt>=week.weekStartDate&&e.startAt<=week.weekEndDate,events=rows.flatMap(r=>r.events).filter(inside),history=rows.flatMap(r=>r.historical);
 result.sourceSupplements={records:rows,issues:snapshot.issues,events,historical:history,scopeComplete:false,sourceCalls:0,fileSystemWrites:0};
 result.events.push(...events);const pdfEvents=events.filter(e=>e.category==='OPTIONS_MARKET');result.optionsCalendarEvents.push(...pdfEvents);
 if(pdfEvents.length){const c=result.coverage.optionsMarketCoverage;c.state='PARTIAL_SOURCE';c.matchedRecords+=pdfEvents.length;c.scope+=' Separate verified PDF bytes and reviewed page-image mapping add '+pdfEvents.length+' product/date rows for this week. Product scope and last-trading versus expiration meaning are explicit on each row; no individual contract qualified.';c.sourceIds.push('cboe_reviewed_pdf');}
 const release=events.filter(e=>e.category==='EARNINGS');if(release.length){result.coverage.earningsCoverage.matchedRecords+=release.length;result.coverage.earningsCoverage.scope+=' Separate exact-source supplement: '+release.map(e=>e.title+' '+e.startAt).join('; ')+'. Original issuer ingestion counts retained; historical supplements do not raise IR success counts.';}
 return result;
}
