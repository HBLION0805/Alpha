/**
 * Journal entries without an `openedAt` (e.g. a resting/unfilled order saved before it fills) never opened a
 * position. Review and readiness code assumes `openedAt` is a timestamp string, so split those out first: they
 * are reported as 未成交/挂单 and count toward no closed-trade, P&L or readiness statistic.
 */
export function hasOpenedAt<T extends { openedAt?: unknown }>(e: T): e is T & { openedAt: string } {
  return typeof e?.openedAt === "string" && e.openedAt.trim().length > 0;
}

export function splitUnfilled<T extends { openedAt?: unknown }>(entries: readonly T[] | null | undefined): { filled: (T & { openedAt: string })[]; unfilled: T[] } {
  const filled: (T & { openedAt: string })[] = [], unfilled: T[] = [];
  for (const e of entries ?? []) (hasOpenedAt(e) ? filled : unfilled).push(e as never);
  return { filled, unfilled };
}

/** One markdown line naming the skipped entries, or "" when there are none. */
export function unfilledNote(unfilled: readonly { id?: unknown; symbol?: unknown }[]): string {
  if (!unfilled.length) return "";
  const names = unfilled.map((e, i) => `\`${typeof e.id === "string" && e.id ? e.id : typeof e.symbol === "string" && e.symbol ? e.symbol : `#${i + 1}`}\``).join("、");
  return `> 未成交/挂单 ${unfilled.length} 笔（无 openedAt，不计入已平仓、P&L 与准备度统计）：${names}`;
}
