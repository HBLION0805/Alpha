# Research observation design delivery

September 7, 2026. Design-only bounded continuation unit.

The [reviewed specification](specifications/OPTIONS_RESEARCH_OBSERVATION_V1.md)
defines the next consumer of saved protocol and context pairs. It requires actual
dependency verification before a new observation clock and retains original
context freshness clocks. A receipt preparation time is not its completed-write
time. NO_TRADE text remains an observation, not a completed paper outcome.

Changes are this delivery, the specification, its machine checkpoint, and current
handoff/roadmap pointers. No runtime implementation, source journal, scheduler,
protocol, observation, outcome or trade was created. This resolves the schema and
recovery approach before implementing the next subsystem.

The reviewed dependency implementations are scripts/options-context-capture.mjs
and scripts/options-research-protocol.mjs. Their independent recovery commands
will be reused unchanged. Reference-based recovery requires retaining all three
pairs; existing export versions do not yet contain these new stores. There is no
claim of cross-store atomicity or externally attested historical knowledge.

Validation for this documentation unit is recorded in
[the checkpoint](status/research-observation-design.json). Prior full validation
remains the dated 3,459-test result at commit 53a0ba0, not a new run for this unit.
No implementation tests can establish the unimplemented observation workflow.

Next unit: exact declaration validation and read-only resolution through both
existing verifiers, followed by exclusive recording and isolated recovery. Use
synthetic isolated inputs until a formal protocol is supplied; do not invent one
from the storage fixture. Qualified real-price paper execution still depends on
the frozen opening collection and subsequent source/contract/cost qualification.
