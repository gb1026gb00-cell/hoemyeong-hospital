'use strict';
/* V175 additive entry gate. Does not change approved V172 game markup or puzzle logic. */
(()=>{
 const $=id=>document.getElementById(id);
 let started=false,enteredLobby=false,waitingRoom=false;
 function gate(){return $('hmV175Gate')}
 function setGate(show){const g=gate();if(g)g.hidden=!show;}
 function gameStarted(){started=true;waitingRoom=false;setGate(false)}
 function lobby(){
  if(started)return;
  enteredLobby=true;waitingRoom=false;
  const panel=$('hmCoopPanel');if(panel)panel.hidden=true;
  setGate(true);
 }
 function openRoom(mode){
  waitingRoom=true;setGate(false);
  const panel=$('hmCoopPanel');
  const open=$('hmCoopOpen');
  if(open)open.click();
  if(panel)panel.hidden=false;
  const room=$('hmRoom');
  if(room&&mode==='create'&&!room.value.trim()){
   room.value='HM'+Math.random().toString(36).slice(2,8).toUpperCase();
   room.dispatchEvent(new Event('input',{bubbles:true}));
  }
  if(room&&mode==='join'){room.focus();room.select();}
 }
 function build(){
  if(gate())return;
  const style=document.createElement('style');
  style.textContent=`#hmV175Gate[hidden]{display:none!important}#hmV175Gate{position:fixed;inset:0;z-index:99990;overflow:auto;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#0b0911ed,#160e20f7),url('reception.webp') center/cover;color:#eae2ed;font-family:system-ui,sans-serif;padding:20px;box-sizing:border-box}#hmV175Gate .hm-lobby{width:min(100%,460px);padding:32px 22px;border:1px solid #625269;border-radius:18px;background:#110d19e8;box-shadow:0 16px 65px #000d;text-align:center}#hmV175Gate h1{font-family:serif;font-size:clamp(32px,8vw,48px);font-weight:500;letter-spacing:.1em;margin:10px 0}#hmV175Gate .hm-eyebrow{font-size:11px;letter-spacing:.3em;color:#b5a6bf}#hmV175Gate .hm-sub{font-size:13px;color:#c3b5cb;margin:0 0 30px}#hmV175Gate button{display:block;width:100%;padding:15px 12px;margin:11px 0;border:1px solid #766381;border-radius:10px;background:#291e35;color:#f4ecf8;font-size:15px;font-weight:700;cursor:pointer;touch-action:manipulation}#hmV175Gate button:disabled{opacity:.5;cursor:not-allowed}#hmV175Gate small{display:block;color:#aa9bb5;margin-top:22px;font-size:12px;line-height:1.6}`;
  document.head.append(style);
  const g=document.createElement('div');g.id='hmV175Gate';g.hidden=true;g.setAttribute('role','dialog');g.setAttribute('aria-label','회명병원 메인 로비');
  g.innerHTML='<div class="hm-lobby"><div class="hm-eyebrow">THE EIGHTH DOOR</div><h1>回明病院</h1><p class="hm-sub">당신의 입원 기록이 발견되었습니다.</p><button type="button" id="hmV175Create">새로운 조사실 만들기</button><button type="button" id="hmV175Join">초대 코드로 입장</button><button type="button" id="hmV175Find" disabled>공개 조사실 찾기 · 준비 중</button><small>2 · 4 · 6 · 8인 협동 전용<br>모든 조사원이 준비한 뒤 게임을 시작할 수 있습니다.</small></div>';
  document.body.append(g);
  $('hmV175Create').onclick=()=>openRoom('create');
  $('hmV175Join').onclick=()=>openRoom('join');
  const close=$('hmCoopClose');
  if(close)close.addEventListener('click',()=>{if(!started&&enteredLobby)queueMicrotask(()=>{waitingRoom=false;setGate(true);});});
  const intro=$('introCover');
  if(intro){
   const obs=new MutationObserver(()=>{if(!intro.isConnected||intro.classList.contains('fade-out')){obs.disconnect();lobby();}});
   obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
   if(!intro.isConnected||intro.classList.contains('fade-out')){obs.disconnect();lobby();}
  }else{
   const video=$('introVideo')||document.querySelector('video');
   if(video&&!video.ended){video.addEventListener('ended',lobby,{once:true});}
   else lobby();
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});else build();
 window.addEventListener('message',()=>{},false);
 document.addEventListener('hm-v175-started',gameStarted);
 document.addEventListener('hm-v175-state',e=>{
  if(e.detail?.started)gameStarted();
  else if(enteredLobby&&!waitingRoom&&!started)setGate(true);
 });
})();
