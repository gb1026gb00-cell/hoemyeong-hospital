const http=require('http');
const {randomBytes}=require('crypto');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT||3000);
const roomStorage=require('./room_storage');
const ROOM_SAVE_PATH=process.env.ROOM_SAVE_PATH||'';
let persistenceLastError=null;
function checkPersistenceWritable(){
 if(!ROOM_SAVE_PATH)return false;
 const fs=require('fs'),path=require('path');
 const dir=path.dirname(ROOM_SAVE_PATH);
 try{fs.mkdirSync(dir,{recursive:true});const probe=path.join(dir,'.hoemyeong-write-check-'+process.pid);try{fs.writeFileSync(probe,'ok',{flag:'wx',mode:0o600})}finally{try{fs.unlinkSync(probe)}catch{}}return true}
 catch(e){persistenceLastError=e.message;console.error('[PERSISTENCE ERROR] Cannot write to room storage directory:',e.message);return false}
}
let persistenceWritable=checkPersistenceWritable();
if(!ROOM_SAVE_PATH)console.warn('[PERSISTENCE WARNING] ROOM_SAVE_PATH is unset: rooms will NOT survive server restarts.');
let rooms=new Map();
try{rooms=roomStorage.restore(ROOM_SAVE_PATH)}catch(e){console.error('Room restore failed:',e.message);process.exitCode=1;throw e}
function persist(){if(!ROOM_SAVE_PATH)return;try{roomStorage.save(ROOM_SAVE_PATH,rooms);persistenceWritable=true;persistenceLastError=null}catch(e){persistenceWritable=false;persistenceLastError=e.message;console.error('Room save failed:',e.message)}}
// Numeric room IDs are allocated only by the server. A durable counter is
// stored beside room snapshots; this requires ROOM_SAVE_PATH on persistent disk.
const roomCounterFile=ROOM_SAVE_PATH?ROOM_SAVE_PATH+'.counter':null;
// Without durable storage, seed from wall-clock time so a cold start never
// reissues 0001 to a different room. Persistent deployments keep 0001, 0002...
// through their on-disk counter. The fallback is numeric and monotonically
// increases within each running process.
let roomCounter=roomCounterFile?0:Math.floor(Date.now()/1000)*100;
if(roomCounterFile){
 try{roomCounter=Math.max(0,Number(require('fs').readFileSync(roomCounterFile,'utf8'))||0)}catch(e){if(e.code!=='ENOENT')console.error('Room counter read error',e.message)}
}
for(const code of rooms.keys())if(/^[0-9]{4,}$/.test(code))roomCounter=Math.max(roomCounter,Number(code));
function allocateRoom(capacity){
 const fs=require('fs'),path=require('path');
 let code;
 do{roomCounter++;code=String(roomCounter).padStart(4,'0')}while(rooms.has(code));
 if(roomCounterFile){
  fs.mkdirSync(path.dirname(roomCounterFile),{recursive:true});
  const tmp=roomCounterFile+'.'+process.pid+'.tmp';
  fs.writeFileSync(tmp,String(roomCounter),{mode:0o600});fs.renameSync(tmp,roomCounterFile);
 }
 const room={code,clients:new Set(),pieces:new Set(),chat:[],host:null,started:false,capacity:([2,4,8].includes(capacity)?capacity:2),devSolo:false,allocated:true};
 rooms.set(code,room);
 persist(); // Save newly allocated but not-yet-joined rooms before sharing invites.
 return code;
}

// CH01 cooperative clues: stable within a room, unique per connected investigator.
function makeReceptionPuzzle(room){
 const roles=[...room.clients].map(c=>c.role).sort((a,b)=>a-b);
 const shadows=roles.map((_,i)=>1+(i*3+room.capacity)%4);
 const sum=shadows.reduce((a,b)=>a+b,0);
 const cabinet=roles.map((_,i)=>(i*2+3)%10);
 const cabinetDigit=cabinet.reduce((a,b)=>a+b,0)%10;
 const answerLength=({2:4,4:5,6:6,8:7})[room.capacity]||4;
 const ledgerCount=answerLength-(String(sum).length+1);
 const dates=roles.map((_,i)=>({date:9+i,people:2+(i*3)%7}));
 const ledgerValue=dates.reduce((a,d)=>a+d.people,0);
 const ledgerDigits=String(ledgerValue).padStart(ledgerCount,'0').slice(-ledgerCount);
 return {roles,shadows,cabinet,dates,answer:String(sum)+String(cabinetDigit)+ledgerDigits,ledgerCount,answerLength};
}
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url||'/', 'http://localhost').pathname;
 if((req.method==='GET'||req.method==='HEAD')&&pathname==='/build-info'){
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  return res.end(req.method==='HEAD'?'':JSON.stringify({build:'hm-ch03-direct-20261111-guide-v2',branch:'dev/coop-v172-preserve-approved-ui',ch03Direct:true,guide:'2-4-8-horror'}));
 }
 if(req.method==='POST'&&pathname==='/api/rooms'){
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>1024)req.destroy();});
  req.on('end',()=>{
   try{
    const payload=JSON.parse(raw||'{}');
    const code=allocateRoom(Number(payload.capacity));
    if(payload.drawerTest===true){const room=rooms.get(code);room.drawerTest=true;persist();}
    res.writeHead(201,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({code}));
   }catch(e){res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'방 번호를 발급하지 못했습니다.'}));}
  });return;
 }

 if((req.method==='GET'||req.method==='HEAD')&&pathname==='/coop-v175-lobby.js'){
  res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')return res.end();
  return require('fs').createReadStream(require('path').join(__dirname,'coop_v175_lobby.js')).pipe(res);
 }
 if((req.method==='GET'||req.method==='HEAD')&&pathname==='/coop-v174-mobile-fix.js'){
  res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')return res.end();
  return require('fs').createReadStream(require('path').join(__dirname,'coop_v174_mobile_fix.js')).pipe(res);
 }
 // Opt-in Cloudflare R2 media offload. Keep original Render handlers as a rollback.
 // Enable only after verifying R2 objects and cross-origin audio/video behavior.
 if((req.method==='GET'||req.method==='HEAD')&&process.env.R2_MEDIA_ENABLED==='1'){
  const mediaKey=pathname.slice(1);
  const r2Media=/^(?:G(?:0[1-9]|1[0-8])|H0[134]|intro_only|reception_hand)\.mp4$/.test(mediaKey)
   ||/^(?:CH01_reverse_corrupted|voice_(?:original_)?ch0[1-6])\.mp3$/.test(mediaKey)
   ||/^[A-Za-z0-9_-]+\.webp$/.test(mediaKey)
   ||/^audio\/[A-Za-z0-9_-]+\.(?:mp3|wav|ogg)$/.test(mediaKey)
   ||/^assets\/images\/[A-Za-z0-9_-]+\.webp$/.test(mediaKey);
  if(r2Media){
   const base=(process.env.R2_MEDIA_BASE_URL||'https://pub-ddd573dbcf4a4d7bb46861bb5dd468b1.r2.dev').replace(/\/$/,'');
   res.writeHead(302,{'Location':base+'/'+mediaKey,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   return res.end();
  }
 }
 if((req.method==='GET'||req.method==='HEAD')&&pathname==='/CH01_reverse_corrupted.mp3'){
  const fs=require('fs'),path=require('path'),file=path.join(__dirname,'CH01_reverse_corrupted.mp3');
  return fs.stat(file,(err,stat)=>{
   if(err||!stat.isFile()){res.writeHead(404);return res.end();}
   res.writeHead(200,{'Content-Type':'audio/mpeg','Content-Length':stat.size,'Cache-Control':'public, max-age=3600'});
   if(req.method==='HEAD')return res.end();
   fs.createReadStream(file).pipe(res);
  });
 }
 if((req.method==='GET'||req.method==='HEAD')&&['/reception_hand.mp4','/G01.mp4','/G08.mp4'].includes(pathname)){
  const fs=require('fs'),path=require('path');
  const file=path.join(__dirname,pathname.slice(1));
  fs.stat(file,(err,stat)=>{
   if(err||!stat.isFile()){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Reception video unavailable');}
   const range=req.headers.range;
   const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'public, max-age=3600'};
   if(range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!match){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});return res.end();}
    let start=match[1]?Number(match[1]):0,end=match[2]?Number(match[2]):stat.size-1;
    if(!match[1]&&match[2]){start=Math.max(0,stat.size-Number(match[2]));end=stat.size-1;}
    if(start>=stat.size||end<start){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});return res.end();}
    end=Math.min(end,stat.size-1);
    res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':'bytes '+start+'-'+end+'/'+stat.size});
    if(req.method==='HEAD')return res.end();
    fs.createReadStream(file,{start,end}).pipe(res);return;
   }
   res.writeHead(200,{...headers,'Content-Length':stat.size});
   if(req.method==='HEAD')return res.end();
   fs.createReadStream(file).pipe(res);
  });return;
 }

 // V177: Deliver every approved game asset from Render itself, with byte ranges.
 // GitHub Pages is not a reliable cross-origin media host for the multiplayer page.
 const mediaPath=pathname.slice(1);
 const safeMedia=/^(?:G(?:0[1-9]|1[0-8])|H0[134]|intro_only)\.mp4$/.test(mediaPath)
  ||/^voice_(?:original_)?ch0[1-6]\.mp3$/.test(mediaPath)
  ||/^[A-Za-z0-9_-]+\.webp$/.test(mediaPath)
  ||/^audio\/[A-Za-z0-9_-]+\.(?:mp3|wav|ogg)$/.test(mediaPath)
  ||/^assets\/images\/[A-Za-z0-9_-]+\.webp$/.test(mediaPath);
 if((req.method==='GET'||req.method==='HEAD')&&safeMedia){
  const fs=require('fs'),path=require('path');
  const file=path.join(__dirname,mediaPath);
  return fs.stat(file,(err,stat)=>{
   if(err||!stat.isFile()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});return res.end('Game media not found');}
   const ext=path.extname(file).toLowerCase();
   const mime={'.mp4':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.webp':'image/webp'}[ext];
   const headers={'Content-Type':mime,'Accept-Ranges':'bytes','Cache-Control':'public,max-age=3600','X-Content-Type-Options':'nosniff'};
   const range=req.headers.range;
   if(range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});return res.end();}
    const rawStart=match[1],rawEnd=match[2];
    let start=rawStart?Number(rawStart):Math.max(0,stat.size-Number(rawEnd));
    let end=rawEnd&&rawStart?Number(rawEnd):stat.size-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=stat.size||end<start){
     res.writeHead(416,{'Content-Range':'bytes */'+stat.size});return res.end();
    }
    end=Math.min(end,stat.size-1);
    res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':'bytes '+start+'-'+end+'/'+stat.size});
    if(req.method==='HEAD')return res.end();
    return fs.createReadStream(file,{start,end}).pipe(res);
   }
   res.writeHead(200,{...headers,'Content-Length':stat.size});
   if(req.method==='HEAD')return res.end();
   fs.createReadStream(file).pipe(res);
  });
 }
 if((req.method==='GET'||req.method==='HEAD')&&(pathname==='/play'||pathname==='/play-drawer-test')){
  const fs=require('fs'),path=require('path');
  const approved=path.join(__dirname,'approved-v172.html');
  fs.stat(approved,(err,stat)=>{
   if(err||!stat.isFile()){res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});return res.end('Approved V172 game file is unavailable');}
   fs.readFile(approved,'utf8',(readError,html)=>{
    if(readError){res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Game file read failed');}
    const script='<script src="/coop-v174-mobile-fix.js?v=ch02-certificate-20261110-2"></script><script src="/coop-v175-lobby.js"></script>';
    const localHtml=html.split('https://gb1026gb00-cell.github.io/hoemyeong-hospital/').join('/');
    const output=/<\/body>/i.test(localHtml)?localHtml.replace(/<\/body>/i,script+'</body>'):localHtml+script;
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?'':output);
   });
  });
  return;
 }
 res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*'});
 res.end(JSON.stringify({service:'Hoemyeong Hospital multiplayer v6.0-test',status:'ok',rooms:rooms.size,persistenceConfigured:!!ROOM_SAVE_PATH,persistenceWritable,persistenceError:persistenceLastError}));
});
const wss=new WebSocketServer({server,maxPayload:4096});
const HEARTBEAT_MS=30000;
const heartbeat=setInterval(()=>{
 for(const ws of wss.clients){
  if(ws.isAlive===false){ws.terminate();continue;}
  ws.isAlive=false;
  try{ws.ping()}catch(e){ws.terminate()}
 }
},HEARTBEAT_MS);
heartbeat.unref();
wss.on('close',()=>clearInterval(heartbeat));
const send=(ws,o)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(o))};
const validRoom=x=>typeof x==='string'&&/^[A-Z0-9_-]{1,16}$/.test(x);
const members=r=>[...r.clients].map(c=>({role:c.role,character:c.character,ready:c.ready,host:c===r.host,online:!!c.ws&&c.ws.readyState===WebSocket.OPEN})).sort((a,b)=>a.role-b.role);
const publicChapter=ch=>ch?{voicePlayed:[...(ch.voicePlayed||[])],phase:ch.phase,solved:[...(ch.solved||[])],bellBy:ch.bellBy,sensoryDone:[...(ch.sensoryDone||[])],sensoryUnlocked:!!ch.ecgSolved,ecgReady:(ch.sensoryDone||[]).length===8,evidenceFound:[...(ch.evidenceFound||[])],evidenceSolved:!!ch.evidenceSolved,ch02:ch.ch02?{active:true,found:[...ch.ch02.found],switches:[...ch.ch02.switches],unlocked:ch.ch02.unlocked,explored:[...(ch.ch02.explored||[])],alarm:!!ch.ch02.alarm,pressure:[...(ch.ch02.pressure||[])],pressureSolved:!!ch.ch02.pressureSolved,pressureLastRole:ch.ch02.pressureLastRole??null}:null,ch03:ch.ch03?{inspected:[...ch.ch03.inspected],clues:[...ch.ch03.clues],failed:ch.ch03.failed,solved:ch.ch03.solved}:null,ch04:ch.ch04?{inspected:[...ch.ch04.inspected],witnesses:[...ch.ch04.witnesses],votes:[...ch.ch04.votes],decoded:[...(ch.ch04.decoded||[])],failed:ch.ch04.failed,solved:ch.ch04.solved}:null,ch05:ch.ch05?{inspected:[...ch.ch05.inspected],samples:[...ch.ch05.samples],valves:[...ch.ch05.valves],lastRole:ch.ch05.lastRole,failed:ch.ch05.failed,solved:ch.ch05.solved}:null,ch06:ch.ch06?{inspected:[...ch.ch06.inspected],fragments:[...ch.ch06.fragments],switches:[...ch.ch06.switches],failed:ch.ch06.failed,artifactSolved:!!ch.ch06.artifactSolved,artifactInspected:[...(ch.ch06.artifactInspected||[])],solved:ch.ch06.solved}:null}: {phase:'reception',solved:[],bellBy:null};

