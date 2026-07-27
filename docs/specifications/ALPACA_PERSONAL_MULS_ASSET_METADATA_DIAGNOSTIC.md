# Alpaca Personal MULS Asset Metadata Diagnostic

## Status

T3G-C4 defines one Owner-gated, read-only metadata diagnostic for `MULS`.
Implementation and validation are network-free. No real metadata request is
authorized by this specification or by passing tests.

## Purpose

The preceding Alpaca Basic IEX P1D smoke omitted `MULS`. The redacted Bars
response cannot distinguish a missing IEX observation from an inactive,
unsupported, OTC, halted, or otherwise unavailable asset. C4 may narrow that
diagnosis using Alpaca's single-asset metadata endpoint without querying an
account balance, position, order, or market price.

## Exact request

The only permitted request is:

- method: `GET`;
- endpoint: `https://paper-api.alpaca.markets/v2/assets/MULS`;
- query: none;
- body: none;
- request budget: one;
- timeout: 10 seconds;
- maximum response size: 65,536 UTF-8 bytes;
- redirects: rejected; and
- retries, polling, pagination, streaming, scheduling, and persistence: none.

Any alternate host, port, credential location, path, symbol, query parameter,
method, body, timeout, or response bound fails before transport execution.

## Credential boundary

The adapter reuses only `ALPHA_ALPACA_API_KEY_ID` and
`ALPHA_ALPACA_API_SECRET_KEY`. Values enter only the two Alpaca authentication
headers and never the URL, output, error, log, JSON diagnostic, or persisted
state. The command copies no unrelated process environment value.

## Response validation

The response must be one bounded JSON object whose required identity and state
fields include:

- UUID asset identity;
- `class=us_equity`;
- exact `symbol=MULS`;
- a reviewed US exchange code;
- bounded display name;
- `status` of `active` or `inactive`; and
- Boolean `tradable`.

Known optional Alpaca asset fields are type-checked and discarded. Unknown,
malformed, substituted, oversized, provider-error, or non-success responses
fail closed. The normalized diagnostic exposes no asset UUID, marginability,
borrow status, raw attributes, provider narrative, or raw body.

## Diagnostic classifications

The sanitized result may classify only:

- `ACTIVE_TRADABLE_NMS`;
- `ACTIVE_NON_TRADABLE_NMS`;
- `INACTIVE`;
- `OTC_UNSUPPORTED`; or
- a typed fail-closed error.

An active/tradable NMS result confirms only Alpaca asset metadata. It does not
prove an ETF classification, an IEX trade, a Bar, a Quote, liquidity, NBBO,
consolidated volume, short availability, or complete provider qualification.

## Command and Owner gate

The local command is dry-run by default. One real request requires the exact
flag `--confirm-muls-asset-metadata-read` after a fresh Owner authorization.
Unknown, duplicate, or substituted flags fail closed. A confirmation applies
to one foreground invocation and grants no later or background authority.

## Output boundary

Output contains only the fixed provider and symbol identities, mode, request
counts, redacted credential diagnostic, sanitized classification and fields,
warnings, and explicit zero persistence, recommendation, and trading authority.

## Authority references

- https://docs.alpaca.markets/us/reference/get-v2-assets-symbol_or_asset_id
- https://docs.alpaca.markets/us/docs/working-with-assets
- https://docs.alpaca.markets/us/docs/market-data-faq

## Non-authority declaration

C4 is diagnostic-only. It cannot modify the T3G-C3 provider qualification by
itself and grants no later network authority.

## Owner-authorized operation outcome

After implementation review, the Owner separately authorized one exact real
read. The command attempted and completed one request, received HTTP `404`, and
returned sanitized `ASSET_NOT_FOUND`. It made zero retries and zero persistence
writes and accessed no account, balance, position, order, or market-data
endpoint. T3G-C5 records this outcome without retaining the provider body.
