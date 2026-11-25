import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,cp,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
test('public server works without Git and serves only public resources',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'quatre-public-test-'));
 await cp(new URL('../public/',import.meta.url),join(directory,'public'),{recursive:true});
 await copyFile(new URL('../server.mjs',import.meta.url),join(directory,'server.mjs'));await copyFile(new URL('../chorus.mjs',import.meta.url),join(directory,'chorus.mjs'));
 await writeFile(join(directory,'private.txt'),'private');await writeFile(join(directory,'public','.env'),'PRIVATE=1');
 const port=19000+Math.floor(Math.random()*10000),token='test-only-stop-token';
 const child=spawn(process.execPath,['server.mjs'],{cwd:directory,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',PELAGIC_STOP_TOKEN:token,RAILWAY_PROJECT_ID:'',RAILWAY_ENVIRONMENT_ID:'',DATABASE_URL:''},stdio:['ignore','pipe','pipe']});
 const origin=`http://127.0.0.1:${port}`;
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited')} ),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),5000);timer.unref()})]);
  assert.deepEqual(await (await fetch(origin+'/health')).json(),{status:'ok',app:'cymora'});
  for(const path of ['/','/src/app.js','/src/game.js','/shared/i18n.js','/favicon.svg','/manifest.json','/sw.js','/icons/cymora-hero.jpg','/icons/icon-512.png']){
   const r=await fetch(origin+path);assert.equal(r.status,200,path);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(r.headers.get('content-security-policy'),/default-src 'self'/);assert.doesNotMatch(r.headers.get('content-security-policy'),/unsafe-inline|unsafe-eval/);
  }
  for(const path of ['/.git/config','/.agents/CODEX.md','/.runtime/server.json','/PROJECT.md','/server.mjs','/chorus.mjs','/package.json','/package-lock.json','/.env','/private.txt','/scripts/archives.mjs','/archives/v2/'])assert.equal((await fetch(origin+path)).status,404,path);
  // Chœur du jour : lecture, voix juste, voix fausse, refus.
  const day=new Date().toISOString().slice(0,10),api=origin+'/api/day/'+day;
  const {chorusTrace,motifTrace,dailyMotif,CHORUS_POINTS}=await import('../public/src/game.js');
  const good=chorusTrace(motifTrace(dailyMotif(day)).map(p=>({t:p.at,y:p.y})));
  const post=(body,headers={})=>fetch(api,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  assert.deepEqual(await (await fetch(api)).json(),{day,voices:0,resonant:0,traces:[]});
  const joined=await (await post(good)).json();assert.equal(joined.joined,true);assert.equal(joined.chorus.voices,1);
  const flat=await (await post({y:Array(CHORUS_POINTS).fill(0.5),dur:3})).json();assert.equal(flat.joined,false);assert.equal(flat.chorus.voices,1);
  assert.equal((await post({y:[1],dur:3})).status,400);
  assert.equal((await post(good,{Origin:'https://ailleurs.example'})).status,403);
  assert.equal((await fetch(api,{method:'POST',body:'{}'})).status,415);
  assert.equal((await fetch(origin+'/api/day/1999-01-01')).status,400);
  assert.equal((await fetch(origin+'/api/rien')).status,404);
  assert.equal((await fetch(api)).headers.get('cache-control'),'no-store');
  const r=await fetch(origin+'/'),etag=r.headers.get('etag');assert.ok(etag);assert.equal((await fetch(origin+'/',{headers:{'If-None-Match':etag}})).status,304);
  assert.equal((await fetch(origin+'/',{method:'HEAD'})).status,200);assert.equal((await fetch(origin+'/',{method:'POST'})).status,405);assert.equal((await fetch(origin+'/__stop',{method:'POST'})).status,403);
  const exit=once(child,'exit');assert.equal((await fetch(origin+'/__stop',{method:'POST',headers:{'X-Pelagic-Stop':token}})).status,202);assert.equal((await exit)[0],0);
 }finally{if(child.exitCode===null&&child.signalCode===null){child.kill();await once(child,'exit')}if(resolve(dirname(directory))!==resolve(tmpdir())||!basename(directory).startsWith('quatre-public-test-'))throw Error('Unsafe fixture cleanup');await rm(directory,{recursive:true,force:true})}
});
