// Device-local recovery. Read only small metadata at startup; load videos on request.
const videoDraft = (() => {
 function open(){return new Promise((resolve,reject)=>{
  const r=indexedDB.open('inguts-video-recovery',2);let settled=false;
  const timer=setTimeout(()=>{settled=true;reject(Error('端末内の保存が応答しません'))},15000);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('jobs'))r.result.createObjectStore('jobs');if(!r.result.objectStoreNames.contains('clips'))r.result.createObjectStore('clips')};
  r.onsuccess=()=>{clearTimeout(timer);if(settled){r.result.close();return}resolve(r.result)};
  r.onerror=()=>{clearTimeout(timer);reject(r.error)};
 })}
 async function transact(store,mode,action,signal){
  if(signal?.aborted)throw new DOMException('中止しました','AbortError');
  const db=await open();
  try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction(store,mode);let result,timedOut=false;
   const abort=()=>{try{tx.abort()}catch{}};
   const timer=setTimeout(()=>{timedOut=true;abort()},30000);
   const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort)};
   signal?.addEventListener('abort',abort,{once:true});
   tx.oncomplete=()=>{cleanup();resolve(result)};
   tx.onabort=()=>{cleanup();reject(signal?.aborted?new DOMException('中止しました','AbortError'):Error(timedOut?'端末内の保存が停止しました':'端末内に動画を保持できません'))};
   tx.onerror=()=>{};
   if(signal?.aborted){abort();return}
   const request=action(tx.objectStore(store));request.onsuccess=()=>result=request.result;
  })}finally{db.close()}
 }
 const readJob=()=>transact('jobs','readonly',s=>s.get('current'));
 async function clearClipsExcept(keys){const keep=new Set(keys);return transact('clips','readwrite',store=>{const r=store.openCursor();r.onsuccess=()=>{};r.addEventListener('success',()=>{const c=r.result;if(c){if(!keep.has(c.key))c.delete();c.continue()}});return r})}
 let writing = Promise.resolve(), activeWrite;
 async function writeJob(job,{signal,onProgress=()=>{}}={}){
   const keys=[];const id=Date.now()+'-'+Math.random().toString(36).slice(2);
   try{
    for(const [i,file] of (job.files||[]).entries()){const key=id+':'+i;keys.push(key);await transact('clips','readwrite',s=>s.put(file,key),signal);onProgress(i+1,job.files.length)}
    const record={...job,files:[],keys};
    await transact('jobs','readwrite',s=>{s.put({blob:!!job.blob,count:job.count||keys.length},'summary');return s.put(record,'current')},signal);
    try{await clearClipsExcept(keys)}catch{}
   }catch(error){for(const key of keys)try{await transact('clips','readwrite',s=>s.delete(key))}catch{};throw error}
 }
 return {
  async peek(){const meta=await transact('jobs','readonly',s=>s.get('summary'));if(meta)return meta;const key=await transact('jobs','readonly',s=>s.getKey('current'));return key?{blob:false}:null},
  async read(){const job=await readJob();if(!job?.keys)return job;const files=[];for(const key of job.keys){const file=await transact('clips','readonly',s=>s.get(key));if(!file)throw Error('復元データが不足しています。動画を選び直してください。');files.push(file)}return {...job,files}},
  write(job,{signal,onProgress=()=>{}}={}){
   // Latest job wins; a background input backup cannot overwrite completed output.
   activeWrite?.abort();
   const controller=new AbortController();activeWrite=controller;
   const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   const operation=writing.catch(()=>{}).then(()=>writeJob(job,{signal:controller.signal,onProgress}));
   writing=operation;
   return operation.finally(()=>{signal?.removeEventListener('abort',abort);if(activeWrite===controller)activeWrite=null});
  },
  async clear(){await transact('jobs','readwrite',s=>s.clear());await transact('clips','readwrite',s=>s.clear())}
 };
})();
