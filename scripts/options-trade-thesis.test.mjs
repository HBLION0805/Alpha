import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute} from 'node:path';
import {assessTradeThesis,thesisPlanIssues,validatePositionReview} from '../src/engines/options-manual-ledger/OptionsTradeThesis.ts';
import {assessPositionWatch} from '../src/engines/options-manual-ledger/OptionsPositionWatch.ts';
import {reconcileManualLedger,validateManualLedgerCommand} from '../src/engines/options-manual-ledger/OptionsManualLedger.ts';
import {watchClock as at,watchCommands,watchFrame,watchInput,watchId,seedPositionWatch} from './lib/options-position-watch-fixtures.mjs';
import {conditionDefaults,thesisDefaults,eventEntryDefaults,thesisPlannerPanel,thesisWatchDetails,thesisPlanCommand,updateThesisDraft,thesisReviewRequest} from '../apps/options-workbench/trade-thesis.js';
import {registerDefaults} from '../apps/options-workbench/forms.js';
import {tradeDetail} from '../apps/options-workbench/views.js';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {readManualLedger} from './options-manual-ledger.mjs';

let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
export const priceCondition=()=>({...conditionDefaults('PRICE','price'),basis:'Synthetic ETF structure',checkAt:at(-30),missingAction:'Inspect matching ETF source manually',target:'ETF',comparator:'AT_OR_BELOW',threshold:'390',confirmation:'TOUCH'});
export const eventCondition=()=>({...conditionDefaults('EVENT_NUMERIC','event'),basis:'Synthetic pre-release expectation',checkAt:at(0),missingAction:'Verify original release',eventKey:'test-cpi',metric:'CPI_MOM_SA',period:'2026-08',unit:'PERCENT',releaseVersion:'INITIAL',releaseAt:at(0),expectationRef:'synthetic-expectation-v1',expectationValue:'0.2',source:'https://www.bls.gov/test',comparator:'AT_OR_ABOVE',threshold:'0.4'});
export const thesis=conditions=>({...thesisDefaults(),tradeDate:'2026-09-08',realizationStartAt:at(-20),realizationEndAt:at(3000),nextCheckAt:at(0),holdThroughEvent:'YES',manualFallback:'Inspect original sources and position manually; do not assume safe hold',conditions:conditions??[priceCondition()]});
export function setup(conditions,clock=at(0),frame=watchFrame()){
  const commands=watchCommands();commands[0].plan.targetNetProfitUsd='1000';commands[0].plan.invalidation=thesis(conditions);
  const ledger=reconcileManualLedger(watchInput(commands),clock),trade=ledger.trades[0],watch=assessPositionWatch(ledger,frame,clock,{[watchId]:'0'}).rows[0];
  const context={plan:trade.plan,contract:trade.contract,registeredAt:trade.registeredAt,openedAt:trade.openedAt};
  const market={price:{symbol:'GLD',price:'400',sourceAt:at(0),receivedAt:at(0),recordedAt:at(0),path:'synthetic-capture',fingerprint:'synthetic',origin:'SYNTHETIC_FIXTURE'},bars:null,gaps:[]};
  return {context,watch:{...watch,origin:ledger.origin},market,commands};
}
const evalSetup=(s,clock=at(0),evidence=[],prior=[])=>assessTradeThesis(s.context,s.watch,clock,evidence,s.market,prior);
const eventEvidence=patch=>({conditionId:'event',source:'https://www.bls.gov/test',sourceAt:at(0),receivedAt:at(0),savedAt:at(0),confirmation:'OWNER_CONFIRMED',eventKey:'test-cpi',metric:'CPI_MOM_SA',period:'2026-08',unit:'PERCENT',releaseVersion:'INITIAL',value:'0.5',judgment:'',explanation:'Owner checked original release',comparisonRef:'',...patch});

