import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,resetParticles,stepWorld,getMetrics,DEFAULTS,velocityAt} from '../src/engine.js';
test('20000 particle simulation keeps bounded typed buffers and reports measured step budget',t=>{
  const w=createWorld(17);resetParticles(w,20000);
  for(let i=0;i<20;i++)stepWorld(w,1/60);
  const start=performance.now();for(let i=0;i<60;i++)stepWorld(w,1/60);
  const mean=(performance.now()-start)/60;
  t.diagnostic(`20000 particles / 3 nodes: ${mean.toFixed(2)} ms per step; 4 ms is a measured target, not a hardware-independent assertion.`);
  assert.equal(getMetrics(w).count,20000);assert.ok(w.p.x.every(x=>x>=0&&x<=1));assert.ok(Number.isFinite(mean));
});
test('interpolated field stays close to the reference field for a default composition',()=>{
  const w=createWorld();resetParticles(w,200);const before=Array.from(w.p.x,(x,i)=>({x,y:w.p.y[i]}));
  // Field preparation uses the new simulation time.
  const dt=1/60;stepWorld(w,dt,{...DEFAULTS,speed:1});let error=0;
  for(let i=0;i<before.length;i++) {
    const p=before[i],v=velocityAt(w,p.x,p.y,DEFAULTS.turbulence);
    if(w.p.age[i]<dt)continue;
    error+=Math.hypot((w.p.x[i]-p.x)/dt-v.vx,(w.p.y[i]-p.y)/dt-v.vy);
  }
  assert.ok(error/before.length<.008,`mean velocity error ${error/before.length}`);
});
