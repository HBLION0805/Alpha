import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readBarQualityCapture, readBarQualityDesk } from './lib/options-bar-quality-io.mjs';

export function runBarQualityCommand(args,{workspaceRoot=process.cwd(),now=()=>new Date().toISOString()}={}) {
  const root=realpathSync(workspaceRoot),at=now();
  if(args.length===1&&args[0]==='--report')return readBarQualityDesk(root,at);
  if(args.length===2&&args[0]==='--inspect')return readBarQualityCapture(root,args[1],at);
  throw Error('BAR_QUALITY_ARGUMENTS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try{console.log(JSON.stringify(runBarQualityCommand(process.argv.slice(2)),null,2));}
  catch(e){console.error(/^(BAR_QUALITY_|ROBINHOOD_CAPTURE_|OPTIONS_EXPORT_)[A-Z_]+$/.test(e.message)?e.message:'BAR_QUALITY_RECOVERY_FAILED');process.exitCode=2;}
}
