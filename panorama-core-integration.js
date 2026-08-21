/* Panorama Personal <-> Panorama Café Core
   Estado compartido + publicación directa de pagos reales a Finanzas.
   La tabla puente refleja exactamente los pagos actuales de Personal: altas y bajas.
*/
(function(){
  const cfg=window.PANORAMA_SUPABASE;
  const STORE='panorama_cafe_personal_v1';
  const ROW_ID='personal-main';
  if(!cfg?.url||!cfg?.key){console.warn('Panorama Core: falta configuración Supabase');return;}
  const headers={apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'};
  let pushing=false,pushTimer=null,lastRemoteUpdatedAt=null,applyingRemote=false;

  function readLocal(){try{return JSON.parse(localStorage.getItem(STORE)||'null');}catch{return null;}}
  function writeLocal(data){applyingRemote=true;try{localStorage.setItem(STORE,JSON.stringify(data));}finally{setTimeout(()=>applyingRemote=false,0);}}

  async function publishPayments(data){
    const payments=Array.isArray(data?.payments)?data.payments:[];
    const employees=new Map((Array.isArray(data?.employees)?data.employees:[]).map(e=>[String(e.id),e]));
    const activeIds=new Set(payments.filter(p=>p?.id).map(p=>String(p.id)));

    /* Primero eliminamos del puente únicamente pagos que pertenecen a Personal
       pero ya no existen en su historial actual. */
    const existingResponse=await fetch(cfg.url+'/rest/v1/panorama_payroll_payments?source=eq.personal&select=id',{headers});
    if(!existingResponse.ok) throw new Error(await existingResponse.text());
    const existing=await existingResponse.json();
    for(const row of (Array.isArray(existing)?existing:[])){
      const id=String(row.id);
      if(activeIds.has(id)) continue;
      const del=await fetch(cfg.url+'/rest/v1/panorama_payroll_payments?id=eq.'+encodeURIComponent(id)+'&source=eq.personal',{method:'DELETE',headers:{...headers,Prefer:'return=minimal'}});
      if(!del.ok) throw new Error(await del.text());
    }

    /* Después publicamos o actualizamos los pagos que sí siguen vigentes. */
    for(const p of payments){
      if(!p?.id||!p?.employeeId||!Number.isFinite(Number(p.amount))) continue;
      const employee=employees.get(String(p.employeeId))||{};
      const body={
        id:String(p.id),source:'personal',employee_id:String(p.employeeId),
        employee_name:String(employee.name||p.employeeName||''),amount:Number(p.amount||0),
        paid_date:String(p.paidDate||new Date().toISOString().slice(0,10)).slice(0,10),
        period_start:p.periodStart?String(p.periodStart).slice(0,10):null,
        period_end:p.periodEnd?String(p.periodEnd).slice(0,10):null,
        note:String(p.note||''),account:p.account?String(p.account):null,
        updated_at:new Date().toISOString()
      };
      const r=await fetch(cfg.url+'/rest/v1/panorama_payroll_payments?on_conflict=id',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)});
      if(!r.ok) throw new Error(await r.text());
    }
  }

  async function push(){
    if(pushing||applyingRemote)return;
    const data=readLocal();if(!data)return;
    pushing=true;
    try{
      const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?id=eq.'+encodeURIComponent(ROW_ID),{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({data})});
      if(!r.ok) throw new Error(await r.text());
      const rows=await r.json();lastRemoteUpdatedAt=rows?.[0]?.updated_at||lastRemoteUpdatedAt;
      await publishPayments(data);
      window.dispatchEvent(new CustomEvent('panorama-core-personal-synced'));
    }catch(e){console.warn('Panorama Core: no se pudo sincronizar Personal',e);}finally{pushing=false;}
  }
  async function pull(initial=false){
    if(pushing)return;
    try{
      const r=await fetch(cfg.url+'/rest/v1/panorama_personal_state?id=eq.'+encodeURIComponent(ROW_ID)+'&select=data,updated_at',{headers});
      if(!r.ok)throw new Error(await r.text());
      const row=(await r.json())?.[0];if(!row?.data)return;
      if(initial&&!readLocal()){writeLocal(row.data);location.reload();return;}
      if(lastRemoteUpdatedAt&&row.updated_at===lastRemoteUpdatedAt)return;
      lastRemoteUpdatedAt=row.updated_at;const current=readLocal();
      if(JSON.stringify(current)!==JSON.stringify(row.data)){writeLocal(row.data);location.reload();}
    }catch(e){console.warn('Panorama Core: no se pudo leer estado remoto',e);}
  }
  const originalSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){const out=originalSetItem.apply(this,arguments);if(this===localStorage&&key===STORE&&!applyingRemote){clearTimeout(pushTimer);pushTimer=setTimeout(push,250);}return out;};
  window.PanoramaCore={
    paymentStatus:async(periodId,employeeId)=>{const url=cfg.url+'/rest/v1/payroll_payment_requests?external_payroll_period_id=eq.'+encodeURIComponent(String(periodId))+'&employee_id=eq.'+encodeURIComponent(String(employeeId))+'&select=id,status,amount,period_start,period_end';const r=await fetch(url,{headers});if(!r.ok)throw new Error(await r.text());return r.json();},
    syncNow:push
  };
  window.addEventListener('load',async()=>{await pull(true);await push();window.dispatchEvent(new Event('panorama-core-personal-ready'));});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pull(false);});
  window.addEventListener('focus',()=>pull(false));
})();