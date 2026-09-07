import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runRobinhoodObserveCommand as observe } from './options-robinhood-observe.mjs';
import { runRobinhoodCollectCommand as collect } from './options-robinhood-collect.mjs';
import { runRobinhoodCloseoutCommand as closeout } from './options-robinhood-closeout.mjs';

const root = resolve(import.meta.dirname, '..');
const HOST_SHA = '2e3a24d5ca223922d001047b58aaa689d17575e60dd0e89908daa14655ec4def';
const PRODUCTION_IDS = ['4378bc78-8f9a-4526-a9e4-7b0877ce2df7', 'bb7fc41e-6cc4-43ca-ad1e-d634f8cae569', 'f488dcbf-f643-45a6-b84f-3b25cde51bf6', 'f84d1132-41b7-4588-8b03-da553313fbca'];
const IDS = [2, 3, 5, 6].map(n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0'));
const FROZEN = '2026-09-04T14:00:10.000Z', START = '2026-09-04T14:01:00.000Z', END = '2026-09-04T14:21:00.000Z';
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const save = (path, value) => writeFileSync(path, json(value), { flag: 'wx' });
const fail = code => { throw Error('COLLECTION_REHEARSAL_' + code); };
function hostBody(document) {
  const bodies = [...document.matchAll(/```javascript\r?\n([\s\S]+?)\r?\n```/g)];
  if (bodies.length !== 1) fail('HOST_BLOCK');
  const body = bodies[0][1].replaceAll('\r\n', '\n');
  if (sha(body) !== HOST_SHA) fail('HOST_PROGRAM_CHANGED');
  return body;
}
function bindHost(body, directory, studyId, planSha256) {
  if (sha(body) !== HOST_SHA) fail('HOST_PROGRAM_CHANGED');
  const bindings = [
    ['const workspace = String.raw`C:\\Users\\liuha\\.codex\\worktrees\\8f09\\Alpha`;', 'const workspace = ' + JSON.stringify(directory) + ';'],
    ['"gld-ibit-observe-open-20260908"', JSON.stringify(studyId)],
    ['"8e60f2a53ea47be83c30024e20d7a8ae1cc63fe1dca69ba8bc0e8540420f5c8d"', JSON.stringify(planSha256)],
    ...PRODUCTION_IDS.map((id, i) => [JSON.stringify(id), JSON.stringify(IDS[i])]),
  ];
  let result = body;
  for (const [old, next] of bindings) { if (result.split(old).length !== 2) fail('HOST_BINDING'); result = result.replace(old, () => next); }
  return { body: result, originalHostSha256: HOST_SHA, syntheticHostSha256: sha(result), substitutions: ['WORKSPACE', 'STUDY_ID', 'PLAN_SHA256', 'FOUR_SYNTHETIC_CONTRACT_IDS'], controlFlowChanged: false };
}
function fixture(studyId) {
  const source = JSON.parse(readFileSync(join(root, 'fixtures/options-robinhood-data/capture.synthetic.json'), 'utf8'));
  const config = JSON.parse(readFileSync(join(root, 'fixtures/options-robinhood-data/observation-plan.synthetic.json'), 'utf8'));
  const old = tool => source.calls.find(c => c.tool === tool), calls = [];
  for (const [index, symbol] of ['GLD', 'IBIT'].entries()) {
    const chainId = '00000000-0000-4000-8000-' + String(index ? 4 : 1).padStart(12, '0');
    const chain = structuredClone(old('get_option_chains'));
    chain.args.underlying_symbol = symbol; chain.data.chains[0].id = chainId; chain.data.chains[0].symbol = symbol;
    chain.data.chains[0].underlying_instruments[0].symbol = symbol; calls.push(chain);
    for (let side = 0; side < 2; side++) {
      const call = structuredClone(old('get_option_instruments')), instrument = call.data.instruments[0];
      call.args.chain_id = chainId; call.args.strike_price = index ? '50' : '410';
      instrument.id = IDS[index * 2 + side]; instrument.chain_id = chainId; instrument.chain_symbol = symbol;
      instrument.strike_price = call.args.strike_price + '.0000'; instrument.type = side ? 'put' : 'call'; calls.push(call);
    }
  }
  const options = structuredClone(old('get_option_quotes')); options.args.instrument_ids = IDS;
  options.data.results = IDS.map((id, i) => { const result = structuredClone(old('get_option_quotes').data.results[0]); result.quote.instrument_id = id; result.quote.bid_price = '0.18'; result.quote.ask_price = '0.20'; result.close.instrument_id = id; result.close.symbol = i < 2 ? 'GLD' : 'IBIT'; return result; });
  const equities = structuredClone(old('get_equity_quotes')); equities.args.symbols = ['GLD', 'IBIT'];
  equities.data.results = ['GLD', 'IBIT'].map(symbol => { const result = structuredClone(old('get_equity_quotes').data.results[0]); result.quote.symbol = symbol; if (symbol === 'IBIT') { result.quote.bid_price = '49.99'; result.quote.ask_price = '50.00'; } return result; });
  calls.push(options, equities);
  source.captureId = studyId + '-source'; source.calls = calls;
  config.studyId = studyId; config.instrumentIds = IDS; config.windowStartAt = START; config.windowEndAt = END;
  return { source, config, optionTemplate: options.data, equityTemplate: equities.data };
}
const expectedCounts = {
  healthy: { attempts: 20, failures: 0, frames: 20, usableSlots: 20, usableObservations: 80 },
  mixed: { attempts: 19, failures: 2, frames: 17, usableSlots: 13, usableObservations: 58 },
  slow: { attempts: 10, failures: 0, frames: 10, usableSlots: 0, usableObservations: 0 },
};
async function scenario(directory, name, originalBody) {
  mkdirSync(directory); const studyId = 'synthetic-host-' + name, f = fixture(studyId);
  save(join(directory, 'source.json'), f.source); save(join(directory, 'config.json'), f.config);
  let current = Date.parse(FROZEN), slot = -1, sourceCalls = 0, localCommands = 0;
  const time = () => new Date(current).toISOString(), opts = () => ({ workspaceRoot: directory, now: time });
  const frozen = observe(['--freeze', 'config.json', '--source', 'source.json'], opts());
  const pre = closeout(['--save', studyId], opts()), prePath = resolve(directory, pre.persistence.path), preBytes = readFileSync(prePath);
  const binding = bindHost(originalBody, directory, studyId, frozen.planSha256);
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const program = new AsyncFunction('tools', 'text', 'Date', 'setTimeout', binding.body);
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [current])); } static now() { return current; } }
  const events = [], sourceOutcomes = [], simulatedTimers = [];
  const prefix = 'node node_modules/tsx/dist/cli.mjs scripts/options-robinhood-collect.mjs ';
  const tools = {
    exec_command: async ({ cmd, workdir }) => {
      if (workdir !== directory || !cmd.startsWith(prefix)) fail('LOCAL_SCOPE'); localCommands++;
      const suffix = cmd.slice(prefix.length); let args;
      if (suffix === '--prepare ' + studyId) args = ['--prepare', studyId];
      else { const match = new RegExp("^--accept-base64 " + studyId + " '([A-Za-z0-9+/]*={0,2})'$").exec(suffix); if (!match) fail('LOCAL_COMMAND'); args = ['--accept-base64', studyId, match[1]]; }
      return { output: JSON.stringify(collect(args, opts())), exit_code: 0 };
    },
  };
  for (const tool of ['get_option_quotes', 'get_equity_quotes']) tools['mcp__robinhood_alpha_market_data__' + tool] = async args => {
    const requestAt = current, expected = tool === 'get_option_quotes' ? { instrument_ids: IDS } : { symbols: ['GLD', 'IBIT'] };
    if (JSON.stringify(args) !== JSON.stringify(expected)) fail('SYNTHETIC_SOURCE_SCOPE'); sourceCalls++;
    const latency = name === 'slow' ? 70000 : name === 'mixed' && slot === 19 ? 65000 : 750;
    await Promise.resolve(); current = Math.max(current, requestAt + latency);
    const error = name === 'mixed' && (slot === 1 && tool === 'get_option_quotes' || slot === 7 && tool === 'get_equity_quotes');
    sourceOutcomes.push({ slot, tool, requestedAt: new Date(requestAt).toISOString(), receivedAt: time(), scenarioOutcome: error ? 'INJECTED_EXCEPTION' : 'SYNTHETIC_RESPONSE' });
    if (error) throw Error('INJECTED_PRIVATE_PROVIDER_MESSAGE');
    const data = structuredClone(tool === 'get_option_quotes' ? f.optionTemplate : f.equityTemplate);
    const sourceTime = new Date(requestAt - (name === 'mixed' && slot === 4 && tool === 'get_option_quotes' ? 120000 : 0)).toISOString();
    if (tool === 'get_option_quotes') {
      data.results.forEach(r => { r.quote.updated_at = sourceTime; });
      if (name === 'mixed' && slot === 5) data.results[0].quote.ask_size = 0;
      if (name === 'mixed' && slot === 8) data.results.pop();
    } else data.results.forEach(r => { r.quote.venue_bid_time = sourceTime; r.quote.venue_ask_time = sourceTime; });
    return { structuredContent: { data, guide: 'INJECTED_UNTRUSTED_GUIDE' } };
  };
  const tick = async () => {
    await program(tools, value => events.push({ slot, scenarioAt: time(), result: value }), Clock, (callback, delay) => { if (!Number.isFinite(delay) || delay < 0 || delay > 15100) fail('SIMULATED_TIMER'); simulatedTimers.push(delay); current += delay; callback(); });
  };
  await tick(); // The pre-window host path must perform no fake source calls.
  for (slot = 0; slot < 20; slot++) {
    const scheduledAt = Date.parse(START) + slot * 60000;
    if (current > scheduledAt || name === 'mixed' && slot === 3) { events.push({ slot, scheduledAt: new Date(scheduledAt).toISOString(), scenarioAt: time(), skipped: current > scheduledAt ? 'PRIOR_TICK_BUSY_IN_DECLARED_MODEL' : 'DECLARED_MISSED_WAKE' }); continue; }
    current = scheduledAt; await tick();
  }
  current = Math.max(current, Date.parse(END)); await tick();
  const saved = closeout(['--save', studyId], opts()), reopened = closeout(['--report', studyId], opts()), again = closeout(['--save', studyId], opts());
  if (!again.persistence.reused || saved.persistence.reportSha256 !== reopened.reportSha256 || !readFileSync(prePath).equals(preBytes)) fail('REOPEN_OR_IMMUTABILITY');
  const counts = { attempts: reopened.totals.automaticAttempts, failures: reopened.totals.sourceFailureAttempts, frames: reopened.totals.savedFrames, usableSlots: reopened.completedCoverage.completeUsableSlots, usableObservations: reopened.totals.diagnosticUsableObservations };
  if (JSON.stringify(counts) !== JSON.stringify(expectedCounts[name])) fail('EXPECTED_COUNTS_' + name.toUpperCase());
  if (events[0].result.action !== 'WAIT' || events.at(-1).result.action !== 'FINISH' || reopened.status !== 'NO_REPLAY' || reopened.tradeCount !== 0 || reopened.executionAllowed !== false) fail('BOUNDARIES');
  const report = { scenario: name, declaredOrigin: 'SYNTHETIC', clockMeaning: 'SIMULATED_SCENARIO_CLOCKS_NOT_ACTUAL_KNOWLEDGE', studyId, sourceSha256: sha(json(f.source)), planSha256: frozen.planSha256,
    hostProgram: { ...binding, body: undefined }, simulatedWindowStartAt: START, simulatedWindowEndAt: END, simulatedAssessedAt: time(), expectedCounts: expectedCounts[name], counts,
    completedCoverage: reopened.completedCoverage, gaps: reopened.gaps, sourceBlockerCounts: reopened.sourceBlockerCounts,
    operationalLessons: reopened.operationalLessons, observationLessons: reopened.observationReview.candidateLessons,
    preWindowReportSha256: pre.persistence.reportSha256, finalReportSha256: reopened.reportSha256, preWindowBytesUnchanged: true, sameClockSaveReused: true,
    fakeSourceCalls: sourceCalls, inProcessLocalCommands: localCommands, simulatedTimers, events, sourceOutcomes, realSourceCalls: 0, shellCalls: 0, hostMutations: 0, tradeCount: 0, executionAllowed: false, status: 'NO_REPLAY' };
  if (/INJECTED_PRIVATE_PROVIDER_MESSAGE|INJECTED_UNTRUSTED_GUIDE/.test(JSON.stringify(report))) fail('PROVIDER_TEXT_LEAK');
  save(join(directory, 'rehearsal.json'), report);
  return { ...report, scenarioDirectory: directory };
}
export const collectionRehearsalInternals = Object.freeze({ hostBody, bindHost, fixture });
export async function runOptionsCollectionRehearsalCommand(args) {
  if (args.length === 1 && args[0] === '--help') return { usage: 'options:collection-rehearsal -- --run', meaning: 'Run fixed synthetic collection scenarios in a new temporary directory. No network, shell, active-store write, host change or trade.', executionAllowed: false };
  if (args.length !== 1 || args[0] !== '--run') fail('ARGUMENTS');
  const original = hostBody(readFileSync(join(root, 'docs/OPTIONS_ROBINHOOD_AUTOCOLLECTION_RUNBOOK.md'), 'utf8'));
  const actualStartedAt = new Date().toISOString(), directory = mkdtempSync(join(tmpdir(), 'alpha-collection-rehearsal-'));
  const scenarios = [];
  try { for (const name of Object.keys(expectedCounts)) scenarios.push(await scenario(join(directory, name), name, original)); }
  catch (error) { save(join(directory, 'failure.json'), { actualStartedAt, actualFailedAt: new Date().toISOString(), status: 'REHEARSAL_FAILED', code: /^COLLECTION_REHEARSAL_[A-Z_]+$/.test(error?.message) ? error.message : 'COLLECTION_REHEARSAL_LOCAL_FAILURE', executionAllowed: false }); throw error; }
  const payload = { version: 'SYNTHETIC_COLLECTION_REHEARSAL_V1', actualStartedAt, actualCompletedAt: new Date().toISOString(), evidenceDirectory: directory, status: 'ENGINEERING_REHEARSAL_PASSED',
    scenarioCount: scenarios.length, scenarios: scenarios.map(s => ({ scenario: s.scenario, scenarioDirectory: s.scenarioDirectory, counts: s.counts, finalReportSha256: s.finalReportSha256, preWindowBytesUnchanged: s.preWindowBytesUnchanged, sameClockSaveReused: s.sameClockSaveReused, fakeSourceCalls: s.fakeSourceCalls })),
    clockBasis: 'SIMULATED_SOURCE_AND_SCENARIO_CLOCKS_WITH_SEPARATE_ACTUAL_RUN_CLOCKS', sourceOrigin: 'SYNTHETIC', hostProgramSha256: HOST_SHA,
    hostSchedulerActuallyTested: false, sourceThatNeverSettlesTested: false, realSourceCalls: 0, shellCalls: 0, hostMutations: 0, activeSourceAppends: 0, executionAllowed: false, tradeCount: 0, winProbability: null, realPriceReplayReady: false };
  const receipt = { ...payload, receiptSha256: sha(JSON.stringify(payload)) }; save(join(directory, 'receipt.json'), receipt); return receipt;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(await runOptionsCollectionRehearsalCommand(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: 'REHEARSAL_ERROR', code: /^COLLECTION_REHEARSAL_[A-Z_]+$/.test(error?.message) ? error.message : 'COLLECTION_REHEARSAL_LOCAL_FAILURE', executionAllowed: false })); process.exitCode = 2; }
}
