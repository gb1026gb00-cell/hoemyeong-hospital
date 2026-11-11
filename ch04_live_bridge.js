'use strict';
/* GOLDEN HOUR CH04/CH05 integration into approved V172 UI.
 * Additive only: never cover or replace approved CH01-03, videos or chat. */
(()=>{
 const Native=window.WebSocket;
 let socket=null,phase='',chapter=null;
 const $=id=>document.getElementById(id);
 const records={keyA:'A · 환자 대조표',keyB:'B · 프레임 판별표',keyC:'C · 문자 변환표',keyD:'D · 시간 검증표'};
 const send=(action,extra={})=>{
  if(socket&&socket.readyState===Native.OPEN)socket.send(JSON.stringify({type:'chapter',action,...extra}));
  else notice('서버 연결을 확인해 주세요.');
 };
 function notice(message){const el=$('hmArchiveResult');if(el)el.textContent=message;}
 function button(label,handler){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='min-height:44px;padding:9px;border:1px solid #79648e;border-radius:8px;background:#30243c;color:#f7f1ff';b.addEventListener('click',handler);return b;}
 function mount(){
  const panel=$('hmArchive04');
  if(!panel||$('hmGoldenHourTools'))return;
  const section=document.createElement('section');section.id='hmGoldenHourTools';
  section.style.cssText='margin-top:12px;padding:12px;border:1px solid #79648e;border-radius:10px;background:#19141f;color:#eee5eb';
  const heading=document.createElement('strong');heading.textContent='GOLDEN HOUR 6 · 네 구획 교차 해독';section.append(heading);
  const intro=document.createElement('p');intro.textContent='각 조사원에게 배정된 기록과 해독표를 공유하고 A~D를 복원하세요.';section.append(intro);
  const keys=document.createElement('div');keys.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px';
  for(const [key,label] of Object.entries(records))keys.append(button(label,()=>send('ch04_decoder',{object:key})));
  section.append(keys);
  const answers=document.createElement('div');answers.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px';
  for(const part of ['A','B','C','D']){
   const wrap=document.createElement('label');wrap.textContent='구획 '+part;
   const input=document.createElement('input');input.id='hmGoldenPart'+part;input.placeholder='해독 결과';input.autocomplete='off';input.style.cssText='display:block;width:100%;min-height:44px;color:#f7f1ff;background:#17111e;border:1px solid #79648e;border-radius:6px';
   wrap.append(input,button(part+' 확인',()=>send('ch04_decode',{part,answer:input.value.trim()})));answers.append(wrap);
  }
  section.append(answers);
  const artifact=button('봉인 관찰창 · 제0유물 기록 (G04)',()=>send('ch04_artifact_record'));
  artifact.style.marginTop='12px';section.append(artifact);
  const progress=document.createElement('p');progress.id='hmGoldenProgress';progress.setAttribute('role','status');section.append(progress);
  // The approved V172 vote selector offers obsolete choices. GOLDEN HOUR requires a text answer.
  const select=$('hmArchiveAnswer');if(select){
   const input=document.createElement('input');input.id=select.id;input.autocomplete='off';input.placeholder='최종 복원 식별명';input.style.cssText='width:100%;min-height:44px;color:#f7f1ff;background:#17111e;border:1px solid #79648e;border-radius:6px';
   select.replaceWith(input);
  }
  const isolation=$('hmIsolation05');if(isolation){isolation.hidden=true;isolation.style.setProperty('display','none','important');}
  for(const id of ['hmIsolationEnter','hmIsolationNext']){const el=$(id);if(el){el.hidden=true;el.style.setProperty('display','none','important');}}
  const vote=$('hmArchiveVote');
  if(vote)vote.textContent='재구성 동의 · 각 조사원 1회';
  // Keep original record buttons, witness buttons, photorealistic scene and original vote handler.
  const result=$('hmArchiveResult');if(result)result.before(section);else panel.append(section);
  const next=$('hmArchiveNext');if(next)next.hidden=true;
  const final=$('hmFinal06');if(final){
   const title=final.querySelector('strong');if(title)title.textContent='CH.05 · 제0유물의 제단';
   const input=$('hmFinalAnswer');if(input){input.inputMode='text';input.maxLength=4;input.placeholder='영문 네 글자';}
   const label=final.querySelector('label:has(#hmFinalAnswer)');if(label)label.firstChild.textContent='마지막 문 영문 암호';
   const info=final.querySelector('p.sub');if(info)info.textContent='기록 네 곳과 두 담당자의 단서를 확보하고, 공동 제0유물 파편 다섯 개를 모두 판독하세요.';
   const finale=document.createElement('div');finale.id='hmNinthDialogue';finale.setAttribute('role','log');finale.style.cssText='display:none;white-space:pre-wrap;line-height:1.7;background:#0e0b13;border:1px solid #755583;border-radius:8px;margin:12px 0;padding:12px;max-height:36vh;overflow:auto';
   final.append(finale);
   const fragment=final.querySelector('[data-artifact="4"]');if(fragment)fragment.textContent='봉인 관찰창 파편';
  }
  if($('hmFinalEnter'))$('hmFinalEnter').hidden=true;
  const finalVisual=$('hmFinalScene');if(finalVisual){const title=finalVisual.querySelector('.f-title, .f-heading, strong');if(title&&/CH\.\s*0?6|여덟 번째 문/.test(title.textContent))title.textContent='CH.05 · 제0유물의 제단';}
  const end=$('hmFinalEnding');if(end){const title=end.querySelector('strong');if(title)title.textContent='END — 귀환 · 회명병원의 아홉 번째 참가자';}
 }
 function update(){
  mount();
  const c=chapter?.ch04||{};
  const p=$('hmGoldenProgress');
  if(p)p.textContent='공동 진행 · 자료 '+(c.inspected?.length||0)+'/8 · 해독 '+(c.decoded?.length||0)+'/4 · 증언 '+(c.witnesses?.length||0)+'/2 · 동의 '+(c.votes?.length||0)+'/2';
  const progress=$('hmFinalProgress'),final=chapter?.ch06||{};
  if(progress&&phase==='ch06')progress.textContent='기록 '+(final.inspected?.length||0)+'/4 · 담당 단서 '+(final.fragments?.length||0)+'/2 · 파편 판독 '+(final.artifactInspected?.length||0)+'/5 · 복원 '+(final.artifactSolved?'완료':'미완료')+' · 손잡이 '+(final.switches?.length||0)+'/2';
  if($('hmArchiveNext'))$('hmArchiveNext').hidden=true;
  if($('hmFinalEnter'))$('hmFinalEnter').hidden=true;
  const isolation=$('hmIsolation05');if(isolation)isolation.style.setProperty('display','none','important');
  for(const id of ['hmIsolationEnter','hmIsolationNext']){const el=$(id);if(el)el.style.setProperty('display','none','important');}
  const sheet=$('hmSheetTitle');if(sheet&&(phase==='ch06'||phase==='finished'))sheet.textContent='回明病院 · CH.05 제0유물의 제단';
 }
 class GoldenSocket extends Native{
  constructor(...args){super(...args);socket=this;this.addEventListener('message',e=>{
   let m;try{m=JSON.parse(e.data)}catch{return;}
   if((m.type==='state'||m.type==='joined')&&m.chapter){chapter=m.chapter;phase=m.chapter.phase||phase;update();}
   if(m.type==='ch04_event'&&m.event==='enter'){phase='ch04';update();}
   if(m.type==='ch04_result'&&m.message)notice(m.message);
   if(m.type==='ch06_event'){
    const dialog=$('hmNinthDialogue');
    if(dialog&&Array.isArray(m.dialogue)&&m.dialogue.length){dialog.textContent=m.dialogue.map(line=>Array.isArray(line)?line.join(': '):String(line)).join('\n');dialog.style.display='block';}
    if(dialog&&m.event==='ninth_return'&&m.message){dialog.textContent+='\n\n'+m.message;dialog.style.display='block';}
    if(m.event==='enter'||m.event==='ninth_return'||m.event==='cleared'){
      const e=$('hmFinalResult');if(e&&m.message)e.textContent=m.message;
    }
   }
   queueMicrotask(update);
  });}
 }
 window.WebSocket=GoldenSocket;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();