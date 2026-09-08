import {existsSync, lstatSync, readdirSync, realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {readinessClock} from '../../src/engines/options-readiness/OptionsReadinessEngine.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {FOCUSED_NEWS_SOURCES, buildFocusedNews} from '../../src/engines/options-drivers/OptionsFocusedNews.ts';
import {FOCUSED_SOURCE_URLS, parseFocusedFeed, readPublicFocusedFeed} from './options-driver-io.mjs';

const BASE = 'data/runtime/options-focused-news';
const fail = code => { throw Error('FOCUSED_NEWS_' + code); };
const parse = bytes => parseChainSurveyJson(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
const exact = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) fail('FIELDS');
};
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);

function validateBatch(batch) {
  exact(batch, ['version','recordedAt','sources']);
  if (batch.version !== 'OPTIONS_FOCUSED_NEWS_BATCH_V1') fail('VERSION');
  readinessClock(batch.recordedAt);
  if (!Array.isArray(batch.sources) || batch.sources.length !== 3 || new Set(batch.sources.map(s => s.id)).size !== 3) fail('SOURCES');
  for (const s of batch.sources) {
    exact(s, ['id','url','observedAt','status','diagnostic','partial','rejectedItems','sourceItemCount','feedSha256','items']);
    if (!Object.hasOwn(FOCUSED_SOURCE_URLS,s.id) || s.url !== FOCUSED_SOURCE_URLS[s.id]) fail('SOURCE_ID');
    readinessClock(s.observedAt);
    if (s.observedAt > batch.recordedAt || !['OK','EMPTY','FAILED'].includes(s.status) || typeof s.partial !== 'boolean') fail('SOURCE_STATE');
    if (s.diagnostic !== null && !/^[A-Z_0-9]{1,80}$/.test(s.diagnostic)) fail('DIAGNOSTIC');
    if (![s.rejectedItems,s.sourceItemCount].every(n => Number.isSafeInteger(n) && n >= 0)) fail('COUNTS');
    if (!Array.isArray(s.items) || s.items.length > 100 || s.sourceItemCount < s.items.length + s.rejectedItems) fail('ITEM_COUNT');
    if (s.status === 'FAILED' ? s.items.length || s.feedSha256 !== null : !/^[a-f0-9]{64}$/.test(s.feedSha256)) fail('SOURCE_RESULT');
    if (s.status === 'OK' && !s.items.length || s.status === 'EMPTY' && s.items.length) fail('STATUS_COUNT');
    const ids = new Set();
    for (const item of s.items) {
      exact(item, ['sourceId','itemId','link','headline','publishedAt','observedAt','origin']);
      if (item.sourceId !== s.id || item.observedAt !== s.observedAt || item.origin !== 'PUBLIC_FEED' || !text(item.itemId,1024) || !text(item.headline,400) || !text(item.link,2048)) fail('ITEM');
      const url = new URL(item.link);
      if (url.protocol !== 'https:' || url.username || url.password || /[\\\s]/.test(item.link)) fail('LINK');
      if (item.publishedAt !== null) readinessClock(item.publishedAt);
      if (ids.has(item.itemId)) fail('DUPLICATE_ITEM');
      ids.add(item.itemId);
    }
  }
  return batch;
}

function children(root, path) {
  let current = root;
  for (const part of path.split('/')) {
    current = resolve(current,part);
    if (!existsSync(current)) return [];
    const stat = lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('UNSAFE_DIRECTORY');
  }
  const entries = readdirSync(current,{withFileTypes:true});
  if (entries.length > 4000) fail('CATALOG_LIMIT');
  return entries;
}

export function verifyFocusedNews(root, path) {
  if (!/^data\/runtime\/options-focused-news\/\d{4}-\d\d-\d\d\/[a-z0-9TZ-]+\.json$/.test(path)) fail('PATH');
  const record = parse(io.readBytes(root,path,2*1024*1024));
  exact(record,['batch','fingerprint']);
  validateBatch(record.batch);
  if (paperFingerprint(record.batch) !== record.fingerprint) fail('INTEGRITY');
  return record;
}

