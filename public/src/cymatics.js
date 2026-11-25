// CYMORA — matière modale d'une plaque circulaire (figures de Chladni). Auteur : CLAUDE.
// Interprétation artistique, pas une simulation exacte : une note choisit un mode (n, k) ;
// sa forme superpose un mode à n diamètres nodaux, J_n(a·r)·cos(nθ), et un mode radial
// J_0(b·r). Leur somme dessine des rosaces, des pétales et des anneaux, et le bord de la
// plaque est toujours une ligne de repos. Champ précalculé sur grille : aucune trigonométrie
// par particule pendant l'animation.

const PI = Math.PI;
export const FIELD_RES = 160;
const PLATE = 0.47; // rayon de la plaque dans le champ [0,1]²
const CX = 0.5;
const CY = 0.5;

/** J_n(x) par l'intégrale de Bessel (règle de Simpson, précise à 1e-6 pour x < 40). */
export function besselJ(n, x) {
  const N = 128;
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const tau = (PI * i) / N;
    const w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2;
    s += w * Math.cos(n * tau - x * Math.sin(tau));
  }
  return (s * (PI / N)) / 3 / PI;
}

// Tables de J_n sur [0, 40] (pas 0.005) : le champ se calcule sans intégrale par point.
const TABLE_STEP = 0.005;
const TABLE_MAX = 40;
const TABLES = new Map();
function jn(n, x) {
  let t = TABLES.get(n);
  if (!t) {
    t = new Float64Array(Math.ceil(TABLE_MAX / TABLE_STEP) + 3);
    for (let i = 0; i < t.length; i++) t[i] = besselJ(n, i * TABLE_STEP);
    TABLES.set(n, t);
  }
  // Interpolation de Catmull-Rom : valeur et pente continues, donc un gradient propre.
  const f = Math.min(TABLE_MAX, Math.max(0, x)) / TABLE_STEP;
  const i = Math.min(t.length - 3, f | 0);
  const u = f - i;
  const p0 = t[Math.max(0, i - 1)], p1 = t[i], p2 = t[i + 1], p3 = t[i + 2];
  return p1 + 0.5 * u * (p2 - p0 + u * (2 * p0 - 5 * p1 + 4 * p2 - p3 + u * (3 * (p1 - p2) + p3 - p0)));
}

/** k-ième zéro positif de J_n (recherche par pas puis dichotomie). */
export function besselZero(n, k) {
  let found = 0;
  let a = Math.max(0.5, n * 0.9);
  let fa = besselJ(n, a);
  for (let x = a + 0.05; x < 80; x += 0.05) {
    const fx = besselJ(n, x);
    if (fa * fx < 0) {
      let lo = x - 0.05;
      let hi = x;
      for (let it = 0; it < 40; it++) {
        const mid = (lo + hi) / 2;
        if (besselJ(n, lo) * besselJ(n, mid) <= 0) hi = mid; else lo = mid;
      }
      if (++found === k) return (lo + hi) / 2;
    }
    fa = fx;
    a = x;
  }
  throw new Error(`Zéro de Bessel introuvable (${n}, ${k}).`);
}

/**
 * Modes [n, k] : n diamètres nodaux (pétales), k anneaux. Ordonnés du plus grave au plus aigu
 * selon le zéro de Bessel a(n,k), comme les fréquences propres d'une membrane circulaire.
 */
export const MODES = (() => {
  const out = [];
  for (let n = 0; n <= 9; n++) for (let k = 1; k <= 4; k++) out.push([n, k, besselZero(n, k)]);
  out.sort((p, q) => p[2] - q[2]);
  return Object.freeze(out.filter(([n, k]) => !(n === 0 && k === 1) && !(n === 1)).slice(0, 36).map(([n, k]) => Object.freeze([n, k])));
})();

const ZEROS = new Map();
function zero(n, k) {
  const key = `${n}:${k}`;
  if (!ZEROS.has(key)) ZEROS.set(key, besselZero(n, k));
  return ZEROS.get(key);
}

