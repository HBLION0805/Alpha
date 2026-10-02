import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export async function collectCpiMarketEvidence({call,clock}){
  const iso=async()=>{const x=await clock();if(typeof x!=='string'||!Number.isFinite(Date.parse(x)))throw Error('CPI_HOST_CLOCK');return new Date(x).toISOString();};
  const startedAt=await iso(),requestedAt=await iso();
  let response,failures=[];
  try{response=await call('get_equity_quotes',{symbols:['GLD','IBIT']});}
  catch{failures.push({tool:'get_equity_quotes',code:'MARKET_SOURCE_FAILED'});response={data:{results:[]}};}
  const receivedAt=await iso(),capturedAt=await iso();
  return {version:'CPI_MARKET_CAPTURE_V1',origin:'ROBINHOOD_MARKET_TOOL_RESPONSE',startedAt,capturedAt,calls:1,receipts:[{tool:'get_equity_quotes',request:{symbols:['GLD','IBIT']},requestedAt,receivedAt,response}],failures,accountAccessed:false,executionAllowed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.length!==3||process.argv[2]!=='--source'){console.error('CPI_MARKET_HOST_ARGUMENTS');process.exitCode=2;}
  else console.log(JSON.stringify({version:'CPI_MARKET_HOST_SOURCE_V1',source:String(collectCpiMarketEvidence),allowedTools:['get_equity_quotes'],symbols:['GLD','IBIT'],accountAccessed:false,executionAllowed:false},null,2));
}
