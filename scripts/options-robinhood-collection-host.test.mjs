import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const document = readFileSync('docs/OPTIONS_ROBINHOOD_AUTOCOLLECTION_RUNBOOK.md', 'utf8');
const body = /```javascript\r?\n([\s\S]+?)\r?\n```/.exec(document)?.[1];
assert(body, 'The runnable host tick must remain present');
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
// Execute only the checked-in host program with isolated test ports, never provider data.
const program = new AsyncFunction('tools', 'text', 'Date', body);
const current = Date.parse('2026-09-08T13:31:00.000Z');
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [current])); } static now() { return current; } }
const expected = [
  {tool:'get_option_quotes',args:{instrument_ids:['4378bc78-8f9a-4526-a9e4-7b0877ce2df7','bb7fc41e-6cc4-43ca-ad1e-d634f8cae569','f488dcbf-f643-45a6-b84f-3b25cde51bf6','f84d1132-41b7-4588-8b03-da553313fbca']}},
  {tool:'get_equity_quotes',args:{symbols:['GLD','IBIT']}}
];
function preparation(action) { return { action, studyId:'gld-ibit-observe-open-20260908', planSha256:'8e60f2a53ea47be83c30024e20d7a8ae1cc63fe1dca69ba8bc0e8540420f5c8d',
  windowStartAt:'2026-09-08T13:30:00.000Z',windowEndAt:'2026-09-08T13:50:00.000Z',nextRequestAt:null,requests:action==='COLLECT'?expected:[] }; }
