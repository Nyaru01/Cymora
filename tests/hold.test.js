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

test('aventure : aucune note tenue au chapitre I, puis de plus en plus tôt', () => {
  const count = (t, i) => G.tideMotif(t, i).notes.filter((n) => n.hold).length;
  for (let i = 0; i < G.MOTIFS_PER_TIDE; i++) assert.equal(count(0, i), 0);
  assert.equal(count(1, 0), 0);
  assert.equal(count(1, 2), 1);
  assert.equal(count(2, 1), 1);
  assert.equal(count(3, 0), 1);
  assert.equal(count(3, 4), 2);
  for (let t = 1; t < G.TIDES.length; t++) for (let i = 0; i < G.MOTIFS_PER_TIDE; i++) assert.ok(!G.tideMotif(t, i).notes[0].hold);
});

test('tutoriel : une seule note tenue, à la hauteur de la première tenue du chant', () => {
  const m = G.tideMotif(1, 2);
  const lesson = G.holdLesson(m);
  assert.equal(lesson.notes.length, 1);
  assert.ok(lesson.notes[0].hold && lesson.notes[0].dur > G.HOLD);
  assert.equal(lesson.notes[0].deg, m.notes.find((n) => n.hold).deg);
});

test('chapitre V « Battre » : chants en mesure, sans note tenue ; tutoriel de quatre battements', () => {
  const k = G.TIDES.findIndex((t) => t.pulse);
  assert.equal(k, 4);
  for (let i = 0; i < G.MOTIFS_PER_TIDE; i++) {
    const m = G.tideMotif(k, i);
    assert.ok(m.pulse);
    assert.ok(!m.notes.some((n) => n.hold));
  }
  const lesson = G.pulseLesson();
  assert.equal(lesson.notes.length, 4);
  assert.equal(G.rhythmOf(lesson.notes, lesson.notes.map((n) => 3 + n.at)).score, 1);
  assert.ok(G.PERFECT > G.RESONANCE && G.PERFECT < 1);
});

test('verdictOf suit les seuils', () => {
  assert.equal(G.verdictOf(0.96), 'resonance');
  assert.equal(G.verdictOf(0.86), 'close');
  assert.equal(G.verdictOf(0.86, G.DAILY_PASS), 'near');
  assert.equal(G.verdictOf(0.5), 'far');
});
