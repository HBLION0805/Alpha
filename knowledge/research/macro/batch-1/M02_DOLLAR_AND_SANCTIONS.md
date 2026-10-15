Status: RESEARCH_ONLY_NOT_RUNTIME_KNOWLEDGE

# M02 — Dollar System and Financial Sanctions / 美元体系与金融制裁

Research date: 2026-09-20, America/New_York. Codex/Alpha research；待 Owner/ChatGPT review，未接入任何运行逻辑。来源更新日、统计期间和读取日分列于 M。

## A. Executive definition

美元体系由几层彼此加强但不等同的网络构成：储备资产、贸易计价、支付结算、银行融资、外币债务、抵押品与危机流动性。美国经济及市场规模、可交易安全资产、法律和支付基础设施提供使用理由；网络效应也使替换产生协调成本。Fed 作者对此的解释是 ATTRIBUTED_ANALYSIS，不是“美元永远不会失去地位”的保证。[S01]

SWIFT 是报文网络，不持有或转移客户资金；CHIPS 是私人运营的大额美元清算结算系统；代理行账户是银行间账务关系。三者不能互换。SWIFT 切断可严重增加交易摩擦，但不能独自证明一个国家全部金融往来归零；另一方面，拥有替代报文系统也不能自动解除资产冻结、代理行限制和制裁。[S03–S07]

Owner 链条：Dollar→banks→payments 为 VERIFIED 的制度联系；sanctions→部分 access 受限为 VERIFIED 的法律措施，实际经济效果 CONDITIONAL；→地缘政治目标实现为 UNKNOWN，不能从制度能力推出政策成功。

## B. Historical development

| 日期/类型 | 事件 | 结构改变/为什么重要 | 来源 |
|---|---|---|---|
| 一战后至1944，structural turning point | 美元国际角色扩展，Bretton Woods 强化其制度地位 | 储备地位不是单一石油结算协议创造 | S01 历史段；仅机构概述，非完整货币史 |
| 2007–2010，temporary shock→institutional response | 美元融资危机促成央行互换安排 | 跨境美元需求可超出本国央行发行能力 | S08 历史 FAQ |
| 2012，policy shock | SWIFT 按欧盟法规断开被指定伊朗银行 | 报文企业受司法管辖；不是 SWIFT 自行决定外交目标 | S03 |
| 2013-10，structural turning point | Fed 与五家央行的互换转为常设 | 特定央行获得持续后备渠道，非全球无条件可得 | S08 |
| 2022-02/03，policy shock | 俄罗斯央行相关交易限制与部分银行 SWIFT 断开 | 储备可用性、交易合法性、报文接入同时但分别受限 | S03/S06 |
| 2023-12、2024-06，policy extension | 美国扩大对涉及俄罗斯军工基础的外国金融机构的制裁风险/解释 | 风险不限于直接美国交易对手；适用须看具体法律与交易 | S07 |
| 2025-07，policy extension | 欧盟对指定俄罗斯金融机构的报文禁令扩展为交易禁令 | “只是断 SWIFT”已不足以描述该措施 | S03，官方解释 |
| 2026 Q1数据、07-01发布，measurement update | IMF 发布新的储备币种统计 | 当前判断要用当前方法、币值及分母；不得拼接旧年报当资金流 | S02 |

## C. Actors

美国财政部/OFAC、Fed、欧盟立法和执行机关、SWIFT、CHIPS/代理行、各国储备管理者、受制裁主体与第三国金融机构、跨境企业分别掌握法律、流动性、报文、账务或资产配置权。一个“美元体系”标签不能把所有参与者视为美国政府的同一部门。

## D. Actor positions, actions, interests and constraints

利益判断均是 MODEL_INFERENCE / ALPHA_INFERENCE：依据制度角色和经济暴露；替代解释是法律义务或政策目标压过商业收益；需以具体行动、成本和声明修正，不声称看穿动机。

