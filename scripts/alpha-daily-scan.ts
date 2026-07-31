import { PersonalDailyScanIntent, PersonalDailyScanMode } from "../src/contracts/PersonalDailyScan";
import { runPersonalDailyScan } from "../src/engines/personal-daily-scan/PersonalDailyScanApplication";

const argument = process.argv.slice(2).find((value) => value.startsWith("--mode="));
const mode = argument?.slice("--mode=".length);
const intentArgument = process.argv.slice(2).find((value) => value.startsWith("--intent="));
const intent = intentArgument?.slice("--intent=".length);
const modes: Readonly<Record<string, PersonalDailyScanMode>> = { "dry-run": PersonalDailyScanMode.DryRun, fixture: PersonalDailyScanMode.Fixture, "live-readonly": PersonalDailyScanMode.LiveReadonly };
const intents: Readonly<Record<string, PersonalDailyScanIntent>> = { structural: PersonalDailyScanIntent.Structural, "event-sensitive": PersonalDailyScanIntent.EventSensitive, leveraged: PersonalDailyScanIntent.LeveragedDecision };
if (mode === undefined || modes[mode] === undefined || (intent !== undefined && intents[intent] === undefined)) { console.error("Usage: npm run alpha:daily-scan -- --mode=dry-run|fixture|live-readonly [--intent=structural|event-sensitive|leveraged]"); process.exitCode = 2; } else { console.log(JSON.stringify(runPersonalDailyScan({ mode: modes[mode]!, ...(intent === undefined ? {} : { intent: intents[intent]! }) }), null, 2)); }
