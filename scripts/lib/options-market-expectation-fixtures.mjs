import {basename} from 'node:path';
import {createWorkbenchData} from './options-workbench-data.mjs';
import {sourcePlanOptions,prepareSourcePackage,receiveSourceDraft,previewSourceComparison,saveSourceComparison} from './options-source-comparison.mjs';
import {previewExpectation,saveExpectation} from './options-market-expectation-io.mjs';
import {thesisDefaults,conditionDefaults,eventEntryDefaults} from '../../apps/options-workbench/trade-thesis.js';
import {registerDefaults} from '../../apps/options-workbench/forms.js';
import {paperFingerprint as fp} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';

export const expectationAt='2026-09-08T13:00:00.000Z',expectationRelease='2026-09-09T12:30:00.000Z';
export const expectationLater=n=>new Date(Date.parse(expectationAt)+n*1000).toISOString();
export function expectationIdentity(eventKey='test-employment'){return {eventKey,metric:'PAYROLLS',period:'2026-08',unit:'THOUSAND_JOBS',adjustment:'SA',releaseVersion:'INITIAL',valueMeaning:'MONTHLY_CHANGE'};}
export function expectationRows(eventKey='test-employment'){
  const subject=expectationIdentity(eventKey);
  return [{id:'payrolls',subject,selectedConsensusId:'survey-one',forecasts:[{...subject,id:'survey-one',type:'CONSENSUS',value:'100',source:'Isolated survey fixture',url:'https://example.com/survey',reference:'test-package',locator:'isolated row one',publishedAt:expectationAt,receivedAt:expectationAt,coverage:'Isolated fixture; no production data.',methodology:'Source declares survey median of a synthetic panel; not Alpha aggregation.',consensusBasis:'SOURCE_SURVEY'}],alpha:{...subject,value:'80',qualitative:'UNKNOWN',attribution:'OWNER',basis:'Isolated lower forecast, not production judgment.'}}];
}
export function expectationPlan(){
  const condition={...conditionDefaults('OWNER_CONFIRMED','owner'),basis:'Synthetic necessary event premise',checkAt:expectationRelease,missingAction:'Owner verifies official release',eventKey:'test-employment',releaseAt:expectationRelease,source:'https://www.bls.gov/test',invalidation:'Owner checks the sourced reverse scenario'};
  const thesis={...thesisDefaults(),tradeDate:'2026-09-08',holdThroughEvent:'YES',nextCheckAt:'2026-09-09T13:30:00.000Z',realizationStartAt:expectationRelease,realizationEndAt:'2026-09-09T19:00:00.000Z',manualFallback:'Owner checks manually, no automatic monitoring',conditions:[condition],eventEntry:{...eventEntryDefaults(),phase:'PRE_EVENT',conditionId:'owner',calendarVerifiedAt:expectationAt,calendarSource:'https://www.bls.gov/test',expectationStatus:'AVAILABLE',expectationBasis:'Isolated survey fixture',differenceBasis:'Lower synthetic payroll forecast',supportingScenario:'Lower',neutralScenario:'Inline',reverseScenario:'Higher',counterexample:'Rates move in the opposite direction',reviewer:'Fixture Owner',gapRiskAccepted:true,closedMarketRiskAccepted:true}};
  return {declaredAt:expectationLater(70),maxContracts:1,maxEntryDebitUsd:'100.00',plannedRiskUsd:'20.00',targetNetProfitUsd:'40.00',stopPremiumUsd:'0.80',entryDeadlineAt:'2026-09-08T19:50:00.000Z',timeExitAt:'2026-09-09T19:00:00.000Z',thesis:'Isolated original pre-event thesis',invalidation:thesis};
}
export async function seedExpectation(root,{ledgerId='synthetic-expectation',plan=expectationPlan(),at=expectationLater(1)}={}){
  if(!/^alpha-(?:expectation|candidate)-test-/.test(basename(root)))throw Error('ISOLATED_FIXTURE_REQUIRED');
  let clock=at;const service=createWorkbenchData({workspaceRoot:root,ledgerId,now:()=>clock});service.initialize();
  const c=plan.invalidation.conditions.find(c=>c.eventKey),fields={...registerDefaults(),tradeId:'synthetic-event-plan',symbol:'GLD',optionType:'',thesis:plan.thesis};
  const command={type:'SAVE_PLAN_DRAFT',requestId:'expectation-draft',tradeId:fields.tradeId,draft:{fields,thesis:structuredClone(plan.invalidation)}};
  const preview=service.preview(command);service.save({command,expectedHeadSha256:preview.headSha256});
  const p=sourcePlanOptions(preview.report).find(p=>p.key==='draft:expectation-draft');
  const material={id:'test-material',title:'Isolated survey',text:'Synthetic survey payroll consensus is 100 thousand jobs.',source:'Isolated fixture',url:'https://example.com/survey',publishedAt:expectationAt,receivedAt:expectationAt,availableAt:expectationAt,language:'en',coverage:'EXCERPT',attribution:'SOURCE_PUBLISHER',reference:'synthetic',locator:'row one',upstream:'UNKNOWN',eventIdentity:'UNCONFIRMED'};
  const pkg=prepareSourcePackage(root,ledgerId,{id:'expectation-package',eventKey:c.eventKey,materialIds:[material.id],asOf:at},{events:[{key:c.eventKey,title:'Synthetic event',source:'BLS',scheduledAt:c.releaseAt,receivedAt:expectationAt}],materials:[material]},at);
  const draft=receiveSourceDraft(root,{id:'expectation-source-draft',packagePath:pkg.path,generatedAt:at,generator:{kind:'HOST_AI',name:'Isolated fixture',model:'NONE',calls:1,costUsd:'UNKNOWN'},statements:[{id:'survey-value',text:material.text,stage:'UNCLASSIFIED',citations:[{materialId:material.id,quote:material.text,locator:'row one',translation:null}]}],interpretations:[],relations:[],gaps:[],relevance:[],facts:[],lineage:[]},at);
  const request={id:'expectation-comparison',draftPath:draft.path,reviewedClaims:[],bindings:[],supersedes:'',note:'Isolated attributed survey; no actual value'};
  const cp=previewSourceComparison(root,ledgerId,request,at),comparison=saveSourceComparison(root,ledgerId,request,cp.previewFingerprint,at);
  const snapshotRequest={id:'expectation-research',stage:'RESEARCH',supersedes:'',planKey:p.key,planVersion:p.version,comparisonPath:comparison.path,comparisonFingerprint:comparison.fingerprint,eventKey:c.eventKey,releaseAt:c.releaseAt,rows:expectationRows(c.eventKey),note:'Isolated fixture',ownerConfirmed:false};
  return {service,ledgerId,plan,p,comparison,request:snapshotRequest,setClock:v=>clock=v,
    save:(request=snapshotRequest,time=expectationLater(10))=>{const preview=previewExpectation(root,ledgerId,request,time);return saveExpectation(root,ledgerId,request,preview.previewFingerprint,time);}};
}
