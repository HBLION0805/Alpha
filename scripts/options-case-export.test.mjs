import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync,readdirSync,unlinkSync,cpSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {seedEvidenceLoop,after,at} from './lib/options-evidence-loop-fixtures.mjs';
import {inspectCase,previewCaseExport,createCaseExport,recoverCaseExport,verifyCaseBundle,CASE_EXPORT_BASE} from './lib/options-case-export.mjs';
import {caseJson,caseSha,validateCaseRecords} from './lib/options-case-records.mjs';
import {readManualLedger} from './options-manual-ledger.mjs';
import {saveSourceRecord} from './lib/options-source-comparison.mjs';
import {caseExportPanel} from '../apps/options-workbench/case-export.js';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {runCaseExport} from './options-case-export.mjs';
import {paperFingerprint as fp} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {repository,repositoryExport} from './lib/options-case-repositories.mjs';

let passed=0;const roots=[];
const temp=()=>{const root=mkdtempSync(join(tmpdir(),'alpha-expectation-test-'));roots.push(root);return root;};
const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
const caseId='synthetic-event-plan';
const saveBundle=f=>{const p=previewCaseExport(f.root,f.ledgerId,caseId,after);return createCaseExport(f.root,{ledgerId:f.ledgerId,caseId,asOf:p.asOf,previewFingerprint:p.previewFingerprint},()=>after);};
const writeManifest=(root,id,mutate)=>{const path=resolve(root,CASE_EXPORT_BASE,id,'manifest.json'),m=JSON.parse(readFileSync(path));delete m.manifestSha256;mutate(m);writeFileSync(path,caseJson({...m,manifestSha256:caseSha(caseJson(m))}));};
try{
  const root=temp(),f=await seedEvidenceLoop(root);f.root=root;
  const otherDraft=structuredClone(readManualLedger(root,f.ledgerId,()=>at(80)).input.events.find(e=>e.command.type==='SAVE_PLAN_DRAFT').command);
  otherDraft.requestId='other-draft';otherDraft.tradeId='other-case';f.save(otherDraft);
  f.save(f.prepared.command);f.setClock(after);for(const fill of f.fills())f.save(fill);
  await f.action('OUTCOME',f.outcome);await f.action('REVIEW',f.review('ACCURATE'));await f.action('JOURNAL',f.journal);
  const before=readManualLedger(root,f.ledgerId,()=>after).headSha256;
  let complete;
  await test('full closed fixture exports exact prediction, outcome, review, trade and journal histories',()=>{
    complete=saveBundle(f);const v=verifyCaseBundle(root,complete.exportId,caseId);
    assert.equal(v.snapshot.status.plan,'FROZEN');assert.equal(v.snapshot.status.trade,'CLOSED');assert.equal(v.snapshot.status.netPnlUsd,'-20.020000');
    assert.ok(v.snapshot.exports.prediction.length);assert.ok(v.snapshot.exports.journal.length);assert.ok(v.snapshot.evidenceLoop.rows[0].outcome);assert.ok(v.snapshot.evidenceLoop.rows[0].review);
    const r=recoverCaseExport(root,complete.exportId,caseId);assert.equal(r.status,'ISOLATED_RECOVERY_VERIFIED');assert.equal(r.reopened,true);assert.equal(r.temporaryWorkspaceRemoved,true);
  });
  await test('source lifecycle and exact original event head unchanged; independent repeated bundle',()=>{
    const second=saveBundle(f);assert.notEqual(second.exportId,complete.exportId);assert.equal(readManualLedger(root,f.ledgerId,()=>after).headSha256,before);
    assert.equal(verifyCaseBundle(root,complete.exportId,caseId).manifest.manifestSha256,complete.manifestSha256);
  });
  await test('no unrelated case records copied even with interleaved shared ledger events',()=>{
    const r=inspectCase(root,f.ledgerId,caseId,after);assert.ok(r.bundle.records.every(x=>x.kind!=='manual'||x.value.event.command.tradeId===caseId));
    assert.ok(!JSON.stringify(r.bundle).includes('other-draft'));assert.equal(recoverCaseExport(root,saveBundle(f).exportId,caseId).status,'ISOLATED_RECOVERY_VERIFIED');
  });
  await test('legacy case remains PRE_ENTRY_PREDICTION_UNAVAILABLE, without synthetic prediction',async()=>{
    const r=temp(),g=await seedEvidenceLoop(r);g.root=r;g.save(g.command);g.setClock(after);for(const c of g.fills())g.save(c);
    const result=saveBundle(g),v=verifyCaseBundle(r,result.exportId,caseId);assert.equal(v.snapshot.status.prediction,'PRE_ENTRY_PREDICTION_UNAVAILABLE');assert.equal(v.snapshot.exports.prediction,undefined);assert.equal(recoverCaseExport(r,result.exportId,caseId).caseStatus.prediction,'PRE_ENTRY_PREDICTION_UNAVAILABLE');
  });
  await test('draft remains draft with exact versioned source/expectation/scenario and null P&L',async()=>{
    const r=temp(),g=await seedEvidenceLoop(r);g.root=r;g.setClock(after);const p=previewCaseExport(r,g.ledgerId,caseId,after);
    assert.equal(p.status.plan,'DRAFT');assert.equal(p.status.prediction,'NOT_CREATED');assert.equal(p.status.netPnlUsd,null);
    assert.ok(p.records.some(x=>x.recordType==='expectation'));assert.ok(p.records.some(x=>x.recordType==='scenario'));assert.ok(p.records.some(x=>x.recordType==='saved'));
    const b=saveBundle(g);assert.equal(recoverCaseExport(r,b.exportId,caseId).caseStatus.prediction,'NOT_CREATED');
  });
  await test('source missing external provenance stays unresolved, never silently repaired',()=>{
    const b=verifyCaseBundle(root,complete.exportId,caseId);assert.deepEqual(recoverCaseExport(root,complete.exportId,caseId).missingRecords,b.snapshot.missingRecords);
    assert.equal(b.snapshot.status.validatedEV,'UNKNOWN');
  });
  await test('missing original package remains missing through transitive expectation/scenario references',async()=>{
    const r=temp(),g=await seedEvidenceLoop(r);g.root=r;g.setClock(after);
    const data=inspectCase(r,g.ledgerId,caseId,after),source=data.bundle.records.find(x=>x.kind==='source'&&x.value.kind==='package');
    unlinkSync(resolve(r,source.sourcePath));const p=previewCaseExport(r,g.ledgerId,caseId,after);
    assert.ok(p.unresolvedReferences.some(x=>x.target===source.sourcePath));const b=saveBundle(g),recovered=recoverCaseExport(r,b.exportId,caseId);
    assert.equal(recovered.status,'ISOLATED_RECOVERY_VERIFIED');assert.ok(recovered.unresolvedReferenceCount>0);assert.equal(existsSync(resolve(r,source.sourcePath)),false);
    assert.ok(verifyCaseBundle(r,b.exportId,caseId).snapshot.semanticChecks.some(x=>x.status==='ORIGINAL_REFERENCE_UNAVAILABLE_FINGERPRINT_ONLY'));
  });
  await test('generic Research and Strategy exporters retain empty absence without new authorities',()=>{
    for(const kind of ['research','strategy'])assert.deepEqual(repositoryExport(kind,repository(kind,[]),after),[]);
  });
  await test('preview becomes invalid when source changes; no bundle manifest published',()=>{
    const p=previewCaseExport(root,f.ledgerId,caseId,after);f.save({...otherDraft,requestId:'other-new-version'});
    assert.throws(()=>createCaseExport(root,{ledgerId:f.ledgerId,caseId,asOf:after,previewFingerprint:p.previewFingerprint},()=>after),/PREVIEW_CHANGED/);
  });
  const corrupt=(name,edit)=>test(name,()=>{const r=temp(),dest=resolve(r,CASE_EXPORT_BASE,complete.exportId);cpSync(resolve(root,CASE_EXPORT_BASE,complete.exportId),dest,{recursive:true});edit(r,dest);assert.throws(()=>recoverCaseExport(r,complete.exportId,caseId));});
  await corrupt('missing manifest fails closed',(_,p)=>unlinkSync(join(p,'manifest.json')));
  await corrupt('modified manifest fails closed',(_,p)=>{const m=JSON.parse(readFileSync(join(p,'manifest.json')));m.caseId='wrong-case';writeFileSync(join(p,'manifest.json'),caseJson(m));});
  await corrupt('missing record fails closed',(_,p)=>unlinkSync(join(p,'records','0001.json')));
  await corrupt('tampered record fails closed',(_,p)=>writeFileSync(join(p,'records','0001.json'),'{}\n'));
  await corrupt('wrong hash fails closed',(r)=>writeManifest(r,complete.exportId,m=>m.files[0].sha256='0'.repeat(64)));
  await corrupt('duplicate record fails closed',(r)=>writeManifest(r,complete.exportId,m=>m.records[1]=m.records[0]));
  await corrupt('wrong case identity with recomputed manifest fails closed',(r)=>writeManifest(r,complete.exportId,m=>m.caseId='wrong-case'));
  await corrupt('unsupported schema fails closed',(r)=>writeManifest(r,complete.exportId,m=>m.schemaVersion='V_NEXT'));
  await corrupt('truncated bytes fail closed',(_,p)=>{const path=join(p,'records','0001.json'),b=readFileSync(path);writeFileSync(path,b.subarray(0,b.length-4));});
  await corrupt('path traversal fails closed before any recovery write',(r)=>writeManifest(r,complete.exportId,m=>m.files[0].file='../outside.json'));
  await corrupt('unexpected file in bundle fails closed',(_,p)=>writeFileSync(join(p,'foreign.txt'),'not case data'));
  await test('foreign case and altered business fingerprint rejected independently of file hash',()=>{
    const x=verifyCaseBundle(root,complete.exportId,caseId).bundle;
    const foreign=structuredClone(x);foreign.records.find(r=>r.kind==='manual').value.event.command.tradeId='foreign';assert.throws(()=>validateCaseRecords(foreign),/FOREIGN_CASE/);
    const tampered=structuredClone(x);tampered.records.find(r=>r.kind==='source').value.fingerprint='sha256:'+'0'.repeat(64);assert.throws(()=>validateCaseRecords(tampered),/BUSINESS_FINGERPRINT/);
    const duplicate=structuredClone(x);duplicate.records.push(duplicate.records[0]);assert.throws(()=>validateCaseRecords(duplicate),/DUPLICATE_RECORD/);
  });
  await test('invalid pinned reference rejected, not substituted with latest',()=>{
    const x=verifyCaseBundle(root,complete.exportId,caseId).bundle;
    const ref=x.records.find(r=>r.kind==='source'&&r.value.kind==='scenario');
    ref.value.payload.expectation.fingerprint='sha256:'+'0'.repeat(64);
    const {fingerprint,...p}=ref.value;ref.value.fingerprint=fp(p);
    assert.throws(()=>validateCaseRecords(x),/REFERENCE_FINGERPRINT/);
  });
  await test('secrets in an otherwise valid source record stop export; never copied',async()=>{
    const r=temp(),g=await seedEvidenceLoop(r);g.root=r;g.setClock(after);const x=inspectCase(r,g.ledgerId,caseId,after).bundle.records.find(x=>x.kind==='source'&&x.value.kind==='package');
    const {fingerprint,...p}=x.value;p.payload.materials[0].text='Bearer synthetic-secret-for-test';
    writeFileSync(resolve(r,x.sourcePath),JSON.stringify({...p,fingerprint:fp(p)})+'\n');
    assert.throws(()=>previewCaseExport(r,g.ledgerId,caseId,after),/SECRET_CONTENT/);assert.equal(existsSync(resolve(r,CASE_EXPORT_BASE)),false);
  });
  await test('UI requires explicit preview/create; no absolute workspace path',()=>{
    const preview=previewCaseExport(root,f.ledgerId,caseId,after),html=caseExportPanel(caseId,{caseExports:{[caseId]:{preview,result:complete}}});
    assert.match(html,/Not an off-device backup/);assert.match(html,/Included records/);assert.match(html,/Missing records/);assert.match(html,/Create local evidence bundle/);assert.ok(!html.includes(root));assert.match(html,/PRIVATE \/ LOCAL_ONLY/);
    assert.ok(!caseExportPanel(caseId).includes('data-case-export="CREATE"'));
  });
  await test('CLI cannot accept a production restore destination',()=>assert.throws(()=>runCaseExport(['--recover-isolated',complete.exportId,caseId,root],{root}),/ARGUMENTS/));
  await test('protected API rejects unauthenticated export and serves explicit preview without creating bundle',async()=>{
    const server=await startOptionsWorkbench({workspaceRoot:root,ledgerId:f.ledgerId,port:0,now:()=>after,refreshContext:false});
    try{const denied=await fetch(server.url+'/api/case-export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'PREVIEW',caseId})});assert.equal(denied.status,403);
      const s=await(await fetch(server.url+'/api/state')).json(),before=readdirSync(resolve(root,CASE_EXPORT_BASE)).length;
      const res=await fetch(server.url+'/api/case-export',{method:'POST',headers:{Origin:server.url,'Content-Type':'application/json','X-Alpha-Session':s.session},body:JSON.stringify({action:'PREVIEW',caseId})});assert.equal(res.status,200);assert.equal((await res.json()).caseId,caseId);assert.equal(readdirSync(resolve(root,CASE_EXPORT_BASE)).length,before);
    }finally{await server.close();}
  });
}finally{for(const root of roots){assert.equal(dirname(root),resolve(tmpdir()));assert.ok(root.includes('alpha-expectation-test-'));rmSync(root,{recursive:true,force:true});}}
console.log(`# tests ${passed}\n# pass ${passed}\n# fail 0`);
