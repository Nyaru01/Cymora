import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_PASS, DEGREES, PASS, RESONANCE, MOTIFS_PER_TIDE, TIDES, attune, dailyMotif, dayBefore, degreeFreq, degreeY, freshProgress,
  liveStreak, motif, motifDegreeAt, motifTrace, readProgress, recordDay, recordTide, rng, tideMotif, yDegree,
} from '../public/src/game.js';

/** Un geste qui suit le motif à un tempo donné, avec un tremblement et un décalage éventuels. */
function follow(m, { tempo = 1, jitter = 0, offset = 0, seed = 1 } = {}) {
  const r = rng(seed);
  const out = [];
  for (let t = 0; t <= m.duration; t += 1 / 60) {
    const deg = motifDegreeAt(m, t) + offset + (r() * 2 - 1) * jitter;
    out.push({ t: t / tempo, y: degreeY(deg) });
  }
  return out;
}

test('la gamme est monotone : plus haut à l’écran, plus aigu', () => {
  for (let k = 1; k < DEGREES; k++) {
    assert.ok(degreeFreq(k) > degreeFreq(k - 1));
    assert.ok(degreeY(k) < degreeY(k - 1));
    assert.ok(Math.abs(yDegree(degreeY(k)) - k) < 1e-9);
  }
  assert.equal(Math.round(degreeFreq(0)), 220);
  assert.equal(Math.round(degreeFreq(DEGREES - 1)), 880);
});

test('les motifs sont déterministes, bornés et ne restent jamais sur place', () => {
  assert.deepEqual(motif(7, 4), motif(7, 4));
  for (let s = 0; s < 300; s++) {
    const m = motif(s, 2 + (s % 5), 2 + (s % 4));
    for (let i = 0; i < m.notes.length; i++) {
      const n = m.notes[i];
      assert.ok(n.deg >= 1 && n.deg <= DEGREES - 2, `degré ${n.deg}`);
      if (i) assert.notEqual(n.deg, m.notes[i - 1].deg);
      if (i) assert.ok(n.at > m.notes[i - 1].at);
    }
    assert.ok(m.duration > 0 && m.duration < 8);
  }
});

test('chaque marée a cinq motifs différents, de plus en plus longs', () => {
  for (let t = 0; t < TIDES.length; t++) {
    const seen = new Set();
    let last = 0;
    for (let i = 0; i < MOTIFS_PER_TIDE; i++) {
      const m = tideMotif(t, i);
      seen.add(JSON.stringify(m.notes.map((n) => n.deg)));
      assert.ok(m.notes.length >= last);
      last = m.notes.length;
      assert.ok(m.notes.length >= TIDES[t].notes[0] && m.notes.length <= TIDES[t].notes[1]);
    }
    assert.equal(seen.size, MOTIFS_PER_TIDE);
  }
  assert.deepEqual(dailyMotif('2026-11-25'), dailyMotif('2026-11-25'));
  assert.notDeepEqual(dailyMotif('2026-11-25'), dailyMotif('2026-11-26'));
  assert.throws(() => dailyMotif('hier'));
});

test('le tracé de la matière va de gauche à droite, à la hauteur de ses notes', () => {
  const m = tideMotif(0, 0);
  const tr = motifTrace(m);
  for (let i = 1; i < tr.length; i++) assert.ok(tr[i].x > tr[i - 1].x);
  assert.ok(Math.abs(tr[0].y - degreeY(m.notes[0].deg)) < 1e-3);
  assert.ok(Math.abs(tr.at(-1).y - degreeY(m.notes.at(-1).deg)) < 1e-3);
});

test('suivre le chant entre en résonance, quel que soit le tempo', () => {
  for (let t = 0; t < TIDES.length; t++) {
    for (let i = 0; i < MOTIFS_PER_TIDE; i++) {
      const m = tideMotif(t, i);
      for (const tempo of [0.5, 1, 2]) {
        const r = attune(m, follow(m, { tempo }));
        assert.equal(r.verdict, 'resonance', `marée ${t} motif ${i} tempo ${tempo} : ${r.score}`);
      }
      assert.ok(attune(m, follow(m, { jitter: 0.35, seed: i })).score >= PASS, 'une main qui tremble reste juste');
    }
  }
});

