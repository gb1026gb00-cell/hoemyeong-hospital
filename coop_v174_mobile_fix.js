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
 function updateBell(){const b=$('hmV174Bell');if(!b)return;b.hidden=true;}
 class CoopSocket extends NativeWS{
  constructor(...args){super(...args);socket=this;
   this.addEventListener('message',ev=>{let m;try{m=JSON.parse(ev.data)}catch{return}
    if(m.type==='started'||(m.type==='state'&&m.started===true)|| (m.type==='joined'&&m.started===true)){active=true;startedOnce=true;hideLobby();updateConnectionStatus();document.dispatchEvent(new Event('hm-v175-started'));}
    if(m.type==='state'||m.type==='joined'){active=!!m.started;phase=m.chapter?.phase||phase;updateBell();updateConnectionStatus();document.dispatchEvent(new CustomEvent('hm-v175-state',{detail:{started:active}}));}
    if(m.type==='reception_clue'&&m.object!=='desk')showSceneClue(m);
    if(m.type==='reception_result')showReceptionAnswerResult(m);
    if(m.type==='reception_result'&&m.ok===false){const modal=$('hmReceptionCodeModal');if(modal){const p=modal.querySelector('p:nth-of-type(2)');if(p)p.textContent=m.message||'번호를 다시 확인하세요.';}}
    if(m.type==='reception_result'&&m.complete){$('hmReceptionCodeModal')?.remove();}
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
  action.addEventListener('click',()=>{if(video.error){finish();return;}video.play().catch(()=>{action.hidden=false;});});
  video.volume=soundVolume();video.muted=soundVolume()===0;
  video.play().catch(()=>{action.hidden=false;});
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
  play.onclick=()=>{if(video.error){finish();return;}video.play().catch(()=>{play.hidden=false;});};
  overlay.append(video,play);document.body.append(overlay);
  video.play().catch(()=>{play.hidden=false;});
 }
 // The uploaded reception-drawer video has its own stable asset path.
 // It is intentionally not aliased to any G/H clip until the binary is uploaded.
 let receptionHandPlaying=false;
 function playReceptionHand(){
  if(receptionHandPlaying)return;
  receptionHandPlaying=true;
  const overlay=document.createElement('div');
  overlay.id='hmReceptionHandScare';
  overlay.style.cssText='position:fixed;inset:0;z-index:999998;background:#000;display:flex;align-items:center;justify-content:center';
  const video=document.createElement('video');video.playsInline=true;video.preload='auto';video.controls=false;
  video.src=new URL('/reception_hand.mp4',location.origin).href;
  configureCinematicVideo(video);
  video.style.cssText='width:100%;height:100%;object-fit:contain';
  video.volume=soundVolume();video.muted=soundVolume()===0;
  const retry=document.createElement('button');retry.type='button';retry.textContent='접수대 영상 재생';
  retry.style.cssText='position:absolute;bottom:12%;padding:14px 22px;border:1px solid #9e5263;border-radius:10px;background:#2c131d;color:white;font:700 15px system-ui';
  retry.hidden=true;
  const finish=()=>{video.pause();overlay.remove();receptionHandPlaying=false;openReceptionCodePanel();};
  video.addEventListener('ended',finish,{once:true});
  video.addEventListener('error',()=>{retry.textContent='영상 로딩 오류 · 봉인 입력으로 이동';retry.hidden=false;retry.onclick=finish;},{once:true});
  retry.onclick=()=>{video.muted=false;video.play().catch(()=>{video.muted=true;video.play().catch(()=>{retry.hidden=false;retry.textContent='영상 재생하기';});});};
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
  const guide=document.createElement('p');guide.textContent='거울의 얼룩, 캐비닛의 빈자리, 접수명부의 인원을 팀원들과 대조해 여섯 칸을 채우세요.';guide.style.cssText='font:13px/1.8 system-ui;color:#c4b8be';
  const inputs=[],cells=document.createElement('div');cells.style.cssText='display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin:20px 0 13px';
  for(let i=0;i<6;i++){
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
   if(answer.length!==6){status.textContent='여섯 칸의 숫자를 모두 입력하세요.';return;}
   socket.send(JSON.stringify({type:'chapter',action:'reception_submit',answer}));status.textContent='봉인 번호를 대조하고 있습니다…';
  };
  const back=document.createElement('button');back.type='button';back.textContent='← 접수실로 돌아가기';back.style.cssText='display:block;margin:0 0 16px;padding:9px 0;border:0;background:transparent;color:#d8c5ce;font:13px system-ui';
  back.onclick=()=>root.remove();
  card.append(back,label,title,guide,cells,status,submit);root.append(card);document.body.append(root);
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
  media.handle=function(message){if(message?.type==='horror_video'&&['G08','G01','RECEPTION_HAND'].includes(message.id))return;return original(message);};
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
   clue.textContent='유리 표면에 묻은 검은 흔적이 희미하게 흔들린다. 이 거울에 보이는 것만 기억하라.';
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
   clue.textContent='가려진 칸은 조사원마다 다르다. 다른 조사원의 보관함 기록과 비교하라.';
   const steel=document.createElement('div');steel.style.cssText='padding:24px 12px;min-height:250px;display:flex;flex-direction:column;justify-content:center;background:repeating-linear-gradient(99deg,#333436 0 2px,#27282a 4px 13px,#38393a 15px);border:13px ridge #555558;box-shadow:inset 0 0 45px #000,0 13px 32px #000';
   const stamp=document.createElement('div');stamp.textContent='回明病院   /   RECORD STORAGE';stamp.style.cssText='text-align:center;font:11px monospace;letter-spacing:.12em;color:#a2a2a5;margin-bottom:24px';steel.append(stamp);
   const row=document.createElement('div');row.style.cssText='display:flex;gap:6px;justify-content:center;align-items:center;flex-wrap:nowrap';
   const sequence=String(message.sequence||'').trim().split(/\s+/).filter(Boolean);
   for(const digit of sequence){
    const key=document.createElement('span');key.textContent=digit;key.style.cssText='flex:1;min-width:0;max-width:68px;text-align:center;padding:18px 2px;background:#111113;border:2px solid #77767b;box-shadow:inset 0 0 10px #000;color:'+(digit==='○'?'#cba1a8':'#e1deda')+';font:700 clamp(18px,6vw,30px) monospace';row.append(key);
   }
   steel.append(row);card.append(steel);
  }else if(message.object==='ledger'){
   clue.textContent='찢긴 접수명부의 한 장만 남아 있다. 다른 조사원이 가진 날짜와 비교하라.';
   const paper=document.createElement('div');paper.style.cssText='min-height:320px;padding:28px 20px;background:repeating-linear-gradient(#c8bfa8 0 33px,#a99c89 34px,#c8bfa8 35px);border:9px solid #45382e;box-shadow:inset 0 0 55px #62534675,0 16px 42px #000;color:#30291f;transform:rotate(-.6deg)';
   const stamp=document.createElement('div');stamp.textContent='回明病院 · 접수 명부';stamp.style.cssText='font:700 22px serif;letter-spacing:.06em;border-bottom:2px solid #5e5343;padding:0 0 15px';paper.append(stamp);
   const detail=document.createElement('div');detail.textContent='11월 '+String(message.date||'')+'일   /   입실 '+String(message.people??'')+'명';detail.style.cssText='padding:55px 0 30px;font:700 clamp(21px,6vw,32px) serif;text-align:center';paper.append(detail);
   const seal=document.createElement('div');seal.textContent='담당자 서명 __________';seal.style.cssText='font:13px serif;text-align:right;opacity:.54';paper.append(seal);card.append(paper);
  }
  const close=document.createElement('button');close.type='button';close.textContent='← 접수실로 돌아가기';close.style.cssText='min-height:48px;margin-top:auto;border:1px solid #7e6973;border-radius:6px;background:#271e24;color:#ebe2e7;font:14px system-ui;cursor:pointer';
  close.onclick=()=>root.remove();
  card.prepend(heading,clue);card.append(close);root.append(card);document.body.append(root);close.focus();
 }

 
 // CH01 single object router: exact hotspot identity, never a parent's text.
 // In particular a ledger click may never be interpreted as a desk/drawer click.
 document.addEventListener('click',event=>{
  if(!active||socket?.readyState!==NativeWS.OPEN||!['reception','separated'].includes(phase))return;
  const origin=event.target instanceof Element?event.target:null;if(!origin)return;
  if(origin.closest('#hmCh01InspectionScreen,#hmReceptionCodeModal,#hmForcedSeparation,#hmReceptionScare,#hmReceptionHandScare,#hmCoopPanel,#hmV175Gate,#hmV174Chat'))return;
  const target=origin.closest('button,[role="button"],[data-action],[data-object],[data-hotspot],[aria-label]');
  if(!target||target.closest('#ch01PuzzlePanel,#hmReceptionCoop,[data-menu]'))return;
  const label=(target.getAttribute('aria-label')||target.getAttribute('title')||target.textContent||'').replace(/\s+/g,' ').trim().replace(/^[◈▤📋📖]\s*/u,'');
  const raw=String(target.dataset.object||target.dataset.action||target.dataset.hotspot||'').toLowerCase().trim();
  let object=null;
  if(/^(?:접수\s*명부|접수\s*명부 조사|접수\s*명부 열기)$/.test(label))object='ledger';
  else if(/^(?:거울|균열 난 거울|거울 조사)$/.test(label))object='mirror';
  else if(/^(?:캐비닛|잠긴 캐비닛|보관함|잠긴 보관함|서류함)$/.test(label))object='cabinet';
  else if(/^(?:접수대 서랍|서랍)$/.test(label))object='drawer';
  else if(/^(?:접수대|접수대 조사|봉인 번호 입력)$/.test(label))object='desk';
  else object={ledger:'ledger',mirror:'mirror',cabinet:'cabinet',drawer:'drawer',reception_drawer:'drawer',desk:'desk',reception_desk:'desk'}[raw]||null;
  if(!object)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(phase!=='separated'){showConnectionStatus('접수실 조사 시작 버튼을 눌러 강제 분리를 완료한 뒤 조사해 주세요.');return;}
  if(object==='desk'){openReceptionCodePanel();return;}
  if(object==='drawer'){playReceptionHand();return;}
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
  // Rare atmospheric sounds only during active investigation, never while
  // a cinematic is on screen. Timer is cleared when page is closed.
  const ambient=setInterval(()=>{
   if(!active||document.hidden||$('hmForcedSeparation')||!$('hmMediaOverlay')?.hidden)return;
   if(Math.random()<0.32)playHospitalSound(
    ['hallway_steps.wav','behind_you_breath.wav','laugh_woman.mp3','distant_thunder.wav','fluorescent_fault_new.mp3'][Math.floor(Math.random()*5)],0.2);
  },45000);
  window.addEventListener('pagehide',()=>clearInterval(ambient),{once:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installHospitalSoundEffects,{once:true});else installHospitalSoundEffects();
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
