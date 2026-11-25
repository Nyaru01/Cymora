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

test('atelier « Pulsation » : notes sur les temps, deux temps possibles dès le deuxième chant', () => {
  let long = 0;
  for (let i = 0; i < 12; i++) {
    const m = G.pulseMotif(i);
    for (const n of m.notes) {
      const beats = n.at / G.BEAT;
      assert.ok(Math.abs(beats - Math.round(beats)) < 0.01, `chant ${i} : note sur un temps`);
      if (n.beats === 2) long++;
    }
    assert.deepEqual(G.pulseMotif(i), m, 'déterministe');
  }
  assert.ok(long > 0, 'il existe des notes de deux temps');
});

test('rhythmOf : en mesure, pressé, lent, notes manquées', () => {
  const m = G.pulseMotif(3);
  const exact = m.notes.map((n) => 10 + n.at);
  assert.equal(G.rhythmOf(m.notes, exact).score, 1);
  const fast = m.notes.map((n) => 10 + n.at * 0.6);
  const slow = m.notes.map((n) => 10 + n.at * 1.5);
  assert.ok(G.rhythmOf(m.notes, fast).score <= 0.6 && G.rhythmOf(m.notes, fast).drift < 0);
  assert.ok(G.rhythmOf(m.notes, slow).score <= 0.6 && G.rhythmOf(m.notes, slow).drift > 0);
  assert.equal(G.rhythmOf(m.notes, exact.map((v) => v * 1), 1).score, 1);
  assert.ok(G.rhythmOf(m.notes, [exact[0]]).score < 0.1, 'notes non atteintes');
  const slower = m.notes.map((n) => 10 + n.at * 1.25);
  assert.equal(G.rhythmOf(m.notes, slower, 1.25).score, 1, 'le tempo ralenti du rechant est pris en compte');
});

test('verdictOf suit les seuils', () => {
  assert.equal(G.verdictOf(0.96), 'resonance');
  assert.equal(G.verdictOf(0.86), 'close');
  assert.equal(G.verdictOf(0.86, G.DAILY_PASS), 'near');
  assert.equal(G.verdictOf(0.5), 'far');
});
