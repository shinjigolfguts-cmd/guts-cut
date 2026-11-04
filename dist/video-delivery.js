// Keep originals intact. Each part is prepared and saved separately to bound memory use.
function videoPartRanges(duration){
 if(!Number.isFinite(duration)||duration<=0)throw Error('動画の長さを取得できません');
 if(duration<=300)return [];
 const count=Math.ceil(duration/298),size=duration/count;
 return Array.from({length:count},(_,i)=>({from:i*size,to:Math.min(duration,(i+1)*size)}));
}
async function videoDuration(blob){
 const v=document.createElement('video'),url=URL.createObjectURL(blob);v.preload='metadata';v.playsInline=true;
 try{return await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('動画の長さを確認できませんでした')),15000);v.onloadedmetadata=()=>{clearTimeout(t);Number.isFinite(v.duration)?resolve(v.duration):reject(Error('動画の長さを確認できませんでした'))};v.onerror=()=>{clearTimeout(t);reject(Error('動画を読み込めませんでした'))};v.src=url})}
 finally{v.removeAttribute('src');v.load();URL.revokeObjectURL(url)}
}
async function offerVideoSplit(blob,knownDuration){
 const ranges=videoPartRanges(knownDuration??await videoDuration(blob));if(!ranges.length)return false;
 return new Promise(resolve=>{
 const sheet=document.createElement('dialog');sheet.className='clip-readiness';
 sheet.innerHTML='<h2></h2><p aria-live="polite"></p><progress max="100" value="0" hidden></progress><button>分割して保存</button><button>1本のまま保存</button><button>キャンセル</button>';
 const [yes,no,cancel]=sheet.querySelectorAll('button'),h=sheet.querySelector('h2'),status=sheet.querySelector('p'),progress=sheet.querySelector('progress');
 h.textContent='5分を超えています。'+ranges.length+'つに分けますか？';
 status.textContent='各動画を5分以内に分け、1本ずつ保存できます。元の動画は変更しません。分割時は再圧縮するため画質が変わる場合があります。';
 const controller=new AbortController();let stopped=false,index=0,part=null;
 const close=result=>{stopped=true;controller.abort();sheet.close();sheet.remove();resolve(result)};
 no.onclick=()=>close(false);cancel.onclick=()=>close(true);sheet.oncancel=e=>{e.preventDefault();close(true)};
 async function prepare(){
 yes.disabled=true;no.hidden=true;progress.hidden=false;part=null;
 try{
 const range=ranges[index];h.textContent='動画編集中 '+(index+1)+' / '+ranges.length;
 status.textContent='画面を開いたままお待ちください。';
 part=await renderCompatibleVideo([blob],n=>{progress.value=n;status.textContent=n+'%'},window.rotationAudio,{...range,signal:controller.signal});
 if(stopped)return;
 if(await videoDuration(part)>300)throw Error('この部分が5分を超えました。保存せずに停止しました。');
 if(stopped)return;
 progress.value=100;h.textContent=(index+1)+'本目の保存準備完了';status.textContent='ボタンを押して保存先を選んでください。';yes.textContent=(index+1)+'本目を保存';yes.onclick=save;yes.disabled=false;
 }catch(e){if(stopped)return;h.textContent='分割を完了できませんでした';status.textContent=e.message;yes.textContent='再試行';yes.onclick=prepare;yes.disabled=false}
 }
 async function save(){
 yes.disabled=true;
 try{
 const ext=part.type.includes('webm')?'webm':'mp4',name='In-GUTS-'+String(index+1).padStart(2,'0')+'-of-'+ranges.length+'.'+ext;
 const file=new File([part],name,{type:part.type});
 downloadVideoFile(part,name);
 if(stopped)return;index++;part=null;
 if(index===ranges.length){h.textContent='すべてのダウンロードを開始しました';status.textContent='「ファイル」のダウンロード先をご確認ください。写真へ移す場合は動画を開き「ビデオを保存」を選んでください。';yes.textContent='完了';yes.onclick=()=>close(true);cancel.hidden=true;yes.disabled=false}
 else{h.textContent=index+' / '+ranges.length+'本のダウンロードを開始しました';status.textContent='次の動画を作成します。';yes.textContent='次の動画を作成';yes.onclick=prepare;yes.disabled=false}
 }catch(e){if(stopped)return;status.textContent=e.name==='AbortError'?'保存をキャンセルしました。同じ動画を保存し直せます。':e.message;yes.disabled=false}
 }
 yes.onclick=prepare;document.body.append(sheet);sheet.showModal();
 });
}

async function deliverVideoFile(blob,ext){
 return new Promise(resolve=>{
 const d=document.createElement('dialog');d.className='clip-readiness';d.innerHTML='<h2>動画の保存準備完了</h2><p aria-live="polite">動画を保存してください。</p><button>動画を保存</button><button>閉じる</button>';
 const [save,close]=d.querySelectorAll('button'),status=d.querySelector('p');
 const finish=()=>{d.close();d.remove();resolve()};close.onclick=finish;d.oncancel=e=>{e.preventDefault();finish()};
 save.onclick=async()=>{save.disabled=true;try{const file=new File([blob],'In-GUTS.'+ext,{type:blob.type});downloadVideoFile(blob,'In-GUTS.'+ext);d.querySelector('h2').textContent='ダウンロードを開始しました';status.textContent='「ファイル」のダウンロード先をご確認ください。写真へ移す場合は動画を開き「ビデオを保存」を選んでください。';save.hidden=true;close.textContent='完了'}catch(e){status.textContent=e.name==='AbortError'?'保存をキャンセルしました。もう一度保存できます。':'保存できませんでした。もう一度お試しください。'}finally{save.disabled=false}};
 document.body.append(d);d.showModal();
 });
}

function downloadVideoFile(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),300000);}

// Share completion does not prove that the Photos destination was chosen.
let photoSharePending=false;
async function saveVideoToPhotos(blob,ext){
 if(photoSharePending)throw Error('共有画面を閉じてから、もう一度お試しください。');
 const file=new File([blob],'In-GUTS.'+ext,{type:blob.type});
 if(!navigator.share||!navigator.canShare?.({files:[file]}))throw Error('この画面では写真への保存を開けません。SafariでIn GUTSを開くか、動画ファイルを保存して「ファイル」から「ビデオを保存」を選んでください。');
 photoSharePending=true;let timer;
 let sharing;try{sharing=Promise.resolve(navigator.share({files:[file]}))}catch(e){photoSharePending=false;throw e;}
 sharing.finally(()=>{photoSharePending=false}).catch(()=>{});
 try{await Promise.race([sharing,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('共有画面から応答がありません。共有画面を閉じてください。動画は保持されています。Safariでの利用、または下のファイル保存をご利用ください。')),20000)})])}
 finally{clearTimeout(timer)}
}
