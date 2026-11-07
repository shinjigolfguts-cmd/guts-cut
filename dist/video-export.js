async function exportEditedVideo() {
 const video = media[0].el, position = video.currentTime, selection = selected;
 busy = true; video.pause(); selected = -1;
 document.querySelectorAll('#editor button,#editor input,#editor select').forEach(element => element.disabled = true);
 const progress = value => { $('#save').textContent = value < 100 ? value + '%' : '保存準備中'; };
 const width = Math.ceil(video.videoWidth / 2) * 2;
 const height = Math.ceil(width * viewHeight / viewWidth / 2) * 2;
 try {
  let output;
  progress(0);
  try {
   output = await renderFastVideo([media[0].originalFile], progress, {from: start, to: end, speed, volume, width, height,
    paint: (sample, context, time) => {
     context.setTransform(width / viewWidth, 0, 0, height / viewHeight, 0, 0);
     draw(context, true, {sample, time});
    }});
  } catch {
   output = await recordEditedVideo(video, width, height, progress);
  }
  const ext = output.type.includes('mp4') ? 'mp4' : 'webm';
  // Offer the completed file immediately; recovery storage must not delay saving.
  lastExport = {blob: output, ext};
  void retainExport(output, ext).catch(() => {});
  if (!await offerVideoSplit(output)) await deliverVideoFile(output, ext);
 } catch (error) { toast(error.message || '保存できませんでした'); }
 finally {
  video.pause(); video.currentTime = position; selected = selection; busy = false;
  $('#save').textContent = '保存'; $('#play').textContent = '▶';
  document.querySelectorAll('#editor button,#editor input,#editor select').forEach(element => element.disabled = false);
  resize();
 }
}

// Compatibility path for browsers/codecs without offline encoding.
async function recordEditedVideo(video, width, height, progress) {
 if (!window.MediaRecorder || !canvas.captureStream) throw Error('このブラウザは動画の書き出しに対応していません');
 const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm']
  .find(type => MediaRecorder.isTypeSupported(type));
 if (!mime) throw Error('このブラウザで保存できる動画形式がありません');
 let stream, recorder, frame, timer, watchdog, finish, fail;
 const chunks = [];
 const done = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
 done.catch(() => {});
 const cancelFrame = () => { if (frame != null) video.cancelVideoFrameCallback ? video.cancelVideoFrameCallback(frame) : cancelAnimationFrame(frame); };
 try {
  if (!audioCtx) {
   audioCtx = new (window.AudioContext || window.webkitAudioContext)();
   audioSource = audioCtx.createMediaElementSource(video); audioDest = audioCtx.createMediaStreamDestination();
   audioSource.connect(audioDest); audioSource.connect(audioCtx.destination);
  }
  await audioCtx.resume(); await seekDecodedVideo(video, start);
  canvas.width = width; canvas.height = height; draw();
  stream = canvas.captureStream(0);
  if (!stream.getVideoTracks()[0]?.requestFrame) { stream.getTracks().forEach(track => track.stop()); stream = canvas.captureStream(60); }
  audioDest.stream.getAudioTracks().forEach(track => stream.addTrack(track.clone()));
  recorder = new MediaRecorder(stream, {mimeType: mime, videoBitsPerSecond: Math.max(12000000, width * height * 8)});
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onstop = finish; recorder.onerror = () => fail(Error('書き出しに失敗しました'));
  const paint = () => {
   if (!video.seeking && video.readyState >= 2) {
    draw();
    if (!video.paused) {
     if (recorder.state === 'inactive') recorder.start(1000);
     else if (recorder.state === 'paused') recorder.resume();
    }
    stream.getVideoTracks()[0]?.requestFrame?.();
   }
   frame = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(paint) : requestAnimationFrame(paint);
  };
  video.addEventListener('waiting', onWaiting);
  paint(); await video.play();
  toast('動画を書き出しています。この画面を開いたままお待ちください');
  timer = setInterval(() => {
   progress(Math.min(99, Math.floor(99 * (video.currentTime - start) / (end - start))));
   if (video.currentTime >= end || video.ended) {
    video.pause(); if (recorder.state !== 'inactive') recorder.stop(); else fail(Error('動画の映像を書き出せませんでした'));
   }
  }, 20);
  watchdog = setTimeout(() => fail(Error('保存が中断されました。画面を開いたまま再試行してください')), ((end - start) / speed + 30) * 1000);
  await done;
  if (!chunks.length || video.currentTime < end - .3) throw Error('動画の書き出しが中断されました');
  progress(100); return new Blob(chunks, {type: mime.split(';')[0]});
 } finally {
  clearInterval(timer); clearTimeout(watchdog); cancelFrame(); video.removeEventListener('waiting', onWaiting);
  video.pause(); if (recorder && recorder.state !== 'inactive') recorder.stop();
  stream?.getTracks().forEach(track => track.stop());
 }
 function onWaiting() { if (recorder?.state === 'recording') recorder.pause(); }
}
