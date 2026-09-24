# Owner Chinese UI V1

Alpha Workbench defaults to `zh-CN`. The existing route IDs, request bodies, API responses, persisted records, fingerprints, source excerpts and Owner-authored notes are unchanged. The UI shell is Chinese; `apps/options-workbench/i18n.js` supplies deterministic labels for fixed interface phrases and machine statuses at the browser presentation boundary. Source titles and quoted/evidence text are not translated. Standard market abbreviations and identifiers remain visible in their original form where needed.

There is no language selector, network translation, runtime migration, market request, order route or change to trading rules. Existing view templates remain the single source of page structure. Newly inserted UI nodes use the same localization pass; raw JSON diagnostics and user inputs are excluded. Legacy records continue to load through their existing readers.

The focused check covers document language, navigation, route headings, status labels, unchanged payload construction and original source/Owner text. Existing Workbench tests, TypeScript and full Alpha validation provide regression coverage. Browser acceptance records desktop and 390px layout separately from automated tests.
