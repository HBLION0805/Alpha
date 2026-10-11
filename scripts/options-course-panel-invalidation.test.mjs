import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {assessCourseFramework,courseInputFromPlan} from '../apps/options-workbench/course-framework.mjs';
import {courseAssessmentPanel,coursePlannerPanel} from '../apps/options-workbench/course-panel.js';
import {updateThesisDraft,thesisDefaults} from '../apps/options-workbench/trade-thesis.js';

// Exercise the actual app event-handler body without running browser bootstrap,
// timers, requests or saved-data loading. Its course renderer and draft updater
// are the production modules, with only the surrounding DOM supplied by fixtures.
const app=readFileSync(new URL('../apps/options-workbench/app.js',import.meta.url),'utf8');
const start=app.indexOf('function updateDraft(el){'),end=app.indexOf('function prepareContract(row){',start);
assert(start>=0&&end>start);const handler=app.slice(start,end);
function fixture(){return {thesisFields:{symbol:'GLD',expiry:'2026-10-16',thesis:'Declared hypothesis',timeExitAt:'2026-10-15T19:00:00Z'},thesisDraft:{...thesisDefaults(),realizationStartAt:'2026-10-12T14:00:00Z',realizationEndAt:'2026-10-15T18:00:00Z',nextCheckAt:'2026-10-12T15:00:00Z',manualFallback:'Owner checks original evidence',holdThroughEvent:'Exit before event',conditions:[{id:'owner',kind:'OWNER_CONFIRMED',invalidation:'Source contradicts hypothesis'}]},courseDraft:{direction:'BULLISH',magnitude:'Declared move',ivHistoryRef:'Historical IV reference',realizedVolRef:'Realized volatility reference',ivComparisonReview:'Comparable clocks and window',ivHypothesis:'IV may decline',structure:'LONG_CALL',rationale:'Declared rationale',alternative:'No trade',counterexample:'Demand falls',entry:'Confirm saved evidence',priceExit:'Original independent price stop',ownerPolicyRef:'Original owner version',planAssumptionsRef:'Original plan assumptions',positionsRef:'Declared positions reference',greeksRef:'Comparable Greeks reference'}};}
function edit(ui,name,value,{panelPresent=true,type='text'}={}){
 const originalCourse=JSON.stringify(ui.courseDraft),old=assessCourseFramework(courseInputFromPlan(ui.thesisFields,ui.thesisDraft,ui.courseDraft));
 const panel={innerHTML:courseAssessmentPanel(old)},thesisPanel={innerHTML:'Previous thesis preview'},confirm={disabled:false},dirty=new Set(),assessed=[];
 const form={id:'thesis-plan-form',querySelector:selector=>{assert.equal(selector,'[value="CONFIRM"]');return confirm;}};
 const el={name,value,type,checked:value,closest:selector=>{assert.equal(selector,'form');return form;}};
 const context={ui,el,dirty,updateThesisDraft,courseInputFromPlan,courseAssessmentPanel,assessCourseFramework:input=>{assessed.push(structuredClone(input));return assessCourseFramework(input);},$:selector=>selector==='#course-framework-result'?(panelPresent?panel:null):selector==='#thesis-plan-preview'?thesisPanel:null};
 runInNewContext(handler+'\nupdateDraft(el);',context);
 assert.equal(JSON.stringify(ui.courseDraft),originalCourse);assert.equal(confirm.disabled,true);assert(dirty.has('thesis'));assert.match(thesisPanel.innerHTML,/Preview again/);
 if(panelPresent){assert.equal(assessed.length,1);assert.equal(panel.innerHTML,courseAssessmentPanel(assessCourseFramework(courseInputFromPlan(ui.thesisFields,ui.thesisDraft,ui.courseDraft))));}
 return {panel,input:assessed[0],assessment:assessed.length?assessCourseFramework(assessed[0]):null,old};
}
let passed=0,total=0;const check=(name,fn)=>{total++;test(name,()=>{fn();passed++;});};after(()=>console.log(`Course panel invalidation: ${passed}/${total} tests passed.`));
check('editing every mapped thesis requirement immediately removes the prior complete-field result',()=>{
 for(const [name,missing]of [['thesis','THESIS_REFERENCE'],['expiry','EXACT_CONTRACT_EXPIRY_REFERENCE'],['timeExitAt','LATEST_EXIT'],['thesis.realizationStartAt','REALIZATION_WINDOW'],['thesis.realizationEndAt','REALIZATION_WINDOW'],['thesis.nextCheckAt','NEXT_CHECK'],['thesis.manualFallback','INTERRUPTION_PLAN'],['thesis.holdThroughEvent','EVENT_HOLDING_DECISION'],['condition.owner.invalidation','INVALIDATION']]){
  const ui=fixture(),r=edit(ui,name,'');assert.equal(r.old.status,'DECLARED_INPUTS_PRESENT_NOT_VERIFIED',name);assert.equal(r.assessment.status,'INSUFFICIENT_EVIDENCE',name);assert(r.assessment.checks.some(c=>c.missing.includes(missing)),name);assert(r.panel.innerHTML.includes(missing),name);
 }
});
check('editing exit time into a contradiction displays mismatch before submitting again',()=>{const r=edit(fixture(),'timeExitAt','2026-10-13T19:00:00Z');assert.equal(r.assessment.status,'RESEARCH_MISMATCH');assert.match(r.panel.innerHTML,/RESEARCH_MISMATCH/);assert.equal(r.assessment.admissionOverride,false);});
check('disabling the only invalidation condition updates course result for checkbox edits',()=>{const ui=fixture(),r=edit(ui,'enable.owner',false,{type:'checkbox'});assert.equal(ui.thesisDraft.conditions.length,0);assert(r.assessment.checks.some(c=>c.missing.includes('INVALIDATION')));});
check('select edits use the new symbol reference without changing explicit course assumptions',()=>{const r=edit(fixture(),'symbol','IBIT',{type:'select-one'});assert.match(r.input.expiryRef,/^IBIT /);assert.equal(r.input.direction,'BULLISH');assert.equal(r.assessment.executionAllowed,false);});
check('restoring the missing requirement updates the display from the current draft',()=>{const ui=fixture();edit(ui,'thesis.nextCheckAt','');const r=edit(ui,'thesis.nextCheckAt','2026-10-12T15:00:00Z');assert.equal(r.old.status,'INSUFFICIENT_EVIDENCE');assert.equal(r.assessment.status,'DECLARED_INPUTS_PRESENT_NOT_VERIFIED');assert.equal(r.assessment.paperAdmissionAllowed,false);});
check('a thesis editor without a course panel still updates and invalidates its freeze preview',()=>{const ui=fixture();edit(ui,'expiry','',{panelPresent:false});assert.equal(ui.thesisFields.expiry,'');});
check('programmatic draft replacement and later renders also assess current fields',()=>{const ui=fixture();assert.match(coursePlannerPanel(ui),/课程研究检查：DECLARED_INPUTS_PRESENT_NOT_VERIFIED/);ui.thesisDraft=thesisDefaults();const html=coursePlannerPanel(ui);assert.match(html,/课程研究检查：INSUFFICIENT_EVIDENCE/);assert.match(html,/REALIZATION_WINDOW/);assert.match(html,/INVALIDATION/);});
check('course recalculation uses no source, storage or trade action',()=>{const old=globalThis.fetch;globalThis.fetch=()=>assert.fail('no request during local course recalculation');try{const r=edit(fixture(),'condition.owner.invalidation','');assert.equal(r.assessment.sourceCalls,0);assert.equal(r.assessment.fileSystemWrites,0);assert.equal(r.assessment.fillsCreated,0);assert.equal(r.assessment.pnl,null);}finally{globalThis.fetch=old;}});
