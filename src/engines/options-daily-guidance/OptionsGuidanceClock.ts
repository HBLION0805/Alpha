import { readinessClock } from "../options-readiness/OptionsReadinessEngine";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";

export function guidanceLocal(at: string) {
  readinessClock(at);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(at)).map(v=>[v.type,v.value]));
  return { date: exchangeLocalDate(at,"America/New_York"), minute:Number(p.hour)*60+Number(p.minute), weekday:p.weekday };
}
