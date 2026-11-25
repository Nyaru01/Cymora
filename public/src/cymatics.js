// PELAGIC V3 « Résonance » — matière modale inspirée des figures de Chladni. Auteur : CLAUDE.
// Interprétation artistique (pas une simulation physique exacte) : le geste choisit un mode (m, n).
// Fonctions pures + champ précalculé sur grille (aucune trigonométrie par particule).

const PI = Math.PI;
export const FIELD_RES = 128;

/**
 * Modes (m, n), m − n pair, superposition symétrique, ordonnés par « fréquence » (∝ m² + n²).
 * La famille antisymétrique s'annule toujours sur la diagonale : toutes ses figures
 * se ressemblaient (barre en travers). La famille paire n'impose aucune ligne commune.
 */
export const MODES = (() => {
  const out = [];
  for (let m = 2; m <= 14; m++) for (let n = 0; n < m; n++) if ((m - n) % 2 === 0) out.push([m, n]);
  out.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2) || a[1] - b[1]);
  return Object.freeze(out.slice(0, 36).map((a) => Object.freeze(a)));
})();

export const PITCH_LOW = 82; // Mi2
export const PITCH_HIGH = 880; // La5

/** Fréquence (Hz) → position continue dans MODES (log, bornée). */
export function modeIndex(freq) {
  if (!Number.isFinite(freq) || freq <= 0) return 0;
  const t = Math.log(freq / PITCH_LOW) / Math.log(PITCH_HIGH / PITCH_LOW);
  return Math.min(MODES.length - 1, Math.max(0, t * (MODES.length - 1)));
}

/** Amplitude modale ψ en (x, y) ∈ [0,1]² — superposition symétrique (inspirée de Chladni). */
export function psi(m, n, x, y) {
  return Math.cos(n * PI * x) * Math.cos(m * PI * y) + Math.cos(m * PI * x) * Math.cos(n * PI * y);
}

/** ∇ψ analytique. */
export function gradPsi(m, n, x, y) {
  const cnx = Math.cos(n * PI * x), cmx = Math.cos(m * PI * x), cny = Math.cos(n * PI * y), cmy = Math.cos(m * PI * y);
  const snx = Math.sin(n * PI * x), smx = Math.sin(m * PI * x), sny = Math.sin(n * PI * y), smy = Math.sin(m * PI * y);
  return [
    -n * PI * snx * cmy - m * PI * smx * cny,
    -m * PI * cnx * smy - n * PI * cmx * sny,
  ];
}

/**
 * Champ de dérive précalculé pour un mode : d = −ψ∇ψ / (π(m+n))², plus |ψ|/2 (proximité nodale inversée).
 * @returns {{m:number, n:number, dx:Float32Array, dy:Float32Array, amp:Float32Array}}
 */
export function buildField([m, n], res = FIELD_RES) {
  const size = res * res;
  const dx = new Float32Array(size), dy = new Float32Array(size), amp = new Float32Array(size);
  const norm = 1 / (PI * PI * (m + Math.max(1, n)) * (m + Math.max(1, n)));
  for (let j = 0; j < res; j++) {
    const y = j / (res - 1);
    for (let i = 0; i < res; i++) {
      const x = i / (res - 1);
      const p = psi(m, n, x, y);
      const [gx, gy] = gradPsi(m, n, x, y);
      const k = j * res + i;
      dx[k] = -p * gx * norm;
      dy[k] = -p * gy * norm;
      amp[k] = Math.min(1, Math.abs(p) / 2);
    }
  }
  return { m, n, dx, dy, amp, res };
}

/**
 * Applique la dérive cymatique aux particules (vue SoA de engine.js).
 * Mélange deux champs (glissando) ; allume les grains posés sur une ligne nodale.
 * @param {object} p world.p
 * @param {object} a champ courant, b champ cible (ou null), mix 0..1 vers b
 * @param {number} energy 0..1 (souffle) ; dt secondes
 * @returns {number} nombre de grains allumés par la figure
 */
