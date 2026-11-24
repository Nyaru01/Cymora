// PELAGIC V2 — quantification rythmique (« la marée »). Auteur : CLAUDE.
// Fonctions pures : le transport (beat courant) vient de score.js
// (advanceTransport) en mode Composer, ou d'une horloge libre en Explorer.

export const TEMPO_MIN = 50;
export const TEMPO_MAX = 140;
export const DEFAULT_TEMPO = 84;

/** Durée d'un temps (noire) en secondes. */
export function beatSeconds(tempo) {
  const t = Number.isFinite(tempo) ? Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, tempo)) : DEFAULT_TEMPO;
  return 60 / t;
}

/**
 * Prochaine ligne de grille à partir d'un beat donné.
 * @param {number} beat position courante en noires
 * @param {number} division subdivisions par noire (2 = croches)
 * @returns {{slot:number, beats:number}} indice de case et distance en noires
 */
export function nextSlot(beat, division = 2) {
  const d = Math.max(1, Math.floor(division));
  const pos = beat * d;
  // Un événement à moins de 2 % d'une case la rejoint immédiatement.
  const slot = pos - Math.floor(pos) < 0.02 ? Math.floor(pos) : Math.ceil(pos);
  return { slot, beats: Math.max(0, slot / d - beat) };
}

/**
 * Délai (s) avant la prochaine case de grille, ou 0 sans quantification.
 */
export function quantizeDelay(beat, tempo, division = 2, enabled = true) {
  if (!enabled) return 0;
  return nextSlot(beat, division).beats * beatSeconds(tempo);
}

/**
 * Accentuation métrique : temps fort de mesure > temps > contretemps.
 * Sert à moduler l'intensité des notes (respiration musicale).
 */
export function accentOf(slot, division = 2, beatsPerBar = 4) {
  const perBar = division * beatsPerBar;
  const inBar = ((slot % perBar) + perBar) % perBar;
  if (inBar === 0) return 1;
  if (inBar % division === 0) return inBar === perBar / 2 ? 0.85 : 0.75;
  return 0.6;
}

/**
 * Compte les particules (vue SoA) entrées dans un disque depuis le pas précédent.
 */
export function crossingsSoA(view, cx, cy, radius) {
  const r2 = radius * radius;
  const { x, y, px, py } = view;
  let count = 0;
  for (let i = 0; i < view.n; i++) {
    const dx = x[i] - cx;
    const dy = y[i] - cy;
    if (dx * dx + dy * dy > r2) continue;
    const ex = px[i] - cx;
    const ey = py[i] - cy;
    if (ex * ex + ey * ey > r2) count += 1;
  }
  return count;
}

export const BEACON_RADIUS = 0.035;
export const beaconRadius = (b) => BEACON_RADIUS * (0.6 + Math.min(2, Math.abs(b.strength)) * 0.4);

/**
 * Chef d'orchestre : écoute les balises et produit des événements de note.
 * Quantifié : une balise joue au plus une note par case de grille, posée sur
 * la case suivante. Libre : délai réfractaire minimal entre deux notes.
 * @param {(y:number, scale:string)=>number} pitchFor
 */
export function createConductor(pitchFor, { division = 2, freeCooldown = 0.14 } = {}) {
  const lastSlot = new Map();
  const lastTime = new Map();
  return {
    reset() {
      lastSlot.clear();
      lastTime.clear();
    },
    /**
     * @param {object[]} nodes éléments du monde
     * @param {object} view particules SoA
     * @param {{beat:number, clock:number, tempo:number, scale:string, quantize:boolean}} t
     * @returns {Array<{key, freq, velocity, pan, voice, delay, slot}>}
     */
    listen(nodes, view, { beat, clock, tempo, scale, quantize }) {
      const events = [];
      for (const b of nodes) {
        if (b.type !== 'beacon' || (b.opacity ?? 1) < 0.35) continue;
        const hits = crossingsSoA(view, b.x, b.y, beaconRadius(b));
        if (!hits) continue;
        const key = b.key ?? b.id;
        let delay = 0;
        let slot = -1;
        let accent = 0.8;
        if (quantize) {
          const next = nextSlot(beat, division);
          if (lastSlot.get(key) === next.slot) continue;
          lastSlot.set(key, next.slot);
          slot = next.slot;
          delay = next.beats * beatSeconds(tempo);
          accent = accentOf(slot, division);
        } else {
          if (clock - (lastTime.get(key) ?? -Infinity) < freeCooldown) continue;
          lastTime.set(key, clock);
        }
        const density = Math.min(1, 0.3 + hits * 0.1);
        const velocity = density * accent * Math.min(1, Math.max(0.25, Math.abs(b.strength))) * (b.opacity ?? 1);
        events.push({ key, freq: pitchFor(b.y, scale), velocity, pan: (b.x - 0.5) * 1.6, voice: b.voice ?? 'glass', delay, slot });
      }
      return events;
    },
  };
}
