# Company and options source batch 1 — October 11, 2026

This staged delivery adds an explicit bounded issuer-source CLI and a separate
immutable `issuer-refreshes` store. It does not enroll additional sources in the
already running finite process. The fixed research universe remains 36 companies.
Current-source facts and per-company coverage share the existing frozen request
snapshot; saved weekly plans and original research are unchanged.

## Actual acquisition and parsing

Seven selected URL requests ran once each at 05:52:28.150–05:52:55.982 UTC
(01:52:28.150–01:52:55.982 EDT). No source was retried. The initial Cboe redirect
was saved; its fixed official target was then selected explicitly, not followed
automatically. Apple earnings-call is a separate known official page, not a
retry or access-control bypass. All original envelopes remain ignored/local at
`data/runtime/options-weekly-sources/issuer-stage2`. Seven copied-envelope imports
preserve exact bytes, original clocks, HTTP status, selected headers, full original
envelope, hashes and parse outcomes; import makes zero HTTP calls.

| Company/source | Actual response | Parsing and target October 12–16 |
|---|---|---|
| AAPL IR | 403 | Failed; no event claim |
| AAPL earnings-call | 200 | Dynamic date placeholder; unparsed, never no-event success |
| TSM financial calendar | 403 | Failed; no event claim |
| MSFT IR | 200 | One explicit next-release date, October 28; no target-week match within that single-statement scope |
| TSLA IR | 403 | Failed; no event claim |
| Cboe `/en/` URL | 302 | Failed response retained; no automatic redirect |
| Cboe named official target | 200 | Twelve 2026 options-holiday rows; zero target-week matches |

Company denominator: attempted 4/36, latest parseable 1/36, with target-week event
0/36, checked named source with no target-week match 1/36, failed 3/36, unattempted
32/36. Counts are separate dimensions; registered sources are not coverage.
Unattempted: GOOGL, AMZN, META, NVDA, AVGO, AMD, ASML, AMAT, LRCX, KLAC, MU, ARM,
QCOM, ORCL, CRM, NOW, PANW, CRWD, ADBE, PLTR, SNOW, SNPS, CDNS, ANET, CSCO, VRT,
DELL, HPE, STX, WDC, APH, ETN. Issuer SEC filing acquisition remains 0/36; existing
agency SEC press releases and historical attributed research cannot fill it.

Only observed MSFT and Cboe layouts have validated semantic parsers. Other selected
URLs have bounded acquisition adapters but intentionally reject unverified 200
layouts. Search snippets were discovery context only, never substituted for raw
acquisition. Publication clocks remain UNKNOWN. MSFT fiscal period, release time
and call time remain UNKNOWN. A next-release statement is not a full calendar.
Cboe regular and global hours remain separate printed fields. This adapter covers
one named-year holiday table, not expirations, settlement, product eligibility or
all exchange announcements. Both target-week endpoints must lie in its year;
cross-year coverage is partial. No trading schedule or execution gate changes.

## Bounded use and retention

`npm run options:weekly-issuers -- --view` reads only. An explicit `--refresh
--sources msft_ir,cboe_canonical` uses one serial GET per allowlisted source, at
least one hour between source attempts, at most ten IDs, 512 KiB/12 seconds per
response, no cookies/credentials/redirects/retries. Source failures, incomplete
claims and partial parsing remain visible. New failure health cannot borrow the
prior successful response identity. Exact retransmissions retain receipt links;
changed dates append rather than rewrite originals.

There is no new runner, cloud/system schedule or automatic company-universe pass.
The existing run `f1aa4896-0b42-4ecc-9b89-786e86955dbc` retains the loaded `8c3e089`
implementation, sources `fed,bls,bea,ecb,ofac,sec,fed_speeches,eia_energy,
treasury_auctions,fed_events`, six-hour intervals and 20-request budget. Eight news
sources are first eligible near 09:38 UTC, two event sources near 11:27 UTC. Its
deadline is 17:46:05.993 UTC (13:46:05.993 EDT); budget may end it sooner. BLS/FOMC
calendars are not selected. Startup/waiting is not successful ongoing acquisition.

```powershell
npm run options:weekly-sources -- --stop --workspace C:/projects/Alpha-weekly-source-integration-20261011 --run-id f1aa4896-0b42-4ecc-9b89-786e86955dbc
npm run options:weekly-sources -- --status --workspace C:/projects/Alpha-weekly-source-integration-20261011 --run-id f1aa4896-0b42-4ecc-9b89-786e86955dbc
```

4178 remains on independently reviewed `9dd4779`; new source projection waits for
coordinated review and switch. App assets were not edited. Frozen experiment,
CPI workspace/15:50, challenge ledger, strategies and risk gates remain unchanged.

Official URLs are fixed in `scripts/lib/options-weekly-issuer-parsers.mjs`.
Validation and preserved-original evidence are recorded in
`docs/status/weekly-issuer-sources-stage2.json` and the ignored stage directory.

## Validation result

Equipped aggregate passed: 232 components, 5,929 counted tests, zero failed. The initial sandbox aggregate failed on existing hardlink/symlink permissions; its log is retained. The final invalid-store coverage guard was added during aggregate execution and the final related source/plan/runner set was rerun: 66/66 passed, including 15 issuer tests. The guard makes corrupt-store counts explicitly unreliable rather than claiming zero attempts.

Actual-source replay and temporary desktop/mobile UI passed with all seven original receipt links, explicit 4/36 and 32/36 denominators, no browser/network errors or overflow. The successful-data UI check preceded only that invalid-store guard. The temporary 4180 process was stopped; 4178 readback remains 9dd4779 without the new issuer projection. All 25,907 protected file hashes, old source originals and completed-run journals remain unchanged.

Acceptance receipt: `data/runtime/options-weekly-sources/issuer-stage2/acceptance.json`; SHA-256 `0780df9f9aee483dbb7498630ec6ed0d7e29d50dc762aec340d17d1912cab9ea`. At the latest 06:02 UTC equipped readback, existing runner PID 23512 retained its original start time and WAITING/zero-request journal. First scheduled acquisition and terminal acceptance remain pending.
