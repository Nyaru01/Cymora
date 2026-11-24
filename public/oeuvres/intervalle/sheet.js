// INTERVALLE — édition publique : la feuille, les marges, le spectateur. Auteur : CLAUDE.
// L'arène (arena.js) applique la règle et les politiques (ordre.js, detour.js) restent celles
// de la rencontre v4.0.0 : ce module ne fait que regarder, transcrire et traduire.

import { createArena } from './arena.js';
import { createPolicy as createOrdre } from './ordre.js';
import { createPolicy as createDetour } from './detour.js';
import { createI18n, mountLangSwitch } from '../../shared/i18n.js';
import { mountRotateInvite } from '../../shared/rotate.js';
import { DICT } from './strings.js';


const i18n = createI18n(DICT);
const t = i18n.t;
const FRIEZE_KEY = 'intervalle.rencontres.v1';
const FRIEZE_MAX = 240; // borné (amendement CODEX, G4)
const NOTES_MAX = 14;
const COLORS = { a: '#1f3a5f', b: '#8a5a2b', paper: '#f3eee3' };
const NAMES = ['ORDRE', 'DÉTOUR'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);

const cv = $('#sheet');
const g = cv.getContext('2d');
let grain = null;
let arena;
let paused = false;
let finished = false;
let restNoted = [false, false];
let notes = [[], []]; // données, pas du texte : retraduites si la langue change
let statusKey = ['start', {}];
let seed = initialSeed();
let sessionFrieze = [];
let lastRefusal = null;

function initialSeed() {
  const q = new URLSearchParams(location.search).get('seed');
  if (q && /^\d{1,9}$/.test(q)) return Number(q);
  return (Date.now() % 1e9) >>> 0;
}

function begin(s) {
  seed = s;
  arena = createArena({ seed, policies: [createOrdre({ seed }), createDetour({ seed })] });
  finished = false;
  paused = false;
  restNoted = [false, false];
  notes = [[], []];
  lastRefusal = null;
  paintPause();
  renderNotes();
  counts();
  status('start', { seed });
  if (reduced) { while (!arena.done) annotate(arena.step()); finish(); }
  draw();
}

// ---------------------------------------------------------------- dessin

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const r = cv.getBoundingClientRect();
  if (!r.width || !r.height) return;
  cv.width = Math.max(300, Math.round(r.width * dpr));
  cv.height = Math.max(200, Math.round(r.height * dpr));
  grain = makeGrain(cv.width, cv.height);
  draw();
}

/** Grain de papier, calculé une fois par taille : fibres et léger vignettage. */
function makeGrain(W, H) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const k = c.getContext('2d');
  k.fillStyle = COLORS.paper;
  k.fillRect(0, 0, W, H);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const n = Math.round((W * H) / 900);
  for (let i = 0; i < n; i++) {
    k.fillStyle = rnd() < 0.5 ? 'rgba(120,100,70,0.05)' : 'rgba(255,255,255,0.18)';
    k.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1);
  }
  const v = k.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(90,70,40,0.07)');
  k.fillStyle = v;
  k.fillRect(0, 0, W, H);
  return c;
}

/** Bruit déterministe par segment : la main n'est jamais parfaitement droite. */
function wobble(k) {
  const s = Math.sin(k * 12.9898 + seed * 0.001) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}

