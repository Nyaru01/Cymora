// CYMORA — la scène. Auteur : CLAUDE.
// La matière chante un motif (sa figure de Chladni suit chaque note), puis c'est au visiteur
// de le retracer : la hauteur du geste est la note. game.js mesure l'accord ; s'il est juste,
// la matière se cristallise et le chapitre avance. En improvisation, on retrouve le dialogue libre
// de la V3 (phrase.js, CODEX) : on trace, on se tait, elle répond.

import { createObjectView, createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { MODES, applyCymatics, buildField, modeIndex } from './cymatics.js';
import * as G from './game.js';
import { createI18n } from '../shared/i18n.js';
import { DICT } from './strings.js';

const i18n = createI18n(DICT);
i18n.set('fr'); // Cymora parle français
const t = i18n.t;

const STEP = 1 / 60;
const COUNT_IN_BEATS = 2;
const STORE = 'cymora.progress.v1';
const FREE_STORE = 'cymora.free.v1';
const SETTINGS = 'cymora.settings.v1';
const ENDING_SEEN = 'cymora.seen.ending'; // la scène de fin se joue d'elle-même une fois, puis depuis le menu
const HOLD_SEEN = 'cymora.seen.hold'; // la carte « notes tenues » n'apparaît qu'une fois
const ACCORD_SEEN = 'cymora.seen.accord'; // le tutoriel de la jauge d'accord, une seule fois
const FIRST_SEEN = 'cymora.seen.first'; // le tout premier chant : on n'apprend que le geste de base
const GLIDE_SEEN = 'cymora.seen.glide';
const REST_SEEN = 'cymora.seen.rest';
const PULSE_SEEN = 'cymora.seen.pulse'; // idem pour le tutoriel de la pulsation
const VISIT = 'cymora.visit'; // dernière venue, pour qu'elle te salue
const RESET_KEY = 'cymora.reset'; // remise à zéro générale de la progression : changer RESET_EPOCH la relance chez tout le monde
const RESET_EPOCH = '2026-11-25';
const VERSION = '1.25.0'; // à garder égal à package.json (vérifié par les tests)
const PULSE = 2.6; // durée d'une onde de résonance (s)
const TAU = Math.PI * 2;
const ROUND = 0.5; // à partir du chapitre 3, la matière dessine des figures arrondies
const LEGACY = { [STORE]: 'resonance.progress.v1', [FREE_STORE]: 'resonance.free.v1' }; // noms d'avant Cymora
// Grains de matière : plus nombreux sur grand écran (la plaque y est bien plus grande), ajustés ensuite à la fluidité.
const COUNT = matchMedia('(min-width: 1000px) and (pointer: fine)').matches ? 18000 : 12000;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
/** État d'une perle : pas encore, à l'unisson (85 %), en résonance (95 %), parfait (97 %, toutes les tenues). */
const streakText = (n) => t(n > 1 ? 'streak' : 'streak.one', { n });
const pearlState = (v) => (v >= G.PERFECT ? 'pearl.perfect' : v >= G.RESONANCE ? 'pearl.res' : v >= G.PASS ? 'pearl.close' : 'pearl.none');
const rhythmText = (feedback) => t(feedback ? `w.pulse.${feedback.kind}` : 'w.pulse.inTime', { n: (feedback?.index ?? 0) + 1 });
/** Lancé en local (ce PC ou le réseau de la maison) : l'atelier des prototypes y est visible, jamais en ligne. */
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.+\.local)$/.test(location.hostname);
const VERDICT = { resonance: 'w.resonance', close: 'w.close', near: 'w.near', far: 'w.far' }; // verdict → murmure
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** Lit une clé, ou son ancien nom d'avant Cymora. */
const stored = (key) => localStorage.getItem(key) ?? localStorage.getItem(LEGACY[key]);
const seen = (key) => { try { return Boolean(localStorage.getItem(key)); } catch { return false; } };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(pointer: fine)').matches; // souris (PC) : les consignes parlent du clic, pas du doigt

/** Couleurs de chaque moment : encre du guide, encre du geste. Le reste est en CSS. */
const INKS = {
  see: { guide: '#a6f7ff', stroke: '#d2c2ff' },
  follow: { guide: '#9dfff0', stroke: '#c4e4ff' },
  remember: { guide: '#d2c2ff', stroke: '#a6f0ff' },
  listen: { guide: '#eef2ff', stroke: '#c4d2ff' },
  pulse: { guide: '#ffd6a8', stroke: '#ffc2e6' },
  resonate: { guide: '#c8f6ff', stroke: '#ffe2b8' },
  daily: { guide: '#f0c8ff', stroke: '#b4f2ff' },
  free: { guide: '#8ff0ff', stroke: '#dccfff' },
};
const GLIDE_INK = '#ffd9a8'; // couleur des longues glissades (atelier Glisser) : chaude, pour dire « ralentis »
const CHORUS_INK = '#a58cff';
/** Grand écran : un panneau à gauche, le champ à droite. Même seuil que la feuille de style. */
const WIDE = matchMedia('(min-width: 1000px) and (min-height: 560px) and (min-aspect-ratio: 5/4)');

async function boot() {
  i18n.apply();
  document.title = t('meta.title');
  startIntro();
  splashProgress(0.08);
  let E;
  let D = null;
  try {
    E = await import('./engine.js');
  } catch (err) {
    fatal(t('f.engine', { why: err.message }));
    return;
  }
  try { D = await import('./phrase.js'); } catch { /* improvisation indisponible : le jeu reste */ }
  splashProgress(0.2);
  const app = new Cymora(E, D);
  i18n.onChange(() => app.relabel());
  if (new URLSearchParams(location.search).has('debug')) globalThis.__cymora = app; // QA uniquement
  app.start();
  // Toutes les figures sont préparées pendant le chargement : plus aucun à-coup en jouant.
  await app.prepare((k) => splashProgress(0.2 + 0.8 * k));
  intro.onFade = () => app.homeSound();
  await openThreshold();
  app.homeSound();
  if ('serviceWorker' in navigator && location.protocol === 'https:') watchUpdates();
  // Demande au navigateur de ne pas effacer la progression quand l'appareil manque de place.
  navigator.storage?.persist?.().catch(() => {});
}

/**
 * Mises à jour : une nouvelle version s'installe en arrière-plan, puis un pop-up propose de l'ouvrir.
 * Accepter recharge la page sur la nouvelle version ; « Plus tard » la garde pour la prochaine ouverture.
 */
async function watchUpdates() {
  let reg;
  try { reg = await navigator.serviceWorker.register('./sw.js'); } catch { return; } // l'app marche sans
  const offer = (worker) => {
    if (!worker || !navigator.serviceWorker.controller) return; // première installation : rien à proposer
    const box = $('#update');
    box.hidden = false;
    setTimeout(() => box.classList.add('is-on'), 30); // juste après l'affichage, pour que le fondu se joue
    $('#update-go').onclick = () => {
      $('#update-go').disabled = true;
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      worker.postMessage('skip');
    };
    $('#update-later').onclick = () => { box.classList.remove('is-on'); setTimeout(() => { box.hidden = true; }, 500); };
  };
  if (reg.waiting) offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
  });
  const check = () => reg.update().catch(() => {});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(check, 30 * 60 * 1000);
}

/** Vibration (téléphone) : de courtes impulsions, jamais insistantes. */
/** Réglages du joueur, gardés sur l'appareil. */
const settings = { sound: true, haptics: true, guide: false, calm: false, volume: 0.7 };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS) ?? '{}')); } catch { /* réglages par défaut */ }
const saveSettings = () => { try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch { /* le temps de la séance */ } };

const CAN_VIBRATE = typeof navigator.vibrate === 'function';
// Safari n'a pas navigator.vibrate ; depuis iOS 18, basculer un interrupteur natif donne un « tic » haptique.
const IOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let iosSwitch = null;
function iosTick() {
  if (!iosSwitch) {
    iosSwitch = document.createElement('label');
    iosSwitch.className = 'haptic-tap';
    iosSwitch.setAttribute('aria-hidden', 'true');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.tabIndex = -1;
    input.setAttribute('switch', '');
    iosSwitch.append(input);
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
}
/** Vibration : des impulsions assez longues pour que tous les moteurs les rendent (moins de ~50 ms passe souvent inaperçu sur Android). */
function haptic(pattern) {
  if (!settings.haptics) return null;
  try {
    if (CAN_VIBRATE) return navigator.vibrate(pattern);
    if (IOS) iosTick();
  } catch { /* pas de vibreur */ }
  return null;
}

/**
 * Rosace d'un chant : sa courbe (de gauche à droite, plus haut = plus loin du centre) répétée six fois
 * en miroir autour du centre. level : 0 esquissée (pas encore accordée), 1 unisson, 2 résonance, 3 parfait.
 */
function drawRosace(cv, m, level, color, S = 96) {
  const d = Math.min(2, devicePixelRatio || 1);
  cv.width = cv.height = S * d;
  const g = cv.getContext('2d');
  g.scale(d, d);
  const c = S / 2;
  g.strokeStyle = color;
  g.fillStyle = color;
  if (!m) {
    g.globalAlpha = 0.25;
    g.beginPath();
    g.arc(c, c, 2, 0, TAU);
    g.fill();
    return;
  }
  const tr = G.motifTrace(m, 20);
  const petals = 6;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = [0, 4, 8, 12][level];
  g.globalAlpha = [0.2, 0.6, 0.85, 1][level];
  g.lineWidth = [0.8, 1, 1.3, 1.6][level];
  for (let p = 0; p < petals; p++) {
    for (const side of [1, -1]) {
      g.beginPath();
      tr.forEach((pt, i) => {
        const a = (p * TAU) / petals + side * ((pt.x - 0.16) / 0.68) * (Math.PI / petals);
        const r = c * (0.18 + (1 - pt.y) * 0.8);
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      });
      g.stroke();
    }
  }
  if (level >= 3) {
    g.lineWidth = 1;
    g.beginPath();
    g.arc(c, c, c - 3, 0, TAU);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.beginPath();
  g.arc(c, c, level ? 2.4 : 1.6, 0, TAU);
  g.fill();
}

/** Fenêtres : elles s'ouvrent et se referment en douceur (fondu et léger glissé). */
function openDialog(d) {
  d.classList.remove('is-closing');
  if (!d.open) d.showModal();
}
function closeDialog(d) {
  return new Promise((done) => {
    if (!d.open) return done();
    if (reducedMotion) { d.close(); return done(); }
    let over = false;
    const end = () => { if (over) return; over = true; d.classList.remove('is-closing'); d.close(); done(); };
    d.classList.add('is-closing');
    d.addEventListener('animationend', end, { once: true });
    setTimeout(end, 360);
  });
}
for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('cancel', (ev) => { ev.preventDefault(); closeDialog(d); });
  d.querySelector('form[method="dialog"]')?.addEventListener('submit', (ev) => { ev.preventDefault(); closeDialog(d); });
  d.addEventListener('click', (ev) => { if (ev.target === d) closeDialog(d); }); // un toucher hors de la fenêtre la ferme
}

/**
 * Le chant dessiné : une perle par note (plus grosse si elle dure), reliées par une courbe douce
 * (Catmull-Rom) plutôt que par des marches. Chaque point porte l'instant où il est chanté.
 */
function songOf(m) {
  const X = (t) => 0.16 + (0.68 * t) / m.duration;
  // Une note glissée se place sur sa partie tenue : la courbe montre la longue glissade qui y mène.
  const notes = m.notes.map((n) => ({ x: X(n.at + (n.glide ?? 0) + (n.dur - (n.glide ?? 0)) / 2), y: G.degreeY(n.deg), at: n.at, dur: n.dur, hold: Boolean(n.hold), glide: n.glide ?? 0, rest: n.rest ?? 0 }));
  // Un silence coupe le chant en phrases : la courbe s'interrompt (« brk » sur le premier point de la phrase suivante).
  const phrases = [];
  for (const n of notes) { if (!phrases.length || n.rest) phrases.push([]); phrases.at(-1).push(n); }
  const points = [];
  phrases.forEach((ph, pi) => {
    const first = ph[0];
    const last = ph[ph.length - 1];
    const start = pi === 0 ? 0 : first.at;
    const end = pi === phrases.length - 1 ? m.duration : last.at + last.dur;
    const from = points.length;
    curve([{ x: X(start), y: first.y }, ...ph, { x: X(end), y: last.y }], points, m.duration);
    if (pi > 0 && points[from]) points[from].brk = true;
    points.push({ x: X(end), y: last.y, at: end });
  });
  // Les points d'une longue glissade sont marqués : ils se dessinent d'une autre couleur.
  for (const n of notes) if (n.glide) for (const p of points) if (p.at >= n.at && p.at <= n.at + n.glide) p.glide = true;
  return { points, notes };
}

/** Courbe douce (Catmull-Rom) passant par les points de contrôle ; chaque point porte l'instant où il est chanté. */
function curve(ctrl, points, duration) {
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < 36; k++) {
      const u = k / 36;
      const u2 = u * u;
      const u3 = u2 * u;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (3 * b - a - 3 * c + d) * u3);
      const x = f(p0.x, p1.x, p2.x, p3.x);
      points.push({ x, y: f(p0.y, p1.y, p2.y, p3.y), at: ((x - 0.16) / 0.68) * duration });
    }
  }
}