await test('supported conditions and all independent exits clear permit original-plan hold',()=>{const r=evalSetup(setup());assert.equal(r.thesisStatus,'SUPPORTED');assert.equal(r.action,'HOLD_UNDER_ORIGINAL_PLAN');assert.deepEqual(r.triggered,[]);});
await test('premium stop overrides supported ETF thesis, independent of net target',()=>{const f=watchFrame();f.quotes[0].bidCents=80;f.quotes[0].askCents=81;const r=evalSetup(setup(undefined,at(0),f));assert.equal(r.thesisStatus,'SUPPORTED');assert.equal(r.action,'EXIT_CONDITION_TRIGGERED');assert(r.triggered.includes('STOP_REFERENCE_REACHED'));});
await test('reliable time exit is visible when quote and ETF observations are missing',()=>{const s=setup(undefined,at(3600),null);s.market.price=null;const r=evalSetup(s,at(3600));assert.equal(r.action,'EXIT_CONDITION_TRIGGERED');assert(r.triggered.includes('TIME_EXIT_DUE'));assert.equal(s.watch.liquidationValueAtBidUsd,null);});
await test('numeric necessary event condition fails even while profitable; provenance is Owner-confirmed',()=>{const s=setup([eventCondition()]),r=evalSetup(s,at(0),[eventEvidence()]);assert.equal(r.thesisStatus,'INVALIDATED');assert(r.triggered.includes('THESIS_INVALIDATED:event'));assert(Number(s.watch.estimatedFullTradeNetPnlUsd)>0);assert(r.checks[0].provenance.includes('OWNER_CONFIRMED'));});
await test('optional absent types do not block a complete price-only plan',()=>{const s=setup();assert.deepEqual(thesisPlanIssues(s.context,at(-100)),[]);assert.equal(evalSetup(s).checks.length,1);});
await test('missing enabled threshold or confirmation is draft-only',()=>{for(const patch of [{threshold:''},{confirmation:''},{confirmation:'CLOSE',confirmationMinutes:'',confirmationCount:''}]){const c={...priceCondition(),...patch},s=setup();s.context.plan=structuredClone(s.context.plan);s.context.plan.invalidation.conditions=[c];assert(thesisPlanIssues(s.context,at(-100)).length);const registration={...s.commands[0],plan:s.context.plan};assert.throws(()=>validateManualLedgerCommand(registration,at(-100)),/THESIS_PLAN_INCOMPLETE/);}});
await test('future check is Pending; due missing evidence is Unknown, never invalidated',()=>{const s=setup([{...priceCondition(),checkAt:at(1)}]);s.market.price=null;assert.equal(evalSetup(s).checks[0].status,'PENDING');assert.equal(evalSetup(s,at(2)).checks[0].status,'UNKNOWN');});
await test('touch threshold and completed consecutive closes are separate, with no intrabar substitution',()=>{
  const s=setup();s.market.price.price='380';assert.equal(evalSetup(s).thesisStatus,'INVALIDATED');
  const c={...priceCondition(),confirmation:'CLOSE',confirmationMinutes:'5',confirmationCount:'1',checkAt:at(0)};
  const x=setup([c]);x.market.price.price='380';assert.equal(evalSetup(x,at(1)).checks[0].status,'PENDING');
  x.market.bars={value:{version:'OPTIONS_ETF_BARS_V1',symbol:'GLD',intervalMinutes:5,currency:'USD',session:'REGULAR',adjustment:'RAW',volumeUnit:'SHARES',source:'Isolated fixture',receivedAt:at(300),windowStart:at(0),windowEnd:at(300),bars:[{start:at(0),end:at(300),open:'400',high:'405',low:'380',close:'400',volume:100,complete:true,interpolated:false}]},qualified:true,conflicted:false,recordedAt:at(300),path:'synthetic-bars',fingerprint:'fixture',origin:'SYNTHETIC_FIXTURE'};
  assert.equal(evalSetup(x,at(300)).checks[0].status,'SUPPORTED');x.market.bars.value.bars[0].close='389';assert.equal(evalSetup(x,at(300)).checks[0].status,'INVALIDATED');
  for(const patch of [{qualified:false},{conflicted:true},{recordedAt:at(301)}])assert.equal(evalSetup({...x,market:{...x.market,bars:{...x.market.bars,...patch}}},at(300)).checks[0].status,'UNKNOWN');
  x.market.bars.value.bars[0].interpolated=null;assert.equal(evalSetup(x,at(300)).checks[0].status,'UNKNOWN');
});
await test('stale/future/wrong-identity ETF cannot create price conclusions or fall back',()=>{for(const patch of [{symbol:'BTC'},{sourceAt:at(-61)},{sourceAt:at(1)},{receivedAt:at(1)},{recordedAt:at(1)},{price:null},{origin:'HOST_MARKET_TOOL_RESPONSES'}]){const s=setup();Object.assign(s.market.price,patch);assert.equal(evalSetup(s).checks[0].status,'UNKNOWN');}});
await test('wrong option contract prevents option-price invalidation but not time exit',()=>{const f=watchFrame();f.quotes[0].strike='401';const s=setup([{...priceCondition(),target:'OPTION_BID',threshold:'2'}],at(3600),f),r=evalSetup(s,at(3600));assert.equal(r.checks[0].status,'UNKNOWN');assert(r.triggered.includes('TIME_EXIT_DUE'));});
await test('late evidence and revised values never enter an earlier evaluation',()=>{const s=setup([eventCondition()]);assert.equal(evalSetup(s,at(0),[eventEvidence({savedAt:at(1)})]).checks[0].status,'UNKNOWN');assert.equal(evalSetup(s,at(0),[eventEvidence({releaseVersion:'REVISED'})]).checks[0].status,'UNKNOWN');assert.equal(evalSetup(s,at(0),[eventEvidence({unit:'BPS'})]).checks[0].status,'UNKNOWN');});
await test('manual prose requires sourced explicit confirmation, never machine interpretation',()=>{const c={...conditionDefaults('OWNER_CONFIRMED','owner'),basis:'Policy premise',invalidation:'Official policy rescinded',source:'Official announcement',checkAt:at(0),missingAction:'Owner verify original notice'},s=setup([c]);assert.equal(evalSetup(s).thesisStatus,'UNKNOWN');const e=eventEvidence({conditionId:'owner',value:'',judgment:'WARNING'});assert.equal(evalSetup(s,at(0),[e]).thesisStatus,'WARNING');e.judgment='INVALIDATED';assert.equal(evalSetup(s,at(0),[e]).action,'EXIT_CONDITION_TRIGGERED');});
await test('saved triggers survive rebound and missing evidence without fabricating a current price',()=>{const s=setup();s.market.price=null;const r=evalSetup(s,at(0),[],['THESIS_INVALIDATED:price']);assert.equal(r.action,'EXIT_CONDITION_TRIGGERED');assert.equal(r.checks[0].status,'UNKNOWN');});
await test('entry mode metadata never changes original stop target time or factual exit calculations',()=>{
  const stop=setup();stop.watch.attentionReasons=['STOP_REFERENCE_REACHED'];
  const target=setup();target.watch.attentionReasons=['TARGET_REFERENCE_REACHED'];
  const time=setup(undefined,at(3600),null);time.market.price=null;
  const fact=setup([eventCondition()]);
  for(const [s,clock,evidence] of [[stop,at(0),[]],[target,at(0),[]],[time,at(3600),[]],[fact,at(0),[eventEvidence()]]]){
    const original=evalSetup(s,clock,evidence);delete original.planFingerprint;
    for(const phase of ['PRE_EVENT','POST_EVENT']){const changed=structuredClone(s);changed.context.plan.invalidation.eventEntry={...eventEntryDefaults(),phase};const result=evalSetup(changed,clock,evidence);delete result.planFingerprint;assert.deepEqual(result,original);assert.equal(result.action,'EXIT_CONDITION_TRIGGERED');}
  }
});
await test('retrospective plan cannot claim pre-entry invalidation validation',()=>{const s=setup();s.context.registeredAt=at(-40);s.market.price.price='380';const r=evalSetup(s);assert.equal(r.thesisStatus,'UNKNOWN');assert(!r.triggered.includes('THESIS_INVALIDATED:price'));});
await test('review preserves copied calculation and rejects tampering',()=>{const s=setup(),result=evalSetup(s),r={version:'OPTIONS_POSITION_REVIEW_V1',context:s.context,watch:s.watch,assessedAt:at(0),evidence:[],market:s.market,priorTriggers:[],result,note:'Synthetic',reportedAction:'NO_ACTION_REPORTED',correctionOf:'',submissionFingerprint:paperFingerprint({})};validatePositionReview(r,at(1));r.result.action='EXIT_CONDITION_TRIGGERED';assert.throws(()=>validatePositionReview(r,at(1)),/RECOMPUTATION/);});
await test('conflicting release confirmations cannot choose the favorable value',()=>{const s=setup([eventCondition()]);const a=eventEvidence(),b=eventEvidence({value:'0.1',savedAt:at(1)});assert.equal(evalSetup(s,at(1),[a,b]).checks[0].status,'UNKNOWN');});
await test('partial first bar is excluded from the declared close confirmation window',()=>{const s=setup([{...priceCondition(),confirmation:'CLOSE',confirmationMinutes:'5',confirmationCount:'1',checkAt:at(-30)}]);assert.equal(evalSetup(s,at(0)).checks[0].status,'PENDING');});
await test('calendar rejects holidays, early close and unreviewed years without silently moving exit',()=>{for(const clock of ['2026-11-26T19:00:00.000Z','2026-11-27T19:00:00.000Z','2027-01-05T19:00:00.000Z']){const s=setup();s.context.plan=structuredClone(s.context.plan);s.context.plan.timeExitAt=clock;assert(thesisPlanIssues(s.context,at(-100)).includes('ACTION_TIME_CLOSED_OR_UNREVIEWED'));}});
await test('draft UI reuses original fields, escapes source text and adds no threshold defaults',()=>{const ui={thesisFields:{...registerDefaults(),includePlan:true},thesisDraft:thesisDefaults()};updateThesisDraft(ui,'enable.price',true);assert.equal(ui.thesisDraft.conditions[0].threshold,'');ui.thesisDraft.manualFallback='<script>bad</script>';const h=thesisPlannerPanel({manual:{data:{trades:[]}}},ui);assert(h.includes('name="tradeId"'));assert(!h.includes('<script>'));assert(h.includes('Confirm &amp;')||h.includes('Confirm & freeze'));const c=thesisPlanCommand({...ui,thesisFields:{...ui.thesisFields,tradeId:'test-draft'}},'DRAFT','request-one');validateManualLedgerCommand(c,at(0));assert.throws(()=>thesisReviewRequest('trade',{conditionId:'event'},null,'SAVE_REVIEW','review-one'),/Confirm/);});

