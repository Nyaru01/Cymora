// CYMORA — le cœur du jeu. Auteur : CLAUDE.
// La matière chante un motif ; on lui répond d'un geste. La hauteur du geste est une note
// (en haut : aigu). On mesure l'accord entre les deux contours, sans juger le tempo :
// une réponse lente ou rapide peut être juste. Tout est déterministe et sans dépendance.

/** Pentatonique de la mineur sur deux octaves (La3 → La5) : aucune note ne peut sonner faux. */
const STEPS = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
export const DEGREES = STEPS.length; // 11
const BASE_MIDI = 57; // La3, 220 Hz
const MARGIN = 0.1; // la gamme occupe le champ sans toucher les bords

export const PASS = 0.6; // « presque à l'unisson » : on avance
export const RESONANCE = 0.8; // « en résonance » : la matière se cristallise
export const MOTIFS_PER_TIDE = 5;

/**
 * Les quatre marées : on apprend d'abord à voir le chant, puis à le suivre,
 * à s'en souvenir, enfin à l'entendre sans aucun tracé.
 * guide : 'always' (tracé visible pendant la réponse), 'call' (visible pendant le chant, s'efface
 * quand on répond), 'glimpse' (à peine esquissé pendant le chant), 'none' (le son et la forme seuls).
 */
export const TIDES = Object.freeze([
  { id: 'see', notes: [2, 3], guide: 'always', span: 3 },
  { id: 'follow', notes: [3, 4], guide: 'call', span: 4 },
  { id: 'remember', notes: [4, 5], guide: 'glimpse', span: 4 },
  { id: 'listen', notes: [3, 5], guide: 'none', span: 5 },
]);

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;

export function degreeFreq(k) {
  const i = clamp(Math.round(k), 0, DEGREES - 1);
  return 440 * 2 ** ((BASE_MIDI + STEPS[i] - 69) / 12);
}

/** Hauteur à l'écran d'un degré (0 = grave, en bas). */
export function degreeY(k) {
  return 1 - MARGIN - (clamp(k, 0, DEGREES - 1) / (DEGREES - 1)) * (1 - 2 * MARGIN);
}

/** Degré continu correspondant à une hauteur à l'écran. */
export function yDegree(y) {
  return clamp(((1 - MARGIN - y) / (1 - 2 * MARGIN)) * (DEGREES - 1), 0, DEGREES - 1);
}

/** Note la plus proche d'une hauteur à l'écran (pour faire chanter le doigt). */
export function yFreq(y) {
  return degreeFreq(Math.round(yDegree(y)));
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}

/**
 * Un motif : quelques notes lentes, reliées par des pas proches, jamais immobile.
 * @returns {{seed:number, notes:{deg:number, at:number, dur:number}[], duration:number}}
 */
export function motif(seed, count, span = 4) {
  // Un motif trop resserré se confond avec une ligne plate : on en tire un autre, déterministe.
  for (let attempt = 0; attempt < 32; attempt++) {
    const m = draw(seed, attempt, count, span);
    const degs = m.notes.map((n) => n.deg);
    if (Math.max(...degs) - Math.min(...degs) >= MIN_RANGE) return m;
  }
  return draw(seed, 0, count, span);
}

const MIN_RANGE = 3;

function draw(seed, attempt, count, span) {
  const r = rng(seed + attempt * 0x9e3779b1);
  const n = clamp(Math.round(count), 2, 8);
  const lo = 1;
  const hi = DEGREES - 2;
  let deg = 3 + Math.floor(r() * 5);
  const notes = [];
  let at = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      let step = 0;
      while (step === 0) {
        const mag = 1 + Math.floor(r() * Math.min(span, 3)) + (r() < 0.15 && span > 3 ? 1 : 0);
        step = (r() < 0.5 ? -1 : 1) * mag;
        if (deg + step < lo || deg + step > hi) step = -step;
        if (deg + step < lo || deg + step > hi) step = 0;
      }
      deg += step;
    }
    const dur = round(0.62 + r() * 0.3 + (i === n - 1 ? 0.25 : 0), 3);
    notes.push({ deg, at: round(at, 3), dur });
    at += dur + 0.1;
  }
  return { seed: seed >>> 0, notes, duration: round(at - 0.1, 3) };
}

export function tideMotif(tide, index) {
  const t = TIDES[clamp(tide, 0, TIDES.length - 1)];
  const [a, b] = t.notes;
  const count = a + Math.round(((b - a) * clamp(index, 0, MOTIFS_PER_TIDE - 1)) / (MOTIFS_PER_TIDE - 1));
  return motif(hash(`tide:${t.id}:${index}`), count, t.span);
}

/** La résonance du jour : la même pour tout le monde, à date égale (AAAA-MM-JJ). */
export function dailyMotif(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date invalide.');
  const seed = hash(`day:${date}`);
  return motif(seed, 4 + (seed % 2), 4);
}

