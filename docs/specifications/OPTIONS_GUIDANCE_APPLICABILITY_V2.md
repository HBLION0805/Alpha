# Guidance applicability v2

September 10, 2026: replace weekday-only eligibility for new guidance with the
already reviewed 2026 session calendar. Preserve frozen V1 inputs/reports exactly.
V2 inputs produce V4 reports, retain allocation-only policy and all existing checks,
exclude holiday closes from descriptive history, and block unknown calendar years.
Keep guidance within the regular underlying session; do not infer late option
trading permission. Early-close days end at 13:00 New York. Halts remain unknown.

V2 also requires attributed analysis and blocks a capture newer than its analysis.
A matching timestamp is accepted; this is a sequencing check, not proof of
substantive analysis. Original paper sessions, plans, fees and schedules remain
unchanged. Extract the existing clock helper unchanged to avoid a dependency cycle
between guidance and the reviewed paper calendar. UI and Host expose the policy.

Acceptance: old outputs/fingerprints, ordinary session and DST boundaries,
holidays, early closes, unsupported years, holiday-history rejection and missing/
outdated analysis; existing paper sessions and original journals must still recover.
No real-price gate promotion, new source cadence or order authority.
