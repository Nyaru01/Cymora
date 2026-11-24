// DUO — couche bilingue commune (FR/EN). Auteur : CLAUDE. Sans dépendance.
//
// Contrat :
//   const i18n = createI18n({ fr: {...}, en: {...} });
//   i18n.lang            → 'fr' | 'en'
//   i18n.t('clé', {n:3}) → texte, avec remplacement de {n} ; clé manquante → clé FR → la clé elle-même
//   i18n.apply(root)     → [data-i18n] → textContent ; [data-i18n-html] → innerHTML (textes de confiance seulement) ;
//                          [data-i18n-attr="aria-label:clé;title:clé2"] → attributs ; <html lang>
//   i18n.set('en')       → mémorise (localStorage 'duo.lang'), réapplique, prévient les abonnés
//   i18n.onChange(fn)    → fn(lang) à chaque changement
//   mountLangSwitch(el, i18n) → deux boutons FR / EN, aria-pressed
// La préférence reste sur l'appareil. Rien n'est envoyé nulle part.

export const LANGS = ['fr', 'en'];
export const STORAGE_KEY = 'duo.lang';

/** Choix de langue pur : préférence mémorisée, sinon langues du navigateur, sinon anglais. */
export function pickLang(stored, languages = []) {
  if (LANGS.includes(stored)) return stored;
  for (const l of languages) {
    const base = String(l || '').toLowerCase().split('-')[0];
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

/** Résolution pure d'une clé, avec repli sur le français puis sur la clé. */
export function translate(dict, lang, key, vars) {
  const raw = dict?.[lang]?.[key] ?? dict?.fr?.[key] ?? key;
  if (!vars) return raw;
  return String(raw).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function readStored() {
  try { return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null; } catch { return null; }
}

function writeStored(lang) {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, lang); } catch { /* stockage interdit : la langue vaut pour la séance */ }
}

export function createI18n(dict) {
  const nav = globalThis.navigator;
  const url = globalThis.location ? new URLSearchParams(globalThis.location.search).get('lang') : null;
  let lang = pickLang(LANGS.includes(url) ? url : readStored(), nav?.languages ?? [nav?.language]);
  // Une langue explicitement demandée par le lien devient la préférence : la page suivante la garde.
  if (LANGS.includes(url)) writeStored(url);
  const subs = new Set();
  const api = {
    get lang() { return lang; },
    t: (key, vars) => translate(dict, lang, key, vars),
    apply(root = globalThis.document) {
      if (!root) return;
      const doc = root.ownerDocument || root;
      if (doc.documentElement) doc.documentElement.lang = lang;
      for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = api.t(el.dataset.i18n);
      for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = api.t(el.dataset.i18nHtml);
      for (const el of root.querySelectorAll('[data-i18n-attr]')) {
        for (const pair of el.dataset.i18nAttr.split(';')) {
          const [attr, key] = pair.split(':').map((s) => s.trim());
          if (attr && key) el.setAttribute(attr, api.t(key));
        }
      }
    },
    set(next) {
      if (!LANGS.includes(next) || next === lang) return;
      lang = next;
      writeStored(lang);
      api.apply();
      for (const fn of subs) fn(lang);
    },
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  return api;
}

/** Sélecteur FR / EN identique sur toutes les pages. */
export function mountLangSwitch(el, i18n) {
  if (!el) return;
  el.classList.add('lang-switch');
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', i18n.lang === 'fr' ? 'Langue' : 'Language');
  el.replaceChildren(...LANGS.map((l) => {
    const b = globalThis.document.createElement('button');
    b.type = 'button';
    b.lang = l;
    b.textContent = l.toUpperCase();
    b.setAttribute('aria-label', l === 'fr' ? 'Français' : 'English');
    b.addEventListener('click', () => i18n.set(l));
    return b;
  }));
  const sync = (lang) => {
    for (const b of el.children) b.setAttribute('aria-pressed', String(b.lang === lang));
    el.setAttribute('aria-label', lang === 'fr' ? 'Langue' : 'Language');
  };
  sync(i18n.lang);
  i18n.onChange(sync);
}
