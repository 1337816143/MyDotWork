#!/usr/bin/env node
'use strict';
/*
 * MyDotWork 1.8.2 research appendix acceptance proof.
 * Node >=22 (built-in fetch/WebSocket), system Chrome, installed CJK fonts only.
 * No npm dependencies. Serve only dist on an ephemeral loopback HTTP port.
 * Usage after copying into scripts/:
 *   node scripts/browser_research_appendix.cjs
 * Or before copying:
 *   node /path/to/browser_research_appendix.cjs --root /path/to/checkout
 * Optional: --out /path/to/output --chrome /path/to/google-chrome
 * Screenshots and browser-results.json default to output/research-review/.
 * Automated assertions are separate from the required independent pixel review.
 */
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { parseArgs } = require('node:util');
const { values } = parseArgs({ options: {
  root: { type: 'string' }, out: { type: 'string' }, chrome: { type: 'string' },
} });
const root = path.resolve(values.root || process.env.MYDOTWORK_ROOT || path.join(__dirname, '..'));
const dist = fs.realpathSync(path.join(root, 'dist'));
const out = path.resolve(values.out || path.join(root, 'output/research-review'));
const chrome = values.chrome || process.env.CHROME_PATH || 'google-chrome';
const prefix = '/research/2026-10-03/';
const readerPath = prefix + 'index.html';
const widths = [320, 390, 768, 1280];
const height = 844;
const pins = Object.freeze({
  'supplier-review-original.html': 'cf41c5bbeae9987c7c73d50c874aa29847d1ac0252e18a15ce3d375181554054',
  'supplier-review.json': '7dfa19cfb02a407f2acba4856c9356269f487fc3ace26d9e8b5c25b8fb061ec3',
  'task35-current-plan.txt': 'cf378ea4231a53b329e616da956eef7e4c9fda53e16869cfea0bc6887ca7b241',
  'evidence-gates.json': 'e826cbbc16f861a6ff9a4810943c89955ec7bab49652daa46412a0b3e9cc490c',
});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(out, { recursive: true });
const runDir = fs.mkdtempSync(path.join(out, 'run-'));
const downloadsDir = path.join(runDir, 'downloads');
fs.mkdirSync(downloadsDir);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mydotwork-research-chrome-'));
const result = {
  status: 'running', startedAt: new Date().toISOString(), root, dist,
  environment: { node: process.version, chrome, viewportHeight: height, deviceScaleFactor: 1,
    hideNativeScrollbars: true, note: 'Native scrollbar chrome is hidden; page scrollWidth and CSS clientWidth are still checked strictly.' },
  artifacts: [], fixtures: [], viewports: [], navigation: [], downloads: [], clicks: [],
  networkRequests: [], runtimeErrors: [], consoleErrors: [], blockedExternalRequests: [],
  humanPixelReview: 'required; not performed by this script',
};
let server, child, ws, origin, sessionId, sequence = 0, navigationSequence = 0;
let fatalBrowserError, currentStage = 'initializing';
const pending = new Map();
const eventHandlers = new Set();
const downloads = new Map();
const eventLog = [];
const save = () => {
  const json = JSON.stringify(result, null, 2) + '\n';
  fs.writeFileSync(path.join(out, 'browser-results.json'), json);
  fs.writeFileSync(path.join(runDir, 'browser-results.json'), json);
};

// Condition polling only. Never use fixed sleeps to guess browser readiness.
async function until(label, predicate, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    if (fatalBrowserError) throw fatalBrowserError;
    try { const value = await predicate(); if (value) return value; }
    catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error(label + ' timed out' + (lastError ? ': ' + lastError.message : ''));
}

function send(method, params = {}, targetSession = sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }));
  });
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function stableGeometry() {
  return evaluate(`(async()=>{
    await document.fonts.ready;
    const started = performance.now();
    let previous = '', stable = 0, frames = 0;
    return await new Promise((resolve,reject)=>{
      function frame(){
        frames++;
        const snapshot=JSON.stringify([innerWidth,innerHeight,scrollX,scrollY,
          document.documentElement.clientWidth,document.documentElement.scrollWidth,document.documentElement.scrollHeight,
          ...[...document.querySelectorAll('body > *, .panel, .scroll, .cost-table, [id^="S"], #downloads, .status-launcher, [data-workstream]')].map(n=>{
            const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height,n.scrollLeft,n.scrollWidth];
          })]);
        stable=snapshot===previous?stable+1:0;previous=snapshot;
        if(stable>=2)return resolve({frames,stableAnimationFrames:stable,fontStatus:document.fonts.status});
        if(performance.now()-started>8000)return reject(Error('Layout did not stabilize across two animation frames'));
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  })()`);
}

