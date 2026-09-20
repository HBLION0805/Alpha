Status: RESEARCH_ONLY_NOT_RUNTIME_KNOWLEDGE

# M08 — AI, Power and Data Centers

研究日期2026-09-20（America/New_York）。Codex/Alpha整理与同人反证自审，非独立审核。仅研究，不接入runtime、新闻关联或交易计划。来源范围/时钟见M。

## A. Executive definition

AI服务只有经过芯片交付、机房建设、连接电网或合格自备电源、冷却及实际利用，才成为持续能源需求。某项目卡在其中一环，后面所有宣布的功率都可能暂不兑现。因此芯片、机房、电网和发电是互补投入；需求并非由一张GPU订单或一个GW新闻数字决定。[S01/S02/S05]

Owner的 compute → chips → data centers → electricity → grid → generation → CapEx 链条得到**有条件机制**支持；顺序并不总是单向：长期电力合同与资本融资也会先约束可建设规模。不能从“AI很重要”推出所有燃气、核能、公用事业或矿业投资都会盈利。

## B. Historical development

| 日期/阶段 | 变化 | 证据性质 |
|---|---|---|
| 2020–2025 | AI服务器功率密度上升，加大散热与供电设计要求 | IEA回顾 S01；密度不是全球耗电量 |
| 2024基期 / 2025-04报告 | IEA建立数据中心需求与不同供电路径情景 | S02；2024估计与2030预测分开 |
| 2025实际期 | 数据中心建设需求上升，但融资、接网和设备不随公告同步 | S01的2026回顾，机构估计非逐表计审计 |
| 2026-01-14 | PJM更新大负荷核实方法，较前版下调近期增量，同时仍预测长期增长 | S03，反例：预测可下调，不只是线性上调 |
| 2026-04-16 | IEA更新2030中央情景，并指出近期瓶颈 | S01，未来预测 |
| 2026-07-14 | NRC发布Crane重启项目公共更新会通知 | S06索引；程序推进不是已重启发电 |
| 2026-07-29 | Microsoft公布FY2026现金流 | S04，公司全口径实际财务披露，不等于AI专属支出 |

## C. Actors

Hyperscalers/模型与云客户、芯片设计者与制造商、机房开发商、供电公用事业、电网运营者、独立发电商、天然气供应商/管道、核电运营者与开发商、监管机构、当地政府、居民和用水者、债权人与设备商。客户需求、供电责任和风险承担主体不相同。

## D. Actor positions, actions, interests and constraints

| 主体 | 观察/立场 | 激励与制约（推断须验证） |
|---|---|---|
| Hyperscalers / 客户 | 企业财报实际支出可核 [S04]；IEA讨论资本市场融资重要性 [S01] | 利用率、收入、算力价格、资产寿命与融资；不是每笔capex都为AI |
| 芯片设计/制造/封装商 | 供应GPU/ASIC、HBM、网络等互补件 [S05] | 良率、交期、许可和订单质量；订单增长不证明客户能接电 |
| Data-center developers | 取得土地、许可、建房、设备及供电安排 | 已签租约、客户信用、取消条款、施工与水；项目挂牌不是完成 |
| Utilities / grid operators | PJM核验大负荷并调整预测 [S03] | 可靠性、成本回收、变压器/线路、连接队列和非AI居民需求 |
| Independent power producers | 提供容量、电能或PPA服务；各企业当前合同未逐家读 | 电价/合同收益与燃料、排放、建设成本；容量收入不等于电量 |
| Gas suppliers / pipelines | 燃料必须可送达具体机组；IEA讨论能源供给路径 [S02] | 气价、管道许可、季节高峰和燃机交付；天然气资源多不等于当地供电快 |
| Nuclear operators/developers | NRC重启程序是可定位案例 [S06] | 安全许可、检修、燃料、融资、工期；PPA不能替代运行许可 |
| Regulators / local government / communities | 当前个别许可、税收和水协议未系统读取，UNKNOWN | 税基、就业、居民电价/水与生态约束可能冲突，不能声称当地一致欢迎或反对 |

## E. Flows

