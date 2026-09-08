import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute} from 'node:path';
import {classifyFocusedHeadline,buildFocusedNews,FOCUSED_NEWS_SOURCES} from '../src/engines/options-drivers/OptionsFocusedNews.ts';
import {parseDriverFeed,parseFocusedFeed,readPublicDriverFeed,readPublicFocusedFeed,FOCUSED_SOURCE_URLS} from './lib/options-driver-io.mjs';
import {refreshFocusedNews,readFocusedSupplement,verifyFocusedNews,focusedNewsView} from './lib/options-focused-news-io.mjs';
import {focusedContext,filterFocusedNews} from '../apps/options-workbench/focused-news.js';
import {contextRefreshSlots,runPublicContextOnce} from './options-context-service.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';

let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function temp(fn){
  const root=mkdtempSync(join(tmpdir(),'alpha-focused-news-test-'));
  try {await fn(root);} finally {
    const path=realpathSync(root),rel=relative(realpathSync(tmpdir()),path);
    if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-focused-news-test-'))throw Error('UNSAFE_TEST_CLEANUP');
    rmSync(path,{recursive:true,force:true});
  }
}
const at='2026-09-07T14:00:00.000Z';
const item=(headline,extra={})=>({sourceId:'coindesk',itemId:'story',link:'https://www.coindesk.com/test',headline,publishedAt:at,observedAt:at,origin:'PUBLIC_FEED',...extra});
const rss=(title='Bitcoin ETF flows change')=>'<rss version="2.0"><channel><item><title>'+title+'</title><link>https://www.coindesk.com/test</link><guid>story</guid><pubDate>Mon, 07 Sep 2026 14:00:00 GMT</pubDate></item></channel></rss>';
const opts=root=>({workspaceRoot:root,now:()=>at,fetchFeed:async()=>rss()});

for(const [title,scope,assets] of [
  ['Gold ETF outflows rise','DIRECT',['GLD']],
  ['Bitcoin ETF inflows reverse','DIRECT',['IBIT']],
  ['GLD and IBIT option activity','DIRECT',['GLD','IBIT']],
  ["Bitcoin's golden cross is here",'DIRECT',['IBIT']],
  ['CPI inflation surprise raises interest rates','INDIRECT_MACRO',['GLD','IBIT']],
  ['Brent crude oil prices rise after Iran escalation','INDIRECT_MACRO',['GLD','IBIT']],
  ['Yen rally pressures risk appetite','INDIRECT_MACRO',['GLD','IBIT']],
  ['USDC stablecoin depeg raises custody concerns','INDIRECT_MACRO',['IBIT']],
  ['Goldman Sachs raises Nvidia price target','OUT_OF_SCOPE',[]],
  ['MU and AMD lead semiconductor gains','OUT_OF_SCOPE',[]],
  ['Ethereum sets quantum resistance deadline','OUT_OF_SCOPE',[]],
  ['Gold medals awarded at the games','OUT_OF_SCOPE',[]],
]) await test('focused scope: '+title,()=>{const r=classifyFocusedHeadline(title);assert.equal(r.scope,scope);assert.deepEqual(r.assets,assets);assert.equal(r.direction,'UNDETERMINED');assert.equal(r.verifiedFact,false);});

