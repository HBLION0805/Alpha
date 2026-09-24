// Presentation-only Chinese labels. Stored records, request bodies, source text and IDs stay untouched.
export const DEFAULT_LOCALE='zh-CN';

const statuses={
  NO_TRADE:'暂不交易',WATCH:'观察',READY_FOR_OWNER_MANUAL_ENTRY:'可准备手动入场',
  DRAFT:'草稿',UNKNOWN:'未知',AVAILABLE:'可用',MISSING:'缺失',BLOCKED:'已阻止',
  PASS:'通过',FAIL:'失败',FAILED:'失败',PARTIAL:'部分完成',PENDING:'待处理',
  TRUE:'是',FALSE:'否',OPEN:'未平仓',CLOSED:'已平仓',CALL:'看涨期权',PUT:'看跌期权',
  INSUFFICIENT_EVIDENCE:'证据不足',INSUFFICIENT_HISTORY:'历史数据不足',NOT_ASSESSABLE:'无法评估',
  NOT_CHECKED:'未检查',NOT_TESTED:'未经检验',UNVERIFIED:'未经核实',DESCRIPTIVE_ONLY:'仅供描述',
  STRATEGY_NOT_VALIDATED:'策略未经验证',FUTURE_CONFIRMATION_REQUIRED:'需要未来确认',
  STRUCTURAL_SOURCE_UNAVAILABLE:'结构化来源不可用',CROSS_INTERVAL_COMPARISON_UNAVAILABLE:'跨区间比较不可用',
  PROSPECTIVE_RULES_MISSING:'缺少事前规则',BASELINE_TOO_SHORT:'基线过短',
  IMPORTED_SOURCE_NOT_AUTHENTICATED:'导入来源未认证',IV_PATH_SCENARIO_UNASSESSED:'IV 路径情景未评估',
  SETUP_NOT_CURRENTLY_CONFIRMED:'当前入场形态未确认',ETF_BARS_NOT_FRESH:'ETF K 线不新鲜',
  MARKET_CAPTURE_MISSING:'缺少行情采集',MARKET_CAPTURE_PARTIAL:'行情采集不完整',
  CALENDAR_COVERAGE_UNAVAILABLE:'日历覆盖不可用',HEADLINE_REFRESH_UNAVAILABLE:'新闻刷新不可用',
  UNVERIFIED_OR_SYNTHETIC_CAPTURE:'采集未核实或为合成数据',OUTSIDE_REGULAR_SESSION:'不在常规交易时段',
  DIRECTION_NOT_CONFIRMED:'方向未确认',ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD:'注明来源的背景复核缺失或过旧',
  UNDERLYING_PRICE_NOT_FRESH:'标的价格不新鲜',FORECAST_MISSING:'缺少预测',
  TRADE_HORIZON_UNDECLARED:'未声明交易期限',UNASSESSED:'未评估',UNCONFIRMED:'未确认',COSTS_UNKNOWN:'成本未知'
};
const humanizedStatuses=Object.fromEntries(Object.entries(statuses).map(([code,label])=>[code.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()),label]));
export const statusLabel=value=>statuses[String(value??'UNKNOWN')]??null;
const codeTokens={MARKET:'行情',CAPTURE:'采集',QUOTE:'报价',QUOTES:'报价',ETF:'ETF',OHLCV:'OHLCV',
  SOURCE:'来源',DATA:'数据',MISSING:'缺失',PARTIAL:'部分',UNAVAILABLE:'不可用',UNKNOWN:'未知',
  NOT:'未',CURRENTLY:'当前',CONFIRMED:'确认',VALIDATED:'验证',HISTORY:'历史',INSUFFICIENT:'不足',
  CALENDAR:'日历',COVERAGE:'覆盖',HEADLINE:'新闻标题',REFRESH:'刷新',FUTURE:'未来',REQUIRED:'需要',
  STRATEGY:'策略',STRUCTURAL:'结构化',CROSS:'跨',INTERVAL:'区间',COMPARISON:'比较',PROSPECTIVE:'事前',
  RULES:'规则',BASELINE:'基线',TOO:'过',SHORT:'短',IMPORTED:'导入',AUTHENTICATED:'认证',
  SCENARIO:'情景',UNASSESSED:'未评估',SETUP:'入场形态',BARS:'K线',FRESH:'新鲜',
  OUTSIDE:'不在',REGULAR:'常规',SESSION:'交易时段',DIRECTION:'方向',ATTRIBUTED:'注明来源',
  CONTEXT:'背景',REVIEW:'复核',OLD:'过旧',UNDERLYING:'标的',PRICE:'价格',FORECAST:'预测',
  TRADE:'交易',HORIZON:'期限',UNDECLARED:'未声明',RISK:'风险',COSTS:'成本',TIME:'时间',
  OWNER:'Owner',REPORTED:'报告',SYNTHETIC:'合成',ONLY:'仅',RESEARCH:'研究',ENTRY:'入场',EXIT:'退出',
  EVENT:'事件',HOLD:'持有',THROUGH:'跨越',PENDING:'待检查',BLOCKED:'已阻止',CHECK:'检查',
  PASSED:'通过',FAILED:'失败',AVAILABLE:'可用',COMPLETE:'完整',RECEIPT:'回执',PATH:'路径',
  NUMBER:'数量',VALUE:'数值',OFFICIAL:'官方',SAVED:'已保存',LOCAL:'本地',MANUAL:'手动',
  EVIDENCE:'证据',QUALITY:'质量',BUDGET:'预算',LIQUIDITY:'流动性',PLAN:'计划',DRAFT:'草稿',
  PROCESS:'过程',GUIDE:'指南',MECHANICS:'机制',REFERENCE:'参考',CANDIDATE:'候选',UNTESTED:'未经验证',
  INCOMPLETE:'不完整',UNQUALIFIED:'未合格',UNVERIFIED:'未核实',SUCCESS:'成功',DENIED:'被拒绝'};
export function enumLabel(value){
  const raw=String(value??'UNKNOWN');if(statuses[raw])return statuses[raw];
  if(!/^[A-Z][A-Z0-9_]*$/.test(raw))return raw.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
  return raw.split('_').map(token=>codeTokens[token]??token).join('');
}

