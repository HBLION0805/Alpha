# Robinhood public source-use review

September 7, 2026. This bounded primary-source review supports workstream 08;
it does not qualify the paper adapter or establish the Owner's accepted terms.
Actual recording time and source locations are in the [checkpoint](status/robinhood-source-use.json).

## Retrieved evidence

The [Customer Agreement](https://cdn.robinhood.com/assets/robinhood/legal/Robinhood-Customer-Agreement.pdf)
is revised September 1, 2026. Section 29 distinguishes API licensees/products
from customers; 29.1 requires written consent for API Package use/development.
Sections 29.4 and 29.7 describe possible data discrepancies, personal use and
revocable connectivity, including excessive market-data usage. Market Data
Addendum section 2 (PDF page 37) limits use to personal, non-business purposes
related to the platform/account and restricts redistribution. These provisions
do not by themselves establish an Alpha-specific retention duration or research
license. API-product development and use of the already authorized official
connection must not be silently treated as the same role.

The [US Options Agreement](https://cdn.robinhood.com/assets/robinhood/legal/Options%20Agreement.pdf)
retrieved here has footer identifier `20260831-5886123-18772062`; its explicit
revision date was not established. Paragraphs 20, 22, 23 and 31(b), PDF pages
5-7, address OPRA data, personal investment use, redistribution restrictions and
absence of timing/sequence/accuracy guarantees. They do not establish a
field-level event-clock guarantee for the MCP option quote. The
[Disclosure Library](https://robinhood.com/us/en/about/legal/) lists the options
agreement at August 31, 2026, 06:12 PM; that listing time is not the Owner's
acceptance time. An older search snippet for the same PDF differed from the
opened document; this review uses the opened document.

## Engineering assessment

Personal investment use is relevant evidence, not blanket permission for every
retention, replay, sharing or external processing workflow. Exact applicability
to stored MCP quote snapshots and personal offline research remains unresolved.
No legal clearance, prohibition on the existing bounded pilot, or new consent is
inferred. No raw market-data export is added to Git by this documentation unit.

The [earlier loaded schema review](OPTIONS_ROBINHOOD_SCHEMA_SEMANTICS.md) remains
the field-level evidence: option `updated_at` is a shared refresh clock; separate
option-side/size event clocks remain unknown. Public general timing disclaimers
neither replace that schema nor supply missing clocks. A direct open of the
public tool-catalog support page failed twice in the browsing tool; this is a
documentation retrieval failure, not a Robinhood MCP or headline-feed failure.

Next prepare a bounded source-profile/fill-model specification that preserves
these unknowns and explicitly distinguishes hypothetical displayed-quote fills
from actual execution. It must not grant qualification via a declaration. Check
actual opening evidence when available; retention/research-use applicability,
contract/session evidence, costs/account assumptions and actual-data acceptance
remain separate requirements. No repeated searches alone can resolve absent
field semantics. No support request or agreement acceptance was sent.

## Delivery

Changed files: this review, its new checkpoint, handoff, roadmap and the maintained
development-progress view. No executable code changed. The local Node verification
parsed both changed JSON files, checked 137 local links, matched 524 protected
files and all seven prior qualification source hashes; it preserved the 10/6
baselines. `git diff --check` passed. Prior full
validation remains 3,510 tests / 144 components at a066ccd; it is not rerun or
counted as new testing here. Git emitted only the existing LF/CRLF conversion
warnings. The public tool-catalog retrieval issue above remains unresolved.

Assumptions and risks: URLs are mutable, retrieved text is not a retained signed
agreement, public documents do not establish the Owner's account entitlements,
and a working connection is not proof of unrestricted data use. No market call,
journal append, scheduler mutation, paid step, order or account lookup occurred.
The 10-workstream totals remain 4 local / 3 partial / 3 unvalidated; first-paper
flow retains 3 local components and 3 open gates. Authorized commit/push follows
the focused checks; the resulting Git ref is available in repository history.
