// Local-only conversion; no database/server connection, never includes QR tokens.
import {readFile,writeFile,stat} from 'node:fs/promises';
import {basename} from 'node:path';
import {validateBackup} from '../public/assets/core.js';
const [input,output,event]=process.argv.slice(2);
if(!input||!output||!event||input===output||!/^[A-Za-z0-9_-]{1,64}$/.test(event)){
  console.error('Usage: node tools/t05-to-sql.mjs backup-T05.json hasil.sql EVENT');process.exit(1);
}
try{
  if((await stat(input)).size>20*1024*1024)throw Error('Backup exceeds 20 MB');
  const b=validateBackup(JSON.parse(await readFile(input,'utf8')));
  if(!b.slots.some(s=>s.event===event))throw Error('Event not present in backup');
  const payload={version:1,logs:b.logs.filter(l=>l.event===event).map(({id,event,code,tablet,at})=>({id,event,code,tablet,at})),rsvps:b.rsvps.filter(r=>r.event===event)};
  const hex=s=>`CONVERT(0x${Buffer.from(s,'utf8').toString('hex')} USING utf8mb4)`;
  const sql=`-- Local T05 export; no QR tokens or guest identities. Master slots must exist.\nSET NAMES utf8mb4;\nCALL rsas_impor_t05(${hex(event)},${hex(basename(input).slice(0,255))},${hex(JSON.stringify(payload))});\n`;
  await writeFile(output,sql,{flag:'wx',mode:0o600});
  console.log(`Created ${output}: ${payload.logs.length} scan records, ${payload.rsvps.length} RSVP records.`);
}catch(e){console.error(e.message);process.exit(1);}
