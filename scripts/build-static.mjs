import {cp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const target=resolve(process.argv[2]||'.runtime/static-site');
if(!target.startsWith(resolve('.runtime')+'/')&&!target.startsWith(resolve('.runtime')+'\\'))throw Error('Static output must remain within .runtime');
await mkdir(target,{recursive:true});await cp('public',target,{recursive:true});await writeFile(resolve(target,'.nojekyll'),'');
console.log('Static exhibition built without Git or dependencies.');

async function headers(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,e.name);if(e.isDirectory())await headers(path);else if(e.name.endsWith('.html')){const html=await readFile(path,'utf8');await writeFile(path,html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"><meta name="referrer" content="strict-origin-when-cross-origin">`));}}}
await headers(target);
