'use strict';
const fs=require('node:fs');
const s=fs.readFileSync('approved-v172.html','utf8');
console.log('SOURCE_LEN',s.length,'LINES',s.split('\n').length);
const patterns=['new WebSocket','WebSocket(','onclose','onerror','socket.close','ws.close','let ws','var ws','const ws','hmCoopOpen','hmCoopPanel','deskButton','data-obj="ledger"','data-obj="mirror"','hmPlaySheet','hmSceneClueOverlay','hmScene','reception_clue','hmMediaOverlay','hmVideoStart','introPlayer','접수 명부','현장으로','connection lost','연결 종료'];
const lines=s.split('\n');
for(const p of patterns){
 let hits=0;
 for(let i=0;i<lines.length;i++){
  if(lines[i].includes(p)){
   if(++hits>6)break;
   console.log('SOURCE_HIT',JSON.stringify({p,line:i+1,nearby:lines.slice(Math.max(0,i-2),Math.min(lines.length,i+3)).join('\n').slice(0,1200)}));
  }
 }
}
