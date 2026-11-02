// Render clips sequentially when their encoded tracks cannot share one container.
async function renderCompatibleVideo(files, report) {
 const mime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(t=>window.MediaRecorder?.isTypeSupported(t));
 if(!mime)throw Error('このブラウザでは変換できません。Safariで開いてください。');
 const ctx=new AudioContext(),audio=ctx.createMediaStreamDestination(),video=document.createElement('video');
 video.playsInline=true;video.preload='auto';
 const output=document.createElement('canvas'),paint=output.getContext('2d'),chunks=[];
 let url,stream,rec,frame,stop,failed;
 const failure=new Promise((_,reject)=>failed=reject);failure.catch(()=>{});
 try{
 await ctx.resume();ctx.createMediaElementSource(video).connect(audio);
 for(const [i,file] of files.entries()){
 if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);
 await Promise.race([failure,new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(Error((i+1)+'本目を再生できません。'));video.src=url})]);
 if(!i){output.width=video.videoWidth;output.height=video.videoHeight;stream=output.captureStream(30);stream.addTrack(audio.stream.getAudioTracks()[0]);rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Math.max(12000000,output.width*output.height*8)});rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onerror=()=>failed(Error('動画の書き出しが中断されました。'));stop=new Promise(resolve=>rec.onstop=resolve)}
 const scale=Math.min(output.width/video.videoWidth,output.height/video.videoHeight),w=video.videoWidth*scale,h=video.videoHeight*scale;
 function draw(){paint.fillStyle='#000';paint.fillRect(0,0,output.width,output.height);paint.drawImage(video,(output.width-w)/2,(output.height-h)/2,w,h);report(Math.floor(98*(i+(video.currentTime/video.duration||0))/files.length));frame=requestAnimationFrame(draw)}
 draw();if(!i)rec.start(1000);else rec.resume();
 await Promise.race([failure,new Promise((resolve,reject)=>{video.onended=resolve;video.onerror=()=>reject(Error((i+1)+'本目の再生に失敗しました。'));video.play().catch(reject)})]);cancelAnimationFrame(frame);if(i+1<files.length)rec.pause()
 }
 rec.stop();await Promise.race([stop,failure]);if(!chunks.length)throw Error('動画を書き出せませんでした。');return new Blob(chunks,{type:mime.split(';')[0]})
 }finally{cancelAnimationFrame(frame);if(rec&&rec.state!=='inactive')rec.stop();video.pause();video.removeAttribute('src');video.load();if(url)URL.revokeObjectURL(url);stream?.getTracks().forEach(t=>t.stop());await ctx.close()}
}