/** Mélange deux couleurs #rrggbb (k = 0 : la première, 1 : la seconde). */
function mixHex(a, b, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * clamp(k, 0, 1)).toString(16).padStart(2, '0')).join('')}`;
}

/** #rrggbb → rgba(…, a) */
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function splashProgress(k) {
  const v = Math.round(clamp(k, 0, 1) * 100);
  $('#splash-fill').style.transform = `scaleX(${v / 100})`;
  $('#splash-bar').setAttribute('aria-valuenow', String(v));
}

/**
 * Lancement : la vidéo d'intro joue en entier (avec le son si le navigateur l'accepte), puis l'accueil.
 * Les navigateurs interdisent le son avant un premier toucher : la vidéo part alors en muet et un bouton
 * propose le son. « Passer » apparaît dès que le jeu est prêt. Si la vidéo ne peut pas se lire (hors ligne,
 * économie de données, animations réduites), le logo et la barre de chargement reprennent leur place.
 */
const intro = { ended: false, done: null };
intro.finished = new Promise((r) => { intro.done = r; });
function introOver() {
  if (intro.ended) return;
  intro.ended = true;
  intro.done();
}
function startIntro() {
  const v = $('#splash-video');
  const fallback = () => {
    if (v && document.body.classList.contains('has-intro') && !v.error) return; // elle joue déjà : on la laisse
    v?.pause();
    document.body.classList.remove('has-intro');
    document.body.classList.add('no-intro');
    introOver();
  };
  if (reducedMotion || !v) { v?.remove(); fallback(); return; }
  // Écran en paysage (PC) : l'intro 16:9 plein écran ; en portrait (téléphone) : l'intro verticale.
  const wide = matchMedia('(min-aspect-ratio: 4/3)').matches;
  document.body.classList.toggle('intro-wide', wide);
  v.src = wide ? v.dataset.wide : v.dataset.portrait;
  v.addEventListener('error', fallback, { once: true });
  v.addEventListener('playing', () => { if (document.body.classList.contains('no-intro')) return; document.body.classList.add('has-intro'); glowLoop(v); }, { once: true });
  v.addEventListener('ended', introOver, { once: true });
  // Fin naturelle : le fondu commence 3 s avant la dernière image, pour que rien ne soit coupé.
  v.addEventListener('timeupdate', () => { if (v.duration && v.duration - v.currentTime < 3) fadeOutVideo(v); });
  const sound = $('#splash-sound');
  sound.addEventListener('click', () => { v.muted = false; sound.hidden = true; v.play().catch(() => {}); });
  $('#splash-skip').addEventListener('click', () => { fadeOutVideo(v); introOver(); });
  let waiting = false;
  // Filet de sécurité si « ended » ne vient jamais : armé une fois la vidéo partie.
  const arm = () => setTimeout(introOver, ((v.duration || 10) + 4) * 1000);
  v.muted = false;
  v.play().then(arm, () => {
    // Son refusé avant tout geste : plutôt qu'une intro muette, on invite à toucher ; elle part alors avec le son.
    waiting = true;
    document.body.classList.add('intro-gate');
    // Fond de l'écran d'entrée : une vidéo muette en boucle (le son viendra avec l'intro, au toucher).
    const amb = $('#splash-ambient');
    if (amb && !amb.src) { amb.src = amb.dataset.src; amb.muted = true; amb.play().catch(() => {}); }
    const gate = $('#splash-gate');
    gate.hidden = false;
    const enter = () => {
      gate.hidden = true;
      waiting = false;
      // Fondu enchaîné : la vidéo d'entrée reste en place pendant que l'intro apparaît par-dessus,
      // puis elle s'efface (avec le plancton et le voile) avant de s'arrêter.
      const amb = $('#splash-ambient');
      const leave = () => {
        document.body.classList.add('gate-leaving');
        setTimeout(() => { document.body.classList.remove('intro-gate', 'gate-leaving'); amb?.pause(); }, 2400);
      };
      if (intro.ended) { leave(); return; } // « Passer » touché : on ne relance pas l'intro derrière l'accueil
      v.addEventListener('playing', () => setTimeout(leave, 500), { once: true });
      v.muted = false;
      v.play().then(arm, () => { v.muted = true; v.play().then(() => { sound.hidden = false; arm(); }, fallback); });
    };
    $('#splash').addEventListener('click', enter, { once: true });
  });
  setTimeout(() => { if (!waiting && !document.body.classList.contains('has-intro')) fallback(); }, 4000);
}
/** Écran large : la vidéo (portrait) est prolongée sur les côtés par son propre reflet, flou. */
function glowLoop(v, ambient = false) {
  const cv = $('#splash-glow');
  const g = cv.getContext('2d');
  const tick = () => {
    if (document.body.dataset.state !== 'loading' || getComputedStyle(cv).display === 'none') return;
    if (ambient !== document.body.classList.contains('intro-gate')) return; // une seule source à la fois
    const W = innerWidth;
    const H = innerHeight;
    if (ambient || W > H * 0.8) {
      const h = 36;
      const w = Math.round((h * W) / H);
      if (cv.width !== w) { cv.width = w; cv.height = h; }
      // « cover » : on remplit tout l'écran avec le centre de la vidéo.
      const vw = v.videoWidth || 720;
      const vh = v.videoHeight || 1280;
      // Vidéo PC : on laisse de côté ses bandes noires (12 % en haut et en bas) pour le reflet.
      const crop = !ambient && document.body.classList.contains('intro-wide') ? 0.12 : 0;
      const sh = vh * (1 - 2 * crop);
      const k = Math.max(w / vw, h / sh);
      g.drawImage(v, 0, vh * crop, vw, sh, (w - vw * k) / 2, (h - sh * k) / 2, vw * k, sh * k);
    }
    requestAnimationFrame(tick);
  };
  tick();
}

/** Fin du chargement : on attend la fin de l'intro (ou « Passer »), puis l'accueil. */
async function openThreshold() {
  const splash = $('#splash');
  splash.classList.add('is-ready');
  if (!intro.ended) $('#splash-skip').hidden = false;
  await intro.finished;
  const v = $('#splash-video');
  if (v) { fadeOutVideo(v); if (v.muted) v.pause(); }
  document.body.dataset.state = 'threshold';
}

/** Le son de l'intro ne s'arrête pas net : il s'éteint en fondu (3 s), puis la vidéo se met en pause. */
function fadeOutVideo(v, ms = 3000) {
  if (v.dataset.fading) return;
  v.dataset.fading = '1';
  if (v.id === 'splash-video') intro.onFade?.(); // fondu enchaîné : son fredonnement monte pendant que l'intro s'éteint
  if (v.paused || v.muted) return; // muette : rien à éteindre, l'image continue jusqu'au bout
  const from = v.volume;
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    v.volume = from * 0.5 * (1 + Math.cos(Math.PI * k)); // courbe douce, sans à-coup au début ni à la fin
    if (k < 1) requestAnimationFrame(step);
    else v.pause();
  };
  requestAnimationFrame(step);
}

class Cymora {
  constructor(E, D) {
    this.E = E;
    this.D = D;
    this.cv = $('#matter');
    this.ctx = this.cv.getContext('2d');
    this.inkCv = $('#ink');
    this.ink = this.inkCv.getContext('2d');
    this.renderer = createRenderer({ prefer: 'webgl2' });
    this.objectView = createObjectView();
    this.greet();
    this.audio = createAudio();
    this.audio.setVolume(settings.volume);
    this.settings = { ...E.DEFAULTS, speed: reducedMotion ? 0.3 : 0.55, turbulence: 0.18, glow: 0.6 };
    this.world = E.createWorld(20261125);
    this.world.nodes = [];
    E.resetParticles(this.world, COUNT);
    this.fields = new Map();
    this.round = 0;
    this.modeF = 6;
    this.energy = 0;
    this.clock = 0;
    this.touch = null;
    this.cursor = { x: 0.5, y: 0.5 };
    this.keys = new Set();
    this.lastQ = 0;
    this.lastNoteAt = -1;
    this.mode = 'menu';
    this.phase = 'idle';
    this.progress = this.load();
    this.today = G.localDate();
    this.sparks = [];
    this.relabel();
    this.syncScore();
    // Ceinture et bretelles : on sauvegarde aussi quand l'app passe en arrière-plan.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      this.save();
      if (this.herbierPlayback) this.stopHerbier();
    });
  }

  start() {
    this.bindThreshold();
    this.bindGestures();
    this.bindBar();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.last = performance.now();
    this.acc = 0;
    this.frameMs = 4;
    this.slowFrames = 0;
    requestAnimationFrame((ts) => this.frame(ts));
  }

  // ---------------------------------------------------------------- progression

  /**
   * Accueil : si le navigateur permet déjà le son (l'intro a joué avec le son, ou l'on a touché « Passer »),
   * son fredonnement monte doucement au lieu de laisser un silence après l'intro.
   */
  async homeSound() {
    if (!settings.sound || this.audio.enabled || this.homeSounding) return;
    this.homeSounding = true;
    if (await this.audio.enable()) {
      this.audio.drone(true);
      // Deux notes soufflées font le pont avec la fin de l'intro.
      this.audio.note(G.degreeFreq(2), { voice: 'breath', velocity: 0.22, delay: 0.3 });
      this.audio.note(G.degreeFreq(6), { voice: 'breath', velocity: 0.18, delay: 1.5 });
    }
    this.homeSounding = false;
  }

  /** Elle te salue : selon l'heure, et si tu reviens après quelques jours. La première fois, la phrase d'accueil. */
  greet() {
    let last = null;
    try { last = localStorage.getItem(VISIT); localStorage.setItem(VISIT, String(Date.now())); } catch { /* sans mémoire */ }
    const away = last ? (Date.now() - Number(last)) / 86400000 : 0;
    const h = new Date().getHours();
    const key = !last ? 'tagline' : away >= 2 ? 'greet.back' : h >= 5 && h < 12 ? 'greet.morning' : h >= 18 && h < 23 ? 'greet.evening' : h >= 23 || h < 5 ? 'greet.night' : 'tagline';
    const line = document.querySelector('.threshold__line[data-i18n="tagline"]');
    if (line) { line.dataset.i18n = key; line.textContent = t(key); }
  }

  load() {
    // Remise à zéro générale (une seule fois par appareil) : les chants ont changé avec les notes tenues.
    try {
      if (localStorage.getItem(RESET_KEY) !== RESET_EPOCH) {
        for (const key of [STORE, LEGACY[STORE], HOLD_SEEN, PULSE_SEEN, GLIDE_SEEN, REST_SEEN]) localStorage.removeItem(key);
        localStorage.setItem(RESET_KEY, RESET_EPOCH);
      }
    } catch { /* stockage indisponible : rien à effacer */ }
    try { return G.readProgress(stored(STORE)); } catch { return G.freshProgress(); }
  }

  /** Sauvegarde locale après chaque réponse ; une coche brève le confirme près du score. */
  save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(this.progress));
      const mark = $('#score');
      mark.classList.remove('is-saved');
      void mark.offsetWidth; // relance l'animation
      mark.classList.add('is-saved');
    } catch { /* stockage indisponible : la progression vit le temps de la séance */ }
  }

  /** Score de résonance affiché ; s'il augmente, il compte jusqu'à sa nouvelle valeur. */
  syncScore(animate = false) {
    const to = G.resonanceScore(this.progress);
    const el = $('#score-value');
    const from = Number(el.textContent) || 0;
    $('#score').setAttribute('aria-label', t('score.label', { n: to }));
    $('#map-score').textContent = `${t('score.map')} · ${to}`;
    if (!animate || to <= from || reducedMotion) { el.textContent = String(to); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 1200);
      el.textContent = String(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    $('#score').classList.remove('is-up');
    void $('#score').offsetWidth;
    $('#score').classList.add('is-up');
  }

  /** Les points gagnés montent du centre de la plaque. */
  showGain(points, pct) {
    const el = $('#gain');
    el.textContent = points > 0 ? `${t('score.gain', { n: points })}  ·  ${t('score.pct', { n: pct })}` : t('score.pct', { n: pct });
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
  }

  /** Confirmation sensible : vibration sur téléphone, frisson de la plaque à l'écran. */
  feel(kind) {
    // Au moins ~50 ms par impulsion : en dessous, beaucoup de moteurs Android ne rendent rien (le test des réglages fait 60 ms).
    if (kind === 'resonance') haptic([70, 80, 120]);
    else if (kind === 'close') haptic(80);
    else if (kind === 'near') haptic([55, 90, 55]);
    else if (kind === 'far') haptic([50, 120, 50]);
    else if (kind === 'done') haptic([80, 90, 80, 90, 160]);
    else if (kind === 'touch' || kind === 'note') haptic(50);
    if (kind === 'touch' || kind === 'note') return;
    const scene = $('#scene');
    scene.classList.remove('is-yes', 'is-no');
    void scene.offsetWidth;
    scene.classList.add(kind === 'far' || kind === 'near' ? 'is-no' : 'is-yes');
  }

  // ---------------------------------------------------------------- seuil et barre

  bindThreshold() {
    this.lastInput = performance.now();
    const alive = () => { this.lastInput = performance.now(); };
    for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) addEventListener(type, alive, { passive: true });
    const go = async (withSound, then) => {
      if (withSound && settings.sound) await this.audio.enable();
      if (this.audio.enabled) this.audio.drone(true);
      this.syncSound();
      document.body.dataset.state = 'play';
      this.cv.focus({ preventScroll: true });
      then();
    };
    $('#begin').addEventListener('click', () => go(true, () => this.startTide(this.progress.tide)));
    $('#go-daily').addEventListener('click', () => go(true, () => this.startDaily()));
    $('#go-free').addEventListener('click', () => go(true, () => this.startFree()));
  }

  /**
   * Entrer dans le jeu, d'où que l'on parte (accueil, carte ou herbier ouverts depuis l'accueil) :
   * on quitte l'écran d'accueil et le son démarre, comme avec les boutons de l'accueil.
   */
  enterPlay() {
    if (document.body.dataset.state === 'play') return;
    document.body.dataset.state = 'play';
    this.cv.focus({ preventScroll: true });
    if (settings.sound && !this.audio.enabled) this.audio.enable().then((ok) => { if (ok) this.audio.drone(true); this.syncSound(); });
    else { if (this.audio.enabled) this.audio.drone(true); this.syncSound(); }
  }

  bindBar() {
    $('#sound').addEventListener('click', () => this.toggleSound());
    this.bindMenu();
    this.bindHerbier();
    $('#where').addEventListener('click', () => this.openMap());
    const map = $('#map');
    $('#map-daily').addEventListener('click', async () => { await closeDialog(map); this.startDaily(); });
    $('#map-free').addEventListener('click', async () => { await closeDialog(map); this.startFree(); });
    $('#map-herbier').addEventListener('click', async () => { await closeDialog(map); this.openHerbier(); });
    // L'atelier (prototypes) n'existe qu'en local : sur le site en ligne, ses boutons sont retirés.
    if (LOCAL) {
      $('#map-trial').addEventListener('click', async () => { await closeDialog(map); this.startTrial('hold'); });
      $('#map-pulse').addEventListener('click', async () => { await closeDialog(map); this.startTrial('pulse'); });
      $('#map-glide').addEventListener('click', async () => { await closeDialog(map); this.startTrial('glide'); });
      $('#map-rest').addEventListener('click', async () => { await closeDialog(map); this.startTrial('rest'); });
    } else for (const id of ['#map-trial', '#map-pulse', '#map-glide', '#map-rest']) $(id)?.remove();
    $('#side-map').addEventListener('click', () => this.openMap());
    $('#reset').addEventListener('click', () => {
      const before = this.progress;
      this.progress = G.freshProgress();
      this.save();
      this.syncScore();
      closeDialog(map);
      this.toast(t('t.reset'), t('t.undo'), () => { this.progress = before; this.save(); this.syncScore(); this.relabel(); });
      this.startTide(0);
    });
  }

  // ---------------------------------------------------------------- menu et réglages

  bindMenu() {
    const menu = $('#menu');
    $('#menu-open').addEventListener('click', () => this.openMenu());
    $('#menu-home').addEventListener('click', async () => { await closeDialog(menu); this.goHome(); });
    $('#menu-journey').addEventListener('click', async () => { await closeDialog(menu); this.openMap(); });
    $('#menu-herbier').addEventListener('click', async () => { await closeDialog(menu); this.openHerbier(); });
    // Depuis l'accueil, on passe par les mêmes boutons que l'accueil (son, entrée en jeu) ; en jeu, on y va directement.
    $('#menu-daily').addEventListener('click', async () => { await closeDialog(menu); if (document.body.dataset.state === 'play') this.startDaily(); else $('#go-daily').click(); });
    $('#menu-ending').addEventListener('click', async () => { await closeDialog(menu); this.playEnding(() => this.showCredits(true)); });
    $('#menu-free').addEventListener('click', async () => { await closeDialog(menu); if (document.body.dataset.state === 'play') this.startFree(); else $('#go-free').click(); });
    $('#set-volume').addEventListener('input', (ev) => {
      settings.volume = clamp(Number(ev.target.value) / 100, 0, 1);
      this.audio.setVolume(settings.volume);
      saveSettings();
    });
    $('#set-sound').addEventListener('click', async () => {
      settings.sound = !settings.sound;
      saveSettings();
      this.syncSettings();
      if (document.body.dataset.state === 'play') {
        if (!settings.sound && this.audio.enabled) { this.audio.drone(false); this.audio.disable(); }
        else if (settings.sound && !this.audio.enabled && await this.audio.enable()) this.audio.drone(true);
      }
      this.syncSound();
    });
    $('#set-haptics').addEventListener('click', () => {
      settings.haptics = !settings.haptics;
      saveSettings();
      this.syncSettings();
      const answer = haptic(60); // pour sentir tout de suite ce que ça donne
      if (settings.haptics && CAN_VIBRATE) $('#set-haptics-line').textContent = t(answer ? 'set.hapticsOk' : 'set.hapticsRefused');
    });
    for (const key of ['guide', 'calm']) {
      $(`#set-${key}`).addEventListener('click', () => { settings[key] = !settings[key]; saveSettings(); this.syncSettings(); });
    }
    i18n.onChange(() => this.syncSettings());
    this.syncSettings();
  }

  openMenu() {
    $('#menu-home').hidden = document.body.dataset.state !== 'play';
    $('#menu-ending').hidden = !(seen(ENDING_SEEN) || LOCAL); // en local, toujours là pour tester la fin
    this.syncSettings();
    openDialog($('#menu'));
  }

  syncSettings() {
    for (const key of ['sound', 'haptics', 'guide', 'calm']) $(`#set-${key}`).setAttribute('aria-checked', String(settings[key]));
    $('#set-volume').value = String(Math.round(settings.volume * 100));
    $('#set-volume').disabled = !settings.sound;
    const hapticsOk = CAN_VIBRATE || IOS;
    $('#set-haptics').disabled = !hapticsOk;
    $('#set-haptics-line').textContent = t(!hapticsOk ? 'set.hapticsNone' : CAN_VIBRATE ? 'set.hapticsLine' : 'set.hapticsIos');
    $('#menu-version').textContent = t('menu.version', { v: VERSION });
    document.body.classList.toggle('is-calm', settings.calm);
  }

  /** Retour au seuil : la partie s'arrête là où elle en est (la progression est déjà sauvegardée). */
  goHome() {
    this.touch = null;
    this.stroke = null;
    this.play = null;
    this.result = null;
    this.mode = 'menu';
    this.phase = 'idle';
    this.hideCard();
    clearTimeout(this.whisperTimer);
    $('#whisper').classList.remove('is-on');
    // À l'accueil, elle continue de fredonner doucement (le bourdon reste).
    this.setTone('see');
    this.setRound(0);
    this.save();
    this.relabel();
    this.lastInput = performance.now();
    document.body.dataset.state = 'threshold';
  }

  openMap() {
    this.syncScore();
    const list = $('#tides');
    list.replaceChildren();
    G.TIDES.forEach((tide, k) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tide';
      b.dataset.tide = tide.id;
      const unlocked = k <= this.progress.tide;
      b.disabled = !unlocked;
      const name = document.createElement('span');
      name.className = 'tide__name';
      const art = document.createElement('span');
      art.className = `tide__art tide__art--${tide.id}`;
      art.setAttribute('aria-hidden', 'true');
      name.textContent = `${ROMAN[k]} · ${t(`tide.${tide.id}`)}`;
      const line = document.createElement('span');
      line.className = 'tide__line';
      line.textContent = unlocked ? t(`line.${tide.id}`) : t('map.locked');
      const spacer = this.pearlsFor(k); // garde la place ; les vraies perles, cliquables, sont posées par-dessus
      spacer.style.visibility = 'hidden';
      spacer.removeAttribute('role');
      spacer.setAttribute('aria-hidden', 'true');
      b.append(art, name, line, spacer);
      b.addEventListener('click', async () => { await closeDialog($('#map')); this.startTide(k); });
      li.append(b);
      if (unlocked) li.append(this.pearlsFor(k, true));
      list.append(li);
    });
    const done = (this.progress.days[this.today] ?? 0) >= G.DAILY_PASS;
    const streak = G.liveStreak(this.progress, this.today);
    $('#map-herbier-state').textContent = t('herbier.count', { n: this.progress.best.flat().filter((v) => v >= G.PASS).length, of: G.TIDES.length * G.MOTIFS_PER_TIDE });
    $('#map-daily-state').textContent = `${t(done ? 'map.dailyDone' : 'map.dailyTodo')}${streak ? ` · ${streakText(streak)}` : ''}`;
    openDialog($('#map'));
  }

  /** Herbier : une rosace par chant accordé, plus brillante selon le niveau ; on la touche pour rechanter. */
  bindHerbier() {
    this.herbier = $('#herbier');
    $('#herbier-back').addEventListener('click', () => {
      this.stopHerbier();
      this.showHerbierDetail(false);
      this.herbierSelection?.trigger.focus();
      this.herbierSelection = null;
    });
    $('#herbier-listen').addEventListener('click', () => {
      if (this.herbierPlayback) this.stopHerbier();
      else this.playHerbier();
    });
    $('#herbier-replay').addEventListener('click', async () => {
      if (!this.herbier.open || this.herbier.classList.contains('is-closing') || !this.herbierSelection) return;
      const { chapter, index } = this.herbierSelection;
      this.stopHerbier();
      await closeDialog(this.herbier);
      document.body.dataset.state = 'play';
      this.cv.focus({ preventScroll: true });
      this.startTide(chapter, index);
    });
    this.herbier.addEventListener('close', () => {
      this.stopHerbier();
      this.herbierSelection = null;
      if (settings.sound && this.audio.enabled && !document.hidden) this.audio.drone(true);
      this.syncSound();
    });
  }

  openHerbier() {
    const grid = $('#herbier-grid');
    grid.replaceChildren();
    this.showHerbierDetail(false);
    G.TIDES.forEach((tide, k) => {
      const row = document.createElement('section');
      row.className = 'herbier__row';
      const name = document.createElement('h3');
      name.className = 'herbier__name';
      name.textContent = `${ROMAN[k]} · ${t(`tide.${tide.id}`)}`;
      const cells = document.createElement('div');
      cells.className = 'herbier__grid';
      const reached = k < this.progress.tide ? G.MOTIFS_PER_TIDE : k === this.progress.tide ? this.progress.index : 0;
      for (let i = 0; i < G.MOTIFS_PER_TIDE; i++) {
        const v = this.progress.best[k]?.[i] ?? 0;
        const open = i < reached || v > 0;
        const cell = document.createElement(open ? 'button' : 'span');
        cell.className = 'rosace';
        const label = open ? t('pearl', { n: i + 1, state: t(pearlState(v)) }) : t('herbier.locked', { n: i + 1 });
        cell.title = label;
        cell.setAttribute('aria-label', label);
        const cv = document.createElement('canvas');
        cv.setAttribute('aria-hidden', 'true');
        cell.append(cv);
        drawRosace(cv, open ? G.tideMotif(k, i) : null, v >= G.PERFECT ? 3 : v >= G.RESONANCE ? 2 : v >= G.PASS ? 1 : 0, (INKS[tide.id] ?? INKS.free).guide);
        if (open) {
          cell.type = 'button';
          cell.addEventListener('click', () => this.selectHerbier(k, i, cell));
        }
        cells.append(cell);
      }
      row.append(name, cells);
      grid.append(row);
    });
    this.audio.drone(false);
    openDialog(this.herbier);
  }

  showHerbierDetail(show) {
    $('#herbier-grid').hidden = show;
    $('#herbier-lede').hidden = show;
    $('#herbier-detail').hidden = !show;
  }

  selectHerbier(chapter, index, trigger) {
    const tide = G.TIDES[chapter];
    const score = this.progress.best[chapter][index];
    const motif = G.tideMotif(chapter, index);
    const trace = this.progress.echoes[chapter][index]?.trace ?? null;
    this.herbierSelection = { chapter, index, motif, trace, trigger };
    $('#herbier-name').textContent = t('herbier.name', { chapter: t(`tide.${tide.id}`), n: index + 1 });
    $('#herbier-note').textContent = t(trace ? 'herbier.duet' : 'herbier.noEcho');
    const level = score >= G.PERFECT ? 3 : score >= G.RESONANCE ? 2 : score >= G.PASS ? 1 : 0;
    drawRosace($('#herbier-portrait'), motif, level, INKS[tide.id].guide, 136);
    this.showHerbierDetail(true);
    $('#herbier-listen').focus();
    if (settings.sound) this.playHerbier();
  }

  async playHerbier() {
    if (!this.herbierSelection || this.herbierPlayback) return;
    const status = $('#herbier-status');
    if (!settings.sound) { status.textContent = t('herbier.muted'); return; }
    const { motif, trace } = this.herbierSelection;
    const notes = motif.notes.map(({ at, deg }) => ({ at, freq: G.degreeFreq(deg), echo: false }));
    const echoAt = motif.duration + 0.65;
    const echoScale = trace ? Math.min(1, 12 / trace.dur) : 1;
    if (trace) {
      for (const point of G.chorusGesture(trace)) {
        const at = echoAt + point.t * echoScale;
        const freq = G.yFreq(point.y);
        const last = notes.at(-1);
        if (last.echo && at - last.at < (freq === last.freq ? 0.5 : 0.16)) continue;
        notes.push({ at, freq, echo: true });
      }
    }
    const playback = { notes, next: 0, start: null, end: trace ? echoAt + trace.dur * echoScale + 0.65 : motif.duration + 0.65 };
    this.herbierPlayback = playback;
    $('#herbier-listen').textContent = t('herbier.stop');
    const enabled = this.audio.enabled || await this.audio.enable();
    if (this.herbierPlayback !== playback) return;
    if (!enabled) { this.stopHerbier(t('herbier.audioFailed')); return; }
    status.textContent = t('herbier.songNow');
    playback.start = performance.now();
  }

  stepHerbier(now) {
    const playback = this.herbierPlayback;
    if (playback?.start == null) return;
    const time = (now - playback.start) / 1000;
    while (playback.next < playback.notes.length && playback.notes[playback.next].at <= time) {
      const i = playback.next++;
      const note = playback.notes[i];
      if (note.echo && !playback.notes[i - 1]?.echo) $('#herbier-status').textContent = t('herbier.echoNow');
      this.audio.note(note.freq, note.echo ? { voice: 'bell', velocity: 0.26 } : { voice: 'glass', velocity: 0.34 });
    }
    if (time >= playback.end) this.stopHerbier();
  }

  stopHerbier(message = '') {
    this.herbierPlayback = null;
    $('#herbier-listen').textContent = t('herbier.listen');
    $('#herbier-status').textContent = message;
  }

  /** Les cinq perles d'un chapitre. Avec `pick`, celles des chants déjà atteints se touchent pour rejouer ce chant-là. */
  pearlsFor(k, pick = false) {
    const box = document.createElement('span');
    box.className = pick ? 'pearls pearls--pick' : 'pearls';
    const best = this.progress.best[k] ?? [];
    const reached = k < this.progress.tide ? G.MOTIFS_PER_TIDE : k === this.progress.tide ? this.progress.index : 0;
    best.forEach((v, i) => {
      const open = pick && i < reached;
      const p = document.createElement(open ? 'button' : 'span');
      p.className = `pearl${v >= G.PERFECT ? ' is-res is-perfect' : v >= G.RESONANCE ? ' is-res' : v >= G.PASS ? ' is-close' : ''}`;
      const state = pearlState(v);
      p.title = t('pearl', { n: i + 1, state: t(state) });
      if (open) {
        p.type = 'button';
        p.setAttribute('aria-label', `${t('map.play')} · ${p.title}`);
        p.addEventListener('click', async () => { await closeDialog($('#map')); this.startTide(k, i); });
      }
      box.append(p);
    });
    if (!pick) {
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', best.map((v, i) => t('pearl', { n: i + 1, state: t(pearlState(v)) })).join(', '));
    }
    return box;
  }

  relabel() {
    document.title = t('meta.title');
    const started = this.progress.tide > 0 || this.progress.index > 0;
    $('#begin-label').textContent = t(started ? 'resume' : 'begin');
    const streak = G.liveStreak(this.progress, this.today ?? G.localDate());
    $('#daily-badge').textContent = streak ? streakText(streak) : '';
    let label = '';
    if (this.mode === 'tide') label = t('where', { n: ROMAN[this.tideIdx], name: t(`tide.${G.TIDES[this.tideIdx].id}`) });
    else if (this.mode === 'daily') label = t('where.daily');
    else if (this.mode === 'free') label = t('where.free');
    else if (this.mode === 'trial') label = t(`card.${this.trialKind}`);
    $('#where-label').textContent = label;
    this.updateSide();
    const pearls = $('#pearls');
    if (this.mode === 'tide') pearls.replaceWith(Object.assign(this.pearlsFor(this.tideIdx), { id: 'pearls' }));
    else pearls.replaceChildren();
    this.syncSound();
  }

  /** Panneau latéral du grand écran : où l'on est, ce qu'on attend de toi, le dernier accord, le chœur. */
  updateSide() {
    let kicker = '';
    let title = '';
    let line = '';
    let story = '';
    if (this.mode === 'tide') {
      const id = G.TIDES[this.tideIdx].id;
      kicker = `${t('story.chapter', { n: this.tideIdx + 1 })} · ${t('side.song', { n: Math.min(G.MOTIFS_PER_TIDE, (this.motifIdx ?? 0) + 1), of: G.MOTIFS_PER_TIDE })}`;
      title = t(`tide.${id}`);
      story = t(`story.${id}`);
      line = t(`line.${id}`);
    } else if (this.mode === 'daily') {
      kicker = this.today;
      title = t('card.daily');
      line = t('side.dailyLine');
    } else if (this.mode === 'free') {
      kicker = t('where.free');
      title = t('card.free');
      line = t('card.freeLine');
    } else if (this.mode === 'trial') {
      kicker = t('side.trial', { n: (this.motifIdx ?? 0) + 1 });
      title = t(`card.${this.trialKind}`);
      line = t(`card.${this.trialKind}Line`);
    }
    const side = $('#side');
    const write = () => {
      $('#side-num').textContent = this.mode === 'tide' ? ROMAN[this.tideIdx] : this.mode === 'daily' ? '☾' : this.mode === 'trial' ? '◎' : '∞';
      $('#side-kicker').textContent = kicker;
      $('#side-title').textContent = title;
      $('#side-story').textContent = story;
      $('#side-line').textContent = line;
    };
    // Un nouveau chapitre ne remplace pas l'ancien d'un coup : l'un s'efface, l'autre apparaît.
    if ($('#side-title').textContent && $('#side-title').textContent !== title && !reducedMotion) {
      side.classList.add('is-turning');
      clearTimeout(this.sideTimer);
      this.sideTimer = setTimeout(() => { write(); side.classList.remove('is-turning'); }, 650);
    } else write();
    $('#side-pearls').replaceChildren(...(this.mode === 'tide' ? [this.pearlsFor(this.tideIdx)] : []));
    const score = $('#side-score');
    score.replaceChildren();
    if (this.result && this.mode !== 'free' && this.result.verdict !== 'silent') {
      const b = document.createElement('b');
      b.textContent = t('side.score', { n: Math.round(this.result.score * 100) });
      score.append(b, t(VERDICT[this.result.verdict] ?? 'w.far'));
    }
    $('#side-chorus').textContent = this.mode === 'daily' ? this.chorusLine() : '';
  }

  chorusLine() {
    const c = this.chorus;
    if (!c) return '';
    if (this.joined) return c.voices <= 1 ? t('chorus.first') : t('chorus.joined', { n: c.voices });
    return c.voices === 0 ? t('chorus.none') : c.voices === 1 ? t('chorus.one') : t('chorus.count', { n: c.voices });
  }

  // ---------------------------------------------------------------- chœur du jour

  async loadChorus() {
    if (!/^https?:$/.test(location.protocol)) return;
    try {
      const r = await fetch(`./api/day/${this.today}`, { cache: 'no-store' });
      if (r.ok) this.setChorus(await r.json());
    } catch { /* hors ligne : le chant du jour reste jouable, sans chœur */ }
  }

  setChorus(c) {
    if (!c || c.day !== this.today || !Array.isArray(c.traces)) return;
    const paths = c.traces.filter((tr) => G.validTrace(tr)).map((tr) => tr.y.map((y, i) => ({ x: 0.16 + (0.68 * i) / (tr.y.length - 1), y })));
    this.chorus = { voices: c.voices | 0, resonant: c.resonant | 0, paths };
    this.updateSide();
  }

  /** Une réponse accordée au chant du jour rejoint le chœur, une fois par jour : 48 hauteurs, une durée, rien d'autre. */
  async joinChorus(points) {
    const key = `cymora.chorus.${this.today}`;
    try { if (localStorage.getItem(key)) { this.joined = true; return; } } catch { /* sans stockage : une fois par séance */ }
    if (this.joining || this.joined || !/^https?:$/.test(location.protocol)) return;
    const trace = G.chorusTrace(points);
    if (!trace) return;
    this.joining = true;
    try {
      const r = await fetch(`./api/day/${this.today}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(trace) });
      if (!r.ok) return;
      const out = await r.json();
      if (out.joined) {
        this.joined = true;
        try { localStorage.setItem(key, '1'); } catch { /* sans stockage */ }
      }
      this.setChorus(out.chorus);
    } catch { /* hors ligne : la réponse compte quand même pour toi */ } finally { this.joining = false; }
  }

  setTone(id) {
    document.body.dataset.tide = id;
    this.inks = INKS[id] ?? INKS.free;
    this.audio?.tone?.(id); // le bourdon glisse vers la couleur sonore du chapitre
    this.rhythmFeedback = null;
  }

  // ---------------------------------------------------------------- parcours

  startTide(k, index = null) {
    this.enterPlay();
    if (k >= G.TIDES.length) return this.endOfTides();
    this.mode = 'tide';
    this.result = null;
    this.tideIdx = k;
    // Un chapitre déjà franchi se rejoue depuis son premier chant ; le chapitre en cours reprend où l'on était.
    // Une perle touchée sur la carte ouvre directement son chant.
    this.motifIdx = index ?? (k === this.progress.tide ? this.progress.index : 0);
    this.setTone(G.TIDES[k].id);
    this.setRound(k >= 2 ? ROUND : 0);
    this.relabel();
    const id = G.TIDES[k].id;
    this.showCard(t('card.tide', { n: ROMAN[k] }) + ' · ' + t(`tide.${id}`), t(`story.${id}`), t(`line.${id}`), 7000);
    this.enterInterlude(5.6, () => this.newMotif());
  }

  startDaily() {
    this.enterPlay();
    this.mode = 'daily';
    this.result = null;
    this.chorusShown = false;
    try { this.joined = Boolean(localStorage.getItem(`cymora.chorus.${this.today}`)); } catch { this.joined = false; }
    this.loadChorus();
    this.setTone('daily');
    this.setRound(0);
    this.relabel();
    const done = (this.progress.days[this.today] ?? 0) >= G.DAILY_PASS;
    this.showCard(t('card.daily'), done ? t('card.dailyDone') : t('card.dailyLine'));
    this.enterInterlude(3.6, () => this.newMotif());
  }

  /**
   * Atelier (prototypes de gestes, hors de l'aventure, sans rien sauvegarder) :
   * « hold » = Tenir (notes tenues), « pulse » = Pulsation (atteindre chaque note en mesure).
   */
  startTrial(kind = 'hold') {
    this.enterPlay();
    this.mode = 'trial';
    this.trialKind = kind;
    this.result = null;
    this.motifIdx = 0;
    this.setTone({ pulse: 'remember', glide: 'see', rest: 'listen' }[kind] ?? 'follow');
    this.setRound(0);
    this.relabel();
    this.showCard(t(`card.${kind}`), t(`card.${kind}Line`), '', 6000);
    this.enterInterlude(4.6, () => this.newMotif());
  }

  /** Pulsation : la plaque bat la mesure pendant son chant et pendant ton tour (une onde, un souffle grave). */
  stepBeat() {
    const counting = this.phase === 'countIn';
    const answering = this.phase === 'turn';
    if (!this.motif?.pulse || (!counting && !answering && this.phase !== 'call')) return;
    const start = answering ? this.tune?.times?.[0] ?? this.phaseAt : this.phaseAt;
    const interval = G.BEAT * this.tempo;
    const b = Math.floor((this.clock - start) / interval);
    if (counting && b >= COUNT_IN_BEATS) return;
    this.beatAt = start + b * interval;
    if (b === this.beatIdx) return;
    this.beatIdx = b;
    this.pulse(b % 2 ? 0.1 : 0.16);
    if (counting) this.whisper(t('w.pulseCount', { n: b + 1 }), Math.ceil(interval * 1000) + 100);
    if (this.audio.enabled) this.audio.note(G.degreeFreq(0), { voice: 'glass', velocity: counting ? 0.22 : answering ? 0.16 : 0.10 });
  }

  startFree() {
    this.enterPlay();
    this.mode = 'free';
    this.setTone('free');
    this.setRound(0);
    this.relabel();
    this.showCard(t('card.free'), t('card.freeLine'));
    if (this.D && !this.dialogue) {
      let memory = [];
      try { memory = JSON.parse(stored(FREE_STORE) ?? '[]'); } catch { memory = []; }
      try { this.dialogue = this.D.createDialogue({ silence: 1.4, seed: 7, memory }); } catch { this.dialogue = this.D.createDialogue({ silence: 1.4, seed: 7 }); }
    }
    this.play = null;
    this.phase = 'free';
  }

  endOfTides() {
    this.mode = 'tide';
    this.tideIdx = G.TIDES.length - 1;
    this.setTone('listen');
    this.relabel();
    this.phase = 'idle';
    // Après la vidéo : les crédits, puis le retour à l'accueil. (Déjà vue : la carte de fin, comme avant.)
    const after = () => this.showCredits(true);
    // La première fois : la scène de fin (Cymora retrouve sa voix), puis la carte.
    if (!seen(ENDING_SEEN)) this.playEnding(after);
    else { this.showCard(t('card.end'), t('card.endLine'), '', 10000); this.pulse(1.6); this.bloom(1); }
  }

  /**
   * Crédits de fin : ils montent lentement sur la nuit du jeu, avec son fredonnement,
   * puis on revient à l'accueil (à la fin du défilement, ou sur « Passer »).
   */
  showCredits(instant = false) {
    const box = $('#credits');
    const roll = $('#credits-roll');
    if (!box || !roll) { this.goHome(); return; }
    // Derrière les crédits, la matière continue de vivre : on la laisse respirer, sans carte ni murmure.
    document.body.dataset.state = 'play';
    document.body.classList.add('is-credits');
    this.mode = 'menu';
    this.phase = 'idle';
    this.touch = null;
    this.hideCard();
    clearTimeout(this.whisperTimer);
    $('#whisper').classList.remove('is-on');
    const el = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
    const logo = el('img', 'credits__logo');
    logo.src = './icons/cymora-hero.jpg';
    logo.alt = 'Cymora';
    const items = [logo, el('p', 'credits__line', t('credits.line'))];
    for (const key of ['creator', 'code', 'sound', 'matter']) {
      const v = t(`credits.${key}`);
      if (!v || v === `credits.${key}`) continue; // une rubrique vide reste cachée
      items.push(el('p', 'credits__h', t(`credits.${key}.h`)), el('p', 'credits__v', v));
    }
    items.push(el('p', 'credits__end', t('credits.thanks')), el('p', 'credits__back', t('credits.back')));
    roll.replaceChildren(...items);
    box.style.setProperty('--roll', '30s');
    box.classList.toggle('is-instant', instant);
    box.classList.toggle('is-wash', instant); // on sort d'une vidéo très claire : un voile de lumière fait le lien
    box.hidden = false;
    this.setTone('listen');
    if (settings.sound && this.audio.enabled) this.audio.drone(true);
    if (instant) box.classList.add('is-on');
    else setTimeout(() => box.classList.add('is-on'), 30); // juste après l'affichage, pour que le fondu se joue
    // Elle chante chaque nom : quand une rubrique passe au milieu de l'écran, une note monte, la matière pulse.
    const degrees = [2, 4, 5, 7, 9, 10];
    let sung = 0;
    const sing = (target) => {
      const last = target.classList.contains('credits__end');
      if (this.audio.enabled) {
        if (last) this.audio.chord([0, 2, 4, 7].map((k) => G.degreeFreq(k)), { velocity: 0.4 });
        else this.audio.note(G.degreeFreq(degrees[sung % degrees.length]), { voice: 'glass', velocity: 0.38, pan: (sung % 2 ? -0.3 : 0.3) });
        if (last) this.audio.bloom([0, 2, 4, 7].map((k) => G.degreeFreq(k)), 1);
      }
      sung++;
      this.pulse(last ? 1.4 : 0.6);
      this.bloom(last ? 1 : 0.45);
      this.E.addWake(this.world, 0.5, 0.5, 0, 0, last ? 0.12 : 0.06);
    };
    const watch = 'IntersectionObserver' in globalThis
      ? new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { watch.unobserve(e.target); sing(e.target); } }, { rootMargin: '-46% 0px -46% 0px' })
      : null;
    if (watch) for (const n of roll.querySelectorAll('.credits__line, .credits__h, .credits__end')) watch.observe(n);
    let done = false;
    const leave = () => {
      if (done) return;
      done = true;
      watch?.disconnect();
      box.classList.remove('is-on');
      setTimeout(() => { box.hidden = true; roll.replaceChildren(); document.body.classList.remove('is-credits'); this.goHome(); }, 1800);
    };
    // Seule la fin du défilement compte : l'animation de la rosace, à l'intérieur, remonte aussi jusqu'ici.
    const rolled = (e) => { if (e.target === roll && e.animationName === 'creditsRoll') { roll.removeEventListener('animationend', rolled); leave(); } };
    roll.addEventListener('animationend', rolled);
    $('#credits-skip').onclick = leave;
    if (reducedMotion) setTimeout(leave, 12000);
  }

  /**
   * Scène de fin en vidéo, avec son propre son : le bourdon s'efface, la vidéo apparaît en fondu,
   * et sa lumière finale se dissout dans le jeu. « Passer » est toujours possible.
   */
  playEnding(then = null) {
    const box = $('#ending');
    const v = $('#ending-video');
    if (!box || !v || this.endingOn) { then?.(); return; }
    this.endingOn = true;
    try { localStorage.setItem(ENDING_SEEN, '1'); } catch { /* elle se rejouera */ }
    $('#menu-ending').hidden = false;
    const wide = matchMedia('(min-aspect-ratio: 4/3)').matches;
    box.classList.toggle('is-wide', wide);
    v.src = wide ? v.dataset.wide : v.dataset.portrait;
    v.currentTime = 0;
    v.muted = !settings.sound;
    v.volume = settings.volume ?? 0.7;
    if (this.audio.enabled) this.audio.drone(false);
    box.hidden = false;
    setTimeout(() => box.classList.add('is-on'), 30); // juste après l'affichage, pour que le fondu se joue
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // Ce qui suit (les crédits) se place dessous tout de suite : la vidéo se dissout dedans, sans rien laisser voir entre les deux.
      then?.();
      box.classList.add('is-leaving');
      fadeOutVideo(v, 3000);
      setTimeout(() => {
        box.classList.remove('is-on', 'is-leaving');
        box.hidden = true;
        v.pause();
        delete v.dataset.fading;
        this.endingOn = false;
        if (settings.sound && this.audio.enabled && !document.hidden) this.audio.drone(true);
      }, 3300);
    };
    // La lumière finale est très claire : on commence le fondu juste avant la dernière image.
    const near = () => { if (v.duration && v.duration - v.currentTime < 2) { v.removeEventListener('timeupdate', near); finish(); } };
    v.addEventListener('timeupdate', near);
    v.addEventListener('ended', finish, { once: true });
    v.addEventListener('error', finish, { once: true });
    $('#ending-skip').onclick = finish;
    v.play().catch(() => { v.muted = true; v.play().catch(finish); });
  }

  newMotif() {
    this.motif = this.mode === 'daily' ? G.dailyMotif(this.today)
      : this.mode === 'trial' ? ({ pulse: G.pulseMotif, glide: G.glideMotif, rest: G.restMotif }[this.trialKind] ?? G.holdMotif)(this.motifIdx)
      : G.tideMotif(this.tideIdx, this.motifIdx);
    this.trace = G.motifTrace(this.motif);
    this.song = songOf(this.motif);
    this.attempts = 0;
    this.afk = { stage: 0, replays: 0, next: 0, stir: 0 };
    this.updateSide();
    // Premier geste nouveau de l'aventure : un tutoriel d'abord, le vrai chant ensuite.
    // Tenue : une seule note, à tenir jusqu'à ce que l'anneau se ferme. Pulsation : quatre notes, une par battement.
    if (this.mode === 'tide') {
      if (this.motif.notes.some((n) => n.hold) && !seen(HOLD_SEEN)) {
        this.lesson = { kind: 'hold', real: this.motif };
        this.setMotif(G.holdLesson(this.motif));
        this.showCard(t('card.holdNew'), t('card.holdLesson'), '', 6500);
        return this.enterInterlude(5, () => this.enterCall());
      }
      if (this.motif.pulse && !seen(PULSE_SEEN)) {
        this.lesson = { kind: 'pulse', real: this.motif };
        this.setMotif(G.pulseLesson());
        this.showCard(t('card.pulseNew'), t('card.pulseLesson'), '', 6500);
        return this.enterInterlude(5, () => this.enterCall());
      }
      if (this.motif.notes.some((n) => n.glide) && !seen(GLIDE_SEEN)) {
        this.lesson = { kind: 'glide', real: this.motif };
        this.setMotif(G.glideLesson());
        this.showCard(t('card.glideNew'), t('card.glideLesson'), '', 6500);
        return this.enterInterlude(5, () => this.enterCall());
      }
      if (this.motif.notes.some((n) => n.rest) && !seen(REST_SEEN)) {
        this.lesson = { kind: 'rest', real: this.motif };
        this.setMotif(G.restLesson());
        this.showCard(t('card.restNew'), t('card.restLesson'), '', 6500);
        return this.enterInterlude(5, () => this.enterCall());
      }
    }
    this.lesson = null;
    if (this.accordFirst()) return;
    this.enterCall();
  }

  /** Deuxième chant du joueur : avant de chanter, elle présente la jauge d'accord (une seule fois). */
  accordFirst() {
    if (!(this.mode === 'tide' || this.mode === 'daily') || !seen(FIRST_SEEN) || seen(ACCORD_SEEN) || this.accordLesson) return false;
    this.accordLesson = true;
    this.showCard(t('card.accordNew'), t(FINE ? 'card.accordLessonPc' : 'card.accordLesson'), '', 9000);
    this.enterInterlude(8, () => this.enterCall());
    return true;
  }

  /** Le tout premier chant : rien d'autre à comprendre que « écoute, puis retrace ». */
  get firstSong() {
    return (this.mode === 'tide' || this.mode === 'daily') && !this.lesson && !seen(FIRST_SEEN);
  }

  setMotif(m) {
    this.motif = m;
    this.trace = G.motifTrace(m);
    this.song = songOf(m);
  }

  /** Tutoriel des notes tenues : réussi dès que l'anneau s'est fermé une fois ; sinon elle la rechante. */
  judgeLesson(points = []) {
    this.holding = null;
    this.stroke = null;
    this.lifted = null;
    const kind = this.lesson.kind;
    const pulse = kind === 'pulse';
    let ok = (this.held ?? 0) >= 1;
    let again = t(FINE ? 'w.lessonAgainPc' : 'w.lessonAgain');
    let okText = null;
    if (kind === 'glide') {
      // Glissade : arrivée au bout, régulière et sans se presser.
      const gl = G.glideOf(this.motif, points, this.tune?.times ?? [], this.tempo);
      ok = gl.feedback == null;
      again = t({ fast: 'w.glideFast', shaky: 'w.glideShaky', slow: 'w.glideSlow', missed: 'w.glideMissed' }[gl.feedback] ?? 'w.glideMissed');
      okText = t('w.glideLessonOk');
    }
    if (kind === 'rest') {
      // Silence : le doigt levé pendant le silence, à peu près le bon temps, et les deux phrases chantées.
      const rs = G.restOf(this.motif, this.lifts ?? [], this.tempo);
      const all = (this.tune?.times ?? []).filter((x) => x != null).length >= this.motif.notes.length;
      ok = rs.feedback == null && all;
      again = t({ none: 'w.restNone', short: 'w.restShort', long: 'w.restLong' }[rs.feedback] ?? 'w.restTurn');
      okText = t('w.restLessonOk');
    }
    if (pulse) {
      // Pulsation : toutes les perles atteintes, et à peu près en mesure.
      const times = this.tune?.times ?? [];
      const rh = G.rhythmOf(this.motif.notes, times, this.tempo, G.reachTimes(this.motif));
      ok = rh.feedback == null;
      this.rhythmFeedback = rh.feedback;
      again = rhythmText(rh.feedback);
    }
    if (ok) {
      try { localStorage.setItem({ pulse: PULSE_SEEN, glide: GLIDE_SEEN, rest: REST_SEEN }[kind] ?? HOLD_SEEN, '1'); } catch { /* on la présentera encore */ }
      const real = this.lesson.real;
      this.lesson = null;
      this.whisper(okText ?? t(pulse ? 'w.pulseOk' : 'w.lessonOk'), 4200);
      this.feel('resonance');
      this.pulse(1);
      this.bloom(0.8);
      this.setMotif(real);
      return this.enterInterlude(4.2, () => this.enterCall());
    }
    this.whisper(again, 4200);
    this.enterInterlude(3.4, () => this.enterCall(true));
  }

  /** Le seuil pour avancer : 85 % dans l'aventure, 90 % pour la résonance du jour. */
  get passMark() {
    return this.mode === 'daily' ? G.DAILY_PASS : G.PASS;
  }

  get guide() {
    if (settings.guide || this.mode === 'trial') return 'always';
    if (this.mode === 'daily') return 'call';
    return G.TIDES[this.tideIdx]?.guide ?? 'always';
  }

  /** Après deux essais sans accord, la matière montre le chemin, quel que soit le chapitre. */
  get helping() {
    return this.attempts >= 2 && this.guide !== 'always';
  }

  enterCall(quiet = false) {
    this.phase = 'call';
    this.phaseAt = this.clock;
    this.beatIdx = null;
    this.rhythmFeedback = null;
    this.tempo = this.attempts || quiet ? 1.25 : 1; // elle rechante plus lentement
    this.nextNote = 0;
    this.stroke = null;
    if (this.lesson?.kind === 'pulse') this.whisper(t('w.pulseCall'), 4000);
    else if (this.firstSong) this.whisper(t('w.firstCall'), 5000);
    else if (!quiet) this.whisper(t('w.call'), 1800);
  }

  enterTurn() {
    this.phase = 'turn';
    this.phaseAt = this.clock;
    this.touchedAt = null;
    if (this.afk) this.afk.stage = 0;
    this.heldNotes = new Set();
    this.tune = null;
    this.beatIdx = null;
    if (this.firstSong) this.whisper(t(FINE ? 'w.firstTurnPc' : 'w.firstTurn'), 15000);
    else if (this.accordLesson && !this.lesson) this.whisper(t('w.accordTurn'), 15000);
    else if (this.motif.pulse) this.whisper(t('w.pulseTurn'), 7000);
    else if (this.lesson) this.whisper(t(FINE ? 'w.lessonTurnPc' : 'w.lessonTurn'), 15000);
    else if (!this.helping && this.motif.notes.some((note) => note.hold)) this.whisper(t('w.holdTurn'), 5500);
    else this.whisper(t(this.helping ? 'w.help' : 'w.turn'), 2600);
  }

  /**
   * Personne ne trace : Cymora s'impatiente avec douceur. Elle appelle (7 s), puis rechante
   * d'elle-même (16 s, deux fois au plus, sans compter d'essai), puis fredonne seule de temps en temps.
   */
  stepWaiting() {
    const a = this.afk ??= { stage: 0, replays: 0, next: 0, stir: 0 };
    const idle = this.clock - this.phaseAt;
    if (a.stage === 0 && idle > 7) {
      a.stage = 1;
      this.whisper(t('afk.1'), 3200);
      this.yearn(0.2);
    } else if (a.stage === 1 && idle > 16) {
      if (a.replays < 2) {
        a.replays++;
        this.whisper(t('afk.2'), 3000);
        this.enterCall(true);
        return null;
      }
      a.stage = 2;
      a.next = this.clock + 4;
    } else if (a.stage === 2 && this.clock >= a.next) {
      a.next = this.clock + 24;
      this.whisper(t(`afk.${3 + Math.floor(Math.random() * 3)}`), 3600);
      this.yearn(0.16);
    }
    return this.clock < a.stir ? { freq: G.degreeFreq(this.motif.notes[0].deg), energy: 0.32 } : null;
  }

  /** Sur le seuil, après 20 s sans geste : Cymora fredonne seule et aimerait qu'on la rejoigne. */
  longing() {
    const now = performance.now();
    const on = document.body.dataset.state === 'threshold' && now - this.lastInput > 20000;
    if (on !== this.longingOn) {
      this.longingOn = on;
      $('#threshold').classList.toggle('is-longing', on);
      this.longAt = 0;
    }
    if (on && now - this.longAt > 7000) {
      this.longAt = now;
      this.pulse(0.45);
      this.E.addWake(this.world, 0.5, 0.5, 0, 0, 0.1);
    }
  }

  /** Elle manifeste l'envie de jouer : une onde, la matière qui frémit, sa première note fredonnée. */
  yearn(velocity) {
    this.pulse(0.35);
    if (this.afk) this.afk.stir = this.clock + 1.4;
    const start = this.pointAt(0);
    this.E.addWake(this.world, start.x, start.y, 0, 0, 0.08);
    if (this.audio.enabled) this.audio.note(G.degreeFreq(this.motif.notes[0].deg), { voice: 'breath', velocity });
  }

  enterInterlude(seconds, then) {
    this.phase = 'interlude';
    this.phaseAt = this.clock;
    this.interlude = { until: this.clock + seconds, then };
  }

  judge(points) {
    if (this.lesson) return this.judgeLesson(points);
    if (this.accordLesson) { this.accordLesson = false; try { localStorage.setItem(ACCORD_SEEN, '1'); } catch { /* elle le redira */ } }
    if (this.mode === 'tide' || this.mode === 'daily') { try { localStorage.setItem(FIRST_SEEN, '1'); } catch { /* elle le redira */ } }
    const before = G.resonanceScore(this.progress);
    let r = G.attune(this.motif, points, this.passMark);
    const rhythm = this.motif.pulse ? G.rhythmOf(this.motif.notes, this.tune?.times ?? [], this.tempo, G.reachTimes(this.motif)) : null;
    this.rhythmFeedback = rhythm?.feedback ?? null;
    if (r.verdict === 'silent') {
      if (this.rhythmFeedback) {
        this.whisper(rhythmText(this.rhythmFeedback), 3200);
        this.attempts++;
        this.enterInterlude(3, () => this.enterCall());
      } else this.whisper(t('w.silent'), 2200);
      return;
    }
    // Notes tenues (dès le chapitre II, et dans l'atelier) : chaque tenue manquée retire jusqu'à 30 % du score.
    const holds = this.motif.notes.filter((n) => n.hold).length;
    let detail = '';
    if (holds) {
      const held = Math.min(holds, this.held ?? 0);
      const score = Math.round(r.score * (0.7 + (0.3 * held) / holds) * 1000) / 1000;
      r = { ...r, score, verdict: G.verdictOf(score, this.passMark) };
      detail = ` · ${t('w.holds', { n: held, of: holds })}`;
    }
    // Atelier Glisser / Silence : le geste compte pour 40 % ; le retour dit quoi retravailler.
    this.gestureFeedback = null;
    if (this.motif.notes.some((n) => n.glide)) {
      const gl = G.glideOf(this.motif, points, this.tune?.times ?? [], this.tempo);
      const score = Math.round(r.score * (0.6 + 0.4 * gl.score) * 1000) / 1000;
      r = { ...r, score, verdict: G.verdictOf(score, this.passMark), glide: gl };
      if (gl.feedback) this.gestureFeedback = t({ fast: 'w.glideFast', shaky: 'w.glideShaky', slow: 'w.glideSlow', missed: 'w.glideMissed' }[gl.feedback]);
      detail = ` · ${this.gestureFeedback ?? t('w.glideOk')}`;
    }
    if (this.motif.notes.some((n) => n.rest)) {
      const rs = G.restOf(this.motif, this.lifts ?? [], this.tempo);
      const score = Math.round(r.score * (0.6 + 0.4 * rs.score) * 1000) / 1000;
      r = { ...r, score, verdict: G.verdictOf(score, this.passMark), rest: rs };
      if (rs.feedback) this.gestureFeedback = t({ none: 'w.restNone', short: 'w.restShort', long: 'w.restLong' }[rs.feedback]);
      detail = ` · ${this.gestureFeedback ?? t('w.restOk')}`;
    }
    this.lifted = null;
    // Le rythme compte pour moitié et le retour désigne la note à retravailler.
    if (rhythm) {
      const score = Math.round(r.score * (0.5 + 0.5 * rhythm.score) * 1000) / 1000;
      r = { ...r, score, verdict: G.verdictOf(score, this.passMark), rhythm };
      if (!rhythm.feedback) detail = ` · ${rhythmText(null)}`;
    }
    this.holding = null;
    this.result = r;
    this.phase = 'echo';
    this.phaseAt = this.clock;
    this.nextNote = 0;
    const pass = r.score >= this.passMark;
    if (this.mode === 'trial') {
      this.echoNext = pass ? 'next' : 'again';
    } else if (this.mode === 'tide') {
      const out = G.recordTide(this.progress, this.tideIdx, this.motifIdx, r.score, pass ? G.chorusTrace(points) : null);
      this.progress = out.progress;
      this.echoNext = !pass ? 'again' : out.tideDone ? 'tideDone' : this.motifIdx + 1 < G.MOTIFS_PER_TIDE ? 'next' : 'replayDone';
    } else {
      this.progress = G.recordDay(this.progress, this.today, r.score);
      this.echoNext = pass ? 'dailyDone' : 'again';
      this.chorusShown = true;
      if (pass) this.joinChorus(points);
    }
    this.save();
    this.relabel();
    this.whisper(this.rhythmFeedback ? rhythmText(this.rhythmFeedback) : this.gestureFeedback && r.score < this.passMark ? this.gestureFeedback : t(r.score >= G.PERFECT ? 'w.perfect' : VERDICT[r.verdict] ?? 'w.far') + detail, 3600);
    if (pass) { this.pulse(r.verdict === 'resonance' ? 1 : 0.6); this.bloom(r.verdict === 'resonance' ? 1 : 0.55); }
    this.showGain(G.resonanceScore(this.progress) - before, Math.round(r.score * 100));
    this.syncScore(true);
    this.feel(r.verdict);
    if (pass && this.audio.enabled) {
      const freqs = [...new Set(this.motif.notes.map((n) => G.degreeFreq(n.deg)))].sort((a, b) => a - b);
      this.audio.chord(freqs, { velocity: r.verdict === 'resonance' ? 0.45 : 0.3 });
      // En résonance (et plus encore au parfait), l'accord s'épanouit : nappe soufflée, éclats aigus.
      if (r.score >= G.RESONANCE) this.audio.bloom(freqs, r.score >= G.PERFECT ? 1 : 0.7);
    }
  }

  afterEcho() {
    const next = this.echoNext;
    if (next === 'again') {
      this.attempts++;
      if (this.accordFirst()) return;
      return this.enterCall();
    }
    if (next === 'next') {
      this.motifIdx++;
      return this.newMotif();
    }
    if (next === 'tideDone') {
      this.showCard(t('card.done', { n: ROMAN[this.tideIdx] }), t(`after.${G.TIDES[this.tideIdx].id}`), '', 5200);
      this.pulse(1.4);
      this.feel('done');
      return this.enterInterlude(5, () => this.startTide(this.tideIdx + 1));
    }
    if (next === 'replayDone') {
      this.showCard(t('card.done', { n: ROMAN[this.tideIdx] }), '');
      return this.enterInterlude(3, () => this.startTide(this.progress.tide));
    }
    if (next === 'dailyDone') {
      const streak = G.liveStreak(this.progress, this.today);
      this.showCard(t('card.dailyDone'), `${t('card.dailyNext')}${streak ? ` ${streakText(streak)}.` : ''}`);
      if (this.chorus?.paths.length) setTimeout(() => this.whisper(this.joined ? this.chorusLine() : t('chorus.seen'), 5200), 6200);
      this.phase = 'idle';
      this.relabel();
    }
  }

  // ---------------------------------------------------------------- gestes

  toWorld(ev) {
    const b = this.cv.getBoundingClientRect();
    const r = this.rectCss;
    // Bornée par un cercle à peine plus grand que la plaque : jamais de bord carré.
    const x = (ev.clientX - b.left - r.x) / r.size - 0.5;
    const y = (ev.clientY - b.top - r.y) / r.size - 0.5;
    const k = Math.min(1, 0.5 / (Math.hypot(x, y) || 1));
    return { x: 0.5 + x * k, y: 0.5 + y * k };
  }

  bindGestures() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (ev) => {
      if (document.body.dataset.state !== 'play' || ev.button > 0) return;
      const w = this.toWorld(ev);
      this.beginTouch(w.x, w.y, ev.pointerId);
      try { cv.setPointerCapture(ev.pointerId); } catch { /* pointeur déjà perdu */ }
    });
    // Elle te suit : hors du tracé, la matière frémit sous la souris ou le doigt, et sa figure suit la hauteur du geste.
    addEventListener('pointermove', (ev) => {
      if (this.touch || this.phase === 'turn' || this.phase === 'free' || !this.rectCss) return;
      const now = performance.now();
      if (now - (this.gazeAt ?? 0) < 60) return;
      this.gazeAt = now;
      const w = this.toWorld(ev);
      const dx = w.x - 0.5;
      const dy = w.y - 0.5;
      const r = Math.hypot(dx, dy);
      const k = r > 0.46 ? 0.46 / r : 1; // hors de la plaque, elle regarde vers toi depuis son bord
      this.gaze = { x: 0.5 + dx * k, y: 0.5 + dy * k, at: this.clock };
      // Une onde à peine (le moteur refuse un rayon sous 0,02), espacée pour rester discrète.
      if (!reducedMotion && now - (this.gazeWakeAt ?? 0) > 240) {
        this.gazeWakeAt = now;
        this.E.addWake(this.world, this.gaze.x, this.gaze.y, 0, 0, 0.02);
      }
    }, { passive: true });
    // Curseur de la souris : une petite orbe lumineuse dessinée sur la plaque (le curseur système est caché).
    cv.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse' || !this.rectCss) return;
      const b = cv.getBoundingClientRect();
      const r = this.rectCss;
      this.hover = { x: (ev.clientX - b.left - r.x) / r.size, y: (ev.clientY - b.top - r.y) / r.size };
    });
    cv.addEventListener('pointerleave', () => { this.hover = null; });
    cv.addEventListener('pointermove', (ev) => {
      if (!this.touch || this.touch.id !== ev.pointerId) return;
      const events = ev.getCoalescedEvents?.() ?? [ev];
      for (const e of events.length ? events : [ev]) {
        const w = this.toWorld(e);
        this.moveTouch(w.x, w.y);
      }
    });
    const end = (ev) => { if (this.touch && this.touch.id === ev.pointerId) this.endTouch(); };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('keydown', (ev) => {
      if (document.body.dataset.state !== 'play') return;
      if (ev.key.startsWith('Arrow')) { ev.preventDefault(); this.keys.add(ev.key); }
      else if (ev.key === ' ' && !ev.repeat) { ev.preventDefault(); this.beginTouch(this.cursor.x, this.cursor.y, 'key'); }
    });
    cv.addEventListener('keyup', (ev) => {
      this.keys.delete(ev.key);
      if (ev.key === ' ' && this.touch?.id === 'key') this.endTouch();
    });
    cv.addEventListener('blur', () => {
      this.keys.clear();
      if (this.touch?.id === 'key') this.endTouch();
    });
    addEventListener('keydown', (ev) => {
      if (ev.target.closest?.('dialog')) return;
      if (ev.key === 'm' || ev.key === 'M') this.toggleSound();
      // Sur PC : F passe en plein écran (et en sort), pour ne garder que la plaque.
      if ((ev.key === 'f' || ev.key === 'F') && !ev.ctrlKey && !ev.metaKey && !ev.altKey && document.fullscreenEnabled) {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen().catch(() => {});
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!this.audio.enabled) return;
      this.audio.drone(!document.hidden && !this.herbier.open);
    });
  }

  canDraw() {
    return this.phase === 'turn' || this.phase === 'free' || (this.phase === 'idle' && this.mode === 'daily');
  }

  beginTouch(x, y, id) {
    if (this.phase === 'countIn') return;
    if (this.phase === 'interlude' && this.interlude && $('#card').classList.contains('is-on') && this.clock - this.phaseAt > 0.8) {
      // Lu ? Un toucher fait passer la carte.
      this.hideCard();
      this.interlude.until = Math.min(this.interlude.until, this.clock + 0.7);
      return;
    }
    if (this.phase === 'call') { this.whisper(t('w.wait'), 1400); return; }
    if (this.phase === 'idle' && this.mode === 'daily') { this.newMotif(); return; } // rejouer le chant du jour
    if (!this.canDraw()) return;
    if (this.mode === 'free' && this.play) return; // elle répond : la place est à la réponse
    this.touch = { x, y, id, path: [{ x, y }] };
    this.cursor = { x, y };
    if (this.phase === 'turn' && this.lifted && this.stroke) {
      // On reprend après un silence : même tour, même tracé ; on note la durée du silence.
      (this.lifts ??= []).push(this.clock - this.lifted.at);
      this.lifted = null;
      this.stroke.push({ t: this.clock, y });
      this.feel('touch');
      this.followTune(y);
      return;
    }
    if (this.phase === 'turn') {
      this.stroke = [{ t: this.clock, y }];
      this.live = null;
      this.gauge = 0;
      this.lifts = [];
      this.lifted = null;
      if (this.touchedAt == null && this.afk && (this.afk.stage > 0 || this.afk.replays > 0)) {
        this.whisper(t('afk.back'), 1600); // Te revoilà.
        this.afk.replays = 0;
      }
      this.touchedAt ??= this.clock;
    }
    this.E.addWake(this.world, x, y, 0, 0, 0.05);
    if (this.phase === 'turn') {
      this.feel('touch');
      this.tune = { next: 0, at: this.clock };
      this.held = 0;
      this.heldNotes = new Set();
      this.holding = null;
      this.followTune(y); // on peut poser le doigt directement sur la première note
    }
  }

  /**
   * Le doigt atteint, dans l'ordre, la hauteur de la note attendue : un frémissement et une lueur discrète.
   * Deux notes de même hauteur à la suite demandent un court instant entre elles.
   */
  followTune(y) {
    const tune = this.tune;
    const notes = this.motif?.notes;
    const want = this.phase === 'turn' && tune ? notes?.[tune.next] : null;
    if (!want || Math.abs(G.yDegree(y) - want.deg) >= 0.35) return;
    if (tune.next > 0 && notes[tune.next - 1].deg === want.deg && this.clock - tune.at < 0.25) return;
    tune.next++;
    tune.at = this.clock;
    (tune.times ??= [])[tune.next - 1] = this.clock;
    this.feel('note');
    this.pulse(0.22);
    const upcoming = notes[tune.next];
    if (upcoming?.glide) this.whisper(t('w.glideTurn'), 2000);
    if (upcoming?.rest) this.whisper(t('w.restTurn'), 2600);
    if (want.hold) {
      const idx = tune.next - 1;
      this.holding = { deg: want.deg, idx, point: this.song.notes[idx], k: 0, acc: 0, off: 0, done: false };
      this.whisper(t('w.hold'));
    }
  }

  moveTouch(x, y) {
    const tc = this.touch;
    const dx = x - tc.x;
    const dy = y - tc.y;
    tc.x = x;
    tc.y = y;
    this.cursor = { x, y };
    const last = tc.path[tc.path.length - 1];
    if (Math.hypot(x - last.x, y - last.y) > 0.004) tc.path.push({ x, y });
    if (tc.path.length > 900) tc.path.shift();
    this.followTune(y);
    const speed = Math.hypot(dx, dy);
    if (speed > 0.002) this.E.addWake(this.world, x, y, dx * 6, dy * 6, clamp(0.035 + speed * 2, 0.035, 0.08));
    // Étincelles : le doigt laisse une poussière de lumière qui retombe doucement.
    if (!reducedMotion && speed > 0.0015 && this.sparks.length < 240) {
      const a = Math.random() * Math.PI * 2;
      const v = 0.02 + Math.random() * 0.05;
      this.sparks.push({ x, y, vx: Math.cos(a) * v - dx * 2, vy: Math.sin(a) * v - dy * 2, at: this.clock, life: 0.6 + Math.random() * 0.7 });
    }
  }

  endTouch() {
    if (!this.touch) return;
    this.fading = { path: this.touch.path, at: this.clock, color: this.phase === 'turn' && this.live != null && this.live >= this.passMark ? mixHex(this.inks.stroke, '#ffd27a', 0.9) : this.inks.stroke };
    this.touch = null;
    // Silence : si l'on lève le doigt juste avant la phrase suivante, le tour attend qu'on reprenne.
    const rests = this.motif?.notes.filter((n) => n.rest).length ?? 0;
    const next = this.motif?.notes[this.tune?.next ?? 0];
    if (this.phase === 'turn' && this.stroke && rests && next?.rest && (this.lifts?.length ?? 0) < rests) {
      this.lifted = { at: this.clock, limit: Math.max(2.5, next.rest * this.tempo * 3) };
      return;
    }
    if (this.phase === 'turn' && this.stroke) {
      const points = this.stroke;
      this.stroke = null;
      this.judge(points);
    }
  }

  // ---------------------------------------------------------------- boucle

  frame(ts) {
    const dt = Math.min(0.1, (ts - this.last) / 1000);
    this.last = ts;
    if (this.herbier.open) {
      this.stepHerbier(ts);
      requestAnimationFrame((n) => this.frame(n));
      return;
    }
    const work0 = performance.now();
    this.acc = Math.min(this.acc + dt, STEP * 5);
    let steps = 0;
    while (this.acc >= STEP) {
      this.step();
      this.acc -= STEP;
      steps++;
    }
    this.longing();
    this.draw();
    const work = (performance.now() - work0) / Math.max(1, steps);
    this.frameMs += (work - this.frameMs) * 0.05;
    this.adapt();
    if (this.fields.size < MODES.length) for (let i = 0; i < MODES.length; i++) if (!this.fields.has(i)) { this.field(i); break; }
    requestAnimationFrame((n) => this.frame(n));
  }

  /**
   * Fluidité : si l'image ralentit, on retire des grains ; si elle redevient fluide un bon moment,
   * on les rend peu à peu (sans dépasser le nombre prévu pour l'écran). Les deux seuils sont écartés
   * pour ne pas osciller.
   */
  adapt() {
    if (document.hidden) return;
    this.slowFrames = this.frameMs > 12 ? this.slowFrames + 1 : 0;
    this.fastFrames = this.frameMs < 6.5 ? (this.fastFrames ?? 0) + 1 : 0;
    const n = this.world.p.n;
    if (this.slowFrames > 120 && n > 6000) {
      this.E.resetParticles(this.world, Math.round(n * 0.8));
      this.slowFrames = 0;
      this.fastFrames = 0;
    } else if (this.fastFrames > 360 && n < COUNT && this.phase !== 'turn') {
      this.E.resetParticles(this.world, Math.min(COUNT, Math.round(n * 1.2)));
      this.fastFrames = 0;
    }
  }

  /**
   * Atelier « Tenir » : sur une note cerclée, le doigt reste à sa hauteur pendant HOLD secondes.
   * La matière se rassemble sous lui, puis se cristallise. S'il s'éloigne avant, la tenue est perdue.
   */
  stepHold() {
    const h = this.holding;
    if (!h || h.done) return;
    const c = this.touch;
    if (!c || this.phase !== 'turn') { this.holding = null; return; }
    // Un tremblement bref ne casse pas la tenue : la jauge s'arrête, et ne se perd qu'après 0,25 s hors de la note.
    if (Math.abs(G.yDegree(c.y) - h.deg) > 0.6) {
      h.off = (h.off ?? 0) + STEP;
      if (h.off > 0.25) {
        this.holding = null;
        if (this.lesson?.kind === 'hold') {
          this.tune.next = 0;
          this.whisper(t('w.holdReturn'));
        } else this.whisper(t('w.holdLost'), 1800);
      }
      return;
    }
    h.off = 0;
    h.acc = (h.acc ?? 0) + STEP;
    const before = h.k;
    h.k = clamp(h.acc / G.HOLD, 0, 1);
    if (Math.random() < 0.25) this.E.addWake(this.world, c.x, c.y, 0, 0, 0.02 + h.k * 0.03);
    // La jauge se sent (un tic au tiers et aux deux tiers) et s'entend (un souffle à mi-chemin).
    if ((before < 1 / 3 && h.k >= 1 / 3) || (before < 2 / 3 && h.k >= 2 / 3)) haptic(50);
    if (before < 0.5 && h.k >= 0.5 && this.audio.enabled) this.audio.note(G.degreeFreq(h.deg), { voice: 'breath', velocity: 0.2, pan: (c.x - 0.5) * 1.2 });
    if (h.k >= 1) {
      h.done = true;
      this.holdSeal = { point: h.point, time: this.clock };
      this.held = (this.held ?? 0) + 1;
      (this.heldNotes ??= new Set()).add(h.idx);
      this.feel('close');
      this.pulse(0.5);
      this.bloom(0.35);
      if (this.audio.enabled) this.audio.note(G.degreeFreq(h.deg) * 2, { voice: 'bell', velocity: 0.28, pan: (c.x - 0.5) * 1.2 });
      if (this.lesson?.kind === 'hold') this.endTouch(); // tutoriel : l'anneau fermé suffit, pas besoin de lever le doigt
      else this.whisper(t(this.tune.next < this.motif.notes.length ? 'w.holdContinue' : 'w.holdRelease'), 2600);
    }
  }

  /**
   * Accord du moment (environ 5 fois par seconde) : lissé pour ne pas clignoter.
   * Quand le geste est juste, une harmonie douce accompagne la voix du doigt.
   */
  stepLive(y) {
    if (this.phase !== 'turn' || !this.stroke || !this.motif || this.lesson?.kind === 'hold') return;
    if (this.clock - (this.liveAt ?? 0) < 0.2) return;
    this.liveAt = this.clock;
    const a = G.liveAccord(this.motif, this.stroke, this.tempo);
    if (a == null) return;
    this.live = this.live == null ? a : this.live + (a - this.live) * 0.45;

    if (this.live >= this.passMark && this.audio.enabled && this.clock - (this.harmonyAt ?? 0) > 0.7) {
      this.harmonyAt = this.clock;
      this.audio.note(G.degreeFreq(Math.round(G.yDegree(y)) + 2), { voice: 'breath', velocity: 0.12 });
    }
    if (this.live >= this.passMark && Math.random() < 0.5) this.E.addWake(this.world, this.cursor.x, this.cursor.y, 0, 0, 0.03);
  }

  /** Avance un pas de temps fixe ; tick(n) en QA appelle step n fois. */
  tick(n = 1) { for (let i = 0; i < n; i++) this.step(); }

  step() {
    this.clock += STEP;
    if (this.keys.size) {
      const k = 0.35 * STEP;
      const dx = (this.keys.has('ArrowRight') ? k : 0) - (this.keys.has('ArrowLeft') ? k : 0);
      const dy = (this.keys.has('ArrowDown') ? k : 0) - (this.keys.has('ArrowUp') ? k : 0);
      this.cursor = { x: clamp(this.cursor.x + dx, 0, 1), y: clamp(this.cursor.y + dy, 0, 1) };
      if (this.touch?.id === 'key') this.moveTouch(this.cursor.x, this.cursor.y);
    }

    let target = null;
    if (this.touch) {
      const y = this.touch.y;
      // Accord du moment : la matière s'anime davantage quand le geste épouse le chant.
      target = { freq: G.yFreq(y), energy: 0.5 + 0.3 * (this.live ?? 0.4) };
      this.stepLive(y);
      this.singLive(y, this.touch.x);
      if (this.phase === 'turn' && this.stroke) {
        if (this.stroke.length < 900) this.stroke.push({ t: this.clock, y });
      }
      if (this.mode === 'free' && this.dialogue) {
        this.dialogue.input({ t: this.clock, x: this.touch.x, y, freq: G.yFreq(y), energy: 0.6 });
      }
    }

    this.stepHold();
    // Silence : doigt levé et jamais reposé, on finit par juger ce qui a été chanté.
    if (this.lifted && this.phase === 'turn' && this.clock - this.lifted.at > this.lifted.limit) { const pts = this.stroke; this.stroke = null; this.lifted = null; if (pts) this.judge(pts); }
    this.stepBeat();
    if (this.phase === 'turn' && this.live != null) this.gauge = (this.gauge ?? 0) + (this.live - (this.gauge ?? 0)) * Math.min(1, STEP * 5);
    if (this.phase === 'call') target = this.stepCall() ?? target;
    else if (this.phase === 'countIn' && this.clock - this.phaseAt >= COUNT_IN_BEATS * G.BEAT * this.tempo) this.enterTurn();
    else if (this.phase === 'echo') target = this.stepEcho() ?? target;
    else if (this.phase === 'interlude') {
      if (this.clock >= this.interlude.until) { this.hideCard(); const then = this.interlude.then; this.interlude = null; then(); }
      else target = this.breathe();
    } else if (this.phase === 'free') target = this.stepFree() ?? target;
    else if (this.phase === 'turn' && !this.touch && this.touchedAt == null && this.mode !== 'free') target = this.stepWaiting() ?? target;
    else if (!this.touch && (this.phase === 'idle' || this.mode === 'menu')) target = this.breathe();

    if (target?.freq) {
      const goal = modeIndex(target.freq);
      this.modeF += (goal - this.modeF) * Math.min(1, STEP * 3.2);
    }
    const goalE = target ? target.energy : 0;
    this.energy += (goalE - this.energy) * Math.min(1, STEP * (goalE > this.energy ? 4 : 0.9));

    this.E.stepWorld(this.world, STEP, this.settings);
    if (this.energy > 0.01) {
      const i = Math.floor(this.modeF);
      const a = this.field(i);
      const b = i + 1 < MODES.length ? this.field(i + 1) : null;
      applyCymatics(this.world.p, a, b, this.modeF - i, this.energy, STEP);
    }
  }

  /** Le chant de la matière : ses notes sonnent, sa figure les suit, son tracé se dessine. */
  stepCall() {
    const time = (this.clock - this.phaseAt) / this.tempo;
    const notes = this.motif.notes;
    while (this.nextNote < notes.length && notes[this.nextNote].at <= time) {
      const n = notes[this.nextNote++];
      const pt = this.pointAt(n.at);
      const k = this.nextNote - 1;
      if (n.glide && k > 0) {
        // Glissade : la voix glisse depuis la note d'avant, puis la note de verre se pose à l'arrivée.
        this.whisper(t('w.glideCall'), Math.round(n.glide * this.tempo * 1000));
        if (this.audio.enabled) {
          this.audio.glide(G.degreeFreq(notes[k - 1].deg), G.degreeFreq(n.deg), n.glide * this.tempo, { pan: (pt.x - 0.5) * 1.2 });
          this.audio.note(G.degreeFreq(n.deg), { voice: 'glass', velocity: 0.3, pan: (pt.x - 0.5) * 1.2, delay: n.glide * this.tempo });
        }
      } else if (this.audio.enabled) this.audio.note(G.degreeFreq(n.deg), { voice: 'glass', velocity: 0.34, pan: (pt.x - 0.5) * 1.2 });
      // Une note tenue : elle le dit, et un souffle prolonge la note de verre.
      if (n.hold) this.whisper(t('w.holdCall'), Math.round(n.dur * this.tempo * 1000));
      if (n.hold && this.audio.enabled) for (const delay of [0.35, 0.9]) this.audio.note(G.degreeFreq(n.deg), { voice: 'breath', velocity: 0.22, pan: (pt.x - 0.5) * 1.2, delay: delay * this.tempo });
      this.E.addWake(this.world, pt.x, pt.y, 0, 0, 0.06);
    }
    const rest = notes[this.nextNote];
    if (rest?.rest && !this.restWhispered && time > rest.at - rest.rest) { this.restWhispered = true; this.whisper(t('w.restCall'), Math.round(rest.rest * this.tempo * 1000)); }
    if (time > this.motif.duration + 0.7) {
      this.restWhispered = false;
      if (this.motif.pulse) {
        this.phase = 'countIn';
        this.phaseAt = this.clock;
        this.beatIdx = null;
        this.stepBeat();
      } else this.enterTurn();
      return null;
    }
    if (time > this.motif.duration) return { freq: 0, energy: 0.25 };
    return { freq: G.degreeFreq(G.motifDegreeAt(this.motif, time)), energy: 0.78 };
  }

  /** L'écho : si l'accord est juste, la matière rejoue le chant et se cristallise ; sinon elle reprend son souffle. */
  stepEcho() {
    const since = this.clock - this.phaseAt;
    const pass = this.result.score >= this.passMark;
    if (!pass) {
      if (since > (this.rhythmFeedback ? 3 : 1.6)) this.afterEcho();
      return { freq: 0, energy: 0.12 };
    }
    const time = since * 1.4;
    const notes = this.motif.notes;
    while (this.nextNote < notes.length && notes[this.nextNote].at <= time) {
      const n = notes[this.nextNote++];
      if (this.audio.enabled) this.audio.note(G.degreeFreq(n.deg) * 2, { voice: 'bell', velocity: 0.22, pan: 0 });
    }
    if (since > 4.2) { this.afterEcho(); return null; }
    const last = notes.at(-1);
    const freq = time < this.motif.duration ? G.degreeFreq(G.motifDegreeAt(this.motif, time)) : G.degreeFreq(last.deg);
    // La cristallisation : énergie pleine, la figure se fige et brille.
    return { freq, energy: this.result.verdict === 'resonance' ? 1 : 0.85 };
  }

  stepFree() {
    if (!this.dialogue) return null;
    const ev = this.dialogue.update(this.clock);
    if (ev?.type === 'answer') {
      this.play = { answer: ev.answer, start: this.clock, next: 0, trace: (ev.answer.trace ?? []).map((p) => ({ ...p, x: 1 - p.x })) };
      this.whisper(t('w.call'), 1600);
    } else if (ev?.type === 'idle') {
      try { localStorage.setItem(FREE_STORE, JSON.stringify(this.dialogue.memory.map(({ id, samples }) => ({ id, samples })))); } catch { /* sans stockage */ }
    }
    const p = this.play;
    if (!p) return this.touch ? null : this.breathe();
    const time = this.clock - p.start;
    const { notes = [], figures = [], duration = 0 } = p.answer;
    while (p.next < notes.length && notes[p.next].at <= time) {
      const n = notes[p.next++];
      if (this.audio.enabled) this.audio.note(n.freq, { voice: n.voice, velocity: n.velocity ?? 0.4, pan: n.pan ?? 0 });
    }
    if (time > duration + 0.6) { this.play = null; return null; }
    let fig = null;
    for (const f of figures) if (f.at <= time && time < f.at + (f.dur ?? 0.3)) fig = f;
    return fig ? { freq: fig.freq, energy: clamp(fig.energy ?? 0.6, 0, 1) } : { freq: 0, energy: 0.2 };
  }

  /** Respiration de repos : la matière passe lentement d'une figure à l'autre. */
  breathe() {
    const period = 9;
    const k = Math.floor(this.clock / period);
    const phase = (this.clock % period) / period;
    const breath = 0.26 * Math.sin(Math.PI * phase);
    // Si l'on bouge près d'elle, elle se tourne vers le geste : sa figure suit sa hauteur, un peu plus vive.
    const g = this.gaze;
    if (g && this.clock - g.at < 2.5) return { freq: G.yFreq(g.y), energy: Math.max(breath, 0.3) };
    return { freq: G.degreeFreq((k * 3) % G.DEGREES), energy: breath };
  }

  pointAt(at) {
    const tr = this.trace;
    let best = tr[0];
    for (const p of tr) { if (p.at <= at) best = p; else break; }
    return best;
  }

  /** Change la famille de figures (arrondies ou non) ; elles se recalculent au fil des images. */
  setRound(r) {
    if (r === this.round) return;
    this.round = r;
    this.fields = new Map();
  }

  /** Une onde part du centre et traverse la plaque. */
  /** Réussite : un éclair doux au cœur de la plaque et une gerbe de lumière qui s'envole vers la nuit. */
  bloom(k) {
    if (settings.calm) k *= 0.4;
    this.flash = { at: this.clock, k };
    if (reducedMotion) return;
    const n = Math.round(70 * k);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.3;
      const r = 0.12 + Math.random() * 0.3;
      const v = 0.08 + Math.random() * 0.22;
      this.sparks.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        at: this.clock, life: 1.1 + Math.random() * 1.3, burst: true, size: 1.4 + Math.random() * 1.8 });
    }
  }

  pulse(strength) {
    if (settings.calm) strength *= 0.4;
    this.pulses = [...(this.pulses ?? []).filter((p) => this.clock - p.at < PULSE), { at: this.clock, k: strength }];
  }

  /** Prépare toutes les figures en tranches, sans geler la page. */
  async prepare(onProgress) {
    this.setRound(this.progress.tide >= 2 ? ROUND : 0);
    for (let i = 0; i < MODES.length; i++) {
      this.field(i);
      onProgress((i + 1) / MODES.length);
      if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
    }
  }

  field(i) {
    let f = this.fields.get(i);
    if (!f) {
      f = buildField(MODES[i], undefined, this.round);
      this.fields.set(i, f);
    }
    return f;
  }

  singLive(y, x) {
    if (!this.audio.enabled) return;
    const q = G.yFreq(y);
    if (q === this.lastQ || this.clock - this.lastNoteAt < 0.12) return;
    this.lastQ = q;
    this.lastNoteAt = this.clock;
    this.audio.note(q, { voice: 'glass', velocity: 0.2, pan: (x - 0.5) * 1.2 });
  }

  // ---------------------------------------------------------------- dessin

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = innerWidth;
    const h = innerHeight;
    for (const c of [this.cv, this.inkCv]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    // Le champ est carré ; il laisse de l'air pour la barre et le murmure.
    // Sur grand écran, un panneau occupe la gauche et le champ grandit dans l'espace restant.
    const wide = WIDE.matches;
    document.body.dataset.layout = wide ? 'wide' : 'compact';
    let size;
    let x;
    let y;
    if (wide) {
      const side = clamp(w * 0.24, 290, 520);
      size = Math.min(h * 0.93, w - side - 100);
      x = side + 32 + (w - side - 32 - size) / 2;
      y = (h - size) / 2 + 8;
      document.body.style.setProperty('--side-w', `${side}px`);
    } else {
      size = Math.min(w * (w < 640 ? 0.96 : 0.9), h * (h < 520 ? 0.86 : 0.8));
      x = (w - size) / 2;
      y = (h - size) / 2 + (h < 520 ? 8 : 0);
    }
    this.rectCss = { x, y, size };
    document.body.style.setProperty('--field-cx', `${x + size / 2}px`);
    // Le murmure (« À toi », « En résonance ») se place sous la plaque ; sur téléphone en portrait,
    // nettement plus bas, au milieu de l'espace libre, pour ne pas couvrir la figure.
    const below = h - (y + size);
    const bottom = wide ? below + 18 : below > 120 ? below * 0.42 : Math.max(12, below - 34);
    document.body.style.setProperty('--field-bottom', `${Math.max(16, bottom)}px`);
    this.rect = { x: this.rectCss.x * dpr, y: this.rectCss.y * dpr, size: size * dpr };
    this.dpr = dpr;
    try {
      this.renderer.resize(this.cv.width, this.cv.height);
    } catch {
      this.renderer = createRenderer({ prefer: '2d' });
      this.renderer.resize(this.cv.width, this.cv.height);
    }
  }

  draw() {
    // Pendant qu'elle chante, et tant qu'on n'a pas répondu, la matière s'assombrit : son tracé se lit.
    const listening = (this.mode === 'tide' || this.mode === 'daily' || this.mode === 'trial') && (this.phase === 'call' || (this.phase === 'turn' && this.touchedAt == null))
      && (this.helping ? 'always' : this.guide) !== 'none';
    if (listening !== this.listening) { this.listening = listening; $('#scene').classList.toggle('is-listening', listening); }
    // Pendant qu'on trace, la matière se fait plus douce : les pointillés et le geste restent lisibles.
    const tracing = this.phase === 'turn' && this.touchedAt != null && this.mode !== 'free';
    if (tracing !== this.tracing) { this.tracing = tracing; $('#scene').classList.toggle('is-tracing', tracing); }
    const { ctx, cv } = this;
    if (this.renderer.lost && this.renderer.kind !== '2d') {
      this.renderer = createRenderer({ prefer: '2d' });
      this.renderer.resize(cv.width, cv.height);
    }
    this.renderer.draw(this.world.p ?? this.objectView(this.world.particles), { rect: this.rect, persistence: 0.86, dpr: this.dpr, bloom: 0.32 });
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.renderer.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    this.drawInk();
  }

  drawInk() {
    let g = this.ink; // « let » : le tracé du doigt se dessine un instant sur un calque à part (voir soft)
    const { x: ox, y: oy, size } = this.rect;
    const d = this.dpr;
    const holdRadius = 32 * d;
    g.clearRect(0, 0, this.inkCv.width, this.inkCv.height);
    const inks = this.inks ?? INKS.free;
    this.drawMotes(g, d, inks);
    this.drawPlate(g, ox, oy, size, d, inks);
    const X = (p) => ox + p.x * size;
    const Y = (p) => oy + p.y * size;
    // Courbe lissée (milieux reliés par des quadratiques) : plus de cassures entre les points du pointeur.
    const smooth = (path, from, to) => {
      g.moveTo(X(path[from]), Y(path[from]));
      for (let i = from + 1; i < to - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        g.quadraticCurveTo(X(a), Y(a), (X(a) + X(b)) / 2, (Y(a) + Y(b)) / 2);
      }
      g.lineTo(X(path[to - 1]), Y(path[to - 1]));
    };
    /**
     * Ruban de lumière : un halo large, un trait coloré en dégradé (de la couleur vers le violet),
     * un cœur blanc. Avec « taper », il s'affine vers la queue comme une comète.
     */
    const line = (path, color, width, alpha, upto = path.length, dash = null, taper = false) => {
      if (upto < 2 || alpha <= 0.01) return;
      const a = path[0];
      const b = path[upto - 1];
      const grad = g.createLinearGradient(X(a), Y(a), X(b) + 0.01, Y(b));
      grad.addColorStop(0, CHORUS_INK);
      grad.addColorStop(1, color);
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      if (dash) g.setLineDash(dash.map((v) => v * d));
      g.strokeStyle = grad;
      g.globalAlpha = alpha * 0.16;
      g.lineWidth = width * 5 * d;
      g.beginPath();
      smooth(path, 0, upto);
      g.stroke();
      g.globalAlpha = alpha;
      g.shadowColor = color;
      g.shadowBlur = 14 * d;
      if (taper && upto > 12) {
        const chunks = 10;
        for (let c = 0; c < chunks; c++) {
          const from = Math.floor(((upto - 1) * c) / chunks);
          const to = Math.min(upto, Math.floor(((upto - 1) * (c + 1)) / chunks) + 2);
          g.lineWidth = width * d * (0.3 + (0.9 * (c + 1)) / chunks);
          g.globalAlpha = alpha * (0.35 + (0.65 * (c + 1)) / chunks);
          g.beginPath();
          smooth(path, from, to);
          g.stroke();
        }
      } else {
        g.lineWidth = width * d;
        g.beginPath();
        smooth(path, 0, upto);
        g.stroke();
      }
      g.shadowBlur = 0;
      g.strokeStyle = '#ffffff';
      g.globalAlpha = alpha * 0.7;
      g.lineWidth = Math.max(0.6, width * 0.32) * d;
      g.beginPath();
      smooth(path, taper ? Math.floor(upto * 0.4) : 0, upto);
      g.stroke();
      g.restore();
    };
    /** Anneau fin (note tenue, ou jauge de tenue quand `frac` < 1, partant du haut). */
    const ring = (x, y, rad, color, alpha, frac = 1, width = 1.4, dash = null) => {
      if (alpha <= 0.01 || frac <= 0) return;
      g.save();
      g.globalAlpha = alpha;
      g.strokeStyle = color;
      g.shadowColor = color;
      g.shadowBlur = 12 * d;
      g.lineWidth = width * d;
      g.lineCap = 'round';
      if (dash) g.setLineDash(dash.map((v) => v * d));
      g.beginPath();
      g.arc(x, y, rad, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, frac));
      g.stroke();
      g.restore();
    };
    /** Le cercle distingue la note tenue. Pendant le chant, il se ferme au fil de la note. */
    const holdRing = (n, alpha, upto = 1) => {
      if (!n.hold || alpha <= 0.01) return;
      const breath = reducedMotion || settings.calm ? 0.5 : 0.5 + 0.5 * Math.sin(this.clock * 2.2);
      ring(X(n), Y(n), (20 + breath * 4) * d, inks.guide, alpha * (0.75 + 0.25 * breath), upto, 2.2);
    };
    /**
     * Pointillés du geste à faire : des points réguliers le long du chant, qui coulent lentement
     * dans le sens du tracé et respirent ; derrière le doigt, ils s'effacent.
     */
    const flow = (pts, alpha) => {
      if (pts.length < 2 || alpha <= 0.01) return;
      // Un point par instant du chant (et non par distance) : là où il ralentit, les points se resserrent ;
      // ils avancent à la vitesse exacte du chant. On lit ainsi l'allure du geste sur le chemin.
      const total = pts.at(-1).at;
      const gap = 0.1;
      const head = this.touch ? this.touch.path.at(-1).x : -1;
      g.save();
      g.fillStyle = inks.guide;
      g.shadowColor = inks.guide;
      g.shadowBlur = 6 * d;
      let j = 1;
      for (let s = (this.clock / this.tempo) % gap; s < total; s += gap) {
        while (j < pts.length - 1 && pts[j].at < s) j++;
        if (pts[j].brk) continue; // rien pendant un silence
        const u = clamp((s - pts[j - 1].at) / ((pts[j].at - pts[j - 1].at) || 1), 0, 1);
        const x = pts[j - 1].x + (pts[j].x - pts[j - 1].x) * u;
        const y = pts[j - 1].y + (pts[j].y - pts[j - 1].y) * u;
        if (pts[j].glide) g.fillStyle = GLIDE_INK; else g.fillStyle = inks.guide;
        const wave = 0.7 + 0.3 * Math.sin(this.clock * 1.6 - s * 6);
        g.globalAlpha = alpha * (x < head - 0.01 ? 0.2 : wave);
        g.beginPath();
        g.arc(ox + x * size, oy + y * size, 1.7 * d, 0, TAU);
        g.fill();
      }
      g.restore();
    };
    const bead = (p, color, r, alpha) => {
      g.save();
      g.globalAlpha = alpha;
      g.fillStyle = color;
      g.shadowColor = color;
      g.shadowBlur = 22 * d;
      g.beginPath();
      g.arc(ox + p.x * size, oy + p.y * size, r * d, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };

    if ((this.mode === 'tide' || this.mode === 'daily' || this.mode === 'trial') && this.song) {
      const guide = this.helping ? 'always' : this.guide;
      const { points, notes } = this.song;
      if (this.phase === 'call') {
        // Elle chante : la courbe se déroule, chaque note éclot en perle.
        const time = (this.clock - this.phaseAt) / this.tempo;
        let upto = 0;
        while (upto < points.length && points[upto].at <= time) upto++;
        const alpha = { always: 1, call: 1, glimpse: 0.45, none: 0 }[guide];
        // La tête de la courbe avance en douceur entre deux points, au lieu de sauter de l'un à l'autre.
        const shown = points.slice(0, upto);
        const a = points[upto - 1];
        const b = points[upto];
        if (a && b && !b.brk && b.at > a.at) { const u = clamp((time - a.at) / (b.at - a.at), 0, 1); shown.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, at: time, glide: b.glide }); }
        this.drawSong(g, X, Y, d, shown, shown.length, inks.guide, alpha);
        for (const n of notes) {
          const age = time - n.at;
          if (age < 0 || alpha === 0) continue;
          const bloom = Math.min(1, age / 0.35);
          this.orb(g, X(n), Y(n), (4 + n.dur * 5) * d * (0.5 + 0.5 * bloom), inks.guide, alpha * (0.55 + 0.45 * Math.max(0, 1 - age / n.dur)));
          holdRing(n, Math.max(alpha, 0.6), age / n.dur);
        }
      } else if (this.phase === 'turn' || this.phase === 'countIn') {
        // À toi : le chant reste en filigrane (selon le chapitre), la première perle respire.
        let alpha = { always: 0.72, call: 0.78, glimpse: 0, none: 0 }[guide];
        if (guide === 'call' && this.touchedAt != null) alpha *= clamp(1 - (this.clock - this.touchedAt) / 0.8, 0, 1);
        this.drawSong(g, X, Y, d, points, points.length, inks.guide, alpha);
        const dots = guide === 'glimpse' ? 0.22 : alpha;
        // Jeu relaxant : les pointillés du geste restent visibles pendant tout le tour, quel que soit le chapitre.
        flow(points, 0.75);
        // Glisser : une petite lumière avance au rythme exact du chant dès que tu touches ; suis-la sans la dépasser.
        if (this.motif?.notes.some((n) => n.glide) && this.touchedAt != null && this.phase === 'turn') {
          const tt = (this.clock - this.touchedAt) / this.tempo;
          let j = 1;
          while (j < points.length - 1 && points[j].at < tt) j++;
          const p0 = points[j - 1];
          const p1 = points[j];
          const u = clamp((tt - p0.at) / ((p1.at - p0.at) || 1), 0, 1);
          if (tt <= this.motif.duration + 0.3) {
            const px = X({ x: p0.x + (p1.x - p0.x) * u });
            const py = Y({ y: p0.y + (p1.y - p0.y) * u });
            const halo = g.createRadialGradient(px, py, 0, px, py, 22 * d);
            halo.addColorStop(0, 'rgba(255,255,255,0.95)');
            halo.addColorStop(0.3, rgba(GLIDE_INK, 0.7));
            halo.addColorStop(1, 'rgba(0,0,0,0)');
            g.save();
            g.fillStyle = halo;
            g.beginPath();
            g.arc(px, py, 22 * d, 0, TAU);
            g.fill();
            g.restore();
          }
        }
        // La prochaine tenue reste visible. Sa jauge apparaît quand c'est la note à jouer.
        const nextHold = notes.findIndex((n, i) => n.hold && i >= (this.tune && this.touch ? this.tune.next : 0) && !this.heldNotes?.has(i));
        notes.forEach((n, i) => {
          if (dots > 0.01) this.orb(g, X(n), Y(n), (4 + n.dur * 4) * d, inks.guide, dots * 0.85);
          if (!n.hold) return;
          const doneHere = this.heldNotes?.has(i) && this.touch;
          const active = this.holding?.idx === i && !this.holding.done;
          const ready = i === nextHold && (this.lesson?.kind === 'hold' || this.tune?.next === i);
          holdRing(n, doneHere || active ? 0.35 : ready ? 1 : Math.max(dots, 0.6));
          if (ready && !active) {
            ring(X(n), Y(n), holdRadius, inks.guide, 0.68, 1, 1.8);
          }
        });
        if (this.touchedAt == null && guide !== 'none') {
          const breath = 0.5 + 0.5 * Math.sin(this.clock * 2.4);
          const start = points[0];
          this.orb(g, X(start), Y(start), (6 + breath * 3) * d, inks.guide, guide === 'glimpse' ? 0.45 : 0.85);
          g.save();
          g.strokeStyle = inks.guide;
          g.lineWidth = d;
          g.globalAlpha = (1 - breath) * 0.4;
          g.beginPath();
          g.arc(X(start), Y(start), (10 + breath * 14) * d, 0, TAU);
          g.stroke();
          g.restore();
        }
      } else if (this.phase === 'echo' && this.result.verdict !== 'silent') {
        // Réussi : le chant s'affiche pleinement. Manqué : il revient en filigrane sous ton tracé, pour voir où le geste a dévié.
        const pass = this.result.score >= this.passMark;
        const since = this.clock - this.phaseAt;
        const fade = clamp(1 - (since - 2.6) / 1.5, 0, 1) * (pass ? 1 : clamp(since / 0.6, 0, 1) * 0.6);
        this.drawSong(g, X, Y, d, points, points.length, inks.guide, 0.85 * fade);
        for (const n of notes) this.orb(g, X(n), Y(n), (4 + n.dur * 5) * d, inks.guide, 0.8 * fade);
        // Les tenues réussies : un anneau plein ; manquées : un anneau brisé.
        const show = clamp(1 - (since - 2.6) / 1.5, 0, 1);
        notes.forEach((n, i) => {
          if (!n.hold || this.lesson) return;
          const ok = this.heldNotes?.has(i);
          ring(X(n), Y(n), 22 * d, inks.guide, (ok ? 0.95 : 0.9) * show, 1, ok ? 2.4 : 2, ok ? null : [4, 6]);
        });
      }
      if (this.motif.pulse && ['call', 'countIn', 'turn'].includes(this.phase) && this.beatIdx != null) {
        const note = this.phase === 'countIn' || (this.phase === 'turn' && !this.tune?.times?.length)
          ? notes[0] : notes.find((n) => Math.round(n.at / G.BEAT) === this.beatIdx);
        const age = clamp((this.clock - this.beatAt) / 0.29, 0, 1);
        if (note) ring(X(note), Y(note), (reducedMotion || settings.calm ? 22 : 19 + age * 8) * d, '#ffffff', 1 - age, 1, 2.3);
      }
      if (this.rhythmFeedback && (this.phase === 'echo' || this.phase === 'interlude')) {
        const { kind, index } = this.rhythmFeedback;
        const note = notes[index];
        if (this.phase === 'interlude') this.drawSong(g, X, Y, d, points, points.length, inks.guide, 0.42);
        this.orb(g, X(note), Y(note), 9 * d, '#ffd6a8', 0.9);
        ring(X(note), Y(note), 23 * d, '#fff1d7', 0.95, 1, 2.6, kind === 'missed' ? [5, 4] : null);
      }
    }

    // Le chœur du jour, en filigrane, une fois qu'on a soi-même répondu.
    if (this.mode === 'daily' && this.chorusShown && this.chorus?.paths.length && this.phase !== 'call' && this.phase !== 'turn') {
      // Les voix entrent une à une (6 s au plus pour toutes), chacune se dessine du début à la fin.
      const since = this.clock - (this.chorusAt ??= this.clock);
      const paths = this.chorus.paths;
      const gap = Math.min(0.45, 6 / paths.length);
      paths.forEach((path, i) => {
        const k = clamp((since - i * gap) / 1.6, 0, 1);
        if (k > 0) line(path, CHORUS_INK, 1.1, 0.16 * Math.min(1, k * 1.6), Math.max(2, Math.ceil(path.length * k)));
      });
    } else this.chorusAt = null;

    if (this.mode === 'free' && this.play?.trace?.length) {
      const time = this.clock - this.play.start;
      let upto = 0;
      while (upto < this.play.trace.length && this.play.trace[upto].at <= time) upto++;
      line(this.play.trace, inks.guide, 1.8, 0.7, upto);
    }

    /** Dessine sur un calque, puis le fond en douceur au bord de la plaque avant de le poser. */
    const soft = (fn) => {
      const main = g;
      const tc = (this.trailCv ??= document.createElement('canvas'));
      if (tc.width !== main.canvas.width || tc.height !== main.canvas.height) { tc.width = main.canvas.width; tc.height = main.canvas.height; }
      const tg = tc.getContext('2d');
      tg.clearRect(0, 0, tc.width, tc.height);
      g = tg;
      try { fn(); } finally { g = main; }
      const cx = ox + size / 2;
      const cy = oy + size / 2;
      const R = size * 0.47;
      const mask = tg.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.06);
      mask.addColorStop(0, '#000');
      mask.addColorStop(1, 'rgba(0,0,0,0)');
      tg.globalCompositeOperation = 'destination-in';
      tg.fillStyle = mask;
      tg.fillRect(0, 0, tc.width, tc.height);
      tg.globalCompositeOperation = 'source-over';
      main.drawImage(tc, 0, 0);
    };
    if (this.touch) soft(() => {
      // Le tracé se réchauffe et brille quand tu es juste ; pâle quand tu t'écartes.
      const live = this.phase === 'turn' && this.live != null ? this.live : null;
      const warm = live == null ? 0 : clamp((live - 0.55) / (this.passMark - 0.55), 0, 1);
      const ink = live == null ? inks.stroke : live >= this.passMark ? mixHex(inks.stroke, '#ffd27a', 0.9) : mixHex(mixHex(inks.stroke, '#7a8496', 0.85 * (1 - warm)), '#ffd27a', 0.45 * warm);
      line(this.touch.path, ink, 2.6 + (live >= this.passMark ? 0.8 : 0), 0.9, this.touch.path.length, null, true);
      const head = this.touch.path[this.touch.path.length - 1];
      const r = 16 * d;
      const glow = g.createRadialGradient(X(head), Y(head), 0, X(head), Y(head), r);
      glow.addColorStop(0, 'rgba(255,255,255,0.95)');
      glow.addColorStop(0.25, ink);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.save();
      g.globalAlpha = 0.85;
      g.fillStyle = glow;
      g.beginPath();
      g.arc(X(head), Y(head), r, 0, TAU);
      g.fill();
      g.restore();
    });
    else if (this.hover && document.body.dataset.state === 'play') {
      // Orbe-curseur : un halo doux, un anneau fin et un cœur blanc, à la couleur du chapitre.
      const hx = X(this.hover);
      const hy = Y(this.hover);
      const breath = 0.5 + 0.5 * Math.sin(this.clock * 2.2);
      const halo = g.createRadialGradient(hx, hy, 0, hx, hy, 34 * d);
      halo.addColorStop(0, inks.stroke);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      g.save();
      g.globalAlpha = 0.28;
      g.fillStyle = halo;
      g.beginPath();
      g.arc(hx, hy, 34 * d, 0, TAU);
      g.fill();
      g.globalAlpha = 0.8;
      g.strokeStyle = inks.stroke;
      g.shadowColor = inks.stroke;
      g.shadowBlur = 10 * d;
      g.lineWidth = 1.6 * d;
      g.beginPath();
      g.arc(hx, hy, (14 + breath * 2.5) * d, 0, TAU);
      g.stroke();
      g.globalAlpha = 0.95;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(hx, hy, 3.6 * d, 0, TAU);
      g.fill();
      g.restore();
    }
    if (document.body.dataset.state === 'play') {
      const h = this.holding;
      if (this.phase === 'turn' && this.touch && h && !h.done) {
        const x = X(h.point);
        const y = Y(h.point);
        ring(x, y, holdRadius, '#081021', 0.85, 1, 5);
        ring(x, y, holdRadius, inks.guide, 0.55, 1, 1.8);
        ring(x, y, holdRadius, '#ffffff', h.off > 0 ? 0.48 : 1, h.k, 3.2);
      }
      // L'anneau reste fermé un instant, même quand le tutoriel retire le pointeur.
      if (this.holdSeal) {
        const { point, time } = this.holdSeal;
        const fade = clamp((this.clock - time - 0.45) / 0.55, 0, 1);
        if (fade >= 1) this.holdSeal = null;
        else ring(X(point), Y(point), holdRadius, '#ffffff', 1 - fade, 1, 3.2);
      }
    }
    if (!this.touch && this.fading) {
      const age = this.clock - this.fading.at;
      const life = this.phase === 'echo' ? 3.6 : 2.2;
      if (age > life) this.fading = null;
      else soft(() => line(this.fading.path, this.fading.color, 2.4, 0.8 * (1 - age / life), this.fading.path.length, null, true));
    }

    // Étincelles du geste.
    if (this.sparks.length) {
      g.save();
      g.fillStyle = inks.stroke;
      this.sparks = this.sparks.filter((sp) => this.clock - sp.at < sp.life);
      for (const sp of this.sparks) {
        const age = (this.clock - sp.at) / sp.life;
        const dt = this.clock - sp.at;
        if (sp.burst) {
          const go = (1 - Math.exp(-dt * 1.6)) / 1.6; // elle file puis ralentit
          const x = ox + (sp.x + sp.vx * go) * size;
          const y = oy + (sp.y + sp.vy * go) * size;
          const twinkle = 0.6 + 0.4 * Math.sin(dt * 18 + sp.size * 9);
          g.globalAlpha = (1 - age) ** 1.5 * twinkle;
          g.fillStyle = inks.guide;
          g.beginPath();
          g.arc(x, y, sp.size * (1 - age * 0.5) * d, 0, TAU);
          g.fill();
          g.fillStyle = inks.stroke;
          continue;
        }
        const x = sp.x + sp.vx * dt;
        const y = sp.y + sp.vy * dt + 0.02 * dt * dt;
        g.globalAlpha = (1 - age) * 0.9;
        g.beginPath();
        g.arc(ox + x * size, oy + y * size, (1.4 - age) * d, 0, TAU);
        g.fill();
      }
      g.restore();
    }

    if (document.activeElement === this.cv && this.keys.size + (this.touch?.id === 'key' ? 1 : 0)) {
      g.strokeStyle = inks.stroke;
      g.lineWidth = 1.5 * d;
      g.beginPath();
      g.arc(ox + this.cursor.x * size, oy + this.cursor.y * size, 9 * d, 0, Math.PI * 2);
      g.stroke();
    }
  }

  /** La courbe du chant : un voile large et doux, puis un fil lumineux. Jamais de pointillés. */
  drawSong(g, X, Y, d, points, upto, color, alpha) {
    if (upto < 2 || alpha <= 0.01) return;
    const path = () => {
      g.beginPath();
      g.moveTo(X(points[0]), Y(points[0]));
      for (let i = 1; i < upto; i++) { if (points[i].brk) g.moveTo(X(points[i]), Y(points[i])); else g.lineTo(X(points[i]), Y(points[i])); }
    };
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = color;
    for (const [w, a] of [[20, 0.08], [9, 0.2]]) {
      g.lineWidth = w * d;
      g.globalAlpha = alpha * a;
      path();
      g.stroke();
    }
    g.lineWidth = 3.6 * d;
    g.globalAlpha = alpha * 0.95;
    g.shadowColor = color;
    g.shadowBlur = 16 * d;
    path();
    g.stroke();
    // Cœur blanc : la ligne reste lisible quelle que soit la couleur du chapitre.
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.lineWidth = 1.6 * d;
    g.globalAlpha = alpha * 0.95;
    path();
    g.stroke();
    // Longues glissades (atelier Glisser) : une autre couleur, plus large, et le mot « lentement ».
    let run = null;
    const runs = [];
    for (let i = 0; i < upto; i++) {
      if (points[i].glide) { (run ??= []).push(points[i]); } else if (run) { runs.push(run); run = null; }
    }
    if (run) runs.push(run);
    for (const r of runs) {
      if (r.length < 2) continue;
      g.strokeStyle = GLIDE_INK;
      g.shadowColor = GLIDE_INK;
      g.shadowBlur = 14 * d;
      g.lineWidth = 5 * d;
      g.globalAlpha = alpha * 0.85;
      g.beginPath();
      g.moveTo(X(r[0]), Y(r[0]));
      for (const p of r.slice(1)) g.lineTo(X(p), Y(p));
      g.stroke();
      // « lentement » reste fixe : au milieu de la glissade complète, affiché une fois la courbe arrivée là.
      const full = (this.song?.points ?? points).filter((p) => p.glide && p.at >= r[0].at - 1e-6);
      const whole = [];
      for (const p of full) { if (whole.length && p.at - whole.at(-1).at > 0.2) break; whole.push(p); }
      const mid = whole[Math.floor(whole.length / 2)] ?? r[Math.floor(r.length / 2)];
      if (r.at(-1).at < mid.at) continue;
      g.shadowBlur = 8 * d;
      g.fillStyle = GLIDE_INK;
      g.globalAlpha = alpha * 0.9;
      g.font = `italic ${14 * d}px Georgia, serif`;
      g.textAlign = 'center';
      g.fillText(t('w.slowly'), X(mid), Y(mid) - 16 * d);
    }
    g.restore();
  }

  /** Une perle de lumière : cœur blanc, halo coloré qui se dissout. */
  orb(g, x, y, r, color, alpha) {
    if (alpha <= 0.01) return;
    const halo = g.createRadialGradient(x, y, 0, x, y, r * 3);
    halo.addColorStop(0, 'rgba(255,255,255,1)');
    halo.addColorStop(0.22, rgba(color, 0.9));
    halo.addColorStop(0.5, rgba(color, 0.22));
    halo.addColorStop(1, rgba(color, 0));
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = halo;
    g.beginPath();
    g.arc(x, y, r * 3, 0, TAU);
    g.fill();
    g.restore();
  }

  /**
   * Poussière de nuit : des grains très lointains qui montent lentement et scintillent sur tout l'écran.
   * Ils s'éclairent quand la matière vibre, et la plaque les attire un peu : la scène respire au-delà du cercle.
   */
  drawMotes(g, d, inks) {
    const W = this.inkCv.width;
    const H = this.inkCv.height;
    // Plancton : plus nombreux sur un grand écran, pour que les côtés vivent aussi.
    const want = Math.round(clamp((innerWidth * innerHeight) / 6500, 110, 300));
    if (!this.motes || this.motes.length !== want) {
      const r = G.rng(11);
      this.motes = Array.from({ length: want }, () => ({ x: r(), y: r(), z: 0.15 + r() * 0.85, ph: r() * TAU, c: r(), f: r() < 0.06 }));
    }
    const e = clamp(this.energy, 0, 1);
    const still = reducedMotion ? 0 : 1;
    const t = this.clock * still;
    const cx = this.rect.x + this.rect.size / 2;
    const cy = this.rect.y + this.rect.size / 2;
    // Onde de résonance en cours : le plancton s'illumine avec la plaque.
    const wave = (this.pulses ?? []).reduce((a, p) => Math.max(a, p.k * clamp(1 - (this.clock - p.at) / PULSE, 0, 1)), 0);
    // Le doigt ou la souris écarte doucement les grains proches.
    const pointer = this.touch ? this.touch.path.at(-1) : this.hover;
    const px = pointer ? this.rect.x + pointer.x * this.rect.size : -1e9;
    const py = pointer ? this.rect.y + pointer.y * this.rect.size : -1e9;
    const calm = settings.calm ? 0.6 : 1;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      // Dérive lente et tourbillonnante, plus rapide pour les grains proches (parallaxe).
      let x = (((m.x + Math.sin(t * 0.05 * m.z + m.ph) * 0.03 + Math.sin(t * 0.013 + m.y * 6) * 0.01) % 1) + 1) % 1 * W;
      let y = (((m.y - t * 0.007 * m.z + Math.cos(t * 0.04 * m.z + m.ph * 2) * 0.008) % 1) + 1) % 1 * H;
      const dx = cx - x;
      const dy = cy - y;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = e * 0.05 * m.z * Math.min(1, (this.rect.size * 0.9) / dist);
      x += dx * pull;
      y += dy * pull;
      const qx = x - px;
      const qy = y - py;
      const near = Math.hypot(qx, qy);
      const reach = 90 * d;
      if (near < reach) { const push = (1 - near / reach) * 26 * d * m.z; x += (qx / (near || 1)) * push; y += (qy / (near || 1)) * push; }
      const twinkle = 0.55 + 0.45 * Math.sin(t * (0.8 + m.z * 1.6) + m.ph * 3);
      // Lucioles : de rares grains s'allument un instant.
      const flash = m.f ? Math.max(0, Math.sin(t * 0.6 + m.ph * 7)) ** 12 : 0;
      const a = ((0.08 + 0.34 * m.z) * twinkle * (0.75 + e * 0.6 + wave * 0.9) + flash * 0.8) * calm;
      const color = m.c < 0.45 ? inks.guide : m.c < 0.8 ? inks.stroke : '#ffffff';
      const rad = (0.5 + m.z * 1.5) * d;
      // Les grains proches portent un halo flou (bokeh).
      if (m.z > 0.7 || flash > 0.05) {
        g.globalAlpha = a * 0.22;
        g.drawImage(this.moteSprite(color), x - rad * 6, y - rad * 6, rad * 12, rad * 12);
      }
      g.globalAlpha = Math.min(1, a);
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  /** Halo flou d'un grain, préparé une fois par couleur. */
  moteSprite(color) {
    this.sprites ??= new Map();
    let s = this.sprites.get(color);
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = 64;
      const sg = s.getContext('2d');
      const grad = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, color);
      grad.addColorStop(0.35, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sg.globalAlpha = 0.9;
      sg.fillStyle = grad;
      sg.fillRect(0, 0, 64, 64);
      this.sprites.set(color, s);
    }
    return s;
  }

  /** Le bord de la plaque : un halo diffus, plus vif quand la matière vibre ; et les ondes de résonance. */
  drawPlate(g, ox, oy, size, d, inks) {
    const cx = ox + size / 2;
    const cy = oy + size / 2;
    const R = size * 0.47;
    const e = clamp(this.energy, 0, 1);
    g.save();
    // Pas de trait : une lueur qui naît juste avant le bord puis se dissout loin dans la nuit,
    // plus vive et plus large quand la matière vibre.
    const inner = R * 0.86;
    const outer = R * (1.75 + e * 0.35);
    const at = (r) => (r - inner) / (outer - inner);
    const glow = g.createRadialGradient(cx, cy, inner, cx, cy, outer);
    glow.addColorStop(0, rgba(CHORUS_INK, 0));
    glow.addColorStop(at(R * 0.99), rgba(CHORUS_INK, 0.08 + e * 0.12));
    glow.addColorStop(at(R * 1.05), rgba(inks.guide, 0.06 + e * 0.09));
    glow.addColorStop(at(R * 1.22), rgba(inks.guide, 0.03 + e * 0.045));
    glow.addColorStop(at(R * 1.45), rgba(CHORUS_INK, 0.012 + e * 0.018));
    glow.addColorStop(1, rgba(CHORUS_INK, 0));
    g.fillStyle = glow;
    g.beginPath();
    g.arc(cx, cy, outer, 0, TAU);
    g.arc(cx, cy, inner, 0, TAU, true);
    g.fill();
    // Jauge d'accord : un rail autour de la plaque, qui se remplit depuis le haut avec l'accord du moment.
    // Un repère doré marque le seuil de réussite ; au-delà, toute la jauge devient dorée.
    if (this.phase === 'turn' && this.live != null && (this.mode === 'trial' || this.mode === 'free' || this.accordLesson || seen(ACCORD_SEEN))) {
      const v = clamp(this.gauge ?? this.live, 0, 1);
      const pass = this.passMark;
      const ok = v >= pass;
      const warm = clamp((v - 0.5) / (pass - 0.5), 0, 1);
      const rail = R * 1.02;
      const top = -Math.PI / 2;
      const learn = this.accordLesson ? 0.5 + 0.5 * Math.sin(this.clock * 4) : 0;
      g.save();
      g.lineCap = 'round';
      g.globalAlpha = 0.16 + learn * 0.12;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3 * d;
      g.beginPath();
      g.arc(cx, cy, rail, 0, TAU);
      g.stroke();
      const color = ok ? '#ffd27a' : mixHex('#8a93a8', '#ffd27a', warm * 0.65);
      g.globalAlpha = ok ? 0.95 : 0.75;
      g.strokeStyle = color;
      g.shadowColor = color;
      g.shadowBlur = (ok ? 26 : 10) * d;
      g.lineWidth = (ok ? 5 : 3.4) * d;
      g.beginPath();
      g.arc(cx, cy, rail, top, top + TAU * Math.max(0.005, v));
      g.stroke();
      // Le repère du seuil : un trait doré qui traverse le rail (il pulse pendant le tutoriel).
      const a = top + TAU * pass;
      g.shadowColor = '#ffd27a';
      g.shadowBlur = (12 + learn * 18) * d;
      g.strokeStyle = '#ffd27a';
      g.globalAlpha = 0.95;
      g.lineWidth = (2.4 + learn * 1.6) * d;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (rail - 9 * d), cy + Math.sin(a) * (rail - 9 * d));
      g.lineTo(cx + Math.cos(a) * (rail + 9 * d), cy + Math.sin(a) * (rail + 9 * d));
      g.stroke();
      g.restore();
    }
    if (this.flash) {
      const age = (this.clock - this.flash.at) / 1.1;
      if (age >= 1) this.flash = null;
      else {
        const k = (1 - age) ** 2 * this.flash.k;
        const f = g.createRadialGradient(cx, cy, 0, cx, cy, R * (0.6 + age * 0.9));
        f.addColorStop(0, `rgba(255,255,255,${0.32 * k})`);
        f.addColorStop(0.35, rgba(inks.guide, 0.22 * k));
        f.addColorStop(1, rgba(inks.guide, 0));
        g.fillStyle = f;
        g.beginPath();
        g.arc(cx, cy, R * (0.6 + age * 0.9), 0, TAU);
        g.fill();
      }
    }
    for (const p of this.pulses ?? []) {
      const age = (this.clock - p.at) / PULSE;
      if (age >= 1) continue;
      const ease = 1 - (1 - age) ** 3;
      g.globalAlpha = (1 - age) * 0.55 * p.k;
      g.lineWidth = (1 + 2.5 * (1 - age)) * d;
      g.strokeStyle = inks.guide;
      g.shadowColor = inks.guide;
      g.shadowBlur = 26 * d;
      g.beginPath();
      g.arc(cx, cy, R * (0.06 + ease * 0.98), 0, TAU);
      g.stroke();
    }
    g.restore();
  }

  // ---------------------------------------------------------------- son et mots

  async toggleSound() {
    if (document.body.dataset.state !== 'play') return;
    if (this.audio.enabled) { this.audio.drone(false); this.audio.disable(); }
    else if (await this.audio.enable()) this.audio.drone(true);
    settings.sound = this.audio.enabled;
    saveSettings();
    this.syncSound();
  }

  syncSound() {
    const b = $('#sound');
    b.setAttribute('aria-pressed', String(this.audio.enabled));
    b.setAttribute('aria-label', t(this.audio.enabled ? 'sound.on' : 'sound.off'));
    b.title = t(this.audio.enabled ? 'sound.on' : 'sound.off');
  }

  showCard(title, text, hint = '', ms = 6000) {
    $('#card-title').textContent = title;
    $('#card-line').textContent = text;
    $('#card-hint').textContent = hint;
    $('#card-skip').textContent = t(FINE ? 'card.skipPc' : 'card.skip');
    $('#card').classList.add('is-on');
    clearTimeout(this.cardTimer);
    this.cardTimer = setTimeout(() => this.hideCard(), ms);
  }

  hideCard() {
    $('#card').classList.remove('is-on');
  }

  whisper(text, ms = 4000) {
    const w = $('#whisper');
    w.textContent = text;
    w.classList.add('is-on');
    clearTimeout(this.whisperTimer);
    this.whisperTimer = setTimeout(() => w.classList.remove('is-on'), ms);
  }

  toast(text, label, run) {
    const box = $('#toast');
    box.replaceChildren(text);
    if (label) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => { box.hidden = true; run(); });
      box.append(b);
    }
    box.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { box.hidden = true; }, label ? 7000 : 3800);
  }
}

function fatal(message) {
  const f = $('#fatal');
  f.textContent = message;
  f.hidden = false;
}

boot();
