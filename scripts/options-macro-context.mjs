import {realpathSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {refreshMacroContext,verifyMacroBatch,macroContextView,previewMacroComparison,saveMacroComparison} from './lib/options-macro-context-io.mjs';
import {parseChainSurveyJson} from '../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
export async function runMacroCommand(args,{workspaceRoot=process.cwd(),now=()=>new Date().toISOString(),retrieve}={}) {
  const root=realpathSync(workspaceRoot),[mode,path]=args;
  if(args.length===1&&mode==='--refresh')return refreshMacroContext({workspaceRoot:root,now,retrieve});
  if(args.length===1&&mode==='--report')return macroContextView(root,now());
  if(args.length===2&&mode==='--verify')return verifyMacroBatch(root,path);
  if(args.length===2&&['--preview-comparison','--save-comparison'].includes(mode)){const raw=readFileSync(path);if(raw.length>16384)throw Error('MACRO_INPUT_LIMIT');const request=parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(raw));return mode==='--save-comparison'?saveMacroComparison(root,request,now()):previewMacroComparison(root,request,now());}
  throw Error('MACRO_ARGUMENTS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const r=await runMacroCommand(process.argv.slice(2));console.log(JSON.stringify(r,null,2));if(r.status==='PARTIAL')process.exitCode=3;}catch(e){console.error(/^MACRO_[A-Z_]+$/.test(e?.message)?e.message:'MACRO_LOCAL_FAILURE');process.exitCode=2;}}
