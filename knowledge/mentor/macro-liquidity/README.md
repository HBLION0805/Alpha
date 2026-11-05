# 宏观流动性 macro-liquidity

_原文逐字保存（字节级拷贝，未改写）。`manifest.json` 记录每个文件的 sha256，`test/liquidity.test.ts` 校验。下面的「DK 整理」是 DK 写的，不是原文。_

## 文件

| 文件 | 内容 | 作者 | Alpha |
|---|---|---|---|
| [howell-2026-10-16-liquidity-cycle.md](howell-2026-10-16-liquidity-cycle.md) | 《投资者是否正接近2027年流动性周期的回升阶段？》2026-10-16，用户转发的中文译文，8 张图 | **Michael Howell**（已发表文章，保留署名） | 简报 §1.2 流动性观察（`src/macro/liquidity.ts`） |
| [mentor-review-howell-2026-10-16.md](mentor-review-howell-2026-10-16.md) | 导师读后感（作者名已去除，匿名；文中的 “Howell” 指文章作者） | [导师] | 简报 §1.2 原文一句；计划卡 + §1.1 导师提醒 `liquidity_chain`（`src/review/mentor.ts`） |

## 图片（assets/）

fig1 BTC 趋势与交易区间（200日/30日均线） · fig2 Central Bank Policy Heat Map 2020-26 · fig3 SOFR-IORB · fig4 'Excess' Reserves (+13wk) & BTC · fig5 US Domestic Liquidity (+9m) vs Yield Curve Slope · fig6 2-Year Yields and SOFR · fig7 SOFR less 2-Year (2020/23 vs 2024/26) · fig8 Global Liquidity Cycle 65-Month Wave

## DK 整理（不是原文）

- Howell 的检验：比特币要守住 7 万美元上方 → 简报里 BTC 日收盘 < 70,000 会报警。
- 导师的区分：“逆风可能正在减弱”≠“顺风已经到来”。Alpha 只标记前者为「逆风减弱（观察）」；「顺风确认」要求连续 4 周 + 更多确认（规则见 [docs/LIQUIDITY_WATCH.md](../../../docs/LIQUIDITY_WATCH.md)）。两者都只是标记，不产生交易信号。
- 计划卡：论点提到流动性 / 降息 / 转向 / 宽松 / liquidity / pivot / BTC 等 → 显示导师原话「宏观逻辑不能跳过中间环节，直接变成买单。」和「融资条件改善，可以和盈利疲软、衰退风险同时存在。」
