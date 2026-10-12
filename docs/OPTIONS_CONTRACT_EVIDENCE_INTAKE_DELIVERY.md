# Offline contract-original intake

The existing CONTRACT envelope already checked hashes, review/receipt clocks and
validity. It did not bind the continuation's standard-series Boolean/reference to
an original source record. This delivery adds that missing source-binding check
to the existing envelope and real continuation consumer. It does not add another
account, portfolio, market collector or trading permission framework.

## Supported evidence and remaining limits

The bounded intake accepts saved UTF-8 JSON source documents and a saved text
reference for the existing SPY American-style product rule. Each source retains
its exact UTF-8 text/hash, origin, original-versus-derived representation, source
locator/version, optional publication time, observation/receipt clocks and
applicable interval. Null/unknown applicability stays UNKNOWN. Review time and
local import time are separate; recovery never renews the original interval.
PDF/image and arbitrary prose deliverable extraction are not implemented. Do not
transcribe such a source into invented provider fields to pass this adapter.

All identity and fact field selectors name direct properties of one JSON record.
A bounded JSON Pointer locates that record. An exact UUID must match the selected
SPY instrument and full expiry/type/strike tuple. Alternatively, the identity
original must actually return a complete series identifier, and the fact record
must return that same identifier and tuple. No OSI is generated from a ticker,
date or strike. Relative field paths cannot read another row. A source property cannot be reused for two semantics. Class codes accept only classCode, class_code, contract_class, series_class or standard_series_class; series IDs accept only seriesId, series_id, option_series_id or contract_series_id. Unsupported schema names stay UNKNOWN pending a reviewed adapter change; ticker aliases cannot qualify.

Two routes use the same check:

- Direct current deliverable: the identified record supplies its complete basket,
  physical settlement and USD denomination.
- Documented current class: the identified record supplies a current class code;
  a source rule for that exact class and SPY supplies the basket and settlement.

The supported basket has exactly 100 SPY equity shares, explicitly denominated
in SHARES, optionally with an explicitly zero USD cash component. Money multiplier
100 and cash_component null alone cannot establish it. American exercise must be
returned by the facts or mapped from the retained SPY-specific Cboe text. The old
UNADJUSTED label is scoped to current standard deliverable economics, not a claim
that the series has never been adjusted. No bespoke per-series certificate is
required. Declared conflicts, extra unreviewed sources, missing fields, unsupported
baskets, future/expired evidence and synthetic/real context mixing stop output.

Hash and pointer checks establish integrity and location, not independent provider
authentication or field semantics. The named reviewer must check the source's
meaning, completeness, provenance and applicable version. An OWNER_DOCUMENT remains
an attributed owner-supplied original; it never becomes a provider-authenticated
record. Derived extractions are retained as unsupported, not relabeled as originals.

## Minimal operation

1. Put the actually supplied originals and one input packet in the existing ignored
   `data/runtime/options-workbench-development` area. Keep original bytes unchanged.
   The versioned input fields are `version`, `context`, `selection`, `originals`,
   `legs`, `productRule`, `review`, `window`, and `conflicts`.
2. Supply two exact SPY selections: `id`, `symbol`, `expiry`, `type`, `strike`,
   `multiplier`, `tradability`. Each leg binds `identity` and `current` records via
   `{sourceId, pointer, fields}`. Field mappings are source property names, not
   copied desired values. The documented-class route additionally binds `classRule`.
   `productRule` is null when the original facts already establish exercise style.
3. Preserve all actual source clocks and review them before the intended window.
   Use `ORIGINAL_PROVIDER_DATA` or `ORIGINAL_OWNER_SUPPLIED_DOCUMENT` honestly;
   `DERIVED_EXTRACTION` cannot qualify. Keep missing dates null and conflicts listed.
   The synthetic helper in `scripts/lib/options-contract-source-fixtures.mjs`
   documents the full schema; it is not a real evidence template or source.
4. Run `npm run options:contract-evidence -- --preview PRIVATE_INPUT`.
   Preview writes nothing. Inspect UNKNOWN blockers; do not fill them with guesses.
5. Only for explicit archival, run
   `npm run options:contract-evidence -- --receive PRIVATE_INPUT --run-id contract-evidence-NAME`.
   A new directory preserves input bytes, each original, assessment and manifest.
   An existing directory is never overwritten. UNKNOWN has no `contract-record.json`.
6. Run `npm run options:contract-evidence -- --recover contract-evidence-NAME`
   to verify copied bytes and exact original replay. Current validity is reported
   separately; a historical successful receipt can now be expired.

A qualifying output is an existing CONTRACT envelope with its source binding
embedded. The real continuation validates the same binding again, including its
exact contracts, clocks and outer review envelope. Omitting the binding or deleting
its version cannot downgrade to the old Boolean-only check. Historical fixture
replay remains separate; a fixture-bound record cannot qualify a real continuation.
This command never starts a plan, acquires a quote, changes funds or writes a trade.

## Current delivery boundary

No new external evidence has been acquired. The actual 778/779 option attempt
remains blocked. Existing stock/account originals, $222.37 settled and $777.37
unsettled funds, morning frozen experiments, challenge ledger and CPI work remain
unchanged. This intake is not deployed. A separately authorized release switched 4178 to the previously accepted 38d532e archive; 4180 retains that same prior archive. Neither service consumes this working-tree change.
This stage has its own local commit after baseline `1e86a3b8`; no public push is
authorized. See [status](status/contract-evidence-intake.json) for final validation.


## Validation

Final full validation passed: 258 components, 6,477 parser-counted tests, zero failures. The native intake runner separately reports 40/40; the existing aggregate parser does not count its native summary. Combined focused regression passed 115/115, and independent intake/continuation review passed 76/76 with no remaining P1/P2. The ticker-to-class mapping finding was fixed by rejecting property reuse and restricting class/series identifier field names. All 25,910 protected originals and the three-file actual account remained unchanged. A clearly labeled fixture archive recovered exact bytes; its current expired status stayed UNKNOWN. These checks are implementation evidence, not real option or strategy acceptance.

## Returned OCC identity supplement — October 12, 2026

The installed official get_option_historicals schema exposes instrument_id and occ_symbol. A separately authorized single two-ID historical request returned both selected SPY October 16 call identities, matching the original UUIDs and 778/779 strikes. This closes the identity bridge only. Prices and omitted interpolation flags are retained in private originals, never used for fills or fresh-quote claims.

The existing intake now accepts occ_symbol as a source-returned series field. It strictly checks fixed-width padding, date, call/put, thousandth-dollar strike and exact UUID/underlying against the original selection. Only SPY and SPY numeric-suffix roots are supported by this bounded adapter; neither numeric nor ordinary roots imply adjustment or deliverable status. Any separately mapped tuple fields must agree. The full returned symbol is preserved, never generated from a ticker.

The selected source rows still lack current deliverables/class applicability. A current original deliverable or applicable documented class rule remains required by the unchanged basket, clock and consumer checks. No usable real CONTRACT, quote, claim, continuation or fill was created. The supplement is local-only pending review/publication of the complete new scope. CPI source copies and the 11,164-byte input candidate are private preparation only: unchanged 10/9 attributed research, no source refresh, freeze or schedule change.

Supplement final verification: native intake 53/53, combined continuation regression 89/89, independent review without new P1/P2. Full validation passed 258 components and 6,477 parser-counted tests, zero failed; native summaries remain separately counted. All 25,910 protected originals and the actual three-file account were unchanged.
