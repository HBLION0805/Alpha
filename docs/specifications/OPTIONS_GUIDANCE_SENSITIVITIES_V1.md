# Saved option sensitivities V1

Status: reviewed for implementation, September 12, 2026.

## Problem and scope

F03/F04 guidance currently discards gamma, theta, vega and implied volatility
from saved Robinhood quote receipts. The Owner needs to distinguish a directional
view from the option's exposure to time and volatility. Add a separate read-only
projection and English Daily guidance UI using the latest verified capture.
Keep every selected ID, including missing quotes. No additional market reads.

Canonical normalized captures, guidance inputs/reports/rationale, rankings, paper
plans and fee assumptions retain their exact versions and fingerprints. The new
projection must fail independently when source recovery fails.

## Source and units

Require record fingerprints, canonical capture recomputation and identity/clock
agreement with current guidance. Retain raw scalar strings, capture origin/path,
input fingerprint, source updated_at and receipt time. A quote's update timestamp
is only an envelope clock: independent Greek timestamps are unknown. Freshness
uses the existing 120-second threshold and never establishes executable data.

Robinhood's [options chain metrics](https://robinhood.com/us/en/support/articles/options-chain-metrics/)
and the installed get_option_quotes schema describe delta/gamma per $1 underlying
move, theta per calendar day, vega per one percentage point of IV; API IV is a
decimal (0.30 = 30%). Source reviewed September 12, 2026. Greek values are model
sensitivities, not observed future price changes or probabilities.

Accept bounded plain decimal strings (up to eight fraction digits). Missing or
invalid values remain null with a reason. Preserve valid zero and signed theta.
Delta must lie in [-1, 1], gamma/vega/IV must be nonnegative. No IV rank, historical
percentile, fitted IV surface or calibrated winning probability is available.

## Deterministic illustrations

Only standard 100-share long GLD/IBIT contracts can produce contract-dollar
illustrations. Compute exact decimal changes with integer arithmetic:

`100 * (delta * dS + gamma * dS^2 / 2 + theta * days + vega * IV_points)`.

Use four fixed educational shocks: one calendar day; IV down one percentage
point; favorable $1 underlying move plus one day and IV down one point; adverse
$1 move plus one day and IV up one point. Favorable is +$1 for a call / -$1 for
a put. These are unit comparisons, not assigned likelihoods or ETF price ranges.
Each component and the combined change stays signed; do not clamp negative
results to zero. Missing inputs block only dependent components and their total.
An IV-down shock below zero IV is invalid, not an estimated price.

Use frozen local sensitivities, keep rates constant and disclose omitted higher
order/cross effects. A $1 change differs in relative size by ETF; this expansion
has no validated accuracy range, especially near expiry or large event moves.
For stale/expired or unknown-clock data, label historical illustrations. Never
add the change to a mark/bid/ask to manufacture a future price, executable stop,
P&L or net R. Fees/slippage and realized outcomes are not implied by these changes.

## Acceptance

- Exact unit/sign checks, genuine zeros, missing/invalid fields, IV floor, put
  direction, nonstandard multiplier, stale/future/expired clocks and source gaps.
- Verified local adapter rejects tampering and capture mismatch; original issued
  reports recompute unchanged. No source calls, saved-plan edits or enrollments.
- UI renders all selected IDs with source clocks and missing values, permits
  comparison and contract drilldown, escapes raw text, and works on mobile.
- Actual receipt readback, focused tests, typecheck, aggregate validation and
  original file/schedule preservation checks before commit.
- F03/F04 improve locally; no real-price paper gate or probability acceptance.
