// Run with Node 22+ and ffmpeg/ffprobe installed: node tests/video-regression.mjs
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'inguts-video-'));
const run = (command, args) => execFileSync(command, args, {encoding: 'utf8'});
try {
 for (const [name, frequency, preset] of [['a',440,'fast'],['b',880,'fast'],['different',440,'ultrafast']]) {
  run('ffmpeg', ['-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=30','-f','lavfi','-i',
   `sine=frequency=${frequency}:sample_rate=48000`,'-t','2','-c:v','libx264','-preset',preset,
   '-g','30','-pix_fmt','yuv420p','-c:a','aac',path.join(scratch,name+'.mp4')]);
 }
 const context = vm.createContext({Blob,DataView,Uint8Array,TextEncoder,TextDecoder,DOMException,setTimeout,clearTimeout});
 vm.runInContext(await fs.readFile(new URL('dist/video-join.js',root),'utf8'),context);
 vm.runInContext(await fs.readFile(new URL('dist/compatible-video.js',root),'utf8'),context);
 const load = async name => new Blob([await fs.readFile(path.join(scratch,name+'.mp4'))]);
 const a = await load('a'), b = await load('b'), different = await load('different');
 const output = await context.joinVideos([a,b]);
 const outputPath = path.join(scratch,'joined.mp4');
 await fs.writeFile(outputPath,new Uint8Array(await output.arrayBuffer()));
 const hashFrames = file => run('ffmpeg',['-v','error','-i',file,'-map','0:v','-f','framemd5','-'])
  .split('\n').filter(line=>line && !line.startsWith('#')).map(line=>line.split(',').at(-1).trim());
 assert.deepEqual(hashFrames(outputPath),[...hashFrames(path.join(scratch,'a.mp4')),...hashFrames(path.join(scratch,'b.mp4'))]);
 const frames = JSON.parse(run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','frame=best_effort_timestamp_time','-of','json',outputPath])).frames;
 assert.equal(frames.length,120); assert.equal(Number(frames[0].best_effort_timestamp_time),0);
 for (let i=1;i<frames.length;i++) assert(Math.abs(Number(frames[i].best_effort_timestamp_time)-Number(frames[i-1].best_effort_timestamp_time)-1/30)<.00001);
 run('ffmpeg',['-v','error','-i',outputPath,'-f','null','-']);
 await assert.rejects(()=>context.joinVideos([a,different]));
 console.log('PASS: exact frame hashes, zero start, continuous join timestamps, changed decoder settings rejected');
 class Video extends EventTarget {readyState=1; seeking=false; currentTime=0;}
 const video = new Video(); let resolved=false;
 const waiting = context.seekDecodedVideo(video,0).then(()=>{resolved=true;});
 await new Promise(resolve=>setTimeout(resolve,5)); assert.equal(resolved,false);
 video.readyState=2; video.dispatchEvent(new Event('loadeddata')); await waiting;
 const signal = AbortSignal.abort(); await assert.rejects(context.seekDecodedVideo(video,0,signal),{name:'AbortError'});
 console.log('PASS: metadata cannot start a recording before the first decoded frame; cancellation handled');
} finally {await fs.rm(scratch,{recursive:true,force:true});}
