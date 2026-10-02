import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {acceptCpiMarketFile} from './lib/options-cpi-market-evidence.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const args=process.argv.slice(2),i=args.indexOf('--workspace'),j=args.indexOf('--accept');
    if(i<0||j<0||!args[i+1]||!args[j+1]||args.length!==4)throw Error('CPI_MARKET_ARGUMENTS');
    console.log(JSON.stringify(acceptCpiMarketFile(args[i+1],args[j+1]),null,2));
  }catch(error){console.error(JSON.stringify({status:'ERROR',code:/^CPI_MARKET_[A-Z_]+$/.test(error?.message)?error.message:'CPI_MARKET_LOCAL_FAILURE',executionAllowed:false}));process.exitCode=2;}
}
