import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseChainSurveyJson} from '../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {readTechSpreadOriginal,assessTechSpreadPreflight} from './lib/options-tech-spread-preflight.mjs';
export function techSpreadPreflightCli(args){
 if(args.length===1&&args[0]==='--help')return {help:'Saved-original read-only core: --input FILE. Explicit original paths + byte SHA256; no capture/save/arm. Tool-launcher caches are outside the core guarantee.'};
 if(args.length!==2||args[0]!=='--input')throw Error('PREFLIGHT_ARGUMENTS');
 const path=resolve(args[1]),s=fs.lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.size>2e6)throw Error('PREFLIGHT_INPUT_FILE');
 const input=parseChainSurveyJson(fs.readFileSync(path,'utf8'));
 if(!Array.isArray(input.originals)||input.originals.length<1||input.originals.length>2)throw Error('PREFLIGHT_ORIGINAL_COUNT');
 return assessTechSpreadPreflight({...input,originals:input.originals.map(o=>({id:o.id,...readTechSpreadOriginal(o.path,o.sha256)}))});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(techSpreadPreflightCli(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
