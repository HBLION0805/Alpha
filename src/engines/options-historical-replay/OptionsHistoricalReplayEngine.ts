import type { CboeOptionQuoteRow } from "../../contracts/OptionsMarketEvidence";
import type { OptionsHistoricalReplayConfig, OptionsHistoricalReplayEvent, OptionsHistoricalReplayFill, OptionsHistoricalReplayResult } from "../../contracts/OptionsHistoricalReplay";
import { marketEvidenceFingerprint, validateOptionsMarketEvidence, type OptionsMarketEvidence } from "../options-market-evidence/OptionsMarketEvidenceEngine";
import { evaluateOptionsRetailFeasibility } from "../options-retail-feasibility/OptionsRetailFeasibilityEngine";

const MAX_MONEY = 100_000_000;
const ET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const CONFIG_KEYS = ["schemaVersion", "runId", "datasetId", "contractKey", "plan", "assumptions"];
const PLAN_KEYS = ["strategyVersion", "setupKey", "decisionAt", "entryDeadlineAt", "timeExitAt", "entryLimitPerShareCents", "quantity", "stopLossBps", "rewardMultipleMilliR", "maxEntrySpreadPerShareCents", "thesis"];
const THESIS_KEYS = ["direction", "magnitude", "horizon", "volatility", "path", "invalidation", "monthlyContext", "dailySetup", "intradayTrigger"];

