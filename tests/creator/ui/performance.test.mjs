import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPerformanceRows,goalProgress} from '../../../src/creator/performance.mjs';

function fixture(){
  return {works:{work1:{id:'work1',title:'Current synthetic title'},work2:{id:'work2',title:'Other synthetic work'}},accounts:{a:{id:'a',displayName:'Synthetic account A',platform:'Synthetic'},b:{id:'b',displayName:'Synthetic account B',platform:'Other'}},publications:{p1:{id:'p1',workId:'work1',accountId:'a',status:'published',actualPublishedAt:'2026-10-04T23:30:00Z',finalSnapshot:{title:'Published synthetic title'}},p2:{id:'p2',workId:'work1',accountId:'b',status:'published',actualPublishedAt:'2026-10-04T10:00:00Z'},p3:{id:'p3',workId:'work2',accountId:'a',status:'planned'}},metrics:{}};
}
function metric(s,id,publicationId,metricKey,value,observedAt,definition='cumulative'){
  s.metrics[id]={id,publicationId,accountId:null,metricKey,value,observedAt,definition,unit:'count',sourceRef:'Synthetic manual observation'};
}
test('shared performance rows use the same latest snapshot, preserve zero/unknown, and never add cumulative history',()=>{
  const s=fixture();metric(s,'old','p1','views',100,'2026-10-05T00:00:00Z');metric(s,'current','p1','views',195,'2026-10-05T01:00:00Z');metric(s,'future','p1','views',900,'2099-01-01T00:00:00Z');metric(s,'zero','p1','shares',0,'2026-10-05T01:00:00Z');metric(s,'unknown','p1','comments',null,'2026-10-05T01:00:00Z');metric(s,'other','p2','views',41,'2026-10-05T01:00:00Z');
  const before=structuredClone(s),options={asOf:'2026-10-05T12:00:00Z',accountId:'a'};
  const [dashboard,library,database]=[0,1,2].map(()=>selectPerformanceRows(s,options)[0]);
  for(const row of [dashboard,library,database]){assert.equal(row.metrics.views.value,195);assert.equal(row.metrics.views.snapshotId,'current');assert.equal(row.title,'Published synthetic title');assert.equal(row.metrics.shares.value,0);assert.equal(row.metrics.comments.value,null);assert.equal(row.metrics.likes.kind,'unknown');}
  assert.deepEqual(s,before);assert.equal(selectPerformanceRows(s,{...options,accountId:'b'})[0].metrics.views.value,41);
});
test('different metric definitions stay explicitly mixed and publication/account/time filters remain independent',()=>{
  const s=fixture();metric(s,'cumulative','p1','views',195,'2026-10-05T01:00:00Z');metric(s,'daily','p1','views',20,'2026-10-05T01:00:00Z','daily');
  const o={asOf:'2026-10-05T12:00:00Z'};const rows=selectPerformanceRows(s,o);assert.equal(rows.length,2);assert.equal(rows[0].metrics.views.kind,'mixed');assert.equal(rows[0].metrics.views.value,null);assert.equal(rows[0].metrics.views.choices.length,2);
  assert.equal(selectPerformanceRows(s,{...o,platform:'Other'}).length,1);assert.equal(selectPerformanceRows(s,{...o,workIds:['work2']}).length,0);
  assert.equal(selectPerformanceRows(s,{...o,asOf:'2026-10-04T12:00:00Z'}).length,1);assert.equal(selectPerformanceRows(s,{...o,limit:0}).length,0);
  s.works.work1.trashedAt='2026-10-05T02:00:00Z';assert.equal(selectPerformanceRows(s,o).length,0);
});
test('publication-month filtering uses the requested timezone and rejects invalid boundaries',()=>{
  const s=fixture();s.publications.p1.actualPublishedAt='2026-09-30T23:30:00Z';const o={asOf:'2026-10-05T12:00:00Z',accountId:'a',month:'2026-10'};
  assert.equal(selectPerformanceRows(s,{...o,timeZone:'UTC'}).length,0);assert.equal(selectPerformanceRows(s,{...o,timeZone:'Asia/Shanghai'}).length,1);
  assert.throws(()=>selectPerformanceRows(s,{asOf:'invalid'}));assert.throws(()=>selectPerformanceRows(s,{...o,month:'2026-13'}));assert.throws(()=>selectPerformanceRows(s,{...o,timeZone:'Invalid/Zone'}));
});
test('goal rings distinguish unset and explicit zero targets and retain the true exceeded count',()=>{
  assert.deepEqual(goalProgress(9,10),{kind:'tracked',actual:9,target:10,ratio:.9,exceeded:false});
  assert.deepEqual(goalProgress(11,10),{kind:'tracked',actual:11,target:10,ratio:1,exceeded:true});
  assert.equal(goalProgress(0,null).kind,'unset');assert.equal(goalProgress(0,0).kind,'zero-target');assert.equal(goalProgress(null,10).kind,'unknown');assert.equal(goalProgress(0,10).ratio,0);
});
