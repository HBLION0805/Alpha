/** Owner's September 12 change; the first affected weekday is September 14. */
export const GUIDANCE_SINGLE_WINDOW_FROM = '2026-09-13';
export const GUIDANCE_EVENT_MINUTES = Object.freeze([620, 680, 740, 800, 860, 920]);

export function isGuidanceMajorEvent(event: {source:string;title:string}): boolean {
  return event.source === 'FOMC' || /Consumer Price Index|Producer Price Index|Employment Situation|Job Openings|Personal Income|Gross Domestic/i.test(event.title);
}

export function guidanceFixedMinutes(date: string): number[] {
  return date >= GUIDANCE_SINGLE_WINDOW_FROM ? [950] : [590, 770, 950];
}

export function guidanceDeliveryScope(date: string): string {
  if (date < GUIDANCE_SINGLE_WINDOW_FROM) return 'Three fixed guidance windows only; event-dependent extra reads and full-chain close captures are separate. Captures are associated by time, not proof of scheduled execution.';
  return 'Fixed guidance at 15:50 New York from September 13, 2026; earlier dates retain 09:50, 12:50 and 15:50. Event-dependent extra reads and full-chain close captures are separate. Captures are associated by time, not proof of scheduled execution.';
}
