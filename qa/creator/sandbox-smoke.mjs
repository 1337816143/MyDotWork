import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
if(process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REF!=='refs/heads/qa/six-module-stage1-20261005')throw new Error('Sandbox launch is restricted to the exact approved candidate CI branch');
await mkdir(new URL('./evidence/',import.meta.url),{recursive:true});
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
  await writeFile(new URL('./evidence/browser-environment.json',import.meta.url),JSON.stringify({schema:'mydotwork.creator-browser-environment.v1',sourceCommit:process.env.GITHUB_SHA,status:'PASSED',browser:await browser.version(),channel:'chrome',chromiumSandbox:true,customLaunchArguments:false,runner:process.env.RUNNER_OS,node:process.version,playwright:'1.63.0'},null,2)+'\n');
}catch(error){
  const message=String(error.message).replaceAll(process.cwd(),'.').slice(0,20000);
  await writeFile(new URL('./evidence/browser-environment.json',import.meta.url),JSON.stringify({schema:'mydotwork.creator-browser-environment.v1',sourceCommit:process.env.GITHUB_SHA,status:'FAILED',browserTests:'NOT_RUN',channel:'chrome',chromiumSandbox:true,error:message,noAlternativeLaunchAttempted:true},null,2)+'\n');
  throw error;
}finally{await browser?.close();}
