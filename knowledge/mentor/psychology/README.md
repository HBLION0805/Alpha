# 导师 交易心理 第一批 + 第二批（psych-batch-1 / psych-batch-2）

_原文部分逐字保存（只把作者名换成 [导师]、群友名换成 [群友]；链接保留）。每段的来源行号和 sha256 在 `<!-- verbatim … -->` 标记里，`manifest.json` + `test/psych.test.ts` 校验能逐字还原原文件。下面的「DK 整理」是 DK 写的，不是导师原话。_

## 来源说明（psych-batch-1.txt 第 1 行，逐字）

<!-- verbatim psych-batch-1.txt L1-L2 sha256=40e7100780091cbb -->
【来源说明：本文件由 DK 从聊天记录手工转录（原消息含图片，系统无法直接复制原文）。可能有个别字词与原文不一致，待用户提供原文 .txt 后逐字核对。】

<!-- /verbatim -->

## 主题文件

| 文件 | 主题 | 段数 | Alpha |
|---|---|---|---|
| [patience-and-overtrading.md](patience-and-overtrading.md) | 耐心、少交易与交易信心 | 8 | 周复盘 §八之四 交易信心；`info_midday_entry` |
| [position-sizing-after-wins.md](position-sizing-after-wins.md) | 仓位：补输盘、赚钱后缩仓、对冲基金心态 | 7 | `warn_add_to_loser_unconfirmed` / `warn_second_add_to_loser` / `warn_size_up_after_wins` / `warn_day_after_big_win` / `warn_pyramid_add_larger` |
| [stop-loss-and-ownership.md](stop-loss-and-ownership.md) | 止损、极端责任与边界感 | 4 | → stop-loss.md |
| [narrative-and-news.md](narrative-and-news.md) | 叙事、新闻与 72 小时原则 | 5 | `warn_72h_event` |
| [conviction-and-independence.md](conviction-and-independence.md) | 独立判断、Ticker 磁吸症与长期主义 | 8 | `info_ticker_magnetism` |
| [money-and-life.md](money-and-life.md) | 钱、生活与复利 | 11 | 文档 |
| [macro-thinking.md](macro-thinking.md) | 宏观二阶思维与事件生命周期 | 4 | 文档 → catalog psych-second-order |
| [options-call-time-put-price.md](options-call-time-put-price.md) | 期权：Call 要尊重时间，Put 要尊重价格 | 3 | `warn_put_strike_unrealistic`（Call 时间 = 已有 time_buffer） |
| [battlefield-and-uncertainty.md](battlefield-and-uncertainty.md) | 战场：兵法、不确定性与战术意识 | 5 | 文档 |
| [journal-and-outcome-bias.md](journal-and-outcome-bias.md) | 交易日记与结果偏误 | 1 | `paper journal` 6 问 + 赚钱但做错 |
| [why-new-members-lose.md](why-new-members-lose.md) | 为什么新人会亏钱（亏损归因） | 3 | 亏损归因 4 类 + 标签 |
| [mentor-routine-and-origin.md](mentor-routine-and-origin.md) | 导师的作息、周末作业与起步经历 | 9 | ROUTINE_WEEKLY.md 周末清单 |
| [video-the-trading-game.md](video-the-trading-game.md) | 视频摘要《The Trading Game》（DK 转述，**不是逐字稿**） | — | 链接自止损/亏损接受、耐心、仓位 |

## 图片（assets/，均 ≤400 KB）

- `36-stratagems-cover-mantian-guohai.jpg` — 炒股者需熟读兵法 · 瞒天过海 → [battlefield-and-uncertainty.md](battlefield-and-uncertainty.md)
- `36-stratagems-full-list.jpg` — 三十六计全表 → [battlefield-and-uncertainty.md](battlefield-and-uncertainty.md)
- `allocation-70-stocks-20-options-10-cash.jpg` — 资金分配饼图：70% 股票 / 20% 期权 / 10% 现金 → [money-and-life.md](money-and-life.md)
- `cognitive-bias-chart-5-categories.jpg` — 认知偏误图：判断 / 亏损 / 成功 / 群体 / 时间与概率 + 结果偏误 → [journal-and-outcome-bias.md](journal-and-outcome-bias.md)
- `gopro-nasdaq-delisting-warning.jpg` — Nasdaq warns GoPro again about stock delisting → [mentor-routine-and-origin.md](mentor-routine-and-origin.md)
- `realized-profit-pyramid-1.00-0.50-0.30-0.20.jpg` — 用已实现利润开下一笔：100/104/107/110 进场，仓位 1.00 → 0.50 → 0.30 → 0.20 → [position-sizing-after-wins.md](position-sizing-after-wins.md)
- `event-lifecycle-main-vs-secondary-trade.jpg` — 事件生命周期：主交易 vs 次交易 → [macro-thinking.md](macro-thinking.md)

## 去重

- 与已有知识重复的内容不复制，只在 DK 整理里链接：止损 → discipline/stop-loss.md；做空心法 → discipline/short-selling.md；七宗罪 → discipline/seven-sins.md；偏误 → knowledge/BIAS_QUESTIONS.md。
- catalog.json 里已有的 psych-* 条目（来源 owner-psychology*）之前没有存原文（部分原文丢失或只有概念）；现在加 source `mentor-psych-batch` 指向这里。

## 校验

- `manifest.json`：每个源文件的原始/脱敏 sha256、替换次数（不含名字），每段 {source, lines, topic, sha256}。
- `test/psych.test.ts`：段落逐字、行号连续全覆盖、拼接后 sha256 = 脱敏原文；psychology/ 下不出现作者名。
