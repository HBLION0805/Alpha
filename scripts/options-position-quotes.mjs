import {realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {optionsEvidenceExportStorage as io} from './options-evidence-export.mjs';
import {parseChainSurveyJson} from '../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {preparePositionQuotes,beginPositionQuotes,authorizePositionQuoteCall,recordPositionQuotes,positionQuoteRecords,positionQuoteScope} from './lib/options-position-quotes.mjs';

export function runPositionQuotes(args,{workspaceRoot=process.cwd(),now=()=>new Date().toISOString()}={}){
  const root=realpathSync(workspaceRoot),[mode,id,arg,selection]=args,at=now();
  if(mode==='--scope'&&args.length===2){const {ledger,...scope}=positionQuoteScope(root,id,at);return {ledgerHead:ledger.headSha256,...scope};}
  if(mode==='--prepare'&&[3,4].includes(args.length))return preparePositionQuotes(root,arg,id,selection?selection.split(','):null,at);
  if(mode==='--host-source'&&args.length===2)return beginPositionQuotes(root,id,at);
  if(mode==='--authorize'&&args.length===3&&['0','1'].includes(arg))return authorizePositionQuoteCall(root,id,Number(arg),at);
  if(mode==='--record'&&args.length===3)return recordPositionQuotes(root,id,parseChainSurveyJson(io.readBytes(root,arg,8*1024*1024).toString('utf8')),at);
  if(mode==='--results'&&args.length===2)return positionQuoteRecords(root,id,at);
  throw Error('POSITION_WATCH_ARGUMENTS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(runPositionQuotes(process.argv.slice(2)),null,2));}
  catch(e){console.error(JSON.stringify({error:/^POSITION_WATCH_[A-Z_]+$/.test(e?.message)?e.message:e?.code==='EEXIST'?'POSITION_WATCH_ALREADY_ATTEMPTED':'POSITION_WATCH_LOCAL_READ_FAILED',executionAllowed:false}));process.exitCode=2;}
}
