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
  const header=node('header');const title=node('div');title.append(node('strong',null,'회명병원 · 단체 대화 (9)'),node('small',null,'CH.05 — 제0유물의 제단'));
  const close=node('button',null,'닫기');close.type='button';const dismiss=()=>{backdrop.remove();opened=false;};close.addEventListener('click',dismiss);
  header.append(title,close);box.append(header);
  const list=node('div');list.id='hmNinthMsgs';for(const [who,msg] of messages){
   if(who==='시스템'){list.append(node('div','hmSystem',msg));continue;}
   const item=node('div','hmChatMsg'+(who==='알 수 없음'?' hmUnknown':''));
   item.append(node('div','hmChatWho',who),node('div','hmChatBubble',msg));list.append(item);
  }
  box.append(list);
  const footer=node('footer');footer.append(node('small',null,'참여 인원 9명'),node('small',null,'그런데… 우린 여덟 명이었는데.'));
  box.append(footer);backdrop.append(box);document.body.append(backdrop);close.focus();
  const replayBtn=document.getElementById('hmNinthReplay');if(replayBtn)replayBtn.style.display='none';
  close.addEventListener('click',()=>{if(replayBtn&&phase==='ch06')replayBtn.style.display='block';});
  list.scrollTop=0;
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