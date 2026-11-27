import http from 'node:http';
import {readdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual,createHash} from 'node:crypto';
import {createChorus,createLimiter,acceptableDay,judgeTrace,cleanWord,PASS} from './chorus.mjs';
const root = new URL('./public/',import.meta.url);
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',webp:'image/webp',ico:'image/x-icon',mp4:'video/mp4',md:'text/plain; charset=utf-8',txt:'text/plain; charset=utf-8'};
const assets=new Map();
async function inventory(dir,prefix='') {
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name.startsWith('.')||entry.isSymbolicLink())continue;
    const relative=prefix+entry.name;
    if(!/^[a-zA-Z0-9_./-]+$/.test(relative))continue;
    const url=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
    if(entry.isDirectory())await inventory(url,relative+'/');
    else if(types[entry.name.split('.').pop()]){
      assets.set('/'+relative,url);
      if(entry.name==='index.html')assets.set('/'+prefix,url);
    }
  }
}
await inventory(root);
const railway=Boolean(process.env.RAILWAY_PROJECT_ID||process.env.RAILWAY_ENVIRONMENT_ID);
const host=process.env.HOST||(railway?'0.0.0.0':'127.0.0.1');
const port=Number(process.env.PORT||4173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
if(!['127.0.0.1','::1','0.0.0.0'].includes(host))throw new Error('Invalid HOST');
const chorus=await createChorus();
const allowVoice=createLimiter();
const allowWord=createLimiter(4); // quatre mots par heure et par visiteur, en mémoire seulement
const stopToken=!railway&&['127.0.0.1','::1'].includes(host)?process.env.PELAGIC_STOP_TOKEN:null;
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Cache-Control','no-cache');
  if(railway)res.setHeader('Strict-Transport-Security','max-age=31536000');
  const english=/^en\b/i.test(req.headers['accept-language']||'');
  const error=(code,fr,en)=>{res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?undefined:english?en:fr);};
  if(req.url==='/__stop'&&req.method==='POST'&&stopToken){
    const provided=Buffer.from(req.headers['x-pelagic-stop']||''),expected=Buffer.from(stopToken);
    if(provided.length!==expected.length||!timingSafeEqual(provided,expected))return error(403,'Accès refusé.','Access denied.');
    res.writeHead(202);res.end('Stopping');server.close(()=>process.exit(0));server.closeIdleConnections();return;
  }
  if(req.url.startsWith('/api/'))return api(req,res);
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return error(405,'Méthode non autorisée.','Method not allowed.');}
  let pathname;
  try{pathname=new URL(req.url,'http://localhost').pathname;}catch{return error(400,'Requête invalide.','Invalid request.');}
  if(pathname==='/health'){
    res.writeHead(200,{'Content-Type':types.json,'Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:JSON.stringify({status:'ok',app:'cymora'}));return;
  }
  if(!assets.has(pathname)&&assets.has(pathname+'/')){res.writeHead(308,{Location:pathname+'/' + (new URL(req.url,'http://localhost')).search});res.end();return;}
  const asset=assets.get(pathname);
  if(!asset)return error(404,'Page introuvable. Retour à Cymora : /','Page not found. Return to Cymora: /');
  try{
    const body=await readFile(asset),extension=fileURLToPath(asset).split('.').pop();
    if(extension==='html'){
      const html=body.toString('utf8').replace(/\r\n?/g,'\n');
      const hashes=tag=>[...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`,'g'))].map(m=>`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`).join(' ');
      res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' ${hashes('script')}; style-src 'self' ${hashes('style')}; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
    }
    const etag='"'+createHash('sha256').update(body).digest('base64url')+'"';res.setHeader('ETag',etag);
    if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
    // Vidéo : Safari (iPhone) ne la lit que si le serveur répond par plages d'octets (206).
    const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||'');
    if(extension==='mp4'&&range){
      const size=body.length;let start=range[1]===''?size-Number(range[2]):Number(range[1]);let end=range[1]===''||range[2]===''?size-1:Number(range[2]);
      start=Math.max(0,start);end=Math.min(size-1,end);
      if(!(start<=end)){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
      res.writeHead(206,{'Content-Type':types.mp4,'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});
      res.end(req.method==='HEAD'?undefined:body.subarray(start,end+1));return;
    }
    res.writeHead(200,{'Content-Type':types[extension],...(extension==='mp4'?{'Accept-Ranges':'bytes'}:{})});res.end(req.method==='HEAD'?undefined:body);
  }catch{return error(500,'Cette ressource est momentanément indisponible.','This resource is temporarily unavailable.');}
});
// Chœur du jour : GET lit le chœur, POST y ajoute une voix (si elle est accordée). Réponses JSON, jamais en cache.
async function api(req,res){
  const send=(code,data)=>{res.writeHead(code,{'Content-Type':types.json,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify(data));};
  const origin=req.headers.origin;
  const sameOrigin=()=>{if(!origin)return true;let from=null;try{from=new URL(origin).host;}catch{}return from===req.headers.host;};
  // Un mot laissé par un joueur (depuis le manifeste) : POST seulement, jamais relu par l'API.
  if(req.url.split('?')[0]==='/api/words'){
    if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'method'});}
    if(!sameOrigin())return send(403,{error:'origin'});
    if(!/^application\/json\b/.test(req.headers['content-type']||''))return send(415,{error:'type'});
    let body='';
    for await(const chunk of req){body+=chunk;if(body.length>4096)return send(413,{error:'size'});}
    let word;
    try{word=cleanWord(JSON.parse(body));}catch{return send(400,{error:'json'});}
    if(!word)return send(400,{error:'word'});
    const who=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
    if(!allowWord(who))return send(429,{error:'rate'});
    try{await chorus.addWord(word);return send(200,{ok:true});}catch{return send(503,{error:'unavailable'});}
  }
  const match=/^\/api\/day\/(\d{4}-\d{2}-\d{2})$/.exec(req.url.split('?')[0]);
  if(!match)return send(404,{error:'not_found'});
  const day=match[1];
  if(!acceptableDay(day))return send(400,{error:'day'});
  try{
    if(req.method==='GET'||req.method==='HEAD')return send(200,await chorus.get(day));
    if(req.method!=='POST'){res.setHeader('Allow','GET, HEAD, POST');return send(405,{error:'method'});}
    if(!sameOrigin())return send(403,{error:'origin'});
    if(!/^application\/json\b/.test(req.headers['content-type']||''))return send(415,{error:'type'});
    let body='';
    for await(const chunk of req){body+=chunk;if(body.length>4096)return send(413,{error:'size'});}
    let trace;
    try{trace=JSON.parse(body);}catch{return send(400,{error:'json'});}
    const verdict=judgeTrace(day,trace);
    if(!verdict)return send(400,{error:'trace'});
    // L'adresse ne sert qu'à cette limite, en mémoire, le temps d'une heure ; elle n'est jamais écrite.
    const who=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
    if(!allowVoice(who))return send(429,{error:'rate'});
    const joined=verdict.score>=PASS;
    if(joined)await chorus.add(day,{y:trace.y,dur:trace.dur},verdict.score);
    return send(200,{joined,score:verdict.score,chorus:await chorus.get(day)});
  }catch{return send(503,{error:'unavailable'});}
}
server.requestTimeout=15000;server.headersTimeout=10000;
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port already in use.':'Server failed to start.');process.exitCode=1;});
server.listen(port,host,()=>console.log(`Cymora http://${host}:${port} (chœur : ${chorus.kind})`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>chorus.close().finally(()=>process.exit(0)));server.closeIdleConnections();});
