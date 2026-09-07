# Existing host timeout assessment

Date: 2026-09-07. Read-only follow-up to the complete synthetic collection rehearsal.

The targeted host configuration read found the existing section
`mcp_servers.robinhood_alpha_market_data` in the local Codex config, with
`startup_timeout_sec = 15` and `tool_timeout_sec = 20`. Only section headers and
those two numeric key names were selected; no credential/token content or
callback was inspected. The [sanitized checkpoint](status/host-timeout.json)
retains the observed fields and verification time, not the full host config.

The [official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
defines the tool field as a per-tool timeout override and the startup field as
the server-initialization timeout override. The configured twenty seconds is
less than the study's sixty-second target cadence. This configuration read does
not independently verify the loaded runtime value or measure a real stalled
request, remote cancellation, scheduling delay or total heartbeat duration.

No additional timeout mechanism, host update, restart, login or live quote probe
was performed. Existing Host code catches tool errors and retains a fixed
TOOL_FAILED outcome; it does not distinguish a timeout from other exceptions.
Its failure-clock field is local attempt settlement, not proof that the provider
returned quote data. Successful quotes retain their separate source clocks.

The synthetic slow-response rehearsal deliberately models seventy-second
responses without host MCP timeout enforcement. Its zero usable observations
remain valid for that declared model; its alternate-wake pattern is not a
prediction of this configured live host. Its original receipt and all evidence
remain unchanged. A never-settling actual source is still not empirically tested.

Validation: targeted local config read, official field-semantics reference,
protected file/host hash comparison, documentation links and Git diff checks.
No code or dependency changed; the latest code baseline is 3,012 passing tests.
Current source journals, frozen studies, the runbook and v4 heartbeat are intact.
Documentation changes are committed/pushed under the standing Owner authority.

Next: inspect actual source-call timing/errors in the first opening collection.
Do not manufacture a stalled call or broaden tool scope to validate this setting.
