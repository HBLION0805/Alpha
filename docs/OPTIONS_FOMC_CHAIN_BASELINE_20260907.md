# GLD/IBIT option-chain baseline before the September FOMC meeting

Observed September 7 New York, completed September 8 00:20:22 UTC. Source:
authorized Robinhood market tools, 131 market-only reads, 2,100 distinct contracts
and 2,100 matching quotes. **Every option quote-refresh date is September 4.**
September 7 is the Labor Day market holiday; this is a dated baseline, not
September 8 prices or future volume. See the [NYSE calendar](https://www.nyse.com/publicdocs/nyse/ICE_NYSE_2026_Yearly_Trading_Calendar.pdf).
Independent volume-session and OI as-of timestamps are absent from the source.

The complete immutable local report is
`data/runtime/options-chain-survey/fomc-baseline-review-20260907/index.html`.
Its JSON retains every contract; expandable tables show every flagged contract,
its actual bid/ask/mark, sizes, volume, OI, quote clock, filter reasons, possible
explanations and missing evidence. These 224 flags are **descriptive activity
candidates**, not historically significant anomalies. There are 166 candidates
through September 16 and 58 in the September 18 comparison.

## Expiry coverage and the largest reported-volume contract in each expiry

C/P means call/put. Bid/ask are historical per-share option premiums, not strike
prices, fills or recommendations. One standard contract multiplies premium by 100.
The most active example does not replace all other contracts in the full report.

| ETF | Expiry | Listed strike range | Strike levels | Contracts | Flagged | Largest-volume example | Reported volume / OI | Bid / ask |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | --- |
| GLD | Sep 08 | $275–500 | 97 | 194 | 34 | $402 P | 2,762 / 1,102 | $0.96 / 1.09 |
| GLD | Sep 09 | $275–500 | 97 | 194 | 17 | $405 C | 934 / 211 | $4.20 / 4.45 |
| GLD | Sep 10 | $275–500 | 97 | 194 | 6 | $420 C | 218 / 356 | $0.68 / 0.78 |
| GLD | Sep 11 | $205–700 | 171 | 342 | 33 | $420 C | 5,802 / 3,214 | $1.20 / 1.31 |
| GLD | Sep 14 | $350–495 | 30 | 60 | 3 | $410 C | 1,045 / 465 | $4.20 / 4.45 |
| GLD | Sep 15 | $392–421 | 30 | 60 | 1 | $407 P | 108 / 1 | $5.95 / 6.40 |
| GLD | Sep 16 | $386–415 | 30 | 60 | 1 | $411 C | 1,551 / 17 | $4.95 / 5.20 |
| GLD | Sep 18* | $200–900 | 251 | 502 | 37 | $410 C | 12,262 / 39,949 | $6.30 / 6.55 |
| IBIT | Sep 09 | $21–64 | 59 | 118 | 23 | $46 C | 8,901 / 3,520 | $0.37 / 0.39 |
| IBIT | Sep 11 | $20–65 | 55 | 110 | 23 | $46 C | 23,885 / 11,420 | $0.56 / 0.58 |
| IBIT | Sep 14 | $30–59 | 45 | 90 | 16 | $47 C | 2,664 / 1,758 | $0.40 / 0.43 |
| IBIT | Sep 16 | $30–59 | 30 | 60 | 9 | $47 C | 2,337 / 561 | $0.55 / 0.58 |
| IBIT | Sep 18* | $5–105 | 58 | 116 | 21 | $48 C | 12,440 / 39,509 | $0.45 / 0.47 |

* September 18 is a later-expiry comparison. No September 8, 10 or 15 IBIT expiry
was returned; none was invented. The current chain inventory can change later.

## Why $500, $700, $421, $415 and $900 differ

These five GLD maxima exactly match returned **strike_price** values. They describe
the available exercise-price menu, not an option-premium ceiling, ETF target,
probability distribution or forecast. Contracts can exist far beyond the price
range a trader expects. The number of listed strikes is also distinct from the
number that currently have a usable two-sided market.

Nasdaq's August notice introduced Tuesday/Thursday GLD and Monday/Wednesday IBIT
short-term expirations. The programs have different expiry calendars and listing
mechanics; new short-term dates do not have to start with the same strike range
as an established Friday expiry. [Nasdaq OTA2026-32](https://www.nasdaqtrader.com/MicroNews.aspx?id=OTA2026-32).

Exchange rules describe initial short-term series and subsequent additions,
including a 30-series initial limit with exceptions. This offers a plausible
explanation for the exactly 30 observed GLD strike levels on September 14–16.
The September 18 date is the third Friday, consistent with standard monthly
listing and a broader accumulated range. **These are inferences from listing
mechanics, not verified individual contract listing histories.**
[Cboe approved short-term listing filing, pages 9–10](https://cdn.cboe.com/resources/regulation/rule_filings/approved/2026/SR-CboeEDGX-2026-003.pdf).

In particular, September 15's $392–421 and September 16's $386–415 are shifted
30-strike grids. A different price/reference at initial listing and later strike
additions are possible explanations. The interface supplies neither the listing
timestamp nor the exchange's decision record, so the exact shift cannot be
attributed to a bearish FOMC forecast. September 11's 171 levels and September
18's 251 levels support different contract coverage, not different certainty
about how high gold will trade.

## How to interpret the concentrated activity

The fixed review filter marks volume >=1,000, or volume >=100 and >=3 times
positive reported OI, or volume >=100 and >=5 times the positive-volume median
of at least five complete same-ETF/expiry/side/quote-date peers. These thresholds
were declared after receiving the baseline and have no calibration evidence.

- GLD September 8 $402 P and September 9 $405 C concentrate activity in near-term
  expirations. Directional positioning, protection, closing and spreads are all
  possible. These contracts expire before the September 16 decision date, so
  they cannot remain open for that day's outcome. September 10 $420 C has only
  218 reported contracts; its flag comes from peer concentration, illustrating
  why a relative flag is not proof of institution-sized activity.
- GLD September 11 $420 C and $425 C report 5,802 and 5,132 contracts. Nearby
  call strikes could be independent orders or related spread/roll legs; neither
  interpretation can be established without linked prints. Friday liquidity and
  pre-meeting positioning are hypotheses, not identified causes.
- GLD September 15 $407 P has volume 108 against OI 1; September 16 $411 C has
  volume 1,551 against OI 17. Their large ratios partly reflect very small OI
  denominators. They do not demonstrate 108x or 91x new bearish/bullish capital.
  The September 16 contract includes the meeting-end date, which makes event
  exposure relevant, while the September 15 contract expires beforehand.
- IBIT September 11 shows $46 C volume 23,885, $47 C volume 23,533 and $44.5 P
  volume 18,425. Both-side activity fits several mutually different explanations:
  directional orders, hedges, volatility trades or spreads. It is not a clean
  bullish vote simply because calls are active. September 14 $47 C and September
  16 $47 C provide useful follow-up identifiers for the daily comparisons, but
  a repeated strike across dates does not establish a roll.
- September 18 GLD $410 C (volume 12,262, OI 39,949) and IBIT $48 C (12,440,
  OI 39,509) have substantial existing reported position pools. Hedging, turnover
  and closing in established series are possible; volume does not show which
  participant initiated the trade. This later expiry also contains time after
  the meeting, so it should be compared separately from pre-meeting expirations.

The Fed calendar identifies a September **15–16** meeting with economic
projections. That supplies event context, not proof that a particular option's
volume was caused by the meeting. [Federal Reserve calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm).
The September 4 employment report was published at 08:30 Eastern, making macro
repricing another hypothesis for that observed session. No causal inference is
made without timestamped option prints and corresponding price/IV changes.
[BLS September 4 release](https://www.bls.gov/news.release/archives/empsit_09042026.htm).

Volume counts traded contracts; OI counts outstanding positions. Trades can open,
close or transfer positions. Next-session OI helps constrain possibilities but
does not prove buyer initiation, participant identity or a specific cause.
[Options Industry Council](https://www.optionseducation.org/news/open-interest-why-it-matters).
The current historical-bars tool has no historical volume field. A true unusual
volume assessment still needs a comparable history and independently dated OI;
intraday flow attribution additionally needs prints and multi-leg linkage.

## Next prospective evidence

The Owner authorized [daily close records](OPTIONS_CHAIN_CLOSE_RUNBOOK.md) through
September 16. Each retains all returned contracts, new/absent identifiers, source
clock changes and reported-counter differences. Unchanged clocks are not a new
day of trading. No daily close has run yet, and a daily series cannot validate
intraday stop fills, strategy win rate, account enforcement or an execution adapter.
