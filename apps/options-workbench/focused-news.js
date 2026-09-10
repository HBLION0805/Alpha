import {esc,words,timestamp,safeLink} from './model.js';
import {goldFrameworkPanel} from './gold-framework.js';
import {macroContextPanel} from './macro-context.js';

const badge = value => '<span class="tag">'+esc(words(value))+'</span>';
const list = values => '<ul>'+values.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>';
const details = (label,value) => '<details><summary>'+esc(label)+'</summary><pre>'+esc(JSON.stringify(value,null,2))+'</pre></details>';
const empty = message => '<p class="hint">'+esc(message)+'</p>';
const link = (url,title) => {const target=safeLink(url);return target?'<a href="'+esc(target)+'" target="_blank" rel="noopener noreferrer">'+esc(title)+' ↗</a>':esc(title);};

export function deniedNewsSources(sources=[]) {
  return sources.filter(s=>s.status==='FAILED'&&s.diagnostic==='FEED_NETWORK_ACCESS_DENIED');
}
export function newsAccessNotice(sources=[]) {
  const count=deniedNewsSources(sources).length;
  return count?'<div class="notice error" role="status"><div><strong>Public news collection needs network access.</strong> '+count+' feed'+(count===1?'':'s')+' recorded a local permission denial. This identifies the collector error, not who set a restriction. Earlier headlines remain available with their original dates; check for a new successful source read before relying on current coverage.</div></div>':'';
}

export function calendarCoveragePanel(sources={}) {
  return '<div class="source-grid calendar-source-grid">'+[['bls','BLS release calendar'],['fomc','Federal Reserve meeting calendar']].map(([id,label])=>{
    const source=sources?.[id],observed=['OBSERVED_SCHEDULE','OBSERVED_DATE_SCHEDULE'].includes(source?.latestAttempt);
    const failed=Boolean(source?.sourceErrorCode)||source?.latestAttempt==='FAILED';
    const current=source?.state==='AVAILABLE'&&observed&&!failed&&source.refreshOverdue===false&&Boolean(source.lastKnownReceivedAt);
    const status=source?.state!=='AVAILABLE'?'Calendar unavailable':failed?'Latest read failed':source.refreshOverdue===true?'Refresh overdue':current?'Source read current':'Read status unknown';
    return '<div class="source"><h3>'+link(source?.sourceUrl,label)+'</h3><p'+(current?'':' class="error-text"')+'><strong>'+esc(status)+'</strong></p>'+
      '<small>Last attempt '+esc(source?.latestReceivedAt?timestamp(source.latestReceivedAt):'Unknown')+'</small>'+
      '<small>Last successful read '+esc(source?.lastKnownReceivedAt?timestamp(source.lastKnownReceivedAt):'Unknown')+'</small>'+
      (source?.sourceErrorCode||source?.errorCode?'<small>'+esc(source.sourceErrorCode??source.errorCode)+'</small>':'')+
      (!current?'<p class="hint">Saved dates may be incomplete or outdated; refresh coverage before relying on an event plan.</p>':'')+'</div>';
  }).join('')+'</div><p class="hint">Saved schedules do not contain released economic values. FOMC intraday times remain unknown.</p>';
}

export function filterFocusedNews(items,ui={}) {
  return items.filter(n=>(!ui.newsSource||n.sourceId===ui.newsSource)
    && (!ui.newsAsset||(ui.newsAsset==='MACRO'?n.scope==='INDIRECT_MACRO':n.assets.includes(ui.newsAsset)))
    && n.headline.toLowerCase().includes((ui.newsSearch??'').toLowerCase()));
}

