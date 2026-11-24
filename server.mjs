import http from 'node:http';
import {readdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual,createHash} from 'node:crypto';
const root = new URL('./public/',import.meta.url);
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',svg:'image/svg+xml',png:'image/png',webp:'image/webp',ico:'image/x-icon',md:'text/plain; charset=utf-8',txt:'text/plain; charset=utf-8'};
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
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return error(405,'Méthode non autorisée.','Method not allowed.');}
  let pathname;
  try{pathname=new URL(req.url,'http://localhost').pathname;}catch{return error(400,'Requête invalide.','Invalid request.');}
  if(pathname==='/health'){
    res.writeHead(200,{'Content-Type':types.json,'Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:JSON.stringify({status:'ok',edition:5}));return;
  }
  if(!assets.has(pathname)&&assets.has(pathname+'/')){res.writeHead(308,{Location:pathname+'/' + (new URL(req.url,'http://localhost')).search});res.end();return;}
  const asset=assets.get(pathname);
  if(!asset)return error(404,'Page introuvable. Retour à l’exposition : /','Page not found. Return to the exhibition: /');
  try{
    const body=await readFile(asset),extension=fileURLToPath(asset).split('.').pop();
    if(extension==='html'){
      const html=body.toString('utf8').replace(/\r\n?/g,'\n');
      const hashes=tag=>[...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`,'g'))].map(m=>`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`).join(' ');
      res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' ${hashes('script')}; style-src 'self' ${hashes('style')}; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
    }
    const etag='"'+createHash('sha256').update(body).digest('base64url')+'"';res.setHeader('ETag',etag);
    if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
    res.writeHead(200,{'Content-Type':types[extension]});res.end(req.method==='HEAD'?undefined:body);
  }catch{return error(500,'Cette ressource est momentanément indisponible.','This resource is temporarily unavailable.');}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port already in use.':'Server failed to start.');process.exitCode=1;});
server.listen(port,host,()=>console.log(`QUATRE http://${host}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>process.exit(0));server.closeIdleConnections();});
