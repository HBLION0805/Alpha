import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildOptionsCalendarBrief } from '../src/engines/options-readiness/OptionsCalendarBrief.ts';
import { readinessClock } from '../src/engines/options-readiness/OptionsReadinessEngine.ts';
import { withReleaseCalendarJournal } from './lib/options-release-calendar-io.mjs';
import { withFomcCalendarJournal } from './lib/options-fomc-calendar-io.mjs';
import { optionsEvidenceExportStorage as io } from './options-evidence-export.mjs';

export async function runOptionsCalendarBriefCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === '--help') return { usage: 'options:calendar-brief -- --report [--json]', meaning: 'Read local BLS scheduled times and FOMC date intervals without inventing intraday timing. No network, source writes, host changes or trades.', executionAllowed: false };
  if (![1, 2].includes(args.length) || args[0] !== '--report' || args.length === 2 && args[1] !== '--json') throw Error('CALENDAR_BRIEF_ARGUMENTS');
  const root = realpathSync(workspaceRoot), inputs = {};
  for (const [id, file, reader] of [['bls', 'options-release-calendar', withReleaseCalendarJournal], ['fomc', 'options-fomc-calendar', withFomcCalendarJournal]]) {
    const checkedAt = now(); readinessClock(checkedAt);
    try {
      const path = 'data/runtime/' + file + '/retrievals.ndjson', before = io.readBytes(root, path, 32 * 1024 * 1024);
      const payload = await reader(root, s => s.inputs, checkedAt);
      if (!before.equals(io.readBytes(root, path, 32 * 1024 * 1024))) throw Error('OPTIONS_EXPORT_FILE_CHANGED');
      inputs[id] = { state: 'AVAILABLE', checkedAt, payload, errorCode: null };
    } catch (error) {
      const missing = error?.code === 'ENOENT', errorCode = missing ? 'STORE_MISSING' : error?.code === 'EEXIST' ? 'STORE_BUSY' : /^OPTIONS_EXPORT_(?:UNSAFE_|PATH_ESCAPE|FILE_CHANGED)/.test(error?.message) ? 'STORE_UNSAFE' : 'RECOVERY_FAILED';
      inputs[id] = { state: missing ? 'MISSING' : 'BLOCKED', checkedAt, payload: null, errorCode };
    }
  }
  return buildOptionsCalendarBrief(inputs, now());
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const args = process.argv.slice(2), report = await runOptionsCalendarBriefCommand(args, { workspaceRoot: resolve(import.meta.dirname, '..') }); console.log(args.includes('--json') || args[0] === '--help' ? JSON.stringify(report, null, 2) : report.text.trimEnd()); if (report.blockedStores?.length) process.exitCode = 3; }
  catch (error) { console.error(JSON.stringify({ status: 'CALENDAR_BRIEF_ERROR', code: /^(?:CALENDAR_BRIEF_[A-Z_]+|OPTIONS_READINESS_CLOCK)$/.test(error?.message) ? error.message : 'CALENDAR_BRIEF_LOCAL_FAILURE', executionAllowed: false })); process.exitCode = 2; }
}
