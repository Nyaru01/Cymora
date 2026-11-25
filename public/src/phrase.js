// PELAGIC — Résonance. Musical dramaturgy and bounded turn-taking. CODEX.
export const PHRASE_LIMITS = Object.freeze({samples:128,seconds:8,memory:12});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const round=(x,n=4)=>Math.round(x*10**n)/10**n;
const degrees={insen:[0,1,5,7,10],pentatonic:[0,3,5,7,10],dorian:[0,2,3,5,7,9,10],lydian:[0,2,4,6,7,9,11]};
export const frequencyToMidi=freq=>69+12*Math.log2(freq/440);
export const midiToFrequency=midi=>440*2**((midi-69)/12);
export function quantizeFrequency(freq,scale='insen') {
  if(!Number.isFinite(freq)||freq<=0) throw new Error('Hauteur musicale invalide.');
  const allowed=Object.hasOwn(degrees,scale)?degrees[scale]:degrees.insen;
  const target=frequencyToMidi(freq);let best=50,distance=Infinity;
  for(let midi=36;midi<=84;midi++) if(allowed.includes(((midi-50)%12+12)%12)) {
    const d=Math.abs(midi-target);if(d<distance){best=midi;distance=d;}
  }
  return midiToFrequency(best);
}
function validSample(s) {
  return s && [s.t,s.x,s.y,s.freq,s.energy].every(Number.isFinite) && s.t>=0 && s.x>=0 && s.x<=1 && s.y>=0 && s.y<=1 && s.freq>=40 && s.freq<=2000 && s.energy>=0 && s.energy<=1;
}
export function analyzeGesture(samples) {
  let travel=0,turn=0,energy=0;
  for(let i=0;i<samples.length;i++) {
    energy+=samples[i].energy;
    if(i)travel+=Math.hypot(samples[i].x-samples[i-1].x,samples[i].y-samples[i-1].y);
    if(i>1) {
      const a=samples[i-2],b=samples[i-1],c=samples[i];
      const u=Math.atan2(b.y-a.y,b.x-a.x),v=Math.atan2(c.y-b.y,c.x-b.x);
      let delta=v-u;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
      if(Math.hypot(c.x-b.x,c.y-b.y)>.001 && Math.hypot(b.x-a.x,b.y-a.y)>.001)turn+=Math.abs(delta);
    }
  }
  const first=samples[0],last=samples.at(-1),duration=last.t-first.t;
  return {curvature:round(clamp(turn/(3*Math.PI),0,1)),travel:round(travel),meanEnergy:round(energy/samples.length),direction:round(Math.atan2(last.y-first.y,last.x-first.x)),speed:round(travel/Math.max(.12,duration))};
}
export function normalizePhrase(raw) {
  if(!raw || !Array.isArray(raw.samples) || !raw.samples.length || raw.samples.length>PHRASE_LIMITS.samples) throw new Error('Geste invalide : 1 à 128 points.');
  const id=raw.id??'p';
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,48}$/.test(id)) throw new Error('Identité de geste invalide.');
  let last=-1;
  for(const s of raw.samples) {
    if(!validSample(s)||s.t<0||s.t>8.001||s.t<last) throw new Error('Point ou durée de geste invalide.');
    last=s.t;
  }
  if(!raw.samples.some(s=>s.energy>.015)) throw new Error('Cette empreinte ne contient aucun geste actif.');
  const start=raw.samples[0].t;
  const samples=raw.samples.map(s=>({t:round(s.t-start,3),x:round(s.x),y:round(s.y),freq:round(s.freq,2),energy:round(s.energy,3)}));
  const duration=Math.max(.12,samples.at(-1).t);
  return {id,duration,samples,features:analyzeGesture(samples)};
}
function musicalAnchors(phrase) {
  const anchors=[phrase.samples[0]];
  for(let i=1;i<phrase.samples.length;i++) {
    const s=phrase.samples[i],last=anchors.at(-1);
    if(s.t-last.t>=.26 || (s.t-last.t>=.12 && Math.abs(frequencyToMidi(s.freq/last.freq*440)-69)>=2))anchors.push(s);
  }
  if(anchors.length>16)return Array.from({length:16},(_,i)=>anchors[Math.round(i*(anchors.length-1)/15)]);
  return anchors;
}
export function composeAnswer(raw,{seed=42,scale='insen',memory=[]}={}) {
  const phrase=normalizePhrase(raw),f=phrase.features,anchors=musicalAnchors(phrase);
  const target=clamp(phrase.duration*1.18+1.35,2.2,7.8),span=target-1.05;
  const variation=((seed>>>0)+memory.length)%3;
  const transpose=[0,-12,7][variation];
  const voice=f.curvature>.55?'bell':f.speed>.65?'pluck':phrase.duration>3&&f.meanEnergy<.5?'breath':'glass';
  const notes=[],figures=[];
  for(let i=0;i<anchors.length;i++) {
    const s=anchors[i],at=round(.18+(s.t/Math.max(.12,phrase.duration))*span,3);
    const freq=quantizeFrequency(s.freq*2**(transpose/12),scale);
    const dur=round(Math.min(7.85-at,clamp(.4+(1-f.meanEnergy)*.5+(i===anchors.length-1?.2:0),.3,1.15)),3);
    notes.push({at,freq:round(freq,3),voice,velocity:round(clamp(.18+s.energy*.34,.12,.58),3),pan:round((s.x-.5)*1.45,3),dur});
    // Visual rhyme is deliberately exact in source pitch; this is art, not a spectrogram.
    figures.push({at,freq:s.freq,energy:round(clamp(.28+s.energy*.55,.2,.8),3),dur});
  }
  const trace=phrase.samples.map(s=>({at:round(.18+(s.t/Math.max(.12,phrase.duration))*span,3),x:round(clamp(s.x+(variation-1)*.045,0,1)),y:s.y}));
  const duration=Math.min(8,Math.max(target,...notes.map(n=>n.at+n.dur+.15)));
  return {sourceId:phrase.id,duration:round(duration,3),notes,figures,trace,character:voice,variation};
}
export function createDialogue({silence=1.6,seed=42,memory=[]}={}) {
  if(!Number.isFinite(silence)||silence<.2||silence>4)throw new Error('Durée de silence invalide.');
  let history=memory.slice(-12).map(normalizePhrase),state='idle',samples=[],lastActive=-Infinity,pending=null,answer=null,endsAt=0;
  let counter=history.reduce((n,p)=>Math.max(n,Number(p.id.match(/^p(\d+)$/)?.[1])||0),0),forced=false;
  function closePhrase() {
    const start=samples[0].t;
    const phrase=normalizePhrase({id:`p${++counter}`,samples:samples.map(s=>({...s,t:Math.min(8,s.t-start)}))});
    const reply=composeAnswer(phrase,{seed,scale:'insen',memory:history});
    history.push(phrase);if(history.length>12)history.shift();
    samples=[];pending={phrase,answer:reply};state='waiting';forced=false;
    return {type:'phrase',phrase};
  }
  return {
    get state(){return state;},get memory(){return history;},get current(){return samples;},get answer(){return answer;},get seed(){return seed>>>0;},
    input(sample) {
      if(state==='answering'||pending||!validSample(sample)||sample.energy<=.015)return false;
      if(samples.length && sample.t<samples.at(-1).t)return false;
      if(samples.length && sample.t-samples[0].t>=8){forced=true;return false;}
      const point={t:sample.t,x:sample.x,y:sample.y,freq:sample.freq,energy:sample.energy};
      if(samples.length && point.t===samples.at(-1).t)samples[samples.length-1]=point;
      else samples.push(point);
      if(samples.length>128)samples=samples.filter((_,i)=>i===0||i===samples.length-1||i%2===0);
      lastActive=sample.t;state='listening';return true;
    },
    update(now) {
      if(!Number.isFinite(now))return null;
      if(state==='answering') {
        if(now>=endsAt){state='idle';answer=null;return {type:'idle'};}
        return null;
      }
      if(pending) {
        const event={type:'answer',...pending};answer=pending.answer;pending=null;state='answering';endsAt=now+answer.duration;return event;
      }
      if(!samples.length)return null;
      if(forced||now-lastActive>=silence)return closePhrase();
      if(now-lastActive>.18)state='waiting';
      return null;
    },
    reset(){history=[];samples=[];state='idle';pending=null;answer=null;lastActive=-Infinity;endsAt=0;counter=0;forced=false;}
  };
}
