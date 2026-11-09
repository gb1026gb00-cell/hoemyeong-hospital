'use strict';
// Release blocker: original V172 interactive scenes must exist in the deployed HTML.
// The approved V172 source is hoemyeong_V172_multiplayer_integration_candidate.zip.
// Do not replace these assertions with placeholder markup or remove them to force green CI.
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const required={
  'approved chapter scene shell':'hmPlaySheet',
  'chapter 6 finale':'hmFinal06',
  'final scene':'hmFinalScene',
  'archive scene':'hmArchiveScene',
  'isolation scene':'hmIsolation05',
  'elevator scene':'hmElevator03',
  'ward scene':'hmWard02',
  'original object horror bridge':'HMObjectHorrorBindings',
  'original object horror layer':'hm-v165-object-horror'
};
let missing=0;
for(const [label,token] of Object.entries(required)){
 const ok=html.includes(token);
 console.log((ok?'PASS ':'FAIL ')+label+' ('+token+')');
 if(!ok)missing++;
}
if(missing){
 console.error('RELEASE BLOCKED: '+missing+' approved V172 scene/interaction anchors are missing. Restore the original V172 interactive UI and integrate the multiplayer client without replacing its scenes.');
 process.exitCode=1;
}