// Exact chrome phrases only: arbitrary source quotations and Owner text are never machine-translated.
const phrases=Object.fromEntries([
  ['Unknown','未知'],['Unavailable','不可用'],['Missing','缺失'],['Blocked','已阻止'],['Watch','观察'],['No Trade','暂不交易'],['Draft','草稿'],['Pass','通过'],['Fail','失败'],
  ['Ready For Owner Manual Entry','可准备手动入场'],['Available','可用'],['Open','未平仓'],['Closed','已平仓'],
  ['Daily guidance','每日决策'],['Event research','事件研究'],['Macro playbook','宏观手册'],['Overview','总览'],['Options & activity','期权与活动'],['Trade planner','交易计划'],['Trade journal','交易日志'],['Reviews & lessons','复盘与经验'],['News & calendar','新闻与日历'],
  ['YOUR CAPITAL, IN FOCUS','关注您的资金'],['A clearer view. A steadier plan.','看清现状，稳健规划。'],['Your GLD and IBIT research, risk checks and trade records in one place.','在一处查看 GLD 与 IBIT 研究、风险检查和交易记录。'],
  ['THE OPTIONS UNIVERSE','期权市场'],['DOWNSIDE BEFORE UPSIDE','先看下行风险'],['EVERY FILL HAS A HISTORY','每笔成交都有记录'],['LEARN FROM THE RECORD','从记录中复盘'],
  ['EVIDENCE BEFORE A TRADE','交易之前先看证据'],['GOLD AND BITCOIN IN CONTEXT','黄金与比特币背景'],['REASONING BEFORE ACTION','先思考，再行动'],['BEHAVIOR AND EVIDENCE','行为与证据'],['ONE EVENT, TWO DECISIONS','同一事件，两种决策'],
  ['YOUR WORKSPACE','我的工作区'],['Saved local evidence','已保存的本地证据'],['Checking saved evidence…','正在检查已保存的证据…'],['Local operation failed.','本地操作失败。'],['Workspace unavailable','工作区不可用'],['Start the local Alpha server, then use Reload saved data.','启动本地 Alpha 服务，然后重新读取已保存数据。'],
  ['GLD and IBIT · Long calls and puts · 14–45 days to expiry · A reason to act or wait.','GLD 与 IBIT · 买入看涨或看跌期权 · 到期前 14–45 天 · 明确行动或等待的理由。'],
  ['Direct GLD / IBIT news, relevant macro developments, and the evidence still needed.','GLD / IBIT 直接新闻、相关宏观进展，以及仍需补足的证据。'],
  ['Compare anticipation and reaction with one shared risk allowance.','在同一风险额度下比较事前预期与事后反应。'],
  ['Turn reading into explicit questions, dated decisions and honest reviews.','把阅读转化为明确的问题、有日期的决策和如实复盘。'],
  ['Explore saved contracts and the activity worth researching.','查看已保存的合约和值得研究的交易活动。'],
  ['Compare a declared long-option scenario using the existing risk engine.','使用现有风险计算比较已声明的买入期权情景。'],
  ['Your reported records, preserved with exact costs and correction history.','您报告的记录，保留准确成本与更正历史。'],
  ['Separate what happened, what is known and what still needs evidence.','区分已发生的事、已知事实与仍需证据的部分。'],
  ['Planning baseline','计划基准'],['Declared scenario · not a broker balance','已声明情景 · 不是券商余额'],['Per-trade allocation range','单笔资金范围'],['Normal allocation ceiling','常规资金上限'],
  ['Reported open positions','已报告未平仓仓位'],['Study follow-up','研究后续'],['Saved close boards · research only','已保存的收盘观察 · 仅供研究'],
  ['Saved contracts','已保存合约'],['Activity candidates','活动候选'],['Explore options →','查看期权 →'],['Quote dates:','报价日期：'],['＋ Build a trade plan','＋ 建立交易计划'],
  ['Your next steps','接下来怎么做'],['Keep the decision and its evidence together.','将决策与证据放在一起。'],['Review context and quote quality','复核背景与报价质量'],['Check the source time, spread, contract and upcoming events.','检查源时间、价差、合约和临近事件。'],
  ['Calculate the downside first','先计算下行风险'],['Use declared costs, whole contracts, a time exit and net R.','使用已声明成本、整张合约、时间退出和净 R 值。'],
  ['Record what actually happened','记录实际发生的事'],['Enter your reported fills, then review costs and plan deviations.','录入已报告成交，再复核成本和计划偏差。'],
  ['On the calendar','日历事项'],['New York time · saved official calendars','纽约时间 · 已保存的官方日历'],['View all →','查看全部 →'],
  ['System readiness','系统准备情况'],['Local engineering acceptance and market validation are tracked separately.','本地工程验收与市场验证分别记录。'],
  ['Reviews worth revisiting','值得重看的复盘'],['Candidate lessons require evidence and review.','候选经验仍需证据与复核。'],['Open reviews & lessons →','打开复盘与经验 →'],
  ['Option table scope','期权列表范围'],['Saved board','已保存看板'],['ETF','ETF'],['Expiration','到期日'],['Option type','期权类型'],['Search contract','搜索合约'],['Sort by','排序依据'],['Reset filters','重置筛选'],['← Previous','← 上一页'],['Next →','下一页 →'],
  ['Saved bid / ask','已保存买价 / 卖价'],['Displayed bid / ask size','显示的买卖盘数量'],['Reported volume','报告成交量'],['What the activity can tell us','交易活动能说明什么'],['↓ Export displayed source','↓ 导出显示的来源'],
  ['Build your scenario','建立情景'],['All figures are declarations, not verified account or order inputs.','所有数字均为声明值，不是已核实的账户或订单数据。'],
  ['Risk diagnostic','风险检查'],['Calculate a scenario to see its costs and limits.','计算情景以查看成本和限制。'],['Start with what you can lose','先看可能亏损'],['One contract means 100 shares. A premium stop does not guarantee the maximum loss.','一张标准合约对应 100 股。权利金止损不能保证最大亏损。'],
  ['Scenario result','情景结果'],['Deterministic calculation · manual scenario','确定性计算 · 手动情景'],['Blocked scenario','情景受阻'],['Economically feasible','经济条件可行'],
  ['Premium','权利金'],['Full-premium stress','全额权利金压力'],['Requested net target','要求的净目标'],['Indicative exit / share','参考退出价 / 股'],['Net target after tick rounding','按最小报价单位取整后的净目标'],
  ['Fees & exit allowance comparison','手续费与退出预留比较'],['See how execution costs change the same position and target.','查看执行成本如何影响同一仓位及目标。'],
  ['Record a plan or execution','记录计划或执行'],['Enter information from your own completed trade records.','根据您实际完成的交易记录录入信息。'],
  ['Register trade','登记交易'],['Record fill','记录成交'],['Correct / void','更正 / 作废'],['Recorded positions','已记录仓位'],['Select a trade to inspect its accounting.','选择交易查看账目。'],
  ['Registered trades','已登记交易'],['Open positions','未平仓仓位'],['Closed trades','已平仓交易'],['Candidate notes','候选笔记'],['Realized net','已实现净额'],['Closed trade net','已平仓交易净额'],['Review candidates','复盘候选'],
  ['No reported trades yet','尚无已报告交易'],['Register a plan or trade, then record each actual fill. Synthetic quotes never become entries here.','先登记计划或交易，再记录每笔实际成交。合成报价不会在此生成入场。'],
  ['Initialize your local ledger','初始化本地账本'],['This creates an empty owner-reported ledger. It does not read a broker account.','这会创建空的 Owner 报告账本，不读取券商账户。'],['Create empty ledger','创建空账本'],['↓ Export ledger report','↓ 导出账本报告'],
  ['Owner-reported reviews','Owner 报告的复盘'],['Open and partially closed positions remain visible.','未平仓和部分平仓仓位继续显示。'],['Your reviews will appear here','复盘将在此显示'],['Once fills are recorded, Alpha recomputes their costs and plan deviations.','录入成交后，Alpha 会重新计算成本和计划偏差。'],
  ['Trade reviews','交易复盘'],['Mistake notebook','错误笔记'],['Activity study','交易活动研究'],['Evidence origin','证据来源'],['All origins','全部来源'],['Search lessons','搜索经验'],['Observation, trade or code','观察、交易或代码'],['No matching lessons','没有匹配的经验'],['Try another origin or search term. Missing evidence does not establish error-free execution.','尝试其他来源或搜索词。缺少证据不代表执行没有错误。'],['↓ Export review evidence','↓ 导出复盘证据'],
  ['Market data','行情数据'],['Analysis','分析'],['Guidance','决策'],['Capture','采集'],['Latest market capture','最新行情采集'],['Attributed analysis','注明来源的分析'],['Latest issued guidance','最新发布的决策'],['Quote freshness','报价新鲜度'],['Source time','源时间'],['Received time','接收时间'],['Selected','已选择'],['Returned','已返回'],['Source missing','来源缺失'],['Missing','缺失'],['Spread','价差'],['Premium range','权利金范围'],['Official close history','官方收盘历史'],['Trend','趋势'],['Blockers','阻塞条件'],['Qualified candidates','合格候选'],
  ['ETF / expiry','ETF / 到期日'],['Selected / requested / returned','已选择 / 已请求 / 已返回'],['Contract','合约'],['Quote delivery','报价返回情况'],['Response received / quote updated','响应接收 / 报价更新'],['Fresh option clocks','新鲜的期权时间'],['ETF source clock','ETF 源时间'],['New York window','纽约时间窗口'],['Saved state','保存状态'],['Returned / requested','已返回 / 已请求'],['Issued','已发布'],
  ['Evidence','证据'],['Evidence quality','证据质量'],['Scenario','情景'],['Assumption','假设'],['Research','研究'],['Review','复盘'],['Journal','日志'],['Candidate','候选'],['Qualified candidate','合格候选'],['Manual execution','手动执行'],['Owner confirmation','Owner 确认'],
  ['Prediction','预测'],['Thesis','交易逻辑'],['Invalidation','失效条件'],['Counterevidence','反向证据'],['Entry','入场'],['Exit','退出'],['Time exit','时间退出'],['Stop','止损'],['Target','目标'],['Premium stop','权利金止损'],['Position','仓位'],['Exposure','风险敞口'],['Allocation','资金配置'],
  ['Declared planning assumptions','已声明的计划假设'],['Account equity','账户权益'],['Settled cash','已结算现金'],['Round-trip fees per contract','每张合约往返手续费'],['Exit slippage reserve per contract','每张合约退出滑点预留'],['Per-trade min/max','单笔资金范围'],['Net target','净收益目标'],['Blank means unknown','留空表示未知'],
  ['Pause and ask','暂停并自问'],['Before entry','入场前'],['While holding','持仓期间'],['After a decision','决策之后'],['Personal reflection','个人反思'],['Save local note','保存本地笔记'],['Reflection only','仅供反思'],['Not a diagnosis','不构成心理诊断'],
  ['Search knowledge','搜索知识'],['Use in Alpha:','在 Alpha 中使用：'],['Boundary:','边界：'],['Open related workflow →','打开相关流程 →'],['Review evidence','复核证据'],['Sources and review coverage','来源与复核覆盖'],['Note title','笔记标题'],['Check text coverage','检查正文覆盖'],['Clear draft','清空草稿'],
  ['Source coverage','来源覆盖'],['Focused headlines','聚焦新闻'],['Asset / context','标的 / 背景'],['Source','来源'],['All sources','全部来源'],['Search headlines','搜索标题'],['Why this could matter','为什么可能重要'],['Macro storyline','宏观脉络'],['Supporting','支持证据'],['Opposing','反向证据'],['↓ Export context','↓ 导出背景'],
  ['Today’s decision','今日决策'],['Daily decision cards','每日决策卡'],['Next:','下一步：'],['Candidate checks','候选检查'],['FROM QUOTES TO A REVIEWABLE PLAN','从报价到可复核计划'],['Asset','标的'],['Premium budget','权利金预算'],['Stress loss / cap','压力亏损 / 上限'],['Decision','决策'],['Inspect checks','查看检查'],
  ['Gold driver cross-check','黄金驱动因素交叉检查'],['GLD RESEARCH CHECKLIST','GLD 研究清单'],['Choose a review horizon','选择复核期限'],['Explicit checks','明确检查'],
  ['Position exit checks','持仓退出检查'],['Stop check','止损检查'],['Net target check','净目标检查'],['Expiry','到期'],['Preview exit checks','预览退出检查'],['Prepare targeted quote request','准备定向报价请求'],['Saved exit checks at receipt processing time','在响应处理时保存的退出检查'],
  ['Trade thesis & invalidation','交易逻辑与失效条件'],['Save plan draft','保存计划草稿'],['Exact plan to freeze','待冻结的准确计划'],['Thesis:','交易逻辑：'],['Preview evaluation','预览评估'],
  ['Snapshot ID','快照 ID'],['Snapshot stage','快照阶段'],['Research snapshot','研究快照'],['Saved source comparison','已保存的来源对照'],['Evidence rows (JSON)','证据行（JSON）'],['View saved snapshot','查看已保存快照'],
  ['Scenario &amp; EV','情景与 EV'],['Prepare scenario set','准备情景集合'],['Remove scenario','移除情景'],['Add scenario','添加情景'],['Preview Assumption EV','预览假设 EV'],['View original','查看原始记录'],['Compare saved contract fit','比较已保存的合约匹配'],
  ['Source statements','来源陈述'],['Selected material coverage and clocks','所选材料的覆盖和时间'],['Prepare evidence package','准备证据包'],['Host result JSON','Host 结果 JSON'],['Receive draft','接收草稿'],['Received draft','已接收草稿'],['Optional structured fact','可选结构化事实'],['Remove','移除'],['Preview comparison','预览对照'],
  ['News & calendar →','新闻与日历 →'],['Macro World Model — Batches 1–2','宏观世界模型 · 第 1–2 批'],['Browse or search approved knowledge','浏览或搜索已批准的知识'],['Search World Model','搜索世界模型'],['Limitations','局限'],['Mechanism:','机制：'],['Counterforces:','反向力量：'],['No approved items in this group.','此组暂无已批准项目。'],
  ['Open spread review','打开价差复盘'],['Reported spread reviews','已报告价差复盘'],['Spread evidence review','价差证据复盘'],['Estimated entry fees','估算入场手续费'],['Estimated total outlay','估算总支出'],['Local source evidence','本地来源证据'],
  ['Prospective trend study','前瞻趋势研究'],['Untested research','未经验证的研究'],['Session','交易日'],['GLD observation','GLD 观察'],['IBIT observation','IBIT 观察'],['Record available evidence','记录可用证据'],
  ['Paper validation','模拟验证'],['Saved observation review','已保存观察复核'],['Preview paper plan','预览模拟计划'],['Freeze local plan','冻结本地计划'],['Discard draft','放弃草稿'],['Immutable saved reports','不可变的已保存报告'],
  ['No saved source values.','没有已保存的来源数值。'],['Compare a released actual with a saved pre-release model','将已公布实际值与事前保存模型比较'],['Saved model benchmark','已保存模型基准'],['Select saved benchmark','选择已保存基准'],['Preview difference','预览差异'],['Save comparison','保存对照'],
  ['Preview local record','预览本地记录'],['Clear this draft','清空草稿'],['Calculate risk & target','计算风险与目标'],['Reset scenario','重置情景'],['Save local assumptions','保存本地假设'],['Discard changes','放弃更改'],
  ['Original review and blockers','原始复盘和阻塞条件'],['Original plan, matching and reconciliation','原计划、匹配与对账'],['Original events and corrections','原事件和更正'],['Full calculation, assumptions and remaining requirements','完整计算、假设及剩余要求'],
  ['Supported','获得支持'],['Warning','警告'],['Invalidated','已失效'],['Pending','待检查'],['Not configured','未配置'],['Manual verification required','需要人工核实'],['Hold under original plan','按原计划持有'],['Exit condition triggered — manual action required','退出条件已触发——需要人工操作'],
  ['Local files checked','本地文件检查时间'],['No saved data','没有已保存数据'],['Reload saved data after the source is available.','来源可用后重新读取已保存数据。'],
  ['Local workspace','本地工作区'],['Saved data only','仅使用已保存数据'],['Contract detail','合约详情'],['Review local record','复核本地记录'],['Back to edit','返回编辑'],['Save local record','保存本地记录']
]);
Object.assign(phrases,Object.fromEntries([
  ['Macro playbook & decision worksheet →','宏观手册与决策问卷 →'],['source-attributed education and local notes','注明来源的教育内容与本地笔记'],
  ['Market prices are not refreshed here.','此页面不刷新行情价格。'],['component(s) unavailable; see the affected page.','个组件不可用；请查看对应页面。'],
  ['Current action first. Reference contracts and cost examples remain conditional.','先看当前可采取的行动。参考合约和成本示例仍有条件限制。'],
  ['Regular session closed','常规交易时段已结束'],['Regular session open','常规交易时段进行中'],['Review needs refresh','需要重新复核'],['news sources within refresh window','新闻来源处于刷新窗口内'],['partial feeds','部分来源'],
  ['Insufficient Evidence','证据不足'],['Price clock','价格时间'],['Saved ETF','已保存 ETF'],
  ['Refresh the attributed analysis after the latest market capture before using a directional view.','使用方向观点前，先根据最新行情采集刷新注明来源的分析。'],
  ['Wait:','等待：'],['Supporting and opposing evidence','支持与反向证据'],['Entry:','入场：'],
  ['Wait for an open regular session, current ETF and option quotes, attributed analysis agreeing with the observed trend, acceptable spread/size, and declared costs. All original blockers must clear.','等待常规交易时段开放、当前 ETF 与期权报价、与观察趋势一致的注明来源分析、可接受的价差和盘量，以及已声明成本。所有原有阻塞条件都必须解除。'],
  ['The buyer setup checklist below is not yet assessable and does not confirm an entry.','下方买方入场清单尚无法评估，也不确认可以入场。'],
  ['Buyer entry rules · Not Assessable','买方入场规则 · 无法评估'],['No sampled 14–45 DTE contract fits the premium budget and quote-side checks. This bounded sample does not cover every listed strike.','抽样的 14–45 DTE 合约均未通过权利金预算和报价检查。有限样本不覆盖所有挂牌行权价。'],
  ['Event, invalidation and time exit','事件、失效条件与时间退出'],
  ['No calibrated win probability. Quotes are snapshots; the page refresh does not collect brokerage data. Actual orders remain manual.','没有经过校准的胜率。报价只是快照；页面刷新不会采集券商数据。实际订单仍需手动执行。'],
  ['Frozen rules → future observations → independent option outcomes','冻结规则 → 未来观察 → 独立期权结果'],
  ['Routine 15:50 quotes and conditional event-hour samples do not cover this 10:40–14:30 entry window or continuous exits. Local checks use saved evidence only; no extra market collection is enabled.','15:50 例行报价及有条件的事件时段样本，无法覆盖 10:40–14:30 入场窗口或持续退出观察。本地检查仅使用已保存证据；未启用额外行情采集。'],
  ['Local saved-evidence checks:','本地已保存证据检查：'],['Disabled','已停用'],['No prospective study is registered.','尚未登记前瞻研究。'],
  ['Reads saved files only. The existing local service also checks while running. This does not request brokerage data or place orders.','只读取已保存文件。现有本地服务运行时也会检查；不会请求券商数据或下单。'],
  ['ETF trend → contract research','ETF 趋势 → 合约研究'],['Declare the rule first, inspect completed ETF bars, then compare contracts.','先声明规则，再检查已完成的 ETF K 线，最后比较合约。'],
  ['The Robinhood historical-response adapter is available. No source response has been recorded here; file imports remain unverified research evidence.','Robinhood 历史响应适配器可用；此处尚无来源响应记录，导入文件仍是未经核实的研究证据。'],
  ['Observed price path → conditional contract comparison','已观察价格路径 → 有条件的合约比较'],
  ['Use available Robinhood observations now. Strict source qualification remains separate; another data provider is optional.','现在可使用已有 Robinhood 观察。严格来源资格仍需单独判断；其他数据商不是必要前提。'],
  ['Historical discussion only. Conditions below have not triggered. Fresh ETF and option quotes, event review and an explicit exit plan are still required.','仅供历史讨论。以下条件尚未触发；仍需新鲜 ETF 与期权报价、事件复核及明确退出计划。'],
  ['No structurally usable saved candles.','没有结构上可用的已保存 K 线。'],['Open → last bar close','开盘 → 最后一根 K 线收盘'],['Late-window momentum','尾段动量'],['15 / 60 minute close means','15 / 60 分钟收盘均值'],
  ['Last 30-minute watch range','最后 30 分钟观察区间'],['Cross-interval audit','跨区间审计'],['Canonical decision','正式决策'],['Watch · unchanged','观察 · 未改变'],
  ['Trailing 3 versus 12 completed five-minute closes (15/60 minutes). Descriptive, untested, and distinct from open-to-last change or change from the prior close.','最近 3 根与 12 根已完成的五分钟 K 线收盘价比较（15/60 分钟）。仅供描述，未经验证；不同于开盘至最后一根的涨跌或相对前收盘价的变化。'],
  ['Watch levels are untested references, not proven support or resistance.','观察位未经验证，不是已证实的支撑或阻力。'],['Bullish condition · unconfirmed','看涨条件 · 未确认'],['Bearish condition · unconfirmed','看跌条件 · 未确认'],
  ['A usable trailing reference range is unavailable. Establish levels from fresh, reviewed observations before discussing entry.','缺少可用的尾段参考区间。讨论入场前，应根据新鲜、已复核的观察建立关键位。'],
  ['saved same-side contracts pass mechanical sample-fit checks. Full entry checks still apply.','个已保存的同方向合约通过机械样本匹配检查。完整入场检查仍然适用。'],
  ['historical contract references','历史合约参考'],['Strict prospective setup checks','严格前瞻入场检查'],
  ['Research matches never override Today’s decision. No automatic orders or calibrated win rate.','研究匹配不能覆盖今日决策。没有自动订单或经过校准的胜率。'],
  ['Approximate bar VWAP:','近似 K 线 VWAP：'],['Descriptive completed-bar means; approximate typical-price bar VWAP, not trade VWAP.','已完成 K 线的描述性均值；按典型价格近似计算的 K 线 VWAP，不是逐笔成交 VWAP。'],
  ['Within-session mean volume, not time-of-day relative volume.','交易日内平均成交量，不是同一时点的相对成交量。'],['No ETF OHLCV evidence saved.','没有已保存的 ETF OHLCV 证据。'],['No prospective rule registered.','没有登记前瞻规则。'],
  ['Import normalized ETF evidence','导入标准化 ETF 证据'],['Recent rules','近期规则'],['recent rules','条近期规则'],['recent imports','条近期导入'],['recent saved assessments','条近期已保存评估'],
  ['Snapshots copy original guidance and evidence for recovery.','快照复制原始决策和证据以便恢复。'],
  ['Current reassessment','当前重新评估'],['Source clocks below decide freshness.','是否新鲜由下方源时间决定。'],['This page checks local files every minute when idle; it does not fetch brokerage quotes.','页面空闲时每分钟检查本地文件，不获取券商报价。'],
  ['Regular-session guidance: closed.','常规交易时段决策：已结束。'],['Regular-session guidance: open.','常规交易时段决策：进行中。'],
  ['Reviewed calendar model; halts remain unverified.','已复核的日历模型；临时停牌仍未核实。'],['New guidance requires an analyst review at or after its latest market capture.','新决策需要在最新行情采集时或之后完成分析师复核。'],
  ['Market data → analysis → guidance','行情数据 → 分析 → 决策'],['ended fixed windows have a saved capture','个已结束固定窗口有已保存采集'],['missing','缺失'],['partial','部分完成'],
  ['Last seven calendar dates','最近七个日历日'],['Captures are associated by time, not proof of scheduled execution.','采集按时间关联，不证明计划任务实际执行。'],
  ['Returned / requested contracts','已返回 / 已请求合约'],['No issued guidance record is available.','没有可用的已发布决策记录。'],
  ['STALE / UNKNOWN / FUTURE CLOCKS','过旧 / 未知 / 未来时间'],['Freshness limit:','新鲜度上限：'],['Unknown clocks include absent quotes.','未知时间包括缺失报价。'],['A saved receipt is not execution qualification.','已保存回执不等于具备执行资格。'],['Next fixed window:','下一个固定窗口：'],['Inspect collection windows and missing evidence','查看采集窗口与缺失证据'],
  ['Normal allocation','常规资金配置'],['5% of declared equity · whole contracts','已声明权益的 5% · 整张合约'],['Illustrative premium stop','示例权利金止损'],['A trigger cannot guarantee the exit loss','触发条件不能保证退出亏损额'],['Net reward target','净收益目标'],['Requires declared fees and slippage','需要已声明手续费和滑点'],['Win probability','胜率'],['No 80% claim or automatic size increase','不声称 80% 胜率，也不自动加仓'],
  ['Capital policy preflight','资金政策预检查'],['Daily guidance assumptions. Planner edits and cost-desk comparisons are separate.','每日决策假设。计划编辑与成本台比较分别处理。'],['Capital checks only','仅检查资金条件'],
  ['No conflict is proven by these capital bounds; all contract and trading checks still apply.','这些资金边界未证明存在冲突；合约和交易检查仍然适用。'],
  ['Each illustration assumes one standard contract and declared per-contract costs.','每个示例假设一张标准合约和已声明的单张成本。'],['Capital includes the fee reserve; no contract is selected.','资金占用包含手续费预留；尚未选择合约。'],['A stop cannot guarantee the loss.','止损不能保证实际亏损额。'],['Reviewing this panel does not change a risk limit.','查看此面板不会改变风险上限。'],
  ['ILLUSTRATIVE ALL-IN CAPITAL','示例总资金占用'],['PLANNED LOSS','计划亏损'],['CAPITAL CHECKS','资金检查'],['Other checks still required','仍需其他检查'],['Exceeds a limit','超过上限'],
  ['Check each sampled contract against separate budget, risk and evidence requirements.','分别按预算、风险和证据要求检查每个抽样合约。'],['Save current check snapshot','保存当前检查快照'],
  ['Ordinary guidance uses conservative major-event waiting. An explicit saved plan can be checked separately below; selecting it creates no market request or trade.','普通决策采用保守的重大事件等待规则。下方可单独检查明确保存的计划；选择计划不会请求行情或创建交易。'],
  ['premium-affordable','权利金预算内'],['over the premium budget','超过权利金预算'],['conditional research','有条件研究'],['sampled','已抽样'],
  ['Affordability excludes costs and does not mean the risk checks passed.','可负担性不包括成本，也不代表风险检查通过。'],['Latest bounded guidance sample only.','仅限最新有边界的决策样本。'],
  ['Existing 14–45 DTE policy, budgets and risk limits are unchanged.','现有 14–45 DTE 政策、预算和风险上限不变。'],['Historical close-chain activity remains separate.','历史收盘期权链活动单独处理。'],
  ['Both ETFs','两个 ETF'],['All candidates','全部候选'],['Within premium budget','权利金预算内'],['Over premium budget','超过权利金预算'],['Unknown premium','权利金未知'],
  ['Showing','显示'],['This filter never changes a decision.','筛选不会改变决策。'],['No candidates match this filter.','没有候选匹配此筛选。'],['The sample and all excluded candidates remain available under All candidates; no substitute or trade has been created.','样本及所有排除项仍可在“全部候选”中查看；未创建替代合约或交易。'],
  ['Source qualification remains open.','来源资格仍未确认。'],['These checks cannot enable paper fills or orders.','这些检查不能启用模拟成交或订单。'],['Costs and account values below are declared scenarios, and stop triggers do not guarantee an exit price.','下方成本和账户数值是已声明的情景，止损触发不保证退出价格。'],['Saved check snapshots','已保存检查快照'],
  ['Time and volatility','时间与波动率'],['A correct direction can still lose value when the move is slow or implied volatility falls.','方向判断正确时，若价格变动慢或隐含波动率下降，期权仍可能贬值。'],['Compare the saved contract sensitivities below.','请比较下方已保存的合约敏感度。'],
  ['Independent Greek timestamps remain unknown.','希腊值的独立时间仍未知。'],['No saved selected contracts.','没有已保存的选定合约。'],['Missing data cannot establish neutral exposure.','缺失数据不能证明风险敞口中性。'],
  ['Latest observed ETF price','最近观察到的 ETF 价格'],['Need five recent distinct official session closes without conflicting prices.','需要五个近期、互不重复且价格无冲突的官方交易日收盘价。'],
  ['Ordered by feasibility then cash exposure, not expected profitability.','按可行性和资金占用排序，不按预期盈利排序。'],['Six-dimension decision check','六维决策检查'],['Direction · Unconfirmed','方向 · 未确认'],['Magnitude · Forecast Missing','幅度 · 缺少预测'],['Time · Trade Horizon Undeclared','时间 · 未声明交易期限'],['Volatility · Unassessed','波动率 · 未评估'],['Path · Unconfirmed','路径 · 未确认'],['Risk · Costs Unknown','风险 · 成本未知'],
  ['No current attributed analyst bias.','没有当前注明来源的分析师倾向。'],['This does not estimate the probability of a profitable option.','这不能估计期权盈利概率。'],
  ['Expiry breakevens below quantify the move needed under a terminal payoff assumption.','下方到期盈亏平衡点量化到期收益假设下所需的变动。'],['No expected ETF price range or pre-expiry target price has been established.','尚未确定 ETF 预期价格区间或到期前目标价格。'],
  ['The 14–45 DTE sampling range is a research filter.','14–45 DTE 的抽样范围只是研究筛选条件。'],['Expiry is not a planned exit date.','合约到期日不是计划退出日。'],['Declare the expected move window and a time exit before freezing a paper or manual trade plan.','冻结模拟或手动交易计划前，必须声明预期变动窗口和时间退出。'],
  ['A long option can lose value as time passes or implied volatility falls despite a correct direction.','即使方向正确，买入期权也可能因时间流逝或隐含波动率下降而贬值。'],['Delta is not a win probability.','Delta 不是胜率。'],
  ['Session closes do not establish a breakout, a pullback entry or an executable stop path.','交易日收盘价不能证明突破、回撤入场或可执行的止损路径。'],
  ['A stop is an intended trigger; actual loss can reach the entire premium plus costs.','止损是计划触发条件；实际亏损可能达到全部权利金加成本。'],['Account balances and fills are not verified.','账户余额与成交尚未核实。'],
  ['No attributed analyst interpretation has been saved yet.','尚未保存注明来源的分析师解释。'],['Missing news interpretation is not neutral evidence.','缺少新闻解释不等于中性证据。'],['Official closes behind the descriptive trend','描述性趋势背后的官方收盘价'],['No captured candidate contracts. The next authorized market read will populate this list.','没有采集到候选合约。下一次获准的行情读取才会填充此列表。'],
  ['Important events and decision posture','重要事件与决策姿态'],['Before major releases: wait. After timed releases: allow at least 30 minutes and require fresh evidence.','重大数据公布前等待。定时公布后至少间隔 30 分钟，并要求新鲜证据。'],
  ['FOMC date-only coverage does not invent an intraday release time.','只有日期的 FOMC 日历不会臆造日内公布时间。'],['No available calendar entries. This does not establish an event-free session.','没有可用日历事项；这不能证明当日没有事件。'],
  ['Event expectations and observed ETF prices','事件预期与已观察 ETF 价格'],['Price changes do not establish why the market moved.','价格变动不能证明市场变动的原因。'],
  ['No selected events in the current saved calendar window. This does not establish an event-free market.','当前已保存日历窗口中没有选定事件；这不能证明市场没有事件。'],['Coverage and excluded observations','覆盖与排除的观察'],
  ['These are local scenarios. Alpha does not read your account balances or verify brokerage fees.','这些是本地情景。Alpha 不读取账户余额，也不核实券商手续费。'],['Blank costs remain unknown and block a net-R plan.','留空的成本仍为未知，并阻止净 R 计划。'],
  ['Account equity (USD)','账户权益（USD）'],['Settled cash (USD)','已结算现金（USD）'],['Round-trip fees per contract (USD)','每张合约往返手续费（USD）'],['Exit slippage reserve per contract (USD)','每张合约退出滑点预留（USD）'],['Per-trade minimum (USD)','单笔最低资金（USD）'],['Per-trade maximum (USD)','单笔最高资金（USD）'],
  ['Both blank use the legacy 5% ceiling; loss caps stay separate.','两项均留空时沿用旧的 5% 上限；亏损上限仍独立有效。'],['Preview capital limits','预览资金限制'],['Preview the form to inspect capital constraints without saving.','先预览表单中的资金限制，无需保存。'],
  ['Issued recommendation history','已发布建议历史'],['Every issued view keeps its original inputs and assessment clock.','每次发布的观点都保留原输入和评估时间。'],['The current screen may differ as evidence ages.','证据变旧后，当前页面可能与历史观点不同。'],['An issued recommendation is not a trade or a realized outcome.','已发布建议不是交易或已实现结果。'],['No issued views yet. Reading this page does not issue or backdate a recommendation.','尚无已发布观点。阅读此页不会发布或倒签建议。'],
  ['Connected context and gaps','关联背景与缺口'],['A successful refresh does not mean new headlines.','成功刷新不代表出现新标题。'],['Scheduled snapshots are not continuous quotes.','定时快照不是连续报价。'],['focused news view','聚焦新闻视图'],['Source refresh clocks','来源刷新时间'],['Treasury and BTC context','美债与 BTC 背景'],
  ['Recorded outcomes can reveal process problems. They do not identify institutions, prove a market cause or establish a strategy win rate.','已记录结果可以暴露过程问题，但不能识别机构、证明市场原因或建立策略胜率。'],
  ['No saved entries in this calendar horizon. This does not establish an event-free session.','当前日历范围没有已保存事项，但不能证明没有事件。'],
  ['Ledger unavailable','账本不可用'],['candidate notes across separate evidence origins','条来自不同证据来源的候选笔记'],['5% of declared equity','已声明权益的 5%'],
  ['Purchased option','买入期权'],['Long call','买入看涨期权'],['Long put','买入看跌期权'],['Declared equity ($)','已声明权益（$）'],['Declared settled cash ($)','已声明已结算现金（$）'],['Per-trade minimum ($)','单笔最低资金（$）'],['Per-trade maximum ($)','单笔最高资金（$）'],['Whole contracts','整张合约数量'],['Multiplier: 100 shares','乘数：100 股'],['Declared price tick ($ / share)','已声明最小报价单位（$ / 股）'],['Declared bid ($ / share)','已声明买价（$ / 股）'],['Declared ask ($ / share)','已声明卖价（$ / 股）'],['Round-trip fees ($, total)','往返手续费（$，合计）'],['Adverse allowance ($, total)','不利滑点预留（$，合计）'],['Requested net reward','要求的净收益目标'],
  ['Selection range including declared fees; not a spending requirement.','选择范围包含已声明手续费，不是必须支出的金额。'],['Both blank retain the legacy 5% ceiling. Loss caps remain separate.','两项均留空时沿用旧的 5% 上限；亏损上限单独生效。'],['Blank means unknown. Enter 0 only if explicitly assumed.','留空表示未知；只有明确假设为零时才填 0。'],['Blank means unknown; it is not silently set to zero.','留空表示未知，不会暗中视为零。'],
  ['The displayed policy controls allocation. Inspect the capital preflight for active limits; calculations show planned loss and full-premium exposure separately.','显示的政策控制资金配置。请查看资金预检查中的有效限制；计算分别展示计划亏损与全额权利金敞口。'],
  ['Cost comparison fee basis','成本比较手续费依据'],['Use declared fees (blank stays unknown)','使用已声明手续费（留空仍为未知）'],['Comparison only. Your original plan and saved guidance costs stay unchanged.','仅供比较。原计划和已保存决策中的成本不变。'],['Compare fees & exit allowances','比较手续费与退出预留'],
  ['Enter the planner bid, ask and quantity, then compare 0, 1, 2 and 5 ticks of adverse exit allowance.','输入计划中的买价、卖价和数量，再比较 0、1、2、5 个最小报价单位的不利退出预留。'],['Calculations use the declared quote tick. No default fee or slippage is assumed.','计算采用已声明的报价单位，不假设默认手续费或滑点。'],
  ['Optional for new plans. Save an incomplete draft, then review and freeze before entry. Existing plans remain unchanged.','适用于新计划的可选内容。可以保存未完成草稿，再于入场前复核并冻结；旧计划保持不变。'],['Initialize or recover the existing journal before saving.','保存前请初始化或恢复现有交易日志。'],['Original contract, thesis and exit fields','原合约、交易逻辑与退出字段'],
  ['Monitoring focuses on gold and Bitcoin.','监测重点是黄金和比特币。'],['Rates, the dollar, inflation, oil and geopolitical risk remain relevant context.','利率、美元、通胀、原油和地缘政治风险仍是相关背景。'],['Unrelated company and token stories are filtered from this view.','不相关的公司及代币新闻会从此视图筛除。'],['Headline relevance does not establish direction or an entry.','标题相关不代表方向或入场依据。'],
  ['Public context refresh diagnostics','公共背景刷新诊断'],['Relevant headlines','相关新闻标题'],['Direct and indirect context','直接与间接背景'],['Direct asset news','标的直接新闻'],['Recent relevant titles','近期相关标题'],['Published within 72 hours','72 小时内发布'],['Outside focused view','不在聚焦视图中'],['Original source records are retained','原始来源记录已保留'],
  ['Hourly RSS refresh while Alpha runs. A successful read does not mean new stories or complete coverage.','Alpha 运行时每小时刷新 RSS。成功读取不代表出现新报道或覆盖完整。'],['Primary Publisher','原始发布者'],['News Reporting','新闻报道'],['Not Refreshed','未刷新'],['Last feed read','上次来源读取'],['Refresh overdue','刷新逾期'],['Partial or incomplete','部分或不完整'],
  ['Possible transmission mechanisms are conditional explanations, not measured effects.','可能的传导机制只是有条件解释，不是已测得影响。'],['GLD + IBIT and macro','GLD + IBIT 与宏观'],['matching saved headlines','条匹配的已保存标题'],['No matching saved headlines. Missing coverage is not evidence that nothing happened.','没有匹配的已保存标题。覆盖缺失不代表没有事情发生。'],
  ['Current interpretation','当前解释'],['Source-backed support, opposition and invalidation are updated by the scheduled Host review.','定时 Host 复核会更新有来源支持的支持、反向与失效信息。'],['No attributed interpretation is available.','没有可用的注明来源解释。'],
  ['Important events','重要事件'],['Calendar unavailable','日历不可用'],['Last attempt','上次尝试'],['Last successful read','上次成功读取'],['dates may be incomplete or outdated; refresh coverage before relying on an event plan.','日期可能不完整或过时；依赖事件计划前请刷新覆盖情况。'],['schedules do not contain released economic values.','日历不包含已公布的经济数值。'],['FOMC intraday times remain unknown.','FOMC 日内时间仍未知。'],['Calendar unavailable; this does not mean an event-free session.','日历不可用不等于没有事件。'],['Calendar source health','日历来源状态'],
  ['news → explicit search → reviewer selection → preview → explicit save.','新闻 → 明确搜索 → 审核者选择 → 预览 → 明确保存。'],['Context only; no automatic classification.','仅供背景参考；不自动分类。'],['Saved news / source material','已保存新闻 / 来源材料'],['Select a saved item','选择已保存项目'],['Saved links / revisions','已保存关联 / 修订'],['No reviewed link saved for this selection. Suggestions are not saved links.','所选项目没有已保存的复核关联。建议不是已保存关联。'],
  ['Event details · Source comparison','事件详情 · 来源对照'],['Use a small, explicitly selected evidence set.','使用小范围且明确选择的证据集合。'],['A single primary source is enough to document a claim.','一份原始来源可以记录一项主张。'],['Titles never establish article-body facts.','标题不能证明正文事实。'],['Existing event','现有事件'],['Select event','选择事件'],['Prepare evidence for the existing Host','为现有 Host 准备证据'],
  ['Open GLD on Robinhood','在 Robinhood 打开 GLD'],['Open IBIT on Robinhood','在 Robinhood 打开 IBIT']
]));
Object.assign(phrases,Object.fromEntries([
  ['PRACTICAL PAPER WORKFLOW','实用模拟交易流程'],['Local paper finalization:','本地模拟结果结算：'],['Last check:','上次检查：'],['No local background check is active in this server.','此服务没有运行本地后台检查。'],['It reads saved evidence only; no quote requests or orders.','仅读取已保存证据；不请求报价或订单。'],
  ['The local snapshot model is available. Freeze an explicit plan, then use later saved quotes to model entry, exit and a review.','本地快照模型可用。先冻结明确的计划，再用之后保存的报价模拟入场、退出和复盘。'],['Valid snapshots can enter this model while strict execution qualification remains separate.','合格快照可进入模型；严格执行资格仍单独判断。'],
  ['Enroll a future paper plan to follow its contract through existing bounded Host captures.','登记未来模拟计划，利用现有有界 Host 采集跟踪合约。'],['Each new capture saves an independent result and candidate review.','每次新采集会保存独立结果和候选复盘。'],['This desk does not run continuous quote polling.','此工作台不持续轮询报价。'],['Missing observations remain gaps; expired windows finalize through the running local service or the next Host publication.','缺失的观察仍是缺口；到期窗口由运行中的本地服务或下一次 Host 发布结算。'],
  ['Strict execution qualification (separate)','严格执行资格（单独判断）'],['New plans preserve exact ETF prices, including fractions of a cent.','新计划保留 ETF 精确价格，包括不足一美分的部分。'],['Option premiums and fees still use cents.','期权权利金和手续费仍以美分计。'],['Frozen older plans retain their original rules.','已冻结旧计划保留原规则。'],
  ['Latest capture:','最近采集：'],['snapshots pass receipt-time numerical checks.','个快照通过接收时点的数值检查。'],['requested quote(s) missing.','条请求报价缺失。'],['This is not execution qualification.','这不代表具备执行资格。'],['Latest quote quality and precise clocks','最新报价质量与精确时间'],['Create an assumption-only paper plan','创建仅基于假设的模拟计划'],['Frozen plans and saved outcomes','已冻结计划和已保存结果'],['No local plans saved yet.','尚无本地已保存计划。'],
  ['Freeze the rules before collecting outcomes.','采集结果前先冻结规则。'],['Scheduled snapshots do not establish candle trends, stop fills or executable returns.','定时快照不能证明 K 线趋势、止损成交或可执行收益。'],['Option candle evidence','期权 K 线证据'],['No saved market-origin historical capture. Synthetic candles are excluded from this desk.','没有已保存的真实市场来源历史采集。此工作台排除合成 K 线。'],
  ['Register a future event experiment','登记未来事件实验'],['Experiment name','实验名称'],['Saved official event','已保存官方事件'],['Choose…','请选择…'],['Minimum reaction (basis points)','最低反应幅度（基点）'],['20 bps = 0.20%. A hypothesis, not a validated threshold.','20 个基点 = 0.20%。这是待检验假设，不是已验证阈值。'],['Before event: chosen contract','事件前：所选合约'],['After event: call alternative','事件后：看涨备选'],['After event: put alternative','事件后：看跌备选'],
  ['PRE entry window starts (UTC)','事件前入场窗口开始（UTC）'],['PRE exit window starts (UTC)','事件前退出窗口开始（UTC）'],['POST entry window starts (UTC)','事件后入场窗口开始（UTC）'],['POST exit window starts (UTC)','事件后退出窗口开始（UTC）'],['First usable snapshot within the next 20 minutes.','使用之后 20 分钟内首个合格快照。'],
  ['PRE exits before release. POST starts at least 30 minutes after release.','事件前路径在公布前退出；事件后路径至少在公布 30 分钟后开始。'],['Choose matching POST underlying and expiry.','事件后备选须匹配标的与到期日。'],['Review the UTC windows; defaults do not verify exchange holidays.','复核 UTC 窗口；默认值不验证交易所休市日。'],['One contract per phase, with the current declared costs and original risk limits frozen.','每阶段一张合约，冻结当前声明成本与原有风险限制。'],['Selection quotes:','选择时报价：'],['Fee allowance Pending / unknown; slippage reserve Pending / unknown.','手续费预留待确认 / 未知；滑点预留待确认 / 未知。'],['Change cost assumptions in Daily guidance, then reset this draft.','请在每日决策中修改成本假设，再重置此草稿。'],['Freeze research plan','冻结研究计划'],['Reset draft','重置草稿'],['No frozen experiments yet','尚无已冻结实验'],['Register a future event to start collecting evidence.','登记未来事件后再开始采集证据。'],['No retrospective winning example is preloaded.','没有预先载入的事后盈利案例。'],
  ['Knowledge references · strategy remains unvalidated.','知识参考 · 策略仍未经验证。'],['Educational references and owner-authored notes.','教育资料与 Owner 撰写的笔记。'],['No new trading rule, source collection or study enrollment.','没有新增交易规则、来源采集或研究登记。'],['Personal thresholds and illustrated curves are inactive research ideas.','个人阈值和示意曲线均为未启用的研究想法。'],['The current frozen trend study and capital policy remain the decision records for that study.','当前冻结的趋势研究及资金政策仍是该研究的决策记录。'],
  ['Use the full decision chain','使用完整决策链'],['Context → expectations → ETF confirmation → contract and costs → exposure and exit plan → independent outcome → review.','背景 → 预期 → ETF 确认 → 合约与成本 → 风险敞口和退出计划 → 独立结果 → 复盘。'],['Separate macro horizon, entry timeframe, holding period and option expiry.','区分宏观期限、入场时间框架、持有期与期权到期日。'],['A macro view alone does not select a contract.','宏观观点本身不能选定合约。'],
  ['Evaluate two different things','分别评估两件事'],['Process adherence and financial outcome are separate owner reports.','纪律执行与财务结果是 Owner 分别报告的内容。'],['Neither proves skill, luck or a profitable strategy.','两者都不能单独证明能力、运气或盈利策略。'],['saved notes','条已保存笔记'],['record errors','条记录错误'],['reviewed entries','条已复核条目'],['active rules from this catalog','条来自本目录的启用规则'],
  ['Owner-approved reference','Owner 批准的参考'],['items','个条目'],['cross-theme links','条跨主题关联'],['Does not influence trading decisions.','不影响交易决策。'],['Evidence grades are retained from the saved review.','证据等级沿用已保存复核。'],['Owner approval is not independent source authentication or a fresh source check.','Owner 批准不等于独立来源认证或新的来源检查。'],['Current state:','当前状态：'],['Current-state material remains in dated research; not promoted to Runtime World Model.','当前状态材料保留在有日期的研究中，未提升为运行时世界模型。'],['Rejected interpretations and dossier-only boundaries','已拒绝的解释及仅限资料包的边界'],
  ['Voluntary reflection only.','仅供自愿反思。'],['No score, diagnosis, inferred emotion, position change or automatic save.','不打分、不诊断、不推断情绪、不改变仓位，也不自动保存。'],['Question selection is not an admission of a bias.','选择问题不等于承认存在某种偏误。'],['Use as questions','作为问题使用'],['Keep as inactive proposals','保留为未启用提案'],['Do not adopt as facts or targets','不要当作事实或目标'],
  ['Counterevidence, independent judgment, original-plan comparison, recovery pressure, ticker attachment, costs, monitoring and separate process/outcome review.','反向证据、独立判断、原计划对照、回本压力、股票代码执念、成本、监控，以及过程和结果分别复盘。'],
  ['72 hours, both conflicting 30/30 versions, one loser addition, adding winners, breakout/retest timing and final-30-second claims.','72 小时原则、两种相互冲突的 30/30 版本、亏损加仓一次、盈利加仓、突破/回测时机及最后 30 秒主张。'],['None is an active rule.','均不是启用规则。'],
  ['Universal weekly returns, unsupported win rates, guaranteed options protection, personality or cultural judgments, and unverified manipulation accusations.','普遍适用的周收益、无依据胜率、期权保证保护、人格或文化评判，以及未经核实的操纵指控。'],
  ['Choose a question to append it to your optional personal reflection.','选择问题即可将其追加到可选个人反思。'],['It stays a draft until you explicitly save the note.','在您明确保存笔记前，它仍是草稿。'],['cognitive-bias questions','个认知偏误问题'],['No confidence score or automatic allocation adjustment.','不生成信心分数，也不自动调整资金配置。'],['Write a decision note or review','写决策笔记或复盘'],['Knowledge and corrections','知识与更正'],['Mechanics reference means the cited mechanism was checked; it does not validate a strategy.','机械原理参考表示所引机制曾被核查，并不验证策略。'],
  ['Process Guide','过程指南'],['Mechanics Reference','机制参考'],['Candidate Untested','未经验证的候选'],['No matching knowledge entries.','没有匹配的知识条目。'],['Original reference:','原始引用：'],['Review evidence','复核证据'],['Personal reflection','个人反思'],['Record:','记录：'],['Catalog:','目录：'],['Self-report only.','仅为自述。'],['No saved notes. No example has been added to your production records.','没有已保存笔记；生产记录中没有添加示例。'],
  ['All dates','全部日期'],['Calls & puts','看涨与看跌'],['Volume','成交量'],['Open interest','未平仓量'],['Toggle sort direction','切换排序方向'],['Volume session and open-interest dates are unverified.','成交量所属交易日和未平仓量日期尚未核实。'],['Flags are descriptive research candidates; trade direction and institution identity are unknown.','标记仅用于描述性研究候选；交易方向与机构身份未知。'],['No matching contracts','没有匹配合约'],['Try another expiry, option type or strike.','尝试其他到期日、期权类型或行权价。'],['A missing match is not evidence that the contract does not exist.','未匹配不代表该合约不存在。'],['matching contracts','个匹配合约'],['per page','每页'],
  ['Paper simulation reviews','模拟交易复盘'],['Independent historical research','独立历史研究'],['Separate evidence origin · not the owner account','独立证据来源 · 不是 Owner 账户'],['Saved component','已保存组件'],['Trade reconciliation','交易对账'],
  ['Review local record','复核本地记录'],['No reported trades yet','尚无已报告交易']
]));
Object.assign(phrases,Object.fromEntries([
  ['Analysis','分析'],['partial feeds','部分来源'],['Saved ETF','已保存 ETF'],['Price clock','价格时间'],['Wait:','等待：'],['Buyer entry rules','买方入场规则'],['DISABLED','已停用'],['Research only','仅供研究'],['unchanged','未改变'],['BULLISH condition','看涨条件'],['BEARISH condition','看跌条件'],['unconfirmed','未确认'],['Compare','比较'],['Trend:','趋势：'],['fast','快线'],['slow','慢线'],
  ['selected contracts report all five values;','个选定合约报告全部五项数值；'],['have recent quote and receipt clocks before expiry day.','个合约在到期日前具有近期报价和接收时间。'],
  ['One standard long contract (100 shares), frozen reported Greeks and unchanged interest rates.','一张标准买入期权合约（100 股），使用冻结的已报告希腊值和不变的利率。'],['Signed local value changes before costs; no projected bid, ask, fill, P&L or net R.','成本前的有符号局部价值变化；不预测买价、卖价、成交、盈亏或净 R。'],
  ['Greeks change with price, time and volatility.','希腊值会随价格、时间和波动率变化。'],['These unit shocks omit higher-order and cross effects, have no validated accuracy range and are especially unreliable near expiry or during large event moves.','这些单位冲击忽略高阶及交叉影响，没有已验证精度范围，在接近到期或重大事件中尤其不可靠。'],['A $1 move has different relative size for each ETF.','1 美元变动对不同 ETF 的相对幅度不同。'],['Quote timestamps do not independently verify Greek timestamps.','报价时间不能独立验证希腊值时间。'],['No IV rank, historical comparison or win probability is established.','尚未建立 IV 分位、历史比较或胜率。'],
  ['conditional candidates','个有条件候选'],['sampled contracts','个抽样合约'],['Six-dimension decision check','六维决策检查'],['eligible official closes.','个合格官方收盘价。'],
  ['This guidance input has no qualified IV comparison, theta or vega analysis.','该决策输入缺少合格 IV 比较、Theta 或 Vega 分析。'],['Qualified ETF intraday OHLCV/VWAP and a prospective entry trigger are missing from this guidance input.','该决策输入缺少合格的 ETF 日内 OHLCV/VWAP 和事前入场触发条件。'],
  ['Original allocation, premium stop, net-R economics and blockers are retained.','原资金配置、权利金止损、净 R 经济计算及阻塞条件均保留。'],
  ['No issued guidance record is available.','没有可用的已发布决策记录。'],['No available calendar entries.','没有可用日历事项。'],
  ['Last saved price before the scheduled time, followed by the last observation within 30 and 120 minutes.','显示计划时间前最后一笔已保存价格，以及之后 30 和 120 分钟内最后的观察。'],['Each window shows its actual sample time; these are not exact 30-/120-minute returns or continuous candles.','每个窗口展示实际采样时间；这不是精确的 30/120 分钟收益率或连续 K 线。'],['This is a current retrospective view; a paper plan keeps its own frozen observation cutoff.','这是当前的回顾性视图；模拟计划保留自身冻结的观察截止时间。'],
  ['Major BLS entries and FOMC dates in the current saved schedules only.','仅包含当前已保存日程中的主要 BLS 事项和 FOMC 日期。'],['Unscheduled news, auctions and non-BLS releases are incomplete.','计划外新闻、拍卖及非 BLS 公布覆盖不完整。'],['At most 1,000 captures and 240 recent analyst notes; no continuous-price coverage.','最多 1,000 次采集和 240 条近期分析师笔记；没有连续价格覆盖。'],
  ['not tested','未经检验'],['option returns, release values, surprise and technical confirmation are unknown.','期权收益、公布值、预期差和技术确认均未知。'],
  ['Six headline feeds and separate Treasury/BTC/calendar sources are not all 94 catalog indicators.','六个新闻来源及单独的美债/BTC/日历来源，并不等于目录中的全部 94 项指标。'],['adds Fed speeches, EIA energy and CoinDesk to the six original feeds, with daily attributed web review and explicit coverage gaps.','在原有六个来源之外增加美联储讲话、EIA 能源与 CoinDesk，并保留每日注明来源的网页复核及明确覆盖缺口。'],
  ['Illustrative 20% premium-stop default, existing net 1.5R–2R economics and unchanged $50 allocation/$25 full-premium stress caps at $1,000.','示例默认权利金止损为 20%，现有净收益目标为 1.5R–2R；在 $1,000 资金下，$50 配置和 $25 全额权利金压力上限未变。'],['Cost declarations are scenarios, not verified brokerage fees.','成本声明属于情景，不是已核实的券商手续费。'],['separates recorded results from unproven explanations.','将已记录结果与未经证实的解释分开。'],
  ['Public news collection recorded local network permission failures. See News & calendar for source clocks.','公共新闻采集记录到本地网络权限失败。请在新闻与日历中查看来源时间。'],['Public context is scheduled hourly while Alpha runs. Check News & calendar for successful reads. Option quotes follow their scheduled reads.','Alpha 运行期间每小时安排公共背景刷新。请在新闻与日历中核对成功读取；期权报价仍按原定安排。'],
  ['ISOLATED SYNTHETIC LEDGER.','隔离的合成账本。'],['Market prices are not refreshed here.','此页面不刷新行情价格。'],
  ['Paper simulation reviews','模拟交易复盘'],['Independent historical research','独立历史研究'],['No conflict is proven by these capital bounds; all contract and trading checks still apply.','这些资金边界未证明冲突；所有合约与交易检查继续适用。']
]));
Object.assign(phrases,Object.fromEntries([
  ['Trade ID','交易 ID'],['Unique lowercase letters, numbers and hyphens; 3–80 characters.','使用 3–80 个小写字母、数字或连字符，且必须唯一。'],['Expiration date','到期日期'],['Strike ($)','行权价（$）'],['Include a declared plan','包含已声明计划'],['Plan declaration time','计划声明时间'],['UTC ISO time, e.g. 2026-09-08T14:00:00.000Z','UTC ISO 时间，例如 2026-09-08T14:00:00.000Z'],
  ['Maximum contracts','最多合约张数'],['Maximum entry debit ($, including entry costs)','最大入场支出（$，含入场成本）'],['Planned total loss ($)','计划总亏损（$）'],['Target net profit ($)','目标净利润（$）'],['Declared premium stop ($ / share)','已声明权利金止损（$ / 股）'],['Optional; a stop is not a guaranteed execution.','可选；止损并不保证成交。'],['Entry deadline','入场截止时间'],['Market view / plan','市场观点 / 计划'],['Record the original view. Later entry stays labeled retrospective.','记录原始观点。后补记录仍标为回顾性。'],['Link an existing frozen activity candidate','关联现有已冻结活动候选'],['Timing preference','时段偏好'],['Custom','自定义'],['Prefer closing entry; review exits after opening','优先尾盘入场；开盘后复核退出'],
  ['Optional decision / note ID','可选决策 / 笔记 ID'],['Planned entry trading date','计划入场交易日'],['YYYY-MM-DD; separate from realization window and contract expiry.','格式 YYYY-MM-DD；须与兑现窗口和合约到期日区分。'],['Expected realization starts','预期兑现窗口开始'],['Expected realization deadline','预期兑现截止时间'],['Next manual check','下次人工检查'],['Explicit UTC ISO time (…Z); session checks/display use America/New_York. No time is chosen for you.','请明确填写 UTC ISO 时间（…Z）；交易时段检查与显示使用纽约时间。系统不会代选时点。'],['Data interruption / manual verification arrangement','数据中断 / 人工核实安排'],['Event approach and entry confirmation','事件路径与入场确认'],['Price boundary','价格边界'],['Numeric event release','数值型事件公布'],['Source-based manual condition','基于来源的人工条件'],['Prediction evidence to be locked with this plan','随计划锁定的预测证据'],['Preview frozen plan','预览冻结计划'],['Confirm & freeze plan','确认并冻结计划'],['Saved drafts','已保存草稿'],['and frozen plans','与冻结计划'],['Market expectation snapshots','市场预期快照'],['Event source comparisons','事件来源对照'],['Evidence loop','证据闭环'],['Saved plan / version','已保存计划 / 版本'],['Choose a saved plan version','选择已保存的计划版本'],['Saved scenario versions','已保存情景版本'],['Candidate comparison · Contract Fit','候选比较 · 合约匹配'],
  ['Receive an existing Host draft','接收现有 Host 草稿'],['Preview and explicitly save comparison','预览并明确保存对照'],['Original plan version and condition','原计划版本与条件'],['Optional plan link','可选计划关联'],['Add selected condition link','添加所选条件关联'],['Review / correction note','复核 / 更正说明'],['Confirm & save comparison','确认并保存对照'],
  ['Rates, dollar & inflation benchmarks','利率、美元与通胀基准'],['Treasury nominal yields','美债名义收益率'],['Federal Reserve broad dollar','美联储广义美元指数'],['Cleveland Fed inflation nowcasts','克利夫兰联储通胀即时预测'],['Saved model comparisons','已保存模型对照'],['Intraday review','日内复核'],['Scheduled event review','计划事件复核'],['Multi-week / structural review','多周 / 结构性复核'],['Haven-shock review','避险冲击复核'],['Cash-stress review','现金压力复核'],['Factors, additions and actual coverage','因素、补充项与实际覆盖'],
  ['1. Real yields and rate decomposition','1. 实际收益率与利率分解'],['2. Dollar and FX','2. 美元与汇率'],['3. Fed path and liquidity policy','3. 美联储路径与流动性政策'],['4. Inflation and expectations','4. 通胀与预期'],['5. Employment and growth','5. 就业与增长'],['6. Oil, commodities and supply shocks','6. 石油、大宗商品与供给冲击'],['7. Treasury auctions, buybacks and fiscal supply','7. 美债拍卖、回购与财政供给'],['8. Risk appetite and financial stress','8. 风险偏好与金融压力'],['9. Gold ETF flows and holdings','9. 黄金 ETF 资金流与持仓'],['10. Futures positioning and leverage','10. 期货仓位与杠杆'],['11. Physical and regional gold demand','11. 实物与区域黄金需求'],['12. Central-bank gold purchases and sales','12. 央行黄金买卖'],['13. Mine supply, recycling and costs','13. 矿产供给、回收与成本'],['14. Gold / GLD price path and technical confirmation','14. 黄金 / GLD 价格路径与技术确认'],
  ['Additional check Event surprise and what was already priced','附加检查：事件预期差与已计价内容'],['Additional check Causal overlap, regimes and unexplained moves','附加检查：因果重叠、市场状态与未解释波动'],['Additional check Forced liquidation and collateral','附加检查：强制平仓与抵押品'],['Additional check Gold delivery, lease rates and market basis','附加检查：黄金交割、租赁利率与基差'],['Additional check Sessions, benchmarks and rebalancing','附加检查：交易时段、基准与再平衡'],['Additional check Spot gold to GLD transmission','附加检查：现货黄金向 GLD 的传导'],['Additional check Gold direction to option outcome','附加检查：黄金方向到期权结果的传导'],['Scope and evidence limits','范围与证据限制'],['Monitoring gaps and broader review','监测缺口与更广泛复核'],['Treasury real-yield evidence','美债实际收益率证据'],['BTC-USD snapshot evidence','BTC-USD 快照证据'],['Full factor catalog and numerical coverage','完整因素目录与数值覆盖'],
  ['Saved decision notes','已保存决策笔记'],['Process Guide','过程指南'],['Mechanics Reference','机制参考'],['Candidate Untested','未经验证的候选']
]));
Object.assign(phrases,Object.fromEntries([
  ['Record type','记录类型'],['Toggle sort direction','切换排序方向'],['4 locally validated, 3 partial, 3 not validated','4 项本地验证通过、3 项部分完成、3 项未验证'],
  ['Scenario & EV','情景与 EV'],['GLD · Gold','GLD · 黄金'],['IBIT · Bitcoin','IBIT · 比特币'],
  ['saved five-minute candles, unqualified historical observations','已保存五分钟 K 线，历史观察尚未合格'],['source OHLC, gray candles have unknown interpolation status. Full data in the table below.','来源 OHLC；灰色 K 线的插值状态未知。完整数据见下表。'],
  ['Unsupported local request.','不支持的本地请求。'],['The local request timed out. A save may have completed; retry the same preview to check it.','本地请求超时。保存可能已经完成；请用同一预览核对。'],['The snapshot request timed out. Reload saved data and check Saved check snapshots before saving again.','快照请求超时。再次保存前请重新读取数据，并检查已保存的检查快照。'],['Cannot reach Alpha. Start the local workbench, then retry. Your current draft is retained.','无法连接 Alpha。请启动本地工作台后重试；当前草稿已保留。']
]));

