'use strict';
/* CH04 additive bridge for the approved V172 /play UI. Never replaces earlier scenes. */
(()=>{
 const Native=window.WebSocket;
 let socket=null,phase='',state=null,role=null;
 const $=id=>document.getElementById(id);
 const labels={ledger:'퇴실 대장',camera:'CCTV 기록',call:'내선 전화',tag:'보존 봉투',keyA:'환자 대조표',keyB:'프레임 판별표',keyC:'문자 변환표',keyD:'시간 검증표'};
 const keys=Object.keys(labels);
 const send=(action,extra={})=>{if(socket?.readyState===Native.OPEN)socket.send(JSON.stringify({type:'chapter',action,...extra}));else output('서버 연결을 확인해 주세요.');};
 function output(message){const el=$('hmCh04Output');if(el){const p=document.createElement('p');p.textContent=message;p.style.cssText='padding:8px;border-bottom:1px solid #443647;white-space:pre-wrap';el.prepend(p);}}
 function mount(){
  if($('hmCh04Bridge'))return;
  const root=document.createElement('section');root.id='hmCh04Bridge';
  root.style.cssText='position:fixed;inset:0;z-index:2147482900;background:#0d0b12;color:#eee5eb;overflow-y:auto;overscroll-behavior:contain;padding:clamp(14px,4vw,28px);padding-top:86px;padding-bottom:110px;box-sizing:border-box;font:15px/1.65 system-ui';
  const card=document.createElement('div');card.style.cssText='max-width:780px;margin:auto;background:linear-gradient(135deg,#241c26,#100f14);border:1px solid #685465;border-radius:12px;padding:clamp(14px,4vw,26px);box-shadow:0 12px 36px #0009';
  const title=document.createElement('h2');title.textContent='CH.04 — 사라진 6분';title.style.cssText='margin:0 0 8px;font-size:23px';
  const intro=document.createElement('p');intro.textContent='208호 구조 요청 02:41. 정상 퇴실 0명. 기록 네 종류를 조사하고 서로의 단서를 공유해 복원 계획을 밝혀내세요.';
  const progress=document.createElement('p');progress.id='hmCh04Progress';
  const heading=document.createElement('h3');heading.textContent='배정된 원본 기록 · 해독 자료';
  const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px';
  const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='min-height:49px;padding:10px;border:1px solid #8a7487;border-radius:8px;background:#382c3b;color:#f7eef5;font:600 14px system-ui;white-space:normal';b.onclick=fn;return b;};
  for(const key of keys)grid.append(button(labels[key],()=>send(key.startsWith('key')?'ch04_decoder':'ch04_inspect',{object:key})));
  const decodeTitle=document.createElement('h3');decodeTitle.textContent='네 구획 해독';
  const decode=document.createElement('div');decode.style.cssText='display:grid;gap:10px';
  for(const part of ['A','B','C','D']){const line=document.createElement('div');line.style.cssText='display:flex;gap:8px;align-items:center';const input=document.createElement('input');input.placeholder=part+' 해독 결과';input.setAttribute('aria-label',part+' 구획 정답');input.style.cssText='flex:1;min-width:0;padding:12px;background:#15121a;color:white;border:1px solid #806b80;border-radius:6px;font-size:16px';line.append(input,button(part+' 확인',()=>send('ch04_decode',{part,answer:input.value.trim()})));decode.append(line);}
  const witness=document.createElement('div');witness.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:16px 0';
  witness.append(button('사람의 기록 · 증언',()=>send('ch04_witness',{station:'human'})),button('기계의 기록 · 증언',()=>send('ch04_witness',{station:'machine'})),button('봉인 관찰창 · 제0유물 G04',()=>send('ch04_artifact_record')),button('수술 기록 · G09',()=>send('ch04_surgery_record')));
  const finalTitle=document.createElement('h3');finalTitle.textContent='사건 재구성 · 최종 확인';
  const final=document.createElement('input');final.placeholder='복원 계획 식별명과 사라진 시간';final.setAttribute('aria-label','CH04 최종 정답');final.style.cssText='width:100%;box-sizing:border-box;padding:14px;background:#15121a;color:white;border:1px solid #806b80;border-radius:6px;font-size:16px';
  const vote=button('재구성 동의 · 각 조사원 1회',()=>send('ch04_vote',{answer:final.value.trim()}));vote.style.width='100%';vote.style.marginTop='9px';
  const log=document.createElement('div');log.id='hmCh04Output';log.setAttribute('role','status');log.style.cssText='margin-top:18px;max-height:35vh;overflow-y:auto;background:#110f16;border:1px solid #55465a;border-radius:8px;padding:12px;font-size:13px';
  card.append(title,intro,progress,heading,grid,decodeTitle,decode,witness,finalTitle,final,vote,log);root.append(card);document.body.append(root);
 }
 function update(){
  if(phase==='ch04'){mount();const c=state?.ch04||{};const el=$('hmCh04Progress');if(el)el.textContent='공유 진행 · 기록 '+(c.inspected?.length||0)+'/8 · 구획 '+(c.decoded?.length||0)+'/4 · 증언 '+(c.witnesses?.length||0)+'/2 · 동의 '+(c.votes?.length||0)+'/2';}
  else $('hmCh04Bridge')?.remove();
 }
 class BridgeSocket extends Native{
  constructor(...args){super(...args);socket=this;this.addEventListener('message',e=>{
   let m;try{m=JSON.parse(e.data)}catch{return;}
   if((m.type==='state'||m.type==='joined')&&m.chapter){phase=m.chapter.phase||phase;state=m.chapter;role=m.yourRole??role;update();}
   if(m.type==='ch04_event'){if(m.event==='enter'){phase='ch04';update();}if(m.message)output(m.message);}
   if(m.type==='ch04_result')output(m.message||'조사 결과가 도착했습니다.');
  });}
 }
 window.WebSocket=BridgeSocket;
})();