async function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.zip': 'application/zip' };
  server = http.createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (requested === '/favicon.ico') { res.writeHead(204).end(); return; }
      let filename = path.resolve(dist, '.' + requested);
      if (!(filename === dist || filename.startsWith(dist + path.sep))) { res.writeHead(403).end(); return; }
      if ((await fsp.stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      filename = await fsp.realpath(filename);
      if (!filename.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
      const body = await fsp.readFile(filename);
      res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream',
        'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = 'http://127.0.0.1:' + server.address().port;
}

async function startChrome() {
  const stderrFile = fs.openSync(path.join(out, 'chrome-stderr.log'), 'w');
  child = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--metrics-recording-only', '--disable-default-apps',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'],
  { windowsHide: true, stdio: ['ignore', 'ignore', stderrFile] });
  fs.closeSync(stderrFile);
  child.once('error', error => { fatalBrowserError = error; });
  child.once('exit', (code, signal) => { if (result.status === 'running') fatalBrowserError = new Error(`Chrome exited: ${code}/${signal}`); });
  const endpoint = await until('Chrome DevTools endpoint', async () => {
    const [port, endpointPath] = (await fsp.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n');
    return port && endpointPath && `ws://127.0.0.1:${port}${endpointPath}`;
  });
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const p = pending.get(message.id); pending.delete(message.id); clearTimeout(p.timer);
      message.error ? p.reject(new Error(JSON.stringify(message.error))) : p.resolve(message.result);
      return;
    }
    for (const handler of eventHandlers) handler(message);
  };
  eventHandlers.add(message => {
    const p = message.params || {};
    if (['Page.frameNavigated', 'Page.navigatedWithinDocument'].includes(message.method)) {
      // CDP Page.Frame.url excludes the fragment; urlFragment includes its leading '#'.
      const rawUrl = p.frame?.url || p.url;
      const urlFragment = p.frame?.urlFragment || '';
      eventLog.push({ method: message.method, url: rawUrl + urlFragment, rawUrl, urlFragment,
        frameId: p.frame?.id || p.frameId, sessionId: message.sessionId, stage: currentStage, at: Date.now() });
    }
    if (message.method === 'Browser.downloadWillBegin') downloads.set(p.guid, { ...p, state: 'inProgress' });
    if (message.method === 'Browser.downloadProgress') downloads.set(p.guid, { ...downloads.get(p.guid), ...p });
    if (message.method === 'Runtime.exceptionThrown') result.runtimeErrors.push({ stage: currentStage, ...p.exceptionDetails });
    if (message.method === 'Runtime.consoleAPICalled' && p.type === 'error') {
      result.consoleErrors.push({ stage: currentStage, text: p.args.map(a => a.value ?? a.description).join(' ') });
    }
    if (message.method === 'Network.requestWillBeSent') result.networkRequests.push({
      stage: currentStage, type: p.type, url: p.request.url, documentURL: p.documentURL,
    });
    if (message.method === 'Fetch.requestPaused') {
      const local = p.request.url.startsWith(origin + '/');
      if (!local) result.blockedExternalRequests.push({ stage: currentStage, url: p.request.url });
      send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', local ? { requestId: p.requestId } :
        { requestId: p.requestId, errorReason: 'BlockedByClient' }, message.sessionId)
        .catch(error => { fatalBrowserError = error; });
    }
  });
  result.environment.browser = await send('Browser.getVersion', {}, null);
  const targets = await send('Target.getTargets', {}, null);
  const target = targets.targetInfos.find(t => t.type === 'page');
  assert(target, 'Chrome must provide a page target');
  ({ sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null));
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadsDir, eventsEnabled: true }, null);
  await send('Page.bringToFront');
}

async function setViewport(width) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, screenWidth: width, screenHeight: height,
    deviceScaleFactor: 1, mobile: width < 1000 });
}

