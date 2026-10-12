import fs from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectContractSourceBinding,contractSourceHash as hash,contractSourceClock as clock} from './lib/options-contract-source-binding.mjs';
import {parseChainSurveyJson as parse} from '../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
const check=(v,c)=>{if(!v)throw Error('CONTRACT_INTAKE_'+c);};
function privateBase(root){let p=fs.realpathSync(root);for(const n of ['data','runtime','options-workbench-development']){p=join(p,n);check(fs.lstatSync(p).isDirectory()&&!fs.lstatSync(p).isSymbolicLink()&&fs.realpathSync(p)===p,'PRIVATE_DIRECTORY');}return p;}
function readFile(root,p){const base=privateBase(root),file=resolve(root,p);check(file.startsWith(base+sep)&&fs.realpathSync(file)===file,'PRIVATE_FILE');const s=fs.lstatSync(file);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=100000,'FILE_BOUND');const raw=fs.readFileSync(file);check(s.mtimeMs===fs.lstatSync(file).mtimeMs&&s.size===raw.length,'FILE_CHANGED');return {raw,data:parse(new TextDecoder('utf8',{fatal:true}).decode(raw))};}
/** Explicit receive archives supplied bytes; UNKNOWN creates no usable CONTRACT. */
export function receiveContractEvidence({root,inputPath,runId,at=new Date().toISOString()}){
 check(/^contract-evidence-[a-z0-9][a-z0-9-]{0,50}$/.test(runId),'RUN_ID');clock(at);const original=readFile(root,inputPath),report=inspectContractSourceBinding(original.data,at);
 check(Array.isArray(original.data.originals)&&original.data.originals.length<=8&&original.data.originals.every(d=>typeof d.rawText==='string'&&Buffer.byteLength(d.rawText)<=45000&&hash(d.rawText)===d.sha256),'ARCHIVE_ORIGINALS');
 const dir=join(privateBase(root),runId);fs.mkdirSync(dir);const files=[];
 const put=(name,bytes)=>{const p=join(dir,name),fd=fs.openSync(p,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}files.push({name,sha256:hash(bytes)});};
 put('input-original.json',original.raw);original.data.originals.forEach((d,i)=>put('source-'+i+'.txt',Buffer.from(d.rawText)));
 put('assessment.json',Buffer.from(JSON.stringify(report,null,2)+'\n'));
 if(report.record)put('contract-record.json',Buffer.from(JSON.stringify(report.record,null,2)+'\n'));
 const manifest={version:'CONTRACT_INTAKE_RECEIPT_V1',runId,receivedLocallyAt:at,sourceClocksUnchanged:true,inputSha256:hash(original.raw),files,status:report.status,context:report.context,sourceCalls:0,accountWrites:0,executionAllowed:false};
 const fd=fs.openSync(join(dir,'manifest.json'),'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(manifest,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 return {runId,status:report.status,blockers:report.blockers,contractRecordCreated:!!report.record,receivedLocallyAt:at,sourceCalls:0,accountWrites:0,executionAllowed:false};
}
export function recoverContractEvidence({root,runId,at=new Date().toISOString()}){
 check(/^contract-evidence-[a-z0-9][a-z0-9-]{0,50}$/.test(runId),'RUN_ID');const dir=join(privateBase(root),runId),m=readFile(root,join(dir,'manifest.json')).data;
 check(m.version==='CONTRACT_INTAKE_RECEIPT_V1'&&m.runId===runId&&clock(m.receivedLocallyAt)<=clock(at)&&Array.isArray(m.files)&&m.files.length<=11&&m.sourceClocksUnchanged===true&&m.sourceCalls===0&&m.accountWrites===0&&m.executionAllowed===false,'MANIFEST');
 check(new Set(m.files.map(f=>f.name)).size===m.files.length&&m.files.every(f=>/^(input-original|assessment|contract-record)\.json$|^source-[0-7]\.txt$/.test(f.name)),'MANIFEST_FILES');
 const rawRead=name=>{const p=join(dir,name),s=fs.lstatSync(p);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&fs.realpathSync(p)===p&&s.size<=2000000,'FILE_BOUND');const raw=fs.readFileSync(p);check(m.files.find(f=>f.name===name)?.sha256===hash(raw),'HASH');return raw;};
 for(const f of m.files)rawRead(f.name);const original=rawRead('input-original.json');check(hash(original)===m.inputSha256,'INPUT_HASH');const p=parse(original.toString()),r=inspectContractSourceBinding(p,m.receivedLocallyAt);
 const expected=['input-original.json','assessment.json',...p.originals.map((_,i)=>'source-'+i+'.txt'),...(r.record?['contract-record.json']:[])].sort();check(JSON.stringify(m.files.map(f=>f.name).sort())===JSON.stringify(expected)&&JSON.stringify(fs.readdirSync(dir).sort())===JSON.stringify([...expected,'manifest.json'].sort()),'ARCHIVE_FILES');
 p.originals.forEach((d,i)=>check(rawRead('source-'+i+'.txt').equals(Buffer.from(d.rawText)),'SOURCE_BYTES'));check(rawRead('assessment.json').equals(Buffer.from(JSON.stringify(r,null,2)+'\n'))&&m.status===r.status&&m.context===r.context,'REPLAY');if(r.record)check(rawRead('contract-record.json').equals(Buffer.from(JSON.stringify(r.record,null,2)+'\n')),'RECORD');
 return {status:'EXACT_OFFLINE_REPLAY',originalAssessment:r.status,currentAssessment:inspectContractSourceBinding(p,at).status,checkedAt:at,sourceClocksRenewed:false,sourceCalls:0,accountWrites:0,executionAllowed:false};
}
export function contractEvidenceCli(args,{root=process.cwd(),clock=()=>new Date().toISOString()}={}){
 if(args.length===1&&args[0]==='--help')return {usage:'--preview PRIVATE_INPUT | --receive PRIVATE_INPUT --run-id contract-evidence-ID | --recover contract-evidence-ID',scope:'Offline original reception and CONTRACT evidence only; no quotes, login, account writes or orders. JSON record fields require source semantics review; text product rule is bounded to saved SPY American reference.'};
 if(args.length===2&&args[0]==='--preview')return inspectContractSourceBinding(readFile(root,args[1]).data,clock());
 if(args.length===2&&args[0]==='--recover')return recoverContractEvidence({root,runId:args[1],at:clock()});
 if(args.length===4&&args[0]==='--receive'&&args[2]==='--run-id')return receiveContractEvidence({root,inputPath:args[1],runId:args[3],at:clock()});throw Error('CONTRACT_INTAKE_ARGUMENTS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(contractEvidenceCli(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
