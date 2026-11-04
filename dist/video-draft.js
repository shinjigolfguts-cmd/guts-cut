// Device-local recovery. Never uploads source videos or generated files.
const videoDraft = (() => {
 const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('inguts-video-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('jobs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 async function transact(mode,action){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('jobs',mode);let result;const r=action(tx.objectStore('jobs'));r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||Error('端末内に保持できません'));tx.onerror=()=>{};})}finally{db.close()}}
 return {read:()=>transact('readonly',s=>s.get('current')),write:job=>transact('readwrite',s=>s.put(job,'current')),clear:()=>transact('readwrite',s=>s.delete('current'))};
})();
