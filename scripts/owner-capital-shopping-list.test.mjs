import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  OWNER_CAPITAL_SHOPPING_LIST_VERSION, ownerCapitalShoppingList, ownerCapitalShoppingListEntry,
} from '../src/catalogs/OwnerCapitalShoppingList.ts';

const watchStocks = 'PLD FCX SLB AVAV HII PLTR GEO KTOS UMAC OLN UAL DAL JBLU AXP DG COST SFD V VITL MOS CF ADM PCAR SANM FLR LZB ALB USAR VLO VST CEG NOK DJT TSLA CCXI RXST BIOA DHR BSX'.split(' ');
const watchEtfs = 'ILF SHLD PPA JETS USOY XLE JEPQ UFO'.split(' ');
let passed = 0;
function test(name, work) { work(); passed++; console.log('PASS ' + name); }

test('stable version and Owner-supplied long-term research boundary', () => {
  const c = ownerCapitalShoppingList();
  assert.equal(c.version, OWNER_CAPITAL_SHOPPING_LIST_VERSION);
  assert.equal(c.version, 'OWNER_CAPITAL_SHOPPING_LIST_V1');
  assert.equal(c.source, 'OWNER_SUPPLIED');
  assert.equal(c.purpose, 'LONG_TERM_CAPITAL / STOCK_AND_ETF_RESEARCH');
  assert.equal(c.orderMeaning, 'OWNER_GROUPING_NOT_RANKING');
});

test('each canonical symbol occurs once; SANM carries both Owner themes', () => {
  const c = ownerCapitalShoppingList();
  assert.equal(c.entries.length, 50);
  assert.equal(new Set(c.entries.map(entry => entry.symbol)).size, c.entries.length);
  assert.deepEqual(c.entries.filter(entry => entry.ownerStatus === 'WATCH' && entry.instrumentType === 'STOCK').map(entry => entry.symbol), watchStocks);
  assert.deepEqual(c.entries.filter(entry => entry.ownerStatus === 'WATCH' && entry.instrumentType === 'ETF').map(entry => entry.symbol), watchEtfs);
  assert.deepEqual(c.entries.filter(entry => entry.symbol === 'SANM').map(entry => entry.themes), [['US_MANUFACTURING', 'AI_INFRASTRUCTURE']]);
});

test('all identities remain Owner-supplied and unverified', () => {
  for (const entry of ownerCapitalShoppingList().entries) {
    assert.equal(entry.identityStatus, 'OWNER_SUPPLIED_PENDING_VERIFICATION');
    assert.match(entry.symbol, /^[A-Z][A-Z0-9]*$/u);
    assert.ok(entry.displayName.length > 0);
    assert.ok(entry.notes.length > 0);
  }
  assert.match(ownerCapitalShoppingListEntry('CCXI').notes, /Owner-supplied.*not independently verified/);
});

test('future ticker and exclusions remain visible but not current core watches', () => {
  const c = ownerCapitalShoppingList();
  assert.deepEqual(c.entries.filter(entry => entry.ownerStatus === 'FUTURE_WATCH').map(entry => entry.symbol), ['AGLT']);
  assert.equal(ownerCapitalShoppingListEntry('AGLT').identityStatus, 'OWNER_SUPPLIED_PENDING_VERIFICATION');
  assert.match(ownerCapitalShoppingListEntry('AGLT').notes, /not currently actionable/);
  assert.deepEqual(c.entries.filter(entry => entry.ownerStatus === 'EXCLUDED').map(entry => entry.symbol), ['NTR', 'SPCX']);
  assert.equal(ownerCapitalShoppingListEntry('NTR').ownerStatus, 'EXCLUDED');
  assert.equal(ownerCapitalShoppingListEntry('SPCX').ownerStatus, 'EXCLUDED');
  assert.equal(ownerCapitalShoppingListEntry('UNKNOWN'), null);
});

test('SPCX exclusion is scoped to this catalog; unrelated mapping stays present', () => {
  const mapping = readFileSync('docs/specifications/PERSONAL_WATCHLIST_MAPPING.md', 'utf8');
  assert.match(mapping, /\| SPCX \| SPCH \| SSPC \|/u);
  assert.match(ownerCapitalShoppingListEntry('SPCX').notes, /only to this list/);
});

test('WATCH is not a rank, allocation or execution authority', () => {
  const c = ownerCapitalShoppingList();
  assert.equal(c.executionAllowed, false);
  assert.equal(c.automaticExecution, false);
  assert.equal(c.allocationAllowed, false);
  assert.equal(c.orderPermission, false);
  for (const item of [c, ...c.entries]) {
    for (const key of ['rank', 'score', 'targetPrice', 'expectedReturn', 'positionSize', 'suggestedWeight', 'recommendedAction', 'brokerAccountId']) {
      assert.equal(Object.hasOwn(item, key), false, key);
    }
  }
});

test('catalog and exact-symbol query return independent deterministic copies', () => {
  const before = ownerCapitalShoppingList(), original = JSON.stringify(before);
  assert.equal(JSON.stringify(ownerCapitalShoppingList()), original);
  before.entries[0].symbol = 'MUTATED';
  before.entries[0].themes.push('MUTATED');
  const queried = ownerCapitalShoppingListEntry('SPCX');
  queried.notes = 'MUTATED';
  assert.equal(JSON.stringify(ownerCapitalShoppingList()), original);
  assert.notEqual(ownerCapitalShoppingListEntry('SPCX').notes, 'MUTATED');
});

console.log(`Owner capital shopping list: ${passed}/${passed} tests passed.`);
