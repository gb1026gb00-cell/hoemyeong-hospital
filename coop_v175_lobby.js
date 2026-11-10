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
  if(panel){panel.hidden=false;panel.dataset.entryMode=mode;}
  const heading=panel?.querySelector('h2');if(heading)heading.textContent=mode==='join'?'조사원 선택 · 대기실':'새로운 조사실 · 대기실';
  const joinButton=$('hmJoin');if(joinButton)joinButton.textContent=mode==='join'?'조사실 입장':'조사실 만들기';
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
  style.textContent+=`#hmCoopPanel[data-entry-mode="join"] #hmEndpoint,#hmCoopPanel[data-entry-mode="join"] #hmRoom,#hmCoopPanel[data-entry-mode="join"] #hmCapacity{display:none!important}#hmCoopPanel[data-entry-mode="join"] label:has(+ #hmEndpoint),#hmCoopPanel[data-entry-mode="join"] label:has(+ #hmRoom),#hmCoopPanel[data-entry-mode="join"] label:has(+ #hmCapacity){display:none!important}#hmCoopPanel[data-entry-mode="join"] div:has(>label> #hmRoom),#hmCoopPanel[data-entry-mode="join"] div:has(>label> #hmCapacity){display:none!important}#hmCoopPanel[data-entry-mode="join"] div:has(>label + #hmRoom),#hmCoopPanel[data-entry-mode="join"] div:has(>label + #hmCapacity){display:none!important}#hmCoopPanel[data-entry-mode="join"] #hmCoopStatus,#hmCoopPanel[data-entry-mode="join"] #hmCoopMembers{margin-top:14px}#hmCoopPanel[data-entry-mode="join"] #hmJoin{background:#51385f}#hmCoopPanel[data-entry-mode="join"] #hmStart{display:none!important}`;
  document.head.append(style);
  const g=document.createElement('div');g.id='hmV175Gate';g.hidden=true;g.setAttribute('role','dialog');g.setAttribute('aria-label','회명병원 메인 로비');
  g.innerHTML='<div class="hm-lobby"><div class="hm-eyebrow">THE EIGHTH DOOR</div><h1>回明病院</h1><p class="hm-sub">당신의 입원 기록이 발견되었습니다.</p><button type="button" id="hmV175Create">새로운 조사실 만들기</button><button type="button" id="hmV175Join">초대 코드로 입장</button><button type="button" id="hmV175Find" disabled>공개 조사실 찾기 · 준비 중</button><small>2 · 4 · 6 · 8인 협동 전용<br>모든 조사원이 준비한 뒤 게임을 시작할 수 있습니다.</small></div>';
  document.body.append(g);
  const entry=document.createElement('div');entry.id='hmV176CodeEntry';entry.hidden=true;entry.setAttribute('role','dialog');entry.setAttribute('aria-label','초대 코드 입력');
  entry.innerHTML='<div class="hm-lobby"><div class="hm-eyebrow">THE EIGHTH DOOR</div><h1 style="font-size:30px">초대 코드로 입장</h1><p class="hm-sub">전달받은 조사실 코드를 입력해 주세요.</p><label for="hmV176CodeInput" style="display:block;text-align:left;font-size:13px;margin-bottom:8px">조사실 코드</label><input id="hmV176CodeInput" maxlength="32" autocomplete="off" autocapitalize="characters" placeholder="HMXXXXXX" style="width:100%;box-sizing:border-box;padding:15px;border:1px solid #766381;border-radius:10px;background:#241a2f;color:white;font-size:18px;letter-spacing:.1em;text-transform:uppercase"><p id="hmV176CodeError" role="alert" style="color:#f4b4ba;font-size:12px"></p><button type="button" id="hmV176CodeContinue">계속하기</button><button type="button" id="hmV176CodeBack" style="background:transparent">메인 로비로 돌아가기</button><small>코드 확인 후 조사원을 선택하고 입장합니다.</small></div>';
  entry.style.cssText='position:fixed;inset:0;z-index:99991;overflow:auto;display:flex;align-items:center;justify-content:center;background:#0b0911f5;color:#eae2ed;font-family:system-ui,sans-serif;padding:20px;box-sizing:border-box';
  document.body.append(entry);
  style.textContent+='#hmV176CodeEntry[hidden]{display:none!important}#hmV176CodeEntry .hm-lobby{width:min(100%,460px);padding:32px 22px;border:1px solid #625269;border-radius:18px;background:#110d19e8;box-shadow:0 16px 65px #000d;text-align:center}#hmV176CodeEntry button{display:block;width:100%;padding:15px;margin:11px 0;border:1px solid #766381;border-radius:10px;background:#291e35;color:#f4ecf8;font-size:15px;font-weight:700;cursor:pointer}#hmV176CodeEntry .hm-eyebrow{font-size:11px;letter-spacing:.3em;color:#b5a6bf}#hmV176CodeEntry .hm-sub{font-size:13px;color:#c3b5cb}#hmV176CodeEntry small{color:#aa9bb5}';

  $('hmV175Create').onclick=()=>openRoom('create');
  $('hmV175Join').onclick=()=>{
   setGate(false);
   const entry=$('hmV176CodeEntry');entry.hidden=false;
   const input=$('hmV176CodeInput');input.value='';input.focus();
  };
  $('hmV176CodeBack').onclick=()=>{$('hmV176CodeEntry').hidden=true;setGate(true);};
  $('hmV176CodeContinue').onclick=()=>{
   const code=$('hmV176CodeInput').value.trim().toUpperCase();
   if(!/^[A-Z0-9_-]{3,32}$/.test(code)){$('hmV176CodeError').textContent='초대 코드를 확인해 주세요.';return;}
   const room=$('hmRoom');if(!room){$('hmV176CodeError').textContent='방 입장 화면을 불러올 수 없습니다.';return;}
   room.value=code;room.dispatchEvent(new Event('input',{bubbles:true}));room.dispatchEvent(new Event('change',{bubbles:true}));
   $('hmV176CodeEntry').hidden=true;
   openRoom('join');
  };
  $('hmV176CodeInput').onkeydown=e=>{if(e.key==='Enter')$('hmV176CodeContinue').click();};

  const close=$('hmCoopClose');
  if(close)close.addEventListener('click',()=>{if(!started&&enteredLobby)queueMicrotask(()=>{waitingRoom=false;setGate(true);});});
  // V172 hides #introCover via class "hidden", not "fade-out".
  // Its cinematic is #introPlayer, not #introVideo.
  const intro=$('introCover'),player=$('introPlayer');
  let introPlayed=false;
  const completed=()=>{
   if(started||enteredLobby)return;
   // Never interrupt the original intro cinematic.
   if(player&&(player.classList.contains('active')||(!player.paused&&!player.ended)))return;
   if(intro&&intro.isConnected&&!intro.classList.contains('hidden')&&!intro.classList.contains('fade-out'))return;
   lobby();
  };
  if(player){
   player.addEventListener('play',()=>{introPlayed=true;},{once:true});
   player.addEventListener('ended',()=>{introPlayed=true;queueMicrotask(completed);},{once:true});
  }
  if(intro){
   const obs=new MutationObserver(completed);
   obs.observe(intro,{attributes:true,attributeFilter:['class','style']});
   if(intro.classList.contains('hidden'))completed();
  }else if(!player||player.ended){lobby();}
  // Keep the game gated if V172 removes the cover after playback.
  if(intro){const removal=new MutationObserver(()=>{if(!intro.isConnected){removal.disconnect();completed();}});removal.observe(document.body,{childList:true,subtree:true});}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});else build();
 window.addEventListener('message',()=>{},false);
 document.addEventListener('hm-v175-started',gameStarted);
 document.addEventListener('hm-v175-state',e=>{
  if(e.detail?.started)gameStarted();
  else if(enteredLobby&&!waitingRoom&&!started)setGate(true);
 });
})();
