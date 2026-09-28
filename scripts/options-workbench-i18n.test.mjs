import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DEFAULT_LOCALE,statusLabel,enumLabel,t,localizeText,localizeError,localizeWorkbench} from '../apps/options-workbench/i18n.js';
import {plannerDefaults,buildScenario} from '../apps/options-workbench/forms.js';
import {weeklyPlanPage,weeklyPlanStatusCard,weeklyDraftFromState} from '../apps/options-workbench/weekly-plan.js';

const root=resolve(import.meta.dirname,'../apps/options-workbench');
const html=readFileSync(resolve(root,'index.html'),'utf8');
assert.equal(DEFAULT_LOCALE,'zh-CN');
assert.match(html,/<html lang="zh-CN">/);
assert.match(html,/<title>Alpha · 资本决策工作台<\/title>/);
for(const [route,label] of Object.entries({guidance:'每日决策','weekly-plan':'每周交易计划','event-research':'事件研究','macro-playbook':'宏观手册',overview:'总览',chain:'期权与活动',planner:'交易计划',journal:'交易日志',reviews:'复盘与经验',context:'新闻与日历'})){
  assert.match(html,new RegExp(`href="#${route}" data-route="${route}"[^>]*><span[^>]*>[^<]*<\\/span>${label}<\\/a>`));
}
for(const [code,label] of Object.entries({NO_TRADE:'暂不交易',WATCH:'观察',READY_FOR_OWNER_MANUAL_ENTRY:'可准备手动入场',UNKNOWN:'未知'})){
  assert.equal(statusLabel(code),label);assert.equal(enumLabel(code),label);assert.equal(t(code),label);
}
assert.equal(localizeText('Daily guidance'),'每日决策');
assert.equal(localizeText('Trade planner'),'交易计划');
assert.equal(localizeText('GLD'),'GLD');
assert.equal(localizeText('Federal Reserve releases its policy statement'),'Federal Reserve releases its policy statement');
assert.equal(localizeText('Owner wrote: Watch the source'),'Owner wrote: Watch the source');
const weeklySample={weeklyPlan:{state:'AVAILABLE',data:{weekStartDate:'2026-09-28',weekEndDate:'2026-10-02',assessedAt:'2026-09-27T14:00:00.000Z',latest:null,revisions:[],preview:{coverage:{earningsCoverage:'MISSING_SOURCE'},events:[{eventId:'owner-1',title:'Owner event title',category:'COMPANY_EVENT',startAt:'2026-10-01',endAt:null,timePrecision:'DATE_ONLY',sourceId:'Original source title',sourceCharacter:'OWNER_DECLARED',retrievedAt:null,publishedAt:null,affectedSymbols:['TEST'],notes:'Owner note'}],daily:[],newsWatch:[],monitoredAssets:[],unknowns:[],noTradeConditions:[],eventResearchRefs:[],sourceEvidence:{}}}}};
assert.match(weeklyPlanStatusCard(weeklySample),/本周交易计划：尚未建立/);
const weeklyHtml=weeklyPlanPage(weeklySample,{});
assert.match(weeklyHtml,/<h1>每周交易计划<\/h1>/);
assert.match(weeklyHtml,/<strong translate="no">Owner event title<\/strong>/);
assert.match(weeklyHtml,/<span translate="no">Owner note<\/span>/);
assert.match(weeklyHtml,/仅有日期，时间未知/);
assert(!weeklyHtml.includes('2026-10-01T00:00'));
const linkedWeekly=structuredClone(weeklySample);
linkedWeekly.weeklyPlan.data.preview.eventResearchRefs=['gld-employment-20261002'];
linkedWeekly.weeklyPlan.data.preview.referenceEvidence=[{id:'gld-employment-20261002',kind:'MANUAL_PLAN_DRAFT',sourcePath:'data/runtime/original/0001.json',savedAt:'2026-09-20T14:00:00.000Z',sourceFingerprint:'a'.repeat(64)}];
linkedWeekly.weeklyPlan.data.preview.monitoredAssets=[{symbol:'NTR',themes:[],ownerStatus:'EXCLUDED',identityStatus:'OWNER_SUPPLIED_PENDING_VERIFICATION'}];
const linkedHtml=weeklyPlanPage(linkedWeekly,{});
assert.match(linkedHtml,/现有已保存的计划草稿，仅供引用；仍未冻结或创建交易/);
assert.match(linkedHtml,/Owner 已排除，不纳入当前监测/);
assert.match(linkedHtml,/身份待独立核实/);
assert.match(linkedHtml,/href="#planner">打开交易计划/);
assert.deepEqual(weeklyDraftFromState({latest:{requestPlan:{manualEvents:[],newsWatch:['watch'],notes:'Owner draft',noTradeConditions:[],eventResearchRefs:[]}}}).newsWatch,['watch']);
const reviewedWeekly=structuredClone(weeklySample);
reviewedWeekly.weeklyPlan.data.latest={plan:structuredClone(weeklySample.weeklyPlan.data.preview),requestPlan:{manualEvents:[],newsWatch:[],notes:'',noTradeConditions:[],eventResearchRefs:[]},revision:1,state:'REVIEWED'};
reviewedWeekly.weeklyPlan.data.latest.plan.events[0].title='Original reviewed event';
reviewedWeekly.weeklyPlan.data.preview.events[0].title='Later unreviewed event';
const reviewedHtml=weeklyPlanPage(reviewedWeekly,{});
assert.match(reviewedHtml,/Original reviewed event/);
assert(!reviewedHtml.includes('Later unreviewed event'));
assert.match(reviewedHtml,/已复核快照；后续信息须预览并追加修订/);
const updatedHtml=weeklyPlanPage(reviewedWeekly,{weeklyPreview:reviewedWeekly.weeklyPlan.data.preview});
assert.match(updatedHtml,/Later unreviewed event/);
assert.match(updatedHtml,/待保存的本地预览/);
assert.match(localizeError('The sale exceeds open contracts. (MANUAL_LEDGER_OVERSELL)'),/^卖出数量超过/);
assert.equal(localizeError('BROKER_SECRET_123 (UNKNOWN_INTERNAL_ERROR)'),'本地操作失败。（UNKNOWN_INTERNAL_ERROR）');

