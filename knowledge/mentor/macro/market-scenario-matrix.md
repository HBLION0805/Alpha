# 市场情景对照（大佬，图片转录）

> Source: an image the mentor shared, transcribed verbatim (names and times removed). The original image is in the user's chat and is not stored in this repo.
> Source id: `mentor-scenario-matrix`. Implemented as a deterministic classifier in `src/macro/matrix.ts` (brief §1 【大佬情景对照】). The existing scenario engine (`scenarios.ts`) is kept and not replaced.

**市场情景对照**

| 情景 | 利率 | 油价 | 科技盈利 | 就业 |
|---|---|---|---|---|
| 牛市 | ↓ | ↓ | ↑（增长） | 好 |
| 轮动 | ↓ | ↓ | ↓（下滑） | 好 |
| 熊市·第一阶段 | ↑ | ↑ | ↑ | 好 |
| 熊市·第二阶段 | ↓ | ↑ | ↑ | 差 |
| 熊市·第三阶段 | ↓ | ↓ | ↓ | 很差（两个差评） |
