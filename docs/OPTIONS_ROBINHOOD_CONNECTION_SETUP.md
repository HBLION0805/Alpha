# Robinhood host connection setup

Owner approval received after readiness delivery `9915d79`: enable only the five
market-data tools and let the Owner complete official login. Stop before any new
account opening or paid step. No account-query or order tool invocation is authorized.

## Installed host configuration

The Codex user configuration now contains `robinhood_alpha_market_data`, enabled
with the fixed URL `https://agent.robinhood.com/mcp/trading` and exactly:

- `get_option_chains`
- `get_option_instruments`
- `get_option_quotes`
- `get_option_historicals`
- `get_equity_quotes`

The installation preserved every unrelated configuration value and verified the
effective host configuration through `codex mcp get robinhood_alpha_market_data
--json`, displaying only the endpoint, enabled flag and approved tool names.
The restricted command environment initially showed its older configuration;
host-side verification confirmed the new entry. No existing server was replaced.
The checked-in example stays disabled; the enabled copy lives only in the host's
Codex user configuration, outside the repository. No credentials are copied here.

## Login handoff

`codex mcp login robinhood_alpha_market_data` started the official OAuth flow.
The browser reached Robinhood's existing-account login page, with email/password
and passkey options. The page was handed to the Owner without filling credentials.
No new-account or payment step has been accepted. Authentication completion has
not yet been observed; runtime tool schemas and actual quotes remain unavailable.

The first login attempt subsequently timed out waiting for its OAuth callback
(CLI exit 1). This was not authentication success or a data-access test. A fresh
official login may be started under the same approval; the installed filter stays
unchanged and the Owner must use the currently active authorization page.

Do not store the temporary authorization URL, callback state, tokens or account
identifiers in Git. If login times out, restart the same approved login when the
Owner is ready; the authorization and five-tool limit persist without a new
permission question. If onboarding or a charge is required, stop at that step.

## Authority and evidence

The Owner accepted the previously explained broad server authorization. The
local five-name filter does not narrow Robinhood OAuth scopes or enforce ticker
arguments. Future data requests remain limited to GLD/IBIT and require actual
schema inspection; account, order and spot-crypto tools remain outside scope.
Official source: [Robinhood access and connection overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/).

This is a host-operations record after the reviewed build snapshot in
[current.json](status/current.json). It supersedes that snapshot's installation
and pending-consent facts only; it does not rewrite its tests, source evidence,
engine outputs, or lack of qualified quotes. The offline readiness report is a
dated preparation report, not discovery of the current host configuration.

Validation for this setup: TOML parse and equality of all unrelated configuration,
effective host five-tool readback, official login-page inspection and Git whitespace
checks. Product code and dependencies are unchanged; no simulation or live trade
was run. Existing trade/review/notebook journals remain untouched. The next step
depends on the Owner completing official login, then verifying actual market-data
tools and schemas within the approved scope.
