# 大佬短评 2026-10-19（周一 ~15:39 ET）：Meta 现金流 → 云跌芯片升

_原文字节级保存，未改写：[article.md](article.md)（原文没有作者名，没有删改）。`manifest.json` 记录 sha256，`test/eventfollowup.test.ts` 校验。下面的「DK 整理」不是原文。_

## DK 整理（不是原文）
- 事件：META 财报，周三 2026-10-21 盘后；EPS 预估 5.89（Robinhood）。
- 大佬判断：如果 Meta 现金流 / 资本开支出问题 → 云 / AI 基建（CRWV、NBIS、ORCL）跌，芯片（NVDA、AVGO）涨；有心理准备，不要大赌。
- 接线（只显示）：[knowledge/events/event-followups.json](../../../events/event-followups.json) → `src/macro/eventFollowup.ts`：
  - 10/21 简报和 10/21 晚间事件提醒（18/20/22 ET）：财报区块；结果出来后显示实际 EPS / 营收 / capex / FCF（有就显示）和盘后涨跌；
  - 10/22 7:30 简报：比较云篮子 vs 芯片篮子的盘前涨跌 → 应验 / 未应验 / 混合；
  - 10/22 之后自动过期。不产生交易，不发额外警报，不改 NO_TRADE、仓位或「能不能睡」。
