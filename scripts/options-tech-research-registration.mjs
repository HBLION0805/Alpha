import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readTechQuoteInput} from './options-tech-quotes.mjs';
import {previewTechResearchRegistration,registerTechResearch,recoverTechResearchRegistration} from './lib/options-tech-research-registration.mjs';
export function techResearchRegistrationCli(args,{root=process.cwd(),now=()=>new Date().toISOString()}={}){
 if(args.length===1&&args[0]==='--help')return {help:'--preview INPUT | --register INPUT --preview-fingerprint FINGERPRINT | --recover ID. Explicit candidate-bound research only, using the existing comparison store. No --at, Owner confirmation, human review, evidence envelope, strategy request, source refresh or trading action. Authorship is declared, never authenticated. Preview/recover are read-only; register preserves the actual service save clock.'};
 if(args.length===2&&args[0]==='--recover')return recoverTechResearchRegistration({root,id:args[1],now});
 if(!((args.length===2&&args[0]==='--preview')||(args.length===4&&args[0]==='--register'&&args[2]==='--preview-fingerprint')))throw Error('TECH_RESEARCH_ARGUMENTS');
 const request=readTechQuoteInput(resolve(root,args[1])).data;
 return args[0]==='--preview'?previewTechResearchRegistration({root,request,now}):registerTechResearch({root,request,previewFingerprint:args[3],now});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(techResearchRegistrationCli(process.argv.slice(2)),null,2));}catch(e){console.error(JSON.stringify({status:'BLOCKED',code:/^TECH_RESEARCH_[A-Z_]+$/.test(e.message)?e.message:'TECH_RESEARCH_RECORD_OR_SOURCE_UNAVAILABLE',executionAllowed:false}));process.exitCode=1;}}
