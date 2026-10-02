const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/appearance-boot.js'),'utf8');
function boot(saved,options={}){
 const document={body:null,documentElement:{dataset:{}}},window={};
 const context={document,window,navigator:{hardwareConcurrency:8,deviceMemory:8,connection:{saveData:false},...options.navigator},CSS:{supports:()=>options.blur!==false},matchMedia:()=>({matches:!!options.reduced}),localStorage:{getItem:()=>{if(options.storageError)throw Error('Denied');return saved;}}};
 vm.runInNewContext(source,context);return {root:document.documentElement.dataset,preference:window.WorkbenchAppearance,boot:window.WorkbenchBoot};
}
assert.deepEqual({...boot(null).root},{layout:'B',color:'dark',glass:'full'});
assert.equal(boot(null).boot.beforeBody,true);
const a=boot(JSON.stringify({layout:'A',color:'dark'}));assert.equal(a.root.layout,'A');assert.equal(a.root.color,'light');assert.equal(a.preference.color,'dark','A preserves B palette preference');
assert.equal(boot(JSON.stringify({layout:'B',color:'light',effects:'solid'})).root.glass,'solid');
assert.equal(boot(JSON.stringify({layout:'B',color:'light'})).root.color,'light');
for(const saved of ['{bad}',JSON.stringify({layout:'X',color:'light'}),JSON.stringify({layout:'B',color:'oops'})])assert.equal(boot(saved).root.color,'dark');
assert.equal(boot(null,{storageError:true}).root.layout,'B');
for(const options of [{navigator:{hardwareConcurrency:2}},{navigator:{deviceMemory:2}},{navigator:{connection:{saveData:true}}},{blur:false},{reduced:true}])assert.equal(boot(null,options).root.glass,'solid');
assert.equal(boot(JSON.stringify({layout:'B',color:'dark',effects:'full'}),{reduced:true}).root.glass,'solid');
assert(!source.includes('fetch('));assert(!source.includes('setItem('));
console.log('PASS: before-body saved appearance, B default, A palette preservation, invalid/blocked storage, reduced-motion, low-capability and unsupported-blur fallback');