Object.assign(phrases,Object.fromEntries([
  ['Save your scenario draft before changing plans.','切换计划前请先保存情景草稿。'],
  ['Scenario copied to a draft. Check the contract, entry-cost allowance, times and thesis before saving.','情景已复制到草稿。保存前请核对合约、入场成本预留、时间和交易逻辑。'],
  ['Local record saved and recovered. Its original history is preserved.','本地记录已保存并可恢复；原有历史已保留。'],
  ['Evidence download requested. The original local stores remain unchanged.','已请求下载证据；原本地存储保持不变。'],
  ['Reviewed context saved. No trading output or source coverage changed.','已保存复核的背景；交易输出和来源覆盖未改变。'],
  ['Scenario version saved. No plan freeze, quantity change or trade permission.','情景版本已保存；没有冻结计划、变更数量或授予交易权限。'],
  ['Expectation snapshot saved. Link it to an appended plan draft; no plan freeze or trade occurred.','预期快照已保存。请将其关联到追加的计划草稿；未冻结计划或发生交易。'],
  ['Evidence package saved. Host analysis has not run.','证据包已保存；Host 分析尚未运行。'],
  ['Host draft received; review before confirmation.','已收到 Host 草稿；确认前请复核。'],
  ['Comparison saved. Original plan and positions are unchanged.','对照已保存；原计划和仓位未改变。'],
  ['Request prepared locally. Market quotes have not been refreshed.','本地请求已准备；行情报价尚未刷新。'],
  ['Original plan frozen locally. No entry or order created.','原计划已在本地冻结；没有创建入场或订单。'],
  ['Incomplete plan draft saved; no executable plan or position created.','不完整的计划草稿已保存；没有创建可执行计划或仓位。'],
  ['Evaluation saved. Existing triggers retained; no fill or exit recorded.','评估已保存；原触发记录保留，没有记录成交或退出。'],
  ['Available evidence checked; no source request or order.','已检查可用证据；没有请求来源数据或下单。'],
  ['Local paper plan frozen. No order was created.','本地模拟计划已冻结；没有创建订单。'],
  ['Independent research snapshot saved and verified.','独立研究快照已保存并验证。'],
  ['This saved source is unavailable for linking; no replacement selected.','此保存来源不可用于关联；没有选择替代来源。']
]));