// [수정 반영] 3~8인 플레이 시 단서 소유권이 상위 2명에게만 편중되지 않고 참여 인원에 맞게 분산되도록 개선
const clueOwners=r=>{
 const online=[...r.clients].filter(c=>c.ws&&c.ws.readyState===WebSocket.OPEN).map(c=>c.role).sort((a,b)=>a-b);
 const all=[...r.clients].map(c=>c.role).sort((a,b)=>a-b);
 const primary=online.length>=2?online:all;
 if(r.devSolo)return [primary[0],primary[0]];
 const count=Math.max(2,Math.min(primary.length,4));
 return primary.slice(0,count);
};

function recovery(ch){
 if(!ch)return {percent:0,found:0,total:20,tier:0};
 const flags=[
  ch.phase!=='reception',
  (ch.evidenceFound||[]).length===3,!!ch.evidenceSolved,
  (ch.sensoryDone||[]).length===8,!!ch.ecgSolved,
  ['escaped','ch02','ch02_cleared','ch03','ch03_cleared','ch04','ch04_cleared','ch05','ch05_cleared','ch06','finished'].includes(ch.phase),
  (ch.ch02?.explored||[]).length===3,(ch.ch02?.found||[]).length===2,!!ch.ch02?.unlocked,!!ch.ch02?.pressureSolved,
  (ch.ch03?.inspected||[]).length===3,(ch.ch03?.clues||[]).length===2,!!ch.ch03?.solved,
  (ch.ch04?.decoded||[]).length===4,(ch.ch04?.witnesses||[]).length===2,!!ch.ch04?.solved,
  (ch.ch04?.decoded||[]).length===4,(ch.ch04?.artifactRecordWitnesses||[]).length>0,!!ch.ch04?.solved,
  !!ch.ch06?.solved
 ];
 const found=flags.filter(Boolean).length,percent=found*5;
 return {percent,found,total:20,tier:percent===100?3:percent>=80?2:percent>=50?1:0};
}
const state=r=>({type:'state',cooperationPaused:!!r.started&&[...r.clients].filter(c=>c.ws&&c.ws.readyState===WebSocket.OPEN).length<2,artifactFragments:[...(r.artifactFragments||[])].sort(),dollComplete:r.pieces.size===4,clueOwners:clueOwners(r),roles:members(r).map(x=>x.role),members:members(r),pieces:[...r.pieces].sort(),started:r.started,capacity:r.capacity||2,devSolo:!!r.devSolo,chat:r.chat.slice(-25),chapter:publicChapter(r.chapter),recovery:recovery(r.chapter)});
function enterFinalAfterCh04(r){
 const ch=r.chapter;
 if(!ch||ch.phase!=='ch04_cleared'||!ch.ch04?.solved)return false;
 if(![0,1,2,3,4].every(i=>(r.artifactFragments||new Set()).has(i)))return false;
 if(!(ch.ch04.artifactRecordWitnesses||[]).length)return false;
 ch.phase='ch06';ch.ch06={inspected:[],fragments:[],switches:[],failed:0,solved:false,artifactSolved:false,artifactInspected:[]};
 const dialogue=[['성화','잠깐. 저기 봐.'],['홍중','저게… 제단이야? 병원 지하에 왜 저런 게 있어?'],['우영','저게 진짜 뭐야. 우리 지금까지 저걸 찾으려고 온 거야?'],['민기','나 진짜 나가고 싶어. 더는 못 하겠어.'],['윤호','출구부터 찾자. 다들 떨어지지 말고.'],['여상','근데 이상하지 않아? 파편이 전부 저쪽을 향하고 있어.'],['종호','여기가 끝인가? 저거만 확인하면 나갈 수 있는 거야?'],['산','…아니. 저기 문이 하나 더 있어.'],['우영','근데 우리 여덟 명 아니야?'],['민기','왜 갑자기?'],['우영','아니, 여기 아홉 명이라고 떠 있잖아.'],['종호','처음부터 그랬어.'],['홍중','그럼 나머지 한 명은 누구야?'],['시스템','알 수 없음 님이 메시지를 보냈습니다.'],['알 수 없음','저는 한 번도 나간 적이 없는데요.'],['산','…너 누구야.'],['알 수 없음','지금도 제 안에 계시잖아요.'],['시스템','알 수 없음 님이 퇴장했습니다.'],['시스템','회명병원 · 단체 대화 (8)'],['시스템','回明病院 · 접속 종료: 실패 / 제9참가자는 퇴장할 수 없습니다. / 현재 접속 위치: 回明病院']];
 broadcast(r,{type:'ch06_event',event:'enter',message:'제단처럼 생긴 구조물 위에 제0유물의 흔적이 남아 있다. 그 뒤로 마지막 문이 보인다.',dialogue});
 broadcast(r,state(r));chapterVoiceOnce(r,6);return true;
}
function chapterVoiceOnce(r,index){if(!r.chapter||!Number.isInteger(index)||index<1||index>6)return;const ch=r.chapter;if(!Array.isArray(ch.voicePlayed))ch.voicePlayed=[];if(ch.voicePlayed.includes(index))return;ch.voicePlayed.push(index);broadcast(r,state(r));broadcast(r,{type:'chapter_voice',chapter:index});}
function broadcast(r,o){if(o.type==='state'){
 if([...r.clients].some(c=>c.ws&&c.ws.readyState===WebSocket.OPEN))r.lastActiveAt=Date.now();
 persist();o=state(r);
 }for(const c of r.clients)if(c.ws)send(c.ws,o.type==='state'?{...o,yourRole:c.role,isHost:c===r.host}:o)}
const CH04_RECORDS={"ledger":"퇴실 대장: 208호 정상 퇴실 0명. 번호/문자: 07/G,18/R,15/O,22/T,12/L,09/N. CCTV 출입 순서로 읽으시오. 1997 회명계획, 2001 제0유물 출현.","camera":"CCTV: 02:41 그림자가 208호에 들어감, 출입번호 07→15→12. 프레임/신호/문자 01/04/D,02/09/X,03/11/E,04/06/A,05/16/N,06/20/V. 복구 02:47.","call":"내선: 208호 02:41 구조 요청, 통화 8초, 수화기 미사용. 정상 신호 04→11→16. 음성 숫자 08/15/21/18.","tag":"보존 봉투: 2003.11.26 제8차 복원 실험 시작 02:41. 기록에 없는 사람을 복원하지 말 것. A=01…Z=26. 순서: 사람 기록→기계 기록→음성 기록→기록되지 않은 시간.","keyA":"환자 대조표: CCTV 출입번호와 퇴실 대장 번호를 대조해 출입 순서대로 읽는다.","keyB":"프레임 판별표: 교환기 정상 신호에 해당하는 CCTV 프레임만 신호 순서대로 읽는다.","keyC":"문자 변환표: 봉투의 A=01~Z=26을 내선의 네 숫자에 적용한다.","keyD":"시간 검증표: 봉투 시작 시각부터 CCTV 복구 시각까지 경과 분을 계산한다."};
const CH04_KEYS=['ledger','camera','call','tag','keyA','keyB','keyC','keyD'];
const CH04_ANSWERS={A:'GOL',B:'DEN',C:'HOUR',D:'6'};
function ch04Owners(r){
 const roles=[...r.clients].filter(c=>c.ws&&c.ws.readyState===WebSocket.OPEN).map(c=>c.role).sort((a,b)=>a-b);
 if(r.devSolo&&roles.length===1)return Object.fromEntries(CH04_KEYS.map(k=>[k,roles[0]]));
 if(roles.length<2)return {};
 const c=r.chapter?.ch04;if(!c)return {};
 if(!c.owners||typeof c.owners!=='object'){
  const order=roles.length===2?[0,1,0,1,1,0,1,0]:CH04_KEYS.map((_,i)=>i%roles.length);
  c.owners=Object.fromEntries(CH04_KEYS.map((key,i)=>[key,roles[order[i]]]));
 }
 const counts=Object.fromEntries(roles.map(role=>[role,0]));
 for(const key of CH04_KEYS)if(roles.includes(c.owners[key]))counts[c.owners[key]]++;
 for(const key of CH04_KEYS)if(!roles.includes(c.owners[key])){
  const role=roles.reduce((a,b)=>counts[a]<=counts[b]?a:b);
  c.owners[key]=role;counts[role]++;
 }
 return c.owners;
}
const FRAGMENT_PHASES=['escaped','ch02_cleared','ch03_cleared','ch04_cleared','ch05_cleared'];
const FRAGMENT_SITES=['cabinet','drawer','mirror','ledger','glass'];
const FRAGMENT_DESCRIPTIONS=[
 '접수실 서류함의 이중 바닥을 들어 올리자, 날짜가 거꾸로 새겨진 차가운 조각이 드러난다.',
 '208호 서랍의 안쪽 판을 밀자, 지워진 환자 이름이 흐르는 파편이 나온다.',
 '엘리베이터 거울 가장자리의 틈에 손을 넣자, 층수 대신 시각이 새겨진 파편이 걸린다.',
 '기록보관실 대장의 찢어진 등표지 안쪽에서 검게 변색된 파편이 떨어진다.',
 '기록보관실 봉인 관찰창 아래 실리콘 틈에서 마지막 파편이 발견된다. 다섯 조각이 동시에 진동한다.'
];
function updateSenseAssignments(r){if(!r.started)return;for(const c of r.clients)if(c.ws&&c.ws.readyState===WebSocket.OPEN)send(c.ws,{type:"sense_assignment",senses:assignedSenses(r,c.role).map(x=>x.sense)});}

