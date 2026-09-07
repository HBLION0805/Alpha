import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { runOptionsCalendarBriefCommand as run } from './options-calendar-brief.mjs';
import { withReleaseCalendarJournal } from './lib/options-release-calendar-io.mjs';
import { withFomcCalendarJournal } from './lib/options-fomc-calendar-io.mjs';
import { RELEASE_CALENDAR_URL, reportReleaseCalendar } from '../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts';
import { FOMC_CALENDAR_URL, reportFomcCalendar } from '../src/engines/options-fomc-calendar/FomcCalendarEngine.ts';

const root = resolve(import.meta.dirname, '..'), at = '2026-09-07T08:00:00.000Z';
const sources = [
  ['bls', 'options-release-calendar', withReleaseCalendarJournal, RELEASE_CALENDAR_URL, readFileSync(join(root, 'fixtures/options-release-calendar/calendar.synthetic.ics'), 'utf8'), reportReleaseCalendar],
  ['fomc', 'options-fomc-calendar', withFomcCalendarJournal, FOMC_CALENDAR_URL, readFileSync(join(root, 'fixtures/options-fomc-calendar/calendar.synthetic.html'), 'utf8'), reportFomcCalendar]
];
const read = directory => run(['--report'], { workspaceRoot: directory, now: () => at });
const path = (directory, id) => join(directory, 'data/runtime', sources.find(s => s[0] === id)[1], 'retrievals.ndjson');
async function temporary(work) {
  const directory = mkdtempSync(join(tmpdir(), 'alpha-calendar-brief-test-'));
  try { await work(directory); } finally {
    const rel = relative(realpathSync(tmpdir()), realpathSync(directory));
    if (isAbsolute(rel) || rel.startsWith('..') || !rel.startsWith('alpha-calendar-brief-test-')) throw Error('UNSAFE_TEST_CLEANUP');
    rmSync(directory, { recursive: true });
  }
}
async function seed(directory) { for (const [, , reader, url, sourceText] of sources) await reader(directory, s => s.append({ requestedAt: at, receivedAt: at, url, sourceText, errorCode: null }, at), at); }
function files(directory) { const result = {}; const walk = p => { for (const e of readdirSync(p, { withFileTypes: true })) { const f = join(p, e.name); if (e.isDirectory()) walk(f); else result[relative(directory, f)] = createHash('sha256').update(readFileSync(f)).digest('hex'); } }; walk(directory); return result; }
async function reports(directory) { const values = {}; for (const [id, , reader, , , report] of sources) values[id] = await reader(directory, s => report(s.inputs, at), at); return values; }
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
await test('both recovered calendars preserve all source bytes and old report fingerprints', () => temporary(async directory => {
  await seed(directory); writeFileSync(join(directory, 'old-brief.txt'), 'immutable old report'); const before = files(directory), old = await reports(directory), r = await read(directory);
  assert.deepEqual(r.blockedStores, []); assert.equal(r.entryCount, 3); assert.equal(r.sources.bls.retrievalCount, 1); assert.equal(r.sources.fomc.retrievalCount, 1);
  assert.match(r.text, /2026-09-15 through 2026-09-16/); assert.match(r.text, /08:30:00 EDT/); assert.deepEqual(await reports(directory), old); assert.deepEqual(files(directory), before);
}));
await test('missing stores remain missing and no directories or report files are created', () => temporary(async directory => { const r = await read(directory); assert.deepEqual(r.missingStores, ['bls', 'fomc']); assert.equal(existsSync(join(directory, 'data')), false); assert.equal(r.reportFilesCreated, false); }));
await test('corruption in either journal blocks only its own source without exposing payloads', () => temporary(async directory => {
  await seed(directory); for (const [id] of sources) { const original = readFileSync(path(directory, id)); writeFileSync(path(directory, id), '{PRIVATE_SOURCE_PAYLOAD'); const r = await read(directory); assert.deepEqual(r.blockedStores, [id]); assert.equal(r.sources[id].errorCode, 'RECOVERY_FAILED'); assert(r.entryCount > 0); assert(!r.text.includes('PRIVATE')); assert.equal(readFileSync(path(directory, id), 'utf8'), '{PRIVATE_SOURCE_PAYLOAD'); writeFileSync(path(directory, id), original); }
}));
await test('held source locks are preserved and independently reported', () => temporary(async directory => {
  await seed(directory); const lock = join(directory, 'data/runtime/options-fomc-calendar/writer.lock'); writeFileSync(lock, 'held'); const r = await read(directory); assert.deepEqual(r.blockedStores, ['fomc']); assert.equal(r.sources.fomc.errorCode, 'STORE_BUSY'); assert.equal(readFileSync(lock, 'utf8'), 'held'); assert.equal(r.entryCount, 2);
}));
await test('hard-linked journals are blocked before recovery', () => temporary(async directory => { await seed(directory); linkSync(path(directory, 'bls'), join(directory, 'alias')); const r = await read(directory); assert.equal(r.sources.bls.errorCode, 'STORE_UNSAFE'); assert.equal(r.sources.fomc.state, 'AVAILABLE'); }));
await test('oversized journal is not parsed or rewritten', () => temporary(async directory => { await seed(directory); truncateSync(path(directory, 'fomc'), 32 * 1024 * 1024 + 1); const r = await read(directory); assert.equal(r.sources.fomc.errorCode, 'STORE_UNSAFE'); assert.equal(r.sources.bls.state, 'AVAILABLE'); }));
await test('runtime junctions cannot redirect either source', () => temporary(async directory => { const other = join(directory, 'other'); mkdirSync(other); symlinkSync(other, join(directory, 'data'), process.platform === 'win32' ? 'junction' : 'dir'); const r = await read(directory); assert.deepEqual(r.blockedStores, ['bls', 'fomc']); assert.equal(r.sources.fomc.errorCode, 'STORE_UNSAFE'); assert.deepEqual(readdirSync(other), []); }));
await test('brief never calls source transport', () => temporary(async directory => { await seed(directory); const original = globalThis.fetch; let calls = 0; globalThis.fetch = async () => { calls++; throw Error('FORBIDDEN'); }; try { const r = await read(directory); assert.equal(r.networkAccess, false); assert.equal(calls, 0); assert.equal(r.sourceAppends, 0); } finally { globalThis.fetch = original; } }));
await test('latest source failure survives recovery without promoting last-known dates', () => temporary(async directory => { await seed(directory); await withFomcCalendarJournal(directory, s => s.append({ requestedAt: at, receivedAt: at, url: FOMC_CALENDAR_URL, sourceText: null, errorCode: 'HTTP_STATUS' }, at), at); const r = await read(directory); assert.equal(r.sources.fomc.state, 'AVAILABLE'); assert.equal(r.sources.fomc.sourceErrorCode, 'HTTP_STATUS'); assert.equal(r.sources.fomc.lastKnownReceivedAt, at); assert.equal(r.entryCount, 2); assert(!r.text.includes('2026-09-15 through')); }));
await test('actual read clocks are separate and cannot roll back', () => temporary(async directory => {
  await seed(directory); const clocks = [at, '2026-09-07T08:00:01.000Z', '2026-09-07T08:00:02.000Z']; let n = 0; const r = await run(['--report', '--json'], { workspaceRoot: directory, now: () => clocks[n++] }); assert.equal(r.sources.bls.checkedAt, clocks[0]); assert.equal(r.sources.fomc.checkedAt, clocks[1]); assert.equal(r.assessedAt, clocks[2]); n = 0; await assert.rejects(run(['--report'], { workspaceRoot: directory, now: () => [clocks[1], clocks[0], clocks[2]][n++] }), /CHECK_CLOCK_ORDER/);
}));
await test('invalid scope or refresh arguments fail before reading', () => temporary(async directory => { for (const args of [[], ['--refresh'], ['--report', '--at', at], ['--report', '../escape'], ['--report', '--root'], ['--report', '--json', 'extra']]) await assert.rejects(run(args, { workspaceRoot: directory, now: () => at }), /ARGUMENTS/); assert.deepEqual(readdirSync(directory), []); }));
await test('help does not require an existing workspace and command entry point is local', async () => {
  const help = await run(['--help'], { workspaceRoot: join(root, 'does-not-exist') }); assert.match(help.meaning, /No network/);
  const r = spawnSync(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), join(root, 'scripts/options-calendar-brief.mjs'), '--help'], { encoding: 'utf8', timeout: 30000 }); assert.equal(r.status, 0); assert.deepEqual(JSON.parse(r.stdout), help);
});
console.log(`${passed}/${passed} tests passed.`);
