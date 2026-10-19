# Alpha：宏观交易决策助手

**目标：** 给一位交易者用的宏观交易决策辅助工具，按优先级排列：
1. 新闻与事件警报（核心）
2. 每日宏观简报：宏观先行，只出一个结论
3. 风险与纪律闸门：只做定义风险，有上限，NO_TRADE 是正常结果
4. 大佬知识库，为前三项提供依据

技术面只用于择时。所有输出都不是交易建议。

## 什么时候跑什么

| 时间（ET，工作日） | 内容 |
|---|---|
| 每 30 分钟（routine `alpha-2`，08:00–18:30） | `scripts/run.sh`：抓新闻 → 新警报 → 刷新简报 → 发消息给用户 |
| 07:30 / 16:30 | 每日中文简报 `data/out/brief-latest.md`：盘前版 / 收盘情景版 |
| 07:00–09:29、16:15–16:59 | 成交量异常 `data/out/volume-latest.md` |

Routine 读取：`brief-latest.md`、`brief-latest.json`（`verdict`、`scenarioChanged`）、`alerts-latest.md`、`volume-latest.md`（都在 `data/out/` 下）。

## 命令（Node 24+，`npm install` 后）

```bash
npm run brief        # 每日简报：宏观 + 盘前 + 情景 + 价位 + 日历，一个 verdict；--no-alarms
npm run alerts       # 新警报 → data/out/alerts-latest.md / alerts.jsonl（先 npm run poll 抓源）
npm run volume       # 成交量异常（只用于确认，不单独下单）
npm run levels       # 参考价位（只用于择时）
npm run paper -- open|close|list|mark   # 模拟交易：先唱反调 critique，WARN 需 --ack
npm run readiness    # 实盘准备度评分卡（只看模拟交易日志）
npm run options -- <chain.json> --proposal p.json   # 交易前检查 + 管理计划 + Kelly 上限 + 止盈表
npm run run          # = scripts/run.sh（routine 入口）
npm run validate     # typecheck + 测试
```

## 数据来源

- 新闻：RSS（`src/sources.ts`）；Alpaca 新闻可选（`ALPACA_KEY` / `ALPACA_SECRET`）
- 川普发帖：Truth Social（trumpstruth.org RSS）+ X（routine 通过 x MCP 写入 `data/in/x-trump.json`）
- 行情：Yahoo（yahoo-finance2）、FRED（T-1）
- 官方日历：`calendar/releases-2026.json`（含次要的 08:30 数据 tier 2：初请失业金、新屋开工、耐用品、贸易差额——只列出，不触发事件规则），加上官方发布日程
- 期权链 / 报价：Robinhood MCP 保存的 JSON（`data/in/*chain*.json`），只读
- 本地存储：SQLite `data/alpha-news.sqlite`（可用 `ALPHA_DB` 改路径）

## 知识库 `knowledge/`

- `catalog.json`：条目与来源的唯一真实来源，渲染成 `PLAYBOOK.md`、`BIAS_QUESTIONS.md`（`scripts/render-knowledge.ts`）
- `mentor/`：大佬原文逐字保存
  - `discipline/`：纪律 01–20、止损学、止盈学、盘前流程
  - `kelly/`、`reviews/`：复盘（HYG/TLT…、胜率复盘、防御组合）
  - `better-macro-trader.md`、`world-lines.md`
- `courses/`、`options/`、`research/`：课程与研究资料
- DK 自己的补充都标明「DK」；新内容先对 catalog 去重
- 聊天里唱反调用的模板：`docs/CRITIQUE_PROMPT.md`

## 安全规则

- **Robinhood 只读**：不下单、不撤单；`paper` 只写本地日志
- **只做定义风险**：禁止裸卖 call/put、卖出跨式/宽跨式
- **上限只能收紧，不能放宽**（`rules.effectiveRules`）：
  - 单笔最大亏损 1%
  - 同一标的 3%
  - 每个仓位最多调整 1 次
  - 每日亏损 2% 停手
  - 同时持仓 ≤10
- 加仓最多 1 次，而且只能在论点被重新确认之后；不摊低成本
- 48 小时内有高影响数据不开新仓；动机必须是论点（不是为了分享或找刺激）

## 文档

- 进度与范围：[docs/PROGRESS.md](docs/PROGRESS.md)
- 开源审计：[docs/OSS_AUDIT.md](docs/OSS_AUDIT.md)
