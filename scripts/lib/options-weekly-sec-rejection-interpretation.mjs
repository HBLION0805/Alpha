import {sourceHash} from './options-weekly-source-storage.mjs';
import {WEEKLY_ISSUER_SOURCES} from './options-weekly-issuer-parsers.mjs';
export const SEC_REJECTION_INTERPRETATION_VERSION='WEEKLY_SEC_REJECTION_INTERPRETATION_V1';
const check=(value,reason)=>{if(!value)throw Error(reason);};
// Gregorian validation is independent of the preserved legacy /^20\\d\\d/ gate.
export function strictSecDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [y,m,d]=value.split('-').map(Number);if(y<1000||m<1||m>12||d<1)return null;
 const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?value:null;
}
export function strictSecAcceptance(value){
 if(typeof value!=='string')return null;const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
 if(!m||!strictSecDay(m[1]))return null;const [,day,h,min,s,ms,zone]=m;if(+h>23||+min>59||+s>59)return null;
 let offset=0;if(zone!=='Z'){const oh=+zone.slice(1,3),om=+zone.slice(4);if(oh>14||om>59||oh===14&&om!==0)return null;offset=(zone[0]==='-'?-1:1)*(oh*60+om);}
 const [y,month,d]=day.split('-').map(Number);return new Date(Date.UTC(y,month-1,d,+h,+min,+s,+(ms??0))-offset*60000).toISOString();
}
function explainRow(raw,index,originalReason,receivedAt){
 const filingDate=strictSecDay(raw.filingDate),reportDate=strictSecDay(raw.reportDate),acceptedAt=strictSecAcceptance(raw.acceptanceDateTime),received=strictSecAcceptance(receivedAt),issues=[];
 if(!filingDate)issues.push('INVALID_OR_INCOMPLETE_FILING_DATE');else if(!/^20\d\d-/.test(filingDate))issues.push('LEGACY_DATE_YEAR_RANGE_2000_2099');
 if(raw.reportDate==='')issues.push('REPORT_DATE_MISSING');else if(!reportDate)issues.push('INVALID_OR_INCOMPLETE_REPORT_DATE');else if(!/^20\d\d-/.test(reportDate))issues.push('LEGACY_REPORT_YEAR_RANGE_2000_2099');
 if(raw.primaryDocument==='')issues.push('PRIMARY_DOCUMENT_MISSING');else if(typeof raw.primaryDocument!=='string'||!/^[A-Za-z0-9_.\/-]+$/.test(raw.primaryDocument)||raw.primaryDocument.startsWith('/')||raw.primaryDocument.split('/').includes('..'))issues.push('PRIMARY_DOCUMENT_INVALID');
 const acceptanceValid=acceptedAt!==null&&received!==null&&Date.parse(acceptedAt)<=Date.parse(received);if(!acceptanceValid)issues.push('INVALID_OR_FUTURE_ACCEPTANCE_CLOCK');
 const filingValid=filingDate!==null&&received!==null&&filingDate<=received.slice(0,10);if(filingDate&&!filingValid)issues.push('FUTURE_FILING_DATE');
 const cutoff=received===null?null:new Date(Date.parse(received)-30*86400000).toISOString();
 const window=filingValid&&acceptanceValid?(Date.parse(acceptedAt)<Date.parse(cutoff)?'HISTORICAL_OUTSIDE_30_DAY_WINDOW':'WITHIN_30_DAY_WINDOW'):'UNKNOWN';
 return {index,originalReason,rawFields:raw,filingDate,filingDateState:filingValid?'VALID_GREGORIAN_DATE':'UNKNOWN',reportDate,reportDateState:reportDate?'EXPLICIT_SOURCE_DATE':'UNKNOWN',acceptedAt:acceptanceValid?acceptedAt:null,acceptanceState:acceptanceValid?'EXPLICIT_CLOCK_BEFORE_RECEIPT':'UNKNOWN',originalWindowCutoff:cutoff,window,issues,documentUrl:null,documentBodyObtained:false,metadataPromoted:false,descriptionUsedAsFilename:false};
}
/** Pure additive view of already legacy-validated snapshots; never repairs stored rows. */
export function projectSecRejectionInterpretations(snapshot,at){
 const out={version:SEC_REJECTION_INTERPRETATION_VERSION,assessedAt:at,scope:'ASML_SAVED_SEC_REJECTIONS_ONLY',authority:'ADDITIVE_UNSAVED_EXPLANATION_ONLY',legacyParsedAndCountsUnchanged:true,sourceCalls:0,fileSystemWrites:0,inventory:null,receipts:[],issues:[]};
 if(snapshot.issues?.length){out.issues.push({reason:'LEGACY_READER_ISSUES',details:snapshot.issues});return out;}
 const all=(snapshot.records??[]).filter(r=>WEEKLY_ISSUER_SOURCES[r.sourceId]?.family==='SEC_SUBMISSIONS'&&Date.parse(r.receivedAt)<=Date.parse(at)),latest=new Map(),ambiguous=new Set();
 for(const r of all){const old=latest.get(r.sourceId);if(!old||Date.parse(old.receivedAt)<Date.parse(r.receivedAt)){latest.set(r.sourceId,r);ambiguous.delete(r.sourceId);}else if(old.receivedAt===r.receivedAt&&old.recordFingerprint!==r.recordFingerprint)ambiguous.add(r.sourceId);}
 const reliable=ambiguous.size===0&&[...latest.values()].every(r=>Number.isInteger(r.parsed.sourceItemCount)&&Number.isInteger(r.parsed.rejectedItems));
 out.inventory={savedSecReceipts:all.length,latestSourceCount:latest.size,countsReliable:reliable,latestRawRows:reliable?[...latest.values()].reduce((n,r)=>n+r.parsed.sourceItemCount,0):null,latestRejectedRows:reliable?[...latest.values()].reduce((n,r)=>n+r.parsed.rejectedItems,0):null,ambiguousLatestSources:[...ambiguous]};
 const r=latest.get('asml_sec');if(!r)return out;
 const receipt={sourceId:r.sourceId,path:r.path,recordFingerprint:r.recordFingerprint,rawSha256:r.rawSha256,requestedAt:r.requestedAt,receivedAt:r.receivedAt,originalStatus:r.parsed.status,originalPartial:r.parsed.partial,originalSourceRows:r.parsed.sourceItemCount,originalValidatedRows:r.parsed.validatedRows,originalRejectedItems:r.parsed.rejectedItems,originalRecentFilings:r.parsed.filings?.length??0,originalOmittedOlder:r.parsed.omittedOlder,originalOmittedRecent:r.parsed.omittedRecent,rows:[],issues:[]};out.receipts.push(receipt);
 try{
  check(!ambiguous.has('asml_sec'),'AMBIGUOUS_LATEST_RECEIPT');check(r.parsed.status==='OBTAINED_PENDING_REVIEW'&&r.bodyComplete===true,'ORIGINAL_ACQUISITION_NOT_COMPLETE');
  const bytes=Buffer.from(r.rawBase64,'base64');check(bytes.length<=524288&&sourceHash(bytes)===r.rawSha256,'RAW_INTEGRITY');const body=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));check(String(body.cik).padStart(10,'0')==='0000937966'&&body.tickers?.includes('ASML'),'ASML_IDENTITY');
  const recent=body.filings?.recent,fields=['accessionNumber','filingDate','reportDate','acceptanceDateTime','form','primaryDocument'],n=recent?.accessionNumber?.length;
  check(Number.isInteger(n)&&n<=5000&&fields.every(k=>Array.isArray(recent[k])&&recent[k].length===n),'SEC_COLUMNS');check(n===r.parsed.sourceItemCount&&r.parsed.rejected.length===r.parsed.rejectedItems&&r.parsed.rejected.length<=100,'REJECTION_COUNT');const seen=new Set();
  const rows=[];for(const rejection of r.parsed.rejected){const i=rejection.index;check(Number.isInteger(i)&&i>=0&&i<n&&!seen.has(i),'REJECTION_INDEX');seen.add(i);const raw=Object.fromEntries(fields.map(k=>[k,recent[k][i]]));if(Array.isArray(recent.primaryDocDescription)&&recent.primaryDocDescription.length===n)raw.primaryDocDescription=recent.primaryDocDescription[i];check(typeof raw.accessionNumber==='string'&&/^\d{10}-\d{2}-\d{6}$/.test(raw.accessionNumber),'ACCESSION_IDENTITY');rows.push(explainRow(raw,i,rejection.reason,r.receivedAt));}receipt.rows=rows;
 }catch(e){receipt.issues.push({reason:e.message});}
 receipt.counts={explained:receipt.rows.length,historical:receipt.rows.filter(x=>x.window==='HISTORICAL_OUTSIDE_30_DAY_WINDOW').length,withinWindow:receipt.rows.filter(x=>x.window==='WITHIN_30_DAY_WINDOW').length,unknownWindow:receipt.rows.filter(x=>x.window==='UNKNOWN').length,legacyYearLimited:receipt.rows.filter(x=>x.issues.includes('LEGACY_DATE_YEAR_RANGE_2000_2099')).length,missingDocument:receipt.rows.filter(x=>x.issues.includes('PRIMARY_DOCUMENT_MISSING')).length,missingReportDate:receipt.rows.filter(x=>x.issues.includes('REPORT_DATE_MISSING')).length};return out;
}
