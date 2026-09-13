# Guidance schedule V2

Owner request: September 12, 2026, New York. Remove the 09:50 and 12:50
routine GLD/IBIT samples and retain 15:50. Keep hourly :20 news/guidance,
09:00 context, conditional event-day :20 samples, and the existing seven
16:20 full-chain closes through September 16. No opening collector or new job.

The existing heartbeat is updated through the app to 26 daily wake times.
Routing and delivery diagnostics use one dated policy: dates before September 13
retain three fixed windows; dates from September 13 use only 15:50. The first
affected weekday is September 14. Historical missing windows stay missing.
Reviewed holiday/early-close filtering and unknown-year behavior are unchanged.

Keep the original Host V1 and v6 restoration files immutable. Host V2 supplies
both transitional and ongoing fields. After the final close (or first later
transitional wake), restore exact v6 first and apply V2 ongoing fields second.
This prevents the cancelled routine slots from returning after September 16.

Acceptance: app readback matches V2; only two wake times are removed; :20/09:00,
event instructions and close/restoration behavior remain. Test routing before
and after the change, DST, historical missing counts, the next fixed window,
the frontend description and both Host phases. No market requests, enrollments,
orders, risk changes or real-price gate advancement are part of this change.
