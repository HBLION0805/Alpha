/**
 * npm run event-followup [-- --at 2026-10-21T22:00:00Z]: print the active display-only event follow-ups
 * (knowledge/events/event-followups.json) from data/in/earnings-by-symbol.json, data/in/quotes.json and the optional
 * data/in/event-results.json. Read-only; nothing is written, no alerts, no trades. Prints nothing when none is active.
 */
import { parseArgs } from "node:util";
import { loadFollowups, loadFollowupInputs, followupLines } from "../macro/eventFollowup.ts";
const { values } = parseArgs({ options: { at: { type: "string" } } });
const now = values.at ? new Date(values.at) : new Date(), fu = loadFollowups();
if (fu.error) console.error(`[event-followup] ${fu.error}`);
const L = followupLines(fu.followups, loadFollowupInputs(), now);
process.stdout.write(L.length ? L.join("\n") + "\n" : "");
console.error(`[event-followup] ${L.length ? "active" : "none active"} at ${now.toISOString()}`);
