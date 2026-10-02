import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {defaultGuidanceSettings} from '../src/engines/options-daily-guidance/OptionsDailyGuidance.ts';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {normalizeGuidanceCapture,saveGuidanceSettings,guidanceSettings} from './lib/options-guidance-io.mjs';
import {snapshotSources,mapSnapshotSource,snapshotPaperRegistrations} from './lib/options-snapshot-paper-io.mjs';
import {paperObservationView} from './lib/options-paper-observation-io.mjs';
import {buildEngineeringPaperPreview,armEngineeringPaperFromPreview} from './lib/options-real-data-paper-bridge.mjs';
import {engineeringPaperHostSource} from './options-real-data-paper-host.mjs';

const root=mkdtempSync(resolve(tmpdir(),'alpha-real-paper-arm-'));
const id='00000000-0000-0000-0000-000000000010',chain='00000000-0000-0000-0000-000000000099';
const captured='2026-10-08T13:59:41.000Z',recorded='2026-10-08T13:59:42.000Z',at='2026-10-08T14:00:00.000Z';
const instrument={id,chain_id:chain,chain_symbol:'IBIT',expiration_date:'2026-10-30',type:'put',strike_price:'50.000000',state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}};
const raw={version:'OPTIONS_GUIDANCE_MARKET_CAPTURE_V1',origin:'HOST_MARKET_TOOL_RESPONSES',startedAt:'2026-10-08T13:59:39.000Z',capturedAt:captured,calls:4,receipts:[
 {tool:'get_option_chains',request:{underlying_symbol:'IBIT'},requestedAt:'2026-10-08T13:59:39.000Z',receivedAt:'2026-10-08T13:59:39.100Z',response:{data:{chains:[{id:chain,symbol:'IBIT',late_close_state:'enabled',expiration_dates:['2026-10-30']}]}}},
 {tool:'get_option_instruments',request:{chain_id:chain,expiration_dates:'2026-10-30',state:'active'},requestedAt:'2026-10-08T13:59:39.200Z',receivedAt:'2026-10-08T13:59:39.300Z',response:{data:{instruments:[instrument],next:null}}},
 {tool:'get_equity_quotes',request:{symbols:['GLD','IBIT']},requestedAt:'2026-10-08T13:59:39.400Z',receivedAt:'2026-10-08T13:59:39.500Z',response:{data:{results:[
  {quote:{symbol:'GLD',last_trade_price:'400.000000',venue_last_trade_time:'2026-10-08T13:59:39.300000000Z',last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null}},
  {quote:{symbol:'IBIT',last_trade_price:'50.500000',venue_last_trade_time:'2026-10-08T13:59:39.350000000Z',last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null}}
 ]}}},
 {tool:'get_option_quotes',request:{instrument_ids:[id]},requestedAt:'2026-10-08T13:59:40.000Z',receivedAt:captured,response:{data:{results:[{quote:{instrument_id:id,bid_price:'1.16',ask_price:'1.18',bid_size:30,ask_size:40,delta:'-0.45',updated_at:'2026-10-08T13:59:40.000000000Z'}}]}}}
],failures:[],selectedIds:[id],selection:'engineering fixture',accountAccessed:false,executionAllowed:false};
try{
 const settings={...defaultGuidanceSettings(),tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2',minCents:10000,maxCents:50000}};
 saveGuidanceSettings(root,settings);
 const report=normalizeGuidanceCapture(raw),rel='data/runtime/options-daily-guidance/captures/2026-10-08/capture.json';
 const record={version:'OPTIONS_GUIDANCE_RECORD_V1',kind:'captures',recordedAt:recorded,input:raw,report,inputFingerprint:paperFingerprint(raw),reportFingerprint:paperFingerprint(report)};
 mkdirSync(dirname(resolve(root,rel)),{recursive:true});writeFileSync(resolve(root,rel),JSON.stringify(record,null,2)+'\n');
 const frame=mapSnapshotSource(snapshotSources(root)[0],'V3');
 const decision={identity:'b'.repeat(64),executionAllowed:false,issuedAt:'2026-10-08T13:59:50.000Z',provenance:{capture:{path:rel,capturedAt:captured}},candidates:[
  {symbol:'GLD',trendObservation:{direction:'DOWN'},referenceContracts:[]},
  {symbol:'IBIT',trendObservation:{direction:'DOWN'},referenceContracts:[{chosenTrade:false,contract:{id,symbol:'IBIT',expiry:'2026-10-30',type:'put',strike:'50.000000',multiplier:100,bidCents:116,askCents:118,tickCents:1,bidSize:30,askSize:40,delta:-0.45,updatedAt:'2026-10-08T13:59:40.000000000Z',receivedAt:captured}}]}
 ]};
 const preview=buildEngineeringPaperPreview({decisionEvidence:decision,frames:[frame],settings:guidanceSettings(root),at});
 assert.equal(preview.status,'READY_TO_ARM');
 const armed=armEngineeringPaperFromPreview(root,preview);assert.equal(armed.status,'PAPER_ARMED');assert.equal(armed.strategyValidationEligible,false);assert.equal(armed.liveOrderAuthority,false);
 assert.equal(snapshotPaperRegistrations(root).length,1);
 const obs=paperObservationView(root,null,'2026-10-08T14:00:05.000Z');assert.equal(obs.rows.length,1);assert.equal(obs.rows[0].state,'AWAITING_WINDOW');assert.equal(obs.rows[0].purpose,'PIPELINE_REHEARSAL_NOT_SIGNAL');
 const host=engineeringPaperHostSource(root,'2026-10-08T14:00:05.000Z');assert.equal(host.status,'READY');assert.equal(host.contract.id,id);assert.deepEqual(host.allowedTools,['get_option_chains','get_option_instruments','get_equity_quotes','get_option_quotes']);
 const repeat=armEngineeringPaperFromPreview(root,preview);assert.equal(repeat.alreadyRecorded,true);assert.equal(snapshotPaperRegistrations(root).length,1);
}finally{rmSync(realpathSync(root),{recursive:true,force:true});}
console.log('Real-data paper arm integration tests passed');