export function t(key,params={}){
  const translated=phrases[key]??statusLabel(key)??key;
  return translated.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g,(whole,name)=>Object.hasOwn(params,name)?String(params[name]):whole);
}

const errorExplanations={
  MANUAL_LEDGER_OVERSELL:'卖出数量超过已记录的未平仓合约数量。请检查数量和成交顺序。',
  MANUAL_LEDGER_PLAN_ALREADY_FROZEN:'此计划已经冻结，原条件不能修改。请追加有来源的复核。',
  MANUAL_LEDGER_THESIS_PLAN_INCOMPLETE:'启用的计划条件尚不完整。可以先保存草稿，但不能作为完整交易计划。',
  MANUAL_THESIS_EVIDENCE_CLOCK_ORDER:'证据源时间、接收时间和本地保存时间的顺序不成立，不能倒填。',
  MANUAL_LEDGER_FUTURE_EXECUTION:'报告的成交时间在未来，请检查日期和时区。',
  MANUAL_LEDGER_FUTURE_PLAN:'计划声明时间在未来，请检查日期和时区。',
  MANUAL_LEDGER_PLAN_CLOCK_ORDER:'入场截止和最晚退出必须晚于计划声明，退出还必须晚于入场截止。',
  MANUAL_LEDGER_FILL_ID_REUSED:'该成交 ID 已存在，请使用更正流程。',
  MANUAL_LEDGER_TRADE_UNKNOWN:'请先选择已登记的交易。',
  MANUAL_LEDGER_STALE_CORRECTION:'该成交已有更新版本，请重新读取后再更正。',
  MANUAL_LEDGER_WRITER_LOCKED:'另一个本地写入者正在使用账本，请稍后重新读取。',
  MANUAL_LEDGER_MONEY:'请输入非负美元金额，最多六位小数。',
  MANUAL_LEDGER_COUNT:'请输入有效的整张合约数量或修订号。',
  MANUAL_LEDGER_DATE:'请输入有效的合约到期日。',
  MANUAL_LEDGER_DUPLICATE_EXECUTION_REF:'成交引用已存在，请先检查是否重复。',
  GUIDANCE_TRADE_BUDGET:'请输入以美分为单位的正数预算；最大值不得小于最小值。独立亏损限制仍然有效。',
  SESSION_REQUIRED:'本地会话已变化。请重新读取已保存数据，再预览保留的草稿。',
  WORKBENCH_LEDGER_CHANGED_REVIEW_AGAIN:'预览后账本发生变化，请返回草稿重新复核。',
  WORKBENCH_COST_SCENARIO:'请提供有效的价格、报价最小变动单位和完整情景输入。',
  WORKBENCH_COST_BOUNDS:'成本比较仅支持 1–100 张合约和有限的金额范围，请缩小情景。',
  EVENT_RESEARCH_TIMED_FUTURE_EVENT_REQUIRED:'请选择未来 14 天内、公布时间明确的官方事件。',
  EVENT_RESEARCH_SETTINGS_CHANGED:'草稿打开后风险设置发生变化，请重置草稿并复核新设置。',
  EVENT_RESEARCH_EVENT_NOT_IN_CALENDAR:'所选事件已不在当前保存的日历中，请重置并核对日历。',
  EVENT_RESEARCH_CONTRACT_NOT_IN_CAPTURE:'所选合约不在冻结的采集中，请重置并查看可用合约。',
  MACRO_BENCHMARK_NOT_PROSPECTIVE_OR_RELEASE_FUTURE:'请选择实际公布前保存的模型快照，并检查真实 UTC 公布时间。',
  MACRO_BENCHMARK_UNAVAILABLE:'该来源没有可用的已保存模型，请选择其他基准。',
  MACRO_ACTUAL_SOURCE:'请输入官方 HTTPS 公布链接；数值仍需独立核实。',
  LOCAL_RECOVERY_FAILED:'已保存数据的完整性检查失败，请检查本地服务日志和原始存储。'
};
export function localizeError(message){
  const raw=String(message??''),code=raw.match(/\(([A-Z][A-Z0-9_]+)\)\s*$/)?.[1]??(/^[A-Z][A-Z0-9_]+$/.test(raw)?raw:null);
  if(code)return `${errorExplanations[code]??'本地操作失败。'}（${code}）`;
  const translated=localizeText(raw);
  return translated===raw&&/[A-Za-z]/.test(raw)?'本地操作失败。请检查输入并重新读取已保存数据。':translated;
}

