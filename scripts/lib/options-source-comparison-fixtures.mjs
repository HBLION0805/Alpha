import {mkdirSync,writeFileSync} from 'node:fs';
import {join,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {seedPositionWatch,watchClock as at,watchCommands,watchId} from './options-position-watch-fixtures.mjs';
import {conditionDefaults,thesisDefaults} from '../../apps/options-workbench/trade-thesis.js';
import {createWorkbenchData} from './options-workbench-data.mjs';
import {macroCatalog} from '../../src/engines/options-knowledge/MacroKnowledgeCatalog.ts';
import {saveMacroNote} from './options-macro-playbook-io.mjs';
export const comparisonLedger='synthetic-source-links';
export async function seedSourceComparison(root){
  if(!basename(root).startsWith('alpha-position-watch-'))throw Error('ISOLATED_FIXTURE_REQUIRED');
  await seedPositionWatch(root);const base=join(root,'data/runtime/options-manual-ledger',comparisonLedger);mkdirSync(base,{recursive:true});
  writeFileSync(join(base,'manifest.json'),JSON.stringify({version:'OPTIONS_MANUAL_LEDGER_STORE_V1',ledgerId:comparisonLedger,origin:'SYNTHETIC_FIXTURE',createdAt:at(-200),executionAllowed:false},null,2)+'\n');
  let clock=at(-100);const service=createWorkbenchData({workspaceRoot:root,ledgerId:comparisonLedger,now:()=>clock});
  const condition={...conditionDefaults('EVENT_NUMERIC','event'),basis:'Synthetic CPI release condition',checkAt:at(0),missingAction:'Verify exact original release manually',eventKey:'test-cpi',metric:'CPI_MOM_SA',period:'2026-08',unit:'PERCENT',releaseVersion:'INITIAL',releaseAt:at(0),expectationRef:'synthetic-expectation',expectationValue:'0.2',source:'https://www.bls.gov/test',comparator:'AT_OR_ABOVE',threshold:'0.4'};
  const commands=watchCommands();commands[0].plan.invalidation={...thesisDefaults(),decisionId:'synthetic-decision',tradeDate:'2026-09-08',realizationStartAt:at(-20),realizationEndAt:at(3000),nextCheckAt:at(0),holdThroughEvent:'YES',manualFallback:'Inspect source manually',conditions:[condition]};
  for(const [i,c] of commands.entries()){clock=at(i===0?-100:0);const p=service.preview(c);service.save({command:c,expectedHeadSha256:p.headSha256});}
  saveMacroNote(root,{requestId:randomUUID(),phase:'REVIEW_NOTE',symbol:'GLD',title:'Isolated CPI release excerpt',originalPlanRef:'',answers:Object.fromEntries(macroCatalog().fields.map(f=>[f.id,''])),process:'UNKNOWN',outcome:'UNKNOWN',reviewEvidence:'Synthetic CPI: 0.5 percent month-on-month, seasonally adjusted, August 2026, initial release.',personalNote:'Isolated test material only.'},at(0));
  return {service,setClock:v=>clock=v,condition,tradeId:watchId};
}
export function sourceDraftFixture(p,id='draft-one'){
  const m=p.payload.materials[0],citation={materialId:m.id,quote:m.text.split('\n')[0],locator:m.locator,translation:null};
  return {id,packagePath:p.path,generatedAt:at(3),generator:{kind:'HOST_AI',name:'Injected isolated Host fixture',model:'SYNTHETIC_NOT_A_MODEL_CALL',calls:1,costUsd:'UNKNOWN'},
    statements:[{id:'claim-one',text:'The supplied excerpt reports a CPI value of 0.5 percent.',stage:'FORMAL_DOCUMENT',citations:[citation]}],
    interpretations:[{authorKind:'HOST_AI',attribution:'Injected fixture',text:'A rate response is hypothetical; the excerpt does not prove ETF repricing.',horizon:'Original plan only',citations:[citation]}],
    relations:[],gaps:[{kind:'SEMANTIC_REVIEW',text:'Owner supplied; original release has not been machine authenticated.',citations:[]}],
    relevance:[{symbol:'GLD',text:'Compare only the frozen CPI condition.',neededEvidence:'Exact release identity and explicit Owner confirmation; independent ETF quote.',citations:[citation]}],
    facts:[{claimId:'claim-one',eventKey:'test-cpi',metric:'CPI_MOM_SA',period:'2026-08',unit:'PERCENT',releaseVersion:'INITIAL',value:'0.5',source:'https://www.bls.gov/test',sourceAt:at(0),receivedAt:at(0)}],
    lineage:[{materialId:m.id,relationship:'UNKNOWN',upstreamRef:'',note:'Source chain not independently verified.'}]};
}
