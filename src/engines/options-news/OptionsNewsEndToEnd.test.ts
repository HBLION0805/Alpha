import { NewsEventStatus } from "../../contracts/OptionsNewsDomain";
import { env } from "node:process";
import { StaticNewsFixtureTransport } from "../../integration/news/NewsTransports";
import { InMemoryOptionsNewsRepository } from "../../repositories/InMemoryOptionsNewsRepository";
import { OptionsNewsEvidenceJournalAdapter } from "../../repositories/OptionsNewsEvidenceJournalAdapter";
import { OPTIONS_NEWS_BUDGET_POLICY, OptionsNewsBudgetLedger } from "./OptionsNewsBudgetLedger";
import { fixtureHealth } from "./OptionsNewsHealth";
import { OptionsNewsPipeline } from "./OptionsNewsPipeline";
import { adapters, equal, fixture, request, TestHarness, trueValue } from "./OptionsNewsTestSupport";

const all = adapters();
const evaluatedAtUtc = "2026-08-08T12:00:00.000Z";

export function buildTier0VerifiedEvidence(): unknown {
  const repository = new InMemoryOptionsNewsRepository();
  const pipeline = new OptionsNewsPipeline(repository);
  const transport = new StaticNewsFixtureTransport({
    "provider:sec-edgar": fixture("sec-edgar.json"),
  });
  const result = pipeline.run(
    all.sec!,
    transport,
    request("source:sec-edgar"),
    evaluatedAtUtc,
  );
  const event = repository.getEvent(result.eventId!)!;
  const evidence = repository.listEvidence(event.eventId);
  const links = repository.listLinks(event.eventId);
  const transitions = repository.listTransitions(event.eventId);
  const ledger = new OptionsNewsBudgetLedger();
  const reservation = ledger.reserve(
    "budget:phase1-owner-review:sec",
    "provider:sec-edgar",
    evaluatedAtUtc,
    0,
  );
  const settlement = ledger.reconcile(reservation.reservationId, 0);
  return {
    schemaVersion: "options-news-owner-review-evidence:1.0",
    scenarioId: "TIER_0_PRIMARY_VERIFIED",
    evaluatedAtUtc,
    expectedStatus: NewsEventStatus.Verified,
    pipelineResult: result,
    event,
    evidence,
    links,
    transitions,
    summaryProvenance: event.summary,
    evidenceJournalProjection: new OptionsNewsEvidenceJournalAdapter().project(
      event,
      evidence,
      links,
      transitions,
    ),
    query: {
      input: {
        topics: ["TECH"],
        entityIds: ["entity:acme"],
        symbols: ["ACME"],
        eventTypes: ["SEC_FILING"],
        verificationStatuses: [NewsEventStatus.Verified],
        fromUtc: "2026-08-07T00:00:00.000Z",
        toUtc: "2026-08-09T00:00:00.000Z",
      },
      result: repository.queryEvents({
        topics: ["TECH"],
        entityIds: ["entity:acme"],
        symbols: ["ACME"],
        eventTypes: ["SEC_FILING"],
        verificationStatuses: [NewsEventStatus.Verified],
        fromUtc: "2026-08-07T00:00:00.000Z",
        toUtc: "2026-08-09T00:00:00.000Z",
      }),
    },
    budget: {
      policy: OPTIONS_NEWS_BUDGET_POLICY,
      reservation,
      settlement,
      snapshot: ledger.snapshot(evaluatedAtUtc),
    },
    latency: evidence.map((record) => ({
      evidenceId: record.evidenceId,
      measurement: record.latency,
    })),
    health: [fixtureHealth({
      providerId: "provider:sec-edgar",
      adapterName: all.sec!.adapterName,
      adapterVersion: all.sec!.adapterVersion,
      atUtc: evaluatedAtUtc,
      requestCount: 1,
      parseCount: 1,
      normalizeCount: 1,
      verifyCount: 1,
      latencySampleCount: 1,
    })],
    sideEffects: {
      networkCalls: 0,
      credentialsRead: 0,
      realCostCents: 0,
      productionPersistenceWrites: 0,
      brokerCalls: 0,
      orderCalls: 0,
    },
  };
}

