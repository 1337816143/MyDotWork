import {defineConfig} from '@playwright/test';

// CI only. A sandbox failure remains a failure; never change launch security.
if (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('This browser harness is restricted to the approved GitHub candidate runner');
}
const modes = [
  {name:'B-dark', layout:'B', color:'dark'},
  {name:'B-light', layout:'B', color:'light'},
  {name:'A-light', layout:'A', color:'light'},
];
export default defineConfig({
  testDir:'./tests',
  outputDir:'./test-results',
  timeout:120000,
  globalTimeout:15 * 60 * 1000,
  expect:{timeout:10000},
  forbidOnly:true,
  retries:0,
  workers:2,
  fullyParallel:true,
  reporter:[['list'],['./reporter.mjs']],
  use:{
    baseURL:'http://127.0.0.1:4173',
    browserName:'chromium',
    channel:'chrome',
    launchOptions:{chromiumSandbox:true},
    headless:true,
    locale:'zh-CN',
    timezoneId:'UTC',
    serviceWorkers:'block',
    acceptDownloads:true,
    trace:'off',
    video:'off',
    screenshot:'off',
  },
  webServer:{
    command:'python3 serve_dist.py',
    url:'http://127.0.0.1:4173/creator/index.html',
    reuseExistingServer:false,
    timeout:15000,
    stdout:'ignore',
    stderr:'pipe',
  },
  projects:[
    {name:'functional', testIgnore:'**/visual.spec.mjs', use:{viewport:{width:1280,height:900}}},
    ...[320,390,768,1280].flatMap(width=>modes.map(mode=>({
      name:`visual-${width}-${mode.name}`,
      testMatch:'**/visual.spec.mjs',
      metadata:{width,...mode},
      use:{viewport:{width,height:900}},
    }))),
  ],
});
