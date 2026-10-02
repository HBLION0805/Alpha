import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {snapshotPaperRegistrations,snapshotPaperView} from './lib/options-snapshot-paper-io.mjs';
import {paperObservationView} from './lib/options-paper-observation-io.mjs';
import {collectSnapshotPaperMarket} from './lib/options-snapshot-paper-capture.mjs';

export function engineeringPaperHostSource(root,at=new Date().toISOString()){
  const desk=snapshotPaperView(root,at),observations=paperObservationView(root,desk,at);
  const active=observations.rows.filter(r=>r.planId.startsWith('eng-paper-')&&['AWAITING_WINDOW','OBSERVING'].includes(r.state)&&r.origin==='HOST_MARKET_TOOL_RESPONSES');
  if(active.length!==1)return {version:'REAL_DATA_PAPER_HOST_SOURCE_V1',status:active.length?'AMBIGUOUS_ACTIVE_ENGINEERING_PLANS':'NO_ACTIVE_ENGINEERING_PLAN',activePlanIds:active.map(x=>x.planId),source:null,contract:null,allowedTools:[],accountAccessed:false,executionAllowed:false};
  const registration=snapshotPaperRegistrations(root).find(r=>r.registration.plan.id===active[0].planId)?.registration;
  const q=registration?.plan?.contract,chainId=q?.chainSession?.chainId;
  if(!q||typeof chainId!=='string')throw Error('REAL_DATA_PAPER_HOST_CONTRACT_MISSING');
  const contract={id:q.id,chainId,symbol:q.symbol,expiry:q.expiry,type:q.type,strike:q.strike,multiplier:q.multiplier};
  const source='async function(params){return ('+collectSnapshotPaperMarket.toString()+')({...params,contract:'+JSON.stringify(contract)+'});}';
  return {version:'REAL_DATA_PAPER_HOST_SOURCE_V1',status:'READY',planId:active[0].planId,source,contract,allowedTools:['get_option_chains','get_option_instruments','get_equity_quotes','get_option_quotes'],accountAccessed:false,executionAllowed:false};
}
function parse(argv){let root=null;for(let i=0;i<argv.length;i++){if(argv[i]==='--workspace'&&argv[i+1]&&!root){root=argv[++i];continue;}if(argv[i]==='--source')continue;if(argv[i]==='--help')return {help:true};throw Error('REAL_DATA_PAPER_HOST_ARGUMENTS');}if(!root)throw Error('REAL_DATA_PAPER_HOST_ARGUMENTS');return {root};}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{const p=parse(process.argv.slice(2));if(p.help)console.log(JSON.stringify({help:'--source --workspace <Alpha root>',executionAllowed:false},null,2));else console.log(JSON.stringify(engineeringPaperHostSource(p.root),null,2));}
  catch(error){console.error(JSON.stringify({status:'SYSTEM_FAILURE',code:/^REAL_DATA_PAPER_HOST_[A-Z_]+$/.test(error?.message)?error.message:'REAL_DATA_PAPER_HOST_LOCAL_FAILURE',engineeringAcceptance:'FAILED',executionAllowed:false}));process.exitCode=2;}
}
