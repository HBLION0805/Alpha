Status: RESEARCH_ONLY_NOT_RUNTIME_KNOWLEDGE

# M04 — Yen Carry Trade / 日元融资与套利交易

Research date: 2026-09-20, America/New_York. Codex/Alpha research only；没有查询市场报价、建立仓位或自动监控。当前政策以本次读到的BOJ公告为准，具体时点见H/M。

## A. Executive definition

未对冲的日元 carry 是承担日元融资或等价衍生空头，换取其他货币/资产回报。赚取的不是无风险利差：日元升值、目标资产下跌、融资价差扩大及保证金都能吞噬收益。相对便宜必须比较同期限的实际融资成本，而不是把日本政策利率当所有投资者的借款利率。[S01/S02/S03]

三类必须分开：可观察的贷款/期货/证券交易；由资产负债表与衍生统计估算的carry暴露；市场把任何日元上涨与股价下跌叫“carry unwind”的叙事。日本保险公司持有已对冲海外债券、全球银行用美元换日元做basis交易、对冲基金做未对冲日元空头，风险可能很不一样甚至方向相反。[S02/S03]

Owner 链条：低日元利率→融资激励 SUPPORTED_MECHANISM；→全世界风险资产买入 CONDITIONAL、当前规模 UNKNOWN；日元升值→未对冲空头损失 WELL_ESTABLISHED；→强制去杠杆 CONDITIONAL；→所有风险资产下跌 DISPUTED。BIS对2024年8月的解释是杠杆放大美国负面消息，不是日本利率唯一触发。[S02]

## B. Historical development

| 日期/类型 | 事件 | 结构改变及意义 | 来源 |
|---|---|---|---|
| 1999-02，structural turning point | BOJ零利率政策 | 持续低融资利率环境的一个起点，不能据此假定之后一直零利率 | S04 Chart16/17 |
| 2001-03，structural turning point | 数量宽松 | 操作目标转向央行账户余额，货币工具不只是短率 | S04 |
| 2013-04，structural turning point | QQE | 资产购买与预期渠道加强；海外投资并不必然全是carry | S04 |
| 2016-01/09，structural turning point | 宣布负利率、引入YCC | 短率与长率干预并存；宣布/实施日期须区分 | S04；负利率实施月另有统计口径 |
| 2024-03，structural turning point | 退出负利率/YCC框架 | “日本永远零利率”不再适用 | S04政策转换图 |
| 2024-07/08，temporary shock | 汇率反转与美国宏观消息后出现跨资产杠杆平仓 | 保证金、波动率和拥挤仓位放大冲击，随后市场很快稳定 | S02 |
| 2025-12，measurement research | BIS梳理FX与其他衍生统计 | basis、hedging与carry区别；名义金额不等于方向性风险 | S03 |
| 2026-09-18，policy change | BOJ宣布隔夜目标调整至约1.25% | 需同时看生效日与市场已预期部分，不能把公告当已测carry清算 | S01 |

## C. Actors

BOJ、MOF、提供日元/美元融资的银行与交易商、杠杆基金、保险养老金等长期机构、衍生品清算及经纪商、目标资产发行人与投资者。家庭外币储蓄不一定有杠杆，不能放进与基金相同的风险模型。

## D. Actor positions, actions, interests and constraints

MODEL_INFERENCE / ALPHA_INFERENCE 的利益推断基于工具经济性和负债结构。反例是套期保值、负债匹配或监管约束主导；若组合完全对冲或无须滚动融资，“赚利差”的动机解释就不成立。

