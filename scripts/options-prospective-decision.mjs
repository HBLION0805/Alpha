import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {registerReadinessContract,listReadinessContracts,assessEventReadiness} from './lib/options-prospective-decision-readiness.mjs';
import {readIssuerRehearsal} from './lib/options-prospective-decision-issuer.mjs';

const fail=c=>{throw Error('PROSPECTIVE_DECISION_CLI_'+c);};
const parseJson=path=>{const b=readFileSync(path);if(b.length>1024*1024)fail('INPUT_LIMIT');try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));}catch{fail('INPUT_JSON');}};
export function runProspectiveDecision(args,{now=()=>new Date().toISOString()}={}){
  let workspace=null,mode=null,input=null,eventId=null,evidencePath=null;
  for(let i=0;i<args.length;i++){
    const a=args[i];
    if(a==='--workspace'&&args[i+1]&&!workspace){workspace=args[++i];continue;}
    if(a==='--register'&&args[i+1]&&!mode){mode='register';input=args[++i];continue;}
    if(a==='--report'&&args[i+1]&&!mode){mode='report';eventId=args[++i];continue;}
    if(a==='--gate'&&args[i+1]&&!mode){mode='gate';eventId=args[++i];continue;}
    if(a==='--evidence'&&args[i+1]&&!evidencePath){evidencePath=args[++i];continue;}
    if(a==='--help')return {help:'--register <contract.json> | --report <eventId> | --gate <eventId> --evidence <evidence.json> --workspace <root>',executionAllowed:false};
    fail('ARGUMENTS');
  }
  if(!workspace||!mode)fail('ARGUMENTS');
  if(mode==='register'){
    if(!input||evidencePath||eventId)fail('ARGUMENTS');
    const saved=registerReadinessContract(workspace,parseJson(input),{now});
    return {mode,status:'REGISTERED',path:saved.path,contract:saved.contract,executionAllowed:false};
  }
  const contracts=listReadinessContracts(workspace,eventId,now());
  if(mode==='report')return {mode,eventId,contracts:contracts.map(x=>({path:x.path,contract:x.contract})),executionAllowed:false};
  if(!evidencePath||contracts.length===0)fail(contracts.length?'EVIDENCE_REQUIRED':'CONTRACT_MISSING');
  const contract=contracts.at(-1).contract,evidence=parseJson(evidencePath);
  if(!Array.isArray(evidence))fail('EVIDENCE_SHAPE');
  const rehearsal=readIssuerRehearsal(workspace,contract.generator.version,contract.latencyPolicy.version);
  return {mode,eventId,gate:assessEventReadiness(contract,evidence,now(),{faultRehearsalPassed:Boolean(rehearsal)}),rehearsal,executionAllowed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(runProspectiveDecision(process.argv.slice(2)),null,2));}
  catch(error){console.error(JSON.stringify({status:'ERROR',code:/^PROSPECTIVE_(?:DECISION_CLI|READINESS|ISSUER)_[A-Z_]+$/.test(error?.message)?error.message:'PROSPECTIVE_DECISION_CLI_LOCAL_FAILURE',executionAllowed:false}));process.exitCode=2;}
}
