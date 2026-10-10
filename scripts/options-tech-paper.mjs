import {readFileSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {assessTechPaperFeasibility} from './lib/options-tech-paper-feasibility.mjs';
import {parseChainSurveyJson} from '../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
function input(path){
  const file=resolve(path),s=lstatSync(file);
  if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>1024*1024)throw Error('TECH_PAPER_INPUT_FILE');
  const raw=readFileSync(file),text=new TextDecoder('utf8',{fatal:true}).decode(raw);
  return {path:file,sha256:createHash('sha256').update(raw).digest('hex'),utf8:text,data:parseChainSurveyJson(text)};
}
export function techPaperCli(args,{root=process.cwd(),now=()=>new Date().toISOString()}={}){
  if(args.length===1&&args[0]==='--help')return {usage:'--research FILE [--evidence FILE] [--out NEW_IGNORED_FILE]',scope:['AAPL','TSM','QQQ','TSLA'],mode:'FEASIBILITY_ONLY_NO_ARM'};
  const p={};
  for(let i=0;i<args.length;i++){
    const key=args[i];if(!['--research','--evidence','--out'].includes(key)||p[key]||!args[i+1]||args[i+1].startsWith('--'))throw Error('TECH_PAPER_ARGUMENTS');
    p[key]=args[++i];
  }
  if(!p['--research'])throw Error('TECH_PAPER_ARGUMENTS');
  const research=input(resolve(root,p['--research'])),evidence=p['--evidence']?input(resolve(root,p['--evidence'])):null;
  const at=now(),assessment=assessTechPaperFeasibility({research:research.data,evidence:evidence?.data??null,at});
  if(p['--out']){
    const allowed=resolve(realpathSync(root),'data/runtime/options-workbench-development');
    const out=resolve(root,p['--out']),parent=realpathSync(dirname(out));
    if(!out.startsWith(allowed+sep)||!(parent===allowed||parent.startsWith(allowed+sep)))throw Error('TECH_PAPER_OUTPUT_SCOPE');
    writeFileSync(out,JSON.stringify({version:'TECH_PAPER_FEASIBILITY_RECEIPT_V1',recordedAt:at,
      sources:{research,evidence},assessment},null,2)+'\n',{flag:'wx',mode:0o600});
    return {...assessment,receiptPath:out};
  }
  return assessment;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(techPaperCli(process.argv.slice(2)),null,2));}
  catch(e){console.error(/^TECH_PAPER_[A-Z_]+$/.test(e?.message)?e.message:'TECH_PAPER_CLI_FAILED');process.exitCode=1;}
}
