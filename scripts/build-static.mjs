import {cp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const target=resolve(process.argv[2]||'.runtime/static-site');
if(!target.startsWith(resolve('.runtime')+'/')&&!target.startsWith(resolve('.runtime')+'\\'))throw Error('Static output must remain within .runtime');
await mkdir(target,{recursive:true});await cp('public',target,{recursive:true});await writeFile(resolve(target,'.nojekyll'),'');
async function files(dir){const list=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,e.name);if(e.isDirectory())list.push(...await files(path));else if(e.name!=='.nojekyll')list.push(path)}return list.sort()}
const entries=await files(target),hash=createHash('sha256');
for(const path of entries){hash.update(relative(target,path));hash.update(await readFile(path))}
const version=hash.digest('hex').slice(0,12);
const versioned=path=>path.includes('?')?path:path+'?v='+version;
for(const path of entries){
 if(!/\.(html|js)$/.test(path))continue;let text=await readFile(path,'utf8');
 if(path.endsWith('.html')){
  text=text.replace(/\b(href|src)="([^"?#]+\.(?:js|css))"/g,(_,attr,url)=>`${attr}="${versioned(url)}"`);
  text=text.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"><meta name="referrer" content="strict-origin-when-cross-origin">`);
 }else{
  text=text.replace(/(\bfrom\s+['"])(\.{1,2}\/[^'"?]+\.js)(['"])/g,(_,a,url,b)=>a+versioned(url)+b);
  text=text.replace(/(\bimport\(\s*['"])(\.{1,2}\/[^'"?]+\.js)(['"]\s*\))/g,(_,a,url,b)=>a+versioned(url)+b);
 }
 await writeFile(path,text);
}
console.log(JSON.stringify({staticBuild:version,publicFiles:entries.length,noGitRuntime:true}));
