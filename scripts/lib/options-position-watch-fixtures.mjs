import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {manualRegistration,manualFill} from '../../src/engines/options-manual-ledger/OptionsManualLedgerFixtures.ts';
import {runOptionsManualLedgerCommand} from '../options-manual-ledger.mjs';
import {collectGuidanceMarket} from './options-guidance-host.mjs';
import {normalizeGuidanceCapture,saveGuidanceSettings} from './options-guidance-io.mjs';
import {defaultGuidanceSettings} from '../../src/engines/options-daily-guidance/OptionsDailyGuidance.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';

export const watchClock=n=>new Date(Date.parse('2026-09-08T14:00:00Z')+n*1000).toISOString();
export const watchId='synthetic-position';
export const watchUuid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
export function watchCommands(){
  const registration=manualRegistration(watchId);registration.contract.expiry='2026-09-25';registration.contract.strikeUsd='400.00';
  Object.assign(registration.plan,{declaredAt:watchClock(-100),maxEntryDebitUsd:'500.00',plannedRiskUsd:'60.00',targetNetProfitUsd:'40.00',stopPremiumUsd:'0.80',entryDeadlineAt:watchClock(-20),timeExitAt:watchClock(3600)});
  return [registration,{type:'RECORD_FILL',requestId:'buy-one',tradeId:watchId,fillId:'buy-one',fill:manualFill(1,{executedAt:watchClock(-50),quantity:3,pricePerShareUsd:'1.00',feesUsd:'0.03'})},
    {type:'RECORD_FILL',requestId:'sell-one',tradeId:watchId,fillId:'sell-one',fill:manualFill(2,{executedAt:watchClock(-40),quantity:1,pricePerShareUsd:'1.20',feesUsd:'0.02'})}];
}
export function watchInput(commands=watchCommands()){
  return {ledgerId:'synthetic-watch',origin:'SYNTHETIC_FIXTURE',createdAt:watchClock(-100),events:commands.map((command,n)=>({sequence:n+1,recordedAt:watchClock(n===0?-100:n===1?-45:-30+n-2),savedAt:watchClock(n===0?-100:n===1?-45:-30+n-2),command}))};
}
export const watchQuote=(n=0)=>({id:watchUuid(10),symbol:'GLD',expiry:'2026-09-25',type:'call',strike:'400.0000',multiplier:100,bidCents:150,askCents:151,bidSize:10,askSize:10,tickCents:1,delta:0.5,updatedAt:watchClock(n),receivedAt:watchClock(n),underlyingPriceCents:40000,underlyingAt:watchClock(n),aboveTickCents:5,belowTickCents:1,cutoffCents:300,chainSession:{chainId:watchUuid(1),lateCloseState:'enabled',receivedAt:watchClock(n)}});
export const watchFrame=(n=0)=>({path:`data/runtime/options-daily-guidance/captures/2026-09-08/watch-${n}.json`,sha256:'a'.repeat(64),recordedAt:watchClock(n),capturedAt:watchClock(n),origin:'SYNTHETIC_FIXTURE',quotes:[watchQuote(n)]});
export async function seedPositionWatch(root){
  if(!basename(resolve(root)).startsWith('alpha-position-watch-'))throw Error('SYNTHETIC_WORKSPACE_REQUIRED');
  const input=watchInput(),base=resolve(root,'data/runtime/options-manual-ledger',input.ledgerId);mkdirSync(base,{recursive:true});
  writeFileSync(resolve(base,'manifest.json'),JSON.stringify({version:'OPTIONS_MANUAL_LEDGER_STORE_V1',ledgerId:input.ledgerId,origin:input.origin,createdAt:input.createdAt,executionAllowed:false},null,2)+'\n');
  for(const e of input.events){const file=`command-${e.sequence}.json`;writeFileSync(resolve(root,file),JSON.stringify(e.command));runOptionsManualLedgerCommand(['--append',input.ledgerId,file],{workspaceRoot:root,now:()=>e.recordedAt});}
  saveGuidanceSettings(root,{...defaultGuidanceSettings(),tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2',minCents:10000,maxCents:50000}});
  let seq=10;const instruments=new Map();
  const raw=await collectGuidanceMarket({clock:async()=>watchClock(0),call:async(tool,request)=>{
    if(tool==='get_equity_quotes')return {data:{results:['GLD','IBIT'].map(symbol=>({quote:{symbol,last_trade_price:'400.00',venue_last_trade_time:watchClock(0),last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null}}))}};
    if(tool==='get_option_chains')return {data:{chains:[{id:watchUuid(request.underlying_symbol==='GLD'?1:2),symbol:request.underlying_symbol,late_close_state:'enabled',expiration_dates:['2026-09-25']}]}};
    if(tool==='get_option_instruments'){const symbol=request.chain_id===watchUuid(1)?'GLD':'IBIT',list=['call','put'].map(type=>({id:watchUuid(seq++),chain_id:request.chain_id,chain_symbol:symbol,expiration_date:'2026-09-25',type,strike_price:'400',state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}}));list.forEach(i=>instruments.set(i.id,i));return {data:{instruments:list,next:null}};}
    if(tool==='get_option_quotes')return {data:{results:request.instrument_ids.map(id=>({quote:{instrument_id:id,bid_price:'1.50',ask_price:'1.51',bid_size:10,ask_size:10,delta:instruments.get(id).type==='call'?'0.5':'-0.5',updated_at:watchClock(0)}}))}};
    throw Error('UNEXPECTED_FIXTURE_TOOL');
  }});raw.origin='SYNTHETIC_FIXTURE';const report=normalizeGuidanceCapture(raw),path=resolve(root,watchFrame().path);mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,JSON.stringify({version:'OPTIONS_GUIDANCE_RECORD_V1',kind:'captures',recordedAt:watchClock(0),input:raw,report,inputFingerprint:paperFingerprint(raw),reportFingerprint:paperFingerprint(report)},null,2)+'\n');
  return input;
}
