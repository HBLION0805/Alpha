# Options cost desk v1

## Problem and scope

The planner accepts unknown costs but does not show how execution costs change
net R targets. Add a read-only comparison below Trade planner for standard long
GLD/IBIT contracts. Keep the original planner result, saved settings, historical
fee profile, frozen studies and journals unchanged. No source/account/order calls
or schedule changes. UI remains English.

## Calculation contract

Accept a validated planning scenario and one explicit fee basis: original
declared fees (default, including null), or an assumed nonprofessional purchase
and sale with one execution on each side, using a dated reviewed rate snapshot.
This snapshot is a hypothetical schedule calculation, not a historical or future
trade-date applicability claim, verified account classification or billed fee.

Return the original result unchanged plus four independent comparisons with
0, 1, 2 and 5 declared quote ticks of adverse exit allowance. Each replaces the
original allowance; it does not add another spread or entry charge. Quantity is
explicit, 1–100, with standard multiplier 100. Show the original allowance beside
the comparisons. Zero is an assumption, never a measured likelihood.

The reviewed schedule uses integer/rational arithmetic. Calculate entry fees
on ask premium and exit fees on the indicative target. Iterate the combined
fee reserve and original net-R target to a stable conservative reserve, bounded
to 32 iterations. Reserve the greater fee at entry-sized sale or target; under
these rates this also covers the lower planned-stop proceeds. No fee is counted
twice. Surface components, basis, iteration count and source review clock. Null
declared fees remain null. Reject malformed/overflow/bounded-input violations.

Every comparison uses the unchanged planning adapter, preserving allocation,
cash, planned-loss, stress, friction and target-cap blockers. Show exact cents,
indicative exit, cost allowance, risk headroom and original blocker messages.
Stops remain continuous premium-decline scenarios, not tick-rounded executable
triggers. No winning probability, fill or execution permission is produced.

## Integration and acceptance

A protected local POST calculates only; it writes no file. The frontend shows
the original result plus comparison table and expandable exact evidence. Editing
the planner invalidates both results; an in-flight response cannot replace a
changed draft. The fee choice persists only in the tab, resets to declared fees,
and never changes guidance settings or fills. No action copies assumed fees to
the owner ledger. Existing declared-plan flow remains independent.

Tests cover rounding boundaries, fee/target convergence, no duplicate costs,
quantity scaling, nulls, input rejection, legacy parity, independent blockers,
protected HTTP/no writes, stale UI response handling and rendering. Inspect the
actual local desktop/mobile interface, run the validation bundle, and document
an immutable development-only example based on saved quotes with their clocks.
Real-price gate statuses do not advance on cost assumptions.
