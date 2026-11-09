// Dependency-free release gate. Run: node test_release_readiness_v175.js
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),server=fs.readFileSync('server.js','utf8');
const failures=[];
const check=(name,ok)=>{console.log((ok?'PASS':'FAIL')+' '+name);if(!ok)failures.push(name)};
check('CH01 image is deployed',fs.existsSync('reception.webp'));
check('approved intro video is deployed',fs.existsSync('assets/approved_asset_01.mp4'));
check('approved CH01 scene is deployed',fs.existsSync('assets/approved_asset_02.webp'));
check('mobile co-op lobby exists',html.includes('id="hmCoopPanel"'));
check('server handles room join',server.includes("m.type==='join'"));
check('server handles ready/start',server.includes("m.type==='ready'")&&server.includes("m.type==='start'"));
check('server handles chapter events',server.includes("m.type==='chapter'"));
check('server retains artifact collection',server.includes('artifactFragments'));
check('server retains doll collection',server.includes('dollComplete'));
check('CH01 telephone inactive',!html.includes('data-action="intercom"'));
if(failures.length){console.error('\nNOT READY: '+failures.join('; '));process.exitCode=1}else console.log('\nSTRUCTURAL PRECHECK PASS; real two-phone browser test still required');
