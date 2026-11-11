'use strict';
/* CH05 photo hotspot map, attached to approved V172 without replacing preceding chapters. */
(()=>{
 const Native=window.WebSocket,$=id=>document.getElementById(id);
 const names={A:'천장 수술등',B:'왼쪽 전력 장치',C:'봉인 기록판',D:'유리 관찰함',E:'중앙 수술대'};
 const pieces=['접수','208호 병동','엘리베이터','기록보관실','봉인 관찰창'];
 let ws,phase='',chapter={},role=-1,roles=[],tab='A',mounted=false,order=['','','','',''],status='';
 const el=(t,x)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;return n};
 const btn=(s,f)=>{const n=el('button',s);n.type='button';n.addEventListener('click',f);return n};
 const send=(action,extra={})=>{if(!ws||ws.readyState!==Native.OPEN){note('서버 연결이 필요합니다.');return;}ws.send(JSON.stringify({type:'chapter',action,...extra}));};
 const note=x=>{status=x;const n=$('hmAltarStatus');if(n)n.textContent=x};
 const assigned=z=>roles.length&&role===roles[(['A','B','C','D'].indexOf(z)+5)%roles.length];
 const pieceOwner=i=>roles.length&&role===roles[i%roles.length];
 function initScene(){
  const scene=$('hmFinalScene');if(!scene||scene.dataset.altarReady)return;
  scene.dataset.altarReady='1';
  const st=el('style');
  st.textContent='#hmFinalScene .f-hot,#hmFinalScene .f-bottom{display:none!important}#hmFinalScene .f-photo{object-fit:contain!important}#hmFinalScene #hmAltarMap{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(100vw,198dvh);aspect-ratio:1.98;z-index:7;pointer-events:none}#hmFinalScene #hmAltarMap .hmAltarHot{position:absolute;transform:translate(-50%,-50%);border:1px solid #c1a3c6;background:#271530dc;color:white;border-radius:50%;box-shadow:0 0 0 3px #17101b88,0 0 15px #be9dc8aa;padding:0;width:clamp(42px,6vmin,55px);height:clamp(42px,6vmin,55px);min-height:42px;min-width:42px;display:grid;place-items:center;font:700 18px system-ui;pointer-events:auto;touch-action:manipulation}#hmFinalScene #hmAltarMap .hmAltarHot[data-zone=E]{border-color:#f3d6b9}#hmFinalScene .f-top{z-index:8}#hmAltarPanel{color:#eee6f2;font:13px/1.6 system-ui}#hmAltarPanel *{box-sizing:border-box}#hmAltarPanel .aBox{margin:9px 0;padding:13px;border:1px solid #806b87;border-radius:10px;background:#241b2a}#hmAltarPanel .aRow{display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap}#hmAltarPanel .aGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin:10px 0}#hmAltarPanel button,#hmAltarPanel select,#hmAltarPanel input{background:#1b1421;color:#f5e9f5;border:1px solid #92769c;border-radius:7px;padding:9px;min-height:42px;max-width:100%;font:13px system-ui}#hmAltarPanel button:disabled{opacity:.55}#hmAltarPanel select{width:100%;font-size:11px;padding:5px 1px}#hmAltarPanel .aStatus{background:#0f0b14;border:1px solid #685676;padding:11px;white-space:pre-wrap}#hmAltarPanel .aMuted{font-size:12px;color:#bcacc4}#hmFinal06>:not(#hmAltarPanel){display:none!important}';
  document.head.append(st);
  const map=el('div');map.id='hmAltarMap';
  for(const [z,x,y] of [['A',44,23],['B',11,51],['C',85,73],['D',92,44],['E',46,64]]){
   const b=btn(z,()=>{});b.className='hmAltarHot';b.dataset.zone=z;b.title=z+' · '+names[z];b.setAttribute('aria-label',b.title);b.style.left=x+'%';b.style.top=y+'%';map.append(b);
  }
  scene.append(map);
  scene.addEventListener('click',e=>{const hit=e.target.closest?.('#hmAltarMap .hmAltarHot');if(!hit||phase!=='ch06')return;
   e.preventDefault();e.stopImmediatePropagation();tab=hit.dataset.zone;mount();render();const line=$('hmFinalLine');if(line)line.textContent=tab+' · '+names[tab];window.HMPlayUI?.open();
  },true);
  const title=scene.querySelector('.f-top span');if(title)title.textContent='回明病院 · CH.05 제0유물의 제단';
  const menu=$('hmFinalMenu');if(menu)menu.textContent='공동 조사';
 }
 function mount(){
  const container=$('hmFinal06');if(!container||mounted)return;mounted=true;initScene();
  const root=el('section');root.id='hmAltarPanel';root.append(el('small','回明病院 / ARTIFACT RESTORATION'),el('h3','CH.05 — 제0유물의 제단'),el('p','네 장소를 비교하고 다섯 파편을 올바른 순서로 배치하십시오.'));
  const nav=el('nav');nav.className='aGrid';for(const z of ['A','B','C','D','E']){const b=btn(z,()=>{tab=z;render()});b.dataset.altarTab=z;nav.append(b)}root.append(nav);
  const body=el('div');body.id='hmAltarBody';root.append(body);
  const line=el('p','조사를 시작하세요.');line.id='hmAltarStatus';line.className='aStatus';line.setAttribute('role','status');root.append(line);
  container.prepend(root);render();
 }
 function render(){
  const body=$('hmAltarBody');if(!body)return;body.replaceChildren();
  document.querySelectorAll('#hmAltarPanel [data-altar-tab]').forEach(b=>{b.style.background=b.dataset.altarTab===tab?'#5c4269':'#1b1421'});
  const c=chapter||{},done=new Set(c.zoneInspected||[]),read=new Set(c.artifactInspected||[]);
  const card=el('div');card.className='aBox';
  if(tab!=='E'){
   card.append(el('h3',tab+' · '+names[tab]),el('p',done.has(tab)?'✓ 팀 조사 완료':'교차 기록 미확인'));
   if(assigned(tab))card.append(btn('조사 기록 판독',()=>send('ch06_zone',{zone:tab})));
   else card.append(el('p','담당 조사원이 다른 사람입니다. 팀 채팅으로 기록을 공유받으세요.'));
   card.append(el('p','이 구역에서 나온 정보만으로는 파편의 정답 순서를 알아낼 수 없습니다.'));
  }else{
   card.append(el('h3','E · 중앙 수술대 / 파편 배열'),el('p','A~D의 기록과 다섯 파편을 모두 조사한 뒤 올바른 배열을 추리하세요.'),el('p','구역 '+done.size+'/4 · 파편 '+read.size+'/5'));
   for(let i=0;i<5;i++){
    const row=el('div');row.className='aRow';const label=el('span',(read.has(i)?'✓ ':'○ ')+pieces[i]+' 파편');label.style.flex='1';row.append(label);
    const b=btn('판독',()=>send('artifact_inspect',{fragment:i}));b.disabled=!pieceOwner(i)||read.has(i);row.append(b);
    if(!pieceOwner(i))row.append(el('small','다른 조사원 담당'));card.append(row);
   }
   card.append(el('p','다섯 파편은 0, 1, 2, 3, 4번 순서대로 놓는 문제가 아닙니다. 조사원의 단서를 합쳐 순서를 찾아주세요.'));
   const grid=el('div');grid.className='aGrid';
   for(let i=0;i<5;i++){
    const label=el('label');label.append(el('small',(i+1)+'번'));
    const select=el('select');select.setAttribute('aria-label',(i+1)+'번째 파편');
    const blank=el('option','선택');blank.value='';select.append(blank);
    for(let n=0;n<5;n++){const o=el('option',n+' '+pieces[n]);o.value=String(n);select.append(o)}
    select.value=order[i];select.addEventListener('change',()=>{order[i]=select.value});label.append(select);grid.append(label);
   }card.append(grid);
   const submit=btn(c.artifactSolved?'✓ 파편 복원 완료':'다섯 파편 결합 검증',()=>{
    if(order.some(x=>x==='')||new Set(order).size!==5){note('서로 다른 다섯 파편을 차례로 선택해 주세요.');return;}send('artifact_submit',{order:order.join('')});
   });
   submit.disabled=!!c.artifactSolved||done.size!==4||read.size!==5;card.append(submit);
   if(c.artifactSolved){
    card.append(el('h4','마지막 문 · 협동 봉인'),el('p','기록 담당자와 반사 담당자의 단서를 각각 확인하세요.'));
    const r1=btn('기록 담당 단서',()=>send('ch06_fragment',{fragment:'record'}));r1.disabled=role!==roles[0];card.append(r1);
    const r2=btn('반사 담당 단서',()=>send('ch06_fragment',{fragment:'reflection'}));r2.disabled=role!==roles[1];card.append(r2);
    card.append(el('p','단서 '+(c.fragments||[]).length+'/2 · 손잡이 '+(c.switches||[]).length+'/2'));
    card.append(btn('마지막 문 손잡이 고정',()=>send('ch06_switch')));
    const input=el('input');input.placeholder='네 글자 영문 암호';input.maxLength=4;input.autocapitalize='characters';card.append(input);
    card.append(btn('여덟 번째 문 열기',()=>send('ch06_answer',{answer:input.value.trim()})));
   }else card.append(el('p','파편 결합 후 마지막 문 암호 단계가 열립니다.'));
  }body.append(card);if(status)note(status);
 }
 class AltarSocket extends Native{
  constructor(...args){super(...args);ws=this;this.addEventListener('message',e=>{
   let m;try{m=JSON.parse(e.data)}catch{return}
   if((m.type==='state'||m.type==='joined')&&m.chapter){
    phase=m.chapter.phase||phase;chapter=m.chapter.ch06||{};
    if(Number.isInteger(Number(m.yourRole)))role=Number(m.yourRole);
    if(Array.isArray(m.roles))roles=m.roles.filter(Number.isInteger).sort((a,b)=>a-b);
    else if(Array.isArray(m.members))roles=m.members.map(x=>x.role).filter(Number.isInteger).sort((a,b)=>a-b);
    if(phase==='ch06'){mount();initScene();render();}
   }
   if(m.type==='ch06_event'&&m.event==='enter'){phase='ch06';mount();initScene();render()}
   if(m.type==='ch06_result'||m.type==='artifact_result')note(m.message||'조사 완료');
  })}
 }
 window.WebSocket=AltarSocket;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{mount();initScene()});else{mount();initScene()}
})();