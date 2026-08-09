import type { NewsSourceRegistration } from "../../contracts/OptionsNewsSourceRegistry";
import { FixtureNewsAdapterBase } from "./FixtureNewsAdapterBase";
export class FederalReserveNewsAdapter extends FixtureNewsAdapterBase { public readonly adapterName = "federal-reserve-news-adapter"; public constructor(source: NewsSourceRegistration) { super(source, "releases", "/newsevents/pressreleases.htm"); } }
