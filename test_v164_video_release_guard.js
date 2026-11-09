const fs=require('fs'),path=require('path'),vm=require('vm');
const root=__dirname,server=fs.readFileSync(path.join(root,'server.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const required=[...Array.from({length:18},(_,i)=>'G'+String(i+1).padStart(2,'0')),'H01','H03','H04'];
let failed=0;
for(const id of required){const file=path.join(root,id+'.mp4');const good=fs.existsSync(file)&&fs.statSync(file).size>1000;if(!good){failed++;console.error('FAIL asset',id)}}
for(const id of ['G13','G14','G15','G16','G17','G18','H01','H03','H04']){
 if(!server.includes("id:'"+id+"'")){failed++;console.error('FAIL server mapping',id)}
}
for(const token of ["hm:horror-inspect","HMCanvasHorror?.enqueue","hmHorrorCanvas","hm-horror-site"]){
 if(!html.includes(token)){failed++;console.error('FAIL client bridge',token)}
}
try{new vm.Script(server,{filename:'server.js'})}catch(e){failed++;console.error('FAIL server syntax',e.message)}
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
for(let i=0;i<scripts.length;i++){if(/\bsrc\s*=/.test(scripts[i][1]))continue;try{new vm.Script(scripts[i][2],{filename:'inline-'+i})}catch(e){failed++;console.error('FAIL inline',i,e.message)}}
console.log(failed?'Release guard FAILED '+failed:'Release guard PASS: 21 videos, 9 new server triggers, Canvas client bridge and JS syntax');
process.exitCode=failed?1:0;
