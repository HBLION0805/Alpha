import {spawn} from 'node:child_process';
import {mkdirSync,openSync,closeSync,existsSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {get} from 'node:http';

// The double-click launcher has one fixed loopback destination and no scheduler.
const root=resolve(import.meta.dirname,'..'),url='http://127.0.0.1:4173';
const workspaceFingerprint=createHash('sha256').update(realpathSync(root)).digest('hex');
function health(){return new Promise(resolveHealth=>{
  const request=get(url+'/api/health',{timeout:1500},response=>{let text='';response.setEncoding('utf8');response.on('data',part=>{text+=part;if(text.length>4096)request.destroy();});response.on('end',()=>{try{const h=JSON.parse(text);resolveHealth(h.application==='ALPHA_OPTIONS_WORKBENCH_V1'&&h.ledgerId==='owner-manual-gld-ibit'&&h.workspaceFingerprint===workspaceFingerprint?'ALPHA':'OCCUPIED');}catch{resolveHealth('OCCUPIED');}});});
  request.on('timeout',()=>request.destroy());request.on('error',error=>resolveHealth(error.code==='ECONNREFUSED'?'ABSENT':'OCCUPIED'));
});}
try{
  if(process.argv.slice(2).some(a=>a!=='--no-open'))throw Error('Only --no-open is supported.');
  let state=await health();
  if(state==='OCCUPIED')throw Error('Port 4173 is occupied by another service. Start Alpha with npm run options:workbench -- --port 4174.');
  if(state==='ABSENT'){
    if(!existsSync(resolve(root,'node_modules/tsx')))throw Error('Dependencies are missing. Run npm ci in the Alpha folder first.');
    const logs=resolve(root,'data/runtime/options-workbench-development');mkdirSync(logs,{recursive:true});
    const out=openSync(resolve(logs,'server.log'),'a'),err=openSync(resolve(logs,'server-error.log'),'a');
    try{const child=spawn(process.execPath,['--import','tsx',resolve(root,'scripts/options-workbench.mjs'),'--workspace',root],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',out,err]});child.unref();}finally{closeSync(out);closeSync(err);}
    for(let i=0;i<30;i++){await new Promise(resolveWait=>setTimeout(resolveWait,500));state=await health();if(state==='ALPHA')break;}
    if(state!=='ALPHA')throw Error('Alpha did not start. Check data/runtime/options-workbench-development/server-error.log.');
  }
  console.log('Alpha local interface is ready: '+url+' (no automatic orders)');
  console.log('Interface availability does not verify public network access. Check News & calendar for actual source receipts.');
  if(process.platform==='win32'&&!process.argv.includes('--no-open')){const browser=spawn('explorer.exe',[url],{detached:true,windowsHide:true,stdio:'ignore'});browser.on('error',()=>console.log('Open '+url+' in your browser.'));browser.unref();}
}catch(error){console.error(error.message);process.exitCode=1;}
