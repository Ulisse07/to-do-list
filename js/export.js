import ExcelJS from 'exceljs';
import { metrics, checklistProgress, isoDate, businessDate, addDays, overdue, PRIORITIES, open } from './domain.js';
const calendarDate = value => value ? new Date(`${value.length === 10 ? value : businessDate(value)}T00:00:00Z`) : null;
const timestamp = value => {
  if (!value) return null;
  const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
  return new Date(`${local.replace(' ', 'T')}Z`);
};
export async function buildWorkbook(data, today = isoDate()) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ENG Workspace'; workbook.subject = 'Attività e indicatori operativi del team'; workbook.created = new Date();
  const lookup = (kind, id) => data[kind].find(x => x.id === id)?.name || '';
  const names = ids => ids.map(id => lookup('members', id)).join(', ');
  const taskColumns = [
    ['ID','id',38],['Cliente','client',25],['Cluster','cluster',27],['Attività','title',48],['Descrizione','description',60],['Responsabili','assignees',38],['Priorità','priority',14],['Stato','status',16],['Data creazione','created',19,'dd/mm/yyyy hh:mm'],['Scadenza','due',15,'dd/mm/yyyy'],['Data completamento','completed',19,'dd/mm/yyyy hh:mm'],['Creato da','creator',23],['Ultimo aggiornamento','updated',22,'dd/mm/yyyy hh:mm'],['Ultimo aggiornamento da','editor',26],['% Checklist completata','checklist',25,'0%'],['Note','notes',60],
  ];
  function sheet(name, columns) {
    const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }], properties: { defaultRowHeight: 23 } });
    ws.columns = columns.map(([header, key, width, numFmt]) => ({ header, key, width, style: numFmt ? { numFmt } : {} }));
    return ws;
  }
  const taskRow = t => ({ id:t.id,client:lookup('clients',t.client_id),cluster:lookup('clusters',t.cluster_id),title:t.title,description:t.description,assignees:names(t.assignee_ids),priority:t.priority,status:t.status,created:timestamp(t.created_at),due:calendarDate(t.due_date),completed:timestamp(t.completed_at),creator:lookup('members',t.created_by),updated:timestamp(t.updated_at),editor:lookup('members',t.updated_by),checklist:checklistProgress(t).percent/100,notes:t.notes });
  const tasks = sheet('Attività',taskColumns);
  tasks.addRows(data.tasks.map(taskRow));
  const kpi = sheet('KPI', [['Ambito','scope',20],['Entità','entity',32],['Indicatore','metric',42],['Valore','value',20]]);
  const labels = { total:'Attività totali',open:'Attività aperte',todo:'Da fare',inProgress:'In corso',blocked:'Bloccate',completed:'Completate',overdue:'Scadute',dueSoon:'In scadenza da oggi a +7 giorni',thisWeek:'In scadenza questa settimana',urgent:'Urgenti aperte',completionRate:'Percentuale completamento',onTimeRate:'Completate entro scadenza',overdueRate:'Scadute sul totale',checklistRate:'Checklist completate' };
  function addMetrics(scope,entity,list) {
    for (const [key,value] of Object.entries(metrics(list,today))) {
      const row = kpi.addRow({ scope,entity,metric:labels[key],value:value === null ? 'N/D' : key.endsWith('Rate') ? value/100 : value });
      if (key.endsWith('Rate') && value !== null) row.getCell(4).numFmt = '0%';
    }
  }
  addMetrics('Generali','Team ENG',data.tasks);
  for (const m of data.members) addMetrics('Persona',m.name,data.tasks.filter(t => t.assignee_ids.includes(m.id)));
  for (const c of data.clients) {
    addMetrics('Cliente',c.name,data.tasks.filter(t => t.client_id === c.id));
    kpi.addRow({ scope:'Cliente',entity:c.name,metric:'Cluster attivi',value:data.clusters.filter(x => x.client_id === c.id && !x.archived).length });
  }
  for (const c of data.clusters) addMetrics('Cluster',c.name,data.tasks.filter(t => t.cluster_id === c.id));
  const checklist = sheet('Checklist',[['Task ID','task_id',38],['Cliente','client',25],['Cluster','cluster',27],['Task','title',48],['Sotto-attività','text',55],['Responsabili','assignees',38],['Scadenza','due',15,'dd/mm/yyyy'],['Stato','status',16],['Data completamento','completed',23,'dd/mm/yyyy hh:mm']]);
  for (const task of data.tasks) for (const item of task.checklist) checklist.addRow({task_id:task.id,client:lookup('clients',task.client_id),cluster:lookup('clusters',task.cluster_id),title:task.title,text:item.text,assignees:names(item.assignee_ids),due:calendarDate(item.due_date),status:item.completed?'Completata':'Da fare',completed:timestamp(item.completed_at)});
  const dueSheet = sheet('Scadenze',[['Fascia','range',24], ...taskColumns]);
  const deadlines = data.tasks.filter(t => open(t) && t.due_date && t.due_date <= addDays(today,7)).sort((a,b) => Number(overdue(b,today))-Number(overdue(a,today)) || a.due_date.localeCompare(b.due_date) || PRIORITIES.indexOf(b.priority)-PRIORITIES.indexOf(a.priority) || a.title.localeCompare(b.title));
  dueSheet.addRows(deadlines.map(t => ({range:overdue(t,today)?'Scaduta':t.due_date===today?'Oggi':'Entro 7 giorni',...taskRow(t)})));
  for (const ws of workbook.worksheets) {
    ws.autoFilter = { from: { row:1,column:1 },to:{ row:Math.max(ws.rowCount,1),column:ws.columnCount } };
    ws.getRow(1).height = 32;
    ws.getRow(1).eachCell(cell => { cell.font={name:'Aptos',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF284532'}};cell.alignment={vertical:'middle',wrapText:true}; });
    ws.eachRow((row,n) => {
      if (n===1) return;
      row.height = 32;
      row.eachCell({includeEmpty:true},cell => {
        cell.font={name:'Aptos',size:10,color:{argb:'FF344837'}};
        cell.alignment={vertical:'middle',wrapText:true};
        cell.border={bottom:{style:'hair',color:{argb:'FFE4EBDC'}}};
        if(n%2===0) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF4F7EF'}};
        // Text is always text, including titles beginning with formula characters.
        if(typeof cell.value==='string' && /^[=+@-]/.test(cell.value)) cell.style.quotePrefix=true;
      });
    });
    ws.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};
    ws.headerFooter.oddFooter='ENG Workspace · &A | Pagina &P di &N';
  }
  return workbook;
}
export async function exportExcel(data) {
  const today=isoDate();
  const workbook=await buildWorkbook(data,today);
  const buffer=await workbook.xlsx.writeBuffer();
  const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a');a.href=url;a.download=`ENG_Task_Report_${today}.xlsx`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
