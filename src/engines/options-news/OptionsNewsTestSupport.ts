import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NewsProviderAdapter, NewsProviderRequest } from "../../contracts/OptionsNewsProvider";
import { OptionsNewsSourceRegistry } from "./OptionsNewsSourceRegistry";
import { OPTIONS_NEWS_SOURCE_REGISTRATIONS } from "../../integration/news/OptionsNewsSources";
import { SecEdgarNewsAdapter } from "../../integration/news/SecEdgarNewsAdapter";
import { FederalReserveNewsAdapter } from "../../integration/news/FederalReserveNewsAdapter";
import { FinnhubNewsAdapter } from "../../integration/news/FinnhubNewsAdapter";
import { AlphaVantageNewsAdapter } from "../../integration/news/AlphaVantageNewsAdapter";

export class TestHarness {
  private readonly tests: Array<readonly [string, () => void]> = [];
  public test(name: string, run: () => void): void { this.tests.push([name,run]); }
  public run(label: string): void { let passed = 0; for (const [name,run] of this.tests) { try { run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; } } console.log(`${label} tests passed: ${String(passed)}/${String(this.tests.length)}.`); }
}
export function equal<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`); }
export function trueValue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true`); }
export function deepEqual(actual: unknown, expected: unknown, label: string): void { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); }
export function throws(run: () => unknown, expected: string): void { try { run(); } catch (error: unknown) { if (String(error).includes(expected)) return; throw error; } throw new Error(`Expected error containing ${expected}`); }
export function fixture(name: string): unknown { return JSON.parse(readFileSync(resolve("fixtures/news",name),"utf8")) as unknown; }
export const registry = new OptionsNewsSourceRegistry(OPTIONS_NEWS_SOURCE_REGISTRATIONS);
export function adapters(): Readonly<Record<string,NewsProviderAdapter>> { return { sec: new SecEdgarNewsAdapter(registry.get("source:sec-edgar")), fed: new FederalReserveNewsAdapter(registry.get("source:federal-reserve")), finnhub: new FinnhubNewsAdapter(registry.get("source:finnhub-reuters")), alphaVantage: new AlphaVantageNewsAdapter(registry.get("source:alpha-vantage-reuters")) }; }
export function request(sourceId: string): NewsProviderRequest { return { requestId: `request:${sourceId}`, sourceId, requestedAtUtc: "2026-08-08T12:00:00.000Z", symbols: ["ACME"], topics: ["TECH"] }; }
