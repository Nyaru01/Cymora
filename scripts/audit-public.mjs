import {readdir,readFile} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
const root=resolve(process.argv[2]||'public');
const findings=[];
const patterns={secret:/(?:gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{32,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/,personalPath:/[CD]:[\\/](?:Users|Dev)[\\/]/i,personalEmail:/\b[\w.+-]+@(?!users\.noreply\.github\.com)[\w.-]+\.[A-Za-z]{2,}\b/};
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);const label=relative(root,path).split(sep).join('/');if(entry.isSymbolicLink()){findings.push({path:label,kind:'symlink'});continue}if(entry.name.startsWith('.')){findings.push({path:label,kind:'hidden'});continue}if(entry.isDirectory())await walk(path);else if(/\.(?:js|css|html|json|md|txt|svg)$/.test(path)){const source=await readFile(path,'utf8');for(const[kind,pattern]of Object.entries(patterns))if(pattern.test(source))findings.push({path:label,kind});if(/getUserMedia|sendBeacon|googletagmanager|google-analytics|connect\.facebook/.test(source))findings.push({path:label,kind:'unexpected-network-or-capture'});}}}
await walk(root);console.log(JSON.stringify({scope:'public assets',filesWithFindings:findings.length,findings},null,2));if(findings.length)process.exitCode=1;
