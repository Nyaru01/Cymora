// ATELIER — rendu de la page éditoriale. Auteur : CLAUDE.
// Un chapitre = des faits sourcés (facts.js) puis deux voix séparées (voice-codex.js, voice-claude.js).
// Tout est inséré en texte (textContent) : aucune voix ne peut injecter de HTML dans la page.

import { createI18n, mountLangSwitch } from '../shared/i18n.js';
import { CHAPTERS, TITLES, FACTS } from './facts.js';
import { VOICE as CLAUDE } from './voice-claude.js';

let CODEX = { agent: 'CODEX', written: 'fr', chapters: {} };
try { ({ VOICE: CODEX } = await import('./voice-codex.js')); } catch { /* voix absente : le chapitre le dit */ }

const UI = {
  fr: {
    skip: 'Aller au texte', 'home.label': 'Retour à l’exposition QUATRE', 'nav.label': 'Publication', reports: 'Les deux regards',
    'toc.label': 'Chapitres', kicker: 'La fabrication', title: 'Comment deux agents ont fabriqué quatre œuvres',
    lede: 'Ce qui suit est tiré des journaux, des décisions, des commits et des rapports du dépôt. Chaque chapitre commence par des faits sourcés, puis chaque agent parle en son nom. Nous n’avons reconstitué aucune conversation.',
    'key.label': 'Nature des passages', 'key.fact': 'vérifiable dans le dépôt', 'key.measure': 'chiffre obtenu en exécutant le code',
    'key.quote': 'texte exact d’une consigne', 'key.view': 'interprétation de l’agent qui signe',
    'kind.fact': 'fait', 'kind.measure': 'mesure', 'kind.quote': 'citation', 'kind.view': 'point de vue',
    facts: 'Les faits', silent: '{agent} n’a rien écrit pour ce chapitre.', translated: 'traduit du {lang} par l’auteur', source: 'source',
    'lang.fr': 'français', 'lang.en': 'anglais', voice: 'La voix de {agent}',
    end: 'Les rapports sont publiés séparément et leurs traductions sont identifiées. Les journaux privés restent sur le poste de création ; docs/PUBLIC-HISTORY.md explique les sources publiques et les expurgations.',
    'end.back': 'Revenir aux œuvres', 'meta.title': 'La fabrication — QUATRE',
  },
  en: {
    skip: 'Skip to text', 'home.label': 'Back to the QUATRE exhibition', 'nav.label': 'Publication', reports: 'Two perspectives',
    'toc.label': 'Chapters', kicker: 'The making', title: 'How two agents made four works',
    lede: 'What follows is drawn from the repository’s journals, decisions, commits and reports. Each chapter starts with sourced facts, then each agent speaks in its own name. No conversation has been reconstructed.',
    'key.label': 'Kinds of passage', 'key.fact': 'verifiable in the repository', 'key.measure': 'a figure obtained by running the code',
    'key.quote': 'the exact text of a brief', 'key.view': 'the signing agent’s interpretation',
    'kind.fact': 'fact', 'kind.measure': 'measure', 'kind.quote': 'quote', 'kind.view': 'view',
    facts: 'The facts', silent: '{agent} wrote nothing for this chapter.', translated: 'translated from {lang} by the author', source: 'source',
    'lang.fr': 'French', 'lang.en': 'English', voice: '{agent}’s voice',
    end: 'The original reports, in French, remain unchanged in the repository. Their translations are marked as such.',
    'end.back': 'Back to the works', 'meta.title': 'The making — QUATRE',
  },
};

const i18n = createI18n(UI);
const t = i18n.t;
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function entry(item, lang, written, isQuote) {
  const li = el('li', `entry entry--${item.kind}`);
  li.append(el('span', `tag tag--${item.kind}`, t(`kind.${item.kind}`)));
  const body = el(isQuote ? 'blockquote' : 'p', 'entry__text', item[lang] ?? item.fr);
  if (isQuote && lang !== 'fr') body.lang = 'en';
  li.append(body);
  const meta = [];
  if (isQuote && lang === 'en') meta.push(t('translated', { lang: t('lang.fr') }));
  if (!isQuote && written && written !== lang) meta.push(t('translated', { lang: t(`lang.${written}`) }));
  if (item.source) meta.push(`${t('source')} : ${item.source}`);
  if (meta.length) li.append(el('p', 'entry__meta', meta.join(' · ')));
  return li;
}

function voice(v, id, lang) {
  const box = el('section', `voice voice--${v.agent.toLowerCase()}`);
  box.append(el('h3', 'voice__name', t('voice', { agent: v.agent })));
  const items = v.chapters?.[id] ?? [];
  if (!items.length) { box.append(el('p', 'voice__silent', t('silent', { agent: v.agent }))); return box; }
  const ol = el('ol', 'entries');
  for (const it of items) ol.append(entry(it, lang, v.written, false));
  box.append(ol);
  return box;
}

function render() {
  const lang = i18n.lang;
  document.title = t('meta.title');
  const root = document.querySelector('#chapters');
  const toc = document.querySelector('#toc');
  root.replaceChildren();
  const tocList = el('ol', 'toc__list');
  CHAPTERS.forEach((id, k) => {
    const sec = el('section', 'chapter');
    sec.id = id;
    sec.setAttribute('aria-labelledby', `h-${id}`);
    const h = el('h2', 'chapter__title');
    h.id = `h-${id}`;
    h.append(el('span', 'chapter__num', String(k + 1).padStart(2, '0')), document.createTextNode(TITLES[lang][id]));
    sec.append(h);
    const facts = FACTS[id] ?? [];
    if (facts.length) {
      const f = el('div', 'facts');
      f.append(el('h3', 'facts__title', t('facts')));
      const ol = el('ol', 'entries');
      for (const it of facts) ol.append(entry(it, lang, 'fr', it.kind === 'quote'));
      f.append(ol);
      sec.append(f);
    }
    const voices = el('div', 'voices');
    voices.append(voice(CODEX, id, lang), voice(CLAUDE, id, lang));
    sec.append(voices);
    root.append(sec);
    const a = el('a', null, TITLES[lang][id]);
    a.href = `#${id}`;
    a.prepend(el('span', 'toc__num', String(k + 1).padStart(2, '0')));
    const li = el('li');
    li.append(a);
    tocList.append(li);
  });
  toc.replaceChildren(tocList);
  watch();
}

let observer;
function watch() {
  observer?.disconnect();
  if (!('IntersectionObserver' in window)) return;
  const links = new Map([...document.querySelectorAll('.toc a')].map((a) => [a.hash.slice(1), a]));
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      for (const a of links.values()) a.removeAttribute('aria-current');
      links.get(e.target.id)?.setAttribute('aria-current', 'true');
    }
  }, { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('.chapter').forEach((s) => observer.observe(s));
}

i18n.apply();
mountLangSwitch(document.querySelector('#lang'), i18n);
render();
i18n.onChange(render);
if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
