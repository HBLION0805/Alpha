# Public collector startup correction

## Problem and scope

At 2026-09-09T02:31:47Z the workbench's public collector recorded nine local
network-access denials and a BTC NETWORK_FAILED result. The launcher had been
started inside the restricted command environment. Its loopback health check
confirmed only that the interface was reachable, not that outbound reads worked.
The Owner asked to correct this startup and verify actual collection.

Use the supported per-command network approval path to launch the existing
workbench. Match the exact workspace/script/arguments and loopback listener
before stopping an existing process. Reusing a matching process cannot upgrade
its inherited permissions. Do not change global security settings, endpoints,
authentication, schedules, journals or collection frequency.

Retain this hour's original claims and failed receipts. After restarting, let
the next natural hourly attempt run with its real clock; verify source journals
and the resulting issued guidance. A running process or ALREADY_ATTEMPTED result
is not recovery evidence. Do not acquire duplicate data to manufacture success.

## Small product correction

The launcher must identify readiness as local-interface availability. The shared
workbench banner and News & calendar should explain a saved access-denied status
as a local collector permission failure, without claiming the Owner caused it or
identifying an unverified firewall rule. HTTP failures and unknown network errors
must not be relabeled. A later successful observation removes the current denial
notice; earlier evidence remains unchanged. Show exact source clocks as before.

Validate the diagnostic projection, its recovered state and unchanged filtering;
inspect the frontend and run the existing relevant checks. Save actual before/
after source evidence and record the result in a separate delivery/checkpoint.
No new strategy, allocation, account, order or first-paper-flow gate is included.
