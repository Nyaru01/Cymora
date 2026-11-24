// PELAGIC — interface, rendu Canvas et interactions.
// Auteur : CLAUDE. Le moteur (src/engine.js, CODEX) reste la seule source de
// vérité physique ; ce module dessine, écoute et chante.

import {
  BEACON_RADIUS, HIT_RADIUS, LABELS, clamp, crossings, describeNode, fitSquare,
  formatTime, fromBase64Url, nodeAt, nudgeStrength, screenToWorld, speedBucket, toBase64Url,
} from './ui.js';
import { createAudio, noteName, pitchForDepth } from './audio.js';

const STORE_KEY = 'pelagic.session.v1';
const PREFS_KEY = 'pelagic.prefs.v1';
const SEEN_KEY = 'pelagic.seen.v1';
const SONAR_WINDOW = 14; // secondes visibles sur le sonar
const BEACON_COOLDOWN = 0.14; // secondes entre deux notes d'une même balise

// Palette des traînées : abysses → menthe → écume.
const TRAIL_COLORS = ['#1b5d9c', '#2a8fd0', '#3fc4e6', '#5fffd0', '#b8ffe9', '#ffffff'];
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
  try {
    engine = await import('./engine.js');
  } catch (err) {
    showFatal('Le moteur ne répond pas', `Impossible de charger src/engine.js (${err.message}). Lancez l'application avec START.ps1.`);
    return;
  }
  const app = new Pelagic(engine);
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
  constructor(engine) {
    this.E = engine;
    this.canvas = $('#ocean');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.trail = document.createElement('canvas');
    this.tctx = this.trail.getContext('2d');
    this.sonar = $('#sonar');
    this.sctx = this.sonar.getContext('2d');
    this.audio = createAudio();

    this.settings = { ...engine.DEFAULTS };
    this.tool = 'vortex';
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
    this.flashes = new Map(); // id balise → instant de la dernière note
    this.lastNote = new Map();
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

  persist() {
    try {
      safeStorage('set', STORE_KEY, this.E.serializeWorld(this.world, this.settings));
    } catch { /* réglages hors limites : on ne sauvegarde pas un état invalide */ }
    safeStorage('set', PREFS_KEY, JSON.stringify({ trail: this.trailPersistence, volume: this.volume }));
  }

  schedulePersist() {
    this.saveTimer = 0.6;
  }

  start() {
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
      // Sous-pas : le moteur borne dt à 0,05 s ; on découpe pour rester fidèle.
      let remaining = dt;
      while (remaining > 1e-6) {
        const step = Math.min(0.05, remaining);
        this.E.stepWorld(this.world, step, this.settings);
        this.listenBeacons();
        remaining -= step;
      }
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

  listenBeacons() {
    const beacons = this.world.nodes.filter((n) => n.type === 'beacon');
    if (!beacons.length) return;
    for (const b of beacons) {
      const hits = crossings(this.world.particles, b, BEACON_RADIUS * (0.6 + Math.abs(b.strength) * 0.4));
      if (!hits) continue;
      const last = this.lastNote.get(b.id) ?? -Infinity;
      if (this.clock - last < BEACON_COOLDOWN) continue;
      this.lastNote.set(b.id, this.clock);
      const freq = pitchForDepth(b.y);
      const velocity = clamp(0.25 + hits * 0.12, 0.25, 1) * clamp(Math.abs(b.strength), 0.2, 2) / 1.2;
      const pan = (b.x - 0.5) * 1.6;
      this.audio.chime(freq, velocity, pan);
      this.flashes.set(b.id, this.clock);
      this.sonarEvents.push({ t: this.clock, freq, pan, v: velocity });
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
      this.trail.width = W;
      this.trail.height = H;
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
    const { ctx, tctx, rect } = this;
    const { x: ox, y: oy, size } = rect;
    const d = this.dpr;
    if (!this.backdrop) this.buildBackdrop();

    // Traînées : on efface progressivement puis on ajoute les segments récents.
    tctx.globalCompositeOperation = 'destination-out';
    tctx.fillStyle = `rgba(0,0,0,${(1 - this.trailPersistence).toFixed(3)})`;
    tctx.fillRect(0, 0, this.trail.width, this.trail.height);
    tctx.globalCompositeOperation = 'lighter';
    tctx.lineWidth = 1.15 * d;
    tctx.lineCap = 'round';

    if (!this.paused) {
      const buckets = TRAIL_COLORS.map(() => []);
      for (const p of this.world.particles) {
        if (p.px === p.x && p.py === p.y) continue;
        buckets[speedBucket(p.speed, TRAIL_COLORS.length)].push(p);
      }
      tctx.save();
      tctx.beginPath();
      tctx.rect(ox, oy, size, size);
      tctx.clip();
      buckets.forEach((list, i) => {
        if (!list.length) return;
        tctx.strokeStyle = TRAIL_COLORS[i];
        tctx.globalAlpha = 0.55 + i * 0.07;
        tctx.beginPath();
        for (const p of list) {
          // La vitesse du moteur est faible : on allonge visuellement le segment.
          const ax = ox + p.px * size;
          const ay = oy + p.py * size;
          const bx = ox + p.x * size;
          const by = oy + p.y * size;
          const ex = bx + (bx - ax) * 0.8;
          const ey = by + (by - ay) * 0.8;
          tctx.moveTo(ax, ay);
          tctx.lineTo(ex === ax && ey === ay ? ex + 0.5 : ex, ey);
        }
        tctx.stroke();
      });
      tctx.restore();
      tctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.backdrop, 0, 0);
    ctx.drawImage(this.trail, 0, 0);

    // Plancton au repos (pause) : points fins pour garder la scène lisible.
    if (this.paused) {
      ctx.fillStyle = 'rgba(95, 255, 208, 0.55)';
      for (const p of this.world.particles) ctx.fillRect(ox + p.x * size, oy + p.y * size, d, d);
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

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5 * d;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * d;

    if (n.type === 'vortex') {
      const dir = s >= 0 ? -1 : 1;
      ctx.rotate(dir * t * (0.6 + mag));
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.9 - i * 0.25;
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.45 + i * 0.32), i * 2.1, i * 2.1 + Math.PI * 1.25);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 2 * d, 0, Math.PI * 2);
      ctx.fill();
    } else if (n.type === 'source') {
      for (let i = 0; i < 3; i++) {
        let phase = (t * 0.5 + i / 3) % 1;
        if (s < 0) phase = 1 - phase;
        ctx.globalAlpha = (1 - phase) * 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.3 + phase * 1.2), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
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
      ctx.globalAlpha = 0.18;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    } else if (n.type === 'beacon') {
      const zone = BEACON_RADIUS * (0.6 + mag * 0.4) * rect.size;
      const since = this.clock - (this.flashes.get(n.id) ?? -10);
      const glow = Math.max(0, 1 - since / 0.6);
      ctx.setLineDash([3 * d, 4 * d]);
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(0, 0, zone, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (glow > 0) {
        ctx.globalAlpha = glow * 0.8;
        ctx.lineWidth = 2 * d;
        ctx.beginPath();
        ctx.arc(0, 0, zone * (1 + (1 - glow) * 0.8), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, (3.5 + glow * 3) * d, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `${10 * d}px Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = 0.75;
      ctx.fillText(noteName(pitchForDepth(n.y)), 0, zone + 4 * d);
    }

    if (isHover) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.9;
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
    const maxF = Math.log2(110 * 2 ** (34 / 12));
    for (const e of this.sonarEvents) {
      const age = this.clock - e.t;
      const x = c.width - (age / SONAR_WINDOW) * c.width;
      const y = c.height - 6 * d - ((Math.log2(e.freq) - minF) / (maxF - minF)) * (c.height - 12 * d);
      const alpha = 1 - age / SONAR_WINDOW;
      g.globalAlpha = alpha;
      g.fillStyle = e.pan < -0.2 ? '#4cc9ff' : e.pan > 0.2 ? '#b59cff' : '#5fffd0';
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
          : 'SONAR · posez une balise (4) sur le trajet du plancton pour l’entendre chanter',
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
    set('speed', `${(m.energy * 1000).toFixed(1)} mm/s`);
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
      world.particles = this.world.particles;
      world.time = this.world.time;
      const countChanged = settings.count !== this.world.particles.length;
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

  place(type, x, y, negative = false) {
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
    if (!node) return;
    this.checkpoint();
    this.E.removeNode(this.world, node.id);
    this.flashes.delete(node.id);
    this.lastNote.delete(node.id);
    if (this.selectedId === node.id) this.select(null);
    if (this.hover?.id === node.id) this.hover = null;
    this.say(`${LABELS[node.type] ?? 'Élément'} retiré.`);
    this.hideHint();
    this.schedulePersist();
  }

  adjust(node, delta) {
    if (!node) return;
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
    paintRange(range);
    box.dataset.type = node.type;
  }

  bindInspector() {
    const range = $('#insp-strength');
    range.addEventListener('input', () => {
      const node = this.world.nodes.find((n) => n.id === this.selectedId);
      if (!node) return;
      this.checkpoint(`strength:${node.id}`);
      let v = Number(range.value);
      if (Math.abs(v) < 0.1) v = v < node.strength ? -0.1 : 0.1; // jamais nul
      node.strength = Math.round(v * 10) / 10;
      this.syncInspector();
      this.schedulePersist();
    });
    $('#insp-flip').addEventListener('click', () => {
      const node = this.world.nodes.find((n) => n.id === this.selectedId);
      if (!node) return;
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
      this.say('Canevas actif : flèches pour viser, Entrée pour placer, Suppr pour retirer, + / − pour la force.');
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
        if (this.tool === 'erase') this.remove(hit);
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

  setTool(tool) {
    this.tool = tool;
    for (const b of document.querySelectorAll('.tool')) {
      const on = b.dataset.tool === tool;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    this.canvas.dataset.tool = tool;
    const verbs = {
      vortex: 'Touchez l’océan pour créer un tourbillon (Maj : sens inverse).',
      source: 'Touchez l’océan pour créer une source (Maj : un puits qui aspire).',
      reef: 'Touchez l’océan pour poser un récif.',
      beacon: 'Posez une balise sur le trajet du plancton : elle chantera à chaque passage.',
      move: 'Faites glisser un élément, ou molette dessus pour régler sa force.',
      erase: 'Touchez un élément pour le retirer.',
    };
    this.say(verbs[tool]);
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
    this.audio.setVolume(this.volume);
    this.canvas.dataset.tool = this.tool;
    for (const b of document.querySelectorAll('.tool')) b.tabIndex = b.dataset.tool === this.tool ? 0 : -1;
    if (!this.audio.supported) {
      const s = $('#sound');
      s.disabled = true;
      s.textContent = 'Son indisponible dans ce navigateur';
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
      const tools = ['vortex', 'source', 'reef', 'beacon', 'move', 'erase'];
      if (/^[1-6]$/.test(ev.key)) {
        this.setTool(tools[Number(ev.key) - 1]);
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
    this.say(hasBeacon ? 'Son actif : écoutez vos balises.' : 'Son actif. Posez une balise (4) pour entendre le plancton.');
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
      this.tctx.clearRect(0, 0, this.trail.width, this.trail.height);
      this.say('Nouveau plancton relâché.');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  clearAll() {
    if (!this.world.nodes.length) {
      this.say('L’océan est déjà vide.');
      return;
    }
    this.checkpoint();
    const snapshot = this.world.nodes.map((n) => ({ ...n }));
    for (const n of snapshot) this.E.removeNode(this.world, n.id);
    this.flashes.clear();
    this.lastNote.clear();
    this.schedulePersist();
    this.toast(`${snapshot.length} élément(s) retiré(s).`, 'info', {
      label: 'Annuler',
      run: () => {
        for (const n of snapshot) {
          try { this.E.addNode(this.world, n.type, n.x, n.y, n.strength); } catch { /* limite atteinte */ }
        }
        this.schedulePersist();
        this.say('Éléments restaurés.');
      },
    });
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
    try {
      json = this.E.serializeWorld(this.world, this.settings);
    } catch (err) {
      this.toast(`Export impossible : ${err.message}`, 'error');
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `pelagic-${stamp}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.say('Composition exportée.');
  }

  async importFile(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 32000) {
      this.toast('Fichier trop volumineux (32 Ko maximum).', 'error');
      return;
    }
    try {
      const text = await file.text();
      const { world, settings } = this.E.deserializeWorld(text);
      this.checkpoint();
      this.loadWorld(world, settings);
      this.say(`« ${file.name} » importé : ${world.nodes.length} élément(s).`);
    } catch (err) {
      this.toast(`Import refusé : ${err.message}`, 'error');
    }
  }

  loadWorld(world, settings, { keepTrails = false } = {}) {
    this.world = world;
    this.settings = settings;
    this.flashes.clear();
    this.lastNote.clear();
    this.hover = null;
    this.hideHint();
    this.select(null);
    if (!keepTrails) this.tctx.clearRect(0, 0, this.trail.width, this.trail.height);
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
