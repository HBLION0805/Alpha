import type { NewsSourceRegistration } from "../../contracts/OptionsNewsSourceRegistry";
import { FixtureNewsAdapterBase } from "./FixtureNewsAdapterBase";
export class AlphaVantageNewsAdapter extends FixtureNewsAdapterBase { public readonly adapterName = "alpha-vantage-news-adapter"; public constructor(source: NewsSourceRegistration) { super(source, "feed", "/query?function=NEWS_SENTIMENT"); } }
