const http=require('http');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT||3000);
const rooms=new Map();
const server=http.createServer((req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({service:'Hoemyeong Hospital co-op prototype',status:'ok',rooms:rooms.size}));});
const wss=new WebSocketServer({server,maxPayload:2048});
const send=(ws,obj)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj))};
const validRoom=x=>typeof x==='string'&&/^[A-Z0-9_-]{1,12}$/.test(x);
function state(room){const r=rooms.get(room);return {type:'state',roles:[...r.clients].map(c=>c.role),pieces:[...r.pieces].sort()}}
function broadcast(room,obj){const r=rooms.get(room);if(r)for(const c of r.clients)send(c.ws,obj)}
function exit(c){if(!c.room)return;const name=c.room;const r=rooms.get(name);c.room=null;if(!r)return;r.clients.delete(c);if(r.clients.size===0)rooms.delete(name);else broadcast(name,state(name))}
wss.on('connection',ws=>{
 const c={ws,room:null,role:null};let count=0,last=Date.now();
 ws.on('message',raw=>{
  if(Date.now()-last>10000){last=Date.now();count=0}if(++count>35){send(ws,{type:'error',message:'요청이 너무 많습니다.'});return}
  let m;try{m=JSON.parse(raw.toString())}catch{return}if(!m||typeof m.type!=='string')return;
  if(m.type==='join'){
   if(c.room){send(ws,{type:'error',message:'이미 방에 입장했습니다.'});return}
   if(!validRoom(m.room)||!Number.isInteger(m.role)||m.role<0||m.role>7){send(ws,{type:'error',message:'방 코드 또는 조사원이 올바르지 않습니다.'});return}
   let r=rooms.get(m.room);if(!r){r={clients:new Set(),pieces:new Set()};rooms.set(m.room,r)}
   if(r.clients.size>=8||[...r.clients].some(x=>x.role===m.role)){send(ws,{type:'error',message:'방이 가득 찼거나 해당 조사원이 이미 입장했습니다.'});return}
   c.room=m.room;c.role=m.role;r.clients.add(c);send(ws,{...state(c.room),type:'joined'});broadcast(c.room,state(c.room));return;
  }
  if(!c.room)return;
  if(m.type==='sync'){send(ws,state(c.room));return}
  if(m.type==='clue'){if(typeof m.clue!=='string'||m.clue.length>160)return;broadcast(c.room,{type:'clue',role:c.role,clue:m.clue});return}
  if(m.type==='piece'){if(!Number.isInteger(m.piece)||m.piece<0||m.piece>3)return;rooms.get(c.room).pieces.add(m.piece);broadcast(c.room,{type:'piece',pieces:[...rooms.get(c.room).pieces].sort()})}
 });
 ws.on('close',()=>exit(c));ws.on('error',()=>exit(c));
});
server.listen(PORT,'0.0.0.0',()=>console.log('Co-op server listening on '+PORT));
