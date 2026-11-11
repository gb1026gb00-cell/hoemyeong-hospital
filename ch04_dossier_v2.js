'use strict';
/* CH04 GOLDEN HOUR dossier UI v2. Works only in the archive phase. */
(()=>{
 const Native=window.WebSocket,$=id=>document.getElementById(id);
 const docs=[
 ['ledger','A','퇴실 대장','回明病院 / 환자 퇴실 관리 대장','01:G,02:O','병실 208호\n02:41\n정상 퇴실 인원 0명\n담당자 서명 확인 불가'],
 ['camera','A','감시 기록','SECURITY / CAMERA 03','03:L','02:41 출입 감지\n02:42 화면 일부 손실\n02:47 기록 복구\n출입 인원 판독 불가'],
 ['call','B','내선 통화 기록','INTERNAL CALL / LOG 208','04:D','208호 구조 요청\n02:41:08\n통화 지속 8초\n발신자 미등록'],
 ['tag','B','보존 봉투','CONFIDENTIAL / 봉인 보관','05:E,06:N','2003.11.26\n제8차 복원 실험\n열람 제한\n봉인 담당자 삭제'],
 ['keyB','C','프레임 판별표','IMAGE RECOVERY / SIGNAL SHEET','07:H','CAM 03\n정상 신호 04 / 11 / 16\n유효 프레임 3개\n부분 복원'],
 ['keyA','C','환자 대조표','PATIENT CROSS-REFERENCE','08:O,09:U','대상 병실 208호\n성명 불명\n퇴실 대장·감시 기록 불일치\n신원 복원 미완료'],
 ['keyD','D','시간 검증표','TIME DISCREPANCY REPORT','10:R','구조 요청 02:41\n영상 복구 02:47\n누락 6분\n원인 불명'],
 ['keyC','D','문자 변환표','RESTORATION / DECODING KEY','11:6','표식 01~11\n번호 오름차순 배열\n최종 식별자 봉인됨']
 ];
 let ws,phase='',state={},role=-1,roles=[],tab='A',opened='',mounted=false,videoActive=false,ready=false;
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
 function mount(){
  if(mounted||!$('hmArchive04'))return;
  mounted=true;
  const style=el('style');
  style.textContent='#hmDossier{background:#19131e;color:#eae2ef;font:13px/1.7 system-ui;padding:12px}#hmDossier *{box-sizing:border-box}#hmDossier button{color:#f0e5f4;background:#382a42;border:1px solid #846a8d;border-radius:7px;min-height:44px;padding:10px;font:600 13px system-ui;cursor:pointer}#hmDossier button[aria-pressed=true]{background:#624767}#hmDossier button:disabled{opacity:.5}#hmDossier .dTabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin:12px 0}#hmDossier .dCard{border:1px solid #63516c;background:#241d2b;border-radius:9px;padding:12px;margin:10px 0}#hmDossier .dPaper{background:#322d2a;color:#eddfcf;padding:16px;margin:9px 0;white-space:pre-wrap;font:13px/1.85 Georgia,serif;border:1px solid #857563}#hmDossier .dPaper strong{display:block;color:#d7bcab;margin:0 0 12px}#hmDossier .dMark{display:inline-block;padding:5px 9px;border:1px solid #b49e7f;margin:8px 5px 0 0}#hmDossier .dGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px}#hmDossier .dTile{text-align:center;padding:7px 2px;border:1px solid #655570;background:#2d2433}#hmDossier .dTile small{display:block}#hmDossier input{width:100%;background:#100d14;color:white;border:1px solid #907799;padding:13px;min-height:46px}#hmDossier .dStatus{white-space:pre-wrap;background:#100d14;border:1px solid #675373;padding:10px;margin:11px 0}';
  document.head.append(style);
  const root=el('section');root.id='hmDossier';
  root.append(el('small','回明病院 / ARCHIVE INVESTIGATION'),el('h2','CH.04 — 사라진 6분'),el('p','A~D 자료에서 순서가 적힌 표식을 모아 마지막 식별명을 복원하십시오.'));
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
      const paper=el('div');paper.className='dPaper';paper.append(el('strong',d[3]),el('div',d[5]),el('p','문서 하단 / 분류 표식'));
      for(const frag of d[4].split(',')){const tag=el('span',frag.replace(':',' — '));tag.className='dMark';paper.append(tag);}
      card.append(paper);
     }
    }
    if(isSeen)card.append(el('p','✓ 팀 조사 완료'));
    body.append(card);
   }
  }else{
   body.append(el('h3','E · 봉인 기록 / 사건 재구성'));
   body.append(el('p','열한 개의 표식을 번호순으로 배열하십시오. 다른 조사원에게 배정된 표식은 팀원과 공유하세요.'));
   const own=new Map(docs.filter(d=>assigned.includes(d[0])&&inspected.includes(d[0])).flatMap(d=>d[4].split(',').map(part=>part.split(':'))));
   const grid=el('div');grid.className='dGrid';
   for(let n=1;n<=11;n++){const key=String(n).padStart(2,'0'),tile=el('div');tile.className='dTile';tile.append(el('small',key),el('strong',own.get(key)||'?'));grid.append(tile);}body.append(grid);
   body.append(el('p','공동 기록: '+inspected.length+'/8 · 영상 완료: '+(state.videoDone||[]).length+'/'+roles.length));
   const videoButton=btn('E · 봉인 영상 G04 시청',()=>send('ch04_e_open'));videoButton.disabled=inspected.length!==8;body.append(videoButton);
   if(ready){
    const note=el('p','[복원 지시] 기록은 순서를 잃었으나 번호는 사라지지 않았다. 흩어진 열한 개의 표식을 되돌려라.');body.append(note);
    const input=el('input');input.id='hmDossierAnswer';input.autocomplete='off';input.placeholder='최종 복원 식별명';body.append(input);
    body.append(btn('사건 재구성 동의',()=>send('ch04_vote',{answer:input.value.trim()})));
    body.append(el('p','동의 '+(state.votes||[]).length+'/2 · 서로 다른 두 조사원이 필요합니다.'));
   }else body.append(el('p','전원이 봉인 영상을 확인하면 최종 답안지가 열립니다.'));
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
    if(phase==='ch04'){mount();ready=roles.length>=2&&(state.videoDone||[]).length>=roles.length;render();}
   }
   if(m.type==='ch04_e_video')playVideo();
   if(m.type==='ch04_e_ready'){ready=true;tab='E';render();msg(m.message||'모든 영상 확인 완료');}
   if(m.type==='ch04_result')msg(m.message||'조사 완료');
   if(m.type==='ch04_event'&&m.event==='wrong')msg('복원 식별명을 다시 확인하세요.');
  });}
 }
 window.WebSocket=DossierSocket;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();