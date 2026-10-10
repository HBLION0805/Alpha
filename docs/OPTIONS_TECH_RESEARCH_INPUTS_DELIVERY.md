# Fixed-pool scan to cited research inputs — October 10, 2026

The existing candidate command can now turn its saved 36-company discovery/review bundle into cited research materials. Previously `--prepare` required a separately written research JSON and carried only the selected candidate forward. The new explicit `--research-inputs` mode emits all 36 company traces, the saved event reviews and extractable original bodies. It does not create a directional plan or change ranking.

```powershell
npm run options:tech-candidate -- --research-inputs --source-root <saved-source-bundle> --run-id <new-private-run-id>
```

Output is exclusive under ignored `data/runtime/options-workbench-development/<run-id>`: copied source bytes, `research-inputs.json`, and a receipt with source/output hashes and implementation hashes. Reusing an ID fails without replacing the earlier result. There are no source calls, market calls or new schedules.

## Existing capability and the remaining break

- Discovery exists as the saved, frozen fixed-36 scan and its original scanner. This delivery does not install a continuous scanner or infer that one is running.
- Existing production repository code verifies the versioned discovery, review, original-byte hashes and historical ranking. That verifier and `classifyAndRank` are reused unchanged.
- The added connection supplies source text, saved interpretations, event links and local evidence gaps for further research. Five event bodies can now be read from the generated material instead of manually assembling another ticker sample.
- Direction, numerical fact qualification, technical structure, comparable guidance, consensus, holding windows and entry conditions still need substantive research. Null fields are explicit unfinished inputs. This is not an implementation of automatic company analysis.

## Saved-original acceptance

Replay run `tech36-research-inputs-replay-20261010-r2` consumes the original October 8 scan and reviews; it is **not newly collected data**. The private receipt records the actual generation clock separately from original source clocks.

| Layer | Observed coverage |
| --- | --- |
| Fixed pool | 36 companies, 72 source coverage rows |
| Discovery | 2,679 event records; 2,835 company-event associations, including 2,830 headline associations |
| Cited research input | 5 saved reviewed events, 7 extracted SEC documents, 2 attributed related headline records |
| Historical ranking | 2 selected, 1 pending, 2 rejected events, 31 without a ranking review; unchanged |
| Later limited followup | 2 priority research, 12 pending verification, 11 missing data, 11 excluded events; unchanged |
| Limited followup coverage | One selected headline association per company; 2,794 unattempted associations remain |
| New source / quote / Paper | Zero source and market calls; no Paper admission or fills |

These two classification distributions concern different saved review scopes. Neither is a complete opportunity screen. An excluded personnel event does not reject its company. The saved financing timeline conflict remains unresolved. The ordering is event research priority, not a stock recommendation.

## Evidence handling

Each body block carries a document hash and decoded-source character offsets. Script/style/comment/known inline-hidden material is omitted; table rows retain their textual context. Original bytes are copied for inspection. External CSS, visual layout, PDFs and generic non-HTML bodies are not interpreted; unsupported bodies or encodings remain local gaps. Parsing does not turn text into numerical facts.

Filing acceptance time, original receipt time, saved review time and this derivation time remain separate. Document publication time is unknown where no document-level clock was verified. Existing event-to-headline relationships remain attributed to the saved review; they do not authenticate a publisher article or create another independent opportunity. Unresolved links are retained as issues.

Guidance revision remains unknown without a reviewed pair for the **same target fiscal period**, metric, basis, currency, unit and scope. Cross-quarter differences are not revisions. Consensus surprise remains unknown without comparable pre-announcement consensus. No valuation, direction or probability is imputed from old text or score.

## Verification and boundaries

The existing candidate test group now covers the CLI, self-contained hashes, exclusive output, original preservation, parser coordinates and hidden content, row context, exact event deduplication, local source failure, attributed links, clock ordering, and non-promotion of text into guidance/consensus claims. Final combined validation and preservation checks are recorded in the status file and private delivery receipt.

No changes to strategy, risk thresholds, the scheduled October 12 trial, CPI workspace, 15:50 routine, challenge ledger, account/order access, deployment or main branch. The adapter currently consumes the existing versioned candidate replay bundle, whose verifier requires a selected candidate and the saved followup files; it is not a generic ingestion interface for arbitrary future scanner versions.