| Actor | Stated position | Observed action | Economic exposure / incentive | Constraints | Dependencies / conflicts |
|---|---|---|---|---|---|
| Treasury/OFAC | OFFICIAL_STATEMENT：依法限制特定交易及军工支持 | OBSERVED_ACTION：Directive 4、CAPTA、FFI 指引 [S06/S07] | 政策执行能力；不能据罚款推定财政收入是动机 | 法定权限、指定范围、许可、域外执行难度 | 依赖银行合规和盟友；与目标国、第三国法律可能冲突 |
| Fed | OFFICIAL_STATEMENT：缓解美元资金压力 | OBSERVED_ACTION：与五家央行常设互换 | 金融稳定/货币政策传导；不是 OFAC 的同一工具 | 授权对手方、央行承担转贷信用风险 | 依赖外国央行及合格机构；不是向全世界直接放贷 [S08] |
| EU / SWIFT | EU 为制裁立法者；SWIFT 称依法合规 | OBSERVED_ACTION：断开指定实体；2025交易禁令变化 | SWIFT 网络服务与持续运营；自身外交偏好 UNKNOWN | 比利时法、欧盟法；不能控制所有账务 | 各国银行和多币种网络；美国政策不等于 SWIFT 公司命令 [S03/S04] |
| CHIPS / correspondent banks | OFFICIAL_STATEMENT：高额美元结算与效率 | OBSERVED_ACTION：运营最终性结算；银行执行账户限制 | 手续费、流动性节约与处罚/信用风险 | 资金、合规、资本、参与条件 | Fed/银行账户及客户；拒绝风险可大于法定最低要求，幅度 UNKNOWN [S05–S07] |
| 储备管理者（异质） | 本批未取得每家央行投资声明，UNKNOWN | IMF 观察聚合币种结构；不能识别每家意图 | 流动性、安全、收益、币种支付需求；政治暴露 | 可投资资产深度、资本流动、托管法律 | 美债等发行方；本币/黄金替代各有成本 [S01/S02/S09] |
| 受限制主体/第三国银行 | 未取得统一当事人声明，UNKNOWN | 受到已列限制；逐项适用不是全部隔绝 | 继续贸易融资与保存市场准入的权衡 | 许可、合规风险、结算网络及兑付能力 | 本地替代系统/贸易伙伴；不能因某货币非美元就判免制裁 [S07] |
| 跨境贸易与债券发行人 | 企业级声明未取，UNKNOWN | 计价和融资币种分布见 S01 | 汇兑、融资成本、客户网络便利 | 对冲、期限错配、债务契约、银行授信 | 进口商与出口商利益不相同；美元升值对资产端与负债端效应不同 |

## E. Flows

| From → to / 资源 | 机制、方向 | 量/期间 | 状态与证据 | 限制 |
|---|---|---|---|---|
| 付款银行 → 收款银行；美元 | 代理行账务或 CHIPS 结算 | 本批不使用未核单位的年度金额表 | OBSERVED_FLOW（系统运营事实），S05；具体跨境净额 UNKNOWN | 大额支付总额不是净资本流入，也不是国际贸易总额 |
| Fed → 合作央行 → 当地机构；美元流动性 | 互换、转贷、到期反向交换 | 常设授权；当日余额 UNKNOWN | AUTHORIZED_POLICY，S08 | 常设不等于已提款；不是对非银的直接 Fed 放款 |
| 储备管理者 → 证券发行人/二级市场对手；投资 | 买卖外币资产 | 2026Q1 储备存量 $13.10 trillion，USD份额57.13%；不作为本期净购买 | INFERRED_FLOW，存量事实 S02 | 汇率、资产价格及方法改变可影响份额 |
| 外国投资者 → Treasury；美元融资 | 初级认购/二级持有转换 | 当前净流量 UNKNOWN；M03 E有财政发行证据 | INFERRED_FLOW | 二级买入不直接给财政新现金 |
| 被指定主体 → 相关收款人；交易受限 | 不得处理、拒绝、资产不可用，视法律类别 | Directive 4始于2022；CAPTA按指定生效 | AUTHORIZED_POLICY，S06 | 不把法律禁令写成已经测得的零流量或所有权转移 |
| 商业银行/企业 → 替代币种渠道 | 改币种、对冲、另行融资 | 当前规模 UNKNOWN | INFERRED_FLOW，S01/S07 | 去美元计价、储备变化和支付替代不是同一个流 |

