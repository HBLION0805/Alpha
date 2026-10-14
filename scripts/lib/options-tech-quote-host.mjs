import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {isAbsolute,basename,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import readline from 'node:readline';

const sha=value=>createHash('sha256').update(value).digest('hex');
export const TECH_QUOTE_MARKET_TOOLS=Object.freeze(['get_option_chains','get_option_instruments','get_equity_quotes','get_option_quotes']);
// This capture cannot proceed without its market server. Wait for MCP startup
// before the first model turn; keep the existing per-server timeout and allowlist.
export const techQuoteHostOverrides=()=>['-c','mcp_servers.robinhood_alpha_market_data.required=true','-c','mcp_servers.robinhood_alpha_market_data.enabled_tools='+JSON.stringify(TECH_QUOTE_MARKET_TOOLS)];

/** Explicit local pin, not PATH/mtime discovery or a substitute for OS execution approval.
 * The operator verifies the installed publisher before creating this private config.
 * A changed/missing binary must be reviewed and re-pinned, never auto-selected.
 */
export function resolveTechQuoteHost(configPath=process.env.ALPHA_TECH_QUOTE_HOST_CONFIG){
 if(!configPath)throw Error('TECH_QUOTES_HOST_CONFIG_REQUIRED');
 let raw,config;
 try{const s=lstatSync(configPath);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>16384)throw Error();raw=readFileSync(configPath);config=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(raw));}
 catch{throw Error('TECH_QUOTES_HOST_CONFIG_INVALID');}
 if(config.version!=='TECH_QUOTE_HOST_CONFIG_V1'||typeof config.executable!=='string'||!isAbsolute(config.executable)||basename(config.executable).toLowerCase()!=='codex.exe'||!/^([a-f0-9]{64})$/.test(config.sha256))throw Error('TECH_QUOTES_HOST_CONFIG_INVALID');
 let executable,digest;
 try{const s=lstatSync(config.executable);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw Error();executable=realpathSync(config.executable);if(executable.toLowerCase()!==resolve(config.executable).toLowerCase())throw Error();digest=sha(readFileSync(executable));}
 catch{throw Error('TECH_QUOTES_CODEX_NOT_ACCESSIBLE');}
 if(digest!==config.sha256)throw Error('TECH_QUOTES_CODEX_HASH_MISMATCH');
 return {executable,sha256:digest,configPath:resolve(configPath),configSha256:sha(raw),verification:'EXPLICIT_REVIEWED_BINARY_PIN_NOT_OS_PERMISSION'};
}

export function summarizeTechHostStatus(result){
 const server=result?.data?.find(s=>s.name==='robinhood_alpha_market_data');
 const names=Object.keys(server?.tools??{}).sort();
 const exact=names.length===TECH_QUOTE_MARKET_TOOLS.length&&TECH_QUOTE_MARKET_TOOLS.every(n=>names.includes(n));
 const authenticated=['oAuth','bearerToken'].includes(server?.authStatus);
 const connected=server?.runtimeStatus==null||server.runtimeStatus==='connected';
 const ready=!!server&&!server.toolsError&&!result.nextCursor&&exact&&authenticated&&connected&&server.httpOrigin==='https://agent.robinhood.com';
 return {status:ready?'HOST_STARTED_MARKET_CATALOG_READY':'BLOCKED_HOST_CONNECTION',server:server?.name??null,httpOrigin:server?.httpOrigin??null,authStatus:server?.authStatus??null,runtimeStatus:server?.runtimeStatus??null,connectionEstablished:server?.runtimeStatus==='connected'?'CONNECTED':'UNKNOWN_CATALOG_MAY_BE_CACHED',toolNames:names,toolsErrorPresent:!!server?.toolsError,actualMarketDataFreshness:'NOT_TESTED',modelAllowance:'NOT_TESTED'};
}

/** Real Codex process and MCP discovery only. No thread, turn, tool call, login or permission RPC.
 * Existing Codex runtime logs/token refresh may occur; no Alpha capture or journal is created.
 */
