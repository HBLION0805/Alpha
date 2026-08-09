import type { NewsSourceRegistration } from "../../contracts/OptionsNewsSourceRegistry";
import { FixtureNewsAdapterBase } from "./FixtureNewsAdapterBase";
export class FinnhubNewsAdapter extends FixtureNewsAdapterBase { public readonly adapterName = "finnhub-news-adapter"; public constructor(source: NewsSourceRegistration) { super(source, "articles", "/api/v1/company-news"); } }