## F. Causal mechanisms

| Trigger → first → second | 等级 | Counterforce / confirmation / falsification |
|---|---|---|
| 广泛美元计价 → 美元营运资金需求 → 银行融资与可对冲资产需求 | WELL_ESTABLISHED 制度互补，边际强度 CONDITIONAL [S01] | 本币贸易与其他深市场是反力；确认须分看发票/银行/债券数据；只有储备下降不足以否定或证明网络解体 |
| 账户/交易限制 → 中介不能或不愿处理 → 资本与贸易成本提高 | WELL_ESTABLISHED 法律约束，效果 CONDITIONAL [S06/S07] | 许可、替代中介、交易改道；需观察实际拒付、融资成本与量，未见行为变化时不能声称目标已达 |
| 制裁储备可用性风险 → 储备托管/币种再配置动机 → 多样化 | CONDITIONAL [S02/S09] | 替代资产流动性和汇兑成本；估值变动可冒充再配置；有持仓数量变化和投资声明才加强解释 |
| 美元债务再融资压力 → 争取美元/出售资产 → 全球金融条件收紧 | CONDITIONAL [S08；M04 F] | 互换/回购后备、自然收入对冲；资金基差、借款成本和资产出售共同验证；美元升值本身不够 |

**ALPHA_INFERENCE M02-F1：**支付网络替代可能比安全资产/融资网络替代更快。依据 S01/S04/S05 的不同职能；替代解释为多个层次同步重组；若替代币种已有同等深度流动性、开放资产市场和危机融资并广泛采用，则该速度差判断会被削弱。本批没有测出速度或临界份额。

## G. Competing explanations

- **美元份额下降是制裁后撤离，还是估值/分散化？**确有政治暴露渠道，但聚合份额不能识别动机。Weiss 的国家层研究认为多数购金不对应专门减少美元、存在少数例外；这是作者分析，不覆盖全部2026行为。[S09] 两种机制可同时存在，不作假对立。
- **美元靠强制，还是网络与资产优势？**法律权限对受约束交易重要；大量自愿融资和储备需求亦有流动性/制度解释。[S01/S06] 不能把某项制裁的强制范围扩展为所有美元使用。
- **备用支付系统可以消除制裁风险？**可绕开一种报文基础设施不代表代理行、托管、贸易或次级制裁条件消失。要逐层检查，不能推论替代系统完全无用。[S03–S07]
- **黄金上涨证明美元出逃？**黄金储备市值份额可因价格上涨；COFER 外汇储备分母不包括黄金。不同分母不得直接比较。[S01/S02/S09]

## H. Current structure

当前已核 IMF 发布是 **2026-07-01，数据2026Q1**：USD 外汇储备份额 **57.13%**，2025Q4 为56.42%，总外汇储备由13.15至13.10万亿美元。以上是其发布口径的存量，不是交易流量、全部官方储备或九月实时份额。[S02] 本次没有取到更晚同口径数据；不能将2025 Fed报告的2024年58%和此数直接解释成精确净抛售。

现行 SWIFT 说明已包含 **2025年7月**的欧盟交易禁令扩展；页面更新日未列明，读取日2026-09-20。[S03] 当前 OFAC 的 **2026-06-11** 更新说明仍区分 CAPTA 的拒绝处理与 blocking 制裁，不能将两者写作完全相同。[S06] 这只是已读制度文件，不是本次完整国家/实体名单法律审计。

当前 CHIPS 官方页仍说明其美元清算结算职能；当前 Fed FAQ 仍载五家合作央行的常设美元互换。两页更新时间 UNKNOWN，因此没有杜撰本月政策变化或当日提款额。[S05/S08] 新兴结算方式是否正在显著替代这些层次，当前证据不足。

## I. Watch indicators

