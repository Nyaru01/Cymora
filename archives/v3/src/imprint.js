// Anonymous, bounded creative memory. No audio samples or external identifiers. CODEX.
import {normalizePhrase,PHRASE_LIMITS,createDialogue} from './phrase.js';
export const IMPRINT_LIMIT=192000;
function validate(data) {
  if(!data || !Number.isInteger(data.seed)||data.seed<0||data.seed>4294967295||!Array.isArray(data.phrases)||data.phrases.length>PHRASE_LIMITS.memory)throw new Error('Empreinte invalide : maximum 12 gestes.');
  const ids=new Set();
  const phrases=data.phrases.map((raw,i)=>{
    const phrase=normalizePhrase({...raw,id:raw?.id??`p${i+1}`});
    if(ids.has(phrase.id))throw new Error('Identité de geste dupliquée.');ids.add(phrase.id);
    return phrase;
  });
  return {version:3,kind:'imprint',seed:data.seed,phrases};
}
export function serializeImprint({seed=42,phrases=[]}={}) {
  const validated=validate({seed,phrases});
  const text=JSON.stringify({...validated,phrases:validated.phrases.map(({id,samples})=>({id,samples}))});
  if(text.length>IMPRINT_LIMIT)throw new Error('Empreinte trop volumineuse (192 Ko maximum).');
  return text;
}
export function deserializeImprint(text) {
  if(typeof text!=='string'||text.length>IMPRINT_LIMIT)throw new Error('Empreinte trop volumineuse (192 Ko maximum).');
  let data;try{data=JSON.parse(text);}catch{throw new Error('Ce fichier ne contient pas une empreinte JSON valide.');}
  if(data?.version!==3||data.kind!=='imprint')throw new Error('Format Résonance non reconnu.');
  return validate(data);
}
export function restoreDialogue(imprint,options={}) {
  const data=typeof imprint==='string'?deserializeImprint(imprint):validate(imprint);
  return createDialogue({...options,seed:data.seed,memory:data.phrases});
}
