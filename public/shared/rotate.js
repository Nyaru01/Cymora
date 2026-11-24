// DUO — invitation à tourner le téléphone. Auteur : CLAUDE.
// Visible seulement en portrait étroit (CSS, rotate.css) ; aucun verrou d'orientation ;
// le visiteur peut toujours continuer en portrait. Le choix vaut pour la séance.

const KEY = 'duo.portrait-ok';
const TEXT = {
  fr: { title: 'Tournez votre téléphone', body: 'Cette œuvre se joue à l’horizontale.', go: 'Continuer ainsi', back: 'Retour à l’exposition' },
  en: { title: 'Turn your phone', body: 'This work is played in landscape.', go: 'Continue anyway', back: 'Back to the exhibition' },
};

export function mountRotateInvite({ i18n, home = '../../' } = {}) {
  const doc = globalThis.document;
  if (!doc) return null;
  try { if (sessionStorage.getItem(KEY)) return null; } catch { /* séance sans stockage */ }
  const el = doc.createElement('div');
  el.className = 'rotate-invite';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');
  el.innerHTML = `
    <svg class="rotate-invite__glyph" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="22" y="8" width="20" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
      <rect x="12" y="34" width="36" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2" class="rotate-invite__to"/>
      <path d="M50 20a14 14 0 0 1 -2 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M45 34l3 3 3-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <p class="rotate-invite__title"></p>
    <p class="rotate-invite__body"></p>
    <div class="rotate-invite__actions"><button type="button" class="rotate-invite__go"></button><a class="rotate-invite__back"></a></div>`;
  const back = el.querySelector('.rotate-invite__back');
  back.href = home;
  const paint = (lang) => {
    const t = TEXT[lang] || TEXT.en;
    el.querySelector('.rotate-invite__title').textContent = t.title;
    el.querySelector('.rotate-invite__body').textContent = t.body;
    el.querySelector('.rotate-invite__go').textContent = t.go;
    back.textContent = t.back;
    el.setAttribute('aria-label', t.title);
  };
  paint(i18n?.lang || 'en');
  i18n?.onChange(paint);
  el.querySelector('.rotate-invite__go').addEventListener('click', () => {
    try { sessionStorage.setItem(KEY, '1'); } catch { /* idem */ }
    el.remove();
  });
  doc.body.append(el);
  return el;
}