| 指标 | 可确认/用途 | 不能证明 | 来源/频率/滞后 |
|---|---|---|---|
| COFER 币种存量、汇率调整 | 储备组合变化 | 单国政治意图、净交易流量、黄金数量 | IMF，季度，约一季发布滞后；可能方法修订 |
| 国际银行美元资产/负债 | 融资币种结构 | 每笔最终用途或隐含衍生杠杆 | BIS，季度，数月滞后；S01/S10 |
| 发票币种与外币债券发行 | 实体/证券层网络 | SWIFT总量替代此指标 | 官方调查/发行资料，频率不一且滞后；S01 |
| CHIPS量、资金基差、美元融资成本 | 支付使用与资金压力不同侧面 | 支付总额不等于风险资本净流入 | TCH/BIS；日汇总至月季，具体服务延迟须核 |
| Fed互换余额和操作 | 后备实际使用 | 低使用不代表市场无压力 | Fed周表/央行操作；周或逐次，S08 |
| 新指定/许可/执行案例 | 法律可达范围和执行行动 | 战略目标成功或实际贸易归零 | OFAC/EU，事件驱动，法律与经济效果有时差 |

## J. Cross-theme links

| 去向 | 等级/关系 | 边界 |
|---|---|---|
| [M03 E/F](M03_DEBT_AND_FISCAL_DOMINANCE.md#e-flows) | FACTUAL_DEPENDENCY：美债为美元储备与抵押资产的重要部分 | 安全资产需求不保证任何规模发行都无成本，S01 |
| [M01 F](M01_OIL_IS_POWER.md#f-causal-mechanisms) | SUPPORTED_MECHANISM：能源贸易需要融资和结算，制裁改变成本 | 不等于唯一美元支柱 |
| [M04 F](M04_YEN_CARRY_TRADE.md#f-causal-mechanisms) | SUPPORTED_MECHANISM：FX swaps 与美元资金成本连接日元资产 | hedge 与未对冲 carry 不同，S10 |
| [M05 F](M05_GLOBAL_SHIPPING_CHOKEPOINTS.md#f-causal-mechanisms) | CONDITIONAL_HYPOTHESIS：金融/保险准入放大或转移物理运输约束 | 需船舶、银行及具体保单证据 |

## K. Relevance to Alpha

均是 **ALPHA_INFERENCE**，不是方向建议。支持依据是 F 的制度机制；替代解释及反证观测如下。

| 对象 | 潜在传导/依据 | 反作用/替代 | 时域 | 需要观察 |
|---|---|---|---|---|
| USD | 融资短缺促美元需求，S08 | 美国自身风险及替代配置 | 小时至年 | 资金成本、币种资产负债，不能只看储备份额 |
| 名义收益率 | 储备需求/融资出售改变美债需求 | 避险买债、国内吸收 | 日至季 | Treasury持有人/发行与期限溢价 |
| 实际收益率 | 资产偏好与政策路径作用 | 通胀补偿和流动性造成名实分叉 | 周至季 | TIPS、政策预期与市场流动性 |
| Gold / GLD | 托管/制裁暴露可增加黄金需求 | 估值变化、真实利率、现金缺口 | 月至年，急性冲击可短 | 实物官方数量及ETF流量分别验证；央行购金不等于买GLD |
| BTC / IBIT | 资本通道与美元流动性 | 加密托管/兑换/监管及自身杠杆 | 日至季 | ETF实际流量、可用结算通道；去美元叙事不足以证实 |
| Oil | 支付与融资约束影响交付成本 | 改道/许可可维持桶数 | 周至季 | 净回款与出口量分开 |
| Broad risk | 美元负债成本和再融资 | 自然收入对冲、政策后备 | 日至季 | 企业净币种暴露、违约/融资数据 |
| Financial conditions | 中介去风险与资本准入 | 其他银行接替、央行支持 | 日至年 | 授信与拒付实际证据，不用法规数量代替效果 |

## L. Open questions

- 最新储备公开数据有滞后；估值调整后的2026净币种配置未重算，单国非公开组合 UNKNOWN。
- 次级制裁、许可和各国冲突法的具体适用需法律专业复核；本档案不提供规避路线。
- 跨境替代支付有多少新增业务、多少重复计数和原有业务迁移，没有可比原始数据。
- 美元优势损失到何程度影响融资成本，没有可验证单一阈值；政治意图不从支付币种猜测。
- COFER、SWIFT、CHIPS、BIS 在币种、机构、总额/净额及统计范围上不一致，禁止合并为一个“美元份额”。

## M. Source map

读取日期统一 **2026-09-20**；S01 的统计基于早期上游，不是独立实时数据；官方研究观点不等于其政策机构结论。

| ID / category | URL；发布日期/定位 | 支持与限制 |
|---|---|---|
| S01 / institutional research | [Fed dollar role 2025](https://www.federalreserve.gov/econres/notes/feds-notes/the-international-role-of-the-u-s-dollar-2025-edition-20250718.html)，2025-07-18，储备/计价/银行/历史段 | 网络层次；大多2024及更早数据，不判断2026即时份额 |
| S02 / primary statistics | [IMF COFER brief](https://data.imf.org/en/news/imf%20data%20brief%20july%201)，2026-07-01，2026Q1；[COFER metadata](https://data.imf.org/Datasets/COFER)，方法/更新入口，更新日 UNKNOWN | 当期存量份额及统计范围；不是净购买；具体方法变更未重建历史序列 |
| S03 / primary operator/legal explanation | [SWIFT and sanctions](https://www.swift.com/es/node/11306)，更新 UNKNOWN，2012/2022/2025说明段 | 断开及适用法规；经营者说明不是完整法律意见 |
| S04 / primary operator | [SWIFT Who we are](https://www.swift.com/about-us/who-we-are)，更新 UNKNOWN，Does Swift move money FAQ | 报文与资金区别 |
| S05 / primary operator/industry | [CHIPS](https://www.theclearinghouse.org/payment-systems/chips)，更新 UNKNOWN，产品职能/最终性段 | 清算、流动性节约；营销性能指标不当独立实测 |
| S06 / primary legal | [OFAC FAQ 998](https://ofac.treasury.gov/faqs/998)，2022-03-02、更新2023-05-19；[2026-06-11更新](https://ofac.treasury.gov/faqs/updated/2026-06-11)，CAPTA段 | 交易限制/不可用资产/拒付区别；许可和名单需另查，冻结非没收 |
| S07 / primary legal | [OFAC FAQ 1150](https://ofac.treasury.gov/faqs/1150)，2023-12-22 determination；[FAQ1151](https://ofac.treasury.gov/faqs/1151)，2024-06-12更新 | 外国机构风险及术语；不量化执行效果 |
| S08 / primary facility documentation | [Fed swap FAQ](https://www.federalreserve.gov/monetarypolicy/bst_swapfaqs.htm)，更新 UNKNOWN，常设/历史分节 | 2013常设及风险分担；旧临时额度不视为当前额度 |
| S09 / institutional research | [Weiss gold reserves abstract](https://www.federalreserve.gov/econres/ifdp/exploring-central-bank-gold-purchases-and-the-dollars-role-in-international-reserves.htm)，2025-09，仅摘要 | 多样化与去美元区别；未复现估计，不冒充全文回归审计 |
| S10 / institutional statistics research | [BIS derivatives](https://www.bis.org/publications/qr-202512/international-finance-through-lens-bis-statistics-derivatives-markets)，2025-12，统计/FX/basis段 | 银行/非银衍生融资与口径；总名义金额不是净风险 |

High-quality reporting：未用新闻报道充当第二份独立事实。Academic/institutional 见S01/S09/S10。Analysis/commentary：本档案 ALPHA_INFERENCE 是研究者推断，不是 Owner确认；没有使用政治媒体标签。

## N. Adversarial review

已将“美元储备减少”改为“指定期间份额变化”，将“冻结”与“没收/拒付”分开，将 SWIFT 的2025交易禁令更新补入现状。删除对央行购金统一动机的暗示。未把转引IMF的Fed图与IMF数据算两个独立观测。当前统计不能证明系统崩溃，也不能证明政治风险完全无影响。
