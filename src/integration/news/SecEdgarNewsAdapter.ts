import type { NewsSourceRegistration } from "../../contracts/OptionsNewsSourceRegistry";
import { FixtureNewsAdapterBase } from "./FixtureNewsAdapterBase";
export class SecEdgarNewsAdapter extends FixtureNewsAdapterBase { public readonly adapterName = "sec-edgar-news-adapter"; public constructor(source: NewsSourceRegistration) { super(source, "filings", "/submissions/{cik}.json"); } }
