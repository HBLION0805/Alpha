/** Wire boilerplate with no event content — kept in storage, excluded from digest/alerts. */
const BOILERPLATE = [
  /invested in .* years ago/i,
  /would have made owning .* stock/i,
  /stocks? (moving|whale activity) in (today|wednesday|monday|tuesday|thursday|friday)/i,
  /\bwhale activity\b/i,
  /^\d+ .* stocks moving in/i,
  /full broadcast \(/i,
  /^(what's going on with|why is) .* stock/i,
  /\bshares halted on circuit breaker\b/i,
];
/** Templated one-company items (analyst actions, dividends, EPS lines): never cluster with each other. */
const TEMPLATED = [
  /\b(maintains|reiterates|upgrades|downgrades|initiates coverage on|reinstates)\b.*\b(price target|rating|to (buy|sell|hold|neutral|outperform))/i,
  /\braises (quarterly )?(cash )?dividend\b/i,
  /\bQ[1-4] (adj\.? )?eps\b/i,
];

export const isBoilerplate = (title: string): boolean => BOILERPLATE.some((r) => r.test(title));
export const isTemplated = (title: string): boolean => TEMPLATED.some((r) => r.test(title));
