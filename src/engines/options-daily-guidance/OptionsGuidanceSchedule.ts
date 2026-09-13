/** Owner's September 12 change; the first affected weekday is September 14. */
export const GUIDANCE_SINGLE_WINDOW_FROM = '2026-09-13';

export function guidanceFixedMinutes(date: string): number[] {
  return date >= GUIDANCE_SINGLE_WINDOW_FROM ? [950] : [590, 770, 950];
}

export function guidanceDeliveryScope(date: string): string {
  if (date < GUIDANCE_SINGLE_WINDOW_FROM) return 'Three fixed guidance windows only; event-dependent extra reads and full-chain close captures are separate. Captures are associated by time, not proof of scheduled execution.';
  return 'Fixed guidance at 15:50 New York from September 13, 2026; earlier dates retain 09:50, 12:50 and 15:50. Event-dependent extra reads and full-chain close captures are separate. Captures are associated by time, not proof of scheduled execution.';
}