const RULES=[
 '접수 기록: 받은 두 자리 번호를 거꾸로 배열하라.',
 '보관실 계량: 받은 번호에 17을 더하라.',
 '처치실 투약: 받은 번호에서 9를 빼라.',
 '검사실 교정: 받은 번호에 2를 곱하라.',
 '당직실 순찰: 받은 번호의 각 자릿수를 더해 두 자리로 입력하라.',
 '자료실 분류: 받은 번호에 31을 더하라.',
 '격리실 역산: 받은 번호에 3을 곱하고 7을 빼라.',
 '관찰실 영상: 받은 번호의 십의 자리와 일의 자리를 바꾸고 5를 더하라.'
];
function panelAnswer(role,code){const n=Number(code),a=Math.floor(n/10),b=n%10;
 const v=[b*10+a,n+17,n-9,n*2,a+b,n+31,n*3-7,b*10+a+5][role];
 return String(v).padStart(2,'0');}

const SENSES=['청각','촉각','시각','기록','시간','전파','관찰','기억'];
const SENSE_OBJECTS=['intercom','mirror','mirror','desk','desk','intercom','cabinet','mirror'];
const SENSE_MESSAGES=[
 '세 번의 금속음 뒤에 한 번의 긴 침묵이 있다.',
 '거울 테두리의 돌기가 짧게 두 번, 길게 한 번 반복된다.',
 '유리에 비친 출입 표시는 실제 문과 반대 방향이다.',
 '같은 환자 번호가 서로 다른 날짜에 반복되어 있다.',
 '기록된 시각과 멈춘 시계가 정확히 17분 어긋난다.',
 '내선의 잡음 사이에서 두 번 반복되는 호출 부호가 들린다.',
 '서랍 손잡이에만 최근에 남은 손자국이 있다.',
 '처음 들어왔을 때 없던 그림자가 거울에 남아 있다.'
];
function assignedSenses(r,role){const online=[...r.clients].filter(x=>x.ws&&x.ws.readyState===WebSocket.OPEN).map(x=>x.role).sort((a,b)=>a-b);if(r.started&&online.length<2&&!r.devSolo)return [];const roles=r.started?online:(r.senseRoles||[...r.clients].map(x=>x.role).sort((a,b)=>a-b)),idx=roles.indexOf(role);
 return idx<0?[]:SENSES.map((sense,i)=>({sense,object:SENSE_OBJECTS[i],message:SENSE_MESSAGES[i]})).filter((_,i)=>i%roles.length===idx);
}
const ECG_ORDER=[3,0,6,2,7,4,1,5];
const SENSE_TASKS=[
 ['청각 · 호출음','짧은 신호가 2회, 긴 신호가 3회 울린다. 긴 신호는 짧은 신호의 두 배 길이다. 전체 박자는?','8'],
 ['촉각 · 점자판','돌기 행은 1·3·5, 다음 행은 2·4·6이다. 첫 행의 숫자 합은?','9'],
 ['시각 · 거울 문자','거울에 62가 비친다. 좌우를 뒤집어 실제 표기된 두 자리 숫자를 쓰세요.','26'],
 ['기록 · 중복 차트','접수 번호 12, 15, 12, 19, 15, 12. 12번 환자의 등장 횟수는?','3'],
 ['시간 · 정지 시계','당직 일지 02:41, 벽시계 02:24. 차이는 몇 분인가?','17'],
 ['전파 · 호출 부호','무전기 부호 4-1-4-2-4. 가장 자주 나온 숫자는?','4'],
 ['관찰 · CCTV','복도 카메라에는 3명이 보이지만 거울에 비친 사람은 2명이다. 차이는?','1'],
 ['기억 · 사라진 기록','첫 화면의 순서가 7-2-9-4였고 2번째 숫자만 지워졌다. 그 숫자는?','2']
];
const EVIDENCE=[
 {sense:3,object:'desk',title:'환자 차트',text:'02:41에 208호는 비어 있었다. 207호는 환자 1명이 입실한 상태였다.'},
 {sense:6,object:'cabinet',title:'감시 영상',text:'02:41 복도 영상에는 208호 문 안으로 들어간 사람 그림자 1개가 찍혔다.'},
 {sense:5,object:'intercom',title:'내선 기록',text:'02:41 내선 208에서 구조 요청이 접수됐다. 207호 내선은 고장 상태였다.'}
];
const GRACE=120000;
function leave(c){if(!c.room)return;const r=rooms.get(c.room);if(!r)return;
 if(r.started){
 c.ws=null;c.offlineAt=Date.now();
 const ch=r.chapter;
 if(ch?.ch02?.switches)ch.ch02.switches=ch.ch02.switches.filter(role=>role!==c.role);
 if(ch?.ch04?.votes)ch.ch04.votes=ch.ch04.votes.filter(role=>role!==c.role);
 if(ch?.ch06?.switches)ch.ch06.switches=ch.ch06.switches.filter(role=>role!==c.role);
 updateSenseAssignments(r);broadcast(r,state(r));return}
 // Preserve pre-start identity and host authority on accidental disconnect.
 // Only the original private reconnect token can reclaim this role.
 c.ws=null;c.offlineAt=Date.now();broadcast(r,state(r));return;
 r.clients.delete(c);c.room=null;if(r.host===c)r.host=[...r.clients][0]||null;
 if(!r.clients.size){rooms.delete(r.code);persist()}else broadcast(r,state(r));
}
function prune(){const now=Date.now();let expired=false;for(const r of rooms.values()){
 if(!r.started)continue;
 if(![...r.clients].some(c=>c.ws&&c.ws.readyState===WebSocket.OPEN)&&now-(r.lastActiveAt||now)>=roomStorage.TTL){rooms.delete(r.code);expired=true;continue;}
 if(!r.clients.size)continue;
 for(const c of r.clients)if(c.ws)send(c.ws,state(r));
}if(expired)persist();}
setInterval(prune,15000).unref();
wss.on('connection',ws=>{
 ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true});
 const c={ws,room:null,role:null,character:null,ready:false,token:null};let count=0,windowStart=Date.now(),burst=0,burstStart=Date.now();
 ws.on('message',raw=>{
  if(Date.now()-windowStart>10000){windowStart=Date.now();count=0}if(++count>120)return send(ws,{type:'error',message:'요청이 너무 많습니다.'});
  if(Date.now()-burstStart>1000){burstStart=Date.now();burst=0}if(++burst>500)return send(ws,{type:'error',message:'잠시 후 다시 시도해 주세요.'});
  let m;try{m=JSON.parse(raw.toString())}catch{return}if(!m||typeof m.type!=='string')return;
  if(m.type==='join'){
   if(c.room)return send(ws,{type:'error',message:'이미 입장했습니다.'});
   if(!validRoom(m.room)||!Number.isInteger(m.role)||m.role<0||m.role>7)return send(ws,{type:'error',message:'방 코드 또는 역할 오류'});
   const character=Number.isInteger(m.character)?m.character:m.role;
   if(character<0||character>7)return send(ws,{type:'error',message:'캐릭터 선택 오류'});
   let r=rooms.get(m.room);
   if(r&&m.token){
    const old=[...r.clients].find(x=>x.token&&x.token===m.token);
    if(!old){if(r.started)return send(ws,{type:'error',message:'게임이 시작되어 신규 입장할 수 없습니다.'});}else{
    if(old.ws&&old.ws.readyState===WebSocket.OPEN)return send(ws,{type:'error',message:'이미 접속 중인 참가자입니다.'});
    old.ws=ws;old.offlineAt=0;c.room=null;ws.player=old;
    send(ws,{...state(r),type:'joined',token:old.token,resumed:true,yourRole:old.role,isHost:old===r.host,senses:assignedSenses(r,old.role).map(x=>x.sense)});updateSenseAssignments(r);broadcast(r,state(r));return;}
   }
   if(r&&r.started)return send(ws,{type:'error',message:'게임이 시작되어 신규 입장할 수 없습니다.'});
   // Recover a recent numeric invitation if an ephemeral server restarted.
   // This does not restore already-started games or replace persistent storage.
   if(!r&&/^[0-9]{12}$/.test(m.room)){
    const issued=Math.floor(Number(m.room)/100)*1000;
    if(Number.isSafeInteger(issued)&&issued<=Date.now()+60000&&issued>=Date.now()-24*60*60*1000){
     r={code:m.room,clients:new Set(),pieces:new Set(),chat:[],host:null,started:false,capacity:2,devSolo:false,allocated:true};
     rooms.set(m.room,r);persist();
    }
   }
   if(!r)return send(ws,{type:'error',message:'존재하지 않는 조사실 코드입니다. 방장에게 코드를 확인하세요.'});
   if(r.clients.size>=r.capacity||[...r.clients].some(x=>x.role===m.role||x.character===character))return send(ws,{type:'error',message:'이미 선택된 캐릭터/역할이거나 방이 가득 찼습니다.'});
   c.room=m.room;c.role=m.role;c.character=character;c.ready=false;c.token=randomBytes(24).toString('hex');r.clients.add(c);if(!r.host)r.host=c;
   send(ws,{...state(r),type:'joined',token:c.token,yourRole:c.role,isHost:c===r.host,senses:assignedSenses(r,c.role).map(x=>x.sense)});broadcast(r,state(r));return;
  }
  const player=ws.player||c;if(!player.room||player.ws!==ws)return;const r=rooms.get(player.room);if(!r||!r.clients.has(player))return;
  if(m.type==='sync')return send(ws,state(r));
  // Do not let a lone investigator advance shared puzzles while the team is disconnected.
  // Chat and clue sharing remain available so players can coordinate reconnection.
  if(r.started&&(m.type==='chapter'||m.type==='piece')&&
     [...r.clients].filter(x=>x.ws&&x.ws.readyState===WebSocket.OPEN).length<2){
    return send(ws,{type:'error',message:'협동 진행 대기: 최소 2명의 조사원이 연결되어야 퍼즐을 진행할 수 있습니다.'});
  }
  if(m.type==='set_capacity'){if(r.started||r.host!==player)return send(ws,{type:'error',message:'방장만 게임 시작 전에 인원을 변경할 수 있습니다.'});if(![2,4,8].includes(m.capacity))return send(ws,{type:'error',message:'2·4·8인 중 선택할 수 있습니다.'});if(r.clients.size>m.capacity)return send(ws,{type:'error',message:'현재 참가자보다 적은 인원으로 변경할 수 없습니다.'});r.capacity=m.capacity;broadcast(r,state(r));return}
  if(m.type==='ready'){if(r.started)return;player.ready=!!m.ready;broadcast(r,state(r));return}
  if(m.type==='start'){if(r.host!==player)return send(ws,{type:'error',message:'방장만 시작할 수 있습니다.'});if(r.clients.size<2)return send(ws,{type:'error',message:'게임 시작에는 최소 2명의 조사원이 필요합니다.'});if([...r.clients].some(x=>!x.ws||x.ws.readyState!==WebSocket.OPEN))return send(ws,{type:'error',message:'모든 조사원이 연결된 상태여야 시작할 수 있습니다.'});if([...r.clients].some(x=>!x.ready))return send(ws,{type:'error',message:'모든 조사원이 준비해야 합니다.'});r.senseRoles=[...r.clients].map(x=>x.role).sort((a,b)=>a-b);r.started=true;r.lastActiveAt=Date.now();r.chapter={phase:r.drawerTest?'separated':'reception',solved:[],bellBy:null,inspected:{},sensoryDone:[],ecgSolved:false,evidenceFound:[],evidenceSolved:false,sensoryDigits:Array.from({length:8},()=>require('crypto').randomInt(1,10)),crossKeys:Array.from({length:8},()=>String(require('crypto').randomInt(10,100))),codes:Object.fromEntries([...r.clients].map(x=>[x.role,String(10+require('crypto').randomInt(90))]))};if(r.drawerTest)r.chapter.receptionCoop={...makeReceptionPuzzle(r),confirmed:[],g01Witnessed:[]};broadcast(r,{type:'started'});if(r.drawerTest){broadcast(r,{type:'chapter_event',event:'blackout',by:player.role});broadcast(r,{type:'horror_video',id:'G08',scope:'all'});}else broadcast(r,{type:'horror_video',id:'G01',scope:'all'});for(const member of r.clients)send(member.ws,{type:'sense_assignment',senses:assignedSenses(r,member.role).map(x=>x.sense)});broadcast(r,state(r));chapterVoiceOnce(r,1);return}
  
  if(m.type==='chapter'){
   if(!r.started)return;
   if(!r.chapter)r.chapter={phase:'reception',solved:[],bellBy:null};
   const ch=r.chapter;
   // CH01 direct entry: no legacy call-bell, sensory-key, or UI gate.
   if(ch.phase==='reception'&&m.action==='start_investigation'){
    ch.phase='separated';ch.bellBy=player.role;
    ch.receptionCoop={...makeReceptionPuzzle(r),confirmed:[],g01Witnessed:[]};
    ch.inspected=ch.inspected||{};
    broadcast(r,{type:'chapter_event',event:'blackout',by:player.role});
    broadcast(r,{type:'horror_video',id:'G08',scope:'all'});
    broadcast(r,state(r));persist();return;
   }
   
   // [수정 반영] 누락되었던 영안실(G10), 계단 8층(G12) 공포 영상 트리거를 sites 매핑에 정식 추가
   if(m.action==='horror_inspect'){
    const key=String(m.site||'');
    const sites={
     ceiling:{phase:'ch05',id:'G13',message:'폐쇄병동 천장에 붙은 형체가 고개를 돌린다.'},
     cctv:{phase:'ch04',id:'G14',message:'보안 화면에는 조사원 수보다 한 명이 더 보인다.'},
     admissions_phone:{phase:'ch04',id:'G15',message:'원무과 내선 전화가 울린다.'},
     dolls:{phase:'ch02',id:'G16',message:'인형 보관실의 인형들이 같은 방향을 바라본다.'},
     hidden_room:{phase:'ch03',id:'G17',message:'층 안내도에 없는 병실의 문이 열린다.'},
     artifact_final:{phase:'ch06',id:'G18',message:'제0유물의 균열이 최종 구역으로 번진다.'},
     bed_under:{phase:'ch02',id:'H01',message:'침대 아래에 무언가가 있다.'},
     archive_eye:{phase:'ch04',id:'H03',message:'기록함 안쪽에서 눈이 마주친다.'},
     observation_glass:{phase:'ch05',id:'H04',message:'관찰창에 손바닥이 나타난다.'},
     mortuary_drawer:{phase:'ch04',id:'G10',message:'영안실 서랍 안쪽에서 차가운 공기가 흘러나온다.'}, 
     // G12 (8층 비상계단) disabled: not part of the approved CH02/CH03 video flow.   
    };
    const site=sites[key];
    if(!site||ch.phase!==site.phase)return send(ws,{type:'horror_inspect_result',ok:false,message:'현재 조사할 수 없는 장소입니다.'});
    if(!ch.horrorWitnessed||typeof ch.horrorWitnessed!=='object')ch.horrorWitnessed={};
    const witnessKey=key+':'+player.role;
    if(ch.horrorWitnessed[witnessKey])return send(ws,{type:'horror_inspect_result',ok:true,repeat:true,message:'이미 확인한 흔적이다. 영상은 다시 재생되지 않는다.'});
    ch.horrorWitnessed[witnessKey]=true;
    send(ws,{type:'horror_inspect_result',ok:true,site:key,message:site.message});
    send(ws,{type:'horror_video',id:site.id,scope:'self'});
    persist();return;
   }
   if(m.action==='inspect'&&ch.phase==='separated'){
    const objects=['desk','cabinet','mirror','intercom'];
    if(!objects.includes(m.object))return;
    const found=ch.inspected[player.role]||(ch.inspected[player.role]=[]);
    const secondDeskLook=false; // G01 is the shared opening cinematic, never replayed on desk inspection
    if(secondDeskLook){
     const witnessed=ch.receptionCoop?.g01Witnessed||(ch.g01Witnessed||(ch.g01Witnessed=[]));
     if(!witnessed.includes(player.role)){
      witnessed.push(player.role);
      send(ws,{type:'horror_video',id:'G01',scope:'self'});
     }
    }
    // Original V172 investigation uses "inspect", not reception_clue.
    // Trigger the drawer scare from the original desk inspection as well.
    if(!found.includes(m.object))found.push(m.object);
    const ordered=[...r.clients].sort((a,b)=>a.role-b.role);
    const index=ordered.findIndex(x=>x.role===player.role),target=ordered[(index+1)%ordered.length];
    const roomNames=['접수 기록실','보관실','처치실','검사실','당직실','자료실','격리실','관찰실'];
    const narratives=[["같은 환자의 이름이 두 번 적혀 있다.", "캐비닛 안쪽에 다른 조사실의 제어판 번호가 있다.", "거울에는 접수대 뒤의 사람이 비친다.", "세 번의 짧은 신호가 들린다."], ["보관 목록의 물품 수가 맞지 않는다.", "이중 바닥에 숫자가 새겨져 있다.", "발자국이 거꾸로 이어진다.", "보관 번호를 반복한다."], ["차트의 투약 시각이 지워져 있다.", "서랍 뒤에 타인의 번호가 있다.", "없는 침대가 비친다.", "자신의 이름을 부른다."], ["존재하지 않는 검사 번호가 있다.", "봉인 안쪽에 번호가 적혀 있다.", "누군가 손바닥을 댄다.", "금속음이 세 번 들린다."], ["마지막 서명이 아직 마르지 않았다.", "보관함 아래에 타인의 번호가 있다.", "시계만 반대로 움직인다.", "신호음 대신 숨소리가 들린다."], ["한 페이지가 통째로 누락됐다.", "비밀 칸에 다른 조사실 번호가 있다.", "뒤집힌 문장이 비친다.", "오래된 녹음이 재생된다."], ["해제 날짜가 내일로 적혀 있다.", "봉인 번호가 숨겨져 있다.", "그림자가 한 번 더 움직인다.", "규칙을 거꾸로 읽는다."], ["모든 조사원의 입실 시각이 적혔다.", "필름 서랍에 다른 조사실 번호가 있다.", "유리 뒤에서 빛이 깜빡인다.", "누군가 문을 두드린다."]];
    const descriptions=Object.fromEntries(objects.map((key,i)=>[key,narratives[player.role][i]]));
    descriptions.desk += ' 제어판 규칙: '+RULES[player.role]+' 심전도 복원 순서는 기록→청각→관찰→시각→기억→시간→촉각→전파. 숫자 조각은 이 순서대로 배열한다.';
    const unlocked=found.includes('desk')&&found.includes('intercom');
    const clue=m.object==='cabinet'&&unlocked&&target?{target:target.role,code:ch.codes[target.role]}:null;
    if(m.object==='cabinet'&&!unlocked)descriptions.cabinet='이중 잠금이 걸려 있다. 기록과 내선 신호를 먼저 대조해야 열린다.';
    const sensory=assignedSenses(r,player.role).filter(x=>x.object===m.object);
    const sensoryText=sensory.map(x=>{const i=SENSES.indexOf(x.sense);return '['+x.sense+' 감각] '+x.message+' / '+SENSE_TASKS[i][0]+' — '+SENSE_TASKS[i][1]+' (정답을 전용 해독판에 입력) / 다른 감각에게 전달할 교차 열쇠 '+ch.crossKeys[i];}).join(' ');
    send(ws,{type:'inspection',object:m.object,description:descriptions[m.object]+(sensoryText?' '+sensoryText:''),sensory:sensory.map(x=>x.sense),challenges:sensory.map(x=>{const i=SENSES.indexOf(x.sense);return {index:i,title:SENSE_TASKS[i][0],question:SENSE_TASKS[i][1],shareKey:ch.crossKeys[i],needsSense:SENSES[(i+1)%8]}}),clue,room:roomNames[player.role],rule:RULES[player.role]});return;
   }
   if(m.action==='evidence_inspect'&&ch.phase==='separated'){
    const idx=Number(m.index),ev=EVIDENCE[idx];if(!ev)return;
    const owned=assignedSenses(r,player.role).some(x=>x.sense===SENSES[ev.sense]);
    const inspected=(ch.inspected[player.role]||[]).includes(ev.object);
    if(!owned||!inspected)return send(ws,{type:'evidence_result',ok:false,message:'해당 감각의 조사 지점을 먼저 확인하세요.'});
    if(!ch.evidenceFound.includes(idx))ch.evidenceFound.push(idx);
    send(ws,{type:'evidence_result',ok:true,index:idx,title:ev.title,text:ev.text,message:'증거가 공동 수사판에 등록되었습니다.'});
    broadcast(r,state(r));return;
   }
   if(m.action==='evidence_submit'&&ch.phase==='separated'){
    if(ch.evidenceFound.length!==3)return send(ws,{type:'evidence_verdict',ok:false,message:'환자 차트·감시 영상·내선 기록을 모두 확보해야 합니다.'});
    const answer=String(m.answer||'').trim();
    if(answer!=='208')return send(ws,{type:'evidence_verdict',ok:false,message:'모순의 중심이 되는 병실 번호를 다시 추리하세요.'});
    ch.evidenceSolved=true;broadcast(r,{type:'evidence_verdict',ok:true,message:'208호의 모순이 확인되었습니다. 심전도 복원을 진행하세요.'});broadcast(r,state(r));return;
   }
   if(m.action==='sense_interaction'&&ch.phase==='separated'){
    const idx=Number(m.index),sequence=String(m.sequence??'');
    if(!Number.isInteger(idx)||idx<0||idx>7||sequence.length>32)return;
    const owned=assignedSenses(r,player.role).some(x=>x.sense===SENSES[idx]);
    const inspected=(ch.inspected[player.role]||[]).includes(SENSE_OBJECTS[idx]);
    if(!owned||!inspected)return send(ws,{type:'sense_interaction_result',index:idx,ok:false,message:'담당 감각의 사물을 먼저 조사해야 합니다.'});
    const patterns={0:'SSLLL',1:'135',2:'26',3:'121512191512',4:'0241-0224',5:'41424',6:'3-2',7:'7294'};
    if(sequence!==patterns[idx])return send(ws,{type:'sense_interaction_result',index:idx,ok:false,message:'조작 순서가 일치하지 않습니다. 다시 관찰하세요.'});
    const solved=ch.senseInteractions||(ch.senseInteractions={});
    if(!(solved[player.role]||[]).includes(idx))(solved[player.role]||(solved[player.role]=[])).push(idx);
    send(ws,{type:'sense_interaction_result',index:idx,ok:true,message:'장치가 반응했습니다. 이제 해독 답을 입력하세요.'});return;
   }
   if(m.action==='sense_challenge'&&ch.phase==='separated'){
    const idx=Number(m.index),answer=String(m.answer??'').trim(),crossKey=String(m.crossKey??'').trim();
    if(!Number.isInteger(idx)||idx<0||idx>7)return;
    const owned=assignedSenses(r,player.role).some(x=>x.sense===SENSES[idx]);
    const inspected=(ch.inspected[player.role]||[]).includes(SENSE_OBJECTS[idx]);
    if(!owned||!inspected)return send(ws,{type:'sense_challenge_result',ok:false,index:idx,message:'담당 감각의 사물을 먼저 조사해야 합니다.'});
    if(!(ch.senseInteractions?.[player.role]||[]).includes(idx))return send(ws,{type:'sense_challenge_result',ok:false,index:idx,message:'먼저 감각 장치를 조작해 잠금을 해제하세요.'});
    if(crossKey!==ch.crossKeys[(idx+1)%8])return send(ws,{type:'sense_challenge_result',ok:false,index:idx,message:'다른 감각 담당자에게 교차 열쇠를 전달받아야 합니다.'});
    if(answer!==SENSE_TASKS[idx][2])return send(ws,{type:'sense_challenge_result',ok:false,index:idx,message:'추리가 맞지 않습니다. 단서를 다시 확인하세요.'});
    const solved=ch.senseChallenges||(ch.senseChallenges={});
    (solved[player.role]||(solved[player.role]=[])).push(idx);
    send(ws,{type:'sense_challenge_result',ok:true,index:idx,digit:ch.sensoryDigits[idx],message:'해독 성공. 봉인 조각을 획득했습니다.'});return;
   }
   if(m.action==='sense_submit'&&ch.phase==='separated'){
    const idx=Number(m.index),digit=Number(m.digit);
    if(!Number.isInteger(idx)||idx<0||idx>7||!Number.isInteger(digit))return;
    const owner=assignedSenses(r,player.role).some(x=>x.sense===SENSES[idx]);
    const object=SENSE_OBJECTS[idx];
    const inspected=ch.inspected[player.role]||[];
    if(!owner||!inspected.includes(object)||!(ch.senseChallenges?.[player.role]||[]).includes(idx))return send(ws,{type:'sense_result',ok:false,index:idx,message:'해당 감각의 전용 추리 문제를 먼저 풀어야 합니다.'});
    if(ch.sensoryDigits[idx]!==digit)return send(ws,{type:'sense_result',ok:false,index:idx,message:'봉인 조각이 일치하지 않습니다.'});
    if(!ch.sensoryDone.includes(idx))ch.sensoryDone.push(idx);
    send(ws,{type:'sense_result',ok:true,index:idx,message:'봉인 조각을 등록했습니다.'});
    broadcast(r,state(r));return;
   }
   if(m.action==='ecg_submit'&&ch.phase==='separated'){
    if(!ch.evidenceSolved)return send(ws,{type:'ecg_result',ok:false,message:'공동 수사판에서 세 기록의 모순을 먼저 해결하세요.'});
    if(ch.sensoryDone.length!==8)return send(ws,{type:'ecg_result',ok:false,message:'8개 감각 조각을 먼저 등록해야 합니다.'});
    if(ch.ecgSolved)return send(ws,{type:'ecg_result',ok:true,message:'심전도 복원이 완료되었습니다.'});
    const value=typeof m.answer==='string'?m.answer.trim():'';
    const expected=ECG_ORDER.map(i=>ch.sensoryDigits[i]).join('');
    if(!/^\d{8}$/.test(value)||value!==expected)return send(ws,{type:'ecg_result',ok:false,message:'심전도 배열이 일치하지 않습니다. 기록실의 배열 순서를 다시 확인하세요.'});
    ch.ecgSolved=true;broadcast(r,{type:'ecg_result',ok:true,message:'심전도 복원 완료. 각 조사실 제어판의 봉인이 풀렸습니다.'});broadcast(r,state(r));return;
   }
   if(m.action==='fragment_search'&&ch.phase==='ch04_cleared'&&String(m.site||'')==='glass'){
     if(!(r.artifactFragments||new Set()).has(3))return send(ws,{type:'fragment_result',ok:false,message:'먼저 퇴실 대장의 파편을 회수하세요.'});
     if(!(ch.ch04?.artifactRecordWitnesses||[]).length)return send(ws,{type:'fragment_result',ok:false,message:'봉인 관찰창의 제0유물 기록을 먼저 조사하세요.'});
     if(!r.artifactFragments)r.artifactFragments=new Set();
     if(r.artifactFragments.has(4))return send(ws,{type:'fragment_result',ok:true,index:4,already:true,message:'마지막 파편은 이미 등록됐습니다.'});
     r.artifactFragments.add(4);
     broadcast(r,{type:'fragment_result',ok:true,index:4,message:'기록보관실 봉인 관찰창 아래에서 마지막 파편이 발견된다. 다섯 조각이 동시에 진동한다. (팀 공동 소지품 등록)'});
     broadcast(r,state(r));enterFinalAfterCh04(r);return;
    }
    if(m.action==='fragment_search'){
    const index=FRAGMENT_PHASES.indexOf(ch.phase);
    if(index<0)return send(ws,{type:'fragment_result',ok:false,message:'아직 파편을 찾을 수 있는 구역이 아닙니다. 해당 구역의 퍼즐을 먼저 완료하세요.'});
    if(!r.artifactFragments)r.artifactFragments=new Set();
    if(r.artifactFragments.has(index))return send(ws,{type:'fragment_result',ok:true,index,already:true,message:'이미 공동 소지품에 등록된 파편입니다.'});
    if(String(m.site||'')!==FRAGMENT_SITES[index])return send(ws,{type:'fragment_result',ok:false,message:'이곳에는 파편이 없습니다. 구역의 다른 지점을 조사하세요.'});
    r.artifactFragments.add(index);
    broadcast(r,{type:'fragment_result',ok:true,index,message:FRAGMENT_DESCRIPTIONS[index]+' (팀 공동 소지품에 등록)'});
    broadcast(r,state(r));return;
   }
   if(m.action==='ch02_enter'&&ch.phase==='escaped'){
    if(!(r.artifactFragments||new Set()).has(0))return send(ws,{type:'fragment_result',ok:false,message:'이 구역의 균열의 파편을 직접 찾아 공동 소지품에 등록해야 다음 구역으로 이동할 수 있습니다.'});
    if(player!==r.host)return send(ws,{type:'ch02_result',ok:false,message:'방장만 다음 구역으로 이동할 수 있습니다.'});
    if(!ch.evidenceSolved||!ch.ecgSolved)return send(ws,{type:'ch02_result',ok:false,message:'접수실의 증거와 심전도 복원을 먼저 마쳐야 합니다.'});
    broadcast(r,{type:'chapter_transition_video',from:1,to:2,video:'H03'});
    ch.phase='ch02';ch.ch02={newVisited:{},newScareRoles:[]};
    broadcast(r,{type:'ch02_event',event:'enter',message:'208호. 비어 있다는 병실에서 호출벨이 울린다. 문틈으로 낡은 환자 차트가 밀려 나온다. 차트 상단에는 「회명병원 / 개원 1988년 / 환자번호 0208」이라고 인쇄되어 있다.'});broadcast(r,state(r));chapterVoiceOnce(r,2);return;
   }
   // CH02 rebuilt: no legacy corridor, elevator, valve or 0241 puzzle routes.
   if(ch.phase==='ch02'&&m.action==='ch02_new_inspect'){
    const site=String(m.site||'');
    if(!['certificate','ecg','eight','underbed'].includes(site))return;
    if(!ch.ch02.newVisited)ch.ch02.newVisited={};
    if(!ch.ch02.newVisited[player.role])ch.ch02.newVisited[player.role]=[];
    if(!ch.ch02.newVisited[player.role].includes(site))ch.ch02.newVisited[player.role].push(site);
    if(site==='certificate'){
     const count=[2,4,8].includes(r.capacity)?r.capacity:2;
     const role=player.role%count;
     // CH02 final design: authentic death times; the death verdicts were falsified.
     // Letter tokens remain exclusively in the bed-end identification tags (next stage).
     const records=[
      {id:'A-01',patient:'성명 불명 / 302-A',time:'02:41',cause:'심정지',stamp:'사망 확인',trace:'사망 판정 후 심전도 자료가 삭제 처리됨',revision:'원본 판정란 위에 재기입 흔적'},
      {id:'B-02',patient:'성명 불명 / 302-B',time:'02:38',cause:'호흡 정지',stamp:'사망 확인',trace:'의사 서명 시각이 원본과 일치하지 않음',revision:'의사 서명란 잉크 색상 불일치'},
      {id:'C-03',patient:'성명 불명 / 302-C',time:'03:06',cause:'다발성 장기부전',stamp:'사망 확인',trace:'사망 판정 후 활력 기록이 비공개 처리됨',revision:'직접 사인 항목의 수정 흔적'},
      {id:'D-04',patient:'성명 불명 / 302-D',time:'02:52',cause:'심폐 기능 정지',stamp:'사망 확인',trace:'기록 수정 이력에 담당자 확인 없음',revision:'사망 판정 도장 아래 다른 글씨가 비침'}
     ];
     const verification=[
      {id:'대조-01',patient:'302-A / 기록 대조',time:'02:41',cause:'사망 판정 원본 대조',stamp:'원본 확인 필요',trace:'심전도 원본과 사망 판정이 상충함',revision:'A 문서의 수정 이력 확인'},
      {id:'대조-02',patient:'302-B / 서명 대조',time:'02:38',cause:'의사 서명 대조',stamp:'원본 확인 필요',trace:'사망 시각과 서명 등록 시각이 다름',revision:'B 문서의 수정 이력 확인'},
      {id:'대조-03',patient:'302-C / 활력 대조',time:'03:06',cause:'활력 기록 대조',stamp:'원본 확인 필요',trace:'판정 이후의 활력 기록이 존재함',revision:'C 문서의 수정 이력 확인'},
      {id:'대조-04',patient:'302-D / 도장 대조',time:'02:52',cause:'판정 도장 대조',stamp:'원본 확인 필요',trace:'원본의 판정란과 재발급본이 다름',revision:'D 문서의 수정 이력 확인'}
     ];
     const assigned=count===2?[records.slice(0,2),records.slice(2,4)][role]:count===4?[records[role]]:role<4?[records[role]]:[verification[role-4]];
     send(ws,{type:'ch02_certificate',role,capacity:count,records:assigned});
    }
    if(site==='ecg'){
     // Device IDs deliberately do not identify patients: bed-end registry links them.
     const archive=[
      {device:'ECG-01',last:'03:09',signal:'정상 맥박 지속',flag:'사망 처리 후에도 기록됨'},
      {device:'ECG-02',last:'03:21',signal:'정상 맥박 지속',flag:'사망 처리 후에도 기록됨'},
      {device:'ECG-03',last:'03:17',signal:'정상 맥박 지속',flag:'사망 처리 후에도 기록됨'},
      {device:'ECG-04',last:'03:14',signal:'정상 맥박 지속',flag:'사망 처리 후에도 기록됨'}
     ];
     const count=[2,4,8].includes(r.capacity)?r.capacity:2;
     const role=player.role%count;
     // In 8-player rooms, the verification team owns the ECG originals.
     const assigned=count===2?archive.slice(role*2,role*2+2):count===4?[archive[role]]:role>=4?[archive[role-4]]:[];
     send(ws,{type:'ch02_ecg_archive',role,capacity:count,records:assigned,locked:count===8&&role<4});
    }
    if(site==='eight'){
     // Final puzzle: patients A/B/C/D -> ECG-04/01/02/03.
     // Survival durations 33/31/15/25 min; descending order A,B,D,C = DEAD.
     const tags=[
      {patient:'302-A',device:'ECG-04',letter:'D',tag:'08-A'},
      {patient:'302-B',device:'ECG-01',letter:'E',tag:'08-B'},
      {patient:'302-C',device:'ECG-02',letter:'D',tag:'08-C'},
      {patient:'302-D',device:'ECG-03',letter:'A',tag:'08-D'}
     ];
     const count=[2,4,8].includes(r.capacity)?r.capacity:2;
     const role=player.role%count;
     const assigned=count===2?tags.slice(role*2,role*2+2):count===4?[tags[role]]:role<4?[]:[tags[role-4]];
     send(ws,{type:'ch02_bed_tags',role,capacity:count,records:assigned,locked:count===8&&role<4,rule:'사망 판정 이후에도 심장 신호가 남은 시간. 가장 오래 지속된 기록부터 읽어라.'});
    }
    const firstUnderbedScare=site==='underbed'&&!ch.ch02.newScareRoles?.includes(player.role);
    send(ws,{type:'ch02_new_result',site,ok:true,videoPending:firstUnderbedScare,role:player.role,message:site==='certificate'?'사망진단서의 발급 기록이 발견되었다.':site==='ecg'?'심전도 기록에 생존 신호가 남아 있다.':site==='eight'?'침대 끝의 8번 표식 아래 문서 배열 단서가 있다.':'침대 아래의 검은 손자국이 움직인다.'});
    if(firstUnderbedScare){
     ch.ch02.newScareRoles=ch.ch02.newScareRoles||[];ch.ch02.newScareRoles.push(player.role);
     send(ws,{type:'horror_video',id:'H01',scope:'self'});
    }
    broadcast(r,state(r));persist();return;
   }
   if(ch.phase==='ch02'&&m.action==='ch02_new_solve'){
    if(String(m.answer||'').trim().toUpperCase()!=='DEAD')return send(ws,{type:'ch02_new_result',site:'answer',ok:false,message:'사망진단서의 기록을 다시 대조하세요.'});
    if(!ch.ch02.newVisited||!Object.values(ch.ch02.newVisited).some(v=>v.includes('certificate'))||!Object.values(ch.ch02.newVisited).some(v=>v.includes('ecg'))||!Object.values(ch.ch02.newVisited).some(v=>v.includes('eight'))||!Object.values(ch.ch02.newVisited).some(v=>v.includes('underbed')))return send(ws,{type:'ch02_new_result',site:'answer',ok:false,message:'네 조사 지점을 먼저 확인하세요.'});
    ch.phase='ch02_cleared';
    if(!r.artifactFragments)r.artifactFragments=new Set();
    r.artifactFragments.add(1);
    broadcast(r,{type:'ch02_new_result',site:'answer',ok:true,scene:'death_record_invalidated',artifactFragment:1,message:'PATIENT STATUS : ALIVE · 302호 봉인 해제. 제0유물 파편이 공동 수집함에 등록되었습니다.'});
    broadcast(r,{type:'chapter_transition_video',from:2,to:3,video:'G13'});
     // The completed DEAD puzzle transitions the entire room directly into CH03.
    // This avoids the legacy reception view appearing between chapter screens.
    ch.phase='ch03';
    ch.ch03={inspected:[],clues:[],failed:0,solved:false};
    broadcast(r,{type:'ch03_event',event:'enter',message:'302호의 봉인이 풀리고 엘리베이터 문이 열린다.'});
    broadcast(r,state(r));chapterVoiceOnce(r,3);persist();return;
   }
   if(ch.phase==='ch02'&&String(m.action||'').startsWith('ch02_'))return;
   if(m.action==='ch03_enter'&&ch.phase==='ch02_cleared'){
    if(!(r.artifactFragments||new Set()).has(1))return send(ws,{type:'fragment_result',ok:false,message:'이 구역의 균열의 파편을 직접 찾아 공동 소지품에 등록해야 다음 구역으로 이동할 수 있습니다.'});
    if(player!==r.host)return send(ws,{type:'ch03_result',ok:false,message:'방장만 엘리베이터를 호출할 수 있습니다.'});
     broadcast(r,{type:'chapter_transition_video',from:2,to:3,video:'G13'});
    ch.phase='ch03';ch.ch03={inspected:[],clues:[],failed:0,solved:false};
    broadcast(r,{type:'ch03_event',event:'enter',message:'엘리베이터 문이 닫힌다. 층수 표시가 지워지고, 스피커에서는 208호 환자의 이름 대신 조사원의 이름이 흘러나온다.'});broadcast(r,state(r));chapterVoiceOnce(r,3);return;
   }
   if(ch.phase==='ch03'&&m.action==='ch03_explore'){
    const object=String(m.object||'');
    const sites={panel:'층수 버튼의 숫자는 모두 지워졌다. 4층 버튼에만 네 겹의 손자국이 남아 있다. 손가락 끝이 향하는 방향은 엘리베이터 안쪽이다.',mirror:'거울 속 조사원을 세면 실제보다 한 명 많다. 다시 세려는 순간, 맨 뒤의 형체가 손가락 하나를 든다.',speaker:'스피커 뒤편에는 「제8차 복원 실험 / 2003.11.26 / 종료 불가」라고 적힌 봉인이 붙어 있다. 스피커 안쪽에 긁힌 숫자 7. 아래에는 「기억은 마지막에 남는다」라는 문장이 있다.'};
    if(!Object.hasOwn(sites,object))return send(ws,{type:'ch03_result',ok:false,message:'존재하지 않는 조사 지점입니다.'});
    if(!ch.ch03.inspected.includes(object))ch.ch03.inspected.push(object);
    send(ws,{type:'ch03_result',ok:true,message:sites[object],station:object});broadcast(r,state(r));return;
   }
   if(ch.phase==='ch03'&&m.action==='ch03_clue'){
    const station=String(m.station||'');
    const clues={log:{role:0,text:'운행 일지: 첫 숫자는 눌린 층의 번호. 마지막 숫자는 스피커 내부의 긁힌 숫자.'},reflection:{role:1,text:'반사면 분석: 가운데 숫자는 거울에 나타난 추가 인물이 펼친 손가락 수.'}};
    const clue=clues[station];if(!clue||(!r.devSolo&&player.role!==clueOwners(r)[clue.role]))return send(ws,{type:'ch03_result',ok:false,message:'다른 조사원에게 배정된 감각 기록입니다.'});
    if(!ch.ch03.clues.includes(station))ch.ch03.clues.push(station);
    send(ws,{type:'ch03_result',ok:true,message:clue.text,station});broadcast(r,state(r));return;
   }
   if(ch.phase==='ch03'&&m.action==='ch03_video'){
    if(!ch.ch03)ch.ch03={inspected:[],clues:[],failed:0,solved:false};
    if(ch.ch03.videoTriggered)return send(ws,{type:'ch03_result',ok:false,message:'엘리베이터 영상이 이미 재생 중입니다.'});
    ch.ch03.videoTriggered=true;
    ch.ch03.videoCompletedRoles=[];
    broadcast(r,{type:'horror_video',id:'G06',scope:'all'});
    broadcast(r,{type:'ch03_event',event:'video',message:'엘리베이터 안에 환자복을 입은 사람이 서 있다.'});
    broadcast(r,state(r));return;
   }
   if(ch.phase==='ch03'&&m.action==='ch03_video_done'){
    const c=ch.ch03;
    if(!c?.videoTriggered)return send(ws,{type:'ch03_result',ok:false,message:'먼저 엘리베이터 영상을 재생하십시오.'});
    if(!Array.isArray(c.videoCompletedRoles))c.videoCompletedRoles=[];
    if(!c.videoCompletedRoles.includes(player.role))c.videoCompletedRoles.push(player.role);
    send(ws,{type:'ch03_video_ack',ok:true});
    broadcast(r,state(r));return;
   }
   if(ch.phase==='ch03'&&m.action==='ch03_fragment'){
    if(!r.artifactFragments)r.artifactFragments=new Set();
    if(!r.artifactFragments.has(2)){
     r.artifactFragments.add(2);
     broadcast(r,{type:'fragment_result',ok:true,index:2,message:FRAGMENT_DESCRIPTIONS[2]+' (팀 공동 소지품에 등록)'});
    }else send(ws,{type:'fragment_result',ok:true,index:2,already:true,message:'제0유물 파편은 이미 공동 소지품에 등록되어 있습니다.'});
    broadcast(r,state(r));return;
   }
   if(ch.phase==='ch03'&&m.action==='ch03_transition_video_done'){
    const c=ch.ch03;
    if(!c?.transitionPending)return send(ws,{type:'ch03_result',ok:false,message:'아직 챕터 전환 영상이 시작되지 않았습니다.'});
    if(!Array.isArray(c.transitionWatchedRoles))c.transitionWatchedRoles=[];
    if(!c.transitionWatchedRoles.includes(player.role))c.transitionWatchedRoles.push(player.role);
    const present=[...r.clients].filter(p=>p.ws&&p.ws.readyState===WebSocket.OPEN).map(p=>p.role);
    // Chapter progression is not blocked by every player's playback acknowledgement.
    c.transitionPending=false;c.solved=true;
    ch.phase='ch04';
    ch.ch04={inspected:[],witnesses:[],votes:[],decoded:[],failed:0,solved:false};
    broadcast(r,{type:'ch03_event',event:'cleared',message:'G02 영상 전원 시청 완료. 기록보관실로 이동한다.'});
    broadcast(r,{type:'ch04_event',event:'enter',message:'서류 세 장에 같은 환자의 이름이 적혀 있다. 사망 시각은 모두 다르다. 복도 끝에서 종이가 넘어간다.'});
    broadcast(r,state(r));chapterVoiceOnce(r,4);persist();return;
   }
   if(ch.phase==='ch03'&&m.action==='ch03_submit'){
    const c=ch.ch03;
    const answers={2:'15',4:'32',8:'35'};
    const expected=answers[r.capacity]||answers[2];
    if(!c.videoTriggered)return send(ws,{type:'ch03_result',ok:false,message:'엘리베이터 제어판을 먼저 작동하십시오.'});
    if(!Array.isArray(c.videoCompletedRoles)||!c.videoCompletedRoles.includes(player.role))return send(ws,{type:'ch03_result',ok:false,message:'G06 영상을 끝까지 시청한 조사원만 운행 코드를 입력할 수 있습니다.'});
    if(String(m.answer||'').trim()!==expected){
     c.failed++;broadcast(r,{type:'ch03_event',event:'wrong',message:'잘못된 운행 코드. 엘리베이터가 아래로 급강하했다가 멈춘다.'});broadcast(r,state(r));return;
    }
    // CH03: a correct code awards the chapter artifact to the shared inventory automatically.
    if(!r.artifactFragments)r.artifactFragments=new Set();
    if(!r.artifactFragments.has(2)){
     r.artifactFragments.add(2);
     broadcast(r,{type:'fragment_result',ok:true,index:2,message:FRAGMENT_DESCRIPTIONS[2]+' (정답 승인으로 팀 공동 소지품에 자동 등록)'});
    }
    if(c.transitionPending)return send(ws,{type:'ch03_result',ok:true,message:'G02 전환 영상 시청이 진행 중입니다.'});
    c.transitionPending=true;c.transitionWatchedRoles=[];
    broadcast(r,{type:'ch03_event',event:'transition_video',video:'G02',message:'운행 코드 승인. 전 조사원이 전환 영상을 시청합니다.'});
    broadcast(r,state(r));persist();return;
   }
   if(m.action==='ch04_enter'&&ch.phase==='ch03_cleared'){
    if(!(r.artifactFragments||new Set()).has(2))return send(ws,{type:'fragment_result',ok:false,message:'이 구역의 균열의 파편을 직접 찾아 공동 소지품에 등록해야 다음 구역으로 이동할 수 있습니다.'});
    if(player!==r.host)return send(ws,{type:'ch04_result',ok:false,message:'방장만 기록보관실 문을 열 수 있습니다.'});
    ch.phase='ch04';ch.ch04={inspected:[],witnesses:[],votes:[],decoded:[],failed:0,solved:false};
    broadcast(r,{type:'ch04_event',event:'enter',message:'서류 세 장에 같은 환자의 이름이 적혀 있다. 사망 시각은 모두 다르다. 복도 끝에서 종이가 넘어간다. 이 층에는 바람이 들지 않는다.'});broadcast(r,state(r));chapterVoiceOnce(r,4);return;
   }
   if(ch.phase==='ch04'&&['ch04_inspect','ch04_decoder'].includes(m.action)){
 const object=String(m.object||'');if(!Object.hasOwn(CH04_RECORDS,object))return send(ws,{type:'ch04_result',ok:false,message:'존재하지 않는 기록입니다.'});
 if(ch04Owners(r)[object]!==player.role)return send(ws,{type:'ch04_result',ok:false,message:'다른 조사원에게 배정된 자료입니다. 팀원에게 공유를 요청하세요.'});
 if(!ch.ch04.inspected.includes(object))ch.ch04.inspected.push(object);
 send(ws,{type:'ch04_result',ok:true,message:CH04_RECORDS[object]});broadcast(r,state(r));return;
}
if(ch.phase==='ch04'&&m.action==='ch04_decode'){
 const part=String(m.part||'').toUpperCase(),answer=String(m.answer||'').trim().toUpperCase();
 const req={A:['ledger','camera','keyA'],B:['camera','call','keyB'],C:['call','tag','keyC'],D:['tag','camera','keyD']};
 if(!Object.hasOwn(req,part))return send(ws,{type:'ch04_result',ok:false,message:'해독 구획 오류'});
 if(!req[part].every(k=>ch.ch04.inspected.includes(k)))return send(ws,{type:'ch04_result',ok:false,message:'필요한 원본과 해독 자료를 먼저 확보하세요.'});
 if(answer!==CH04_ANSWERS[part]){ch.ch04.failed++;send(ws,{type:'ch04_result',ok:false,message:'해독 결과 불일치'});broadcast(r,state(r));return;}
 if(!Array.isArray(ch.ch04.decoded))ch.ch04.decoded=[];if(!ch.ch04.decoded.includes(part))ch.ch04.decoded.push(part);
 broadcast(r,{type:'ch04_event',event:'decoded',message:'구획 '+part+' 해독 완료'});broadcast(r,state(r));return;
}
   if(ch.phase==='ch04'&&m.action==='ch04_artifact_record'){
     const c=ch.ch04;if(!Array.isArray(c.artifactRecordWitnesses))c.artifactRecordWitnesses=[];
     if(!c.artifactRecordWitnesses.includes(player.role)){
      c.artifactRecordWitnesses.push(player.role);
      send(ws,{type:'ch04_result',ok:true,message:'봉인 관찰창: 열람자의 이름이 빈 칸에 새겨진다. 기록 마지막 줄의 시각이 지금으로 바뀌었다. 유리 아래에는 제0유물의 마지막 파편이 숨겨져 있다.'});
      send(ws,{type:'horror_video',id:'G04',scope:'self'});persist();
     }else send(ws,{type:'ch04_result',ok:true,message:'봉인 기록은 다시 잠겨 있다. 유리 아래 파편은 복원 완료 후 회수할 수 있다.'});
     return;
    }
    if(ch.phase==='ch04'&&m.action==='ch04_surgery_record'){
    const c=ch.ch04;
    if(!Array.isArray(c.surgeryRecordWitnesses))c.surgeryRecordWitnesses=[];
    const key=player.role;
    if(!c.surgeryRecordWitnesses.includes(key)){
     c.surgeryRecordWitnesses.push(key);
     send(ws,{type:'ch04_result',ok:true,message:'수술 기록: 환자 이송 시각은 02:41. 집도의 서명란에는 이름 대신 검은 손자국이 남아 있다. 기록을 넘기는 순간, 수술실 유리 너머에 그림자가 선다.'});
     send(ws,{type:'horror_video',id:'G09',scope:'self'});
     persist();
    }else send(ws,{type:'ch04_result',ok:true,message:'수술 기록의 마지막 장은 비어 있다. 유리에 남은 손자국만 지워지지 않았다.'});
    return;
   }
   if(ch.phase==='ch04'&&m.action==='ch04_witness'){
    const station=String(m.station||'');const witnesses={human:{role:0,text:'기록 감각: 퇴실 대장의 0은 사람 수가 아니라 「정상 퇴실」 수다. 비정상 이탈은 별도 봉인된다.'},machine:{role:1,text:'관찰 감각: CCTV의 그림자는 208호 안으로 들어갔다. 밖으로 나온 장면은 없다. 내선은 영상이 끊긴 뒤 울렸다.'}};
    const witness=witnesses[station];if(!witness||(!r.devSolo&&player.role!==clueOwners(r)[witness.role]))return send(ws,{type:'ch04_result',ok:false,message:'이 기록은 다른 조사원에게 배정되어 있습니다.'});
    if(!ch.ch04.witnesses.includes(station))ch.ch04.witnesses.push(station);
    send(ws,{type:'ch04_result',ok:true,message:witness.text});broadcast(r,state(r));return;
   }
   if(ch.phase==='ch04'&&m.action==='ch04_vote'){
    if(!r.devSolo&&[...r.clients].filter(x=>x.ws?.readyState===WebSocket.OPEN).length<2)return send(ws,{type:'ch04_result',ok:false,message:'두 조사원이 온라인이어야 합니다.'});
    const c=ch.ch04;if(!(c.artifactRecordWitnesses||[]).length)return send(ws,{type:'ch04_result',ok:false,message:'제0유물 봉인 기록(G04)을 먼저 조사해야 최종 복원이 가능합니다.'});if((c.decoded||[]).length!==4||c.witnesses.length!==2)return send(ws,{type:'ch04_result',ok:false,message:'네 구획 해독과 두 감각 기록을 먼저 확보하세요.'});
    if(String(m.answer||'').trim().toUpperCase().replace(/\s+/g,' ')!=='GOLDEN HOUR 6'){
     c.failed++;c.votes=[];broadcast(r,{type:'ch04_event',event:'wrong',message:'서류장이 동시에 벌어진다. 종이들이 바닥에 쏟아졌는데, 눈을 돌렸다 돌아보니 모든 기록이 다시 꽂혀 있다. 맨 앞의 이름만 지워졌다.'});broadcast(r,state(r));return;
    }
    if(r.devSolo){if(!c.votes.includes(player.role))c.votes.push(player.role);c.votes.push(-1)}else if(!c.votes.includes(player.role))c.votes.push(player.role);
    if(c.votes.length>=2){
      c.solved=true;ch.phase='ch04_cleared';
      if(!r.artifactFragments)r.artifactFragments=new Set();
      for(const index of [3,4])if(!r.artifactFragments.has(index)){
       r.artifactFragments.add(index);
       broadcast(r,{type:'fragment_result',ok:true,index,message:FRAGMENT_DESCRIPTIONS[index]+' (CH.04 복원 완료 · 팀 공동 소지품 자동 등록)'});
      }
      broadcast(r,{type:'ch04_event',event:'cleared',message:'GOLDEN HOUR 6 복원 완료. PATIENT STATUS: UNKNOWN. 제0유물 파편이 공동 수집함에 자동 등록됩니다.'});
      broadcast(r,state(r));enterFinalAfterCh04(r);
     }
    else broadcast(r,{type:'ch04_event',event:'vote',message:'사건 재구성에 첫 번째 조사원이 동의했다. 다른 조사원의 확인이 필요하다.'});
    broadcast(r,state(r));return;
   }
   if(ch.phase==='ch05'&&m.action==='ch05_inspect'){
    const sites={chart:'압력 기록지: 02:41 이전 정상 압력은 2→4→1. 그러나 환자 격리 직후 순서는 역전됐다.',glass:'관찰창: 왼쪽 관의 붉은 침전물은 바닥으로 가라앉는다. 가운데 관의 액체는 투명하다. 오른쪽 관의 검은 기포는 아래로 흐른다. 관을 두드리자 반대편에서도 같은 횟수로 두드린다.',plate:'경고 명판: 3번 밸브는 폐쇄. 비상 해제는 반드시 두 사람이 교대로 조작하시오.',door:'격리문 잠금장치: 「제8단계 — 잔류자 처리」. 관측값 두 개와 밸브 세 번의 교대 조작이 확인되어야 열린다.'};
    const object=String(m.object||'');if(!Object.hasOwn(sites,object))return send(ws,{type:'ch05_result',ok:false,message:'존재하지 않는 조사 지점입니다.'});
    if(!ch.ch05.inspected.includes(object))ch.ch05.inspected.push(object);
    send(ws,{type:'ch05_result',ok:true,message:sites[object]});broadcast(r,state(r));return;
   }
   if(ch.phase==='ch05'&&m.action==='ch05_artifact_record'){
    const c=ch.ch05;
    if(!c.artifactRecordWitnesses)c.artifactRecordWitnesses=[];
    const key=player.role;
    if(!c.artifactRecordWitnesses.includes(key)){
     c.artifactRecordWitnesses.push(key);
     send(ws,{type:'horror_video',id:'G04',scope:'self'});
     send(ws,{type:'ch05_result',ok:true,message:'제0유물 봉인 기록: 열람자의 이름이 빈 칸에 스스로 새겨진다. 기록 마지막 줄은 방금 전의 시간으로 바뀌어 있다.'});
    }else send(ws,{type:'ch05_result',ok:true,message:'봉인 기록은 다시 잠겨 있다. 첫 열람 때 남겨진 이름만 희미하게 보인다.'});
    return;
   }
   if(ch.phase==='ch05'&&m.action==='ch05_sample'){
    const key=String(m.sample||'');const samples={chemical:{role:0,text:'시약 반응: 붉은 침전물은 1번 밸브와 연결. 투명한 액체는 4번 밸브에 연결.'},pulse:{role:1,text:'맥박 관측: 검은 기포가 2번 밸브를 통과할 때 심박이 역행한다. 압력 기록은 마지막 순서부터 읽어야 한다.'}};
    const sample=samples[key];if(!sample||(!r.devSolo&&player.role!==clueOwners(r)[sample.role]))return send(ws,{type:'ch05_result',ok:false,message:'이 관측 기록은 다른 감각 담당자에게 배정되어 있습니다.'});
    if(!ch.ch05.samples.includes(key))ch.ch05.samples.push(key);
    send(ws,{type:'ch05_result',ok:true,message:sample.text});broadcast(r,state(r));return;
   }
   if(ch.phase==='ch05'&&m.action==='ch05_valve'){
    const c=ch.ch05,number=Number(m.number);
    if(c.inspected.length!==4||c.samples.length!==2)return send(ws,{type:'ch05_result',ok:false,message:'격리실 네 지점과 서로 다른 관측 기록 두 개를 먼저 조사하세요.'});
    if(!Number.isInteger(number)||number<1||number>4)return send(ws,{type:'ch05_result',ok:false,message:'존재하지 않는 밸브입니다.'});
    if(!r.devSolo&&c.lastRole===player.role)return send(ws,{type:'ch05_result',ok:false,message:'같은 조사원이 연속으로 밸브를 돌릴 수 없습니다.'});
    const expected=[1,4,2];
    if(number!==expected[c.valves.length]){c.failed++;c.valves=[];c.lastRole=null;broadcast(r,{type:'ch05_event',event:'wrong',message:'밸브가 헛돈다. 검은 기포가 관을 거슬러 오른다. 출입문 너머에서 세 번 두드리는 소리가 난다. 세 번째 소리는 문 바로 안쪽에서 들렸다. 조작 순서가 초기화됐다.'});broadcast(r,state(r));return;}
    c.valves.push(number);c.lastRole=player.role;
    if(c.valves.length===3){c.solved=true;ch.phase='ch05_cleared';broadcast(r,{type:'ch05_event',event:'cleared',message:'격리실의 압력이 내려간다. 관찰창 너머에는 환자가 아니라, 조사원들의 이름이 적힌 빈 침대들이 놓여 있다. 마지막 구역으로 향하는 문이 열린다.'});}
    else broadcast(r,{type:'ch05_event',event:'progress',message:'밸브가 고정됐다. 다음 조사원이 이어서 조작해야 한다.'});
    broadcast(r,state(r));return;
   }
   if(ch.phase==='ch06'&&m.action==='ch06_inspect'){
    const sites={door:'문패: 「기록되지 않은 자는 문을 통과할 수 없다.」 문에는 네 글자의 영문 입력칸과 서로 다른 두 개의 손잡이가 있다. 두 기록 담당자가 함께 봉인을 풀어야 한다.',mirror:'거울: 글자가 좌우로 뒤집혀 있다. 거울 아래에는 「반사된 순서가 아니라, 원본 기록의 첫째부터 넷째까지」라고 새겨져 있다.',clock:'정지 시계: 02:41. 유리 안쪽 검은 손자국 아래에 Ⅰ·Ⅱ·Ⅲ·Ⅳ 네 개의 홈이 있다. 시각은 사건의 흔적일 뿐, 문의 암호가 아니다.',ledger:'최종 기록: 208호의 구조 요청은 02:41에 시작되었다. 마지막 문은 병실 번호나 시각이 아닌 영문 네 글자를 요구한다. 암호는 기록 담당자의 홀수 칸과 거울 담당자의 짝수 칸을 번갈아 배치한다.'};
    const key=String(m.object||'');if(!Object.hasOwn(sites,key))return send(ws,{type:'ch06_result',ok:false,message:'존재하지 않는 조사 지점입니다.'});
    if(!ch.ch06.inspected.includes(key))ch.ch06.inspected.push(key);
    send(ws,{type:'ch06_result',ok:true,message:sites[key]});broadcast(r,state(r));return;
   }
   if(ch.phase==='ch06'&&m.action==='ch06_fragment'){
    const key=String(m.fragment||'');const roles=[...r.clients].map(x=>x.role).sort((a,b)=>a-b);
    const fragments={record:{role:roles[0],text:'기록 담당자의 최종 문장: 원본 봉인표의 첫 번째 칸은 A, 세 번째 칸은 U다. 짝수 칸은 거울 담당자만 읽을 수 있다.'},reflection:{role:roles[1],text:'거울 담당자의 최종 문장: 원본 봉인표의 두 번째 칸은 Z, 네 번째 칸은 P다. 홀수 칸은 기록 담당자만 읽을 수 있다.'}};
    const fragment=fragments[key];if(!fragment||(!r.devSolo&&fragment.role!==player.role))return send(ws,{type:'ch06_result',ok:false,message:'이 단서는 다른 조사원에게 배정되어 있습니다.'});
    if(!ch.ch06.fragments.includes(key))ch.ch06.fragments.push(key);
    send(ws,{type:'ch06_result',ok:true,message:fragment.text});broadcast(r,state(r));return;
   }
   if(ch.phase==='ch06'&&m.action==='artifact_inspect'){
    const i=Number(m.fragment), owned=[...(r.artifactFragments||[])];
    if(!Number.isInteger(i)||i<0||i>4||!owned.includes(i))return send(ws,{type:'artifact_result',ok:false,message:'아직 회수하지 못한 파편입니다.'});
    const online=[...r.clients].filter(x=>x.ws&&x.ws.readyState===WebSocket.OPEN).map(x=>x.role).sort((a,b)=>a-b);
    const all=online.length>=2?online:[...r.clients].map(x=>x.role).sort((a,b)=>a-b);
    if(!r.devSolo&&player.role!==all[i%all.length])return send(ws,{type:'artifact_result',ok:false,message:'이 파편의 판독은 다른 조사원에게 배정되었습니다.'});
    const clues=[
     '접수의 파편: 엘리베이터의 파편 바로 다음에 놓여야 한다.',
     '병동의 파편: 봉인 관찰창의 파편 바로 다음에 놓여야 한다.',
     '엘리베이터의 파편: 배열의 첫 번째 조각이다. 이곳에서 층수가 사라졌다.',
     '기록실의 파편: 배열의 마지막 조각이다. 모든 이름은 여기서 끝난다.',
     '봉인 관찰창의 파편: 접수의 파편 바로 다음에 놓여야 한다.'
    ];
    if(!ch.ch06.artifactInspected)ch.ch06.artifactInspected=[];
    if(!ch.ch06.artifactInspected.includes(i))ch.ch06.artifactInspected.push(i);
    send(ws,{type:'artifact_result',ok:true,fragment:i,message:clues[i]});broadcast(r,state(r));return;
   }
   if(ch.phase==='ch06'&&m.action==='artifact_submit'){
    const c=ch.ch06;
    if(c.artifactSolved)return send(ws,{type:'artifact_result',ok:true,message:'제0유물은 이미 복원되었습니다. 마지막 문을 조사하세요.'});
    if((r.artifactFragments||new Set()).size!==5||new Set(c.artifactInspected||[]).size!==5)return send(ws,{type:'artifact_result',ok:false,message:'다섯 파편을 모두 회수하고 담당 조사원이 판독해야 합니다.'});
    const order=String(m.order||'').replace(/[\s,>→-]/g,'');
    if(order!=='20413'){c.artifactFailed=(c.artifactFailed||0)+1;return send(ws,{type:'artifact_result',ok:false,message:'균열의 배열이 맞지 않습니다. 서로의 판독 기록을 대조하세요.'});}
    c.artifactSolved=true;broadcast(r,{type:'artifact_result',ok:true,message:'균열의 파편이 하나의 장치로 결합되었습니다. 마지막 문에 전원이 들어옵니다.'});broadcast(r,{type:'horror_video',id:'G07',scope:'all'});broadcast(r,state(r));return;
   }
   if(ch.phase==='ch06'&&m.action==='ch06_switch'){
    if(!ch.ch06.artifactSolved)return send(ws,{type:'ch06_result',ok:false,message:'제0유물 파편 다섯 개를 먼저 판독하고 복원해야 마지막 문 손잡이를 고정할 수 있습니다.'});
    if(!r.devSolo&&[...r.clients].filter(x=>x.ws?.readyState===WebSocket.OPEN).length<2)return send(ws,{type:'ch06_result',ok:false,message:'두 조사원이 온라인이어야 합니다.'});
    const c=ch.ch06;if(c.inspected.length!==4||c.fragments.length!==2)return send(ws,{type:'ch06_result',ok:false,message:'네 곳의 기록과 서로 다른 두 조사원의 최종 단서를 확보하세요.'});
    if(!r.devSolo&&c.switches.includes(player.role))return send(ws,{type:'ch06_result',ok:false,message:'이미 손잡이를 잡았습니다. 다른 조사원이 필요합니다.'});
    if(c.switches.length>=2)return;
    c.switches.push(player.role);if(r.devSolo)c.switches.push(-1);broadcast(r,{type:'ch06_event',event:'switch',message:'문 옆의 손잡이가 고정된다. 다른 조사원이 나머지 손잡이를 잡아야 한다.'});broadcast(r,state(r));return;
   }
   if(ch.phase==='ch06'&&m.action==='ch06_answer'){
    const c=ch.ch06;if(c.solved)return; if(!c.artifactSolved)return send(ws,{type:'ch06_result',ok:false,message:'균열의 파편을 먼저 복원해야 마지막 문이 열립니다.'}); if(c.switches.length<2)return send(ws,{type:'ch06_result',ok:false,message:'서로 다른 두 조사원이 손잡이를 고정해야 합니다.'});
    if(String(m.answer||'').trim().toUpperCase()!=='AZUP'){
     c.failed++;c.switches=[];broadcast(r,{type:'ch06_event',event:'wrong',message:'문이 세 번 두드려진다. 손잡이가 풀리고 두 사람의 그림자가 거울에서 사라진다.'});broadcast(r,state(r));return;
    }
    c.solved=true;ch.phase='finished';broadcast(r,{type:'horror_video',id:'G18',scope:'all'});broadcast(r,{type:'ch06_event',event:'cleared',message:'여덟 번째 문이 열린다. 기록에는 208호가 비어 있었다. 그러나 구조 요청은 그 안에서 시작됐다. 문 너머에는 회명병원의 처음 접수실이 있다. END — 귀환.'});broadcast(r,state(r));return;
   }
   // V176: only the explicit "start_investigation" action launches G08 and separation.
   // Touching a ledger, mirror, cabinet or desk may never launch a cinematic.
   if(ch.phase==='reception'&&['reception_clue','inspect'].includes(m.action)){
    send(ws,{type:'chapter_notice',message:'접수실 조사 시작을 누른 다음 사물을 조사해 주세요.'});return;
   }
   // Fixed, object-led cooperative CH01: every investigator sees only one half
   // of each clue. No random room codes or sensory-key input.
   if(m.action==='reception_clue'&&ch.phase==='separated'){
    const p=ch.receptionCoop;if(!p)return;
    const object=String(m.object||'');
    if(!['mirror','cabinet','ledger'].includes(object))return;
    const position=p.roles.indexOf(player.role);
    if(position<0)return;
    if(object==='mirror'){
      send(ws,{type:'reception_clue',object,label:'거울 · 검은 얼룩',shadowCount:p.shadows[position],lines:['거울 표면에 검은 그림자 덩어리 '+p.shadows[position]+'개가 맺혀 있다.','각 조사원이 본 개수를 모두 더하라. 합계가 두 자리라면 앞의 두 칸을 채운다.']});
    }else if(object==='cabinet'){
      const hidden=p.cabinet[position];
      const sequence=p.cabinet.map((digit,i)=>i===position?'○':String(digit)).join('  ');
      send(ws,{type:'reception_clue',object,label:'캐비닛 · 분리 기록',popup:true,sequence,missingIndex:position,lines:['분리된 조사원 '+(position+1)+'번의 캐비닛 기록: '+sequence,'가려진 ○의 값은 '+hidden+'이다.','다른 조사원들의 ○ 숫자를 모두 합한 뒤 일의 자리를 봉인 번호에 입력하라.']});
    }else if(object==='ledger'){
      const entry=p.dates[position];
      send(ws,{type:'reception_clue',object,label:'접수 명부',date:entry.date,people:entry.people,lines:['11월 '+entry.date+'일 입실 '+entry.people+'명.','전원의 날짜별 입실 인원을 합하라. 합계의 마지막 '+p.ledgerCount+'자리가 봉인의 마지막 칸들이다.']});
    }
    return;
   }
   if(m.action==='reception_submit'&&ch.phase==='separated'){
    const p=ch.receptionCoop;if(!p)return;
    const attempt=String(m.answer||'').trim();
    if(!/^[0-9]+$/.test(attempt)||attempt.length!==(p.answerLength||p.answer.length))return send(ws,{type:'reception_result',ok:false,message:'봉인 번호 '+(p.answerLength||p.answer.length)+'자리를 입력하세요.'});
    if(attempt!==p.answer)return send(ws,{type:'reception_result',ok:false,message:'틀린 칸이 있습니다. 거울·캐비닛·명부를 팀원과 다시 대조하세요.'});
    if(!p.confirmed.includes(player.role))p.confirmed.push(player.role);
    broadcast(r,{type:'reception_result',ok:true,message:'봉인 번호 일치. 조사원 한 명의 확인으로 공동 봉인을 해제합니다.'});
    {
     const online=[...r.clients].filter(c=>c.ws?.readyState===WebSocket.OPEN);
     ch.ecgSolved=true;ch.evidenceSolved=true;ch.solved=online.map(c=>c.role);ch.phase='escaped';
     broadcast(r,{type:'chapter_event',event:'escape'});
     // Preserve the real CH01 fragment in the shared artifact collection.
     if(!r.artifactFragments)r.artifactFragments=new Set();
     if(!r.artifactFragments.has(0)){
      r.artifactFragments.add(0);
      broadcast(r,{type:'fragment_result',ok:true,index:0,message:FRAGMENT_DESCRIPTIONS[0]+' (팀 공동 소지품에 등록)'});
     }
     broadcast(r,{type:'reception_result',ok:true,complete:true,message:'접수대 봉인 해제. 제0유물 파편을 공동 소지품에 등록했습니다. 208호로 이동합니다.'});
     broadcast(r,{type:'chapter_transition_video',from:1,to:2,video:'H03'});
     ch.phase='ch02';ch.ch02={found:[],switches:[],unlocked:false,explored:[],alarm:false,pressure:[],pressureSolved:false,pressureLastRole:null};
     broadcast(r,{type:'ch02_event',event:'enter',message:'208호. 비어 있다는 병실에서 호출벨이 울린다. 문틈으로 낡은 환자 차트가 밀려 나온다. 차트 상단에는 「회명병원 / 개원 1988년 / 환자번호 0208」이라고 인쇄되어 있다.'});
     chapterVoiceOnce(r,2);
    }
    broadcast(r,state(r));persist();return;
   }
   if(m.action==='solve'&&ch.phase==='separated'){
    if(ch.solved.includes(player.role))return;
    if(!ch.ecgSolved)return send(ws,{type:'chapter_event',event:'sense_locked'});
    const answer=String(m.answer||'').trim();
    const expected=ch.codes?.[player.role] ? panelAnswer(player.role,ch.codes[player.role]) : null;
    if(answer!==expected)return send(ws,{type:'chapter_event',event:'wrong'});
    ch.solved.push(player.role);broadcast(r,{type:'chapter_event',event:'solved',by:player.role});
    const online=[...r.clients].filter(x=>x.ws&&x.ws.readyState===WebSocket.OPEN);
    if((r.devSolo||online.length>=2)&&online.every(x=>ch.solved.includes(x.role))){ch.phase='escaped';broadcast(r,{type:'chapter_event',event:'escape'});}
    broadcast(r,state(r));return;
   }
   return;
  }
  if(m.type==='chat'){if(typeof m.message!=='string')return;const msg=m.message.trim().slice(0,180);if(!msg)return;const item={role:player.role,character:player.character,message:msg};r.chat.push(item);r.chat=r.chat.slice(-25);broadcast(r,{type:'chat',item});
    const echoPhase=r.chapter?.phase||'';
    const echoChapter=echoPhase==='blackout'||echoPhase==='reception'||echoPhase==='escaped'?'ch01':(echoPhase.match(/^ch0[2-6]/)||[])[0];
    if(r.started&&echoChapter&&echoPhase!=='finished'&&msg.length>=2&&msg.length<=100){
      const ch=r.chapter;
      if(ch.echoChapter!==echoChapter){ch.echoChapter=echoChapter;ch.echoCount=0;ch.echoLastAt=0;}
      const max=echoChapter==='ch03'||echoChapter==='ch05'?2:1;
      const now=Date.now();
      if(ch.echoCount<max&&now-(ch.echoLastAt||0)>30000&&require('crypto').randomInt(100)<35){
        ch.echoCount++;ch.echoLastAt=now;
        broadcast(r,{type:'hospital_echo',chapter:echoChapter,message:msg,sequence:ch.echoCount});
      }
    }
    persist();return}
  if(m.type==='clue'){if(typeof m.clue!=='string')return;broadcast(r,{type:'clue',role:player.role,clue:m.clue.slice(0,160)});return}
  if(m.type==='piece'){
    if(!r.started||!Number.isInteger(m.piece)||m.piece<0||m.piece>3)return;
    const phase=r.chapter?.phase||'';
    const allowed=[['ch02_cleared','ch03','ch03_cleared','ch04','ch04_cleared','ch05','ch05_cleared','ch06','finished'],['ch03_cleared','ch04','ch04_cleared','ch05','ch05_cleared','ch06','finished'],['ch04_cleared','ch05','ch05_cleared','ch06','finished'],['ch05_cleared','ch06','finished']];
    if(!(m.piece===3&&phase==='ch04_cleared')&&!allowed[m.piece].includes(phase))return send(ws,{type:'error',message:'아직 해당 인형 부품을 회수할 수 없습니다. 챕터 조사를 완료하세요.'});
    if(r.pieces.has(m.piece))return;
    r.pieces.add(m.piece);
    broadcast(r,{type:'piece',pieces:[...r.pieces].sort(),complete:r.pieces.size===4});
    if(r.pieces.size===4){broadcast(r,{type:'horror_video',id:'G03',scope:'all'});broadcast(r,{type:'doll_event',event:'complete',message:'울음이 멎는다. 인형이 천천히 웃는다. 「기록된 숫자만 믿지 마. 마지막 문 앞에서는 누가 먼저 들어왔는지 확인해.」'});}
    broadcast(r,state(r));return;
   }
 });ws.on('close',()=>{const p=ws.player||c;if(p.ws===ws)leave(p)});ws.on('error',()=>{const p=ws.player||c;if(p.ws===ws)leave(p)});
});
server.listen(PORT,'0.0.0.0',()=>console.log('Hoemyeong multiplayer v6.0-test listening on '+PORT));
