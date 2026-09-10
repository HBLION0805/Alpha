import {optionsEvidenceExportStorage as io} from './options-evidence-export.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseChainSurveyJson} from '../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {snapshotPaperView,previewSnapshotPaper,registerSnapshotPaper,saveSnapshotPaperReport,verifySnapshotPaper} from './lib/options-snapshot-paper-io.mjs';
export function runSnapshotPaperCommand(args,{workspaceRoot=process.cwd()}={}){
  if(args.length===1&&args[0]==='--report')return snapshotPaperView(workspaceRoot);
  if(args.length!==2)throw Error('SNAPSHOT_PAPER_ARGUMENTS');
  if(args[0]==='--verify')return verifySnapshotPaper(workspaceRoot,args[1]);
  if(args[0]==='--save-report')return saveSnapshotPaperReport(workspaceRoot,args[1]);
  if(['--preview','--register'].includes(args[0])){
    const path=args[1];
    const request=parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(io.readBytes(workspaceRoot,path,65536)));
    return args[0]==='--preview'?previewSnapshotPaper(workspaceRoot,request):registerSnapshotPaper(workspaceRoot,request);
  }
  throw Error('SNAPSHOT_PAPER_ARGUMENTS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(runSnapshotPaperCommand(process.argv.slice(2)),null,2));}catch(e){console.error(/^SNAPSHOT_PAPER_[A-Z_]+$/.test(e.message)?e.message:'SNAPSHOT_PAPER_LOCAL_FAILURE');process.exitCode=1;}}
