// INTERVALLE — règles de l'arène. Auteur : CLAUDE.
import test from 'node:test';
import assert from 'node:assert/strict';
import { H, LIFT_RANGE, MAX_TURNS, RESERVE_BUDGET, W, createArena } from '../intervalle/arena.js';
import { createPolicy as still } from '../intervalle/still.js';

const scripted = (name, actions) => {
  let k = 0;
  return { name, act: () => actions[k++] ?? { rest: true } };
};

test('deux politiques immobiles : la rencontre s’achève aussitôt', () => {
  const a = createArena({ seed: 3, policies: [still(), still()] }).run();
  assert.equal(a.done, true);
  assert.equal(a.turn, 2);
  assert.deepEqual(a.summary().ink, [1, 1]);
});

test('une plume posée avance d’une case et laisse son encre', () => {
  const a = createArena({ seed: 1, policies: [scripted('A', [{ to: [33, 40] }, { to: [34, 41] }]), still()] });
  const [p] = a.pens;
  assert.equal(p.x, 32);
  a.run();
  assert.equal(a.strokes[0].length, 2);
  assert.equal(a.cell(34, 41), 1);
  assert.equal(a.summary().ink[0], 3);
});

test('on ne traverse jamais l’encre ni le blanc de l’autre : refus noté, plume immobile', () => {
  // B part en (88,40) ; A saute près de lui plume levée puis tente d'entrer.
  const A = scripted('A', [{ lift: true }, { to: [38, 40] }, { to: [44, 40] }, { to: [50, 40] }, { to: [56, 40] }, { to: [62, 40] }, { to: [68, 40] }, { to: [74, 40] }, { to: [80, 40] }, { to: [86, 40] }, { to: [88, 40] }]);
  const B = scripted('B', [{ reserve: [[87, 40], [87, 39]] }]);
  const a = createArena({ seed: 2, policies: [A, B] }).run();
  const r = a.refusals.filter((x) => x.side === 0);
  assert.ok(r.length >= 1, 'au moins un refus');
  assert.ok(r.some((x) => x.reason === 'encre' || x.reason === 'blanc'));
  assert.notEqual(a.cell(88, 40), 1, 'l’encre de B reste à B');
});

test('les réserves sont bornées en portée, en nombre par tour et en budget', () => {
  const far = createArena({ seed: 1, policies: [scripted('A', [{ reserve: [[40, 40], [33, 41]] }]), still()] }).run();
  assert.equal(far.summary().voids[0], 1, 'seule la case à portée est réservée');
  const greedy = Array.from({ length: 200 }, (_, k) => (k % 2 === 0 ? { reserve: [[-1, 0]] } : { to: [33 + ((k / 2) % 2), 40] }));
  const big = createArena({ seed: 1, policies: [scripted('A', greedy), still()] }).run();
  assert.ok(big.summary().voids[0] <= RESERVE_BUDGET);
  const many = createArena({ seed: 1, policies: [scripted('A', [{ reserve: [[31, 39], [31, 41], [33, 39], [33, 41], [30, 40], [34, 40]] }]), still()] }).run();
  assert.equal(many.summary().voids[0], 4, 'quatre cases au plus par tour');
});

test('plume levée : saut borné, aucune encre ; cession notée comme concession', () => {
  const a = createArena({ seed: 1, policies: [scripted('A', [{ lift: true }, { to: [32 + LIFT_RANGE + 1, 40] }, { to: [32 + LIFT_RANGE, 40] }, { cede: true }]), still()] }).run();
  const ev = a.events.filter((e) => e.side === 0);
  assert.equal(ev[1].result, 'invalid');
  assert.equal(ev[2].result, 'ok');
  assert.equal(a.cell(32 + LIFT_RANGE, 40), 0, 'pas d’encre plume levée');
  assert.equal(a.summary().concessions[0], 1);
});

test('une politique qui plante ou triche ne casse pas la rencontre et ne peut pas écrire la vue', () => {
  const rude = { name: 'X', act: (v) => { v.me.x = 0; throw new Error('boum'); } };
  const a = createArena({ seed: 1, policies: [rude, still()] });
  for (let k = 0; k < 10; k++) a.step();
  assert.equal(a.pens[0].x, 32);
  assert.ok(a.events.some((e) => e.kind === 'error'));
});

test('même graine, même feuille ; 600 tours au plus', () => {
  const wander = () => ({ name: 'W', act: (v) => ({ to: [Math.max(0, Math.min(v.w - 1, v.me.x + Math.floor(v.rng() * 3) - 1)), Math.max(0, Math.min(v.h - 1, v.me.y + Math.floor(v.rng() * 3) - 1))] }) });
  const s1 = createArena({ seed: 9, policies: [wander(), wander()] }).run().summary();
  const s2 = createArena({ seed: 9, policies: [wander(), wander()] }).run().summary();
  assert.deepEqual(s1, s2);
  assert.equal(s1.turns, MAX_TURNS);
  const s3 = createArena({ seed: 10, policies: [wander(), wander()] }).run().summary();
  assert.notDeepEqual(s1.ink, s3.ink);
  assert.equal(W * H, 9600);
});
