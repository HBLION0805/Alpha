Status: KNOWLEDGE_CANDIDATE_NOT_APPROVED
Runtime use: PROHIBITED
Owner approval required: YES

# Batch 2 Knowledge Review Gate

Review stage: **OWNER_REVIEW_READY**。提取/同人自审：Codex，2026-09-20T20:53:54.892Z。依据已保存的Batch 2提交 b57f983ce48ca6b778cc918a544d3be7573ec783；没有新的外部原文核验，没有Owner或独立ChatGPT审批记录。原六份dossier的状态及内容不变，仍为RESEARCH_ONLY_NOT_RUNTIME_KNOWLEDGE。

本包建议15–30分钟审阅：先看17项长期候选，再看机制反例、版本差与排除项；按标签给Approve / Revise / Reject即可。批准仍需明确范围，不能把本报告或同一Host的自审当Owner确认。

- [候选JSON及完整出处](BATCH_2_KNOWLEDGE_CANDIDATES.json)：稳定ID、主体/证据、来源时钟、限制、去重、边和审阅决定。
- [不提升/拒绝清单](BATCH_2_REJECTED_OR_DOSSIER_ONLY.md)。
- [原Batch 2 synthesis](../BATCH_2_SYNTHESIS.md)，以及只读参照的[Batch 1 review](../../batch-1/review/BATCH_1_KNOWLEDGE_REVIEW.md)和[已批准目录](../../../../../src/engines/macro-world-model/BATCH_1_WORLD_MODEL_V1.json)。

## 1. 数量、范围与审批单位

**36条知识审阅记录**：17项长期核心（1 STRUCTURAL_FACT、4 CONCEPTUAL_BOUNDARY、12 MEASUREMENT_FRAMEWORK），4 MECHANISM，5 WATCH_QUESTION，6 OPEN_QUESTION，4 CONFLICT。另有4条候选边，不算重复知识主体。CURRENT_STATE、HISTORICAL_FACT、ACTOR_RELATION、STRUCTURAL_FLOW_RELATION、HYPOTHESIS_ONLY_CONTEXT均为0新增。7组DOSSIER_ONLY、13组REJECT_FROM_RUNTIME不计作知识候选。

本批没有为了类别齐全制造条目。历史案例作为带日期出处；易变股权、贷款、许可、工期和量值留档案。actor/flow的高频结构已在K03/K12/K14及机制中表达；不再复制关系节点。知识正确性不由条目数或结构校验决定。

JSON各项都有candidate → dossier section → sourceRefs → 原M节记录链；49项source map不等于49份全文或49次独立验证。政治立场、公司报告、模型和索引节选的覆盖限制保留；原研究接收时钟与本次reviewedAt不同。

## 2. 最值得长期提升的17项

以下全部为PROMOTE_CANDIDATE；VERIFIED仅沿用原档案范围内的具体事实/定义标签，不代表本轮外部认证或Owner审批。概念和测量边界优先按本身类型存放，不硬装成经济结果事实。

