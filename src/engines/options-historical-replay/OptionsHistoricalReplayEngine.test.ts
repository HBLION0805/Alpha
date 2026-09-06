import type { CboeOptionQuoteRow } from "../../contracts/OptionsMarketEvidence";
import type { OptionsHistoricalReplayCase, OptionsHistoricalReplayConfig } from "../../contracts/OptionsHistoricalReplay";
import { marketEvidenceFingerprint } from "../options-market-evidence/OptionsMarketEvidenceEngine";
import { runOptionsHistoricalReplay, validateHistoricalReplayConfig } from "./OptionsHistoricalReplayEngine";
import { fixtureHistoricalReplayCases, historicalReplayFixture } from "./OptionsHistoricalReplayFixtures";

let passed = 0;
function test(name: string, run: () => void) { run(); passed++; console.log(`PASS ${name}`); }
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
function ok(value: unknown): asserts value { if (!value) throw new Error("Assertion failed"); }
function throws(run: () => unknown, expected: string) { try { run(); } catch (error) { ok(error instanceof Error); ok(error.message.includes(expected)); return; } throw new Error(`Expected ${expected}`); }
function replay(input = historicalReplayFixture()) { return runOptionsHistoricalReplay(input.config, input.evidence, input.recordedAt); }
function plan(input: OptionsHistoricalReplayCase, changes: Partial<OptionsHistoricalReplayConfig["plan"]>): OptionsHistoricalReplayCase {
  return { ...input, config: { ...input.config, plan: { ...input.config.plan, ...changes } } };
}
function assume(input: OptionsHistoricalReplayCase, changes: Partial<OptionsHistoricalReplayConfig["assumptions"]>): OptionsHistoricalReplayCase {
  return { ...input, config: { ...input.config, assumptions: { ...input.config.assumptions, ...changes } } };
}
function rows(input: OptionsHistoricalReplayCase, change: (row: CboeOptionQuoteRow, index: number) => CboeOptionQuoteRow): OptionsHistoricalReplayCase {
  return { ...input, evidence: { ...input.evidence!, rows: input.evidence!.rows.map(change) } };
}
function has(input: OptionsHistoricalReplayCase, blocker: string) { ok(replay(input).blockers.includes(blocker)); }
const base = historicalReplayFixture();

