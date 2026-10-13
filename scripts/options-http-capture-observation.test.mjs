import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {gzipSync} from 'node:zlib';
import {acquireBoundedIssuerResponse,parseWeeklyIssuerResponse} from './lib/options-weekly-issuer-sources.mjs';
import {validateHttpCaptureObservation} from './lib/options-http-capture-observation.mjs';
import {sourceHash} from './lib/options-weekly-source-storage.mjs';

const at='2026-10-13T01:00:00.000Z',payload=Buffer.from('<body><p>A😀中</p></body>');
const capture=(fetchImplementation,options={})=>acquireBoundedIssuerResponse({url:'https://fixture.invalid/original',requestedAt:at,now:()=>at,fetchImplementation,...options});
const response=(bytes=payload,headers={})=>new Response(bytes,{headers:{'content-type':'text/html; charset=utf-8',...headers}});

test('native Fetch loopback fixture observes gzip-decoded bytes without claiming wire measurement',async()=>{
 const compressed=gzipSync(payload);let requests=0;
 const server=createServer((req,res)=>{requests++;assert.equal(req.url,'/fixture');assert.equal(req.method,'GET');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Encoding':'gzip','Content-Length':String(compressed.length)});res.end(compressed);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const r=await acquireBoundedIssuerResponse({url:`http://127.0.0.1:${server.address().port}/fixture`,requestedAt:at,now:()=>at}),o=r.transportObservation;
  assert.equal(requests,1);assert.deepEqual(Buffer.from(r.rawBase64,'base64'),payload);assert.equal(o.capture.adapter,'NODE_FETCH');assert.equal(o.contentLengthDeclaredBytes,compressed.length);assert.equal(o.storedBytes,payload.length);assert.equal(o.lengthComparison,'NOT_COMPARABLE_CONTENT_ENCODING');assert.equal(o.wireBytesObserved,null);assert.equal(o.capture.streamEnded,true);assert.equal(o.documentCompleteness,'NOT_ESTABLISHED_BY_TRANSPORT_OR_HASH');validateHttpCaptureObservation(r);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('explicit identity compares byte length, not character count',async()=>{
 const r=await capture(async()=>response(payload,{'content-encoding':'identity','content-length':String(payload.length)})),o=r.transportObservation;
 assert.equal(o.lengthComparison,'DECLARED_LENGTH_MATCH');assert.equal(o.utf8ProbeCodeUnits,payload.toString('utf8').length);assert.notEqual(o.storedBytes,o.utf8ProbeCodeUnits);assert.equal(o.base64Characters,r.rawBase64.length);assert.equal(o.wireBytesObserved,null);
});
test('captured absent content encoding allows identity comparison without inventing a header',async()=>{
 const r=await capture(async()=>response(payload,{'content-length':String(payload.length)}));assert.equal(r.transportObservation.contentEncoding,null);assert.equal(r.transportObservation.headerAbsenceMeaning,'ABSENT_FROM_FETCH_RESPONSE_HEADERS');assert.equal(r.transportObservation.lengthComparison,'DECLARED_LENGTH_MATCH');assert(!Object.hasOwn(r.responseHeaders,'content-encoding'));
});
test('no content length is not a zero length or an incomplete response',async()=>{
 const r=await capture(async()=>response()),o=r.transportObservation;assert.equal(o.lengthComparison,'NO_DECLARED_CONTENT_LENGTH');assert.equal(o.contentLengthDeclaredBytes,null);assert.equal(o.localCaptureState,'EXPOSED_STREAM_END_OBSERVED');assert.equal(r.bodyComplete,true);assert.equal(o.documentCompleteness,'NOT_ESTABLISHED_BY_TRANSPORT_OR_HASH');
});
test('transfer framing is retained and conflicting content length is not compared',async()=>{
 const r=await capture(async()=>response(payload,{'transfer-encoding':'chunked','content-length':'9'}));assert.equal(r.transportObservation.transferEncoding,'chunked');assert.equal(r.transportObservation.lengthComparison,'NOT_COMPARABLE_TRANSFER_ENCODING');
});
test('clean EOF with an identity length difference does not assert truncation',async()=>{
 const r=await capture(async()=>response(payload,{'content-encoding':'identity','content-length':'3'})),o=r.transportObservation;assert.equal(o.lengthComparison,'DECLARED_LENGTH_DIFFERENCE_NOT_PROOF_OF_TRUNCATION');assert.equal(o.capture.streamEnded,true);assert.equal(o.capture.localByteLimitTruncated,false);assert.equal(r.bodyComplete,true);
});
test('empty chunks and split UTF-8 bytes use exact retained bytes',async()=>{
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array());c.enqueue(payload.subarray(0,12));c.enqueue(payload.subarray(12));c.close();}}),r=await capture(async()=>response(stream));assert.equal(r.transportObservation.capture.chunkCount,3);assert.equal(r.transportObservation.capture.bodyBytesExposed,payload.length);assert.equal(r.transportObservation.utf8ProbeCodeUnits,payload.toString('utf8').length);
});
test('local byte cap records actual clipping, even with a valid hash of retained prefix',async()=>{
 const r=await capture(async()=>response(Buffer.alloc(524300,65))),o=r.transportObservation;assert.equal(r.transportError,'BODY_TOO_LARGE');assert.equal(o.capture.bodyBytesExposed,524300);assert.equal(o.storedBytes,524288);assert.equal(o.capture.localByteLimitTruncated,true);assert.equal(o.capture.streamEnded,false);assert.equal(r.rawSha256,sourceHash(Buffer.alloc(524288,65)));assert.equal(o.localCaptureState,'LOCAL_BYTE_LIMIT_TRUNCATED');assert.equal(o.documentCompleteness,'NOT_ESTABLISHED_BY_TRANSPORT_OR_HASH');
});
test('read error after a prefix retains prefix and marks stream unfinished, not local byte clipping',async()=>{
 let n=0;const stream=new ReadableStream({pull(c){if(n++===0)c.enqueue(payload.subarray(0,5));else c.error(Error('fixture interrupted stream'));}});const r=await capture(async()=>response(stream)),o=r.transportObservation;
 assert.equal(o.storedBytes,5);assert.equal(o.capture.termination,'STREAM_ERROR');assert.equal(o.capture.streamEnded,false);assert.equal(o.capture.localByteLimitTruncated,false);assert.equal(r.bodyComplete,false);
});
test('stalled body records deadline separately from clean EOF',async()=>{
 const r=await capture(async()=>response(new ReadableStream({start(c){c.enqueue(payload);}})),{deadlineMs:10});assert.equal(r.transportObservation.capture.termination,'DEADLINE_EXCEEDED');assert.equal(r.transportObservation.capture.streamEnded,false);assert.equal(r.transportObservation.storedBytes,payload.length);
});
test('tool envelope text length or pagination cannot masquerade as an HTTP body',async()=>{
 const r=await capture(async()=>({content:[{type:'text',text:payload.toString('utf8')}],characterCount:payload.toString('utf8').length,nextCursor:'page-2'}));assert.equal(r.transportError,'RESPONSE_CONTRACT');assert.equal(r.transportObservation.storedBytes,0);assert.equal(r.transportObservation.capture.headersObserved,false);assert.equal(r.transportObservation.toolPagination,'UNKNOWN');assert.equal(r.transportObservation.toolEnvelope,'UNSUPPORTED_RESPONSE_CONTRACT');
});
test('invalid declared length and invalid UTF-8 stay distinct from byte integrity',async()=>{
 const r=await capture(async()=>response(Buffer.from([0xff,0xfe]),{'content-length':'2, 2'}));assert.equal(r.transportObservation.lengthComparison,'INVALID_DECLARED_CONTENT_LENGTH');assert.equal(r.transportObservation.utf8ProbeCodeUnits,null);assert.equal(r.transportObservation.storedBytes,2);assert.equal(r.transportObservation.capture.streamEnded,true);
});
test('observation replay catches changed counters, fabricated wire counts and false completeness',async()=>{
 const r=await capture(async()=>response());for(const modify of [r=>r.transportObservation.storedBytes++,r=>r.transportObservation.wireBytesObserved=1,r=>r.transportObservation.capture.streamEnded=false,r=>r.transportObservation.documentCompleteness='COMPLETE']){const x=structuredClone(r);modify(x);assert.throws(()=>validateHttpCaptureObservation(x),/HTTP_OBSERVATION/);assert.throws(()=>parseWeeklyIssuerResponse({...x,sourceId:'msft_ir'}),/HTTP_OBSERVATION/);}
});
test('legacy receipt observations remain absent rather than backfilled',()=>{
 const r={responseHeaders:{'content-length':'5247'},bodyComplete:true,transportError:null,rawBase64:Buffer.alloc(89272).toString('base64')};assert.equal(validateHttpCaptureObservation(r),null);assert(!Object.hasOwn(r,'transportObservation'));assert.deepEqual(r.responseHeaders,{'content-length':'5247'});
});
