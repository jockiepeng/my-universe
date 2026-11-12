import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
test('failed CLI sync preserves exact snapshot bytes and records a safe failure status',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'news-sync-failure-'));
 try{
  await mkdir(path.join(dir,'src/data'),{recursive:true});
  const file=path.join(dir,'src/data/news.json'),before='{"updatedAt":null,"reports":[]}\n';await writeFile(file,before);
  const r=spawnSync(process.execPath,[path.resolve('scripts/sync-news.mjs')],{cwd:dir,env:{...process.env,GITHUB_TOKEN:''},encoding:'utf8'});
  assert.equal(r.status,1);assert.equal(await readFile(file,'utf8'),before);
  const status=JSON.parse(await readFile(path.join(dir,'src/data/news-sync.json'),'utf8'));
  assert.equal(status.status,'failed');assert.ok(Date.parse(status.attemptedAt));assert.equal('error' in status,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
