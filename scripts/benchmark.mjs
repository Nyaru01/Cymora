// Résonance V3 — combined CPU path, no renderer or hardware-independent promise.
import {createWorld,resetParticles,stepWorld,addWake,DEFAULTS} from '../public/src/engine.js';
import {buildField,MODES,applyCymatics,psi} from '../public/src/cymatics.js';
const built=performance.now(),a=buildField(MODES[10]),b=buildField(MODES[18]);
const fieldBuildMs=performance.now()-built,cases=[];
for(const count of [5000,12000,20000]) {
  const w=createWorld(42);w.nodes=[];resetParticles(w,count);
  const settings={...DEFAULTS,speed:.8,turbulence:.26,glow:.62};
  const advance=i=>{if(i%12===0)addWake(w,.5,.5,.2,.15,.06);stepWorld(w,1/60,settings);applyCymatics(w.p,a,b,.35,.65,1/60);};
  for(let i=0;i<30;i++)advance(i);
  const times=[];
  for(let i=0;i<120;i++){const t=performance.now();advance(i);times.push(performance.now()-t);}
  times.sort((a,b)=>a-b);
  let nodal=0;for(let i=0;i<w.p.n;i++)nodal+=Math.abs(psi(a.m,a.n,w.p.x[i],w.p.y[i]));
  cases.push({particles:count,fieldResolution:a.res,mixed:true,medianMs:+times[60].toFixed(3),p95Ms:+times[114].toFixed(3),meanMs:+(times.reduce((x,y)=>x+y,0)/times.length).toFixed(3),meanSourceAmplitude:+(nodal/count).toFixed(4)});
}
console.log(JSON.stringify({node:process.version,platform:process.platform,fieldBuildMs:+fieldBuildMs.toFixed(2),cases},null,2));
