// PELAGIC V3 « Résonance » — la scène. Auteur : CLAUDE.
// Le geste chante (hauteur = y), la matière cherche la figure modale de la note
// (cymatics.js), le dialogue de CODEX (phrase.js) compose la réponse après un
// silence, et la mémoire (12 phrases) se dépose en rémanence au fond de l'eau.

import { createObjectView, createRenderer } from './render.js';
import { createAudio, pitchForDepth } from './audio.js';
import { MODES, applyCymatics, buildField, gestureFreq, modeIndex, nodalSegments } from './cymatics.js';

const STEP = 1 / 60;
const STORE_KEY = 'pelagic.resonance.v3';
const SCALE = 'insen';
const COUNT = 12000;
const DREAM_AFTER = 22; // s sans geste avant que la matière ne rêve
const ATTRACT_EVERY = 7; // s entre deux figures d'attente (seuil, mémoire vide)
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

boot();

async function boot() {
  let E;
  let dialogueModule;
  let imprintModule = null;
  try {
    E = await import('./engine.js');
  } catch (err) {
    fatal(`La matière ne répond pas (${err.message}). Lancez PELAGIC avec START.ps1.`);
    return;
  }
  try {
    dialogueModule = await import('./phrase.js'); // dialogue et musique : CODEX
  } catch (err) {
    fatal(`Le dialogue ne répond pas (${err.message}).`);
    return;
  }
  try {
    imprintModule = await import('./imprint.js');
  } catch { /* empreinte indisponible : bouton masqué */ }
  const scene = new Resonance(E, dialogueModule, imprintModule);
  if (new URLSearchParams(location.search).has('debug')) globalThis.__resonance = scene; // QA uniquement
  scene.start();
}

class Resonance {
  constructor(E, D, I) {
    this.E = E;
    this.D = D;
    this.I = I;
    this.cv = $('#matter');
    this.ctx = this.cv.getContext('2d');
    this.inkCv = $('#ink');
    this.ink = this.inkCv.getContext('2d');
    this.renderer = createRenderer({ prefer: 'webgl2' });
    this.objectView = createObjectView();
    this.audio = createAudio();
    this.settings = { ...E.DEFAULTS, speed: reducedMotion ? 0.45 : 0.8, turbulence: 0.26, glow: 0.62 };
    this.world = E.createWorld(20261124);
    this.world.nodes = []; // V3 : aucune machinerie posée, seulement la matière
    E.resetParticles(this.world, COUNT);
    this.fields = new Map();
    this.modeF = 4;
    this.energy = 0;
    this.clock = 0;
    this.lastInput = -Infinity;
    this.touch = null; // geste en cours {x, y, vx, vy, id}
    this.cursor = { x: 0.5, y: 0.5 };
    this.keys = new Set();
    this.play = null; // réponse ou rêve en cours {answer, start, gain, next, dream}
    this.attract = { next: 0, index: 3 };
    this.dreamIndex = 0;
    this.lastQ = 0;
    this.lastNoteAt = -1;
    this.entered = false;
    this.restoreMemory();
    this.buildSediment();
  }