const GLIDE = 0.24; // glissando entre deux notes : le tracé ondule au lieu de faire des marches

/** Le degré chanté à l'instant t du motif (glissando court entre deux notes). */
export function motifDegreeAt(m, t) {
  const { notes } = m;
  let k = 0;
  while (k + 1 < notes.length && notes[k + 1].at <= t) k++;
  const cur = notes[k];
  if (k === 0 || t - cur.at > GLIDE) return cur.deg;
  const prev = notes[k - 1].deg;
  const u = clamp((t - cur.at) / GLIDE, 0, 1);
  return prev + (cur.deg - prev) * (u * u * (3 - 2 * u));
}

/** Le tracé que la matière dessine en chantant : de gauche à droite, à la hauteur de ses notes. */
export function motifTrace(m, rate = 40) {
  const out = [];
  const total = Math.max(0.2, m.duration);
  const n = Math.max(2, Math.ceil(total * rate));
  for (let i = 0; i <= n; i++) {
    const at = (i / n) * total;
    out.push({ at: round(at, 3), x: round(0.16 + (0.68 * at) / total), y: round(degreeY(motifDegreeAt(m, at))) });
  }
  return out;
}

function resample(values, n) {
  if (values.length === 1) return Array(n).fill(values[0]);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const f = (i / (n - 1)) * (values.length - 1);
    const a = Math.floor(f);
    const b = Math.min(values.length - 1, a + 1);
    out[i] = values[a] + (values[b] - values[a]) * (f - a);
  }
  return out;
}

/** Distance de déformation temporelle (DTW) moyenne, bornée par point. */
function dtw(a, b, cap = 3) {
  const n = a.length;
  const m = b.length;
  const band = Math.max(2, Math.ceil(Math.max(n, m) * 0.3));
  const INF = Infinity;
  let prev = new Float64Array(m + 1).fill(INF);
  let prevLen = new Float64Array(m + 1).fill(0);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    const cur = new Float64Array(m + 1).fill(INF);
    const curLen = new Float64Array(m + 1).fill(0);
    const center = Math.round((i * m) / n);
    for (let j = Math.max(1, center - band); j <= Math.min(m, center + band); j++) {
      const c = Math.min(cap, Math.abs(a[i - 1] - b[j - 1]));
      let best = prev[j - 1];
      let len = prevLen[j - 1];
      if (prev[j] < best) { best = prev[j]; len = prevLen[j]; }
      if (cur[j - 1] < best) { best = cur[j - 1]; len = curLen[j - 1]; }
      cur[j] = best + c;
      curLen[j] = len + 1;
    }
    prev = cur;
    prevLen = curLen;
  }
  return prev[m] / Math.max(1, prevLen[m]);
}

/**
 * Accord entre un motif et une réponse.
 * @param {object} m motif
 * @param {{t:number, y:number}[]} gesture points du geste (temps en secondes, y dans [0,1])
 * @returns {{score:number, verdict:'resonance'|'close'|'far'|'silent', distance:number}}
 */
export function attune(m, gesture) {
  const pts = (gesture ?? []).filter((p) => p && Number.isFinite(p.t) && Number.isFinite(p.y));
  if (pts.length < 4 || pts.at(-1).t - pts[0].t < 0.25) return { score: 0, verdict: 'silent', distance: Infinity };
  const N = 48;
  const target = resample(Array.from({ length: 96 }, (_, i) => motifDegreeAt(m, (i / 95) * m.duration)), N);
  // Le geste est lu à temps régulier, quel que soit le rythme des événements du pointeur.
  const t0 = pts[0].t;
  const span = pts.at(-1).t - t0;
  const even = [];
  let j = 0;
  for (let i = 0; i < 96; i++) {
    const t = t0 + (i / 95) * span;
    while (j + 1 < pts.length && pts[j + 1].t < t) j++;
    const a = pts[j];
    const b = pts[Math.min(pts.length - 1, j + 1)];
    const u = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
    even.push(yDegree(a.y + (b.y - a.y) * u));
  }
  // Un contour juste chanté un ou deux degrés trop haut ou trop bas reste proche :
  // on essaie ces transpositions, chacune avec une petite pénalité.
  const answer = resample(even, N);
  let distance = Infinity;
  for (const shift of [0, -1, 1, -2, 2]) {
    const d = dtw(target, answer.map((v) => v - shift)) + 0.32 * Math.abs(shift);
    if (d < distance) distance = d;
  }
  // Il faut aussi chanter l'ampleur du motif : une réponse qui reste au milieu ne l'a pas entendu.
  const degs = m.notes.map((n) => n.deg);
  const targetRange = Math.max(...degs) - Math.min(...degs);
  const sorted = [...even].sort((a, b) => a - b);
  const answerRange = sorted[Math.floor(sorted.length * 0.9)] - sorted[Math.floor(sorted.length * 0.1)];
  distance += Math.max(0, targetRange * 0.6 - answerRange) * 0.45;
  const score = round(clamp(1 - distance / 1.5, 0, 1), 3);
  const verdict = score >= RESONANCE ? 'resonance' : score >= PASS ? 'close' : 'far';
  return { score, verdict, distance: round(distance, 3) };
}

