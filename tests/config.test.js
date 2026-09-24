import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import configure from '../vite.config.js';
test('Build rejects secret keys and unexpected exposed variables before bundling',()=>{
  const cwd=process.cwd(),folder=mkdtempSync(join(tmpdir(),'eng-config-test-')),savedEnv={...process.env};
  process.chdir(folder);
  const config=values=>{writeFileSync('.env',values);return configure({mode:'production'});};
  try{
    assert.doesNotThrow(()=>config('VITE_DEMO_MODE=false\n'));
    assert.throws(()=>config('VITE_SUPABASE_PUBLISHABLE_KEY=sb_secret_test_only\n'),/Build bloccata/);
    const header=Buffer.from('{}').toString('base64url'),body=Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url');
    assert.throws(()=>config(`VITE_SUPABASE_PUBLISHABLE_KEY=${header}.${body}.test\n`),/ruolo anon/);
    assert.throws(()=>config('VITE_PASSWORD=test-only\n'),/Variabile frontend non prevista/);
    assert.throws(()=>config('VITE_SUPABASE_URL=https://name:password@example.test\n'),/credenziali/);
    process.env.VITE_PASSWORD='runner-secret';
    assert.throws(()=>config('VITE_DEMO_MODE=false\n'),/Variabile frontend non prevista/);
    delete process.env.VITE_PASSWORD;
    process.env.BASE_PATH='/to-do-list/';
    assert.equal(config('VITE_DEMO_MODE=true\n').base,'/to-do-list/');
    process.env.BASE_PATH='to-do-list';
    assert.throws(()=>config('VITE_DEMO_MODE=true\n'),/BASE_PATH/);
  }finally{
    for(const name of Object.keys(process.env))if(!(name in savedEnv))delete process.env[name];
    Object.assign(process.env,savedEnv);
    process.chdir(cwd);rmSync(folder,{recursive:true,force:true});
  }
});
