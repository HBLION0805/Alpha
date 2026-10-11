import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readTechQuoteInput} from './options-tech-quotes.mjs';
import {previewAssistantResearch,appendAssistantResearch,recoverAssistantResearch,prepareAssistantResearch} from './lib/options-tech-assistant-research.mjs';
export function assistantResearchCli(args,{root=process.cwd(),now=()=>new Date().toISOString()}={}){
 if(args.length===1&&args[0]==='--help')return {help:'--preview INPUT | --append INPUT --preview-fingerprint HASH | --recover ID | --prepare ID. Append-only ASSISTANT diagnostic revision/request. No --at, Owner approval, source refresh, executable request, quote or Paper admission.'};
 if(args.length===2&&['--recover','--prepare'].includes(args[0]))return (args[0]==='--recover'?recoverAssistantResearch:prepareAssistantResearch)({root,id:args[1],now});
 if(!((args.length===2&&args[0]==='--preview')||(args.length===4&&args[0]==='--append'&&args[2]==='--preview-fingerprint')))throw Error('TECH_ASSISTANT_ARGUMENTS');
 const input=readTechQuoteInput(resolve(root,args[1])).data;
 return args[0]==='--preview'?previewAssistantResearch({root,input,now}):appendAssistantResearch({root,input,previewFingerprint:args[3],now});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(assistantResearchCli(process.argv.slice(2)),null,2));}catch(e){console.error(JSON.stringify({status:'BLOCKED',code:/^TECH_ASSISTANT_[A-Z_]+$/.test(e.message)?e.message:'TECH_ASSISTANT_RECORD_OR_SOURCE_UNAVAILABLE',executionAllowed:false}));process.exitCode=1;}}
