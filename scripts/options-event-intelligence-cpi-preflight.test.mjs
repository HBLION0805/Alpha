import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {equal,ok} from 'node:assert/strict';
import {captureCpiPreflight,CPI_EVENT_ID,CPI_EVENT_TIME} from './options-event-intelligence-cpi-preflight.mjs';
import {listEventObservations} from './lib/options-event-intelligence-observation.mjs';

const root=mkdtempSync(join(tmpdir(),'alpha-cpi-preflight-'));
const times=['2026-10-02T16:00:00.000Z','2026-10-02T16:00:00.100Z','2026-10-02T16:00:00.200Z','2026-10-02T16:00:00.300Z'];
let i=0;const now=()=>times[Math.min(i++,times.length-1)];
const xml='<?xml version="1.0"?><rss version="2.0"><channel><title>BLS CPI</title><link>https://www.bls.gov/</link><description>CPI</description><item><guid>cpi-aug</guid><title>Consumer Price Index - August 2026</title><link>https://www.bls.gov/news.release/cpi.nr0.htm</link><pubDate>Fri, 11 Sep 2026 08:30:00 -0400</pubDate></item></channel></rss>';
try{
 const result=await captureCpiPreflight({workspaceRoot:root,now,fetchFeed:async id=>{equal(id,'bls');return xml;}});
 equal(result.status,'PASS');equal(result.eventId,CPI_EVENT_ID);equal(result.eventTime,CPI_EVENT_TIME);equal(result.itemCount,1);equal(result.executionAllowed,false);
 const raw=JSON.parse(readFileSync(join(root,result.rawPath),'utf8'));equal(raw.url,'https://www.bls.gov/feed/cpi.rss');equal(raw.latestItems[0].headline,'Consumer Price Index - August 2026');ok(raw.sha256);
 const evidence=listEventObservations(root,CPI_EVENT_ID,'2026-10-02T16:00:01.000Z');equal(evidence.length,1);equal(evidence[0].evidence.kind,'SOURCE_STATUS');equal(evidence[0].evidence.sourceId,'bls-cpi-rss');
 equal(evidence[0].evidence.summary.includes('does not claim the October 14 release has occurred'),true);
}finally{rmSync(root,{recursive:true,force:true});}
console.log('CPI preflight tests passed');