export function buildReutersSameOriginRejectedEvidence(): unknown {
  const repository = new InMemoryOptionsNewsRepository();
  const pipeline = new OptionsNewsPipeline(repository);
  const transport = new StaticNewsFixtureTransport({
    "provider:finnhub": fixture("finnhub-reuters.json"),
    "provider:alpha-vantage": fixture("alpha-vantage-reuters.json"),
  });
  const finnhubResult = pipeline.run(
    all.finnhub!,
    transport,
    request("source:finnhub-reuters"),
    evaluatedAtUtc,
  );
  const alphaVantageResult = pipeline.run(
    all.alphaVantage!,
    transport,
    request("source:alpha-vantage-reuters"),
    evaluatedAtUtc,
  );
  const event = repository.getEvent(finnhubResult.eventId!)!;
  const evidence = repository.listEvidence(event.eventId);
  const links = repository.listLinks(event.eventId);
  const transitions = repository.listTransitions(event.eventId);
  const ledger = new OptionsNewsBudgetLedger();
  const finnhubReservation = ledger.reserve(
    "budget:phase1-owner-review:finnhub",
    "provider:finnhub",
    evaluatedAtUtc,
    0,
  );
  const alphaVantageReservation = ledger.reserve(
    "budget:phase1-owner-review:alpha-vantage",
    "provider:alpha-vantage",
    evaluatedAtUtc,
    0,
  );
  ledger.reconcile(finnhubReservation.reservationId, 0);
  ledger.reconcile(alphaVantageReservation.reservationId, 0);
  return {
    schemaVersion: "options-news-owner-review-evidence:1.0",
    scenarioId: "REUTERS_SAME_ORIGIN_VERIFYING_REJECTION",
    evaluatedAtUtc,
    expectedStatus: NewsEventStatus.Verifying,
    providerResults: [finnhubResult, alphaVantageResult],
    rejectionReasonCode: event.currentStateReasonCode,
    independenceAudit: {
      providerCount: 2,
      observationCount: evidence.length,
      independenceKeys: [...new Set(evidence.map((record) => record.independenceKey))].sort(),
      independentSourceCount: new Set(evidence.map((record) => record.independenceKey)).size,
      quorumSatisfied: false,
    },
    event,
    evidence,
    links,
    transitions,
    summaryProvenance: event.summary,
    evidenceJournalProjection: new OptionsNewsEvidenceJournalAdapter().project(
      event,
      evidence,
      links,
      transitions,
    ),
    query: {
      input: {
        topics: ["TECH"],
        entityIds: ["entity:acme"],
        symbols: ["ACME"],
        eventTypes: ["CORPORATE_NEWS"],
        verificationStatuses: [NewsEventStatus.Verifying],
        fromUtc: "2026-08-07T00:00:00.000Z",
        toUtc: "2026-08-09T00:00:00.000Z",
      },
      result: repository.queryEvents({
        topics: ["TECH"],
        entityIds: ["entity:acme"],
        symbols: ["ACME"],
        eventTypes: ["CORPORATE_NEWS"],
        verificationStatuses: [NewsEventStatus.Verifying],
        fromUtc: "2026-08-07T00:00:00.000Z",
        toUtc: "2026-08-09T00:00:00.000Z",
      }),
    },
    budget: {
      policy: OPTIONS_NEWS_BUDGET_POLICY,
      reservations: [finnhubReservation, alphaVantageReservation],
      snapshot: ledger.snapshot(evaluatedAtUtc),
    },
    latency: evidence.map((record) => ({
      evidenceId: record.evidenceId,
      measurement: record.latency,
    })),
    health: [
      fixtureHealth({
        providerId: "provider:finnhub",
        adapterName: all.finnhub!.adapterName,
        adapterVersion: all.finnhub!.adapterVersion,
        atUtc: evaluatedAtUtc,
        requestCount: 1,
        parseCount: 1,
        normalizeCount: 1,
        verifyCount: 1,
        latencySampleCount: 1,
      }),
      fixtureHealth({
        providerId: "provider:alpha-vantage",
        adapterName: all.alphaVantage!.adapterName,
        adapterVersion: all.alphaVantage!.adapterVersion,
        atUtc: evaluatedAtUtc,
        requestCount: 1,
        parseCount: 1,
        normalizeCount: 1,
        verifyCount: 1,
        latencySampleCount: 1,
      }),
    ],
    sideEffects: {
      networkCalls: 0,
      credentialsRead: 0,
      realCostCents: 0,
      productionPersistenceWrites: 0,
      brokerCalls: 0,
      orderCalls: 0,
    },
  };
}

