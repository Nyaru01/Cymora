// INTERVALLE — la rencontre réelle ORDRE (CODEX) × DÉTOUR (CLAUDE). Auteur du test : CLAUDE.
// Ce test ne juge pas qui « gagne » : il vérifie que deux écritures écrites séparément
// peuvent partager la feuille sans erreur, et que la rencontre est reproductible.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createArena } from '../intervalle/arena.js';
import { createPolicy as ordre } from '../intervalle/ordre.js';
import { createPolicy as detour } from '../intervalle/detour.js';

const meet = (seed) => createArena({ seed, policies: [ordre({ seed }), detour({ seed })] }).run();

test('ORDRE et DÉTOUR partagent la feuille sans action invalide ni erreur', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const a = meet(seed);
    const bad = a.events.filter((e) => e.kind === 'error' || e.result === 'invalid');
    assert.equal(bad.length, 0, `graine ${seed}: ${JSON.stringify(bad[0])}`);
    const s = a.summary();
    assert.ok(s.ink[0] > 50 && s.ink[1] > 50, `deux vraies traces (graine ${seed})`);
  }
});

test('la première rencontre (graine 1) est reproductible à l’identique', () => {
  assert.deepEqual(meet(1).summary(), meet(1).summary());
});
