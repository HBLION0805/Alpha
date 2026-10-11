import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {weeklySourceRoots,readWeeklyCalendar,weeklySourcesView,projectWeeklySources,weeklyHeadlineFreshness} from './lib/options-weekly-sources.mjs';
import {weeklyPlanView} from './lib/options-weekly-plan-io.mjs';
import {withReleaseCalendarJournal} from './lib/options-release-calendar-io.mjs';
import {RELEASE_CALENDAR_URL} from '../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts';
import {buildWeeklyPlanPreview} from '../src/engines/options-weekly-plan/OptionsWeeklyPlan.ts';
import {weeklySourcePanel} from '../apps/options-workbench/weekly-plan.js';
import {refreshWeeklySources,readWeeklyRefreshes} from './lib/options-weekly-refresh.mjs';
import {projectTechResearchView} from './lib/options-tech-research-view.mjs';
const at='2026-10-11T03:30:00.000Z',week={weekStartDate:'2026-10-12',weekEndDate:'2026-10-16',events:[]};
const temp=async f=>{const r=fs.mkdtempSync(join(tmpdir(),'weekly-sources-'));try{return await f(r);}finally{fs.rmSync(r,{recursive:true,force:true});}};
const missing={state:'BLOCKED',inputs:null,errorCode:'STORE_ABSENT'};
const project=extra=>projectWeeklySources({at,week,calendars:{bls:missing,fomc:missing},news:{records:[],health:[],issues:[]},research:{records:[],issues:[]},...extra});
test('missing sources remain differentiated from no connector; GET creates nothing',async()=>temp(async root=>{
 const before=fs.readdirSync(root);const v=await weeklyPlanView(root,at);assert.deepEqual(fs.readdirSync(root),before);
 assert.equal(v.sourceCoverage.coverage.macroDataCoverage.state,'STORE_ABSENT');assert.equal(v.sourceCoverage.coverage.optionsMarketCoverage.state,'NOT_INTEGRATED');
 assert.equal(v.sourceCoverage.sourceCalls,0);assert.equal(v.sourceCoverage.fileSystemWrites,0);
}));
test('explicit calendar root is pure read and retains journal fingerprints; stale/failure distinct',async()=>temp(async root=>temp(async source=>{
 const input={requestedAt:'2026-10-11T03:00:00.000Z',receivedAt:'2026-10-11T03:00:01.000Z',url:RELEASE_CALENDAR_URL,sourceText:fs.readFileSync('fixtures/options-release-calendar/calendar.synthetic.ics','utf8'),errorCode:null};
 await withReleaseCalendarJournal(source,s=>s.append(input,at),at);
 fs.mkdirSync(join(root,'data/runtime/options-weekly-sources'),{recursive:true});fs.writeFileSync(join(root,'data/runtime/options-weekly-sources/config.json'),JSON.stringify({version:'WEEKLY_SOURCE_ROOTS_V1',roots:{calendars:source,news:root,research:root}}));
 assert.equal(weeklySourceRoots(root).roots.calendars,source);
 fs.writeFileSync(join(source,'data/runtime/options-release-calendar/writer.lock'),'independent writer lock');
 const calendar=readWeeklyCalendar(source,'bls',at);assert.equal(calendar.state,'AVAILABLE');assert.match(calendar.recordFingerprint,/^[a-f0-9]{64}$/);
 const v=await weeklyPlanView(root,at);assert.equal(v.sourceCoverage.coverage.macroDataCoverage.state,'CHECKED_NO_MATCH');assert.equal(v.sourceCoverage.coverage.macroDataCoverage.scopeComplete,false);
 assert.equal(weeklySourcesView(root,'2026-10-13T03:30:00.000Z',week).coverage.macroDataCoverage.state,'STALE');
 assert.equal(fs.readFileSync(join(source,'data/runtime/options-release-calendar/writer.lock'),'utf8'),'independent writer lock');
 const failed={...calendar,inputs:[...calendar.inputs,{...input,receivedAt:at,sourceText:null,errorCode:'HTTP_STATUS'}]};
 assert.equal(project({calendars:{bls:failed,fomc:missing}}).coverage.macroDataCoverage.state,'ACQUISITION_FAILED');
})));
test('corrupt journal is invalid evidence, never absence',async()=>temp(async root=>{
 fs.mkdirSync(join(root,'data/runtime/options-release-calendar'),{recursive:true});fs.writeFileSync(join(root,'data/runtime/options-release-calendar/retrievals.ndjson'),'{}\n');
 assert.equal(readWeeklyCalendar(root,'bls',at).errorCode,'INVALID_EVIDENCE');
}));
test('historical research remains attributed, fixtures excluded, one company is not universe coverage',()=>{
 const r={id:'one',symbol:'AAPL',context:'SAVED_RESEARCH',fundamental:{summary:'<script>unsafe</script>'},sourceRef:'abc',assessedAt:at,recordedAt:at};
 const v=project({research:{records:[r,{...r,context:'TEST_FIXTURE'}],issues:[]}});
 assert.equal(v.research.references.length,1);assert.equal(v.research.references[0].weeklyEventTime,null);assert.equal(v.coverage.earningsCoverage.scopeComplete,false);assert.deepEqual(v.coverage.earningsCoverage.objectsWithReferences,['AAPL']);assert.equal(v.events.length,0);
 const html=weeklySourcePanel(v);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>unsafe'));assert.ok(html.includes('AAPL'));assert.ok(html.includes('abc'));
});
test('publication after original receipt remains rejected when assessment moves forward',()=>{
 const no={state:'MISSING',inputs:null,errorCode:'STORE_MISSING'},n={title:'Anomaly',sourceId:'fed',sourceRef:null,retrievedAt:'2026-10-10T00:00:00.000Z',publishedAt:'2026-10-10T01:00:00.000Z'};
 assert.throws(()=>buildWeeklyPlanPreview({assessedAt:at,bls:no,fomc:no,newsContext:[n]}),/NEWS_FUTURE/);
});
test('partial news errors and source restriction stay visible',()=>{
 const v=project({news:{records:[],health:[],issues:[{state:'READ_ONLY_RESTRICTED'}]}});assert.equal(v.coverage.newsRiskCoverage.state,'READ_ONLY_RESTRICTED');
 const failed=project({news:{records:[],health:[{id:'fed',status:'FAILED'}],issues:[]}});assert.equal(failed.coverage.newsRiskCoverage.state,'ACQUISITION_FAILED');
});
test('bounded acquisition saves raw bytes and HTTP metadata then appears in weekly page; no retry and cooldown',async()=>temp(async root=>{
 let calls=0;const body=fs.readFileSync('fixtures/options-release-calendar/calendar.synthetic.ics','utf8').replaceAll('20260910T083000','20261013T083000').replaceAll('20260911T083000','20261014T083000');
 const response=await refreshWeeklySources({root,sourceIds:['bls_calendar'],now:()=>at,fetchImplementation:async(url,o)=>{calls++;assert.equal(o.redirect,'manual');assert.equal(o.credentials,'omit');return new Response(body,{status:200,headers:{'content-type':'text/calendar','etag':'original'}});}});
 assert.equal(calls,1);assert.equal(response.results[0].status,'OBTAINED_PENDING_REVIEW');
 const saved=readWeeklyRefreshes(root,at);assert.equal(saved.issues.length,0);assert.equal(Buffer.from(saved.records[0].rawBase64,'base64').toString(),body);assert.equal(saved.records[0].responseHeaders.etag,'original');
 const v=await weeklyPlanView(root,at);assert.ok(v.sourceCoverage.events.length);assert.equal(v.sourceCoverage.coverage.macroDataCoverage.state,'OBTAINED_PENDING_REVIEW');const html=weeklySourcePanel(v.sourceCoverage);assert.ok(html.includes(saved.records[0].rawSha256));assert.match(html,/HTTP <span[^>]*>200<\/span>/);assert.ok(html.includes(response.results[0].path));
 const again=await refreshWeeklySources({root,sourceIds:['bls_calendar'],now:()=>at,fetchImplementation:()=>{throw Error('must not fetch');}});assert.equal(again.results[0].status,'COOLDOWN');
}));
test('HTTP failure original survives; response corruption blocks recovery',async()=>temp(async root=>{
 let calls=0;const r=await refreshWeeklySources({root,sourceIds:['fed'],now:()=>at,fetchImplementation:async()=>{calls++;return new Response('Unavailable',{status:503,headers:{'content-type':'text/plain'}});}});
 assert.equal(calls,1);assert.equal(r.results[0].errorCode,'HTTP_503');const saved=readWeeklyRefreshes(root,at);assert.equal(Buffer.from(saved.records[0].rawBase64,'base64').toString(),'Unavailable');
 assert.equal((await weeklyPlanView(root,at)).sourceCoverage.coverage.newsRiskCoverage.state,'ACQUISITION_FAILED');
 const path=join(root,r.results[0].path),record=JSON.parse(fs.readFileSync(path));record.httpStatus=200;fs.writeFileSync(path,JSON.stringify(record));assert.equal(readWeeklyRefreshes(root,at).issues[0].state,'INVALID_EVIDENCE');assert.equal((await weeklyPlanView(root,at)).sourceCoverage.coverage.newsRiskCoverage.state,'INVALID_EVIDENCE');
}));
test('deadline bounds stalled request; unsupported sources cannot call network',async()=>temp(async root=>{
 const r=await refreshWeeklySources({root,sourceIds:['fed'],now:()=>at,deadlineMs:10,fetchImplementation:()=>new Promise(()=>{})});assert.equal(r.results[0].errorCode,'DEADLINE_EXCEEDED');
 await assert.rejects(refreshWeeklySources({root,sourceIds:['coindesk'],fetchImplementation:()=>assert.fail()}),/REFRESH_SCOPE/);
}));
test('news publication anomalies stay visible',async()=>temp(async root=>{
 const xml='<rss><channel><item><title>Original headline</title><guid>one</guid><link>https://www.federalreserve.gov/newsevents/pressreleases/test.htm</link><pubDate>Sun, 11 Oct 2026 04:00:00 GMT</pubDate></item></channel></rss>';
 await refreshWeeklySources({root,sourceIds:['fed'],now:()=>at,fetchImplementation:async()=>new Response(xml,{headers:{'content-type':'application/rss+xml'}})});
 const v=await weeklyPlanView(root,at);assert.equal(v.sourceCoverage.news.records[0].status,'INVALID_EVIDENCE');assert.equal(v.sourceCoverage.coverage.newsRiskCoverage.matchedRecords,0);
}));
test('exact retransmissions group receipt links; changed headlines remain separate revisions',async()=>temp(async root=>{
 const xml=title=>`<rss><channel><item><title>${title}</title><guid>same-id</guid><link>https://www.federalreserve.gov/newsevents/pressreleases/test.htm</link></item></channel></rss>`;
 for(const [clock,title]of [['2026-10-11T00:00:00.000Z','Original'],['2026-10-11T01:00:00.000Z','Original'],['2026-10-11T02:00:00.000Z','Correction']])await refreshWeeklySources({root,sourceIds:['fed'],now:()=>clock,fetchImplementation:async()=>new Response(xml(title),{headers:{'content-type':'application/rss+xml'}})});
 const news=(await weeklyPlanView(root,at)).sourceCoverage.news;assert.equal(news.records.length,2);assert.equal(news.records.find(r=>r.title==='Original').retransmittedReceipts.length,2);assert.equal(news.records[0].title,'Correction');assert.equal(readWeeklyRefreshes(root,at).records.length,3);
}));
test('failed later calendar keeps prior event receipt; failure is not a fresh event',async()=>temp(async root=>{
 const body=fs.readFileSync('fixtures/options-release-calendar/calendar.synthetic.ics','utf8').replaceAll('20260910T083000','20261013T083000');
 const first=await refreshWeeklySources({root,sourceIds:['bls_calendar'],now:()=> '2026-10-11T01:00:00.000Z',fetchImplementation:async()=>new Response(body,{headers:{'content-type':'text/calendar'}})});
 const second=await refreshWeeklySources({root,sourceIds:['bls_calendar'],now:()=> '2026-10-11T02:00:00.000Z',fetchImplementation:async()=>new Response('Unavailable',{status:503})});
 const v=(await weeklyPlanView(root,at)).sourceCoverage;assert.equal(v.coverage.macroDataCoverage.state,'ACQUISITION_FAILED');assert.equal(v.coverage.macroDataCoverage.path,second.results[0].path);assert.equal(v.events[0].path,first.results[0].path);assert.equal(v.events[0].retrievedAt,'2026-10-11T01:00:00.000Z');
}));
test('oversized response saves only bounded prefix and explicit incomplete failure',async()=>temp(async root=>{
 const r=await refreshWeeklySources({root,sourceIds:['fed'],now:()=>at,fetchImplementation:async()=>new Response('x'.repeat(524289))});assert.equal(r.results[0].errorCode,'BODY_TOO_LARGE');
 const saved=readWeeklyRefreshes(root,at).records[0];assert.equal(Buffer.from(saved.rawBase64,'base64').length,524288);assert.equal(saved.bodyComplete,false);assert.equal(saved.parsed.items.length,0);
}));
test('unfinished attempt blocks future acquisition without retry or deleting evidence',async()=>temp(async root=>{
 const dir=join(root,'data/runtime/options-weekly-sources/refreshes');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(join(dir,'fed.lock'),'unfinished');
 await assert.rejects(refreshWeeklySources({root,sourceIds:['fed'],now:()=>at,fetchImplementation:()=>assert.fail()}),/REFRESH_STORE_REQUIRES_REVIEW/);assert.equal(fs.readFileSync(join(dir,'fed.lock'),'utf8'),'unfinished');
}));
test('weekly opt-in retains relative original references without changing default research privacy',()=>{
 const doc={id:'original',url:'https://www.sec.gov/Archives/example.htm',sourcePath:'source/filings/original.html',sha256:'a'.repeat(64),receivedAt:at};
 const view={version:'TECH36_EVENT_REVIEW_VIEW_V1',mode:'SAVED_SOURCE_REVIEW',recordedAt:at,inputs:{documents:[doc],eventInputs:[{symbol:'AAPL',documentIds:['original'],researchInput:{},savedReview:{}}]}};
 const ordinary=projectTechResearchView(view,{digest:'b'.repeat(64),at});assert.equal(ordinary[0].sources.items[0].sourcePath,undefined);
 const weekly=projectTechResearchView(view,{digest:'b'.repeat(64),at,includeEvidenceLocations:true});assert.equal(weekly[0].sources.items[0].sourcePath,doc.sourcePath);assert.equal(weekly[0].sources.items[0].sha256,doc.sha256);
 doc.sourcePath='C:/private/file';assert.equal(projectTechResearchView(view,{digest:'b'.repeat(64),at,includeEvidenceLocations:true})[0].sources.items[0].sourcePath,null);
});
test('review P2: interleaved legacy update owns fallback event identity after refresh failure',async()=>temp(async root=>temp(async legacy=>{
 const body=fs.readFileSync('fixtures/options-release-calendar/calendar.synthetic.ics','utf8');
 await refreshWeeklySources({root,sourceIds:['bls_calendar'],now:()=> '2026-10-11T01:00:00.000Z',fetchImplementation:async()=>new Response(body.replaceAll('20260910T083000','20261013T083000'),{headers:{'content-type':'text/calendar'}})});
 const input={requestedAt:'2026-10-11T02:00:00.000Z',receivedAt:'2026-10-11T02:00:01.000Z',url:RELEASE_CALENDAR_URL,sourceText:body.replaceAll('20260910T083000','20261014T083000'),errorCode:null};
 await withReleaseCalendarJournal(legacy,s=>s.append(input,input.receivedAt),input.receivedAt);
 fs.writeFileSync(join(root,'data/runtime/options-weekly-sources/config.json'),JSON.stringify({version:'WEEKLY_SOURCE_ROOTS_V1',roots:{calendars:legacy,news:root,research:root}}));
 const failure=await refreshWeeklySources({root,sourceIds:['bls_calendar'],now:()=> '2026-10-11T03:00:00.000Z',fetchImplementation:async()=>new Response('Unavailable',{status:503})});
 const v=(await weeklyPlanView(root,at)).sourceCoverage,original=readWeeklyCalendar(legacy,'bls',at),e=v.events[0];
 assert.equal(e.startAt,'2026-10-14T12:30:00.000Z');assert.equal(e.retrievedAt,input.receivedAt);assert.equal(e.path,original.path);assert.equal(e.recordFingerprint,original.recordFingerprint);assert.equal(e.sourceRoot,'calendars');assert.equal(v.coverage.macroDataCoverage.path,failure.results[0].path);
})));
test('review P2: OFAC sanctions are policy evidence and never auction/fiscal coverage',()=>{
 const r={sourceId:'ofac',status:'OBTAINED_PENDING_REVIEW',title:'ICC and Afghanistan sanctions'},h={id:'ofac',status:'OK',observedAt:at};
 const v=project({news:{records:[r],health:[h],issues:[]}});assert.equal(v.coverage.treasuryFiscalCoverage.state,'NOT_INTEGRATED');assert.equal(v.coverage.treasuryFiscalCoverage.matchedRecords,0);assert.equal(v.coverage.policyGeopoliticalCoverage.matchedRecords,1);
});
test('review P2: fixed company denominator excludes QQQ/SPY but retains their market background',()=>{
 const records=['AAPL','QQQ','SPY'].map(symbol=>({symbol,context:'SAVED_RESEARCH'}));const v=project({research:{records,issues:[]}});
 assert.equal(v.coverage.earningsCoverage.universeSize,36);assert.deepEqual(v.coverage.earningsCoverage.objectsWithReferences,['AAPL']);assert.equal(v.coverage.earningsCoverage.historicalReferences,1);assert.equal(v.coverage.earningsCoverage.missingObjects.length,35);assert.equal(v.research.backgroundReferences.length,2);assert.equal(v.research.companyReferences.length,1);
});
test('review P2: fresh receipt never rejuvenates old or unknown publication; exact 72-hour policy retained',()=>{
 const old=weeklyHeadlineFreshness('fed','2020-01-01T00:00:00.000Z',at,at);assert.equal(old.receiptFreshness,'FRESH');assert.equal(old.contentFreshness,'HISTORICAL');assert.equal(old.status,'HISTORICAL_BACKGROUND');
 assert.equal(weeklyHeadlineFreshness('fed',null,at,at).status,'CONTENT_TIME_UNKNOWN');
 const boundary=new Date(Date.parse(at)-72*3600000).toISOString();assert.equal(weeklyHeadlineFreshness('fed',boundary,at,at).status,'OBTAINED_PENDING_REVIEW');assert.equal(weeklyHeadlineFreshness('fed',new Date(Date.parse(boundary)-1).toISOString(),at,at).status,'HISTORICAL_BACKGROUND');
 const v=project({news:{records:[{sourceId:'fed',...old}],health:[{id:'fed',status:'OK',observedAt:at}],issues:[]}});assert.equal(v.coverage.newsRiskCoverage.matchedRecords,0);assert.equal(v.coverage.newsRiskCoverage.state,'HISTORICAL_BACKGROUND');
});
test('review partial: HTTP 200 retains rejected-item counts in health and receipt projection',async()=>temp(async root=>{
 const body='<rss><channel><item><title>Valid</title><link>https://apps.bea.gov/news/test</link></item><item><title>Invalid missing link</title></item></channel></rss>';
 await refreshWeeklySources({root,sourceIds:['bea'],now:()=>at,fetchImplementation:async()=>new Response(body,{headers:{'content-type':'application/rss+xml'}})});
 const v=(await weeklyPlanView(root,at)).sourceCoverage;assert.equal(v.refreshReceipts[0].partial,true);assert.equal(v.refreshReceipts[0].rejectedItems,1);assert.equal(v.refreshReceipts[0].itemsParsed,1);assert.equal(v.news.health.find(h=>h.id==='bea').partial,true);
 assert(weeklySourcePanel(v).includes('部分解析'));
}));
