import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const run=(...args)=>spawnSync(process.execPath,['tools/t05-to-sql.mjs',...args],{encoding:'utf8'});
test('T05 native backup becomes executable SQL without QR tokens or guest identities',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'rsas-sql-'));
  try{
    const file=join(dir,'import.sql');
    const result=run('demo/tablet-T01.json',file,'DEMO-RSAS');assert.equal(result.status,0,result.stderr);
    const source=await readFile(file,'utf8');assert.match(source,/CALL rsas_impor_t05/);
    const values=[...source.matchAll(/0x([0-9a-f]+)/g)].map(m=>Buffer.from(m[1],'hex').toString('utf8'));
    assert.equal(values[0],'DEMO-RSAS');const payload=JSON.parse(values[2]);
    assert.equal(payload.logs.length,1);assert.equal(payload.logs[0].id,'demo-log-T01');
    assert.deepEqual(Object.keys(payload).sort(),['logs','rsvps','version']);
    assert.ok(!JSON.stringify(payload).includes('token'));assert.ok(!JSON.stringify(payload).includes('name'));
    assert.notEqual(run('demo/tablet-T01.json',file,'DEMO-RSAS').status,0,'must refuse overwrite');
    assert.notEqual(run('demo/tablet-T01.json',join(dir,'bad.sql'),'UNKNOWN').status,0);
    assert.notEqual(run('demo/tablet-T01.json',join(dir,'inject.sql'),"x'); DROP TABLE x;").status,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
