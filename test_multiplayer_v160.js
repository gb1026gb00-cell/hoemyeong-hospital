// V160: real two-client WebSocket smoke test. Run `npm install && node test_multiplayer_v160.js`.
'use strict';
const {spawn}=require('child_process');
const assert=require('assert/strict');
const fs=require('fs');
const PORT=39000+Math.floor(Math.random()*1000);
const server=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT),ROOM_SAVE_PATH:''},stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
const clients=[];const checks=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function client(){const c={ws:null,messages:[]};clients.push(c);return c;}
async function wait(c,pred,timeout=5000){const start=Date.now();while(Date.now()-start<timeout){const i=c.messages.findIndex(pred);if(i>=0)return c.messages.splice(i,1)[0];await sleep(25)}throw Error('Timed out: '+JSON.stringify(c.messages.slice(-5)))}
async function connect(c){c.ws=new WebSocket('ws://127.0.0.1:'+PORT);c.ws.addEventListener('message',e=>{try{c.messages.push(JSON.parse(e.data))}catch{}});await new Promise((resolve,reject)=>{c.ws.addEventListener('open',resolve,{once:true});c.ws.addEventListener('error',reject,{once:true})})}
function send(c,o){c.ws.send(JSON.stringify(o))}
async function check(label,fn){await fn();checks.push(label);console.log('PASS',label)}
(async()=>{try{
 await check('HTTP server starts',async()=>{for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('Server exited '+serverLog);try{const r=await fetch('http://127.0.0.1:'+PORT);if(r.ok){assert.equal((await r.json()).status,'ok');return}}catch{}await sleep(50)}throw Error('Server not listening '+serverLog)});
 const a=client(),b=client();await connect(a);await connect(b);const created=await fetch('http://127.0.0.1:'+PORT+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({capacity:2})});assert.equal(created.status,200);const room=(await created.json()).code;assert.match(room,/^[0-9]{4,12}$/);let token;
 await check('two investigators join separate roles',async()=>{send(a,{type:'join',room,role:0,character:0,capacity:2});const x=await wait(a,m=>m.type==='joined');token=x.token;assert.equal(x.yourRole,0);send(b,{type:'join',room,role:1,character:1});assert.equal((await wait(b,m=>m.type==='joined')).yourRole,1)});
 await check('two investigators ready and host starts',async()=>{send(a,{type:'ready',ready:true});send(b,{type:'ready',ready:true});await wait(a,m=>m.type==='state'&&m.members?.length===2&&m.members.every(x=>x.ready));send(a,{type:'start'});await wait(a,m=>m.type==='state'&&m.started===true);await wait(b,m=>m.type==='state'&&m.started===true)});
 await check('shared chat reaches both investigators',async()=>{send(a,{type:'chat',message:'V160 협동 테스트'});await wait(b,m=>m.type==='chat'||(m.type==='state'&&m.chat?.some(x=>JSON.stringify(x).includes('V160 협동 테스트'))))});
 await check('one disconnected investigator pauses cooperation',async()=>{
   a.ws.close();
   const paused=await wait(b,m=>m.type==='state'&&m.cooperationPaused===true);
   assert.equal(paused.members.filter(x=>x.online!==false).length,1);
   await wait(b,m=>m.type==='sense_assignment'&&Array.isArray(m.senses)&&m.senses.length===0);
   send(b,{type:'chapter',action:'inspect',object:'desk'});
   const denied=await wait(b,m=>m.type==='error'&&m.message?.includes('최소 2명'));
   assert.ok(denied.message);
 });
 await check('reconnect restores assigned role and cooperation',async()=>{
   const c=client();await connect(c);send(c,{type:'join',room,role:0,character:0,token});
   const x=await wait(c,m=>m.type==='joined');assert.equal(x.resumed,true);assert.equal(x.yourRole,0);
   const resumed=await wait(b,m=>m.type==='state'&&m.cooperationPaused===false);
   assert.equal(resumed.members.filter(x=>x.online!==false).length,2);
   const reassigned=await wait(b,m=>m.type==='sense_assignment'&&m.senses?.length>0);
   assert.ok(reassigned.senses.length>0);
 });
 await check('four-player room reassigns senses after one disconnect and reconnect',async()=>{
   const team=[client(),client(),client(),client()];
   for(const c of team)await connect(c);
   const room4='V160FOUR';
   const tokens=[];
   for(let i=0;i<4;i++){
     send(team[i],{type:'join',room:room4,role:i,character:i,capacity:4});
     const joined=await wait(team[i],m=>m.type==='joined');
     tokens.push(joined.token);
   }
   for(const c of team)send(c,{type:'ready',ready:true});
   await wait(team[0],m=>m.type==='state'&&m.members?.length===4&&m.members.every(x=>x.ready));
   send(team[0],{type:'start'});
   await wait(team[0],m=>m.type==='state'&&m.started===true);
   team[0].messages.length=0; // Discard startup assignments before measuring post-disconnect redistribution.
   team[3].ws.close();
   const reduced=await wait(team[0],m=>m.type==='state'&&m.started&&m.members?.filter(x=>x.online!==false).length===3);
   assert.equal(reduced.cooperationPaused,false);
   const senses3=await wait(team[0],m=>m.type==='sense_assignment'&&m.senses?.length>=2);
   assert.ok(senses3.senses.length>=2);
   team[0].messages.length=0; // Only compare assignments emitted after the reconnect.
   const back=client();await connect(back);
   send(back,{type:'join',room:room4,role:3,character:3,token:tokens[3]});
   assert.equal((await wait(back,m=>m.type==='joined')).resumed,true);
   const restored=await wait(team[0],m=>m.type==='state'&&m.members?.filter(x=>x.online!==false).length===4);
   assert.equal(restored.cooperationPaused,false);
   const senses4=await wait(team[0],m=>m.type==='sense_assignment'&&m.senses?.length>0);
   assert.ok(senses4.senses.length<senses3.senses.length);
 });
 console.log('RESULT',checks.length,'passed');fs.writeFileSync(__dirname+'/V160_RUNTIME_RESULT.json',JSON.stringify({status:'passed',checks},null,2));
 }catch(e){console.error('FAIL',e.stack);fs.writeFileSync(__dirname+'/V160_RUNTIME_RESULT.json',JSON.stringify({status:'failed',checks,error:String(e)},null,2));process.exitCode=1}
 finally{for(const c of clients)try{c.ws?.close()}catch{}server.kill('SIGTERM');setTimeout(()=>server.kill('SIGKILL'),500).unref()}
})();
