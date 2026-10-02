import {startOptionsWorkbench} from './options-workbench.mjs';

// Isolated loopback preview. The stable 4173 runtime and source schedules stay unchanged.
// No source refresh starts from this preview; evidence is read from existing local stores.
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--workspace'){
  console.error('Usage: tsx scripts/options-event-intelligence-preview.mjs --workspace <Alpha-data-root>');
  process.exitCode=2;
}else{
  const app=await startOptionsWorkbench({workspaceRoot:args[1],port:4174,refreshContext:false});
  console.log(JSON.stringify({previewUrl:app.url,sourceRefreshEnabled:false,stableRuntimePort:4173,executionAllowed:false}));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));
}
