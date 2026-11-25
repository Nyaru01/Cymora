// PWA — auteur : CLAUDE. Une version publiée doit avoir son propre cache, et ses icônes doivent exister.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('le service worker porte la version de package.json (sinon pas de mise à jour proposée)', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.equal(/const VERSION = '([^']+)'/.exec(sw)?.[1], pkg.version);
  const app = await readFile(new URL('../public/src/app.js', import.meta.url), 'utf8');
  assert.equal(/const VERSION = '([^']+)'/.exec(app)?.[1], pkg.version, 'la version affichée dans le menu');
  // Une version récente attend l'accord du joueur ; seules les toutes premières (sans pop-up) sont remplacées d'office.
  assert.match(sw, /event\.data === 'skip'\) self\.skipWaiting\(\)/);
  assert.equal(sw.split('self.skipWaiting()').length - 1, 2, 'deux appels seulement : sur accord, et pour les toutes premières versions');
  assert.ok(sw.includes("/^(cymora-v\\d|resonance-v\\d)/.test(k))) self.skipWaiting()"));
});

test('le manifeste et ses icônes', async () => {
  const m = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(m.name, 'Cymora');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok((await stat(new URL(`../public/${i.src}`, import.meta.url))).size > 1000, i.src);
});
