import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'MANIFESTO-ARQUIVOS.json'),'utf8'));
let failures=0;
for(const item of manifest.files){
 if(typeof item.path!=='string'||item.path.includes('\\')||item.path.split('/').some(x=>x==='..')||path.isAbsolute(item.path))throw Error('Invalid manifest path');
 const file=path.resolve(root,item.path);
 try{const b=fs.readFileSync(file);if(b.length!==item.bytes||createHash('sha256').update(b).digest('hex')!==item.sha256){console.error('Alterado: '+item.path);failures++}}catch{console.error('Ausente: '+item.path);failures++}
}
console.log(`${manifest.files.length} arquivos conferidos; ${failures} divergências. Manifesto não autentica sozinho o remetente.`);
process.exitCode=failures?1:0;
