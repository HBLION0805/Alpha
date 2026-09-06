import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, existsSync, ftruncateSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { extractHistoricalQuoteSubset, runOptionsMarketExtractCommand } from "./options-market-extract.mjs";
import { parseCboeOptionQuotesCsv } from "../src/integration/options-market-evidence/CboeOptionQuotesCsv.ts";

const root = process.cwd(), cli = resolve(root, "scripts/options-market-extract.mjs"), tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");
const header = "underlying_symbol,quote_datetime,root,expiration,strike,option_type,open,high,low,close,trade_volume,bid_size,bid,ask_size,ask,underlying_bid,underlying_ask";
const row = "GLD,2026-09-04 10:00:00,GLD,2026-09-25,400.00,C,0.20,0.22,0.19,0.21,10,5,0.20,8,0.22,400.00,400.02";
const next = row.replace("10:00:00", "10:01:00");
const unrelated = "AAPL,,,,,,,,,,,,,,,,";
const selection = (selectionId = "io-selected-contracts") => ({ selectionId, sessionDate: "2026-09-04", contractKeys: ["GLD:2026-09-25:CALL:40000"], rationale: "Retrospective synthetic process test; no market claim." });
const output = (directory, id = "io-selected-contracts") => join(directory, "data/runtime/options-historical-replay/extracts", id);
const sha = (value) => "sha256:" + createHash("sha256").update(value).digest("hex");
const fileHash = (path) => sha(readFileSync(path));
function source(directory, text = [header, row, next].join("\n") + "\n") { const path = join(directory, "source.csv"); writeFileSync(path, text, "utf8"); return path; }
let passed = 0;
async function test(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
async function temp(run) {
  const allowed = realpathSync(tmpdir()), directory = mkdtempSync(join(allowed, "alpha-market-extract-test-"));
  try { await run(directory); } finally {
    const target = realpathSync(directory);
    assert.ok(target.startsWith(allowed + sep) && target.includes("alpha-market-extract-test-"));
    rmSync(target, { recursive: true, force: true });
  }
}

await test("selected cell text survives unchanged while source and child hashes remain distinct", () => temp(async (directory) => {
  const quoted = row.replace("GLD,", '"GLD",').replace("400.00,C", '"400.00",C');
  const text = "\uFEFF" + [header, unrelated, quoted, next].join("\r\n") + "\r\n";
  const path = source(directory, text), before = fileHash(path), beforeClock = Date.now();
  const report = await extractHistoricalQuoteSubset(directory, path, selection());
  const expected = "\uFEFF" + [header, quoted, next].join("\n") + "\n";
  assert.equal(report.changed, true); assert.equal(report.manifest.status, "EXTRACTED"); assert.equal(report.executionAllowed, false);
  assert.equal(readFileSync(report.quotesPath, "utf8"), expected); assert.equal(report.manifest.parentRawSha256, before);
  assert.equal(report.manifest.childSha256, sha(expected)); assert.equal(fileHash(path), before);
  assert.equal(report.manifest.sourceRowCount, 3); assert.equal(report.manifest.selectedRowCount, 2); assert.equal(report.manifest.excludedRowCount, 1);
  assert.equal(report.manifest.selectionStatus, "RETROSPECTIVE_DECLARATION_NOT_PREREGISTERED");
  assert.equal(report.manifest.sourceClassification, "UNVERIFIED_LOCAL_FILE");
  assert.ok(Date.parse(report.manifest.requestedAt) >= beforeClock); assert.ok(Date.parse(report.manifest.finishedAt) <= Date.now());
}));
await test("large full-chain files stream into a bounded child without increasing existing parser limits", () => temp(async (directory) => {
  const text = [header, ...Array(45_000).fill(row.replaceAll("GLD", "AAPL")), row, next].join("\n") + "\n";
  assert.ok(new TextEncoder().encode(text).byteLength > 4 * 1024 * 1024);
  assert.throws(() => parseCboeOptionQuotesCsv(text), /BYTE_LIMIT/);
  const report = await extractHistoricalQuoteSubset(directory, source(directory, text), selection());
  assert.equal(report.manifest.sourceRowCount, 45_002); assert.equal(report.manifest.selectedRowCount, 2);
  assert.equal(report.manifest.excludedRowCount, 45_000); assert.equal(report.manifest.parentRawSha256, sha(text));
  assert.equal(parseCboeOptionQuotesCsv(readFileSync(report.quotesPath, "utf8")).rows.length, 2);
}));
await test("only specified standard contracts and the declared Eastern session are retained", () => temp(async (directory) => {
  const ibit = row.replaceAll("GLD", "IBIT").replace("400.00,C", "60.00,P");
  const adjusted = row.replace(",GLD,2026-09-25", ",GLD1,2026-09-25");
  const otherDay = row.replace("2026-09-04", "2026-09-03");
  const otherStrike = row.replace("400.00,C", "410.00,C");
  const declared = { ...selection(), contractKeys: ["IBIT:2026-09-25:PUT:6000", "GLD:2026-09-25:CALL:40000"] };
  const report = await extractHistoricalQuoteSubset(directory, source(directory, [header, row, ibit, adjusted, otherDay, otherStrike].join("\n")), declared);
  const parsed = parseCboeOptionQuotesCsv(readFileSync(report.quotesPath, "utf8"));
  assert.equal(report.manifest.selectedRowCount, 2); assert.deepEqual(parsed.rows.map((item) => item.underlyingSymbol), ["GLD", "IBIT"]);
  assert.equal(report.manifest.excludedRowCount, 3);
}));
await test("no matching observations produce only an explicit NO_MATCH manifest", () => temp(async (directory) => {
  const path = source(directory, header + "\n" + unrelated + "\n");
  const first = await extractHistoricalQuoteSubset(directory, path, selection());
  assert.equal(first.manifest.status, "NO_MATCH"); assert.equal(first.quotesPath, null); assert.equal(first.manifest.childSha256, null);
  assert.equal(first.manifest.selectedRowCount, 0); assert.deepEqual(readdirSync(output(directory)), ["manifest.json"]);
  const second = await extractHistoricalQuoteSubset(directory, path, selection());
  assert.equal(second.changed, false); assert.deepEqual(second.manifest, first.manifest);
}));
await test("complete repeated extraction preserves original timestamps and both output files", () => temp(async (directory) => {
  const path = source(directory); const first = await extractHistoricalQuoteSubset(directory, path, selection());
  const manifestBefore = fileHash(first.manifestPath), childBefore = fileHash(first.quotesPath);
  const second = await extractHistoricalQuoteSubset(directory, path, selection());
  assert.equal(second.changed, false); assert.deepEqual(second.manifest, first.manifest);
  assert.equal(fileHash(first.manifestPath), manifestBefore); assert.equal(fileHash(first.quotesPath), childBefore);
}));
await test("changing source bytes or selection rationale cannot overwrite an existing selection identifier", () => temp(async (directory) => {
  const path = source(directory); const first = await extractHistoricalQuoteSubset(directory, path, selection());
  const before = fileHash(first.manifestPath), childBefore = fileHash(first.quotesPath);
  await assert.rejects(() => extractHistoricalQuoteSubset(directory, path, { ...selection(), rationale: "Different retrospective selection." }), /CONFLICT/);
  appendFileSync(path, unrelated + "\n");
  await assert.rejects(() => extractHistoricalQuoteSubset(directory, path, selection()), /CONFLICT/);
  assert.equal(fileHash(first.manifestPath), before); assert.equal(fileHash(first.quotesPath), childBefore);
}));
await test("selection validation happens before opening a source and rejects hidden authority or unsafe paths", () => temp(async (directory) => {
  const absent = join(directory, "absent.csv");
  for (const invalid of [{ ...selection(), executionAllowed: true }, { ...selection(), selectionId: "../escape" }, { ...selection(), selectionId: "CON" },
    { ...selection(), sessionDate: "2026-02-30" }, { ...selection(), contractKeys: [] }, { ...selection(), contractKeys: Array(5).fill("GLD:2026-09-25:CALL:40000") },
    { ...selection(), contractKeys: ["GLD:2026-09-25:CALL:40000", "GLD:2026-09-25:CALL:40000"] }, { ...selection(), contractKeys: ["QQQ:2026-09-25:CALL:40000"] }]) {
    await assert.rejects(() => extractHistoricalQuoteSubset(directory, absent, invalid), /EXTRACT_INVALID/);
  }
  assert.equal(existsSync(join(directory, "data")), false);
}));
await test("quoted embedded newlines, malformed endings and invalid UTF-8 fail without publication", () => temp(async (directory) => {
  const variants = [header + "\n" + row.replace("GLD,", '"GL\nD",'), header + "\r" + row, header + "\n" + row + "\r", header + "\n" + '"unfinished'];
  for (const text of variants) {
    await assert.rejects(() => extractHistoricalQuoteSubset(directory, source(directory, text), selection()), /EXTRACT_|CBOE_/);
    assert.equal(existsSync(output(directory)), false);
  }
  const path = source(directory); appendFileSync(path, new Uint8Array([0xff, 0xfe]));
  await assert.rejects(() => extractHistoricalQuoteSubset(directory, path, selection()), /encoded data|encoding/i);
  assert.equal(existsSync(output(directory)), false);
}));
await test("cross-row quote and discarded-volume conflicts reject the selected subset", () => temp(async (directory) => {
  for (const changed of [row.replace(",5,0.20,", ",5,0.19,"), row.replace(",10,5,", ",999,5,")]) {
    await assert.rejects(() => extractHistoricalQuoteSubset(directory, source(directory, [header, row, changed].join("\n")), selection()), /CBOE_CONFLICTING_SNAPSHOT/);
    assert.equal(existsSync(output(directory)), false);
  }
}));
await test("exact duplicate source rows remain visible in original child text and counts", () => temp(async (directory) => {
  const report = await extractHistoricalQuoteSubset(directory, source(directory, [header, row, row].join("\n")), selection());
  assert.equal(report.manifest.selectedRowCount, 2); assert.equal(report.manifest.normalizedSelectedRowCount, 1); assert.equal(report.manifest.duplicateSelectedRowCount, 1);
  assert.equal(readFileSync(report.quotesPath, "utf8"), [header, row, row, ""].join("\n"));
}));
await test("source byte and individual record limits block oversized inputs", () => temp(async (directory) => {
  const path = source(directory); const fd = openSync(path, "r+");
  try { ftruncateSync(fd, 64 * 1024 * 1024 + 1); } finally { closeSync(fd); }
  await assert.rejects(() => extractHistoricalQuoteSubset(directory, path, selection()), /OVERSIZED_SOURCE/);
  writeFileSync(path, header + "\n" + "x".repeat(16 * 1024 + 1));
  await assert.rejects(() => extractHistoricalQuoteSubset(directory, path, selection()), /RECORD_BYTE_LIMIT/);
  assert.equal(existsSync(output(directory)), false);
}));
await test("source row and selected row limits reject rather than truncating a sample", () => temp(async (directory) => {
  let path = source(directory, header + "\n" + (unrelated + "\n").repeat(250_001));
  await assert.rejects(() => extractHistoricalQuoteSubset(directory, path, selection()), /SOURCE_ROW_LIMIT/);
  path = source(directory, header + "\n" + (row + "\n").repeat(10_001));
  await assert.rejects(() => extractHistoricalQuoteSubset(directory, path, selection()), /SELECTED_ROW_LIMIT/);
  assert.equal(existsSync(output(directory)), false);
}));
await test("partial publication blocks retry and preserves all existing files", () => temp(async (directory) => {
  const path = source(directory); mkdirSync(output(directory), { recursive: true });
  const partial = join(output(directory), "quotes.csv"); writeFileSync(partial, "partial-output");
  await assert.rejects(() => extractHistoricalQuoteSubset(directory, path, selection()), /PARTIAL/);
  assert.equal(readFileSync(partial, "utf8"), "partial-output"); assert.equal(existsSync(join(output(directory), "manifest.json")), false);
}));
await test("changed child content fails integrity without a replacement write", () => temp(async (directory) => {
  const path = source(directory); const first = await extractHistoricalQuoteSubset(directory, path, selection());
  appendFileSync(first.quotesPath, "corrupt"); const before = fileHash(first.quotesPath);
  await assert.rejects(() => extractHistoricalQuoteSubset(directory, path, selection()), /CHILD_INTEGRITY_FAILURE/);
  assert.equal(fileHash(first.quotesPath), before);
}));
await test("symlinked output parents are rejected without writing into the target", () => temp(async (directory) => {
  const path = source(directory), target = join(directory, "alternate"); mkdirSync(target);
  symlinkSync(target, join(directory, "data"), "junction");
  assert.equal(lstatSync(join(directory, "data")).isSymbolicLink(), true);
  await assert.rejects(() => extractHistoricalQuoteSubset(directory, path, selection()), /UNSAFE_OUTPUT_DIRECTORY/);
  assert.deepEqual(readdirSync(target), []);
}));
await test("extraction never opens or modifies existing market and historical journals", () => temp(async (directory) => {
  const path = source(directory);
  const files = ["options-market-evidence/imports.ndjson", "options-historical-replay/runs.ndjson", "options-paper/sessions.ndjson"];
  for (const file of files) { const parts = file.split("/"); mkdirSync(join(directory, "data/runtime", parts[0]), { recursive: true }); writeFileSync(join(directory, "data/runtime", file), "sentinel\n"); }
  await extractHistoricalQuoteSubset(directory, path, selection());
  for (const file of files) assert.equal(readFileSync(join(directory, "data/runtime", file), "utf8"), "sentinel\n");
}));
await test("CLI extracts local selection JSON and rejects execution or ambiguous flags", () => temp(async (directory) => {
  const path = source(directory), selectionPath = join(directory, "selection.json"); writeFileSync(selectionPath, JSON.stringify(selection()));
  const args = ["--input", path, "--selection", selectionPath];
  const first = await runOptionsMarketExtractCommand(args, { workspaceRoot: directory }); assert.equal(first.changed, true);
  const result = spawnSync(process.execPath, [tsx, cli, ...args], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).changed, false);
  for (const invalid of [[], ["--live"], ["--input", path], [...args, "--order"]]) {
    await assert.rejects(() => runOptionsMarketExtractCommand(invalid, { workspaceRoot: directory }), /UNSUPPORTED_COMMAND/);
  }
}));

console.log(`Options market subset extraction: ${passed}/${passed} passed.`);
