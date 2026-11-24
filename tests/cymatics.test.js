// Matière modale — auteur : CLAUDE. Le geste doit réellement dessiner une figure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODES, PITCH_HIGH, PITCH_LOW, applyCymatics, buildField, gestureFreq, gradPsi, modeIndex, nodalSegments, psi } from '../src/cymatics.js';

const packed = (n, seed = 3) => {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const p = { n, x: new Float32Array(n), y: new Float32Array(n), light: new Float32Array(n) };
  for (let i = 0; i < n; i++) { p.x[i] = rnd(); p.y[i] = rnd(); }
  return p;
};

test('les modes sont ordonnés par fréquence propre et distincts', () => {
  assert.ok(MODES.length >= 24);
  const keys = new Set(MODES.map(String));
  assert.equal(keys.size, MODES.length);
  for (let i = 1; i < MODES.length; i++) {
    const e = ([m, n]) => m * m + n * n;
    assert.ok(e(MODES[i]) >= e(MODES[i - 1]), `ordre ${MODES[i]}`);
  }
});

test('modeIndex est monotone, borné, et grave = figure simple', () => {
  assert.equal(modeIndex(PITCH_LOW), 0);
  assert.equal(modeIndex(PITCH_HIGH), MODES.length - 1);
  assert.equal(modeIndex(20), 0);
  assert.equal(modeIndex(5000), MODES.length - 1);
  assert.equal(modeIndex(NaN), 0);
  let prev = -1;
  for (let f = 80; f < 900; f += 7) { const k = modeIndex(f); assert.ok(k >= prev); prev = k; }
});

test('le gradient analytique correspond aux différences finies', () => {
  const h = 1e-5;
  for (const [m, n] of [MODES[0], MODES[9], MODES[25]]) {
    for (const [x, y] of [[0.2, 0.7], [0.51, 0.33], [0.9, 0.1]]) {
      const [gx, gy] = gradPsi(m, n, x, y);
      const fx = (psi(m, n, x + h, y) - psi(m, n, x - h, y)) / (2 * h);
      const fy = (psi(m, n, x, y + h) - psi(m, n, x, y - h)) / (2 * h);
      assert.ok(Math.abs(gx - fx) < 1e-3 * (1 + Math.abs(fx)));
      assert.ok(Math.abs(gy - fy) < 1e-3 * (1 + Math.abs(fy)));
    }
  }
});

test('le plancton converge vers les lignes nodales et s’y allume', () => {
  const F = buildField(MODES[10]);
  const p = packed(5000);
  const mean = () => { let s = 0; for (let i = 0; i < p.n; i++) s += Math.abs(psi(F.m, F.n, p.x[i], p.y[i])); return s / p.n; };
  const before = mean();
  for (let k = 0; k < 120; k++) applyCymatics(p, F, null, 0, 0.8, 1 / 60);
  const after = mean();
  assert.ok(after < before * 0.2, `${before} → ${after}`);
  let lit = 0;
  for (let i = 0; i < p.n; i++) if (p.light[i] > 0.3) lit++;
  assert.ok(lit / p.n > 0.5, `allumés ${lit}`);
  for (let i = 0; i < p.n; i++) assert.ok(p.x[i] >= 0 && p.x[i] <= 1 && p.y[i] >= 0 && p.y[i] <= 1);
});

test('sans souffle, la cymatique ne touche à rien ; le mélange reste fini', () => {
  const A = buildField(MODES[2]), B = buildField(MODES[12]);
  const p = packed(500);
  const x0 = Float32Array.from(p.x);
  assert.equal(applyCymatics(p, A, B, 0.5, 0, 1 / 60), 0);
  assert.deepEqual(p.x, x0);
  applyCymatics(p, A, B, 0.5, 1, 1 / 60);
  for (let i = 0; i < p.n; i++) assert.ok(Number.isFinite(p.x[i]) && Number.isFinite(p.y[i]));
});

test('20 000 grains : coût mesuré, borne large (diagnostic, pas une promesse matérielle)', () => {
  const F = buildField(MODES[20]);
  const p = packed(20000);
  applyCymatics(p, F, null, 0, 0.8, 1 / 60);
  const t0 = performance.now();
  for (let k = 0; k < 30; k++) applyCymatics(p, F, null, 0, 0.8, 1 / 60);
  const ms = (performance.now() - t0) / 30;
  // Mesuré ≈ 0,8 ms sur la machine de développement ; la borne ne protège que d'une régression grossière.
  console.log(`# cymatique : ${ms.toFixed(2)} ms par pas pour 20 000 grains`);
  assert.ok(ms < 25, `${ms.toFixed(2)} ms`);
});

test('le doigt chante : haut = aigu, bas = grave, borné', () => {
  assert.ok(Math.abs(gestureFreq(0) - 880) < 1e-9);
  assert.ok(Math.abs(gestureFreq(1) - 82) < 1e-9);
  assert.ok(gestureFreq(0.3) > gestureFreq(0.6));
  assert.equal(gestureFreq(-2), gestureFreq(0));
  assert.ok(Number.isFinite(gestureFreq(NaN)));
});

test('les lignes nodales tombent bien sur ψ ≈ 0', () => {
  for (const mode of [MODES[0], MODES[14]]) {
    const seg = nodalSegments(mode);
    assert.ok(seg.length > 40 && seg.length % 4 === 0);
    for (let k = 0; k < seg.length; k += 2) {
      assert.ok(seg[k] >= 0 && seg[k] <= 1 && seg[k + 1] >= 0 && seg[k + 1] <= 1);
      assert.ok(Math.abs(psi(mode[0], mode[1], seg[k], seg[k + 1])) < 0.15);
    }
  }
});