async function go(urlPath, readySelector = 'body') {
  const target = new URL(urlPath, origin);
  target.searchParams.set('research-qa', String(++navigationSequence));
  const response = await send('Page.navigate', { url: target.href });
  assert(!response.errorText, response.errorText || 'Page.navigate');
  await until('Navigation to ' + target.pathname, () => evaluate(`location.href===${JSON.stringify(target.href)} &&
    document.readyState==='complete' && !!document.querySelector(${JSON.stringify(readySelector)})`));
  await stableGeometry();
}

async function strictViewport(width, label) {
  const geometry = await evaluate(`(()=>({innerWidth,innerHeight,dpr:devicePixelRatio,
    visualWidth:visualViewport.width,clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,bodyClientWidth:document.body.clientWidth,
    bodyScrollWidth:document.body.scrollWidth,scrollX}))()`);
  assert.equal(geometry.innerWidth, width, label + ': actual CSS viewport');
  assert.equal(geometry.clientWidth, width, label + ': root clientWidth');
  assert.equal(geometry.scrollWidth, width, label + ': root overflow');
  assert(geometry.bodyScrollWidth <= geometry.bodyClientWidth, label + ': body overflow');
  assert.equal(geometry.innerHeight, height, label + ': viewport height');
  assert.equal(geometry.dpr, 1, label + ': DPR');
  assert.equal(geometry.visualWidth, width, label + ': visual viewport width');
  assert.equal(geometry.scrollX, 0, label + ': horizontal page displacement');
  return geometry;
}

async function shot(filename, selector) {
  if (selector) await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'})`);
  const stability = await stableGeometry();
  const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  const bytes = Buffer.from(capture.data, 'base64');
  assert.equal(bytes.readUInt32BE(16), 390, 'Screenshot must be actual 390px wide');
  assert.equal(bytes.readUInt32BE(20), height, 'Screenshot height');
  fs.writeFileSync(path.join(out, filename), bytes);
  fs.writeFileSync(path.join(runDir, filename), bytes);
  result.artifacts.push({ file: filename, sha256: sha(bytes), width: 390, height, stability,
    preservedFile: path.relative(out, path.join(runDir, filename)),
    position: await evaluate('({url:location.href,scrollY})') });
  save();
}

