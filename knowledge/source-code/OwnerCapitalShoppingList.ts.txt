// Owner-supplied research universe. This catalog is not a trading or allocation input.
export const OWNER_CAPITAL_SHOPPING_LIST_VERSION = 'OWNER_CAPITAL_SHOPPING_LIST_V1' as const;

export type OwnerCapitalInstrumentType = 'STOCK' | 'ETF';
export type OwnerCapitalStatus = 'WATCH' | 'EXCLUDED' | 'FUTURE_WATCH';
export type OwnerCapitalIdentityStatus = 'OWNER_SUPPLIED_PENDING_VERIFICATION' | 'VERIFIED';

export interface OwnerCapitalShoppingListEntry {
  symbol: string;
  displayName: string;
  instrumentType: OwnerCapitalInstrumentType;
  themes: string[];
  ownerStatus: OwnerCapitalStatus;
  identityStatus: OwnerCapitalIdentityStatus;
  notes: string;
}

export interface OwnerCapitalShoppingList {
  version: typeof OWNER_CAPITAL_SHOPPING_LIST_VERSION;
  source: 'OWNER_SUPPLIED';
  purpose: 'LONG_TERM_CAPITAL / STOCK_AND_ETF_RESEARCH';
  orderMeaning: 'OWNER_GROUPING_NOT_RANKING';
  executionAllowed: false;
  automaticExecution: false;
  allocationAllowed: false;
  orderPermission: false;
  entries: OwnerCapitalShoppingListEntry[];
}

const pending = 'OWNER_SUPPLIED_PENDING_VERIFICATION' as const;
const watchNote = 'Owner-supplied thematic research interest. Identity and investment case have not been independently verified.';
const stock = (symbol: string, displayName: string, themes: string[], notes = watchNote): OwnerCapitalShoppingListEntry =>
  ({symbol, displayName, instrumentType: 'STOCK', themes, ownerStatus: 'WATCH', identityStatus: pending, notes});
const etf = (symbol: string, displayName: string, themes: string[], notes = watchNote): OwnerCapitalShoppingListEntry =>
  ({symbol, displayName, instrumentType: 'ETF', themes, ownerStatus: 'WATCH', identityStatus: pending, notes});