| 类型 / 流向 | 应保留的单位和状态 | 本批可核事实 / 缺口 |
|---|---|---|
| ANNOUNCEMENT | GW announced：意向项目和完整时间表 | 不能与多个阶段的同一项目重复相加 |
| CAPITAL_COMMITMENT | 合同额、融资额、PPA约定MW/GW和年限 | 是否可撤销、最低付款、信用支持须看合同；不是现金已付 |
| CAPITAL_DISBURSEMENT / FLOW | 现金流量表PP&E支出、实际已付建设款 | Microsoft FY截至2026-06-30为$115,948 million PP&E现金流出，FY2025 $64,551 million [S04]；不是全球或纯AI支出 |
| CAPACITY | GW contracted / interconnected / energized | 签供电协议、完成接网、现场带电是不同里程碑；“已接网”也未必满负荷 |
| ELECTRICITY_LOAD / FLOW | MW瞬时或峰值；MWh/TWh期间耗电 | IEA估计2025所有数据中心485TWh；2030中央预测950TWh [S01]，不是AI专属实绩 |
| 芯片 FLOW / STOCK | 出货件数、已安装量、运行利用率 | 装机可包含闲置、备件和非AI负载；不能用全部compute代表AI workload |
| Gas / nuclear fuel / generation | 燃料量、机组MW、实际发电MWh | 电网送出、停机与燃料供应限制；新增机组不等于全部电供AI |
| Land / water | 土地面积是STOCK；取水/消耗水是不同FLOW | 本批没有项目表计和许可上限，UNKNOWN；不能跨冷却工艺/流域直接平均 |

**口径检查：**能源=功率随时间积分。额定GW×全年小时只给满负荷上界示意，不能当实际MWh；需利用率、负荷曲线、PUE及边界。IEA2025报告的供电侧“发电量”与机房侧“耗电量”还可能含输配损失差异，不能把不同边界当修订冲突。[S02] 公司现金PP&E、融资租赁资产增加和未来承诺也不得相加冒充同一现金支出。

## F. Causal mechanisms

1. **SUPPORTED_MECHANISM：算力服务需求 → 部署 → 电能。** 付费工作负载与设备功耗/利用率共同决定需求；模型效率改善会降低每项任务耗能，也可能因更便宜诱发更多使用，净效应需观察。[S01/S02]
2. **CONDITIONAL_HYPOTHESIS：集聚负荷 → 地方电网瓶颈 → 建设。** 同一全球TWh放在不同节点，输电/容量影响不同；PJM核实后的近期预测下调说明排队项目不全兑现。[S03]
3. **ALPHA_INFERENCE：长期PPA → 融资可行性。** 合同可锁收入而帮助投资，但价格、取消风险及接网延误决定银行是否放款；没有合同与提款资料，不能推定具体投资已经完成。
4. **CONDITIONAL_HYPOTHESIS：电力紧缺 → 燃气/核能等供给选择。** 取决于建设/重启工期、许可、成本、燃料与24小时可靠性；可再生加储能、需求响应、选址迁移也可竞争。[S02/S06] 不把一种能源宣布为必然赢家。

## G. Competing explanations

| 解释 | 支持与反例 | 判定边界 |
|---|---|---|
| AI带来持续大幅负荷增长 | IEA中央情景支持增长；设备/接网/融资瓶颈限制近期上行 | 机构预测，非已发生 [S01] |
| 效率会令总耗电下降 | 单任务效率可提高；更大模型、更多推理和低价使用可能抵消 | 净方向UNKNOWN，不能只读芯片能效指标 |
| 公告项目重复和竞争性排队夸大需求 | PJM更严格核实后近期预测下调 [S03] | 不能因此认定全部AI需求虚构；需分项目去重 |
| 全部机房CapEx都是AI增长 | 公司合并报表确有现金支出 | 传统云、替换资产、办公设备和租赁边界未分解，AI金额UNKNOWN [S04] |

## H. Current structure

本次读取的最新IEA中央情景发布于2026-04-16，2025为估计历史值、2030为预测；IEA说AI相关机房耗电增长较全体更快，不能把950TWh全部标为AI。[S01] PJM 2026版本同时保留长期增长与近期下修，证明必须按地域、年份与核实程度分析。[S03]

Microsoft 2026-07披露现金PP&E支持“真实资本投入存在”，不证明每个机房已带电或投入回报合格。[S04] Crane个案只获得NRC2026-07通知索引，正文403；**当前发电/恢复商业运行状态未验证**。[S06] 不把重启通知或商业合作当持续供电结果。

## I. Watch indicators

只保留问题：项目有多少已带电且实际用电？电网批准负荷是否有客户押金和阶段约束？PP&E现金/融资租赁/未来承诺怎样调节？订单取消与利用率如何？燃机、变压器或核许可谁在关键路径？水约束属于取水还是消耗水？新增负荷成本由项目还是其他用户承担？不建立自动监控。

## J. Cross-theme links

