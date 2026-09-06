import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, posix, resolve, sep } from "node:path";
import ts from "typescript";

const root = resolve(process.cwd());
const manifest = JSON.parse(readFileSync("docs/OPTIONS_FOCUS_DELETION_MANIFEST.json", "utf8"));
const deleted = new Set(manifest.files.map((entry) => entry.path));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const validation = readFileSync("scripts/alpha-validate.mjs", "utf8");
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function walk(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}
const sourceFiles = [...walk("src"), ...walk("scripts")].filter((file) => /\.(ts|mjs|cjs)$/u.test(file));

test("deletion manifest names the exact reviewed baseline and unique safe paths", () => {
  assert.equal(manifest.baselineCommit, "53a905a5f8360afeea1d24eaa084110f6ef85bdc");
  assert.equal(deleted.size, manifest.deletedFileCount);
  assert.equal(deleted.size, manifest.files.length);
  for (const entry of manifest.files) {
    assert.ok(resolve(entry.path).startsWith(root + sep));
    assert.ok(!entry.path.startsWith(".git") && !entry.path.startsWith("data/"));
    assert.ok(typeof entry.reason === "string" && entry.reason.length > 0);
  }
});
test("removed product files cannot silently reappear", () => {
  for (const path of deleted) assert.equal(existsSync(path), false, path);
});
test("retired product commands and test registrations are absent", () => {
  for (const command of Object.values(packageJson.scripts)) {
    for (const path of deleted) assert.equal(command.includes(path), false, path);
  }
  for (const path of deleted) assert.equal(validation.includes(`"${path}"`), false, path);
});
test("all surviving local imports and exports resolve without deleted modules", () => {
  for (const file of sourceFiles) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        if (specifier.startsWith(".")) {
          const target = posix.normalize(posix.join(dirname(file).replaceAll("\\", "/"), specifier));
          const candidates = [target, `${target}.ts`, `${target}.mjs`, `${target}/index.ts`];
          assert.ok(candidates.some((path) => existsSync(path)), `${file}: ${specifier}`);
          assert.equal(candidates.some((path) => deleted.has(path)), false, `${file}: ${specifier}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
test("every surviving test file is covered by the validation bundle", () => {
  for (const file of sourceFiles.filter((path) => /\.test\.(ts|mjs)$/u.test(path))) assert.ok(validation.includes(`"${file}"`), file);
});
test("canonical data, calendar, options and historical capabilities remain", () => {
  for (const path of [
    "src/contracts/CanonicalInstrument.ts", "src/contracts/CanonicalBar.ts", "src/contracts/CanonicalQuote.ts",
    "src/engines/market-calendar/MarketCalendarValidation.ts",
    "src/integration/market-data/twelve-data/TwelveDataBarAdapter.ts",
    "src/engines/options-news/OptionsNewsPipeline.ts",
    "src/engines/options-market-context/OptionsMarketContextPipeline.ts",
    "src/engines/options-retail-feasibility/OptionsRetailFeasibilityEngine.ts",
    "src/engines/research-integrity/ResearchIntegrityEngine.ts",
    "src/engines/historical-pattern-library/HistoricalPatternLibrary.ts",
    "src/engines/event-replay/EventReplayEngine.ts",
  ]) assert.ok(existsSync(path), path);
});
console.log(`Options focus scope: ${passed}/${passed} passed.`);
