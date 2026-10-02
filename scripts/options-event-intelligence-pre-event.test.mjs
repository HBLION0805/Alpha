import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {deepStrictEqual, equal, throws} from 'node:assert/strict';
import {preparePreEventState,savePreEventState,verifyPreEventState} from './lib/options-event-intelligence-pre-event.mjs';

const at='2026-10-02T01:45:00.000Z';
const state={
  loadedAt:'2026-10-02T01:44:59.000Z',
  guidance:{state:'AVAILABLE',data:{
    current:{assets:[
      {symbol:'GLD',equity:{price:'380.76',sourceAt:'2026-10-02T01:44:50.000Z'},trend:{direction:'DOWN'},disposition:'WATCH',blockers:['A']},
      {symbol:'IBIT',equity:{price:'47.38',sourceAt:'2026-10-02T01:44:51.000Z'},trend:{direction:'UP'},disposition:'WATCH',blockers:[]}
    ]},
    interpretation:{path:'analysis.json',assessedAt:'2026-10-02T01:44:55.000Z',assets:[
      {symbol:'GLD',bias:'MIXED',summary:'gld',invalidation:'gld invalid'},
      {symbol:'IBIT',bias:'BULLISH',summary:'ibit',invalidation:'ibit invalid'}
    ]}
  }},
  focusedNews:{state:'AVAILABLE',data:{sources:[
    {id:'fed',status:'OK',observedAt:'2026-10-02T01:44:40.000Z',partial:false,diagnostic:null},
    {id:'coindesk',status:'FAILED',observedAt:'2026-10-02T01:44:42.000Z',partial:true,diagnostic:'HTTP_500'}
  ]}}
};

const snapshot=preparePreEventState(state,at);
equal(snapshot.assets.length,2,'two assets retained');
equal(snapshot.assets[0].attributedBias,'MIXED','attributed bias retained without promotion');
equal(snapshot.sources.length,2,'source health retained');
deepStrictEqual(snapshot.missingEvidence,[],'no missing evidence invented');
equal(snapshot.executionAllowed,false,'no execution authority');

const incomplete=preparePreEventState({loadedAt:at,guidance:{state:'MISSING'},focusedNews:{state:'MISSING'}},at);
equal(incomplete.missingEvidence.includes('GLD_IBIT_CURRENT_STATE_INCOMPLETE'),true,'missing asset state explicit');
equal(incomplete.missingEvidence.includes('FOCUSED_NEWS_STATE_UNAVAILABLE'),true,'missing news state explicit');
throws(()=>preparePreEventState({
  ...state,guidance:{...state.guidance,data:{...state.guidance.data,current:{assets:[
    {...state.guidance.data.current.assets[0],equity:{price:'380.76',sourceAt:'2026-10-02T01:45:01.000Z'}},
    state.guidance.data.current.assets[1]
  ]}}}
},at),/FUTURE_PRICE/,'future source cannot be backdated');

const root=mkdtempSync(join(tmpdir(),'alpha-pre-event-'));
try{
  const saved=savePreEventState(root,state,at,{id:'12345678'});
  equal(saved.executionAllowed,false,'saved snapshot stays read only');
  const full=join(root,saved.path);
  const first=readFileSync(full,'utf8');
  const verified=verifyPreEventState(root,full);
  equal(verified.snapshot.recordedAt,at,'recording clock retained');
  throws(()=>savePreEventState(root,state,at,{id:'12345678'}),/EXISTS/,'immutable path cannot overwrite');

  const changed=JSON.parse(first);
  changed.snapshot.assets[0].price='999';
  writeFileSync(full,JSON.stringify(changed,null,2)+'\n');
  throws(()=>verifyPreEventState(root,full),/INTEGRITY/,'tampering fails');
}finally{rmSync(root,{recursive:true,force:true});}

console.log('Pre-event state recorder tests passed');
