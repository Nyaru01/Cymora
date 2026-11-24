// PELAGIC NOCTURNE — pure four-movement score, migration and transport. CODEX.
import { createWorld, DEFAULTS, validateNodes, validateSettings, deserializeWorld, SCALES } from './engine.js';
export const MOVEMENT_NAMES = Object.freeze(['Éveil','Floraison','Dérive','Rémanence']);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const clone=x=>JSON.parse(JSON.stringify(x));
function text(value,fallback,max=72) {
  const s=value??fallback;
  if(typeof s!=='string'||!s.trim()||s.length>max) throw new Error('Nom de partition ou de mouvement invalide.');
  return s.trim();
}
function identity(key) {
  let h=2166136261;
  for(let i=0;i<key.length;i++) h=Math.imul(h^key.charCodeAt(i),16777619);
  return (h>>>0)%900000+1;
}
function movement(raw,index) {
  if(!raw || typeof raw!=='object' || !Number.isInteger(raw.seed) || raw.seed<0 || raw.seed>4294967295) throw new Error('Mouvement invalide.');
  const nodes=validateNodes(raw.nodes).map(n=> {
    const prefix=`${n.type}_`;
    const key=n.key.startsWith(prefix)?n.key:prefix+n.key;
    if(key.length>48) throw new Error('Identité de piste trop longue.');
    return {...n,key,id:identity(key)};
  });
  return {name:text(raw.name,MOVEMENT_NAMES[index],40),seed:raw.seed,nodes,settings:validateSettings(raw.settings)};
}
export function validateScore(raw) {
  if(!raw || typeof raw!=='object' || !Number.isInteger(raw.bars)||raw.bars<4||raw.bars>64||!Number.isInteger(raw.tempo)||raw.tempo<50||raw.tempo>140||!SCALES.includes(raw.scale)||!Array.isArray(raw.movements)||raw.movements.length!==4) throw new Error('Partition invalide : quatre mouvements, 4–64 mesures et 50–140 BPM.');
  const movements=raw.movements.map(movement),keys=new Map(),ids=new Map();
  for(const m of movements) for(const n of m.nodes) {
    if(keys.has(n.key)&&keys.get(n.key)!==n.type) throw new Error('Une piste doit conserver son type.');
    if(ids.has(n.id)&&ids.get(n.id)!==n.key) throw new Error('Collision des identités de pistes.');
    keys.set(n.key,n.type);ids.set(n.id,n.key);
  }
  if(keys.size>24) throw new Error('Maximum : 24 pistes distinctes dans une partition.');
  return {version:2,kind:'score',title:text(raw.title,'Mon Nocturne'),bars:raw.bars,tempo:raw.tempo,scale:raw.scale,movements};
}
export function createScore(options={}) {
  const world=options.world??createWorld(),settings=validateSettings(options.settings??DEFAULTS);
  const movements=options.movements??MOVEMENT_NAMES.map(name=>({name,seed:world.seed,nodes:clone(world.nodes),settings:{...settings}}));
  return validateScore({version:2,kind:'score',title:options.title??'Mon Nocturne',bars:options.bars??16,tempo:options.tempo??settings.tempo,scale:options.scale??settings.scale,movements});
}
export function captureMovement(score,index,world,settings=score.movements[index]?.settings??DEFAULTS) {
  if(!Number.isInteger(index)||index<0||index>3) throw new Error('Choisissez un des quatre mouvements.');
  const next={...score,movements:score.movements.map((m,i)=>i===index?{name:m.name,seed:world.seed,nodes:clone(world.nodes),settings:{...settings}}:m)};
  const validated=validateScore(next);
  Object.assign(score,validated); return score;
}
export function sampleScore(score,beat=0) {
  if(!Number.isFinite(beat)) throw new Error('Position de lecture invalide.');
  const total=score.bars*4,wrapped=((beat%total)+total)%total,phase=wrapped/total;
  const position=phase*4,index=Math.min(3,Math.floor(position)),fraction=position-index,blend=(1-Math.cos(Math.PI*fraction))*.5;
  const a=score.movements[index],next=(index+1)%4,b=score.movements[next];
  const left=new Map(a.nodes.map(n=>[n.key,n])),right=new Map(b.nodes.map(n=>[n.key,n]));
  const keys=new Set([...left.keys(),...right.keys()]);
  const lerp=(x,y)=>x+(y-x)*blend;
  const nodes=[];
  for(const key of keys) {
    const aa=left.get(key),bb=right.get(key),from=aa??bb,to=bb??aa;
    const opacity=lerp(aa?1:0,bb?1:0);
    if(opacity<.00001) continue;
    nodes.push({...from,key,id:identity(key),x:lerp(from.x,to.x),y:lerp(from.y,to.y),strength:lerp(aa?aa.strength:0,bb?bb.strength:0),opacity,voice:blend<.5?from.voice:to.voice});
  }
  const settings={...a.settings,speed:lerp(a.settings.speed,b.settings.speed),turbulence:lerp(a.settings.turbulence,b.settings.turbulence),glow:lerp(a.settings.glow,b.settings.glow),tempo:score.tempo,scale:score.scale};
  return {nodes,settings,seed:a.seed,movement:index,nextMovement:next,blend,phase,beat:wrapped};
}
export function applySample(world,sample) {
  const old=new Map(world.nodes.map(n=>[n.key,n]));
  world.nodes=sample.nodes.map(n=>Object.assign(old.get(n.key)??{},n));
  world.nextId=Math.max(0,...world.nodes.map(n=>n.id))+1;
  return world;
}
export function advanceTransport(transport,dt,score) {
  if(!Number.isFinite(dt)||dt<0) throw new Error('Durée de transport invalide.');
  const result={beat:Number.isFinite(transport.beat)?Math.max(0,transport.beat):0,playing:Boolean(transport.playing),loop:transport.loop!==false,ended:Boolean(transport.ended)};
  if(!result.playing) return result;
  const total=score.bars*4;
  result.beat+=Math.min(.25,dt)*score.tempo/60;
  if(result.beat>=total) {
    if(result.loop) { result.beat%=total; result.ended=false; }
    else { result.beat=total; result.playing=false; result.ended=true; }
  }
  return result;
}
export function serializeScore(score) { return JSON.stringify(validateScore(score),null,2); }
export function deserializeScore(json) {
  if(typeof json!=='string'||json.length>128000) throw new Error('Partition trop volumineuse (128 Ko maximum).');
  let raw;try {raw=JSON.parse(json);}catch {throw new Error('Ce fichier ne contient pas un JSON valide.');}
  if(raw?.version===2&&raw.kind==='score') return validateScore(raw);
  const {world,settings}=deserializeWorld(json);
  return createScore({world,settings,title:'Composition importée'});
}
