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
 const a=client(),b=client();await connect(a);await connect(b);const room='V160TEST';let token;
 await check('two investigators join separate roles',async()=>{send(a,{type:'join',room,role:0,character:0,capacity:2});const x=await wait(a,m=>m.type==='joined');token=x.token;assert.equal(x.yourRole,0);send(b,{type:'join',room,role:1,character:1});assert.equal((await wait(b,m=>m.type==='joined')).yourRole,1)});
 await check('two investigators ready and host starts',async()=>{send(a,{type:'ready',ready:true});send(b,{type:'ready',ready:true});await wait(a,m=>m.type==='state'&&m.members?.length===2&&m.members.every(x=>x.ready));send(a,{type:'start'});await wait(a,m=>m.type==='state'&&m.started===true);await wait(b,m=>m.type==='state'&&m.started===true)});
 await check('shared chat reaches both investigators',async()=>{send(a,{type:'chat',text:'V160 협동 테스트'});await wait(b,m=>m.type==='chat'||(m.type==='state'&&m.chat?.some(x=>JSON.stringify(x).includes('V160 협동 테스트'))))});
 await check('reconnect requires original token',async()=>{a.ws.close();await sleep(200);const c=client();await connect(c);send(c,{type:'join',room,role:0,character:0,token});const x=await wait(c,m=>m.type==='joined');assert.equal(x.resumed,true);assert.equal(x.yourRole,0)});
 console.log('RESULT',checks.length,'passed');fs.writeFileSync(__dirname+'/V160_RUNTIME_RESULT.json',JSON.stringify({status:'passed',checks},null,2));
 }catch(e){console.error('FAIL',e.stack);fs.writeFileSync(__dirname+'/V160_RUNTIME_RESULT.json',JSON.stringify({status:'failed',checks,error:String(e)},null,2));process.exitCode=1}
 finally{for(const c of clients)try{c.ws?.close()}catch{}server.kill('SIGTERM');setTimeout(()=>server.kill('SIGKILL'),500).unref()}
})();
