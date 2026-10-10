import nodeTest,{after} from 'node:test';
let total=0,passed=0;
const test=(name,fn)=>{total++;return nodeTest(name,()=>{fn();passed++;});};
after(()=>console.log('Tech Paper feasibility: '+passed+'/'+total+' tests passed.'));
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fixture} from './lib/options-three-facet-fixtures.mjs';
import {assessTechPaperFeasibility as assess} from './lib/options-tech-paper-feasibility.mjs';
import {techPaperCli} from './options-tech-paper.mjs';
const stamp=s=>'2026-10-09T'+s+'.000Z';
function research(){
  const r=JSON.parse(JSON.stringify(fixture()).replaceAll('2026-10-08','2026-10-09').replaceAll('2026-10-09T14:17','2026-10-10T14:17'));
  r.symbol='AAPL';delete r.technical;r.asOf=stamp('14:16:00');r.holdingFrom=stamp('14:17:00');
  r.researchPlan={id:'SYNTHETIC_ONLY',registeredAt:r.asOf,sourceIds:['NEWS'],hypothesis:'Synthetic forward direction',triggerCondition:'Synthetic conditional future event',invalidationCondition:'Synthetic counterevidence',exitCondition:'Synthetic later review'};
  return r;
}
function request(){
 const r=research(),decision=stamp('14:16:30'),source=stamp('14:16:40'),receipt=stamp('14:16:41');
 const contract={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',symbol:'AAPL',expiry:'2026-10-16',type:'call',strike:'340.00',multiplier:100,deliverable:'STANDARD_100_SHARES_USD',exerciseStyle:'AMERICAN',tradability:'tradable'};
 const quote={...contract,bidCents:100,askCents:102,tickCents:1,bidSize:10,askSize:10,updatedAt:source,receivedAt:receipt,underlyingPriceUsd:'333.1234',underlyingAt:stamp('14:16:39'),underlyingPriceCents:null,aboveTickCents:5,belowTickCents:1,cutoffCents:300,chainSession:{chainId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',lateCloseState:'disabled',receivedAt:stamp('14:15:01')}};
 const payloads={CONTRACT:contract,QUOTE:quote,DATA_ENTITLEMENT:{provider:'SYNTHETIC_TEST_ONLY',symbols:['AAPL'],realtimeOptions:true,localRetention:true},PRODUCT_PERMISSION:{accountId:'SYNTHETIC',enabled:true,symbols:['AAPL'],products:['LONG_CALL']},ACCOUNT_FUNDS:{accountId:'SYNTHETIC',currency:'USD',settledCashCents:20000,reservedCashCents:0},RISK_LIMITS:{accountId:'SYNTHETIC',tradeBudgetMaxCents:11000,maximumLossCents:11000}};
 const records=Object.entries(payloads).map(([kind,p])=>{const rawJson=JSON.stringify(p);return {kind,origin:'SYNTHETIC_FIXTURE',source:'SYNTHETIC_TEST_ONLY',reviewedBy:'synthetic tester',observedAt:kind==='QUOTE'?source:stamp('14:15:00'),receivedAt:kind==='QUOTE'?receipt:stamp('14:15:01'),reviewedAt:kind==='QUOTE'?stamp('14:16:42'):stamp('14:16:00'),validThrough:stamp('15:00:00'),verdict:'PASS',rawJson,sha256:createHash('sha256').update(rawJson).digest('hex')};});
 return {research:r,at:stamp('14:16:50'),evidence:{version:'TECH_PAPER_EVIDENCE_V1',symbol:'AAPL',accountId:'SYNTHETIC',quantity:1,decisionAt:decision,entryDeadlineAt:stamp('14:18:30'),timeExitAt:stamp('14:23:30'),costsFrozenAt:stamp('14:16:00'),entryFeeCents:5,exitFeeCents:5,exitSlippageCents:1,entryLimitCents:105,maxSpreadCents:10,records}};
}
function mutate(q,kind,fn){const r=q.evidence.records.find(r=>r.kind===kind),p=JSON.parse(r.rawJson);fn(p,r);r.rawJson=JSON.stringify(p);r.sha256=createHash('sha256').update(r.rawJson).digest('hex');}
test('direction candidate does not require technical confirmation or imply permission',()=>{
 const q=request();delete q.evidence;const a=assess(q);
 assert.equal(a.research.trial.status,'PRE_CONFIRMATION_RESEARCH_CANDIDATE');assert.equal(a.research.confirmation.status,'WAIT');assert.equal(a.research.direction,'UP');
 assert.equal(a.status,'BLOCKED');assert.equal(a.paper.fills,0);assert.equal(a.executionAllowed,false);
});
test('unresolved fundamentals and risk independently withhold trial',()=>{
 const q=request();q.research.fundamental.status='CONFLICT';delete q.research.risk.capital;
 const a=assess(q);assert.equal(a.research.trial.status,'WITHHELD');assert.ok(a.research.trial.blockers.includes('RISK_CAPITAL_NOT_PASSED'));
});
test('complete synthetic evidence can only prove mechanical feasibility',()=>{
 const a=assess(request());assert.equal(a.status,'SYNTHETIC_ONLY',JSON.stringify(a.blockers));assert.equal(a.feasibilityPassed,false);assert.equal(a.quote.status,'QUALIFIED_SNAPSHOT_ONLY');assert.equal(a.economics.fullLossReserveCents,10310);assert.equal(a.paper.status,'NOT_ARMED');
});
for(const [name,change,block] of [
 ['missing costs',q=>q.evidence.entryFeeCents=null,'COSTS_UNKNOWN'],
 ['budget',q=>mutate(q,'RISK_LIMITS',p=>p.tradeBudgetMaxCents=100),'TRADE_BUDGET_EXCEEDED'],
 ['cash',q=>mutate(q,'ACCOUNT_FUNDS',p=>p.settledCashCents=100),'SETTLED_CASH_INSUFFICIENT'],
 ['permission',q=>mutate(q,'PRODUCT_PERMISSION',p=>p.enabled=false),'PRODUCT_PERMISSION_MISSING'],
 ['entitlement',q=>mutate(q,'DATA_ENTITLEMENT',p=>p.realtimeOptions=false),'DATA_ENTITLEMENT_MISSING'],
 ['identity',q=>mutate(q,'QUOTE',p=>p.id='other'),'QUOTE_NOT_QUALIFIED'],
 ['prior quote',q=>mutate(q,'QUOTE',(p,r)=>{p.updatedAt=stamp('14:16:20');r.observedAt=p.updatedAt;}),'QUOTE_NOT_QUALIFIED'],
 ['stale quote',q=>q.at=stamp('14:17:50'),'QUOTE_NOT_QUALIFIED'],
 ['size',q=>mutate(q,'QUOTE',p=>p.askSize=0),'QUOTE_NOT_QUALIFIED'],
 ['spread',q=>mutate(q,'QUOTE',p=>p.askCents=120),'QUOTE_NOT_QUALIFIED'],
 ['late decision',q=>q.at=stamp('14:19:00'),'DECISION_WINDOW_INVALID'],
 ['hash',q=>q.evidence.records[0].sha256='0'.repeat(64),'TECH_PAPER_EVIDENCE_INTEGRITY'],
 ['unsupported',q=>q.research.symbol='NVDA','TECH_SYMBOL_UNSUPPORTED'],
 ['review after decision',q=>q.evidence.records[0].reviewedAt=stamp('14:16:35'),'CONTRACT_CLOCK_OR_VALIDITY'],
 ['no execution reserve',q=>q.evidence.timeExitAt=stamp('14:24:00'),'EXISTING_ENGINEERING_WINDOW_OR_EXIT_RESERVE'],
])test(name+' fails closed',()=>{const q=request();change(q);const a=assess(q);assert.equal(a.status,'BLOCKED');assert.ok(a.blockers.includes(block),JSON.stringify(a.blockers));assert.equal(a.executionAllowed,false);assert.equal(a.paper.fills,0);});
test('duplicate nested JSON fails closed',()=>{const q=request(),r=q.evidence.records[0];r.rawJson='{"symbol":"AAPL","symbol":"TSM"}';r.sha256=createHash('sha256').update(r.rawJson).digest('hex');assert.equal(assess(q).status,'BLOCKED');});
test('CLI stores exact input; output is exclusive and isolated',()=>{
 const root=mkdtempSync(join(tmpdir(),'alpha-tech-paper-'));try{
  const dir=join(root,'data/runtime/options-workbench-development');mkdirSync(dir,{recursive:true});const file=join(root,'r.json'),out=join(dir,'receipt.json'),raw=JSON.stringify(research());writeFileSync(file,raw);
  const args=['--research',file,'--out',out],opts={root,now:()=>stamp('14:16:50')};
  assert.equal(techPaperCli(args,opts).paper.fills,0);
  assert.equal(JSON.parse(readFileSync(out,'utf8')).sources.research.utf8,raw);
  assert.throws(()=>techPaperCli(args,opts));
  assert.throws(()=>techPaperCli(['--research',file,'--out',join(root,'escape.json')],opts),/OUTPUT_SCOPE/);
  assert.throws(()=>techPaperCli(['--research',file,'--arm'],opts),/ARGUMENTS/);
 }finally{if(!resolve(root).startsWith(resolve(tmpdir())+sep))throw Error('cleanup scope');rmSync(root,{recursive:true});}
});

for(const [name,change,block] of [
 ['expired entitlement',q=>q.evidence.records.find(r=>r.kind==='DATA_ENTITLEMENT').validThrough=stamp('14:00:00'),'DATA_ENTITLEMENT_CLOCK_OR_VALIDITY'],
 ['account mismatch',q=>mutate(q,'ACCOUNT_FUNDS',p=>p.accountId='OTHER'),'ACCOUNT_FUNDS_UNKNOWN'],
 ['unreviewed evidence',q=>q.evidence.records[0].verdict='UNKNOWN','CONTRACT_NOT_REVIEWED'],
 ['future evidence',q=>q.evidence.records[0].observedAt=stamp('14:17:00'),'CONTRACT_CLOCK_OR_VALIDITY'],
 ['put permission absent',q=>{mutate(q,'CONTRACT',p=>p.type='put');mutate(q,'QUOTE',p=>p.type='put');},'PRODUCT_PERMISSION_MISSING'],
 ['fractional contract multiplier',q=>mutate(q,'CONTRACT',p=>p.multiplier=10),'CONTRACT_OR_PRODUCT_UNSUPPORTED'],
 ['unknown tick',q=>mutate(q,'QUOTE',p=>p.tickCents=null),'QUOTE_NOT_QUALIFIED'],
 ['underlying missing',q=>mutate(q,'QUOTE',p=>p.underlyingPriceUsd=null),'QUOTE_NOT_QUALIFIED'],
 ['future receipt',q=>mutate(q,'QUOTE',(p,r)=>{p.receivedAt=stamp('14:17:00');r.receivedAt=p.receivedAt;}),'QUOTE_NOT_QUALIFIED'],
 ['entry ceiling',q=>q.evidence.entryLimitCents=101,'QUOTE_NOT_QUALIFIED'],
 ['invalid session',q=>mutate(q,'QUOTE',p=>p.chainSession.lateCloseState='bogus'),'TECH_PAPER_SNAPSHOT_PAPER_CHAIN_SESSION'],
])test(name+' is not silently repaired',()=>{const q=request();change(q);const a=assess(q);assert.equal(a.status,'BLOCKED');assert.ok(a.blockers.includes(block),JSON.stringify(a.blockers));});
test('all supported symbols preserve independent research direction',()=>{
 for(const symbol of ['AAPL','TSM','QQQ']){const q=request();q.research.symbol=symbol;q.evidence.symbol=symbol;
  for(const kind of ['CONTRACT','QUOTE'])mutate(q,kind,p=>p.symbol=symbol);
  for(const kind of ['DATA_ENTITLEMENT','PRODUCT_PERMISSION'])mutate(q,kind,p=>p.symbols=[symbol]);
  assert.equal(assess(q).status,'SYNTHETIC_ONLY');
 }
});
test('stale research cannot become a current trial opinion',()=>{const q=request();q.at='2026-10-12T14:16:50.000Z';assert.equal(assess(q).research.trial.status,'WITHHELD');});

test('P2 material news with no detail must withhold pre-confirmation trial',()=>{
 const q=request();q.research.news.assumptionImpact='MATERIAL';q.research.news.materialChanges=[];
 const a=assess(q);assert.ok(a.research.blockers.includes('MATERIAL_NEWS_DETAIL_UNKNOWN'));
 assert.equal(a.research.trial.status,'WITHHELD');assert.ok(a.research.trial.blockers.includes('MATERIAL_NEWS_DETAIL_UNKNOWN'));
 assert.equal(a.research.trial.technicalConfirmationRequired,false);
});
for(const [name,change,block] of [
 ['unknown impact',r=>r.news.assumptionImpact='UNKNOWN','NEWS_TRIGGER_OR_IMPACT_UNKNOWN'],
 ['missing trigger',r=>r.news.trigger='','NEWS_TRIGGER_OR_IMPACT_UNKNOWN'],
 ['unknown trigger state',r=>r.news.triggerState='UNKNOWN','NEWS_TRIGGER_STATE_UNKNOWN'],
 ['conflicting impact',r=>r.news.materialChanges=[{id:'new',kind:'ORDERS',evidenceId:'NEWS'}],'NEWS_IMPACT_CONFLICT'],
 ['unreassessed material change',r=>{r.news.assumptionImpact='MATERIAL';r.news.materialChanges=[{id:'new',kind:'ORDERS',evidenceId:'NEWS'}];},'FUNDAMENTAL_REASSESSMENT_REQUIRED'],
 ['pending event outside holding window',r=>{r.news.triggerState='PENDING';r.news.eventAt='2026-10-12T14:30:00.000Z';},'NEWS_HYPOTHESIS_TIMING_UNKNOWN'],
])test(name+' remains in trial blockers',()=>{const q=request();change(q.research);const a=assess(q);assert.equal(a.research.trial.status,'WITHHELD');assert.ok(a.research.trial.blockers.includes(block),JSON.stringify(a.research.trial));});
test('known pending catalyst within holding horizon can remain a pre-confirmation research candidate',()=>{
 const q=request();q.research.news.triggerState='PENDING';q.research.news.eventAt=stamp('15:00:00');
 const a=assess(q);assert.equal(a.research.trial.status,'PRE_CONFIRMATION_RESEARCH_CANDIDATE');
 assert.equal(a.research.confirmation.status,'WAIT');assert.ok(a.research.confirmation.blockers.includes('NEWS_TRIGGER_PENDING'));
});