// Trusted browser input, not DOM .click() or href-only checks.
async function click(selector) {
  await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('Missing click target');n.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});})()`);
  await stableGeometry();
  const hitTest = await evaluate(`(()=>{
    const n=document.querySelector(${JSON.stringify(selector)}),style=getComputedStyle(n);
    const rects=[...n.getClientRects()].map((r,index)=>({index,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}));
    const visibleFragments=rects.map(r=>({...r,left:Math.max(0,r.left),top:Math.max(0,r.top),right:Math.min(innerWidth,r.right),bottom:Math.min(innerHeight,r.bottom)}))
      .filter(r=>r.width>0&&r.height>0&&r.right>r.left&&r.bottom>r.top);
    const tests=visibleFragments.map(r=>{
      const point={x:(r.left+r.right)/2,y:(r.top+r.bottom)/2},hit=document.elementFromPoint(point.x,point.y);
      return {fragmentIndex:r.index,point,matchesTarget:!!hit&&(hit===n||n.contains(hit)),
        hit:hit?{tag:hit.tagName,id:hit.id,className:hit.getAttribute('class'),href:hit.getAttribute('href')}:null};
    });
    const chosen=tests.find(test=>test.matchesTarget);
    const invisible=!visibleFragments.length||style.visibility==='hidden'||style.visibility==='collapse'||style.display==='none';
    return {url:location.href,rects,visibleFragments,tests,chosenPoint:invisible?null:chosen?.point,
      chosenFragment:invisible?null:chosen?.fragmentIndex,
      error:invisible?'Invisible target':chosen?null:'Click target is obscured'};
  })()`);
  result.clicks.push({ stage: currentStage, selector, ...hitTest }); save();
  assert(!hitTest.error, hitTest.error || 'Click fragment must be visible and unobscured');
  assert(hitTest.chosenPoint, 'A hit-tested visible fragment is required for trusted input');
  const point = hitTest.chosenPoint;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}

async function clickNavigation(selector, expectedPath, expectedHash = '', readySelector = 'body') {
  const eventsBefore = eventLog.length;
  await click(selector);
  await until('Real link navigation to ' + expectedPath + expectedHash, () => evaluate(`
    location.origin===${JSON.stringify(origin)} && location.pathname===${JSON.stringify(expectedPath)} &&
    location.hash===${JSON.stringify(expectedHash)} && document.readyState==='complete' &&
    !!document.querySelector(${JSON.stringify(readySelector)})`));
  await stableGeometry();
  const observed = eventLog.slice(eventsBefore).filter(e => {
    const u = new URL(e.url); return u.pathname === expectedPath && u.hash === expectedHash;
  });
  assert(observed.length, 'CDP must record actual navigation after browser click');
  return { selector, url: await evaluate('location.href'), events: observed };
}

function checkFixtures() {
  const buildScript = fs.readFileSync(path.join(root, 'scripts/build_publications.py'), 'utf8');
  for (const [name, expected] of Object.entries(pins)) {
    assert(buildScript.includes(`('research/2026-10-03/${name}', '${expected}')`), name + ': canonical build pin changed');
    const bytes = fs.readFileSync(path.join(dist, prefix, name));
    assert.equal(sha(bytes), expected, name + ': built bytes must match reviewed raw SHA');
    result.fixtures.push({ filename: name, bytes: bytes.length, sha256: expected });
  }
  const files = fs.readdirSync(path.join(dist, prefix)).sort();
  assert.deepEqual(files, ['index.html', ...Object.keys(pins)].sort(), 'Appendix directory must contain only the approved five text files');
  result.readerSha256 = sha(fs.readFileSync(path.join(dist, readerPath)));
}

async function readerChecks(width, evidence, supplier, plan) {
  const geometry = await strictViewport(width, 'reader');
  const content = await evaluate(`(()=>{
    const need=(test,message)=>{if(!test)throw Error(message)};
    const e=${JSON.stringify(evidence)}, s=${JSON.stringify(supplier)};
    const times=[...document.querySelectorAll('#current-gates .date-grid time')].map(n=>n.dateTime);
    need(JSON.stringify(times)===JSON.stringify([e.editorial_review_at_utc,e.records[0].source_observations_as_of_utc,e.records[1].license.official_page_checked_at_utc]),'Current review and historical observation dates must remain distinct');
    need(document.querySelector('.history-note').textContent.includes('13:20 UTC'),'Historical report time missing');
    need(document.querySelector('#current-gates .caption').textContent.includes('10月2日历史日期'),'Historical ChatShare date explanation missing');
    const rows=[...document.querySelectorAll('.cost-table tbody tr')].map(row=>[...row.children].map(n=>n.textContent.trim()));
    need(rows.length===5,'Five cost rows required');
    rows.forEach((row,i)=>{const raw=e.records[0].suppliers[i];
      need(raw.invoice_extra_cny===null&&raw.all_in_cny===null,'Unknown fees must be null in structured source');
      need(row[0]===raw.name&&row[3]==='未知'&&row[4]==='未知','Unknown fees must be rendered as 未知, never zero');
      need(row[1]===raw.display_cny.toFixed(2)+'元','Display price mismatch');
      need(row[2]===(raw.payment_preview_cny===null?'未知':raw.payment_preview_cny.toFixed(2)+'元'),'Preview price mismatch');
      need(row[5]===raw.price_evidence_date,'Price evidence date mismatch');
    });
    need(document.querySelector('#current-gates').textContent.includes('实际净利润未知'),'Unknown profit must be visible');
    need(document.querySelector('#plan-original-text').textContent===${JSON.stringify(plan)},'Complete plan text must be byte-decoded original');
    const sources=s.sources.map(src=>{const n=document.getElementById(src.id),a=n?.querySelector('a');
      need(!!n&&!!a,'Missing source '+src.id);need(a.href===src.url,'Changed source URL '+src.id);
      need(n.textContent.includes(src.observed_at_utc),'Source observation time was rewritten '+src.id);
      const box=n.getBoundingClientRect(),style=getComputedStyle(n),range=document.createRange();range.selectNodeContents(a);
      const rects=[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,width:r.width}));
      need(n.scrollWidth<=n.clientWidth,'Source paragraph overflow '+src.id);
      need(rects.every(r=>r.left>=box.left-1&&r.right<=box.right+1),'Source URL leaves its paragraph '+src.id);
      need(['anywhere','break-word'].includes(getComputedStyle(a).overflowWrap),'Long URLs are not allowed to wrap '+src.id);
      return {id:src.id,url:a.href,lines:new Set(rects.map(r=>r.top)).size,rects};
    });
    need(sources.length===19,'All S01–S19 source records required');
    if(innerWidth<=390)need(sources.find(x=>x.id==='S15').lines>1,'Long S15 URL must actually wrap on mobile');
    const forbidden=[...document.querySelectorAll('script,img,picture,video,audio,source,track,iframe,object,embed,canvas,link[rel="stylesheet"],link[rel="preload"],link[rel="modulepreload"],meta[property="og:image"],meta[property="og:video"],meta[name="twitter:image"]')].map(n=>n.outerHTML.slice(0,180));
    need(forbidden.length===0,'Reader must not include media/runtime assets');
    const resources=performance.getEntriesByType('resource').filter(r=>!r.name.endsWith('/favicon.ico')).map(r=>({name:r.name,type:r.initiatorType}));
    need(resources.length===0,'Reader loaded an unexpected subresource');
    const downloads=[...document.querySelectorAll('#downloads a[download]')].map(a=>a.getAttribute('href'));
    need(JSON.stringify(downloads)===JSON.stringify(${JSON.stringify(Object.keys(pins))}),'Exact four download links required');
    const unexpectedMediaLinks=[...document.querySelectorAll('a[href]')].filter(a=>/\\.(?:mp4|webm|mp3|wav|m4a|png|jpe?g|gif|avif|webp|zip)(?:[?#]|$)/i.test(a.href)).map(a=>a.href);
    need(unexpectedMediaLinks.length===0,'Reader exposes an unexpected media/runtime download');
    return {times,costRows:rows,sources,resources,forbidden,downloads};
  })()`);
  return { width, geometry, ...content };
}

async function checkTables(width) {
  const count = await evaluate('document.querySelectorAll(".scroll").length');
  assert(count >= 2, 'Current and original report table wrappers must exist');
  const tables = [];
  for (let index = 0; index < count; index++) {
    const selector = '.scroll';
    await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].scrollIntoView({block:'start',behavior:'instant'})`);
    await stableGeometry();
    const before = await evaluate(`(()=>{const n=document.querySelectorAll('.scroll')[${index}],r=n.getBoundingClientRect();return {
      left:n.scrollLeft,clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,overflowX:getComputedStyle(n).overflowX,
      x:Math.min(innerWidth-2,Math.max(2,r.x+r.width/2)),y:Math.min(innerHeight-2,Math.max(2,r.y+45)),
      label:n.getAttribute('aria-label'),tabIndex:n.tabIndex};})()`);
    assert(['auto', 'scroll'].includes(before.overflowX), 'Tables need internal horizontal scrolling');
    if (index === 0) { assert(before.label, 'Cost table needs an accessible label'); assert.equal(before.tabIndex, 0, 'Cost table must be keyboard reachable'); }
    const maximum = before.scrollWidth - before.clientWidth;
    let after = before;
    if (maximum > 0) {
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: before.x, y: before.y, deltaX: maximum + 100, deltaY: 0 });
      await until('Horizontal table scrolling reaches last column', () => evaluate(`(()=>{const n=document.querySelectorAll('.scroll')[${index}];return n.scrollLeft>=n.scrollWidth-n.clientWidth-1;})()`));
      await stableGeometry();
      after = await evaluate(`(()=>{const n=document.querySelectorAll('.scroll')[${index}],r=n.getBoundingClientRect(),last=n.querySelector('tr').lastElementChild.getBoundingClientRect();return {left:n.scrollLeft,clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,lastCellRight:last.right,containerRight:r.right};})()`);
      assert(after.lastCellRight <= after.containerRight + 1, 'Rightmost table column must be reachable');
      if (width === 390 && index === 0) await shot('research-390-current-cost-table-right.png');
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: before.x, y: before.y, deltaX: -maximum - 100, deltaY: 0 });
      await until('Table scroll returns to first column', () => evaluate(`document.querySelectorAll('.scroll')[${index}].scrollLeft===0`));
    }
    await strictViewport(width, 'reader after table scrolling');
    tables.push({ index, before, after, scrollNeeded: maximum > 0, input: maximum > 0 ? 'CDP trusted horizontal mouse wheel' : 'table fits' });
  }
  return tables;
}