export function applyCymatics(p, a, b, mix, energy, dt) {
  if (!a || energy <= 0.001 || dt <= 0) return 0;
  const res = a.res, last = res - 1;
  const gain = 2.2 * energy * Math.min(dt, 0.05);
  const wa = b ? 1 - mix : 1, wb = b ? mix : 0;
  let lit = 0;
  for (let i = 0; i < p.n; i++) {
    const gx = Math.min(last - 1e-4, Math.max(0, p.x[i] * last)), gy = Math.min(last - 1e-4, Math.max(0, p.y[i] * last));
    const ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
    const k = iy * res + ix;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    let vx = (a.dx[k] * w00 + a.dx[k + 1] * w10 + a.dx[k + res] * w01 + a.dx[k + res + 1] * w11) * wa;
    let vy = (a.dy[k] * w00 + a.dy[k + 1] * w10 + a.dy[k + res] * w01 + a.dy[k + res + 1] * w11) * wa;
    let amp = (a.amp[k] * w00 + a.amp[k + 1] * w10 + a.amp[k + res] * w01 + a.amp[k + res + 1] * w11) * wa;
    if (wb) {
      vx += (b.dx[k] * w00 + b.dx[k + 1] * w10 + b.dx[k + res] * w01 + b.dx[k + res + 1] * w11) * wb;
      vy += (b.dy[k] * w00 + b.dy[k + 1] * w10 + b.dy[k + res] * w01 + b.dy[k + res + 1] * w11) * wb;
      amp += (b.amp[k] * w00 + b.amp[k + 1] * w10 + b.amp[k + res] * w01 + b.amp[k + res + 1] * w11) * wb;
    }
    p.x[i] = Math.min(1, Math.max(0, p.x[i] + vx * gain * 60));
    p.y[i] = Math.min(1, Math.max(0, p.y[i] + vy * gain * 60));
    // Sur une ligne nodale, le grain s'illumine proportionnellement au souffle.
    if (amp < 0.035) {
      const target = 0.22 + energy * 0.5;
      if (p.light[i] < target) { p.light[i] += (target - p.light[i]) * Math.min(1, dt * 6); lit++; }
    }
  }
  return lit;
}

/** Le doigt chante : hauteur selon y (0 = haut = aigu 880 Hz, 1 = bas = grave 82 Hz), échelle logarithmique. */
export function gestureFreq(y) {
  const t = Math.min(1, Math.max(0, Number.isFinite(y) ? y : 0.5));
  return PITCH_HIGH * (PITCH_LOW / PITCH_HIGH) ** t;
}

/**
 * Lignes nodales (ψ = 0) d'un mode, par carrés marchants : segments [x1,y1,x2,y2,…] dans [0,1]².
 * Sert à déposer la « rémanence » : le dessin fixe de la figure tenue.
 */
export function nodalSegments([m, n], res = 72) {
  const v = new Float32Array((res + 1) * (res + 1));
  for (let j = 0; j <= res; j++) for (let i = 0; i <= res; i++) v[j * (res + 1) + i] = psi(m, n, i / res, j / res);
  const out = [];
  const lerp = (a, b) => (a === b ? 0.5 : a / (a - b));
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const a = v[j * (res + 1) + i], b = v[j * (res + 1) + i + 1];
      const c = v[(j + 1) * (res + 1) + i + 1], d = v[(j + 1) * (res + 1) + i];
      const pts = [];
      if ((a > 0) !== (b > 0)) pts.push([(i + lerp(a, b)) / res, j / res]);
      if ((b > 0) !== (c > 0)) pts.push([(i + 1) / res, (j + lerp(b, c)) / res]);
      if ((d > 0) !== (c > 0)) pts.push([(i + lerp(d, c)) / res, (j + 1) / res]);
      if ((a > 0) !== (d > 0)) pts.push([i / res, (j + lerp(a, d)) / res]);
      if (pts.length >= 2) out.push(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      if (pts.length === 4) out.push(pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
    }
  }
  return Float32Array.from(out);
}
