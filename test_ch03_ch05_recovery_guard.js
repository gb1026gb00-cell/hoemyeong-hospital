'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const server = fs.readFileSync('server.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const mobile = fs.readFileSync('coop_v174_mobile_fix.js', 'utf8');
const checks = [
  ['CH03 server submit', server.includes("m.action==='ch03_submit'")],
  ['CH03 input and submit', index.includes('id="ch03Answer"') && index.includes('data-ch03="ch03_submit"')],
  ['CH03 floating chat moved above answer', mobile.includes("id='hmV174ChatFloating'") && mobile.includes('top:70px!important;bottom:auto!important')],
  ['CH04 four section answers', ['A:\'GOL\'','B:\'DEN\'','C:\'HOUR\'','D:\'6\''].every(v => server.includes(v))],
  ['CH04 final answer and two-person vote', server.includes("'GOLDEN HOUR 6'") && server.includes("m.action==='ch04_vote'")],
  ['CH04 actual UI actions', index.includes('data-ch04="ch04_vote"') && index.includes('data-ch04="ch04_decoder"')],
  ['CH05 five fragments and reconstruction', server.includes('20413') && server.includes('AZUP')],
  ['CH05 multiplayer UI retained', index.includes('id="ch05PuzzlePanel"')],
  ['Approved visual UI preserved in live /play route', server.includes("pathname==='/play'") && server.includes("approved-v172.html")],
];
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  assert.ok(ok, name);
}
console.log('Recovery static regression checks passed. NOTE: This does not validate the live /play DOM or 2-player gameplay.');