test('un contour juste mais transposé d’un degré approche, sans passer (90 % exigés)', () => {
  for (let i = 0; i < MOTIFS_PER_TIDE; i++) {
    const m = tideMotif(2, i);
    const r = attune(m, follow(m, { offset: 1 }));
    assert.ok(r.score < PASS && r.verdict === 'near', `${r.score}`);
  }
});

test('l’aventure est plus clémente que la résonance du jour', () => {
  assert.ok(PASS < DAILY_PASS && DAILY_PASS < RESONANCE);
  const m = tideMotif(1, 0);
  for (let jitter = 0; jitter <= 1.6; jitter += 0.05) {
    const g = follow(m, { jitter, seed: 3 });
    const tide = attune(m, g);
    const day = attune(m, g, DAILY_PASS);
    assert.equal(tide.score, day.score);
    if (tide.score >= PASS && tide.score < DAILY_PASS) {
      assert.equal(tide.verdict, 'close');
      assert.equal(day.verdict, 'near');
      return;
    }
  }
  assert.fail('aucun tracé entre les deux seuils');
});

test('une ligne plate, un gribouillis ou un contour inversé ne passent pas', () => {
  let flatPass = 0;
  let scribblePass = 0;
  let invertedPass = 0;
  let total = 0;
  for (let t = 0; t < TIDES.length; t++) {
    for (let i = 0; i < MOTIFS_PER_TIDE; i++) {
      const m = tideMotif(t, i);
      const mean = m.notes.reduce((s, n) => s + n.deg, 0) / m.notes.length;
      const flat = Array.from({ length: 90 }, (_, k) => ({ t: k / 60, y: degreeY(mean) }));
      const r = rng(t * 10 + i);
      const scribble = Array.from({ length: 120 }, (_, k) => ({ t: k / 60, y: 0.1 + r() * 0.8 }));
      const inverted = follow(m).map((p) => ({ t: p.t, y: degreeY((DEGREES - 1) - yDegree(p.y)) }));
      total++;
      if (attune(m, flat).score >= PASS) flatPass++;
      if (attune(m, scribble).score >= PASS) scribblePass++;
      if (attune(m, inverted).score >= PASS) invertedPass++;
    }
  }
  assert.equal(flatPass, 0, `lignes plates acceptées : ${flatPass}/${total}`);
  assert.equal(scribblePass, 0, `gribouillis acceptés : ${scribblePass}/${total}`);
  assert.equal(invertedPass, 0, `contours inversés acceptés : ${invertedPass}/${total}`);
});

test('un toucher trop bref n’est pas une réponse', () => {
  const m = tideMotif(0, 0);
  assert.equal(attune(m, []).verdict, 'silent');
  assert.equal(attune(m, [{ t: 0, y: 0.5 }, { t: 0.05, y: 0.5 }, { t: 0.1, y: 0.4 }, { t: 0.12, y: 0.4 }]).verdict, 'silent');
  assert.equal(attune(m, [{ t: NaN, y: 1 }]).verdict, 'silent');
});

test('la marée avance seulement sur une réponse juste, et garde le meilleur accord', () => {
  let p = freshProgress();
  let r = recordTide(p, 0, 0, 0.3);
  assert.equal(r.advanced, false);
  assert.equal(r.progress.index, 0);
  assert.equal(r.progress.best[0][0], 0.3);
  p = r.progress;
  for (let i = 0; i < MOTIFS_PER_TIDE; i++) {
    r = recordTide(p, 0, i, 0.9);
    p = r.progress;
  }
  assert.equal(r.tideDone, true);
  assert.equal(p.tide, 1);
  assert.equal(p.index, 0);
  // Rejouer un motif déjà franchi ne fait pas reculer.
  p = recordTide(p, 0, 2, 0.95).progress;
  assert.equal(p.tide, 1);
  assert.equal(p.best[0][2], 0.95);
});

