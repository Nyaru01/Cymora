// INTERVALLE — l'arène. Auteur : CLAUDE (règles définies avec CODEX, docs/G4-DECISIONS.md §3).
// Deux politiques écrites séparément se partagent une feuille. L'arène ne juge pas :
// elle applique la règle, note les refus et les concessions, et rien d'autre.
// Pur, déterministe à graine égale, sans DOM.

export const W = 120;
export const H = 80;
export const MAX_TURNS = 600;
export const RESERVE_BUDGET = 240;
export const RESERVE_PER_TURN = 4;
export const RESERVE_REACH = 2;
export const LIFT_RANGE = 6;

// États de case, du point de vue absolu de l'arène (0 = première politique, 1 = seconde).
export const EMPTY = 0;
const INK = [1, 2];
const VOID = [3, 4];

/** Générateur déterministe (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/**
 * @param {{seed:number, policies:[object, object]}} o
 *   chaque politique : { name, act(view) → action } (voir le contrat)
 */
export function createArena({ seed = 1, policies, w = W, h = H, maxTurns = MAX_TURNS } = {}) {
  if (!Array.isArray(policies) || policies.length !== 2) throw new Error('Il faut exactement deux politiques.');
  const cells = new Uint8Array(w * h);
  const starts = [[Math.round(w * 0.27), Math.round(h * 0.5)], [Math.round(w * 0.73), Math.round(h * 0.5)]];
  const pens = starts.map(([x, y], i) => ({ x, y, down: true, side: i }));
  pens.forEach((p, i) => { cells[p.y * w + p.x] = INK[i]; });
  const strokes = [[], []]; // segments [x1,y1,x2,y2]
  const events = [];
  const refusals = [];
  const concessions = [];
  const reserved = [0, 0];
  const rested = [false, false];
  const rngs = policies.map((p, i) => rng((seed ^ hash(`${p.name}:${i}`)) >>> 0));
  let turn = 0;

  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : cells[y * w + x]);

  /** Vue en lecture seule, relative à la politique `i`. */
  function viewFor(i) {
    const o = 1 - i;
    const label = (v) => {
      if (v === -1) return 'out';
      if (v === EMPTY) return 'empty';
      if (v === INK[i]) return 'mine';
      if (v === INK[o]) return 'theirs';
      if (v === VOID[i]) return 'my-void';
      return 'their-void';
    };
    const lastOther = events.filter((e) => e.side === o).slice(-8).map((e) => ({ turn: e.turn, action: e.kind, result: e.result, x: e.x, y: e.y }));
    return Object.freeze({
      w, h, turn, maxTurns,
      me: Object.freeze({ x: pens[i].x, y: pens[i].y, down: pens[i].down }),
      other: Object.freeze({ x: pens[o].x, y: pens[o].y, down: pens[o].down, rested: rested[o] }),
      cell: (x, y) => label(at(x, y)),
      reserveLeft: RESERVE_BUDGET - reserved[i],
      myRefusals: refusals.filter((r) => r.side === i).length,
      lastOther: Object.freeze(lastOther),
      rng: rngs[i],
    });
  }

  function record(side, kind, result, extra = {}) {
    const e = { turn, side, kind, result, x: pens[side].x, y: pens[side].y, ...extra };
    events.push(e);
    return e;
  }

  function apply(i, action) {
    const o = 1 - i;
    const pen = pens[i];
    if (!action || typeof action !== 'object') return record(i, 'invalid', 'invalid');
    if (action.rest) { rested[i] = true; return record(i, 'rest', 'ok'); }
    if (action.cede) {
      concessions.push({ turn, side: i, x: pen.x, y: pen.y });
      return record(i, 'cede', 'ok');
    }
    if (action.lift) { pen.down = false; return record(i, 'lift', 'ok'); }
    if (action.drop) {
      const v = at(pen.x, pen.y);
      if (v === INK[o] || v === VOID[o]) {
        refusals.push({ turn, side: i, x: pen.x, y: pen.y, reason: 'poser' });
        return record(i, 'drop', 'refused');
      }
      pen.down = true;
      if (v === EMPTY) cells[pen.y * w + pen.x] = INK[i];
      return record(i, 'drop', 'ok');
    }
    if (Array.isArray(action.reserve)) {
      let n = 0;
      for (const c of action.reserve.slice(0, RESERVE_PER_TURN)) {
        if (!Array.isArray(c)) continue;
        const [x, y] = c;
        if (!Number.isInteger(x) || !Number.isInteger(y) || at(x, y) !== EMPTY) continue;
        if (cheb(x, y, pen.x, pen.y) > RESERVE_REACH || reserved[i] >= RESERVE_BUDGET) continue;
        cells[y * w + x] = VOID[i];
        reserved[i]++;
        n++;
      }
      return record(i, 'reserve', n ? 'ok' : 'invalid', { count: n });
    }
    if (Array.isArray(action.to)) {
      const [x, y] = action.to;
      if (!Number.isInteger(x) || !Number.isInteger(y) || at(x, y) === -1) return record(i, 'to', 'invalid');
      const d = cheb(x, y, pen.x, pen.y);
      if (d === 0 || d > (pen.down ? 1 : LIFT_RANGE)) return record(i, 'to', 'invalid');
      const v = at(x, y);
      if (v === INK[o] || v === VOID[o]) {
        refusals.push({ turn, side: i, x, y, reason: v === INK[o] ? 'encre' : 'blanc' });
        return record(i, 'to', 'refused', { tx: x, ty: y });
      }
      const fx = pen.x;
      const fy = pen.y;
      pen.x = x;
      pen.y = y;
      if (pen.down) {
        if (v === EMPTY) cells[y * w + x] = INK[i];
        if (v !== VOID[i]) strokes[i].push([fx, fy, x, y]);
      }
      return record(i, 'to', 'ok');
    }
    return record(i, 'invalid', 'invalid');
  }

  const arena = {
    get turn() { return turn; },
    get done() { return turn >= maxTurns || (rested[0] && rested[1]); },
    get pens() { return pens.map((p) => ({ ...p })); },
    get strokes() { return strokes; },
    get refusals() { return refusals; },
    get concessions() { return concessions; },
    get events() { return events; },
    names: policies.map((p) => p.name),
    seed,
    w,
    h,
    cell: (x, y) => at(x, y),
    /** Joue un tour (une action de la politique dont c'est le tour). */
    step() {
      if (arena.done) return null;
      const i = turn % 2;
      let e;
      if (rested[i]) e = record(i, 'rest', 'ok');
      else {
        let action;
        try {
          action = policies[i].act(viewFor(i));
        } catch (err) {
          action = null;
          e = record(i, 'error', 'invalid', { message: String(err?.message ?? err).slice(0, 120) });
        }
        if (!e) e = apply(i, action);
      }
      turn++;
      return e;
    },
    run() {
      while (!arena.done) arena.step();
      return arena;
    },
    summary() {
      let ink = [0, 0];
      for (const v of cells) { if (v === INK[0]) ink[0]++; else if (v === INK[1]) ink[1]++; }
      const count = (list, s) => list.filter((r) => r.side === s).length;
      return {
        seed, turns: turn, names: [...arena.names],
        ink, voids: [...reserved],
        refusals: [count(refusals, 0), count(refusals, 1)],
        concessions: [count(concessions, 0), count(concessions, 1)],
      };
    },
  };
  return arena;
}
