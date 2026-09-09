# Capital policy preflight v1

The saved $100–$500 all-in allocation range cannot coexist with the retained
$25 full-premium stress cap. Quote freshness cannot resolve this configuration
conflict. Add a deterministic read-only preflight beside Daily guidance and
Trade planner; retain all existing guidance, feasibility and journal outputs.

The existing retail engine remains the source of its fixed 0.5% planned-risk
and $25 stress limits. Extract those unchanged values into a shared pure limits
function and verify original outputs. The preflight accepts validated guidance
settings, without changing or saving them. It returns constraints, contradictions
and three capital illustrations (range minimum, midpoint, maximum). Each assumes
one standard contract and per-contract costs; no listed contract is selected.
Without an explicit range use the original 5% ceiling and no minimum declaration.

All-in capital A is premium plus the declared round-trip fee reserve F. Planned
loss is floor((A-F)*stopBps/10000)+F+exitReserve. Preserve null fees/reserves in
exact outputs. Separately labeled necessary lower bounds may use zero for an
unknown nonnegative cost, never claim that cost is zero. If F exceeds A, mark
the row unavailable. Stress equals A for this pre-exercise capital definition.
Shared limits, settled cash and allocation maximum bound possible capital;
the planned-loss bound uses the engine's existing integer-cent floor convention.
Bounds are necessary arithmetic constraints, not proof of a whole-contract,
liquid or executable trade. A nonempty interval is never called trade-ready.

Expose the saved-settings projection through the existing local state reader
and a protected calculation-only POST for settings-form preview. Both frontend
views label saved assumptions; the preview labels unsaved form values and is
cleared when those values change. No cap editor, apply-policy button, source
request, new schedule, ledger write, probability or execution path is added.

Acceptance: current conflict remains provable with unknown costs and zero
quotes; exact cent boundaries, fee allocation, unknowns and invalid input are
covered; old engine outputs and frozen records retain parity. Verify protected
HTTP/no-write behavior, live saved settings, frontend preview invalidation and
browser layout. Document actual evidence; no real-price gate advances.