await test('mechanisms remain conditional and allow opposing effects',()=>{const r=classifyFocusedHeadline('Gold rises as oil prices climb');assert(r.mechanisms.some(m=>m.includes('conflict')));});
for(const [label,extra,freshness] of [
  ['unknown publication',{publishedAt:null},'PUBLICATION_TIME_UNKNOWN'],
  ['old article refreshed now',{publishedAt:'2026-09-01T14:00:00.000Z'},'STALE'],
  ['future publication',{publishedAt:'2026-09-08T14:00:00.000Z'},'FUTURE_PUBLICATION'],
  ['synthetic origin',{origin:'MANUAL_SCENARIO'},'SCENARIO'],
]) await test(label,()=>assert.equal(buildFocusedNews([item('Bitcoin flows',extra)],[],at).items[0].freshness,freshness));
await test('future receipt cannot appear in current view',()=>{const r=buildFocusedNews([item('Gold flows',{observedAt:'2026-09-08T14:00:00.000Z'})],[],at);assert.equal(r.items.length,0);assert.equal(r.counts.futureReceipts,1);});
await test('repeated article does not multiply independent evidence',()=>{const r=buildFocusedNews([item('Bitcoin flows'),item('Bitcoin flows')],[],at);assert.equal(r.counts.total,1);});
await test('later correction replaces only the current item view',()=>{const original=item('Bitcoin flows',{observedAt:'2026-09-07T13:00:00.000Z'}),corrected=item('Bitcoin outflows');assert.equal(buildFocusedNews([original,corrected],[],at).items[0].headline,'Bitcoin outflows');assert.equal(original.headline,'Bitcoin flows');});
await test('unknown source receipt remains overdue',()=>assert(buildFocusedNews([],[{id:'coindesk',label:'CoinDesk',kind:'NEWS_REPORTING',status:'NOT_REFRESHED',observedAt:null,diagnostic:null,partial:true}],at).sources[0].refreshOverdue));