function record(input: unknown, fields: readonly string[], code: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error(code);
  const keys = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== fields.length || keys.some((key) => typeof key !== "string" || !fields.includes(key)
    || !Object.hasOwn(descriptors[key]!, "value") || !descriptors[key]!.enumerable)) throw new Error(code);
  return input as Record<string, unknown>;
}
function utc(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function date(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d\d-\d\d$/u.test(value) && utc(`${value}T00:00:00.000Z`); }
function integer(value: unknown, min: number, max: number): value is number { return typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= min && value <= max; }
function identifier(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,99}$/u.test(value); }
function text(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 400 && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value); }
function freeze<T>(value: T): T { if (value !== null && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function compare(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function local(at: string): { date: string; time: string; weekday: string } {
  const fields = Object.fromEntries(ET.formatToParts(new Date(at)).map((part) => [part.type, part.value]));
  return { date: `${fields.year!.padStart(4, "0")}-${fields.month}-${fields.day}`, time: `${fields.hour}:${fields.minute}:${fields.second}`, weekday: fields.weekday! };
}
function cents(value: bigint): number {
  if (value < -BigInt(Number.MAX_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("HISTORICAL_REPLAY_NUMERIC_OVERFLOW");
  return Number(value);
}

/** Structural validation does not turn owner declarations into verified contract/calendar evidence. */
export function validateHistoricalReplayConfig(input: unknown): OptionsHistoricalReplayConfig {
  const value = record(input, CONFIG_KEYS, "INVALID_HISTORICAL_REPLAY_CONFIG_FIELDS");
  if (value.schemaVersion !== "1.0" || !identifier(value.runId) || !identifier(value.datasetId) || !identifier(value.contractKey)) throw new Error("INVALID_HISTORICAL_REPLAY_CONFIG");
  const plan = record(value.plan, PLAN_KEYS, "INVALID_HISTORICAL_REPLAY_PLAN_FIELDS");
  if (!identifier(plan.strategyVersion) || !identifier(plan.setupKey) || !utc(plan.decisionAt) || !utc(plan.entryDeadlineAt) || !utc(plan.timeExitAt)
    || !(plan.decisionAt < plan.entryDeadlineAt && plan.entryDeadlineAt < plan.timeExitAt)
    || local(plan.decisionAt).date !== local(plan.timeExitAt).date) throw new Error("INVALID_HISTORICAL_REPLAY_PLAN_TIME_OR_IDENTITY");
  if (!integer(plan.entryLimitPerShareCents, 1, MAX_MONEY) || !integer(plan.quantity, 1, 100)
    || !integer(plan.stopLossBps, 1000, 2500) || !integer(plan.rewardMultipleMilliR, 1500, 2000)
    || !integer(plan.maxEntrySpreadPerShareCents, 0, MAX_MONEY)) throw new Error("INVALID_HISTORICAL_REPLAY_PLAN_ECONOMICS");
  const thesis = record(plan.thesis, THESIS_KEYS, "INVALID_HISTORICAL_REPLAY_THESIS_FIELDS");
  if ((thesis.direction !== "BULLISH" && thesis.direction !== "BEARISH") || Object.values(thesis).some((field) => !text(field))) throw new Error("INVALID_HISTORICAL_REPLAY_THESIS");
  const assumptions = record(value.assumptions, ["contractTerms", "session", "costs", "liquidityModel", "acknowledgeCounterfactual"], "INVALID_HISTORICAL_REPLAY_ASSUMPTION_FIELDS");
  if ((assumptions.liquidityModel !== "REQUIRE_CONTEMPORANEOUS_SIZE" && assumptions.liquidityModel !== "ASSUME_RECORDED_SIZE_AVAILABLE")
    || typeof assumptions.acknowledgeCounterfactual !== "boolean") throw new Error("INVALID_HISTORICAL_REPLAY_ASSUMPTIONS");
  if (assumptions.contractTerms !== null) {
    const terms = record(assumptions.contractTerms, ["multiplier", "deliverable", "exerciseStyle", "minimumPriceTickCents", "reference"], "INVALID_HISTORICAL_REPLAY_CONTRACT_FIELDS");
    if (terms.multiplier !== 100 || terms.deliverable !== "STANDARD_100_SHARES_USD" || terms.exerciseStyle !== "AMERICAN"
      || !integer(terms.minimumPriceTickCents, 1, 100) || !text(terms.reference)) throw new Error("INVALID_HISTORICAL_REPLAY_CONTRACT_ASSUMPTION");
  }
  if (assumptions.costs !== null) {
    const costs = record(assumptions.costs, ["entryFeeCents", "exitFeeCents", "exitSlippagePerShareCents", "reference"], "INVALID_HISTORICAL_REPLAY_COST_FIELDS");
    if (![costs.entryFeeCents, costs.exitFeeCents, costs.exitSlippagePerShareCents].every((amount) => integer(amount, 0, MAX_MONEY)) || !text(costs.reference)) throw new Error("INVALID_HISTORICAL_REPLAY_COST_ASSUMPTION");
  }
  if (assumptions.session !== null) {
    const session = record(assumptions.session, ["sessionDate", "marketOpen", "marketClose", "reference"], "INVALID_HISTORICAL_REPLAY_SESSION_FIELDS");
    if (!date(session.sessionDate) || !utc(session.marketOpen) || !utc(session.marketClose) || session.marketOpen >= session.marketClose || !text(session.reference)) throw new Error("INVALID_HISTORICAL_REPLAY_SESSION_ASSUMPTION");
    const open = local(session.marketOpen), close = local(session.marketClose);
    if (open.date !== session.sessionDate || close.date !== session.sessionDate || ["Sat", "Sun"].includes(open.weekday)
      || open.time !== "09:30:00" || !["13:00:00", "16:00:00", "16:15:00"].includes(close.time)
      || !session.marketOpen.endsWith(".000Z") || !session.marketClose.endsWith(".000Z")) throw new Error("INVALID_HISTORICAL_REPLAY_SESSION_CLOCK");
    if (plan.decisionAt <= session.marketOpen || plan.timeExitAt >= session.marketClose) throw new Error("HISTORICAL_REPLAY_PLAN_OUTSIDE_SESSION");
  }
  return freeze(structuredClone(value)) as unknown as OptionsHistoricalReplayConfig;
}

/** One isolated counterfactual run, not the paper account and not historical exchange execution reconstruction. */
export function runOptionsHistoricalReplay(configInput: unknown, evidenceInput: OptionsMarketEvidence | null, recordedAt: string): OptionsHistoricalReplayResult {
  const config = validateHistoricalReplayConfig(configInput);
  if (!utc(recordedAt)) throw new Error("INVALID_HISTORICAL_REPLAY_RECORDED_AT");
  const evidence = evidenceInput === null ? null : validateOptionsMarketEvidence(evidenceInput);
  if (evidence && evidence.importedAt > recordedAt) throw new Error("HISTORICAL_REPLAY_RECORDED_BEFORE_IMPORT");
  const { plan, assumptions } = config;
  const selected = evidence?.rows.map((row, rowIndex) => ({ row, rowIndex })).filter(({ row }) => row.contractKey === config.contractKey)
    .sort((left, right) => compare(left.row.snapshotAt, right.row.snapshotAt)) ?? [];
  const identity = selected[0]?.row;
  const events: OptionsHistoricalReplayEvent[] = [], blockers: string[] = [];
  let status: OptionsHistoricalReplayResult["status"] = "BLOCKED";
  let entry: OptionsHistoricalReplayFill | null = null, exit: OptionsHistoricalReplayFill | null = null;
  let exitReason: OptionsHistoricalReplayResult["exitReason"] = null, triggerAt: string | null = null;
  let plannedRiskCents: number | null = null, netTargetCents: number | null = null, netPnlCents: number | null = null, entrySpreadCents: number | null = null;
  let quoteGapObserved = false, exitLiquidityDelayed = false, settledCashCents = 100000, unsettledCashCents = 0, reservedCashCents = 0;
  let markCents: number | null = null;
  const lastSelectedAt = selected.at(-1)?.row.snapshotAt ?? null;
  let evaluatedThroughAt: string | null = null;
  const emit = (type: string, at: string, rowIndex: number | null = null, amountCents = 0, detail = "") => {
    events.push({ sequence: events.length + 1, type, at, rowIndex, amountCents, detail });
  };
  const finish = (): OptionsHistoricalReplayResult => {
    const openPosition = entry !== null && exit === null;
    const equity = openPosition ? (markCents === null ? null : settledCashCents + unsettledCashCents + markCents - assumptions.costs!.exitFeeCents) : settledCashCents + unsettledCashCents;
    if (settledCashCents < reservedCashCents || reservedCashCents < 0 || (status === "CLOSED" && equity !== 100000 + netPnlCents!)) throw new Error("HISTORICAL_REPLAY_CASH_RECONCILIATION_FAILURE");
    return freeze({ schemaVersion: "1.0", engineVersion: "SAMPLED_OPTIONS_REPLAY_V1", runId: config.runId, recordedAt, config,
      evidenceFingerprint: evidence ? marketEvidenceFingerprint(evidence) : null,
      planFingerprint: marketEvidenceFingerprint({ contractKey: config.contractKey, plan, assumptions }),
      origin: evidence?.metadata.origin ?? "MISSING_DATA", symbol: identity?.underlyingSymbol ?? null,
      importedAt: evidence?.importedAt ?? null, sourceFileSha256: evidence?.sourceFileSha256 ?? null,
      researchMode: "COUNTERFACTUAL_SNAPSHOT_TIME", selectionStatus: "RETROSPECTIVE_DECLARATION", exitModel: "NEXT_SNAPSHOT_MARKET_EXIT", sourceQuoteClock: "AMERICA_NEW_YORK_INTERVAL_END",
      sourceCoverageThroughAt: lastSelectedAt, evaluatedThroughAt, status, blockers: [...new Set(blockers)].sort(), entry, exit, exitReason, triggerAt, plannedRiskCents, netTargetCents, netPnlCents, entrySpreadCents,
      quoteGapObserved, exitLiquidityDelayed, account: { initialEquityCents: 100000, settledCashCents, unsettledCashCents, reservedCashCents,
        openPositionCount: openPosition ? 1 : 0, unrealizedEquityCents: equity }, events, assumptions,
      limitations: [
        "This is one isolated USD 1,000 research account; independent runs do not compound or share settled cash.",
        "Historical snapshot times are assumed decision clocks. Actual import and research recording times remain separate and unchanged.",
        "Contract selection and the plan are retrospective declarations, not independently established point-in-time strategy availability.",
        "Owner file provenance and contract, session and cost references are declarations, not verified publisher, calendar, broker or licensing evidence.",
        "All fills assume recorded prices and sufficient recorded sizes are available. Even pre-change sizes cannot guarantee exchange execution.",
        "On or after 2026-06-22 ET, Cboe sizes may reflect the last price change; only the explicitly assumed recorded-size model can use them.",
        "Decisions use interval snapshots only. Unobserved intraminute stop and target ordering is unknown even without missing intervals.",
        "TARGET triggers a market-style exit on a later snapshot; its realized profit can be below target or negative. Stops do not guarantee the planned cash loss.",
        "Unusable or absent exit quotes leave positions unresolved. There is no invented settlement, expiry exercise, brokerage order or real win probability.",
        "The original v1 market qualification and paper/review histories remain separate and unchanged.",
      ], executionAllowed: false, marketValidated: false, winProbability: null });
  };
  emit("RESEARCH_PLAN_FROZEN", plan.decisionAt, null, 0, "Retrospective declaration using a counterfactual snapshot clock.");
  if (!evidence) blockers.push("DATASET_MISSING");
  else {
    if (evidence.metadata.datasetId !== config.datasetId) blockers.push("DATASET_ID_MISMATCH");
    if (evidence.metadata.origin === "OWNER_PROVIDED_FILE" && evidence.metadata.usageDeclaration !== "OWNER_ATTESTED_LOCAL_USE") blockers.push("SOURCE_USAGE_NOT_DECLARED");
    if (evidence.metadata.delivery !== "HISTORICAL_FILE") blockers.push("HISTORICAL_DELIVERY_REQUIRED");
    if (evidence.metadata.intervalMinutes > 15) blockers.push("UNSUPPORTED_REPLAY_INTERVAL");
    if (!identity) blockers.push("SELECTED_CONTRACT_MISSING");
    if (selected.length < 2) blockers.push("INSUFFICIENT_SELECTED_OBSERVATIONS");
  }
  if (!assumptions.contractTerms) blockers.push("CONTRACT_TERMS_MISSING");
  if (!assumptions.session) blockers.push("SESSION_ASSUMPTION_MISSING");
  if (!assumptions.costs) blockers.push("COST_ASSUMPTION_MISSING");
  if (!assumptions.acknowledgeCounterfactual) blockers.push("COUNTERFACTUAL_ACKNOWLEDGEMENT_MISSING");
  if (identity) {
    if (identity.root !== identity.underlyingSymbol) blockers.push("NONSTANDARD_ROOT_UNSUPPORTED");
    if (identity.strikeCents > MAX_MONEY) blockers.push("CONTRACT_STRIKE_OUT_OF_BOUNDS");
    if (plan.thesis.direction !== (identity.optionType === "CALL" ? "BULLISH" : "BEARISH")) blockers.push("THESIS_CONTRACT_DIRECTION_MISMATCH");
    const dte = (Date.parse(`${identity.expirationDate}T00:00:00.000Z`) - Date.parse(`${local(plan.decisionAt).date}T00:00:00.000Z`)) / 86_400_000;
    if (dte < 14 || dte > 45) blockers.push("UNSUPPORTED_REPLAY_DTE");
  }
  if (blockers.length) { emit("REPLAY_BLOCKED", plan.decisionAt, null, 0, blockers.join(",")); return finish(); }
  const terms = assumptions.contractTerms!, session = assumptions.session!, costs = assumptions.costs!, source = evidence!;
  if (plan.entryLimitPerShareCents % terms.minimumPriceTickCents !== 0 || costs.exitSlippagePerShareCents % terms.minimumPriceTickCents !== 0) {
    blockers.push("REPLAY_PLAN_OR_SLIPPAGE_OFF_TICK"); return finish();
  }
  const inSession = (row: CboeOptionQuoteRow) => row.snapshotAt >= session.marketOpen && row.snapshotAt < session.marketClose;
  const positivePrice = (value: number | null) => value !== null && integer(value, 1, MAX_MONEY);
  const sized = (value: number | null) => value !== null && integer(value, plan.quantity, 100_000);
  const priceOnTick = (value: number | null) => positivePrice(value) && value! % terms.minimumPriceTickCents === 0;
  const triggerBidOnTick = (value: number | null) => value !== null && integer(value, 0, MAX_MONEY) && value % terms.minimumPriceTickCents === 0;
  const sizeModelUsable = (row: CboeOptionQuoteRow) => assumptions.liquidityModel === "ASSUME_RECORDED_SIZE_AVAILABLE" || row.quoteDatetimeEt.slice(0, 10) < "2026-06-22";
  const entryIssues = (row: CboeOptionQuoteRow) => {
    const issues: string[] = [];
    if (!inSession(row)) issues.push("ENTRY_QUOTE_OUTSIDE_SESSION");
    if (!positivePrice(row.bidCents) || !positivePrice(row.askCents) || !positivePrice(row.underlyingBidCents) || !positivePrice(row.underlyingAskCents)) issues.push("ENTRY_PRICES_UNAVAILABLE");
    if (!sized(row.bidSizeContracts) || !sized(row.askSizeContracts)) issues.push("ENTRY_RECORDED_SIZES_UNAVAILABLE");
    if (!sizeModelUsable(row)) issues.push("CONTEMPORANEOUS_SIZE_UNPROVEN");
    if (positivePrice(row.bidCents) && positivePrice(row.askCents) && (!priceOnTick(row.bidCents) || !priceOnTick(row.askCents))) issues.push("ENTRY_QUOTE_OFF_TICK");
    if (row.bidCents !== null && row.askCents !== null && row.askCents - row.bidCents > plan.maxEntrySpreadPerShareCents) issues.push("ENTRY_SPREAD_LIMIT_EXCEEDED");
    return issues;
  };
  const exitUsable = (row: CboeOptionQuoteRow) => inSession(row) && priceOnTick(row.bidCents) && sized(row.bidSizeContracts) && sizeModelUsable(row);
  const baseline = selected.filter(({ row }) => row.snapshotAt <= plan.decisionAt).at(-1);
  if (!baseline || Date.parse(plan.decisionAt) - Date.parse(baseline.row.snapshotAt) > source.metadata.intervalMinutes * 60_000) {
    blockers.push("DECISION_BASELINE_MISSING_OR_STALE"); return finish();
  }
  blockers.push(...entryIssues(baseline.row));
  if (blockers.length) return finish();
  status = "NO_TRADE";
  if (baseline.row.bidCents! > plan.entryLimitPerShareCents) { blockers.push("LIMIT_BELOW_BASELINE_BID"); return finish(); }
  const multiplier = BigInt(plan.quantity) * 100n;
  const positionCents = (perShare: number) => cents(BigInt(perShare) * multiplier);
  const economics = (ask: number, bid: number) => evaluateOptionsRetailFeasibility({ symbol: identity!.underlyingSymbol,
    strategy: identity!.optionType === "CALL" ? "LONG_CALL" : "LONG_PUT", currentEquityCents: 100000, settledCashCents: 100000,
    quantity: plan.quantity, contractMultiplier: 100, bidPerShareCents: bid, askPerShareCents: ask, minimumPriceTickCents: terms.minimumPriceTickCents,
    roundTripFeesCents: cents(BigInt(costs.entryFeeCents) + BigInt(costs.exitFeeCents)), slippageReserveCents: positionCents(costs.exitSlippagePerShareCents),
    mode: "NORMAL", stopLossBps: plan.stopLossBps, rewardMultipleMilliR: plan.rewardMultipleMilliR });
  const initialEconomics = economics(plan.entryLimitPerShareCents, baseline.row.bidCents!);
  plannedRiskCents = initialEconomics.economics?.plannedStopCents ?? null;
  netTargetCents = initialEconomics.economics?.netProfitTargetCents ?? null;
  if (initialEconomics.status !== "ECONOMICALLY_FEASIBLE_SCENARIO") { blockers.push(...initialEconomics.blockers.map((blocker) => blocker.code)); return finish(); }
  reservedCashCents = initialEconomics.economics!.capitalRequiredCents!;
  status = "ENTRY_PENDING";
  evaluatedThroughAt = plan.decisionAt;
  emit("ENTRY_LIMIT_SUBMITTED", plan.decisionAt, baseline.rowIndex, reservedCashCents, "Limit premium and round-trip fees reserved in an isolated research account.");
  let priorSnapshot = baseline.row.snapshotAt;
  for (const { row, rowIndex } of selected) {
    if (row.snapshotAt <= plan.decisionAt) continue;
    if (status === "CLOSED") break;
    if (row.snapshotAt >= session.marketClose) { evaluatedThroughAt = session.marketClose; markCents = null; break; }
    evaluatedThroughAt = row.snapshotAt;
    if (Date.parse(row.snapshotAt) - Date.parse(priorSnapshot) > source.metadata.intervalMinutes * 60_000) {
      quoteGapObserved = true; emit("OBSERVATION_GAP", row.snapshotAt, rowIndex, 0, "Elapsed interval is longer than the declared sampling interval; intervening prices are unknown.");
    }
    priorSnapshot = row.snapshotAt;
    if (status === "ENTRY_PENDING") {
      if (row.snapshotAt >= plan.entryDeadlineAt) {
        status = "NO_TRADE"; reservedCashCents = 0; blockers.push("ENTRY_DEADLINE_REACHED_NO_FILL"); emit("ENTRY_CANCELLED", row.snapshotAt, null, 0, `The frozen entry deadline was ${plan.entryDeadlineAt}.`); break;
      }
      const issues = entryIssues(row);
      if (issues.length || row.askCents! > plan.entryLimitPerShareCents) { emit("ENTRY_SNAPSHOT_NOT_FILLED", row.snapshotAt, rowIndex, 0, [...issues, ...(row.askCents! > plan.entryLimitPerShareCents ? ["ASK_ABOVE_LIMIT"] : [])].join(",")); continue; }
      const actual = economics(row.askCents!, row.bidCents!);
      if (actual.status !== "ECONOMICALLY_FEASIBLE_SCENARIO") { emit("ENTRY_ECONOMICS_REJECTED", row.snapshotAt, rowIndex, 0, actual.blockers.map((blocker) => blocker.code).join(",")); continue; }
      entry = { snapshotAt: row.snapshotAt, rowIndex, pricePerShareCents: row.askCents!, quantity: plan.quantity,
        premiumCents: positionCents(row.askCents!), feeCents: costs.entryFeeCents, classification: "ASSUMED_FILL" };
      settledCashCents -= entry.premiumCents + entry.feeCents; reservedCashCents = costs.exitFeeCents;
      plannedRiskCents = actual.economics!.plannedStopCents!; netTargetCents = actual.economics!.netProfitTargetCents!;
      entrySpreadCents = positionCents(row.askCents! - row.bidCents!); status = "OPEN";
      markCents = exitUsable(row) ? positionCents(Math.max(0, row.bidCents! - costs.exitSlippagePerShareCents)) : null;
      emit("ENTRY_ASSUMED_FILL", row.snapshotAt, rowIndex, entry.premiumCents, "Recorded ask and positive recorded sizes are assumed available; this is not a broker fill.");
      continue;
    }
    markCents = exitUsable(row) ? positionCents(Math.max(0, row.bidCents! - costs.exitSlippagePerShareCents)) : null;
    if (status === "OPEN") {
      if (row.snapshotAt >= plan.timeExitAt) { exitReason = "TIME_EXIT"; triggerAt = plan.timeExitAt; }
      else if (inSession(row) && triggerBidOnTick(row.bidCents)) {
        const valueIfSold = positionCents(Math.max(0, row.bidCents! - costs.exitSlippagePerShareCents)) - entry!.premiumCents - costs.entryFeeCents - costs.exitFeeCents;
        if (valueIfSold <= -plannedRiskCents!) { exitReason = "STOP"; triggerAt = row.snapshotAt; }
        else if (valueIfSold >= netTargetCents!) { exitReason = "TARGET"; triggerAt = row.snapshotAt; }
      }
      if (exitReason) {
        status = "EXIT_PENDING"; if (!exitUsable(row)) exitLiquidityDelayed = true;
        emit("EXIT_TRIGGERED", row.snapshotAt, rowIndex, 0, `${exitReason}: trigger time ${triggerAt}; only a strictly later usable observation can supply a modeled exit.`);
      }
      continue;
    }
    if (status === "EXIT_PENDING") {
      if (!exitUsable(row) || row.snapshotAt <= triggerAt!) { exitLiquidityDelayed = true; emit("EXIT_AWAITING_USABLE_SNAPSHOT", row.snapshotAt, rowIndex); continue; }
      const price = Math.max(0, row.bidCents! - costs.exitSlippagePerShareCents);
      exit = { snapshotAt: row.snapshotAt, rowIndex, pricePerShareCents: price, quantity: plan.quantity,
        premiumCents: positionCents(price), feeCents: costs.exitFeeCents, classification: "ASSUMED_FILL" };
      settledCashCents -= costs.exitFeeCents; unsettledCashCents += exit.premiumCents; reservedCashCents = 0;
      netPnlCents = exit.premiumCents - entry!.premiumCents - costs.entryFeeCents - costs.exitFeeCents;
      status = "CLOSED"; markCents = null;
      emit("EXIT_ASSUMED_FILL", row.snapshotAt, rowIndex, exit.premiumCents, `${exitReason}: later bid minus modeled adverse slippage; proceeds remain unsettled.`);
    }
  }
  if (status === "ENTRY_PENDING" && evaluatedThroughAt !== null && evaluatedThroughAt >= plan.entryDeadlineAt) {
    status = "NO_TRADE"; reservedCashCents = 0; blockers.push("ENTRY_DEADLINE_REACHED_NO_FILL"); emit("ENTRY_CANCELLED", evaluatedThroughAt, null, 0, `The frozen entry deadline was ${plan.entryDeadlineAt}.`);
  }
  if (status === "OPEN" && evaluatedThroughAt !== null && evaluatedThroughAt >= plan.timeExitAt) {
    status = "EXIT_PENDING"; exitReason = "TIME_EXIT"; triggerAt = plan.timeExitAt; exitLiquidityDelayed = true;
    emit("EXIT_TRIGGERED", evaluatedThroughAt, null, 0, `TIME_EXIT: trigger time ${triggerAt}; supplied clock reached the exit time without a later usable fill.`);
  }
  if (status === "OPEN" || status === "EXIT_PENDING") {
    if (!selected.length || !exitUsable(selected.at(-1)!.row)) markCents = null;
    emit("POSITION_UNRESOLVED_AT_DATA_END", evaluatedThroughAt ?? plan.decisionAt, null, 0, "No fabricated liquidation or settlement.");
  }
  return finish();
}
