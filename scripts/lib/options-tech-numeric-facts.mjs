import {createHash} from 'node:crypto';

const hash=s=>createHash('sha256').update(s).digest('hex');
const check=(v,c)=>{if(!v)throw Error('TECH_NUMERIC_'+c);};
const exact=(v,keys)=>check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.split(',').sort().join(),'FIELDS');
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const decimal=s=>{check(typeof s==='string'&&/^(?:0|[1-9]\d{0,17})(?:\.\d{1,6})?$/.test(s),'VALUE');const [a,b='']=s.split('.');return BigInt(a+b.padEnd(6,'0'));};
function period(p){
 exact(p,'kind,from,to');check(['MONTH','YTD'].includes(p.kind)&&[p.from,p.to].every(s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s),'PERIOD');
 const a=new Date(p.from),b=new Date(p.to),y=a.getUTCFullYear(),m=a.getUTCMonth(),end=b.getUTCMonth();
 check(a.getUTCDate()===1&&y===b.getUTCFullYear()&&p.to===new Date(Date.UTC(y,end+1,0)).toISOString().slice(0,10)&&p.from<=p.to&&(p.kind==='MONTH'?m===end:m===0),'PERIOD');return {y,m,end};
}
const percent=(current,baseline)=>{check(baseline>0n,'BASELINE');const n=(current-baseline)*1000n,abs=n<0n?-n:n,q=(abs+baseline/2n)/baseline;return (n<0n&&q!==0n?'-':'')+(q/10n)+'.'+(q%10n);};