await test('unselected research direction survives form recovery and draft save without qualifying a contract',()=>{
  const ui={thesisFields:{...registerDefaults(),tradeId:'direction-unset',optionType:'',includePlan:true},thesisDraft:thesisDefaults()};
  const command=thesisPlanCommand(ui,'DRAFT','direction-unset-request');validateManualLedgerCommand(command,at(0));
  assert.equal(command.draft.fields.optionType,'');
  const recovered={thesisFields:command.draft.fields,thesisDraft:command.draft.thesis};
  const render=fields=>thesisPlannerPanel({manual:{data:{trades:[]}}},{...recovered,thesisFields:fields});
  assert.match(render(recovered.thesisFields),/<select name="optionType"><option value="" selected>Not selected<\/option>/);
  for(const optionType of ['CALL','PUT'])assert(render({...recovered.thesisFields,optionType}).includes(`<option value="${optionType}" selected>`));
  assert.equal(registerDefaults().optionType,'CALL');
  const registration=setup().commands[0];registration.contract.optionType='';
  assert.throws(()=>validateManualLedgerCommand(registration,at(-100)),/CONTRACT_SCOPE/);
});

await test('protected API draft → freeze → reported entry → saved review → restart; no sources or fills created by checks',async()=>{
  const root=mkdtempSync(join(tmpdir(),'alpha-position-watch-thesis-'));let app;
  try{
    await seedPositionWatch(root);
    const id='synthetic-thesis',base=join(root,'data/runtime/options-manual-ledger',id);mkdirSync(base,{recursive:true});writeFileSync(join(base,'manifest.json'),JSON.stringify({version:'OPTIONS_MANUAL_LEDGER_STORE_V1',ledgerId:id,origin:'SYNTHETIC_FIXTURE',createdAt:at(-200),executionAllowed:false},null,2)+'\n');
    let clock=at(-110);const options={workspaceRoot:root,ledgerId:id,now:()=>clock},service=createWorkbenchData(options);
    const fields={...registerDefaults(),tradeId:watchId,includePlan:true},draft={type:'SAVE_PLAN_DRAFT',tradeId:watchId,requestId:'draft-one',draft:{fields,thesis:thesisDefaults()}};
    let p=service.preview(draft);service.save({command:draft,expectedHeadSha256:p.headSha256});assert.equal(readManualLedger(root,id,()=>clock).report.trades.length,0);
    clock=at(-100);const commands=setup().commands,reg=commands[0];p=service.preview(reg);service.save({command:reg,expectedHeadSha256:p.headSha256});assert.throws(()=>service.preview({...draft,requestId:'draft-two'}),/PLAN_ALREADY_FROZEN/);
    clock=at(0);for(const c of commands.slice(1)){p=service.preview(c);service.save({command:c,expectedHeadSha256:p.headSha256});}
    app=await startOptionsWorkbench({...options,port:0});const state=await(await fetch(app.url+'/api/state')).json(),headers={'Origin':app.url,'Content-Type':'application/json','X-Alpha-Session':state.session};
    const body={action:'SAVE_REVIEW',requestId:'review-one',tradeId:watchId,exitCostUsd:'0',evidence:null,note:'Isolated acceptance',reportedAction:'NO_ACTION_REPORTED',correctionOf:''};
    const post=(body,h=headers)=>fetch(app.url+'/api/position-watch',{method:'POST',headers:h,body:JSON.stringify(body)});
    assert.equal((await post(body,{...headers,'X-Alpha-Session':''})).status,403);
    const saved=await post(body);assert.equal(saved.status,200);const r=await saved.json();assert.equal(r.review.result.action,'HOLD_UNDER_ORIGINAL_PLAN');
    assert.throws(()=>service.preview({type:'SAVE_POSITION_REVIEW',tradeId:watchId,requestId:'forged-review',review:r.review}),/POSITION_REVIEW_USE_WATCH/);
    const before=readManualLedger(root,id,()=>clock),eventCount=before.input.events.length;assert.equal((await post(body)).status,200);await service.state();await service.state();assert.equal(readManualLedger(root,id,()=>clock).input.events.length,eventCount);
    assert.equal((await post({...body,note:'Changed same request'})).status,409);
    assert.equal(before.report.trades[0].openContracts,2);assert.equal(before.report.counts.activeFills,2);
    await app.close();app=null;const recovered=await createWorkbenchData(options).state();assert.equal(recovered.positionWatch.data.rows[0].reviewHistory.length,1);assert.equal(recovered.positionWatch.data.rows[0].reviewHistory[0].result.action,'HOLD_UNDER_ORIGINAL_PLAN');
    assert.equal(paperFingerprint(recovered.manual.data.trades[0].plan),paperFingerprint(reg.plan));
    assert.equal(recovered.sourceRefresh,false);assert.equal(recovered.executionAllowed,false);
    for(const f of before.files)assert.deepEqual(readFileSync(join(root,f.path)),f.bytes);
    clock=at(3600);const exited=createWorkbenchData(options).positionWatch({...body,requestId:'review-time'});assert(exited.review.result.triggered.includes('TIME_EXIT_DUE'));
    clock=at(3601);const after=await createWorkbenchData(options).state();assert(after.positionWatch.data.rows[0].thesis.triggered.includes('TIME_EXIT_DUE'));assert.equal(after.manual.data.trades[0].openContracts,2);
    const exit=structuredClone(commands[2]);exit.requestId='reported-final-exit';exit.fillId='reported-final-exit';exit.fill.executionSequence=3;exit.fill.externalExecutionRef='synthetic-final-exit';exit.fill.quantity=2;exit.fill.executedAt=clock;
    p=service.preview(exit);service.save({command:exit,expectedHeadSha256:p.headSha256});
    const closed=await createWorkbenchData(options).state();assert.equal(closed.positionWatch.data.rows.length,0);assert.equal(closed.manual.data.trades[0].status,'CLOSED');
    const detail=tradeDetail(closed.manual.data.trades[0],closed.manual.data);assert(detail.includes('Saved evaluations (2)'));assert(detail.includes('TIME_EXIT_DUE'));assert(detail.includes('Hold under original plan'));
  }finally{if(app)await app.close();const path=realpathSync(root),rel=relative(realpathSync(tmpdir()),path);if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-position-watch-thesis-'))throw Error('UNSAFE_CLEANUP');rmSync(path,{recursive:true,force:true});}
});
console.log(`Trade thesis tests passed: ${passed}/${passed}.`);
