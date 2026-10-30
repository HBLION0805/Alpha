Status: KNOWLEDGE_CANDIDATE_NOT_APPROVED
Runtime use: PROHIBITED
Owner approval required: YES

# Batch 1 Knowledge Review Gate

Review stage: OWNER_REVIEW_READY。执行者Codex；生成/核对时间 2026-09-20T16:47:08.860Z。本轮仅依据提交507a5db的已保存档案和来源映射做语义提取，不把它叫新一轮外部原文认证。原六份文件仍为RESEARCH_ONLY_NOT_RUNTIME_KNOWLEDGE，内容与指纹保持不变。没有Owner或独立ChatGPT审核记录。

建议15–30分钟先读五主题取舍、日期/反例和冲突，再按需要打开JSON。所有“保留/提升”都只是建议成为候选，不是批准；没有运行时接入、调度或自动数据获取。

- [候选JSON](BATCH_1_KNOWLEDGE_CANDIDATES.json)：完整ID、版本、来源、限制及审阅决定。
- [不纳入及拒绝清单](BATCH_1_REJECTED_OR_DOSSIER_ONLY.md)：含原因与原文定位。
- [原综合档案](../BATCH_1_SYNTHESIS.md)：保持历史研究，不覆盖。

本包31条主体候选（结构12、历史2、状态4、机制7、参与者2、流关系2、传导渠道2），另有5个观察问题、5个未知问题、6条候选边、2项冲突/版本桥接记录。数量不是知识正确性的证据。

## 1. 按主题决定什么值得长期保留

F/H采用PROMOTE_CANDIDATE；C采用CURRENT_STATE_CANDIDATE；ME/T采用MECHANISM_CANDIDATE；A采用ACTOR_RELATION_CANDIDATE；FL是PROMOTE_CANDIDATE下的流关系；W/Q分别是WATCH_QUESTION_CANDIDATE与OPEN_QUESTION。F06/F11是概念/识别框架，evidenceStatus保持SUPPORTED_MECHANISM，不能按“structural fact”类型标签误升成所有经济后果都已证实。

标签F01等只用于阅读；每个在JSON里一对一对应可读、版本化knowledgeId。所有复用用themeLinks/引用连接，不再复制主体。

### M01 石油

