// PELAGIC — fonctions pures de l'interface (testables sous Node).
// Auteur : CLAUDE.

export const STRENGTH_LIMIT = 2;
export const BEACON_RADIUS = 0.035;
export const HIT_RADIUS = 0.03;

/** Libellés français des types d'éléments. */
export const LABELS = Object.freeze({
  vortex: 'Tourbillon',
  source: 'Source',
  reef: 'Récif',
  beacon: 'Balise',
});

/**
 * Calcule le carré du monde [0,1]² inscrit dans le canevas, avec marge.
 * @returns {{x:number,y:number,size:number}} en pixels physiques
 */
export function fitSquare(width, height, margin = 0) {
  const size = Math.max(1, Math.min(width, height) - margin * 2);
  return { x: (width - size) / 2, y: (height - size) / 2, size };
}

/** Écran → monde normalisé. Retourne null hors du carré. */
export function screenToWorld(rect, sx, sy) {
  const x = (sx - rect.x) / rect.size;
  const y = (sy - rect.y) / rect.size;
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return null;
  return { x, y };
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Trouve l'élément le plus proche du point dans le rayon donné. */
export function nodeAt(nodes, x, y, radius = HIT_RADIUS) {
  let best = null;
  let bestD = radius * radius;
  for (const n of nodes) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/**
 * Ajuste une force par pas, en évitant zéro (un élément sans force est inutile)
 * et en respectant la limite du moteur.
 */
export function nudgeStrength(current, delta) {
  let next = Math.round((current + delta) * 10) / 10;
  next = clamp(next, -STRENGTH_LIMIT, STRENGTH_LIMIT);
  if (Math.abs(next) < 0.1) next = delta > 0 ? 0.1 : -0.1;
  return next;
}

/**
 * Indice de teinte [0, buckets-1] d'une particule selon sa vitesse,
 * en échelle logarithmique (les courants lents restent visibles).
 */
export function speedBucket(speed, buckets = 6, ref = 0.008, span = 30) {
  if (!(speed > 0)) return 0;
  const t = Math.log(speed / ref) / Math.log(span);
  return clamp(Math.floor(clamp(t, 0, 0.9999) * buckets), 0, buckets - 1);
}

/**
 * Compte les particules qui viennent d'entrer dans le rayon d'une balise
 * (dehors à la position précédente, dedans à la position actuelle).
 */
export function crossings(particles, beacon, radius = BEACON_RADIUS) {
  const r2 = radius * radius;
  let count = 0;
  for (const p of particles) {
    const dNow = (p.x - beacon.x) ** 2 + (p.y - beacon.y) ** 2;
    if (dNow > r2) continue;
    const dPrev = (p.px - beacon.x) ** 2 + (p.py - beacon.y) ** 2;
    if (dPrev > r2) count += 1;
  }
  return count;
}

/** Encodage base64url UTF-8 sûr (pour le lien de partage dans le fragment #). */
export function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(code) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]*$/.test(code)) throw new Error('Lien de partage illisible.');
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (code.length % 4)) % 4);
  let bin;
  try {
    bin = atob(b64);
  } catch {
    throw new Error('Lien de partage illisible.');
  }
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** Formate un temps en mm:ss. */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Description d'un élément pour l'infobulle et les lecteurs d'écran. */
export function describeNode(node) {
  const label = LABELS[node.type] ?? node.type;
  const s = Number(node.strength).toFixed(1);
  const where = `${Math.round(node.x * 100)} · ${Math.round(node.y * 100)}`;
  let effect = '';
  if (node.type === 'vortex') effect = node.strength >= 0 ? 'sens antihoraire' : 'sens horaire';
  else if (node.type === 'source') effect = node.strength >= 0 ? 'repousse' : 'aspire';
  else if (node.type === 'reef') effect = 'obstacle';
  else if (node.type === 'beacon') effect = 'chante au passage';
  return `${label} ${s} — ${effect} — ${where}`;
}
