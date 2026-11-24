// PELAGIC — Atlas : compositions de départ, chacune pensée pour être écoutée.
// Auteur : CLAUDE. Chaque entrée est au format d'export du moteur (version 1)
// et passe par deserializeWorld : aucune donnée n'échappe à la validation.

/** Profondeurs donnant des notes de la gamme (cf. audio.pitchForDepth). */
const NOTE_Y = (step) => 1 - step / 14; // step 0 = La2 … 14 = Mi5

export const ATLAS = Object.freeze([
  {
    id: 'gyre',
    name: 'Le Gyre',
    hint: 'Deux tourbillons contraires se passent le plancton. Écoutez l’accord qui revient en boucle.',
    seed: 7,
    settings: { speed: 1.4, turbulence: 0.25, count: 2200 },
    nodes: [
      { type: 'vortex', x: 0.33, y: 0.5, strength: 1.4 },
      { type: 'vortex', x: 0.67, y: 0.5, strength: -1.4 },
      { type: 'beacon', x: 0.5, y: NOTE_Y(7), strength: 1 },
      { type: 'beacon', x: 0.33, y: NOTE_Y(11), strength: 0.8 },
      { type: 'beacon', x: 0.67, y: NOTE_Y(4), strength: 0.8 },
    ],
  },
  {
    id: 'detroit',
    name: 'Le Détroit',
    hint: 'Des récifs resserrent le courant dans un chenal. Les balises alignées jouent une gamme descendante.',
    seed: 1903,
    settings: { speed: 1.8, turbulence: 0.35, count: 2600 },
    nodes: [
      { type: 'reef', x: 0.45, y: 0.22, strength: 1.6 },
      { type: 'reef', x: 0.5, y: 0.32, strength: 1.4 },
      { type: 'reef', x: 0.45, y: 0.78, strength: 1.6 },
      { type: 'reef', x: 0.5, y: 0.68, strength: 1.4 },
      { type: 'source', x: 0.08, y: 0.5, strength: 0.8 },
      { type: 'beacon', x: 0.62, y: NOTE_Y(9), strength: 0.7 },
      { type: 'beacon', x: 0.7, y: NOTE_Y(8), strength: 0.7 },
      { type: 'beacon', x: 0.78, y: NOTE_Y(7), strength: 0.7 },
      { type: 'beacon', x: 0.86, y: NOTE_Y(5), strength: 0.7 },
    ],
  },
  {
    id: 'fontaine',
    name: 'La Fontaine abyssale',
    hint: 'Une source jaillit du fond ; une couronne de balises égrène un arpège à chaque bouffée.',
    seed: 314,
    settings: { speed: 1.2, turbulence: 0.15, count: 1800 },
    nodes: [
      { type: 'source', x: 0.5, y: 0.62, strength: 1.2 },
      ...[0, 1, 2, 3, 4, 5].map((i) => {
        const a = -Math.PI / 2 + (i - 2.5) * 0.42;
        const x = Math.round((0.5 + Math.cos(a) * 0.24) * 1000) / 1000;
        const y = Math.round((0.62 + Math.sin(a) * 0.24) * 1000) / 1000;
        return { type: 'beacon', x, y, strength: 0.9 };
      }),
    ],
  },
  {
    id: 'puits',
    name: 'Le Puits',
    hint: 'Un puits aspire tout. Le plancton spirale vers le centre et traverse les balises de plus en plus vite.',
    seed: 99,
    settings: { speed: 1, turbulence: 0.5, count: 3000 },
    nodes: [
      { type: 'source', x: 0.5, y: 0.5, strength: -1.2 },
      { type: 'vortex', x: 0.5, y: 0.5, strength: 0.9 },
      { type: 'beacon', x: 0.5, y: 0.28, strength: 0.8 },
      { type: 'beacon', x: 0.72, y: 0.5, strength: 0.8 },
      { type: 'beacon', x: 0.5, y: 0.72, strength: 0.8 },
      { type: 'beacon', x: 0.28, y: 0.5, strength: 0.8 },
    ],
  },
  {
    id: 'allee',
    name: 'L’Allée des tourbillons',
    hint: 'Une rangée de tourbillons alternés, comme derrière un rocher. Le rythme naît de leur alternance.',
    seed: 1911,
    settings: { speed: 1.6, turbulence: 0.2, count: 2400 },
    nodes: [
      { type: 'reef', x: 0.12, y: 0.5, strength: 2 },
      ...[0, 1, 2, 3].map((i) => ({
        type: 'vortex',
        x: 0.28 + i * 0.18,
        y: i % 2 ? 0.58 : 0.42,
        strength: i % 2 ? -1.1 : 1.1,
      })),
      ...[0, 1, 2, 3].map((i) => ({
        type: 'beacon',
        x: 0.37 + i * 0.18,
        y: NOTE_Y([6, 9, 7, 11][i]),
        strength: 0.6,
      })),
    ],
  },
  {
    id: 'page-blanche',
    name: 'Page blanche',
    hint: 'Un océan sans aucun élément. À vous de composer.',
    seed: 42,
    settings: { speed: 1, turbulence: 0.45, count: 1800 },
    nodes: [],
  },
]);

/** Convertit une entrée de l'Atlas au format d'import du moteur. */
export function atlasToJson(entry) {
  return JSON.stringify({ version: 1, seed: entry.seed, nodes: entry.nodes, settings: entry.settings });
}

/** Construit un aperçu SVG (éléments DOM, compatible CSP) d'une entrée. */
export function atlasPreview(entry, doc = globalThis.document) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('atlas__preview');
  for (const n of entry.nodes) {
    const g = doc.createElementNS(NS, 'circle');
    g.setAttribute('cx', String(n.x * 100));
    g.setAttribute('cy', String(n.y * 100));
    g.setAttribute('r', n.type === 'beacon' ? '3' : String(4 + Math.abs(n.strength) * 2.5));
    g.setAttribute('class', `atlas__dot atlas__dot--${n.type}${n.strength < 0 ? ' is-neg' : ''}`);
    svg.append(g);
  }
  return svg;
}
