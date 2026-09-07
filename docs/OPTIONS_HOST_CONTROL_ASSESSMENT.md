# Direct host-control assessment

Date: 2026-09-07. This is a bounded read-only operational investigation, not an
alternative collector deployment or a new authorization flow.

The Owner requested continued development while away and automatic collection
without orders. Later scheduled Codex work depends on available execution
capacity as well as the computer/app. A local direct-tool route was inspected
to determine whether a collector could avoid starting another model turn.

## Evidence and result

The installed CLI is `codex-cli 0.153.4`. Its generated public protocol schema
includes `mcpServer/tool/call`, requiring server, tool and threadId. The
[official request processor](https://github.com/openai/codex/blob/main/codex-rs/app-server/src/request_processors/mcp_processor.rs)
loads an existing runtime thread before a direct call. Public main-branch code
is supporting design evidence, not proof of the exact installed runtime behavior.

One bounded `codex app-server proxy` probe began at
**2026-09-07T05:50:14.194Z** and ended at **05:50:14.377Z** with exit code 1 and
Windows socket error **10050**, before initialization. Only `initialize` was
sent; no source, status-list, direct-tool or model-turn request was sent afterward.
The sanitized local result is
`data/runtime/options-robinhood-data/host-control-probe.json`.

The read-only `codex app-server daemon version` command reports that daemon
lifecycle is supported only on Unix platforms. No daemon was started, stopped
or restarted. No socket address was guessed or supplied. The probe did not
inspect/copy credential contents or override connection configuration, and no
alternative process was installed.

This technical failure does not mean the Robinhood connection failed: all five
authorized market tools remain available through the current Codex host. OAuth
and earlier actual market reads were already verified. Do not repeat login,
consent or desktop restart because of this separate proxy result.

## Operational decision and limits

Retain the existing shared heartbeat and verified runbook. No working route
independent of later model execution has been established. Do not claim the
current schedule will run after allowance exhaustion merely because the computer
is awake. Do not redeem reset credits, purchase capacity, create a second task or
resume the active task in another server as a workaround.

The existing automatic collection remains September 8, 09:30-09:50 New York;
daily context restores the verified v4 snapshot. Host availability, source
quality and execution authority remain separate. Account/order tool calls and
brokerage transactions remain outside scope.

Validation: installed CLI version, local public schema inspection, the one
sanitized failed proxy probe, read-only platform capability check and existing
host-field/hash evidence. No tests of a new runtime are claimed. Further direct
control work needs a supported, verifiable host path; identical failed probes
should not be repeated. The current code baseline has 2,955 passing tests; this
documentation correction changes no program behavior or source records.

Files changed for the operational correction: current facts in AGENTS.md,
this assessment, a short host-setup/handoff link and current operating references.
Existing permission limits are retained. Documentation and Git checks precede
the standing-authorized commit/push; no code test rerun is needed for these facts.
The five changed documents passed 58 local-link checks and Git whitespace
review. Twenty-one protected artifacts, the active host hash and the exact
quote Host tick program remained unchanged.
