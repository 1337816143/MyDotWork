// Frozen candidate-review inputs, never served in the website build.
import {readFile as fsReadFile} from 'node:fs/promises';
const frozen=JSON.parse(await fsReadFile(new URL('./frozen-reference.json',import.meta.url),'utf8'));
export async function readFile(url,encoding){
 const base=new URL('./frozen/',import.meta.url).href;
 if(url.href.startsWith(base)){
  const name=decodeURIComponent(url.href.slice(base.length));
  if(!Object.hasOwn(frozen,name))throw new Error('Missing frozen reference: '+name);
  return encoding?frozen[name]:Buffer.from(frozen[name]);
 }
 return fsReadFile(url,encoding);
}