test('une ancienne rosace peut garder un écho sans perdre son meilleur accord', () => {
  const legacy = readProgress({ v: 1, tide: 0, index: 1, best: [[0.98]] });
  assert.equal(legacy.echoes[0][0], null);
  const trace = { y: Array(48).fill(0.4), dur: 2, extra: 'ignoré' };
  const first = recordTide(legacy, 0, 0, 0.86, trace).progress;
  assert.equal(first.best[0][0], 0.98);
  assert.deepEqual(first.echoes[0][0], { score: 0.86, trace: { y: trace.y, dur: 2 } });
  assert.equal(legacy.echoes[0][0], null);
  assert.deepEqual(readProgress(JSON.stringify(first)), first);

  const better = recordTide(first, 0, 0, 0.95, { y: Array(48).fill(0.7), dur: 3 }).progress;
  assert.equal(better.echoes[0][0].trace.dur, 3);
  assert.deepEqual(recordTide(better, 0, 0, 0.90, trace).progress.echoes, better.echoes);
  assert.equal(recordTide(first, 0, 1, 0.80, trace).progress.echoes[0][1], null);

  better.echoes[0][0].trace.y[0] = 2;
  const repaired = readProgress(JSON.stringify(better));
  assert.equal(repaired.echoes[0][0], null);
  assert.equal(repaired.best[0][0], 0.98);
});

test('la série de jours compte les jours consécutifs et s’éteint après un oubli', () => {
  let p = freshProgress();
  p = recordDay(p, '2026-11-24', 0.92);
  p = recordDay(p, '2026-11-25', 0.93);
  assert.equal(p.streak, 2);
  p = recordDay(p, '2026-11-25', 0.97); // rejouer le même jour ne compte pas deux fois
  assert.equal(p.streak, 2);
  assert.equal(liveStreak(p, '2026-11-26'), 2);
  assert.equal(liveStreak(p, '2026-11-27'), 0);
  p = recordDay(p, '2026-11-28', 0.91);
  assert.equal(p.streak, 1);
  assert.equal(dayBefore('2026-03-01'), '2026-02-28');
});

test('une progression stockée hostile ou abîmée est réparée', () => {
  assert.deepEqual(readProgress('{'), freshProgress());
  assert.deepEqual(readProgress(null), freshProgress());
  const p = readProgress(JSON.stringify({ v: 1, tide: 99, index: -4, best: [[2, 'x']], days: { hier: 1, '2026-11-25': 7 }, streak: -1, lastDay: '<script>' }));
  assert.equal(p.tide, TIDES.length);
  assert.equal(p.index, 0);
  assert.equal(p.best[0][0], 1);
  assert.equal(p.best[0][1], 0);
  assert.deepEqual(p.days, { '2026-11-25': 1 });
  assert.equal(p.streak, 0);
  assert.equal(p.lastDay, null);
});

test('score de résonance : somme des meilleurs accords, rejouer moins bien ne retire rien', async () => {
  const G = await import('../public/src/game.js');
  let p = G.freshProgress();
  assert.equal(G.resonanceScore(p), 0);
  p = G.recordTide(p, 0, 0, 0.92).progress;
  assert.equal(G.resonanceScore(p), 92);
  p = G.recordTide(p, 0, 0, 0.5).progress;
  assert.equal(G.resonanceScore(p), 92);
  p = G.recordTide(p, 0, 0, 0.97).progress;
  p = G.recordDay(p, '2026-11-25', 0.81);
  assert.equal(G.resonanceScore(p), 97 + 81);
  assert.equal(G.resonanceScore(G.readProgress('{"best":"x","days":{"2026-01-01":9}}')), 0);
});
