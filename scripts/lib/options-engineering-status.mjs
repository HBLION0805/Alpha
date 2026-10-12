import fs from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyMockJournalRecords} from './options-isolated-mock-journal.mjs';
import {replaySpyEngineering} from './options-spy-engineering.mjs';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';

const sha=b=>createHash('sha256').update(b).digest('hex');
const check=(v,c)=>{if(!v)throw Error(c);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(v);
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs,s.nlink].join('|');
const body=r=>r?.structured_content??r?.structuredContent??JSON.parse(r.content.find(x=>x.type==='text').text);
const fields=['DELIVERABLE_COMPONENTS_AND_SHARE_QUANTITY','EXERCISE_STYLE','ADJUSTMENT_STATUS'];

/** Explicit saved acceptance binding. No recovery, locks, sources or journal writes. */
export function readEngineeringStatus({root=process.cwd(),at=new Date().toISOString()}={}){
 const out={version:'ENGINEERING_WORKBENCH_STATUS_V1',state:'MISSING',checkedAt:at,stock:null,options:null,account:null,issues:[],sourceCalls:0,fileSystemWrites:0,executionAllowed:false};
 try{
  const now=snapshotNs(at);let total=0,base=fs.realpathSync(root);
  for(const name of ['data','runtime','options-workbench-development']){base=resolve(base,name);const s=fs.lstatSync(base);check(s.isDirectory()&&!s.isSymbolicLink()&&fs.realpathSync(base)===base,'UNSAFE_PATH');}
  const read=(parts,expected)=>{
   let p=base;for(const [i,n]of parts.entries()){check(/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,99}$/.test(n),'UNSAFE_PATH');p=resolve(p,n);const s=fs.lstatSync(p);check(!s.isSymbolicLink()&&fs.realpathSync(p)===p,'UNSAFE_PATH');if(i<parts.length-1)check(s.isDirectory(),'UNSAFE_PATH');}
   const s=fs.lstatSync(p);check(s.isFile()&&s.nlink===1&&s.size<2e6,'UNSAFE_FILE');total+=s.size;check(total<8e6,'READ_BOUND');const raw=fs.readFileSync(p);check(stamp(s)===stamp(fs.lstatSync(p)),'CHANGED_DURING_READ');const hash=sha(raw);if(parts.length>1)check(digest(expected)&&expected===hash,'HASH_MISMATCH');const text=new TextDecoder('utf8',{fatal:true}).decode(raw);return {raw,data:p.endsWith('.json')?JSON.parse(text):null,hash};
  };
  const registry=read(['engineering-acceptance.json']).data;
  check(registry.version==='ENGINEERING_ACCEPTANCE_BINDING_V1'&&id(registry.accountId)&&id(registry.stock?.runId)&&id(registry.options?.runId),'BINDING_SCOPE');
  check(snapshotNs(registry.savedAt)<=now&&/^[a-f0-9]{40}$/.test(registry.stock.commit)&&registry.stock.commit===registry.options.commit,'BINDING_CLOCK_OR_CODE');
  const a=registry.accountId,s=registry.stock,o=registry.options;
  const stockNames=['event-0001.json','event-0002.json','start.json'];
  const accountPath=resolve(base,a);check(fs.realpathSync(accountPath)===accountPath&&!fs.lstatSync(accountPath).isSymbolicLink(),'UNSAFE_PATH');
  check(same(fs.readdirSync(accountPath).sort(),stockNames),'ACCOUNT_HEAD_CHANGED');
  check(same(Object.keys(registry.accountFiles).sort(),stockNames),'ACCOUNT_BINDING');
  const records=Object.fromEntries(stockNames.map(n=>[n,read([a,n],registry.accountFiles[n])]));
  const verified=verifyMockJournalRecords(records['start.json'].data,stockNames.filter(n=>n.startsWith('event-')).map(name=>({name,value:records[name].data})),'SPY_ENGINEERING_START_V1');
  const saved=read([s.runId,'spy-exit-report-01.json'],s.reportSha256).data;
  check(snapshotNs(saved.asOf)<=now&&verified.manifest.input.account.id===a&&verified.manifest.input.context==='REAL_MARKET_DATA_SIMULATION','STOCK_SCOPE');
  const replay=replaySpyEngineering(verified.manifest.input,verified.events,saved.asOf);
  check(same(replay,saved)&&replay.status==='CLOSED_MODELED'&&replay.positionShares===0,'STOCK_REPLAY');
  const recovery=read([s.runId,'spy-exit-recovery-01.json'],s.recoverySha256).data;
  check(recovery.status==='FRESH_PROCESS_EXACT_REPORT_MATCH'&&recovery.reportSha256===sha(JSON.stringify(replay))&&snapshotNs(recovery.savedAt)<=now,'RECOVERY_BINDING');
  const terminal=read([s.runId,'spy-terminal-01.json'],s.terminalSha256).data;
  check(terminal.code===s.commit&&terminal.runId===s.runId&&same(terminal.report,replay)&&terminal.independentReview?.status==='PASS'&&snapshotNs(terminal.savedAt)<=now,'TERMINAL_BINDING');
  const result=read([o.runId,'preflight-result-01.json'],o.reportSha256).data;
  check(result.version==='OPTION_ENGINEERING_PREFLIGHT_RESULT_V1'&&result.runId===o.runId&&result.code===o.commit&&snapshotNs(result.savedAt)<=now&&result.status==='BLOCKED_EXACT_CONTRACT_EVIDENCE','OPTION_RESULT_SCOPE');
  check(result.account.id===a&&same(result.account.parentFiles,registry.accountFiles)&&result.account.parentTipSha256===verified.tip,'OPTION_PARENT_BINDING');
  for(const [key,value]of [['settledCashCents',replay.account.settledCashMicros/10000],['unsettledCashCents',replay.account.unsettledProceedsMicros/10000],['totalCashCents',replay.account.totalCashMicros/10000]])check(result.account[key]===value,'OPTION_FUNDS_BINDING');
  check(result.paperStatus==='NOT_STARTED'&&result.quoteStatus==='NOT_REQUESTED_PRE_ENTRY_BLOCKED'&&result.simulatedFills===0&&result.realBrokerOrders===0&&result.journalWrites===0&&result.sourcePriceCalls===0&&result.entryT0===null&&same(result.missingExactSeriesFields,fields),'OPTION_NO_ENTRY');
  const scope=read([o.runId,'preflight-scope-01.json'],result.metadata.scopeFileSha256).data;
  check(scope.candidate.symbol==='SPY'&&scope.candidate.expiry===result.candidate.expiry&&scope.candidate.longStrike==='778'&&scope.candidate.shortStrike==='779'&&snapshotNs(scope.savedAt)<=snapshotNs(result.savedAt),'OPTION_SELECTION');
  const receipts=[];
  for(const phase of ['chain','leg778','leg779']){
   const dir='metadata-'+phase,m=read([o.runId,dir,'manifest.json'],o.metadataManifests[phase]).data;
   const expected=['events.json','host-prompt.txt','host-stderr.txt','host.jsonl','intent.json','receipt.json'];
   check(same(m.files.map(f=>f.name).sort(),expected)&&snapshotNs(m.savedAt)<=snapshotNs(result.savedAt),'METADATA_MANIFEST');
   const originals={};for(const f of m.files)originals[f.name]=read([o.runId,dir,f.name],f.sha256);
   const receipt=originals['receipt.json'].data,intent=originals['intent.json'].data,events=originals['events.json'].data;
   check(receipt.status==='PASS_ONE_EXACT_METADATA_CALL'&&receipt.startedCalls===1&&receipt.error===null&&receipt.exitCode===0&&intent.scopeSha256===result.metadata.scopeFileSha256,'METADATA_CALL');
   const starts=events.filter(e=>e.event.type==='item.started'&&e.event.item?.type==='mcp_tool_call'),ends=events.filter(e=>e.event.type==='item.completed'&&e.event.item?.type==='mcp_tool_call');
   check(starts.length===1&&ends.length===1&&starts[0].event.item.id===ends[0].event.item.id&&same(starts[0].event.item.arguments,intent.request)&&same(receipt.request,intent.request)&&same(ends[0].event.item.result,receipt.response),'METADATA_SOURCE_BINDING');
   const want=phase==='chain'?'get_option_chains':'get_option_instruments';
   check([starts[0],ends[0]].every(e=>e.event.item.server==='robinhood_alpha_market_data'&&e.event.item.tool===want)&&receipt.requestedAt===starts[0].observedAt&&receipt.receivedAt===ends[0].observedAt&&snapshotNs(receipt.requestedAt)>=snapshotNs(scope.savedAt)&&snapshotNs(receipt.receivedAt)>=snapshotNs(receipt.requestedAt),'METADATA_CLOCK_OR_TOOL');
   const clocks=[scope.savedAt,intent.savedAt,receipt.startedAt,receipt.requestedAt,receipt.receivedAt,receipt.finishedAt,m.savedAt,result.savedAt,at].map(snapshotNs);
   check(clocks.every((t,i)=>i===0||t>=clocks[i-1])&&same(ends[0].event.item.arguments,intent.request),'METADATA_CLOCK_OR_TOOL');
   check(events.every(e=>!e.event.type?.startsWith('item.')||['reasoning','agent_message'].includes(e.event.item?.type)||e.event.item?.type==='mcp_tool_call'&&e.event.item.server==='robinhood_alpha_market_data'&&e.event.item.tool===want&&same(e.event.item.arguments,intent.request)),'METADATA_UNEXPECTED_ACTION');
   check(same(originals['host.jsonl'].raw.toString().trim().split(/\r?\n/).map(JSON.parse),events.map(e=>e.event)),'METADATA_TRANSCRIPT');
   receipts.push(receipt);
  }
  const chain=body(receipts[0].response).data.chains;
  check(same(receipts[0].request,{underlying_symbol:'SPY'}),'CHAIN_REQUEST');
  check(chain.length===1&&same(chain[0],result.metadata.chain)&&chain[0].symbol==='SPY','CHAIN_IDENTITY');
  for(const [i,key,strike]of [[1,'long','778.0000'],[2,'short','779.0000']]){
   const rows=body(receipts[i].response).data.instruments,leg=result.candidate[key];
   check(rows.length===1&&same(rows[0],leg)&&leg.chain_id===chain[0].id&&leg.chain_symbol==='SPY'&&leg.expiration_date===scope.candidate.expiry&&leg.strike_price===strike&&leg.type==='call','LEG_IDENTITY');
   check(same(receipts[i].request,{chain_id:chain[0].id,expiration_dates:scope.candidate.expiry,strike_price:strike,type:'call',state:'active',tradability:'tradable'}),'LEG_REQUEST');
   check(!['deliverable','exercise_style','adjustment_status'].some(k=>Object.hasOwn(leg,k)),'OPTION_MISSING_FIELD_CLAIM_CHANGED');
  }
  out.state='AVAILABLE';
  const quoteClocks=verified.events.map(e=>{const c=JSON.parse(JSON.parse(e.source.originalsRawJson)['capture.json']),q=body(c.response).data.results[0].quote;return {action:e.quote.action,requestedAt:c.requestedAt,receivedAt:c.receivedAt,sourceBidAt:q.venue_bid_time,sourceAskAt:q.venue_ask_time};});
  out.stock={runId:s.runId,commit:s.commit,status:replay.status,acceptance:'PASS_ENGINEERING_ONLY',decisionAt:verified.manifest.input.decisionAt,entry:replay.entry,exit:replay.exit,quantity:1,symbol:'SPY',positionShares:0,netPnlMicros:replay.account.netPnlMicros,recovery:'EXACT_REPORT_MATCH',independentReview:'PASS',reportSha256:s.reportSha256,sourceCalls:2,quoteClocks};
  out.account={id:a,settledCashMicros:replay.account.settledCashMicros,unsettledProceedsMicros:replay.account.unsettledProceedsMicros,totalCashMicros:replay.account.totalCashMicros,unsettledUsableForEntry:false,newDepositsMicros:0,headSha256:verified.tip};
  out.options={runId:o.runId,commit:o.commit,status:result.status,paperStatus:'NOT_STARTED',savedAt:result.savedAt,symbol:'SPY',expiry:result.candidate.expiry,structure:'CDS',longStrike:result.candidate.long.strike_price,shortStrike:result.candidate.short.strike_price,missingExactSeriesFields:fields,metadataCalls:3,quoteCalls:0,simulatedFills:0,metadataClocks:receipts.map(r=>({requestedAt:r.requestedAt,receivedAt:r.receivedAt})),reportSha256:o.reportSha256};
  check(same(fs.readdirSync(accountPath).sort(),stockNames)&&stockNames.every(n=>read([a,n],registry.accountFiles[n]).hash===registry.accountFiles[n]),'ACCOUNT_HEAD_CHANGED');
 }catch(e){if(e.code==='ENOENT'&&!fs.existsSync(resolve(root,'data/runtime/options-workbench-development/engineering-acceptance.json')))return out;out.state='BLOCKED';out.stock=null;out.options=null;out.account=null;out.issues=[/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'INVALID_SAVED_ENGINEERING_EVIDENCE'];}
 return out;
}
