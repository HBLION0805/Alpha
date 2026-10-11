# PDF disable flag enforcement — October 11, 2026

Independent review accepted the IR/SEC boundaries and the three-source real
hourly-minimum run at dfd9242, but found that `pdfMetadata.enabled: false` was
not enforced when the PDF ID and batch remained in a configuration. The default
configuration has no PDF ID and was unaffected. No unauthorized PDF request was
observed; the earlier annual-PDF acquisition and interpreted dates are unchanged.

The configuration reader now rejects any retained `cboe_pdf_metadata` selection
unless the flag is the boolean `true`. Missing, false and truthy strings/numbers
do not enable it. The runner independently repeats this check before ownership,
manifest writes or requests, including calls that bypass CLI config parsing.
The due projection reports `PDF_METADATA_DISABLED`, and the dispatch adapter
also requires an explicitly enabled flag before calling the HEAD-only reader.

Three new regression tests cover retained IDs/batches with disabled and missing
flags, direct-runner rejection without creating ownership, disabled plan
projection, dispatch rejection and explicitly enabled due HEAD/304 behavior.
The focused suite passes 21/21. This fix makes no source request and does not
start a process. Weekly PDF cooldown, no GET fallback, changed-validator review
and immutable mapped dates remain unchanged.

The three-source real run `e54bb517-3e64-442b-8f7e-a8e44d0078ee` remains an
acceptance of its dfd9242 implementation and **pre-hashed one-hour configuration**.
It is not a real six-hour-default acceptance or new live evidence for this repair.
All 85 existing issuer receipts remain local and unchanged. The new code needs
independent review; 4178 stays on ae8a88c and the ten-source process is unchanged.

Full equipped validation passes: 236 components, 5,983 tests, zero failures.
The local no-request check preserves all 85 issuer receipts and 25,907 protected
files. Its record is `data/runtime/options-weekly-sources/company-pdf-disabled-local-check.json`;
the sanitized [repair status](status/weekly-company-pdf-disable-repair.json)
retains that record's hash, validation-log hash and the original hourly-run
acceptance hash. The source readers, raw parsing rules and original generic
issuer limits are unchanged.