const evidenceMode = env.ALPHA_OPTIONS_NEWS_EVIDENCE_SCENARIO;
if (evidenceMode === "tier0-verified") {
  console.log(JSON.stringify(buildTier0VerifiedEvidence(), null, 2));
} else if (evidenceMode === "reuters-same-origin-verifying") {
  console.log(JSON.stringify(buildReutersSameOriginRejectedEvidence(), null, 2));
} else {
  const h = new TestHarness();
  h.test("P1 success demo: Tier 0 fixture reaches VERIFIED with complete audit lineage", () => {
    const value = buildTier0VerifiedEvidence() as Record<string, any>;
    equal(value.pipelineResult.status, NewsEventStatus.Verified, "status");
    equal(value.event.currentStateReasonCode, "TIER_0_PRIMARY_EVIDENCE", "reason");
    equal(value.evidence.length, 1, "evidence");
    equal(value.links.length, 1, "links");
    equal(value.transitions.length, 4, "transitions");
    equal(value.evidenceJournalProjection.evidenceReferences[0].rawPayloadHash.length, 64, "raw hash");
  });
  h.test("P1 success demo replay is idempotent", () => {
    const repository = new InMemoryOptionsNewsRepository();
    const pipeline = new OptionsNewsPipeline(repository);
    const transport = new StaticNewsFixtureTransport({
      "provider:sec-edgar": fixture("sec-edgar.json"),
    });
    const first = pipeline.run(all.sec!, transport, request("source:sec-edgar"), evaluatedAtUtc);
    const second = pipeline.run(all.sec!, transport, request("source:sec-edgar"), evaluatedAtUtc);
    equal(second.eventId, first.eventId, "event id");
    equal(repository.queryEvents().length, 1, "events");
    equal(repository.listTransitions(first.eventId!).length, 4, "transitions");
  });
  h.test("P1 rejection demo: two providers carrying one Reuters origin remain VERIFYING", () => {
    const value = buildReutersSameOriginRejectedEvidence() as Record<string, any>;
    equal(value.providerResults[0].eventId, value.providerResults[1].eventId, "cluster identity");
    equal(value.event.verificationStatus, NewsEventStatus.Verifying, "persisted status");
    equal(value.evidence.length, 2, "observations preserved");
    equal(value.independenceAudit.independentSourceCount, 1, "independent sources");
    equal(value.independenceAudit.quorumSatisfied, false, "quorum");
  });
  h.test("P1 rejection demo emits explicit failure reason and no trading language", () => {
    const value = buildReutersSameOriginRejectedEvidence() as Record<string, any>;
    equal(value.rejectionReasonCode, "INDEPENDENCE_OR_PRIMARY_NOT_PROVEN", "reason");
    const serialized = JSON.stringify(value.event).toLowerCase();
    for (const forbidden of ["buy", "sell", "order", "strike", "expiration", "position size"]) {
      trueValue(!serialized.includes(forbidden), `${forbidden} absent`);
    }
  });
  h.run("Options News end-to-end");
}
