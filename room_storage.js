'use strict';
const fs=require('fs');const path=require('path');
const TTL=7*24*60*60*1000;
function snapshot(rooms,now=Date.now()){
 return [...rooms.values()].filter(r=>r.started).map(r=>({code:r.code,capacity:r.capacity,devSolo:!!r.devSolo,started:true,savedAt:now,lastActiveAt:r.lastActiveAt||now,hostToken:r.host?.token||null,clients:[...r.clients].map(c=>({role:c.role,character:c.character,ready:c.ready,token:c.token})),senseRoles:r.senseRoles||[],pieces:[...r.pieces],artifactFragments:[...(r.artifactFragments||[])],chat:r.chat,chapter:r.chapter}));
}
function validDocument(file){const parsed=JSON.parse(fs.readFileSync(file,'utf8'));if(parsed.format!==1||!Array.isArray(parsed.rooms))throw Error('Unsupported room storage format');return parsed}
function save(file,rooms){
 if(!file)return;const dir=path.dirname(file);fs.mkdirSync(dir,{recursive:true});
 const tmp=file+'.'+process.pid+'.tmp',backup=file+'.bak';
 try{
  fs.writeFileSync(tmp,JSON.stringify({format:1,rooms:snapshot(rooms)}),{mode:0o600});
  // Never replace a known-good backup with corrupt primary data.
  if(fs.existsSync(file)){
   try{validDocument(file);fs.copyFileSync(file,backup);fs.chmodSync(backup,0o600)}catch(e){console.error('Skipping invalid primary backup:',e.message)}
  }
  fs.renameSync(tmp,file);
 }finally{try{fs.unlinkSync(tmp)}catch(e){if(e.code!=='ENOENT')throw e}}
}
function restore(file,now=Date.now()){
 const out=new Map();if(!file)return out;
 let parsed;
 if(fs.existsSync(file)){
  try{parsed=validDocument(file)}catch(e){console.error('Primary room save invalid:',e.message)}
 }
 if(!parsed&&fs.existsSync(file+'.bak')){
  try{parsed=validDocument(file+'.bak');console.error('Recovered rooms from backup snapshot')}catch(e){console.error('Backup room save invalid:',e.message)}
 }
 if(!parsed){if(fs.existsSync(file)||fs.existsSync(file+'.bak'))throw Error('No valid room save or backup');return out}
 for(const r of parsed.rooms){if(!r||!r.started||typeof r.code!=='string'||!/^[A-Z0-9_-]{1,12}$/.test(r.code)||!Number.isFinite(r.savedAt)||now-(Number.isFinite(r.lastActiveAt)?r.lastActiveAt:r.savedAt)>TTL||(Number.isFinite(r.lastActiveAt)?r.lastActiveAt:r.savedAt)>now+60000)continue;
 if(!(Number.isInteger(r.capacity)&&(r.devSolo===true?r.capacity===1:r.capacity>=2&&r.capacity<=8))||!Array.isArray(r.clients)||r.clients.length!==r.capacity||!r.chapter||typeof r.chapter!=='object'||Array.isArray(r.chapter))continue;
 if(out.has(r.code))continue; // Never let duplicate room codes overwrite an earlier restored room.
 if(!Array.isArray(r.pieces)||!Array.isArray(r.artifactFragments)||!Array.isArray(r.chat)||!Array.isArray(r.senseRoles))continue;
 if(r.pieces.some(x=>!Number.isInteger(x)||x<0||x>3)||r.artifactFragments.some(x=>!(typeof x==='string'&&x.length<=40)&&!(Number.isInteger(x)&&x>=0&&x<=4)))continue;
 if(r.chat.length>100||r.chat.some(x=>typeof x!=='object'||x===null))continue;
 const clients=new Set(r.clients.map(c=>({role:c.role,character:c.character,ready:!!c.ready,token:c.token,ws:null,room:r.code,offlineAt:now})));
 if([...clients].some(c=>!Number.isInteger(c.role)||c.role<0||c.role>7||!(typeof c.character==='string'&&c.character.length>0)&&!Number.isInteger(c.character)||typeof c.token!=='string'||c.token.length<24))continue;
 const restored=[...clients];
 if(new Set(restored.map(c=>c.role)).size!==restored.length||new Set(restored.map(c=>c.token)).size!==restored.length||new Set(restored.map(c=>c.character)).size!==restored.length)continue;
 const room={code:r.code,capacity:r.capacity,devSolo:!!r.devSolo,started:true,lastActiveAt:Number.isFinite(r.lastActiveAt)?r.lastActiveAt:r.savedAt,clients,pieces:new Set(r.pieces||[]),artifactFragments:new Set(r.artifactFragments||[]),chat:r.chat||[],senseRoles:r.senseRoles||[],chapter:r.chapter,host:[...clients].find(c=>c.token===r.hostToken)||[...clients][0]};
 if(room.chapter.ch02?.switches)room.chapter.ch02.switches=[];
 if(room.chapter.ch04?.votes)room.chapter.ch04.votes=[];
 if(room.chapter.ch06?.switches)room.chapter.ch06.switches=[];
 out.set(room.code,room);
 }
 return out;
}
module.exports={snapshot,save,restore,TTL};
