import { createHash } from "node:crypto";
import { canonicalizeDeterministicValue } from "../../contracts/DeterministicFingerprint";
import { assessReleaseCalendar, RELEASE_CALENDAR_URL, type ReleaseCalendarInput } from "../options-release-calendar/BlsReleaseCalendarEngine";
import { assessFomcCalendar, FOMC_CALENDAR_URL, type FomcCalendarInput } from "../options-fomc-calendar/FomcCalendarEngine";

export const WEEKLY_PLAN_VERSION = "OPTIONS_WEEKLY_PLAN_V1" as const;
export const WEEKLY_EVENT_CATEGORIES = ["ECONOMIC_DATA", "CENTRAL_BANK", "EARNINGS", "COMPANY_EVENT", "CONFERENCE", "TREASURY_OR_FISCAL", "POLICY_GEOPOLITICAL", "OPTIONS_MARKET", "OTHER_SCHEDULED_EVENT", "UNSCHEDULED_NEWS_WATCH"] as const;
export const WEEKLY_COVERAGE_KEYS = ["macroDataCoverage", "centralBankCoverage", "earningsCoverage", "companyEventCoverage", "conferenceCoverage", "treasuryFiscalCoverage", "policyGeopoliticalCoverage", "optionsMarketCoverage", "newsRiskCoverage"] as const;
export type WeeklyCategory = typeof WEEKLY_EVENT_CATEGORIES[number];
export type WeeklyCoverageState = "REVIEWED" | "MISSING_SOURCE" | "UNKNOWN" | "NOT_APPLICABLE";
export type WeeklyPrecision = "EXACT_TIME" | "DATE_ONLY" | "DATE_RANGE" | "UNKNOWN";
export type WeeklySourceCharacter = "OFFICIAL_SAVED" | "OWNER_DECLARED" | "UNVERIFIED";
export interface WeeklyEvent {
  eventId: string; category: WeeklyCategory; title: string; startAt: string | null; endAt: string | null;
  timezone: string; timePrecision: WeeklyPrecision; sourceId: string; sourceRef: string | null;
  retrievedAt: string | null; publishedAt: string | null; affectedSymbols: string[]; affectedThemes: string[];
  notes: string; status: string; sourceCharacter: WeeklySourceCharacter;
}
export interface WeeklySourceHistory<T> { state: "AVAILABLE" | "MISSING" | "BLOCKED"; inputs: readonly T[] | null; errorCode: string | null }
export interface WeeklyNewsContext { title: string; sourceId: string; sourceRef: string | null; publishedAt: string | null; retrievedAt: string }
export interface WeeklyReferenceEvidence { id: string; kind: "EVENT_RESEARCH" | "MANUAL_PLAN_DRAFT"; sourcePath: string; savedAt: string; sourceFingerprint: string }
export interface WeeklyPlanComposeInput {
  assessedAt: string; weekStartDate?: string; bls: WeeklySourceHistory<ReleaseCalendarInput>; fomc: WeeklySourceHistory<FomcCalendarInput>;
  manualEvents?: readonly WeeklyEvent[]; newsWatch?: readonly string[]; newsContext?: readonly WeeklyNewsContext[]; newsEvidenceAvailable?: boolean;
  notes?: string; noTradeConditions?: readonly string[]; eventResearchRefs?: readonly string[]; referenceEvidence?: readonly WeeklyReferenceEvidence[];
  monitoredAssets?: readonly { symbol: string; themes: readonly string[]; ownerStatus: string; identityStatus: string }[];
}
const fail = (code: string): never => { throw Error("WEEKLY_PLAN_" + code); };
export const weeklyFingerprint = (value: unknown): string => createHash("sha256").update(canonicalizeDeterministicValue(value)).digest("hex");
const freeze = <T>(value: T): T => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const dateRe = /^20\d{2}-\d{2}-\d{2}$/;
function date(value: unknown): string {
  if (typeof value !== "string" || !dateRe.test(value) || !Number.isFinite(Date.parse(value + "T00:00:00.000Z")) || new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) !== value) fail("DATE");
  return value as string;
}
function clock(value: unknown): string {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail("CLOCK");
  return value as string;
}
function addDays(value: string, days: number): string { return new Date(Date.parse(date(value) + "T00:00:00.000Z") + days * 86400000).toISOString().slice(0, 10); }
function newYorkDate(at: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(clock(at))).map(p => [p.type,p.value]));
  return date(`${parts.year}-${parts.month}-${parts.day}`);
}
export function weekForAt(at: string): { weekStartDate: string; weekEndDate: string } {
  const today = newYorkDate(at), day = new Date(today + "T00:00:00.000Z").getUTCDay();
  const monday = addDays(today, day === 0 ? 1 : day === 6 ? 2 : 1 - day);
  return {weekStartDate:monday,weekEndDate:addDays(monday,4)};
}
export function weekForStart(weekStartDate: string): { weekStartDate: string; weekEndDate: string } {
  date(weekStartDate);
  if (new Date(weekStartDate + "T00:00:00.000Z").getUTCDay() !== 1) fail("WEEK_START");
  return {weekStartDate,weekEndDate:addDays(weekStartDate,4)};
}
function shortText(value: unknown, limit = 1000): string {
  if (typeof value !== "string" || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail("TEXT");
  return value as string;
}
function textArray(value: unknown, limit: number, itemLimit = 200): string[] {
  if (!Array.isArray(value) || value.length > limit) fail("ARRAY");
  return (value as unknown[]).map((v:unknown) => shortText(v,itemLimit));
}
function exactKeys(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) fail("FIELDS");
  return value as Record<string, unknown>;
}
const eventKeys = ["eventId","category","title","startAt","endAt","timezone","timePrecision","sourceId","sourceRef","retrievedAt","publishedAt","affectedSymbols","affectedThemes","notes","status","sourceCharacter"] as const;
export function validateWeeklyEvent(value: unknown, manual = false): WeeklyEvent {
  const e = exactKeys(value,eventKeys);
  if (typeof e.eventId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,159}$/.test(e.eventId)) fail("EVENT_ID");
  if (!WEEKLY_EVENT_CATEGORIES.includes(e.category as WeeklyCategory) || manual && e.category === "UNSCHEDULED_NEWS_WATCH") fail("CATEGORY");
  const title = shortText(e.title,400); if (!title.trim()) fail("TITLE");
  if (e.timezone !== "America/New_York" && e.timezone !== "US-Eastern") fail("TIMEZONE");
  if (!["EXACT_TIME","DATE_ONLY","DATE_RANGE","UNKNOWN"].includes(e.timePrecision as string)) fail("PRECISION");
  if (e.timePrecision === "EXACT_TIME") { clock(e.startAt); if (e.endAt !== null) clock(e.endAt); }
  else if (e.timePrecision === "DATE_ONLY") { date(e.startAt); if (e.endAt !== null) fail("DATE_ONLY_END"); }
  else if (e.timePrecision === "DATE_RANGE") { date(e.startAt); date(e.endAt); }
  else if (e.startAt !== null || e.endAt !== null) fail("UNKNOWN_TIME");
  if (e.endAt !== null && (e.startAt as string) > (e.endAt as string)) fail("EVENT_ORDER");
  const sourceId=shortText(e.sourceId,120); if (manual && !sourceId.trim()) fail("SOURCE_ID"); if (e.sourceRef !== null) shortText(e.sourceRef,2000);
  if (e.retrievedAt !== null) clock(e.retrievedAt); if (e.publishedAt !== null) clock(e.publishedAt);
  if (typeof e.publishedAt === "string" && typeof e.retrievedAt === "string" && e.publishedAt > e.retrievedAt) fail("SOURCE_CLOCK_ORDER");
  textArray(e.affectedSymbols,100,32); textArray(e.affectedThemes,100,120);
  shortText(e.notes,2000); shortText(e.status,100);
  if (manual && !["SCHEDULED_UNVERIFIED","UNVERIFIED","TENTATIVE"].includes(e.status as string)) fail("MANUAL_STATUS");
  if (!["OFFICIAL_SAVED","OWNER_DECLARED","UNVERIFIED"].includes(e.sourceCharacter as string) || manual && e.sourceCharacter === "OFFICIAL_SAVED") fail("SOURCE_CHARACTER");
  return freeze(structuredClone(e) as unknown as WeeklyEvent);
}
function history<T>(value: WeeklySourceHistory<T>): void {
  exactKeys(value,["state","inputs","errorCode"]);
  if (value.state === "AVAILABLE" ? !Array.isArray(value.inputs) || value.errorCode !== null : value.inputs !== null || typeof value.errorCode !== "string" || !["MISSING","BLOCKED"].includes(value.state)) fail("SOURCE_STATE");
}
function sourceSummary<T extends { receivedAt: string; sourceText: string | null; errorCode: string | null }>(source: WeeklySourceHistory<T>, assessedAt: string, assess: (input:T)=>{status:string;sourceSha256:string|null}, url:string) {
  history(source);
  if (source.state !== "AVAILABLE") return {state:source.state,errorCode:source.errorCode,url,latestReceivedAt:null,lastKnownReceivedAt:null,sourceSha256:null,refreshOverdue:null,latestSuccessful:null as T|null};
  const inputs = source.inputs ?? [];
  if (inputs.length > 366) fail("SOURCE_LIMIT");
  let previous:string|null=null;
  for (const input of inputs) { assess(input); clock(input.receivedAt); if (input.receivedAt > assessedAt || previous !== null && input.receivedAt < previous) fail("SOURCE_ORDER"); previous=input.receivedAt; }
  const latest=inputs.at(-1)??null, lastKnown=[...inputs].reverse().find(i=>i.sourceText!==null)??null;
  const age = latest?.sourceText !== null && latest ? Date.parse(assessedAt)-Date.parse(latest.receivedAt) : null;
  return {state:"AVAILABLE" as const,errorCode:latest?.errorCode??null,url,latestReceivedAt:latest?.receivedAt??null,lastKnownReceivedAt:lastKnown?.receivedAt??null,
    sourceSha256:lastKnown?assess(lastKnown).sourceSha256:null,refreshOverdue:age===null||age>26*3600000,latestSuccessful:lastKnown};
}
function inWeek(e: WeeklyEvent, start: string, end: string): boolean {
  if (e.timePrecision === "UNKNOWN") return true;
  const begin = e.timePrecision === "EXACT_TIME" ? newYorkDate(e.startAt!) : e.startAt!;
  const finish = e.timePrecision === "DATE_RANGE" ? e.endAt! : e.timePrecision === "EXACT_TIME" && e.endAt ? newYorkDate(e.endAt) : begin;
  return begin <= end && finish >= start;
}
function eventSort(a: WeeklyEvent,b: WeeklyEvent): number {
  const aDate=a.startAt === null?"9999":a.timePrecision==="EXACT_TIME"?newYorkDate(a.startAt):a.startAt;
  const bDate=b.startAt === null?"9999":b.timePrecision==="EXACT_TIME"?newYorkDate(b.startAt):b.startAt;
  return aDate.localeCompare(bDate)|| (a.timePrecision==="EXACT_TIME"?0:1)-(b.timePrecision==="EXACT_TIME"?0:1) || (a.startAt??"").localeCompare(b.startAt??"") || a.eventId.localeCompare(b.eventId);
}
export function buildWeeklyPlanPreview(input: WeeklyPlanComposeInput) {
  const assessedAt=clock(input.assessedAt), week=input.weekStartDate?weekForStart(input.weekStartDate):weekForAt(assessedAt);
  const bls=sourceSummary(input.bls,assessedAt,assessReleaseCalendar,RELEASE_CALENDAR_URL),fomc=sourceSummary(input.fomc,assessedAt,assessFomcCalendar,FOMC_CALENDAR_URL);
  const events:WeeklyEvent[]=[];
  if (bls.latestSuccessful) for (const e of assessReleaseCalendar(bls.latestSuccessful).events) {
    const event:WeeklyEvent={eventId:`BLS:${e.uid}`,category:"ECONOMIC_DATA",title:e.title,startAt:e.scheduledAt,endAt:null,timezone:"America/New_York",timePrecision:"EXACT_TIME",sourceId:"BLS_PUBLIC_RELEASE_CALENDAR",sourceRef:RELEASE_CALENDAR_URL,
      retrievedAt:bls.latestSuccessful.receivedAt,publishedAt:null,affectedSymbols:[],affectedThemes:[],notes:`ICS DTSTAMP: ${e.sourceStampAt??"unknown"}; LAST-MODIFIED: ${e.sourceModifiedAt??"unknown"}; original publication time unknown`,status:e.status,sourceCharacter:"OFFICIAL_SAVED"};
    if (inWeek(event,week.weekStartDate,week.weekEndDate)) events.push(validateWeeklyEvent(event));
  }
  if (fomc.latestSuccessful) for (const e of assessFomcCalendar(fomc.latestSuccessful).calendar?.meetings??[]) {
    const event:WeeklyEvent={eventId:`FOMC:${weeklyFingerprint(e.dateKey).slice(0,32)}`,category:"CENTRAL_BANK",title:e.kind==="NOTATION_VOTE"?"FOMC notation vote date":e.kind==="UNSCHEDULED"?"FOMC unscheduled meeting date":"FOMC meeting dates",startAt:e.startDate,endAt:e.startDate===e.endDate?null:e.endDate,timezone:"America/New_York",timePrecision:e.startDate===e.endDate?"DATE_ONLY":"DATE_RANGE",sourceId:"FEDERAL_RESERVE_PUBLIC_MEETING_CALENDAR",sourceRef:FOMC_CALENDAR_URL,
      retrievedAt:fomc.latestSuccessful.receivedAt,publishedAt:null,affectedSymbols:[],affectedThemes:[],notes:`Page updated date: ${assessFomcCalendar(fomc.latestSuccessful).calendar?.pageUpdatedDate??"unknown"}; original event publication and intraday time unknown; independent confirmation unknown${e.projectionMarker?"; source marks Summary of Economic Projections":""}`,status:e.confirmationStatus,sourceCharacter:"OFFICIAL_SAVED"};
    if (inWeek(event,week.weekStartDate,week.weekEndDate)) events.push(validateWeeklyEvent(event));
  }
  if ((input.manualEvents?.length??0)>100) fail("MANUAL_LIMIT");
  for (const item of input.manualEvents??[]) { const e=validateWeeklyEvent(item,true); if (e.retrievedAt!==null&&e.retrievedAt>assessedAt || e.publishedAt!==null&&e.publishedAt>assessedAt) fail("MANUAL_FUTURE_SOURCE"); if (!inWeek(e,week.weekStartDate,week.weekEndDate)) fail("MANUAL_EVENT_OUTSIDE_WEEK"); events.push(e); }
  const ids=new Set<string>(); for (const e of events) { if (ids.has(e.eventId)) fail("DUPLICATE_EVENT_ID"); ids.add(e.eventId); }
  events.sort(eventSort);
  const coverage:Record<typeof WEEKLY_COVERAGE_KEYS[number],WeeklyCoverageState>={
    macroDataCoverage:input.bls.state==="MISSING"?"MISSING_SOURCE":input.bls.state==="AVAILABLE"&&!bls.refreshOverdue?"REVIEWED":"UNKNOWN",
    centralBankCoverage:input.fomc.state==="MISSING"?"MISSING_SOURCE":input.fomc.state==="AVAILABLE"&&!fomc.refreshOverdue?"REVIEWED":"UNKNOWN",
    earningsCoverage:"MISSING_SOURCE",companyEventCoverage:"MISSING_SOURCE",conferenceCoverage:"MISSING_SOURCE",treasuryFiscalCoverage:"MISSING_SOURCE",policyGeopoliticalCoverage:"MISSING_SOURCE",optionsMarketCoverage:"MISSING_SOURCE",newsRiskCoverage:input.newsEvidenceAvailable||input.newsContext?.length?"UNKNOWN":"MISSING_SOURCE"
  };
  const newsContext=(input.newsContext??[]).map(n=>{ exactKeys(n,["title","sourceId","sourceRef","publishedAt","retrievedAt"]);shortText(n.title,400);shortText(n.sourceId,120);if(n.sourceRef!==null)shortText(n.sourceRef,2000);if(n.publishedAt!==null)clock(n.publishedAt);clock(n.retrievedAt);if(n.retrievedAt>assessedAt)fail("NEWS_FUTURE");return structuredClone(n); }).sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt)||a.title.localeCompare(b.title)).slice(0,30);
  const newsWatch=textArray(input.newsWatch??[],30,300),unknowns=Object.entries(coverage).filter(([,v])=>v!=="REVIEWED").map(([k,v])=>`${k}: ${v}`);
  const noTradeConditions=["Weekly events are planning context only; a separate qualified trade plan and existing risk gates are required before entry.",
    "Wait when an event's source, timing, result or trade relevance remains unverified.",...textArray(input.noTradeConditions??[],30,400)];
  const eventResearchRefs=textArray(input.eventResearchRefs??[],30,160);
  const referenceEvidence=(input.referenceEvidence??[]).map(r=>{
    exactKeys(r,["id","kind","sourcePath","savedAt","sourceFingerprint"]);
    if(!eventResearchRefs.includes(shortText(r.id,160))||!["EVENT_RESEARCH","MANUAL_PLAN_DRAFT"].includes(r.kind))fail("REFERENCE_EVIDENCE");
    shortText(r.sourcePath,400);clock(r.savedAt);shortText(r.sourceFingerprint,100);
    if(r.savedAt>assessedAt)fail("REFERENCE_FUTURE");
    return structuredClone(r);
  }).sort((a,b)=>a.id.localeCompare(b.id)||a.kind.localeCompare(b.kind));
  if(new Set(referenceEvidence.map(r=>r.id)).size!==referenceEvidence.length)fail("DUPLICATE_REFERENCE");
  const monitoredAssets=(input.monitoredAssets??[]).map(a=>({symbol:shortText(a.symbol,32),themes:textArray(a.themes,30,120),ownerStatus:shortText(a.ownerStatus,60),identityStatus:shortText(a.identityStatus,80)})).sort((a,b)=>a.symbol.localeCompare(b.symbol));
  const daily=[0,1,2,3,4].map(i=>{const day=addDays(week.weekStartDate,i),known=events.filter(e=>e.status!=="CANCELLED"&&e.timePrecision!=="UNKNOWN"&&inWeek(e,day,day));return {date:day,beforeMarket:known.map(e=>e.eventId),duringMarket:known.filter(e=>e.timePrecision==="EXACT_TIME").map(e=>e.eventId),afterMarket:known.map(e=>e.eventId),requiredEvidenceReview:unknowns};});
  const sourceEvidence={bls:{state:bls.state,errorCode:bls.errorCode,url:bls.url,latestReceivedAt:bls.latestReceivedAt,lastKnownReceivedAt:bls.lastKnownReceivedAt,sourceSha256:bls.sourceSha256,refreshOverdue:bls.refreshOverdue},fomc:{state:fomc.state,errorCode:fomc.errorCode,url:fomc.url,latestReceivedAt:fomc.latestReceivedAt,lastKnownReceivedAt:fomc.lastKnownReceivedAt,sourceSha256:fomc.sourceSha256,refreshOverdue:fomc.refreshOverdue}};
  const payload={version:WEEKLY_PLAN_VERSION,weekStartDate:week.weekStartDate,weekEndDate:week.weekEndDate,assessedAt,state:"DRAFT" as const,events,coverage,newsWatch,newsContext,monitoredAssets,unknowns,noTradeConditions,eventResearchRefs,referenceEvidence,notes:shortText(input.notes??"",4000),daily,sourceEvidence,sourceReads:0,executionAllowed:false as const};
  // A preview remains saveable across separate HTTP requests while its source evidence and owner draft stay unchanged.
  const {assessedAt: _assessedAt, ...stablePayload}=payload;
  return freeze({...payload,fingerprint:weeklyFingerprint(stablePayload)});
}
