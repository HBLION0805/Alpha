/** A research note only; this contract carries no supplied decision or outcome clock. */
export interface OptionsResearchObservationInput {
  readonly version: "OPTIONS_RESEARCH_OBSERVATION_INPUT_V1";
  readonly observationId: string;
  readonly protocolId: string;
  readonly captureId: string;
  readonly symbol: "GLD" | "IBIT";
  readonly disposition: "OBSERVE_ONLY" | "NO_TRADE";
  readonly reason: string;
}
