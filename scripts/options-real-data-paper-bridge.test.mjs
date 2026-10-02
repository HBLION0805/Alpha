import assert from 'node:assert/strict';
import {selectEngineeringReference,buildEngineeringPaperPreview,ENGINEERING_POLICY_VERSION} from './lib/options-real-data-paper-bridge.mjs';

const at='2026-10-08T14:00:00.000Z';
const contract=(type='put',id='00000000-0000-0000-0000-000000000010')=>({id,symbol:'IBIT',expiry:'2026-10-30',type,strike:type==='put'?'50.0000':'51.0000',multiplier:100,bidCents:type==='put'?116:120,askCents:type==='put'?118:122,tickCents:1,bidSize:30,askSize:40,delta:type==='put'?-0.45:0.46,updatedAt:'2026-10-08T13:59:40.000Z',receivedAt:'2026-10-08T13:59:41.000Z'});
const decision=()=>({identity:'a'.repeat(64),executionAllowed:false,issuedAt:'2026-10-08T13:59:50.000Z',provenance:{capture:{path:'data/runtime/options-daily-guidance/captures/2026-10-08/capture.json',capturedAt:'2026-10-08T13:59:30.000Z'}},candidates:[
 {symbol:'GLD',trendObservation:{direction:'DOWN'},referenceContracts:[]},
 {symbol:'IBIT',trendObservation:{direction:'DOWN'},referenceContracts:[{contract:contract('put'),chosenTrade:false},{contract:contract('call','00000000-0000-0000-0000-000000000011'),chosenTrade:false}]}
]});
const frame=()=>({path:'data/runtime/options-daily-guidance/captures/2026-10-08/capture.json',origin:'HOST_MARKET_TOOL_RESPONSES',quotes:[{...contract('put'),chainSession:{chainId:'00000000-0000-0000-0000-000000000099',lateCloseState:'enabled',receivedAt:'2026-10-08T13:59:20.000Z'},underlyingPriceUsd:'50.50',underlyingAt:'2026-10-08T13:59:39.000Z',underlyingPriceCents:5050,aboveTickCents:5,belowTickCents:1,cutoffCents:300}]});
assert.equal(selectEngineeringReference(decision(),at).status,'REFERENCE_SELECTED');
assert.equal(selectEngineeringReference(decision(),at).selected.contract.type,'put');
const stale=decision();stale.provenance.capture.capturedAt='2026-10-08T13:55:00.000Z';assert.deepEqual(selectEngineeringReference(stale,at).blockers,['DECISION_EVIDENCE_STALE']);
const range=decision();range.candidates[1].trendObservation.direction='RANGE';assert.equal(selectEngineeringReference(range,at).status,'NO_TRADE_VALID');

const preview=buildEngineeringPaperPreview({decisionEvidence:decision(),frames:[frame()],settings:{tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2'}},at});
assert.equal(preview.status,'READY_TO_ARM');
assert.equal(preview.strategyValidationEligible,false);
assert.equal(preview.policyVersion,ENGINEERING_POLICY_VERSION);
assert.equal(preview.selectedContract.type,'put');
assert.equal(preview.request.entryLimitCents,118);
assert.equal(preview.request.quantity,1);
assert.equal(preview.request.feeBasis,'ROBINHOOD_REVIEWED_20260910');
assert.equal(preview.request.modelVersion,'V3');
assert.equal(preview.request.exitSlippageCents,1);
assert.equal(preview.request.maxSpreadCents,10);
assert.equal(preview.request.decisionAt,'2026-10-08T14:00:30.000Z');
assert.equal(preview.request.entryDeadlineAt,'2026-10-08T14:02:30.000Z');
assert.equal(preview.request.timeExitAt,'2026-10-08T14:07:30.000Z');
assert.equal(preview.fillPolicy.entry,'LATER_ASK_AT_OR_BELOW_FROZEN_LIMIT');

const mismatch=frame();mismatch.quotes[0].askCents=119;assert.deepEqual(buildEngineeringPaperPreview({decisionEvidence:decision(),frames:[mismatch],settings:{tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2'}},at}).blockers,['DECISION_QUOTE_SOURCE_MISMATCH']);
const synthetic=frame();synthetic.origin='SYNTHETIC_FIXTURE';assert.deepEqual(buildEngineeringPaperPreview({decisionEvidence:decision(),frames:[synthetic],settings:{tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2'}},at}).blockers,['REAL_HOST_SELECTION_FRAME_MISSING']);
const late='2026-10-08T20:10:00.000Z';const d2=decision();d2.issuedAt='2026-10-08T20:09:50.000Z';d2.provenance.capture.capturedAt='2026-10-08T20:09:40.000Z';for(const r of d2.candidates[1].referenceContracts){r.contract.updatedAt='2026-10-08T20:09:45.000Z';r.contract.receivedAt='2026-10-08T20:09:46.000Z';}
const f2=frame();f2.path=d2.provenance.capture.path;f2.quotes[0].updatedAt='2026-10-08T20:09:45.000Z';f2.quotes[0].receivedAt='2026-10-08T20:09:46.000Z';assert.equal(buildEngineeringPaperPreview({decisionEvidence:d2,frames:[f2],settings:{tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2'}},at:late}).status,'NO_TRADE_VALID');

console.log('Real-data paper bridge tests passed');
