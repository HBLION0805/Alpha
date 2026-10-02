import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {equal} from 'node:assert/strict';
import {captureEmploymentWindow} from './options-event-intelligence-employment-window.mjs';
import {listEventObservations} from './lib/options-event-intelligence-observation.mjs';

const root=mkdtempSync(join(tmpdir(),'alpha-employment-window-'));
const at='2026-10-02T12:30:05.000Z';
const refreshNews=async()=>({status:'SAVED',executionAllowed:false});
const readNews=()=>({
  sources:[{id:'bls',status:'OK',observedAt:'2026-10-02T12:30:04.000Z',diagnostic:null,partial:false}],
  headlines:[{sourceId:'bls',itemId:'employment-release',link:'https://www.bls.gov/news.release/empsit.nr0.htm',
    headline:'Employment Situation — September 2026',publishedAt:'2026-10-02T12:30:00.000Z',observedAt:'2026-10-02T12:30:04.000Z'}]
});
const retrieveBtc=async()=>({
  input:{receivedAt:'2026-10-02T12:30:04.500Z'},
  assessment:{status:'OBSERVED_CONTEXT',receivedAt:'2026-10-02T12:30:04.500Z',usableAtReceipt:true,midpointUsd:'85000.005',
    book:{sourceTime:'2026-10-02T12:30:04.000Z'}}
});
const appendBtc=async()=>({status:'SAVED'});
try{
  const first=await captureEmploymentWindow({workspaceRoot:root,now:()=>at,refreshNews,readNews,retrieveBtc,appendBtc});
  equal(first.saved.length,3,'source status, headline and BTC are saved');
  equal(first.executionAllowed,false,'collector has no execution authority');
  const observations=listEventObservations(root,'employment-situation-20261002',at);
  equal(observations.length,3,'three immutable event observations');
  equal(observations.some(x=>x.evidence.kind==='SOURCE_OBSERVATION'),true,'BLS headline captured');
  equal(observations.some(x=>x.evidence.kind==='MARKET_OBSERVATION'),true,'BTC observation captured');
  const again=await captureEmploymentWindow({workspaceRoot:root,now:()=>at,refreshNews,readNews,retrieveBtc,appendBtc});
  equal(again.saved.length,0,'same slot is idempotent');
}finally{rmSync(root,{recursive:true,force:true});}
console.log('Employment event window collector tests passed');
