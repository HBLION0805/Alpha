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

## Verified OAuth completion

`codex mcp login robinhood_alpha_market_data` started the official OAuth flow.
The browser reached Robinhood's existing-account login page, with email/password
and passkey options. The page was handed to the Owner without filling credentials.
No new-account or payment step was accepted by the agent.

The first two attempts timed out waiting for their OAuth callback (CLI exit 1).
The third attempt completed successfully. Verification on 2026-09-07 UTC
(2026-09-06 America/New_York) observed CLI exit 0 with
`Successfully logged in to MCP server 'robinhood_alpha_market_data'.`
A separate effective-host `codex mcp list --json` readback reported `o_auth`,
and `codex mcp get` reconfirmed the enabled endpoint and exactly the five tools.
This proves saved host authentication, not successful quote retrieval.

Automatic review rejected the agent's earlier Allow click because the consent
page includes all-account visibility and Agentic-account trading capability.
The Owner subsequently explicitly accepted that broader connection grant and
completed the official flow. No further connection-consent question is pending.
This does not authorize account-tool calls or brokerage transactions.

At the initial OAuth checkpoint, this task had no callable Robinhood tools.
A documented `config/mcpServer/reload` attempt through `codex app-server proxy`
could not reach the local control socket (Windows error 10050); the proxy exited
before initialization or reload. This is a local refresh failure, not evidence
of failed OAuth. No MCP tool call or qualified quote acquisition occurred.
After the Owner checked desktop MCP settings, all five tools loaded and returned
market data. No further restart is needed. The official
[MCP setup instructions](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
document the Restart step used for configuration changes. The subsequent
[capture assessment](OPTIONS_ROBINHOOD_CAPTURE_DELIVERY.md) records actual quote
sides, sizes, source clocks and historical interpolation; independent side/size
timing, qualified replay paths and retention rights remain unverified.

Do not store the temporary authorization URL, callback state, tokens or account
identifiers in Git. If login times out, restart the same approved login when the
Owner is ready; the authorization and five-tool limit persist without a new
permission question. If onboarding or a charge is required, stop at that step.

## Authority and evidence

The Owner explicitly accepted the previously explained broad server authorization. The
local five-name filter does not narrow Robinhood OAuth scopes or enforce ticker
arguments. Future data requests remain limited to GLD/IBIT and require actual
schema inspection; account, order and spot-crypto tools remain outside scope.
Official source: [Robinhood access and connection overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/).

This is a host-operations record after the reviewed build snapshot in
[current.json](status/current.json). It supersedes that snapshot's installation
and authentication facts only; it does not rewrite its tests, source evidence,
engine outputs, or lack of qualified quotes. The offline readiness report is a
dated preparation report, not discovery of the current host configuration.

Validation for this setup: TOML parse and equality of all unrelated configuration,
effective host five-tool readback, OAuth CLI completion and independent auth-status
readback, official login-page inspection, status-snapshot validation and Git
whitespace checks. Product code and dependencies are unchanged; no simulation or
live trade was run. Existing trade/review/notebook journals remain untouched.
That setup checkpoint is complete. Follow the capture delivery for the next
bounded screening/forward-capture work; do not repeat completed OAuth or restart.
