import {sourceHash,sourceClock} from './options-weekly-source-storage.mjs';

export const CBOE_PDF_URL='https://cdn.cboe.com/resources/options/Cboe2026OPTIONSCalendar.pdf';
export const CBOE_PDF_MAX_BYTES=2*1024*1024;
const check=(v,c)=>{if(!v)throw Error(c);};

// Separate explicit acquisition: never changes the generic issuer limit or runner.
export async function acquireCboeCalendarPdf({fetchImplementation=globalThis.fetch,now=()=>new Date().toISOString(),deadlineMs=12000}={}){
 check(Number.isInteger(deadlineMs)&&deadlineMs>0&&deadlineMs<=12000,'PDF_DEADLINE');
 const requestedAt=now();check(sourceClock(requestedAt),'PDF_CLOCK');
 const controller=new AbortController();let timer,reader,httpStatus=null,headers={},error=null,bytes=Buffer.alloc(0);
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('PDF_DEADLINE_EXCEEDED'));},deadlineMs);});
 const bounded=p=>Promise.race([p,deadline]);
 try{
  const response=await bounded(fetchImplementation(CBOE_PDF_URL,{redirect:'manual',credentials:'omit',signal:controller.signal,headers:{Accept:'application/pdf','User-Agent':'Alpha-Options-Research/0.2 (bounded public PDF review)'}}));
  httpStatus=response.status;headers=Object.fromEntries(['content-type','content-length','content-encoding','date','etag','last-modified','location'].map(k=>[k,response.headers.get(k)]).filter(([,v])=>v!==null));
  check(!response.redirected,'PDF_REDIRECT_REJECTED');check(httpStatus===200,'PDF_HTTP_'+httpStatus);check(/^application\/pdf(?:;|$)/i.test(headers['content-type']??''),'PDF_CONTENT_TYPE');
  const declared=headers['content-length'];check(declared===undefined||(/^\d+$/.test(declared)&&Number(declared)<=CBOE_PDF_MAX_BYTES),'PDF_DECLARED_SIZE');
  check(response.body,'PDF_BODY_MISSING');reader=response.body.getReader();for(;;){const part=await bounded(reader.read());if(part.done)break;const chunk=Buffer.from(part.value),remaining=CBOE_PDF_MAX_BYTES-bytes.length;bytes=Buffer.concat([bytes,chunk.subarray(0,remaining)]);check(chunk.length<=remaining,'PDF_BODY_TOO_LARGE');}
  if(declared!==undefined&&!headers['content-encoding'])check(bytes.length===Number(declared),'PDF_LENGTH_MISMATCH');
  check(bytes.subarray(0,8).toString('ascii').startsWith('%PDF-'),'PDF_SIGNATURE');check(/%%EOF\s*$/.test(bytes.subarray(-1024).toString('latin1')),'PDF_INCOMPLETE_EOF');
 }catch(e){error=/^PDF_/.test(e.message)?e.message:'PDF_NETWORK_FAILED';}
 finally{clearTimeout(timer);controller.abort();if(reader)void reader.cancel().catch(()=>{});}
 const receivedAt=now();check(sourceClock(receivedAt)&&Date.parse(receivedAt)>=Date.parse(requestedAt),'PDF_CLOCK');
 return {version:'CBOE_PDF_ACQUISITION_V1',url:CBOE_PDF_URL,requestedAt,receivedAt,httpStatus,headers,error,bodyComplete:error===null,maxBytes:CBOE_PDF_MAX_BYTES,bytes:bytes.length,rawSha256:sourceHash(bytes),rawBase64:bytes.toString('base64'),dateMappingVerified:false,events:[],executionAllowed:false};
}

const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
// Reinterprets copied bytes independently; original issuer receipt/replay stays unchanged.
export function parsePanwFeaturedEnvelope(originalBytes){
 const r=JSON.parse(originalBytes);check(r.version==='OFFICIAL_SOURCE_DISCOVERY_V1'&&r.id==='panw_ir'&&r.url==='https://investors.paloaltonetworks.com/','SUPPLEMENT_IDENTITY');
 const raw=Buffer.from(r.rawBase64,'base64');check(raw.length<=524288&&raw.toString('base64')===r.rawBase64&&sourceHash(raw)===r.rawSha256,'SUPPLEMENT_RAW');
 check(r.httpStatus===200&&r.error===null&&/^text\/html/i.test(r.headers?.['content-type']??''),'SUPPLEMENT_INCOMPLETE_SOURCE');check(sourceClock(r.requestedAt)&&sourceClock(r.receivedAt)&&Date.parse(r.receivedAt)>=Date.parse(r.requestedAt),'SUPPLEMENT_CLOCK');
 const safe=new TextDecoder('utf8',{fatal:true}).decode(raw).replace(/<!--[\s\S]*?(?:-->|$)/g,'').replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'');
 const sections=[...safe.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)].filter(m=>/<h2\b[^>]*>\s*FEATURED EVENTS\s*<\/h2>/.test(m[1]));check(sections.length===1,'SUPPLEMENT_FEATURED_SECTION');
 const cards=sections[0][1].split('<div class="card rounded">').slice(1);check(cards.length>0&&cards.length<=20,'SUPPLEMENT_ROWS');const keys=new Set(),events=cards.map((card,index)=>{
  const h=/<h3 class="font-weight-bold h6">([\s\S]*?)<\/h3>/.exec(card),p=/<p class="text-d-gray">([\s\S]*?)<\/p>/.exec(card);check(h&&p,'SUPPLEMENT_ROW');const title=clean(h[1]),printedDateTime=clean(p[1]),d=/^([A-Z][a-z]{2}) (\d{1,2}), (20\d\d)\b/.exec(printedDateTime);check(d&&title.length>0&&title.length<=600,'SUPPLEMENT_DATE');
  const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(d[1])+1,startAt=d[3]+'-'+String(month).padStart(2,'0')+'-'+d[2].padStart(2,'0');check(month>0&&new Date(startAt+'T12:00:00Z').toISOString().slice(0,10)===startAt,'SUPPLEMENT_DATE');const key=title+'|'+startAt;check(!keys.has(key),'SUPPLEMENT_DUPLICATE');keys.add(key);
  return {symbol:'PANW',title,startAt,timePrecision:'DATE_ONLY',timezone:'UNKNOWN',printedDateTime,category:/earnings/i.test(title)?'EARNINGS':/conference/i.test(title)?'CONFERENCE':'COMPANY_EVENT',sourceLocator:'FEATURED EVENTS card '+index,temporalRelation:startAt<r.receivedAt.slice(0,10)?'PAST_DATE_AT_RECEIPT':'DATE_AT_OR_AFTER_RECEIPT_UNVERIFIED',occurrenceVerified:false};
 });
 return {version:'PANW_FEATURED_INTERPRETATION_V1',sourceUrl:r.url,sourceReceivedAt:r.receivedAt,originalEnvelopeSha256:sourceHash(originalBytes),rawSha256:r.rawSha256,scope:'FEATURED_EVENTS_ONLY_NOT_UPCOMING_CALENDAR',scopeComplete:false,provesNoUpcomingEvents:false,events,networkRequests:0,originalReceiptChanged:false,executionAllowed:false};
}
