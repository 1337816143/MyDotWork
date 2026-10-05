import {mkdirSync, writeFileSync} from 'node:fs';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const here = fileURLToPath(new URL('./',import.meta.url));
const clean = text => String(text || '').replace(/\u001b\[[0-9;]*m/g,'').replaceAll(process.cwd(),'.').replaceAll(here,'qa/creator/').slice(0,12000);
export default class EvidenceReporter {
  constructor(){this.tests=[];this.errors=[];}
  onTestEnd(test,result){this.tests.push({
    title:test.titlePath().filter(Boolean).join(' / '), file:basename(test.location.file),
    status:result.status, expectedStatus:test.expectedStatus, durationMs:result.duration,
    errors:result.errors.map(e=>clean(e.message)),
    attachments:result.attachments.filter(a=>/\.(png|json)$/.test(a.path||'')).map(a=>({name:a.name,file:basename(a.path),contentType:a.contentType})),
  });}
  onError(error){this.errors.push(clean(error.message));}
  onEnd(result){
    mkdirSync(new URL('./evidence/',import.meta.url),{recursive:true});
    writeFileSync(new URL('./evidence/results.json',import.meta.url),JSON.stringify({
      schema:'mydotwork.creator-browser-results.v1',sourceCommit:process.env.GITHUB_SHA,
      status:result.status,tests:this.tests,errors:this.errors,
      limitations:[
        'Browser tests do not approve a production private origin or enable UI imports.',
        'Adapter restoration tests are isolated synthetic API tests inside a real browser, not UI private-import acceptance.',
        'Text scaling multiplies rendered CSS font sizes by two; it does not claim operating-system accessibility or browser chrome zoom acceptance.',
        'Screenshots are captured for human visual review; automated geometry checks do not prove aesthetic quality.',
      ],
    },null,2)+'\n');
  }
}