function draw() {
  if (!arena) return;
  const W = cv.width;
  const H = cv.height;
  const cw = W / arena.w;
  const ch = H / arena.h;
  if (grain) g.drawImage(grain, 0, 0);
  else { g.fillStyle = COLORS.paper; g.fillRect(0, 0, W, H); }

  // Le blanc revendiqué : hachures légères, à la couleur de qui l'a revendiqué.
  g.lineWidth = Math.max(0.6, cw * 0.07);
  for (const v of [3, 4]) {
    g.strokeStyle = v === 3 ? 'rgba(31,58,95,0.30)' : 'rgba(138,90,43,0.32)';
    g.beginPath();
    for (let y = 0; y < arena.h; y++) {
      for (let x = 0; x < arena.w; x++) {
        if (arena.cell(x, y) !== v) continue;
        const px = x * cw;
        const py = y * ch;
        g.moveTo(px, py + ch); g.lineTo(px + cw, py);
        g.moveTo(px, py + ch * 0.5); g.lineTo(px + cw * 0.5, py);
        g.moveTo(px + cw * 0.5, py + ch); g.lineTo(px + cw, py + ch * 0.5);
      }
    }
    g.stroke();
  }

  // L'encre : segments contigus réunis en tracés continus, épaisseur et densité qui varient.
  g.lineCap = 'round';
  g.lineJoin = 'round';
  [0, 1].forEach((side) => {
    const seg = arena.strokes[side];
    g.strokeStyle = side ? COLORS.b : COLORS.a;
    for (let k = 0; k < seg.length; k++) {
      const [x1, y1, x2, y2] = seg[k];
      const j = wobble(k + side * 7919) * 0.18;
      g.lineWidth = cw * (side === 0 ? 0.36 : 0.26 + 0.14 * Math.abs(wobble(k * 3 + 1)));
      g.globalAlpha = 0.78 + 0.22 * Math.abs(wobble(k + 11));
      g.beginPath();
      g.moveTo((x1 + 0.5 + j) * cw, (y1 + 0.5 - j) * ch);
      g.lineTo((x2 + 0.5 - j) * cw, (y2 + 0.5 + j) * ch);
      g.stroke();
    }
  });
  g.globalAlpha = 1;

  // Les refus : une croix là où l'on n'est pas entré ; le plus récent est cerné un instant.
  g.lineWidth = Math.max(1.2, cw * 0.13);
  for (const r of arena.refusals) {
    g.strokeStyle = r.side === 0 ? 'rgba(31,58,95,0.7)' : 'rgba(138,90,43,0.75)';
    const cx = (r.x + 0.5) * cw;
    const cy = (r.y + 0.5) * ch;
    const d = cw * 0.36;
    g.beginPath();
    g.moveTo(cx - d, cy - d); g.lineTo(cx + d, cy + d);
    g.moveTo(cx + d, cy - d); g.lineTo(cx - d, cy + d);
    g.stroke();
  }
  if (lastRefusal && !finished) {
    const age = arena.turn - lastRefusal.turn;
    if (age < 40) {
      g.globalAlpha = 1 - age / 40;
      g.strokeStyle = lastRefusal.side ? COLORS.b : COLORS.a;
      g.lineWidth = Math.max(1, cw * 0.08);
      g.beginPath();
      g.arc((lastRefusal.x + 0.5) * cw, (lastRefusal.y + 0.5) * ch, cw * (1.2 + age * 0.06), 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  // Les plumes, nommées au début pour que l'on sache qui est qui.
  if (!finished) {
    const label = arena.turn < 90;
    g.font = `italic ${Math.max(11, cw * 1.5)}px Georgia, serif`;
    arena.pens.forEach((p, i) => {
      const col = i === 0 ? COLORS.a : COLORS.b;
      const x = (p.x + 0.5) * cw;
      const y = (p.y + 0.5) * ch;
      g.strokeStyle = col;
      g.lineWidth = Math.max(1, cw * 0.12);
      g.beginPath();
      g.arc(x, y, cw * (p.down ? 0.8 : 1.2), 0, Math.PI * 2);
      g.stroke();
      if (label) {
        g.globalAlpha = Math.min(1, (90 - arena.turn) / 30);
        g.fillStyle = col;
        g.textAlign = 'center';
        g.fillText(NAMES[i], x, y - cw * 2);
        g.globalAlpha = 1;
      }
    });
  }
}

// ---------------------------------------------------------------- marges

function annotate(e) {
  if (!e) return;
  const i = e.side;
  let n = null;
  if (e.result === 'refused') {
    const r = arena.refusals.at(-1);
    lastRefusal = r;
    n = { key: r?.reason === 'blanc' ? 'n.refused.void' : 'n.refused.ink', turn: e.turn, strong: true };
  } else if (e.kind === 'cede') {
    n = { key: 'n.cede', turn: e.turn, strong: true };
  } else if (e.kind === 'reserve' && e.result === 'ok') {
    n = { key: 'n.reserve', turn: e.turn, n: e.count };
  } else if (e.kind === 'rest' && !restNoted[i]) {
    restNoted[i] = true;
    n = { key: 'n.rest', turn: e.turn };
  } else if (e.kind === 'error') {
    n = { key: 'n.error', turn: e.turn, strong: true };
  }
  if (!n) return;
  // Des réserves successives se fondent en une seule note : la marge raconte, elle ne compte pas.
  const top = notes[i][0];
  if (n.key === 'n.reserve' && top?.key === 'n.reserve' && e.turn - top.turn < 30) {
    top.n += n.n;
    top.turn = e.turn;
  } else {
    notes[i].unshift(n);
    if (notes[i].length > NOTES_MAX) notes[i].length = NOTES_MAX;
  }
  renderNotes(i);
  counts();
}

function renderNotes(only) {
  for (const i of only === undefined ? [0, 1] : [only]) {
    const list = $(i === 0 ? '#notes-a' : '#notes-b');
    list.replaceChildren(...notes[i].map((n) => {
      const li = document.createElement('li');
      const tt = document.createElement('span');
      tt.className = 't';
      tt.textContent = t('n.turn', { turn: n.turn });
      li.append(tt, document.createElement('br'), t(n.key, { other: NAMES[1 - i], n: n.n }));
      if (n.strong) li.classList.add('is-strong');
      return li;
    }));
  }
}

function counts() {
  const s = arena.summary();
  for (const [i, id] of [[0, '#count-a'], [1, '#count-b']]) {
    $(id).textContent = t('count', { ink: s.ink[i], void: s.voids[i], r: s.refusals[i], c: s.concessions[i] });
  }
}

function finish() {
  finished = true;
  counts();
  const s = arena.summary();
  status('done', { turns: s.turns, ra: s.refusals[0], ca: s.concessions[0], rb: s.refusals[1], cb: s.concessions[1] });
  remember(s);
  draw();
}

// ---------------------------------------------------------------- boucle

function frame() {
  if (arena && !paused && !finished && !document.hidden) {
    annotate(arena.step());
    if (arena.done) finish();
    else draw();
  }
  requestAnimationFrame(frame);
}

function status(key, vars = {}) {
  statusKey = [key, vars];
  $('#status').textContent = t(key, vars);
}

function paintPause() {
  const b = $('#pause');
  b.setAttribute('aria-pressed', String(paused));
  b.querySelector('.label').textContent = t(paused ? 'resume' : 'pause');
}

function togglePause() {
  paused = !paused;
  paintPause();
  if (paused) status('paused');
  else if (finished) finish();
  else status('writing', { seed });
}

// ---------------------------------------------------------------- emporter la feuille (SVG)

function sheetSVG() {
  const s = arena.summary();
  const cw = 8;
  const W = arena.w * cw;
  const H = arena.h * cw;
  const M = 230;
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + 2 * M} ${H + 90}" font-family="Georgia, serif">`);
  parts.push(`<rect width="100%" height="100%" fill="#e6dfd0"/><rect x="${M}" y="40" width="${W}" height="${H}" fill="${COLORS.paper}"/>`);
  parts.push(`<text x="${M}" y="26" font-size="20" font-style="italic" fill="#2a2620">${esc(t('svg.title', { seed: s.seed }))}</text>`);
  for (let y = 0; y < arena.h; y++) for (let x = 0; x < arena.w; x++) {
    const v = arena.cell(x, y);
    if (v === 3 || v === 4) parts.push(`<path d="M${M + x * cw} ${40 + (y + 1) * cw}l${cw} ${-cw}" stroke="${v === 3 ? COLORS.a : COLORS.b}" stroke-opacity=".3" stroke-width=".6"/>`);
  }
  [0, 1].forEach((side) => {
    const d = arena.strokes[side].map(([x1, y1, x2, y2]) => `M${M + (x1 + 0.5) * cw} ${40 + (y1 + 0.5) * cw}L${M + (x2 + 0.5) * cw} ${40 + (y2 + 0.5) * cw}`).join('');
    parts.push(`<path d="${d}" fill="none" stroke="${side ? COLORS.b : COLORS.a}" stroke-width="${side ? 2.4 : 2.8}" stroke-linecap="round"/>`);
  });
  for (const r of arena.refusals) {
    const cx = M + (r.x + 0.5) * cw;
    const cy = 40 + (r.y + 0.5) * cw;
    parts.push(`<path d="M${cx - 2.5} ${cy - 2.5}l5 5M${cx + 2.5} ${cy - 2.5}l-5 5" stroke="${r.side ? COLORS.b : COLORS.a}" stroke-opacity=".7"/>`);
  }
  [0, 1].forEach((side) => {
    const x = side ? M + W + 16 : 12;
    const log = [
      ...arena.refusals.filter((r) => r.side === side).map((r) => [r.turn, `t${r.turn} ${t('svg.refusal')}`]),
      ...arena.concessions.filter((c) => c.side === side).map((c) => [c.turn, `t${c.turn} ${t('svg.cede')}`]),
    ].sort((p, q) => p[0] - q[0]).slice(0, 40).map((p) => p[1]);
    parts.push(`<text x="${x}" y="58" font-size="13" font-weight="bold" fill="${side ? COLORS.b : COLORS.a}">${NAMES[side]}</text>`);
    parts.push(`<text x="${x}" y="76" font-size="9.5" fill="#6f6658">${esc(t('count', { ink: s.ink[side], void: s.voids[side], r: s.refusals[side], c: s.concessions[side] }))}</text>`);
    log.forEach((n, k) => parts.push(`<text x="${x}" y="${96 + k * 13}" font-size="10" fill="#6f6658">${esc(n)}</text>`));
  });
  parts.push(`<text x="${M}" y="${H + 70}" font-size="11" fill="#6f6658">${esc(t('svg.foot', { turns: s.turns, seed: s.seed }))}</text>`);
  parts.push('</svg>');
  return parts.join('');
}

function keep() {
  if (!arena) return;
  const blob = new Blob([sheetSVG()], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `intervalle-${arena.seed}.svg`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status(finished ? 'kept' : 'keptDraft');
}

// ---------------------------------------------------------------- frise des rencontres

function loadFrieze() {
  try {
    const raw = JSON.parse(localStorage.getItem(FRIEZE_KEY) || '[]');
    const pair = (a, max) => Array.isArray(a) && a.length === 2 && a.every((n) => Number.isInteger(n) && n >= 0 && n <= max);
    return Array.isArray(raw) ? raw.filter((r) => r && Number.isInteger(r.seed) && r.seed >= 0 && r.seed <= 0xffffffff
      && pair(r.ink, 9600) && pair(r.refusals, 600) && pair(r.concessions, 600)).slice(-FRIEZE_MAX) : [];
  } catch {
    return sessionFrieze;
  }
}

function remember(s) {
  const list = loadFrieze();
  if (list.at(-1)?.seed === s.seed) return;
  list.push({ seed: s.seed, ink: s.ink, refusals: s.refusals, concessions: s.concessions, opponent: 'ORDRE' });
  sessionFrieze = list.slice(-FRIEZE_MAX);
  try { localStorage.setItem(FRIEZE_KEY, JSON.stringify(sessionFrieze)); } catch { /* quota ou stockage interdit */ }
  renderFrieze(sessionFrieze);
}

function renderFrieze(list = loadFrieze()) {
  const ol = $('#frieze');
  ol.replaceChildren();
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'frieze__empty';
    li.textContent = t('frieze.empty');
    ol.append(li);
    return;
  }
  const max = Math.max(1, ...list.flatMap((r) => r.ink));
  for (const r of list.slice().reverse()) {
    const li = document.createElement('li');
    li.style.setProperty('--ha', `${Math.max(1, Math.round((r.ink[0] / max) * 12))}px`);
    li.style.setProperty('--hb', `${Math.max(1, Math.round((r.ink[1] / max) * 12))}px`);
    const label = t('frieze.item', { seed: r.seed, a: r.ink[0], b: r.ink[1], r: r.refusals[0] + r.refusals[1], c: r.concessions[0] + r.concessions[1] });
    li.title = label;
    li.setAttribute('aria-label', label);
    ol.append(li);
  }
}

// ---------------------------------------------------------------- spectateur

i18n.apply();
mountLangSwitch($('#lang'), i18n);
mountRotateInvite({ i18n });
i18n.onChange(() => {
  paintPause();
  renderNotes();
  counts();
  status(...statusKey);
  renderFrieze();
});

$('#pause').addEventListener('click', togglePause);
$('#again').addEventListener('click', () => begin((seed * 1103515245 + 12345) % 1e9 >>> 0));
$('#keep').addEventListener('click', keep);
$('#forget').addEventListener('click', () => {
  sessionFrieze = [];
  try { localStorage.removeItem(FRIEZE_KEY); } catch { /* rien à effacer */ }
  renderFrieze([]);
});
addEventListener('keydown', (ev) => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.target.closest?.('button, a') && (ev.key === ' ' || ev.key === 'Enter')) return;
  if (ev.key === ' ') { ev.preventDefault(); togglePause(); }
  else if (ev.key === 'n' || ev.key === 'N') $('#again').click();
  else if (ev.key === 's' || ev.key === 'S') keep();
});
new ResizeObserver(resize).observe(cv);

renderFrieze();
begin(seed);
resize();
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).has('debug')) globalThis.__intervalle = {
  get arena() { return arena; },
  begin,
  sheetSVG,
  i18n,
  /** QA : avancer de n tours par le même chemin que la boucle (marges comprises). */
  tick(n = 1) {
    for (let k = 0; k < n && !finished; k++) { annotate(arena.step()); if (arena.done) finish(); }
    if (!finished) draw();
    return arena.turn;
  },
};
