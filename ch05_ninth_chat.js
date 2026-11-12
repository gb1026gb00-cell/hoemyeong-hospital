'use strict';
/* CH.05 ninth-participant chat cinematic. Presentation only; no puzzle/state changes. */
(()=>{
 const PreviousSocket=window.WebSocket;
 const scriptId='hmNinthChat20261111';
 let ws,phase='',received=false,opened=false;
 const messages=[
  ['우영','근데 우리 원래 여덟 명 아니야?'],
  ['민기','왜?'],
  ['우영','아니… 톡방에 9명이라고 떠 있잖아.'],
  ['홍중','뭐? 누가 더 들어왔어?'],
  ['시스템','알 수 없음 님이 메시지를 보냈습니다.'],
  ['알 수 없음','저는 원래부터 있었는데요.'],
  ['산','…너 누구야.'],
  ['알 수 없음','지금도 제 안에 계시잖아요.'],
  ['시스템','알 수 없음 님이 퇴장했습니다.']
 ];
 const node=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
 function css(){
  if(document.getElementById(scriptId+'Style'))return;
  const st=node('style');st.id=scriptId+'Style';
  st.textContent=`
   #hmNinthBackdrop{position:fixed;inset:0;z-index:2147483610;background:rgba(5,4,9,.88);display:flex;align-items:center;justify-content:center;padding:12px;font:14px/1.65 system-ui,sans-serif}
   #hmNinthChat{width:min(100%,460px);max-height:min(88dvh,770px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #68546b;border-radius:16px;background:#19151e;color:#f2edf3;box-shadow:0 15px 60px #000d}
   #hmNinthChat header{padding:15px 16px;background:#26202e;border-bottom:1px solid #514454;display:flex;align-items:center;justify-content:space-between;gap:8px}
   #hmNinthChat header strong{font-size:15px}#hmNinthChat header small{display:block;color:#b9a8c0}
   #hmNinthChat button{background:#46344d;color:#fff;border:1px solid #8f7796;border-radius:8px;min-height:40px;padding:7px 14px;cursor:pointer}
   #hmNinthMsgs{overflow:auto;min-height:0;padding:16px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
   #hmNinthMsgs .hmChatMsg{max-width:91%}#hmNinthMsgs .hmChatWho{font-size:11px;color:#bcafc3;margin-bottom:3px}
   #hmNinthMsgs .hmChatBubble{display:inline-block;padding:9px 12px;background:#3b303f;border:1px solid #5c4d62;border-radius:4px 12px 12px 12px;white-space:pre-wrap;word-break:keep-all}
   #hmNinthMsgs .hmUnknown .hmChatBubble{background:#2b151b;border-color:#a04455;color:#ffe0e4}
   #hmNinthMsgs .hmSystem{align-self:center;color:#a9a0ae;background:#282331;border-radius:15px;font-size:12px;text-align:center;padding:6px 12px;max-width:95%}
   #hmNinthChat footer{border-top:1px solid #514454;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px}
   #hmNinthReplay{display:none;position:fixed;right:12px;bottom:16px;z-index:2147483500;background:#271a32;color:#f9eafa;border:1px solid #80688e;border-radius:12px;padding:10px 13px;min-height:42px;font:600 12px system-ui}
   @media(max-width:520px){#hmNinthBackdrop{padding:8px}#hmNinthChat{max-height:92dvh}#hmNinthMsgs{padding:12px}}
  `;
  document.head.append(st);
 }
 function replay(){
  css();
  if(document.getElementById('hmNinthReplay'))return;
  const b=node('button',null,'단체 대화 (9) · 다시 보기');b.id='hmNinthReplay';b.type='button';b.addEventListener('click',show);
  document.body.append(b);
 }
 function setPhase(p){phase=p;const b=document.getElementById('hmNinthReplay');if(b)b.style.display=phase==='ch06'?'block':'none'}
 function show(){
  if(opened||document.getElementById('hmNinthBackdrop'))return;
  opened=true;css();replay();
  const backdrop=node('div');backdrop.id='hmNinthBackdrop';backdrop.setAttribute('role','dialog');backdrop.setAttribute('aria-modal','true');backdrop.setAttribute('aria-label','회명병원 단체 대화');
  const box=node('section');box.id='hmNinthChat';
  const header=node('header');const title=node('div');const memberTitle=node('strong',null,'회명병원 · 단체 대화 (9)');title.append(memberTitle,node('small',null,'CH.05 — 제0유물의 제단'));
  const close=node('button',null,'닫기');close.type='button';let exitTimer=null;const dismiss=()=>{if(exitTimer!==null)clearTimeout(exitTimer);backdrop.remove();opened=false;};close.addEventListener('click',dismiss);
  header.append(title,close);box.append(header);
  const list=node('div');list.id='hmNinthMsgs';
  const appendMessage=([who,msg])=>{
   if(who==='시스템'){list.append(node('div','hmSystem',msg));return;}
   const item=node('div','hmChatMsg'+(who==='알 수 없음'?' hmUnknown':''));
   item.append(node('div','hmChatWho',who),node('div','hmChatBubble',msg));list.append(item);
  };
  // Keep the full conversation visible; reveal the departure last so 9 -> 8 is observable.
  messages.slice(0,-1).forEach(appendMessage);
  box.append(list);
  const footer=node('footer');const memberCount=node('small',null,'참여 인원 9명');footer.append(memberCount,node('small',null,'그런데… 우린 여덟 명이었는데.'));
  box.append(footer);backdrop.append(box);document.body.append(backdrop);close.focus();
  const replayBtn=document.getElementById('hmNinthReplay');if(replayBtn)replayBtn.style.display='none';
  close.addEventListener('click',()=>{if(replayBtn&&phase==='ch06')replayBtn.style.display='block';});
  list.scrollTop=0;
  exitTimer=setTimeout(()=>{
   if(!backdrop.isConnected)return;
   appendMessage(messages[messages.length-1]);
   memberTitle.textContent='회명병원 · 단체 대화 (8)';
   memberCount.textContent='참여 인원 8명';
   if(replayBtn)replayBtn.textContent='단체 대화 (8) · 다시 보기';
   list.scrollTop=list.scrollHeight;
   exitTimer=null;
  },1200);
 }
 class NinthChatSocket extends PreviousSocket{
  constructor(...args){super(...args);ws=this;this.addEventListener('message',ev=>{
   let m;try{m=JSON.parse(ev.data)}catch{return}
   if((m.type==='state'||m.type==='joined')&&m.chapter){setPhase(m.chapter.phase||phase);if(phase==='ch06'&&received)replay();}
   if(m.type==='ch06_event'&&m.event==='enter'){
    setPhase('ch06');received=true;
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
   }
  })}
 }
 window.WebSocket=NinthChatSocket;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',replay,{once:true});else replay();
})();

