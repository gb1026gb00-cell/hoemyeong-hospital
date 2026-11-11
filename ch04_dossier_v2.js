'use strict';
/* CH04 GOLDEN HOUR dossier UI v2. Works only in the archive phase. */
(()=>{
 const Native=window.WebSocket,$=id=>document.getElementById(id);
 const docs=[
 ['ledger','A','퇴실 대장','回明病院 / 환자 퇴실 관리 대장','병실 208호 / 정상 퇴실 0명\n\n순서가 섞인 환자 분류 코드\nR-19 / 12\nR-07 / 07\nR-12 / 15\n\n※ 배열 순서는 환자 대조표, 문자 규칙은 문자 변환표에 있다.'],
 ['camera','A','감시 기록','SECURITY / CAMERA 03','02:41 — 208호 출입 감지\n02:42 — 영상 손실\n02:47 — 영상 복구\n\n복구된 프레임 코드 (순서 손실)\nC-28 / 14\nC-04 / 04\nC-16 / 05\n\n※ 정상 프레임 배열은 프레임 판별표에 있다.'],
 ['call','B','내선 통화 기록','INTERNAL CALL / LOG 208','02:41:08 — 구조 요청 / 8초\n수화기를 든 사람은 없었다.\n\n음성에서 분리된 숫자 코드\nS-02 / 21\nS-09 / 18\nS-05 / 08\nS-07 / 15\n\n※ 통화 복원 순서는 문자 변환표에서 찾으라.'],
 ['tag','B','보존 봉투','CONFIDENTIAL / 봉인 보관','제8차 복원 실험\n봉인 시각: 02:41\n열람 기록: 0건\n\n복원 순서: 퇴실 → 감시 → 내선 → 누락 시간\n\n※ 마지막 표식은 글자가 아니다. 감시 기록과 시간 검증표를 대조하라.'],
 ['keyB','C','프레임 판별표','IMAGE RECOVERY / SIGNAL SHEET','유효 프레임 세 장\n두 번째 구획 · 배열 칸 04~06\n\n04 ← C-04\n05 ← C-16\n06 ← C-28\n\n※ C 코드의 숫자는 감시 기록에 있다. 숫자→문자 규칙은 다른 문서에 있다.'],
 ['keyA','C','환자 대조표','PATIENT CROSS-REFERENCE','퇴실 대장 분류 표식 복원\n첫 번째 구획 · 배열 칸 01~03\n\n01 ← R-07\n02 ← R-12\n03 ← R-19\n\n※ R 코드의 숫자는 퇴실 대장에 있다. 숫자→문자 규칙도 필요하다.'],
 ['keyD','D','시간 검증표','TIME DISCREPANCY REPORT','최종 배열: 11번 칸\n\n봉인 시각과 영상 복구 시각의 차이를 계산하라.\n두 시각은 각각 보존 봉투와 감시 기록에 남아 있다.\n\n단위: 분 / 정수\n※ 시간이 사라졌지만 마지막 칸은 비어 있지 않다.'],
 ['keyC','D','문자 변환표','RESTORATION / DECODING KEY','숫자 01~26 = 영문 A~Z\n01=A, 02=B, 03=C … 26=Z\n\n내선 통화 배열 칸 07~10\n07 ← S-05\n08 ← S-07\n09 ← S-02\n10 ← S-09\n\n※ 같은 복호화 규칙은 퇴실 대장과 감시 기록에도 적용된다.']
 ];
 let ws,phase='',state={},role=-1,roles=[],tab='A',opened='',mounted=false,videoActive=false,ready=false,draft=Array(11).fill('');
 const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
 const send=(action,extra={})=>{if(!ws||ws.readyState!==Native.OPEN){msg('서버가 연결되지 않았습니다.');return;}ws.send(JSON.stringify(Object.assign({type:'chapter',action},extra)));};
 const msg=t=>{const e=$('hmDossierStatus');if(e)e.textContent=t;};
 function ownerIds(){
  const idx=roles.indexOf(role),n=roles.length;
  if(idx<0)return [];
  const a=n===2?[0,1,0,1,0,1,0,1]:n===4?[0,1,2,3,0,2,3,1]:docs.map((_,i)=>i%n);
  return docs.filter((d,i)=>a[i]===idx).map(d=>d[0]);
 }
 function btn(text,action){const b=el('button',text);b.type='button';b.onclick=action;return b;}
 function mountScene(){
  const scene=$('hmArchiveScene');
  if(!scene||scene.dataset.dossierConnected==='yes')return;
  scene.dataset.dossierConnected='yes';
  const css=el('style');
  css.textContent='#hmArchiveScene .ar-hot:not(.hmDossierHot){display:none!important}#hmArchiveScene .hmDossierHot{position:absolute;z-index:7;transform:translate(-50%,-50%);min-width:42px;min-height:42px;width:clamp(42px,7vmin,54px);height:clamp(42px,7vmin,54px);padding:0;border-radius:50%;border:1px solid #a78cac;background:#1b1028bd;color:#fff;box-shadow:0 0 0 4px #150d2080,0 0 16px #cda9db77;font:700 18px system-ui;display:grid;place-items:center;touch-action:manipulation}#hmArchiveScene .hmDossierHot:focus-visible{outline:3px solid white}#hmArchiveScene .hmDossierHot[data-zone="E"]{border-color:#e7cdb2;box-shadow:0 0 0 4px #281a1980,0 0 17px #ffe5c099}';
  css.textContent += '#hmArchiveScene .ar-bottom{display:none!important}#hmArchiveScene #hmArchivePuzzle{display:none!important}';
  document.head.append(css);
  const placements=[
   ['A','기록 선반',36.8,24.5],
   ['B','녹음기',46.9,65.3],
   ['C','CCTV 옆 자료함',91.9,70.0],
   ['D','보관 선반',85.6,38.0],
   ['E','봉인 서류장',18.7,33.6]
  ];
  const bottom=scene.querySelector('.ar-bottom');
  for(const [id,name,left,top] of placements){
   const b=btn(id,()=>{});
   b.className='ar-hot hmDossierHot';b.dataset.zone=id;
   b.title=id+' · '+name;b.setAttribute('aria-label',id+' · '+name+' 조사');
   b.style.left=left+'%';b.style.top=top+'%';
   if(bottom)bottom.before(b);else scene.append(b);
  }
  // Capture before legacy V172 hotspot handler. Only the five added buttons are intercepted.
  scene.addEventListener('click',event=>{
   const hit=event.target.closest?.('button.hmDossierHot');
   if(!hit||phase!=='ch04')return;
   event.preventDefault();event.stopImmediatePropagation();
   tab=hit.dataset.zone;opened='';mount();render();
   const label=$('hmArchiveLine');
   if(label)label.textContent=hit.dataset.zone+' · '+hit.title.replace(/^.\s·\s/,'')+' 조사 기록을 확인하세요.';
   if(window.HMPlayUI?.open)window.HMPlayUI.open();
   // Keep the newly selected tab visible, even if an existing UI component rerenders.
   const root=$('hmDossier');if(root)root.scrollIntoView({block:'nearest'});
  },true);
  // Hide legacy controls duplicated by the A-E in-scene investigation hotspots.
  const main=scene.querySelector('#hmArchivePuzzle');
  if(main){main.hidden=true;main.style.setProperty('display','none','important');}
  for(const control of scene.querySelectorAll('button')){
   if(control.classList.contains('hmDossierHot'))continue;
   if(/주변의 이상 현상 조사|E\s*[·.]\s*최종 기록 재구성/.test(control.textContent||'')){
    control.hidden=true;control.style.setProperty('display','none','important');
   }
  }
 }

 function mount(){
  if(mounted||!$('hmArchive04'))return;
  mounted=true;
  mountScene();
  const style=el('style');
  style.textContent='#hmDossier{background:#19131e;color:#eae2ef;font:13px/1.7 system-ui;padding:12px}#hmDossier *{box-sizing:border-box}#hmDossier button{color:#f0e5f4;background:#382a42;border:1px solid #846a8d;border-radius:7px;min-height:44px;padding:10px;font:600 13px system-ui;cursor:pointer}#hmDossier button[aria-pressed=true]{background:#624767}#hmDossier button:disabled{opacity:.5}#hmDossier .dTabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin:12px 0}#hmDossier .dCard{border:1px solid #63516c;background:#241d2b;border-radius:9px;padding:12px;margin:10px 0}#hmDossier .dPaper{background:#322d2a;color:#eddfcf;padding:16px;margin:9px 0;white-space:pre-wrap;font:13px/1.85 Georgia,serif;border:1px solid #857563}#hmDossier .dPaper strong{display:block;color:#d7bcab;margin:0 0 12px}#hmDossier .dMark{display:inline-block;padding:5px 9px;border:1px solid #b49e7f;margin:8px 5px 0 0}#hmDossier .dGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px}#hmDossier .dTile{text-align:center;padding:7px 2px;border:1px solid #655570;background:#2d2433}#hmDossier .dTile small{display:block}#hmDossier input{width:100%;background:#100d14;color:white;border:1px solid #907799;padding:13px;min-height:46px}#hmDossier .dStatus{white-space:pre-wrap;background:#100d14;border:1px solid #675373;padding:10px;margin:11px 0}';
  document.head.append(style);
  const root=el('section');root.id='hmDossier';
  root.append(el('small','回明病院 / ARCHIVE INVESTIGATION'),el('h2','CH.04 — 사라진 6분'),el('p','A~D의 서로 다른 기록을 대조해 숫자를 해독하고, 01~11의 올바른 순서를 직접 복원하십시오.'));
  const nav=el('nav');nav.className='dTabs';for(const z of ['A','B','C','D','E']){const b=btn(z,()=>{tab=z;opened='';render();});b.dataset.tab=z;nav.append(b);}root.append(nav);
  const body=el('div');body.id='hmDossierBody';root.append(body);
  const status=el('div','기록을 조사하세요.');status.id='hmDossierStatus';status.className='dStatus';root.append(status);
  const panel=$('hmArchive04');panel.prepend(root);
  for(const child of [...panel.children])if(child!==root){child.hidden=true;child.style.setProperty('display','none','important');}
  render();
 }
 function render(){
  if(!mounted)return;
  const root=$('hmDossier'),body=$('hmDossierBody');if(!root||!body)return;body.replaceChildren();
  root.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.tab===tab)));
  const assigned=ownerIds(),inspected=state.inspected||[];
  if(tab!=='E'){
   body.append(el('h3',tab+' · '+({A:'기록 선반',B:'낡은 녹음기',C:'자료함',D:'잠금장치'}[tab])));
   for(const d of docs.filter(x=>x[1]===tab)){
    const card=el('article');card.className='dCard';card.append(el('h3',d[2]));
    const mine=assigned.includes(d[0]),isSeen=inspected.includes(d[0]);
    card.append(el('p',mine?'내 담당 자료':'다른 조사원에게 배정된 자료 · 팀원에게 확인 요청'));
    if(mine){
     card.append(btn(isSeen?'문서 다시 열기':'봉인 기록 열람',()=>{opened=d[0];send('ch04_inspect',{object:d[0]});render();}));
     if(opened===d[0]&&isSeen){
      const paper=el('div');paper.className='dPaper';paper.append(el('strong',d[3]),el('div',d[4]));
      card.append(paper);
     }
    }
    if(isSeen)card.append(el('p','✓ 팀 조사 완료'));
    body.append(card);
   }
  }else{
   body.append(el('h3','E · 봉인 기록 / 사건 재구성'));
   body.append(el('p','문서의 숫자를 문자로 바꾸고, 다른 조사원이 가진 표와 대조하여 01~11의 빈칸을 완성하십시오. 이 화면에는 정답 문자가 자동 표시되지 않습니다.'));
   const hint=el('p','관찰 기록 → 프레임 대조 / 내선 기록 → 변환표 / 봉인 시각 → 시간 검증. 서로의 단서를 팀 채팅으로 공유하세요.');hint.style.color='#b8a2c2';body.append(hint);
   const grid=el('div');grid.className='dGrid';
   for(let n=1;n<=11;n++){
    const tile=el('label');tile.className='dTile';tile.style.padding='5px 2px';tile.append(el('small',String(n).padStart(2,'0')));
    const input=el('input');input.dataset.position=String(n-1);input.value=draft[n-1];input.maxLength=1;
    input.autocapitalize='characters';input.autocomplete='off';input.spellcheck=false;input.inputMode=n===11?'numeric':'text';
    input.setAttribute('aria-label','복원 순서 '+n+'번 칸');
    input.style.cssText='min-height:36px;max-width:100%;padding:4px 0;text-align:center;font-size:17px;font-weight:bold;background:#120d19;border:1px solid #8b7395;border-radius:4px';
    input.addEventListener('input',()=>{const val=input.value.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(-1);input.value=val;draft[n-1]=val;if(val){const next=grid.querySelector('[data-position="'+n+'"]');if(next)next.focus();}});
    tile.append(input);grid.append(tile);
   }
   body.append(grid);
   body.append(el('p','공동 기록 '+inspected.length+'/8 · E 영상 확인 '+(state.videoDone||[]).length+'/'+roles.length));
   const videoButton=btn('E · 봉인 영상 G04 시청',()=>send('ch04_e_open'));videoButton.disabled=inspected.length!==8;body.append(videoButton);
   if(ready){
    body.append(el('p','[복원 지시] 잃어버린 순서를 되찾아라. 첫 번째·두 번째·세 번째 구획은 영문, 마지막 칸은 누락 시간이다.'));
    body.append(btn('11칸 배열 확인 · 복원 동의',()=>{
     if(draft.some(x=>!x)){msg('01~11번 칸을 모두 채워주세요.');return;}
     send('ch04_vote',{answer:draft.slice(0,6).join('')+' '+draft.slice(6,10).join('')+' '+draft[10]});
    }));
    body.append(el('p','동의 '+(state.votes||[]).length+'/2 · 서로 다른 두 조사원이 승인해야 넘어갑니다.'));
   }else body.append(el('p','전원이 G04 영상을 끝까지 시청하면 배열 확인 버튼이 열립니다.'));

  }
 }
 function playVideo(){
  if(videoActive||phase!=='ch04')return;videoActive=true;
  const overlay=el('div');overlay.id='hmGoldenEVideo';overlay.style.cssText='position:fixed;inset:0;z-index:2147483630;background:#080509;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;color:white;font:14px system-ui';
  const label=el('p','回明病院 · 제0유물 봉인 기록');overlay.append(label);
  const v=el('video');v.src='/G04.mp4';v.autoplay=true;v.playsInline=true;v.preload='auto';v.style.cssText='width:100%;max-width:850px;max-height:75dvh;object-fit:contain';overlay.append(v);document.body.append(overlay);
  let ended=false;v.onended=()=>{if(ended)return;ended=true;videoActive=false;overlay.remove();send('ch04_e_video_done');msg('영상 종료 · 팀원 시청 확인 중…');};
  v.onerror=()=>{label.textContent='영상을 불러오지 못했습니다. 재생을 재시도하세요.';v.controls=true;};
  v.play().catch(()=>{v.muted=true;v.play().catch(()=>{label.textContent='자동 재생 제한: 아래 버튼으로 영상을 시작하세요.';overlay.append(btn('영상 재생',()=>v.play().catch(()=>{})));});});
 }
 class DossierSocket extends Native{
  constructor(...args){super(...args);ws=this;this.addEventListener('message',e=>{
   let m;try{m=JSON.parse(e.data)}catch{return;}
   if((m.type==='state'||m.type==='joined')&&m.chapter){
    phase=m.chapter.phase||phase;state=m.chapter.ch04||{};
    if(Number.isInteger(Number(m.yourRole)))role=Number(m.yourRole);
    if(Array.isArray(m.members))roles=m.members.map(x=>x.role).filter(Number.isInteger).sort((a,b)=>a-b);
    else if(Array.isArray(m.roles))roles=m.roles.filter(Number.isInteger).sort((a,b)=>a-b);
    if(phase==='ch04'){mount();mountScene();ready=roles.length>=2&&(state.videoDone||[]).length>=roles.length;render();}
   }
   if(m.type==='ch04_e_video')playVideo();
   if(m.type==='ch04_e_ready'){ready=true;tab='E';render();msg(m.message||'모든 영상 확인 완료');}
   if(m.type==='ch04_result')msg(m.message||'조사 완료');
   if(m.type==='ch04_event'&&m.event==='wrong')msg('복원 식별명을 다시 확인하세요.');
  });}
 }
 window.WebSocket=DossierSocket;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{mount();mountScene();});else{mount();mountScene();}
})();