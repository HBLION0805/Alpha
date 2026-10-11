import {COMPANY_BATCH_SOURCES} from './options-weekly-company-catalog.mjs';
import {parseCompanyCalendar,parseCompanySubmissions} from './options-weekly-company-parsers.mjs';
import {sourceHash} from './options-weekly-source-storage.mjs';
const check=(v,c)=>{if(!v)throw Error(c);};
const monthNames='January February March April May June July August September October November December'.split(' ');
const clean=s=>String(s).replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<!--[^]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#x27;|&#39;|&apos;/g,"'").replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
function day(month,n,year){const m=monthNames.indexOf(month)+1;check(m>0&&/^20\d\d$/.test(year),'ISSUER_DATE');const d=`${year}-${String(m).padStart(2,'0')}-${n.padStart(2,'0')}`;check(new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d,'ISSUER_DATE');return d;}
const entry=(url,symbol,parser)=>Object.freeze({url:()=>url,symbol,parser,discoveryId:null});
export const WEEKLY_ISSUER_SOURCES=Object.freeze({
 ...COMPANY_BATCH_SOURCES,
 aapl_ir:entry('https://investor.apple.com/investor-relations/default.aspx','AAPL','UNVERIFIED_LAYOUT'),
 aapl_call:entry('https://www.apple.com/investor/earnings-call/','AAPL','UNVERIFIED_LAYOUT'),
 tsm_ir:entry('https://investor.tsmc.com/english/financial-calendar','TSM','UNVERIFIED_LAYOUT'),
 msft_ir:entry('https://www.microsoft.com/en-us/investor/default','MSFT','MSFT_NEXT_RELEASE'),
 tsla_ir:entry('https://ir.tesla.com/','TSLA','UNVERIFIED_LAYOUT'),
 cboe_options:entry('https://www.cboe.com/en/about/hours/us-options/',null,'CBOE_HOLIDAYS'),
 cboe_canonical:entry('https://www.cboe.com/about/hours/us-options/',null,'CBOE_HOLIDAYS')
});
function event(sourceId,title,startAt,fields){const spec=WEEKLY_ISSUER_SOURCES[sourceId];return {eventId:sourceId+':'+sourceHash(JSON.stringify([title,startAt,fields])),category:spec.symbol?'EARNINGS':'OPTIONS_MARKET',title,startAt,endAt:null,timezone:'UNKNOWN',timePrecision:'DATE_ONLY',sourceId,sourceRef:null,publishedAt:null,affectedSymbols:spec.symbol?[spec.symbol]:[],affectedThemes:[],status:'SCHEDULED_UNVERIFIED',sourceCharacter:'OFFICIAL_SAVED',scheduleBasis:'OFFICIAL_PUBLISHED_TEXT',dateInferred:false,sourceFields:fields,notes:spec.symbol?'Next earnings release date only; fiscal period, release time and call time UNKNOWN. Not a full company calendar.':'Cboe named-year options holiday context only. Printed regular/global hours retained separately; not contract hours, expiration/settlement qualification or trading permission.'};}
export function parseWeeklyIssuerBody(sourceId,body,receivedAt){
 const spec=WEEKLY_ISSUER_SOURCES[sourceId];check(spec,'ISSUER_SCOPE');
 if(spec.family==='SEC_SUBMISSIONS')return parseCompanySubmissions(spec,body,receivedAt);
 if(!['UNVERIFIED_LAYOUT','MSFT_NEXT_RELEASE','CBOE_HOLIDAYS'].includes(spec.parser))return parseCompanyCalendar(sourceId,spec,body);
 const safe=body.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<!--[^]*?-->/g,'');
 if(spec.parser==='MSFT_NEXT_RELEASE'){
  check(safe.includes('<link rel="canonical" href="https://www.microsoft.com/en-us/investor/default"/>'),'ISSUER_IDENTITY');
  const matches=[...clean(safe).matchAll(/The next earnings release will be on ([A-Z][a-z]+) (\d{1,2}), (20\d\d)\./g)];check(matches.length===1,'ISSUER_NEXT_RELEASE_MISSING_OR_AMBIGUOUS');const m=matches[0],startAt=day(m[1],m[2],m[3]);
  return {events:[event(sourceId,'MSFT next earnings release',startAt,{printedStatement:m[0],fiscalPeriod:null,releaseTime:null,callTime:null})],sourceItemCount:1,rejectedItems:0,rejected:[],partial:false,scopePeriod:null,scopeKind:'SINGLE_NEXT_RELEASE_NOT_FULL_CALENDAR'};
 }
 if(spec.parser==='CBOE_HOLIDAYS'){
  check(/<title>Hours &amp; Holidays \| Cboe<\/title>/i.test(safe),'ISSUER_IDENTITY');
  const sections=[...safe.matchAll(/<h[1-6]\b[^>]*>\s*(20\d\d)\s+Options Holiday Schedule\s*<\/h[1-6]>([\s\S]*?)(?=<h[1-6]\b|$)/g)];check(sections.length===1,'ISSUER_HOLIDAY_SECTION');const [,year,section]=sections[0],tables=[...section.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)];check(tables.length===1,'ISSUER_HOLIDAY_TABLE');
  const headers=[...tables[0][1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m=>clean(m[1]));check(headers.join('|')==='Holiday|Date|Regular Trading Hours|Global Trading Hours','ISSUER_HOLIDAY_COLUMNS');
  const rows=[...tables[0][1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].filter(m=>/<td\b/.test(m[1]));check(rows.length>0&&rows.length<=40,'ISSUER_HOLIDAY_ROWS');const events=[],rejected=[],keys=new Set();
  for(const [index,row]of rows.entries())try{const c=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>clean(m[1]));check(c.length===4&&c.every(x=>x.length>0&&x.length<500),'ISSUER_HOLIDAY_ROW');const m=/^([A-Z][a-z]+) (\d{1,2})$/.exec(c[1]);check(m,'ISSUER_DATE');const d=day(m[1],m[2],year),key=c[0]+'|'+d;check(!keys.has(key),'ISSUER_DUPLICATE');keys.add(key);events.push({...event(sourceId,'Cboe options: '+c[0],d,{holiday:c[0],printedDate:c[1],regularHours:c[2],globalHours:c[3],calendarYear:year}),sourceLocator:'Options Holiday Schedule row '+index});}catch(e){rejected.push({index,reason:e.message});}
  check(!rejected.some(r=>r.reason==='ISSUER_DUPLICATE'),'ISSUER_DUPLICATE');check(events.length,'ISSUER_NO_VALID_ROWS');return {events,sourceItemCount:rows.length,rejectedItems:rejected.length,rejected,partial:rejected.length>0,scopePeriod:year,scopeKind:'CBOE_OPTIONS_HOLIDAYS_ONLY'};
 }
 throw Error('ISSUER_UNPARSED_LAYOUT_OR_DYNAMIC_SHELL');
}
