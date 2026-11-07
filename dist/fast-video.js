// Offline, timestamp-driven export. No playback clock or intermediate recording.
import * as M from './vendor/mediabunny-1.65.2.mjs';

const unsupported = () => { throw Error('高速書き出しを利用できない形式です'); };
const check = signal => { if (signal?.aborted) throw new DOMException('キャンセルしました', 'AbortError'); };
const even = value => Math.max(2, Math.ceil(value / 2) * 2);
function createOutput() {
 const parts = [];
 // Keep encoded bytes in Blob chunks. Allow the muxer to patch its size headers
 // without allocating a second contiguous copy of a long mobile video.
 const target = new M.StreamTarget(new WritableStream({write: ({data, position}) => {
  const end = position + data.byteLength, patch = {start: position, end, blob: new Blob([data])};
  if (!parts.length || position >= parts.at(-1).end) { parts.push(patch); return; }
  const next = [];
  for (const part of parts) {
   if (part.end <= position || part.start >= end) next.push(part);
   else {
    if (part.start < position) next.push({start: part.start, end: position, blob: part.blob.slice(0, position - part.start)});
    if (part.end > end) next.push({start: end, end: part.end, blob: part.blob.slice(end - part.start)});
   }
  }
  next.push(patch); next.sort((a, b) => a.start - b.start); parts.splice(0, parts.length, ...next);
 }}), {chunked: true, chunkSize: 1024 * 1024});
 // An ordinary MP4 edit handles encoder priming/B-frame delay at time zero.
 const output = new M.Output({format: new M.Mp4OutputFormat({fastStart: false}), target});
 return {output, blob: () => {
  let end = 0; const data = [];
  for (const part of parts) { if (part.start !== end) throw Error('動画データが不完全です'); data.push(part.blob); end = part.end; }
  return new Blob(data, {type: 'video/mp4'});
 }};
}
function scaleAudio(sample, gain, channels = sample.numberOfChannels) {
 const data = new Float32Array(sample.numberOfFrames * channels);
 for (let channel = 0; channel < channels; channel++) {
  const plane = data.subarray(channel * sample.numberOfFrames, (channel + 1) * sample.numberOfFrames);
  sample.copyTo(plane, {planeIndex: Math.min(channel, sample.numberOfChannels - 1), format: 'f32-planar'});
  if (gain !== 1) for (let i = 0; i < plane.length; i++) plane[i] *= gain;
 }
 return new M.AudioSample({data, format: 'f32-planar', numberOfChannels: channels,
  sampleRate: sample.sampleRate, timestamp: sample.timestamp});
}
async function openClip(file, options) {
 const input = new M.Input({source: new M.BlobSource(file), formats: M.ALL_FORMATS});
 try {
  const video = await input.getPrimaryVideoTrack(), audio = await input.getPrimaryAudioTrack();
  if (!video) unsupported();
  // Exclude an empty container edit before the first actual video frame.
  const from = Math.max(options.from || 0, 0, await video.getFirstTimestamp());
  const to = Math.min(options.to ?? Infinity, await video.computeDuration());
  if (!(to > from)) unsupported();
  return {input, video, audio, from, to, duration: to - from};
 } catch (error) { input.dispose(); throw error; }
}

async function convertClip(clip, report, options) {
 const {output, blob} = createOutput();
 let conversion;
 const abort = () => { void conversion?.cancel().catch(() => {}); };
 try {
  const width = even(options.width || await clip.video.getDisplayWidth());
  const height = even(options.height || await clip.video.getDisplayHeight());
  const drawing = options.paint ? document.createElement('canvas') : null;
  if (drawing) { drawing.width = width; drawing.height = height; }
  let frames = 0;
  conversion = await M.Conversion.init({input: clip.input, output, tracks: 'primary',
   trim: {start: clip.from, end: clip.to}, copy: {boundaryTolerance: 0}, showWarnings: false,
   video: {codec: 'avc', forceTranscode: true, quality: M.QUALITY_HIGH,
    ...(drawing ? {processedWidth: width, processedHeight: height, process: async sample => {
     check(options.signal);
     options.paint(sample, drawing.getContext('2d'), clip.from + sample.timestamp);
     if (++frames % 12 === 0) await new Promise(resolve => setTimeout(resolve, 0));
     return drawing;
    }} : {width, height, fit: 'contain'})},
   audio: options.volume != null && options.volume !== 1 ? {
    codec: 'aac', process: sample => scaleAudio(sample, options.volume)
   } : undefined});
  // Never silently produce a silent file when an audio codec is unavailable.
  if (!conversion.isValid || conversion.discardedTracks.length) unsupported();
  options.signal?.addEventListener('abort', abort, {once: true}); check(options.signal);
  conversion.onProgress = progress => report(Math.min(99, Math.floor(progress * 99)));
  await conversion.execute(); check(options.signal);
  report(100); return blob();
 } finally {
  options.signal?.removeEventListener('abort', abort);
  if (output.state !== 'finalized') await output.cancel().catch(() => {});
 }
}

