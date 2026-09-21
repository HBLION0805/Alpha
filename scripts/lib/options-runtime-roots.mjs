import {realpathSync,statSync} from 'node:fs';
import {resolve} from 'node:path';

// Program location and private evidence location are independent. Imports stay
// relative to the running code; --workspace only selects the existing data root.
export const optionsCodeRoot=realpathSync(resolve(import.meta.dirname,'../..'));
export function contextWorkspaceArgs(input,{defaultRoot=process.cwd(),errorCode='CONTEXT_SERVICE_ARGUMENTS'}={}){
  const args=[];let workspaceRoot=null;
  for(let i=0;i<input.length;i++){
    if(input[i]!=='--workspace'){args.push(input[i]);continue;}
    if(workspaceRoot!==null||!input[i+1]||input[i+1].startsWith('--'))throw Error(errorCode);
    workspaceRoot=input[++i];
  }
  const root=realpathSync(workspaceRoot??defaultRoot);
  if(!statSync(root).isDirectory())throw Error(errorCode);
  return {args,workspaceRoot:root};
}
