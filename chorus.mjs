// CYMORA — le chœur du jour. Auteur : CLAUDE.
// Chaque jour, tout le monde reçoit le même chant. Quand quelqu'un l'accorde, sa trace (48 hauteurs
// et une durée, rien d'autre) rejoint le chœur ; chacun voit ensuite, en filigrane, comment les autres
// l'ont chanté. Aucune adresse IP, aucun identifiant, aucun cookie n'est conservé : la base ne contient
// que des courbes anonymes, effacées après RETENTION_DAYS jours.
//
// Avec DATABASE_URL (Railway Postgres), les traces vivent dans la base ; sans elle (poste local, tests),
// dans la mémoire du processus.

import { DAILY_PASS as PASS, RESONANCE, attune, chorusGesture, dailyMotif, validTrace } from './public/src/game.js';

export const RETENTION_DAYS = 45;

/**
 * Un mot laissé par un joueur : un texte de 3 à 600 caractères, une signature facultative (40 au plus).
 * Le champ « site » est un piège à robots (invisible) : rempli, le mot est refusé.
 */
export function cleanWord(body) {
  if (!body || typeof body !== 'object' || typeof body.text !== 'string') return null;
  if (body.site) return null;
  const tidy = (s, lines) => s.normalize('NFC').replace(lines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const text = tidy(body.text, true);
  const sign = typeof body.sign === 'string' ? tidy(body.sign, false).slice(0, 40) : '';
  const version = typeof body.version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(body.version) ? body.version : null;
  if (text.length < 3 || text.length > 600) return null;
  return { text, sign, version };
}
const SHOWN = 24; // traces renvoyées au plus

/** AAAA-MM-JJ plausible : hier, aujourd'hui ou demain en UTC (les fuseaux du monde entier). */
export function acceptableDay(day, now = new Date()) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const t = Date.parse(`${day}T12:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== day) return false;
  return Math.abs(t - now.getTime()) <= 36 * 3600 * 1000;
}

/** Mesure de nouveau la trace contre le chant du jour : le serveur ne croit pas le score du client. */
export function judgeTrace(day, trace) {
  if (!acceptableDay(day) || !validTrace(trace)) return null;
  return attune(dailyMotif(day), chorusGesture(trace), PASS);
}

export async function createChorus({ url = process.env.DATABASE_URL, log = console } = {}) {
  if (!url) return memoryChorus();
  try {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30000, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined });
    await pool.query(`CREATE TABLE IF NOT EXISTS chorus (
      id BIGSERIAL PRIMARY KEY,
      day DATE NOT NULL,
      trace REAL[] NOT NULL,
      dur REAL NOT NULL,
      score REAL NOT NULL,
      created DATE NOT NULL DEFAULT CURRENT_DATE
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS chorus_day ON chorus (day, score DESC)');
    // Les mots des joueurs : le texte, la signature, la version du jeu et la date. Rien d'autre.
    await pool.query(`CREATE TABLE IF NOT EXISTS words (
      id BIGSERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      sign TEXT NOT NULL DEFAULT '',
      version TEXT,
      created TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const prune = () => pool.query(`DELETE FROM chorus WHERE day < CURRENT_DATE - ${RETENTION_DAYS}`).catch(() => {});
    prune();
    const timer = setInterval(prune, 6 * 3600 * 1000);
    timer.unref();
    return {
      kind: 'postgres',
      async addWord(w) {
        await pool.query('INSERT INTO words (text, sign, version) VALUES ($1, $2, $3)', [w.text, w.sign, w.version]);
      },
      async add(day, trace, score) {
        await pool.query('INSERT INTO chorus (day, trace, dur, score) VALUES ($1, $2, $3, $4)', [day, trace.y, trace.dur, score]);
      },
      async get(day) {
        const [{ rows: [c] }, { rows }] = await Promise.all([
          pool.query('SELECT count(*)::int AS voices, count(*) FILTER (WHERE score >= $2)::int AS resonant FROM chorus WHERE day = $1', [day, RESONANCE]),
          // Les plus justes d'abord, mêlées d'un peu de hasard pour que le chœur change au fil du jour.
          pool.query('SELECT trace, dur FROM chorus WHERE day = $1 ORDER BY score * (0.85 + random() * 0.3) DESC LIMIT $2', [day, SHOWN]),
        ]);
        return { day, voices: c.voices, resonant: c.resonant, traces: rows.map((r) => ({ y: r.trace.map((v) => Math.round(v * 1000) / 1000), dur: r.dur })) };
      },
      close: () => { clearInterval(timer); return pool.end(); },
    };
  } catch (err) {
    log.error?.(`Chœur : base indisponible (${err.message}), repli en mémoire.`);
    return memoryChorus();
  }
}

function memoryChorus() {
  const days = new Map();
  const words = [];
  return {
    kind: 'memory',
    words,
    async addWord(w) {
      words.push({ ...w, created: new Date().toISOString() });
      if (words.length > 500) words.shift();
    },
    async add(day, trace, score) {
      if (!days.has(day)) days.set(day, []);
      const list = days.get(day);
      list.push({ trace, score });
      if (list.length > 2000) list.shift();
      if (days.size > RETENTION_DAYS) days.delete(days.keys().next().value);
    },
    async get(day) {
      const list = days.get(day) ?? [];
      const best = [...list].sort((a, b) => b.score - a.score).slice(0, SHOWN);
      return { day, voices: list.length, resonant: list.filter((e) => e.score >= RESONANCE).length, traces: best.map((e) => e.trace) };
    },
    close: async () => {},
  };
}

/** Limite douce par visiteur, en mémoire seulement (jamais écrite) : 12 voix par heure. */
export function createLimiter(perHour = 12) {
  const seen = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (seen.get(key) ?? []).filter((t) => now - t < 3600 * 1000);
    if (recent.length >= perHour) { seen.set(key, recent); return false; }
    recent.push(now);
    seen.set(key, recent);
    if (seen.size > 5000) seen.delete(seen.keys().next().value);
    return true;
  };
}

export { PASS };