const source={headline:'Federal Reserve releases its policy statement',note:'Owner wrote: Watch the source',status:'NO_TRADE',captureOrigin:'HOST_MARKET_TOOL_RESPONSES'};
const before=JSON.stringify(source);const textNode={nodeType:3,nodeValue:'Trade planner',parentElement:{closest:()=>null}};
globalThis.document={createTreeWalker:()=>({currentNode:null,nextNode:()=>false})};
localizeWorkbench(textNode);
delete globalThis.document;
assert.equal(textNode.nodeValue,'交易计划');assert.equal(JSON.stringify(source),before);
const originalNote={nodeType:3,nodeValue:'Trade planner',parentElement:{closest:()=>({})}};
localizeWorkbench(originalNote);assert.equal(originalNote.nodeValue,'Trade planner');
assert.match(readFileSync(resolve(root,'focused-news.js'),'utf8'),/translate="no"/);
assert.match(readFileSync(resolve(root,'source-comparison.js'),'utf8'),/translate="no"/);
const draft={...plannerDefaults(),bid:'0.19',ask:'0.20'};
const commandBefore=buildScenario(draft);localizeText('Premium');assert.deepEqual(buildScenario(draft),commandBefore);

// Obvious static chrome check. Technical brand/source names are intentionally allowed.
const allowed=new Set(['ALPHA','Alpha','GLD','IBIT','Robinhood','JavaScript','HTML']);
const shellText=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,' ');
for(const word of shellText.match(/\b[A-Za-z]{3,}\b/g)??[])assert(allowed.has(word),`untranslated shell word: ${word}`);
for(const name of readdirSync(root).filter(name=>name.endsWith('.js')&&!['i18n.js','api.js','model.js'].includes(name))){
  const sourceText=readFileSync(resolve(root,name),'utf8');
  for(const title of sourceText.matchAll(/<h1>([A-Za-z][^<${}]+)<\/h1>/g)){
    assert.notEqual(localizeText(title[1]),title[1],`untranslated route title in ${name}: ${title[1]}`);
  }
}
assert(!readFileSync(resolve(import.meta.dirname,'options-workbench.mjs'),'utf8').includes("'/api/orders'"));
for(const id of ['detail-dialog','preview-dialog'])assert.match(html,new RegExp(`<dialog id="${id}" aria-labelledby="[^"]+"`));
console.log('Owner Chinese UI focused checks: PASS');