export const PITCH_LOW = 82; // Mi2
export const PITCH_HIGH = 880; // La5

/** Fréquence (Hz) → position continue dans MODES (log, bornée). */
export function modeIndex(freq) {
  if (!Number.isFinite(freq) || freq <= 0) return 0;
  const t = Math.log(freq / PITCH_LOW) / Math.log(PITCH_HIGH / PITCH_LOW);
  return Math.min(MODES.length - 1, Math.max(0, t * (MODES.length - 1)));
}

/** Poids du mode radial : il courbe les diamètres en pétales. */
const RING = (n) => (n === 0 ? 0 : 0.42 + 0.06 * (n % 3));

const FILL = 0.93; // la figure s'arrête juste avant le bord : le bord n'aspire pas la matière

function inside(n, k, r, theta) {
  const a = zero(n, k) * FILL;
  const petals = jn(n, a * r) * Math.cos(n * theta);
  if (n === 0) return petals;
  return petals + RING(n) * jn(0, zero(0, k + 1) * FILL * r);
}

/**
 * Amplitude ψ en (x, y) ∈ [0,1]². Hors de la plaque, |ψ| croît : la matière y est repoussée vers l'intérieur.
 * L'axe de symétrie est vertical : les figures se tiennent debout.
 */
export function psi(n, k, x, y) {
  const dx = (x - CX) / PLATE;
  const dy = (y - CY) / PLATE;
  const r = Math.hypot(dx, dy);
  const theta = Math.atan2(dy, dx) + PI / 2;
  if (r < 1) return inside(n, k, r, theta);
  const edge = inside(n, k, 1, theta);
  return (Math.sign(edge) || 1) * (Math.abs(edge) + (r - 1) * 1.5);
}

/** ∇ψ par différences centrées (la forme est trop riche pour une dérivée analytique lisible). */
export function gradPsi(n, k, x, y) {
  const h = 1e-4;
  return [(psi(n, k, x + h, y) - psi(n, k, x - h, y)) / (2 * h), (psi(n, k, x, y + h) - psi(n, k, x, y - h)) / (2 * h)];
}

/**
 * Champ précalculé pour un mode : ψ normalisé et son gradient, sur une grille.
 * La dérive (−ψ∇ψ) est calculée au moment de l'appliquer, après le mélange de deux modes :
 * mélanger les formes, et non les dérives, garde des lignes pendant un glissando
 * (deux dérives mêlées ne s'annulent qu'aux croisements, et la matière s'y entasse en points).
 * @returns {{m:number, n:number, v:Float32Array, gx:Float32Array, gy:Float32Array, scale:number, res:number}}
 */
export function buildField([n, k], res = FIELD_RES) {
  const size = res * res;
  const v = new Float32Array(size);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) v[j * res + i] = psi(n, k, i / (res - 1), j / (res - 1));
  let peak = 1e-6;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = i / (res - 1) - CX, y = j / (res - 1) - CY;
      if (Math.hypot(x, y) < PLATE) peak = Math.max(peak, Math.abs(v[j * res + i]));
    }
  }
  const gx = new Float32Array(size);
  const gy = new Float32Array(size);
  const step = 1 / (res - 1);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const c = j * res + i;
      const l = v[j * res + Math.max(0, i - 1)];
      const r = v[j * res + Math.min(res - 1, i + 1)];
      const u = v[Math.max(0, j - 1) * res + i];
      const d = v[Math.min(res - 1, j + 1) * res + i];
      gx[c] = (r - l) / (2 * step) / peak;
      gy[c] = (d - u) / (2 * step) / peak;
    }
  }
  for (let c = 0; c < size; c++) v[c] /= peak;
  // Les modes aigus ont des gradients plus raides : on les ramène à une vitesse comparable.
  const scale = (1 / (zero(n, k) + 2)) ** 2 * 0.55;
  return { m: n, n: k, v, gx, gy, scale, res };
}

/**
 * Applique la dérive cymatique aux particules (vue SoA de engine.js).
 * Mélange deux formes (glissando) ; allume les grains posés sur une ligne nodale.
 * @returns {number} nombre de grains allumés par la figure
 */
