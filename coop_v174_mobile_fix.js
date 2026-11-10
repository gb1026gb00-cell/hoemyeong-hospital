'use strict';
/* V174 additive mobile co-op UI bridge; approved scenes/puzzles untouched. */
(()=>{
 const $=id=>document.getElementById(id);
 let active=false,phase='reception',socket=null;
 let startedOnce=false;
 const NativeWS=window.WebSocket;
 function hideLobby(){const p=$('hmCoopPanel');if(p)p.hidden=true;}
 function showConnectionStatus(message){let el=$('hmV174ConnectionStatus');if(!el){el=document.createElement('div');el.id='hmV174ConnectionStatus';el.setAttribute('role','alert');el.style.cssText='position:fixed;top:12px;left:12px;right:12px;z-index:99980;padding:13px 16px;border:1px solid #d1a2a2;border-radius:10px;background:#29151df2;color:#fff;font:14px system-ui;text-align:center;pointer-events:none';document.body.append(el);}el.textContent=message;el.hidden=!message;}
 function updateConnectionStatus(){showConnectionStatus(startedOnce&&(!active||!socket||socket.readyState!==NativeWS.OPEN)?'협동 서버 연결이 끊어졌습니다. 팀원과 연결을 복구하기 전에는 진행하지 마세요.':'');}
 function updateBell(){const b=$('hmV174Bell');if(!b)return;b.hidden=!active||phase!=='reception';}
 class CoopSocket extends NativeWS{
  constructor(...args){super(...args);socket=this;
   this.addEventListener('message',ev=>{let m;try{m=JSON.parse(ev.data)}catch{return}
    if(m.type==='started'||(m.type==='state'&&m.started===true)|| (m.type==='joined'&&m.started===true)){active=true;startedOnce=true;hideLobby();updateConnectionStatus();document.dispatchEvent(new Event('hm-v175-started'));}
    if(m.type==='state'||m.type==='joined'){active=!!m.started;phase=m.chapter?.phase||phase;updateBell();updateConnectionStatus();document.dispatchEvent(new CustomEvent('hm-v175-state',{detail:{started:active}}));}
    if(m.type==='horror_video'&&m.id==='G08')playForcedSeparation();
    if(m.type==='chat'){const box=$('hmV174ChatLog');if(box){const line=document.createElement('div');line.textContent=(Number.isInteger(m.item?.character)&&m.item.character>=0&&m.item.character<8?['홍중','성화','윤호','여상','산','민기','우영','종호'][m.item.character]+': ':(m.item?.role!==undefined?'조사원 '+(m.item.role+1)+': ':''))+(m.item?.text||m.item?.message||'');box.append(line);box.scrollTop=box.scrollHeight;}}
   });
   this.addEventListener('close',()=>{if(socket===this){active=false;updateBell();updateConnectionStatus();}});
   this.addEventListener('open',()=>{if(socket===this)updateConnectionStatus();});
  }
 }
 // The server already broadcasts G08 on the bell action. Add the approved
 // corrupted CH01 voice to the actual G08 playback, not to an unrelated timer.
 const separationVoice=new Audio('https://gb1026gb00-cell.github.io/hoemyeong-hospital/CH01_reverse_corrupted.mp3');
 separationVoice.preload='auto';
 let pendingSeparation=false;
 function soundVolume(){const enabled=$('hmSoundEnabled'),volume=$('hmSoundVolume');return enabled&&!enabled.checked?0:Math.max(0,Math.min(1,Number(volume?.value??65)/100));}
 function startSeparationVoice(){if(!pendingSeparation)return;pendingSeparation=false;separationVoice.pause();separationVoice.currentTime=0;separationVoice.volume=soundVolume();separationVoice.muted=soundVolume()===0;separationVoice.play().catch(()=>{pendingSeparation=true;});}
 function armSeparation(){pendingSeparation=true;const v=$('hmHorrorVideo');if(v&&!v.paused&&!v.ended)startSeparationVoice();}
 document.addEventListener('DOMContentLoaded',()=>{
  const v=$('hmHorrorVideo');
  if(v){v.addEventListener('playing',()=>{if(pendingSeparation)startSeparationVoice();});
   v.addEventListener('ended',()=>{separationVoice.pause();pendingSeparation=false;});
   v.addEventListener('error',()=>{separationVoice.pause();pendingSeparation=false;});}
  const start=$('hmVideoStart');if(start)start.addEventListener('click',()=>{if(pendingSeparation)startSeparationVoice();});
  const bell=document.querySelector('[data-action="bell"]');
  if(bell)bell.addEventListener('click',()=>{separationVoice.load();},{passive:true});
 },{once:true});
 // A dedicated full-screen G08 transition prevents the reception scene from
 // appearing immediately while the original media player fails or is blocked.
 let separationPlaying=false;
 function playForcedSeparation(){
  if(separationPlaying)return;
  separationPlaying=true;
  const overlay=document.createElement('div');
  overlay.id='hmForcedSeparation';
  overlay.style.cssText='position:fixed;inset:0;z-index:999999;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;color:#f3dbe6';
  const video=document.createElement('video');
  video.playsInline=true;video.preload='auto';video.controls=false;
  video.style.cssText='width:100%;height:100%;object-fit:contain';
  video.src='https://gb1026gb00-cell.github.io/hoemyeong-hospital/G08.mp4';
  const action=document.createElement('button');
  action.type='button';action.textContent='강제 분리 영상 재생';
  action.style.cssText='position:absolute;bottom:12%;padding:14px 22px;border:1px solid #9e5263;border-radius:10px;background:#2c131d;color:white;font:700 15px system-ui';
  action.hidden=true;
  overlay.append(video,action);document.body.append(overlay);
  let done=false;
  const finish=()=>{if(done)return;done=true;video.pause();separationVoice.pause();overlay.remove();separationPlaying=false;};
  video.addEventListener('playing',()=>{action.hidden=true;pendingSeparation=true;startSeparationVoice();});
  video.addEventListener('ended',finish);
  video.addEventListener('error',()=>{action.hidden=false;action.textContent='영상 로드 실패 · 조사 계속하기';action.onclick=finish;});
  action.addEventListener('click',()=>{if(video.error){finish();return;}video.play().catch(()=>{action.hidden=false;});});
  video.volume=soundVolume();video.muted=soundVolume()===0;
  video.play().catch(()=>{action.hidden=false;});
 }
 // G08 is owned by the transition above; all other approved horror videos
 // continue through the original V172 media handler unchanged.
 function installG08MediaRouting(){
  const media=window.hmMedia;
  if(!media||typeof media.handle!=='function'||media.__hmG08Routed)return;
  const original=media.handle.bind(media);
  media.handle=function(message){if(message?.type==='horror_video'&&message.id==='G08')return;return original(message);};
  media.__hmG08Routed=true;
 }
 installG08MediaRouting();

 // CH01 guidance is additive: all eight existing server-validated puzzles remain intact.
 const senses=['청각','촉각','시각','기록','시간','전파','관찰','기억'];
 const objects=['내선 기록','거울','거울','접수 기록','접수 기록','내선 기록','잠긴 보관함','거울'];
 const rules=[
  '짧은 신호는 S, 긴 신호는 L로 적고, 들리는 순서대로 이어 붙이세요.',
  '첫 번째 돌기 행을 왼쪽부터 읽어 숫자를 이어 붙이세요.',
  '거울에 비친 숫자를 실제 방향으로 되돌린 뒤, 숫자 두 개를 붙여 쓰세요.',
  '명부에 등장한 접수 번호를 위에서 아래 순서대로, 구분 기호 없이 이어 붙이세요.',
  '당직 일지와 멈춘 시계의 시각을 각각 네 자리로 쓰고, 가운데에 -를 넣으세요.',
  '호출 부호에서 숫자만 순서대로 적으세요. 하이픈은 빼세요.',
  '감시 영상의 인원과 거울 속 인원을 차례로 쓰고 가운데 -를 넣으세요.',
  '처음 확인한 네 자리 배열을 순서대로 이어 붙이세요.'
 ];
 function enhanceCh01(){
  const panel=$('ch01PuzzlePanel');if(!panel||$('hmCh01Guide'))return;
  const index=$('senseIndex');if(!index)return;
  const guide=document.createElement('section');guide.id='hmCh01Guide';
  guide.style.cssText='margin:12px 0;padding:13px;border:1px solid #80648e;border-radius:10px;background:#231a2b;color:#eee0f3;font:13px/1.65 system-ui;white-space:normal';
  index.closest('label')?.before(guide);
  const sequence=$('senseSequence'),cross=$('senseCrossKey'),digit=$('senseDigit');
  const update=()=>{
   const i=Number(index.value),valid=Number.isInteger(i)&&i>=0&&i<8;
   if(!valid){guide.textContent='감각 번호는 0~7 중 하나를 선택하세요.';return;}
   const next=(i+1)%8;
   guide.innerHTML='<b>선택한 감각: '+senses[i]+' (번호 '+i+')</b><div>① 현장에서 <b>'+objects[i]+'</b>을 먼저 조사하세요.</div><div>② 장치 조작 순서: '+rules[i]+'</div><div>③ 장치 조작 버튼을 누른 뒤, 문제의 답을 해독 답 칸에 입력하세요.</div><div>④ <b>'+senses[next]+' 감각 담당자</b>에게 교차 열쇠를 받아 입력하세요. 내 화면의 공유 열쇠는 그 담당자에게 전달하는 값이지, 내 입력값이 아닙니다.</div><div>⑤ 해독 성공 메시지에 나온 숫자를 아래 숫자 조각 칸에 옮기고 등록하세요.</div>';
   if(sequence)sequence.placeholder=rules[i];
   if(cross)cross.placeholder=senses[next]+' 담당자에게 받은 교차 열쇠';
   if(digit)digit.placeholder='해독 성공 메시지의 숫자';
  };
  index.addEventListener('input',update);index.addEventListener('change',update);update();
  const caption=document.createElement('div');caption.style.cssText='font-size:12px;color:#cbbbd4;margin:5px 0 10px';caption.textContent='감각 번호: 청각 0 · 촉각 1 · 시각 2 · 기록 3 · 시간 4 · 전파 5 · 관찰 6 · 기억 7';index.closest('label')?.append(caption);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceCh01,{once:true});else enhanceCh01();
 window.WebSocket=CoopSocket;
 // Only the approved 2/4/6/8-person capacities are selectable.
 function normalizeCapacityControls(){
  document.querySelectorAll('select').forEach(select=>{
   const options=[...select.options];
   const values=options.map(o=>Number(o.value));
   if(values.filter(n=>Number.isInteger(n)&&n>=2&&n<=8).length<4)return;
   if(!values.includes(2)||!values.includes(8))return;
   for(const option of options){const n=Number(option.value);if([3,5,7].includes(n))option.remove();}
   if([3,5,7].includes(Number(select.value))){select.value='2';select.dispatchEvent(new Event('change',{bubbles:true}));}
  });
  document.querySelectorAll('input[type="number"]').forEach(input=>{
   if(Number(input.min)===2&&Number(input.max)===8){input.step='2';input.addEventListener('change',()=>{if([3,5,7].includes(Number(input.value)))input.value=String(Math.max(2,Math.min(8,Number(input.value)-1)));});}
  });
 }
 function useSameOriginCoopEndpoint(){
  const input=$('hmEndpoint');
  if(!input)return;
  const protocol=location.protocol==='https:'?'wss:':'ws:';
  const endpoint=protocol+'//'+location.host;
  // A test build must never accidentally connect players to the production room server.
  input.value=endpoint;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function initializeCoopControls(){useSameOriginCoopEndpoint();normalizeCapacityControls();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeCoopControls,{once:true});
 else initializeCoopControls();
 const scene=document.querySelector('.scene');
 if(scene){
  // The approved reception scene already owns the bell and its server-side action.
  // Keep exactly one bell, preserving the original click handler.
  const originalBell=scene.querySelector('[data-action="bell"]');
  if(originalBell){
   originalBell.textContent='🔔';
   originalBell.setAttribute('aria-label','금이 간 호출벨 · 강제 분리');
   originalBell.title='호출벨을 누르면 조사원들이 강제로 분리됩니다';
   originalBell.style.cssText+=';min-width:62px;min-height:62px;border:2px solid #7e343e;border-radius:50%;background:radial-gradient(circle at 35% 25%,#66535d 0%,#24151d 42%,#08070b 76%);color:#e5c6cc;font-size:27px;text-shadow:0 0 10px #f22;box-shadow:0 0 0 3px #1b1018,0 0 20px #9e182f99,inset -5px -7px 12px #000;animation:hmBellPulse 3.4s ease-in-out infinite;z-index:20;';
   const style=document.createElement('style');style.textContent='@keyframes hmBellPulse{0%,88%,100%{filter:brightness(.72);box-shadow:0 0 0 3px #1b1018,0 0 12px #9e182f77,inset -5px -7px 12px #000}90%,94%{filter:brightness(1.5);box-shadow:0 0 0 3px #1b1018,0 0 28px #e22a4e,inset -5px -7px 12px #000}}';document.head.append(style);
  }
  const b=document.createElement('button');b.type='button';b.id='hmV174Bell';b.textContent='🔔 호출벨';b.setAttribute('aria-label','접수대 호출벨 누르기');b.hidden=true;
  b.style.cssText='position:absolute;left:43%;top:74%;z-index:16;border:1px solid #b79acb;border-radius:22px;padding:10px 13px;background:#201528e8;color:#f7ebff;font:700 14px system-ui;box-shadow:0 0 14px #6d458a88;touch-action:manipulation;';
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!active||!socket||socket.readyState!==NativeWS.OPEN)return;socket.send(JSON.stringify({type:'chapter',action:'bell'}));});
  if(originalBell){b.hidden=true;}else{scene.append(b);}
 }
 const chatButton=document.querySelector('[data-menu="chat"]');
 if(chatButton)chatButton.addEventListener('click',e=>{
  if(!active)return;
  e.preventDefault();e.stopImmediatePropagation();
  let box=$('hmV174Chat');if(!box){
   box=document.createElement('section');box.id='hmV174Chat';box.setAttribute('role','dialog');box.setAttribute('aria-label','협동 대화');
   box.style.cssText='position:fixed;z-index:350;inset:auto 12px calc(85px + env(safe-area-inset-bottom)) 12px;max-height:55vh;overflow:auto;background:#211729;color:#fff;border:1px solid #9178a3;border-radius:14px;padding:15px;box-shadow:0 10px 35px #000b';
   box.innerHTML='<strong>팀 대화</strong><button type="button" id="hmV174ChatClose" style="float:right">닫기 ×</button><div id="hmV174ChatLog" style="max-height:28vh;overflow:auto;margin:12px 0;white-space:pre-wrap"></div><div style="display:flex;gap:7px"><input id="hmV174ChatInput" maxlength="180" placeholder="팀원에게 메시지" style="flex:1;min-width:0;padding:10px;background:#120f18;color:white;border:1px solid #9178a3;border-radius:8px"><button id="hmV174ChatSend" type="button">전송</button></div>';
   document.body.append(box);
   $('hmV174ChatClose').onclick=()=>box.hidden=true;
   const send=()=>{const input=$('hmV174ChatInput');const value=input.value.trim();if(value&&socket?.readyState===NativeWS.OPEN){socket.send(JSON.stringify({type:'chat',message:value}));input.value='';}};
   $('hmV174ChatSend').onclick=send;$('hmV174ChatInput').onkeydown=e=>{if(e.key==='Enter')send();};
  }
  box.hidden=false;
 },true);
})();