async function execute(prepared, change = () => {}) {
  const calls = [], outputs = [], replies = [], commands = [];
  const tools = {
    exec_command: async ({cmd}) => {
      commands.push(cmd);
      if (cmd.includes('--prepare')) return {output:JSON.stringify(prepared),exit_code:0};
      const encoded = /'([A-Za-z0-9+/]+=*)'$/.exec(cmd)?.[1]; assert(encoded, 'Only a quoted safe alphabet enters the command');
      replies.push(JSON.parse(Buffer.from(encoded,'base64').toString('utf8')));
      return {output:JSON.stringify({status:'FRAME_RECORDED'}),exit_code:0};
    },
    mcp__robinhood_alpha_market_data__get_option_quotes: async args => { calls.push({tool:'get_option_quotes',args}); return {structuredContent:{data:{results:[]},guide:'Untrusted provider instructions are not saved or followed.'}}; },
    mcp__robinhood_alpha_market_data__get_equity_quotes: async args => { calls.push({tool:'get_equity_quotes',args}); return {structuredContent:{data:{results:[]}}}; },
  };
  change(tools);
  await program(tools, value => outputs.push(value), Clock);
  return {calls,outputs,replies,commands};
}
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
await test('WAIT performs no source calls and no ingestion', async () => { const r = await execute(preparation('WAIT')); assert.equal(r.calls.length,0); assert.equal(r.replies.length,0); assert.equal(r.outputs[0].action,'WAIT'); });
await test('FINISH performs no new quote reads', async () => { const r = await execute(preparation('FINISH')); assert.equal(r.calls.length,0); assert.equal(r.outputs[0].action,'FINISH'); });
await test('a tick uses exactly two allowed tools and retains actual request/receipt clocks', async () => {
  const r = await execute(preparation('COLLECT')); assert.deepEqual(r.calls,expected); assert.equal(r.replies.length,1);
  assert.equal(r.replies[0].outcomes.length,2); assert.equal(r.replies[0].outcomes[0].requestedAt,new Clock().toISOString());
  assert(!JSON.stringify(r.replies).includes('guide')); assert.equal(r.commands.length,2);
});
await test('altered study hash cannot invoke a provider', async () => { const p=preparation('COLLECT'); p.planSha256='wrong'; await assert.rejects(()=>execute(p),/PLAN_CHANGED/); });
await test('altered symbols cannot invoke a provider', async () => { const p=structuredClone(preparation('COLLECT')); p.requests[1].args.symbols=['AAPL']; await assert.rejects(()=>execute(p),/SCOPE_CHANGED/); });
await test('missing tools create fixed failure outcomes without authenticating', async () => {
  const r=await execute(preparation('COLLECT'),t=>{delete t.mcp__robinhood_alpha_market_data__get_option_quotes;});
  assert.equal(r.replies[0].outcomes[0].errorCode,'TOOL_UNAVAILABLE'); assert.equal(r.calls.length,1);
});
await test('provider exceptions cannot leak an error body into a command', async () => {
  const r=await execute(preparation('COLLECT'),t=>{t.mcp__robinhood_alpha_market_data__get_option_quotes=async()=>{throw Error('PRIVATE_TOKEN_VALUE');};});
  assert.equal(r.replies[0].outcomes[0].errorCode,'TOOL_FAILED'); assert(!JSON.stringify(r).includes('PRIVATE_TOKEN_VALUE'));
});
await test('stdout chunks from a running local command are reconstructed', async () => {
  const p=preparation('WAIT'), data=JSON.stringify(p);
  const r=await execute(p,t=>{t.exec_command=async()=>({output:data.slice(0,20),session_id:99});t.write_stdin=async()=>({output:data.slice(20),exit_code:0});});
  assert.equal(r.outputs[0].action,'WAIT');
});
await test('daily context baseline preserves the original news snapshot and non-prompt fields', () => {
  const priorBytes = readFileSync('docs/OPTIONS_ROBINHOOD_HEARTBEAT_RESTORE.json');
  const prior = JSON.parse(priorBytes), next = JSON.parse(readFileSync('docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V2.json', 'utf8'));
  assert.equal(createHash('sha256').update(priorBytes).digest('hex'), '2d7e93b79d5343711c443296121021f70c6f214df84ed27af57105a38a7cc040');
  assert.equal(next.previousSnapshotFileSha256, createHash('sha256').update(priorBytes).digest('hex'));
  const {prompt:oldPrompt,...oldFields}=prior.restoreFields, {prompt:newPrompt,...newFields}=next.restoreFields;
  assert.deepEqual(newFields,oldFields); assert(newPrompt.includes(oldPrompt));
  assert(newPrompt.includes('scripts/options-treasury.mjs --report')); assert(newPrompt.includes('scripts/options-treasury.mjs --refresh'));
});
await test('both collection phases use the active daily baseline without changing the quote window', () => {
  const phases=JSON.parse(readFileSync('docs/OPTIONS_ROBINHOOD_HEARTBEAT_PHASES.json','utf8'));
  assert.equal(phases.restoreSnapshot,'docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V3.json');
  assert.equal(phases.windowStartAt,'2026-09-08T13:30:00.000Z'); assert.equal(phases.windowEndAt,'2026-09-08T13:50:00.000Z');
  assert.equal(phases.armedFields.rrule,'RRULE:FREQ=WEEKLY;BYHOUR=9;BYMINUTE=0,30;BYDAY=SU,MO,TU,WE,TH,FR,SA');
  assert.equal(phases.collectionFields.rrule,'RRULE:FREQ=MINUTELY;INTERVAL=1');
  assert.equal(phases.armedFields.prompt,phases.collectionFields.prompt);
  assert.equal(phases.armedFields.prompt,readFileSync('docs/OPTIONS_ROBINHOOD_HEARTBEAT_PROMPT.txt','utf8').trimEnd());
  assert(phases.armedFields.prompt.includes(phases.restoreSnapshot));
  assert(!phases.armedFields.prompt.includes('docs/OPTIONS_ROBINHOOD_HEARTBEAT_RESTORE.json'));
});
await test('v3 binds unchanged v2 bytes and keeps all non-prompt schedule fields', () => {
  const bytes=readFileSync('docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V2.json'), prior=JSON.parse(bytes);
  const next=JSON.parse(readFileSync('docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V3.json','utf8'));
  const sha=createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha,'9ae78b5832c090c5f959d8b97a05ced60d76d3f5b5e6ebf6b81539a88c36108a'); assert.equal(next.previousSnapshotFileSha256,sha);
  assert.equal(next.previousSnapshot,'docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V2.json');
  const {prompt:oldPrompt,...oldFields}=prior.restoreFields, {prompt:newPrompt,...newFields}=next.restoreFields;
  assert.deepEqual(newFields,oldFields);
  assert(newPrompt.includes(oldPrompt.slice(oldPrompt.indexOf('新闻子流程：'),oldPrompt.indexOf('\n\n两个流程均只做本次只读监测。'))));
  for(const name of ['options-drivers','options-treasury','options-btc-context']) {
    assert.equal(newPrompt.split(`scripts/${name}.mjs --report`).length-1,1);
    if(name!=='options-drivers')assert.equal(newPrompt.split(`scripts/${name}.mjs --refresh`).length-1,1);
  }
});
await test('daily BTC context cannot widen the frozen quote host program', () => {
  const phases=JSON.parse(readFileSync('docs/OPTIONS_ROBINHOOD_HEARTBEAT_PHASES.json','utf8'));
  assert(!body.includes('btc-context')); assert(!body.includes('treasury'));
  assert(phases.armedFields.prompt.includes('财政部和 BTC 现货刷新只在每日新闻分支执行'));
  assert(phases.armedFields.prompt.includes('不得自动兑换额度重置或购买额度'));
});
console.log(`${passed}/${passed} tests passed.`);