async function workbenchNavigation(width) {
  for (const task of [{ id: 'task-3', number: 3, hash: '#supplier-original' }, { id: 'task-5', number: 5, hash: '#h3-plan' }]) {
    for (const route of ['primary', 'quick-launcher']) {
      currentStage = `workbench-${width}-${task.id}-${route}`;
      await go('/dashboard/index.html#workbench', '#workbench .status-card');
      await strictViewport(width, 'workbench');
      let clicks = 0, selector;
      if (route === 'primary') selector = `#workbench [data-workstream="${task.id}"] .status-links a.primary`;
      else {
        await click('#workbench .status-launcher summary'); clicks++;
        await until('Quick launcher expands', () => evaluate(`document.querySelector('#workbench .status-launcher').open`));
        selector = `#workbench .status-launcher a:nth-child(${task.number})`;
      }
      const navigation = await clickNavigation(selector, readerPath, task.hash, task.hash); clicks++;
      assert(clicks <= 2, 'Primary outcome must be reachable within two clicks');
      await strictViewport(width, 'reader reached from workbench');
      const target = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(task.hash)}).getBoundingClientRect();return {top:r.top,bottom:r.bottom};})()`);
      assert(target.top >= 0 && target.top < height, 'Target section heading must be in the viewport');
      result.navigation.push({ width, task: task.id, route, clicks, target, ...navigation }); save();
    }
  }
  currentStage = `reader-links-${width}`;
  for (const old of [
    { href: '../round3-7/report.html', path: '/research/round3-7/report.html' },
    { href: '../ai-side-income/report.html', path: '/research/ai-side-income/report.html' },
  ]) {
    await go(readerPath, '#downloads');
    const nav = await clickNavigation(`#downloads a[href="${old.href}"]`, old.path);
    assert((await evaluate('document.body.innerText.trim().length')) > 100, 'Old report must actually render text');
    result.navigation.push({ width, route: 'old-report', ...nav });
  }
  for (const selector of ['.masthead a', '#downloads a[href="../../dashboard/index.html"]']) {
    await go(readerPath, '#downloads');
    const nav = await clickNavigation(selector, '/dashboard/index.html', '', '#workbench .status-card');
    await strictViewport(width, 'workbench reached from return link');
    result.navigation.push({ width, route: 'return-to-workbench', ...nav });
  }
  save();
}

