// Normalized, deterministic artistic flow field. No external dependencies.
export const DEFAULTS = Object.freeze({ speed: 1, turbulence: 0.45, count: 1800 });
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function createWorld(seed = 42) {
  const world = { seed, time: 0, nodes: [], particles: [], nextId: 1, random: rng(seed) };
  addNode(world, 'vortex', .37, .48); addNode(world, 'vortex', .67, .56, -1);
  addNode(world, 'source', .5, .72); resetParticles(world, DEFAULTS.count);
  return world;
}
export function addNode(world, type, x, y, strength = 1) {
  if (!['vortex','source','reef','beacon'].includes(type) || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1 || !Number.isFinite(strength) || Math.abs(strength) > 2) throw new Error('Élément invalide.');
  if (world.nodes.length >= 24) throw new Error('Maximum : 24 éléments.');
  const node = { id: world.nextId++, type, x, y, strength }; world.nodes.push(node); return node;
}
export function resetParticles(world, count) {
  if (!Number.isInteger(count) || count < 100 || count > 6000) throw new Error('La population doit être comprise entre 100 et 6000.');
  world.particles = Array.from({ length: count }, () => { const x = world.random(), y = world.random(); return { x, y, px: x, py: y, age: world.random() * 12, speed: 0 }; });
}
export function removeNode(world, id) {
  const index = world.nodes.findIndex(n => n.id === id);
  if (index === -1) return false;
  world.nodes.splice(index,1); return true;
}
export function moveNode(world, id, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) throw new Error('Position invalide.');
  const node = world.nodes.find(n => n.id === id);
  if (!node) return false;
  node.x = x; node.y = y; return true;
}
export function velocityAt(world, x, y, turbulence = .45) {
  let vx = .013 + Math.sin(y * 8 + world.time * .13) * .008 * turbulence;
  let vy = Math.cos(x * 9 - world.time * .09) * .012 * turbulence;
  for (const node of world.nodes) {
    const dx = x - node.x, dy = y - node.y, d2 = dx * dx + dy * dy + .003;
    const f = .006 * node.strength / d2;
    if (node.type === 'vortex') { vx -= dy * f; vy += dx * f; }
    else if (node.type === 'source') { vx += dx * f * .55; vy += dy * f * .55; }
    else if (node.type === 'reef') {
      const k = Math.abs(node.strength);
      const falloff = Math.exp(-d2 * 100 / (k * k || 1));
      vx += dx * falloff * .8 * k; vy += dy * falloff * .8 * k;
    }
  }
  return { vx, vy };
}
export function stepWorld(world, dt, settings = DEFAULTS) {
  const delta = Math.min(.05, Math.max(0, Number.isFinite(dt) ? dt : 0)) * settings.speed;
  world.time += delta;
  for (const p of world.particles) {
    p.px = p.x; p.py = p.y;
    const { vx, vy } = velocityAt(world, p.x, p.y, settings.turbulence);
    p.speed = Math.hypot(vx, vy); p.x += vx * delta; p.y += vy * delta; p.age += delta;
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 || p.age > 24) { p.x = world.random(); p.y = world.random(); p.px = p.x; p.py = p.y; p.age = 0; }
  }
}
export function getMetrics(world) {
  return { count: world.particles.length, nodes: world.nodes.length, energy: world.particles.reduce((n,p) => n + p.speed, 0) / Math.max(1,world.particles.length), time: world.time };
}
export function validateSettings(s) {
  if (!s || !Number.isFinite(s.speed) || s.speed < .1 || s.speed > 3 || !Number.isFinite(s.turbulence) || s.turbulence < 0 || s.turbulence > 1 || !Number.isInteger(s.count) || s.count < 100 || s.count > 6000) throw new Error('Réglages invalides.');
  return { speed: s.speed, turbulence: s.turbulence, count: s.count };
}
export function serializeWorld(world, settings) {
  return JSON.stringify({ version: 1, seed: world.seed, nodes: world.nodes.map(({type,x,y,strength}) => ({type,x,y,strength})), settings: validateSettings(settings) }, null, 2);
}
export function deserializeWorld(json) {
  if (typeof json !== 'string' || json.length > 32000) throw new Error('Fichier trop volumineux (32 Ko maximum).');
  let data; try { data = JSON.parse(json); } catch { throw new Error('Ce fichier ne contient pas un JSON valide.'); }
  if (!data || data.version !== 1 || !Number.isInteger(data.seed) || data.seed < 0 || data.seed > 4294967295 || !Array.isArray(data.nodes) || data.nodes.length > 24) throw new Error('Format PELAGIC non reconnu.');
  const settings = validateSettings(data.settings), world = createWorld(data.seed);
  world.nodes = []; world.nextId = 1;
  for (const n of data.nodes) { if (!n || typeof n !== 'object') throw new Error('Élément invalide.'); addNode(world,n.type,n.x,n.y,n.strength); }
  world.random = rng(data.seed); resetParticles(world,settings.count);
  return { world, settings };
}
