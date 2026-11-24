import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhrase,composeAnswer,createDialogue,quantizeFrequency} from '../src/phrase.js';
const samples=()=>Array.from({length:12},(_,i)=>({t:i*.15,x:.15+i*.05,y:.2+i*.04,freq:500-i*25,energy:.45}));
const raw=()=>({id:'p1',samples:samples()});
test('a gesture closes only after silence, answers once, then returns the floor',()=>{
  const d=createDialogue();for(const s of samples())d.input(s);
  assert.equal(d.update(2.5),null);assert.equal(d.state,'waiting');
  const closed=d.update(3.3);assert.equal(closed.type,'phrase');assert.equal(d.memory.length,1);
  const response=d.update(3.32);assert.equal(response.type,'answer');assert.equal(d.state,'answering');
  assert.equal(d.input({t:4,x:.5,y:.5,freq:220,energy:.5}),false);
  assert.equal(d.update(4),null);assert.equal(d.update(3.32+response.answer.duration+.01).type,'idle');
  assert.equal(d.input({t:20,x:.5,y:.5,freq:220,energy:.5}),true);
});
test('a silent sample never manufactures a phrase',()=>{
  const d=createDialogue();assert.equal(d.input({t:0,x:.5,y:.5,freq:220,energy:0}),false);assert.equal(d.update(100),null);assert.equal(d.state,'idle');
});
test('the musical reply is deterministic, bounded, and rhymes with the source figures',()=>{
  const a=composeAnswer(raw(),{seed:7}),b=composeAnswer(raw(),{seed:7});assert.deepEqual(a,b);
  assert.ok(a.duration<=8);assert.ok(a.notes.length>1&&a.notes.length<=16);
  for(let i=0;i<a.notes.length;i++){
    const n=a.notes[i];assert.ok(n.freq>=60&&n.freq<=1100);assert.ok(n.at+n.dur<=a.duration);assert.ok(n.velocity<=.58);assert.ok(Math.abs(n.pan)<=1);
    if(i)assert.ok(n.freq<=a.notes[i-1].freq);assert.ok(samples().some(s=>s.freq===a.figures[i].freq));
  }
});
test('curved and straight gestures produce different musical character',()=>{
  const curve=raw();curve.samples=Array.from({length:32},(_,i)=>({t:i*.08,x:.5+Math.cos(i/31*Math.PI*2)*.3,y:.5+Math.sin(i/31*Math.PI*2)*.3,freq:250+i*3,energy:.5}));
  assert.ok(normalizePhrase(curve).features.curvature>.55);assert.equal(composeAnswer(curve).character,'bell');assert.notEqual(composeAnswer(raw()).character,'bell');
});
test('continuous input is bounded in duration and points',()=>{
  const d=createDialogue();for(let i=0;i<3000;i++)d.input({t:i*.01,x:.5,y:.5,freq:220,energy:.5});
  assert.ok(d.current.length<=128);assert.equal(d.update(30).type,'phrase');const a=d.update(30.01);assert.ok(a.answer.duration<=8);
});
test('even the longest quiet gesture has no note beyond the eight-second reply',()=>{
  const phrase={samples:Array.from({length:128},(_,i)=>({t:i/127*8,x:i/127,y:.5,freq:100+i*5,energy:.02}))};
  const a=composeAnswer(phrase);assert.ok(a.duration<=8);assert.ok(a.notes.every(n=>n.at+n.dur<=a.duration));
});
test('memory is capped at twelve phrases and reset removes all session state',()=>{
  const d=createDialogue();let t=0;
  for(let i=0;i<15;i++){d.input({t,x:.5,y:.5,freq:180+i*10,energy:.4});d.update(t+2);const a=d.update(t+2.01);d.update(t+2.02+a.answer.duration);t+=15;}
  assert.equal(d.memory.length,12);assert.equal(d.memory[0].id,'p4');d.reset();assert.equal(d.memory.length,0);assert.equal(d.state,'idle');
});
test('malformed gesture data and prototype scale names cannot create unsafe notes',()=>{
  for(const value of [null,{samples:[]},{samples:[{t:0,x:NaN,y:.5,freq:220,energy:.5}]},{samples:[{t:0,x:.5,y:.5,freq:1e9,energy:.5}]}])assert.throws(()=>normalizePhrase(value));
  assert.ok(Number.isFinite(quantizeFrequency(220,'toString')));assert.throws(()=>quantizeFrequency(NaN));
});