| 标签 / 类型 | 候选核心及不可越过的边界 | 依据 |
|---|---|---|
| B2-K01 / CONCEPTUAL_BOUNDARY | PRC One-China Principle、US One-China Policy、台湾特定机关在特定时期的法律/政策表述必须分别归属；公司活动和分析解释不代替任何一方的正式立场。<br>**限制：**只确认术语、主体和归属边界，不裁判主权或把PRC立场当普遍法律事实。 MAC两项仅有历史/当期索引节选，不能推广为所有台湾政党或当前完整法律解释；各文件日期保留在sourceMap。 | [M06 §A](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#a-executive-definition)、[M06 §D](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#d-actor-positions-actions-interests-and-constraints)、[M06 §N](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#n-adversarial-review)；M06.S01 / M06.S02 / M06.S03 / M06.S04 / M06.S05 / M06.S06 |
| B2-K02 / CONCEPTUAL_BOUNDARY | 台湾相关问题包含历史、治理、政治和区域安全层面，早于现代先进芯片产业；产业依赖既不能独自解释冲突，也不能保证和平。<br>**限制：**历史先后只反驳单一芯片解释，不证明另一种单一动机；不估算冲突概率、时间或硅盾威慑效果。 | [M06 §A](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#a-executive-definition)、[M06 §B](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#b-historical-development)、[M06 §G](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#g-competing-explanations)；M06.S01 / M06.S02 / M06.S06 |
| B2-K03 / STRUCTURAL_FACT | 半导体体系由设计/IP与EDA、设备、材料、晶圆制造、memory及封装测试等互补环节组成；一个环节领先不证明其他环节供应充足。<br>**限制：**OECD材料存在同源继承，M06.S12与M08.S05是同一文献，不算独立证实。 不固定企业排名、国家份额或当前瓶颈；不同产品组合仍需核实。 | [M06 §D](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#d-actor-positions-actions-interests-and-constraints)、[M06 §E](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#e-flows)、[M06 §F](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#f-causal-mechanisms)、[M08 §E](../M08_AI_POWER_DATA_CENTERS.md#e-flows)；M06.S12 / M06.S14 / M08.S05 |
| B2-K04 / MEASUREMENT_FRAMEWORK | 比较晶圆能力必须注明节点、产品、单位与期间，并区分额定/等效能力、合格良品产出、实际shipment及客户可切换的替代能力。<br>**限制：**公司量产声明不是独立工程验收；跨厂良率和切换周期未知。 节点名称、12英寸等效量和厂房面积不能直接形成技术或可替代性排名。 | [M06 §D](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#d-actor-positions-actions-interests-and-constraints)、[M06 §E](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#e-flows)、[M06 §H](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#h-current-structure)；M06.S07 / M06.S08 / M06.S12 |
| B2-K05 / MEASUREMENT_FRAMEWORK | 半导体份额必须匹配分母、年份、技术范围和公司/行业边界；TSMC Foundry 2.0口径包含封装测试、掩模和非存储IDM，不能直接当传统foundry份额。<br>**限制：**只把FY2025报告中的定义作为带版本的例子，不永久冻结市场定义或40%数值。 未取得同期间同方法的传统foundry数值；不得相减、平均或选更大值。 | [M06 §H](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#h-current-structure)、[M06 §M](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#m-source-map)、[M06 §N](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#n-adversarial-review)；M06.S07 / M06.S12 |
| B2-K06 / MEASUREMENT_FRAMEWORK | 总贸易量/名义值、增长率、trade/GDP、双边路线和增加值是不同问题；WDI trade/GDP为货物服务进出口之和/GDP，不是外国净增加值占比。增长放缓和贸易转移均不等于总量下降。<br>**限制：**贸易/GDP可受价格、GDP和中间品多次跨境影响；长期同口径序列仍未重建。 不能由一年估计、一个双边分组或关税标题认定全球化长期结束。 | [M07 §A](../M07_GLOBALIZATION_RECONFIGURATION.md#a-executive-definition)、[M07 §E](../M07_GLOBALIZATION_RECONFIGURATION.md#e-flows)、[M07 §G](../M07_GLOBALIZATION_RECONFIGURATION.md#g-competing-explanations)；M07.S01 / M07.S02 / M07.S03 / M07.S04 |
| B2-K07 / MEASUREMENT_FRAMEWORK | 第三地出口增加须区分转运、当地加工/增加值增长与工厂重配；reshoring是生产回到本国，near-shoring是靠近市场，二者不能仅由出口路线证明。FDI流量、存量、估值与新厂公告也不能代替投产证据。<br>**限制：**IMF工作论文是不同样本/方法的作者分析；越南结果不推广所有连接国。 没有企业级证据不能认定逃税/洗产地；供应商国家数增加不保证最终上游更分散。 F04仅复用存量/估值/交易识别原则，不把COFER规则套用FDI。 | [M07 §D](../M07_GLOBALIZATION_RECONFIGURATION.md#d-actor-positions-actions-interests-and-constraints)、[M07 §E](../M07_GLOBALIZATION_RECONFIGURATION.md#e-flows)、[M07 §F](../M07_GLOBALIZATION_RECONFIGURATION.md#f-causal-mechanisms)、[M07 §G](../M07_GLOBALIZATION_RECONFIGURATION.md#g-competing-explanations)；M07.S04 / M07.S05 / M07.S06 |
| B2-K08 / MEASUREMENT_FRAMEWORK | 同一数据中心项目的announced、contracted、interconnected、energized与actual load是不同阶段；应按项目去重并标明阶段，不能把各阶段容量相加。带电或接网也不证明满负荷运行。<br>**限制：**阶段标签来自档案分析框架，不是声称各地运营商拥有统一认证枚举。 PJM近期下修只是一个有日期的预测修订例子，不证明全部AI需求虚构。 | [M08 §E](../M08_AI_POWER_DATA_CENTERS.md#e-flows)、[M08 §F](../M08_AI_POWER_DATA_CENTERS.md#f-causal-mechanisms)、[M08 §N](../M08_AI_POWER_DATA_CENTERS.md#n-adversarial-review)；M08.S01 / M08.S03 |
| B2-K09 / MEASUREMENT_FRAMEWORK | GW/MW表示功率或额定能力，MWh/TWh表示期间能量；实际能量需负荷随时间积分。供电侧发电量与机房侧耗电还需说明输配损失及计量边界。<br>**限制：**额定功率乘全年小时只是满负荷示意，不是实测电量；应考虑利用率、PUE、边界和期间。 S02只读取供电侧节选，不据此重建完整模型或损失系数。 | [M08 §E](../M08_AI_POWER_DATA_CENTERS.md#e-flows)、[M08 §N](../M08_AI_POWER_DATA_CENTERS.md#n-adversarial-review)；M08.S01 / M08.S02 |
| B2-K10 / MEASUREMENT_FRAMEWORK | 全部数据中心耗电、AI专用工作负载、已安装计算设备和实际利用率不是同一统计对象；全机房TWh或GPU装机不能直接替代AI实耗。<br>**限制：**IEA历史估计和未来中央情景分开；本批AI实际energized/用电份额仍未知。 单任务能效提高不决定总耗电方向，使用量可以变化。 | [M08 §A](../M08_AI_POWER_DATA_CENTERS.md#a-executive-definition)、[M08 §E](../M08_AI_POWER_DATA_CENTERS.md#e-flows)、[M08 §H](../M08_AI_POWER_DATA_CENTERS.md#h-current-structure)；M08.S01 / M08.S05 |
| B2-K11 / MEASUREMENT_FRAMEWORK | 公司现金PP&E、融资租赁资产增加、未来投资承诺和AI专属CapEx需分别识别；合并公司支出未经用途分解不能称AI投资，也不能把现金与非现金项目重复相加。<br>**限制：**Microsoft FY2026为Unaudited发布页，SEC全文未读；不把示例数值当全球AI支出。 用途分解及租赁调节不足，AI金额未知；不构造统一跨公司会计口径。 | [M08 §E](../M08_AI_POWER_DATA_CENTERS.md#e-flows)、[M08 §G](../M08_AI_POWER_DATA_CENTERS.md#g-competing-explanations)、[M08 §N](../M08_AI_POWER_DATA_CENTERS.md#n-adversarial-review)；M08.S04 |
| B2-K12 / MEASUREMENT_FRAMEWORK | 矿山股权、矿产生产、加工/精炼、出口许可及实货、运输路线、融资权利需逐主体/产品分开；矿权不直接证明国家全部资源流或政治控制。<br>**限制：**DRC、Zambia、Angola与Niger不是同一案例；Mopani和Lobito没有已核共同货流。 氢氧化钴不是电池级成品；USGS仅节选，不证明当前配额执行。 | [M09 §A](../M09_AFRICA_STRATEGIC_RESOURCES.md#a-executive-definition)、[M09 §D](../M09_AFRICA_STRATEGIC_RESOURCES.md#d-actor-positions-actions-interests-and-constraints)、[M09 §E](../M09_AFRICA_STRATEGIC_RESOURCES.md#e-flows)、[M09 §N](../M09_AFRICA_STRATEGIC_RESOURCES.md#n-adversarial-review)；M09.S01 / M09.S04 / M09.S06 / M09.S07 |
| B2-K13 / MEASUREMENT_FRAMEWORK | 集团营收、项目产量、税费实际到账、存量/转入岗位、新增净就业与社区收益成本分别计量；公司或国家总量不能替代当地居民的净分配结果。<br>**限制：**当前本地税收、补偿、就业净额和社区独立材料不足；不能推定外资必无收益或国有化必全民受益。 净分配需要明确基准、成本和受益主体，不由宣传目标填值。 | [M09 §E](../M09_AFRICA_STRATEGIC_RESOURCES.md#e-flows)、[M09 §G](../M09_AFRICA_STRATEGIC_RESOURCES.md#g-competing-explanations)、[M09 §L](../M09_AFRICA_STRATEGIC_RESOURCES.md#l-open-questions)、[M10 §D](../M10_BELT_AND_ROAD.md#d-actor-positions-actions-interests-and-constraints)；M09.S02 / M09.S06 / M09.S08 / M09.S09 / M10.S02 |
| B2-K14 / CONCEPTUAL_BOUNDARY | BRI是倡议框架，不能当统一债权人、合同或项目公司；项目归属、业主、借款人、建设/运营方与债权人必须按具体材料识别。<br>**限制：**白皮书只有官方发布介绍，不升级为全部正文已核；共同发展是官方目标而非效果证明。 中国企业承包、SOE投资或跨境铁路身份不自动赋予BRI标签；本批不改写Lobito归属。 | [M10 §A](../M10_BELT_AND_ROAD.md#a-executive-definition)、[M10 §C](../M10_BELT_AND_ROAD.md#c-actors)、[M10 §D](../M10_BELT_AND_ROAD.md#d-actor-positions-actions-interests-and-constraints)；M10.S01 / M10.S02 / M10.S03 / M10.S06 |
| B2-K15 / MEASUREMENT_FRAMEWORK | Grant、贷款、equity描述工具，优惠/商业描述条款，policy bank/SOE描述主体，PPP/BOT描述合同与风险分配；这些维度可重叠，不能当互斥的融资类别。<br>**限制：**优惠贷款仍是债务，政策银行贷款未必优惠，SOE投资不自动是援助；grant也可有用途条件。 AidData是合同样本研究发布说明，不是全部BRI合同普查或本轮逐份合同审核。 | [M10 §E](../M10_BELT_AND_ROAD.md#e-flows)、[M10 §F](../M10_BELT_AND_ROAD.md#f-causal-mechanisms)、[M10 §N](../M10_BELT_AND_ROAD.md#n-adversarial-review)；M10.S02 / M10.S03 / M10.S06 / M10.S09 |
| B2-K16 / MEASUREMENT_FRAMEWORK | 项目债、SOE债、主权债及担保债按借款人、追索权和担保分层；不能把全部项目债算主权债，也不能因SPV有股本便漏掉政府为注资而借的债。<br>**限制：**具体政府担保、有限责任和后续条款须逐合同核实；不假设所有SOE债都有主权担保。 老挝2020融资是当时计划结构，不证明当前余额或全部提款。 | [M10 §E](../M10_BELT_AND_ROAD.md#e-flows)、[M10 §F](../M10_BELT_AND_ROAD.md#f-causal-mechanisms)、[M10 §N](../M10_BELT_AND_ROAD.md#n-adversarial-review)；M10.S03 / M10.S06 / M10.S09 |
| B2-K17 / CONCEPTUAL_BOUNDARY | 基础设施实际使用证明发生过服务或运输，不证明收费覆盖维护、资本和偿债，也不证明净社会收益或其分配；项目重组/长期租赁本身不证明预设债务陷阱。<br>**限制：**Chatham House对汉班托塔的解释有归属，不是法律裁决或所有BRI项目免责。 2017合同和2025货量不能证明2026利润、现行军用安排或永久商业用途。 | [M10 §F](../M10_BELT_AND_ROAD.md#f-causal-mechanisms)、[M10 §G](../M10_BELT_AND_ROAD.md#g-competing-explanations)、[M10 §H](../M10_BELT_AND_ROAD.md#h-current-structure)；M10.S02 / M10.S03 / M10.S04 / M10.S06 / M10.S07 / M10.S08 |

M06的K01不建立统一ONE_CHINA_POLICY节点：PRC原则、US政策、台湾具体机关/时期的表述、企业行为、分析者解释分别归属。K02不裁判主权或隐藏动机；K05不把公司Foundry 2.0份额转成传统foundry份额。其余计量候选同样约束“能比较什么”，不是赋予价格方向。

## 3. 每主题的取舍总览

MECHANISMS对应MECHANISM_CANDIDATE；WATCH与OPEN分别是WATCH_QUESTION_CANDIDATE和OPEN_QUESTION。没有适合提升的类型明确为0。共享机制只保存一次，通过themeLinks复用。

| 主题 | PROMOTE | CURRENT_STATE | MECHANISMS | ACTOR / FLOW | WATCH / OPEN | DOSSIER_ONLY | REJECT | CONFLICTS |
|---|---|---|---|---|---|---|---|---|
| M06 | B2-K01、B2-K02、B2-K03、B2-K04、B2-K05 | 0；不提升易变状态 | B2-ME01、B2-ME02 | 0 / 0；具体关系留档案 | B2-W01 / B2-Q01 | B2-D01、B2-D06、B2-D07 | B2-R01、B2-R02、B2-R09、B2-R13 | B2-CF01 |
| M07 | B2-K06、B2-K07 | 0；不提升易变状态 | B2-ME01、B2-ME03 | 0 / 0；具体关系留档案 | B2-W02 / B2-Q02 | B2-D02、B2-D06、B2-D07 | B2-R03、B2-R04、B2-R09、B2-R13 | B2-CF02、B2-CF03 |
| M08 | B2-K08、B2-K09、B2-K10、B2-K11 | 0；不提升易变状态 | B2-ME02、B2-ME04 | 0 / 0；具体关系留档案 | B2-W03 / B2-Q03 | B2-D03、B2-D06、B2-D07 | B2-R05、B2-R06、B2-R09、B2-R13 | 0（不为补类别新增） |
| M09 | B2-K12、B2-K13 | 0；不提升易变状态 | B2-ME03、B2-ME04 | 0 / 0；具体关系留档案 | B2-W04 / B2-Q04、B2-Q05 | B2-D04、B2-D06、B2-D07 | B2-R07、B2-R08、B2-R09、B2-R11、B2-R13 | B2-CF04 |
| M10 | B2-K14、B2-K15、B2-K16、B2-K17 | 0；不提升易变状态 | B2-ME03、B2-ME04 | 0 / 0；具体关系留档案 | B2-W05 / B2-Q06 | B2-D05、B2-D06、B2-D07 | B2-R09、B2-R10、B2-R11、B2-R12、B2-R13 | 0（不为补类别新增） |

## 4. 机制：中间环节、反作用与证伪

| 标签 / 等级 | 触发 → 一阶 → 后续影响 | 反作用 / 可观察确认 / 证伪 | 时间及出处 |
|---|---|---|---|
| B2-ME01 / CONDITIONAL_HYPOTHESIS | 适用产品、目的地或最终用户的许可条件实际执行且成为约束 → 获货能力、合规成本或交付时间变化 → 替代技术/供应商被验证或启用；采购、生产布局可能调整；不能推出全球贸易收缩 | **反作用：**许可例外或条件获批；合格替代、库存和工艺改良；需求下滑使限制不再绑定<br>**确认：**有效条款与实际拒批/装运；匹配产品的交付/成本及合格替代；企业实际产量或生产地变化<br>**证伪：**规则并未适用于相关产品或许可未形成约束；库存/替代充分，交付与生产未受影响；只有贸易路线改名而无生产迁移 | 许可/装运按日到月；资格/迁厂可跨季度或年，无固定滞后<br>[M06 §F](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#f-causal-mechanisms)、[M06 §J](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#j-cross-theme-links)、[M07 §F](../M07_GLOBALIZATION_RECONFIGURATION.md#f-causal-mechanisms)；M06.S09 / M06.S11 / M07.S04 / M07.S05 |
| B2-ME02 / SUPPORTED_MECHANISM | 实际工作负载增长且设备、机房与供电可投入使用 → 设备利用率和负荷曲线改变用电需求 → 局部电网约束可能延缓部署或改变选址；可能引出发电/线路投资，但须另核融资、许可与投产 | **反作用：**任务能效提高；订单取消、闲置或负载迁移；供电扩张、储能与需求响应；使用反弹可能抵消效率收益<br>**确认：**项目去重的接网/带电与表计数据；设备使用量、PUE和任务能耗；节点约束、施工与实际付款<br>**证伪：**宣布容量未转为运行负载；效率足以抵消工作量，实耗未增；现有电网容量足够，没有所称瓶颈 | 运行负荷按小时/期间观测；接网与建设按月到年，不能拼成短线信号<br>[M08 §A](../M08_AI_POWER_DATA_CENTERS.md#a-executive-definition)、[M08 §E](../M08_AI_POWER_DATA_CENTERS.md#e-flows)、[M08 §F](../M08_AI_POWER_DATA_CENTERS.md#f-causal-mechanisms)；M08.S01 / M08.S02 / M08.S03 / M08.S05 |
| B2-ME03 / SUPPORTED_MECHANISM | 可运营运输设施与边境/支线配套投入使用且有货源 → 可选路线、实际时效/费用或可靠性改变 → 货主可能切换路线或增加运输；使用量与收费可能支持后续融资，但净收益并非必然 | **反作用：**需求不足或只是从其他线路转移；通关/末端基础设施仍堵塞；高费率、停运、债务或维护负担<br>**确认：**同货型实际路线、运量、时效和收费；设施段落运营验收与通关；现金收入和维护/偿债账<br>**证伪：**只有建设/授信公告而无运营；实际运输时间或成本未改善；用量增加但只是改道，未证明净新增贸易 | 运输按航次/月度；建设、融资和福利按年；不设统一收益时点<br>[M10 §F](../M10_BELT_AND_ROAD.md#f-causal-mechanisms)、[M10 §J](../M10_BELT_AND_ROAD.md#j-cross-theme-links)、[M09 §F](../M09_AFRICA_STRATEGIC_RESOURCES.md#f-causal-mechanisms)；M10.S02 / M10.S03 / M10.S04 / M09.S06 / M09.S11 |
| B2-ME04 / CONDITIONAL_HYPOTHESIS | 实际项目收入低于支付需要，或汇率/币种时点错配造成现金缺口 → 运营维护及偿债可用现金不足 → 借款人可能需再融资、注资或协商；有合同担保/主权借款时可能影响政府现金负担 | **反作用：**自然外汇收入或有效对冲；收入改善、成本下降或缓冲现金；债务期限调整及其他融资<br>**确认：**匹配期间收费、维护与支付账；债务币种/到期/追索及担保合同；实际提款、汇率暴露与偿还记录<br>**证伪：**收入现金足以覆盖支出并匹配债务币种/时点；压力来自其他国家债务而非该项目；所谓主权风险没有相应责任依据 | 按照合同支付与运营周期（月到年）；不预设危机时点<br>[M10 §E](../M10_BELT_AND_ROAD.md#e-flows)、[M10 §F](../M10_BELT_AND_ROAD.md#f-causal-mechanisms)、[M10 §G](../M10_BELT_AND_ROAD.md#g-competing-explanations)；M10.S03 / M10.S05 / M10.S09 |

审阅收窄：ME01按M06 F2保留CONDITIONAL_HYPOTHESIS，不因J节/综合表的较宽SUPPORTED标题升级；ME02的物理使用联系不证明净需求增幅或某种能源赢家；ME03不把模型收益/一批运输当整走廊回报；ME04不把项目现金困难等同国家危机。它们均不生成GLD/IBIT方向、概率或交易许可。

## 5. Current State与生命周期

**0项当前状态候选。** 当前目录currentStateEnabled=false，本轮不改变。D01–D05分别保留芯片政策/工艺/份额、贸易/FDI版本、能源预测/公司支出/重启项目、矿权/配额/贷款、BRI合同/吞吐/国家债务。来源日期不明、索引节选或未核当前执行时，不用本次审阅时间刷新它。

今后若另行批准某项CURRENT_STATE，至少需要asOf、sourceDate、retrievedAt、freshnessClass、reviewTrigger与limitations；这些不是本轮新建的刷新服务。结构候选中的带年例子只作为证据或定义版本，不能被抽出变成永久数值。

继续Batch1生命周期：Historical immutable except correction；Structural versioned；Current state append/supersede；Mechanism evidence grade versioned；Open questions resolved by link, not deletion。没有新TTL、状态引擎或自动失效任务。

## 6. 五个观察问题与六个明确未知

观察问题只用于未来研究，不启用监控。

| 标签 | 问题 / 所需证据 | 不允许证明 | 出处 |
|---|---|---|---|
| B2-W01 | 具体许可变化是否改变了合格产品实际交付，当前限制在晶圆、HBM、封装还是供电？<br>适用产品许可及装运；良率、客户资格和实际交付；分环节交期/库存 | 不能估计战争概率或全行业禁运；不能由一个厂的状态概括全部产品 | [M06 §I](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#i-watch-indicators)、[M06 §L](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#l-open-questions)；M06.S09 / M06.S11 / M06.S12 |
| B2-W02 | 观察到的是全球总量下降、增长放缓、路线转移，还是当地真实生产增加？<br>同期实际量/名义值/GDP/增加值；企业生产地、上游进口和产出；FDI实际流量/存量调节 | 不能由转口汇总认定逃税；不能由一年数据证明历史终局 | [M07 §I](../M07_GLOBALIZATION_RECONFIGURATION.md#i-watch-indicators)、[M07 §G](../M07_GLOBALIZATION_RECONFIGURATION.md#g-competing-explanations)；M07.S01 / M07.S03 / M07.S04 / M07.S05 |
| B2-W03 | 去重项目走到了接网、带电还是实际AI用电，现金投入与利用率是否对应？<br>项目ID与阶段、表计和PUE；合同/租赁/现金调节；利用率及订单取消 | 不能由PPA或GW推MWh；不能把全部PP&E归AI或推收益 | [M08 §I](../M08_AI_POWER_DATA_CENTERS.md#i-watch-indicators)、[M08 §E](../M08_AI_POWER_DATA_CENTERS.md#e-flows)；M08.S01 / M08.S03 / M08.S04 |
| B2-W04 | 同一矿产项目的产量、加工、库存、合法出口、提款与地方净收益能否对账？<br>产品/期间匹配产销存与配额/装运；实际提款及用途；税费、净新增岗位和社区资料 | 不能把股份当国家流量控制；不能把Mopani与Lobito自动拼为同一货流 | [M09 §I](../M09_AFRICA_STRATEGIC_RESOURCES.md#i-watch-indicators)、[M09 §E](../M09_AFRICA_STRATEGIC_RESOURCES.md#e-flows)；M09.S01 / M09.S04 / M09.S06 / M09.S07 |
| B2-W05 | 授信、提款、施工、使用、收费和偿债分别到哪一步，责任由谁承担？<br>提款及支付用途；原预测对同口径实际收入/成本；借款人/担保人和币种到期 | 不能因重组认定预谋夺产；不能因运输增长证明财务成功 | [M10 §I](../M10_BELT_AND_ROAD.md#i-watch-indicators)、[M10 §F](../M10_BELT_AND_ROAD.md#f-causal-mechanisms)；M10.S02 / M10.S03 / M10.S06 / M10.S08 / M10.S09 |

| 标签 | 未知及为什么不能补值 | 能解除未知的证据 | 出处 |
|---|---|---|---|
| B2-Q01 | 当前完整多国管制矩阵及分产品许可/实际交付量是什么？<br>部分规则正文/后续沿革、许可统计与客户资格未齐。 | 带生效和替代关系的完整条款；适用品类的许可/装运及合格产出 | [M06 §H](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#h-current-structure)、[M06 §L](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#l-open-questions)；M06.S09 / M06.S11 / M06.S13 / M06.S15 |
| B2-Q02 | WTO/UNCTAD版本怎样桥接，真实生产迁移与上游依赖变化有多大？<br>修订表、长期同口径贸易/GDP与企业投产数据未取得。 | 发布方版本/分项桥接；价值量/实物量及企业增加值/FDI实现数据 | [M07 §H](../M07_GLOBALIZATION_RECONFIGURATION.md#h-current-structure)、[M07 §L](../M07_GLOBALIZATION_RECONFIGURATION.md#l-open-questions)；M07.S01 / M07.S02 / M07.S05 / M07.S07 / M07.S08 |
| B2-Q03 | 去重后已带电且实际用于AI的负荷、电量和专属资本支出有多少？<br>没有全球AI表计、项目合同/提款及公司用途拆分。 | 项目身份/阶段和匹配期间负荷；AI使用份额与现金用途调节；具体重启项目运行资料 | [M08 §H](../M08_AI_POWER_DATA_CENTERS.md#h-current-structure)、[M08 §L](../M08_AI_POWER_DATA_CENTERS.md#l-open-questions)；M08.S01 / M08.S03 / M08.S04 / M08.S06 |
| B2-Q04 | DRC实际出口执行、Mopani现金分期、Lobito可用能力及当地净收益分别是什么？<br>配额执行文书、提款及独立地方分配材料缺失。 | 最新执行文书与匹配产销存；贷款提款/用途账和通道段落验收；财政到账及居民/岗位净效果 | [M09 §L](../M09_AFRICA_STRATEGIC_RESOURCES.md#l-open-questions)、[M09 §E](../M09_AFRICA_STRATEGIC_RESOURCES.md#e-flows)；M09.S04 / M09.S05 / M09.S06 / M09.S07 / M09.S11 |
| B2-Q05 | SOMAIR当前控制、实际补偿/销售、法律终局及资源与安全变化的因果证据是什么？<br>国有化声明、公司异议和俄尼MOU不提供同一时点的执行/因果链。 | 裁决/合同及实际付款和运营记录；可核股权/货运；有反事实与时间顺序的独立安全研究 | [M09 §F](../M09_AFRICA_STRATEGIC_RESOURCES.md#f-causal-mechanisms)、[M09 §H](../M09_AFRICA_STRATEGIC_RESOURCES.md#h-current-structure)、[M09 §L](../M09_AFRICA_STRATEGIC_RESOURCES.md#l-open-questions)；M09.S08 / M09.S09 / M09.S10 |
| B2-Q06 | 项目原预测与实际成本/收费/维护、提款/担保怎样对账？<br>缺最终审计、同口径初始需求及后续合同/现金记录。 | 原计划与同口径实际现金/成本；追索及担保和合同修订；地方利益/成本独立资料 | [M10 §F](../M10_BELT_AND_ROAD.md#f-causal-mechanisms)、[M10 §L](../M10_BELT_AND_ROAD.md#l-open-questions)；M10.S03 / M10.S05 / M10.S06 / M10.S07 / M10.S08 / M10.S09 |

## 7. 冲突、定义和版本差：不做静默仲裁

| 标签 / 状态 | 两侧材料实际支持什么 | 缺口与处理 | 出处 |
|---|---|---|---|
| B2-CF01 / INCOMPARABLE / DEFINITION_DIFFERENCE | A：公司报告2025 Foundry 2.0为40%，包含封装测试/掩模/非存储IDM。<br>B：传统晶圆代工口径不同；本批未取得可比数字。 | 没有统一市场定义/覆盖桥接；不能把40%改贴传统份额，也不能捏造另一份额。<br>需要：两种完整定义及同期间组成/桥接；不平均或择优。 | [M06 §H](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#h-current-structure)、[M06 §N](../M06_CHINA_TAIWAN_SEMICONDUCTORS.md#n-adversarial-review)；M06.S07 |
| B2-CF02 / UNBRIDGED / UNBRIDGED_SOURCE_VERSIONS | A：34.65万亿美元，增长7%。<br>B：34.89万亿美元，增长8%。 | 动态页没有可核修订日期/分项桥接；不是增长加速的新观察。<br>需要：发布方修订元数据和分项调节；保留原两个版本。 | [M07 §H](../M07_GLOBALIZATION_RECONFIGURATION.md#h-current-structure)、[M07 §L](../M07_GLOBALIZATION_RECONFIGURATION.md#l-open-questions)；M07.S01 / M07.S02 |
| B2-CF03 / UNBRIDGED / UNBRIDGED_VINTAGES_AND_SCOPE | A：初估增长14%；剔除导管后5%。<br>B：约1.6万亿美元，增长6%。 | 两者正文均未取得；修订、基数、国家与导管处理未知；暂读值不作强结论。<br>需要：原始两版本表/方法及修订桥接；本轮不刷新数据。 | [M07 §H](../M07_GLOBALIZATION_RECONFIGURATION.md#h-current-structure)、[M07 §L](../M07_GLOBALIZATION_RECONFIGURATION.md#l-open-questions)；M07.S07 / M07.S08 |
| B2-CF04 / DISPUTED / ATTRIBUTED_LEGAL_DISPUTE_AND_PAYMENT_SCOPE | A：政府提出国有化及补偿安排。<br>B：Orano对合法性、控制及未获补偿提出异议。 | 政治/法律立场与实际付款分开；当前终局和实物控制未知，不能选择一方当裁判。<br>需要：独立裁决及可核合同/付款/运营；新增解决记录不得覆盖原陈述。 | [M09 §D](../M09_AFRICA_STRATEGIC_RESOURCES.md#d-actor-positions-actions-interests-and-constraints)、[M09 §H](../M09_AFRICA_STRATEGIC_RESOURCES.md#h-current-structure)、[M09 §L](../M09_AFRICA_STRATEGIC_RESOURCES.md#l-open-questions)；M09.S08 / M09.S09 |

CF01是定义差异，没有伪造第二个传统份额；CF02/03不平均、不选便利版本、不用增长率不同制造趋势；CF04保留法律争议，但补偿原则与已付款是不同问题。四项canonicalValue均为null，不把Owner未来批准视为解决证据。

## 8. 综合表§4的十条边逐项决定

原双向箭头不自动保存两个方向。4 KEEP_CANDIDATE、6 DOSSIER_ONLY、0 REJECT；未提升不等于否定该研究方向。

| 原行 | 原连接 | 决定 / 保留等级 | 原因 |
|---|---|---|---|
| 1 | M06 → M07 | KEEP_CANDIDATE / CONDITIONAL_HYPOTHESIS | 保留准入→替代/贸易重配，按M06 F2降到条件等级；不推整体收缩。 |
| 2 | M07 → M06 | DOSSIER_ONLY / ALPHA_INFERENCE | 原表CONDITIONAL，M06 F4为ALPHA_INFERENCE，S15仅节选；不提升补贴→分散→韧性整链。 |
| 3 | M06 ↔ M08 | KEEP_CANDIDATE / FACTUAL_DEPENDENCY | 只留M06硬件互补→M08部署依赖；反向客户订单→扩产留档案，不自动保留双向。 |
| 4 | M07 ↔ M10 | KEEP_CANDIDATE / SUPPORTED_MECHANISM | 收窄为M10配套设施→M07可行贸易路径；需求倒逼建设不是本候选已证事实。 |
| 5 | M08 → M09 | DOSSIER_ONLY / CONDITIONAL_HYPOTHESIS | 无AI特定铜/铀需求份额和采购证据；S02节选不支持非洲供给或价格归因。 |
| 6 | M09 → M08 | DOSSIER_ONLY / CONDITIONAL_HYPOTHESIS | 缺实际供给损失、库存、替代与项目暴露；不能由矿权新闻推AI工期。 |
| 7 | M09 ↔ M10 | KEEP_CANDIDATE / SUPPORTED_MECHANISM | 收窄为M09货源→M10运输使用/融资可行性；不合并案例、不赋予BRI归属，反向出口效应留机制研究。 |
| 8 | M06/M09/M10 → Batch1 M05 | DOSSIER_ONLY / CONDITIONAL_HYPOTHESIS | 已有ME07足够；只提议引用，不新增同义边，没有实际航线中断。 |
| 9 | M08/M10 → Batch1 M03 | DOSSIER_ONLY / SUPPORTED_MECHANISM | 融资约束已由ME03/F05承接，新增项目币种机制另候选；不把项目压力提升财政主导。 |
| 10 | M07/M10 ↔ Batch1 M02 | DOSSIER_ONLY / ALPHA_INFERENCE | 没有新币种微观流量；生产迁移与美元网络可分离仅留研究推断。 |

全部指向[原综合表§4](../BATCH_2_SYNTHESIS.md#4-cross-theme-causal-map)，来源和候选机制ID见JSON。M08→M09与M09→M08均不提升：AI采购份额、替代、库存和实际项目暴露缺失。向Batch1运输/债务的连接只作现有机制引用；美元网络长链保持ALPHA_INFERENCE。K节和综合§5全部DOSSIER_ONLY，零新增市场传导候选。

## 9. 与Batch 1去重：引用，不改原项

10个canonical引用提案；现有approved catalog、approval、主题和news linking均保持不变。proposedThemeLinks不是已安装的runtime关联。

| 既有标签 / canonical ID | 本批用途 | 严格限制 |
|---|---|---|
| F02 / macro.structural-fact.oil-policy-capacity-stock-flow.v1 | 公告/授权/能力/存量/实际流量分开；用于许可、投资承诺、MOU和项目阶段。 | 复用测量类别区别；油的具体制度/定义不扩展为所有融资合同规则。 |
| F12 / macro.structural-fact.announcement-effect-and-observation-clocks.v1 | 声明、正式生效、观察、接收时间分开。 | 只是提议themeLinks，现有共享时间规则及目录不变。 |
| F04 / macro.structural-fact.reserve-share-versus-transactions.v1 | FDI存量变动要区别交易、估值和汇率。 | 仅类比通用存量调节逻辑；COFER不含黄金等储备专属口径不用于FDI。 |
| F05 / macro.structural-fact.debt-stock-and-financing-definitions.v1 | 债务余额、融资/提款与偿还流量不互换。 | 新候选只新增借款人、担保、工具/条款维度。 |
| A02 / macro.actor-relation.fed-boj-dollar-backstop.v1 | 已授权金融渠道与实际draw是不同证据；一般commitment/disbursement不再生成一条空泛候选。 | A02仍仅Fed–BOJ后备关系，不能当DFC已提款或每份授信条款的事实；与F02一起用作概念参照。 |
| F10 / macro.structural-fact.vessel-tonnage-versus-cargo.v1 | 容量、运输重量/能量等单位及期间不可混合。 | GW→MWh新增物理维度见B2-K09；不把船舶吨位规定当电力定义。 |
| ME07 / macro.mechanism.rerouting-vessel-time-cost.v1 | 实际路线、交付时间与成本需要分步核实。 | 没有本批新航运中断证据；不复制另一条generic shipping机制。 |
| ME03 / macro.mechanism.debt-rollover-cost.v1 | 融资成本按合同期限/重定价进入现金负担。 | 公司/项目不等于Treasury；不能把任何融资困难称财政主导。 |
| T01 / macro.transmission-channel-candidate.macro-to-gold-channels.v1 | GLD只保留经实际利率、USD、现金需求等多渠道的待检验联系。 | 全部新K推断DOSSIER_ONLY；不新增固定方向或新资产机制。 |
| T02 / macro.transmission-channel-candidate.funding-to-risk-assets-channels.v1 | IBIT需要独立融资、风险预算、crypto及ETF证据。 | HYPOTHESIS_ONLY_CONTEXT / ALPHA_INFERENCE等级不升级；不新增候选。 |

去重不是越界泛化：F02的油数量分类不变成贷款合同法；F04的COFER细节不应用于FDI；A02仍仅Fed–BOJ后备关系。一般commitment≠disbursement只复用授权/实际draw识别，具体提款仍UNKNOWN。新增K04、K08、K09、K11、K15/16分别增加资格、项目阶段、量纲、用途会计、合同及责任维度，非通用规则副本。

## 10. 不提升与拒绝、同人语义自审

[独立清单](BATCH_2_REJECTED_OR_DOSSIER_ONLY.md)列出7组留档内容与13组拒绝解释。拒绝的是原档案已经限定/反驳的自动推论，不删除证据，也不批准反命题。政治/军事隐蔽意图、全非洲共同意志、全部BRI债务陷阱或必然双赢、以及地缘标题到资产方向均不得进入候选事实。

本次逐条回看主体归属、日期、节选覆盖、计划/执行、能力/产出、现金/承诺、使用/收益、案例外推、贸易口径、份额分母、推断等级、反例及Batch1重复。发现的压缩风险已在本审阅包收窄：

- M06 F2比J/综合表保守，出口影响机制与L1保留CONDITIONAL_HYPOTHESIS。
- L2依M06 F4保留ALPHA_INFERENCE且DOSSIER_ONLY；索引补贴表态不提升韧性。
- L3/L4去掉未经本候选支持的反向箭头；L7只保留互补关系。
- Foundry定义不一致与真实数值冲突分开；没有虚构传统份额。
- Niger应付补偿原则/未付款主张可同时成立；保留法律争议而非假数值矛盾。
- FDI/金融承诺对Batch1的复用明确为测量原则，不挪用COFER或Fed–BOJ具体制度。

这是提取者自审，不是Owner审核或独立验证。原六份dossier不修订，原矛盾/限制仍可追溯。

## 11. 检查、使用量与交接

本次范围检查通过：3份文件、49个来源条目、214处JSON章节引用、241处来源引用、174个Markdown本地链接（167个锚点）；唯一ID、五主题覆盖、机制必需字段、等级/引用去重、四项冲突、十条边取舍、当前状态禁止均通过。原六份输入与Batch1目录/批准文件指纹一致。复用已有Markdown及secrets检查函数；Git工作区/暂存区diff --check均通过。没有产品代码变更，不运行完整产品测试；这些机械检查不认证知识语义。

本轮web search **0**、page reads **0**、Alpha Host生成接口 **0**、额外模型API **0**、市场/券商 **0**、业务API **0**。本Codex会话生成与自审有模型消耗，具体token/费用不可见；**USD COST UNKNOWN**，不称免费。Git远端核验/push另计。只保存转述、必要短事实、来源元数据和审阅决定；不提交全文、runtime、账户或私人材料。

本轮停止于OWNER_REVIEW_READY。唯一下一步是Owner / ChatGPT按标签Approve / Revise / Reject；没有批准前，不进入Batch2 World Model integration。09:00/15:50安排、15:50自然验收、首次真实定向报价状态均未改动/重验。

**NONE OF BATCH 2 CANDIDATES ARE RUNTIME KNOWLEDGE YET.**
