import type { CanonicalBarInput } from "../../../contracts/CanonicalBar";
import type { OptionsContextInterval } from "../../../contracts/OptionsCandlePolicy";
import type { OptionsMarketContextResult } from "../../../contracts/OptionsMarketContext";
import { InMemoryOptionsMarketContextRepository } from "../../../repositories/InMemoryOptionsMarketContextRepository";
import { OptionsMarketContextPipeline } from "../OptionsMarketContextPipeline";
import type { ContextFixture } from "./OptionsMarketContextFixtures";

export function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`);
}
export function truth(value: unknown): asserts value { if (!value) throw new Error("Assertion failed"); }
export function throws(run: () => unknown, code?: string): void {
  try { run(); } catch (error) {
    if (code !== undefined) truth(error instanceof Error && (error.message === code || ("code" in error && error.code === code)));
    return;
  }
  throw new Error("Expected rejection");
}
export function harness(name: string) {
  let passed = 0;
  return {test(label: string, run: () => void) { run(); passed++; console.log(`PASS ${label}`); },
    finish() { console.log(`${name}: ${passed}/${passed} passed.`); }};
}
export function accepted(result: OptionsMarketContextResult) {
  if (result.status !== "ACCEPTED") throw new Error(`Expected accepted: ${result.reasonCode}`);
  return result;
}
export function runFixture(fixture: ContextFixture) {
  const repository = new InMemoryOptionsMarketContextRepository();
  const pipeline = new OptionsMarketContextPipeline(fixture.binding, fixture.providers, fixture.policy, repository);
  return {result: pipeline.run(fixture.rows, fixture.asOf), repository, pipeline};
}
export function changeBar(fixture: ContextFixture, interval: OptionsContextInterval, index: number,
  change: (bar: CanonicalBarInput) => CanonicalBarInput): ContextFixture {
  const rows = fixture.rows[interval].map((row, offset) => offset === index ? {...row, bar: change(row.bar)} : row);
  return {...fixture, rows: {...fixture.rows, [interval]: rows}};
}
