// G5 — éditions publiques des œuvres. Auteur : CLAUDE.
// Vérifie que l'édition publique ne touche pas à la vérité des œuvres et que les deux langues sont complètes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async (p) => (await readFile(new URL(p, root), 'utf8')).replace(/\r\n/g, '\n');
const exists = (p) => access(new URL(p, root)).then(() => true, () => false);

test('INTERVALLE public : arène et politiques identiques à la rencontre v4', async (t) => {
  for (const f of ['arena.js', 'ordre.js', 'detour.js']) {
    if (!(await exists(`intervalle/${f}`))) { t.skip('source v4 absente'); return; }
    assert.equal(await read(`public/oeuvres/intervalle/${f}`), await read(`intervalle/${f}`), f);
  }
});

const editions = ['intervalle', 'resonance'];
for (const name of editions) {
  test(`${name} : chaque clé existe en français et en anglais`, async () => {
    const { DICT } = await import(new URL(`public/oeuvres/${name}/${name === 'intervalle' ? '' : 'src/'}strings.js`, root));
    const fr = Object.keys(DICT.fr).sort();
    const en = Object.keys(DICT.en).sort();
    assert.deepEqual(en, fr);
    for (const k of fr) assert.ok(String(DICT.en[k]).trim(), `${name}/${k} vide en anglais`);
  });
}

test('INTERVALLE public : la rencontre de graine 8 reste celle relevée en G4', async () => {
  const { createArena } = await import(new URL('public/oeuvres/intervalle/arena.js', root));
  const { createPolicy: o } = await import(new URL('public/oeuvres/intervalle/ordre.js', root));
  const { createPolicy: d } = await import(new URL('public/oeuvres/intervalle/detour.js', root));
  const s = createArena({ seed: 8, policies: [o({ seed: 8 }), d({ seed: 8 })] }).run().summary();
  assert.equal(s.turns, 542);
  assert.deepEqual(s.refusals, [7, 0]);
});

test('Jardin : chaque message français affiché par l’édition publique a sa traduction anglaise', async () => {
  const { phrase, DICT } = await import(new URL('public/oeuvres/jardin/src/strings.js', root));
  assert.deepEqual(Object.keys(DICT.en).sort(), Object.keys(DICT.fr).sort());
  const app = await read('public/oeuvres/jardin/src/app.js');
  const engine = await read('public/oeuvres/jardin/src/engine.js');
  const ui = await read('public/oeuvres/jardin/src/ui.js');
  const { ATLAS } = await import(new URL('public/oeuvres/jardin/src/atlas.js', root));
  const literals = new Set();
  for (const m of app.matchAll(/(?:this\.say|this\.toast|L)\('([^']+)'/g)) literals.add(m[1]);
  for (const m of app.matchAll(/^\s+(?:vortex|source|reef|beacon|move|erase): '([^']+)',$/gm)) literals.add(m[1]);
  for (const m of (engine + ui).matchAll(/new Error\('([^']+)'\)/g)) literals.add(m[1]);
  for (const e of ATLAS) { literals.add(e.name); literals.add(e.hint); }
  // Messages composés, tels que l'application les fabrique.
  for (const s of ['Annulé (2 étape(s) restante(s)).', 'Tourbillon retiré.', '1800 grains de plancton relâchés.', '3 élément(s) retiré(s).',
    'Import refusé : Format PELAGIC non reconnu.', 'Le Gyre chargé. Activez le son (M) pour l’entendre.', 'Tourbillon 1.2 — sens antihoraire — 30 · 40',
    '« ma.json » importé : 4 élément(s).', 'Le Puits — Un puits aspire tout. Le plancton spirale vers le centre et traverse les balises de plus en plus vite.']) literals.add(s);
  const missing = [...literals].filter((s) => /[a-zà-ÿ]/i.test(s) && phrase(s, 'en') === s && !['Source', 'obstacle', 'Volume'].includes(s.trim()));
  assert.deepEqual(missing, []);
  assert.equal(phrase('Tourbillon 1.2 — sens antihoraire — 30 · 40', 'en'), 'Vortex 1.2 — counter-clockwise — 30 · 40');
  assert.equal(phrase('Rien à annuler.', 'fr'), 'Rien à annuler.');
  // Le canevas aussi parle : aucune légende dessinée ne doit échapper à la traduction.
  assert.deepEqual([...app.matchAll(/fillText\('([^']*[a-zà-ÿ][^']*)'/gi)].map((m) => m[1]), []);
  const { noteName, pitchForDepth } = await import(new URL('public/oeuvres/jardin/src/audio.js', root));
  for (const depth of [0, 0.3, 0.7, 1]) {
    assert.match(noteName(pitchForDepth(depth), 'en'), /^[A-G]♯?\d$/);
    assert.match(noteName(pitchForDepth(depth)), /^(Do|Ré|Mi|Fa|Sol|La|Si)♯?\d$/);
  }
});

test('Atelier : faits et voix bien formés, bilingues, sur des chapitres connus', async () => {
  const { CHAPTERS, TITLES, FACTS } = await import(new URL('public/atelier/facts.js', root));
  const voices = [];
  for (const f of ['voice-claude.js', 'voice-codex.js']) {
    if (await exists(`public/atelier/${f}`)) voices.push((await import(new URL(`public/atelier/${f}`, root))).VOICE);
  }
  assert.equal(CHAPTERS.length, 12);
  for (const l of ['fr', 'en']) for (const c of CHAPTERS) assert.ok(TITLES[l][c], `${l}/${c}`);
  const check = (it, where, kinds) => {
    assert.ok(kinds.includes(it.kind), `${where}: kind ${it.kind}`);
    assert.ok(typeof it.fr === 'string' && it.fr.trim() && typeof it.en === 'string' && it.en.trim(), `${where}: fr/en`);
    assert.ok(!/[<>]/.test(it.fr + it.en), `${where}: pas de HTML`);
  };
  for (const c of Object.keys(FACTS)) { assert.ok(CHAPTERS.includes(c), c); FACTS[c].forEach((it, k) => check(it, `facts/${c}/${k}`, ['fact', 'measure', 'quote'])); }
  for (const v of voices) {
    assert.ok(['fr', 'en'].includes(v.written), v.agent);
    for (const [c, items] of Object.entries(v.chapters)) { assert.ok(CHAPTERS.includes(c), `${v.agent}/${c}`); items.forEach((it, k) => check(it, `${v.agent}/${c}/${k}`, ['fact', 'measure', 'view'])); }
  }
});
