// Shared, bounded lookup only. No scoring, source reads, inference or state writes.
export function lookupWorldModel(catalog,filters={}){
  if(!filters||typeof filters!=='object'||Array.isArray(filters))throw Error('WORLD_MODEL_QUERY_INVALID');
  const keys=['theme','keyword','knowledgeType','evidenceStatus'];
  if(Object.keys(filters).some(k=>!keys.includes(k))||Object.values(filters).some(v=>typeof v!=='string'||v.length>160))throw Error('WORLD_MODEL_QUERY_INVALID');
  const {theme='',keyword='',knowledgeType='',evidenceStatus=''}=filters;
  if(theme&&!catalog.themes.some(t=>t.themeId===theme))throw Error('WORLD_MODEL_QUERY_INVALID');
  if(knowledgeType&&!catalog.items.some(i=>i.knowledgeType===knowledgeType))throw Error('WORLD_MODEL_QUERY_INVALID');
  if(evidenceStatus&&![...catalog.items,...catalog.edges].some(i=>i.evidenceStatus===evidenceStatus))throw Error('WORLD_MODEL_QUERY_INVALID');
  const terms=keyword.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const match=(item,isEdge=false)=>{
    const themes=isEdge?[item.fromTheme,item.toTheme]:[item.themeId,...item.themeLinks];
    if(theme&&!themes.includes(theme)||knowledgeType&&(isEdge||item.knowledgeType!==knowledgeType)||evidenceStatus&&item.evidenceStatus!==evidenceStatus)return false;
    const text=[item.title,item.statement,...(item.aliases??[]),catalog.themes.find(t=>t.themeId===(isEdge?item.fromTheme:item.themeId))?.title].join(' ').toLowerCase();
    return terms.every(term=>text.includes(term));
  };
  // Guardrails are separately labelled audit data, never affirmative search hits.
  return {version:catalog.version,approvalRef:catalog.approvalRef,approvedAt:catalog.approvedAt,
    executionAllowed:false,tradingInfluence:false,currentStateEnabled:false,
    currentStateNotice:catalog.currentStateNotice,evidenceNotice:catalog.evidenceNotice,
    themes:catalog.themes,sharedEvidenceTimeRuleId:catalog.sharedEvidenceTimeRuleId,
    items:catalog.items.filter(i=>match(i)),edges:catalog.edges.filter(e=>match(e,true)),
    guardrails:catalog.guardrails,sourceMap:catalog.sourceMap,totalItems:catalog.items.length,
    knowledgeTypes:[...new Set(catalog.items.map(i=>i.knowledgeType))],evidenceStatuses:[...new Set([...catalog.items,...catalog.edges].map(i=>i.evidenceStatus))]};
}
