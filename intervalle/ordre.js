// ORDRE — CODEX. Une ligne veut tenir sa promesse, même quand la feuille résiste.
// Écrit sans lire DÉTOUR. Une interruption devient une coupe, jamais une rature.
export function createPolicy() {
  let route, index = 0, refused = 0, phase = 'draw', landing = null, age = 0;
  const usable = v => !['out', 'theirs', 'their-void'].includes(v);
  return {
    name: 'ORDRE',
    act(v) {
      if (!route) {
        const y = 39 + Math.floor(v.rng() * 5), offset = Math.floor(v.rng() * 7) - 3;
        // Commencer par rejoindre le milieu ; ensuite élargir un cadre incomplet.
        route = [[60 + offset,y], [60 + offset,y-9], [75+offset,y-9],
          [75+offset,y+10], [45+offset,y+10], [45+offset,y-16],
          [83+offset,y-16], [83+offset,y+17], [37+offset,y+17],
          [37+offset,y-23], [90+offset,y-23]];
      }
      age++;
      if (phase === 'lift') { phase = 'travel'; return { lift: true }; }
      if (phase === 'travel') {
        if (landing) { const p = landing; landing = null; phase = 'drop'; return { to:p }; }
        phase = 'drop';
      }
      if (phase === 'drop') { phase = 'draw'; return { drop:true }; }
      if (v.myRefusals > refused) {
        refused = v.myRefusals;
        // Ne pas insister sur la même case. La coupe laisse la frontière lisible.
        const candidates = [[v.me.x,v.me.y-4],[v.me.x,v.me.y+4],
          [v.me.x+4,v.me.y],[v.me.x-4,v.me.y]];
        const target = route[Math.min(index+1,route.length-1)];
        candidates.sort((a,b) => Math.abs(a[0]-target[0])+Math.abs(a[1]-target[1])
          - Math.abs(b[0]-target[0])-Math.abs(b[1]-target[1]));
        landing = candidates.find(([x,y]) => usable(v.cell(x,y))) || null;
        index = Math.min(index+1,route.length);
        phase = 'lift';
        return { cede:true };
      }
      while (index < route.length && v.me.x === route[index][0] && v.me.y === route[index][1]) index++;
      if (index >= route.length) return { rest:true };
      if (age % 41 === 0 && v.reserveLeft > 0) {
        const margin = [[v.me.x-1,v.me.y-1],[v.me.x-1,v.me.y+1]]
          .filter(([x,y]) => v.cell(x,y) === 'empty');
        if (margin.length) return { reserve:margin };
      }
      const [x,y] = route[index];
      // Pas de diagonale : le détour doit garder la syntaxe d'ORDRE.
      return { to: v.me.x !== x ? [v.me.x+Math.sign(x-v.me.x),v.me.y]
        : [v.me.x,v.me.y+Math.sign(y-v.me.y)] };
    },
  };
}
