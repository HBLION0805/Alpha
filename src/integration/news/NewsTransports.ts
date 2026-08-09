import { NewsTransportMode, type NewsFixtureTransport, type NewsTransportRequest } from "../../contracts/OptionsNewsProvider";

export class StaticNewsFixtureTransport implements NewsFixtureTransport {
  public constructor(private readonly fixtures: Readonly<Record<string, unknown>>) {}
  public execute(request: NewsTransportRequest): unknown {
    if (request.mode !== NewsTransportMode.Fixture || request.networkEnabled !== false || request.credentialsRequired) throw new Error("FIXTURE_TRANSPORT_BOUNDARY_VIOLATION");
    const value = this.fixtures[request.providerId];
    if (value === undefined) throw new Error(`FIXTURE_NOT_FOUND: ${request.providerId}`);
    return structuredClone(value);
  }
}

export class DryRunNewsTransport implements NewsFixtureTransport {
  public execute(request: NewsTransportRequest): unknown {
    if (request.mode !== NewsTransportMode.DryRun || request.networkEnabled !== false) throw new Error("DRY_RUN_BOUNDARY_VIOLATION");
    return { dryRun: true, request: structuredClone(request) };
  }
}

export class DisabledLiveNewsTransport implements NewsFixtureTransport {
  public execute(_request: NewsTransportRequest): never { throw new Error("NETWORK_BLOCKED: live news transport requires separate Owner approval"); }
}
