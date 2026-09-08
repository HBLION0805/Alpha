import { chainSurveyFixture } from "./RobinhoodChainSurveyFixtures";

export function activityStudyFixture(session: string | null = null): any {
  const f: any = chainSurveyFixture(), date = session ?? "2026-09-07", quoteDate = session ?? "2026-09-04";
  const clock = date + " 20:21:00 UTC";
  f.capturedAt = clock; f.scope.expirationStart = session ?? "2026-09-08";
  for (const c of f.chains) { c.requestedAt = c.receivedAt = clock; c.response.data.chains[0].expiration_dates = ["2026-09-18"]; }
  for (const g of f.instruments) {
    g.expirations = ["2026-09-18"];
    for (const p of g.pages) {
      p.request.expiration_dates = "2026-09-18"; p.requestedAt = p.receivedAt = clock;
      for (const i of p.response.data.instruments) i.expiration_date = "2026-09-18";
    }
  }
  for (const g of f.quotes) for (const b of g.batches) {
    b.requestedAt = b.receivedAt = clock;
    for (const [k, r] of b.response.data.results.entries()) {
      r.quote.updated_at = quoteDate + "T20:14:59.123456789Z";
      r.quote.bid_price = session === "2026-09-09" ? ["0.10", "0.10", "0.10", "0.11", "0.20", "0.08"][k] : "0.10";
      r.quote.ask_price = session === "2026-09-09" ? ["0.12", "0.12", "0.12", "0.13", "0.22", "0.10"][k] : "0.12";
      r.quote.mark_price = r.quote.bid_price;
    }
  }
  f.equities = { request: { symbols: ["GLD", "IBIT"] }, requestedAt: clock, receivedAt: clock,
    response: { data: { results: ["GLD", "IBIT"].map(symbol => ({ quote: null, close: { symbol, date: quoteDate, price: "390.00", interpolated: false, source: "SYNTHETIC_FIXTURE" } })) } } };
  return f;
}
