import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, addNode, removeNode, moveNode, resetParticles, serializeWorld, deserializeWorld, DEFAULTS, velocityAt, addWake, getMetrics, sampleLight } from '../src/engine.js';
test('same seed gives identical trajectories', () => { const a=createWorld(42), b=createWorld(42); for(let i=0;i<100;i++) { stepWorld(a,.016); stepWorld(b,.016); } assert.deepEqual(a.particles,b.particles); });
test('long simulation stays bounded and finite', () => { const w=createWorld(); for(let i=0;i<1500;i++) stepWorld(w,.05,{...DEFAULTS,speed:3}); for(const p of w.particles) { assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)); assert.ok(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1); } });
test('pause delta does not move particles', () => { const w=createWorld(), p=w.particles.map(p=>[p.x,p.y]); stepWorld(w,0); assert.deepEqual(w.particles.map(p=>[p.x,p.y]),p); });
test('nodes change the flow and remain finite at their center', () => { const w=createWorld(); const a=velocityAt(w,.2,.2); addNode(w,'vortex',.2,.2); assert.ok(Number.isFinite(velocityAt(w,.2,.2).vx)); assert.notDeepEqual(velocityAt(w,.21,.21),a); });
test('export/import preserves composition and settings', () => { const w=createWorld(17); const result=deserializeWorld(serializeWorld(w,DEFAULTS)); assert.deepEqual(result.settings,DEFAULTS); assert.deepEqual(result.world.nodes,w.nodes); });
test('hostile and malformed imports are rejected', () => { for(const input of ['null','{','[]','x'.repeat(33000),JSON.stringify({version:1,seed:0,nodes:[null],settings:DEFAULTS}),JSON.stringify({version:1,seed:0,nodes:[{type:'vortex',x:2,y:0,strength:1}],settings:DEFAULTS}),JSON.stringify({version:1,seed:0,nodes:[],settings:{...DEFAULTS,count:1e9}})]) assert.throws(()=>deserializeWorld(input)); });
test('population and node limits are enforced', () => { const w=createWorld(); assert.throws(()=>resetParticles(w,100000)); assert.throws(()=>addNode(w,'bad',0,0)); while(w.nodes.length<24) addNode(w,'reef',.5,.5); assert.throws(()=>addNode(w,'reef',.5,.5)); });
test('beacons leave velocity unchanged and survive export', () => { const w=createWorld(), before=velocityAt(w,.3,.3); addNode(w,'beacon',.3,.3); assert.deepEqual(velocityAt(w,.3,.3),before); assert.equal(deserializeWorld(serializeWorld(w,DEFAULTS)).world.nodes.at(-1).type,'beacon'); });
test('move and remove validate identity and coordinates', () => { const w=createWorld(), n=w.nodes[0]; assert.equal(moveNode(w,n.id,.1,.2),true); assert.equal(n.x,.1); assert.throws(()=>moveNode(w,n.id,NaN,.5)); assert.equal(moveNode(w,999,.5,.5),false); assert.equal(removeNode(w,n.id),true); assert.equal(removeNode(w,n.id),false); });
test('reef size changes the physical deflection and zero strength has no force', () => {
  const w={time:0,nodes:[],nextId:1}, baseline=velocityAt(w,.6,.5);
  const reef=addNode(w,'reef',.5,.5,.5), small=velocityAt(w,.6,.5);
  reef.strength=2; const large=velocityAt(w,.6,.5);
  assert.ok(large.vx-baseline.vx > small.vx-baseline.vx);
  reef.strength=0; assert.deepEqual(velocityAt(w,.6,.5),baseline);
  assert.ok(Number.isFinite(velocityAt(w,.5,.5).vx));
});
test('packed particle buffers persist across steps and support 20000 particles',()=>{
  const w=createWorld();resetParticles(w,20000);const x=w.p.x;
  assert.ok(x instanceof Float32Array);stepWorld(w,1/60);assert.equal(w.p.x,x);assert.equal(w.p.n,20000);
});
test('a hand wake excites light, then refractory time prevents constant flashing',()=>{
  const w=createWorld();w.nodes=[];resetParticles(w,100);
  w.p.x.fill(.5);w.p.y.fill(.5);addWake(w,.5,.5,0,0,.1);stepWorld(w,1/60);
  assert.equal(getMetrics(w).lit,1);assert.equal(w.flashes,100);const first=w.p.light[0];
  stepWorld(w,1/60);assert.equal(w.flashes,0);assert.ok(w.p.light[0]<first);assert.ok(sampleLight(w,.5,.5,.1)>.5);
  for(let i=0;i<100;i++)stepWorld(w,1/60);assert.equal(w.wakes.length,0);
});
test('wake validation and capacity keep transient input bounded',()=>{
  const w=createWorld();assert.throws(()=>addWake(w,NaN,0,0,0));assert.throws(()=>addWake(w,.5,.5,0,0,99));
  for(let i=0;i<100;i++)addWake(w,.5,.5,999,-999);
  assert.equal(w.wakes.length,48);assert.equal(w.wakes[0].vx,2);
});
test('V1 composition migration supplies musical and glow defaults',()=>{
  const legacy=JSON.stringify({version:1,seed:4,nodes:[{type:'beacon',x:.5,y:.5,strength:1}],settings:{speed:1,turbulence:.2,count:200}});
  const {world,settings}=deserializeWorld(legacy);assert.equal(world.nodes[0].voice,'glass');assert.equal(settings.glow,.55);assert.equal(settings.scale,'pentatonic');assert.equal(world.p.n,200);
  assert.throws(()=>deserializeWorld(JSON.stringify({...JSON.parse(legacy),settings:{...settings,tempo:900}})));
});