async function checkDownloads() {
  currentStage = 'reader-browser-downloads-390';
  await setViewport(390); await go(readerPath, '#downloads');
  for (const [filename, expected] of Object.entries(pins)) {
    const prior = new Set(downloads.keys());
    await click(`#downloads a[download][href="${filename}"]`);
    const download = await until('Browser download completes: ' + filename, () => {
      const d = [...downloads.values()].find(x => !prior.has(x.guid) && x.url === origin + prefix + filename);
      if (d?.state === 'canceled') throw new Error('Browser download canceled: ' + filename);
      return d?.state === 'completed' ? d : false;
    }, 30000);
    assert.equal(download.suggestedFilename, filename, 'Original filename retained by actual browser download');
    const destination = path.join(downloadsDir, filename);
    await until('Downloaded bytes available: ' + filename, () => fs.existsSync(destination));
    const actual = fs.readFileSync(destination), source = fs.readFileSync(path.join(dist, prefix, filename));
    assert.deepEqual(actual, source, filename + ': browser download must be exactly the built bytes');
    assert.equal(sha(actual), expected, filename + ': browser download must match fixed raw SHA');
    assert.equal(download.receivedBytes, actual.length, filename + ': CDP byte count');
    assert.equal(await evaluate('location.pathname'), readerPath, 'download attribute must keep reader open');
    result.downloads.push({ filename, bytes: actual.length, sha256: sha(actual), state: download.state,
      guid: download.guid, downloadedFile: path.relative(out, destination), triggeredBy: 'trusted browser mouse click',
      browserReceivedBytes: download.receivedBytes, browserTotalBytes: download.totalBytes }); save();
  }
  assert.equal(result.downloads.length, 4, 'All four originals must be downloaded');
  assert(!fs.readdirSync(downloadsDir).some(name => name.endsWith('.crdownload')), 'No partial downloads may remain');
}

