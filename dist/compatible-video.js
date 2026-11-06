let preparedRenderElement;
function prepareRenderPlayback(){
 const video=document.createElement('video');
 video.playsInline=true;
 // Issue play on the same element during the tap that opens the picker.
 video.src='data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YcgAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
 preparedRenderElement=video;
 video.play().catch(()=>{});
}
// Render clips sequentially when their encoded tracks cannot share one container.
async function renderCompatibleVideo(files, report, preparedAudio, options = {}) {
 const mime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(t=>window.MediaRecorder?.isTypeSupported(t));
 if(!mime)throw Error('このブラウザでは変換できません。Safariで開いてください。');
 const ctx=preparedAudio||new AudioContext(),audio=ctx.createMediaStreamDestination(),video=preparedRenderElement||document.createElement('video');
 preparedRenderElement=null;video.pause();
 video.playsInline=true;video.muted=false;video.autoplay=false;video.preload='auto';
 video.style.cssText='position:fixed;left:0;bottom:0;width: min(70vw,360px);height:auto;opacity:.01;pointer-events:none';document.body.append(video);
 const output=document.createElement('canvas'),paint=output.getContext('2d'),chunks=[];
 let lastPercent=-1,source;
 const signal=options.signal;const abort=()=>{throw new DOMException('キャンセルしました','AbortError')};
 const check=()=>{if(signal?.aborted)abort()};
 const onAbort=()=>failed(new DOMException('キャンセルしました','AbortError'));
 let watchdog;
 const wait=p=>Promise.race([p,failure]);
 const cancelFrame=()=>video.requestVideoFrameCallback?video.cancelVideoFrameCallback(frame):cancelAnimationFrame(frame);
 let url,stream,rec,frame,stop,failed;
 const failure=new Promise((_,reject)=>failed=reject);failure.catch(()=>{});
 try{
 signal?.addEventListener('abort',onAbort,{once:true});check();
 await wait(ctx.resume());source=ctx.createMediaElementSource(video);source.connect(audio);
 for(const [i,file] of files.entries()){
 check();clearTimeout(watchdog);watchdog=setTimeout(()=>failed(Error('動画の読み込みが停止しました。もう一度お試しください。')),30000);
 if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);
 await Promise.race([failure,new Promise((resolve,reject)=>{video.oncanplay=resolve;video.onerror=()=>reject(Error((i+1)+'本目を再生できません。'));video.src=url;video.load()})]);
 clearTimeout(watchdog);
 const from=options.from||0,to=Math.min(options.to??video.duration,video.duration);
 if(from>=to)throw Error('分割範囲が正しくありません');
 if(from)await wait(new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('分割位置に移動できません')),10000);video.onseeked=()=>{clearTimeout(timer);resolve()};video.currentTime=from}));
 // Warm the new decoder while the recorder is paused, then rewind so the
 // exported clip starts at the requested position with its original sound.
 if(i && to-from>0.6){
  const target=Math.min(from+0.4,to);
  const originalTime=from;
  let warmTimer;
  try{
   const warm=new Promise((resolve,reject)=>{
    warmTimer=setTimeout(()=>reject(Error('動画を準備できませんでした。')),8000);
    video.ontimeupdate=()=>{if(video.currentTime>=target)resolve()};
    video.onended=resolve;
    video.play().catch(reject);
   });
   await wait(warm);
  }finally{clearTimeout(warmTimer);video.pause();video.ontimeupdate=null;video.onended=null}
  await wait(new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('動画の先頭に戻れませんでした。')),8000);
   video.onseeked=()=>{clearTimeout(timer);video.onseeked=null;resolve()};
   video.currentTime=originalTime;
  }));
 }
 if(!i){output.width=video.videoWidth;output.height=video.videoHeight}
 const scale=Math.min(output.width/video.videoWidth,output.height/video.videoHeight),w=video.videoWidth*scale,h=video.videoHeight*scale;
 function paintFrame(){
  if(w<output.width||h<output.height){paint.fillStyle='#000';paint.fillRect(0,0,output.width,output.height)}
  paint.drawImage(video,(output.width-w)/2,(output.height-h)/2,w,h);
 }
 // Seed the canvas with a decoded frame before captureStream can sample it.
 paintFrame();
 if(!i){stream=output.captureStream();stream.addTrack(audio.stream.getAudioTracks()[0]);rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Math.max(12000000,output.width*output.height*8)});rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onerror=()=>failed(Error('動画の書き出しが中断されました。'));stop=new Promise(resolve=>rec.onstop=resolve)}
 function draw(){paintFrame();const percent=Math.floor(98*(i+((video.currentTime-from)/(to-from)||0))/files.length);if(percent!==lastPercent){report(percent);lastPercent=percent}frame=video.requestVideoFrameCallback?video.requestVideoFrameCallback(draw):requestAnimationFrame(draw)}
 // Exclude decoder startup and inter-clip buffering from the recording clock.
 video.onplaying=()=>{
  if(rec.state==='inactive')rec.start(1000);
  else if(rec.state==='paused')rec.resume();
 };
 video.onwaiting=()=>{if(rec.state==='recording')rec.pause()};
 draw();
 await wait(new Promise((resolve,reject)=>{let last=video.currentTime,stalled=0;const finish=()=>{clearInterval(watchdog);video.pause();resolve()};watchdog=setInterval(()=>{if(video.currentTime>=to||video.ended)return finish();if(video.currentTime===last)stalled++;else stalled=0;last=video.currentTime;if(stalled>300){clearInterval(watchdog);reject(Error('動画の再生が停止しました。画面を開いたまま再試行してください。'))}},100);video.ontimeupdate=()=>{if(video.currentTime>=to)finish()};video.onended=finish;video.onerror=()=>reject(Error((i+1)+'本目の再生に失敗しました。'));video.play().catch(reject)}));cancelFrame();video.onplaying=null;video.onwaiting=null;if(i+1<files.length&&rec.state==='recording')rec.pause()
 }
 rec.stop();watchdog=setTimeout(()=>failed(Error('動画の書き出しを完了できませんでした。選択した動画は残っています。')),15000);await Promise.race([stop,failure]);if(!chunks.length)throw Error('動画を書き出せませんでした。');return new Blob(chunks,{type:mime.split(';')[0]})
 }finally{clearTimeout(watchdog);clearInterval(watchdog);signal?.removeEventListener('abort',onAbort);if(frame!=null)cancelFrame();if(rec&&rec.state!=='inactive')rec.stop();video.pause();video.removeAttribute('src');video.load();video.remove();if(url)URL.revokeObjectURL(url);stream?.getTracks().forEach(t=>t.stop());source?.disconnect();audio.disconnect();if(!preparedAudio)await ctx.close()}
}
