# Saved SEC attachment and fiscal-period matching — October 10, 2026

The existing research CLI now locates attachment candidates through actual links in saved SEC primary documents and makes issuer/period mismatches inspectable. It uses the existing source loader, receipt context and original-body extractor. This is an explicit, offline read operation with no new scanner, source request, scoring, schedule or review write.

```powershell
npm run options:tech-candidate -- --match-sec --source-root <saved-scan-directory> --request <request.json>
```

The request has exactly `version: TECH36_SEC_MATCH_REQUEST_V1`, `symbol`, `eventId`, `accession` and `savedReceipts`. The event/company must exist in the saved scan; its title is an unverified query, not body evidence. The accession must occur in that company's saved SEC submissions metadata. The matcher locates an already saved receipt matching the actual primary-document name and SEC archive identity. It never constructs or fetches a missing primary URL.

`savedReceipts` can be empty when materials are already in the scan. Otherwise it contains at most six local envelopes, each with exactly `rawPath`, `sha256`, `url`, `startedAt`, `receivedAt`, nullable `publishedAt`, `status` (`SUCCESS`, `FAILED`, `BLOCKED`) and integer `httpStatus`. Paths are confined to the request directory; the existing reader rejects symlinks/hardlinks, and each added body is limited to 2 MiB. Byte hashes and clocks are checked before matching. HTTP failures, including saved 403s, never become body evidence or trigger retries.

Only saved visible, quoted anchors to HTML files in the same SEC issuer/accession archive are attachment candidates. Relative links are resolved against the actual primary receipt URL; no attachment filename is guessed. Hidden/script/comment links and outside-scope URLs are not followed. Repeated links and identical body receipts retain their positions/clocks without multiplying a candidate; changed bodies remain distinct candidates. Output is bounded to 200 anchors per primary body and 20 candidate versions, with a limit reason preventing a unique match. No redirect or network operation is performed.

## Match semantics and trace

`MATCH` means one saved candidate aligns with explicit query constraints and supported body patterns. It is not headline verification, issuer authentication, a directional plan, a probability or trading permission. Multiple candidates remain available without choosing one. Any detected issuer or result-period conflict blocks a unique match. Missing receipts/bodies produce `MISSING`; unsupported formats, incomplete labels and ambiguity retain `UNKNOWN`.

The finite English parser recognizes quarter labels in results headings/announcement prose, explicit four-digit fiscal years, explicit quarter-ended dates and dated announcement prose. It does not take period labels or numbers from tables, infer fiscal year from calendar year, map announcement quarter to result quarter, or treat a guidance target as the reported-results period. Unsupported two-digit fiscal-year-only queries remain unknown. Multiple period labels and annual/multi-period releases cannot silently select a convenient period. The matcher reports claims and original UTF-8 character coordinates/block indices rather than numerical operating facts.

Issuer checks retain saved CIK/registrant fields and require an issuer/ticker announcement context in the attachment; detached customer mentions are insufficient. An archive path, name, hash or ticker is not machine authentication. Explicit conflicting query tickers, main registrant identifiers, attachment tickers, fiscal periods and period ends prevent unique matching. This bounded parser does not interpret every possible issuer statement or free-text relationship.

Each result carries the scan/policy and request hashes, implementation hashes, source envelopes, actual main-link coordinates and cited body blocks. Disclosure dates retain date-only precision and do not establish first dissemination. SEC acceptance, metadata report date, discovery publication/receipt and body retrieval clocks remain separate. A saved acceptance time later than its metadata receipt is rejected.

Guidance revision remains unknown without an explicitly reviewed comparable previous/current pair for the same target period, metric, basis, currency, unit and scope. No operating-number or guidance-delta extraction is added. Consensus surprise remains unknown without independent comparable evidence captured before announcement.

The result exposes body citation references usable by the unchanged [explicit event-review append contract](specifications/OPTIONS_TECH_EVENT_REVIEW_V1.md). It does not construct verification flags or append a review. The separate synthetic handoff test shows that even a `MATCH` leaves pending coverage unchanged until an explicit review is submitted, and an incomplete explicit review still remains pending.

## Limited saved-original replay

The replay uses only three previously acquired primary/exhibit pairs, not a fresh or representative full-pool test:

| Saved event query | What becomes inspectable | Result |
| --- | --- | --- |
| ANET raised-guidance headline | Three primary-file anchors resolve to one exhibit. The body labels second-quarter 2026 results, period ended June 30, and August 4 disclosure; it does not explicitly establish a fiscal-year label. Results period cannot substitute for guidance target or a comparable pair. | UNKNOWN |
| CRM Q3 profit headline | Five primary-file anchors resolve to one exhibit explicitly describing Q2 FY2027 ended July 31, 2026, disclosed August 26. The title's Q3 conflicts with that result period. | CONFLICT |
| VRT revenue-miss headline | Three primary-file anchors resolve to one exhibit for second-quarter 2026 results ended June 30, disclosed July 29. The query lacks a fiscal period, and no pre-announcement consensus was supplied. | UNKNOWN |

These outcomes expose wrong-period substitution, results-versus-guidance confusion and an unsupported surprise claim. They establish no new company fact or opportunity. The real nine-review chain, its 3 qualified and 2,931 unresolved associations, and all earlier outputs remain unchanged. Synthetic boundary tests are independent of these three originals. Final exact-combination, privacy and preservation checks are recorded in the separate status file; original payloads and receipts remain ignored and local.
