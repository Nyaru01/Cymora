// PELAGIC Nocturne — orchestration de l'interface.
// Auteur : CLAUDE. Le moteur (engine.js) et la partition (score.js) de CODEX
// restent les sources de vérité ; ce module relie rendu (render.js), musique
// (audio.js, tide.js), frise (timeline.js) et gestes.

import {
  HIT_RADIUS, LABELS, clamp, describeNode, fitSquare,
  formatTime, fromBase64Url, nodeAt, nudgeStrength, screenToWorld, toBase64Url,
} from './ui.js';
import {
  SCALE_LABELS, VOICES, VOICE_LABELS, canonicalScale, canonicalVoice, createAudio, noteName, pitchForDepth,
} from './audio.js';
import { createObjectView, createRenderer } from './render.js';
import { beaconRadius, createConductor } from './tide.js';
import { createTimeline } from './timeline.js';
import { createNocturne } from './nocturne.js';

const STORE_KEY = 'pelagic.session.v1';
const SCORE_KEY = 'pelagic.score.v2';
const PREFS_KEY = 'pelagic.prefs.v1';
const SEEN_KEY = 'pelagic.seen.v2';
const SONAR_WINDOW = 14; // secondes visibles sur le sonar
const STEP = 1 / 60; // pas de simulation fixe
const TOOLS = ['hand', 'vortex', 'source', 'reef', 'beacon', 'move', 'erase'];

// Palette des traînées : abysses → menthe → écume.
const NODE_COLORS = {
  vortex: ['#5fffd0', '#b59cff'],
  source: ['#4cc9ff', '#ffd27a'],
  reef: ['#ff7a8a', '#ff7a8a'],
  beacon: ['#ffd27a', '#ffd27a'],
};

const $ = (sel) => document.querySelector(sel);

function safeStorage(op, key, value) {
  try {
    if (op === 'get') return globalThis.localStorage?.getItem(key) ?? null;
    if (op === 'set') globalThis.localStorage?.setItem(key, value);
    if (op === 'del') globalThis.localStorage?.removeItem(key);
  } catch {
    /* stockage indisponible (navigation privée, quotas) : on continue sans */
  }
  return null;
}

function showFatal(title, detail) {
  const box = $('#fatal');
  if (!box) return;
  box.replaceChildren();
  const strong = document.createElement('strong');
  strong.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  box.append(strong, p);
  box.hidden = false;
}

async function main() {
  let engine;
  let score;
  try {
    engine = await import('./engine.js');
    score = await import('./score.js');
  } catch (err) {
    showFatal('Le moteur ne répond pas', `Impossible de charger le moteur (${err.message}). Lancez l'application avec START.ps1.`);
    return;
  }
  const app = new Pelagic(engine, score);
  app.start();
  try {
    const atlas = await import('./atlas.js');
    app.mountAtlas(atlas);
  } catch (err) {
    console.warn('Atlas indisponible :', err);
    const list = $('#atlas');
    if (list) list.closest('section').hidden = true;
  }
  globalThis.__pelagic = app; // aide au débogage local
}

class Pelagic {
  constructor(engine, score) {
    this.E = engine;
    this.S = score;
    this.canvas = $('#ocean');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.renderer = createRenderer();
    this.objectView = createObjectView();
    this.accumulator = 0;
    this.sonar = $('#sonar');
    this.sctx = this.sonar.getContext('2d');
    this.audio = createAudio();

    this.settings = { ...engine.DEFAULTS };
    this.tool = 'hand';
    this.mode = 'explore';
    this.score = null;
    this.movement = 0;
    this.transport = { beat: 0, playing: false, loop: true, ended: false };
    this.freeBeat = 0; // horloge de marée en mode Explorer
    this.conductor = createConductor(pitchForDepth);
    this.flashAcc = 0;
    this.hand = null; // geste Main en cours
    this.recStart = 0;
    this.paused = false;
    this.trailPersistence = 0.95;
    this.volume = 0.6;
    this.dpr = 1;
    this.rect = { x: 0, y: 0, size: 1 };
    this.hover = null; // élément survolé
    this.drag = null; // { id, moved }
    this.pointer = null; // position monde du pointeur
    this.cursor = null; // curseur clavier {x,y}
    this.notes = 0;
    this.sonarEvents = []; // { t, freq, pan }
    this.flashes = new Map(); // clé balise → instant de la dernière note
    this.clock = 0; // temps réel écoulé (s)
    this.fps = { frames: 0, acc: 0, value: 0 };
    this.saveTimer = 0;
    this.metricsTimer = 0;
    this.selectedId = null; // élément affiché dans l'inspecteur
    this.past = []; // instantanés JSON pour Ctrl+Z
    this.future = [];
    this.lastCheckpoint = { key: null, at: -Infinity };

    this.world = this.restore();
  }

  // ---------- Démarrage et persistance ----------

