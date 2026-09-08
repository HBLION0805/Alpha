import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {refreshFocusedNews, verifyFocusedNews} from './lib/options-focused-news-io.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [mode,path,...extra] = process.argv.slice(2);
    if (extra.length) throw Error('FOCUSED_NEWS_ARGUMENTS');
    if (mode === '--refresh' && !path) {
      const result = await refreshFocusedNews();
      console.log(JSON.stringify(result,null,2));
      if (result.status === 'PARTIAL') process.exitCode=3;
    } else if (mode === '--verify' && path) {
      const record=verifyFocusedNews(process.cwd(),path);
      console.log(JSON.stringify({status:'VERIFIED',path,fingerprint:record.fingerprint}));
    } else throw Error('FOCUSED_NEWS_ARGUMENTS');
  } catch (error) {
    console.error(JSON.stringify({error:/^FOCUSED_NEWS_[A-Z_]+$/.test(error?.message)?error.message:'FOCUSED_NEWS_LOCAL_FAILURE',executionAllowed:false}));
    process.exitCode=2;
  }
}
