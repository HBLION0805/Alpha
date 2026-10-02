import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {equal,ok,throws} from 'node:assert/strict';
import {PointInTimeReplayEngine} from '../src/engines/event-intelligence-replay/PointInTimeReplayEngine.ts';
import {savePreEventState} from './lib/options-event-intelligence-pre-event.mjs';
import {materializeEmploymentCase} from './lib/options-event-intelligence-employment-case.mjs';
import {captureEmploymentWindow} from './options-event-intelligence-employment-window.mjs';
import {readPublicEmploymentFeed,EMPLOYMENT_SOURCE_URL} from './lib/options-driver-io.mjs';
import {listEventObservations} from './lib/options-event-intelligence-observation.mjs';
const at='2026-10-02T12:30:05.000Z';
const news=(headline='Employment Situation - September 2026',published='Fri, 02 Oct 2026 08:30:00 -0400')=>`<?xml version="1.0"?><rss version="2.0"><channel><title>BLS</title><link>https://www.bls.gov/</link><description>BLS releases</description><item><guid>employment-release</guid><title>${headline}</title><link>https://www.bls.gov/news.release/empsit.nr0.htm</link><pubDate>${published}</pubDate></item></channel></rss>`;
const btc=()=>({input:{receivedAt:at},assessment:{status:'OBSERVED_CONTEXT',receivedAt:at,usableAtReceipt:true,midpointUsd:'85000.005',book:{sourceTime:'2026-10-02T12:30:04.000Z'}}});
const rows=root=>listEventObservations(root,'employment-situation-20261002','2026-10-02T14:00:00.000Z').map(x=>x.evidence);
const base=root=>({workspaceRoot:root,now:()=>at,fetchFeed:async id=>{equal(id,'bls');return news();},retrieveBtc:async()=>btc(),appendBtc:async()=>({status:'SAVED'})});
let passed=0;
async function test(name,fn){const root=mkdtempSync(join(tmpdir(),'alpha-employment-window-'));try{await fn(root);passed++;console.log('PASS '+name);}finally{rmSync(root,{recursive:true,force:true});}}
await test('production transport requests the dedicated Employment Situation feed',async root=>{
 const urls=[];
 const result=await captureEmploymentWindow({...base(root),fetchFeed:id=>readPublicEmploymentFeed(id,async url=>{urls.push(url);return new Response(news(),{headers:{'Content-Type':'application/rss+xml'}});})});
 equal(urls.length,1);equal(urls[0],EMPLOYMENT_SOURCE_URL);equal(result.status,'CAPTURED');equal(result.acceptanceStatus,'NOT_EVALUATED');equal(result.executionAllowed,false);
 equal(rows(root).filter(x=>x.kind==='SOURCE_OBSERVATION').length,1);equal(rows(root).filter(x=>x.kind==='MARKET_OBSERVATION').length,1);
 const raw=JSON.parse(readFileSync(join(root,result.rawBlsPath),'utf8'));equal(raw.xml,news());equal(raw.sourceId,'bls');equal(raw.receivedAt,at);ok(raw.sha256);
});
await test('same headline is idempotent; later capture cannot rewrite first receipt',async root=>{
 const a=await captureEmploymentWindow(base(root));const before=rows(root).find(x=>x.kind==='SOURCE_OBSERVATION');
 const retry=await captureEmploymentWindow(base(root));equal(a.saved.length,3);equal(retry.saved.length,0);
 await captureEmploymentWindow({...base(root),now:()=> '2026-10-02T12:31:05.000Z'});
 equal(rows(root).filter(x=>x.kind==='SOURCE_OBSERVATION').length,1);equal(rows(root).find(x=>x.kind==='SOURCE_OBSERVATION').receivedAt,before.receivedAt);
});
await test('BLS failure remains unavailable while BTC is retained',async root=>{
 const r=await captureEmploymentWindow({...base(root),fetchFeed:async()=>{throw Error('FEED_NETWORK_FAILED');}});
 equal(r.status,'PARTIAL');ok(r.blockers.includes('BLS_SOURCE_UNAVAILABLE_OR_PARTIAL'));
 equal(rows(root).filter(x=>x.kind==='SOURCE_OBSERVATION').length,0);equal(rows(root).filter(x=>x.kind==='MARKET_OBSERVATION').length,1);
 equal(rows(root).find(x=>x.sourceId==='bls').availability,'UNKNOWN');
});
await test('BTC failure does not discard the independently received BLS release',async root=>{
 const r=await captureEmploymentWindow({...base(root),retrieveBtc:async()=>{throw Error('BTC_FAILED');}});
 equal(r.status,'PARTIAL');ok(r.blockers.includes('BTC_UNAVAILABLE'));
 equal(rows(root).filter(x=>x.kind==='SOURCE_OBSERVATION').length,1);equal(rows(root).filter(x=>x.kind==='MARKET_OBSERVATION').length,0);
});
await test('missing quote source clock never becomes collection time',async root=>{
 await captureEmploymentWindow({...base(root),retrieveBtc:async()=>{const b=btc();b.assessment.book.sourceTime=null;return b;}});
 equal(rows(root).filter(x=>x.kind==='MARKET_OBSERVATION').length,0);ok(rows(root).some(x=>x.kind==='SOURCE_STATUS'&&x.sourceId==='coinbase-btc-context'&&x.availability==='UNKNOWN'));
});
await test('August release cannot qualify as September release after a fresh fetch',async root=>{
 const r=await captureEmploymentWindow({...base(root),fetchFeed:async()=>news('Employment Situation - August 2026','Fri, 04 Sep 2026 08:30:00 -0400')});
 equal(rows(root).filter(x=>x.kind==='SOURCE_OBSERVATION').length,0);ok(r.blockers.includes('BLS_RELEASE_NOT_OBSERVED'));
});
await test('future publication cannot be accepted before its source time',async root=>{
 await captureEmploymentWindow({...base(root),fetchFeed:async()=>news('Employment Situation - September 2026','Fri, 02 Oct 2026 09:30:00 -0400')});
 equal(rows(root).filter(x=>x.kind==='SOURCE_OBSERVATION').length,0);
});
await test('news and BTC start in parallel rather than waiting for the slower feed',async root=>{
 let release,btcStarted=false;const gate=new Promise(r=>{release=r;});
 const work=captureEmploymentWindow({...base(root),fetchFeed:async()=>{await gate;return news();},retrieveBtc:async()=>{btcStarted=true;return btc();}});
 await new Promise(r=>setImmediate(r));const started=btcStarted;release();await work;equal(started,true);
});
await test('changed same-ID headline retained as distinct observation, never overwritten',async root=>{
 await captureEmploymentWindow(base(root));
 await captureEmploymentWindow({...base(root),now:()=> '2026-10-02T12:31:05.000Z',fetchFeed:async()=>news('Employment Situation - September 2026 - correction')});
 equal(rows(root).filter(x=>x.kind==='SOURCE_OBSERVATION').length,2);
});
await test('late repair is labelled post-window, not an on-time success',async root=>{
 const later='2026-10-02T13:00:00.000Z';const r=await captureEmploymentWindow({...base(root),now:()=>later});
 equal(r.captureKind,'POST_WINDOW_REPAIR');equal(rows(root).find(x=>x.kind==='SOURCE_OBSERVATION').receivedAt,later);equal(r.acceptanceStatus,'NOT_EVALUATED');
});
await test('archive event identity accepts publisher metadata earlier than the scheduled release without backdating receipt',async root=>{
 const xml=news('Both payroll employment and unemployment rate change little in September','Fri, 02 Oct 2026 07:51:08 -0400').replace('https://www.bls.gov/news.release/empsit.nr0.htm','https://www.bls.gov/news.release/archives/empsit_10022026.htm');
 await captureEmploymentWindow({...base(root),fetchFeed:async()=>xml});
 const e=rows(root).find(x=>x.kind==='SOURCE_OBSERVATION');ok(e);equal(e.receivedAt,at);equal(e.sourcePublishedAt,'2026-10-02T11:51:08.000Z');
});
await test('parsed content and decisions cannot leak before parsing finishes',async root=>{
 await captureEmploymentWindow(base(root));
 const e=rows(root).find(x=>x.kind==='SOURCE_OBSERVATION');e.parsedAt='2026-10-02T12:30:10.000Z';
 const value={eventId:e.eventId,caseType:'SCHEDULED',title:'Synthetic parse visibility test',eventTime:'2026-10-02T12:30:00.000Z',createdAt:at,evidence:[e],historicalDecisions:[],recomputedDecisions:[],invalidationRules:[],requiredEvidenceIds:[e.evidenceId]};
 const engine=new PointInTimeReplayEngine();equal(engine.replay(value,'2026-10-02T12:30:06.000Z').visibleEvidence.length,0);equal(engine.replay(value,e.parsedAt).visibleEvidence.length,1);
 value.historicalDecisions=[{decisionId:'synthetic-decision',eventId:e.eventId,generatedAt:'2026-10-02T12:30:07.000Z',evidenceCutoffAt:'2026-10-02T12:30:06.000Z',inputEvidenceIds:[e.evidenceId],decisionVersion:'test',ruleVersion:'test',modelVersion:'test',thesisVersion:'test'}];
 throws(()=>engine.replay(value,e.parsedAt),/FUTURE_EVIDENCE/);
});
await test('all earlier pre-event states remain replayable, later states stay outside the as-of view',async root=>{
 const state={guidance:{state:'AVAILABLE',data:{current:{assets:[{symbol:'GLD',equity:{price:'1',sourceAt:'2026-10-02T12:00:00.000Z'},blockers:['UNDERLYING_PRICE_NOT_FRESH']}]}}},focusedNews:{state:'MISSING'}};
 savePreEventState(root,state,'2026-10-02T12:10:00.000Z',{id:'12345678'});
 savePreEventState(root,state,'2026-10-02T12:20:00.000Z',{id:'12345679'});
 const early=materializeEmploymentCase(root,'2026-10-02T12:15:00.000Z');equal(early.evidence.filter(e=>e.kind==='PRE_EVENT_STATE').length,1);
 const late=materializeEmploymentCase(root,at);equal(late.evidence.filter(e=>e.kind==='PRE_EVENT_STATE').length,2);equal(late.evidence.find(e=>e.kind==='PRE_EVENT_STATE').availability,'UNKNOWN');
});
await test('ordinary quote before a headline is not proof of a price move preceding news',async root=>{
 await captureEmploymentWindow(base(root));const evidence=rows(root);const market=evidence.find(e=>e.kind==='MARKET_OBSERVATION');market.receivedAt='2026-10-02T12:30:04.000Z';
 const value={eventId:market.eventId,caseType:'SCHEDULED',title:'Synthetic ordinary quote',eventTime:'2026-10-02T12:30:00.000Z',createdAt:at,evidence,historicalDecisions:[],recomputedDecisions:[],invalidationRules:[],requiredEvidenceIds:[]};
 equal(new PointInTimeReplayEngine().replay(value,at).arrivalOrder,'ORDER_UNKNOWN');
});
console.log(`Employment window regression: ${passed}/${passed} passed.`);
