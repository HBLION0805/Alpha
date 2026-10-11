import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {runOptionsStructuresCommand as run} from './options-structures.mjs';
import {structureComparisonFixture} from '../src/engines/options-structure-comparison/OptionsStructureComparisonFixtures.ts';
import {readinessFingerprint} from '../src/engines/options-readiness/OptionsReadinessEngine.ts';

const at='2026-10-11T16:00:00.000Z';
const fields={direction:'BULLISH',magnitude:'Declared 3 percent move',thesisRef:'research-thesis-v1',
  realizationFrom:'2026-10-12T14:00:00Z',realizationThrough:'2026-10-15T15:00:00Z',timeExitAt:'2026-10-15T19:00:00Z',
  ivHistoryRef:'saved-iv-series-v1',realizedVolRef:'saved-rv-series-v1',ivHypothesis:'IV could decline',ivComparisonReview:'Same declared window; provenance unverified',
  rationale:'Compare defined debit risk',alternative:'No trade',counterexample:'Direction right but move too small',
  entry:'Wait for explicit confirmation',invalidation:'Thesis evidence contradicted',priceExit:'Declared price exit',nextCheckAt:'2026-10-12T15:00:00Z',
  fallback:'Manual review after interruption',eventDecision:'Exit before event',ownerPolicyRef:'declared-policy-v1',planAssumptionsRef:'declared-plan-v1',positionsRef:'declared-positions-v1',greeksRef:'declared-greeks-v1'};
function fixture(work){
  const parent=fs.realpathSync(tmpdir()),root=fs.mkdtempSync(join(parent,'alpha-structure-course-'));
  const input=structureComparisonFixture(),options={workspaceRoot:root,now:()=>at};
  fs.writeFileSync(join(root,'math.json'),JSON.stringify(input));
  const record=(candidate=input.candidates[0])=>({recordId:'research:'+candidate.candidateId,recordVersion:'review-v1',recordedAt:at,
    comparisonId:input.comparisonId,candidateId:candidate.candidateId,comparisonInputFingerprint:readinessFingerprint(input),fields:{...fields}});
  const write=records=>{const text=JSON.stringify({version:'OPTIONS_STRUCTURE_COURSE_RESEARCH_V1',records});fs.writeFileSync(join(root,'research.json'),text);return text;};
  const preview=()=>run(['--course-preview','--input','math.json','--course-research','research.json'],options);
  try{work({root,input,options,record,write,preview});}
  finally{const rel=relative(parent,fs.realpathSync(root));assert(!isAbsolute(rel)&&rel.startsWith('alpha-structure-course-')&&!rel.includes('..'));fs.rmSync(root,{recursive:true,force:true});}
}
const find=(assessment,id)=>assessment.checks.find(c=>c.id===id);

test('bound research reaches all eight structures while original mathematics and input bytes remain identical',()=>fixture(({root,input,options,record,write,preview})=>{
  const original=run(['--input','math.json'],options),mathBytes=fs.readFileSync(join(root,'math.json'));
  const records=input.candidates.map(c=>{const r=record(c);r.fields.direction=c.structure.startsWith('BEAR')||c.structure==='LONG_PUT'?'BEARISH':c.structure.startsWith('LONG_STR')?'LARGE_MOVE':'BULLISH';return r;});
  const text=write(records),before=fs.readdirSync(root);const fetch=globalThis.fetch;globalThis.fetch=()=>assert.fail('unexpected network');
  let result;try{result=preview();}finally{globalThis.fetch=fetch;}
  assert.equal(JSON.stringify(result.original),JSON.stringify(original));assert.deepEqual(fs.readFileSync(join(root,'math.json')),mathBytes);
  assert.equal(fs.readFileSync(join(root,'research.json'),'utf8'),text);assert.deepEqual(fs.readdirSync(root),before);
  assert.equal(result.researchSource.sha256,createHash('sha256').update(text).digest('hex'));assert.equal(result.researchSource.verification,'DECLARED_RESEARCH_NOT_AUTHENTICATED');
  assert.equal(result.courseAssessments[0].candidates.length,8);
  for(const [n,c] of result.courseAssessments[0].candidates.entries()){
    assert.equal(c.researchBinding.recordId,records[n].recordId);assert.equal(c.researchBinding.recordVersion,'review-v1');
    assert.equal(c.researchInput.direction,records[n].fields.direction);assert.equal(c.assessment.status,'DECLARED_INPUTS_PRESENT_NOT_VERIFIED');
    assert.equal(c.assessment.ivClassification,'UNKNOWN');assert.equal(c.assessment.paperAdmissionAllowed,false);
  }
  assert.equal(result.fileSystemWrites,0);assert.equal(result.sourceCalls,0);assert.equal(result.admissionEffect,'NONE');
}));