  start() {
    this.bindThreshold();
    this.bindGestures();
    this.bindDock();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.last = performance.now();
    this.acc = 0;
    this.frameMs = 4;
    this.slowFrames = 0;
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------------------------------------------------------------- mémoire

  restoreMemory() {
    let seed = 42;
    let memory = [];
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = this.I ? this.I.deserializeImprint(raw) : JSON.parse(raw);
        seed = Number.isFinite(data.seed) ? data.seed : 42;
        memory = Array.isArray(data.phrases) ? data.phrases : [];
      }
    } catch {
      try { localStorage.removeItem(STORE_KEY); } catch { /* stockage indisponible */ }
    }
    this.seed = seed;
    try {
      this.dialogue = this.D.createDialogue({ silence: 1.6, seed, memory });
    } catch {
      // Mémoire illisible (version, bornes) : on repart d'une eau vierge plutôt que de rester muet.
      try { localStorage.removeItem(STORE_KEY); } catch { /* stockage indisponible */ }
      this.dialogue = this.D.createDialogue({ silence: 1.6, seed });
    }
  }

  saveMemory() {
    const payload = { seed: this.seed, phrases: this.dialogue.memory };
    try {
      localStorage.setItem(STORE_KEY, this.I ? this.I.serializeImprint(payload) : JSON.stringify(payload));
    } catch { /* stockage plein ou interdit : la mémoire reste en séance */ }
  }

  /** Fréquence dominante d'une phrase (moyenne log pondérée par l'énergie). */
  static dominant(phrase) {
    let w = 0;
    let s = 0;
    for (const p of phrase.samples ?? []) {
      if (!(p.freq > 0)) continue;
      const e = Math.max(0.05, p.energy ?? 0.5);
      w += e;
      s += e * Math.log(p.freq);
    }
    return w ? Math.exp(s / w) : 220;
  }

  /** Rémanence : lignes nodales de la figure dominante de chaque phrase mémorisée. */
  buildSediment() {
    this.sediment = this.dialogue.memory.map((ph) => {
      const mode = MODES[Math.round(modeIndex(Resonance.dominant(ph)))];
      return { id: ph.id, mode, seg: nodalSegments(mode, 64) };
    });
    this.sedimentDirty = true;
  }

  // ---------------------------------------------------------------- seuil

  bindThreshold() {
    const enter = async (withSound) => {
      if (this.entered) return;
      this.entered = true;
      if (withSound) await this.audio.enable();
      this.syncSound();
      document.body.dataset.state = 'idle';
      $('#dock').hidden = false;
      if (this.I) $('#imprint').hidden = false;
      this.stopPlay();
      this.cv.focus({ preventScroll: true });
      this.whisper(this.dialogue.memory.length ? 'Laissez une trace. D’autres sont passés avant vous.' : 'Laissez une trace.', 5000);
    };
    $('#enter').addEventListener('click', () => enter(true));
    $('#enter-quiet').addEventListener('click', () => enter(false));
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
      if (!this.entered || ev.button > 0) return;
      const w = this.toWorld(ev);
      this.beginTouch(w.x, w.y, ev.pointerId);
      try { cv.setPointerCapture(ev.pointerId); } catch { /* pointeur déjà perdu : le geste continue sans capture */ }
    });
    cv.addEventListener('pointermove', (ev) => {
      this.wake();
      if (!this.touch || this.touch.id !== ev.pointerId) return;
      const events = ev.getCoalescedEvents?.() ?? [ev];
      for (const e of events.length ? events : [ev]) {
        const w = this.toWorld(e);
        this.moveTouch(w.x, w.y, e.timeStamp);
      }
    });
    const end = (ev) => { if (this.touch && this.touch.id === ev.pointerId) this.endTouch(); };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);

    // Clavier : flèches pour viser, Espace maintenu pour tracer.
    cv.addEventListener('keydown', (ev) => {
      if (!this.entered) return;
      if (ev.key.startsWith('Arrow')) {
        ev.preventDefault();
        this.keys.add(ev.key);
      } else if (ev.key === ' ' && !ev.repeat) {
        ev.preventDefault();
        this.beginTouch(this.cursor.x, this.cursor.y, 'key');
      }
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
      else if (ev.key === '?') $('#help').showModal();
    });

    // Une empreinte déposée sur la scène redevient mémoire (sans fusion).
    addEventListener('dragover', (ev) => ev.preventDefault());
    addEventListener('drop', (ev) => {
      ev.preventDefault();
      const file = ev.dataTransfer?.files?.[0];
      if (file) this.loadImprint(file);
    });
  }

  beginTouch(x, y, id) {
    if (this.play && !this.play.dream) return; // elle répond : la place est à la réponse
    this.stopPlay();
    this.touch = { x, y, vx: 0, vy: 0, t: performance.now(), id, path: [{ x, y }] };
    this.cursor = { x, y };
    this.E.addWake(this.world, x, y, 0, 0, 0.06);
  }

  moveTouch(x, y, stamp = performance.now()) {
    const t = this.touch;
    const dt = Math.max(0.008, (stamp - t.t) / 1000);
    const vx = (x - t.x) / dt;
    const vy = (y - t.y) / dt;
    t.vx += (vx - t.vx) * 0.35;
    t.vy += (vy - t.vy) * 0.35;
    t.x = x;
    t.y = y;
    t.t = stamp;
    this.cursor = { x, y };
    const last = t.path[t.path.length - 1];
    if (Math.hypot(x - last.x, y - last.y) > 0.004) t.path.push({ x, y });
    if (t.path.length > 600) t.path.shift();
  }

  endTouch() {
    if (!this.touch) return;
    this.fadingPath = { path: this.touch.path, t: this.clock };
    this.touch = null;
  }

  /** Échantillon du geste pour le dialogue (un par pas fixe). */
  sampleTouch() {
    const t = this.touch;
    const speed = Math.hypot(t.vx, t.vy);
    const energy = clamp(0.32 + speed * 0.55, 0.32, 1);
    if (performance.now() - t.t > 120) { t.vx *= 0.9; t.vy *= 0.9; } // doigt immobile
    if (speed > 0.05) {
      this.E.addWake(this.world, t.x, t.y, t.vx * 0.35, t.vy * 0.35, clamp(0.04 + speed * 0.02, 0.04, 0.09));
    }
    return { t: this.clock, x: t.x, y: t.y, freq: gestureFreq(t.y), energy };
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
    // Coût réel d'une image (calcul + dessin), et non l'intervalle entre images :
    // un écran bridé (onglet masqué, économie d'énergie) ne doit pas appauvrir la matière.
    const work = (performance.now() - work0) / Math.max(1, steps);
    this.frameMs += (work - this.frameMs) * 0.05;
    this.adapt();
    // Les 36 figures se préparent une par image (≈ 10 ms chacune) : jamais d'à-coup au premier geste.
    if (this.fields.size < MODES.length) for (let i = 0; i < MODES.length; i++) if (!this.fields.has(i)) { this.field(i); break; }
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Si la machine peine (> 12 ms de travail par pas, durablement), on allège la matière. */
  adapt() {
    if (document.hidden) return;
    this.slowFrames = this.frameMs > 12 ? this.slowFrames + 1 : 0;
    if (this.slowFrames > 120 && this.world.p.n > 5000) {
      this.E.resetParticles(this.world, Math.round(this.world.p.n * 0.75));
      this.slowFrames = 0;
    }
  }

  step() {
    this.clock += STEP;
    // Curseur clavier.
    if (this.keys.size) {
      const k = 0.35 * STEP;
      const dx = (this.keys.has('ArrowRight') ? k : 0) - (this.keys.has('ArrowLeft') ? k : 0);
      const dy = (this.keys.has('ArrowDown') ? k : 0) - (this.keys.has('ArrowUp') ? k : 0);
      this.cursor = { x: clamp(this.cursor.x + dx, 0, 1), y: clamp(this.cursor.y + dy, 0, 1) };
      if (this.touch?.id === 'key') this.moveTouch(this.cursor.x, this.cursor.y);
    }

    let target = null; // {freq, energy}
    if (this.touch && !(this.play && !this.play.dream)) {
      const s = this.sampleTouch();
      this.dialogue.input(s);
      this.lastInput = this.clock;
      target = s;
      this.singLive(s);
    }

    const ev = this.dialogue.update(this.clock);
    if (ev) this.onDialogue(ev);

    if (this.play) target = this.advancePlay() ?? target;
    else if (!this.touch) target = this.idleTarget();

    // La figure suit la note, en glissando ; l'énergie respire.
    if (target?.freq) {
      const goal = modeIndex(target.freq);
      this.modeF += (goal - this.modeF) * Math.min(1, STEP * 5);
    }
    const goalE = target ? target.energy : 0;
    this.energy += (goalE - this.energy) * Math.min(1, STEP * (goalE > this.energy ? 6 : 1.2));

    this.E.stepWorld(this.world, STEP, this.settings);
    if (this.energy > 0.01) {
      const i = Math.floor(this.modeF);
      const a = this.field(i);
      const b = i + 1 < MODES.length ? this.field(i + 1) : null;
      applyCymatics(this.world.p, a, b, this.modeF - i, this.energy, STEP);
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

  /** Le doigt chante : une note quand la hauteur franchit un degré de la gamme. */
  singLive(s) {
    if (!this.audio.enabled) return;
    const q = pitchForDepth(s.y, SCALE);
    if (q === this.lastQ || this.clock - this.lastNoteAt < 0.11) return;
    this.lastQ = q;
    this.lastNoteAt = this.clock;
    this.audio.note(q, { voice: 'glass', velocity: 0.18 + s.energy * 0.3, pan: (s.x - 0.5) * 1.4 });
  }

  onDialogue(ev) {
    if (ev.type === 'answer') {
      this.startPlay(ev.answer, { dream: false });
      document.body.dataset.state = 'answering';
      this.whisper('Elle vous répond.', Math.min(6000, ev.answer.duration * 1000));
    } else if (ev.type === 'idle') {
      if (!this.play?.dream) document.body.dataset.state = 'idle';
      this.buildSediment();
      this.saveMemory();
      if (this.dialogue.memory.length === 1) this.whisper('Votre trace demeure, au fond.', 4200);
    }
  }

  // ---------------------------------------------------------------- réponse, rêve, attente

  startPlay(answer, { dream, gain = 1 }) {
    this.play = { answer, start: this.clock, gain, next: 0, dream };
  }

  stopPlay() {
    if (!this.play) return;
    this.play = null;
    if (this.entered) document.body.dataset.state = 'idle';
  }

  /** Avance la réponse : émet ses notes au passage, renvoie la figure courante. */
  advancePlay() {
    const p = this.play;
    const t = this.clock - p.start;
    const { notes = [], figures = [], trace = [], duration = 0 } = p.answer;
    while (p.next < notes.length && notes[p.next].at <= t) {
      const n = notes[p.next++];
      if (this.audio.enabled) {
        this.audio.note(n.freq, { voice: n.voice, velocity: (n.velocity ?? 0.5) * p.gain, pan: n.pan ?? 0 });
      }
      const pt = nearestTrace(trace, n.at);
      if (pt) this.E.addWake(this.world, pt.x, pt.y, 0, 0, 0.05 + 0.04 * p.gain);
    }
    if (t > duration + 0.6) {
      const wasDream = p.dream;
      this.play = null;
      if (wasDream) this.lastInput = this.clock - DREAM_AFTER + 4; // court répit entre deux rêves
      return null;
    }
    let fig = null;
    for (const f of figures) if (f.at <= t && t < f.at + (f.dur ?? 0.3)) fig = f;
    return fig ? { freq: fig.freq, energy: clamp((fig.energy ?? 0.6) * p.gain, 0, 1) } : { freq: 0, energy: 0.2 * p.gain };
  }

  /** Repos : rêver la mémoire, ou, si elle est vide, respirer d'une figure à l'autre. */
  idleTarget() {
    const quiet = this.clock - this.lastInput;
    const memory = this.dialogue.memory;
    if (this.dialogue.state === 'idle' && memory.length && quiet > DREAM_AFTER) {
      const phrase = memory[this.dreamIndex++ % memory.length];
      const answer = this.D.composeAnswer(phrase, { seed: this.seed + this.dreamIndex, scale: SCALE, memory });
      this.startPlay(answer, { dream: true, gain: 0.45 });
      return null;
    }
    if (!memory.length && (!this.entered || quiet > DREAM_AFTER)) {
      if (this.clock > this.attract.next) {
        this.attract.next = this.clock + ATTRACT_EVERY;
        this.attract.index = (this.attract.index + 7) % 18;
      }
      const phase = (this.attract.next - this.clock) / ATTRACT_EVERY; // 1 → 0
      return { freq: 82 * 2 ** (this.attract.index / 5), energy: 0.32 * Math.sin(Math.PI * phase) };
    }
    return null;
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
    const size = Math.min(w, h) * (w < 640 ? 0.98 : 0.92);
    this.rectCss = { x: (w - size) / 2, y: (h - size) / 2, size };
    this.rect = { x: this.rectCss.x * dpr, y: this.rectCss.y * dpr, size: size * dpr };
    this.dpr = dpr;
    try {
      this.renderer.resize(this.cv.width, this.cv.height);
    } catch {
      this.renderer = createRenderer({ prefer: '2d' });
      this.renderer.resize(this.cv.width, this.cv.height);
    }
    this.sedimentDirty = true;
  }

  view() {
    return this.world.p ?? this.objectView(this.world.particles);
  }

  draw() {
    const { ctx, cv } = this;
    if (this.renderer.lost && this.renderer.kind !== '2d') {
      this.renderer = createRenderer({ prefer: '2d' });
      this.renderer.resize(cv.width, cv.height);
    }
    this.renderer.draw(this.view(), { rect: this.rect, persistence: 0.86, dpr: this.dpr, bloom: 0.55 });
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
    // Rémanence : les figures laissées par les visiteurs précédents.
    if (this.sedimentDirty) this.paintSediment();
    if (this.sedimentCv) {
      g.globalAlpha = this.play?.dream ? 0.9 : 0.55;
      g.drawImage(this.sedimentCv, ox, oy);
      g.globalAlpha = 1;
    }
    const line = (path, color, width, alpha, upto = path.length) => {
      if (upto < 2) return;
      g.strokeStyle = color;
      g.globalAlpha = alpha;
      g.lineWidth = width * d;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.shadowColor = color;
      g.shadowBlur = 14 * d;
      g.beginPath();
      g.moveTo(ox + path[0].x * size, oy + path[0].y * size);
      for (let i = 1; i < upto; i++) g.lineTo(ox + path[i].x * size, oy + path[i].y * size);
      g.stroke();
      g.shadowBlur = 0;
      g.globalAlpha = 1;
    };
    // Le tracé du visiteur, encre qui s'efface.
    if (this.touch) line(this.touch.path, '#bff7ff', 1.6, 0.55);
    else if (this.fadingPath) {
      const age = this.clock - this.fadingPath.t;
      if (age > 2.4) this.fadingPath = null;
      else line(this.fadingPath.path, '#bff7ff', 1.6, 0.55 * (1 - age / 2.4));
    }
    // La réponse redessine un tracé apparenté, en or.
    if (this.play?.answer?.trace?.length) {
      const t = this.clock - this.play.start;
      const tr = this.play.answer.trace;
      let upto = 0;
      while (upto < tr.length && tr[upto].at <= t) upto++;
      const tail = Math.max(0, 1 - Math.max(0, t - (this.play.answer.duration ?? 0)) / 0.6);
      line(tr, '#ffd27a', this.play.dream ? 1.1 : 1.8, (this.play.dream ? 0.35 : 0.75) * tail, upto);
    }
    // Curseur clavier.
    if (document.activeElement === this.cv && this.keys.size + (this.touch?.id === 'key' ? 1 : 0)) {
      g.strokeStyle = '#5fffd0';
      g.lineWidth = 1.5 * d;
      g.beginPath();
      g.arc(ox + this.cursor.x * size, oy + this.cursor.y * size, 9 * d, 0, Math.PI * 2);
      g.stroke();
    }
  }

  paintSediment() {
    this.sedimentDirty = false;
    const size = Math.max(1, Math.round(this.rect.size));
    if (!this.sediment.length) { this.sedimentCv = null; return; }
    const c = this.sedimentCv ?? document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    g.clearRect(0, 0, size, size);
    g.lineWidth = Math.max(1, this.dpr * 0.9);
    const n = this.sediment.length;
    this.sediment.forEach((s, k) => {
      const age = (n - 1 - k) / Math.max(1, n - 1); // 0 = la plus récente
      g.strokeStyle = `rgba(150, 255, 225, ${(0.16 - age * 0.1).toFixed(3)})`;
      g.beginPath();
      for (let i = 0; i < s.seg.length; i += 4) {
        g.moveTo(s.seg[i] * size, s.seg[i + 1] * size);
        g.lineTo(s.seg[i + 2] * size, s.seg[i + 3] * size);
      }
      g.stroke();
    });
    this.sedimentCv = c;
  }

  // ---------------------------------------------------------------- dock

  bindDock() {
    $('#sound').addEventListener('click', () => this.toggleSound());
    $('#record').addEventListener('click', () => this.toggleRecording());
    $('#imprint').addEventListener('click', () => this.keepImprint());
    $('#forget').addEventListener('click', () => this.forget());
    $('#help-open').addEventListener('click', () => $('#help').showModal());
    const file = $('#imprint-file');
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f) return;
      $('#help').close();
      this.loadImprint(f);
    });
    if (!this.I) file.closest('.help__imprint').hidden = true;
  }

  wake() {
    document.body.classList.add('is-awake');
    clearTimeout(this.wakeTimer);
    this.wakeTimer = setTimeout(() => document.body.classList.remove('is-awake'), 3200);
  }

  async toggleSound() {
    if (!this.entered) return;
    if (this.audio.enabled) this.audio.disable();
    else await this.audio.enable();
    this.syncSound();
  }

  syncSound() {
    const b = $('#sound');
    b.setAttribute('aria-pressed', String(this.audio.enabled));
    b.textContent = this.audio.enabled ? 'Son' : 'Son coupé';
    $('#record').disabled = !this.audio.canRecord;
  }

  async toggleRecording() {
    const b = $('#record');
    if (this.audio.recording) {
      const blob = await this.audio.stopRecording();
      b.setAttribute('aria-pressed', 'false');
      b.textContent = 'Enregistrer';
      if (!blob) return this.toast('Rien n’a été entendu.');
      const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
      download(blob, `pelagic-resonance-${stamp()}.${ext}`);
      return this.toast('Enregistrement gardé sur cet appareil.');
    }
    if (!this.audio.enabled) await this.toggleSound();
    if (!this.audio.enabled || !this.audio.startRecording()) return this.toast('Enregistrement indisponible ici.');
    b.setAttribute('aria-pressed', 'true');
    b.textContent = 'Arrêter';
  }

  keepImprint() {
    if (!this.I) return;
    if (!this.dialogue.memory.length) return this.toast('Laissez d’abord une trace.');
    const json = this.I.serializeImprint({ seed: this.seed, phrases: this.dialogue.memory });
    download(new Blob([json], { type: 'application/json' }), `pelagic-empreinte-${stamp()}.json`);
    this.toast('Empreinte gardée. Déposez-la sur la scène pour la faire revivre.');
  }

  async loadImprint(file) {
    if (!this.I || !this.entered) return;
    try {
      if (file.size > 196608) throw new Error('fichier trop volumineux');
      const data = this.I.deserializeImprint(await file.text());
      const previous = { seed: this.seed, memory: this.dialogue.memory };
      this.stopPlay();
      this.seed = data.seed;
      this.dialogue = this.D.createDialogue({ silence: 1.6, seed: data.seed, memory: data.phrases });
      this.buildSediment();
      this.lastInput = this.clock - DREAM_AFTER; // la matière rêve aussitôt l'empreinte
      this.toast('Empreinte revenue.', 'Annuler', () => {
        this.seed = previous.seed;
        this.dialogue = this.D.createDialogue({ silence: 1.6, seed: previous.seed, memory: previous.memory });
        this.stopPlay();
        this.buildSediment();
        this.saveMemory();
      });
      this.saveMemory();
    } catch (err) {
      this.toast(`Empreinte refusée : ${err.message}`);
    }
  }

  forget() {
    const previous = { seed: this.seed, memory: this.dialogue.memory };
    if (!previous.memory.length) return this.toast('La mémoire est déjà vide.');
    this.stopPlay();
    this.dialogue.reset();
    this.buildSediment();
    this.saveMemory();
    this.toast(`${previous.memory.length} trace${previous.memory.length > 1 ? 's' : ''} effacée${previous.memory.length > 1 ? 's' : ''}.`, 'Annuler', () => {
      this.dialogue = this.D.createDialogue({ silence: 1.6, seed: previous.seed, memory: previous.memory });
      this.buildSediment();
      this.saveMemory();
    });
  }

  // ---------------------------------------------------------------- mots

  whisper(text, ms = 4000) {
    const w = $('#whisper');
    w.textContent = text;
    w.classList.add('is-on');
    clearTimeout(this.whisperTimer);
    this.whisperTimer = setTimeout(() => w.classList.remove('is-on'), ms);
  }

  toast(text, label, run) {
    const t = $('#toast');
    t.replaceChildren(text);
    if (label) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => { t.hidden = true; run(); });
      t.append(b);
    }
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.hidden = true; }, label ? 7000 : 3800);
  }
}

// ---------------------------------------------------------------- utilitaires

function nearestTrace(trace, at) {
  let best = null;
  for (const p of trace) if (p.at <= at) best = p;
  return best ?? trace[0] ?? null;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
}

function fatal(message) {
  const f = $('#fatal');
  f.textContent = message;
  f.hidden = false;
}
