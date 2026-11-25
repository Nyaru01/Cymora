// Fonctions pures du renderer V2 — auteur : CLAUDE.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createObjectView, createRenderer, fillSegments, speedToT } from '../public/src/render.js';

test('speedToT est monotone, borné et robuste', () => {
  assert.equal(speedToT(0), 0);
  assert.equal(speedToT(NaN), 0);
  assert.equal(speedToT(-1), 0);
  assert.equal(speedToT(1e6), 1);
  let prev = 0;
  for (let s = 1e-4; s < 10; s *= 1.5) {
    const t = speedToT(s);
    assert.ok(t >= prev && t >= 0 && t <= 1);
    prev = t;
  }
});

test('fillSegments écrit deux sommets par particule, en pixels, et masque les réapparitions', () => {
  const view = {
    n: 2,
    x: Float32Array.of(0.5, 0.2), y: Float32Array.of(0.5, 0.2),
    px: Float32Array.of(0.4, 0.2), py: Float32Array.of(0.5, 0.2),
    speed: Float32Array.of(0.05, 0), light: Float32Array.of(0.75, 0),
  };
  const out = new Float32Array(20);
  const count = fillSegments(view, { x: 100, y: 0, size: 200 }, out, 0);
  assert.equal(count, 4);
  assert.deepEqual([...out.slice(0, 2)], [180, 100]); // départ (0.4, 0.5)
  assert.deepEqual([...out.slice(5, 7)], [200, 100]); // arrivée (0.5, 0.5)
  assert.equal(out[3], 0.75); // luminance transmise
  assert.equal(out[4], 1); // visible
  assert.equal(out[14], 0); // particule réapparue : invisible
});

test('fillSegments ne dépasse jamais la capacité du tampon', () => {
  const n = 50;
  const arr = () => new Float32Array(n).fill(0.5);
  const view = { n, x: arr(), y: arr(), px: arr(), py: arr() };
  const out = new Float32Array(10 * 10);
  assert.equal(fillSegments(view, { x: 0, y: 0, size: 1 }, out), 20);
});

test('l’adaptateur V1 convertit des objets et réutilise ses tableaux', () => {
  const adapt = createObjectView();
  const a = adapt([{ x: 0.1, y: 0.2, px: 0.1, py: 0.1, speed: 0.02 }]);
  assert.equal(a.n, 1);
  assert.ok(Math.abs(a.y[0] - 0.2) < 1e-6);
  assert.equal(a.light[0], 0);
  const xs = a.x;
  const b = adapt([{ x: 0.3, y: 0.3, px: 0.3, py: 0.3 }]);
  assert.equal(b.x, xs);
  assert.equal(b.n, 1);
});

test('sans WebGL2, createRenderer se replie sur Canvas 2D', () => {
  const fake2d = new Proxy({}, { get: () => () => {} });
  const doc = { createElement: () => ({ getContext: (k) => (k === '2d' ? fake2d : null), addEventListener() {} }) };
  const r = createRenderer({ doc });
  assert.equal(r.kind, '2d');
});
