# Bounded HTTP capture observation — October 13, 2026

This is an additive local repair after `7767ce69e57b95a7982232071231572a7c23d044`.
No external source request, review, quote or Paper run was performed. The shared
bounded issuer transport and exact candidate original-body queue now retain
transport observations for future separately authorized reads. No schedule,
limit, retry, strategy, risk setting, website or account was changed.

## What the original receipt cannot establish

The existing TSM receipt retained Content-Type, Date, Last-Modified and
Content-Length (5,247), alongside 89,272 saved body bytes, their hash and the
legacy `bodyComplete` result. It did not retain Content-Encoding,
Transfer-Encoding or Content-Range, runtime decoding identity, byte/chunk
counters, explicit EOF, local clipping or termination phase. The direct Fetch
route did not use a paginated tool envelope, but there was no explicit observation
field recording that distinction. Missing historical headers cannot be filled in.

The length difference does **not** establish truncation. HTTP Content-Length may
describe compressed content while Node Fetch exposes decoded body bytes. A hash
only establishes the integrity of bytes retained; neither that hash nor the old
Boolean proves publisher-document or full-filing completeness. The TSM raw body,
receipt, clocks, old read projection and UNKNOWN classifications remain unchanged.

## What the next legal bounded read saves automatically

`FETCH_CAPTURE_OBSERVATION_V1` is saved in both shared issuer receipts and candidate
acquisitions, then recomputed and validated by their existing readers:

- Response headers now include Content-Encoding, Transfer-Encoding and
  Content-Range, in addition to Content-Length, Content-Type, Date,
  Last-Modified, ETag and Location. Captured absence is distinct from a failure
  before headers were observed. No absent header is fabricated.
- Adapter, Node and Undici runtime versions identify native Fetch versus injected
  test responses. Native body bytes are already exposed after runtime content
  decoding; they are saved as Base64 without another decompression or text
  transcoding. `wireBytesObserved` stays null because Fetch is not a wire capture.
- Actual chunk count, exposed-body byte count, retained byte count, observed EOF,
  local byte-limit clipping and termination reason distinguish a clean stream
  end, deadline, cancellation, body/response-contract failure and stream error.
  The 512 KiB cap and 12-second maximum deadline are unchanged.
- Declared Content-Length is preserved as received and parsed separately. An
  encoded response or transfer framing is not compared with decoded saved bytes.
  Identity/absent-encoding comparison remains diagnostic: even a length mismatch
  does not assert truncation. Missing or invalid lengths have explicit states.
- Base64 character count and a fatal UTF-8 probe's JavaScript UTF-16 code-unit
  count are separate diagnostics, never HTTP byte lengths or completeness proof.
  Unsupported tool text envelopes are rejected, without interpreting a displayed
  character limit or pagination marker as a complete response body.

`bodyComplete` means the exposed Fetch stream ended with no transport error; the
new observation names that local meaning explicitly. Every observation retains
`documentCompleteness: NOT_ESTABLISHED_BY_TRANSPORT_OR_HASH`. It cannot authenticate
publisher meaning, establish all exhibits were obtained, or automatically review
financial content. Other unrelated collectors were not migrated by this repair.

## Validation and preservation

75 focused tests pass, zero failures: 14 transport-observation tests, 11 original
queue tests and 50 existing issuer/company/weekly-input tests. Fixtures cover a
native Fetch gzip response from a temporary loopback server, identity, absent
length/encoding, transfer framing, split multibyte text, clipping, stream errors,
timeout, tool envelopes, invalid lengths and tampered observations. The native
gzip test makes one local fixture GET per test run; external source calls are zero.
The full repository suite was not run.

The 155 prior TSM/acquisition-acceptance files, 537 weekly intake/review files and
25,910 protected files match their saved hashes. Old TSM read records compare
exactly. GET-only health checks on 4178, 4180 and 4181 match their prior full
responses, including code versions and startup clocks. There was no write probe,
website switch, push or deployment.

Private run: `http-capture-observation-20261013-01`, under ignored
`data/runtime/options-workbench-development/`. Supporting files are
`tests-final.log`, `preservation.json`, `legacy-tsm-readback.json` and
`ports-unchanged.json`. The repair is saved in a separate local commit; its exact
hash is in private `delivery.json` to avoid embedding a commit's own hash.

Historical transport evidence remains unavailable; another read could only create
new evidence with new clocks. No further read is authorized by this repair.
Document scope and financial attribution still need explicit evidence review;
research remains unresolved, with quote and Paper not run.
