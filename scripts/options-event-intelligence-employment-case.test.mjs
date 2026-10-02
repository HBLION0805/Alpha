import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {equal} from 'node:assert/strict';
import {savePreEventState} from './lib/options-event-intelligence-pre-event.mjs';
import {saveEventObservation} from './lib/options-event-intelligence-observation.mjs';
import {materializeEmploymentCase,saveEmploymentCase} from './lib/options-event-intelligence-employment-case.mjs';

const root=mkdtempSync(join(tmpdir(),'alpha-employment-case-'));
const preAt='2026-10-02T12:20:00.000Z';
const state={loadedAt:preAt,guidance:{state:'AVAILABLE',data:{current:{assets:[
  {symbol:'GLD',equity:{price:'400',sourceAt:'2026-10-02T12:19:59.000Z'},trend:{direction:'UP'},disposition:'WATCH',blockers:[]},
  {symbol:'IBIT',equity:{price:'50',sourceAt:'2026-10-02T12:19:59.000Z'},trend:{direction:'UP'},disposition:'WATCH',blockers:[]}
]},interpretation:{path:'a',assessedAt:'2026-10-02T12:19:58.000Z',assets:[
  {symbol:'GLD',bias:'MIXED',summary:'g',invalidation:'x'},{symbol:'IBIT',bias:'MIXED',summary:'i',invalidation:'x'}
]}}},focusedNews:{state:'AVAILABLE',data:{sources:[{id:'bls',status:'OK',observedAt:'2026-10-02T12:19:57.000Z',partial:false,diagnostic:null}]}}};
const expectation={
 evidenceId:'employment-expectation-test',eventId:'employment-situation-20261002',kind:'EXPECTATION_SNAPSHOT',
 sourceId:'alpha-expectation-snapshot',sourceUrl:null,occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,
 receivedAt:'2026-10-02T12:21:00.000Z',parsedAt:'2026-10-02T12:21:00.000Z',availability:'CURRENT',
 summary:'test expectation',supersedesEvidenceId:null,marketObservation:null,
 expectationSnapshot:{stage:'RESEARCH',ownerConfirmed:false,rows:[{
   id:'payroll',metric:'TOTAL_NONFARM_PAYROLL_CHANGE',period:'2026-09',unit:'THOUSAND_JOBS',adjustment:'SA',
   releaseVersion:'INITIAL',valueMeaning:'MONTHLY_CHANGE',expectationType:'CONSENSUS',value:'90',selected:true,
   source:'Reuters',sourcePublishedAt:'2026-09-30T12:29:00.000Z',sourceReceivedAt:'2026-10-02T12:21:00.000Z',
   methodology:'survey',sampleInfo:null
 }]}
};
const market={evidenceId:'employment-btc-test',eventId:'employment-situation-20261002',kind:'MARKET_OBSERVATION',
 sourceId:'coinbase-btc-context',sourceUrl:null,occurredAt:'2026-10-02T12:20:59.000Z',sourcePublishedAt:null,vendorReceivedAt:null,
 receivedAt:'2026-10-02T12:21:00.000Z',parsedAt:'2026-10-02T12:21:00.000Z',availability:'CURRENT',summary:'btc',
 supersedesEvidenceId:null,expectationSnapshot:null,
 marketObservation:{instrument:'BTC-USD',quoteObservedAt:'2026-10-02T12:20:59.000Z',declaredDelayMs:null,session:'TWENTY_FOUR_SEVEN',comparability:'COMPARABLE',comparabilityReason:'test'}
};
try{
 savePreEventState(root,state,preAt,{id:'12345678'});
 saveEventObservation(root,expectation,expectation.receivedAt);
 saveEventObservation(root,market,market.receivedAt);
 const pre=materializeEmploymentCase(root,'2026-10-02T12:25:00.000Z');
 equal(pre.evidence.some(x=>x.kind==='PRE_EVENT_STATE'),true,'pre-state included');
 equal(pre.evidence.some(x=>x.evidenceId==='employment-release-observation-pending'),true,'release gap explicit');
 equal(pre.requiredEvidenceIds.length,4,'four acceptance evidence requirements');
 const saved=saveEmploymentCase(root,'2026-10-02T12:25:00.000Z');
 equal(saved.executionAllowed,false,'materialized case read-only');
 const release={evidenceId:'employment-bls-release',eventId:'employment-situation-20261002',kind:'SOURCE_OBSERVATION',
   sourceId:'bls',sourceUrl:'https://www.bls.gov/news.release/empsit.nr0.htm',occurredAt:null,
   sourcePublishedAt:'2026-10-02T12:30:00.000Z',vendorReceivedAt:null,receivedAt:'2026-10-02T12:30:05.000Z',
   parsedAt:'2026-10-02T12:30:05.000Z',availability:'CURRENT',summary:'release',supersedesEvidenceId:null,
   expectationSnapshot:null,marketObservation:null};
 saveEventObservation(root,release,release.receivedAt);
 const post=materializeEmploymentCase(root,'2026-10-02T12:31:00.000Z');
 equal(post.evidence.some(x=>x.evidenceId==='employment-release-observation-pending'),false,'real release replaces materialized gap');
 equal(post.requiredEvidenceIds.includes('employment-bls-release'),true,'real release becomes required');
}finally{rmSync(root,{recursive:true,force:true});}
console.log('Employment case materializer tests passed');
