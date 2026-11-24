// INTERVALLE — DÉTOUR, la voix de CLAUDE. Écrite sans lire la politique de CODEX.
//
// Ce que DÉTOUR défend :
//  - la courbe plutôt que la droite : une plume qui tourne toujours un peu, jamais pareil ;
//  - le vide comme acte : il réserve du blanc entre lui et l'autre quand l'autre approche,
//    et laisse des « respirations » (petites clairières) le long de son chemin ;
//  - le détour plutôt que la force : refusé, il ne recommence pas, il contourne ;
//  - la concession comme don : parfois, quand l'autre est tout près, il lui cède son tour.
// Rien ici ne vise à gagner de la place. DÉTOUR s'arrête de lui-même.

const TAU = Math.PI * 2;

export function createPolicy() {
  let theta = null; // cap continu
  let fx = 0;
  let fy = 0; // position flottante, pour des courbes plus douces que les 8 directions
  let phase = 0;
  let blocked = 0;
  let jump = null; // détour plume levée en cours {x, y}
  let lastRefusals = 0;
  let nextBreath = 40;
  let lastCede = -99;
  let placed = 0;

  const clampTo = (v, a, b) => Math.max(a, Math.min(b, v));

  return {
    name: 'DÉTOUR',
    act(v) {
      const { me, other, w, h, turn, rng } = v;
      if (theta === null) {
        theta = Math.PI + (rng() - 0.5); // part vers l'autre, mais de biais
        fx = me.x;
        fy = me.y;
      }
      // Assez dit : DÉTOUR se tait avant la fin, et laisse la dernière page à l'autre.
      if (turn > v.maxTurns * 0.9 || placed > 760) return { rest: true };

      // 1. Un détour plume levée est en cours : atterrir, puis reposer la plume.
      if (jump) {
        // Audit CODEX : la destination peut être revendiquée pendant le vol.
        // Annuler le saut refusé évite de retenter indéfiniment la même case.
        if (v.myRefusals > lastRefusals) {
          lastRefusals = v.myRefusals;
          jump = null;
          fx = me.x; fy = me.y;
          return startJump(v);
        }
        if (!me.down && (me.x !== jump.x || me.y !== jump.y)) return { to: [jump.x, jump.y] };
        jump = null;
        fx = me.x;
        fy = me.y;
        if (!me.down) {
          const c = v.cell(me.x, me.y);
          if (c === 'empty' || c === 'mine' || c === 'my-void') return { drop: true };
        }
      }
      if (!me.down) return { drop: true };

      const dOther = Math.max(Math.abs(other.x - me.x), Math.abs(other.y - me.y));

      // 2. Refusé au tour précédent ? On ne force pas : on tourne franchement.
      if (v.myRefusals > lastRefusals) {
        lastRefusals = v.myRefusals;
        blocked++;
        theta += (rng() < 0.5 ? -1 : 1) * (1.1 + rng() * 0.8);
        if (blocked >= 3) return startJump(v);
      }

      // 3. La concession : l'autre est tout près et avance encore → lui laisser le passage.
      if (dOther <= 3 && !other.rested && turn - lastCede > 30 && rng() < 0.35) {
        lastCede = turn;
        return { cede: true };
      }

      // 4. Le vide entre nous : quand l'autre approche, réserver le blanc qui nous sépare.
      if (dOther <= 9 && v.reserveLeft > 0) {
        const cells = between(v, me, other);
        if (cells.length) return { reserve: cells };
      }

      // 5. Respiration : de temps en temps, une petite clairière devant soi.
      if (turn >= nextBreath && v.reserveLeft > 8) {
        nextBreath = turn + 34 + Math.floor(rng() * 40);
        const cells = ahead(v, me, theta);
        if (cells.length) return { reserve: cells };
      }

      // 6. Avancer en courbe : la courbure respire, les bords repoussent doucement.
      phase += 0.045 + rng() * 0.02;
      theta += Math.sin(phase) * 0.16 + (rng() - 0.5) * 0.12;
      const margin = 4;
      if (me.x < margin || me.x > w - 1 - margin || me.y < margin || me.y > h - 1 - margin) {
        const toCenter = Math.atan2(h / 2 - me.y, w / 2 - me.x);
        theta += angleDiff(toCenter, theta) * 0.35;
      }
      for (let tries = 0; tries < 6; tries++) {
        let nx = fx + Math.cos(theta);
        let ny = fy + Math.sin(theta);
        let tx = Math.round(nx);
        let ty = Math.round(ny);
        if (tx === me.x && ty === me.y) { nx += Math.cos(theta); ny += Math.sin(theta); tx = Math.round(nx); ty = Math.round(ny); }
        tx = clampTo(tx, 0, w - 1);
        ty = clampTo(ty, 0, h - 1);
        const c = v.cell(tx, ty);
        if ((c === 'empty' || c === 'my-void' || (c === 'mine' && tries > 2)) && Math.max(Math.abs(tx - me.x), Math.abs(ty - me.y)) === 1) {
          fx = clampTo(nx, 0, w - 1);
          fy = clampTo(ny, 0, h - 1);
          blocked = 0;
          if (c === 'empty') placed++;
          return { to: [tx, ty] };
        }
        theta += (tries % 2 ? -1 : 1) * (0.5 + tries * 0.3); // chercher un passage, alternativement
        fx = me.x;
        fy = me.y;
      }
      return startJump(v);
    },
  };

  /** Le grand détour : lever la plume et aller poser ailleurs, de côté. */
  function startJump(v) {
    const { me, w, h, rng } = v;
    blocked = 0;
    for (let k = 0; k < 12; k++) {
      const a = theta + (rng() < 0.5 ? -1 : 1) * (Math.PI / 2 + rng() * 0.9);
      const r = 3 + Math.floor(rng() * 4);
      const x = Math.max(1, Math.min(w - 2, Math.round(me.x + Math.cos(a) * r)));
      const y = Math.max(1, Math.min(h - 2, Math.round(me.y + Math.sin(a) * r)));
      if (v.cell(x, y) === 'empty') {
        jump = { x, y };
        theta = a;
        return { lift: true };
      }
    }
    theta += Math.PI;
    return { cede: true }; // nulle part où aller : céder plutôt que forcer
  }
}

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Cases vides, à portée, situées entre ma plume et celle de l'autre. */
function between(v, me, other) {
  const out = [];
  const a = Math.atan2(other.y - me.y, other.x - me.x);
  for (const [r, s] of [[2, 0], [2, 1], [2, -1], [1, 1], [1, -1], [1, 0]]) {
    const x = Math.round(me.x + Math.cos(a) * r - Math.sin(a) * s);
    const y = Math.round(me.y + Math.sin(a) * r + Math.cos(a) * s);
    if (v.cell(x, y) === 'empty' && !out.some(([p, q]) => p === x && q === y)) out.push([x, y]);
    if (out.length === 4) break;
  }
  return out;
}

/** Une clairière : quelques cases vides juste devant la plume, de part et d'autre du cap. */
function ahead(v, me, theta) {
  const out = [];
  for (const [r, s] of [[2, 0], [2, 1], [2, -1], [1, 1]]) {
    const x = Math.round(me.x + Math.cos(theta) * r - Math.sin(theta) * s);
    const y = Math.round(me.y + Math.sin(theta) * r + Math.cos(theta) * s);
    if (v.cell(x, y) === 'empty' && !out.some(([p, q]) => p === x && q === y)) out.push([x, y]);
  }
  return out;
}
