import { xmlTree, treasuryClock } from "../options-treasury/TreasuryRealYieldEngine";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";

export const MACRO_IDS = ["nominal", "dollar", "nowcast"] as const;
export type MacroId = typeof MACRO_IDS[number];
export const MACRO_MAX_BYTES = 524288;
export const MACRO_ERRORS = ["NETWORK_FAILED", "NETWORK_ACCESS_DENIED", "DEADLINE", "HTTP_STATUS", "CONTENT_TYPE", "BODY_LIMIT", "BODY_MISSING", "UTF8", "SOURCE_SCHEMA"] as const;
const fail = (): never => { throw Error("MACRO_SOURCE_SCHEMA"); };
export function macroUrl(id: MacroId, at: string) {
  treasuryClock(at);
  if (id === "nominal") return "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=" + exchangeLocalDate(at, "America/New_York").slice(0, 7).replace("-", "");
  if (id === "dollar") return "https://www.federalreserve.gov/releases/h10/current/";
  if (id === "nowcast") return "https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting";
  return fail();
}
export function macroDecimal(value: string, decimals: number): number | null {
  if (value === "" || value === "ND") return null;
  const m = /^(-?)(\d{1,6})(?:\.(\d+))?$/.exec(value);
  if (!m || (m[3]?.length ?? 0) > decimals) return fail();
  const units = Number(m[2]) * 10 ** decimals + Number((m[3] ?? "").padEnd(decimals, "0"));
  return units === 0 ? 0 : m[1] ? -units : units;
}
function date(value: string) {
  treasuryClock(value + "T00:00:00.000Z"); return value;
}
type Xml = ReturnType<typeof xmlTree>;
function one(node: Xml, name: string) { const nodes=node.children.filter(n=>n.name===name);if(nodes.length!==1)return fail();return nodes[0]!; }
function leaf(node: Xml) { if(node.children.length)return fail();return node.text.trim(); }
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthNumber(value: string) { const i=months.indexOf(value.slice(0,3));if(i<0)return fail();return i+1; }
const pad = (n: number | string) => String(n).padStart(2,"0");
function htmlText(value: string) {
  if (/<(?:script|style|table)\b/i.test(value))return fail();
  const s=value.replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
  if (s.includes("&") && /&(?:#|[a-z]+;)/i.test(s))return fail();return s;
}
function tables(html: string) {
  const result=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(m=>m[1]!);
  if(result.length>20)return fail();return result;
}
function rows(table: string) {
  const result=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1]!.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(c=>htmlText(c[1]!)));
  if(result.length>100)return fail();return result;
}
function single<T>(values: T[]) { if(values.length!==1)return fail();return values[0]!; }

