import {readFileSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {acceptRealDataPaperCapture} from './lib/options-real-data-paper-capture.mjs';

function parse(argv){
  let workspace=null,input=null;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--workspace'&&argv[i+1]&&!workspace){workspace=argv[++i];continue;}
    if(argv[i]==='--accept'&&argv[i+1]&&!input){input=argv[++i];continue;}
    if(argv[i]==='--help')return {help:true};
    throw Error('REAL_DATA_PAPER_CAPTURE_ARGUMENTS');
  }
  if(!workspace||!input)throw Error('REAL_DATA_PAPER_CAPTURE_ARGUMENTS');
  return {workspace,input};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const p=parse(process.argv.slice(2));
    if(p.help)console.log(JSON.stringify({help:'--accept <saved Host result JSON> --workspace <Alpha root>',executionAllowed:false},null,2));
    else{
      const root=realpathSync(p.workspace),full=realpathSync(p.input),rel=relative(root,full);
      if(isAbsolute(rel)||rel.startsWith('..')||rel==='')throw Error('REAL_DATA_PAPER_CAPTURE_INPUT_PATH');
      const bytes=readFileSync(full);if(bytes.length>8*1024*1024)throw Error('REAL_DATA_PAPER_CAPTURE_INPUT_SIZE');
      const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      console.log(JSON.stringify(await acceptRealDataPaperCapture(root,value),null,2));
    }
  }catch(error){
    console.error(JSON.stringify({status:'SYSTEM_FAILURE',outcomeLabel:'SYSTEM_FAILURE',engineeringAcceptance:'FAILED',code:/^REAL_DATA_PAPER_CAPTURE_[A-Z_]+$/.test(error?.message)?error.message:'REAL_DATA_PAPER_CAPTURE_LOCAL_FAILURE',executionAllowed:false}));
    process.exitCode=2;
  }
}
