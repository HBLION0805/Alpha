import readline from 'node:readline';
import {realpathSync} from 'node:fs';
import {engineeringPaperHostSource} from './options-real-data-paper-host.mjs';
import {acceptRealDataPaperCapture} from './lib/options-real-data-paper-capture.mjs';

const root=realpathSync(process.env.ALPHA_PRIVATE_ROOT||'C:/projects/Alpha');
const VERSION='ALPHA_REAL_DATA_PAPER_MCP_V1';
const tools=[
 {name:'health',description:'Read-only health check for the Alpha real-data paper bridge.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'prepare_capture',description:'Return the exact active engineering paper contract and the bounded collector source. No market/account/order call is made.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'accept_capture',description:'Validate and persist one exact-contract Host result through the existing Alpha guidance and Snapshot Paper pipeline. No brokerage call is made.',inputSchema:{type:'object',properties:{result:{type:'object',additionalProperties:true}},required:['result'],additionalProperties:false}}
];
function send(v){process.stdout.write(JSON.stringify(v)+'\n');}
function ok(id,result){send({jsonrpc:'2.0',id,result});}
function err(id,code,message){send({jsonrpc:'2.0',id,error:{code,message:String(message).slice(0,500)}});}
async function callTool(name,args){
 if(name==='health')return {version:VERSION,status:'OK',workspace:root,executionAllowed:false};
 if(name==='prepare_capture')return engineeringPaperHostSource(root,new Date().toISOString());
 if(name==='accept_capture'){
  if(!args||typeof args.result!=='object'||args.result===null)throw Error('CAPTURE_RESULT_REQUIRED');
  return await acceptRealDataPaperCapture(root,args.result);
 }
 throw Error('UNKNOWN_TOOL');
}
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',async line=>{
 if(!line.trim())return;let m;try{m=JSON.parse(line);}catch{return;}
 const id=Object.hasOwn(m,'id')?m.id:null;
 try{
  if(m.method==='initialize'){ok(id,{protocolVersion:m.params?.protocolVersion??'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'alpha-real-data-paper',version:'1.0.0'},instructions:'Bounded engineering paper bridge. No brokerage calls are made by this local server.'});return;}
  if(m.method==='notifications/initialized'||m.method==='notifications/cancelled')return;
  if(m.method==='ping'){ok(id,{});return;}
  if(m.method==='tools/list'){ok(id,{tools});return;}
  if(m.method==='tools/call'){const result=await callTool(m.params?.name,m.params?.arguments??{});ok(id,{content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:false});return;}
  if(id!==null)err(id,-32601,'Method not found');
 }catch(e){if(id!==null)err(id,-32000,e?.message??e);}
});