/* CH.05 final cinematic: G18 -> supplied I SEE YOU audio -> epilogue.
   Uses the existing server-only finished state; never mutates party membership or puzzles. */
(()=>{
 'use strict';
 const Base=window.WebSocket;
 const MARK='hmFinalSeeYou20261112';
 let started=false,finalized=false,overlay=null;
 const audioPath='/audio/i_see_you.mp3';
 const fallbackAudio='https://raw.githubusercontent.com/gb1026gb00-cell/hoemyeong-hospital/dev/coop-v172-preserve-approved-ui/audio/i_see_you.mp3';
 function node(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
 function init(){
  if(overlay)return overlay;
  const style=node('style');style.id=MARK+'Style';
  style.textContent='#'+MARK+'{position:fixed!important;inset:0!important;z-index:2147483647!important;background:#000!important;display:flex!important;align-items:center;justify-content:center;flex-direction:column;color:#d8d4d4;text-align:center;padding:24px;box-sizing:border-box;font-family:Georgia,"Times New Roman",serif}#'+MARK+' video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}#'+MARK+' .hmEndText{position:relative;z-index:2;max-width:90vw;letter-spacing:.12em;white-space:pre-line;line-height:2;font-size:clamp(13px,3vw,19px)}#'+MARK+' .hmEndTitle{font-size:clamp(32px,8vw,70px);letter-spacing:.17em;color:#b51c2d;text-shadow:0 0 23px #6b0a18}#'+MARK+' .hmEndSub{font:13px system-ui,sans-serif;letter-spacing:.5em;margin-top:16px;color:#b4a7b0}#'+MARK+' button{z-index:3;background:#231a25;border:1px solid #827280;color:#f4e8ef;border-radius:7px;padding:12px 18px;font:14px system-ui,sans-serif;min-height:46px;margin-top:18px}';
  document.head.append(style);
  overlay=node('div');overlay.id=MARK;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','회명병원 마지막 장면');
  document.body.append(overlay);
  return overlay;
 }
 function endTitle(){
  if(finalized)return;
  finalized=true;const root=init();root.replaceChildren();
  root.append(node('div','hmEndText hmEndTitle','回明病院'),node('div','hmEndSub','THE END'));
  // The ending remains visible. The old CH.01 cooperative panel must never reappear.
 }
 function showReturn(){
  if(finalized)return;
  const root=init();root.replaceChildren();
  root.append(node('div','hmEndText','알 수 없음 님이 다시 접속했습니다.'));
  setTimeout(endTitle,2400);
 }
 function playVoice(){
  if(finalized)return;
  const root=init();root.replaceChildren();
  const audio=new Audio(audioPath);
  audio.preload='auto';audio.volume=1;
  let done=false,usedFallback=false;
  const finish=()=>{if(done)return;done=true;showReturn()};
  audio.addEventListener('ended',finish,{once:true});
  audio.addEventListener('error',()=>{
   if(usedFallback){finish();return}
   usedFallback=true;audio.src=fallbackAudio;tryPlay();
  });
  const retry=()=>{
   if(done)return;
   root.replaceChildren();
   const button=node('button',null,'음성 재생하기');
   button.onclick=()=>{button.disabled=true;tryPlay()};
   root.append(button);
  };
  function tryPlay(){const p=audio.play();if(p&&p.catch)p.catch(retry)}
  tryPlay();
  setTimeout(()=>{if(!done&&!root.querySelector('button'))finish()},9500);
 }
 function playG18(){
  if(started)return;started=true;
  const root=init();root.replaceChildren();
  // Avoid simultaneous legacy videos under the final cinematic.
  document.querySelectorAll('video').forEach(v=>{try{v.pause()}catch(_){}});
  const video=node('video');video.src='/G18.mp4';video.playsInline=true;video.setAttribute('webkit-playsinline','');video.preload='auto';video.autoplay=true;video.controls=false;
  let completed=false;
  function finishVideo(){if(completed)return;completed=true;try{video.pause()}catch(_){}playVoice()}
  video.addEventListener('ended',finishVideo,{once:true});
  video.addEventListener('error',finishVideo,{once:true});
  root.append(video);
  const p=video.play();
  if(p&&p.catch)p.catch(()=>{
   const button=node('button',null,'마지막 영상 재생하기');
   button.onclick=()=>{button.remove();const next=video.play();if(next&&next.catch)next.catch(()=>{})};
   root.append(button);
  });
 }
 class FinalSocket extends Base{
  constructor(...args){
   super(...args);
   this.addEventListener('message',event=>{
    let m;try{m=JSON.parse(event.data)}catch(_){return}
    if(m.type==='horror_video'&&m.id==='G18')playG18();
    // If a completed player reconnects, show the persistent ending rather than CH.01.
    if((m.type==='joined'||m.type==='state')&&m.chapter?.phase==='finished'&&!started&&!finalized)endTitle();
   });
  }
 }
 window.WebSocket=FinalSocket;
})();
