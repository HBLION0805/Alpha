import assert from 'node:assert/strict';
import {validateHostResult,classifyPaperObservation} from './lib/options-real-data-paper-capture.mjs';

const contract={id:'00000000-0000-0000-0000-000000000010',chainId:'00000000-0000-0000-0000-000000000099',symbol:'IBIT',expiry:'2026-10-30',type:'put',strike:'50.0000',multiplier:100};
const startedAt='2026-10-08T14:00:31.000Z',capturedAt='2026-10-08T14:00:32.000Z';
const receipts=[{tool:'get_option_chains',request:{underlying_symbol:'IBIT'},requestedAt:startedAt,receivedAt:capturedAt,response:{data:{chains:[]}}}];
const attempt={version:'OPTIONS_PAPER_CAPTURE_ATTEMPT_V1',contract,startedAt,capturedAt,calls:1,receipts,failures:[],accountAccessed:false,executionAllowed:false};
const capture={version:'OPTIONS_GUIDANCE_MARKET_CAPTURE_V1',origin:'HOST_MARKET_TOOL_RESPONSES',startedAt,capturedAt,calls:1,receipts,failures:[],selectedIds:[contract.id],selection:'exact',accountAccessed:false,executionAllowed:false};
const value={status:'CAPTURED',capture,attempt};
assert.equal(validateHostResult(value).status,'CAPTURED');
assert.throws(()=>validateHostResult({...value,attempt:{...attempt,accountAccessed:true}}),/ATTEMPT/);
assert.throws(()=>validateHostResult({...value,attempt:{...attempt,receipts:[{...receipts[0],tool:'get_account'}]}}),/TOOL_SCOPE/);
assert.throws(()=>validateHostResult({...value,capture:{...capture,selectedIds:['00000000-0000-0000-0000-000000000011']}}),/CAPTURE_BINDING/);
assert.equal(validateHostResult({status:'NO_CAPTURE',capture:null,attempt:{...attempt,failures:[{tool:'PAPER_CAPTURE',code:'EXACT_CONTRACT_NOT_FOUND'}]}}).status,'NO_CAPTURE');

assert.deepEqual(classifyPaperObservation({results:[]}),{outcomeLabel:'OBSERVING',engineeringAcceptance:'PENDING',paperStatus:null,paperStage:null});
assert.equal(classifyPaperObservation({results:[{status:'OPEN_UNRESOLVED',paperStage:'OPEN_UNRESOLVED'}]}).outcomeLabel,'PAPER_FILLED');
assert.equal(classifyPaperObservation({results:[{status:'CLOSED_MODELED',paperStage:'CLOSED_MODELED'}]}).engineeringAcceptance,'POSITION_AND_EXIT_PATH_COMPLETED');
const no=classifyPaperObservation({results:[{status:'NO_ENTRY',paperStage:'ENTRY_WINDOW_ENDED'}]});assert.equal(no.outcomeLabel,'NO_TRADE_VALID');assert.equal(no.engineeringAcceptance,'NON_TRADE_PATH_PASSED_ONLY');
const fail=classifyPaperObservation({results:[{error:'SNAPSHOT_PAPER_X'}]});assert.equal(fail.outcomeLabel,'SYSTEM_FAILURE');assert.equal(fail.engineeringAcceptance,'FAILED');

console.log('Real-data paper capture adapter tests passed');
