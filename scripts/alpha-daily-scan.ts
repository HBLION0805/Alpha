import { PersonalDailyScanIntent, PersonalDailyScanMode } from "../src/contracts/PersonalDailyScan";
import { runPersonalDailyScan } from "../src/engines/personal-daily-scan/PersonalDailyScanApplication";

const argumentsList = process.argv.slice(2);
const modeArguments = argumentsList.filter((value) => value.startsWith("--mode="));
const intentArguments = argumentsList.filter((value) => value.startsWith("--intent="));
const declaredArgumentsOnly = argumentsList.every((value) => value.startsWith("--mode=") || value.startsWith("--intent="));
const argument = modeArguments[0];
const mode = argument?.slice("--mode=".length);
const intentArgument = intentArguments[0];
const intent = intentArgument?.slice("--intent=".length);
const modes: Readonly<Record<string, PersonalDailyScanMode>> = { "dry-run": PersonalDailyScanMode.DryRun, fixture: PersonalDailyScanMode.Fixture, "live-readonly": PersonalDailyScanMode.LiveReadonly };
const intents: Readonly<Record<string, PersonalDailyScanIntent>> = { structural: PersonalDailyScanIntent.Structural, "event-sensitive": PersonalDailyScanIntent.EventSensitive, leveraged: PersonalDailyScanIntent.LeveragedDecision };
if (!declaredArgumentsOnly || modeArguments.length !== 1 || intentArguments.length > 1 || mode === undefined || modes[mode] === undefined || (intent !== undefined && intents[intent] === undefined)) { console.error("Usage: npm run alpha:daily-scan -- --mode=dry-run|fixture|live-readonly [--intent=structural|event-sensitive|leveraged]"); process.exitCode = 2; } else { console.log(JSON.stringify(runPersonalDailyScan({ mode: modes[mode]!, ...(intent === undefined ? {} : { intent: intents[intent]! }) }), null, 2)); }
