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
    if(m.type==='reception_clue'||m.type==='reception_result')showReceptionResult(m);
    handleHospitalSoundEvent(m);
    if(m.type==='horror_video'&&m.id==='G08')playForcedSeparation();
    if(m.type==='horror_video'&&m.id==='G01')playReceptionScare();
    if(m.type==='horror_video'&&m.id==='RECEPTION_HAND')playReceptionHand();
    if(m.type==='chat'){const box=$('hmV174ChatLog');if(box){const line=document.createElement('div');line.textContent=(Number.isInteger(m.item?.character)&&m.item.character>=0&&m.item.character<8?['홍중','성화','윤호','여상','산','민기','우영','종호'][m.item.character]+': ':(m.item?.role!==undefined?'조사원 '+(m.item.role+1)+': ':''))+(m.item?.text||m.item?.message||'');box.append(line);box.scrollTop=box.scrollHeight;}}
   });
   this.addEventListener('close',()=>{if(socket===this){active=false;updateBell();updateConnectionStatus();}});
   this.addEventListener('open',()=>{if(socket===this)updateConnectionStatus();});
  }
 }
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
 const separationVoice=new Audio('https://gb1026gb00-cell.github.io/hoemyeong-hospital/CH01_reverse_corrupted.mp3');
 separationVoice.preload='auto';
 let pendingSeparation=false;
 function soundVolume(){const enabled=$('hmSoundEnabled'),volume=$('hmSoundVolume');return enabled&&!enabled.checked?0:Math.max(0,Math.min(1,Number(volume?.value??65)/100));}
 function startSeparationVoice(){if(!pendingSeparation)return;pendingSeparation=false;separationVoice.pause();separationVoice.currentTime=0;separationVoice.volume=soundVolume();separationVoice.muted=soundVolume()===0;separationVoice.play().catch(()=>{pendingSeparation=true;});}
 function armSeparation(){pendingSeparation=true;const v=$('hmHorrorVideo');if(v&&!v.paused&&!v.ended)startSeparationVoice();}
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
  video.src='https://gb1026gb00-cell.github.io/hoemyeong-hospital/G08.mp4';
  configureCinematicVideo(video);
  const action=document.createElement('button');
  action.type='button';action.textContent='강제 분리 영상 재생';
  action.style.cssText='position:absolute;bottom:12%;padding:14px 22px;border:1px solid #9e5263;border-radius:10px;background:#2c131d;color:white;font:700 15px system-ui';
  action.hidden=true;
  overlay.append(video,action);document.body.append(overlay);
  let done=false;
  const finish=()=>{if(done)return;done=true;video.pause();separationVoice.pause();video.hidden=true;action.hidden=true;const card=document.createElement('div');card.style.cssText='position:absolute;inset:0;background:#070507;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:24px';card.innerHTML='<div style="color:#a93645;font:700 clamp(34px,9vw,62px) serif;letter-spacing:.14em">回明病院</div><div style="color:#f3e8ee;font:600 21px system-ui">다른 조사원들과 떨어졌습니다.</div><div style="color:#ab96a2;font:13px system-ui">서로의 목소리만이 남아 있습니다.</div>';overlay.append(card);setTimeout(()=>{overlay.remove();separationPlaying=false;},2400);};
  video.addEventListener('playing',()=>{action.hidden=true;pendingSeparation=true;startSeparationVoice();});
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
  video.src='https://gb1026gb00-cell.github.io/hoemyeong-hospital/G01.mp4';
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
  video.src='/reception_hand.mp4';
  configureCinematicVideo(video);
  video.style.cssText='width:100%;height:100%;object-fit:contain';
  video.volume=soundVolume();video.muted=soundVolume()===0;
  const retry=document.createElement('button');retry.type='button';retry.textContent='접수대 영상 재생';
  retry.style.cssText='position:absolute;bottom:12%;padding:14px 22px;border:1px solid #9e5263;border-radius:10px;background:#2c131d;color:white;font:700 15px system-ui';
  retry.hidden=true;
  const finish=()=>{video.pause();overlay.remove();receptionHandPlaying=false;};
  video.addEventListener('ended',finish,{once:true});
  video.addEventListener('error',finish,{once:true}); // Never trap the player if the asset is not deployed.
  retry.onclick=()=>video.play().catch(()=>{retry.hidden=false;});
  overlay.append(video,retry);document.body.append(overlay);
  video.play().catch(()=>{retry.hidden=false;});
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

 // CH01 guidance is additive: all eight existing server-validated puzzles remain intact.
 const senses=['청각','촉각','시각','기록','시간','전파','관찰','기억'];
 const objects=['내선 기록','거울','거울','접수 기록','접수 기록','내선 기록','잠긴 보관함','거울'];
 const rules=[
  '짧은 신호는 S, 긴 신호는 L로 적고, 들리는 순서대로 이어 붙이세요.',
  '첫 번째 돌기 행을 왼쪽부터 읽어 숫자를 이어 붙이세요.',
  '거울에 비친 숫자를 실제 방향으로 되돌린 뒤, 숫자 두 개를 붙여 쓰세요.',
  '명부에 등장한 접수 번호를 위에서 아래 순서대로, 구분 기호 없이 이어 붙이세요.',
  '당직 일지와 멈춘 시계의 시각을 각각 네 자리로 쓰고, 가운데에 -를 넣으세요.',
  '호출 부호에서 숫자만 순서대로 적으세요. 하이픈은 빼세요.',
  '감시 영상의 인원과 거울 속 인원을 차례로 쓰고 가운데 -를 넣으세요.',
  '처음 확인한 네 자리 배열을 순서대로 이어 붙이세요.'
 ];
 function enhanceCh01(){
  const panel=$('ch01PuzzlePanel');if(!panel||$('hmCh01Guide'))return;
  const index=$('senseIndex');if(!index)return;
  const guide=document.createElement('section');guide.id='hmCh01Guide';
  guide.style.cssText='margin:12px 0;padding:13px;border:1px solid #80648e;border-radius:10px;background:#231a2b;color:#eee0f3;font:13px/1.65 system-ui;white-space:normal';
  index.closest('label')?.before(guide);
  const sequence=$('senseSequence'),cross=$('senseCrossKey'),digit=$('senseDigit');
  const update=()=>{
   const i=Number(index.value),valid=Number.isInteger(i)&&i>=0&&i<8;
   if(!valid){guide.textContent='감각 번호는 0~7 중 하나를 선택하세요.';return;}
   const next=(i+1)%8;
   guide.innerHTML='<b>선택한 감각: '+senses[i]+' (번호 '+i+')</b><div>① 현장에서 <b>'+objects[i]+'</b>을 먼저 조사하세요.</div><div>② 장치 조작 순서: '+rules[i]+'</div><div>③ 장치 조작 버튼을 누른 뒤, 문제의 답을 해독 답 칸에 입력하세요.</div><div>④ <b>'+senses[next]+' 감각 담당자</b>에게 교차 열쇠를 받아 입력하세요. 내 화면의 공유 열쇠는 그 담당자에게 전달하는 값이지, 내 입력값이 아닙니다.</div><div>⑤ 해독 성공 메시지에 나온 숫자를 아래 숫자 조각 칸에 옮기고 등록하세요.</div>';
   if(sequence)sequence.placeholder=rules[i];
   if(cross)cross.placeholder=senses[next]+' 담당자에게 받은 교차 열쇠';
   if(digit)digit.placeholder='해독 성공 메시지의 숫자';
  };
  index.addEventListener('input',update);index.addEventListener('change',update);update();
  const caption=document.createElement('div');caption.style.cssText='font-size:12px;color:#cbbbd4;margin:5px 0 10px';caption.textContent='감각 번호: 청각 0 · 촉각 1 · 시각 2 · 기록 3 · 시간 4 · 전파 5 · 관찰 6 · 기억 7';index.closest('label')?.append(caption);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceCh01,{once:true});else enhanceCh01();

 // Object-first investigation UI: keep original buttons, event handlers and server rules.
 function enhanceChapterInteractions(){
  const chapters=[
   ['ch01PuzzlePanel','접수실','명부와 사물을 조사하고 팀원과 단서를 비교하세요.','data-ch01'],
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
  const desk=document.querySelector('#mainScene [data-action="desk"]');
  if(desk){desk.textContent='접수대 · 명부 조사';desk.title='강제 분리 후 접수대 기록을 조사합니다';}
  const revisit=document.querySelector('#ch01PuzzlePanel [data-ch01="inspect"][data-object="desk"]');
  if(revisit)revisit.textContent='접수대 명부 다시 조사';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceChapterInteractions,{once:true});else enhanceChapterInteractions();

 function showReceptionResult(message){
  const out=$('hmReceptionOutput');if(!out)return;
  const lines=Array.isArray(message.lines)?message.lines:[message.message||''];
  const header=message.label|| (message.ok?'접수대 봉인':'명부 확인');
  out.textContent=header+'\\n'+lines.join('\\n');
  const shadows=$('hmReceptionShadows');if(shadows){shadows.replaceChildren();shadows.hidden=message.object!=='mirror';if(message.object==='mirror'&&Number.isInteger(message.shadowCount)){for(let i=0;i<message.shadowCount;i++){const figure=document.createElement('span');figure.className='hmShadowNurse';figure.setAttribute('aria-label','얼굴이 검게 지워진 간호사 그림자');figure.innerHTML='<span class="hmNurseHead"></span><span class="hmNurseBody"></span>';shadows.append(figure);}}}
  out.style.borderColor=message.ok?'#6b9a83':'#9b697f';
  if(message.complete){document.querySelectorAll('#hmReceptionCoop input').forEach(input=>input.disabled=true);}
 }
 function installReceptionCoop(){
  const panel=$('ch01PuzzlePanel');if(!panel||$('hmReceptionCoop'))return;
  const section=document.createElement('section');section.id='hmReceptionCoop';
  section.style.cssText='margin:12px 0;padding:14px;border:1px solid #91677c;border-radius:12px;background:linear-gradient(#271820,#100d15);color:#f4e8ee';
  const title=document.createElement('strong');title.textContent='접수명부 · 여섯 자리 봉인';
  const intro=document.createElement('p');intro.textContent='각자 보이는 물건이 다릅니다. 거울의 그림자를 세고, 접수대 날짜와 명부를 대조하고, 캐비닛을 확인하세요. 팀원과 공유해 여섯 칸을 완성하세요.';intro.style.cssText='font-size:12px;line-height:1.6;color:#d5c2ce';
  const objects=document.createElement('div');objects.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0';
  for(const [object,label] of [['desk','📖 접수대'],['mirror','◈ 거울'],['cabinet','▤ 캐비닛'],['ledger','📋 접수명부']]){
   const b=document.createElement('button');b.type='button';b.textContent=label;
   b.style.cssText='min-height:55px;padding:10px;border:1px solid #805c72;border-radius:9px;background:#382531;color:#fff';
   b.onclick=()=>{if(socket?.readyState!==NativeWS.OPEN)return;socket.send(JSON.stringify({type:'chapter',action:'reception_clue',object}));};
   objects.append(b);
  }
  const shadows=document.createElement('div');shadows.id='hmReceptionShadows';shadows.hidden=true;shadows.style.cssText='display:flex;justify-content:center;align-items:end;flex-wrap:wrap;gap:8px;min-height:130px;padding:12px;background:radial-gradient(#3b3540,#0a090d);border:3px ridge #71616f;border-radius:8px;margin:9px 0';
  const output=document.createElement('pre');output.id='hmReceptionOutput';output.textContent='접수대, 거울, 캐비닛, 접수명부를 조사하세요.';output.style.cssText='white-space:pre-wrap;line-height:1.7;padding:12px;background:#110e15;border:1px solid #5d4759;border-radius:8px;min-height:80px;font:13px/1.7 system-ui';
  const hint=document.createElement('p');hint.textContent='팀원과 숫자·기호를 공유하세요. 각 칸에 숫자 하나씩 입력하세요. 모든 조사원이 확인하면 봉인이 풀립니다.';hint.style.cssText='font-size:12px;color:#d8c1ce';
  const cells=document.createElement('div');cells.style.cssText='display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;margin-top:10px';
  const digitInputs=[];
  for(let i=0;i<6;i++){
   const field=document.createElement('input');field.type='text';field.inputMode='numeric';field.maxLength=1;field.autocomplete='off';field.setAttribute('aria-label',(i+1)+'번째 숫자');
   field.placeholder=String(i+1);field.style.cssText='width:100%;min-width:0;height:48px;text-align:center;font:700 21px system-ui;color:#fff;background:#140f17;border:1px solid #92758a;border-radius:8px';
   field.addEventListener('input',()=>{field.value=field.value.replace(/[^0-9]/g,'').slice(0,1);if(field.value&&i<5)digitInputs[i+1].focus();});
   field.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!field.value&&i>0)digitInputs[i-1].focus();});
   digitInputs.push(field);cells.append(field);
  }
  const input={get value(){return digitInputs.map(el=>el.value).join('');},set disabled(value){digitInputs.forEach(el=>el.disabled=value);}};
  const inputProxy=document.createElement('input');inputProxy.id='hmReceptionAnswer';inputProxy.type='hidden';
  const submit=document.createElement('button');submit.type='button';submit.textContent='접수대 봉인 해제';submit.style.cssText='width:100%;min-height:48px;margin-top:9px;border:1px solid #ac7a90;border-radius:9px;background:#5c3047;color:#fff;font-weight:bold';
  submit.onclick=()=>{if(socket?.readyState!==NativeWS.OPEN)return;socket.send(JSON.stringify({type:'chapter',action:'reception_submit',answer:input.value.trim()}));};
  section.append(title,intro,objects,shadows,output,hint,cells,inputProxy,submit);
  const css=document.createElement('style');css.textContent='#hmReceptionShadows[hidden]{display:none!important}.hmShadowNurse{display:flex;flex-direction:column;align-items:center;width:36px;height:98px;filter:drop-shadow(0 0 5px #08040b)}.hmNurseHead{width:27px;height:30px;background:radial-gradient(ellipse at 50% 38%,#020104 0 57%,#b5a8a8 59% 75%,#24212a 80%);border-radius:47% 47% 43% 43%;border-top:5px solid #c5b6b8}.hmNurseBody{height:63px;width:34px;background:linear-gradient(90deg,#39353d,#c2b8ba 38%,#66606a 68%,#19151d);clip-path:polygon(29% 0,70% 0,100% 100%,0 100%);border-radius:8px}';document.head.append(css);
  const guide=$('hmCh01Guide');if(guide)guide.before(section);else panel.querySelector('strong')?.after(section);
  // Hide only the obsolete CH01 numeric form, retaining its DOM and all server
  // handlers for backward compatibility. Other chapters and artifacts untouched.
  // Retire the old CH01 sense / cross-key form from the player UI.
  const senseForm=$('senseIndex')?.closest('div');
  if(senseForm){senseForm.hidden=true;senseForm.style.display='none';}
  const old=panel.querySelector('#senseIndex')?.closest('div');
  if(old){old.hidden=true;old.style.display='none';}
  const oldControls=panel.querySelector('[data-ch01="inspect"]')?.parentElement;
  if(oldControls){
   // Keep the approved artifact collection and chapter transition functional.
   for(const action of ['fragment_search','ch02_enter']){
    const original=oldControls.querySelector('[data-ch01="'+action+'"]');
    if(original){original.style.cssText+=';width:100%;min-height:46px;margin-top:9px;border-radius:9px;';section.append(original);}
   }
   oldControls.hidden=true;oldControls.style.display='none';
  }
  if(guide){guide.hidden=true;guide.style.display='none';}
  const desk=document.querySelector('#mainScene [data-action="desk"]');
  if(desk){desk.addEventListener('click',()=>{if(active&&phase==='separated'&&socket?.readyState===NativeWS.OPEN)socket.send(JSON.stringify({type:'chapter',action:'reception_clue',object:'desk'}));});}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installReceptionCoop,{once:true});else installReceptionCoop();

 // Route the FIRST actual CH01 investigation through the server before legacy
 // V172 scene handlers. The old scene can use data-action while the new panel
 // uses reception_clue; both must initiate the same once-per-room transition.
 document.addEventListener('click',event=>{
  if(!active||phase!=='reception'||socket?.readyState!==NativeWS.OPEN)return;
  const target=event.target.closest?.('[data-action],[data-ch01],[data-object]');
  if(!target)return;
  const raw=(target.getAttribute('data-object')||target.getAttribute('data-action')||'').toLowerCase();
  const map={desk:'desk',reception:'desk',reception_desk:'desk',mirror:'mirror',cabinet:'cabinet',ledger:'ledger',intercom:'intercom'};
  const object=map[raw];
  if(!object)return;
  event.preventDefault();event.stopImmediatePropagation();
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
