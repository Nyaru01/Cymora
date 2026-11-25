// Chœur du jour — auteur : CLAUDE. Le serveur re-mesure chaque voix et ne garde que des courbes anonymes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptableDay, createChorus, createLimiter, judgeTrace } from '../chorus.mjs';
import { CHORUS_POINTS, attune, chorusGesture, chorusTrace, dailyMotif, localDate, motifTrace, validTrace } from '../public/src/game.js';

const today = new Date().toISOString().slice(0, 10);
const sung = (day, tempo = 1) => chorusTrace(motifTrace(dailyMotif(day)).map((p) => ({ t: p.at * tempo, y: p.y })));

test('une trace partagée ne garde que 48 hauteurs et une durée', () => {
  const tr = sung(today);
  assert.equal(tr.y.length, CHORUS_POINTS);
  assert.deepEqual(Object.keys(tr).sort(), ['dur', 'y']);
  assert.ok(validTrace(tr));
  // Réduite à 48 points, la réponse juste reste juste.
  const direct = attune(dailyMotif(today), motifTrace(dailyMotif(today)).map((p) => ({ t: p.at, y: p.y })));
  const shared = attune(dailyMotif(today), chorusGesture(tr));
  assert.ok(Math.abs(direct.score - shared.score) < 0.05, `${direct.score} / ${shared.score}`);
  assert.equal(chorusTrace([{ t: 0, y: 0.5 }]), null);
});

test('les traces mal formées sont refusées', () => {
  const ok = sung(today);
  for (const bad of [null, {}, { y: ok.y.slice(1), dur: 2 }, { y: ok.y.map(() => 2), dur: 2 }, { y: ok.y, dur: 0.1 }, { y: ok.y, dur: 99 }, { y: ok.y.map(String), dur: 2 }]) {
    assert.equal(validTrace(bad), false, JSON.stringify(bad)?.slice(0, 40));
  }
});

test('seuls hier, aujourd’hui et demain sont acceptés', () => {
  const now = new Date('2026-06-15T10:00:00Z');
  assert.ok(acceptableDay('2026-06-15', now));
  assert.ok(acceptableDay('2026-06-14', now));
  assert.ok(acceptableDay('2026-06-16', now));
  for (const d of ['2026-06-12', '2026-06-19', '2026-02-30', '15/06/2026', '', null, '2026-6-15']) assert.equal(acceptableDay(d, now), false, String(d));
});

test('le serveur re-mesure la voix : un trait plat ne rejoint pas le chœur', () => {
  assert.ok(judgeTrace(today, sung(today)).score >= 0.8);
  assert.ok(judgeTrace(today, sung(today, 1.6)).score >= 0.6); // tempo libre
  const flat = { y: Array(CHORUS_POINTS).fill(0.5), dur: 3 };
  assert.ok(judgeTrace(today, flat).score < 0.6);
  assert.equal(judgeTrace('1999-01-01', sung(today)), null);
});

test('chœur en mémoire : compte, voix justes, traces les plus accordées d’abord', async () => {
  const c = await createChorus({ url: '' });
  assert.equal(c.kind, 'memory');
  assert.deepEqual(await c.get(today), { day: today, voices: 0, resonant: 0, traces: [] });
  await c.add(today, sung(today), 0.95);
  await c.add(today, sung(today, 1.3), 0.7);
  const got = await c.get(today);
  assert.equal(got.voices, 2);
  assert.equal(got.resonant, 1);
  assert.equal(got.traces.length, 2);
});

test('limite douce : 12 voix par heure et par visiteur', () => {
  const allow = createLimiter(12);
  for (let i = 0; i < 12; i++) assert.ok(allow('a'));
  assert.equal(allow('a'), false);
  assert.ok(allow('b'));
});

test('localDate reste le jour du visiteur', () => assert.match(localDate(), /^\d{4}-\d{2}-\d{2}$/));
