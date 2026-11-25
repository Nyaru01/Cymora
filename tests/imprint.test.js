import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeImprint,deserializeImprint,restoreDialogue} from '../public/src/imprint.js';
import {composeAnswer} from '../public/src/phrase.js';
const phrase={id:'p1',samples:[{t:0,x:.2,y:.3,freq:330,energy:.5},{t:.8,x:.6,y:.7,freq:220,energy:.3}]};
test('an imprint roundtrip regenerates the same musical answer',()=>{
  const text=serializeImprint({seed:73,phrases:[phrase]});const data=deserializeImprint(text);
  assert.deepEqual(composeAnswer(data.phrases[0],{seed:data.seed}),composeAnswer(phrase,{seed:73}));
  const restored=restoreDialogue(text);assert.equal(restored.memory.length,1);assert.equal(restored.state,'idle');
});
test('imprints contain only anonymous creative samples, never arbitrary metadata',()=>{
  const text=serializeImprint({seed:42,phrases:[{...phrase,private:'discard',features:{injected:true}}],private:'discard'});
  assert.ok(!text.includes('private'));assert.ok(!text.includes('features'));
});
test('oversized, wrong-version, duplicate and hostile imports are rejected',()=>{
  for(const input of ['null','{','x'.repeat(192001),JSON.stringify({version:2,kind:'imprint',seed:42,phrases:[]}),JSON.stringify({version:3,kind:'imprint',seed:42,phrases:Array(13).fill(phrase)}),JSON.stringify({version:3,kind:'imprint',seed:42,phrases:[phrase,phrase]}),JSON.stringify({version:3,kind:'imprint',seed:42,phrases:[{...phrase,samples:[{t:0,x:-1,y:0,freq:220,energy:1}]}]})])assert.throws(()=>deserializeImprint(input));
});
