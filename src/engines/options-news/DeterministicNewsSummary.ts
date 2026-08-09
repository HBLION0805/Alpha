import { NewsSummaryProvider, NewsSummaryStatus, type NewsEvidenceRecord, type SummaryEnvelope } from "../../contracts/OptionsNewsDomain";
import type { SummaryProvider } from "../../contracts/OptionsNewsProvider";

export class DeterministicNewsSummaryProvider implements SummaryProvider {
  public summarize(input: { readonly evidence: readonly NewsEvidenceRecord[]; readonly generatedAtUtc: string }): SummaryEnvelope {
    if (input.evidence.length === 0) return { chineseSummary: null, summaryStatus: NewsSummaryStatus.Unavailable, summaryProvider: NewsSummaryProvider.Deterministic, providerModelId: null, algorithmVersion: "deterministic-summary:1.0", inputEvidenceIds: [], generatedAtUtc: input.generatedAtUtc, validationResult: "UNAVAILABLE" };
    const first = input.evidence[0] as NewsEvidenceRecord;
    const facts = Object.entries(first.keyFacts).sort(([a],[b]) => a.localeCompare(b)).map(([key,value]) => `${key}=${value}`).join("；");
    if (facts.length === 0) return { chineseSummary: null, summaryStatus: NewsSummaryStatus.FailedValidation, summaryProvider: NewsSummaryProvider.Deterministic, providerModelId: null, algorithmVersion: "deterministic-summary:1.0", inputEvidenceIds: input.evidence.map((v) => v.evidenceId).sort(), generatedAtUtc: input.generatedAtUtc, validationResult: "INVALID" };
    return { chineseSummary: `已记录${first.eventTypeCandidate}：${facts}。`, summaryStatus: NewsSummaryStatus.Generated, summaryProvider: NewsSummaryProvider.Deterministic, providerModelId: null, algorithmVersion: "deterministic-summary:1.0", inputEvidenceIds: input.evidence.map((v) => v.evidenceId).sort(), generatedAtUtc: input.generatedAtUtc, validationResult: "VALID" };
  }
}
