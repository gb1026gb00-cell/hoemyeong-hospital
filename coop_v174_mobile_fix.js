'use strict';
/* V174 additive mobile co-op UI bridge; approved scenes/puzzles untouched. */
(()=>{
 const $=id=>document.getElementById(id);
 let active=false,phase='reception',socket=null;
 let startedOnce=false;
 let ch02IsHost=false;
 let receptionAnswerLength=4;
 let ch02AssignedRole=null,ch02RoomCapacity=2,ch02RoomRoles=[];
 const NativeWS=window.WebSocket;
 function hideLobby(){const p=$('hmCoopPanel');if(p)p.hidden=true;}
 function showConnectionStatus(message){let el=$('hmV174ConnectionStatus');if(!el){el=document.createElement('div');el.id='hmV174ConnectionStatus';el.setAttribute('role','alert');el.style.cssText='position:fixed;top:12px;left:12px;right:12px;z-index:99980;padding:13px 16px;border:1px solid #d1a2a2;border-radius:10px;background:#29151df2;color:#fff;font:14px system-ui;text-align:center;pointer-events:none';document.body.append(el);}el.textContent=message;el.hidden=!message;}
 function updateConnectionStatus(){showConnectionStatus(startedOnce&&(!active||!socket||socket.readyState!==NativeWS.OPEN)?'협동 서버 연결이 끊어졌습니다. 팀원과 연결을 복구하기 전에는 진행하지 마세요.':'');}
 function updateBell(){const b=$('hmV174Bell');if(!b)return;b.hidden=true;}
 class CoopSocket extends NativeWS{
  constructor(...args){super(...args);socket=this;
   this.addEventListener('message',ev=>{let m;try{m=JSON.parse(ev.data)}catch{return}
    if(m.type==='started'||(m.type==='state'&&m.started===true)|| (m.type==='joined'&&m.started===true)){active=true;startedOnce=true;hideLobby();updateConnectionStatus();document.dispatchEvent(new Event('hm-v175-started'));}
    if(m.type==='state'||m.type==='joined'){if([2,4,8].includes(Number(m.capacity))){receptionAnswerLength=Number(m.capacity)/2+3;ch02RoomCapacity=Number(m.capacity);}if(Array.isArray(m.roles))ch02RoomRoles=m.roles.filter(Number.isInteger).slice().sort((a,b)=>a-b);active=!!m.started;phase=m.chapter?.phase||phase;if(Array.isArray(m.artifactFragments))ch03FragmentCollected=m.artifactFragments.includes(2);const inv=document.getElementById('hmCh03Inventory');if(inv)inv.textContent='🎒 제0유물 파편 · '+(m.artifactFragments?.length||0)+'/5'+(ch03FragmentCollected?' · 거울 파편 획득':' · 거울 파편 미획득');updateBell();updateConnectionStatus();document.dispatchEvent(new CustomEvent('hm-v175-state',{detail:{started:active}}));}
    if(m.type==='joined'&&typeof m.isHost==='boolean')ch02IsHost=m.isHost;
    if((m.type==='joined'||m.type==='state')&&m.yourRole!==undefined&&m.yourRole!==null&&Number.isInteger(Number(m.yourRole)))ch02AssignedRole=Number(m.yourRole);
    if(m.type==='ch02_certificate'&&Number.isInteger(Number(m.role)))ch02AssignedRole=Number(m.role);
    if(m.type==='ch02_ecg_archive'&&Number.isInteger(Number(m.role)))ch02AssignedRole=Number(m.role);
    if(m.type==='ch02_bed_tags'&&Number.isInteger(Number(m.role)))ch02AssignedRole=Number(m.role);
    if(m.type==='error'&&phase==='ch02'){
     const popup=document.getElementById('hmCh02NewDialog');
     if(popup&&popup.dataset.awaitingCertificate==='yes'){
      ch02Dialog('진단서 요청 거절',m.message||'서버에서 조사 요청을 처리하지 못했어.');
      return;
     }
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
    if((m.type==='state'||m.type==='joined')&&m.chapter?.phase==='ch02_cleared'&&!document.getElementById('hmCh02ClearScene'))showCh02Clear();
    if(m.type==='ch04_event'&&m.event==='enter'){document.getElementById('hmCh03ToCh04Video')?.remove();ch03ToCh04Playing=false;appendCh04StoryChat();}
    if((m.type==='state'||m.type==='joined')&&m.chapter?.phase==='ch04')appendCh04StoryChat();
    if(m.type==='ch03_event'&&m.event==='enter'){
     phase='ch03';
     const image=document.getElementById('sceneImage');
     if(image){image.src='/elevator_hall.webp';image.alt='회명병원 엘리베이터';}
    }
    if((m.type==='state'||m.type==='joined')&&m.chapter?.phase==='ch03'){
     const scene=document.getElementById('hmWardScene')||document.getElementById('mainScene');
     if(scene){scene.style.backgroundImage='url("/elevator_hall.webp")';scene.dataset.hmChapterScene='ch03';}
     const bg=scene?.querySelector('.bg');
     if(bg){bg.style.backgroundImage='url("/elevator_hall.webp")';bg.dataset.hmImageKey='ch03-elevator';}
     // The actual /play client uses an <img>, not a CSS background.
     const actualImage=document.getElementById('sceneImage');
     if(actualImage&&actualImage.getAttribute('src')!=='/elevator_hall.webp'){
      actualImage.src='/elevator_hall.webp';actualImage.alt='회명병원 엘리베이터';
     }
    }
    if(m.type==='ch03_event'&&m.event==='enter'){
     document.getElementById('hmCh02ClearScene')?.remove();
     document.getElementById('hmCh02NewDialog')?.remove();
     ch02ClearShown=false;
    }
    if(m.type==='ch03_event'&&m.event==='enter')mountIndependentCh03();
    if(m.type==='ch03_result'&&phase==='ch03'){
     const note=document.getElementById('hmIndependentCh03Note');
     if(note)note.textContent=m.message||'조사 기록을 확인했습니다.';
    }
    if(m.type==='reception_clue'&&m.object!=='desk')showSceneClue(m);
    if(m.type==='reception_result')showReceptionAnswerResult(m);
    if(m.type==='ch02_certificate'&&active)showCh02Certificate(m);
    if(m.type==='ch02_ecg_archive'&&active)showCh02ECG(m);
    if(m.type==='ch02_bed_tags'&&active)showCh02BedTags(m);
    if(m.type==='ch02_new_result'&&m.site==='answer'){
     const status=document.getElementById('hmCh02NewStatus');
     if(status)status.textContent=m.message||'';
     if(m.ok&&m.scene==='death_record_invalidated')showCh02Clear();
     else if(!m.ok)ch02Dialog('기록 정정 실패',m.message||'조사 기록이 부족합니다. 네 조사 지점을 다시 확인해 주세요.');
    }
    if(m.type==='ch02_new_result'&&m.site==='underbed'&&phase==='ch02'&&!m.videoPending){
     ch02HandPending=false;
     showCh02Answer();
    }
    if(m.type==='horror_video'&&m.id==='H01'&&phase==='ch02'&&ch02HandPending){
     ch02HandPending=false;
     // Wait for the approved media controller to attach its actual H01 video.
     // Never reveal the answer dialog immediately just because the video is not mounted yet.
     let completed=false;
     const finish=()=>{if(completed||phase!=='ch02')return;completed=true;document.removeEventListener('ended',onEnded,true);showCh02Answer();};
     const onEnded=e=>{if(e.target instanceof HTMLVideoElement)finish();};
     // The original horror player may remove its video on completion.
     // Capture the native ended event before the original cleanup handler runs.
     document.addEventListener('ended',onEnded,true);
     const video=document.getElementById('hmHorrorVideo');
     if(video?.ended)finish();
     // If the media controller dispatches completion by removing its player,
     // wait until playback has actually started before treating removal as completion.
     let played=!!(video&&!video.paused&&!video.ended);
     const observe=new MutationObserver(()=>{
      if(completed||phase!=='ch02'){observe.disconnect();return;}
      const current=document.getElementById('hmHorrorVideo');
      if(current&&!current.paused&&!current.ended)played=true;
      if(played&&!current){observe.disconnect();finish();}
     });
     observe.observe(document.body,{childList:true,subtree:true});
     setTimeout(()=>{observe.disconnect();if(!completed)document.removeEventListener('ended',onEnded,true);},120000);
    }
    if((m.type==='chapter_event'&&m.event==='escape')||((m.type==='state'||m.type==='joined')&&m.chapter&&['escaped','ch02','ch03','ch04','ch05','ch06','finished'].includes(m.chapter.phase))){$('hmReceptionCodeModal')?.remove();$('hmCh01InspectionScreen')?.remove();}
    handleHospitalSoundEvent(m);
    if(m.type==='chapter_event'&&m.event==='blackout'){document.getElementById('hmCh01GroupIntro')?.remove();appendCh01StoryChat();}
    if(m.type==='horror_video'&&m.id==='G08')playForcedSeparation();
    if(m.type==='horror_video'&&m.id==='G06'&&phase==='ch03')playCh03ElevatorVideo();
    if(m.type==='ch03_event'&&m.event==='transition_video')playCh03ToCh04Video();
    if(m.type==='ch03_event'&&m.event==='cleared'){phase='ch03_cleared';showCh03Cleared();}
    if(m.type==='fragment_result'&&m.ok&&Number(m.index)===2){ch03FragmentCollected=true;const inv=document.getElementById('hmCh03Inventory');if(inv)inv.textContent='🎒 제0유물 파편 수집함 · 거울 파편 획득';const status=document.getElementById('hmCh03ClearedStatus');if(status)status.textContent='제0유물 파편이 공동 소지품에 등록되었습니다.';}
    if(m.type==='ch03_result'&&m.ok===false&&phase==='ch03'){const note=document.getElementById('hmIndependentCh03Note');if(note)note.textContent=m.message||'조사 요청을 완료하지 못했습니다.';}
    if(m.type==='fragment_result'&&m.ok&&Number(m.index)===2&&phase==='ch03'){const note=document.getElementById('hmIndependentCh03Note');if(note)note.textContent='제0유물 파편이 공동 소지품에 등록되었습니다. 이제 운행 코드를 입력할 수 있습니다.';}
    if(m.type==='ch04_result'&&m.ok===false&&phase==='ch03_cleared'){const status=document.getElementById('hmCh03ClearedStatus');if(status)status.textContent=m.message||'다음 구역으로 이동할 수 없습니다.';}
    if(m.type==='fragment_result'&&m.ok===false&&phase==='ch03_cleared'){const status=document.getElementById('hmCh03ClearedStatus');if(status)status.textContent=m.message||'파편을 회수하지 못했습니다.';}

    if(m.type==='horror_video'&&m.id==='G01')playReceptionScare();
    // Drawer video is triggered only by an explicit scene drawer click, never by a clue response.
    if(m.type==='chat'){const box=$('hmV174ChatLog');if(box){const line=document.createElement('div');line.textContent=(Number.isInteger(m.item?.character)&&m.item.character>=0&&m.item.character<8?['홍중','성화','윤호','여상','산','민기','우영','종호'][m.item.character]+': ':(m.item?.role!==undefined?'조사원 '+(m.item.role+1)+': ':''))+(m.item?.text||m.item?.message||'');box.append(line);box.scrollTop=box.scrollHeight;}}
   });
   this.addEventListener('close',()=>{if(socket===this){active=false;updateBell();updateConnectionStatus();}});
   this.addEventListener('open',()=>{if(socket===this)updateConnectionStatus();});
  }
 }
 // Eight-member fan-story intro; game capacity and cooperative roles remain unchanged.
 // G02 has ended for the room before CH04 is entered; add story to the existing team chat.
 let ch04StoryChatShown=false;
 function appendCh04StoryChat(){
  if(ch04StoryChatShown)return;
  const lines=[
   ['우영','방금 봤어? 뭐야 니네도 봤어????'],
   ['민기','아 씨 나 너무 무서워... 그 여자 바닥 기어오던 거 봤잖아'],
   ['윤호','봤어. 민기야 괜찮아? 어디 다친 데 없어?'],
   ['종호','홍중이 형, 그 여자 우리 쪽으로 계속 기어오던데.'],
   ['성화','나도 봤어. 근데 그 여자 어디로 간 거야?'],
   ['여상','잠깐, 그럼 그 여자 여기까지 따라온 거 아니야?'],
   ['산','우영아, 괜찮아? 혼자 움직이지 마.'],
   ['우영','안 괜찮아 씨발ㅠㅠ 산아 너 지금 어디야'],
   ['홍중','야, 다들 일단 진정해. 보이는 거부터 얘기해. 혼자 돌아다니지 말고.']
  ];
  const write=()=>{
   const log=$('hmV174ChatLog');if(!log)return false;
   if(log.querySelector('[data-hm-story="ch04"]')){ch04StoryChatShown=true;return true;}
   for(const [name,message] of lines){const item=document.createElement('div');item.textContent=name+': '+message;item.dataset.hmStory='ch04';log.append(item);}
   log.scrollTop=log.scrollHeight;ch04StoryChatShown=true;return true;
  };
  if(!write()){let tries=0;const retry=setInterval(()=>{if(write()||++tries>=20)clearInterval(retry);},250);}
 }
 let ch01StoryChatShown=false;
 function appendCh01StoryChat(){
  if(ch01StoryChatShown)return;
  ch01StoryChatShown=true;
  const lines=[['우영','형들, 다들 어디 갔어?!?! 산아, 너도 안 보여!'],['민기','윤호야, 나 혼자야. 이거 장난 아니지?'],['종호','홍중이 형, 내 쪽 문이 잠겼어.'],['여상','성화 형, 목소리는 들려? 서로 위치부터 확인하자.'],['윤호','다들 움직이지 마. 지금 보이는 것부터 채팅에 적어.'],['성화','종호야, 괜찮아? 문은 억지로 열지 마.'],['산','우영아, 나 여기 있어. 근데 너한테 갈 수가 없어.'],['홍중','일단 침착해. 각자 찾은 단서를 여기 공유해.']];
  const write=()=>{
   const log=$('hmV174ChatLog');if(!log)return false;
   for(const [name,message] of lines){const item=document.createElement('div');item.textContent=name+': '+message;item.dataset.hmStory='ch01';log.append(item);}
   log.scrollTop=log.scrollHeight;return true;
  };
  if(!write()){let tries=0;const retry=setInterval(()=>{if(write()||++tries>=20)clearInterval(retry);},250);}
 }
 function mountCh01GroupIntro(){
  const visible=active&&phase==='reception';
  let overlay=$('hmCh01GroupIntro');
  if(!visible){overlay?.remove();return;}
  if(overlay)return;
  overlay=document.createElement('div');overlay.id='hmCh01GroupIntro';
  overlay.style.cssText='position:fixed;inset:0;z-index:999985;background:#050505;color:#f5f5f5;display:flex;justify-content:center;align-items:center;padding:14px;box-sizing:border-box;font:14px/1.5 system-ui';
  const phone=document.createElement('section');phone.style.cssText='width:min(500px,100%);height:min(420px,52dvh);display:flex;flex-direction:column;background:#101010;border:1px solid #343434;border-radius:15px;overflow:hidden;box-shadow:0 16px 50px #000';
  const head=document.createElement('header');head.textContent='회명병원 · 단체 대화 (9)';head.style.cssText='padding:17px 19px;border-bottom:1px solid #303030;font-weight:700;text-align:center';phone.append(head);
  const thread=document.createElement('div');thread.style.cssText='flex:1;overflow:auto;padding:17px 15px;display:flex;flex-direction:column;gap:11px';
  const dialogue=[['홍중','다들 도착했어? 아직 안 온 사람 있어?'],['성화','여기 정말 폐병원 맞아? 불은 켜져 있네.'],['윤호','홍중이 형, 우리 다 들어왔어. 일단 같이 움직이자.'],['민기','성화 형, 아까 복도에서 발소리 못 들었어?'],['여상','나도 들었어. 우리 말고 누가 더 있는 것 같은데.'],['종호','형들, 출입문이 안 열려.'],['우영','산아, 너 아까 문 잠갔어?'],['산','아니, 안 잠갔어. 홍중이 형, 접수대에 뭔가 있어.']];
  for(const [name,message] of dialogue){const row=document.createElement('div');row.style.cssText='display:flex;flex-direction:column;align-items:flex-start;gap:4px';const label=document.createElement('span');label.textContent=name;label.style.cssText='font-size:12px;color:#bcbcbc';const bubble=document.createElement('div');bubble.textContent=message;bubble.style.cssText='max-width:90%;background:#292929;border-radius:4px 13px 13px 13px;padding:10px 13px;color:#f5f5f5;white-space:pre-wrap';row.append(label,bubble);thread.append(row);}
  phone.append(thread);
  overlay.style.pointerEvents='none';phone.style.pointerEvents='auto';thread.style.touchAction='pan-y';thread.style.overscrollBehavior='contain';
  phone.style.paddingBottom='0';
  overlay.append(phone);document.body.append(overlay);
 }
 // CH02 intro appears once per chapter entry. Closing it never sends a chapter action.
 let ch02IntroSeen=false;
 function mountCh02GroupIntro(){
  if(!active||phase!=='ch02'){$('hmCh02GroupIntro')?.remove();if(phase==='reception'||phase==='separated')ch02IntroSeen=false;return;}
  if(ch02IntroSeen||$('hmCh02GroupIntro'))return;
  ch02IntroSeen=true;
  const overlay=document.createElement('div');overlay.id='hmCh02GroupIntro';
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483500;background:#050505;color:#f5f5f5;display:flex;justify-content:center;align-items:center;padding:14px;box-sizing:border-box;font:14px/1.5 system-ui';
  const phone=document.createElement('section');phone.style.cssText='width:min(500px,100%);height:min(720px,92dvh);display:flex;flex-direction:column;background:#101010;border:1px solid #343434;border-radius:15px;overflow:hidden;box-shadow:0 16px 50px #000';
  const head=document.createElement('header');head.textContent='회명병원 · 단체 대화 (9)';head.style.cssText='padding:17px 19px;border-bottom:1px solid #303030;font-weight:700;text-align:center';phone.append(head);
  const thread=document.createElement('div');thread.style.cssText='flex:1;overflow:auto;padding:17px 15px;display:flex;flex-direction:column;gap:11px';
  const dialogue=[['홍중','다들 이동했어? 지금 어디야?'],['우영','나 병실 같은 데야. 침대가 있는데 아무도 없어.'],['민기','나도... 나도 병실인데? 여긴 뭐야?'],['성화','일단 아무것도 함부로 만지지 마.'],['여상','홍중이 형, 여기 침대마다 번호가 붙어 있어.'],['윤호','다들 같은 장소에 있는 건가? 보이는 것부터 확인하자.'],['종호','형들, 내 쪽엔 사망진단서가 있어.'],['산','우영아, 너 있는 데도 침대 아래가 보여?'],['우영','왜? ...야, 거기 뭐 있어?']];
  for(const [name,message] of dialogue){const row=document.createElement('div');row.style.cssText='display:flex;flex-direction:column;align-items:flex-start;gap:4px';const label=document.createElement('span');label.textContent=name;label.style.cssText='font-size:12px;color:#bcbcbc';const bubble=document.createElement('div');bubble.textContent=message;bubble.style.cssText='max-width:90%;background:#292929;border-radius:4px 13px 13px 13px;padding:10px 13px;color:#f5f5f5;white-space:pre-wrap';row.append(label,bubble);thread.append(row);}
  phone.append(thread);
  const footer=document.createElement('div');footer.style.cssText='padding:14px;border-top:1px solid #303030;background:#101010';
  const start=document.createElement('button');start.type='button';start.textContent='대화 확인 · 조사 시작';start.style.cssText='width:100%;padding:15px;border:1px solid #777;border-radius:9px;background:#272727;color:#fff;font:700 16px system-ui;cursor:pointer;touch-action:manipulation';start.addEventListener('click',()=>overlay.remove());
  footer.append(start);phone.append(footer);overlay.append(phone);document.body.append(overlay);
 }
 document.addEventListener('hm-v175-state',mountCh02GroupIntro);
 document.addEventListener('hm-v175-started',mountCh02GroupIntro);

 // Subsequent chapter story intros: narrative only, never modify cooperative puzzles.
 // CH03 owns a standalone visual layer; the legacy reception must never be visible.

 // CH03 mirror is local-first: no WebSocket round trip to open or rub.
 const ch03MirrorDigits=[4,1,7,3,8,2,6,5];
 let ch03MirrorRubCount=0,ch03MirrorRoleKey='';
 function ch03MirrorIndex(){
  const roles=ch02RoomRoles;
  const i=roles.indexOf(ch02AssignedRole);
  return i>=0?i:-1;
 }
 function openCh03Mirror(){
  document.getElementById('hmCh03MirrorModal')?.remove();
  const index=ch03MirrorIndex();
  const capacity=[2,4,8].includes(ch02RoomCapacity)?ch02RoomCapacity:2;
  const key=String(ch02AssignedRole)+'/'+ch02RoomRoles.join(',')+'/'+capacity;
  if(ch03MirrorRoleKey!==key){ch03MirrorRoleKey=key;ch03MirrorRubCount=0;}
  const overlay=document.createElement('div');overlay.id='hmCh03MirrorModal';
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483600;background:#030405f5;color:#f2eae3;display:flex;align-items:center;justify-content:center;padding:15px;box-sizing:border-box;font:14px system-ui';
  const card=document.createElement('div');card.style.cssText='width:min(440px,100%);max-height:95dvh;overflow:auto;background:#121516;border:1px solid #575452;border-radius:10px;padding:15px;box-sizing:border-box';
  const head=document.createElement('div');head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px';
  const title=document.createElement('strong');title.textContent='금이 간 거울 · 반사면 조사';
  const close=document.createElement('button');close.type='button';close.textContent='닫기';close.style.cssText='padding:9px 14px;background:#302d30;color:white;border:1px solid #71656c;border-radius:6px';
  close.onclick=()=>overlay.remove();head.append(title,close);card.append(head);
  const mirror=document.createElement('div');
  mirror.style.cssText='position:relative;width:100%;height:min(53dvh,390px);min-height:220px;overflow:hidden;border:7px ridge #4b4542;border-radius:5px;background:linear-gradient(110deg,#0a1011,#4d5755 33%,#121a1c 62%,#333b39);touch-action:none;user-select:none;cursor:crosshair;box-sizing:border-box';
  const scratch=document.createElement('div');scratch.style.cssText='position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(123deg,transparent 0 44px,#a8a5a41a 45px,#12141477 48px,transparent 52px),radial-gradient(ellipse at 55% 40%,#9b99938a,#121717d9 78%);transition:opacity .35s';
  const number=document.createElement('div');number.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 clamp(72px,25vw,145px) Georgia,serif;color:#e6dfd3;text-shadow:0 0 12px #e7ddd5,0 0 30px #a4a8a2;opacity:0;pointer-events:none;transition:opacity .5s';
  if(index>=0&&index<capacity)number.textContent=String(ch03MirrorDigits[index]);
  mirror.append(number,scratch);
  const info=document.createElement('p');info.style.cssText='margin:12px 0;color:#c4b8b7;text-align:center;min-height:40px';
  const threshold=index+1;
  function paint(){
   const revealed=index>=0&&index<capacity&&ch03MirrorRubCount>=threshold;
   number.style.opacity=revealed?'1':'0';
   scratch.style.opacity=revealed?'.12':String(Math.max(.3,.94-ch03MirrorRubCount*.1));
   info.textContent=index<0?'조사원 배정을 확인할 수 없습니다. 팀 연결 상태를 확인하세요.':revealed?'먼지 아래 숫자가 드러났다. 이 숫자를 팀원에게 전달하자.':'거울에 묻은 얼룩을 손가락이나 마우스로 문질러 보자.';
  }
  let down=false,distance=0,lastX=0,lastY=0;
  function rub(){
   if(index<0||index>=capacity||ch03MirrorRubCount>=threshold)return;
   ch03MirrorRubCount++;
   paint();
  }
  mirror.addEventListener('pointerdown',e=>{down=true;distance=0;lastX=e.clientX;lastY=e.clientY;mirror.setPointerCapture?.(e.pointerId);});
  mirror.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;distance+=Math.hypot(dx,dy);lastX=e.clientX;lastY=e.clientY;if(distance>=110){distance=0;rub();}});
  const end=()=>{down=false;distance=0;};mirror.addEventListener('pointerup',end);mirror.addEventListener('pointercancel',end);
  card.append(mirror,info);
  const fallback=document.createElement('button');fallback.type='button';fallback.textContent='거울 문지르기 (접근성 버튼)';fallback.style.cssText='width:100%;padding:12px;background:#2b3031;color:#eae4dc;border:1px solid #5d6666;border-radius:6px';fallback.onclick=rub;card.append(fallback);
  overlay.append(card);document.body.append(overlay);paint();
 }

 // CH03 floor directory: each investigator receives one private ordering mark.
 // These positions are stable per room capacity and never require a server request to open.
 function openCh03FloorDirectory(){
  document.getElementById('hmCh03FloorDirectory')?.remove();
  const capacity=[2,4,8].includes(ch02RoomCapacity)?ch02RoomCapacity:2;
  const index=ch03MirrorIndex();
  const symbols=['★','●','▲','■','◆','✚','☾','♣'];
  const orderByCapacity={2:[2,1],4:[3,1,4,2],8:[3,1,6,2,8,4,7,5]};
  const order=orderByCapacity[capacity];
  // Each capacity masks exactly its highest N floors; each investigator sees one private symbol on their assigned floor.
  const floor=9-capacity+index;
  const rank=index>=0&&index<capacity?order[index]:null;
  const ownSymbol=rank===null?null:symbols[rank-1];
  const overlay=document.createElement('div');overlay.id='hmCh03FloorDirectory';
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483600;background:#030405f5;color:#f2eae3;display:flex;align-items:center;justify-content:center;padding:15px;box-sizing:border-box;font:14px system-ui';
  const card=document.createElement('section');card.style.cssText='width:min(440px,100%);max-height:94dvh;overflow:auto;background:#171513;border:1px solid #5b534b;border-radius:10px;padding:15px;box-sizing:border-box';
  const header=document.createElement('div');header.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px';
  const title=document.createElement('strong');title.textContent='회명병원 · 층별 안내문';
  const close=document.createElement('button');close.type='button';close.textContent='닫기';close.style.cssText='padding:9px 14px;background:#302d30;color:white;border:1px solid #71656c;border-radius:6px';close.onclick=()=>overlay.remove();
  header.append(title,close);card.append(header);
  const paper=document.createElement('div');paper.style.cssText='padding:18px 14px;background:radial-gradient(ellipse at 13% 7%,#5e594d70,transparent 38%),radial-gradient(ellipse at 90% 88%,#514a3f91,transparent 48%),repeating-linear-gradient(2deg,#b5a994 0 2px,#b9ad98 3px 7px);border:2px solid #70675b;color:#29231f;box-shadow:inset 0 0 25px #443c36a3;transform:rotate(-.4deg)';
  const heading=document.createElement('div');heading.textContent='回明病院 / 층별 시설 안내';heading.style.cssText='font:bold 19px serif;text-align:center;border-bottom:2px solid #5c5047;padding-bottom:10px;margin-bottom:12px';paper.append(heading);
  const labels=['접수실','진료실','검사실','기록보관실','수술실','입원병동','폐쇄병동','기계실'];
  for(let i=0;i<8;i++){
   const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;min-height:39px;border-bottom:1px dashed #7e7067;padding:3px 8px;gap:10px;'+(i===floor-1?'background:#7c514b28;':'');
   const name=document.createElement('span');name.textContent=String(i+1).padStart(2,'0')+'F  '+(i>=8-capacity?(i===floor-1&&ownSymbol!==null?ownSymbol:'???'):labels[i]);name.style.cssText='font:600 16px Georgia,serif;letter-spacing:.4px';
   const stamp=document.createElement('span');stamp.style.cssText='font:bold 23px Georgia,serif;color:#702d2a;min-width:40px;text-align:center;transform:rotate(-8deg)';
   stamp.textContent=i===floor-1&&ownSymbol!==null?ownSymbol:'';
   row.append(name,stamp);paper.append(row);
  }
  const footer=document.createElement('div');footer.textContent='※ 안내문 임의 수정 금지 / 일부 층의 기록이 훼손되었습니다.';footer.style.cssText='font:11px serif;text-align:center;margin-top:14px;color:#514238';paper.append(footer);
  card.append(paper);
  const help=document.createElement('p');help.style.cssText='color:#c9b8ae;font-size:13px;line-height:1.6;margin:13px 0 0';
  help.textContent=ownSymbol===null?'조사원 배정 정보를 확인할 수 없습니다. 팀 연결 상태를 확인하세요.':'붉은 기호를 기억하자. 거울에서 발견한 숫자와 이 기호를 함께 팀원에게 전달해야 한다.';
  card.append(help);overlay.append(card);document.body.append(overlay);
 }

 // CH03 calculator is an immediate local object; each symbol is filled from team-shared mirror clues.
 const ch03Symbols=['★','●','▲','■','◆','✚','☾','♣'];
 const ch03SymbolOrder={2:[2,1],4:[3,1,4,2],8:[3,1,6,2,8,4,7,5]};
 const ch03Expressions={
  2:{label:'(★ + ●) × (● − ★)',evaluate:v=>(v[0]+v[1])*(v[1]-v[0])},
  4:{label:'(■ + ▲) × ● − ★',evaluate:v=>(v[3]+v[2])*v[1]-v[0]},
  8:{label:'(♣ − ◆) × ✚ + (☾ ÷ ■) + (▲ × ●) − ★',evaluate:v=>(v[7]-v[4])*v[5]+v[6]/v[3]+v[2]*v[1]-v[0]}
 };
 function ch03ExpectedSymbolValues(capacity){
  const ranks=ch03SymbolOrder[capacity],values=Array(capacity).fill(null);
  ranks.forEach((rank,i)=>{values[rank-1]=ch03MirrorDigits[i];});
  return values;
 }
 function openCh03SymbolCalculator(){
  document.getElementById('hmCh03SymbolCalculator')?.remove();
  const capacity=[2,4,8].includes(ch02RoomCapacity)?ch02RoomCapacity:2;
  const expression=ch03Expressions[capacity];
  const overlay=document.createElement('div');overlay.id='hmCh03SymbolCalculator';
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483600;background:#030405f5;color:#e9e2d9;display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;font:14px system-ui';
  const card=document.createElement('section');card.style.cssText='width:min(460px,100%);max-height:94dvh;overflow:auto;background:linear-gradient(145deg,#292826,#111415);border:2px solid #5e5c54;border-radius:10px;padding:16px;box-sizing:border-box;box-shadow:inset 0 0 25px #000';
  const header=document.createElement('div');header.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px';
  const title=document.createElement('strong');title.textContent='운행 제어장치 · 기호 연산판';
  const close=document.createElement('button');close.type='button';close.textContent='닫기';close.style.cssText='padding:9px 14px;background:#302d30;color:#fff;border:1px solid #71656c;border-radius:6px';close.onclick=()=>overlay.remove();
  header.append(title,close);card.append(header);
  const instruction=document.createElement('p');instruction.textContent='거울에서 찾은 숫자와 층별 안내문의 기호를 대조하여 각 칸을 채우십시오.';instruction.style.cssText='color:#c6c2b9;line-height:1.6;margin:0 0 14px';card.append(instruction);
  const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:14px';
  const inputs=[];
  for(let i=0;i<capacity;i++){
   const field=document.createElement('label');field.style.cssText='display:flex;flex-direction:column;align-items:center;gap:6px;background:#1c1e1e;border:1px solid #5d5c58;border-radius:6px;padding:9px 5px';
   const symbol=document.createElement('span');symbol.textContent=ch03Symbols[i];symbol.style.cssText='font:700 27px Georgia,serif;color:#c9b6a0';
   const input=document.createElement('input');input.type='text';input.inputMode='numeric';input.maxLength=1;input.placeholder='?';input.autocomplete='off';input.setAttribute('aria-label',ch03Symbols[i]+' 기호 숫자');
   input.style.cssText='width:100%;max-width:55px;min-width:0;box-sizing:border-box;text-align:center;padding:8px 3px;border:1px solid #706c64;background:#090c0d;color:#fff;border-radius:4px;font:600 20px system-ui';
   input.addEventListener('input',()=>{input.value=input.value.replace(/[^0-9]/g,'').slice(0,1);result.textContent='기호의 값을 확인하고 수식은 직접 계산하세요.';});
   inputs.push(input);field.append(symbol,input);grid.append(field);
  }
  card.append(grid);
  const formula=document.createElement('div');formula.textContent=expression.label;formula.style.cssText='padding:16px 8px;border:1px solid #675e54;background:#111312;text-align:center;border-radius:6px;font:600 18px/1.6 Georgia,serif;overflow-wrap:anywhere';card.append(formula);
  const result=document.createElement('p');result.textContent='기호별 숫자를 대조한 뒤 수식을 직접 계산하세요. 최종값은 엘리베이터에서 입력합니다.';result.style.cssText='min-height:48px;text-align:center;color:#d9c5b8;white-space:pre-wrap;line-height:1.6';
  const run=document.createElement('button');run.type='button';run.textContent='기호 대응 확인';run.style.cssText='width:100%;padding:14px;background:#443542;color:#fff;border:1px solid #9e8299;border-radius:6px;font:600 15px system-ui';
  run.onclick=()=>{
   const values=inputs.map(input=>input.value===''?null:Number(input.value));
   if(values.some(v=>v===null)){result.textContent='빈 기호가 있습니다. 팀원들의 단서를 확인하십시오.';return;}
   const expected=ch03ExpectedSymbolValues(capacity);
   result.textContent=values.some((v,i)=>v!==expected[i])?'기호와 숫자의 대응이 일치하지 않습니다. 거울과 안내문을 다시 대조하세요.':'기호와 숫자의 대응이 맞습니다. 표시된 수식은 직접 계산해서 엘리베이터 운행 코드에 입력하세요.';
  };
  card.append(result,run);overlay.append(card);document.body.append(overlay);
 }

 let ch03ToCh04Playing=false;
 function playCh03ToCh04Video(){
  if(ch03ToCh04Playing||document.getElementById('hmCh03ToCh04Video'))return;
  ch03ToCh04Playing=true;
  const overlay=document.createElement('div');overlay.id='hmCh03ToCh04Video';
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483651;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#e8dfdb;font:14px system-ui';
  const video=document.createElement('video');video.src='/G02.mp4';video.autoplay=true;video.playsInline=true;video.controls=false;video.preload='auto';
  video.style.cssText='width:100%;max-height:90dvh;object-fit:contain';
  const info=document.createElement('div');info.textContent='기록보관실 이동 영상 · G02';info.style.cssText='padding:12px;text-align:center;color:#cbbbc0';
  video.addEventListener('ended',()=>{
   info.textContent='영상 시청 완료 · 다른 조사원을 기다리는 중…';
   if(socket?.readyState===NativeWS.OPEN)socket.send(JSON.stringify({type:'chapter',action:'ch03_transition_video_done'}));
  },{once:true});
  video.addEventListener('error',()=>{info.textContent='G02 영상을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.';video.controls=true;},{once:true});
  overlay.append(video,info);document.body.append(overlay);
  video.play().catch(()=>{video.muted=true;video.play().catch(()=>{info.textContent='자동재생이 차단되었습니다. 영상을 눌러 재생하세요.';video.controls=true;});});
 }
 let ch03VideoSeen=false;
 function playCh03ElevatorVideo(){
  if(ch03VideoSeen||document.getElementById('hmCh03G06'))return;
  const overlay=document.createElement('div');overlay.id='hmCh03G06';
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483650;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#e8dfdb;font:14px system-ui';
  const video=document.createElement('video');video.src='/G06.mp4';video.autoplay=true;video.playsInline=true;video.controls=false;video.preload='auto';video.style.cssText='width:100%;max-height:90dvh;object-fit:contain';
  const info=document.createElement('div');info.textContent='엘리베이터 내부 감시 기록 재생 중';info.style.cssText='padding:12px;color:#cbbbc0;text-align:center';
  const finish=()=>{ch03VideoSeen=true;if(socket?.readyState===NativeWS.OPEN)socket.send(JSON.stringify({type:'chapter',action:'ch03_video_done'}));overlay.remove();const form=document.getElementById('hmCh03CodeForm');if(form){form.hidden=false;form.style.display='flex';}const note=document.getElementById('hmIndependentCh03Note');if(note)note.textContent='환자복의 형체가 사라졌다. 계산한 운행 코드를 입력하십시오.';};
  video.addEventListener('ended',finish,{once:true});
  video.addEventListener('error',()=>{info.textContent='G06 영상을 불러오지 못했습니다. 다시 시도해 주세요.';video.controls=true;},{once:true});
  overlay.append(video,info);document.body.append(overlay);
  video.play().catch(()=>{video.muted=true;video.play().catch(()=>{info.textContent='자동재생이 차단되었습니다. 영상을 눌러 재생하십시오.';video.controls=true;});});
 }

 let ch03FragmentCollected=false;
 function showCh03Cleared(){
  if(!active||phase!=='ch03_cleared'){document.getElementById('hmCh03Cleared')?.remove();return;}
  document.getElementById('hmIndependentCh03')?.remove();
  let root=document.getElementById('hmCh03Cleared');
  if(root)return;
  root=document.createElement('section');root.id='hmCh03Cleared';
  root.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#09090b;color:#eee7df;display:flex;flex-direction:column;overflow:auto;font:14px/1.5 system-ui';
  const title=document.createElement('header');title.textContent='03. 엘리베이터 · 운행 코드 승인';title.style.cssText='padding:16px;text-align:center;border-bottom:1px solid #4c4346';root.append(title);
  const scene=document.createElement('div');scene.style.cssText='position:relative;width:100%;aspect-ratio:16/9;flex:none;background:#070709';
  const photo=document.createElement('img');photo.src='/elevator_hall.webp';photo.alt='엘리베이터 내부';photo.style.cssText='width:100%;height:100%;object-fit:cover;display:block';scene.append(photo);
  const mirror=document.createElement('button');mirror.type='button';mirror.setAttribute('aria-label','거울 가장자리의 틈 조사');
  mirror.style.cssText='position:absolute;left:6%;top:12%;width:30%;height:58%;border:0;background:transparent;cursor:pointer;touch-action:manipulation';
  mirror.onclick=()=>{
   const status=document.getElementById('hmCh03ClearedStatus');
   if(status)status.textContent='거울 가장자리의 틈을 조사하는 중…';
   if(socket?.readyState===NativeWS.OPEN)socket.send(JSON.stringify({type:'chapter',action:'fragment_search',site:'mirror'}));
   else if(status)status.textContent='협동 서버 연결이 끊어졌습니다.';
  };
  scene.append(mirror);root.append(scene);
  const panel=document.createElement('div');panel.style.cssText='padding:18px;display:flex;flex-direction:column;gap:14px;align-items:stretch;max-width:540px;width:100%;box-sizing:border-box;margin:0 auto';
  const description=document.createElement('p');description.textContent='엘리베이터 문이 열렸지만 거울 가장자리에 이상한 틈이 남아 있다. 직접 조사해 제0유물 파편을 회수하자.';panel.append(description);
  const status=document.createElement('div');status.id='hmCh03ClearedStatus';status.textContent=ch03FragmentCollected?'제0유물 파편이 공동 소지품에 등록되었습니다.':'거울 가장자리를 눌러 조사하세요.';status.style.cssText='padding:12px;border:1px solid #65535c;border-radius:6px;background:#1d171c';panel.append(status);
  const next=document.createElement('button');next.type='button';next.textContent='기록보관실로 이동 · CH.04';next.style.cssText='padding:14px;background:#4b354e;color:white;border:1px solid #9c819d;border-radius:7px;font:600 15px system-ui';
  next.onclick=()=>{
   if(!ch03FragmentCollected){status.textContent='먼저 거울 틈의 제0유물 파편을 회수해야 합니다.';return;}
   if(socket?.readyState===NativeWS.OPEN){status.textContent='CH.04 이동 요청 중…';socket.send(JSON.stringify({type:'chapter',action:'ch04_enter'}));}
   else status.textContent='서버 연결을 확인하세요.';
  };
  panel.append(next);root.append(panel);document.body.append(root);
 }
 function mountIndependentCh03(){
  const old=document.getElementById('hmIndependentCh03');
  if(!active||phase!=='ch03'){old?.remove();return;}
  if(old){old.style.setProperty('display','flex','important');return;}
  document.getElementById('hmCh02ClearScene')?.remove();
  document.getElementById('hmCh02NewDialog')?.remove();
  const root=document.createElement('section');root.id='hmIndependentCh03';
  root.style.cssText='position:fixed!important;inset:0!important;z-index:2147483000!important;background:#080709;color:#e9e3dd;display:flex!important;flex-direction:column;font:14px/1.5 system-ui;overflow-y:auto;overscroll-behavior:contain;pointer-events:auto!important';
  const header=document.createElement('header');header.textContent='03. 엘리베이터 · 回明病院';
  header.style.cssText='flex:none;padding:13px 18px;background:#0d0d10;border-bottom:1px solid #494149;letter-spacing:1px;text-align:center';root.append(header);
  const scene=document.createElement('div');scene.style.cssText='position:relative;flex:1 1 auto;min-height:45dvh;width:100%;overflow:hidden;background:#09080a';
  const imageLayer=document.createElement('div');imageLayer.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);aspect-ratio:16/9;overflow:hidden';
  const photo=document.createElement('img');photo.src='/elevator_hall.webp';photo.alt='낡은 회명병원 엘리베이터';photo.style.cssText='width:100%;height:100%;object-fit:fill;display:block;pointer-events:none';imageLayer.append(photo);
  function sizeElevatorImage(){const w=scene.clientWidth,h=scene.clientHeight;if(!w||!h)return;const width=Math.min(w,h*16/9);imageLayer.style.width=width+'px';imageLayer.style.height=width*9/16+'px';}
  const elevatorResizeObserver=new ResizeObserver(sizeElevatorImage);elevatorResizeObserver.observe(scene);
  photo.addEventListener('load',sizeElevatorImage);requestAnimationFrame(sizeElevatorImage);
  scene.append(imageLayer);
  // Irregular damp grime on the floor directory; no fabricated readable text.
  const grime=document.createElement('div');grime.setAttribute('aria-hidden','true');
  grime.style.cssText='position:absolute;left:76%;top:10%;width:17%;height:76%;pointer-events:none;opacity:.9;mix-blend-mode:multiply;background:radial-gradient(ellipse at 23% 15%,#070a09 0%,#161e1a 18%,transparent 46%),radial-gradient(ellipse at 78% 43%,#080b09 0%,#161d18 23%,transparent 53%),radial-gradient(ellipse at 42% 73%,#060807 0%,#18211c 27%,transparent 60%),linear-gradient(102deg,transparent 5%,#101411a8 39%,transparent 72%);filter:blur(2px)';imageLayer.append(grime);
  root.append(scene);
  const bottom=document.createElement('div');bottom.style.cssText='flex:none;padding:10px 12px 16px;background:#100d12;border-top:1px solid #494149;display:grid;grid-template-columns:1fr 1fr;gap:8px';
  const note=document.createElement('div');note.id='hmIndependentCh03Note';note.textContent='왼쪽 거울을 문질러 숫자를 찾으세요. 제0유물은 거울 오른쪽 테두리의 틈에 있습니다. 오른쪽 벽의 작은 버튼으로 엘리베이터를 작동하고, 안내문·계산판은 각각 직접 눌러 조사하세요.';note.style.cssText='grid-column:1/-1;min-height:0;white-space:pre-wrap;color:#d9c9d5;padding:10px;background:#1e1721;border:1px solid #4b394d;border-radius:6px';bottom.append(note);
  function sendInvestigation(action,extra,label){
   note.textContent=label+' 조사 요청 중…';
   if(socket?.readyState===NativeWS.OPEN){socket.send(JSON.stringify({type:'chapter',action,...extra}));}
   else note.textContent='협동 서버 연결이 끊어졌습니다. 연결 후 다시 조사해 주세요.';
  }
  function control(label,action,extra){
   const b=document.createElement('button');b.type='button';b.textContent=label;
   b.style.cssText='display:block!important;visibility:visible!important;opacity:1!important;position:relative!important;z-index:1;min-height:50px;padding:12px 8px;border:1px solid #766477;border-radius:7px;background:#2a202c!important;color:#f5edf3!important;font:600 14px system-ui;pointer-events:auto!important;touch-action:manipulation;cursor:pointer';
   b.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();sendInvestigation(action,extra,label);});
   bottom.append(b);
  }

  // Transparent accessible hotspots: scene objects, not a separate control grid.
  function hotspot(label,left,top,width,height,action){
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',label);button.title=label;
   button.style.cssText='position:absolute;left:'+left+'%;top:'+top+'%;width:'+width+'%;height:'+height+'%;background:transparent;border:0;cursor:pointer;touch-action:manipulation;z-index:2';
   button.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();action();});
   button.addEventListener('focus',()=>button.style.outline='2px solid #d6b3bb');
   button.addEventListener('blur',()=>button.style.outline='none');
   imageLayer.append(button);return button;
  }
  // Hotspots are attached to the same 16:9 image layer, so cover cropping
  // cannot shift a touch target relative to its photographed object.
  hotspot('거울 문지르기',5,12,19,58,openCh03Mirror);
  const fragmentHotspot=hotspot('거울 오른쪽 테두리 틈 · 제0유물 조사',24,19,9,43,()=>sendInvestigation('ch03_fragment',{},'거울 가장자리'));fragmentHotspot.style.zIndex='3';
  hotspot('오른쪽 벽 층별 안내문',76,12,18,48,openCh03FloorDirectory);
  hotspot('오른쪽 아래 기호 계산판',80,72,18,22,openCh03SymbolCalculator);
  hotspot('엘리베이터 운행 버튼',68,46,8,15,()=>sendInvestigation('ch03_video',{},'엘리베이터'));
  const inventory=document.createElement('button');inventory.type='button';inventory.id='hmCh03Inventory';inventory.style.cssText='grid-column:1/-1;padding:10px 12px;border:1px solid #766477;border-radius:7px;background:#211b28;color:#f4e8f1;font:600 14px system-ui;text-align:left';
  const updateInventory=()=>{const progress=document.getElementById('artifactProgress')?.textContent||'제0유물 파편 수집함';inventory.textContent='🎒 '+progress+(ch03FragmentCollected?' · 거울 파편 획득':' · 거울 파편 미획득');};
  inventory.addEventListener('click',()=>{updateInventory();const original=document.getElementById('tabInventory');if(original){root.style.setProperty('display','none','important');original.click();const restore=()=>root.style.setProperty('display','flex','important');const close=document.createElement('button');close.type='button';close.textContent='← 엘리베이터 화면으로 돌아가기';close.style.cssText='position:fixed;top:12px;right:12px;z-index:2147483001;padding:12px;background:#211b28;color:white;border:1px solid #766477;border-radius:6px';close.onclick=()=>{close.remove();restore();};document.body.append(close);}else note.textContent='공동 소지품 화면을 찾을 수 없습니다.';});
  bottom.append(inventory);updateInventory();
  // Always provide usable controls when photographed objects are cropped or missing.
  control('거울 조사','ch03_mirror',{}); 
  const mirrorButton=bottom.lastElementChild;mirrorButton.onclick=(ev)=>{ev.preventDefault();ev.stopPropagation();openCh03Mirror();};
  control('제0유물 파편 수집','ch03_fragment',{});
  const directoryButton=document.createElement('button');directoryButton.type='button';directoryButton.textContent='층별 안내문 조사';directoryButton.style.cssText=mirrorButton.style.cssText;directoryButton.onclick=()=>openCh03FloorDirectory();bottom.append(directoryButton);
  const calcButton=document.createElement('button');calcButton.type='button';calcButton.textContent='기호 계산판 조사';calcButton.style.cssText=mirrorButton.style.cssText;calcButton.onclick=()=>openCh03SymbolCalculator();bottom.append(calcButton);
  control('엘리베이터 버튼 작동','ch03_video',{});
  const form=document.createElement('form');form.id='hmCh03CodeForm';form.hidden=!ch03VideoSeen;form.style.cssText='grid-column:1/-1;display:'+(ch03VideoSeen?'flex':'none')+';gap:8px';
  const input=document.createElement('input');input.placeholder='운행 코드 입력';input.inputMode='numeric';input.maxLength=2;input.autocomplete='off';input.style.cssText='min-width:0;flex:1;padding:12px;background:#161119;color:#fff;border:1px solid #766477;border-radius:6px;font-size:16px';
  const submit=document.createElement('button');submit.type='submit';submit.textContent='암호 입력';submit.style.cssText='padding:12px 15px;background:#4b354e;color:#fff;border:1px solid #a18ba5;border-radius:6px;font-size:14px';
  form.addEventListener('submit',ev=>{ev.preventDefault();ev.stopPropagation();if(!/^[0-9]{2}$/.test(input.value.trim())){note.textContent='두 자리 운행 코드를 입력하세요.';return;}sendInvestigation('ch03_submit',{answer:input.value.trim()},'암호');});
  form.append(input,submit);bottom.append(form);root.append(bottom);
  document.body.append(root);
 }
 // Keep the server-authoritative chapter above the legacy V172 scene.
 // V172 may re-render the reception asynchronously after a chapter event.
 function reconcileChapterSurface(){
  if(!active)return;
  if(phase==='ch02_cleared'){
   document.getElementById('hmIndependentCh03')?.remove();
   if(!document.getElementById('hmCh02ClearScene'))showCh02Clear();
   const cleared=document.getElementById('hmCh02ClearScene');
   if(cleared)cleared.style.setProperty('z-index','2147482999','important');
  }else if(phase==='ch03'){
   document.getElementById('hmCh03Cleared')?.remove();
   document.getElementById('hmCh02ClearScene')?.remove();
   mountIndependentCh03();
  }else if(phase==='ch03_cleared'){
   showCh03Cleared();
  }else if(phase!=='ch02'){
   document.getElementById('hmCh03Cleared')?.remove();
   document.getElementById('hmIndependentCh03')?.remove();
  }
 }
 document.addEventListener('hm-v175-state',reconcileChapterSurface);
 document.addEventListener('hm-v175-started',reconcileChapterSurface);
 // Legacy UI mutates its scene after WebSocket events; reassert only for cleared/CH03.
 setInterval(()=>{if(active&&(phase==='ch02_cleared'||phase==='ch03'||phase==='ch03_cleared'))reconcileChapterSurface();},750);
 document.addEventListener('hm-v175-state',mountIndependentCh03);
 document.addEventListener('hm-v175-started',mountIndependentCh03);
 const laterStory={
  ch03:[['홍중','다들 들었지? 방금 스피커에서 우리 이름 불렀어.'],['종호','홍중이 형, 난 아직 이름 말한 적 없는데.'],['민기','잠깐, 엘리베이터 문 닫혔잖아. 누가 열림 버튼 누르고 있어?'],['윤호','민기야, 버튼에서 손 떼. 지금 아무도 안 누르고 있어.'],['여상','성화 형, 거울 봐. 우리 여덟인데... 하나가 더 보여.'],['성화','여상아, 거울 보지 마. 다들 앞만 봐.'],['우영','산아, 아까부터 내 뒤에 누가 숨 쉬는 것 같아.'],['산','우영아, 뒤돌지 마. 내가 확인할게.'],['홍중','층수 버튼이랑 스피커부터 확인하자. 찾은 건 여기 공유해.']],
  ch04:[['홍중','여긴 기록실인가 봐. 다들 들어왔어?'],['성화','서류가 왜 이렇게 흩어져 있어?'],['윤호','홍중이 형, CCTV 화면에 우리 모습이 나와.'],['민기','근데 인원이 안 맞는데?'],['여상','나도 봤어. 한 명 더 있어.'],['종호','형들, 뒤돌아보지 마.'],['우영','야, 그런 말 하지 마. 더 무섭잖아.'],['산','우영아, 화면부터 확인하자.']],
  ch05:[['성화','다들 목소리 들려? 여긴 너무 조용해.'],['홍중','각자 위치부터 확인하자.'],['여상','성화 형, 천장에 뭐가 지나갔어.'],['민기','윤호야, 너도 봤어?'],['윤호','응. 일단 불빛 있는 쪽으로 가지 마.'],['종호','형들, 저쪽 문이 혼자 닫혔어.'],['우영','산아, 나 지금 장난 못 받아줘.'],['산','알아. 내 옆에 있어.']],
  ch06:[['홍중','여기가 마지막인 것 같아. 다들 준비됐어?'],['성화','홍중아, 아직 끝난 거 아니야. 조심해.'],['윤호','민기야, 지금까지 찾은 단서 다 기억하지?'],['민기','응. 하나도 안 놓쳤어.'],['여상','형, 제0유물 반응이 점점 커져.'],['종호','형들, 문 열리기 전에 확인할 게 있어.'],['우영','산아, 우리 이번엔 같이 나가자.'],['산','응. 누구도 두고 가지 마.']]
 };
 const laterIntroSeen=new Set();
 let ch03IntroAudioWindowElapsed=false,ch03IntroAudioTimer=null;
 function mountLaterGroupIntro(){
  for(const old of document.querySelectorAll('.hmLaterStoryIntro'))if(old.dataset.phase!==phase)old.remove();
  if(!active||!laterStory[phase]||laterIntroSeen.has(phase))return;
  if(phase==='ch03'&&!ch03IntroAudioWindowElapsed){
   if(!ch03IntroAudioTimer){ch03IntroAudioTimer=setTimeout(()=>{ch03IntroAudioWindowElapsed=true;ch03IntroAudioTimer=null;mountLaterGroupIntro();},2800);}
   return;
  }
  laterIntroSeen.add(phase);
  const overlay=document.createElement('div');overlay.className='hmLaterStoryIntro';overlay.dataset.phase=phase;
  overlay.style.cssText='position:fixed;inset:0;z-index:999995;background:#050505;color:#f5f5f5;display:flex;justify-content:center;align-items:center;padding:14px;box-sizing:border-box;font:14px/1.5 system-ui';
  const phone=document.createElement('section');phone.style.cssText='width:min(500px,100%);height:min(720px,92dvh);display:flex;flex-direction:column;background:#101010;border:1px solid #343434;border-radius:15px;overflow:hidden;box-shadow:0 16px 50px #000';
  const head=document.createElement('header');head.textContent='회명병원 · 단체 대화 (9)';head.style.cssText='padding:17px 19px;border-bottom:1px solid #303030;font-weight:700;text-align:center';phone.append(head);
  const thread=document.createElement('div');thread.style.cssText='flex:1;overflow:auto;padding:17px 15px;display:flex;flex-direction:column;gap:11px';
  for(const [name,message] of laterStory[phase]){const row=document.createElement('div');row.style.cssText='display:flex;flex-direction:column;align-items:flex-start;gap:4px';const label=document.createElement('span');label.textContent=name;label.style.cssText='font-size:12px;color:#bcbcbc';const bubble=document.createElement('div');bubble.textContent=message;bubble.style.cssText='max-width:90%;background:#292929;border-radius:4px 13px 13px 13px;padding:10px 13px;color:#f5f5f5;white-space:pre-wrap';row.append(label,bubble);thread.append(row);}
  phone.append(thread);
  const footer=document.createElement('div');footer.style.cssText='padding:14px;border-top:1px solid #303030;background:#101010';
  const start=document.createElement('button');start.type='button';start.textContent='조사 시작하기';start.style.cssText='width:100%;padding:15px;border:1px solid #777;border-radius:9px;background:#272727;color:#fff;font:700 16px system-ui;cursor:pointer;touch-action:manipulation';start.onclick=()=>overlay.remove();
  footer.append(start);phone.append(footer);overlay.append(phone);document.body.append(overlay);
 }
 document.addEventListener('hm-v175-state',mountLaterGroupIntro);
 document.addEventListener('hm-v175-started',mountLaterGroupIntro);
 document.addEventListener('hm-v175-state',mountCh01GroupIntro);
 document.addEventListener('hm-v175-started',mountCh01GroupIntro);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountCh01GroupIntro,{once:true});else mountCh01GroupIntro();
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
 // Keep the approved four-button mobile footer but remove the redundant chat
 // and area-movement entries; floating team chat remains available.
 // Hide only the two redundant original mobile navigation items.
 // Preserve inventory, hints, chapter actions, and the separate floating team chat.
 const footerCleanupStyle=document.createElement('style');
 footerCleanupStyle.textContent='[data-menu="chat"],[data-menu="move"],[data-menu="area"],[data-menu="hint"]{display:none!important}';
 document.head.append(footerCleanupStyle);
 function cleanMobileFooter(){
  const menuCandidates=document.querySelectorAll('button,[role="button"],[data-menu]');
  for(const b of menuCandidates){
   if(b.id==='hmV174ChatFloating'||b.closest('#hmV174Chat,#hmCh01GroupIntro,#hmCh02GroupIntro,.hmLaterStoryIntro'))continue;
   const label=(b.textContent||'').replace(/\\s+/g,' ').trim();
   const menu=(b.dataset.menu||'').toLowerCase();
   const footer=b.closest('nav,[class*="bottom"],[class*="footer"],[id*="bottom"],[id*="footer"]');
   if(menu==='chat'||menu==='move'||menu==='area'||menu==='hint'||(footer&&['대화','이동','구역 이동','구역이동','힌트'].includes(label))){
    b.style.setProperty('display','none','important');
    b.setAttribute('aria-hidden','true');
    b.tabIndex=-1;
   }
  }
 }
 document.addEventListener('hm-v175-state',cleanMobileFooter);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanMobileFooter,{once:true});else cleanMobileFooter();
 const footerObserver=new MutationObserver(()=>cleanMobileFooter());
 const startFooterObserver=()=>footerObserver.observe(document.body,{childList:true,subtree:true});
 if(document.body)startFooterObserver();else document.addEventListener('DOMContentLoaded',startFooterObserver,{once:true});
 // CH02 rebuild v1: retain ONLY the approved ward photograph and create four
 // invisible object hit areas. Old V172 ward hotspots and menus are not used.
 const rebuildStyle=document.createElement('style');
 rebuildStyle.textContent=[
 'html.hm-ch02-clean #hmWardScene .ward-hot',
 'html.hm-ch02-clean #hmWardScene .ward-bottom',
 'html.hm-ch02-clean #hmWardScene .hm-horror-site',
 'html.hm-ch02-clean #hmWardScene #hmWardMenu',
 'html.hm-ch02-clean #hmCh02UnderBedHotspot',
 'html.hm-ch02-clean #hmWard02 .ward-bottom',
 'html.hm-ch02-clean #hmWardScene [data-ward-action]',
 'html.hm-ch02-clean #hmWardScene .ward-top button'
 ].join(',')+'{display:none!important}'+
 '#hmWardScene .hm-ch02-new-target{position:absolute;z-index:1005;display:block;border:0;background:transparent;color:transparent;padding:0;border-radius:0;box-shadow:none;cursor:pointer;touch-action:manipulation}'+
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
  if(!root)return;
  // One investigation layer only: the newer overlay owns all four hit zones.
  root.querySelectorAll('.hm-ch02-new-target').forEach(el=>el.remove());
  return;
  for(const [kind,label,coords] of rebuiltTargets){
   const b=document.createElement('button');b.type='button';b.className='hm-ch02-new-target';b.dataset.ch02New=kind;
   b.setAttribute('aria-label',label);b.title=label;b.style.cssText=coords;
   b.addEventListener('click',event=>{
    event.preventDefault();event.stopImmediatePropagation();
    if(!active||phase!=='ch02')return;
    const site=kind==='hand'?'underbed':kind;
    if(site==='underbed')ch02HandPending=true;
    ch02Send('ch02_new_inspect',{site});
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
  media.enqueue=function(id){if(active&&phase==='ch02'&&id!=='H01')return;return original(id)};
  media.__ch02RebuiltGuard=true;
 }
 guardCh02Horror();
 document.addEventListener('hm-v175-state',guardCh02Horror);
 // CH02 standalone investigation layer; approved scene photo remains untouched.
 const ch02Css=document.createElement('style');
 ch02Css.textContent='html.hm-ch02-clean #ch02PuzzlePanel,html.hm-ch02-clean .hm-object-guide,html.hm-ch02-clean .narrative,html.hm-ch02-clean #sceneNarrative,html.hm-ch02-clean #sceneDescription,html.hm-ch02-clean #sceneText,html.hm-ch02-clean .scene-caption{display:none!important}html.hm-ch02-clean #hmCh02NewLayer:not([hidden]){display:block!important}#hmCh02NewLayer{position:absolute;inset:0;z-index:5000;pointer-events:none}#hmCh02NewLayer button{position:absolute!important;pointer-events:auto!important;background:transparent!important;border:0!important;box-shadow:none!important;opacity:0!important;color:transparent!important;font-size:0!important;touch-action:manipulation!important}#hmCh02NewLayer button:focus-visible{outline:2px solid #e9c6d7}';
 // Hide legacy purple ward interaction rectangles; keep the new invisible
 // server-connected investigation buttons and the approved ward photograph.
 const wardTapFix=document.createElement('style');
 wardTapFix.textContent='html.hm-ch02-clean #hmWardScene > .ward-hot,html.hm-ch02-clean #hmWardScene > .hm-horror-site{display:none!important}html.hm-ch02-clean #hmCh02NewLayer{display:none!important;pointer-events:none!important}';
 document.head.append(wardTapFix);
 let ch02TapDebug=false;
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
 // Local CH02 document data mirrors server allocation; no wait for network response.
 function openLocalCh02Clue(site){
  if(!Number.isInteger(ch02AssignedRole)){ch02Dialog('조사원 정보 확인 중','서버에서 담당 조사원 번호를 아직 받지 못했습니다. 잠시 후 다시 조사해 주세요.');return;}
  const count=[2,4,8].includes(ch02RoomCapacity)?ch02RoomCapacity:2;
  const role=ch02RoomRoles.indexOf(ch02AssignedRole);
  if(role<0||role>=count){ch02Dialog('조사원 배정 확인','현재 방의 조사원 순서를 확인할 수 없습니다. 잠시 후 다시 조사해 주세요.');return;}
  if(site==='ecg'){
   const archive=[
    {device:'ECG-01',last:'03:09',signal:'정상 맥박 지속',flag:'사망 처리 후에도 기록됨'},
    {device:'ECG-02',last:'03:21',signal:'정상 맥박 지속',flag:'사망 처리 후에도 기록됨'},
    {device:'ECG-03',last:'03:17',signal:'정상 맥박 지속',flag:'사망 처리 후에도 기록됨'},
    {device:'ECG-04',last:'03:14',signal:'정상 맥박 지속',flag:'사망 처리 후에도 기록됨'}
   ];
   const records=count===2?archive.slice(role*2,role*2+2):count===4?[archive[role]]:role>=4?[archive[role-4]]:[];
   showCh02ECG({role,capacity:count,records,locked:count===8&&role<4});
  }else if(site==='eight'){
   const tags=[
    {patient:'302-A',device:'ECG-04',letter:'D',tag:'08-A'},
    {patient:'302-B',device:'ECG-01',letter:'E',tag:'08-B'},
    {patient:'302-C',device:'ECG-02',letter:'D',tag:'08-C'},
    {patient:'302-D',device:'ECG-03',letter:'A',tag:'08-D'}
   ];
   const records=count===2?tags.slice(role*2,role*2+2):count===4?[tags[role]]:role<4?[]:[tags[role-4]];
   showCh02BedTags({role,capacity:count,records,locked:count===8&&role<4,rule:'사망 판정 이후에도 심장 신호가 남은 시간. 가장 오래 지속된 기록부터 읽어라.'});
  }
  if(socket?.readyState===NativeWS.OPEN)socket.send(JSON.stringify({type:'chapter',action:'ch02_new_inspect',site}));
 }
 function openLocalCh02Certificate(){
  if(!Number.isInteger(ch02AssignedRole)){ch02Dialog('조사원 정보 확인 중','서버에서 담당 조사원 번호를 아직 받지 못했습니다. 잠시 후 다시 조사해 주세요.');return;}
  const records=[
   {id:'A-01',patient:'성명 불명 / 302-A',time:'02:41',cause:'심정지',stamp:'사망 확인',trace:'사망 판정 후 심전도 자료가 삭제 처리됨',revision:'원본 판정란 위에 재기입 흔적'},
   {id:'B-02',patient:'성명 불명 / 302-B',time:'02:38',cause:'호흡 정지',stamp:'사망 확인',trace:'의사 서명 시각이 원본과 일치하지 않음',revision:'의사 서명란 잉크 색상 불일치'},
   {id:'C-03',patient:'성명 불명 / 302-C',time:'03:06',cause:'다발성 장기부전',stamp:'사망 확인',trace:'사망 판정 후 활력 기록이 비공개 처리됨',revision:'직접 사인 항목의 수정 흔적'},
   {id:'D-04',patient:'성명 불명 / 302-D',time:'02:52',cause:'심폐 기능 정지',stamp:'사망 확인',trace:'기록 수정 이력에 담당자 확인 없음',revision:'사망 판정 도장 아래 다른 글씨가 비침'}
  ];
  const verification=[
   {id:'대조-01',patient:'302-A / 기록 대조',time:'02:41',cause:'사망 판정 원본 대조',stamp:'원본 확인 필요',trace:'심전도 원본과 사망 판정이 상충함',revision:'A 문서의 수정 이력 확인'},
   {id:'대조-02',patient:'302-B / 서명 대조',time:'02:38',cause:'의사 서명 대조',stamp:'원본 확인 필요',trace:'사망 시각과 서명 등록 시각이 다름',revision:'B 문서의 수정 이력 확인'},
   {id:'대조-03',patient:'302-C / 활력 대조',time:'03:06',cause:'사망 판정 원본 대조',stamp:'원본 확인 필요',trace:'판정 이후의 활력 기록이 존재함',revision:'C 문서의 수정 이력 확인'},
   {id:'대조-04',patient:'302-D / 도장 대조',time:'02:52',cause:'판정 도장 대조',stamp:'원본 확인 필요',trace:'원본의 판정란과 재발급본이 다름',revision:'D 문서의 수정 이력 확인'}
  ];
  const count=[2,4,8].includes(ch02RoomCapacity)?ch02RoomCapacity:2;
  const role=ch02RoomRoles.indexOf(ch02AssignedRole);
  if(role<0||role>=count){ch02Dialog('조사원 배정 확인','현재 방의 조사원 순서를 확인할 수 없습니다. 잠시 후 다시 조사해 주세요.');return;}
  const assigned=count===2?[records.slice(0,2),records.slice(2,4)][role]:count===4?[records[role]]:role<4?[records[role]]:[verification[role-4]];
  showCh02Certificate({role,capacity:count,records:assigned});
  if(socket?.readyState===NativeWS.OPEN)socket.send(JSON.stringify({type:'chapter',action:'ch02_new_inspect',site:'certificate'}));
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
   const rows=[['환자 성명',record.patient],['사망 일시','1988. 11. 26. '+record.time],['기재 사인',record.cause],['담당 의사','김  ○  ○'],['수정 흔적',record.revision||'판독 불가']];
   for(const [label,value] of rows){
    const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:88px 1fr;border-bottom:1px solid #9b8a734d;min-height:41px;align-items:center;gap:8px';
    const l=document.createElement('span');l.textContent=label;l.style.cssText='font-size:12px;color:#5d5040';
    const v=document.createElement('span');v.textContent=value;
    if(label==='담당 의사'||label==='환자 성명'){
     v.style.cssText='position:relative;isolation:isolate;min-height:32px;display:flex;align-items:center;filter:contrast(.83)';
     const blot=document.createElement('i');blot.setAttribute('aria-hidden','true');
     blot.style.cssText='position:absolute;z-index:2;left:12%;top:-7px;width:70%;height:44px;pointer-events:none;opacity:.92;background:radial-gradient(ellipse at 26% 50%,#454b3433 0 14%,#414b37aa 19%,transparent 48%),radial-gradient(ellipse at 60% 55%,#333c2cbb 0 7%,#52604799 14%,transparent 37%),radial-gradient(circle at 76% 20%,#303b2a99 0 5%,transparent 14%),radial-gradient(circle at 17% 83%,#343d2d99 0 4%,transparent 12%),radial-gradient(ellipse at 45% 45%,#706c5e9e,transparent 60%);filter:blur(2.7px) saturate(.65);transform:rotate(-8deg)';
     v.append(blot);
    }
    row.append(l,v);page.append(row);
   }
   const stamp=document.createElement('div');stamp.textContent=record.stamp;stamp.style.cssText='margin:12px 0 0 auto;width:max-content;padding:5px 12px;border:2px solid #833e3b;color:#833e3b;transform:rotate(-9deg);font-weight:bold;opacity:.8';
   const trace=document.createElement('p');trace.textContent='기록 대조 메모: '+record.trace;trace.style.cssText='margin:22px 0 0;padding:10px;border-top:1px dashed #85735e;font-size:13px';
   page.append(stamp,trace);paper.append(page);
  }
  const footer=document.createElement('p');footer.textContent='조사원 '+(Number(message.role)+1)+' / '+message.capacity+'인 조사실 · 서로 다른 조사원이 확인한 문서를 대조하십시오.';footer.style.cssText='font-size:12px;margin-top:18px';paper.append(footer);
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
  // Do not dismiss the success scene back to the legacy CH01 reception.
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
  document.getElementById('hmCh02NewDialog')?.remove();
  const wrap=document.createElement('div');wrap.id='hmCh02NewDialog';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');
  wrap.style.cssText='position:fixed;inset:0;z-index:999999;background:#050407f2;display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto';
  const card=document.createElement('section');card.style.cssText='width:min(520px,100%);max-height:92dvh;overflow:auto;border:1px solid #68535b;background:linear-gradient(155deg,#211b23,#0e0c12);color:#e9dfe0;padding:25px clamp(17px,4vw,30px) 27px;box-shadow:0 18px 65px #000;font:15px/1.8 serif';
  const back=document.createElement('button');back.type='button';back.textContent='← 병실로 돌아가기';back.style.cssText='border:0;background:transparent;color:#cbb7c1;font:13px system-ui;padding:4px 0 20px';back.onclick=()=>wrap.remove();card.append(back);
  const label=document.createElement('div');label.textContent='回明病院 / 302호 / 기록 정정';label.style.cssText='font:11px system-ui;letter-spacing:2px;color:#b49aa5;margin-bottom:16px';card.append(label);
  const title=document.createElement('h2');title.textContent='02. 사망 판정의 오류';title.style.cssText='font:600 clamp(22px,5vw,27px) serif;margin:0 0 17px';card.append(title);
  const rule=document.createElement('p');rule.textContent='죽은 자의 기록은 남아 있으나, 죽음의 증거는 남아 있지 않다.';rule.style.cssText='font-style:italic;border-top:1px solid #68535b;border-bottom:1px solid #68535b;padding:17px 0;color:#d7c4cb';card.append(rule);
  const guide=document.createElement('p');guide.textContent='네 장의 사망진단서와 마지막 심장 신호를 대조하라.\n\n사망 판정 이후에도 심장이 뛰었던 시간.\n\n가장 오래 살아 있었던 자부터, 인식표에 남겨진 네 글자를 입력하라.';guide.style.cssText='white-space:pre-line;line-height:1.9;margin:22px 0;color:#e4d9dc';card.append(guide);
  const cells=document.createElement('div');cells.style.cssText='display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:22px 0';
  const inputs=[];
  for(let i=0;i<4;i++){
   const input=document.createElement('input');input.type='text';input.maxLength=1;input.autocomplete='off';input.autocapitalize='characters';input.spellcheck=false;input.setAttribute('aria-label',(i+1)+'번째 영문 글자');
   input.style.cssText='width:100%;min-width:0;height:58px;box-sizing:border-box;text-align:center;font:600 26px monospace;text-transform:uppercase;border:1px solid #88717e;border-radius:5px;background:#09090b;color:#f4e9ef';
   input.addEventListener('input',()=>{input.value=input.value.replace(/[^a-z]/gi,'').toUpperCase().slice(-1);if(input.value&&i<3)inputs[i+1].focus();});
   input.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!input.value&&i>0)inputs[i-1].focus();if(e.key==='Enter')submit.click();});
   input.addEventListener('paste',e=>{const pasted=e.clipboardData?.getData('text')?.replace(/[^a-z]/gi,'').toUpperCase().slice(0,4)||'';if(pasted.length>1){e.preventDefault();for(let k=0;k<4;k++)inputs[k].value=pasted[k]||'';inputs[Math.min(pasted.length,4)-1].focus();}});
   inputs.push(input);cells.append(input);
  }
  card.append(cells);
  const status=document.createElement('p');status.id='hmCh02NewStatus';status.setAttribute('role','status');status.style.cssText='min-height:22px;color:#e4b3b3;font:13px system-ui';
  const submit=document.createElement('button');submit.type='button';submit.textContent='기록 정정';submit.style.cssText='width:100%;padding:15px;background:#573b4b;color:#fff;border:1px solid #a18091;border-radius:6px;font:600 16px system-ui';
  submit.onclick=()=>{const answer=inputs.map(x=>x.value).join('');if(answer.length!==4){status.textContent='인식표의 영문 네 글자를 모두 입력하세요.';return;}status.textContent='사망 판정 원본을 대조하고 있습니다…';ch02Send('ch02_new_solve',{answer});};
  card.append(status,submit);wrap.append(card);document.body.append(wrap);
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
 // One transparent CH02 interaction surface, anchored to the visible ward image.
 // Use direct pointer activation so a legacy click handler cannot swallow mobile taps.
 // CH02 uses one capture-phase pointer router below; no duplicate hit overlays.
 function mountCh02New(){
  document.getElementById('hmCh02NewLayer')?.remove();
  document.querySelectorAll('#hmWardScene .hm-ch02-new-target').forEach(el=>el.remove());
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
 // Single CH02 investigation path: pointer -> server -> existing document renderer.
 // Capture on window so legacy document handlers cannot swallow mobile touches.
 let ch02LastPointer=0;
 let ch02UnderbedVisited=false;
 // H01 media completion is not consistently forwarded by the original player.
 // Preserve the video on first inspection; revisiting the same object always opens the code form.
 document.addEventListener('ended',e=>{
  if(phase==='ch02'&&ch02UnderbedVisited&&e.target instanceof HTMLVideoElement)showCh02Answer();
 },true);
 window.addEventListener('pointerdown',e=>{
  if(!active||phase!=='ch02'||(e.pointerType==='mouse'&&e.button!==0))return;
  if(document.getElementById('hmCh02GroupIntro')||document.getElementById('hmCh02NewDialog')||document.getElementById('hmCh02ClearScene'))return;
  if(e.target instanceof Element&&e.target.closest('#hmV174Chat,#hmV174ChatFloating,.hmLaterStoryIntro,#hmMediaOverlay,input,textarea,nav'))return;
  const scene=document.getElementById('hmWardScene')||document.getElementById('mainScene');
  if(!scene)return;
  const rect=scene.getBoundingClientRect();
  if(rect.width<1||rect.height<1)return;
  const x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;
  if(x<0||x>1||y<0||y>1)return;
  let site=null;
  if(x>=.24&&x<=.77&&y>=.43&&y<=.70)site='certificate';
  else if(x>=.28&&x<=.80&&y>=.76&&y<=.93)site='underbed';
  else if(x>=.43&&x<=.82&&y>=.27&&y<=.40)site='ecg';
  else if(x<=.28&&y>=.70&&y<=.87)site='eight';
  if(!site||Date.now()-ch02LastPointer<500)return;
  ch02LastPointer=Date.now();
  e.preventDefault();e.stopImmediatePropagation();
  if(site==='underbed')ch02HandPending=true;
  if(site==='certificate'){
   openLocalCh02Certificate();
   return;
  }
  if(site==='ecg'||site==='eight'){
   openLocalCh02Clue(site);
   return;
  }
  if(site==='underbed'){
   if(ch02UnderbedVisited){showCh02Answer();return;}
   ch02UnderbedVisited=true;
   ch02Send('ch02_new_inspect',{site});
   return;
  }
  ch02Send('ch02_new_inspect',{site});
 },true);
 document.addEventListener('hm-v175-state',mountCh02New);
 document.addEventListener('hm-v175-started',mountCh02New);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountCh02New,{once:true});else mountCh02New();
 document.addEventListener('click',e=>{
  if(!active||phase!=='ch02')return;
  const el=e.target instanceof Element?e.target.closest('button,[role="button"],[data-action],[data-site]'):null;
  if(!el||el.closest('#hmCh02NewLayer,#hmCh02NewDialog,#hmV174Chat,#hmV174ChatFloating,.hm-ch02-new-target'))return;
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
 function openTeamChat(e){
  if(!active)return;
  if(e){e.preventDefault();e.stopImmediatePropagation();}
  let box=$('hmV174Chat');if(!box){
   box=document.createElement('section');box.id='hmV174Chat';box.setAttribute('role','dialog');box.setAttribute('aria-label','협동 대화');
   box.style.cssText='position:fixed;z-index:2147483400;inset:auto 12px calc(85px + env(safe-area-inset-bottom)) 12px;max-height:55vh;overflow:auto;background:#211729;color:#fff;border:1px solid #9178a3;border-radius:14px;padding:15px;box-shadow:0 10px 35px #000b';
   box.innerHTML='<strong>팀 대화</strong><button type="button" id="hmV174ChatClose" style="float:right">닫기 ×</button><div id="hmV174ChatLog" style="max-height:28vh;overflow:auto;margin:12px 0;white-space:pre-wrap"></div><div style="display:flex;gap:7px"><input id="hmV174ChatInput" maxlength="180" placeholder="팀원에게 메시지" style="flex:1;min-width:0;padding:10px;background:#120f18;color:white;border:1px solid #9178a3;border-radius:8px"><button id="hmV174ChatSend" type="button">전송</button></div>';
   document.body.append(box);
   $('hmV174ChatClose').onclick=()=>box.hidden=true;
   const send=()=>{const input=$('hmV174ChatInput');const value=input.value.trim();if(value&&socket?.readyState===NativeWS.OPEN){socket.send(JSON.stringify({type:'chat',message:value}));input.value='';}};
   $('hmV174ChatSend').onclick=send;$('hmV174ChatInput').onkeydown=e=>{if(e.key==='Enter')send();};
  }
  box.hidden=false;
 }
 if(chatButton)chatButton.addEventListener('click',openTeamChat,true);
 function mountTeamChatButton(){
  let b=$('hmV174ChatFloating');
  if(!b){b=document.createElement('button');b.id='hmV174ChatFloating';b.type='button';b.textContent='💬 팀 채팅';b.setAttribute('aria-label','팀원과 대화하기');b.style.cssText='position:fixed!important;right:12px!important;bottom:calc(20px + env(safe-area-inset-bottom))!important;z-index:2147483200!important;display:block;padding:12px 16px;border:1px solid #b39bc1;border-radius:24px;background:#25192ef2;color:#fff;font:700 14px system-ui;box-shadow:0 5px 18px #000b;touch-action:manipulation';b.addEventListener('click',openTeamChat);document.body.append(b);}
  b.hidden=!active;b.style.display=active?'block':'none';
 }
 document.addEventListener('hm-v175-state',mountTeamChatButton);
 document.addEventListener('hm-v175-started',mountTeamChatButton);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountTeamChatButton,{once:true});else mountTeamChatButton();
})();