/** Explicit attributed financial comparisons only. No extraction, scoring or source calls. */
export function validateTechNumericFacts(facts,{documents,eventId,symbol,sourceReviewSha256,citations}){
 check(Array.isArray(facts)&&facts.length>0&&facts.length<=8&&new Set(facts.map(f=>f.id)).size===facts.length,'COUNT');
 const cite=c=>{
  exact(c,'sha256,url,blockIndex,blockSha256');const d=documents.find(d=>d.sha256===c.sha256&&d.eventId===eventId&&d.symbols.includes(symbol)&&d.url===c.url&&d.status==='BODY_TEXT_EXTRACTED');
  check(d,'SOURCE');const block=d.blocks.find(b=>b.index===c.blockIndex);check(block&&hash(block.text)===c.blockSha256,'BLOCK_HASH');check(citations.some(x=>x.sha256===c.sha256&&x.blockIndex===c.blockIndex),'UNCITED_BLOCK');return block.text;
 };
 const token=t=>{exact(t,'citation,start,end');const text=cite(t.citation);check(Number.isInteger(t.start)&&Number.isInteger(t.end)&&t.start>=0&&t.end>t.start&&t.end<=text.length,'TOKEN');const raw=text.slice(t.start,t.end);check(!/[\d.,]/.test(text[t.start-1]??'')&&!/[\d.,]/.test(text[t.end]??''),'TOKEN_BOUNDARY');return raw;};
 const amount=(a,currency)=>{
  exact(a,'value,unit,period,valueSource,unitSource,periodSources,metricSource');const value=decimal(a.value),p=period(a.period);check(['ONES','THOUSANDS','MILLIONS'].includes(a.unit),'UNIT');
  const raw=token(a.valueSource);check(/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(raw)&&raw.replaceAll(',','')===a.value,'VALUE_SOURCE');
  const refs=[a.unitSource,a.metricSource,...(Array.isArray(a.periodSources)?a.periodSources:[])];check(refs.every(c=>c.sha256===a.valueSource.citation.sha256&&c.url===a.valueSource.citation.url),'SOURCE_MIX');
  const unit=cite(a.unitSource);check(({TWD:/NT\$/,USD:/US\$|\bUSD\b/,EUR:/€|\bEUR\b/})[currency].test(unit),'CURRENCY_SOURCE');check(a.unit==='MILLIONS'?/\bmillion\b/i.test(unit):a.unit==='THOUSANDS'?/\bthousands?\b/i.test(unit):!/\b(?:million|thousand|billion)\b/i.test(unit),'UNIT_SOURCE');
  check(/\bnet revenue\b/i.test(cite(a.metricSource)),'METRIC_SOURCE');check(Array.isArray(a.periodSources)&&a.periodSources.length>0&&a.periodSources.length<=3,'PERIOD_SOURCE');const labels=a.periodSources.map(cite).join(' ');
  check(new RegExp('\\b'+p.y+'\\b').test(labels)&&new RegExp('\\b'+months[p.m],'i').test(labels)&&new RegExp('\\b'+months[p.end],'i').test(labels),'PERIOD_SOURCE');return {value,p};
 };
 return facts.map(f=>{
  exact(f,'id,metric,currency,scope,scopeSource,sourceReviewSha256,current,comparisons,interpretation');check(/^[a-z0-9][a-z0-9-]{0,79}$/.test(f.id)&&f.metric==='NET_REVENUE'&&['TWD','USD','EUR'].includes(f.currency)&&['CONSOLIDATED','COMPANY_REPORTED'].includes(f.scope),'IDENTITY');
  check(f.sourceReviewSha256===sourceReviewSha256&&/^[a-f0-9]{64}$/.test(f.sourceReviewSha256),'REVIEW_VERSION');check(typeof f.interpretation==='string'&&f.interpretation.length>0&&f.interpretation.length<=1200,'INTERPRETATION');
  const scope=cite(f.scopeSource);check(f.scopeSource.sha256===f.current.valueSource.citation.sha256&&(f.scope!=='CONSOLIDATED'||/consolidated/i.test(scope)),'SCOPE_SOURCE');const current=amount(f.current,f.currency);
  check(Array.isArray(f.comparisons)&&f.comparisons.length>0&&f.comparisons.length<=2&&new Set(f.comparisons.map(c=>c.kind)).size===f.comparisons.length,'COMPARISONS');
  const comparisons=f.comparisons.map(c=>{
   exact(c,'kind,baseline,reportedPercent,reportedSource,calculation');check(['YOY','MOM'].includes(c.kind),'COMPARISON_KIND');const baseline=amount(c.baseline,f.currency);check(c.baseline.unit===f.current.unit,'MIXED_UNITS');check(c.baseline.valueSource.citation.sha256===f.current.valueSource.citation.sha256,'SOURCE_MIX');
   const a=current.p,b=baseline.p;check(f.current.period.kind===c.baseline.period.kind&&(c.kind==='YOY'?a.y===b.y+1&&a.m===b.m&&a.end===b.end:f.current.period.kind==='MONTH'&&a.y*12+a.m===b.y*12+b.m+1),'COMPARISON_PERIOD');
   exact(c.calculation,'formula,decimalPlaces,result');const result=percent(current.value,baseline.value);check(c.calculation.formula==='(current / baseline - 1) * 100'&&c.calculation.decimalPlaces===1&&c.calculation.result===result,'CALCULATION');
   check(typeof c.reportedPercent==='string'&&/^-?(?:0|[1-9]\d*)\.\d$/.test(c.reportedPercent)&&c.reportedPercent===result,'REPORTED_CALCULATION');const reported=token(c.reportedSource);check(reported.replace(/^\((.*)\)$/,'-$1')===c.reportedPercent&&c.reportedSource.citation.sha256===f.current.valueSource.citation.sha256,'REPORTED_SOURCE');
   return {...c,calculation:{...c.calculation,rounding:'NEAREST_ONE_DECIMAL_HALF_AWAY_FROM_ZERO',exactPercentNumerator:((current.value-baseline.value)*100n).toString(),exactPercentDenominator:baseline.value.toString()}};
  });return {...f,comparisons,authority:'ATTRIBUTED_SOURCE_MAPPING_WITH_BYTE_BLOCK_AND_ARITHMETIC_VALIDATION',limitations:'Column/period/financial meaning are explicitly reviewed attribution, not machine authentication; no consensus, guidance, profit or price-direction inference.'};
 });
}
