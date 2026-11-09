const fs=require('fs'),path=require('path'),vm=require('vm');
const root=__dirname,html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const checks=[];
function test(name,pass,detail=''){checks.push({name,pass:!!pass,detail});}
const scriptBlocks=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
for(let i=0;i<scriptBlocks.length;i++){
 const [whole,attrs,code]=scriptBlocks[i];
 if(/\bsrc\s*=/.test(attrs)||!code.trim())continue;
 try{new vm.Script(code,{filename:'index.html script '+(i+1)});test('inline JS '+(i+1),true)}
 catch(e){test('inline JS '+(i+1),false,e.message)}
}
for(const f of ['server.js','room_storage.js'])try{new vm.Script(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});test(f+' parse',true)}catch(e){test(f+' parse',false,e.message)}
for(const id of ['hmPlaySheet','hmFinal06','hmFinalScene','hmArchiveScene','hmIsolation05','hmElevator03','hmWard02']){
 test('UI '+id,html.includes(id));
}
for(let i=1;i<=6;i++)test('voice CH'+i,fs.existsSync(path.join(root,'voice_ch'+String(i).padStart(2,'0')+'.mp3')));
for(let i=1;i<=18;i++)test('G'+String(i).padStart(2,'0')+' video file',fs.existsSync(path.join(root,'G'+String(i).padStart(2,'0')+'.mp4')));
for(const id of ['H01','H03','H04'])test(id+' video file',fs.existsSync(path.join(root,id+'.mp4')));
test('chapter scene handlers',Array.from({length:6},(_,i)=>html.includes('CH.'+String(i+1).padStart(2,'0'))).every(Boolean));
test('role-dependent server logic',fs.readFileSync(path.join(root,'server.js'),'utf8').includes('clueOwners'));
test('persistent storage requires ROOM_SAVE_PATH',fs.readFileSync(path.join(root,'server.js'),'utf8').includes('ROOM_SAVE_PATH'));
const result={version:'V158',passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,checks};
fs.writeFileSync(path.join(root,'V158_CHECK_RESULTS.json'),JSON.stringify(result,null,2));
console.log('V158 PREFLIGHT '+result.passed+' passed, '+result.failed+' failed');
for(const x of checks.filter(x=>!x.pass))console.log('MISSING/FAIL:',x.name,x.detail);
process.exitCode=checks.some(x=>!x.pass)?1:0;
