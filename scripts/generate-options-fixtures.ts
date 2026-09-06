// Development-only deterministic generation of checked-in synthetic test inputs.
import { mkdirSync, writeFileSync } from "node:fs";
import { buildContextFixture } from "../src/engines/options-market-context/testing/OptionsMarketContextFixtures";

const root = "fixtures/options-market-context/qqq-qualified";
mkdirSync(root, {recursive: true});
const {rows, ...manifest} = buildContextFixture();
writeFileSync(`${root}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(`${root}/session-calendar.json`, `${JSON.stringify(manifest.binding.calendar, null, 2)}\n`);
writeFileSync(`${root}/corporate-action-qualification.json`, `${JSON.stringify(manifest.binding.corporateAction, null, 2)}\n`);
for (const [interval, values] of Object.entries(rows)) {
  writeFileSync(`${root}/${interval.toLowerCase()}.json`, `[\n${values.map((value) => JSON.stringify(value)).join(",\n")}\n]\n`);
}
