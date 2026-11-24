// INTERVALLE — DÉTOUR (CLAUDE) : la politique respecte le contrat et sa propre promesse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createArena } from '../intervalle/arena.js';
import { createPolicy as detour } from '../intervalle/detour.js';
import { createPolicy as still } from '../intervalle/still.js';

const stubborn = () => ({ name: 'DROIT', act: (v) => ({ to: [Math.min(v.w - 1, v.me.x + 1), v.me.y] }) });

test('DÉTOUR ne produit jamais d’action invalide ni d’erreur', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const other of [still(), stubborn()]) {
      const a = createArena({ seed, policies: [other, detour()] }).run();
      const mine = a.events.filter((e) => e.side === 1);
      assert.equal(mine.filter((e) => e.result === 'invalid' || e.kind === 'error').length, 0, `graine ${seed}`);
    }
  }
});

test('DÉTOUR contourne au lieu de forcer : presque jamais refusé', () => {
  for (const seed of [1, 2, 3]) {
    const s = createArena({ seed, policies: [stubborn(), detour()] }).run().summary();
    assert.ok(s.refusals[1] <= 3, `refus ${s.refusals[1]}`);
  }
});

test('DÉTOUR réserve du blanc, trace des courbes, et se tait de lui-même', () => {
  const a = createArena({ seed: 7, policies: [still(), detour()] }).run();
  const s = a.summary();
  assert.ok(s.voids[1] > 0, 'du blanc réservé');
  assert.ok(s.ink[1] > 100, 'une vraie trace');
  assert.ok(s.turns < 600, 'repos avant la limite');
  // Des courbes : les directions successives changent souvent.
  const seg = a.strokes[1];
  let turns = 0;
  for (let k = 1; k < seg.length; k++) {
    const d0 = [seg[k - 1][2] - seg[k - 1][0], seg[k - 1][3] - seg[k - 1][1]].join();
    const d1 = [seg[k][2] - seg[k][0], seg[k][3] - seg[k][1]].join();
    if (d0 !== d1) turns++;
  }
  assert.ok(turns / seg.length > 0.25, `virages ${turns}/${seg.length}`);
});

test('DÉTOUR est déterministe à graine égale', () => {
  const s1 = createArena({ seed: 11, policies: [stubborn(), detour()] }).run().summary();
  const s2 = createArena({ seed: 11, policies: [stubborn(), detour()] }).run().summary();
  assert.deepEqual(s1, s2);
});

test('un atterrissage revendiqué pendant le saut ne piège pas DÉTOUR', () => {
  const policy = detour();
  const view = {me:{x:50,y:40,down:true},other:{x:110,y:70,rested:false},
    w:120,h:80,turn:0,maxTurns:600,rng:()=>.5,reserveLeft:0,myRefusals:0,
    cell:(x,y)=>Math.max(Math.abs(x-50),Math.abs(y-40))<=1?'theirs':'empty'};
  assert.deepEqual(policy.act(view),{lift:true});
  const jump=policy.act({...view,me:{...view.me,down:false}});
  assert.ok(Array.isArray(jump.to));
  // Le partenaire occupe maintenant toutes les destinations disponibles.
  const blocked={...view,me:{...view.me,down:false},myRefusals:1,cell:()=> 'theirs'};
  const response=policy.act(blocked);
  assert.notDeepEqual(response,jump,'ne retente pas le saut vers la case volée');
  assert.equal(response.cede,true,'reste en place lorsqu’aucun détour ne subsiste');
});
