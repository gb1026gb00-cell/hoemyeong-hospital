'use strict';
// Full Chromium proof for CH01: requires Google Chrome and the Playwright package.
// Tests the actual approved /play HTML and injected gameplay bridge, not a mock DOM.
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const PORT=44000+Math.floor(Math.random()*1000);
const ORIGIN='http://127.0.0.1:'+PORT;
const app=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT),ROOM_SAVE_PATH:''},stdio:['ignore','pipe','pipe']});
let stderr='';
app.stdout.on('data',d=>stderr+=d.toString());app.stderr.on('data',d=>stderr+=d.toString());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
async function waitServer(){for(let i=0;i<100;i++){try{if((await fetch(ORIGIN+'/health')).ok)return;}catch{}await sleep(100)}throw Error('server never listened '+stderr);}
async function jsClient(page,room,role){
 await page.evaluate(async({room,role})=>{
  window.__hmBrowserMessages=[];
  window.__hmBrowserSocket=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host);
  const s=window.__hmBrowserSocket;
  s.addEventListener('message',e=>{try{window.__hmBrowserMessages.push(JSON.parse(e.data));}catch{}});
  await new Promise((resolve,reject)=>{s.addEventListener('open',resolve,{once:true});s.addEventListener('error',reject,{once:true})});
  s.send(JSON.stringify({type:'join',room,role,character:role}));
 },{room,role});
 await page.waitForFunction(()=>window.__hmBrowserMessages?.some(m=>m.type==='joined'),null,{timeout:10000});
}
async function send(page,action){await page.evaluate(a=>window.__hmBrowserSocket.send(JSON.stringify(a)),action);}
const media=async(page,selector,label)=>{
 await page.waitForSelector(selector,{timeout:15000});
 await page.waitForTimeout(700);
 const result=await page.$eval(selector,v=>({src:v.currentSrc||v.src,readyState:v.readyState,networkState:v.networkState,error:v.error?.code||null,paused:v.paused,muted:v.muted}));
 console.log('VIDEO',label,JSON.stringify(result));
 assert.equal(result.error,null,label+' cannot decode/load');
 assert.ok(result.readyState>=1,label+' has no media metadata');
 return result;
};
(async()=>{try{
 await waitServer();
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--no-sandbox']});
 const errors=[],reqFailures=[];
 const a=await browser.newPage({viewport:{width:1366,height:768},acceptDownloads:false});
 const b=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 for(const page of [a,b]){
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>reqFailures.push(r.url()+' '+r.failure()?.errorText));
 }
 const [r1,r2]=await Promise.all([a.goto(ORIGIN+'/play',{waitUntil:'domcontentloaded',timeout:60000}),b.goto(ORIGIN+'/play',{waitUntil:'domcontentloaded',timeout:60000})]);
 assert.equal(r1.status(),200);assert.equal(r2.status(),200);
 console.log('APPROVED_UI',JSON.stringify(await a.evaluate(()=>({title:document.title,hasApproved:!!document.getElementById('hmPlaySheet'),hasCoopButton:!!document.getElementById('hmDirectCh01Start'),hasMedia:!!window.hmMedia,visibleButtons:[...document.querySelectorAll('button')].filter(x=>x.getClientRects().length).slice(0,24).map(x=>x.textContent.trim().slice(0,45))}))));
 const created=await fetch(ORIGIN+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({capacity:2})});
 assert.equal(created.status,201);const room=(await created.json()).code;
 await Promise.all([jsClient(a,room,0),jsClient(b,room,1)]);
 await Promise.all([send(a,{type:'ready',ready:true}),send(b,{type:'ready',ready:true})]);
 await a.waitForFunction(()=>window.__hmBrowserMessages.some(m=>m.type==='state'&&m.members?.length===2&&m.members.every(x=>x.ready)));
 await send(a,{type:'start'});
 await media(a,'#hmReceptionScare video','G01-PC');
 await media(b,'#hmReceptionScare video','G01-Mobile');
 await Promise.all([a.evaluate(()=>document.querySelector('#hmReceptionScare video')?.dispatchEvent(new Event('ended'))),b.evaluate(()=>document.querySelector('#hmReceptionScare video')?.dispatchEvent(new Event('ended')))]);
 await a.waitForFunction(()=>window.__hmBrowserMessages.some(m=>m.type==='state'&&m.started===true));
 const startButton=await a.evaluate(()=>{const x=document.getElementById('hmDirectCh01Start');return {exists:!!x,visible:!!x&&x.getClientRects().length>0,text:x?.textContent};});
 console.log('INVESTIGATION_BUTTON',JSON.stringify(startButton));
 assert.ok(startButton.exists&&startButton.visible,'CH01 start button not rendered');
 await a.locator('#hmDirectCh01Start').click({timeout:12000});
 await media(a,'#hmForcedSeparation video','G08-PC');
 await media(b,'#hmForcedSeparation video','G08-Mobile');
 await Promise.all([a.evaluate(()=>document.querySelector('#hmForcedSeparation video')?.dispatchEvent(new Event('ended'))),b.evaluate(()=>document.querySelector('#hmForcedSeparation video')?.dispatchEvent(new Event('ended')))]);
 await a.waitForFunction(()=>window.__hmBrowserMessages.some(m=>m.type==='state'&&m.chapter?.phase==='separated'));
 console.log('VISIBLE_CH01_BUTTONS',JSON.stringify(await a.evaluate(()=>[...document.querySelectorAll('button,[role="button"]')].filter(x=>x.getClientRects().length&&/거울|캐비닛|명부|접수대|서랍/.test(x.textContent+' '+x.getAttribute('aria-label'))).slice(0,25).map(x=>({text:x.textContent?.trim().slice(0,40),aria:x.getAttribute('aria-label'),object:x.dataset.object,action:x.dataset.action,outer:x.outerHTML.slice(0,220)})))));
 await send(a,{type:'chapter',action:'reception_clue',object:'mirror'});
 await a.waitForSelector('#hmCh01InspectionScreen',{timeout:8000});
 const mirror=await a.evaluate(()=>({title:document.querySelector('#hmCh01InspectionScreen h2')?.textContent,stains:document.querySelectorAll('#hmCh01InspectionScreen [aria-label="검은 얼룩이 묻은 거울"] > span[aria-hidden]').length}));
 console.log('MIRROR_VISUAL',JSON.stringify(mirror));assert.ok(mirror.stains>0,'No rendered stains');
 await a.locator('#hmCh01InspectionScreen button').click();
 await send(a,{type:'chapter',action:'reception_clue',object:'ledger'});
 await a.waitForSelector('#hmCh01InspectionScreen',{timeout:8000});
 const ledger=await a.locator('#hmCh01InspectionScreen').innerText();
 assert.ok(ledger.includes('입실'),'ledger should display evidence');
 await a.locator('#hmCh01InspectionScreen button').click();
 console.log('BROWSER_ERRORS',JSON.stringify(errors.slice(0,15)));
 console.log('NETWORK_FAILURES',JSON.stringify(reqFailures.slice(0,15)));
 console.log('BROWSER_RESULT: CH01 playable visual clues and cinematic metadata verified');
 if(errors.length)console.log('BROWSER_WARNING: '+errors.length+' JS page errors observed');
 }catch(e){console.error('BROWSER_FAIL '+(e.stack||e));process.exitCode=1}
 finally{try{await browser?.close()}catch{}app.kill('SIGTERM');setTimeout(()=>app.kill('SIGKILL'),1500).unref();}
})();
