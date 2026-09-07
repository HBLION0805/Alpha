import { CONTEXT_CUTOFF_SOURCES_V2, reconstructOptionsContextV2, type ContextCutoffHistoriesV2 } from "./OptionsContextCutoffV2";
import { readinessFingerprint } from "./OptionsReadinessEngine";

export type ContextManifestSource = typeof CONTEXT_CUTOFF_SOURCES_V2[number];
export interface ContextManifestMember {
  readonly source: ContextManifestSource;
  readonly category: "observation" | "health" | "retrieval";
  /** Index in the original validated source/category history, before cutoff selection. */
  readonly recordIndex: number;
  readonly recordSha256: string;
  readonly knownAt: string;
  readonly clockBasis: "observedAt" | "receivedAt";
}
export interface ContextManifestComponent {
  readonly source: ContextManifestSource;
  readonly state: "AVAILABLE" | "MISSING" | "BLOCKED";
  readonly errorCode: string | null;
  readonly selectedPrefixSha256: string | null;
  readonly reportSha256: string | null;
  readonly members: readonly ContextManifestMember[];
  readonly earliestKnownAt: string | null;
  readonly latestKnownAt: string | null;
}

// Original source validators allow 20,000 headline observations and health rows,
// 1,000 Treasury/BTC retrievals each, and 366 BLS/FOMC retrievals each.
export const CONTEXT_MANIFEST_MAX_MEMBERS = 42_732;
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/** Exact local membership only; a reconstruction is not a saved prospective receipt. */
export function buildOptionsContextManifest(histories: ContextCutoffHistoriesV2, cutoffAt: string, constructedAt: string) {
  // The existing engine validates complete histories, including later records.
  // A corrupt later record must block its entire component before membership selection.
  const reconstruction = reconstructOptionsContextV2(histories, cutoffAt, constructedAt);
  let memberCount = 0;
  const components: ContextManifestComponent[] = CONTEXT_CUTOFF_SOURCES_V2.map(source => {
    const original = reconstruction.context.components[source];
    const members: ContextManifestMember[] = [];
    function add(records: readonly { observedAt?: string | null; receivedAt?: string }[],
      category: ContextManifestMember["category"], clockBasis: ContextManifestMember["clockBasis"]) {
      records.forEach((record, recordIndex) => {
        const knownAt = record[clockBasis];
        if (knownAt == null || knownAt > cutoffAt) return;
        if (++memberCount > CONTEXT_MANIFEST_MAX_MEMBERS) throw Error("CONTEXT_MANIFEST_MEMBER_LIMIT");
        members.push({ source, category, recordIndex, recordSha256: readinessFingerprint(record), knownAt, clockBasis });
      });
    }
    if (original.state === "AVAILABLE") {
      if (source === "headlines") {
        const history = histories.headlines;
        if (history.state === "AVAILABLE") {
          add(history.payload.observations, "observation", "observedAt");
          add(history.payload.health, "health", "observedAt");
        }
      } else {
        const history = histories[source];
        if (history.state === "AVAILABLE") add(history.payload, "retrieval", "receivedAt");
      }
    }
    let earliestKnownAt: string | null = null, latestKnownAt: string | null = null;
    for (const member of members) {
      if (earliestKnownAt === null || member.knownAt < earliestKnownAt) earliestKnownAt = member.knownAt;
      if (latestKnownAt === null || member.knownAt > latestKnownAt) latestKnownAt = member.knownAt;
    }
    return { source, state: original.state, errorCode: original.errorCode,
      selectedPrefixSha256: original.selectedPrefixSha256, reportSha256: original.reportSha256,
      members, earliestKnownAt, latestKnownAt };
  });
  const manifest = { version: "OPTIONS_CONTEXT_MEMBER_MANIFEST_V1", cutoffAt,
    contextSha256: reconstruction.contextSha256, components, memberCount,
    identityBasis: "SOURCE_CATEGORY_ORIGINAL_INDEX_AND_CANONICAL_RECORD_HASH",
    knowledgeBasis: "STORED_RECEIPT_OR_DISCOVERY_TIME",
    historicalDecisionProven: false, publisherVintageAuthenticated: false,
    journalAppendTimesKnown: false, globalKnowledgeCoverageComplete: false,
    prospectiveCaptureReceipt: false, payloadSavedAt: null, executionAllowed: false, replayAllowed: false };
  const body = { reconstruction, manifest, manifestSha256: readinessFingerprint(manifest) };
  return freeze({ ...body, artifactSha256: readinessFingerprint(body) });
}