test('candidate-specific direction and realization contradictions affect research only; unbound candidates stay missing',()=>fixture(({record,write,preview})=>{
  const r=record();r.fields.direction='BEARISH';r.fields.realizationThrough='2026-10-16T15:00:00Z';write([r]);
  const a=preview();assert.equal(find(a.courseAssessments[0].candidates[0].assessment,'STRUCTURE_RATIONALE').status,'RESEARCH_MISMATCH');
  assert.equal(find(a.courseAssessments[0].candidates[0].assessment,'REALIZATION_AND_EXIT').status,'RESEARCH_MISMATCH');
  const unbound=a.courseAssessments[0].candidates[1];assert.equal(unbound.researchBinding,null);assert(find(unbound.assessment,'DIRECTION_MAGNITUDE').missing.includes('DIRECTION'));
  r.fields={};r.recordVersion='review-v2';write([r]);const b=preview();assert.deepEqual(a.original,b.original);assert.equal(b.courseAssessments[0].candidates[0].researchBinding.recordVersion,'review-v2');
  assert(find(b.courseAssessments[0].candidates[0].assessment,'VOLATILITY_CONTEXT').missing.includes('IV_HISTORY_REFERENCE'));
}));

test('wrong comparison, candidate, or original input fingerprint cannot attach research by structure alone',()=>fixture(({input,record,write,preview,root})=>{
  for(const change of [r=>{r.comparisonId='wrong';},r=>{r.candidateId='unknown';},r=>{r.comparisonInputFingerprint='wrong';}]){
    const r=record();change(r);write([r]);assert.throws(preview,/COURSE_RESEARCH_BINDING/);
  }
  write([record()]);input.referencePriceCents++;fs.writeFileSync(join(root,'math.json'),JSON.stringify(input));assert.throws(preview,/COURSE_RESEARCH_BINDING/);
}));

test('record identity, version, clock and duplicate candidate bindings are explicit and fail closed',()=>fixture(({input,record,write,preview})=>{
  for(const change of [r=>{delete r.recordId;},r=>{r.recordVersion='';},r=>{r.recordedAt='2026-02-30T00:00:00.000Z';},r=>{r.recordedAt='2026-10-11T16:00:01.000Z';}]){
    const r=record();change(r);write([r]);assert.throws(preview,/COURSE_RESEARCH_SCHEMA|OPTIONS_READINESS_CLOCK|COURSE_RESEARCH_FUTURE_RECORD/);
  }
  const r=record();write([r,{...r,recordId:'another'}]);assert.throws(preview,/COURSE_RESEARCH_DUPLICATE/);
  write([r,{...r,candidateId:input.candidates[1].candidateId}]);assert.throws(preview,/COURSE_RESEARCH_DUPLICATE/);
}));

test('independent research cannot override mathematical structure, expiry, or execution authority',()=>fixture(({root,record,write,preview})=>{
  for(const key of ['structure','expiryRef','executionAllowed','unknownField']){const r=record();r.fields[key]='override';write([r]);assert.throws(preview,/COURSE_RESEARCH_SCHEMA/);}
  const text=write([record()]);fs.writeFileSync(join(root,'research.json'),text.replace('"direction":"BULLISH"','"direction":"BULLISH","direction":"BEARISH"'));
  assert.throws(preview,/DUPLICATE_JSON_KEY/);assert(!fs.existsSync(join(root,'data')));
}));

test('research file channel preserves read-only flags, workspace path bounds, and legacy no-research previews',()=>fixture(({options,record,write})=>{
  write([record()]);const original=run(['--demo'],options),preview=run(['--course-preview','--demo'],options);assert.deepEqual(preview.original,original);assert(!Object.hasOwn(preview,'researchSource'));
  for(const extra of [['--save','x'],['--verify','x']])assert.throws(()=>run(['--course-preview','--input','math.json','--course-research','research.json',...extra],options),/COURSE_PREVIEW_READ_ONLY/);
  assert.throws(()=>run(['--course-preview','--input','math.json','--course-research','../outside.json'],options),/PATH_ESCAPE/);
  assert.throws(()=>run(['--course-preview','--input','math.json','--course-research','research.json','--course-research','research.json'],options),/COURSE_RESEARCH_ARGUMENTS/);
  assert.throws(()=>run(['--input','math.json','--course-research','research.json'],options),/ARGUMENTS/);
}));