export async function refreshFocusedNews({workspaceRoot=process.cwd(), fetchFeed=readPublicFocusedFeed, now=()=>new Date().toISOString()}={}) {
  const root = realpathSync(workspaceRoot);
  const sources = await Promise.all(FOCUSED_NEWS_SOURCES.map(async ({id}) => {
    try {
      const xml = await fetchFeed(id), observedAt = now();
      const parsed = parseFocusedFeed(xml,id,observedAt);
      return {id,url:FOCUSED_SOURCE_URLS[id],observedAt,status:parsed.items.length?'OK':'EMPTY',diagnostic:null,
        partial:parsed.truncated || parsed.rejectedItems>0,rejectedItems:parsed.rejectedItems,sourceItemCount:parsed.sourceItemCount,
        feedSha256:createHash('sha256').update(xml).digest('hex'),items:parsed.items};
    } catch (error) {
      const diagnostic = /^(?:HTTP_[1-5]\d{2}|FEED_[A-Z_]+|UNEXPECTED_CONTENT_TYPE|INVALID_CONTENT_LENGTH|INVALID_FEED_UTF8|UNSUPPORTED_OR_INCOMPLETE_FEED|MALFORMED_FEED_ITEMS|EMPTY_RESPONSE_BODY)$/.test(error?.message) ? error.message : 'FETCH_OR_PARSE_FAILED';
      return {id,url:FOCUSED_SOURCE_URLS[id],observedAt:now(),status:'FAILED',diagnostic,partial:true,rejectedItems:0,sourceItemCount:0,feedSha256:null,items:[]};
    }
  }));
  const batch = validateBatch({version:'OPTIONS_FOCUSED_NEWS_BATCH_V1',recordedAt:now(),sources});
  if (batch.recordedAt > new Date().toISOString()) fail('FUTURE_RECORD');
  const directory = BASE + '/' + batch.recordedAt.slice(0,10);
  io.directory(root,directory);
  const path = directory + '/' + batch.recordedAt.replace(/[:.]/g,'-') + '-' + randomUUID() + '.json';
  io.writeExclusive(root,path,Buffer.from(JSON.stringify({batch,fingerprint:paperFingerprint(batch)},null,2)+'\n'));
  verifyFocusedNews(root,path);
  return {path,status:sources.some(s=>s.status==='FAILED')?'PARTIAL':'SAVED',sources:sources.map(({items,...s})=>({...s,itemsReceived:items.length})),executionAllowed:false};
}

export function readFocusedSupplement(root, at) {
  readinessClock(at);
  const days = children(root,BASE).filter(e=>/^\d{4}-\d\d-\d\d$/.test(e.name));
  if (days.some(e=>!e.isDirectory() || e.isSymbolicLink())) fail('UNSAFE_DIRECTORY');
  const paths = days.filter(day=>day.name<=at.slice(0,10)).sort((a,b)=>b.name.localeCompare(a.name)).slice(0,7).flatMap(day => {
    const files = children(root,BASE+'/'+day.name);
    if (files.length > 100) fail('DAILY_LIMIT');
    return files.filter(f=>f.name.endsWith('.json')).map(f=>BASE+'/'+day.name+'/'+f.name);
  }).sort();
  const latest = new Map(), items = new Map();
  let recordsRead = 0;
  for (const path of paths) {
    const {batch} = verifyFocusedNews(root,path);
    if (batch.recordedAt > at) continue;
    recordsRead++;
    for (const s of batch.sources) {
      latest.set(s.id,s);
      for (const item of s.items) items.set(item.sourceId+':'+item.itemId,item);
    }
  }
  return {headlines:[...items.values()],sources:FOCUSED_NEWS_SOURCES.map(source=>{
    const s=latest.get(source.id);
    return {...source,status:s?.status??'NOT_REFRESHED',observedAt:s?.observedAt??null,diagnostic:s?.diagnostic??null,partial:s?.partial??true};
  }),recordsRead};
}

export function focusedNewsView(root, legacy, at) {
  const supplement = readFocusedSupplement(root,at);
  const health = (legacy?.sources??[]).map(s=>({id:s.id,label:s.label,kind:'PRIMARY_PUBLISHER',status:s.health.status,
    observedAt:s.health.observedAt,diagnostic:s.health.diagnostic,partial:Boolean(s.health.truncated || s.health.diagnostic)}));
  return {...buildFocusedNews([...(legacy?.headlines??[]),...supplement.headlines],[...health,...supplement.sources],at),supplementRecords:supplement.recordsRead};
}
