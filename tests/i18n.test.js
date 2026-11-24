// G5 — couche bilingue commune. Auteur : CLAUDE.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickLang, translate, createI18n } from '../public/shared/i18n.js';

test('pickLang : préférence mémorisée, puis navigateur, puis anglais', () => {
  assert.equal(pickLang('fr', ['en-US']), 'fr');
  assert.equal(pickLang(null, ['de-DE', 'fr-CA', 'en']), 'fr');
  assert.equal(pickLang('xx', ['en-GB']), 'en');
  assert.equal(pickLang(null, ['ja']), 'en');
  assert.equal(pickLang(null, [undefined]), 'en');
});

test('translate : repli sur le français puis sur la clé, variables remplacées', () => {
  const d = { fr: { a: 'tour {n}', only: 'seulement fr' }, en: { a: 'turn {n}' } };
  assert.equal(translate(d, 'en', 'a', { n: 3 }), 'turn 3');
  assert.equal(translate(d, 'en', 'only'), 'seulement fr');
  assert.equal(translate(d, 'en', 'missing'), 'missing');
  assert.equal(translate(d, 'fr', 'a', {}), 'tour {n}');
});

test('createI18n fonctionne sans DOM ni stockage, et prévient les abonnés', () => {
  const i = createI18n({ fr: { x: 'oui' }, en: { x: 'yes' } });
  const seen = [];
  i.onChange((l) => seen.push(l));
  const other = i.lang === 'fr' ? 'en' : 'fr';
  i.set(other);
  assert.equal(i.lang, other);
  assert.deepEqual(seen, [other]);
  i.set('de');
  assert.equal(i.lang, other, 'langue inconnue ignorée');
});
