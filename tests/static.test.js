import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
const root=resolve('public');
async function walk(dir){const files=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isDirectory())files.push(...await walk(p));else files.push(p)}return files}
test('all public HTML and module resources resolve under a project subpath',async()=>{
 for(const file of await walk(root)){
  if(!/\.(html|js)$/.test(file))continue;const text=await readFile(file,'utf8');
  const patterns=file.endsWith('.html')?[/\b(?:href|src)="([^"]+)"/g]:[/\bfrom ['"]([^'"]+)['"]/g,/import\(['"]([^'"]+)['"]\)/g];
  for(const regex of patterns)for(const match of text.matchAll(regex)){
   const value=match[1];if(/^(?:https?:|data:|blob:|#)/.test(value))continue;
   assert.ok(!value.startsWith('/'),`${relative(root,file)} has an origin-root link: ${value}`);
   const target=resolve(dirname(file),value.split(/[?#]/)[0]);assert.ok(target===root||target.startsWith(root+'/')||target.startsWith(root+'\\'));
   const entry=value.split(/[?#]/)[0].endsWith('/')?resolve(target,'index.html'):target;
   await readFile(entry);
  }
 }
});

test('static build versions module references and enforces a self-only CSP',async()=>{
 const {execFileSync}=await import('node:child_process');const output=resolve('.runtime/static-test');
 execFileSync(process.execPath,['scripts/build-static.mjs',output],{timeout:10000});
 const html=await readFile(resolve(output,'index.html'),'utf8');
 assert.match(html,/exposition\.js\?v=[a-f0-9]{12}/);
 assert.match(html,/Content-Security-Policy/);
 assert.doesNotMatch(html,/unsafe-inline|unsafe-eval/);
 const module=await readFile(resolve(output,'exposition.js'),'utf8');
 assert.match(module,/shared\/i18n\.js\?v=[a-f0-9]{12}/);
});
