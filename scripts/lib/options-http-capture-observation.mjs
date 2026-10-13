// Observations of the Fetch body stream, not a wire capture or proof of publisher completeness.
const check=(v,c)=>{if(!v)throw Error('HTTP_OBSERVATION_'+c);};
const exact=(o,keys)=>o&&typeof o==='object'&&Object.keys(o).sort().join()===keys.split(',').sort().join();
const terminations=['END_OF_STREAM','BYTE_LIMIT','DEADLINE_EXCEEDED','CANCELLED','BODY_MISSING','REDIRECT_REJECTED','RESPONSE_CONTRACT','STREAM_ERROR','FETCH_OR_HEADERS_ERROR'];

export function buildHttpCaptureObservation(r,capture){
 check(exact(capture,'adapter,runtimeNodeVersion,runtimeUndiciVersion,responseContract,headersObserved,chunkCount,bodyBytesExposed,streamEnded,localByteLimitTruncated,termination'),'FIELDS');
 check(['NODE_FETCH','INJECTED_FETCH'].includes(capture.adapter)&&['responseContract','headersObserved','streamEnded','localByteLimitTruncated'].every(k=>typeof capture[k]==='boolean')&&['chunkCount','bodyBytesExposed'].every(k=>Number.isSafeInteger(capture[k])&&capture[k]>=0)&&terminations.includes(capture.termination),'CAPTURE');
 check(typeof capture.runtimeNodeVersion==='string'&&/^v\d+\.\d+\.\d+/.test(capture.runtimeNodeVersion)&&(capture.runtimeUndiciVersion===null||typeof capture.runtimeUndiciVersion==='string'&&capture.runtimeUndiciVersion.length<=100),'RUNTIME');
 const bytes=Buffer.from(r.rawBase64,'base64');check(bytes.toString('base64')===r.rawBase64&&bytes.length<=524288,'BYTES');
 check(capture.bodyBytesExposed>=bytes.length&&(capture.chunkCount!==0||capture.bodyBytesExposed===0)&&capture.streamEnded===(capture.termination==='END_OF_STREAM'),'COUNTS');
 check(capture.localByteLimitTruncated===(capture.termination==='BYTE_LIMIT')&&(capture.localByteLimitTruncated?bytes.length===524288&&capture.bodyBytesExposed>bytes.length:capture.bodyBytesExposed===bytes.length),'TRUNCATION');
 check(!capture.headersObserved||capture.responseContract,'CONTRACT');check(!capture.streamEnded||(capture.responseContract&&capture.headersObserved&&r.transportError===null),'END');
 check(r.bodyComplete===(capture.streamEnded&&!capture.localByteLimitTruncated&&r.transportError===null),'COMPLETE_SEMANTICS');
 const h=r.responseHeaders,rawLength=h['content-length']??null,encoding=h['content-encoding']??null,transfer=h['transfer-encoding']??null;
 const validLength=typeof rawLength==='string'&&/^\d+$/.test(rawLength)&&Number.isSafeInteger(Number(rawLength));
 const declared=validLength?Number(rawLength):null,identity=s=>s===null||s.trim().toLowerCase()==='identity';
 const comparison=!capture.headersObserved?'HEADERS_NOT_OBSERVED':rawLength===null?'NO_DECLARED_CONTENT_LENGTH':!validLength?'INVALID_DECLARED_CONTENT_LENGTH':!identity(encoding)?'NOT_COMPARABLE_CONTENT_ENCODING':!identity(transfer)?'NOT_COMPARABLE_TRANSFER_ENCODING':declared===bytes.length?'DECLARED_LENGTH_MATCH':'DECLARED_LENGTH_DIFFERENCE_NOT_PROOF_OF_TRUNCATION';
 let utf8CodeUnits=null;try{utf8CodeUnits=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes).length;}catch{}
 return {version:'FETCH_CAPTURE_OBSERVATION_V1',capture,
  byteDomain:capture.adapter==='NODE_FETCH'?'NODE_FETCH_EXPOSED_BODY_AFTER_CONTENT_DECODING':'INJECTED_FETCH_BODY_NOT_WIRE_EVIDENCE',
  wireBytesObserved:null,contentDecoding:capture.adapter==='NODE_FETCH'?'RUNTIME_MANAGED_NO_SECOND_DECOMPRESSION':'FIXTURE_ADAPTER_NOT_NATIVE_WIRE_PROOF',
  storedBytes:bytes.length,contentLengthHeader:rawLength,contentLengthDeclaredBytes:declared,contentEncoding:encoding,transferEncoding:transfer,contentType:h['content-type']??null,
  headerAbsenceMeaning:capture.headersObserved?'ABSENT_FROM_FETCH_RESPONSE_HEADERS':'HEADERS_NOT_OBSERVED',lengthComparison:comparison,
  localCaptureState:capture.localByteLimitTruncated?'LOCAL_BYTE_LIMIT_TRUNCATED':capture.streamEnded?'EXPOSED_STREAM_END_OBSERVED':'EXPOSED_STREAM_NOT_COMPLETED',
  storageEncoding:'BASE64_OF_BODY_BYTES_NO_TEXT_TRANSCODING',base64Characters:r.rawBase64.length,utf8ProbeCodeUnits:utf8CodeUnits,
  characterCountAuthority:'DIAGNOSTIC_ONLY_NEVER_HTTP_LENGTH_OR_COMPLETENESS',
  toolEnvelope:capture.responseContract?'NOT_USED_FETCH_RESPONSE_STREAM':'UNSUPPORTED_RESPONSE_CONTRACT',toolPagination:capture.responseContract?'NOT_APPLICABLE_DIRECT_FETCH_STREAM':'UNKNOWN',
  documentCompleteness:'NOT_ESTABLISHED_BY_TRANSPORT_OR_HASH'};
}

/** Older receipts have no observation: absence remains unknown, never synthesized. */
export function validateHttpCaptureObservation(r){
 if(!Object.hasOwn(r,'transportObservation'))return null;
 const expected=buildHttpCaptureObservation(r,r.transportObservation?.capture);
 check(JSON.stringify(expected)===JSON.stringify(r.transportObservation),'REPLAY');return expected;
}