export function focusedContext(s,ui={}) {
  const f=s.focusedNews?.data,items=filterFocusedNews(f?.items??[],ui),note=s.guidance?.data?.interpretation;
  const groups=s.calendar?.data?.groups??[];
  const events=groups.flatMap(g=>[...g.dateOnlyEntries,...g.scheduledTimeEntries]);
  return '<div class="page-heading"><div><p class="eyebrow">GOLD AND BITCOIN IN CONTEXT</p><h1>News & calendar</h1><p class="subtitle">Direct GLD / IBIT news, relevant macro developments, and the evidence still needed.</p></div><button class="button secondary" data-export="context">↓ Export context</button></div>'+
    '<div class="notice"><div>Monitoring focuses on gold and Bitcoin. Rates, the dollar, inflation, oil and geopolitical risk remain relevant context. Unrelated company and token stories are filtered from this view. Headline relevance does not establish direction or an entry.</div></div>'+
    (!f?'<p class="error-text">Focused news unavailable: '+esc(s.focusedNews?.error??'No saved evidence')+'</p>':'')+
    newsAccessNotice(f?.sources)+
    '<div class="metrics">'+[['Relevant headlines',f?.counts.relevant??0,'Direct and indirect context'],['Direct asset news',f?.counts.direct??0,'Gold / GLD and Bitcoin / IBIT'],['Recent relevant titles',f?.counts.recent??0,'Published within 72 hours'],['Outside focused view',f?.counts.excluded??0,'Original source records are retained']].map(([label,value,hint])=>'<div class="metric"><div class="metric-label">'+label+'</div><strong>'+value+'</strong><small>'+hint+'</small></div>').join('')+'</div>'+
    '<section class="card"><div class="card-head"><div><h2>Source coverage</h2><p>Hourly RSS refresh while Alpha runs. A successful read does not mean new stories or complete coverage.</p></div></div><div class="source-grid">'+(f?.sources??[]).map(source=>'<div class="source"><strong>'+esc(source.label)+'</strong><small>'+badge(source.kind)+' '+badge(source.status)+'</small><small>Last feed read '+esc(timestamp(source.observedAt))+(source.refreshOverdue?' · Refresh overdue':'')+(source.partial?' · Partial or incomplete':'')+'</small>'+(source.diagnostic?'<small>'+esc(source.diagnostic)+'</small>':'')+'</div>').join('')+'</div></section>'+
    '<div class="grid-two section-space"><section class="card"><div class="card-head"><div><h2>Focused headlines</h2><p>Possible transmission mechanisms are conditional explanations, not measured effects.</p></div></div><div class="toolbar"><label>Asset / context<select id="news-asset">'+[['','GLD + IBIT and macro'],['GLD','GLD / Gold'],['IBIT','IBIT / Bitcoin'],['MACRO','Indirect macro only']].map(([v,l])=>'<option value="'+v+'"'+((ui.newsAsset??'')===v?' selected':'')+'>'+l+'</option>').join('')+'</select></label><label>Source<select id="news-source"><option value="">All sources</option>'+(f?.sources??[]).map(source=>'<option value="'+esc(source.id)+'"'+(ui.newsSource===source.id?' selected':'')+'>'+esc(source.label)+'</option>').join('')+'</select></label><label class="grow">Search headlines<input id="news-search" value="'+esc(ui.newsSearch??'')+'" placeholder="Gold, bitcoin, inflation, oil…"></label></div><p class="hint">'+items.length+' matching saved headlines</p>'+
    (items.length?items.slice(0,100).map(n=>'<article class="headline"><div class="status-line">'+badge(n.sourceId)+' '+badge(n.scope)+' '+badge(n.freshness)+' '+badge(n.assets.join(' + '))+'</div><h3>'+link(n.link,n.headline)+'</h3><div class="meta"><span>Published '+esc(timestamp(n.publishedAt))+'</span><span>Observed in source '+esc(timestamp(n.observedAt))+'</span></div><p class="hint">'+esc(n.topics.join(' · '))+'</p><details><summary>Why this could matter</summary>'+list(n.mechanisms)+'<p class="hint">Direction remains undetermined. Verify the article and market response.</p></details></article>').join('')+(items.length>100?empty('Showing the first 100 matches; narrow the filters to inspect the rest.'):''):empty('No matching saved headlines. Missing coverage is not evidence that nothing happened.'))+'</section>'+
    '<div><section class="card"><h2>Current interpretation</h2><p>Source-backed support, opposition and invalidation are updated by the scheduled Host review.</p>'+(note?note.assets.map(a=>'<article class="headline"><h3>'+esc(a.symbol)+' · '+esc(words(a.bias))+'</h3><p>'+esc(a.summary)+'</p><details><summary>Evidence and invalidation</summary><h4>Supporting</h4>'+list(a.supporting)+'<h4>Opposing</h4>'+list(a.opposing)+'<p>'+esc(a.invalidation)+'</p><p>'+esc(a.eventPlan)+'</p><ul>'+a.sources.map(source=>'<li>'+link(source.url,source.title)+'</li>').join('')+'</ul></details></article>').join('')+'<p class="hint">Assessed '+esc(timestamp(note.assessedAt))+' · Uncalibrated interpretation</p>':empty('No attributed interpretation is available.'))+'<a href="#guidance">Open daily guidance and option candidates →</a></section>'+
    '<section class="card section-space"><h2>Important events</h2>'+calendarCoveragePanel(s.calendar?.data?.sources)+(events.length?events.map(e=>'<article class="headline"><strong>'+esc(e.title)+'</strong><p>'+esc(e.scheduledAt?timestamp(e.scheduledAt):e.startDate+' – '+e.endDate+' · time unknown')+'</p></article>').join(''):empty('Calendar unavailable; this does not mean an event-free session.'))+details('Calendar source health',s.calendar?.data?.sources)+'</section></div></div>'+
    macroContextPanel(s.macroContext,ui)+goldFrameworkPanel(s.goldFramework)+
    '<section class="card section-space"><h2>Monitoring gaps and broader review</h2>'+list(f?.gaps??['Focused source coverage is unavailable.'])+'<p>Daily web review prioritizes World Gold Council, ETF issuers and original policy sources, and checks broader gold / Bitcoin reporting. It is separate from RSS and depends on a successful Host run. Outside ChatGPT tasks and screenshot claims are not synchronized or accepted as verified data.</p>'+details('Treasury real-yield evidence',s.treasury?.data)+details('BTC-USD snapshot evidence',s.btc?.data)+details('Full factor catalog and numerical coverage',s.headlines?.data?.factors)+'</section>';
}
