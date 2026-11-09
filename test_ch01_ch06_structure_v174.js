// CH01–CH06 server-side progression and preservation smoke checks.
// Run with: node test_ch01_ch06_structure_v174.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const checks=[
 ['room ready/start',/m\.type==='ready'[\s\S]*m\.type==='start'/.test(server)],
 ['chapter actions',/m\.type==='chapter'/.test(server)],
 ['server-authoritative chapter state',/chapter:publicChapter\(r\.chapter\)/.test(server)],
 ['CH02 state',/ch02:ch\.ch02/.test(server)],
 ['CH03 state',/ch03:ch\.ch03/.test(server)],
 ['CH04 state',/ch04:ch\.ch04/.test(server)],
 ['CH05 state',/ch05:ch\.ch05/.test(server)],
 ['CH06 state',/ch06:ch\.ch06/.test(server)],
 ['artifact collection state',/artifactFragments/.test(server)],
 ['doll pieces state',/dollComplete/.test(server)],
 ['mobile shared phase',/currentPhase/.test(html)],
 ['CH01 phone not clickable',!/data-action="intercom"/.test(html)]
];
for(const [label,ok] of checks){console.log((ok?'PASS':'FAIL')+' '+label);assert.ok(ok,label)}
console.log('PASS '+checks.length+' structure checks; NOT an end-to-end multiplayer test');
