import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareTechCandidate,assessTechCandidate,prepareTechResearchInputs,appendTechEventReview,readTechEventReviews} from './lib/options-tech-candidate.mjs';
export function techCandidateCli(args,{root=process.cwd(),now=()=>new Date().toISOString()}={}){
 if(args.length===1&&args[0]==='--help')return {usage:'--research-inputs --source-root DIRECTORY --run-id ID | --append-event-review --run-id ID --request FILE | --event-reviews --run-id ID | --prepare --source-root DIRECTORY --research FILE --run-id ID | --assess --run-id ID [--quote FILE] [--evidence FILE]',authority:'CITED_RESEARCH_INPUTS_AND_ADMISSION_REJECTION_ONLY_NO_ARM'};
 const mode=args[0],p={};if(!['--research-inputs','--append-event-review','--event-reviews','--prepare','--assess'].includes(mode))throw Error('TECH_CANDIDATE_ARGUMENTS');
 for(let i=1;i<args.length;i+=2){if(!['--source-root','--research','--run-id','--quote','--evidence','--request'].includes(args[i])||p[args[i]]||!args[i+1]||args[i+1].startsWith('--'))throw Error('TECH_CANDIDATE_ARGUMENTS');p[args[i]]=args[i+1];}
 if(!p['--run-id'])throw Error('TECH_CANDIDATE_ARGUMENTS');
 if(mode==='--append-event-review'||mode==='--event-reviews'){
  if(p['--source-root']||p['--research']||p['--quote']||p['--evidence']||(mode==='--append-event-review'?!p['--request']:p['--request']))throw Error('TECH_CANDIDATE_ARGUMENTS');
  return mode==='--append-event-review'?appendTechEventReview({root,runId:p['--run-id'],requestPath:p['--request'],now}):readTechEventReviews({root,runId:p['--run-id'],now});
 }
 if(p['--request'])throw Error('TECH_CANDIDATE_ARGUMENTS');
 if(mode==='--research-inputs'){if(!p['--source-root']||p['--research']||p['--quote']||p['--evidence'])throw Error('TECH_CANDIDATE_ARGUMENTS');return prepareTechResearchInputs({root,sourceRoot:p['--source-root'],runId:p['--run-id'],now});}
 if(mode==='--prepare'){if(!p['--source-root']||!p['--research']||p['--quote']||p['--evidence'])throw Error('TECH_CANDIDATE_ARGUMENTS');return prepareTechCandidate({root,sourceRoot:p['--source-root'],researchPath:p['--research'],runId:p['--run-id'],now});}
 if(p['--source-root']||p['--research'])throw Error('TECH_CANDIDATE_ARGUMENTS');
 return assessTechCandidate({root,runId:p['--run-id'],quotePath:p['--quote'],evidencePath:p['--evidence'],now});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(techCandidateCli(process.argv.slice(2)),null,2));}catch(e){console.error(/^TECH_CANDIDATE_[A-Z_]+$/.test(e?.message)?e.message:'TECH_CANDIDATE_FAILED');process.exitCode=1;}}
