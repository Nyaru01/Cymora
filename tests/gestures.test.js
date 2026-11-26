import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/src/game.js';

test('atelier « Glisser » : des glissades longues, sur au moins trois degrés, jamais en première note', () => {
  for (let i = 0; i < 8; i++) {
    const m = G.glideMotif(i);
    const glides = m.notes.map((n, k) => ({ n, k })).filter(({ n }) => n.glide);
    assert.ok(glides.length >= (i >= 2 ? 2 : 1), `chant ${i} : nombre de glissades`);
    assert.ok(!m.notes[0].glide);
    for (const { n, k } of glides) {
      assert.ok(Math.abs(n.deg - m.notes[k - 1].deg) >= 3, 'une vraie glissade');
      assert.ok(n.dur > n.glide, 'la note se pose après sa glissade');
    }
    for (let j = 1; j < m.notes.length; j++) assert.ok(m.notes[j].at > m.notes[j - 1].at);
    assert.deepEqual(G.glideMotif(i), m, 'déterministe');
  }
});

test('le chant glisse vraiment : à mi-glissade, la hauteur est entre les deux notes', () => {
  const m = G.glideMotif(0);
  const k = m.notes.findIndex((n) => n.glide);
  const a = m.notes[k - 1].deg;
  const b = m.notes[k].deg;
  const mid = G.motifDegreeAt(m, m.notes[k].at + m.notes[k].glide / 2);
  assert.ok(Math.min(a, b) < mid && mid < Math.max(a, b));
});

test('glideOf : glissade régulière, pressée, hésitante ou manquée', () => {
  const m = G.glideMotif(0);
  const ref = G.reachTimes(m);
  const ideal = G.motifTrace(m, 60).map((p) => ({ t: p.at, y: p.y }));
  assert.equal(G.glideOf(m, ideal, ref).feedback, null, 'le chant lui-même glisse juste');
  assert.ok(G.glideOf(m, ideal, ref).score > 0.9);
  const k = m.notes.findIndex((n) => n.glide);
  const fast = [...ref];
  for (let j = k; j < fast.length; j++) fast[j] -= (ref[k] - ref[k - 1]) * 0.6;
  assert.equal(G.glideOf(m, ideal, fast).feedback, 'fast');
  const t0 = ref[k - 1];
  const t1 = ref[k];
  const shaky = ideal.map((p) => (p.t > t0 && p.t < t1 ? { t: p.t, y: p.y + Math.sin(p.t * 40) * 0.06 } : p));
  assert.equal(G.glideOf(m, shaky, ref).feedback, 'shaky');
  assert.equal(G.glideOf(m, ideal, ref.slice(0, k)).feedback, 'missed');
});

test('atelier « Silence » : un silence au milieu, deux phrases', () => {
  for (let i = 0; i < 6; i++) {
    const m = G.restMotif(i);
    const rests = m.notes.filter((n) => n.rest);
    assert.equal(rests.length, 1);
    const k = m.notes.findIndex((n) => n.rest);
    assert.ok(k > 0 && k < m.notes.length);
    const prev = m.notes[k - 1];
    assert.ok(m.notes[k].at - (prev.at + prev.dur) >= G.REST - 0.01, 'le silence a lieu entre les deux phrases');
  }
});

test('restOf : silence tenu, oublié, trop court, trop long, au tempo ralenti', () => {
  const m = G.restMotif(0);
  assert.equal(G.restOf(m, [G.REST]).score, 1);
  assert.equal(G.restOf(m, [G.REST]).feedback, null);
  assert.equal(G.restOf(m, []).feedback, 'none');
  assert.equal(G.restOf(m, []).score, 0);
  assert.equal(G.restOf(m, [G.REST * 0.3]).feedback, 'short');
  assert.equal(G.restOf(m, [G.REST * 2.5]).feedback, 'long');
  assert.equal(G.restOf(m, [G.REST * 1.25], 1.25).score, 1, 'le rechant plus lent allonge le silence attendu');
});

test('parcours : glissades apprises au III, silences au IV, tout ensemble au VI', () => {
  const id = (k) => G.TIDES.findIndex((t) => t.id === k);
  const has = (t, i, g) => G.tideMotif(t, i).notes.some((n) => n[g]);
  assert.equal(G.TIDES.length, 6);
  assert.ok(!has(id('remember'), 0, 'glide') && has(id('remember'), 1, 'glide'));
  assert.ok(!has(id('listen'), 0, 'rest') && has(id('listen'), 1, 'rest'));
  for (let t = 0; t < 2; t++) for (let i = 0; i < 5; i++) assert.ok(!has(t, i, 'glide') && !has(t, i, 'rest'), 'I et II restent simples');
  const vi = id('resonate');
  assert.ok(has(vi, 4, 'glide') && has(vi, 4, 'rest') && has(vi, 4, 'hold'), 'le dernier chant mêle tout');
  assert.ok(G.tideMotif(vi, 3).pulse, 'un chant en mesure au VI');
});

test('une note ne porte jamais deux gestes, et la première note aucun', () => {
  for (let t = 0; t < G.TIDES.length; t++) {
    for (let i = 0; i < G.MOTIFS_PER_TIDE; i++) {
      const m = G.tideMotif(t, i);
      assert.ok(!m.notes[0].hold && !m.notes[0].glide && !m.notes[0].rest);
      for (const n of m.notes) assert.ok([n.hold, n.glide, n.rest].filter(Boolean).length <= 1, `chapitre ${t} chant ${i}`);
    }
  }
});

test('accord du moment : élevé en suivant le chant, bas en gribouillant', () => {
  const m = G.tideMotif(2, 2);
  const tr = G.motifTrace(m, 60).map((p) => ({ t: 5 + p.at, y: p.y }));
  for (const frac of [0.3, 0.6, 1]) {
    const part = tr.filter((p) => p.t - 5 <= m.duration * frac);
    assert.ok(G.liveAccord(m, part) >= 0.85, `début du chant (${frac}) : ${G.liveAccord(m, part)}`);
  }
  const r = G.rng(3);
  const scribble = tr.map((p) => ({ t: p.t, y: 0.1 + r() * 0.8 }));
  assert.ok(G.liveAccord(m, scribble) < 0.6);
  assert.equal(G.liveAccord(m, tr.slice(0, 3)), null, 'trop court pour juger');
});

test('tutoriels : une glissade ; deux phrases séparées par un silence', () => {
  const g = G.glideLesson();
  assert.equal(g.notes.filter((n) => n.glide).length, 1);
  const r = G.restLesson();
  assert.equal(r.notes.filter((n) => n.rest).length, 1);
  assert.equal(G.glideOf(g, G.motifTrace(g, 60).map((p) => ({ t: p.at, y: p.y })), G.reachTimes(g)).feedback, null);
});
