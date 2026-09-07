import type { OptionsSamplePartitionInput } from "./OptionsSamplePartition";

export interface OptionsResearchProtocolDeclaration {
  readonly version: "OPTIONS_RESEARCH_PROTOCOL_DECLARATION_V1";
  readonly protocolId: string;
  readonly datasetId: string;
  readonly origin: OptionsSamplePartitionInput["origin"];
  readonly strategyVersion: string;
  readonly symbols: readonly ("GLD" | "IBIT")[];
  readonly featureDefinition: { readonly reference: string; readonly content: string };
  readonly outcomeDefinition: { readonly reference: string; readonly content: string };
  readonly windows: OptionsSamplePartitionInput["windows"];
  readonly minimumGapMs: number;
}
