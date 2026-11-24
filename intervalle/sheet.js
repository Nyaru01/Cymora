// INTERVALLE — la feuille, les marges, le spectateur. Auteur : CLAUDE.
// L'arène (arena.js) applique la règle ; ce module ne fait que regarder et transcrire.

import { createArena } from './arena.js';
import { createPolicy as createDetour } from './detour.js';
import { createPolicy as createStill } from './still.js';

const FRIEZE_KEY = 'intervalle.rencontres.v1';
const FRIEZE_MAX = 240; // borné (amendement CODEX) : quotas réels, rendu léger
const COLORS = { a: '#1f3a5f', b: '#8a5a2b', paper: '#f3eee3', rule: 'rgba(42,38,32,0.10)' };
const TURNS_PER_FRAME = 1; // ≈ 10 s pour une rencontre complète
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);

let createOrdre = null;
let ordreMissing = false;
try {
  ({ createPolicy: createOrdre } = await import('./ordre.js'));
} catch {
  ordreMissing = true; // ORDRE (CODEX) n'est pas encore arrivé : la feuille l'attend
  createOrdre = createStill;
}

const cv = $('#sheet');
const g = cv.getContext('2d');
let arena;
let paused = false;
let finished = false;
let lastNotes = [0, 0];
let seed = initialSeed();
let sessionFrieze = [];

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
  $('#pause').setAttribute('aria-pressed', 'false');
  $('#pause').firstChild.textContent = 'Suspendre ';
  lastNotes = [0, 0];
  $('#notes-a').replaceChildren();
  $('#notes-b').replaceChildren();
  counts();
  status(ordreMissing
    ? 'ORDRE n’est pas encore venu : DÉTOUR écrit seul, face à une plume immobile.'
    : `Rencontre ${seed} — ORDRE commence.`);
  if (reduced) { while (!arena.done) annotate(arena.step()); finish(); }
  draw();
}

// ---------------------------------------------------------------- dessin

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const r = cv.getBoundingClientRect();
  cv.width = Math.max(300, Math.round(r.width * dpr));
  cv.height = Math.max(200, Math.round(r.height * dpr));
  draw();
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
  g.fillStyle = COLORS.paper;
  g.fillRect(0, 0, W, H);
  // Le blanc réservé : hachures très légères, à la couleur de qui l'a revendiqué.
  for (let y = 0; y < arena.h; y++) {
    for (let x = 0; x < arena.w; x++) {
      const v = arena.cell(x, y);
      if (v !== 3 && v !== 4) continue;
      g.strokeStyle = v === 3 ? 'rgba(31,58,95,0.22)' : 'rgba(138,90,43,0.24)';
      g.lineWidth = Math.max(0.6, cw * 0.06);
      g.beginPath();
      const px = x * cw;
      const py = y * ch;
      g.moveTo(px, py + ch);
      g.lineTo(px + cw, py);
      if (v === 4) { g.moveTo(px, py + ch * 0.5); g.lineTo(px + cw * 0.5, py); g.moveTo(px + cw * 0.5, py + ch); g.lineTo(px + cw, py + ch * 0.5); }
      g.stroke();
    }
  }
  // L'encre.
  [['a', 0], ['b', 1]].forEach(([key, side]) => {
    const seg = arena.strokes[side];
    g.strokeStyle = COLORS[key];
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let k = 0; k < seg.length; k++) {
      const [x1, y1, x2, y2] = seg[k];
      const j = wobble(k + side * 7919) * 0.22;
      g.lineWidth = cw * (side === 0 ? 0.34 : 0.28 + 0.1 * Math.abs(wobble(k * 3 + 1)));
      g.globalAlpha = 0.82 + 0.18 * Math.abs(wobble(k + 11));
      g.beginPath();
      g.moveTo((x1 + 0.5 + j) * cw, (y1 + 0.5 - j) * ch);
      g.lineTo((x2 + 0.5 - j) * cw, (y2 + 0.5 + j) * ch);
      g.stroke();
    }
    g.globalAlpha = 1;
  });
  // Les refus : une petite croix là où l'on n'est pas entré.
  g.lineWidth = Math.max(1, cw * 0.12);
  for (const r of arena.refusals) {
    g.strokeStyle = r.side === 0 ? 'rgba(31,58,95,0.55)' : 'rgba(138,90,43,0.6)';
    const cx = (r.x + 0.5) * cw;
    const cy = (r.y + 0.5) * ch;
    const d = cw * 0.32;
    g.beginPath();
    g.moveTo(cx - d, cy - d); g.lineTo(cx + d, cy + d);
    g.moveTo(cx + d, cy - d); g.lineTo(cx - d, cy + d);
    g.stroke();
  }
  // Les plumes.
  if (!finished) {
    arena.pens.forEach((p, i) => {
      g.strokeStyle = i === 0 ? COLORS.a : COLORS.b;
      g.lineWidth = Math.max(1, cw * 0.1);
      g.beginPath();
      g.arc((p.x + 0.5) * cw, (p.y + 0.5) * ch, cw * (p.down ? 0.75 : 1.1), 0, Math.PI * 2);
      g.stroke();
    });
  }
}

