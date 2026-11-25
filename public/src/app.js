// CYMORA — la scène. Auteur : CLAUDE.
// La matière chante un motif (sa figure de Chladni suit chaque note), puis c'est au visiteur
// de le retracer : la hauteur du geste est la note. game.js mesure l'accord ; s'il est juste,
// la matière se cristallise et la marée avance. En improvisation, on retrouve le dialogue libre
// de la V3 (phrase.js, CODEX) : on trace, on se tait, elle répond.

import { createObjectView, createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { MODES, applyCymatics, buildField, modeIndex } from './cymatics.js';
import * as G from './game.js';
import { createI18n, mountLangSwitch } from '../shared/i18n.js';
import { DICT } from './strings.js';

const i18n = createI18n(DICT);
const t = i18n.t;

const STEP = 1 / 60;
const STORE = 'cymora.progress.v1';
const FREE_STORE = 'cymora.free.v1';
const SEEN = 'cymora.prologue.v1';
const PULSE = 2.6; // durée d'une onde de résonance (s)
const TAU = Math.PI * 2;
const LEGACY = { [STORE]: 'resonance.progress.v1', [FREE_STORE]: 'resonance.free.v1' }; // noms d'avant Cymora
const COUNT = 12000;
const ROMAN = ['I', 'II', 'III', 'IV'];
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** Lit une clé, ou son ancien nom d'avant Cymora. */
const stored = (key) => localStorage.getItem(key) ?? localStorage.getItem(LEGACY[key]);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Couleurs de chaque moment : encre du guide, encre du geste. Le reste est en CSS. */
const INKS = {
  see: { guide: '#a6f7ff', stroke: '#d2c2ff' },
  follow: { guide: '#9dfff0', stroke: '#c4e4ff' },
  remember: { guide: '#d2c2ff', stroke: '#a6f0ff' },
  listen: { guide: '#eef2ff', stroke: '#c4d2ff' },
  daily: { guide: '#f0c8ff', stroke: '#b4f2ff' },
  free: { guide: '#8ff0ff', stroke: '#dccfff' },
};
const CHORUS_INK = '#a58cff';
/** Grand écran : un panneau à gauche, le champ à droite. Même seuil que la feuille de style. */
const WIDE = matchMedia('(min-width: 1000px) and (min-height: 560px) and (min-aspect-ratio: 5/4)');

boot();

async function boot() {
  i18n.apply();
  mountLangSwitch($('#lang'), i18n);
  document.title = t('meta.title');
  const began = performance.now();
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
  await openThreshold(began);
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
    requestAnimationFrame(() => box.classList.add('is-on'));
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
function haptic(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* pas de vibreur */ }
}

function splashProgress(k) {
  const v = Math.round(clamp(k, 0, 1) * 100);
  $('#splash-fill').style.transform = `scaleX(${v / 100})`;
  $('#splash-bar').setAttribute('aria-valuenow', String(v));
}

/** Fin du chargement. Au premier lancement, le prologue se lit avant d'entrer ; ensuite, on entre directement. */
async function openThreshold(began) {
  let seen = false;
  try { seen = Boolean(localStorage.getItem(SEEN)); } catch { seen = false; }
  const splash = $('#splash');
  splash.classList.add('is-ready');
  if (seen && !new URLSearchParams(location.search).has('prologue')) {
    await new Promise((r) => setTimeout(r, Math.max(0, 1100 - (performance.now() - began))));
    document.body.dataset.state = 'threshold';
    return;
  }
  const lines = [...$('#prologue').children];
  $('#prologue').hidden = false;
  const enter = $('#splash-enter');
  const skip = $('#splash-skip');
  skip.hidden = false;
  const timers = [];
  const showAll = () => {
    timers.forEach(clearTimeout);
    lines.forEach((l) => l.classList.add('is-on'));
    skip.hidden = true;
    enter.hidden = false;
    enter.focus({ preventScroll: true });
  };
  lines.forEach((l, i) => timers.push(setTimeout(() => l.classList.add('is-on'), 500 + i * (reducedMotion ? 300 : 2600))));
  timers.push(setTimeout(showAll, 500 + lines.length * (reducedMotion ? 300 : 2600)));
  skip.addEventListener('click', showAll, { once: true });
  await new Promise((r) => enter.addEventListener('click', r, { once: true }));
  try { localStorage.setItem(SEEN, '1'); } catch { /* sans stockage : le prologue reviendra */ }
  document.body.dataset.state = 'threshold';
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
    this.audio = createAudio();
    this.settings = { ...E.DEFAULTS, speed: reducedMotion ? 0.3 : 0.55, turbulence: 0.18, glow: 0.6 };
    this.world = E.createWorld(20261125);
    this.world.nodes = [];
    E.resetParticles(this.world, COUNT);
    this.fields = new Map();
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
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
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

  load() {
    try { return G.readProgress(stored(STORE)); } catch { return G.freshProgress(); }
  }

  /** Sauvegarde locale après chaque réponse ; une coche brève le confirme près du score. */
  save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(this.progress));
      const mark = $('#score-saved');
      mark.classList.remove('is-on');
      void mark.offsetWidth; // relance l'animation
      mark.classList.add('is-on');
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
    if (kind === 'resonance') haptic([14, 60, 26]);
    else if (kind === 'close') haptic(18);
    else if (kind === 'far') haptic([8, 70, 8]);
    else if (kind === 'done') haptic([20, 70, 20, 70, 40]);
    else if (kind === 'touch') haptic(6);
    if (kind === 'touch') return;
    const scene = $('#scene');
    scene.classList.remove('is-yes', 'is-no');
    void scene.offsetWidth;
    scene.classList.add(kind === 'far' ? 'is-no' : 'is-yes');
  }

  // ---------------------------------------------------------------- seuil et barre

  bindThreshold() {
    const go = async (withSound, then) => {
      if (withSound) await this.audio.enable();
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

  bindBar() {
    $('#sound').addEventListener('click', () => this.toggleSound());
    $('#where').addEventListener('click', () => this.openMap());
    const map = $('#map');
    $('#map-daily').addEventListener('click', () => { map.close(); this.startDaily(); });
    $('#map-free').addEventListener('click', () => { map.close(); this.startFree(); });
    $('#side-map').addEventListener('click', () => this.openMap());
    $('#reset').addEventListener('click', () => {
      const before = this.progress;
      this.progress = G.freshProgress();
      this.save();
      this.syncScore();
      map.close();
      this.toast(t('t.reset'), t('t.undo'), () => { this.progress = before; this.save(); this.syncScore(); this.relabel(); });
      this.startTide(0);
    });
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
      name.textContent = `${ROMAN[k]} · ${t(`tide.${tide.id}`)}`;
      const line = document.createElement('span');
      line.className = 'tide__line';
      line.textContent = unlocked ? t(`line.${tide.id}`) : t('map.locked');
      b.append(name, line, this.pearlsFor(k));
      b.addEventListener('click', () => { $('#map').close(); this.startTide(k); });
      li.append(b);
      list.append(li);
    });
    const done = (this.progress.days[this.today] ?? 0) >= G.PASS;
    const streak = G.liveStreak(this.progress, this.today);
    $('#map-daily-state').textContent = `${t(done ? 'map.dailyDone' : 'map.dailyTodo')}${streak ? ` · ${t('streak', { n: streak })}` : ''}`;
    $('#map').showModal();
  }

  pearlsFor(k) {
    const box = document.createElement('span');
    box.className = 'pearls';
    const best = this.progress.best[k] ?? [];
    best.forEach((v, i) => {
      const p = document.createElement('span');
      p.className = `pearl${v >= G.RESONANCE ? ' is-res' : v >= G.PASS ? ' is-close' : ''}`;
      const state = v >= G.RESONANCE ? 'pearl.res' : v >= G.PASS ? 'pearl.close' : 'pearl.none';
      p.title = t('pearl', { n: i + 1, state: t(state) });
      box.append(p);
    });
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', best.map((v, i) => t('pearl', { n: i + 1, state: t(v >= G.RESONANCE ? 'pearl.res' : v >= G.PASS ? 'pearl.close' : 'pearl.none') })).join(', '));
    return box;
  }

  relabel() {
    document.title = t('meta.title');
    const started = this.progress.tide > 0 || this.progress.index > 0;
    $('#begin-label').textContent = t(started ? 'resume' : 'begin');
    const streak = G.liveStreak(this.progress, this.today ?? G.localDate());
    $('#daily-badge').textContent = streak ? t('streak', { n: streak }) : '';
    let label = '';
    if (this.mode === 'tide') label = t('where', { n: ROMAN[this.tideIdx], name: t(`tide.${G.TIDES[this.tideIdx].id}`) });
    else if (this.mode === 'daily') label = t('where.daily');
    else if (this.mode === 'free') label = t('where.free');
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
      kicker = `${t('story.chapter', { n: this.tideIdx + 1 })} · ${Math.min(G.MOTIFS_PER_TIDE, (this.motifIdx ?? 0) + 1)}/${G.MOTIFS_PER_TIDE}`;
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
    }
    $('#side-kicker').textContent = kicker;
    $('#side-title').textContent = title;
    $('#side-story').textContent = story;
    $('#side-line').textContent = line;
    $('#side-pearls').replaceChildren(...(this.mode === 'tide' ? [this.pearlsFor(this.tideIdx)] : []));
    const score = $('#side-score');
    score.replaceChildren();
    if (this.result && this.mode !== 'free' && this.result.verdict !== 'silent') {
      const b = document.createElement('b');
      b.textContent = t('side.score', { n: Math.round(this.result.score * 100) });
      score.append(b, t(this.result.verdict === 'resonance' ? 'w.resonance' : this.result.verdict === 'close' ? 'w.close' : 'w.far'));
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
  }

  // ---------------------------------------------------------------- parcours

  startTide(k) {
    if (k >= G.TIDES.length) return this.endOfTides();
    this.mode = 'tide';
    this.result = null;
    this.tideIdx = k;
    // Une marée déjà franchie se rejoue depuis son premier chant ; la marée en cours reprend où l'on était.
    this.motifIdx = k === this.progress.tide ? this.progress.index : 0;
    this.setTone(G.TIDES[k].id);
    this.relabel();
    const id = G.TIDES[k].id;
    this.showCard(t('card.tide', { n: ROMAN[k] }) + ' · ' + t(`tide.${id}`), t(`story.${id}`), t(`line.${id}`), 7000);
    this.enterInterlude(5.6, () => this.newMotif());
  }

  startDaily() {
    this.mode = 'daily';
    this.result = null;
    this.chorusShown = false;
    try { this.joined = Boolean(localStorage.getItem(`cymora.chorus.${this.today}`)); } catch { this.joined = false; }
    this.loadChorus();
    this.setTone('daily');
    this.relabel();
    const done = (this.progress.days[this.today] ?? 0) >= G.PASS;
    this.showCard(t('card.daily'), done ? t('card.dailyDone') : t('card.dailyLine'));
    this.enterInterlude(3.6, () => this.newMotif());
  }

  startFree() {
    this.mode = 'free';
    this.setTone('free');
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
    this.showCard(t('card.end'), t('card.endLine'), '', 10000);
    this.pulse(1.6);
    this.phase = 'idle';
  }

  newMotif() {
    this.motif = this.mode === 'daily' ? G.dailyMotif(this.today) : G.tideMotif(this.tideIdx, this.motifIdx);
    this.trace = G.motifTrace(this.motif);
    this.attempts = 0;
    this.updateSide();
    this.enterCall();
  }

  get guide() {
    if (this.mode === 'daily') return 'call';
    return G.TIDES[this.tideIdx]?.guide ?? 'always';
  }

  /** Après deux essais sans accord, la matière montre le chemin, quelle que soit la marée. */
  get helping() {
    return this.attempts >= 2 && this.guide !== 'always';
  }

  enterCall() {
    this.phase = 'call';
    this.phaseAt = this.clock;
    this.tempo = this.attempts ? 1.25 : 1; // elle rechante plus lentement
    this.nextNote = 0;
    this.stroke = null;
    this.whisper(t('w.call'), 1800);
  }

  enterTurn() {
    this.phase = 'turn';
    this.phaseAt = this.clock;
    this.touchedAt = null;
    this.whisper(t(this.helping ? 'w.help' : 'w.turn'), 2600);
  }

  enterInterlude(seconds, then) {
    this.phase = 'interlude';
    this.phaseAt = this.clock;
    this.interlude = { until: this.clock + seconds, then };
  }

  judge(points) {
    const before = G.resonanceScore(this.progress);
    const r = G.attune(this.motif, points);
    if (r.verdict === 'silent') {
      this.whisper(t('w.silent'), 2200);
      return;
    }
    this.result = r;
    this.phase = 'echo';
    this.phaseAt = this.clock;
    this.nextNote = 0;
    const pass = r.score >= G.PASS;
    if (this.mode === 'tide') {
      const out = G.recordTide(this.progress, this.tideIdx, this.motifIdx, r.score);
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
    this.whisper(t(r.verdict === 'resonance' ? 'w.resonance' : r.verdict === 'close' ? 'w.close' : 'w.far'), 3200);
    if (pass) this.pulse(r.verdict === 'resonance' ? 1 : 0.6);
    this.showGain(G.resonanceScore(this.progress) - before, Math.round(r.score * 100));
    this.syncScore(true);
    this.feel(r.verdict);
    if (pass && this.audio.enabled) {
      const freqs = [...new Set(this.motif.notes.map((n) => G.degreeFreq(n.deg)))].sort((a, b) => a - b);
      this.audio.chord(freqs, { velocity: r.verdict === 'resonance' ? 0.45 : 0.3 });
    }
  }

  afterEcho() {
    const next = this.echoNext;
    if (next === 'again') {
      this.attempts++;
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
      this.showCard(t('card.dailyDone'), `${t('card.dailyNext')}${streak ? ` ${t('streak', { n: streak })}.` : ''}`);
      if (this.chorus?.paths.length) setTimeout(() => this.whisper(this.joined ? this.chorusLine() : t('chorus.seen'), 5200), 6200);
      this.phase = 'idle';
      this.relabel();
    }
  }

  // ---------------------------------------------------------------- gestes

  toWorld(ev) {
    const b = this.cv.getBoundingClientRect();
    const r = this.rectCss;
    return { x: clamp((ev.clientX - b.left - r.x) / r.size, 0, 1), y: clamp((ev.clientY - b.top - r.y) / r.size, 0, 1) };
  }

  bindGestures() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (ev) => {
      if (document.body.dataset.state !== 'play' || ev.button > 0) return;
      const w = this.toWorld(ev);
      this.beginTouch(w.x, w.y, ev.pointerId);
      try { cv.setPointerCapture(ev.pointerId); } catch { /* pointeur déjà perdu */ }
    });
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
    });
    document.addEventListener('visibilitychange', () => {
      if (!this.audio.enabled) return;
      this.audio.drone(!document.hidden);
    });
  }

  canDraw() {
    return this.phase === 'turn' || this.phase === 'free' || (this.phase === 'idle' && this.mode === 'daily');
  }

  beginTouch(x, y, id) {
    if (this.phase === 'call') { this.whisper(t('w.wait'), 1400); return; }
    if (this.phase === 'idle' && this.mode === 'daily') { this.newMotif(); return; } // rejouer le chant du jour
    if (!this.canDraw()) return;
    if (this.mode === 'free' && this.play) return; // elle répond : la place est à la réponse
    this.touch = { x, y, id, path: [{ x, y }] };
    this.cursor = { x, y };
    if (this.phase === 'turn') {
      this.stroke = [{ t: this.clock, y }];
      this.touchedAt ??= this.clock;
    }
    this.E.addWake(this.world, x, y, 0, 0, 0.05);
    if (this.phase === 'turn') this.feel('touch');
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
    const speed = Math.hypot(dx, dy);
    if (speed > 0.002) this.E.addWake(this.world, x, y, dx * 6, dy * 6, clamp(0.035 + speed * 2, 0.035, 0.08));
    // Étincelles : le doigt laisse une poussière de lumière qui retombe doucement.
    if (!reducedMotion && speed > 0.0015 && this.sparks.length < 160) {
      const a = Math.random() * Math.PI * 2;
      const v = 0.02 + Math.random() * 0.05;
      this.sparks.push({ x, y, vx: Math.cos(a) * v - dx * 2, vy: Math.sin(a) * v - dy * 2, at: this.clock, life: 0.6 + Math.random() * 0.7 });
    }
  }

  endTouch() {
    if (!this.touch) return;
    this.fading = { path: this.touch.path, at: this.clock, color: this.inks.stroke };
    this.touch = null;
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
    const work0 = performance.now();
    this.acc = Math.min(this.acc + dt, STEP * 5);
    let steps = 0;
    while (this.acc >= STEP) {
      this.step();
      this.acc -= STEP;
      steps++;
    }
    this.draw();
    const work = (performance.now() - work0) / Math.max(1, steps);
    this.frameMs += (work - this.frameMs) * 0.05;
    this.adapt();
    if (this.fields.size < MODES.length) for (let i = 0; i < MODES.length; i++) if (!this.fields.has(i)) { this.field(i); break; }
    requestAnimationFrame((n) => this.frame(n));
  }

  adapt() {
    if (document.hidden) return;
    this.slowFrames = this.frameMs > 12 ? this.slowFrames + 1 : 0;
    if (this.slowFrames > 120 && this.world.p.n > 5000) {
      this.E.resetParticles(this.world, Math.round(this.world.p.n * 0.75));
      this.slowFrames = 0;
    }
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
      target = { freq: G.yFreq(y), energy: 0.62 };
      this.singLive(y, this.touch.x);
      if (this.phase === 'turn' && this.stroke) {
        if (this.stroke.length < 900) this.stroke.push({ t: this.clock, y });
      }
      if (this.mode === 'free' && this.dialogue) {
        this.dialogue.input({ t: this.clock, x: this.touch.x, y, freq: G.yFreq(y), energy: 0.6 });
      }
    }

    if (this.phase === 'call') target = this.stepCall() ?? target;
    else if (this.phase === 'echo') target = this.stepEcho() ?? target;
    else if (this.phase === 'interlude') {
      if (this.clock >= this.interlude.until) { this.hideCard(); const then = this.interlude.then; this.interlude = null; then(); }
      else target = this.breathe();
    } else if (this.phase === 'free') target = this.stepFree() ?? target;
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
      if (this.audio.enabled) this.audio.note(G.degreeFreq(n.deg), { voice: 'glass', velocity: 0.34, pan: (pt.x - 0.5) * 1.2 });
      this.E.addWake(this.world, pt.x, pt.y, 0, 0, 0.06);
    }
    if (time > this.motif.duration + 0.7) { this.enterTurn(); return null; }
    if (time > this.motif.duration) return { freq: 0, energy: 0.25 };
    return { freq: G.degreeFreq(G.motifDegreeAt(this.motif, time)), energy: 0.78 };
  }

  /** L'écho : si l'accord est juste, la matière rejoue le chant et se cristallise ; sinon elle reprend son souffle. */
  stepEcho() {
    const since = this.clock - this.phaseAt;
    const pass = this.result.score >= G.PASS;
    if (!pass) {
      if (since > 1.6) this.afterEcho();
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
    return { freq: G.degreeFreq((k * 3) % G.DEGREES), energy: 0.26 * Math.sin(Math.PI * phase) };
  }

  pointAt(at) {
    const tr = this.trace;
    let best = tr[0];
    for (const p of tr) { if (p.at <= at) best = p; else break; }
    return best;
  }

  /** Une onde part du centre et traverse la plaque. */
  pulse(strength) {
    this.pulses = [...(this.pulses ?? []).filter((p) => this.clock - p.at < PULSE), { at: this.clock, k: strength }];
  }

  /** Prépare toutes les figures en tranches, sans geler la page. */
  async prepare(onProgress) {
    for (let i = 0; i < MODES.length; i++) {
      this.field(i);
      onProgress((i + 1) / MODES.length);
      if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
    }
  }

  field(i) {
    let f = this.fields.get(i);
    if (!f) {
      f = buildField(MODES[i]);
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
      const side = clamp(w * 0.24, 290, 380);
      size = Math.min(h * 0.88, w - side - 120);
      x = side + 32 + (w - side - 32 - size) / 2;
      y = (h - size) / 2 + 12;
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
    const g = this.ink;
    const { x: ox, y: oy, size } = this.rect;
    const d = this.dpr;
    g.clearRect(0, 0, this.inkCv.width, this.inkCv.height);
    const inks = this.inks ?? INKS.free;
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

    if ((this.mode === 'tide' || this.mode === 'daily') && this.trace) {
      const guide = this.helping ? 'always' : this.guide;
      if (this.phase === 'call') {
        const time = (this.clock - this.phaseAt) / this.tempo;
        let upto = 0;
        while (upto < this.trace.length && this.trace[upto].at <= time) upto++;
        const alpha = { always: 0.85, call: 0.8, glimpse: 0.22, none: 0 }[guide];
        line(this.trace, inks.guide, 2.4, alpha, upto, null, true);
        if (upto && upto < this.trace.length && guide !== 'none') bead(this.trace[upto - 1], inks.guide, 4.5, 0.9);
      } else if (this.phase === 'turn') {
        let alpha = { always: 0.32, call: 0.42, glimpse: 0, none: 0 }[guide];
        if (guide === 'call' && this.touchedAt != null) alpha *= clamp(1 - (this.clock - this.touchedAt) / 0.6, 0, 1);
        line(this.trace, inks.guide, 1.6, alpha, this.trace.length, [2, 7]);
        // Le point de départ reste visible tant qu'on n'a pas commencé : où poser le doigt.
        if (this.touchedAt == null && guide !== 'none') bead(this.trace[0], inks.guide, 5 + Math.sin(this.clock * 3) * 1.2, guide === 'glimpse' ? 0.35 : 0.6);
      } else if (this.phase === 'echo' && this.result.score >= G.PASS) {
        const since = this.clock - this.phaseAt;
        const fade = clamp(1 - (since - 2.6) / 1.5, 0, 1);
        line(this.trace, inks.guide, 2.6, 0.8 * fade);
      }
    }

    // Le chœur du jour, en filigrane, une fois qu'on a soi-même répondu.
    if (this.mode === 'daily' && this.chorusShown && this.chorus?.paths.length && this.phase !== 'call' && this.phase !== 'turn') {
      const appear = clamp((this.clock - (this.chorusAt ??= this.clock)) / 2.5, 0, 1);
      for (const path of this.chorus.paths) line(path, CHORUS_INK, 1.1, 0.16 * appear, path.length);
    } else this.chorusAt = null;

    if (this.mode === 'free' && this.play?.trace?.length) {
      const time = this.clock - this.play.start;
      let upto = 0;
      while (upto < this.play.trace.length && this.play.trace[upto].at <= time) upto++;
      line(this.play.trace, inks.guide, 1.8, 0.7, upto);
    }

    if (this.touch) {
      line(this.touch.path, inks.stroke, 2.6, 0.9, this.touch.path.length, null, true);
      const head = this.touch.path[this.touch.path.length - 1];
      const r = 16 * d;
      const glow = g.createRadialGradient(X(head), Y(head), 0, X(head), Y(head), r);
      glow.addColorStop(0, 'rgba(255,255,255,0.95)');
      glow.addColorStop(0.25, inks.stroke);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.save();
      g.globalAlpha = 0.85;
      g.fillStyle = glow;
      g.beginPath();
      g.arc(X(head), Y(head), r, 0, TAU);
      g.fill();
      g.restore();
    }
    else if (this.fading) {
      const age = this.clock - this.fading.at;
      const life = this.phase === 'echo' ? 3.6 : 2.2;
      if (age > life) this.fading = null;
      else line(this.fading.path, this.fading.color, 2.4, 0.8 * (1 - age / life), this.fading.path.length, null, true);
    }

    // Étincelles du geste.
    if (this.sparks.length) {
      g.save();
      g.fillStyle = inks.stroke;
      this.sparks = this.sparks.filter((sp) => this.clock - sp.at < sp.life);
      for (const sp of this.sparks) {
        const age = (this.clock - sp.at) / sp.life;
        const dt = this.clock - sp.at;
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

  /** Le bord de la plaque : un anneau de verre gradué, plus vif quand la matière vibre ; et les ondes de résonance. */
  drawPlate(g, ox, oy, size, d, inks) {
    const cx = ox + size / 2;
    const cy = oy + size / 2;
    const R = size * 0.47;
    const e = clamp(this.energy, 0, 1);
    g.save();
    const ring = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    ring.addColorStop(0, inks.guide);
    ring.addColorStop(1, CHORUS_INK);
    g.strokeStyle = ring;
    g.lineWidth = d;
    g.globalAlpha = 0.12 + e * 0.18;
    g.beginPath();
    g.arc(cx, cy, R + 5 * d, 0, TAU);
    g.stroke();
    // Graduations : elles tournent très lentement, comme une plaque posée sur un plateau.
    g.globalAlpha = 0.07 + e * 0.13;
    g.beginPath();
    const turn = reducedMotion ? 0 : this.clock * 0.012;
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * TAU + turn;
      const r1 = R + 9 * d;
      const r2 = R + (i % 8 === 0 ? 16 : 12) * d;
      g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    }
    g.stroke();
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
