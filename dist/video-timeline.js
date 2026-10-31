// A fixed playhead with a scrolling, time-scaled video and overlay timeline.
const timelineScroll=$('#timelineScroll'),timelineContent=$('#timelineContent');
const pixelsPerSecond=42;
let timelineKey='',timelineDrag=null,filmstripGeneration=0,timelineProgrammatic=false;
const preciseTime=t=>fmt(Math.max(0,t))+'.'+Math.floor(Math.max(0,t)%1*10);
window.resetVideoTimeline=()=>{filmstripGeneration++;timelineKey='';$('#filmstrip').replaceChildren();$('#layerTracks').replaceChildren();$('#videoTimeline').hidden=true;timelineDrag=null};
window.syncVideoTimeline=()=>{
 const v=media[0];$('#videoTimeline').hidden=mode!=='video'||!v;
 if(mode!=='video'||!v||busy)return;
 const duration=v.el.duration||end;
 const key=JSON.stringify([selected,start,end,layers.map(l=>[l.kind,l.text,l.in,l.out,l.color])]);
 if(key!==timelineKey&&!timelineDrag){timelineKey=key;renderLayerTracks(duration)}
 $('#currentStamp').textContent=preciseTime(v.el.currentTime);$('#durationStamp').textContent=preciseTime(end);
 if(!timelineDrag){let target=v.el.currentTime*pixelsPerSecond;if(Math.abs(timelineScroll.scrollLeft-target)>1){timelineProgrammatic=true;timelineScroll.scrollLeft=target;requestAnimationFrame(()=>timelineProgrammatic=false)}}
};
function renderLayerTracks(duration){
 timelineContent.style.width=duration*pixelsPerSecond+'px';
 const root=$('#layerTracks');root.replaceChildren();
 layers.forEach((l,i)=>{
  const row=document.createElement('div');row.className='layer-track';
  const bar=document.createElement('div');bar.className='timed-layer'+(i===selected?' selected':'')+(l.kind==='text'?' text-layer':'');bar.dataset.layer=i;
  bar.style.left=(l.in??0)*pixelsPerSecond+'px';bar.style.width=Math.max(4,((l.out??duration)-(l.in??0))*pixelsPerSecond)+'px';
  const label=document.createElement('button');label.className='timed-label';label.textContent=l.kind==='text'?l.text:'図形';label.setAttribute('aria-label',(l.kind==='text'?'文字 '+l.text:'図形')+'の表示時間を選択');
  label.onclick=()=>selectTimedLayer(i);bar.append(label);
  for(const edge of ['in','out']){const h=document.createElement('button');h.className='time-handle '+edge;h.textContent=edge==='in'?'‹':'›';h.setAttribute('aria-label',(edge==='in'?'開始':'終了')+'位置をドラッグ');h.onpointerdown=e=>startTimeDrag(e,i,edge);bar.append(h)}
  label.onpointerdown=e=>startTimeDrag(e,i,'move');row.append(bar);root.append(row);
 });
 $('#layerControls').hidden=!layers[selected];
 if(layers[selected]){$('#layerIn').value=(layers[selected].in??start).toFixed(1);$('#layerOut').value=(layers[selected].out??end).toFixed(1)}
 $('#layerIn').max=duration;$('#layerOut').max=duration;
}
function selectTimedLayer(i){if(busy)return;selected=i;const l=layers[i],v=media[0].el;v.pause();$('#play').textContent='▶';if(!layerVisible(l))v.currentTime=Math.max(start,Math.min(end,(l.in??start)+.001));draw()}
function startTimeDrag(e,i,edge){if(busy)return;e.preventDefault();e.stopPropagation();selected=i;mark();let l=layers[i];timelineDrag={i,edge,x:e.clientX,a:l.in??0,b:l.out??end};e.currentTarget.setPointerCapture(e.pointerId);media[0].el.pause();$('#play').textContent='▶';e.currentTarget.onpointermove=moveTimeDrag;e.currentTarget.onpointerup=endTimeDrag;e.currentTarget.onpointercancel=endTimeDrag;}
function moveTimeDrag(e){if(!timelineDrag)return;let d=timelineDrag,l=layers[d.i],delta=(e.clientX-d.x)/pixelsPerSecond,duration=media[0].el.duration;let minDuration=Math.min(.1,duration);if(d.edge==='in'){l.in=Math.max(0,Math.min(d.b-minDuration,d.a+delta));l.out=d.b}else if(d.edge==='out'){l.in=d.a;l.out=Math.min(duration,Math.max(d.a+minDuration,d.b+delta))}else{let len=d.b-d.a;l.in=Math.max(0,Math.min(duration-len,d.a+delta));l.out=l.in+len}const bar=$('#layerTracks').children[d.i].firstChild;bar.style.left=l.in*pixelsPerSecond+'px';bar.style.width=(l.out-l.in)*pixelsPerSecond+'px';$('#layerIn').value=l.in.toFixed(1);$('#layerOut').value=l.out.toFixed(1);media[0].el.currentTime=d.edge==='out'?Math.max(l.in,l.out-.04):l.in;draw()}
function endTimeDrag(){timelineDrag=null;timelineKey='';draw()}
for(const id of ['layerIn','layerOut'])$('#'+id).onchange=()=>{if(busy||!layers[selected])return;let a=Number($('#layerIn').value),b=Number($('#layerOut').value),duration=media[0].el.duration;if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a||b>duration){toast('動画の範囲内で、開始より後の終了時刻を指定してください');timelineKey='';document.activeElement.blur();draw();return}mark();Object.assign(layers[selected],{in:a,out:b});media[0].el.currentTime=a;document.activeElement.blur();draw()};
$('#layerWhole').onclick=()=>{if(busy||!layers[selected])return;mark();Object.assign(layers[selected],{in:start,out:end});draw()};
$('#deleteTimedLayer').onclick=()=>{if(busy||!layers[selected])return;mark();layers.splice(selected,1);selected=-1;draw()};
$('#editTimedLayer').onclick=()=>{if(busy||!layers[selected])return;layers[selected].kind==='text'?textPanel():shapeStylePanel()};
// Pointer scrubbing avoids feedback between playback and scroll events.
timelineScroll.onpointerdown=e=>{if(e.target.closest('.timed-layer')||busy)return;media[0]?.el.pause();$('#play').textContent='▶';timelineDrag={edge:'scrub',x:e.clientX,scroll:timelineScroll.scrollLeft};timelineScroll.setPointerCapture(e.pointerId)};
timelineScroll.onpointermove=e=>{if(timelineDrag?.edge!=='scrub')return;const d=timelineDrag,v=media[0].el;let t=Math.max(start,Math.min(end,(d.scroll+d.x-e.clientX)/pixelsPerSecond));timelineScroll.scrollLeft=t*pixelsPerSecond;v.currentTime=t;draw()};
timelineScroll.onpointerup=timelineScroll.onpointercancel=()=>{if(timelineDrag?.edge==='scrub'){timelineDrag=null;draw()}};
timelineScroll.addEventListener('wheel',e=>{if(busy||!media[0])return;e.preventDefault();const v=media[0].el;v.pause();v.currentTime=Math.max(start,Math.min(end,v.currentTime+(e.deltaX||e.deltaY)/pixelsPerSecond));draw()},{passive:false});
async function buildVideoFilmstrip(){
 const generation=++filmstripGeneration,m=media[0];if(!m||m.type!=='video')return;
 const root=$('#filmstrip');root.replaceChildren();$('#timeRuler').replaceChildren();
 const duration=m.el.duration,totalWidth=duration*pixelsPerSecond,count=Math.max(1,Math.min(100,Math.ceil(totalWidth/44)));
 for(let i=0;i<=duration;i+=duration>120?10:5){let tick=document.createElement('span');tick.textContent=preciseTime(i);tick.style.left=i*pixelsPerSecond+'px';$('#timeRuler').append(tick)}
 const probe=document.createElement('video');probe.muted=true;probe.playsInline=true;probe.preload='auto';
 try{
  await new Promise((resolve,reject)=>{probe.onloadeddata=resolve;probe.onerror=reject;probe.src=m.url});
  for(let i=0;i<count;i++){
   if(generation!==filmstripGeneration)return;
   const t=Math.min(duration-.001,(i+.5)*duration/count);
   await new Promise((resolve,reject)=>{if(Math.abs(probe.currentTime-t)<.001)return resolve();const timer=setTimeout(()=>reject(Error('timeout')),4000);probe.onseeked=()=>{clearTimeout(timer);resolve()};probe.currentTime=t});
   if(generation!==filmstripGeneration)return;
   const frame=document.createElement('canvas');frame.width=88;frame.height=80;frame.style.width=totalWidth/count+'px';frame.style.height='40px';const c=frame.getContext('2d'),scale=Math.max(88/probe.videoWidth,80/probe.videoHeight);c.drawImage(probe,(88-probe.videoWidth*scale)/2,(80-probe.videoHeight*scale)/2,probe.videoWidth*scale,probe.videoHeight*scale);root.append(frame);
  }
 }catch{if(generation===filmstripGeneration&&!root.children.length)root.textContent='コマを表示できませんでした'}finally{probe.removeAttribute('src');probe.load()}
}