await test('new feed wrappers retain original six-source boundary',async()=>{
  assert.throws(()=>parseDriverFeed(rss(),'coindesk',at),/UNREGISTERED_DRIVER_SOURCE/);
  await assert.rejects(readPublicDriverFeed('coindesk'),/UNREGISTERED_DRIVER_SOURCE/);
  assert.throws(()=>parseFocusedFeed(rss(),'fed',at),/UNREGISTERED_FOCUSED_SOURCE/);
  await assert.rejects(readPublicFocusedFeed('https://example.com'),/UNREGISTERED_FOCUSED_SOURCE/);
  assert.deepEqual(parseDriverFeed(rss(),'fed',at).items[0],{...item('Bitcoin ETF flows change'),sourceId:'fed'});
});
await test('all fixed supplemental URLs are fetched without redirects or credentials',async()=>{
  for(const source of FOCUSED_NEWS_SOURCES){await readPublicFocusedFeed(source.id,async(url,options)=>{assert.equal(url,FOCUSED_SOURCE_URLS[source.id]);assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');return new Response(rss(),{headers:{'content-type':'application/xml'}});});}
});
await test('redirect replies stay blocked',()=>assert.rejects(readPublicFocusedFeed('coindesk',async()=>new Response('',{status:308,headers:{location:'https://example.com'}})),/HTTP_308/));
await test('HTML is not silently accepted as a feed',()=>assert.rejects(readPublicFocusedFeed('coindesk',async()=>new Response('<html/>',{headers:{'content-type':'text/html'}})),/UNEXPECTED_CONTENT_TYPE/));
await test('supplemental read has a total deadline',()=>assert.rejects(readPublicFocusedFeed('coindesk',()=>new Promise(()=>{}),{deadlineMs:5}),/FEED_DEADLINE_EXCEEDED/));
await test('DTD feeds are rejected',()=>assert.throws(()=>parseFocusedFeed('<!DOCTYPE rss>'+rss(),'coindesk',at),/UNSUPPORTED/));
await test('uninterpreted EST publication remains unknown',()=>assert.equal(parseFocusedFeed(rss().replace('GMT','EST'),'eia_energy',at).items[0].publishedAt,null));

await test('missing supplement is explicit and reading creates no records',()=>temp(root=>{const r=readFocusedSupplement(root,at);assert.equal(r.recordsRead,0);assert(r.sources.every(s=>s.status==='NOT_REFRESHED'));}));
await test('immutable supplement survives independent recovery',()=>temp(async root=>{const saved=await refreshFocusedNews(opts(root)),verified=verifyFocusedNews(root,saved.path),view=readFocusedSupplement(root,at);assert.equal(verified.batch.sources.length,3);assert.equal(view.headlines.length,3);assert.equal(view.recordsRead,1);assert.equal(saved.status,'SAVED');}));
await test('one source failure retains other source evidence and sanitizes errors',()=>temp(async root=>{const saved=await refreshFocusedNews({...opts(root),fetchFeed:async id=>{if(id==='coindesk')throw Error('SECRET PRIVATE ERROR');return rss();}});assert.equal(saved.status,'PARTIAL');assert.equal(saved.sources.filter(s=>s.status==='OK').length,2);assert(!JSON.stringify(saved).includes('SECRET'));}));
await test('later failed source retains old titles with failed current health',()=>temp(async root=>{const saved=await refreshFocusedNews(opts(root)),before=readFileSync(join(root,saved.path));await refreshFocusedNews({...opts(root),now:()=> '2026-09-07T15:00:00.000Z',fetchFeed:async()=>{throw Error('failed');}});const r=readFocusedSupplement(root,'2026-09-07T15:00:00.000Z');assert.equal(r.headlines.length,3);assert(r.sources.every(s=>s.status==='FAILED'));assert(readFileSync(join(root,saved.path)).equals(before));}));
await test('local metadata tampering is rejected',()=>temp(async root=>{const s=await refreshFocusedNews(opts(root)),path=join(root,s.path),record=JSON.parse(readFileSync(path));record.batch.sources[0].items[0].headline='Gold surge';writeFileSync(path,JSON.stringify(record));assert.throws(()=>verifyFocusedNews(root,s.path),/INTEGRITY/);}));
await test('verification cannot select outside the focused store',()=>temp(root=>assert.throws(()=>verifyFocusedNews(root,'../README.md'),/FOCUSED_NEWS_PATH/)));
await test('future persisted batch is unavailable before receipt',()=>temp(async root=>{await refreshFocusedNews(opts(root));const r=readFocusedSupplement(root,'2026-09-07T13:00:00.000Z');assert.equal(r.headlines.length,0);assert.equal(r.recordsRead,0);}));
await test('later day directories cannot displace earlier as-of evidence',()=>temp(async root=>{for(let day=1;day<=8;day++)await refreshFocusedNews({...opts(root),now:()=> '2026-08-'+String(day).padStart(2,'0')+'T14:00:00.000Z'});const r=readFocusedSupplement(root,'2026-08-01T15:00:00.000Z');assert.equal(r.headlines.length,3);assert.equal(r.recordsRead,1);}));
await test('current legacy source objects remain unchanged by projection',()=>temp(root=>{const legacy={headlines:[item('Gold demand',{sourceId:'fed'})],sources:[]},before=JSON.stringify(legacy);assert.equal(focusedNewsView(root,legacy,at).counts.relevant,1);assert.equal(JSON.stringify(legacy),before);}));

await test('supplemental slot is independent of old hourly and daily claims',()=>temp(async root=>{const calls=[];const options={workspaceRoot:root,now:()=>at,issue:false,execute:async name=>{calls.push(name);return {status:'OK'};}};const r=await runPublicContextOnce(options);await runPublicContextOnce(options);assert.equal(calls.filter(n=>n==='focused_news').length,1);assert.equal(r.results[2].slot,'focused-hourly-2026-09-07T14');assert.equal(contextRefreshSlots(at)[0].key,'hourly-2026-09-07T14');}));
await test('asset and macro filters retain only matching focused rows',()=>{const rows=buildFocusedNews([item('Gold demand'),item('Bitcoin flows',{itemId:'btc'}),item('Oil prices rise',{itemId:'oil'})],[],at).items;assert.equal(filterFocusedNews(rows,{newsAsset:'GLD'}).length,2);assert.equal(filterFocusedNews(rows,{newsAsset:'IBIT'}).length,2);assert.equal(filterFocusedNews(rows,{newsAsset:'MACRO'}).length,1);});
await test('focused page escapes headlines and preserves unknown dates',()=>{const f=buildFocusedNews([item('Bitcoin <script>alert(1)</script>',{publishedAt:null})],[],at);const html=focusedContext({focusedNews:{data:f}});assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(html.includes('Publication Time Unknown'));assert(html.includes('No attributed interpretation'));});
await test('focused frontend asset is served with existing CSP',()=>temp(async root=>{const app=await startOptionsWorkbench({port:0,workspaceRoot:root});try{const r=await fetch(app.url+'/focused-news.js');assert.equal(r.status,200);assert(r.headers.get('content-security-policy'));assert((await r.text()).includes('filterFocusedNews'));}finally{await app.close();}}));

console.log(passed+'/'+passed+' tests passed.');
