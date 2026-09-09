import {explainError} from './model.js';
const ROUTES=new Set(['/api/state','/api/preview','/api/save','/api/evaluate','/api/initialize','/api/guidance-settings','/api/event-research','/api/candidate-checks','/api/cost-desk','/api/capital-policy']);
let session=null;
export async function request(path,body){
  const url=new URL(path,location.origin);
  if(url.origin!==location.origin||!ROUTES.has(url.pathname))throw Error('Unsupported local request.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
    const response=await fetch(url.pathname+url.search,{method:body===undefined?'GET':'POST',mode:'same-origin',credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal,
      headers:body===undefined?{}:{'Content-Type':'application/json','X-Alpha-Session':session??''},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json();if(!response.ok)throw Error(explainError(data.error));
    if(data.session){session=data.session;delete data.session;}return data;
  }catch(e){if(e.name==='AbortError')throw Error(url.pathname==='/api/candidate-checks'?'The snapshot request timed out. Reload saved data and check Saved check snapshots before saving again.':'The local request timed out. A save may have completed; retry the same preview to check it.');if(e instanceof TypeError)throw Error('Cannot reach Alpha. Start the local workbench, then retry. Your current draft is retained.');throw e;}finally{clearTimeout(timer);}
}