const catalog: OwnerCapitalShoppingList = {
  version: OWNER_CAPITAL_SHOPPING_LIST_VERSION,
  source: 'OWNER_SUPPLIED',
  purpose: 'LONG_TERM_CAPITAL / STOCK_AND_ETF_RESEARCH',
  orderMeaning: 'OWNER_GROUPING_NOT_RANKING',
  executionAllowed: false,
  automaticExecution: false,
  allocationAllowed: false,
  orderPermission: false,
  entries: [
    stock('PLD', 'Prologis', ['LATIN_AMERICA_SECURITY_RESOURCES']),
    stock('FCX', 'Freeport-McMoRan', ['LATIN_AMERICA_SECURITY_RESOURCES']),
    stock('SLB', 'SLB', ['LATIN_AMERICA_SECURITY_RESOURCES']),
    stock('AVAV', 'AeroVironment', ['LATIN_AMERICA_SECURITY_RESOURCES']),
    stock('HII', 'Huntington Ingalls', ['LATIN_AMERICA_SECURITY_RESOURCES']),
    stock('PLTR', 'Palantir', ['LATIN_AMERICA_SECURITY_RESOURCES']),
    stock('GEO', 'GEO Group', ['LATIN_AMERICA_SECURITY_RESOURCES']),
    stock('KTOS', 'Kratos', ['DEFENSE_WAR']),
    stock('UMAC', 'Unusual Machines', ['DEFENSE_WAR']),
    stock('OLN', 'Olin', ['DEFENSE_WAR']),
    stock('UAL', 'United Airlines', ['POST_WAR_AVIATION_TRAVEL']),
    stock('DAL', 'Delta Air Lines', ['POST_WAR_AVIATION_TRAVEL']),
    stock('JBLU', 'JetBlue', ['POST_WAR_AVIATION_TRAVEL']),
    stock('AXP', 'American Express', ['POST_WAR_AVIATION_TRAVEL']),
    stock('DG', 'Dollar General', ['INFLATION_US_CONSUMER']),
    stock('COST', 'Costco', ['INFLATION_US_CONSUMER']),
    stock('SFD', 'Smithfield Foods', ['INFLATION_US_CONSUMER']),
    stock('V', 'Visa', ['INFLATION_US_CONSUMER']),
    stock('VITL', 'Vital Farms', ['AGRICULTURE_FOOD_SECURITY']),
    stock('MOS', 'Mosaic', ['AGRICULTURE_FOOD_SECURITY']),
    stock('CF', 'CF Industries', ['AGRICULTURE_FOOD_SECURITY']),
    stock('ADM', 'Archer-Daniels-Midland', ['AGRICULTURE_FOOD_SECURITY']),
    stock('PCAR', 'PACCAR', ['US_MANUFACTURING']),
    stock('SANM', 'Sanmina', ['US_MANUFACTURING', 'AI_INFRASTRUCTURE']),
    stock('FLR', 'Fluor', ['US_MANUFACTURING']),
    stock('LZB', 'La-Z-Boy', ['US_MANUFACTURING']),
    stock('ALB', 'Albemarle', ['ENERGY_STRATEGIC_RESOURCES']),
    stock('USAR', 'USA Rare Earth', ['ENERGY_STRATEGIC_RESOURCES']),
    stock('VLO', 'Valero', ['ENERGY_STRATEGIC_RESOURCES']),
    stock('VST', 'Vistra', ['AI_INFRASTRUCTURE']),
    stock('CEG', 'Constellation Energy', ['AI_INFRASTRUCTURE']),
    stock('NOK', 'Nokia', ['AI_INFRASTRUCTURE']),
    stock('DJT', 'Trump Media', ['AI_INFRASTRUCTURE']),
    stock('TSLA', 'Tesla', ['ROBOTICS']),
    stock('CCXI', 'Churchill Capital XI / Agility Robotics', ['ROBOTICS'],
      'Owner-supplied CCXI / Agility Robotics relationship; not independently verified. Identity and tradability remain pending verification.'),
    {
      symbol: 'AGLT', displayName: 'AGLT (Owner-expected future ticker)', instrumentType: 'STOCK',
      themes: ['ROBOTICS'], ownerStatus: 'FUTURE_WATCH', identityStatus: pending,
      notes: 'Future expected ticker supplied by Owner. Security identity and tradability are not accepted; not currently actionable.',
    },
    stock('RXST', 'RxSight', ['HEALTHCARE_LONGEVITY']),
    stock('BIOA', 'BioAge Labs', ['HEALTHCARE_LONGEVITY']),
    stock('DHR', 'Danaher', ['HEALTHCARE_LONGEVITY']),
    stock('BSX', 'Boston Scientific', ['HEALTHCARE_LONGEVITY']),
    etf('ILF', 'Latin America ETF', ['LATIN_AMERICA']),
    etf('SHLD', 'Global X Defense Tech ETF', ['DEFENSE']),
    etf('PPA', 'Invesco Aerospace & Defense ETF / SPADE Defense Index', ['DEFENSE']),
    etf('JETS', 'U.S. Global Jets ETF', ['POST_WAR_AVIATION_ENERGY']),
    etf('USOY', 'Defiance Oil Enhanced Options Income ETF', ['POST_WAR_AVIATION_ENERGY']),
    etf('XLE', 'Energy Select Sector SPDR Fund', ['ENERGY']),
    etf('JEPQ', 'JPMorgan Nasdaq Equity Premium Income ETF', ['AI_TECHNOLOGY']),
    etf('UFO', 'Procure Space ETF', ['SPACE_ECONOMY']),
    {
      symbol: 'NTR', displayName: 'Nutrien', instrumentType: 'STOCK', themes: [],
      ownerStatus: 'EXCLUDED', identityStatus: pending,
      notes: 'Owner currently excludes NTR from the core Capital Shopping List; this does not affect other Alpha uses.',
    },
    {
      symbol: 'SPCX', displayName: 'SPCX', instrumentType: 'ETF', themes: [],
      ownerStatus: 'EXCLUDED', identityStatus: pending,
      notes: 'Owner currently considers single-space-company concentration too high and prefers UFO for space exposure. This judgment is Owner-supplied, not independently verified. Exclusion applies only to this list.',
    },
  ],
};

export function ownerCapitalShoppingList(): OwnerCapitalShoppingList {
  return structuredClone(catalog);
}

export function ownerCapitalShoppingListEntry(symbol: string): OwnerCapitalShoppingListEntry | null {
  const entry = catalog.entries.find(item => item.symbol === symbol);
  return entry === undefined ? null : structuredClone(entry);
}
