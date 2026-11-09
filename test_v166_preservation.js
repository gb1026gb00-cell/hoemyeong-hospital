const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const server=fs.readFileSync('server.js','utf8');
const tests={
 'V165 object bridge preserved':html.includes('id="hm-v165-object-horror"')&&html.includes('HMObjectHorrorBindings'),
 'Canvas scene preserved':/canvas/i.test(html),
 'No new zoom button added':!html.includes('hm-v166-zoom'),
 '2–8 multiplayer capacity present':/capacity|roomSize|maxPlayers/i.test(server),
 'Artifact mechanic retained':/artifact/i.test(html)&&/artifact/i.test(server),
 'Doll mechanic retained':/doll/i.test(html)&&/doll/i.test(server),
 'V149 voice assets present':Array.from({length:6},(_,i)=>fs.existsSync(`voice_ch0${i+1}.mp3`)).every(Boolean),
 'G01–G18 assets present':Array.from({length:18},(_,i)=>fs.existsSync(`G${String(i+1).padStart(2,'0')}.mp4`)).every(Boolean),
 'H01 H03 H04 assets present':['H01','H03','H04'].every(x=>fs.existsSync(x+'.mp4')),
 'Existing multiplayer test present':fs.existsSync('test_multiplayer_v160.js'),
};
for(const [name,ok] of Object.entries(tests))console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(Object.values(tests).some(x=>!x))process.exitCode=1;
