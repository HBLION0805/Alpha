import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { optionsEvidenceExportStorage as io } from "../options-evidence-export.mjs";
import { parseChainSurveyJson } from "../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts";
import { paperFingerprint } from "../../src/engines/options-paper/OptionsPaperTradingEngine.ts";
import { readinessClock } from "../../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { assessDailyGuidance, defaultGuidanceSettings, validateGuidanceSettings } from "../../src/engines/options-daily-guidance/OptionsDailyGuidance.ts";
import { explainDailyGuidance } from "../../src/engines/options-daily-guidance/OptionsGuidanceRationale.ts";
import { assessGuidanceSensitivities } from "../../src/engines/options-daily-guidance/OptionsGuidanceSensitivities.ts";
import { assessGuidanceDelivery, guidanceMarketFingerprint } from "../../src/engines/options-daily-guidance/OptionsGuidanceDelivery.ts";

const BASE="data/runtime/options-daily-guidance", MAX=8*1024*1024;
const fail=code=>{throw Error("GUIDANCE_"+code);};
const object=v=>v&&typeof v==="object"&&!Array.isArray(v)?v:fail("OBJECT");
const exact=(v,keys)=>{if(Object.keys(object(v)).sort().join()!==[...keys].sort().join())fail("FIELDS");};
const array=(v,max)=>Array.isArray(v)&&v.length<=max?v:fail("ARRAY");
const iso=v=>{readinessClock(v);return v;};
const text=(v,max=3000)=>typeof v==="string"&&v.length<=max?v:fail("TEXT");
const money=v=>{if(typeof v!=="string"||!/^\d{1,8}(?:\.\d{1,6})?$/.test(v))return null;const [a,b=""]=v.split(".");if((b+"00").slice(2).replace(/0/g,""))return null;const n=Number(a)*100+Number((b+"00").slice(0,2));return Number.isSafeInteger(n)?n:null;};
const scalar=v=>typeof v==="string"&&/^-?\d{1,8}(?:\.\d{1,8})?$/.test(v)?Number(v):null;
const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
const symbol=v=>["GLD","IBIT"].includes(v)?v:fail("SYMBOL");
const identifier=v=>typeof v==="string"&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v)?v:fail("ID");
const sourceTime=v=>typeof v==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v)&&Number.isFinite(Date.parse(v))?v:null;
const price=v=>typeof v==="string"&&/^\d{1,8}(?:\.\d{1,6})?$/.test(v)&&Number(v)>0?v:null;
const parse=bytes=>parseChainSurveyJson(new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes));
function read(root,path){return parse(io.readBytes(root,path,MAX));}
function children(root,path) {
  let current=root;
  for(const part of path.split("/")) {current=resolve(current,part);if(!existsSync(current))return [];const stat=lstatSync(current);if(!stat.isDirectory()||stat.isSymbolicLink())fail("UNSAFE_DIRECTORY");}
  const result=readdirSync(current,{withFileTypes:true});if(result.length>4000)fail("CATALOG_LIMIT");return result;
}
function paths(root,kind,limit=60,since=null) {
  const base=BASE+"/"+kind,days=children(root,base).filter(v=>/^\d{4}-\d\d-\d\d$/.test(v.name)&&(since===null||v.name>=since));
  if(days.some(v=>!v.isDirectory()||v.isSymbolicLink()))fail("UNSAFE_DIRECTORY");
  return days.sort((a,b)=>b.name.localeCompare(a.name)).slice(0,60).flatMap(day=>{
    const entries=children(root,base+"/"+day.name);if(entries.length>200)fail("DAILY_LIMIT");
    return entries.filter(v=>v.name.endsWith(".json")).map(v=>base+"/"+day.name+"/"+v.name).sort().reverse();
  }).slice(0,limit);
}
function save(root,kind,input,report=null) {
  const now=new Date().toISOString(),id=now.replace(/[:.]/g,"-")+"-"+randomUUID(),dir=BASE+"/"+kind+"/"+now.slice(0,10);
  if(kind==="reports"&&iso(input.at)>now)fail("FUTURE_ISSUED_ASSESSMENT");
  const record={version:"OPTIONS_GUIDANCE_RECORD_V1",kind,recordedAt:now,input,report,inputFingerprint:paperFingerprint(input),reportFingerprint:paperFingerprint(report)};
  io.directory(root,dir);const path=dir+"/"+id+".json";io.writeExclusive(root,path,Buffer.from(JSON.stringify(record,null,2)+"\n"));return {path,record};
}
function verified(root,path,kind) {
  const r=read(root,path);exact(r,["version","kind","recordedAt","input","report","inputFingerprint","reportFingerprint"]);
  if(r.version!=="OPTIONS_GUIDANCE_RECORD_V1"||r.kind!==kind||r.inputFingerprint!==paperFingerprint(r.input)||r.reportFingerprint!==paperFingerprint(r.report))fail("RECORD_INTEGRITY");
  iso(r.recordedAt);
  if(kind==="reports"&&paperFingerprint(assessDailyGuidance(r.input))!==r.reportFingerprint)fail("REPORT_RECOMPUTE");
  return r;
}
export function normalizeGuidanceCapture(value) {
  const v=object(value);
  exact(v,["version","origin","startedAt","capturedAt","calls","receipts","failures","selectedIds","selection","accountAccessed","executionAllowed"]);
  if(v.version!=="OPTIONS_GUIDANCE_MARKET_CAPTURE_V1"||!["HOST_MARKET_TOOL_RESPONSES","SYNTHETIC_FIXTURE"].includes(v.origin)||v.accountAccessed!==false||v.executionAllowed!==false)fail("CAPTURE_SCOPE");
  const started=iso(v.startedAt),captured=iso(v.capturedAt);if(started>captured)fail("CAPTURE_CLOCK");
  const receipts=array(v.receipts,24),failures=array(v.failures,50),ids=array(v.selectedIds,36).map(identifier);
  if(new Set(ids).size!==ids.length||!Number.isSafeInteger(v.calls)||v.calls<receipts.length||v.calls>24)fail("CAPTURE_COUNTS");
  text(v.selection);const chains=new Map(),instruments=new Map(),quotes=new Map(),equities=[],quoted=new Set();
  let lastReceived=started;
  for(const r of receipts) {
    exact(r,["tool","request","requestedAt","receivedAt","response"]);
    iso(r.requestedAt);iso(r.receivedAt);
    if(r.requestedAt<lastReceived||r.receivedAt<r.requestedAt||r.receivedAt>captured)fail("RECEIPT_ORDER");lastReceived=r.receivedAt;
    const request=object(r.request),data=object(object(r.response).data);
    if(r.tool==="get_equity_quotes") {
      exact(request,["symbols"]);if(JSON.stringify(request.symbols)!=='["GLD","IBIT"]'||equities.length)fail("EQUITY_REQUEST");
      for(const result of array(data.results,2)) {
        const q=object(result.quote),sym=symbol(q.symbol);
        const prices=[[price(q.last_trade_price),sourceTime(q.venue_last_trade_time)],[price(q.last_non_reg_trade_price),sourceTime(q.venue_last_non_reg_trade_time)]].filter(([p,t])=>p&&t&&Date.parse(t)<=Date.parse(r.receivedAt)+999).sort((a,b)=>Date.parse(b[1])-Date.parse(a[1]));
        let close=null;const c=result.close;
        if(c&&c.symbol===sym&&c.interpolated===false&&c.source==="sip-list-exchange-close"&&/^\d{4}-\d\d-\d\d$/.test(c.date)&&price(c.price))close={date:c.date,price:c.price};
        equities.push({symbol:sym,price:prices[0]?.[0]??null,sourceAt:prices[0]?.[1]??null,close});
      }
    } else if(r.tool==="get_option_chains") {
      exact(request,["underlying_symbol"]);const sym=symbol(request.underlying_symbol);
      for(const c of array(data.chains,8)) {const id=identifier(c.id);if(c.symbol!==sym||chains.has(id))fail("CHAIN_IDENTITY");chains.set(id,{symbol:sym,dates:array(c.expiration_dates,100)});}
    } else if(r.tool==="get_option_instruments") {
      exact(request,["chain_id","expiration_dates","state",...(Object.hasOwn(request,"cursor")?["cursor"]:[])]);
      const ch=chains.get(identifier(request.chain_id));if(!ch||request.state!=="active"||typeof request.expiration_dates!=="string")fail("INSTRUMENT_REQUEST");
      const expirations=request.expiration_dates.split(",");if(expirations.some(d=>!ch.dates.includes(d)))fail("EXPIRATION_IDENTITY");
      for(const i of array(data.instruments,100)) {
        const id=identifier(i.id);
        if(i.chain_id!==request.chain_id||i.chain_symbol!==ch.symbol||!expirations.includes(i.expiration_date)||instruments.has(id)||!["call","put"].includes(i.type)||!price(i.strike_price))fail("INSTRUMENT_IDENTITY");
        instruments.set(id,i);
      }
    } else if(r.tool==="get_option_quotes") {
      exact(request,["instrument_ids"]);const requested=array(request.instrument_ids,20).map(identifier);
      if(!requested.length||new Set(requested).size!==requested.length)fail("QUOTE_REQUEST");
      for(const id of requested){if(!ids.includes(id)||!instruments.has(id)||quoted.has(id))fail("QUOTE_REQUEST_ID");quoted.add(id);}
      for(const result of array(data.results,20)) {
        if(result.quote===null)continue;
        const q=object(result.quote),id=identifier(q.instrument_id);if(!requested.includes(id)||quotes.has(id))fail("QUOTE_IDENTITY");
        if(sourceTime(q.updated_at)&&Date.parse(q.updated_at)>Date.parse(r.receivedAt)+999)fail("QUOTE_FUTURE_RECEIPT");
        const i=instruments.get(id),ask=money(q.ask_price),ticks=i.min_ticks;
        const tick=ticks&&ask!==null?money(ask>=Number(ticks.cutoff_price)*100?ticks.above_tick:ticks.below_tick):null;
        quotes.set(id,{id,symbol:i.chain_symbol,expiry:i.expiration_date,type:i.type,strike:i.strike_price,multiplier:i.underlying_type==="equity"&&i.state==="active"&&i.tradability==="tradable"?Number(i.trade_value_multiplier):0,bidCents:money(q.bid_price),askCents:ask,tickCents:tick,bidSize:count(q.bid_size),askSize:count(q.ask_size),delta:scalar(q.delta),updatedAt:sourceTime(q.updated_at),receivedAt:r.receivedAt});
      }
    } else fail("TOOL_NOT_ALLOWED");
  }
  if(new Set(equities.map(e=>e.symbol)).size!==equities.length)fail("EQUITY_DUPLICATE");
  for(const f of failures){if(!f||typeof f.code!=="string"||! /^[A-Z_]{1,80}$/.test(f.code))fail("FAILURE_CODE");}
  return {capturedAt:captured,origin:v.origin,complete:!failures.length&&equities.length===2&&quotes.size===ids.length&&ids.length>0&&["GLD","IBIT"].every(s=>[...quotes.values()].some(q=>q.symbol===s)),quotes:[...quotes.values()],equities};
}
export function recordGuidanceMarket(root,path) {
  const input=read(root,path),normal=normalizeGuidanceCapture(input);
  if(normal.capturedAt>new Date().toISOString())fail("FUTURE_CAPTURE");
  return save(root,"captures",input,normal).path;
}
/** Evidence projection only; keep the normalized capture and decision inputs unchanged. */
export function guidanceQuoteCoverage(value) {
  const normal=normalizeGuidanceCapture(value);
  const metadata=new Map(value.receipts.filter(r=>r.tool==='get_option_instruments').flatMap(r=>r.response.data.instruments).map(i=>[i.id,i]));
  const quotes=new Map(normal.quotes.map(q=>[q.id,q]));
  const rows=value.selectedIds.map(id=>{
    const instrument=metadata.get(id),quote=quotes.get(id);
    const receipt=value.receipts.find(r=>r.tool==='get_option_quotes'&&r.request.instrument_ids.includes(id));
    const failure=value.failures.find(f=>f.tool==='get_option_quotes'&&Array.isArray(f.request?.instrument_ids)&&f.request.instrument_ids.includes(id)&&['MARKET_SOURCE_FAILED','COLLECTION_BOUND_REACHED'].includes(f.code));
    const status=quote?'QUOTE_RETURNED':receipt?'SOURCE_QUOTE_MISSING':failure?.code==='MARKET_SOURCE_FAILED'?'QUOTE_REQUEST_FAILED':failure?.code==='COLLECTION_BOUND_REACHED'?'QUOTE_REQUEST_NOT_STARTED':'QUOTE_NOT_REQUESTED';
    return {id,symbol:instrument?.chain_symbol??null,expiry:instrument?.expiration_date??null,strike:instrument?.strike_price??null,type:instrument?.type??null,
      instrumentState:instrument?.state??null,tradability:instrument?.tradability??null,status,
      quoteRequested:!!receipt||failure?.code==='MARKET_SOURCE_FAILED',requestedAt:receipt?.requestedAt??failure?.requestedAt??null,receivedAt:receipt?.receivedAt??null,sourceAt:quote?.updatedAt??null,
      bidCents:quote?.bidCents??null,askCents:quote?.askCents??null};
  });
  const groups=new Map();
  for(const row of rows){
    const key=JSON.stringify([row.symbol,row.expiry]);
    if(!groups.has(key))groups.set(key,{symbol:row.symbol,expiry:row.expiry,selected:0,requested:0,returned:0,missing:0,sourceMissing:0,requestFailed:0,notStarted:0,notRequested:0});
    const g=groups.get(key);g.selected++;if(row.quoteRequested)g.requested++;
    if(row.status==='QUOTE_RETURNED')g.returned++;else g.missing++;
    if(row.status==='SOURCE_QUOTE_MISSING')g.sourceMissing++;
    if(row.status==='QUOTE_REQUEST_FAILED')g.requestFailed++;
    if(row.status==='QUOTE_REQUEST_NOT_STARTED')g.notStarted++;
    if(row.status==='QUOTE_NOT_REQUESTED')g.notRequested++;
  }
  return {version:'OPTIONS_GUIDANCE_QUOTE_COVERAGE_V1',capturedAt:normal.capturedAt,origin:normal.origin,selected:rows.length,requested:rows.filter(r=>r.quoteRequested).length,
    returned:normal.quotes.length,missing:rows.length-normal.quotes.length,
    groups:[...groups.values()].sort((a,b)=>(a.symbol??'').localeCompare(b.symbol??'')||(a.expiry??'').localeCompare(b.expiry??'')),rows,
    limitation:'Quote returned means an identified reply, not freshness or execution quality. Source quote missing includes omitted or null quotes; the upstream cause is unknown. This view does not retry, replace contracts or alter the partial-capture gate.',
    sourceReads:0,executionAllowed:false};
}
export function readGuidanceResearchFrames(root,{includeEquityReceipt=false}={}) {
  const base=BASE+'/captures',days=children(root,base).filter(v=>/^\d{4}-\d\d-\d\d$/.test(v.name));
  if(days.some(v=>!v.isDirectory()||v.isSymbolicLink()))fail('UNSAFE_DIRECTORY');
  const entries=[];
  for(const day of days.sort((a,b)=>a.name.localeCompare(b.name))){
    const items=children(root,base+'/'+day.name);if(items.length>200)fail('DAILY_LIMIT');
    entries.push(...items.filter(v=>v.name.endsWith('.json')).map(v=>base+'/'+day.name+'/'+v.name));
    if(entries.length>1000)fail('RESEARCH_CAPTURE_LIMIT');
  }
  return entries.map(path=>{const r=verified(root,path,"captures"),v=normalizeGuidanceCapture(r.input);
    if(paperFingerprint(v)!==r.reportFingerprint)fail("CAPTURE_RECOMPUTE");
    return {path,recordedAt:r.recordedAt,capturedAt:v.capturedAt,origin:v.origin,quotes:v.quotes,equities:v.equities,
      ...(includeEquityReceipt?{equityReceivedAt:r.input.receipts.find(receipt=>receipt.tool==='get_equity_quotes')?.receivedAt??null}:{})};});
}
export function readGuidanceReactionNotes(root) {
  return paths(root,'analysis',240).map(path=>{const r=verified(root,path,'analysis');return {path,recordedAt:r.recordedAt,...analystNote(r.input)};});
}
export function saveGuidanceSettings(root,value){const next=validateGuidanceSettings(value);if(guidanceSettings(root).tradeBudget?.version==="OWNER_ALLOCATION_ONLY_V2"&&next.tradeBudget?.version!=="OWNER_ALLOCATION_ONLY_V2")throw Error("GUIDANCE_POLICY_DOWNGRADE");return save(root,"settings",next).path;}
export function guidanceSettings(root){const latest=paths(root,"settings",1)[0];return latest?validateGuidanceSettings(verified(root,latest,"settings").input):defaultGuidanceSettings();}
export function guidanceView(root,state) {
  root=realpathSync(root);
  const records=paths(root,"captures",60).map(path=>{const r=verified(root,path,"captures"),normal=normalizeGuidanceCapture(r.input);if(paperFingerprint(normal)!==r.reportFingerprint)fail("CAPTURE_RECOMPUTE");
    const missing=new Set(r.input.selectedIds.filter(id=>!normal.quotes.some(q=>q.id===id)));
    const missingQuotes=r.input.receipts.filter(x=>x.tool==='get_option_instruments').flatMap(x=>x.response.data.instruments).filter(i=>missing.has(i.id)).map(i=>({id:i.id,symbol:i.chain_symbol,expiry:i.expiration_date,type:i.type,strike:i.strike_price,multiplier:Number(i.trade_value_multiplier),bidCents:null,askCents:null,tickCents:null,bidSize:null,askSize:null,delta:null,updatedAt:null,receivedAt:normal.capturedAt}));
    return {path,...normal,missingQuotes};});
  if(records.some(r=>r.capturedAt>state.loadedAt))fail("FUTURE_CAPTURE");
  records.sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt));const latest=records[0];
  const news=state.headlines?.data,calendar=state.calendar?.data;
  const sources=(news?.sources??[]).map(s=>({id:s.id,status:s.health?.status??"UNKNOWN",receivedAt:s.health?.observedAt??null}));
  const input={version:"OPTIONS_DAILY_GUIDANCE_INPUT_V2",at:state.loadedAt,captureAt:latest?.capturedAt??null,captureOrigin:latest?.origin??null,captureComplete:latest?.complete??false,quotes:[...(latest?.quotes??[]),...(latest?.missingQuotes??[])],equities:latest?.equities??[],
    closeHistory:records.flatMap(r=>r.equities.filter(e=>e.close).map(e=>({symbol:e.symbol,...e.close}))),
    events:(calendar?.groups??[]).flatMap(g=>[...g.dateOnlyEntries,...g.scheduledTimeEntries]).slice(0,100).map(e=>({title:e.title,source:e.source,startDate:e.startDate,endDate:e.endDate,scheduledAt:e.scheduledAt??null})),
    calendarAvailable:["bls","fomc"].every(k=>calendar?.sources?.[k]?.state==="AVAILABLE"&&!calendar.sources[k].refreshOverdue),
    headlinesAvailable:sources.length===6&&sources.every(s=>s.status==="OK"&&s.receivedAt<=state.loadedAt&&Date.parse(state.loadedAt)-Date.parse(s.receivedAt)<=90*60000),
    sourceHealth:sources,headlines:(news?.headlines??[]).filter(h=>h.origin==="PUBLIC_FEED").sort((a,b)=>(b.publishedAt??"").localeCompare(a.publishedAt??"")).slice(0,20).map(h=>({title:h.headline,url:h.link,publishedAt:h.publishedAt,receivedAt:h.observedAt})),
    context:{treasury:state.treasury?.data?{sourceDate:state.treasury.data.currentRow?.sourceDate??null,ratesBps:state.treasury.data.currentRow?.ratesBps??null,receivedAt:state.treasury.data.latestRetrieval?.receivedAt??null,status:state.treasury.data.latestRetrieval?.status??null}:null,btc:state.btc?.data?{midpointUsd:state.btc.data.latestRetrieval?.midpointUsd??null,sourceAt:state.btc.data.latestRetrieval?.book?.sourceTime??null,fresh:state.btc.data.displayFresh}:null},
    settings:guidanceSettings(root),analyst:latestAnalystNote(root)};
  const current=assessDailyGuidance(input);
  const history=paths(root,"reports",24).map(path=>{const r=verified(root,path,"reports");return {path,issuedAt:r.recordedAt,assessedAt:r.input.at,assets:r.report.assets.map(a=>({symbol:a.symbol,disposition:a.disposition,trend:a.trend.direction})),inputFingerprint:r.inputFingerprint};});
  return {input,current,rationale:explainDailyGuidance(input),history,sourcePaths:records.map(r=>r.path),interpretation:latestAnalystNote(root)};
}
export function explainIssuedGuidance(root,path) {
  if(path.split('/')[3]!=="reports")fail("REPORT_PATH");
  const record=verified(root,path,"reports");
  return {version:"OPTIONS_ISSUED_GUIDANCE_EXPLANATION_V1",derivedAt:new Date().toISOString(),sourcePath:path,
    originallyIssuedAt:record.recordedAt,inputFingerprint:record.inputFingerprint,
    authority:"LATER_EXPLANATION_OF_FROZEN_INPUTS_NOT_ORIGINAL_ISSUED_TEXT",
    rationale:explainDailyGuidance(record.input),executionAllowed:false};
}
export function latestIssuedGuidancePath(root){return paths(root,'reports',1)[0]??null;}
export function guidanceDeliveryView(root,view){
  if(!view?.input)fail('DELIVERY_GUIDANCE_UNAVAILABLE');
  const since=new Date(Date.parse(view.input.at)-7*86400000).toISOString().slice(0,10);
  const capturePaths=[...new Set([...(view.sourcePaths?.length?[view.sourcePaths[0]]:[]),...paths(root,'captures',1001,since)])],claimPaths=paths(root,'slots',1001,since);
  if(capturePaths.length>1000||claimPaths.length>1000)fail('DELIVERY_CATALOG_LIMIT');
  let latestSource=null;
  const captures=capturePaths.map(path=>{const r=verified(root,path,'captures'),normal=normalizeGuidanceCapture(r.input);if(paperFingerprint(normal)!==r.reportFingerprint)fail('CAPTURE_RECOMPUTE');
    if(!latestSource&&normal.capturedAt===view.input.captureAt&&normal.origin===view.input.captureOrigin&&r.recordedAt<=view.input.at)latestSource={path,input:r.input,inputFingerprint:r.inputFingerprint};
    return {path,startedAt:r.input.startedAt,capturedAt:normal.capturedAt,recordedAt:r.recordedAt,origin:normal.origin,complete:normal.complete,requested:r.input.selectedIds.length,returned:normal.quotes.length};});
  const claims=claimPaths.map(path=>{const c=read(root,path);exact(c,['slot','startedAt','status']);iso(c.startedAt);if(c.status!=='ATTEMPT_STARTED_NO_COMPLETION_CLAIM'||path!==BASE+'/slots/'+c.slot.slice(0,10)+'/'+c.slot+'.json')fail('DELIVERY_CLAIM');return {...c,path};});
  const path=paths(root,'reports',1)[0],r=path?verified(root,path,'reports'):null;
  const publication=r?{path,issuedAt:r.recordedAt,assessedAt:r.input.at,marketFingerprint:guidanceMarketFingerprint(r.input)}:null;
  const delivery=assessGuidanceDelivery(view.input,captures,claims,publication);
  return {...delivery,contractCoverage:latestSource&&delivery.latestCapture?.path===latestSource.path?{...guidanceQuoteCoverage(latestSource.input),capturePath:latestSource.path,inputFingerprint:latestSource.inputFingerprint}:null};
}
export function guidanceSensitivityView(root,view) {
  if(!view?.input)fail('SENSITIVITY_GUIDANCE_UNAVAILABLE');
  const path=view.sourcePaths?.[0];
  if(!path)return {...assessGuidanceSensitivities(view.input.at,[]),capturePath:null,capturedAt:null,captureOrigin:null,inputFingerprint:null};
  if(path.split('/')[3]!=='captures')fail('SENSITIVITY_CAPTURE_PATH');
  const record=verified(root,path,'captures'),normal=normalizeGuidanceCapture(record.input);
  if(paperFingerprint(normal)!==record.reportFingerprint)fail('CAPTURE_RECOMPUTE');
  if(normal.capturedAt!==view.input.captureAt||normal.origin!==view.input.captureOrigin||record.recordedAt>view.input.at||
    normal.quotes.some(q=>paperFingerprint(q)!==paperFingerprint(view.input.quotes.find(x=>x.id===q.id)??null)))fail('SENSITIVITY_CAPTURE_MISMATCH');
  const instruments=new Map(record.input.receipts.filter(r=>r.tool==='get_option_instruments').flatMap(r=>r.response.data.instruments).map(i=>[i.id,i]));
  const quotes=new Map(normal.quotes.map(q=>[q.id,q]));
  const raw=new Map(record.input.receipts.filter(r=>r.tool==='get_option_quotes').flatMap(r=>r.response.data.results).filter(r=>r.quote).map(r=>[r.quote.instrument_id,r.quote]));
  const rows=record.input.selectedIds.map(id=>{
    const q=quotes.get(id),i=instruments.get(id),greeks=raw.get(id)??{};
    return {id,symbol:i?.chain_symbol??null,expiry:i?.expiration_date??null,strike:i?.strike_price??null,type:i?.type??null,
      multiplier:q?.multiplier??(i?Number(i.trade_value_multiplier):null),quoteReturned:!!q,sourceAt:q?.updatedAt??null,receivedAt:q?.receivedAt??null,
      greeks:Object.fromEntries(['delta','gamma','theta','vega','implied_volatility'].map(k=>[k,greeks[k]]))};
  });
  return {...assessGuidanceSensitivities(view.input.at,rows),capturePath:path,capturedAt:normal.capturedAt,captureOrigin:normal.origin,inputFingerprint:record.inputFingerprint};
}
export function publishGuidance(root,state){const view=guidanceView(root,state);return save(root,"reports",view.input,view.current).path;}
export function claimGuidanceSlot(root,slot) {
  if(!/^\d{4}-\d\d-\d\d-\d{4}$/.test(slot))fail("SLOT");
  const dir=BASE+"/slots/"+slot.slice(0,10),path=dir+"/"+slot+".json";
  io.directory(root,dir);
  if(existsSync(resolve(root,path))) {read(root,path);return {claimed:false,path};}
  io.writeExclusive(root,path,Buffer.from(JSON.stringify({slot,startedAt:new Date().toISOString(),status:"ATTEMPT_STARTED_NO_COMPLETION_CLAIM"})+"\n"));return {claimed:true,path};
}
function analystNote(value) {
  const v=object(value);exact(v,["assessedAt","assets"]);iso(v.assessedAt);
  if(v.assessedAt>new Date().toISOString())fail("FUTURE_NOTE");
  const assets=array(v.assets,2);if(assets.length!==2||new Set(assets.map(a=>a.symbol)).size!==2)fail("NOTE_SCOPE");
  for(const a of assets) {
    exact(a,["symbol","bias","summary","supporting","opposing","invalidation","eventPlan","sources"]);symbol(a.symbol);
    if(!["BULLISH","BEARISH","MIXED","INSUFFICIENT_EVIDENCE"].includes(a.bias))fail("NOTE_BIAS");
    for(const k of ["summary","invalidation","eventPlan"])text(a[k]);
    for(const k of ["supporting","opposing"])array(a[k],8).forEach(x=>text(x,1000));
    array(a.sources,12).forEach(s=>{exact(s,["url","title","publishedAt","retrievedAt"]);const u=new URL(text(s.url,2000));if(u.protocol!=="https:"||u.username||u.password)fail("NOTE_URL");text(s.title,400);iso(s.retrievedAt);if(s.publishedAt!==null)iso(s.publishedAt);if(s.retrievedAt>v.assessedAt)fail("NOTE_CLOCK");});
  }
  return v;
}
export function recordAnalystNote(root,path){return save(root,"analysis",analystNote(read(root,path))).path;}
function latestAnalystNote(root){const path=paths(root,"analysis",1)[0];if(!path)return null;const r=verified(root,path,"analysis");return {path,recordedAt:r.recordedAt,...analystNote(r.input),authority:"ATTRIBUTED_HOST_ANALYSIS_NOT_A_CALIBRATED_SIGNAL"};}
export function verifyGuidanceRecord(root,path) {
  const kind=path.split("/")[3];if(!["reports","captures","analysis","settings"].includes(kind))fail("RECORD_PATH");
  const r=verified(root,path,kind);
  if(kind==="captures"&&paperFingerprint(normalizeGuidanceCapture(r.input))!==r.reportFingerprint)fail("CAPTURE_RECOMPUTE");
  if(kind==="settings")validateGuidanceSettings(r.input);if(kind==="analysis")analystNote(r.input);
  return {status:"VERIFIED",path,inputFingerprint:r.inputFingerprint};
}
