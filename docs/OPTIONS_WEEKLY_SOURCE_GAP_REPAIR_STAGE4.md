# Bounded Cboe PDF and offline IR interpretation — October 11, 2026

This separate repair preserves reviewed-candidate commit 3253c49 and its exact
36-company receipts. It adds one explicit PDF acquisition and one offline PANW
interpretation. It does not change the issuer store, its replay parsers, the
512 KiB generic acquisition limit, finite runner or 4178 preview.

## Seven non-403 IR gaps

| Company | Original evidence | Narrow disposition |
|---|---|---|
| CDNS | No HTTP response or body; `fetch failed` | No offline parser repair possible. Cause remains UNKNOWN; no retry. |
| HPE | HTTP 200 HTML stopped at 524,288 bytes | Local size bound, not provider refusal. Partial HTML contains old events but cannot establish the complete scope; no complete-calendar parse or new request. |
| ASML | Official redirect target returned complete HTML without dated event rows | Missing date-bearing content, not a proven unpublished calendar. No dates synthesized or hidden endpoints accessed. |
| NOW | Official target returned another 301 and zero body | Unresolved redirect, not proof of no events. No further follow. |
| PANW | Complete official HTML has a named FEATURED EVENTS section | Offline parsing yields three published historical event dates. This is a separately versioned interpretation of exact original bytes, not an upcoming-calendar success or verified occurrence. |
| PLTR | Complete response is a dynamic shell | No date-bearing event content in the original. No hidden API or browser bypass. |
| ETN | Investor overview contains historical news and references to financial webcasts | No explicit event-calendar rows to parse. Publication dates cannot be substituted for event dates. |

The other 18 companies remain HTTP 403 and were not requested again. No company
is relabeled as having no events because acquisition or parsing failed. The
original pipeline remains 36 attempted / 11 parsed / 25 failed or unparsed;
PANW's independent supplemental interpretation does not rewrite these receipts.

## Cboe acquisition and visual review

The earlier response declared `Content-Length: 1009510` and
`Content-Type: application/pdf`. Its 524,288-byte truncation was a local limit.
The separate fixed-URL PDF reader allows at most 2 MiB and 12 seconds, rejects
redirects and other MIME types, makes one request without retry or credentials,
checks streamed size independently of headers, and retains original bytes and
clock/hash metadata. PDF signature and EOF are completeness checks, not proof
that dates were parsed or visually verified. It is not called by page reads or
the finite runner. Failed attempts remain recorded in their own directories.

One new request received all 1,009,510 bytes at 2026-10-11T06:38:22.288Z
(02:38:22.288 EDT). The PDF is version 1.6, one unencrypted 792×612-point page,
with no form or JavaScript reported by pdfinfo. The complete page was rendered
using Poppler and inspected against its product legend. Text extraction was
used only for wording; it cannot establish the date/color association.

PDF SHA256: `421a0699055b99ebc2dea6da53666939bc0918882d1f615da5664582a52b3c9e`.
Official URL: https://cdn.cboe.com/resources/options/Cboe2026OPTIONSCalendar.pdf

| Date | Printed calendar meaning | Product scope |
|---|---|---|
| October 12–15 | Weekly expiration markers | SPX and XSP Weeklys only; the legend excludes coinciding third-Friday, month-end and quarterly index expirations |
| October 14 | Weekly expiration marker | VIX Weeklys only |
| October 15 | Last day to trade expiring standard AM-settled options | Equity index options in that settlement category only |
| October 16 | Standard expiration | Equity, equity index, ETF and ETN options standard series |

These are seven category/date rows for the requested October 12–16 week. The
annual calendar was not exhaustively mapped. Dates are subject to change. This
does not verify a listed AAPL/TSM/QQQ contract, settlement clock, exercise cutoff,
exchange-specific contract hours, quote, fee or trading permission. October 15
must not become a last-trading-day rule for equity or ETF options. SPX/XSP/VIX
markers must not become AAPL/TSM/QQQ weekly expirations. The dynamic Cboe schedule
notices remain unparsed. This is Codex page-image review, not Owner approval.

## Independent interpretation and retained originals

PANW original received 2026-10-11T06:12:08.194Z. Its three featured dates are
June 2 and September 1 earnings calls and a September 10 conference. The parser
requires the explicit section, binds titles to printed dates, retains printed
times without UTC conversion, rejects duplicate/ambiguous sections, tampered
or partial originals, and ignores scripts/news dates. All three dates precede
the source receipt. Their occurrence is unverified and they prove nothing about
unlisted future events. No network request was made for PANW.

The prior issuer store verifies saved parser outputs on replay. Changing its
parser in place would invalidate the original PANW failure receipt. Therefore
this repair intentionally writes a new independent interpretation with the
original envelope hash; it preserves that failure and all original denominators.
Neither supplementary output is auto-admitted into the weekly event engine.

Explicit commands:

```text
npm run options:weekly-supplement -- --acquire-cboe-pdf
npm run options:weekly-supplement -- --parse-panw --input data/runtime/options-weekly-sources/company-stage3/panw_ir.json
```

Do not rerun acquisition as a routine wake. Existing acquired evidence is local:

- PDF run: `8b89ea74-b46e-4284-9cbf-15fd3ad40c26`
- PANW offline run: `e93e82c0-5559-47e4-8b6d-50bdfdb283b8`
- Both live under ignored `data/runtime/options-weekly-sources/supplements`.
- PDF run retains receipt, complete PDF, page PNG, extracted text and independent
  `visual-review.json`; the earlier partial original remains unchanged.

## Validation

Final validation results and retained receipt are recorded in
`docs/status/weekly-source-gap-repair-stage4.json`. No app assets or preview
server were changed. Original 3253c49 remains the separately reviewable full
company stage. This repair is a separate commit and does not authorize rollout.

Final verification: 234 components, 5,950 tests passed, zero failed; focused
36/36, including eight new supplement tests and 13 company tests. The first
complete run passed its code tests but failed newly added documentation links;
those relative links and the supplemental summary counter were corrected and
the entire bundle rerun successfully. Earlier failed/cancelled logs remain local.
All prior stage3 acceptance hashes and 82 issuer replays pass. The new complete
PDF matches the old 512 KiB prefix exactly and retains the same ETag.

Acceptance: `data/runtime/options-weekly-sources/gap-repair-stage4/acceptance.json`
SHA256 `3e5310f19d696ccac668ff645f8ed89c63ea7807762b92bb2033511eed5950e4`.
The frozen acceptance checkout is clean at 2dabc114; original technology retains
its 23 pre-existing dirty paths. 4178 remains 9dd4779 and the existing runner PID
23512 retains its original startup identity and prior journal hashes.
