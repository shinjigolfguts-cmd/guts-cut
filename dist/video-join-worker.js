importScripts('video-join.js?v=5');
self.onmessage=async ({data})=>{
 try{self.postMessage({blob:await joinVideos(data,ready=>self.postMessage({ready}))})}
 catch(error){self.postMessage({error:error.message||'動画を結合できませんでした'})}
};