async function concatenateClips(clips, report, options) {
 const width = even(await clips[0].video.getDisplayWidth()), height = even(await clips[0].video.getDisplayHeight());
 const hasAudio = clips.some(clip => clip.audio);
 const sampleRate = hasAudio ? await clips.find(clip => clip.audio).audio.getSampleRate() : 48000;
 if (!await M.canEncodeVideo('avc', {width, height}) ||
  (hasAudio && !await M.canEncodeAudio('aac', {numberOfChannels: 2, sampleRate}))) unsupported();
 for (const clip of clips) {
  if (!await clip.video.canDecode() || (clip.audio && !await clip.audio.canDecode())) unsupported();
  if (clip.audio && (await clip.audio.getSampleRate() !== sampleRate || await clip.audio.getNumberOfChannels() > 2)) unsupported();
 }
 const {output, blob} = createOutput();
 const videoSource = new M.VideoSampleSource({codec: 'avc', quality: M.QUALITY_HIGH, keyFrameInterval: 2});
 const audioSource = hasAudio ? new M.AudioSampleSource({codec: 'aac', bitrate: 192000}) : null;
 output.addVideoTrack(videoSource); if (audioSource) output.addAudioTrack(audioSource);
 const drawing = document.createElement('canvas'); drawing.width = width; drawing.height = height;
 const paint = drawing.getContext('2d');
 const total = clips.reduce((sum, clip) => sum + clip.duration, 0);
 let offset = 0, frames = 0;
 const abort = () => { void output.cancel().catch(() => {}); for (const clip of clips) clip.input.dispose(); };
 async function silence(from, to) {
  while (to - from > 1 / sampleRate) {
   check(options.signal);
   const count = Math.min(Math.round(sampleRate / 10), Math.round((to - from) * sampleRate));
   const sample = new M.AudioSample({data: new Float32Array(count * 2), format: 'f32-planar',
    numberOfChannels: 2, sampleRate, timestamp: from});
   try { await audioSource.add(sample); } finally { sample.close(); }
   from += count / sampleRate;
  }
 }
 async function pumpAudio(clip, base) {
  if (!audioSource) return;
  let cursor = base;
  if (clip.audio) for await (const sample of new M.AudioSampleSink(clip.audio).samples(clip.from, clip.to)) {
   let trimmed, normalized;
   try {
    check(options.signal);
    const a = Math.max(0, Math.round((clip.from - sample.timestamp) * sample.sampleRate));
    const b = Math.min(sample.numberOfFrames, Math.round((clip.to - sample.timestamp) * sample.sampleRate));
    if (b <= a) continue;
    trimmed = sample.trim(a, b);
    trimmed.setTimestamp(base + trimmed.timestamp - clip.from);
    await silence(cursor, trimmed.timestamp);
    normalized = scaleAudio(trimmed, 1, 2);
    await audioSource.add(normalized); cursor = trimmed.timestamp + trimmed.duration;
   } finally { normalized?.close(); trimmed?.close(); sample.close(); }
  }
  await silence(cursor, base + clip.duration);
 }
 async function pumpVideo(clip, base) {
  let first = true;
  for await (const sample of new M.VideoSampleSink(clip.video).samples(clip.from, clip.to)) {
   let rendered;
   try {
    check(options.signal);
    const from = Math.max(clip.from, sample.timestamp), to = Math.min(clip.to, sample.timestamp + sample.duration);
    if (to <= from) continue;
    paint.fillStyle = '#000'; paint.fillRect(0, 0, width, height);
    sample.drawWithFit(paint, {fit: 'contain'});
    rendered = new M.VideoSample(drawing, {timestamp: base + from - clip.from, duration: to - from});
    // A new independently decoded clip always starts with a fresh output keyframe.
    await videoSource.add(rendered, {keyFrame: first}); first = false;
    report(Math.min(99, Math.floor(99 * (base + to - clip.from) / total)));
    if (++frames % 12 === 0) await new Promise(resolve => setTimeout(resolve, 0));
   } finally { rendered?.close(); sample.close(); }
  }
  if (first) unsupported();
 }
 try {
  options.signal?.addEventListener('abort', abort, {once: true}); check(options.signal);
  await output.start();
  for (const clip of clips) {
   const tasks = [pumpVideo(clip, offset), pumpAudio(clip, offset)];
   try { await Promise.all(tasks); }
   catch (error) { await output.cancel().catch(() => {}); clip.input.dispose(); await Promise.allSettled(tasks); throw error; }
   offset += clip.duration; clip.input.dispose();
  }
  videoSource.close(); audioSource?.close(); await output.finalize(); check(options.signal);
  report(100); return blob();
 } finally {
  options.signal?.removeEventListener('abort', abort);
  if (output.state !== 'finalized') await output.cancel().catch(() => {});
 }
}

export async function renderVideos(files, report = () => {}, options = {}) {
 check(options.signal);
 if (!globalThis.VideoEncoder || !globalThis.VideoDecoder || (options.speed ?? 1) !== 1) unsupported();
 const clips = [];
 try {
  for (const file of files) { check(options.signal); clips.push(await openClip(file, options)); }
  if (!clips.length) unsupported();
  return clips.length === 1 ? await convertClip(clips[0], report, options) : await concatenateClips(clips, report, options);
 } finally { for (const clip of clips) clip.input.dispose(); }
}