| 连接 | 类型 / 依据 / 反证 |
|---|---|
| [M06半导体](M06_CHINA_TAIWAN_SEMICONDUCTORS.md#e-flows) | FACTUAL_DEPENDENCY：硬件互补 [S05]；供应有余而电网受限时，芯片不再是当前瓶颈 |
| [M09铜/铀](M09_AFRICA_STRATEGIC_RESOURCES.md#f-causal-mechanisms) | CONDITIONAL_HYPOTHESIS：电网/发电投入可增加材料需求 [S02；M09 S01]；没有AI特定采购证据，不把每吨铜/铀归因AI |
| [Batch1油与能源](../batch-1/M01_OIL_IS_POWER.md#f-causal-mechanisms) | ALPHA_INFERENCE：气、电与油的替代和成本关系须逐地区；数据中心用电不等于直接消费同量原油 |
| [Batch1融资](../batch-1/M03_DEBT_AND_FISCAL_DOMINANCE.md#f-causal-mechanisms) | SUPPORTED_MECHANISM：资本密集项目受融资约束 [S01]；不据此断言财政主导 |

## K. Relevance to Alpha

ALPHA_INFERENCE：intermediateVariables = 真实投产/耗电、燃料和电价、设备订单、融资利差、利润与增长/通胀预期；counterforces = 效率、取消、迁址、其他需求走弱、供给扩张；requiredObservations = 原始财报/接网/表计/电价与市场预期；falsification = 项目未投产、需求未增或价格已经消化。对GLD需看实际利率/美元，对IBIT需独立观察融资与风险偏好；AI叙事不提供固定交易方向。

## L. Open questions

全球已energized且由AI实际使用的GW无法从公开公告合成；选定项目的实际MWh、水消耗、融资提款及PPA条款缺失。Crane当前运行状态未核。Microsoft合并支出中AI占比未知。IEA2026中央情景不能代替项目银行可融资预测。

## M. Source map

retrievedAt均2026-09-20 UTC；多份IEA材料具有继承关系，不当独立验证。

| ID | sourceDate / period；来源 | 阅读范围 / retrievedAt |
|---|---|---|
| S01 | 2026-04-16；2025估计、2030中央情景；[IEA Key Questions](https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary) | 执行摘要：485/950TWh、瓶颈/融资/负荷；19:23:53Z，复核19:31:51Z；[出版日期页](https://www.iea.org/reports/key-questions-on-energy-and-ai)检索19:30:50Z |
| S02 | 2025-04；2024基期/2030情景；[IEA Energy supply for AI](https://www.iea.org/reports/energy-and-ai/energy-supply-for-ai) | 搜索返回供电侧节选，19:23:27Z；不宣称完整章节/所有情景已读 |
| S03 | 2026-01-14；2026–2046预测；[PJM forecast update](https://insidelines.pjm.com/pjms-updated-20-year-forecast-continues-to-see-significant-long-term-load-growth/) | 运营者完整短说明、近期下修和大负荷核实，19:24:39Z |
| S04 | 2026-07-29；FY截至2026-06-30及FY2025；[Microsoft FY26 Q4 release](https://www.microsoft.com/en-us/investor/earnings/fy-2026-q4/press-release-webcast) | 现金流表单位、四列期间及PP&E行，19:31:23Z、19:31:51Z；发布页注明Unaudited。SEC10-K正文另次失败，未冒称本批读完审计报告 |
| S05 | 2025-06-24；产业分工；[OECD semiconductor mapping](https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/06/mapping-the-semiconductor-value-chain_5ba52971/4154cdbf-en.pdf) | 与M06 S12同一份，PDF pp9–18，19:24:39Z；不是另一独立证据 |
| S06 | 2026-07-14；Crane重启程序；[NRC advisory](https://www.nrc.gov/about-nrc/news-releases/2026/nrc-advisory-nrc-update-public-crane-clean-energy-center-restart) | 仅索引通知，19:25:05Z；正文及设施页均403，不据此判断已供电 |

## N. Adversarial review

已将“已签电力=已用电”“预计GW=已投产”“机房总量=AI量”“所有公司CapEx=AI现金”全部拆开。额定功率与期间电量不相加；未用总投资现金流替代PP&E，也未把余额增量当现金。保留PJM下修与效率反例，不因AI主题选择有利预测。政治/产业叙事没有转换成资产方向。

Owner提出的软件之外的实物链得到支持；固定能源赢家和无瓶颈指数增长没有得到证明。继续RESEARCH_ONLY_NOT_RUNTIME_KNOWLEDGE，等待Owner/ChatGPT review。
