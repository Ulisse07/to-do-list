import test from 'node:test';
import assert from 'node:assert/strict';
import { metrics, filterTasks, endOfWeek, addDays, checklistProgress, validateTask, businessDate, sortTasks } from '../js/domain.js';
import { createDemo } from '../js/demo.js';
const today='2026-09-14';
const task=(id,overrides={})=>({id,title:id,status:'Da fare',priority:'Media',due_date:today,assignee_ids:['a','b'],checklist:[],...overrides});
test('Global KPI deduplicates tasks while shared workload includes both members',()=>{
  const shared=task('one');assert.equal(metrics([shared,shared],today).total,1);
  assert.equal(filterTasks([shared],{member:'a'},today).length,1);
  assert.equal(filterTasks([shared],{member:'b'},today).length,1);
});
test('Today excludes overdue and completed; week runs until Sunday inclusive',()=>{
  const tasks=[task('today'),task('late',{due_date:'2026-09-13'}),task('sunday',{due_date:'2026-09-20'}),task('next',{due_date:'2026-09-21'}),task('done',{status:'Completata'})];
  assert.deepEqual(filterTasks(tasks,{quick:'today'},today).map(t=>t.id),['today']);
  assert.deepEqual(filterTasks(tasks,{quick:'week'},today).map(t=>t.id),['today','sunday']);
  assert.deepEqual(filterTasks(tasks,{quick:'overdue'},today).map(t=>t.id),['late']);
  assert.equal(endOfWeek('2026-09-20'),'2026-09-20');
});
test('Calendar arithmetic survives DST and year boundaries',()=>{
  assert.equal(addDays('2026-03-28',2),'2026-03-30');
  assert.equal(addDays('2026-10-24',2),'2026-10-26');
  assert.equal(endOfWeek('2026-12-31'),'2027-01-03');
  assert.equal(businessDate('2026-09-14T23:30:00Z'),'2026-09-15');
});
test('KPI denominator semantics, completion on due date, empty dataset',()=>{
  const tasks=[task('done',{status:'Completata',completed_at:'2026-09-14T18:00:00Z',checklist:[{completed:true},{completed:false}]}),task('lateDone',{status:'Completata',completed_at:'2026-09-14T23:30:00Z'}),task('undated',{status:'Completata',completed_at:'2026-09-14T10:00:00Z',due_date:null}),task('late',{due_date:'2026-09-13',checklist:[{completed:false}]})];
  const k=metrics(tasks,today);assert.equal(k.onTimeRate,50);assert.equal(k.overdue,1);assert.equal(k.overdueRate,25);assert.equal(k.checklistRate,33);assert.equal(k.completionRate,75);
  assert.equal(metrics([]).onTimeRate,null);assert.equal(metrics([]).completionRate,0);
});
test('Filters combine search, client, cluster, member, dates and incomplete checklist',()=>{
  const t=task('yes',{title:'Rivedere piano',client_id:'client',cluster_id:'cluster',checklist:[{completed:false}]});
  assert.equal(filterTasks([t],{search:'PIANO',member:'b',client:'client',cluster:'cluster',from:today,to:today,incomplete:true},today).length,1);
  assert.equal(filterTasks([t],{member:'c'},today).length,0);
  assert.equal(checklistProgress(t).percent,0);
  assert.deepEqual(sortTasks([task('nodate',{due_date:null}),t]).map(x=>x.id),['yes','nodate']);
});
test('Demo meets seed requirements and task validation rejects invalid ownership',()=>{
  const data=createDemo(today);assert.equal(data.members.length,4);assert.ok(data.clients.length>=5);assert.ok(data.clusters.length>=8);assert.ok(data.tasks.length>=30);assert.ok(data.tasks.flatMap(t=>t.checklist).length>=50);assert.ok(data.tasks.some(t=>t.assignee_ids.length===3));
  for(const t of data.tasks)assert.doesNotThrow(()=>validateTask(t,data));
  assert.throws(()=>validateTask({...data.tasks[0],assignee_ids:[]},data),/responsabile/);
  assert.throws(()=>validateTask({...data.tasks[0],client_id:data.clients[1].id},data),/altro cliente/);
});
