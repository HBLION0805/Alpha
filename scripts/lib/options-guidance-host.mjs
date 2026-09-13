import {guidanceFixedMinutes} from '../../src/engines/options-daily-guidance/OptionsGuidanceSchedule.ts';

/** Runs only in the authorized Host with injected market tools; no credentials here. */
export async function collectGuidanceMarket({call,clock,trackedContracts=[]}) {
  if(!Array.isArray(trackedContracts)||trackedContracts.length>6||new Set(trackedContracts.map(c=>c.id)).size!==trackedContracts.length||trackedContracts.some(c=>!c||!['GLD','IBIT'].includes(c.symbol)||!['call','put'].includes(c.type)||!/^\d{4}-\d\d-\d\d$/.test(c.expiry)||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(c.id)||c.multiplier!==100||!Number.isFinite(Number(c.strike))||Number(c.strike)<=0))throw Error('GUIDANCE_TRACKED_CONTRACTS');
  const iso=value=>{const s=value.replace(" UTC","Z").replace(" ","T");if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(s)||!Number.isFinite(Date.parse(s)))throw Error("GUIDANCE_HOST_CLOCK");return new Date(s).toISOString();};
  const startedAt=iso(await clock()),receipts=[],failures=[];let calls=0;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(startedAt));
  async function read(tool,request) {
    const requestedAt=iso(await clock());
    if(calls>=24||Date.parse(requestedAt)-Date.parse(startedAt)>180000){failures.push({tool,request,requestedAt,code:"COLLECTION_BOUND_REACHED"});return null;}
    calls++;
    try {const response=await call(tool,request),receivedAt=iso(await clock());if(Date.parse(receivedAt)<Date.parse(requestedAt)||!response?.data)throw Error("SOURCE_SHAPE");
      receipts.push({tool,request,requestedAt,receivedAt,response});return response.data;
    }catch{failures.push({tool,request,requestedAt,code:"MARKET_SOURCE_FAILED"});return null;}
  }
  const equity=await read("get_equity_quotes",{symbols:["GLD","IBIT"]}),selected=[];
  for(const symbol of ["GLD","IBIT"]) {
    const q=equity?.results?.find(r=>r.quote?.symbol===symbol)?.quote;
    const prices=q?[[q.last_trade_price,q.venue_last_trade_time],[q.last_non_reg_trade_price,q.venue_last_non_reg_trade_time]].filter(([p,t])=>Number(p)>0&&Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(b[1])-Date.parse(a[1])):[];
    const spot=Number(prices[0]?.[0]);
    const data=await read("get_option_chains",{underlying_symbol:symbol});
    if(!data||!Number.isFinite(spot)||spot<=0){failures.push({tool:"SELECTION",symbol,code:"UNDERLYING_OR_CHAIN_MISSING"});continue;}
    const chains=(data.chains??[]).filter(c=>c.symbol===symbol);
    if(chains.length!==1){failures.push({tool:"SELECTION",symbol,code:"CHAIN_SCOPE_REQUIRES_REVIEW"});continue;}
    const chain=chains[0],dates=(chain.expiration_dates??[]).filter(d=>{const n=(Date.parse(d)-Date.parse(today))/86400000;return n>=14&&n<=45;}).sort();
    const expirations=[];
    for(const target of [14,28,42]) {const d=[...dates].sort((a,b)=>Math.abs((Date.parse(a)-Date.parse(today))/86400000-target)-Math.abs((Date.parse(b)-Date.parse(today))/86400000-target)||a.localeCompare(b))[0];if(d&&!expirations.includes(d))expirations.push(d);}
    const tracked=trackedContracts.filter(c=>c.symbol===symbol);
    for(const c of tracked)if(chain.expiration_dates.includes(c.expiry)&&c.expiry>=today&&!expirations.includes(c.expiry))expirations.push(c.expiry);
    expirations.sort();
    if(!expirations.length){failures.push({tool:"SELECTION",symbol,code:"NO_EXPIRATIONS_IN_RANGE"});continue;}
    let cursor=null,complete=false;const all=[],seenCursors=new Set();
    for(let page=0;page<8;page++) {
      const request={chain_id:chain.id,expiration_dates:expirations.join(","),state:"active",...(cursor?{cursor}:{})};
      const d=await read("get_option_instruments",request);if(!d)break;
      if(!Array.isArray(d.instruments)||d.instruments.length>100){failures.push({tool:"SELECTION",symbol,code:"INSTRUMENT_SHAPE"});break;}
      all.push(...d.instruments);
      if(!d.next){complete=true;break;}
      try {const match=String(d.next).match(/[?&]cursor=([^&]+)/);cursor=match?decodeURIComponent(match[1]):null;if(!cursor||seenCursors.has(cursor))throw Error("CURSOR");seenCursors.add(cursor);}
      catch{failures.push({tool:"SELECTION",symbol,code:"CURSOR_INVALID"});break;}
    }
    if(!complete)failures.push({tool:"SELECTION",symbol,code:"INSTRUMENT_LIST_PARTIAL"});
    const symbolSelected=[];
    for(const c of tracked){const i=all.find(i=>i.id===c.id&&i.chain_id===chain.id&&i.chain_symbol===c.symbol&&i.expiration_date===c.expiry&&i.type===c.type&&i.strike_price===c.strike&&i.state==='active'&&i.tradability==='tradable'&&i.underlying_type==='equity'&&Number(i.trade_value_multiplier)===100);if(i)symbolSelected.push(i.id);else failures.push({tool:'SELECTION',symbol,code:'TRACKED_CONTRACT_UNAVAILABLE'});}
    for(const expiry of expirations)for(const type of ["call","put"]) {
      const contracts=all.filter(i=>i.chain_id===chain.id&&i.chain_symbol===symbol&&i.expiration_date===expiry&&i.type===type&&i.state==="active"&&i.tradability==="tradable"&&i.underlying_type==="equity"&&Number(i.trade_value_multiplier)===100&&Number(i.strike_price)>0)
        .sort((a,b)=>Math.abs(Number(a.strike_price)-spot)-Math.abs(Number(b.strike_price)-spot)||Number(a.strike_price)-Number(b.strike_price)||String(a.id).localeCompare(String(b.id))).slice(0,3);
      symbolSelected.push(...contracts.map(i=>i.id));
    }
    selected.push(...[...new Set(symbolSelected)].slice(0,18));
  }
  const ids=[...new Set(selected)].slice(0,36);
  for(let n=0;n<ids.length;n+=20){
    const requested=ids.slice(n,n+20),data=await read("get_option_quotes",{instrument_ids:requested});
    if(data&&Array.isArray(data.results)){
      const returned=new Set(data.results.map(r=>r?.quote?.instrument_id)),missingIds=requested.filter(id=>!returned.has(id));
      if(missingIds.length)failures.push({tool:'get_option_quotes',code:'OPTION_QUOTE_IDENTITIES_MISSING',missingIds});
    }
  }
  return {version:"OPTIONS_GUIDANCE_MARKET_CAPTURE_V1",origin:"HOST_MARKET_TOOL_RESPONSES",startedAt,capturedAt:iso(await clock()),calls,receipts,failures,selectedIds:ids,selection:trackedContracts.length?'Verified tracked research IDs first, then nearest strikes; at most 18 contracts per ETF and 36 total.':'Nearest three strikes per side at up to three 14–45-day expirations; bounded research sample.',accountAccessed:false,executionAllowed:false};
}
export function routeDailyGuidance(at,{ongoing=false}={}) {
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(at)).map(v=>[v.type,v.value]));
  const date=p.year+"-"+p.month+"-"+p.day,hour=Number(p.hour),minute=Number(p.minute),weekday=!["Sat","Sun"].includes(p.weekday);
  const closes=["2026-09-08","2026-09-09","2026-09-10","2026-09-11","2026-09-14","2026-09-15","2026-09-16"];
  const close=!ongoing&&closes.includes(date)&&hour*60+minute>=980&&hour*60+minute<1080;
  const daily=hour===9&&minute<20,news=minute>=20&&minute<50;
  const market=weekday&&guidanceFixedMinutes(date).includes(hour*60+50)&&minute>=50;
  return {version:"OPTIONS_GUIDANCE_ROUTE_V1",at,date,hour,slot:date+"-"+String(hour).padStart(2,"0")+(daily?"00":minute>=50?"50":"20"),dailyContext:daily,refreshNews:news||daily,marketCapture:market,closeCapture:close,publish:news||daily||market,restoreAfterClose:close&&date==="2026-09-16",pastCloseWindow:!ongoing&&(date>"2026-09-16"||date==="2026-09-16"&&hour*60+minute>=1080),developmentEnabled:false,executionAllowed:false};
}