export function parseNominal(source: string, at: string) {
  const root=xmlTree(source),today=exchangeLocalDate(at,"America/New_York");
  if(root.name!=="feed" || root.attrs.xmlns!=="http://www.w3.org/2005/Atom" || root.attrs["xmlns:d"]!=="http://schemas.microsoft.com/ado/2007/08/dataservices" || root.attrs["xmlns:m"]!=="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" || leaf(one(root,"title"))!=="DailyTreasuryYieldCurveRateData")return fail();
  const entries=root.children.filter(n=>n.name==="entry");if(entries.length>31)return fail();
  const seen=new Set(),ids=new Set();
  const data=entries.map(entry=>{
    if(one(entry,"category").attrs.term!=="TreasuryDataWarehouseModel.DailyTreasuryYieldCurveRateDatum")return fail();
    const p=one(one(entry,"content"),"m:properties"),d=leaf(one(p,"d:NEW_DATE"));
    if(!/^\d{4}-\d\d-\d\dT00:00:00$/.test(d))return fail();
    const sourceDate=date(d.slice(0,10)),id=leaf(one(p,"d:Id"));
    if(!/^\d+$/.test(id)||seen.has(sourceDate)||ids.has(id)||sourceDate>today||sourceDate.slice(0,7)!==today.slice(0,7))return fail();seen.add(sourceDate);ids.add(id);
    const ratesBps: Record<string,number|null>={};
    for(const tenor of [2,5,10,30]) {const cell=one(p,`d:BC_${tenor}YEAR`),value=leaf(cell);if(cell.attrs["m:type"]!=="Edm.Double")return fail();if(cell.attrs["m:null"]!==undefined){if(cell.attrs["m:null"]!=="true"||value)return fail();ratesBps[tenor]=null;}else {if(!value)return fail();ratesBps[tenor]=macroDecimal(value,2);}}
    return {sourceDate,ratesBps};
  }).sort((a,b)=>a.sourceDate.localeCompare(b.sourceDate));
  return {kind:"DAILY_NOMINAL_PAR_YIELDS",units:"BASIS_POINTS_OF_ANNUAL_PERCENT",rows:data,publicationAt:null};
}
export function parseDollar(source: string, at: string) {
  const visible=source.replace(/<script\b[\s\S]*?<\/script>/gi,"<script></script>").replace(/<style\b[\s\S]*?<\/style>/gi,"<style></style>");
  const matches=[...visible.matchAll(/Release Date:\s*(?:<[^>]*>\s*)*([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/g)];
  const m=single(matches),releaseDate=date(`${m[3]}-${pad(monthNumber(m[1]!))}-${pad(m[2]!)}`),today=exchangeLocalDate(at,"America/New_York");
  if(releaseDate>today)return fail();
  const table=single(tables(visible).filter(t=>/1\)\s*BROAD/.test(t))),r=rows(table);
  const header=single(r.filter(v=>v[0]==="COUNTRY"&&v[1]==="CURRENCY"));if(header.length!==7)return fail();
  const dates=header.slice(2).map(v=>{const h=/^([A-Z][a-z]{2})\.? (\d{1,2})$/.exec(v);if(!h)return fail();const mon=monthNumber(h[1]!);let year=Number(m[3]);if(mon>Number(releaseDate.slice(5,7)))year--;const d=date(`${year}-${pad(mon)}-${pad(h[2]!)}`),lag=(Date.parse(releaseDate)-Date.parse(d))/86400000;if(lag<0||lag>14)return fail();return d;});
  if(new Set(dates).size!==5||dates.some((d,i)=>i>0&&d<=dates[i-1]!))return fail();
  const broad=single(r.filter(v=>v[0]==="1) BROAD")),eur=single(r.filter(v=>v[0]==="*EMU MEMBERS")),yen=single(r.filter(v=>v[0]==="JAPAN"));
  if(broad[1]!=="JAN06=100"||eur[1]!=="EURO"||yen[1]!=="YEN"||[broad,eur,yen].some(v=>v.length!==7))return fail();
  return {kind:"H10_BROAD_DOLLAR_NOT_DXY",releaseDate,publicationAt:null,rows:dates.map((sourceDate,i)=>({sourceDate,
    broadIndexE4:macroDecimal(broad[i+2]!,4),usdPerEuroE4:macroDecimal(eur[i+2]!,4),yenPerUsdE4:macroDecimal(yen[i+2]!,4)})),
    units:"INDEX_JAN2006_100_AND_FX_SCALED_10000",frequency:"DAILY_OBSERVATIONS_WEEKLY_RELEASE"};
}
export function parseNowcast(source: string, at: string) {
  const visible=source.replace(/<script\b[\s\S]*?<\/script>/gi,"<script></script>").replace(/<style\b[\s\S]*?<\/style>/gi,"<style></style>"),all=tables(visible);
  const output: {period:string;metric:string;valueBps:number|null;updatedMonthDay:string;seasonalAdjustment:string}[]=[];
  for(const [caption,change] of [["Inflation, month-over-month percent change","MOM"],["Inflation, year-over-year percent change","YOY"]]) {
    const table=single(all.filter(t=>htmlText(single([...t.matchAll(/<caption\b[^>]*>([\s\S]*?)<\/caption>/gi)])[1]!)===caption));
    const head=single([...table.matchAll(/<thead\b[^>]*>([\s\S]*?)<\/thead>/gi)])[1]!;
    if(JSON.stringify(rows(head))!==JSON.stringify([["Month","CPI","Core CPI","PCE","Core PCE","Updated"]]))return fail();
    const body=single([...table.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)])[1]!,seen=new Set();
    const values=rows(body);if(!values.length||values.length>3)return fail();
    for(const r of values) {
      const p=/^([A-Z][a-z]+) (\d{4})$/.exec(r[0]??""),updated=r[5]??"";
      if(r.length!==6||!p||!/^\d\d\/\d\d$/.test(updated))return fail();date(`2000-${updated.replace("/","-")}`);
      const period=`${p[2]}-${pad(monthNumber(p[1]!))}`;date(period+"-01");
      if(period>exchangeLocalDate(at,"America/New_York").slice(0,7)||seen.has(period))return fail();seen.add(period);
      ["CPI","CORE_CPI","PCE","CORE_PCE"].forEach((metric,i)=>output.push({period,metric:metric+"_"+change,valueBps:macroDecimal(r[i+1]!,2),updatedMonthDay:updated,seasonalAdjustment:change==="YOY"&&metric.includes("CPI")?"NSA":"SA"}));
    }
  }
  return {kind:"MODEL_NOWCAST_NOT_CONSENSUS",units:"HUNDREDTHS_OF_PERCENT_CHANGE",rows:output,publicationAt:null,updateYearAndTimeKnown:false,
    blankMeaning:"No model value displayed; not an official actual",ppiCoverage:"NOT_PROVIDED"};
}
export function parseMacroSource(id: MacroId, source: string, at: string) {
  treasuryClock(at);
  if(typeof source!=="string"||!source.length||new TextEncoder().encode(source).length>MACRO_MAX_BYTES||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source))return fail();
  if(id==="nominal")return parseNominal(source,at);
  if(id==="dollar")return parseDollar(source,at);
  if(id==="nowcast")return parseNowcast(source,at);
  return fail();
}
