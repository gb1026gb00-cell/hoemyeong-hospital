'use strict';
/* V174 additive mobile co-op UI bridge; approved scenes/puzzles untouched. */
(()=>{
 const $=id=>document.getElementById(id);
 let active=false,phase='reception',socket=null;
 let startedOnce=false;
 let ch02IsHost=false;
 let receptionAnswerLength=4;
 const NativeWS=window.WebSocket;
 function hideLobby(){const p=$('hmCoopPanel');if(p)p.hidden=true;}
 function showConnectionStatus(message){let el=$('hmV174ConnectionStatus');if(!el){el=document.createElement('div');el.id='hmV174ConnectionStatus';el.setAttribute('role','alert');el.style.cssText='position:fixed;top:12px;left:12px;right:12px;z-index:99980;padding:13px 16px;border:1px solid #d1a2a2;border-radius:10px;background:#29151df2;color:#fff;font:14px system-ui;text-align:center;pointer-events:none';document.body.append(el);}el.textContent=message;el.hidden=!message;}
 function updateConnectionStatus(){showConnectionStatus(startedOnce&&(!active||!socket||socket.readyState!==NativeWS.OPEN)?'협동 서버 연결이 끊어졌습니다. 팀원과 연결을 복구하기 전에는 진행하지 마세요.':'');}
 function updateBell(){const b=$('hmV174Bell');if(!b)return;b.hidden=true;}
 class CoopSocket extends NativeWS{
  constructor(...args){super(...args);socket=this;
   this.addEventListener('message',ev=>{let m;try{m=JSON.parse(ev.data)}catch{return}
    if(m.type==='started'||(m.type==='state'&&m.started===true)|| (m.type==='joined'&&m.started===true)){active=true;startedOnce=true;hideLobby();updateConnectionStatus();document.dispatchEvent(new Event('hm-v175-started'));}
    if(m.type==='state'||m.type==='joined'){if([2,4,8].includes(Number(m.capacity)))receptionAnswerLength=Number(m.capacity)/2+3;active=!!m.started;phase=m.chapter?.phase||phase;updateBell();updateConnectionStatus();document.dispatchEvent(new CustomEvent('hm-v175-state',{detail:{started:active}}));}
    if(m.type==='joined'&&typeof m.isHost==='boolean')ch02IsHost=m.isHost;
    if(m.type==='error'&&phase==='ch02'){
     const popup=document.getElementById('hmCh02NewDialog');
     if(popup&&/협동 진행 대기|최소 2명|연결/.test(m.message||''))ch02Dialog('조사원 연결 대기',m.message);
    }
    if(m.type==='ch03_result'&&m.ok===false&&phase==='ch02_cleared'){
     const status=document.getElementById('hmCh02TransitionStatus');
     if(status)status.textContent=m.message||'엘리베이터 호출을 완료하지 못했습니다.';
    }
    if(m.type==='fragment_result'&&m.ok===false&&phase==='ch02_cleared'){
     const status=document.getElementById('hmCh02TransitionStatus');
     if(status)status.textContent=m.message||'파편 수집 상태를 확인해 주세요.';
    }
    if(m.type==='ch03_event'&&m.event==='enter'){
     document.getElementById('hmCh02ClearScene')?.remove();
     document.getElementById('hmCh02NewDialog')?.remove();
     ch02ClearShown=false;
    }
    if(m.type==='reception_clue'&&m.object!=='desk')showSceneClue(m);
    if(m.type==='reception_result')showReceptionAnswerResult(m);
    if(m.type==='ch02_certificate'&&active)showCh02Certificate(m);
    if(m.type==='ch02_ecg_archive'&&active)showCh02ECG(m);
    if(m.type==='ch02_bed_tags'&&active)showCh02BedTags(m);
    if(m.type==='ch02_new_result'&&m.site==='answer'){
     const status=document.getElementById('hmCh02NewStatus');if(status)status.textContent=m.message||'';
     if(m.ok&&m.scene==='death_record_invalidated')showCh02Clear();
    }
    if(m.type==='ch02_new_result'&&m.site==='underbed'&&phase==='ch02'&&!m.videoPending){
     ch02HandPending=false;
     showCh02Answer();
    }
    if(m.type==='horror_video'&&m.id==='H01'&&phase==='ch02'&&ch02HandPending){
     ch02HandPending=false;
     const video=document.getElementById('hmHorrorVideo');
     if(video){
      let shown=false;
      const finish=()=>{if(shown||phase!=='ch02')return;shown=true;showCh02Answer();};
      video.addEventListener('ended',finish,{once:true});
      video.addEventListener('error',finish,{once:true});
      // A blocked or missing media source should not strand the puzzle.
      video.addEventListener('abort',finish,{once:true});
      // The media controller may finish before the chapter message handler attaches.
      if(video.ended||(video.error&&video.networkState===HTMLMediaElement.NETWORK_NO_SOURCE))finish();
     }else showCh02Answer();
    }
    if((m.type==='chapter_event'&&m.event==='escape')||((m.type==='state'||m.type==='joined')&&m.chapter&&['escaped','ch02','ch03','ch04','ch05','ch06','finished'].includes(m.chapter.phase))){$('hmReceptionCodeModal')?.remove();$('hmCh01InspectionScreen')?.remove();}
    handleHospitalSoundEvent(m);
    if(m.type==='horror_video'&&m.id==='G08')playForcedSeparation();
    if(m.type==='horror_video'&&m.id==='G01')playReceptionScare();
    // Drawer video is triggered only by an explicit scene drawer click, never by a clue response.
    if(m.type==='chat'){const box=$('hmV174ChatLog');if(box){const line=document.createElement('div');line.textContent=(Number.isInteger(m.item?.character)&&m.item.character>=0&&m.item.character<8?['홍중','성화','윤호','여상','산','민기','우영','종호'][m.item.character]+': ':(m.item?.role!==undefined?'조사원 '+(m.item.role+1)+': ':''))+(m.item?.text||m.item?.message||'');box.append(line);box.scrollTop=box.scrollHeight;}}
   });
   this.addEventListener('close',()=>{if(socket===this){active=false;updateBell();updateConnectionStatus();}});
   this.addEventListener('open',()=>{if(socket===this)updateConnectionStatus();});
  }
 }
 // Independent CH01 entry control: not attached to the legacy puzzle panel.
 // It is visible whenever the cooperative server is in reception phase.
 function mountDirectInvestigation(){
  let b=$('hmDirectCh01Start');
  if(!b){
   b=document.createElement('button');b.id='hmDirectCh01Start';b.type='button';
   b.textContent='접수실 조사 시작 · 강제 분리';
   b.style.cssText='position:fixed!important;left:50%!important;bottom:92px!important;transform:translateX(-50%)!important;z-index:999990!important;display:block;min-width:240px;max-width:90vw;padding:17px 22px;border:2px solid #c49bad;border-radius:12px;background:#4b263a;color:#fff;font:700 16px system-ui;box-shadow:0 5px 25px #000b;cursor:pointer';
   b.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    if(!active||phase!=='reception'||socket?.readyState!==NativeWS.OPEN)return;
    socket.send(JSON.stringify({type:'chapter',action:'start_investigation'}));
    b.textContent='강제 분리 신호 전송 중…';
   },true);
   document.body.append(b);
  }
  b.hidden=!(active&&phase==='reception');
  b.style.display=b.hidden?'none':'block';
  if(!b.hidden){
   document.querySelectorAll('p,span,div').forEach(el=>{
    if(el.children.length===0&&/호출벨과 협동 절차를 먼저 진행해야 하는 구역/.test(el.textContent||'')){el.hidden=true;el.style.display='none';}
   });
  }
 }
 document.addEventListener('hm-v175-state',mountDirectInvestigation);
 document.addEventListener('hm-v175-started',mountDirectInvestigation);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountDirectInvestigation,{once:true});else mountDirectInvestigation();
 const directObserver=new MutationObserver(()=>mountDirectInvestigation());
 directObserver.observe(document.documentElement,{childList:true,subtree:true});
 // CH01 desk action is independent of the legacy call-bell and puzzle UI.
 // Keep it visible after separation even when V172 uses a separate scene sheet.
 // The approved scene already has its own drawer hotspot; no duplicate button.
 function removeDuplicateDeskButton(){const el=$('hmDirectReceptionDesk');if(el)el.remove();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',removeDuplicateDeskButton,{once:true});else removeDuplicateDeskButton();
 // CH01 input is handled by the single strict scene click router below.
 // Do not infer 'desk' from parent text: ledger labels contain reception words.
 // Keep cinematic overlays as non-interactive layers. The source video
 // stays unchanged; native controls, fullscreen affordances and pinch zoom
 // are suppressed on all injected scare players.
 const cinematicStyle=document.createElement('style');
 cinematicStyle.textContent='#hmForcedSeparation video,#hmReceptionScare video,#hmReceptionHandScare video{pointer-events:none!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important;-webkit-touch-callout:none!important}#hmForcedSeparation video::-webkit-media-controls,#hmReceptionScare video::-webkit-media-controls,#hmReceptionHandScare video::-webkit-media-controls{display:none!important}#hmForcedSeparation video::-webkit-media-controls-enclosure,#hmReceptionScare video::-webkit-media-controls-enclosure,#hmReceptionHandScare video::-webkit-media-controls-enclosure{display:none!important}';
 document.head.append(cinematicStyle);
 const configureCinematicVideo=video=>{
  video.controls=false;video.disablePictureInPicture=true;
  video.disableRemotePlayback=true;video.playsInline=true;
  video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  video.setAttribute('controlslist','nodownload noplaybackrate nofullscreen noremoteplayback');
  video.addEventListener('contextmenu',event=>event.preventDefault());
  video.addEventListener('dblclick',event=>event.preventDefault());
 };
 // The server already broadcasts G08 on the bell action. Add the approved
 // corrupted CH01 voice to the actual G08 playback, not to an unrelated timer.
 const separationVoice=new Audio(new URL('/CH01_reverse_corrupted.mp3',location.origin).href);
 separationVoice.preload='auto';
 let pendingSeparation=false;
 function soundVolume(){const enabled=$('hmSoundEnabled'),volume=$('hmSoundVolume');return enabled&&!enabled.checked?0:Math.max(0,Math.min(1,Number(volume?.value??65)/100));}
 function startSeparationVoice(){if(!pendingSeparation)return;pendingSeparation=false;separationVoice.pause();separationVoice.currentTime=0;separationVoice.volume=soundVolume();separationVoice.muted=soundVolume()===0;separationVoice.play().catch(()=>{pendingSeparation=true;});}
 function armSeparation(){pendingSeparation=true;separationVoice.load();startSeparationVoice();}
 document.addEventListener('DOMContentLoaded',()=>{
  const v=$('hmHorrorVideo');
  if(v){v.addEventListener('playing',()=>{if(pendingSeparation)startSeparationVoice();});
   v.addEventListener('ended',()=>{separationVoice.pause();pendingSeparation=false;});
   v.addEventListener('error',()=>{separationVoice.pause();pendingSeparation=false;});}
  const start=$('hmVideoStart');if(start)start.addEventListener('click',()=>{if(pendingSeparation)startSeparationVoice();});
  const bell=document.querySelector('[data-action="bell"]');
  if(bell)bell.addEventListener('click',()=>{separationVoice.load();},{passive:true});
 },{once:true});
 // A dedicated full-screen G08 transition prevents the reception scene from
 // appearing immediately while the original media player fails or is blocked.
 let separationPlaying=false;
 function playForcedSeparation(){
  if(separationPlaying)return;
  separationPlaying=true;
  const overlay=document.createElement('div');
  overlay.id='hmForcedSeparation';
  overlay.style.cssText='position:fixed;inset:0;z-index:999999;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;color:#f3dbe6';
  const video=document.createElement('video');
  video.playsInline=true;video.preload='auto';video.controls=false;
  video.style.cssText='width:100%;height:100%;object-fit:contain';
  video.src=new URL('/G08.mp4',location.origin).href;
  configureCinematicVideo(video);
  const action=document.createElement('button');
  action.type='button';action.textContent='강제 분리 영상 재생';
  action.style.cssText='position:absolute;bottom:12%;padding:14px 22px;border:1px solid #9e5263;border-radius:10px;background:#2c131d;color:white;font:700 15px system-ui';
  action.hidden=true;
  overlay.append(video,action);document.body.append(overlay);
  let done=false;
  const finish=()=>{if(done)return;done=true;video.pause();separationVoice.pause();video.hidden=true;action.hidden=true;const card=document.createElement('div');card.style.cssText='position:absolute;inset:0;background:#070507;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:24px';card.innerHTML='<div style="color:#a93645;font:700 clamp(34px,9vw,62px) serif;letter-spacing:.14em">回明病院</div><div style="color:#f3e8ee;font:600 21px system-ui">다른 조사원들과 떨어졌습니다.</div><div style="color:#ab96a2;font:13px system-ui">서로의 목소리만이 남아 있습니다.</div>';overlay.append(card);setTimeout(()=>{overlay.remove();separationPlaying=false;},2400);};
  video.addEventListener('playing',()=>{action.hidden=true;armSeparation();});
  video.addEventListener('ended',finish);
  video.addEventListener('error',()=>{action.hidden=false;action.textContent='영상 로드 실패 · 조사 계속하기';action.onclick=finish;});
  action.addEventListener('click',()=>{if(video.error){finish();return;}video.muted=soundVolume()===0;video.volume=soundVolume();video.play().then(()=>{action.hidden=true;startSeparationVoice();}).catch(()=>{action.textContent='영상 재생하기';action.hidden=false;});});
  video.volume=soundVolume();video.muted=soundVolume()===0;
  video.play().catch(()=>{video.muted=true;video.play().then(()=>{action.textContent='🔊 소리 켜기';action.hidden=false;}).catch(()=>{action.textContent='강제 분리 영상 재생';action.hidden=false;});});
 }
 // G01 is the opening nurse cinematic. Every newly created room gets a fresh
 // server witness list; revisiting the desk in the same room does not replay.
 let receptionScarePlaying=false;
 function playReceptionScare(){
  if(receptionScarePlaying)return;
  receptionScarePlaying=true;
  const overlay=document.createElement('div');overlay.id='hmReceptionScare';
  overlay.style.cssText='position:fixed;inset:0;z-index:999998;background:#000;display:flex;align-items:center;justify-content:center';
  const video=document.createElement('video');video.playsInline=true;video.preload='auto';
  video.src=new URL('/G01.mp4',location.origin).href;
  configureCinematicVideo(video);
  video.style.cssText='width:100%;height:100%;object-fit:contain';
  video.volume=soundVolume();video.muted=soundVolume()===0;
  const play=document.createElement('button');play.type='button';play.textContent='시작 영상 재생';
  play.style.cssText='position:absolute;bottom:12%;padding:14px 22px;background:#2c131d;color:white;border:1px solid #9e5263;border-radius:10px';
  play.hidden=true;
  const finish=()=>{video.pause();overlay.remove();receptionScarePlaying=false;};
  video.addEventListener('ended',finish,{once:true});
  video.addEventListener('error',()=>{play.textContent='영상 오류 · 닫기';play.hidden=false;},{once:true});
  play.onclick=()=>{if(video.error){finish();return;}video.muted=soundVolume()===0;video.volume=soundVolume();video.play().then(()=>{play.hidden=true;}).catch(()=>{play.textContent='영상 재생하기';play.hidden=false;});};
  overlay.append(video,play);document.body.append(overlay);
  video.play().catch(()=>{video.muted=true;video.play().then(()=>{play.textContent='🔊 소리 켜기';play.hidden=false;}).catch(()=>{play.textContent='시작 영상 재생';play.hidden=false;});});
 }
 // The uploaded reception-drawer video has its own stable asset path.
 // It is intentionally not aliased to any G/H clip until the binary is uploaded.
 let receptionHandPlaying=false;
 function playReceptionHand(){
  if(receptionHandPlaying||$('hmReceptionCodeModal'))return;
  receptionHandPlaying=true;
  const overlay=document.createElement('div');
  overlay.id='hmReceptionHandScare';
  overlay.style.cssText='position:fixed;inset:0;z-index:999998;background:#000;display:flex;align-items:center;justify-content:center';
  const video=document.createElement('video');video.playsInline=true;video.preload='auto';video.controls=false;
  video.src=new URL('/reception_hand.mp4',location.origin).href;
  configureCinematicVideo(video);
  video.style.cssText='width:100%;height:100%;object-fit:contain';
  video.volume=soundVolume();video.muted=soundVolume()===0;
  const retry=document.createElement('button');retry.type='button';retry.textContent='영상 재생하기';
  retry.style.cssText='position:absolute;bottom:12%;padding:14px 22px;border:1px solid #9e5263;border-radius:10px;background:#2c131d;color:white;font:700 15px system-ui';
  retry.hidden=true;
  const finish=()=>{video.pause();overlay.remove();receptionHandPlaying=false;openReceptionCodePanel();};
  video.addEventListener('ended',finish,{once:true});
  video.addEventListener('error',()=>{retry.textContent='영상 로딩 실패 · 다시 시도';retry.hidden=false;},{once:true});
  retry.onclick=()=>{retry.hidden=true;video.muted=false;video.load();video.play().catch(()=>{retry.hidden=false;retry.textContent='영상 재생하기';});};
  overlay.append(video,retry);document.body.append(overlay);
  video.muted=true;video.play().catch(()=>{retry.hidden=false;});
 }

 // CH01 uses one desk input screen. No nested notice/second modal.
 function openReceptionCodePanel(){
  if($('hmReceptionCodeModal'))return;
  const root=document.createElement('section');root.id='hmReceptionCodeModal';
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
  root.setAttribute('aria-label','접수대 봉인 해제');
  root.style.cssText='position:fixed;inset:0;z-index:999997;background:#08080aec;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto';
  const card=document.createElement('div');card.style.cssText='position:relative;width:min(520px,100%);max-height:90dvh;overflow:auto;padding:27px 20px;border:1px solid #887781;border-radius:9px;background:linear-gradient(145deg,#262026,#100d12 80%);box-shadow:0 18px 75px #000;color:#e9e1e5';
  const label=document.createElement('div');label.textContent='回明病院  /  RECEPTION';label.style.cssText='font:11px serif;letter-spacing:.25em;color:#a6a0a4';
  const title=document.createElement('h2');title.textContent='접수대 · 봉인 번호';title.style.cssText='font:700 22px serif;margin:12px 0 8px';
  const regulation=document.createElement('div');
  regulation.style.cssText='margin:18px 0 16px;padding:18px 10px;border-top:1px solid #78666d;border-bottom:1px solid #78666d;text-align:center;color:#f0e4e6;font:15px/2.1 serif;white-space:pre-line';
  regulation.textContent='回明病院 · 접수 기록 보안 지침\n\n제01조 · 봉인 해제 절차\n\n비친 것을 먼저 헤아리고,\n\n잠긴 것의 빈자리를 채운 뒤,\n\n마지막으로 남겨진 기록을 대조하라.\n\n※ 순서를 어길 경우 봉인은 해제되지 않습니다.';
  const guide=document.createElement('p');guide.textContent='거울의 얼룩, 캐비닛의 빈자리, 접수명부의 인원을 팀원들과 대조해 봉인 번호를 채우세요.';guide.style.cssText='font:13px/1.8 system-ui;color:#c4b8be';
  const inputs=[],cells=document.createElement('div');cells.style.cssText='display:grid;grid-template-columns:repeat('+receptionAnswerLength+',minmax(0,1fr));gap:6px;margin:20px 0 13px';
  for(let i=0;i<receptionAnswerLength;i++){
   const field=document.createElement('input');field.type='text';field.inputMode='numeric';field.autocomplete='off';field.maxLength=1;field.setAttribute('aria-label',(i+1)+'번째 봉인 숫자');
   field.style.cssText='width:100%;min-width:0;height:54px;text-align:center;font:700 23px monospace;color:#f4e8e7;background:#0a0a0b;border:1px solid #80747c;border-radius:4px';
   field.oninput=()=>{field.value=field.value.replace(/\D/g,'').slice(0,1);if(field.value&&inputs[i+1])inputs[i+1].focus();};
   field.onkeydown=e=>{if(e.key==='Backspace'&&!field.value&&inputs[i-1])inputs[i-1].focus();};
   inputs.push(field);cells.append(field);
  }
  const status=document.createElement('p');status.id='hmReceptionCheckStatus';status.setAttribute('role','status');status.style.cssText='min-height:28px;font:13px/1.5 system-ui;color:#d7afb9';
  const submit=document.createElement('button');submit.type='button';submit.textContent='봉인 해제 · 다음 챕터';submit.style.cssText='width:100%;padding:15px;background:#583744;color:white;border:1px solid #997788;border-radius:7px;font:700 15px system-ui';
  submit.onclick=()=>{
   if(socket?.readyState!==NativeWS.OPEN){status.textContent='협동 서버 연결을 먼저 확인하세요.';return;}
   if(phase!=='separated'){status.textContent='강제 분리 조사가 끝난 뒤 봉인을 입력하세요.';return;}
   const answer=inputs.map(i=>i.value).join('');
   if(answer.length!==receptionAnswerLength){status.textContent=receptionAnswerLength+'자리 숫자를 모두 입력하세요.';return;}
   socket.send(JSON.stringify({type:'chapter',action:'reception_submit',answer}));status.textContent='봉인 번호를 대조하고 있습니다…';
  };
  const back=document.createElement('button');back.type='button';back.textContent='← 접수실로 돌아가기';back.style.cssText='display:block;margin:0 0 16px;padding:9px 0;border:0;background:transparent;color:#d8c5ce;font:13px system-ui';
  back.onclick=()=>root.remove();
  card.append(back,label,title,regulation,guide,cells,status,submit);root.append(card);document.body.append(root);
  inputs[0].focus();
 }
 function showReceptionAnswerResult(message){
  const status=$('hmReceptionCheckStatus');if(!status)return;
  status.textContent=message.message||(message.ok?'봉인 번호가 일치합니다.':'숫자를 다시 확인하세요.');
  status.style.color=message.ok?'#b8e3c6':'#f2b5c1';
 }

  // G08 is owned by the transition above; all other approved horror videos
 // continue through the original V172 media handler unchanged.
 function installG08MediaRouting(){
  const media=window.hmMedia;
  if(!media||typeof media.handle!=='function'||media.__hmG08Routed)return;
  const original=media.handle.bind(media);
  media.handle=function(message){if(message?.type==='horror_video'&&(['G08','G01','RECEPTION_HAND'].includes(message.id)||(phase==='ch02'&&message.id!=='H01')))return;return original(message);};
  media.__hmG08Routed=true;
 }
 installG08MediaRouting();

 // CH01 legacy sensory guide removed. Visual scene clues are canonical.
  // Object-first investigation UI: keep original buttons, event handlers and server rules.
 function enhanceChapterInteractions(){
  const chapters=[
   ['ch02PuzzlePanel','208호 병실','침대·서랍·모니터에서 흔적을 찾고 두 사람이 안전장치를 조작하세요.','data-ch02'],
   ['ch03PuzzlePanel','엘리베이터','층수 패널·거울·스피커를 조사하고 비상 패널을 복원하세요.','data-ch03'],
   ['ch04PuzzlePanel','기록보관실','퇴실 대장과 CCTV, 내선 기록을 비교해 사건을 재구성하세요.','data-ch04'],
   ['ch05PuzzlePanel','격리실','압력 기록과 관찰창을 비교한 뒤 밸브를 번갈아 조작하세요.','data-ch05'],
   ['ch06PuzzlePanel','여덟 번째 문','기록과 거울의 차이를 확인하고 다섯 파편을 판독해 복원하세요.','data-ch06']
  ];
  const investigative=/inspect|explore|clue|witness|sample|record|corridor|room302|wheelchair|surgery|fragment_search|horror_inspect|artifact_inspect/;
  for(const [id,title,description,attr] of chapters){
   const panel=$(id);if(!panel||panel.querySelector('.hm-object-guide'))continue;
   const guide=document.createElement('div');guide.className='hm-object-guide';
   guide.style.cssText='margin:10px 0;padding:12px 13px;border:1px solid #65536d;border-radius:10px;background:#18111fe8;color:#eee4f4;line-height:1.65';
   const heading=document.createElement('strong');heading.textContent='현장 조사 · '+title;
   const body=document.createElement('p');body.textContent=description;body.style.cssText='margin:5px 0 8px;font-size:12px;color:#cbbcd4';
   const status=document.createElement('div');status.textContent='조사할 물건을 터치하세요. 단서는 아래 조사 기록에 표시됩니다.';status.style.cssText='font-size:12px;color:#d7bddc';
   guide.append(heading,body,status);
   const first=panel.querySelector('strong');first?.after(guide);
   const buttons=[...panel.querySelectorAll('button['+attr+']')];
   for(const button of buttons){
    const action=button.getAttribute(attr)||'';
    button.style.cssText+=';min-height:44px;border-radius:9px;touch-action:manipulation;';
    if(investigative.test(action)){
     button.style.cssText+=';background:linear-gradient(145deg,#3a293b,#211925);border:1px solid #806b81;';
     button.addEventListener('click',()=>{status.textContent='조사 중: '+button.textContent.trim()+' · 결과를 확인하고 팀원에게 공유하세요.';},{passive:true});
    }
   }
   const result=panel.querySelector('[id$="Result"]');
   if(result){result.style.cssText+=';padding:10px;border-left:3px solid #8e657d;background:#130f19;border-radius:5px;';result.setAttribute('aria-live','polite');}
  }
  // CH01: use the existing real desk hotspot and the existing server inspect action.
  // No invented puzzle, extra item or automatic answer.

 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceChapterInteractions,{once:true});else enhanceChapterInteractions();

 // Old separate reception-result rendering removed; the desk uses showReceptionAnswerResult().
 // Legacy split trigger removed; the sole explicit trigger is mountDirectInvestigation().

  // V176: remove the obsolete text board instead of mounting and hiding another copy.
 // CH01 answers now exist only at the scene's 접수대.

  // The approved V172 CH01 investigation opens a separate investigation-record
 // window, not #ch01PuzzlePanel. Move the new cooperative board into that
 // visible window whenever it opens, without destroying legacy puzzle handlers.
 // CH01 clues are inspected from the approved photorealistic scene, not the
 // old textual investigation record. Keep old controls in DOM for compatibility.
 // CH01 must use only the approved V172 photorealistic scene.
 // Remove the obsolete four-tab textual control surface from the player UI.
 function hideLegacyCh01Record(){
  if(!active||!['reception','separated'].includes(phase))return;
  const names=new Set(['조사 기록','공동 수사판','심전도 복원','내 제어판']);
  const buttons=[...document.querySelectorAll('button,[role="tab"]')].filter(el=>names.has(el.textContent.trim()));
  for(const btn of buttons){
   const strip=btn.parentElement;
   if(strip&&[...strip.querySelectorAll('button,[role="tab"]')].filter(el=>names.has(el.textContent.trim())).length>=3){
    strip.hidden=true;strip.style.display='none';
   }else{btn.hidden=true;btn.style.display='none';}
  }
  // The old record is a legacy modal/sheet. Return to the actual scene.
  const legacy=[...document.querySelectorAll('p,div,section')].find(el=>el.children.length===0&&/실사형 접수실에서 사물을 터치해 단서를 확인하세요/.test(el.textContent||'')&&el.getClientRects().length);
  if(legacy){
   const returnBtn=[...document.querySelectorAll('button')].find(el=>/현장으로/.test(el.textContent||'')&&el.getClientRects().length&&!el.closest('#hmSceneClueOverlay,#hmReceptionCodeModal'));
   if(returnBtn&&!returnBtn.dataset.hmAutoReturned){returnBtn.dataset.hmAutoReturned='1';returnBtn.click();}
  }
  const legacyPanel=$('ch01PuzzlePanel');
  if(legacyPanel){legacyPanel.hidden=true;legacyPanel.style.display='none';}
  const board=$('hmReceptionCoop');
  if(board){board.hidden=true;board.style.display='none';}
 }
 document.addEventListener('hm-v175-state',hideLegacyCh01Record);
 document.addEventListener('click',()=>requestAnimationFrame(hideLegacyCh01Record));
 const legacyWatcher=new MutationObserver(()=>{if(active&&['reception','separated'].includes(phase))requestAnimationFrame(hideLegacyCh01Record);});
 legacyWatcher.observe(document.body||document.documentElement,{childList:true,subtree:true});


 // The V172 original scene contains the desk drawer hotspot, but no plain
 // desk hotspot. Keep the real drawer/video and add a separate seal desk input.
 function ensureReceptionDesk(){
  const original=$('deskButton');
  if(!original)return;
  original.dataset.object='desk';
  original.setAttribute('aria-label','접수대');
  // Old V174 separate seal control must not be a second way into the code.
  $('hmReceptionDeskSealButton')?.remove();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureReceptionDesk,{once:true});else ensureReceptionDesk();
 document.addEventListener('hm-v175-started',ensureReceptionDesk);
 document.addEventListener('hm-v175-state',ensureReceptionDesk);

 // The one canonical CH01 inspection screen replaces the old text clue sheet.
 // It renders only the evidence the player can observe, not the server answer.
 function showSceneClue(message){
  if(!message||!['mirror','cabinet','ledger'].includes(message.object))return;
  $('hmCh01InspectionScreen')?.remove();
  $('hmSceneClueOverlay')?.remove();
  const root=document.createElement('section');root.id='hmCh01InspectionScreen';
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
  root.setAttribute('aria-label',(message.label||'사물 조사')+' 화면');
  root.style.cssText='position:fixed;inset:0;z-index:999996;overflow:auto;padding:clamp(10px,4vw,30px);display:grid;place-items:center;background:radial-gradient(circle at 52% 34%,#202125,#080709 68%,#030304);color:#d9d4d0';
  const card=document.createElement('article');card.style.cssText='width:min(620px,100%);min-height:390px;padding:clamp(13px,4vw,26px);background:linear-gradient(155deg,#201e20,#0b0b0d 76%);border:1px solid #484347;box-shadow:0 24px 85px #000;display:flex;flex-direction:column;gap:13px';
  const heading=document.createElement('h2');heading.textContent=message.label||'현장 조사';heading.style.cssText='margin:0;font:600 21px serif;letter-spacing:.07em;color:#ded6ce';
  const clue=document.createElement('p');clue.style.cssText='font:13px/1.7 serif;letter-spacing:.03em;color:#bbb2af;margin:0';
  if(message.object==='mirror'){
   clue.textContent='각 조사원이 발견한 검은 얼룩의 개수를 모두 합산하라.';
   const frame=document.createElement('div');frame.setAttribute('aria-label','검은 얼룩이 묻은 거울');
   frame.style.cssText='position:relative;isolation:isolate;min-height:300px;height:min(56dvh,480px);overflow:hidden;border:14px ridge #343135;box-shadow:inset 0 0 60px 27px #07080aaa,0 0 0 2px #0b0a0b,0 24px 60px #000;background:radial-gradient(ellipse at 40% 48%,#5b62637c 0%,#33383b 36%,#121417 82%),linear-gradient(112deg,#161719,#383b40 40%,#101113 73%)';
   const dust=document.createElement('div');dust.style.cssText='position:absolute;inset:0;pointer-events:none;opacity:.37;background:repeating-linear-gradient(109deg,transparent 0 22px,#adb2b208 23px 25px,transparent 26px 68px),radial-gradient(ellipse at 8% 83%,#070808ad,transparent 30%),radial-gradient(ellipse at 90% 12%,#0809099e,transparent 35%);mix-blend-mode:multiply';frame.append(dust);
   const count=Math.max(1,Math.min(4,Math.floor(Number(message.shadowCount)||1)));
   const coords=[[17,26],[64,17],[40,62],[77,66]];
   for(let i=0;i<count;i++){
    const spot=document.createElement('span'),[left,top]=coords[i];
    const height=[74,92,78,95][i],width=[76,67,81,73][i];
    spot.setAttribute('aria-hidden','true');
    spot.style.cssText='position:absolute;left:'+left+'%;top:'+top+'%;width:'+width+'px;height:'+height+'px;transform:rotate('+[-18,9,22,-12][i]+'deg);border-radius:42% 58% 67% 33% / 51% 33% 67% 49%;background:radial-gradient(ellipse at 49% 49%,#030305 0 29%,#07080ae8 43%,#101114c4 59%,transparent 80%);filter:blur(5px);box-shadow:0 0 29px 12px #0304056b';
    const smear=document.createElement('span');smear.style.cssText='position:absolute;left:25%;top:68%;width:43%;height:47%;transform:rotate(11deg);border-radius:27% 73% 77% 23%;background:linear-gradient(#050607b8,transparent);filter:blur(3px)';
    spot.append(smear);frame.append(spot);
   }
   const glint=document.createElement('div');glint.style.cssText='position:absolute;inset:0;pointer-events:none;background:linear-gradient(107deg,transparent 17%,#efffff14 24%,transparent 29% 66%,#d9e5eb0b 72%,transparent 78%);mix-blend-mode:screen';frame.append(glint);card.append(frame);
  }else if(message.object==='cabinet'){
   clue.textContent='각 조사원의 기록에서 가려진 ○의 숫자를 찾아 모두 더하라. 합계의 일의 자리만 사용하라.';
   const steel=document.createElement('div');steel.style.cssText='padding:24px 12px;min-height:250px;display:flex;flex-direction:column;justify-content:center;background:repeating-linear-gradient(99deg,#333436 0 2px,#27282a 4px 13px,#38393a 15px);border:13px ridge #555558;box-shadow:inset 0 0 45px #000,0 13px 32px #000';
   const stamp=document.createElement('div');stamp.textContent='回明病院   /   RECORD STORAGE';stamp.style.cssText='text-align:center;font:11px monospace;letter-spacing:.12em;color:#a2a2a5;margin-bottom:24px';steel.append(stamp);
   const row=document.createElement('div');row.style.cssText='display:flex;gap:6px;justify-content:center;align-items:center;flex-wrap:nowrap';
   const sequence=String(message.sequence||'').trim().split(/\s+/).filter(Boolean);
   for(const digit of sequence){
    const key=document.createElement('span');key.textContent=digit;key.style.cssText='flex:1;min-width:0;max-width:68px;text-align:center;padding:18px 2px;background:#111113;border:2px solid #77767b;box-shadow:inset 0 0 10px #000;color:'+(digit==='○'?'#cba1a8':'#e1deda')+';font:700 clamp(18px,6vw,30px) monospace';row.append(key);
   }
   steel.append(row);card.append(steel);
  }else if(message.object==='ledger'){
   clue.textContent='각 입원일에 기록된 입실 인원을 모두 합산하라. 날짜는 계산에 포함하지 않는다.';
   const paper=document.createElement('div');paper.style.cssText='min-height:320px;padding:28px 20px;background:repeating-linear-gradient(#c8bfa8 0 33px,#a99c89 34px,#c8bfa8 35px);border:9px solid #45382e;box-shadow:inset 0 0 55px #62534675,0 16px 42px #000;color:#30291f;transform:rotate(-.6deg)';
   const stamp=document.createElement('div');stamp.textContent='回明病院 · 접수 명부';stamp.style.cssText='font:700 22px serif;letter-spacing:.06em;border-bottom:2px solid #5e5343;padding:0 0 15px';paper.append(stamp);
   const detail=document.createElement('div');detail.textContent='11월 '+String(message.date||'')+'일   /   입실 '+String(message.people??'')+'명';detail.style.cssText='padding:55px 0 30px;font:700 clamp(21px,6vw,32px) serif;text-align:center';paper.append(detail);
   const seal=document.createElement('div');seal.textContent='담당자 서명 __________';seal.style.cssText='font:13px serif;text-align:right;opacity:.54';paper.append(seal);card.append(paper);
  }
  const close=document.createElement('button');close.type='button';close.textContent='← 접수실로 돌아가기';close.style.cssText='min-height:48px;margin-top:auto;border:1px solid #7e6973;border-radius:6px;background:#271e24;color:#ebe2e7;font:14px system-ui;cursor:pointer';
  close.onclick=()=>root.remove();
  card.prepend(heading,clue);card.append(close);root.append(card);document.body.append(root);close.focus();
 }

 

 // CH01 sound: the window-capture puzzle router stops later click listeners.
 // Play the original object SFX on pointerdown before that routing occurs.
 document.addEventListener('pointerdown',event=>{
  if(!active||phase!=='separated'||event.button>0)return;
  const origin=event.target instanceof Element?event.target:null;
  if(!origin||origin.closest('#hmCh01InspectionScreen,#hmReceptionCodeModal,#hmForcedSeparation,#hmReceptionScare,#hmReceptionHandScare,#hmCoopPanel,#hmV175Gate'))return;
  const target=origin.closest('[data-obj],[data-object],[data-hotspot],[data-action],#deskButton');
  if(!target)return;
  const raw=String(target.dataset.object||target.dataset.obj||target.dataset.hotspot||target.dataset.action||'').toLowerCase();
  const object=target.id==='deskButton'?'desk':raw;
  const file=hmSoundFiles[object];
  if(file)playHospitalSound(file,0.35);
 },true);

 // CH01 / step 1-1 ONLY: the approved V172 mirror has an older click
 // handler which opens a text-only demo. Window capture precedes that handler.
 // Do not intercept any other object or cinematic in this patch.
 window.addEventListener('click',event=>{
  if(!active||phase!=='separated'||socket?.readyState!==NativeWS.OPEN)return;
  const origin=event.target instanceof Element?event.target:null;
  if(!origin||origin.closest('#hmCh01InspectionScreen,#hmReceptionCodeModal,#hmForcedSeparation,#hmReceptionScare,#hmReceptionHandScare,#hmCoopPanel,#hmV175Gate'))return;
  const target=origin.closest('[data-obj="mirror"],[data-object="mirror"],[data-action="mirror"],[data-hotspot="mirror"]');
  if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();
  $('hmSceneClueOverlay')?.remove();
  socket.send(JSON.stringify({type:'chapter',action:'reception_clue',object:'mirror'}));
 },true);


 // CH01 / step 1-2 ONLY: cabinet hotspot takes precedence over the V172
 // text-only demo handler. Mirror and all existing cinematics remain untouched.
 window.addEventListener('click',event=>{
  if(!active||phase!=='separated'||socket?.readyState!==NativeWS.OPEN)return;
  const origin=event.target instanceof Element?event.target:null;
  if(!origin||origin.closest('#hmCh01InspectionScreen,#hmReceptionCodeModal,#hmForcedSeparation,#hmReceptionScare,#hmReceptionHandScare,#hmCoopPanel,#hmV175Gate'))return;
  const target=origin.closest('[data-obj="cabinet"],[data-object="cabinet"],[data-action="cabinet"],[data-hotspot="cabinet"]');
  if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();
  $('hmSceneClueOverlay')?.remove();
  socket.send(JSON.stringify({type:'chapter',action:'reception_clue',object:'cabinet'}));
 },true);


 // CH01 / step 1-3 ONLY: intercept the approved ledger hotspot before its
 // obsolete text clue handler. Preserve mirror, cabinet and all video triggers.
 window.addEventListener('click',event=>{
  if(!active||phase!=='separated'||socket?.readyState!==NativeWS.OPEN)return;
  const origin=event.target instanceof Element?event.target:null;
  if(!origin||origin.closest('#hmCh01InspectionScreen,#hmReceptionCodeModal,#hmForcedSeparation,#hmReceptionScare,#hmReceptionHandScare,#hmCoopPanel,#hmV175Gate'))return;
  const target=origin.closest('[data-obj="ledger"],[data-object="ledger"],[data-action="ledger"],[data-hotspot="ledger"]');
  if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();
  $('hmSceneClueOverlay')?.remove();
  socket.send(JSON.stringify({type:'chapter',action:'reception_clue',object:'ledger'}));
 },true);

 // CH01 / step 1-4 ONLY: the original reception desk is the sole entry.
 // Capture before V172's old drawer handler; show code only after video ends.
 window.addEventListener('click',event=>{
  if(!active||phase!=='separated'||socket?.readyState!==NativeWS.OPEN)return;
  const origin=event.target instanceof Element?event.target:null;
  if(!origin||origin.closest('#hmCh01InspectionScreen,#hmReceptionCodeModal,#hmForcedSeparation,#hmReceptionScare,#hmReceptionHandScare,#hmCoopPanel,#hmV175Gate'))return;
  const target=origin.closest('#deskButton,[data-obj="desk"],[data-object="desk"],[data-action="desk"],[data-hotspot="desk"],[data-obj="drawer"],[data-object="drawer"]');
  if(!target||target.id==='hmReceptionDeskSealButton')return;
  event.preventDefault();event.stopImmediatePropagation();
  $('hmSceneClueOverlay')?.remove();
  playReceptionHand();
 },true);

 // CH01 single object router: exact hotspot identity, never a parent's text.
 // In particular a ledger click may never be interpreted as a desk/drawer click.
 document.addEventListener('click',event=>{
  if(!active||socket?.readyState!==NativeWS.OPEN||!['reception','separated'].includes(phase))return;
  const origin=event.target instanceof Element?event.target:null;if(!origin)return;
  if(origin.closest('#hmCh01InspectionScreen,#hmReceptionCodeModal,#hmForcedSeparation,#hmReceptionScare,#hmReceptionHandScare,#hmCoopPanel,#hmV175Gate,#hmV174Chat'))return;
  const target=origin.closest('button,[role="button"],[data-action],[data-object],[data-hotspot],[aria-label]');
  if(!target||target.closest('#ch01PuzzlePanel,#hmReceptionCoop,[data-menu]'))return;
  const label=(target.getAttribute('aria-label')||target.getAttribute('title')||target.textContent||'').replace(/\s+/g,' ').trim().replace(/^[◈▤📋📖]\s*/u,'');
  const raw=String(target.dataset.object||target.dataset.obj||target.dataset.action||target.dataset.hotspot||'').toLowerCase().trim();
  let object=null;
  if(/^(?:접수\s*명부|접수\s*명부 조사|접수\s*명부 열기)$/.test(label))object='ledger';
  else if(/^(?:거울|균열 난 거울|거울 조사)$/.test(label))object='mirror';
  else if(/^(?:캐비닛|잠긴 캐비닛|보관함|잠긴 보관함|서류함)$/.test(label))object='cabinet';
  else if(/^(?:접수대 서랍|서랍)$/.test(label))object='drawer';
  else if(/^접수대 · 봉인 번호 입력$/.test(label))object='desk';
  else if(/^(?:접수대|접수대 조사|봉인 번호 입력)$/.test(label))object='desk';
  else object={ledger:'ledger',mirror:'mirror',cabinet:'cabinet',drawer:'drawer',reception_drawer:'drawer',desk:'desk',reception_desk:'desk'}[raw]||null;
  if(!object)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(phase!=='separated'){showConnectionStatus('접수실 조사 시작 버튼을 눌러 강제 분리를 완료한 뒤 조사해 주세요.');return;}
  if(object==='desk'||object==='drawer'){playReceptionHand();return;}
  socket.send(JSON.stringify({type:'chapter',action:'reception_clue',object}));
 },true);

  // The new CH01 investigation controls remain usable after the split.
 // Original uploaded audio files. This bridge never alters the approved videos,
 // chapter voices, artifact inventory or doll assembly.
 const hmSoundRoot='https://gb1026gb00-cell.github.io/hoemyeong-hospital/audio/';
 const hmSoundFiles={
  desk:'paper_pages.mp3',mirror:'glass_shatter.mp3',cabinet:'metal_scrape.mp3',ledger:'paper_pages.mp3',
  door:'door_rusty.mp3',drawer:'door_opening.mp3',panel:'electric_buzz.mp3',
  clock:'clock_ticking.mp3',camera:'electric_buzz.mp3',speaker:'unclear_whisper.mp3',
  corridor:'running.mp3',wheelchair:'chair.mp3',glass:'knocking.mp3',
  bell:'metal_hit.mp3',valve:'metal_scrape.mp3',
  doll:'laugh_doll.mp3',fragment:'low_drone.mp3'
 };
 let hmAudioUnlocked=false,hmSoundLast=0;
 const hmSoundActive=new Set();
 function playHospitalSound(file,volumeFactor=0.48){
  if(!hmAudioUnlocked||!file||!Object.values(hmSoundFiles).includes(file)&&![
   'hallway_steps.wav','door_slam.mp3','laugh_woman.mp3','behind_you_breath.wav',
   'floor_steps.mp3','heart_monitor.mp3','distant_thunder.wav','crying.mp3',
   'elevator_ding.mp3','scare_stinger.wav','heartbeat.mp3','door_scratching.mp3',
   'fluorescent_fault_new.mp3','scream.mp3'
  ].includes(file))return;
  const now=Date.now();if(now-hmSoundLast<350)return;hmSoundLast=now;
  if(hmSoundActive.size>=2)return;
  const v=soundVolume();if(v<=0)return;
  const a=new Audio(hmSoundRoot+file);a.preload='auto';a.volume=Math.min(1,v*volumeFactor);
  hmSoundActive.add(a);
  const clean=()=>{hmSoundActive.delete(a);a.removeAttribute('src');};
  a.addEventListener('ended',clean,{once:true});a.addEventListener('error',clean,{once:true});
  a.play().catch(clean);
 }
 function handleHospitalSoundEvent(m){
  if(m.type==='doll_event'&&m.event==='complete')playHospitalSound('laugh_doll.mp3',0.65);
  if(m.type==='fragment_result'&&m.ok&&!m.already)playHospitalSound('low_drone.mp3',0.3);
  if(m.type==='reception_clue'&&m.object==='desk')playHospitalSound('paper_pages.mp3',0.4);
  if(m.type==='chapter_event'&&m.event==='escape')playHospitalSound('door_slam.mp3',0.55);
  if(m.type==='ch02_event'&&m.event==='cleared')playHospitalSound('door_rusty.mp3',0.5);
  if(m.type==='ch03_event'&&m.event==='enter')playHospitalSound('elevator_ding.mp3',0.55);
  if(m.type==='ch04_event'&&m.event==='enter')playHospitalSound('paper_pages.mp3',0.4);
  if(m.type==='ch05_event'&&m.event==='enter')playHospitalSound('door_slam.mp3',0.6);
  if(m.type==='ch06_event'&&m.event==='enter')playHospitalSound('heartbeat.mp3',0.35);
 }
 function installHospitalSoundEffects(){
  document.addEventListener('pointerdown',()=>{hmAudioUnlocked=true;},{capture:true,passive:true});
  document.addEventListener('keydown',()=>{hmAudioUnlocked=true;},{capture:true,passive:true});
  document.addEventListener('click',event=>{
   if(!active)return;
   const b=event.target.closest('button');if(!b)return;
   const object=b.dataset.object||b.dataset.site||b.dataset.station||'';
   const action=b.dataset.action||b.dataset.ch01||b.dataset.ch02||b.dataset.ch03||b.dataset.ch04||b.dataset.ch05||b.dataset.ch06||'';
   if(action==='bell')return; // G08 video and original voice own the transition.
   if(action==='fragment_search'||action==='artifact_inspect')return;
   if(action==='ch02_corridor')return playHospitalSound('running.mp3',0.4);
   if(action==='ch02_wheelchair')return playHospitalSound('chair.mp3',0.5);
   if(action==='ch02_room302')return playHospitalSound('door_scratching.mp3',0.5);
   if(action==='ch03_enter'||action==='ch04_enter'||action==='ch05_enter'||action==='ch06_enter')return playHospitalSound('door_rusty.mp3',0.45);
   if(action==='ch02_pressure'||action==='ch05_valve')return playHospitalSound('metal_scrape.mp3',0.45);
   if(action==='ch06_switch'||action==='ch02_switch')return playHospitalSound('metal_hit.mp3',0.45);
   if(action==='ch02_explore'&&object==='bed')return playHospitalSound('breathing.mp3',0.35);
   if(action==='ch02_explore'&&object==='monitor')return playHospitalSound('heart_monitor.mp3',0.35);
   if(object&&hmSoundFiles[object])playHospitalSound(hmSoundFiles[object],0.35);
  },true);
  // CH02 2-1: read-only death certificate preview on the existing 302-room bed hotspot.
 // Do not replace the original puzzle handlers or trigger any horror media here.
 function openCh02CertificatePreview(){
  if(document.getElementById('hmCh02CertificatePreview'))return;
  const overlay=document.createElement('div');
  overlay.id='hmCh02CertificatePreview';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','회명병원 사망진단서');
  overlay.style.cssText='position:fixed;inset:0;z-index:999997;overflow:auto;display:grid;place-items:center;padding:16px;background:#050507ed';
  const sheet=document.createElement('section');
  sheet.style.cssText='position:relative;width:min(540px,100%);min-height:430px;padding:clamp(22px,5vw,42px);background:linear-gradient(135deg,#d2c6ad,#a99c86);color:#29251f;border:1px solid #746854;box-shadow:0 18px 75px #000;font-family:serif';
  const close=document.createElement('button');close.type='button';close.textContent='닫기 ×';close.setAttribute('aria-label','사망진단서 닫기');
  close.style.cssText='position:absolute;right:14px;top:12px;padding:8px 12px;background:#29211e;color:#f5e9d7;border:1px solid #675b50;cursor:pointer';
  const title=document.createElement('h2');title.textContent='回明病院 · 사망진단서';title.style.cssText='margin:30px 0 22px;text-align:center;font-size:24px;letter-spacing:.05em;border-bottom:2px solid #51483b;padding-bottom:18px';
  const content=document.createElement('div');content.style.cssText='line-height:2.4;font-size:15px;white-space:pre-line';
  content.textContent='문서 번호 : HM-302-□□□□\\n환자 성명 : [기록 훼손]\\n사망 일시 : [판독 불가]\\n사망 원인 : [판독 불가]\\n담당 의사 : [서명 훼손]';
  const foot=document.createElement('p');foot.textContent='※ 조사 기록 확인용 · 다음 단계에서 단서가 복원됩니다.';foot.style.cssText='margin-top:32px;padding-top:16px;border-top:1px solid #756b5a;font-size:12px';
  const dismiss=()=>overlay.remove();close.addEventListener('click',dismiss);
  overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss()});
  sheet.append(close,title,content,foot);overlay.append(sheet);document.body.append(overlay);
 }
 document.addEventListener('click',event=>{
  if(!active||phase!=='ch02')return;
  const target=event.target.closest('button,[data-action],[data-ch02],[data-object],[data-site]');
  if(!target||target.closest('#hmCh02CertificatePreview'))return;
  const action=String(target.dataset.action||target.dataset.ch02||'').toLowerCase();
  const object=String(target.dataset.object||target.dataset.site||target.dataset.station||'').toLowerCase();
  if(action==='ch02_explore'&&['bed','patient_record','chart','record'].includes(object))openCh02CertificatePreview();
 },true);
 // CH02 rebuild v1: retain ONLY the approved ward photograph and create four
 // invisible object hit areas. Old V172 ward hotspots and menus are not used.
 const rebuildStyle=document.createElement('style');
 rebuildStyle.textContent=[
 'html.hm-ch02-clean #hmWardScene .ward-hot',
 'html.hm-ch02-clean #hmWardScene .ward-bottom',
 'html.hm-ch02-clean #hmWardScene .hm-horror-site',
 'html.hm-ch02-clean #hmWardScene #hmWardMenu',
 'html.hm-ch02-clean #hmCh02UnderBedHotspot',
 'html.hm-ch02-clean #hmWard02',
 'html.hm-ch02-clean #hmWardScene [data-ward-action]',
 'html.hm-ch02-clean #hmWardScene .ward-top button'
 ].join(',')+'{display:none!important}'+
 '#hmWardScene .hm-ch02-new-target{position:absolute;z-index:55;display:block;border:0;background:transparent;color:transparent;padding:0;border-radius:0;box-shadow:none;cursor:pointer;touch-action:manipulation}'+
 '#hmWardScene .hm-ch02-new-target:focus-visible{outline:2px solid #ddd}'+
 'html:not(.hm-ch02-clean) #hmWardScene .hm-ch02-new-target{display:none!important}';
 document.head.append(rebuildStyle);
 const rebuiltTargets=[
  ['certificate','침대 위 사망진단서', 'left:24%;top:43%;width:53%;height:27%'],
  ['hand','침대 아래 손 영상','left:28%;top:76%;width:52%;height:17%'],
  ['ecg','벽 전기코드 심전도','left:43%;top:27%;width:39%;height:13%'],
  ['eight','침대 끝 8번 표지','left:0%;top:70%;width:28%;height:17%']
 ];
 function mountRebuiltWard(){
  const root=document.getElementById('hmWardScene');
  if(!root||root.querySelector('.hm-ch02-new-target'))return;
  for(const [kind,label,coords] of rebuiltTargets){
   const b=document.createElement('button');b.type='button';b.className='hm-ch02-new-target';b.dataset.ch02New=kind;
   b.setAttribute('aria-label',label);b.title=label;b.style.cssText=coords;
   b.addEventListener('click',event=>{
    event.preventDefault();event.stopImmediatePropagation();
    if(!active||phase!=='ch02')return;
    if(kind==='certificate')openCh02CertificatePreview();
    else if(kind==='hand')openCh02RebuildNote('침대 아래 · 손 영상과 암호 입력은 다음 단계에서 연결됩니다.');
    else if(kind==='ecg')openCh02RebuildNote('전기코드 · 심전도 기록은 다음 단계에서 연결됩니다.');
    else openCh02RebuildNote('8번 표지 · 숨겨진 기록은 다음 단계에서 연결됩니다.');
   },true);
   root.append(b);
  }
 }
 function openCh02RebuildNote(message){
  document.getElementById('hmCh02RebuildNote')?.remove();
  const layer=document.createElement('div');layer.id='hmCh02RebuildNote';layer.style.cssText='position:fixed;inset:0;z-index:999997;display:grid;place-items:center;padding:20px;background:#050407dc';
  const card=document.createElement('div');card.style.cssText='width:min(450px,100%);padding:28px;background:#1d1821;color:#e7dce8;border:1px solid #6a576c;border-radius:10px;text-align:center;font:15px/1.8 system-ui';
  const p=document.createElement('p');p.textContent=message;const close=document.createElement('button');close.type='button';close.textContent='닫기';close.style.cssText='padding:10px 22px;color:white;background:#423047;border:1px solid #927f94;border-radius:8px';close.onclick=()=>layer.remove();card.append(p,close);layer.append(card);document.body.append(layer);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountRebuiltWard,{once:true});else mountRebuiltWard();
 document.addEventListener('hm-v175-state',mountRebuiltWard);
 // All CH02 legacy horror triggers are blocked at the original video queue.
 // H01 will be re-enabled only when the new under-bed sequence is implemented.
 function guardCh02Horror(){
  const media=window.HMCanvasHorror;
  if(!media||typeof media.enqueue!=='function'||media.__ch02RebuiltGuard)return;
  const original=media.enqueue.bind(media);
  media.enqueue=function(id){if(active&&phase==='ch02')return;return original(id)};
  media.__ch02RebuiltGuard=true;
 }
 guardCh02Horror();
 document.addEventListener('hm-v175-state',guardCh02Horror);
 // CH02 standalone investigation layer; approved scene photo remains untouched.
 const ch02Css=document.createElement('style');
 ch02Css.textContent='html.hm-ch02-clean #ch02PuzzlePanel,html.hm-ch02-clean .hm-object-guide,html.hm-ch02-clean .narrative,html.hm-ch02-clean #sceneNarrative,html.hm-ch02-clean #sceneDescription,html.hm-ch02-clean #sceneText,html.hm-ch02-clean .scene-caption{display:none!important}html.hm-ch02-clean #mainScene>:not(img):not(#hmCh02NewLayer){display:none!important}html.hm-ch02-clean #hmCh02NewLayer{display:block!important}#hmCh02NewLayer{position:absolute;inset:0;z-index:999;pointer-events:none}#hmCh02NewLayer button{position:absolute;pointer-events:auto;background:transparent;border:0;color:transparent;font-size:0;touch-action:manipulation}#hmCh02NewLayer button:focus-visible{outline:2px solid #e9c6d7}';
 document.head.append(ch02Css);
 let ch02HandPending=false;
 function ch02Send(action,extra={}){
  if(socket?.readyState===NativeWS.OPEN)socket.send(JSON.stringify({type:'chapter',action,...extra}));
  else if(phase==='ch02')ch02Dialog('연결 확인 필요','협동 서버에 연결되지 않았습니다. 접속 상태를 확인해 주세요.');
 }
 function showCh02BedTags(message){
  document.getElementById('hmCh02NewDialog')?.remove();
  const wrap=document.createElement('div');wrap.id='hmCh02NewDialog';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');
  wrap.style.cssText='position:fixed;inset:0;z-index:999999;background:#070608ed;display:grid;place-items:center;padding:15px;overflow:auto';
  const paper=document.createElement('section');paper.style.cssText='width:min(530px,100%);max-height:90dvh;overflow:auto;padding:22px 19px 27px;border:2px solid #776a56;background:linear-gradient(155deg,#c8bda7,#968a77);color:#29251f;box-shadow:0 20px 65px #000;font:15px/1.7 serif';
  const close=document.createElement('button');close.type='button';close.textContent='닫기 ×';close.style.cssText='float:right;background:#2f2925;color:#fff;border:0;padding:8px 12px';close.onclick=()=>wrap.remove();paper.append(close);
  const h=document.createElement('h2');h.textContent='回明病院 · 8번 병상';h.style.cssText='clear:both;font-size:23px;margin:15px 0 6px';paper.append(h);
  const sub=document.createElement('p');sub.textContent='병상 표지 뒷면 / 환자 인식표 · 장비 배정표';sub.style.cssText='border-bottom:2px solid #635846;padding-bottom:13px;font-size:13px';paper.append(sub);
  if(message.locked){
   const p=document.createElement('p');p.textContent='표지 뒷면의 인식표는 대조 기록 담당 조사원에게 배정되었습니다. 팀원의 조사 결과를 공유하세요.';paper.append(p);
  }else{
   const note=document.createElement('p');note.textContent='조사원 '+(message.role+1)+' · 확인 가능한 인식표 '+message.records.length+'개';note.style.cssText='font-size:12px';paper.append(note);
   for(const record of message.records){
    const tag=document.createElement('div');tag.style.cssText='margin:13px 0;padding:13px 15px;border:1px solid #5d5648;background:#e1d7c5a8;box-shadow:inset 0 0 16px #897b6360';
    const id=document.createElement('div');id.textContent='PATIENT ID : '+record.patient;id.style.cssText='font:600 13px monospace';tag.append(id);
    const dev=document.createElement('div');dev.textContent='MONITOR : '+record.device;dev.style.cssText='font:13px monospace;margin-top:5px';tag.append(dev);
    const letter=document.createElement('div');letter.textContent=record.letter;letter.style.cssText='font:bold 32px serif;text-align:right;color:#733b35;border-top:1px dashed #7c6d58;margin-top:10px';tag.append(letter);
    paper.append(tag);
   }
  }
  const rule=document.createElement('p');rule.textContent='희미한 손글씨: “'+message.rule+'”';rule.style.cssText='margin-top:22px;border-top:1px solid #6b5e4c;padding-top:14px;font-style:italic;font-size:14px';paper.append(rule);
  wrap.append(paper);document.body.append(wrap);
 }
 function showCh02ECG(message){
  document.getElementById('hmCh02NewDialog')?.remove();
  const wrap=document.createElement('div');wrap.id='hmCh02NewDialog';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');
  wrap.style.cssText='position:fixed;inset:0;z-index:999999;background:#030806ef;display:grid;place-items:center;padding:16px;overflow:auto';
  const panel=document.createElement('section');panel.style.cssText='position:relative;width:min(540px,100%);max-height:90dvh;overflow:auto;border:2px solid #26483a;border-radius:5px;background:linear-gradient(135deg,#0b1b17,#020907);color:#a8e6c4;padding:20px 16px 24px;box-shadow:0 0 50px #05160f;font:14px/1.65 monospace';
  const close=document.createElement('button');close.textContent='닫기 ×';close.type='button';close.style.cssText='float:right;background:#24392f;color:#e6f9e9;border:1px solid #426b50;padding:8px 12px';close.onclick=()=>wrap.remove();panel.append(close);
  const h=document.createElement('h2');h.textContent='回明病院 · ECG ARCHIVE';h.style.cssText='clear:both;margin:12px 0 4px;font:600 19px system-ui;color:#c2f9d7';panel.append(h);
  const sub=document.createElement('p');sub.textContent='302호 / 복구된 심전도 원본 / 1988.11.26';sub.style.cssText='font-size:12px;color:#74a98b;margin:0 0 16px';panel.append(sub);
  const line=document.createElement('div');line.style.cssText='height:70px;border:1px solid #254333;background:repeating-linear-gradient(0deg,transparent 0 15px,#173524 16px),repeating-linear-gradient(90deg,transparent 0 18px,#173524 19px);margin-bottom:15px;overflow:hidden';
  line.innerHTML='<svg viewBox="0 0 320 70" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true"><path d="M0 39H25L31 36L38 39H48L55 51L61 8L69 61L77 39H120L126 36L133 39H143L150 51L156 8L164 61L172 39H220L226 36L233 39H243L250 51L256 8L264 61L272 39H320" fill="none" stroke="#70f0a0" stroke-width="2"/></svg>';panel.append(line);
  if(message.locked){
   const p=document.createElement('p');p.textContent='접근 제한: 원본 심전도는 대조 기록 담당 조사원에게 배정되어 있습니다. 팀원과 기록을 공유하세요.';panel.append(p);
  }else{
   const note=document.createElement('p');note.textContent='조사원 '+(message.role+1)+' · 복구 장비 기록 '+message.records.length+'건';panel.append(note);
   for(const record of message.records){
    const card=document.createElement('div');card.style.cssText='border-top:1px solid #315b42;padding:13px 4px';
    const title=document.createElement('strong');title.textContent=record.device+'  /  LAST SIGNAL '+record.last;title.style.cssText='display:block;color:#b5f9c9;font-size:15px';
    const detail=document.createElement('div');detail.textContent=record.signal+' · '+record.flag;detail.style.cssText='color:#81a996;margin-top:5px';
    card.append(title,detail);panel.append(card);
   }
  }
  const footer=document.createElement('p');footer.textContent='※ 장비번호와 환자번호의 연결 정보는 병상 인식표에 보관되어 있습니다.';footer.style.cssText='border-top:1px dashed #315b42;padding-top:12px;font-size:12px;color:#8baa99';panel.append(footer);
  wrap.append(panel);document.body.append(wrap);
 }
 function showCh02Certificate(message){
  document.getElementById('hmCh02NewDialog')?.remove();
  const wrap=document.createElement('div');wrap.id='hmCh02NewDialog';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');
  wrap.style.cssText='position:fixed;inset:0;z-index:999999;background:#050507f0;display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto';
  const paper=document.createElement('section');
  paper.style.cssText='position:relative;width:min(560px,100%);max-height:90dvh;overflow:auto;padding:26px clamp(17px,4vw,35px) 32px;color:#28231d;background:repeating-linear-gradient(174deg,#c7bba2 0px,#c7bba2 24px,#bfb399 25px,#c5b99f 27px);border:2px solid #796b55;box-shadow:0 20px 65px #000, inset 0 0 35px #77634d65;font:15px/1.65 serif';
  const close=document.createElement('button');close.type='button';close.textContent='닫기 ×';close.style.cssText='float:right;border:1px solid #55483d;background:#2e2520;color:#fff;padding:7px 12px;font:15px system-ui';
  close.onclick=()=>wrap.remove();paper.append(close);
  const header=document.createElement('div');header.style.cssText='clear:both;text-align:center;padding:14px 0 19px;border-bottom:3px double #4b3d32;margin-bottom:20px';
  const name=document.createElement('div');name.textContent='回明病院';name.style.cssText='font-size:17px;letter-spacing:5px';
  const title=document.createElement('h2');title.textContent='사 망 진 단 서';title.style.cssText='font-size:clamp(23px,5vw,30px);margin:9px 0 2px;letter-spacing:3px';
  const sub=document.createElement('div');sub.textContent='DEATH CERTIFICATE · 1988';sub.style.cssText='font:10px system-ui;letter-spacing:2px';
  header.append(name,title,sub);paper.append(header);
  const note=document.createElement('p');note.textContent='조사원 '+(message.role+1)+' · 배정된 문서 '+message.records.length+'건 / '+message.capacity+'인 협동 조사';note.style.cssText='font:12px system-ui;margin:0 0 18px;color:#564638';paper.append(note);
  for(const record of message.records){
   const page=document.createElement('div');page.style.cssText='position:relative;margin:0 0 18px;padding:13px 12px 18px;border:1px solid #7c6c57;background:#e3d7bc66';
   const top=document.createElement('div');top.textContent='회명병원 의무기록부   HM-302 / '+record.id;top.style.cssText='font:11px system-ui;border-bottom:1px solid #8b7b64;padding-bottom:9px;margin-bottom:11px';
   page.append(top);
   const rows=[['환자 성명',record.patient],['사망 일시','1988. 11. 26. '+record.time],['기재 사인',record.cause],['담당 의사','[서명 번짐]'],['수정 흔적',record.revision||'판독 불가']];
   for(const [label,value] of rows){
    const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:88px 1fr;border-bottom:1px solid #9b8a734d;min-height:41px;align-items:center;gap:8px';
    const l=document.createElement('span');l.textContent=label;l.style.cssText='font-size:12px;color:#5d5040';
    const v=document.createElement('span');v.textContent=value;row.append(l,v);page.append(row);
   }
   const stamp=document.createElement('div');stamp.textContent=record.stamp;stamp.style.cssText='margin:12px 0 0 auto;width:max-content;padding:5px 12px;border:2px solid #833e3b;color:#833e3b;transform:rotate(-9deg);font-weight:bold;opacity:.8';
   const trace=document.createElement('p');trace.textContent='기록 대조 메모: '+record.trace;trace.style.cssText='margin:22px 0 0;padding:10px;border-top:1px dashed #85735e;font-size:13px';
   page.append(stamp,trace);paper.append(page);
  }
  const footer=document.createElement('p');footer.textContent='※ 서로 다른 조사원이 확인한 문서를 대조하십시오.';footer.style.cssText='font-size:12px;margin-top:18px';paper.append(footer);
  wrap.append(paper);document.body.append(wrap);
 }
 let ch02ClearShown=false;
 function showCh02Clear(){
  if(ch02ClearShown&&document.getElementById('hmCh02ClearScene'))return;
  ch02ClearShown=true;
  document.getElementById('hmCh02NewDialog')?.remove();
  document.getElementById('hmCh02ClearScene')?.remove();
  const overlay=document.createElement('div');overlay.id='hmCh02ClearScene';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.style.cssText='position:fixed;inset:0;z-index:1000002;background:#020204f5;color:#ded5c5;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto;font-family:serif';
  const panel=document.createElement('section');panel.style.cssText='width:min(530px,100%);max-height:92dvh;overflow:auto;border:1px solid #66544c;padding:28px 22px 24px;background:linear-gradient(145deg,#141315,#070809);box-shadow:0 0 70px #000';
  const label=document.createElement('div');label.textContent='回明病院 / 302호 / 의무기록 정정';label.style.cssText='font:12px system-ui;letter-spacing:2px;color:#8b7b73;margin-bottom:18px';panel.append(label);
  const title=document.createElement('h2');title.textContent='02. 사망 판정의 오류';title.style.cssText='font-size:24px;margin:0 0 18px';panel.append(title);
  const original=document.createElement('div');original.textContent='DEATH CERTIFICATE : VALID';original.style.cssText='font:14px monospace;letter-spacing:1px;color:#a57676;text-decoration:line-through;margin-bottom:13px';panel.append(original);
  const invalid=document.createElement('div');invalid.textContent='DEATH CERTIFICATE : INVALID';invalid.style.cssText='font:600 15px monospace;letter-spacing:1px;color:#e3a6a2;margin-bottom:17px';panel.append(invalid);
  const status=document.createElement('div');status.textContent='PATIENT STATUS : ALIVE';status.style.cssText='font:600 19px monospace;color:#9ed4b0;border-top:1px solid #5c5551;border-bottom:1px solid #5c5551;padding:18px 0;margin-bottom:20px';panel.append(status);
  const story=document.createElement('p');story.textContent='네 장의 사망진단서에서 환자명이 하나씩 지워진다.\n마지막 문서의 빈칸에는, 이 방을 조사한 사람의 이름이 번져 나타난다.\n\n병실 문 안쪽에서 잠금장치가 풀리는 소리가 들린다.';story.style.cssText='white-space:pre-line;line-height:1.9;font-size:15px';panel.append(story);
  const artifact=document.createElement('div');artifact.style.cssText='margin:23px 0;padding:15px;border:1px solid #584756;background:#221b26';
  const aTitle=document.createElement('div');aTitle.textContent='제0유물 · 균열의 파편';aTitle.style.cssText='font-size:17px;color:#d9b8d9;font-weight:bold';artifact.append(aTitle);
  const aBody=document.createElement('p');aBody.textContent='302호의 봉인이 해제되었습니다. 파편이 공동 수집함에 등록되었습니다.';aBody.style.cssText='font-size:13px;margin:8px 0 0';artifact.append(aBody);panel.append(artifact);
  const next=document.createElement('button');next.type='button';next.textContent='병실로 돌아가기';next.style.cssText='display:block;width:100%;margin-top:22px;padding:13px;background:#382b37;border:1px solid #776073;color:#fff;font:15px system-ui';
  next.onclick=()=>overlay.remove();panel.append(next);
  const transition=document.createElement('div');transition.style.cssText='border-top:1px solid #4c4446;margin-top:22px;padding-top:19px';
  const prompt=document.createElement('p');prompt.textContent='병실의 봉인이 풀렸다. 복도 끝에서 엘리베이터가 한 번 울린다. 다음 구역으로 향할 준비가 되었는가?';prompt.style.cssText='font-size:14px;line-height:1.8';transition.append(prompt);
  const call=document.createElement('button');call.type='button';call.textContent=ch02IsHost?'03. 엘리베이터 호출':'03. 방장의 엘리베이터 호출 대기';call.disabled=!ch02IsHost;
  call.style.cssText='display:block;width:100%;padding:13px;background:#4a3340;color:#fff;border:1px solid #97758b;font:15px system-ui;'+(!ch02IsHost?'opacity:.55;cursor:not-allowed':'');
  const transitionStatus=document.createElement('p');transitionStatus.id='hmCh02TransitionStatus';transitionStatus.style.cssText='min-height:18px;color:#c9aeb8;font:12px/1.6 system-ui;margin-top:10px';
  if(!ch02IsHost)transitionStatus.textContent='협동 조사는 유지됩니다. 방장이 호출하면 모든 조사원이 함께 이동합니다.';
  call.onclick=()=>{
   if(!active||phase!=='ch02_cleared'||!ch02IsHost)return;
   if(!socket||socket.readyState!==NativeWS.OPEN){transitionStatus.textContent='서버 연결을 확인한 뒤 다시 시도하세요.';return;}
   transitionStatus.textContent='엘리베이터 호출 중…';
   ch02Send('ch03_enter');
  };
  transition.append(call,transitionStatus);panel.append(transition);
  overlay.append(panel);document.body.append(overlay);
 }
 function showCh02Answer(){
  ch02Dialog('02. 사망 판정의 오류',
   '죽은 자의 기록은 남아 있으나, 죽음의 증거는 남아 있지 않다.\n\n네 장의 사망진단서와 마지막 심장 신호를 대조하라.\n\n사망 판정 이후에도 심장이 뛰었던 시간.\n가장 오래 살아 있었던 자부터, 인식표에 남겨진 네 글자를 입력하라.',true);
 }
 function ch02Dialog(title,body,code=false){
  document.getElementById('hmCh02NewDialog')?.remove();
  const wrap=document.createElement('div');wrap.id='hmCh02NewDialog';
  wrap.style.cssText='position:fixed;inset:0;z-index:999999;background:#050507f2;display:grid;place-items:center;padding:18px;overflow:auto';
  const card=document.createElement('section');card.style.cssText='position:relative;width:min(540px,100%);padding:32px 22px;background:linear-gradient(135deg,#cfc3a8,#a99c86);color:#211c19;box-shadow:0 15px 70px #000;font:16px/1.8 serif';
  const h=document.createElement('h2');h.textContent=title;h.style.cssText='font-size:23px;margin:0 0 16px';
  const p=document.createElement('p');p.textContent=body;p.style.whiteSpace='pre-line';
  const close=document.createElement('button');close.textContent='닫기 ×';close.style.cssText='float:right;padding:8px 12px;background:#30232b;color:white;border:0';
  close.onclick=()=>wrap.remove();card.append(close,h,p);
  if(code){
   const input=document.createElement('input');input.maxLength=4;input.placeholder='영문 4글자';input.setAttribute('aria-label','사망 판정 정정 코드 네 글자');input.autocapitalize='characters';input.style.cssText='width:100%;padding:12px;font-size:22px;letter-spacing:7px;text-transform:uppercase';
   const submit=document.createElement('button');submit.textContent=code?'기록 정정':'봉인 해제';submit.style.cssText='display:block;margin-top:12px;padding:12px 18px;background:#30232b;color:#fff;border:0';
   const status=document.createElement('p');status.id='hmCh02NewStatus';
   submit.onclick=()=>ch02Send('ch02_new_solve',{answer:input.value.toUpperCase()});
   card.append(input,submit,status);
  }
  wrap.append(card);document.body.append(wrap);
 }
 function mountCh02New(){
  const scene=document.getElementById('mainScene');if(!scene)return;
  let layer=document.getElementById('hmCh02NewLayer');
  if(!layer){
   layer=document.createElement('div');layer.id='hmCh02NewLayer';
   const spots=[
    ['certificate','침대 위 사망진단서','17%','30%','67%','31%'],
    ['underbed','침대 아래 조사','22%','68%','59%','26%'],
    ['ecg','벽 전기코드','3%','20%','16%','30%'],
    ['eight','침대 끝 8번 표지','73%','49%','25%','24%']
   ];
   for(const [site,label,left,top,width,height] of spots){
    const btn=document.createElement('button');btn.type='button';btn.dataset.ch02New=site;btn.setAttribute('aria-label',label);btn.title=label;
    btn.style.left=left;btn.style.top=top;btn.style.width=width;btn.style.height=height;
    btn.addEventListener('click',e=>{
     e.preventDefault();e.stopImmediatePropagation();
     if(!active||phase!=='ch02')return;
     ch02Send('ch02_new_inspect',{site});
     if(site==='certificate'){document.getElementById('hmCh02NewDialog')?.remove();}
     if(site==='ecg')document.getElementById('hmCh02NewDialog')?.remove();
     if(site==='eight')document.getElementById('hmCh02NewDialog')?.remove();
     if(site==='underbed')ch02HandPending=true;
    },true);
    layer.append(btn);
   }
   scene.append(layer);
  }
  layer.hidden=!(active&&phase==='ch02');
 }
 // Legacy V172 death-certificate modal can still be opened by its original
 // event handler. Detect that exact obsolete document and replace it with the
 // server-issued investigator-specific record, without touching other puzzles.
 let ch02LegacyIntercepting=false;
 function interceptLegacyCh02Certificate(){
  if(!active||phase!=='ch02'||ch02LegacyIntercepting)return;
  // V172 uses a separate popup above the approved scene. Redirect each obsolete
  // placeholder to its corresponding real cooperative server investigation.
  const nodes=document.querySelectorAll('[role="dialog"],.modal,.overlay,body > div');
  for(const modal of nodes){
   if(modal.id==='hmCh02NewDialog'||modal.id==='hmCh02ClearScene'||modal.closest('#hmCh02NewDialog')||modal.dataset.hmLegacyHandled==='1')continue;
   if(modal===document.body||modal.id==='mainScene'||modal.contains(document.getElementById('mainScene')))continue;
   const t=modal.textContent||'';
   if(t.length>650||!modal.querySelector('button'))continue;
   let site=null;
   if(t.includes('전기코드')&&t.includes('다음 단계에서 연결'))site='ecg';
   else if(t.includes('8번 표지')&&t.includes('다음 단계에서 연결'))site='eight';
   else if(t.includes('침대 아래')&&t.includes('다음 단계에서 연결'))site='underbed';
   else if(t.includes('사망진단서')&&(t.includes('HM-302-')||t.includes('다음 단계에서 단서가 복원')))site='certificate';
   if(!site)continue;
   ch02LegacyIntercepting=true;
   modal.dataset.hmLegacyHandled='1';
   modal.style.setProperty('display','none','important');
   ch02Send('ch02_new_inspect',{site});
   if(site==='underbed')ch02HandPending=true;
   else if(site==='certificate')document.getElementById('hmCh02NewDialog')?.remove();
   else if(site==='ecg')document.getElementById('hmCh02NewDialog')?.remove();
   else document.getElementById('hmCh02NewDialog')?.remove();
   ch02LegacyIntercepting=false;
   break;
  }
 }
 const ch02LegacyObserver=new MutationObserver(()=>interceptLegacyCh02Certificate());
 if(document.body)ch02LegacyObserver.observe(document.body,{childList:true,subtree:true});
 else document.addEventListener('DOMContentLoaded',()=>ch02LegacyObserver.observe(document.body,{childList:true,subtree:true}),{once:true});
 document.addEventListener('hm-v175-state',mountCh02New);
 document.addEventListener('hm-v175-started',mountCh02New);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountCh02New,{once:true});else mountCh02New();
 document.addEventListener('click',e=>{
  if(!active||phase!=='ch02')return;
  const el=e.target instanceof Element?e.target.closest('button,[role="button"],[data-action],[data-site]'):null;
  if(!el||el.closest('#hmCh02NewLayer,#hmCh02NewDialog,#hmV174Chat'))return;
  if(el.closest('#mainScene,#ch02PuzzlePanel')||el.dataset.ch02||el.dataset.site==='bed_under'){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 document.addEventListener('hm-v175-state',()=>{if(phase!=='ch02'){ch02HandPending=false;document.getElementById('hmCh02NewDialog')?.remove();if(phase==='ch03'){document.getElementById('hmCh02ClearScene')?.remove();ch02ClearShown=false;}else if(phase!=='ch02_cleared'){document.getElementById('hmCh02ClearScene')?.remove();ch02ClearShown=false;}}});
 // CH02 clean-up: remove legacy narrative clutter only in the active CH02 scene.
 // Never remove the approved photorealistic background or mutate other chapters.
 function updateCh02SceneCleanup(){
  const on=active&&phase==='ch02';
  document.documentElement.classList.toggle('hm-ch02-clean',on);
  if(!on)document.getElementById('hmCh02CertificatePreview')?.remove();
 }
 const ch02Style=document.createElement('style');
 ch02Style.textContent='html.hm-ch02-clean .narrative,html.hm-ch02-clean #sceneNarrative,html.hm-ch02-clean #sceneDescription,html.hm-ch02-clean #sceneText,html.hm-ch02-clean .scene-caption{display:none!important}';
 document.head.append(ch02Style);
 document.addEventListener('hm-v175-state',updateCh02SceneCleanup);
 document.addEventListener('hm-v175-started',updateCh02SceneCleanup);
 // Rare atmospheric sounds only during active investigation, never while
  // a cinematic is on screen. Timer is cleared when page is closed.
  const ambient=setInterval(()=>{
   if(!active||document.hidden||$('hmForcedSeparation')||$('hmReceptionScare')||$('hmReceptionHandScare')||($('hmMediaOverlay')&&!$('hmMediaOverlay').hidden))return;
   if(Math.random()<0.32)playHospitalSound(
    ['hallway_steps.wav','behind_you_breath.wav','laugh_woman.mp3','distant_thunder.wav','fluorescent_fault_new.mp3'][Math.floor(Math.random()*5)],0.2);
  },45000);
  window.addEventListener('pagehide',()=>clearInterval(ambient),{once:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installHospitalSoundEffects,{once:true});else installHospitalSoundEffects();
 window.WebSocket=CoopSocket;
 // Only the approved 2/4/8-person capacities are selectable.
 function normalizeCapacityControls(){
  document.querySelectorAll('select').forEach(select=>{
   const options=[...select.options];
   const values=options.map(o=>Number(o.value));
   if(values.filter(n=>Number.isInteger(n)&&n>=2&&n<=8).length<3)return;
   if(!values.includes(2)||!values.includes(8))return;
   for(const option of options){const n=Number(option.value);if(![2,4,8].includes(n))option.remove();}
   if(![2,4,8].includes(Number(select.value))){select.value='2';select.dispatchEvent(new Event('change',{bubbles:true}));}
  });
  document.querySelectorAll('input[type="number"]').forEach(input=>{
   if(Number(input.min)===2&&Number(input.max)===8){input.step='1';input.addEventListener('change',()=>{if(![2,4,8].includes(Number(input.value)))input.value='2';});}
  });
 }
 function useSameOriginCoopEndpoint(){
  const input=$('hmEndpoint');
  if(!input)return;
  const protocol=location.protocol==='https:'?'wss:':'ws:';
  const endpoint=protocol+'//'+location.host;
  // A test build must never accidentally connect players to the production room server.
  input.value=endpoint;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function initializeCoopControls(){useSameOriginCoopEndpoint();normalizeCapacityControls();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeCoopControls,{once:true});
 else initializeCoopControls();
 const scene=document.querySelector('.scene');
 if(scene){
  // The approved reception scene already owns the bell and its server-side action.
  // Keep exactly one bell, preserving the original click handler.
  const originalBell=scene.querySelector('[data-action="bell"]');
  if(originalBell){
   // The approved bell is no longer a progression gate.
   originalBell.hidden=true;originalBell.style.display='none';
   originalBell.setAttribute('aria-hidden','true');
   originalBell.disabled=true;
   originalBell.textContent='🔔';
   originalBell.setAttribute('aria-label','금이 간 호출벨 · 강제 분리');
   originalBell.title='호출벨을 누르면 조사원들이 강제로 분리됩니다';
   originalBell.style.cssText+=';min-width:62px;min-height:62px;border:2px solid #7e343e;border-radius:50%;background:radial-gradient(circle at 35% 25%,#66535d 0%,#24151d 42%,#08070b 76%);color:#e5c6cc;font-size:27px;text-shadow:0 0 10px #f22;box-shadow:0 0 0 3px #1b1018,0 0 20px #9e182f99,inset -5px -7px 12px #000;animation:hmBellPulse 3.4s ease-in-out infinite;z-index:20;';
   const style=document.createElement('style');style.textContent='@keyframes hmBellPulse{0%,88%,100%{filter:brightness(.72);box-shadow:0 0 0 3px #1b1018,0 0 12px #9e182f77,inset -5px -7px 12px #000}90%,94%{filter:brightness(1.5);box-shadow:0 0 0 3px #1b1018,0 0 28px #e22a4e,inset -5px -7px 12px #000}}';document.head.append(style);
  }
  const b=document.createElement('button');b.type='button';b.id='hmV174Bell';b.textContent='🔔 호출벨';b.setAttribute('aria-label','접수대 호출벨 누르기');b.hidden=true;
  b.style.cssText='position:absolute;left:43%;top:74%;z-index:16;border:1px solid #b79acb;border-radius:22px;padding:10px 13px;background:#201528e8;color:#f7ebff;font:700 14px system-ui;box-shadow:0 0 14px #6d458a88;touch-action:manipulation;';
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!active||!socket||socket.readyState!==NativeWS.OPEN)return;socket.send(JSON.stringify({type:'chapter',action:'bell'}));});
  if(originalBell){b.hidden=true;}else{scene.append(b);}
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