| Actor | Stated position | Observed action | Exposure / incentive | Constraints | Dependencies / conflicts |
|---|---|---|---|---|---|
| BOJ政策委员会 | OFFICIAL_STATEMENT：稳定实现2%物价目标、依数据调整 | OBSERVED_ACTION：09-18决定及公开异议 [S01] | 国内通胀、工资和经济活动；不能称意图“打爆全球carry” | 国内目标、金融稳定与不确定性 | 银行/企业融资；委员意见不同，不是单一一致判断 |
| MOF | 本次只读取统计任务，政策/干预目的未另取，UNKNOWN | OBSERVED_ACTION：09-17发布跨境证券周报 [S05] | 财政及外汇制度责任；具体当前意图 UNKNOWN | 法律授权、披露滞后 | BOJ与市场；日元上涨不能自动归于干预 |
| 银行/FX dealers | 当前个别经营声明未读，UNKNOWN | S03描述用FX swaps满足融资/对冲需求 | 赚取中介/basis与管理负债币种 | 资本、信用、期限错配、美元供给 | 企业/非银与央行互换；日元资产多不等于做空日元 |
| 杠杆基金 | 个别基金声明未得，UNKNOWN | 2024历史平仓证据/估算 [S02] | 利差、汇率和目标资产回报；承受尾部风险 | margin、VaR、止损、赎回和融资续作 | prime brokers/交易商；共同去杠杆可能压低对手资产 |
| 保险/养老金/长期基金 | 个别负债匹配政策未逐家核，UNKNOWN | 日本MOF报告机构证券交易，不识别每笔融资 [S05] | 本币负债与海外收益/分散化；hedge成本重要 | 久期、资本、流动性与汇率对冲 | 海外发行人/银行；不可把全部海外持有等同短日元carry |
| 经纪商/清算机构 | 具体规则本次未逐家读，UNKNOWN | BIS讨论波动时保证金上调 [S02] | 防止对手违约、抵押品足额 | 规则、流动性与客户集中度 | 杠杆客户/抵押资产市场；个体减风险可放大全体压力 |
| 目标资产发行人/其他持有人 | 异质，UNKNOWN | 当前来自日元的净购买本批未测 | 融资成本、估值、收入；不因持有同资产就采用同策略 | 基本面、流动性、其他货币融资 | carry资金仅是潜在一类买家；资产跌不能反证全靠日元撑起 |

## E. Flows

| From → to / resource | Mechanism | Quantity / period | Status/source | Measurement boundary |
|---|---|---|---|---|
| 银行 → 投资者；日元融资 | 贷款、repo或衍生等价敞口 | 当前新增量 UNKNOWN | INFERRED_FLOW，S02/S03 | 贷款总额不等于投机carry用途 |
| 投资者 → FX对手 → 外币资产卖家 | 换汇再投资，或衍生模拟 | 当前金额 UNKNOWN | INFERRED_FLOW，S02/S03 | 未对冲FX风险与完全对冲组合分开 |
| 日本居民 ↔ 海外证券对手 | 买卖证券，按发行人居住地分类 | S05周报覆盖至2026-09-12；本批不从错位文本表抄净额 | OBSERVED_FLOW（有官方交易记录），精确量本批 UNKNOWN | 不是按证券币种，更不是全球日元融资总量 |
| 资产持有人 → 市场；卖出，再购日元偿债 | 被动/主动平仓 | 2024年8月有方向性研究证据；2026当前 UNKNOWN | ESTIMATED_FLOW，S02 | 单一同时变动不能拆解每类卖家 |
| 资金充裕美元银行 → 日元资产；FX swap | 出借美元换取日元及远期反向交换 | 当前规模 UNKNOWN | INFERRED_FLOW，S03的basis机制 | 可能完全对冲，与未对冲借日元策略不同 |
| Fed → BOJ → 合格机构；美元 | 常设互换后备，需实际提款 | 当前提款量 UNKNOWN | AUTHORIZED_POLICY，S06 | 授权能力不是已发生流量，也不是买股票资金证明 |

**单列存量估计：**BIS Bulletin90 对2024年8月动荡之前carry规模给出约 **¥40 trillion（当时约$250 billion）**的粗略中间估计，并称数据缺口可能使其偏低。这是历史暴露估计，不是当日出售金额、当前仓位、完整上限或独立可观测总账。[S02]

## F. Causal mechanisms

### 未对冲收益的机械边界

