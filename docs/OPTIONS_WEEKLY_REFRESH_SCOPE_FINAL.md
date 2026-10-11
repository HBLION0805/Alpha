# Refresh scope and final local source limits — October 11, 2026

Connecting evidence to the read-only weekly page does not make that evidence
automatically refresh. The page only re-reads saved local records. This report
distinguishes the unchanged finite process from explicit one-time acquisition.
The original CPI/15:50 and other pre-existing Alpha schedules are outside this
process and were not modified.

## The ten sources in the finite process

| ID | Actual scope |
|---|---|
| fed | Federal Reserve press-release RSS |
| bls | BLS latest-news RSS; **not** the BLS release calendar |
| bea | BEA RSS |
| ecb | ECB press RSS |
| ofac | OFAC RSS |
| sec | SEC agency press-release RSS; **not** issuer EDGAR submissions |
| fed_speeches | Federal Reserve speeches/testimony RSS |
| eia_energy | EIA Today in Energy RSS |
| treasury_auctions | TreasuryDirect published upcoming-auctions JSON |
| fed_events | Federal Reserve Board receipt-month calendar's Speeches section |

Run `f1aa4896-0b42-4ecc-9b89-786e86955dbc` remains PID 23512, loaded implementation
8c3e089, six-hour source intervals, maximum 20 requests, with deadline
2026-10-11T17:46:05.993Z (13:46:05.993 EDT). Its budget can end the run sooner.
This is finite local execution, not an indefinitely recurring automation, OS
service or cloud task. It has not been restarted or given new source IDs.

Equipped readback at 07:11:21 UTC confirmed the original process startup identity.
The journal still contained STARTED and WAITING, zero actual requests from this
run. First headline-source eligibility is 09:38:44.499 UTC; event sources are
eligible later, around 11:27 UTC. Thus configuration/startup is verified, while
first scheduled acquisition and terminal acceptance remain pending. Do not call
this a successfully completed automatic refresh or infer current market data.

## One-time or static evidence, not in that process

- All 36 company IR attempts, their explicit official-page follow-ups and the
  later HPE/NOW/ETN/ASML/PLTR batch were one-time bounded requests.
- All 36 issuer SEC submissions reads were one-time. The copied SEC identity
  registry was not re-fetched. Referenced historical pages and filing/exhibit
  bodies were not collected.
- Cboe options holidays, the partial PDF, the later complete PDF and the dynamic
  notices-page attempt were explicit one-time acquisitions. The seven PDF
  product/date rows are a fixed-hash page-image interpretation, not a live feed.
- PANW/HPE/ETN history and the ASML announcement are source-bound saved
  interpretations. The page displays them but does not fetch replacements.
- BLS/FOMC saved calendars are not selected in this ten-source runner. Their
  existing separate authorities remain unchanged; RSS `bls`/`fed` is not a
  substitute for those calendars.

## HPE: complete size remains unknown

The saved official news/events response has no `Content-Length`. It declares
`Content-Encoding: gzip` and `Transfer-Encoding: chunked`. The retained response
body is 2,097,152 **decoded** bytes, exactly the dedicated 2 MiB cap. The full
decoded or compressed size cannot be derived from this partial body. Truncation
occurs within historical financial tables; it is not an HTTP refusal.

A source-specific bounded reader is technically possible and was already used.
The original homepage completed at 862,611 decoded bytes and its usable history
is now on the page. The distinct news/events archive did not fit 2 MiB. The
available original does not establish a reasonably sufficient final size cap;
this pass makes no new request and does not escalate limits in steps. The
remaining complete-archive acquisition is a local gap, not a provider failure,
missing user approval or a claim that the company has no upcoming events.
The generic issuer limit remains 524,288 bytes.

## PLTR: complete shell, no event JSON in the obtained original

The `/events` response declares `Content-Length: 1779` with gzip encoding.
The complete decoded HTML is 6,701 bytes, below its 524,288-byte cap. Its main
content is an empty `<main id="root" class="root"></main>` and a same-origin
`/bundle.js` client script reference. The obtained original contains zero JSON
script blocks and no explicit `.json` event-data links. Increasing the HTML
byte limit cannot reveal content that is absent from this complete body.

Rendering that page's content requires its client code. Whether separately
obtained official client resources would expose recoverable static event data
has not been established; this task does not invent a hidden endpoint or claim
that a browser is mathematically the only possible route. A bounded dynamic
browser acquisition adapter is not integrated. That is a future local
implementation gap, not a requirement that the Owner solve it now. No client
bundle, guessed API, third-party page, login or challenge was fetched in this
final inspection.

Inspection evidence is ignored/local at
`data/runtime/options-weekly-sources/remaining-source-limits-20261011.json`.
No new source calls, source-cap changes or parser changes were made for this
final technical judgment. The 18 original denied companies and NOW's newly
denied official target remain separate external 403 evidence; no denied URL
was retried. CDNS has no response and remains cause UNKNOWN.

## Preview rollout

Independent review cleared the unclosed-comment fix 9d75ade and exact full
workbench commit ae8a88c87f727c4831e8ee8a75caa1d1af50dcae. That version passed
5,962 tests and is now running at http://127.0.0.1:4178/#weekly-plan (full
workbench entry http://127.0.0.1:4178/#guidance). PID 37080 started at
2026-10-11T07:15:56.762Z (03:15:56.762 EDT). Only the identity-verified previous
4178 process, PID 4980, was replaced. The finite runner remains PID 23512.

The preview uses a separate exact Git archive with 1,486 hash-pinned files,
so subsequent workspace or documentation edits do not change its code. A
separate 1,458-file archive of previous preview commit
9dd4779372e772a1e432d68c2f91293885f33c37 and a read-only rollback wrapper are
retained locally. No rollback was needed.

Desktop/mobile verification passed first on temporary 4180 and then on actual
4178. Both showed 23 weekly source events and nine separate historical rows,
with zero browser errors and all 25,907 protected files unchanged. The original
IR counters remain 11 parseable scopes out of 36; the ASML supplement and
historical interpretations do not silently rewrite those original counters.
Temporary PID 23948/4180 is stopped. Node filesystem writes, child processes,
workers, native addons and outbound requests are denied; page source calls are
zero. The frozen experiment remains clean at 2dabc114, and no Paper or trading
acceptance is inferred from this preview verification.

Final switch acceptance, recorded at 2026-10-11T07:18:10.457Z, is PASS:
`data/runtime/options-workbench-development/readonly-preview-reviewed-ae8a88c-20261011/switch-acceptance.json`.
SHA-256: `3785601850b47ec90416d956737883da831d6b7fd68a98d6daa94fb8f74cc205`.
It retains hashes of both archived-code pins, wrappers, process identities,
health responses and temporary/actual-port verification receipts. Real runtime
originals and receipts remain ignored and local. See the sanitized
[final status](status/weekly-preview-reviewed-final.json).
