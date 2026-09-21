import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {refreshFocusedNews, verifyFocusedNews} from './lib/options-focused-news-io.mjs';
import {contextWorkspaceArgs} from './lib/options-runtime-roots.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const {args,workspaceRoot}=contextWorkspaceArgs(process.argv.slice(2),{errorCode:'FOCUSED_NEWS_ARGUMENTS'});
    const [mode,path,...extra] = args;
    if (extra.length) throw Error('FOCUSED_NEWS_ARGUMENTS');
    if (mode === '--refresh' && !path) {
      const result = await refreshFocusedNews({workspaceRoot});
      console.log(JSON.stringify(result,null,2));
      if (result.status === 'PARTIAL') process.exitCode=3;
    } else if (mode === '--verify' && path) {
      const record=verifyFocusedNews(workspaceRoot,path);
      console.log(JSON.stringify({status:'VERIFIED',path,fingerprint:record.fingerprint}));
    } else throw Error('FOCUSED_NEWS_ARGUMENTS');
  } catch (error) {
    console.error(JSON.stringify({error:/^FOCUSED_NEWS_[A-Z_]+$/.test(error?.message)?error.message:'FOCUSED_NEWS_LOCAL_FAILURE',executionAllowed:false}));
    process.exitCode=2;
  }
}