令 S 为每单位外币对应的日元数。忽略费用、违约和保证金时，借入1日元、换汇投资后的期末净额为 `(1 + 外币资产收益) × S1/S0 − (1 + 日元融资成本)`。S下降是日元升值，会伤害该未对冲组合。这个恒等式不预测S，也不保证能融资或在指定价格平仓。[S02/S03]

完全远期对冲会引入远期点数；在有套息平价近似成立时，利差通常反映在远期价格中。basis、信用、资本和交易成本还会改变回报；不能把高美元名义收益减低日元政策利率称无风险收益。[S03]

| Trigger → first → second | 等级 | Counterforce → confirmation → falsification |
|---|---|---|
| 日元升值 → 未对冲融资负债按资产货币计变贵 → 亏损/平仓 | WELL_ESTABLISHED 算术；强平 CONDITIONAL | 自有资本、对冲、未到期融资缓冲；需短日元头寸与平仓证据；若净敞口已对冲不能套此解释 |
| 日美预期利差收窄 → 预期carry减少 → 降低风险仓位 | CONDITIONAL [S02] | 已计价、目标资产回报、basis变化；看同期限融资/远期而非两个政策数字；无仓位变化则不能断言实际平仓 |
| 波动/亏损 → margin/VaR约束 → 跨资产卖出 → 流动性下降 | CONDITIONAL，历史有支持 [S02] | 充足抵押品、经纪展期、央行后备；需保证金、融资及成交证据；只有股跌不识别链条 |
| 海外债券对冲成本高 → 长期机构改变hedge比例/配置 → FX与债券流动 | CONDITIONAL [S03/S05] | 负债匹配与监管；需机构分类与hedge资料；居民海外卖出也可能为再平衡，与carry无关 |

**ALPHA_INFERENCE M04-F1：**只有“日元升值 + 已知短日元暴露减少 + 融资/波动压力 + 跨资产去风险”多项同时成立，才更支持unwind归因。依据S02/S03；替代解释是美国增长意外或日本干预引起汇率变化，股票独立重估；若头寸无减少、融资平稳，则归因显著削弱。该证据组合不是新交易信号，也没有量化权重。

## G. Competing explanations

1. **BOJ触发 vs 美国增长消息触发。**2024年8月BIS把美国负面宏观发布作为初始反应、杠杆平仓作为放大器；利差和汇率更早已变化。故“全部是日本加息造成”超出证据。[S02]
2. **证券资金回流 vs carry还债。**MOF交易由居民/非居民及证券发行人居住地分类，不披露每笔融资和hedge。回流可来自负债匹配、利润实现、赎回或carry；不能仅据净卖出选择最刺激故事。[S05]
3. **巨额衍生名义金额 vs 净方向暴露。**BIS统计包括对冲、双边/多边关系和不同期限；notional不是可一次清算的资产额。40万亿日元历史估算也不是当前总量。[S02/S03]
4. **危机必然失控 vs 快速缓冲。**2024年8月市场随后稳定，是对“任何unwind都必然系统崩溃”的反例；但不能因此保证下一次不失控。[S02]

## H. Current structure

本次读取的最新BOJ政策文件发布于 **2026-09-18**：委员会7比2通过，将无担保隔夜call rate目标调整为约 **1.25%**；新操作目标及配套存款便利、基本贷款利率注明 **2026-09-24** 生效。必须区分公告、实施以及实际借款成本，不能把本研究日9月20日所有资金都写成按新利率成交。文件对物价和未来加息的判断属于 OFFICIAL_STATEMENT，并非已实现预测。[S01]

因此，用过去零/负利率直接描述当前日本制度已经过时。利差仍需对手货币、期限、远期和信用条件，本批没有查询实时利差。**当前carry净规模、日元空头和是否正在unwind：UNKNOWN。**9月18日政策变化本身不足以改为“正在全球平仓”。

MOF **2026-09-17** 发布、最后观察周 **09-06至09-12** 的统计已存在，但分类不能提供上述全球净暴露。[S05] BIS **2025-12**研究仍是机制和统计方法资料，不能伪装成2026年9月仓位报告。[S03]

