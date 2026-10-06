import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {readFile} from './frozen-reader.mjs';
import {createGraphSession} from '../../../src/creator/graph/model.mjs';
import {builder,rich} from './fixtures.mjs';

test('graph modules expose no persistence, command, import, URL-following or network mechanism',async()=>{
 for(const file of ['web.mjs','snapshot.mjs','project.mjs','model.mjs','view.mjs']){
  const src=await readFile(new URL(`../../../src/creator/graph/${file}`,import.meta.url),'utf8');
  assert.doesNotMatch(src,/\b(?:localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|EventSource)\b|\.dispatch\s*\(|\.action\s*\(|\.execute\s*\(|\bapplyCommand\s*\(|\bimport\s*\(/);
  assert.doesNotMatch(src,/innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(|new Function/);
  assert.doesNotMatch(src,/createElement\(['"](?:canvas|iframe|img|video|audio)['"]\)/);
 }
});

test('root and nested accessors do not execute during loading, and native validation rejects corrupt graph records',async()=>{
 const b=builder(),session=createGraphSession();let getters=0;
 const hostile={...b.state};Object.defineProperty(hostile,'id',{get(){getters++;throw new Error('Should not run')},enumerable:true});
 await session.load(hostile);assert.equal(getters,0);assert.ok(session.status.error);assert.equal(session.status.graph,null);
 const f=rich(),nested=structuredClone(f.b.state);Object.defineProperty(nested.works[f.workId],'title',{get(){getters++;return 'not allowed'},enumerable:true});
 await session.load(nested);assert.equal(getters,0);assert.equal(session.status.graph,null);
 await session.load(f.b.state);const accepted=session.status.graph;
 const malformed=structuredClone(f.b.state);malformed.metrics.unbound={id:'unbound',schemaVersion:999,revision:0,visibility:'public',value:1};await session.load(malformed);assert.ok(session.status.error);assert.equal(session.status.graph,accepted);
});

test('projection and session work with poisoned browser IO globals and leave input byte-exact',async()=>{
 const f=rich(),before=JSON.stringify(f.b.state),names=['localStorage','sessionStorage','indexedDB','fetch','XMLHttpRequest','WebSocket','EventSource'],restore=new Map();let calls=0;
 for(const name of names){restore.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,get(){calls++;throw new Error(`IO ${name}`)}})}
 try{const session=createGraphSession();await session.load(f.b.state);assert.equal(session.status.error,null);assert.equal(calls,0);assert.equal(JSON.stringify(f.b.state),before)}
 finally{for(const [name,d]of restore){if(d)Object.defineProperty(globalThis,name,d);else delete globalThis[name]}}
});

test('CSS has mobile reflow, literal wrapping and reduced-motion safeguards; original visual resource is untouched',async()=>{
 const css=await readFile(new URL('../../../src/creator/styles.css',import.meta.url),'utf8');assert.match(css,/\.graph-fulltext\{[^}]*white-space:pre-wrap[^}]*overflow-wrap:anywhere/);assert.match(css,/@media\(max-width:680px\)\{\.graph-node-list\{grid-template-columns:minmax\(0,1fr\)/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.graph-view \*\{animation:none!important;transition:none!important/);
 assert.deepEqual(await readFile(new URL('../../../src/creator/studio-orb.mjs',import.meta.url)),await readFile(new URL('./frozen/baseline-creator/studio-orb.mjs',import.meta.url)));
});

test('CSP, HTML entry, synthetic boot, and independent method note boundary stay explicit',async()=>{
 const app=await readFile(new URL('../../../src/creator/app.mjs',import.meta.url),'utf8');assert.match(app,/approvedPrivateOrigin:false/);assert.match(app,/controller\.subscribe\(queueRender\)/);
 const html=await readFile(new URL('../../../src/creator/index.html',import.meta.url),'utf8');assert.match(html,/connect-src 'none'/);assert.deepEqual(await readFile(new URL('../../../src/creator/index.html',import.meta.url)),await readFile(new URL('./frozen/baseline-creator/index.html',import.meta.url)));
 const view=await readFile(new URL('../../../src/creator/graph/view.mjs',import.meta.url),'utf8');assert.match(view,/方法笔记：未接入/);assert.match(view,/不生成替代节点/);
});
