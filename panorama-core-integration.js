/* Panorama Core integration: Personal
   La nómina semanal solo controla y guarda periodos.
   El único registro de pagos vive en la sección Pagos.
*/
(async()=>{
  const cfg=window.PANORAMA_SUPABASE;
  if(!cfg){console.warn('Panorama Core: missing config');return;}
  await (window.PanoramaAuth?.ready||Promise.resolve());
  const api=cfg.url+'/rest/v1/';
  async function request(path,opts={}){
    const authHeaders=window.PanoramaAuth?.headers?.()||{apikey:cfg.key,'Content-Type':'application/json'};
    const response=await fetch(api+path,{...opts,headers:{...authHeaders,...opts.headers}});
    const body=await response.text();
    if(!response.ok)throw new Error(body||response.statusText);
    return body?JSON.parse(body):null;
  }

  window.PanoramaCore={
    async syncEmployee(employee){
      const payload={full_name:employee.name||employee.full_name,active:employee.active!==false,created_by_app:'personal',updated_by_app:'personal'};
      if(employee.coreEmployeeId){
        const rows=await request('employees?id=eq.'+encodeURIComponent(employee.coreEmployeeId),{method:'PATCH',body:JSON.stringify(payload),headers:{Prefer:'return=representation'}});
        if(rows?.[0])return rows[0];
      }
      const rows=await request('employees',{method:'POST',body:JSON.stringify(payload),headers:{Prefer:'return=representation'}});
      if(!rows?.[0])throw new Error('No se pudo crear el empleado en Panorama Core.');
      employee.coreEmployeeId=rows[0].id;
      return rows[0];
    }
  };

  /* UNIFICACIÓN: la nómina semanal no genera pagos ni solicitudes a Finanzas. */
  window.renderPayrollPaymentQueue=function(){
    const box=document.getElementById('payrollPaymentQueue');
    if(box)box.innerHTML='';
  };
  window.syncCorePaymentStatuses=async function(){};

  window.finalizeCurrentWeek=function(){
    const pending=weekPendingSessions();
    if(pending.length){
      alert(`No se puede finalizar la nómina: hay ${pending.length} registro(s) pendientes de revisión.`);
      return;
    }
    const {start,end}=currentWeekRange(),key=payrollPeriodKey(start);
    db.payrollPeriods=db.payrollPeriods||{};
    const snapshot=buildPayrollSnapshot(start,end);
    if(!snapshot.employees.length){
      alert('No hay horas aprobadas para finalizar en este periodo.');
      return;
    }
    if(confirm(`¿Confirmar la nómina del ${fmtDateShort(start)} al ${fmtDateShort(new Date(end-1))}?\n\nSe guardará una fotografía de ${snapshot.employees.length} trabajador(es), ${snapshot.totalHours.toFixed(1)} horas y $${snapshot.totalAmount.toFixed(2)}.`)){
      db.weekFinalizations=db.weekFinalizations||{};
      db.weekFinalizations[key]={status:'finalized',finalizedAt:new Date().toISOString()};
      db.payrollPeriods[key]={id:key,start:localDateKey(start),end:localDateKey(new Date(end-1)),status:'finalized',finalizedAt:new Date().toISOString(),snapshot};
      save();
      showToast('Periodo de nómina finalizado y guardado. Los pagos se registran únicamente en Pagos.');
    }
  };

  /* Limpia metadatos del sistema duplicado sin borrar pagos existentes. */
  Object.values(db.payrollPeriods||{}).forEach(period=>{
    if(period){
      delete period.coreRequests;
      delete period.corePaymentStatuses;
      delete period.paidAt;
      if(period.status==='paid'||period.status==='partial')period.status='finalized';
    }
  });

  /*
    RESUMEN CORRECTO DE PAGOS
    Separa dinero realmente entregado de dinero aplicado a nómina.
    Un pago nunca puede inflar "Nómina pagada" por encima de la nómina generada:
      aplicado = min(total pagado, nómina generada)
      excedente = max(total pagado - nómina generada, 0)
      pendiente = max(nómina generada - total pagado, 0)
  */
  function ensureExcessStat(){
    const stats=document.querySelector('#dashTotal')?.closest('.stats');
    if(!stats)return null;
    let card=document.getElementById('dashExcessCard');
    if(!card){
      card=document.createElement('div');
      card.className='stat';
      card.id='dashExcessCard';
      card.innerHTML='<div class="num" id="dashExcess">$0.00</div><div class="muted">Anticipos / excedente</div>';
      stats.insertBefore(card,document.getElementById('dashCount')?.parentElement||null);
    }
    return card;
  }

  window.renderDashboard=function(){
    const sel=document.getElementById('dashPeriod');
    if(sel)sel.value=dashPeriodValue;
    const range=dashRange();
    const start=range.start,end=range.end;
    const inPaidRange=p=>p.paidDate&&(!start||p.paidDate>=start)&&(!end||p.paidDate<=end);
    const inPayrollRange=x=>(!start||x.end>=start)&&(!end||x.start<=end);
    const paid=(db.payments||[]).filter(p=>p.status!=='void'&&inPaidRange(p));
    const payrolls=Object.values(db.payrollPeriods||{}).filter(inPayrollRange);
    const generatedByEmp={};
    payrolls.forEach(period=>(period.snapshot?.employees||[]).forEach(item=>{
      generatedByEmp[item.employeeId]=(generatedByEmp[item.employeeId]||0)+Number(item.amount||0);
    }));
    const paidByEmp={};
    paid.forEach(p=>{paidByEmp[p.employeeId]=(paidByEmp[p.employeeId]||0)+Number(p.amount||0);});
    const employeeIds=new Set([...Object.keys(generatedByEmp),...Object.keys(paidByEmp)]);
    let generated=0,applied=0,excess=0,pending=0;
    employeeIds.forEach(id=>{
      const g=generatedByEmp[id]||0;
      const p=paidByEmp[id]||0;
      generated+=g;
      applied+=Math.min(g,p);
      excess+=Math.max(p-g,0);
      pending+=Math.max(g-p,0);
    });

    document.getElementById('dashTotal').textContent='$'+applied.toFixed(2);
    document.getElementById('dashTotal').nextElementSibling.textContent='Pagado aplicado a nómina';
    document.getElementById('dashGenerated').textContent='$'+generated.toFixed(2);
    document.getElementById('dashPending').textContent='$'+pending.toFixed(2);
    document.getElementById('dashPending').nextElementSibling.textContent='Saldo pendiente';
    document.getElementById('dashCount').textContent=paid.length;
    ensureExcessStat();
    const excessEl=document.getElementById('dashExcess');
    if(excessEl)excessEl.textContent='$'+excess.toFixed(2);

    const buckets=dashboardBuckets(start,end);
    const vals=buckets.map(b=>paid.filter(p=>p.paidDate>=b.start&&p.paidDate<=b.end).reduce((a,p)=>a+Number(p.amount||0),0));
    const max=Math.max(...vals,0);
    document.getElementById('dashChartLabel').textContent=start?`${start} a ${end}`:'Agrupado por mes según fecha de pago';
    const chart=document.getElementById('dashChart');
    chart.innerHTML=!vals.length?'<div class="chart-empty">Selecciona un periodo para visualizar los pagos.</div>':vals.every(v=>v===0)?'<div class="chart-empty">No hay pagos registrados en este periodo.</div>':buckets.map((b,i)=>`<div class="chart-bar-group"><div class="chart-bar-value">${moneyShort(vals[i])}</div><div class="chart-bar" style="height:${Math.max(2,(vals[i]/max)*180)}px" title="$${vals[i].toFixed(2)}"></div><div class="chart-bar-label">${b.label.replace("\n","<br>")}</div></div>`).join('');

    const rows=(db.employees||[]).map(e=>{
      const g=generatedByEmp[e.id]||0,p=paidByEmp[e.id]||0;
      return {name:e.name,generated:g,applied:Math.min(g,p),pending:Math.max(g-p,0),excess:Math.max(p-g,0)};
    }).filter(r=>r.generated||r.applied||r.excess).sort((a,b)=>(b.pending+b.excess)-(a.pending+a.excess));
    document.getElementById('dashByEmp').innerHTML=rows.length?`<h3 style="margin-bottom:6px">Resumen por trabajador</h3><table><thead><tr><th>Trabajador</th><th>Nómina</th><th>Aplicado</th><th>Pendiente</th><th>Anticipo</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>$${r.generated.toFixed(2)}</td><td>$${r.applied.toFixed(2)}</td><td>$${r.pending.toFixed(2)}</td><td>$${r.excess.toFixed(2)}</td></tr>`).join('')}</tbody></table>`:'';
  };

  try{localStorage.setItem(STORE,JSON.stringify(db));}catch(e){console.warn('No se pudo limpiar el estado de pagos duplicado',e);}
  if(typeof renderAdmin==='function')renderAdmin();
  window.dispatchEvent(new CustomEvent('panorama-core-personal-ready'));
})();
