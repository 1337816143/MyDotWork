/* Minimal deterministic IndexedDB transaction-contract double.
 * This is NOT a browser emulator and cannot prove actual browser durability. */
const copy=v=>v===undefined?undefined:structuredClone(v);
export function createTestIndexedDB() {
  const databases=new Map(); let nextCommitFailure=null;
  const api={
    failNextCommit(error){nextCommitFailure=error;},
    mutate(name,key,fn){const db=databases.get(name);db.stores.get('workspaces').set(key,fn(copy(db.stores.get('workspaces').get(key))));},
    open(name,version){
      const request={};
      setTimeout(()=>{
        let data=databases.get(name);const fresh=!data;
        if(!data){data={version,stores:new Map(),keyPaths:new Map(),queue:[],active:false};databases.set(name,data);}
        const db={
          objectStoreNames:{contains:store=>data.stores.has(store)},
          createObjectStore(store,options={}){data.stores.set(store,new Map());data.keyPaths.set(store,options.keyPath);},
          close(){},
          transaction(storeNames,mode){
            const names=Array.isArray(storeNames)?storeNames:[storeNames];let aborted=false,finished=false,started=false,scheduled=false;
            const operations=[],transaction={error:null};let local;
            const abort=error=>{if(finished)return;transaction.error=error||new Error('aborted');aborted=true;};
            const queue=fn=>{const req={};operations.push({fn,req});schedule();return req;};
            function schedule(){if(started&&!scheduled&&!finished){scheduled=true;setTimeout(pump,0);}}
            function finish(){finished=true;data.active=false;const next=data.queue.shift();if(next)next();}
            function pump(){
              scheduled=false;
              if(aborted){transaction.onabort?.({target:transaction});finish();return;}
              const operation=operations.shift();
              if(operation){
                try{operation.req.result=operation.fn();operation.req.onsuccess?.({target:operation.req});}
                catch(error){operation.req.error=error;operation.req.onerror?.({target:operation.req});abort(error);}
                schedule();return;
              }
              if(mode==='readwrite'&&nextCommitFailure){const error=nextCommitFailure;nextCommitFailure=null;abort(error);schedule();return;}
              if(mode==='readwrite')for(const name of names)data.stores.set(name,local.get(name));
              transaction.oncomplete?.({target:transaction});finish();
            }
            transaction.abort=()=>{abort();schedule();};
            transaction.objectStore=store=>{
              if(!names.includes(store))throw new Error('Store outside transaction');
              return {
                get(key){return queue(()=>copy(local.get(store).get(key)));},
                getAll(){return queue(()=>[...local.get(store).values()].map(copy));},
                put(value,key){return queue(()=>{if(mode!=='readwrite')throw new Error('readonly');const actual=key??value[data.keyPaths.get(store)];local.get(store).set(actual,copy(value));return actual;});}
              };
            };
            const start=()=>{data.active=true;started=true;local=new Map(names.map(store=>[store,new Map([...data.stores.get(store)].map(([k,v])=>[k,copy(v)]))]));schedule();};
            if(data.active)data.queue.push(start);else start();return transaction;
          }
        };
        request.result=db;if(fresh)request.onupgradeneeded?.({target:request});request.onsuccess?.({target:request});
      },0);
      return request;
    }
  };return api;
}