test("target process freezes the plan and uses later observations for both entry and exit", () => {
  const result = replay();
  equal(result.status, "CLOSED"); equal(result.entry?.rowIndex, 1); equal(result.triggerAt, "2026-09-04T14:02:00.000Z");
  equal(result.exit?.rowIndex, 3); equal(result.entry?.premiumCents, 2000); equal(result.exit?.premiumCents, 3100);
  equal(result.plannedRiskCents, 420); equal(result.netTargetCents, 840); equal(result.netPnlCents, 1080);
});
test("all-in cash R includes round-trip fees and adverse exit slippage", () => {
  const modified = assume(plan(base, { stopLossBps: 1500 }), { costs: { ...base.config.assumptions.costs!, exitSlippagePerShareCents: 1 } });
  const result = replay(modified);
  equal(result.plannedRiskCents, 420); equal(result.netTargetCents, 840); equal(result.exit?.pricePerShareCents, 30); equal(result.netPnlCents, 980);
});
test("recorded source clocks and retrospective research provenance remain unchanged", () => {
  const result = replay();
  equal(result.importedAt, base.evidence!.importedAt); equal(result.recordedAt, base.recordedAt);
  equal(result.sourceFileSha256, base.evidence!.sourceFileSha256);
  equal(result.evidenceFingerprint, marketEvidenceFingerprint(base.evidence));
  equal(result.researchMode, "COUNTERFACTUAL_SNAPSHOT_TIME"); equal(result.selectionStatus, "RETROSPECTIVE_DECLARATION");
  equal(result.executionAllowed, false); equal(result.marketValidated, false); equal(result.winProbability, null);
  equal(result.entry?.classification, "ASSUMED_FILL"); equal(result.exit?.classification, "ASSUMED_FILL");
});
test("recording a later exit never settles sale proceeds or compounds independent runs", () => {
  const first = replay(), second = replay({ ...base, config: { ...base.config, runId: "independent-second" } });
  equal(first.account, { initialEquityCents: 100000, settledCashCents: 97980, unsettledCashCents: 3100, reservedCashCents: 0, openPositionCount: 0, unrealizedEquityCents: 101080 });
  equal(second.account, first.account);
});
test("a later stop fill can exceed planned R without pretending stop-price protection", () => {
  const result = replay(fixtureHistoricalReplayCases()[1]!);
  equal(result.exitReason, "STOP"); equal(result.exit?.pricePerShareCents, 10); equal(result.netPnlCents, -1020);
  ok(result.netPnlCents! < -result.plannedRiskCents!); equal(result.quoteGapObserved, true);
});
test("target trigger remains sticky even when the next snapshot exit loses money", () => {
  const result = replay(fixtureHistoricalReplayCases()[2]!);
  equal(result.exitReason, "TARGET"); equal(result.netPnlCents, -520); equal(result.exit?.rowIndex, 3);
});
test("time exit triggers through missing prices and remains unresolved without a later usable bid", () => {
  const result = replay(fixtureHistoricalReplayCases()[3]!);
  equal(result.status, "EXIT_PENDING"); equal(result.exitReason, "TIME_EXIT"); equal(result.triggerAt, base.config.plan.timeExitAt);
  equal(result.exit, null); equal(result.netPnlCents, null); equal(result.account.unrealizedEquityCents, null);
  equal(result.account.openPositionCount, 1); equal(result.exitLiquidityDelayed, true);
});
test("oversized real-priced premiums respect allocation, cash R and full-premium limits", () => {
  const result = replay(fixtureHistoricalReplayCases()[4]!);
  equal(result.status, "NO_TRADE"); equal(result.entry, null); equal(result.account.reservedCashCents, 0);
  for (const code of ["ALLOCATION_BUDGET_EXCEEDED", "PLANNED_RISK_BUDGET_EXCEEDED", "LEGACY_MAX_LOSS_LIMIT_EXCEEDED"]) ok(result.blockers.includes(code));
});
test("missing data produces an explicit reproducible blocked result", () => {
  const result = replay(fixtureHistoricalReplayCases()[5]!);
  equal(result.status, "BLOCKED"); equal(result.origin, "MISSING_DATA"); equal(result.importedAt, null); equal(result.sourceFileSha256, null);
  equal(result.evidenceFingerprint, null); equal(result.plannedRiskCents, null); ok(result.blockers.includes("DATASET_MISSING"));
});
test("configuration schema rejects injected authority, capital and timing fields", () => {
  for (const change of [{ executionAllowed: true }, { initialEquityCents: 1000000 }, { recordedAt: base.recordedAt }, { winProbability: 0.8 }]) {
    throws(() => validateHistoricalReplayConfig({ ...base.config, ...change }), "INVALID_HISTORICAL_REPLAY_CONFIG_FIELDS");
  }
  throws(() => validateHistoricalReplayConfig({ ...base.config, schemaVersion: "2.0" }), "INVALID_HISTORICAL_REPLAY_CONFIG");
});
test("identifiers, counts and money fields have strict finite safe bounds", () => {
  for (const runId of ["", " bad", "a b", "a".repeat(101)]) throws(() => validateHistoricalReplayConfig({ ...base.config, runId }), "INVALID_HISTORICAL_REPLAY_CONFIG");
  for (const changes of [{ quantity: 0 }, { quantity: 101 }, { quantity: 1.5 }, { entryLimitPerShareCents: NaN },
    { entryLimitPerShareCents: 100_000_001 }, { maxEntrySpreadPerShareCents: -0 }, { stopLossBps: 999 }, { stopLossBps: 2501 }, { rewardMultipleMilliR: 2001 }]) {
    throws(() => validateHistoricalReplayConfig(plan(base, changes).config), "INVALID_HISTORICAL_REPLAY_PLAN_ECONOMICS");
  }
});
test("plan chronology is validated even when no dataset exists", () => {
  for (const changes of [{ decisionAt: "2026-09-04T14:00:00Z" }, { entryDeadlineAt: base.config.plan.decisionAt },
    { timeExitAt: base.config.plan.entryDeadlineAt }, { timeExitAt: "2026-09-05T14:05:00.000Z" }]) {
    throws(() => replay({ ...plan(base, changes), evidence: null }), "INVALID_HISTORICAL_REPLAY_PLAN_TIME_OR_IDENTITY");
  }
});
test("recording time must be real canonical metadata after data ingestion", () => {
  throws(() => runOptionsHistoricalReplay(base.config, base.evidence, "2026-09-06"), "INVALID_HISTORICAL_REPLAY_RECORDED_AT");
  throws(() => runOptionsHistoricalReplay(base.config, base.evidence, "2026-09-05T21:59:59.999Z"), "HISTORICAL_REPLAY_RECORDED_BEFORE_IMPORT");
});
test("missing contract, session, cost or counterfactual consent is blocked instead of guessed", () => {
  for (const [changes, blocker] of [
    [{ contractTerms: null }, "CONTRACT_TERMS_MISSING"], [{ session: null }, "SESSION_ASSUMPTION_MISSING"],
    [{ costs: null }, "COST_ASSUMPTION_MISSING"], [{ acknowledgeCounterfactual: false }, "COUNTERFACTUAL_ACKNOWLEDGEMENT_MISSING"],
  ] as const) has(assume(base, changes), blocker);
});
test("malformed assumption values are rejected instead of treated as qualified unknowns", () => {
  throws(() => validateHistoricalReplayConfig({ ...base.config, assumptions: { ...base.config.assumptions, acknowledgeCounterfactual: "yes" } }), "INVALID_HISTORICAL_REPLAY_ASSUMPTIONS");
  throws(() => validateHistoricalReplayConfig({ ...base.config, assumptions: { ...base.config.assumptions, liquidityModel: "FULL_FILL_WITHOUT_SIZE" } }), "INVALID_HISTORICAL_REPLAY_ASSUMPTIONS");
  throws(() => validateHistoricalReplayConfig(assume(base, { costs: { ...base.config.assumptions.costs!, entryFeeCents: Infinity } }).config), "INVALID_HISTORICAL_REPLAY_COST_ASSUMPTION");
  throws(() => validateHistoricalReplayConfig({ ...base.config, assumptions: { ...base.config.assumptions, contractTerms: { ...base.config.assumptions.contractTerms, multiplier: 10 } } }), "INVALID_HISTORICAL_REPLAY_CONTRACT_ASSUMPTION");
});
test("Eastern opening, weekday and closing assumptions are checked without certifying holidays", () => {
  const session = base.config.assumptions.session!;
  for (const marketOpen of ["2026-09-04T14:30:00.000Z", "2026-09-04T13:30:00.001Z"]) throws(() => validateHistoricalReplayConfig(assume(base, { session: { ...session, marketOpen } }).config), "INVALID_HISTORICAL_REPLAY_SESSION_CLOCK");
  for (const marketClose of ["2026-09-04T19:00:00.000Z", "2026-09-05T20:00:00.000Z"]) throws(() => validateHistoricalReplayConfig(assume(base, { session: { ...session, marketClose } }).config), "INVALID_HISTORICAL_REPLAY_SESSION_CLOCK");
  for (const marketClose of ["2026-09-04T17:00:00.000Z", "2026-09-04T20:15:00.000Z"]) equal(validateHistoricalReplayConfig(assume(base, { session: { ...session, marketClose } }).config).assumptions.session!.marketClose, marketClose);
});
test("winter session validation uses the correct daylight-saving offset", () => {
  const winter = plan(base, { decisionAt: "2026-12-07T15:00:00.000Z", entryDeadlineAt: "2026-12-07T15:02:00.000Z", timeExitAt: "2026-12-07T15:05:00.000Z" });
  const declared = assume(winter, { session: { ...base.config.assumptions.session!, sessionDate: "2026-12-07", marketOpen: "2026-12-07T14:30:00.000Z", marketClose: "2026-12-07T21:00:00.000Z" } });
  equal(validateHistoricalReplayConfig(declared.config).assumptions.session!.marketOpen, "2026-12-07T14:30:00.000Z");
  throws(() => validateHistoricalReplayConfig(assume(declared, { session: { ...declared.config.assumptions.session!, marketOpen: "2026-12-07T13:30:00.000Z" } }).config), "INVALID_HISTORICAL_REPLAY_SESSION_CLOCK");
});
test("plans cannot start at open or exit at the declared close", () => {
  throws(() => validateHistoricalReplayConfig(plan(base, { decisionAt: base.config.assumptions.session!.marketOpen }).config), "HISTORICAL_REPLAY_PLAN_OUTSIDE_SESSION");
  throws(() => validateHistoricalReplayConfig(plan(base, { timeExitAt: base.config.assumptions.session!.marketClose }).config), "HISTORICAL_REPLAY_PLAN_OUTSIDE_SESSION");
});
test("a wrong dataset ID or missing selected contract cannot use another file silently", () => {
  has({ ...base, config: { ...base.config, datasetId: "different" } }, "DATASET_ID_MISMATCH");
  has({ ...base, config: { ...base.config, contractKey: "IBIT:2026-09-25:PUT:6000" } }, "SELECTED_CONTRACT_MISSING");
});
test("owner file origin stays unverified and requires an explicit local-use declaration", () => {
  const owner = { ...base, evidence: { ...base.evidence!, metadata: { ...base.evidence!.metadata, origin: "OWNER_PROVIDED_FILE" as const, usageDeclaration: "OWNER_ATTESTED_LOCAL_USE" as const } } };
  const result = replay(owner); equal(result.status, "CLOSED"); equal(result.origin, "OWNER_PROVIDED_FILE"); equal(result.marketValidated, false);
  has({ ...owner, evidence: { ...owner.evidence, metadata: { ...owner.evidence.metadata, usageDeclaration: "UNKNOWN" } } }, "SOURCE_USAGE_NOT_DECLARED");
});
test("unsupported delayed delivery and intervals cannot pass historical-clock modeling", () => {
  has({ ...base, evidence: { ...base.evidence!, metadata: { ...base.evidence!.metadata, delivery: "INTRADAY_15_MIN_DELAYED" } } }, "HISTORICAL_DELIVERY_REQUIRED");
  has({ ...base, evidence: { ...base.evidence!, metadata: { ...base.evidence!.metadata, intervalMinutes: 16 } } }, "UNSUPPORTED_REPLAY_INTERVAL");
});
test("single-snapshot files are blocked instead of generating a trade", () => {
  has({ ...base, evidence: { ...base.evidence!, rows: base.evidence!.rows.slice(0, 1) } }, "INSUFFICIENT_SELECTED_OBSERVATIONS");
});
test("a nonstandard root remains unsupported despite caller standard-contract assumptions", () => {
  const altered = historicalReplayFixture("adjusted", [{ root: "GLD1" }, { root: "GLD1", quote_datetime: "2026-09-04 10:01:00" }]);
  has({ ...altered, config: { ...altered.config, contractKey: "GLD1:2026-09-25:CALL:48000" } }, "NONSTANDARD_ROOT_UNSUPPORTED");
});
test("DTE and call-put direction are tied to the actual selected contract", () => {
  const altered = historicalReplayFixture("short-dte", [{ expiration: "2026-09-11" }, { expiration: "2026-09-11", quote_datetime: "2026-09-04 10:01:00" }]);
  has({ ...altered, config: { ...altered.config, contractKey: "GLD:2026-09-11:CALL:48000" } }, "UNSUPPORTED_REPLAY_DTE");
  has(plan(base, { thesis: { ...base.config.plan.thesis, direction: "BEARISH" } }), "THESIS_CONTRACT_DIRECTION_MISMATCH");
});
test("IBIT puts can run through the same arithmetic without silently becoming calls", () => {
  const converted = rows(base, (row) => ({ ...row, underlyingSymbol: "IBIT", root: "IBIT", optionType: "PUT", strikeCents: 6000, contractKey: "IBIT:2026-09-25:PUT:6000", delta: "-0.2" }));
  const input = plan({ ...converted, config: { ...converted.config, contractKey: "IBIT:2026-09-25:PUT:6000" } }, { thesis: { ...base.config.plan.thesis, direction: "BEARISH" } });
  equal(replay(input).symbol, "IBIT"); equal(replay(input).netPnlCents, 1080);
});
test("modern size data cannot meet the strict contemporaneous liquidity mode", () => {
  has(assume(base, { liquidityModel: "REQUIRE_CONTEMPORANEOUS_SIZE" }), "CONTEMPORANEOUS_SIZE_UNPROVEN");
});
test("explicit recorded-size assumptions never invent missing, zero or insufficient entry sizes", () => {
  for (const changes of [{ bidSizeContracts: null }, { askSizeContracts: null }, { bidSizeContracts: 0 }, { askSizeContracts: 0 }]) {
    has(rows(base, (row, index) => index === 0 ? { ...row, ...changes } : row), "ENTRY_RECORDED_SIZES_UNAVAILABLE");
  }
});
test("missing or zero option and underlying prices block baseline diagnosis", () => {
  for (const changes of [{ bidCents: null }, { askCents: null }, { bidCents: 0 }, { underlyingBidCents: null }, { underlyingAskCents: 0, underlyingBidCents: 0 }]) {
    has(rows(base, (row, index) => index === 0 ? { ...row, ...changes } : row), "ENTRY_PRICES_UNAVAILABLE");
  }
});
test("baseline evidence cannot be borrowed from after the decision or from an old interval", () => {
  has({ ...base, evidence: { ...base.evidence!, rows: base.evidence!.rows.slice(1) } }, "DECISION_BASELINE_MISSING_OR_STALE");
  const missingMinute = { ...base, evidence: { ...base.evidence!, rows: base.evidence!.rows.filter((_row, index) => index !== 1) } };
  has(plan(missingMinute, { decisionAt: "2026-09-04T14:01:00.001Z", entryDeadlineAt: "2026-09-04T14:03:00.000Z" }), "DECISION_BASELINE_MISSING_OR_STALE");
});
test("the most recent pre-decision quote is selected without renumbering source rows", () => {
  const reversed = { ...base, evidence: { ...base.evidence!, rows: [...base.evidence!.rows].reverse() } };
  const result = replay(reversed);
  equal(result.entry?.rowIndex, 2); equal(result.exit?.rowIndex, 0); equal(result.netPnlCents, 1080);
});
test("entry limit below baseline bid is explicit no-trade without a fabricated bid", () => {
  const input = plan(base, { entryLimitPerShareCents: 18 });
  equal(replay(input).status, "NO_TRADE"); has(input, "LIMIT_BELOW_BASELINE_BID"); equal(replay(input).entry, null);
});
test("baseline ask above limit may wait for a genuine later lower ask", () => {
  const input = rows(base, (row, index) => index === 0 ? { ...row, askCents: 21 } : row);
  equal(replay(input).status, "CLOSED"); equal(replay(input).entry?.pricePerShareCents, 20);
});
test("off-tick limits and exit slippage do not round themselves into permission", () => {
  const terms = { ...base.config.assumptions.contractTerms!, minimumPriceTickCents: 5 };
  has(assume(plan(base, { entryLimitPerShareCents: 21 }), { contractTerms: terms }), "REPLAY_PLAN_OR_SLIPPAGE_OFF_TICK");
  has(assume(base, { contractTerms: terms, costs: { ...base.config.assumptions.costs!, exitSlippagePerShareCents: 1 } }), "REPLAY_PLAN_OR_SLIPPAGE_OFF_TICK");
  has(assume(base, { contractTerms: terms }), "ENTRY_QUOTE_OFF_TICK");
});
test("wide spreads and costs can consume the stop budget even when premium is affordable", () => {
  has(rows(base, (row, index) => index === 0 ? { ...row, bidCents: 15 } : row), "ENTRY_SPREAD_LIMIT_EXCEEDED");
  const input = plan(rows(base, (row, index) => index === 0 ? { ...row, bidCents: 16 } : row), { maxEntrySpreadPerShareCents: 4 });
  has(input, "STOP_BUDGET_NOT_EXECUTABLE");
});
test("a later quote at the entry deadline cancels rather than fills", () => {
  const input = historicalReplayFixture("deadline", [{}, { quote_datetime: "2026-09-04 10:02:00" }]);
  const result = replay(input);
  equal(result.status, "NO_TRADE"); equal(result.entry, null); equal(result.account.reservedCashCents, 0);
  ok(result.blockers.includes("ENTRY_DEADLINE_REACHED_NO_FILL"));
});
test("data ending before the entry deadline preserves the cash reservation", () => {
  const input = historicalReplayFixture("pending-entry", [{}, { quote_datetime: "2026-09-04 10:01:00", bid: "0.20", ask: "0.21" }]);
  const result = replay(input);
  equal(result.status, "ENTRY_PENDING"); equal(result.entry, null); equal(result.account.reservedCashCents, 2020); equal(result.account.settledCashCents, 100000);
});
test("the entry observation cannot immediately trigger or fill an exit", () => {
  const input = { ...base, evidence: { ...base.evidence!, rows: base.evidence!.rows.slice(0, 2) } };
  const result = replay(input);
  equal(result.status, "OPEN"); equal(result.exit, null); equal(result.exitReason, null); equal(result.netPnlCents, null);
  equal(result.account.unrealizedEquityCents, 99880);
});
test("actual lower entry ask recalculates R and net target with unchanged frozen plan", () => {
  const input = rows(base, (row, index) => index === 1 ? { ...row, askCents: 18, bidCents: 17 } : row);
  const result = replay(input);
  equal(result.entry?.premiumCents, 1800); equal(result.plannedRiskCents, 380); equal(result.netTargetCents, 760);
  equal(result.config.plan.entryLimitPerShareCents, 20);
});
test("later invalid entry prices, sizes or spread cannot consume reserved cash", () => {
  for (const changes of [{ bidSizeContracts: 0 }, { askSizeContracts: null }, { underlyingBidCents: null }, { bidCents: 17 }]) {
    const input = rows(base, (row, index) => index === 1 ? { ...row, ...changes } : row);
    const result = replay(input); equal(result.entry, null); equal(result.status, "NO_TRADE"); equal(result.account.settledCashCents, 100000);
  }
});
test("a triggered exit at the last observation remains pending, not sold at trigger price", () => {
  const result = replay({ ...base, evidence: { ...base.evidence!, rows: base.evidence!.rows.slice(0, 3) } });
  equal(result.status, "EXIT_PENDING"); equal(result.exitReason, "TARGET"); equal(result.exit, null);
});
test("missing post-trigger bid sizes delay exit and invalidate the final equity mark", () => {
  const input = rows(base, (row, index) => index === 3 ? { ...row, bidSizeContracts: null } : row);
  const result = replay(input);
  equal(result.status, "EXIT_PENDING"); equal(result.exitLiquidityDelayed, true); equal(result.account.unrealizedEquityCents, null);
});
test("time-triggering observations cannot provide same-snapshot fills even when liquid", () => {
  const input = historicalReplayFixture("liquid-time-trigger", [{}, { quote_datetime: "2026-09-04 10:01:00" }, { quote_datetime: "2026-09-04 10:05:00", bid: "0.21", ask: "0.22" }]);
  const result = replay(input); equal(result.status, "EXIT_PENDING"); equal(result.exitReason, "TIME_EXIT"); equal(result.exit, null);
});
test("the next usable observation after a time trigger completes a modeled exit", () => {
  const input = historicalReplayFixture("liquid-time-exit", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:05:00", bid: "0.21", ask: "0.22" }, { quote_datetime: "2026-09-04 10:06:00", bid: "0.21", ask: "0.22" }]);
  const result = replay(input); equal(result.status, "CLOSED"); equal(result.exitReason, "TIME_EXIT"); equal(result.netPnlCents, 80);
});
test("a time trigger remains sticky when the later bid crosses stop or target", () => {
  const input = historicalReplayFixture("time-sticky", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:05:00", bid: "", ask: "", bid_size: "", ask_size: "" }, { quote_datetime: "2026-09-04 10:06:00", bid: "0.10", ask: "0.11" }]);
  equal(replay(input).exitReason, "TIME_EXIT"); equal(replay(input).netPnlCents, -1020);
});
test("quotes at or after the declared session close cannot liquidate an unresolved position", () => {
  const input = historicalReplayFixture("closed-session", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:05:00", bid: "0.21", ask: "0.22" }, { quote_datetime: "2026-09-04 16:00:00", bid: "0.30", ask: "0.31" }]);
  const result = replay(input); equal(result.status, "EXIT_PENDING"); equal(result.exit, null); equal(result.account.unrealizedEquityCents, null);
});
test("a known zero bid triggers a stop but cannot provide a fill until a later positive bid", () => {
  const input = historicalReplayFixture("zero-bid-stop", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:02:00", bid: "0", ask: "0.01", bid_size: "0" },
    { quote_datetime: "2026-09-04 10:03:00", bid: "0", ask: "0.01", bid_size: "0" },
    { quote_datetime: "2026-09-04 10:04:00", bid: "0.10", ask: "0.11" }]);
  const result = replay(input); equal(result.status, "CLOSED"); equal(result.exitReason, "STOP");
  equal(result.triggerAt, "2026-09-04T14:02:00.000Z"); equal(result.exit?.rowIndex, 4); equal(result.exitLiquidityDelayed, true);
});
test("next-day source rows cannot produce events or fills outside the modeled session", () => {
  const input = historicalReplayFixture("next-day", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-08 10:00:00", bid: "0.30", ask: "0.31" }]);
  const result = replay(input);
  equal(result.status, "EXIT_PENDING"); equal(result.exit, null); equal(result.evaluatedThroughAt, "2026-09-04T20:00:00.000Z");
  equal(result.sourceCoverageThroughAt, "2026-09-08T14:00:00.000Z"); equal(result.account.unrealizedEquityCents, null);
  ok(result.events.every((event) => event.at <= "2026-09-04T20:00:00.000Z" && event.rowIndex !== 2));
});
test("the evaluated clock ends at exit while source coverage retains later observations", () => {
  const input = historicalReplayFixture("closed-before-data-end", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:02:00", bid: "0.30", ask: "0.31" }, { quote_datetime: "2026-09-04 10:03:00", bid: "0.31", ask: "0.32" },
    { quote_datetime: "2026-09-04 15:00:00", bid: "0.10", ask: "0.11" }]);
  const result = replay(input); equal(result.evaluatedThroughAt, result.exit!.snapshotAt); equal(result.sourceCoverageThroughAt, "2026-09-04T19:00:00.000Z");
});
test("event observation clocks never backdate a late time trigger or entry cancellation", () => {
  const delayedTime = historicalReplayFixture("delayed-time-clock", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:06:00", bid: "", ask: "", bid_size: "", ask_size: "" }]);
  const lateEntry = historicalReplayFixture("delayed-entry-clock", [{}, { quote_datetime: "2026-09-04 10:04:00" }]);
  for (const input of [delayedTime, lateEntry]) {
    const result = replay(input);
    ok(result.events.every((event, index) => index === 0 || event.at >= result.events[index - 1]!.at));
    ok(result.events.every((event) => event.rowIndex === null || event.at >= input.evidence!.rows[event.rowIndex]!.snapshotAt));
  }
  const result = replay(delayedTime);
  equal(result.triggerAt, "2026-09-04T14:05:00.000Z"); equal(result.events.find((event) => event.type === "EXIT_TRIGGERED")!.at, "2026-09-04T14:06:00.000Z");
});
test("the public fixture collection includes an explicit IBIT put time exit after the six initial cases", () => {
  const cases = fixtureHistoricalReplayCases(); equal(cases.length, 7);
  const result = replay(cases[6]!); equal(result.symbol, "IBIT"); equal(result.config.plan.thesis.direction, "BEARISH");
  equal(result.status, "CLOSED"); equal(result.exitReason, "TIME_EXIT"); equal(result.netPnlCents, 80);
});
test("stop signals use observable prices even when trigger-side liquidity is unavailable", () => {
  const input = historicalReplayFixture("stop-no-size", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:02:00", bid: "0.16", ask: "0.17", bid_size: "0" }, { quote_datetime: "2026-09-04 10:03:00", bid: "0.30", ask: "0.31" }]);
  const result = replay(input); equal(result.exitReason, "STOP"); equal(result.netPnlCents, 980); equal(result.exitLiquidityDelayed, true);
});
test("quote gaps are explicit while consecutive samples still do not claim intraminute order", () => {
  const complete = replay(); equal(complete.quoteGapObserved, false);
  ok(complete.limitations.some((item) => item.includes("intraminute")));
  equal(replay(fixtureHistoricalReplayCases()[1]!).quoteGapObserved, true);
});
test("a fully revalidated run is deterministic and preserves immutable source data", () => {
  const input = JSON.parse(JSON.stringify(base)) as OptionsHistoricalReplayCase;
  const before = marketEvidenceFingerprint(input), first = replay(input), second = replay(input);
  equal(marketEvidenceFingerprint(first), marketEvidenceFingerprint(second)); equal(marketEvidenceFingerprint(input), before);
  ok(Object.isFrozen(first)); ok(Object.isFrozen(first.config.plan)); ok(Object.isFrozen(first.events)); ok(Object.isFrozen(first.account));
});
test("accessors and hidden authority fields reject without executing caller code", () => {
  let invoked = false;
  const config = { ...base.config };
  Object.defineProperty(config, "runId", { enumerable: true, get() { invoked = true; return "injected"; } });
  throws(() => validateHistoricalReplayConfig(config), "INVALID_HISTORICAL_REPLAY_CONFIG_FIELDS"); equal(invoked, false);
  throws(() => validateHistoricalReplayConfig({ ...base.config, [Symbol("authority")]: true }), "INVALID_HISTORICAL_REPLAY_CONFIG_FIELDS");
  const injected = { ...base.config.plan };
  Object.defineProperty(injected, "quantity", { enumerable: true, get() { invoked = true; return 1; } });
  throws(() => validateHistoricalReplayConfig({ ...base.config, plan: injected }), "INVALID_HISTORICAL_REPLAY_PLAN_FIELDS"); equal(invoked, false);
});

console.log(`Options historical replay engine: ${passed}/${passed} passed.`);
