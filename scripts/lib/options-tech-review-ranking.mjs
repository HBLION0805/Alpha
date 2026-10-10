// Existing TECH36_REVIEW_RULES_V1.2 ranking, preserved from the offline review adapter.
// Ranking is retrospective event research priority, never expected return or trading permission.
export function eligible(r) {
  const d=r?.dimensions;
  if (!d || ['impact','catalyst','evidence'].some(k=>!Number.isInteger(d[k]))) return false;
  if (d.impact<0 || d.impact>3 || d.catalyst<0 || d.catalyst>2 || d.evidence<0 || d.evidence>3 ||
      d.valuation!==null && (!Number.isInteger(d.valuation)||d.valuation<0||d.valuation>2)) throw Error('SCORE_RANGE');
  return r.originalVerified===true && r.materialityReviewed===true && r.companyEventVerified===true &&
    r.materialConflict===false && d.impact>=2 && d.catalyst>=1 && d.evidence>=2;
}
export function classifyAndRank(pool, reviews, maxFocus=5) {
  if(!Number.isInteger(maxFocus)||maxFocus<0||maxFocus>5 || new Set(pool).size!==pool.length) throw Error('POOL_OR_FOCUS');
  if(new Set(reviews.map(r=>r.symbol)).size!==reviews.length || reviews.some(r=>!pool.includes(r.symbol))) throw Error('REVIEW_SCOPE');
  const rows=pool.map(symbol=>{
    const r=reviews.find(x=>x.symbol===symbol);
    if(!r)return {symbol,category:'MISSING_DATA',reason:'Discovery responses exist, but no issuer/publisher original event has been verified for this company.',nextEvidence:'Publisher or issuer original linked to one of the actual discovery records; publication date and company identity.',dimensions:{impact:null,valuation:null,catalyst:null,evidence:1},coreScore:null,scoreInterval:null};
    const ok=eligible(r), d=r.dimensions, core=ok?d.impact+d.catalyst+d.evidence:null;
    return {...r,category:ok?'QUALIFIED_NOT_SELECTED':r.materialConflict?'PENDING_VERIFICATION':
      r.originalVerified?'REJECTED':'MISSING_DATA',coreScore:core,
      scoreInterval:ok?[core+(d.valuation??0),core+(d.valuation??2)]:null,
      valuationStatus:d.valuation===null?'UNKNOWN_NOT_IMPUTED':'ASSESSED'};
  });
  rows.sort((a,b)=>(b.coreScore??-1)-(a.coreScore??-1)||(b.dimensions.evidence??-1)-(a.dimensions.evidence??-1)||(b.dimensions.impact??-1)-(a.dimensions.impact??-1)||a.symbol.localeCompare(b.symbol));
  let selected=0;
  for(const r of rows)if(r.category==='QUALIFIED_NOT_SELECTED'&&selected++<maxFocus)r.category='SELECTED';
  return rows;
}
