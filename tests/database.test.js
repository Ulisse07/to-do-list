import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('Database migration, permissions and transactional application flows',async t=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');`);
    await db.exec(readFileSync('sql/schema.sql','utf8'));
    await db.exec(readFileSync('sql/policies.sql','utf8'));
    await db.exec(readFileSync('sql/seed.sql','utf8'));
    await db.exec(readFileSync('sql/seed.sql','utf8'));
    await db.exec(`insert into private.workspace_access(user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);`);
    const snapshot=async()=>(await db.query('select public.workspace_snapshot() as data')).rows[0].data;
    const initial=await snapshot();
    const actor=initial.members[0].id;
    const save=async(task,expected=null)=>(await db.query('select public.save_task($1::jsonb,$2::uuid,$3::timestamptz) as id',[JSON.stringify(task),actor,expected])).rows[0].id;
    let tid;
    await t.test('Idempotent seed, real relationships, no duplicate global tasks',async()=>{
      assert.equal(initial.tasks.length,32);assert.equal(initial.members.length,4);assert.equal(initial.tasks.flatMap(t=>t.checklist).length,75);assert.equal(new Set(initial.tasks.map(t=>t.id)).size,32);assert.ok(initial.tasks.some(t=>t.assignee_ids.length===3));
    });
    await t.test('Unlisted authenticated user and anonymous user cannot read or mutate',async()=>{
      await db.exec(`select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);`);
      assert.equal((await db.query('select * from public.tasks')).rows.length,0);
      await assert.rejects(snapshot,/non autorizzato/);
      await assert.rejects(()=>save(initial.tasks[0]),/non autorizzato/);
      await db.exec('reset role; set role anon;');
      await assert.rejects(()=>db.query('select * from public.tasks'),/permission denied/);
      await assert.rejects(snapshot,/permission denied/);
      await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);`);
    });
    await t.test('Direct writes and forged activity events are forbidden',async()=>{
      await assert.rejects(()=>db.query("update public.tasks set title='forged'"),/permission denied/);
      await assert.rejects(()=>db.query('delete from public.activity_log'),/permission denied/);
      await assert.rejects(()=>db.query('select * from private.workspace_access'),/permission denied/);
    });
    await t.test('Create task atomically with multiple assignees and checklist ownership',async()=>{
      const draft={title:'Verifica integrazione',description:'Test',client_id:initial.clients[0].id,cluster_id:null,assignee_ids:initial.members.slice(0,3).map(m=>m.id),status:'In corso',priority:'Alta',due_date:'2026-09-20',notes:'Note',checklist:[{text:'Preparare materiali',completed:false,assignee_ids:initial.members.slice(0,2).map(m=>m.id),due_date:'2026-09-18'}]};
      tid=await save(draft);
      const data=await snapshot(),task=data.tasks.find(t=>t.id===tid);
      assert.equal(task.assignee_ids.length,3);assert.equal(task.checklist[0].assignee_ids.length,2);assert.equal(task.created_by,actor);assert.equal(task.completed_at,null);
      assert.ok(data.activity.some(a=>a.task_id===tid&&a.event_type==='task_created'));
    });
    await t.test('Invalid assignments roll back the task and log as one transaction',async()=>{
      const data=await snapshot(),task=data.tasks.find(t=>t.id===tid),oldLog=data.activity.length;
      await assert.rejects(()=>save({...task,title:'MUST NOT PERSIST',assignee_ids:['ffffffff-ffff-4fff-8fff-ffffffffffff']},task.updated_at),/Responsabile/);
      const after=await snapshot();assert.equal(after.tasks.find(t=>t.id===tid).title,task.title);assert.equal(after.activity.length,oldLog);
      const stolen=initial.tasks[0].checklist[0];
      await assert.rejects(()=>save({...task,title:'MUST NOT PERSIST',checklist:[stolen]},task.updated_at),/altra attività|altra attivit|altra|un’altra/);
      assert.equal((await snapshot()).tasks.find(t=>t.id===tid).title,task.title);
    });
    await t.test('Task update records all required events and stale updates fail',async()=>{
      const before=(await snapshot()).tasks.find(t=>t.id===tid);
      const next={...before,status:'Completata',priority:'Urgente',due_date:'2026-09-21',assignee_ids:[initial.members[1].id,initial.members[3].id],checklist:before.checklist.map(i=>({...i,completed:true}))};
      await save(next,before.updated_at);
      const data=await snapshot(),updated=data.tasks.find(t=>t.id===tid);
      assert.ok(updated.completed_at);assert.ok(updated.checklist[0].completed_at);assert.equal(updated.updated_by,actor);
      const events=data.activity.filter(a=>a.task_id===tid).map(a=>a.event_type);
      for(const event of ['task_updated','status_changed','priority_changed','due_date_changed','assignee_added','assignee_removed','task_completed','checklist_changed'])assert.ok(events.includes(event),event);
      await assert.rejects(()=>save({...before,title:'stale'},before.updated_at),/modificata/);
      await save({...updated,status:'Da fare',checklist:updated.checklist.map(i=>({...i,completed:false}))},updated.updated_at);
      const reopened=(await snapshot()).tasks.find(t=>t.id===tid);assert.equal(reopened.completed_at,null);assert.equal(reopened.checklist[0].completed_at,null);
    });
    const entity=async(kind,value)=>(await db.query('select public.save_entity($1,$2::jsonb,$3::uuid,$4::timestamptz) as id',[kind,JSON.stringify(value),actor,value.updated_at||null])).rows[0].id;
    await t.test('Create, edit and archive clients/clusters without cascading task deletion',async()=>{
      const client=initial.clients.find(c=>initial.tasks.some(t=>t.client_id===c.id));
      const previousCount=(await snapshot()).tasks.filter(t=>t.client_id===client.id).length;
      await entity('clients',{...client,archived:true});
      assert.equal((await snapshot()).tasks.filter(t=>t.client_id===client.id).length,previousCount);
      const cluster=initial.clusters.find(c=>initial.tasks.some(t=>t.cluster_id===c.id));
      await assert.rejects(()=>entity('clusters',{...cluster,client_id:initial.clients.find(c=>c.id!==cluster.client_id).id}),/contiene attività/);
      const cid=await entity('clients',{name:'Cliente test',color:'#527260',archived:false});
      const clusterId=await entity('clusters',{name:'Cluster test',client_id:cid,color:'#527260'});assert.ok(clusterId);
      const d=await snapshot(),cl=d.clusters.find(c=>c.id===clusterId);
      await entity('clusters',{...cl,archived:true});assert.equal((await snapshot()).clusters.find(c=>c.id===clusterId).archived,true);
    });
    await t.test('Dynamic members, avatar persistence, immutable historical assignments, last active guard',async()=>{
      const member=await entity('members',{name:'Nuovo membro',role:'Delivery',avatar:'data:image/png;base64,YQ==',active:true,color:'#527260'});
      let d=await snapshot();assert.equal(d.members.find(m=>m.id===member).avatar,'data:image/png;base64,YQ==');
      for(const m of d.members.filter(m=>m.id!==actor))await entity('members',{...m,active:false});
      d=await snapshot();assert.equal(d.members.filter(m=>m.active).length,1);assert.ok(d.tasks.some(t=>t.assignee_ids.includes(initial.members[1].id)));
      await assert.rejects(()=>entity('members',{...d.members.find(m=>m.id===actor),active:false}),/almeno un membro attivo/);
    });
    await t.test('Delete cascades checklist but preserves audit events and cannot resurrect stale task',async()=>{
      const task=(await snapshot()).tasks.find(t=>t.id===tid);
      await db.query('select public.delete_task($1::uuid,$2::uuid,$3::timestamptz)',[tid,actor,task.updated_at]);
      const after=await snapshot();assert.equal(after.tasks.some(t=>t.id===tid),false);assert.ok(after.activity.some(a=>a.event_type==='task_deleted'&&a.task_id===null));
      assert.equal((await db.query('select * from public.checklist_items where task_id=$1',[tid])).rows.length,0);
      await assert.rejects(()=>save(task,task.updated_at),/eliminata/);
    });
  }finally{await db.close();}
});