## I. Watch indicators

| 指标 | 可以确认 | 不能证明 | 来源/频率/滞后 |
|---|---|---|---|
| BOJ决定、实施日与相对期限利率 | 资金条件变化 | 未预期部分或真实清算 | BOJ/相关央行；会议/日，实际成交需另核 |
| USD/JPY及远期、FX implied vol/basis | 汇率风险和hedge成本 | 同步资产跌即carry | BIS机制/交易场所；市场连续，所用数据延迟须核，未新增读取 |
| 杠杆日元期货头寸 | 一部分可观察短仓变化 | OTC和全球carry全貌 | CFTC公开COT；周，通常周五发布周二持仓，假日可变；S07核发布机制，当前仓位报告未读 |
| MOF居民证券交易及机构分类 | 日本对外净交易、类型差异 | 融资币种、hedge与动机 | MOF；周/月；9月17日报告最后观察周到9月12日 |
| BIS银行币种/衍生统计 | 中长期融资足迹 | 名义金额=净方向杠杆 | BIS；季度/半年/三年调查，显著滞后，S03 |
| 保证金、repo/FX融资及市场深度 | 强制减仓条件是否出现 | 单指标识别所有卖家 | 交易所/经纪披露、BIS事件研究；事件/日，非银数据不全 |

## J. Cross-theme links