| 类别 / 标签 | 保留的候选与限制 | 可追溯位置 |
|---|---|---|
| F01 / STRUCTURAL_FACT | OPEC成员组织与OPEC+合作安排不同；俄罗斯参与后者不等于成为OPEC成员。  | [M01 A](../M01_OIL_IS_POWER.md#a-executive-definition)、[M01 B](../M01_OIL_IS_POWER.md#b-historical-development)；M01.S01 / M01.S02 |
| F02 / STRUCTURAL_FACT | 配额是政策安排，备用产能是带条件的能力，SPR库存是存量，实际生产/释放/交付才是期间流量；这些量不可互换。  | [M01 A](../M01_OIL_IS_POWER.md#a-executive-definition)、[M01 E](../M01_OIL_IS_POWER.md#e-flows)、[M05 E](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#e-flows)；M01.S02 / M01.S03 / M01.S04 |
| C01 / CURRENT_STATE | 按dossier记录的2025-12-19 EIA修订说明，有效产能采用90天内可达到并可持续的条件，最大可持续产能采用一年内可达到条件；不将旧口径直接平接。 **只作带日期版本。** | [M01 H](../M01_OIL_IS_POWER.md#h-current-structure)；M01.S03 |
| ME01 / MECHANISM | 可交付供给损失可能经库存/产品成本和实际收入传到通胀、活动与政策，不能省略中间环节。  | [M01 F](../M01_OIL_IS_POWER.md#f-causal-mechanisms)、[M05 F](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#f-causal-mechanisms)；M01.S05 / M01.S06 / M05.S02 |
| T01 / TRANSMISSION_CHANNEL_CANDIDATE | 能源/财政/融资冲击可能经实际收益率、美元、避险或现金需求影响黄金；没有固定GLD方向。  | [M01 K](../M01_OIL_IS_POWER.md#k-relevance-to-alpha)、[M02 K](../M02_DOLLAR_AND_SANCTIONS.md#k-relevance-to-alpha)、[M03 K](../M03_DEBT_AND_FISCAL_DOMINANCE.md#k-relevance-to-alpha)、[M04 K](../M04_YEN_CARRY_TRADE.md#k-relevance-to-alpha)；M01.S05 / M03.S07 / M02.S09 |
| W01 / WATCH | 实际可交付石油是否减少，还是只有配额/标题或需求在变？ 不能由单价识别战争原因。 | [M01 I](../M01_OIL_IS_POWER.md#i-watch-indicators)、[M01 F](../M01_OIL_IS_POWER.md#f-causal-mechanisms)；M01.S02 / M01.S06 / M01.S09 |
| Q01 / UNKNOWN | 当前真正可快速出口并到达买家的备用桶数是多少？ 名义能力、设施状态与运输约束不能直接拼成实时交付量。 | [M01 L](../M01_OIL_IS_POWER.md#l-open-questions)、[M05 L](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#l-open-questions)；M01.S03 / M01.S09 |
| DOSSIER_ONLY / REJECT | 留原档案：D01、D02、D03、D05、D07；拒绝的误读：R01、R02、R03、R08。详见[取舍清单](BATCH_1_REJECTED_OR_DOSSIER_ONLY.md)。 | 不删除或改写原研究 |

### M02 美元与制裁

| 类别 / 标签 | 保留的候选与限制 | 可追溯位置 |
|---|---|---|
| F03 / STRUCTURAL_FACT | SWIFT提供金融报文；CHIPS提供大额美元清算结算；代理行账户是账务关系。报文接入不等于货币本身或最终结算。  | [M02 A](../M02_DOLLAR_AND_SANCTIONS.md#a-executive-definition)、[M02 D](../M02_DOLLAR_AND_SANCTIONS.md#d-actor-positions-actions-interests-and-constraints)、[M01 G](../M01_OIL_IS_POWER.md#g-competing-explanations)、[M05 J](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#j-cross-theme-links)；M02.S03 / M02.S04 / M02.S05 |
| F04 / STRUCTURAL_FACT | 储备币种份额是指定口径的存量占比；变化可能涉及交易、汇率、资产估值或方法。COFER外汇储备不含黄金，不能直接当净资金流或全部官方储备。  | [M02 E](../M02_DOLLAR_AND_SANCTIONS.md#e-flows)、[M02 G](../M02_DOLLAR_AND_SANCTIONS.md#g-competing-explanations)、[M02 H](../M02_DOLLAR_AND_SANCTIONS.md#h-current-structure)；M02.S01 / M02.S02 / M02.S09 |
| C02 / CURRENT_STATE | 已保存IMF 2026-07-01发布版本记载：2026Q1外汇储备总量13.10万亿美元，美元占57.13%；这是该期存量口径。 **只作带日期版本。** | [M02 H](../M02_DOLLAR_AND_SANCTIONS.md#h-current-structure)；M02.S02 |
| ME02 / MECHANISM | 法律限制可以改变中介可服务范围；融资/贸易成本与实际业务量的变化仍取决于执行、许可和替代。  | [M02 F](../M02_DOLLAR_AND_SANCTIONS.md#f-causal-mechanisms)、[M01 F](../M01_OIL_IS_POWER.md#f-causal-mechanisms)；M02.S06 / M02.S07 / M01.S10 |
| A01 / ACTOR_RELATION | SWIFT受其适用的欧盟/比利时法律约束；其对指定实体的接入限制须与立法者角色分开。  | [M02 D](../M02_DOLLAR_AND_SANCTIONS.md#d-actor-positions-actions-interests-and-constraints)、[M02 B](../M02_DOLLAR_AND_SANCTIONS.md#b-historical-development)；M02.S03 |
| A02 / ACTOR_RELATION | Fed与BOJ的央行互换关系提供美元后备渠道；BOJ对当地机构的转贷与Fed对央行的关系分开。  | [M02 D](../M02_DOLLAR_AND_SANCTIONS.md#d-actor-positions-actions-interests-and-constraints)、[M02 E](../M02_DOLLAR_AND_SANCTIONS.md#e-flows)、[M04 E](../M04_YEN_CARRY_TRADE.md#e-flows)；M02.S08 / M04.S06 |
| W02 / WATCH | 美元储备份额变化来自实际配置、估值还是统计方法？ 不能量化整个美元融资网络。 | [M02 I](../M02_DOLLAR_AND_SANCTIONS.md#i-watch-indicators)、[M02 G](../M02_DOLLAR_AND_SANCTIONS.md#g-competing-explanations)；M02.S02 / M02.S09 |
| Q02 / UNKNOWN | 制裁对实际交易量、成本及改道规模分别产生多大影响？ 法律范围不等于执行效果；可比银行/贸易数据不全。 | [M02 L](../M02_DOLLAR_AND_SANCTIONS.md#l-open-questions)、[M01 L](../M01_OIL_IS_POWER.md#l-open-questions)；M02.S06 / M02.S07 |
| DOSSIER_ONLY / REJECT | 留原档案：D01、D02、D06、D07；拒绝的误读：R01、R02、R03、R05。详见[取舍清单](BATCH_1_REJECTED_OR_DOSSIER_ONLY.md)。 | 不删除或改写原研究 |

### M03 债务

| 类别 / 标签 | 保留的候选与限制 | 可追溯位置 |
|---|---|---|
| F05 / STRUCTURAL_FACT | 赤字是期间收支差，债务是存量；gross debt、public debt与marketable debt口径不同。Public debt包含Fed持有；总拍卖、私人净融资和赤字也不等同。  | [M03 A](../M03_DEBT_AND_FISCAL_DOMINANCE.md#a-executive-definition)、[M03 E](../M03_DEBT_AND_FISCAL_DOMINANCE.md#e-flows)；M03.S01 / M03.S02 |
| F06 / STRUCTURAL_FACT | 财政主导需要财政融资约束货币政策或价格稳定选择的制度证据；高债务、一次降息或QE本身不足以识别。金融抑制是另一个需辨认的机制。  | [M03 A](../M03_DEBT_AND_FISCAL_DOMINANCE.md#a-executive-definition)、[M03 F](../M03_DEBT_AND_FISCAL_DOMINANCE.md#f-causal-mechanisms)、[M03 G](../M03_DEBT_AND_FISCAL_DOMINANCE.md#g-competing-explanations)；M03.S04 / M03.S05 |
| F11 / STRUCTURAL_FACT | 名义长期收益率可分解为预期短率与期限溢价；成分来自模型估计。不能把名义收益率上涨单独解释成政策短率预期上涨。  | [M03 F](../M03_DEBT_AND_FISCAL_DOMINANCE.md#f-causal-mechanisms)、[M03 G](../M03_DEBT_AND_FISCAL_DOMINANCE.md#g-competing-explanations)、[M01 K](../M01_OIL_IS_POWER.md#k-relevance-to-alpha)；M03.S07 |
| H01 / HISTORICAL_FACT | 1951年Treasury–Fed Accord改变了此前战时国债利率安排下财政与货币政策的关系。  | [M03 B](../M03_DEBT_AND_FISCAL_DOMINANCE.md#b-historical-development)；M03.S04 |
| C03 / CURRENT_STATE | Treasury在2026-08-03预计2026Q3私人持有净可交易借款7390亿美元，并假定季末现金9500亿美元；不能标成已实现融资。 **只作带日期版本。** | [M03 E](../M03_DEBT_AND_FISCAL_DOMINANCE.md#e-flows)、[M03 H](../M03_DEBT_AND_FISCAL_DOMINANCE.md#h-current-structure)；M03.S02 |
| ME03 / MECHANISM | 既有固定利率债务的合同付息成本不会随当日市场收益率全部立即重定价；更高融资成本经到期再融资逐步进入付息。  | [M03 F](../M03_DEBT_AND_FISCAL_DOMINANCE.md#f-causal-mechanisms)；M03.S01 / M03.S02 |
| ME04 / MECHANISM | 净发行的期限构成与投资者安全资产需求共同影响私人久期吸收；收益率反应不是总债务的一元函数。  | [M03 F](../M03_DEBT_AND_FISCAL_DOMINANCE.md#f-causal-mechanisms)、[M03 J](../M03_DEBT_AND_FISCAL_DOMINANCE.md#j-cross-theme-links)、[M02 J](../M02_DOLLAR_AND_SANCTIONS.md#j-cross-theme-links)；M03.S02 / M03.S03 / M03.S07 / M02.S01 |
| FL01 / FLOW_RELATION | Treasury从发行取得现金并偿还到期证券；净融资必须与总拍卖、二级换手及现金余额变化分开。  | [M03 E](../M03_DEBT_AND_FISCAL_DOMINANCE.md#e-flows)；M03.S02 / M03.S03 |
| W03 / WATCH | 净融资、期限和现金假设是否改变了实际再融资负担？ 不能由单次拍卖认定财政危机。 | [M03 I](../M03_DEBT_AND_FISCAL_DOMINANCE.md#i-watch-indicators)；M03.S01 / M03.S02 / M03.S03 / M03.S07 |
| Q03 / UNKNOWN | 当前财政融资需求是否实质约束了价格稳定政策？ 债务和发行数字不能识别决策反事实、约束或被迫吸收。 | [M03 L](../M03_DEBT_AND_FISCAL_DOMINANCE.md#l-open-questions)、[M03 G](../M03_DEBT_AND_FISCAL_DOMINANCE.md#g-competing-explanations)；M03.S04 / M03.S05 / M03.S06 |
| DOSSIER_ONLY / REJECT | 留原档案：D01、D02、D06、D07；拒绝的误读：R01、R02、R03、R06。详见[取舍清单](BATCH_1_REJECTED_OR_DOSSIER_ONLY.md)。 | 不删除或改写原研究 |

### M04 日元carry

| 类别 / 标签 | 保留的候选与限制 | 可追溯位置 |
|---|---|---|
| F07 / STRUCTURAL_FACT | 未对冲日元carry承担日元融资与外币资产风险；完全对冲海外投资和美元换日元basis交易不能自动归为同一方向的投机carry。  | [M04 A](../M04_YEN_CARRY_TRADE.md#a-executive-definition)、[M04 F](../M04_YEN_CARRY_TRADE.md#f-causal-mechanisms)；M04.S02 / M04.S03 |
| F08 / STRUCTURAL_FACT | 衍生名义金额、日元期货净头寸和日本居民海外证券交易各有覆盖边界；它们都不能单独测得全球净日元carry杠杆或平仓额。  | [M04 E](../M04_YEN_CARRY_TRADE.md#e-flows)、[M04 G](../M04_YEN_CARRY_TRADE.md#g-competing-explanations)、[M04 I](../M04_YEN_CARRY_TRADE.md#i-watch-indicators)；M04.S02 / M04.S03 / M04.S05 / M04.S07 |
| F12 / STRUCTURAL_FACT | 政策公告日、正式生效日和实际成交/观察日须分开；公告存在不证明新条件已适用于所有交易，研究接收日也不是源数据日期。  | [M04 H](../M04_YEN_CARRY_TRADE.md#h-current-structure)、[M03 E](../M03_DEBT_AND_FISCAL_DOMINANCE.md#e-flows)、[M05 H](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#h-current-structure)；M04.S01 / M03.S02 / M05.S06 |
| H02 / HISTORICAL_FACT | BOJ在2024年3月退出负利率/YCC框架；不能以此前框架概括此后全部时期。  | [M04 B](../M04_YEN_CARRY_TRADE.md#b-historical-development)；M04.S04 |
| C04 / CURRENT_STATE | 已保存BOJ 2026-09-18公告将隔夜call rate目标调整至约1.25%，新目标与配套利率注明09-24生效；原批研究日2026-09-20尚未到该日。 **只作带日期版本。** | [M04 H](../M04_YEN_CARRY_TRADE.md#h-current-structure)；M04.S01 |
| ME05 / MECHANISM | 跨币种融资与海外资产配置取决于同期限资金成本、远期、basis和负债匹配；政策利差不等于对冲后可得收益。  | [M04 E](../M04_YEN_CARRY_TRADE.md#e-flows)、[M04 F](../M04_YEN_CARRY_TRADE.md#f-causal-mechanisms)、[M02 J](../M02_DOLLAR_AND_SANCTIONS.md#j-cross-theme-links)；M04.S03 / M04.S05 / M04.S06 |
| ME06 / MECHANISM | 日元升值可损害未对冲短日元组合；融资、margin或风险约束收紧时，冲击可能放大为跨资产去杠杆；也可能发生主动减仓。  | [M04 F](../M04_YEN_CARRY_TRADE.md#f-causal-mechanisms)、[M04 G](../M04_YEN_CARRY_TRADE.md#g-competing-explanations)；M04.S02 / M04.S03 |
| T02 / TRANSMISSION_CHANNEL_CANDIDATE | 融资/保证金及风险预算变化可能传到风险资产，包括BTC/IBIT；直接日元融资暴露尚未知。  | [M04 K](../M04_YEN_CARRY_TRADE.md#k-relevance-to-alpha)、[M02 K](../M02_DOLLAR_AND_SANCTIONS.md#k-relevance-to-alpha)、[M05 K](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#k-relevance-to-alpha)；M04.S02 / M04.S03 / M02.S08 |
| W04 / WATCH | 日元融资杠杆真的在退，还是仅有资产价格共动？ 代理指标不能覆盖全部OTC净暴露。 | [M04 I](../M04_YEN_CARRY_TRADE.md#i-watch-indicators)、[M04 F](../M04_YEN_CARRY_TRADE.md#f-causal-mechanisms)；M04.S02 / M04.S03 / M04.S05 / M04.S07 |
| Q04 / UNKNOWN | 当前全球净日元融资杠杆及其最终资产暴露有多大？ OTC双边对冲、净额、最终用途和非银账本不可完整观察。 | [M04 L](../M04_YEN_CARRY_TRADE.md#l-open-questions)；M04.S02 / M04.S03 / M04.S05 / M04.S07 |
| DOSSIER_ONLY / REJECT | 留原档案：D01、D02、D07；拒绝的误读：R01、R02、R04。详见[取舍清单](BATCH_1_REJECTED_OR_DOSSIER_ONLY.md)。 | 不删除或改写原研究 |

### M05 航运

| 类别 / 标签 | 保留的候选与限制 | 可追溯位置 |
|---|---|---|
| F09 / STRUCTURAL_FACT | 相同货物可能经过多个串联咽喉；各通道流量不能简单相加。Suez与SUMED合计油量也不能全称运河船运或推广到LNG、集装箱。  | [M05 A](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#a-executive-definition)、[M05 E](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#e-flows)；M05.S01 / M05.S02 |
| F10 / STRUCTURAL_FACT | PC/UMS等船舶容积相关吨位、货物重量、货值、船次与吨海里是不同指标；船闸/吃水/预约能力不等于已运输货物。  | [M05 A](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#a-executive-definition)、[M05 E](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#e-flows)；M05.S05 / M05.S06 / M05.S11 |
| ME07 / MECHANISM | 绕航可能增加船期和燃料、占用有效运力，进而影响运费与交付；仍需按路线、船型和需求检验。  | [M05 F](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#f-causal-mechanisms)；M05.S02 / M05.S07 |
| FL02 / FLOW_RELATION | 港口之间的能源运输通过特定海峡/运河或有限替代路径，流量需标货类、期间、起终点与统计范围。  | [M05 A](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#a-executive-definition)、[M05 E](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#e-flows)、[M01 E](../M01_OIL_IS_POWER.md#e-flows)；M05.S01 / M05.S02 |
| W05 / WATCH | 运输中断改变了实际交付量，还是主要延长时间/提高成本？ 部分回流不能证明全程安全。 | [M05 I](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#i-watch-indicators)、[M05 F](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#f-causal-mechanisms)；M05.S01 / M05.S02 / M05.S03 / M05.S04 / M05.S06 |
| Q05 / UNKNOWN | 指定航线的实际保险/等待/绕行成本与净损益是多少？ 缺逐条保单、拒保、企业暴露和相匹配航次数据。 | [M05 L](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#l-open-questions)、[M05 D](../M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#d-actor-positions-actions-interests-and-constraints)；M05.S03 / M05.S04 / M05.S06 |
| DOSSIER_ONLY / REJECT | 留原档案：D01、D02、D03、D04、D05、D06、D07；拒绝的误读：R01、R02、R03、R07、R08。详见[取舍清单](BATCH_1_REJECTED_OR_DOSSIER_ONLY.md)。 | 不删除或改写原研究 |

## 2. 哪些“当前事实”必须重新核对

本轮没有更新事实时间。asOf描述源观察/声明的时点；reviewedAt是这次提取核对时间。它们不能互换；没有伪造TTL或宣称现在仍是最新。

| 候选 | asOf / sourceDate / 性质 | 必须review的条件 | 不允许推得 |
|---|---|---|---|
| C01 | 2025-12-19 / 2025-12-19 / POLICY_VERSIONED，CAPACITY | EIA发布定义或方法修订；使用跨版本产能时间序列前 | 仅EIA提供方版本的摘要，不是可直接计算产能的完整定义或所有机构通用口径；未重建旧定义或验证工程可用性。 |
| C02 | 2026-03-31 / 2026-07-01 / PERIODIC_DATA，STOCK | 下一次COFER发布；该季度修订或方法/估值口径改变；尝试用于当前判断前 | 不是9月实时值、交易流量或含黄金的全部储备；后续修订与方法变更需另存。 |
| C03 | 2026-08-03 / 2026-08-03 / PERIODIC_DATA，ANNOUNCEMENT | 下一次Treasury融资声明/修订；Q3实际结果发布；现金假设变化 | 假设现金及会计口径特定；不是总拍卖额或年度赤字，不从预测推出财政主导。 |
| C04 | 2026-09-18 / 2026-09-18 / POLICY_VERSIONED，ANNOUNCEMENT | 新BOJ决定或公告更正；09-24实施日到来时核验实施证据；试图用于某笔融资成本之前 | 这是公告事实，不是已成交融资成本；不证明意外程度、基金暴露或正在清算。 |

C01为提供方方法版本，不将90天响应定义当现成可出口量；C02只描述2026Q1；C03是融资预测，现金值也是预测假设；C04只证明已存公告内容，本研究日早于实施日。

M05没有新增CURRENT_STATE候选：缺精确发布日期的运营通知降级；有日期但迅速变化的事故计数和单船回流留档案。不用采集日期为这些内容补一个“新鲜”版本。A01/A02的asOf也仅为原批制度页面读取日，更新时间未知，不是新的政策生效日或当前资金使用量。

## 3. 机制不能压成方向口诀

JSON保留trigger、firstOrderEffect、secondOrderEffects、counterforces、observableConfirmation、falsification、timeHorizon。下表是审批时最重要的反力，不取代完整条件。

| 候选 / 证据级别 | 中间链 | 关键反力 | 什么会削弱解释 |
|---|---|---|---|
| ME01 / CONDITIONAL_HYPOTHESIS | 实物供给/交付持续损失 → 库存或替代供应承压，可能推高现货及产品成本 → 家庭真实购买力/企业利润变化；成本扩散和预期变化可能影响政策；加息不是必然 | 需求下降；替代供应、释放库存或航路恢复；补贴、利润吸收和锚定预期 | 交付恢复、库存重建且成本不扩散；增长需求冲击比供给证据更强 |
| ME02 / CONDITIONAL_HYPOTHESIS | 适用的账户/交易限制或执行变化 → 中介不能或不愿处理特定交易 → 资本/贸易获取成本可能提高；付款路径、净回款或交付可能调整 | 合法许可；其他中介/市场替代；客户和商品改道 | 业务量/成本未改变；只看到出口折价而无全球缺量证据 |
| ME03 / WELL_ESTABLISHED | 新融资/滚动融资利率高于被替换成本 → 到期或新借部分成本变化 → 有效付息成本逐步改变；现金和未来融资需要可能变化 | 长久期锁定旧利率；收入/增长改善；初级财政调整 | 以当日十年率乘全部存量的算法不成立；若到期结构或收入抵消则不能推出失控 |
| ME04 / CONDITIONAL_HYPOTHESIS | Treasury净发行/期限构成或投资者需求改变 → 私人需吸收的期限风险或美元安全资产需求改变 → 期限溢价与融资条件可能变化；美元储备/抵押资产使用与配置发生互动 | 国内储蓄与官方需求；发行期限缩短；央行持有及避险需求 | 私人吸收平稳且需求同步增加；一次弱拍卖被误解成长期财政危机 |
| ME05 / CONDITIONAL_HYPOTHESIS | 同期限融资利差、FX远期/基差或目标资产收益变化 → 对冲成本及组合净回报改变 → 机构可能调整hedge或资产配置；货币融资和债券需求可能变化 | 负债匹配/监管；市场已预期；自然币种收入和央行后备 | 只用两国政策率或居民净卖出推断carry；对冲后净回报/配置未变 |
| ME06 / CONDITIONAL_HYPOTHESIS | 未对冲日元负债组合遭汇率/资产损失或波动冲击 → 净值、抵押品或VaR余量下降 → 补保证金、降低风险或平仓；卖出目标资产、购回融资币种可能放大流动性压力 | 充足资本/抵押品；汇率对冲；融资展期、后备流动性和其他买家 | 组合已对冲或不受融资约束；仅价格共动，无仓位/融资证据；美国宏观消息等替代解释更强 |
| ME07 / CONDITIONAL_HYPOTHESIS | 原航路受限且实际改走更长路径 → 单航次时间/燃料及同船队占用增加 → 交付频次和库存需要改变；运价/下游成本可能变化 | 闲置船和新船；航速调整；需求减弱、库存及利润吸收 | 只有头条没有路线或交付变化；港口拥堵或需求变化更能解释费用 |

ME03的WELL_ESTABLISHED仅限再融资算术，不包含“债务危机/美元走弱”。其余完整经济链保守保留CONDITIONAL_HYPOTHESIS。T01/T02与跨主题L6均保留ALPHA_INFERENCE；外部引用支持组件，不把组合推断认证成事实。

## 4. 去重、关系与测量

- SWIFT层次只保留F03；M01/M05通过themeLinks和原文引用连接。A01另说司法约束，不重复基础设施定义。
- 储备与估值边界只保留F04；C02是它的一次日期化实例。债务口径为F05，C03为预测版本，FL01为端点/流关系，互相引用不复制数值。
- F02集中管理配额/产能/SPR的测量区别，C01专门保存EIA定义版本；F10只补航运单位，不创建通用测量引擎。
- A02虽使用FUNDS关系名，限定BACKSTOP_AUTHORIZATION_NOT_OBSERVED_DISBURSEMENT和AUTHORIZATION；不能解释成当日实际放款。
- FL01/FL02是没有当期量值的关系。period/magnitude未选定就为null，FL02连单位也须待具体油/气品类明确；不是零流量。
- JSON的aliases与aliasReferences指向同一个canonical ID；源URL相同的跨档案引用不算独立证实。

## 5. L1–L8逐条取舍

| 原边 | 决定 | 理由 / 关联机制 |
|---|---|---|
| L1 | KEEP_CANDIDATE | 保留物流关系；将原双向叙述收窄为运输约束→可交付供给。 ME01；FACTUAL_DEPENDENCY。 |
| L2 | KEEP_CANDIDATE | 保留法律与中介传导，删除任何全面禁运或必然少油暗示。 ME02；SUPPORTED_MECHANISM。 |
| L3 | KEEP_CANDIDATE | 保留资产角色，边际价格仍条件性。 ME04；FACTUAL_DEPENDENCY。 |
| L4 | KEEP_CANDIDATE | 保留工具连接，后备关系不作已提款。 ME05；SUPPORTED_MECHANISM。 |
| L5 | KEEP_CANDIDATE | 保留机构配置渠道，不推导必然资本回流。 ME05；SUPPORTED_MECHANISM。 |
| L6 | KEEP_CANDIDATE | 保留原有组合推断等级，不能从油价直跳财政主导。 ME01；ALPHA_INFERENCE。 |
| L7 | DOSSIER_ONLY | 航运→营运资金→美元压力尚无实际授信证据，且反向准入成本已在ME02；避免复制一个更长、未识别的反馈环。 |
| L8 | DOSSIER_ONLY | 日本进口成本→政策预期→carry的中间链尚无当前直接证据；保留原档案研究问题，不建立航运→平仓快捷边。 |

L1收窄方向为运输约束→能源可交付性；L3只保留美元资产角色；L6必须观察成本、政策/利率及到期再融资，不能直跳“财政主导”。L7/L8留原研究，未生成候选边。没有无条件Oil→Gold或Yen→IBIT边。

## 6. 冲突与未知不能被压缩掉

- **Malacca / CONFLICTED**：2025Q4同源Table2总量24.9、Table3总量24.0百万桶/日，分项相加24.9也不能替发布方选值。两条主张、同一源ID和表位置保留，canonicalValue为null。
- **EIA定义 / UNBRIDGED**：新旧版本不是同日两种真相；旧30/90简称未重建完整约束，不能悄悄接到新序列。C01保留带日期的新方法，未声称已经解决桥接。
- Q01–Q05分别保留可出口备用产能、制裁实际影响、当前财政主导识别、全球carry净暴露、逐航线保险成本。JSON写明需什么证据才能解决，并保持resolvedBy为null。

同一来源内的冲突没有投票或按算术自动解决。单次访问失败是研究过程记录；它造成的覆盖限制会继续附在候选上，不等于永久宣告该来源不可用。

## 7. 最小未来生命周期建议（未实现）

| 类型 | 何时复核 / 什么会陈旧 | 怎样替代 | 绝不静默覆盖 |
|---|---|---|---|
| STRUCTURAL | 定义、制度或适用范围变化 | 新版本引用supersedes与理由 | 原定义、证据及限制；未知validFrom/To不补造 |
| HISTORICAL | 发现原始记载错误或可靠更正 | 追加correction并引用原记录 | 原历史叙述/日期；不得改成当前状态 |
| CURRENT_STATE | 新发布、修订、实施证据或事件变化 | append/supersede，保留源日期、观察期和接收时间 | 原vintage、预测/实绩区别、冲突值 |
| MECHANISM | 新研究、反证或适用范围改变 | 修改证据等级须形成新版本 | 原counterforce、falsification和作者归属 |
| ACTOR_RELATION | 法律/成员/设施安排变化 | 新关系版本，区分生效日与观察日 | 原限制、授权与实际使用的差别 |
| FLOW_RELATION | 端点、统计方法、工具结构变化 | 关系版本与日期化数值分开 | STOCK/FLOW/CAPACITY/AUTHORIZATION/ANNOUNCEMENT/VALUATION_CHANGE |
| WATCH_QUESTION | 数据覆盖、研究目的或时滞改变 | 改问题版本/记录不再适用 | 不能证明什么；不得借此自动建connector |
| OPEN_QUESTION | 得到足够匹配证据 | 用新knowledge item解析并链接resolvedBy | 原问题及当时不知道什么 |
| TRANSMISSION_CHANNEL | 中间机制/资产覆盖证据变化 | 保留ALPHA_INFERENCE，提升需明确外部支持及再审批 | 原替代解释；不转成方向规则 |

这是供下一阶段讨论的设计说明，不是production schema或生命周期引擎。即使内容通过审批，后续运行时集成仍需另行授权。

## 8. 语义自审与核验范围

逐条对照原档案的限定、估计/实测、授权/流量、存量/估值、机构研究/政策、Alpha推断/外部事实、当前/历史与替代解释。压缩稿已将ME03收窄为固定利率债务合同付息，不否认市场价格重估；ME06保留主动减仓可能；F11不提升来源映射未充分展开的TIPS成分细节。另收窄了L1方向和L3价格外推；L6保留推断，L7/L8未提升；无发布日期运营通知被降级；没有把历史40万亿日元carry估计放进当前状态。

有效ID/链接只证明能定位，不证明语义正确。所有候选的dossierRefs定位具体章节，sourceRefs指向JSON sourceMap中的原档案M节条目（含原有阅读粒度与限制），sourceBatch保存原文件SHA256。全包为同一Codex的语义自审；Owner未确认。

本次核验通过：五主题覆盖，64个跨类别稳定ID唯一，153处档案章节引用与43个源映射条目有效，8条原边均有取舍；CURRENT_STATE日期齐全，条件/推断等级和两项冲突均保留，JSON可解析。复用现有Markdown/密钥检查并核对锚点、敏感内容与六份原文件Git内容及SHA256，最终零失败。首次临时校验调用因Windows路径分隔格式不同产生“仓库外链接”误报，统一调用上下文的路径格式后重跑通过，未修改项目检查器或产品代码。Git暂存范围与diff检查在提交前另行核对；没有全量产品测试。上述机械检查不认证知识语义。

## 9. 使用量与审批交接

本轮web搜索0、网页/文档外部读取0、应用Host生成接口0、新增模型API0、市场/券商调用0；只读取本地已保存研究。Codex本次生成与推理并非零消耗，内部token/美元账单未知。**USD COST UNKNOWN**。Git远端读回与正常push属于版本保存，非行情或资料源调用。只新增本目录三个review artifacts；无原始版权全文、私有runtime数据、应用代码或依赖变更。

Owner/ChatGPT可逐项保留、要求修改或拒绝，并注明reviewLabel/canonical ID及理由；目前没有任何条目被标为批准。审阅原意不是统一打绿，而是决定哪些限定值得长期保留。

**NONE OF THESE CANDIDATES ARE RUNTIME KNOWLEDGE YET.**
