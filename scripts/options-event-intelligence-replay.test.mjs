import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eventIntelligenceCatalog, eventIntelligenceReplay } from './lib/options-event-intelligence-replay.mjs';

const equal=(a,b,m)=>{if(!Object.is(a,b))throw Error(m+': '+String(a)+' !== '+String(b));};
const deep=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(m+': '+JSON.stringify(a)+' !== '+JSON.stringify(b));};

const root=mkdtempSync(join(tmpdir(),'alpha-event-intelligence-'));
const base=join(root,'data','runtime','options-event-intelligence','cases');
mkdirSync(base,{recursive:true});

const ev=(id,kind,receivedAt)=>({
  evidenceId:id,eventId:'scheduled-demo',kind,sourceId:'fixture',sourceUrl:null,
  occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,receivedAt,parsedAt:receivedAt,
  availability:'CURRENT',summary:id,supersedesEvidenceId:null,
  expectationSnapshot:kind==='EXPECTATION_SNAPSHOT'?{stage:'RESEARCH',ownerConfirmed:false,rows:[{
    id:'consensus-test',metric:'TEST_METRIC',period:'2026-09',unit:'COUNT',adjustment:'SA',
    releaseVersion:'INITIAL',valueMeaning:'LEVEL',expectationType:'CONSENSUS',value:'1',selected:true,
    source:'test',sourcePublishedAt:null,sourceReceivedAt:receivedAt,methodology:'test',sampleInfo:null
  }]}:null,
  marketObservation:kind==='MARKET_OBSERVATION'?{
    instrument:'GLD',quoteObservedAt:receivedAt,declaredDelayMs:null,session:'REGULAR',
    comparability:'LIMITED',comparabilityReason:'Test observation keeps provider delay unknown.'
  }:null
});
const value={
  eventId:'scheduled-demo',caseType:'SCHEDULED',title:'Scheduled demo',
  eventTime:'2026-10-01T12:30:00.000Z',createdAt:'2026-10-01T12:00:00.000Z',
  evidence:[
    ev('before','EXPECTATION_SNAPSHOT','2026-10-01T12:20:00.000Z'),
    ev('release','SOURCE_OBSERVATION','2026-10-01T12:30:00.500Z')
  ],
  historicalDecisions:[{
    decisionId:'d1',eventId:'scheduled-demo',generatedAt:'2026-10-01T12:30:01.000Z',
    evidenceCutoffAt:'2026-10-01T12:30:00.600Z',inputEvidenceIds:['before','release'],
    decisionVersion:'d-v1',ruleVersion:'r1',modelVersion:'m1',thesisVersion:'t1',thesisState:'MAINTAIN',
    evidenceCompleteness:'COMPLETE',reason:'fixture',blockers:[]
  }],
  recomputedDecisions:[],invalidationRules:[],requiredEvidenceIds:['before','release']
};
writeFileSync(join(base,'scheduled-demo.json'),JSON.stringify(value,null,2)+'\n');

try{
  const catalog=eventIntelligenceCatalog(root,'2026-10-01T12:30:02.000Z');
  equal(catalog.cases.length,1,'catalog count');
  equal(catalog.cases[0].currentView.thesisState,'MAINTAIN','current thesis');
  const early=eventIntelligenceReplay(root,'scheduled-demo','2026-10-01T12:30:00.250Z');
  deep(early.visibleEvidence.map(x=>x.evidenceId),['before'],'future release hidden');
  equal(early.visibleHistoricalDecisions.length,0,'future decision hidden');
  equal(early.evidenceCompleteness,'PARTIAL','partial before release');
  console.log('Event intelligence IO tests passed');
} finally { rmSync(root,{recursive:true,force:true}); }
