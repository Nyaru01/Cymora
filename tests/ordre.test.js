import test from 'node:test';
import assert from 'node:assert/strict';
import {createArena} from '../intervalle/arena.js';
import {createPolicy} from '../intervalle/ordre.js';
import {createPolicy as still} from '../intervalle/still.js';

test('ORDRE écrit une géométrie orthogonale légale et rejouable sans partenaire', () => {
  for (let seed=1;seed<=20;seed++) {
    const a=createArena({seed,policies:[createPolicy(),still()]}).run();
    const b=createArena({seed,policies:[createPolicy(),still()]}).run();
    assert.deepEqual(a.strokes,b.strokes);
    assert.ok(a.strokes[0].length>200);
    assert.ok(a.events.every(e=>e.result!=='invalid'));
    assert.ok(a.strokes[0].every(([x,y,xx,yy])=>x===xx || y===yy));
  }
});

test('ORDRE reconnaît un refus et concède avant de lever sa plume', () => {
  const p=createPolicy();
  const view={w:120,h:80,me:{x:60,y:40,down:true},rng:()=>.5,
    cell:()=> 'empty',reserveLeft:240,myRefusals:0};
  p.act(view);
  assert.deepEqual(p.act({...view,myRefusals:1}),{cede:true});
  assert.deepEqual(p.act({...view,myRefusals:1}),{lift:true});
});
