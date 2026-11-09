// Regression guard for the lightweight mobile multiplayer shell.
// Run: node test_mobile_coop_shell.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'index.html'),'utf8');
const server=fs.readFileSync(require('node:path').join(__dirname,'server.js'),'utf8');
for(const id of ['hmCoopPanel','hmEndpoint','hmRoom','hmCapacity','hmCharacter','hmJoin','hmReady','hmStart','hmCoopStatus','hmCoopMembers','sceneTitle','line']){
 assert.match(html,new RegExp('id=["\\\']'+id+'["\\\']'),'Missing UI element: '+id);
}
assert.match(html,/data\.type === 'joined' \|\| data\.type === 'state'/,'Server state handler missing');
assert.match(html,/data\.chapter\.phase/,'Server chapter phase not displayed');
assert.match(html,/currentPhase !== 'reception'/,'Chapter action phase guard missing');
assert.doesNotMatch(html,/data-action="intercom"/,'CH01 phone must not be an interactive hotspot');
assert.match(server,/m\.type==='ready'/,'Server ready handler missing');
assert.match(server,/m\.type==='start'/,'Server start handler missing');
assert.match(server,/m\.type==='chapter'/,'Server chapter handler missing');
assert.match(server,/artifactFragments/,'Artifact fragment state missing');
console.log('PASS mobile co-op shell static regression guards');