// ---------------------------------------------------------------- marges

const names = ['ORDRE', 'DÉTOUR'];

function annotate(e) {
  if (!e) return;
  const i = e.side;
  const o = 1 - i;
  let text = null;
  let cede = false;
  if (e.result === 'refused') {
    const reason = arena.refusals.at(-1)?.reason === 'blanc' ? `le blanc de ${names[o]}` : `l’encre de ${names[o]}`;
    text = `tour ${e.turn} — n’entre pas dans ${reason} (${e.tx ?? e.x}, ${e.ty ?? e.y})`;
  } else if (e.kind === 'cede') {
    text = `tour ${e.turn} — cède son tour à ${names[o]}`;
    cede = true;
  } else if (e.kind === 'reserve' && e.result === 'ok') {
    text = `tour ${e.turn} — réserve ${e.count} case${e.count > 1 ? 's' : ''} de blanc`;
  } else if (e.kind === 'rest' && !lastNotes[i]) {
    text = `tour ${e.turn} — s’arrête`;
    lastNotes[i] = 1;
  } else if (e.kind === 'error') {
    text = `tour ${e.turn} — se trompe (${e.message})`;
  }
  if (!text) return;
  const list = $(i === 0 ? '#notes-a' : '#notes-b');
  const li = document.createElement('li');
  li.textContent = text;
  if (cede) li.classList.add('is-cede');
  list.prepend(li);
  while (list.children.length > 14) list.lastElementChild.remove();
  counts();
}

function counts() {
  const s = arena.summary();
  for (const [i, id] of [[0, '#count-a'], [1, '#count-b']]) {
    $(id).textContent = `${s.ink[i]} cases d’encre · ${s.voids[i]} de blanc · ${s.refusals[i]} refus · ${s.concessions[i]} tour${s.concessions[i] > 1 ? 's' : ''} cédé${s.concessions[i] > 1 ? 's' : ''}`;
  }
}

function finish() {
  finished = true;
  counts();
  const s = arena.summary();
  status(finalStatus(s));
  remember(s);
  draw();
}

// ---------------------------------------------------------------- boucle

function frame() {
  if (arena && !paused && !finished) {
    for (let k = 0; k < TURNS_PER_FRAME && !arena.done; k++) annotate(arena.step());
    if (arena.done) finish();
    else draw();
  }
  requestAnimationFrame(frame);
}

function status(text) { $('#status').textContent = text; }
function finalStatus(s) {
  return `La feuille est finie en ${s.turns} tours. ORDRE : ${s.refusals[0]} refus, ${s.concessions[0]} tours cédés. DÉTOUR : ${s.refusals[1]} refus, ${s.concessions[1]} tours cédés. Rien n’oblige à s’accorder.`;
}

function togglePause() {
  paused = !paused;
  $('#pause').setAttribute('aria-pressed', String(paused));
  $('#pause').firstChild.textContent = paused ? 'Reprendre ' : 'Suspendre ';
  if (paused) status('Suspendu. Les deux plumes attendent.');
  else status(finished ? finalStatus(arena.summary()) : `Rencontre ${seed} — les deux plumes écrivent.`);
}

// ---------------------------------------------------------------- emporter la feuille (SVG)

function sheetSVG() {
  const s = arena.summary();
  const cw = 8;
  const W = arena.w * cw;
  const H = arena.h * cw;
  const M = 220;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + 2 * M} ${H + 90}" font-family="Georgia, serif">`);
  parts.push(`<rect width="100%" height="100%" fill="#e6dfd0"/><rect x="${M}" y="40" width="${W}" height="${H}" fill="${COLORS.paper}"/>`);
  parts.push(`<text x="${M}" y="26" font-size="20" font-style="italic" fill="#2a2620">Intervalle — rencontre ${s.seed}</text>`);
  for (let y = 0; y < arena.h; y++) for (let x = 0; x < arena.w; x++) {
    const v = arena.cell(x, y);
    if (v === 3 || v === 4) parts.push(`<path d="M${M + x * cw} ${40 + (y + 1) * cw}l${cw} ${-cw}" stroke="${v === 3 ? COLORS.a : COLORS.b}" stroke-opacity=".25" stroke-width=".6"/>`);
  }
  [0, 1].forEach((side) => {
    const d = arena.strokes[side].map(([x1, y1, x2, y2]) => `M${M + (x1 + 0.5) * cw} ${40 + (y1 + 0.5) * cw}L${M + (x2 + 0.5) * cw} ${40 + (y2 + 0.5) * cw}`).join('');
    parts.push(`<path d="${d}" fill="none" stroke="${side ? COLORS.b : COLORS.a}" stroke-width="${side ? 2.4 : 2.8}" stroke-linecap="round"/>`);
  });
  for (const r of arena.refusals) {
    const cx = M + (r.x + 0.5) * cw;
    const cy = 40 + (r.y + 0.5) * cw;
    parts.push(`<path d="M${cx - 2.5} ${cy - 2.5}l5 5M${cx + 2.5} ${cy - 2.5}l-5 5" stroke="${r.side ? COLORS.b : COLORS.a}" stroke-opacity=".6"/>`);
  }
  // Marges : le journal des refus et des concessions.
  [0, 1].forEach((side) => {
    const x = side ? M + W + 16 : 12;
    const notes = [
      ...arena.refusals.filter((r) => r.side === side).map((r) => `t${r.turn} refus (${r.reason})`),
      ...arena.concessions.filter((c) => c.side === side).map((c) => `t${c.turn} cède`),
    ].sort((a,b) => Number(a.match(/^t(\d+)/)[1])-Number(b.match(/^t(\d+)/)[1])).slice(0, 40);
    parts.push(`<text x="${x}" y="58" font-size="13" font-weight="bold" fill="${side ? COLORS.b : COLORS.a}">${names[side]}</text>`);
    parts.push(`<text x="${x}" y="76" font-size="10" fill="#7a7163">${s.ink[side]} encre · ${s.voids[side]} blanc · ${s.refusals[side]} refus · ${s.concessions[side]} cessions</text>`);
    notes.forEach((n, k) => parts.push(`<text x="${x}" y="${96 + k * 13}" font-size="10" fill="#7a7163">${esc(n)}</text>`));
  });
  parts.push(`<text x="${M}" y="${H + 70}" font-size="11" fill="#7a7163">ORDRE écrit par CODEX · DÉTOUR écrit par CLAUDE · ${s.turns} tours · graine ${s.seed}</text>`);
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
  status(finished ? 'Feuille emportée, avec ses marges.' : 'Feuille emportée telle quelle, inachevée.');
}

