// Local fictional review only. Does not import/migrate any existing database.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(fs.existsSync(path.join(root,'.env')))throw Error('Remova a seleção de .env desta cópia de avaliação; nenhum segredo real deve ser carregado. O arquivo não foi alterado.');
const cfg=JSON.parse(fs.readFileSync(path.join(root,'firebase-applet-config.json'),'utf8'));
if(!cfg.projectId?.startsWith('demo-'))throw Error('A avaliação exige configuração Firebase fictícia.');
const parent=path.join(process.env.LOCALAPPDATA||os.tmpdir(),'G360-Business-Review');
fs.mkdirSync(parent,{recursive:true,mode:0o700});
const reservation=fs.mkdtempSync(path.join(parent,'avaliacao-'));
const data=path.join(reservation,'data');
// Minimal runtime environment; no provider credentials or production grants inherited.
const env=Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP','COMSPEC','PATHEXT','LANG','NODE_EXTRA_CA_CERTS'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const init=spawnSync(process.execPath,[path.join(root,'scripts/prepare-integration-fixture.mjs'),data],{cwd:root,env,stdio:'inherit'});
if(init.status!==0)process.exit(init.status||1);
const preload=path.join(reservation,'deny-external.mjs');
fs.writeFileSync(preload,"globalThis.fetch=async()=>{throw Error('External fetch disabled in fictional local review')};\n",{mode:0o600,flag:'wx'});
Object.assign(env,{HOME:reservation,USERPROFILE:reservation,NODE_ENV:'development',BIND_HOST:'127.0.0.1',PORT:'3001',G360_DATA_DIR:data,G360_ALLOWED_ORIGINS:'http://127.0.0.1:3001'});
console.log('Avaliação local: http://127.0.0.1:3001 — somente dados fictícios.');
console.log('Credenciais fictícias privadas: '+path.join(data,'TEST-CREDENTIALS-PRIVATE.json'));
console.log('Ctrl+C encerra o servidor; os dados desta avaliação são preservados.');
const child=spawn(process.execPath,['--import',preload,'--import','tsx','server.ts'],{cwd:root,env,stdio:'inherit'});
child.on('error',()=>{console.error('Não foi possível iniciar. Confirme Node 24, dependências instaladas e porta 3001 livre.');process.exitCode=1});
child.on('exit',code=>{process.exitCode=code||0});
process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