  restore() {
    const prefs = safeStorage('get', PREFS_KEY);
    if (prefs) {
      try {
        const p = JSON.parse(prefs);
        if (Number.isFinite(p.trail)) this.trailPersistence = clamp(p.trail, 0.6, 0.99);
        if (Number.isFinite(p.volume)) this.volume = clamp(p.volume, 0, 1);
        if (p.mode === 'compose') this.wantCompose = true;
      } catch { /* préférences corrompues : ignorées */ }
    }

    const hash = location.hash.match(/^#w=([A-Za-z0-9_-]+)$/);
    if (hash) {
      try {
        const { world, settings } = this.E.deserializeWorld(fromBase64Url(hash[1]));
        this.settings = settings;
        this.pendingMessage = 'Composition partagée chargée depuis le lien.';
        history.replaceState(null, '', location.pathname + location.search);
        return world;
      } catch (err) {
        this.pendingError = `Lien ignoré : ${err.message}`;
      }
    }

    const saved = safeStorage('get', STORE_KEY);
    if (saved) {
      try {
        const { world, settings } = this.E.deserializeWorld(saved);
        this.settings = settings;
        this.pendingMessage = 'Votre dernière plongée a été restaurée.';
        return world;
      } catch {
        safeStorage('del', STORE_KEY);
      }
    }
    return this.E.createWorld(42);
  }

  restoreScore() {
    const saved = safeStorage('get', SCORE_KEY);
    if (!saved) return;
    try {
      this.score = this.S.deserializeScore(saved);
    } catch {
      safeStorage('del', SCORE_KEY);
    }
  }

  persist() {
    try {
      safeStorage('set', STORE_KEY, this.E.serializeWorld(this.world, this.settings));
    } catch { /* réglages hors limites : on ne sauvegarde pas un état invalide */ }
    if (this.score) {
      try {
        safeStorage('set', SCORE_KEY, this.S.serializeScore(this.score));
      } catch { /* partition invalide : non sauvegardée */ }
    }
    safeStorage('set', PREFS_KEY, JSON.stringify({ trail: this.trailPersistence, volume: this.volume, mode: this.mode }));
  }

  schedulePersist() {
    this.saveTimer = 0.6;
    this.captureIfComposing();
  }

  /** En Composer, toute édition (lecture arrêtée) s'écrit dans le mouvement courant. */
  captureIfComposing() {
    if (this.mode !== 'compose' || !this.score || this.transport.playing) return;
    try {
      this.S.captureMovement(this.score, this.movement, this.world, this.settings);
      this.timeline?.render(this.timelineState());
    } catch (err) {
      this.toast(`Mouvement non enregistré : ${err.message}`, 'error');
    }
  }

  start() {
    this.restoreScore();
    this.timeline = createTimeline($('#score'), {
      select: (i) => this.selectMovement(i),
      togglePlay: () => this.toggleTransport(),
      toggleLoop: () => {
        this.transport = { ...this.transport, loop: !this.transport.loop };
        this.timeline.render(this.timelineState());
      },
      copyNext: () => this.copyToNext(),
      setBars: (n) => this.setBars(n),
      rename: (i, name) => this.renameMovement(i, name),
      demo: () => this.playNocturne(),
    });
    $('#nocturne').addEventListener('click', () => this.playNocturne());
    this.bindModes();
    this.bindControls();
    this.bindInspector();
    this.bindCanvas();
    this.bindKeyboard();
    this.syncControls();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.canvas);
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener?.('change', () => this.resize());

    if (this.pendingError) this.toast(this.pendingError, 'error');
    else if (this.pendingMessage) this.say(this.pendingMessage);

    if (!safeStorage('get', SEEN_KEY)) {
      safeStorage('set', SEEN_KEY, '1');
      this.openHelp();
    }
    this.setTool(this.tool, { quiet: true });
    if (this.wantCompose) this.setMode('compose', { quiet: true });

    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.reducedMotion && !this.paused) {
      this.togglePause();
      this.say('Mouvement réduit détecté : les courants attendent. Espace pour les lancer.');
    }
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.tick(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    addEventListener('beforeunload', () => this.persist());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.persist();
    });
  }

  // ---------- Boucle ----------

  tick(dt) {
    this.clock += dt;
    if (!this.paused) {
      // Pas fixe (1/60 s) : la simulation est identique quelle que soit la
      // cadence d'affichage. Au-delà de 6 pas en retard, on lâche du temps
      // plutôt que de geler l'onglet.
      this.accumulator = Math.min(this.accumulator + dt, STEP * 6);
      while (this.accumulator >= STEP) {
        this.simulate();
        this.accumulator -= STEP;
      }
      if (this.flashAcc) {
        // Scintillement : densité proportionnelle aux flashes, normalisée par la population.
        this.audio.shimmer(Math.min(1, this.flashAcc / Math.max(60, this.world.p.n * 0.01)));
        this.flashAcc = 0;
      }
    }
    if (this.mode === 'compose') this.timeline.tick({ score: this.score, transport: this.transport, phase: this.phase() });
    if (this.audio.recording) {
      const t = formatTime(this.clock - this.recStart);
      const el = $('#rec-time');
      if (el.textContent !== t) el.textContent = t;
    }
    this.render(dt);
    this.renderSonar();

    this.fps.frames += 1;
    this.fps.acc += dt;
    if (this.fps.acc >= 0.5) {
      this.fps.value = Math.round(this.fps.frames / this.fps.acc);
      this.fps.frames = 0;
      this.fps.acc = 0;
    }
    this.metricsTimer -= dt;
    if (this.metricsTimer <= 0) {
      this.metricsTimer = 0.25;
      this.renderMetrics();
    }
    if (this.saveTimer > 0) {
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) this.persist();
    }
  }

  /** Un pas fixe : transport de la partition, moteur, lumière, balises. */
  simulate() {
    let settings = this.settings;
    let beat;
    if (this.mode === 'compose' && this.transport.playing) {
      this.transport = this.S.advanceTransport(this.transport, STEP, this.score);
      const sample = this.S.sampleScore(this.score, this.transport.beat);
      this.S.applySample(this.world, sample);
      settings = { ...this.settings, ...sample.settings, count: this.settings.count, quantize: this.settings.quantize };
      this.liveSettings = settings;
      beat = this.transport.beat;
      if (!this.transport.playing) this.onTransportEnded();
    } else {
      this.freeBeat += (STEP * (settings.tempo ?? 84)) / 60;
      beat = this.freeBeat;
    }
    this.E.stepWorld(this.world, STEP, settings);
    this.flashAcc += this.world.flashes ?? 0;
    this.listenBeacons(beat, settings);
  }

  listenBeacons(beat, settings) {
    const events = this.conductor.listen(this.world.nodes, this.view(), {
      beat,
      clock: this.clock,
      tempo: settings.tempo ?? 84,
      scale: settings.scale ?? 'pentatonic',
      quantize: settings.quantize !== false,
    });
    for (const e of events) {
      this.audio.note(e.freq, e);
      this.flashes.set(e.key, this.clock + e.delay);
      this.sonarEvents.push({ t: this.clock + e.delay, freq: e.freq, pan: e.pan, v: e.velocity, voice: e.voice });
      this.notes += 1;
    }
    const horizon = this.clock - SONAR_WINDOW;
    while (this.sonarEvents.length && this.sonarEvents[0].t < horizon) this.sonarEvents.shift();
  }

  // ---------- Rendu ----------

  resize() {
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.dpr = dpr;
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
      this.resizeRenderer(W, H);
    }
    const margin = (w < 500 ? 22 : 38) * dpr;
    this.rect = fitSquare(W, H, margin);
    const sw = Math.round(this.sonar.clientWidth * dpr);
    const sh = Math.round(this.sonar.clientHeight * dpr);
    if (sw && sh) {
      this.sonar.width = sw;
      this.sonar.height = sh;
    }
    this.backdrop = null; // à régénérer
  }

  /** Particules au format SoA : celui du moteur V2 s'il existe, sinon adapté. */
  view() {
    return this.world.p ?? this.objectView(this.world.particles);
  }

  resizeRenderer(W, H) {
    try {
      this.renderer.resize(W, H);
    } catch (err) {
      this.fallbackRenderer(err.message);
      this.renderer.resize(W, H);
    }
  }

  fallbackRenderer(reason) {
    if (this.renderer.kind === '2d') return;
    console.warn(`Rendu Canvas 2D (${reason}).`);
    this.renderer = createRenderer({ prefer: '2d' });
    this.renderer.resize(this.canvas.width, this.canvas.height);
    this.say('Rendu simplifié activé : WebGL2 est indisponible sur cet appareil.');
  }

  /** Fond statique (graduations, grille) mis en cache. */
  buildBackdrop() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    const { x, y, size } = this.rect;
    const d = this.dpr;

    const bg = g.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.7);
    bg.addColorStop(0, '#0a1430');
    bg.addColorStop(1, '#03060f');
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);

    // Grille fine
    g.strokeStyle = 'rgba(140, 200, 255, 0.05)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < 10; i++) {
      const p = Math.round(x + (size * i) / 10) + 0.5;
      g.moveTo(p, y);
      g.lineTo(p, y + size);
      const q = Math.round(y + (size * i) / 10) + 0.5;
      g.moveTo(x, q);
      g.lineTo(x + size, q);
    }
    g.stroke();

    // Cadre et graduations d'instrument
    g.strokeStyle = 'rgba(140, 220, 255, 0.28)';
    g.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(size), Math.round(size));
    g.beginPath();
    for (let i = 0; i <= 50; i++) {
      const len = (i % 10 === 0 ? 9 : i % 5 === 0 ? 6 : 3) * d;
      const p = x + (size * i) / 50;
      const q = y + (size * i) / 50;
      g.moveTo(p, y); g.lineTo(p, y - len);
      g.moveTo(p, y + size); g.lineTo(p, y + size + len);
      g.moveTo(x, q); g.lineTo(x - len, q);
      g.moveTo(x + size, q); g.lineTo(x + size + len, q);
    }
    g.stroke();

    g.fillStyle = 'rgba(142, 163, 199, 0.55)';
    g.font = `${10 * d}px Consolas, "Cascadia Mono", monospace`;
    g.textBaseline = 'middle';
    for (let i = 0; i <= 10; i += 2) {
      const q = y + (size * i) / 10;
      g.textAlign = 'left';
      g.fillText(`${i * 100} m`, x + 6 * d, i === 0 ? q + 8 * d : i === 10 ? q - 8 * d : q);
    }
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.fillText('PROFONDEUR', x, y - 13 * d);
    g.textAlign = 'right';
    g.fillText('COURANT DOMINANT →', x + size, y - 13 * d);
    this.backdrop = c;
  }

  render() {
    const { ctx, rect } = this;
    const { x: ox, y: oy, size } = rect;
    const d = this.dpr;
    if (!this.backdrop) this.buildBackdrop();

    const view = this.view();
    if (this.renderer.lost) this.fallbackRenderer('contexte WebGL perdu');
    try {
      this.renderer.draw(view, { rect, persistence: this.trailPersistence, dpr: d, paused: this.paused });
    } catch (err) {
      this.fallbackRenderer(err.message);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.backdrop, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.renderer.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // Plancton au repos (pause) : points fins pour garder la scène lisible.
    if (this.paused) {
      ctx.fillStyle = 'rgba(95, 255, 208, 0.55)';
      for (let i = 0; i < view.n; i++) ctx.fillRect(ox + view.x[i] * size, oy + view.y[i] * size, d, d);
    }

    for (const n of this.world.nodes) this.drawNode(n);
    this.drawCursor();
  }

  drawNode(n) {
    const { ctx, rect, dpr: d } = this;
    const cx = rect.x + n.x * rect.size;
    const cy = rect.y + n.y * rect.size;
    const s = n.strength;
    const [pos, neg] = NODE_COLORS[n.type] ?? ['#fff', '#fff'];
    const color = s >= 0 ? pos : neg;
    const mag = Math.abs(s);
    const t = this.reducedMotion ? 0 : this.clock;
    const isHover = this.hover?.id === n.id || this.drag?.id === n.id || this.selectedId === n.id;
    const r = (10 + mag * 5) * d;

    const A = clamp(n.opacity ?? 1, 0, 1);
    if (A < 0.02) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = A;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5 * d;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * d;

    if (n.type === 'vortex') {
      const dir = s >= 0 ? -1 : 1;
      ctx.rotate(dir * t * (0.6 + mag));
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = A * (0.9 - i * 0.25);
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.45 + i * 0.32), i * 2.1, i * 2.1 + Math.PI * 1.25);
        ctx.stroke();
      }
      ctx.globalAlpha = A * (1);
      ctx.beginPath();
      ctx.arc(0, 0, 2 * d, 0, Math.PI * 2);
      ctx.fill();
    } else if (n.type === 'source') {
      for (let i = 0; i < 3; i++) {
        let phase = (t * 0.5 + i / 3) % 1;
        if (s < 0) phase = 1 - phase;
        ctx.globalAlpha = A * ((1 - phase) * 0.9);
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.3 + phase * 1.2), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = A * (1);
      ctx.beginPath();
      ctx.arc(0, 0, 3 * d, 0, Math.PI * 2);
      ctx.fill();
    } else if (n.type === 'reef') {
      ctx.shadowBlur = 8 * d;
      ctx.beginPath();
      const spikes = 9;
      for (let i = 0; i <= spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2;
        const rr = r * (i % 2 ? 0.55 : 0.95) * (1 + 0.08 * Math.sin(i * 7.3 + n.id));
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.globalAlpha = A * (0.18);
      ctx.fill();
      ctx.globalAlpha = A * (1);
      ctx.stroke();
    } else if (n.type === 'beacon') {
      const zone = beaconRadius(n) * rect.size;
      const since = this.clock - (this.flashes.get(n.key ?? n.id) ?? -10);
      const glow = since < 0 ? 0 : Math.max(0, 1 - since / 0.6);
      ctx.setLineDash([3 * d, 4 * d]);
      ctx.globalAlpha = A * (0.45);
      ctx.beginPath();
      ctx.arc(0, 0, zone, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (glow > 0) {
        ctx.globalAlpha = A * (glow * 0.8);
        ctx.lineWidth = 2 * d;
        ctx.beginPath();
        ctx.arc(0, 0, zone * (1 + (1 - glow) * 0.8), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = A * (1);
      ctx.beginPath();
      ctx.arc(0, 0, (3.5 + glow * 3) * d, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `${10 * d}px Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = A * (0.75);
      ctx.fillText(`${noteName(pitchForDepth(n.y, this.currentSettings().scale))} · ${VOICE_LABELS[canonicalVoice(n.voice)]}`, 0, zone + 4 * d);
    }

    if (isHover) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = A * (0.9);
      ctx.strokeStyle = '#e6f2ff';
      ctx.lineWidth = 1 * d;
      ctx.setLineDash([2 * d, 3 * d]);
      ctx.beginPath();
      ctx.arc(0, 0, HIT_RADIUS * rect.size, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCursor() {
    if (!this.cursor || document.activeElement !== this.canvas) return;
    const { ctx, rect, dpr: d } = this;
    const cx = rect.x + this.cursor.x * rect.size;
    const cy = rect.y + this.cursor.y * rect.size;
    ctx.save();
    ctx.strokeStyle = '#5fffd0';
    ctx.lineWidth = 1.5 * d;
    ctx.beginPath();
    ctx.moveTo(cx - 12 * d, cy); ctx.lineTo(cx - 4 * d, cy);
    ctx.moveTo(cx + 4 * d, cy); ctx.lineTo(cx + 12 * d, cy);
    ctx.moveTo(cx, cy - 12 * d); ctx.lineTo(cx, cy - 4 * d);
    ctx.moveTo(cx, cy + 4 * d); ctx.lineTo(cx, cy + 12 * d);
    ctx.stroke();
    ctx.restore();
  }

  renderSonar() {
    const { sctx: g, sonar: c, dpr: d } = this;
    if (!c.width) return;
    g.clearRect(0, 0, c.width, c.height);
    // Lignes de portée (une par octave de la gamme)
    g.strokeStyle = 'rgba(140, 200, 255, 0.08)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < 4; i++) {
      const y = Math.round((c.height * i) / 4) + 0.5;
      g.moveTo(0, y);
      g.lineTo(c.width, y);
    }
    g.stroke();

    const minF = Math.log2(110);
    const maxF = Math.log2(880);
    const voiceColor = { glass: '#5fffd0', bell: '#ffd27a', pluck: '#4cc9ff', breath: '#b59cff' };
    for (const e of this.sonarEvents) {
      const age = this.clock - e.t;
      if (age < 0) continue;
      const x = c.width - (age / SONAR_WINDOW) * c.width;
      const y = c.height - 6 * d - ((Math.log2(e.freq) - minF) / (maxF - minF)) * (c.height - 12 * d);
      const alpha = 1 - age / SONAR_WINDOW;
      g.globalAlpha = alpha;
      g.fillStyle = voiceColor[e.voice] ?? '#5fffd0';
      g.beginPath();
      g.arc(x, y, (1.5 + e.v * 2.5) * d, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    if (!this.sonarEvents.length) {
      g.fillStyle = 'rgba(142, 163, 199, 0.5)';
      g.font = `${11 * d}px Consolas, monospace`;
      g.textBaseline = 'middle';
      g.fillText(
        this.world.nodes.some((n) => n.type === 'beacon')
          ? 'SONAR · en attente du premier passage de plancton…'
          : 'SONAR · posez une balise (5) sur le trajet du plancton pour l’entendre chanter',
        12 * d,
        c.height / 2,
      );
    }
  }

  renderMetrics() {
    const m = this.E.getMetrics(this.world);
    const set = (k, v) => {
      const el = document.querySelector(`[data-metric="${k}"]`);
      if (el && el.textContent !== v) el.textContent = v;
    };
    set('particles', String(m.count));
    set('light', `${Math.round((m.lit ?? 0) * 100)} %`);
    set('nodes', `${m.nodes} / 24`);
    set('notes', String(this.notes));
    set('time', formatTime(m.time));
    set('fps', String(this.fps.value || '—'));
  }

  // ---------- Historique (annuler / rétablir) ----------

  /**
   * Mémorise l'état avant une modification. Les gestes continus (molette,
   * flèches) de même clé sont regroupés s'ils se suivent de près.
   */
  checkpoint(key = null) {
    if (key && this.lastCheckpoint.key === key && this.clock - this.lastCheckpoint.at < 0.9) {
      this.lastCheckpoint.at = this.clock;
      return;
    }
    this.lastCheckpoint = { key, at: this.clock };
    try {
      this.past.push(this.E.serializeWorld(this.world, this.settings));
    } catch {
      return;
    }
    if (this.past.length > 60) this.past.shift();
    this.future.length = 0;
  }

  travel(from, to, verb) {
    if (!from.length) {
      this.say(verb === 'undo' ? 'Rien à annuler.' : 'Rien à rétablir.');
      return;
    }
    try {
      to.push(this.E.serializeWorld(this.world, this.settings));
      const { world, settings } = this.E.deserializeWorld(from.pop());
      // On garde le plancton et le temps courants : seule la composition change.
      world.p = this.world.p;
      world.time = this.world.time;
      const countChanged = settings.count !== this.world.p.n;
      this.loadWorld(world, settings, { keepTrails: true });
      if (countChanged) this.E.resetParticles(this.world, settings.count);
      this.lastCheckpoint = { key: null, at: -Infinity };
      this.say(verb === 'undo' ? `Annulé (${from.length} étape(s) restante(s)).` : 'Rétabli.');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  undo() { this.travel(this.past, this.future, 'undo'); }

  redo() { this.travel(this.future, this.past, 'redo'); }

  // ---------- Édition ----------

  /** Pendant la lecture d'une partition, seule la Main agit. */
  canEdit() {
    if (this.mode === 'compose' && this.transport.playing) {
      this.say('La partition joue : seule la Main agit. Entrée pour mettre en pause et éditer ce mouvement.');
      return false;
    }
    return true;
  }

  currentSettings() {
    return this.mode === 'compose' && this.transport.playing && this.liveSettings ? this.liveSettings : this.settings;
  }

  place(type, x, y, negative = false) {
    if (!this.canEdit()) return null;
    this.checkpoint();
    try {
      const signed = type === 'vortex' || type === 'source';
      const node = this.E.addNode(this.world, type, x, y, negative && signed ? -1 : 1);
      this.say(`${describeNode(node)}. Molette pour régler la force.`);
      this.schedulePersist();
      this.select(node);
      return node;
    } catch (err) {
      this.past.pop();
      this.toast(err.message, 'error');
      return null;
    }
  }

  remove(node) {
    if (!node || !this.canEdit()) return;
    this.checkpoint();
    this.E.removeNode(this.world, node.id);
    this.flashes.delete(node.key);
    if (this.selectedId === node.id) this.select(null);
    if (this.hover?.id === node.id) this.hover = null;
    this.say(`${LABELS[node.type] ?? 'Élément'} retiré.`);
    this.hideHint();
    this.schedulePersist();
  }

  adjust(node, delta) {
    if (!node || !this.canEdit()) return;
    this.checkpoint(`strength:${node.id}`);
    node.strength = nudgeStrength(node.strength, delta);
    if ((node.type === 'reef' || node.type === 'beacon') && node.strength < 0.1) node.strength = 0.1;
    this.showHint(node);
    if (this.selectedId === node.id) this.syncInspector();
    this.schedulePersist();
  }

  // ---------- Inspecteur ----------

  select(node) {
    this.selectedId = node ? node.id : null;
    this.syncInspector();
  }

  syncInspector() {
    const box = $('#inspector');
    const node = this.world.nodes.find((n) => n.id === this.selectedId);
    if (!node) {
      box.hidden = true;
      this.selectedId = null;
      return;
    }
    box.hidden = false;
    $('#insp-title').textContent = LABELS[node.type] ?? node.type;
    $('#insp-desc').textContent = describeNode(node).split(' — ').slice(1).join(' — ');
    const range = $('#insp-strength');
    const signed = node.type === 'vortex' || node.type === 'source';
    range.min = signed ? '-2' : '0.1';
    $('#insp-label').textContent = node.type === 'beacon' ? 'Portée' : node.type === 'reef' ? 'Taille' : 'Force';
    $('#insp-flip').hidden = !signed;
    if (!signed && node.strength < 0) node.strength = Math.abs(node.strength);
    range.value = String(node.strength);
    $('#insp-out').textContent = node.strength.toFixed(1);
    $('#insp-voice-row').hidden = node.type !== 'beacon';
    if (node.type === 'beacon') $('#insp-voice').value = canonicalVoice(node.voice);
    paintRange(range);
    box.dataset.type = node.type;
  }

  bindInspector() {
    const range = $('#insp-strength');
    range.addEventListener('input', () => {
      const node = this.world.nodes.find((n) => n.id === this.selectedId);
      if (!node || !this.canEdit()) return;
      this.checkpoint(`strength:${node.id}`);
      let v = Number(range.value);
      if (Math.abs(v) < 0.1) v = v < node.strength ? -0.1 : 0.1; // jamais nul
      node.strength = Math.round(v * 10) / 10;
      this.syncInspector();
      this.schedulePersist();
    });
    $('#insp-flip').addEventListener('click', () => {
      const node = this.world.nodes.find((n) => n.id === this.selectedId);
      if (!node || !this.canEdit()) return;
      this.checkpoint();
      node.strength = -node.strength;
      this.syncInspector();
      this.say(describeNode(node));
      this.schedulePersist();
    });
    $('#insp-delete').addEventListener('click', () => {
      this.remove(this.world.nodes.find((n) => n.id === this.selectedId));
    });
    $('#insp-close').addEventListener('click', () => this.select(null));
    const voice = $('#insp-voice');
    for (const v of VOICES) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = VOICE_LABELS[v];
      voice.append(o);
    }
    voice.addEventListener('change', () => {
      const node = this.world.nodes.find((n) => n.id === this.selectedId);
      if (!node || !this.canEdit()) { this.syncInspector(); return; }
      this.checkpoint();
      node.voice = canonicalVoice(voice.value);
      this.say(`Balise : voix ${VOICE_LABELS[node.voice]}.`);
      this.schedulePersist();
    });
  }

  // ---------- Entrées : canevas ----------

  eventToWorld(ev) {
    const b = this.canvas.getBoundingClientRect();
    return screenToWorld(this.rect, (ev.clientX - b.left) * this.dpr, (ev.clientY - b.top) * this.dpr);
  }

  bindCanvas() {
    const cv = this.canvas;
    cv.tabIndex = 0;

    cv.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      this.unlockAudio();
      const w = this.eventToWorld(ev);
      if (!w) return;
      if (this.tool === 'hand') {
        this.hand = { x: w.x, y: w.y, t: performance.now(), id: ev.pointerId };
        this.touchWater(w.x, w.y, 0, 0, 0.07);
        cv.setPointerCapture(ev.pointerId);
        return;
      }
      if (!this.canEdit()) return;
      const hit = nodeAt(this.world.nodes, w.x, w.y);
      if (this.tool === 'erase') {
        if (hit) this.remove(hit);
        return;
      }
      if (hit) {
        this.checkpoint();
        this.select(hit);
        this.drag = { id: hit.id, moved: false };
        cv.classList.add('is-dragging');
        cv.setPointerCapture(ev.pointerId);
        return;
      }
      if (this.tool !== 'move') this.place(this.tool, w.x, w.y, ev.shiftKey || ev.altKey);
      else this.select(null);
    });

    cv.addEventListener('pointermove', (ev) => {
      const b = cv.getBoundingClientRect();
      const raw = {
        x: clamp(((ev.clientX - b.left) * this.dpr - this.rect.x) / this.rect.size, 0, 1),
        y: clamp(((ev.clientY - b.top) * this.dpr - this.rect.y) / this.rect.size, 0, 1),
      };
      if (this.hand && this.hand.id === ev.pointerId) {
        const now = performance.now();
        const dt = Math.max(8, now - this.hand.t) / 1000;
        if (now - this.hand.t >= 16) {
          const vx = (raw.x - this.hand.x) / dt;
          const vy = (raw.y - this.hand.y) / dt;
          const speed = Math.hypot(vx, vy);
          this.touchWater(raw.x, raw.y, vx * 0.5, vy * 0.5, clamp(0.05 + speed * 0.03, 0.05, 0.12));
          this.hand = { ...this.hand, x: raw.x, y: raw.y, t: now };
        }
        return;
      }
      if (this.drag) {
        this.E.moveNode(this.world, this.drag.id, raw.x, raw.y);
        this.drag.moved = true;
        const n = this.world.nodes.find((k) => k.id === this.drag.id);
        if (n) this.showHint(n, ev);
        return;
      }
      const w = this.eventToWorld(ev);
      this.pointer = w;
      const hit = w ? nodeAt(this.world.nodes, w.x, w.y) : null;
      this.hover = hit;
      if (hit) this.showHint(hit, ev);
      else this.hideHint();
    });

    const endDrag = () => {
      this.hand = null;
      if (!this.drag) return;
      const n = this.world.nodes.find((k) => k.id === this.drag.id);
      if (n && this.drag.moved) {
        this.say(`${describeNode(n)}.`);
        this.schedulePersist();
      } else {
        this.past.pop(); // simple clic sans déplacement : rien à annuler
      }
      this.drag = null;
      cv.classList.remove('is-dragging');
    };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('pointerleave', () => {
      if (!this.drag) {
        this.hover = null;
        this.hideHint();
      }
    });

    cv.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const w = this.eventToWorld(ev);
      if (w) this.remove(nodeAt(this.world.nodes, w.x, w.y));
      this.hand = null;
    });

    cv.addEventListener('wheel', (ev) => {
      const w = this.eventToWorld(ev);
      const hit = w && nodeAt(this.world.nodes, w.x, w.y);
      if (!hit) return;
      ev.preventDefault();
      this.adjust(hit, ev.deltaY < 0 ? 0.1 : -0.1);
    }, { passive: false });

    // Curseur clavier : flèches pour viser, Entrée pour agir.
    cv.addEventListener('focus', () => {
      if (!this.cursor) this.cursor = { x: 0.5, y: 0.5 };
      this.say('Canevas actif : flèches pour viser, Entrée pour agir (toucher l’eau ou placer), Suppr pour retirer, + / − pour la force.');
    });
    cv.addEventListener('blur', () => this.hideHint());
    cv.addEventListener('keydown', (ev) => {
      if (!this.cursor) return;
      const step = ev.shiftKey ? 0.05 : 0.01;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const hit = nodeAt(this.world.nodes, this.cursor.x, this.cursor.y);
      if (moves[ev.key]) {
        ev.preventDefault();
        const [dx, dy] = moves[ev.key];
        const next = { x: clamp(this.cursor.x + dx, 0, 1), y: clamp(this.cursor.y + dy, 0, 1) };
        if (this.tool === 'move' && hit) {
          this.checkpoint(`move:${hit.id}`);
          this.E.moveNode(this.world, hit.id, next.x, next.y);
          this.schedulePersist();
        }
        this.cursor = next;
        const under = nodeAt(this.world.nodes, next.x, next.y);
        this.hover = under;
        if (under) this.say(describeNode(under));
        return;
      }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.unlockAudio();
        if (this.tool === 'hand') {
          this.touchWater(this.cursor.x, this.cursor.y, 0, 0, 0.09);
          this.say('Vous touchez l’eau : le plancton s’allume.');
        } else if (this.tool === 'erase') this.remove(hit);
        else if (this.tool !== 'move' && !hit) this.place(this.tool, this.cursor.x, this.cursor.y, ev.shiftKey);
        else if (hit) this.say(describeNode(hit));
      } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault();
        this.remove(hit);
      } else if (ev.key === '+' || ev.key === '=') {
        ev.preventDefault();
        if (hit) { this.adjust(hit, 0.1); this.say(describeNode(hit)); }
      } else if (ev.key === '-' || ev.key === '_') {
        ev.preventDefault();
        if (hit) { this.adjust(hit, -0.1); this.say(describeNode(hit)); }
      }
    });
  }

  /** Geste Main : un sillage transitoire qui allume le plancton. */
  touchWater(x, y, vx, vy, radius) {
    try {
      this.E.addWake(this.world, clamp(x, 0, 1), clamp(y, 0, 1), vx, vy, clamp(radius, 0.02, 0.2));
    } catch (err) {
      this.say(err.message);
    }
  }

  showHint(node, ev) {
    const hint = $('#hint');
    hint.textContent = describeNode(node);
    let left;
    let top;
    if (ev) {
      const b = this.canvas.getBoundingClientRect();
      left = ev.clientX - b.left;
      top = ev.clientY - b.top;
    } else {
      left = (this.rect.x + node.x * this.rect.size) / this.dpr;
      top = (this.rect.y + node.y * this.rect.size) / this.dpr;
    }
    const maxLeft = this.canvas.clientWidth - 260;
    hint.style.setProperty('left', `${Math.min(left, Math.max(0, maxLeft))}px`);
    hint.style.setProperty('top', `${top}px`);
    hint.hidden = false;
  }

  hideHint() {
    $('#hint').hidden = true;
  }

  // ---------- Entrées : panneau ----------

  setTool(tool, { quiet = false } = {}) {
    this.tool = tool;
    for (const b of document.querySelectorAll('.tool')) {
      const on = b.dataset.tool === tool;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    this.canvas.dataset.tool = tool;
    const verbs = {
      hand: 'Glissez dans l’eau : le plancton s’allume dans votre sillage.',
      vortex: 'Touchez l’océan pour créer un tourbillon (Maj : sens inverse).',
      source: 'Touchez l’océan pour créer une source (Maj : un puits qui aspire).',
      reef: 'Touchez l’océan pour poser un récif.',
      beacon: 'Posez une balise sur le trajet du plancton : elle chantera, calée sur la marée.',
      move: 'Faites glisser un élément, ou molette dessus pour régler sa force.',
      erase: 'Touchez un élément pour le retirer.',
    };
    if (!quiet) this.say(verbs[tool]);
  }

  bindControls() {
    const group = $('#tools');
    group.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.tool');
      if (btn) this.setTool(btn.dataset.tool);
    });
    group.addEventListener('keydown', (ev) => {
      const btns = [...group.querySelectorAll('.tool')];
      const i = btns.findIndex((b) => b.dataset.tool === this.tool);
      let j = -1;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') j = (i + 1) % btns.length;
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') j = (i - 1 + btns.length) % btns.length;
      if (j >= 0) {
        ev.preventDefault();
        this.setTool(btns[j].dataset.tool);
        btns[j].focus();
      }
    });

    const range = (id, outId, fmt, apply) => {
      const input = $(`#${id}`);
      const out = $(`#${outId}`);
      const update = (commit) => {
        const v = Number(input.value);
        out.textContent = fmt(v);
        paintRange(input);
        apply(v, commit);
      };
      input.addEventListener('input', () => update(false));
      input.addEventListener('change', () => update(true));
      return input;
    };

    range('speed', 'speed-out', (v) => `${v.toFixed(1)}×`, (v) => {
      this.settings.speed = v;
      this.schedulePersist();
    });
    range('turbulence', 'turb-out', (v) => v.toFixed(2), (v) => {
      this.settings.turbulence = v;
      this.schedulePersist();
    });
    range('count', 'count-out', (v) => String(v), (v, commit) => {
      if (!commit) return;
      try {
        this.E.resetParticles(this.world, v);
        this.settings.count = v;
        this.schedulePersist();
        this.say(`${v} grains de plancton relâchés.`);
      } catch (err) {
        this.toast(err.message, 'error');
      }
    });
    range('glow', 'glow-out', (v) => v.toFixed(2), (v) => {
      this.settings.glow = v;
      this.schedulePersist();
    });
    range('tempo', 'tempo-out', (v) => `${v} bpm`, (v, commit) => {
      this.settings.tempo = Math.round(v);
      if (this.score) this.score.tempo = Math.round(v);
      if (commit) this.schedulePersist();
    });
    range('trail', 'trail-out', (v) => v.toFixed(2), (v) => {
      this.trailPersistence = v;
      this.schedulePersist();
    });
    range('volume', 'vol-out', (v) => `${Math.round(v * 100)} %`, (v) => {
      this.volume = v;
      this.audio.setVolume(v);
      this.schedulePersist();
    });

    $('#sound').addEventListener('click', () => this.toggleSound());
    $('#record').addEventListener('click', () => this.toggleRecording());
    const scale = $('#scale');
    for (const [k, label] of Object.entries(SCALE_LABELS)) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = label;
      scale.append(o);
    }
    scale.addEventListener('change', () => {
      this.settings.scale = canonicalScale(scale.value);
      if (this.score) this.score.scale = this.settings.scale;
      this.say(`Gamme : ${SCALE_LABELS[this.settings.scale]}.`);
      this.schedulePersist();
    });
    $('#quantize').addEventListener('change', (ev) => {
      this.settings.quantize = ev.target.checked;
      if (this.score) {
        for (const movement of this.score.movements) movement.settings.quantize = this.settings.quantize;
      }
      this.conductor.reset();
      this.say(ev.target.checked ? 'Les balises se calent sur la marée.' : 'Les balises chantent librement, au passage.');
      this.schedulePersist();
    });
    $('#play').addEventListener('click', () => this.togglePause());
    $('#respawn').addEventListener('click', () => this.respawn());
    $('#clear').addEventListener('click', () => this.clearAll());
    $('#help-btn').addEventListener('click', () => this.openHelp());
    $('#export').addEventListener('click', () => this.exportFile());
    $('#import-file').addEventListener('change', (ev) => this.importFile(ev.target));
    $('#link').addEventListener('click', () => this.copyLink());
    $('#undo').addEventListener('click', () => this.undo());
    $('#redo').addEventListener('click', () => this.redo());
    $('#photo').addEventListener('click', () => this.snapshot());
    $('#immersive').addEventListener('click', () => this.toggleImmersion());
    $('#immersive-exit').addEventListener('click', () => this.toggleImmersion(false));
    $('#help').addEventListener('close', () => this.canvas.focus({ preventScroll: true }));
  }

  syncControls() {
    const setVal = (id, v) => {
      const input = $(`#${id}`);
      input.value = String(v);
      input.dispatchEvent(new Event('input'));
    };
    setVal('speed', this.settings.speed);
    setVal('turbulence', this.settings.turbulence);
    $('#count').value = String(this.settings.count);
    $('#count-out').textContent = String(this.settings.count);
    paintRange($('#count'));
    setVal('trail', this.trailPersistence);
    setVal('volume', this.volume);
    $('#glow').value = String(this.settings.glow ?? 0.55);
    $('#glow-out').textContent = Number(this.settings.glow ?? 0.55).toFixed(2);
    paintRange($('#glow'));
    $('#tempo').value = String(this.settings.tempo ?? 84);
    $('#tempo-out').textContent = `${this.settings.tempo ?? 84} bpm`;
    paintRange($('#tempo'));
    $('#scale').value = canonicalScale(this.settings.scale);
    $('#quantize').checked = this.settings.quantize !== false;
    this.audio.setVolume(this.volume);
    this.canvas.dataset.tool = this.tool;
    for (const b of document.querySelectorAll('.tool')) b.tabIndex = b.dataset.tool === this.tool ? 0 : -1;
    if (!this.audio.supported) {
      const s = $('#sound');
      s.disabled = true;
      s.textContent = 'Son indisponible dans ce navigateur';
    }
    if (!this.audio.canRecord) {
      $('#record').disabled = true;
      $('#record').title = 'Enregistrement indisponible dans ce navigateur';
    }
  }

  bindKeyboard() {
    document.addEventListener('keydown', (ev) => {
      const tag = ev.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ($('#help').open) return;
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) {
        const k = ev.key.toLowerCase();
        if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); this.undo(); }
        else if ((k === 'z' && ev.shiftKey) || k === 'y') { ev.preventDefault(); this.redo(); }
        return;
      }
      if (ev.altKey) return;
      if (ev.key === 'f' || ev.key === 'F') { this.toggleImmersion(); return; }
      if (ev.key === 'p' || ev.key === 'P') { this.snapshot(); return; }
      if (ev.key === 'Escape' && document.body.classList.contains('is-immersive')) { this.toggleImmersion(false); return; }
      if (ev.key === 'Escape' && this.selectedId !== null) { this.select(null); return; }
      if (/^[1-7]$/.test(ev.key)) {
        this.setTool(TOOLS[Number(ev.key) - 1]);
      } else if (ev.key === 'Enter' && this.mode === 'compose' && ev.target === document.body) {
        ev.preventDefault();
        this.toggleTransport();
      } else if (ev.key === ' ' && ev.target?.tagName !== 'BUTTON') {
        ev.preventDefault();
        this.togglePause();
      } else if (ev.key === 'r' || ev.key === 'R') {
        this.respawn();
      } else if (ev.key === 'm' || ev.key === 'M') {
        this.toggleSound();
      } else if (ev.key === '?') {
        this.openHelp();
      }
    });
  }

  // ---------- Actions ----------

  async unlockAudio() {
    // Le premier geste active le contexte si l'utilisateur a demandé le son.
    if (this.wantSound && !this.audio.enabled) await this.audio.enable();
  }

  async toggleSound() {
    const btn = $('#sound');
    if (this.audio.enabled) {
      this.audio.disable();
      this.wantSound = false;
      btn.setAttribute('aria-pressed', 'false');
      btn.firstChild.textContent = 'Activer le son ';
      this.say('Son coupé.');
      return;
    }
    const ok = await this.audio.enable();
    if (!ok) {
      this.toast('Le navigateur a refusé de démarrer l’audio.', 'error');
      return;
    }
    this.wantSound = true;
    this.audio.setVolume(this.volume);
    btn.setAttribute('aria-pressed', 'true');
    btn.firstChild.textContent = 'Son actif ';
    const hasBeacon = this.world.nodes.some((n) => n.type === 'beacon');
    this.say(hasBeacon ? 'Son actif : écoutez vos balises.' : 'Son actif. Posez une balise (5) pour entendre le plancton.');
  }

  async toggleRecording() {
    const btn = $('#record');
    if (this.audio.recording) {
      const blob = await this.audio.stopRecording();
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = 'Enregistrer';
      $('#rec-badge').hidden = true;
      if (!blob) {
        this.toast('Enregistrement vide : aucune note n’a été captée.', 'error');
        return;
      }
      const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      download(blob, `pelagic-nocturne-${stamp}.${ext}`);
      this.toast(`Enregistrement sauvegardé (${formatTime(this.clock - this.recStart)}, ${Math.round(blob.size / 1024)} Ko).`);
      return;
    }
    if (!this.audio.enabled) await this.toggleSound();
    if (!this.audio.enabled) return;
    if (!this.audio.startRecording()) {
      this.toast('Ce navigateur ne permet pas d’enregistrer l’audio.', 'error');
      return;
    }
    this.recStart = this.clock;
    btn.setAttribute('aria-pressed', 'true');
    btn.textContent = 'Arrêter l’enregistrement';
    $('#rec-badge').hidden = false;
    this.say('Enregistrement en cours : tout ce que vous entendez est capturé, localement.');
  }

  togglePause() {
    this.paused = !this.paused;
    const btn = $('#play');
    btn.setAttribute('aria-pressed', String(!this.paused));
    btn.firstChild.textContent = this.paused ? 'Reprendre ' : 'Pause ';
    this.say(this.paused ? 'Courants figés.' : 'Les courants reprennent.');
  }

  respawn() {
    try {
      this.E.resetParticles(this.world, this.settings.count);
      this.renderer.clear();
      this.say('Nouveau plancton relâché.');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  clearAll() {
    if (!this.canEdit()) return;
    if (!this.world.nodes.length) {
      this.say('L’océan est déjà vide.');
      return;
    }
    this.checkpoint();
    const snapshot = this.world.nodes.map((n) => ({ ...n }));
    for (const n of snapshot) this.E.removeNode(this.world, n.id);
    this.flashes.clear();
    this.schedulePersist();
    this.toast(`${snapshot.length} élément(s) retiré(s).`, 'info', { label: 'Annuler', run: () => this.undo() });
  }

  mountAtlas({ ATLAS, atlasToJson, atlasPreview }) {
    const list = $('#atlas');
    if (!list) return;
    list.replaceChildren();
    for (const entry of ATLAS) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'atlas__card';
      btn.dataset.atlas = entry.id;
      btn.title = entry.hint;
      const name = document.createElement('span');
      name.className = 'atlas__name';
      name.textContent = entry.name;
      btn.append(atlasPreview(entry), name);
      btn.setAttribute('aria-label', `${entry.name}. ${entry.hint}`);
      btn.addEventListener('click', () => this.loadAtlas(entry, atlasToJson));
      li.append(btn);
      list.append(li);
    }
  }

  loadAtlas(entry, atlasToJson) {
    if (!this.canEdit()) return;
    let snapshot = null;
    try {
      snapshot = this.E.serializeWorld(this.world, this.settings);
    } catch { /* état courant non sérialisable : pas d'annulation possible */ }
    try {
      const { world, settings } = this.E.deserializeWorld(atlasToJson(entry));
      this.checkpoint();
      this.loadWorld(world, settings);
    } catch (err) {
      this.toast(`Composition illisible : ${err.message}`, 'error');
      return;
    }
    for (const b of document.querySelectorAll('.atlas__card')) {
      b.setAttribute('aria-current', String(b.dataset.atlas === entry.id));
    }
    if (this.paused) this.togglePause();
    this.say(`${entry.name} — ${entry.hint}`);
    const hasBeacon = entry.nodes.some((n) => n.type === 'beacon');
    const nudge = hasBeacon && !this.audio.enabled ? ' Activez le son (M) pour l’entendre.' : '';
    this.toast(`${entry.name} chargé.${nudge}`, 'info', snapshot && {
      label: 'Revenir',
      run: () => {
        try {
          const { world, settings } = this.E.deserializeWorld(snapshot);
          this.loadWorld(world, settings);
          this.captureIfComposing();
          for (const b of document.querySelectorAll('.atlas__card')) b.removeAttribute('aria-current');
          this.say('Composition précédente restaurée.');
        } catch (err) {
          this.toast(err.message, 'error');
        }
      },
    });
  }

  snapshot() {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const draw = () => new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
    const hadCursor = this.cursor;
    this.cursor = null; // pas de réticule sur la photo
    const prevHover = this.hover;
    this.hover = null;
    this.render(0);
    draw().then((blob) => {
      this.cursor = hadCursor;
      this.hover = prevHover;
      if (!blob) {
        this.toast('Photo impossible dans ce navigateur.', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pelagic-${stamp}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.say('Photographie de l’océan enregistrée.');
    });
  }

  toggleImmersion(force) {
    const on = force ?? !document.body.classList.contains('is-immersive');
    document.body.classList.toggle('is-immersive', on);
    $('#immersive-exit').hidden = !on;
    $('#immersive').setAttribute('aria-pressed', String(on));
    requestAnimationFrame(() => this.resize());
    if (on) this.toast('Immersion : F ou Échap pour revenir.');
  }

  openHelp() {
    const dlg = $('#help');
    if (!dlg.open) dlg.showModal();
  }

  exportFile() {
    let json;
    const composing = this.mode === 'compose' && this.score;
    try {
      json = composing ? this.S.serializeScore(this.score) : this.E.serializeWorld(this.world, this.settings);
    } catch (err) {
      this.toast(`Export impossible : ${err.message}`, 'error');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    download(new Blob([json], { type: 'application/json' }), `pelagic-${composing ? 'nocturne' : 'composition'}-${stamp}.json`);
    this.say(composing ? 'Partition exportée : quatre mouvements, tempo et gamme.' : 'Composition exportée.');
  }

  async importFile(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 128000) {
      this.toast('Fichier trop volumineux (128 Ko maximum).', 'error');
      return;
    }
    try {
      const text = await file.text();
      let kind = null;
      try { kind = JSON.parse(text)?.kind; } catch { /* le moteur expliquera l'erreur */ }
      if (kind === 'score') {
        const score = this.S.deserializeScore(text);
        this.stopTransport();
        this.score = score;
        this.setMode('compose', { quiet: true });
        this.selectMovement(0);
        this.say(`Partition « ${score.title} » importée : quatre mouvements, ${score.bars} mesures.`);
      } else {
        if (!this.canEdit()) return;
        const { world, settings } = this.E.deserializeWorld(text);
        this.checkpoint();
        this.loadWorld(world, settings);
        this.captureIfComposing();
        this.say(`« ${file.name} » importé : ${world.nodes.length} élément(s).`);
      }
    } catch (err) {
      this.toast(`Import refusé : ${err.message}`, 'error');
    }
  }

  loadWorld(world, settings, { keepTrails = false } = {}) {
    this.world = world;
    this.settings = settings;
    this.flashes.clear();
    this.conductor.reset();
    this.hover = null;
    this.hideHint();
    this.select(null);
    if (!keepTrails) this.renderer.clear();
    this.syncControls();
    this.schedulePersist();
  }

  async copyLink() {
    let url;
    try {
      url = `${location.origin}${location.pathname}#w=${toBase64Url(this.E.serializeWorld(this.world, this.settings))}`;
    } catch (err) {
      this.toast(err.message, 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.toast('Lien copié : il contient toute la composition, rien n’est envoyé sur Internet.');
    } catch {
      // Presse-papiers refusé : on place le lien dans la barre d'adresse.
      history.replaceState(null, '', url);
      this.toast('Presse-papiers indisponible : le lien est dans la barre d’adresse.');
    }
  }

  // ---------- Modes et partition ----------

  bindModes() {
    const group = $('#modes');
    group.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-mode]');
      if (b) this.setMode(b.dataset.mode);
    });
    group.addEventListener('keydown', (ev) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) return;
      ev.preventDefault();
      const next = this.mode === 'explore' ? 'compose' : 'explore';
      this.setMode(next);
      group.querySelector(`[data-mode="${next}"]`).focus();
    });
  }

  setMode(mode, { quiet = false } = {}) {
    if (mode === this.mode) return;
    if (mode === 'compose') {
      if (!this.score) {
        try {
          // Première visite : on découvre une vraie pièce, pas quatre copies de l'océan.
          this.score = createNocturne();
        } catch (err) {
          this.toast(`Partition impossible : ${err.message}`, 'error');
          return;
        }
      }
      // L'océan d'Explorer est mis de côté, intact, le temps de composer.
      this.exploreSnapshot = { nodes: this.world.nodes.map((n) => ({ ...n })), settings: { ...this.settings } };
      this.mode = 'compose';
      this.settings = { ...this.settings, tempo: this.score.tempo, scale: this.score.scale };
      this.selectMovement(this.movement, { quiet: true });
      if (!quiet) this.say('Composer : chaque mouvement est un état de l’océan. Éditez-en un, puis Entrée pour écouter la métamorphose.');
    } else {
      this.stopTransport();
      this.mode = 'explore';
      if (this.exploreSnapshot) {
        this.world.nodes = this.exploreSnapshot.nodes;
        this.world.nextId = Math.max(0, ...this.world.nodes.map((n) => n.id)) + 1;
        this.settings = { ...this.exploreSnapshot.settings, count: this.settings.count };
        this.exploreSnapshot = null;
        this.select(null);
        this.flashes.clear();
        this.conductor.reset();
      }
      if (!quiet) this.say('Explorer : l’océan est à vous, sans partition.');
    }
    document.body.dataset.mode = this.mode;
    $('#score').hidden = this.mode !== 'compose';
    $('#share-lede').textContent = this.mode === 'compose' ? 'Exporte toute la partition (quatre mouvements).' : 'Exporte la composition affichée.';
    for (const b of document.querySelectorAll('#modes [data-mode]')) {
      const on = b.dataset.mode === this.mode;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    this.syncControls();
    this.timeline.render(this.timelineState());
    requestAnimationFrame(() => this.resize());
    this.schedulePersist();
  }

  timelineState() {
    return { score: this.score, selected: this.movement, transport: this.transport };
  }

  phase() {
    if (!this.score) return 0;
    const total = this.score.bars * 4;
    return (((this.transport.beat % total) + total) % total) / total;
  }

  /** Affiche un mouvement (lecture arrêtée) pour l'éditer. */
  selectMovement(i, { quiet = false } = {}) {
    if (!this.score) return;
    this.stopTransport();
    this.movement = clamp(i, 0, 3);
    this.transport = { ...this.transport, beat: this.movement * this.score.bars, ended: false };
    const sample = this.S.sampleScore(this.score, this.transport.beat);
    this.S.applySample(this.world, sample);
    this.settings = { ...this.settings, ...sample.settings };
    // Explicit selection/import loads the movement's population once. During
    // playback applySample preserves the buffers, so morphing stays continuous.
    if (this.world.p.n !== this.settings.count) {
      this.E.resetParticles(this.world, this.settings.count);
      this.renderer.clear();
    }
    this.conductor.reset();
    this.select(null);
    this.syncControls();
    this.timeline.render(this.timelineState());
    const m = this.score.movements[this.movement];
    if (!quiet) this.say(`Mouvement ${['I', 'II', 'III', 'IV'][this.movement]} — « ${m.name} » : éditez l’océan, il s’enregistre dans ce mouvement.`);
  }

  toggleTransport() {
    if (this.mode !== 'compose' || !this.score) return;
    if (this.transport.playing) {
      this.stopTransport();
      const { movement } = this.S.sampleScore(this.score, this.transport.beat);
      this.selectMovement(movement, { quiet: true });
      this.say(`Pause — édition du mouvement ${['I', 'II', 'III', 'IV'][movement]} « ${this.score.movements[movement].name} ».`);
      return;
    }
    this.captureIfComposing();
    this.select(null);
    if (this.paused) this.togglePause();
    this.conductor.reset();
    this.transport = { ...this.transport, playing: true, ended: false };
    if (this.tool !== 'hand') this.setTool('hand', { quiet: true });
    this.timeline.render(this.timelineState());
    const nudge = this.audio.enabled ? '' : ' Activez le son (M) pour l’entendre.';
    this.say(`La partition joue : ${this.score.tempo} bpm, ${SCALE_LABELS[this.score.scale]}. Touchez l’eau pour l’interpréter.${nudge}`);
  }

  stopTransport() {
    if (!this.transport.playing) return;
    this.transport = { ...this.transport, playing: false };
    this.liveSettings = null;
    this.timeline?.render(this.timelineState());
  }

  onTransportEnded() {
    this.liveSettings = null;
    this.timeline.render(this.timelineState());
    this.say('Fin de la partition. Entrée pour la rejouer.');
  }

  /** Charge et joue la Nocturne de démonstration ; la partition précédente reste annulable. */
  playNocturne() {
    const previous = this.score;
    this.unlockAudio();
    this.stopTransport();
    this.score = createNocturne();
    this.movement = 0;
    if (this.mode !== 'compose') this.setMode('compose', { quiet: true });
    this.selectMovement(0, { quiet: true });
    this.toggleTransport();
    this.schedulePersist();
    if (previous) {
      this.toast('« Ce que l’eau garde » est chargée.', 'info', {
        label: 'Revenir à ma partition',
        run: () => {
          this.stopTransport();
          this.score = previous;
          this.selectMovement(0, { quiet: true });
          this.schedulePersist();
          this.say('Votre partition est revenue.');
        },
      });
    }
  }

  copyToNext() {
    if (!this.score || this.transport.playing) return;
    const next = (this.movement + 1) % 4;
    try {
      this.S.captureMovement(this.score, next, this.world, this.settings);
    } catch (err) {
      this.toast(err.message, 'error');
      return;
    }
    this.selectMovement(next, { quiet: true });
    this.schedulePersist();
    this.say(`Mouvement ${['I', 'II', 'III', 'IV'][next]} : copie du précédent. Faites-le évoluer.`);
  }

  setBars(n) {
    if (!this.score) return;
    try {
      this.score = this.S.deserializeScore(JSON.stringify({ ...this.score, bars: n }));
    } catch (err) {
      this.toast(err.message, 'error');
      return;
    }
    this.selectMovement(this.movement, { quiet: true });
    this.schedulePersist();
    this.say(`Partition de ${n} mesures (${Math.round((n * 4 * 60) / this.score.tempo)} s par cycle).`);
  }

  renameMovement(i, name) {
    if (!this.score) return;
    const movements = this.score.movements.map((m, k) => (k === i ? { ...m, name } : m));
    try {
      this.score = this.S.deserializeScore(JSON.stringify({ ...this.score, movements }));
    } catch (err) {
      this.toast(err.message, 'error');
      return;
    }
    this.timeline.render(this.timelineState());
    this.schedulePersist();
  }

  // ---------- Messages ----------

  say(text) {
    const log = $('#log');
    if (log && text) log.textContent = text;
  }

  toast(text, kind = 'info', action = null) {
    const el = $('#toast');
    el.replaceChildren(document.createTextNode(text));
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn--ghost toast__action';
      b.textContent = action.label;
      b.addEventListener('click', () => {
        action.run();
        el.hidden = true;
      }, { once: true });
      el.append(' ', b);
    }
    el.dataset.kind = kind;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 3800);
    if (kind === 'error') this.say(text);
  }
}

/** Propose un fichier local au téléchargement. */
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

/** Colore la partie remplie d'un curseur (WebKit) via une variable CSS. */
function paintRange(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 1;
  const pct = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty('--fill', `${pct}%`);
}

main().catch((err) => {
  console.error(err);
  showFatal('Une erreur inattendue est survenue', err?.message ?? String(err));
});