| Link | 等级/依据 | 边界 |
|---|---|---|
| [M02 F](M02_DOLLAR_AND_SANCTIONS.md#f-causal-mechanisms) | FACTUAL_DEPENDENCY：银行FX swaps及央行互换连接币种融资 | 央行后备不保carry收益，S03/S06 |
| [M03 F](M03_DEBT_AND_FISCAL_DOMINANCE.md#f-causal-mechanisms) | SUPPORTED_MECHANISM：美债收益、hedge成本与日本机构配置 | 不能只用美日政策利差 |
| [M01 F](M01_OIL_IS_POWER.md#f-causal-mechanisms) | CONDITIONAL_HYPOTHESIS：能源进口成本与BOJ反应影响融资条件 | S01提及中东风险；政策预测非固定升值关系 |
| [M05 F](M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#f-causal-mechanisms) | CONDITIONAL_HYPOTHESIS：交付冲击影响日本物价与外贸收入 | 未量化日本每条航线净敞口 |

## K. Relevance to Alpha

以下 **ALPHA_INFERENCE** 来自F，替代解释与观测要求同时列出，不给涨跌许可。

| 对象 | 传导/依据 | 反作用 | 时域 | 需观察 |
|---|---|---|---|---|
| USD | 相对日元融资/偿债换汇 | 美元避险需求、其他货币变化 | 小时至周 | bilateral与broad USD分开；融资净额 |
| 名义收益率 | 机构海外债券调整、去杠杆出售 | 避险买债可压低收益率 | 小时至季 | 美国债券交易流与政策路径 |
| 实际收益率 | 流动性/真实贴现率变化 | 名义变化含通胀与期限补偿 | 日至季 | TIPS流动性及期限匹配 |
| Gold / GLD | 保证金需求导致卖出或避险买入 | 两方向可同时存在 | 小时至周 | 黄金资金流与资金压力，不能只凭JPY |
| BTC / IBIT | 杠杆风险预算变化 | 加密自身清算与ETF申赎独立 | 小时至周 | 币种融资关联证据；直接日元资金份额 UNKNOWN |
| Oil | 风险平仓影响金融头寸 | 实物缺口可主导 | 日至月 | 期限/现货/库存与投机头寸 |
| Broad risk | 共同margin/VaR迫使减仓 | 无杠杆买家与盈利消息 | 小时至月 | 头寸、融资、成交/深度，而不是价格共跌即可 |
| Financial conditions | 资金滚动、basis与抵押品压力 | 后备流动性及缓慢持有者 | 小时至季 | 短端资金/经纪要求/市场运行 |

## L. Open questions

- 无法完整观察全球净日元融资敞口、杠杆、最终目标资产和双边OTC对冲；本批不提供2026总量。
- 当前利率变动的意外成分、具体基金保证金和仓位调整仍未知。
- MOF数据不会自动把一个日本保险机构持有的美国债券变成“投机carry”。
- 市场即时冲击与政策/基本面共同驱动的因果份额，需要专业微观交易研究，不能从两条走势图辨认。
- 没有证据确认BTC/IBIT当前有多少直接日元融资，因此相关方向推断保持未验证。

## M. Source map

全部于 **2026-09-20** 读取；PDF按可读文本定位，未声称复核全部图表。截图工具尝试未提供可查看图像，故没有使用需要视觉列对齐的MOF净额数字。

| ID/category | URL / 发布日期 / 覆盖 | 支持与限制 |
|---|---|---|
| S01 / primary policy | [BOJ 2026-09-18 decision](https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2026/k260918a.pdf)，第1–3页及脚注；[reference](https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2026/k260918b.pdf)，同日 | 新目标、生效日、异议和官方展望；不是当前市场资金成本或全球清算记录 |
| S02 / institutional event research | [BIS Bulletin90](https://www.bis.org/publications/bulletin-90-market-turbulence-and-carry-trade-unwind-august-2024)，2024-08-27；[8页PDF](https://www.bis.org/publications/bulletin-90-market-turbulence-and-carry-trade-unwind-august-2024.pdf)，key takeaways/触发与规模段 | 2024事件、杠杆放大、估算局限；非2026持仓数据 |
| S03 / institutional methodology | [BIS derivatives statistics](https://www.bis.org/publications/qr-202512/international-finance-through-lens-bis-statistics-derivatives-markets)，2025-12，FX工具、统计与cross-currency/carry小节 | hedging、basis、carry差异及测量限制；名义额不代表净风险 |
| S04 / primary institutional history | [BOJ 2025-02-19 charts](https://www.boj.or.jp/en/about/press/koen_2025/data/ko250219a2.pdf)，Chart16/17，第9个PDF页；日期/标签文本 | 1999/2001/2013/2016/2024政策史；不采用无关股票回报图 |
| S05 / primary statistics | [MOF securities index](https://www.mof.go.jp/english/policy/international_policy/reference/itn_transactions_in_securities/index.htm)，09-17更新；[weekly PDF](https://www.mof.go.jp/english/policy/international_policy/reference/itn_transactions_in_securities/week.pdf)，2026-09-17，日期/分类/修订脚注 | 指定机构、居住地分类与观察期；动态URL会更新；未可靠对齐数表，不抄净额 |
| S06 / primary facility | [Fed swaps FAQ](https://www.federalreserve.gov/monetarypolicy/bst_swapfaqs.htm)，更新时间 UNKNOWN，常设与转贷风险段 | 央行美元后备机制，非当前提款额 |
| S07 / primary statistical methodology | [CFTC COT guide](https://publicreporting.cftc.gov/stories/s/COT-Help/p2fg-u73y/)，更新日 UNKNOWN；[release FAQ](https://www.cftc.gov/es/node/128971)，官方索引充分节选，频率/假日段 | 观察日与发布日不同；没有读取当前日元净头寸，不把净持仓变化全归因交易，分类也可能变化 |

High-quality reporting：未引入额外媒体作为独立仓位证据。Industry research：未取得经纪商实时margin/OTC账本。Academic/institutional见BIS；其工作人员观点并非全部成员央行认定。Analysis/commentary：归属明确，无“全球一切由carry解释”。

## N. Adversarial review

已纠正“BOJ已公布=所有新利率已生效”、历史40万亿估计=现在仓位、居民海外卖出=carry清算三个潜在误读。将对冲机构、未对冲基金与美元融资basis交易分开。2024冲击也有美国消息触发且迅速稳定，保留为关键反例。当前unwind状态仍UNKNOWN，没有生成GLD/IBIT交易方向。