(async () => {
  try {
    checkFixtures();
    const evidence = JSON.parse(fs.readFileSync(path.join(dist, prefix, 'evidence-gates.json')));
    const supplier = JSON.parse(fs.readFileSync(path.join(dist, prefix, 'supplier-review.json')));
    const plan = fs.readFileSync(path.join(dist, prefix, 'task35-current-plan.txt'), 'utf8');
    await startServer(); await startChrome();
    for (const width of widths) {
      currentStage = `reader-${width}`;
      await setViewport(width); await go(readerPath, '#current-gates');
      const review = await readerChecks(width, evidence, supplier, plan);
      if (width === 390) {
        await evaluate('window.scrollTo(0,0)'); await shot('research-390-first-fold.png');
        await shot('research-390-current-cost-table.png', '.cost-table');
        await shot('research-390-original-report-long-url.png', '#S15');
        await shot('research-390-bottom-downloads.png', '#downloads');
      }
      review.tables = await checkTables(width);
      result.viewports.push(review); save();
      await workbenchNavigation(width);
    }
    await checkDownloads();
    const readerRequests = result.networkRequests.filter(r => r.stage.startsWith('reader-') &&
      r.documentURL?.includes(readerPath) && !r.url.endsWith('/favicon.ico'));
    const forbiddenReaderRequests = readerRequests.filter(r =>
      !['Document', 'Other'].includes(r.type) || (!r.url.startsWith(origin + readerPath) &&
      !Object.keys(pins).some(name => r.url === origin + prefix + name)));
    assert.deepEqual(forbiddenReaderRequests, [], 'Reader must not request media, runtime, or external assets');
    assert.deepEqual(result.blockedExternalRequests, [], 'QA must not initiate external network requests');
    assert.deepEqual(result.runtimeErrors, [], 'No runtime exceptions');
    assert.deepEqual(result.consoleErrors, [], 'No browser console errors');
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.failure = { stage: currentStage, message: error.message, stack: error.stack,
      navigationEvents: eventLog.filter(event => event.stage === currentStage) };
    process.exitCode = 1;
    // Preserve the first failing viewport without changing widths, CSS, or assertions.
    // Every run has a separate archive, so a later run cannot erase its first pixels.
    if (ws?.readyState === 1 && sessionId) {
      try {
        const stability = await stableGeometry();
        const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
        const bytes = Buffer.from(capture.data, 'base64');
        const filename = path.basename(runDir) + '-first-failure-' + currentStage.replace(/[^a-zA-Z0-9_-]/g, '-') + '.png';
        fs.writeFileSync(path.join(runDir, filename), bytes, { flag: 'wx' });
        fs.writeFileSync(path.join(out, filename), bytes, { flag: 'wx' });
        const rootCopy = fs.readFileSync(path.join(out, filename));
        const preservedCopy = fs.readFileSync(path.join(runDir, filename));
        assert.deepEqual(rootCopy, bytes, 'Root failure PNG must be readable and byte-exact immediately after write');
        assert.deepEqual(preservedCopy, bytes, 'Preserved failure PNG must be readable and byte-exact immediately after write');
        assert.equal(sha(rootCopy), sha(bytes), 'Root failure PNG hash');
        assert.equal(sha(preservedCopy), sha(bytes), 'Preserved failure PNG hash');
        result.failure.screenshot = { file: filename, preservedFile: path.relative(out, path.join(runDir, filename)),
          width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: sha(bytes), stability,
          writeVerification: { rootReadable: true, preservedReadable: true, bytes: bytes.length,
            rootSha256: sha(rootCopy), preservedSha256: sha(preservedCopy) },
          location: await evaluate('({url:location.href,scrollY,innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth})') };
      } catch (captureError) { result.failure.screenshotError = captureError.message; }
    }
  } finally {
    result.finishedAt = new Date().toISOString(); save();
    if (ws?.readyState === 1) {
      try { await send('Browser.close', {}, null); } catch (_) { /* Browser can close before acknowledgement. */ }
      ws.close();
    }
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('QA finished')); } pending.clear();
    if (child && child.exitCode === null) child.kill('SIGTERM');
    if (server) await new Promise(resolve => server.close(resolve));
    try { await fsp.rm(profile, { recursive: true, force: true }); } catch (_) { /* Private temp profile only. */ }
    process.stdout.write(JSON.stringify({ status: result.status, result: path.join(out, 'browser-results.json'),
      screenshots: result.artifacts.length, viewportChecks: result.viewports.length,
      navigationChecks: result.navigation.length, verifiedDownloads: result.downloads.length,
      humanPixelReview: result.humanPixelReview, failure: result.failure?.message }, null, 2) + '\n');
  }
})();