// ------------------------------------------------------------------ chœur du jour

export const CHORUS_POINTS = 48;

/**
 * Réduit un geste à ce qui se partage : 48 hauteurs prises à temps régulier et une durée.
 * Ni position horizontale, ni horodatage, ni rien qui identifie l'appareil.
 * @returns {{y:number[], dur:number} | null}
 */
export function chorusTrace(gesture, n = CHORUS_POINTS) {
  const pts = (gesture ?? []).filter((p) => p && Number.isFinite(p.t) && Number.isFinite(p.y));
  if (pts.length < 2) return null;
  const t0 = pts[0].t;
  const span = pts.at(-1).t - t0;
  if (!(span > 0)) return null;
  const y = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + (i / (n - 1)) * span;
    while (j + 1 < pts.length && pts[j + 1].t < t) j++;
    const a = pts[j];
    const b = pts[Math.min(pts.length - 1, j + 1)];
    const u = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
    y.push(round(clamp(a.y + (b.y - a.y) * u, 0, 1), 3));
  }
  return { y, dur: round(Math.min(30, span), 3) };
}

/** Trace partagée → geste, pour la mesurer de nouveau (côté serveur) ou la dessiner. */
export function chorusGesture(trace) {
  const n = trace.y.length;
  return trace.y.map((y, i) => ({ t: (i / (n - 1)) * trace.dur, y }));
}

/** Une trace reçue est-elle bien formée ? (Tout le reste est refusé.) */
export function validTrace(trace, n = CHORUS_POINTS) {
  return Boolean(trace) && Array.isArray(trace.y) && trace.y.length === n
    && trace.y.every((v) => typeof v === 'number' && v >= 0 && v <= 1)
    && typeof trace.dur === 'number' && trace.dur >= 0.25 && trace.dur <= 30;
}

// ------------------------------------------------------------------ progression

export const STORE_VERSION = 1;

export function freshProgress() {
  return { v: STORE_VERSION, tide: 0, index: 0, best: TIDES.map(() => Array(MOTIFS_PER_TIDE).fill(0)), days: {}, streak: 0, lastDay: null };
}

/** Relit une progression stockée ; toute valeur hors bornes est réparée plutôt que crue. */
export function readProgress(raw) {
  const p = freshProgress();
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return p; }
  if (!data || data.v !== STORE_VERSION) return p;
  p.tide = Number.isInteger(data.tide) ? clamp(data.tide, 0, TIDES.length) : 0;
  p.index = Number.isInteger(data.index) ? clamp(data.index, 0, MOTIFS_PER_TIDE - 1) : 0;
  if (Array.isArray(data.best)) {
    p.best = TIDES.map((_, i) => Array.from({ length: MOTIFS_PER_TIDE }, (_, k) => {
      const v = data.best[i]?.[k];
      return Number.isFinite(v) ? clamp(v, 0, 1) : 0;
    }));
  }
  if (data.days && typeof data.days === 'object') {
    for (const [d, v] of Object.entries(data.days).slice(-60)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(v)) p.days[d] = clamp(v, 0, 1);
  }
  p.streak = Number.isInteger(data.streak) ? clamp(data.streak, 0, 10000) : 0;
  p.lastDay = /^\d{4}-\d{2}-\d{2}$/.test(data.lastDay ?? '') ? data.lastDay : null;
  return p;
}

/** Enregistre une réponse dans la marée ; renvoie ce qui change (motif suivant, marée terminée). */
export function recordTide(progress, tide, index, score) {
  const p = structuredClone(progress);
  p.best[tide][index] = Math.max(p.best[tide][index], round(score, 3));
  if (score < PASS) return { progress: p, advanced: false, tideDone: false };
  let tideDone = false;
  if (tide === p.tide && index === p.index) {
    if (index + 1 < MOTIFS_PER_TIDE) p.index = index + 1;
    else { p.tide = tide + 1; p.index = 0; tideDone = true; }
  }
  return { progress: p, advanced: true, tideDone };
}

export function dayBefore(date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Enregistre la résonance du jour ; la série compte les jours consécutifs réussis. */
export function recordDay(progress, date, score) {
  const p = structuredClone(progress);
  const before = p.days[date] ?? 0;
  p.days[date] = Math.max(before, round(score, 3));
  if (score >= PASS && before < PASS) {
    p.streak = p.lastDay === dayBefore(date) ? p.streak + 1 : 1;
    p.lastDay = date;
  }
  return p;
}

/** Série visible aujourd'hui : elle s'éteint si l'on a manqué hier. */
export function liveStreak(progress, today) {
  if (!progress.lastDay) return 0;
  return progress.lastDay === today || progress.lastDay === dayBefore(today) ? progress.streak : 0;
}

export function localDate(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
