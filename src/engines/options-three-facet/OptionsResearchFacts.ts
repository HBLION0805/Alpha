import {createHash} from 'node:crypto';
import type {Evidence, ThreeFacetInput} from '../../contracts/OptionsThreeFacet';
import {snapshotNs} from '../options-robinhood-data/RobinhoodSnapshotPaper';
import {parseChainSurveyJson} from '../options-robinhood-data/RobinhoodChainSurvey';

export const ASSISTANT_FACT_POLICY='SIMULATED_ASSISTANT_FACTS_V1';
export const ASSISTANT_SIM_ACCOUNT='paper-sim-tech-1000-20261010';
const check=(ok:unknown,code:string):void=>{if(!ok)throw Error('RESEARCH_FACT_'+code);};
const text=(v:unknown,max=2000):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const exact=(o:unknown,keys:string)=>!!o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join()===keys.split(' ').sort().join();
export function assistantFactScope(context:unknown,accountId:unknown):boolean {
 return context==='SIMULATED_ACCOUNT_REAL_MARKET_DATA'?accountId===ASSISTANT_SIM_ACCOUNT:
  context==='TEST_FIXTURE_SIMULATED_ACCOUNT'&&typeof accountId==='string'&&/^paper-sim-fixture-[a-z0-9-]{1,32}$/.test(accountId);
}
/** Byte/locator/chronology checks only. Attribution is not publisher authentication.
 * Original tool receipts are retained whole; no review clock is made a receipt. */