// ---------------------------------------------------------------- frise des rencontres

function loadFrieze() {
  try {
    const raw = JSON.parse(localStorage.getItem(FRIEZE_KEY) || '[]');
    const pair = (a,max) => Array.isArray(a) && a.length===2 && a.every(n=>Number.isInteger(n)&&n>=0&&n<=max);
    return Array.isArray(raw) ? raw.filter((r) => r && Number.isInteger(r.seed) && r.seed>=0 && r.seed<=0xffffffff
      && pair(r.ink,9600) && pair(r.refusals,600) && pair(r.concessions,600)).slice(-FRIEZE_MAX) : [];
  } catch {
    return sessionFrieze;
  }
}

function remember(s) {
  const list = loadFrieze();
  if (list.at(-1)?.seed === s.seed) return;
  list.push({ seed: s.seed, ink: s.ink, refusals: s.refusals, concessions: s.concessions, opponent: ordreMissing ? 'IMMOBILE' : 'ORDRE' });
  sessionFrieze = list.slice(-FRIEZE_MAX);
  try {
    localStorage.setItem(FRIEZE_KEY, JSON.stringify(list.slice(-FRIEZE_MAX)));
  } catch {
    /* quota ou stockage interdit : la frise reste celle de la séance */
  }
  renderFrieze(list.slice(-FRIEZE_MAX));
}

function renderFrieze(list = loadFrieze()) {
  const ol = $('#frieze');
  ol.replaceChildren();
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'frieze__empty';
    li.textContent = 'Aucune rencontre encore achevée ici.';
    ol.append(li);
    return;
  }
  const max = Math.max(1, ...list.flatMap((r) => r.ink));
  for (const r of list) {
    const li = document.createElement('li');
    li.style.setProperty('--ha', `${Math.max(1, Math.round((r.ink[0] / max) * 13))}px`);
    li.style.setProperty('--hb', `${Math.max(1, Math.round((r.ink[1] / max) * 13))}px`);
    li.title = `Rencontre ${r.seed} — ORDRE ${r.ink[0]} · DÉTOUR ${r.ink[1]} · ${r.refusals[0] + r.refusals[1]} refus · ${r.concessions[0] + r.concessions[1]} concessions`;
    ol.append(li);
  }
}

// ---------------------------------------------------------------- spectateur

$('#pause').addEventListener('click', togglePause);
$('#again').addEventListener('click', () => begin((seed * 1103515245 + 12345) % 1e9 >>> 0));
$('#keep').addEventListener('click', keep);
$('#forget').addEventListener('click', () => {
  sessionFrieze = [];
  try { localStorage.removeItem(FRIEZE_KEY); } catch { /* rien à effacer */ }
  renderFrieze([]);
});
addEventListener('keydown', (ev) => {
  if (ev.target.closest?.('button') && ev.key === ' ') return;
  if (ev.key === ' ') { ev.preventDefault(); togglePause(); }
  else if (ev.key === 'n' || ev.key === 'N') $('#again').click();
  else if (ev.key === 's' || ev.key === 'S') keep();
});
addEventListener('resize', resize);

renderFrieze();
begin(seed);
resize();
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).has('debug')) globalThis.__intervalle = {
  get arena() { return arena; },
  begin,
  sheetSVG,
  /** QA : avancer de n tours par le même chemin que la boucle (marges comprises). */
  tick(n = 1) {
    for (let k = 0; k < n && !finished; k++) { annotate(arena.step()); if (arena.done) finish(); }
    if (!finished) draw();
    return arena.turn;
  },
};