const patterns=[
  [/^Quote dates: (.+)$/,'报价日期：$1'],
  [/^Local files checked (.+)$/,'本地文件检查时间 $1'],
  [/^(\d+) component\(s\) unavailable; see the affected page\.$/,'$1 个组件不可用；请查看对应页面。'],
  [/^(\d+) components? unavailable; see the affected page\.$/,'$1 个组件不可用；请查看对应页面。'],
  [/^(\d+) of (\d+) notes\. Candidates are not approved rules and cannot change a strategy\.$/,'$1 / $2 条笔记。候选经验不是已批准规则，也不能改变策略。'],
  [/^Source (.+) · Received (.+)$/,'源时间 $1 · 接收时间 $2'],
  [/^Compare (\d+) 历史合约参考$/,'比较 $1 个历史合约参考'],
  [/^Allocation up to (.+?) · Planned-loss cap (.+?) · Full-premium stress cap (.+)$/,'资金配置最高 $1 · 计划亏损上限 $2 · 全额权利金压力上限 $3']
];
const fragments=[...Object.entries(phrases),...Object.entries(humanizedStatuses)].filter(([key])=>key.length>=14&&/\s/.test(key)).sort((a,b)=>b[0].length-a[0].length);
export function localizeText(value){
  const raw=String(value),trimmed=raw.trim();if(!trimmed)return raw;
  let translated=phrases[trimmed]??humanizedStatuses[trimmed]??null;
  if(translated===null){
    let next=trimmed;
    for(const [key,replacement] of fragments)if(next.includes(key))next=next.replaceAll(key,replacement);
    if(next!==trimmed)translated=next;
  }
  for(const [pattern,replacement] of patterns){const current=translated??trimmed;if(pattern.test(current)){translated=current.replace(pattern,replacement);break;}}
  if(translated===null||/[A-Za-z]/.test(translated)){
    const mixed=(translated??trimmed).replace(/\b(NO_TRADE|WATCH|READY_FOR_OWNER_MANUAL_ENTRY|DRAFT|UNKNOWN|AVAILABLE|MISSING|BLOCKED|PASS|FAIL)\b/g,code=>statuses[code]??code).replace(/\bUnknown\b/g,'未知');
    if(mixed!==(translated??trimmed))translated=mixed;
  }
  if(translated===null)return raw;
  return raw.slice(0,raw.indexOf(trimmed))+translated+raw.slice(raw.indexOf(trimmed)+trimmed.length);
}

function protectedNode(node){
  const parent=node.nodeType===3?node.parentElement:node;
  return Boolean(parent?.closest?.('pre,code,kbd,samp,blockquote,script,style,textarea,[translate="no"],[data-raw-source],.headline h3,.headline p:not(.hint),.event h3,.macro-note-text,.source-material-list span'));
}
export function localizeWorkbench(root){
  if(!root||typeof document==='undefined')return;
  const nodes=[];
  if(root.nodeType===3)nodes.push(root);
  else{
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode())nodes.push(walker.currentNode);
  }
  for(const node of nodes){if(protectedNode(node))continue;const next=localizeText(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;}
  const elements=root.nodeType===1?[root,...root.querySelectorAll('*')]:[];
  for(const el of elements){if(protectedNode(el))continue;for(const attr of ['aria-label','placeholder','title']){if(el.hasAttribute(attr)){const old=el.getAttribute(attr),next=localizeText(old);if(old!==next)el.setAttribute(attr,next);}}}
}