export function validateResearchFactSources(i:ThreeFacetInput):void {
 const b=i.factSources;
 check(i.version==='THREE_FACET_INPUT_V2'&&b&&exact(b,'version context accountId originals facts')&&b.version===ASSISTANT_FACT_POLICY&&assistantFactScope(b.context,b.accountId),'SCOPE');
 check(['AAPL','TSM'].includes(i.symbol)&&i.instrumentType==='EQUITY','SYMBOL');
 check(Array.isArray(b!.originals)&&b!.originals.length>0&&b!.originals.length<=4&&new Set(b!.originals.map(o=>o.id)).size===b!.originals.length,'ORIGINALS');
 check(Array.isArray(b!.facts)&&b!.facts.length>0&&b!.facts.length<=12&&new Set(b!.facts.map(f=>f.id)).size===b!.facts.length,'FACTS');
 for(const o of b!.originals){
  check(exact(o,'id origin rawJson sha256')&&text(o.id)&&text(o.rawJson,65536)&&/^[a-f0-9]{64}$/.test(o.sha256)&&sha(o.rawJson)===o.sha256,'ORIGINAL_HASH');
  check(o.origin===(b!.context==='TEST_FIXTURE_SIMULATED_ACCOUNT'?'SYNTHETIC_FIXTURE':'PROVIDER_DOCUMENT'),'ORIGINAL_ORIGIN');
  const r=parseChainSurveyJson(o.rawJson) as Record<string,any>;
  check(r.version==='SAVED_WEB_RESEARCH_RECEIPT_V1'&&text(r.result,60000)&&
   ['LOCAL_TOOL_RETURN_OBSERVED_NOT_PROVIDER_HTTP','LOCAL_TOOL_RETURN_OBSERVED_NOT_PROVIDER_HTTP_CLOCK'].includes(r.clockBasis)&&
   snapshotNs(r.requestedAt)<=snapshotNs(r.receivedAt),'ORIGINAL_RECEIPT');
 }
 for(const f of b!.facts){
  check(exact(f,'id originalId source quotedText extractedBy attribution purpose availableNoLaterThan publication')&&text(f.id)&&text(f.originalId)&&text(f.source)&&text(f.quotedText,1200)&&f.extractedBy==='ASSISTANT'&&f.attribution==='PUBLISHER_CLAIM'&&['ORDINARY_FACT','EXACT_EVENT'].includes(f.purpose),'FACT');
  let url:URL;try{url=new URL(f.source);}catch{throw Error('RESEARCH_FACT_SOURCE_URL');}
  check(url.protocol==='https:'&&!url.username&&!url.password,'SOURCE_URL');
  const o=b!.originals.find(o=>o.id===f.originalId);check(o,'MISSING_ORIGINAL');const r=JSON.parse(o!.rawJson);
  // Web results have one titled source per separator. Match text inside the same
  // source block, not a link to that source in another article's navigation.
  const blocks=(r.result as string).split(/\n-{10,}\n/);
  check(blocks.some(block=>block.split('\n')[0]!.includes('('+f.source+')')&&block.includes(f.quotedText)),'SOURCE_LOCATOR');
  check(f.availableNoLaterThan===null||f.availableNoLaterThan===r.receivedAt,'AVAILABILITY_BINDING');
  const p=f.publication;check(p&&['UNKNOWN','CALENDAR_DATE','UTC_MINUTE','EXACT','INTERVAL'].includes(p.precision),'PUBLICATION');
  if(p.precision==='UNKNOWN')check(exact(p,'precision'),'PUBLICATION');
  else if(p.precision==='INTERVAL'){
   check(exact(p,'precision from through')&&snapshotNs(p.from)<snapshotNs(p.through),'PUBLICATION_INTERVAL');
  }else{
   check(exact(p,'precision value')&&text(p.value),'PUBLICATION');
   if(p.precision==='CALENDAR_DATE'){check(/^\d{4}-\d\d-\d\d$/.test(p.value!),'PUBLICATION_DATE');snapshotNs(p.value+'T00:00:00Z');}
   if(p.precision==='UTC_MINUTE'){check(/^\d{4}-\d\d-\d\dT\d\d:\d\dZ$/.test(p.value!),'PUBLICATION_MINUTE');snapshotNs(p.value!.slice(0,-1)+':00Z');}
   if(p.precision==='EXACT')snapshotNs(p.value);
  }
 }
 const evidence=[...(i.fundamental?.evidence??[]),...(i.news?.evidence??[])];
 check(evidence.length>0&&evidence.every(e=>text(e.factId)&&b!.facts.some(f=>f.id===e.factId)),'FACT_BINDINGS');
}
export function researchFactTimeEligible(e:Evidence,i:ThreeFacetInput):boolean {
 try{
  const b=i.factSources!,f=b.facts.find(f=>f.id===e.factId);if(!f||e.source!==f.source)return false;
  const o=b.originals.find(o=>o.id===f.originalId)!;const r=JSON.parse(o.rawJson);
  if(e.receivedAt!==r.receivedAt||f.availableNoLaterThan!==r.receivedAt)return false;
  const receipt=snapshotNs(r.receivedAt),review=snapshotNs(e.reviewedAt),at=snapshotNs(i.asOf),registration=snapshotNs(i.researchPlan?.registeredAt??i.asOf);
  if(receipt>review||review>at||receipt>registration)return false;
  const p=f.publication;
  // This bounded adapter only admits ordinary facts available by a retained receipt.
  // Exact event/publication claims need the existing separate exact-evidence route.
  if(f.purpose==='EXACT_EVENT'||p.precision==='EXACT')return false;
  {
   if(e.publishedAt!==null)return false;
   if(p.precision==='UTC_MINUTE'&&snapshotNs(p.value!.slice(0,-1)+':00Z')+60000000000n>receipt)return false;
   if(p.precision==='INTERVAL'&&(snapshotNs(p.through)>receipt||snapshotNs(p.through)>registration))return false;
   if(p.precision==='CALENDAR_DATE'&&p.value!>r.receivedAt.slice(0,10))return false;
  }
  // An observed dated trigger cannot be recast as ordinary untimed background.
  if(e.kind==='NEWS'&&i.news?.eventAt&&(i.news.triggerState??'OBSERVED')==='OBSERVED')return false;
  return true;
 }catch{return false;}
}
