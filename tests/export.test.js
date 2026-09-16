import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createDemo } from '../js/demo.js';
import { buildWorkbook } from '../js/export.js';
import { metrics } from '../js/domain.js';
test('Excel roundtrip has 4 correct sheets, filters, freezes, styles, typed dates and safe strings',async()=>{
  const data=createDemo('2026-09-14');data.tasks[0].title='=HYPERLINK("https://invalid.test")';
  const workbook=await buildWorkbook(data,'2026-09-14');
  const buffer=await workbook.xlsx.writeBuffer();assert.ok(buffer.byteLength>10000);
  const read=new ExcelJS.Workbook();await read.xlsx.load(buffer);
  assert.deepEqual(read.worksheets.map(w=>w.name),['Attività','KPI','Checklist','Scadenze']);
  for(const ws of read.worksheets){assert.equal(ws.views[0].ySplit,1);assert.ok(ws.autoFilter);assert.equal(ws.getRow(1).getCell(1).font.bold,true);assert.ok(ws.getColumn(1).width>=20);}
  assert.equal(read.getWorksheet('Attività').rowCount,33);
  assert.equal(read.getWorksheet('Checklist').rowCount,data.tasks.flatMap(t=>t.checklist).length+1);
  assert.equal(read.getWorksheet('Attività').getCell('D2').type,ExcelJS.ValueType.String);
  assert.ok(read.getWorksheet('Attività').getCell('J2').value instanceof Date);
  assert.equal(read.getWorksheet('Attività').getCell('J2').value.toISOString().slice(0,10),'2026-09-12');
  assert.equal(read.getWorksheet('KPI').getCell('D2').value,metrics(data.tasks).total);
  const deadlines=read.getWorksheet('Scadenze');let previous='';let passedLate=false;
  for(let i=2;i<=deadlines.rowCount;i++){const row=deadlines.getRow(i);if(row.getCell(1).value!=='Scaduta')passedLate=true;else assert.equal(passedLate,false);const day=row.getCell(11).value.toISOString().slice(0,10);assert.ok(day>=previous);previous=day;assert.notEqual(row.getCell(9).value,'Completata');}
});
