const http=require('http');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT||3000),rooms=new Map();
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({service:'Hoemyeong Hospital multiplayer v5.25',status:'ok',rooms:rooms.size}));});
const wss=new WebSocketServer({server,maxPayload:4096});
const send=(ws,o)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(o))};
const validRoom=x=>typeof x==='string'&&/^[A-Z0-9_-]{1,12}$/.test(x);
const members=r=>[...r.clients].map(c=>({role:c.role,character:c.character,ready:c.ready,host:c===r.host})).sort((a,b)=>a.role-b.role);
const state=r=>({type:'state',roles:members(r).map(x=>x.role),members:members(r),pieces:[...r.pieces].sort(),started:r.started,chat:r.chat.slice(-25)});
function broadcast(r,o){for(const c of r.clients)send(c.ws,o)}
function leave(c){if(!c.room)return;const r=rooms.get(c.room);c.room=null;if(!r)return;r.clients.delete(c);if(r.host===c)r.host=[...r.clients][0]||null;if(!r.clients.size)rooms.delete(r.code);else broadcast(r,state(r))}
wss.on('connection',ws=>{
 const c={ws,room:null,role:null,character:null,ready:false};let count=0,windowStart=Date.now();
 ws.on('message',raw=>{
  if(Date.now()-windowStart>10000){windowStart=Date.now();count=0}if(++count>50)return send(ws,{type:'error',message:'요청이 너무 많습니다.'});
  let m;try{m=JSON.parse(raw.toString())}catch{return}if(!m||typeof m.type!=='string')return;
  if(m.type==='join'){
   if(c.room)return send(ws,{type:'error',message:'이미 입장했습니다.'});
   if(!validRoom(m.room)||!Number.isInteger(m.role)||m.role<0||m.role>7)return send(ws,{type:'error',message:'방 코드 또는 역할 오류'});
   const character=Number.isInteger(m.character)?m.character:m.role;
   if(character<0||character>7)return send(ws,{type:'error',message:'캐릭터 선택 오류'});
   let r=rooms.get(m.room);if(!r){r={code:m.room,clients:new Set(),pieces:new Set(),chat:[],host:null,started:false};rooms.set(m.room,r)}
   if(r.started)return send(ws,{type:'error',message:'이미 시작한 방입니다. 현재 버전은 진행 중 합류를 지원하지 않습니다.'});
   if(r.clients.size>=8||[...r.clients].some(x=>x.role===m.role||x.character===character))return send(ws,{type:'error',message:'이미 선택된 캐릭터/역할이거나 방이 가득 찼습니다.'});
   c.room=m.room;c.role=m.role;c.character=character;c.ready=false;r.clients.add(c);if(!r.host)r.host=c;
   send(ws,{type:'joined',...state(r)});broadcast(r,state(r));return;
  }
  if(!c.room)return;const r=rooms.get(c.room);if(!r)return;
  if(m.type==='sync')return send(ws,state(r));
  if(m.type==='ready'){if(r.started)return;c.ready=!!m.ready;broadcast(r,state(r));return}
  if(m.type==='start'){if(r.host!==c)return send(ws,{type:'error',message:'방장만 시작할 수 있습니다.'});if(r.clients.size<2)return send(ws,{type:'error',message:'최소 2명이 필요합니다.'});if([...r.clients].some(x=>!x.ready))return send(ws,{type:'error',message:'모든 조사원이 준비해야 합니다.'});r.started=true;broadcast(r,{type:'started'});broadcast(r,state(r));return}
  if(m.type==='chat'){if(typeof m.message!=='string')return;const msg=m.message.trim().slice(0,180);if(!msg)return;const item={role:c.role,character:c.character,message:msg};r.chat.push(item);r.chat=r.chat.slice(-25);broadcast(r,{type:'chat',item});return}
  if(m.type==='clue'){if(typeof m.clue!=='string')return;broadcast(r,{type:'clue',role:c.role,clue:m.clue.slice(0,160)});return}
  if(m.type==='piece'){if(!Number.isInteger(m.piece)||m.piece<0||m.piece>3)return;r.pieces.add(m.piece);broadcast(r,{type:'piece',pieces:[...r.pieces].sort()});return}
 });ws.on('close',()=>leave(c));ws.on('error',()=>leave(c));
});
server.listen(PORT,'0.0.0.0',()=>console.log('Hoemyeong multiplayer v5.25 listening on '+PORT));