export async function checkTechQuoteHost({hostConfig,timeoutMs=45000}={}){
 const host=resolveTechQuoteHost(hostConfig),startedAt=new Date().toISOString();
 return new Promise(done=>{
  let finished=false,stopping=false,initialized=false,bytes=0,stderrBytes=0,stopResult,killTimer,cleanupTimer;const protocolHash=createHash('sha256'),stderrHash=createHash('sha256');let stderrText='';
  const child=spawn(host.executable,['app-server',...techQuoteHostOverrides()],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  const rl=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
  const complete=(result,closed)=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(killTimer);clearTimeout(cleanupTimer);rl.close();const stderrProblem=/os error 5|Access is denied|Permission denied|拒绝访问/i.test(stderrText)?'ACCESS_DENIED':stderrBytes?'DIAGNOSTICS_PRESENT':'NONE';done({version:'TECH_QUOTE_HOST_CHECK_V1',startedAt,finishedAt:new Date().toISOString(),host,...result,processClosed:closed,stderrProblem,protocolSha256:protocolHash.digest('hex'),stderrSha256:stderrHash.digest('hex'),stderrBytes,modelTurns:0,marketCalls:0,accountCalls:0,orderCalls:0,alphaJournalWrites:0,authority:'STARTUP_AND_CATALOG_ONLY_NOT_QUOTE_OR_PAPER_ACCEPTANCE'});};
  const finish=(result)=>{if(finished||stopping)return;stopping=true;stopResult=result;clearTimeout(timer);child.stdin.end();killTimer=setTimeout(()=>child.kill(),250);cleanupTimer=setTimeout(()=>{child.kill();child.unref();child.stdout.destroy();child.stderr.destroy();complete({status:'BLOCKED_HOST_CLEANUP_UNCONFIRMED',probeStatus:result.status},false);},5000);};
  const send=m=>{const line=JSON.stringify(m)+'\n';protocolHash.update(line);child.stdin.write(line);};
  const timer=setTimeout(()=>finish({status:'BLOCKED_HOST_TIMEOUT'}),timeoutMs);
  child.stderr.on('data',b=>{if(!finished){stderrHash.update(b);stderrBytes+=b.length;if(stderrText.length<16384)stderrText+=b.toString().slice(0,16384-stderrText.length);}});
  child.stdin.on('error',()=>finish({status:'BLOCKED_HOST_STDIN'}));
  child.on('error',e=>finish({status:'BLOCKED_HOST_SPAWN',errorCode:e.code??'UNKNOWN'}));
  child.on('close',code=>complete(stopResult??{status:'BLOCKED_HOST_EXIT',exitCode:code},true));
  rl.on('line',line=>{
   if(finished||stopping)return;bytes+=Buffer.byteLength(line);protocolHash.update(line+'\n');
   if(bytes>4*1024*1024)return finish({status:'BLOCKED_HOST_RESPONSE_BOUND'});
   let m;try{m=JSON.parse(line);}catch{return finish({status:'BLOCKED_HOST_PROTOCOL'});}
   // Never accept server-initiated approval, authentication or tool requests.
   if(m.method&&m.id!==undefined)return finish({status:'BLOCKED_HOST_INPUT_REQUIRED'});
   if(m.id===1){if(m.error||!m.result||initialized)return finish({status:'BLOCKED_HOST_INITIALIZE'});initialized=true;send({method:'initialized',params:{}});send({id:2,method:'mcpServerStatus/list',params:{serverName:'robinhood_alpha_market_data',detail:'toolsAndAuthOnly',limit:10}});}
   if(m.id===2){if(!initialized||m.error)return finish({status:'BLOCKED_HOST_DISCOVERY'});finish(summarizeTechHostStatus(m.result));}
  });
  send({id:1,method:'initialize',params:{clientInfo:{name:'alpha_tech_host_readiness',version:'1.0.0'},capabilities:{experimentalApi:true}}});
 });
}