export function applyCymatics(p, a, b, mix, energy, dt) {
  if (!a || energy <= 0.001 || dt <= 0) return 0;
  const res = a.res;
  const last = res - 1;
  const gain = 132 * energy * Math.min(dt, 0.05);
  const wa = b ? 1 - mix : 1;
  const wb = b ? mix : 0;
  const scale = a.scale * wa + (b ? b.scale * wb : 0);
  const target = 0.2 + energy * 0.45;
  const glow = Math.min(1, dt * 6);
  let lit = 0;
  for (let i = 0; i < p.n; i++) {
    const gxp = Math.min(last - 1e-4, Math.max(0, p.x[i] * last));
    const gyp = Math.min(last - 1e-4, Math.max(0, p.y[i] * last));
    const ix = gxp | 0;
    const iy = gyp | 0;
    const fx = gxp - ix;
    const fy = gyp - iy;
    const k = iy * res + ix;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    let v = (a.v[k] * w00 + a.v[k + 1] * w10 + a.v[k + res] * w01 + a.v[k + res + 1] * w11) * wa;
    let gx = (a.gx[k] * w00 + a.gx[k + 1] * w10 + a.gx[k + res] * w01 + a.gx[k + res + 1] * w11) * wa;
    let gy = (a.gy[k] * w00 + a.gy[k + 1] * w10 + a.gy[k + res] * w01 + a.gy[k + res + 1] * w11) * wa;
    if (wb) {
      v += (b.v[k] * w00 + b.v[k + 1] * w10 + b.v[k + res] * w01 + b.v[k + res + 1] * w11) * wb;
      gx += (b.gx[k] * w00 + b.gx[k + 1] * w10 + b.gx[k + res] * w01 + b.gx[k + res + 1] * w11) * wb;
      gy += (b.gy[k] * w00 + b.gy[k + 1] * w10 + b.gy[k + res] * w01 + b.gy[k + res + 1] * w11) * wb;
    }
    const vx = -v * gx * scale;
    const vy = -v * gy * scale;
    const amp = Math.min(1, Math.abs(v));
    // Une légère glissade le long de la ligne (perpendiculaire au gradient) étire les grains en filaments
    // au lieu de les entasser aux croisements.
    const slide = 0.18 * Math.max(0, 1 - amp * 8);
    p.x[i] = Math.min(1, Math.max(0, p.x[i] + (vx - vy * slide) * gain));
    p.y[i] = Math.min(1, Math.max(0, p.y[i] + (vy + vx * slide) * gain));
    if (amp < 0.05 && p.light[i] < target) {
      p.light[i] += (target - p.light[i]) * glow;
      lit++;
    }
  }
  return lit;
}

/** Le doigt chante : hauteur selon y (0 = haut = aigu 880 Hz, 1 = bas = grave 82 Hz), échelle logarithmique. */
export function gestureFreq(y) {
  const t = Math.min(1, Math.max(0, Number.isFinite(y) ? y : 0.5));
  return PITCH_HIGH * (PITCH_LOW / PITCH_HIGH) ** t;
}

/** Lignes nodales (ψ = 0) d'un mode, par carrés marchants : segments [x1,y1,x2,y2,…] dans [0,1]². */
export function nodalSegments([n, k], res = 72) {
  const v = new Float32Array((res + 1) * (res + 1));
  for (let j = 0; j <= res; j++) for (let i = 0; i <= res; i++) v[j * (res + 1) + i] = psi(n, k, i / res, j / res);
  const out = [];
  const lerp = (a, b) => (a === b ? 0.5 : a / (a - b));
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const a = v[j * (res + 1) + i], b = v[j * (res + 1) + i + 1];
      const c = v[(j + 1) * (res + 1) + i + 1], d = v[(j + 1) * (res + 1) + i];
      const mx = (i + 0.5) / res - CX, my = (j + 0.5) / res - CY;
      if (Math.hypot(mx, my) > PLATE * 0.995) continue; // le dessin s'arrête au bord de la plaque
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
