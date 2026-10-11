import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readCompanyRefreshConfig,companyRefreshPlan} from './lib/options-weekly-company-refresh-policy.mjs';
import {runCompanyRunner,companyRunnerStatus,stopCompanyRunner,recoverCompanyRunner} from './lib/options-weekly-company-runner.mjs';
export async function runCompanyRefresh(args){
 const mode=args.shift();if(!['--plan','--run','--status','--stop','--recover'].includes(mode))throw Error('COMPANY_ARGUMENTS');
 let root=process.cwd(),configPath='docs/config/weekly-company-refresh.json',batch,runId;const options={},seen=new Set();
 while(args.length){const k=args.shift(),v=args.shift();if(!v||seen.has(k))throw Error('COMPANY_ARGUMENTS');seen.add(k);
  if(k==='--workspace')root=resolve(v);
  else if(k==='--config'&&['--plan','--run'].includes(mode))configPath=v;
  else if(k==='--batch'&&mode==='--run')batch=v;
  else if(['--until','--first-at'].includes(k)&&mode==='--run')options[k==='--until'?'until':'firstAt']=v;
  else if(k==='--run-id'&&['--status','--stop','--recover'].includes(mode))runId=v;
  else throw Error('COMPANY_ARGUMENTS');
 }
 if(mode==='--status')return companyRunnerStatus(root,runId);
 if(mode==='--stop')return stopCompanyRunner(root,runId);
 if(mode==='--recover')return recoverCompanyRunner(root,runId);
 const config=readCompanyRefreshConfig(root,configPath);
 if(mode==='--plan')return companyRefreshPlan(root,config);
 if(!Object.hasOwn(config.batches,batch??''))throw Error('COMPANY_BATCH_REQUIRED');
 const controller=new AbortController(),stop=()=>controller.abort();for(const s of ['SIGINT','SIGTERM'])process.once(s,stop);
 try{return await runCompanyRunner({root,sourceIds:config.batches[batch],intervalMinutes:config.intervalMinutes,maxAttempts:config.maxAttempts,configEvidence:{path:configPath,sha256:config.configSha256,batch,configuration:config},...options,signal:controller.signal});}
 finally{for(const s of ['SIGINT','SIGTERM'])process.removeListener(s,stop);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runCompanyRefresh(process.argv.slice(2)).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(JSON.stringify({status:'COMPANY_REFRESH_BLOCKED',errorCode:e.code==='EEXIST'?'EXCLUSIVE_OWNER_ALREADY_EXISTS':/^(?:COMPANY|RUNNER|ISSUER|PDF_METADATA)_[A-Z_]+$/.test(e.message)?e.message:'LOCAL_FAILURE',executionAllowed:false}));process.exitCode=1;});
