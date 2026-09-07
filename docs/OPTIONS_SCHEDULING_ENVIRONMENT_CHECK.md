# Read-only scheduling environment check

Actual readback: **2026-09-07T08:29:08.830Z**. This follows the Owner's direction
to keep the computer on while automatic data collection remains armed.

Windows reports `Eastern Standard Time`, daylight-saving support and a current
UTC offset of minus four hours. Converting the frozen opening start
`2026-09-08T13:30:00.000Z` through that actual zone returns **09:30 on September 8**.
The zone's Windows identifier contains “Standard”; the measured offset correctly
reflects daylight time. No clock, zone, Codex schedule or task was changed.

The active power scheme's `STANDBYIDLE` values are zero for both AC and DC power.
Microsoft documents this zero as disabling automatic idle-to-sleep for that
setting. [Sleep idle timeout](https://learn.microsoft.com/en-us/windows-hardware/customize/power-settings/sleep-settings-sleep-idle-timeout).

`HIBERNATEIDLE` also returns zero on both power modes. This is retained as a raw
setting; it is not proof that every hibernation mechanism is off. Microsoft's
current documentation describes adaptive-threshold behavior for zero.
[Hibernate idle timeout](https://learn.microsoft.com/en-us/windows-hardware/customize/power-settings/sleep-settings-hibernate-idle-timeout).

These reads remove an unverified local time-zone assumption and establish the
current idle-sleep values. They do not prove the app's next wake, future quota,
network availability or uninterrupted operation. No power policy, service,
startup item, wake timer or credential was changed. The existing shared v5
heartbeat and source-access boundaries remain authoritative.

## Evidence and validation

Commands: `Get-TimeZone`, explicit UTC-to-local conversion, and the two fixed
`powercfg /query SCHEME_CURRENT SUB_SLEEP` queries for `STANDBYIDLE` and
`HIBERNATEIDLE`. Both commands succeeded. The new local artifact retains their
raw output and extracted values; the [checkpoint](status/scheduling-environment.json)
binds its hash. The second readback agreed with the initial targeted queries.

Files changed: this document, its checkpoint and a focused handoff link. Local
JSON/link/whitespace and protected-file/host checks are performed before the
authorized commit/push. No implementation changed; the existing validation
baseline was not repeated for these read-only OS observations.

No OS-setting or collection error was observed. The unresolved requirement is
future execution availability, including Codex capacity. The next action stays
the existing daily context check and frozen September 8 opening collection; no
new process, scheduler or background-work guarantee is introduced.
