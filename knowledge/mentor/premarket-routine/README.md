# 盘前流程（视频）premarket-routine

_原文字节级保存，未改写。`manifest.json` 记录 sha256，`test/oilvix.test.ts` / `test/sleepday.test.ts` 校验。**转录稿由视频模型生成，未与原视频逐字核对**（见文件开头的来源说明）。视频本身（约 70 MB）不放进仓库。下面的「DK 整理」是 DK 写的，不是原文。_

| 文件 | 内容 | Alpha |
|---|---|---|
| [oil-vix-2026-10-18.md](oil-vix-2026-10-18.md) | 导师盘前视频：原油与 VIX（约 2:47；作者名已去除） | 简报 【用户要求】原油：变化速度 + 驱动判断 + 承压板块（`src/macro/oilvix.ts`）；简报 VIX 与指数确认；导师提醒 `oil_speed` / `vix_confirm` / `oil_squeeze`（`src/review/mentor.ts`）；VIX 看涨期权对冲 = 第二阶段参考（catalog `phase2-vix-call-hedge`，未启用） |
| [sleep-days-2026-10-18.md](sleep-days-2026-10-18.md) | 导师帖子：不能睡 / 可以睡的日子（原文照存，没有加标题；「老川」= 川普，用户注：指川普要放大招） | 简报 §1「今日能不能睡」（`src/macro/sleepday.ts`，只标记，不改变结论）；NYSE 假日表 `src/macro/nyse.ts`；规则 [docs/SLEEP_DAYS.md](../../../docs/SLEEP_DAYS.md) |

原有的盘前流程系列在 [../discipline/premarket-routine.md](../discipline/premarket-routine.md)（`src/macro/premarket.ts`）。

## DK 整理（不是原文）
- 原油：看价格、变化速度和原因。简报给出 1日/5日 变化、快速变动标记、需求 vs 供应的**启发式**判断（可能为「无法判断」），供应冲击时提示航空（JETS）和可选消费（XLY）承压。规则：[docs/OIL_VIX.md](../../../docs/OIL_VIX.md)。
- VIX：不看单个高低数值，看 VIX 趋势和指数趋势是否互相确认 → 「方向确认」/「背离/未确认」。只标记，不改变结论。
- VIX 看涨期权对冲：只作为第二阶段对冲参考记录，**未启用**，不进练习规则。
- 能不能睡：不能睡 = OpEx（季度四巫日加强；OpEx 周加注）、FOMC 决议/主席记者会和联储官员讲话、川普 24 小时内的市场相关帖或新闻里预告的宣布；用户补充 CPI / 非农。可以睡 = 周一、7–8 月、12/24–1/1、感恩节当周、长周末前一天。冲突时不能睡优先，两边理由都列出。
