import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {previewCaseExport,createCaseExport,verifyCaseBundle,recoverCaseExport} from './lib/options-case-export.mjs';

// Intentionally no restore destination option and no source/lifecycle write API.
export function runCaseExport(args,{root=resolve(import.meta.dirname,'..'),now=()=>new Date().toISOString()}={}){
  const [action,ledgerId,caseId,value,asOf]=args;
  if(action==='--preview'&&args.length===3)return previewCaseExport(root,ledgerId,caseId,now());
  if(action==='--create'&&args.length===5)return createCaseExport(root,{ledgerId,caseId,previewFingerprint:value,asOf},now);
  if(action==='--verify'&&args.length===3){const {manifest}=verifyCaseBundle(root,ledgerId,caseId);return {status:'BUNDLE_VERIFIED',exportId:manifest.exportId,caseId,manifestSha256:manifest.manifestSha256};}
  if(action==='--recover-isolated'&&args.length===3)return recoverCaseExport(root,ledgerId,caseId);
  throw Error('CASE_EXPORT_ARGUMENTS');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{console.log(JSON.stringify(runCaseExport(process.argv.slice(2)),null,2));}
  catch(e){console.error(JSON.stringify({status:'RECOVERY_OR_EXPORT_FAILED',code:/^CASE_EXPORT_[A-Z_]+$/.test(e.message)?e.message:'CASE_EXPORT_LOCAL_VALIDATION_FAILED',executionAllowed:false}));process.exitCode=2;}
}
