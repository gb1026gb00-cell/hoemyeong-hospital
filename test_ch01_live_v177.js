'use strict';
// V177 end-to-end network tests for approved CH01 and all media paths.
// No puzzle solution is shipped to the browser; this only calculates expected
// answers inside a privileged test process from individually observed clues.
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {WebSocket}=require('ws');
const PORT=42000+Math.floor(Math.random()*1000);
const base='http://127.0.0.1:'+PORT;
const proc=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT),ROOM_SAVE_PATH:''},stdio:['ignore','pipe','pipe']});
let log='';
proc.stderr.on('data',d=>log+=d.toString());
proc.stdout.on('data',d=>log+=d.toString());
const sockets=[],checks=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const client=async()=>{
 const c={messages:[],ws:new WebSocket('ws://127.0.0.1:'+PORT)};
 c.ws.on('message',d=>{try{c.messages.push(JSON.parse(d.toString()));}catch{}});
 sockets.push(c.ws);
 await new Promise((resolve,reject)=>{c.ws.once('open',resolve);c.ws.once('error',reject);});
 return c;
};
const send=(c,m)=>c.ws.send(JSON.stringify(m));
async function next(c,predicate,ms=5000){
 const start=Date.now();
 while(Date.now()-start<ms){
  const i=c.messages.findIndex(predicate);
  if(i!==-1)return c.messages.splice(i,1)[0];
  await delay(20);
 }
 throw Error('Missing expected message; recent='+JSON.stringify(c.messages.slice(-12))+'\nserver='+log.slice(-600));
}
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
(async()=>{
 try{
  await check('Server ready',async()=>{
   for(let i=0;i<100;i++){try{const x=await fetch(base+'/health');if(x.ok)return;}catch{}await delay(70);}
   throw Error('Server never became ready '+log);
  });
  await check('Real videos on same-origin Render paths are seekable',async()=>{
   const files=['G01.mp4','G02.mp4','G08.mp4','G14.mp4','G18.mp4','H01.mp4','H03.mp4','H04.mp4','intro_only.mp4','reception_hand.mp4'];
   for(const file of files){
    const head=await fetch(base+'/'+file,{method:'HEAD'});
    assert.equal(head.status,200,file+' HEAD '+head.status);
    assert.equal(head.headers.get('content-type'),'video/mp4',file+' mime');
    const partial=await fetch(base+'/'+file,{headers:{range:'bytes=0-31'}});
    assert.equal(partial.status,206,file+' range '+partial.status);
    assert.match(partial.headers.get('content-range')||'',/^bytes 0-31\/\d+$/);
    assert.equal((await partial.arrayBuffer()).byteLength,32,file+' body');
   }
   for(const file of ['voice_ch01.mp3','voice_original_ch06.mp3','audio/ghost_whisper.mp3']){
    const response=await fetch(base+'/'+file,{method:'HEAD'});
    assert.equal(response.status,200,file+' audio HEAD '+response.status);
   }
  });
  await check('Approved game served and media URLs are Render-local',async()=>{
   const response=await fetch(base+'/play');
   assert.equal(response.status,200);
   const html=await response.text();
   assert.ok(html.length>1000000,'approved-v172.html should be preserved');
   assert.ok(html.includes('coop-v174-mobile-fix.js'),'co-op bridge exists');
   assert.ok(!html.includes('https://gb1026gb00-cell.github.io/hoemyeong-hospital/'),'cross-host media URL remained');
   assert.ok(html.includes('HMObjectHorrorBindings'),'original approved scene assets remain');
  });
  const roomResponse=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({capacity:2})});
  assert.equal(roomResponse.status,201);
  const room=(await roomResponse.json()).code;
  const [a,b]=await Promise.all([client(),client()]);
  send(a,{type:'join',room,role:0,character:0});
  send(b,{type:'join',room,role:1,character:1});
  const [ja,jb]=await Promise.all([next(a,m=>m.type==='joined'),next(b,m=>m.type==='joined')]);
  assert.ok(ja.token&&jb.token);
  send(a,{type:'ready',ready:true});send(b,{type:'ready',ready:true});
  await next(a,m=>m.type==='state'&&m.members?.every(x=>x.ready));
  send(a,{type:'start'});
  await Promise.all([next(a,m=>m.type==='horror_video'&&m.id==='G01'),next(b,m=>m.type==='horror_video'&&m.id==='G01')]);
  await check('First investigation alone sends G08 once',async()=>{
   send(a,{type:'chapter',action:'start_investigation'});
   await Promise.all([next(a,m=>m.type==='horror_video'&&m.id==='G08'),next(b,m=>m.type==='horror_video'&&m.id==='G08')]);
   await next(a,m=>m.type==='state'&&m.chapter?.phase==='separated');
  });
  await check('Ledger/mirror/cabinet are actual private visual clues, not videos',async()=>{
   const observations=[];
   for(const [index,c] of [a,b].entries()){
    observations[index]={};
    for(const object of ['mirror','cabinet','ledger']){
     c.messages.splice(0);
     send(c,{type:'chapter',action:'reception_clue',object});
     const clue=await next(c,m=>m.type==='reception_clue'&&m.object===object);
     observations[index][object]=clue;
     await delay(30);
     assert.equal(c.messages.filter(m=>m.type==='horror_video').length,0,object+' unexpectedly played video');
     assert.equal(c.messages.filter(m=>m.type==='reception_clue'&&m.object!==object).length,0);
    }
   }
   assert.notEqual(observations[0].mirror.shadowCount,observations[1].mirror.shadowCount,'cooperative mirror clues are distributed');
   assert.ok(observations.every(o=>Number.isInteger(o.mirror.shadowCount)));
   assert.ok(observations.every(o=>o.cabinet.sequence.includes('○')));
   assert.ok(observations.every(o=>Number.isInteger(o.ledger.people)));
   const shadows=observations.reduce((sum,o)=>sum+o.mirror.shadowCount,0);
   // Each private cabinet clue has a single hidden digit. Missing values are
   // derivable by comparing the other investigator's sequence with one's own.
   const slots=observations[0].cabinet.sequence.trim().split(/\s+/);
   const slotsOther=observations[1].cabinet.sequence.trim().split(/\s+/);
   const digits=slots.map((d,i)=>Number(d==='○'?slotsOther[i]:d));
   assert.ok(digits.every(Number.isFinite),'cabinet hidden slots are reconstructable');
   const cabinet=digits.reduce((x,y)=>x+y,0)%10;
   const ledgerDigits=String(observations.reduce((sum,o)=>sum+o.ledger.people,0)).padStart(6-(String(shadows).length+1),'0');
   const answer=String(shadows)+String(cabinet)+ledgerDigits;
   assert.match(answer,/^\d{6}$/);
   send(a,{type:'chapter',action:'reception_submit',answer});
   await next(a,m=>m.type==='reception_result'&&m.complete===true);
   await next(a,m=>m.type==='fragment_result'&&m.ok&&m.index===0);
   await next(a,m=>m.type==='state'&&m.chapter?.phase==='ch02');
   assert.equal(b.ws.readyState,WebSocket.OPEN,'cooperative peer should remain connected through CH02');
  });
  console.log('RESULT '+checks.length+' checks passed');
 }catch(error){console.error('FAIL',error.stack||String(error));process.exitCode=1;}
 finally{for(const ws of sockets)try{ws.close();}catch{}proc.kill('SIGTERM');setTimeout(()=>proc.kill('SIGKILL'),2000).unref();}
})();
