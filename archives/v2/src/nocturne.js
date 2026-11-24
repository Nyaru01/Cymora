// An authored four-movement piece. CODEX. No random generated content or remote assets.
import {createScore} from './score.js';
import {DEFAULTS} from './engine.js';
const TYPES=['vortex','vortex','source','reef','beacon','beacon','beacon','beacon'];
const VOICES=['glass','glass','glass','glass','glass','bell','pluck','breath'];
const TABLEAUX=[
  {name:'Éveil',speed:.65,turbulence:.12,glow:.35,
    points:[[.3,.6,.5],[.7,.6,-.5],[.5,.82,.4],[.5,.38,.6],[.3,.52,.55],[.7,.48,.6],[.5,.32,.5],[.5,.76,.65]]},
  {name:'Floraison',speed:1.25,turbulence:.8,glow:.9,
    points:[[.33,.4,1.7],[.67,.6,-1.5],[.5,.6,1.2],[.5,.4,1.8],[.43,.33,1],[.57,.67,1.3],[.67,.52,.8],[.4,.58,1.1]]},
  {name:'Dérive',speed:.8,turbulence:.35,glow:.65,
    points:[[.72,.45,1.25],[.3,.55,-1.2],[.18,.5,.8],[.65,.4,.9],[.61,.35,1.2],[.45,.62,.8],[.78,.52,1],[.32,.47,.8]]},
  {name:'Rémanence',speed:.4,turbulence:.06,glow:.3,
    points:[[.46,.48,.35],[.54,.52,-.35],[.5,.6,-.6],[.5,.2,.3],[.4,.5,.45],[.6,.5,.5],[.5,.4,.35],[.5,.7,.65]]},
];
export function createNocturne() {
  const movements=TABLEAUX.map(t=>({name:t.name,seed:20261124,
    settings:{...DEFAULTS,count:10000,speed:t.speed,turbulence:t.turbulence,glow:t.glow,tempo:84,scale:'dorian'},
    nodes:t.points.map(([x,y,strength],i)=>({id:i+1,key:`n${i+1}`,type:TYPES[i],x,y,strength,voice:VOICES[i]}))}));
  return createScore({title:'Ce que l’eau garde',bars:16,tempo:84,scale:'dorian',movements});
}
