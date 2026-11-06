// Join compatible unfragmented camera clips by rewriting indexes, leaving media bytes in Blob slices.
async function joinVideos(files, onReady = () => {}) {
 const fail=()=>{throw Error('これらの動画の形式・向き・音声設定では無劣化結合できません。同じ撮影設定の動画を選んでください。')};
 const view=a=>new DataView(a.buffer,a.byteOffset,a.byteLength), u=(a,i)=>view(a).getUint32(i);
 const word=n=>{if(!Number.isSafeInteger(n)||n<0||n>0xffffffff)fail();let a=new Uint8Array(4);view(a).setUint32(0,n);return a};
 const cat=parts=>{let a=new Uint8Array(parts.reduce((n,p)=>n+p.length,0)),i=0;for(const p of parts){a.set(p,i);i+=p.length}return a};
 const enc=new TextEncoder(),dec=new TextDecoder(), box=(k,p)=>cat([word(p.length+8),enc.encode(k),p]);
 const children=a=>{let out=[];for(let i=0;i<a.length;){let n=u(a,i);if(n<8||i+n>a.length)fail();out.push({k:dec.decode(a.slice(i+4,i+8)),p:a.subarray(i+8,i+n)});i+=n}return out};
 const packs=[];let offset=0,first,header,mediaParts=[];
 for(const file of files){let moov;const media=[];for(let i=0;i<file.size;){let h=new Uint8Array(await file.slice(i,i+16).arrayBuffer()),n=u(h,0)||file.size-i,k=dec.decode(h.slice(4,8));if(n===1)n=Number(view(h).getBigUint64(8));if(n<8||i+n>file.size)fail();
 if(k==='ftyp'&&!first){first=file.slice(i,i+n);offset=first.size}
 if(k==='moov'){if(n>64e6)fail();moov=children(new Uint8Array(await file.slice(i+8,i+n).arrayBuffer()))}
 if(k==='mdat'){
  if(!first)fail();
  const headerBytes=u(h,0)===1?16:8;
  if(n<headerBytes)fail();
  media.push({start:i+headerBytes,end:i+n,delta:offset-i});
  if(u(h,0)===0){mediaParts.push(word(n),file.slice(i+4,i+n))}
  else mediaParts.push(file.slice(i,i+n));
  offset+=n
 }i+=n}
 if(!moov||!media.length||moov.some(x=>x.k==='mvex'))fail();packs.push({moov,media});onReady(packs.length)}
 const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
 const gcd=(a,b)=>b?gcd(b,a%b):a;
 function trackClock(tracks){
  const headers=tracks.map(track=>children(track.find(x=>x.k==='mdia').p).find(x=>x.k==='mdhd').p);
  if(headers.some(md=>md[0]||!u(md,12)))fail();
  const scale=headers.reduce((a,md)=>{const b=u(md,12),v=a/gcd(a,b)*b;if(v>0xffffffff)fail();return v},1);
  const factors=headers.map(md=>scale/u(md,12));
  return {scale,factors,ticks:headers.map((md,i)=>u(md,16)*factors[i])}
 }
 function merge(groups,kind,ctx={}){
 let result=[],index=0;
 for(const {k,p} of groups[0]){let nth=groups[0].slice(0,index++).filter(x=>x.k===k).length;
 if(['udta','free','meta','tref'].includes(k))continue;
 const ps=groups.map(g=>g.filter(x=>x.k===k)[nth]?.p);if(ps.some(x=>!x))fail();let data=p;
 if(['trak','mdia','minf','stbl','edts'].includes(k)){
 let child=ps.map(children);
 if(k==='trak')ctx=trackClock(child);
 if(k==='stbl'){const allowed=['stsd','stts','ctts','stsc','stsz','stco','co64','stss','sdtp','sgpd','sbgp'];if(child.some(g=>g.some(x=>!allowed.includes(x.k))||g.length!==child[0].length))fail();
 const descriptions=child.map(g=>children(g.find(x=>x.k==='stsd').p.subarray(8)));
 const firstEntry=descriptions[0][0];if(!firstEntry)fail();
 ctx.entries=[];ctx.descriptionIds=descriptions.map(entries=>entries.map(entry=>{
 if(entry.k!==firstEntry.k)fail();
 const visual=['avc1','avc3','hvc1','hev1'].includes(entry.k),audio=entry.k==='mp4a';
 if(!same(entry.p,firstEntry.p)&&(!(visual||audio)||!same(entry.p.subarray(0,28),firstEntry.p.subarray(0,28))))fail();
 let index=ctx.entries.findIndex(x=>same(x.p,entry.p));if(index<0){index=ctx.entries.length;ctx.entries.push(entry)}return index+1
 }));
 ctx.samples=child.map(g=>u(g.find(x=>x.k==='stsz').p,8));ctx.chunks=child.map(g=>u(g.find(x=>['stco','co64'].includes(x.k)).p,4))}
 data=merge(child,k,ctx)
 }else if(['mvhd','tkhd','mdhd'].includes(k)){if(ps.some(a=>a[0]))fail();let pos=k==='tkhd'?20:16;if(k==='mvhd'&&ps.some(a=>u(a,12)!==u(p,12)))fail();if(k==='tkhd'&&ps.some(a=>!same(a.subarray(36),p.subarray(36))))fail();data=p.slice();if(k==='mdhd')data.set(word(ctx.scale),12);data.set(word(k==='mdhd'?ctx.ticks.reduce((a,b)=>a+b,0):ps.reduce((n,a)=>n+u(a,pos),0)),pos)
 }else if(k==='elst'){
 const movieScale=u(packs[0].moov.find(x=>x.k==='mvhd').p,12);
 const start=p.length===20?view(p).getInt32(12)*ctx.factors[0]:-1;
 // A single continuous edit avoids seeking back to keyframes at each clip boundary.
 const contiguous=ctx.factors.some(f=>f!==1)&&start>=0&&ps.every((a,i)=>a.length===20&&!a[0]&&u(a,4)===1&&u(a,16)===65536&&
  view(a).getInt32(12)*ctx.factors[i]===start&&u(a,8)===Math.round(ctx.ticks[i]*movieScale/ctx.scale));
 if(contiguous){if(start>2147483647)fail();data=p.slice();data.set(word(ps.reduce((sum,a)=>sum+u(a,8),0)),8);data.set(word(start),12)}
 else {let base=0;let entries=ps.map((a,i)=>{if(a[0])fail();let e=a.slice(8);for(let j=0;j<e.length;j+=12){let t=view(e).getInt32(j+4);if(t>=0){t*=ctx.factors[i];if(base+t>2147483647)fail();view(e).setInt32(j+4,t+base)}}base+=ctx.ticks[i];return e});data=cat([p.slice(0,4),word(entries.reduce((n,e)=>n+e.length/12,0)),...entries])}
 }else if(k==='stsd'){data=cat([p.slice(0,4),word(ctx.entries.length),...ctx.entries.map(x=>box(x.k,x.p))])
 }else if(k==='stsz'){let entries=ps.map(a=>u(a,4)?cat(Array.from({length:u(a,8)},()=>word(u(a,4)))):a.subarray(12));data=cat([p.slice(0,4),word(0),word(ctx.samples.reduce((a,b)=>a+b)),...entries])
 }else if(['stts','ctts','stsc','stss','stco','co64'].includes(k)){let base=0;let entries=ps.map((a,i)=>{if(a[0]!==p[0])fail();let e=a.slice(8);if(k==='stsc'||k==='stss'){for(let j=0;j<e.length;j+=k==='stsc'?12:4){e.set(word(u(e,j)+base),j);if(k==='stsc')e.set(word(ctx.descriptionIds[i][u(e,j+8)-1]),j+8)}base+=(k==='stsc'?ctx.chunks:ctx.samples)[i]}
 if((k==='stts'||k==='ctts')&&ctx.factors[i]!==1){
  for(let j=4;j<e.length;j+=8){
   if(k==='ctts'&&a[0]===1){const v=view(e).getInt32(j)*ctx.factors[i];if(v< -2147483648||v>2147483647)fail();view(e).setInt32(j,v)}
   else e.set(word(u(e,j)*ctx.factors[i]),j)
  }
 }
 if(k==='stco'||k==='co64'){let offsets=[];for(let j=0;j<e.length;j+=k==='stco'?4:8){let v=k==='stco'?u(e,j):Number(view(e).getBigUint64(j)),m=packs[i].media.find(range=>v>=range.start&&v<range.end);if(!m)fail();let a=new Uint8Array(8);view(a).setBigUint64(0,BigInt(v+m.delta));offsets.push(a)}return cat(offsets)}return e});data=cat([p.slice(0,4),word(ps.reduce((n,a)=>n+u(a,4),0)),...entries])
 }else if(k==='sbgp'){const n=p[0]===1?12:8;if(ps.some(a=>!same(a.slice(0,n),p.slice(0,n))))fail();data=cat([p.slice(0,n),word(ps.reduce((sum,a)=>sum+u(a,n),0)),...ps.map(a=>a.subarray(n+4))])}else if(k==='sdtp')data=cat([p.slice(0,4),...ps.map(a=>a.subarray(4))]);
 else if(['sgpd','stsd','dinf'].includes(k)&&ps.some(a=>!same(a,p)))fail();
 result.push(box(k==='stco'?'co64':k,data))}
 return cat(result)}
 function trackType(track){
  const md=children(track.p).find(x=>x.k==='mdia');
  const handler=children(md.p).find(x=>x.k==='hdlr');
  return dec.decode(handler.p.subarray(8,12))
 }
 const gs=packs.map(({moov})=>{
  const tracks=moov.filter(x=>x.k==='trak').map(track=>({track,type:trackType(track)}))
   .filter(({type})=>type==='vide'||type==='soun');
  // Track IDs and physical order are local to each input. Match by media kind.
  tracks.sort((a,b)=>a.type===b.type?0:a.type==='vide'?-1:1);
  return [...moov.filter(x=>x.k!=='trak'),...tracks.map(x=>x.track)]
 });
 const layout=g=>g.filter(x=>x.k==='trak').map(trackType).join(',');
 if(!layout(gs[0]).includes('vide')||gs.some(g=>layout(g)!==layout(gs[0])))fail();
 header=box('moov',merge(gs,'moov'));return new Blob([first,...mediaParts,header],{type:'video/mp4'})
}
