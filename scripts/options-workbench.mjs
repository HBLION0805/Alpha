import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createWorkbenchData, workbenchError } from './lib/options-workbench-data.mjs';
import { parseChainSurveyJson } from '../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import { startPublicContextService } from './options-context-service.mjs';

const assetRoot=resolve(import.meta.dirname,'../apps/options-workbench');
const assets=new Map([['/',['index.html','text/html']],['/index.html',['index.html','text/html']],...['app.js','api.js','model.js','views.js','forms.js','guidance.js','sensitivities.js','candidate-checks.js','cost-desk.js','capital-policy.js','gold-framework.js','macro-context.js','focused-news.js','event-research.js','bar-quality.js','snapshot-paper.js','position-watch.js','event-reactions.js'].map(f=>['/'+f,[f,'text/javascript']]),['/styles.css',['styles.css','text/css']],['/icon.svg',['icon.svg','image/svg+xml']]]);
const MAX_BODY=65536;
export async function startOptionsWorkbench({port=4173,refreshContext=false,...options}={}){
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('WORKBENCH_PORT');
  const service=createWorkbenchData(options),session=randomBytes(32).toString('hex');
  let origin,host;
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    const send=(status,value)=>{if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
    const reject=(status,code)=>send(status,{error:code,executionAllowed:false});
    try{
      if(req.headers.host!==host||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return reject(403,'LOCAL_ORIGIN_REQUIRED');
      if(req.headers.origin&&req.headers.origin!==origin)return reject(403,'LOCAL_ORIGIN_REQUIRED');
      if(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))return reject(403,'LOCAL_ORIGIN_REQUIRED');
      if((req.url??'').length>1000)return reject(414,'REQUEST_TOO_LONG');
      const url=new URL(req.url,origin);
      if(req.method==='GET'&&assets.has(url.pathname)){
        const [file,type]=assets.get(url.pathname);res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(readFileSync(resolve(assetRoot,file)));return;
      }
      if(req.method==='GET'&&url.pathname==='/api/health')return send(200,{application:'ALPHA_OPTIONS_WORKBENCH_V1',...service.scope,contextRefreshEnabled:refreshContext,executionAllowed:false});
      if(req.method==='GET'&&url.pathname==='/api/state'){
        if([...url.searchParams.keys()].some(k=>k!=='board')||url.searchParams.getAll('board').length>1)return reject(400,'QUERY_INVALID');
        return send(200,{...await service.state(url.searchParams.get('board')),backgroundContextRefreshEnabled:refreshContext,localPaperFinalization:contextService?.paperStatus()??{enabled:false,status:'DISABLED',checkedAt:null,sourceReads:0,executionAllowed:false},session});
      }
      if(req.method!=='POST'||!['/api/preview','/api/save','/api/evaluate','/api/initialize','/api/guidance-settings','/api/event-research','/api/candidate-checks','/api/cost-desk','/api/capital-policy','/api/macro-comparison','/api/snapshot-paper','/api/position-watch'].includes(url.pathname)||url.search)return reject(404,'ROUTE_NOT_FOUND');
      const provided=req.headers['x-alpha-session'];
      if(req.headers.origin!==origin||typeof provided!=='string'||provided.length!==session.length||!timingSafeEqual(Buffer.from(provided),Buffer.from(session)))return reject(403,'SESSION_REQUIRED');
      if(req.headers['content-type']!=='application/json')return reject(415,'JSON_REQUIRED');
      if(req.headers['content-encoding'])return reject(415,'ENCODING_NOT_SUPPORTED');
      if(Number(req.headers['content-length']??0)>MAX_BODY)return reject(413,'BODY_TOO_LARGE');
      const chunks=[];let length=0;
      for await(const chunk of req){length+=chunk.length;if(length>MAX_BODY){reject(413,'BODY_TOO_LARGE');return;}chunks.push(chunk);}
      let body;try{body=parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks)));}catch{return reject(400,'JSON_INVALID');}
      if(url.pathname==='/api/snapshot-paper')return send(200,await service.snapshotPaper(body));
      if(url.pathname==='/api/position-watch')return send(200,service.positionWatch(body));
      if(url.pathname==='/api/evaluate')return send(200,service.evaluate(body));
      if(url.pathname==='/api/cost-desk')return send(200,service.costDesk(body));
      if(url.pathname==='/api/macro-comparison')return send(200,service.macroComparison(body));
      if(url.pathname==='/api/capital-policy')return send(200,service.capitalPolicy(body));
      if(url.pathname==='/api/preview')return send(200,service.preview(body));
      if(url.pathname==='/api/save')return send(200,service.save(body));
      if(url.pathname==='/api/guidance-settings')return send(200,service.saveGuidanceSettings(body));
      if(url.pathname==='/api/event-research')return send(200,await service.eventResearch(body));
      if(url.pathname==='/api/candidate-checks')return send(200,await service.candidateChecks(body));
      if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==0)return reject(400,'INITIALIZE_INPUT');
      return send(200,service.initialize());
    }catch(e){reject(409,workbenchError(e));}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=3000;server.maxHeadersCount=30;
  await new Promise((yes,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',yes);});
  host='127.0.0.1:'+server.address().port;origin='http://'+host;
  const contextService=refreshContext?startPublicContextService({workspaceRoot:options.workspaceRoot??process.cwd()}):null;
  return {server,url:origin,close:()=>new Promise((yes,no)=>{contextService?.stop();server.close(e=>e?no(e):yes());server.closeIdleConnections();})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const args=process.argv.slice(2),options={refreshContext:true};
    for(let i=0;i<args.length;i+=2){if(!['--port','--workspace','--ledger'].includes(args[i])||!args[i+1])throw Error('WORKBENCH_ARGUMENTS');const key={'--port':'port','--workspace':'workspaceRoot','--ledger':'ledgerId'}[args[i]];if(Object.hasOwn(options,key))throw Error('WORKBENCH_ARGUMENTS');options[key]=key==='port'?Number(args[i+1]):args[i+1];}
    const app=await startOptionsWorkbench(options);console.log('Alpha workbench: '+app.url+' (saved local data; no automatic orders)');
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void app.close().then(()=>process.exit(0));});
  }catch(e){console.error(e?.code==='EADDRINUSE'?'WORKBENCH_PORT_IN_USE: choose another --port or close the existing Alpha server.':workbenchError(e));process.exitCode=1;}
}
