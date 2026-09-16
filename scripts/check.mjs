import { readdirSync,readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files=folder=>readdirSync(folder,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${folder}/${e.name}`):[`${folder}/${e.name}`]);
for(const file of [...files('js'),...files('scripts'),...files('tests')].filter(f=>/\.m?js$/.test(f))){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status)process.exit(result.status);}
for(const file of files('js')){const text=readFileSync(file,'utf8');if(/sb_secret_[A-Za-z0-9]{8,}/.test(text)||/eyJ[A-Za-z0-9_-]{20,}\./.test(text))throw Error(`Possible embedded credential: ${file}`);}
console.log('Sintassi JavaScript e controllo credenziali: OK');
