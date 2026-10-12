import { paperSession } from './RobinhoodPaperSession';
import { paperFingerprint } from '../options-paper/OptionsPaperTradingEngine';

type Row = {openAt:string;closeAt:string;open:number;high:number;low:number;close:number;volume:number;interpolated:boolean|null};
const fail=(code:string):never=>{throw Error('AUTO_BARS_'+code);};
const object=(v:any):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v:fail('OBJECT');
function clock(v:any):number {
 if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,19)!==v.slice(0,19))fail('CLOCK');
 return Date.parse(v);
}
function price(v:any):number {
 if(typeof v!=='string'||!/^\d{1,9}(?:\.\d{1,6})?$/.test(v)||!Number.isFinite(Number(v))||Number(v)<=0)fail('PRICE');
 return Number(v);
}
function payload(r:any) {
 if(r?.isError===true||r?.is_error===true)fail('TOOL_ERROR');
 const sc=r?.structuredContent??r?.structured_content;
 if(sc)return object(sc);
 if(r?.data)return object(r);
 const texts=r?.content?.filter((c:any)=>c.type==='text');
 if(texts?.length!==1)fail('RESPONSE_SHAPE');
 try{return object(JSON.parse(texts[0].text));}catch{ return fail('RESPONSE_SHAPE'); }
}

/** Research observations only. Never supplies REVIEWED quality, real-time entitlement,
 * missing interpolation=false, a frozen technical plan, or a trade-admission verdict.
 */
