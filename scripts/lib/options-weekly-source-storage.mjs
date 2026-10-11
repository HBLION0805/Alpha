import fs from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
export const WEEKLY_SOURCE_BASE='data/runtime/options-weekly-sources';
export const sourceHash=b=>createHash('sha256').update(b).digest('hex');
const check=(v,c)=>{if(!v)throw Error(c);};
export const sourceClock=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(v);
export function readSourceBytes(root,path,max=32*1024*1024){
 check(!isAbsolute(path)&&!path.split(/[\\/]/).includes('..'),'SOURCE_PATH');
 let current=fs.realpathSync(root);const parts=path.split('/');
 for(const [index,part]of parts.entries()){
  current=resolve(current,part);const s=fs.lstatSync(current);
  check(!s.isSymbolicLink()&&(index===parts.length-1?s.isFile()&&s.nlink===1&&s.size<=max:s.isDirectory()),'SOURCE_UNSAFE');
 }
 const before=fs.statSync(current),bytes=fs.readFileSync(current),after=fs.statSync(current);
 check(before.size===after.size&&before.mtimeMs===after.mtimeMs&&before.ctimeMs===after.ctimeMs&&bytes.length<=max,'SOURCE_CHANGED');return bytes;
}
