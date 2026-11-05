Status: RESEARCH_ONLY_NOT_RUNTIME_KNOWLEDGE

# M06 — China, Taiwan and Semiconductors

研究日期：2026-09-20（America/New_York）。执行者：Codex/Alpha，同一研究者自审，非独立审阅、非 Owner 批准。以下是带日期的研究切片，不是截至今日全部法规的法律意见。来源时钟及读取范围见 M；使用量与边界见 [Batch 2 synthesis](BATCH_2_SYNTHESIS.md#8-usage-and-validation-boundary)。禁止 runtime 使用。

## A. Executive definition

台湾的重要性至少包含政治代表权与历史安排、岛内制度与社会选择、台海安全及区域联盟关系、全球产业依赖四层。半导体提高中断成本，却不能解释早于先进晶圆产业的全部政治冲突。[S01/S02/S03] Owner 的 Taiwan → chips → AI → industrial capacity → security 链条适合作为分段问题；从“存在依赖”跳到“必然动武、必然封锁或资产必涨”没有证据。

“一中”有不同主体、措辞和法律效果。PRC One-China Principle 是北京的主权立场；US One-China Policy 是美国的外交与国内法安排；台湾现行治理、宪制框架、各届行政表述及不同政党主张不能合并。以下记录立场，不裁判主权争议，也不把一方宣传当独立证明。[S01–S05]

## B. Historical development

| 时间 | 变化与研究意义 | 性质/来源 |
|---|---|---|
| 1895、1945、1949 | 日本统治、战后 ROC 接管、PRC 建立与 ROC 政府迁台，构成不同时期的治理事实；法律解释仍需区分 | 历史梳理 S02；PRC 对法律连续性的解释 S01 |
| 1971 | 联大2758号决议处理中国在联合国代表权；其对台湾地位的含义存在争论 | LEGAL / POLICY FACT 与 DISPUTED 分开，S01/S02 |
| 1972、1979、1982 | 三公报、建交、台湾关系法及六项保证构成美国政策脉络 | S02；不能简写为美国接受全部 PRC 主张 |
| 2013-06 | MAC 在当时行政立场下，以 ROC 宪法及两岸条例解释关系 | OFFICIAL_STATEMENT，S04；仅索引节选，不外推至所有台湾政治主体 |
| 2022-08 | 北京白皮书阐述和平统一及不放弃使用武力的立场 | OFFICIAL_STATEMENT，S01；不是冲突时间表 |
| 2024-12 | BIS 宣布扩大设备、软件及 HBM 等限制，并提出军事/AI 安全理由 | 历史政策公告 S10；不当作2026完整清单 |
| 2025-04、2026-01 | 荷兰设备许可范围调整；美国部分先进计算产品改为有条件逐案审查 | S11/S09；限制不是单向不断加严的同一个总开关 |
| 2025Q4、2026Q2 | TSMC 报告 N2 量产及继续规划下一代工艺/海外投入 | 公司报告 S07/S08；量产、研发、建设和未来承诺分开 |

## C. Actors

PRC 的行政、外交、军方和产业企业；台湾行政/立法机构、不同政党、居民与企业；美国行政部门、BIS、国会、客户；日本政府及设备/材料商；荷兰政府、ASML及欧盟市场；TSMC、Samsung、Intel、SK hynix、Micron；Nvidia/AMD等设计者、云客户、EDA/IP与封装测试供应商。国家、公司和居民不共享一个可推定的偏好。

## D. Actor positions, actions, interests and constraints

表中“激励”是 ALPHA_INFERENCE；不能从商业依赖反推隐藏的战争意图。

| 主体 | 明示立场 / 已观察动作 | 激励、制约及冲突 |
|---|---|---|
| PRC | 2026-05外交讲话重申一个中国原则三要素 [S03]；白皮书明确统一目标 [S01] | 安全/主权目标与经济、外交代价并存；讲话不证明所有国家采纳同一法律解释 |
| 台湾当局与社会 | 2013 MAC 宪制表述和2026 MAC反对北京原则/一国两制的表述分别保留 [S04/S05] | 宪制、选举、民意及安全约束；未调查所有政党，不能称“台湾统一立场” |
| 美国 | CRS区分 recognition 与 acknowledgement；TRA要求提供自卫能力框架，不构成自动参战保证 [S02/S06]；BIS执行出口许可规则 [S09] | 威慑、稳定、技术优势与美国企业收入可能冲突；具体决策须逐份文件核 |
| 日本 | 设备、材料供应环节重要 [S12]；读到2025-11管制修订公告索引 [S13] | 供应链与安全、出口收入、国内产能；本批未核全套现行芯片清单，不宣称全面禁运 |
| 荷兰 / EU | 2025公告要求更多设备对非EU出口取得许可，强调逐案审查 [S11] | 技术扩散控制与设备销售、跨国零件依赖；荷兰国家规则不等于所有EU相同政策 |
| TSMC | 公司报告先进工艺、封装和海外扩产 [S07/S08] | 良率、客户认证、人才、电力/水、资本回报；宣布工厂不能即时复制完整生态 |
| Samsung / Intel | IDM兼代工，先进封装参与者；Samsung另有存储业务 [S12] | 不同产品、节点、客户、产能与良率，不能据公司名称认为可无成本替代TSMC |
| 设计 / EDA / 设备 / 材料商 | 设计依赖工具与IP，制造需多轮工序和高纯材料 [S12/S14] | 客户工艺设计套件、出口许可、设备服务及验证周期；瓶颈不只在光刻机 |

## E. Flows

| 流向 / 类型 | 可核范围 | 不可互换的量 |
|---|---|---|
| IP/EDA → 设计 → foundry；服务与许可 FLOW | S12/S14 的工艺分工 | IP授权不是成品出货；设计企业营收不是全部产业增加值 |
| 设备/高纯材料 → 晶圆厂；CAPITAL_DISBURSEMENT / 实物流 | 光刻、刻蚀、沉积、检测、硅片/掩模等 [S12] | 设备订单不是安装验收，晶圆厂面积不是可售良品 |
| TSMC晶圆制造；PRODUCTION_CAPACITY | 公司称2025所管理设施年产能超过1,700万片12英寸等效晶圆 [S07] | 等效产能不是实际产量；节点与良率不统一 |
| 先进逻辑 + memory/HBM + packaging → AI系统 | S12/S14 描述可互补环节 | 逻辑节点领先不等于HBM、封装、服务器和电力都充足 |
| 政府 → 企业；补贴/贷款/税惠 | 分析分类：AUTHORIZATION、CAPITAL_COMMITMENT、CAPITAL_DISBURSEMENT；日本2024-02对JASM二厂支持的表述以满足法律审查为条件 [S15] | 本批未逐笔读取补贴合同/拨款，金额与现行条件 UNKNOWN；不能把支持预算当已付现金 |
| BIS → 出口商许可；AUTHORIZATION | 2026-01-15规则条件下逐案审查 [S09] | 不等于获批件数、实际出口或最终军事使用；本批这些量 UNKNOWN |

## F. Causal mechanisms

1. **SUPPORTED_MECHANISM：专业化 → 难替代的环节。** OECD列出的EDA、光刻、材料、存储、制造及封装分工意味着单点故障可穿透到下游；替代性取决于产品和认证，不是一个国家份额。[S12/S14] 反证：相应产品已有合格第二来源、库存覆盖且切换及时。
2. **CONDITIONAL_HYPOTHESIS：管制 → 获得技术成本/时间变化。** 需许可被拒、合规限制实际生效、替代不足，才可推断特定生产受限。设计绕开、旧设备改良、转口及国产替代可能改变效果；本批未量化规避规模。[S09/S11]
3. **OFFICIAL_STATEMENT 与因果分离：AI/先进计算 → 安全理由。** BIS把军事应用与技术领先列为目标，这是政策理由；某张芯片实际如何用于军事仍需终端用途证据。[S09/S10]
4. **ALPHA_INFERENCE：补贴/地缘风险 → 地理分散。** 总成本、客户保证采购、工人和能源决定项目是否完成；补贴承诺本身不能证明韧性提高或投资回报。海外厂增加也不等于台湾存量厂失去价值。[S07/S08/S14]

## G. Competing explanations

| 解释 | 支持及最强反例 | 当前判断 |
|---|---|---|
| “硅盾”令各方避免战争 | 中断会伤害许多参与者；但政治/安全目标未必服从经济损失 | ATTRIBUTED_IDEA / ALPHA_INFERENCE；本批未估计威慑效果，不能把依赖当和平保证 |
| 产业竞争解释全部台海紧张 | 技术竞争加重利益冲突；历史争议早于现代芯片产业 | 作为唯一解释不成立 [S01/S02] |
| 禁运即可彻底阻止技术进步 | 部分工具难替代；但管制有产品/目的地/最终用户边界和许可例外 | 必须逐项目检验，全面论断不支持 [S09/S11] |
| 海外扩产已解除集中风险 | 项目可以增加冗余；初期良率、封装、人员及上游仍依赖网络 | 当前风险变化量 UNKNOWN；S07/S08只证明部分建设/公司披露 |

## H. Current structure

截至本次读取，**可具体定位**的是：TSMC的2025公司口径 Foundry 2.0 份额40%（2024为34%），该分母包含封装测试、掩模及除存储外的IDM，不能贴成传统晶圆代工份额。公司称N2于2025Q4进入量产；2026-07电话会仍把A14量产置于2028计划，不能记为现在产能。[S07/S08] 节点名称不是跨厂物理尺寸的直接排名。

美国2026-01规则已核生效日，标为该时点的EFFECTIVE_POLICY，针对符合性能及认证条件的H200等产品；不是全部先进芯片无条件开放。[S09] 荷兰2025修订有明确生效日期，但本批未完成其后全部法律沿革核验；日本公告正文获取失败。故**2026-09-20完整多国有效管制矩阵 UNKNOWN**，不得据本档案处理实际出口合规。[S11/S13] A14属于ANNOUNCEMENT；N2量产属于公司报告的OBSERVED_IMPLEMENTATION；二者均不是本批现场工程验证。

## I. Watch indicators

仅研究问题，不创建监控：许可变化涉及哪个ECCN、设备/最终用户？获批后是否实际装运？新增晶圆/封装能力是否达到客户认证及良率要求？memory/电力是否成为新的限制？补贴是否按条件拨付？安全事件实际影响哪条航线、保险或工厂，而非仅增加措辞强度？

## J. Cross-theme links

| 连接 | 类型、依据与限制 |
|---|---|
| [M07供应链重配](M07_GLOBALIZATION_RECONFIGURATION.md#f-causal-mechanisms) | SUPPORTED_MECHANISM：许可/地理集中改变选址和贸易路径 [S09/S11/S14]；不证明全球总量收缩 |
| [M08计算与能源](M08_AI_POWER_DATA_CENTERS.md#e-flows) | FACTUAL_DEPENDENCY：AI系统使用逻辑/存储/封装，部署还需电力 [S12/S14；M08 S01]；单个供应商订单不能推全部负荷 |
| [Batch1运输](../batch-1/M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#f-causal-mechanisms) | CONDITIONAL_HYPOTHESIS：台海实质航运中断可增加交付风险；本批无中断流量，不把军演自动记成贸易损失 |

## K. Relevance to Alpha

ALPHA_INFERENCE：intermediateVariables = 实际交付损失、替代成本、资本支出、通胀/增长预期、美元融资与实际利率；counterforces = 库存、改道、技术替代、降息或美元升值；requiredObservations = 具体受限产品/生效文件/出货/市场已预期程度；falsification = 无供给缺口或其他变量解释资产变化。GLD、IBIT的方向和时点均 UNKNOWN；地缘标题不形成买卖许可。

## L. Open questions

当前分产品许可实际批准/交付量、先进封装与HBM可用产量、跨厂良率/客户切换周期、海外扩产已付现金、各补贴有效条件、当前完整法律清单均不足。本批不估计冲突概率，也未取得所有台湾政党当前正式文本；S05仅节选，不能扩展解读其法律立场。

## M. Source map

retrievedAt 为本会话实际检索/读取时钟（UTC），不是发布时钟；PDF仅阅读列示章节，不宣称通读。相同公司多份材料不算独立证实。

| ID | 来源 / sourceDate；period | 实际范围 / retrievedAt |
|---|---|---|
| S01 | [国务院台办/国新办白皮书（使馆全文）](https://sc.china-embassy.gov.cn/zxhd/202208/t20220810_10739773.htm)，2022-08-10；历史及当时立场 | 主权/和平统一/武力表述，2026-09-20T19:23:27Z |
| S02 | [CRS IF12503](https://www.congress.gov/crs_external_products/IF/PDF/IF12503/IF12503.6.pdf)，2025-08-18；1895–2025 | 3页中的历史、公报/TRA/保证；19:23:27Z，复核19:31:51Z |
| S03 | [PRC外交部讲话](https://www.mfa.gov.cn/zwbd_673032/wjzs/202605/t20260518_11912191.shtml)，2026-05-15；当日立场 | 三要素及归属，2026-09-20T19:30:08Z |
| S04 | [MAC历史说明](https://www.mac.gov.tw/en/News_Content.aspx?n=14271038DDC4104F&s=B573B5A2CD260CBB&sms=E828F60C4AFBAF90)，2013-06-14 | 仅搜索节选；正文失败。2026-09-20T19:22:59Z |
| S05 | [MAC当期表述](https://www.mac.gov.tw/en/News_Content.aspx?n=A921DFB2651FF92F&s=3444354E6DE51C0A&sms=37838322A6DA5E79)，索引显示2026-05-19 | 仅副主委沈有忠相关节选；正文两次失败，2026-09-20T19:22:59Z |
| S06 | [CRS Taiwan defense](https://www.congress.gov/crs_external_products/IF/PDF/IF12481/IF12481.20.pdf)，2026-02-09；当时安全关系 | pp1–2，2026-09-20T19:30:08Z；不推断开战日期 |
| S07 | [TSMC 2025 annual report](https://investor.tsmc.com/sites/ir/annual-report/2025/2025%20Annual%20Report.E.pdf)，2026发布日未核；FY2025 | PDF pp5/9/11/51，份额/容量/工艺；2026-09-20T19:23:27Z；N2复核19:32:36Z |
| S08 | [TSMC Q2 2026 transcript](https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-08/3e494f0c14dd0890f897aa044415e21d93486cc4/TSMC%202Q26%20Transcript.pdf)，2026-07-16；Q2及前瞻 | pp4–7，2026-09-20T19:24:39Z；计划不是投产 |
| S09 | [Federal Register 91 FR 1684](https://www.federalregister.gov/documents/2026/01/15/2026-00789/revision-to-license-review-policy-for-advanced-computing-commodities)，2026-01-15；同日生效 | DATES/Background/许可条件，2026-09-20T19:31:23Z；EAR744/748网页读取失败，未穷尽后续修法 |
| S10 | [BIS管制公告](https://www.bis.gov/press-release/commerce-strengthens-export-controls-restrict-chinas-capability-produce-advanced-semiconductors-military)，2024-12-02 | 搜索返回的官方正文节选，2026-09-20T19:23:13Z；仅当时范围/安全理由 |
| S11 | [荷兰设备许可修订](https://www.government.nl/latest/news/2025/01/15/klever-export-controls-on-advanced-semiconductor-manufacturing-equipment-to-be-tightened)，2025-01-15；生效2025-04-01 | 完整短公告，2026-09-20T19:30:08Z |
| S12 | [OECD semiconductor mapping](https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/06/mapping-the-semiconductor-value-chain_5ba52971/4154cdbf-en.pdf)，2025-06-24；各引用产业数据另有年份 | PDF pp9–18工艺/企业；2026-09-20T19:24:39Z；非2026实时份额 |
| S13 | [METI修订公告](https://www.meti.go.jp/english/press/2025/1111_004.html)，2025-11-11；所述生效2026-02-14 | 仅搜索节选、正文失败，2026-09-20T19:23:13Z；不据此重建芯片清单 |
| S14 | [OECD Mexico报告产业链附章](https://www.oecd.org/en/publications/promoting-the-development-of-the-semiconductor-ecosystem-in-mexico_02c81dec-en/full-report/understanding-the-semiconductor-value-chain_58b33686.html)，2026版、确切日未核；主要沿用2025产业图谱 | 设计/制造/材料/封装段，2026-09-20T19:31:06Z；与S12同源继承 |
| S15 | [METI JASM二厂支持条件](https://www.meti.go.jp/english/speeches/press_conferences/2024/0209001.html)，2024-02-09；当时表态 | 官方搜索节选2026-09-20T19:39:27Z；正文403。另一个补贴PDF也403，未抄补助金额或当作2026现行合同 |

## N. Adversarial review

已修正五种容易误读的表达：一中原则不替代美国政策；TSMC40%不替代传统代工份额；N2量产与A14路线图分开；许可条件不等于已出口；公司与国家不等同。未采用“2027能力目标等于开战日期”、军事理由等于已知终端用途或芯片保证和平的说法。当前完整规则读取不足已降为UNKNOWN，未用旧规则补全。

本档案的初始链条被**保留为局部机制、否定为单一政治因果解释**。来源定位、自审及机械校验不证明语义无误；等待Owner/ChatGPT review，不进入 Knowledge Review Gate。
