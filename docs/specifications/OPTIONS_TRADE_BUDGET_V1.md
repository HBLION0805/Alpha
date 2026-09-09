# Owner trade budget v1

September 8, 2026. The Owner changed each trade's allocation to $100–$500 while
retaining $1,000 total capital. This replaces the active guidance allocation
range only. It does not authorize higher planned-loss or full-premium stress
limits, paid data, account access, orders or changes to frozen research.

Add an explicit versioned `tradeBudget` declaration to new planning settings.
Its minimum and maximum are integer cents and apply to whole-position premium
plus the declared round-trip fee reserve, matching existing capital accounting.
The lower bound is a selection constraint; it never causes quantity to increase.
Unknown fees remain unknown. A known premium over the maximum fails regardless
of unknown fees; a premium below the minimum with unknown fees is inconclusive.

An independent adapter composes the unchanged retail v2 calculation, replacing
only its allocation comparison. All loss, spread, cash, target, probability and
source checks remain. Legacy inputs without the declaration retain byte-equivalent
outputs and original fingerprints. New budget reports identify their version.
Frozen event plans and snapshots retain their own original settings.

Daily guidance, Candidate checks, Overview and Trade planner must display and use
the same active declaration. Budget fields are editable local scenarios; blank
pairs preserve the legacy policy. Partial, inverted, fractional-cent, nonnumeric
or unsupported declarations fail validation. New settings save exclusively with
their actual recording time. Old settings, guidance, snapshots and research plans
are not rewritten. No source schedule or market capture selection changes.

Acceptance: exact boundaries, fees crossing bounds, unknown fees, multiple whole
contracts, unchanged independent risk, cash shortfall, invalid declarations,
legacy output parity and old artifact recovery. Verify HTTP save/read/recovery,
frontend filters, planner transfer, fresh/restart rendering and actual activation.
Record the resulting sample counts without interpreting them as trade permission.
