import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.env.CREATOR_UI_DIR||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'app.mjs'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
test('entry has first-paint appearance, restrictive network CSP and independent legacy links',()=>{
  assert.ok(html.indexOf('appearance-boot.js')<html.indexOf('styles.css'));assert.match(html,/default-src 'none'/);assert.match(html,/connect-src 'none'/);assert.doesNotMatch(html,/<script[^>]*>[^<\s]/);assert.match(html,/\.\.\/dashboard\//);assert.match(html,/\.\.\/chat\//);assert.match(html,/\.\.\/projects\//);
});
test('runtime has no unsafe HTML or implicit fetch, no public data file model',()=>{
  assert.doesNotMatch(app,/innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|fetch\(|XMLHttpRequest/);assert.doesNotMatch(app,/dashboard\/data\.json|catalog\.json|approvedPrivateOrigin:true/);assert.match(app,/approvedPrivateOrigin:false/);assert.match(app,/createTextNode/);
});
test('responsive, keyboard and reduced-motion requirements have explicit implementation hooks',()=>{
  assert.match(css,/font:16px/);assert.match(css,/@media \(max-width:680px\)/);assert.match(css,/@media \(max-width:360px\)/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/data-motion=off/);assert.doesNotMatch(css,/,@media/);assert.match(app,/onCancel/);assert.match(app,/popstate/);assert.match(app,/focus\(/);assert.match(app,/'selected'\]/);
});
test('six module renderers, conflict facts and truthful private-data gates exist',()=>{
  for(const name of ['renderDesk','renderIdeas','renderProduction','renderCalendar','renderLibrary','renderDatabase'])assert.match(app,new RegExp(`function ${name}\\(`));
  assert.match(app,/noCommonBase/);assert.match(app,/commonBase/);assert.match(app,/missingAssets/);assert.match(app,/preview\.conflicts\.some/);assert.match(app,/allowBackupImport/);assert.match(app,/input\.v1/);assert.match(app,/发布快照|不可变发布快照/);
});
test('confirmed enlarged badge/filter sizing and opened-state guidance preserve visible content',()=>{
  assert.match(css,/width:2\.4em;height:2\.4em/);assert.match(css,/flex:1 1 11em/);assert.match(css,/flex:2 1 16em/);assert.match(css,/flex-basis:9em/);assert.doesNotMatch(css,/flex-basis:125px/);
  assert.doesNotMatch(css,/overflow-x\s*:\s*(?:hidden|clip)/);assert.doesNotMatch(app,/演示工作区为空/);assert.match(app,/onKeydown:handleDialogKeydown/);
});
test('publication metadata wraps complete ISO timestamps without reducing text or hiding overflow',()=>{
  const rule=css.match(/\.publication-row \.hint\s*\{([^}]+)\}/);
  assert.ok(rule,'Publication metadata needs a scoped long-token wrapping rule');
  assert.equal(rule[1].replace(/\s/g,''),'overflow-wrap:anywhere');
  assert.match(app,/para\(`实际发布时间 \$\{pub\.actualPublishedAt\} · 用户手动登记`,'hint'\)/);
  assert.doesNotMatch(css,/overflow-x\s*:\s*(?:hidden|clip)/);
});
test('narrow calendar dates retain both digits at the original enlarged font size',()=>{
  const rule=css.match(/\.calendar-day \.day-number\s*\{([^}]+)\}/);
  assert.ok(rule);assert.match(rule[1],/white-space:nowrap/);assert.doesNotMatch(rule[1],/font-size|transform|overflow/);
  assert.match(css,/@media \(max-width:680px\)\{\.calendar-day\{padding-inline:0\}\}/);
  assert.match(app,/h\('span',\{class:'day-number'\},Number\(date\.slice\(-2\)\)\)/);
});
