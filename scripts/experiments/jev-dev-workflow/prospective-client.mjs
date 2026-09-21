// Developer experiment only. Preserve the historical client's fingerprint.
import {MODEL,SERVED_MODEL,ENDPOINT,QUESTIONS,hash,buildRequest,parseDecision,deterministic} from './decision.mjs';

export const PHASE_QUESTIONS=Object.freeze({
  OWNER_GATE:{...QUESTIONS.OWNER_GATE,criteria:{...QUESTIONS.OWNER_GATE.criteria,UNKNOWN:'Available evidence cannot distinguish whether an essential Owner decision is needed. Do not treat this as permission to continue.'}},
  TRIAGE:QUESTIONS.TRIAGE
});

export function prospectiveRequest(input,key='') {
  if(!Object.hasOwn(PHASE_QUESTIONS,input.decisionType))throw new Error('FAMILY_NOT_ALLOWED');
  const body=buildRequest(input,key);
  body.questions.decision={type:'choice',...PHASE_QUESTIONS[input.decisionType]};
  if(Buffer.byteLength(JSON.stringify(body))>16000)throw new Error('INPUT_BOUND');
  return body;
}

// Same fixed endpoint, provider, price ceiling and transport bounds as v2.
// Separate adapter permits OWNER_GATE UNKNOWN without rewriting v1/v2 evidence.
export async function prospectiveInference(input,{key,fetcher=fetch,timeoutMs=15000}={}) {
  const base={shadowOnly:true,executionAllowed:false,requestedModel:MODEL,expectedServedModel:SERVED_MODEL,decision:'UNKNOWN',requestMade:false};
  const local=deterministic(input);
  if(!local.eligible)return {...base,...local};
  if(!key?.trim())return {...base,error:'MISSING_API_KEY'};
  let body;
  try{body=JSON.stringify(prospectiveRequest(input,key));}catch{return {...base,error:'UNSAFE_OR_INVALID_INPUT'};}
  const startedAt=new Date().toISOString(),start=performance.now(),controller=new AbortController();
  let response,data,parsed={},timer,error=null;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('TIMEOUT'));},timeoutMs);});
  try{
    response=await Promise.race([fetcher(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body,redirect:'error',signal:controller.signal}),deadline]);
    if(!response.ok)error='HTTP_'+response.status;
    else{
      const chunks=[];let length=0;
      await Promise.race([(async()=>{for await(const chunk of response.body){length+=chunk.length;if(length>65536){controller.abort();throw new Error('RESPONSE_BOUND');}chunks.push(chunk);}})(),deadline]);
      const raw=Buffer.concat(chunks).toString('utf8');
      if(raw.includes(key))error='SECRET_IN_RESPONSE';
      else{
        try{data=JSON.parse(raw);}catch{error='MALFORMED_RESPONSE';}
        if(!error){
          if(data?.model!==SERVED_MODEL||data?.provider!=='TypeSafe')error='MODEL_OR_PROVIDER_MISMATCH';
          else{try{parsed=parseDecision(data,PHASE_QUESTIONS[input.decisionType]);}catch{error='MALFORMED_RESPONSE';}}
        }
      }
    }
  }catch{error=controller.signal.aborted?'TIMEOUT_OR_RESPONSE_BOUND':'TRANSPORT_ERROR';}
  finally{clearTimeout(timer);}
  const value=name=>typeof data?.usage?.[name]==='number'&&Number.isFinite(data.usage[name])&&data.usage[name]>=0?data.usage[name]:null;
  const usage={inputTokens:value('input_tokens'),outputTokens:value('output_tokens'),costUsd:value('cost')};
  if(!error&&usage.costUsd===null)error='COST_UNKNOWN';
  return {...base,...(error?{}:parsed),error,requestMade:true,startedAt,receivedAt:new Date().toISOString(),
    latencyMs:Math.round((performance.now()-start)*1000)/1000,httpStatus:response?.status??null,
    requestSha256:hash(body),servedModel:data?.model===SERVED_MODEL?SERVED_MODEL:null,
    provider:data?.provider==='TypeSafe'?'TypeSafe':null,
    requestId:typeof data?.id==='string'&&/^gen-dec-[A-Za-z0-9-]{1,120}$/.test(data.id)?data.id:null,usage};
}
