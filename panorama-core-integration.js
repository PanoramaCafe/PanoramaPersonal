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

  /*
     UNIFICACIÓN DE PAGOS
     - Se elimina visualmente la segunda cola de pagos por nómina semanal.
     - La sección "Pagos" existente es el único punto para registrar pagos.
     - Finalizar semana deja de comunicarse con Finanzas/Supabase: solo guarda
       la fotografía local del periodo para control e historial.
  */
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
      db.payrollPeriods[key]={
        id:key,
        start:localDateKey(start),
        end:localDateKey(new Date(end-1)),
        status:'finalized',
        finalizedAt:new Date().toISOString(),
        snapshot
      };
      save();
      showToast('Periodo de nómina finalizado y guardado. Los pagos se registran únicamente en Pagos.');
    }
  };

  /* Limpia metadatos del sistema duplicado cuando existan, sin borrar pagos. */
  Object.values(db.payrollPeriods||{}).forEach(period=>{
    if(period){
      delete period.coreRequests;
      delete period.corePaymentStatuses;
      delete period.paidAt;
      if(period.status==='paid'||period.status==='partial')period.status='finalized';
    }
  });
  try{localStorage.setItem(STORE,JSON.stringify(db));}catch(e){console.warn('No se pudo limpiar el estado de pagos duplicado',e);}

  if(typeof renderAdmin==='function')renderAdmin();
  window.dispatchEvent(new CustomEvent('panorama-core-personal-ready'));
})();