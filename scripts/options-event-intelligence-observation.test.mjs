import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {deepStrictEqual,equal,throws} from 'node:assert/strict';
import {listEventObservations,saveEventObservation,verifyEventObservation} from './lib/options-event-intelligence-observation.mjs';

const root=mkdtempSync(join(tmpdir(),'alpha-event-observation-'));
const at='2026-10-02T01:55:00.000Z';
const evidence={
  evidenceId:'employment-reuters-consensus-20260930',eventId:'employment-situation-20261002',
  kind:'EXPECTATION_SNAPSHOT',sourceId:'reuters-survey',
  sourceUrl:'https://www.reuters.com/example',occurredAt:null,
  sourcePublishedAt:'2026-09-30T12:29:00.000Z',vendorReceivedAt:null,
  receivedAt:at,parsedAt:at,availability:'CURRENT',
  summary:'Reuters survey consensus captured prospectively by Alpha.',supersedesEvidenceId:null,
  expectationSnapshot:{stage:'RESEARCH',ownerConfirmed:false,rows:[{
    id:'payroll-reuters',metric:'TOTAL_NONFARM_PAYROLL_CHANGE',period:'2026-09',unit:'THOUSAND_JOBS',
    adjustment:'SA',releaseVersion:'INITIAL',valueMeaning:'MONTHLY_CHANGE',
    expectationType:'CONSENSUS',value:'90',selected:true,source:'Reuters survey of economists',
    sourcePublishedAt:'2026-09-30T12:29:00.000Z',sourceReceivedAt:at,
    methodology:'Reuters survey; sample count not stated.',sampleInfo:null
  }]},
  marketObservation:null
};
try{
  const saved=saveEventObservation(root,evidence,at);
  equal(saved.alreadyRecorded,false,'first save');
  const retry=saveEventObservation(root,structuredClone(evidence),at);
  equal(retry.alreadyRecorded,true,'identical retry');
  const listed=listEventObservations(root,evidence.eventId,at);
  equal(listed.length,1,'listed at receipt');
  deepStrictEqual(listed[0].evidence.expectationSnapshot.rows[0].value,'90','structured consensus preserved');
  equal(listEventObservations(root,evidence.eventId,'2026-10-02T01:54:59.999Z').length,0,'future evidence hidden');
  throws(()=>saveEventObservation(root,{...evidence,evidenceId:'late-copy'},'2026-10-02T01:56:00.000Z'),/NO_BACKFILL/,'backfill rejected');
  throws(()=>saveEventObservation(root,{...evidence,evidenceId:'bad-clock',expectationSnapshot:{...evidence.expectationSnapshot,rows:[{...evidence.expectationSnapshot.rows[0],sourceReceivedAt:'2026-10-02T01:56:00.000Z'}]}},at),/EXPECTATION_CLOCK/,'source learned later cannot enter earlier snapshot');
  const full=join(root,saved.path),body=JSON.parse(readFileSync(full,'utf8'));
  body.evidence.summary='changed';
  writeFileSync(full,JSON.stringify(body,null,2)+'\n');
  throws(()=>verifyEventObservation(root,full),/INTEGRITY/,'tampering rejected');
}finally{rmSync(root,{recursive:true,force:true});}
console.log('Event observation store tests passed');
