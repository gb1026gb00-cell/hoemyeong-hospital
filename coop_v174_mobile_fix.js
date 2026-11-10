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
    if(m.type==='chat'){const box=$('hmV174ChatLog');if(box){const line=document.createElement('div');line.textContent=(m.item?.role!==undefined?'조사원 '+(m.item.role+1)+': ':'')+(m.item?.text||m.item?.message||'');box.append(line);box.scrollTop=box.scrollHeight;}}
   });
   this.addEventListener('close',()=>{if(socket===this){active=false;updateBell();updateConnectionStatus();}});
   this.addEventListener('open',()=>{if(socket===this)updateConnectionStatus();});
  }
 }
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
 document.addEventListener('DOMContentLoaded',normalizeCapacityControls,{once:true});
 const scene=document.querySelector('.scene');
 if(scene){
  const b=document.createElement('button');b.type='button';b.id='hmV174Bell';b.textContent='🔔 호출벨';b.setAttribute('aria-label','접수대 호출벨 누르기');b.hidden=true;
  b.style.cssText='position:absolute;left:43%;top:74%;z-index:16;border:1px solid #b79acb;border-radius:22px;padding:10px 13px;background:#201528e8;color:#f7ebff;font:700 14px system-ui;box-shadow:0 0 14px #6d458a88;touch-action:manipulation;';
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!active||!socket||socket.readyState!==NativeWS.OPEN)return;socket.send(JSON.stringify({type:'chapter',action:'bell'}));});
  scene.append(b);
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