export function assessAutomaticEquityBars(input:unknown,asOf:string) {
 const c=object(input),r=object(c.request),at=clock(asOf),requested=clock(c.requestedAt),received=clock(c.receivedAt);
 if(c.version!=='AUTOMATIC_BAR_CAPTURE_V1'||c.provider!=='ROBINHOOD'||c.tool!=='get_equity_historicals')fail('SOURCE');
 if(requested>received||received>at)fail('RECEIPT_CLOCK');
 if(c.toolStatus!=='completed'||c.toolError)fail('TOOL_ERROR');
 if(!Array.isArray(r.symbols)||r.symbols.length<1||r.symbols.length>4||new Set(r.symbols).size!==r.symbols.length||r.symbols.some((s:any)=>!['SPY','QQQ','AAPL','TSM'].includes(s)))fail('SYMBOLS');
 if(r.interval!=='5minute'||r.bounds!=='regular'||r.adjustment_type!=='none')fail('REQUEST_SCOPE');
 const from=clock(r.start_time),to=clock(r.end_time),session=paperSession(new Date(from).toISOString(),undefined),lastSession=paperSession(new Date(to-1).toISOString(),undefined);
 if(from%300000||to%300000||to<=from||to-from>86400000||!session.isOpen||!lastSession.isOpen||session.date!==lastSession.date)fail('SESSION_WINDOW');
 const data=object(payload(c.response).data),results=data.results??[],missing=data.not_found??[];
 if(!Array.isArray(results)||!Array.isArray(missing)||results.length>r.symbols.length||new Set(missing).size!==missing.length||missing.some((s:any)=>!r.symbols.includes(s)))fail('RESULTS');
 const map=new Map<string,any>();
 for(const raw of results){const a=object(raw);if(!r.symbols.includes(a.symbol)||map.has(a.symbol)||missing.includes(a.symbol))fail('IDENTITY');map.set(a.symbol,a);}
 const assets=(r.symbols as string[]).map((symbol:string)=>{
  const a=map.get(symbol),issues:string[]=[],warnings:string[]=[],rows:Row[]=[],excluded:Array<{index:number;reason:string}>=[];
  let duplicates=0,forming=0,unknownInterpolation=0;
  const seen=new Map<number,string>();
  if(!a)issues.push(missing.includes(symbol)?'SYMBOL_NOT_FOUND':'RESULT_OMITTED');
  if(a&&(a.interval!==r.interval||a.bounds!==r.bounds))issues.push('RESPONSE_SCOPE_MISMATCH');
  const rawBars=a?.bars??[];
  if(!Array.isArray(rawBars)||rawBars.length>1000)fail('BAR_BOUND');
  let previous=-Infinity;
  for(const [index,b] of rawBars.entries()){
   try{
    object(b);const begin=clock(b.begins_at),end=begin+300000;
    if(begin<from||begin>=to||begin%300000)fail('BAR_RANGE_OR_GRID');
    if(begin<previous)issues.push('SOURCE_ORDER');previous=begin;
    const digest=paperFingerprint(b);
    if(seen.has(begin)){duplicates++;if(seen.get(begin)!==digest)issues.push('CONFLICTING_DUPLICATE');else warnings.push('IDENTICAL_DUPLICATE_REMOVED');excluded.push({index,reason:'DUPLICATE'});continue;}
    seen.set(begin,digest);
    if(b.session!=='reg'||!paperSession(new Date(begin).toISOString(),undefined).isOpen)fail('BAR_SESSION');
    if(end>requested){forming++;excluded.push({index,reason:'FORMING_AT_REQUEST'});continue;}
    if(b.interpolated!==undefined&&typeof b.interpolated!=='boolean')fail('INTERPOLATION_INVALID');
    if(b.interpolated===true){excluded.push({index,reason:'INTERPOLATED'});continue;}
    const interpolation=typeof b.interpolated==='boolean'?b.interpolated:null;
    if(interpolation===null)unknownInterpolation++;
    const open=price(b.open_price),high=price(b.high_price),low=price(b.low_price),close=price(b.close_price);
    if(high<Math.max(open,close)||low>Math.min(open,close)||low>high)fail('OHLC');
    if(!Number.isSafeInteger(b.volume)||b.volume<0||b.volume>1e12)fail('VOLUME');
    rows.push({openAt:new Date(begin).toISOString(),closeAt:new Date(end).toISOString(),open,high,low,close,volume:b.volume,interpolated:interpolation});
   }catch(e){const reason=e instanceof Error?e.message:'AUTO_BARS_ROW';issues.push(reason);excluded.push({index,reason});}
  }
  const completedEnd=Math.min(to,Math.floor(requested/300000)*300000),expected=Math.max(0,(completedEnd-from)/300000);
  const rowTimes=new Set(rows.map(b=>Date.parse(b.openAt))),gaps:string[]=[];
  for(let t=from;t<completedEnd;t+=300000)if(!rowTimes.has(t))gaps.push(new Date(t).toISOString());
  if(gaps.length)issues.push('COMPLETED_GRID_GAPS');
  if(!rows.length)issues.push('NO_COMPLETED_BARS');
  if(unknownInterpolation)warnings.push('INTERPOLATION_UNKNOWN');
  let metrics:null|{open:number;close:number;high:number;low:number;shareVolume:number;returnBps:number;observedDirection:string;sma5:number|null;lastVolumeRatio:number|null}=null;
  if(!issues.length&&rows.length){
   const first=rows[0]!,last=rows.at(-1)!,baseline=rows.slice(-6,-1),average=baseline.length===5?baseline.reduce((n,b)=>n+b.volume,0)/5:0;
   metrics={open:first.open,close:last.close,high:Math.max(...rows.map(b=>b.high)),low:Math.min(...rows.map(b=>b.low)),shareVolume:rows.reduce((n,b)=>n+b.volume,0),returnBps:(last.close/first.open-1)*10000,observedDirection:last.close>first.open?'UP':last.close<first.open?'DOWN':'FLAT',sma5:rows.length>=5?rows.slice(-5).reduce((n,b)=>n+b.close,0)/5:null,lastVolumeRatio:average>0?last.volume/average:null};
  }
  const newest=rows.at(-1)?.closeAt??null;
  return {symbol,status:metrics?'DESCRIPTIVE_RESEARCH_READY':'DATA_QUALITY_BLOCKED',expectedCompletedBars:expected,returnedBars:rawBars.length,completedBars:rows.length,formingExcluded:forming,duplicateRows:duplicates,unknownInterpolation,issues:[...new Set(issues)],warnings:[...new Set(warnings)],gaps,excluded,bars:rows,metrics,
   newestCompletedAt:newest,newestBarAgeSeconds:newest?(at-Date.parse(newest))/1000:null,
   source:{provider:'ROBINHOOD',transport:'MCP_SAVED_RECEIPT',timezone:'UTC',displayTimezone:'America/New_York',session:'REGULAR',intervalSeconds:300,adjustmentRequested:'none',adjustmentResponseVerified:false,volumeUnit:'SHARES',volumeCoverage:'PROVIDER_REPORTED_COVERAGE_UNKNOWN',delaySeconds:null,cacheStatus:'UNKNOWN',providerPublishedAt:null,requestedAt:c.requestedAt,receivedAt:c.receivedAt,clockBasis:c.clockBasis??'UNKNOWN'},
   strictTechnicalEligible:false,realtimeAdmissionEligible:false,executionAllowed:false};
 });
 return {version:'AUTOMATIC_BAR_RESEARCH_V1',asOf,captureFingerprint:paperFingerprint(c),assets,sourceQualified:false,executionAllowed:false,paperAdmissionAllowed:false};
}
