/** npm run fedspeak [-- --days 14]: refresh data/in/fed-speakers.json from the Fed Board calendar and print the window. */
import { parseArgs } from "node:util";
import { loadFedSpeakers, renderFedSpeakers } from "../ingest/fedSpeakers.ts";
const { values } = parseArgs({ options: { days: { type: "string", default: "14" }, offline: { type: "boolean" } } });
const now = new Date(), today = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const r = await loadFedSpeakers({ offline: values.offline, now });
console.log(`## 美联储官员讲话（未来 ${values.days} 天）`);
console.log(r.data ? renderFedSpeakers(r.data.speeches, r.data.blackouts, today, Number(values.days), r.status).join("\n") : `- 不可用：${r.status}`);
