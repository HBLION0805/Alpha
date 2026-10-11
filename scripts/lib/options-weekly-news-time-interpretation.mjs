import {createHash} from 'node:crypto';
import {parseDriverFeed,parseFocusedFeed} from './options-driver-io.mjs';
export const NEWS_TIME_INTERPRETATION_VERSION='WEEKLY_NEWS_TIME_INTERPRETATION_V1';
const hash=x=>createHash('sha256').update(x).digest('hex');
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const unknown=reason=>({state:'UNKNOWN',interpretedAt:null,reason,offsetMinutes:null});
/** Explicit literal offsets only; no Date.parse, locale, inferred year or DST correction. */
export function interpretFeedDate(raw){
 if(typeof raw!=='string'||raw.length>160)return unknown('MISSING_OR_OVERSIZED_DATE');
 const value=raw.trim();
 const m=/^(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+(EDT|EST|GMT|UTC|[+-]\d{4})$/.exec(value);
 if(!m)return unknown('COMPLETE_UNAMBIGUOUS_DATE_REQUIRED');
 const [,weekday,d,mon,y,h,min,s,zone]=m,year=Number(y),month=months.indexOf(mon),day=Number(d),hour=Number(h),minute=Number(min),second=Number(s);
 if(year<1900||year>9999||hour>23||minute>59||second>59||day<1)return unknown('INVALID_DATE_COMPONENT');
 const local=Date.UTC(year,month,day,hour,minute,second),date=new Date(local);
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month||date.getUTCDate()!==day)return unknown('INVALID_CALENDAR_DATE');
 if(weekday&&days[date.getUTCDay()]!==weekday)return unknown('WEEKDAY_DATE_CONFLICT');
 let offset=zone==='EDT'?-240:zone==='EST'?-300:0;
 if(/^[+-]/.test(zone)){const hours=Number(zone.slice(1,3)),minutes=Number(zone.slice(3));if(hours>14||minutes>59||(hours===14&&minutes!==0))return unknown('INVALID_OFFSET');offset=(zone[0]==='-'?-1:1)*(hours*60+minutes);}
 return {state:'INTERPRETED',interpretedAt:new Date(local-offset*60000).toISOString(),offsetMinutes:offset,reason:zone==='EDT'||zone==='EST'?'LITERAL_US_ABBREVIATION_FIXED_OFFSET':'EXPLICIT_SOURCE_OFFSET'};
}
// Small lexical reader, not a general XML parser. Only direct item children count;
// markup inside comments/CDATA/description cannot supply a date or item boundary.
function itemFields(xml){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('UNSUPPORTED_XML');
 const stack=[],items=[];let item=null,field=null,count=0;
 const re=/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<[^>]*>|[^<]+/g;
 for(const m of xml.matchAll(re)){
  if(++count>50000)throw Error('XML_TOKEN_LIMIT');const t=m[0];
  if(t.startsWith('<!--')||t.startsWith('<?')){if(field)throw Error('AMBIGUOUS_DATE_MARKUP');continue;}
  if(t.startsWith('<![CDATA[')){if(field&&stack.length===field.depth)field.raw+=t;continue;}
  if(!t.startsWith('<')){if(field&&stack.length===field.depth)field.raw+=t;continue;}
  const close=/^<\/([\w:.-]+)\s*>$/.exec(t);
  if(close){const name=close[1];if(stack.at(-1)!==name)throw Error('XML_STRUCTURE');if(field&&stack.length===field.depth){item.fields.push({name:field.name,raw:field.raw});field=null;}if(name==='item'&&item&&stack.length===item.depth){item.raw=xml.slice(item.start,m.index+t.length);items.push(item);item=null;}stack.pop();continue;}
  const open=/^<([\w:.-]+)(?:\s[^>]*)?\/?>$/.exec(t);if(!open)throw Error('XML_STRUCTURE');const name=open[1];if(name==='item'){if(item||stack.at(-1)!=='channel')throw Error('AMBIGUOUS_ITEM_SCOPE');item={start:m.index,depth:stack.length+1,fields:[]};}
  const selfClosing=/\/\s*>$/.test(t);if(item&&stack.length===item.depth&&['pubDate','published','updated','dc:date'].includes(name)){if(selfClosing)item.fields.push({name,raw:''});else field={name,raw:'',depth:stack.length+1};}
  else if(field)throw Error('NESTED_DATE_MARKUP');
  if(!selfClosing)stack.push(name);
 }
 if(stack.length||item||field)throw Error('XML_STRUCTURE');return items;
}
function interpretItem(fields,legacy,sourceId,receivedAt,at){
 const ofac=sourceId==='ofac',publication=fields.filter(f=>f.name!=='updated'),updates=fields.filter(f=>f.name==='updated');
 let result=publication.length===1?interpretFeedDate(publication[0].raw):unknown(publication.length?'MULTIPLE_PUBLICATION_FIELDS':'PUBLICATION_FIELD_MISSING');
 if(updates.length>1)result=unknown('MULTIPLE_UPDATE_FIELDS');
 if(result.state==='INTERPRETED'&&legacy.publishedAt!==null&&legacy.publishedAt!==result.interpretedAt)result=unknown('LEGACY_INTERPRETATION_CONFLICT');
 const update=updates.length===1?interpretFeedDate(updates[0].raw):unknown('UPDATE_CLOCK_UNKNOWN');
 if(result.state==='INTERPRETED'&&(Date.parse(result.interpretedAt)>Date.parse(receivedAt)||update.state==='INTERPRETED'&&(update.interpretedAt<result.interpretedAt||Date.parse(update.interpretedAt)>Date.parse(receivedAt))))result=unknown('SOURCE_CLOCK_CONFLICT');
 const historical=result.interpretedAt!==null&&Date.parse(at)-Date.parse(result.interpretedAt)>72*3600000;
 return {itemId:legacy.itemId,title:legacy.headline,sourceRef:legacy.link,originalPublishedAt:legacy.publishedAt,rawFields:fields,...result,publicationWindow:result.interpretedAt===null?'UNKNOWN':historical?'HISTORICAL':'CURRENT',contentWindow:ofac?'UNKNOWN':result.interpretedAt===null?'UNKNOWN':historical?'HISTORICAL':'CURRENT',clockMeaning:ofac?'OFAC_ITEM_CREATION_NOT_CONTENT_UPDATE':'SOURCE_PUBLICATION_FIELD',contentUpdatedAt:null,updateFieldInterpretation:update,contentWindowHours:72,coverageApplied:false};
}
/** Additive explanation after the unchanged reader's legacy integrity/replay gate. */
export function projectNewsTimeInterpretations(refresh,at){
 const result={version:NEWS_TIME_INTERPRETATION_VERSION,assessedAt:at,scope:['bea','eia_energy','ofac'],authority:'ADDITIVE_UNSAVED_EXPLANATION_ONLY',legacyParsedAndCoverageUnchanged:true,sourceCalls:0,fileSystemWrites:0,receipts:[],issues:[]};
 if(refresh.issues?.length){result.issues.push({reason:'LEGACY_READER_ISSUES',details:refresh.issues});return result;}
 const latest=new Map();for(const r of refresh.records??[]){if(!result.scope.includes(r.sourceId)||r.receivedAt>at)continue;const old=latest.get(r.sourceId);if(!old||old.receivedAt<r.receivedAt)latest.set(r.sourceId,r);else if(old.receivedAt===r.receivedAt&&old.recordFingerprint!==r.recordFingerprint)latest.set(r.sourceId,{...old,ambiguousLatest:true});}
 for(const r of latest.values()){
  const receipt={sourceId:r.sourceId,path:r.path,recordFingerprint:r.recordFingerprint,rawSha256:r.rawSha256,requestedAt:r.requestedAt,receivedAt:r.receivedAt,originalStatus:r.parsed.status,originalPartial:r.parsed.partial,originalRejectedItems:r.parsed.rejectedItems??0,originalParsedItems:r.parsed.items.length,rows:[],issues:[]};result.receipts.push(receipt);
  try{
   if(r.ambiguousLatest)throw Error('AMBIGUOUS_LATEST_RECEIPT');if(r.parsed.status!=='OBTAINED_PENDING_REVIEW'||r.bodyComplete!==true)throw Error('ORIGINAL_ACQUISITION_NOT_COMPLETE');const bytes=Buffer.from(r.rawBase64,'base64');if(bytes.length>524288||hash(bytes)!==r.rawSha256)throw Error('RAW_INTEGRITY');
   const blocks=itemFields(new TextDecoder('utf8',{fatal:true}).decode(bytes)),parser=r.sourceId==='eia_energy'?parseFocusedFeed:parseDriverFeed,matches=new Map();
   for(const b of blocks.slice(0,100)){const parsed=parser('<rss><channel>'+b.raw+'</channel></rss>',r.sourceId,r.receivedAt).items;if(parsed.length!==1)continue;const i=parsed[0],key=JSON.stringify([i.itemId,i.link,i.headline,i.publishedAt]);const group=matches.get(key)??[];group.push(b.fields);matches.set(key,group);}
   for(const i of r.parsed.items){const candidates=matches.get(JSON.stringify([i.itemId,i.link,i.headline,i.publishedAt]))??[];const row=candidates.length===1?interpretItem(candidates[0],i,r.sourceId,r.receivedAt,at):{itemId:i.itemId,title:i.headline,sourceRef:i.link,originalPublishedAt:i.publishedAt,rawFields:[],...unknown('AMBIGUOUS_OR_MISSING_ITEM_IDENTITY'),publicationWindow:'UNKNOWN',contentWindow:'UNKNOWN',contentUpdatedAt:null,coverageApplied:false};receipt.rows.push(row);}
  }catch(e){receipt.issues.push({reason:e.message});}
  receipt.counts={interpreted:receipt.rows.filter(x=>x.state==='INTERPRETED').length,unknown:receipt.rows.filter(x=>x.state==='UNKNOWN').length,historical:receipt.rows.filter(x=>x.contentWindow==='HISTORICAL').length,current:receipt.rows.filter(x=>x.contentWindow==='CURRENT').length,contentUpdateUnknown:receipt.rows.filter(x=>x.clockMeaning==='OFAC_ITEM_CREATION_NOT_CONTENT_UPDATE').length};
 }
 return result;
}
