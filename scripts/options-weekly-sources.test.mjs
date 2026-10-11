import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {weeklySourceRoots,readWeeklyCalendar,weeklySourcesView,projectWeeklySources} from './lib/options-weekly-sources.mjs';
import {weeklyPlanView} from './lib/options-weekly-plan-io.mjs';
import {withReleaseCalendarJournal} from './lib/options-release-calendar-io.mjs';
import {RELEASE_CALENDAR_URL} from '../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts';
import {buildWeeklyPlanPreview} from '../src/engines/options-weekly-plan/OptionsWeeklyPlan.ts';
import {weeklySourcePanel} from '../apps/options-workbench/weekly-plan.js';
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
