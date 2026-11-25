import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/src/game.js';

test('atelier « Tenir » : notes tenues longues, jamais la première, deux dès le troisième chant', () => {
  for (let i = 0; i < 12; i++) {
    const m = G.holdMotif(i);
    const holds = m.notes.filter((n) => n.hold);
    assert.ok(!m.notes[0].hold, `chant ${i} : la première note n'est pas tenue`);
    assert.ok(holds.length >= (i >= 2 ? 2 : 1), `chant ${i} : nombre de tenues`);
    for (const n of holds) assert.ok(n.dur > G.HOLD, 'une tenue dure plus que le temps à tenir');
    for (let j = 1; j < m.notes.length; j++) assert.ok(m.notes[j].at > m.notes[j - 1].at, 'notes dans l’ordre');
    assert.deepEqual(G.holdMotif(i), m, 'déterministe');
  }
});

test('verdictOf suit les seuils', () => {
  assert.equal(G.verdictOf(0.96), 'resonance');
  assert.equal(G.verdictOf(0.86), 'close');
  assert.equal(G.verdictOf(0.86, G.DAILY_PASS), 'near');
  assert.equal(G.verdictOf(0.5), 'far');
});
