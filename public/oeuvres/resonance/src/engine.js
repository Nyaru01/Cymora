// Normalized, deterministic artistic flow field. No external dependencies.
export const DEFAULTS = Object.freeze({ speed: 1, turbulence: 0.45, count: 8000, glow: .55, tempo:84,scale:'pentatonic',quantize:true });
export const MAX_PARTICLES = 20000;
export const VOICES = Object.freeze(['glass','bell','pluck','breath']);
export const SCALES = Object.freeze(['pentatonic','dorian','insen','lydian']);
const VOICE_ALIASES={verre:'glass',abysse:'bell',pizz:'pluck',souffle:'breath'};
const SCALE_ALIASES={pentatonique:'pentatonic',dorien:'dorian',lydien:'lydian'};
const FIELDS = ['x','y','px','py','age','speed','light','refract'];
const GRID = 33, CELLS = GRID * GRID;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
function pack(count) {
  return Object.fromEntries([['n',count],['cap',count],...FIELDS.map(k=>[k,new Float32Array(count)])]);
}
// Lazy V1 adapter. V2 rendering reads world.p directly without objects/copies.
function attachLegacyView(world) {
  Object.defineProperty(world,'particles',{enumerable:false,
    get() {
      if (this._viewOf !== this.p) {
        const p=this.p;
        this._view=Array.from({length:p.n},(_,i)=>Object.defineProperties({},Object.fromEntries(FIELDS.map(k=>[k,{enumerable:true,get:()=>p[k][i],set:v=>{p[k][i]=v;}}]))));
        this._viewOf=p;
      }
      return this._view;
    },
    set(particles) {
      const next=pack(particles.length);
      for(let i=0;i<next.n;i++) for(const k of FIELDS) next[k][i]=particles[i][k] || 0;
      this.p=next;
    }
  });
}
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function createWorld(seed = 42) {
  const world = { seed, time: 0, nodes: [], nextId: 1, random: rng(seed), wakes:[], flashes:0 };
  attachLegacyView(world);
  addNode(world, 'vortex', .37, .48); addNode(world, 'vortex', .67, .56, -1);
  addNode(world, 'source', .5, .72); resetParticles(world, DEFAULTS.count);
  return world;
}
export function addNode(world, type, x, y, strength = 1, options = {}) {
  if (!['vortex','source','reef','beacon'].includes(type) || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1 || !Number.isFinite(strength) || Math.abs(strength) > 2) throw new Error('Élément invalide.');
  if (world.nodes.length >= 24) throw new Error('Maximum : 24 éléments.');
  const id=world.nextId++;
  const voice=VOICE_ALIASES[options.voice]??options.voice;
  const node = { id, key:`n${id}`, type, x, y, strength, voice:VOICES.includes(voice)?voice:'glass', opacity:1 }; world.nodes.push(node); return node;
}
export function resetParticles(world, count) {
  if (!Number.isInteger(count) || count < 100 || count > MAX_PARTICLES) throw new Error(`La population doit être comprise entre 100 et ${MAX_PARTICLES}.`);
  const p=pack(count);
  for(let i=0;i<count;i++) { p.x[i]=p.px[i]=world.random(); p.y[i]=p.py[i]=world.random(); p.age[i]=world.random()*12; p.light[i]=.025; }
  world.p=p;
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
export function addWake(world,x,y,vx,vy,radius=.08) {
  if (![x,y,vx,vy,radius].every(Number.isFinite) || x<0 || x>1 || y<0 || y>1 || radius<.02 || radius>.2) throw new Error('Geste de lumière invalide.');
  const wake={x,y,vx:clamp(vx,-2,2),vy:clamp(vy,-2,2),radius,age:0};
  world.wakes ??= [];
  if(world.wakes.length>=48) world.wakes.shift();
  world.wakes.push(wake); return wake;
}
function prepareField(world,turbulence) {
  const grid=world._grid ??= {vx:new Float32Array(CELLS),vy:new Float32Array(CELLS),excite:new Float32Array(CELLS),strain:new Float32Array(CELLS)};
  const wakes=world.wakes;
  for(let iy=0;iy<GRID;iy++) for(let ix=0;ix<GRID;ix++) {
    const x=ix/(GRID-1),y=iy/(GRID-1),i=iy*GRID+ix;
    let {vx,vy}=velocityAt(world,x,y,turbulence),excite=0;
    for(const wake of wakes) {
      const dx=x-wake.x,dy=y-wake.y,d2=dx*dx+dy*dy;
      if(d2>wake.radius*wake.radius*6) continue;
      const influence=Math.exp(-d2/(wake.radius*wake.radius))*Math.exp(-wake.age*3);
      vx+=wake.vx*influence*.3; vy+=wake.vy*influence*.3;
      excite+=influence*3;
    }
    grid.vx[i]=vx; grid.vy[i]=vy; grid.excite[i]=excite;
  }
  const f=(GRID-1)*.5;
  for(let iy=0;iy<GRID;iy++) for(let ix=0;ix<GRID;ix++) {
    const i=iy*GRID+ix,l=iy*GRID+Math.max(0,ix-1),r=iy*GRID+Math.min(GRID-1,ix+1),u=Math.max(0,iy-1)*GRID+ix,d=Math.min(GRID-1,iy+1)*GRID+ix;
    const a=(grid.vx[r]-grid.vx[l])*f,b=(grid.vy[d]-grid.vy[u])*f,c=((grid.vx[d]-grid.vx[u])+(grid.vy[r]-grid.vy[l]))*f;
    grid.strain[i]=Math.sqrt(a*a+b*b+c*c*.5);
  }
  return grid;
}
export function stepWorld(world, dt, settings = DEFAULTS) {
  const speed=Number.isFinite(settings.speed)?clamp(settings.speed,.1,3):1;
  const delta=Math.min(.05,Math.max(0,Number.isFinite(dt)?dt:0))*speed;
  world.flashes=0;
  if(!delta) return;
  world.time+=delta;
  world.wakes ??= [];
  for(let i=world.wakes.length-1;i>=0;i--) { world.wakes[i].age+=delta; if(world.wakes[i].age>1.5) world.wakes.splice(i,1); }
  const g=prepareField(world,settings.turbulence ?? .45),p=world.p;
  const decay=Math.exp(-delta/.65),glow=settings.glow ?? .55,threshold=.55+(1-glow)*1.8;
  for(let i=0;i<p.n;i++) {
    const x=p.x[i],y=p.y[i]; p.px[i]=x; p.py[i]=y;
    const gx=clamp(x,0,.999999)*(GRID-1),gy=clamp(y,0,.999999)*(GRID-1),ix=gx|0,iy=gy|0,fx=gx-ix,fy=gy-iy;
    const a=iy*GRID+ix,b=a+1,c=a+GRID,d=c+1;
    const wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy;
    const vx=g.vx[a]*wa+g.vx[b]*wb+g.vx[c]*wc+g.vx[d]*wd,vy=g.vy[a]*wa+g.vy[b]*wb+g.vy[c]*wc+g.vy[d]*wd;
    const excite=g.excite[a]*wa+g.excite[b]*wb+g.excite[c]*wc+g.excite[d]*wd;
    const strain=g.strain[a]*wa+g.strain[b]*wb+g.strain[c]*wc+g.strain[d]*wd;
    p.speed[i]=Math.sqrt(vx*vx+vy*vy); p.x[i]=x+vx*delta; p.y[i]=y+vy*delta; p.age[i]+=delta;
    p.light[i]*=decay; p.refract[i]=Math.max(0,p.refract[i]-delta);
    if(!p.refract[i] && (excite>.32 || strain>threshold)) { p.light[i]=Math.min(1,.65+excite*.3+strain*.08); p.refract[i]=1.2+(i%17)*.025; world.flashes++; }
    if(p.x[i]<0 || p.x[i]>1 || p.y[i]<0 || p.y[i]>1 || p.age[i]>24) {
      p.x[i]=p.px[i]=world.random(); p.y[i]=p.py[i]=world.random(); p.age[i]=0; p.light[i]=.025; p.refract[i]=0;
    }
  }
}
export function getMetrics(world) {
  const p=world.p; let energy=0,lit=0,brightness=0;
  for(let i=0;i<p.n;i++) { energy+=p.speed[i]; brightness+=p.light[i]; if(p.light[i]>.5) lit++; }
  return {count:p.n,nodes:world.nodes.length,energy:energy/Math.max(1,p.n),time:world.time,lit:lit/Math.max(1,p.n),brightness:brightness/Math.max(1,p.n),flashes:world.flashes};
}
export function sampleLight(world,x,y,radius=.08) {
  if(![x,y,radius].every(Number.isFinite) || radius<=0) throw new Error('Zone de lumière invalide.');
  const p=world.p,r2=radius*radius; let sum=0,count=0;
  for(let i=0;i<p.n;i++) if((p.x[i]-x)**2+(p.y[i]-y)**2<=r2) {sum+=p.light[i];count++;}
  return count?sum/count:0;
}
export function validateSettings(s) {
  if (!s || !Number.isFinite(s.speed) || s.speed < .1 || s.speed > 3 || !Number.isFinite(s.turbulence) || s.turbulence < 0 || s.turbulence > 1 || !Number.isInteger(s.count) || s.count < 100 || s.count > MAX_PARTICLES || (s.glow!==undefined && (!Number.isFinite(s.glow) || s.glow<0 || s.glow>1))) throw new Error('Réglages invalides.');
  const scale=SCALE_ALIASES[s.scale]??s.scale;
  if((s.tempo!==undefined && (!Number.isInteger(s.tempo)||s.tempo<50||s.tempo>140)) || (scale!==undefined && !SCALES.includes(scale)) || (s.quantize!==undefined && typeof s.quantize!=='boolean')) throw new Error('Réglages musicaux invalides.');
  return { speed: s.speed, turbulence: s.turbulence, count: s.count, glow:s.glow ?? .55,tempo:s.tempo??84,scale:scale??'pentatonic',quantize:s.quantize??true };
}
export function validateNodes(nodes) {
  if(!Array.isArray(nodes) || nodes.length>24) throw new Error('Maximum : 24 éléments par mouvement.');
  const w={nodes:[],nextId:1},ids=new Set(),keys=new Set();
  for(const raw of nodes) {
    if(!raw || typeof raw!=='object' || (raw.voice!==undefined && !VOICES.includes(VOICE_ALIASES[raw.voice]??raw.voice))) throw new Error('Élément invalide.');
    const n=addNode(w,raw.type,raw.x,raw.y,raw.strength,{voice:raw.voice});
    if(raw.id!==undefined) { if(!Number.isSafeInteger(raw.id)||raw.id<1||raw.id>1000000) throw new Error('Identité invalide.'); n.id=raw.id; }
    n.key=raw.key ?? `n${n.id}`;
    if(typeof n.key!=='string' || !/^[a-zA-Z0-9_-]{1,48}$/.test(n.key) || ids.has(n.id)||keys.has(n.key)) throw new Error('Identité dupliquée ou invalide.');
    ids.add(n.id);keys.add(n.key);
  }
  return w.nodes;
}
export function serializeWorld(world, settings) {
  return JSON.stringify({ version:2,kind:'composition',seed:world.seed,nodes:validateNodes(world.nodes),settings:validateSettings(settings) },null,2);
}
export function deserializeWorld(json) {
  if (typeof json !== 'string' || json.length > 32000) throw new Error('Fichier trop volumineux (32 Ko maximum).');
  let data; try { data = JSON.parse(json); } catch { throw new Error('Ce fichier ne contient pas un JSON valide.'); }
  if (!data || ![1,2].includes(data.version) || (data.kind && data.kind!=='composition') || !Number.isInteger(data.seed) || data.seed < 0 || data.seed > 4294967295 || !Array.isArray(data.nodes) || data.nodes.length > 24) throw new Error('Format PELAGIC non reconnu.');
  const settings = validateSettings(data.settings), world = createWorld(data.seed);
  world.nodes = validateNodes(data.nodes); world.nextId = Math.max(0,...world.nodes.map(n=>n.id))+1;
  world.random = rng(data.seed); resetParticles(world,settings.count);
  return { world, settings };
}
