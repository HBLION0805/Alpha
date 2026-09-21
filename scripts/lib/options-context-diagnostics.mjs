// Reduce existing collector receipts to fixed, non-sensitive operational facts.
// Neither stderr, response bodies, headlines nor absolute paths are retained.
const paths={headlines:'options-driver-monitor/refreshes.ndjson',btc:'options-btc-context/retrievals.ndjson',treasury:'options-treasury-rates/retrievals.ndjson',bls:'options-release-calendar/retrievals.ndjson',fomc:'options-fomc-calendar/retrievals.ndjson'};
const known=/^(?:HTTP_[1-5]\d{2}|HTTP_STATUS|FEED_HTTP_STATUS|(?:FEED_)?(?:NETWORK_FAILED|NETWORK_ACCESS_DENIED|DEADLINE_EXCEEDED)|DEADLINE|CONTENT_TYPE|UNEXPECTED_CONTENT_TYPE|INVALID_CONTENT_LENGTH|BODY_TOO_LARGE|BODY_LIMIT|BODY_MISSING|FEED_TOO_LARGE|INVALID_UTF8|INVALID_FEED_UTF8|UTF8|SOURCE_SCHEMA|UNSUPPORTED_OR_INCOMPLETE_FEED|MALFORMED_FEED_ITEMS|EMPTY_RESPONSE_BODY|FETCH_OR_PARSE_FAILED)$/;
export function contextFailureClass(code){
  if(/^(HTTP_|FEED_HTTP_STATUS)/.test(code??''))return 'SOURCE_HTTP_FAILURE';
  if(/^(SOURCE_SCHEMA|CONTENT_TYPE|UNEXPECTED_CONTENT_TYPE|INVALID_CONTENT_LENGTH|BODY_|FEED_TOO_LARGE|INVALID_UTF8|INVALID_FEED_UTF8|UTF8|UNSUPPORTED_OR_INCOMPLETE_FEED|MALFORMED_FEED_ITEMS|EMPTY_RESPONSE_BODY)/.test(code??''))return 'SOURCE_PARSE_FAILURE';
  if(/NETWORK|DEADLINE/.test(code??''))return 'SOURCE_NETWORK_FAILURE';
  return 'SOURCE_FAILURE_UNKNOWN';
}
const clock=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x)&&Number.isFinite(Date.parse(x))?x:null;
export function contextLocalFailure(error){
  return ['ENOENT','ENOTDIR','EEXIST','EACCES','EPERM','ENOSPC','EIO','EROFS'].includes(error?.code)||/^(?:OPTIONS_EXPORT_|.*(?:STORE_|JOURNAL_|WRITER_|BATCH_LIMIT|BATCH_INTEGRITY))/.test(error?.message??'')?'STORE_FAILURE':'REFRESH_LOCAL_FAILURE';
}
export function contextCommandResult(name,output,exitCode,stderr=''){
  if(exitCode===2){let code;try{const e=JSON.parse(stderr);code=e.code??e.message??e.error;}catch{}return {status:'FAILED',code:contextLocalFailure({message:typeof code==='string'?code:''}),exitCode,details:[],evidencePath:null};}
  let data;try{data=JSON.parse(output);}catch{return {status:'FAILED',code:'REFRESH_OUTPUT_INVALID',exitCode,details:[],evidencePath:null};}
  const rows=name==='headlines'?(data.sources??[]).map(s=>({...s.health,id:s.id??s.health?.sourceId})):
    data.report?.latestRetrieval?[{...data.report.latestRetrieval,id:name}]:data.sources??[];
  const details=Array.isArray(rows)?rows.slice(0,6).map(s=>{
    const diagnostic=known.test(s.errorCode??s.diagnostic??'')?(s.errorCode??s.diagnostic):null;
    return {source:typeof s.id==='string'&&/^[a-z0-9_-]{1,60}$/.test(s.id)?s.id:name,
      status:['OK','EMPTY','FAILED','OBSERVED_CONTEXT','UNUSABLE_CONTEXT','OBSERVED_SCHEDULE','EMPTY_SCHEDULE','OBSERVED_DATE_SCHEDULE'].includes(s.status)?s.status:'UNKNOWN',
      code:s.status==='FAILED'?contextFailureClass(diagnostic):null,diagnostic,
      httpStatus:/^HTTP_[1-5]\d{2}$/.test(diagnostic??'')?Number(diagnostic.slice(5)):null,
      requestedAt:clock(s.requestedAt),receivedAt:clock(s.receivedAt??s.observedAt)};
  }):[];
  const codes=[...new Set(details.filter(s=>s.status==='FAILED').map(s=>s.code))];
  const failed=exitCode!==0||codes.length>0;
  const evidencePath=paths[name]?'data/runtime/'+paths[name]:typeof data.path==='string'&&/^data\/runtime\/options-(?:focused-news|macro-context)\/\d{4}-\d\d-\d\d\/[a-zA-Z0-9-]+\.json$/.test(data.path)?data.path:null;
  return {status:failed?'FAILED':'OK',code:failed?(codes.length===1?codes[0]:codes.length?'SOURCE_PARTIAL_FAILURE':'REFRESH_FAILED'):null,exitCode,details,evidencePath};
}
