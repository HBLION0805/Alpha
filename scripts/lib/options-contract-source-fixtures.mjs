// Fictional source documents for isolated tests only; never market acceptance.
import {contractSourceHash as hash} from './options-contract-source-binding.mjs';
export const fixtureAt='2026-10-12T17:10:00.000Z';
export function contractSourceFixture(){
 const selection=[['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','778.00'],['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','779.00']].map(([id,strike])=>({id,symbol:'SPY',expiry:'2026-10-16',type:'call',strike,multiplier:100,tradability:'tradable'}));
 const rows=selection.map((s,i)=>({...s,seriesId:'TEST_FIXTURE_ONLY_RETURNED_SERIES_'+i,components:[{kind:'EQUITY',symbol:'SPY',quantity:100,unit:'SHARES'}],settlement:'PHYSICAL',currency:'USD',exerciseStyle:'AMERICAN'}));
 const rawText=JSON.stringify({context:'TEST_FIXTURE_ONLY',rows});
 const doc={id:'instrument-original',origin:'SYNTHETIC_FIXTURE',representation:'ORIGINAL_PROVIDER_DATA',source:'TEST_FIXTURE_ONLY',sourceVersion:'synthetic-v1',publishedAt:null,observedAt:'2026-10-12T17:08:00.123456789Z',receivedAt:'2026-10-12T17:08:01.000Z',applicableFrom:'2026-10-12T17:00:00.000Z',applicableThrough:'2026-10-12T19:00:00.000Z',mediaType:'application/json',rawText,sha256:hash(rawText)};
 const identityFields=Object.fromEntries(['id','symbol','expiry','type','strike','multiplier','tradability','seriesId'].map(k=>[k,k]));
 const currentFields=Object.fromEntries(['id','symbol','expiry','type','strike','components','settlement','currency','exerciseStyle'].map(k=>[k,k]));
 return {version:'CONTRACT_SOURCE_BINDING_V1',context:'TEST_FIXTURE_ONLY',selection,originals:[doc],legs:selection.map((s,i)=>({id:s.id,route:'DIRECT_CURRENT_DELIVERABLE',identity:{sourceId:doc.id,pointer:'/rows/'+i,fields:{...identityFields}},current:{sourceId:doc.id,pointer:'/rows/'+i,fields:{...currentFields}},classRule:null})),productRule:null,review:{by:'TEST_FIXTURE_ONLY_REVIEWER',at:'2026-10-12T17:09:00.000Z',verdict:'PASS'},window:{from:fixtureAt,through:'2026-10-12T17:17:00.000Z'},conflicts:[]};
}
export function changeSource(p,id,fn){const d=p.originals.find(d=>d.id===id),v=JSON.parse(d.rawText);fn(v);d.rawText=JSON.stringify(v);d.sha256=hash(d.rawText);}
